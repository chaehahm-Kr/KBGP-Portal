import {
  DRUG_FACTS_STATUSES,
  FEI_ISSUANCE_STATUSES,
  MOCRA_FACILITY_STATUSES,
  MOCRA_LISTING_STATUSES,
  OTC_APPLICABILITIES,
  OTC_FACILITY_STATUSES,
  OTC_LISTING_STATUSES,
  US_REGULATORY_CLASSIFICATIONS,
  isManufacturingCapableLocation,
  type DrugFactsStatus,
  type FeiIssuanceStatus,
  type LocationType,
  type MocraFacilityStatus,
  type MocraListingStatus,
  type OtcApplicability,
  type OtcFacilityStatus,
  type OtcListingStatus,
  type UsRegulatoryClassification,
} from "./v1-types";
import { formatCanonicalCountryName } from "@/lib/constants/countries";

export interface FacilityComplianceDeclarationInput {
  fei_status: FeiIssuanceStatus;
  fei_number?: string | null;
  mocra_facility_status: MocraFacilityStatus;
  mocra_exemption_reason?: string | null;
  mocra_registered_at?: string | null;
  mocra_next_renewal_date?: string | null;
  otc_facility_status: OtcFacilityStatus;
  otc_na_reason?: string | null;
  otc_registered_at?: string | null;
  otc_next_renewal_date?: string | null;
}

