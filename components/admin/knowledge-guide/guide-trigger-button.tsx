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
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-white transition shadow-xs border border-zinc-700/50"
          title="Open K SELECT Guide (Read-Only Internal Knowledge Assistant)"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Ask K SELECT</span>
          <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            READ ONLY
          </span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-zinc-900 text-white text-xs font-bold shadow-2xl hover:scale-105 transition border border-zinc-700"
          title="Ask K SELECT Guide"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Ask K SELECT</span>
          <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-amber-500/20 text-amber-300">
            READ ONLY
          </span>
        </button>
      )}

      <GuideDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
