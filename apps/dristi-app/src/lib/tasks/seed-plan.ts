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

export type SeedState = {
  /** This is the page's first read since it loaded. */
  firstPass: boolean;
  /** The demo starts over on every page load (`RESEED_ON_PAGE_LOAD`). */
  reseedOnLoad: boolean;
  hasPeople: boolean;
  /** The browser's data was seeded from the current stamp. */
  stampIsCurrent: boolean;
};

/**
 * What a read finds and what it does about it:
 * - an empty sandbox (first run, or just reset) is seeded;
 * - only on a page's first read, the demo starts over (wipe, then seed) when it is set to
 *   start over on every load, or when the data came from an older stamp (new day, new
 *   version, new fixtures);
 * - otherwise the sandbox keeps what was done in it, so a page left open past midnight
 *   keeps its work until it is reloaded.
 */
export function seedAction(state: SeedState): SeedAction {
  if (!state.hasPeople) return "seed";
  if (state.firstPass && (state.reseedOnLoad || !state.stampIsCurrent)) return "wipe-and-seed";
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
