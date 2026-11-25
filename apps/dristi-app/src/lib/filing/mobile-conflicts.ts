/**
 * Mobile numbers two parties may not share, checked on the single-filing form before the
 * filer moves on (bulk filing does not use these rules).
 *
 * No two parties may share a number, with two exceptions for a PoA holder: a complainant may
 * be another complainant's PoA holder, so a PoA holder may have a complainant's number (just
 * not their own complainant's); and a PoA holder often gives evidence for the complainant, so
 * may share a witness's number. So: two complainants, two accused, two PoA holders or two
 * witnesses; a complainant and an accused; an accused and a PoA holder; and a witness and a
 * complainant or an accused all clash. One party's own contact rows may repeat a number. A
 * clash shows only on the field of the party entered later (see `shownOn`).
 *
 * No party's number may be the filing advocate's own either (`advocateMobileClashes`), except
 * a PoA holder's: the advocate may hold the power of attorney (issue #64).
 */

import { isIndianMobile, toNationalMobile } from "@/lib/auth/mobile";

import { sameMobile } from "./selectors";
import type { Accused, Complainant, FilingDraft, Witness } from "./types";

/** Whose number a mobile field holds. Indices are positions in the draft's lists. */
export type MobileOwner =
  | { role: "complainant"; complainant: number }
  | { role: "poa-holder"; complainant: number }
  | { role: "accused"; accused: number; contact: number }
  | { role: "witness"; witness: number; contact: number };

/** For each mobile field on the form, the party it clashes with, if any. */
export type MobileConflicts = {
  complainant: (MobileOwner | undefined)[];
  poaHolder: (MobileOwner | undefined)[];
  /** By accused, then by contact row. */
  accused: (MobileOwner | undefined)[][];
  /** By witness, then by contact row. */
  witness: (MobileOwner | undefined)[][];
};

type Held = { owner: MobileOwner; national: string };

/** The numbers the rules cover, as 10 national digits; half-typed numbers are skipped. */
function heldNumbers(draft: FilingDraft): Held[] {
  const held: Held[] = [];
  const add = (owner: MobileOwner, value: string) => {
    const national = toNationalMobile(value);
    if (isIndianMobile(national)) held.push({ owner, national });
  };
  draft.complainants.forEach((c, i) => {
    // An institution's number is its representative's; individuals are the ones asked.
    if (c.type !== "individual") return;
    add({ role: "complainant", complainant: i }, c.mobile);
    // Appearing in person rules a PoA out, whatever the PoA answer was left as.
    if (c.poa === "yes" && c.pip !== "yes") {
      add({ role: "poa-holder", complainant: i }, c.poaHolder.mobile);
    }
  });
  draft.accused.forEach((a, i) => {
    a.contacts.forEach((contact, k) =>
      add({ role: "accused", accused: i, contact: k }, contact.mobile),
    );
  });
  draft.witnesses.forEach((w, i) => {
    w.contacts.forEach((contact, k) =>
      add({ role: "witness", witness: i, contact: k }, contact.mobile),
    );
  });
  return held;
}

/** The party's position in its own list: complainant (and their PoA holder), accused, witness. */
function partyIndex(o: MobileOwner): number {
  if (o.role === "accused") return o.accused;
  if (o.role === "witness") return o.witness;
  return o.complainant;
}

function clash(a: MobileOwner, b: MobileOwner): boolean {
  // The same party (one accused's or one witness's own contact rows) never clashes.
  if (a.role === b.role) return partyIndex(a) !== partyIndex(b);
  // A PoA holder often gives evidence for the complainant, so may also be a witness.
  if (a.role === "witness" && b.role === "poa-holder") return false;
  if (a.role === "poa-holder" && b.role === "witness") return false;
  // A PoA holder may hold another complainant's number, never their own complainant's.
  if (a.role === "complainant" && b.role === "poa-holder") return a.complainant === b.complainant;
  if (a.role === "poa-holder" && b.role === "complainant") return a.complainant === b.complainant;
  return true;
}

/** The order parties are entered in: complainants, their PoA holders, accused, witnesses. */
const ENTRY_ORDER: Record<MobileOwner["role"], number> = {
  complainant: 0,
  "poa-holder": 1,
  accused: 2,
  witness: 3,
};

