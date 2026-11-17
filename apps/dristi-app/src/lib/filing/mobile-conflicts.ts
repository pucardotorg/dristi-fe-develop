/**
 * Mobile numbers two parties may not share, checked on the form before the filer moves on.
 *
 * Every rule is about a complainant's number: it may not be another complainant's, any
 * accused's, or their own PoA holder's. Another complainant's PoA holder may share it, as
 * one complainant can hold the power of attorney for another. Pairs the rules do not name
 * (two accused, a PoA holder and an accused) are left alone.
 */

import { isIndianMobile, toNationalMobile } from "@/lib/auth/mobile";

import type { FilingDraft } from "./types";

/** Whose number a mobile field holds. Indices are positions in the draft's lists. */
export type MobileOwner =
  | { role: "complainant"; complainant: number }
  | { role: "poa-holder"; complainant: number }
  | { role: "accused"; accused: number; contact: number };

/** For each mobile field on the form, the party it clashes with, if any. */
export type MobileConflicts = {
  complainant: (MobileOwner | undefined)[];
  poaHolder: (MobileOwner | undefined)[];
  /** By accused, then by contact row. */
  accused: (MobileOwner | undefined)[][];
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
  return held;
}

function clash(a: MobileOwner, b: MobileOwner): boolean {
  if (b.role === "complainant" && a.role !== "complainant") return clash(b, a);
  if (a.role !== "complainant") return false;
  return b.role !== "poa-holder" || b.complainant === a.complainant;
}

export function mobileConflicts(draft: FilingDraft): MobileConflicts {
  const conflicts: MobileConflicts = {
    complainant: draft.complainants.map(() => undefined),
    poaHolder: draft.complainants.map(() => undefined),
    accused: draft.accused.map((a) => a.contacts.map(() => undefined)),
  };
  const held = heldNumbers(draft);
  for (const field of held) {
    const other = held.find(
      (x) => x !== field && x.national === field.national && clash(field.owner, x.owner),
    );
    if (!other) continue;
    const { owner } = field;
    if (owner.role === "complainant") conflicts.complainant[owner.complainant] = other.owner;
    else if (owner.role === "poa-holder") conflicts.poaHolder[owner.complainant] = other.owner;
    else conflicts.accused[owner.accused][owner.contact] = other.owner;
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
