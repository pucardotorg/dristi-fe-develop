/**
 * The e-filing sandbox, in this browser. Design owns this file.
 *
 *   - Drafts: one database (`dristi-efiling`), two stores: `drafts` (whole drafts, indexed
 *     by `updatedAt`) and `files` (upload bytes + metadata). Blobs are stored as-is, so
 *     uploads survive reloads and are never base64-inflated. Databases created before the
 *     profile moved to the signed-in account still hold an unused `profile` store.
 *   - The backend case (`SandboxCaseFiling`): answers `CaseFilingRepository` the way
 *     dristi-be does, so every step saves and reads back with no backend. Like the backend
 *     it opens a draft session on `startDraft`, creates the case on the first save,
 *     renumbers a role when a party leaves, takes a party's PoA mandates and
 *     representations off with them, and refuses what the backend refuses with the same
 *     `ApiError`s (status and registered code), so `caseFilingErrorMessage` reads either.
 *     `validateCase` runs a shorter check than the backend's: who is on the case, the three
 *     evidence rows, both details sections and the affidavit. Storage is passed in
 *     (`CaseStore`): IndexedDB here (`dristi-efiling-cases`), memory in tests. Calls run one
 *     at a time, so steps saving together cannot overwrite each other's changes.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { ApiError } from "@/lib/api";
import { getAuthService } from "@/lib/auth";

import { migrateDraft } from "../blank";
import type { EvidenceType } from "../evidence";
import type { FilingDraft } from "../types";
import type { ValidationError, ValidationResult } from "../validation";
import {
  ADVOCATE_SEARCH_MIN_LENGTH,
  type AddedParty,
  type AddedPoaHolder,
  type AddressInput,
  type AddressRead,
  type CaseDocumentMeta,
  type CaseDocumentPatch,
  type CaseDocumentType,
  type CaseRead,
  type ContactLists,
  type EvidenceInfo,
  type EvidenceRead,
  type FoundAdvocate,
  type InstitutionInput,
  type InstitutionRead,
  type ParticipantPatch,
  type ParticipantRead,
  type ParticipantRole,
  type PartyInput,
  type PartyRole,
  type PersonInput,
  type PoaHolderInput,
  type PoaMandateRead,
  type RepresentationRead,
  type SavedEvidence,
  type UploadedCaseDocument,
  type WitnessInput,
} from "./cases-api";
import type { CaseFilingRepository, FilingRepository, NewEvidence, StoredFile } from "./repository";

const DB_NAME = "dristi-efiling";
const DB_VERSION = 1;

interface FilingDB extends DBSchema {
  drafts: {
    key: string;
    value: FilingDraft;
    indexes: { updatedAt: string };
  };
  files: {
    key: string;
    value: StoredFile;
  };
}

let dbPromise: Promise<IDBPDatabase<FilingDB>> | null = null;

function db(): Promise<IDBPDatabase<FilingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FilingDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const drafts = database.createObjectStore("drafts", { keyPath: "id" });
        drafts.createIndex("updatedAt", "updatedAt");
        database.createObjectStore("files", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

/**
 * Migrate one stored draft, or leave it out of the list.
 *
 * `migrateDraft` handles every shape this branch knows about, but drafts on disk are
 * written by whichever branch ran last on this origin, and the next one is not
 * predictable. A record it cannot make sense of is dropped from the listing instead of
 * throwing: the queue then shows the drafts it *can* read, rather than one bad row
 * taking the whole filings screen down with it.
 */
function readable(draft: FilingDraft): FilingDraft | null {
  try {
    return migrateDraft(draft);
  } catch (err) {
    console.warn("[filing] skipping a draft this build cannot read", draft?.id, err);
    return null;
  }
}

export class IndexedDbFilingRepository implements FilingRepository {
  async listDrafts(): Promise<FilingDraft[]> {
    const all = await (await db()).getAllFromIndex("drafts", "updatedAt");
    // newest first
    return all
      .reverse()
      .map(readable)
      .filter((d): d is FilingDraft => d !== null);
  }

  async getDraft(id: string): Promise<FilingDraft | null> {
    const draft = await (await db()).get("drafts", id);
    // Drafts written by an earlier shape of the form are still on this person's disk.
    return draft ? readable(draft) : null;
  }

  async putDraft(draft: FilingDraft): Promise<void> {
    await (await db()).put("drafts", draft);
  }

