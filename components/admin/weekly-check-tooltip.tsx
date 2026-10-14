"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export interface WeeklyCheckTooltipProps {
  companyId: string;
  reportingWeek?: string | null;
  eligibleStoresCount: number;
  reportingStoresCount: number;
  inProgressStoresCount?: number;
  notStartedStoresCount?: number;
}

interface Coords {
  top: number;
  left: number;
  placement: "top" | "bottom";
  arrowLeft: number;
}

const TOOLTIP_WIDTH = 220;
const TOOLTIP_ESTIMATED_HEIGHT = 140;
const MARGIN = 8;
const VIEWPORT_PADDING = 12;

export function WeeklyCheckTooltip({
  companyId,
  reportingWeek,
  eligibleStoresCount,
  reportingStoresCount,
  inProgressStoresCount = 0,
  notStartedStoresCount,
}: WeeklyCheckTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const computedNotStarted =
    typeof notStartedStoresCount === "number"
      ? notStartedStoresCount
      : Math.max(0, eligibleStoresCount - reportingStoresCount - inProgressStoresCount);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const tooltipHeight = tooltipRef.current
      ? tooltipRef.current.offsetHeight
      : TOOLTIP_ESTIMATED_HEIGHT;

    // Viewport collision checks
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: "top" | "bottom" = "top";
    // Prefer top if enough space, otherwise bottom
    if (spaceAbove < tooltipHeight + MARGIN && spaceBelow > spaceAbove) {
      placement = "bottom";
    }

    let top = 0;
    if (placement === "bottom") {
      top = rect.bottom + scrollY + MARGIN;
    } else {
      top = rect.top + scrollY - tooltipHeight - MARGIN;
    }

    // Trigger center
    const triggerCenterX = rect.left + scrollX + rect.width / 2;
    const idealLeft = triggerCenterX - TOOLTIP_WIDTH / 2;

    const minLeft = scrollX + VIEWPORT_PADDING;
    const maxLeft = scrollX + window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING;
    const clampedLeft = Math.max(minLeft, Math.min(idealLeft, maxLeft));

    const arrowLeft = Math.max(16, Math.min(triggerCenterX - clampedLeft, TOOLTIP_WIDTH - 16));

    setCoords({
      top,
      left: clampedLeft,
      placement,
      arrowLeft,
    });
  }, []);

  const handleOpen = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const handleClose = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, updatePosition]);

  const statusColorClass =
    eligibleStoresCount > 0
      ? reportingStoresCount === eligibleStoresCount
        ? "text-emerald-600 dark:text-emerald-400 font-bold"
        : reportingStoresCount > 0 || inProgressStoresCount > 0
        ? "text-amber-600 dark:text-amber-400 font-bold"
        : "text-zinc-500 dark:text-zinc-400 font-medium"
      : "text-zinc-400 font-normal";

  return (
    <div className="relative inline-block">
      <Link
        ref={triggerRef}
        href={`/admin/retailers/${companyId}?tab=performance`}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        className={`text-[11px] hover:underline inline-flex items-center justify-center font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-0.5 transition-colors ${statusColorClass}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Weekly Check: ${reportingStoresCount} of ${eligibleStoresCount} submitted`}
      >
        {eligibleStoresCount > 0 ? (
          <span>
            {reportingStoresCount}/{eligibleStoresCount}
          </span>
        ) : (
          <span>—</span>
        )}
      </Link>

      {mounted &&
        isOpen &&
        eligibleStoresCount > 0 &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
            style={{
              position: "absolute",
              top: coords ? `${coords.top}px` : "-9999px",
              left: coords ? `${coords.left}px` : "-9999px",
              width: `${TOOLTIP_WIDTH}px`,
            }}
            className="z-50 p-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-950 text-white text-left shadow-2xl border border-zinc-700/80 animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* Tooltip Header */}
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1 mb-1.5 flex items-center justify-between">
              <span>Weekly Check</span>
              <span className="text-indigo-400 font-mono text-[10px]">
                {reportingWeek || "Current Week"}
              </span>
            </div>

            {/* Authoritative Store Status Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Submitted
                </span>
                <span className="font-bold text-emerald-400 text-xs">
                  {reportingStoresCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-300 flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  In Progress
                </span>
                <span className="font-bold text-amber-400 text-xs">
                  {inProgressStoresCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-300 flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" />
                  Not Started
                </span>
                <span className="font-bold text-zinc-400 text-xs">
                  {computedNotStarted}
                </span>
              </div>
            </div>

            {/* Micro Navigation Hint */}
            <div className="mt-2 pt-1 border-t border-zinc-800 text-[9px] text-zinc-400 text-center font-medium">
              Click to view in Retailer 360 →
            </div>

            {/* Arrow Caret */}
            {coords && (
              <div
                style={{
                  left: `${coords.arrowLeft}px`,
                  ...(coords.placement === "top"
                    ? { bottom: "-4px" }
                    : { top: "-4px" }),
                }}
                className={`absolute w-2 h-2 bg-zinc-900 dark:bg-zinc-950 border-zinc-700/80 transform rotate-45 pointer-events-none ${
                  coords.placement === "top"
                    ? "border-r border-b"
                    : "border-l border-t"
                }`}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
