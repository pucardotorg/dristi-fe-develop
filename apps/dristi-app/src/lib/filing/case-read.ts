/**
 * The complainant, accused and advocate steps as the backend case holds them.
 *
 * When one of those steps opens, the case's record replaces this browser's copy of every
 * party saved there, so the screen shows what the court has. Three exceptions:
 *
 *   - A party with edits not saved yet (or whose save failed) keeps this browser's copy:
 *     those edits are what the step is about to send.
 *   - A party never saved stays as typed.
 *   - A party this browser saved that the case no longer has is kept and marked unsaved,
 *     so the step adds it again rather than losing what was typed.
 *
 * Parties on the case this browser has never seen are added at the end, in the case's
 * order. What only this browser knows is carried over: the mobile's OTP check, the time a
 * declaration was made, an affidavit kept for a complainant now with an advocate.
 *
 * Pure, so it is tested without rendering the form.
 */

import { advocateChanged, advocateClientIds } from "./advocates";
import {
  blankAddress,
  blankAddressBlock,
  blankAdvocate,
  blankComplainant,
  blankAccused,
  blankContact,
  blankRepresentative,
  blankWitness,
} from "./blank";
import type {
  AddressRead,
  CaseRead,
  ContactListsRead,
  ParticipantRead,
  RepresentationRead,
} from "./data/cases-api";
import { ENTITY_TYPE_CODES, GENDER_CODES } from "./options";
import {
  accusedBodies,
  complainantBodies,
  isAccountMobile,
  partyChanged,
  poaHolderBody,
  selfComplainantId,
  witnessBodies,
  type AnyPartyInput,
} from "./parties";
import type {
  Accused,
  Address,
  AddressBlock,
  Advocate,
  Complainant,
  Contact,
  DifferentlyAbled,
  Gender,
  Representative,
  SavedParty,
  UserProfile,
  Witness,
} from "./types";

/** The parties after reading the case, and which of them now hold the case's copy. */
export type FromCase<T> = {
  parties: T[];
  /** Ids of local parties whose copy was replaced by the case's. */
  replaced: string[];
  /** Ids of local parties the case no longer has; they are to be saved again. */
  unsaved: string[];
};

/* ─────────────────────────────── Backend → form fields ──────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A +91 mobile as the form shows it (ten digits); any other number as stored. */
function formMobile(value: string | null): string {
  const v = value ?? "";
  return /^\+91\d{10}$/.test(v) ? v.slice(3) : v;
}

function formAge(value: number | null): string {
  return value === null ? "" : String(value);
}

function formGender(code: string | null): Gender {
  return (["male", "female", "other"] as const).find((g) => GENDER_CODES[g] === code) ?? "";
}

function formDisability(value: boolean | null): DifferentlyAbled {
  if (value === null) return "";
  return value ? "yes" : "no";
}

function formEntityType(code: string): string {
  return Object.keys(ENTITY_TYPE_CODES).find((k) => ENTITY_TYPE_CODES[k] === code) ?? "";
}

/** An address kept in `additional_details`, which the backend stores as it was sent. */
function readAddress(value: unknown): AddressRead | null {
  if (!isRecord(value)) return null;
  const field = (key: string) => str(value[key]) || null;
  return {
    line1: field("line1"),
    city: field("city"),
    district: field("district"),
    state: field("state"),
    pincode: field("pincode"),
    police_station: field("police_station"),
  };
}

function formAddress(a: AddressRead | null): Address {
  if (!a) return blankAddress();
  return {
    line1: a.line1 ?? "",
    city: a.city ?? "",
    pin: a.pincode ?? "",
    district: a.district ?? "",
    state: a.state ?? "",
  };
}

function formBlock(a: AddressRead): AddressBlock {
  return { addr: formAddress(a), police: a.police_station ?? "" };
}

/**
 * The form's contact rows from the backend's two lists, paired in order. How the form had
 * paired them is not kept, but the lists sent from the pairs come out the same.
 */
