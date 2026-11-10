/**
 * Complainants, accused and witnesses as the backend case holds them.
 *
 * The form and the backend cut a party differently, so this file is where they meet:
 *
 *   - The backend takes lists of mobile numbers, emails and addresses, the first of each
 *     the primary. An institution's own go inside `institution`; the lists outside it are
 *     the person's — the individual, or the one acting for the institution.
 *   - An institution accused is saved once per person summoned for it (S-141): each is a
 *     person for the institution, with their designation.
 *   - Who a party is (person or institution, the filer or not — and for the people
 *     summoned for one institution, their name) cannot be changed on the backend. A
 *     change there removes the participant and adds it again, which puts it last in its
 *     role; any other change is a PATCH of the case's copy.
 *   - A PATCH carrying `institution` re-links the participant to the institution its PAN or
 *     CIN names, creating one when there is none, so it is sent only when the company
 *     itself changed; its contacts are changed through `institution_contacts`.
 *
 * Pure apart from the API it is handed, so it is tested without rendering the form.
 */

import { isApiError } from "@/lib/api";
import { isIndianMobile, toBackendMobile, toNationalMobile } from "@/lib/auth/mobile";

import type {
  AddressInput,
  CaseFilingApi,
  ContactLists,
  InstitutionInput,
  ParticipantPatch,
  PartyInput,
  PartyRole,
  PersonInput,
  PoaHolderInput,
  WitnessInput,
} from "./data/cases-api";
import { ENTITY_TYPE_CODES, GENDER_CODES } from "./options";
import { accusedContactUnknownDeclared, isCinOrPan, normaliseCinPan } from "./selectors";
import type {
  Accused,
  Address,
  AddressBlock,
  Complainant,
  DifferentlyAbled,
  Gender,
  Representative,
  SavedParty,
  SavedPoaHolder,
  UserProfile,
  Witness,
} from "./types";

export type AnyPartyInput = PartyInput | WitnessInput;

/* ─────────────────────────────────── Fields ─────────────────────────────────────── */

/** Drop empty values, so a body carries only what was entered. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== "")
  ) as T;
}

/** An Indian mobile in the backend's E.164, however it was typed; anything else as typed. */
function phone(value: string): string | undefined {
  const national = toNationalMobile(value);
  if (isIndianMobile(national)) return toBackendMobile(national);
  return value.trim() || undefined;
}

function age(value: string): number | undefined {
  const v = value.trim();
  return /^\d+$/.test(v) ? Number(v) : undefined;
}

function gender(value: Gender): PersonInput["gender"] {
  return value ? (GENDER_CODES[value] as PersonInput["gender"]) : undefined;
}

function disability(value: DifferentlyAbled): boolean | undefined {
  return value ? value === "yes" : undefined;
}

function hasAddress(addr: Address): boolean {
  return Object.values(addr).some((v) => v.trim());
}

function address(addr: Address, police?: string): Partial<AddressInput> {
  return compact({
    line1: addr.line1.trim(),
    city: addr.city.trim(),
    pincode: addr.pin.trim(),
    district: addr.district.trim(),
    state: addr.state.trim(),
    police_station: police?.trim(),
  });
}

function addressBlock(block: AddressBlock): Partial<AddressInput> {
  return address(block.addr, block.police);
}

/**
 * A complainant institution's PAN or CIN, or the declaration skipping it (`LIT-18a`). A
 * half-typed number is not sent: `missingFields` holds the party back until it is whole.
 */
function cinPan(
  c: Pick<Complainant, "entCinPan" | "entCinPanSkippedAt">
): Pick<InstitutionInput, "pan" | "cin" | "pan_cin_skip_declared"> {
  if (c.entCinPanSkippedAt) return { pan_cin_skip_declared: true };
  const v = normaliseCinPan(c.entCinPan);
  if (!isCinOrPan(v)) return {};
  return v.length === 10 ? { pan: v } : { cin: v };
}

