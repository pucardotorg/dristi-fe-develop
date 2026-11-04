/**
 * Turning the local cheque draft into the backend's evidence shapes (dristi-be spec 0021
 * §5.1–5.2), and deciding when a row is complete enough to save.
 *
 * One cheque on the draft is two evidence rows on the case: a `CHEQUE` (the cheque leaf
 * plus the drawer's bank) and a `RETURN_MEMO` (the bank's dishonour memo), matched by
 * ordinal. These are pure functions so they can be unit-tested without the store; the
 * backend calls live in `data/cases-api.ts`.
 *
 * The backend rejects an incomplete section (every required key is checked on write), so a
 * caller saves a row only once `chequeReady` / `returnMemoReady` says it will be accepted;
 * a half-filled cheque stays the browser's working copy until it is finished.
 */

import { CHEQUE_NUMBER_PATTERN, IFSC_PATTERN } from "./lookups";
import { NON_DELIVERY_REASON_CODES } from "./options";
import type { ChequeDetails, DemandNotice } from "./types";

/** Evidence types this module builds (spec 0021 §5.2). */
export type EvidenceType = "CHEQUE" | "RETURN_MEMO" | "LEGAL_DEMAND_NOTICE";

/** An `evidence_info` body, as the backend's per-type schema expects it. */
export type EvidenceInfoBody = Record<string, string | number | boolean>;

/** A `CHEQUE` evidence_info body, as the backend's schema expects it. */
export type ChequeEvidenceInfo = {
  cheque_date: string;
  amount: number;
  cheque_number: string;
  ifsc_code: string;
  bank_name: string;
  bank_branch: string;
};

/** A `RETURN_MEMO` evidence_info body. */
export type ReturnMemoEvidenceInfo = {
  presentation_date: string;
  return_date: string;
  return_reason: string;
};

/** The drawer's bank written on a cheque. */
type Bank = { ifsc: string; bankName: string; bankBranch: string };

/**
 * The bank details that apply to the cheque at `index`. A cheque that answered "same bank
 * as the previous cheque" inherits the previous cheque's bank, following the chain back to
 * the first cheque that set its own.
 */
export function chequeBank(cheques: ChequeDetails[], index: number): Bank {
  let i = index;
  while (i > 0 && cheques[i].sameAsPrev === "yes") i -= 1;
  const c = cheques[i];
  return { ifsc: c.ifsc.trim().toUpperCase(), bankName: c.bankName.trim(), bankBranch: c.bankBranch.trim() };
}

