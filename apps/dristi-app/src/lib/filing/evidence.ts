/**
 * Turning the local cheque draft into the backend's evidence shapes (dristi-be spec 0021
 * §5.1–5.2), and deciding when a row is complete enough to save.
 *
 * One cheque on the draft is two evidence rows on the case: a `CHEQUE` (the cheque leaf
 * plus the drawer's bank) and a `RETURN_MEMO` (the bank's dishonour memo), matched by
 * ordinal. These are pure functions so they can be unit-tested without the store; the
 * backend calls live in `data/cases-api.ts`.
 *
 * The backend accepts a partly filled row: on save it drops the required-field rules and
 * strips empty values, but it still refuses a malformed one (a `0` amount, a bad cheque
 * number or IFSC, an option code outside its enum). So each builder sends only the fields
 * that are filled and well-formed and leaves the rest out; completeness is enforced by
 * `POST /cases/{id}/validate` before signing, not here.
 */

import {
  ACCOUNT_NUMBER_PATTERN,
  CHEQUE_NUMBER_PATTERN,
  IFSC_PATTERN,
  normaliseAccountNumber,
} from "./lookups";
import { NON_DELIVERY_REASON_CODES } from "./options";
import type { ChequeDetails, DemandNotice } from "./types";

/** Evidence types this module builds (spec 0021 §5.2). */
export type EvidenceType = "CHEQUE" | "RETURN_MEMO" | "LEGAL_DEMAND_NOTICE";

/** An `evidence_info` body, as the backend's per-type schema expects it. */
export type EvidenceInfoBody = Record<string, string | number | boolean>;

/** The drawer's bank and account written on a cheque. */
type Bank = { ifsc: string; bankName: string; bankBranch: string; accountNumber: string };

/**
 * The bank details that apply to the cheque at `index`. A cheque that answered "same bank
 * as the previous cheque" inherits the previous cheque's bank and account, following the
 * chain back to the first cheque that set its own.
 */
