/**
 * The case-filing seam against the DRISTI backend (dristi-be "Case Filing API").
 *
 *   startDraft        POST   /cases                       { case_type }  → draft_session_id
 *   uploadDocument    POST   /cases/{id}/documents        multipart: file, document_type
 *   deleteDocument    DELETE /case-documents/{case_document_id}
 *   addEvidence       POST   /cases/{id}/evidence         { evidence_type, evidence_info, case_document_id? }
 *   updateEvidence    PATCH  /case-evidence/{case_evidence_id}
 *   deleteEvidence    DELETE /case-evidence/{case_evidence_id}
 *   saveDetails       PUT    /cases/{id}/details/{section} (whole section, replaces)
 *   saveAffidavit     PUT    /cases/{id}/affidavit        { affidavit } (replaces)
 *
 * The backend creates the case lazily, on the first save, and gives it the draft
 * session's id — so the id `startDraft` returns is the case id for the life of the
 * filing, and the local draft is stored under it.
 *
 * The documents, evidence and case-details steps talk to the backend; the remaining
 * sections of the draft are still kept in this browser (see ../README.md). The body shapes
 * are built from the draft in `../evidence.ts` (evidence) and `../details.ts` (sections).
 */

import { api, isApiError, type ApiClient } from "@/lib/api";

import type { EvidenceType } from "../evidence";
import type { IntakeDocType } from "../types";

/** Registered case-filing error codes this file branches on (spec §7). */
const E_CASE_SUBMITTED = "E07001";
const E_TYPE_NOT_ACCEPTED = "E07002";

/** Scans can be large and connections slow; the proxy allows 60 s per hop. */
const UPLOAD_TIMEOUT_MS = 60_000;

export type CaseDocumentType =
  | "BOUNCED_CHEQUE"
  | "RETURN_MEMO"
  | "LEGAL_DEMAND_NOTICE"
  | "PROOF_OF_DISPATCH"
  | "PROOF_OF_DELIVERY_OF_DEMAND_NOTICE"
  | "REPLY_TO_DEMAND_NOTICE"
  | "PROOF_OF_DEBT"
  | "AFFIDAVIT"
  | "VAKALATNAMA"
  | "POA_DOCUMENT"
  | "OTHER_SUPPORTING_DOCUMENT";

/**
 * The backend type for each upload slot. `null` = the backend has no type for it yet
 * (identity proof; loan agreement / invoice / ledger), so the file stays in this browser.
 */
const DOCUMENT_TYPE: Record<IntakeDocType, CaseDocumentType | null> = {
  "cheque-front": "BOUNCED_CHEQUE",
  "return-memo": "RETURN_MEMO",
  "demand-notice": "LEGAL_DEMAND_NOTICE",
  "dispatch-proof": "PROOF_OF_DISPATCH",
  "delivery-proof": "PROOF_OF_DELIVERY_OF_DEMAND_NOTICE",
  "notice-reply": "REPLY_TO_DEMAND_NOTICE",
  "id-proof": null,
  poa: "POA_DOCUMENT",
  vakalatnama: "VAKALATNAMA",
  other: "OTHER_SUPPORTING_DOCUMENT",
  supporting: null,
};

export function caseDocumentType(docType: IntakeDocType): CaseDocumentType | null {
  return DOCUMENT_TYPE[docType];
}

export type UploadedCaseDocument = {
  caseId: string;
  caseDocumentId: string;
  documentType: string;
};

/** An `evidence_info` body; its keys and value types are the backend's per-type schema. */
export type EvidenceInfo = Record<string, string | number | boolean>;

export type SavedEvidence = {
  caseEvidenceId: string;
  evidenceType: string;
  /** The row's place within its evidence type, 1-based (cheque #1, return memo #1, …). */
  ordinal: number;
};

type DraftSessionBody = { draft_session_id?: unknown };
type CaseDocumentBody = { case_id?: unknown; case_document_id?: unknown; document_type?: unknown };
type CaseEvidenceBody = { case_evidence_id?: unknown; evidence_type?: unknown; ordinal?: unknown };

function unexpected(what: string): Error {
  return new Error(`Unexpected ${what} response from the case service.`);
}

function toSavedEvidence(body: CaseEvidenceBody | null): SavedEvidence {
  if (!body || typeof body.case_evidence_id !== "string") throw unexpected("evidence");
  return {
    caseEvidenceId: body.case_evidence_id,
    evidenceType: typeof body.evidence_type === "string" ? body.evidence_type : "",
    ordinal: typeof body.ordinal === "number" ? body.ordinal : 0,
  };
}

/**
 * What to tell the person when a case-filing call fails. Registered codes first, then
 * the status, then the backend's own message.
 */
