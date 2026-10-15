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
  let displayBrand = brandUpper;
  while (ctx.measureText(displayBrand).width > 220 && displayBrand.length > 4) {
    displayBrand = displayBrand.slice(0, -5).trim() + "...";
  }
  ctx.fillText(displayBrand, 14, 18);

  ctx.font = "bold 11px monospace, Courier";
  ctx.textAlign = "right";
  ctx.fillText(item.sku || "KS-PROD", baseWidth - 14, 18);

  // Header Divider
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14, 28);
  ctx.lineTo(baseWidth - 14, 28);
  ctx.stroke();

  // 3. Middle Section: Product Name (wrapped up to 2 lines)
  ctx.font = "bold 13.5px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const nameLines = wrapCanvasText(ctx, item.productName, baseWidth - 28, 2);

  let currentY = 34;
  for (const line of nameLines) {
    ctx.fillText(line, 14, currentY);
    currentY += 17;
  }

  // Bottom Section Divider
  ctx.beginPath();
  ctx.moveTo(14, 88);
  ctx.lineTo(baseWidth - 14, 88);
  ctx.stroke();

  // 4. Bottom Left: Price Display (Matches price-tag-card.tsx presentation)
  const isSale =
    item.isSaleActive &&
    item.salePrice !== null &&
    item.salePrice > 0 &&
    item.regularPrice !== null &&
    item.regularPrice > 0 &&
    item.salePrice < item.regularPrice;

  const effectiveDiscount =
    item.discountPercent !== null && item.discountPercent !== undefined
      ? item.discountPercent
      : isSale && item.regularPrice && item.salePrice
      ? Math.round(((item.regularPrice - item.salePrice) / item.regularPrice) * 100)
      : null;

  if (isSale) {
    // Solid Black Pill for "SALE"
    ctx.fillStyle = "#000000";
    ctx.fillRect(14, 96, 36, 16);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 9px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SALE", 32, 104);

    // Bordered Pill for discount percentage
    if (effectiveDiscount !== null) {
      const pillText = `SAVE ${effectiveDiscount}%`;
      ctx.font = "900 8.5px system-ui, -apple-system, sans-serif";
      const pillW = ctx.measureText(pillText).width + 8;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(54, 96, pillW, 16);
      ctx.fillStyle = "#000000";
      ctx.fillText(pillText, 54 + pillW / 2, 104);
    }

    // Large Bold Sale Price
    ctx.fillStyle = "#000000";
    ctx.font = "900 36px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const saleStr = `$${item.salePrice?.toFixed(2)}`;
    ctx.fillText(saleStr, 14, 156);

    // Strikethrough Regular Price
    const saleWidth = ctx.measureText(saleStr).width;
    const regStr = `$${item.regularPrice?.toFixed(2)}`;
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#000000";
    const regX = 14 + saleWidth + 8;
    const regY = 154;
    ctx.fillText(regStr, regX, regY);

    const regWidth = ctx.measureText(regStr).width;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(regX - 1, regY - 5);
    ctx.lineTo(regX + regWidth + 1, regY - 5);
    ctx.stroke();
  } else if (item.hasStorePrice && item.regularPrice && !item.isMsrpDefault) {
    // Confirmed Store Regular Price
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("STORE PRICE", 14, 104);

    ctx.font = "900 40px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`$${item.regularPrice.toFixed(2)}`, 14, 156);
  } else if (item.isMsrpDefault && item.regularPrice) {
    // MSRP Default Regular Price
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("REGULAR", 14, 104);

    // MSRP badge
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(66, 96, 36, 16);
    ctx.font = "900 8.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MSRP", 84, 104);

    ctx.font = "900 40px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`$${item.regularPrice.toFixed(2)}`, 14, 156);
  } else {
    // Unpriced
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 96, 68, 16);
    ctx.font = "900 8.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SET PRICE", 48, 104);

    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Not Priced", 14, 150);
  }

  // 5. Bottom Right: Canonical 12x12mm QR Code (96x96 px)
  if (item.qrDataUrl) {
    const qrImg = new Image();
    await new Promise<void>((resolve) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => resolve(); // continue even if QR load fails
      qrImg.src = item.qrDataUrl!;
    });

    const qrSize = 96; // 12mm at 203 DPI (8 dots/mm)
    const qrX = baseWidth - 14 - qrSize;
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
 * Generate a safe, descriptive filename for 50x30mm price tag PNG.
 * Example: KSELECT_Label_DR120-SB-001_50x30.png
 */
export function generatePriceTagFileName(
  item: StoreProductTagItem,
  storeName?: string
): string {
  const sanitize = (s: string) =>
    s
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const skuClean = sanitize(item.sku || "PROD");
  const storeClean =
    storeName && storeName !== "All Stores" ? `_${sanitize(storeName)}` : "";
  return `KSELECT_Label_${skuClean}${storeClean}_50x30.png`;
}

/**
 * Primary Direct Save / Download Action:
 * Downloads the 50x30mm PNG label image directly to the client's Downloads folder.
 * Uses native <a download> mechanism with Blob URL.
 * NEVER invokes navigator.share() or opens the system sharing sheet.
 */
export async function downloadPriceTagImage(
  item: StoreProductTagItem,
  storeName?: string
): Promise<{ success: boolean; fileName: string; sizeBytes: number }> {
  try {
    const blob = await exportPriceTagAsBlob(item, 2);
    const fileName = generatePriceTagFileName(item, storeName);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";

    // On iOS Safari, target="_blank" allows direct viewing/saving if anchor download is restricted
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent || "");
    if (isIOS) {
      a.target = "_blank";
    }

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Keep object URL active long enough for mobile download to initiate
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 60000);

    return { success: true, fileName, sizeBytes: blob.size };
  } catch (err) {
    console.error("Error downloading price tag image:", err);
    throw err;
  }
}

/**
 * Check if Web Share API is available in the current browser
 */
export function isWebShareSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  );
}

/**
 * Separate Share Action:
 * Explicitly triggers the native mobile sharing sheet only when the user taps "Share Image".
 */
export async function sharePriceTagImage(
  item: StoreProductTagItem,
  storeName?: string
): Promise<{ success: boolean; shared: boolean; message?: string }> {
  if (typeof navigator === "undefined" || !navigator.share) {
    throw new Error("Web Share is not supported on this device/browser.");
  }

  const blob = await exportPriceTagAsBlob(item, 2);
  const fileName = generatePriceTagFileName(item, storeName);
  const file = new File([blob], fileName, { type: "image/png" });

  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `K SELECT Price Tag - ${item.sku}`,
        text: `50×30mm shelf tag for ${item.productName}`,
        files: [file],
      });
      return { success: true, shared: true };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: true, shared: false };
      }
      throw err;
    }
  } else {
    try {
      await navigator.share({
        title: `K SELECT Price Tag - ${item.sku}`,
        text: `50×30mm shelf tag for ${item.productName} (${item.sku})`,
      });
      return { success: true, shared: true, message: "Shared label details." };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: true, shared: false };
      }
      throw new Error("File sharing is not supported by your browser's share sheet.");
    }
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
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      (window as any).ClipboardItem
    ) {
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

/**
 * Backward compatibility alias: Calls direct download
 */
export async function savePriceTagForNiimbot(
  item: StoreProductTagItem,
  storeName?: string
): Promise<{ method: "download"; success: boolean; fileName: string }> {
  const res = await downloadPriceTagImage(item, storeName);
  return { method: "download", success: res.success, fileName: res.fileName };
}
