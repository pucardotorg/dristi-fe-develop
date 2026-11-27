/**
 * The languages repository against the DRISTI backend. Engineering owns this file.
 *
 *   listUiLanguages   GET /languages?supports=ui   → paginated Language rows
 *
 * The endpoint needs no sign-in, so the switch works on public pages too.
 */

import { api, type Page } from "@/lib/api";

import { toUiLanguages } from "../languages";
import type { UiLanguage } from "../types";
import type { LanguagesRepository } from "./repository";

/** A runaway `next` link must not loop forever; a real list fits on the first page. */
const MAX_PAGES = 10;

export class HttpLanguagesRepository implements LanguagesRepository {
  async listUiLanguages(signal?: AbortSignal): Promise<UiLanguage[]> {
    const rows: unknown[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await api.get<Page<unknown>>("languages", {
        query: { supports: "ui", page },
        signal,
      });
      rows.push(...result.results);
      if (!result.next) break;
    }
    return toUiLanguages(rows);
  }
}
