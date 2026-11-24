// ============================================================================
// KSN-COMPLIANCE-V1 — Shared Domain Types, Statuses, Renewal & Legacy Mapping
// Task ID: KSN-CMP-001-R1 (Single Source of Truth for Brand Portal, Admin & Excel)
// ============================================================================

export const FDA_NON_APPROVAL_DISCLAIMER_KO =
  "FDA FEI 번호, MoCRA 시설/제품 리스팅 및 OTC NDC 번호 보유는 FDA 제출·등록 기록을 의미하며, FDA 제품 승인(Approval) 또는 인증(Certification)을 의미하지 않습니다.";

export const FDA_NON_APPROVAL_DISCLAIMER_EN =
  "Possession of an FDA FEI number, MoCRA facility/product listing, or OTC NDC number reflects a regulatory submission record and does NOT constitute FDA approval or certification.";

// 1. Location Types (extending company_shipping_origins)
export const LOCATION_TYPES = [
  "SHIPPING_ORIGIN",
  "MANUFACTURING_FACILITY",
  "SHIPPING_AND_MANUFACTURING",
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export function isShippingCapableLocation(t?: string | null): boolean {
  return t === "SHIPPING_ORIGIN" || t === "SHIPPING_AND_MANUFACTURING" || !t;
}

export function isManufacturingCapableLocation(t?: string | null): boolean {
  return t === "MANUFACTURING_FACILITY" || t === "SHIPPING_AND_MANUFACTURING";
}

// 2. Facility-Level Regulatory Statuses (UNKNOWN supported — never silently coerced!)
export const FEI_ISSUANCE_STATUSES = [
  "UNKNOWN",
  "NOT_ISSUED",
  "IN_PROGRESS",
  "ISSUED",
] as const;
export type FeiIssuanceStatus = (typeof FEI_ISSUANCE_STATUSES)[number];

export const MOCRA_FACILITY_STATUSES = [
  "UNKNOWN",
  "NOT_STARTED",
  "IN_PROGRESS",
  "REGISTERED",
  "EXEMPT_SMALL_BUSINESS",
  "NOT_APPLICABLE",
] as const;
export type MocraFacilityStatus = (typeof MOCRA_FACILITY_STATUSES)[number];

export const OTC_FACILITY_STATUSES = [
  "UNKNOWN",
  "NOT_APPLICABLE",
  "NOT_STARTED",
  "IN_PROGRESS",
  "REGISTERED",
] as const;
export type OtcFacilityStatus = (typeof OTC_FACILITY_STATUSES)[number];

// 3. Product-Level Regulatory Statuses (UNKNOWN / UNDETERMINED supported!)
export const US_REGULATORY_CLASSIFICATIONS = [
  "UNDETERMINED",
  "COSMETIC",
  "OTC_DRUG",
  "COSMETIC_OTC_DUAL",
  "NOT_APPLICABLE",
] as const;
export type UsRegulatoryClassification = (typeof US_REGULATORY_CLASSIFICATIONS)[number];

export const OTC_APPLICABILITIES = [
  "UNKNOWN",
  "APPLICABLE",
  "NOT_APPLICABLE",
  "DUAL_REVIEW_REQUIRED",
] as const;
export type OtcApplicability = (typeof OTC_APPLICABILITIES)[number];

export const MOCRA_LISTING_STATUSES = [
  "UNKNOWN",
  "NOT_STARTED",
  "IN_PROGRESS",
  "LISTED",
  "EXEMPT_SMALL_BUSINESS",
  "NOT_APPLICABLE",
] as const;
export type MocraListingStatus = (typeof MOCRA_LISTING_STATUSES)[number];

export const OTC_LISTING_STATUSES = [
  "UNKNOWN",
  "NOT_APPLICABLE",
  "NOT_STARTED",
  "IN_PROGRESS",
  "LISTED",
] as const;
export type OtcListingStatus = (typeof OTC_LISTING_STATUSES)[number];

// Drug Facts READY strictly does NOT imply VERIFIED
export const DRUG_FACTS_STATUSES = [
  "UNKNOWN",
  "NOT_APPLICABLE",
  "NOT_STARTED",
  "DRAFT",
  "READY",
  "VERIFIED",
] as const;
export type DrugFactsStatus = (typeof DRUG_FACTS_STATUSES)[number];

// 4. Single Authoritative Admin Verification & Import-Readiness Statuses
export const COMPLIANCE_VERIFICATION_STATUSES = [
  "UNREVIEWED",
  "UNDER_REVIEW",
  "VERIFIED",
  "NEEDS_INFO",
  "RE_REVIEW_REQUIRED",
  "VALIDITY_REVIEW_REQUIRED",
  "REJECTED",
] as const;
export type ComplianceVerificationStatus = (typeof COMPLIANCE_VERIFICATION_STATUSES)[number];

export const IMPORT_READINESS_STATUSES = [
  "NOT_EVALUATED",
  "READY",
  "CONDITIONAL",
  "BLOCKED",
  "EXEMPT",
] as const;
export type ImportReadinessStatus = (typeof IMPORT_READINESS_STATUSES)[number];

export const COMPLIANCE_DOCUMENT_CATEGORIES = [
  "FEI_CONFIRMATION",
  "MOCRA_FACILITY_RECEIPT",
  "MOCRA_PRODUCT_LISTING",
  "OTC_FACILITY_RECEIPT",
  "OTC_NDC_LISTING",
  "DRUG_FACTS_LABEL",
  "EXEMPTION_STATEMENT",
  "OTHER",
] as const;
export type ComplianceDocumentCategory = (typeof COMPLIANCE_DOCUMENT_CATEGORIES)[number];

// 5. Renewal Window Classification (90 / 60 / 30 days + Overdue + Confirmation Required)
export type RenewalUrgency =
  | "NOT_APPLICABLE"
  | "CONFIRMATION_REQUIRED"
  | "CURRENT"
  | "UPCOMING_90D"
  | "PREPARATION_60D"
  | "URGENT_30D"
  | "OVERDUE";

export interface RenewalEvaluation {
  urgency: RenewalUrgency;
  daysRemaining: number | null;
  labelKo: string;
  labelEn: string;
}

/**
 * Evaluates a regulatory renewal date against 90 / 60 / 30-day windows.
 * Never invents dates from incomplete records — returns CONFIRMATION_REQUIRED when
 * registration is active/registered/listed but next_renewal_date is missing.
 */
export function evaluateRenewalWindow(params: {
  isActiveRegistration: boolean;
  nextRenewalDate: string | null | undefined;
  referenceDate?: Date;
}): RenewalEvaluation {
  if (!params.isActiveRegistration) {
    return {
      urgency: "NOT_APPLICABLE",
      daysRemaining: null,
      labelKo: "해당 없음",
      labelEn: "Not Applicable",
    };
  }

  if (!params.nextRenewalDate || !params.nextRenewalDate.trim()) {
    return {
      urgency: "CONFIRMATION_REQUIRED",
      daysRemaining: null,
      labelKo: "갱신일 확인 필요",
      labelEn: "Renewal Date Confirmation Required",
    };
  }

  const parsed = new Date(params.nextRenewalDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      urgency: "CONFIRMATION_REQUIRED",
      daysRemaining: null,
      labelKo: "갱신일 확인 필요",
      labelEn: "Renewal Date Confirmation Required",
    };
  }

  const ref = params.referenceDate ? new Date(params.referenceDate) : new Date();
  const refDay = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const targetDay = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const daysRemaining = Math.floor((targetDay - refDay) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      urgency: "OVERDUE",
      daysRemaining,
      labelKo: `기한 초과 (${Math.abs(daysRemaining)}일 경과)`,
      labelEn: `Overdue (${Math.abs(daysRemaining)}d past)`,
    };
  }
  if (daysRemaining <= 30) {
    return {
      urgency: "URGENT_30D",
      daysRemaining,
      labelKo: `긴급 갱신 (D-${daysRemaining})`,
      labelEn: `Urgent Renewal (D-${daysRemaining})`,
    };
  }
  if (daysRemaining <= 60) {
    return {
      urgency: "PREPARATION_60D",
      daysRemaining,
      labelKo: `갱신 준비 (D-${daysRemaining})`,
      labelEn: `Renewal Preparation (D-${daysRemaining})`,
    };
  }
  if (daysRemaining <= 90) {
    return {
      urgency: "UPCOMING_90D",
      daysRemaining,
      labelKo: `갱신 예정 (D-${daysRemaining})`,
      labelEn: `Upcoming Renewal (D-${daysRemaining})`,
    };
  }

  return {
    urgency: "CURRENT",
    daysRemaining,
    labelKo: `정상 (D-${daysRemaining})`,
    labelEn: `Current (D-${daysRemaining})`,
  };
}

