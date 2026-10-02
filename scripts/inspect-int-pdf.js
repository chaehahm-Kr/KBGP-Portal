const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFParse } = require('pdf-parse');

async function inspectIntPdf() {
  const pdfPath = path.join(__dirname, '..', 'Manuals', 'MAN-B-INT-001_Intelligence', '03_PUBLISHED', 'MAN-B-INT-001_Intelligence_V1.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('ERROR: Target PDF not found at', pdfPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const size = buffer.length;

  console.log('=== MAN-B-INT-001 PDF Inspection ===');
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
  const scrMatches = fullText.match(/SCR-B-INT-\d{3}/gi) || [];
  console.log('\nScreenshot references found in text:', [...new Set(scrMatches)]);

  // Check domain boundary and grounding terms
  const groundedAssistantMatches = fullText.match(/(Grounded Knowledge Assistant|\/portal\/help\/ask|Ask K SELECT)/gi) || [];
  const autoEngineMatches = fullText.match(/(Auto-Engine|3\+3|Topic Score|80점|05:00 ET|daily auto)/gi) || [];
  const claimRiskMatches = fullText.match(/(Claim Risk|Safe Downgrade|FACT VERIFIED|VIEW INFERRED|SIGNAL|INTERNAL|ESTIMATE|STOP)/gi) || [];
  const humanGateMatches = fullText.match(/(AI_DRAFT|UNDER_REVIEW|REVISION_REQUESTED|APPROVED|SCHEDULED|PUBLISHED|Human Review|Human Approval)/gi) || [];
  const feedbackMatches = fullText.match(/(Reader Feedback|Usefulness|HMAC|익명|중복 방지|helpful)/gi) || [];
  const boundaryMatches = fullText.match(/(NETWORK|HUB|RPT|Measurement|Reporting Layer|Market Intelligence)/gi) || [];

  console.log('\n--- Grounding Terms Verification ---');
  console.log('Grounded Knowledge Assistant matches:', groundedAssistantMatches.length);
  console.log('Auto-Engine / 3+3 Quota matches:', autoEngineMatches.length);
  console.log('Claim Risk / Safe Downgrade matches:', claimRiskMatches.length);
  console.log('Human Approval Gate matches:', humanGateMatches.length);
  console.log('Reader Feedback / HMAC matches:', feedbackMatches.length);
  console.log('Domain Boundary matches:', boundaryMatches.length);

  // Check System Gaps
  const gaps = [
    'Direct Public AI Chatbot',
    'Unmoderated Auto-Publish',
    'Custom Brand Scraper Agent',
    'Automated Multi-lingual Translation Engine'
  ];

  console.log('\n--- System Gaps Verification ---');
  gaps.forEach(g => {
    const present = fullText.includes(g) || fullText.toLowerCase().includes(g.toLowerCase());
    console.log(`Gap [${g}]:`, present ? 'FOUND' : 'NOT FOUND');
  });

  // Write full extracted text to dump file for detailed inspection
  fs.writeFileSync(path.join(__dirname, 'int_pdf_dump.txt'), fullText, 'utf8');
  console.log('\nFull text dumped to scripts/int_pdf_dump.txt');
}

inspectIntPdf().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
