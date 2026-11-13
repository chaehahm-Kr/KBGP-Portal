import type { ProductCategory } from "@/lib/product/types";

export const BULK_IMPORT_MAX_ROWS = 500;
export const BULK_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const BULK_TEMPLATE_EXAMPLE_SKU = "EXAMPLE-SKU-001";

export const ALLOWED_COLOR_MAPS = [
  "White",
  "Black",
  "Grey",
  "Silver",
  "Gold",
  "Red",
  "Pink",
  "Coral",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Brown",
  "Beige",
  "Ivory",
  "Clear",
  "Multi-Color",
] as const;

export type AllowedColorMap = (typeof ALLOWED_COLOR_MAPS)[number];

export type BulkColumnSection =
  | "Required"
  | "Category"
  | "Basic Info"
  | "Pricing"
  | "Logistics";

export interface BulkColumnSpec {
  key: BulkRowRawFieldKey;
  header: string;
  headerEn: string;
  aliases: string[];
  required: boolean;
  section: BulkColumnSection;
  dbColumn: string;
  width: number;
  textFormat?: boolean;
  description: string;
}

export type BulkRowRawFieldKey =
  | "brand"
  | "manufactureSku"
  | "productNameEn"
  | "category1Depth"
  | "category2Depth"
  | "category3Depth"
  | "productNameKo"
  | "volumeValue"
  | "volumeUnit"
  | "countryOfOrigin"
  | "leadTimeValue"
  | "leadTimeUnit"
  | "color"
  | "colorMap"
  | "description"
  | "bulletPoint1"
  | "bulletPoint2"
  | "bulletPoint3"
  | "bulletPoint4"
  | "bulletPoint5"
  | "howToUse"
  | "ingredients"
  | "parentSku"
  | "childSku"
  | "upc"
  | "ean"
  | "sellingOnline"
  | "sellingOffline"
  | "salesLink1"
  | "salesLink2"
  | "retailPriceKrw"
  | "wholesalePriceKrw"
  | "estimatedRetailPriceUsd"
  | "exportFobPriceUsd"
  | "itemWidth"
  | "itemDepth"
  | "itemHeight"
  | "itemWeight"
  | "packageWidth"
  | "packageDepth"
  | "packageHeight"
  | "packageWeight"
  | "cartonPackQty"
  | "cartonWidth"
  | "cartonDepth"
  | "cartonHeight"
  | "cartonWeight"
  | "palletCartonQty"
  | "palletWidth"
  | "palletDepth"
  | "palletHeight"
  | "palletWeight";

