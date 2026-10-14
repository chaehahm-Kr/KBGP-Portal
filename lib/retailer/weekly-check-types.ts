export interface WeeklyCheckItemState {
  id?: string;
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  sku: string;
  thumbnailUrl: string | null;
  reportedRemainingQty: number;
  previousReportedQty: number | null;
  deliveredSincePrevious: number | null;
  estimatedMovement: number | null;
  isCounted: boolean;
  notes: string | null;
  incomingQty?: number | null;
}

export interface WeeklyCheckSession {
  id: string;
  companyId: string;
  storeId: string;
  storeName: string;
  reportingWeek: string;
  reportDate: string;
  status: "draft" | "submitted" | "cancelled";
  totalProductsCount: number;
  totalCountedProducts: number;
  totalRemainingUnits: number;
  notes: string | null;
  isTest: boolean;
  startedAt: string;
  submittedAt: string | null;
  items: WeeklyCheckItemState[];
}

export interface WeeklyCheckHistorySummary {
  id: string;
  storeId: string;
  storeName: string;
  reportingWeek: string;
  reportDate: string;
  status: string;
  totalProductsCount: number;
  totalCountedProducts: number;
  totalRemainingUnits: number;
  submittedAt: string | null;
}

/**
 * Returns current ISO week format string, e.g. "2026-W39"
 */
export function getCurrentReportingWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Canonical route helper for Weekly Inventory navigation across Portal domains.
 * Uses clean /check on portal.kselecthub.com and /retailer/check on other domains / localhost.
 */
export function getWeeklyCheckPath(
  subpath: string = "",
  queryParams: Record<string, string> = {}
): string {
  let base = "/retailer/check";
  if (typeof window !== "undefined" && window.location.host.includes("portal.kselecthub.com")) {
    base = "/check";
  }
  const cleanSubpath = subpath
    ? subpath.startsWith("/")
      ? subpath
      : `/${subpath}`
    : "";
  const entries = Object.entries(queryParams).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  const qs = new URLSearchParams(entries).toString();
  return `${base}${cleanSubpath}${qs ? `?${qs}` : ""}`;
}
