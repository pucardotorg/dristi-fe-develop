/**
 * The case-filing seam against the DRISTI backend (dristi-be "Case Filing API").
 *
 *   startDraft          POST   /cases                       { case_type }  → draft_session_id
 *   uploadDocument      POST   /cases/{id}/documents        multipart: file, document_type
 *   deleteDocument      DELETE /case-documents/{case_document_id}
 *   addParty            POST   /cases/{id}/complainants | /accused | /witnesses
 *   updateParticipant   PATCH  /case-participants/{case_participant_id}
 *   removeParticipant   DELETE /case-participants/{case_participant_id}
 *   searchAdvocates     GET    /advocates?search=           → approved advocates, with their id
 *   addAdvocate         POST   /cases/{id}/advocates        { advocate_id, client_participant_ids }
 *   endRepresentation   DELETE /representations/{representation_id}
 *
 * The backend creates the case lazily, on the first save, and gives it the draft
 * session's id — so the id `startDraft` returns is the case id for the life of the
 * filing, and the local draft is stored under it.
 *
 * The documents, complainant, advocate, accused and witness steps save to the backend;
 * everything else on the draft is still kept in this browser (see ../README.md).
 */

import { api, isApiError, type ApiClient, type Page } from "@/lib/api";

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

/* Party bodies, as the backend reads them (dristi-be `cases/serializers.py`). */

export type AddressInput = {
  line1: string;
  city: string;
  pincode: string;
  district: string;
  state: string;
  /** Required on an accused's or a witness's address; optional on a complainant's. */
  police_station?: string;
};

export type PersonInput = {
  name: string;
  phone_number?: string;
  email_address?: string;
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  disability_status?: boolean;
};

export type InstitutionInput = {
  entity_type?: string;
  entity_name: string;
  pan?: string;
  cin?: string;
  contact_number?: string;
  email_address?: string;
};

/** A complainant or an accused: a person, an institution, or a person for an institution. */
export type PartyInput = {
  /**
   * The filer themselves: the backend uses their own person, linked to their account and
   * `VERIFIED`, and refuses `person` alongside it. Only for a complainant.
   */
  self?: true;
  person?: PersonInput;
  institution?: InstitutionInput;
  /** The person's capacity for the institution; only with both. */
  designation?: string;
  address: Partial<AddressInput>;
  is_party_in_person: boolean;
  /** Accused only: does the accused reside within this court's jurisdiction. */
  resides_within_jurisdiction?: boolean;
  additional_details: Record<string, unknown>;
};

/**
 * A PoA holder: always a person (or the filer, as `self`), with a full address. One
 * mandate is granted for each party in `represented_participant_ids`.
 */
export type PoaHolderInput = {
  self?: true;
  person?: PersonInput;
  address: Partial<AddressInput>;
  represented_participant_ids: string[];
  additional_details: Record<string, unknown>;
};

/** A PoA holder on the case, and the mandates they were granted. */
export type AddedPoaHolder = { participantId: string; mandateIds: string[] };

/** Whose witness: the side that calls them. */
export type WitnessSide = "COMPLAINANT" | "ACCUSED";

/** A witness: always a person. The address is optional, but needs a police station. */
export type WitnessInput = {
  person: PersonInput;
  /** Their job title ("Branch manager"), kept on the case's copy. */
  designation?: string;
  address?: Partial<AddressInput>;
  side: WitnessSide;
  what_will_witness_prove?: string;
  additional_details: Record<string, unknown>;
};

export type PartyRole = "complainants" | "accused" | "witnesses";

/** What PATCH may change: the case's copy of the details, never who the party is. */
export type ParticipantPatch = {
  name_at_filing: string;
  phone_number_at_filing: string | null;
  gender_at_filing: PersonInput["gender"] | null;
  age_at_filing: number | null;
  designation_at_filing?: string | null;
  address?: Partial<AddressInput>;
  /** Complainants and accused only. */
  is_party_in_person?: boolean;
  /** Accused only. */
  resides_within_jurisdiction?: boolean;
  additional_details: Record<string, unknown>;
  /** Witnesses only. */
  side?: WitnessSide;
  what_will_witness_prove?: string;
};

