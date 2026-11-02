/**
 * Blank factories for the e-filing draft.
 *
 * A new filing starts empty: one complainant, one advocate, one accused, one cheque with
 * its notice, one witness row, and the intake slots those imply. Nothing is pre-typed —
 * values arrive from what the person uploads (document reading) or types.
 */

import { withoutComplainant } from "./advocates";
import { newId } from "./data";
import {
  AFFIDAVIT_PIP_TEMPLATE,
  DELIVERY_CHANNEL,
  FINAL_RELIEF_TEMPLATE,
  INTERIM_RELIEF_TEMPLATE,
} from "./options";
import { documentGroupForParty, intakeSlots, resolveIntakeSlot } from "./selectors";
import { WALK_ORDER } from "./steps";
import type {
  Accused,
  Address,
  AdrPrayer,
  AddressBlock,
  Advocate,
  CaseDocument,
  ChequeDetails,
  Complainant,
  Contact,
  DemandNotice,
  DocumentGroup,
  FilingDraft,
  IntakeDocType,
  IntakeGroup,
  IntakeSlot,
  Jurisdiction,
  SignInstrument,
  UserProfile,
  Representative,
  Witness,
} from "./types";

/** Row ids for repeatable things (parties, cheques, documents…). */
export function uid(prefix = "id"): string {
  return newId(prefix);
}

/* ───────────────────────────── Blank factories ─────────────────────── */

export const blankAddress = (): Address => ({
  line1: "",
  city: "",
  pin: "",
  district: "",
  state: "",
});

export const blankContact = (): Contact => ({ mobile: "", email: "" });

/** A person summoned for an entity — the accused entity's own, or a complainant's. */
export const blankRepresentative = (): Representative => ({
  mobile: "",
  name: "",
  age: "",
  designation: "",
  email: "",
  addr: blankAddress(),
  gender: "",
  differentlyAbled: "",
});

export const blankAddressBlock = (): AddressBlock => ({
  addr: blankAddress(),
  police: "",
});

export function blankComplainant(): Complainant {
  return {
    id: uid("cp"),
    pip: "no",
    type: "individual",
    mobile: "",
    verified: false,
    fetched: false,
    name: "",
    age: "",
    gender: "",
    differentlyAbled: "",
    email: "",
    res: blankAddress(),
    permSame: "yes",
    perm: blankAddress(),
    poa: "no",
    poaHolder: {
      mobile: "",
      name: "",
      age: "",
      res: blankAddress(),
      permSame: "yes",
      perm: blankAddress(),
    },
    entType: "",
    entName: "",
    entCinPan: "",
    entCinPanSkippedAt: null,
    entPhone: "",
    entEmail: "",
    entAddr: blankAddress(),
    rep: blankRepresentative(),
    affidavit: AFFIDAVIT_PIP_TEMPLATE,
  };
}

/** A litigant filing is the first complainant, so it starts with their account's name and contact. */
function firstComplainant(profile?: UserProfile | null): Complainant {
  const c = blankComplainant();
  if (profile?.role !== "LITIGANT") return c;
  c.name = profile.name;
  c.mobile = profile.mobile;
  c.email = profile.email;
  return c;
}

export const blankAdvocate =(profile?: UserProfile | null): Advocate => {
  // Only an advocate filing their own case is the advocate; anyone else's name would be wrong here.
  const self = profile?.role === "ADVOCATE" ? profile : null;
  return {
    id: uid("adv"),
    forComplainants: [0],
    barNumber: self?.barNumber ?? "",
    name: self?.name ?? "",
  };
};

export const blankAccused = (): Accused => ({
  id: uid("acc"),
  type: "individual",
  name: "",
  entType: "",
  contacts: [blankContact()],
  reps: [blankRepresentative()],
  addresses: [blankAddressBlock()],
  jurisdiction: "yes",
});

export const blankCheque = (): ChequeDetails => ({
  id: uid("chq"),
  dateOnCheque: "",
  amount: "",
  chequeNumber: "",
  sameAsPrev: "no",
  ifsc: "",
  bankName: "",
  bankBranch: "",
  presentDate: "",
  returnDate: "",
  returnReason: "",
  ifscFetched: false,
});

