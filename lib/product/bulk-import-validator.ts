import * as XLSX from "xlsx";
import {
  ALLOWED_COLOR_MAPS,
  BULK_IMPORT_MAX_FILE_BYTES,
  BULK_IMPORT_MAX_ROWS,
  BULK_PRODUCT_COLUMNS,
  BULK_TEMPLATE_EXAMPLE_SKU,
  type BulkColumnSpec,
  type BulkNormalizedProductPayload,
  type BulkPreviewResult,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkRowRawFieldKey,
  type BulkValidatedRow,
} from "@/lib/product/bulk-import-types";
import {
  CATEGORY_TO_CODE_MAP,
  VOLUME_UNITS,
  formatVolume,
  isDraftPlaceholderName,
  isDraftPlaceholderSku,
  resolveRootCategoryEnum,
  type LeadTimeUnit,
  type ProductCategory,
  type VolumeUnit,
} from "@/lib/product/types";
import {
  formatCanonicalCountryName,
  isValidCanonicalCountry,
} from "@/lib/constants/countries";
import { validatePrice } from "@/lib/validation/global-validators";

export interface BulkValidationContext {
  fileName: string;
  buffer: Buffer | Uint8Array;
  companyBrands: BulkReferenceBrand[];
  allCategories: BulkReferenceCategory[];
  existingCompanySkus: Set<string>; // Uppercase trimmed SKUs in user's company
  existingUpcs: Set<string>;        // Trimmed UPCs visible in DB
  existingEans: Set<string>;        // Trimmed EANs visible in DB
}

const NUMERIC_FIELD_KEYS = new Set<BulkRowRawFieldKey>([
  "retailPriceKrw",
  "wholesalePriceKrw",
  "estimatedRetailPriceUsd",
  "exportFobPriceUsd",
  "itemWidth",
  "itemDepth",
  "itemHeight",
  "itemWeight",
  "packageWidth",
  "packageDepth",
  "packageHeight",
  "packageWeight",
  "cartonPackQty",
  "cartonWidth",
  "cartonDepth",
  "cartonHeight",
  "cartonWeight",
  "palletCartonQty",
  "palletWidth",
  "palletDepth",
  "palletHeight",
  "palletWeight",
  "leadTimeValue",
]);

const TEXT_IDENTIFIER_FIELD_KEYS = new Set<BulkRowRawFieldKey>([
  "manufactureSku",
  "upc",
  "ean",
]);

const MULTILINE_TEXT_KEYS = new Set<BulkRowRawFieldKey>([
  "description",
  "howToUse",
  "ingredients",
  "bulletPoint1",
  "bulletPoint2",
  "bulletPoint3",
  "bulletPoint4",
  "bulletPoint5",
]);

const LEGACY_DEPTH1_ALIASES: Record<string, string> = {
  skincare: "SKINCARE",
  "skin care": "SKINCARE",
  "스킨케어": "SKINCARE",
  hair_scalp: "HAIR_CARE",
  hair_care: "HAIR_CARE",
  "hair care": "HAIR_CARE",
  "hair & scalp": "HAIR_CARE",
  "헤어케어": "HAIR_CARE",
  "헤어&스칼프": "HAIR_CARE",
  beauty_tools: "BEAUTY_TOOLS",
  "beauty tools": "BEAUTY_TOOLS",
  "뷰티툴": "BEAUTY_TOOLS",
  "뷰티소품·툴": "BEAUTY_TOOLS",
  daily_care: "BODY_CARE",
  body_care: "BODY_CARE",
  "body care": "BODY_CARE",
  "daily care": "BODY_CARE",
  "바디케어": "BODY_CARE",
  "데일리케어": "BODY_CARE",
  wellness_patch: "PERSONAL_CARE",
  personal_care: "PERSONAL_CARE",
  "personal care": "PERSONAL_CARE",
  "퍼스널케어": "PERSONAL_CARE",
  "웰니스·기능성패치": "PERSONAL_CARE",
  makeup: "MAKEUP",
  "메이크업": "MAKEUP",
  sets_collections: "SETS_COLLECTIONS",
  "sets & collections": "SETS_COLLECTIONS",
  "세트/기획": "SETS_COLLECTIONS",
  other: "OTHER",
  "기타": "OTHER",
};

function normalizeHeaderLabel(raw: string): string {
  return raw
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasValidZipHeader(buf: Uint8Array): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

function extractCellString(
  cell: XLSX.CellObject | undefined,
  key: BulkRowRawFieldKey
): { value: string; hasFormula: boolean } {
  if (!cell) return { value: "", hasFormula: false };
  if (cell.f && String(cell.f).trim() !== "") {
    return { value: String(cell.w ?? cell.v ?? "").trim(), hasFormula: true };
  }

  if (cell.t === "z" || cell.v === undefined || cell.v === null) {
    return { value: "", hasFormula: false };
  }

  if (cell.t === "e") {
    return { value: String(cell.w ?? "#ERROR").trim(), hasFormula: true };
  }

  if (cell.t === "b") {
    return { value: cell.v ? "TRUE" : "FALSE", hasFormula: false };
  }

  if (TEXT_IDENTIFIER_FIELD_KEYS.has(key)) {
    if (cell.t === "s") {
      return { value: String(cell.v).trim(), hasFormula: false };
    }
    if (cell.t === "n") {
      const formatted = typeof cell.w === "string" ? cell.w.trim() : "";
      if (/^\d+$/.test(formatted)) {
        return { value: formatted, hasFormula: false };
      }
      if (Number.isInteger(cell.v)) {
        return { value: Number(cell.v).toFixed(0), hasFormula: false };
      }
      return { value: String(cell.v).trim(), hasFormula: false };
    }
    return { value: String(cell.v).trim(), hasFormula: false };
  }

  if (NUMERIC_FIELD_KEYS.has(key)) {
    if (typeof cell.v === "number") {
      return { value: Number.isFinite(cell.v) ? String(cell.v) : "", hasFormula: false };
    }
    return { value: String(cell.v ?? cell.w ?? "").trim(), hasFormula: false };
  }

  if (key === "volumeValue" && typeof cell.v === "number") {
    return { value: Number.isFinite(cell.v) ? String(cell.v) : "", hasFormula: false };
  }

  return { value: String(cell.v ?? cell.w ?? "").trim(), hasFormula: false };
}

function hasFormulaInjectionPrefix(val: string, isMultilineText: boolean): boolean {
  if (!val) return false;
  // Check raw leading character before trim as well as trimmed
  if (/^[\t\r]/.test(val)) return true;
  const t = val.trim();
  if (!t) return false;
  if (t.startsWith("=") || t.startsWith("+") || t.startsWith("@")) {
    return true;
  }
  if (t.startsWith("-")) {
    if (isMultilineText) {
      // Allow "- Step 1" prose bullets, block "-1+1", "-cmd|...", "-@..."
      return /^-[^\s]/.test(t);
    }
    return true;
  }
  return false;
}

function parseStrictBoolean(
  val: string
): { valid: boolean; value: boolean } {
  if (!val) return { valid: true, value: false };
  const lower = val.trim().toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "y" || lower === "1") {
    return { valid: true, value: true };
  }
  if (lower === "false" || lower === "no" || lower === "n" || lower === "0") {
    return { valid: true, value: false };
  }
  return { valid: false, value: false };
}

