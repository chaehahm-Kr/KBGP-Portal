const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFParse } = require('pdf-parse');

async function inspectRptPdf() {
  const pdfPath = path.join(__dirname, '..', 'Manuals', 'MAN-B-RPT-001_Reports-Performance', '03_PUBLISHED', 'MAN-B-RPT-001_Reports-Performance_V1.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('ERROR: Target PDF not found at', pdfPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const size = buffer.length;

  console.log('=== MAN-B-RPT-001 PDF Inspection ===');
  console.log('File:', pdfPath);
  console.log('File Size:', size, 'bytes');
  console.log('SHA-256:', hash);

  const parser = new PDFParse(new Uint8Array(buffer));
  const textResult = await parser.getText();
  const infoResult = await parser.getInfo();

  console.log('Total Pages:', textResult.pages.length);
  console.log('PDF Title/Info:', JSON.stringify(infoResult.info || {}));

  // Page by page text extraction
  console.log('\n--- Page Summary ---');
  textResult.pages.forEach((page, idx) => {
    const lines = page.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const heading = lines.slice(0, 4).join(' | ');
    console.log(`\n[Page ${idx + 1}] (${lines.length} lines):`);
    console.log('Heading:', heading.slice(0, 120));
    console.log('Snippet:', lines.slice(0, 8).join('\n'));
  });

  // Check for forbidden or placeholder words
  const fullText = textResult.text;
  const placeholders = fullText.match(/(REVIEW|TODO|FIXME|LOREM IPSUM|DRAFT ONLY|PLACEHOLDER|TBD)/gi) || [];
  console.log('\n--- Quality Checks ---');
  console.log('Placeholder matches:', placeholders);

  // Check absolute/unsupported claims
  const absoluteClaims = fullText.match(/(100% 보장|완벽한 실시간|무제한|결코 오류 없음)/gi) || [];
  console.log('Absolute claim matches:', absoluteClaims);

  // Check screenshots referenced in PDF
  const scrMatches = fullText.match(/SCR-B-RPT-\d{3}/gi) || [];
  console.log('\nScreenshot references found in text:', [...new Set(scrMatches)]);

  // Check domain boundary terms
  const rptOrdMatches = fullText.match(/(5-Stage|ORDERED|CONFIRMED|PACKED|SHIPPED|CANCELLED|Action Required|URGENT|DUE_SOON)/gi) || [];
  const rptFinMatches = fullText.match(/(Total Invoiced|Total Paid|Balance Due|Overdue Balance|미수 잔액|연체 잔액)/gi) || [];
  const rptProdMatches = fullText.match(/(Catalog Completeness|28-Criteria|28개 검증|Complete|Draft)/gi) || [];
  const rptPermMatches = fullText.match(/(Role|Permission|Multi-tenant|브랜드 격리|Store Filter)/gi) || [];

  console.log('\n--- Domain Terms Verification ---');
  console.log('RPT ↔ ORD terms count:', rptOrdMatches.length);
  console.log('RPT ↔ FIN terms count:', rptFinMatches.length);
  console.log('RPT ↔ PROD terms count:', rptProdMatches.length);
  console.log('RPT ↔ PERM terms count:', rptPermMatches.length);

  // Check System Gaps
  const gaps = [
    'Real-time Webhook Streaming',
    'Custom Report Builder',
    'Automated Scheduled PDF/Excel Export',
    'Cross-brand Comparative Benchmark'
  ];

  console.log('\n--- System Gaps Verification ---');
  gaps.forEach(g => {
    const present = fullText.includes(g) || fullText.toLowerCase().includes(g.toLowerCase());
    console.log(`Gap [${g}]:`, present ? 'FOUND' : 'NOT FOUND');
  });

  // Write full extracted text to a dump file for detailed review
  fs.writeFileSync(path.join(__dirname, 'rpt_pdf_dump.txt'), fullText, 'utf8');
  console.log('\nFull text dumped to scripts/rpt_pdf_dump.txt');
}

inspectRptPdf().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
