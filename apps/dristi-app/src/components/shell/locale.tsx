"use client";

import * as React from "react";
import { NextIntlClientProvider } from "next-intl";

import { getMessages } from "@/i18n/messages";
import type { Locale } from "@/lib/onboarding/content";
import {
  SECOND_LANGUAGE,
  SECOND_LANGUAGES,
  type SecondLanguage,
} from "@/lib/locale-config";

/**
 * App-wide language. The old Portal shell carried locale as a prop pair; on the one
 * shared shell it is context, so the top-bar toggle and every screen read the same
 * source. Catalog-backed screens follow this locale; existing regional-language copy
 * remains available through `pick`.
 */
type LocaleValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The language beside English in the top bar's switch — Hindi unless one is chosen. */
  secondLanguage: SecondLanguage;
  /** Put another language beside English, and switch to it. */
  setSecondLanguage: (language: SecondLanguage) => void;
};

const LocaleContext = React.createContext<LocaleValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = React.useState<Locale>(initialLocale);
  const [secondLanguage, setSecond] = React.useState<SecondLanguage>(
    (SECOND_LANGUAGES as readonly string[]).includes(initialLocale)
      ? (initialLocale as SecondLanguage)
      : SECOND_LANGUAGE,
  );

  const setSecondLanguage = React.useCallback((language: SecondLanguage) => {
    setSecond(language);
    setLocale(language);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<LocaleValue>(
    () => ({ locale, setLocale, secondLanguage, setSecondLanguage }),
    [locale, secondLanguage, setSecondLanguage],
  );

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={getMessages(locale)}
      timeZone="Asia/Kolkata"
    >
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </NextIntlClientProvider>
  );
}

export function useLocale(): LocaleValue {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>");
  return value;
}
