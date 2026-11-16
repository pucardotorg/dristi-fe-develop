/**
 * Filing against the DRISTI backend. Engineering owns this file.
 *
 * Two contracts, each implemented one method at a time as the backend's endpoints arrive,
 * through `@/lib/api`, translating backend shapes here so backend naming never reaches a
 * screen. Until a method exists, calling it rejects with `NotIntegratedError`.
 *
 *   - `HttpFilingRepository` (`FilingRepository`): drafts and file bytes. No endpoints yet,
 *     none guessed: the browser keeps the working copy of a draft (`./indexeddb.ts`).
 *   - `createCaseFilingApi` (`CaseFilingRepository`): the backend case each step saves to.
 *
 *   startDraft          POST   /cases                       { case_type }  → draft_session_id
 *   uploadDocument      POST   /cases/{id}/documents        multipart: file, document_type,
 *                                                            is_digital?, display_name?,
 *                                                            case_participant_id?,
 *                                                            case_evidence_id?
 *   updateDocument      PATCH  /case-documents/{case_document_id}  link and details
 *   deleteDocument      DELETE /case-documents/{case_document_id}
 *   addParty            POST   /cases/{id}/complainants | /accused | /witnesses
 *   updateParticipant   PATCH  /case-participants/{case_participant_id}
 *   removeParticipant   DELETE /case-participants/{case_participant_id}
 *   searchAdvocates     GET    /advocates?search=           → approved advocates, with their id
 *   addAdvocate         POST   /cases/{id}/advocates        { advocate_id, client_participant_ids }
 *   endRepresentation   DELETE /representations/{representation_id}
 *   addPoaHolder        POST   /cases/{id}/poa-holders
 *   revokePoaMandate    DELETE /poa-mandates/{poa_mandate_id}
 *   addEvidence         POST   /cases/{id}/evidence
 *   updateEvidence      PATCH  /case-evidence/{case_evidence_id}
 *   deleteEvidence      DELETE /case-evidence/{case_evidence_id}
 *   saveDetails         PUT    /cases/{id}/details/{section}
 *   saveAffidavit       PUT    /cases/{id}/affidavit
 *   validateCase        POST   /cases/{id}/validate
 *   getCase             GET    /cases/{id}                  → participants, representations,
 *                                                            poa_mandates, evidence, details,
 *                                                            affidavit
 *
 * Bulk filing (`lib/bulk/*-repository.ts`) is a sandbox-only demo with its own browser and
 * demo-server storage, and is not switched.
 */

import { api, type ApiClient, type Page } from "@/lib/api";

import type { EvidenceType } from "../evidence";
import type { ValidationError, ValidationResult } from "../validation";
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
import { ADVOCATE_SEARCH_MIN_LENGTH } from "./cases-api";
import type { CaseFilingRepository, FilingRepository } from "./repository";

export class HttpFilingRepository implements Partial<FilingRepository> {}

/* ───────────────────────────────── The backend case ─────────────────────────────── */

/** Scans can be large and connections slow; the proxy allows 60 s per hop. */
const UPLOAD_TIMEOUT_MS = 60_000;

type DraftSessionBody = { draft_session_id?: unknown };
type CaseDocumentBody = { case_id?: unknown; case_document_id?: unknown; document_type?: unknown };
type ParticipantBody = { case_participant_id?: unknown; institution_id?: unknown };
type AdvocateCreatedBody = { representation_ids?: unknown };
type PoaHolderCreatedBody = {
  case_participant_id?: unknown;
  poa_mandate_ids?: unknown;
};
type AdvocateSearchRow = {
  id?: unknown;
  name?: unknown;
  bar_registration_id?: unknown;
};

