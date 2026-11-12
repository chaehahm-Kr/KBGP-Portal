import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  ALLOWED_COLOR_MAPS,
  BULK_IMPORT_MAX_ROWS,
  BULK_PRODUCT_COLUMNS,
  BULK_TEMPLATE_EXAMPLE_SKU,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkRejectedRowItem,
} from "@/lib/product/bulk-import-types";
import { VOLUME_UNITS } from "@/lib/product/types";
import { ALL_COUNTRIES } from "@/lib/constants/countries";
import { sanitizeExcelOutputCell } from "@/lib/product/bulk-import-validator";

export interface GenerateTemplateOptions {
  brands: BulkReferenceBrand[];
  categories: BulkReferenceCategory[];
}

function buildCategoryReferenceRows(categories: BulkReferenceCategory[]) {
  const active = categories.filter((c) => c.is_active !== false);
  const d1List = active.filter((c) => c.depth === 1);
  const d2List = active.filter((c) => c.depth === 2);
  const d3List = active.filter((c) => c.depth === 3);

  if (d1List.length === 0) {
    return [
      ["SKINCARE", "Skincare", "스킨케어", "", "", "", "", "", "", "SKINCARE"],
      ["HAIR_CARE", "Hair Care", "헤어케어", "", "", "", "", "", "", "HAIR_CARE"],
      ["BEAUTY_TOOLS", "Beauty Tools", "뷰티툴", "", "", "", "", "", "", "BEAUTY_TOOLS"],
      ["BODY_CARE", "Body Care", "바디케어", "", "", "", "", "", "", "BODY_CARE"],
      ["PERSONAL_CARE", "Personal Care", "퍼스널케어", "", "", "", "", "", "", "PERSONAL_CARE"],
      ["MAKEUP", "Makeup", "메이크업", "", "", "", "", "", "", "MAKEUP"],
      ["SETS_COLLECTIONS", "Sets & Collections", "세트/기획", "", "", "", "", "", "", "SETS_COLLECTIONS"],
      ["OTHER", "Other", "기타", "", "", "", "", "", "", "OTHER"],
    ];
  }

  const rows: string[][] = [];
  for (const d1 of d1List) {
    const children2 = d2List.filter((c) => c.parent_code === d1.code);
    if (children2.length === 0) {
      rows.push([
        d1.code,
        d1.name_en || d1.code,
        d1.name_ko,
        "",
        "",
        "",
        "",
        "",
        "",
        d1.code,
      ]);
      continue;
    }

    for (const d2 of children2) {
      const children3 = d3List.filter((c) => c.parent_code === d2.code);
      if (children3.length === 0) {
        rows.push([
          d1.code,
          d1.name_en || d1.code,
          d1.name_ko,
          d2.code,
          d2.name_en || d2.code,
          d2.name_ko,
          "",
          "",
          "",
          d2.code,
        ]);
        continue;
      }

      for (const d3 of children3) {
        rows.push([
          d1.code,
          d1.name_en || d1.code,
          d1.name_ko,
          d2.code,
          d2.name_en || d2.code,
          d2.name_ko,
          d3.code,
          d3.name_en || d3.code,
          d3.name_ko,
          d3.code,
        ]);
      }
    }
  }

  return rows;
}