export function chequeBank(cheques: ChequeDetails[], index: number): Bank {
  let i = index;
  while (i > 0 && cheques[i].sameAsPrev === "yes") i -= 1;
  const c = cheques[i];
  return {
    ifsc: c.ifsc.trim().toUpperCase(),
    bankName: c.bankName.trim(),
    bankBranch: c.bankBranch.trim(),
    accountNumber: normaliseAccountNumber(c.accountNumber),
  };
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

/**
 * Build the `CHEQUE` evidence_info for the cheque at `index`, resolving its bank. Only the
 * filled, well-formed fields are sent: a blank one is left out, as are a non-positive
 * amount and a cheque number or IFSC that is not yet in the shape the backend accepts.
 */
export function chequeEvidenceInfo(cheques: ChequeDetails[], index: number): EvidenceInfoBody {
  const cheque = cheques[index];
  const bank = chequeBank(cheques, index);
  const info: EvidenceInfoBody = {};
  if (cheque.dateOnCheque) info.cheque_date = cheque.dateOnCheque;
  const amount = chequeAmount(cheque.amount);
  if (amount !== null) info.amount = amount;
  const chequeNumber = cheque.chequeNumber.trim();
  if (CHEQUE_NUMBER_PATTERN.test(chequeNumber)) info.cheque_number = chequeNumber;
  if (IFSC_PATTERN.test(bank.ifsc)) info.ifsc_code = bank.ifsc;
  if (bank.bankName) info.bank_name = bank.bankName;
  if (bank.bankBranch) info.bank_branch = bank.bankBranch;
  // `CHQ-7a`: optional in the backend's schema, required by the form (`chequeFullyComplete`).
  if (ACCOUNT_NUMBER_PATTERN.test(bank.accountNumber)) {
    info.bank_account_number = bank.accountNumber;
  }
  return info;
}

/**
 * Build the `RETURN_MEMO` evidence_info for a cheque, leaving out any field not yet filled.
 * A return reason with no backend enum value is left out rather than sent blank.
 */
export function returnMemoEvidenceInfo(cheque: ChequeDetails): EvidenceInfoBody {
  const info: EvidenceInfoBody = {};
  if (cheque.presentDate) info.presentation_date = cheque.presentDate;
  if (cheque.returnDate) info.return_date = cheque.returnDate;
  const reason = returnReasonValue(cheque.returnReason);
  if (reason) info.return_reason = reason;
  return info;
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
 * Build the `LEGAL_DEMAND_NOTICE` evidence_info for a demand notice, sending only what is
 * filled and well-formed.
 *
 * `is_delivered` and `accused_replied` carry the form's yes/no answer, which always has a
 * value. Everything else — `nature_of_debt`, the dates, `mode_of_service`, `payment_status`,
 * the non-delivery reason and a part payment's amount — is left out until it is filled, and
 * an option code with no backend enum value is left out rather than sent blank. A delivered
 * notice carries its delivery date; an undelivered one carries when it came back and why.
 */
export function demandNoticeEvidenceInfo(notice: DemandNotice): EvidenceInfoBody {
  const delivered = notice.delivered === "yes";
  const info: EvidenceInfoBody = {
    is_delivered: delivered,
    accused_replied: notice.replied === "yes",
  };
  // cheque_issue_reason is not sent — the backend dropped it.
  const natureOfDebt = NATURE_OF_DEBT_VALUE[notice.natureDebt];
  if (natureOfDebt) info.nature_of_debt = natureOfDebt;
  // LDN-1a: the filer's description of an "other" debt. The backend refuses it with any
  // other nature (E07023) and refuses it blank, so it goes only with "other" and real text;
  // switching away leaves it out, and the PATCH that replaces evidence_info drops it.
  const natureDebtOther = notice.natureDebtOther.trim();
  if (natureOfDebt === NATURE_OF_DEBT_VALUE.other && natureDebtOther) {
    info.nature_of_debt_other = natureDebtOther;
  }
  if (notice.dispatchDate) info.dispatch_date = notice.dispatchDate;
  const modeOfService = MODE_OF_SERVICE_VALUE[notice.modeService];
  if (modeOfService) info.mode_of_service = modeOfService;
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

/**
 * Whether a demand notice has anything worth saving: a brand-new one carries only the
 * default `is_delivered` / `accused_replied` answers, and should not create an empty row.
 */
export function demandNoticeHasContent(notice: DemandNotice): boolean {
  return Object.keys(demandNoticeEvidenceInfo(notice)).some(
    (key) => key !== "is_delivered" && key !== "accused_replied",
  );
}

/* ─────────────────────────────── Reading back from the case ─────────────────────── */

/** The local code whose backend value is `value`, or "" when none maps to it. */
function codeFor(map: Record<string, string>, value: unknown): string {
  return Object.keys(map).find((code) => map[code] === value) ?? "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A backend number as the form types it; "" when it is not one. */
function amountText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  // A decimal field may come back as a string ("50000.00").
  return typeof value === "string" && value.trim() ? String(Number(value)) : "";
}

/** The cheque fields a `CHEQUE` evidence_info holds. */
export function chequeFromEvidence(
  info: Record<string, unknown>,
): Pick<
  ChequeDetails,
  "dateOnCheque" | "amount" | "chequeNumber" | "ifsc" | "bankName" | "bankBranch" | "accountNumber"
> {
  return {
    dateOnCheque: text(info.cheque_date),
    amount: amountText(info.amount),
    chequeNumber: text(info.cheque_number),
    ifsc: text(info.ifsc_code),
    bankName: text(info.bank_name),
    bankBranch: text(info.bank_branch),
    accountNumber: text(info.bank_account_number),
  };
}

/** The cheque fields a `RETURN_MEMO` evidence_info holds. */
export function returnMemoFromEvidence(
  info: Record<string, unknown>,
): Pick<ChequeDetails, "presentDate" | "returnDate" | "returnReason"> {
  return {
    presentDate: text(info.presentation_date),
    returnDate: text(info.return_date),
    returnReason: codeFor(RETURN_REASON_VALUE, info.return_reason),
  };
}

/** The demand-notice fields a `LEGAL_DEMAND_NOTICE` evidence_info holds. */
export function noticeFromEvidence(
  info: Record<string, unknown>,
): Omit<DemandNotice, "id" | "noticeEvidenceId"> {
  const paymentStatus = codeFor(PAYMENT_STATUS_VALUE, info.payment_status);
  return {
    natureDebt: codeFor(NATURE_OF_DEBT_VALUE, info.nature_of_debt),
    natureDebtOther: text(info.nature_of_debt_other),
    dispatchDate: text(info.dispatch_date),
    modeService: codeFor(MODE_OF_SERVICE_VALUE, info.mode_of_service),
    tracking: text(info.tracking_number),
    delivered: info.is_delivered === false ? "no" : "yes",
    deliveryDate: text(info.delivery_date),
    replied: info.accused_replied === true ? "yes" : "no",
    returnDate: text(info.return_date),
    nonDeliveryReason: codeFor(NON_DELIVERY_REASON_CODES, info.non_delivery_reason),
    paymentStatus: paymentStatus === "none" || paymentStatus === "part" ? paymentStatus : "",
    partAmount: amountText(info.part_payment_amount),
  };
}
