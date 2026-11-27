/**
 * Which language sits beside English in the language switcher until the person picks
 * another: Hindi (owner, 2026-10-08: "keep the default as Hindi"). The languages the
 * top bar offers come from the backend (`lib/languages/`); Hindi is used only while the
 * backend lists it. A language without a message catalog shows English.
 */
export type SecondLanguage = "hi" | "gu" | "pa" | "ml";

export const SECOND_LANGUAGE: SecondLanguage = "hi";

/**
 * Each language the app has a `Locale` for, named in its own script. The top bar names
 * languages as the backend does (`native_name`); this map serves the switches the
 * backend doesn't feed yet and the moment before its list arrives.
 */
export const LANGUAGE_NAME: Record<"en" | SecondLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
  ml: "മലയാളം",
};
