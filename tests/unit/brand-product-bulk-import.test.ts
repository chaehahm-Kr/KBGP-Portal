import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  BULK_PRODUCT_COLUMNS,
  COMMON_BULK_ATTRIBUTES,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
} from "@/lib/product/bulk-import-types";
import {
  generateBulkImportErrorBuffer,
  generateBulkProductTemplateBuffer,
} from "@/lib/product/bulk-import-template";
import { parseAndValidateBulkProductWorkbook } from "@/lib/product/bulk-import-validator";
import {
  inspectDownloadedImageBytes,
  isPublicIpAddress,
  isSafePublicHostname,
  validateHttpsMediaUrlSyntax,
} from "@/lib/product/bulk-media-url-utils";

const SAMPLE_BRANDS: BulkReferenceBrand[] = [
  { id: "brand-uuid-1", name: "Glowella", is_active: true },
  { id: "brand-uuid-2", name: "PureLeaf", is_active: true },
  { id: "brand-uuid-inactive", name: "RetiredBrand", is_active: false },
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
    code: "CAT_SKINCARE_CLEANSING",
    name_ko: "클렌징",
    name_en: "Cleansing",
    depth: 2,
    parent_code: "CAT_SKINCARE",
    is_final: false,
    is_active: true,
    display_order: 1,
  },
  {
    code: "CAT_MAKEUP_LIP",
    name_ko: "립 메이크업",
    name_en: "Lip Makeup",
    depth: 2,
    parent_code: "CAT_MAKEUP",
    is_final: false,
    is_active: true,
    display_order: 1,
  },
  {
    code: "CAT_SKINCARE_CLEANSING_FOAM",
    name_ko: "클렌징 폼",
    name_en: "Cleansing Foam",
    depth: 3,
    parent_code: "CAT_SKINCARE_CLEANSING",
    is_final: true,
    is_active: true,
    display_order: 1,
  },
  {
    code: "CAT_MAKEUP_LIP_TINT",
    name_ko: "립 틴트",
    name_en: "Lip Tint",
    depth: 3,
    parent_code: "CAT_MAKEUP_LIP",
    is_final: true,
    is_active: true,
    display_order: 1,
  },
];

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