export const blankNotice = (): DemandNotice => ({
  id: uid("dn"),
  natureDebt: "",
  dispatchDate: "",
  modeService: "",
  tracking: "",
  delivered: "yes",
  deliveryDate: "",
  replied: "no",
  returnDate: "",
  nonDeliveryReason: "",
  paymentStatus: "",
  partAmount: "",
});

export const blankJurisdiction = (): Jurisdiction => ({
  deposited: "yes",
  ifsc: "",
  payeeBankName: "",
  payeeBankBranch: "",
  payeeFetched: false,
  payeePolice: "",
  drawerPolice: "",
  otherPending: "no",
  otherCases: [{ court: "", caseNumber: "" }],
  causeDate: "",
  filingDate: "",
  condonationReason: "",
});

export const blankWitness = (): Witness => ({
  id: uid("wit"),
  fullName: "",
  designation: "",
  age: "",
  prove: "",
  contacts: [blankContact()],
  addresses: [blankAddressBlock()],
});

/* ───────────────────────────── Intake groups ───────────────────────── */

/** The two documents every cheque needs (`DCM-1`, `DCM-2`). */
export function intakeChequeGroup(n: number): IntakeGroup {
  return {
    n,
    slots: [
      {
        key: `c${n}f`,
        docType: "cheque-front",
        label: "Cheque (front side)",
        desc: "The bounced cheque, front side. A photo or scan.",
        required: true,
        file: null,
      },
      {
        key: `c${n}m`,
        docType: "return-memo",
        label: "Cheque return memo",
        desc: "The memo the bank issued when this cheque bounced.",
        required: true,
        file: null,
      },
    ],
  };
}

/** The documents every demand notice needs, plus the optional reply (`DCM-3`…`DCM-6`). */
export function intakeNoticeGroup(n: number): IntakeGroup {
  return {
    n,
    slots: [
      {
        key: `n${n}dn`,
        docType: "demand-notice",
        label: "Demand notice",
        desc: "The statutory demand notice sent to the accused.",
        required: true,
        file: null,
      },
      {
        key: `n${n}dp`,
        docType: "dispatch-proof",
        label: "Proof of dispatch of demand notice (postal receipt)",
        desc: "Speed post / RPAD receipt showing dispatch.",
        required: true,
        file: null,
      },
      {
        key: `n${n}ad`,
        docType: "delivery-proof",
        label: "Proof of delivery of demand notice (AD card)",
        desc: "Acknowledgement-due card or tracking proof of delivery.",
        required: true,
        file: null,
      },
      {
        key: `n${n}rp`,
        docType: "notice-reply",
        label: "Reply to the demand notice",
        desc: "The accused's reply to the notice, if any.",
        required: false,
        file: null,
      },
    ],
  };
}

/**
 * Keep the cheques, notices and complainants the form holds and the upload groups that
 * hold their documents the same in number — every upload-step party is a complainant.
 * Either side can add one — the Cheque step's "Add cheque", the upload step's "Add
 * another cheque" — and the list of documents is built from the upload groups, so a
 * cheque added on the form would otherwise never be asked for. Group `i` is record `i`.
 * Grows the shorter side only; removal is done by whoever removes, on both sides
 * (`removeCaseRecord`). A side with no upload groups at all (a bulk setup) is left alone.
 */
export function syncIntakeCounts(draft: FilingDraft): void {
  const taken = new Set(
    [...draft.intake.cheques, ...draft.intake.notices, ...draft.intake.parties]
      .flatMap((g) => g.slots)
      .map((s) => s.key)
  );
  const grow = (groups: IntakeGroup[], records: unknown[], make: (n: number) => IntakeGroup, blank: () => unknown) => {
    if (groups.length === 0) return;
    while (groups.length < records.length) {
      const group = make(groups.length + 1);
      group.slots = uniqueSlotKeys(group.slots, taken);
      groups.push(group);
    }
    while (records.length < groups.length) records.push(blank());
  };
  grow(draft.intake.cheques, draft.cheques, intakeChequeGroup, blankCheque);
  grow(draft.intake.notices, draft.notices, intakeNoticeGroup, blankNotice);
  grow(draft.intake.parties, draft.complainants, intakePartyGroup, blankComplainant);
}

