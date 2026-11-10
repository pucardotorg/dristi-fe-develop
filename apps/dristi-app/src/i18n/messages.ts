import {createTranslator, type TranslationValues} from "next-intl";

import en from "../../messages/en.json";
import hi from "../../messages/hi.json";

export type MessageCatalog = Record<string, string>;

const CATALOGS: Record<string, MessageCatalog> = {en, hi};
const SOURCE_KEYS = new Map<string, Map<string, string>>();

function sourceKeys(locale: string): Map<string, string> {
  const catalogLocale = CATALOGS[locale] ? locale : "en";
  const cached = SOURCE_KEYS.get(catalogLocale);
  if (cached) return cached;

  const keys = new Map<string, string>();
  for (const [key, source] of Object.entries(getMessages(catalogLocale))) {
    if (!keys.has(source)) keys.set(source, key);
  }
  SOURCE_KEYS.set(catalogLocale, keys);
  return keys;
}

export function resolveMessageKey(
  locale: string,
  keyOrSourceText: string,
): string | undefined {
  if (Object.hasOwn(getMessages(locale), keyOrSourceText)) return keyOrSourceText;
  return sourceKeys(locale).get(keyOrSourceText);
}

/** Unsupported second languages retain the existing English fallback. */
export function getMessages(locale: string): MessageCatalog {
  return CATALOGS[locale] ?? en;
}

/**
 * Content models are plain TypeScript and cannot call React hooks. This is the
 * `next-intl` standalone equivalent of `useTranslations` for those models.
 */
export function translateMessage(
  locale: string,
  key: string,
  values?: TranslationValues,
): string {
  const messages = getMessages(locale);
  const messageKey = resolveMessageKey(locale, key);
  if (!messageKey) return key;

  const translator = createTranslator<MessageCatalog>({
    locale: CATALOGS[locale] ? locale : "en",
    messages,
    timeZone: "Asia/Kolkata",
  });
  if (values) return translator(messageKey, values);

  const message = translator.raw(messageKey);
  return typeof message === "string" ? message : key;
}
