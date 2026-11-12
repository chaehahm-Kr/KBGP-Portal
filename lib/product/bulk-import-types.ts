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

export interface BulkColumnSpec {
  key: BulkRowRawFieldKey;
  header: string;
  aliases: string[];
  required: boolean;
  section: "Required" | "Basic Info" | "Pricing" | "Logistics";
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
  | "productNameKo"
  | "category2Depth"
  | "category3Depth"
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
  // 1. REQUIRED (4)
  {
    key: "brand",
    header: "Brand *",
    aliases: ["brand", "brand *", "brand (required)", "brand name"],
    required: true,
    section: "Required",
    dbColumn: "brand_id",
    width: 22,
    description: "Active brand name registered under your company (see Brands sheet).",
  },
  {
    key: "manufactureSku",
    header: "Manufacturer SKU *",
    aliases: ["manufacturer sku", "manufacturer sku *", "manufacture sku", "manufacture_sku", "sku"],
    required: true,
    section: "Required",
    dbColumn: "manufacture_sku",
    width: 24,
    textFormat: true,
    description: "Unique SKU code within your company (A-Z, 0-9, -, _). Text formatted.",
  },
  {
    key: "productNameEn",
    header: "Product Name EN *",
    aliases: ["product name en", "product name en *", "product name (en)", "english product name", "name_en"],
    required: true,
    section: "Required",
    dbColumn: "name_en (and name fallback)",
    width: 34,
    description: "Official English product name.",
  },
  {
    key: "category1Depth",
    header: "Category 1Depth *",
    aliases: ["category 1depth", "category 1depth *", "category (1depth)", "category", "1depth category"],
    required: true,
    section: "Required",
    dbColumn: "category / category_code",
    width: 22,
    description: "Top-level category code or name (e.g., Skincare, SKINCARE). See Categories sheet.",
  },

