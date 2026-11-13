import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  BULK_ERROR_CATEGORY_LABELS_KO,
  BULK_PRODUCT_COLUMNS,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
} from "@/lib/product/bulk-import-types";
import {
  generateAnnotatedErrorWorkbookBuffer,
  generateBulkProductTemplateBuffer,
} from "@/lib/product/bulk-import-template";
import {
  parseAndValidateBulkProductWorkbook,
  parseOtherFreeTextToken,
} from "@/lib/product/bulk-import-validator";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { formatBilingualOptionLabel } from "@/components/product/attribute-select-dropdown";

const SAMPLE_BRANDS: BulkReferenceBrand[] = [
  { id: "brand-uuid-1", name: "Glowella", is_active: true },
  { id: "brand-uuid-2", name: "PureLeaf", is_active: true },
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
    code: "CAT_MAKEUP",
    name_ko: "메이크업",
    name_en: "Makeup",
    depth: 1,
    parent_code: null,
    is_final: false,
    is_active: true,
    display_order: 2,
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
  {
    code: "CAT_MAKEUP_LIP",
    name_ko: "립 메이크업",
    name_en: "Lip Makeup",
    depth: 2,
    parent_code: "CAT_MAKEUP",
    is_final: true,
    is_active: true,
    display_order: 1,
  },
];

const ALL_HEADERS = BULK_PRODUCT_COLUMNS.map((c) => c.header);
const colHeader = (key: string) =>
  BULK_PRODUCT_COLUMNS.find((c) => c.key === key)!.header;

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

