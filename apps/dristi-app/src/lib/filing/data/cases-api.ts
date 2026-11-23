/**
 * The backend case behind a filing (dristi-be "Case Filing API"): its request and response
 * shapes, the upload type for each slot, and what to tell the person when a call fails.
 *
 * The calls themselves are `CaseFilingRepository` in `./repository.ts`, answered by the
 * backend (`createCaseFilingApi` in `./http.ts`) or the sandbox (`SandboxCaseFiling` in
 * `./indexeddb.ts`). Reach them through `getCaseFilingRepository()` from `./index.ts`. Both answer with these shapes and
 * fail with the same `ApiError`s, so `caseFilingErrorMessage` reads either.
 *
 * The backend creates the case lazily, on the first save, and gives it the draft
 * session's id — so the id `startDraft` returns is the case id for the life of the
 * filing, and the local draft is stored under it.
 */

import { isApiError } from "@/lib/api";

import { caseFilingCopy as copy } from "../content";
import type { IntakeDocType } from "../types";
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
  // Who it identifies is the participant it is linked to: the PoA holder, not the complainant.
  "poa-holder-id-proof": "IDENTITY_PROOF",
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
  if ("displayName" in meta) patch.display_name = meta.displayName?.trim() || null;
  if ("caseParticipantId" in meta) patch.case_participant_id = meta.caseParticipantId ?? null;
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
  /** `null` clears the name on the case: the backend takes it as not given. */
  name_at_filing: string | null;
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
  // Optional on a partly filled case; read back as "" for the form.
  entity_name: string | null;
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
  /** What only a witness has; `null` for every other role. */
  witness?: WitnessRead | null;
  updated_at: string;
};

export type WitnessRead = {
  side: WitnessSide;
  what_will_witness_prove: string | null;
  additional_details: Record<string, unknown>;
};

/** A cheque, return memo or demand notice; `evidence_info` comes back exactly as saved. */
export type EvidenceRead = {
  case_evidence_id: string;
  case_document_id: string | null;
  evidence_type: string;
  /** The row's place within its type, 1-based; it never changes while the row exists. */
  ordinal: number;
  evidence_info: Record<string, unknown>;
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
  evidence: EvidenceRead[];
  /** One object per details section saved (`jurisdiction_limitation`, `adr_other_prayer`). */
  details: Record<string, Record<string, unknown>>;
  /** `null` before it is first saved. */
  affidavit: string | null;
};

/** An `evidence_info` body; its keys and value types are the backend's per-type schema. */
export type EvidenceInfo = Record<string, string | number | boolean>;

export type SavedEvidence = {
  caseEvidenceId: string;
  evidenceType: string;
  /** The row's place within its evidence type, 1-based (cheque #1, return memo #1, …). */
  ordinal: number;
};

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

/**
 * True when reading a case failed only because the case has not been saved yet.
 *
 * Nothing is stored on the server until a step's first save, so the first read of a new
 * filing answers 404. A step that reads the case treats this as "nothing on the case yet"
 * rather than a failure (see `loadFromCase` in use-case-parties / use-case-advocates).
 */
export function isCaseNotYetSaved(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}