/**
 * Whether `field` carries its clash with `other`. The number belongs to whoever had it
 * first; the party entered after them is the one told, so the clash shows on that field
 * alone. Between two parties of the same kind, the later one is told.
 */
function shownOn(field: MobileOwner, other: MobileOwner): boolean {
  if (field.role === other.role) return partyIndex(other) < partyIndex(field);
  return ENTRY_ORDER[other.role] < ENTRY_ORDER[field.role];
}

export function mobileConflicts(draft: FilingDraft): MobileConflicts {
  const conflicts: MobileConflicts = {
    complainant: draft.complainants.map(() => undefined),
    poaHolder: draft.complainants.map(() => undefined),
    accused: draft.accused.map((a) => a.contacts.map(() => undefined)),
    witness: draft.witnesses.map((w) => w.contacts.map(() => undefined)),
  };
  const held = heldNumbers(draft);
  for (const field of held) {
    const other = held.find(
      (x) =>
        x !== field &&
        x.national === field.national &&
        clash(field.owner, x.owner) &&
        shownOn(field.owner, x.owner),
    );
    if (!other) continue;
    const { owner } = field;
    if (owner.role === "complainant") conflicts.complainant[owner.complainant] = other.owner;
    else if (owner.role === "poa-holder") conflicts.poaHolder[owner.complainant] = other.owner;
    else if (owner.role === "accused")
      conflicts.accused[owner.accused][owner.contact] = other.owner;
    else conflicts.witness[owner.witness][owner.contact] = other.owner;
  }
  return conflicts;
}

/** The first complainant whose number, or PoA holder's number, clashes. */
export function firstComplainantClash(conflicts: MobileConflicts): number | undefined {
  const i = conflicts.complainant.findIndex((x, k) => x || conflicts.poaHolder[k]);
  return i >= 0 ? i : undefined;
}

/** The first accused with a contact number that clashes. */
export function firstAccusedClash(conflicts: MobileConflicts): number | undefined {
  const i = conflicts.accused.findIndex((rows) => rows.some(Boolean));
  return i >= 0 ? i : undefined;
}

/** The first witness with a contact number that clashes. */
export function firstWitnessClash(conflicts: MobileConflicts): number | undefined {
  const i = conflicts.witness.findIndex((rows) => rows.some(Boolean));
  return i >= 0 ? i : undefined;
}

/* ─────────────────────────── The filing advocate's own number ─────────────────────────── */

/**
 * The numbers on a complainant that may not be the advocate's: an individual's own, or an
 * institution's authorised representative's. Not the PoA holder's: the advocate may hold it.
 */
function complainantMobiles(c: Complainant): string[] {
  return c.type === "individual" ? [c.mobile] : [c.rep.mobile];
}

/** An accused's contact numbers, and those of everyone summoned for an accused entity. */
function accusedMobiles(a: Accused): string[] {
  const own = a.contacts.map((contact) => contact.mobile);
  return a.type === "individual" ? own : [...own, ...a.reps.map((r) => r.mobile)];
}

function witnessMobiles(w: Witness): string[] {
  return w.contacts.map((contact) => contact.mobile);
}

/** For each step, the first party with a number that is the filing advocate's own. */
export type AdvocateMobileClashes = {
  complainant?: number;
  accused?: number;
  witness?: number;
};

/**
 * Where a party has the filing advocate's own number, which stops Continue on that step
 * just as a clash between two parties does. `advocateMobile` is unknown (no check) unless
 * the filer is the advocate (`filingAdvocateMobile`).
 */
export function advocateMobileClashes(
  draft: FilingDraft,
  advocateMobile: string | undefined,
): AdvocateMobileClashes {
  if (!advocateMobile) return {};
  const first = <T>(rows: T[], mobiles: (row: T) => string[]): number | undefined => {
    const i = rows.findIndex((row) => mobiles(row).some((m) => sameMobile(m, advocateMobile)));
    return i >= 0 ? i : undefined;
  };
  return {
    complainant: first(draft.complainants, complainantMobiles),
    accused: first(draft.accused, accusedMobiles),
    witness: first(draft.witnesses, witnessMobiles),
  };
}
