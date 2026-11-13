"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requirePortalPermission } from "@/lib/company/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordProductChangeLog } from "@/lib/product/audit";
import {
  BULK_IMPORT_MAX_FILE_BYTES,
  BULK_MEDIA_MAX_IMAGES_PER_PRODUCT,
  type BulkImportExecutionResult,
  type BulkMediaBatchResult,
  type BulkMediaFailureItem,
  type BulkNormalizedProductPayload,
  type BulkPendingMediaTask,
  type BulkPreviewResult,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkReferenceCommonAttribute,
  type BulkRejectedRowItem,
} from "@/lib/product/bulk-import-types";
import { parseAndValidateBulkProductWorkbook } from "@/lib/product/bulk-import-validator";
import {
  generateAnnotatedErrorWorkbookBuffer,
  generateBulkImportErrorBuffer,
  generateBulkProductTemplateBuffer,
} from "@/lib/product/bulk-import-template";
import { downloadVerifiedProductImage } from "@/lib/product/bulk-media-ingestor";

// Server-side in-flight and short-TTL idempotency protection
const inFlightBatchKeys = new Set<string>();
const completedBatchTimestamps = new Map<string, number>();
const COMPLETED_BATCH_TTL_MS = 60 * 1000; // 60s rapid duplicate-click guard (DB unique index permanently guards SKUs)

const MAX_MEDIA_PRODUCTS_PER_BATCH = 10;
const MEDIA_DOWNLOAD_CONCURRENCY = 4;

function pruneExpiredBatchKeys() {
  const now = Date.now();
  for (const [k, ts] of completedBatchTimestamps.entries()) {
    if (now - ts > COMPLETED_BATCH_TTL_MS) {
      completedBatchTimestamps.delete(k);
    }
  }
}

