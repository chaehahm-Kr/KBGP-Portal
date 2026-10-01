const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

async function main() {
  const templatePath = path.join(process.cwd(), "private_assets/agreements/template_v1.pdf");
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  console.log("Page count:", pdfDoc.getPageCount());
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`Page ${i + 1}: ${width} x ${height} pt`);
  }
}

main().catch(console.error);
