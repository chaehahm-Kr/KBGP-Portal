const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function getBase64Image(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('Image not found:', filePath);
    return '';
  }
  const ext = path.extname(filePath).toLowerCase();
  let mime = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

async function generatePdf() {
  console.log('Generating MAN-B-REG-001 Regulatory Compliance PDF (Target: 15 Pages)...');

  const scrsDir = path.join(__dirname, '..', 'Manuals', 'MAN-B-REG-001_Regulatory-Compliance', '02_CLAUDE_PACKAGE', '02_SCREENSHOTS');
  const scrs = {
    scr1: getBase64Image(path.join(scrsDir, 'SCR-B-REG-001.png')),
    scr2: getBase64Image(path.join(scrsDir, 'SCR-B-REG-002.png')),
    scr3: getBase64Image(path.join(scrsDir, 'SCR-B-REG-003.png')),
    scr4: getBase64Image(path.join(scrsDir, 'SCR-B-REG-004.png')),
    scr5: getBase64Image(path.join(scrsDir, 'SCR-B-REG-005.png')),
    scr6: getBase64Image(path.join(scrsDir, 'SCR-B-REG-006.png')),
    scr7: getBase64Image(path.join(scrsDir, 'SCR-B-REG-007.png')),
    scr8: getBase64Image(path.join(scrsDir, 'SCR-B-REG-008.png'))
  };

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>MAN-B-REG-001 Regulatory, Certification & Compliance User Guide</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      line-height: 1.45;
      font-size: 8.5pt;
    }

    .page {
      width: 210mm;
      height: 297mm;
      padding: 18mm 18mm 16mm 18mm;
      margin: 0 auto;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #FFFFFF;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #0F172A;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }
    .header-logo {
      font-size: 9pt;
      font-weight: 900;
      letter-spacing: 0.05em;
      color: #0F172A;
    }
    .header-doc-id {
      font-size: 7.5pt;
      font-weight: 700;
      color: #0284C7;
      background: #F0F9FF;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid #BAE6FD;
    }

    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #E2E8F0;
      padding-top: 5px;
      margin-top: 8px;
      font-size: 7pt;
      color: #64748B;
    }
    .page-num {
      font-weight: 700;
      color: #0F172A;
    }

    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Cover Page */
    .cover-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 25mm 10mm 15mm 10mm;
    }
    .cover-badge {
      display: inline-block;
      background: #0F172A;
      color: #38BDF8;
      font-size: 8.5pt;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 4px;
      letter-spacing: 0.1em;
      margin-bottom: 15px;
    }
    .cover-title {
      font-size: 26pt;
      font-weight: 900;
      color: #0F172A;
      line-height: 1.2;
      margin-bottom: 10px;
    }
    .cover-subtitle {
      font-size: 13pt;
      font-weight: 600;
      color: #0284C7;
      line-height: 1.4;
      margin-bottom: 25px;
    }
    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 25px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 6.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-value {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0F172A;
    }

    /* Headings & Texts */
    h1.chapter-title {
      font-size: 14pt;
      font-weight: 900;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 4px;
    }
    .chapter-tag {
      background: #0284C7;
      color: #FFFFFF;
      font-size: 7.5pt;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .section-title {
      font-size: 10pt;
      font-weight: 800;
      color: #0F172A;
      margin-top: 4px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 11px;
      background: #0284C7;
      border-radius: 2px;
    }

    /* Cards & Grids */
    .card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .card-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    /* Tables */
    table.spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin-top: 3px;
      margin-bottom: 3px;
    }
    table.spec-table th, table.spec-table td {
      border: 1px solid #E2E8F0;
      padding: 4px 6px;
      text-align: left;
    }
    table.spec-table th {
      background: #F1F5F9;
      font-weight: 800;
      color: #0F172A;
    }
    table.spec-table td {
      background: #FFFFFF;
      color: #334155;
    }

    /* Screenshot Container */
    .screenshot-container {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 6px;
      text-align: center;
      margin-top: 3px;
      margin-bottom: 3px;
    }
    .screenshot-container img {
      max-width: 100%;
      max-height: 105mm;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid #E2E8F0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .screenshot-caption {
      font-size: 7pt;
      font-weight: 700;
      color: #64748B;
      margin-top: 3px;
    }

    /* Badges & Code */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      background: #E2E8F0;
      color: #0F172A;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
    }
    .badge {
      display: inline-block;
      font-size: 6.5pt;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .badge-blue { background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD; }
    .badge-green { background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
    .badge-amber { background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
    .badge-purple { background: #F3E8FF; color: #7E22CE; border: 1px solid #E9D5FF; }

    /* Callouts */
    .callout {
      border-left: 3px solid #0284C7;
      background: #F0F9FF;
      padding: 6px 9px;
      border-radius: 0 5px 5px 0;
      font-size: 7.5pt;
      margin: 3px 0;
    }
    .callout-title {
      font-weight: 800;
      color: #0369A1;
      margin-bottom: 2px;
    }
    .callout-amber {
      border-left-color: #F59E0B;
      background: #FFFBEB;
    }
    .callout-amber .callout-title {
      color: #B45309;
    }
  </style>
</head>
<body>

  <!-- PAGE 1: COVER -->
  <div class="page">
    <div class="cover-container">
      <div>
        <div class="cover-badge">K SELECT OFFICIAL USER MANUAL &bull; MAN-B-REG-001</div>
        <div class="cover-title">인허가, 상표권 및<br/>증빙 서류 관리 매뉴얼</div>
        <div class="cover-subtitle">Regulatory, Certification &amp; Compliance User Guide</div>
        <div style="font-size:9pt; color:#475569; max-width:140mm; line-height:1.5;">
          K SELECT NETWORK Brand Portal 브랜드 파트너사를 위한 공식 규정 가이드입니다. 한/미 상표권(KIPO/USPTO), 전성분 영문 INCI 번역기, 5대 인허가 서류(FDA/MSDS/COA/특허) 버전 관리 및 식별 바코드(UPC/EAN) 검증 표준 절차를 안내합니다.
        </div>
      </div>
      
      <div>
        <div class="cover-meta-grid">
          <div class="meta-item">
            <span class="meta-label">Document ID</span>
            <span class="meta-value">MAN-B-REG-001</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Version / Status</span>
            <span class="meta-value">v1.1.0 &bull; PUBLISHED</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Target Audience</span>
            <span class="meta-value">Brand Partners &bull; Operations</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Effective Date</span>
            <span class="meta-value">2026-10-01</span>
          </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:flex-end; font-size:7.5pt; color:#64748B;">
          <div>
            <b>K SELECT NETWORK OPERATIONS DESK</b><br/>
            Global Compliance &amp; Regulatory Division
          </div>
          <div style="text-align:right;">
            Confidential &amp; Authoritative<br/>
            &copy; 2026 Letusto Inc. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 2: TABLE OF CONTENTS & OVERVIEW -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">목차</span> 매뉴얼 구성 및 핵심 요약 (Table of Contents)</h1>
      
      <div class="card" style="background:#F0F9FF; border-color:#BAE6FD;">
        <div class="card-title" style="color:#0369A1;">📌 규제 및 인허가 준수 가이드의 핵심 목적</div>
        <p style="font-size:7.5pt; color:#0C4A6E;">
          미국 화장품 규제 현대화법(MoCRA) 및 FDA 수출 규정에 따라, 입점 브랜드는 상품 등록 단계에서 상표권 증빙, 이중언어 전성분(INCI), 필수 인허가 성적서, 식별 바코드를 정확하게 등록해야 합니다. 본 매뉴얼은 브랜드가 손쉽게 서류를 업로드하고 감사 이력을 관리할 수 있는 명확한 표준 지침을 제공합니다.
        </p>
      </div>

      <div class="section-title">전체 6개 장(Chapter) 목차</div>
      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:18%;">장 (Chapter)</th>
            <th style="width:32%;">주요 주제 (Topic)</th>
            <th style="width:38%;">핵심 내용 및 기능 (Key Details)</th>
            <th style="width:12%;">페이지</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Chapter 01</b></td>
            <td>규제 &amp; 인허가 모듈 개요</td>
            <td>규제 관리 아키텍처, 4대 관리 영역, End-to-End 준수 라이프사이클 워크플로우</td>
            <td>p. 03 - 04</td>
          </tr>
          <tr>
            <td><b>Chapter 02</b></td>
            <td>브랜드 상표권(Trademark) 관리</td>
            <td>상표권 미보유 브랜드 개설 허용(Policy 02), KIPO/USPTO 등록번호 및 증빙 업로드</td>
            <td>p. 05 - 07</td>
          </tr>
          <tr>
            <td><b>Chapter 03</b></td>
            <td>전성분 선언 &amp; AI 번역기</td>
            <td>한/영 전성분 텍스트 입력, 실시간 AI INCI 표준 화장품 용어 번역기 활용</td>
            <td>p. 08 - 09</td>
          </tr>
          <tr>
            <td><b>Chapter 04</b></td>
            <td>인허가 서류 &amp; 버전 관리</td>
            <td>5대 서류 카테고리(FDA/상표권/성분/특허/기타), 파일 이력 버전 관리(v1 &rarr; v2)</td>
            <td>p. 10 - 11</td>
          </tr>
          <tr>
            <td><b>Chapter 05</b></td>
            <td>바코드 규격 &amp; 문의 채널</td>
            <td>12자리 UPC / 13자리 EAN 유효성 정규식 검증, 미보유 브랜드 전용 바코드 문의 지원</td>
            <td>p. 12 - 13</td>
          </tr>
          <tr>
            <td><b>Chapter 06</b></td>
            <td>어드민 감사 검증 &amp; 부록</td>
            <td>어드민 심사 화면, product_change_history 감사 로그, 헬프센터 1:1 지원 안내</td>
            <td>p. 14 - 15</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">4대 규제 준수 영역 (4 Core Compliance Pillars)</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🏷️ 1. 상표권 (Trademark Rights)</div>
          <div style="font-size:7pt; color:#475569;">
            &bull; 한국 특허청(KIPO) 및 미국 특허청(USPTO) 등록번호 관리<br/>
            &bull; 등록증 PDF/이미지 첨부 및 실시간 열람/교체 지원<br/>
            &bull; 상표권 미보유 브랜드도 카탈로그 등록 가능(Policy 02)
          </div>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🧪 2. 전성분 (INCI Ingredients)</div>
          <div style="font-size:7pt; color:#475569;">
            &bull; 국문/영문 전성분 텍스트 선언 및 성분표 파일 첨부<br/>
            &bull; 미국 MoCRA 기준 실시간 AI INCI 영문 번역기 제공<br/>
            &bull; 원클릭 필드 자동 반영 및 오탈자 사전 검증
          </div>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">📜 3. 인허가 서류 (Product Certs)</div>
          <div style="font-size:7pt; color:#475569;">
            &bull; 5대 표준 카테고리(FDA, 상표권, 성분인증, 특허, 기타)<br/>
            &bull; 재업로드 시 v1, v2 자동 버전 증가 및 과거 이력 보존<br/>
            &bull; MSDS(물질안전보건자료) / COA(시험성적서) 체계적 보관
          </div>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">📊 4. 식별 바코드 (Barcode Spec)</div>
          <div style="font-size:7pt; color:#475569;">
            &bull; 글로벌 표준 12자리 UPC 또는 13자리 EAN 필수 검증<br/>
            &bull; 10대 등록 완료 판정(COMPLETE) 핵심 조건<br/>
            &bull; 바코드 미발급 브랜드를 위한 전용 발급 지원 채널
          </div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">02</span>
    </div>
  </div>

  <!-- PAGE 3: CHAPTER 1 - ARCHITECTURE & LIFECYCLE -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 01</span> 규제 &amp; 인허가 모듈 개요 (Overview)</h1>
      
      <div class="section-title">1.1 시스템 목적 및 MoCRA 준수 배경</div>
      <p style="font-size:7.5pt; color:#334155;">
        미국 화장품 규제 현대화법(MoCRA, Modernization of Cosmetics Regulation Act)의 발효로 인해 미국 시장에 유통되는 모든 K-뷰티 상품은 정확한 원산지, 영문 전성분 목록(INCI), 안전성 시험성적서(COA/MSDS), FDA 시설 등록 증빙 등을 필수적으로 구비해야 합니다. K SELECT 네트워크는 브랜드 파트너사가 이러한 글로벌 규제 요건을 누락 없이 충족할 수 있도록 포털 시스템 내에 통합 인허가 모듈을 구축하였습니다.
      </p>

      <div class="grid-3" style="margin:4px 0;">
        <div class="card" style="background:#F8FAFC; border-left:3px solid #0284C7;">
          <div class="card-title" style="font-size:7.5pt; color:#0369A1;">⚡ 자동화 지원</div>
          <p style="font-size:6.5pt; color:#475569;">한글 전성분을 국제 표준 INCI 영문명으로 원클릭 실시간 AI 번역</p>
        </div>
        <div class="card" style="background:#F8FAFC; border-left:3px solid #10B981;">
          <div class="card-title" style="font-size:7.5pt; color:#047857;">📁 무손실 이력 보존</div>
          <p style="font-size:6.5pt; color:#475569;">서류 갱신 시 과거 파일 삭제 없이 v1, v2 자동 버전 증가</p>
        </div>
        <div class="card" style="background:#F8FAFC; border-left:3px solid #6366F1;">
          <div class="card-title" style="font-size:7.5pt; color:#4338CA;">🔒 데이터 무결성</div>
          <p style="font-size:6.5pt; color:#475569;">어드민과 포털 간 양방향 실시간 동기화 및 불변 감사 로그 기록</p>
        </div>
      </div>

      <div class="section-title">1.2 4대 규제 관리 테이블 아키텍처</div>
      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:22%;">테이블 (Table)</th>
            <th style="width:25%;">관리 대상 속성</th>
            <th style="width:28%;">데이터 필드 &amp; 타입</th>
            <th style="width:25%;">주요 연계 매뉴얼</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>brands</code></td>
            <td>브랜드 KIPO / USPTO 상표권</td>
            <td><code>has_kipo_trademark (bool)</code><br/><code>has_uspto_trademark (bool)</code></td>
            <td>MAN-BRAND-001 (Policy 02)<br/>MAN-B-ONB-001 (Step 3)</td>
          </tr>
          <tr>
            <td><code>products</code></td>
            <td>전성분 텍스트 &amp; 바코드</td>
            <td><code>ingredients_ko / en (text)</code><br/><code>barcode (12/13 digits)</code></td>
            <td>MAN-B-PROD-001 (Tab 1 &amp; Tab 4)<br/>10대 완료 조건</td>
          </tr>
          <tr>
            <td><code>product_certifications</code></td>
            <td>5대 인허가 서류 &amp; 버전</td>
            <td><code>category (enum 5종)</code><br/><code>version (int), is_current (bool)</code></td>
            <td>MAN-B-PROD-001 (Tab 6)<br/>MAN-B-REG-001</td>
          </tr>
          <tr>
            <td><code>product_change_history</code></td>
            <td>규제 서류 변경 감사 로그</td>
            <td><code>changed_by, diff_payload</code><br/><code>created_at (timestamp)</code></td>
            <td>MAN-B-PROD-001 (Tab 7)<br/>Admin Audit Queue</td>
          </tr>
        </tbody>
      </table>

      <div class="callout">
        <div class="callout-title">💡 브랜드 파트너사 필수 유의사항</div>
        상표권 등록증, 시험성적서, 전성분표는 파일 업로드와 동시에 안전한 비공개 스토리지(Private Storage)에 암호화 보관되며, 권한이 부여된 어드민 심사관 및 브랜드 담당자만 열람할 수 있습니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">03</span>
    </div>
  </div>

  <!-- PAGE 4: CHAPTER 1.2 - LIFECYCLE WORKFLOW -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 01</span> 규제 준수 엔드투엔드 워크플로우 (Lifecycle)</h1>
      
      <div class="section-title">1.3 브랜드 규제 &amp; 인허가 라이프사이클 다이어그램</div>
      
      <div class="card" style="background:#FFFFFF; border:1px solid #CBD5E1; padding:10px; text-align:center;">
        <div style="font-size:7.5pt; font-weight:800; color:#0F172A; margin-bottom:8px;">
          [규제 준수 4단계 프로세스 : 브랜드 등록 &rarr; 상품 등록 &rarr; 서류 버전 관리 &rarr; 어드민 심사]
        </div>
        
        <div style="display:flex; flex-direction:column; gap:6px; text-align:left;">
          <div style="display:flex; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:5px; padding:6px 10px;">
            <div style="width:24px; height:24px; background:#0284C7; color:#FFF; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:9pt; margin-right:10px;">1</div>
            <div style="flex:1;">
              <div style="font-weight:800; font-size:7.5pt; color:#0F172A;">[브랜드 개설 단계] 상표권 선언 (/portal/brands/new)</div>
              <div style="font-size:6.5pt; color:#64748B;">KIPO / USPTO 상표권 보유 여부 선택 &rarr; 등록번호 및 상표등록증 PDF/이미지 첨부 (미보유 시 체크 해제 후 개설 가능)</div>
            </div>
            <span class="badge badge-blue">Policy 02</span>
          </div>

          <div style="display:flex; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:5px; padding:6px 10px;">
            <div style="width:24px; height:24px; background:#10B981; color:#FFF; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:9pt; margin-right:10px;">2</div>
            <div style="flex:1;">
              <div style="font-weight:800; font-size:7.5pt; color:#0F172A;">[상품 기본정보] 전성분 선언 &amp; AI 번역 (/portal/products/[id] &bull; Tab 1)</div>
              <div style="font-size:6.5pt; color:#64748B;">한글 전성분 입력 &rarr; AI 실시간 번역기 실행 &rarr; INCI 표준 영문명 검토 후 원클릭 적용 &rarr; 전성분 파일 첨부</div>
            </div>
            <span class="badge badge-green">AI Tool</span>
          </div>

          <div style="display:flex; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:5px; padding:6px 10px;">
            <div style="width:24px; height:24px; background:#6366F1; color:#FFF; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:9pt; margin-right:10px;">3</div>
            <div style="flex:1;">
              <div style="font-weight:800; font-size:7.5pt; color:#0F172A;">[인허가 서류함] 5대 증빙 업로드 &amp; 버전 관리 (/portal/products/[id] &bull; Tab 6)</div>
              <div style="font-size:6.5pt; color:#64748B;">FDA등록증, 상표권, 성분인증(COA/MSDS), 특허, 기타 서류 등록 &rarr; 재업로드 시 v1 &rarr; v2 자동 버전 이력 보존</div>
            </div>
            <span class="badge badge-purple">Version Control</span>
          </div>

          <div style="display:flex; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:5px; padding:6px 10px;">
            <div style="width:24px; height:24px; background:#F59E0B; color:#FFF; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:9pt; margin-right:10px;">4</div>
            <div style="flex:1;">
              <div style="font-weight:800; font-size:7.5pt; color:#0F172A;">[식별 바코드 &amp; 어드민 심사] UPC/EAN 검증 및 어드민 승인</div>
              <div style="font-size:6.5pt; color:#64748B;">12자리 UPC / 13자리 EAN 유효성 통과 &rarr; 10대 완료 판정(COMPLETE) &rarr; 어드민 심사관 서류 대조 및 수출 승인</div>
            </div>
            <span class="badge badge-amber">Admin Audit</span>
          </div>
        </div>
      </div>

      <div class="section-title">1.4 규제 준수 상태 전이 규칙</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🔄 실시간 검증 (Instant Validation)</div>
          <p style="font-size:7pt; color:#475569;">
            바코드 12/13자리 정규식 및 필수 입력 필드는 클라이언트-서버 실시간 동기화로 즉시 검증되며, 누락 시 상품 상태가 <code>DRAFT</code>로 유지됩니다.
          </p>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">📋 불변 감사 로그 (Audit History)</div>
          <p style="font-size:7pt; color:#475569;">
            서류 업로드, 파일 교체, 성분 변경 등의 모든 이벤트는 타임스탬프와 작업자 ID를 포함하여 변경 이력 탭(Tab 7)에 영구 기록됩니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">04</span>
    </div>
  </div>

  <!-- PAGE 5: CHAPTER 2 - BRAND TRADEMARK -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 02</span> 브랜드 상표권(Trademark) 관리 (Policy 02)</h1>
      
      <div class="section-title">2.1 상표권 미보유 브랜드 개설 허용 정책 (Policy 02)</div>
      <p style="font-size:7.5pt; color:#334155;">
        K SELECT 네트워크는 유망한 신규 인디 브랜드의 신속한 시장 진입을 지원하기 위해 <b>상표권 미보유 브랜드의 포털 개설을 전면 허용</b>하고 있습니다. 특허청 상표 등록증이 없거나 출원 중인 상태라도 자유롭게 브랜드를 등록하고 상품 카탈로그를 작성할 수 있습니다.
      </p>

      <div class="card" style="background:#FFFBEB; border-color:#FDE68A; margin:3px 0;">
        <div class="card-title" style="color:#B45309;">💡 Policy 02 핵심 원칙</div>
        <div style="font-size:7pt; color:#92400E; line-height:1.45;">
          &bull; <b>상표권 미보유 시</b>: 브랜드 등록 화면에서 KIPO/USPTO 체크박스를 해제한 상태로 저장하면 정상 등록됩니다.<br/>
          &bull; <b>추후 상표권 획득 시</b>: 언제든지 브랜드 수정 화면(<code>/portal/brands/[id]</code>)에서 등록번호를 입력하고 증빙 서류를 추가할 수 있습니다.
        </div>
      </div>

      <div class="section-title">2.2 한/미 상표권 구분 및 증빙 요건</div>
      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:22%;">상표권 구분</th>
            <th style="width:28%;">등록 기관 &amp; 번호 체계</th>
            <th style="width:28%;">필수 증빙 서류</th>
            <th style="width:22%;">비고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>한국 상표권</b></td>
            <td>특허청 (KIPO)<br/><code>40-XXXX-XXXXXXX</code></td>
            <td>상표등록증 사본<br/>(PDF, JPG, PNG &bull; 최대 10MB)</td>
            <td>국내 권리 증빙</td>
          </tr>
          <tr>
            <td><b>미국 상표권</b></td>
            <td>미국 특허청 (USPTO)<br/><code>7자리 또는 8자리 등록번호</code></td>
            <td>USPTO Certificate of Registration<br/>(PDF, JPG, PNG)</td>
            <td>미국 수출 및 아마존 브랜드 레지스트리 활용</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">2.3 상표권 증빙 파일 저장 및 보안 원칙</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🔒 비공개 격리 스토리지</div>
          <p style="font-size:7pt; color:#475569;">
            상표등록증 등 민감한 기업 지식재산권 문서는 외부 공개 경로에 노출되지 않으며, 서버 사이드 서명 URL(Signed URL)을 통해서만 인가된 사용자에게 제공됩니다.
          </p>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">⚡ 원클릭 교체 및 열람</div>
          <p style="font-size:7pt; color:#475569;">
            등록된 파일은 <code>[보기]</code> 버튼으로 즉시 새 창에서 확인 가능하며, 갱신된 서류로 원클릭 파일 교체가 가능합니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">05</span>
    </div>
  </div>

  <!-- PAGE 6: CHAPTER 2.2 - SCREENSHOT SCR-B-REG-001 -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 02</span> 신규 브랜드 개설 시 상표권 입력 방법</h1>
      
      <div class="section-title">2.4 신규 브랜드 등록 화면 (SCR-B-REG-001 Walkthrough)</div>
      <p style="font-size:7.5pt; color:#334155;">
        브랜드 포털 좌측 메뉴 <b>[브랜드 관리]</b>에서 우측 상단 <b>[+ 새 브랜드 추가]</b>를 클릭하면 신규 등록 화면(<code>/portal/brands/new</code>)으로 이동합니다.
      </p>

      <div class="screenshot-container">
        <img src="${scrs.scr1}" alt="신규 브랜드 등록 상표권 섹션" />
        <div class="screenshot-caption">[그림 2-1] SCR-B-REG-001 : 신규 브랜드 등록 화면 — KIPO / USPTO 상표권 선택 및 증빙 파일 첨부 영역</div>
      </div>

      <div class="section-title">입력 단계별 가이드 (Step-by-Step Instructions)</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">1️⃣ KIPO 한국 상표권 등록</div>
          <p style="font-size:7pt; color:#475569;">
            한국 특허청 상표권이 있는 경우 체크박스를 클릭하고, 활성화된 입력창에 <b>상표 등록번호</b>를 입력한 후 <b>증빙 파일(PDF/이미지)</b>을 첨부합니다.
          </p>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">2️⃣ USPTO 미국 상표권 등록</div>
          <p style="font-size:7pt; color:#475569;">
            미국 상표권이 있는 경우 체크박스 선택 후 <b>USPTO 등록번호</b>와 <b>인증서 파일</b>을 첨부합니다. 상표권이 없는 경우 체크를 해제하고 다음 단계로 진행합니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">06</span>
    </div>
  </div>

  <!-- PAGE 7: CHAPTER 2.3 - SCREENSHOT SCR-B-REG-002 -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 02</span> 등록된 브랜드 상표권 수정 및 서류 관리</h1>
      
      <div class="section-title">2.5 브랜드 수정 화면 및 파일 열람 (SCR-B-REG-002 Walkthrough)</div>
      <p style="font-size:7.5pt; color:#334155;">
        이미 등록된 브랜드의 상표권 정보를 변경하거나 증빙 파일을 업데이트하려면 브랜드 목록에서 해당 브랜드의 <b>[수정]</b> 버튼을 클릭합니다 (<code>/portal/brands/[id]</code>).
      </p>

      <div class="screenshot-container">
        <img src="${scrs.scr2}" alt="브랜드 수정 상표권 파일 보기" />
        <div class="screenshot-caption">[그림 2-2] SCR-B-REG-002 : 브랜드 수정 화면 — 등록된 상표권 번호 및 첨부 서류 [보기] 링크</div>
      </div>

      <div class="section-title">주요 관리 기능 설명</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🔍 기존 증빙 서류 즉시 확인 [보기]</div>
          <p style="font-size:7pt; color:#475569;">
            이미 업로드된 상표권 서류가 있는 경우 <code>[보기]</code> 파란색 링크가 표시되며, 클릭 시 새 탭에서 원본 문서를 즉시 열람하여 유효성을 재확인할 수 있습니다.
          </p>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🔄 서류 갱신 및 파일 교체</div>
          <p style="font-size:7pt; color:#475569;">
            상표권 갱신 등으로 증빙 문서를 교체해야 하는 경우, <code>[파일 선택]</code>으로 새 파일을 첨부하고 <code>[저장]</code>을 누르면 기존 파일이 안전하게 교체됩니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">07</span>
    </div>
  </div>

  <!-- PAGE 8: CHAPTER 3 - INGREDIENTS DECLARATION -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 03</span> 전성분 선언 &amp; AI 번역기 (Ingredients)</h1>
      
      <div class="section-title">3.1 전성분 이중언어(한/영) 선언 요건</div>
      <p style="font-size:7.5pt; color:#334155;">
        미국 FDA 및 온/오프라인 바이어 규정에 따라 상품 등록 시 한글 전성분과 <b>국제 화장품 성분 명명법(INCI, International Nomenclature of Cosmetic Ingredients)</b>에 부합하는 영문 전성분을 모두 필수로 선언해야 합니다.
      </p>

      <div class="card" style="background:#F0FDF4; border-color:#BBF7D0; margin:3px 0;">
        <div class="card-title" style="color:#166534;">🌿 전성분 3대 입력 필드 (Tab 1: 기본 정보)</div>
        <div style="font-size:7pt; color:#14532D; line-height:1.45;">
          1. <b>전성분 텍스트 (국문)</b> : 한글 공식 전성분 목록 (배합량 순서대로 기재)<br/>
          2. <b>전성분 텍스트 (영문 INCI)</b> : 표준 영문 성분명 (AI 번역기 원클릭 생성 지원)<br/>
          3. <b>전성분표 원본 서류 첨부</b> : 제조사 성분 분석표 또는 국문/영문 라벨 증빙 파일 (PDF/이미지)
        </div>
      </div>

      <div class="section-title">3.2 AI 실시간 영문 번역기 기술 스펙</div>
      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:25%;">항목 (Feature)</th>
            <th style="width:35%;">시스템 스펙 &amp; 동작 방식</th>
            <th style="width:40%;">브랜드 실무 이점</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>INCI 사전 연동</b></td>
            <td>수만 건의 화장품 공식 INCI 데이터베이스 매핑</td>
            <td>일반 번역기(구글/파파고)의 성분명 오역 방지</td>
          </tr>
          <tr>
            <td><b>실시간 번역 모달</b></td>
            <td>국문 텍스트 분석 후 실시간 모달 팝업 렌더링</td>
            <td>번역 전/후 성분 일대일 대조 검토 가능</td>
          </tr>
          <tr>
            <td><b>원클릭 필드 적용</b></td>
            <td><code>[리뷰 완료 및 적용]</code> 클릭 시 영문 필드 자동 입력</td>
            <td>복사/붙여넣기 실수 원천 차단 및 등록 시간 단축</td>
          </tr>
        </tbody>
      </table>

      <div class="callout">
        <div class="callout-title">💡 MSDS / COA 연계 보관 안내</div>
        전성분 텍스트 외에 전문 기관의 시험성적서(COA) 또는 물질안전보건자료(MSDS)는 <b>[인허가 &amp; 보증서] 탭(Tab 6)</b>의 <code>ingredient_certification</code> 카테고리에 별도로 업로드하여 체계적으로 관리하십시오.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">08</span>
    </div>
  </div>

  <!-- PAGE 9: CHAPTER 3.2 - SCREENSHOTS SCR-B-REG-003 & 004 -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 03</span> AI 전성분 번역기 실행 및 적용 화면</h1>
      
      <div class="section-title">3.3 AI 번역기 실행 화면 (SCR-B-REG-003 Walkthrough)</div>
      <p style="font-size:7.5pt; color:#334155;">
        상품 상세 화면(<code>/portal/products/[id]</code>)의 <b>[기본 정보]</b> 탭에서 국문 전성분을 입력한 후 <b>[번역하기 (Translate)]</b> 버튼을 클릭합니다.
      </p>

      <div class="screenshot-container" style="margin-bottom:6px;">
        <img src="${scrs.scr3}" alt="전성분 입력 및 번역 버튼" style="max-height:48mm;" />
        <div class="screenshot-caption">[그림 3-1] SCR-B-REG-003 : 국문 전성분 입력 영역 및 실시간 AI 번역 실행 버튼</div>
      </div>

      <div class="section-title">3.4 INCI 번역 결과 검토 및 원클릭 적용 (SCR-B-REG-004 Walkthrough)</div>
      <div class="screenshot-container">
        <img src="${scrs.scr4}" alt="AI 번역 결과 모달 및 적용" style="max-height:48mm;" />
        <div class="screenshot-caption">[그림 3-2] SCR-B-REG-004 : AI INCI 영문 번역 결과 모달 — [리뷰 완료 및 적용] 클릭 시 자동 입력</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">09</span>
    </div>
  </div>

  <!-- PAGE 10: CHAPTER 4 - CERTIFICATES UPLOAD -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 04</span> 인허가 서류 업로드 &amp; 버전 관리 (Tab 6)</h1>
      
      <div class="section-title">4.1 5대 인허가 서류 카테고리 (Certificate Categories)</div>
      <p style="font-size:7.5pt; color:#334155;">
        상품 상세 화면의 <b>[인허가 &amp; 보증서] 탭(Tab 6)</b>은 미국 수출 및 규제 준수를 위한 5가지 표준 카테고리를 제공합니다.
      </p>

      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:25%;">카테고리 코드 (Code)</th>
            <th style="width:20%;">UI 표시 명칭</th>
            <th style="width:55%;">서류 설명 및 업로드 예시</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>fda_registration</code></td>
            <td><b>FDA 등록</b></td>
            <td>FDA 시설 등록(FFRM), 제품 리스팅(PDRM) 확인증, DUNS 번호 증빙 등</td>
          </tr>
          <tr>
            <td><code>trademark</code></td>
            <td><b>상표권</b></td>
            <td>특정 개별 상품에 부여된 전용 상표등록증, 라이선스 계약서 사본</td>
          </tr>
          <tr>
            <td><code>ingredient_certification</code></td>
            <td><b>성분 인증</b></td>
            <td>전성분 분석표, <b>MSDS (물질안전보건자료)</b>, <b>COA (시험성적서)</b>, 비건/유기농 인증</td>
          </tr>
          <tr>
            <td><code>patent</code></td>
            <td><b>특허</b></td>
            <td>특수 용기 구조 특허, 독자 유효 성분 추출 기술 특허증 사본</td>
          </tr>
          <tr>
            <td><code>other</code></td>
            <td><b>기타</b></td>
            <td>위생 허가증, 자유판매증명서(CFS), 원산지 증명서(C/O), 품질보증서 등</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">4.2 무손실 자동 버전 관리 (Lossless Version Control) 규칙</div>
      <div class="grid-2">
        <div class="card" style="background:#F0FDF4; border-color:#BBF7D0;">
          <div class="card-title" style="color:#166534;">📜 버전 번호 자동 증가 (+1)</div>
          <p style="font-size:7pt; color:#14532D;">
            동일한 서류 카테고리에 새 파일을 업로드하면 시스템이 자동으로 <code>Version 1 &rarr; Version 2</code>로 버전 번호를 증가시키며 최신 유효 문서(<code>is_current: true</code>)로 지정합니다.
          </p>
        </div>
        <div class="card" style="background:#F8FAFC; border-color:#E2E8F0;">
          <div class="card-title" style="color:#0F172A;">🗂️ 과거 이력 영구 보존</div>
          <p style="font-size:7pt; color:#475569;">
            이전 버전의 파일은 덮어쓰거나 삭제되지 않고 <code>is_current: false</code> 상태로 데이터베이스에 영구 보존되어, 감사 시 과거 제출 서류를 언제든지 대조할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">10</span>
    </div>
  </div>

  <!-- PAGE 11: CHAPTER 4.2 - SCREENSHOTS SCR-B-REG-005 & 006 -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 04</span> 인허가 서류 관리 화면 및 카테고리 선택</h1>
      
      <div class="section-title">4.3 인허가 서류 목록 및 버전 표시 (SCR-B-REG-005 Walkthrough)</div>
      <p style="font-size:7.5pt; color:#334155;">
        업로드된 인허가 서류는 카테고리명, 파일명, 등록 일시 및 현재 버전(Version 1, Version 2 등)이 뱃지 형태로 깔끔하게 표시됩니다.
      </p>

      <div class="screenshot-container" style="margin-bottom:6px;">
        <img src="${scrs.scr5}" alt="인허가 서류 목록 및 버전" style="max-height:48mm;" />
        <div class="screenshot-caption">[그림 4-1] SCR-B-REG-005 : 인허가 &amp; 보증서 탭 — 등록된 서류 목록, 버전 표시 및 파일 다운로드 영역</div>
      </div>

      <div class="section-title">4.4 5가지 서류 카테고리 드롭다운 (SCR-B-REG-006 Walkthrough)</div>
      <div class="screenshot-container">
        <img src="${scrs.scr6}" alt="서류 카테고리 선택 드롭다운" style="max-height:48mm;" />
        <div class="screenshot-caption">[그림 4-2] SCR-B-REG-006 : 서류 등록 팝업 — 5대 표준 카테고리(FDA/상표권/성분인증/특허/기타) 선택 드롭다운</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">11</span>
    </div>
  </div>

  <!-- PAGE 12: CHAPTER 5 - BARCODE SPECIFICATIONS -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 05</span> 바코드 규격 &amp; 문의 채널 (Barcode Spec)</h1>
      
      <div class="section-title">5.1 UPC / EAN 글로벌 바코드 규격 검증 규칙</div>
      <p style="font-size:7.5pt; color:#334155;">
        K SELECT 네트워크 상품이 최종 승인(COMPLETE) 판정을 받기 위해서는 <b>글로벌 공인 12자리 UPC 또는 13자리 EAN 바코드</b>가 반드시 입력되어야 합니다. (10대 상품 등록 완료 판정 기준 9번 항목)
      </p>

      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:25%;">바코드 종류</th>
            <th style="width:25%;">자릿수 규격</th>
            <th style="width:25%;">정규식 검증식</th>
            <th style="width:25%;">주요 적용 지역</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>UPC-A 바코드</b></td>
            <td>정확히 <b>12자리 숫자</b></td>
            <td><code>/^\\d{12}$/</code></td>
            <td>미국 / 북미 리테일 표준</td>
          </tr>
          <tr>
            <td><b>EAN-13 바코드</b></td>
            <td>정확히 <b>13자리 숫자</b></td>
            <td><code>/^\\d{13}$/</code></td>
            <td>한국 / 유럽 / 글로벌 표준</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">5.2 유효성 검증 실패 시 시스템 동작</div>
      <div class="card" style="background:#FEF2F2; border-color:#FECACA; margin:3px 0;">
        <div class="card-title" style="color:#991B1B;">⚠️ 바코드 자릿수 오류 시 시스템 동작</div>
        <p style="font-size:7pt; color:#7F1D1D; line-height:1.45;">
          &bull; 12자리 또는 13자리가 아니거나 문자가 포함된 경우 등록 판정기(Registration Evaluator)가 바코드 누락으로 인식합니다.<br/>
          &bull; 상단 배너에 <code>[식별 바코드 누락]</code> 붉은색 뱃지가 표시되며, 상품 등록 상태가 <code>DRAFT(보완 대기)</code>로 유지됩니다.
        </p>
      </div>

      <div class="section-title">5.3 바코드 미보유 브랜드 전용 문의 지원 채널</div>
      <p style="font-size:7.5pt; color:#334155;">
        바코드가 아직 발급되지 않은 신규 브랜드는 입력창 우측의 <b>[새 바코드 문의]</b> 링크를 클릭하여 운영팀에 GS1 공인 바코드 발급 지원 또는 임시 코드 발급 상담을 원클릭으로 요청할 수 있습니다.
      </p>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">12</span>
    </div>
  </div>

  <!-- PAGE 13: CHAPTER 5.2 - SCREENSHOT SCR-B-REG-007 -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 05</span> 식별 바코드 입력 및 문의 화면</h1>
      
      <div class="section-title">5.4 바코드 입력 필드 및 지원 링크 (SCR-B-REG-007 Walkthrough)</div>
      <p style="font-size:7.5pt; color:#334155;">
        상품 등록/수정 화면의 바코드 입력 영역에서 12/13자리 바코드를 입력하거나 <b>[새 바코드 문의]</b> 링크를 통해 고객지원으로 연결할 수 있습니다.
      </p>

      <div class="screenshot-container">
        <img src="${scrs.scr7}" alt="바코드 입력창 및 문의 링크" />
        <div class="screenshot-caption">[그림 5-1] SCR-B-REG-007 : 식별 바코드(UPC/EAN) 입력창 및 우측 [새 바코드 문의] 고객지원 연결 링크</div>
      </div>

      <div class="section-title">바코드 실무 FAQ 요약</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">Q. 8자리 단축형 EAN-8도 가능한가요?</div>
          <p style="font-size:7pt; color:#475569;">
            미국 리테일러 입점 및 자동 스캐닝 시스템 호환성을 위해 표준 12자리 UPC 또는 13자리 EAN만 허용됩니다.
          </p>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">Q. 바코드 중복 시 어떻게 되나요?</div>
          <p style="font-size:7pt; color:#475569;">
            동일 브랜드 또는 타사 상품과 바코드가 중복되는 경우 시스템에서 고유성 경고가 발생하므로 개별 SKU마다 고유 코드를 부여해야 합니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">13</span>
    </div>
  </div>

  <!-- PAGE 14: CHAPTER 6 - ADMIN AUDIT & SCR-B-REG-008 -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">Chapter 06</span> 어드민 감사 검증 &amp; 변경 이력 (Audit)</h1>
      
      <div class="section-title">6.1 어드민(Admin) 심사관 서류 대조 및 검증 화면</div>
      <p style="font-size:7.5pt; color:#334155;">
        브랜드사가 등록한 상표권 증빙 및 인허가 서류는 K SELECT 운영팀의 어드민 상세 화면(<code>/admin/brands/[brandId]</code> 및 <code>/admin/products/[id]</code>)에서 실시간으로 대조 및 심사됩니다.
      </p>

      <div class="screenshot-container">
        <img src="${scrs.scr8}" alt="어드민 서류 심사 화면" />
        <div class="screenshot-caption">[그림 6-1] SCR-B-REG-008 : 어드민 브랜드 상세 화면 — 등록된 상표권 카드, 증빙 파일 열람/다운로드 버튼</div>
      </div>

      <div class="section-title">6.2 불변 변경 이력 감사 로그 (product_change_history)</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="color:#0F172A;">🔒 변경 전/후 Diff 기록</div>
          <p style="font-size:7pt; color:#475569;">
            서류 추가, 성분 수정, 바코드 갱신 시 변경 전(previous)과 변경 후(new) 데이터가 JSON diff 형태로 영구 보존됩니다.
          </p>
        </div>
        <div class="card">
          <div class="card-title" style="color:#0F172A;">⚡ 실시간 UI 재검증 (Revalidation)</div>
          <p style="font-size:7pt; color:#475569;">
            어드민이 서류를 승인하거나 보완 요청을 등록하면 <code>revalidatePath</code>를 통해 브랜드 포털 화면에 즉시 동기화 반영됩니다.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">14</span>
    </div>
  </div>

  <!-- PAGE 15: CHAPTER 6.3 - APPENDIX & HELP CENTER -->
  <div class="page">
    <div class="page-header">
      <span class="header-logo">K SELECT NETWORK &bull; BRAND PORTAL MANUAL</span>
      <span class="header-doc-id">MAN-B-REG-001 &bull; v1.1.0</span>
    </div>
    
    <div class="page-content">
      <h1 class="chapter-title"><span class="chapter-tag">부록</span> 규제 준수 체크리스트 &amp; 고객지원 (Appendix)</h1>
      
      <div class="section-title">규제 준수 최종 점검 체크리스트 (Pre-Flight Checklist)</div>
      <table class="spec-table">
        <thead>
          <tr>
            <th style="width:10%; text-align:center;">체크</th>
            <th style="width:30%;">점검 항목</th>
            <th style="width:45%;">확인 내용 및 기준</th>
            <th style="width:15%;">참조 경로</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;">&square;</td>
            <td><b>상표권 정보 확인</b></td>
            <td>KIPO 또는 USPTO 등록번호 입력 및 증빙 첨부 (미보유 시 미체크 확인)</td>
            <td>브랜드 정보</td>
          </tr>
          <tr>
            <td style="text-align:center;">&square;</td>
            <td><b>이중언어 전성분 선언</b></td>
            <td>국문 전성분 입력 후 AI INCI 영문 번역기 실행 및 원클릭 적용 완료</td>
            <td>상품 탭 1</td>
          </tr>
          <tr>
            <td style="text-align:center;">&square;</td>
            <td><b>5대 인허가 서류 첨부</b></td>
            <td>FDA등록증, COA/MSDS 등 필수 인증 서류 적정 카테고리에 업로드</td>
            <td>상품 탭 6</td>
          </tr>
          <tr>
            <td style="text-align:center;">&square;</td>
            <td><b>식별 바코드 정규식 검증</b></td>
            <td>12자리 UPC 또는 13자리 EAN 숫자 규격 일치 확인 (DRAFT 해제 조건)</td>
            <td>상품 탭 4</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">고객지원 및 헬프센터 1:1 문의 안내</div>
      <div class="card" style="background:#F0F9FF; border-color:#BAE6FD; padding:10px;">
        <div class="card-title" style="color:#0369A1;">📞 Help Center 1:1 전문 규제 상담</div>
        <p style="font-size:7.5pt; color:#0C4A6E; line-height:1.5;">
          MoCRA 시설 등록 대행, 성분 분석표 영문 검토, GS1 바코드 발급 지원 등 규제 준수 과정에서 전문가의 도움이 필요한 경우 <b>[Help Center &rarr; 1:1 Inquiry]</b> 메뉴를 통해 전담 규제 담당자(Regulatory Specialist)의 지원을 받으실 수 있습니다.
        </p>
      </div>

      <div class="section-title">K SELECT 공식 매뉴얼 시리즈 연계 가이드</div>
      <div class="grid-3">
        <div class="card">
          <div class="card-title" style="font-size:7.5pt;">MAN-BRAND-001</div>
          <div style="font-size:6.5pt; color:#475569;">브랜드 등록 및 상표권 정책 (Policy 02)</div>
        </div>
        <div class="card">
          <div class="card-title" style="font-size:7.5pt;">MAN-B-PROD-001</div>
          <div style="font-size:6.5pt; color:#475569;">상품 등록 및 6대 탭 관리 가이드</div>
        </div>
        <div class="card">
          <div class="card-title" style="font-size:7.5pt;">MAN-B-ORD-001</div>
          <div style="font-size:6.5pt; color:#475569;">발주 요청 및 오더 라이프사이클 관리</div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-REG-001</span>
      <span class="page-num">15</span>
    </div>
  </div>

</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const destDir = path.join(__dirname, '..', 'Manuals', 'MAN-B-REG-001_Regulatory-Compliance', '03_PUBLISHED');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const pdfPath = path.join(destDir, 'MAN-B-REG-001_Regulatory-Compliance_V1.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
  });

  await browser.close();

  const stats = fs.statSync(pdfPath);
  console.log(`✓ PDF Successfully Generated at: ${pdfPath}`);
  console.log(`  File Size: ${stats.size} bytes`);
}

generatePdf().catch(console.error);