function parseYesNoFlag(
  val: string
): { valid: boolean; value: "Y" | null } {
  if (!val) return { valid: true, value: null };
  const lower = val.trim().toLowerCase();
  if (lower === "y" || lower === "yes" || lower === "true" || lower === "1") {
    return { valid: true, value: "Y" };
  }
  if (lower === "n" || lower === "no" || lower === "false" || lower === "0") {
    return { valid: true, value: null };
  }
  return { valid: false, value: null };
}

function parsePositiveDecimal(
  val: string
): { valid: boolean; value: number | null } {
  if (!val) return { valid: true, value: null };
  const trimmed = val.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    return { valid: false, value: null };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0 || num > 1_000_000) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

function parsePositiveInteger(
  val: string,
  maxVal = 1_000_000
): { valid: boolean; value: number | null } {
  if (!val) return { valid: true, value: null };
  const trimmed = val.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return { valid: false, value: null };
  }
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num < 1 || num > maxVal) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

function isValidHttpUrl(val: string): boolean {
  try {
    const parsed = new URL(val);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeLeadTimeUnit(val: string): LeadTimeUnit | null {
  const lower = val.trim().toLowerCase();
  if (lower === "days" || lower === "day" || lower === "일") return "일";
  if (lower === "weeks" || lower === "week" || lower === "주") return "주";
  if (lower === "months" || lower === "month" || lower === "개월") return "개월";
  return null;
}

function normalizeVolumeUnit(val: string): VolumeUnit | null {
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
  for (const item of VOLUME_UNITS) {
    if (item.value.toLowerCase() === lower) return item.value;
  }
  if (lower === "ea" || lower === "pcs" || lower === "ea/pcs") return "ea / pcs";
  if (lower === "fl.oz" || lower === "fl. oz" || lower === "floz") return "fl oz";
  if (lower === "기타") return "Other";
  return null;
}

function matchCategoryInList(
  input: string,
  candidates: BulkReferenceCategory[]
): BulkReferenceCategory | undefined {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();
  return candidates.find(
    (c) =>
      c.code.toUpperCase() === upper ||
      (c.name_en && c.name_en.trim().toLowerCase() === lower) ||
      c.name_ko.trim().toLowerCase() === lower
  );
}

export function sanitizeExcelOutputCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function parseAndValidateBulkProductWorkbook(
  ctx: BulkValidationContext
): BulkPreviewResult {
  const { fileName, buffer } = ctx;

  if (!fileName || !fileName.toLowerCase().endsWith(".xlsx")) {
    return {
      success: false,
      error: "Unsupported file format. Only .xlsx Excel files are supported.",
    };
  }

  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (uint8.byteLength === 0) {
    return {
      success: false,
      error: "Uploaded Excel file is empty.",
    };
  }
  if (uint8.byteLength > BULK_IMPORT_MAX_FILE_BYTES) {
    return {
      success: false,
      error: "Excel file exceeds the maximum allowed file size (10 MB).",
    };
  }
  if (!hasValidZipHeader(uint8)) {
    return {
      success: false,
      error: "Invalid .xlsx file structure. Please download and use the official .xlsx template.",
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(uint8, {
      type: "array",
      raw: false,
      cellFormula: true,
      cellText: true,
      cellNF: false,
    });
  } catch {
    return {
      success: false,
      error: "Failed to parse .xlsx file. Ensure the file is not corrupted or password-protected.",
    };
  }

  const productsSheetName = workbook.SheetNames.find(
    (n) => n.trim().toLowerCase() === "products"
  );
  if (!productsSheetName) {
    return {
      success: false,
      error: `Missing required sheet "Products". Found sheets: ${workbook.SheetNames.join(", ") || "none"}.`,
    };
  }

  const sheet = workbook.Sheets[productsSheetName];
  if (!sheet || !sheet["!ref"]) {
    return {
      success: false,
      error: 'The "Products" sheet is empty.',
    };
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const headerRowIdx = range.s.r;

  // Build alias -> spec lookup
  const aliasToSpec = new Map<string, BulkColumnSpec>();
  for (const spec of BULK_PRODUCT_COLUMNS) {
    aliasToSpec.set(normalizeHeaderLabel(spec.header), spec);
    for (const alias of spec.aliases) {
      aliasToSpec.set(normalizeHeaderLabel(alias), spec);
    }
  }

  const colIndexByKey = new Map<BulkRowRawFieldKey, number>();
  const duplicateHeaders: string[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const headerCell = sheet[addr] as XLSX.CellObject | undefined;
    const rawHeader = headerCell ? String(headerCell.v ?? headerCell.w ?? "").trim() : "";
    if (!rawHeader) continue;

    const spec = aliasToSpec.get(normalizeHeaderLabel(rawHeader));
    if (spec) {
      if (colIndexByKey.has(spec.key)) {
        duplicateHeaders.push(spec.header);
      } else {
        colIndexByKey.set(spec.key, c);
      }
    }
  }

  if (duplicateHeaders.length > 0) {
    return {
      success: false,
      error: `Duplicate column headers detected in "Products" sheet: ${duplicateHeaders.join(", ")}.`,
    };
  }

  const missingRequiredHeaders = BULK_PRODUCT_COLUMNS.filter(
    (s) => s.required && !colIndexByKey.has(s.key)
  ).map((s) => s.header.replace(" *", ""));

  if (missingRequiredHeaders.length > 0) {
    return {
      success: false,
      error: `Missing required column header(s) in "Products" sheet: ${missingRequiredHeaders.join(", ")}.`,
    };
  }

  // Extract non-empty rows first to check row limits & example row skipping
  interface ExtractedRow {
    excelRowNumber: number;
    values: Record<BulkRowRawFieldKey, string>;
    formulaHeaders: string[];
  }

  const extractedRows: ExtractedRow[] = [];
  let exampleRowsSkipped = 0;

  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    const values = {} as Record<BulkRowRawFieldKey, string>;
    const formulaHeaders: string[] = [];
    let hasAnyNonEmpty = false;

    for (const spec of BULK_PRODUCT_COLUMNS) {
      const colIdx = colIndexByKey.get(spec.key);
      if (colIdx === undefined) {
        values[spec.key] = "";
        continue;
      }
      const addr = XLSX.utils.encode_cell({ r, c: colIdx });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      const { value, hasFormula } = extractCellString(cell, spec.key);
      values[spec.key] = value;
      if (hasFormula) {
        formulaHeaders.push(spec.header.replace(" *", ""));
        hasAnyNonEmpty = true;
      } else if (value !== "") {
        hasAnyNonEmpty = true;
      }
    }

    if (!hasAnyNonEmpty) continue;

    // Auto-skip template example row if left unchanged by supplier
    const skuUpper = values.manufactureSku.trim().toUpperCase();
    const nameEnUpper = values.productNameEn.trim().toUpperCase();
    if (
      skuUpper === BULK_TEMPLATE_EXAMPLE_SKU ||
      nameEnUpper.startsWith("[EXAMPLE]")
    ) {
      exampleRowsSkipped += 1;
      continue;
    }

    extractedRows.push({
      excelRowNumber: r + 1, // 1-indexed Excel row number
      values,
      formulaHeaders,
    });

    if (extractedRows.length > BULK_IMPORT_MAX_ROWS) {
      return {
        success: false,
        error: `Maximum ${BULK_IMPORT_MAX_ROWS} product rows per upload are supported in V1. Please split larger catalogs into batches of ${BULK_IMPORT_MAX_ROWS} rows or fewer.`,
      };
    }
  }

  if (extractedRows.length === 0) {
    return {
      success: false,
      error:
        exampleRowsSkipped > 0
          ? `No product rows found (only the template example row ${BULK_TEMPLATE_EXAMPLE_SKU} was present in "Products"). Please add at least one product row.`
          : 'No product rows found in the "Products" sheet.',
    };
  }

  // Brand lookup maps
  const activeBrandByLowerName = new Map<string, BulkReferenceBrand>();
  const inactiveBrandByLowerName = new Map<string, BulkReferenceBrand>();
  for (const b of ctx.companyBrands) {
    const lower = b.name.trim().toLowerCase();
    if (!lower) continue;
    if (b.is_active !== false) {
      activeBrandByLowerName.set(lower, b);
    } else {
      inactiveBrandByLowerName.set(lower, b);
    }
  }

  // Category lookup structures
  const hasCategoryMaster = ctx.allCategories.length > 0;
  const depth1All = ctx.allCategories.filter((c) => c.depth === 1);
  const depth2All = ctx.allCategories.filter((c) => c.depth === 2);
  const depth3All = ctx.allCategories.filter((c) => c.depth === 3);
  const catByCode = new Map<string, BulkReferenceCategory>();
  for (const c of ctx.allCategories) {
    catByCode.set(c.code.toUpperCase(), c);
  }

  // Track first-seen in-file identifiers (skuUpper -> rowIndex in validatedRows)
  const seenSkuFirstRowIndex = new Map<string, { excelRowNumber: number; arrayIdx: number }>();
  const seenUpcFirstRowIndex = new Map<string, { excelRowNumber: number; arrayIdx: number }>();
  const seenEanFirstRowIndex = new Map<string, { excelRowNumber: number; arrayIdx: number }>();

  const validatedRows: BulkValidatedRow[] = [];

  for (let idx = 0; idx < extractedRows.length; idx++) {
    const { excelRowNumber, values, formulaHeaders } = extractedRows[idx];
    const errors: string[] = [];
    const warnings: string[] = [];
    const guidanceSet = new Set<string>();
    let isDuplicateError = false;
    let isValidationError = false;

    const addValidationError = (reason: string, guidance: string) => {
      errors.push(reason);
      guidanceSet.add(guidance);
      isValidationError = true;
    };

    const addDuplicateError = (reason: string, guidance: string) => {
      errors.push(reason);
      guidanceSet.add(guidance);
      isDuplicateError = true;
    };

    // 0. Formula & Formula Injection Prevention
    if (formulaHeaders.length > 0) {
      addValidationError(
        `Excel formulas are not allowed (${formulaHeaders.join(", ")}).`,
        "Replace Excel formulas with plain text or numeric values (Paste Values)."
      );
    }

    for (const spec of BULK_PRODUCT_COLUMNS) {
      const rawVal = values[spec.key];
      if (!rawVal) continue;
      if (NUMERIC_FIELD_KEYS.has(spec.key)) continue; // numeric fields checked by strict numeric regex
      const isMulti = MULTILINE_TEXT_KEYS.has(spec.key);
      if (hasFormulaInjectionPrefix(rawVal, isMulti)) {
        addValidationError(
          `Field "${spec.header.replace(" *", "")}" starts with a restricted formula character (=, +, -, @).`,
          `Remove leading '=', '+', '-', or '@' from "${spec.header.replace(" *", "")}".`
        );
      }
    }

    // 1. Brand (Required)
    let resolvedBrand: BulkReferenceBrand | null = null;
    const rawBrand = values.brand.trim();
    if (!rawBrand) {
      addValidationError(
        "Brand is required.",
        "Enter an active brand name belonging to your company (check the Brands sheet)."
      );
    } else {
      const lowerBrand = rawBrand.toLowerCase();
      const activeMatch = activeBrandByLowerName.get(lowerBrand);
      if (activeMatch) {
        resolvedBrand = activeMatch;
      } else if (inactiveBrandByLowerName.has(lowerBrand)) {
        addValidationError(
          `Brand "${rawBrand}" is currently inactive.`,
          "Select an active brand from the Brands sheet or reactivate the brand first."
        );
      } else {
        addValidationError(
          `Brand "${rawBrand}" does not belong to your company or does not exist.`,
          "Use an exact active brand name listed in your template's Brands sheet."
        );
      }
    }

    // 2. Manufacturer SKU (Required)
    const rawSku = values.manufactureSku.trim();
    let normalizedSku = "";
    if (!rawSku) {
      addValidationError(
        "Manufacturer SKU is required.",
        "Provide a unique Manufacturer SKU using letters, numbers, hyphens (-), or underscores (_)."
      );
    } else if (rawSku.length > 100) {
      addValidationError(
        "Manufacturer SKU exceeds maximum length of 100 characters.",
        "Shorten Manufacturer SKU to 100 characters or fewer."
      );
    } else if (isDraftPlaceholderSku(rawSku.toUpperCase())) {
      addValidationError(
        `Manufacturer SKU "${rawSku}" uses a reserved system draft prefix (DRAFT-SKU-).`,
        "Enter your actual Manufacturer SKU instead of a DRAFT-SKU placeholder."
      );
    } else if (!/^[A-Za-z0-9]+(?:[\-_][A-Za-z0-9]+)*$/.test(rawSku)) {
      addValidationError(
        `Invalid Manufacturer SKU format "${rawSku}". Only A-Z, 0-9, single '-' or '_' between characters are allowed (no spaces or leading/trailing separators).`,
        "Use alphanumeric characters with single '-' or '_' separators (e.g., KSN-TONER-200ML)."
      );
    } else {
      normalizedSku = rawSku.toUpperCase();
      if (normalizedSku !== rawSku) {
        warnings.push(`Manufacturer SKU normalized to uppercase "${normalizedSku}".`);
      }

      // Check existing DB SKU collision (company-scoped, case-insensitive)
      if (ctx.existingCompanySkus.has(normalizedSku)) {
        addDuplicateError(
          `Manufacturer SKU "${normalizedSku}" already exists in your company catalog.`,
          "Existing SKUs are never overwritten. Remove this row or use a new unique SKU."
        );
      } else {
        // Check in-file duplicate SKU
        const prev = seenSkuFirstRowIndex.get(normalizedSku);
        if (prev) {
          addDuplicateError(
            `Duplicate Manufacturer SKU "${normalizedSku}" within uploaded Excel (already used on row ${prev.excelRowNumber}).`,
            `Remove the duplicate row or assign a distinct Manufacturer SKU (conflicts with row ${prev.excelRowNumber}).`
          );
          const firstRow = validatedRows[prev.arrayIdx];
          if (firstRow && firstRow.status !== "INVALID") {
            const note = `Duplicate SKU "${normalizedSku}" also appeared on row ${excelRowNumber} (row ${excelRowNumber} was rejected).`;
            if (!firstRow.warnings.includes(note)) {
              firstRow.warnings.push(note);
              firstRow.status = "WARNING";
            }
          }
        } else {
          seenSkuFirstRowIndex.set(normalizedSku, { excelRowNumber, arrayIdx: idx });
        }
      }
    }

    // 3. Product Name EN (Required) & Product Name KO (Optional)
    const rawNameEn = values.productNameEn.trim();
    const rawNameKo = values.productNameKo.trim();
    if (!rawNameEn) {
      addValidationError(
        "Product Name EN is required.",
        "Enter the English product name in Product Name EN."
      );
    } else if (rawNameEn.length > 300) {
      addValidationError(
        "Product Name EN exceeds maximum length of 300 characters.",
        "Shorten Product Name EN to 300 characters or fewer."
      );
    } else if (isDraftPlaceholderName(rawNameEn)) {
      addValidationError(
        "Product Name EN cannot use a reserved placeholder title.",
        "Enter the actual English product name."
      );
    }

    if (rawNameKo.length > 300) {
      addValidationError(
        "Product Name KO exceeds maximum length of 300 characters.",
        "Shorten Product Name KO to 300 characters or fewer."
      );
    } else if (rawNameKo && isDraftPlaceholderName(rawNameKo)) {
      addValidationError(
        "Product Name KO cannot use a reserved placeholder title.",
        "Enter the actual Korean product name or leave blank."
      );
    }

    // 4. Category Hierarchy (1Depth Required, 2Depth & 3Depth Optional)
    const rawCat1 = values.category1Depth.trim();
    const rawCat2 = values.category2Depth.trim();
    const rawCat3 = values.category3Depth.trim();

    let resolvedCategoryEnum: ProductCategory = "skincare";
    let resolvedCategoryCode: string | null = null;
    let normalizedCategoryPath = "";

    if (!rawCat1) {
      addValidationError(
        "Category 1Depth is required.",
        "Select a valid Category 1Depth from the Categories sheet (e.g., Skincare, Hair Care)."
      );
    } else if (hasCategoryMaster) {
      const aliasCode = LEGACY_DEPTH1_ALIASES[rawCat1.toLowerCase()];
      const matchedD1 = aliasCode
        ? catByCode.get(aliasCode) || matchCategoryInList(rawCat1, depth1All)
        : matchCategoryInList(rawCat1, depth1All);

      if (!matchedD1) {
        addValidationError(
          `Invalid Category 1Depth "${rawCat1}".`,
          "Refer to the Categories sheet for valid Category 1Depth codes or names."
        );
      } else if (!matchedD1.is_active) {
        addValidationError(
          `Category 1Depth "${matchedD1.name_en || matchedD1.code}" is inactive.`,
          "Choose an active Category 1Depth from the Categories sheet."
        );
      } else {
        resolvedCategoryEnum = resolveRootCategoryEnum(matchedD1.code);
        resolvedCategoryCode = matchedD1.code;
        const pathParts = [matchedD1.name_en || matchedD1.code];

        if (!rawCat2 && rawCat3) {
          addValidationError(
            "Category 2Depth is required when Category 3Depth is provided.",
            "Specify the parent Category 2Depth for the selected Category 3Depth, or clear Category 3Depth."
          );
        } else if (rawCat2) {
          const childrenD2 = depth2All.filter((c) => c.parent_code === matchedD1.code);
          const matchedD2 = matchCategoryInList(rawCat2, childrenD2);

          if (!matchedD2) {
            const otherParentD2 = matchCategoryInList(rawCat2, depth2All);
            if (otherParentD2) {
              const actualParent = otherParentD2.parent_code
                ? catByCode.get(otherParentD2.parent_code.toUpperCase())
                : undefined;
              addValidationError(
                `Category 2Depth "${rawCat2}" does not belong to Category 1Depth "${matchedD1.name_en || matchedD1.code}" (belongs to "${actualParent?.name_en || otherParentD2.parent_code}").`,
                "Check the Categories sheet and match Category 1Depth and Category 2Depth in the same branch."
              );
            } else {
              addValidationError(
                `Invalid Category 2Depth "${rawCat2}" under "${matchedD1.name_en || matchedD1.code}".`,
                "Refer to the Categories sheet for valid Category 2Depth values."
              );
            }
          } else if (!matchedD2.is_active) {
            addValidationError(
              `Category 2Depth "${matchedD2.name_en || matchedD2.code}" is inactive.`,
              "Choose an active Category 2Depth from the Categories sheet."
            );
          } else {
            resolvedCategoryCode = matchedD2.code;
            pathParts.push(matchedD2.name_en || matchedD2.code);

            if (rawCat3) {
              const childrenD3 = depth3All.filter((c) => c.parent_code === matchedD2.code);
              if (matchedD2.is_final && childrenD3.length === 0) {
                addValidationError(
                  `Category 2Depth "${matchedD2.name_en || matchedD2.code}" is already a final category and has no 3Depth subcategories.`,
                  "Leave Category 3Depth blank for this category."
                );
              } else {
                const matchedD3 = matchCategoryInList(rawCat3, childrenD3);
                if (!matchedD3) {
                  const otherParentD3 = matchCategoryInList(rawCat3, depth3All);
                  if (otherParentD3) {
                    const actualP2 = otherParentD3.parent_code
                      ? catByCode.get(otherParentD3.parent_code.toUpperCase())
                      : undefined;
                    addValidationError(
                      `Category 3Depth "${rawCat3}" does not belong under "${matchedD2.name_en || matchedD2.code}" (belongs under "${actualP2?.name_en || otherParentD3.parent_code}").`,
                      "Select a Category 3Depth that belongs to the chosen Category 2Depth."
                    );
                  } else {
                    addValidationError(
                      `Invalid Category 3Depth "${rawCat3}" under "${matchedD2.name_en || matchedD2.code}".`,
                      "Refer to the Categories sheet for valid Category 3Depth values."
                    );
                  }
                } else if (!matchedD3.is_active) {
                  addValidationError(
                    `Category 3Depth "${matchedD3.name_en || matchedD3.code}" is inactive.`,
                    "Choose an active Category 3Depth from the Categories sheet."
                  );
                } else {
                  resolvedCategoryCode = matchedD3.code;
                  pathParts.push(matchedD3.name_en || matchedD3.code);
                }
              }
            }
          }
        }

        normalizedCategoryPath = pathParts.join(" > ");
      }
    } else {
      // Fallback when categories table is empty in an unseeded environment
      const aliasCode = LEGACY_DEPTH1_ALIASES[rawCat1.toLowerCase()];
      const validEnums = Object.keys(CATEGORY_TO_CODE_MAP) as ProductCategory[];
      if (validEnums.includes(rawCat1.toLowerCase() as ProductCategory)) {
        resolvedCategoryEnum = rawCat1.toLowerCase() as ProductCategory;
        resolvedCategoryCode = null;
        normalizedCategoryPath = resolvedCategoryEnum;
      } else if (aliasCode) {
        resolvedCategoryEnum = resolveRootCategoryEnum(aliasCode);
        resolvedCategoryCode = null;
        normalizedCategoryPath = aliasCode;
      } else {
        addValidationError(
          `Invalid Category 1Depth "${rawCat1}".`,
          "Use Skincare, Hair Care, Beauty Tools, Body Care, Personal Care, Makeup, Sets & Collections, or Other."
        );
      }
      if (rawCat2 || rawCat3) {
        addValidationError(
          "Category 2Depth / 3Depth taxonomy is unavailable in the current environment.",
          "Leave Category 2Depth and Category 3Depth blank or seed the category master table."
        );
      }
    }

    // 5. Volume Value & Volume Unit
    let resolvedVolume: string | null = null;
    const rawVolVal = values.volumeValue.trim();
    const rawVolUnit = values.volumeUnit.trim();
    if (rawVolVal && !rawVolUnit) {
      addValidationError(
        "Volume Unit is required when Volume Value is provided.",
        "Select a Volume Unit (ml, L, g, kg, mg, oz, fl oz, ea / pcs, or Other)."
      );
    } else if (!rawVolVal && rawVolUnit) {
      addValidationError(
        "Volume Value is required when Volume Unit is specified.",
        "Enter a Volume Value or clear Volume Unit."
      );
    } else if (rawVolVal && rawVolUnit) {
      const normUnit = normalizeVolumeUnit(rawVolUnit);
      if (!normUnit) {
        addValidationError(
          `Invalid Volume Unit "${rawVolUnit}".`,
          "Use one of: ml, L, g, kg, mg, oz, fl oz, ea / pcs, Other."
        );
      } else if (normUnit === "Other") {
        if (rawVolVal.length > 50) {
          addValidationError(
            "Volume Value exceeds 50 characters.",
            "Keep custom volume text within 50 characters."
          );
        } else {
          resolvedVolume = formatVolume(rawVolVal, normUnit);
        }
      } else {
        const parsedVol = parsePositiveDecimal(rawVolVal);
        if (!parsedVol.valid) {
          addValidationError(
            `Volume Value "${rawVolVal}" must be a positive number for unit "${normUnit}".`,
            "Enter a positive numeric Volume Value (e.g., 200) or set Volume Unit to Other."
          );
        } else {
          resolvedVolume = formatVolume(String(parsedVol.value), normUnit);
        }
      }
    }

    // 6. Country of Origin (NEVER auto-assign South Korea when blank)
    let resolvedOrigin: string | null = null;
    const rawOrigin = values.countryOfOrigin.trim();
    if (rawOrigin) {
      if (!isValidCanonicalCountry(rawOrigin)) {
        addValidationError(
          `Invalid Country of Origin "${rawOrigin}".`,
          "Refer to the Countries sheet for valid canonical country names or ISO codes (or leave blank)."
        );
      } else {
        resolvedOrigin = formatCanonicalCountryName(rawOrigin);
        if (resolvedOrigin.toLowerCase() !== rawOrigin.toLowerCase()) {
          warnings.push(`Country of Origin normalized to "${resolvedOrigin}".`);
        }
      }
    }

    // 7. Lead Time Value & Unit
    let resolvedLeadTime: string | null = null;
    const rawLtVal = values.leadTimeValue.trim();
    const rawLtUnit = values.leadTimeUnit.trim();
    if (rawLtVal && !rawLtUnit) {
      addValidationError(
        "Lead Time Unit is required when Lead Time Value is provided.",
        "Select Days, Weeks, or Months for Lead Time Unit."
      );
    } else if (!rawLtVal && rawLtUnit) {
      addValidationError(
        "Lead Time Value is required when Lead Time Unit is specified.",
        "Enter a positive integer for Lead Time Value or clear Lead Time Unit."
      );
    } else if (rawLtVal && rawLtUnit) {
      const parsedLt = parsePositiveInteger(rawLtVal, 3650);
      const normLtUnit = normalizeLeadTimeUnit(rawLtUnit);
      if (!parsedLt.valid) {
        addValidationError(
          `Lead Time Value "${rawLtVal}" must be a positive integer.`,
          "Enter a whole number greater than 0 (e.g., 14)."
        );
      }
      if (!normLtUnit) {
        addValidationError(
          `Invalid Lead Time Unit "${rawLtUnit}".`,
          "Use Days, Weeks, or Months."
        );
      }
      if (parsedLt.valid && normLtUnit) {
        resolvedLeadTime = `${parsedLt.value} ${normLtUnit}`;
      }
    }

    // 8. Color & Color Map
    const rawColor = values.color.trim();
    if (rawColor.length > 100) {
      addValidationError(
        "Color exceeds maximum length of 100 characters.",
        "Shorten Color to 100 characters or fewer."
      );
    }

    let resolvedColorMap: string | null = null;
    const rawColorMap = values.colorMap.trim();
    if (rawColorMap) {
      const matchedCm = ALLOWED_COLOR_MAPS.find(
        (cm) => cm.toLowerCase() === rawColorMap.toLowerCase()
      );
      if (!matchedCm) {
        addValidationError(
          `Invalid Color Map "${rawColorMap}".`,
          `Select an allowed Color Map value (${ALLOWED_COLOR_MAPS.join(", ")}).`
        );
      } else {
        resolvedColorMap = matchedCm;
      }
    }

    // 9. Description, Bullet Points 1-5, How to Use, Ingredients
    const rawDescription = values.description.trim();
    if (rawDescription.length > 5000) {
      addValidationError(
        "Description exceeds maximum length of 5,000 characters.",
        "Shorten Description to 5,000 characters or fewer."
      );
    }

    const bulletPoints: string[] = [];
    const bulletKeys: BulkRowRawFieldKey[] = [
      "bulletPoint1",
      "bulletPoint2",
      "bulletPoint3",
      "bulletPoint4",
      "bulletPoint5",
    ];
    bulletKeys.forEach((bKey, bIdx) => {
      const bVal = values[bKey].trim();
      if (bVal) {
        if (bVal.length > 500) {
          addValidationError(
            `Bullet Point ${bIdx + 1} exceeds maximum length of 500 characters.`,
            `Shorten Bullet Point ${bIdx + 1} to 500 characters or fewer.`
          );
        } else {
          bulletPoints.push(bVal);
        }
      }
    });

    const rawHowToUse = values.howToUse.trim();
    if (rawHowToUse.length > 5000) {
      addValidationError(
        "How to Use exceeds maximum length of 5,000 characters.",
        "Shorten How to Use to 5,000 characters or fewer."
      );
    }

    const rawIngredients = values.ingredients.trim();
    if (rawIngredients.length > 10000) {
      addValidationError(
        "Ingredients exceeds maximum length of 10,000 characters.",
        "Shorten Ingredients to 10,000 characters or fewer."
      );
    }

    // 10. Parent SKU & Child SKU
    const parsedParent = parseYesNoFlag(values.parentSku);
    const parsedChild = parseYesNoFlag(values.childSku);
    if (!parsedParent.valid) {
      addValidationError(
        `Invalid Parent SKU value "${values.parentSku}".`,
        "Use Y or N (or leave blank) for Parent SKU."
      );
    }
    if (!parsedChild.valid) {
      addValidationError(
        `Invalid Child SKU value "${values.childSku}".`,
        "Use Y or N (or leave blank) for Child SKU."
      );
    }
    if (parsedParent.value === "Y" && parsedChild.value === "Y") {
      addValidationError(
        "A product cannot be marked as both Parent SKU and Child SKU.",
        "Set either Parent SKU or Child SKU to Y, not both."
      );
    }

    // 11. Barcodes (UPC 12 digits, EAN 13 digits + uniqueness)
    const rawUpc = values.upc.trim();
    let resolvedUpc: string | null = null;
    if (rawUpc) {
      if (!/^\d{12}$/.test(rawUpc)) {
        addValidationError(
          `Invalid UPC "${rawUpc}". UPC must be exactly 12 numeric digits (including leading zeros).`,
          "Format the UPC column as Text and enter exactly 12 digits (e.g., 012345678905)."
        );
      } else if (ctx.existingUpcs.has(rawUpc)) {
        addDuplicateError(
          `UPC "${rawUpc}" is already registered in your catalog.`,
          "Provide a unique 12-digit UPC barcode."
        );
      } else {
        const prevUpc = seenUpcFirstRowIndex.get(rawUpc);
        if (prevUpc) {
          addDuplicateError(
            `Duplicate UPC "${rawUpc}" within uploaded Excel (already used on row ${prevUpc.excelRowNumber}).`,
            `Each product requires a unique UPC barcode (conflicts with row ${prevUpc.excelRowNumber}).`
          );
        } else {
          seenUpcFirstRowIndex.set(rawUpc, { excelRowNumber, arrayIdx: idx });
          resolvedUpc = rawUpc;
        }
      }
    }

    const rawEan = values.ean.trim();
    let resolvedEan: string | null = null;
    if (rawEan) {
      if (!/^\d{13}$/.test(rawEan)) {
        addValidationError(
          `Invalid EAN "${rawEan}". EAN must be exactly 13 numeric digits (including leading zeros).`,
          "Format the EAN column as Text and enter exactly 13 digits (e.g., 8801234567890)."
        );
      } else if (ctx.existingEans.has(rawEan)) {
        addDuplicateError(
          `EAN "${rawEan}" is already registered in the system.`,
          "Provide a unique 13-digit EAN barcode."
        );
      } else {
        const prevEan = seenEanFirstRowIndex.get(rawEan);
        if (prevEan) {
          addDuplicateError(
            `Duplicate EAN "${rawEan}" within uploaded Excel (already used on row ${prevEan.excelRowNumber}).`,
            `Each product requires a unique EAN barcode (conflicts with row ${prevEan.excelRowNumber}).`
          );
        } else {
          seenEanFirstRowIndex.set(rawEan, { excelRowNumber, arrayIdx: idx });
          resolvedEan = rawEan;
        }
      }
    }

    // 12. Selling Online / Offline & Sales Links
    const parsedOnline = parseStrictBoolean(values.sellingOnline);
    const parsedOffline = parseStrictBoolean(values.sellingOffline);
    if (!parsedOnline.valid) {
      addValidationError(
        `Invalid Selling Online value "${values.sellingOnline}".`,
        "Use TRUE or FALSE (or Y/N) for Selling Online."
      );
    }
    if (!parsedOffline.valid) {
      addValidationError(
        `Invalid Selling Offline value "${values.sellingOffline}".`,
        "Use TRUE or FALSE (or Y/N) for Selling Offline."
      );
    }

    const rawLink1 = values.salesLink1.trim();
    const rawLink2 = values.salesLink2.trim();
    if (rawLink1) {
      if (rawLink1.length > 1000 || !isValidHttpUrl(rawLink1)) {
        addValidationError(
          `Invalid Sales Link 1 "${rawLink1}". Must be a valid http:// or https:// URL.`,
          "Include full URL starting with https:// (e.g., https://brand.com/product)."
        );
      }
    }
    if (rawLink2) {
      if (rawLink2.length > 1000 || !isValidHttpUrl(rawLink2)) {
        addValidationError(
          `Invalid Sales Link 2 "${rawLink2}". Must be a valid http:// or https:// URL.`,
          "Include full URL starting with https://."
        );
      }
    }
    if (parsedOnline.valid && parsedOnline.value && !rawLink1) {
      addValidationError(
        "Sales Link 1 is required when Selling Online is TRUE.",
        "Provide Sales Link 1 (https://...) or set Selling Online to FALSE."
      );
    } else if (parsedOnline.valid && !parsedOnline.value && (rawLink1 || rawLink2)) {
      warnings.push("Sales Link provided while Selling Online is FALSE.");
    }

    // 13. Pricing (KRW integer >= 0, USD decimal >= 0)
    let priceKrwRetail: number | null = null;
    if (values.retailPriceKrw) {
      const v = validatePrice(values.retailPriceKrw, {
        required: false,
        allowZero: true,
        allowDecimal: false,
        fieldNameEn: "Retail Price KRW",
        language: "en",
      });
      if (!v.valid || (v.value !== null && v.value !== undefined && v.value > 1_000_000_000)) {
        addValidationError(
          `Invalid Retail Price KRW "${values.retailPriceKrw}". Must be a whole number >= 0 without currency symbols.`,
          "Enter an integer >= 0 for Retail Price KRW (e.g., 25000)."
        );
      } else {
        priceKrwRetail = v.value ?? null;
      }
    }

    let priceKrwWholesale: number | null = null;
    if (values.wholesalePriceKrw) {
      const v = validatePrice(values.wholesalePriceKrw, {
        required: false,
        allowZero: true,
        allowDecimal: false,
        fieldNameEn: "Wholesale Price KRW",
        language: "en",
      });
      if (!v.valid || (v.value !== null && v.value !== undefined && v.value > 1_000_000_000)) {
        addValidationError(
          `Invalid Wholesale Price KRW "${values.wholesalePriceKrw}". Must be a whole number >= 0 without currency symbols.`,
          "Enter an integer >= 0 for Wholesale Price KRW (e.g., 12500)."
        );
      } else {
        priceKrwWholesale = v.value ?? null;
      }
    }

    let estimatedRetailPrice: number | null = null;
    if (values.estimatedRetailPriceUsd) {
      const v = validatePrice(values.estimatedRetailPriceUsd, {
        required: false,
        allowZero: true,
        allowDecimal: true,
        fieldNameEn: "Estimated Retail Price USD",
        language: "en",
      });
      if (!v.valid || (v.value !== null && v.value !== undefined && v.value > 1_000_000)) {
        addValidationError(
          `Invalid Estimated Retail Price USD "${values.estimatedRetailPriceUsd}". Must be a non-negative number.`,
          "Enter a valid USD amount without '$' (e.g., 24.00)."
        );
      } else {
        estimatedRetailPrice = v.value ?? null;
      }
    }

    let priceUsdFob: number | null = null;
    if (values.exportFobPriceUsd) {
      const v = validatePrice(values.exportFobPriceUsd, {
        required: false,
        allowZero: true,
        allowDecimal: true,
        fieldNameEn: "Export FOB Price USD",
        language: "en",
      });
      if (!v.valid || (v.value !== null && v.value !== undefined && v.value > 1_000_000)) {
        addValidationError(
          `Invalid Export FOB Price USD "${values.exportFobPriceUsd}". Must be a non-negative number.`,
          "Enter a valid USD amount without '$' (e.g., 8.50)."
        );
      } else {
        priceUsdFob = v.value ?? null;
      }
    }

    // 14. Logistics Measurements (all optional; positive > 0 when supplied)
    const checkPositiveMeasure = (
      key: BulkRowRawFieldKey,
      label: string
    ): number | null => {
      const raw = values[key];
      if (!raw) return null;
      const res = parsePositiveDecimal(raw);
      if (!res.valid) {
        addValidationError(
          `Invalid ${label} "${raw}". Must be a positive number greater than 0.`,
          `Enter a positive numeric measurement (> 0) for ${label} or leave blank.`
        );
        return null;
      }
      return res.value;
    };

    const checkPositiveQty = (
      key: BulkRowRawFieldKey,
      label: string
    ): number | null => {
      const raw = values[key];
      if (!raw) return null;
      const res = parsePositiveInteger(raw, 100_000);
      if (!res.valid) {
        addValidationError(
          `Invalid ${label} "${raw}". Must be a positive whole number (>= 1).`,
          `Enter a positive integer (>= 1) for ${label} or leave blank.`
        );
        return null;
      }
      return res.value;
    };

    const itemWidth = checkPositiveMeasure("itemWidth", "Item Width (cm)");
    const itemDepth = checkPositiveMeasure("itemDepth", "Item Depth (cm)");
    const itemHeight = checkPositiveMeasure("itemHeight", "Item Height (cm)");
    const itemWeight = checkPositiveMeasure("itemWeight", "Item Weight (g)");

    const packageWidth = checkPositiveMeasure("packageWidth", "Package Width (cm)");
    const packageDepth = checkPositiveMeasure("packageDepth", "Package Depth (cm)");
    const packageHeight = checkPositiveMeasure("packageHeight", "Package Height (cm)");
    const packageWeight = checkPositiveMeasure("packageWeight", "Package Weight (g)");

    const cartonPackQty = checkPositiveQty("cartonPackQty", "Carton Pack Quantity (ea)");
    const cartonWidth = checkPositiveMeasure("cartonWidth", "Carton Width (cm)");
    const cartonDepth = checkPositiveMeasure("cartonDepth", "Carton Depth (cm)");
    const cartonHeight = checkPositiveMeasure("cartonHeight", "Carton Height (cm)");
    const cartonWeight = checkPositiveMeasure("cartonWeight", "Carton Weight (kg)");

    let cartonCbm: number | null = null;
    if (cartonWidth && cartonDepth && cartonHeight) {
      cartonCbm = Number(((cartonWidth * cartonDepth * cartonHeight) / 1_000_000).toFixed(5));
    }

    const palletCartonQty = checkPositiveQty("palletCartonQty", "Pallet Carton Quantity (boxes)");
    const palletWidth = checkPositiveMeasure("palletWidth", "Pallet Width (cm)");
    const palletDepth = checkPositiveMeasure("palletDepth", "Pallet Depth (cm)");
    const palletHeight = checkPositiveMeasure("palletHeight", "Pallet Height (cm)");
    const palletWeight = checkPositiveMeasure("palletWeight", "Pallet Weight (kg)");

    const isInvalid = errors.length > 0;
    const status = isInvalid ? "INVALID" : warnings.length > 0 ? "WARNING" : "VALID";

    const payload: BulkNormalizedProductPayload | null =
      !isInvalid && resolvedBrand
        ? {
            brand_id: resolvedBrand.id,
            brand_name: resolvedBrand.name,
            manufacture_sku: normalizedSku,
            name: rawNameKo || rawNameEn,
            name_en: rawNameEn,
            category: resolvedCategoryEnum,
            category_code: resolvedCategoryCode,
            category_display_path: normalizedCategoryPath,
            volume: resolvedVolume,
            origin: resolvedOrigin, // Explicitly null if blank in Excel!
            lead_time: resolvedLeadTime,
            color: rawColor || null,
            color_map: resolvedColorMap,
            description: rawDescription || null,
            bullet_points: bulletPoints,
            how_to_use: rawHowToUse || null,
            ingredients_text: rawIngredients || null,
            parent_sku: parsedParent.value,
            child_sku: parsedChild.value,
            upc: resolvedUpc,
            ean: resolvedEan,
            selling_online: parsedOnline.value,
            selling_offline: parsedOffline.value,
            sales_link_1: rawLink1 || null,
            sales_link_2: rawLink2 || null,
            price_krw_retail: priceKrwRetail,
            price_krw_wholesale: priceKrwWholesale,
            estimated_retail_price: estimatedRetailPrice,
            price_usd_fob: priceUsdFob,
            item_width: itemWidth,
            item_depth: itemDepth,
            item_height: itemHeight,
            item_weight: itemWeight,
            package_width: packageWidth,
            package_depth: packageDepth,
            package_height: packageHeight,
            package_weight: packageWeight,
            carton_pack_qty: cartonPackQty,
            carton_width: cartonWidth,
            carton_depth: cartonDepth,
            carton_height: cartonHeight,
            carton_weight: cartonWeight,
            carton_cbm: cartonCbm,
            palette_carton_qty: palletCartonQty,
            palette_width: palletWidth,
            palette_depth: palletDepth,
            palette_height: palletHeight,
            palette_weight: palletWeight,
          }
        : null;

    validatedRows.push({
      excelRowNumber,
      status,
      rawBrand: values.brand,
      rawManufactureSku: normalizedSku || values.manufactureSku,
      rawProductNameEn: values.productNameEn,
      rawCategory1Depth: values.category1Depth,
      normalizedCategoryPath,
      errors,
      warnings,
      correctiveGuidance: Array.from(guidanceSet),
      isDuplicateError,
      isValidationError,
      payload,
    });
  }

  let validRows = 0;
  let warningRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let validationErrorRows = 0;

  for (const row of validatedRows) {
    if (row.status === "VALID") validRows += 1;
    else if (row.status === "WARNING") warningRows += 1;
    else {
      invalidRows += 1;
      if (row.isDuplicateError) duplicateRows += 1;
      if (row.isValidationError) validationErrorRows += 1;
    }
  }

  return {
    success: true,
    fileName,
    summary: {
      totalRows: validatedRows.length,
      validRows,
      warningRows,
      importableRows: validRows + warningRows,
      invalidRows,
      duplicateRows,
      validationErrorRows,
      exampleRowsSkipped,
    },
    rows: validatedRows,
  };
}
