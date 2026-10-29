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

import { IFSC_PATTERN } from "./lookups";
import {
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  PAYMENT_STATUS,
  RETURN_REASONS,
  WHY_ISSUED,
  type Option,
} from "./options";
import type { ChequeDetails, DemandNotice } from "./types";

/** Evidence types this module builds (spec 0021 §5.2). */
export type EvidenceType = "CHEQUE" | "RETURN_MEMO" | "LEGAL_DEMAND_NOTICE";

/** An `evidence_info` body, as the backend's per-type schema expects it. */
export type EvidenceInfoBody = Record<string, string | number | boolean>;

/**
 * The label a dropdown value stands for. The draft stores option codes; the backend takes
 * the human text, since these fields are free text there until their option lists are
 * agreed (spec 0021 §5.2, "not yet enforced").
 */
function optionLabel(options: readonly Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

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

const CHEQUE_NUMBER_PATTERN = /^[0-9]{6}$/;

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

/** The return reason as written on the memo (the label its stored code stands for). */
export function returnReasonText(code: string): string {
  return optionLabel(RETURN_REASONS, code);
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
    return_reason: returnReasonText(cheque.returnReason),
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
  return !!cheque.presentDate && !!cheque.returnDate && !!cheque.returnReason;
}

/**
 * Build the `LEGAL_DEMAND_NOTICE` evidence_info for a demand notice.
 *
 * `tracking_number` and `delivery_date` are left out when empty (the schema rejects an
 * empty string for either). The draft's "not delivered" fields (return date, reason) and
 * the part-payment amount have no home in the schema yet, so they are not sent (see the
 * demand-notice integration tracker).
 */
export function demandNoticeEvidenceInfo(notice: DemandNotice): EvidenceInfoBody {
  const info: EvidenceInfoBody = {
    nature_of_debt: optionLabel(NATURE_OF_DEBT, notice.natureDebt),
    cheque_issue_reason: optionLabel(WHY_ISSUED, notice.whyIssued),
    dispatch_date: notice.dispatchDate,
    mode_of_service: optionLabel(MODE_OF_SERVICE, notice.modeService),
    is_delivered: notice.delivered === "yes",
    accused_replied: notice.replied === "yes",
    payment_status: optionLabel(PAYMENT_STATUS, notice.paymentStatus),
  };
  const tracking = notice.tracking.trim();
  if (tracking) info.tracking_number = tracking;
  // The 15-day payment window runs from the delivery date, which only applies when delivered.
  if (notice.delivered === "yes" && notice.deliveryDate) info.delivery_date = notice.deliveryDate;
  return info;
}

/** Whether a demand notice has every `LEGAL_DEMAND_NOTICE` field the backend requires. */
export function demandNoticeReady(notice: DemandNotice): boolean {
  const base =
    !!notice.natureDebt &&
    !!notice.whyIssued &&
    !!notice.dispatchDate &&
    !!notice.modeService &&
    !!notice.paymentStatus;
  if (!base) return false;
  // A delivered notice needs its delivery date (the backend requires it then).
  return notice.delivered === "yes" ? !!notice.deliveryDate : true;
}
