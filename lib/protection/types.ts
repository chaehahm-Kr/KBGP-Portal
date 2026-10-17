export type AdminProtectionDecision = "pending" | "needs_information" | "approved" | "rejected";
export type CreditProcessingStatus = "not_applicable" | "pending" | "issued";

export interface AdminProtectionReviewItem {
  id: string; // Protection ID
  resolutionId: string | null;
  companyId: string;
  companyName: string;
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  sku: string;
  category: string;
  categoryLabel: string;
  thumbnailUrl: string | null;
  requestedAt: string | null;
  requestedByEmail: string | null;
  requestNotes: string | null;
  trialStartDate: string;
  trialEndDate: string;
  daysElapsed: number;
  daysRemaining: number;
  isPeriodEnded: boolean;
  protectedQuantity: number;
  estimatedMovement: number;
  sellThroughPercent: number;
  dataCoveragePercent: number;
  storesReporting: number;
  totalStores: number;
  status: string;
  decision: AdminProtectionDecision;
  decisionAt: string | null;
  decisionByEmail: string | null;
  decisionNotes: string | null;
  approvedQuantity: number | null;
  approvedCreditAmount: number | null;
  creditProcessingStatus: CreditProcessingStatus;
  isTest: boolean;
}

export interface AdminProtectionReviewDetail extends AdminProtectionReviewItem {
  companyContactEmail: string | null;
  companyPhone: string | null;
  companyBusinessType: string | null;
  productDescription: string | null;
  productVolume: string | null;
  productOrigin: string | null;
  currentCatalogWholesalePrice: number | null;
  initialTrialUnitCost: number | null;
  activationSource: string;
  sourceOrderId: string | null;
  sourceOrderNumber: string | null;
  sourceDeliveryReference: string | null;
  storeBreakdown: Array<{
    storeId: string;
    storeName: string;
    estimatedMovement: number | null;
    currentRemainingQty: number | null;
    lastCheckDate: string | null;
    reportingStatus: "reported" | "missing";
    movementEvidence?: "verified_store_check" | "insufficient_data";
  }>;
  movementBasis?: "aggregated_store_checks" | "company_level_baseline";
}

export interface AdminProtectionReviewCounts {
  all: number;
  pending: number;
  needs_information: number;
  approved: number;
  rejected: number;
}

export interface GetAdminProtectionReviewsResult {
  reviews: AdminProtectionReviewItem[];
  counts: AdminProtectionReviewCounts;
  error?: string | null;
}

export interface GetAdminProtectionReviewDetailResult {
  review: AdminProtectionReviewDetail | null;
  error?: string | null;
}
