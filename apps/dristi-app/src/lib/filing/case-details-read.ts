/**
 * The cheque, demand-notice, jurisdiction, ADR/prayer and affidavit steps as the backend
 * case holds them.
 *
 * When one of those steps opens, the case's copy replaces this browser's: whatever the case
 * has saved is what the screen shows. (Edits made since the last Continue are not kept
 * apart — saving every field as it is filled will make the case always current.) Beyond
 * that:
 *
 *   - A row never saved to the case stays as typed.
 *   - A row this browser saved that the case no longer has is kept and marked unsaved, so
 *     Continue adds it again rather than losing what was typed.
 *   - Rows on the case this browser has never seen are added in the case's order, in place
 *     of an untouched blank row.
 *
 * Pure, so it is tested without rendering the form.
 */

import { blankAdr, blankCheque, blankJurisdiction, blankNotice } from "./blank";
import type { CaseRead, EvidenceRead } from "./data/cases-api";
import {
  chequeFromEvidence,
  noticeFromEvidence,
  returnMemoFromEvidence,
} from "./evidence";
import { complaintFilingDate, derivedCauseDate } from "./selectors";
import type { AdrPrayer, ChequeDetails, DemandNotice, FilingDraft, Jurisdiction, OtherCase } from "./types";

/** The details sections as the backend names them (`/cases/{id}/details/{section}`). */
export const JURISDICTION_SECTION = "jurisdiction_limitation";
export const ADR_SECTION = "adr_other_prayer";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ofType(read: CaseRead, type: string): EvidenceRead[] {
  return read.evidence
    .filter((e) => e.evidence_type === type)
    .sort((a, b) => a.ordinal - b.ordinal);
}

/** A row nobody has typed into: the blank one a new draft starts with. */
function untouched<T extends { id: string }>(row: T, blank: T): boolean {
  return JSON.stringify({ ...row, id: "" }) === JSON.stringify({ ...blank, id: "" });
}

/**
 * Line local rows up against the case's, by the evidence ids they hold. `ids` names a row's
 * ids, `rebuild` makes a row from the case's copy (on top of the local one, if any) and
 * `unlink` takes a row's ids off.
 */
function mergeRows<T extends { id: string }, R>(
  local: T[],
  remote: R[],
  matches: (row: T, remote: R) => boolean,
  options: {
    ids: (row: T) => Array<string | undefined>;
    rebuild: (remote: R, base: T | undefined) => T;
    unlink: (row: T) => T;
    blank: () => T;
  }
): T[] {
  const taken = new Set<number>();
  const rows = local.map((row) => {
    if (!options.ids(row).some(Boolean)) return row;
    const k = remote.findIndex((r, j) => !taken.has(j) && matches(row, r));
    if (k < 0) return options.unlink(row);
    taken.add(k);
    return options.rebuild(remote[k], row);
  });
  const added = remote.filter((_, j) => !taken.has(j));
  if (added.length === 0) return rows;
  // The case's rows take the place of a blank row the draft started with.
  return [
    ...rows.filter((row) => !untouched(row, options.blank())),
    ...added.map((r) => options.rebuild(r, undefined)),
  ];
}

/* ─────────────────────────────── Cheques & return memos ─────────────────────────── */

/** A cheque's `CHEQUE` and `RETURN_MEMO` rows: the case pairs them by ordinal. */
type ChequePair = { cheque?: EvidenceRead; memo?: EvidenceRead };

function chequePairs(read: CaseRead): ChequePair[] {
  const cheques = ofType(read, "CHEQUE");
  const memos = ofType(read, "RETURN_MEMO");
  const ordinals = [...new Set([...cheques, ...memos].map((e) => e.ordinal))].sort(
    (a, b) => a - b
  );
  return ordinals.map((n) => ({
    cheque: cheques.find((e) => e.ordinal === n),
    memo: memos.find((e) => e.ordinal === n),
  }));
}

function chequeFrom(pair: ChequePair, base: ChequeDetails | undefined): ChequeDetails {
  return {
    ...(base ?? blankCheque()),
    ...(pair.cheque ? chequeFromEvidence(pair.cheque.evidence_info) : {}),
    ...(pair.memo ? returnMemoFromEvidence(pair.memo.evidence_info) : {}),
    // The case holds each cheque's own bank, so it never inherits the previous one's.
    sameAsPrev: "no",
    ifscFetched: false,
    chequeEvidenceId: pair.cheque?.case_evidence_id,
    returnMemoEvidenceId: pair.memo?.case_evidence_id,
  };
}

