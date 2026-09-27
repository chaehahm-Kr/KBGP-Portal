import "server-only";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ExecutedAgreementPdfData {
  agreementId: string;
  version: string;
  companyName: string;
  companyAddress: string;
  representativeName?: string | null;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  executedDate: string; // YYYY-MM-DD
}

export interface PdfFieldOverlayConfig {
  field: string;
  pageIndex: number; // 0-indexed (0 = Page 1, 4 = Page 5)
  x: number;
  y: number;
  maxWidth?: number;
  fontSize?: number;
  lineHeight?: number;
  maxLines?: number;
  fontType?: "regular" | "bold" | "script";
  color?: { r: number; g: number; b: number };
}

/**
 * Reusable template field coordinate configuration.
 * Designed for precise overlay alignment on v1.0 Agreement PDF template.
 */
export const TEMPLATE_V1_CONFIG = {
  page1: {
    companyName: {
      field: "companyName",
      pageIndex: 0,
      x: 142,
      y: 624,
      maxWidth: 138,
      fontSize: 9.5,
      fontType: "bold" as const,
    },
    companyAddress: {
      field: "companyAddress",
      pageIndex: 0,
      x: 142,
      y: 584,
      maxWidth: 138,
      fontSize: 8.5,
      lineHeight: 12,
      maxLines: 2,
      fontType: "regular" as const,
    },
    representativeName: {
      field: "representativeName",
      pageIndex: 0,
      x: 142,
      y: 536,
      maxWidth: 138,
      fontSize: 9.5,
      fontType: "regular" as const,
    },
  },
  page5: {
    companyName: {
      field: "companyName",
      pageIndex: 4,
      x: 142,
      y: 444,
      maxWidth: 138,
      fontSize: 9.5,
      fontType: "bold" as const,
    },
    signerName: {
      field: "signerName",
      pageIndex: 4,
      x: 142,
      y: 390,
      maxWidth: 138,
      fontSize: 9.5,
      fontType: "regular" as const,
    },
    signerTitle: {
      field: "signerTitle",
      pageIndex: 4,
      x: 142,
      y: 356,
      maxWidth: 138,
      fontSize: 9.5,
      fontType: "regular" as const,
    },
    signatureBox: {
      field: "signatureBox",
      pageIndex: 4,
      x: 145,
      y: 304,
      maxWidth: 125,
      fontSize: 22,
      fontType: "script" as const,
      color: { r: 0.05, g: 0.12, b: 0.42 },
    },
    brandDate: {
      field: "brandDate",
      pageIndex: 4,
      x: 142,
      y: 248,
      fontSize: 9.5,
      fontType: "regular" as const,
    },
    letustoDate: {
      field: "letustoDate",
      pageIndex: 4,
      x: 415,
      y: 248,
      fontSize: 9.5,
      fontType: "regular" as const,
    },
  },
  executionRecord: {
    executedVia: {
      field: "executedVia",
      pageIndex: 4,
      x: 102,
      y: 178,
      fontSize: 8.5,
      fontType: "bold" as const,
    },
    version: {
      field: "version",
      pageIndex: 4,
      x: 245,
      y: 178,
      fontSize: 8.5,
      fontType: "regular" as const,
    },
    agreementId: {
      field: "agreementId",
      pageIndex: 4,
      x: 325,
      y: 178,
      fontSize: 8.5,
      fontType: "bold" as const,
    },
    executedDate: {
      field: "executedDate",
      pageIndex: 4,
      x: 485,
      y: 178,
      fontSize: 8.5,
      fontType: "regular" as const,
    },
  },
  footerVersion: {
    x: 142,
    y: 25,
    fontSize: 8.5,
  },
};

/**
 * Wraps text into up to maxLines using font width measurement.
 * Adjusts font size dynamically to ensure text stays within maxWidth without clipping.
 */