  // 2. OPTIONAL — BASIC INFORMATION
  {
    key: "productNameKo",
    header: "Product Name KO",
    aliases: ["product name ko", "product name (ko)", "korean product name", "name_ko"],
    required: false,
    section: "Basic Info",
    dbColumn: "name",
    width: 28,
    description: "Korean product name (optional; defaults to Product Name EN in DB if blank).",
  },
  {
    key: "category2Depth",
    header: "Category 2Depth",
    aliases: ["category 2depth", "category (2depth)", "2depth category"],
    required: false,
    section: "Basic Info",
    dbColumn: "category_code",
    width: 22,
    description: "Active 2nd-level category code or name under Category 1Depth.",
  },
  {
    key: "category3Depth",
    header: "Category 3Depth",
    aliases: ["category 3depth", "category (3depth)", "3depth category"],
    required: false,
    section: "Basic Info",
    dbColumn: "category_code",
    width: 24,
    description: "Active 3rd-level category code or name under Category 2Depth.",
  },
  {
    key: "volumeValue",
    header: "Volume Value",
    aliases: ["volume value", "volume"],
    required: false,
    section: "Basic Info",
    dbColumn: "volume",
    width: 15,
    description: "Numeric capacity/volume value (e.g., 200).",
  },
  {
    key: "volumeUnit",
    header: "Volume Unit",
    aliases: ["volume unit"],
    required: false,
    section: "Basic Info",
    dbColumn: "volume",
    width: 15,
    description: "ml, L, g, kg, mg, oz, fl oz, ea / pcs, or Other.",
  },
  {
    key: "countryOfOrigin",
    header: "Country of Origin",
    aliases: ["country of origin", "origin"],
    required: false,
    section: "Basic Info",
    dbColumn: "origin",
    width: 22,
    description: "Canonical country name or ISO code (e.g., South Korea). Left blank if omitted.",
  },
  {
    key: "leadTimeValue",
    header: "Lead Time Value",
    aliases: ["lead time value"],
    required: false,
    section: "Basic Info",
    dbColumn: "lead_time",
    width: 16,
    description: "Production lead time integer (e.g., 14).",
  },
  {
    key: "leadTimeUnit",
    header: "Lead Time Unit",
    aliases: ["lead time unit"],
    required: false,
    section: "Basic Info",
    dbColumn: "lead_time",
    width: 16,
    description: "Days, Weeks, or Months.",
  },
  {
    key: "color",
    header: "Color",
    aliases: ["color"],
    required: false,
    section: "Basic Info",
    dbColumn: "color",
    width: 18,
    description: "Display shade/color name (e.g., Coral Pink).",
  },
  {
    key: "colorMap",
    header: "Color Map",
    aliases: ["color map", "color_map"],
    required: false,
    section: "Basic Info",
    dbColumn: "color_map",
    width: 16,
    description: "Standard color family from Allowed_Values sheet.",
  },
  {
    key: "description",
    header: "Description",
    aliases: ["description", "product description"],
    required: false,
    section: "Basic Info",
    dbColumn: "description",
    width: 36,
    description: "Detailed product marketing description.",
  },
  {
    key: "bulletPoint1",
    header: "Bullet Point 1",
    aliases: ["bullet point 1", "bullet 1"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[0]",
    width: 28,
    description: "Key selling highlight 1.",
  },
  {
    key: "bulletPoint2",
    header: "Bullet Point 2",
    aliases: ["bullet point 2", "bullet 2"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[1]",
    width: 28,
    description: "Key selling highlight 2.",
  },
  {
    key: "bulletPoint3",
    header: "Bullet Point 3",
    aliases: ["bullet point 3", "bullet 3"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[2]",
    width: 28,
    description: "Key selling highlight 3.",
  },
  {
    key: "bulletPoint4",
    header: "Bullet Point 4",
    aliases: ["bullet point 4", "bullet 4"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[3]",
    width: 28,
    description: "Key selling highlight 4.",
  },
  {
    key: "bulletPoint5",
    header: "Bullet Point 5",
    aliases: ["bullet point 5", "bullet 5"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[4]",
    width: 28,
    description: "Key selling highlight 5.",
  },
  {
    key: "howToUse",
    header: "How to Use",
    aliases: ["how to use", "how_to_use", "directions"],
    required: false,
    section: "Basic Info",
    dbColumn: "how_to_use",
    width: 32,
    description: "Usage directions and application steps.",
  },
  {
    key: "ingredients",
    header: "Ingredients",
    aliases: ["ingredients", "ingredients_text", "full ingredients"],
    required: false,
    section: "Basic Info",
    dbColumn: "ingredients_text",
    width: 36,
    description: "Full ingredient list (INCI / text).",
  },
  {
    key: "parentSku",
    header: "Parent SKU",
    aliases: ["parent sku", "parent_sku"],
    required: false,
    section: "Basic Info",
    dbColumn: "parent_sku",
    width: 14,
    description: "Y or N (cannot be Y if Child SKU is Y).",
  },
  {
    key: "childSku",
    header: "Child SKU",
    aliases: ["child sku", "child_sku"],
    required: false,
    section: "Basic Info",
    dbColumn: "child_sku",
    width: 14,
    description: "Y or N (cannot be Y if Parent SKU is Y).",
  },
  {
    key: "upc",
    header: "UPC (12 Digits)",
    aliases: ["upc", "upc (12 digits)", "upc barcode"],
    required: false,
    section: "Basic Info",
    dbColumn: "upc",
    width: 20,
    textFormat: true,
    description: "12-digit US UPC barcode (text formatted to keep leading zeros).",
  },
  {
    key: "ean",
    header: "EAN (13 Digits)",
    aliases: ["ean", "ean (13 digits)", "ean barcode"],
    required: false,
    section: "Basic Info",
    dbColumn: "ean",
    width: 20,
    textFormat: true,
    description: "13-digit global EAN barcode (text formatted to keep leading zeros).",
  },
  {
    key: "sellingOnline",
    header: "Selling Online",
    aliases: ["selling online", "selling_online"],
    required: false,
    section: "Basic Info",
    dbColumn: "selling_online",
    width: 16,
    description: "TRUE or FALSE. If TRUE, Sales Link 1 is required.",
  },
  {
    key: "sellingOffline",
    header: "Selling Offline",
    aliases: ["selling offline", "selling_offline"],
    required: false,
    section: "Basic Info",
    dbColumn: "selling_offline",
    width: 16,
    description: "TRUE or FALSE.",
  },
  {
    key: "salesLink1",
    header: "Sales Link 1",
    aliases: ["sales link 1", "sales_link_1"],
    required: false,
    section: "Basic Info",
    dbColumn: "sales_link_1",
    width: 30,
    description: "Primary online store URL (https://...). Required when Selling Online is TRUE.",
  },
  {
    key: "salesLink2",
    header: "Sales Link 2",
    aliases: ["sales link 2", "sales_link_2"],
    required: false,
    section: "Basic Info",
    dbColumn: "sales_link_2",
    width: 30,
    description: "Secondary online store URL (https://...).",
  },

  // 3. OPTIONAL — PRICING
  {
    key: "retailPriceKrw",
    header: "Retail Price KRW",
    aliases: ["retail price krw", "retail price (krw)", "price_krw_retail"],
    required: false,
    section: "Pricing",
    dbColumn: "price_krw_retail",
    width: 18,
    description: "KRW retail price (integer >= 0, no currency symbol).",
  },
  {
    key: "wholesalePriceKrw",
    header: "Wholesale Price KRW",
    aliases: ["wholesale price krw", "wholesale price (krw)", "price_krw_wholesale"],
    required: false,
    section: "Pricing",
    dbColumn: "price_krw_wholesale",
    width: 20,
    description: "KRW domestic wholesale price (integer >= 0).",
  },
  {
    key: "estimatedRetailPriceUsd",
    header: "Estimated Retail Price USD",
    aliases: ["estimated retail price usd", "estimated retail price (usd)", "estimated_retail_price"],
    required: false,
    section: "Pricing",
    dbColumn: "estimated_retail_price",
    width: 24,
    description: "Estimated US MSRP in USD (decimal >= 0, e.g., 24.00).",
  },
  {
    key: "exportFobPriceUsd",
    header: "Export FOB Price USD",
    aliases: ["export fob price usd", "export fob price (usd)", "fob price usd", "price_usd_fob"],
    required: false,
    section: "Pricing",
    dbColumn: "price_usd_fob",
    width: 22,
    description: "Export FOB unit price in USD (decimal >= 0, e.g., 8.50).",
  },

  // 4. OPTIONAL — LOGISTICS
  {
    key: "itemWidth",
    header: "Item Width (cm)",
    aliases: ["item width (cm)", "item width", "item_width"],
    required: false,
    section: "Logistics",
    dbColumn: "item_width",
    width: 16,
    description: "Unpackaged item width in centimeters (> 0).",
  },
  {
    key: "itemDepth",
    header: "Item Depth (cm)",
    aliases: ["item depth (cm)", "item depth", "item_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "item_depth",
    width: 16,
    description: "Unpackaged item depth in centimeters (> 0).",
  },
  {
    key: "itemHeight",
    header: "Item Height (cm)",
    aliases: ["item height (cm)", "item height", "item_height"],
    required: false,
    section: "Logistics",
    dbColumn: "item_height",
    width: 16,
    description: "Unpackaged item height in centimeters (> 0).",
  },
  {
    key: "itemWeight",
    header: "Item Weight (g)",
    aliases: ["item weight (g)", "item weight", "item_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "item_weight",
    width: 16,
    description: "Unpackaged item net weight in grams (> 0).",
  },
  {
    key: "packageWidth",
    header: "Package Width (cm)",
    aliases: ["package width (cm)", "package width", "package_width"],
    required: false,
    section: "Logistics",
    dbColumn: "package_width",
    width: 18,
    description: "Single retail package width in centimeters (> 0).",
  },
  {
    key: "packageDepth",
    header: "Package Depth (cm)",
    aliases: ["package depth (cm)", "package depth", "package_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "package_depth",
    width: 18,
    description: "Single retail package depth in centimeters (> 0).",
  },
  {
    key: "packageHeight",
    header: "Package Height (cm)",
    aliases: ["package height (cm)", "package height", "package_height"],
    required: false,
    section: "Logistics",
    dbColumn: "package_height",
    width: 18,
    description: "Single retail package height in centimeters (> 0).",
  },
  {
    key: "packageWeight",
    header: "Package Weight (g)",
    aliases: ["package weight (g)", "package weight", "package_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "package_weight",
    width: 18,
    description: "Single retail package gross weight in grams (> 0).",
  },
  {
    key: "cartonPackQty",
    header: "Carton Pack Quantity (ea)",
    aliases: ["carton pack quantity (ea)", "carton pack quantity", "carton_pack_qty"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_pack_qty",
    width: 22,
    description: "Units per master carton (positive integer >= 1).",
  },
  {
    key: "cartonWidth",
    header: "Carton Width (cm)",
    aliases: ["carton width (cm)", "carton width", "carton_width"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_width",
    width: 18,
    description: "Master carton width in centimeters (> 0).",
  },
  {
    key: "cartonDepth",
    header: "Carton Depth (cm)",
    aliases: ["carton depth (cm)", "carton depth", "carton_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_depth",
    width: 18,
    description: "Master carton depth in centimeters (> 0).",
  },
  {
    key: "cartonHeight",
    header: "Carton Height (cm)",
    aliases: ["carton height (cm)", "carton height", "carton_height"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_height",
    width: 18,
    description: "Master carton height in centimeters (> 0).",
  },
  {
    key: "cartonWeight",
    header: "Carton Weight (kg)",
    aliases: ["carton weight (kg)", "carton weight", "carton_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_weight",
    width: 18,
    description: "Master carton gross weight in kilograms (> 0).",
  },
  {
    key: "palletCartonQty",
    header: "Pallet Carton Quantity (boxes)",
    aliases: ["pallet carton quantity (boxes)", "pallet carton quantity", "palette_carton_qty"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_carton_qty",
    width: 26,
    description: "Master cartons per pallet (positive integer >= 1).",
  },
  {
    key: "palletWidth",
    header: "Pallet Width (cm)",
    aliases: ["pallet width (cm)", "pallet width", "palette_width"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_width",
    width: 18,
    description: "Loaded pallet width in centimeters (> 0).",
  },
  {
    key: "palletDepth",
    header: "Pallet Depth (cm)",
    aliases: ["pallet depth (cm)", "pallet depth", "palette_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_depth",
    width: 18,
    description: "Loaded pallet depth in centimeters (> 0).",
  },
  {
    key: "palletHeight",
    header: "Pallet Height (cm)",
    aliases: ["pallet height (cm)", "pallet height", "palette_height"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_height",
    width: 18,
    description: "Loaded pallet height in centimeters (> 0).",
  },
  {
    key: "palletWeight",
    header: "Pallet Weight (kg)",
    aliases: ["pallet weight (kg)", "pallet weight", "palette_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_weight",
    width: 18,
    description: "Loaded pallet gross weight in kilograms (> 0).",
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