/** A form record with an upload group of its own: group `i` holds record `i`'s documents. */
export type CaseRecordKind = "cheque" | "notice" | "party";

function groupsOf(draft: Pick<FilingDraft, "intake">, kind: CaseRecordKind): IntakeGroup[] {
  if (kind === "cheque") return draft.intake.cheques;
  return kind === "notice" ? draft.intake.notices : draft.intake.parties;
}

/** The form's records of a kind: its cheques, notices or complainants. */
export function caseRecords(
  draft: Pick<FilingDraft, "cheques" | "notices" | "complainants">,
  kind: CaseRecordKind
): unknown[] {
  if (kind === "cheque") return draft.cheques;
  return kind === "notice" ? draft.notices : draft.complainants;
}

/**
 * The upload group `removeCaseRecord` would take with record `index` — the last one
 * always stays — so the caller can discard its files first.
 */
export function caseRecordGroup(
  draft: Pick<FilingDraft, "intake">,
  kind: CaseRecordKind,
  index: number
): IntakeGroup | undefined {
  const groups = groupsOf(draft, kind);
  return groups.length > 1 ? groups[index] : undefined;
}

/**
 * Remove cheque, notice or complainant `index` (0-based) from the form and its upload
 * group with it, renumbering the groups after it. Discard the group's files first
 * (`caseRecordGroup`); a complainant is taken off the case by the caller.
 */
export function removeCaseRecord(draft: FilingDraft, kind: CaseRecordKind, index: number): void {
  const records = caseRecords(draft, kind);
  const groups = groupsOf(draft, kind);
  if (records.length > 1 && index < records.length) {
    records.splice(index, 1);
    // Advocates name their clients by complainant index.
    if (kind === "party") withoutComplainant(draft.advocates, index);
  }
  if (!caseRecordGroup(draft, kind, index)) return;
  groups.splice(index, 1);
  groups.forEach((g, i) => {
    g.n = i + 1;
  });
}

/** Why a file whose upload a reload cut short is listed as not saved. */
export const UPLOAD_INTERRUPTED = "Saving this file was interrupted. Try again.";

/**
 * An upload in flight when the page closed never finishes, but `syncing` was saved with
 * the draft — left set, the file would never be retried or listed as unsaved. A loaded
 * draft has nothing in flight, so each such file becomes one to try again.
 */
export function settleInterruptedUploads(draft: Pick<FilingDraft, "intake" | "documents">): void {
  const custom = draft.documents.flatMap((g) => g.docs.filter((d) => d.custom));
  for (const record of [...intakeSlots(draft.intake), ...custom]) {
    if (!record.syncing) continue;
    record.syncing = false;
    if (!record.caseDocumentId) record.syncError ??= UPLOAD_INTERRUPTED;
  }
}

/**
 * Keep slot keys unique. The factories derive keys from the group number, so adding a
 * group after a removal can otherwise reuse a key that is still on the draft.
 */
export function uniqueSlotKeys(slots: IntakeSlot[], taken: Set<string>): IntakeSlot[] {
  return slots.map((slot) => {
    let key = slot.key;
    let suffix = 2;
    while (taken.has(key)) {
      key = `${slot.key}-${suffix}`;
      suffix += 1;
    }
    taken.add(key);
    return key === slot.key ? slot : { ...slot, key };
  });
}

