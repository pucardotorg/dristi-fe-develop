"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { getMessageCatalog, TIME_ZONE } from "@/i18n/messages";
import { renderLocale } from "@/lib/languages/languages";
import { DEFAULT_LOCALE, serializeLocaleCookie } from "@/lib/locale/cookie";
import type { Locale } from "@/lib/onboarding/content";

/**
 * App-wide language. The old Portal shell carried locale as a prop pair; on the one
 * shared shell it is context, so the top-bar toggle and every screen read the same
 * source. The choice is also kept in a cookie so the server renders the same language
 * on the next request.
 *
 * The backend decides which languages are offered (`lib/languages/`), so the chosen
 * `language` may be one the app has no text for; `locale` is what text renders in —
 * that language when the app has it, English otherwise.
 */
type LocaleValue = {
  /** The language text renders in. */
  locale: Locale;
  /** Switch to a language the app has text for (the switches beside sign-in and onboarding). */
  setLocale: (locale: Locale) => void;
  /** The chosen language's code, as the backend lists it. */
  language: string;
  /** Switch to any language the backend offers. */
  setLanguage: (code: string) => void;
  /** The language the person put beside the default in the top bar's switch, if any. */
  secondLanguage: string | null;
  /** Put a language beside the default, and switch to it. */
  setSecondLanguage: (code: string) => void;
};

const LocaleContext = React.createContext<LocaleValue | null>(null);

/** `request.ts` and the root layout read this cookie to render the chosen language. */
function persistLanguage(code: string) {
  try {
    document.cookie = serializeLocaleCookie(code);
  } catch {
    // Cookies blocked: the choice still applies until the page is reloaded.
  }
}

export function LocaleProvider({
  children,
  initialLanguage = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  /** The chosen language's code, from the cookie. */
  initialLanguage?: string;
}) {
  const router = useRouter();
  const [language, setLanguageState] = React.useState(initialLanguage);
  // A language being read was put beside the default on an earlier visit.
  const [secondLanguage, setSecond] = React.useState<string | null>(
    initialLanguage === DEFAULT_LOCALE ? null : initialLanguage,
  );
  const locale = renderLocale(language);

  /*
   * Server components render from the cookie, so a switch refreshes them. Changing the
   * state inside the same transition keeps the old language on screen until the
   * refreshed server output arrives, so the page never shows two languages at once.
   */
  const setLanguage = React.useCallback(
    (next: string) => {
      persistLanguage(next);
      React.startTransition(() => {
        setLanguageState(next);
        router.refresh();
      });
    },
    [router],
  );

  const setSecondLanguage = React.useCallback(
    (code: string) => {
      setSecond(code);
      setLanguage(code);
    },
    [setLanguage],
  );

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale: setLanguage,
      language,
      setLanguage,
      secondLanguage,
      setSecondLanguage,
    }),
    [locale, language, setLanguage, secondLanguage, setSecondLanguage],
  );

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={getMessageCatalog(locale)}
      timeZone={TIME_ZONE}
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
