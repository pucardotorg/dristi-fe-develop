/**
 * The case-filing seam against the DRISTI backend (dristi-be "Case Filing API").
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
 *   getCase             GET    /cases/{id}                  → participants, representations,
 *                                                            poa_mandates
 *
 * The backend creates the case lazily, on the first save, and gives it the draft
 * session's id — so the id `startDraft` returns is the case id for the life of the
 * filing, and the local draft is stored under it.
 *
 * The documents, complainant, advocate, accused and witness steps save to the backend;
 * everything else on the draft is still kept in this browser (see ../README.md).
 */

import { api, isApiError, type ApiClient, type Page } from "@/lib/api";

import { caseFilingCopy as copy } from "../content";
import type { EvidenceType } from "../evidence";
import type { IntakeDocType } from "../types";
import type { ValidationError, ValidationResult } from "../validation";
import { partyFieldMessage } from "./party-field-errors";

/** Registered case-filing error codes this file branches on (spec §7). */
const E_CASE_SUBMITTED = "E07001";
const E_TYPE_NOT_ACCEPTED = "E07002";
/** The person is already a witness for this side (was E07017). */
const E_WITNESS_EXISTS = "E07032";
/** A notice paper linked to evidence that is not a demand notice. */
const E_NOT_A_NOTICE = "E07029";
/** A scan sent with `case_evidence_id`: it is linked from its evidence row instead. */
const E_EVIDENCE_LINK_NOT_ALLOWED = "E07030";
/** No active evidence with that id on the case — wrong id, or the evidence was removed. */
const E_EVIDENCE_NOT_ON_CASE = "E07031";

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
  | "OTHER_SUPPORTING_DOCUMENT"
  | "IDENTITY_PROOF"
  | "PROOF_OF_TRANSACTION";

/**
 * The backend type for each upload slot. The type says what a document is, not which
 * cheque or party it is for — every cheque's scan is a `BOUNCED_CHEQUE`.
 */
const DOCUMENT_TYPE: Record<IntakeDocType, CaseDocumentType> = {
  "cheque-front": "BOUNCED_CHEQUE",
  "return-memo": "RETURN_MEMO",
  "demand-notice": "LEGAL_DEMAND_NOTICE",
  "dispatch-proof": "PROOF_OF_DISPATCH",
  "delivery-proof": "PROOF_OF_DELIVERY_OF_DEMAND_NOTICE",
  "notice-reply": "REPLY_TO_DEMAND_NOTICE",
  "id-proof": "IDENTITY_PROOF",
  poa: "POA_DOCUMENT",
  vakalatnama: "VAKALATNAMA",
  other: "OTHER_SUPPORTING_DOCUMENT",
  supporting: "PROOF_OF_TRANSACTION",
};

export function caseDocumentType(docType: IntakeDocType): CaseDocumentType {
  return DOCUMENT_TYPE[docType];
}

/** What the backend keeps beside an uploaded file, and whose it is. */
export type CaseDocumentMeta = {
  /** The filer said the file is an original digital file, not a scan. */
  isDigital?: boolean;
  /** The filer's own name for the document — a custom row's typed name. */
  displayName?: string;
  /**
   * The participant the document belongs to: a complainant's identity proof,
   * vakalatnama or PoA document.
   */
  caseParticipantId?: string;
  /**
   * The demand notice's evidence row a notice paper belongs to: its proof of dispatch,
   * proof of delivery or reply. A scan (cheque, return memo, notice) never takes this —
   * its evidence row links to it instead (`updateEvidence`).
   */
  caseEvidenceId?: string;
};

/** A change to a saved document. A field left out is kept; `null` removes it. */
export type CaseDocumentPatch = {
  case_participant_id?: string | null;
  case_evidence_id?: string | null;
  is_digital?: boolean | null;
  display_name?: string | null;
};

/** The patch that brings a saved document's details and link to `meta`. */
export function documentPatch(meta: CaseDocumentMeta): CaseDocumentPatch {
  const patch: CaseDocumentPatch = {};
  if ("isDigital" in meta) patch.is_digital = meta.isDigital ?? null;
  if ("displayName" in meta)
    patch.display_name = meta.displayName?.trim() || null;
  if ("caseParticipantId" in meta)
    patch.case_participant_id = meta.caseParticipantId ?? null;
  if ("caseEvidenceId" in meta) patch.case_evidence_id = meta.caseEvidenceId ?? null;
  return patch;
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
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  disability_status?: boolean;
};