describe("BRAND-PRODUCT-BULK-002-R2: Column Architecture & Excel Template", () => {
  it("preserves the exact original 52 columns (0..51) and extends to 86 total columns (4 required, 82 optional)", () => {
    expect(BULK_PRODUCT_COLUMNS.length).toBe(86);
    expect(COMMON_BULK_ATTRIBUTES.length).toBe(23);

    const requiredCols = BULK_PRODUCT_COLUMNS.filter((c) => c.required);
    expect(requiredCols.map((c) => c.key)).toEqual([
      "brand",
      "manufactureSku",
      "productNameEn",
      "category1Depth",
    ]);

    // Original 52 boundary checks
    expect(BULK_PRODUCT_COLUMNS[0].key).toBe("brand");
    expect(BULK_PRODUCT_COLUMNS[3].key).toBe("category1Depth");
    expect(BULK_PRODUCT_COLUMNS[4].key).toBe("category2Depth");
    expect(BULK_PRODUCT_COLUMNS[5].key).toBe("category3Depth");
    expect(BULK_PRODUCT_COLUMNS[51].key).toBe("palletWeight");

    // 11 Media URL columns (52..62)
    expect(BULK_PRODUCT_COLUMNS[52].key).toBe("mainImageUrl");
    expect(BULK_PRODUCT_COLUMNS[61].key).toBe("additionalImageUrl10");
    expect(BULK_PRODUCT_COLUMNS[62].key).toBe("productVideoUrl");

    // 23 Common Attribute columns (63..85)
    expect(BULK_PRODUCT_COLUMNS[63].attributeCode).toBe("SHELF_LIFE_MONTHS");
    expect(BULK_PRODUCT_COLUMNS[85].attributeCode).toBe("DRUG_FACTS_STATUS");
  });

  it("generates a valid 7-sheet .xlsx template with 86 visible headers, sample row, frozen panes, text formatting, and dependent category dropdown formulas", async () => {
    const buf = await generateBulkProductTemplateBuffer({
      brands: SAMPLE_BRANDS,
      categories: SAMPLE_CATEGORIES,
    });

    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual([
      "Products",
      "Instructions",
      "Brands",
      "Categories",
      "Countries",
      "Allowed_Values",
      "Common_Attributes",
    ]);

    const productsRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Products"], {
      header: 1,
      defval: "",
    });
    expect(productsRows[1].length).toBe(86);
    expect(productsRows[1][0]).toBe("브랜드 (Brand) *");
    expect(productsRows[1][52]).toBe("대표 이미지 URL (Main Image URL)");
    expect(productsRows[1][62]).toBe("제품 동영상 URL (Product Video URL)");
    expect(productsRows[1][63]).toBe(COMMON_BULK_ATTRIBUTES[0].header);
    expect(productsRows[1][85]).toBe("Drug Facts 상태 (Drug Facts Status)");
    expect(productsRows[2][1]).toBe("EXAMPLE-SKU-001");

    // Inspect raw OOXML of Products sheet (xl/worksheets/sheet1.xml — active opening sheet)
    const zip = await JSZip.loadAsync(buf);
    const sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet1Xml).toContain('ySplit="2"');
    expect(sheet1Xml).toContain('autoFilter ref="A2:CH3"');
    expect(sheet1Xml).toContain("OFFSET(Categories!$M$2,MATCH(D3,Categories!$L$2:$L$");
    expect(sheet1Xml).toContain("OFFSET(Categories!$P$2,MATCH(E3,Categories!$O$2:$O$");

    // Verify unmodified template parses with example row skipped cleanly
    const parsed = parseAndValidateBulkProductWorkbook({
      fileName: "template.xlsx",
      buffer: new Uint8Array(buf),
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("예시 행");
  });

  it("maintains full backward compatibility with V1 (English 52-col) and R1 (Korean 52-col) workbooks and preserves leading zeros", () => {
    const v1Cols = BULK_PRODUCT_COLUMNS.slice(0, 52);
    const v1Headers = v1Cols.map((c) => c.headerEn);
    const colHeaderEn = (key: string) => v1Cols.find((c) => c.key === key)!.headerEn;

    const bytes = buildWorkbookBytesFromObjects(v1Headers, [
      {
        [colHeaderEn("brand")]: "Glowella",
        [colHeaderEn("manufactureSku")]: "009812",
        [colHeaderEn("productNameEn")]: "V1 Legacy Serum",
        [colHeaderEn("category1Depth")]: "Skincare",
        [colHeaderEn("upc")]: "012345678905",
        [colHeaderEn("ean")]: "0012345678905",
      },
    ]);

    const res = parseAndValidateBulkProductWorkbook({
      fileName: "v1-52col.xlsx",
      buffer: bytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(res.success).toBe(true);
    expect(res.summary?.validRows).toBe(1);
    const payload = res.rows![0].payload!;
    expect(payload.manufacture_sku).toBe("009812");
    expect(payload.upc).toBe("012345678905");
    expect(payload.ean).toBe("0012345678905");
    expect(payload.category_code).toBe("CAT_SKINCARE");
    expect(payload.image_urls).toEqual([]);
    expect(payload.common_attributes).toEqual([]);
  });
});

describe("BRAND-PRODUCT-BULK-002-R2: Category Hierarchy, Common Attributes & Media Validation", () => {
  const allHeaders = BULK_PRODUCT_COLUMNS.map((c) => c.header);
  const h = (key: string) => BULK_PRODUCT_COLUMNS.find((c) => c.key === key)!.header;

  it("supports 1Depth-only Draft creation, bilingual 2Depth/3Depth hierarchy resolution, and rejects mismatched parent/child categories", () => {
    const bytes = buildWorkbookBytesFromObjects(allHeaders, [
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "CAT-D1-ONLY",
        [h("productNameEn")]: "1Depth Only Product",
        [h("category1Depth")]: "스킨케어 (Skincare)",
      },
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "CAT-D3-VALID",
        [h("productNameEn")]: "3Depth Valid Foam",
        [h("category1Depth")]: "스킨케어 (Skincare)",
        [h("category2Depth")]: "클렌징 (Cleansing)",
        [h("category3Depth")]: "클렌징 폼 (Cleansing Foam)",
      },
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "CAT-MISMATCH",
        [h("productNameEn")]: "Wrong Hierarchy Product",
        [h("category1Depth")]: "스킨케어 (Skincare)",
        [h("category2Depth")]: "립 메이크업 (Lip Makeup)",
      },
    ]);

    const res = parseAndValidateBulkProductWorkbook({
      fileName: "categories.xlsx",
      buffer: bytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(res.success).toBe(true);
    expect(res.summary?.importableRows).toBe(2);
    expect(res.summary?.invalidRows).toBe(1);
    expect(res.summary?.categoryErrorRows).toBe(1);

    expect(res.rows![0].payload?.category_code).toBe("CAT_SKINCARE");
    expect(res.rows![1].payload?.category_code).toBe("CAT_SKINCARE_CLEANSING_FOAM");
    expect(res.rows![2].status).toBe("INVALID");
    expect(res.rows![2].hasCategoryError).toBe(true);
  });

  it("validates all 23 COMMON product attributes (single-select, semicolon multi-select, numeric, boolean, OTHER: text) and rejects invalid/ADMIN_VERIFIED values with exact row & column", () => {
    const bytes = buildWorkbookBytesFromObjects(allHeaders, [
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "ATTR-ALL-23",
        [h("productNameEn")]: "Complete Common Attr Cream",
        [h("category1Depth")]: "Skincare",
        [h("attrShelfLifeMonths")]: "36",
        [h("attrMinRemainingShelfLife")]: "24",
        [h("attrPaoMonths")]: "12",
        [h("attrStorageCondition")]: "Room Temperature; 직사광선 피함",
        [h("attrPackageFormat")]: "Other: Airless Pump",
        [h("attrFormulation")]: "Cream; Gel",
        [h("attrSealed")]: "Yes",
        [h("attrRefillable")]: "아니요",
        [h("attrTargetAge")]: "20s; 30s; 성인",
        [h("attrTargetGender")]: "Unisex",
        [h("attrSkinType")]: "Dry Skin; Sensitive Skin",
        [h("attrUsageFrequency")]: "Daily",
        [h("attrDailyUseCount")]: "Twice Daily",
        [h("attrUsageOccasion")]: "After Cleansing; Before Bed",
        [h("attrApplicationArea")]: "Face; Eye Area",
        [h("attrPrimaryConcern")]: "Dryness; Skin Barrier",
        [h("attrScented")]: "해당 없음",
        [h("attrScentFamily")]: "Unscented",
        [h("attrScentIntensity")]: "None",
        [h("attrFdaStatus")]: "Not Reviewed",
        [h("attrMocraStatus")]: "Facility Registration Pending",
        [h("attrOtcStatus")]: "Not OTC",
        [h("attrDrugFactsStatus")]: "Not Applicable",
      },
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "ATTR-BAD-TOKEN",
        [h("productNameEn")]: "Invalid Token Product",
        [h("category1Depth")]: "Skincare",
        [h("attrSkinType")]: "Dry Skin; Alien Skin",
      },
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "ATTR-ADMIN-ONLY",
        [h("productNameEn")]: "Admin Verified Attempt",
        [h("category1Depth")]: "Skincare",
        [h("attrFdaStatus")]: "Admin Verified",
      },
    ]);

    const res = parseAndValidateBulkProductWorkbook({
      fileName: "common-attrs.xlsx",
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
    expect(res.summary?.commonAttributeErrorRows).toBe(2);

    const attrs = res.rows![0].payload!.common_attributes;
    expect(attrs.length).toBe(23);

    const skinType = attrs.find((a) => a.attribute_code === "SKIN_TYPE");
    expect(skinType?.value_json).toEqual(["DRY", "SENSITIVE"]);

    const pkgFormat = attrs.find((a) => a.attribute_code === "PACKAGE_FORMAT");
    expect(pkgFormat?.value_json).toBe("OTHER");
    expect(pkgFormat?.text_value).toBe("Airless Pump");

    const usageFreq = attrs.find((a) => a.attribute_code === "USAGE_FREQUENCY");
    expect(usageFreq?.value_json).toBe("DAILY");

    const scented = attrs.find((a) => a.attribute_code === "SCENTED");
    expect(scented?.value_json).toBe("NOT_APPLICABLE");

    // Invalid token row includes exact row number (#3) and column name
    expect(res.rows![1].status).toBe("INVALID");
    expect(res.rows![1].errors[0]).toContain("3행");
    expect(res.rows![1].errors[0]).toContain("Skin Type");
    expect(res.rows![1].errors[0]).toContain("Alien Skin");

    // Admin-only regulatory option rejected
    expect(res.rows![2].status).toBe("INVALID");
    expect(res.rows![2].errors[0]).toContain("4행");
    expect(res.rows![2].errors[0]).toContain("FDA");
  });

  it("validates Media URLs, deduplicates identical image URLs per product, blocks SSRF private/metadata IPs, and inspects magic bytes", () => {
    // SSRF IP & hostname guards
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("10.0.0.5")).toBe(false);
    expect(isPublicIpAddress("172.16.5.4")).toBe(false);
    expect(isPublicIpAddress("192.168.1.1")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("::ffff:169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isSafePublicHostname("localhost")).toBe(false);
    expect(isSafePublicHostname("internal.local")).toBe(false);
    expect(isSafePublicHostname("cdn.example.com")).toBe(true);

    expect(validateHttpsMediaUrlSyntax("http://cdn.example.com/a.jpg", "image").valid).toBe(false);
    expect(validateHttpsMediaUrlSyntax("https://169.254.169.254/latest/meta-data", "image").valid).toBe(false);
    expect(validateHttpsMediaUrlSyntax("https://cdn.example.com/malware.exe", "image").valid).toBe(false);
    expect(validateHttpsMediaUrlSyntax("https://cdn.example.com/photo.jpg", "image").valid).toBe(true);

    // Magic-byte inspection
    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    expect(inspectDownloadedImageBytes(validPng).ok).toBe(true);

    const disguisedExe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff");
    expect(inspectDownloadedImageBytes(disguisedExe).ok).toBe(false);

    const disguisedHtml = Buffer.from("<!DOCTYPE html><html><body>Login required</body></html>");
    expect(inspectDownloadedImageBytes(disguisedHtml).ok).toBe(false);

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 16, 0xff);
    expect(inspectDownloadedImageBytes(oversized).ok).toBe(false);

    // Workbook media URL validation
    const bytes = buildWorkbookBytesFromObjects(allHeaders, [
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "MEDIA-OK-DEDUP",
        [h("productNameEn")]: "Media Dedup Product",
        [h("category1Depth")]: "Skincare",
        [h("mainImageUrl")]: "https://cdn.example.com/img1.jpg",
        [h("additionalImageUrl2")]: "https://cdn.example.com/img1.jpg",
        [h("additionalImageUrl3")]: "https://cdn.example.com/img2.webp",
        [h("productVideoUrl")]: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      {
        [h("brand")]: "Glowella",
        [h("manufactureSku")]: "MEDIA-NO-MAIN",
        [h("productNameEn")]: "Missing Main Image",
        [h("category1Depth")]: "Skincare",
        [h("additionalImageUrl2")]: "https://cdn.example.com/img2.jpg",
      },
    ]);

    const res = parseAndValidateBulkProductWorkbook({
      fileName: "media.xlsx",
      buffer: bytes,
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });

    expect(res.success).toBe(true);
    expect(res.rows![0].status).toBe("WARNING"); // duplicate URL deduplicated with warning
    expect(res.rows![0].payload!.image_urls.map((u) => u.url)).toEqual([
      "https://cdn.example.com/img1.jpg",
      "https://cdn.example.com/img2.webp",
    ]);
    expect(res.rows![0].payload!.image_urls[0].slotNumber).toBe(1);
    expect(res.rows![0].payload!.product_video_url).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );

    expect(res.rows![1].status).toBe("INVALID");
    expect(res.rows![1].hasMediaUrlError).toBe(true);
  });

  it("supports 4-required-fields-only rows, rejects existing SKUs, and validates 100-row and 500-row workbooks cleanly", async () => {
    const rows100 = Array.from({ length: 100 }, (_, i) => ({
      [h("brand")]: "Glowella",
      [h("manufactureSku")]: `BULK100-${String(i + 1).padStart(3, "0")}`,
      [h("productNameEn")]: `Bulk 100 Product ${i + 1}`,
      [h("category1Depth")]: "Skincare",
    }));
    const res100 = parseAndValidateBulkProductWorkbook({
      fileName: "bulk100.xlsx",
      buffer: buildWorkbookBytesFromObjects(allHeaders, rows100),
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(["BULK100-005"]),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });
    expect(res100.success).toBe(true);
    expect(res100.summary?.importableRows).toBe(99);
    expect(res100.summary?.duplicateRows).toBe(1);

    const rows500 = Array.from({ length: 500 }, (_, i) => ({
      [h("brand")]: i % 2 === 0 ? "Glowella" : "PureLeaf",
      [h("manufactureSku")]: `BULK500-${String(i + 1).padStart(4, "0")}`,
      [h("productNameEn")]: `Bulk 500 Product ${i + 1}`,
      [h("category1Depth")]: "스킨케어 (Skincare)",
      [h("attrShelfLifeMonths")]: "36",
      [h("attrSkinType")]: "Dry Skin; Sensitive Skin",
    }));
    const res500 = parseAndValidateBulkProductWorkbook({
      fileName: "bulk500.xlsx",
      buffer: buildWorkbookBytesFromObjects(allHeaders, rows500),
      companyBrands: SAMPLE_BRANDS,
      allCategories: SAMPLE_CATEGORIES,
      existingCompanySkus: new Set(),
      existingUpcs: new Set(),
      existingEans: new Set(),
    });
    expect(res500.success).toBe(true);
    expect(res500.summary?.validRows).toBe(500);
    expect(res500.summary?.rowsWithCommonAttrsCount).toBe(500);

    // Combined error + media failure report buffer check
    const errBuf = await generateBulkImportErrorBuffer(
      [
        {
          excelRowNumber: 7,
          manufactureSku: "BULK100-005",
          productName: "Bulk 100 Product 5",
          errorReason: "Existing SKU",
          correctiveGuidance: "Use unique SKU",
          isDuplicate: true,
        },
      ],
      [
        {
          excelRowNumber: 8,
          productId: "prod-1",
          manufactureSku: "BULK100-006",
          productNameEn: "Bulk 100 Product 6",
          columnHeader: "대표 이미지 URL (Main Image URL)",
          slotNumber: 1,
          url: "https://cdn.example.com/missing.jpg",
          errorReason: "HTTP 404",
          correctiveGuidance: "Fix URL",
        },
      ]
    );
    const errWb = XLSX.read(errBuf, { type: "buffer" });
    expect(errWb.SheetNames).toEqual(["Import_Errors", "Media_Failures"]);
  });
});
