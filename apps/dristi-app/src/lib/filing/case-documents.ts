/**
 * What on the draft is saved to the backend case as a case document, and how.
 *
 * Two kinds of record hold a file the case should have: an intake slot, and a custom row
 * the filer added to the list of documents. A list row that mirrors a slot is not a
 * record of its own — the slot is saved, carrying the row's "Natively digital" tick.
 *
 * A complainant's identity proof, vakalatnama and PoA document are linked to their
 * participant (`case_participant_id`): the backend's completeness check needs each one
 * on the complainant it belongs to.
 *
 * A demand notice's papers — proof of dispatch, proof of delivery, reply — are linked to
 * that notice's evidence row (`case_evidence_id`): a delivered notice without a linked
 * proof of delivery fails the backend's check. Scans go the other way: the cheque, return
 * memo and notice evidence rows point at their scan (`case_document_id`), and a scan is
 * never sent with `case_evidence_id`.
 *
 * The backend type says what a document is, never which cheque or party it is for; the
 * number lives only in the slot's key and the name the screen gives it.
 */

import { caseRecordGroup, type CaseRecordKind } from "./blank";
import {
  caseDocumentType,
  type CaseDocumentMeta,
  type CaseDocumentType,
} from "./data/cases-api";
import {
  documentGroupForParty,
  findDocumentRow,
  findIntakeSlot,
  intakeSlots,
  resolveIntakeSlot,
  rowForSlot,
} from "./selectors";
import type {
  CaseDocument,
  Complainant,
  DemandNotice,
  DocumentGroup,
  FilingDraft,
  Intake,
  IntakeDocType,
  IntakeGroup,
  IntakeSlot,
  SyncedFile,
} from "./types";

/** An intake slot, by key, or a custom row on the list of documents, by id. */
export type DocumentTarget = { kind: "slot"; key: string } | { kind: "row"; id: string };

export type CaseUpload = { documentType: CaseDocumentType; meta: CaseDocumentMeta };

export type UnsavedDocument = { target: DocumentTarget; label: string; error: string };

/**
 * A saved document still to be linked to what it belongs to: a complainant's participant,
 * or a demand notice's evidence row.
 */
export type PendingLink = { target: DocumentTarget; caseDocumentId: string } & (
  | { participantId: string; evidenceId?: never }
  | { evidenceId: string; participantId?: never }
);

/** The participant a complainant is saved as on the case, if they are yet. */
export type ParticipantIdOf = (complainant: Complainant) => string | undefined;

/** The evidence row a demand notice is saved as on the case, if it is yet. */
export type EvidenceIdOf = (notice: DemandNotice) => string | undefined;

/**
 * Where to read saved ids from, for a step that has just saved them: the draft it reads
 * may not hold them yet.
 */
export type SavedIds = { participantIdOf?: ParticipantIdOf; evidenceIdOf?: EvidenceIdOf };

export type DocumentsDraft = Pick<
  FilingDraft,
  "id" | "caseId" | "intake" | "documents" | "complainants" | "cheques" | "notices"
>;

/** The documents the backend files under a complainant (its `PARTY_DOCUMENT_ROLES`). */
const PARTY_DOC_TYPES: ReadonlySet<IntakeDocType> = new Set(["id-proof", "vakalatnama", "poa"]);

/** A demand notice's papers, linked to its evidence row (the backend's `EVIDENCE_DOCUMENT_TYPES`). */
const NOTICE_PAPER_TYPES: ReadonlySet<IntakeDocType> = new Set([
  "dispatch-proof",
  "delivery-proof",
  "notice-reply",
]);

const savedAs: ParticipantIdOf = (c) => c.caseParticipantIds?.[0];
const noticeSavedAs: EvidenceIdOf = (n) => n.noticeEvidenceId;

/** A custom row's name for the step's messages, before the filer has typed one. */
const UNNAMED_ROW = "Other document";

/** One string per target, for keying in-flight work. */
export function targetId(target: DocumentTarget): string {
  return target.kind === "slot" ? `slot:${target.key}` : `row:${target.id}`;
}