function formContacts(
  lists: ContactListsRead,
  toForm: (mobile: string) => string
): Contact[] {
  const count = Math.max(lists.mobile_numbers.length, lists.email_addresses.length);
  return Array.from({ length: count }, (_, i) => ({
    mobile: lists.mobile_numbers[i] ? toForm(lists.mobile_numbers[i]) : "",
    email: lists.email_addresses[i] ?? "",
  }));
}

/**
 * A person named for an institution: a complainant's representative or someone summoned.
 * Their address is their own case contact; an accused's people saved before that kept it
 * in `additional_details`, which is still read.
 */
function formRepresentative(p: ParticipantRead): Representative {
  const address = p.addresses[0] ?? readAddress(p.additional_details.representative_address);
  return {
    mobile: formMobile(p.mobile_numbers[0] ?? null),
    name: p.name_at_filing ?? "",
    age: formAge(p.age_at_filing),
    designation: p.designation_at_filing ?? "",
    email: p.email_addresses[0] ?? "",
    addr: formAddress(address),
    police: address?.police_station ?? "",
    gender: formGender(p.gender_at_filing),
    differentlyAbled: formDisability(p.disability_status),
  };
}

function byOrdinal(read: CaseRead, role: ParticipantRead["role"]): ParticipantRead[] {
  return read.participants.filter((p) => p.role === role).sort((a, b) => a.ordinal - b.ordinal);
}

/* ─────────────────────────────────── Merging ────────────────────────────────────── */

/**
 * Line the local parties up against the case's, one group of participants per party.
 * `rebuild` makes a party from its group, on top of the local one it replaces (if any).
 */
function merge<T extends SavedParty & { id: string }>(
  local: T[],
  groups: ParticipantRead[][],
  pending: (party: T) => boolean,
  rebuild: (group: ParticipantRead[], base: T | undefined) => T
): FromCase<T> {
  const taken = new Set<number>();
  const result: FromCase<T> = { parties: [], replaced: [], unsaved: [] };

  for (const party of local) {
    const ids = party.caseParticipantIds ?? [];
    if (ids.length === 0) {
      result.parties.push(party);
      continue;
    }
    const k = groups.findIndex(
      (g, j) => !taken.has(j) && g.some((p) => ids.includes(p.case_participant_id))
    );
    if (k >= 0) taken.add(k);

    if (pending(party)) {
      result.parties.push(party);
    } else if (k >= 0) {
      result.parties.push(rebuild(groups[k], party));
      result.replaced.push(party.id);
    } else {
      // Gone from the case: keep what was typed, and have the step add it again.
      result.parties.push({
        ...party,
        caseParticipantIds: [],
        savedBodies: [],
        institutionId: undefined,
      });
      result.unsaved.push(party.id);
    }
  }
  groups.forEach((g, j) => {
    if (!taken.has(j)) result.parties.push(rebuild(g, undefined));
  });
  return result;
}

function savedBodiesOf(bodies: AnyPartyInput[]): string[] {
  return bodies.map((b) => JSON.stringify(b));
}

/* ───────────────────────────────── Complainants ─────────────────────────────────── */

