/**
 * Contract for the backend case behind a filing (dristi-be "Case Filing API").
 *
 * The documents, complainant, advocate, accused, witness, cheque, demand notice, details and
 * affidavit steps save here as they close, and read the case back as they open. Two
 * implementations answer it: the backend (`createCaseFilingApi` in `./http.ts`,
 * engineering) and the sandbox (`./cases-sandbox.ts`, kept in IndexedDB by `./indexeddb.ts`,
 * design). `getCaseFilingRepository()` in `./index.ts` picks one; screens and hooks never
 * know which.
 *
 * Shared by both teams and only grows: add methods, never rename or remove one. The request
 * and response shapes are the backend's own and live in `./cases-api.ts`.
 */

import type { ValidationResult } from "../validation";
import type { EvidenceType } from "../evidence";
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
