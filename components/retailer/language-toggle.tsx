"use client";

import React, { useTransition } from "react";
import { useTranslation } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";

interface LanguageToggleProps {
  variant?: "compact" | "buttons" | "dropdown";
  className?: string;
}

export function LanguageToggle({ variant = "compact", className = "" }: LanguageToggleProps) {
  const { locale, setLocale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (newLocale: Locale) => {
    if (newLocale === locale) return;
    startTransition(async () => {
      await setLocale(newLocale);
    });
  };

  if (variant === "buttons") {
    return (
      <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold ${className}`}>
        <button
          type="button"
          onClick={() => handleSelect("en")}
          disabled={isPending}
          className={`px-3 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
            locale === "en"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <span>🇺🇸</span>
          <span>English</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelect("ko")}
          disabled={isPending}
          className={`px-3 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
            locale === "ko"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <span>🇰🇷</span>
          <span>한국어</span>
        </button>
      </div>
    );
  }

  // Default compact header toggle
  return (
    <div className={`flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 p-0.5 text-xs font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => handleSelect("en")}
        disabled={isPending}
        title="Switch to English"
        className={`px-2 py-1 rounded-md transition-all text-[11px] ${
          locale === "en"
            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold shadow-2xs"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
      >
        EN
      </button>
      <span className="text-zinc-300 dark:text-zinc-700 text-[10px] select-none">|</span>
      <button
        type="button"
        onClick={() => handleSelect("ko")}
        disabled={isPending}
        title="한국어로 전환"
        className={`px-2 py-1 rounded-md transition-all text-[11px] ${
          locale === "ko"
            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold shadow-2xs"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
      >
        한국어
      </button>
    </div>
  );
}