/**
 * Does editor output show any text? An empty editor still emits markup (`<p><br></p>`,
 * `<p>&nbsp;</p>`), which the backend refuses as blank.
 */
function hasVisibleText(html: string): boolean {
  return !!html
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|#160|#xa0);/gi, " ")
    .trim();
}

/** A complainant appearing in person files the affidavit for it; anyone else files none. */
function affidavit(
  c: Pick<Complainant, "pip" | "affidavit">
): Pick<PartyInput, "party_in_person_affidavit"> {
  return c.pip === "yes" && hasVisibleText(c.affidavit)
    ? { party_in_person_affidavit: c.affidavit }
    : {};
}

function representative(rep: Representative): PersonInput {
  return compact({
    name: rep.name.trim(),
    age: age(rep.age),
    gender: gender(rep.gender),
    disability_status: disability(rep.differentlyAbled),
  });
}

/** Each value once, in order, blanks dropped; the backend refuses a repeat (E07033). */
function unique(values: Array<string | undefined>, key = (v: string) => v): string[] {
  const seen = new Set<string>();
  return values.filter((v): v is string => {
    if (!v || seen.has(key(v))) return false;
    seen.add(key(v));
    return true;
  });
}

/** Contact lists as the backend takes them, primary first; an empty list is left out. */
function contactLists(
  mobiles: Array<string | undefined>,
  emails: Array<string | undefined>,
  addresses: Partial<AddressInput>[]
): ContactLists {
  const mobile_numbers = unique(mobiles);
  const email_addresses = unique(emails, (e) => e.toLowerCase());
  return {
    ...(mobile_numbers.length ? { mobile_numbers } : {}),
    ...(email_addresses.length ? { email_addresses } : {}),
    ...(addresses.length ? { addresses } : {}),
  };
}

/** The addresses filled in at all, in the form's order; a part-filled one is checked later. */
function addressBlocks(blocks: AddressBlock[]): Partial<AddressInput>[] {
  return blocks.filter((b) => hasAddress(b.addr)).map(addressBlock);
}

/* ───────────────────────────────── Complainant ──────────────────────────────────── */

/**
 * The complainant who is the signed-in litigant: an individual on their account's own
 * mobile. Only the first, since the backend refuses the same person as complainant twice.
 */
export function selfComplainantId(
  complainants: Complainant[],
  profile: UserProfile | null
): string | undefined {
  if (profile?.role !== "LITIGANT") return undefined;
  return complainants.find((c) => c.type === "individual" && isAccountMobile(c.mobile, profile))
    ?.id;
}

export function complainantBodies(c: Complainant, isSelf = false): PartyInput[] {
  const is_party_in_person = c.pip === "yes";

  if (c.type === "institution") {
    const person = c.rep.name.trim() ? representative(c.rep) : undefined;
    return [
      compact({
        institution: compact({
          entity_type: ENTITY_TYPE_CODES[c.entType],
          entity_name: c.entName.trim(),
          ...cinPan(c),
          // A company's number may be a landline, so it is sent as typed.
          ...contactLists([c.entPhone.trim()], [c.entEmail.trim()], [address(c.entAddr)]),
        }),
        person,
        designation: person ? c.rep.designation.trim() : undefined,
        // The representative's own; an institution with nobody acting for it sends none.
        ...(person
          ? contactLists(
              [phone(c.rep.mobile)],
              [c.rep.email.trim()],
              hasAddress(c.rep.addr) ? [address(c.rep.addr)] : []
            )
          : {}),
        is_party_in_person,
        ...affidavit(c),
        additional_details: {},
      }),
    ];
  }

  return [
    {
      ...(isSelf ? { self: true as const } : {}),
      person: compact({
        name: c.name.trim(),
        age: age(c.age),
        gender: gender(c.gender),
        disability_status: disability(c.differentlyAbled),
      }),
      ...contactLists([phone(c.mobile)], [c.email.trim()], [address(c.res)]),
      ...(c.permSame === "no" ? { permanent_address: address(c.perm) } : {}),
      is_party_in_person,
      ...affidavit(c),
      additional_details: {},
    },
  ];
}