function complainantFrom(p: ParticipantRead, base: Complainant): Complainant {
  const c: Complainant = {
    ...base,
    pip: p.is_party_in_person ? "yes" : "no",
    // An affidavit kept for a complainant now with an advocate stays for if they go back.
    affidavit: p.party_in_person_affidavit ?? base.affidavit,
    caseParticipantIds: [p.case_participant_id],
    syncError: undefined,
  };
  const inst = p.institution;
  if (inst) {
    const skipped = !!inst.pan_cin_skip_declared;
    return {
      ...c,
      type: "institution",
      entType: formEntityType(inst.entity_type),
      entName: inst.entity_name,
      // A number typed before skipping is kept, as the form keeps it; it is not sent.
      entCinPan: inst.pan ?? inst.cin ?? (skipped ? base.entCinPan : ""),
      entCinPanSkippedAt: skipped ? (base.entCinPanSkippedAt ?? p.updated_at) : null,
      // A company's number may be a landline; it is shown as stored.
      entPhone: inst.mobile_numbers[0] ?? "",
      entEmail: inst.email_addresses[0] ?? "",
      entAddr: formAddress(inst.addresses[0] ?? null),
      rep: p.person_id ? formRepresentative(p) : blankRepresentative(),
    };
  }
  return {
    ...c,
    type: "individual",
    mobile: formMobile(p.mobile_numbers[0] ?? null),
    // Saved on the case, so the number has been checked; asking again would be pointless.
    verified: true,
    name: p.name_at_filing ?? "",
    age: formAge(p.age_at_filing),
    gender: formGender(p.gender_at_filing),
    differentlyAbled: formDisability(p.disability_status),
    email: p.email_addresses[0] ?? "",
    res: formAddress(p.addresses[0] ?? null),
    permSame: p.permanent_address ? "no" : "yes",
    perm: p.permanent_address ? formAddress(p.permanent_address) : base.perm,
  };
}

/** Is the holder named for complainant `c` the signed-in account (see `useCaseParties`)? */
function holderIsSelf(c: Complainant, selfId: string | undefined, profile: UserProfile | null) {
  return c.id !== selfId && isAccountMobile(c.poaHolder.mobile, profile);
}

function poaBodyJson(c: Complainant, selfId: string | undefined, profile: UserProfile | null) {
  const body = poaHolderBody(c, holderIsSelf(c, selfId, profile));
  return body ? JSON.stringify(body) : undefined;
}

/** The complainant's PoA holder as the case holds them, or none. */
function withPoaHolder(
  c: Complainant,
  read: CaseRead,
  selfId: string | undefined,
  profile: UserProfile | null
): Complainant {
  const forId = c.caseParticipantIds?.[0];
  const mandates = read.poa_mandates.filter((m) => m.represented_participant_id === forId);
  const holderId = mandates[0]?.poa_participant_id;
  const holder = read.participants.find(
    (p) => p.role === "POA_HOLDER" && p.case_participant_id === holderId
  );
  if (!forId || !holderId || !holder) {
    return { ...c, poa: "no", savedPoaHolder: undefined, poaSyncError: undefined };
  }
  const next: Complainant = {
    ...c,
    poa: "yes",
    poaHolder: {
      mobile: formMobile(holder.mobile_numbers[0] ?? null),
      name: holder.name_at_filing ?? "",
      age: formAge(holder.age_at_filing),
      res: formAddress(holder.addresses[0] ?? null),
      permSame: holder.permanent_address ? "no" : "yes",
      perm: holder.permanent_address ? formAddress(holder.permanent_address) : c.poaHolder.perm,
    },
    poaSyncError: undefined,
  };
  next.savedPoaHolder = {
    participantId: holderId,
    mandateIds: mandates
      .filter((m) => m.poa_participant_id === holderId)
      .map((m) => m.poa_mandate_id),
    forParticipantId: forId,
    body: poaBodyJson(next, selfId, profile) ?? "",
  };
  return next;
}

export function complainantsFromCase(
  read: CaseRead,
  local: Complainant[],
  profile: UserProfile | null
): FromCase<Complainant> {
  const localSelf = selfComplainantId(local, profile);
  const pending = (c: Complainant) => {
    const poaPending =
      !!c.poaSyncError || poaBodyJson(c, localSelf, profile) !== c.savedPoaHolder?.body;
    return (
      !!c.syncError || partyChanged(complainantBodies(c, c.id === localSelf), c) || poaPending
    );
  };
  const result = merge(
    local,
    byOrdinal(read, "COMPLAINANT").map((p) => [p]),
    pending,
    ([p], base) =>
      complainantFrom(p, base ?? { ...blankComplainant(), id: `cp-${p.case_participant_id}` })
  );

  // Who "you" are, the bodies and the PoA holders depend on the whole list, so they come last.
  const fresh = new Set(result.replaced);
  const gone = new Set(result.unsaved);
  const selfId = selfComplainantId(result.parties, profile);
  result.parties = result.parties.map((c) => {
    // The backend took their PoA holder off with them; the step adds both again.
    if (gone.has(c.id)) return { ...c, savedPoaHolder: undefined };
    const isNew = !local.some((l) => l.id === c.id);
    if (!fresh.has(c.id) && !isNew) return c;
    const next = withPoaHolder(c, read, selfId, profile);
    return { ...next, savedBodies: savedBodiesOf(complainantBodies(next, next.id === selfId)) };
  });
  return result;
}