/** The backend refuses a shorter search, so it cannot list every advocate. */
export const ADVOCATE_SEARCH_MIN_LENGTH = 2;

/** An approved advocate, as the search returns them. `id` is what a case is given. */
export type FoundAdvocate = { id: string; name: string; barNumber: string };

type DraftSessionBody = { draft_session_id?: unknown };
type CaseDocumentBody = { case_id?: unknown; case_document_id?: unknown; document_type?: unknown };
type ParticipantBody = { case_participant_id?: unknown };
type AdvocateCreatedBody = { representation_ids?: unknown };
type PoaHolderCreatedBody = { case_participant_id?: unknown; poa_mandate_ids?: unknown };
type AdvocateSearchRow = { id?: unknown; name?: unknown; bar_registration_id?: unknown };

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
    return "This draft is no longer on the court's server. Start a new filing to save it.";
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

    /** Add a complainant, an accused or a witness (creating the case on its first save). */
    async addParty(
      caseId: string,
      role: PartyRole,
      party: PartyInput | WitnessInput
    ): Promise<string> {
      const body = await client.post<ParticipantBody>(
        `cases/${encodeURIComponent(caseId)}/${role}`,
        party
      );
      if (typeof body?.case_participant_id !== "string") throw unexpected("participant");
      return body.case_participant_id;
    },

    async updateParticipant(caseParticipantId: string, patch: ParticipantPatch): Promise<void> {
      await client.patch(`case-participants/${encodeURIComponent(caseParticipantId)}`, patch);
    },

    /** Remove a party; the backend renumbers the rest of the role. */
    async removeParticipant(caseParticipantId: string): Promise<void> {
      await client.delete(`case-participants/${encodeURIComponent(caseParticipantId)}`);
    },

    /**
     * Approved advocates whose name or bar number contains `query`. The backend refuses
     * fewer than `ADVOCATE_SEARCH_MIN_LENGTH` characters, so a shorter query is not sent.
     */
    async searchAdvocates(query: string, signal?: AbortSignal): Promise<FoundAdvocate[]> {
      const q = query.trim();
      if (q.length < ADVOCATE_SEARCH_MIN_LENGTH) return [];
      const body = await client.get<Page<AdvocateSearchRow>>(
        `advocates?search=${encodeURIComponent(q)}`,
        { signal }
      );
      if (!Array.isArray(body?.results)) throw unexpected("advocate search");
      return body.results.flatMap((r) =>
        typeof r?.id === "string"
          ? [{ id: r.id, name: String(r.name ?? ""), barNumber: String(r.bar_registration_id ?? "") }]
          : []
      );
    },

    /** Put an advocate on the case for these parties: one representation per client. */
    async addAdvocate(
      caseId: string,
      advocateId: string,
      clientParticipantIds: string[]
    ): Promise<string[]> {
      const body = await client.post<AdvocateCreatedBody>(
        `cases/${encodeURIComponent(caseId)}/advocates`,
        { advocate_id: advocateId, client_participant_ids: clientParticipantIds }
      );
      const ids = body?.representation_ids;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
        throw unexpected("advocate");
      }
      return ids;
    },

    /** End a representation. The backend keeps the row as the record of who acted when. */
    async endRepresentation(representationId: string): Promise<void> {
      await client.delete(`representations/${encodeURIComponent(representationId)}`);
    },

    /** Put a PoA holder on the case, with one mandate per party they act for. */
    async addPoaHolder(caseId: string, holder: PoaHolderInput): Promise<AddedPoaHolder> {
      const body = await client.post<PoaHolderCreatedBody>(
        `cases/${encodeURIComponent(caseId)}/poa-holders`,
        holder
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
  };
}

export type CaseFilingApi = ReturnType<typeof createCaseFilingApi>;

export const caseFilingApi = createCaseFilingApi();