function wrapAndFitText(
  text: string,
  font: any,
  initialFontSize: number,
  maxWidth: number,
  maxLines: number = 2
): { lines: string[]; fontSize: number } {
  if (!text) return { lines: [], fontSize: initialFontSize };

  let fontSize = initialFontSize;
  const minFontSize = 7.0;

  while (fontSize >= minFontSize) {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    if (textWidth <= maxWidth) {
      return { lines: [text], fontSize };
    }

    const words = text.split(" ");
    const lines: string[] = [];
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

/**
 * Generates an immutable, archival Final Executed Agreement PDF from v1.0 template.
 * Overlays Company & Signer details, typed electronic signature, dates, and execution record.
 */
export async function generateExecutedAgreementPdf(data: ExecutedAgreementPdfData): Promise<{
  pdfBuffer: Buffer;
  pdfHash: string;
}> {
  // Resolve asset paths
  const templatePath = path.join(process.cwd(), "private_assets/agreements/template_v1.pdf");
  const fontRegularPath = path.join(process.cwd(), "private_assets/fonts/NotoSansKR-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "private_assets/fonts/NotoSansKR-Bold.ttf");
  const fontScriptPath = path.join(process.cwd(), "private_assets/fonts/AlexBrush-Regular.ttf");

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const krFont = await pdfDoc.embedFont(fs.readFileSync(fontRegularPath));
  const krBoldFont = await pdfDoc.embedFont(fs.readFileSync(fontBoldPath));
  const scriptFont = await pdfDoc.embedFont(fs.readFileSync(fontScriptPath));

  const textColor = rgb(0.12, 0.12, 0.14);
  const sigColor = rgb(0.05, 0.12, 0.42); // Professional dark navy

  // --- PAGE 1 OVERLAY ---
  const page1 = pdfDoc.getPage(TEMPLATE_V1_CONFIG.page1.companyName.pageIndex);

  // 1. Company Name ONLY in Company Name field
  page1.drawText(data.companyName, {
    x: TEMPLATE_V1_CONFIG.page1.companyName.x,
    y: TEMPLATE_V1_CONFIG.page1.companyName.y,
    size: TEMPLATE_V1_CONFIG.page1.companyName.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  // 2. Company Address (Wrapped up to 2 lines)
  const addrConfig = TEMPLATE_V1_CONFIG.page1.companyAddress;
  const { lines: addrLines, fontSize: addrFontSize } = wrapAndFitText(
    data.companyAddress || "-",
    krFont,
    addrConfig.fontSize || 8.5,
    addrConfig.maxWidth || 138,
    addrConfig.maxLines || 2
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
    const lineSpacing = addrConfig.lineHeight || 12;
    page1.drawText(addrLines[0], {
      x: addrConfig.x,
      y: addrConfig.y + 5,
      size: addrFontSize,
      font: krFont,
      color: textColor,
    });
    page1.drawText(addrLines[1], {
      x: addrConfig.x,
      y: addrConfig.y + 5 - lineSpacing,
      size: addrFontSize,
      font: krFont,
      color: textColor,
    });
  }

  // 3. Representative Name ONLY in Representative field
  if (data.representativeName) {
    page1.drawText(data.representativeName, {
      x: TEMPLATE_V1_CONFIG.page1.representativeName.x,
      y: TEMPLATE_V1_CONFIG.page1.representativeName.y,
      size: TEMPLATE_V1_CONFIG.page1.representativeName.fontSize,
      font: krFont,
      color: textColor,
    });
  }

  // --- FOOTER OVERLAY (Pages 1 - 5) ---
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    p.drawText(data.version || "1.0", {
      x: TEMPLATE_V1_CONFIG.footerVersion.x,
      y: TEMPLATE_V1_CONFIG.footerVersion.y,
      size: TEMPLATE_V1_CONFIG.footerVersion.fontSize,
      font: krBoldFont,
      color: textColor,
    });
  }

  // --- PAGE 5 OVERLAY ---
  const page5 = pdfDoc.getPage(TEMPLATE_V1_CONFIG.page5.companyName.pageIndex);

  // Left Box: 공급사
  page5.drawText(data.companyName, {
    x: TEMPLATE_V1_CONFIG.page5.companyName.x,
    y: TEMPLATE_V1_CONFIG.page5.companyName.y,
    size: TEMPLATE_V1_CONFIG.page5.companyName.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  page5.drawText(data.signerName, {
    x: TEMPLATE_V1_CONFIG.page5.signerName.x,
    y: TEMPLATE_V1_CONFIG.page5.signerName.y,
    size: TEMPLATE_V1_CONFIG.page5.signerName.fontSize,
    font: krFont,
    color: textColor,
  });

  page5.drawText(data.signerTitle || "대표자 / 서명자", {
    x: TEMPLATE_V1_CONFIG.page5.signerTitle.x,
    y: TEMPLATE_V1_CONFIG.page5.signerTitle.y,
    size: TEMPLATE_V1_CONFIG.page5.signerTitle.fontSize,
    font: krFont,
    color: textColor,
  });

  // Typed Cursive Electronic Signature (AlexBrush-Regular)
  const sigConfig = TEMPLATE_V1_CONFIG.page5.signatureBox;
  let sigFontSize = sigConfig.fontSize || 22;
  const maxSigWidth = sigConfig.maxWidth || 125;
  let sigTextWidth = scriptFont.widthOfTextAtSize(data.signerName, sigFontSize);
  if (sigTextWidth > maxSigWidth) {
    sigFontSize = Math.max(14, sigFontSize * (maxSigWidth / sigTextWidth));
  }
  page5.drawText(data.signerName, {
    x: sigConfig.x,
    y: sigConfig.y,
    size: sigFontSize,
    font: scriptFont,
    color: sigColor,
  });

  // Brand Date & Letusto Date
  page5.drawText(data.executedDate, {
    x: TEMPLATE_V1_CONFIG.page5.brandDate.x,
    y: TEMPLATE_V1_CONFIG.page5.brandDate.y,
    size: TEMPLATE_V1_CONFIG.page5.brandDate.fontSize,
    font: krFont,
    color: textColor,
  });

  page5.drawText(data.executedDate, {
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

  page5.drawText(data.version || "1.0", {
    x: execRec.version.x,
    y: execRec.version.y,
    size: execRec.version.fontSize,
    font: krFont,
    color: textColor,
  });

  // Agreement ID drawn as single continuous string without letter spacing
  page5.drawText(data.agreementId, {
    x: execRec.agreementId.x,
    y: execRec.agreementId.y,
    size: execRec.agreementId.fontSize,
    font: krBoldFont,
    color: textColor,
  });

  page5.drawText(data.executedDate, {
    x: execRec.executedDate.x,
    y: execRec.executedDate.y,
    size: execRec.executedDate.fontSize,
    font: krFont,
    color: textColor,
  });

  const pdfUint8 = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfUint8);

  // Compute SHA-256 hash checksum
  const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return { pdfBuffer, pdfHash };
}
