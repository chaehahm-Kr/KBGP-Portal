"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface CompanyContactPopoverProps {
  contactName: string;
  contactTitle?: string;
  contactPosition?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface Coords {
  top: number;
  left: number;
  placement: "top" | "bottom";
  arrowLeft: number;
}

const POPOVER_WIDTH = 240;
const POPOVER_ESTIMATED_HEIGHT = 180;
const MARGIN = 8;
const VIEWPORT_PADDING = 12;

export function CompanyContactPopover({
  contactName,
  contactTitle,
  contactPosition,
  contactPhone,
  contactEmail,
}: CompanyContactPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const popoverHeight = popoverRef.current
      ? popoverRef.current.offsetHeight
      : POPOVER_ESTIMATED_HEIGHT;

    // Viewport collisions
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: "top" | "bottom" = "bottom";
    if (spaceBelow < popoverHeight + MARGIN && spaceAbove > spaceBelow) {
      placement = "top";
    }

    let top = 0;
    if (placement === "bottom") {
      top = rect.bottom + scrollY + MARGIN;
    } else {
      top = rect.top + scrollY - popoverHeight - MARGIN;
    }

    const triggerCenterX = rect.left + scrollX + rect.width / 2;
    const idealLeft = triggerCenterX - POPOVER_WIDTH / 2;

    const minLeft = scrollX + VIEWPORT_PADDING;
    const maxLeft = scrollX + window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
    const clampedLeft = Math.max(minLeft, Math.min(idealLeft, maxLeft));

    const arrowLeft = Math.max(16, Math.min(triggerCenterX - clampedLeft, POPOVER_WIDTH - 16));

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

    // Immediate reposition upon actual mount & dimension calculation
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  if (!contactName || contactName === "담당자 정보 없음") {
    return <span className="text-zinc-400 dark:text-zinc-500">담당자 정보 없음</span>;
  }

  const hasDetails = Boolean(contactTitle || contactPosition || contactPhone || contactEmail);

  return (
    <div className="inline-block">
      <span
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className="cursor-help font-semibold text-zinc-800 dark:text-zinc-200 border-b border-dashed border-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors focus:outline-hidden focus:ring-1 focus:ring-zinc-400 rounded-xs"
      >
        {contactName}
      </span>

      {mounted &&
        isOpen &&
        coords &&
        hasDetails &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${POPOVER_WIDTH}px`,
            }}
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
            className="z-50 p-3.5 rounded-xl border border-zinc-200/90 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 text-left pointer-events-auto transition-all animate-in fade-in-0 zoom-in-95 duration-100"
          >
            <div className="space-y-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <span className="font-bold text-zinc-950 dark:text-white text-xs">{contactName}</span>
                <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
                  주 컨택
                </span>
              </div>
              {contactTitle && (
                <div>
                  <span className="font-bold text-[10px] text-zinc-400 dark:text-zinc-500 block mb-0.5">직함</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">{contactTitle}</span>
                </div>
              )}
              {contactPosition && (
                <div>
                  <span className="font-bold text-[10px] text-zinc-400 dark:text-zinc-500 block mb-0.5">부서 / 포지션</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">{contactPosition}</span>
                </div>
              )}
              {contactPhone && (
                <div>
                  <span className="font-bold text-[10px] text-zinc-400 dark:text-zinc-500 block mb-0.5">연락처</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 font-medium">{contactPhone}</span>
                </div>
              )}
              {contactEmail && (
                <div>
                  <span className="font-bold text-[10px] text-zinc-400 dark:text-zinc-500 block mb-0.5">이메일</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 font-medium truncate block">{contactEmail}</span>
                </div>
              )}
            </div>

            {/* Triangle Arrow */}
            <div
              style={{ left: `${coords.arrowLeft}px` }}
              className={
                coords.placement === "bottom"
                  ? "absolute -top-1.5 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  : "absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }
            />
          </div>,
          document.body
        )}
    </div>
  );
}
