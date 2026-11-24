import { describe, it, expect } from "vitest";
import {
  evaluateRenewalWindow,
  mapLegacyRegulatoryValues,
} from "@/lib/compliance/v1-types";
import {
  evaluatePrimaryFacilityRegistrationRule,
  isFacilityComplianceCriticalChange,
  validateFacilityComplianceDeclaration,
  validateProductRegulatoryDeclaration,
} from "@/lib/compliance/v1-validators";

describe("KSN-CMP-001-R1 — Renewal Windows, Legacy Mapping, Validation & Grandfathering", () => {
  it("classifies 90/60/30-day renewal windows, overdue, and confirmation-required without inventing dates", () => {
    const ref = new Date("2026-11-24T00:00:00Z");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: false, nextRenewalDate: null, referenceDate: ref }).urgency
    ).toBe("NOT_APPLICABLE");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: true, nextRenewalDate: null, referenceDate: ref }).urgency
    ).toBe("CONFIRMATION_REQUIRED");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: true, nextRenewalDate: "2026-11-10", referenceDate: ref }).urgency
    ).toBe("OVERDUE");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: true, nextRenewalDate: "2026-12-10", referenceDate: ref }).urgency
    ).toBe("URGENT_30D");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: true, nextRenewalDate: "2027-01-10", referenceDate: ref }).urgency
    ).toBe("PREPARATION_60D");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: true, nextRenewalDate: "2027-02-10", referenceDate: ref }).urgency
    ).toBe("UPCOMING_90D");

    expect(
      evaluateRenewalWindow({ isActiveRegistration: true, nextRenewalDate: "2027-06-01", referenceDate: ref }).urgency
    ).toBe("CURRENT");
  });

  it("maps legacy R4 regulatory attributes without false COSMETIC or MoCRA exemption coercion", () => {
    const mapped = mapLegacyRegulatoryValues({
      fdaStatus: "NA",
      mocraStatus: "NOT_APPLICABLE",
      otcStatus: "NOT_OTC",
      drugFactsStatus: "READY",
    });

    // NOT_OTC must NOT blindly imply COSMETIC
    expect(mapped.us_classification).toBe("UNDETERMINED");
    expect(mapped.otc_applicability).toBe("NOT_APPLICABLE");
    expect(mapped.otc_listing_status).toBe("NOT_APPLICABLE");

    // Legacy MoCRA NOT_APPLICABLE must NOT become listing exemption
    expect(mapped.mocra_listing_status).toBe("UNKNOWN");

    // Drug Facts READY must NOT become VERIFIED
    expect(mapped.drug_facts_status).toBe("READY");
    expect(mapped.fda_legacy_status).toBe("NA");
    expect(mapped.review_warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("enforces required registration numbers, exemption rationales, and optional evidence", () => {
    // Missing FEI when ISSUED or REGISTERED -> rejected
    const badFac = validateFacilityComplianceDeclaration({
      fei_status: "ISSUED",
      fei_number: "",
      mocra_facility_status: "REGISTERED",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "",
    });
    expect(badFac.valid).toBe(false);
    expect(badFac.errors.length).toBeGreaterThanOrEqual(3);

    // Valid facility with single FEI number & no evidence uploaded -> valid
    const goodFac = validateFacilityComplianceDeclaration({
      fei_status: "ISSUED",
      fei_number: "3012345678",
      mocra_facility_status: "REGISTERED",
      otc_facility_status: "NOT_APPLICABLE",
      otc_na_reason: "Cosmetic-only manufacturing plant",
    });
    expect(goodFac.valid).toBe(true);

    // Product: LISTED requires number; Brand Portal cannot self-set Drug Facts VERIFIED
    const badProd = validateProductRegulatoryDeclaration(
      {
        us_classification: "COSMETIC_OTC_DUAL",
        otc_dual_mocra_applicable: null,
        mocra_listing_status: "LISTED",
        mocra_listing_number: "",
        otc_listing_status: "LISTED",
        otc_ndc_number: "",
        drug_facts_status: "VERIFIED",
      },
      { isAdmin: false }
    );
    expect(badProd.valid).toBe(false);
    expect(badProd.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("enforces grandfathering preservation vs new final registration facility rule", () => {
    // Draft / pre-cutover: optional
    expect(
      evaluatePrimaryFacilityRegistrationRule({
        hasPrimaryFacility: false,
        isGrandfathered: false,
        enforcePrimaryFacility: false,
      }).isMissingRequired
    ).toBe(false);

    // Grandfathered COMPLETE product on normal edit: preserved COMPLETE + non-blocking reminder
    const grandfatheredEdit = evaluatePrimaryFacilityRegistrationRule({
      hasPrimaryFacility: false,
      isGrandfathered: true,
      isExplicitFinalSubmission: false,
      enforcePrimaryFacility: true,
    });
    expect(grandfatheredEdit.isMissingRequired).toBe(false);
    expect(grandfatheredEdit.showNonBlockingReminder).toBe(true);

    // New product final registration without primary facility: rejected!
    const newFinal = evaluatePrimaryFacilityRegistrationRule({
      hasPrimaryFacility: false,
      isGrandfathered: false,
      isExplicitFinalSubmission: true,
      enforcePrimaryFacility: true,
    });
    expect(newFinal.isMissingRequired).toBe(true);
  });

  it("distinguishes compliance-critical facility edits from unrelated shipping/Warehouse edits", () => {
    const prev = {
      name: "Seoul Plant",
      manufacturer_legal_name_en: "Alpha Cosmetics Co., Ltd.",
      address_line1: "123 Teheran-ro",
      notes: "Dock A",
      is_default: true,
    };
    // Unrelated shipping note change -> NOT critical
    expect(isFacilityComplianceCriticalChange(prev, { ...prev, notes: "Dock B", is_default: false })).toBe(false);
    // Factory address change -> CRITICAL (triggers re-review propagation)
    expect(isFacilityComplianceCriticalChange(prev, { ...prev, address_line1: "456 Gangnam-daero" })).toBe(true);
  });
});
