"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { getMessageCatalog, TIME_ZONE } from "@/i18n/messages";
import { checkSavedLanguage, renderLocale } from "@/lib/languages/languages";
import type { UiLanguagesState } from "@/lib/languages/types";
import { useUiLanguages } from "@/lib/languages/use-ui-languages";
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
  /** The language in use, as the backend lists it: the saved one, or English while the list can't be had. */
  language: string;
  /** Switch to any language the backend offers. */
  setLanguage: (code: string) => void;
  /** The language the person put beside the default in the top bar's switch, if any. */
  secondLanguage: string | null;
  /** Put a language beside the default, and switch to it. */
  setSecondLanguage: (code: string) => void;
  /**
   * The backend's language list. Read it here rather than calling `useUiLanguages` again,
   * so the switch and the language in use always agree on one answer.
   */
  uiLanguages: UiLanguagesState;
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
  const [savedLanguage, setLanguageState] = React.useState(initialLanguage);
  // A language being read was put beside the default on an earlier visit.
  const [secondLanguage, setSecond] = React.useState<string | null>(
    initialLanguage === DEFAULT_LOCALE ? null : initialLanguage,
  );
  /*
   * The backend's list decides whether the saved language still applies
   * (`checkSavedLanguage`). When the list can't be had, English shows for this visit and
   * the cookie keeps the saved choice. Known gap: only client-rendered text follows that
   * fallback; the pages that render text on the server from the cookie (terms, privacy,
   * support, and the filing application and documents pages) still show the saved
   * language until the backend answers again (owner accepted, 2026-11-26).
   */
  const uiLanguages = useUiLanguages();
  const check = checkSavedLanguage(uiLanguages, savedLanguage);
  // A language picked during this visit is shown even while the list can't be had.
  const [pickedThisVisit, setPickedThisVisit] = React.useState(false);
  const language = check.kind === "visit" && !pickedThisVisit ? check.to : savedLanguage;
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
        setPickedThisVisit(true);
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

  // The backend no longer offers the saved language: move to its default for good.
  const resetTo = check.kind === "reset" ? check.to : null;
  React.useEffect(() => {
    if (resetTo) setLanguage(resetTo);
  }, [resetTo, setLanguage]);

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
      uiLanguages,
    }),
    [locale, language, setLanguage, secondLanguage, setSecondLanguage, uiLanguages],
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