/** The amount as the backend wants it — a positive number — or `null` when it is not one. */
export function chequeAmount(amount: string): number | null {
  // The field is typed with a ₹ prefix; grouping commas and stray spaces are not digits.
  const cleaned = amount.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The local return-reason code mapped to the backend's `ReturnReason` enum value. Every
 * design option now has a backend value (the enum gained `SIGNATURE_DIFFERS` and
 * `AMOUNT_MISMATCH`), so an unknown code maps to `null` only as a defensive fallback.
 */
const RETURN_REASON_VALUE: Record<string, string> = {
  "funds-insufficient": "FUNDS_INSUFFICIENT",
  "exceeds-arrangement": "EXCEEDS_ARRANGEMENT",
  "account-closed": "ACCOUNT_CLOSED",
  "payment-stopped": "PAYMENT_STOPPED_BY_DRAWER",
  "refer-to-drawer": "REFER_TO_DRAWER",
  "stale-cheque": "POST_DATED_OR_STALE",
  "signature-differs": "SIGNATURE_DIFFERS",
  "amount-mismatch": "AMOUNT_MISMATCH",
};

export function returnReasonValue(code: string): string | null {
  return RETURN_REASON_VALUE[code] ?? null;
}

/** Build the `CHEQUE` evidence_info for the cheque at `index`, resolving its bank. */
export function chequeEvidenceInfo(cheques: ChequeDetails[], index: number): ChequeEvidenceInfo {
  const cheque = cheques[index];
  const bank = chequeBank(cheques, index);
  return {
    cheque_date: cheque.dateOnCheque,
    amount: chequeAmount(cheque.amount) ?? 0,
    cheque_number: cheque.chequeNumber.trim(),
    ifsc_code: bank.ifsc,
    bank_name: bank.bankName,
    bank_branch: bank.bankBranch,
  };
}

/** Build the `RETURN_MEMO` evidence_info for a cheque. */
export function returnMemoEvidenceInfo(cheque: ChequeDetails): ReturnMemoEvidenceInfo {
  return {
    presentation_date: cheque.presentDate,
    return_date: cheque.returnDate,
    // Readiness guarantees the reason maps to a backend value; "" is a safe fallback.
    return_reason: returnReasonValue(cheque.returnReason) ?? "",
  };
}

/**
 * Whether the cheque at `index` has every `CHEQUE` field the backend requires, each in a
 * shape it will accept — so saving it will not be rejected as incomplete or malformed.
 */
export function chequeReady(cheques: ChequeDetails[], index: number): boolean {
  const cheque = cheques[index];
  const bank = chequeBank(cheques, index);
  return (
    !!cheque.dateOnCheque &&
    chequeAmount(cheque.amount) !== null &&
    CHEQUE_NUMBER_PATTERN.test(cheque.chequeNumber.trim()) &&
    IFSC_PATTERN.test(bank.ifsc) &&
    !!bank.bankName &&
    !!bank.bankBranch
  );
}

/** Whether a cheque's return memo has every `RETURN_MEMO` field the backend requires. */
export function returnMemoReady(cheque: ChequeDetails): boolean {
  // The return reason must be one the backend's enum accepts; two design options have no
  // backend value yet (tracker B1), so a memo using them is held back until the enum grows.
  return !!cheque.presentDate && !!cheque.returnDate && returnReasonValue(cheque.returnReason) !== null;
}

/** Local payment-status code → the backend's `PaymentStatus` enum value. */
const PAYMENT_STATUS_VALUE: Record<"none" | "part", string> = {
  none: "NO_PAYMENT_MADE",
  part: "PART_PAYMENT",
};

/** Local nature-of-debt code → backend `NatureOfDebt` enum value (every option maps). */
const NATURE_OF_DEBT_VALUE: Record<string, string> = {
  loan: "LOAN_OR_ADVANCE_REPAYMENT",
  goods: "GOODS_SUPPLIED",
  services: "SERVICES_RENDERED",
  business: "BUSINESS_OR_TRADE_TRANSACTION",
  borrowed: "BORROWED_MONEY_REPAYMENT",
  other: "OTHER_LIABILITY",
};

/** Local mode-of-service code → backend `ModeOfService` enum value (every option maps). */
const MODE_OF_SERVICE_VALUE: Record<string, string> = {
  rpad: "REGISTERED_POST",
  speed: "SPEED_POST",
  courier: "COURIER",
  email: "EMAIL",
  hand: "HAND_DELIVERY",
  fax: "FAX",
};

/**
 * Local non-delivery-reason code → backend `NonDeliveryReason` enum value. Every design
 * option now has a backend value, so an unknown code maps to `null` only as a defensive
 * fallback. The map itself lives next to the option list in `options.ts`.
 */
export function nonDeliveryReasonValue(code: string): string | null {
  return NON_DELIVERY_REASON_CODES[code] ?? null;
}

/**
 * Build the `LEGAL_DEMAND_NOTICE` evidence_info for a demand notice.
 *
 * `payment_status` is sent as the backend's enum value. A delivered notice carries its
 * delivery date; an undelivered one carries when it came back and why (both required then);
 * a part payment carries its amount. `tracking_number` is left out when empty.
 */
export function demandNoticeEvidenceInfo(notice: DemandNotice): EvidenceInfoBody {
  const delivered = notice.delivered === "yes";
  const info: EvidenceInfoBody = {
    // Readiness guarantees these map; "" is a safe fallback. cheque_issue_reason is no
    // longer sent — the backend dropped it (the design never had a separate field for it).
    nature_of_debt: NATURE_OF_DEBT_VALUE[notice.natureDebt] ?? "",
    dispatch_date: notice.dispatchDate,
    mode_of_service: MODE_OF_SERVICE_VALUE[notice.modeService] ?? "",
    is_delivered: delivered,
    accused_replied: notice.replied === "yes",
  };
  if (notice.paymentStatus) info.payment_status = PAYMENT_STATUS_VALUE[notice.paymentStatus];
  const tracking = notice.tracking.trim();
  if (tracking) info.tracking_number = tracking;
  if (delivered) {
    // The 15-day payment window runs from the delivery date.
    if (notice.deliveryDate) info.delivery_date = notice.deliveryDate;
  } else {
    if (notice.returnDate) info.return_date = notice.returnDate;
    const reason = nonDeliveryReasonValue(notice.nonDeliveryReason);
    if (reason) info.non_delivery_reason = reason;
  }
  if (notice.paymentStatus === "part") {
    const amount = chequeAmount(notice.partAmount);
    if (amount !== null) info.part_payment_amount = amount;
  }
  return info;
}

/** Whether a demand notice has every `LEGAL_DEMAND_NOTICE` field the backend requires. */
export function demandNoticeReady(notice: DemandNotice): boolean {
  const base =
    !!notice.natureDebt &&
    !!notice.dispatchDate &&
    !!notice.modeService &&
    !!notice.paymentStatus;
  if (!base) return false;
  if (notice.delivered === "yes") {
    // A delivered notice needs its delivery date.
    if (!notice.deliveryDate) return false;
  } else {
    // An undelivered one needs its return date and a backend-known non-delivery reason
    // ("address incomplete" has no backend value yet — tracker B3 — so it holds the row back).
    if (!notice.returnDate || nonDeliveryReasonValue(notice.nonDeliveryReason) === null) return false;
  }
  // A part payment needs a valid amount.
  if (notice.paymentStatus === "part" && chequeAmount(notice.partAmount) === null) return false;
  return true;
}