// 6. Legacy R4 Regulatory Attribute & Excel Mapping Contract (Shared by Task 008 & Task 010)
export interface LegacyRegulatoryInput {
  fdaStatus?: string | null;
  mocraStatus?: string | null;
  otcStatus?: string | null;
  drugFactsStatus?: string | null;
}

export interface LegacyRegulatoryMappingResult {
  us_classification: UsRegulatoryClassification;
  otc_applicability: OtcApplicability;
  mocra_listing_status: MocraListingStatus;
  otc_listing_status: OtcListingStatus;
  drug_facts_status: DrugFactsStatus;
  fda_legacy_status: string | null;
  verification_status: ComplianceVerificationStatus;
  review_warnings: string[];
  original_snapshot: LegacyRegulatoryInput;
}

function normLegacyCode(v?: string | null): string {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/^"|"$/g, "");
}

/**
 * Deterministic, lossless legacy R4 -> V1 regulatory mapping contract.
 * Rules enforced (KSN-CMP-001-R1 Section 3.B):
 * - NOT_OTC does NOT automatically become COSMETIC (preserves otc_applicability = 'NOT_APPLICABLE' while leaving us_classification = 'UNDETERMINED').
 * - Legacy MoCRA NA / NOT_APPLICABLE does NOT automatically become EXEMPT_SMALL_BUSINESS or NOT_APPLICABLE listing exemption (keeps UNKNOWN + review warning).
 * - Never infers facility registration or product listing completion from ambiguous legacy values.
 * - Preserves all original values in original_snapshot + fda_legacy_status.
 */
