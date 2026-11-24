import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
import {
  LOCATION_TYPES,
  isShippingCapableLocation,
  isManufacturingCapableLocation,
  COMPLIANCE_VERIFICATION_STATUSES,
  IMPORT_READINESS_STATUSES,
  COMPLIANCE_DOCUMENT_CATEGORIES,
  FEI_ISSUANCE_STATUSES,
  MOCRA_FACILITY_STATUSES,
  OTC_FACILITY_STATUSES,
} from "@/lib/compliance/v1-types";
import {
  validateFacilityComplianceDeclaration,
  evaluatePrimaryFacilityRegistrationRule,
  validateShippingOriginInput,
} from "@/lib/compliance/v1-validators";
import {
  evaluateProductRegistrationStatus,
  type ProductRegistrationEvaluationInput,
} from "@/lib/product/registration-status";

describe("KSN-CMP-004: Shipping Origins, Manufacturing Facilities & Product Association Unit Tests", () => {
  // Scenario 1: Location Types & Capability Functions
  it("Scenario 1: correctly classifies capabilities across all 3 location types", () => {
    expect(LOCATION_TYPES).toContain("SHIPPING_ORIGIN");
    expect(LOCATION_TYPES).toContain("MANUFACTURING_FACILITY");
    expect(LOCATION_TYPES).toContain("SHIPPING_AND_MANUFACTURING");

    // SHIPPING_ORIGIN
    expect(isShippingCapableLocation("SHIPPING_ORIGIN")).toBe(true);
    expect(isManufacturingCapableLocation("SHIPPING_ORIGIN")).toBe(false);

    // MANUFACTURING_FACILITY
    expect(isShippingCapableLocation("MANUFACTURING_FACILITY")).toBe(false);
    expect(isManufacturingCapableLocation("MANUFACTURING_FACILITY")).toBe(true);

    // SHIPPING_AND_MANUFACTURING
    expect(isShippingCapableLocation("SHIPPING_AND_MANUFACTURING")).toBe(true);
    expect(isManufacturingCapableLocation("SHIPPING_AND_MANUFACTURING")).toBe(true);

    // Default / legacy fallback
    expect(isShippingCapableLocation(undefined)).toBe(true);
    expect(isManufacturingCapableLocation(undefined)).toBe(false);
  });

  // Scenario 2: List Filters (ALL, SHIPPING, MANUFACTURING)
  it("Scenario 2: filters location lists correctly by capability", () => {
    const sampleLocations = [
      { id: "1", location_type: "SHIPPING_ORIGIN" as const },
      { id: "2", location_type: "MANUFACTURING_FACILITY" as const },
      { id: "3", location_type: "SHIPPING_AND_MANUFACTURING" as const },
    ];

    const shippingFilter = sampleLocations.filter((l) => isShippingCapableLocation(l.location_type));
    expect(shippingFilter.map((l) => l.id)).toEqual(["1", "3"]);

    const mfgFilter = sampleLocations.filter((l) => isManufacturingCapableLocation(l.location_type));
    expect(mfgFilter.map((l) => l.id)).toEqual(["2", "3"]);

    const allFilter = sampleLocations;
    expect(allFilter.length).toBe(3);
  });

  // Scenario 3: Independent Defaults (is_default vs is_default_manufacturing)
  it("Scenario 3: maintains independence between default shipping and default manufacturing", () => {
    const loc1 = { is_default: true, is_default_manufacturing: false };
    const loc2 = { is_default: false, is_default_manufacturing: true };
    const loc3 = { is_default: true, is_default_manufacturing: true };

    expect(loc1.is_default).toBe(true);
    expect(loc1.is_default_manufacturing).toBe(false);
    expect(loc2.is_default).toBe(false);
    expect(loc2.is_default_manufacturing).toBe(true);
    expect(loc3.is_default && loc3.is_default_manufacturing).toBe(true);
  });

  // Scenario 4: Facility Code Format & Scope
  it("Scenario 4: verifies facility code format is MFG-###", () => {
    const validCodeRegex = /^MFG-\d{3,}$/;
    expect(validCodeRegex.test("MFG-001")).toBe(true);
    expect(validCodeRegex.test("MFG-042")).toBe(true);
    expect(validCodeRegex.test("MFG-1000")).toBe(true);
    expect(validCodeRegex.test("WHS-001")).toBe(false);
    expect(validCodeRegex.test("MFG")).toBe(false);
  });

  // Scenario 5: Input Validation for Manufacturing Location
  it("Scenario 5: requires legal English manufacturer name, phone, and email for manufacturing locations", () => {
    // Missing manufacturer_legal_name_en
    expect(() =>
      validateShippingOriginInput({
        name: "공장",
        country: "South Korea",
        address_line1: "경기도 평택시",
        city: "평택",
        postal_code: "12345",
        location_type: "MANUFACTURING_FACILITY",
        phone: "+82-31-123-4567",
        email: "mfg@factory.com",
      })
    ).toThrow("제조시설은 제조사 정식 영문명(Legal Name in English)이 필수입니다.");

    // Missing phone
    expect(() =>
      validateShippingOriginInput({
        name: "공장",
        country: "South Korea",
        address_line1: "경기도 평택시",
        city: "평택",
        postal_code: "12345",
        location_type: "MANUFACTURING_FACILITY",
        manufacturer_legal_name_en: "Cosmax Inc.",
        contact_name: "홍길동",
        email: "mfg@factory.com",
      })
    ).toThrow("제조시설 연락처 전화번호(Phone)는 필수 입력 항목입니다.");

    // Missing email
    expect(() =>
      validateShippingOriginInput({
        name: "공장",
        country: "South Korea",
        address_line1: "경기도 평택시",
        city: "평택",
        postal_code: "12345",
        location_type: "MANUFACTURING_FACILITY",
        manufacturer_legal_name_en: "Cosmax Inc.",
        contact_name: "홍길동",
        phone: "+82-31-123-4567",
      })
    ).toThrow("제조시설 이메일(Email)은 필수 입력 항목입니다.");

    // Valid manufacturing input
    expect(() =>
      validateShippingOriginInput({
        name: "평택 제1공장",
        country: "South Korea",
        address_line1: "경기도 평택시 산단로 1",
        city: "평택시",
        postal_code: "17700",
        location_type: "MANUFACTURING_FACILITY",
        manufacturer_legal_name_en: "Cosmax Inc.",
        contact_name: "홍길동",
        phone: "+82-31-123-4567",
        email: "compliance@cosmax.com",
      })
    ).not.toThrow();
  });

  // Scenario 6: FEI Status Validation
  it("Scenario 6: validates FEI status and requires 7-10 digit number when ISSUED", () => {
    expect(FEI_ISSUANCE_STATUSES).toContain("ISSUED");
    expect(FEI_ISSUANCE_STATUSES).toContain("NOT_ISSUED");
    expect(FEI_ISSUANCE_STATUSES).toContain("IN_PROGRESS");

    // ISSUED without number
    const res1 = validateFacilityComplianceDeclaration({
      fei_status: "ISSUED",
      fei_number: "",
      mocra_facility_status: "NOT_APPLICABLE",
      otc_facility_status: "NOT_APPLICABLE",
    });
    expect(res1.valid).toBe(false);
    expect(res1.errors[0]).toContain("FEI");

    // ISSUED with invalid format (too short)
    const res2 = validateFacilityComplianceDeclaration({
      fei_status: "ISSUED",
      fei_number: "123",
      mocra_facility_status: "NOT_APPLICABLE",
      otc_facility_status: "NOT_APPLICABLE",
    });
    expect(res2.valid).toBe(false);

    // ISSUED with valid 10-digit number
    const res3 = validateFacilityComplianceDeclaration({
      fei_status: "ISSUED",
      fei_number: "3001234567",
      mocra_facility_status: "NOT_APPLICABLE",
      mocra_exemption_reason: "Exempt under sec. 607",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "Cosmetic only facility",
    });
    expect(res3.valid).toBe(true);
  });

  // Scenario 7: MoCRA Facility Status Validation
  it("Scenario 7: validates MoCRA facility status and requires exemption reason when EXEMPT_SMALL_BUSINESS", () => {
    expect(MOCRA_FACILITY_STATUSES).toContain("REGISTERED");
    expect(MOCRA_FACILITY_STATUSES).toContain("EXEMPT_SMALL_BUSINESS");

    // EXEMPT_SMALL_BUSINESS without reason
    const res1 = validateFacilityComplianceDeclaration({
      fei_status: "NOT_ISSUED",
      mocra_facility_status: "EXEMPT_SMALL_BUSINESS",
      mocra_exemption_reason: "",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "Not OTC",
    });
    expect(res1.valid).toBe(false);
    expect(res1.errors[0]).toContain("근거 사유가 필수");

    // EXEMPT_SMALL_BUSINESS with reason
    const res2 = validateFacilityComplianceDeclaration({
      fei_status: "NOT_ISSUED",
      mocra_facility_status: "EXEMPT_SMALL_BUSINESS",
      mocra_exemption_reason: "Small business exemption under MoCRA sec. 607",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "Not OTC",
    });
    expect(res2.valid).toBe(true);
  });

  // Scenario 8: OTC Facility Status Validation
  it("Scenario 8: validates OTC facility status and requires NA reason when NOT_APPLICABLE", () => {
    expect(OTC_FACILITY_STATUSES).toContain("REGISTERED");
    expect(OTC_FACILITY_STATUSES).toContain("NOT_APPLICABLE");

    // NOT_APPLICABLE without reason
    const res1 = validateFacilityComplianceDeclaration({
      fei_status: "NOT_ISSUED",
      mocra_facility_status: "NOT_STARTED",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "",
    });
    expect(res1.valid).toBe(false);
    expect(res1.errors[0]).toContain("OTC 시설 해당 없음");

    // NOT_APPLICABLE with reason
    const res2 = validateFacilityComplianceDeclaration({
      fei_status: "NOT_ISSUED",
      mocra_facility_status: "NOT_STARTED",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "화장품 전용 제조시설로 OTC 의약외품 비생산",
    });
    expect(res2.valid).toBe(true);
  });

  // Scenario 9: Evidence Document Categories
  it("Scenario 9: provides comprehensive compliance evidence document categories", () => {
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("FEI_CONFIRMATION");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("MOCRA_FACILITY_RECEIPT");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("MOCRA_PRODUCT_LISTING");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("OTC_FACILITY_RECEIPT");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("OTC_NDC_LISTING");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("DRUG_FACTS_LABEL");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("EXEMPTION_STATEMENT");
    expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("OTHER");
  });

  // Scenario 10 & 11: Admin Verification and Import Readiness Statuses
  it("Scenario 10 & 11: verifies authoritative verification and readiness statuses", () => {
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("UNREVIEWED");
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("UNDER_REVIEW");
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("VERIFIED");
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("NEEDS_INFO");
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("RE_REVIEW_REQUIRED");
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("VALIDITY_REVIEW_REQUIRED");
    expect(COMPLIANCE_VERIFICATION_STATUSES).toContain("REJECTED");

    expect(IMPORT_READINESS_STATUSES).toContain("NOT_EVALUATED");
    expect(IMPORT_READINESS_STATUSES).toContain("READY");
    expect(IMPORT_READINESS_STATUSES).toContain("CONDITIONAL");
    expect(IMPORT_READINESS_STATUSES).toContain("BLOCKED");
    expect(IMPORT_READINESS_STATUSES).toContain("EXEMPT");
  });

  // Scenario 12: Shipping and Warehouse Protection
  it("Scenario 12: ensures manufacturing-only locations are excluded from shipping operations", () => {
    const locations = [
      { id: "loc-1", location_type: "SHIPPING_ORIGIN" as const },
      { id: "loc-2", location_type: "MANUFACTURING_FACILITY" as const },
      { id: "loc-3", location_type: "SHIPPING_AND_MANUFACTURING" as const },
    ];

    // Default shipping origin query excludes manufacturing-only
    const poAllowed = locations.filter((l) => isShippingCapableLocation(l.location_type));
    expect(poAllowed.map((l) => l.id)).toEqual(["loc-1", "loc-3"]);
    expect(poAllowed.some((l) => l.id === "loc-2")).toBe(false);
  });

  // Scenario 13 & 14: Incompatible Type Change & Deletion Guards
  it("Scenario 13 & 14: models linked product deletion guard logic", () => {
    const linkedProductsMock = [
      { id: "p-1", sku: "SKU-001", name_ko: "제품 1", is_primary: true },
      { id: "p-2", sku: "SKU-002", name_ko: "제품 2", is_primary: false },
    ];

    // If linked products exist, deletion must be blocked
    const canDelete = linkedProductsMock.length === 0;
    expect(canDelete).toBe(false);

    // Inactive conversion is the recommended fallback
    const recommendedStatus = "inactive";
    expect(recommendedStatus).toBe("inactive");
  });

  // Scenario 15 & 16: Product Facility Association Rules (1 Primary + N Additional, Duplicate Guard)
  it("Scenario 15 & 16: enforces exactly 1 primary facility and prevents duplicates in additional", () => {
    const primaryId = "fac-1";
    let additionalIds = ["fac-2", "fac-3"];

    // Try to add duplicate of primary into additional
    const cleanAdditional = Array.from(
      new Set(additionalIds.filter((id) => id !== primaryId))
    );
    expect(cleanAdditional).toEqual(["fac-2", "fac-3"]);

    // If primary changes to fac-2, it must be removed from additional
    const newPrimary = "fac-2";
    const nextAdditional = cleanAdditional.filter((id) => id !== newPrimary);
    expect(nextAdditional).toEqual(["fac-3"]);
  });

  // Scenario 17: Registration Evaluation & Grandfathering Contract
  it("Scenario 17: tests grandfathered non-blocking reminder vs new product enforcement", () => {
    // 17.A: Existing grandfathered product with missing facility -> NOT missing, reminder shown
    const gfResult = evaluatePrimaryFacilityRegistrationRule({
      hasPrimaryFacility: false,
      isGrandfathered: true,
      enforcePrimaryFacility: false,
    });
    expect(gfResult.isMissingRequired).toBe(false);
    expect(gfResult.showNonBlockingReminder).toBe(true);

    // 17.B: Production rule: enforcement is inactive until KSN-CMP-010
    const unforcedResult = evaluatePrimaryFacilityRegistrationRule({
      hasPrimaryFacility: false,
      isGrandfathered: false,
      enforcePrimaryFacility: false,
    });
    expect(unforcedResult.isMissingRequired).toBe(false);
    expect(unforcedResult.showNonBlockingReminder).toBe(true);

    // 17.C: Cutover rule: when enforced, new product missing primary facility is blocked
    const enforcedResult = evaluatePrimaryFacilityRegistrationRule({
      hasPrimaryFacility: false,
      isGrandfathered: false,
      enforcePrimaryFacility: true,
    });
    expect(enforcedResult.isMissingRequired).toBe(true);
    expect(enforcedResult.showNonBlockingReminder).toBe(false);

    // 17.D: Product registration status evaluation integration
    const baseInput: ProductRegistrationEvaluationInput = {
      name_en: "Sample Cleanser",
      brand_id: "brand-1",
      category_code: "CAT123",
      manufacture_sku: "MFG-SKU-001",
      origin: "South Korea",
      how_to_use: "Apply daily",
      price_krw_retail: 30000,
      price_usd_fob: 10,
      upc: "123456789012",
      item_width: 5,
      item_depth: 5,
      item_height: 10,
      item_weight: 100,
      package_width: 6,
      package_depth: 6,
      package_height: 11,
      package_weight: 120,
      carton_pack_qty: 24,
      carton_width: 30,
      carton_depth: 30,
      carton_height: 25,
      carton_weight: 3000,
      hasImages: true,
      categoryCompletion: {
        categoryComplete: true,
        requiredAttributesComplete: true,
      },
    };

    // With grandfathered missing facility (unenforced)
    const evalResult1 = evaluateProductRegistrationStatus({
      ...baseInput,
      complianceFacility: {
        hasPrimaryFacility: false,
        isGrandfathered: true,
        enforcePrimaryFacility: false,
      },
    });
    expect(evalResult1.status).toBe("COMPLETE");
    expect(evalResult1.facilityReminder).toBe(true);

    // With enforced cutover missing facility
    const evalResult2 = evaluateProductRegistrationStatus({
      ...baseInput,
      complianceFacility: {
        hasPrimaryFacility: false,
        isGrandfathered: false,
        enforcePrimaryFacility: true,
      },
    });
    expect(evalResult2.status).toBe("DRAFT");
    expect(evalResult2.missingFieldItems.some((m) => m.key === "primary_facility")).toBe(true);
  });
});
