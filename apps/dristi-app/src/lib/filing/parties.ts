/**
 * Complainants, accused and witnesses as the backend case holds them.
 *
 * The form and the backend cut a party differently, so this file is where they meet:
 *
 *   - The backend takes one phone and one address per party. The first filled-in one of
 *     each fills its fields; the rest, and anything else the form asks that the backend
 *     has no field for, go in `additional_details`, so nothing is lost.
 *   - An institution accused is saved once per person summoned for it (S-141): each is a
 *     person for the institution, with their designation.
 *   - Who a party is (person or institution, email, disability, PAN / CIN — and for the people
 *     summoned for one institution, their name) cannot be changed on the backend. A
 *     change there removes the participant and adds it again, which puts it last in its
 *     role; any other change is a PATCH of the case's copy.
 *
 * Pure apart from the API it is handed, so it is tested without rendering the form.
 */

import { isApiError } from "@/lib/api";
import { isIndianMobile, toBackendMobile, toNationalMobile } from "@/lib/auth/mobile";

import type {
  AddressInput,
  CaseFilingApi,
  InstitutionInput,
  ParticipantPatch,
  PartyInput,
  PartyRole,
  PersonInput,
  PoaHolderInput,
  WitnessInput,
} from "./data/cases-api";
import { ENTITY_TYPE_CODES, GENDER_CODES } from "./options";
import { normaliseCinPan } from "./selectors";
import type {
  Accused,
  Address,
  AddressBlock,
  Complainant,
  Contact,
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

function cinPan(value: string): Pick<InstitutionInput, "pan" | "cin"> {
  const v = normaliseCinPan(value);
  if (!v) return {};
  return v.length === 10 ? { pan: v } : { cin: v };
}

function representative(rep: Representative): PersonInput {
  return compact({
    name: rep.name.trim(),
    phone_number: phone(rep.mobile),
    email_address: rep.email.trim(),
    age: age(rep.age),
    gender: gender(rep.gender),
    disability_status: disability(rep.differentlyAbled),
  });
}

/** The first filled-in contact and address, and the rest for `additional_details`. */
function firstAndRest(contacts: Contact[], addresses: AddressBlock[]) {
  const [first, ...otherContacts] = contacts.filter((x) => x.mobile.trim() || x.email.trim());
  const primary = addresses.find((b) => b.addr.line1.trim());
  const otherAddresses = addresses.filter((b) => b !== primary && hasAddress(b.addr));
  return {
    first,
    primary,
    rest: compact({
      other_contacts: otherContacts.length
        ? otherContacts.map((x) =>
            compact({ phone_number: phone(x.mobile), email_address: x.email.trim() })
          )
        : undefined,
      other_addresses: otherAddresses.length ? otherAddresses.map(addressBlock) : undefined,
    }),
  };
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
          ...cinPan(c.entCinPan),
          contact_number: c.entPhone.trim(),
          email_address: c.entEmail.trim(),
        }),
        person,
        designation: person ? c.rep.designation.trim() : undefined,
        address: address(c.entAddr),
        is_party_in_person,
        additional_details: compact({
          representative_address: hasAddress(c.rep.addr) ? address(c.rep.addr) : undefined,
        }),
      }),
    ];
  }

  return [
    {
      ...(isSelf ? { self: true as const } : {}),
      person: compact({
        name: c.name.trim(),
        phone_number: phone(c.mobile),
        email_address: c.email.trim(),
        age: age(c.age),
        gender: gender(c.gender),
        disability_status: disability(c.differentlyAbled),
      }),
      address: address(c.res),
      is_party_in_person,
      additional_details: compact({
        permanent_address: c.permSame === "no" ? address(c.perm) : undefined,
      }),
    },
  ];
}

/* ─────────────────────────────────── Accused ────────────────────────────────────── */

export function accusedBodies(a: Accused): PartyInput[] {
  const { first, primary, rest } = firstAndRest(a.contacts, a.addresses);
  const base = {
    address: primary ? addressBlock(primary) : {},
    is_party_in_person: false,
    resides_within_jurisdiction: a.jurisdiction !== "no",
    additional_details: rest,
  };

  if (a.type === "individual") {
    return [
      {
        ...base,
        person: compact({
          name: a.name.trim(),
          phone_number: first ? phone(first.mobile) : undefined,
          email_address: first?.email.trim(),
        }),
      },
    ];
  }

  const institution = compact({
    entity_type: ENTITY_TYPE_CODES[a.entType],
    entity_name: a.name.trim(),
    contact_number: first?.mobile.trim(),
    email_address: first?.email.trim(),
  });
  const reps = a.reps.filter((r) => r.name.trim());
  if (reps.length === 0) return [{ ...base, institution }];

  return reps.map((rep) =>
    compact({
      ...base,
      institution,
      person: representative(rep),
      designation: rep.designation.trim(),
      additional_details: compact({
        ...rest,
        representative_address: hasAddress(rep.addr) ? address(rep.addr) : undefined,
      }),
    })
  );
}

/* ─────────────────────────────────── Witness ────────────────────────────────────── */

