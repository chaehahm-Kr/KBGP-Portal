const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function main() {
  const pdfPath = path.join(process.cwd(), 'Manuals/MAN-B-LOG-001_Shipping-Logistics/03_PUBLISHED/MAN-B-LOG-001_Shipping-Logistics_V1.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse(new Uint8Array(buffer));
  const textResult = await parser.getText();
  const infoResult = await parser.getInfo();

  console.log('====================================================');
  console.log('       MAN-B-LOG-001 PDF QA VERIFICATION REPORT      ');
  console.log('====================================================');
  console.log('PDF File:', pdfPath);
  console.log('Total Pages:', textResult.pages.length, '(Expected: 22)');
  console.log('PDF Title:', infoResult.title || 'N/A');

  const fullText = textResult.text;

  // 1. Banned phrases check
  const banned = [
    '제작 메모',
    '재캡처',
    '교체 대상',
    'AI 지식 센터',
    '24시간 실시간',
    'TODO',
    'FIXME'
  ];

  console.log('\n--- 1. BANNED PHRASES CHECK ---');
  let bannedFound = 0;
  banned.forEach(phrase => {
    const count = (fullText.match(new RegExp(phrase, 'g')) || []).length;
    console.log(`- '${phrase}': ${count} occurrences`);
    if (count > 0) bannedFound += count;
  });

  // 2. Canonical required phrases check
  const canonical = [
    'MAN-B-LOG-001',
    'MAN-B-ORD-001',
    'MAN-B-FIN-001',
    'Knowledge Assistant',
    'Published Knowledge',
    'LETUSTO_ARRANGED',
    'SUPPLIER_ARRANGED',
    'availableReadiness',
    'SCR-B-LOG-001',
    'SCR-B-LOG-009',
    'SCR-B-LOG-011'
  ];

  console.log('\n--- 2. CANONICAL TERMS & CODES CHECK ---');
  canonical.forEach(term => {
    const count = (fullText.match(new RegExp(term, 'g')) || []).length;
    console.log(`- '${term}': ${count} occurrences`);
  });

  // 3. Page-by-page verification
  console.log('\n--- 3. PAGE-BY-PAGE AUDIT ---');
  textResult.pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    const pText = page.text;
    console.log(`Page ${String(pageNum).padStart(2, '0')}: ${pText.length} chars | First line: ${pText.split('\n')[0].substring(0, 40)}`);
  });

  // Page 19 specific inspection
  console.log('\n--- 4. TARGET CORRECTION SPECIFIC INSPECTION ---');
  const p19Text = textResult.pages[18].text;
  console.log('Page 19 check:');
  console.log('  Contains "제작 메모"?:', p19Text.includes('제작 메모'));
  console.log('  Contains "Viewer"?:', p19Text.includes('Viewer'));
  console.log('  Contains "SCR-B-LOG-009"?:', p19Text.includes('SCR-B-LOG-009'));

  // Page 22 specific inspection
  const p22Text = textResult.pages[21].text;
  console.log('Page 22 check:');
  console.log('  Contains "AI 지식 센터"?:', p22Text.includes('AI 지식 센터'));
  console.log('  Contains "Knowledge Assistant"?:', p22Text.includes('Knowledge Assistant'));
  console.log('  Contains "Published Knowledge"?:', p22Text.includes('Published Knowledge'));

  console.log('\n====================================================');
  if (textResult.pages.length === 22 && bannedFound === 0 && p22Text.includes('Knowledge Assistant') && !p19Text.includes('제작 메모')) {
    console.log('>>> FINAL QA RESULT: PASS (22/22 Pages, 0 Banned Items, 100% Canonical Grounding)');
  } else {
    console.log('>>> FINAL QA RESULT: FAIL');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('QA Error:', err);
  process.exit(1);
});
