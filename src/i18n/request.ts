/**
 * next-intl request config.
 *
 * We use a single default locale (mn) without URL prefixing for now, so SEO
 * URLs stay clean (/business/..., /category/...). When English is enabled,
 * switch to locale-prefixed routing here.
 */
import { getRequestConfig } from "next-intl/server";

import { defaultLocale } from "./config";

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