/**
 * A witness is always a person, and in a complaint they are the complainant's. The form
 * names some witnesses by their designation alone ("Manager, SBI Kollam"), so that names
 * them here too.
 */
export function witnessBodies(w: Witness): WitnessInput[] {
  const { first, primary, rest } = firstAndRest(w.contacts, w.addresses);
  return [
    compact({
      person: compact({
        name: w.fullName.trim() || w.designation.trim(),
        phone_number: first ? phone(first.mobile) : undefined,
        email_address: first?.email.trim(),
        age: age(w.age),
      }),
      designation: w.designation.trim(),
      address: primary ? addressBlock(primary) : undefined,
      side: "COMPLAINANT" as const,
      what_will_witness_prove: w.prove.trim(),
      additional_details: rest,
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
  const addressNeeded = role !== "witnesses" || !!body.address;
  if (addressNeeded) {
    for (const [field, label] of ADDRESS_FIELDS) if (!body.address?.[field]) missing.add(label);
    if (role !== "complainants" && !body.address?.police_station) missing.add("police station");
  }
  if (!body.person?.name && !("institution" in body && body.institution?.entity_name)) {
    missing.add("name");
  }
  if ("institution" in body && body.institution) {
    if (!body.institution.entity_type) missing.add("type of entity");
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

/** The case's copy of a party's details: everything PATCH may change. */
export function patchFor(body: AnyPartyInput): ParticipantPatch {
  if (isWitness(body)) {
    return {
      name_at_filing: body.person.name,
      phone_number_at_filing: body.person.phone_number ?? null,
      gender_at_filing: body.person.gender ?? null,
      age_at_filing: body.person.age ?? null,
      designation_at_filing: body.designation ?? null,
      ...(body.address ? { address: body.address } : {}),
      additional_details: body.additional_details,
      side: body.side,
      what_will_witness_prove: body.what_will_witness_prove,
    };
  }
  return {
    name_at_filing: body.person?.name ?? body.institution?.entity_name ?? "",
    phone_number_at_filing:
      (body.person ? body.person.phone_number : body.institution?.contact_number) ?? null,
    gender_at_filing: body.person?.gender ?? null,
    age_at_filing: body.person?.age ?? null,
    ...(body.person && body.institution
      ? { designation_at_filing: body.designation ?? null }
      : {}),
    address: body.address,
    is_party_in_person: body.is_party_in_person,
    ...(body.resides_within_jurisdiction !== undefined
      ? { resides_within_jurisdiction: body.resides_within_jurisdiction }
      : {}),
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
  if (isWitness(body)) return JSON.stringify({ email: body.person.email_address ?? null });
  // The institution's number is the case's copy (`phone_number_at_filing`), so it is left out.
  return JSON.stringify({
    self: !!body.self,
    person: !!body.person,
    name,
    email: body.person?.email_address ?? null,
    // Kept on the person, which PATCH never changes.
    disability: body.person?.disability_status ?? null,
    institution: body.institution ? { ...body.institution, contact_number: undefined } : null,
  });
}

/** Has this party changed since it was last saved, or never been saved? */
export function partyChanged(bodies: AnyPartyInput[], saved: SavedParty): boolean {
  const before = saved.savedBodies ?? [];
  return bodies.length !== before.length || bodies.some((b, i) => JSON.stringify(b) !== before[i]);
}

export type PartySaveResult = Required<Pick<SavedParty, "caseParticipantIds" | "savedBodies">> & {
  error?: unknown;
};

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
        if (olds[k].json !== json[i]) await api.updateParticipant(olds[k].id, patchFor(body));
        caseParticipantIds.push(olds[k].id);
        savedBodies.push(json[i]);
        continue;
      }
      const self = !isWitness(body) && !!body.self;
      const id = await api.addParty(caseId, role, self ? { ...body, person: undefined } : body);
      caseParticipantIds.push(id);
      savedBodies.push(self ? unpatched(body) : json[i]);
      if (self) {
        await api.updateParticipant(id, patchFor(body));
        savedBodies[savedBodies.length - 1] = json[i];
      }
    }
    return { caseParticipantIds, savedBodies };
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
    return { caseParticipantIds, savedBodies, error };
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
    person: compact({ name: h.name.trim(), phone_number: phone(h.mobile), age: age(h.age) }),
    address: address(h.res),
    additional_details: compact({
      permanent_address: h.permSame === "no" ? address(h.perm) : undefined,
    }),
  };
}

/** What the backend still needs before it takes this holder: a full address. */
export function poaHolderMissing(body: PoaHolderBody): string[] {
  return ADDRESS_FIELDS.filter(([field]) => !body.address[field]).map(([, label]) => label);
}

/** The case's copy of the holder: everything PATCH may change for them. */
function poaHolderPatch(body: PoaHolderBody): ParticipantPatch {
  return {
    name_at_filing: body.person?.name ?? "",
    phone_number_at_filing: body.person?.phone_number ?? null,
    // The form does not ask a holder's gender.
    gender_at_filing: null,
    age_at_filing: body.person?.age ?? null,
    address: body.address,
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
        await api.updateParticipant(current.participantId, poaHolderPatch(body));
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
