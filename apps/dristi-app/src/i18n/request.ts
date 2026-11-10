import {getRequestConfig} from "next-intl/server";

import en from "../../messages/en.json";

/**
 * Server components use English until a locale is explicitly supplied. Interactive
 * screens receive the selected locale and catalogs from `LocaleProvider`.
 */
export default getRequestConfig(async () => ({
  locale: "en",
  messages: en,
  timeZone: "Asia/Kolkata",
}));
