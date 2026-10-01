const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const TEMPLATE_V1_CONFIG = {
  page1: {
    companyName: { field: "companyName", pageIndex: 0, x: 142, y: 609, maxWidth: 138, fontSize: 9.5, fontType: "bold" },
    companyAddress: { field: "companyAddress", pageIndex: 0, x: 142, y: 568, maxWidth: 138, fontSize: 8.5, lineHeight: 11, maxLines: 2, fontType: "regular" },
    representativeName: { field: "representativeName", pageIndex: 0, x: 142, y: 518, maxWidth: 138, fontSize: 9.5, fontType: "regular" },
  },
  page5: {
    companyName: { field: "companyName", pageIndex: 4, x: 142, y: 432, maxWidth: 138, fontSize: 9.5, fontType: "bold" },
    signerName: { field: "signerName", pageIndex: 4, x: 142, y: 382, maxWidth: 138, fontSize: 9.5, fontType: "regular" },
    signerTitle: { field: "signerTitle", pageIndex: 4, x: 142, y: 348, maxWidth: 138, fontSize: 9.5, fontType: "regular" },
    signatureBox: { field: "signatureBox", pageIndex: 4, x: 145, y: 288, maxWidth: 125, fontSize: 22, fontType: "script" },
    brandDate: { field: "brandDate", pageIndex: 4, x: 142, y: 240, fontSize: 9.5, fontType: "regular" },
    letustoDate: { field: "letustoDate", pageIndex: 4, x: 415, y: 240, fontSize: 9.5, fontType: "regular" },
  },
  executionRecord: {
    executedVia: { field: "executedVia", pageIndex: 4, x: 102, y: 174, fontSize: 8.5, fontType: "bold" },
    version: { field: "version", pageIndex: 4, x: 245, y: 174, fontSize: 8.5, fontType: "regular" },
    agreementId: { field: "agreementId", pageIndex: 4, x: 325, y: 174, fontSize: 8.5, fontType: "bold" },
    executedDate: { field: "executedDate", pageIndex: 4, x: 485, y: 174, fontSize: 8.5, fontType: "regular" },
  },
  footerVersion: { x: 142, y: 25, fontSize: 8.5 },
};

function wrapAndFitText(text, font, initialFontSize, maxWidth, maxLines = 2) {
  if (!text) return { lines: [], fontSize: initialFontSize };

  let fontSize = initialFontSize;
  const minFontSize = 7.0;

  while (fontSize >= minFontSize) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    if (textWidth <= maxWidth) {
      return { lines: [text], fontSize };
    }

    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;

        if (lines.length === maxLines - 1) {
          const remaining = words.slice(i).join(" ");
          const remWidth = font.widthOfTextAtSize(remaining, fontSize);
          if (remWidth <= maxWidth) {
            lines.push(remaining);
            currentLine = "";
            break;
          }
        }
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    if (lines.length <= maxLines) {
      const allFit = lines.every((l) => font.widthOfTextAtSize(l, fontSize) <= maxWidth);
      if (allFit) {
        return { lines, fontSize };
      }
    }

    fontSize -= 0.5;
  }

  return {
    lines: [text.substring(0, Math.floor(text.length / 2)), text.substring(Math.floor(text.length / 2))],
    fontSize: minFontSize,
  };
}

