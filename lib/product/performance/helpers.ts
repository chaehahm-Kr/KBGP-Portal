/**
 * Product Performance V2.0 — Safe Math & Period Helpers
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/helpers.ts
 */

import type { EvaluationPeriod } from "./types";

/**
 * Safe division that guarantees NaN, Infinity, -Infinity are never returned.
 * Returns null if denominator is 0, negative, or either argument is invalid.
 */
export function safeDiv(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined
  ) {
    return null;
  }

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    Number.isNaN(numerator) ||
    Number.isNaN(denominator)
  ) {
    return null;
  }

  if (Math.abs(denominator) < 1e-9) {
    return null;
  }

  const res = numerator / denominator;
  return Number.isFinite(res) && !Number.isNaN(res) ? res : null;
}

/**
 * Safe round to specified decimal places (default 2).
 */
export function safeRound(value: number | null | undefined, decimals = 2): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || Number.isNaN(value)) {
    return null;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculates calendar day difference (end - start).
 * E.g., daysBetween("2026-01-01", "2026-01-10") === 9
 */
export function daysBetween(startDateStr: string, endDateStr: string): number {
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  const diffMs = endUtc - startUtc;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() + days);
  return dateObj.toISOString().split("T")[0];
}

/**
 * Resolves standard America/New_York evaluation period.
 * Default is 60 days trailing window ending on asOfDate.
 */
export function resolveEvaluationPeriod(
  asOfDateInput?: string | Date,
  daysCount = 60
): EvaluationPeriod {
  const timeZone = "America/New_York";
  let d: Date;
  if (!asOfDateInput) {
    d = new Date();
  } else if (typeof asOfDateInput === "string") {
    d = new Date(`${asOfDateInput}T12:00:00Z`);
  } else {
    d = asOfDateInput;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const asOfDateStr = formatter.format(d);

  const periodEnd = asOfDateStr;
  const periodStart = addDays(asOfDateStr, -daysCount);
  const daysInPeriod = Math.max(1, daysBetween(periodStart, periodEnd));

  return {
    timezone: timeZone,
    asOfDate: asOfDateStr,
    periodStart,
    periodEnd,
    daysInPeriod,
  };
}

/**
 * Checks whether an event date falls within [periodStart, periodEnd] (inclusive).
 */
export function isWithinPeriod(dateStr: string, period: EvaluationPeriod): boolean {
  return dateStr >= period.periodStart && dateStr <= period.periodEnd;
}
