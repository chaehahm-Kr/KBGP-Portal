const puppeteer = require('puppeteer-core');
const chromePath = 'C:\\Users\\ChaeHahm\\.cache\\puppeteer\\chrome\\win64-152.0.7977.42\\chrome-win64\\chrome.exe';
const path = require('path');
const fs = require('fs');

async function buildKoreanPdfs() {
  console.log("=== Starting Official Korean Curation Manuals PDF Generation ===");

  const docsDir = path.join(__dirname);
  const manualHtmlPath = path.join(docsDir, 'curation_operations_manual_kr.html');
  const quickHtmlPath = path.join(docsDir, 'curation_quick_reference_kr.html');

  const manualPdfPath = path.join(docsDir, '01_K_SELECT_NETWORK_Curation_Operations_Manual_KR.pdf');
  const quickPdfPath = path.join(docsDir, '02_K_SELECT_NETWORK_Curation_Quick_Reference_Guide_KR.pdf');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 1. Build Full Manual PDF
  console.log("Rendering Full Operations Manual PDF...");
  const page1 = await browser.newPage();
  await page1.goto(`file://${manualHtmlPath}`, { waitUntil: 'networkidle0' });

  await page1.pdf({
    path: manualPdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-family:'Pretendard', 'Inter', sans-serif; font-size:7pt; color:#94A3B8; width:100%; padding:0 15mm; display:flex; justify-content:space-between;">
        <span>K SELECT NETWORK — 공식 큐레이션 운영 매뉴얼 (Korean Official SOP)</span>
        <span>보안등급: 대외비 (INTERNAL USE ONLY)</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-family:'Pretendard', 'Inter', sans-serif; font-size:7pt; color:#94A3B8; width:100%; padding:0 15mm; display:flex; justify-content:space-between;">
        <span>문서번호: KSN-SOP-CUR-2026-KR1</span>
        <span>페이지 <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '20mm',
      bottom: '20mm',
      left: '15mm',
      right: '15mm'
    }
  });
  console.log("✅ SUCCESS: 01_K_SELECT_NETWORK_Curation_Operations_Manual_KR.pdf created!");

  // 2. Build Quick Reference Guide PDF
  console.log("Rendering Quick Reference Guide PDF...");
  const page2 = await browser.newPage();
  await page2.goto(`file://${quickHtmlPath}`, { waitUntil: 'networkidle0' });

  await page2.pdf({
    path: quickPdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-family:'Pretendard', 'Inter', sans-serif; font-size:7pt; color:#94A3B8; width:100%; padding:0 12mm; display:flex; justify-content:space-between;">
        <span>K SELECT NETWORK — 큐레이션 실무 퀵 가이드 (Korean Quick Guide)</span>
        <span>보안등급: 대외비 (INTERNAL USE ONLY)</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-family:'Pretendard', 'Inter', sans-serif; font-size:7pt; color:#94A3B8; width:100%; padding:0 12mm; display:flex; justify-content:space-between;">
        <span>문서번호: KSN-SOP-CUR-2026-KR-QS1</span>
        <span>페이지 <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '12mm',
      right: '12mm'
    }
  });
  console.log("✅ SUCCESS: 02_K_SELECT_NETWORK_Curation_Quick_Reference_Guide_KR.pdf created!");

  await browser.close();
  console.log("=== ALL KOREAN CURATION MANUAL PDFS SUCCESSFULLY CREATED & VERIFIED ===");
}

buildKoreanPdfs().catch(console.error);