export function intakePartyGroup(n: number): IntakeGroup {
  return {
    n,
    slots: [
      {
        key: `p${n}id`,
        docType: "id-proof",
        label: "Identity proof (complainant)",
        desc: "PAN, Aadhaar, Passport, Driving licence, Voter ID, Ration card or Bank passbook.",
        required: true,
        file: null,
      },
      {
        key: `p${n}poa`,
        docType: "poa",
        label: "Power of attorney",
        desc: "If the complaint is filed through a PoA holder.",
        required: false,
        file: null,
      },
      {
        key: `p${n}vak`,
        docType: "vakalatnama",
        label: "Vakalatnama",
        desc: "Signed authorisation appointing the complainant's advocate(s).",
        required: true,
        file: null,
      },
    ],
  };
}

export function intakeOtherPartyDoc(partyN: number, index: number): IntakeSlot {
  return {
    key: `p${partyN}x${index}`,
    docType: "other",
    label: "Other document",
    desc: "Any additional document for this party.",
    required: false,
    file: null,
  };
}

export function intakeSupporting(): IntakeSlot[] {
  return [
    {
      key: "sl",
      docType: "supporting",
      label: "Loan agreement / invoice / ledger",
      desc: "Anything that records the debt, if available.",
      required: false,
      file: null,
    },
  ];
}

/* ───────────────────────────── List of documents ───────────────────── */

type DocSpec = {
  name: string;
  required: boolean;
  intakeKey?: string;
};

function docRow(spec: DocSpec, existing: CaseDocument | undefined, slot?: IntakeSlot): CaseDocument {
  const mirrored = spec.intakeKey ? slot ?? null : null;
  return {
    id: existing?.id ?? uid("doc"),
    name: spec.name,
    required: spec.required,
    // Rows that mirror an intake slot always show that slot's file; others keep their own.
    file: mirrored ? mirrored.file : existing?.file ?? null,
    quality: mirrored ? (mirrored.file ? "good" : null) : existing?.quality ?? null,
    digital: existing?.digital ?? false,
    intakeKey: spec.intakeKey,
    custom: false,
  };
}

/**
 * The "List of documents" step, derived from the case: one row per document each cheque
 * and party needs, mirroring what intake already holds. Existing rows keep their id,
 * digital flag and any file uploaded on that step; custom rows the person added are kept.
 */
