import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { getMessageCatalog, TIME_ZONE } from "@/i18n/messages";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale/cookie";

/**
 * The language comes from the cookie the switcher writes, so server components render
 * in the same language as client components. No cookie, or an unrecognised value,
 * means English.
 */
export default getRequestConfig(async () => {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: getMessageCatalog(locale), timeZone: TIME_ZONE };
});