async function injectDropdownValidations(
  xlsxBuffer: Buffer,
  counts: {
    brandCount: number;
    depth1Count: number;
    volumeUnitCount: number;
    countryCount: number;
    leadTimeUnitCount: number;
    colorMapCount: number;
  }
): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(xlsxBuffer);
    const sheet1File = zip.file("xl/worksheets/sheet1.xml");
    if (!sheet1File) return xlsxBuffer;

    let xml = await sheet1File.async("string");
    if (xml.includes("<dataValidations")) return xlsxBuffer;

    const maxRow = BULK_IMPORT_MAX_ROWS + 2; // Header + example + 500 rows
    const validations: string[] = [];

    const colLetterForKey = (key: string): string | null => {
      const idx = BULK_PRODUCT_COLUMNS.findIndex((c) => c.key === key);
      return idx >= 0 ? XLSX.utils.encode_col(idx) : null;
    };

    const pushListValidation = (colKey: string, formulaRange: string) => {
      const col = colLetterForKey(colKey);
      if (!col) return;
      validations.push(
        `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="${col}2:${col}${maxRow}"><formula1>${formulaRange}</formula1></dataValidation>`
      );
    };

    if (counts.brandCount > 0) {
      pushListValidation("brand", `Brands!$A$2:$A$${counts.brandCount + 1}`);
    }
    if (counts.depth1Count > 0) {
      pushListValidation("category1Depth", `Allowed_Values!$A$2:$A$${counts.depth1Count + 1}`);
    }
    pushListValidation("volumeUnit", `Allowed_Values!$B$2:$B$${counts.volumeUnitCount + 1}`);
    pushListValidation("countryOfOrigin", `Countries!$A$2:$A$${counts.countryCount + 1}`);
    pushListValidation("leadTimeUnit", `Allowed_Values!$C$2:$C$${counts.leadTimeUnitCount + 1}`);
    pushListValidation("colorMap", `Allowed_Values!$D$2:$D$${counts.colorMapCount + 1}`);
    pushListValidation("sellingOnline", `Allowed_Values!$E$2:$E$3`);
    pushListValidation("sellingOffline", `Allowed_Values!$E$2:$E$3`);
    pushListValidation("parentSku", `Allowed_Values!$F$2:$F$3`);
    pushListValidation("childSku", `Allowed_Values!$F$2:$F$3`);

    if (validations.length === 0) return xlsxBuffer;

    const block = `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>`;
    if (xml.includes("<pageMargins")) {
      xml = xml.replace("<pageMargins", `${block}<pageMargins`);
    } else {
      xml = xml.replace("</worksheet>", `${block}</worksheet>`);
    }

    zip.file("xl/worksheets/sheet1.xml", xml);
    return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  } catch {
    return xlsxBuffer;
  }
}

