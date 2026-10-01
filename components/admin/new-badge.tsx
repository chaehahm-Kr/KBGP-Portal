import React from "react";

interface NewBadgeProps {
  className?: string;
}

export function NewBadge({ className = "" }: NewBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-500 text-white dark:bg-amber-400 dark:text-zinc-950 shadow-2xs shrink-0 select-none animate-in fade-in zoom-in-95 duration-150 ${className}`}
      title="관리자 미확인 신규 항목"
    >
      NEW
    </span>
  );
}