/**
 * Someone's mobile numbers, emails and addresses on this case; the first of each is the
 * primary. A person's mobiles are E.164 (`+91…`); an institution's may be landlines. A
 * list may not hold the same value twice (emails compared ignoring case). On PATCH, a list
 * sent replaces the whole list and a list left out is kept.
 */
export type ContactLists = {
  mobile_numbers?: string[];
  email_addresses?: string[];
  addresses?: Partial<AddressInput>[];
};

export type InstitutionInput = ContactLists & {
  entity_type?: string;
  entity_name: string;
  pan?: string;
  cin?: string;
  /**
   * The filer declared they will not give a PAN or CIN. A complainant institution needs a
   * PAN, a CIN or this, or the backend refuses it (400).
   */
  pan_cin_skip_declared?: true;
};

/**
 * A complainant or an accused: a person, an institution, or a person for an institution.
 * The contact lists are the individual's; an institution's own go inside `institution`,
 * and one with nobody acting for it sends none outside it.
 */
export type PartyInput = ContactLists & {
  /**
   * The filer themselves: the backend uses their own person, linked to their account and
   * `VERIFIED`, and refuses `person` alongside it. Only for a complainant.
   */
  self?: true;
  person?: PersonInput;
  institution?: InstitutionInput;
  /**
   * Accused only, in place of `institution`: another person summoned for a company already
   * accused on the case, which keeps its details and contacts. Needs `person`.
   */
  institution_id?: string;
  /** The person's capacity for the institution; only with both. */
  designation?: string;
  /** An individual complainant's, only when it differs from their first address. */
  permanent_address?: Partial<AddressInput>;
  is_party_in_person: boolean;
  /** Accused only: does the accused reside within this court's jurisdiction. */
  resides_within_jurisdiction?: boolean;
  /**
   * Accused only: the filer declared they have no knowledge of the accused's phone or
   * email and cannot locate them with reasonable effort. Sent only while there is none.
   */
  contact_details_unknown_declared?: true;
  /** Complainants appearing in person only; rich-text editor output with visible text. */
  party_in_person_affidavit?: string;
  additional_details: Record<string, unknown>;
};

/**
 * A PoA holder: always a person (or the filer, as `self`), with at least one address. One
 * mandate is granted for each party in `represented_participant_ids`.
 */
export type PoaHolderInput = ContactLists & {
  self?: true;
  person?: PersonInput;
  /** Only when it differs from their first address. */
  permanent_address?: Partial<AddressInput>;
  represented_participant_ids: string[];
  additional_details: Record<string, unknown>;
};

/** A party just added: its participant, and the institution it is (`null` for a person). */
export type AddedParty = { participantId: string; institutionId: string | null };

/** A PoA holder on the case, and the mandates they were granted. */
export type AddedPoaHolder = { participantId: string; mandateIds: string[] };

/** Whose witness: the side that calls them. */
export type WitnessSide = "COMPLAINANT" | "ACCUSED";

/**
 * A witness: always a person, with at least one address, each with a police station. The
 * mobile number is optional.
 */
export type WitnessInput = ContactLists & {
  person: PersonInput;
  /** Their job title ("Branch manager"), kept on the case's copy. */
  designation?: string;
  side: WitnessSide;
  what_will_witness_prove?: string;
  additional_details: Record<string, unknown>;
};

export type PartyRole = "complainants" | "accused" | "witnesses";

/**
 * What PATCH may change: the case's copy of the details, never who the party is. The
 * contact lists are sent whole, since each one sent replaces the list.
 */
export type ParticipantPatch = ContactLists & {
  name_at_filing: string;
  gender_at_filing: PersonInput["gender"] | null;
  age_at_filing: number | null;
  designation_at_filing?: string | null;
  /** People only; `null` means not answered. */
  disability_status?: boolean | null;
  /**
   * Institution participants only: re-links the participant to the institution its PAN or
   * CIN names, creating one when there is none. Sent only when the company itself changed.
   */
  institution?: Omit<InstitutionInput, keyof ContactLists>;
  /** Institution participants only: the company's own contact lists, without re-linking it. */
  institution_contacts?: Required<ContactLists>;
  /** Individual complainants and PoA holders only; `null` makes it the first address. */
  permanent_address?: Partial<AddressInput> | null;
  /** Complainants and accused only. */
  is_party_in_person?: boolean;
  /** Accused only. */
  resides_within_jurisdiction?: boolean;
  /** Accused only. */
  contact_details_unknown_declared?: boolean;
  /** Complainants only; `null` clears it. */
  party_in_person_affidavit?: string | null;
  additional_details: Record<string, unknown>;
  /** Witnesses only. */
  side?: WitnessSide;
  what_will_witness_prove?: string;
};

