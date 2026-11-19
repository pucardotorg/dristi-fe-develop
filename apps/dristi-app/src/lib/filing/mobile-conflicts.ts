/**
 * Mobile numbers two parties may not share, checked on the form before the filer moves on.
 *
 * A complainant's number may not be another complainant's, any accused's, or their own PoA
 * holder's. Another complainant's PoA holder may share it, as one complainant can hold the
 * power of attorney for another. A witness's number may not be any complainant's or any
 * accused's. A clash shows only on the field of the party entered later (see `shownOn`).
 * Pairs the rules do not name (two accused, two witnesses, a PoA holder and an accused or a
 * witness) are left alone.
 */

import { isIndianMobile, toNationalMobile } from "@/lib/auth/mobile";

import type { FilingDraft } from "./types";

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

function clash(a: MobileOwner, b: MobileOwner): boolean {
  if (b.role === "witness" && a.role !== "witness") return clash(b, a);
  if (a.role === "witness") return b.role === "complainant" || b.role === "accused";
  if (b.role === "complainant" && a.role !== "complainant") return clash(b, a);
  if (a.role !== "complainant") return false;
  return b.role !== "poa-holder" || b.complainant === a.complainant;
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
 * alone. Between two complainants, the later one is told.
 */
function shownOn(field: MobileOwner, other: MobileOwner): boolean {
  if (field.role === "complainant" && other.role === "complainant") {
    return other.complainant < field.complainant;
  }
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