function computeBatchFingerprint(companyId: string, skus: string[]): string {
  const canonical = `${companyId}::${[...skus].sort().join("|")}`;
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

async function loadBulkValidationReferenceData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
): Promise<{
  brands: BulkReferenceBrand[];
  categories: BulkReferenceCategory[];
  commonAttributes: BulkReferenceCommonAttribute[];
  existingCompanySkus: Set<string>;
  existingUpcs: Set<string>;
  existingEans: Set<string>;
}> {
  const [brandsRes, categoriesRes, companyProductsRes, commonAttrsRes, commonOptsRes] =
    await Promise.all([
      supabase
        .from("brands")
        .select("id, name, is_active")
        .eq("company_id", companyId)
        .order("name", { ascending: true }),
      supabase
        .from("categories")
        .select("code, name_ko, name_en, depth, parent_code, is_final, is_active, display_order")
        .order("depth", { ascending: true })
        .order("display_order", { ascending: true }),
      supabase
        .from("products")
        .select("manufacture_sku, upc, ean")
        .eq("company_id", companyId),
      supabase
        .from("attributes")
        .select(
          "code, name_ko, name_en, input_type, is_multiple, unit_set, allow_na, allow_other, brand_editable, admin_only, is_active, display_order"
        )
        .eq("scope", "COMMON")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("attribute_options")
        .select("attribute_code, option_code, option_ko, option_en, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

  const brands: BulkReferenceBrand[] = (brandsRes.data ?? []).map((b: any) => ({
    id: String(b.id),
    name: String(b.name || ""),
    is_active: b.is_active !== false,
  }));

  const categories: BulkReferenceCategory[] = (categoriesRes.data ?? []).map((c: any) => ({
    code: String(c.code),
    name_ko: String(c.name_ko || ""),
    name_en: c.name_en ? String(c.name_en) : null,
    depth: Number(c.depth),
    parent_code: c.parent_code ? String(c.parent_code) : null,
    is_final: Boolean(c.is_final),
    is_active: c.is_active !== false,
    display_order: Number(c.display_order ?? 0),
  }));

  const optionsByAttrCode = new Map<
    string,
    Array<{ optionCode: string; optionKo: string; optionEn: string | null; displayOrder: number }>
  >();
  for (const o of commonOptsRes.data ?? []) {
    const attrCode = String(o.attribute_code || "");
    if (!attrCode) continue;
    const list = optionsByAttrCode.get(attrCode) ?? [];
    list.push({
      optionCode: String(o.option_code),
      optionKo: String(o.option_ko || ""),
      optionEn: o.option_en ? String(o.option_en) : null,
      displayOrder: Number(o.display_order ?? 0),
    });
    optionsByAttrCode.set(attrCode, list);
  }

  const commonAttributes: BulkReferenceCommonAttribute[] = (commonAttrsRes.data ?? []).map(
    (a: any) => ({
      code: String(a.code),
      nameKo: String(a.name_ko || ""),
      nameEn: a.name_en ? String(a.name_en) : null,
      inputType: String(a.input_type || "SINGLE_SELECT"),
      isMultiple: Boolean(a.is_multiple),
      unitSet: a.unit_set ? String(a.unit_set) : null,
      allowNa: Boolean(a.allow_na),
      allowOther: Boolean(a.allow_other),
      brandEditable: a.brand_editable !== false,
      adminOnly: Boolean(a.admin_only),
      isActive: a.is_active !== false,
      options: optionsByAttrCode.get(String(a.code)) ?? [],
    })
  );

  const existingCompanySkus = new Set<string>();
  const existingUpcs = new Set<string>();
  const existingEans = new Set<string>();

  for (const p of companyProductsRes.data ?? []) {
    if (p.manufacture_sku && String(p.manufacture_sku).trim() !== "") {
      existingCompanySkus.add(String(p.manufacture_sku).trim().toUpperCase());
    }
    if (p.upc && String(p.upc).trim() !== "") {
      existingUpcs.add(String(p.upc).trim());
    }
    if (p.ean && String(p.ean).trim() !== "") {
      existingEans.add(String(p.ean).trim());
    }
  }

  return {
    brands,
    categories,
    commonAttributes,
    existingCompanySkus,
    existingUpcs,
    existingEans,
  };
}

function mapPayloadToProductInsertRow(
  companyId: string,
  payload: BulkNormalizedProductPayload
) {
  return {
    company_id: companyId,
    brand_id: payload.brand_id,
    name: payload.name,
    name_en: payload.name_en,
    manufacture_sku: payload.manufacture_sku,
    category: payload.category,
    category_code: payload.category_code,
    volume: payload.volume,
    origin: payload.origin, // Null if blank — never auto-assigned to South Korea
    lead_time: payload.lead_time,
    color: payload.color,
    color_map: payload.color_map,
    description: payload.description,
    bullet_points: payload.bullet_points,
    how_to_use: payload.how_to_use,
    ingredients_text: payload.ingredients_text,
    parent_sku: payload.parent_sku,
    child_sku: payload.child_sku,
    upc: payload.upc,
    ean: payload.ean,
    selling_online: payload.selling_online,
    selling_offline: payload.selling_offline,
    sales_link_1: payload.sales_link_1,
    sales_link_2: payload.sales_link_2,
    price_krw_retail: payload.price_krw_retail,
    price_krw_wholesale: payload.price_krw_wholesale,
    estimated_retail_price: payload.estimated_retail_price,
    price_usd_fob: payload.price_usd_fob,
    item_width: payload.item_width,
    item_depth: payload.item_depth,
    item_height: payload.item_height,
    item_weight: payload.item_weight,
    package_width: payload.package_width,
    package_depth: payload.package_depth,
    package_height: payload.package_height,
    package_weight: payload.package_weight,
    carton_pack_qty: payload.carton_pack_qty,
    carton_width: payload.carton_width,
    carton_depth: payload.carton_depth,
    carton_height: payload.carton_height,
    carton_weight: payload.carton_weight,
    carton_cbm: payload.carton_cbm,
    palette_carton_qty: payload.palette_carton_qty,
    palette_width: payload.palette_width,
    palette_depth: payload.palette_depth,
    palette_height: payload.palette_height,
    palette_weight: payload.palette_weight,
    // Strict Draft & Retailer Hub non-exposure safeguards
    status: "registered" as const,
    selection_status: "UNREVIEWED",
    sales_status: "PREPARING",
    trading_status: "inactive",
    retailer_visibility: "hidden",
  };
}

function emptyFailureResult(error: string, totalUploadedRows = 0): BulkImportExecutionResult {
  return {
    success: false,
    error,
    totalUploadedRows,
    createdCount: 0,
    rejectedCount: totalUploadedRows,
    duplicateCount: 0,
    validationErrorCount: 0,
    commonAttributesSavedCount: 0,
    videosImportedCount: 0,
    createdProductIds: [],
    rejectedRows: [],
    pendingMediaTasks: [],
    mediaFailures: [],
  };
}

export async function downloadBulkProductTemplateAction(): Promise<{
  success: boolean;
  base64?: string;
  fileName?: string;
  activeBrandCount?: number;
  error?: string;
}> {
  try {
    const { companyId } = await requirePortalPermission("products", "write");
    const supabase = await createClient();

    const { brands, categories, commonAttributes } = await loadBulkValidationReferenceData(
      supabase,
      companyId
    );
    const activeBrands = brands.filter((b) => b.is_active);

    const buffer = await generateBulkProductTemplateBuffer({
      brands,
      categories,
      commonAttributes,
    });

    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return {
      success: true,
      base64: buffer.toString("base64"),
      fileName: `KSN_Brand_Product_Bulk_Template_${dateTag}.xlsx`,
      activeBrandCount: activeBrands.length,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Excel 양식을 생성하지 못했습니다.",
    };
  }
}

export async function validateBulkProductExcelAction(
  formData: FormData
): Promise<BulkPreviewResult> {
  try {
    const { companyId } = await requirePortalPermission("products", "write");
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: "업로드할 .xlsx Excel 파일을 선택해 주세요.",
      };
    }

    if (file.size > BULK_IMPORT_MAX_FILE_BYTES) {
      return {
        success: false,
        error: "파일 크기가 허용 한도(10 MB)를 초과했습니다.",
      };
    }

    const supabase = await createClient();
    const refData = await loadBulkValidationReferenceData(supabase, companyId);

    if (refData.brands.filter((b) => b.is_active).length === 0) {
      return {
        success: false,
        error:
          "귀사에 등록된 활성 브랜드가 없습니다. 브랜드를 먼저 등록하거나 활성화한 후 이용해 주세요.",
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const preview = parseAndValidateBulkProductWorkbook({
      fileName: file.name,
      buffer: new Uint8Array(arrayBuffer),
      companyBrands: refData.brands,
      allCategories: refData.categories,
      commonAttributes: refData.commonAttributes,
      existingCompanySkus: refData.existingCompanySkus,
      existingUpcs: refData.existingUpcs,
      existingEans: refData.existingEans,
    });

    if (!preview.success || !preview.rows) {
      return preview;
    }

    const importableSkus = preview.rows
      .filter((r) => r.status !== "INVALID" && r.payload)
      .map((r) => r.payload!.manufacture_sku);

    const batchFingerprint = computeBatchFingerprint(companyId, importableSkus);

    return {
      ...preview,
      batchFingerprint,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Excel 파일 검증 중 오류가 발생했습니다.",
    };
  }
}

export async function executeBulkProductImportAction(
  formData: FormData
): Promise<BulkImportExecutionResult> {
  pruneExpiredBatchKeys();

  const lockKeys: string[] = [];
  try {
    const membership = await requirePortalPermission("products", "write");
    const { companyId } = membership;

    if (membership.isImpersonating) {
      return emptyFailureResult(
        "상품 대량 등록은 브랜드 포털 정식 로그인 세션에서만 실행할 수 있습니다."
      );
    }

    const file = formData.get("file");
    const clientSubmissionKey = String(formData.get("submissionKey") || "").trim();

    if (!file || !(file instanceof File)) {
      return emptyFailureResult(
        "업로드된 Excel 파일 정보를 찾을 수 없습니다. 파일을 다시 선택해 주세요."
      );
    }

    if (clientSubmissionKey) {
      const scopedSubmissionKey = `sub:${companyId}:${clientSubmissionKey}`;
      if (
        inFlightBatchKeys.has(scopedSubmissionKey) ||
        completedBatchTimestamps.has(scopedSubmissionKey)
      ) {
        return emptyFailureResult(
          "이미 처리 중이거나 등록 완료된 요청입니다. 중복 등록이 차단되었습니다."
        );
      }
      inFlightBatchKeys.add(scopedSubmissionKey);
      lockKeys.push(scopedSubmissionKey);
    }

    const supabase = await createClient();

    // Verify authenticated user under RLS
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return emptyFailureResult("로그인 세션이 만료되었습니다. 다시 로그인한 후 시도해 주세요.");
    }

    // Server-side full re-validation against live database state
    const refData = await loadBulkValidationReferenceData(supabase, companyId);
    const arrayBuffer = await file.arrayBuffer();
    const revalidated = parseAndValidateBulkProductWorkbook({
      fileName: file.name,
      buffer: new Uint8Array(arrayBuffer),
      companyBrands: refData.brands,
      allCategories: refData.categories,
      commonAttributes: refData.commonAttributes,
      existingCompanySkus: refData.existingCompanySkus,
      existingUpcs: refData.existingUpcs,
      existingEans: refData.existingEans,
    });

    if (!revalidated.success || !revalidated.rows || !revalidated.summary) {
      return emptyFailureResult(revalidated.error || "서버 데이터 검증에 실패했습니다.");
    }

    const validCandidateRows = revalidated.rows.filter(
      (r) => r.status !== "INVALID" && r.payload !== null
    );
    const invalidCandidateRows = revalidated.rows.filter((r) => r.status === "INVALID");

    if (validCandidateRows.length > 0) {
      const fingerprintKey = `fp:${computeBatchFingerprint(
        companyId,
        validCandidateRows.map((r) => r.payload!.manufacture_sku)
      )}`;
      if (inFlightBatchKeys.has(fingerprintKey)) {
        return emptyFailureResult(
          "동일한 상품 묶음이 현재 등록 처리 중입니다. 중복 요청이 차단되었습니다.",
          revalidated.rows.length
        );
      }
      inFlightBatchKeys.add(fingerprintKey);
      lockKeys.push(fingerprintKey);
    }

    const rejectedRows: BulkRejectedRowItem[] = invalidCandidateRows.map((row) => ({
      excelRowNumber: row.excelRowNumber,
      manufactureSku: row.rawManufactureSku || "",
      productName: row.rawProductNameEn || "",
      errorReason: row.errors.join(" | "),
      correctiveGuidance:
        row.correctiveGuidance.join(" | ") ||
        "오류 항목을 수정한 후 다시 업로드해 주세요.",
      isDuplicate: row.isDuplicateError,
    }));

    let duplicateCount = invalidCandidateRows.filter((r) => r.isDuplicateError).length;
    let validationErrorCount = invalidCandidateRows.filter((r) => r.isValidationError).length;

    const createdProducts: Array<{
      id: string;
      excelRowNumber: number;
      sku: string;
      nameEn: string;
      brandName: string;
      payload: BulkNormalizedProductPayload;
    }> = [];

    // 1. Insert validated Draft products in chunks of 50 with automatic per-row fallback on DB unique collision
    const CHUNK_SIZE = 50;
    for (let start = 0; start < validCandidateRows.length; start += CHUNK_SIZE) {
      const chunk = validCandidateRows.slice(start, start + CHUNK_SIZE);
      const insertPayloads = chunk.map((r) =>
        mapPayloadToProductInsertRow(companyId, r.payload!)
      );

      const { data: insertedChunk, error: chunkError } = await supabase
        .from("products")
        .insert(insertPayloads)
        .select("id, manufacture_sku, name_en");

      if (!chunkError && insertedChunk && insertedChunk.length === chunk.length) {
        insertedChunk.forEach((createdRow: any, idx: number) => {
          createdProducts.push({
            id: String(createdRow.id),
            excelRowNumber: chunk[idx].excelRowNumber,
            sku: chunk[idx].payload!.manufacture_sku,
            nameEn: chunk[idx].payload!.name_en,
            brandName: chunk[idx].payload!.brand_name,
            payload: chunk[idx].payload!,
          });
        });
      } else {
        for (const row of chunk) {
          const singlePayload = mapPayloadToProductInsertRow(companyId, row.payload!);
          const { data: singleCreated, error: singleErr } = await supabase
            .from("products")
            .insert(singlePayload)
            .select("id")
            .single();

          if (!singleErr && singleCreated) {
            createdProducts.push({
              id: String(singleCreated.id),
              excelRowNumber: row.excelRowNumber,
              sku: row.payload!.manufacture_sku,
              nameEn: row.payload!.name_en,
              brandName: row.payload!.brand_name,
              payload: row.payload!,
            });
          } else {
            const isUniqueViolation = singleErr?.code === "23505";
            const msg = singleErr?.message || "";
            let reason = "데이터베이스 제약 조건으로 인해 등록되지 않았습니다.";
            let guidance = "입력값을 확인한 후 다시 시도해 주세요.";

            if (isUniqueViolation) {
              duplicateCount += 1;
              if (msg.toLowerCase().includes("ean")) {
                reason = `EAN 바코드 "${row.payload!.ean}"은(는) 이미 시스템에 등록되어 있습니다.`;
                guidance = "중복되지 않는 고유한 13자리 EAN 바코드를 입력해 주세요.";
              } else if (msg.toLowerCase().includes("upc")) {
                reason = `UPC 바코드 "${row.payload!.upc}"은(는) 이미 시스템에 등록되어 있습니다.`;
                guidance = "중복되지 않는 고유한 12자리 UPC 바코드를 입력해 주세요.";
              } else if (msg.toLowerCase().includes("sku")) {
                reason = `제조사 SKU "${row.payload!.manufacture_sku}"은(는) 이미 등록된 상품입니다.`;
                guidance = "기존 SKU는 덮어쓰지 않습니다. 새로운 고유 제조사 SKU를 지정해 주세요.";
              } else {
                reason = "중복된 식별 코드(SKU 또는 바코드)가 이미 존재합니다.";
                guidance = "제조사 SKU, UPC, EAN이 중복되지 않는지 확인해 주세요.";
              }
            } else {
              validationErrorCount += 1;
              reason = `등록 실패: ${msg || "제약 조건 검증 오류"}`;
            }

            rejectedRows.push({
              excelRowNumber: row.excelRowNumber,
              manufactureSku: row.payload!.manufacture_sku,
              productName: row.payload!.name_en,
              errorReason: reason,
              correctiveGuidance: guidance,
              isDuplicate: isUniqueViolation,
            });
          }
        }
      }
    }

    rejectedRows.sort((a, b) => a.excelRowNumber - b.excelRowNumber);

    // 2. Save COMMON Product Attributes into product_attribute_values (RLS enforced, isolated per created product)
    let commonAttributesSavedCount = 0;
    const nowIso = new Date().toISOString();
    const allAttrRows: Array<{
      product_id: string;
      attribute_code: string;
      value_json: string | string[];
      text_value: string | null;
      updated_at: string;
    }> = [];

    for (const created of createdProducts) {
      for (const entry of created.payload.common_attributes) {
        allAttrRows.push({
          product_id: created.id,
          attribute_code: entry.attribute_code,
          value_json: entry.value_json,
          text_value: entry.text_value,
          updated_at: nowIso,
        });
      }
    }

    const ATTR_CHUNK_SIZE = 200;
    for (let start = 0; start < allAttrRows.length; start += ATTR_CHUNK_SIZE) {
      const attrChunk = allAttrRows.slice(start, start + ATTR_CHUNK_SIZE);
      const { error: attrErr } = await supabase
        .from("product_attribute_values")
        .upsert(attrChunk, { onConflict: "product_id,attribute_code" });

      if (!attrErr) {
        commonAttributesSavedCount += attrChunk.length;
      } else {
        // Per-row fallback so one invalid attribute FK never drops other attributes
        for (const singleAttr of attrChunk) {
          const { error: singleAttrErr } = await supabase
            .from("product_attribute_values")
            .upsert(singleAttr, { onConflict: "product_id,attribute_code" });
          if (!singleAttrErr) {
            commonAttributesSavedCount += 1;
          } else {
            console.warn(
              `[BulkImport] Attribute save warning (${singleAttr.product_id} / ${singleAttr.attribute_code}):`,
              singleAttrErr.message
            );
          }
        }
      }
    }

    // 3. Save Product Video URLs into product_videos (separated from product creation)
    let videosImportedCount = 0;
    const mediaFailures: BulkMediaFailureItem[] = [];
    const videoCandidates = createdProducts.filter(
      (c) => Boolean(c.payload.product_video_url)
    );

    const VIDEO_CHUNK_SIZE = 50;
    for (let start = 0; start < videoCandidates.length; start += VIDEO_CHUNK_SIZE) {
      const vChunk = videoCandidates.slice(start, start + VIDEO_CHUNK_SIZE);
      const vInsertRows = vChunk.map((c) => ({
        product_id: c.id,
        company_id: companyId,
        video_url: c.payload.product_video_url!,
        position: 0,
      }));

      const { error: vChunkErr } = await supabase.from("product_videos").insert(vInsertRows);
      if (!vChunkErr) {
        videosImportedCount += vChunk.length;
      } else {
        for (const c of vChunk) {
          const { error: vSingleErr } = await supabase.from("product_videos").insert({
            product_id: c.id,
            company_id: companyId,
            video_url: c.payload.product_video_url!,
            position: 0,
          });
          if (!vSingleErr) {
            videosImportedCount += 1;
          } else {
            mediaFailures.push({
              excelRowNumber: c.excelRowNumber,
              productId: c.id,
              manufactureSku: c.sku,
              productNameEn: c.nameEn,
              columnHeader: "제품 소개 영상 URL (Product Video URL)",
              slotNumber: 11,
              url: c.payload.product_video_url!,
              errorReason: `동영상 링크 저장 실패: ${vSingleErr.message}`,
              correctiveGuidance:
                "상품 상세 페이지의 미디어 탭에서 소개 영상 URL을 직접 등록할 수 있습니다.",
            });
          }
        }
      }
    }

    // 4. Build chunkable Phase-2 image ingestion tasks for created products with image URLs
    const pendingMediaTasks: BulkPendingMediaTask[] = createdProducts
      .filter((c) => c.payload.image_urls.length > 0)
      .map((c) => ({
        excelRowNumber: c.excelRowNumber,
        productId: c.id,
        manufactureSku: c.sku,
        productNameEn: c.nameEn,
        imageUrls: c.payload.image_urls,
      }));

    // 5. Record audit logs for newly created Draft products (non-blocking best-effort)
    if (createdProducts.length > 0) {
      try {
        const [{ data: profile }, { data: company }] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
          supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
        ]);
        const actorName = profile?.display_name || user.email || "Brand User";
        const companyName = company?.name || "Brand Portal";

        const AUDIT_CONCURRENCY = 20;
        for (let i = 0; i < createdProducts.length; i += AUDIT_CONCURRENCY) {
          const slice = createdProducts.slice(i, i + AUDIT_CONCURRENCY);
          await Promise.allSettled(
            slice.map((item) =>
              recordProductChangeLog({
                productId: item.id,
                userId: user.id,
                userName: actorName,
                userEmail: user.email,
                source: "BRAND_PORTAL",
                companyName,
                section: "기본 정보",
                actionType: "CREATE",
                summary: `엑셀 일괄 등록 (Excel Bulk Upload) 신규 Draft 생성 — SKU: ${item.sku}${
                  item.payload.common_attributes.length > 0
                    ? ` (공통 속성 ${item.payload.common_attributes.length}개 포함)`
                    : ""
                }`,
                changes: {
                  manufacture_sku: { label: "제조사 SKU", before: null, after: item.sku },
                  name_en: { label: "제품명 (영문)", before: null, after: item.nameEn },
                  brandName: { label: "브랜드명", before: null, after: item.brandName },
                  category_code: {
                    label: "카테고리 코드",
                    before: null,
                    after: item.payload.category_code,
                  },
                },
              })
            )
          );
        }
      } catch (auditErr) {
        console.warn("[BulkImport] Non-fatal audit log warning:", auditErr);
      }

      revalidatePath("/portal/products");
      revalidatePath("/admin/products");
    }

    for (const k of lockKeys) {
      if (k.startsWith("sub:")) {
        completedBatchTimestamps.set(k, Date.now());
      }
    }

    let errorReportBase64: string | null = null;
    let errorReportFilename: string | null = null;
    if (rejectedRows.length > 0 || mediaFailures.length > 0) {
      const errBuf = await generateBulkImportErrorBuffer(rejectedRows, mediaFailures);
      errorReportBase64 = errBuf.toString("base64");
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      errorReportFilename = `KSN_Bulk_Import_Errors_${ts}.xlsx`;
    }

    return {
      success: true,
      totalUploadedRows: revalidated.rows.length,
      createdCount: createdProducts.length,
      rejectedCount: rejectedRows.length,
      duplicateCount,
      validationErrorCount,
      commonAttributesSavedCount,
      videosImportedCount,
      createdProductIds: createdProducts.map((c) => c.id),
      rejectedRows,
      pendingMediaTasks,
      mediaFailures,
      errorReportBase64,
      errorReportFilename,
    };
  } catch (err: any) {
    return emptyFailureResult(
      err?.message || "상품 대량 등록 처리 중 예기치 않은 오류가 발생했습니다."
    );
  } finally {
    for (const k of lockKeys) {
      inFlightBatchKeys.delete(k);
    }
  }
}

