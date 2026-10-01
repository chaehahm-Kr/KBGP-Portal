import fs from "fs";
import path from "path";
import { createCanvas, Image } from "canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function renderPdfToPng(pdfPath, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const canvasFactory = new NodeCanvasFactory();
  const pdf = await pdfjs.getDocument({ data, verbosity: 0, canvasFactory }).promise;

  for (const pageNum of [1, 6]) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    
    await page.render({
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    }).promise;

    const pngPath = path.join(outDir, `retailer_page_${pageNum}.png`);
    fs.writeFileSync(pngPath, canvasAndContext.canvas.toBuffer("image/png"));
    console.log(`Rendered page ${pageNum} to ${pngPath}`);
  }
}

const outPdf = path.join(process.cwd(), "scratch/test_executed_retailer.pdf");
renderPdfToPng(outPdf, path.join(process.cwd(), "scratch/renders")).catch(console.error);