/* ─────────────────────────────────── Accused ────────────────────────────────────── */

/**
 * The accused's contacts are the individual's, or the institution's own. The people
 * summoned for an institution send their own mobile and email; their address stays in
 * `additional_details`, since the form asks no police station for it and the backend
 * refuses an accused's address without one.
 */
export function accusedBodies(a: Accused): PartyInput[] {
  const emails = a.contacts.map((x) => x.email.trim());
  const addresses = addressBlocks(a.addresses);
  const declared = accusedContactUnknownDeclared(a);
  /**
   * The no-contact declaration goes only on a body that sends no phone or email at all,
   * the company's or the person's own: the backend refuses it alongside either.
   */
  const base = (...sent: ContactLists[]) => ({
    is_party_in_person: false,
    resides_within_jurisdiction: a.jurisdiction !== "no",
    ...(declared && !sent.some((l) => l.mobile_numbers || l.email_addresses)
      ? { contact_details_unknown_declared: true as const }
      : {}),
    additional_details: {},
  });

  if (a.type === "individual") {
    const own = contactLists(a.contacts.map((x) => phone(x.mobile)), emails, addresses);
    return [{ ...base(own), person: compact({ name: a.name.trim() }), ...own }];
  }

  const institution = compact({
    entity_type: ENTITY_TYPE_CODES[a.entType],
    entity_name: a.name.trim(),
    // A company's number may be a landline, so it is sent as typed.
    ...contactLists(a.contacts.map((x) => x.mobile.trim()), emails, addresses),
  });
  const reps = a.reps.filter((r) => r.name.trim());
  if (reps.length === 0) return [{ ...base(institution), institution }];

  return reps.map((rep) => {
    const own = contactLists([phone(rep.mobile)], [rep.email.trim()], []);
    return compact({
      ...base(institution, own),
      institution,
      person: representative(rep),
      designation: rep.designation.trim(),
      ...own,
      additional_details: compact({
        representative_address: hasAddress(rep.addr) ? address(rep.addr) : undefined,
      }),
    });
  });
}

/* ─────────────────────────────────── Witness ────────────────────────────────────── */

/**
 * A witness is always a person, and in a complaint they are the complainant's. The form
 * names some witnesses by their designation alone ("Manager, SBI Kollam"), so that names
 * them here too.
 */
export function witnessBodies(w: Witness): WitnessInput[] {
  return [
    compact({
      person: compact({
        name: w.fullName.trim() || w.designation.trim(),
        age: age(w.age),
      }),
      ...contactLists(
        w.contacts.map((x) => phone(x.mobile)),
        w.contacts.map((x) => x.email.trim()),
        addressBlocks(w.addresses)
      ),
      designation: w.designation.trim(),
      side: "COMPLAINANT" as const,
      what_will_witness_prove: w.prove.trim(),
      additional_details: {},
    }),
  ];
}

/* ─────────────────────────── What the backend requires ──────────────────────────── */

const ADDRESS_FIELDS: Array<[keyof AddressInput, string]> = [
  ["line1", "address"],
  ["city", "city"],
  ["pincode", "pincode"],
  ["district", "district"],
  ["state", "state"],
];

/**
 * What a body still lacks that the backend requires (dristi-be `cases/serializers.py`),
 * as the form names it. Checked before sending, so the person is told what to add
 * rather than shown the backend's bare "This field is required".
 */
