const { generateExecutedAgreementPdf } = require('../lib/agreement/pdf-generator');
const fs = require('fs');
const path = require('path');

async function test() {
  const result = await generateExecutedAgreementPdf({
    agreementId: "KSN-AGR-EXT07-26-3QZP",
    version: "1.0",
    companyName: "Extreme Inc.",
    companyAddress: "서울 은평구 구산동 은평 아파트 162-111, Seoul, 대한민국",
    representativeName: "박은애",
    signerName: "박은애",
    signerTitle: "이사",
    signerEmail: "tammyhahm77@gmail.com",
    executedDate: "2026-09-29",
    agreementType: "BRAND_SUPPLIER"
  });

  console.log("PDF Hash:", result.pdfHash);
  console.log("PDF Buffer length:", result.pdfBuffer.length);
}

test().catch(console.error);