export async function generateBulkProductTemplateBuffer(
  options: GenerateTemplateOptions
): Promise<Buffer> {
  const activeBrands = options.brands.filter((b) => b.is_active !== false);
  const activeCategories = options.categories.filter((c) => c.is_active !== false);

  const sampleBrandName = activeBrands[0]?.name || "Your Active Brand Name";
  const sampleSkincareD1 =
    activeCategories.find((c) => c.depth === 1 && c.code === "SKINCARE") ||
    activeCategories.find((c) => c.depth === 1);
  const sampleD2 = sampleSkincareD1
    ? activeCategories.find((c) => c.depth === 2 && c.parent_code === sampleSkincareD1.code)
    : undefined;
  const sampleD3 = sampleD2
    ? activeCategories.find((c) => c.depth === 3 && c.parent_code === sampleD2.code)
    : undefined;

  const exampleByKey: Record<string, string | number> = {
    brand: sampleBrandName,
    manufactureSku: BULK_TEMPLATE_EXAMPLE_SKU,
    productNameEn: "[EXAMPLE] Gentle Cica Soothing Toner 200ml",
    category1Depth: sampleSkincareD1?.name_en || "Skincare",
    productNameKo: "시카 수딩 토너 200ml",
    category2Depth: sampleD2?.name_en || "",
    category3Depth: sampleD3?.name_en || "",
    volumeValue: 200,
    volumeUnit: "ml",
    countryOfOrigin: "South Korea",
    leadTimeValue: 14,
    leadTimeUnit: "Days",
    color: "Clear",
    colorMap: "Clear",
    description: "Calming daily facial toner formulated with Centella Asiatica extract.",
    bulletPoint1: "Helps soothe sensitive skin barrier",
    bulletPoint2: "Lightweight fast-absorbing watery texture",
    bulletPoint3: "Dermatologically tested daily toner",
    bulletPoint4: "",
    bulletPoint5: "",
    howToUse: "After cleansing, apply an appropriate amount onto face using a cotton pad or hands.",
    ingredients: "Water, Centella Asiatica Extract, Glycerin, Panthenol, 1,2-Hexanediol",
    parentSku: "N",
    childSku: "N",
    upc: "012345678905",
    ean: "8801234567890",
    sellingOnline: "TRUE",
    sellingOffline: "FALSE",
    salesLink1: "https://example.com/products/gentle-cica-toner",
    salesLink2: "",
    retailPriceKrw: 24000,
    wholesalePriceKrw: 11000,
    estimatedRetailPriceUsd: 22.0,
    exportFobPriceUsd: 8.5,
    itemWidth: 4.8,
    itemDepth: 4.8,
    itemHeight: 16.2,
    itemWeight: 245,
    packageWidth: 5.2,
    packageDepth: 5.2,
    packageHeight: 16.8,
    packageWeight: 275,
    cartonPackQty: 24,
    cartonWidth: 33.0,
    cartonDepth: 22.5,
    cartonHeight: 18.5,
    cartonWeight: 7.1,
    palletCartonQty: 40,
    palletWidth: 110,
    palletDepth: 110,
    palletHeight: 145,
    palletWeight: 299,
  };

  const wb = XLSX.utils.book_new();

  // 1. Products Sheet (Primary sheet)
  const headers = BULK_PRODUCT_COLUMNS.map((c) => c.header);
  const exampleRow = BULK_PRODUCT_COLUMNS.map((c) => exampleByKey[c.key] ?? "");
  const productsSheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  productsSheet["!cols"] = BULK_PRODUCT_COLUMNS.map((c) => ({ wch: c.width }));

  // Force text cell format '@' on Manufacturer SKU, UPC, and EAN columns (example row + blank starter rows)
  BULK_PRODUCT_COLUMNS.forEach((col, colIdx) => {
    if (!col.textFormat) return;
    const exAddr = XLSX.utils.encode_cell({ r: 1, c: colIdx });
    if (productsSheet[exAddr]) {
      productsSheet[exAddr].t = "s";
      productsSheet[exAddr].v = String(exampleByKey[col.key] ?? "");
      productsSheet[exAddr].z = "@";
    }
  });

  XLSX.utils.book_append_sheet(wb, productsSheet, "Products");

  // 2. Instructions Sheet
  const instructionsAOA: (string | number)[][] = [
    ["K SELECT NETWORK — Brand Portal Excel Bulk Product Registration Guide (V1)"],
    [],
    ["1. CORE RULES"],
    ["- Primary Sheet:", 'Enter one product per row in the "Products" sheet (maximum 500 product rows per upload).'],
    ["- Minimum Required Fields (4):", "Only Brand *, Manufacturer SKU *, Product Name EN *, and Category 1Depth * are mandatory to create Draft products."],
    ["- Example Row:", `Row 2 (${BULK_TEMPLATE_EXAMPLE_SKU}) is a sample guide row. You may delete it or leave it — the importer automatically skips ${BULK_TEMPLATE_EXAMPLE_SKU}.`],
    ["- Draft Workflow:", "All imported products are registered as Draft (보완 대기 / UNREVIEWED) and remain hidden from Retailer Hub until images, category attributes, and remaining required specs are completed."],
    ["- Text Formatting (Barcodes & SKU):", "Keep Manufacturer SKU, UPC (12 Digits), and EAN (13 Digits) formatted as Text (@) so leading zeros (e.g., 012345678905) are preserved."],
    ["- Country of Origin:", "Leave Country of Origin blank if not yet confirmed. Blank values are stored as empty (never defaulted automatically)."],
    ["- Excluded from Excel V1:", "Product images, videos, certificate files, category-specific attribute profiles, Letusto SKU, and computed CBM/container simulations are completed in Brand Portal after import."],
    ["- Security:", "Do not include Excel formulas (=SUM, =HYPERLINK, etc.). Upload plain values (.xlsx only)."],
    [],
    ["2. COLUMN SPECIFICATIONS"],
    ["Column Header", "Requirement", "Section", "Database Mapping", "Format & Validation Rules"],
    ...BULK_PRODUCT_COLUMNS.map((c) => [
      c.header,
      c.required ? "REQUIRED" : "Optional",
      c.section,
      c.dbColumn,
      c.description,
    ]),
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsAOA);
  instructionsSheet["!cols"] = [
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 76 },
  ];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  // 3. Brands Sheet
  const brandsAOA = [
    ["Brand Name", "Status"],
    ...(activeBrands.length > 0
      ? activeBrands.map((b) => [sanitizeExcelOutputCell(b.name), "ACTIVE"])
      : [["(No active brands found for company)", "INACTIVE"]]),
  ];
  const brandsSheet = XLSX.utils.aoa_to_sheet(brandsAOA);
  brandsSheet["!cols"] = [{ wch: 32 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, brandsSheet, "Brands");

  // 4. Categories Sheet
  const categoryRefRows = buildCategoryReferenceRows(activeCategories);
  const categoriesAOA = [
    [
      "Category 1Depth Code",
      "Category 1Depth Name (EN)",
      "Category 1Depth Name (KO)",
      "Category 2Depth Code",
      "Category 2Depth Name (EN)",
      "Category 2Depth Name (KO)",
      "Category 3Depth Code",
      "Category 3Depth Name (EN)",
      "Category 3Depth Name (KO)",
      "Resolved Category Code",
    ],
    ...categoryRefRows,
  ];
  const categoriesSheet = XLSX.utils.aoa_to_sheet(categoriesAOA);
  categoriesSheet["!cols"] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 26 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, categoriesSheet, "Categories");

  // 5. Countries Sheet
  const countriesAOA = [
    ["Canonical Country Name (EN)", "Country Name (KO)", "ISO Alpha-2 Code"],
    ...ALL_COUNTRIES.map((c) => [c.name, c.nameKo, c.code]),
  ];
  const countriesSheet = XLSX.utils.aoa_to_sheet(countriesAOA);
  countriesSheet["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, countriesSheet, "Countries");

  // 6. Allowed_Values Sheet
  const depth1Names =
    activeCategories.filter((c) => c.depth === 1).length > 0
      ? activeCategories
          .filter((c) => c.depth === 1)
          .map((c) => c.name_en || c.code)
      : [
          "Skincare",
          "Hair Care",
          "Makeup",
          "Body Care",
          "Personal Care",
          "Beauty Tools",
          "Sets & Collections",
          "Other",
        ];
  const volumeUnits = VOLUME_UNITS.map((u) => u.value);
  const leadTimeUnits = ["Days", "Weeks", "Months"];
  const colorMaps = [...ALLOWED_COLOR_MAPS];
  const booleans = ["TRUE", "FALSE"];
  const flags = ["Y", "N"];

  const maxAllowedLen = Math.max(
    depth1Names.length,
    volumeUnits.length,
    leadTimeUnits.length,
    colorMaps.length,
    booleans.length,
    flags.length
  );

  const allowedAOA: string[][] = [
    [
      "Category 1Depth",
      "Volume Unit",
      "Lead Time Unit",
      "Color Map",
      "Boolean (Selling Online/Offline)",
      "Parent/Child SKU Flag",
    ],
  ];
  for (let i = 0; i < maxAllowedLen; i++) {
    allowedAOA.push([
      depth1Names[i] || "",
      volumeUnits[i] || "",
      leadTimeUnits[i] || "",
      colorMaps[i] || "",
      booleans[i] || "",
      flags[i] || "",
    ]);
  }
  const allowedSheet = XLSX.utils.aoa_to_sheet(allowedAOA);
  allowedSheet["!cols"] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, allowedSheet, "Allowed_Values");

  const rawBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return injectDropdownValidations(rawBuf, {
    brandCount: activeBrands.length,
    depth1Count: depth1Names.length,
    volumeUnitCount: volumeUnits.length,
    countryCount: ALL_COUNTRIES.length,
    leadTimeUnitCount: leadTimeUnits.length,
    colorMapCount: colorMaps.length,
  });
}

export function generateBulkImportErrorBuffer(
  rejectedRows: BulkRejectedRowItem[]
): Buffer {
  const wb = XLSX.utils.book_new();

  const header = [
    "Excel Row Number",
    "Manufacturer SKU",
    "Product Name",
    "Error Reason",
    "Corrective Guidance",
  ];

  const rows = rejectedRows.map((item) => [
    item.excelRowNumber,
    sanitizeExcelOutputCell(item.manufactureSku),
    sanitizeExcelOutputCell(item.productName),
    sanitizeExcelOutputCell(item.errorReason),
    sanitizeExcelOutputCell(item.correctiveGuidance),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 34 },
    { wch: 52 },
    { wch: 54 },
  ];

  // Force string cell types on columns B..E to prevent any formula interpretation
  for (let r = 1; r <= rows.length; r++) {
    for (let c = 1; c <= 4; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        ws[addr].t = "s";
        delete ws[addr].f;
        ws[addr].z = "@";
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Import_Errors");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