export function buildDocumentGroups(draft: FilingDraft): DocumentGroup[] {
  const resolveSlot = (key?: string) => (key ? resolveIntakeSlot(draft.intake, key) : undefined);
  const prevGroups = new Map(draft.documents.map((g) => [g.id, g]));
  const findExisting = (g: DocumentGroup | undefined, spec: DocSpec) => {
    if (!g) return undefined;
    return (
      (spec.intakeKey && g.docs.find((d) => d.intakeKey === spec.intakeKey)) ||
      g.docs.find((d) => !d.custom && d.name === spec.name)
    );
  };
  const customOf = (g: DocumentGroup | undefined) => g?.docs.filter((d) => d.custom) ?? [];
  /*
   * The group's own slot for a document. Keys are not rebuilt from the group number: a
   * removal renumbers the groups after it but keeps their keys, so "Cheque 1" after
   * removing the first cheque holds `c2f`.
   */
  const keyIn = (group: IntakeGroup | undefined, docType: IntakeDocType) =>
    group?.slots.find((s) => s.docType === docType)?.key;

  const groups: DocumentGroup[] = [];

  // Case details — per cheque, then per demand notice (`DCM-1`…`DCM-6`).
  const manyCheques = draft.intake.cheques.length > 1;
  const manyNotices = draft.intake.notices.length > 1;
  const caseSpecs: DocSpec[] = [
    ...draft.intake.cheques.flatMap((g) => {
      const sfx = manyCheques ? ` ${g.n}` : "";
      return [
        { name: `Cheque${sfx}`, required: true, intakeKey: keyIn(g, "cheque-front") },
        { name: `Cheque return memo${sfx}`, required: true, intakeKey: keyIn(g, "return-memo") },
      ];
    }),
    ...draft.intake.notices.flatMap((g) => {
      const sfx = manyNotices ? ` ${g.n}` : "";
      return [
        { name: `Demand notice${sfx}`, required: true, intakeKey: keyIn(g, "demand-notice") },
        { name: `Proof of dispatch of demand notice (postal receipt)${sfx}`, required: true, intakeKey: keyIn(g, "dispatch-proof") },
        { name: `Proof of delivery of demand notice (AD card)${sfx}`, required: true, intakeKey: keyIn(g, "delivery-proof") },
        { name: `Reply to the demand notice${sfx}`, required: false, intakeKey: keyIn(g, "notice-reply") },
      ];
    }),
  ];
  const prevCase = prevGroups.get("case");
  groups.push({
    id: "case",
    title: "Case details",
    docs: [
      ...caseSpecs.map((s) => docRow(s, findExisting(prevCase, s), resolveSlot(s.intakeKey))),
      ...customOf(prevCase),
    ],
  });

  // One group per complainant, with the documents of the upload group in its place.
  draft.complainants.forEach((c, i) => {
    const n = i + 1;
    const id = `complainant-${n}`;
    const party = draft.intake.parties[i];
    /*
     * Rows, ticks and custom rows follow the complainant, not the position: after
     * complainant 1 is removed, complainant 2's group is found by their slot keys. Only a
     * draft without upload groups (a bulk setup) falls back to the id.
     */
    const prev = party ? documentGroupForParty(draft.documents, party) : prevGroups.get(id);
    const specs: DocSpec[] = [
      { name: "Identity proof: complainant", required: true, intakeKey: keyIn(party, "id-proof") },
      { name: "Power of attorney", required: c.poa === "yes", intakeKey: keyIn(party, "poa") },
      { name: "Vakalatnama", required: c.pip !== "yes", intakeKey: keyIn(party, "vakalatnama") },
    ];
    groups.push({
      id,
      title: `Complainant ${n}: documents`,
      docs: [
        ...specs.map((s) => docRow(s, findExisting(prev, s), resolveSlot(s.intakeKey))),
        ...customOf(prev),
      ],
    });
  });

  /*
   * The accused used to get a group of their own, listing an identity proof, a power of
   * attorney and a Vakalatnama. None of those are the complainant's to file — you do not
   * hold the ID of the person you are suing, and their advocate is not on record yet. The
   * group asked for documents nobody could produce, so it is gone (owner, 2026-08-19).
   */

  return groups;
}

/* ───────────────────────────── Blank draft ─────────────────────────── */

export function createBlankDraft(id: string, profile?: UserProfile | null): FilingDraft {
  const now = new Date().toISOString();
  const draft: FilingDraft = {
    version: 7,
    id,
    caseType: "s138",
    status: "draft",
    lastStep: "upload",
    visited: [],
    intake: {
      cheques: [intakeChequeGroup(1)],
      notices: [intakeNoticeGroup(1)],
      parties: [intakePartyGroup(1)],
      supporting: intakeSupporting(),
    },
    complainants: [firstComplainant(profile)],
    advocates: [blankAdvocate(profile)],
    accused: [blankAccused()],
    cheques: [blankCheque()],
    notices: [blankNotice()],
    jurisdiction: blankJurisdiction(),
    adr: blankAdr(),
    witnesses: [blankWitness()],
    affidavit: "",
    documents: [],
    sign: {
      mode: "digital",
      requestedAt: null,
      notified: {},
      signed: {},
      signedCopy: null,
      paperFallback: null,
      confirmed: {},
      deliveryChannel: DELIVERY_CHANNEL,
      process: {},
      oaths: {},
      paid: false,
      paidAt: null,
      paidAmount: null,
      paymentRef: null,
      caseFileNumber: null,
    },
    dismissed: {
      advocateInfo: false,
      accusedAddress: false,
    },
    createdAt: now,
    updatedAt: now,
    filedAt: null,
  };
  draft.documents = buildDocumentGroups(draft);
  return draft;
}

/* ───────────────────────────── Migration ───────────────────────────── */

/** Accused kinds that used to be one flat list, mapped onto the pair that replaced it. */
const LEGACY_ACCUSED_ENTITY: Record<string, string> = {
  proprietorship: "proprietorship",
  partnership: "partnership",
  company: "private-limited",
  other: "other",
};

