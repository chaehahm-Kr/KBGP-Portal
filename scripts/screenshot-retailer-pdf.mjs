import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pdfPath = path.join(process.cwd(), "scratch/test_executed_retailer.pdf");
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");

  // Load PDF using PDF.js viewer in browser
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        body { margin: 0; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
        canvas { box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
      </style>
    </head>
    <body>
      <div id="container"></div>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${pdfBase64}');
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        loadingTask.promise.then(async (pdf) => {
          const container = document.getElementById('container');
          for (let pageNum of [1, 6]) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.id = 'page-' + pageNum;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            container.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          }
          window.rendered = true;
        });
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.rendered === true, { timeout: 30000 });

  const outDir = path.join(process.cwd(), "scratch/renders");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const pageNum of [1, 6]) {
    const canvasElement = await page.$(`#page-${pageNum}`);
    if (canvasElement) {
      const pngPath = path.join(outDir, `retailer_page_${pageNum}.png`);
      await canvasElement.screenshot({ path: pngPath });
      console.log(`Saved screenshot of Page ${pageNum} to ${pngPath}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