describe("BRAND-PRODUCT-BULK-002-R3: Bilingual Labels, Custom Values & Multi-Select Coverage", () => {
  it("formats Korean (English) labels cleanly without inventing translations when only one language exists", () => {
    expect(formatBilingualOptionLabel("실온", "Room Temperature", "ROOM_TEMP")).toBe(
      "실온 (Room Temperature)"
    );

    expect(formatBilingualOptionLabel("튜브", "Tube", "TUBE")).toBe("튜브 (Tube)");

    expect(formatBilingualOptionLabel("크림", "Cream", "CREAM")).toBe("크림 (Cream)");

    expect(formatBilingualOptionLabel("건성", "Dry Skin", "DRY")).toBe(
      "건성 (Dry Skin)"
    );

    // Single-language preservation (no fabricated translation)
    expect(formatBilingualOptionLabel("단독국문옵션", null, "ONLY_KO")).toBe(
      "단독국문옵션"
    );

    expect(formatBilingualOptionLabel("", "White", "WHITE")).toBe("White");
  });

  it("parses Other/기타 custom syntax, maps to canonical OTHER + text_value, supports Usage Occasion & Application Area multi-select, and rejects bare unknown or disallowed custom values", () => {
    expect(parseOtherFreeTextToken("Other: Cool")).toEqual({
      isOtherPrefix: true,
      customText: "Cool",
    });
    expect(parseOtherFreeTextToken("기타: Cool")).toEqual({
      isOtherPrefix: true,
      customText: "Cool",
    });
    expect(parseOtherFreeTextToken("기타 (Other): Cool")).toEqual({
      isOtherPrefix: true,
      customText: "Cool",
    });
    expect(parseOtherFreeTextToken("Cool")).toEqual({
      isOtherPrefix: false,
      customText: "",
    });

    const bytes = buildWorkbookBytesFromObjects(ALL_HEADERS, [
      {
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "R3-OTHER-OK-01",
        [colHeader("productNameEn")]: "Custom Storage & Multi-Select Serum",
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("category2Depth")]: "에센스/세럼/앰플 (Essence & Serum)",
        [colHeader("attrStorageCondition")]: "실온 (Room Temperature); Other: Cool",
        [colHeader("attrPackageFormat")]: "기타: Airless Glass Tube",
        [colHeader("attrUsageOccasion")]:
          "세안 후 (After Cleansing); 취침 전 (Before Bed); 기타: 운동 전",
        [colHeader("attrApplicationArea")]:
          "얼굴 (Face); 눈가 (Eye Area); 입술 (Lips); 얼굴 (Face)",
      },
      {
        // Bare unknown value must NOT silently convert into Other
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "R3-BARE-UNKNOWN",
        [colHeader("productNameEn")]: "Bare Cool Rejected",
        [colHeader("category1Depth")]: "Skincare",
        [colHeader("attrStorageCondition")]: "Cool",
      },
      {
        // Closed regulatory / non-allowOther enums must reject Other: custom values
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "R3-CLOSED-ENUM",
        [colHeader("productNameEn")]: "Closed Regulatory Rejected",
        [colHeader("category1Depth")]: "Skincare",
        [colHeader("attrFdaStatus")]: "Other: Pending Custom",
        [colHeader("attrTargetGender")]: "기타: 비공개",
        [colHeader("attrStorageCondition")]: "Other: ",
      },
    ]);

    const res = parseAndValidateBulkProductWorkbook({
      fileName: "r3-custom-values.xlsx",
      buffer: bytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(res.success).toBe(true);
    expect(res.summary?.validRows).toBe(1);
    expect(res.summary?.invalidRows).toBe(2);

    const savedAttrs = res.rows![0].payload!.common_attributes;
    const storage = savedAttrs.find((a) => a.attribute_code === "STORAGE_CONDITION");
    expect(storage).toEqual({
      attribute_code: "STORAGE_CONDITION",
      value_json: ["ROOM_TEMP", "OTHER"],
      text_value: "Cool",
    });

    const pkg = savedAttrs.find((a) => a.attribute_code === "PACKAGE_FORMAT");
    expect(pkg).toEqual({
      attribute_code: "PACKAGE_FORMAT",
      value_json: "OTHER",
      text_value: "Airless Glass Tube",
    });

    const occasion = savedAttrs.find((a) => a.attribute_code === "USAGE_OCCASION");
    expect(occasion).toEqual({
      attribute_code: "USAGE_OCCASION",
      value_json: ["AFTER_CLEANSING", "BEFORE_BED", "OTHER"],
      text_value: "운동 전",
    });

    const appArea = savedAttrs.find((a) => a.attribute_code === "APPLICATION_AREA");
    expect(appArea).toEqual({
      attribute_code: "APPLICATION_AREA",
      value_json: ["FACE", "EYE_AREA", "LIPS"], // deduplicated repeated FACE
      text_value: null,
    });

    // Bare "Cool" rejected as INVALID_ATTRIBUTE_VALUE with explicit Other: Cool guidance
    const bareRow = res.rows![1];
    expect(bareRow.status).toBe("INVALID");
    expect(bareRow.errorDetails.length).toBe(1);
    expect(bareRow.errorDetails[0].category).toBe("INVALID_ATTRIBUTE_VALUE");
    expect(bareRow.errorDetails[0].guidance).toContain("Other:");

    // Closed enum & empty Other: rejected as INVALID_CUSTOM_VALUE (all 3 errors reported on same row)
    const closedRow = res.rows![2];
    expect(closedRow.status).toBe("INVALID");
    expect(closedRow.errorDetails.length).toBe(3);
    expect(closedRow.errorDetails.every((d) => d.category === "INVALID_CUSTOM_VALUE")).toBe(
      true
    );
  });

  it("attaches Korean (English) Excel dropdown lists across all 20 option-based Common Attributes in Allowed_Values (Cols G..Z)", async () => {
    const buf = await generateBulkProductTemplateBuffer({
      brands: SAMPLE_BRANDS,
      categories: SAMPLE_CATEGORIES,
    });

    const wb = XLSX.read(buf, { type: "buffer" });
    const allowedAoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Allowed_Values"], {
      header: 1,
      defval: "",
    });
    // 6 core dropdown columns (A..F) + 20 option-based common attributes (G..Z) = 26 columns
    expect(allowedAoa[0].length).toBe(26);
    expect(allowedAoa[0][6]).toContain("STORAGE_CONDITION");
    expect(allowedAoa[0][25]).toContain("DRUG_FACTS_STATUS");
    expect(allowedAoa[1][6]).toBe("실온 (Room Temperature)");

    const zip = await JSZip.loadAsync(buf);
    const sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    // Verify multi-select columns (e.g., BO = Storage Conditions, BY = Usage Occasion, BZ = Application Area) have non-blocking list dropdowns
    expect(sheet1Xml).toContain('sqref="BO3:BO503"');
    expect(sheet1Xml).toContain('sqref="BY3:BY503"');
    expect(sheet1Xml).toContain('sqref="BZ3:BZ503"');
    expect(sheet1Xml).toContain("Allowed_Values!$G$2:$G$");
    expect(sheet1Xml).toContain("Allowed_Values!$Z$2:$Z$");
  });
});

