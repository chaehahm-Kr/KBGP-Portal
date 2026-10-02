const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDir = path.join(
  process.cwd(),
  'Manuals',
  'MAN-B-REG-001_Regulatory-Compliance',
  '02_CLAUDE_PACKAGE'
);

console.log("========================================================================");
console.log("ABSOLUTE PATH VERIFIED:");
console.log(baseDir);
console.log("========================================================================\n");

function getPNGDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  // PNG Magic Bytes Check
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error(`Invalid PNG magic bytes in ${filePath}`);
  }
  // IHDR width at offset 16 (4 bytes BE), height at offset 20 (4 bytes BE)
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return `${width}x${height}`;
}

function getSHA256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const rootFiles = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isFile());
const contentFiles = fs.readdirSync(path.join(baseDir, '01_CONTENT')).filter(f => fs.statSync(path.join(baseDir, '01_CONTENT', f)).isFile());
const screenshotFiles = fs.readdirSync(path.join(baseDir, '02_SCREENSHOTS')).filter(f => fs.statSync(path.join(baseDir, '02_SCREENSHOTS', f)).isFile());
const diagramFiles = fs.readdirSync(path.join(baseDir, '03_DIAGRAMS')).filter(f => fs.statSync(path.join(baseDir, '03_DIAGRAMS', f)).isFile());
const referenceFiles = fs.readdirSync(path.join(baseDir, '04_REFERENCE')).filter(f => fs.statSync(path.join(baseDir, '04_REFERENCE', f)).isFile());

console.log(`ROOT FILES: ${rootFiles.length}`);
console.log(`01_CONTENT: ${contentFiles.length}`);
console.log(`02_SCREENSHOTS: ${screenshotFiles.length}`);
console.log(`03_DIAGRAMS: ${diagramFiles.length}`);
console.log(`04_REFERENCE: ${referenceFiles.length}`);

const totalPhysicalFiles = rootFiles.length + contentFiles.length + screenshotFiles.length + diagramFiles.length + referenceFiles.length;
console.log(`\nTOTAL PHYSICAL FILES: ${totalPhysicalFiles}`);

console.log("\n--- DETAILED PHYSICAL READ-BACK FILE VERIFICATION ---");

const allItems = [
  ...rootFiles.map(f => ({ rel: f, full: path.join(baseDir, f) })),
  ...contentFiles.map(f => ({ rel: path.join('01_CONTENT', f), full: path.join(baseDir, '01_CONTENT', f) })),
  ...screenshotFiles.map(f => ({ rel: path.join('02_SCREENSHOTS', f), full: path.join(baseDir, '02_SCREENSHOTS', f) })),
  ...diagramFiles.map(f => ({ rel: path.join('03_DIAGRAMS', f), full: path.join(baseDir, '03_DIAGRAMS', f) })),
  ...referenceFiles.map(f => ({ rel: path.join('04_REFERENCE', f), full: path.join(baseDir, '04_REFERENCE', f) }))
];

const pngHashes = new Set();
let pngDuplicateCount = 0;

allItems.forEach(item => {
  const stat = fs.statSync(item.full);
  const hash = getSHA256(item.full);
  const hashPrefix = hash.substring(0, 16);
  
  if (item.rel.endsWith('.png')) {
    const dims = getPNGDimensions(item.full);
    if (pngHashes.has(hash)) {
      pngDuplicateCount++;
    } else {
      pngHashes.add(hash);
    }
    console.log(`PNG | ${item.rel.padEnd(55)} | ${stat.size.toString().padStart(6)} bytes | ${dims} | Hash: ${hashPrefix}`);
  } else {
    const content = fs.readFileSync(item.full, 'utf8');
    const firstLine = content.split('\n').find(l => l.startsWith('#')) || 'No Header';
    console.log(`MD  | ${item.rel.padEnd(55)} | ${stat.size.toString().padStart(6)} bytes | Header: ${firstLine.substring(0, 30)} | Hash: ${hashPrefix}`);
  }
});

console.log("\n========================================================================");
console.log(`PNG UNIQ HASH COUNT: ${pngHashes.size} / 8`);
console.log(`PNG DUPLICATE COUNT: ${pngDuplicateCount}`);
console.log("========================================================================");
