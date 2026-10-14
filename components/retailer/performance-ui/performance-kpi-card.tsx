"use client";

import React from "react";
import { KpiCardProps } from "./types";

export function PerformanceKpiCard({
  label,
  value,
  state = "available",
  format = "units",
  subtext,
  trendNotice,
  iconName,
  tooltipNotice,
  className = "",
}: KpiCardProps) {
  // Format the numerical value
  const renderValue = () => {
    if (state === "insufficient_data") {
      return (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-400">Insufficient Data</span>
          <span className="text-[11px] text-zinc-500">Requires 2+ weekly counts</span>
        </div>
      );
    }

    if (state === "not_reported") {
      return (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-400">Not Reported</span>
          <span className="text-[11px] text-zinc-500">No count submitted</span>
        </div>
      );
    }

    if (state === "needs_review") {
      return (
        <div className="flex flex-col">
          <span className="text-base font-bold text-amber-300">Needs Review</span>
          <span className="text-[11px] text-amber-400/80">Variance detected</span>
        </div>
      );
    }

    if (state === "not_available" || value === null || isNaN(value)) {
      return (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-400">Not Available</span>
          <span className="text-[11px] text-zinc-500">Pricing/data missing</span>
        </div>
      );
    }

    // Available state: format by type
    if (format === "currency") {
      return (
        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }

    if (format === "percent") {
      return (
        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {value.toFixed(1)}%
        </span>
      );
    }

    if (format === "count") {
      return (
        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {value.toLocaleString()}
        </span>
      );
    }

    // Default units
    return (
      <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value.toLocaleString()} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">units</span>
      </span>
    );
  };

  const getIconSvg = () => {
    switch (iconName) {
      case "sales":
        return (
          <svg className="w-5 h-5 text-indigo-500 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        );
      case "revenue":
        return (
          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "profit":
        return (
          <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case "margin":
        return (
          <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case "coverage":
        return (
          <svg className="w-5 h-5 text-sky-600 dark:text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "incoming":
        return (
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
          </svg>
        );
      case "reorder":
        return (
          <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm ${className}`}
    >
      {/* Header with Title and Icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        {iconName && (
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50">
            {getIconSvg()}
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-1">{renderValue()}</div>

      {/* Subtext and Trend/Notice */}
      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>{subtext || "Based on submitted inventory"}</span>
        {trendNotice && (
          <span className="font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {trendNotice}
          </span>
        )}
      </div>

      {/* Informational Tooltip Banner if provided */}
      {tooltipNotice && (
        <div className="mt-1 text-[10px] text-zinc-500 italic">
          *{tooltipNotice}
        </div>
      )}
    </div>
  );
}