  async deleteDraft(id: string): Promise<void> {
    await (await db()).delete("drafts", id);
  }

  async putFile(file: StoredFile): Promise<void> {
    await (await db()).put("files", file);
  }

  async getFile(id: string): Promise<StoredFile | null> {
    return (await (await db()).get("files", id)) ?? null;
  }

  async deleteFile(id: string): Promise<void> {
    await (await db()).delete("files", id);
  }

  async deleteFiles(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const tx = (await db()).transaction("files", "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
}

/* ─────────────────────────────── The backend case ───────────────────────────────── */

/** A document on the case: what the backend keeps beside the file (the bytes stay local). */
export type SandboxDocument = {
  case_document_id: string;
  document_type: CaseDocumentType;
  case_participant_id: string | null;
  case_evidence_id: string | null;
  is_digital: boolean | null;
  display_name: string | null;
};

/** One case as the sandbox stores it. */
export type SandboxCase = {
  caseId: string;
  /** False from `startDraft` until the first save, as the backend creates cases lazily. */
  created: boolean;
  participants: ParticipantRead[];
  representations: RepresentationRead[];
  poaMandates: PoaMandateRead[];
  evidence: EvidenceRead[];
  details: Record<string, Record<string, unknown>>;
  affidavit: string | null;
  documents: SandboxDocument[];
};

/** Where the sandbox keeps its cases. */
export type CaseStore = {
  get(caseId: string): Promise<SandboxCase | undefined>;
  put(record: SandboxCase): Promise<void>;
  list(): Promise<SandboxCase[]>;
};

/** The signed-in person, for a party added as `self`; `null` when unknown. */
export type SandboxAccount = { name: string; mobile: string } | null;

/** Approved advocates the sandbox's search finds. Demo names, not real enrolments. */
export const SANDBOX_ADVOCATES: readonly FoundAdvocate[] = [
  { id: "sandbox-adv-anjali-nair", name: "Anjali Nair", barNumber: "K/1188/2011" },
  { id: "sandbox-adv-thomas-kurian", name: "Thomas Kurian", barNumber: "K/2204/2015" },
  { id: "sandbox-adv-meera-pillai", name: "Meera Pillai", barNumber: "K/0941/2009" },
  { id: "sandbox-adv-joseph-mathew", name: "Joseph Mathew", barNumber: "K/0876/2007" },
  { id: "sandbox-adv-sreeja-menon", name: "Sreeja Menon", barNumber: "K/1532/2013" },
];

/** The backend's upload limit. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Scans: their evidence row points at them, never the other way round (E07030). */
const SCANS: ReadonlySet<CaseDocumentType> = new Set([
  "BOUNCED_CHEQUE",
  "RETURN_MEMO",
  "LEGAL_DEMAND_NOTICE",
]);

const ROLE: Record<PartyRole, ParticipantRole> = {
  complainants: "COMPLAINANT",
  accused: "ACCUSED",
  witnesses: "WITNESS",
};

/** What `validateCase` asks for, as `stepForValidationField` reads the fields. */
const REQUIRED_EVIDENCE: { type: EvidenceType; field: string; message: string }[] = [
  { type: "CHEQUE", field: "evidence.cheque", message: "Add the dishonoured cheque." },
  { type: "RETURN_MEMO", field: "evidence.return_memo", message: "Add the cheque return memo." },
  {
    type: "LEGAL_DEMAND_NOTICE",
    field: "evidence.legal_demand_notice",
    message: "Add the legal demand notice.",
  },
];
const REQUIRED_DETAILS: { section: string; message: string }[] = [
  { section: "jurisdiction_limitation", message: "Fill in jurisdiction and limitation." },
  { section: "adr_other_prayer", message: "Fill in ADR, other details and prayer." },
];

/* ─────────────────────────────────── Errors ─────────────────────────────────────── */

function refused(status: number, message: string, code?: string): ApiError {
  return new ApiError({ kind: "http", status, message, code: code ?? null });
}

const notFound = (what: string) => refused(404, `No ${what} with that id.`);

/* ────────────────────────────── Backend → read shapes ───────────────────────────── */

function newId(): string {
  return crypto.randomUUID();
}

function addressRead(a: Partial<AddressInput>): AddressRead {
  return {
    address_id: newId(),
    line1: a.line1 ?? null,
    city: a.city ?? null,
    district: a.district ?? null,
    state: a.state ?? null,
    pincode: a.pincode ?? null,
    police_station: a.police_station ?? null,
  };
}

function listsRead(lists: ContactLists) {
  return {
    mobile_numbers: [...(lists.mobile_numbers ?? [])],
    email_addresses: [...(lists.email_addresses ?? [])],
    addresses: (lists.addresses ?? []).map(addressRead),
  };
}

/** PAN, CIN and the skip declaration are kept only for a complainant, as the backend does. */
function institutionRead(
  i: Omit<InstitutionInput, keyof ContactLists>,
  lists: ContactLists,
  complainant: boolean,
): InstitutionRead {
  return {
    entity_name: i.entity_name,
    entity_type: i.entity_type ?? "",
    pan: complainant ? (i.pan ?? null) : null,
    cin: complainant ? (i.cin ?? null) : null,
    pan_cin_skip_declared: complainant ? !!i.pan_cin_skip_declared : null,
    contact_details_unknown_declared: !!i.contact_details_unknown_declared,
    ...listsRead(lists),
  };
}

/** A ten-digit Indian mobile as the backend stores it. */
function e164(mobile: string): string {
  return /^\d{10}$/.test(mobile) ? `+91${mobile}` : mobile;
}

type AnyInput = (PartyInput | WitnessInput | PoaHolderInput) & {
  self?: true;
  person?: PersonInput;
  institution?: InstitutionInput;
  institution_id?: string;
  designation?: string;
  permanent_address?: Partial<AddressInput>;
  is_party_in_person?: boolean;
  resides_within_jurisdiction?: boolean;
  contact_details_unknown_declared?: true;
  party_in_person_affidavit?: string;
  side?: WitnessInput["side"];
  what_will_witness_prove?: string;
};

function participantRead(
  input: AnyInput,
  role: ParticipantRole,
  ordinal: number,
  account: SandboxAccount,
  sharedInstitution: Pick<ParticipantRead, "institution_id" | "institution"> | null,
): ParticipantRead {
  // As `self`, the backend takes its own record of the filer: their name and mobile.
  const person: PersonInput | undefined =
    input.person ?? (input.self ? { name: account?.name ?? "" } : undefined);
  const lists = listsRead(input);
  if (input.self && lists.mobile_numbers.length === 0 && account?.mobile) {
    lists.mobile_numbers = [e164(account.mobile)];
  }
  const institution = input.institution
    ? {
        institution_id: newId(),
        institution: institutionRead(input.institution, input.institution, role === "COMPLAINANT"),
      }
    : sharedInstitution;
  return {
    case_participant_id: newId(),
    person_id: person ? newId() : null,
    institution_id: institution?.institution_id ?? null,
    role,
    ordinal,
    name_at_filing: person?.name ?? null,
    gender_at_filing: person?.gender ?? null,
    age_at_filing: person?.age ?? null,
    designation_at_filing: input.designation ?? null,
    institution: institution ? structuredClone(institution.institution) : null,
    disability_status: person?.disability_status ?? null,
    ...lists,
    permanent_address: input.permanent_address ? addressRead(input.permanent_address) : null,
    is_party_in_person: input.is_party_in_person ?? false,
    resides_within_jurisdiction:
      role === "ACCUSED" ? (input.resides_within_jurisdiction ?? null) : null,
    contact_details_unknown_declared: !!input.contact_details_unknown_declared,
    party_in_person_affidavit: input.party_in_person_affidavit ?? null,
    additional_details: structuredClone(input.additional_details ?? {}),
    witness:
      role === "WITNESS" && input.side
        ? {
            side: input.side,
            what_will_witness_prove: input.what_will_witness_prove ?? null,
            additional_details: structuredClone(input.additional_details ?? {}),
          }
        : null,
    updated_at: new Date().toISOString(),
  };
}

/** Visible text in the rich-text editor's output. */
function hasVisibleText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  );
}