export function chequesFromCase(read: CaseRead, local: ChequeDetails[]): ChequeDetails[] {
  return mergeRows(
    local,
    chequePairs(read),
    (c, pair) =>
      (!!c.chequeEvidenceId && pair.cheque?.case_evidence_id === c.chequeEvidenceId) ||
      (!!c.returnMemoEvidenceId && pair.memo?.case_evidence_id === c.returnMemoEvidenceId),
    {
      ids: (c) => [c.chequeEvidenceId, c.returnMemoEvidenceId],
      rebuild: chequeFrom,
      unlink: (c) => ({ ...c, chequeEvidenceId: undefined, returnMemoEvidenceId: undefined }),
      blank: blankCheque,
    }
  );
}

/* ────────────────────────────────── Demand notices ──────────────────────────────── */

function noticeFrom(e: EvidenceRead, base: DemandNotice | undefined): DemandNotice {
  return {
    ...(base ?? blankNotice()),
    ...noticeFromEvidence(e.evidence_info),
    noticeEvidenceId: e.case_evidence_id,
  };
}

export function noticesFromCase(read: CaseRead, local: DemandNotice[]): DemandNotice[] {
  return mergeRows(
    local,
    ofType(read, "LEGAL_DEMAND_NOTICE"),
    (n, e) => n.noticeEvidenceId === e.case_evidence_id,
    {
      ids: (n) => [n.noticeEvidenceId],
      rebuild: noticeFrom,
      unlink: (n) => ({ ...n, noticeEvidenceId: undefined }),
      blank: blankNotice,
    }
  );
}

/* ─────────────────────────────── Details sections ───────────────────────────────── */

function otherCasesFrom(value: unknown): OtherCase[] {
  const cases = Array.isArray(value)
    ? value.flatMap((c) =>
        isRecord(c) ? [{ court: text(c.court), caseNumber: text(c.case_number) }] : []
      )
    : [];
  return cases.length ? cases : [{ court: "", caseNumber: "" }];
}

/**
 * The jurisdiction & limitation section from the case. A date the form works out for
 * itself (the cause of action from the notice, the filing date as today) is left blank,
 * so it keeps following the case rather than being frozen as if typed.
 */
function jurisdictionFrom(data: Record<string, unknown>, draft: FilingDraft): Jurisdiction {
  const blank = blankJurisdiction();
  const causeDate = text(data.cause_of_action_date);
  const filingDate = text(data.complaint_filing_date);
  return {
    ...blank,
    deposited: data.cheque_deposited_by_payee === false ? "no" : "yes",
    ifsc: text(data.payee_ifsc_code),
    payeeBankName: text(data.payee_bank_name),
    payeeBankBranch: text(data.payee_bank_branch),
    payeePolice: text(data.payee_bank_police_station),
    drawerPolice: text(data.drawer_bank_police_station),
    otherPending: data.other_complaints_pending === true ? "yes" : "no",
    otherCases: otherCasesFrom(data.other_complaints),
    causeDate: causeDate === derivedCauseDate(draft) ? "" : causeDate,
    filingDate:
      filingDate === complaintFilingDate({ ...draft, jurisdiction: blank }) ? "" : filingDate,
    condonationReason: text(data.condonation_reason),
  };
}

function adrFrom(data: Record<string, unknown>, base: AdrPrayer): AdrPrayer {
  const preference = text(data.adr_preference).toLowerCase();
  return {
    ...blankAdr(),
    adr: preference === "no" || preference === "maybe" ? preference : "yes",
    otherDetails: text(data.other_details),
    detailsFormat: base.detailsFormat,
    interimRelief: text(data.interim_relief),
    finalRelief: text(data.final_relief),
  };
}

/** A section the case has saved, or `undefined` before it is first saved (`{}`). */
function savedSection(read: CaseRead, name: string): Record<string, unknown> | undefined {
  const data = read.details[name];
  return data && Object.keys(data).length > 0 ? data : undefined;
}

/** Put the case's jurisdiction & limitation on the draft, once the case has it. */
export function jurisdictionFromCase(read: CaseRead, draft: FilingDraft): void {
  const data = savedSection(read, JURISDICTION_SECTION);
  if (data) draft.jurisdiction = jurisdictionFrom(data, draft);
}

/** Put the case's ADR, other details and prayer on the draft, once the case has them. */
export function adrFromCase(read: CaseRead, draft: FilingDraft): void {
  const data = savedSection(read, ADR_SECTION);
  if (data) draft.adr = adrFrom(data, draft.adr);
}

/**
 * Put the case's affidavit on the draft, once the case has one. One that reads as the
 * standard text does now (`standard`) stays "standard" (empty), so it keeps following the
 * case as the parties and cheques change.
 */
export function affidavitFromCase(read: CaseRead, draft: FilingDraft, standard: string): void {
  if (read.affidavit === null) return;
  draft.affidavit = read.affidavit === standard ? "" : read.affidavit;
}
