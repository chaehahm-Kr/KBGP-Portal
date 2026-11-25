import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  BULK_PRODUCT_COLUMNS_LEGACY,
  BULK_PRODUCT_COLUMNS_V1,
  COMMON_BULK_ATTRIBUTES,
  COMMON_BULK_ATTRIBUTES_V1,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkReferenceManufacturingFacility,
} from "@/lib/product/bulk-import-types";
import {
  generateBulkProductTemplateBuffer,
} from "@/lib/product/bulk-import-template";
import {
  parseAndValidateBulkProductWorkbook,
  parseCanonicalUsClassification,
  parseCanonicalMocraListingStatus,
  parseCanonicalOtcApplicability,
  parseCanonicalOtcListingStatus,
  parseCanonicalDrugFactsStatus,
} from "@/lib/product/bulk-import-validator";
import {
  isComplianceV1Enabled,
  setComplianceV1FeatureGateOverride,
} from "@/lib/compliance/v1-feature-gate";

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
    code: "CAT_SKINCARE_CLEANSING_FOAM",
    name_ko: "클렌징 폼",
    name_en: "Cleansing Foam",
    depth: 3,
    parent_code: "CAT_SKINCARE_CLEANSING",
    is_final: true,
    is_active: true,
    display_order: 1,
  },
];

const SAMPLE_FACILITIES: BulkReferenceManufacturingFacility[] = [
  {
    id: "fac-uuid-1",
    facility_code: "MFG-001",
    manufacturer_legal_name_en: "Cosmax Incheon Plant",
    name: "코스맥스 인천공장",
    country: "KR",
    city: "인천",
    fei_number: "3001234567",
    fei_status: "ACTIVE",
    mocra_facility_status: "REGISTERED",
    otc_facility_status: "REGISTERED",
    is_active: true,
  },
  {
    id: "fac-uuid-2",
    facility_code: "MFG-002",
    manufacturer_legal_name_en: "Kolmar Sejong Plant",
    name: "한국콜마 세종공장",
    country: "KR",
    city: "세종",
    fei_number: "3007654321",
    fei_status: "ACTIVE",
    mocra_facility_status: "REGISTERED",
    otc_facility_status: "NOT_APPLICABLE",
    is_active: true,
  },
  {
    id: "fac-uuid-inactive",
    facility_code: "MFG-003",
    manufacturer_legal_name_en: "Old Inactive Facility",
    name: "구 비활성 공장",
    country: "KR",
    city: "부산",
    fei_number: null,
    fei_status: "UNKNOWN",
    mocra_facility_status: "UNKNOWN",
    otc_facility_status: "UNKNOWN",
    is_active: false,
  },
];

