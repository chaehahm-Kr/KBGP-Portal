import JSZip from "jszip";
import {
  ALLOWED_COLOR_MAPS,
  BULK_IMPORT_MAX_ROWS,
  BULK_PRODUCT_COLUMNS,
  BULK_TEMPLATE_EXAMPLE_SKU,
  COMMON_BULK_ATTRIBUTES,
  type BulkColumnSection,
  type BulkCommonAttributeOptionSpec,
  type BulkCommonAttributeSpec,
  type BulkMediaFailureItem,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkReferenceCommonAttribute,
  type BulkRejectedRowItem,
} from "@/lib/product/bulk-import-types";
import { VOLUME_UNITS } from "@/lib/product/types";
import { ALL_COUNTRIES } from "@/lib/constants/countries";
import {
  formatBilingualCategoryLabel,
  sanitizeExcelOutputCell,
} from "@/lib/product/bulk-import-validator";

export interface GenerateTemplateOptions {
  brands: BulkReferenceBrand[];
  categories: BulkReferenceCategory[];
  commonAttributes?: BulkReferenceCommonAttribute[];
}

// Style indices matching buildStylesXml() cellXfs order (0..24)
const STYLE = {
  DEFAULT: 0,
  TEXT_AT: 1, // Default body cell with '@' Text format (SKU, UPC, EAN columns)
  GROUP_REQUIRED: 2,
  GROUP_CATEGORY: 3,
  GROUP_BASIC: 4,
  GROUP_PRICING: 5,
  GROUP_LOGISTICS: 6,
  HDR_REQUIRED: 7,
  HDR_CATEGORY: 8,
  HDR_BASIC: 9,
  HDR_PRICING: 10,
  HDR_LOGISTICS: 11,
  EXAMPLE_GENERAL: 12,
  EXAMPLE_TEXT_AT: 13,
  EXAMPLE_NUMBER: 14,
  REF_HEADER: 15,
  REF_BODY: 16,
  REF_BODY_TEXT_AT: 17,
  TITLE_BANNER: 18,
  SECTION_HEADER: 19,
  ERROR_HEADER: 20,
  GROUP_MEDIA: 21,
  HDR_MEDIA: 22,
  GROUP_COMMON_ATTR: 23,
  HDR_COMMON_ATTR: 24,
} as const;

interface OoxmlCellSpec {
  value: string | number | null | undefined;
  style?: number;
  forceString?: boolean;
}

interface OoxmlRowSpec {
  height?: number;
  cells: (OoxmlCellSpec | string | number | null | undefined)[];
}

interface OoxmlColSpec {
  width: number;
  style?: number;
  hidden?: boolean;
}

interface OoxmlDataValidationSpec {
  sqref: string;
  formula1: string;
}

interface OoxmlSheetSpec {
  name: string;
  cols: OoxmlColSpec[];
  rows: OoxmlRowSpec[];
  merges?: string[];
  freezeRows?: number;
  activeCell?: string;
  autoFilterRef?: string;
  dataValidations?: OoxmlDataValidationSpec[];
  defaultRowHeight?: number;
}

function escapeXml(raw: string): string {
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function encodeColLetter(colIdxZeroBased: number): string {
  let n = colIdxZeroBased + 1;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function encodeCellAddress(rowOneBased: number, colZeroBased: number): string {
  return `${encodeColLetter(colZeroBased)}${rowOneBased}`;
}

class SharedStringTable {
  private indexByText = new Map<string, number>();
  private uniqueStrings: string[] = [];
  private totalRefs = 0;

  public add(text: string): number {
    this.totalRefs += 1;
    const existing = this.indexByText.get(text);
    if (existing !== undefined) {
      return existing;
    }
    const idx = this.uniqueStrings.length;
    this.uniqueStrings.push(text);
    this.indexByText.set(text, idx);
    return idx;
  }

  public toXml(): string {
    const items = this.uniqueStrings
      .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
      .join("");
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.totalRefs}" uniqueCount="${this.uniqueStrings.length}">` +
      items +
      `</sst>`
    );
  }
}