function parseSlotAndDigestFromStoragePath(storagePath: string): {
  slotNumber: number | null;
  digestPrefix: string | null;
} {
  const base = storagePath.split("/").pop() || "";
  const match = /^s(\d{2})_([0-9a-f]{12})_/i.exec(base);
  if (!match) {
    return { slotNumber: null, digestPrefix: null };
  }
  return {
    slotNumber: Number(match[1]),
    digestPrefix: match[2].toLowerCase(),
  };
}

/**
 * Chunked server-side media ingestion action.
 * Downloads external HTTPS images with SSRF protection + magic-byte verification,
 * uploads into private `company-uploads` storage, inserts `product_images` with
 * deterministic Main Image = position 0 ordering, and supports safe idempotent retry.
 */
export async function ingestBulkProductMediaBatchAction(
  tasks: BulkPendingMediaTask[]
): Promise<BulkMediaBatchResult> {
  try {
    const membership = await requirePortalPermission("products", "write");
    const { companyId } = membership;

    if (membership.isImpersonating) {
      return {
        success: false,
        error: "이미지 대량 수집은 브랜드 포털 정식 로그인 세션에서만 실행할 수 있습니다.",
        processedProducts: 0,
        imagesImportedCount: 0,
        duplicatesSkippedCount: 0,
        failures: [],
        retryTasks: tasks,
      };
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        success: true,
        processedProducts: 0,
        imagesImportedCount: 0,
        duplicatesSkippedCount: 0,
        failures: [],
        retryTasks: [],
      };
    }

    const boundedTasks = tasks.slice(0, MAX_MEDIA_PRODUCTS_PER_BATCH);
    const supabase = await createClient();

    const productIds = Array.from(new Set(boundedTasks.map((t) => t.productId)));
    const { data: ownedProducts, error: ownErr } = await supabase
      .from("products")
      .select("id, company_id, manufacture_sku, name_en")
      .eq("company_id", companyId)
      .in("id", productIds);

    if (ownErr) {
      return {
        success: false,
        error: `상품 소유권 확인에 실패했습니다: ${ownErr.message}`,
        processedProducts: 0,
        imagesImportedCount: 0,
        duplicatesSkippedCount: 0,
        failures: [],
        retryTasks: boundedTasks,
      };
    }

    const ownedProductSet = new Set((ownedProducts ?? []).map((p: any) => String(p.id)));

    const { data: existingImageRows } = await supabase
      .from("product_images")
      .select("id, product_id, storage_path, position")
      .eq("company_id", companyId)
      .in("product_id", productIds)
      .order("position", { ascending: true });

    const existingByProduct = new Map<
      string,
      Array<{ id: string; storage_path: string; position: number }>
    >();
    for (const img of existingImageRows ?? []) {
      const pid = String(img.product_id);
      const list = existingByProduct.get(pid) ?? [];
      list.push({
        id: String(img.id),
        storage_path: String(img.storage_path || ""),
        position: Number(img.position ?? 0),
      });
      existingByProduct.set(pid, list);
    }

    let imagesImportedCount = 0;
    let duplicatesSkippedCount = 0;
    const failures: BulkMediaFailureItem[] = [];
    const retryTasks: BulkPendingMediaTask[] = [];
    const touchedProductIds = new Set<string>();

    for (const task of boundedTasks) {
      if (!ownedProductSet.has(task.productId)) {
        for (const item of task.imageUrls) {
          failures.push({
            excelRowNumber: task.excelRowNumber,
            productId: task.productId,
            manufactureSku: task.manufactureSku,
            productNameEn: task.productNameEn,
            columnHeader: item.columnHeader,
            slotNumber: item.slotNumber,
            url: item.url,
            errorReason: "해당 상품에 대한 접근 권한이 없거나 소유 회사가 일치하지 않습니다.",
            correctiveGuidance: "본인 회사 소속 상품에 대해서만 미디어를 등록할 수 있습니다.",
          });
        }
        continue;
      }

      const currentImages = existingByProduct.get(task.productId) ?? [];
      const existingSlots = new Set<number>();
      const existingDigestPrefixes = new Set<string>();
      for (const existing of currentImages) {
        const meta = parseSlotAndDigestFromStoragePath(existing.storage_path);
        if (meta.slotNumber !== null) existingSlots.add(meta.slotNumber);
        if (meta.digestPrefix !== null) existingDigestPrefixes.add(meta.digestPrefix);
      }

      const orderedItems = [...task.imageUrls]
        .slice(0, BULK_MEDIA_MAX_IMAGES_PER_PRODUCT)
        .sort((a, b) => a.slotNumber - b.slotNumber);

      // Filter out slots already uploaded on an earlier attempt (idempotent retry)
      const itemsToDownload = orderedItems.filter((item) => !existingSlots.has(item.slotNumber));
      if (itemsToDownload.length === 0) {
        continue;
      }

      // Download candidate URLs for this product with bounded concurrency
      const downloadResults = new Array<
        Awaited<ReturnType<typeof downloadVerifiedProductImage>>
      >(itemsToDownload.length);
      for (let i = 0; i < itemsToDownload.length; i += MEDIA_DOWNLOAD_CONCURRENCY) {
        const slice = itemsToDownload.slice(i, i + MEDIA_DOWNLOAD_CONCURRENCY);
        const settled = await Promise.all(
          slice.map((item) => downloadVerifiedProductImage(item.url))
        );
        settled.forEach((res, idx) => {
          downloadResults[i + idx] = res;
        });
      }

      const failedRetryUrls: BulkPendingMediaTask["imageUrls"] = [];
      let currentImageTotal = currentImages.length;
      let orderNeedsReindex = false;

      for (let idx = 0; idx < itemsToDownload.length; idx++) {
        const item = itemsToDownload[idx];
        const dl = downloadResults[idx];

        if (!dl.ok) {
          failures.push({
            excelRowNumber: task.excelRowNumber,
            productId: task.productId,
            manufactureSku: task.manufactureSku,
            productNameEn: task.productNameEn,
            columnHeader: item.columnHeader,
            slotNumber: item.slotNumber,
            url: item.url,
            errorReason: dl.errorReason,
            correctiveGuidance: dl.correctiveGuidance,
          });
          failedRetryUrls.push(item);
          continue;
        }

        if (currentImageTotal >= BULK_MEDIA_MAX_IMAGES_PER_PRODUCT) {
          failures.push({
            excelRowNumber: task.excelRowNumber,
            productId: task.productId,
            manufactureSku: task.manufactureSku,
            productNameEn: task.productNameEn,
            columnHeader: item.columnHeader,
            slotNumber: item.slotNumber,
            url: item.url,
            errorReason: `상품당 최대 이미지 한도(${BULK_MEDIA_MAX_IMAGES_PER_PRODUCT}장)를 초과했습니다.`,
            correctiveGuidance: "불필요한 기존 이미지를 정리한 뒤 추가해 주세요.",
          });
          continue;
        }

        const digestPrefix = dl.sha256.slice(0, 12).toLowerCase();
        if (existingDigestPrefixes.has(digestPrefix)) {
          // Byte-identical image content already registered on this product — skip duplicate cleanly
          duplicatesSkippedCount += 1;
          continue;
        }

        const slotTag = `s${String(item.slotNumber).padStart(2, "0")}`;
        const storagePath = `${companyId}/products/${task.productId}/images/${slotTag}_${digestPrefix}_${crypto.randomUUID()}.${dl.extension}`;

        const { error: uploadErr } = await supabase.storage
          .from("company-uploads")
          .upload(storagePath, dl.buffer, {
            contentType: dl.mime,
            upsert: false,
          });

        if (uploadErr) {
          failures.push({
            excelRowNumber: task.excelRowNumber,
            productId: task.productId,
            manufactureSku: task.manufactureSku,
            productNameEn: task.productNameEn,
            columnHeader: item.columnHeader,
            slotNumber: item.slotNumber,
            url: item.url,
            errorReason: `스토리지 저장 실패: ${uploadErr.message}`,
            correctiveGuidance: "잠시 후 '실패 미디어 재시도' 버튼을 클릭하거나 상세 페이지에서 업로드해 주세요.",
          });
          failedRetryUrls.push(item);
          continue;
        }

        const provisionalPosition = currentImageTotal;
        const { data: insertedImg, error: insertImgErr } = await supabase
          .from("product_images")
          .insert({
            product_id: task.productId,
            company_id: companyId,
            storage_path: storagePath,
            position: provisionalPosition,
          })
          .select("id")
          .single();

        if (insertImgErr || !insertedImg) {
          // Clean up orphan storage object if DB insert failed
          await supabase.storage.from("company-uploads").remove([storagePath]).catch(() => {});
          failures.push({
            excelRowNumber: task.excelRowNumber,
            productId: task.productId,
            manufactureSku: task.manufactureSku,
            productNameEn: task.productNameEn,
            columnHeader: item.columnHeader,
            slotNumber: item.slotNumber,
            url: item.url,
            errorReason: `이미지 DB 등록 실패: ${insertImgErr?.message || "알 수 없는 오류"}`,
            correctiveGuidance: "잠시 후 '실패 미디어 재시도' 버튼을 클릭해 주세요.",
          });
          failedRetryUrls.push(item);
          continue;
        }

        currentImages.push({
          id: String(insertedImg.id),
          storage_path: storagePath,
          position: provisionalPosition,
        });
        existingSlots.add(item.slotNumber);
        existingDigestPrefixes.add(digestPrefix);
        currentImageTotal += 1;
        imagesImportedCount += 1;
        orderNeedsReindex = true;
        touchedProductIds.add(task.productId);
      }

      // Deterministic ordering: ensure Main Image (slot 1) is always position 0, slot 2..10 follow in order
      if (orderNeedsReindex && currentImages.length > 1) {
        const sortedImages = [...currentImages].sort((a, b) => {
          const slotA = parseSlotAndDigestFromStoragePath(a.storage_path).slotNumber ?? 999;
          const slotB = parseSlotAndDigestFromStoragePath(b.storage_path).slotNumber ?? 999;
          if (slotA !== slotB) return slotA - slotB;
          return a.position - b.position;
        });

        for (let pos = 0; pos < sortedImages.length; pos++) {
          if (sortedImages[pos].position !== pos) {
            await supabase
              .from("product_images")
              .update({ position: pos })
              .eq("id", sortedImages[pos].id)
              .eq("product_id", task.productId)
              .eq("company_id", companyId);
            sortedImages[pos].position = pos;
          }
        }
        existingByProduct.set(task.productId, sortedImages);
      }

      if (failedRetryUrls.length > 0) {
        retryTasks.push({
          excelRowNumber: task.excelRowNumber,
          productId: task.productId,
          manufactureSku: task.manufactureSku,
          productNameEn: task.productNameEn,
          imageUrls: failedRetryUrls,
        });
      }
    }

    if (touchedProductIds.size > 0) {
      revalidatePath("/portal/products");
      revalidatePath("/admin/products");
      for (const pid of touchedProductIds) {
        revalidatePath(`/portal/products/${pid}`);
        revalidatePath(`/admin/products/${pid}`);
      }
    }

    return {
      success: true,
      processedProducts: boundedTasks.length,
      imagesImportedCount,
      duplicatesSkippedCount,
      failures,
      retryTasks,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "외부 이미지 수집 처리 중 오류가 발생했습니다.",
      processedProducts: 0,
      imagesImportedCount: 0,
      duplicatesSkippedCount: 0,
      failures: [],
      retryTasks: tasks,
    };
  }
}