function renumber(c: SandboxCase, role: ParticipantRole) {
  c.participants
    .filter((p) => p.role === role)
    .sort((a, b) => a.ordinal - b.ordinal)
    .forEach((p, i) => {
      p.ordinal = i + 1;
    });
}

function nextOrdinal<T extends { ordinal: number }>(rows: T[]): number {
  return rows.reduce((max, r) => Math.max(max, r.ordinal), 0) + 1;
}

const holdsEvidence = (id: string) => (c: SandboxCase) =>
  c.evidence.some((e) => e.case_evidence_id === id);

function emptyCase(caseId: string): SandboxCase {
  return {
    caseId,
    created: false,
    participants: [],
    representations: [],
    poaMandates: [],
    evidence: [],
    details: {},
    affidavit: null,
    documents: [],
  };
}

/* ─────────────────────────────────── The sandbox ────────────────────────────────── */

export class SandboxCaseFiling implements CaseFilingRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: CaseStore,
    private readonly account: () => Promise<SandboxAccount> = async () => null,
  ) {}

  /** Run calls one at a time: each reads, changes and writes a whole case. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** A case for a save: the draft session must exist; the first save creates the case. */
  private async forSave(caseId: string): Promise<SandboxCase> {
    const c = await this.store.get(caseId);
    if (!c) throw notFound("draft");
    c.created = true;
    return c;
  }

  /** A case for a read: 404 until something has been saved, as on the backend. */
  private async forRead(caseId: string): Promise<SandboxCase> {
    const c = await this.store.get(caseId);
    if (!c?.created) throw notFound("case");
    return c;
  }

  /** The case holding a row, found by the row's own id. */
  private async owner(what: string, holds: (c: SandboxCase) => boolean): Promise<SandboxCase> {
    const c = (await this.store.list()).find(holds);
    if (!c) throw notFound(what);
    return c;
  }

  private checkDocumentLinks(
    c: SandboxCase,
    type: CaseDocumentType,
    participantId: string | null | undefined,
    evidenceId: string | null | undefined,
  ) {
    if (participantId && !c.participants.some((p) => p.case_participant_id === participantId)) {
      throw refused(400, "That participant is not on this case.");
    }
    if (!evidenceId) return;
    if (SCANS.has(type)) {
      throw refused(400, "A scan is linked from its evidence row, not on upload.", "E07030");
    }
    const row = c.evidence.find((e) => e.case_evidence_id === evidenceId);
    if (!row) throw refused(400, "No active evidence with that id on the case.", "E07031");
    if (row.evidence_type !== "LEGAL_DEMAND_NOTICE") {
      throw refused(400, "Only a demand notice's papers are linked to its evidence.", "E07029");
    }
  }

  async startDraft(): Promise<{ caseId: string }> {
    return this.serial(async () => {
      const caseId = newId();
      await this.store.put(emptyCase(caseId));
      return { caseId };
    });
  }

  async uploadDocument(
    caseId: string,
    file: Blob,
    _fileName: string,
    documentType: CaseDocumentType,
    meta: CaseDocumentMeta = {},
  ): Promise<UploadedCaseDocument> {
    return this.serial(async () => {
      if (file.size > MAX_UPLOAD_BYTES) throw refused(413, "The file is larger than 10 MB.");
      const c = await this.forSave(caseId);
      this.checkDocumentLinks(c, documentType, meta.caseParticipantId, meta.caseEvidenceId);
      const doc: SandboxDocument = {
        case_document_id: newId(),
        document_type: documentType,
        case_participant_id: meta.caseParticipantId ?? null,
        case_evidence_id: meta.caseEvidenceId ?? null,
        is_digital: meta.isDigital ?? null,
        display_name: meta.displayName?.trim() || null,
      };
      c.documents.push(doc);
      await this.store.put(c);
      return { caseId, caseDocumentId: doc.case_document_id, documentType };
    });
  }

  async updateDocument(caseDocumentId: string, patch: CaseDocumentPatch): Promise<void> {
    return this.serial(async () => {
      const holds = (c: SandboxCase) =>
        c.documents.some((d) => d.case_document_id === caseDocumentId);
      const c = await this.owner("document", holds);
      const doc = c.documents.find((d) => d.case_document_id === caseDocumentId);
      if (!doc) throw notFound("document");
      this.checkDocumentLinks(
        c,
        doc.document_type,
        patch.case_participant_id,
        patch.case_evidence_id,
      );
      if (patch.case_participant_id !== undefined) {
        doc.case_participant_id = patch.case_participant_id;
      }
      if (patch.case_evidence_id !== undefined) doc.case_evidence_id = patch.case_evidence_id;
      if (patch.is_digital !== undefined) doc.is_digital = patch.is_digital;
      if (patch.display_name !== undefined) doc.display_name = patch.display_name?.trim() || null;
      await this.store.put(c);
    });
  }

  async deleteDocument(caseDocumentId: string): Promise<void> {
    return this.serial(async () => {
      const holds = (c: SandboxCase) =>
        c.documents.some((d) => d.case_document_id === caseDocumentId);
      const c = await this.owner("document", holds);
      c.documents = c.documents.filter((d) => d.case_document_id !== caseDocumentId);
      for (const e of c.evidence) {
        if (e.case_document_id === caseDocumentId) e.case_document_id = null;
      }
      await this.store.put(c);
    });
  }

  async addParty(
    caseId: string,
    role: PartyRole,
    party: PartyInput | WitnessInput,
  ): Promise<AddedParty> {
    const account = await this.account().catch(() => null);
    return this.serial(async () => {
      const input: AnyInput = party;
      const c = await this.forSave(caseId);
      const roleName = ROLE[role];
      if (input.self && input.person) {
        throw refused(400, "A party added as yourself takes no other person.");
      }
      if (roleName === "COMPLAINANT" && input.institution) {
        const i = input.institution;
        if (!i.pan && !i.cin && !i.pan_cin_skip_declared) {
          throw refused(400, "A complainant institution needs a PAN or CIN.");
        }
      }
      let shared: Pick<ParticipantRead, "institution_id" | "institution"> | null = null;
      if (input.institution_id) {
        const sibling = c.participants.find(
          (p) => p.role === "ACCUSED" && p.institution_id === input.institution_id,
        );
        if (!sibling) throw refused(400, "No accused institution with that id on this case.");
        shared = { institution_id: sibling.institution_id, institution: sibling.institution };
      }
      if (roleName === "WITNESS" && input.person) {
        const name = input.person.name.trim().toLowerCase();
        const mobile = input.mobile_numbers?.[0] ?? null;
        const twice = c.participants.some(
          (p) =>
            p.role === "WITNESS" &&
            p.witness?.side === input.side &&
            (p.name_at_filing ?? "").trim().toLowerCase() === name &&
            (p.mobile_numbers[0] ?? null) === mobile,
        );
        if (twice) throw refused(400, "This person is already a witness for this side.", "E07032");
      }
      const ordinal = nextOrdinal(c.participants.filter((p) => p.role === roleName));
      const p = participantRead(input, roleName, ordinal, account, shared);
      c.participants.push(p);
      await this.store.put(c);
      return { participantId: p.case_participant_id, institutionId: p.institution_id };
    });
  }

  async updateParticipant(caseParticipantId: string, patch: ParticipantPatch): Promise<void> {
    return this.serial(async () => {
      const holds = (c: SandboxCase) =>
        c.participants.some((p) => p.case_participant_id === caseParticipantId);
      const c = await this.owner("participant", holds);
      const p = c.participants.find((q) => q.case_participant_id === caseParticipantId);
      if (!p) throw notFound("participant");

      p.name_at_filing = patch.name_at_filing;
      p.gender_at_filing = patch.gender_at_filing ?? null;
      p.age_at_filing = patch.age_at_filing;
      if (patch.designation_at_filing !== undefined) {
        p.designation_at_filing = patch.designation_at_filing;
      }
      if (patch.disability_status !== undefined) p.disability_status = patch.disability_status;
      if (patch.mobile_numbers) p.mobile_numbers = [...patch.mobile_numbers];
      if (patch.email_addresses) p.email_addresses = [...patch.email_addresses];
      if (patch.addresses) p.addresses = patch.addresses.map(addressRead);

      // The company's details and contacts apply to everyone on the case for it.
      const company = p.institution_id
        ? c.participants.filter((q) => q.institution_id === p.institution_id)
        : [p];
      if (patch.institution) {
        const complainant = p.role === "COMPLAINANT";
        for (const q of company) {
          // The company's own contacts stay; `institution_contacts` changes them.
          q.institution = {
            ...institutionRead(patch.institution, {}, complainant),
            mobile_numbers: q.institution?.mobile_numbers ?? [],
            email_addresses: q.institution?.email_addresses ?? [],
            addresses: q.institution?.addresses ?? [],
          };
        }
      }
      if (patch.institution_contacts) {
        for (const q of company) {
          if (q.institution) Object.assign(q.institution, listsRead(patch.institution_contacts));
        }
      }

      if (patch.permanent_address !== undefined) {
        p.permanent_address = patch.permanent_address ? addressRead(patch.permanent_address) : null;
      }
      if (patch.is_party_in_person !== undefined) p.is_party_in_person = patch.is_party_in_person;
      if (patch.resides_within_jurisdiction !== undefined) {
        p.resides_within_jurisdiction = patch.resides_within_jurisdiction;
      }
      if (patch.contact_details_unknown_declared !== undefined) {
        p.contact_details_unknown_declared = patch.contact_details_unknown_declared;
      }
      if (patch.party_in_person_affidavit !== undefined) {
        p.party_in_person_affidavit = patch.party_in_person_affidavit;
      }
      p.additional_details = structuredClone(patch.additional_details);
      if (p.witness) {
        if (patch.side) p.witness.side = patch.side;
        if (patch.what_will_witness_prove !== undefined) {
          p.witness.what_will_witness_prove = patch.what_will_witness_prove;
        }
        p.witness.additional_details = structuredClone(patch.additional_details);
      }
      p.updated_at = new Date().toISOString();
      await this.store.put(c);
    });
  }

  async removeParticipant(caseParticipantId: string): Promise<void> {
    return this.serial(async () => {
      const holds = (c: SandboxCase) =>
        c.participants.some((p) => p.case_participant_id === caseParticipantId);
      const c = await this.owner("participant", holds);
      const gone = c.participants.find((p) => p.case_participant_id === caseParticipantId);
      if (!gone) throw notFound("participant");
      this.dropParticipant(c, gone);
      await this.store.put(c);
    });
  }

  /** Take a participant off, with their mandates and representations, as the backend does. */
  private dropParticipant(c: SandboxCase, gone: ParticipantRead) {
    const id = gone.case_participant_id;
    c.participants = c.participants.filter((p) => p.case_participant_id !== id);
    c.representations = c.representations.filter((r) => r.client_participant_id !== id);
    c.poaMandates = c.poaMandates.filter(
      (m) => m.represented_participant_id !== id && m.poa_participant_id !== id,
    );
    for (const d of c.documents) if (d.case_participant_id === id) d.case_participant_id = null;
    // A holder left with no mandate is no longer on the case.
    const holders = c.participants.filter(
      (p) =>
        p.role === "POA_HOLDER" &&
        !c.poaMandates.some((m) => m.poa_participant_id === p.case_participant_id),
    );
    for (const h of holders) this.dropParticipant(c, h);
    renumber(c, gone.role);
  }

  async searchAdvocates(query: string, signal?: AbortSignal): Promise<FoundAdvocate[]> {
    const q = query.trim().toLowerCase();
    if (q.length < ADVOCATE_SEARCH_MIN_LENGTH) return [];
    if (signal?.aborted) {
      throw new ApiError({ kind: "aborted", message: "The search was cancelled." });
    }
    return SANDBOX_ADVOCATES.filter(
      (a) => a.name.toLowerCase().includes(q) || a.barNumber.toLowerCase().includes(q),
    ).map((a) => ({ ...a }));
  }

  async addAdvocate(
    caseId: string,
    advocateId: string,
    clientParticipantIds: string[],
  ): Promise<string[]> {
    return this.serial(async () => {
      const c = await this.forSave(caseId);
      const advocate = SANDBOX_ADVOCATES.find((a) => a.id === advocateId);
      if (!advocate) throw refused(400, "That is not an approved advocate.");
      const clients = clientParticipantIds.map((id) =>
        c.participants.find((p) => p.case_participant_id === id && p.role === "COMPLAINANT"),
      );
      if (clients.length === 0 || clients.some((p) => !p)) {
        throw refused(400, "An advocate acts only for complainants on this case.");
      }
      const rows: RepresentationRead[] = clientParticipantIds.map((id) => ({
        representation_id: newId(),
        advocate_id: advocate.id,
        advocate_name: advocate.name,
        bar_registration_id: advocate.barNumber,
        client_participant_id: id,
      }));
      c.representations.push(...rows);
      await this.store.put(c);
      return rows.map((r) => r.representation_id);
    });
  }

  async endRepresentation(representationId: string): Promise<void> {
    return this.serial(async () => {
      const holds = (c: SandboxCase) =>
        c.representations.some((r) => r.representation_id === representationId);
      const c = await this.owner("representation", holds);
      c.representations = c.representations.filter((r) => r.representation_id !== representationId);
      await this.store.put(c);
    });
  }

  async addPoaHolder(caseId: string, holder: PoaHolderInput): Promise<AddedPoaHolder> {
    const account = await this.account().catch(() => null);
    return this.serial(async () => {
      const c = await this.forSave(caseId);
      const forIds = holder.represented_participant_ids;
      const known = (id: string) =>
        c.participants.some((p) => p.case_participant_id === id && p.role === "COMPLAINANT");
      if (forIds.length === 0 || !forIds.every(known)) {
        throw refused(400, "A PoA holder acts only for complainants on this case.");
      }
      const ordinal = nextOrdinal(c.participants.filter((p) => p.role === "POA_HOLDER"));
      const p = participantRead(holder, "POA_HOLDER", ordinal, account, null);
      const mandates: PoaMandateRead[] = forIds.map((id) => ({
        poa_mandate_id: newId(),
        poa_participant_id: p.case_participant_id,
        represented_participant_id: id,
      }));
      c.participants.push(p);
      c.poaMandates.push(...mandates);
      await this.store.put(c);
      return {
        participantId: p.case_participant_id,
        mandateIds: mandates.map((m) => m.poa_mandate_id),
      };
    });
  }

  async revokePoaMandate(mandateId: string): Promise<void> {
    return this.serial(async () => {
      const holds = (c: SandboxCase) => c.poaMandates.some((m) => m.poa_mandate_id === mandateId);
      const c = await this.owner("PoA mandate", holds);
      const mandate = c.poaMandates.find((m) => m.poa_mandate_id === mandateId);
      c.poaMandates = c.poaMandates.filter((m) => m.poa_mandate_id !== mandateId);
      const holderId = mandate?.poa_participant_id;
      const holder = c.participants.find((p) => p.case_participant_id === holderId);
      if (holder && !c.poaMandates.some((m) => m.poa_participant_id === holderId)) {
        this.dropParticipant(c, holder);
      }
      await this.store.put(c);
    });
  }

  private checkEvidenceDocument(c: SandboxCase, caseDocumentId: string | null | undefined) {
    if (caseDocumentId && !c.documents.some((d) => d.case_document_id === caseDocumentId)) {
      throw refused(400, "No document with that id on this case.");
    }
  }

  async addEvidence(caseId: string, input: NewEvidence): Promise<SavedEvidence> {
    return this.serial(async () => {
      const c = await this.forSave(caseId);
      this.checkEvidenceDocument(c, input.caseDocumentId);
      const row: EvidenceRead = {
        case_evidence_id: newId(),
        case_document_id: input.caseDocumentId ?? null,
        evidence_type: input.evidenceType,
        // Never reused while the row exists, so a removed row's number is not taken twice.
        ordinal: nextOrdinal(c.evidence.filter((e) => e.evidence_type === input.evidenceType)),
        evidence_info: structuredClone(input.evidenceInfo),
      };
      c.evidence.push(row);
      await this.store.put(c);
      return {
        caseEvidenceId: row.case_evidence_id,
        evidenceType: row.evidence_type,
        ordinal: row.ordinal,
      };
    });
  }

  async updateEvidence(
    caseEvidenceId: string,
    patch: { evidenceInfo?: EvidenceInfo; caseDocumentId?: string | null },
  ): Promise<SavedEvidence> {
    return this.serial(async () => {
      const c = await this.owner("evidence", holdsEvidence(caseEvidenceId));
      const row = c.evidence.find((e) => e.case_evidence_id === caseEvidenceId);
      if (!row) throw notFound("evidence");
      this.checkEvidenceDocument(c, patch.caseDocumentId);
      if (patch.evidenceInfo !== undefined) row.evidence_info = structuredClone(patch.evidenceInfo);
      if (patch.caseDocumentId !== undefined) row.case_document_id = patch.caseDocumentId;
      await this.store.put(c);
      return { caseEvidenceId, evidenceType: row.evidence_type, ordinal: row.ordinal };
    });
  }

  async deleteEvidence(caseEvidenceId: string): Promise<void> {
    return this.serial(async () => {
      const c = await this.owner("evidence", holdsEvidence(caseEvidenceId));
      c.evidence = c.evidence.filter((e) => e.case_evidence_id !== caseEvidenceId);
      for (const d of c.documents) {
        if (d.case_evidence_id === caseEvidenceId) d.case_evidence_id = null;
      }
      await this.store.put(c);
    });
  }

  async saveDetails(caseId: string, section: string, data: Record<string, unknown>): Promise<void> {
    return this.serial(async () => {
      const c = await this.forSave(caseId);
      c.details[section] = structuredClone(data);
      await this.store.put(c);
    });
  }

  async saveAffidavit(caseId: string, affidavit: string): Promise<void> {
    return this.serial(async () => {
      if (!hasVisibleText(affidavit)) throw refused(400, "The affidavit is empty.");
      const c = await this.forSave(caseId);
      c.affidavit = affidavit;
      await this.store.put(c);
    });
  }

  async validateCase(caseId: string): Promise<ValidationResult> {
    return this.serial(async () => {
      const c = await this.forRead(caseId);
      const errors: ValidationError[] = [];
      const of = (role: ParticipantRole) => c.participants.filter((p) => p.role === role);
      if (of("COMPLAINANT").length === 0) {
        errors.push({
          field: "participants.complainants",
          message: "Add at least one complainant.",
        });
      }
      for (const p of of("COMPLAINANT")) {
        const represented = c.representations.some(
          (r) => r.client_participant_id === p.case_participant_id,
        );
        if (!represented && !p.is_party_in_person) {
          errors.push({
            field: `participants.${p.case_participant_id}`,
            message: `Complainant #${p.ordinal} has no advocate and is not appearing in person.`,
          });
        }
      }
      if (of("ACCUSED").length === 0) {
        errors.push({ field: "participants.accused", message: "Add at least one accused." });
      }
      for (const need of REQUIRED_EVIDENCE) {
        if (!c.evidence.some((e) => e.evidence_type === need.type)) {
          errors.push({ field: need.field, message: need.message });
        }
      }
      for (const need of REQUIRED_DETAILS) {
        if (!c.details[need.section]) {
          errors.push({ field: `details.${need.section}`, message: need.message });
        }
      }
      if (!c.affidavit) errors.push({ field: "affidavit", message: "Add the affidavit." });
      return { isValid: errors.length === 0, errors };
    });
  }

  async getCase(caseId: string): Promise<CaseRead> {
    return this.serial(async () => {
      const c = await this.forRead(caseId);
      return structuredClone({
        participants: c.participants,
        representations: c.representations,
        poa_mandates: c.poaMandates,
        evidence: c.evidence,
        details: c.details,
        affidavit: c.affidavit,
      });
    });
  }
}

