"use client";

import React, { useState } from "react";
import GuideDrawer from "./guide-drawer";

interface GuideTriggerButtonProps {
  variant?: "header" | "floating";
}

export default function GuideTriggerButton({ variant = "header" }: GuideTriggerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "header" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-800 transition-colors shadow-xs border border-zinc-700/60 dark:border-zinc-800 hover:border-zinc-600 dark:hover:border-zinc-700 cursor-pointer"
          title="Open K SELECT Guide (Read-Only Internal Knowledge Assistant)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="text-white font-medium">Ask K SELECT</span>
          <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-amber-400/10 text-amber-300/90 border border-amber-400/25 leading-none">
            READ ONLY
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-zinc-900 text-white text-xs font-semibold shadow-2xl hover:scale-105 transition-all border border-zinc-700/80 hover:border-zinc-600 cursor-pointer"
          title="Ask K SELECT Guide"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="text-white font-medium">Ask K SELECT</span>
          <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-amber-400/10 text-amber-300/90 border border-amber-400/25 leading-none">
            READ ONLY
          </span>
        </button>
      )}

      <GuideDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