export function missingFields(body: AnyPartyInput, role: PartyRole): string[] {
  const missing = new Set<string>();
  const institution = "institution" in body ? body.institution : undefined;
  /** Every address sent must be whole; an accused's or a witness's needs a police station. */
  const checkAddresses = (list: Partial<AddressInput>[] | undefined, whose = "") => {
    if (!list?.length) {
      missing.add(`${whose}address`);
      return;
    }
    for (const a of list) {
      for (const [field, label] of ADDRESS_FIELDS) if (!a[field]) missing.add(whose + label);
      if (role !== "complainants" && !a.police_station) missing.add(`${whose}police station`);
    }
  };
  // Whoever is served needs an address: the individual their own, an institution its own.
  if (institution) {
    checkAddresses(institution.addresses);
    // The representative's own is optional, but one sent must be whole.
    if (body.addresses?.length) checkAddresses(body.addresses, "representative's ");
  } else {
    checkAddresses(body.addresses);
  }
  if (!body.person?.name && !institution?.entity_name) {
    missing.add("name");
  }
  if (institution) {
    if (!institution.entity_type) missing.add("type of entity");
    if (
      role === "complainants" &&
      !institution.pan &&
      !institution.cin &&
      !institution.pan_cin_skip_declared
    ) {
      missing.add("CIN or PAN");
    }
    if (role === "accused" && body.person && !body.designation) missing.add("designation");
  }
  return [...missing];
}

