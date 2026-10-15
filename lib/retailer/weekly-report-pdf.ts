import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import { WeeklyReportData, WeeklyReportItem, WeeklyReportStoreStatus } from "./weekly-report-types";

/**
 * Text sanitization for pdf-lib WinAnsi standard font encoding.
 * Translates em-dashes, en-dashes, typographic quotes, and non-Latin1 characters
 * so PDF generation never crashes on unexpected strings.
 */
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/[\u2014\u2015]/g, "-") // em dash -> hyphen/dash
    .replace(/[\u2013]/g, "-") // en dash -> hyphen/dash
    .replace(/[\u2018\u2019]/g, "'") // single quotes
    .replace(/[\u201C\u201D]/g, '"') // double quotes
    .replace(/[\u2022]/g, "*") // bullet
    .replace(/[\u2026]/g, "...") // ellipsis
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ") // preserve Latin-1, replace unsupported unicode with space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word-wrapping helper for pdf-lib with standard fonts
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = cleanText(text).split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/**
 * Currency formatter with Latin-1 safe characters
 */
function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format integer quantity
 */
function formatQty(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return val.toLocaleString("en-US");
}

/**
 * Formats generation timestamp in Eastern Time (ET) per approved Claude design
 */
function formatEasternTimestamp(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${formatter.format(date)} ET`;
  } catch {
    const utc = date.getTime();
    const etOffset = -4 * 3600000;
    const etDate = new Date(utc + etOffset);
    return `${etDate.toISOString().slice(0, 10)} ET`;
  }
}

/**
 * Formats store submitted timestamp in Eastern Time (ET)
 */
function formatStoreSubmittedTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  try {
    const d = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.format(d);
  } catch {
    return timestamp;
  }
}

/**
 * Formats a sanitized file name for the downloaded PDF
 */
export function getWeeklyReportPdfFilename(data: WeeklyReportData): string {
  const week = (data.reportingWeek || "Current-Week").replace(/[^a-zA-Z0-9_-]/g, "");
  if (data.selectedStoreId === "all") {
    return `KSELECT_Weekly_Report_${week}_Company-Overview.pdf`;
  }
  const rawStoreName = data.selectedStoreName || "Store";
  const sanitizedStore = rawStoreName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Store";
  return `KSELECT_Weekly_Report_${week}_${sanitizedStore}.pdf`;
}

/**
 * Helper to safely load official K SELECT HUB logo asset
 */
async function loadHubLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const possiblePaths = [
      path.join(process.cwd(), "public", "retailer-brand-mark.jpg"),
      path.join(process.cwd(), "public", "hub-icon.png"),
      path.join(process.cwd(), "public", "ksn-symbol.png"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const bytes = fs.readFileSync(p);
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) {
          return await pdfDoc.embedJpg(bytes);
        } else if (p.endsWith(".png")) {
          return await pdfDoc.embedPng(bytes);
        }
      }
    }
  } catch (err) {
    console.warn("Notice: Logo image load deferred to vector fallback:", err);
  }
  return null;
}

/**
 * Main Authoritative Weekly Performance & Reorder Report PDF Generator
 * Pure server-side generator using pdf-lib implementing the approved Claude visual design:
 * - Black branded header with official K SELECT HUB logo & week display
 * - Compact metadata summary card
 * - Partial coverage alert box in soft magenta
 * - Four prominent KPI summary cards with magenta Reorder Needed highlight
 * - Compact Store Check Coverage table
 * - Dynamic product performance table with magenta reorder accent bars & status clarity
 * - Two-column Reporting Methodology & Audit Notice
 * - Professional running headers & footers with accurate Page X of Y pagination
 */
export async function generateWeeklyReportPdf(data: WeeklyReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Typography
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Logo asset
  const logoImage = await loadHubLogo(pdfDoc);

  // US Letter Portrait (612 x 792 pt)
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36; // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2; // 540 pt
  const bottomThreshold = margin + 28; // Space for running footer

  // Approved Claude Design Palette
  const cBlack = rgb(0.07, 0.07, 0.08); // #121214 header background
  const cWhite = rgb(1.0, 1.0, 1.0);
  const cDark = rgb(0.12, 0.14, 0.18); // #1f242e primary text
  const cMuted = rgb(0.45, 0.49, 0.55); // #737d8c secondary text
  const cBorder = rgb(0.88, 0.90, 0.93); // #e2e8f0 border line
  const cLightGray = rgb(0.97, 0.98, 0.99); // #f8fafc card/header background
  const cMagenta = rgb(0.86, 0.12, 0.44); // #db1d70 brand highlight
  const cMagentaBg = rgb(0.995, 0.965, 0.98); // #fdf2f8 soft card highlight
  const cMagentaBorder = rgb(0.96, 0.78, 0.88); // #fbcfe8 soft magenta border
  const cGreen = rgb(0.06, 0.52, 0.28); // #108547
  const cAmber = rgb(0.85, 0.45, 0.05); // #d97706

  // Formatted generation timestamp in ET
  const generatedTimestampET = formatEasternTimestamp(new Date());

  // Table Column Widths (Sum = 540 pt = contentWidth)
  const colWidths = {
    product: 182, // Product / SKU / Brand
    remaining: 48, // Remaining units
    incoming: 46,  // Incoming units
    sold: 46,      // Est. Units Sold
    sales: 54,     // Est. Sales
    profit: 54,    // Est. Profit
    reorder: 110,  // Suggested Reorder
  };

  // Document Pages & State
  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);
  let y = pageHeight - 26; // Current vertical cursor

  // Helper: Draw Logo Icon
  function drawLogoIcon(page: PDFPage, x: number, y: number, size: number) {
    if (logoImage) {
      page.drawImage(logoImage, {
        x,
        y,
        width: size,
        height: size,
      });
    } else {
      // Crisp vector fallback
      page.drawRectangle({
        x,
        y,
        width: size,
        height: size,
        color: cMagenta,
        borderWidth: 0,
      });
      page.drawText("K", {
        x: x + size * 0.28,
        y: y + size * 0.22,
        size: size * 0.65,
        font: helveticaBold,
        color: cWhite,
      });
    }
  }

  // ===========================================================================
  // 1. PAGE 1 BRANDED BLACK HEADER
  // ===========================================================================
  const headerHeight = 50;
  const headerY = y - headerHeight;

  // Header black container
  currentPage.drawRectangle({
    x: margin,
    y: headerY,
    width: contentWidth,
    height: headerHeight,
    color: cBlack,
  });

  // Left: Logo & Brand Name
  const logoSize = 30;
  drawLogoIcon(currentPage, margin + 12, headerY + (headerHeight - logoSize) / 2, logoSize);

  currentPage.drawText("K SELECT HUB", {
    x: margin + 12 + logoSize + 8,
    y: headerY + 27,
    size: 12,
    font: helveticaBold,
    color: cWhite,
  });

  currentPage.drawText("CURATED, CONNECTED, BRAND NETWORK", {
    x: margin + 12 + logoSize + 8,
    y: headerY + 14,
    size: 5.5,
    font: helveticaBold,
    color: rgb(0.85, 0.45, 0.65),
  });

  // Right: Reporting Week
  const weekLabelText = "REPORTING WEEK";
  const weekLabelWidth = helveticaBold.widthOfTextAtSize(weekLabelText, 6.0);
  currentPage.drawText(weekLabelText, {
    x: margin + contentWidth - 14 - weekLabelWidth,
    y: headerY + 29,
    size: 6.0,
    font: helveticaBold,
    color: rgb(0.65, 0.68, 0.75),
  });

  const weekValueText = cleanText(data.reportingWeek);
  const weekValueWidth = helveticaBold.widthOfTextAtSize(weekValueText, 13.5);
  currentPage.drawText(weekValueText, {
    x: margin + contentWidth - 14 - weekValueWidth,
    y: headerY + 13,
    size: 13.5,
    font: helveticaBold,
    color: cWhite,
  });

  y = headerY - 14;

  // ===========================================================================
  // 2. REPORT TITLE & COVERAGE STATUS BADGE
  // ===========================================================================
  const titleY = y - 12;
  currentPage.drawText("Weekly Performance & Reorder Report", {
    x: margin,
    y: titleY,
    size: 15,
    font: helveticaBold,
    color: cDark,
  });

  // Coverage Status Badge on Right
  let badgeLabel = "COMPLETE COVERAGE";
  let badgeBorder = cBorder;
  let badgeTextCol = cDark;
  let badgeSquareCol = cGreen;

  if (data.coverageStatus === "partial") {
    badgeLabel = "PARTIAL COVERAGE";
    badgeBorder = cMagentaBorder;
    badgeTextCol = cMagenta;
    badgeSquareCol = cMagenta;
  } else if (data.coverageStatus === "none" || data.summary.hasBaselineOnlyOverall) {
    badgeLabel = data.summary.hasBaselineOnlyOverall ? "BASELINE ESTABLISHED" : "NO CHECKS SUBMITTED";
    badgeBorder = cBorder;
    badgeTextCol = cDark;
    badgeSquareCol = cMuted;
  }

  const badgeTextW = helveticaBold.widthOfTextAtSize(badgeLabel, 6.8);
  const badgeW = badgeTextW + 24;
  const badgeH = 17;
  const badgeX = margin + contentWidth - badgeW;
  const badgeBoxY = titleY - 4;

  currentPage.drawRectangle({
    x: badgeX,
    y: badgeBoxY,
    width: badgeW,
    height: badgeH,
    color: cWhite,
    borderColor: badgeBorder,
    borderWidth: 0.75,
  });

  // Small square indicator
  currentPage.drawRectangle({
    x: badgeX + 7,
    y: badgeBoxY + 6.5,
    width: 4,
    height: 4,
    color: badgeSquareCol,
  });

  currentPage.drawText(badgeLabel, {
    x: badgeX + 16,
    y: badgeBoxY + 5.5,
    size: 6.8,
    font: helveticaBold,
    color: badgeTextCol,
  });

  y = titleY - 18;

  // ===========================================================================
  // 3. COMPACT METADATA SUMMARY CARD (3 Columns x 2 Rows)
  // ===========================================================================
  const metaH = 46;
  currentPage.drawRectangle({
    x: margin,
    y: y - metaH,
    width: contentWidth,
    height: metaH,
    color: cLightGray,
    borderColor: cBorder,
    borderWidth: 0.5,
  });

  // Vertical dividers
  currentPage.drawLine({
    start: { x: margin + 175, y: y - 5 },
    end: { x: margin + 175, y: y - metaH + 5 },
    thickness: 0.5,
    color: cBorder,
  });
  currentPage.drawLine({
    start: { x: margin + 355, y: y - 5 },
    end: { x: margin + 355, y: y - metaH + 5 },
    thickness: 0.5,
    color: cBorder,
  });

  // Col 1: Retailer & Generated At
  currentPage.drawText("RETAILER COMPANY", { x: margin + 10, y: y - 12, size: 5.6, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(data.companyName), { x: margin + 10, y: y - 22, size: 7.5, font: helveticaBold, color: cDark });

  currentPage.drawText("GENERATED AT", { x: margin + 10, y: y - 32, size: 5.6, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(generatedTimestampET), { x: margin + 10, y: y - 41, size: 7.0, font: helvetica, color: cDark });

  // Col 2: Store Scope & Coverage
  currentPage.drawText("STORE SCOPE", { x: margin + 185, y: y - 12, size: 5.6, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(data.selectedStoreName), { x: margin + 185, y: y - 22, size: 7.5, font: helveticaBold, color: cDark });

  currentPage.drawText("STORE COVERAGE", { x: margin + 185, y: y - 32, size: 5.6, font: helveticaBold, color: cMuted });
  const coveragePercent = data.totalStores > 0 ? Math.round((data.submittedStoresCount / data.totalStores) * 100) : 0;
  const covSummaryText = cleanText(`${data.submittedStoresCount} of ${data.totalStores} stores submitted (${coveragePercent}%)`);
  currentPage.drawText(covSummaryText, {
    x: margin + 185,
    y: y - 41,
    size: 7.0,
    font: helveticaBold,
    color: data.coverageStatus === "partial" ? cMagenta : cDark,
  });

  // Col 3: Reporting Week & Price Basis
  currentPage.drawText("REPORTING WEEK", { x: margin + 365, y: y - 12, size: 5.6, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(data.formattedWeekLabel), { x: margin + 365, y: y - 22, size: 7.2, font: helveticaBold, color: cDark });

  currentPage.drawText("PRICE BASIS", { x: margin + 365, y: y - 32, size: 5.6, font: helveticaBold, color: cMuted });
  currentPage.drawText("Physical shelf audit delta & store SRP", { x: margin + 365, y: y - 41, size: 6.8, font: helveticaOblique, color: cMuted });

  y -= metaH + 8;

  // ===========================================================================
  // 4. PARTIAL COVERAGE ALERT BOX (If Partial Coverage)
  // ===========================================================================
  if (data.coverageStatus === "partial") {
    const alertH = 20;
    currentPage.drawRectangle({
      x: margin,
      y: y - alertH,
      width: contentWidth,
      height: alertH,
      color: cMagentaBg,
      borderColor: cMagentaBorder,
      borderWidth: 0.5,
    });

    currentPage.drawText("PARTIAL COVERAGE NOTICE", {
      x: margin + 10,
      y: y - 13,
      size: 6.5,
      font: helveticaBold,
      color: cMagenta,
    });

    const noticeText = cleanText(
      `${data.submittedStoresCount} of ${data.totalStores} stores submitted for ${data.reportingWeek}. Missing store inventory is not assumed to be zero. Metrics reflect submitted stores only.`
    );
    currentPage.drawText(noticeText, {
      x: margin + 118,
      y: y - 13,
      size: 6.3,
      font: helvetica,
      color: cDark,
    });

    y -= alertH + 8;
  }

  // ===========================================================================
  // 5. FOUR KPI SUMMARY CARDS (With Magenta Reorder Card)
  // ===========================================================================
  const kpiCardWidth = (contentWidth - 24) / 4; // 129 pt each
  const kpiCardHeight = 48;

  // 1. Est. Retail Sales
  const kpi1X = margin;
  currentPage.drawRectangle({
    x: kpi1X,
    y: y - kpiCardHeight,
    width: kpiCardWidth,
    height: kpiCardHeight,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 0.5,
  });
  currentPage.drawLine({
    start: { x: kpi1X, y: y },
    end: { x: kpi1X + kpiCardWidth, y: y },
    thickness: 1.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  currentPage.drawText("EST. RETAIL SALES", { x: kpi1X + 8, y: y - 11, size: 6.0, font: helveticaBold, color: cMuted });
  const salesVal = data.summary.totalEstimatedRetailSales !== null ? formatCurrency(data.summary.totalEstimatedRetailSales) : "-";
  currentPage.drawText(salesVal, { x: kpi1X + 8, y: y - 28, size: 14, font: helveticaBold, color: cDark });
  currentPage.drawText("Baseline Established", { x: kpi1X + 8, y: y - 41, size: 5.8, font: helvetica, color: cMuted });

  // 2. Est. Gross Profit
  const kpi2X = kpi1X + kpiCardWidth + 8;
  currentPage.drawRectangle({
    x: kpi2X,
    y: y - kpiCardHeight,
    width: kpiCardWidth,
    height: kpiCardHeight,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 0.5,
  });
  currentPage.drawLine({
    start: { x: kpi2X, y: y },
    end: { x: kpi2X + kpiCardWidth, y: y },
    thickness: 1.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  currentPage.drawText("EST. GROSS PROFIT", { x: kpi2X + 8, y: y - 11, size: 6.0, font: helveticaBold, color: cMuted });
  const profitVal = data.isFinancialsHidden
    ? "Restricted"
    : data.summary.totalEstimatedGrossProfit !== null
    ? formatCurrency(data.summary.totalEstimatedGrossProfit)
    : "-";
  currentPage.drawText(profitVal, { x: kpi2X + 8, y: y - 28, size: 14, font: helveticaBold, color: cDark });
  currentPage.drawText("Baseline Established", { x: kpi2X + 8, y: y - 41, size: 5.8, font: helvetica, color: cMuted });

  // 3. Est. Units Sold
  const kpi3X = kpi2X + kpiCardWidth + 8;
  currentPage.drawRectangle({
    x: kpi3X,
    y: y - kpiCardHeight,
    width: kpiCardWidth,
    height: kpiCardHeight,
    color: cWhite,
    borderColor: cBorder,
    borderWidth: 0.5,
  });
  currentPage.drawLine({
    start: { x: kpi3X, y: y },
    end: { x: kpi3X + kpiCardWidth, y: y },
    thickness: 1.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  currentPage.drawText("EST. UNITS SOLD", { x: kpi3X + 8, y: y - 11, size: 6.0, font: helveticaBold, color: cMuted });
  const soldVal = data.summary.totalEstimatedUnitsSold !== null ? formatQty(data.summary.totalEstimatedUnitsSold) : "-";
  currentPage.drawText(soldVal, { x: kpi3X + 8, y: y - 28, size: 14, font: helveticaBold, color: cDark });
  currentPage.drawText("Baseline Counted", { x: kpi3X + 8, y: y - 41, size: 5.8, font: helvetica, color: cMuted });

  // 4. Reorder Needed (Signature Highlight Card)
  const kpi4X = kpi3X + kpiCardWidth + 8;
  currentPage.drawRectangle({
    x: kpi4X,
    y: y - kpiCardHeight,
    width: kpiCardWidth,
    height: kpiCardHeight,
    color: cMagentaBg,
    borderColor: cMagentaBorder,
    borderWidth: 0.5,
  });
  currentPage.drawLine({
    start: { x: kpi4X, y: y },
    end: { x: kpi4X + kpiCardWidth, y: y },
    thickness: 2.0,
    color: cMagenta,
  });
  currentPage.drawText("REORDER NEEDED", { x: kpi4X + 8, y: y - 11, size: 6.0, font: helveticaBold, color: cMagenta });
  const reorderVal = `${data.summary.productsNeedingReorderCount} Items / ${formatQty(data.summary.totalSuggestedReorderUnits)} Units`;
  currentPage.drawText(reorderVal, { x: kpi4X + 8, y: y - 27, size: 11.0, font: helveticaBold, color: cDark });
  currentPage.drawText("Stock-Based MOQ Reorder", { x: kpi4X + 8, y: y - 41, size: 5.8, font: helvetica, color: cMuted });

  y -= kpiCardHeight + 11;

  // ===========================================================================
  // 6. STORE SUBMISSION COVERAGE TABLE (Company View with Multi-stores)
  // ===========================================================================
  if (data.selectedStoreId === "all" && data.storeStatuses.length > 1) {
    currentPage.drawText("STORE SUBMISSION COVERAGE", {
      x: margin,
      y: y,
      size: 7.2,
      font: helveticaBold,
      color: cDark,
    });
    y -= 10;

    // Header row
    const covHeaderH = 14;
    currentPage.drawRectangle({
      x: margin,
      y: y - covHeaderH,
      width: contentWidth,
      height: covHeaderH,
      color: cLightGray,
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    const covCols = { store: 130, status: 90, counted: 100, remaining: 100, submitted: 120 };
    let cx = margin + 6;
    currentPage.drawText("STORE NAME", { x: cx, y: y - 10, size: 5.8, font: helveticaBold, color: cMuted });
    cx += covCols.store;
    currentPage.drawText("STATUS", { x: cx, y: y - 10, size: 5.8, font: helveticaBold, color: cMuted });
    cx += covCols.status;
    currentPage.drawText("PRODUCTS COUNTED", { x: cx + 10, y: y - 10, size: 5.8, font: helveticaBold, color: cMuted });
    cx += covCols.counted;
    currentPage.drawText("REMAINING UNITS", { x: cx + 10, y: y - 10, size: 5.8, font: helveticaBold, color: cMuted });
    cx += covCols.remaining;
    currentPage.drawText("SUBMITTED", { x: cx + 20, y: y - 10, size: 5.8, font: helveticaBold, color: cMuted });

    y -= covHeaderH;

    // Store rows
    const covRowH = 16;
    for (const store of data.storeStatuses) {
      currentPage.drawRectangle({
        x: margin,
        y: y - covRowH,
        width: contentWidth,
        height: covRowH,
        color: cWhite,
        borderColor: cBorder,
        borderWidth: 0.5,
      });

      let rx = margin + 6;
      // Store name
      currentPage.drawText(cleanText(store.storeName), { x: rx, y: y - 11, size: 7.0, font: helveticaBold, color: cDark });
      rx += covCols.store;

      // Status with square icon
      if (store.status === "submitted") {
        currentPage.drawRectangle({ x: rx, y: y - 9.5, width: 3.5, height: 3.5, color: rgb(0.2, 0.25, 0.3) });
        currentPage.drawText("Submitted", { x: rx + 7, y: y - 11, size: 6.8, font: helveticaBold, color: cDark });
      } else if (store.status === "in_progress") {
        currentPage.drawRectangle({ x: rx, y: y - 9.5, width: 3.5, height: 3.5, color: cAmber });
        currentPage.drawText("In Progress", { x: rx + 7, y: y - 11, size: 6.8, font: helveticaBold, color: cAmber });
      } else {
        // Open square for Not Started
        currentPage.drawRectangle({ x: rx, y: y - 9.5, width: 3.5, height: 3.5, borderColor: cMagenta, borderWidth: 0.75, color: cWhite });
        currentPage.drawText("Not Started", { x: rx + 7, y: y - 11, size: 6.8, font: helveticaBold, color: cMagenta });
      }
      rx += covCols.status;

      // Counted products
      const countedStr = store.status === "submitted" ? `${store.countedProducts} of ${store.totalProducts}` : "-";
      currentPage.drawText(countedStr, { x: rx + 30, y: y - 11, size: 6.8, font: helvetica, color: cDark });
      rx += covCols.counted;

      // Remaining units
      const remStr = store.status === "submitted" ? `${formatQty(store.remainingUnits)} units` : "-";
      currentPage.drawText(remStr, { x: rx + 25, y: y - 11, size: 6.8, font: helveticaBold, color: cDark });
      rx += covCols.remaining;

      // Submitted timestamp formatted in ET
      const subTimeStr = formatStoreSubmittedTimestamp(store.submittedAt);
      currentPage.drawText(cleanText(subTimeStr), { x: rx + 15, y: y - 11, size: 6.8, font: helvetica, color: cMuted });

      y -= covRowH;
    }

    y -= 10;
  }

  // ===========================================================================
  // 7. PRODUCT PERFORMANCE TABLE & DYNAMIC PAGINATION ENGINE
  // ===========================================================================
  // Draw table header helper
  function drawProductTableHeader(isContinuation: boolean = false, startRowIdx: number = 1, totalRowsCount: number = data.items.length) {
    if (!isContinuation) {
      // Primary Title on Page 1
      currentPage.drawText("PRODUCT PERFORMANCE & REPLENISHMENT", {
        x: margin,
        y: y,
        size: 7.5,
        font: helveticaBold,
        color: cDark,
      });

      // Right-aligned legend
      const legendSquareX = margin + contentWidth - 235;
      currentPage.drawRectangle({
        x: legendSquareX,
        y: y + 1.5,
        width: 3.5,
        height: 3.5,
        color: cMagenta,
      });
      currentPage.drawText("Reorder recommended", {
        x: legendSquareX + 6,
        y: y,
        size: 5.6,
        font: helvetica,
        color: cMuted,
      });

      currentPage.drawText("- Not available (not zero)   u = units * cs = case", {
        x: legendSquareX + 80,
        y: y,
        size: 5.6,
        font: helvetica,
        color: cMuted,
      });

      y -= 9;

      currentPage.drawText("Authoritative stock observations, weekly sales movement, and suggested replenishment.", {
        x: margin,
        y: y,
        size: 6.0,
        font: helveticaOblique,
        color: cMuted,
      });

      y -= 13;
    } else {
      // Continuation Title on Page 2+
      currentPage.drawText("PRODUCT PERFORMANCE & REPLENISHMENT (CONTINUED)", {
        x: margin,
        y: y,
        size: 7.5,
        font: helveticaBold,
        color: cDark,
      });

      const rowSpanText = `Rows ${startRowIdx}-${totalRowsCount} of ${totalRowsCount}`;
      const rowSpanWidth = helvetica.widthOfTextAtSize(rowSpanText, 6.5);
      currentPage.drawText(rowSpanText, {
        x: margin + contentWidth - rowSpanWidth,
        y: y,
        size: 6.5,
        font: helvetica,
        color: cMuted,
      });

      y -= 12;
    }

    // Column Headers Box
    const thHeight = 16;
    currentPage.drawRectangle({
      x: margin,
      y: y - thHeight,
      width: contentWidth,
      height: thHeight,
      color: cLightGray,
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    let tx = margin + 6;
    currentPage.drawText("PRODUCT / SKU / BRAND", { x: tx, y: y - 11, size: 5.8, font: helveticaBold, color: cMuted });
    tx += colWidths.product;

    currentPage.drawText("REMAINING", { x: tx + 2, y: y - 11, size: 5.8, font: helveticaBold, color: cMuted });
    tx += colWidths.remaining;

    currentPage.drawText("INCOMING", { x: tx + 4, y: y - 11, size: 5.8, font: helveticaBold, color: cMuted });
    tx += colWidths.incoming;

    currentPage.drawText("EST. SOLD", { x: tx + 4, y: y - 11, size: 5.8, font: helveticaBold, color: cMuted });
    tx += colWidths.sold;

    currentPage.drawText("EST. SALES", { x: tx + 6, y: y - 11, size: 5.8, font: helveticaBold, color: cMuted });
    tx += colWidths.sales;

    currentPage.drawText("EST. PROFIT", { x: tx + 6, y: y - 11, size: 5.8, font: helveticaBold, color: cMuted });
    tx += colWidths.profit;

    currentPage.drawText("SUGGESTED REORDER", { x: tx + 10, y: y - 11, size: 5.8, font: helveticaBold, color: cMagenta });

    y -= thHeight;
  }

  // Draw compact continuation black header on Page 2+
  function drawContinuationBlackHeader() {
    const compactHeaderH = 24;
    const cHeadY = pageHeight - 26 - compactHeaderH;

    currentPage.drawRectangle({
      x: margin,
      y: cHeadY,
      width: contentWidth,
      height: compactHeaderH,
      color: cBlack,
    });

    // Small Logo & Brand text
    drawLogoIcon(currentPage, margin + 8, cHeadY + 4, 16);
    currentPage.drawText("K SELECT HUB", {
      x: margin + 28,
      y: cHeadY + 8,
      size: 8.5,
      font: helveticaBold,
      color: cWhite,
    });

    // Right: Company name & week
    const rightSubText = cleanText(`${data.companyName.toUpperCase()} * ${data.reportingWeek}`);
    const rightSubWidth = helveticaBold.widthOfTextAtSize(rightSubText, 6.8);
    currentPage.drawText(rightSubText, {
      x: margin + contentWidth - 10 - rightSubWidth,
      y: cHeadY + 8.5,
      size: 6.8,
      font: helveticaBold,
      color: cWhite,
    });

    y = cHeadY - 14;
  }

  // Initial table header on Page 1
  drawProductTableHeader(false, 1, data.items.length);

  // Render Product Rows
  const totalItems = data.items.length;
  for (let idx = 0; idx < totalItems; idx++) {
    const item = data.items[idx];

    // Word wrap product name
    const displayName = item.productNameEn || item.productName || item.sku;
    const nameLines = wrapText(displayName, colWidths.product - 10, helveticaBold, 7.2);
    const rowHeight = nameLines.length > 1 ? 27 : 21;

    // Check pagination: Does this row fit?
    if (y - rowHeight < bottomThreshold) {
      // Draw continuation indicator on current page before breaking
      currentPage.drawText("Continued on next page ->", {
        x: margin + contentWidth - 105,
        y: y - 9,
        size: 6.5,
        font: helveticaOblique,
        color: cMuted,
      });

      // Advance to new page
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      drawContinuationBlackHeader();
      drawProductTableHeader(true, idx + 1, totalItems);
    }

    // Row Background
    currentPage.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: item.reorderNeeded ? cMagentaBg : cWhite,
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    // Left Magenta Accent Bar on Reorder rows
    if (item.reorderNeeded) {
      currentPage.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: 2.5,
        height: rowHeight,
        color: cMagenta,
      });
    }

    let colX = margin + 6;

    // 1. Product Name & Brand / SKU
    if (nameLines.length > 1) {
      currentPage.drawText(nameLines[0], {
        x: colX,
        y: y - 8.5,
        size: 7.2,
        font: helveticaBold,
        color: cDark,
      });
      currentPage.drawText(nameLines[1], {
        x: colX,
        y: y - 16.5,
        size: 7.0,
        font: helveticaBold,
        color: cDark,
      });
      const brandSkuText = cleanText(`${item.brandName} * SKU: ${item.sku}`);
      currentPage.drawText(brandSkuText, {
        x: colX,
        y: y - 24,
        size: 5.6,
        font: helvetica,
        color: cMuted,
      });
    } else {
      currentPage.drawText(nameLines[0], {
        x: colX,
        y: y - 9.5,
        size: 7.2,
        font: helveticaBold,
        color: cDark,
      });
      const brandSkuText = cleanText(`${item.brandName} * SKU: ${item.sku}`);
      currentPage.drawText(brandSkuText, {
        x: colX,
        y: y - 17.5,
        size: 5.6,
        font: helvetica,
        color: cMuted,
      });
    }
    colX += colWidths.product;

    const midY = rowHeight > 22 ? y - 13.5 : y - 12.5;

    // 2. Remaining Units
    if (item.reportedRemaining !== null) {
      const remColor = item.reportedRemaining === 0 ? cMagenta : cDark;
      const remStr = `${formatQty(item.reportedRemaining)}`;
      currentPage.drawText(remStr, {
        x: colX + 16,
        y: midY,
        size: 7.2,
        font: helveticaBold,
        color: remColor,
      });
    } else {
      currentPage.drawText("Not Reported", {
        x: colX + 4,
        y: midY,
        size: 6.0,
        font: helvetica,
        color: cMuted,
      });
    }
    colX += colWidths.remaining;

    // 3. Incoming Units
    const incText = item.incomingQty > 0 ? `+${formatQty(item.incomingQty)}` : "-";
    currentPage.drawText(incText, {
      x: colX + 12,
      y: midY,
      size: 7.0,
      font: item.incomingQty > 0 ? helveticaBold : helvetica,
      color: item.incomingQty > 0 ? cDark : cMuted,
    });
    colX += colWidths.incoming;

    // 4. Est. Units Sold
    const soldText = item.estimatedUnitsSold !== null
      ? `${formatQty(item.estimatedUnitsSold)}`
      : item.reportedRemaining !== null
      ? "Baseline"
      : "-";
    currentPage.drawText(soldText, {
      x: colX + 12,
      y: midY,
      size: 6.8,
      font: item.estimatedUnitsSold !== null ? helveticaBold : helvetica,
      color: item.estimatedUnitsSold !== null ? cDark : cMuted,
    });
    colX += colWidths.sold;

    // 5. Est. Retail Sales
    const salesText = item.estimatedRetailSales !== null ? formatCurrency(item.estimatedRetailSales) : "-";
    currentPage.drawText(salesText, {
      x: colX + 10,
      y: midY,
      size: 6.8,
      font: helvetica,
      color: item.estimatedRetailSales !== null ? cDark : cMuted,
    });
    colX += colWidths.sales;

    // 6. Est. Gross Profit
    const profitText = data.isFinancialsHidden
      ? "Restricted"
      : item.estimatedGrossProfit !== null
      ? formatCurrency(item.estimatedGrossProfit)
      : "-";
    currentPage.drawText(profitText, {
      x: colX + 10,
      y: midY,
      size: 6.8,
      font: helvetica,
      color: data.isFinancialsHidden ? cMuted : (item.estimatedGrossProfit !== null ? cDark : cMuted),
    });
    colX += colWidths.profit;

    // 7. Suggested Reorder
    if (item.reorderNeeded && item.suggestedReorderQty > 0) {
      const reorderStr = `${formatQty(item.suggestedReorderQty)} u (${item.suggestedCases}cs)`;
      currentPage.drawText(reorderStr, {
        x: colX + 10,
        y: midY,
        size: 7.2,
        font: helveticaBold,
        color: cMagenta,
      });
    } else if (item.reportedRemaining === null) {
      currentPage.drawText("Needs Check", {
        x: colX + 12,
        y: midY,
        size: 6.8,
        font: helveticaBold,
        color: cMagenta,
      });
    } else {
      currentPage.drawText("-", {
        x: colX + 35,
        y: midY,
        size: 7.0,
        font: helvetica,
        color: cMuted,
      });
    }

    y -= rowHeight;
  }

  y -= 14;

  // ===========================================================================
  // 8. REPORTING METHODOLOGY & AUDIT NOTICE (Two-column arrangement)
  // ===========================================================================
  const methodHeight = 62;
  // If methodology does not fit on the current page, break cleanly to next page
  if (y - methodHeight < bottomThreshold) {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(currentPage);
    drawContinuationBlackHeader();
  }

  currentPage.drawText("REPORTING METHODOLOGY & AUDIT NOTICE", {
    x: margin,
    y: y,
    size: 7.2,
    font: helveticaBold,
    color: cDark,
  });

  y -= 7;
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 0.5,
    color: cBorder,
  });

  y -= 9;

  // Two columns: Left (items 1 & 3), Right (items 2 & 4)
  const colW = (contentWidth - 28) / 2; // 256 pt each
  const mCol1X = margin;
  const mCol2X = margin + colW + 28;

  // Note 1
  currentPage.drawText("1. Weekly inventory figures", { x: mCol1X, y: y, size: 6.0, font: helveticaBold, color: cDark });
  currentPage.drawText("reflect verified physical counts submitted by retail store staff and", { x: mCol1X + 80, y: y, size: 6.0, font: helvetica, color: cMuted });
  currentPage.drawText("confirmed delivered orders.", { x: mCol1X, y: y - 8, size: 6.0, font: helvetica, color: cMuted });

  // Note 2
  currentPage.drawText("2. Estimated Sales & Gross Profit", { x: mCol2X, y: y, size: 6.0, font: helveticaBold, color: cDark });
  currentPage.drawText("are calculated from stock deltas and current store SRP.", { x: mCol2X + 96, y: y, size: 6.0, font: helvetica, color: cMuted });
  currentPage.drawText("They do not replace live POS register totals.", { x: mCol2X, y: y - 8, size: 6.0, font: helvetica, color: cMuted });

  // Note 3
  currentPage.drawText("3. Baseline Weeks:", { x: mCol1X, y: y - 22, size: 6.0, font: helveticaBold, color: cDark });
  currentPage.drawText("The initial weekly count establishes an opening inventory baseline.", { x: mCol1X + 54, y: y - 22, size: 6.0, font: helvetica, color: cMuted });
  currentPage.drawText("Weekly sales estimates activate after consecutive audits.", { x: mCol1X, y: y - 30, size: 6.0, font: helvetica, color: cMuted });

  // Note 4
  currentPage.drawText("4. Replenishment recommendations", { x: mCol2X, y: y - 22, size: 6.0, font: helveticaBold, color: cDark });
  currentPage.drawText("respect product MOQ and case multiples.", { x: mCol2X + 104, y: y - 22, size: 6.0, font: helvetica, color: cMuted });
  currentPage.drawText("Baseline recommendations are stock-based to prevent retail stockouts.", { x: mCol2X, y: y - 30, size: 6.0, font: helvetica, color: cMuted });

  // ===========================================================================
  // 9. DOCUMENT RUNNING FOOTER (Applied across all generated pages)
  // ===========================================================================
  const totalPages = pages.length;
  pages.forEach((page, pageIdx) => {
    const pageNum = pageIdx + 1;
    const footerLineY = 22;
    const footerTextY = 12;

    // Hairline divider
    page.drawLine({
      start: { x: margin, y: footerLineY },
      end: { x: margin + contentWidth, y: footerLineY },
      thickness: 0.5,
      color: cBorder,
    });

    // Left: K SELECT HUB & Confidentiality
    page.drawText("K SELECT HUB", {
      x: margin,
      y: footerTextY,
      size: 6.2,
      font: helveticaBold,
      color: cDark,
    });
    page.drawText("  Confidential - For Authorized Retail Partner Use Only", {
      x: margin + 46,
      y: footerTextY,
      size: 5.8,
      font: helvetica,
      color: cMuted,
    });

    // Center: Report Generated Timestamp
    const centerFootText = cleanText(`Report Generated: ${generatedTimestampET}`);
    const centerFootWidth = helvetica.widthOfTextAtSize(centerFootText, 5.8);
    page.drawText(centerFootText, {
      x: (pageWidth - centerFootWidth) / 2,
      y: footerTextY,
      size: 5.8,
      font: helvetica,
      color: cMuted,
    });

    // Right: Page X of Y
    const pageStr = `Page ${pageNum} of ${totalPages}`;
    const pageStrWidth = helveticaBold.widthOfTextAtSize(pageStr, 6.5);
    page.drawText(pageStr, {
      x: margin + contentWidth - pageStrWidth,
      y: footerTextY,
      size: 6.5,
      font: helveticaBold,
      color: cDark,
    });
  });

  return await pdfDoc.save();
}
