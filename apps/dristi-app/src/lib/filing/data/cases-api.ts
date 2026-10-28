/**
 * The case-filing seam against the DRISTI backend (dristi-be "Case Filing API").
 *
 *   startDraft        POST   /cases                       { case_type }  → draft_session_id
 *   uploadDocument    POST   /cases/{id}/documents        multipart: file, document_type
 *   deleteDocument    DELETE /case-documents/{case_document_id}
 *
 * The backend creates the case lazily, on the first save, and gives it the draft
 * session's id — so the id `startDraft` returns is the case id for the life of the
 * filing, and the local draft is stored under it.
 *
 * Only the documents step talks to the backend so far; everything else on the draft is
 * still kept in this browser (see ../README.md).
 */

import { api, isApiError, type ApiClient } from "@/lib/api";

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

type DraftSessionBody = { draft_session_id?: unknown };
type CaseDocumentBody = { case_id?: unknown; case_document_id?: unknown; document_type?: unknown };

function unexpected(what: string): Error {
  return new Error(`Unexpected ${what} response from the case service.`);
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
  };
}

export const caseFilingApi = createCaseFilingApi();
