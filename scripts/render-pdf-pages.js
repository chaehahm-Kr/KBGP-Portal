const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

async function renderPdfToPng(pdfPath, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({
    data,
    standardFontDataUrl: path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts/"),
  });
  const pdf = await loadingTask.promise;

  console.log(`PDF loaded. Total pages: ${pdf.numPages}`);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (pageNum !== 1 && pageNum !== 5) continue;

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    const pngPath = path.join(outDir, `page_${pageNum}.png`);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(pngPath, buffer);
    console.log(`Rendered page ${pageNum} to ${pngPath} (${buffer.length} bytes)`);
  }
}

const pdfFile = path.join(process.cwd(), "scratch/test_executed_r7.pdf");
const outFolder = path.join(process.cwd(), "scratch/renders");

renderPdfToPng(pdfFile, outFolder).catch(console.error);
