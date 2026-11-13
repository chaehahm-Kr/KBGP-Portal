import JSZip from "jszip";
import {
  ALLOWED_COLOR_MAPS,
  BULK_IMPORT_MAX_ROWS,
  BULK_PRODUCT_COLUMNS,
  BULK_TEMPLATE_EXAMPLE_SKU,
  COMMON_BULK_ATTRIBUTES,
  type BulkCellValidationIssue,
  type BulkColumnSection,
  type BulkColumnSpec,
  type BulkCommonAttributeOptionSpec,
  type BulkCommonAttributeSpec,
  type BulkMediaFailureItem,
  type BulkPreviewResult,
  type BulkReferenceBrand,
  type BulkReferenceCategory,
  type BulkReferenceCommonAttribute,
  type BulkRejectedRowItem,
  type BulkRowRawFieldKey,
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

export interface GenerateAnnotatedErrorWorkbookOptions extends GenerateTemplateOptions {
  preview: BulkPreviewResult;
}

// Style indices matching buildStylesXml() cellXfs order (0..32)
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
  CELL_ERROR: 25,
  CELL_ERROR_TEXT_AT: 26,
  CELL_WARNING: 27,
  CELL_WARNING_TEXT_AT: 28,
  ROW_INVALID_BG: 29,
  ROW_INVALID_TEXT_AT: 30,
  ROW_WARNING_BG: 31,
  ROW_WARNING_TEXT_AT: 32,
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
  promptTitle?: string;
  prompt?: string;
}

interface OoxmlCellCommentSpec {
  rowZeroBased: number;
  colZeroBased: number;
  text: string;
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
  comments?: OoxmlCellCommentSpec[];
  defaultRowHeight?: number;
}

export const EXCEL_MULTI_SELECT_PROMPT_TITLE = "복수 선택 항목 안내";
export const EXCEL_MULTI_SELECT_PROMPT_MESSAGE = [
  "드롭다운에서 첫 번째 항목을 선택하세요.",
  "두 번째 항목부터는 기존 값 뒤에",
  "세미콜론(;)을 입력하고 직접 추가하세요.",
  "예: 건성 (Dry Skin); 민감성 (Sensitive Skin)",
].join("\n");

export const EXCEL_SINGLE_SELECT_PROMPT_TITLE = "단일 선택 항목 안내";
export const EXCEL_SINGLE_SELECT_PROMPT_MESSAGE = [
  "목록에서 하나의 항목만 선택하세요.",
  "복수 입력은 허용되지 않습니다.",
].join("\n");

export const EXCEL_YES_NO_NA_PROMPT_TITLE = "예 / 아니요 / 해당 없음 안내";
export const EXCEL_YES_NO_NA_PROMPT_MESSAGE = [
  "예 (Yes), 아니요 (No), 해당 없음 (Not Applicable) 중 하나만 선택하세요.",
  "복수 입력은 허용되지 않습니다.",
].join("\n");

export const EXCEL_MULTI_SELECT_OVERWRITE_WARNING =
  "드롭다운에서 다른 항목을 다시 선택하면 기존 값이 대체됩니다. 추가 항목은 직접 입력하세요.";

