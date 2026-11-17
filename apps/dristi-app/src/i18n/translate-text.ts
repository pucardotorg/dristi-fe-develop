import type { MessageKey } from "@/i18n/messages";

/** The parts of next-intl's translator this needs; useTranslations and getTranslations both give one. */
type Translator = {
  (key: MessageKey): string;
  has(key: MessageKey): boolean;
};

/**
 * Text that may be a message key. A key is translated; anything else (a name, a value from
 * the back end) is returned as it is, and so is a missing value. For shared types such as
 * `Option.label`, which hold keys from fixed lists and names from data.
 */
export function translateText<Text extends string | null | undefined>(
  t: Translator,
  text: Text,
): Text | string {
  if (text == null) return text;
  // has() confirms the key exists before t() is called, so this cast never reaches t() with a non-key.
  const key = text as MessageKey;
  return t.has(key) ? t(key) : text;
}
