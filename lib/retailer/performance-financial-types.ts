/**
 * RTP-PERFORMANCE-P5-001: Product Performance Financial Estimates Types
 *
 * Types for estimated unit movement, velocity, retail sales, wholesale cost,
 * and gross profit calculations across stores and company SKU views.
 */

export type AnalysisPeriod = "7d" | "30d" | "90d" | "all";

export type FinancialReliabilityStatus =
  | "available"          // Reliable consecutive counts and valid movement
  | "insufficient_data"  // Fewer than 2 counts or no interval in window
  | "needs_review"       // Negative movement (count increase without receipts) or data anomaly
  | "not_available";     // Movement known but pricing (SRP/Cost) missing or invalid

export type PricingSource =
  | "item_snapshot"           // Snapshot captured at time of weekly check
  | "curation_srp"            // Authorized retailer curation suggested retail price
  | "product_erp"             // Product catalog estimated_retail_price
  | "wholesale_markup";       // Fallback 2.0x markup over wholesale cost

export interface ObservationInterval {
  intervalIndex: number;
  startDate: string;            // YYYY-MM-DD of previous count
  endDate: string;              // YYYY-MM-DD of current count
  daysElapsed: number;          // Actual observed days between counts
  previousStock: number;        // Stock at start of interval
  currentStock: number;         // Stock at end of interval
  receiptsInInterval: number;   // P2 confirmed + estimated receipts arriving strictly within interval
  positiveAdjustments: number;  // Depletion-increasing adjustments (e.g. verified loss/breakage)
  negativeAdjustments: number;  // Depletion-decreasing adjustments (e.g. verified returns to stock)
  estimatedUnitsMoved: number;  // Formula: prev + receipts + posAdj - negAdj - curr
  status: FinancialReliabilityStatus;
  statusReason?: string;
  applicableSrp: number | null;
  srpSource?: PricingSource;
  applicableWholesaleCost: number | null;
  estimatedRetailSales: number | null;
  estimatedWholesaleCost: number | null;
  estimatedGrossProfit: number | null;
  receiptEventsCount: number;
}

export interface ReceiptEvent {
  id: string;
  orderId: string;
  storeId: string;
  productId: string;
  quantity: number;
  receiptDate: string;          // YYYY-MM-DD
  receiptTimestamp: number;     // ms epoch
  isEstimated: boolean;         // true if inferred from shipped_at + shipping_days, false if delivered
  deliveryStatus: "delivered" | "estimated_in_transit";
}

export interface StockAdjustment {
  id: string;
  storeId: string;
  productId: string;
  date: string;
  quantity: number;
  direction: "positive" | "negative";
  reason: "return" | "loss" | "damaged" | "transfer_in" | "transfer_out" | "audit_correction";
}

export interface FinancialMetrics {
  status: FinancialReliabilityStatus;
  statusReason?: string;
  observedDays: number;
  intervalsCount: number;
  estimatedUnitsSold: number | null;
  estimatedDailySalesRate: number | null;
  estimatedWeeklySalesRate: number | null;
  estimatedRetailSales: number | null;
  estimatedWholesaleCost: number | null;
  estimatedGrossProfit: number | null;
  estimatedGrossMargin: number | null; // Percentage: (Gross Profit / Retail Sales) * 100
  srp: number | null;
  srpSource: PricingSource | null;
  wholesaleCost: number | null;
}

export interface StoreSkuFinancialEstimate {
  storeId: string;
  storeName: string;
  productId: string;
  sku: string;
  selectedPeriod: AnalysisPeriod;
  periodMetrics: FinancialMetrics;
  cumulativeMetrics: FinancialMetrics;
  intervals: ObservationInterval[];
  receiptEvents: ReceiptEvent[];
}

export interface CompanySkuFinancialEstimate {
  companyId: string;
  productId: string;
  sku: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  category: string;
  cartonPackQty: number;
  selectedPeriod: AnalysisPeriod;
  coverage: {
    totalStoresCount: number;
    reportingStoresCount: number;
    coveragePercent: number;
    isPartial: boolean;
    observedDaysMax: number;
  };
  periodMetrics: FinancialMetrics;
  cumulativeMetrics: FinancialMetrics;
  storeEstimates: StoreSkuFinancialEstimate[];
}

export interface CompanyFinancialPerformanceSummary {
  companyId: string;
  selectedPeriod: AnalysisPeriod;
  coverage: {
    totalStores: number;
    reportingStores: number;
    percent: number;
    isPartial: boolean;
  };
  totalEstimatedUnitsSold: number;
  totalEstimatedRetailSales: number;
  totalEstimatedWholesaleCost: number;
  totalEstimatedGrossProfit: number;
  weightedGrossMargin: number; // Total GP / Total Retail Sales * 100
  skusWithEstimatesCount: number;
  skusNeedsReviewCount: number;
  skusInsufficientDataCount: number;
  skusNotAvailableCount: number;
  products: CompanySkuFinancialEstimate[];
}