/** A store in memory: for tests, and anywhere IndexedDB is not available. */
export function memoryCaseStore(): CaseStore {
  const cases = new Map<string, SandboxCase>();
  return {
    async get(caseId) {
      const c = cases.get(caseId);
      return c ? structuredClone(c) : undefined;
    },
    async put(record) {
      cases.set(record.caseId, structuredClone(record));
    },
    async list() {
      return [...cases.values()].map((c) => structuredClone(c));
    },
  };
}

/* ─────────────────────────── The backend case, in IndexedDB ──────────────────────── */

/**
 * Where `SandboxCaseFiling` keeps each backend case. A database of its own, so
 * adding it left the drafts database at its version: another branch that still opens
 * `dristi-efiling` at version 1 keeps working.
 */
const CASES_DB_NAME = "dristi-efiling-cases";
const CASES_DB_VERSION = 1;

interface CasesDB extends DBSchema {
  cases: {
    key: string;
    value: SandboxCase;
  };
}

let casesDbPromise: Promise<IDBPDatabase<CasesDB>> | null = null;

function casesDb(): Promise<IDBPDatabase<CasesDB>> {
  if (!casesDbPromise) {
    casesDbPromise = openDB<CasesDB>(CASES_DB_NAME, CASES_DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("cases", { keyPath: "caseId" });
      },
    });
  }
  return casesDbPromise;
}

const indexedDbCaseStore: CaseStore = {
  async get(caseId) {
    return (await casesDb()).get("cases", caseId);
  },
  async put(record) {
    await (await casesDb()).put("cases", record);
  },
  async list() {
    return (await casesDb()).getAll("cases");
  },
};

/** The signed-in person, for a party added as `self`; unknown when the session is not. */
async function currentAccount(): Promise<SandboxAccount> {
  const account = await getAuthService().getCurrentAccount();
  return { name: account.name ?? "", mobile: account.mobile };
}

/** The backend case, answered in this browser. Cases survive a reload, like their drafts. */
export class IndexedDbCaseFilingRepository extends SandboxCaseFiling {
  constructor() {
    super(indexedDbCaseStore, currentAccount);
  }
}
