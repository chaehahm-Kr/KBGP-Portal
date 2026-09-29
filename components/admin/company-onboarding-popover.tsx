"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export interface OnboardingStepItem {
  step: number;
  id: string;
  name: string;
  isComplete: boolean;
  isSkipped?: boolean;
}

export interface CompanyOnboardingPopoverProps {
  onboardingStatus?: "completed" | "in_progress" | "not_started" | "not_applicable";
  onboardingBadgeText?: string;
  completedCount?: number;
  totalCount?: number;
  steps?: OnboardingStepItem[];
  companyId?: string | null;
}

// ADM-APP-004-R3 / ADM-COMP-004-R3: 7-Step Short Display Labels & Portal Fixed Dynamic Positioning
const CANONICAL_SHORT_STEPS: { step: number; id: string; name: string }[] = [
  { step: 1, id: "company", name: "회사 정보" },
  { step: 2, id: "admin_profile", name: "관리자 정보" },
  { step: 3, id: "brand", name: "브랜드 정보" },
  { step: 4, id: "team", name: "팀원 초대" },
  { step: 5, id: "tasks", name: "담당자 지정" },
  { step: 6, id: "product", name: "상품 등록" },
  { step: 7, id: "agreement", name: "약관 서명" },
];

export function CompanyOnboardingPopover({
  onboardingStatus = "not_started",
  onboardingBadgeText = "0 / 7 미시작",
  completedCount = 0,
  totalCount = 7,
  steps = [],
  companyId,
}: CompanyOnboardingPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<"top" | "bottom">("bottom");
  const [coords, setCoords] = useState<{ left: number; top: number; arrowLeft: number }>({
    left: 0,
    top: 0,
    arrowLeft: 128,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isNna = onboardingStatus === "not_applicable";

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Fixed Admin Header height (64px) + safety margin (20px) = 84px
    const ADMIN_HEADER_SAFE_TOP = 84;
    const POPOVER_APPROX_HEIGHT = 270;
    const POPOVER_WIDTH = 256; // w-64

    // Check top edge if opened upward
    const topEdgeIfUpward = rect.top - POPOVER_APPROX_HEIGHT - 8;

    let placement: "top" | "bottom" = "top";
    // Force open BELOW if opening upward touches/overlaps top admin header area or rect.top < 360px
    if (topEdgeIfUpward < ADMIN_HEADER_SAFE_TOP || rect.top < 360) {
      placement = "bottom";
    } else if (window.innerHeight - rect.bottom < POPOVER_APPROX_HEIGHT + 20) {
      placement = "top";
    }

    setPopoverPlacement(placement);

    // Compute left coordinate & arrow offset
    const badgeCenterX = rect.left + rect.width / 2;
    let popoverLeft = badgeCenterX - POPOVER_WIDTH / 2;

    // Viewport horizontal bounds protection
    if (popoverLeft < 12) popoverLeft = 12;
    if (popoverLeft + POPOVER_WIDTH > window.innerWidth - 12) {
      popoverLeft = window.innerWidth - POPOVER_WIDTH - 12;
    }

    // Arrow relative offset on popover
    let arrowLeft = badgeCenterX - popoverLeft;
    arrowLeft = Math.max(16, Math.min(POPOVER_WIDTH - 16, arrowLeft));

    // Vertical top coordinate
    let popoverTop = 0;
    if (placement === "bottom") {
      popoverTop = rect.bottom + 8;
    } else {
      popoverTop = rect.top - POPOVER_APPROX_HEIGHT - 8;
    }

    setCoords({
      left: popoverLeft,
      top: popoverTop,
      arrowLeft,
    });
  }, []);

  const handleMouseEnter = () => {
    if (isNna) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    calculatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  // Recalculate position on scroll/resize while popover is open
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      calculatePosition();
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, calculatePosition]);

  const getBadgeStyle = (status: "completed" | "in_progress" | "not_started" | "not_applicable") => {
    if (status === "completed") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
    }
    if (status === "in_progress") {
      return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
    }
    if (status === "not_applicable") {
      return "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-700 cursor-default";
    }
    return "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  };

  const resolvedSteps = CANONICAL_SHORT_STEPS.map((cs) => {
    const found = steps.find((s) => s.step === cs.step || s.id === cs.id);
    return {
      step: cs.step,
      id: cs.id,
      name: cs.name,
      isComplete: Boolean(found?.isComplete),
      isSkipped: Boolean(found?.isSkipped),
    };
  });

  const displayCompletedCount = steps.length > 0 ? steps.filter((s) => s.isComplete).length : completedCount;

  const BadgeContent = (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer select-none ${getBadgeStyle(
        onboardingStatus
      )}`}
    >
      {onboardingBadgeText}
    </span>
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {companyId ? (
        <Link href={`/admin/companies/${companyId}`} title="온보딩 상세 보기 (회사 상세 이동)">
          {BadgeContent}
        </Link>
      ) : (
        BadgeContent
      )}

      {isOpen && !isNna && mounted && createPortal(
        <div
          ref={popoverRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: "fixed",
            left: `${coords.left}px`,
            top: `${coords.top}px`,
          }}
          className="z-[9999] w-64 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 text-left animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        >
          <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2 mb-2">
            <span className="text-[11px] font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>📋</span>
              <span>온보딩 진행 상태</span>
            </span>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 font-mono">
              {displayCompletedCount} / {totalCount} 완료
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {resolvedSteps.map((s) => (
              <div
                key={s.step}
                className={`flex items-center justify-between py-0.5 px-1.5 rounded transition-colors ${
                  s.isComplete
                    ? "bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-bold"
                    : "text-zinc-500 dark:text-zinc-400 font-medium"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] shrink-0 font-bold">
                    {s.isComplete ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">○</span>
                    )}
                  </span>
                  <span className="truncate">
                    <span className="text-[9px] text-zinc-400 mr-1 font-mono">STEP {s.step}</span>
                    <span>{s.name}</span>
                  </span>
                </div>
                {s.isComplete && s.isSkipped && (
                  <span className="ml-1 shrink-0 text-[9px] px-1 py-0.2 rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-normal">
                    건너뜀
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Dynamic Arrow Indicator */}
          {popoverPlacement === "top" ? (
            <div
              style={{ left: `${coords.arrowLeft}px` }}
              className="absolute top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
            />
          ) : (
            <div
              style={{ left: `${coords.arrowLeft}px` }}
              className="absolute bottom-full h-2 w-2 -translate-x-1/2 translate-y-1 rotate-45 border-l border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