export const BULK_PRODUCT_COLUMNS: BulkColumnSpec[] = [
  // 1. REQUIRED (4) — Columns A..D
  {
    key: "brand",
    header: "브랜드 (Brand) *",
    headerEn: "Brand *",
    aliases: [
      "브랜드 (brand) *",
      "브랜드 (brand)",
      "브랜드 *",
      "브랜드",
      "brand",
      "brand *",
      "brand (required)",
      "brand name",
    ],
    required: true,
    section: "Required",
    dbColumn: "brand_id",
    width: 24,
    description: "귀사에 등록된 활성 브랜드명 입력 (Brands 시트 참조 / Active brand name owned by your company).",
  },
  {
    key: "manufactureSku",
    header: "제조사 SKU (Manufacturer SKU) *",
    headerEn: "Manufacturer SKU *",
    aliases: [
      "제조사 sku (manufacturer sku) *",
      "제조사 sku (manufacturer sku)",
      "제조사 sku *",
      "제조사 sku",
      "manufacturer sku",
      "manufacturer sku *",
      "manufacture sku",
      "manufacture_sku",
      "sku",
    ],
    required: true,
    section: "Required",
    dbColumn: "manufacture_sku",
    width: 33,
    textFormat: true,
    description: "귀사 내 고유 제조사 SKU 코드 (영문/숫자/-/_ 조합, 텍스트 서식 유지 / Unique SKU code formatted as Text).",
  },
  {
    key: "productNameEn",
    header: "영문 제품명 (Product Name EN) *",
    headerEn: "Product Name EN *",
    aliases: [
      "영문 제품명 (product name en) *",
      "영문 제품명 (product name en)",
      "영문 제품명 *",
      "영문 제품명",
      "product name en",
      "product name en *",
      "product name (en)",
      "english product name",
      "name_en",
    ],
    required: true,
    section: "Required",
    dbColumn: "name_en (and name fallback)",
    width: 36,
    description: "공식 영문 제품명 입력 (필수 / Official English product name).",
  },
  {
    key: "category1Depth",
    header: "카테고리 (1Depth) *",
    headerEn: "Category 1Depth *",
    aliases: [
      "카테고리 (1depth) *",
      "카테고리 (1depth)",
      "카테고리 1depth *",
      "카테고리 1depth",
      "1차 카테고리 *",
      "category 1depth",
      "category 1depth *",
      "category (1depth)",
      "category",
      "1depth category",
    ],
    required: true,
    section: "Required",
    dbColumn: "category / category_code",
    width: 24,
    description: "대분류 카테고리 코드 또는 명칭 입력 (예: Skincare, 스킨케어 — Categories 시트 참조).",
  },

  // 2. OPTIONAL — CATEGORY HIERARCHY (Columns E..F)
  {
    key: "category2Depth",
    header: "카테고리 (2Depth)",
    headerEn: "Category 2Depth",
    aliases: [
      "카테고리 (2depth)",
      "카테고리 2depth",
      "2차 카테고리",
      "category 2depth",
      "category (2depth)",
      "2depth category",
    ],
    required: false,
    section: "Category",
    dbColumn: "category_code",
    width: 24,
    description: "선택한 1Depth 하위 중분류 카테고리 코드 또는 명칭 (Categories 시트 참조).",
  },
  {
    key: "category3Depth",
    header: "카테고리 (3Depth)",
    headerEn: "Category 3Depth",
    aliases: [
      "카테고리 (3depth)",
      "카테고리 3depth",
      "3차 카테고리",
      "category 3depth",
      "category (3depth)",
      "3depth category",
    ],
    required: false,
    section: "Category",
    dbColumn: "category_code",
    width: 26,
    description: "선택한 2Depth 하위 소분류 카테고리 코드 또는 명칭 (Categories 시트 참조).",
  },

  // 3. OPTIONAL — BASIC INFORMATION (Columns G..AD)
  {
    key: "productNameKo",
    header: "국문 제품명 (Product Name KO)",
    headerEn: "Product Name KO",
    aliases: [
      "국문 제품명 (product name ko)",
      "국문 제품명",
      "한글 제품명",
      "product name ko",
      "product name (ko)",
      "korean product name",
      "name_ko",
    ],
    required: false,
    section: "Basic Info",
    dbColumn: "name",
    width: 38,
    description: "국문 제품명 (미입력 시 영문 제품명이 기본 제품명으로 저장됩니다).",
  },
  {
    key: "volumeValue",
    header: "용량 수치 (Volume Value)",
    headerEn: "Volume Value",
    aliases: ["용량 수치 (volume value)", "용량 수치", "용량 값", "volume value", "volume"],
    required: false,
    section: "Basic Info",
    dbColumn: "volume",
    width: 20,
    description: "제품 용량/규격 숫자값 (예: 200 — 용량 단위와 함께 입력).",
  },
  {
    key: "volumeUnit",
    header: "용량 단위 (Volume Unit)",
    headerEn: "Volume Unit",
    aliases: ["용량 단위 (volume unit)", "용량 단위", "volume unit"],
    required: false,
    section: "Basic Info",
    dbColumn: "volume",
    width: 20,
    description: "허용 단위: ml, L, g, kg, mg, oz, fl oz, ea / pcs, Other.",
  },
  {
    key: "countryOfOrigin",
    header: "제조국 (Country of Origin)",
    headerEn: "Country of Origin",
    aliases: ["제조국 (country of origin)", "제조국", "원산지", "country of origin", "origin"],
    required: false,
    section: "Basic Info",
    dbColumn: "origin",
    width: 24,
    description: "표준 영문 국가명 또는 ISO 코드 (예: South Korea — 미입력 시 빈 값 유지, 자동 입력 안 함).",
  },
  {
    key: "leadTimeValue",
    header: "리드타임 수치 (Lead Time Value)",
    headerEn: "Lead Time Value",
    aliases: ["리드타임 수치 (lead time value)", "리드타임 수치", "lead time value"],
    required: false,
    section: "Basic Info",
    dbColumn: "lead_time",
    width: 22,
    description: "생산/출고 리드타임 양의 정수 (예: 14 — 리드타임 단위와 함께 입력).",
  },
  {
    key: "leadTimeUnit",
    header: "리드타임 단위 (Lead Time Unit)",
    headerEn: "Lead Time Unit",
    aliases: ["리드타임 단위 (lead time unit)", "리드타임 단위", "lead time unit"],
    required: false,
    section: "Basic Info",
    dbColumn: "lead_time",
    width: 22,
    description: "Days(일), Weeks(주), Months(개월) 중 선택.",
  },
  {
    key: "color",
    header: "색상명 (Color)",
    headerEn: "Color",
    aliases: ["색상명 (color)", "색상명", "색상", "color"],
    required: false,
    section: "Basic Info",
    dbColumn: "color",
    width: 18,
    description: "표시 색상/호수명 (예: 01 Coral Pink).",
  },
  {
    key: "colorMap",
    header: "색상 계열 (Color Map)",
    headerEn: "Color Map",
    aliases: ["색상 계열 (color map)", "색상 계열", "color map", "color_map"],
    required: false,
    section: "Basic Info",
    dbColumn: "color_map",
    width: 20,
    description: "표준 색상 계열 (Allowed_Values 시트 참조).",
  },
  {
    key: "description",
    header: "상품 설명 (Description)",
    headerEn: "Description",
    aliases: ["상품 설명 (description)", "상품 설명", "제품 설명", "description", "product description"],
    required: false,
    section: "Basic Info",
    dbColumn: "description",
    width: 36,
    description: "상세 상품 소개 문구 (최대 5,000자).",
  },
  {
    key: "bulletPoint1",
    header: "핵심 포인트 1 (Bullet Point 1)",
    headerEn: "Bullet Point 1",
    aliases: ["핵심 포인트 1 (bullet point 1)", "핵심 포인트 1", "bullet point 1", "bullet 1"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[0]",
    width: 28,
    description: "주요 셀링 포인트 1 (최대 500자).",
  },
  {
    key: "bulletPoint2",
    header: "핵심 포인트 2 (Bullet Point 2)",
    headerEn: "Bullet Point 2",
    aliases: ["핵심 포인트 2 (bullet point 2)", "핵심 포인트 2", "bullet point 2", "bullet 2"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[1]",
    width: 28,
    description: "주요 셀링 포인트 2 (최대 500자).",
  },
  {
    key: "bulletPoint3",
    header: "핵심 포인트 3 (Bullet Point 3)",
    headerEn: "Bullet Point 3",
    aliases: ["핵심 포인트 3 (bullet point 3)", "핵심 포인트 3", "bullet point 3", "bullet 3"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[2]",
    width: 28,
    description: "주요 셀링 포인트 3 (최대 500자).",
  },
  {
    key: "bulletPoint4",
    header: "핵심 포인트 4 (Bullet Point 4)",
    headerEn: "Bullet Point 4",
    aliases: ["핵심 포인트 4 (bullet point 4)", "핵심 포인트 4", "bullet point 4", "bullet 4"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[3]",
    width: 28,
    description: "주요 셀링 포인트 4 (최대 500자).",
  },
  {
    key: "bulletPoint5",
    header: "핵심 포인트 5 (Bullet Point 5)",
    headerEn: "Bullet Point 5",
    aliases: ["핵심 포인트 5 (bullet point 5)", "핵심 포인트 5", "bullet point 5", "bullet 5"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[4]",
    width: 28,
    description: "주요 셀링 포인트 5 (최대 500자).",
  },
  {
    key: "howToUse",
    header: "사용 방법 (How to Use)",
    headerEn: "How to Use",
    aliases: ["사용 방법 (how to use)", "사용 방법", "사용법", "how to use", "how_to_use", "directions"],
    required: false,
    section: "Basic Info",
    dbColumn: "how_to_use",
    width: 32,
    description: "제품 사용 방법 및 주의 안내 (최대 5,000자).",
  },
  {
    key: "ingredients",
    header: "전성분 (Ingredients)",
    headerEn: "Ingredients",
    aliases: ["전성분 (ingredients)", "전성분", "성분", "ingredients", "ingredients_text", "full ingredients"],
    required: false,
    section: "Basic Info",
    dbColumn: "ingredients_text",
    width: 36,
    description: "영문 INCI 또는 전성분 텍스트 (최대 10,000자).",
  },
  {
    key: "parentSku",
    header: "상위 SKU 여부 (Parent SKU)",
    headerEn: "Parent SKU",
    aliases: ["상위 sku 여부 (parent sku)", "상위 sku 여부", "parent sku", "parent_sku"],
    required: false,
    section: "Basic Info",
    dbColumn: "parent_sku",
    width: 20,
    description: "Y 또는 N 입력 (하위 SKU 여부와 동시에 Y 설정 불가).",
  },
  {
    key: "childSku",
    header: "하위 SKU 여부 (Child SKU)",
    headerEn: "Child SKU",
    aliases: ["하위 sku 여부 (child sku)", "하위 sku 여부", "child sku", "child_sku"],
    required: false,
    section: "Basic Info",
    dbColumn: "child_sku",
    width: 20,
    description: "Y 또는 N 입력 (상위 SKU 여부와 동시에 Y 설정 불가).",
  },
  {
    key: "upc",
    header: "UPC 바코드 12자리 (UPC)",
    headerEn: "UPC (12 Digits)",
    aliases: [
      "upc 바코드 12자리 (upc)",
      "upc 바코드 (12자리)",
      "upc 바코드",
      "upc",
      "upc (12 digits)",
      "upc barcode",
    ],
    required: false,
    section: "Basic Info",
    dbColumn: "upc",
    width: 24,
    textFormat: true,
    description: "미국 표준 12자리 숫자 UPC 바코드 (선행 0 보존을 위해 텍스트 서식 유지).",
  },
  {
    key: "ean",
    header: "EAN 바코드 13자리 (EAN)",
    headerEn: "EAN (13 Digits)",
    aliases: [
      "ean 바코드 13자리 (ean)",
      "ean 바코드 (13자리)",
      "ean 바코드",
      "ean",
      "ean (13 digits)",
      "ean barcode",
    ],
    required: false,
    section: "Basic Info",
    dbColumn: "ean",
    width: 24,
    textFormat: true,
    description: "국제 표준 13자리 숫자 EAN/KAN 바코드 (선행 0 보존을 위해 텍스트 서식 유지).",
  },
  {
    key: "sellingOnline",
    header: "온라인 판매 여부 (Selling Online)",
    headerEn: "Selling Online",
    aliases: ["온라인 판매 여부 (selling online)", "온라인 판매 여부", "selling online", "selling_online"],
    required: false,
    section: "Basic Info",
    dbColumn: "selling_online",
    width: 24,
    description: "TRUE 또는 FALSE 입력 (TRUE일 경우 온라인 판매 링크 1 필수).",
  },
  {
    key: "sellingOffline",
    header: "오프라인 판매 여부 (Selling Offline)",
    headerEn: "Selling Offline",
    aliases: ["오프라인 판매 여부 (selling offline)", "오프라인 판매 여부", "selling offline", "selling_offline"],
    required: false,
    section: "Basic Info",
    dbColumn: "selling_offline",
    width: 24,
    description: "TRUE 또는 FALSE 입력.",
  },
  {
    key: "salesLink1",
    header: "온라인 판매 링크 1 (Sales Link 1)",
    headerEn: "Sales Link 1",
    aliases: ["온라인 판매 링크 1 (sales link 1)", "온라인 판매 링크 1", "판매 링크 1", "sales link 1", "sales_link_1"],
    required: false,
    section: "Basic Info",
    dbColumn: "sales_link_1",
    width: 30,
    description: "대표 온라인 판매처 URL (https://... — 온라인 판매 여부가 TRUE일 때 필수).",
  },
  {
    key: "salesLink2",
    header: "온라인 판매 링크 2 (Sales Link 2)",
    headerEn: "Sales Link 2",
    aliases: ["온라인 판매 링크 2 (sales link 2)", "온라인 판매 링크 2", "판매 링크 2", "sales link 2", "sales_link_2"],
    required: false,
    section: "Basic Info",
    dbColumn: "sales_link_2",
    width: 30,
    description: "보조 온라인 판매처 URL (https://...).",
  },

  // 4. OPTIONAL — PRICING (Columns AE..AH)
  {
    key: "retailPriceKrw",
    header: "소비자가 KRW (Retail Price KRW)",
    headerEn: "Retail Price KRW",
    aliases: [
      "소비자가 krw (retail price krw)",
      "소비자가 krw",
      "소비자가 (krw)",
      "retail price krw",
      "retail price (krw)",
      "price_krw_retail",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "price_krw_retail",
    width: 24,
    description: "국내 권장소비자가 (원화 정수 >= 0, 통화기호 제외).",
  },
  {
    key: "wholesalePriceKrw",
    header: "국내 공급가 KRW (Wholesale Price KRW)",
    headerEn: "Wholesale Price KRW",
    aliases: [
      "국내 공급가 krw (wholesale price krw)",
      "국내 공급가 krw",
      "도매가 krw",
      "wholesale price krw",
      "wholesale price (krw)",
      "price_krw_wholesale",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "price_krw_wholesale",
    width: 26,
    description: "국내 도매/공급 단가 (원화 정수 >= 0, 통화기호 제외).",
  },
  {
    key: "estimatedRetailPriceUsd",
    header: "예상 미국 판매가 USD (Est. Retail USD)",
    headerEn: "Estimated Retail Price USD",
    aliases: [
      "예상 미국 판매가 usd (est. retail usd)",
      "예상 미국 판매가 usd",
      "예상 소비자가 usd",
      "estimated retail price usd",
      "estimated retail price (usd)",
      "estimated_retail_price",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "estimated_retail_price",
    width: 28,
    description: "미국 예상 소매가 MSRP (USD 소수 가능 >= 0, 예: 24.00).",
  },
  {
    key: "exportFobPriceUsd",
    header: "수출 FOB 단가 USD (Export FOB USD)",
    headerEn: "Export FOB Price USD",
    aliases: [
      "수출 fob 단가 usd (export fob usd)",
      "수출 fob 단가 usd",
      "fob 단가 usd",
      "export fob price usd",
      "export fob price (usd)",
      "fob price usd",
      "price_usd_fob",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "price_usd_fob",
    width: 26,
    description: "수출 FOB 기준 공급 단가 (USD 소수 가능 >= 0, 예: 8.50).",
  },

  // 5. OPTIONAL — LOGISTICS (Columns AI..AZ)
  {
    key: "itemWidth",
    header: "단품 가로 cm (Item Width)",
    headerEn: "Item Width (cm)",
    aliases: ["단품 가로 cm (item width)", "단품 가로 (cm)", "item width (cm)", "item width", "item_width"],
    required: false,
    section: "Logistics",
    dbColumn: "item_width",
    width: 20,
    description: "개별 용기/본품 가로 길이 (단위: cm, > 0).",
  },
  {
    key: "itemDepth",
    header: "단품 세로 cm (Item Depth)",
    headerEn: "Item Depth (cm)",
    aliases: ["단품 세로 cm (item depth)", "단품 세로 (cm)", "item depth (cm)", "item depth", "item_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "item_depth",
    width: 20,
    description: "개별 용기/본품 세로(폭) 길이 (단위: cm, > 0).",
  },
  {
    key: "itemHeight",
    header: "단품 높이 cm (Item Height)",
    headerEn: "Item Height (cm)",
    aliases: ["단품 높이 cm (item height)", "단품 높이 (cm)", "item height (cm)", "item height", "item_height"],
    required: false,
    section: "Logistics",
    dbColumn: "item_height",
    width: 20,
    description: "개별 용기/본품 높이 (단위: cm, > 0).",
  },
  {
    key: "itemWeight",
    header: "단품 중량 g (Item Weight)",
    headerEn: "Item Weight (g)",
    aliases: ["단품 중량 g (item weight)", "단품 중량 (g)", "item weight (g)", "item weight", "item_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "item_weight",
    width: 20,
    description: "개별 용기/본품 순중량 (단위: g, > 0).",
  },
  {
    key: "packageWidth",
    header: "개별포장 가로 cm (Package Width)",
    headerEn: "Package Width (cm)",
    aliases: [
      "개별포장 가로 cm (package width)",
      "개별포장 가로 (cm)",
      "package width (cm)",
      "package width",
      "package_width",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_width",
    width: 22,
    description: "단상자/소포장 가로 길이 (단위: cm, > 0).",
  },
  {
    key: "packageDepth",
    header: "개별포장 세로 cm (Package Depth)",
    headerEn: "Package Depth (cm)",
    aliases: [
      "개별포장 세로 cm (package depth)",
      "개별포장 세로 (cm)",
      "package depth (cm)",
      "package depth",
      "package_depth",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_depth",
    width: 22,
    description: "단상자/소포장 세로(폭) 길이 (단위: cm, > 0).",
  },
  {
    key: "packageHeight",
    header: "개별포장 높이 cm (Package Height)",
    headerEn: "Package Height (cm)",
    aliases: [
      "개별포장 높이 cm (package height)",
      "개별포장 높이 (cm)",
      "package height (cm)",
      "package height",
      "package_height",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_height",
    width: 22,
    description: "단상자/소포장 높이 (단위: cm, > 0).",
  },
  {
    key: "packageWeight",
    header: "개별포장 중량 g (Package Weight)",
    headerEn: "Package Weight (g)",
    aliases: [
      "개별포장 중량 g (package weight)",
      "개별포장 중량 (g)",
      "package weight (g)",
      "package weight",
      "package_weight",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_weight",
    width: 22,
    description: "단상자 포함 개별포장 총중량 (단위: g, > 0).",
  },
  {
    key: "cartonPackQty",
    header: "카톤 입수량 ea (Carton Pack Qty)",
    headerEn: "Carton Pack Quantity (ea)",
    aliases: [
      "카톤 입수량 ea (carton pack qty)",
      "카톤 입수량 (ea)",
      "박스 입수량",
      "carton pack quantity (ea)",
      "carton pack quantity",
      "carton_pack_qty",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "carton_pack_qty",
    width: 24,
    description: "수출용 카톤(아웃박스)당 입수 수량 (양의 정수 >= 1).",
  },
  {
    key: "cartonWidth",
    header: "카톤 가로 cm (Carton Width)",
    headerEn: "Carton Width (cm)",
    aliases: ["카톤 가로 cm (carton width)", "카톤 가로 (cm)", "carton width (cm)", "carton width", "carton_width"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_width",
    width: 20,
    description: "수출용 카톤 가로 길이 (단위: cm, > 0 — 가로·세로·높이 입력 시 CBM 자동 계산).",
  },
  {
    key: "cartonDepth",
    header: "카톤 세로 cm (Carton Depth)",
    headerEn: "Carton Depth (cm)",
    aliases: ["카톤 세로 cm (carton depth)", "카톤 세로 (cm)", "carton depth (cm)", "carton depth", "carton_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_depth",
    width: 20,
    description: "수출용 카톤 세로(폭) 길이 (단위: cm, > 0).",
  },
  {
    key: "cartonHeight",
    header: "카톤 높이 cm (Carton Height)",
    headerEn: "Carton Height (cm)",
    aliases: ["카톤 높이 cm (carton height)", "카톤 높이 (cm)", "carton height (cm)", "carton height", "carton_height"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_height",
    width: 20,
    description: "수출용 카톤 높이 (단위: cm, > 0).",
  },
  {
    key: "cartonWeight",
    header: "카톤 중량 kg (Carton Weight)",
    headerEn: "Carton Weight (kg)",
    aliases: ["카톤 중량 kg (carton weight)", "카톤 중량 (kg)", "carton weight (kg)", "carton weight", "carton_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_weight",
    width: 20,
    description: "수출용 카톤 총중량 (단위: kg, > 0).",
  },
  {
    key: "palletCartonQty",
    header: "파렛트 적재 박스수 (Pallet Carton Qty)",
    headerEn: "Pallet Carton Quantity (boxes)",
    aliases: [
      "파렛트 적재 박스수 (pallet carton qty)",
      "파렛트 적재 박스수",
      "pallet carton quantity (boxes)",
      "pallet carton quantity",
      "palette_carton_qty",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "palette_carton_qty",
    width: 26,
    description: "1파렛트당 적재 카톤(박스) 수량 (양의 정수 >= 1).",
  },
  {
    key: "palletWidth",
    header: "파렛트 가로 cm (Pallet Width)",
    headerEn: "Pallet Width (cm)",
    aliases: ["파렛트 가로 cm (pallet width)", "파렛트 가로 (cm)", "pallet width (cm)", "pallet width", "palette_width"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_width",
    width: 22,
    description: "적재 파렛트 가로 길이 (단위: cm, > 0).",
  },
  {
    key: "palletDepth",
    header: "파렛트 세로 cm (Pallet Depth)",
    headerEn: "Pallet Depth (cm)",
    aliases: ["파렛트 세로 cm (pallet depth)", "파렛트 세로 (cm)", "pallet depth (cm)", "pallet depth", "palette_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_depth",
    width: 22,
    description: "적재 파렛트 세로 길이 (단위: cm, > 0).",
  },
  {
    key: "palletHeight",
    header: "파렛트 높이 cm (Pallet Height)",
    headerEn: "Pallet Height (cm)",
    aliases: ["파렛트 높이 cm (pallet height)", "파렛트 높이 (cm)", "pallet height (cm)", "pallet height", "palette_height"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_height",
    width: 22,
    description: "적재 파렛트 높이 (단위: cm, > 0).",
  },
  {
    key: "palletWeight",
    header: "파렛트 중량 kg (Pallet Weight)",
    headerEn: "Pallet Weight (kg)",
    aliases: ["파렛트 중량 kg (pallet weight)", "파렛트 중량 (kg)", "pallet weight (kg)", "pallet weight", "palette_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_weight",
    width: 22,
    description: "적재 파렛트 총중량 (단위: kg, > 0).",
  },
];

export interface BulkReferenceBrand {
  id: string;
  name: string;
  is_active: boolean;
}

export interface BulkReferenceCategory {
  code: string;
  name_ko: string;
  name_en: string | null;
  depth: number;
  parent_code: string | null;
  is_final: boolean;
  is_active: boolean;
  display_order?: number;
}

export interface BulkNormalizedProductPayload {
  brand_id: string;
  brand_name: string;
  manufacture_sku: string;
  name: string;
  name_en: string;
  category: ProductCategory;
  category_code: string | null;
  category_display_path: string;
  volume: string | null;
  origin: string | null;
  lead_time: string | null;
  color: string | null;
  color_map: string | null;
  description: string | null;
  bullet_points: string[];
  how_to_use: string | null;
  ingredients_text: string | null;
  parent_sku: string | null;
  child_sku: string | null;
  upc: string | null;
  ean: string | null;
  selling_online: boolean;
  selling_offline: boolean;
  sales_link_1: string | null;
  sales_link_2: string | null;
  price_krw_retail: number | null;
  price_krw_wholesale: number | null;
  estimated_retail_price: number | null;
  price_usd_fob: number | null;
  item_width: number | null;
  item_depth: number | null;
  item_height: number | null;
  item_weight: number | null;
  package_width: number | null;
  package_depth: number | null;
  package_height: number | null;
  package_weight: number | null;
  carton_pack_qty: number | null;
  carton_width: number | null;
  carton_depth: number | null;
  carton_height: number | null;
  carton_weight: number | null;
  carton_cbm: number | null;
  palette_carton_qty: number | null;
  palette_width: number | null;
  palette_depth: number | null;
  palette_height: number | null;
  palette_weight: number | null;
}

export type BulkRowValidationStatus = "VALID" | "WARNING" | "INVALID";

export interface BulkValidatedRow {
  excelRowNumber: number;
  status: BulkRowValidationStatus;
  rawBrand: string;
  rawManufactureSku: string;
  rawProductNameEn: string;
  rawCategory1Depth: string;
  normalizedCategoryPath: string;
  errors: string[];
  warnings: string[];
  correctiveGuidance: string[];
  isDuplicateError: boolean;
  isValidationError: boolean;
  payload: BulkNormalizedProductPayload | null;
}

export interface BulkPreviewSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  importableRows: number; // validRows + warningRows
  invalidRows: number;
  duplicateRows: number;
  validationErrorRows: number;
  exampleRowsSkipped: number;
}

export interface BulkPreviewResult {
  success: boolean;
  error?: string;
  fileName?: string;
  batchFingerprint?: string;
  summary?: BulkPreviewSummary;
  rows?: BulkValidatedRow[];
}

export interface BulkRejectedRowItem {
  excelRowNumber: number;
  manufactureSku: string;
  productName: string;
  errorReason: string;
  correctiveGuidance: string;
  isDuplicate: boolean;
}

export interface BulkImportExecutionResult {
  success: boolean;
  error?: string;
  totalUploadedRows: number;
  createdCount: number;
  rejectedCount: number;
  duplicateCount: number;
  validationErrorCount: number;
  createdProductIds: string[];
  rejectedRows: BulkRejectedRowItem[];
  errorReportBase64?: string | null;
  errorReportFilename?: string | null;
}