export function mapLegacyRegulatoryValues(
  input: LegacyRegulatoryInput
): LegacyRegulatoryMappingResult {
  const fda = normLegacyCode(input.fdaStatus);
  const mocra = normLegacyCode(input.mocraStatus);
  const otc = normLegacyCode(input.otcStatus);
  const drugFacts = normLegacyCode(input.drugFactsStatus);

  const warnings: string[] = [];

  // Default everything to UNKNOWN / UNDETERMINED — never fabricate NOT_APPLICABLE or NOT_STARTED
  const us_classification: UsRegulatoryClassification = "UNDETERMINED";
  let otc_applicability: OtcApplicability = "UNKNOWN";
  let mocra_listing_status: MocraListingStatus = "UNKNOWN";
  let otc_listing_status: OtcListingStatus = "UNKNOWN";
  let drug_facts_status: DrugFactsStatus = "UNKNOWN";
  let verification_status: ComplianceVerificationStatus = "UNREVIEWED";

  // OTC_STATUS
  if (otc === "NOT_OTC") {
    otc_applicability = "NOT_APPLICABLE";
    otc_listing_status = "NOT_APPLICABLE";
    warnings.push(
      "Legacy OTC_STATUS=NOT_OTC mapped to otc_applicability=NOT_APPLICABLE; US classification left UNDETERMINED for explicit review."
    );
  } else if (otc === "OTC" || otc === "YES" || otc === "APPLICABLE") {
    otc_applicability = "APPLICABLE";
    warnings.push(
      "Legacy OTC_STATUS indicates OTC applicability; confirm OTC_DRUG vs COSMETIC_OTC_DUAL and NDC listing."
    );
  } else if (otc && otc !== "NOT_REVIEWED") {
    warnings.push(`Ambiguous legacy OTC_STATUS="${otc}" preserved for manual review.`);
  }

  // MOCRA_STATUS
  if (mocra === "REVIEW_REQUIRED") {
    verification_status = "RE_REVIEW_REQUIRED";
    warnings.push("Legacy MOCRA_STATUS=REVIEW_REQUIRED flagged for compliance review.");
  } else if (mocra === "NA" || mocra === "NOT_APPLICABLE") {
    warnings.push(
      `Legacy MOCRA_STATUS="${mocra}" is ambiguous (does not automatically grant product listing exemption); kept as UNKNOWN for explicit review.`
    );
  } else if (mocra && mocra !== "NOT_REVIEWED") {
    warnings.push(`Ambiguous legacy MOCRA_STATUS="${mocra}" preserved for manual review.`);
  }

  // DRUG_FACTS_STATUS
  if (drugFacts === "NOT_APPLICABLE" && otc === "NOT_OTC") {
    drug_facts_status = "NOT_APPLICABLE";
  } else if (drugFacts === "READY") {
    // READY does NOT imply VERIFIED
    drug_facts_status = "READY";
  } else if (drugFacts === "DRAFT") {
    drug_facts_status = "DRAFT";
  } else if (drugFacts && drugFacts !== "NOT_REVIEWED") {
    warnings.push(`Ambiguous legacy DRUG_FACTS_STATUS="${drugFacts}" preserved for manual review.`);
  }

  // FDA_STATUS
  if (fda && fda !== "NOT_REVIEWED") {
    warnings.push(`Legacy FDA_STATUS="${fda}" preserved in fda_legacy_status for review.`);
  }

  return {
    us_classification,
    otc_applicability,
    mocra_listing_status,
    otc_listing_status,
    drug_facts_status,
    fda_legacy_status: fda || null,
    verification_status,
    review_warnings: warnings,
    original_snapshot: {
      fdaStatus: fda || null,
      mocraStatus: mocra || null,
      otcStatus: otc || null,
      drugFactsStatus: drugFacts || null,
    },
  };
}