/** The backend refuses a shorter search, so it cannot list every advocate. */
export const ADVOCATE_SEARCH_MIN_LENGTH = 2;

/** An approved advocate, as the search returns them. `id` is what a case is given. */
export type FoundAdvocate = { id: string; name: string; barNumber: string };

/* What `GET /cases/{id}` returns of the parties: the case's own copies of them. */

export type AddressRead = {
  address_id?: string;
  line1: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  police_station: string | null;
};

/** Someone's contacts on this case, each list primary first. */
export type ContactListsRead = {
  mobile_numbers: string[];
  email_addresses: string[];
  addresses: AddressRead[];
};

/**
 * The institution's row, with its own contacts on this case. PAN, CIN and the skip
 * declaration are `null` but for a complainant.
 */
export type InstitutionRead = ContactListsRead & {
  entity_name: string;
  entity_type: string;
  pan: string | null;
  cin: string | null;
  pan_cin_skip_declared: boolean | null;
};

export type ParticipantRole = "COMPLAINANT" | "ACCUSED" | "WITNESS" | "POA_HOLDER";

/** A participant. The contact lists are the person's (empty for an institution alone). */
export type ParticipantRead = ContactListsRead & {
  case_participant_id: string;
  person_id: string | null;
  institution_id: string | null;
  role: ParticipantRole;
  ordinal: number;
  name_at_filing: string | null;
  gender_at_filing: string | null;
  age_at_filing: number | null;
  designation_at_filing: string | null;
  institution: InstitutionRead | null;
  /** `null` when not answered, or for an institution alone. */
  disability_status: boolean | null;
  /** Only when it differs from the first address. */
  permanent_address: AddressRead | null;
  is_party_in_person: boolean;
  resides_within_jurisdiction: boolean | null;
  contact_details_unknown_declared: boolean;
  party_in_person_affidavit: string | null;
  additional_details: Record<string, unknown>;
  updated_at: string;
};

export type RepresentationRead = {
  representation_id: string;
  advocate_id: string;
  advocate_name: string;
  bar_registration_id: string;
  client_participant_id: string;
};

export type PoaMandateRead = {
  poa_mandate_id: string;
  poa_participant_id: string;
  represented_participant_id: string;
};

/** The active parties, advocates and mandates on a case, as the case recorded them. */
export type CaseRead = {
  participants: ParticipantRead[];
  representations: RepresentationRead[];
  poa_mandates: PoaMandateRead[];
};

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

/** An `evidence_info` body; its keys and value types are the backend's per-type schema. */
export type EvidenceInfo = Record<string, string | number | boolean>;

export type SavedEvidence = {
  caseEvidenceId: string;
  evidenceType: string;
  /** The row's place within its evidence type, 1-based (cheque #1, return memo #1, …). */
  ordinal: number;
};

type CaseEvidenceBody = { case_evidence_id?: unknown; evidence_type?: unknown; ordinal?: unknown };

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
  if (!isApiError(error)) return copy.generic;
  if (error.kind === "network" || error.kind === "timeout") return copy.unreachable;
  if (error.kind !== "http") return copy.generic;
  if (error.hasCode(E_CASE_SUBMITTED)) return copy.submitted;
  if (error.hasCode(E_TYPE_NOT_ACCEPTED)) return copy.documentTypeNotAccepted;
  if (error.hasCode(E_WITNESS_EXISTS)) return copy.witnessExists;
  if (error.hasCode(E_EVIDENCE_NOT_ON_CASE)) return copy.noticeNotOnCase;
  if (error.hasCode(E_NOT_A_NOTICE) || error.hasCode(E_EVIDENCE_LINK_NOT_ALLOWED)) {
    return copy.noticeLinkFailed;
  }
  if (error.status === 401 || error.status === 403) return copy.sessionEnded;
  if (error.status === 404) return copy.draftGone;
  if (error.status === 413) return copy.fileTooLarge;
  return partyFieldMessage(error) ?? error.fieldError("file") ?? error.message;
}

export function createCaseFilingApi(client: ApiClient = api) {
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
      };
    },
  };
}

export type CaseFilingApi = ReturnType<typeof createCaseFilingApi>;

export const caseFilingApi = createCaseFilingApi();
