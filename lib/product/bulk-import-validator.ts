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
    .replace(/[\u00A0\r\n\t]+/g, " ")
    .replace(/\*+$/g, "")
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
  if (/^[\t\r]/.test(val)) return true;
  const t = val.trim();
  if (!t) return false;
  if (t.startsWith("=") || t.startsWith("+") || t.startsWith("@")) {
    return true;
  }
  if (t.startsWith("-")) {
    if (isMultilineText) {
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
  if (lower === "true" || lower === "yes" || lower === "y" || lower === "1" || lower === "예") {
    return { valid: true, value: true };
  }
  if (lower === "false" || lower === "no" || lower === "n" || lower === "0" || lower === "아니오") {
    return { valid: true, value: false };
  }
  return { valid: false, value: false };
}

function parseYesNoFlag(
  val: string
): { valid: boolean; value: "Y" | null } {
  if (!val) return { valid: true, value: null };
  const lower = val.trim().toLowerCase();
  if (lower === "y" || lower === "yes" || lower === "true" || lower === "1" || lower === "예") {
    return { valid: true, value: "Y" };
  }
  if (lower === "n" || lower === "no" || lower === "false" || lower === "0" || lower === "아니오") {
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
      error: "지원하지 않는 파일 형식입니다. .xlsx 형식의 Excel 파일만 업로드할 수 있습니다.",
    };
  }

  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (uint8.byteLength === 0) {
    return {
      success: false,
      error: "업로드된 Excel 파일이 비어 있습니다.",
    };
  }
  if (uint8.byteLength > BULK_IMPORT_MAX_FILE_BYTES) {
    return {
      success: false,
      error: "파일 크기가 허용 한도(10 MB)를 초과했습니다.",
    };
  }
  if (!hasValidZipHeader(uint8)) {
    return {
      success: false,
      error: "유효한 .xlsx 파일 구조가 아닙니다. 공식 Excel 양식을 다운로드하여 사용해 주세요.",
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
      error: ".xlsx 파일을 읽을 수 없습니다. 파일이 손상되었거나 암호가 설정되어 있지 않은지 확인해 주세요.",
    };
  }

  const productsSheetName = workbook.SheetNames.find(
    (n) => n.trim().toLowerCase() === "products"
  );
  if (!productsSheetName) {
    return {
      success: false,
      error: `필수 시트("Products")를 찾을 수 없습니다. (현재 시트: ${workbook.SheetNames.join(", ") || "없음"})`,
    };
  }

  const sheet = workbook.Sheets[productsSheetName];
  if (!sheet || !sheet["!ref"]) {
    return {
      success: false,
      error: '"Products" 시트가 비어 있습니다.',
    };
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);

  // Build alias -> spec lookup (supports Korean-first bilingual headers, English V1 headers, and stripped '*')
  const aliasToSpec = new Map<string, BulkColumnSpec>();
  for (const spec of BULK_PRODUCT_COLUMNS) {
    aliasToSpec.set(normalizeHeaderLabel(spec.header), spec);
    aliasToSpec.set(normalizeHeaderLabel(spec.headerEn), spec);
    for (const alias of spec.aliases) {
      aliasToSpec.set(normalizeHeaderLabel(alias), spec);
    }
  }

  // Scan top rows (up to first 5 rows) to locate the column header row (supports Row 1 group banner + Row 2 headers as well as Row 1 headers)
  let headerRowIdx = range.s.r;
  let bestMatchedCount = -1;
  const maxHeaderScanRow = Math.min(range.e.r, range.s.r + 4);

  for (let candidateRow = range.s.r; candidateRow <= maxHeaderScanRow; candidateRow++) {
    let matchedInRow = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: candidateRow, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      const raw = cell ? String(cell.v ?? cell.w ?? "").trim() : "";
      if (!raw) continue;
      if (aliasToSpec.has(normalizeHeaderLabel(raw))) {
        matchedInRow += 1;
      }
    }
    if (matchedInRow > bestMatchedCount) {
      bestMatchedCount = matchedInRow;
      headerRowIdx = candidateRow;
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
        duplicateHeaders.push(spec.header.replace(/\s*\*$/, ""));
      } else {
        colIndexByKey.set(spec.key, c);
      }
    }
  }

  if (duplicateHeaders.length > 0) {
    return {
      success: false,
      error: `"Products" 시트에 중복된 컬럼 헤더가 있습니다: ${duplicateHeaders.join(", ")}`,
    };
  }

  const missingRequiredHeaders = BULK_PRODUCT_COLUMNS.filter(
    (s) => s.required && !colIndexByKey.has(s.key)
  ).map((s) => s.header.replace(/\s*\*$/, ""));

  if (missingRequiredHeaders.length > 0) {
    return {
      success: false,
      error: `"Products" 시트에 필수 컬럼 헤더가 누락되었습니다: ${missingRequiredHeaders.join(", ")}`,
    };
  }

  // Extract non-empty rows after headerRowIdx to check row limits & example row skipping
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
        formulaHeaders.push(spec.header.replace(/\s*\*$/, ""));
        hasAnyNonEmpty = true;
      } else if (value !== "") {
        hasAnyNonEmpty = true;
      }
    }

    if (!hasAnyNonEmpty) continue;

    // Auto-skip template example row if left unchanged by supplier
    const skuUpper = values.manufactureSku.trim().toUpperCase();
    const nameEnUpper = values.productNameEn.trim().toUpperCase();
    const nameKoTrimmed = values.productNameKo.trim();
    if (
      skuUpper === BULK_TEMPLATE_EXAMPLE_SKU ||
      nameEnUpper.startsWith("[EXAMPLE") ||
      values.productNameEn.trim().startsWith("[예시") ||
      nameKoTrimmed.startsWith("[예시")
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
        error: `1회 업로드당 최대 ${BULK_IMPORT_MAX_ROWS}개 상품까지만 등록할 수 있습니다. ${BULK_IMPORT_MAX_ROWS}개 이하로 나누어 업로드해 주세요.`,
      };
    }
  }

  if (extractedRows.length === 0) {
    return {
      success: false,
      error:
        exampleRowsSkipped > 0
          ? `등록할 상품 데이터가 없습니다 ("Products" 시트에 예시 행 ${BULK_TEMPLATE_EXAMPLE_SKU}만 포함되어 있습니다). 최소 1개 이상의 상품을 입력해 주세요.`
          : '"Products" 시트에 등록할 상품 데이터가 없습니다.',
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

  // Track first-seen in-file identifiers
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
        `Excel 수식은 허용되지 않습니다 (${formulaHeaders.join(", ")}).`,
        "수식 대신 순수 텍스트 또는 숫자 값('값 붙여넣기')으로 입력해 주세요."
      );
    }

    for (const spec of BULK_PRODUCT_COLUMNS) {
      const rawVal = values[spec.key];
      if (!rawVal) continue;
      if (NUMERIC_FIELD_KEYS.has(spec.key)) continue;
      const isMulti = MULTILINE_TEXT_KEYS.has(spec.key);
      if (hasFormulaInjectionPrefix(rawVal, isMulti)) {
        const cleanCol = spec.header.replace(/\s*\*$/, "");
        addValidationError(
          `"${cleanCol}" 항목이 제한된 수식 문자(=, +, -, @)로 시작합니다.`,
          `"${cleanCol}" 값 앞의 '=', '+', '-', '@' 문자를 제거해 주세요.`
        );
      }
    }

    // 1. Brand (Required)
    let resolvedBrand: BulkReferenceBrand | null = null;
    const rawBrand = values.brand.trim();
    if (!rawBrand) {
      addValidationError(
        "브랜드(Brand)는 필수 입력 항목입니다.",
        "Brands 시트에 안내된 귀사의 활성 브랜드명을 입력해 주세요."
      );
    } else {
      const lowerBrand = rawBrand.toLowerCase();
      const activeMatch = activeBrandByLowerName.get(lowerBrand);
      if (activeMatch) {
        resolvedBrand = activeMatch;
      } else if (inactiveBrandByLowerName.has(lowerBrand)) {
        addValidationError(
          `브랜드 "${rawBrand}"은(는) 현재 비활성 상태입니다.`,
          "활성 상태인 브랜드를 선택하거나 브랜드를 먼저 활성화해 주세요."
        );
      } else {
        addValidationError(
          `브랜드 "${rawBrand}"은(는) 귀사 소속이 아니거나 존재하지 않는 브랜드입니다.`,
          "양식의 Brands 시트에 표시된 정확한 활성 브랜드명을 입력해 주세요."
        );
      }
    }

    // 2. Manufacturer SKU (Required)
    const rawSku = values.manufactureSku.trim();
    let normalizedSku = "";
    if (!rawSku) {
      addValidationError(
        "제조사 SKU(Manufacturer SKU)는 필수 입력 항목입니다.",
        "영문, 숫자, 하이픈(-), 언더스코어(_)를 사용하여 고유한 제조사 SKU를 입력해 주세요."
      );
    } else if (rawSku.length > 100) {
      addValidationError(
        "제조사 SKU는 최대 100자까지 입력할 수 있습니다.",
        "제조사 SKU를 100자 이내로 줄여 주세요."
      );
    } else if (isDraftPlaceholderSku(rawSku.toUpperCase())) {
      addValidationError(
        `제조사 SKU "${rawSku}"은(는) 시스템 예약 접두어(DRAFT-SKU-)를 사용할 수 없습니다.`,
        "실제 제조사 SKU 코드를 입력해 주세요."
      );
    } else if (!/^[A-Za-z0-9]+(?:[\-_][A-Za-z0-9]+)*$/.test(rawSku)) {
      addValidationError(
        `제조사 SKU 형식이 올바르지 않습니다 ("${rawSku}"). 영문, 숫자 및 단어 사이의 단일 '-' 또는 '_'만 허용됩니다.`,
        "공백이나 특수문자 없이 영문/숫자 및 '-' 또는 '_' 조합으로 입력해 주세요 (예: KSN-TONER-200ML)."
      );
    } else {
      normalizedSku = rawSku.toUpperCase();
      if (normalizedSku !== rawSku) {
        warnings.push(`제조사 SKU가 대문자("${normalizedSku}")로 자동 변환됩니다.`);
      }

      if (ctx.existingCompanySkus.has(normalizedSku)) {
        addDuplicateError(
          `제조사 SKU "${normalizedSku}"은(는) 이미 등록된 상품입니다.`,
          "기존 SKU는 덮어쓰지 않습니다. 해당 행을 제외하거나 새로운 고유 SKU를 입력해 주세요."
        );
      } else {
        const prev = seenSkuFirstRowIndex.get(normalizedSku);
        if (prev) {
          addDuplicateError(
            `파일 내 제조사 SKU "${normalizedSku}" 중복 (${prev.excelRowNumber}행과 동일).`,
            `${prev.excelRowNumber}행과 중복된 행을 삭제하거나 서로 다른 제조사 SKU를 지정해 주세요.`
          );
          const firstRow = validatedRows[prev.arrayIdx];
          if (firstRow && firstRow.status !== "INVALID") {
            const note = `동일한 SKU("${normalizedSku}")가 ${excelRowNumber}행에도 중복 입력되어 ${excelRowNumber}행은 제외됩니다.`;
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
        "영문 제품명(Product Name EN)은 필수 입력 항목입니다.",
        "공식 영문 제품명을 입력해 주세요."
      );
    } else if (rawNameEn.length > 300) {
      addValidationError(
        "영문 제품명은 최대 300자까지 입력할 수 있습니다.",
        "영문 제품명을 300자 이내로 입력해 주세요."
      );
    } else if (isDraftPlaceholderName(rawNameEn)) {
      addValidationError(
        "영문 제품명에 시스템 임시 제목을 사용할 수 없습니다.",
        "실제 영문 제품명을 입력해 주세요."
      );
    }

    if (rawNameKo.length > 300) {
      addValidationError(
        "국문 제품명은 최대 300자까지 입력할 수 있습니다.",
        "국문 제품명을 300자 이내로 입력해 주세요."
      );
    } else if (rawNameKo && isDraftPlaceholderName(rawNameKo)) {
      addValidationError(
        "국문 제품명에 시스템 임시 제목을 사용할 수 없습니다.",
        "실제 국문 제품명을 입력하거나 비워 두세요."
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
        "카테고리 (1Depth)는 필수 입력 항목입니다.",
        "Categories 시트에서 유효한 1Depth 카테고리를 선택해 주세요 (예: Skincare, 스킨케어)."
      );
    } else if (hasCategoryMaster) {
      const aliasCode = LEGACY_DEPTH1_ALIASES[rawCat1.toLowerCase()];
      const matchedD1 = aliasCode
        ? catByCode.get(aliasCode) || matchCategoryInList(rawCat1, depth1All)
        : matchCategoryInList(rawCat1, depth1All);

      if (!matchedD1) {
        addValidationError(
          `유효하지 않은 카테고리 (1Depth) 값입니다: "${rawCat1}".`,
          "Categories 시트에 안내된 1Depth 코드 또는 명칭을 입력해 주세요."
        );
      } else if (!matchedD1.is_active) {
        addValidationError(
          `카테고리 (1Depth) "${matchedD1.name_ko || matchedD1.name_en || matchedD1.code}"은(는) 비활성 상태입니다.`,
          "Categories 시트에서 활성 상태인 1Depth 카테고리를 선택해 주세요."
        );
      } else {
        resolvedCategoryEnum = resolveRootCategoryEnum(matchedD1.code);
        resolvedCategoryCode = matchedD1.code;
        const pathParts = [matchedD1.name_ko || matchedD1.name_en || matchedD1.code];

        if (!rawCat2 && rawCat3) {
          addValidationError(
            "카테고리 (3Depth) 입력 시 상위 카테고리 (2Depth)도 함께 입력해야 합니다.",
            "해당 3Depth의 상위 2Depth 카테고리를 입력하거나 3Depth를 비워 두세요."
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
                `카테고리 (2Depth) "${rawCat2}"은(는) "${matchedD1.name_en || matchedD1.code}" 하위가 아닙니다 ("${actualParent?.name_en || otherParentD2.parent_code}" 소속).`,
                "Categories 시트에서 동일한 상위·하위 계층의 카테고리를 입력해 주세요."
              );
            } else {
              addValidationError(
                `"${matchedD1.name_en || matchedD1.code}" 하위에 유효하지 않은 카테고리 (2Depth) 값입니다: "${rawCat2}".`,
                "Categories 시트에서 정확한 2Depth 코드 또는 명칭을 확인해 주세요."
              );
            }
          } else if (!matchedD2.is_active) {
            addValidationError(
              `카테고리 (2Depth) "${matchedD2.name_ko || matchedD2.name_en || matchedD2.code}"은(는) 비활성 상태입니다.`,
              "활성 상태인 2Depth 카테고리를 선택해 주세요."
            );
          } else {
            resolvedCategoryCode = matchedD2.code;
            pathParts.push(matchedD2.name_ko || matchedD2.name_en || matchedD2.code);

            if (rawCat3) {
              const childrenD3 = depth3All.filter((c) => c.parent_code === matchedD2.code);
              if (matchedD2.is_final && childrenD3.length === 0) {
                addValidationError(
                  `카테고리 (2Depth) "${matchedD2.name_en || matchedD2.code}"은(는) 하위 3Depth가 없는 최종 카테고리입니다.`,
                  "카테고리 (3Depth) 칸을 비워 두세요."
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
                      `카테고리 (3Depth) "${rawCat3}"은(는) "${matchedD2.name_en || matchedD2.code}" 하위가 아닙니다 ("${actualP2?.name_en || otherParentD3.parent_code}" 소속).`,
                      "선택한 2Depth 카테고리에 속하는 3Depth 값을 입력해 주세요."
                    );
                  } else {
                    addValidationError(
                      `"${matchedD2.name_en || matchedD2.code}" 하위에 유효하지 않은 카테고리 (3Depth) 값입니다: "${rawCat3}".`,
                      "Categories 시트에서 정확한 3Depth 코드 또는 명칭을 확인해 주세요."
                    );
                  }
                } else if (!matchedD3.is_active) {
                  addValidationError(
                    `카테고리 (3Depth) "${matchedD3.name_ko || matchedD3.name_en || matchedD3.code}"은(는) 비활성 상태입니다.`,
                    "활성 상태인 3Depth 카테고리를 선택해 주세요."
                  );
                } else {
                  resolvedCategoryCode = matchedD3.code;
                  pathParts.push(matchedD3.name_ko || matchedD3.name_en || matchedD3.code);
                }
              }
            }
          }
        }

        normalizedCategoryPath = pathParts.join(" > ");
      }
    } else {
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
          `유효하지 않은 카테고리 (1Depth) 값입니다: "${rawCat1}".`,
          "Skincare, Hair Care, Beauty Tools, Body Care, Personal Care, Makeup, Sets & Collections, Other 중 하나를 입력해 주세요."
        );
      }
      if (rawCat2 || rawCat3) {
        addValidationError(
          "현재 환경에서 2Depth / 3Depth 카테고리 마스터 정보를 사용할 수 없습니다.",
          "2Depth 및 3Depth 항목을 비워 두세요."
        );
      }
    }

    // 5. Volume Value & Volume Unit
    let resolvedVolume: string | null = null;
    const rawVolVal = values.volumeValue.trim();
    const rawVolUnit = values.volumeUnit.trim();
    if (rawVolVal && !rawVolUnit) {
      addValidationError(
        "용량 수치 입력 시 용량 단위(Volume Unit)도 함께 입력해야 합니다.",
        "용량 단위(ml, L, g, kg, mg, oz, fl oz, ea / pcs, Other)를 선택해 주세요."
      );
    } else if (!rawVolVal && rawVolUnit) {
      addValidationError(
        "용량 단위 지정 시 용량 수치(Volume Value)도 함께 입력해야 합니다.",
        "용량 수치를 입력하거나 용량 단위를 비워 두세요."
      );
    } else if (rawVolVal && rawVolUnit) {
      const normUnit = normalizeVolumeUnit(rawVolUnit);
      if (!normUnit) {
        addValidationError(
          `허용되지 않는 용량 단위입니다: "${rawVolUnit}".`,
          "ml, L, g, kg, mg, oz, fl oz, ea / pcs, Other 중 하나를 입력해 주세요."
        );
      } else if (normUnit === "Other") {
        if (rawVolVal.length > 50) {
          addValidationError(
            "용량 수치는 최대 50자까지 입력할 수 있습니다.",
            "사용자 정의 용량 표기를 50자 이내로 입력해 주세요."
          );
        } else {
          resolvedVolume = formatVolume(rawVolVal, normUnit);
        }
      } else {
        const parsedVol = parsePositiveDecimal(rawVolVal);
        if (!parsedVol.valid) {
          addValidationError(
            `용량 수치("${rawVolVal}")는 0보다 큰 숫자여야 합니다 (단위: ${normUnit}).`,
            "양수 숫자(예: 200)를 입력하거나 단위를 Other로 변경해 주세요."
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
          `유효하지 않은 제조국(Country of Origin)입니다: "${rawOrigin}".`,
          "Countries 시트의 표준 영문 국가명 또는 ISO 코드(예: South Korea, KR)를 입력하거나 비워 두세요."
        );
      } else {
        resolvedOrigin = formatCanonicalCountryName(rawOrigin);
        if (resolvedOrigin.toLowerCase() !== rawOrigin.toLowerCase()) {
          warnings.push(`제조국이 표준 명칭("${resolvedOrigin}")으로 자동 변환됩니다.`);
        }
      }
    }

    // 7. Lead Time Value & Unit
    let resolvedLeadTime: string | null = null;
    const rawLtVal = values.leadTimeValue.trim();
    const rawLtUnit = values.leadTimeUnit.trim();
    if (rawLtVal && !rawLtUnit) {
      addValidationError(
        "리드타임 수치 입력 시 리드타임 단위(Lead Time Unit)도 함께 입력해야 합니다.",
        "리드타임 단위로 Days(일), Weeks(주), Months(개월) 중 하나를 입력해 주세요."
      );
    } else if (!rawLtVal && rawLtUnit) {
      addValidationError(
        "리드타임 단위 지정 시 리드타임 수치(Lead Time Value)도 함께 입력해야 합니다.",
        "양의 정수로 리드타임 수치를 입력하거나 단위를 비워 두세요."
      );
    } else if (rawLtVal && rawLtUnit) {
      const parsedLt = parsePositiveInteger(rawLtVal, 3650);
      const normLtUnit = normalizeLeadTimeUnit(rawLtUnit);
      if (!parsedLt.valid) {
        addValidationError(
          `리드타임 수치("${rawLtVal}")는 1 이상의 정수여야 합니다.`,
          "1 이상의 자연수(예: 14)를 입력해 주세요."
        );
      }
      if (!normLtUnit) {
        addValidationError(
          `허용되지 않는 리드타임 단위입니다: "${rawLtUnit}".`,
          "Days, Weeks, Months (또는 일, 주, 개월) 중 하나를 입력해 주세요."
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
        "색상명(Color)은 최대 100자까지 입력할 수 있습니다.",
        "색상명을 100자 이내로 입력해 주세요."
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
          `허용되지 않는 색상 계열(Color Map)입니다: "${rawColorMap}".`,
          `Allowed_Values 시트의 표준 색상 계열 중 하나를 선택해 주세요 (${ALLOWED_COLOR_MAPS.join(", ")}).`
        );
      } else {
        resolvedColorMap = matchedCm;
      }
    }

    // 9. Description, Bullet Points 1-5, How to Use, Ingredients
    const rawDescription = values.description.trim();
    if (rawDescription.length > 5000) {
      addValidationError(
        "상품 설명(Description)은 최대 5,000자까지 입력할 수 있습니다.",
        "상품 설명을 5,000자 이내로 줄여 주세요."
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
            `핵심 포인트 ${bIdx + 1}(Bullet Point ${bIdx + 1})은(는) 최대 500자까지 입력할 수 있습니다.`,
            `핵심 포인트 ${bIdx + 1}을(를) 500자 이내로 줄여 주세요.`
          );
        } else {
          bulletPoints.push(bVal);
        }
      }
    });

    const rawHowToUse = values.howToUse.trim();
    if (rawHowToUse.length > 5000) {
      addValidationError(
        "사용 방법(How to Use)은 최대 5,000자까지 입력할 수 있습니다.",
        "사용 방법을 5,000자 이내로 줄여 주세요."
      );
    }

    const rawIngredients = values.ingredients.trim();
    if (rawIngredients.length > 10000) {
      addValidationError(
        "전성분(Ingredients)은 최대 10,000자까지 입력할 수 있습니다.",
        "전성분 텍스트를 10,000자 이내로 줄여 주세요."
      );
    }

    // 10. Parent SKU & Child SKU
    const parsedParent = parseYesNoFlag(values.parentSku);
    const parsedChild = parseYesNoFlag(values.childSku);
    if (!parsedParent.valid) {
      addValidationError(
        `상위 SKU 여부(Parent SKU) 값이 올바르지 않습니다: "${values.parentSku}".`,
        "Y 또는 N으로 입력하거나 비워 두세요."
      );
    }
    if (!parsedChild.valid) {
      addValidationError(
        `하위 SKU 여부(Child SKU) 값이 올바르지 않습니다: "${values.childSku}".`,
        "Y 또는 N으로 입력하거나 비워 두세요."
      );
    }
    if (parsedParent.value === "Y" && parsedChild.value === "Y") {
      addValidationError(
        "상위 SKU(Parent SKU)와 하위 SKU(Child SKU)를 동시에 Y로 설정할 수 없습니다.",
        "둘 중 하나만 Y로 설정하거나 모두 N으로 입력해 주세요."
      );
    }

    // 11. Barcodes (UPC 12 digits, EAN 13 digits + uniqueness)
    const rawUpc = values.upc.trim();
    let resolvedUpc: string | null = null;
    if (rawUpc) {
      if (!/^\d{12}$/.test(rawUpc)) {
        addValidationError(
          `유효하지 않은 UPC 바코드입니다 ("${rawUpc}"). 선행 0을 포함한 정확히 12자리 숫자여야 합니다.`,
          "UPC 열을 텍스트(@) 서식으로 유지하고 12자리 숫자만 입력해 주세요 (예: 012345678905)."
        );
      } else if (ctx.existingUpcs.has(rawUpc)) {
        addDuplicateError(
          `UPC 바코드 "${rawUpc}"은(는) 이미 등록된 상품에서 사용 중입니다.`,
          "중복되지 않는 고유한 12자리 UPC 바코드를 입력해 주세요."
        );
      } else {
        const prevUpc = seenUpcFirstRowIndex.get(rawUpc);
        if (prevUpc) {
          addDuplicateError(
            `파일 내 UPC 바코드 "${rawUpc}" 중복 (${prevUpc.excelRowNumber}행과 동일).`,
            `${prevUpc.excelRowNumber}행과 중복되지 않도록 고유한 UPC 바코드를 입력해 주세요.`
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
          `유효하지 않은 EAN 바코드입니다 ("${rawEan}"). 선행 0을 포함한 정확히 13자리 숫자여야 합니다.`,
          "EAN 열을 텍스트(@) 서식으로 유지하고 13자리 숫자만 입력해 주세요 (예: 8801234567890)."
        );
      } else if (ctx.existingEans.has(rawEan)) {
        addDuplicateError(
          `EAN 바코드 "${rawEan}"은(는) 이미 시스템에 등록되어 있습니다.`,
          "중복되지 않는 고유한 13자리 EAN 바코드를 입력해 주세요."
        );
      } else {
        const prevEan = seenEanFirstRowIndex.get(rawEan);
        if (prevEan) {
          addDuplicateError(
            `파일 내 EAN 바코드 "${rawEan}" 중복 (${prevEan.excelRowNumber}행과 동일).`,
            `${prevEan.excelRowNumber}행과 중복되지 않도록 고유한 EAN 바코드를 입력해 주세요.`
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
        `온라인 판매 여부(Selling Online) 값이 올바르지 않습니다: "${values.sellingOnline}".`,
        "TRUE 또는 FALSE (또는 Y/N)로 입력해 주세요."
      );
    }
    if (!parsedOffline.valid) {
      addValidationError(
        `오프라인 판매 여부(Selling Offline) 값이 올바르지 않습니다: "${values.sellingOffline}".`,
        "TRUE 또는 FALSE (또는 Y/N)로 입력해 주세요."
      );
    }

    const rawLink1 = values.salesLink1.trim();
    const rawLink2 = values.salesLink2.trim();
    if (rawLink1) {
      if (rawLink1.length > 1000 || !isValidHttpUrl(rawLink1)) {
        addValidationError(
          `온라인 판매 링크 1(Sales Link 1) URL 형식이 올바르지 않습니다: "${rawLink1}".`,
          "http:// 또는 https://로 시작하는 전체 URL을 입력해 주세요."
        );
      }
    }
    if (rawLink2) {
      if (rawLink2.length > 1000 || !isValidHttpUrl(rawLink2)) {
        addValidationError(
          `온라인 판매 링크 2(Sales Link 2) URL 형식이 올바르지 않습니다: "${rawLink2}".`,
          "http:// 또는 https://로 시작하는 전체 URL을 입력해 주세요."
        );
      }
    }
    if (parsedOnline.valid && parsedOnline.value && !rawLink1) {
      addValidationError(
        "온라인 판매 여부(Selling Online)가 TRUE인 경우 온라인 판매 링크 1(Sales Link 1)은 필수입니다.",
        "온라인 판매 링크 1(https://...)을 입력하거나 온라인 판매 여부를 FALSE로 변경해 주세요."
      );
    } else if (parsedOnline.valid && !parsedOnline.value && (rawLink1 || rawLink2)) {
      warnings.push("온라인 판매 여부가 FALSE인 상태에서 판매 링크가 함께 입력되었습니다.");
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
          `소비자가 KRW("${values.retailPriceKrw}") 형식이 올바르지 않습니다. 통화기호 없는 0 이상의 정수여야 합니다.`,
          "소비자가 KRW를 숫자로만 입력해 주세요 (예: 25000)."
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
          `국내 공급가 KRW("${values.wholesalePriceKrw}") 형식이 올바르지 않습니다. 통화기호 없는 0 이상의 정수여야 합니다.`,
          "국내 공급가 KRW를 숫자로만 입력해 주세요 (예: 12500)."
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
          `예상 미국 판매가 USD("${values.estimatedRetailPriceUsd}") 형식이 올바르지 않습니다.`,
          "'$' 기호 없이 0 이상의 숫자로 입력해 주세요 (예: 24.00)."
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
          `수출 FOB 단가 USD("${values.exportFobPriceUsd}") 형식이 올바르지 않습니다.`,
          "'$' 기호 없이 0 이상의 숫자로 입력해 주세요 (예: 8.50)."
        );
      } else {
        priceUsdFob = v.value ?? null;
      }
    }

    // 14. Logistics Measurements
    const checkPositiveMeasure = (
      key: BulkRowRawFieldKey,
      label: string
    ): number | null => {
      const raw = values[key];
      if (!raw) return null;
      const res = parsePositiveDecimal(raw);
      if (!res.valid) {
        addValidationError(
          `${label} 값("${raw}")이 올바르지 않습니다. 0보다 큰 양수여야 합니다.`,
          `${label} 항목에 0보다 큰 숫자를 입력하거나 비워 두세요.`
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
          `${label} 값("${raw}")이 올바르지 않습니다. 1 이상의 자연수여야 합니다.`,
          `${label} 항목에 1 이상의 정수를 입력하거나 비워 두세요.`
        );
        return null;
      }
      return res.value;
    };

    const itemWidth = checkPositiveMeasure("itemWidth", "단품 가로(cm)");
    const itemDepth = checkPositiveMeasure("itemDepth", "단품 세로(cm)");
    const itemHeight = checkPositiveMeasure("itemHeight", "단품 높이(cm)");
    const itemWeight = checkPositiveMeasure("itemWeight", "단품 중량(g)");

    const packageWidth = checkPositiveMeasure("packageWidth", "개별포장 가로(cm)");
    const packageDepth = checkPositiveMeasure("packageDepth", "개별포장 세로(cm)");
    const packageHeight = checkPositiveMeasure("packageHeight", "개별포장 높이(cm)");
    const packageWeight = checkPositiveMeasure("packageWeight", "개별포장 중량(g)");

    const cartonPackQty = checkPositiveQty("cartonPackQty", "카톤 입수량(ea)");
    const cartonWidth = checkPositiveMeasure("cartonWidth", "카톤 가로(cm)");
    const cartonDepth = checkPositiveMeasure("cartonDepth", "카톤 세로(cm)");
    const cartonHeight = checkPositiveMeasure("cartonHeight", "카톤 높이(cm)");
    const cartonWeight = checkPositiveMeasure("cartonWeight", "카톤 중량(kg)");

    let cartonCbm: number | null = null;
    if (cartonWidth && cartonDepth && cartonHeight) {
      cartonCbm = Number(((cartonWidth * cartonDepth * cartonHeight) / 1_000_000).toFixed(5));
    }

    const palletCartonQty = checkPositiveQty("palletCartonQty", "파렛트 적재 박스수");
    const palletWidth = checkPositiveMeasure("palletWidth", "파렛트 가로(cm)");
    const palletDepth = checkPositiveMeasure("palletDepth", "파렛트 세로(cm)");
    const palletHeight = checkPositiveMeasure("palletHeight", "파렛트 높이(cm)");
    const palletWeight = checkPositiveMeasure("palletWeight", "파렛트 중량(kg)");

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