// 7. Data Interfaces for Shared Contracts
export interface CompanyLocationRecord {
  id: string;
  company_id: string;
  name: string;
  location_type: LocationType;
  is_default: boolean;
  is_default_manufacturing: boolean;
  facility_code: string | null;
  manufacturer_legal_name_en: string | null;
  manufacturer_name_ko: string | null;
  contact_name: string | null;
  contact_name_en: string | null;
  phone: string | null;
  email: string | null;
  country: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_province: string | null;
  postal_code: string;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManufacturingFacilityComplianceRecord {
  facility_id: string;
  company_id: string;
  fei_status: FeiIssuanceStatus;
  fei_number: string | null;
  mocra_facility_status: MocraFacilityStatus;
  mocra_exemption_reason: string | null;
  mocra_registered_at: string | null;
  mocra_next_renewal_date: string | null;
  otc_facility_status: OtcFacilityStatus;
  otc_na_reason: string | null;
  otc_registered_at: string | null;
  otc_next_renewal_date: string | null;
  verification_status: ComplianceVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  verification_method: string | null;
  verification_basis: string | null;
  public_review_comment: string | null;
  import_readiness_status: ImportReadinessStatus;
  updated_at: string;
}

export interface ProductRegulatoryComplianceRecord {
  product_id: string;
  company_id: string;
  us_classification: UsRegulatoryClassification;
  otc_applicability: OtcApplicability;
  otc_dual_mocra_applicable: boolean | null;
  classification_rationale: string | null;
  mocra_listing_status: MocraListingStatus;
  mocra_listing_number: string | null;
  mocra_exemption_reason: string | null;
  mocra_listed_at: string | null;
  mocra_next_renewal_date: string | null;
  otc_listing_status: OtcListingStatus;
  otc_ndc_number: string | null;
  otc_na_reason: string | null;
  otc_listed_at: string | null;
  otc_next_renewal_date: string | null;
  drug_facts_status: DrugFactsStatus;
  fda_legacy_status: string | null;
  legacy_migration_snapshot: LegacyRegulatoryInput | null;
  verification_status: ComplianceVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  verification_method: string | null;
  verification_basis: string | null;
  public_review_comment: string | null;
  import_readiness_status: ImportReadinessStatus;
  last_brand_submitted_at: string | null;
  updated_at: string;
}
