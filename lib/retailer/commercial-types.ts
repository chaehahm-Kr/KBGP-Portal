export type RetailerAccountStatus =
  | "active"
  | "pending_approval"
  | "suspended"
  | "inactive";

export type RetailerApprovedTerms =
  | "prepaid"
  | "net15"
  | "net30"
  | "net45"
  | "net60";

export type RetailerTermsStatus =
  | "pending"
  | "approved"
  | "suspended"
  | "rejected";

/**
 * Normalizes any legacy or external payment terms string to canonical RetailerApprovedTerms
 */
export function normalizeApprovedTerms(val?: string | null): RetailerApprovedTerms {
  if (!val) return "prepaid";
  const clean = val.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean.includes("15")) return "net15";
  if (clean.includes("30")) return "net30";
  if (clean.includes("45")) return "net45";
  if (clean.includes("60")) return "net60";
  if (clean.includes("prepaid") || clean.includes("card") || clean.includes("ach")) return "prepaid";
  return "prepaid";
}

/**
 * Maps legacy uppercase payment_terms to canonical terms
 */
export function mapLegacyTermsToCanonical(legacy?: string | null): RetailerApprovedTerms {
  return normalizeApprovedTerms(legacy);
}

/**
 * Formats canonical terms for human-readable display
 */
export function formatApprovedTermsDisplay(val?: string | null): string {
  const canonical = normalizeApprovedTerms(val);
  switch (canonical) {
    case "net15":
      return "Net 15 Days";
    case "net30":
      return "Net 30 Days";
    case "net45":
      return "Net 45 Days";
    case "net60":
      return "Net 60 Days";
    case "prepaid":
    default:
      return "Prepaid (Card / ACH)";
  }
}

/**
 * Normalizes terms review / approval status
 */
export function normalizeTermsStatus(val?: string | null): RetailerTermsStatus {
  if (!val) return "pending";
  const clean = val.toLowerCase().trim();
  if (clean === "approved") return "approved";
  if (clean === "suspended") return "suspended";
  if (clean === "rejected") return "rejected";
  return "pending";
}

/**
 * Human-readable display for terms status
 */
export function formatTermsStatusDisplay(val?: string | null): string {
  const status = normalizeTermsStatus(val);
  switch (status) {
    case "approved":
      return "Approved";
    case "suspended":
      return "Suspended";
    case "rejected":
      return "Rejected";
    case "pending":
    default:
      return "Pending Review";
  }
}

/**
 * Normalizes retailer profile status against Postgres constraint:
 * chk_retailer_profiles_status CHECK (status IN ('active', 'inactive', 'pending_approval', 'suspended'))
 */
export function normalizeRetailerAccountStatus(val?: string | null): RetailerAccountStatus {
  if (!val) return "active";
  const clean = val.toLowerCase().trim();
  if (clean === "active") return "active";
  if (clean === "suspended") return "suspended";
  if (clean === "inactive") return "inactive";
  if (clean === "pending_approval" || clean === "pilot" || clean === "trial" || clean === "pending") {
    return "pending_approval";
  }
  return "active";
}

/**
 * Human-readable display for retailer account status
 */
export function formatRetailerAccountStatusDisplay(val?: string | null): string {
  const status = normalizeRetailerAccountStatus(val);
  switch (status) {
    case "active":
      return "Active (Normal)";
    case "pending_approval":
      return "Pending Approval / Trial";
    case "suspended":
      return "Suspended (Blocked)";
    case "inactive":
      return "Inactive";
    default:
      return "Active";
  }
}

export interface RetailerCommercialProfileData {
  companyId: string;
  status: RetailerAccountStatus;
  resaleCertificateNumber?: string | null;
  taxExemptStatus: boolean;
  paymentMethodCardEnabled: boolean;
  paymentMethodAchEnabled: boolean;
  termsEnabled: boolean;
  approvedTerms: RetailerApprovedTerms;
  termsStatus: RetailerTermsStatus;
  creditLimit: number;
  internalNote?: string | null;
}
