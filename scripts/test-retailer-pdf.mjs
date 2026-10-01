import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const RETAILER_TEMPLATE_V1_CONFIG = {
  page1: {
    companyName: {
      pageIndex: 0,
      x: 48,
      y: 627,
      maxWidth: 230,
      fontSize: 9.5,
      fontType: "bold",
    },
    companyAddress: {
      pageIndex: 0,
      x: 48,
      y: 576,
      maxWidth: 230,
      fontSize: 8.5,
      lineHeight: 12,
      maxLines: 2,
      fontType: "regular",
    },
    representativeName: {
      pageIndex: 0,
      x: 48,
      y: 508,
      maxWidth: 230,
      fontSize: 9.5,
      fontType: "regular",
    },
  },
  page6: {
    companyName: {
      pageIndex: 5,
      x: 65,
      y: 592,
      maxWidth: 200,
      fontSize: 9.5,
      fontType: "bold",
    },
    signerName: {
      pageIndex: 5,
      x: 65,
      y: 538,
      maxWidth: 200,
      fontSize: 9.5,
      fontType: "regular",
    },
    signerTitle: {
      pageIndex: 5,
      x: 65,
      y: 483,
      maxWidth: 200,
      fontSize: 9.5,
      fontType: "regular",
    },
    signatureBox: {
      pageIndex: 5,
      x: 70,
      y: 395,
      maxWidth: 180,
      fontSize: 26,
      fontType: "script",
      color: { r: 0.05, g: 0.12, b: 0.42 },
    },
    retailerDate: {
      pageIndex: 5,
      x: 65,
      y: 325,
      fontSize: 9.5,
      fontType: "regular",
    },
    letustoDate: {
      pageIndex: 5,
      x: 324,
      y: 325,
      fontSize: 9.5,
      fontType: "regular",
    },
    executionRecord: {
      executedVia: {
        pageIndex: 5,
        x: 60,
        y: 226,
        fontSize: 7.5,
        fontType: "bold",
      },
      version: {
        pageIndex: 5,
        x: 160,
        y: 226,
        fontSize: 8.5,
        fontType: "regular",
      },
      agreementId: {
        pageIndex: 5,
        x: 245,
        y: 226,
        fontSize: 8.5,
        fontType: "bold",
      },
      executedDate: {
        pageIndex: 5,
        x: 460,
        y: 226,
        fontSize: 8.5,
        fontType: "regular",
      },
    },
  },
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

export async function generateExecutedRetailerPdf(data) {
  const templatePath = path.join(process.cwd(), "private_assets/agreements/retailer_template_v1.pdf");
  const fontScriptPath = path.join(process.cwd(), "private_assets/fonts/AlexBrush-Regular.ttf");

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  // Use Helvetica / HelveticaBold for crisp standard rendering
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const scriptFont = await pdfDoc.embedFont(fs.readFileSync(fontScriptPath));

  const textColor = rgb(0.12, 0.12, 0.14);
  const sigColor = rgb(0.05, 0.12, 0.42);

  const cfg = RETAILER_TEMPLATE_V1_CONFIG;

  // Page 1
  const page1 = pdfDoc.getPage(cfg.page1.companyName.pageIndex);
  page1.drawText(data.companyName, {
    x: cfg.page1.companyName.x,
    y: cfg.page1.companyName.y,
    size: cfg.page1.companyName.fontSize,
    font: fontBold,
    color: textColor,
  });

  const addrConfig = cfg.page1.companyAddress;
  const { lines: addrLines, fontSize: addrFontSize } = wrapAndFitText(
    data.companyAddress || "-",
    fontRegular,
    addrConfig.fontSize,
    addrConfig.maxWidth,
    addrConfig.maxLines
  );

  if (addrLines.length === 1) {
    page1.drawText(addrLines[0], {
      x: addrConfig.x,
      y: addrConfig.y,
      size: addrFontSize,
      font: fontRegular,
      color: textColor,
    });
  } else if (addrLines.length > 1) {
    const lineSpacing = addrConfig.lineHeight;
    page1.drawText(addrLines[0], {
      x: addrConfig.x,
      y: addrConfig.y + 4,
      size: addrFontSize,
      font: fontRegular,
      color: textColor,
    });
    page1.drawText(addrLines[1], {
      x: addrConfig.x,
      y: addrConfig.y + 4 - lineSpacing,
      size: addrFontSize,
      font: fontRegular,
      color: textColor,
    });
  }

  if (data.representativeName) {
    page1.drawText(data.representativeName, {
      x: cfg.page1.representativeName.x,
      y: cfg.page1.representativeName.y,
      size: cfg.page1.representativeName.fontSize,
      font: fontRegular,
      color: textColor,
    });
  }

  // Page 6
  const page6 = pdfDoc.getPage(cfg.page6.companyName.pageIndex);

  page6.drawText(data.companyName, {
    x: cfg.page6.companyName.x,
    y: cfg.page6.companyName.y,
    size: cfg.page6.companyName.fontSize,
    font: fontBold,
    color: textColor,
  });

  page6.drawText(data.signerName, {
    x: cfg.page6.signerName.x,
    y: cfg.page6.signerName.y,
    size: cfg.page6.signerName.fontSize,
    font: fontRegular,
    color: textColor,
  });

  page6.drawText(data.signerTitle || "Representative", {
    x: cfg.page6.signerTitle.x,
    y: cfg.page6.signerTitle.y,
    size: cfg.page6.signerTitle.fontSize,
    font: fontRegular,
    color: textColor,
  });

  // Typed Cursive Signature
  const sigConfig = cfg.page6.signatureBox;
  let sigFontSize = sigConfig.fontSize;
  const maxSigWidth = sigConfig.maxWidth;
  let sigTextWidth = scriptFont.widthOfTextAtSize(data.signerName, sigFontSize);
  if (sigTextWidth > maxSigWidth) {
    sigFontSize = Math.max(16, sigFontSize * (maxSigWidth / sigTextWidth));
  }
  page6.drawText(data.signerName, {
    x: sigConfig.x,
    y: sigConfig.y,
    size: sigFontSize,
    font: scriptFont,
    color: sigColor,
  });

  // Dates
  page6.drawText(data.executedDate, {
    x: cfg.page6.retailerDate.x,
    y: cfg.page6.retailerDate.y,
    size: cfg.page6.retailerDate.fontSize,
    font: fontRegular,
    color: textColor,
  });

  page6.drawText(data.executedDate, {
    x: cfg.page6.letustoDate.x,
    y: cfg.page6.letustoDate.y,
    size: cfg.page6.letustoDate.fontSize,
    font: fontRegular,
    color: textColor,
  });

  // Execution Record
  const execRec = cfg.page6.executionRecord;
  page6.drawText("K SELECT NETWORK", {
    x: execRec.executedVia.x,
    y: execRec.executedVia.y,
    size: execRec.executedVia.fontSize,
    font: fontBold,
    color: textColor,
  });

  page6.drawText(data.version || "1.0", {
    x: execRec.version.x,
    y: execRec.version.y,
    size: execRec.version.fontSize,
    font: fontRegular,
    color: textColor,
  });

  page6.drawText(data.agreementId, {
    x: execRec.agreementId.x,
    y: execRec.agreementId.y,
    size: execRec.agreementId.fontSize,
    font: fontBold,
    color: textColor,
  });

  page6.drawText(data.executedDate, {
    x: execRec.executedDate.x,
    y: execRec.executedDate.y,
    size: execRec.executedDate.fontSize,
    font: fontRegular,
    color: textColor,
  });

  const pdfUint8 = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfUint8);
  const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return { pdfBuffer, pdfHash };
}

async function main() {
  const sampleData = {
    agreementId: "KSN-AGR-PRM-26-X8M2",
    version: "1.0",
    companyName: "Prime Beauty Wholesale & Retail LLC",
    companyAddress: "789 Michigan Ave, Suite 400, Chicago, IL 60611 USA",
    representativeName: "Sarah Jenkins",
    signerName: "Sarah Jenkins",
    signerTitle: "Managing Director & CEO",
    signerEmail: "sarah.jenkins@primebeauty.com",
    executedDate: "2026-09-26",
  };

  const { pdfBuffer, pdfHash } = await generateExecutedRetailerPdf(sampleData);
  const outPdf = path.join(process.cwd(), "scratch/test_executed_retailer.pdf");
  fs.writeFileSync(outPdf, pdfBuffer);
  console.log(`Saved PDF to ${outPdf} (Hash: ${pdfHash})`);
}

main().catch(console.error);
