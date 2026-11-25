import type { BulkNormalizedProductPayload, BulkRejectedRowItem } from "@/lib/product/bulk-import-types";

export interface CreatedBulkProductRecord {
  id: string;
  excelRowNumber: number;
  sku: string;
  nameEn: string;
  payload: BulkNormalizedProductPayload;
}

export interface ComplianceV1BulkWriter {
  replaceProductManufacturingFacilities: (params: {
    p_product_id: string;
    p_company_id: string;
    p_primary_facility_id: string | null;
    p_additional_facility_ids: string[];
    p_actor_id: string;
  }) => Promise<{ error: { message: string } | null }>;
  upsertProductRegulatoryCompliance: (
    row: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>;
  deleteOrphanedProduct: (
    productId: string
  ) => Promise<{ error: { message: string } | null }>;
}

export interface ComplianceV1PostCreateResult<
  T extends CreatedBulkProductRecord = CreatedBulkProductRecord
> {
  survivingProducts: T[];
  rejectedRows: BulkRejectedRowItem[];
  facilitiesLinkedCount: number;
  regulatoryDeclarationsSavedCount: number;
  validationErrorCountDelta: number;
  compensationFailedCount: number;
}

/**
 * Applies Compliance V1 post-create writes (manufacturing facility links + regulatory declaration)
 * for newly created Draft products.
 *
 * NOTE: This uses delete-on-failure compensation rather than an atomic cross-table DB transaction.
 * If either facility association or regulatory persistence fails, the newly created Draft product
 * row is deleted via compensation and the delete result is explicitly verified. If compensation
 * itself fails, a recoverable failure diagnostic is logged and surfaced in rejectedRows.
 */
export async function applyComplianceV1PostCreateWrites<
  T extends CreatedBulkProductRecord
>(params: {
  createdProducts: T[];
  companyId: string;
  actorId: string;
  nowIso: string;
  writer: ComplianceV1BulkWriter;
  logger?: Pick<Console, "error">;
}): Promise<ComplianceV1PostCreateResult<T>> {
  const { createdProducts, companyId, actorId, nowIso, writer } = params;
  const logger = params.logger ?? console;

  const survivingProducts: T[] = [];
  const rejectedRows: BulkRejectedRowItem[] = [];
  let facilitiesLinkedCount = 0;
  let regulatoryDeclarationsSavedCount = 0;
  let validationErrorCountDelta = 0;
  let compensationFailedCount = 0;

  for (const created of createdProducts) {
    let failed = false;
    let failureReason = "";
    let linkedFacilityForRow = false;
    let savedRegulatoryForRow = false;

    // 1. Link manufacturing facilities via replace_product_manufacturing_facilities RPC
    if (created.payload.facilities) {
      const fac = created.payload.facilities;
      const { error: rpcErr } = await writer.replaceProductManufacturingFacilities({
        p_product_id: created.id,
        p_company_id: companyId,
        p_primary_facility_id: fac.primary_facility_id,
        p_additional_facility_ids: fac.additional_facility_ids || [],
        p_actor_id: actorId,
      });

      if (rpcErr) {
        failed = true;
        failureReason = `제조시설 연결 실패: ${rpcErr.message}`;
      } else {
        linkedFacilityForRow = true;
      }
    }

    // 2. Save regulatory compliance declaration
    if (!failed && created.payload.regulatory_compliance) {
      const reg = created.payload.regulatory_compliance;
      const { error: regErr } = await writer.upsertProductRegulatoryCompliance({
        product_id: created.id,
        company_id: companyId,
        us_classification: reg.us_classification,
        otc_applicability: reg.otc_applicability || "UNKNOWN",
        otc_dual_mocra_applicable: reg.otc_dual_mocra_applicable ?? null,
        classification_rationale: null,
        mocra_listing_status: reg.mocra_listing_status || "UNKNOWN",
        mocra_listing_number: reg.mocra_listing_number || null,
        mocra_exemption_reason: reg.mocra_exemption_reason || null,
        mocra_listed_at: reg.mocra_listed_at || null,
        mocra_next_renewal_date: reg.mocra_next_renewal_date || null,
        otc_listing_status: reg.otc_listing_status || "UNKNOWN",
        otc_ndc_number: reg.otc_ndc_number || null,
        otc_na_reason: reg.otc_na_reason || null,
        otc_listed_at: reg.otc_listed_at || null,
        otc_next_renewal_date: reg.otc_next_renewal_date || null,
        drug_facts_status: reg.drug_facts_status || "UNKNOWN",
        fda_legacy_status: reg.fda_legacy_status || null,
        legacy_migration_snapshot: reg.legacy_migration_snapshot || null,
        verification_status: "UNREVIEWED",
        import_readiness_status: "NOT_EVALUATED",
        last_brand_submitted_at: nowIso,
        updated_by: actorId,
        updated_at: nowIso,
      });

      if (regErr) {
        failed = true;
        failureReason = `규제 준수 정보 저장 실패: ${regErr.message}`;
      } else {
        savedRegulatoryForRow = true;
      }
    }

    if (failed) {
      logger.error(
        `[BulkImport] Running delete-on-failure compensation for product ${created.id} (SKU: ${created.sku}) due to: ${failureReason}`
      );
      const { error: delErr } = await writer.deleteOrphanedProduct(created.id);

      let finalErrorReason = failureReason;
      let correctiveGuidance = "제조시설 및 규제 정보 입력값을 확인한 후 다시 업로드해 주세요.";

      if (delErr) {
        compensationFailedCount += 1;
        logger.error(
          `[BulkImport] CRITICAL: Compensation delete failed for orphaned product ${created.id} (SKU: ${created.sku}): ${delErr.message}`
        );
        finalErrorReason = `${failureReason} (자동 정리 실패: 임시 상품 ${created.id} 삭제 중 오류 - ${delErr.message})`;
        correctiveGuidance =
          "임시 생성된 상품 정리(보상 삭제)에 실패했습니다. 상품 목록에서 해당 SKU를 확인·삭제한 후 다시 업로드하거나 관리자에게 문의해 주세요.";
      }

      validationErrorCountDelta += 1;
      rejectedRows.push({
        excelRowNumber: created.excelRowNumber,
        manufactureSku: created.sku,
        productName: created.nameEn,
        errorReason: finalErrorReason,
        correctiveGuidance,
        isDuplicate: false,
      });
    } else {
      if (linkedFacilityForRow) facilitiesLinkedCount += 1;
      if (savedRegulatoryForRow) regulatoryDeclarationsSavedCount += 1;
      survivingProducts.push(created);
    }
  }

  return {
    survivingProducts,
    rejectedRows,
    facilitiesLinkedCount,
    regulatoryDeclarationsSavedCount,
    validationErrorCountDelta,
    compensationFailedCount,
  };
}
