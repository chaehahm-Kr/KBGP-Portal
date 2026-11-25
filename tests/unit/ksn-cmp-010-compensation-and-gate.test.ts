import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyComplianceV1PostCreateWrites,
  type ComplianceV1BulkWriter,
  type CreatedBulkProductRecord,
} from "@/lib/product/bulk-import-compliance-compensation";
import {
  isComplianceV1Enabled,
  isPrimaryFacilityEnforced,
  isRegulatoryAttributeRelocated,
  requireComplianceV1MutationAllowed,
  setComplianceV1FeatureGateOverride,
} from "@/lib/compliance/v1-feature-gate";
import type { BulkNormalizedProductPayload } from "@/lib/product/bulk-import-types";

function makeCreatedProduct(overrides?: Partial<CreatedBulkProductRecord>): CreatedBulkProductRecord {
  const payload = {
    brand_id: "brand-1",
    manufacture_sku: "SKU-CMP-010-001",
    name_en: "Test Compliance Cream",
    common_attributes: [],
    facilities: {
      primary_facility_id: "fac-primary-1",
      additional_facility_ids: ["fac-add-1"],
    },
    regulatory_compliance: {
      us_classification: "COSMETIC",
      otc_applicability: "NOT_APPLICABLE",
      otc_dual_mocra_applicable: null,
      mocra_listing_status: "LISTED",
      mocra_listing_number: "ML-2026-0001",
      mocra_exemption_reason: null,
      mocra_listed_at: "2026-01-15",
      mocra_next_renewal_date: "2027-01-15",
      otc_listing_status: "NOT_APPLICABLE",
      otc_ndc_number: null,
      otc_na_reason: "Cosmetic only",
      otc_listed_at: null,
      otc_next_renewal_date: null,
      drug_facts_status: "NOT_APPLICABLE",
      fda_legacy_status: "REGISTERED",
      legacy_migration_snapshot: null,
    },
  } as unknown as BulkNormalizedProductPayload;

  return {
    id: "prod-uuid-1",
    excelRowNumber: 7,
    sku: "SKU-CMP-010-001",
    nameEn: "Test Compliance Cream",
    payload,
    ...overrides,
  };
}

describe("KSN-CMP-010: Bulk Import Compliance V1 Delete-on-Failure Compensation", () => {
  it("succeeds and increments both facility and regulatory counters when both writes pass", async () => {
    const writer: ComplianceV1BulkWriter = {
      replaceProductManufacturingFacilities: vi.fn().mockResolvedValue({ error: null }),
      upsertProductRegulatoryCompliance: vi.fn().mockResolvedValue({ error: null }),
      deleteOrphanedProduct: vi.fn().mockResolvedValue({ error: null }),
    };
    const logger = { error: vi.fn() };

    const result = await applyComplianceV1PostCreateWrites({
      createdProducts: [makeCreatedProduct()],
      companyId: "company-a",
      actorId: "user-a",
      nowIso: "2026-11-25T18:00:00.000Z",
      writer,
      logger,
    });

    expect(result.survivingProducts).toHaveLength(1);
    expect(result.rejectedRows).toHaveLength(0);
    expect(result.facilitiesLinkedCount).toBe(1);
    expect(result.regulatoryDeclarationsSavedCount).toBe(1);
    expect(result.validationErrorCountDelta).toBe(0);
    expect(result.compensationFailedCount).toBe(0);
    expect(writer.deleteOrphanedProduct).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("compensates by deleting newly created product when facility association fails", async () => {
    const writer: ComplianceV1BulkWriter = {
      replaceProductManufacturingFacilities: vi
        .fn()
        .mockResolvedValue({ error: { message: "Cross-company facility rejected" } }),
      upsertProductRegulatoryCompliance: vi.fn().mockResolvedValue({ error: null }),
      deleteOrphanedProduct: vi.fn().mockResolvedValue({ error: null }),
    };
    const logger = { error: vi.fn() };

    const result = await applyComplianceV1PostCreateWrites({
      createdProducts: [makeCreatedProduct()],
      companyId: "company-a",
      actorId: "user-a",
      nowIso: "2026-11-25T18:00:00.000Z",
      writer,
      logger,
    });

    expect(result.survivingProducts).toHaveLength(0);
    expect(result.facilitiesLinkedCount).toBe(0);
    expect(result.regulatoryDeclarationsSavedCount).toBe(0);
    expect(result.validationErrorCountDelta).toBe(1);
    expect(result.compensationFailedCount).toBe(0);
    expect(writer.upsertProductRegulatoryCompliance).not.toHaveBeenCalled();
    expect(writer.deleteOrphanedProduct).toHaveBeenCalledWith("prod-uuid-1");
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0].errorReason).toContain("제조시설 연결 실패");
  });

  it("compensates and does NOT inflate facilitiesLinkedCount when regulatory save fails after facility link", async () => {
    const writer: ComplianceV1BulkWriter = {
      replaceProductManufacturingFacilities: vi.fn().mockResolvedValue({ error: null }),
      upsertProductRegulatoryCompliance: vi
        .fn()
        .mockResolvedValue({ error: { message: "check constraint violation" } }),
      deleteOrphanedProduct: vi.fn().mockResolvedValue({ error: null }),
    };
    const logger = { error: vi.fn() };

    const result = await applyComplianceV1PostCreateWrites({
      createdProducts: [makeCreatedProduct()],
      companyId: "company-a",
      actorId: "user-a",
      nowIso: "2026-11-25T18:00:00.000Z",
      writer,
      logger,
    });

    expect(result.survivingProducts).toHaveLength(0);
    expect(result.facilitiesLinkedCount).toBe(0);
    expect(result.regulatoryDeclarationsSavedCount).toBe(0);
    expect(result.validationErrorCountDelta).toBe(1);
    expect(result.compensationFailedCount).toBe(0);
    expect(writer.deleteOrphanedProduct).toHaveBeenCalledWith("prod-uuid-1");
    expect(result.rejectedRows[0].errorReason).toContain("규제 준수 정보 저장 실패");
  });

  it("logs CRITICAL diagnostic and reports recoverable failure when compensation delete itself fails", async () => {
    const writer: ComplianceV1BulkWriter = {
      replaceProductManufacturingFacilities: vi.fn().mockResolvedValue({ error: null }),
      upsertProductRegulatoryCompliance: vi
        .fn()
        .mockResolvedValue({ error: { message: "DB timeout" } }),
      deleteOrphanedProduct: vi
        .fn()
        .mockResolvedValue({ error: { message: "FK lock timeout" } }),
    };
    const logger = { error: vi.fn() };

    const result = await applyComplianceV1PostCreateWrites({
      createdProducts: [makeCreatedProduct()],
      companyId: "company-a",
      actorId: "user-a",
      nowIso: "2026-11-25T18:00:00.000Z",
      writer,
      logger,
    });

    expect(result.survivingProducts).toHaveLength(0);
    expect(result.facilitiesLinkedCount).toBe(0);
    expect(result.regulatoryDeclarationsSavedCount).toBe(0);
    expect(result.validationErrorCountDelta).toBe(1);
    expect(result.compensationFailedCount).toBe(1);
    expect(result.rejectedRows[0].errorReason).toContain("자동 정리 실패");
    expect(result.rejectedRows[0].errorReason).toContain("prod-uuid-1");
    expect(result.rejectedRows[0].correctiveGuidance).toContain("보상 삭제");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("CRITICAL: Compensation delete failed for orphaned product prod-uuid-1")
    );
  });
});

