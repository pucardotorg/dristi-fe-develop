/**
 * Data contract for the interface languages (the top bar's language switch).
 *
 * Shared by both teams and only grows: add methods, never rename or remove one that
 * `http.ts` already implements. The sandbox (`sandbox.ts`) answers from a fixed list;
 * engineering's `http.ts` answers from the backend. `index.ts` picks one by
 * `NEXT_PUBLIC_DATA_SOURCE`.
 */

import type { UiLanguage } from "../types";

export interface LanguagesRepository {
  /** Languages the interface may be shown in, in display order; the default among them. */
  listUiLanguages(signal?: AbortSignal): Promise<UiLanguage[]>;
}