function buildWorkbookBytes(
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

describe("KSN-CMP-008: Excel Template & Bulk Product Import Enhancement", () => {
  describe("1. Canonical Excel Header Rename (Brand SKU)", () => {
    it("uses '브랜드 SKU (Brand SKU) *' as canonical header for both V1 and Legacy column specs", () => {
      const v1SkuCol = BULK_PRODUCT_COLUMNS_V1.find((c) => c.key === "manufactureSku");
      const legacySkuCol = BULK_PRODUCT_COLUMNS_LEGACY.find((c) => c.key === "manufactureSku");

      expect(v1SkuCol).toBeDefined();
      expect(v1SkuCol?.header).toBe("브랜드 SKU (Brand SKU) *");
      expect(legacySkuCol).toBeDefined();
      expect(legacySkuCol?.header).toBe("브랜드 SKU (Brand SKU) *");

      // Verify aliases include both legacy '제조사 SKU' and modern '브랜드 SKU' variants (all lowercase normalized)
      const aliases = v1SkuCol?.aliases ?? [];
      expect(aliases).toContain("제조사 sku");
      expect(aliases).toContain("제조사 sku *");
      expect(aliases).toContain("제조사 sku (manufacturer sku) *");
      expect(aliases).toContain("브랜드 sku");
      expect(aliases).toContain("브랜드 sku *");
      expect(aliases).toContain("brand sku");
      expect(aliases).toContain("brand sku *");
    });

    it("parses SKU with exact string preservation (leading zeros, hyphens, no numeric coercion)", () => {
      const buf = buildWorkbookBytes(
        ["브랜드 (Brand) *", "브랜드 SKU (Brand SKU) *", "영문 제품명 (Product Name EN) *", "카테고리 (1Depth) *"],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "0012345",
            "영문 제품명 (Product Name EN) *": "Hydra Foam Cleanser",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
          },
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "K-SKU-990-KR",
            "영문 제품명 (Product Name EN) *": "Hydra Cream Cleanser",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_sku_leading_zero.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].payload?.manufacture_sku).toBe("0012345");
      expect(res.rows?.[1].payload?.manufacture_sku).toBe("K-SKU-990-KR");
    });

    it("accepts legacy header '제조사 SKU / Manufacturer SKU' seamlessly", () => {
      const buf = buildWorkbookBytes(
        ["브랜드 (Brand) *", "제조사 SKU / Manufacturer SKU", "영문 제품명 (Product Name EN) *", "카테고리 (1Depth) *"],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "제조사 SKU / Manufacturer SKU": "LEGACY-SKU-001",
            "영문 제품명 (Product Name EN) *": "Gentle Cleansing Foam",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_legacy_sku_header.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("VALID");
      expect(res.rows?.[0].payload?.manufacture_sku).toBe("LEGACY-SKU-001");
    });
  });

  describe("2. Pre-Cutover & Post-Cutover Excel Template Generation", () => {
    it("generates 86-column, 7-sheet template when feature gate is disabled (legacy pre-cutover)", async () => {
      setComplianceV1FeatureGateOverride(false);
      try {
        const buf = await generateBulkProductTemplateBuffer({
          brands: SAMPLE_BRANDS,
          categories: SAMPLE_CATEGORIES,
          manufacturingFacilities: SAMPLE_FACILITIES,
          isComplianceV1: false,
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
        expect(wb.SheetNames).not.toContain("Manufacturing_Facilities");

        const sheet = wb.Sheets["Products"];
        const range = XLSX.utils.decode_range(sheet["!ref"]!);
        const colCount = range.e.c - range.s.c + 1;
        expect(colCount).toBe(86);

        // Common Attributes sheet should have 23 attributes (including legacy regulatory attributes)
        const commonJson: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Common_Attributes"]);
        const attrEntries = commonJson.filter((r) => r["EAV 속성 코드 (Attribute Code)"]);
        expect(attrEntries.length).toBe(23);
      } finally {
        setComplianceV1FeatureGateOverride(null);
      }
    });

    it("generates 99-column, 8-sheet template when feature gate is enabled (V1 post-cutover)", async () => {
      setComplianceV1FeatureGateOverride(true);
      try {
        const buf = await generateBulkProductTemplateBuffer({
          brands: SAMPLE_BRANDS,
          categories: SAMPLE_CATEGORIES,
          manufacturingFacilities: SAMPLE_FACILITIES,
          isComplianceV1: true,
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
          "Manufacturing_Facilities",
        ]);

        const sheet = wb.Sheets["Products"];
        const range = XLSX.utils.decode_range(sheet["!ref"]!);
        const colCount = range.e.c - range.s.c + 1;
        expect(colCount).toBe(99);

        // Common Attributes sheet should have 19 attributes (4 regulatory attributes relocated)
        const commonJson: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Common_Attributes"]);
        const attrEntries = commonJson.filter((r) => r["EAV 속성 코드 (Attribute Code)"]);
        expect(attrEntries.length).toBe(19);

        // Verify Manufacturing_Facilities sheet contents
        const facSheet = wb.Sheets["Manufacturing_Facilities"];
        const facData: any[] = XLSX.utils.sheet_to_json(facSheet);
        expect(facData.length).toBe(2); // Only 2 active facilities out of 3
        expect(facData[0]["제조시설 코드 (Facility Code)"]).toBe("MFG-001");
        expect(facData[0]["영문 법인/제조사명 (Legal Name EN)"]).toBe("Cosmax Incheon Plant");
        expect(facData[0]["FEI 번호 (FEI Number)"]).toBe("3001234567");
        expect(facData[1]["제조시설 코드 (Facility Code)"]).toBe("MFG-002");
      } finally {
        setComplianceV1FeatureGateOverride(null);
      }
    });
  });

  describe("3. Manufacturing Facility Association Validation", () => {
    it("validates primary and additional facility codes and resolves IDs atomically", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "주 제조시설 코드 (Primary Facility Code)",
          "추가 제조시설 코드 (Additional Facility Codes)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "FAC-TEST-001",
            "영문 제품명 (Product Name EN) *": "Dual Plant Foam",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "주 제조시설 코드 (Primary Facility Code)": "MFG-001",
            "추가 제조시설 코드 (Additional Facility Codes)": "MFG-002",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_facilities_valid.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        manufacturingFacilities: SAMPLE_FACILITIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("VALID");
      expect(res.rows?.[0].hasFacility).toBe(true);
      expect(res.rows?.[0].payload?.facilities).toEqual({
        primary_facility_id: "fac-uuid-1",
        primary_facility_code: "MFG-001",
        additional_facility_ids: ["fac-uuid-2"],
        additional_facility_codes: ["MFG-002"],
      });
      expect(res.summary?.rowsWithFacilityCount).toBe(1);
    });

    it("rejects unregistered facility codes with clear guidance", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "주 제조시설 코드 (Primary Facility Code)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "FAC-TEST-ERR1",
            "영문 제품명 (Product Name EN) *": "Unknown Plant Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "주 제조시설 코드 (Primary Facility Code)": "MFG-UNKNOWN-999",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_fac_unregistered.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        manufacturingFacilities: SAMPLE_FACILITIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("INVALID");
      expect(res.rows?.[0].hasFacilityError).toBe(true);
      expect(res.rows?.[0].errors.some((e) => e.includes("등록되지 않았거나 귀사에 권한이 없는"))).toBe(true);
    });

    it("rejects inactive facility codes", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "주 제조시설 코드 (Primary Facility Code)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "FAC-TEST-ERR2",
            "영문 제품명 (Product Name EN) *": "Inactive Plant Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "주 제조시설 코드 (Primary Facility Code)": "MFG-003", // inactive
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_fac_inactive.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        manufacturingFacilities: SAMPLE_FACILITIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("INVALID");
      expect(res.rows?.[0].errors.some((e) => e.includes("비활성화된 제조시설입니다"))).toBe(true);
    });

    it("rejects duplicate facility codes between primary and additional", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "주 제조시설 코드 (Primary Facility Code)",
          "추가 제조시설 코드 (Additional Facility Codes)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "FAC-TEST-ERR3",
            "영문 제품명 (Product Name EN) *": "Duplicate Plant Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "주 제조시설 코드 (Primary Facility Code)": "MFG-001",
            "추가 제조시설 코드 (Additional Facility Codes)": "MFG-001; MFG-002",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_fac_dup.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        manufacturingFacilities: SAMPLE_FACILITIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("INVALID");
      expect(res.rows?.[0].errors.some((e) => e.includes("동일한 코드를 추가 제조시설에 중복 지정할 수 없습니다"))).toBe(true);
    });

    it("allows blank facility codes for Draft products without error", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "주 제조시설 코드 (Primary Facility Code)",
          "추가 제조시설 코드 (Additional Facility Codes)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "FAC-BLANK-001",
            "영문 제품명 (Product Name EN) *": "No Facility Draft Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "주 제조시설 코드 (Primary Facility Code)": "",
            "추가 제조시설 코드 (Additional Facility Codes)": "",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_fac_blank.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        manufacturingFacilities: SAMPLE_FACILITIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("VALID");
      expect(res.rows?.[0].hasFacility).toBe(false);
      expect(res.rows?.[0].payload?.facilities).toBeUndefined();
    });
  });

  describe("4. Regulatory & Compliance Declaration Validation", () => {
    it("parses canonical bilingual dropdown values cleanly", () => {
      expect(parseCanonicalUsClassification("일반 화장품 (Cosmetic)")).toBe("COSMETIC");
      expect(parseCanonicalUsClassification("일반의약품 (OTC Drug)")).toBe("OTC_DRUG");
      expect(parseCanonicalUsClassification("화장품/OTC 복합 (Cosmetic & OTC Dual)")).toBe("COSMETIC_OTC_DUAL");
      expect(parseCanonicalUsClassification("해당 없음 (Not Applicable)")).toBe("NOT_APPLICABLE");

      expect(parseCanonicalMocraListingStatus("리스팅 완료 (Listed)")).toBe("LISTED");
      expect(parseCanonicalMocraListingStatus("소기업 면제 (Exempt - Small Business)")).toBe("EXEMPT_SMALL_BUSINESS");

      expect(parseCanonicalOtcApplicability("OTC 해당 (Applicable)")).toBe("APPLICABLE");
      expect(parseCanonicalOtcApplicability("해당 없음 (Not Applicable)")).toBe("NOT_APPLICABLE");

      expect(parseCanonicalOtcListingStatus("등록 완료 (Listed)")).toBe("LISTED");
      expect(parseCanonicalDrugFactsStatus("작성 완료 (Ready)")).toBe("READY");
      expect(parseCanonicalDrugFactsStatus("작성 준비 중 (Pending)")).toBe("DRAFT");
    });

    it("rejects MoCRA LISTED when listing number is missing", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "미국 규제 분류 (US Classification)",
          "MoCRA 제품 리스팅 상태 (MoCRA Listing Status)",
          "MoCRA 리스팅 번호 (MoCRA Listing Number)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "REG-MOCRA-ERR",
            "영문 제품명 (Product Name EN) *": "MoCRA Incomplete Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "미국 규제 분류 (US Classification)": "일반 화장품 (Cosmetic)",
            "MoCRA 제품 리스팅 상태 (MoCRA Listing Status)": "리스팅 완료 (Listed)",
            "MoCRA 리스팅 번호 (MoCRA Listing Number)": "", // Missing!
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_mocra_missing_num.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("INVALID");
      expect(res.rows?.[0].hasRegulatoryError).toBe(true);
      expect(
        res.rows?.[0].errors.some(
          (e) =>
            e.includes("Cosmetic Product Listing Number가 필수") ||
            e.includes("MoCRA 제품 리스팅 번호가 필수")
        )
      ).toBe(true);
    });

    it("rejects OTC LISTED when NDC number is missing", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "미국 규제 분류 (US Classification)",
          "OTC 적용 여부 (OTC Applicability)",
          "OTC 리스팅 상태 (OTC Listing Status)",
          "NDC 번호 (OTC NDC Number)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "REG-OTC-ERR",
            "영문 제품명 (Product Name EN) *": "OTC Incomplete Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "미국 규제 분류 (US Classification)": "일반의약품 (OTC Drug)",
            "OTC 적용 여부 (OTC Applicability)": "OTC 해당 (Applicable)",
            "OTC 리스팅 상태 (OTC Listing Status)": "등록 완료 (Listed)",
            "NDC 번호 (OTC NDC Number)": "", // Missing!
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_otc_missing_ndc.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("INVALID");
      expect(res.rows?.[0].hasRegulatoryError).toBe(true);
      expect(
        res.rows?.[0].errors.some(
          (e) => e.includes("NDC Number가 필수") || e.includes("NDC 번호가 필수")
        )
      ).toBe(true);
    });

    it("rejects Drug Facts 'VERIFIED' designation by brand user (admin-only privilege)", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "Drug Facts 라벨 상태 (Drug Facts Status)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "REG-DF-ERR",
            "영문 제품명 (Product Name EN) *": "Spoofed Drug Facts Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "Drug Facts 라벨 상태 (Drug Facts Status)": "검증 완료 (Verified)",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_drug_facts_verified_forbidden.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("INVALID");
      expect(res.rows?.[0].hasRegulatoryError).toBe(true);
      expect(
        res.rows?.[0].errors.some(
          (e) =>
            e.includes("ADMIN 검증") ||
            e.includes("VERIFIED는 브랜드 지정 불가")
        )
      ).toBe(true);
    });

    it("validates a complete, compliant cosmetic declaration", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "미국 규제 분류 (US Classification)",
          "MoCRA 제품 리스팅 상태 (MoCRA Listing Status)",
          "MoCRA 리스팅 번호 (MoCRA Listing Number)",
          "MoCRA 리스팅 완료일 (MoCRA Listed At)",
          "OTC 적용 여부 (OTC Applicability)",
          "OTC 리스팅 상태 (OTC Listing Status)",
          "OTC 비대상 사유 (OTC NA Reason)",
          "Drug Facts 라벨 상태 (Drug Facts Status)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "REG-FULL-001",
            "영문 제품명 (Product Name EN) *": "Full Compliant Serum",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "미국 규제 분류 (US Classification)": "일반 화장품 (Cosmetic)",
            "MoCRA 제품 리스팅 상태 (MoCRA Listing Status)": "리스팅 완료 (Listed)",
            "MoCRA 리스팅 번호 (MoCRA Listing Number)": "MOCRA-12345",
            "MoCRA 리스팅 완료일 (MoCRA Listed At)": "2026-01-15",
            "OTC 적용 여부 (OTC Applicability)": "해당 없음 (Not Applicable)",
            "OTC 리스팅 상태 (OTC Listing Status)": "해당 없음 (Not Applicable)",
            "OTC 비대상 사유 (OTC NA Reason)": "화장품 단독 제품으로 OTC 비해당",
            "Drug Facts 라벨 상태 (Drug Facts Status)": "해당 없음 (Not Applicable)",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "test_full_compliant.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("VALID");
      expect(res.rows?.[0].hasRegulatory).toBe(true);
      expect(res.rows?.[0].payload?.regulatory_compliance).toMatchObject({
        us_classification: "COSMETIC",
        mocra_listing_status: "LISTED",
        mocra_listing_number: "MOCRA-12345",
        otc_applicability: "NOT_APPLICABLE",
        otc_listing_status: "NOT_APPLICABLE",
        drug_facts_status: "NOT_APPLICABLE",
      });
      expect(res.summary?.rowsWithRegulatoryCount).toBe(1);
    });
  });

  describe("5. Legacy Excel Import & Lossless Mapping Compatibility", () => {
    it("maps legacy regulatory attributes via mapLegacyRegulatoryValues with review warning when V1 enabled", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "FDA 등록/승인 상태 (FDA Status)",
          "MoCRA 준수 상태 (MoCRA Status)",
          "OTC 의약품 여부 (OTC Drug Status)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "LEGACY-MAP-001",
            "영문 제품명 (Product Name EN) *": "Legacy Mapped Essence",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "FDA 등록/승인 상태 (FDA Status)": "등록 완료 (Registered)",
            "MoCRA 준수 상태 (MoCRA Status)": "시설 등록 완료 (Facility Registered)",
            "OTC 의약품 여부 (OTC Drug Status)": "해당 없음 (Not OTC)",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "legacy_r4_import.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: true,
      });

      expect(res.success).toBe(true);
      // Row is importable with WARNING status to alert brand user to review mapped compliance values
      expect(res.rows?.[0].status).toBe("WARNING");
      expect(res.rows?.[0].warnings.some((w) => w.includes("레거시 규제 매핑"))).toBe(true);
      expect(res.rows?.[0].payload?.regulatory_compliance).toMatchObject({
        us_classification: "UNDETERMINED",
        otc_applicability: "NOT_APPLICABLE",
        mocra_listing_status: "UNKNOWN",
      });
      expect(res.rows?.[0].payload?.regulatory_compliance?.legacy_migration_snapshot).toBeDefined();
    });

    it("leaves legacy attributes in common attributes without warnings when V1 is disabled", () => {
      const buf = buildWorkbookBytes(
        [
          "브랜드 (Brand) *",
          "브랜드 SKU (Brand SKU) *",
          "영문 제품명 (Product Name EN) *",
          "카테고리 (1Depth) *",
          "MoCRA 준수 상태 (MoCRA Status)",
        ],
        [
          {
            "브랜드 (Brand) *": "Glowella",
            "브랜드 SKU (Brand SKU) *": "LEGACY-RAW-001",
            "영문 제품명 (Product Name EN) *": "Pure Legacy Product",
            "카테고리 (1Depth) *": "스킨케어 (Skincare)",
            "MoCRA 준수 상태 (MoCRA Status)": "시설 등록 완료 (Facility Registered)",
          },
        ]
      );

      const res = parseAndValidateBulkProductWorkbook({
        fileName: "legacy_non_v1.xlsx",
        buffer: buf,
        companyBrands: SAMPLE_BRANDS,
        allCategories: SAMPLE_CATEGORIES,
        existingCompanySkus: new Set(),
        existingUpcs: new Set(),
        existingEans: new Set(),
        isComplianceV1: false,
      });

      expect(res.success).toBe(true);
      expect(res.rows?.[0].status).toBe("VALID");
      expect(res.rows?.[0].warnings.length).toBe(0);
      expect(res.rows?.[0].payload?.regulatory_compliance).toBeNull();
    });
  });
});
