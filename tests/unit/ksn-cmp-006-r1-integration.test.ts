import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isComplianceV1Enabled,
  setComplianceV1FeatureGateOverride,
  requireComplianceV1MutationAllowed,
  isRegulatoryAttributeRelocated,
  isPrimaryFacilityEnforced,
} from "@/lib/compliance/v1-feature-gate";
import {
  IMPORT_READINESS_STATUSES,
  type ImportReadinessStatus,
  US_REGULATORY_CLASSIFICATIONS,
  MOCRA_LISTING_STATUSES,
  OTC_LISTING_STATUSES,
  DRUG_FACTS_STATUSES,
  COMPLIANCE_VERIFICATION_STATUSES,
} from "@/lib/compliance/v1-types";
import {
  validateProductRegulatoryDeclaration,
  validateFacilityComplianceDeclaration,
  evaluatePrimaryFacilityRegistrationRule,
} from "@/lib/compliance/v1-validators";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { RELOCATED_REGULATORY_ATTRIBUTE_CODES } from "@/lib/product/attribute-completion";

describe("KSN-CMP-006-R1: Facility & Regulatory Integration and Release Gate Tests", () => {
  beforeEach(() => {
    setComplianceV1FeatureGateOverride(null);
  });

  afterEach(() => {
    setComplianceV1FeatureGateOverride(null);
  });

  describe("1. Authoritative Release Gate Verification", () => {
    it("defaults to FALSE (disabled) before KSN-CMP-010 cutover", () => {
      delete process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED;
      expect(isComplianceV1Enabled()).toBe(false);
      expect(isRegulatoryAttributeRelocated()).toBe(false);
      expect(isPrimaryFacilityEnforced()).toBe(false);
    });

    it("blocks state-changing mutations with FEATURE_GATED when gate is disabled", () => {
      setComplianceV1FeatureGateOverride(false);
      const gate = requireComplianceV1MutationAllowed();
      expect(gate.allowed).toBe(false);
      if (!gate.allowed) {
        expect(gate.errorCode).toBe("FEATURE_GATED");
        expect(gate.error).toContain("Release Gate Protected");
      }
    });

    it("permits mutations when gate is explicitly enabled after cutover", () => {
      setComplianceV1FeatureGateOverride(true);
      const gate = requireComplianceV1MutationAllowed();
      expect(gate.allowed).toBe(true);
      expect(isRegulatoryAttributeRelocated()).toBe(true);
      expect(isPrimaryFacilityEnforced()).toBe(true);
    });
  });

  describe("2. Canonical Import Readiness & Regulatory Enums Consistency", () => {
    it("strictly enforces canonical 5 import readiness statuses matching DB check constraint", () => {
      expect(IMPORT_READINESS_STATUSES).toEqual([
        "NOT_EVALUATED",
        "READY",
        "CONDITIONAL",
        "BLOCKED",
        "EXEMPT",
      ]);
      expect(IMPORT_READINESS_STATUSES).toHaveLength(5);
    });

    it("does NOT contain competing or non-canonical statuses", () => {
      const nonCanonical = [
        "DOCUMENT_PENDING",
        "READY_PENDING_REVIEW",
        "CLEARED_FOR_IMPORT",
        "UNDER_REVIEW",
        "PENDING_REVIEW",
      ];
      nonCanonical.forEach((st) => {
        expect(IMPORT_READINESS_STATUSES as readonly string[]).not.toContain(st);
      });
    });

    it("strictly preserves UNKNOWN vs NOT_APPLICABLE distinction across regulatory domains", () => {
      expect(MOCRA_LISTING_STATUSES).toContain("UNKNOWN");
      expect(MOCRA_LISTING_STATUSES).toContain("NOT_APPLICABLE");
      expect(MOCRA_LISTING_STATUSES).toContain("EXEMPT_SMALL_BUSINESS");

      expect(OTC_LISTING_STATUSES).toContain("UNKNOWN");
      expect(OTC_LISTING_STATUSES).toContain("NOT_APPLICABLE");

      expect(DRUG_FACTS_STATUSES).toContain("NOT_APPLICABLE");
      expect(DRUG_FACTS_STATUSES).toContain("DRAFT");
      expect(DRUG_FACTS_STATUSES).toContain("READY");
      expect(DRUG_FACTS_STATUSES).toContain("VERIFIED");
    });
  });

  describe("3. Security: Brand Declaration vs Admin Verification Isolation", () => {
    it("rejects Brand Portal declaration with drug_facts_status='VERIFIED'", () => {
      const result = validateProductRegulatoryDeclaration(
        {
          us_classification: "OTC_DRUG",
          mocra_listing_status: "NOT_APPLICABLE",
          mocra_exemption_reason: "OTC drug",
          otc_listing_status: "LISTED",
          otc_ndc_number: "12345-678-90",
          drug_facts_status: "VERIFIED",
        },
        { isAdmin: false }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("VERIFIED 상태는 ADMIN 검증을 통해서만"))).toBe(true);
    });

    it("permits Admin to set drug_facts_status='VERIFIED'", () => {
      const result = validateProductRegulatoryDeclaration(
        {
          us_classification: "OTC_DRUG",
          mocra_listing_status: "NOT_APPLICABLE",
          mocra_exemption_reason: "OTC drug exclusion",
          otc_listing_status: "LISTED",
          otc_ndc_number: "12345-678-90",
          drug_facts_status: "VERIFIED",
        },
        { isAdmin: true }
      );
      expect(result.valid).toBe(true);
    });

    it("requires MoCRA Listing Number when status is LISTED", () => {
      const result = validateProductRegulatoryDeclaration({
        us_classification: "COSMETIC",
        mocra_listing_status: "LISTED",
        mocra_listing_number: "",
        otc_listing_status: "NOT_APPLICABLE",
        otc_na_reason: "Cosmetic product",
        drug_facts_status: "NOT_APPLICABLE",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Cosmetic Product Listing Number"))).toBe(true);
    });

    it("requires exemption reason when MoCRA status is EXEMPT_SMALL_BUSINESS or NOT_APPLICABLE", () => {
      const result = validateProductRegulatoryDeclaration({
        us_classification: "COSMETIC",
        mocra_listing_status: "EXEMPT_SMALL_BUSINESS",
        mocra_exemption_reason: "",
        otc_listing_status: "NOT_APPLICABLE",
        otc_na_reason: "Cosmetic product",
        drug_facts_status: "NOT_APPLICABLE",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("면제 또는 해당 없음"))).toBe(true);
    });
  });

  describe("4. Product Registration Rule & Pre/Post-Cutover Compatibility", () => {
    const baseInput = {
      name: "테스트 세럼",
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

    it("pre-cutover: product registration does NOT require primary facility", () => {
      setComplianceV1FeatureGateOverride(false);
      const evalResult = evaluateProductRegistrationStatus({
        ...baseInput,
        complianceFacility: {
          hasPrimaryFacility: false,
          isGrandfathered: false,
          // When not explicitly set, defaults to isPrimaryFacilityEnforced() which is false
        },
      });
      expect(evalResult.status).toBe("COMPLETE");
      expect(evalResult.missingFieldItems.some((m) => m.key === "primary_facility")).toBe(false);
    });

    it("post-cutover: product registration requires primary facility for new non-grandfathered products", () => {
      setComplianceV1FeatureGateOverride(true);
      const evalResult = evaluateProductRegistrationStatus({
        ...baseInput,
        complianceFacility: {
          hasPrimaryFacility: false,
          isGrandfathered: false,
        },
      });
      expect(evalResult.status).toBe("DRAFT");
      expect(evalResult.missingFieldItems.some((m) => m.key === "primary_facility")).toBe(true);
    });

    it("post-cutover: grandfathered products maintain COMPLETE with non-blocking reminder", () => {
      setComplianceV1FeatureGateOverride(true);
      const evalResult = evaluateProductRegistrationStatus({
        ...baseInput,
        complianceFacility: {
          hasPrimaryFacility: false,
          isGrandfathered: true,
        },
      });
      expect(evalResult.status).toBe("COMPLETE");
      expect(evalResult.facilityReminder).toBe(true);
      expect(evalResult.missingFieldItems.some((m) => m.key === "primary_facility")).toBe(false);
    });
  });

  describe("5. Regulatory Attribute Relocation Contract", () => {
    it("tracks the four canonical relocated regulatory attributes", () => {
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("FDA_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("MOCRA_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("OTC_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("DRUG_FACTS_STATUS");
    });
  });
});