export function slotTargets(slots: Array<Pick<IntakeSlot, "key">>): DocumentTarget[] {
  return slots.map((s) => ({ kind: "slot", key: s.key }));
}

/** The record behind a target, or `undefined` once it has left the draft. */
export function findSynced(draft: DocumentsDraft, target: DocumentTarget): SyncedFile | undefined {
  if (target.kind === "slot") return findIntakeSlot(draft.intake, target.key);
  const row = findDocumentRow(draft.documents, target.id);
  return row?.custom ? row : undefined;
}

/** Where a list row's file is kept: the slot it mirrors, or the row itself if custom. */
export function targetForRow(intake: Intake, row: CaseDocument): DocumentTarget | null {
  if (row.intakeKey) {
    const slot = resolveIntakeSlot(intake, row.intakeKey);
    return slot ? { kind: "slot", key: slot.key } : null;
  }
  return row.custom ? { kind: "row", id: row.id } : null;
}

/**
 * Whether a slot holds a complainant's own document, and whose. Every upload-step party is
 * a complainant, and party group `i` holds complainant `i`'s documents. `owner` is
 * `undefined` until that complainant is saved on the case.
 */
function partyDocumentOwner(
  draft: DocumentsDraft,
  slotKey: string,
  participantIdOf: ParticipantIdOf
): { owner: string | undefined } | null {
  const index = draft.intake.parties.findIndex((g) =>
    g.slots.some((s) => s.key === slotKey && PARTY_DOC_TYPES.has(s.docType))
  );
  if (index === -1) return null;
  const complainant = draft.complainants[index];
  return { owner: complainant ? participantIdOf(complainant) : undefined };
}

/**
 * Whether a slot holds a demand notice's paper, and which notice's evidence row it belongs
 * to. Notice group `i` holds notice `i`'s papers. `owner` is `undefined` until that notice
 * is saved on the case.
 */
function noticePaperOwner(
  draft: DocumentsDraft,
  slotKey: string,
  evidenceIdOf: EvidenceIdOf
): { owner: string | undefined } | null {
  const index = draft.intake.notices.findIndex((g) =>
    g.slots.some((s) => s.key === slotKey && NOTICE_PAPER_TYPES.has(s.docType))
  );
  if (index === -1) return null;
  const notice = draft.notices[index];
  return { owner: notice ? evidenceIdOf(notice) : undefined };
}

/**
 * The evidence row that should point at a slot's scan — cheque `i`'s scan and return memo,
 * notice `i`'s scan — once that row is saved. `undefined` for any other slot.
 */
export function scanEvidenceId(draft: DocumentsDraft, slotKey: string): string | undefined {
  const inGroup = (groups: IntakeGroup[]) =>
    groups.findIndex((g) => g.slots.some((s) => s.key === slotKey));
  const slot = findIntakeSlot(draft.intake, slotKey);
  if (slot?.docType === "cheque-front") {
    return draft.cheques[inGroup(draft.intake.cheques)]?.chequeEvidenceId;
  }
  if (slot?.docType === "return-memo") {
    return draft.cheques[inGroup(draft.intake.cheques)]?.returnMemoEvidenceId;
  }
  if (slot?.docType === "demand-notice") {
    return draft.notices[inGroup(draft.intake.notices)]?.noticeEvidenceId;
  }
  return undefined;
}

/**
 * The type and details a target's file is uploaded with. "Natively digital" is only sent
 * for a slot the list of documents shows, since only there can the filer answer it. A
 * complainant's own document is linked to them, and a notice paper to its notice, as it is
 * uploaded, if they are saved yet.
 */
export function caseUploadFor(
  draft: DocumentsDraft,
  target: DocumentTarget
): CaseUpload | undefined {
  if (target.kind === "slot") {
    const slot = findIntakeSlot(draft.intake, target.key);
    if (!slot) return undefined;
    const meta: CaseDocumentMeta = { isDigital: rowForSlot(draft.documents, slot.key)?.digital };
    const party = partyDocumentOwner(draft, slot.key, savedAs);
    if (party) meta.caseParticipantId = party.owner;
    const paper = noticePaperOwner(draft, slot.key, noticeSavedAs);
    if (paper) meta.caseEvidenceId = paper.owner;
    return { documentType: caseDocumentType(slot.docType), meta };
  }
  const row = findDocumentRow(draft.documents, target.id);
  if (!row?.custom) return undefined;
  return {
    documentType: "OTHER_SUPPORTING_DOCUMENT",
    meta: { isDigital: row.digital, displayName: row.name },
  };
}

