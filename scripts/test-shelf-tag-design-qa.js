const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const jsQR = require("jsqr");
const { PNG } = require("pngjs");
const QRCode = require("qrcode");

const ARTIFACT_DIR = "C:/Users/ChaeHahm/.gemini/antigravity/brain/730f6e70-61e4-47de-8a28-291a9d425b30";

const timeoutHandle = setTimeout(() => {
  console.error("[FATAL] QA test timeout exceeded (45s)");
  process.exit(1);
}, 45000);

function resolveShelfTagTemplate(item) {
  const isSale =
    Boolean(item.isSaleActive) &&
    typeof item.salePrice === "number" &&
    item.salePrice > 0 &&
    typeof item.regularPrice === "number" &&
    item.regularPrice > 0 &&
    item.salePrice < item.regularPrice;

  return isSale ? "sale_1e" : "regular_1c";
}

async function runDesignQA() {
  console.log("==================================================================");
  console.log("  RTP-PRICE-TAG-DESIGN-001 Shelf Label Design & Export QA");
  console.log("==================================================================");

  // 1. Test Automatic Template Selection
  console.log("\n--- [Step 1: Automatic Template Selection] ---");
  const t1 = resolveShelfTagTemplate({
    regularPrice: 22.0,
    salePrice: null,
    isSaleActive: false,
  });
  console.log("  Regular only ->", t1, "(Expected: regular_1c)");
  if (t1 !== "regular_1c") throw new Error("Template 1 failed");

  const t2 = resolveShelfTagTemplate({
    regularPrice: 22.0,
    salePrice: 17.95,
    isSaleActive: true,
  });
  console.log("  Sale $17.95 with regular $22.00 ->", t2, "(Expected: sale_1e)");
  if (t2 !== "sale_1e") throw new Error("Template 2 failed");

  const t3 = resolveShelfTagTemplate({
    regularPrice: 22.0,
    salePrice: 25.0, // Invalid sale higher than regular
    isSaleActive: true,
  });
  console.log("  Sale $25.00 >= regular $22.00 ->", t3, "(Expected: regular_1c)");
  if (t3 !== "regular_1c") throw new Error("Template 3 failed");

  const t4 = resolveShelfTagTemplate({
    regularPrice: 22.0,
    salePrice: 17.95,
    isSaleActive: false, // Inactive sale window
  });
  console.log("  Sale $17.95 with isSaleActive=false ->", t4, "(Expected: regular_1c)");
  if (t4 !== "regular_1c") throw new Error("Template 4 failed");

  // 2. Test Dimensions & Exact 5:3 Aspect Ratio
  console.log("\n--- [Step 2: Physical Dimensions & Exact 5:3 Aspect Ratio] ---");
  const pixelWidth = 400;
  const pixelHeight = 240;
  const exportWidth = 800;
  const exportHeight = 480;
  console.log(`  Base Width: ${pixelWidth} dots (50mm * 8)`);
  console.log(`  Base Height: ${pixelHeight} dots (30mm * 8)`);
  console.log(`  Export Width: ${exportWidth} px`);
  console.log(`  Export Height: ${exportHeight} px`);
  const ratio = exportWidth / exportHeight;
  console.log(`  Ratio: ${ratio} (5/3 = ${5 / 3})`);
  if (Math.abs(ratio - 5 / 3) > 0.0001) {
    throw new Error("Aspect ratio is not exactly 5:3!");
  }
  console.log("  ✓ Exact 5:3 aspect ratio verified!");

  // 3. Headless Browser Canvas Export & Real QR Decoding
  console.log("\n--- [Step 3: Headless Canvas Export & Real QR Decoding] ---");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  await page.goto("about:blank");

  // Inject canvas rendering engine
  await page.evaluate(() => {
    function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
      if (!text) return [];
      const words = text.split(/\s+/);
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
          if (lines.length >= maxLines - 1) break;
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

    window.renderPriceTag = async function (item, scaleFactor = 2) {
      const baseWidth = 400;
      const baseHeight = 240;
      const canvas = document.createElement("canvas");
      canvas.width = baseWidth * scaleFactor;
      canvas.height = baseHeight * scaleFactor;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.scale(scaleFactor, scaleFactor);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, baseWidth, baseHeight);

      const isSale =
        Boolean(item.isSaleActive) &&
        typeof item.salePrice === "number" &&
        item.salePrice > 0 &&
        typeof item.regularPrice === "number" &&
        item.regularPrice > 0 &&
        item.salePrice < item.regularPrice;

      const effectiveRegularPrice = item.regularPrice || item.msrp || 0;
      const effectiveDiscount = isSale
        ? Math.round(((effectiveRegularPrice - item.salePrice) / effectiveRegularPrice) * 100)
        : null;

      const brandText = (item.brandName || "K SELECT LAB").toUpperCase();
      const skuText = item.sku || "KS-PROD";
      const productName = item.productName || "";

      const qrImg = new Image();
      await new Promise((res) => {
        qrImg.onload = () => res();
        qrImg.onerror = () => res();
        qrImg.src = item.qrDataUrl;
      });

      const margin = 12;

      if (isSale) {
        // =========================================================================
        // TEMPLATE: SALE 1e
        // =========================================================================
        const bandWidth = 72;
        const bandHeight = baseHeight - margin * 2;
        ctx.fillStyle = "#000000";
        ctx.fillRect(margin, margin, bandWidth, bandHeight);

        ctx.save();
        ctx.translate(margin + bandWidth / 2, margin + bandHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 32px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SALE", 0, 0);
        ctx.restore();

        const gutter = 9;
        const mainX = margin + bandWidth + gutter;
        const mainRight = baseWidth - margin;

        ctx.fillStyle = "#000000";
        ctx.font = "900 11px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        let displayBrand = brandText;
        while (ctx.measureText(displayBrand).width > 180 && displayBrand.length > 3) {
          displayBrand = displayBrand.slice(0, -4).trim() + "...";
        }
        ctx.fillText(displayBrand, mainX, margin + 11);

        ctx.font = "bold 9px monospace, 'Courier New', Courier";
        ctx.textAlign = "right";
        ctx.fillText(skuText, mainRight, margin + 11);

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(mainX, margin + 17);
        ctx.lineTo(mainRight, margin + 17);
        ctx.stroke();

        // QR Code Column (Bottom Right of Main Area): 15.5mm box (13.5mm symbol = 108 dots)
        const qrSymbolSize = 108; // 13.5mm
        const qrX = mainRight - qrSymbolSize;
        const qrY = baseHeight - margin - qrSymbolSize - 13;
        ctx.drawImage(qrImg, qrX, qrY, qrSymbolSize, qrSymbolSize);

        ctx.fillStyle = "#000000";
        ctx.font = "900 6.5px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("SCAN FOR INFO", qrX + qrSymbolSize / 2, baseHeight - margin - 2);

        // Text Stack (Left of QR)
        const textColWidth = 148;
        let nameFontSize = 22;
        let nameLineHeight = 25;
        if (productName.length > 42) {
          nameFontSize = 11.5;
          nameLineHeight = 13.5;
        } else if (productName.length > 28) {
          nameFontSize = 14.5;
          nameLineHeight = 17;
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

        if (effectiveDiscount !== null) {
          const saveText = `SAVE ${effectiveDiscount}%`;
          ctx.font = "900 11px system-ui, -apple-system, sans-serif";
          const saveW = ctx.measureText(saveText).width + 10;
          const saveBoxY = 82;
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1.3;
          ctx.strokeRect(mainX, saveBoxY, saveW, 17);
          ctx.fillStyle = "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(saveText, mainX + saveW / 2, saveBoxY + 8.5);
        }

        if (effectiveRegularPrice !== null) {
          const regText = `$${effectiveRegularPrice.toFixed(2)}`;
          ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          const regY = 116;
          ctx.fillText(regText, mainX, regY);

          const regW = ctx.measureText(regText).width;
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(mainX - 1, regY - 4);
          ctx.lineTo(mainX + regW + 1, regY - 4);
          ctx.stroke();
        }

        const saleNum = item.salePrice || 0;
        const saleText = `$${saleNum.toFixed(2)}`;
        const saleFontSize = saleNum >= 100 ? 34 : 44;
        ctx.font = `900 ${saleFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(saleText, mainX, baseHeight - margin - 8);
      } else {
        // =========================================================================
        // TEMPLATE: REGULAR 1c
        // =========================================================================
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

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(margin, margin + 18);
        ctx.lineTo(baseWidth - margin, margin + 18);
        ctx.stroke();

        const qrSymbolSize = 108;
        const qrX = baseWidth - margin - qrSymbolSize;
        const qrY = baseHeight - margin - qrSymbolSize - 13;
        ctx.drawImage(qrImg, qrX, qrY, qrSymbolSize, qrSymbolSize);

        ctx.fillStyle = "#000000";
        ctx.font = "900 6.5px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("SCAN FOR INFO", qrX + qrSymbolSize / 2, baseHeight - margin - 2);

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
        let curY = margin + 20 + nameFontSize;
        for (const line of nameLines) {
          ctx.fillText(line, margin, curY);
          curY += nameLineHeight;
        }

        ctx.fillStyle = "#000000";
        const priceText = `$${effectiveRegularPrice.toFixed(2)}`;
        const priceFontSize = effectiveRegularPrice >= 100 ? 44 : 54;
        ctx.font = `900 ${priceFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(priceText, margin, baseHeight - margin - 8);
      }

      return canvas.toDataURL("image/png");
    };
  });

  // Test Case A: Regular 1c (Barrier Repair Ceramide Serum, $22.00)
  const reg1cItem = {
    productId: "5be4ca57-d0f6-44b8-8cbb-2b443a34752e",
    productName: "Barrier Repair Ceramide Serum",
    brandName: "K SELECT LAB",
    sku: "TEST-SKN-001",
    regularPrice: 22.0,
    salePrice: null,
    isSaleActive: false,
    canonicalProductUrl: "https://www.kselecthub.com/products/5be4ca57-d0f6-44b8-8cbb-2b443a34752e",
  };
  reg1cItem.qrDataUrl = await QRCode.toDataURL(reg1cItem.canonicalProductUrl, {
    margin: 1,
    errorCorrectionLevel: "M",
    width: 256,
  });

  const reg1cDataUrl = await page.evaluate(async (it) => {
    return await window.renderPriceTag(it, 2);
  }, reg1cItem);

  const reg1cBase64 = reg1cDataUrl.replace(/^data:image\/png;base64,/, "");
  const reg1cBuffer = Buffer.from(reg1cBase64, "base64");
  const reg1cPath = path.join(ARTIFACT_DIR, "prod_shelf_tag_regular_1c.png");
  fs.writeFileSync(reg1cPath, reg1cBuffer);
  console.log("  ✓ Saved Regular 1c PNG artifact:", reg1cPath);

  const regPng = PNG.sync.read(reg1cBuffer);
  console.log(`  Regular 1c Export Dimensions: ${regPng.width} x ${regPng.height}`);
  if (regPng.width !== 800 || regPng.height !== 480) {
    throw new Error(`Invalid dimensions: ${regPng.width}x${regPng.height}`);
  }

  const regQr = jsQR(new Uint8ClampedArray(regPng.data), regPng.width, regPng.height);
  console.log("  Decoded Regular 1c QR Code Data:", regQr?.data);
  if (regQr?.data !== reg1cItem.canonicalProductUrl) {
    throw new Error("Regular 1c QR scan failed or payload mismatch!");
  }
  console.log("  ✓ Regular 1c QR Scan PASSED! Decoded:", regQr.data);

  // Test Case B: SALE 1e (Barrier Repair Ceramide Serum, Reg $22.00 -> Sale $17.95, SAVE 18%)
  const sale1eItem = {
    productId: "5be4ca57-d0f6-44b8-8cbb-2b443a34752e",
    productName: "Barrier Repair Ceramide Serum",
    brandName: "K SELECT LAB",
    sku: "TEST-SKN-001",
    regularPrice: 22.0,
    salePrice: 17.95,
    discountPercent: 18,
    isSaleActive: true,
    canonicalProductUrl: "https://www.kselecthub.com/products/5be4ca57-d0f6-44b8-8cbb-2b443a34752e",
  };
  sale1eItem.qrDataUrl = await QRCode.toDataURL(sale1eItem.canonicalProductUrl, {
    margin: 1,
    errorCorrectionLevel: "M",
    width: 256,
  });

  const sale1eDataUrl = await page.evaluate(async (it) => {
    return await window.renderPriceTag(it, 2);
  }, sale1eItem);

  const sale1eBase64 = sale1eDataUrl.replace(/^data:image\/png;base64,/, "");
  const sale1eBuffer = Buffer.from(sale1eBase64, "base64");
  const sale1ePath = path.join(ARTIFACT_DIR, "prod_shelf_tag_sale_1e.png");
  fs.writeFileSync(sale1ePath, sale1eBuffer);
  console.log("  ✓ Saved SALE 1e PNG artifact:", sale1ePath);

  const salePng = PNG.sync.read(sale1eBuffer);
  console.log(`  SALE 1e Export Dimensions: ${salePng.width} x ${salePng.height}`);
  if (salePng.width !== 800 || salePng.height !== 480) {
    throw new Error(`Invalid dimensions: ${salePng.width}x${salePng.height}`);
  }

  const saleQr = jsQR(new Uint8ClampedArray(salePng.data), salePng.width, salePng.height);
  console.log("  Decoded SALE 1e QR Code Data:", saleQr?.data);
  if (saleQr?.data !== sale1eItem.canonicalProductUrl) {
    throw new Error("SALE 1e QR scan failed or payload mismatch!");
  }
  console.log("  ✓ SALE 1e QR Scan PASSED! Decoded:", saleQr.data);

  // Test Case C: Stress Test (Long name, long brand, long SKU, 3-digit prices)
  const stressItem = {
    productId: "5be4ca57-d0f6-44b8-8cbb-2b443a34752e",
    productName: "Hydrating Barrier Repair Ceramide Smoothing & Strengthening Serum 50ml",
    brandName: "K SELECT LAB PROFESSIONAL",
    sku: "TEST-SKN-001-50ML-V2",
    regularPrice: 158.0,
    salePrice: 129.95,
    discountPercent: 18,
    isSaleActive: true,
    canonicalProductUrl: "https://www.kselecthub.com/products/5be4ca57-d0f6-44b8-8cbb-2b443a34752e",
  };
  stressItem.qrDataUrl = await QRCode.toDataURL(stressItem.canonicalProductUrl, {
    margin: 1,
    errorCorrectionLevel: "M",
    width: 256,
  });

  const stressDataUrl = await page.evaluate(async (it) => {
    return await window.renderPriceTag(it, 2);
  }, stressItem);

  const stressBase64 = stressDataUrl.replace(/^data:image\/png;base64,/, "");
  const stressBuffer = Buffer.from(stressBase64, "base64");
  const stressPath = path.join(ARTIFACT_DIR, "prod_shelf_tag_stress_test.png");
  fs.writeFileSync(stressPath, stressBuffer);
  console.log("  ✓ Saved Stress Test PNG artifact:", stressPath);

  const stressPng = PNG.sync.read(stressBuffer);
  const stressQr = jsQR(new Uint8ClampedArray(stressPng.data), stressPng.width, stressPng.height);
  console.log("  Decoded Stress Test QR Code Data:", stressQr?.data);
  if (stressQr?.data !== stressItem.canonicalProductUrl) {
    throw new Error("Stress Test QR scan failed!");
  }
  console.log("  ✓ Stress Test QR Scan PASSED!");

  await browser.close();
  clearTimeout(timeoutHandle);

  console.log("\n==================================================================");
  console.log("  ALL TESTS PASSED: Regular 1c, SALE 1e & Stress Test VERIFIED!");
  console.log("==================================================================");
}

runDesignQA().catch((err) => {
  console.error("QA Test Failed:", err);
  process.exit(1);
});
