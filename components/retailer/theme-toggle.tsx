"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light" | "system";

export function ThemeToggle({
  variant = "dropdown",
}: {
  variant?: "dropdown" | "buttons" | "compact";
}) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("theme") as ThemeMode) || "dark";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
      }
    } else if (mode === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  };

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem("theme", mode);
    applyTheme(mode);
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 text-xs text-zinc-400">
        <span className="w-4 h-4 rounded-full bg-zinc-800 animate-pulse" />
        <span>Theme</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={() => handleSelect(theme === "dark" ? "light" : "dark")}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        title={`Current: ${theme}. Click to toggle.`}
      >
        {theme === "light" ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Light</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <span>Dark</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/90 p-1 text-xs">
      <button
        type="button"
        onClick={() => handleSelect("dark")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
          theme === "dark"
            ? "bg-zinc-800 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        Dark
      </button>
      <button
        type="button"
        onClick={() => handleSelect("light")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
          theme === "light"
            ? "bg-zinc-800 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Light
      </button>
      <button
        type="button"
        onClick={() => handleSelect("system")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
          theme === "system"
            ? "bg-zinc-800 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        System
      </button>
    </div>
  );
}