export function caseFilingErrorMessage(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Please try again.";
  if (error.kind === "network" || error.kind === "timeout") {
    return "We couldn't reach the court's server. Check your connection and try again.";
  }
  if (error.kind !== "http") return "Something went wrong. Please try again.";
  if (error.hasCode(E_CASE_SUBMITTED)) {
    return "This case has been submitted, so it can no longer be changed.";
  }
  if (error.hasCode(E_TYPE_NOT_ACCEPTED)) {
    return "The court doesn't accept this kind of document for this case.";
  }
  if (error.status === 401 || error.status === 403) {
    return "Your session has ended. Sign in again to keep saving this filing.";
  }
  if (error.status === 404) {
    return "This draft is no longer on the court's server. Start a new filing to save your documents.";
  }
  if (error.status === 413) return "This file is too large. Upload a file of up to 10 MB.";
  return error.fieldError("file") ?? error.message;
}

export function createCaseFilingApi(client: ApiClient = api) {
  return {
    /** Open a cheque bounce draft. Nothing is stored on the server until the first save. */
    async startDraft(): Promise<{ caseId: string }> {
      const body = await client.post<DraftSessionBody>("cases", { case_type: "CHEQUE_BOUNCE" });
      if (typeof body?.draft_session_id !== "string") throw unexpected("draft");
      return { caseId: body.draft_session_id };
    },

    /** Attach a file to the case (creating the case, if this is its first save). */
    async uploadDocument(
      caseId: string,
      file: Blob,
      fileName: string,
      documentType: CaseDocumentType,
      signal?: AbortSignal
    ): Promise<UploadedCaseDocument> {
      const form = new FormData();
      form.append("file", file, fileName);
      form.append("document_type", documentType);
      const body = await client.post<CaseDocumentBody>(
        `cases/${encodeURIComponent(caseId)}/documents`,
        form,
        { timeoutMs: UPLOAD_TIMEOUT_MS, signal }
      );
      if (typeof body?.case_id !== "string" || typeof body.case_document_id !== "string") {
        throw unexpected("document");
      }
      return {
        caseId: body.case_id,
        caseDocumentId: body.case_document_id,
        documentType: typeof body.document_type === "string" ? body.document_type : documentType,
      };
    },

    /** Remove a document from the case. The stored file itself is kept by the backend. */
    async deleteDocument(caseDocumentId: string): Promise<void> {
      await client.delete(`case-documents/${encodeURIComponent(caseDocumentId)}`);
    },

    /**
     * Add a cheque, return memo or demand notice to the case (creating the case on the
     * first save). The ordinal is assigned by the backend, one per evidence type.
     */
    async addEvidence(
      caseId: string,
      input: { evidenceType: EvidenceType; evidenceInfo: EvidenceInfo; caseDocumentId?: string | null },
      signal?: AbortSignal
    ): Promise<SavedEvidence> {
      const body: Record<string, unknown> = {
        evidence_type: input.evidenceType,
        evidence_info: input.evidenceInfo,
      };
      // Left out when there is no linked document yet; a scan can be attached later.
      if (input.caseDocumentId != null) body.case_document_id = input.caseDocumentId;
      return toSavedEvidence(
        await client.post<CaseEvidenceBody>(`cases/${encodeURIComponent(caseId)}/evidence`, body, { signal })
      );
    },

    /**
     * Change an evidence row's fields, its linked document, or both. Pass `caseDocumentId:
     * null` to unlink a document; leave it out to keep the current link.
     */
    async updateEvidence(
      caseEvidenceId: string,
      patch: { evidenceInfo?: EvidenceInfo; caseDocumentId?: string | null },
      signal?: AbortSignal
    ): Promise<SavedEvidence> {
      const body: Record<string, unknown> = {};
      if (patch.evidenceInfo !== undefined) body.evidence_info = patch.evidenceInfo;
      if (patch.caseDocumentId !== undefined) body.case_document_id = patch.caseDocumentId;
      return toSavedEvidence(
        await client.patch<CaseEvidenceBody>(
          `case-evidence/${encodeURIComponent(caseEvidenceId)}`,
          body,
          { signal }
        )
      );
    },

    /** Remove an evidence row from the case. */
    async deleteEvidence(caseEvidenceId: string): Promise<void> {
      await client.delete(`case-evidence/${encodeURIComponent(caseEvidenceId)}`);
    },

    /**
     * Replace a case-details section (jurisdiction_limitation, adr_other_prayer), creating
     * the case on the first save. The whole section object is sent; it replaces what was
     * stored, so re-saving is idempotent.
     */
    async saveDetails(
      caseId: string,
      section: string,
      data: Record<string, unknown>,
      signal?: AbortSignal
    ): Promise<void> {
      await client.put(
        `cases/${encodeURIComponent(caseId)}/details/${encodeURIComponent(section)}`,
        data,
        { signal }
      );
    },

    /**
     * Replace the case's sworn affidavit (its own endpoint, spec 0021 §5.4), creating the
     * case on the first save. A blank affidavit is refused by the backend.
     */
    async saveAffidavit(caseId: string, affidavit: string, signal?: AbortSignal): Promise<void> {
      await client.put(`cases/${encodeURIComponent(caseId)}/affidavit`, { affidavit }, { signal });
    },
  };
}

export const caseFilingApi = createCaseFilingApi();
