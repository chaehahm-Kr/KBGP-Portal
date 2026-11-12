"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requirePortalPermission } from "@/lib/company/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordProductChangeLog } from "@/lib/product/audit";
import {
  BULK_IMPORT_MAX_FILE_BYTES,
  type BulkImportExecutionResult,
  type BulkNormalizedProductPayload,
  type BulkPreviewResult,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkRejectedRowItem,
} from "@/lib/product/bulk-import-types";
import { parseAndValidateBulkProductWorkbook } from "@/lib/product/bulk-import-validator";
import {
  generateBulkImportErrorBuffer,
  generateBulkProductTemplateBuffer,
} from "@/lib/product/bulk-import-template";

// Server-side in-flight and short-TTL idempotency protection
const inFlightBatchKeys = new Set<string>();
const completedBatchTimestamps = new Map<string, number>();
const COMPLETED_BATCH_TTL_MS = 60 * 1000; // 60s rapid duplicate-click guard (DB unique index permanently guards SKUs)

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
  existingCompanySkus: Set<string>;
  existingUpcs: Set<string>;
  existingEans: Set<string>;
}> {
  const [brandsRes, categoriesRes, companyProductsRes] = await Promise.all([
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

    const { brands, categories } = await loadBulkValidationReferenceData(supabase, companyId);
    const activeBrands = brands.filter((b) => b.is_active);

    const buffer = await generateBulkProductTemplateBuffer({
      brands,
      categories,
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
      error: err?.message || "Failed to generate Excel template.",
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
        error: "Please select an .xlsx Excel file to upload.",
      };
    }

    if (file.size > BULK_IMPORT_MAX_FILE_BYTES) {
      return {
        success: false,
        error: "Excel file exceeds the maximum allowed size of 10 MB.",
      };
    }

    const supabase = await createClient();
    const refData = await loadBulkValidationReferenceData(supabase, companyId);

    if (refData.brands.filter((b) => b.is_active).length === 0) {
      return {
        success: false,
        error: "Your company has no active brands. Please register or activate a brand before uploading products.",
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const preview = parseAndValidateBulkProductWorkbook({
      fileName: file.name,
      buffer: new Uint8Array(arrayBuffer),
      companyBrands: refData.brands,
      allCategories: refData.categories,
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
      error: err?.message || "Unexpected error while validating Excel file.",
    };
  }
}

export async function executeBulkProductImportAction(
  formData: FormData
): Promise<BulkImportExecutionResult> {
  pruneExpiredBatchKeys();

  let lockKeys: string[] = [];
  try {
    const membership = await requirePortalPermission("products", "write");
    const { companyId } = membership;

    if (membership.isImpersonating) {
      return {
        success: false,
        error: "Product bulk writes require an authenticated Brand Portal session so Supabase RLS is enforced.",
        totalUploadedRows: 0,
        createdCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        validationErrorCount: 0,
        createdProductIds: [],
        rejectedRows: [],
      };
    }

    const file = formData.get("file");
    const clientSubmissionKey = String(formData.get("submissionKey") || "").trim();

    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: "Uploaded Excel file is missing. Please re-upload the file.",
        totalUploadedRows: 0,
        createdCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        validationErrorCount: 0,
        createdProductIds: [],
        rejectedRows: [],
      };
    }

    if (clientSubmissionKey) {
      const scopedSubmissionKey = `sub:${companyId}:${clientSubmissionKey}`;
      if (inFlightBatchKeys.has(scopedSubmissionKey) || completedBatchTimestamps.has(scopedSubmissionKey)) {
        return {
          success: false,
          error: "This import batch has already been submitted. Duplicate submission was prevented.",
          totalUploadedRows: 0,
          createdCount: 0,
          rejectedCount: 0,
          duplicateCount: 0,
          validationErrorCount: 0,
          createdProductIds: [],
          rejectedRows: [],
        };
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
      return {
        success: false,
        error: "Your Brand Portal session has expired. Please sign in again.",
        totalUploadedRows: 0,
        createdCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        validationErrorCount: 0,
        createdProductIds: [],
        rejectedRows: [],
      };
    }

    // Server-side full re-validation against live database state
    const refData = await loadBulkValidationReferenceData(supabase, companyId);
    const arrayBuffer = await file.arrayBuffer();
    const revalidated = parseAndValidateBulkProductWorkbook({
      fileName: file.name,
      buffer: new Uint8Array(arrayBuffer),
      companyBrands: refData.brands,
      allCategories: refData.categories,
      existingCompanySkus: refData.existingCompanySkus,
      existingUpcs: refData.existingUpcs,
      existingEans: refData.existingEans,
    });

    if (!revalidated.success || !revalidated.rows || !revalidated.summary) {
      return {
        success: false,
        error: revalidated.error || "Server-side validation failed.",
        totalUploadedRows: 0,
        createdCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        validationErrorCount: 0,
        createdProductIds: [],
        rejectedRows: [],
      };
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
        return {
          success: false,
          error: "An identical import batch is currently in progress. Duplicate submission was blocked.",
          totalUploadedRows: revalidated.rows.length,
          createdCount: 0,
          rejectedCount: revalidated.rows.length,
          duplicateCount: 0,
          validationErrorCount: 0,
          createdProductIds: [],
          rejectedRows: [],
        };
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
        "Review and correct the invalid field values before re-uploading.",
      isDuplicate: row.isDuplicateError,
    }));

    let duplicateCount = invalidCandidateRows.filter((r) => r.isDuplicateError).length;
    let validationErrorCount = invalidCandidateRows.filter((r) => r.isValidationError).length;

    const createdProducts: Array<{
      id: string;
      sku: string;
      nameEn: string;
      brandName: string;
    }> = [];

    // Insert validated rows in chunks of 50 with automatic per-row fallback if DB unique constraint triggers
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
            sku: chunk[idx].payload!.manufacture_sku,
            nameEn: chunk[idx].payload!.name_en,
            brandName: chunk[idx].payload!.brand_name,
          });
        });
      } else {
        // Fallback: insert row-by-row so valid rows still succeed and specific DB collisions (e.g. global EAN 23505) are isolated
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
              sku: row.payload!.manufacture_sku,
              nameEn: row.payload!.name_en,
              brandName: row.payload!.brand_name,
            });
          } else {
            const isUniqueViolation = singleErr?.code === "23505";
            const msg = singleErr?.message || "";
            let reason = "Database rejected row during Draft creation.";
            let guidance = "Verify all field values and try again.";

            if (isUniqueViolation) {
              duplicateCount += 1;
              if (msg.toLowerCase().includes("ean")) {
                reason = `EAN "${row.payload!.ean}" is already registered in the system.`;
                guidance = "Provide a unique 13-digit EAN barcode not used by any existing product.";
              } else if (msg.toLowerCase().includes("sku")) {
                reason = `Manufacturer SKU "${row.payload!.manufacture_sku}" already exists in your company catalog.`;
                guidance = "Existing SKUs are never overwritten. Assign a new unique Manufacturer SKU.";
              } else {
                reason = "Duplicate product identifier (SKU or Barcode) already exists.";
                guidance = "Ensure Manufacturer SKU, UPC, and EAN are unique.";
              }
            } else {
              validationErrorCount += 1;
              reason = `Insert failed: ${msg || "Constraint check failed"}`;
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

    // Sort rejected rows by original Excel row number
    rejectedRows.sort((a, b) => a.excelRowNumber - b.excelRowNumber);

    // Record audit logs for newly created Draft products (non-blocking best-effort, matching createProduct)
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
                summary: `엑셀 일괄 등록 (Excel Bulk Upload) 신규 Draft 생성 — SKU: ${item.sku}`,
                changes: {
                  manufacture_sku: { label: "제조사 SKU", before: null, after: item.sku },
                  name_en: { label: "제품명 (영문)", before: null, after: item.nameEn },
                  brandName: { label: "브랜드명", before: null, after: item.brandName },
                },
              })
            )
          );
        }
      } catch (auditErr) {
        console.warn("[BulkImport] Non-fatal audit log warning:", auditErr);
      }

      revalidatePath("/portal/products");
    }

    // Mark submission keys completed
    for (const k of lockKeys) {
      if (k.startsWith("sub:")) {
        completedBatchTimestamps.set(k, Date.now());
      }
    }

    let errorReportBase64: string | null = null;
    let errorReportFilename: string | null = null;
    if (rejectedRows.length > 0) {
      const errBuf = generateBulkImportErrorBuffer(rejectedRows);
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
      createdProductIds: createdProducts.map((c) => c.id),
      rejectedRows,
      errorReportBase64,
      errorReportFilename,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unexpected error during bulk product registration.",
      totalUploadedRows: 0,
      createdCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      validationErrorCount: 0,
      createdProductIds: [],
      rejectedRows: [],
    };
  } finally {
    for (const k of lockKeys) {
      inFlightBatchKeys.delete(k);
    }
  }
}
