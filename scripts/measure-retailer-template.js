const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

(async () => {
  const data = new Uint8Array(fs.readFileSync('private_assets/agreements/retailer_template_v1.pdf'));
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  
  for (const pageNum of [1, 6]) {
    console.log('=== PAGE ' + pageNum + ' ===');
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item.str && item.str.trim()) {
        const x = Math.round(item.transform[4]);
        const y = Math.round(item.transform[5]);
        console.log('[' + x + ', ' + y + '] ' + JSON.stringify(item.str));
      }
    }
  }
})();