/* ─────────────────────────────────── Accused ────────────────────────────────────── */

/**
 * One group per accused: an institution's participants (S-141) share its institution. Its
 * id stays the same while only its contacts change (`institution_contacts`).
 */
function accusedGroups(read: CaseRead): ParticipantRead[][] {
  const groups: ParticipantRead[][] = [];
  const byInstitution = new Map<string, ParticipantRead[]>();
  for (const p of byOrdinal(read, "ACCUSED")) {
    const group = p.institution_id ? byInstitution.get(p.institution_id) : undefined;
    if (group) {
      group.push(p);
      continue;
    }
    groups.push([p]);
    if (p.institution_id) byInstitution.set(p.institution_id, groups[groups.length - 1]);
  }
  return groups;
}

function accusedFrom(group: ParticipantRead[], base: Accused): Accused {
  const [first] = group;
  const inst = first.institution;
  // An individual's contacts are their own; an institution's are its own.
  const own = inst ?? first;
  // A company's number may be a landline; it is shown as stored.
  const contacts = formContacts(own, inst ? (m) => m : formMobile);
  const addresses = own.addresses.map(formBlock);
  const reps = group.filter((p) => p.person_id).map(formRepresentative);
  return {
    ...base,
    caseParticipantIds: group.map((p) => p.case_participant_id),
    institutionId: first.institution_id ?? undefined,
    syncError: undefined,
    type: inst ? "institution" : "individual",
    name: inst ? inst.entity_name : (first.name_at_filing ?? ""),
    entType: inst ? formEntityType(inst.entity_type) : base.entType,
    contacts: contacts.length ? contacts : [blankContact()],
    addresses: addresses.length ? addresses : [blankAddressBlock()],
    reps: inst ? (reps.length ? reps : [blankRepresentative()]) : base.reps,
    jurisdiction: first.resides_within_jurisdiction === false ? "no" : "yes",
    // Recorded only on those summoned who give no phone or email (see `accusedBodies`).
    contactUnknownDeclaredAt: group.some((p) => p.contact_details_unknown_declared)
      ? (base.contactUnknownDeclaredAt ?? first.updated_at)
      : null,
  };
}

export function accusedFromCase(read: CaseRead, local: Accused[]): FromCase<Accused> {
  const result = merge(
    local,
    accusedGroups(read),
    (a) => !!a.syncError || partyChanged(accusedBodies(a), a),
    (group, base) => {
      const a = accusedFrom(
        group,
        base ?? { ...blankAccused(), id: `acc-${group[0].case_participant_id}` }
      );
      return { ...a, savedBodies: savedBodiesOf(accusedBodies(a)) };
    }
  );
  return result;
}

/* ─────────────────────────────────── Witnesses ──────────────────────────────────── */

function witnessFrom(p: ParticipantRead, base: Witness): Witness {
  const designation = p.designation_at_filing ?? "";
  const name = p.name_at_filing ?? "";
  const contacts = formContacts(p, formMobile);
  const addresses = p.addresses.map(formBlock);
  const w: Witness = {
    ...base,
    caseParticipantIds: [p.case_participant_id],
    syncError: undefined,
    // A witness known only by designation is sent with it as their name (`witnessBodies`).
    fullName: name === designation ? "" : name,
    designation,
    age: formAge(p.age_at_filing),
    prove: p.witness?.what_will_witness_prove ?? "",
    contacts: contacts.length ? contacts : [blankContact()],
    addresses: addresses.length ? addresses : [blankAddressBlock()],
  };
  return { ...w, savedBodies: savedBodiesOf(witnessBodies(w)) };
}

