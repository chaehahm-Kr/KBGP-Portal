import { cache } from "react";
import { cookies } from "next/headers";
import type { Locale } from "./types";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "./types";
import { getDictionary } from "./index";

export const getServerLocale = cache(async (): Promise<Locale> => {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale | undefined;
    if (cookieVal && SUPPORTED_LOCALES.includes(cookieVal)) {
      return cookieVal;
    }
  } catch {
    // Fallback if cookies() unavailable
  }
  return DEFAULT_LOCALE;
});

export const getServerTranslations = cache(async () => {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  return {
    locale,
    dict,
    t: dict,
  };
});
