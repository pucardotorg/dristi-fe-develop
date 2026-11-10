import type {TranslationValues} from "next-intl";

import {translateMessage} from "@/i18n/messages";

type Translator = {
  (value: string, values?: TranslationValues): string;
  <T>(value: T): T;
};

/**
 * Synchronous server rendering uses the request catalog's English default. Client
 * components use the reactive hook in `use-translations.ts` for locale changes.
 * Non-string values pass through exactly as they do in the client adapter.
 */
export function useTranslations(): Translator {
  function translate(value: unknown, values?: TranslationValues): unknown {
    return typeof value === "string"
      ? translateMessage("en", value, values)
      : value;
  }

  // The guarded string branch and identity fallback implement these overloads.
  return translate as Translator;
}