/** A witness row nobody has typed into: the blank one a new draft starts with. */
function untouchedWitness(w: Witness): boolean {
  return !w.caseParticipantIds?.length &&
    JSON.stringify({ ...w, id: "" }) === JSON.stringify({ ...blankWitness(), id: "" });
}

export function witnessesFromCase(read: CaseRead, local: Witness[]): FromCase<Witness> {
  const groups = byOrdinal(read, "WITNESS").map((p) => [p]);
  const result = merge(
    local,
    groups,
    (w) => !!w.syncError || partyChanged(witnessBodies(w), w),
    ([p], base) => witnessFrom(p, base ?? { ...blankWitness(), id: `wit-${p.case_participant_id}` })
  );
  // The case's witnesses take the place of the blank row a new draft starts with.
  if (groups.length > 0) result.parties = result.parties.filter((w) => !untouchedWitness(w));
  return result;
}

/* ─────────────────────────────────── Advocates ──────────────────────────────────── */

function advocateFrom(
  reps: RepresentationRead[],
  base: Advocate,
  complainants: Complainant[],
  participantIdOf: (c: Complainant) => string | undefined
): Advocate {
  const [first] = reps;
  const clients = reps.map((r) => r.client_participant_id);
  return {
    ...base,
    advocateId: first.advocate_id,
    savedAdvocateId: first.advocate_id,
    name: first.advocate_name,
    barNumber: first.bar_registration_id,
    forComplainants: complainants.flatMap((c, i) => {
      const id = participantIdOf(c);
      return id && clients.includes(id) ? [i] : [];
    }),
    representations: Object.fromEntries(
      reps.map((r) => [r.client_participant_id, r.representation_id])
    ),
    syncError: undefined,
  };
}

/**
 * The advocate rows as the case holds them: one per advocate, acting for the complainants
 * they represent. A row typed in by hand (no backend id) is never on the case, so it stays.
 */
export function advocatesFromCase(
  read: CaseRead,
  local: Advocate[],
  complainants: Complainant[],
  participantIdOf: (c: Complainant) => string | undefined
): FromCase<Advocate> {
  const groups = new Map<string, RepresentationRead[]>();
  for (const r of read.representations) {
    const group = groups.get(r.advocate_id);
    if (group) group.push(r);
    else groups.set(r.advocate_id, [r]);
  }
  const taken = new Set<string>();
  const result: FromCase<Advocate> = { parties: [], replaced: [], unsaved: [] };

  for (const advocate of local) {
    const savedId = advocate.savedAdvocateId;
    if (!advocate.advocateId || !savedId) {
      result.parties.push(advocate);
      continue;
    }
    const group = groups.get(savedId);
    if (group) taken.add(savedId);
    const clientIds = advocateClientIds(advocate, complainants, participantIdOf);
    const saved = clientIds.filter((id): id is string => !!id);
    const pending =
      !!advocate.syncError ||
      saved.length !== clientIds.length ||
      advocateChanged(advocate.advocateId, saved, advocate);

    if (pending) {
      result.parties.push(advocate);
    } else if (group) {
      result.parties.push(advocateFrom(group, advocate, complainants, participantIdOf));
      result.replaced.push(advocate.id);
    } else {
      result.parties.push({ ...advocate, savedAdvocateId: undefined, representations: {} });
      result.unsaved.push(advocate.id);
    }
  }
  for (const [advocateId, group] of groups) {
    if (taken.has(advocateId)) continue;
    const base = { ...blankAdvocate(), id: `adv-${advocateId}` };
    result.parties.push(advocateFrom(group, base, complainants, participantIdOf));
  }
  return result;
}
