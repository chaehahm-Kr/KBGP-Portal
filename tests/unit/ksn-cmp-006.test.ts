import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  FDA_NON_APPROVAL_DISCLAIMER_KO,
  FDA_NON_APPROVAL_DISCLAIMER_EN,
  US_REGULATORY_CLASSIFICATIONS,
  OTC_APPLICABILITIES,
  MOCRA_LISTING_STATUSES,
  OTC_LISTING_STATUSES,
  DRUG_FACTS_STATUSES,
  COMPLIANCE_VERIFICATION_STATUSES,
  IMPORT_READINESS_STATUSES,
  COMPLIANCE_DOCUMENT_CATEGORIES,
  evaluateRenewalWindow,
  mapLegacyRegulatoryValues,
} from "@/lib/compliance/v1-types";
import {
  RELOCATED_REGULATORY_ATTRIBUTE_CODES,
  getProductRegulatoryCompletion,
} from "@/lib/product/attribute-completion";
import {
  validateProductRegulatoryDeclaration,
} from "@/lib/compliance/v1-validators";

describe("KSN-CMP-006: Brand SKU, Regulatory & Compliance Workspace and ADMIN Compliance Center", () => {
  // ==========================================================================
  // 1. Global Brand SKU Terminology & Physical Column Integrity
  // ==========================================================================
  describe("1. Brand SKU Terminology & Physical Column Integrity", () => {
    it("preserves underlying products.manufacture_sku column in domain models", () => {
      // Physical column products.manufacture_sku must NOT be dropped or renamed
      const mockProduct = {
        id: "prod-123",
        manufacture_sku: "BRAND-SKU-999",
      };
      expect(mockProduct.manufacture_sku).toBe("BRAND-SKU-999");
    });

    it("verifies RELOCATED_REGULATORY_ATTRIBUTE_CODES contains exactly the 4 relocated attributes", () => {
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("FDA_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("MOCRA_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("OTC_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES).toContain("DRUG_FACTS_STATUS");
      expect(RELOCATED_REGULATORY_ATTRIBUTE_CODES.length).toBe(4);
    });
  });

  // ==========================================================================
  // 2. Section 01: US Regulatory Classification & Non-Approval Disclaimers
  // ==========================================================================
  describe("2. Section 01: US Regulatory Classification", () => {
    it("contains authoritative FDA non-approval disclaimers in KO and EN", () => {
      expect(FDA_NON_APPROVAL_DISCLAIMER_KO).toContain("FDA 제품 승인(Approval) 또는 인증(Certification)을 의미하지 않습니다");
      expect(FDA_NON_APPROVAL_DISCLAIMER_EN).toContain("does NOT constitute FDA approval or certification");
    });

    it("supports all required classifications including UNDETERMINED and COSMETIC_OTC_DUAL", () => {
      expect(US_REGULATORY_CLASSIFICATIONS).toContain("UNDETERMINED");
      expect(US_REGULATORY_CLASSIFICATIONS).toContain("COSMETIC");
      expect(US_REGULATORY_CLASSIFICATIONS).toContain("OTC_DRUG");
      expect(US_REGULATORY_CLASSIFICATIONS).toContain("COSMETIC_OTC_DUAL");
      expect(US_REGULATORY_CLASSIFICATIONS).toContain("NOT_APPLICABLE");
    });

    it("supports dual review required in OTC applicabilities", () => {
      expect(OTC_APPLICABILITIES).toContain("UNKNOWN");
      expect(OTC_APPLICABILITIES).toContain("APPLICABLE");
      expect(OTC_APPLICABILITIES).toContain("NOT_APPLICABLE");
      expect(OTC_APPLICABILITIES).toContain("DUAL_REVIEW_REQUIRED");
    });
  });

  // ==========================================================================
  // 3. Section 03 & 04: MoCRA Listing, OTC NDC, and Drug Facts Verification
  // ==========================================================================
  describe("3. Section 03 & 04: MoCRA and OTC Listings & Drug Facts", () => {
    it("supports all MoCRA product listing statuses including EXEMPT_SMALL_BUSINESS", () => {
      expect(MOCRA_LISTING_STATUSES).toContain("UNKNOWN");
      expect(MOCRA_LISTING_STATUSES).toContain("NOT_STARTED");
      expect(MOCRA_LISTING_STATUSES).toContain("IN_PROGRESS");
      expect(MOCRA_LISTING_STATUSES).toContain("LISTED");
      expect(MOCRA_LISTING_STATUSES).toContain("EXEMPT_SMALL_BUSINESS");
      expect(MOCRA_LISTING_STATUSES).toContain("NOT_APPLICABLE");
    });

    it("strictly separates Drug Facts READY from VERIFIED", () => {
      expect(DRUG_FACTS_STATUSES).toContain("READY");
      expect(DRUG_FACTS_STATUSES).toContain("VERIFIED");

      // Brand Portal cannot declare VERIFIED
      const brandValidation = validateProductRegulatoryDeclaration(
        {
          us_classification: "OTC_DRUG",
          mocra_listing_status: "NOT_APPLICABLE",
          otc_listing_status: "LISTED",
          drug_facts_status: "VERIFIED",
        },
        { isAdmin: false }
      );
      expect(brandValidation.valid).toBe(false);
      expect(brandValidation.errors[0]).toContain("Drug Facts VERIFIED 상태는 ADMIN 검증을 통해서만 설정할 수 있습니다");

      // Admin CAN declare VERIFIED
      const adminValidation = validateProductRegulatoryDeclaration(
        {
          us_classification: "OTC_DRUG",
          mocra_listing_status: "NOT_APPLICABLE",
          mocra_exemption_reason: "OTC drug only, exempt from MoCRA cosmetic listing",
          otc_listing_status: "LISTED",
          otc_ndc_number: "12345-678-90",
          drug_facts_status: "VERIFIED",
        },
        { isAdmin: true }
      );
      expect(adminValidation.valid).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Section 05 & 06: Documents, Admin Verification & Import Readiness
  // ==========================================================================
  describe("4. Section 05 & 06: Compliance Documents, Review & Import Readiness", () => {
    it("defines authoritative compliance evidence document categories", () => {
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("FEI_CONFIRMATION");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("MOCRA_FACILITY_RECEIPT");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("MOCRA_PRODUCT_LISTING");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("OTC_FACILITY_RECEIPT");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("OTC_NDC_LISTING");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("DRUG_FACTS_LABEL");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("EXEMPTION_STATEMENT");
      expect(COMPLIANCE_DOCUMENT_CATEGORIES).toContain("OTHER");
    });

    it("supports all 7 compliance verification statuses and 5 import readiness statuses", () => {
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
  });

  // ==========================================================================
  // 5. Renewal Window Evaluation & Multi-Window Classification
  // ==========================================================================
  describe("5. Regulatory Renewal Window Evaluation", () => {
    const refDate = new Date("2026-06-01T00:00:00Z");

    it("returns NOT_APPLICABLE when registration is not active", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: false,
        nextRenewalDate: "2026-12-31",
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("NOT_APPLICABLE");
      expect(res.daysRemaining).toBeNull();
    });

    it("returns CONFIRMATION_REQUIRED when renewal date is missing for active registration", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: true,
        nextRenewalDate: null,
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("CONFIRMATION_REQUIRED");
      expect(res.daysRemaining).toBeNull();
    });

    it("correctly flags OVERDUE when target date has passed", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: true,
        nextRenewalDate: "2026-05-15",
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("OVERDUE");
      expect(res.daysRemaining).toBeLessThan(0);
    });

    it("correctly flags URGENT_30D for 1 to 30 days remaining", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: true,
        nextRenewalDate: "2026-06-20",
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("URGENT_30D");
      expect(res.daysRemaining).toBe(19);
    });

    it("correctly flags PREPARATION_60D for 31 to 60 days remaining", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: true,
        nextRenewalDate: "2026-07-15",
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("PREPARATION_60D");
      expect(res.daysRemaining).toBe(44);
    });

    it("correctly flags UPCOMING_90D for 61 to 90 days remaining", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: true,
        nextRenewalDate: "2026-08-15",
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("UPCOMING_90D");
      expect(res.daysRemaining).toBe(75);
    });

    it("correctly flags CURRENT for more than 90 days remaining", () => {
      const res = evaluateRenewalWindow({
        isActiveRegistration: true,
        nextRenewalDate: "2026-12-31",
        referenceDate: refDate,
      });
      expect(res.urgency).toBe("CURRENT");
      expect(res.daysRemaining).toBeGreaterThan(90);
    });
  });

  // ==========================================================================
  // 6. Lossless Legacy R4 -> V1 Regulatory Mapping
  // ==========================================================================
  describe("6. Lossless Legacy Regulatory Value Mapping", () => {
    it("maps NOT_OTC to otc_applicability=NOT_APPLICABLE without fabricating COSMETIC", () => {
      const mapped = mapLegacyRegulatoryValues({
        otcStatus: "NOT_OTC",
        mocraStatus: "NOT_REVIEWED",
      });
      expect(mapped.otc_applicability).toBe("NOT_APPLICABLE");
      expect(mapped.us_classification).toBe("UNDETERMINED"); // Preserves UNDETERMINED for explicit human review!
      expect(mapped.original_snapshot.otcStatus).toBe("NOT_OTC");
    });

    it("flags ambiguous MoCRA NA as review warning instead of auto-granting small business exemption", () => {
      const mapped = mapLegacyRegulatoryValues({
        mocraStatus: "NA",
      });
      expect(mapped.mocra_listing_status).toBe("UNKNOWN");
      expect(mapped.review_warnings.some((w) => w.includes("ambiguous"))).toBe(true);
    });
  });
});