describe("BRAND-PRODUCT-BULK-002-R3: Full Error Details, Annotated Error Workbook & Re-Upload Round-Trip", () => {
  it("reports every error per row across all 8 error categories, generates a formula-safe annotated error workbook preserving all rows/columns/leading-zeros, and re-uploads cleanly after cell edits", async () => {
    // Verify all 8 error category labels exist in Korean
    expect(Object.keys(BULK_ERROR_CATEGORY_LABELS_KO).length).toBe(8);

    const bytes = buildWorkbookBytesFromObjects(ALL_HEADERS, [
      {
        // Row 2 in simple header layout: Valid row with leading-zero SKU/UPC/EAN
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "007788",
        [colHeader("productNameEn")]: "Glowella Barrier Ampoule",
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("category2Depth")]: "에센스/세럼/앰플 (Essence & Serum)",
        [colHeader("upc")]: "012345678905",
        [colHeader("ean")]: "0012345678905",
        [colHeader("howToUse")]: "One's a Day",
      },
      {
        // Row 3: Multi-error row spanning all 8 distinct error categories + formula-injection neutralization!
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "EXISTING-SKU-99", // DUPLICATE_SKU_BARCODE
        [colHeader("productNameEn")]: "", // REQUIRED_FIELD
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("category2Depth")]: "립 메이크업 (Lip Makeup)", // CATEGORY_HIERARCHY
        [colHeader("description")]: "+HYPERLINK(\"https://evil.example\")", // OTHER_VALIDATION (formula injection)
        [colHeader("retailPriceKrw")]: "ABC_INVALID_PRICE", // PRICING_LOGISTICS
        [colHeader("mainImageUrl")]: "http://insecure.example.com/photo.jpg", // MEDIA_URL
        [colHeader("attrStorageCondition")]: "Cool", // INVALID_ATTRIBUTE_VALUE
        [colHeader("attrFdaStatus")]: "Other: Custom FDA", // INVALID_CUSTOM_VALUE
      },
      {
        // Row 4: Warning row (duplicate image URL deduplicated)
        [colHeader("brand")]: "PureLeaf",
        [colHeader("manufactureSku")]: "009911",
        [colHeader("productNameEn")]: "Hydrating Mist",
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("category2Depth")]: "에센스/세럼/앰플 (Essence & Serum)",
        [colHeader("mainImageUrl")]: "https://cdn.example.com/mist.jpg",
        [colHeader("additionalImageUrl2")]: "https://cdn.example.com/mist.jpg",
      },
    ]);

    const preview = parseAndValidateBulkProductWorkbook({
      fileName: "multi-error-upload.xlsx",
      buffer: bytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(["EXISTING-SKU-99"]),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(preview.success).toBe(true);
    expect(preview.summary?.validRows).toBe(1);
    expect(preview.summary?.invalidRows).toBe(1);
    expect(preview.summary?.warningRows).toBe(1);

    const multiErrRow = preview.rows![1];
    expect(multiErrRow.status).toBe("INVALID");
    expect(multiErrRow.errorDetails.length).toBe(8);
    const categoriesHit = new Set(multiErrRow.errorDetails.map((d) => d.category));
    expect(categoriesHit).toEqual(
      new Set([
        "REQUIRED_FIELD",
        "CATEGORY_HIERARCHY",
        "INVALID_ATTRIBUTE_VALUE",
        "INVALID_CUSTOM_VALUE",
        "DUPLICATE_SKU_BARCODE",
        "PRICING_LOGISTICS",
        "MEDIA_URL",
        "OTHER_VALIDATION",
      ])
    );

    // Generate Annotated Error Workbook ("오류 표시 Excel 다운로드")
    const annotatedBuf = await generateAnnotatedErrorWorkbookBuffer({
      brands: SAMPLE_BRANDS,
      categories: SAMPLE_CATEGORIES,
      preview,
    });

    const annotatedWb = XLSX.read(annotatedBuf, { type: "buffer", raw: false });
    expect(annotatedWb.SheetNames).toEqual([
      "Products",
      "오류 요약",
      "Instructions",
      "Brands",
      "Categories",
      "Countries",
      "Allowed_Values",
      "Common_Attributes",
    ]);

    // Check 오류 요약 sheet has 9 columns and records Errors (8), Warnings (1), and Valid (1) = 10 data rows + 1 header = 11 rows
    const summaryAoa = XLSX.utils.sheet_to_json<string[]>(
      annotatedWb.Sheets["오류 요약"],
      { header: 1, defval: "" }
    );
    expect(summaryAoa[0].length).toBe(9);
    expect(summaryAoa.length).toBe(11);
    expect(summaryAoa.some((r) => r[3].includes("오류 8건"))).toBe(true);
    expect(summaryAoa.some((r) => r[3].includes("확인 필요"))).toBe(true);
    expect(summaryAoa.some((r) => r[3].includes("정상"))).toBe(true);

    // Verify OOXML highlights, cell comments, leading zeros, and zero executable <f> formulas
    const zip = await JSZip.loadAsync(annotatedBuf);
    const productsXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const summaryXml = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    const sharedStringsXml = await zip.file("xl/sharedStrings.xml")!.async("string");
    const commentsXml = await zip.file("xl/comments1.xml")!.async("string");
    const vmlXml = await zip.file("xl/drawings/vmlDrawing1.vml")!.async("string");

    expect(productsXml).not.toContain("<f>");
    expect(summaryXml).not.toContain("<f>");
    expect(sharedStringsXml).toContain("&apos;+HYPERLINK");
    expect(sharedStringsXml).toContain("007788");
    expect(sharedStringsXml).toContain("012345678905");
    expect(sharedStringsXml).toContain("0012345678905");
    expect(productsXml).toContain('s="25"'); // CELL_ERROR red highlight
    expect(commentsXml).toContain("오류 1");
    expect(vmlXml).toContain("x:ClientData");

    // Simulate supplier fixing the invalid cells in Products inside Excel while keeping "오류 요약" sheet intact!
    const productsAoa = XLSX.utils.sheet_to_json<string[]>(
      annotatedWb.Sheets["Products"],
      { header: 1, defval: "" }
    );
    // Find row with EXISTING-SKU-99 (index 2 in 0-based AOA because header is Row 2 -> index 1)
    const errRowIdx = productsAoa.findIndex((r) => r[1] === "EXISTING-SKU-99");
    expect(errRowIdx).toBeGreaterThan(0);

    const idxOf = (key: string) => BULK_PRODUCT_COLUMNS.findIndex((c) => c.key === key);
    productsAoa[errRowIdx][idxOf("manufactureSku")] = "FIXED-SKU-100";
    productsAoa[errRowIdx][idxOf("productNameEn")] = "Fixed Calming Cream";
    productsAoa[errRowIdx][idxOf("category2Depth")] = "에센스/세럼/앰플 (Essence & Serum)";
    productsAoa[errRowIdx][idxOf("description")] = "Safe soothing barrier cream";
    productsAoa[errRowIdx][idxOf("retailPriceKrw")] = "28000";
    productsAoa[errRowIdx][idxOf("mainImageUrl")] = "https://cdn.example.com/fixed.jpg";
    productsAoa[errRowIdx][idxOf("attrStorageCondition")] =
      "실온 (Room Temperature); 기타: Cool";
    productsAoa[errRowIdx][idxOf("attrFdaStatus")] = "미검토 (Not Reviewed)";

    annotatedWb.Sheets["Products"] = XLSX.utils.aoa_to_sheet(productsAoa);
    const reuploadBuf = XLSX.write(annotatedWb, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const revalidated = parseAndValidateBulkProductWorkbook({
      fileName: "fixed-error-review.xlsx",
      buffer: new Uint8Array(reuploadBuf),
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(["EXISTING-SKU-99"]),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(revalidated.success).toBe(true);
    expect(revalidated.summary?.invalidRows).toBe(0);
    expect(revalidated.summary?.importableRows).toBe(3);
    const fixedRow = revalidated.rows!.find(
      (r) => r.payload?.manufacture_sku === "FIXED-SKU-100"
    );
    expect(fixedRow?.status).toBe("VALID");
    expect(
      fixedRow?.payload?.common_attributes.find(
        (a) => a.attribute_code === "STORAGE_CONDITION"
      )
    ).toEqual({
      attribute_code: "STORAGE_CONDITION",
      value_json: ["ROOM_TEMP", "OTHER"],
      text_value: "Cool",
    });
  });
});

describe("BRAND-PRODUCT-BULK-002-R3: How to Use ('One\\'s a Day') Completeness Accuracy Regression", () => {
  it("parses How to Use = \"One's a Day\" from Excel and never falsely flags [기본 정보: 사용 방법] while keeping incomplete products Draft", () => {
    const bytes = buildWorkbookBytesFromObjects(ALL_HEADERS, [
      {
        [colHeader("brand")]: "Glowella",
        [colHeader("manufactureSku")]: "HOWTOUSE-QA-01",
        [colHeader("productNameEn")]: "Daily Vita Ampoule",
        [colHeader("category1Depth")]: "스킨케어 (Skincare)",
        [colHeader("howToUse")]: "One's a Day",
      },
    ]);

    const preview = parseAndValidateBulkProductWorkbook({
      fileName: "how-to-use.xlsx",
      buffer: bytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(preview.success).toBe(true);
    const payload = preview.rows![0].payload!;
    expect(payload.how_to_use).toBe("One's a Day");

    // Evaluate completeness with the exact persisted row shape (missing origin, price, logistics, barcode, image)
    const evalWithHowToUse = evaluateProductRegistrationStatus({
      id: "prod-qa-1",
      name: payload.name,
      name_en: payload.name_en,
      brand_id: payload.brand_id,
      category_code: payload.category_code,
      manufacture_sku: payload.manufacture_sku,
      origin: payload.origin,
      how_to_use: payload.how_to_use,
      description: payload.description,
      bullet_points: payload.bullet_points,
      price_krw_retail: payload.price_krw_retail,
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
      upc: payload.upc,
      ean: payload.ean,
      selling_online: payload.selling_online,
      sales_link_1: payload.sales_link_1,
      hasImages: false,
    });

    expect(evalWithHowToUse.isDraft).toBe(true);
    expect(evalWithHowToUse.status).toBe("DRAFT");
    expect(
      evalWithHowToUse.missingFieldItems.some((m) => m.key === "how_to_use")
    ).toBe(false);
    expect(evalWithHowToUse.missingFields).not.toContain("기본 정보: 사용 방법");

    // Verify all genuinely missing fields are still accurately flagged
    const missingKeys = evalWithHowToUse.missingFieldItems.map((m) => m.key);
    expect(missingKeys).toEqual(
      expect.arrayContaining([
        "origin",
        "price_krw_retail",
        "price_usd_fob",
        "item_spec",
        "package_spec",
        "carton_spec",
        "barcode",
        "images",
      ])
    );
  });

  it("verifies every Portal and Admin query caller selects and passes how_to_use to evaluateProductRegistrationStatus", () => {
    const repoRoot = process.cwd();
    const filesToVerify = [
      "app/portal/products/page.tsx",
      "app/portal/page.tsx",
      "app/admin/brands/page.tsx",
      "app/admin/brands/[brandId]/page.tsx",
      "app/admin/products/trading/page.tsx",
      "lib/product/trading-actions.ts",
      "lib/purchase-order/actions.ts",
      "lib/purchase-order/request-actions.ts",
      "components/product/product-detail-tabs.tsx",
    ];

    for (const relPath of filesToVerify) {
      const content = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
      expect(content, `${relPath} must include how_to_use`).toContain("how_to_use");
    }
  });
});