/**
 * Documents saved on the case but not linked to what they belong to — uploaded before
 * their complainant or notice was saved, or that was added again under a new id. A
 * document still uploading is left to its upload.
 */
export function pendingLinks(
  draft: DocumentsDraft,
  { participantIdOf = savedAs, evidenceIdOf = noticeSavedAs }: SavedIds = {}
): PendingLink[] {
  const party = draft.intake.parties.flatMap((group) =>
    group.slots.flatMap((slot): PendingLink[] => {
      if (!slot.caseDocumentId || slot.syncing) return [];
      const owner = partyDocumentOwner(draft, slot.key, participantIdOf)?.owner;
      if (!owner || owner === slot.linkedParticipantId) return [];
      const target = { kind: "slot", key: slot.key } as const;
      return [{ target, caseDocumentId: slot.caseDocumentId, participantId: owner }];
    })
  );
  const notice = draft.intake.notices.flatMap((group) =>
    group.slots.flatMap((slot): PendingLink[] => {
      if (!slot.caseDocumentId || slot.syncing) return [];
      const owner = noticePaperOwner(draft, slot.key, evidenceIdOf)?.owner;
      if (!owner || owner === slot.linkedEvidenceId) return [];
      const target = { kind: "slot", key: slot.key } as const;
      return [{ target, caseDocumentId: slot.caseDocumentId, evidenceId: owner }];
    })
  );
  return [...party, ...notice];
}

/**
 * Everything that leaves the draft with cheque, notice or complainant `index`: the slots
 * of its upload group and, for a complainant, the custom rows on their list of documents.
 * Empty when the record would stay (the last one always does).
 */
export function caseRecordTargets(
  draft: DocumentsDraft,
  kind: CaseRecordKind,
  index: number
): DocumentTarget[] {
  const group = caseRecordGroup(draft, kind, index);
  if (!group) return [];
  const slots = slotTargets(group.slots);
  if (kind !== "party") return slots;
  const rows = (documentGroupForParty(draft.documents, group)?.docs ?? [])
    .filter((d) => d.custom)
    .map((d): DocumentTarget => ({ kind: "row", id: d.id }));
  return [...slots, ...rows];
}

function unsaved(
  entries: Array<{ target: DocumentTarget; label: string; record: SyncedFile | undefined }>
): UnsavedDocument[] {
  return entries.flatMap(({ target, label, record }) =>
    record?.file && record.syncError ? [{ target, label, error: record.syncError }] : []
  );
}

/** Files that failed to save to the case, named as the upload step names them. */
export function unsavedDocuments(draft: DocumentsDraft): UnsavedDocument[] {
  if (!draft.caseId) return [];
  const slots = intakeSlots(draft.intake).map((s) => ({
    target: { kind: "slot", key: s.key } as const,
    label: s.label,
    record: s,
  }));
  const rows = draft.documents.flatMap((g) =>
    g.docs
      .filter((d) => d.custom)
      .map((d) => ({
        target: { kind: "row", id: d.id } as const,
        label: d.name.trim() || UNNAMED_ROW,
        record: d,
      }))
  );
  return unsaved([...slots, ...rows]);
}

/**
 * Files behind these list rows that failed to save, named as the list names them — only
 * what the step shows, so its "Try again" never re-sends a file from another step.
 */
export function unsavedRows(draft: DocumentsDraft, groups: DocumentGroup[]): UnsavedDocument[] {
  if (!draft.caseId) return [];
  return unsaved(
    groups.flatMap((g) =>
      g.docs.flatMap((row) => {
        const target = targetForRow(draft.intake, row);
        if (!target) return [];
        const label = row.name.trim() || UNNAMED_ROW;
        return [{ target, label, record: findSynced(draft, target) }];
      })
    )
  );
}