/** "Add the city and police station to save this to your case." */
export function missingFieldsMessage(missing: string[], whose?: string): string {
  const list =
    missing.length > 1
      ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`
      : missing[0];
  return `Add the ${whose ? `${whose} ` : ""}${list} to save this to your case.`;
}

/* ─────────────────────────────────── Saving ─────────────────────────────────────── */

function isWitness(body: AnyPartyInput): body is WitnessInput {
  return "side" in body;
}

/**
 * The contact lists as PATCH takes them: whole, since each one sent replaces the list, and
 * empty rather than left out, since one left out is kept as it was.
 */
function listsPatch(body: ContactLists): Required<ContactLists> {
  return {
    mobile_numbers: body.mobile_numbers ?? [],
    email_addresses: body.email_addresses ?? [],
    addresses: body.addresses ?? [],
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What the backend sets on the person (disability, permanent address), sent only when it
 * changed: it refuses them for a person another account created. `null` clears either.
 */
function personPatch(
  body: Pick<PartyInput, "person" | "permanent_address">,
  before: Pick<PartyInput, "person" | "permanent_address"> | undefined,
  hasPermanentAddress: boolean
): Pick<ParticipantPatch, "disability_status" | "permanent_address"> {
  const disability = body.person?.disability_status ?? null;
  const permanent = body.permanent_address ?? null;
  return {
    ...(body.person && (!before || disability !== (before.person?.disability_status ?? null))
      ? { disability_status: disability }
      : {}),
    ...(hasPermanentAddress && (!before || !same(permanent, before.permanent_address ?? null))
      ? { permanent_address: permanent }
      : {}),
  };
}

/**
 * A company's part of a PATCH. Its contacts go in `institution_contacts`, always whole.
 * `institution` re-links the participant to the company its PAN or CIN names (a new one
 * when there is none), so it is sent only when the company itself changed.
 */
function institutionPatch(
  institution: InstitutionInput,
  before: InstitutionInput | undefined
): Pick<ParticipantPatch, "institution" | "institution_contacts"> {
  const split = ({ mobile_numbers, email_addresses, addresses, ...company }: InstitutionInput) => ({
    company,
    contacts: { mobile_numbers, email_addresses, addresses },
  });
  const { company, contacts } = split(institution);
  return {
    institution_contacts: listsPatch(contacts),
    ...(!before || !same(company, split(before).company) ? { institution: company } : {}),
  };
}

/**
 * The case's copy of a party's details: everything PATCH may change. `before` is the body
 * last saved, if any; what PATCH sends only on a change is compared against it.
 */
export function patchFor(body: AnyPartyInput, before?: AnyPartyInput): ParticipantPatch {
  if (isWitness(body)) {
    return {
      name_at_filing: body.person.name,
      gender_at_filing: body.person.gender ?? null,
      age_at_filing: body.person.age ?? null,
      designation_at_filing: body.designation ?? null,
      ...listsPatch(body),
      additional_details: body.additional_details,
      side: body.side,
      what_will_witness_prove: body.what_will_witness_prove,
    };
  }
  const previous = before && !isWitness(before) ? before : undefined;
  // Only an individual complainant has a permanent address.
  const hasPermanentAddress = !body.institution && body.resides_within_jurisdiction === undefined;
  return {
    name_at_filing: body.person?.name ?? body.institution?.entity_name ?? "",
    gender_at_filing: body.person?.gender ?? null,
    age_at_filing: body.person?.age ?? null,
    ...(body.person && body.institution
      ? { designation_at_filing: body.designation ?? null }
      : {}),
    // An institution with nobody acting for it has no contacts outside `institution`.
    ...(body.person || body.self ? listsPatch(body) : {}),
    ...(body.institution ? institutionPatch(body.institution, previous?.institution) : {}),
    ...personPatch(body, previous, hasPermanentAddress),
    is_party_in_person: body.is_party_in_person,
    // Accused only; `false` withdraws a declaration once a phone or email is added.
    ...(body.resides_within_jurisdiction !== undefined
      ? {
          resides_within_jurisdiction: body.resides_within_jurisdiction,
          contact_details_unknown_declared: !!body.contact_details_unknown_declared,
        }
      : // Complainant only; `null` withdraws one saved earlier, once they take an advocate.
        { party_in_person_affidavit: body.party_in_person_affidavit ?? null }),
    additional_details: body.additional_details,
  };
}

/**
 * Who the party is: what the backend cannot change in place. When one party is saved as
 * several participants, they are told apart by name too, so removing the second person
 * summoned for an institution never relabels the third as them.
 */
function identity(body: AnyPartyInput, byName: boolean): string {
  const name = byName ? (body.person?.name ?? null) : null;
  if (isWitness(body)) return JSON.stringify({ witness: true });
  // An institution's details are changed by PATCH, which re-links it; only switching
  // between an individual and an institution needs the participant added again.
  return JSON.stringify({
    self: !!body.self,
    person: !!body.person,
    name,
    institution: !!body.institution,
  });
}

/** Has this party changed since it was last saved, or never been saved? */
export function partyChanged(bodies: AnyPartyInput[], saved: SavedParty): boolean {
  const before = saved.savedBodies ?? [];
  return bodies.length !== before.length || bodies.some((b, i) => JSON.stringify(b) !== before[i]);
}

export type PartySaveResult = Required<Pick<SavedParty, "caseParticipantIds" | "savedBodies">> &
  Pick<SavedParty, "institutionId"> & {
    error?: unknown;
  };

/*
 * Fields set to `undefined` below are left out of the request, which is sent as JSON.
 */

/** Another person summoned for a company already on the case: joined to it by its id. */
function joining(body: PartyInput, institutionId: string): PartyInput {
  return { ...body, institution: undefined, institution_id: institutionId };
}

/** A PATCH without the company's part, once another participant's PATCH has carried it. */
function withoutCompany(patch: ParticipantPatch): ParticipantPatch {
  return { ...patch, institution: undefined, institution_contacts: undefined };
}

export type PartyApi = Pick<CaseFilingApi, "addParty" | "updateParticipant" | "removeParticipant">;

/**
 * A saved body for a participant added as `self` whose follow-up PATCH has not gone
 * through yet: it reads as the same party but a different body, so the next save sends
 * the PATCH rather than adding them again.
 */
function unpatched<T extends object>(body: T): string {
  return JSON.stringify({ ...body, unpatched: true });
}

/**
 * Bring one party's participants on the case in line with its bodies. Each body is matched
 * to the participant saved from the same body, else from the same party (see `identity`),
 * never by position, so one failed save cannot leave the next comparing the wrong people.
 * Those no longer named come off first, since the backend refuses the same person twice.
 * If it fails part way, the result still records what is on the case by then.
 *
 * The filer is added as `self`, which takes the backend's record of them as it is, so what
 * they typed here (age, gender, a fuller name) is then written to the case's copy.
 *
 * An accused company is one institution on the case, whoever is summoned for it. Each
 * person after the first joins it by `institution_id`, and its own details and contacts go
 * on one PATCH, which the backend applies to everyone summoned for it.
 */
export async function saveParty(
  api: PartyApi,
  caseId: string,
  role: PartyRole,
  bodies: AnyPartyInput[],
  saved: SavedParty
): Promise<PartySaveResult> {
  const olds = (saved.caseParticipantIds ?? []).map((id, k) => {
    const json = saved.savedBodies?.[k] ?? "";
    return { id, json, body: json ? (JSON.parse(json) as AnyPartyInput) : undefined };
  });
  const json = bodies.map((b) => JSON.stringify(b));
  const byName = bodies.length > 1 || olds.length > 1;

  const taken = new Set<number>();
  const take = (test: (old: (typeof olds)[number]) => boolean) => {
    const k = olds.findIndex((old, j) => !taken.has(j) && test(old));
    if (k < 0) return undefined;
    taken.add(k);
    return k;
  };
  const match = json.map((j) => take((old) => old.json === j));
  bodies.forEach((body, i) => {
    match[i] ??= take((old) => !!old.body && identity(old.body, byName) === identity(body, byName));
  });
  const unmatched = olds.filter((_, k) => !taken.has(k));

  const caseParticipantIds: string[] = [];
  const savedBodies: string[] = [];
  // The company is on the case only while someone summoned for it still is.
  let institutionId = match.some((k) => k !== undefined) ? saved.institutionId : undefined;
  let companySent = false;
  let removed = 0;
  let i = 0;
  try {
    for (; removed < unmatched.length; removed++) {
      await api.removeParticipant(unmatched[removed].id);
    }
    for (; i < bodies.length; i++) {
      const body = bodies[i];
      const k = match[i];
      if (k !== undefined) {
        if (olds[k].json !== json[i]) {
          const patch = patchFor(body, olds[k].body);
          await api.updateParticipant(olds[k].id, companySent ? withoutCompany(patch) : patch);
          companySent ||= "institution_contacts" in patch;
        }
        caseParticipantIds.push(olds[k].id);
        savedBodies.push(json[i]);
        continue;
      }
      const self = !isWitness(body) && !!body.self;
      const sent = self
        ? { ...body, person: undefined }
        : role === "accused" && !isWitness(body) && body.institution && institutionId
          ? joining(body, institutionId)
          : body;
      const added = await api.addParty(caseId, role, sent);
      institutionId ??= added.institutionId ?? undefined;
      caseParticipantIds.push(added.participantId);
      savedBodies.push(self ? unpatched(body) : json[i]);
      if (self) {
        await api.updateParticipant(added.participantId, patchFor(body));
        savedBodies[savedBodies.length - 1] = json[i];
      }
    }
    return { caseParticipantIds, savedBodies, institutionId };
  } catch (error) {
    // Whatever was not reached is still on the case as it was.
    for (; i < bodies.length; i++) {
      const k = match[i];
      if (k === undefined) continue;
      caseParticipantIds.push(olds[k].id);
      savedBodies.push(olds[k].json);
    }
    for (const old of unmatched.slice(removed)) {
      caseParticipantIds.push(old.id);
      savedBodies.push(old.json);
    }
    // Still on the case through whoever was kept or added.
    institutionId = caseParticipantIds.length ? (institutionId ?? saved.institutionId) : undefined;
    return { caseParticipantIds, savedBodies, institutionId, error };
  }
}

/* ───────────────────────────────── PoA holder ───────────────────────────────────── */

/**
 * A complainant's PoA holder is saved after the complainant, since the mandate names the
 * complainant's participant. Removing the complainant on the backend revokes the mandate
 * and takes the holder off with it, so a complainant added again needs the holder again.
 */

/** The holder as sent, apart from whom they act for, which is only known once saved. */
export type PoaHolderBody = Omit<PoaHolderInput, "represented_participant_ids">;

/**
 * Is this the signed-in account's own mobile? A litigant or a registered PoA holder may
 * name themselves as a complainant's holder, and is then added as `self`.
 */
export function isAccountMobile(mobile: string, profile: UserProfile | null): boolean {
  const filer = profile?.role === "LITIGANT" || profile?.role === "POWER_OF_ATTORNEY";
  return filer && !!profile.mobile && toNationalMobile(mobile) === profile.mobile;
}

/** The holder of an individual complainant who has one; `null` while there is none to send. */
export function poaHolderBody(c: Complainant, isSelf = false): PoaHolderBody | null {
  const h = c.poaHolder;
  if (c.type !== "individual" || c.pip === "yes" || c.poa !== "yes" || !h.name.trim()) {
    return null;
  }
  return {
    ...(isSelf ? { self: true as const } : {}),
    person: compact({ name: h.name.trim(), age: age(h.age) }),
    ...contactLists([phone(h.mobile)], [], [address(h.res)]),
    ...(h.permSame === "no" ? { permanent_address: address(h.perm) } : {}),
    additional_details: {},
  };
}

/** What the backend still needs before it takes this holder: a full address. */
export function poaHolderMissing(body: PoaHolderBody): string[] {
  const first = body.addresses?.[0] ?? {};
  return ADDRESS_FIELDS.filter(([field]) => !first[field]).map(([, label]) => label);
}

/** The case's copy of the holder: everything PATCH may change for them. */
function poaHolderPatch(body: PoaHolderBody, before?: PoaHolderBody): ParticipantPatch {
  return {
    name_at_filing: body.person?.name ?? "",
    // The form does not ask a holder's gender.
    gender_at_filing: null,
    age_at_filing: body.person?.age ?? null,
    ...listsPatch(body),
    ...personPatch(body, before, true),
    additional_details: body.additional_details,
  };
}

export type PoaApi = Pick<CaseFilingApi, "addPoaHolder" | "revokePoaMandate" | "updateParticipant">;

export type PoaSaveResult = { saved?: SavedPoaHolder; error?: unknown };

/** Revoke the holder's mandates; one the backend has already revoked is gone already. */
export async function endPoaHolder(api: PoaApi, saved: SavedPoaHolder): Promise<void> {
  for (const id of saved.mandateIds) {
    try {
      await api.revokePoaMandate(id);
    } catch (error) {
      if (!(isApiError(error) && error.status === 404)) throw error;
    }
  }
}

/**
 * Bring a complainant's PoA holder on the case in line with `body`, acting for the
 * complainant's participant `forId`. A holder whose complainant was added again, or who
 * became or stopped being the filer, is replaced; any other change is a PATCH.
 */
export async function savePoaHolder(
  api: PoaApi,
  caseId: string,
  body: PoaHolderBody | null,
  forId: string | undefined,
  saved: SavedPoaHolder | undefined
): Promise<PoaSaveResult> {
  let current = saved;
  try {
    const before = current ? (JSON.parse(current.body) as PoaHolderBody) : undefined;
    if (
      current &&
      (!body || !forId || current.forParticipantId !== forId || !!before?.self !== !!body.self)
    ) {
      await endPoaHolder(api, current);
      current = undefined;
    }
    if (!body || !forId) return { saved: current };

    const json = JSON.stringify(body);
    if (current) {
      if (current.body !== json) {
        await api.updateParticipant(current.participantId, poaHolderPatch(body, before));
      }
      return { saved: { ...current, body: json } };
    }

    const added = await api.addPoaHolder(caseId, {
      ...body,
      ...(body.self ? { person: undefined } : {}),
      represented_participant_ids: [forId],
    });
    current = { ...added, forParticipantId: forId, body: body.self ? unpatched(body) : json };
    // As `self`, the backend takes its own record of the filer; what was typed is the case's copy.
    if (body.self) {
      await api.updateParticipant(added.participantId, poaHolderPatch(body));
      current = { ...current, body: json };
    }
    return { saved: current };
  } catch (error) {
    return { saved: current, error };
  }
}
