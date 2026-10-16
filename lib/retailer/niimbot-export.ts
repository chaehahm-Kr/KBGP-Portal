"use client";

import QRCode from "qrcode";
import {
  StoreProductTagItem,
  PHYSICAL_PRICE_TAG_DIMENSIONS,
  resolveShelfTagTemplate,
} from "./store-pricing-types";

/**
 * Word wrap helper for Canvas text rendering
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 2
): string[] {
  if (!text) return [];
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
 * Ensure scannable QR data URL is always available
 */
async function resolveQrDataUrl(item: StoreProductTagItem): Promise<string | null> {
  if (item.qrDataUrl && item.qrDataUrl.startsWith("data:image")) {
    return item.qrDataUrl;
  }
  const destinationUrl =
    item.canonicalProductUrl ||
    `https://www.kselecthub.com/products/${encodeURIComponent(item.productId || item.sku)}`;
  try {
    return await QRCode.toDataURL(destinationUrl, {
      margin: 1,
      errorCorrectionLevel: "M",
      width: 256,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.warn("Fallback QR generation failed:", err);
    return null;
  }
}

/**
 * Render an approved high-contrast monochrome 50x30mm shelf label onto an HTML5 Canvas.
 * Supports:
 *   - REGULAR 1c (Approved minimalist template: Brand, SKU, 2-line name, large price, QR)
 *   - SALE 1e (Approved promotional template: Vertical SALE band, Brand/SKU, SAVE %, strikethrough, SALE price, QR)
 *
 * Base Dimensions: 400 x 240 dots at 203 DPI (8 dots/mm = 50mm x 30mm, exact 5:3 aspect ratio).
 * At scaleFactor 2: 800 x 480 pixels (high-DPI, 100% black and white).
 */
export async function renderPriceTagToCanvas(
  item: StoreProductTagItem,
  scaleFactor: number = 2
): Promise<HTMLCanvasElement> {
  const baseWidth = PHYSICAL_PRICE_TAG_DIMENSIONS.pixelWidth; // 400 dots (50mm * 8)
  const baseHeight = PHYSICAL_PRICE_TAG_DIMENSIONS.pixelHeight; // 240 dots (30mm * 8)

  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scaleFactor;
  canvas.height = baseHeight * scaleFactor;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");

  // Disable antialiasing smoothing on image blits to guarantee thermal printer crispness
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scaleFactor, scaleFactor);

  // 1. Pure White Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Determine authoritative template
  const template = resolveShelfTagTemplate(item);
  const isSale = template === "sale_1e";

  const effectiveRegularPrice =
    item.regularPrice !== null && item.regularPrice > 0
      ? item.regularPrice
      : item.msrp > 0
      ? item.msrp
      : null;

  const effectiveDiscount =
    item.discountPercent !== null && item.discountPercent !== undefined
      ? item.discountPercent
      : isSale && effectiveRegularPrice && item.salePrice
      ? Math.round(((effectiveRegularPrice - item.salePrice) / effectiveRegularPrice) * 100)
      : null;

  const brandText = (item.brandName || "K SELECT LAB").toUpperCase();
  const skuText = item.sku || "KS-PROD";
  const productName = item.productName || "";

  // Resolve QR image
  const resolvedQrUrl = await resolveQrDataUrl(item);
  let qrImg: HTMLImageElement | null = null;
  if (resolvedQrUrl) {
    qrImg = new Image();
    await new Promise<void>((resolve) => {
      if (!qrImg) return resolve();
      qrImg.onload = () => resolve();
      qrImg.onerror = () => resolve();
      qrImg.src = resolvedQrUrl;
    });
  }

  const margin = 12; // 1.5mm safe margin (12 dots at 8 dots/mm)

  if (isSale) {
    // =========================================================================
    // TEMPLATE: SALE 1e (Refined Hierarchy for 50x30mm NIIMBOT B1)
    // =========================================================================
    const bandWidth = 58; // Optimal vertical SALE banner width
    const bandHeight = baseHeight - margin * 2; // 216 dots (27mm)

    // Solid Vertical Black SALE Band on far left
    ctx.fillStyle = "#000000";
    ctx.fillRect(margin, margin, bandWidth, bandHeight);

    // Text "SALE" rotated -90 degrees (reading vertically bottom to top)
    ctx.save();
    ctx.translate(margin + bandWidth / 2, margin + bandHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SALE", 0, 0);
    ctx.restore();

    // Main content area to the right of the SALE band
    const gutter = 8; // 1.0mm gutter
    const mainX = margin + bandWidth + gutter; // 78 dots
    const mainRight = baseWidth - margin; // 388 dots

    // Header Row: Brand (left) & SKU (right)
    ctx.fillStyle = "#000000";
    ctx.font = "900 11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    let displayBrand = brandText;
    while (ctx.measureText(displayBrand).width > 190 && displayBrand.length > 3) {
      displayBrand = displayBrand.slice(0, -4).trim() + "...";
    }
    ctx.fillText(displayBrand, mainX, margin + 11);

    ctx.font = "bold 9.5px monospace, 'Courier New', Courier";
    ctx.textAlign = "right";
    ctx.fillText(skuText, mainRight, margin + 11);

    // 0.4mm Header Divider Rule
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mainX, margin + 17);
    ctx.lineTo(mainRight, margin + 17);
    ctx.stroke();

    // QR Code Column (Bottom Right of Main Area): 98x98 dots (12.25mm)
    const qrSymbolSize = 98;
    const qrX = mainRight - qrSymbolSize;
    const qrY = baseHeight - margin - qrSymbolSize - 13;

    if (qrImg) {
      ctx.drawImage(qrImg, qrX, qrY, qrSymbolSize, qrSymbolSize);
    } else {
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(qrX, qrY, qrSymbolSize, qrSymbolSize);
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("QR", qrX + qrSymbolSize / 2, qrY + qrSymbolSize / 2);
    }

    ctx.fillStyle = "#000000";
    ctx.font = "900 6.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SCAN FOR INFO", qrX + qrSymbolSize / 2, baseHeight - margin - 2);

    // Text Stack (Left of QR)
    const textColWidth = qrX - mainX - 8; // 204 dots
    let nameFontSize = 16.5;
    let nameLineHeight = 19.5;
    if (productName.length > 48) {
      nameFontSize = 11.5;
      nameLineHeight = 14;
    } else if (productName.length > 32) {
      nameFontSize = 13.5;
      nameLineHeight = 16.5;
    }

    ctx.font = `bold ${nameFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const nameLines = wrapCanvasText(ctx, productName, textColWidth, 2);

    let curY = margin + 17 + nameFontSize;
    for (const line of nameLines) {
      ctx.fillText(line, mainX, curY);
      curY += nameLineHeight;
    }
    const productBottomY = curY - nameLineHeight + 4;

    // SAVE XX% Box (Enlarged, prominent, 1.8px border)
    const saveBoxY = Math.max(78, productBottomY + 8);
    if (effectiveDiscount !== null) {
      const saveText = `SAVE ${effectiveDiscount}%`;
      ctx.font = "900 13.5px system-ui, -apple-system, sans-serif";
      const saveW = ctx.measureText(saveText).width + 14;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(mainX, saveBoxY, saveW, 22);

      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(saveText, mainX + saveW / 2, saveBoxY + 11);
    }

    // Strikethrough Regular Price (Enlarged to 18px, bold, 2px strike line)
    const regY = saveBoxY + 22 + 6 + 15;
    if (effectiveRegularPrice !== null) {
      const regText = `$${effectiveRegularPrice.toFixed(2)}`;
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(regText, mainX, regY);

      const regW = ctx.measureText(regText).width;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(mainX - 1, regY - 6);
      ctx.lineTo(mainX + regW + 2, regY - 6);
      ctx.stroke();
    }

    // Large Dominant SALE Price (Dominates lower area, 62px for <$100, 46px for >=$100)
    const saleNum = item.salePrice || 0;
    const saleText = `$${saleNum.toFixed(2)}`;
    const saleFontSize = saleNum >= 100 ? 46 : 62;
    ctx.font = `900 ${saleFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(saleText, mainX, baseHeight - margin - 5);
  } else {
    // =========================================================================
    // TEMPLATE: REGULAR 1c (Approved Claude Design 1c)
    // =========================================================================

    // Top Header: Brand (Left) & SKU (Right) across full width
    ctx.fillStyle = "#000000";
    ctx.font = "900 13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    let displayBrand = brandText;
    while (ctx.measureText(displayBrand).width > 220 && displayBrand.length > 3) {
      displayBrand = displayBrand.slice(0, -4).trim() + "...";
    }
    ctx.fillText(displayBrand, margin, margin + 12);

    ctx.font = "bold 11px monospace, 'Courier New', Courier";
    ctx.textAlign = "right";
    ctx.fillText(skuText, baseWidth - margin, margin + 12);

    // 0.4mm Header Divider Rule across full width
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(margin, margin + 18);
    ctx.lineTo(baseWidth - margin, margin + 18);
    ctx.stroke();

    // QR Code Column (Bottom Right): 13.5mm symbol = 108 dots
    const qrSymbolSize = 108;
    const qrX = baseWidth - margin - qrSymbolSize;
    const qrY = baseHeight - margin - qrSymbolSize - 13;

    if (qrImg) {
      ctx.drawImage(qrImg, qrX, qrY, qrSymbolSize, qrSymbolSize);
    } else {
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(qrX, qrY, qrSymbolSize, qrSymbolSize);
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("QR", qrX + qrSymbolSize / 2, qrY + qrSymbolSize / 2);
    }

    ctx.fillStyle = "#000000";
    ctx.font = "900 6.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SCAN FOR INFO", qrX + qrSymbolSize / 2, baseHeight - margin - 2);

    // Product Name (up to 2 lines, large bold font)
    const textColWidth = 200; // Optimal 2-line break for Barrier Repair / Ceramide Serum
    let nameFontSize = 26;
    let nameLineHeight = 30;
    if (productName.length > 42) {
      nameFontSize = 13.5;
      nameLineHeight = 16;
    } else if (productName.length > 28) {
      nameFontSize = 17;
      nameLineHeight = 20;
    }

    ctx.font = `bold ${nameFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const nameLines = wrapCanvasText(ctx, productName, textColWidth, 2);

    let curY = margin + 18 + nameFontSize;
    for (const line of nameLines) {
      ctx.fillText(line, margin, curY);
      curY += nameLineHeight;
    }

    // Large Selling Price (Bottom Left, no SALE graphics, no MSRP/STORE labels)
    ctx.fillStyle = "#000000";
    if (effectiveRegularPrice !== null) {
      const priceText = `$${effectiveRegularPrice.toFixed(2)}`;
      const priceFontSize = effectiveRegularPrice >= 100 ? 44 : 54;
      ctx.font = `900 ${priceFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(priceText, margin, baseHeight - margin - 8);
    } else {
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Set Price", margin, baseHeight - margin - 8);
    }
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
 * Example: KSELECT_Label_TEST-SKN-001_50x30.png
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
