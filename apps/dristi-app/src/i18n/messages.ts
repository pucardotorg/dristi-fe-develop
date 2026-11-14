import { createTranslator, type TranslationValues } from "next-intl";

import type { Locale } from "@/lib/onboarding/content";

import en from "../../messages/en.json";
import hi from "../../messages/hi.json";

export type MessageCatalog = Record<string, string>;

/** Every key in the English source catalog — the keys the app may reference. */
export type MessageKey = keyof typeof en;

/** One zone for every locale: DRISTI's courts all sit in India. */
export const TIME_ZONE = "Asia/Kolkata";

const ENGLISH: MessageCatalog = en;

/**
 * Locales with a JSON catalog. Each catalog is laid over English, so a key missing from
 * a partly translated catalog shows English instead of a raw key. Locales without a
 * catalog (Gujarati, Punjabi) show English; Malayalam stays inline in `Copy` objects
 * and is read through `pick` until it moves to its own catalog.
 */
const CATALOGS: Partial<Record<Locale, MessageCatalog>> = {
  en: ENGLISH,
  hi: { ...ENGLISH, ...hi },
};

export function getMessageCatalog(locale: Locale): MessageCatalog {
  return CATALOGS[locale] ?? ENGLISH;
}

type Translate = (key: string, values?: TranslationValues) => string;

const TRANSLATORS = new Map<Locale, Translate>();

function translatorFor(locale: Locale): Translate {
  const cached = TRANSLATORS.get(locale);
  if (cached) return cached;
  const t = createTranslator({ locale, messages: getMessageCatalog(locale), timeZone: TIME_ZONE });
  const translate: Translate = (key, values) => t(key, values);
  TRANSLATORS.set(locale, translate);
  return translate;
}

/**
 * Translate a catalog key outside React — content models, `pick`, `fillCopy` — where
 * hooks cannot run. An unknown key is returned as-is, never a guess from its text:
 * the catalog tests fail on any reference to a missing key.
 */
export function translateMessage(locale: Locale, key: string, values?: TranslationValues): string {
  if (!Object.hasOwn(getMessageCatalog(locale), key)) return key;
  return translatorFor(locale)(key, values);
}
