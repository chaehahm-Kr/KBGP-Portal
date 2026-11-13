import JSZip from "jszip";
import {
  ALLOWED_COLOR_MAPS,
  BULK_IMPORT_MAX_ROWS,
  BULK_PRODUCT_COLUMNS,
  BULK_TEMPLATE_EXAMPLE_SKU,
  type BulkColumnSection,
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

// Style indices matching buildStylesXml() cellXfs order
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
  // Strip illegal XML 1.0 control characters (keep \t, \n, \r)
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeColLetter(colIdxZeroBased: number): string {
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
  // Fonts:
  // 0: Malgun Gothic 10pt regular #0F172A
  // 1: Malgun Gothic 10pt bold #FFFFFF (Required Group / Dark Header)
  // 2: Malgun Gothic 10pt bold #1E3A8A (Required Column Header)
  // 3: Malgun Gothic 10pt bold #0C4A6E (Category Group/Header)
  // 4: Malgun Gothic 10pt bold #1E293B (Basic Info Group/Header)
  // 5: Malgun Gothic 10pt bold #065F46 (Pricing Group/Header)
  // 6: Malgun Gothic 10pt bold #78350F (Logistics Group/Header)
  // 7: Malgun Gothic 9.5pt italic #475569 (Example Row)
  // 8: Malgun Gothic 12pt bold #FFFFFF (Title Banner)
  // 9: Malgun Gothic 10.5pt bold #1E293B (Section Header)
  // 10: Malgun Gothic 10pt bold #FFFFFF (Error Header)

  // Fills (0 = none, 1 = gray125 required by OOXML spec!):
  // 2: #1E3A8A (Required Group Navy)
  // 3: #E0F2FE (Category Group Sky)
  // 4: #E2E8F0 (Basic Group Slate)
  // 5: #D1FAE5 (Pricing Group Mint)
  // 6: #FEF3C7 (Logistics Group Amber)
  // 7: #DBEAFE (Required Col Header Ice Blue)
  // 8: #F0F9FF (Category Col Header Pale Sky)
  // 9: #F8FAFC (Basic Col Header Pale Slate)
  // 10: #ECFDF5 (Pricing Col Header Pale Mint)
  // 11: #FFFBEB (Logistics Col Header Pale Amber)
  // 12: #FEFCE8 (Example Row Pale Ivory)
  // 13: #0F172A (Reference Header Dark Slate)
  // 14: #991B1B (Error Header Crimson)

  // Borders:
  // 0: none
  // 1: thin #CBD5E1 all around
  // 2: thin #CBD5E1 left/right/top + medium #2563EB bottom (Required Header)
  // 3: thin #CBD5E1 left/right/top + medium #64748B bottom (Optional Header)

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="11">
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
  </fonts>
  <fills count="15">
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
  <cellXfs count="21">
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
        // Add +1.5 padding so Korean/English text never clips against AutoFilter arrows
        const w = Number((c.width + 1.5).toFixed(2));
        return `<col min="${colNum}" max="${colNum}" width="${w}" customWidth="1"${styleAttr}/>`;
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
        // Keep empty cell tag only when explicit styling (border/fill/numberFormat) is assigned
        if (cell.style !== undefined) {
          cellXmlList.push(`<c r="${addr}"${styleAttr}/>`);
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

  // 5. autoFilter (strict CT_Worksheet position BEFORE mergeCells & dataValidations!)
  // Wait: verify ECMA-376 CT_Worksheet sequence:
  // sheetData -> sheetCalcPr -> sheetProtection -> protectedRanges -> scenarios -> autoFilter -> sortState -> dataConsolidate -> customSheetViews -> mergeCells -> phoneticPr -> conditionalFormatting -> dataValidations -> hyperlinks -> printOptions -> pageMargins!
  // Notice <autoFilter> MUST come BEFORE <mergeCells>, and <mergeCells> MUST come BEFORE <dataValidations>!
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

  //Worksheet XMLs
  sheets.forEach((sheet, idx) => {
    const xml = buildWorksheetXml(sheet, sst, idx === 0);
    zip.file(`xl/worksheets/sheet${idx + 1}.xml`, xml);
  });

  // Shared Strings & Styles
  zip.file("xl/sharedStrings.xml", sst.toXml());
  zip.file("xl/styles.xml", buildStylesXml());

  // xl/workbook.xml
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

  // xl/_rels/workbook.xml.rels
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

  // _rels/.rels
  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  zip.file("_rels/.rels", rootRelsXml);

  // [Content_Types].xml
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
    category2Depth: sampleD2?.name_en || "",
    category3Depth: sampleD3?.name_en || "",
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
  };

  // =========================================================================
  // 1. Products Sheet (Row 1 = Group Banners, Row 2 = 52 Headers, Row 3 = Example)
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
      label: "세부 카테고리 · 선택 (Category)",
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
  if (depth1Names.length > 0) {
    addDropdownForKey("category1Depth", `Allowed_Values!$A$2:$A$${depth1Names.length + 1}`);
  }
  addDropdownForKey("volumeUnit", `Allowed_Values!$B$2:$B$${volumeUnits.length + 1}`);
  addDropdownForKey("countryOfOrigin", `Countries!$A$2:$A$${ALL_COUNTRIES.length + 1}`);
  addDropdownForKey("leadTimeUnit", `Allowed_Values!$C$2:$C$${leadTimeUnits.length + 1}`);
  addDropdownForKey("colorMap", `Allowed_Values!$D$2:$D$${colorMaps.length + 1}`);
  addDropdownForKey("sellingOnline", `Allowed_Values!$E$2:$E$3`);
  addDropdownForKey("sellingOffline", `Allowed_Values!$E$2:$E$3`);
  addDropdownForKey("parentSku", `Allowed_Values!$F$2:$F$3`);
  addDropdownForKey("childSku", `Allowed_Values!$F$2:$F$3`);

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
  // 2. Instructions Sheet (Korean-first Bilingual Guidance)
  // =========================================================================
  const guideRules: [string, string][] = [
    [
      "1. 작성 시트 (Primary Sheet)",
      '"Products" 시트의 4행부터 1행당 1개 상품을 입력해 주세요. (1회 업로드 최대 500개 상품 지원 / Enter one product per row starting from Row 4, max 500 rows).',
    ],
    [
      "2. 최소 필수 항목 4개 (4 Required Fields)",
      "초기 임시 등록(Draft)에는 [브랜드 (Brand) *], [제조사 SKU (Manufacturer SKU) *], [영문 제품명 (Product Name EN) *], [카테고리 (1Depth) *] 4개 항목만 필수입니다.",
    ],
    [
      "3. 예시 행 자동 제외 (Sample Row Skipped)",
      `3행(${BULK_TEMPLATE_EXAMPLE_SKU})은 작성 참고용 예시 데이터입니다. 삭제하지 않고 그대로 업로드하셔도 시스템이 자동으로 제외합니다.`,
    ],
    [
      "4. 임시 등록 상태 유지 (Draft Workflow)",
      "업로드된 모든 상품은 '임시 등록 (보완 대기 / Draft · UNREVIEWED)' 상태로 생성되며, 대표 이미지 및 카테고리별 필수 속성을 보완하기 전까지 리테일러 허브(Retailer Hub)에 노출되지 않습니다.",
    ],
    [
      "5. 텍스트 서식 및 선행 0 보존 (Text Formatting)",
      "제조사 SKU, UPC 바코드(12자리), EAN 바코드(13자리) 열은 텍스트(@) 서식이 기본 적용되어 앞자리 '0'(예: 012345678905)이 그대로 보존됩니다.",
    ],
    [
      "6. 제조국 공란 처리 (Country of Origin)",
      "제조국(Country of Origin)이 미확정인 경우 비워 두세요. 공란은 빈 값(NULL)으로 저장되며 임의로 특정 국가가 자동 입력되지 않습니다.",
    ],
    [
      "7. Excel 업로드 제외 항목 (V1 Excluded)",
      "상품 이미지, 동영상, 인증서 파일, 카테고리별 세부 속성(EAV), Letusto SKU는 등록 후 상품 관리 상세 화면에서 입력/업로드합니다. 카톤 CBM은 카톤 가로·세로·높이 입력 시 자동 계산됩니다.",
    ],
    [
      "8. 수식 입력 금지 (Formula Security)",
      "보안을 위해 엑셀 수식(=SUM, =VLOOKUP, =HYPERLINK 등)은 허용되지 않습니다. 반드시 순수 값(텍스트/숫자)으로 입력된 .xlsx 파일을 업로드해 주세요.",
    ],
  ];

  const instructionsRows: OoxmlRowSpec[] = [
    {
      height: 28,
      cells: [
        {
          value: "K SELECT NETWORK — 상품 Excel 대량 등록 안내서 (Brand Product Bulk Upload Guide)",
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
      height: 24,
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
          value: "■ 전체 52개 컬럼 상세 규격 (52 Column Specifications)",
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
        { value: "영문 기준명 (English Key)", style: STYLE.REF_HEADER },
        { value: "입력 규칙 및 설명 (Validation & Format Guide)", style: STYLE.REF_HEADER },
      ],
    },
    ...BULK_PRODUCT_COLUMNS.map((col) => ({
      height: 22,
      cells: [
        { value: col.header, style: STYLE.REF_BODY },
        { value: col.required ? "필수 (REQUIRED)" : "선택 (Optional)", style: STYLE.REF_BODY },
        { value: getSectionNameKo(col.section), style: STYLE.REF_BODY },
        { value: col.headerEn, style: STYLE.REF_BODY },
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
      { width: 34 },
      { width: 20 },
      { width: 22 },
      { width: 28 },
      { width: 68 },
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
  // 4. Categories Sheet
  // =========================================================================
  const categoryRefRows = buildCategoryReferenceRows(activeCategories);
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
  ];

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
    ],
    rows: [
      {
        height: 26,
        cells: categoriesHeaders.map((h) => ({ value: h, style: STYLE.REF_HEADER })),
      },
      ...categoryRefRows.map((r) => ({
        height: 20,
        cells: r.map((v) => ({ value: v, style: STYLE.REF_BODY, forceString: true })),
      })),
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
  // 6. Allowed_Values Sheet
  // =========================================================================
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

  const allowedRows: OoxmlRowSpec[] = [
    {
      height: 26,
      cells: [
        { value: "카테고리 1Depth (Category 1Depth)", style: STYLE.REF_HEADER },
        { value: "용량 단위 (Volume Unit)", style: STYLE.REF_HEADER },
        { value: "리드타임 단위 (Lead Time Unit)", style: STYLE.REF_HEADER },
        { value: "색상 계열 (Color Map)", style: STYLE.REF_HEADER },
        { value: "판매 여부 (Selling Online/Offline)", style: STYLE.REF_HEADER },
        { value: "상·하위 SKU 여부 (Parent/Child Flag)", style: STYLE.REF_HEADER },
      ],
    },
  ];

  for (let i = 0; i < maxAllowedLen; i++) {
    allowedRows.push({
      height: 20,
      cells: [
        { value: depth1Names[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: volumeUnits[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: leadTimeUnits[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: colorMaps[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: booleans[i] || "", style: STYLE.REF_BODY, forceString: true },
        { value: flags[i] || "", style: STYLE.REF_BODY, forceString: true },
      ],
    });
  }

  const allowedSheetSpec: OoxmlSheetSpec = {
    name: "Allowed_Values",
    cols: [
      { width: 26 },
      { width: 20 },
      { width: 24 },
      { width: 20 },
      { width: 28 },
      { width: 28 },
    ],
    rows: allowedRows,
    freezeRows: 1,
  };

  return buildOoxmlWorkbookBuffer([
    productsSheetSpec,
    instructionsSheetSpec,
    brandsSheetSpec,
    categoriesSheetSpec,
    countriesSheetSpec,
    allowedSheetSpec,
  ]);
}

export async function generateBulkImportErrorBuffer(
  rejectedRows: BulkRejectedRowItem[]
): Promise<Buffer> {
  const errorSheet: OoxmlSheetSpec = {
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
  };

  return buildOoxmlWorkbookBuffer([errorSheet]);
}