function buildStylesXml(): string {
  // Fonts (0..12):
  // 11: Malgun Gothic 10pt bold #5B21B6 (Media Group/Header Violet)
  // 12: Malgun Gothic 10pt bold #3730A3 (Common Attribute Group/Header Indigo)
  // Fills (0..18):
  // 15: #EDE9FE (Media Group Violet)
  // 16: #F5F3FF (Media Col Header Pale Violet)
  // 17: #E0E7FF (Common Attr Group Indigo)
  // 18: #EEF2FF (Common Attr Col Header Pale Indigo)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="13">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E3A8A"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF0C4A6E"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E293B"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF065F46"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF78350F"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><i/><sz val="9.5"/><color rgb="FF475569"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10.5"/><color rgb="FF1E293B"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF5B21B6"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF3730A3"/><name val="맑은 고딕"/><charset val="129"/></font>
  </fonts>
  <fills count="19">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0F9FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEFCE8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF991B1B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF5F3FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF93C5FD"/></left>
      <right style="thin"><color rgb="FF93C5FD"/></right>
      <top style="thin"><color rgb="FF93C5FD"/></top>
      <bottom style="medium"><color rgb="FF2563EB"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="medium"><color rgb="FF64748B"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="25">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="8" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="9" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="10" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="11" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="12" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="49" fontId="7" fillId="12" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="12" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="13" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="8" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="14" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="11" fillId="15" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="11" fillId="16" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="12" fillId="17" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="12" fillId="18" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function normalizeCellSpec(
  raw: OoxmlCellSpec | string | number | null | undefined
): OoxmlCellSpec {
  if (raw !== null && typeof raw === "object" && ("value" in raw || "style" in raw)) {
    return raw as OoxmlCellSpec;
  }
  return { value: raw as string | number | null | undefined };
}

function buildWorksheetXml(
  sheet: OoxmlSheetSpec,
  sst: SharedStringTable,
  isFirstSheet: boolean
): string {
  const maxRow = Math.max(sheet.rows.length, 1);
  let maxCol = Math.max(sheet.cols.length, 1);
  for (const r of sheet.rows) {
    if (r.cells.length > maxCol) maxCol = r.cells.length;
  }

  const dimensionRef = `A1:${encodeCellAddress(maxRow, maxCol - 1)}`;

  // 1. sheetViews (strict CT_Worksheet position #2)
  const tabSelectedAttr = isFirstSheet ? ` tabSelected="1"` : "";
  let sheetViewInner = "";
  if (sheet.freezeRows && sheet.freezeRows > 0) {
    const topLeft = `A${sheet.freezeRows + 1}`;
    const active = sheet.activeCell || topLeft;
    sheetViewInner =
      `<pane ySplit="${sheet.freezeRows}" topLeftCell="${topLeft}" activePane="bottomLeft" state="frozen"/>` +
      `<selection pane="bottomLeft" activeCell="${active}" sqref="${active}"/>`;
  } else if (sheet.activeCell) {
    sheetViewInner = `<selection activeCell="${sheet.activeCell}" sqref="${sheet.activeCell}"/>`;
  }
  const sheetViewsXml = sheetViewInner
    ? `<sheetViews><sheetView${tabSelectedAttr} workbookViewId="0">${sheetViewInner}</sheetView></sheetViews>`
    : `<sheetViews><sheetView${tabSelectedAttr} workbookViewId="0"/></sheetViews>`;

  // 2. sheetFormatPr (strict CT_Worksheet position #3)
  const defaultRowHeight = sheet.defaultRowHeight ?? 19;
  const sheetFormatPrXml = `<sheetFormatPr defaultRowHeight="${defaultRowHeight}"/>`;

  // 3. cols (strict CT_Worksheet position #4)
  let colsXml = "";
  if (sheet.cols.length > 0) {
    const colItems = sheet.cols
      .map((c, idx) => {
        const colNum = idx + 1;
        const styleAttr = c.style !== undefined ? ` style="${c.style}"` : "";
        const hiddenAttr = c.hidden ? ` hidden="1"` : "";
        const w = Number((c.width + 1.5).toFixed(2));
        return `<col min="${colNum}" max="${colNum}" width="${w}" customWidth="1"${styleAttr}${hiddenAttr}/>`;
      })
      .join("");
    colsXml = `<cols>${colItems}</cols>`;
  }

  // 4. sheetData (strict CT_Worksheet position #5)
  const rowXmlList: string[] = [];
  for (let rIdx = 0; rIdx < sheet.rows.length; rIdx++) {
    const rowSpec = sheet.rows[rIdx];
    const rOne = rIdx + 1;
    const htAttr =
      rowSpec.height !== undefined
        ? ` ht="${rowSpec.height}" customHeight="1"`
        : "";

    const cellXmlList: string[] = [];
    for (let cIdx = 0; cIdx < rowSpec.cells.length; cIdx++) {
      const cell = normalizeCellSpec(rowSpec.cells[cIdx]);
      const addr = encodeCellAddress(rOne, cIdx);
      const styleAttr = cell.style !== undefined ? ` s="${cell.style}"` : "";

      if (cell.value === null || cell.value === undefined || cell.value === "") {
        if (cell.style !== undefined || cell.forceString) {
          if (cell.forceString) {
            const sstIdx = sst.add("");
            cellXmlList.push(`<c r="${addr}"${styleAttr} t="s"><v>${sstIdx}</v></c>`);
          } else {
            cellXmlList.push(`<c r="${addr}"${styleAttr}/>`);
          }
        }
        continue;
      }

      if (typeof cell.value === "number" && Number.isFinite(cell.value) && !cell.forceString) {
        cellXmlList.push(`<c r="${addr}"${styleAttr}><v>${cell.value}</v></c>`);
      } else {
        const sstIdx = sst.add(String(cell.value));
        cellXmlList.push(`<c r="${addr}"${styleAttr} t="s"><v>${sstIdx}</v></c>`);
      }
    }

    rowXmlList.push(`<row r="${rOne}"${htAttr}>${cellXmlList.join("")}</row>`);
  }
  const sheetDataXml = `<sheetData>${rowXmlList.join("")}</sheetData>`;

  // 5. autoFilter -> mergeCells -> dataValidations -> pageMargins (strict ECMA-376 sequence)
  const autoFilterXml = sheet.autoFilterRef
    ? `<autoFilter ref="${sheet.autoFilterRef}"/>`
    : "";

  const mergeCellsXml =
    sheet.merges && sheet.merges.length > 0
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
          .map((m) => `<mergeCell ref="${m}"/>`)
          .join("")}</mergeCells>`
      : "";

  const dataValidationsXml =
    sheet.dataValidations && sheet.dataValidations.length > 0
      ? `<dataValidations count="${sheet.dataValidations.length}">${sheet.dataValidations
          .map(
            (dv) =>
              `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="${dv.sqref}"><formula1>${escapeXml(
                dv.formula1
              )}</formula1></dataValidation>`
          )
          .join("")}</dataValidations>`
      : "";

  const pageMarginsXml = `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="${dimensionRef}"/>` +
    sheetViewsXml +
    sheetFormatPrXml +
    colsXml +
    sheetDataXml +
    autoFilterXml +
    mergeCellsXml +
    dataValidationsXml +
    pageMarginsXml +
    `</worksheet>`
  );
}

async function buildOoxmlWorkbookBuffer(sheets: OoxmlSheetSpec[]): Promise<Buffer> {
  const zip = new JSZip();
  const sst = new SharedStringTable();

  sheets.forEach((sheet, idx) => {
    const xml = buildWorksheetXml(sheet, sst, idx === 0);
    zip.file(`xl/worksheets/sheet${idx + 1}.xml`, xml);
  });

  zip.file("xl/sharedStrings.xml", sst.toXml());
  zip.file("xl/styles.xml", buildStylesXml());

  const sheetEntries = sheets
    .map(
      (s, idx) =>
        `<sheet name="${escapeXml(s.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`
    )
    .join("");
  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14400"/></bookViews>` +
    `<sheets>${sheetEntries}</sheets>` +
    `</workbook>`;
  zip.file("xl/workbook.xml", workbookXml);

  const stylesRelId = sheets.length + 1;
  const sstRelId = sheets.length + 2;
  const sheetRels = sheets
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join("");
  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetRels +
    `<Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId${sstRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
    `</Relationships>`;
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);

  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  zip.file("_rels/.rels", rootRelsXml);

  const sheetOverrides = sheets
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheetOverrides +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
    `</Types>`;
  zip.file("[Content_Types].xml", contentTypesXml);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function buildCategoryReferenceAndLookupTables(categories: BulkReferenceCategory[]): {
  hierarchyRows: string[][];
  d1ToD2Pairs: [string, string][];
  d2ToD3Pairs: [string, string][];
  hasDependentHierarchy: boolean;
} {
  const active = categories.filter((c) => c.is_active !== false);
  const d1List = active.filter((c) => c.depth === 1);
  const d2List = active.filter((c) => c.depth === 2);
  const d3List = active.filter((c) => c.depth === 3);

  if (d1List.length === 0) {
    const fallbackRows = [
      ["SKINCARE", "Skincare", "스킨케어", "", "", "", "", "", "", "SKINCARE"],
      ["HAIR_CARE", "Hair Care", "헤어케어", "", "", "", "", "", "", "HAIR_CARE"],
      ["BEAUTY_TOOLS", "Beauty Tools", "뷰티툴", "", "", "", "", "", "", "BEAUTY_TOOLS"],
      ["BODY_CARE", "Body Care", "바디케어", "", "", "", "", "", "", "BODY_CARE"],
      ["PERSONAL_CARE", "Personal Care", "퍼스널케어", "", "", "", "", "", "", "PERSONAL_CARE"],
      ["MAKEUP", "Makeup", "메이크업", "", "", "", "", "", "", "MAKEUP"],
      ["SETS_COLLECTIONS", "Sets & Collections", "세트/기획", "", "", "", "", "", "", "SETS_COLLECTIONS"],
      ["OTHER", "Other", "기타", "", "", "", "", "", "", "OTHER"],
    ];
    return {
      hierarchyRows: fallbackRows,
      d1ToD2Pairs: [],
      d2ToD3Pairs: [],
      hasDependentHierarchy: false,
    };
  }

  const hierarchyRows: string[][] = [];
  const d1ToD2Pairs: [string, string][] = [];
  const d2ToD3Pairs: [string, string][] = [];

  // Guard parent aliases case-insensitively because Excel MATCH/COUNTIF are case-insensitive!
  const usedD1ParentKeysLower = new Set<string>();
  const usedD2ParentKeysLower = new Set<string>();

  const collectUniqueParentAliases = (
    cat: BulkReferenceCategory,
    usedGlobalSet: Set<string>
  ): string[] => {
    const candidates = [
      formatBilingualCategoryLabel(cat),
      (cat.name_en || "").trim(),
      cat.name_ko.trim(),
      cat.code.trim(),
    ].filter((s) => s !== "");

    const accepted: string[] = [];
    for (const candidate of candidates) {
      const lower = candidate.toLowerCase();
      if (usedGlobalSet.has(lower)) continue;
      usedGlobalSet.add(lower);
      accepted.push(candidate);
    }
    return accepted;
  };

  for (const d1 of d1List) {
    const children2 = d2List.filter((c) => c.parent_code === d1.code);
    const d1Aliases = collectUniqueParentAliases(d1, usedD1ParentKeysLower);
    const child2Labels =
      children2.length > 0 ? children2.map((c) => formatBilingualCategoryLabel(c)) : [""];

    for (const alias of d1Aliases) {
      for (const cLabel of child2Labels) {
        d1ToD2Pairs.push([alias, cLabel]);
      }
    }

    if (children2.length === 0) {
      hierarchyRows.push([
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
      const d2Aliases = collectUniqueParentAliases(d2, usedD2ParentKeysLower);
      const child3Labels =
        children3.length > 0 ? children3.map((c) => formatBilingualCategoryLabel(c)) : [""];

      for (const alias of d2Aliases) {
        for (const cLabel of child3Labels) {
          d2ToD3Pairs.push([alias, cLabel]);
        }
      }

      if (children3.length === 0) {
        hierarchyRows.push([
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
        hierarchyRows.push([
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

  return {
    hierarchyRows,
    d1ToD2Pairs,
    d2ToD3Pairs,
    hasDependentHierarchy: d2List.length > 0,
  };
}

function resolveTemplateCommonAttributes(
  liveAttrs?: BulkReferenceCommonAttribute[]
): BulkCommonAttributeSpec[] {
  if (!liveAttrs || liveAttrs.length === 0) {
    return COMMON_BULK_ATTRIBUTES;
  }

  const byCode = new Map<string, BulkReferenceCommonAttribute>();
  for (const la of liveAttrs) {
    if (la.isActive !== false) {
      byCode.set(la.code.toUpperCase(), la);
    }
  }

  return COMMON_BULK_ATTRIBUTES.map((spec) => {
    const live = byCode.get(spec.code.toUpperCase());
    if (!live || live.options.length === 0) return spec;

    const staticMap = new Map<string, BulkCommonAttributeOptionSpec>();
    for (const o of spec.options) staticMap.set(o.optionCode.toUpperCase(), o);

    return {
      ...spec,
      allowNa: live.allowNa,
      allowOther: live.allowOther,
      options: live.options.map((lo) => {
        const st = staticMap.get(lo.optionCode.toUpperCase());
        return {
          optionCode: lo.optionCode,
          optionKo: lo.optionKo || st?.optionKo || lo.optionCode,
          optionEn: lo.optionEn || st?.optionEn || lo.optionCode,
          aliases: st?.aliases,
          adminOnlyOption:
            st?.adminOnlyOption ?? lo.optionCode.toUpperCase() === "ADMIN_VERIFIED",
        };
      }),
    };
  });
}

function formatBilingualOptionLabel(opt: BulkCommonAttributeOptionSpec): string {
  const ko = (opt.optionKo || "").trim();
  const en = (opt.optionEn || "").trim();
  if (ko && en && ko.toLowerCase() !== en.toLowerCase()) {
    return `${ko} (${en})`;
  }
  return ko || en || opt.optionCode;
}

function getColumnHeaderStyle(section: BulkColumnSection): number {
  switch (section) {
    case "Required":
      return STYLE.HDR_REQUIRED;
    case "Category":
      return STYLE.HDR_CATEGORY;
    case "Basic Info":
      return STYLE.HDR_BASIC;
    case "Pricing":
      return STYLE.HDR_PRICING;
    case "Logistics":
      return STYLE.HDR_LOGISTICS;
    case "Media":
      return STYLE.HDR_MEDIA;
    case "Common Attributes":
      return STYLE.HDR_COMMON_ATTR;
  }
}

function getSectionNameKo(section: BulkColumnSection): string {
  switch (section) {
    case "Required":
      return "필수 항목 (Required)";
    case "Category":
      return "카테고리 (Category)";
    case "Basic Info":
      return "기본 정보 (Basic Info)";
    case "Pricing":
      return "가격 정보 (Pricing)";
    case "Logistics":
      return "물류 규격 (Logistics)";
    case "Media":
      return "미디어 URL (Media)";
    case "Common Attributes":
      return "공통 속성 (Common Attributes)";
  }
}

export async function generateBulkProductTemplateBuffer(
  options: GenerateTemplateOptions
): Promise<Buffer> {
  const activeBrands = options.brands.filter((b) => b.is_active !== false);
  const activeCategories = options.categories.filter((c) => c.is_active !== false);
  const commonAttrs = resolveTemplateCommonAttributes(options.commonAttributes);

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
    category1Depth: sampleSkincareD1 ? formatBilingualCategoryLabel(sampleSkincareD1) : "스킨케어 (Skincare)",
    category2Depth: sampleD2 ? formatBilingualCategoryLabel(sampleD2) : "",
    category3Depth: sampleD3 ? formatBilingualCategoryLabel(sampleD3) : "",
    productNameKo: "[예시행 - 업로드 시 자동 제외] 시카 수딩 토너 200ml",
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
    ean: "0880123456789",
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
    mainImageUrl: "https://cdn.example.com/products/cica-toner-main.jpg",
    additionalImageUrl2: "https://cdn.example.com/products/cica-toner-detail-2.jpg",
    additionalImageUrl3: "",
    additionalImageUrl4: "",
    additionalImageUrl5: "",
    additionalImageUrl6: "",
    additionalImageUrl7: "",
    additionalImageUrl8: "",
    additionalImageUrl9: "",
    additionalImageUrl10: "",
    productVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  };

  for (const attr of commonAttrs) {
    exampleByKey[attr.fieldKey] = attr.exampleValue;
  }

  // Build Categories hierarchy + dependent dropdown lookup tables
  const {
    hierarchyRows: categoryRefRows,
    d1ToD2Pairs,
    d2ToD3Pairs,
    hasDependentHierarchy,
  } = buildCategoryReferenceAndLookupTables(activeCategories);

  // =========================================================================
  // 1. Products Sheet (Row 1 = Group Banners, Row 2 = 86 Headers, Row 3 = Example)
  // =========================================================================
  const groupBannerSpans: Array<{
    startIdx: number;
    endIdx: number;
    label: string;
    style: number;
  }> = [
    {
      startIdx: 0,
      endIdx: 3,
      label: "★ 필수 입력 항목 (4개 필수 · Required)",
      style: STYLE.GROUP_REQUIRED,
    },
    {
      startIdx: 4,
      endIdx: 5,
      label: "세부 카테고리 · 연동 선택 (Category)",
      style: STYLE.GROUP_CATEGORY,
    },
    {
      startIdx: 6,
      endIdx: 13,
      label: "기본 정보 · 기본 스펙 (Basic Specs · 선택)",
      style: STYLE.GROUP_BASIC,
    },
    {
      startIdx: 14,
      endIdx: 21,
      label: "기본 정보 · 상세/성분 (Content & INCI · 선택)",
      style: STYLE.GROUP_BASIC,
    },
    {
      startIdx: 22,
      endIdx: 29,
      label: "기본 정보 · 바코드/판매처 (Barcodes & Links · 선택)",
      style: STYLE.GROUP_BASIC,
    },
    {
      startIdx: 30,
      endIdx: 33,
      label: "가격 정보 · 선택 (Pricing)",
      style: STYLE.GROUP_PRICING,
    },
    {
      startIdx: 34,
      endIdx: 41,
      label: "물류 규격 · 단품/포장 (Item & Package · 선택)",
      style: STYLE.GROUP_LOGISTICS,
    },
    {
      startIdx: 42,
      endIdx: 51,
      label: "물류 규격 · 카톤/파렛트 (Carton & Pallet · 선택)",
      style: STYLE.GROUP_LOGISTICS,
    },
    {
      startIdx: 52,
      endIdx: 62,
      label: "미디어 URL · 이미지 1~10 및 동영상 (Media URLs · 선택)",
      style: STYLE.GROUP_MEDIA,
    },
    {
      startIdx: 63,
      endIdx: 66,
      label: "공통 속성 · 유통/보관 (Shelf Life & Storage · 선택)",
      style: STYLE.GROUP_COMMON_ATTR,
    },
    {
      startIdx: 67,
      endIdx: 70,
      label: "공통 속성 · 패키지/제형 (Packaging & Format · 선택)",
      style: STYLE.GROUP_COMMON_ATTR,
    },
    {
      startIdx: 71,
      endIdx: 73,
      label: "공통 속성 · 대상 고객 (Target Customer · 선택)",
      style: STYLE.GROUP_COMMON_ATTR,
    },
    {
      startIdx: 74,
      endIdx: 78,
      label: "공통 속성 · 사용/주요고민 (Usage & Concerns · 선택)",
      style: STYLE.GROUP_COMMON_ATTR,
    },
    {
      startIdx: 79,
      endIdx: 81,
      label: "공통 속성 · 향 정보 (Fragrance · 선택)",
      style: STYLE.GROUP_COMMON_ATTR,
    },
    {
      startIdx: 82,
      endIdx: 85,
      label: "공통 속성 · 규제/등록 상태 (Regulatory · 브랜드 기재 · 선택)",
      style: STYLE.GROUP_COMMON_ATTR,
    },
  ];

  const groupBannerCells: OoxmlCellSpec[] = [];
  const productMerges: string[] = [];
  for (const span of groupBannerSpans) {
    for (let i = span.startIdx; i <= span.endIdx; i++) {
      groupBannerCells.push({
        value: i === span.startIdx ? span.label : "",
        style: span.style,
      });
    }
    if (span.endIdx > span.startIdx) {
      productMerges.push(
        `${encodeCellAddress(1, span.startIdx)}:${encodeCellAddress(1, span.endIdx)}`
      );
    }
  }

  const headerRowCells: OoxmlCellSpec[] = BULK_PRODUCT_COLUMNS.map((col) => ({
    value: col.header,
    style: getColumnHeaderStyle(col.section),
    forceString: true,
  }));

  const exampleRowCells: OoxmlCellSpec[] = BULK_PRODUCT_COLUMNS.map((col) => {
    const rawVal = exampleByKey[col.key] ?? "";
    if (col.textFormat) {
      return {
        value: String(rawVal),
        style: STYLE.EXAMPLE_TEXT_AT,
        forceString: true,
      };
    }
    if (typeof rawVal === "number") {
      return {
        value: rawVal,
        style: STYLE.EXAMPLE_NUMBER,
      };
    }
    return {
      value: String(rawVal),
      style: STYLE.EXAMPLE_GENERAL,
      forceString: true,
    };
  });

  const productCols: OoxmlColSpec[] = BULK_PRODUCT_COLUMNS.map((col) => ({
    width: col.width,
    style: col.textFormat ? STYLE.TEXT_AT : undefined,
  }));

  // Dropdown Lists (Row 3 example + 500 product rows = Rows 3..503)
  const depth1DropdownLabels =
    activeCategories.filter((c) => c.depth === 1).length > 0
      ? activeCategories
          .filter((c) => c.depth === 1)
          .map((c) => formatBilingualCategoryLabel(c))
      : [
          "스킨케어 (Skincare)",
          "헤어케어 (Hair Care)",
          "메이크업 (Makeup)",
          "바디케어 (Body Care)",
          "퍼스널케어 (Personal Care)",
          "뷰티툴 (Beauty Tools)",
          "세트/기획 (Sets & Collections)",
          "기타 (Other)",
        ];
  const volumeUnits = VOLUME_UNITS.map((u) => u.value);
  const leadTimeUnits = ["Days", "Weeks", "Months"];
  const colorMaps = [...ALLOWED_COLOR_MAPS];
  const booleans = ["TRUE", "FALSE"];
  const flags = ["Y", "N"];

  // Prepare single-select / yes-no-na Common Attribute dropdown lists on Allowed_Values (Cols G..P)
  const singleChoiceCommonAttrs = commonAttrs.filter(
    (a) => a.inputType === "SINGLE_SELECT" || a.inputType === "YES_NO_NA"
  );
  const singleChoiceDropdownColumns: Array<{
    fieldKey: string;
    header: string;
    values: string[];
  }> = singleChoiceCommonAttrs.map((attr) => {
    const allowedOpts = attr.options.filter((o) => !o.adminOnlyOption);
    const hasExplicitNa = allowedOpts.some(
      (o) => o.optionCode.toUpperCase() === "NOT_APPLICABLE"
    );
    const list = allowedOpts.map((o) => formatBilingualOptionLabel(o));
    if (attr.allowNa && !hasExplicitNa) {
      list.push("해당 없음 (Not Applicable)");
    }
    return {
      fieldKey: attr.fieldKey,
      header: `${attr.nameKo} (${attr.code})`,
      values: list,
    };
  });

  const maxValidationRow = BULK_IMPORT_MAX_ROWS + 3; // Row 1 Group + Row 2 Header + Row 3 Example + 500 rows
  const productValidations: OoxmlDataValidationSpec[] = [];

  const addDropdownForKey = (key: string, formula1: string) => {
    const idx = BULK_PRODUCT_COLUMNS.findIndex((c) => c.key === key);
    if (idx < 0) return;
    const colLetter = encodeColLetter(idx);
    productValidations.push({
      sqref: `${colLetter}3:${colLetter}${maxValidationRow}`,
      formula1,
    });
  };

  if (activeBrands.length > 0) {
    addDropdownForKey("brand", `Brands!$A$2:$A$${activeBrands.length + 1}`);
  }
  if (depth1DropdownLabels.length > 0) {
    addDropdownForKey("category1Depth", `Allowed_Values!$A$2:$A$${depth1DropdownLabels.length + 1}`);
  }

  // Macro-free Dependent Dropdowns for Category 2Depth (col E, ref D3) and 3Depth (col F, ref E3)
  if (hasDependentHierarchy && d1ToD2Pairs.length > 0) {
    const lastLRow = d1ToD2Pairs.length + 1;
    addDropdownForKey(
      "category2Depth",
      `OFFSET(Categories!$M$2,MATCH(D3,Categories!$L$2:$L$${lastLRow},0)-1,0,COUNTIF(Categories!$L$2:$L$${lastLRow},D3),1)`
    );
  }
  if (hasDependentHierarchy && d2ToD3Pairs.length > 0) {
    const lastORow = d2ToD3Pairs.length + 1;
    addDropdownForKey(
      "category3Depth",
      `OFFSET(Categories!$P$2,MATCH(E3,Categories!$O$2:$O$${lastORow},0)-1,0,COUNTIF(Categories!$O$2:$O$${lastORow},E3),1)`
    );
  }

  addDropdownForKey("volumeUnit", `Allowed_Values!$B$2:$B$${volumeUnits.length + 1}`);
  addDropdownForKey("countryOfOrigin", `Countries!$A$2:$A$${ALL_COUNTRIES.length + 1}`);
  addDropdownForKey("leadTimeUnit", `Allowed_Values!$C$2:$C$${leadTimeUnits.length + 1}`);
  addDropdownForKey("colorMap", `Allowed_Values!$D$2:$D$${colorMaps.length + 1}`);
  addDropdownForKey("sellingOnline", `Allowed_Values!$E$2:$E$3`);
  addDropdownForKey("sellingOffline", `Allowed_Values!$E$2:$E$3`);
  addDropdownForKey("parentSku", `Allowed_Values!$F$2:$F$3`);
  addDropdownForKey("childSku", `Allowed_Values!$F$2:$F$3`);

  // Attach dropdowns for Single-Select / Yes-No-NA Common Attributes (Allowed_Values Cols G..P)
  singleChoiceDropdownColumns.forEach((colInfo, offsetIdx) => {
    if (colInfo.values.length === 0) return;
    const allowedColLetter = encodeColLetter(6 + offsetIdx); // 6 = 'G'
    addDropdownForKey(
      colInfo.fieldKey,
      `Allowed_Values!$${allowedColLetter}$2:$${allowedColLetter}$${colInfo.values.length + 1}`
    );
  });

  const productsSheetSpec: OoxmlSheetSpec = {
    name: "Products",
    cols: productCols,
    rows: [
      { height: 24, cells: groupBannerCells },
      { height: 34, cells: headerRowCells },
      { height: 22, cells: exampleRowCells },
    ],
    merges: productMerges,
    freezeRows: 2,
    activeCell: "A4",
    autoFilterRef: `A2:${encodeCellAddress(3, BULK_PRODUCT_COLUMNS.length - 1)}`,
    dataValidations: productValidations,
    defaultRowHeight: 20,
  };

  // =========================================================================
  // 2. Instructions Sheet (Korean-first Bilingual Guidance for all 86 Columns)
  // =========================================================================
  const guideRules: [string, string][] = [
    [
      "1. 작성 시트 (Primary Sheet)",
      '"Products" 시트의 4행부터 1행당 1개 상품을 입력해 주세요. (1회 업로드 최대 500개 상품 지원 · 전체 86개 컬럼 / Enter one product per row starting at Row 4, max 500 rows).',
    ],
    [
      "2. 최소 필수 항목 4개 유지 (4 Required Fields Only)",
      "초기 임시 등록(Draft)에는 [브랜드 *], [제조사 SKU *], [영문 제품명 *], [카테고리 (1Depth) *] 4개 항목만 필수이며, 나머지 82개 항목(세부 카테고리, 기본/가격/물류, 미디어 URL 11개, 공통 속성 23개)은 모두 선택 입력입니다.",
    ],
    [
      "3. 카테고리 1→2→3단계 연동 드롭다운 (Dependent Categories)",
      "카테고리 (1Depth) 선택 시 하위 2Depth 목록만 자동 표시되며, 2Depth 선택 시 하위 3Depth 목록만 표시됩니다. 직접 코드/국문명/영문명을 입력해도 서버가 상위·하위 계층 정합성을 검증합니다.",
    ],
    [
      "4. 이미지 및 동영상 URL 등록 (Media URLs)",
      "대표 이미지 URL(position 0) 및 추가 이미지 URL 2~10은 직접 다운로드 가능한 HTTPS 이미지 URL(JPG, PNG, WEBP · 최대 10MB)을 입력해 주세요. 제품 동영상 URL은 YouTube/Vimeo 등 HTTPS 외부 링크를 지원합니다.",
    ],
    [
      "5. 공통 속성 23개 입력 규칙 (Common Attributes)",
      '"Common_Attributes" 시트의 허용 옵션을 참조해 주세요. 복수 선택(Multi-select) 항목은 세미콜론(;)으로 구분하여 입력합니다 (예: Dry Skin; Sensitive Skin). 규제 관련 상태(FDA/MoCRA/OTC/Drug Facts)는 브랜드 자체 기재 정보로만 저장됩니다.',
    ],
    [
      "6. 예시 행 자동 제외 & 텍스트(@) 서식 보존",
      `3행(${BULK_TEMPLATE_EXAMPLE_SKU})은 작성 참고용 예시 행으로 업로드 시 자동 제외됩니다. 제조사 SKU, UPC(12자리), EAN(13자리)은 선행 '0' 보존을 위해 텍스트(@) 서식이 적용되어 있습니다.`,
    ],
    [
      "7. 임시 등록 보호 및 제외 항목 안내",
      "업로드된 상품은 미검토(UNREVIEWED) 및 리테일러 허브 비노출(hidden) 상태로 안전하게 보호됩니다. 인증서 파일 업로드 및 카테고리별 추가 프로필 속성(PROFILE)은 등록 후 상품 상세 화면에서 입력합니다.",
    ],
    [
      "8. 수식 입력 금지 (Formula Security)",
      "보안을 위해 셀 내 엑셀 수식(=SUM, =VLOOKUP, =HYPERLINK 등)은 허용되지 않습니다. 반드시 순수 값(텍스트/숫자)으로 입력된 .xlsx 파일을 업로드해 주세요.",
    ],
  ];

  const instructionsRows: OoxmlRowSpec[] = [
    {
      height: 28,
      cells: [
        {
          value: "K SELECT NETWORK — 상품 Excel 대량 등록 안내서 (Brand Product Bulk Upload Guide · 86 Columns)",
          style: STYLE.TITLE_BANNER,
        },
        { value: "", style: STYLE.TITLE_BANNER },
        { value: "", style: STYLE.TITLE_BANNER },
        { value: "", style: STYLE.TITLE_BANNER },
        { value: "", style: STYLE.TITLE_BANNER },
      ],
    },
    { height: 10, cells: [] },
    {
      height: 24,
      cells: [
        { value: "■ 핵심 작성 규칙 (Core Upload Rules)", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
      ],
    },
    ...guideRules.map(([title, desc]) => ({
      height: 26,
      cells: [
        { value: title, style: STYLE.REF_BODY },
        { value: desc, style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
      ],
    })),
    { height: 12, cells: [] },
    {
      height: 24,
      cells: [
        {
          value: `■ 전체 ${BULK_PRODUCT_COLUMNS.length}개 컬럼 상세 규격 (${BULK_PRODUCT_COLUMNS.length} Column Specifications)`,
          style: STYLE.SECTION_HEADER,
        },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
      ],
    },
    {
      height: 26,
      cells: [
        { value: "컬럼명 (Column Header)", style: STYLE.REF_HEADER },
        { value: "필수 여부 (Requirement)", style: STYLE.REF_HEADER },
        { value: "분류 그룹 (Group)", style: STYLE.REF_HEADER },
        { value: "저장 대상 (Target Field / EAV)", style: STYLE.REF_HEADER },
        { value: "입력 규칙 및 설명 (Validation & Format Guide)", style: STYLE.REF_HEADER },
      ],
    },
    ...BULK_PRODUCT_COLUMNS.map((col) => ({
      height: 22,
      cells: [
        { value: col.header, style: STYLE.REF_BODY },
        { value: col.required ? "필수 (REQUIRED)" : "선택 (Optional)", style: STYLE.REF_BODY },
        { value: getSectionNameKo(col.section), style: STYLE.REF_BODY },
        { value: col.dbColumn, style: STYLE.REF_BODY },
        { value: col.description, style: STYLE.REF_BODY },
      ],
    })),
  ];

  const instructionsMerges: string[] = [
    "A1:E1",
    "A3:E3",
    ...guideRules.map((_, idx) => `B${idx + 4}:E${idx + 4}`),
    `A${guideRules.length + 5}:E${guideRules.length + 5}`,
  ];

  const instructionsSheetSpec: OoxmlSheetSpec = {
    name: "Instructions",
    cols: [
      { width: 38 },
      { width: 18 },
      { width: 26 },
      { width: 34 },
      { width: 70 },
    ],
    rows: instructionsRows,
    merges: instructionsMerges,
    freezeRows: 1,
  };

  // =========================================================================
  // 3. Brands Sheet
  // =========================================================================
  const brandDataRows =
    activeBrands.length > 0
      ? activeBrands.map((b) => [sanitizeExcelOutputCell(b.name), "ACTIVE (활성)"])
      : [["(등록된 활성 브랜드가 없습니다 / No active brands)", "INACTIVE"]];

  const brandsSheetSpec: OoxmlSheetSpec = {
    name: "Brands",
    cols: [{ width: 34 }, { width: 20 }],
    rows: [
      {
        height: 26,
        cells: [
          { value: "브랜드명 (Brand Name)", style: STYLE.REF_HEADER },
          { value: "상태 (Status)", style: STYLE.REF_HEADER },
        ],
      },
      ...brandDataRows.map((r) => ({
        height: 20,
        cells: [
          { value: r[0], style: STYLE.REF_BODY, forceString: true },
          { value: r[1], style: STYLE.REF_BODY, forceString: true },
        ],
      })),
    ],
    freezeRows: 1,
  };

  // =========================================================================
  // 4. Categories Sheet (Cols A..J Hierarchy + Hidden Cols L:M & O:P Dependent Lookup Ranges)
  // =========================================================================
  const categoriesHeaders = [
    "1Depth 코드 (Code)",
    "1Depth 영문명 (Name EN)",
    "1Depth 국문명 (Name KO)",
    "2Depth 코드 (Code)",
    "2Depth 영문명 (Name EN)",
    "2Depth 국문명 (Name KO)",
    "3Depth 코드 (Code)",
    "3Depth 영문명 (Name EN)",
    "3Depth 국문명 (Name KO)",
    "최종 적용 코드 (Resolved Code)",
    "", // K spacer
    "LKP_D1_PARENT", // L (col 11)
    "LKP_D2_CHILD",  // M (col 12)
    "", // N spacer
    "LKP_D2_PARENT", // O (col 14)
    "LKP_D3_CHILD",  // P (col 15)
  ];

  const maxCatSheetDataRows = Math.max(
    categoryRefRows.length,
    d1ToD2Pairs.length,
    d2ToD3Pairs.length
  );

  const categoriesBodyRows: OoxmlRowSpec[] = [];
  for (let i = 0; i < maxCatSheetDataRows; i++) {
    const hRow = categoryRefRows[i];
    const p12 = d1ToD2Pairs[i];
    const p23 = d2ToD3Pairs[i];

    const cells: (OoxmlCellSpec | null)[] = [];
    for (let c = 0; c < 10; c++) {
      if (hRow) {
        cells.push({ value: hRow[c] ?? "", style: STYLE.REF_BODY, forceString: true });
      } else {
        cells.push(null);
      }
    }
    cells.push(null); // K
    if (p12) {
      cells.push({ value: p12[0], forceString: true });
      cells.push({ value: p12[1], forceString: true });
    } else {
      cells.push(null);
      cells.push(null);
    }
    cells.push(null); // N
    if (p23) {
      cells.push({ value: p23[0], forceString: true });
      cells.push({ value: p23[1], forceString: true });
    } else {
      cells.push(null);
      cells.push(null);
    }

    categoriesBodyRows.push({
      height: 20,
      cells,
    });
  }

  const categoriesSheetSpec: OoxmlSheetSpec = {
    name: "Categories",
    cols: [
      { width: 20 },
      { width: 24 },
      { width: 20 },
      { width: 22 },
      { width: 26 },
      { width: 20 },
      { width: 22 },
      { width: 28 },
      { width: 22 },
      { width: 24 },
      { width: 4, hidden: true },
      { width: 26, hidden: true },
      { width: 28, hidden: true },
      { width: 4, hidden: true },
      { width: 28, hidden: true },
      { width: 30, hidden: true },
    ],
    rows: [
      {
        height: 26,
        cells: categoriesHeaders.map((h, idx) =>
          idx < 10
            ? { value: h, style: STYLE.REF_HEADER }
            : h
            ? { value: h, forceString: true }
            : null
        ),
      },
      ...categoriesBodyRows,
    ],
    freezeRows: 1,
  };

  // =========================================================================
  // 5. Countries Sheet
  // =========================================================================
  const countriesSheetSpec: OoxmlSheetSpec = {
    name: "Countries",
    cols: [{ width: 32 }, { width: 24 }, { width: 18 }],
    rows: [
      {
        height: 26,
        cells: [
          { value: "표준 영문 국가명 (Canonical Name EN)", style: STYLE.REF_HEADER },
          { value: "국문 국가명 (Country Name KO)", style: STYLE.REF_HEADER },
          { value: "ISO 코드 (Alpha-2)", style: STYLE.REF_HEADER },
        ],
      },
      ...ALL_COUNTRIES.map((c) => ({
        height: 20,
        cells: [
          { value: c.name, style: STYLE.REF_BODY, forceString: true },
          { value: c.nameKo, style: STYLE.REF_BODY, forceString: true },
          { value: c.code, style: STYLE.REF_BODY, forceString: true },
        ],
      })),
    ],
    freezeRows: 1,
  };

  // =========================================================================
  // 6. Allowed_Values Sheet (Core Dropdown Lists + Single-Select Common Attributes)
  // =========================================================================
  const maxAllowedLen = Math.max(
    depth1DropdownLabels.length,
    volumeUnits.length,
    leadTimeUnits.length,
    colorMaps.length,
    booleans.length,
    flags.length,
    ...singleChoiceDropdownColumns.map((c) => c.values.length)
  );

  const allowedHeaderCells: OoxmlCellSpec[] = [
    { value: "카테고리 1Depth (Category 1Depth)", style: STYLE.REF_HEADER },
    { value: "용량 단위 (Volume Unit)", style: STYLE.REF_HEADER },
    { value: "리드타임 단위 (Lead Time Unit)", style: STYLE.REF_HEADER },
    { value: "색상 계열 (Color Map)", style: STYLE.REF_HEADER },
    { value: "판매 여부 (Selling Online/Offline)", style: STYLE.REF_HEADER },
    { value: "상·하위 SKU 여부 (Parent/Child Flag)", style: STYLE.REF_HEADER },
    ...singleChoiceDropdownColumns.map((c) => ({
      value: c.header,
      style: STYLE.REF_HEADER,
    })),
  ];

  const allowedRows: OoxmlRowSpec[] = [
    {
      height: 26,
      cells: allowedHeaderCells,
    },
  ];

  for (let i = 0; i < maxAllowedLen; i++) {
    allowedRows.push({
      height: 20,
      cells: [
        { value: depth1DropdownLabels[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: volumeUnits[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: leadTimeUnits[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: colorMaps[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: booleans[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: flags[i] || "", style: STYLE.REF_BODY, forceString: true },
        ...singleChoiceDropdownColumns.map((c) => ({
          value: c.values[i] || "",
          style: STYLE.REF_BODY,
          forceString: true,
        })),
      ],
    });
  }

  const allowedSheetSpec: OoxmlSheetSpec = {
    name: "Allowed_Values",
    cols: [
      { width: 28 },
      { width: 20 },
      { width: 24 },
      { width: 20 },
      { width: 28 },
      { width: 28 },
      ...singleChoiceDropdownColumns.map(() => ({ width: 30 })),
    ],
    rows: allowedRows,
    freezeRows: 1,
  };

  // =========================================================================
  // 7. Common_Attributes Sheet (Complete Reference for All 23 Common Attributes)
  // =========================================================================
  const inputTypeLabelMap: Record<string, string> = {
    NUMBER_UNIT: "숫자 입력 · 개월 (Numeric Months)",
    SINGLE_SELECT: "단일 선택 (Single Select)",
    MULTI_SELECT: "복수 선택 · 세미콜론 ';' 구분 (Multi Select)",
    YES_NO_NA: "예/아니요/해당없음 (Yes / No / N/A)",
  };

  const commonAttrSheetRows: OoxmlRowSpec[] = [
    {
      height: 28,
      cells: [
        { value: "속성 그룹 (Group)", style: STYLE.REF_HEADER },
        { value: "Products 시트 컬럼명 (Excel Header)", style: STYLE.REF_HEADER },
        { value: "EAV 속성 코드 (Attribute Code)", style: STYLE.REF_HEADER },
        { value: "입력 방식 (Input Type)", style: STYLE.REF_HEADER },
        { value: "N/A · 기타 허용", style: STYLE.REF_HEADER },
        { value: "허용 입력값 목록 (Accepted Values — 국문/영문/코드 모두 인식)", style: STYLE.REF_HEADER },
        { value: "입력 예시 (Example)", style: STYLE.REF_HEADER },
      ],
    },
    ...commonAttrs.map((attr) => {
      const visibleOpts = attr.options.filter((o) => !o.adminOnlyOption);
      let acceptedSummary = "";
      if (attr.inputType === "NUMBER_UNIT") {
        acceptedSummary = attr.allowNa
          ? "1 ~ 600 양수 숫자 (단위: 개월) 또는 '해당 없음 (NA)'"
          : "1 ~ 600 양수 숫자 (단위: 개월)";
      } else {
        const formattedOpts = visibleOpts.map(
          (o) => `${o.optionKo} / ${o.optionEn} [${o.optionCode}]`
        );
        if (
          attr.allowNa &&
          !visibleOpts.some((o) => o.optionCode.toUpperCase() === "NOT_APPLICABLE")
        ) {
          formattedOpts.push("해당 없음 / Not Applicable [NA]");
        }
        if (attr.allowOther) {
          formattedOpts.push("직접 입력 시 '기타: 내용' 또는 'Other: text'");
        }
        acceptedSummary = formattedOpts.join("  |  ");
      }

      const naOtherFlags = [
        attr.allowNa ? "N/A 가능" : "N/A 불가",
        attr.allowOther ? "기타 직접입력 가능" : "고정 옵션만",
      ].join(" · ");

      return {
        height: 26,
        cells: [
          { value: `${attr.attrGroupKo} (${attr.attrGroupEn})`, style: STYLE.REF_BODY, forceString: true },
          { value: attr.header, style: STYLE.REF_BODY, forceString: true },
          { value: attr.code, style: STYLE.REF_BODY, forceString: true },
          { value: inputTypeLabelMap[attr.inputType] || attr.inputType, style: STYLE.REF_BODY, forceString: true },
          { value: naOtherFlags, style: STYLE.REF_BODY, forceString: true },
          { value: acceptedSummary, style: STYLE.REF_BODY, forceString: true },
          { value: String(attr.exampleValue), style: STYLE.REF_BODY, forceString: true },
        ],
      };
    }),
  ];

  const commonAttributesSheetSpec: OoxmlSheetSpec = {
    name: "Common_Attributes",
    cols: [
      { width: 26 },
      { width: 38 },
      { width: 26 },
      { width: 32 },
      { width: 24 },
      { width: 78 },
      { width: 28 },
    ],
    rows: commonAttrSheetRows,
    freezeRows: 1,
    autoFilterRef: `A1:G${commonAttrSheetRows.length}`,
  };

  return buildOoxmlWorkbookBuffer([
    productsSheetSpec,
    instructionsSheetSpec,
    brandsSheetSpec,
    categoriesSheetSpec,
    countriesSheetSpec,
    allowedSheetSpec,
    commonAttributesSheetSpec,
  ]);
}

export async function generateBulkImportErrorBuffer(
  rejectedRows: BulkRejectedRowItem[],
  mediaFailures: BulkMediaFailureItem[] = []
): Promise<Buffer> {
  const sheets: OoxmlSheetSpec[] = [];

  if (rejectedRows.length > 0 || mediaFailures.length === 0) {
    sheets.push({
      name: "Import_Errors",
      cols: [
        { width: 18 },
        { width: 26, style: STYLE.TEXT_AT },
        { width: 34, style: STYLE.TEXT_AT },
        { width: 52, style: STYLE.TEXT_AT },
        { width: 54, style: STYLE.TEXT_AT },
      ],
      rows: [
        {
          height: 28,
          cells: [
            { value: "원본 행 번호 (Excel Row #)", style: STYLE.ERROR_HEADER },
            { value: "제조사 SKU (Manufacturer SKU)", style: STYLE.ERROR_HEADER },
            { value: "제품명 (Product Name)", style: STYLE.ERROR_HEADER },
            { value: "오류 사유 (Error Reason)", style: STYLE.ERROR_HEADER },
            { value: "수정 방법 안내 (Corrective Guidance)", style: STYLE.ERROR_HEADER },
          ],
        },
        ...rejectedRows.map((item) => ({
          height: 22,
          cells: [
            { value: item.excelRowNumber, style: STYLE.REF_BODY },
            {
              value: sanitizeExcelOutputCell(item.manufactureSku),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(item.productName),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(item.errorReason),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(item.correctiveGuidance),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
          ],
        })),
      ],
      freezeRows: 1,
      autoFilterRef: `A1:E${Math.max(rejectedRows.length + 1, 2)}`,
    });
  }

  if (mediaFailures.length > 0) {
    sheets.push({
      name: "Media_Failures",
      cols: [
        { width: 16 },
        { width: 26, style: STYLE.TEXT_AT },
        { width: 32, style: STYLE.TEXT_AT },
        { width: 30, style: STYLE.TEXT_AT },
        { width: 46, style: STYLE.TEXT_AT },
        { width: 48, style: STYLE.TEXT_AT },
        { width: 50, style: STYLE.TEXT_AT },
      ],
      rows: [
        {
          height: 28,
          cells: [
            { value: "행 번호 (Row #)", style: STYLE.ERROR_HEADER },
            { value: "제조사 SKU (SKU)", style: STYLE.ERROR_HEADER },
            { value: "생성된 상품명 (Product)", style: STYLE.ERROR_HEADER },
            { value: "미디어 컬럼 (Column)", style: STYLE.ERROR_HEADER },
            { value: "요청 URL (Source URL)", style: STYLE.ERROR_HEADER },
            { value: "실패 사유 (Failure Reason)", style: STYLE.ERROR_HEADER },
            { value: "조치 방법 (Corrective Action)", style: STYLE.ERROR_HEADER },
          ],
        },
        ...mediaFailures.map((mf) => ({
          height: 22,
          cells: [
            { value: mf.excelRowNumber, style: STYLE.REF_BODY },
            {
              value: sanitizeExcelOutputCell(mf.manufactureSku),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(mf.productNameEn),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(mf.columnHeader),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(mf.url),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(mf.errorReason),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(mf.correctiveGuidance),
              style: STYLE.REF_BODY_TEXT_AT,
              forceString: true,
            },
          ],
        })),
      ],
      freezeRows: 1,
      autoFilterRef: `A1:G${Math.max(mediaFailures.length + 1, 2)}`,
    });
  }

  return buildOoxmlWorkbookBuffer(sheets);
}
