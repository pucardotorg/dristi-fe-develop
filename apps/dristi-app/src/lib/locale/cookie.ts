import type { Locale } from "@/lib/onboarding/content";

/** next-intl's default cookie name, so its tooling recognises the cookie as-is. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const DEFAULT_LOCALE: Locale = "en";

/** A year: the choice should outlive a session but not linger forever. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Every `Locale`, as a record so adding a member to the union fails to compile here
 * until it is listed — the runtime check cannot drift from the type.
 */
const KNOWN_LOCALES: Record<Locale, true> = { en: true, ml: true, hi: true, gu: true, pa: true };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(KNOWN_LOCALES, value);
}

/** A cookie can be stale or hand-edited; anything unrecognised falls back to English. */
export function parseLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The `document.cookie` assignment that persists the chosen locale for the whole app. */
export function serializeLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