async function testPdfGenerator() {
  const templatePath = path.join(process.cwd(), "private_assets/agreements/template_v1.pdf");
  const fontKrPath = path.join(process.cwd(), "private_assets/fonts/NotoSansKR-Regular.ttf");
  const fontKrBoldPath = path.join(process.cwd(), "private_assets/fonts/NotoSansKR-Bold.ttf");
  const fontScriptPath = path.join(process.cwd(), "private_assets/fonts/AlexBrush-Regular.ttf");

  const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
  pdfDoc.registerFontkit(fontkit);

  const krFont = await pdfDoc.embedFont(fs.readFileSync(fontKrPath));
  const krBoldFont = await pdfDoc.embedFont(fs.readFileSync(fontKrBoldPath));
  const scriptFont = await pdfDoc.embedFont(fs.readFileSync(fontScriptPath));

  const sampleData = {
    agreementId: "KSN-AGR-2026-000001",
    version: "1.0",
    companyName: "Brands Global Inc.",
    companyAddress: "225 kangnam Dae ro 2FL, Seoul, Seoul (060223)",
    representativeName: "Tammy Hahm",
    signerName: "Tammy Hahm",
    signerTitle: "대표이사 (CEO)",
    signerEmail: "account@letusto.com",
    executedDate: "2026-09-26",
  };

  const textColor = rgb(0.12, 0.12, 0.14);
  const sigColor = rgb(0.05, 0.12, 0.42);

  // --- PAGE 1 ---
  const page1 = pdfDoc.getPage(TEMPLATE_V1_CONFIG.page1.companyName.pageIndex);

  // 1. Company Name ONLY
  page1.drawText(sampleData.companyName, {
    x: TEMPLATE_V1_CONFIG.page1.companyName.x,
    y: TEMPLATE_V1_CONFIG.page1.companyName.y,
    size: TEMPLATE_V1_CONFIG.page1.companyName.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  // 2. Company Address (Wrapped up to 2 lines)
  const addrConfig = TEMPLATE_V1_CONFIG.page1.companyAddress;
  const { lines: addrLines, fontSize: addrFontSize } = wrapAndFitText(
    sampleData.companyAddress,
    krFont,
    addrConfig.fontSize,
    addrConfig.maxWidth,
    addrConfig.maxLines
  );

  if (addrLines.length === 1) {
    page1.drawText(addrLines[0], {
      x: addrConfig.x,
      y: addrConfig.y,
      size: addrFontSize,
      font: krFont,
      color: textColor,
    });
  } else {
    const lineSpacing = addrConfig.lineHeight || 11;
    page1.drawText(addrLines[0], {
      x: addrConfig.x,
      y: addrConfig.y + 4,
      size: addrFontSize,
      font: krFont,
      color: textColor,
    });
    page1.drawText(addrLines[1], {
      x: addrConfig.x,
      y: addrConfig.y + 4 - lineSpacing,
      size: addrFontSize,
      font: krFont,
      color: textColor,
    });
  }

  // 3. Representative Name
  if (sampleData.representativeName) {
    page1.drawText(sampleData.representativeName, {
      x: TEMPLATE_V1_CONFIG.page1.representativeName.x,
      y: TEMPLATE_V1_CONFIG.page1.representativeName.y,
      size: TEMPLATE_V1_CONFIG.page1.representativeName.fontSize,
      font: krFont,
      color: textColor,
    });
  }

  // --- PAGE 5 ---
  const page5 = pdfDoc.getPage(TEMPLATE_V1_CONFIG.page5.companyName.pageIndex);

  // Left Box: 공급사
  page5.drawText(sampleData.companyName, {
    x: TEMPLATE_V1_CONFIG.page5.companyName.x,
    y: TEMPLATE_V1_CONFIG.page5.companyName.y,
    size: TEMPLATE_V1_CONFIG.page5.companyName.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  page5.drawText(sampleData.signerName, {
    x: TEMPLATE_V1_CONFIG.page5.signerName.x,
    y: TEMPLATE_V1_CONFIG.page5.signerName.y,
    size: TEMPLATE_V1_CONFIG.page5.signerName.fontSize,
    font: krFont,
    color: textColor,
  });

  page5.drawText(sampleData.signerTitle, {
    x: TEMPLATE_V1_CONFIG.page5.signerTitle.x,
    y: TEMPLATE_V1_CONFIG.page5.signerTitle.y,
    size: TEMPLATE_V1_CONFIG.page5.signerTitle.fontSize,
    font: krFont,
    color: textColor,
  });

  // Typed Cursive Electronic Signature
  const sigConfig = TEMPLATE_V1_CONFIG.page5.signatureBox;
  let sigFontSize = sigConfig.fontSize || 22;
  const maxSigWidth = sigConfig.maxWidth || 125;
  let sigTextWidth = scriptFont.widthOfTextAtSize(sampleData.signerName, sigFontSize);
  if (sigTextWidth > maxSigWidth) {
    sigFontSize = Math.max(14, sigFontSize * (maxSigWidth / sigTextWidth));
  }
  page5.drawText(sampleData.signerName, {
    x: sigConfig.x,
    y: sigConfig.y,
    size: sigFontSize,
    font: scriptFont,
    color: sigColor,
  });

  // Brand Date & Letusto Date
  page5.drawText(sampleData.executedDate, {
    x: TEMPLATE_V1_CONFIG.page5.brandDate.x,
    y: TEMPLATE_V1_CONFIG.page5.brandDate.y,
    size: TEMPLATE_V1_CONFIG.page5.brandDate.fontSize,
    font: krFont,
    color: textColor,
  });

  page5.drawText(sampleData.executedDate, {
    x: TEMPLATE_V1_CONFIG.page5.letustoDate.x,
    y: TEMPLATE_V1_CONFIG.page5.letustoDate.y,
    size: TEMPLATE_V1_CONFIG.page5.letustoDate.fontSize,
    font: krFont,
    color: textColor,
  });

  // Electronic Execution Record Table
  const execRec = TEMPLATE_V1_CONFIG.executionRecord;
  page5.drawText("K SELECT NETWORK", {
    x: execRec.executedVia.x,
    y: execRec.executedVia.y,
    size: execRec.executedVia.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  page5.drawText(sampleData.version || "1.0", {
    x: execRec.version.x,
    y: execRec.version.y,
    size: execRec.version.fontSize,
    font: krFont,
    color: textColor,
  });

  page5.drawText(sampleData.agreementId, {
    x: execRec.agreementId.x,
    y: execRec.agreementId.y,
    size: execRec.agreementId.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  page5.drawText(sampleData.executedDate, {
    x: execRec.executedDate.x,
    y: execRec.executedDate.y,
    size: execRec.executedDate.fontSize,
    font: krFont,
    color: textColor,
  });

  // Footer Agreement Version on all pages
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    p.drawText(sampleData.version || "1.0", {
      x: TEMPLATE_V1_CONFIG.footerVersion.x,
      y: TEMPLATE_V1_CONFIG.footerVersion.y,
      size: TEMPLATE_V1_CONFIG.footerVersion.fontSize,
      font: krBoldFont,
      color: textColor,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(process.cwd(), "scratch/test_executed_r6.pdf");
  fs.writeFileSync(outPath, pdfBytes);
  console.log("Successfully generated test PDF r6!");
}

testPdfGenerator().catch(console.error);