/**
 * The ADR block under the name a sibling branch gave it.
 *
 * `feature/settlement-options` renamed `adr` to `settlement` (willing / otherDetails /
 * interimRelief / finalRelief, plus the offer ladder) and deleted `adr` outright. Both
 * lineages write to the same IndexedDB on the same origin, and both bumped `version`
 * independently — settlement to 4, this one to 5 — so the number cannot tell them apart.
 * A draft written over there is read back here, and the prayer text the filer typed is
 * still in it under the other name.
 */
type SettlementShaped = {
  willing?: AdrPrayer["adr"];
  otherDetails?: string;
  interimRelief?: string;
  finalRelief?: string;
};

/** The ADR block as it stands when nothing on disk has one. */
const blankAdr = (): AdrPrayer => ({
  adr: "yes",
  otherDetails: "",
  interimRelief: INTERIM_RELIEF_TEMPLATE,
  finalRelief: FINAL_RELIEF_TEMPLATE,
});

/**
 * Bring a stored draft up to the current shape.
 *
 * Drafts live in the browser, so a person who was mid-filing when the form changed still
 * has the old one on disk. Fields that were dropped are simply ignored; the accused's
 * kind is the one value that moved, so it is carried across rather than reset to
 * "Individual" — silently changing who someone is suing would be worse than any of this.
 *
 * Every block is defaulted before it is read. A draft can reach this function from a
 * branch this one has never seen — the settlement rename is the case that actually
 * happened — and a missing block used to throw somewhere deep in a selector, which took
 * the whole filings screen down over one unreadable row. Ignorance of a field is
 * survivable; a blank screen is not.
 */
export function migrateDraft(draft: FilingDraft): FilingDraft {
  migrateAdr(draft);

  // migrateAdr moves the one renamed id this branch knows to carry across
  // ("settlement"); a step dropped or renamed some other way — the next one will not
  // be predictable either — otherwise survives on the draft as an id this branch's
  // router cannot resolve, and `getStep` throws over it deep inside the queue list.
  // Reopening onto the first screen is a smaller loss than that.
  // Oath stopped being a step of its own: it is taken during signing now. A draft left
  // there reopens on the screen that used to come after it.
  if ((draft.lastStep as string) === "oath") draft.lastStep = "affidavit";
  if (!WALK_ORDER.includes(draft.lastStep)) draft.lastStep = "upload";

  draft.intake ??= {
    cheques: [intakeChequeGroup(1)],
    notices: [intakeNoticeGroup(1)],
    parties: [intakePartyGroup(1)],
    supporting: intakeSupporting(),
  };
  migrateNoticeIntake(draft);
  draft.complainants ??= [blankComplainant()];
  draft.advocates ??= [blankAdvocate()];
  draft.accused ??= [blankAccused()];
  draft.cheques ??= [blankCheque()];
  draft.notices ??= [blankNotice()];
  draft.jurisdiction ??= blankJurisdiction();
  draft.witnesses ??= [blankWitness()];
  draft.documents ??= [];
  settleInterruptedUploads(draft);
  // Cheques, notices and complainants added on one side never reached the other before
  // they were kept in step; give such a draft the groups (and records) it is missing.
  const groupCount = () =>
    draft.intake.cheques.length + draft.intake.notices.length + draft.intake.parties.length;
  const groupsBefore = groupCount();
  const complainantsBefore = draft.complainants.length;
  syncIntakeCounts(draft);
  if (groupCount() !== groupsBefore || draft.complainants.length !== complainantsBefore)
    draft.documents = buildDocumentGroups(draft);
  draft.sign ??= {
    mode: "digital",
    requestedAt: null,
    notified: {},
    signed: {},
    signedCopy: null,
    paperFallback: null,
    confirmed: {},
    deliveryChannel: DELIVERY_CHANNEL,
    process: {},
    oaths: {},
    paid: false,
    paidAt: null,
    paidAmount: null,
    paymentRef: null,
    caseFileNumber: null,
  };
  draft.dismissed ??= { advocateInfo: false, accusedAddress: false };

  for (const a of draft.accused as (Accused & { type: string })[]) {
    if (a.type === "individual" || a.type === "institution") {
      a.entType ??= "";
    } else {
      a.entType = a.entType || LEGACY_ACCUSED_ENTITY[a.type] || "other";
      a.type = "institution";
    }
    a.reps ??= [blankRepresentative()];
    for (const r of a.reps) {
      r.designation ??= "";
      r.gender ??= "";
      r.differentlyAbled ??= "";
    }
  }
  for (const c of draft.complainants) {
    c.fetched ??= false;
    c.rep.designation ??= "";
    c.gender ??= "";
    c.differentlyAbled ??= "";
    c.rep.gender ??= "";
    c.rep.differentlyAbled ??= "";
    // The oath was a form field once; it is recorded during signing now (`OTH-3`).
    delete (c as Complainant & { oathVideo?: unknown }).oathVideo;
    c.entCinPan ??= "";
    c.entCinPanSkippedAt ??= null;
  }
  // "Why was the cheque issued?" was a prototype-only question that the nature of the
  // debt already answers (LDN-1); it was retired.
  for (const n of draft.notices) {
    delete (n as DemandNotice & { whyIssued?: unknown }).whyIssued;
  }
  // The upfront choice used to be one set of rounds for the whole case; it is now made
  // per accused (§19.3). Nothing is carried across: an old draft's single choice cannot
  // say which accused it was for, and the defaults it falls back to are the court's.
  draft.sign.process ??= {};
  draft.sign.oaths ??= {};
  // Advocates took an oath in an earlier build; only a complainant's slot carries one
  // now (`OTH-3`), so an advocate's leftover recording is dropped.
  for (const id of Object.keys(draft.sign.oaths)) {
    if (id.startsWith("sig-a-")) delete draft.sign.oaths[id];
  }
  draft.sign.paidAmount ??= null;
  draft.affidavit ??= "";
  // Phone confirmation on the upload path is newer than these drafts.
  draft.sign.confirmed ??= {};
  // So is the confirmation that e-signing could not be used. An older paper draft has
  // none, and none is invented for it: the window asks before the upload reopens.
  draft.sign.paperFallback ??= null;
  migrateSignMode(draft);
  migrateAdvocateSignatures(draft);
  draft.version = 7;
  return draft;
}