export async function generateCombinedBulkErrorReportAction(params: {
  rejectedRows: BulkRejectedRowItem[];
  mediaFailures: BulkMediaFailureItem[];
}): Promise<{
  success: boolean;
  base64?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    await requirePortalPermission("products", "write");
    const buf = await generateBulkImportErrorBuffer(
      params.rejectedRows ?? [],
      params.mediaFailures ?? []
    );
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return {
      success: true,
      base64: buf.toString("base64"),
      fileName: `KSN_Bulk_Import_Report_${ts}.xlsx`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "오류 리포트 Excel 생성에 실패했습니다.",
    };
  }
}

export async function downloadAnnotatedErrorWorkbookAction(
  formData: FormData
): Promise<{
  success: boolean;
  base64?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const { companyId } = await requirePortalPermission("products", "write");
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: "원본 Excel 파일 정보를 찾을 수 없습니다. 파일을 다시 선택해 주세요.",
      };
    }

    if (file.size > BULK_IMPORT_MAX_FILE_BYTES) {
      return {
        success: false,
        error: "파일 크기가 허용 한도(10 MB)를 초과했습니다.",
      };
    }

    const supabase = await createClient();
    const refData = await loadBulkValidationReferenceData(supabase, companyId);
    const arrayBuffer = await file.arrayBuffer();

    const preview = parseAndValidateBulkProductWorkbook({
      fileName: file.name,
      buffer: new Uint8Array(arrayBuffer),
      companyBrands: refData.brands,
      allCategories: refData.categories,
      commonAttributes: refData.commonAttributes,
      existingCompanySkus: refData.existingCompanySkus,
      existingUpcs: refData.existingUpcs,
      existingEans: refData.existingEans,
    });

    if (!preview.success || !preview.rows) {
      return {
        success: false,
        error: preview.error || "원본 Excel 데이터를 검증하지 못했습니다.",
      };
    }

    const buf = await generateAnnotatedErrorWorkbookBuffer({
      brands: refData.brands,
      categories: refData.categories,
      commonAttributes: refData.commonAttributes,
      preview,
    });

    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeStem = file.name
      .replace(/\.xlsx$/i, "")
      .replace(/[^a-zA-Z0-9가-힣_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);

    return {
      success: true,
      base64: buf.toString("base64"),
      fileName: `${safeStem || "KSN_Product_Upload"}_오류표시_${ts}.xlsx`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "오류 표시 Excel 생성 중 예기치 않은 오류가 발생했습니다.",
    };
  }
}
