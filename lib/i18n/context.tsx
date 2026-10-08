"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Locale, Dictionary } from "./types";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "./types";
import { getDictionary } from "./index";
import { setLocaleAction } from "./actions";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  toggleLocale: () => Promise<void>;
  dict: Dictionary;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Sync with client-side storage if available on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_COOKIE_NAME) as Locale | null;
      if (stored && SUPPORTED_LOCALES.includes(stored) && stored !== locale) {
        setLocaleState(stored);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    
    // 1. Instant client state update
    setLocaleState(newLocale);

    // 2. Client cookie & localStorage
    try {
      localStorage.setItem(LOCALE_COOKIE_NAME, newLocale);
      document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch {
      // Ignore client storage errors
    }

    // 3. Server action persistence
    try {
      await setLocaleAction(newLocale);
    } catch (e) {
      console.warn("[i18n] Failed to persist locale to server:", e);
    }

    // 4. Soft refresh server components
    router.refresh();
  }, [router]);

  const toggleLocale = useCallback(async () => {
    const nextLocale: Locale = locale === "en" ? "ko" : "en";
    await setLocale(nextLocale);
  }, [locale, setLocale]);

  const dict = getDictionary(locale);

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        dict,
        t: dict,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    const fallbackDict = getDictionary(DEFAULT_LOCALE);
    return {
      locale: DEFAULT_LOCALE,
      setLocale: async () => {},
      toggleLocale: async () => {},
      dict: fallbackDict,
      t: fallbackDict,
    };
  }
  return context;
}

export function useLanguage() {
  return useTranslation();
}