/**
 * Give the demand notices their own intake groups.
 *
 * Each cheque's group used to carry a demand notice and its proofs, which asked a filer
 * with three cheques and one notice for three notices. The documents table counts them
 * apart (`DCM-1`/`DCM-2` per cheque, `DCM-3`…`DCM-6` per notice), so an older draft's
 * notice slots move to notice group n, keeping their files and reads, and their keys go
 * from `c<n>…` to `n<n>…` — on the list of documents too, which points at them by key.
 */
const OLD_NOTICE_KEY = /^c(\d+)(dn|dp|ad|rp)(-\d+)?$/;

function migrateNoticeIntake(draft: FilingDraft) {
  if (draft.intake.notices) return;
  const rekey = (key: string) => key.replace(OLD_NOTICE_KEY, "n$1$2$3");
  draft.intake.notices = draft.intake.cheques.map((g) => {
    const moved = g.slots.filter((s) => OLD_NOTICE_KEY.test(s.key));
    g.slots = g.slots.filter((s) => !OLD_NOTICE_KEY.test(s.key));
    return {
      n: g.n,
      slots: moved.length
        ? moved.map((s) => ({ ...s, key: rekey(s.key) }))
        : intakeNoticeGroup(g.n).slots,
    };
  });
  // A setup draft holds no cheques, and so no notices; a filing always has one.
  if (draft.intake.notices.length === 0 && draft.intake.cheques.length > 0)
    draft.intake.notices = [intakeNoticeGroup(1)];
  for (const group of draft.documents ?? [])
    for (const doc of group.docs) if (doc.intakeKey) doc.intakeKey = rekey(doc.intakeKey);
}

