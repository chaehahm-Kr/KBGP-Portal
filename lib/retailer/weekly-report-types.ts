export type WeeklyReportCoverageStatus = "full" | "partial" | "none";

export interface WeeklyReportStoreStatus {
  storeId: string;
  storeName: string;
  hasSubmitted: boolean;
  status: "submitted" | "in_progress" | "not_started";
  checkId: string | null;
  submittedAt: string | null;
  countedProducts: number;
  totalProducts: number;
  remainingUnits: number;
}

export type WeeklyInventoryItemStatus =
  | "submitted"
  | "baseline"
  | "in_progress"
  | "not_reported"
  | "zero_stock";

export interface WeeklyReportItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  brandId: string;
  sku: string;
  thumbnailUrl: string | null;
  category: string;
  categoryLabel: string;
  cartonPackQty: number;
  moq: number;
  orderMultiple: number;
  wholesalePrice: number;
  retailPrice: number; // Effective SRP
  priceSource: string;
  
  // Weekly Stock & Movement
  reportedRemaining: number | null;
  inventoryStatus: WeeklyInventoryItemStatus;
  previousRemaining: number | null;
  deliveredSincePrevious: number | null;
  estimatedUnitsSold: number | null;
  estimatedRetailSales: number | null;
  estimatedGrossProfit: number | null;
  grossMarginPercent: number | null;
  hasBaselineOnly: boolean; // First check, no prior baseline to compute delta
  movementStatus: "normal" | "baseline" | "variance" | "no_data";
  
  // Incoming & Reorder
  incomingQty: number; // pending + in-transit
  inTransitQty: number;
  pendingQty: number;
  reorderNeeded: boolean;
  suggestedReorderQty: number;
  suggestedCases: number;
  reorderReason?: string;
  reorderType?: "stock_based" | "velocity_based" | "needs_check" | "none";
  
  // Store Breakdown if company view
  storeCounts?: Array<{
    storeId: string;
    storeName: string;
    remaining: number | null;
    unitsSold: number | null;
    status: "submitted" | "not_submitted";
  }>;
}

export interface AvailableReportingWeek {
  week: string; // e.g. "2026-W42"
  label: string; // e.g. "Week 42 (Oct 12 – Oct 18, 2026)"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  hasSubmissions: boolean;
}

export interface WeeklyReportData {
  companyId: string;
  companyName: string;
  userRole: string;
  isFinancialsHidden: boolean;
  
  // Selected Context
  reportingWeek: string;
  formattedWeekLabel: string;
  isCurrentWeek: boolean;
  availableWeeks: AvailableReportingWeek[];
  
  selectedStoreId: string | "all";
  selectedStoreName: string;
  accessibleStores: Array<{ id: string; name: string }>;
  
  // Coverage
  coverageStatus: WeeklyReportCoverageStatus;
  totalStores: number;
  submittedStoresCount: number;
  storeStatuses: WeeklyReportStoreStatus[];
  
  // Top Authoritative Summary KPIs
  summary: {
    totalEstimatedRetailSales: number | null;
    totalEstimatedGrossProfit: number | null;
    averageGrossMargin: number | null;
    totalEstimatedUnitsSold: number | null;
    totalRemainingUnits: number | null;
    productsNeedingReorderCount: number;
    totalSuggestedReorderUnits: number;
    totalIncomingUnits: number;
    hasBaselineOnlyOverall: boolean;
    coverageNotice?: string;
    priceBasisNotice: string;
  };
  
  // Product List
  items: WeeklyReportItem[];
}
