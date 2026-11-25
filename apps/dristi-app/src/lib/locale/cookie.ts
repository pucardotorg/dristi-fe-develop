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

/**
 * A lowercase BCP 47 tag ("en", "ml", "en-in"). The backend decides which languages
 * exist, so the cookie may hold one the app has no text for; anything not shaped like a
 * tag is refused rather than escaped, since it goes into a cookie and `lang` attributes.
 */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;

export function isLanguageCode(value: unknown): value is string {
  return typeof value === "string" && LANGUAGE_CODE.test(value);
}

/** The chosen language's code; a missing or malformed cookie means English. */
export function parseLanguageCode(value: string | undefined): string {
  return isLanguageCode(value) ? value : DEFAULT_LOCALE;
}

/**
 * The `document.cookie` assignment that persists the chosen language for the whole app.
 * Any language code may be stored; `parseLocale` renders one without text in English.
 */
export function serializeLocaleCookie(code: string): string {
  if (!isLanguageCode(code)) throw new TypeError(`Not a language code: "${code}"`);
  return `${LOCALE_COOKIE}=${code}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