function resolveOptionAttributeValidationPrompt(
  inputType: BulkCommonAttributeSpec["inputType"]
): { promptTitle: string; prompt: string } {
  if (inputType === "MULTI_SELECT") {
    return {
      promptTitle: EXCEL_MULTI_SELECT_PROMPT_TITLE,
      prompt: EXCEL_MULTI_SELECT_PROMPT_MESSAGE,
    };
  }
  if (inputType === "SINGLE_SELECT") {
    return {
      promptTitle: EXCEL_SINGLE_SELECT_PROMPT_TITLE,
      prompt: EXCEL_SINGLE_SELECT_PROMPT_MESSAGE,
    };
  }
  return {
    promptTitle: EXCEL_YES_NO_NA_PROMPT_TITLE,
    prompt: EXCEL_YES_NO_NA_PROMPT_MESSAGE,
  };
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

function escapeXmlAttrPreserveNewlines(raw: string): string {
  return escapeXml(raw).replace(/\r\n/g, "&#10;").replace(/\n/g, "&#10;");
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
  // Fonts (0..14):
  // 11: Malgun Gothic 10pt bold #5B21B6 (Media Group/Header Violet)
  // 12: Malgun Gothic 10pt bold #3730A3 (Common Attribute Group/Header Indigo)
  // 13: Malgun Gothic 10pt bold #991B1B (Error Cell Dark Red)
  // 14: Malgun Gothic 10pt bold #92400E (Warning Cell Dark Amber)
  // Fills (0..20):
  // 15..18: Media & Common Attr Group/Headers
  // 19: #FEE2E2 (Invalid Cell Light Red Fill)
  // 20: #FFF1F2 (Invalid Row Subtle Rose Tint)
  // Borders (0..5):
  // 4: Thin Crimson #EF4444 (Invalid Cell Border)
  // 5: Thin Amber #F59E0B (Warning Cell Border)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="15">
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
    <font><b/><sz val="10"/><color rgb="FF991B1B"/><name val="맑은 고딕"/><charset val="129"/></font>
    <font><b/><sz val="10"/><color rgb="FF92400E"/><name val="맑은 고딕"/><charset val="129"/></font>
  </fonts>
  <fills count="21">
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
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1F2"/></patternFill></fill>
  </fills>
  <borders count="6">
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
    <border>
      <left style="thin"><color rgb="FFEF4444"/></left>
      <right style="thin"><color rgb="FFEF4444"/></right>
      <top style="thin"><color rgb="FFEF4444"/></top>
      <bottom style="thin"><color rgb="FFEF4444"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFF59E0B"/></left>
      <right style="thin"><color rgb="FFF59E0B"/></right>
      <top style="thin"><color rgb="FFF59E0B"/></top>
      <bottom style="thin"><color rgb="FFF59E0B"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="33">
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
    <xf numFmtId="0" fontId="13" fillId="19" borderId="4" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="13" fillId="19" borderId="4" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="14" fillId="6" borderId="5" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="14" fillId="6" borderId="5" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="20" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="20" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="11" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="11" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
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

function buildCommentsXml(comments: OoxmlCellCommentSpec[]): string {
  const items = comments
    .map((c) => {
      const ref = encodeCellAddress(c.rowZeroBased + 1, c.colZeroBased);
      return `<comment ref="${ref}" authorId="0"><text><r><rPr><sz val="9"/><color rgb="FF0F172A"/><rFont val="맑은 고딕"/><charset val="129"/></rPr><t xml:space="preserve">${escapeXml(
        c.text
      )}</t></r></text></comment>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<authors><author>K SELECT Validator</author></authors>` +
    `<commentList>${items}</commentList>` +
    `</comments>`
  );
}

function buildCommentsVmlXml(comments: OoxmlCellCommentSpec[]): string {
  const shapes = comments
    .map((c, idx) => {
      const r = c.rowZeroBased;
      const col = c.colZeroBased;
      const shapeId = 1025 + idx;
      const startCol = col + 1;
      const startRow = Math.max(0, r - 1);
      const endCol = col + 4;
      const endRow = r + 5;
      return (
        `<v:shape id="_x0000_s${shapeId}" type="#_x0000_t202" ` +
        `style="position:absolute;margin-left:80pt;margin-top:5pt;width:240pt;height:96pt;z-index:${
          idx + 1
        };visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">` +
        `<v:fill color2="#ffffe1"/>` +
        `<v:shadow on="t" color="black" obscured="t"/>` +
        `<v:path o:connecttype="none"/>` +
        `<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>` +
        `<x:ClientData ObjectType="Note">` +
        `<x:MoveWithCells/>` +
        `<x:SizeWithCells/>` +
        `<x:Anchor>${startCol}, 12, ${startRow}, 6, ${endCol}, 24, ${endRow}, 18</x:Anchor>` +
        `<x:AutoFill>False</x:AutoFill>` +
        `<x:Row>${r}</x:Row>` +
        `<x:Column>${col}</x:Column>` +
        `</x:ClientData>` +
        `</v:shape>`
      );
    })
    .join("");

  return (
    `<xml xmlns:v="urn:schemas-microsoft-com:vml" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel">` +
    `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>` +
    `<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">` +
    `<v:stroke joinstyle="miter"/>` +
    `<v:path gradientshapeok="t" o:connecttype="rect"/>` +
    `</v:shapetype>` +
    shapes +
    `</xml>`
  );
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

  // 5. autoFilter -> mergeCells -> dataValidations -> pageMargins -> legacyDrawing (strict ECMA-376 sequence)
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
          .map((dv) => {
            const pt = dv.promptTitle
              ? ` promptTitle="${escapeXmlAttrPreserveNewlines(dv.promptTitle.slice(0, 32))}"`
              : "";
            const pm = dv.prompt
              ? ` prompt="${escapeXmlAttrPreserveNewlines(dv.prompt.slice(0, 250))}"`
              : "";
            return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0"${pt}${pm} sqref="${dv.sqref}"><formula1>${escapeXml(
              dv.formula1
            )}</formula1></dataValidation>`;
          })
          .join("")}</dataValidations>`
      : "";

  const pageMarginsXml = `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`;

  const legacyDrawingXml =
    sheet.comments && sheet.comments.length > 0
      ? `<legacyDrawing r:id="rIdVml1"/>`
      : "";

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
    legacyDrawingXml +
    `</worksheet>`
  );
}

async function buildOoxmlWorkbookBuffer(sheets: OoxmlSheetSpec[]): Promise<Buffer> {
  const zip = new JSZip();
  const sst = new SharedStringTable();
  const commentOverrides: string[] = [];
  let hasAnyVml = false;

  sheets.forEach((sheet, idx) => {
    const sheetNum = idx + 1;
    const xml = buildWorksheetXml(sheet, sst, idx === 0);
    zip.file(`xl/worksheets/sheet${sheetNum}.xml`, xml);

    if (sheet.comments && sheet.comments.length > 0) {
      hasAnyVml = true;
      zip.file(`xl/comments${sheetNum}.xml`, buildCommentsXml(sheet.comments));
      zip.file(`xl/drawings/vmlDrawing${sheetNum}.vml`, buildCommentsVmlXml(sheet.comments));
      const sheetRelsXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rIdVml1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing${sheetNum}.vml"/>` +
        `<Relationship Id="rIdComments1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments${sheetNum}.xml"/>` +
        `</Relationships>`;
      zip.file(`xl/worksheets/_rels/sheet${sheetNum}.xml.rels`, sheetRelsXml);
      commentOverrides.push(
        `<Override PartName="/xl/comments${sheetNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`
      );
    }
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
  const vmlDefaultXml = hasAnyVml
    ? `<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>`
    : "";
  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    vmlDefaultXml +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheetOverrides +
    commentOverrides.join("") +
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
    if (!live) return spec;

    const normalizedInputType = (live.inputType || "").toUpperCase();
    const resolvedInputType =
      normalizedInputType === "NUMBER_UNIT" ||
      normalizedInputType === "SINGLE_SELECT" ||
      normalizedInputType === "MULTI_SELECT" ||
      normalizedInputType === "YES_NO_NA"
        ? (normalizedInputType as BulkCommonAttributeSpec["inputType"])
        : spec.inputType;

    // Ensure exampleValue and description stay consistent with authoritative DB input_type
    let resolvedExample = spec.exampleValue;
    if (
      resolvedInputType !== "MULTI_SELECT" &&
      typeof resolvedExample === "string" &&
      resolvedExample.includes(";")
    ) {
      resolvedExample = resolvedExample.split(";")[0].trim();
    }

    let resolvedDescription = spec.description;
    if (resolvedInputType !== spec.inputType) {
      if (resolvedInputType === "MULTI_SELECT") {
        resolvedDescription = `복수 선택 가능 — 드롭다운에서 첫 항목 선택 후 세미콜론(;)으로 구분 추가 입력 (Common_Attributes 시트 참조 -> EAV ${spec.code}).`;
      } else if (resolvedInputType === "SINGLE_SELECT") {
        resolvedDescription = `단일 선택 — 목록에서 하나의 항목만 선택 (복수 입력 불가 · Common_Attributes 시트 참조 -> EAV ${spec.code}).`;
      }
    }

    if (live.options.length === 0) {
      return {
        ...spec,
        inputType: resolvedInputType,
        allowNa: live.allowNa,
        allowOther: live.allowOther,
        exampleValue: resolvedExample,
        description: resolvedDescription,
      };
    }

    const staticMap = new Map<string, BulkCommonAttributeOptionSpec>();
    for (const o of spec.options) staticMap.set(o.optionCode.toUpperCase(), o);

    return {
      ...spec,
      inputType: resolvedInputType,
      allowNa: live.allowNa,
      allowOther: live.allowOther,
      exampleValue: resolvedExample,
      description: resolvedDescription,
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

  // Prepare ALL 20 option-based Common Attribute dropdown lists on Allowed_Values (Cols G..Z):
  // 10 single-choice (SINGLE_SELECT / YES_NO_NA) + 10 multi-select (MULTI_SELECT)
  const optionCommonAttrs = commonAttrs.filter(
    (a) =>
      a.inputType === "SINGLE_SELECT" ||
      a.inputType === "YES_NO_NA" ||
      a.inputType === "MULTI_SELECT"
  );
  const optionAttrDropdownColumns: Array<{
    fieldKey: BulkRowRawFieldKey;
    header: string;
    values: string[];
    inputType: BulkCommonAttributeSpec["inputType"];
    allowOther: boolean;
  }> = optionCommonAttrs.map((attr) => {
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
      inputType: attr.inputType,
      allowOther: attr.allowOther,
    };
  });

  const buildProductValidationsForColumns = (
    colIdxByKey: Map<string, number>,
    startDataRow: number,
    endDataRow: number
  ): OoxmlDataValidationSpec[] => {
    const validations: OoxmlDataValidationSpec[] = [];
    const safeEndRow = Math.max(startDataRow, endDataRow);

    const addValidation = (
      key: string,
      formula1: string,
      promptTitle?: string,
      prompt?: string
    ) => {
      const idx = colIdxByKey.get(key);
      if (idx === undefined || idx < 0) return;
      const colLetter = encodeColLetter(idx);
      validations.push({
        sqref: `${colLetter}${startDataRow}:${colLetter}${safeEndRow}`,
        formula1,
        promptTitle,
        prompt,
      });
    };

    if (activeBrands.length > 0) {
      addValidation("brand", `Brands!$A$2:$A$${activeBrands.length + 1}`);
    }
    if (depth1DropdownLabels.length > 0) {
      addValidation(
        "category1Depth",
        `Allowed_Values!$A$2:$A$${depth1DropdownLabels.length + 1}`
      );
    }

    const d1ColIdx = colIdxByKey.get("category1Depth");
    const d2ColIdx = colIdxByKey.get("category2Depth");
    if (hasDependentHierarchy && d1ToD2Pairs.length > 0 && d1ColIdx !== undefined) {
      const d1Ref = `${encodeColLetter(d1ColIdx)}${startDataRow}`;
      const lastLRow = d1ToD2Pairs.length + 1;
      addValidation(
        "category2Depth",
        `OFFSET(Categories!$M$2,MATCH(${d1Ref},Categories!$L$2:$L$${lastLRow},0)-1,0,COUNTIF(Categories!$L$2:$L$${lastLRow},${d1Ref}),1)`
      );
    }
    if (hasDependentHierarchy && d2ToD3Pairs.length > 0 && d2ColIdx !== undefined) {
      const d2Ref = `${encodeColLetter(d2ColIdx)}${startDataRow}`;
      const lastORow = d2ToD3Pairs.length + 1;
      addValidation(
        "category3Depth",
        `OFFSET(Categories!$P$2,MATCH(${d2Ref},Categories!$O$2:$O$${lastORow},0)-1,0,COUNTIF(Categories!$O$2:$O$${lastORow},${d2Ref}),1)`
      );
    }

    addValidation("volumeUnit", `Allowed_Values!$B$2:$B$${volumeUnits.length + 1}`);
    addValidation("countryOfOrigin", `Countries!$A$2:$A$${ALL_COUNTRIES.length + 1}`);
    addValidation("leadTimeUnit", `Allowed_Values!$C$2:$C$${leadTimeUnits.length + 1}`);
    addValidation("colorMap", `Allowed_Values!$D$2:$D$${colorMaps.length + 1}`);
    addValidation("sellingOnline", `Allowed_Values!$E$2:$E$3`);
    addValidation("sellingOffline", `Allowed_Values!$E$2:$E$3`);
    addValidation("parentSku", `Allowed_Values!$F$2:$F$3`);
    addValidation("childSku", `Allowed_Values!$F$2:$F$3`);

    // Attach dropdowns for ALL 20 Option-Based Common Attributes (Allowed_Values Cols G..Z)
    optionAttrDropdownColumns.forEach((colInfo, offsetIdx) => {
      if (colInfo.values.length === 0) return;
      const allowedColLetter = encodeColLetter(6 + offsetIdx); // 6 = 'G' .. 25 = 'Z'
      const { promptTitle, prompt } = resolveOptionAttributeValidationPrompt(colInfo.inputType);

      addValidation(
        colInfo.fieldKey,
        `Allowed_Values!$${allowedColLetter}$2:$${allowedColLetter}$${colInfo.values.length + 1}`,
        promptTitle,
        prompt
      );
    });

    return validations;
  };

  const canonicalColIndexByKey = new Map<string, number>();
  BULK_PRODUCT_COLUMNS.forEach((col, idx) => canonicalColIndexByKey.set(col.key, idx));

  const maxValidationRow = BULK_IMPORT_MAX_ROWS + 3; // Row 1 Group + Row 2 Header + Row 3 Example + 500 rows
  const productValidations = buildProductValidationsForColumns(
    canonicalColIndexByKey,
    3,
    maxValidationRow
  );

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
      "5. 공통 속성 단일/복수 선택 · 기타 직접입력 안내 (Common Attributes)",
      `단일 선택 항목(목록에서 1개만 선택 · 복수 입력 불가)과 복수 선택 항목(드롭다운에서 첫 번째 항목 선택 후 세미콜론 ';'으로 구분하여 추가 입력, 예: 건성 (Dry Skin); 민감성 (Sensitive Skin))을 구분해 입력해 주세요. ※ 주의: ${EXCEL_MULTI_SELECT_OVERWRITE_WARNING} 기타 허용(allow_other=true) 항목은 반드시 "기타: Cool" 또는 "Other: Cool" 형식으로 입력해 주세요.`,
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
    ...BULK_PRODUCT_COLUMNS.map((col) => {
      const liveAttr = col.attributeCode
        ? commonAttrs.find((a) => a.code === col.attributeCode)
        : undefined;
      return {
        height: 22,
        cells: [
          { value: col.header, style: STYLE.REF_BODY },
          { value: col.required ? "필수 (REQUIRED)" : "선택 (Optional)", style: STYLE.REF_BODY },
          { value: getSectionNameKo(col.section), style: STYLE.REF_BODY },
          { value: col.dbColumn, style: STYLE.REF_BODY },
          { value: liveAttr ? liveAttr.description : col.description, style: STYLE.REF_BODY },
        ],
      };
    }),
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
  // 6. Allowed_Values Sheet (Core Dropdown Lists + All 20 Option-Based Common Attributes G..Z)
  // =========================================================================
  const maxAllowedLen = Math.max(
    depth1DropdownLabels.length,
    volumeUnits.length,
    leadTimeUnits.length,
    colorMaps.length,
    booleans.length,
    flags.length,
    ...optionAttrDropdownColumns.map((c) => c.values.length)
  );

  const allowedHeaderCells: OoxmlCellSpec[] = [
    { value: "카테고리 1Depth (Category 1Depth)", style: STYLE.REF_HEADER },
    { value: "용량 단위 (Volume Unit)", style: STYLE.REF_HEADER },
    { value: "리드타임 단위 (Lead Time Unit)", style: STYLE.REF_HEADER },
    { value: "색상 계열 (Color Map)", style: STYLE.REF_HEADER },
    { value: "판매 여부 (Selling Online/Offline)", style: STYLE.REF_HEADER },
    { value: "상·하위 SKU 여부 (Parent/Child Flag)", style: STYLE.REF_HEADER },
    ...optionAttrDropdownColumns.map((c) => ({
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
        ...optionAttrDropdownColumns.map((c) => ({
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
      ...optionAttrDropdownColumns.map(() => ({ width: 30 })),
    ],
    rows: allowedRows,
    freezeRows: 1,
  };

  // =========================================================================
  // 7. Common_Attributes Sheet (Complete Reference for All 23 Common Attributes + R4 Guidance)
  // =========================================================================
  const inputTypeLabelMap: Record<string, string> = {
    NUMBER_UNIT: "숫자 입력 · 개월 (Numeric Months)",
    SINGLE_SELECT: "단일 선택 드롭다운 (Single Select)",
    MULTI_SELECT: "드롭다운 + 세미콜론 ';' 복수 입력 (Multi Select)",
    YES_NO_NA: "예/아니요/해당없음 드롭다운 (Yes / No / N/A)",
  };

  const commonAttrTableRows: OoxmlRowSpec[] = [
    {
      height: 28,
      cells: [
        { value: "속성 그룹 (Group)", style: STYLE.REF_HEADER },
        { value: "Products 시트 컬럼명 (Excel Header)", style: STYLE.REF_HEADER },
        { value: "EAV 속성 코드 (Attribute Code)", style: STYLE.REF_HEADER },
        { value: "입력 방식 (Input Type)", style: STYLE.REF_HEADER },
        { value: "N/A · 기타 허용", style: STYLE.REF_HEADER },
        { value: "허용 입력값 목록 (Accepted Values — 국문(영문)/국문/영문/코드 모두 인식)", style: STYLE.REF_HEADER },
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
          (o) => `${formatBilingualOptionLabel(o)} [${o.optionCode}]`
        );
        if (
          attr.allowNa &&
          !visibleOpts.some((o) => o.optionCode.toUpperCase() === "NOT_APPLICABLE")
        ) {
          formattedOpts.push("해당 없음 (Not Applicable) [NA]");
        }
        if (attr.allowOther) {
          formattedOpts.push(
            attr.inputType === "MULTI_SELECT"
              ? "직접 입력 시 'Other: Cool' 또는 '기타: Cool' (복수 예: 실온 (Room Temperature); 기타: Cool)"
              : "직접 입력 시 'Other: Cool' 또는 '기타: Cool'"
          );
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

  const commonAttrGuideStartRow = commonAttrTableRows.length + 2; // 1-based row after blank spacer
  const commonAttrSheetRows: OoxmlRowSpec[] = [
    ...commonAttrTableRows,
    { height: 10, cells: [] },
    {
      height: 24,
      cells: [
        {
          value: "■ 공통 속성 단일·복수 선택 및 기타(Other) 직접입력 필수 안내",
          style: STYLE.SECTION_HEADER,
        },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
      ],
    },
    {
      height: 26,
      cells: [
        { value: "복수 선택(MULTI_SELECT) 주의 안내", style: STYLE.REF_BODY, forceString: true },
        {
          value: `${EXCEL_MULTI_SELECT_OVERWRITE_WARNING} (예: 건성 (Dry Skin); 민감성 (Sensitive Skin))`,
          style: STYLE.REF_BODY,
          forceString: true,
        },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
      ],
    },
    {
      height: 26,
      cells: [
        { value: "단일 선택(SINGLE_SELECT) 입력 규칙", style: STYLE.REF_BODY, forceString: true },
        {
          value:
            "목록에서 하나의 항목만 선택하세요. 복수 입력은 허용되지 않습니다. 세미콜론(;)으로 여러 항목을 입력하면 검증 오류가 표시됩니다.",
          style: STYLE.REF_BODY,
          forceString: true,
        },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
      ],
    },
    {
      height: 28,
      cells: [
        { value: "기타(Other) 직접입력 규칙", style: STYLE.REF_BODY, forceString: true },
        {
          value:
            "'기타 직접입력 가능 (allow_other = true)' 항목만 'Other: Cool' 또는 '기타: Cool' (복수 선택 시 '실온 (Room Temperature); 기타: Cool') 형식을 허용합니다. 접두어 없는 임의 텍스트 및 '고정 옵션만 (allow_other = false)' 항목(대상 성별·규제 상태 등)에는 직접입력이 불가합니다.",
          style: STYLE.REF_BODY,
          forceString: true,
        },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
      ],
    },
  ];

  const commonAttributesSheetSpec: OoxmlSheetSpec = {
    name: "Common_Attributes",
    cols: [
      { width: 28 },
      { width: 38 },
      { width: 26 },
      { width: 34 },
      { width: 24 },
      { width: 86 },
      { width: 30 },
    ],
    rows: commonAttrSheetRows,
    merges: [
      `A${commonAttrGuideStartRow}:G${commonAttrGuideStartRow}`,
      `B${commonAttrGuideStartRow + 1}:G${commonAttrGuideStartRow + 1}`,
      `B${commonAttrGuideStartRow + 2}:G${commonAttrGuideStartRow + 2}`,
      `B${commonAttrGuideStartRow + 3}:G${commonAttrGuideStartRow + 3}`,
    ],
    freezeRows: 1,
    autoFilterRef: `A1:G${commonAttrTableRows.length}`,
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

export async function generateAnnotatedErrorWorkbookBuffer(
  options: GenerateAnnotatedErrorWorkbookOptions
): Promise<Buffer> {
  const { preview } = options;
  const rows = preview.rows ?? [];
  const activeBrands = options.brands.filter((b) => b.is_active !== false);
  const activeCategories = options.categories.filter((c) => c.is_active !== false);
  const commonAttrs = resolveTemplateCommonAttributes(options.commonAttributes);

  const specByKey = new Map<BulkRowRawFieldKey, BulkColumnSpec>();
  for (const col of BULK_PRODUCT_COLUMNS) {
    specByKey.set(col.key, col);
  }

  // Preserve exact uploaded column mappings & order (supports 86-col R2/R3, 52-col R1/V1, or custom subsets)
  const effectiveCols: Array<{
    spec: BulkColumnSpec;
    header: string;
  }> =
    preview.uploadedColumns && preview.uploadedColumns.length > 0
      ? preview.uploadedColumns.map((uc) => {
          const spec = specByKey.get(uc.key)!;
          return {
            spec,
            header: uc.header || spec.header,
          };
        })
      : BULK_PRODUCT_COLUMNS.map((spec) => ({
          spec,
          header: spec.header,
        }));

  const colIdxByKey = new Map<string, number>();
  effectiveCols.forEach((c, idx) => {
    colIdxByKey.set(c.spec.key, idx);
  });

  // Check whether original workbook used the 2-row header layout (Group Banner Row 1 + Column Header Row 2)
  const isStandard86Order =
    effectiveCols.length === BULK_PRODUCT_COLUMNS.length &&
    effectiveCols.every((c, idx) => c.spec.key === BULK_PRODUCT_COLUMNS[idx].key);
  const headerRowOneBased =
    preview.headerRowNumber && preview.headerRowNumber >= 2 ? 2 : isStandard86Order ? 2 : 1;
  const hasGroupBannerRow = headerRowOneBased === 2;

  const productRowsArray: OoxmlRowSpec[] = [];
  const productMerges: string[] = [];

  if (hasGroupBannerRow) {
    if (isStandard86Order) {
      const groupBannerSpans: Array<{
        startIdx: number;
        endIdx: number;
        label: string;
        style: number;
      }> = [
        { startIdx: 0, endIdx: 3, label: "★ 필수 입력 항목 (4개 필수 · Required)", style: STYLE.GROUP_REQUIRED },
        { startIdx: 4, endIdx: 5, label: "세부 카테고리 · 연동 선택 (Category)", style: STYLE.GROUP_CATEGORY },
        { startIdx: 6, endIdx: 13, label: "기본 정보 · 기본 스펙 (Basic Specs · 선택)", style: STYLE.GROUP_BASIC },
        { startIdx: 14, endIdx: 21, label: "기본 정보 · 상세/성분 (Content & INCI · 선택)", style: STYLE.GROUP_BASIC },
        { startIdx: 22, endIdx: 29, label: "기본 정보 · 바코드/판매처 (Barcodes & Links · 선택)", style: STYLE.GROUP_BASIC },
        { startIdx: 30, endIdx: 33, label: "가격 정보 · 선택 (Pricing)", style: STYLE.GROUP_PRICING },
        { startIdx: 34, endIdx: 41, label: "물류 규격 · 단품/포장 (Item & Package · 선택)", style: STYLE.GROUP_LOGISTICS },
        { startIdx: 42, endIdx: 51, label: "물류 규격 · 카톤/파렛트 (Carton & Pallet · 선택)", style: STYLE.GROUP_LOGISTICS },
        { startIdx: 52, endIdx: 62, label: "미디어 URL · 이미지 1~10 및 동영상 (Media URLs · 선택)", style: STYLE.GROUP_MEDIA },
        { startIdx: 63, endIdx: 66, label: "공통 속성 · 유통/보관 (Shelf Life & Storage · 선택)", style: STYLE.GROUP_COMMON_ATTR },
        { startIdx: 67, endIdx: 70, label: "공통 속성 · 패키지/제형 (Packaging & Format · 선택)", style: STYLE.GROUP_COMMON_ATTR },
        { startIdx: 71, endIdx: 73, label: "공통 속성 · 대상 고객 (Target Customer · 선택)", style: STYLE.GROUP_COMMON_ATTR },
        { startIdx: 74, endIdx: 78, label: "공통 속성 · 사용/주요고민 (Usage & Concerns · 선택)", style: STYLE.GROUP_COMMON_ATTR },
        { startIdx: 79, endIdx: 81, label: "공통 속성 · 향 정보 (Fragrance · 선택)", style: STYLE.GROUP_COMMON_ATTR },
        { startIdx: 82, endIdx: 85, label: "공통 속성 · 규제/등록 상태 (Regulatory · 브랜드 기재 · 선택)", style: STYLE.GROUP_COMMON_ATTR },
      ];
      const bannerCells: OoxmlCellSpec[] = [];
      for (const span of groupBannerSpans) {
        for (let i = span.startIdx; i <= span.endIdx; i++) {
          bannerCells.push({
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
      productRowsArray.push({ height: 24, cells: bannerCells });
    } else {
      productRowsArray.push({
        height: 24,
        cells: effectiveCols.map((c, idx) => ({
          value:
            idx === 0
              ? "★ 오류 검토용 원본 데이터 시트 (빨간색 표시 셀을 수정한 뒤 이 파일을 그대로 다시 업로드하세요)"
              : "",
          style: STYLE.GROUP_REQUIRED,
        })),
      });
      if (effectiveCols.length > 1) {
        productMerges.push(`A1:${encodeCellAddress(1, effectiveCols.length - 1)}`);
      }
    }
  }

  // Header Row (Row 2 when hasGroupBannerRow, else Row 1)
  productRowsArray.push({
    height: 34,
    cells: effectiveCols.map((c) => ({
      value: c.header,
      style: getColumnHeaderStyle(c.spec.section),
      forceString: true,
    })),
  });

  // Place each validated row at its exact original excelRowNumber (1-based) so cell refs match 100%!
  // If Row 3 was the skipped template example row (EXAMPLE-SKU-001), preserve a non-imported placeholder at Row 3.
  const firstProductExcelRow = rows[0]?.excelRowNumber ?? headerRowOneBased + 1;
  if (
    hasGroupBannerRow &&
    firstProductExcelRow >= 4 &&
    (preview.summary?.exampleRowsSkipped ?? 0) > 0
  ) {
    productRowsArray.push({
      height: 20,
      cells: effectiveCols.map((c) => {
        if (c.spec.key === "brand") {
          return {
            value: sanitizeExcelOutputCell(activeBrands[0]?.name || "Example Brand"),
            style: STYLE.EXAMPLE_GENERAL,
            forceString: true,
          };
        }
        if (c.spec.key === "manufactureSku") {
          return {
            value: BULK_TEMPLATE_EXAMPLE_SKU,
            style: STYLE.EXAMPLE_TEXT_AT,
            forceString: true,
          };
        }
        if (c.spec.key === "productNameEn") {
          return {
            value: "[EXAMPLE - 자동 제외] 아래 4행부터 빨간색으로 표시된 오류 셀을 수정해 주세요",
            style: STYLE.EXAMPLE_GENERAL,
            forceString: true,
          };
        }
        return {
          value: "",
          style: c.spec.textFormat ? STYLE.EXAMPLE_TEXT_AT : STYLE.EXAMPLE_GENERAL,
        };
      }),
    });
  }

  const cellComments: OoxmlCellCommentSpec[] = [];
  let firstInvalidCellRef: string | undefined;

  for (const row of rows) {
    // Fill any blank spacer rows in the original sheet so row numbers remain 100% aligned
    while (productRowsArray.length < row.excelRowNumber - 1) {
      productRowsArray.push({ height: 19, cells: [] });
    }

    const errorsByField = new Map<BulkRowRawFieldKey, BulkCellValidationIssue[]>();
    for (const err of row.errorDetails) {
      const list = errorsByField.get(err.fieldKey) ?? [];
      list.push(err);
      errorsByField.set(err.fieldKey, list);
    }

    const warningsByField = new Map<BulkRowRawFieldKey, BulkCellValidationIssue[]>();
    for (const warn of row.warningDetails) {
      const list = warningsByField.get(warn.fieldKey) ?? [];
      list.push(warn);
      warningsByField.set(warn.fieldKey, list);
    }

    const rZeroBased = productRowsArray.length;
    const rOneBased = rZeroBased + 1;

    const rowCells: OoxmlCellSpec[] = effectiveCols.map((colItem, colZeroBased) => {
      const key = colItem.spec.key;
      const isTextFmt = Boolean(colItem.spec.textFormat);
      const rawVal = row.rawValues?.[key] ?? "";
      const safeVal = sanitizeExcelOutputCell(rawVal);

      const fieldErrors = errorsByField.get(key);
      const fieldWarnings = warningsByField.get(key);

      let cellStyle: number = isTextFmt ? STYLE.REF_BODY_TEXT_AT : STYLE.REF_BODY;

      if (fieldErrors && fieldErrors.length > 0) {
        cellStyle = isTextFmt ? STYLE.CELL_ERROR_TEXT_AT : STYLE.CELL_ERROR;
        if (!firstInvalidCellRef) {
          firstInvalidCellRef = encodeCellAddress(rOneBased, colZeroBased);
        }
        const commentLines = fieldErrors.map(
          (fe, i) =>
            `[오류 ${i + 1} · ${fe.categoryLabelKo}]\n사유: ${fe.reason}\n허용값: ${fe.acceptedValues}\n수정: ${fe.guidance}`
        );
        cellComments.push({
          rowZeroBased: rZeroBased,
          colZeroBased,
          text: commentLines.join("\n\n").slice(0, 1200),
        });
      } else if (fieldWarnings && fieldWarnings.length > 0) {
        cellStyle = isTextFmt ? STYLE.CELL_WARNING_TEXT_AT : STYLE.CELL_WARNING;
        const warnLines = fieldWarnings.map(
          (fw) => `[확인 필요]\n사유: ${fw.reason}\n안내: ${fw.guidance}`
        );
        cellComments.push({
          rowZeroBased: rZeroBased,
          colZeroBased,
          text: warnLines.join("\n\n").slice(0, 900),
        });
      } else if (row.status === "INVALID") {
        cellStyle = isTextFmt ? STYLE.ROW_INVALID_TEXT_AT : STYLE.ROW_INVALID_BG;
      } else if (row.status === "WARNING") {
        cellStyle = isTextFmt ? STYLE.ROW_WARNING_TEXT_AT : STYLE.ROW_WARNING_BG;
      }

      return {
        value: safeVal,
        style: cellStyle,
        forceString: true,
      };
    });

    productRowsArray.push({
      height: 22,
      cells: rowCells,
    });
  }

  // Build reference sheets & dropdown dataValidations matching effectiveCols
  const {
    hierarchyRows: categoryRefRows,
    d1ToD2Pairs,
    d2ToD3Pairs,
    hasDependentHierarchy,
  } = buildCategoryReferenceAndLookupTables(activeCategories);

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

  const optionCommonAttrs = commonAttrs.filter(
    (a) =>
      a.inputType === "SINGLE_SELECT" ||
      a.inputType === "YES_NO_NA" ||
      a.inputType === "MULTI_SELECT"
  );
  const optionAttrDropdownColumns = optionCommonAttrs.map((attr) => {
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
      inputType: attr.inputType,
      allowOther: attr.allowOther,
    };
  });

  const startValidationRow = headerRowOneBased + 1;
  const endValidationRow = Math.max(productRowsArray.length + 50, BULK_IMPORT_MAX_ROWS + 3);
  const annotatedValidations: OoxmlDataValidationSpec[] = [];

  const addAnnotatedDropdown = (
    key: string,
    formula1: string,
    promptTitle?: string,
    prompt?: string
  ) => {
    const idx = colIdxByKey.get(key);
    if (idx === undefined || idx < 0) return;
    const colLetter = encodeColLetter(idx);
    annotatedValidations.push({
      sqref: `${colLetter}${startValidationRow}:${colLetter}${endValidationRow}`,
      formula1,
      promptTitle,
      prompt,
    });
  };

  if (activeBrands.length > 0) {
    addAnnotatedDropdown("brand", `Brands!$A$2:$A$${activeBrands.length + 1}`);
  }
  if (depth1DropdownLabels.length > 0) {
    addAnnotatedDropdown(
      "category1Depth",
      `Allowed_Values!$A$2:$A$${depth1DropdownLabels.length + 1}`
    );
  }
  const d1ColIdx = colIdxByKey.get("category1Depth");
  const d2ColIdx = colIdxByKey.get("category2Depth");
  if (hasDependentHierarchy && d1ToD2Pairs.length > 0 && d1ColIdx !== undefined) {
    const d1Ref = `${encodeColLetter(d1ColIdx)}${startValidationRow}`;
    const lastLRow = d1ToD2Pairs.length + 1;
    addAnnotatedDropdown(
      "category2Depth",
      `OFFSET(Categories!$M$2,MATCH(${d1Ref},Categories!$L$2:$L$${lastLRow},0)-1,0,COUNTIF(Categories!$L$2:$L$${lastLRow},${d1Ref}),1)`
    );
  }
  if (hasDependentHierarchy && d2ToD3Pairs.length > 0 && d2ColIdx !== undefined) {
    const d2Ref = `${encodeColLetter(d2ColIdx)}${startValidationRow}`;
    const lastORow = d2ToD3Pairs.length + 1;
    addAnnotatedDropdown(
      "category3Depth",
      `OFFSET(Categories!$P$2,MATCH(${d2Ref},Categories!$O$2:$O$${lastORow},0)-1,0,COUNTIF(Categories!$O$2:$O$${lastORow},${d2Ref}),1)`
    );
  }
  addAnnotatedDropdown("volumeUnit", `Allowed_Values!$B$2:$B$${volumeUnits.length + 1}`);
  addAnnotatedDropdown("countryOfOrigin", `Countries!$A$2:$A$${ALL_COUNTRIES.length + 1}`);
  addAnnotatedDropdown("leadTimeUnit", `Allowed_Values!$C$2:$C$${leadTimeUnits.length + 1}`);
  addAnnotatedDropdown("colorMap", `Allowed_Values!$D$2:$D$${colorMaps.length + 1}`);
  addAnnotatedDropdown("sellingOnline", `Allowed_Values!$E$2:$E$3`);
  addAnnotatedDropdown("sellingOffline", `Allowed_Values!$E$2:$E$3`);
  addAnnotatedDropdown("parentSku", `Allowed_Values!$F$2:$F$3`);
  addAnnotatedDropdown("childSku", `Allowed_Values!$F$2:$F$3`);

  optionAttrDropdownColumns.forEach((colInfo, offsetIdx) => {
    if (colInfo.values.length === 0) return;
    const allowedColLetter = encodeColLetter(6 + offsetIdx);
    const { promptTitle, prompt } = resolveOptionAttributeValidationPrompt(colInfo.inputType);
    addAnnotatedDropdown(
      colInfo.fieldKey,
      `Allowed_Values!$${allowedColLetter}$2:$${allowedColLetter}$${colInfo.values.length + 1}`,
      promptTitle,
      prompt
    );
  });

  const productsSheetSpec: OoxmlSheetSpec = {
    name: "Products",
    cols: effectiveCols.map((c) => ({
      width: c.spec.width,
      style: c.spec.textFormat ? STYLE.TEXT_AT : undefined,
    })),
    rows: productRowsArray,
    merges: productMerges.length > 0 ? productMerges : undefined,
    freezeRows: headerRowOneBased,
    activeCell: firstInvalidCellRef || `A${headerRowOneBased + 1}`,
    autoFilterRef: `A${headerRowOneBased}:${encodeCellAddress(
      Math.max(productRowsArray.length, headerRowOneBased + 1),
      effectiveCols.length - 1
    )}`,
    dataValidations: annotatedValidations,
    comments: cellComments.length > 0 ? cellComments : undefined,
    defaultRowHeight: 20,
  };

  // =========================================================================
  // Sheet 2: "오류 요약" (9 Required Columns — Distinguishing Errors, Warnings, Valid Rows)
  // =========================================================================
  const errorSummaryRows: OoxmlRowSpec[] = [
    {
      height: 28,
      cells: [
        { value: "Excel 행 번호 (Excel Row)", style: STYLE.ERROR_HEADER },
        { value: "제조사 SKU (Manufacturer SKU)", style: STYLE.ERROR_HEADER },
        { value: "영문 제품명 (Product Name)", style: STYLE.ERROR_HEADER },
        { value: "오류 수 / 구분 (Error Count)", style: STYLE.ERROR_HEADER },
        { value: "열 · 항목명 (Column / Field)", style: STYLE.ERROR_HEADER },
        { value: "제출된 값 (Submitted Value)", style: STYLE.ERROR_HEADER },
        { value: "오류 사유 (Error Reason)", style: STYLE.ERROR_HEADER },
        { value: "허용값 / 입력 형식 (Expected / Allowed Values)", style: STYLE.ERROR_HEADER },
        { value: "수정 가이드 (Correction Guidance)", style: STYLE.ERROR_HEADER },
      ],
    },
  ];

  for (const row of rows) {
    if (row.status === "INVALID") {
      const errCount = row.errorDetails.length;
      for (const issue of row.errorDetails) {
        const actualColIdx = colIdxByKey.get(issue.fieldKey) ?? issue.colIndex;
        const actualColLetter = encodeColLetter(actualColIdx);
        const cellCoord = `${actualColLetter}${row.excelRowNumber}`;
        errorSummaryRows.push({
          height: 26,
          cells: [
            { value: row.excelRowNumber, style: STYLE.CELL_ERROR },
            {
              value: sanitizeExcelOutputCell(row.rawValues?.manufactureSku || row.rawManufactureSku || "(미입력)"),
              style: STYLE.CELL_ERROR_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(row.rawProductNameEn || "(미입력)"),
              style: STYLE.ROW_INVALID_TEXT_AT,
              forceString: true,
            },
            {
              value: `오류 ${errCount}건`,
              style: STYLE.CELL_ERROR_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(`${cellCoord} · ${issue.columnHeader}`),
              style: STYLE.ROW_INVALID_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(issue.submittedValue || "(빈칸)"),
              style: STYLE.CELL_ERROR_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(`[오류 · ${issue.categoryLabelKo}] ${issue.reason}`),
              style: STYLE.ROW_INVALID_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(issue.acceptedValues),
              style: STYLE.ROW_INVALID_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(issue.guidance),
              style: STYLE.ROW_INVALID_TEXT_AT,
              forceString: true,
            },
          ],
        });
      }
    } else if (row.status === "WARNING" && row.warningDetails.length > 0) {
      for (const warn of row.warningDetails) {
        const actualColIdx = colIdxByKey.get(warn.fieldKey) ?? warn.colIndex;
        const actualColLetter = encodeColLetter(actualColIdx);
        const cellCoord = `${actualColLetter}${row.excelRowNumber}`;
        errorSummaryRows.push({
          height: 24,
          cells: [
            { value: row.excelRowNumber, style: STYLE.CELL_WARNING },
            {
              value: sanitizeExcelOutputCell(row.rawValues?.manufactureSku || row.rawManufactureSku),
              style: STYLE.CELL_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(row.rawProductNameEn),
              style: STYLE.ROW_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: `확인 필요 (${row.warningDetails.length}건 · 등록 가능)`,
              style: STYLE.CELL_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(`${cellCoord} · ${warn.columnHeader}`),
              style: STYLE.ROW_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(warn.submittedValue || "(빈칸)"),
              style: STYLE.ROW_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(`[확인 필요] ${warn.reason}`),
              style: STYLE.ROW_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(warn.acceptedValues),
              style: STYLE.ROW_WARNING_TEXT_AT,
              forceString: true,
            },
            {
              value: sanitizeExcelOutputCell(warn.guidance),
              style: STYLE.ROW_WARNING_TEXT_AT,
              forceString: true,
            },
          ],
        });
      }
    }
  }

  // Explicitly summarize Valid rows so Errors, Warnings, and Valid rows are unmistakably distinguished
  const validRowNums = rows
    .filter((r) => r.status === "VALID")
    .map((r) => `${r.excelRowNumber}행`);
  if (validRowNums.length > 0) {
    errorSummaryRows.push({
      height: 24,
      cells: [
        { value: "-", style: STYLE.REF_BODY, forceString: true },
        { value: `정상 통과 (${validRowNums.length}건)`, style: STYLE.REF_BODY_TEXT_AT, forceString: true },
        {
          value: sanitizeExcelOutputCell(
            validRowNums.slice(0, 15).join(", ") +
              (validRowNums.length > 15 ? ` 외 ${validRowNums.length - 15}건` : "")
          ),
          style: STYLE.REF_BODY_TEXT_AT,
          forceString: true,
        },
        { value: "오류 0건 (정상)", style: STYLE.REF_BODY_TEXT_AT, forceString: true },
        { value: "전체 검증 항목 통과", style: STYLE.REF_BODY_TEXT_AT, forceString: true },
        { value: "-", style: STYLE.REF_BODY_TEXT_AT, forceString: true },
        { value: "[정상] 검증 오류가 없으며 그대로 등록 가능합니다.", style: STYLE.REF_BODY_TEXT_AT, forceString: true },
        { value: "-", style: STYLE.REF_BODY_TEXT_AT, forceString: true },
        {
          value: "Products 시트의 빨간색 오류 행만 수정한 후 이 파일을 그대로 다시 업로드하세요 ('오류 요약' 시트는 자동 무시됩니다).",
          style: STYLE.REF_BODY_TEXT_AT,
          forceString: true,
        },
      ],
    });
  }

  const errorSummarySheetSpec: OoxmlSheetSpec = {
    name: "오류 요약",
    cols: [
      { width: 16 },
      { width: 24, style: STYLE.TEXT_AT },
      { width: 32, style: STYLE.TEXT_AT },
      { width: 22, style: STYLE.TEXT_AT },
      { width: 34, style: STYLE.TEXT_AT },
      { width: 28, style: STYLE.TEXT_AT },
      { width: 52, style: STYLE.TEXT_AT },
      { width: 48, style: STYLE.TEXT_AT },
      { width: 52, style: STYLE.TEXT_AT },
    ],
    rows: errorSummaryRows,
    freezeRows: 1,
    autoFilterRef: `A1:I${Math.max(errorSummaryRows.length, 2)}`,
    defaultRowHeight: 22,
  };

  // Reuse Reference Sheets (Instructions, Brands, Categories, Countries, Allowed_Values, Common_Attributes)
  const instructionsSheetSpec: OoxmlSheetSpec = {
    name: "Instructions",
    cols: [{ width: 38 }, { width: 18 }, { width: 26 }, { width: 34 }, { width: 70 }],
    rows: [
      {
        height: 28,
        cells: [
          {
            value: "K SELECT NETWORK — 오류 표시 검토용 Excel 안내 (Annotated Error Review Workbook)",
            style: STYLE.TITLE_BANNER,
          },
          { value: "", style: STYLE.TITLE_BANNER },
          { value: "", style: STYLE.TITLE_BANNER },
          { value: "", style: STYLE.TITLE_BANNER },
          { value: "", style: STYLE.TITLE_BANNER },
        ],
      },
      {
        height: 26,
        cells: [
          { value: "수정 및 재업로드 안내", style: STYLE.REF_BODY },
          {
            value:
              '1) "오류 요약" 시트에서 행/열별 오류 사유와 허용값을 확인하세요.  2) "Products" 시트의 빨간색 강조 셀(마우스 오버 시 메모 표시)을 직접 수정하세요.  3) 저장 후 이 Excel 파일을 그대로 다시 업로드하면 "오류 요약" 시트는 자동으로 무시되고 정상 검증됩니다.',
            style: STYLE.REF_BODY,
          },
          { value: "", style: STYLE.REF_BODY },
          { value: "", style: STYLE.REF_BODY },
          { value: "", style: STYLE.REF_BODY },
        ],
      },
    ],
    merges: ["A1:E1", "B2:E2"],
    freezeRows: 1,
  };

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
    "",
    "LKP_D1_PARENT",
    "LKP_D2_CHILD",
    "",
    "LKP_D2_PARENT",
    "LKP_D3_CHILD",
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
      cells.push(
        hRow ? { value: hRow[c] ?? "", style: STYLE.REF_BODY, forceString: true } : null
      );
    }
    cells.push(null);
    cells.push(p12 ? { value: p12[0], forceString: true } : null);
    cells.push(p12 ? { value: p12[1], forceString: true } : null);
    cells.push(null);
    cells.push(p23 ? { value: p23[0], forceString: true } : null);
    cells.push(p23 ? { value: p23[1], forceString: true } : null);
    categoriesBodyRows.push({ height: 20, cells });
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

  const maxAllowedLen = Math.max(
    depth1DropdownLabels.length,
    volumeUnits.length,
    leadTimeUnits.length,
    colorMaps.length,
    booleans.length,
    flags.length,
    ...optionAttrDropdownColumns.map((c) => c.values.length)
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
        ...optionAttrDropdownColumns.map((c) => ({ value: c.header, style: STYLE.REF_HEADER })),
      ],
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
        ...optionAttrDropdownColumns.map((c) => ({
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
      ...optionAttrDropdownColumns.map(() => ({ width: 30 })),
    ],
    rows: allowedRows,
    freezeRows: 1,
  };

  const inputTypeLabelMap: Record<string, string> = {
    NUMBER_UNIT: "숫자 입력 · 개월 (Numeric Months)",
    SINGLE_SELECT: "단일 선택 드롭다운 (Single Select)",
    MULTI_SELECT: "드롭다운 + 세미콜론 ';' 복수 입력 (Multi Select)",
    YES_NO_NA: "예/아니요/해당없음 드롭다운 (Yes / No / N/A)",
  };
  const commonAttrTableRows: OoxmlRowSpec[] = [
    {
      height: 28,
      cells: [
        { value: "속성 그룹 (Group)", style: STYLE.REF_HEADER },
        { value: "Products 시트 컬럼명 (Excel Header)", style: STYLE.REF_HEADER },
        { value: "EAV 속성 코드 (Attribute Code)", style: STYLE.REF_HEADER },
        { value: "입력 방식 (Input Type)", style: STYLE.REF_HEADER },
        { value: "N/A · 기타 허용", style: STYLE.REF_HEADER },
        { value: "허용 입력값 목록 (Accepted Values)", style: STYLE.REF_HEADER },
        { value: "입력 예시 (Example)", style: STYLE.REF_HEADER },
      ],
    },
    ...commonAttrs.map((attr) => {
      const visibleOpts = attr.options.filter((o) => !o.adminOnlyOption);
      const acceptedSummary =
        attr.inputType === "NUMBER_UNIT"
          ? attr.allowNa
            ? "1 ~ 600 양수 숫자 (단위: 개월) 또는 '해당 없음 (NA)'"
            : "1 ~ 600 양수 숫자 (단위: 개월)"
          : [
              ...visibleOpts.map((o) => `${formatBilingualOptionLabel(o)} [${o.optionCode}]`),
              ...(attr.allowNa &&
              !visibleOpts.some((o) => o.optionCode.toUpperCase() === "NOT_APPLICABLE")
                ? ["해당 없음 (Not Applicable) [NA]"]
                : []),
              ...(attr.allowOther
                ? [
                    attr.inputType === "MULTI_SELECT"
                      ? "직접 입력 시 'Other: Cool' 또는 '기타: Cool' (복수 예: 실온 (Room Temperature); 기타: Cool)"
                      : "직접 입력 시 'Other: Cool' 또는 '기타: Cool'",
                  ]
                : []),
            ].join("  |  ");

      return {
        height: 26,
        cells: [
          { value: `${attr.attrGroupKo} (${attr.attrGroupEn})`, style: STYLE.REF_BODY, forceString: true },
          { value: attr.header, style: STYLE.REF_BODY, forceString: true },
          { value: attr.code, style: STYLE.REF_BODY, forceString: true },
          { value: inputTypeLabelMap[attr.inputType] || attr.inputType, style: STYLE.REF_BODY, forceString: true },
          {
            value: `${attr.allowNa ? "N/A 가능" : "N/A 불가"} · ${attr.allowOther ? "기타 직접입력 가능" : "고정 옵션만"}`,
            style: STYLE.REF_BODY,
            forceString: true,
          },
          { value: acceptedSummary, style: STYLE.REF_BODY, forceString: true },
          { value: String(attr.exampleValue), style: STYLE.REF_BODY, forceString: true },
        ],
      };
    }),
  ];
  const annotatedCommonAttrGuideStartRow = commonAttrTableRows.length + 2;
  const commonAttrSheetRows: OoxmlRowSpec[] = [
    ...commonAttrTableRows,
    { height: 10, cells: [] },
    {
      height: 24,
      cells: [
        {
          value: "■ 공통 속성 단일·복수 선택 및 기타(Other) 직접입력 필수 안내",
          style: STYLE.SECTION_HEADER,
        },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
        { value: "", style: STYLE.SECTION_HEADER },
      ],
    },
    {
      height: 26,
      cells: [
        { value: "복수 선택(MULTI_SELECT) 주의 안내", style: STYLE.REF_BODY, forceString: true },
        {
          value: `${EXCEL_MULTI_SELECT_OVERWRITE_WARNING} (예: 건성 (Dry Skin); 민감성 (Sensitive Skin))`,
          style: STYLE.REF_BODY,
          forceString: true,
        },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
      ],
    },
    {
      height: 28,
      cells: [
        { value: "기타(Other) 직접입력 규칙", style: STYLE.REF_BODY, forceString: true },
        {
          value:
            "'기타 직접입력 가능 (allow_other = true)' 항목만 'Other: Cool' 또는 '기타: Cool' (복수 선택 시 '실온 (Room Temperature); 기타: Cool') 형식을 허용합니다. 접두어 없는 임의 텍스트 및 '고정 옵션만 (allow_other = false)' 항목에는 직접입력이 불가합니다.",
          style: STYLE.REF_BODY,
          forceString: true,
        },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
        { value: "", style: STYLE.REF_BODY },
      ],
    },
  ];
  const commonAttributesSheetSpec: OoxmlSheetSpec = {
    name: "Common_Attributes",
    cols: [
      { width: 28 },
      { width: 38 },
      { width: 26 },
      { width: 34 },
      { width: 24 },
      { width: 86 },
      { width: 30 },
    ],
    rows: commonAttrSheetRows,
    merges: [
      `A${annotatedCommonAttrGuideStartRow}:G${annotatedCommonAttrGuideStartRow}`,
      `B${annotatedCommonAttrGuideStartRow + 1}:G${annotatedCommonAttrGuideStartRow + 1}`,
      `B${annotatedCommonAttrGuideStartRow + 2}:G${annotatedCommonAttrGuideStartRow + 2}`,
    ],
    freezeRows: 1,
    autoFilterRef: `A1:G${commonAttrTableRows.length}`,
  };

  return buildOoxmlWorkbookBuffer([
    productsSheetSpec,
    errorSummarySheetSpec,
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
