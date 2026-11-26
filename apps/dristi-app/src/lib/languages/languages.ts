/**
 * The interface languages: reading the backend's list, and choosing which two languages
 * the top bar's switch puts side by side.
 *
 * The backend decides which languages are offered. The app supplies their text: a code
 * with no message catalog shows English (`renderLocale`), so a language the backend adds
 * works before its translations exist.
 */

import { DEFAULT_LOCALE, isLanguageCode, isLocale, parseLocale } from "@/lib/locale/cookie";
import { LANGUAGE_NAME, SECOND_LANGUAGE } from "@/lib/locale-config";

import type { UiLanguage, UiLanguagesState } from "./types";

/** The language the switch falls back to, before the backend's list arrives or without it. */
const BASE_LANGUAGE: string = DEFAULT_LOCALE;

/** The locale text renders in: the chosen language when the app has it, else English. */
export const renderLocale = parseLocale;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Backend `Language` rows → the languages the interface can use. Rows that don't declare
 * `ui` support, have no valid code, or repeat a code are left out; order is kept.
 */
export function toUiLanguages(rows: readonly unknown[]): UiLanguage[] {
  const seen = new Set<string>();
  const languages: UiLanguage[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const code = typeof row.code === "string" ? row.code.toLowerCase() : null;
    if (!isLanguageCode(code) || seen.has(code)) continue;
    if (!Array.isArray(row.supports) || !row.supports.includes("ui")) continue;
    const name = nonEmpty(row.name) ?? code;
    seen.add(code);
    languages.push({
      code,
      name,
      nativeName: nonEmpty(row.native_name) ?? name,
      isDefault: row.is_default === true,
    });
  }
  return languages;
}

/**
 * What the switch shows until the backend's list arrives, or when it can't: English, and
 * the chosen language (or Hindi). Codes the app doesn't name show as their code.
 */
export function fallbackLanguages(selected: string): UiLanguage[] {
  const second = selected === BASE_LANGUAGE ? SECOND_LANGUAGE : selected;
  return [BASE_LANGUAGE, second].map((code) => {
    const name = isLocale(code) ? LANGUAGE_NAME[code] : code;
    return { code, name, nativeName: name, isDefault: code === BASE_LANGUAGE };
  });
}

export type LanguagePair = {
  /** First in the switch: the backend's default language. */
  primary: UiLanguage;
  /** Beside it, when the list has more than one language. */
  second: UiLanguage | null;
  /** Every language but the primary: the dropdown's choices. */
  choices: UiLanguage[];
};

/**
 * The two languages side by side in the switch. The second is, in order: the one the
 * person put there, the language they are reading in, Hindi (the deployment's preferred
 * second language), then the first other language in the backend's order.
 */
export function languagePair(
  languages: readonly UiLanguage[],
  { selected, chosenSecond }: { selected: string; chosenSecond: string | null },
): LanguagePair | null {
  const primary = languages.find((l) => l.isDefault) ?? languages[0];
  if (!primary) return null;
  const choices = languages.filter((l) => l.code !== primary.code);
  const second =
    [chosenSecond, selected, SECOND_LANGUAGE]
      .map((code) => choices.find((l) => l.code === code))
      .find((l) => l !== undefined) ??
    choices[0] ??
    null;
  return { primary, second, choices };
}

/**
 * What to do with the saved language once the backend's list is known:
 *   - `keep` it (still loading, or the backend offers it);
 *   - `reset` it to the default language, cookie and all, when the backend no longer
 *     offers it;
 *   - show English for this `visit` only, keeping the cookie, when the list can't be had
 *     (any error, "not connected", or an empty list), so the saved choice returns once the
 *     backend answers again (owner, 2026-11-26).
 */
export type SavedLanguageCheck =
  { kind: "keep" } | { kind: "reset"; to: string } | { kind: "visit"; to: string };

export function checkSavedLanguage(listed: UiLanguagesState, saved: string): SavedLanguageCheck {
  if (listed.status === "loading") return { kind: "keep" };
  if (listed.status !== "ready" || listed.languages.length === 0) {
    return saved === BASE_LANGUAGE ? { kind: "keep" } : { kind: "visit", to: BASE_LANGUAGE };
  }
  if (listed.languages.some((l) => l.code === saved)) return { kind: "keep" };
  const fallback = listed.languages.find((l) => l.isDefault) ?? listed.languages[0];
  return { kind: "reset", to: fallback?.code ?? BASE_LANGUAGE };
}
