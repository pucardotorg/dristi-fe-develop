/** A language the interface can be shown in, as the backend lists it. */
export type UiLanguage = {
  /** Lowercase BCP 47 tag, for example "en", "ml" or "en-in". */
  code: string;
  /** English name, for example "Malayalam". */
  name: string;
  /** Name in the language itself, shown in the switcher ("മലയാളം"). */
  nativeName: string;
  /** The fallback language. The backend marks exactly one. */
  isDefault: boolean;
};
