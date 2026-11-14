"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { getMessageCatalog, TIME_ZONE } from "@/i18n/messages";
import { serializeLocaleCookie } from "@/lib/locale/cookie";
import type { Locale } from "@/lib/onboarding/content";
import {
  SECOND_LANGUAGE,
  SECOND_LANGUAGES,
  type SecondLanguage,
} from "@/lib/locale-config";

/**
 * App-wide language. The old Portal shell carried locale as a prop pair; on the one
 * shared shell it is context, so the top-bar toggle and every screen read the same
 * source. The choice is also kept in a cookie so the server renders the same language
 * on the next request.
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

/** `request.ts` and the root layout read this cookie to render the chosen language. */
function persistLocale(locale: Locale) {
  try {
    document.cookie = serializeLocaleCookie(locale);
  } catch {
    // Cookies blocked: the choice still applies until the page is reloaded.
  }
}

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);
  const [secondLanguage, setSecond] = React.useState<SecondLanguage>(
    (SECOND_LANGUAGES as readonly string[]).includes(initialLocale)
      ? (initialLocale as SecondLanguage)
      : SECOND_LANGUAGE,
  );

  /*
   * Server components render from the cookie, so a switch refreshes them. Changing the
   * state inside the same transition keeps the old language on screen until the
   * refreshed server output arrives, so the page never shows two languages at once.
   */
  const setLocale = React.useCallback(
    (next: Locale) => {
      persistLocale(next);
      React.startTransition(() => {
        setLocaleState(next);
        router.refresh();
      });
    },
    [router],
  );

  const setSecondLanguage = React.useCallback(
    (language: SecondLanguage) => {
      setSecond(language);
      setLocale(language);
    },
    [setLocale],
  );

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<LocaleValue>(
    () => ({ locale, setLocale, secondLanguage, setSecondLanguage }),
    [locale, setLocale, secondLanguage, setSecondLanguage],
  );

  return (
    <NextIntlClientProvider locale={locale} messages={getMessageCatalog(locale)} timeZone={TIME_ZONE}>
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </NextIntlClientProvider>
  );
}

export function useLocale(): LocaleValue {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>");
  return value;
}
