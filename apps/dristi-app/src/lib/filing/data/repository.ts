/**
 * Persistence contracts for the e-filing flow. Shared by both teams and only grow: add
 * methods, never rename or remove one that `http.ts` already implements (the type check
 * fails if you do). Each is answered by the sandbox (`./indexeddb.ts`, design) and the
 * backend (`./http.ts`, engineering), and `./index.ts` picks one; screens do not change.
 *
 *   - `FilingRepository`: what the screens keep in this browser, drafts (the whole
 *     `FilingDraft`) and uploaded files (bytes + metadata). It is the working copy of a
 *     draft while sections move to the backend case one by one; it goes once the backend
 *     holds them all. `getRepository()` picks by `NEXT_PUBLIC_DATA_SOURCE`.
 *   - `CaseFilingRepository`: the backend case behind a filing (dristi-be "Case Filing
 *     API"). The steps save to it as they close and read it back as they open.
 *     `getCaseFilingRepository()` picks by `caseFilingSource`. Its request and response
 *     shapes are the backend's own and live in `./cases-api.ts`.
 */

import type { EvidenceType } from "../evidence";
import type { FilingDraft, StoredFileRef } from "../types";
import type { ValidationResult } from "../validation";
import type {
  AddedParty,
  AddedPoaHolder,
  CaseDocumentMeta,
  CaseDocumentPatch,
  CaseDocumentType,
  CaseRead,
  EvidenceInfo,
  FoundAdvocate,
  ParticipantPatch,
  PartyInput,
  PartyRole,
  PoaHolderInput,
  SavedEvidence,
  UploadedCaseDocument,
  WitnessInput,
} from "./cases-api";

/** A stored upload: the reference the draft holds plus the bytes. */
export type StoredFile = StoredFileRef & {
  blob: Blob;
  createdAt: string;
};

export interface FilingRepository {
  /* Drafts (and filed cases — a filed case is a draft with `status: "filed"`). */
  listDrafts(): Promise<FilingDraft[]>;
  getDraft(id: string): Promise<FilingDraft | null>;
  putDraft(draft: FilingDraft): Promise<void>;
  deleteDraft(id: string): Promise<void>;

  /* Files */
  putFile(file: StoredFile): Promise<void>;
  getFile(id: string): Promise<StoredFile | null>;
  deleteFile(id: string): Promise<void>;
  /** Drop files no draft references any more (called after a draft is deleted). */
  deleteFiles(ids: string[]): Promise<void>;
}

/* ───────────────────────────────── The backend case ─────────────────────────────── */

/** An evidence row to add; a scan can be linked later. */
export type NewEvidence = {
  evidenceType: EvidenceType;
  evidenceInfo: EvidenceInfo;
  caseDocumentId?: string | null;
};

export interface CaseFilingRepository {
  /** Open a cheque bounce draft; its id is the case id for the life of the filing. */
  startDraft(): Promise<{ caseId: string }>;

  /** Attach a file to the case (creating the case, if this is its first save). */
  uploadDocument(
    caseId: string,
    file: Blob,
    fileName: string,
    documentType: CaseDocumentType,
    meta?: CaseDocumentMeta,
  ): Promise<UploadedCaseDocument>;
  /** Change a saved document's link or details; the file and its type never change. */
  updateDocument(caseDocumentId: string, patch: CaseDocumentPatch): Promise<void>;
  /** Take a document off the case. */
  deleteDocument(caseDocumentId: string): Promise<void>;

  /** Add a complainant, an accused or a witness (creating the case on its first save). */
  addParty(caseId: string, role: PartyRole, party: PartyInput | WitnessInput): Promise<AddedParty>;
  /** Change the case's copy of a party's details. */
  updateParticipant(caseParticipantId: string, patch: ParticipantPatch): Promise<void>;
  /** Take a party off the case; the rest of their role is renumbered. */
  removeParticipant(caseParticipantId: string): Promise<void>;

  /** Approved advocates whose name or Bar number contains `query`. */
  searchAdvocates(query: string, signal?: AbortSignal): Promise<FoundAdvocate[]>;
  /** Put an advocate on the case for these parties; one representation id per client. */
  addAdvocate(
    caseId: string,
    advocateId: string,
    clientParticipantIds: string[],
  ): Promise<string[]>;
  /** End a representation. */
  endRepresentation(representationId: string): Promise<void>;

  /** Put a PoA holder on the case, with one mandate per party they act for. */
  addPoaHolder(caseId: string, holder: PoaHolderInput): Promise<AddedPoaHolder>;
  /** Revoke a mandate; revoking a holder's last one takes the holder off the case too. */
  revokePoaMandate(mandateId: string): Promise<void>;

  /** Add a cheque, return memo or demand notice (creating the case on its first save). */
  addEvidence(
    caseId: string,
    input: NewEvidence,
    signal?: AbortSignal,
  ): Promise<SavedEvidence>;
  /** Change an evidence row's fields or linked document (`null` unlinks it). */
  updateEvidence(
    caseEvidenceId: string,
    patch: { evidenceInfo?: EvidenceInfo; caseDocumentId?: string | null },
    signal?: AbortSignal,
  ): Promise<SavedEvidence>;
  /** Take an evidence row off the case. */
  deleteEvidence(caseEvidenceId: string): Promise<void>;

  /** Replace one case-details section (creating the case on its first save). */
  saveDetails(
    caseId: string,
    section: string,
    data: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<void>;
  /** Replace the sworn affidavit (creating the case on its first save). */
  saveAffidavit(caseId: string, affidavit: string, signal?: AbortSignal): Promise<void>;

  /** Whether the filing is ready to sign, and every missing piece when it is not. */
  validateCase(caseId: string, signal?: AbortSignal): Promise<ValidationResult>;
  /** The parties, advocates, mandates, evidence, details and affidavit on the case. */
  getCase(caseId: string): Promise<CaseRead>;
}
