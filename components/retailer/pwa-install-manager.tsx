"use client";

import React, { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaStatus() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // 1. Check standalone mode
    const isStandaloneDisplay =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(Boolean(isStandaloneDisplay));

    // 2. Check iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Online/Offline state
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 4. Capture beforeinstallprompt event (Chrome / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  return {
    isStandalone,
    isInstallable: Boolean(deferredPrompt),
    isIos,
    isOnline,
    promptInstall,
  };
}

export function PwaInstallAffordance({ variant = "account" }: { variant?: "account" | "header" | "drawer" }) {
  const { isStandalone, isInstallable, isIos, isOnline, promptInstall } = usePwaStatus();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await promptInstall();
      if (ok) setInstallSuccess(true);
    } else if (isIos) {
      setShowIosGuide(!showIosGuide);
    }
  };

  if (variant === "header") {
    if (isStandalone) return null;
    if (!isInstallable && !isIos) return null;

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        title="Install K SELECT HUB App"
      >
        <span>📱</span>
        <span>Install App</span>
      </button>
    );
  }

  if (variant === "drawer") {
    if (isStandalone) {
      return (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-xs font-semibold">
          <span>✓</span>
          <span>Running in Standalone App Mode</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <span>📱</span>
          <span>Add to Home Screen (PWA)</span>
        </button>

        {showIosGuide && (
          <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 space-y-1">
            <p className="font-bold">To install on iPhone / iPad:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-zinc-600 dark:text-zinc-400">
              <li>Tap the <strong className="text-zinc-900 dark:text-white">Share</strong> button (box with arrow)</li>
              <li>Scroll down and tap <strong className="text-zinc-900 dark:text-white">&apos;Add to Home Screen&apos;</strong></li>
              <li>Tap <strong className="text-zinc-900 dark:text-white">Add</strong> to complete</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  // Default "account" card layout
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
            📱
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Mobile App & Pilot Store PWA
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Home-screen launch, offline safety, and camera scanner readiness
            </p>
          </div>
        </div>

        {isStandalone ? (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Standalone App
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Web Browser Mode
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-900 dark:text-white">PWA Identity</span>
            <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">portal.kselecthub.com</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Official K SELECT HUB Retailer Portal configured for direct home-screen launch with isolated sessions.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-900 dark:text-white">Network & Sync Status</span>
            {isOnline ? (
              <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Connection
              </span>
            ) : (
              <span className="font-bold text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Offline
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Real-time server synchronization guarantees authoritative price tags, stock movements, and order transactions.
          </p>
        </div>
      </div>

      {/* Installation Action / Guidance */}
      {!isStandalone && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-zinc-900 dark:text-white">Install App for Floor Staff</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Install to home screen for full-screen camera scanning and seamless weekly inventory checks.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span>⬇️</span>
                <span>Install PWA</span>
              </button>
            )}

            {isIos && (
              <button
                type="button"
                onClick={() => setShowIosGuide(!showIosGuide)}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>🍏</span>
                <span>iOS Installation Steps</span>
              </button>
            )}
          </div>
        </div>
      )}

      {showIosGuide && !isStandalone && (
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-zinc-700 dark:text-zinc-300 space-y-2 animate-in fade-in duration-200">
          <p className="font-bold text-indigo-900 dark:text-indigo-300">How to install on iOS Safari:</p>
          <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>Open Safari and navigate to <strong className="text-zinc-900 dark:text-white">https://portal.kselecthub.com</strong></li>
            <li>Tap the <strong className="text-zinc-900 dark:text-white">Share</strong> icon (the square with the upward arrow at the bottom toolbar)</li>
            <li>Scroll down and select <strong className="text-zinc-900 dark:text-white">&apos;Add to Home Screen&apos;</strong></li>
            <li>Tap <strong className="text-zinc-900 dark:text-white">Add</strong> in the top-right corner to launch from your device home screen</li>
          </ol>
        </div>
      )}

      {installSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          ✓ App installation initiated! Launch K SELECT HUB directly from your home screen.
        </div>
      )}
    </div>
  );
}