/**
 * Bring a draft's signing block up to the two-level model.
 *
 * Signing used to be one flat choice — `esign` | `dsc` | `upload` — recorded only once
 * somebody had signed, which left the system with no idea how a complaint was going to
 * be signed until it already had been. It is now a decision about the filing (`digital`
 * or `upload`, presumed digital) plus, per signature, the instrument that made it. An
 * older draft's `esign` and `dsc` were both digital signing; a bare `true` against a
 * signatory says a signature exists without saying what made it, so it keeps the mode's
 * own instrument and no timestamp it cannot vouch for.
 */
function migrateSignMode(draft: FilingDraft) {
  const sign = draft.sign as unknown as {
    mode: string | null;
    requestedAt?: string | null;
    notified?: Record<string, string>;
    signed: Record<string, unknown>;
  };

  const legacy = sign.mode;
  const upload = legacy === "upload";
  sign.mode = upload ? "upload" : "digital";
  sign.notified ??= {};

  const was: SignInstrument = upload ? "paper" : legacy === "dsc" ? "dsc" : "aadhaar";
  for (const [id, value] of Object.entries(sign.signed ?? {})) {
    if (value === true) sign.signed[id] = { at: "", with: was };
    else if (!value) delete sign.signed[id];
  }

  /*
   * A draft that already carries signatures was, by definition, sent for signature —
   * there is no other way those could exist. Nothing is known about when, and inventing
   * a time would put a fact in the record that never happened, so it takes the draft's
   * own last-saved time.
   */
  if (sign.requestedAt === undefined) {
    sign.requestedAt = Object.keys(sign.signed ?? {}).length ? draft.updatedAt : null;
  }
}

/**
 * Give the draft its `adr` block back, whatever shape it arrived in.
 *
 * A draft last written by the settlement lineage carries the same four answers under
 * `settlement`, so they are moved across rather than replaced with the templates — the
 * prayer especially, which the filer may have rewritten line by line. `settlement` is
 * left on the object untouched: this branch does not read it, and deleting it would
 * throw away the offer ladder if the draft goes back to that branch.
 */
function migrateAdr(draft: FilingDraft) {
  if (draft.adr) {
    const a = draft.adr;
    a.adr ??= "yes";
    a.otherDetails ??= "";
    a.interimRelief ??= INTERIM_RELIEF_TEMPLATE;
    a.finalRelief ??= FINAL_RELIEF_TEMPLATE;
    return;
  }

  const settlement = (draft as unknown as { settlement?: SettlementShaped }).settlement;
  draft.adr = settlement
    ? {
        adr: settlement.willing ?? "yes",
        otherDetails: settlement.otherDetails ?? "",
        interimRelief: settlement.interimRelief ?? INTERIM_RELIEF_TEMPLATE,
        finalRelief: settlement.finalRelief ?? FINAL_RELIEF_TEMPLATE,
      }
    : blankAdr();

  /* The step it was last on may be an id this branch's router does not have. */
  if ((draft.lastStep as string) === "settlement") draft.lastStep = "adr-prayer";
}

/**
 * Outside Gujarat an advocate signs in one slot per complainant (`sig-a-<complainant
 * id>`); in Gujarat every advocate signs as themselves (`sig-a-<advocate id>`, owner
 * 2026-10-09). What a slot recorded is copied to each advocate who was on record for
 * that complainant, and the slot keeps it too, so a draft reads right under either rule.
 */
function migrateAdvocateSignatures(draft: FilingDraft) {
  const maps = [draft.sign.signed, draft.sign.oaths, draft.sign.notified] as Record<
    string,
    unknown
  >[];
  draft.complainants.forEach((c, i) => {
    const old = `sig-a-${c.id}`;
    const acting = draft.advocates.filter((a) => a.forComplainants.includes(i));
    for (const map of maps) {
      if (!map || !(old in map)) continue;
      // Kept as well: outside Gujarat advocates still sign in the per-complainant slot.
      for (const a of acting) map[`sig-a-${a.id}`] ??= map[old];
    }
  });
}