function unexpected(what: string): Error {
  return new Error(`Unexpected ${what} response from the case service.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The details sections saved on a case, leaving out anything that is not a section object. */
function detailSections(value: unknown): Record<string, Record<string, unknown>> {
  if (!isRecord(value)) return {};
  const sections: Record<string, Record<string, unknown>> = {};
  for (const [name, data] of Object.entries(value)) if (isRecord(data)) sections[name] = data;
  return sections;
}

type CaseEvidenceBody = { case_evidence_id?: unknown; evidence_type?: unknown; ordinal?: unknown };

function toSavedEvidence(body: CaseEvidenceBody | null): SavedEvidence {
  if (!body || typeof body.case_evidence_id !== "string") throw unexpected("evidence");
  return {
    caseEvidenceId: body.case_evidence_id,
    evidenceType: typeof body.evidence_type === "string" ? body.evidence_type : "",
    ordinal: typeof body.ordinal === "number" ? body.ordinal : 0,
  };
}

export function createCaseFilingApi(client: ApiClient = api): CaseFilingRepository {
  return {
    /** Open a cheque bounce draft. Nothing is stored on the server until the first save. */
    async startDraft(): Promise<{ caseId: string }> {
      const body = await client.post<DraftSessionBody>("cases", {
        case_type: "CHEQUE_BOUNCE",
      });
      if (typeof body?.draft_session_id !== "string") throw unexpected("draft");
      return { caseId: body.draft_session_id };
    },

    /** Attach a file to the case (creating the case, if this is its first save). */
    async uploadDocument(
      caseId: string,
      file: Blob,
      fileName: string,
      documentType: CaseDocumentType,
      meta: CaseDocumentMeta = {},
    ): Promise<UploadedCaseDocument> {
      const form = new FormData();
      form.append("file", file, fileName);
      form.append("document_type", documentType);
      if (meta.isDigital !== undefined)
        form.append("is_digital", String(meta.isDigital));
      const displayName = meta.displayName?.trim();
      if (displayName) form.append("display_name", displayName);
      if (meta.caseParticipantId)
        form.append("case_participant_id", meta.caseParticipantId);
      if (meta.caseEvidenceId) form.append("case_evidence_id", meta.caseEvidenceId);
      const body = await client.post<CaseDocumentBody>(
        `cases/${encodeURIComponent(caseId)}/documents`,
        form,
        { timeoutMs: UPLOAD_TIMEOUT_MS },
      );
      if (
        typeof body?.case_id !== "string" ||
        typeof body.case_document_id !== "string"
      ) {
        throw unexpected("document");
      }
      return {
        caseId: body.case_id,
        caseDocumentId: body.case_document_id,
        documentType:
          typeof body.document_type === "string"
            ? body.document_type
            : documentType,
      };
    },

    /**
     * Change a saved document's link or details. The file and its type cannot change, so
     * this is how a document uploaded before its complainant was saved is linked to them.
     */
    async updateDocument(
      caseDocumentId: string,
      patch: CaseDocumentPatch,
    ): Promise<void> {
      await client.patch(
        `case-documents/${encodeURIComponent(caseDocumentId)}`,
        patch,
      );
    },

    /** Remove a document from the case. The stored file itself is kept by the backend. */
    async deleteDocument(caseDocumentId: string): Promise<void> {
      await client.delete(
        `case-documents/${encodeURIComponent(caseDocumentId)}`,
      );
    },

    /** Add a complainant, an accused or a witness (creating the case on its first save). */
    async addParty(
      caseId: string,
      role: PartyRole,
      party: PartyInput | WitnessInput
    ): Promise<AddedParty> {
      const body = await client.post<ParticipantBody>(
        `cases/${encodeURIComponent(caseId)}/${role}`,
        party,
      );
      if (typeof body?.case_participant_id !== "string") throw unexpected("participant");
      return {
        participantId: body.case_participant_id,
        institutionId: typeof body.institution_id === "string" ? body.institution_id : null,
      };
    },

    async updateParticipant(
      caseParticipantId: string,
      patch: ParticipantPatch,
    ): Promise<void> {
      await client.patch(
        `case-participants/${encodeURIComponent(caseParticipantId)}`,
        patch,
      );
    },

    /** Remove a party; the backend renumbers the rest of the role. */
    async removeParticipant(caseParticipantId: string): Promise<void> {
      await client.delete(
        `case-participants/${encodeURIComponent(caseParticipantId)}`,
      );
    },

    /**
     * Approved advocates whose name or bar number contains `query`. The backend refuses
     * fewer than `ADVOCATE_SEARCH_MIN_LENGTH` characters, so a shorter query is not sent.
     */
    async searchAdvocates(
      query: string,
      signal?: AbortSignal,
    ): Promise<FoundAdvocate[]> {
      const q = query.trim();
      if (q.length < ADVOCATE_SEARCH_MIN_LENGTH) return [];
      const body = await client.get<Page<AdvocateSearchRow>>(
        `advocates?search=${encodeURIComponent(q)}`,
        { signal },
      );
      if (!Array.isArray(body?.results)) throw unexpected("advocate search");
      return body.results.flatMap((r) =>
        typeof r?.id === "string"
          ? [
              {
                id: r.id,
                name: String(r.name ?? ""),
                barNumber: String(r.bar_registration_id ?? ""),
              },
            ]
          : [],
      );
    },

    /** Put an advocate on the case for these parties: one representation per client. */
    async addAdvocate(
      caseId: string,
      advocateId: string,
      clientParticipantIds: string[],
    ): Promise<string[]> {
      const body = await client.post<AdvocateCreatedBody>(
        `cases/${encodeURIComponent(caseId)}/advocates`,
        {
          advocate_id: advocateId,
          client_participant_ids: clientParticipantIds,
        },
      );
      const ids = body?.representation_ids;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
        throw unexpected("advocate");
      }
      return ids;
    },

    /** End a representation. The backend keeps the row as the record of who acted when. */
    async endRepresentation(representationId: string): Promise<void> {
      await client.delete(
        `representations/${encodeURIComponent(representationId)}`,
      );
    },

    /** Put a PoA holder on the case, with one mandate per party they act for. */
    async addPoaHolder(
      caseId: string,
      holder: PoaHolderInput,
    ): Promise<AddedPoaHolder> {
      const body = await client.post<PoaHolderCreatedBody>(
        `cases/${encodeURIComponent(caseId)}/poa-holders`,
        holder,
      );
      const ids = body?.poa_mandate_ids;
      if (
        typeof body?.case_participant_id !== "string" ||
        !Array.isArray(ids) ||
        !ids.every((id) => typeof id === "string")
      ) {
        throw unexpected("PoA holder");
      }
      return { participantId: body.case_participant_id, mandateIds: ids };
    },

    /** Revoke a mandate. Revoking a holder's last one takes the holder off the case too. */
    async revokePoaMandate(mandateId: string): Promise<void> {
      await client.delete(`poa-mandates/${encodeURIComponent(mandateId)}`);
    },

    /**
     * Add a cheque, return memo or demand notice to the case (creating the case on the
     * first save). The ordinal is assigned by the backend, one per evidence type.
     */
    async addEvidence(
      caseId: string,
      input: { evidenceType: EvidenceType; evidenceInfo: EvidenceInfo; caseDocumentId?: string | null },
      signal?: AbortSignal,
    ): Promise<SavedEvidence> {
      const body: Record<string, unknown> = {
        evidence_type: input.evidenceType,
        evidence_info: input.evidenceInfo,
      };
      // Left out when there is no linked document yet; a scan can be attached later.
      if (input.caseDocumentId != null) body.case_document_id = input.caseDocumentId;
      return toSavedEvidence(
        await client.post<CaseEvidenceBody>(`cases/${encodeURIComponent(caseId)}/evidence`, body, { signal }),
      );
    },

    /**
     * Change an evidence row's fields, its linked document, or both. Pass `caseDocumentId:
     * null` to unlink a document; leave it out to keep the current link.
     */
    async updateEvidence(
      caseEvidenceId: string,
      patch: { evidenceInfo?: EvidenceInfo; caseDocumentId?: string | null },
      signal?: AbortSignal,
    ): Promise<SavedEvidence> {
      const body: Record<string, unknown> = {};
      if (patch.evidenceInfo !== undefined) body.evidence_info = patch.evidenceInfo;
      if (patch.caseDocumentId !== undefined) body.case_document_id = patch.caseDocumentId;
      return toSavedEvidence(
        await client.patch<CaseEvidenceBody>(
          `case-evidence/${encodeURIComponent(caseEvidenceId)}`,
          body,
          { signal },
        ),
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
      signal?: AbortSignal,
    ): Promise<void> {
      await client.put(
        `cases/${encodeURIComponent(caseId)}/details/${encodeURIComponent(section)}`,
        data,
        { signal },
      );
    },

    /**
     * Replace the case's sworn affidavit (its own endpoint, spec 0021 §5.4), creating the
     * case on the first save. A blank affidavit is refused by the backend.
     */
    async saveAffidavit(caseId: string, affidavit: string, signal?: AbortSignal): Promise<void> {
      await client.put(`cases/${encodeURIComponent(caseId)}/affidavit`, { affidavit }, { signal });
    },

    /**
     * Run the completeness check (spec 0021 §6.3). Returns whether the filing is ready to
     * sign and, when it is not, every missing piece with the field it is reported against.
     */
    async validateCase(caseId: string, signal?: AbortSignal): Promise<ValidationResult> {
      const body = await client.post<{ is_valid?: unknown; errors?: unknown }>(
        `cases/${encodeURIComponent(caseId)}/validate`,
        undefined,
        { signal },
      );
      const errors: ValidationError[] = Array.isArray(body?.errors)
        ? body.errors.flatMap((e) =>
            e && typeof e === "object" &&
            typeof (e as ValidationError).field === "string" &&
            typeof (e as ValidationError).message === "string"
              ? [{ field: (e as ValidationError).field, message: (e as ValidationError).message }]
              : [],
          )
        : [];
      return { isValid: body?.is_valid === true, errors };
    },

    /** The parties, advocates and PoA mandates on the case, as the backend holds them. */
    async getCase(caseId: string): Promise<CaseRead> {
      const body = await client.get<Partial<CaseRead>>(`cases/${encodeURIComponent(caseId)}`);
      if (
        !Array.isArray(body?.participants) ||
        !Array.isArray(body.representations) ||
        !Array.isArray(body.poa_mandates)
      ) {
        throw unexpected("case");
      }
      return {
        participants: body.participants,
        representations: body.representations,
        poa_mandates: body.poa_mandates,
        // Read leniently: a missing list is nothing saved, not a broken case.
        evidence: Array.isArray(body.evidence) ? body.evidence : [],
        details: detailSections(body.details),
        affidavit: typeof body.affidavit === "string" ? body.affidavit : null,
      };
    },
  };
}
