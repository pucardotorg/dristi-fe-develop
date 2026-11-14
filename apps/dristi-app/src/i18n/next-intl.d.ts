import type { Locale } from "@/lib/onboarding/content";

import type en from "../../messages/en.json";

/**
 * Teaches next-intl the app's locales and message keys, so `t("…")` autocompletes and
 * a misspelt or missing key fails to compile instead of rendering the raw key.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
