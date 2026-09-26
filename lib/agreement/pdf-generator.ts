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

/**
 * Generates an immutable, archival Final Executed Agreement PDF from v1.0 template.
 * Overlays Company & Signer details, typed electronic signature, dates, and execution record.
 */
export async function generateExecutedAgreementPdf(data: ExecutedAgreementPdfData): Promise<{
  pdfBuffer: Buffer;
  pdfHash: string;
}> {
  // Resolve paths for template PDF & fonts
  const templatePath = path.join(process.cwd(), "private_assets/agreements/template_v1.pdf");
  const fontRegularPath = path.join(process.cwd(), "private_assets/fonts/NotoSansKR-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "private_assets/fonts/NotoSansKR-Bold.ttf");

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const fontRegularBytes = fs.readFileSync(fontRegularPath);
  const fontBoldBytes = fs.readFileSync(fontBoldPath);

  const krFont = await pdfDoc.embedFont(fontRegularBytes);
  const krBoldFont = await pdfDoc.embedFont(fontBoldBytes);

  const textColor = rgb(0.1, 0.1, 0.1);
  const signatureColor = rgb(0.05, 0.15, 0.5);

  // --- PAGE 1 OVERLAY ---
  const page1 = pdfDoc.getPage(0);
  const companyInfoText = data.companyName + (data.representativeName ? ` (대표자: ${data.representativeName})` : "");
  page1.drawText(companyInfoText, { x: 145, y: 658, size: 9.5, font: krFont, color: textColor });
  page1.drawText(data.companyAddress || "-", { x: 145, y: 598, size: 9, font: krFont, color: textColor });
  if (data.representativeName) {
    page1.drawText(data.representativeName, { x: 145, y: 540, size: 9.5, font: krFont, color: textColor });
  }

  // --- FOOTER OVERLAY (Pages 1 - 5) ---
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    page.drawText(data.version || "1.0", { x: 142, y: 26, size: 9, font: krBoldFont, color: textColor });
  }

  // --- PAGE 5 OVERLAY ---
  const page5 = pdfDoc.getPage(4);

  // Left Box: 공급사
  page5.drawText(data.companyName, { x: 145, y: 444, size: 10, font: krFont, color: textColor });
  page5.drawText(data.signerName, { x: 145, y: 390, size: 10, font: krFont, color: textColor });
  page5.drawText(data.signerTitle || "대표자 / 서명자", { x: 145, y: 356, size: 10, font: krFont, color: textColor });

  // Typed Electronic Signature in Signature Box
  const sigText = data.signerName;
  page5.drawText(sigText, { x: 155, y: 295, size: 13, font: krBoldFont, color: signatureColor });

  // Dates (Brand Date = Letusto Date = Executed Date)
  page5.drawText(data.executedDate, { x: 145, y: 248, size: 10, font: krFont, color: textColor });
  page5.drawText(data.executedDate, { x: 420, y: 248, size: 10, font: krFont, color: textColor });

  // Electronic Execution Record Table
  page5.drawText(data.version || "1.0", { x: 205, y: 148, size: 9, font: krFont, color: textColor });
  page5.drawText(data.agreementId, { x: 300, y: 148, size: 9, font: krFont, color: textColor });
  page5.drawText(data.executedDate, { x: 485, y: 148, size: 9, font: krFont, color: textColor });

  const pdfUint8 = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfUint8);

  // Compute SHA-256 hash checksum
  const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return { pdfBuffer, pdfHash };
}
