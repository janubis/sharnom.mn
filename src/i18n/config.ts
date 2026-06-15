/** i18n configuration. Mongolian is the default; English added later. */
export const locales = ["mn", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "mn";
