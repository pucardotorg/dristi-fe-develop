"use client";

import {useTranslations} from "@/i18n/use-translations";

type LocalizedTextProps =
  | {id: string; text?: never}
  | {id?: never; text: string};

/** JSON-backed copy for JSX text without adding a hook to every surrounding screen. */
export function LocalizedText({id, text}: LocalizedTextProps) {
  const t = useTranslations();
  return t(id ?? text);
}
