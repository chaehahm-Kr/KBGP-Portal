import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const pdfBytes = new Uint8Array(fs.readFileSync("private_assets/agreements/retailer_template_v1.pdf"));
  const doc = await pdfjs.getDocument({ data: pdfBytes, verbosity: 0 }).promise;
  
  for (const pageNum of [1, 6]) {
    console.log(`\n================== PAGE ${pageNum} ==================`);
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item.str && item.str.trim()) {
        const x = Math.round(item.transform[4]);
        const y = Math.round(item.transform[5]);
        console.log(`[x=${x}, y=${y}] "${item.str}"`);
      }
    }
  }
}

main().catch(console.error);
