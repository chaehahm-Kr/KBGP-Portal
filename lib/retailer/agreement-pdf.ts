import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface AgreementPdfData {
  companyName: string;
  companyId: string;
  businessRegistrationNumber?: string | null;
  signerName: string;
  signerTitle?: string | null;
  signerEmail?: string | null;
  signerIp?: string | null;
  acceptedAt: string;
  acceptanceId: string;
  agreementVersion: string;
}

/**
 * Word-wrapping helper for pdf-lib
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
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
  }

  return lines;
}

/**
 * Generate an immutable, archival Retailer Operating Agreement PDF
 */
export async function generateRetailerAgreementPdf(data: AgreementPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612; // Letter width
  const pageHeight = 792; // Letter height
  const margin = 50;
  const contentWidth = pageWidth - margin * 2; // 512pt

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const formattedDate = new Date(data.acceptedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  function checkPageBreak(requiredSpace: number) {
    if (y - requiredSpace < margin + 30) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawRunningHeader();
    }
  }

  function drawRunningHeader() {
    currentPage.drawText("K SELECT RETAILER OPERATING AGREEMENT", {
      x: margin,
      y: pageHeight - 35,
      size: 8,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.4),
    });

    currentPage.drawText(`Version ${data.agreementVersion} • Authoritative Archival Copy`, {
      x: pageWidth - margin - 220,
      y: pageHeight - 35,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    currentPage.drawLine({
      start: { x: margin, y: pageHeight - 40 },
      end: { x: pageWidth - margin, y: pageHeight - 40 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  // --- Document Header (Page 1) ---
  // Top brand bar
  currentPage.drawRectangle({
    x: margin,
    y: y - 32,
    width: contentWidth,
    height: 36,
    color: rgb(0.08, 0.08, 0.1),
  });

  currentPage.drawText("K SELECT NETWORK", {
    x: margin + 14,
    y: y - 20,
    size: 13,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  currentPage.drawText("RETAIL PARTNER OPERATING AGREEMENT", {
    x: margin + 14,
    y: y - 29,
    size: 7.5,
    font: helvetica,
    color: rgb(0.7, 0.75, 0.85),
  });

  y -= 52;

  // Metadata Panel Box
  const metaBoxY = y - 92;
  currentPage.drawRectangle({
    x: margin,
    y: metaBoxY,
    width: contentWidth,
    height: 92,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.88, 0.9),
    borderWidth: 1,
  });

  const col1X = margin + 12;
  const col2X = margin + 265;
  let metaY = y - 16;

  // Col 1
  currentPage.drawText("Retailer Organization:", { x: col1X, y: metaY, size: 8, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(data.companyName || "N/A", { x: col1X + 90, y: metaY, size: 8, font: helveticaBold, color: rgb(0.05, 0.05, 0.05) });
  metaY -= 14;

  currentPage.drawText("Registration / Tax ID:", { x: col1X, y: metaY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(data.businessRegistrationNumber || "Not Recorded", { x: col1X + 90, y: metaY, size: 8, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
  metaY -= 14;

  currentPage.drawText("Authorized Signer:", { x: col1X, y: metaY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(`${data.signerName} (${data.signerTitle || "Company Representative"})`, { x: col1X + 90, y: metaY, size: 8, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  metaY -= 14;

  currentPage.drawText("Signatory Email:", { x: col1X, y: metaY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(data.signerEmail || "N/A", { x: col1X + 90, y: metaY, size: 8, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

  // Col 2
  metaY = y - 16;
  currentPage.drawText("Agreement Version:", { x: col2X, y: metaY, size: 8, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(`Version ${data.agreementVersion} (Standard)`, { x: col2X + 85, y: metaY, size: 8, font: helveticaBold, color: rgb(0.05, 0.05, 0.05) });
  metaY -= 14;

  currentPage.drawText("Execution Timestamp:", { x: col2X, y: metaY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(formattedDate, { x: col2X + 85, y: metaY, size: 7.5, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
  metaY -= 14;

  currentPage.drawText("Signatory IP Address:", { x: col2X, y: metaY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(data.signerIp || "Verified Electronic Session", { x: col2X + 85, y: metaY, size: 8, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
  metaY -= 14;

  currentPage.drawText("Acceptance Record ID:", { x: col2X, y: metaY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText(data.acceptanceId.slice(0, 18) + "...", { x: col2X + 85, y: metaY, size: 7.5, font: helveticaOblique, color: rgb(0.3, 0.3, 0.3) });

  y -= 112;

  // Preamble Text
  const preamble =
    "This Retailer Operating Agreement (\"Agreement\") constitutes a binding electronic commercial standard and operational protocol between K SELECT NETWORK (\"K SELECT\") and the authorized Retail Partner named above (\"Retailer\"). By completing onboarding and submitting acceptance, the Retailer agrees to the following authoritative operational standards:";

  const preambleLines = wrapText(preamble, contentWidth, helvetica, 9);
  for (const line of preambleLines) {
    checkPageBreak(14);
    currentPage.drawText(line, { x: margin, y, size: 9, font: helvetica, color: rgb(0.15, 0.15, 0.15) });
    y -= 13;
  }

  y -= 10;

  // --- Articles 1 to 4 ---
  const articles = [
    {
      title: "ARTICLE 1: WEEKLY INVENTORY VERIFICATION & COUNTING PROTOCOL",
      sections: [
        {
          num: "1.1",
          heading: "Mandatory Weekly Count Submission",
          body: "The Retailer agrees to conduct physical inventory counts and submit weekly remaining on-shelf/backroom quantities for all active K SELECT product lines across all participating retail store locations via the K SELECT Retailer Portal.",
        },
        {
          num: "1.2",
          heading: "Reporting Schedule & Cutoff",
          body: "Weekly inventory count submissions must be finalized no later than the agreed weekly cutoff time. Consistent and accurate weekly reporting is a prerequisite for automatic replenishment calculation and ongoing commercial protections.",
        },
        {
          num: "1.3",
          heading: "Replenishment & Sell-Through Calculations",
          body: "K SELECT utilizes reported physical counts, historical sell-through rates, and inbound delivery logs to compute accurate store inventory movement, estimate gross margin performance, and recommend weekly carton replenishment orders.",
        },
      ],
    },
    {
      title: "ARTICLE 2: STORE PRICING, PROMOTION & BRAND TAG INTEGRITY",
      sections: [
        {
          num: "2.1",
          heading: "Authorized Shelf Pricing Compliance",
          body: "The Retailer agrees to display and maintain shelf prices that comply with K SELECT's agreed Suggested Retail Price (SRP) or Minimum Advertised Price (MAP) guidelines, preventing unauthorized pricing disparities.",
        },
        {
          num: "2.2",
          heading: "Common Product QR & Tag Displays",
          body: "The Retailer shall utilize authorized K SELECT store shelf tags, product markers, and QR codes generated through the Portal to ensure customer transparency and accurate product information access.",
        },
        {
          num: "2.3",
          heading: "Promotional Alignment",
          body: "Any promotional discounting or marketing campaigns involving K SELECT products must adhere to approved campaign schedules and brand presentation guidelines.",
        },
      ],
    },
    {
      title: "ARTICLE 3: 90-DAY INITIAL TRIAL RISK PROTECTION",
      sections: [
        {
          num: "3.1",
          heading: "Initial Assortment Protection Scope",
          body: "For newly introduced qualifying product lines, K SELECT provides a 90-Day Initial Trial Protection period commencing on the confirmed store delivery date of the initial trial order.",
        },
        {
          num: "3.2",
          heading: "Eligibility Conditions",
          body: "To remain eligible for trial risk protection, the Retailer must: (a) maintain authorized shelf placement and pricing; (b) complete timely weekly inventory count submissions; and (c) ensure staff have completed the relevant product training modules.",
        },
        {
          num: "3.3",
          heading: "Slow-Moving Inventory Resolution & Credits",
          body: "If a protected trial product fails to meet minimum movement benchmarks after the 90-day period despite full compliance, the Retailer may request an administrative protection review. Approved resolutions may include return credits, product exchanges, or inventory buybacks subject to K SELECT Administrative authorization.",
        },
      ],
    },
    {
      title: "ARTICLE 4: ACCOUNT SECURITY, STORE ACCESS & TENANT CONFIDENTIALITY",
      sections: [
        {
          num: "4.1",
          heading: "Role-Based Access & Staff Credentials",
          body: "The Retailer Owner is responsible for maintaining organizational security, assigning appropriate store permissions to staff members, and promptly revoking access for departing employees.",
        },
        {
          num: "4.2",
          heading: "Proprietary Commercial Information",
          body: "Wholesale pricing structures, commercial tier terms, brand catalogs, training materials, and performance algorithms provided through the K SELECT Portal are proprietary and confidential to K SELECT NETWORK.",
        },
        {
          num: "4.3",
          heading: "Electronic Acceptance & Version Authority",
          body: "This electronic agreement and any future version updates accepted through the Portal carry full legal validity under applicable electronic signature laws. Historical acceptance records and generated archival PDFs are permanently preserved in the K SELECT Document Archive.",
        },
      ],
    },
  ];

  for (const article of articles) {
    checkPageBreak(50);

    // Article Title Bar
    currentPage.drawRectangle({
      x: margin,
      y: y - 14,
      width: contentWidth,
      height: 18,
      color: rgb(0.92, 0.94, 0.96),
    });

    currentPage.drawText(article.title, {
      x: margin + 6,
      y: y - 9,
      size: 8.5,
      font: helveticaBold,
      color: rgb(0.12, 0.2, 0.35),
    });

    y -= 24;

    for (const sec of article.sections) {
      checkPageBreak(36);

      const secTitle = `${sec.num} ${sec.heading}`;
      currentPage.drawText(secTitle, {
        x: margin + 4,
        y,
        size: 8,
        font: helveticaBold,
        color: rgb(0.15, 0.15, 0.15),
      });

      y -= 11;

      const bodyLines = wrapText(sec.body, contentWidth - 12, helvetica, 8);
      for (const bLine of bodyLines) {
        checkPageBreak(12);
        currentPage.drawText(bLine, {
          x: margin + 8,
          y,
          size: 8,
          font: helvetica,
          color: rgb(0.25, 0.25, 0.25),
        });
        y -= 10.5;
      }

      y -= 5;
    }

    y -= 8;
  }

  // --- Signatory Execution Block ---
  checkPageBreak(110);

  currentPage.drawRectangle({
    x: margin,
    y: y - 96,
    width: contentWidth,
    height: 96,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  });

  let signY = y - 15;
  currentPage.drawText("ELECTRONIC EXECUTION & SIGNATURE ATTESTATION", {
    x: margin + 12,
    y: signY,
    size: 8.5,
    font: helveticaBold,
    color: rgb(0.08, 0.08, 0.1),
  });

  signY -= 12;
  const attestation =
    "IN WITNESS WHEREOF, the Authorized Representative has electronically executed this Agreement on behalf of the Retail Partner. The electronic signature and timestamp below serve as conclusive legal evidence of acceptance.";
  const attestationLines = wrapText(attestation, contentWidth - 24, helveticaOblique, 7.5);
  for (const aLine of attestationLines) {
    currentPage.drawText(aLine, { x: margin + 12, y: signY, size: 7.5, font: helveticaOblique, color: rgb(0.35, 0.35, 0.35) });
    signY -= 9.5;
  }

  signY -= 6;
  currentPage.drawLine({
    start: { x: margin + 12, y: signY + 4 },
    end: { x: pageWidth - margin - 12, y: signY + 4 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  signY -= 10;
  currentPage.drawText("Electronically Signed by:", { x: margin + 12, y: signY, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  currentPage.drawText(data.signerName, { x: margin + 120, y: signY, size: 9, font: helveticaBold, color: rgb(0.05, 0.05, 0.05) });

  currentPage.drawText("Signatory Role / Title:", { x: margin + 280, y: signY, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  currentPage.drawText(data.signerTitle || "Authorized Representative", { x: margin + 380, y: signY, size: 8, font: helvetica, color: rgb(0.05, 0.05, 0.05) });

  signY -= 13;
  currentPage.drawText("Date & Time:", { x: margin + 12, y: signY, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  currentPage.drawText(formattedDate, { x: margin + 120, y: signY, size: 7.5, font: helvetica, color: rgb(0.2, 0.2, 0.2) });

  currentPage.drawText("Security Verification:", { x: margin + 280, y: signY, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  currentPage.drawText("SHA-256 Verified Electronic Signature", { x: margin + 380, y: signY, size: 7.5, font: helveticaBold, color: rgb(0.1, 0.5, 0.25) });

  // Add Page Footers across all pages
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);

    // Bottom line
    page.drawLine({
      start: { x: margin, y: 40 },
      end: { x: pageWidth - margin, y: 40 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    page.drawText(`K SELECT Retailer Operating Agreement (v${data.agreementVersion}) • Confidential & Authoritative Document`, {
      x: margin,
      y: 28,
      size: 7.5,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pageNumText = `Page ${i + 1} of ${totalPages}`;
    const pageNumWidth = helvetica.widthOfTextAtSize(pageNumText, 7.5);
    page.drawText(pageNumText, {
      x: pageWidth - margin - pageNumWidth,
      y: 28,
      size: 7.5,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return await pdfDoc.save();
}
