"use client";

import { StoreProductTagItem, PHYSICAL_PRICE_TAG_DIMENSIONS } from "./store-pricing-types";

/**
 * Word wrap helper for Canvas text rendering
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 2
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    // If last line overflows, truncate with ellipsis
    let finalLine = currentLine;
    while (ctx.measureText(finalLine).width > maxWidth && finalLine.length > 3) {
      finalLine = finalLine.slice(0, -4).trim() + "...";
    }
    lines.push(finalLine);
  }

  return lines;
}

/**
 * Render a high-contrast 1-bit monochrome 50x30mm thermal label onto an HTML5 Canvas.
 * Exactly 384 x 240 printable dots at 203 DPI (scaled by `scaleFactor` for high-DPI crispness).
 */
export async function renderPriceTagToCanvas(
  item: StoreProductTagItem,
  scaleFactor: number = 2
): Promise<HTMLCanvasElement> {
  const baseWidth = PHYSICAL_PRICE_TAG_DIMENSIONS.pixelWidth; // 384 dots
  const baseHeight = PHYSICAL_PRICE_TAG_DIMENSIONS.pixelHeight; // 240 dots

  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scaleFactor;
  canvas.height = baseHeight * scaleFactor;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");

  // High quality image rendering
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scaleFactor, scaleFactor);

  // 1. Pure White Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // 2. Top Header: Brand Name (Left) & SKU (Right)
  ctx.fillStyle = "#000000";
  ctx.font = "900 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const brandUpper = (item.brandName || "K SELECT").toUpperCase();
  // Truncate brand if too long
  let displayBrand = brandUpper;
  while (ctx.measureText(displayBrand).width > 240 && displayBrand.length > 4) {
    displayBrand = displayBrand.slice(0, -5).trim() + "...";
  }
  ctx.fillText(displayBrand, 14, 18);

  ctx.font = "bold 11px monospace, Courier";
  ctx.textAlign = "right";
  ctx.fillText(item.sku || "KS-PROD", 370, 18);

  // Header Divider
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14, 28);
  ctx.lineTo(370, 28);
  ctx.stroke();

  // 3. Middle Section: Product Name (wrapped up to 2 lines)
  ctx.font = "bold 13.5px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const nameLines = wrapCanvasText(ctx, item.productName, 356, 2);

  let currentY = 34;
  for (const line of nameLines) {
    ctx.fillText(line, 14, currentY);
    currentY += 17;
  }

  // Bottom Section Divider
  ctx.beginPath();
  ctx.moveTo(14, 88);
  ctx.lineTo(370, 88);
  ctx.stroke();

  // 4. Bottom Left: Price Display
  const isSale = item.isSaleActive && item.salePrice !== null && item.discountPercent !== null;

  if (isSale) {
    // Was regular price + strike-through
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const wasText = `Was $${item.regularPrice?.toFixed(2)}`;
    ctx.fillText(wasText, 14, 106);

    const wasMetrics = ctx.measureText(wasText);
    ctx.beginPath();
    ctx.moveTo(14, 106);
    ctx.lineTo(14 + wasMetrics.width, 106);
    ctx.stroke();

    // Solid Black Pill for discount
    const pillText = `SAVE ${item.discountPercent}%`;
    ctx.font = "900 9px system-ui, -apple-system, sans-serif";
    const pillMetrics = ctx.measureText(pillText);
    const pillX = 14 + wasMetrics.width + 8;
    const pillY = 98;
    const pillW = pillMetrics.width + 8;
    const pillH = 16;

    ctx.fillStyle = "#000000";
    ctx.fillRect(pillX, pillY, pillW, pillH);

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(pillText, pillX + 4, pillY + 8);

    // Large Bold Sale Price
    ctx.fillStyle = "#000000";
    ctx.font = "900 38px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`$${item.salePrice?.toFixed(2)}`, 14, 156);
  } else if (item.hasStorePrice && item.regularPrice) {
    // Confirmed Store Regular Price
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("STORE PRICE", 14, 104);

    ctx.font = "900 40px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`$${item.regularPrice.toFixed(2)}`, 14, 156);
  } else {
    // Unconfirmed MSRP Guidance — Explicitly disambiguated
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("MSRP GUIDANCE", 14, 104);

    // Dashed warning pill "SET PRICE"
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(100, 96, 68, 16);
    ctx.font = "900 8.5px system-ui, -apple-system, sans-serif";
    ctx.fillText("SET PRICE", 106, 104);

    ctx.font = "900 34px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`$${item.effectivePrice.toFixed(2)}`, 14, 156);
  }

  // 5. Bottom Right: Canonical 12x12mm QR Code (96x96 px)
  if (item.qrDataUrl) {
    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => resolve(); // continue even if QR load fails
      qrImg.src = item.qrDataUrl!;
    });

    const qrSize = 96; // 12mm at 203 DPI (8 dots/mm)
    const qrX = 266;
    const qrY = 96;

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // QR Border & Quiet margin
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);

    // Sub-label below QR
    ctx.fillStyle = "#000000";
    ctx.font = "bold 7.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("SCAN FOR INFO", qrX + qrSize / 2, qrY + qrSize + 4);
  }

  return canvas;
}

/**
 * Generate a PNG Blob from the rendered canvas
 */
export async function exportPriceTagAsBlob(
  item: StoreProductTagItem,
  scaleFactor: number = 2
): Promise<Blob> {
  const canvas = await renderPriceTagToCanvas(item, scaleFactor);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create PNG blob from canvas"));
    }, "image/png");
  });
}

/**
 * Mobile-First Export Action for NIIMBOT B1:
 * Tries Web Share API first so user can save directly to Photos/Files or open in NIIMBOT app.
 * Falls back gracefully to direct browser PNG download.
 */
export async function savePriceTagForNiimbot(
  item: StoreProductTagItem
): Promise<{ method: "share" | "download"; success: boolean }> {
  try {
    const blob = await exportPriceTagAsBlob(item, 2);
    const fileName = `Label-${item.sku || "KSELECT"}-50x30mm.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    // 1. Check Web Share API with files support (iOS Safari & Android Chrome)
    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `Price Tag - ${item.sku}`,
          text: `50x30mm shelf label for ${item.productName}`,
          files: [file],
        });
        return { method: "share", success: true };
      } catch (shareErr: any) {
        // If user cancelled share sheet, do not force redundant download
        if (shareErr.name === "AbortError") {
          return { method: "share", success: false };
        }
      }
    }

    // 2. Direct browser download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    return { method: "download", success: true };
  } catch (err) {
    console.error("Error exporting price tag for NIIMBOT:", err);
    throw err;
  }
}

/**
 * Copy 50x30mm label PNG directly to OS Clipboard
 */
export async function copyPriceTagImageToClipboard(
  item: StoreProductTagItem
): Promise<boolean> {
  try {
    const blob = await exportPriceTagAsBlob(item, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard && (window as any).ClipboardItem) {
      const itemToCopy = new (window as any).ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([itemToCopy]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Clipboard copy not supported or failed:", err);
    return false;
  }
}
