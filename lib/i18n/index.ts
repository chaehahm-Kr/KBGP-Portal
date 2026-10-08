import { enDictionary } from "./dictionaries/en";
import { koDictionary } from "./dictionaries/ko";
import type { Locale, Dictionary } from "./types";
import { DEFAULT_LOCALE } from "./types";

export * from "./types";
export * from "./context";

const dictionaries: Record<Locale, Dictionary> = {
  en: enDictionary,
  ko: koDictionary,
};

/**
 * Returns the dictionary for the given locale with recursive fallback to English.
 */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  const selected = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
  if (locale === DEFAULT_LOCALE) {
    return selected;
  }
  // Deep merge with English fallback to guarantee zero missing keys
  return mergeWithFallback(enDictionary, selected);
}

function mergeWithFallback(fallback: any, target: any): any {
  if (!target || typeof target !== "object") return fallback;
  const result: any = Array.isArray(fallback) ? [...fallback] : { ...fallback };
  for (const key of Object.keys(target)) {
    if (target[key] !== undefined && target[key] !== null) {
      if (typeof target[key] === "object" && !Array.isArray(target[key])) {
        result[key] = mergeWithFallback(fallback[key] || {}, target[key]);
      } else {
        result[key] = target[key];
      }
    }
  }
  return result;
}