export interface ProductRegulatoryDeclarationInput {
  us_classification: UsRegulatoryClassification;
  otc_applicability?: OtcApplicability;
  otc_dual_mocra_applicable?: boolean | null;
  classification_rationale?: string | null;
  mocra_listing_status: MocraListingStatus;
  mocra_listing_number?: string | null;
  mocra_exemption_reason?: string | null;
  mocra_listed_at?: string | null;
  mocra_next_renewal_date?: string | null;
  otc_listing_status: OtcListingStatus;
  otc_ndc_number?: string | null;
  otc_na_reason?: string | null;
  otc_listed_at?: string | null;
  otc_next_renewal_date?: string | null;
  drug_facts_status: DrugFactsStatus;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function cleanText(v?: string | null): string {
  return String(v || "").trim();
}

/**
 * Validates Facility Compliance declaration:
 * - FEI number stored once as text; required when fei_status=ISSUED, mocra=REGISTERED, or otc=REGISTERED.
 * - Exemption / Not Applicable statuses require a rationale.
 * - Evidence files are strictly optional (not required here).
 */
export function validateFacilityComplianceDeclaration(
  input: FacilityComplianceDeclarationInput
): ValidationResult {
  const errors: string[] = [];

  if (!FEI_ISSUANCE_STATUSES.includes(input.fei_status)) {
    errors.push("유효하지 않은 FEI 발급 상태입니다.");
  }
  if (!MOCRA_FACILITY_STATUSES.includes(input.mocra_facility_status)) {
    errors.push("유효하지 않은 MoCRA 제조시설 등록 상태입니다.");
  }
  if (!OTC_FACILITY_STATUSES.includes(input.otc_facility_status)) {
    errors.push("유효하지 않은 OTC 제조시설 등록 상태입니다.");
  }

  const fei = cleanText(input.fei_number);
  if (input.fei_status === "ISSUED" && !fei) {
    errors.push("FEI 발급 완료(ISSUED) 상태에서는 FEI Number가 필수입니다.");
  }
  if (input.mocra_facility_status === "REGISTERED" && !fei) {
    errors.push("MoCRA 제조시설 등록 완료(REGISTERED) 상태에서는 Facility FEI Number가 필수입니다.");
  }
  if (input.otc_facility_status === "REGISTERED" && !fei) {
    errors.push("OTC 제조시설 등록 완료(REGISTERED) 상태에서는 Facility FEI Number가 필수입니다.");
  }
  if (fei && !/^[A-Za-z0-9\- ]{5,30}$/.test(fei)) {
    errors.push("FEI Number 형식이 올바르지 않습니다 (영숫자 5~30자 텍스트).");
  }

  if (
    (input.mocra_facility_status === "EXEMPT_SMALL_BUSINESS" ||
      input.mocra_facility_status === "NOT_APPLICABLE") &&
    !cleanText(input.mocra_exemption_reason)
  ) {
    errors.push("MoCRA 시설 면제 또는 해당 없음 선택 시 근거 사유가 필수입니다.");
  }

  if (input.otc_facility_status === "NOT_APPLICABLE" && !cleanText(input.otc_na_reason)) {
    errors.push("OTC 시설 해당 없음 선택 시 근거 사유가 필수입니다.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates Product Regulatory Compliance declaration:
 * - MoCRA LISTED requires Cosmetic Product Listing Number.
 * - OTC LISTED requires NDC Number.
 * - Exemption / Not Applicable statuses require rationale.
 * - Brand Portal callers cannot directly set drug_facts_status = 'VERIFIED' (Admin-only).
 * - Evidence files are strictly optional.
 */
export function validateProductRegulatoryDeclaration(
  input: ProductRegulatoryDeclarationInput,
  options?: { isAdmin?: boolean }
): ValidationResult {
  const errors: string[] = [];

  if (!US_REGULATORY_CLASSIFICATIONS.includes(input.us_classification)) {
    errors.push("유효하지 않은 미국 규제 분류(US Classification)입니다.");
  }
  if (input.otc_applicability && !OTC_APPLICABILITIES.includes(input.otc_applicability)) {
    errors.push("유효하지 않은 OTC 적용 여부입니다.");
  }
  if (!MOCRA_LISTING_STATUSES.includes(input.mocra_listing_status)) {
    errors.push("유효하지 않은 MoCRA 제품 리스팅 상태입니다.");
  }
  if (!OTC_LISTING_STATUSES.includes(input.otc_listing_status)) {
    errors.push("유효하지 않은 OTC 제품 리스팅 상태입니다.");
  }
  if (!DRUG_FACTS_STATUSES.includes(input.drug_facts_status)) {
    errors.push("유효하지 않은 Drug Facts 상태입니다.");
  }

  // Brand Portal cannot self-verify Drug Facts
  if (!options?.isAdmin && input.drug_facts_status === "VERIFIED") {
    errors.push("Drug Facts VERIFIED 상태는 ADMIN 검증을 통해서만 설정할 수 있습니다.");
  }

  const mocraNum = cleanText(input.mocra_listing_number);
  if (input.mocra_listing_status === "LISTED" && !mocraNum) {
    errors.push("MoCRA 제품 리스팅 완료(LISTED) 상태에서는 Cosmetic Product Listing Number가 필수입니다.");
  }

  const ndcNum = cleanText(input.otc_ndc_number);
  if (input.otc_listing_status === "LISTED" && !ndcNum) {
    errors.push("OTC 제품 리스팅 완료(LISTED) 상태에서는 NDC Number가 필수입니다.");
  }

  if (
    (input.mocra_listing_status === "EXEMPT_SMALL_BUSINESS" ||
      input.mocra_listing_status === "NOT_APPLICABLE") &&
    !cleanText(input.mocra_exemption_reason)
  ) {
    errors.push("MoCRA 제품 리스팅 면제 또는 해당 없음 선택 시 근거 사유가 필수입니다.");
  }

  if (input.otc_listing_status === "NOT_APPLICABLE" && !cleanText(input.otc_na_reason)) {
    errors.push("OTC 제품 리스팅 해당 없음 선택 시 근거 사유가 필수입니다.");
  }

  if (
    input.us_classification === "COSMETIC_OTC_DUAL" &&
    input.otc_dual_mocra_applicable === null
  ) {
    errors.push("OTC 복합 제품(COSMETIC_OTC_DUAL)은 MoCRA 적용 여부를 명시적으로 검토해야 합니다.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detects whether a facility update changes compliance-critical fields
 * (name, address, FEI, MoCRA/OTC registration status) vs unrelated shipping/Warehouse fields.
 */
export function isFacilityComplianceCriticalChange(
  prev: Record<string, any> | null | undefined,
  next: Record<string, any>
): boolean {
  if (!prev) return false;
  const criticalKeys = [
    "manufacturer_legal_name_en",
    "address_line1",
    "address_line2",
    "city",
    "state_province",
    "postal_code",
    "country",
    "fei_status",
    "fei_number",
    "mocra_facility_status",
    "otc_facility_status",
  ];
  return criticalKeys.some((k) => {
    if (next[k] === undefined) return false;
    return cleanText(prev[k]) !== cleanText(next[k]);
  });
}

/**
 * Detects whether a product regulatory update changes compliance-critical fields
 * requiring VERIFIED -> RE_REVIEW_REQUIRED invalidation.
 */
export function isProductComplianceCriticalChange(
  prev: Record<string, any> | null | undefined,
  next: Record<string, any>
): boolean {
  if (!prev) return false;
  const criticalKeys = [
    "us_classification",
    "otc_applicability",
    "otc_dual_mocra_applicable",
    "mocra_listing_status",
    "mocra_listing_number",
    "otc_listing_status",
    "otc_ndc_number",
    "drug_facts_status",
  ];
  return criticalKeys.some((k) => {
    if (next[k] === undefined) return false;
    return String(prev[k] ?? "") !== String(next[k] ?? "");
  });
}

/**
 * Shared Registration Completeness Contract for Primary Manufacturing Facility (KSN-CMP-004/005/010).
 * - Draft save: primary facility is ALWAYS optional.
 * - New final registration (when enforcePrimaryFacility=true): primary facility is REQUIRED.
 * - Existing genuinely COMPLETE products with compliance_facility_grandfathered=true:
 *   preserved as COMPLETE with a non-blocking missing-facility reminder banner!
 */
export function evaluatePrimaryFacilityRegistrationRule(params: {
  hasPrimaryFacility: boolean;
  isGrandfathered: boolean;
  isExplicitFinalSubmission?: boolean;
  enforcePrimaryFacility?: boolean;
}): {
  isMissingRequired: boolean;
  showNonBlockingReminder: boolean;
} {
  const enforce = params.enforcePrimaryFacility === true;
  if (params.hasPrimaryFacility) {
    return { isMissingRequired: false, showNonBlockingReminder: false };
  }
  if (!enforce) {
    return { isMissingRequired: false, showNonBlockingReminder: true };
  }
  if (params.isGrandfathered && !params.isExplicitFinalSubmission) {
    return { isMissingRequired: false, showNonBlockingReminder: true };
  }
  return { isMissingRequired: true, showNonBlockingReminder: false };
}

export interface ShippingOriginValidationInput {
  name: string;
  country: string;
  address_line1: string;
  city: string;
  postal_code: string;
  email?: string | null;
  location_type?: LocationType | null;
  manufacturer_legal_name_en?: string | null;
  contact_name?: string | null;
  contact_name_en?: string | null;
  phone?: string | null;
}

/**
 * Validates shipping origin and manufacturing facility input fields.
 */
export function validateShippingOriginInput(input: ShippingOriginValidationInput): void {
  if (!input.name || !input.name.trim()) {
    throw new Error("장소명은 필수 입력 항목입니다.");
  }
  if (!input.country || !formatCanonicalCountryName(input.country)) {
    throw new Error("국가는 필수 선택 항목입니다.");
  }
  if (!input.address_line1 || !input.address_line1.trim()) {
    throw new Error("주소 1은 필수 입력 항목입니다.");
  }
  if (!input.city || !input.city.trim()) {
    throw new Error("도시는 필수 입력 항목입니다.");
  }
  if (!input.postal_code || !input.postal_code.trim()) {
    throw new Error("우편번호(Postal / ZIP Code)는 필수 입력 항목입니다.");
  }
  if (input.email && input.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      throw new Error("유효한 이메일 주소를 입력해주세요.");
    }
  }

  // KSN-CMP-004: Manufacturing Facility Required Fields
  if (isManufacturingCapableLocation(input.location_type)) {
    if (!input.manufacturer_legal_name_en || !input.manufacturer_legal_name_en.trim()) {
      throw new Error("제조시설은 제조사 정식 영문명(Legal Name in English)이 필수입니다.");
    }
    const hasContact = (input.contact_name && input.contact_name.trim()) || (input.contact_name_en && input.contact_name_en.trim());
    if (!hasContact) {
      throw new Error("제조시설 담당자명(Contact Name)은 필수 입력 항목입니다.");
    }
    if (!input.phone || !input.phone.trim()) {
      throw new Error("제조시설 연락처 전화번호(Phone)는 필수 입력 항목입니다.");
    }
    if (!input.email || !input.email.trim()) {
      throw new Error("제조시설 이메일(Email)은 필수 입력 항목입니다.");
    }
  }
}
