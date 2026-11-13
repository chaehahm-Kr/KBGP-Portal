import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  BULK_PRODUCT_COLUMNS,
  COMMON_BULK_ATTRIBUTES,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkReferenceCommonAttribute,
} from "@/lib/product/bulk-import-types";
import {
  EXCEL_MULTI_SELECT_OVERWRITE_WARNING,
  EXCEL_MULTI_SELECT_PROMPT_MESSAGE,
  EXCEL_MULTI_SELECT_PROMPT_TITLE,
  EXCEL_SINGLE_SELECT_PROMPT_MESSAGE,
  EXCEL_SINGLE_SELECT_PROMPT_TITLE,
  encodeColLetter,
  generateAnnotatedErrorWorkbookBuffer,
  generateBulkProductTemplateBuffer,
} from "@/lib/product/bulk-import-template";
import { parseAndValidateBulkProductWorkbook } from "@/lib/product/bulk-import-validator";
import { isAttributeValueFilled } from "@/lib/product/attribute-completion";

const SAMPLE_BRANDS: BulkReferenceBrand[] = [
  { id: "brand-r4-1", name: "Glowella", is_active: true },
];

const SAMPLE_CATEGORIES: BulkReferenceCategory[] = [
  {
    code: "CAT_SKINCARE",
    name_ko: "스킨케어",
    name_en: "Skincare",
    depth: 1,
    parent_code: null,
    is_final: false,
    is_active: true,
    display_order: 1,
  },
  {
    code: "CAT_SKINCARE_SERUM",
    name_ko: "에센스/세럼/앰플",
    name_en: "Essence & Serum",
    depth: 2,
    parent_code: "CAT_SKINCARE",
    is_final: true,
    is_active: true,
    display_order: 1,
  },
];

const ALL_HEADERS = BULK_PRODUCT_COLUMNS.map((c) => c.header);
const colHeader = (key: string) =>
  BULK_PRODUCT_COLUMNS.find((c) => c.key === key)!.header;
const colLetterForKey = (key: string) =>
  encodeColLetter(BULK_PRODUCT_COLUMNS.findIndex((c) => c.key === key));

