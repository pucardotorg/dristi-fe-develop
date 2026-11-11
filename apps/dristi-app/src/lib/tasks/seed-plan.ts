/**
 * When the tasks sandbox (re)seeds, as pure decisions — the IndexedDB repository
 * (`data/indexeddb.ts`) acts on them. Nothing here touches storage, so it is tested
 * directly.
 */

import type { Person } from "./types";

/** The local calendar day, as YYYY-M-D (no zero padding). */
export function todayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * The stamp a seeded browser carries: the seed version, the day it was seeded, and
 * a signature of the seed's size. The sandbox bakes each hearing's absolute time at
 * seed, so a browser seeded yesterday shows an empty "today"; folding the day in
 * makes a new day reseed on the next load, as a version bump does. Folding the
 * people/case counts in makes *adding or removing* fixture matters (say, more of
 * the court docket) reseed on its own — without waiting for a matching SEED_VERSION
 * bump, which is easy to forget or to land a moment after the data and leave a
 * browser stamped current on incomplete data.
 */
export function seedStamp(seed: { version: number; day: string; people: number; cases: number }): string {
  return `${seed.version}@${seed.day}@${seed.people}x${seed.cases}`;
}

export type SeedAction = "keep" | "seed" | "wipe-and-seed";

/**
 * What a read finds and what it does about it:
 * - the first read on a fresh page load starts the demo over (wipe, then seed);
 * - an empty sandbox (first run, or just reset) is seeded;
 * - data seeded from an older stamp (new day, new version, new fixtures) starts over;
 * - otherwise the sandbox keeps what was done in it.
 */
export function seedAction(state: { freshPage: boolean; hasPeople: boolean; stampIsCurrent: boolean }): SeedAction {
  if (!state.hasPeople) return "seed";
  if (state.freshPage || !state.stampIsCurrent) return "wipe-and-seed";
  return "keep";
}

/**
 * People in their seeded order (you first, then the team), since IndexedDB returns rows
 * by key. Anyone not in the seed goes last, by name. Returns a new array.
 */
export function orderBySeed(people: Person[], seed: Person[]): Person[] {
  const rank = (p: Person) => {
    const i = seed.findIndex((x) => x.id === p.id);
    return i === -1 ? seed.length : i;
  };
  return [...people].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
