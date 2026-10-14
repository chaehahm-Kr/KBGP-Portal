/**
 * RTP-PERFORMANCE-P6-DESIGN-001
 * Presentation-Only Component Prop Interfaces for Product Performance UI
 */

export type PerformancePeriod = "7d" | "30d" | "90d" | "all";
export type ReorderCoverageTarget = "30d" | "60d";

export type MetricState =
  | "available"
  | "insufficient_data"
  | "needs_review"
  | "not_available"
  | "not_reported";

export type ReorderRecommendationSignal =
  | "reorder_needed"
  | "sufficient_stock"
  | "overstock"
  | "insufficient_data"
  | "needs_review";

export interface FormattedMetricValue {
  value: number | null;
  state: MetricState;
  formattedText?: string;
  tooltipNotice?: string;
}

export interface KpiCardProps {
  label: string;
  value: number | null;
  state?: MetricState;
  format?: "currency" | "units" | "percent" | "count";
  subtext?: string;
  trendNotice?: string;
  iconName?: "sales" | "revenue" | "profit" | "margin" | "coverage" | "incoming" | "reorder";
  tooltipNotice?: string;
  className?: string;
}

export interface ReorderRecommendationPanelProps {
  productId: string;
  productName: string;
  sku: string;
  cartonPackQty: number; // MOQ / case multiple
  coverageTarget: ReorderCoverageTarget;
  onCoverageChange?: (target: ReorderCoverageTarget) => void;
  currentReportedStock: number | null;
  postReportReceipts: number;
  projectedAvailableStock: number | null;
  dailyVelocity: number;
  targetDemand: number;
  eligibleIncoming: number;
  rawReorderNeed: number;
  suggestedCases: number;
  suggestedReorderQty: number;
  signal: ReorderRecommendationSignal;
  signalReason?: string;
  isOrderable: boolean;
  wholesalePrice: number | null;
  selectedStoreId?: string | "all";
  selectedStoreName?: string;
  // P4 Add to Cart Action
  onAddToCart?: (productId: string, quantity: number, storeId?: string) => void;
  // P4 Integration Hook Placeholder (Backwards-compatibility)
  onAddToCartPlaceholder?: (productId: string, quantity: number) => void;
}

export interface InventoryFlowSummaryProps {
  orderedQty: number;
  confirmedShippedQty: number;
  pendingQty: number;
  inTransitQty: number;
  estimatedReceivedQty: number;
  incomingQty: number;
  nextEstimatedReceiptDate: string | null;
  postReportEstimatedReceipts?: number;
  lastReportDate?: string | null;
}

export interface StoreBreakdownRow {
  storeId: string;
  storeName: string;
  reportedStock: number | null;
  lastReportDate: string | null;
  incomingQty: number;
  inTransitQty: number;
  estimatedMovement: number | null;
  avgWeeklyMovement: number | null;
  dailyVelocity: number;
  weeksOfSupply: number | null;
  signal: ReorderRecommendationSignal;
  suggestedReorderQty?: number;
}

export interface StorePerformanceBreakdownViewProps {
  stores: StoreBreakdownRow[];
  coverageTarget: ReorderCoverageTarget;
  cartonPackQty: number;
  productId?: string;
  isOrderable?: boolean;
  onAddToCartStore?: (storeId: string, storeName: string, quantity: number) => void;
}

export interface PerformanceProductRowData {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  brandName: string;
  sku: string;
  thumbnailUrl: string | null;
  categoryLabel: string;
  cartonPackQty: number;
  wholesalePrice: number | null;
  msrp: number | null;

  // Performance metrics
  periodEstUnitsSold: number | null;
  periodEstRetailSales: number | null;
  periodEstGrossProfit: number | null;
  periodEstGrossMargin: number | null;
  financialState: MetricState;

  // Stock & Movement
  reportedStock: number | null;
  incomingQty: number;
  avgWeeklySales: number | null;

  // Reorder Recommendation (P3)
  coverageTarget: ReorderCoverageTarget;
  suggestedReorderQty: number;
  suggestedCases: number;
  reorderSignal: ReorderRecommendationSignal;

  isOrderable: boolean;

  // Store-level Breakdown for Multi-store Disambiguation
  storesBreakdown?: Array<{
    storeId: string;
    storeName: string;
    suggestedReorderQty: number;
    rawReorderNeed: number;
    signal: ReorderRecommendationSignal;
  }>;
}

export interface PerformanceProductRowProps {
  product: PerformanceProductRowData;
  selectedStoreId?: string | "all";
  onSelectProduct?: (productId: string) => void;
  // P4 Add to Cart callback
  onAddToCart?: (product: PerformanceProductRowData, storeId?: string, quantity?: number) => void;
  // P4 Add to Cart callback placeholder (Backwards-compatibility)
  onAddToCartPlaceholder?: (productId: string, quantity: number) => void;
}

export interface PerformanceFilterBarProps {
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | "all";
  onStoreChange: (storeId: string | "all") => void;

  selectedPeriod: PerformancePeriod;
  onPeriodChange: (period: PerformancePeriod) => void;

  selectedCoverage: ReorderCoverageTarget;
  onCoverageChange: (coverage: ReorderCoverageTarget) => void;

  searchQuery: string;
  onSearchChange: (query: string) => void;

  activeFilterTab: "all" | "reorder_needed" | "needs_review" | "has_incoming";
  onFilterTabChange: (tab: "all" | "reorder_needed" | "needs_review" | "has_incoming") => void;

  reorderNeededCount: number;
  needsReviewCount: number;
}
