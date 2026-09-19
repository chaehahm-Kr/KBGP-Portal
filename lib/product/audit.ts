import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export type AuditSource = "ADMIN" | "BRAND_PORTAL" | "SYSTEM" | "AUTOMATION";

export type AuditActionType = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "STATUS_CHANGE";

export interface FieldChange {
  label: string;
  before: any;
  after: any;
}

export interface RecordProductChangeInput {
  productId: string;
  userId?: string | null;
  userName: string;
  userEmail?: string | null;
  source: AuditSource;
  companyName?: string | null;
  section: string;
  actionType: AuditActionType;
  summary: string;
  changes?: Record<string, FieldChange> | null;
}

export interface ProductChangeLogItem {
  id: string;
  productId: string;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  source: AuditSource;
  companyName: string | null;
  section: string;
  actionType: AuditActionType;
  summary: string;
  changes: Record<string, FieldChange> | null;
  createdAt: string;
}

// Field definitions for automatic field-level diff calculation
export const PRODUCT_AUDIT_FIELD_DEFINITIONS: Record<
  string,
  { label: string; section: string; type?: "currency_krw" | "currency_usd" | "dimension_mm" | "weight_g" | "weight_kg" | "volume" | "boolean" | "text" }
> = {
  // 기본 정보
  name: { label: "제품명 (국문)", section: "기본 정보" },
  name_en: { label: "제품명 (영문)", section: "기본 정보" },
  nameEn: { label: "제품명 (영문)", section: "기본 정보" },
  category: { label: "카테고리 (구분)", section: "기본 정보" },
  category_code: { label: "표준 카테고리 (3Depth)", section: "카테고리 & 속성" },
  categoryCode: { label: "표준 카테고리 (3Depth)", section: "카테고리 & 속성" },
  brand_id: { label: "브랜드 ID", section: "기본 정보" },
  brandId: { label: "브랜드 ID", section: "기본 정보" },
  brandName: { label: "브랜드명", section: "기본 정보" },
  origin: { label: "제조국/원산지", section: "기본 정보" },
  volume: { label: "용량/규격", section: "기본 정보", type: "volume" },
  description: { label: "제품 상세 설명", section: "기본 정보" },
  color: { label: "색상명", section: "기본 정보" },
  color_map: { label: "대표 색상군", section: "기본 정보" },
  colorMap: { label: "대표 색상군", section: "기본 정보" },
  lead_time: { label: "생산 리드타임", section: "기본 정보" },
  leadTime: { label: "생산 리드타임", section: "기본 정보" },
  parent_sku: { label: "Parent SKU", section: "기본 정보" },
  parentSku: { label: "Parent SKU", section: "기본 정보" },
  child_sku: { label: "Child SKU", section: "기본 정보" },
  childSku: { label: "Child SKU", section: "기본 정보" },
  manufacture_sku: { label: "제조사 SKU", section: "기본 정보" },
  manufactureSku: { label: "제조사 SKU", section: "기본 정보" },
  letusto_sku: { label: "Letusto SKU", section: "기본 정보" },
  letustoSku: { label: "Letusto SKU", section: "기본 정보" },
  upc: { label: "UPC 바코드", section: "기본 정보" },
  ean: { label: "EAN 바코드", section: "기본 정보" },
  selling_online: { label: "온라인 판매 여부", section: "기본 정보", type: "boolean" },
  sellingOnline: { label: "온라인 판매 여부", section: "기본 정보", type: "boolean" },
  selling_offline: { label: "오프라인 판매 여부", section: "기본 정보", type: "boolean" },
  sellingOffline: { label: "오프라인 판매 여부", section: "기본 정보", type: "boolean" },
  sales_link_1: { label: "온라인 판매처 링크 1", section: "기본 정보" },
  salesLink1: { label: "온라인 판매처 링크 1", section: "기본 정보" },
  sales_link_2: { label: "온라인 판매처 링크 2", section: "기본 정보" },
  salesLink2: { label: "온라인 판매처 링크 2", section: "기본 정보" },
  ingredients_text: { label: "전성분 텍스트", section: "기본 정보" },
  ingredientsText: { label: "전성분 텍스트", section: "기본 정보" },
  bullet_points: { label: "주요 특징 (Bullet Points)", section: "기본 정보" },
  bulletPoints: { label: "주요 특징 (Bullet Points)", section: "기본 정보" },
  ingredients_file_path: { label: "국문 전성분표 파일", section: "인허가 & 보증서" },
  ingredients_file_path_en: { label: "영문 전성분표 파일", section: "인허가 & 보증서" },

  // 가격 정보
  price_krw_retail: { label: "한국 소비자가 (KRW)", section: "가격 정보", type: "currency_krw" },
  priceKrwRetail: { label: "한국 소비자가 (KRW)", section: "가격 정보", type: "currency_krw" },
  price_krw_wholesale: { label: "한국 공급/도매가 (KRW)", section: "가격 정보", type: "currency_krw" },
  priceKrwWholesale: { label: "한국 공급/도매가 (KRW)", section: "가격 정보", type: "currency_krw" },
  price_usd_fob: { label: "미국 수출 FOB 공급가 (USD)", section: "가격 정보", type: "currency_usd" },
  priceUsdFob: { label: "미국 수출 FOB 공급가 (USD)", section: "가격 정보", type: "currency_usd" },
  estimated_retail_price: { label: "예상 소비자가 (KRW)", section: "가격 정보", type: "currency_krw" },
  estimatedRetailPrice: { label: "예상 소비자가 (KRW)", section: "가격 정보", type: "currency_krw" },

  // 로지스틱스 (단품)
  item_width: { label: "단품 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  itemWidth: { label: "단품 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  item_depth: { label: "단품 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  itemDepth: { label: "단품 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  item_height: { label: "단품 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  itemHeight: { label: "단품 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  item_weight: { label: "단품 무게 (g)", section: "로지스틱스", type: "weight_g" },
  itemWeight: { label: "단품 무게 (g)", section: "로지스틱스", type: "weight_g" },

  // 로지스틱스 (패키지)
  package_width: { label: "패키지 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  packageWidth: { label: "패키지 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  package_depth: { label: "패키지 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  packageDepth: { label: "패키지 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  package_height: { label: "패키지 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  packageHeight: { label: "패키지 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  package_weight: { label: "패키지 무게 (g)", section: "로지스틱스", type: "weight_g" },
  packageWeight: { label: "패키지 무게 (g)", section: "로지스틱스", type: "weight_g" },

  // 로지스틱스 (카톤)
  carton_pack_qty: { label: "카톤 수량 (Case Pack)", section: "로지스틱스" },
  cartonPackQty: { label: "카톤 수량 (Case Pack)", section: "로지스틱스" },
  carton_width: { label: "카톤 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  cartonWidth: { label: "카톤 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  carton_depth: { label: "카톤 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  cartonDepth: { label: "카톤 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  carton_height: { label: "카톤 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  cartonHeight: { label: "카톤 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  carton_weight: { label: "카톤 총무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  cartonWeight: { label: "카톤 총무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  carton_cbm: { label: "카톤 CBM", section: "로지스틱스" },
  cartonCbm: { label: "카톤 CBM", section: "로지스틱스" },

  // 로지스틱스 (팔레트)
  palette_carton_qty: { label: "팔레트당 카톤 수 (박스)", section: "로지스틱스" },
  paletteCartonQty: { label: "팔레트당 카톤 수 (박스)", section: "로지스틱스" },
  palette_width: { label: "팔레트 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  paletteWidth: { label: "팔레트 가로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  palette_depth: { label: "팔레트 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  paletteDepth: { label: "팔레트 세로 (mm)", section: "로지스틱스", type: "dimension_mm" },
  palette_height: { label: "팔레트 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  paletteHeight: { label: "팔레트 높이 (mm)", section: "로지스틱스", type: "dimension_mm" },
  palette_weight: { label: "팔레트 무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  paletteWeight: { label: "팔레트 무게 (kg)", section: "로지스틱스", type: "weight_kg" },

  // 로지스틱스 (컨테이너)
  container_20ft_qty: { label: "20ft 컨테이너 적재 박스수", section: "로지스틱스" },
  container20ftQty: { label: "20ft 컨테이너 적재 박스수", section: "로지스틱스" },
  container_20ft_weight: { label: "20ft 컨테이너 총무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  container20ftWeight: { label: "20ft 컨테이너 총무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  container_20ft_cbm: { label: "20ft 컨테이너 총 CBM", section: "로지스틱스" },
  container20ftCbm: { label: "20ft 컨테이너 총 CBM", section: "로지스틱스" },
  container_40fthc_qty: { label: "40ft HC 컨테이너 적재 박스수", section: "로지스틱스" },
  container40fthcQty: { label: "40ft HC 컨테이너 적재 박스수", section: "로지스틱스" },
  container_40fthc_weight: { label: "40ft HC 컨테이너 총무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  container40fthcWeight: { label: "40ft HC 컨테이너 총무게 (kg)", section: "로지스틱스", type: "weight_kg" },
  container_40fthc_cbm: { label: "40ft HC 컨테이너 총 CBM", section: "로지스틱스" },
  container40fthcCbm: { label: "40ft HC 컨테이너 총 CBM", section: "로지스틱스" },

  // 운영 & 상태
  selection_status: { label: "선정 상태", section: "운영 및 선정 상태" },
  selectionStatus: { label: "선정 상태", section: "운영 및 선정 상태" },
  sales_status: { label: "판매 상태", section: "운영 및 선정 상태" },
  salesStatus: { label: "판매 상태", section: "운영 및 선정 상태" },
  trading_status: { label: "무역 운영 상태", section: "운영 및 선정 상태" },
  tradingStatus: { label: "무역 운영 상태", section: "운영 및 선정 상태" },
};

export function formatAuditValue(val: any, type?: string): string {
  if (val === null || val === undefined || val === "") {
    return "(미입력)";
  }

  if (typeof val === "boolean") {
    return val ? "설정 (예)" : "해제 (아니오)";
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return "(비어 있음)";
    return val.join(", ");
  }

  const num = Number(val);
  if (!isNaN(num) && typeof val !== "boolean") {
    if (type === "currency_krw") {
      return `₩${num.toLocaleString("ko-KR")}`;
    }
    if (type === "currency_usd") {
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (type === "dimension_mm") {
      return `${num.toLocaleString("ko-KR")} mm`;
    }
    if (type === "weight_g") {
      return `${num.toLocaleString("ko-KR")} g`;
    }
    if (type === "weight_kg") {
      return `${num.toLocaleString("ko-KR")} kg`;
    }
    return String(val);
  }

  // Handle long string description truncation
  if (typeof val === "string" && val.length > 100) {
    return val.substring(0, 97) + "...";
  }

  return String(val);
}

/**
 * Compare old and new objects to build a map of field-level diffs.
 * Only returns changed fields. Returns empty object if nothing changed.
 */
export function computeProductFieldDiffs(
  beforeObj: Record<string, any>,
  afterObj: Record<string, any>
): { diffs: Record<string, FieldChange>; sectionNames: Set<string> } {
  const diffs: Record<string, FieldChange> = {};
  const sectionNames = new Set<string>();

  for (const [key, def] of Object.entries(PRODUCT_AUDIT_FIELD_DEFINITIONS)) {
    if (!(key in afterObj) && !(key in beforeObj)) continue;

    const oldRaw = beforeObj[key];
    const newRaw = afterObj[key];

    // Normalize empty strings and nulls
    const normOld = oldRaw === "" || oldRaw === undefined ? null : oldRaw;
    const normNew = newRaw === "" || newRaw === undefined ? null : newRaw;

    // Compare values (handling numbers, strings, arrays, booleans)
    let isDifferent = false;
    if (Array.isArray(normOld) || Array.isArray(normNew)) {
      const arr1 = Array.isArray(normOld) ? normOld : normOld ? [normOld] : [];
      const arr2 = Array.isArray(normNew) ? normNew : normNew ? [normNew] : [];
      if (JSON.stringify(arr1) !== JSON.stringify(arr2)) {
        isDifferent = true;
      }
    } else if (typeof normOld === "number" || typeof normNew === "number") {
      const n1 = normOld !== null ? Number(normOld) : null;
      const n2 = normNew !== null ? Number(normNew) : null;
      if (n1 !== n2) {
        isDifferent = true;
      }
    } else if (normOld !== normNew) {
      isDifferent = true;
    }

    if (isDifferent) {
      diffs[key] = {
        label: def.label,
        before: formatAuditValue(normOld, def.type),
        after: formatAuditValue(normNew, def.type),
      };
      sectionNames.add(def.section);
    }
  }

  return { diffs, sectionNames };
}

/**
 * Record a product change log event into products.price_additional_info.change_history (and product_change_logs table if exists).
 * Append-only, immutability guaranteed.
 */
export async function recordProductChangeLog(input: RecordProductChangeInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const logId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newLogItem: ProductChangeLogItem = {
      id: logId,
      productId: input.productId,
      userId: input.userId || null,
      userName: input.userName,
      userEmail: input.userEmail || null,
      source: input.source,
      companyName: input.companyName || (input.source === "ADMIN" ? "Letusto Admin" : "Brand Portal"),
      section: input.section,
      actionType: input.actionType,
      summary: input.summary,
      changes: input.changes || null,
      createdAt: now,
    };

    // 1. Fetch current price_additional_info from products table
    const { data: currentProduct } = await admin
      .from("products")
      .select("price_additional_info")
      .eq("id", input.productId)
      .single();

    const currentMeta = (currentProduct?.price_additional_info as Record<string, any>) || {};
    const currentHistory = Array.isArray(currentMeta.change_history) ? currentMeta.change_history : [];

    // Append new log item to the front of history array
    const updatedHistory = [newLogItem, ...currentHistory];

    // 2. Persist to products table
    const updatedMeta = {
      ...currentMeta,
      change_history: updatedHistory,
    };

    await admin
      .from("products")
      .update({
        price_additional_info: updatedMeta,
        updated_at: now,
      })
      .eq("id", input.productId);

    // 3. Also attempt inserting into product_change_logs if table is present
    try {
      await admin.from("product_change_logs").insert({
        id: logId,
        product_id: input.productId,
        user_id: input.userId || null,
        user_name: input.userName,
        user_email: input.userEmail || null,
        source: input.source,
        company_name: newLogItem.companyName,
        section: input.section,
        action_type: input.actionType,
        summary: input.summary,
        changes: input.changes || null,
        created_at: now,
      });
    } catch {
      // product_change_logs table fallback handled silently
    }
  } catch (err) {
    console.error("❌ [recordProductChangeLog] Unexpected error:", err);
  }
}

/**
 * Fetch change history logs for a specific product.
 * Returns sorted chronologically descending (newest first).
 */
export async function getProductChangeHistory(productId: string): Promise<ProductChangeLogItem[]> {
  try {
    const admin = createAdminClient();

    // 1. Read from products.price_additional_info.change_history
    const { data: product } = await admin
      .from("products")
      .select("price_additional_info")
      .eq("id", productId)
      .maybeSingle();

    const meta = (product?.price_additional_info as Record<string, any>) || {};
    const metaHistory: ProductChangeLogItem[] = Array.isArray(meta.change_history)
      ? meta.change_history.map((row: any) => ({
          id: row.id || crypto.randomUUID(),
          productId: row.productId || productId,
          userId: row.userId || null,
          userName: row.userName || "사용자",
          userEmail: row.userEmail || null,
          source: row.source || "SYSTEM",
          companyName: row.companyName || null,
          section: row.section || "기본 정보",
          actionType: row.actionType || "UPDATE",
          summary: row.summary || "상품 정보 변경",
          changes: row.changes || null,
          createdAt: row.createdAt || new Date().toISOString(),
        }))
      : [];

    // 2. Also read from product_change_logs table if available
    let tableHistory: ProductChangeLogItem[] = [];
    try {
      const { data: tableData } = await admin
        .from("product_change_logs")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (tableData && tableData.length > 0) {
        tableHistory = tableData.map((row: any) => ({
          id: row.id,
          productId: row.product_id,
          userId: row.user_id,
          userName: row.user_name,
          userEmail: row.user_email,
          source: row.source,
          companyName: row.company_name,
          section: row.section,
          actionType: row.action_type,
          summary: row.summary,
          changes: row.changes,
          createdAt: row.created_at,
        }));
      }
    } catch {
      // table doesn't exist, ignore
    }

    // 3. Merge and deduplicate by id
    const seenIds = new Set<string>();
    const merged: ProductChangeLogItem[] = [];

    for (const item of [...tableHistory, ...metaHistory]) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        merged.push(item);
      }
    }

    // Sort descending by createdAt
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return merged;
  } catch (err) {
    console.error("❌ [getProductChangeHistory] error:", err);
    return [];
  }
}