describe("KSN-CMP-010: Compliance V1 Feature Release Gate Server Enforcement", () => {
  const origPublic = process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED;
  const origServerDisabled = process.env.COMPLIANCE_V1_SERVER_DISABLED;

  afterEach(() => {
    setComplianceV1FeatureGateOverride(null);
    if (origPublic === undefined) delete process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED;
    else process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED = origPublic;

    if (origServerDisabled === undefined) delete process.env.COMPLIANCE_V1_SERVER_DISABLED;
    else process.env.COMPLIANCE_V1_SERVER_DISABLED = origServerDisabled;
  });

  it("defaults to OFF and blocks V1 mutations with FEATURE_GATED", () => {
    delete process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED;
    delete process.env.COMPLIANCE_V1_SERVER_DISABLED;
    setComplianceV1FeatureGateOverride(null);

    expect(isComplianceV1Enabled()).toBe(false);
    expect(isRegulatoryAttributeRelocated()).toBe(false);
    expect(isPrimaryFacilityEnforced()).toBe(false);

    const guard = requireComplianceV1MutationAllowed();
    expect(guard.allowed).toBe(false);
    if (!guard.allowed) {
      expect(guard.errorCode).toBe("FEATURE_GATED");
    }
  });

  it("allows V1 mutations when NEXT_PUBLIC_COMPLIANCE_V1_ENABLED=true and server kill-switch is not set", () => {
    process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED = "true";
    delete process.env.COMPLIANCE_V1_SERVER_DISABLED;
    setComplianceV1FeatureGateOverride(null);

    expect(isComplianceV1Enabled()).toBe(true);
    expect(isRegulatoryAttributeRelocated()).toBe(true);
    expect(isPrimaryFacilityEnforced()).toBe(true);
    expect(requireComplianceV1MutationAllowed()).toEqual({ allowed: true });
  });

  it("enforces server-only kill-switch COMPLIANCE_V1_SERVER_DISABLED=true even when public env is true", () => {
    process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED = "true";
    process.env.COMPLIANCE_V1_SERVER_DISABLED = "true";
    setComplianceV1FeatureGateOverride(true);

    expect(isComplianceV1Enabled()).toBe(false);
    const guard = requireComplianceV1MutationAllowed();
    expect(guard.allowed).toBe(false);
    if (!guard.allowed) {
      expect(guard.errorCode).toBe("FEATURE_GATED");
    }
  });
});
