"use client";

import {
  useLocale,
  useTranslations as useNextTranslations,
  type TranslationValues,
} from "next-intl";

import { resolveMessageKey } from "@/i18n/messages";

/**
 * Translate generated keys and legacy shared labels alike. The source-text form
 * is useful for module-level label tables: they remain ordinary typed strings,
 * while their rendered values still come from the active JSON catalog.
 */
type Translator = {
  (value: string, values?: TranslationValues): string;
  <T>(value: T): T;
};

export function useTranslations(): Translator {
  const locale = useLocale();
  const t = useNextTranslations();

  function translate(value: unknown, values?: TranslationValues): unknown {
    if (typeof value !== "string") return value;
    const key = resolveMessageKey(locale, value);
    return key ? t(key, values) : value;
  }

  // The non-string overload is an identity operation; the string overload is
  // guaranteed by the guarded branch above, so the callable type is safe.
  return translate as Translator;
}