function buildWorkbookBytesFromObjects(
  headers: string[],
  dataRows: Array<Record<string, string>>
): Uint8Array {
  const aoa: string[][] = [
    headers,
    ...dataRows.map((obj) => headers.map((h) => obj[h] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(out);
}

describe("BRAND-PRODUCT-BULK-002-R4: Attribute Selection Normalization & Excel Input Prompts", () => {
  it("normalizes exactly 2 converted SINGLE_SELECT attributes, preserves 8 MULTI_SELECT attributes, and keeps all 86 column headers intact", () => {
    expect(BULK_PRODUCT_COLUMNS.length).toBe(86);
    expect(COMMON_BULK_ATTRIBUTES.length).toBe(23);

    const multiCodes = COMMON_BULK_ATTRIBUTES.filter(
      (a) => a.inputType === "MULTI_SELECT"
    ).map((a) => a.code);
    expect(multiCodes).toEqual([
      "STORAGE_CONDITION",
      "FORMULATION",
      "TARGET_AGE",
      "SKIN_TYPE",
      "USAGE_OCCASION",
      "APPLICATION_AREA",
      "PRIMARY_CONCERN",
      "SCENT_FAMILY",
    ]);

    const singleCodes = COMMON_BULK_ATTRIBUTES.filter(
      (a) => a.inputType === "SINGLE_SELECT"
    ).map((a) => a.code);
    expect(singleCodes).toEqual([
      "PACKAGE_FORMAT",
      "TARGET_GENDER",
      "USAGE_FREQUENCY",
      "DAILY_USE_COUNT",
      "SCENT_INTENSITY",
      "FDA_STATUS",
      "MOCRA_STATUS",
      "OTC_STATUS",
      "DRUG_FACTS_STATUS",
    ]);

    const yesNoCodes = COMMON_BULK_ATTRIBUTES.filter(
      (a) => a.inputType === "YES_NO_NA"
    ).map((a) => a.code);
    expect(yesNoCodes).toEqual(["SEALED", "REFILLABLE", "SCENTED"]);

    const numCodes = COMMON_BULK_ATTRIBUTES.filter(
      (a) => a.inputType === "NUMBER_UNIT"
    ).map((a) => a.code);
    expect(numCodes).toEqual([
      "SHELF_LIFE_MONTHS",
      "MIN_REMAINING_SHELF_LIFE",
      "PAO_MONTHS",
    ]);

    const targetGender = COMMON_BULK_ATTRIBUTES.find((a) => a.code === "TARGET_GENDER")!;
    expect(targetGender.allowNa).toBe(true);
    expect(targetGender.allowOther).toBe(false);
    expect(targetGender.header).toBe("대상 성별 (Target Gender)");

    const usageFreq = COMMON_BULK_ATTRIBUTES.find((a) => a.code === "USAGE_FREQUENCY")!;
    expect(usageFreq.allowNa).toBe(true);
    expect(usageFreq.allowOther).toBe(true);
    expect(usageFreq.header).toBe("사용 주기 (Usage Frequency)");
  });

  it("embeds exact Korean multi-select prompts ONLY on the 8 MULTI_SELECT columns, single-select prompts on all 9 SINGLE_SELECT columns, and warning/Other guidance in Instructions & Common_Attributes", async () => {
    const buf = await generateBulkProductTemplateBuffer({
      brands: SAMPLE_BRANDS,
      categories: SAMPLE_CATEGORIES,
    });
    if (process.env.R4_WRITE_ARTIFACTS_DIR) {
      fs.writeFileSync(
        path.join(process.env.R4_WRITE_ARTIFACTS_DIR, "KSN_Brand_Product_Bulk_Template_R4.xlsx"),
        Buffer.from(buf)
      );
    }

    const zip = await JSZip.loadAsync(buf);
    const sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");

    const dvRegex = /<dataValidation\b([^>]+?)>/g;
    const dvByCol = new Map<string, string>();
    let match: RegExpExecArray | null;
    while ((match = dvRegex.exec(sheet1Xml)) !== null) {
      const attrs = match[1];
      const sqrefMatch = /sqref="([A-Z]+)\d+:[A-Z]+\d+"/.exec(attrs);
      if (sqrefMatch) {
        dvByCol.set(sqrefMatch[1], attrs);
      }
    }

    const expectedMultiXmlPrompt = EXCEL_MULTI_SELECT_PROMPT_MESSAGE.replace(/\n/g, "&#10;");
    const expectedSingleXmlPrompt = EXCEL_SINGLE_SELECT_PROMPT_MESSAGE.replace(/\n/g, "&#10;");

    for (const attr of COMMON_BULK_ATTRIBUTES) {
      const colLet = colLetterForKey(attr.fieldKey);
      const rawAttrs = dvByCol.get(colLet);

      if (attr.inputType === "NUMBER_UNIT") {
        expect(rawAttrs).toBeUndefined();
      } else if (attr.inputType === "MULTI_SELECT") {
        expect(rawAttrs).toBeDefined();
        expect(rawAttrs).toContain(`promptTitle="${EXCEL_MULTI_SELECT_PROMPT_TITLE}"`);
        expect(rawAttrs).toContain(`prompt="${expectedMultiXmlPrompt}"`);
        expect(rawAttrs).toContain('showErrorMessage="0"');
      } else if (attr.inputType === "SINGLE_SELECT") {
        expect(rawAttrs).toBeDefined();
        expect(rawAttrs).toContain(`promptTitle="${EXCEL_SINGLE_SELECT_PROMPT_TITLE}"`);
        expect(rawAttrs).toContain(`prompt="${expectedSingleXmlPrompt}"`);
      } else if (attr.inputType === "YES_NO_NA") {
        expect(rawAttrs).toBeDefined();
        expect(rawAttrs).not.toContain(`promptTitle="${EXCEL_MULTI_SELECT_PROMPT_TITLE}"`);
      }
    }

    // Check Instructions & Common_Attributes text for required warning & Other custom syntax
    const wb = XLSX.read(buf, { type: "buffer" });
    const instrText = JSON.stringify(
      XLSX.utils.sheet_to_json(wb.Sheets["Instructions"], { header: 1, defval: "" })
    );
    expect(instrText).toContain(EXCEL_MULTI_SELECT_OVERWRITE_WARNING);
    expect(instrText).toContain("Other: Cool");

    const commonAttrRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Common_Attributes"], {
      header: 1,
      defval: "",
    });
    const commonAttrText = JSON.stringify(commonAttrRows);
    expect(commonAttrText).toContain(EXCEL_MULTI_SELECT_OVERWRITE_WARNING);
    expect(commonAttrText).toContain("실온 (Room Temperature); 기타: Cool");
    expect(commonAttrText).toContain("Other: Cool");

    const tgRow = commonAttrRows.find((r) => r[2] === "TARGET_GENDER")!;
    expect(tgRow[3]).toContain("단일 선택");
    const ufRow = commonAttrRows.find((r) => r[2] === "USAGE_FREQUENCY")!;
    expect(ufRow[3]).toContain("단일 선택");
    expect(ufRow[4]).toContain("기타 직접입력 가능");
  });

  it("rejects legacy semicolon multi-value inputs on TARGET_GENDER and USAGE_FREQUENCY without silent truncation, supports Other: on USAGE_FREQUENCY, normalizes/deduplicates MULTI_SELECT, and round-trips via Annotated Error Workbook", async () => {
    const legacyBytes = buildWorkbookBytesFromObjects(ALL_HEADERS, [
      {
        // Row 2: Legacy multi-value on both converted fields -> must fail explicitly
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "R4-LEGACY-MULTI",
        [colHeader("productNameEn")]: "Legacy Multi Gender & Frequency",
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("attrTargetGender")]: "여성 (Women); 남성 (Men)",
        [colHeader("attrUsageFrequency")]: "매일 (Daily); 필요 시 (As Needed)",
      },
      {
        // Row 3: Valid single-select + custom Other on USAGE_FREQUENCY + deduplicated/trimmed MULTI_SELECT
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "R4-VALID-SINGLE-01",
        [colHeader("productNameEn")]: "Normalized Single & Multi Serum",
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("category2Depth")]: "에센스/세럼/앰플 (Essence & Serum)",
        [colHeader("attrTargetGender")]: "남녀 공용 (Unisex)",
        [colHeader("attrUsageFrequency")]: "기타: 격일 저녁 사용",
        [colHeader("attrSkinType")]:
          "  건성 (Dry Skin) ;  민감성 (Sensitive Skin) ; 건성 (Dry Skin)  ",
        [colHeader("attrStorageCondition")]: "실온 (Room Temperature); 기타: Cool",
      },
      {
        // Row 4: Disallowed Other on TARGET_GENDER (allow_other = false)
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "R4-DISALLOWED-OTHER",
        [colHeader("productNameEn")]: "Gender Other Attempt",
        [colHeader("category1Depth")]: "Skincare",
        [colHeader("attrTargetGender")]: "Other: Custom Gender",
      },
    ]);

    const preview = parseAndValidateBulkProductWorkbook({
      fileName: "r4-legacy-check.xlsx",
      buffer: legacyBytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(preview.success).toBe(true);
    expect(preview.summary?.validRows).toBe(1);
    expect(preview.summary?.invalidRows).toBe(2);

    // Row 2 has 2 explicit Korean single-select multi-value errors (never truncated!)
    const legacyRow = preview.rows![0];
    expect(legacyRow.status).toBe("INVALID");
    expect(legacyRow.errorDetails.length).toBe(2);
    expect(legacyRow.errorDetails[0].fieldKey).toBe("attrTargetGender");
    expect(legacyRow.errorDetails[0].reason).toContain("단일 선택 항목");
    expect(legacyRow.errorDetails[1].fieldKey).toBe("attrUsageFrequency");
    expect(legacyRow.errorDetails[1].reason).toContain("단일 선택 항목");

    // Row 3 canonical EAV persistence representation
    const validAttrs = preview.rows![1].payload!.common_attributes;
    expect(validAttrs.find((a) => a.attribute_code === "TARGET_GENDER")).toEqual({
      attribute_code: "TARGET_GENDER",
      value_json: "UNISEX",
      text_value: null,
    });
    expect(validAttrs.find((a) => a.attribute_code === "USAGE_FREQUENCY")).toEqual({
      attribute_code: "USAGE_FREQUENCY",
      value_json: "OTHER",
      text_value: "격일 저녁 사용",
    });
    expect(validAttrs.find((a) => a.attribute_code === "SKIN_TYPE")).toEqual({
      attribute_code: "SKIN_TYPE",
      value_json: ["DRY", "SENSITIVE"],
      text_value: null,
    });
    expect(validAttrs.find((a) => a.attribute_code === "STORAGE_CONDITION")).toEqual({
      attribute_code: "STORAGE_CONDITION",
      value_json: ["ROOM_TEMP", "OTHER"],
      text_value: "Cool",
    });

    // Completeness evaluator handles canonical scalar strings, NA, NOT_APPLICABLE, and 1-element arrays
    expect(isAttributeValueFilled("SINGLE_SELECT", "UNISEX")).toBe(true);
    expect(isAttributeValueFilled("SINGLE_SELECT", "NOT_APPLICABLE")).toBe(true);
    expect(isAttributeValueFilled("SINGLE_SELECT", "NA")).toBe(true);
    expect(isAttributeValueFilled("SINGLE_SELECT", ["UNISEX"])).toBe(true);
    expect(isAttributeValueFilled("SINGLE_SELECT", "")).toBe(false);

    // Generate Annotated Error Workbook & verify R4 prompts + clean round-trip after fixing errors
    const annotatedBuf = await generateAnnotatedErrorWorkbookBuffer({
      brands: SAMPLE_BRANDS,
      categories: SAMPLE_CATEGORIES,
      preview,
    });
    const annotatedZip = await JSZip.loadAsync(annotatedBuf);
    const annotatedSheet1Xml = await annotatedZip
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    if (process.env.R4_WRITE_ARTIFACTS_DIR) {
      fs.writeFileSync(
        path.join(process.env.R4_WRITE_ARTIFACTS_DIR, "KSN_Bulk_Annotated_Error_Sample_R4.xlsx"),
        Buffer.from(annotatedBuf)
      );
    }
    expect(annotatedSheet1Xml).toContain(`promptTitle="${EXCEL_MULTI_SELECT_PROMPT_TITLE}"`);
    expect(annotatedSheet1Xml).toContain(`promptTitle="${EXCEL_SINGLE_SELECT_PROMPT_TITLE}"`);

    const wb = XLSX.read(annotatedBuf, { type: "buffer" });
    const ws = wb.Sheets["Products"];
    const tgColIdx = BULK_PRODUCT_COLUMNS.findIndex((c) => c.key === "attrTargetGender");
    const ufColIdx = BULK_PRODUCT_COLUMNS.findIndex((c) => c.key === "attrUsageFrequency");
    // Row 2 (r=1) & Row 4 (r=3) in simple 1-header layout
    ws[XLSX.utils.encode_cell({ r: 1, c: tgColIdx })] = { t: "s", v: "여성 (Women)" };
    ws[XLSX.utils.encode_cell({ r: 1, c: ufColIdx })] = { t: "s", v: "매일 (Daily)" };
    ws[XLSX.utils.encode_cell({ r: 3, c: tgColIdx })] = { t: "s", v: "해당 없음 (Not Applicable)" };

    const fixedBytes = new Uint8Array(
      XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
    );
    const revalidated = parseAndValidateBulkProductWorkbook({
      fileName: "r4-fixed.xlsx",
      buffer: fixedBytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });
    expect(revalidated.success).toBe(true);
    expect(revalidated.summary?.invalidRows).toBe(0);
    expect(revalidated.summary?.validRows).toBe(3);
  });

  it("honors authoritative public.attributes.input_type dynamically in both Template and Validator (zero UI/DB split-brain)", async () => {
    const preMigrationLiveAttrs: BulkReferenceCommonAttribute[] = COMMON_BULK_ATTRIBUTES.map(
      (a) => ({
        code: a.code,
        nameKo: a.nameKo,
        nameEn: a.nameEn,
        inputType:
          a.code === "TARGET_GENDER" || a.code === "USAGE_FREQUENCY"
            ? "MULTI_SELECT"
            : a.inputType,
        isMultiple:
          a.code === "TARGET_GENDER" ||
          a.code === "USAGE_FREQUENCY" ||
          a.inputType === "MULTI_SELECT",
        unitSet: a.unitSet,
        allowNa: a.allowNa,
        allowOther: a.allowOther,
        brandEditable: true,
        adminOnly: false,
        isActive: true,
        options: a.options.map((o, i) => ({
          optionCode: o.optionCode,
          optionKo: o.optionKo,
          optionEn: o.optionEn,
          displayOrder: i + 1,
        })),
      })
    );

    const preBuf = await generateBulkProductTemplateBuffer({
      brands: SAMPLE_BRANDS,
      categories: SAMPLE_CATEGORIES,
      commonAttributes: preMigrationLiveAttrs,
    });
    const preWb = XLSX.read(preBuf, { type: "buffer" });
    const preCommonRows = XLSX.utils.sheet_to_json<string[]>(preWb.Sheets["Common_Attributes"], {
      header: 1,
      defval: "",
    });
    const preTg = preCommonRows.find((r) => r[2] === "TARGET_GENDER")!;
    expect(preTg[3]).toContain("Multi Select");
  });
});
