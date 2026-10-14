"use client";

import React from "react";
import { MetricState, ReorderRecommendationSignal } from "./types";

interface ReliabilityBadgeProps {
  signal?: ReorderRecommendationSignal;
  metricState?: MetricState;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function DataReliabilityBadge({
  signal,
  metricState,
  showIcon = true,
  size = "md",
  className = "",
}: ReliabilityBadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  if (signal) {
    switch (signal) {
      case "reorder_needed":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 ${sizeClasses} ${className}`}
          >
            {showIcon && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
            Reorder Needed
          </span>
        );
      case "sufficient_stock":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses} ${className}`}
          >
            {showIcon && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            Sufficient Stock
          </span>
        );
      case "overstock":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${sizeClasses} ${className}`}
          >
            {showIcon && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            Overstock
          </span>
        );
      case "needs_review":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 ${sizeClasses} ${className}`}
          >
            {showIcon && (
              <svg className="w-3 h-3 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            Needs Review
          </span>
        );
      case "insufficient_data":
      default:
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50 ${sizeClasses} ${className}`}
          >
            {showIcon && <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />}
            Insufficient Data
          </span>
        );
    }
  }

  if (metricState) {
    switch (metricState) {
      case "available":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 ${sizeClasses} ${className}`}
          >
            Estimated
          </span>
        );
      case "not_reported":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/40 ${sizeClasses} ${className}`}
          >
            Not Reported
          </span>
        );
      case "needs_review":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 ${sizeClasses} ${className}`}
          >
            Review Flag
          </span>
        );
      case "not_available":
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-medium bg-zinc-800 text-zinc-500 border border-zinc-700/30 ${sizeClasses} ${className}`}
          >
            N/A
          </span>
        );
      case "insufficient_data":
      default:
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 ${sizeClasses} ${className}`}
          >
            No Reliable Interval
          </span>
        );
    }
  }

  return null;
}
