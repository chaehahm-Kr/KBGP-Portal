import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { WeeklyReportData, WeeklyReportItem, WeeklyReportStoreStatus } from "./weekly-report-types";

/**
 * Text sanitization for pdf-lib WinAnsi standard font encoding.
 * Translates em-dashes, en-dashes, typographic quotes, and non-Latin1 characters
 * so PDF generation never crashes on unexpected strings.
 */
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/[\u2014\u2015]/g, "-") // em dash
    .replace(/[\u2013]/g, "-") // en dash
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
 * Main Authoritative Weekly Performance & Reorder Report PDF Generator
 * Pure server-side generator using pdf-lib with standard typography,
 * multi-page repeating headers, store coverage breakdown, and baseline fidelity.
 */
export async function generateWeeklyReportPdf(data: WeeklyReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Embed standard typography
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // US Letter Portrait (612 x 792 pt)
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // 532 pt
  const bottomThreshold = margin + 35; // Leave space for running footer

  // Colors
  const cNavy = rgb(0.08, 0.16, 0.36); // #14295c
  const cDark = rgb(0.12, 0.14, 0.18); // #1f242e
  const cMuted = rgb(0.45, 0.49, 0.55); // #737d8c
  const cBorder = rgb(0.85, 0.88, 0.92); // #d9e0eb
  const cBgLight = rgb(0.97, 0.98, 0.99); // #f7f9fc
  const cGreen = rgb(0.06, 0.52, 0.28); // #108547
  const cGreenBg = rgb(0.92, 0.98, 0.94);
  const cAmber = rgb(0.78, 0.42, 0.05); // #c76b0d
  const cAmberBg = rgb(1.0, 0.96, 0.90);
  const cAmberBorder = rgb(0.95, 0.75, 0.4);
  const cWhite = rgb(1.0, 1.0, 1.0);

  // Document state
  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);
  let y = pageHeight - margin;

  // Formatted generation timestamp
  const now = new Date();
  const generatedTimestamp = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // Helper: check page break
  function checkPageBreak(requiredHeight: number, onNewPageHeader?: () => void) {
    if (y - requiredHeight < bottomThreshold) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      y = pageHeight - margin;
      drawRunningHeader();
      if (onNewPageHeader) {
        onNewPageHeader();
      }
    }
  }

  // Running Header on page 2+
  function drawRunningHeader() {
    currentPage.drawText("K SELECT HUB  |  Weekly Performance & Reorder Report", {
      x: margin,
      y: pageHeight - 25,
      size: 7.5,
      font: helveticaBold,
      color: cNavy,
    });

    const subContext = cleanText(`${data.reportingWeek}  |  ${data.selectedStoreName}`);
    const subWidth = helvetica.widthOfTextAtSize(subContext, 7.5);
    currentPage.drawText(subContext, {
      x: pageWidth - margin - subWidth,
      y: pageHeight - 25,
      size: 7.5,
      font: helvetica,
      color: cMuted,
    });

    currentPage.drawLine({
      start: { x: margin, y: pageHeight - 30 },
      end: { x: pageWidth - margin, y: pageHeight - 30 },
      thickness: 0.5,
      color: cBorder,
    });

    y = pageHeight - 45;
  }

  // ===========================================================================
  // 1. PAGE 1 HEADER
  // ===========================================================================
  // Top Title Bar
  currentPage.drawText("K SELECT HUB", {
    x: margin,
    y: y,
    size: 15,
    font: helveticaBold,
    color: cNavy,
  });

  currentPage.drawText("WEEKLY PERFORMANCE & REORDER REPORT", {
    x: margin,
    y: y - 14,
    size: 9.5,
    font: helveticaBold,
    color: cDark,
  });

  // Coverage Status Badge on Top Right
  const badgeWidth = 145;
  const badgeHeight = 22;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = y - 12;

  let badgeBg = cGreenBg;
  let badgeColor = cGreen;
  let badgeBorderColor = cGreen;
  let badgeLabel = "COMPLETE COVERAGE";

  if (data.coverageStatus === "partial") {
    badgeBg = cAmberBg;
    badgeColor = cAmber;
    badgeBorderColor = cAmberBorder;
    badgeLabel = "PARTIAL COVERAGE";
  } else if (data.coverageStatus === "none" || data.summary.hasBaselineOnlyOverall) {
    badgeBg = cBgLight;
    badgeColor = cNavy;
    badgeBorderColor = cBorder;
    badgeLabel = data.summary.hasBaselineOnlyOverall ? "BASELINE ESTABLISHED" : "NO CHECKS SUBMITTED";
  }

  currentPage.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: badgeBg,
    borderColor: badgeBorderColor,
    borderWidth: 0.75,
  });

  const badgeTextWidth = helveticaBold.widthOfTextAtSize(badgeLabel, 7.5);
  currentPage.drawText(badgeLabel, {
    x: badgeX + (badgeWidth - badgeTextWidth) / 2,
    y: badgeY + 7,
    size: 7.5,
    font: helveticaBold,
    color: badgeColor,
  });

  y -= 32;

  // ===========================================================================
  // 2. METADATA SUMMARY BOX
  // ===========================================================================
  const metaBoxHeight = 58;
  currentPage.drawRectangle({
    x: margin,
    y: y - metaBoxHeight,
    width: contentWidth,
    height: metaBoxHeight,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 0.75,
  });

  // Left column metadata
  const metaCol1X = margin + 12;
  const metaCol2X = margin + 265;
  let metaRowY = y - 15;

  // Row 1: Company & Generated
  currentPage.drawText("Retailer Company:", { x: metaCol1X, y: metaRowY, size: 7.5, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(data.companyName), { x: metaCol1X + 80, y: metaRowY, size: 8, font: helveticaBold, color: cDark });

  currentPage.drawText("Generated At:", { x: metaCol2X, y: metaRowY, size: 7.5, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(generatedTimestamp), { x: metaCol2X + 65, y: metaRowY, size: 7.5, font: helvetica, color: cDark });

  metaRowY -= 14;

  // Row 2: Store Scope & Submissions
  currentPage.drawText("Store Scope:", { x: metaCol1X, y: metaRowY, size: 7.5, font: helveticaBold, color: cMuted });
  currentPage.drawText(cleanText(data.selectedStoreName), { x: metaCol1X + 80, y: metaRowY, size: 8, font: helvetica, color: cDark });

  currentPage.drawText("Store Coverage:", { x: metaCol2X, y: metaRowY, size: 7.5, font: helveticaBold, color: cMuted });
  const coverageDesc = `${data.submittedStoresCount} of ${data.totalStores} stores submitted (${Math.round((data.submittedStoresCount / Math.max(1, data.totalStores)) * 100)}%)`;
  currentPage.drawText(cleanText(coverageDesc), { x: metaCol2X + 65, y: metaRowY, size: 7.5, font: helveticaBold, color: data.coverageStatus === "partial" ? cAmber : cDark });

  metaRowY -= 14;

  // Row 3: Reporting Week & Price Basis Notice
  currentPage.drawText("Reporting Week:", { x: metaCol1X, y: metaRowY, size: 7.5, font: helveticaBold, color: cMuted });
  const weekText = `${data.reportingWeek}  (${data.formattedWeekLabel})`;
  currentPage.drawText(cleanText(weekText), { x: metaCol1X + 80, y: metaRowY, size: 8, font: helvetica, color: cDark });

  currentPage.drawText("Price Basis:", { x: metaCol2X, y: metaRowY, size: 7.5, font: helveticaBold, color: cMuted });
  currentPage.drawText("Physical shelf audit delta & store SRP", { x: metaCol2X + 65, y: metaRowY, size: 7.5, font: helveticaOblique, color: cMuted });

  y -= metaBoxHeight + 10;

  // ===========================================================================
  // 3. PARTIAL COVERAGE ALERT BANNER (If Partial)
  // ===========================================================================
  if (data.coverageStatus === "partial") {
    const alertHeight = 32;
    currentPage.drawRectangle({
      x: margin,
      y: y - alertHeight,
      width: contentWidth,
      height: alertHeight,
      color: cAmberBg,
      borderColor: cAmberBorder,
      borderWidth: 0.75,
    });

    currentPage.drawText("PARTIAL COVERAGE NOTICE", {
      x: margin + 10,
      y: y - 11,
      size: 7.5,
      font: helveticaBold,
      color: cAmber,
    });

    const alertMsg = `${data.submittedStoresCount} of ${data.totalStores} stores submitted for ${data.reportingWeek}. Missing store inventory is not assumed to be zero. Metrics reflect submitted stores only.`;
    currentPage.drawText(cleanText(alertMsg), {
      x: margin + 10,
      y: y - 23,
      size: 7.2,
      font: helvetica,
      color: cDark,
    });

    y -= alertHeight + 10;
  }

  // ===========================================================================
  // 4. FOUR MAIN KPI SUMMARY CARDS
  // ===========================================================================
  const cardGap = 8;
  const cardWidth = (contentWidth - 3 * cardGap) / 4; // ~127 pt
  const cardHeight = 54;

  const kpis = [
    {
      title: "EST. RETAIL SALES",
      value: data.isFinancialsHidden
        ? "Restricted"
        : data.summary.totalEstimatedRetailSales !== null
        ? formatCurrency(data.summary.totalEstimatedRetailSales)
        : "-",
      subValue: data.isFinancialsHidden
        ? "Staff Role"
        : data.summary.totalEstimatedRetailSales !== null
        ? "Store SRP x verified delta"
        : "Baseline Established",
      accentColor: cNavy,
      isBaseline: !data.isFinancialsHidden && data.summary.totalEstimatedRetailSales === null,
    },
    {
      title: "EST. GROSS PROFIT",
      value: data.isFinancialsHidden
        ? "Restricted"
        : data.summary.totalEstimatedGrossProfit !== null
        ? formatCurrency(data.summary.totalEstimatedGrossProfit)
        : "-",
      subValue: data.isFinancialsHidden
        ? "Staff Role"
        : data.summary.averageGrossMargin !== null
        ? `${data.summary.averageGrossMargin}% Margin (Merchandise)`
        : data.summary.totalEstimatedGrossProfit !== null
        ? "Merchandise Gross Profit"
        : "Baseline Established",
      accentColor: cGreen,
      isBaseline: !data.isFinancialsHidden && data.summary.totalEstimatedGrossProfit === null,
    },
    {
      title: "EST. UNITS SOLD",
      value: data.summary.totalEstimatedUnitsSold !== null
        ? `${formatQty(data.summary.totalEstimatedUnitsSold)} units`
        : "-",
      subValue: data.summary.totalEstimatedUnitsSold !== null
        ? "Shelf delta + receipts"
        : "Baseline Counted",
      accentColor: rgb(0.35, 0.25, 0.65),
      isBaseline: data.summary.totalEstimatedUnitsSold === null,
    },
    {
      title: "REORDER NEEDED",
      value: data.summary.productsNeedingReorderCount > 0
        ? `${data.summary.productsNeedingReorderCount} Items / ${data.summary.totalSuggestedReorderUnits} Units`
        : "None Required",
      subValue: data.summary.hasBaselineOnlyOverall
        ? "Stock-Based MOQ Reorder"
        : "Velocity & Stock Reorder",
      accentColor: cAmber,
      isBaseline: false,
    },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const kpi = kpis[i];
    const cardX = margin + i * (cardWidth + cardGap);
    const cardY = y - cardHeight;

    // Card background & border
    currentPage.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: cWhite,
      borderColor: cBorder,
      borderWidth: 0.75,
    });

    // Top accent border
    currentPage.drawRectangle({
      x: cardX,
      y: cardY + cardHeight - 2.5,
      width: cardWidth,
      height: 2.5,
      color: kpi.accentColor,
    });

    // Title
    currentPage.drawText(kpi.title, {
      x: cardX + 7,
      y: cardY + cardHeight - 12,
      size: 6.8,
      font: helveticaBold,
      color: cMuted,
    });

    // Main Value
    const valText = cleanText(kpi.value);
    const valFontSize = valText.length > 18 ? 8.5 : valText.length > 13 ? 9.5 : 11;
    currentPage.drawText(valText, {
      x: cardX + 7,
      y: cardY + cardHeight - 27,
      size: valFontSize,
      font: helveticaBold,
      color: kpi.isBaseline ? cMuted : cDark,
    });

    // Subtitle / context
    const subText = cleanText(kpi.subValue);
    currentPage.drawText(subText, {
      x: cardX + 7,
      y: cardY + 7,
      size: 6.2,
      font: kpi.isBaseline ? helveticaBold : helvetica,
      color: kpi.isBaseline ? cAmber : cMuted,
    });
  }

  y -= cardHeight + 14;

  // ===========================================================================
  // 5. STORE COVERAGE TABLE (If Company Overview or Multiple Stores)
  // ===========================================================================
  if (data.selectedStoreId === "all" || data.storeStatuses.length > 1) {
    checkPageBreak(85);

    currentPage.drawText("STORE SUBMISSION COVERAGE", {
      x: margin,
      y: y,
      size: 8.5,
      font: helveticaBold,
      color: cNavy,
    });
    y -= 12;

    const covTableWidth = contentWidth;
    const covColWidths = {
      store: 170,
      status: 80,
      counted: 80,
      remaining: 85,
      submittedAt: 117,
    };

    // Header row
    const covHeaderHeight = 16;
    currentPage.drawRectangle({
      x: margin,
      y: y - covHeaderHeight,
      width: covTableWidth,
      height: covHeaderHeight,
      color: rgb(0.93, 0.95, 0.97),
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    let hx = margin + 6;
    currentPage.drawText("Store Name", { x: hx, y: y - 11, size: 7, font: helveticaBold, color: cDark });
    hx += covColWidths.store;
    currentPage.drawText("Status", { x: hx, y: y - 11, size: 7, font: helveticaBold, color: cDark });
    hx += covColWidths.status;
    currentPage.drawText("Products Counted", { x: hx, y: y - 11, size: 7, font: helveticaBold, color: cDark });
    hx += covColWidths.counted;
    currentPage.drawText("Remaining Units", { x: hx, y: y - 11, size: 7, font: helveticaBold, color: cDark });
    hx += covColWidths.remaining;
    currentPage.drawText("Submitted Timestamp", { x: hx, y: y - 11, size: 7, font: helveticaBold, color: cDark });

    y -= covHeaderHeight;

    // Rows
    for (const store of data.storeStatuses) {
      checkPageBreak(18);
      const rowHeight = 16;
      currentPage.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: covTableWidth,
        height: rowHeight,
        color: cWhite,
        borderColor: cBorder,
        borderWidth: 0.5,
      });

      let rx = margin + 6;
      // Store name
      currentPage.drawText(cleanText(store.storeName), {
        x: rx,
        y: y - 11,
        size: 7.2,
        font: helveticaBold,
        color: cDark,
      });
      rx += covColWidths.store;

      // Status
      let statusLabel = "Not Started";
      let statusColor = cMuted;
      if (store.status === "submitted") {
        statusLabel = "Submitted";
        statusColor = cGreen;
      } else if (store.status === "in_progress") {
        statusLabel = "In Progress";
        statusColor = cAmber;
      }
      currentPage.drawText(statusLabel, {
        x: rx,
        y: y - 11,
        size: 7.2,
        font: helveticaBold,
        color: statusColor,
      });
      rx += covColWidths.status;

      // Counted products
      const countedText = store.status === "submitted"
        ? `${store.countedProducts} of ${store.totalProducts}`
        : "-";
      currentPage.drawText(countedText, {
        x: rx,
        y: y - 11,
        size: 7.2,
        font: helvetica,
        color: cDark,
      });
      rx += covColWidths.counted;

      // Remaining units
      const remainingText = store.status === "submitted"
        ? `${formatQty(store.remainingUnits)} units`
        : "-";
      currentPage.drawText(remainingText, {
        x: rx,
        y: y - 11,
        size: 7.2,
        font: helvetica,
        color: cDark,
      });
      rx += covColWidths.remaining;

      // Submitted At
      let submittedDateText = "-";
      if (store.submittedAt) {
        try {
          submittedDateText = new Date(store.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          submittedDateText = store.submittedAt;
        }
      }
      currentPage.drawText(cleanText(submittedDateText), {
        x: rx,
        y: y - 11,
        size: 7.2,
        font: helvetica,
        color: cMuted,
      });

      y -= rowHeight;
    }

    y -= 14;
  }

  // ===========================================================================
  // 6. PRODUCT PERFORMANCE & REPLENISHMENT TABLE
  // ===========================================================================
  checkPageBreak(120);

  currentPage.drawText("PRODUCT PERFORMANCE & REPLENISHMENT", {
    x: margin,
    y: y,
    size: 8.5,
    font: helveticaBold,
    color: cNavy,
  });

  currentPage.drawText("Authoritative stock observations, weekly sales movement, and suggested replenishment.", {
    x: margin,
    y: y - 10,
    size: 6.8,
    font: helvetica,
    color: cMuted,
  });

  y -= 18;

  // Table Column Widths (Sum = 532 pt)
  const colWidths = {
    product: 182,  // Product / Brand / SKU
    remaining: 48, // Remaining units
    incoming: 48,  // Incoming units
    sold: 48,      // Est. Units Sold
    sales: 66,     // Est. Sales
    profit: 66,    // Est. Profit
    reorder: 74,   // Suggested Reorder
  };

  function drawProductTableHeader() {
    const thHeight = 17;
    currentPage.drawRectangle({
      x: margin,
      y: y - thHeight,
      width: contentWidth,
      height: thHeight,
      color: rgb(0.93, 0.95, 0.97),
      borderColor: cBorder,
      borderWidth: 0.5,
    });

    let tx = margin + 6;
    currentPage.drawText("Product / SKU / Brand", { x: tx, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });
    tx += colWidths.product;

    // Remaining (Right-aligned column)
    currentPage.drawText("Remaining", { x: tx + 6, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });
    tx += colWidths.remaining;

    // Incoming
    currentPage.drawText("Incoming", { x: tx + 6, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });
    tx += colWidths.incoming;

    // Est. Sold
    currentPage.drawText("Est. Sold", { x: tx + 6, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });
    tx += colWidths.sold;

    // Est. Sales
    currentPage.drawText("Est. Sales", { x: tx + 14, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });
    tx += colWidths.sales;

    // Est. Profit
    currentPage.drawText("Est. Profit", { x: tx + 14, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });
    tx += colWidths.profit;

    // Suggested Reorder
    currentPage.drawText("Suggested Reorder", { x: tx + 4, y: y - 12, size: 6.8, font: helveticaBold, color: cDark });

    y -= thHeight;
  }

  // Draw initial table header
  drawProductTableHeader();

  // Draw Product Rows
  if (data.items.length === 0) {
    const emptyRowHeight = 28;
    currentPage.drawRectangle({
      x: margin,
      y: y - emptyRowHeight,
      width: contentWidth,
      height: emptyRowHeight,
      color: cWhite,
      borderColor: cBorder,
      borderWidth: 0.5,
    });
    currentPage.drawText("No product performance data available for this reporting period.", {
      x: margin + 140,
      y: y - 18,
      size: 7.5,
      font: helveticaOblique,
      color: cMuted,
    });
    y -= emptyRowHeight;
  } else {
    for (const item of data.items) {
      // Calculate row height: product name may wrap into 2 lines
      const displayName = item.productNameEn || item.productName || item.sku;
      const nameLines = wrapText(displayName, colWidths.product - 12, helveticaBold, 7.2);
      const rowHeight = nameLines.length > 1 ? 28 : 22;

      checkPageBreak(rowHeight + 10, drawProductTableHeader);

      // Row background
      currentPage.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: item.reorderNeeded ? rgb(0.99, 0.98, 0.95) : cWhite,
        borderColor: cBorder,
        borderWidth: 0.5,
      });

      let colX = margin + 6;

      // 1. Product Name & SKU / Brand
      if (nameLines.length > 1) {
        currentPage.drawText(nameLines[0], {
          x: colX,
          y: y - 9.5,
          size: 7.2,
          font: helveticaBold,
          color: cDark,
        });
        currentPage.drawText(nameLines[1], {
          x: colX,
          y: y - 17.5,
          size: 7.0,
          font: helveticaBold,
          color: cDark,
        });
        const subBrand = cleanText(`${item.brandName} | SKU: ${item.sku}`);
        currentPage.drawText(subBrand, {
          x: colX,
          y: y - 25,
          size: 5.8,
          font: helvetica,
          color: cMuted,
        });
      } else {
        currentPage.drawText(nameLines[0], {
          x: colX,
          y: y - 10,
          size: 7.2,
          font: helveticaBold,
          color: cDark,
        });
        const subBrand = cleanText(`${item.brandName} | SKU: ${item.sku}`);
        currentPage.drawText(subBrand, {
          x: colX,
          y: y - 18,
          size: 5.8,
          font: helvetica,
          color: cMuted,
        });
      }
      colX += colWidths.product;

      const textY = rowHeight > 22 ? y - 14 : y - 13;

      // 2. Remaining Units
      const remText = item.reportedRemaining !== null
        ? `${formatQty(item.reportedRemaining)}`
        : "Not Reported";
      const remSize = item.reportedRemaining !== null ? 7.2 : 6.0;
      currentPage.drawText(remText, {
        x: item.reportedRemaining !== null ? colX + 12 : colX + 4,
        y: textY,
        size: remSize,
        font: item.reportedRemaining !== null ? helveticaBold : helvetica,
        color: item.reportedRemaining === 0 ? cAmber : (item.reportedRemaining !== null ? cDark : cMuted),
      });
      colX += colWidths.remaining;

      // 3. Incoming Units
      const incText = item.incomingQty > 0 ? `+${formatQty(item.incomingQty)}` : "-";
      currentPage.drawText(incText, {
        x: colX + 12,
        y: textY,
        size: 7.2,
        font: helvetica,
        color: item.incomingQty > 0 ? cGreen : cMuted,
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
        y: textY,
        size: 7.2,
        font: item.estimatedUnitsSold !== null ? helveticaBold : helvetica,
        color: item.estimatedUnitsSold !== null ? cDark : cMuted,
      });
      colX += colWidths.sold;

      // 5. Est. Retail Sales
      const salesText = item.estimatedRetailSales !== null ? formatCurrency(item.estimatedRetailSales) : "-";
      currentPage.drawText(salesText, {
        x: colX + 10,
        y: textY,
        size: 7.2,
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
        y: textY,
        size: 7.0,
        font: helvetica,
        color: data.isFinancialsHidden ? cMuted : (item.estimatedGrossProfit !== null ? cGreen : cMuted),
      });
      colX += colWidths.profit;

      // 7. Suggested Reorder
      if (item.reorderNeeded && item.suggestedReorderQty > 0) {
        const reorderStr = `${formatQty(item.suggestedReorderQty)} u (${item.suggestedCases}cs)`;
        currentPage.drawText(reorderStr, {
          x: colX + 4,
          y: textY,
          size: 7.0,
          font: helveticaBold,
          color: cAmber,
        });
      } else if (item.reportedRemaining === null) {
        currentPage.drawText("Needs Check", {
          x: colX + 6,
          y: textY,
          size: 6.8,
          font: helvetica,
          color: cAmber,
        });
      } else {
        currentPage.drawText("-", {
          x: colX + 24,
          y: textY,
          size: 7.2,
          font: helvetica,
          color: cMuted,
        });
      }

      y -= rowHeight;
    }
  }

  y -= 14;

  // ===========================================================================
  // 7. METHODOLOGY & AUDIT NOTE BOX
  // ===========================================================================
  checkPageBreak(70);

  const methBoxHeight = 52;
  currentPage.drawRectangle({
    x: margin,
    y: y - methBoxHeight,
    width: contentWidth,
    height: methBoxHeight,
    color: cBgLight,
    borderColor: cBorder,
    borderWidth: 0.75,
  });

  currentPage.drawText("REPORTING METHODOLOGY & AUDIT NOTICE", {
    x: margin + 10,
    y: y - 11,
    size: 7.2,
    font: helveticaBold,
    color: cNavy,
  });

  const notes = [
    "1. Weekly inventory figures reflect verified physical counts submitted by retail store staff and confirmed delivered orders.",
    "2. Estimated Sales & Gross Profit are calculated from stock deltas and current store SRP. They do not replace live POS register totals.",
    "3. Baseline Weeks: The initial weekly count establishes an opening inventory baseline. Weekly sales estimates activate after consecutive audits.",
    "4. Replenishment recommendations respect product MOQ and case multiples. Baseline recommendations are stock-based to prevent retail stockouts.",
  ];

  let noteY = y - 21;
  for (const note of notes) {
    currentPage.drawText(note, {
      x: margin + 10,
      y: noteY,
      size: 6.0,
      font: helvetica,
      color: cMuted,
    });
    noteY -= 8;
  }

  y -= methBoxHeight + 10;

  // ===========================================================================
  // 8. RUNNING FOOTER (ALL PAGES)
  // ===========================================================================
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const footerY = 22;

    page.drawLine({
      start: { x: margin, y: footerY + 12 },
      end: { x: pageWidth - margin, y: footerY + 12 },
      thickness: 0.5,
      color: cBorder,
    });

    // Left confidential notice
    page.drawText("K SELECT HUB Confidential  -  For Authorized Retail Partner Use Only", {
      x: margin,
      y: footerY,
      size: 6.5,
      font: helvetica,
      color: cMuted,
    });

    // Center timestamp
    const centerNotice = `Report Generated: ${generatedTimestamp}`;
    const centerWidth = helvetica.widthOfTextAtSize(centerNotice, 6.5);
    page.drawText(centerNotice, {
      x: (pageWidth - centerWidth) / 2,
      y: footerY,
      size: 6.5,
      font: helvetica,
      color: cMuted,
    });

    // Right page number
    const pageStr = `Page ${i + 1} of ${totalPages}`;
    const pageStrWidth = helveticaBold.widthOfTextAtSize(pageStr, 6.5);
    page.drawText(pageStr, {
      x: pageWidth - margin - pageStrWidth,
      y: footerY,
      size: 6.5,
      font: helveticaBold,
      color: cDark,
    });
  }

  return await pdfDoc.save();
}
