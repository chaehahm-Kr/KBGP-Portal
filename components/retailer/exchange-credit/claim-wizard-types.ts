/**
 * Retailer 90-Day Exchange Credit 3-Step Claim Wizard Types
 * Task ID: EXCHANGE-CREDIT-PH2-003
 * Location: components/retailer/exchange-credit/claim-wizard-types.ts
 */

export type ClaimWizardProductStatus =
  | "ELIGIBLE"
  | "UPCOMING"
  | "NOT_ELIGIBLE"
  | "NEEDS_REVIEW"
  | "CLAIMED"
  | "EXPIRED";

export type ExchangeCreditOption = "A" | "B";

export interface ClaimWizardStore {
  id: string;
  name: string;
  code: string | null;
  city?: string | null;
  state?: string | null;
}

export interface ClaimWizardProductItem {
  cohortId: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  productSku: string;
  brandName?: string | null;
  thumbnailUrl?: string | null;

  // External Authoritative Evaluation Metrics
  status: ClaimWizardProductStatus;
  statusReason: string | null; // Retailer-friendly explanation
  evaluationDate: string | null; // Day 100
  claimDeadlineDate: string | null; // Day 150
  daysRemaining: number;

  // Inventory Reporting Verification
  distinctReportingWeeks: number;
  minReportingWeeksRequired: number; // 8
  weeklyChecksCompleted: boolean;

  // Supply and Claim Quantities
  fulfilledProtectedQuantity: number;
  currentVerifiedStock: number;
  maxClaimableQuantity: number;

  // Pricing & Frozen Terms
  unitWholesalePrice: number;
  frozenOptionARate: number; // e.g. 0.40 (40%)
  frozenOptionBRate: number; // 1.0 (100%)
}

export interface SelectedClaimItem {
  cohortId: string;
  productId: string;
  productName: string;
  productSku: string;
  brandName?: string | null;
  thumbnailUrl?: string | null;
  selectedOption: ExchangeCreditOption;
  selectedQuantity: number;
  maxClaimableQuantity: number;
  unitWholesalePrice: number;
  creditRate: number; // e.g. 0.40 for Option A, 1.00 for Option B
  estimatedCredit: number;
}

export interface ClaimWizardProps {
  stores: ClaimWizardStore[];
  selectedStoreId?: string;
  products: ClaimWizardProductItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onStoreChange?: (storeId: string) => void;
  onCancel?: () => void;
  // Read-only / Preview mode prop
  isPreviewMode?: boolean;
}
