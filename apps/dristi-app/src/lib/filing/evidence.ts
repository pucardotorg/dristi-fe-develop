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
import { RETURN_REASONS } from "./options";
import type { ChequeDetails } from "./types";

/** Evidence types this module builds (spec 0021 §5.2). */
export type EvidenceType = "CHEQUE" | "RETURN_MEMO" | "LEGAL_DEMAND_NOTICE";

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

/**
 * The return reason as written on the memo. The draft stores an option code
 * (`funds-insufficient`); the backend takes the human label, since the reason is free text
 * there until its option list is agreed (spec 0021 §5.2, "not yet enforced").
 */
export function returnReasonText(code: string): string {
  return RETURN_REASONS.find((o) => o.value === code)?.label ?? code;
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
