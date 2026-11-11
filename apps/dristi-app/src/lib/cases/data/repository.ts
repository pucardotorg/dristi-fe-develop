/**
 * Data contract for the cases list (`app/(app)/cases`).
 *
 * Shared by both teams and only grows: add methods, never rename or remove one that
 * `http.ts` already implements. The sandbox (`sandbox.ts`) answers every method from
 * the demo fixtures; engineering's `http.ts` answers them from the backend as it is
 * connected. `index.ts` picks one by `NEXT_PUBLIC_DATA_SOURCE`.
 */

import type { CaseRecord } from "../types";

export interface CasesRepository {
  /** Cases the signed-in advocate's office handles. */
  listOfficeCases(): Promise<CaseRecord[]>;
  /** Cases in which the signed-in person is a party. */
  listPartyCases(): Promise<CaseRecord[]>;
  /** "Today" as a date (YYYY-MM-DD). The sandbox pins it so its due dates read right. */
  today(): Promise<string>;
}
