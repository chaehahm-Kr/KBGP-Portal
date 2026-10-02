const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function getImageBase64(relPath) {
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(__dirname, '..', relPath);
  if (fs.existsSync(fullPath)) {
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const data = fs.readFileSync(fullPath);
    return `data:${mime};base64,${data.toString('base64')}`;
  }
  return '';
}

async function buildHtml() {
  const scrDir = 'Manuals/MAN-B-ORD-001_Order-Management/02_CLAUDE_PACKAGE/02_SCREENSHOTS';
  const logoLight = getImageBase64('public/ksn-logo-new.png') || getImageBase64('public/ksn-logo-admin.png');
  const logoDark = getImageBase64('public/ksn-logo-dark.png') || getImageBase64('public/ksn-logo.jpg');

  const scrs = {};
  for (let i = 1; i <= 15; i++) {
    const numStr = String(i).padStart(3, '0');
    scrs[`scr${i}`] = getImageBase64(`${scrDir}/SCR-B-ORD-${numStr}.png`);
  }

  const css = `
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
    
    @page {
      size: 210mm 297mm;
      margin: 0;
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F1F5F9;
      color: #0F172A;
      font-size: 9pt;
      line-height: 1.45;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 16mm 18mm 14mm 18mm;
      margin: 0 auto;
      background: #FFFFFF;
      position: relative;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    
    /* Cover Page */
    .page-cover {
      background: linear-gradient(135deg, #090D16 0%, #111827 50%, #1E293B 100%);
      color: #FFFFFF;
      padding: 24mm 20mm 20mm 20mm;
    }
    
    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.15);
      padding-bottom: 16px;
    }
    
    .cover-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .cover-brand img {
      height: 28px;
    }
    
    .cover-badge {
      background: rgba(37, 99, 235, 0.2);
      border: 1px solid #3B82F6;
      color: #93C5FD;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    
    .cover-body {
      margin-top: 45mm;
    }
    
    .cover-doc-id {
      color: #38BDF8;
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.15em;
      margin-bottom: 10px;
    }
    
    .cover-title {
      font-size: 26pt;
      font-weight: 900;
      line-height: 1.25;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    
    .cover-subtitle {
      font-size: 13pt;
      color: #94A3B8;
      font-weight: 500;
      margin-bottom: 24px;
      line-height: 1.4;
    }
    
    .cover-tags {
      display: flex;
      gap: 8px;
      margin-bottom: 30px;
    }
    
    .cover-tag {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #E2E8F0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 8pt;
      font-weight: 600;
    }
    
    .cover-footer {
      border-top: 1px solid rgba(255,255,255,0.15);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      color: #64748B;
      font-size: 8pt;
    }
    
    /* Inner Page Headers & Footers */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    
    .header-left {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    
    .header-right {
      font-size: 7.5pt;
      font-weight: 600;
      color: #0284C7;
    }
    
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #E2E8F0;
      padding-top: 6px;
      margin-top: 8px;
      font-size: 7.5pt;
      color: #94A3B8;
    }
    
    .page-num {
      font-weight: 700;
      color: #0F172A;
    }
    
    /* Content Layout */
    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    }
    
    .chapter-tag {
      display: inline-block;
      background: #E0F2FE;
      color: #0369A1;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 800;
      margin-bottom: 2px;
      letter-spacing: 0.03em;
    }
    
    .chapter-title {
      font-size: 14pt;
      font-weight: 900;
      color: #0F172A;
      margin: 0 0 4px 0;
      letter-spacing: -0.01em;
    }
    
    .section-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1E293B;
      margin: 6px 0 2px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .section-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 12px;
      background: #0284C7;
      border-radius: 2px;
    }
    
    p {
      margin: 0 0 5px 0;
      color: #334155;
    }
    
    /* Cards & Boxes */
    .card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 6px;
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
      gap: 6px;
    }
    
    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px;
    }
    
    /* Callouts */
    .callout {
      border-left: 3px solid;
      border-radius: 0 6px 6px 0;
      padding: 6px 10px;
      margin: 4px 0;
      font-size: 8pt;
    }
    
    .callout-info {
      background: #F0F9FF;
      border-color: #0284C7;
      color: #0369A1;
    }
    
    .callout-success {
      background: #ECFDF5;
      border-color: #059669;
      color: #065F46;
    }
    
    .callout-warning {
      background: #FFFBEB;
      border-color: #D97706;
      color: #92400E;
    }
    
    .callout-danger {
      background: #FFF1F2;
      border-color: #E11D48;
      color: #9F1239;
    }
    
    .callout-title {
      font-weight: 800;
      font-size: 8pt;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    /* Stepper Flow */
    .stepper {
      display: flex;
      gap: 4px;
      margin: 6px 0;
    }
    
    .step-item {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 6px 6px;
      text-align: center;
    }
    
    .step-num {
      display: inline-block;
      width: 18px;
      height: 18px;
      line-height: 18px;
      border-radius: 50%;
      background: #0284C7;
      color: #FFFFFF;
      font-size: 7pt;
      font-weight: 800;
      margin-bottom: 2px;
    }
    
    .step-name {
      font-size: 7.5pt;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 1px;
    }
    
    .step-desc {
      font-size: 6.5pt;
      color: #64748B;
      line-height: 1.2;
    }
    
    /* Screenshot Box */
    .screenshot-box {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
      background: #FFFFFF;
      margin: 4px 0;
    }
    
    .screenshot-header {
      background: #F1F5F9;
      border-bottom: 1px solid #E2E8F0;
      padding: 3px 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .dot-red { background: #EF4444; }
    .dot-yellow { background: #F59E0B; }
    .dot-green { background: #10B981; }
    
    .browser-url {
      font-size: 6.5pt;
      color: #64748B;
      background: #FFFFFF;
      padding: 1px 6px;
      border-radius: 3px;
      margin-left: 6px;
      border: 1px solid #E2E8F0;
      font-family: monospace;
    }
    
    .screenshot-box img {
      width: 100%;
      display: block;
      max-height: 120mm;
      object-fit: contain;
      background: #FAF5FF;
    }
    
    .screenshot-caption {
      font-size: 7pt;
      color: #64748B;
      padding: 4px 8px;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      font-weight: 600;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin: 4px 0;
    }
    
    th {
      background: #F1F5F9;
      color: #1E293B;
      font-weight: 800;
      text-align: left;
      padding: 5px 6px;
      border: 1px solid #E2E8F0;
    }
    
    td {
      padding: 4px 6px;
      border: 1px solid #E2E8F0;
      color: #334155;
    }
    
    tr:nth-child(even) td {
      background: #F8FAFC;
    }
    
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 6.5pt;
      font-weight: 700;
    }
    .badge-blue { background: #DBEAFE; color: #1D4ED8; }
    .badge-green { background: #D1FAE5; color: #047857; }
    .badge-yellow { background: #FEF3C7; color: #B45309; }
    .badge-purple { background: #EDE9FE; color: #6D28D9; }
    .badge-gray { background: #F1F5F9; color: #475569; }
    .badge-rose { background: #FFE4E6; color: #BE123C; }
  `;

  // HTML content generator for 20 pages
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body>
`;

  // PAGE 1: COVER
  html += `
  <div class="page page-cover">
    <div class="cover-header">
      <div class="cover-brand">
        <span style="font-weight: 900; font-size: 14pt; letter-spacing: 0.05em;">K SELECT NETWORK</span>
      </div>
      <div class="cover-badge">OFFICIAL USER MANUAL</div>
    </div>
    
    <div class="cover-body">
      <div class="cover-doc-id">DOCUMENT ID : MAN-B-ORD-001</div>
      <div class="cover-title">Purchase Orders &amp;<br/>Order Management Guide</div>
      <div class="cover-subtitle">K SELECT Brand Portal 발주 요청 &amp; 오더 관리 공식 사용자 매뉴얼</div>
      
      <div class="cover-tags">
        <span class="cover-tag">Audience : Brand Portal (B)</span>
        <span class="cover-tag">Version : v1.0</span>
        <span class="cover-tag">Module : Orders &amp; Purchasing</span>
        <span class="cover-tag">System Date : 2026-10-01</span>
      </div>
    </div>
    
    <div class="cover-footer">
      <div>Author : K SELECT Operations Governance Desk</div>
      <div>Confidential &amp; Proprietary &copy; 2026 Letusto Inc. All Rights Reserved.</div>
    </div>
  </div>
  `;

  // PAGE 2: TABLE OF CONTENTS & CORE PRINCIPLES
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT Brand Portal Manual Series</span>
      <span class="header-right">MAN-B-ORD-001 : Document Index</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">OVERVIEW &amp; CONTENTS</span>
      <h1 class="chapter-title">매뉴얼 목차 및 핵심 원칙 가이드</h1>
      
      <div class="grid-2">
        <div class="card" style="background:#F8FAFC;">
          <div class="card-title">📖 전체 목차 (Table of Contents)</div>
          <table style="font-size:7pt;">
            <tr><th style="width:35px;">Ch.</th><th>장별 제목 및 주요 다룸 내용</th><th style="width:30px;">Page</th></tr>
            <tr><td><b>01</b></td><td><b>오더 관리 개요 &amp; Dual-Track PO 아키텍처</b></td><td>03-04</td></tr>
            <tr><td><b>02</b></td><td><b>공급사 발주 요청(PO Request) 생성 및 제출</b></td><td>05-08</td></tr>
            <tr><td><b>03</b></td><td><b>발주 요청 심사 및 공식 발주서(PO) 전환</b></td><td>09</td></tr>
            <tr><td><b>04</b></td><td><b>공식 발주서(PO) 검토 및 공급사 수락/변경</b></td><td>10-12</td></tr>
            <tr><td><b>05</b></td><td><b>출고 준비(Goods Ready) &amp; 선적 분기</b></td><td>13-15</td></tr>
            <tr><td><b>06</b></td><td><b>입고 검수 &amp; 정산 인보이스 Handoff 경계</b></td><td>16-17</td></tr>
            <tr><td><b>07</b></td><td><b>전사 선적 추적 허브(Shipping Hub)</b></td><td>18</td></tr>
            <tr><td><b>08</b></td><td><b>자주 묻는 질문 (FAQ 8선)</b></td><td>19</td></tr>
            <tr><td><b>App.</b></td><td><b>상태 머신 요약표 &amp; 실무 체크리스트</b></td><td>20</td></tr>
          </table>
        </div>
        
        <div class="card" style="background:#EFF6FF; border-color:#BFDBFE;">
          <div class="card-title" style="color:#1E40AF;">⚖️ 3대 핵심 거버넌스 원칙 (Core Rules)</div>
          <div style="font-size:7.5pt; color:#1E3A8A; display:flex; flex-direction:column; gap:6px;">
            <div>
              <b>1. 입점 승인 &ne; 발주서 자동 발행</b><br/>
              리테일 입점 승인(MAN-B-RET-001)은 파트너 자격 획득 절차이며, 실제 생산/출고는 공식 발주서(PO)를 통해서만 진행됩니다.
            </div>
            <div>
              <b>2. LOG와 FIN의 병렬 도메인 분기</b><br/>
              공식 발주서가 확정(CONFIRMED)되면 <b>물류(출고/선적)</b>와 <b>재무(정산 인보이스)</b>는 각각 독립된 병렬 트랙으로 진행됩니다.
            </div>
            <div>
              <b>3. COMPLETED = 오더 이행 종결</b><br/>
              오더 상태 <code>COMPLETED</code>는 미국 물류센터 검수 및 오더 이행 완료를 의미하며, <b>대금 정산 완료(Settlement Complete)와 엄격히 구분</b>됩니다.
            </div>
          </div>
        </div>
      </div>
      
      <div class="section-title">오더 &amp; 물류 &amp; 재무 라이프사이클 도메인 맵</div>
      <div class="card" style="background:#FFFFFF; border:1px solid #CBD5E1; text-align:center; padding:10px;">
        <div style="font-size:8pt; font-weight:800; color:#0F172A; margin-bottom:6px;">
          [공식 발주서 확정] (po_status IN ('APPROVED','SENT') &amp; supplier_confirmation = 'CONFIRMED')
        </div>
        <div style="display:flex; justify-content:space-around; align-items:center;">
          <div style="flex:1; background:#F0FDF4; border:1px solid #86EFAC; border-radius:6px; padding:8px; margin:0 4px;">
            <div style="font-weight:800; color:#166534; font-size:7.5pt;">📦 [LOG] 선적 &amp; 물류 도메인 (MAN-B-LOG-001)</div>
            <div style="font-size:6.5pt; color:#14532D; margin-top:3px;">출고 준비 &rarr; 포워더 인계 / 운송사 발송 &rarr; 미국 물류센터 도착 &rarr; 실물 입고 검수 &rarr; <b>COMPLETED</b></div>
          </div>
          <div style="font-size:14pt; font-weight:900; color:#94A3B8;">&cap;</div>
          <div style="flex:1; background:#FDF2F8; border:1px solid #F472B6; border-radius:6px; padding:8px; margin:0 4px;">
            <div style="font-weight:800; color:#9D174D; font-size:7.5pt;">💳 [FIN] 재무 &amp; 정산 도메인 (MAN-B-FIN-001)</div>
            <div style="font-size:6.5pt; color:#831843; margin-top:3px;">공급사 인보이스 생성 &rarr; AP 심사 &rarr; 지급 승인 &rarr; 계약 조건에 따른 <b>정산 대금 지급(PAID)</b></div>
          </div>
        </div>
        <div style="font-size:6.5pt; color:#64748B; margin-top:6px; font-weight:600;">
          &lowast; ARRIVED &ne; RECEIVED &ne; COMPLETED &ne; PAID | Shipping Complete &ne; Settlement Complete
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">02</span>
    </div>
  </div>
  `;

  // PAGE 3: CHAPTER 01 - DUAL-TRACK PO ARCHITECTURE
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 01 : Order Architecture &amp; Overview</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 01</span>
      <h1 class="chapter-title">오더 관리 개요 및 이원화(Dual-Track) 발주 체계</h1>
      
      <div class="card">
        <div class="card-title">1.1 K SELECT 오더 관리 시스템의 목적</div>
        <p>K SELECT Brand Portal의 **오더 관리(Order Management)** 시스템은 파트너 브랜드사가 미국 시장 유통을 위해 발생하는 모든 발주 요청, 공식 발주서 수락, 출고 준비, 선적 운송 및 미국 현지 물류센터 입고 검수 이력을 투명하게 관리하는 핵심 시스템입니다.</p>
      </div>
      
      <div class="section-title">1.2 이원화 발주 아키텍처 (Dual-Track PO Architecture)</div>
      <p>K SELECT는 파트너사의 생산 스케줄 자율성과 본사의 전략적 공급 계획을 조화롭게 지원하기 위해 **2가지 경로의 발주 체계**를 운영합니다.</p>
      
      <div class="grid-2">
        <div class="card" style="border-top:3px solid #3B82F6;">
          <div class="card-title" style="color:#1D4ED8;">Track A: 공급사 발주 요청 (Brand PO Request)</div>
          <ul style="margin:0; padding-left:14px; font-size:7.5pt; color:#334155; line-height:1.4;">
            <li><b>발주 주체:</b> 공급사 (Brand Portal Operator / Admin)</li>
            <li><b>발생 시점:</b> 공급사가 생산 일정, 프로모션 계획, 자사 재고에 맞춰 본사 앞 공급을 먼저 제안할 때</li>
            <li><b>진행 경로:</b> <code>공급사 작성(Draft)</code> &rarr; <code>제출(Submitted)</code> &rarr; <code>본사 MD 심사(Review)</code> &rarr; <code>공식 발주서 전환(Converted to PO)</code></li>
            <li><b>메뉴 경로:</b> <code>/portal/orders/requests</code></li>
          </ul>
        </div>
        
        <div class="card" style="border-top:3px solid #8B5CF6;">
          <div class="card-title" style="color:#6D28D9;">Track B: 본사 직접 발주 (Admin Direct PO)</div>
          <ul style="margin:0; padding-left:14px; font-size:7.5pt; color:#334155; line-height:1.4;">
            <li><b>발주 주체:</b> K SELECT 본사 머천다이저 (Admin MD)</li>
            <li><b>발생 시점:</b> 본사 수요 예측, 북미 대형 리테일러 사전 주문, 시즌별 공급 계획에 따라 본사가 직접 발주할 때</li>
            <li><b>진행 경로:</b> <code>본사 MD 작성</code> &rarr; <code>내부 결재 및 승인</code> &rarr; <code>공급사 포털 발주서 발송(PO Sent)</code></li>
            <li><b>메뉴 경로:</b> <code>/portal/orders/purchase-orders</code></li>
          </ul>
        </div>
      </div>
      
      <div class="callout callout-warning">
        <div class="callout-title">⚠️ 중요 경계 원칙 : Retail Application Approval &ne; Automatic PO Creation</div>
        <div>리테일 입점 신청(MAN-B-RET-001)의 승인은 파트너사 및 상품의 유통 적격성을 승인하는 절차이며, <b>발주서(PO)를 자동으로 발행하지 않습니다.</b> 입점 승인 후 실제 제품 출고는 반드시 Track A(발주 요청 승인) 또는 Track B(본사 직접 발주)를 통해서만 진행됩니다.</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">03</span>
    </div>
  </div>
  `;

  // PAGE 4: CHAPTER 01 - 6-STEP INTEGRATED ORDER LIFECYCLE
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 01 : Order Architecture &amp; Overview</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 01</span>
      <h1 class="chapter-title">공식 발주서 6단계 통합 오더 라이프사이클</h1>
      <p>공식 발주서(PO)가 발행된 이후의 모든 오더는 <b>6단계 표준 라이프사이클</b>을 통해 관리되며, 실시간 상태 바(Stepper)를 통해 모니터링됩니다.</p>
      
      <div class="stepper">
        <div class="step-item">
          <span class="step-num">1</span>
          <div class="step-name">PO Sent</div>
          <div class="step-desc">본사 발주서 발송<br/>공급사 확인 대기</div>
        </div>
        <div class="step-item" style="border-color:#3B82F6; background:#EFF6FF;">
          <span class="step-num" style="background:#2563EB;">2</span>
          <div class="step-name" style="color:#1D4ED8;">Supplier Confirmed</div>
          <div class="step-desc">공급사 수락 완료<br/><b>정산 인보이스 대상</b></div>
        </div>
        <div class="step-item">
          <span class="step-num">3</span>
          <div class="step-name">Goods Ready</div>
          <div class="step-desc">생산/패킹 완료<br/>실측 CBM/서류 등록</div>
        </div>
        <div class="step-item">
          <span class="step-num">4</span>
          <div class="step-name">In Transit</div>
          <div class="step-desc">포워더 인계 / 출고<br/>국제 해상/항공 운송</div>
        </div>
        <div class="step-item">
          <span class="step-num">5</span>
          <div class="step-name">Delivered</div>
          <div class="step-desc">미국 물류센터 도착<br/>실물 입고 검수 진행</div>
        </div>
        <div class="step-item" style="border-color:#10B981; background:#ECFDF5;">
          <span class="step-num" style="background:#059669;">6</span>
          <div class="step-name" style="color:#065F46;">Completed</div>
          <div class="step-desc">입고 검수 완료<br/><b>오더 이행 최종 종결</b></div>
        </div>
      </div>
      
      <div class="section-title">1.3 단계별 핵심 정의 및 시스템 행위</div>
      <table>
        <tr>
          <th style="width:75px;">단계</th>
          <th style="width:110px;">상태 코드 (Enum)</th>
          <th>핵심 정의 및 업무 행위</th>
          <th style="width:120px;">도메인 연계</th>
        </tr>
        <tr>
          <td><b>Step 1</b></td>
          <td><span class="badge badge-blue">PO Sent / Received</span></td>
          <td>본사에서 발주서를 공식 발행하여 공급사 포털로 전송한 상태. 공급사의 수락(Confirm) 또는 변경 요청(Change Request) 대기.</td>
          <td>ORD 도메인</td>
        </tr>
        <tr>
          <td><b>Step 2</b></td>
          <td><span class="badge badge-purple">Supplier Confirmed</span></td>
          <td>공급사가 발주 품목, 수량, 단가, 납기를 최종 확인하고 수락 완료한 상태.</td>
          <td><b>FIN 도메인 인보이스 생성 가능 대상 진입</b></td>
        </tr>
        <tr>
          <td><b>Step 3</b></td>
          <td><span class="badge badge-yellow">Goods Ready</span></td>
          <td>생산 및 개별 패킹이 완료되어 실측 박스 규격(Cartons, Weight, CBM)과 패킹리스트/상업송장을 등록한 상태.</td>
          <td>LOG 출고 준비</td>
        </tr>
        <tr>
          <td><b>Step 4</b></td>
          <td><span class="badge badge-blue">In Transit</span></td>
          <td>운송 책임에 따라 본사 포워더에 인계(LETUSTO_ARRANGED)되었거나 자체 선적(SUPPLIER_ARRANGED)을 개시하여 국제 운송 중인 상태.</td>
          <td>LOG 선적 추적</td>
        </tr>
        <tr>
          <td><b>Step 5</b></td>
          <td><span class="badge badge-yellow">Delivered / Receiving</span></td>
          <td>미국 현지 K SELECT 물류센터에 화물이 도착하여 입고 검수(Receiving &amp; Inspection)를 진행하는 상태.</td>
          <td>WHS 입고 검수</td>
        </tr>
        <tr>
          <td><b>Step 6</b></td>
          <td><span class="badge badge-green">Completed</span></td>
          <td><b>오더 이행 완료 (Order Fulfillment Completed)</b>: 실물 입고 검수가 완료되어 정상 입고 수량 및 오더 처리가 최종 종결된 상태.</td>
          <td><b>ORD &amp; LOG 오더 종결 (정산 완료와 구분)</b></td>
        </tr>
      </table>
      
      <div class="callout callout-info">
        <div class="callout-title">💡 COMPLETED 상태의 명확한 정의 (Canonical Definition)</div>
        <div>오더 라이프사이클의 <code>COMPLETED</code>는 <b>"물류센터 입고 검수 완료 및 오더 이행 최종 종결"</b>을 의미합니다. 대금 정산(Payment / Settlement)은 <code>MAN-B-FIN-001</code>에서 계약 조건에 따라 별도로 처리되며, 오더 완료가 정산 완료를 의미하지 않습니다.</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">04</span>
    </div>
  </div>
  `;

  // PAGE 5: CHAPTER 02 - PO REQUEST DASHBOARD
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 02 : Brand PO Request Management</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 02</span>
      <h1 class="chapter-title">발주 요청(PO Request) 대시보드 및 조회</h1>
      <p>공급사가 자사의 생산 및 재고 상황에 맞춰 본사 앞 발주를 제안하는 <b>발주 요청 목록</b> 관리 화면입니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/requests</span>
        </div>
        <img src="${scrs.scr1}" alt="발주 요청 목록 대시보드" />
        <div class="screenshot-caption">[그림 2-1] SCR-B-ORD-001 : 발주 요청 목록 대시보드 — 상단 상태 탭 필터, 검색바 및 '+ 새 발주 요청 작성' 진입</div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-title">🔍 상태 필터 탭 (Status Tabs)</div>
          <ul style="margin:0; padding-left:14px; font-size:7pt; line-height:1.4;">
            <li><b>전체 (All):</b> 모든 발주 요청 내역 조회</li>
            <li><b>작성중 (Draft):</b> 필수 정보 입력 중인 임시저장 건</li>
            <li><b>제출됨 (Submitted):</b> 본사 MD 심사 대기 중인 건</li>
            <li><b>심사중 (Under Review):</b> 본사 MD가 검토 중인 건</li>
            <li><b>발주서 전환 (Converted):</b> 공식 PO로 확정 승인된 건</li>
            <li><b>반려됨 (Rejected):</b> 조건 불일치 등으로 반려된 건</li>
          </ul>
        </div>
        
        <div class="card">
          <div class="card-title">⚡ 빠른 액션 &amp; 권한 안내</div>
          <p style="font-size:7pt; margin-bottom:4px;">우측 상단의 <b><code>+ 새 발주 요청 작성</code></b> 버튼을 클릭하여 신규 발주 요청 폼으로 이동합니다.</p>
          <div class="callout callout-info" style="margin:0; padding:4px 8px; font-size:6.5pt;">
            <b>권한 요건:</b> 발주 요청 작성 및 제출은 <code>orders:write</code> 권한을 보유한 계정(대표 관리자 또는 발주/물류 담당자)만 실행 가능합니다.
          </div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">05</span>
    </div>
  </div>
  `;

  // PAGE 6: CHAPTER 02 - NEW PO REQUEST FORM
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 02 : Brand PO Request Management</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 02</span>
      <h1 class="chapter-title">신규 발주 요청 작성: 출고지 및 담당자 지정</h1>
      <p>신규 발주 요청서 작성 페이지(<code>/portal/orders/requests/new</code>)에서 기본 출고 정보 및 담당자를 지정합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/requests/new</span>
        </div>
        <img src="${scrs.scr2}" alt="신규 발주 요청 작성 폼" />
        <div class="screenshot-caption">[그림 2-2] SCR-B-ORD-002 : 신규 발주 요청 작성 상단 — 출고지 창고 선택, 자사 담당자 매칭, 희망 출고일 지정</div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-title">1. 출고지 선택 (Ship-from Warehouse)</div>
          <p style="font-size:7pt;">회사 정보(<code>/portal/company/info</code>)에 기등록된 자사 창고/공장 출고지 목록 중 본 화물이 출고될 위치를 드롭다운에서 선택합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">2. 공급사 담당자 지정 (Contact Person)</div>
          <p style="font-size:7pt;">소속 사용자 관리(<code>/portal/company/users</code>)에 등록된 멤버 중 본 발주의 진행 및 조율을 담당할 실무자를 지정합니다.</p>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-title">3. 희망 출고일 (Desired Ready Date)</div>
          <p style="font-size:7pt;">생산 및 검수가 완료되어 물류센터 또는 포워더에 화물을 인계할 수 있는 목표 완료일을 캘린더에서 선택합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">4. 공급사 요청 메모 (Notes)</div>
          <p style="font-size:7pt;">특별 포장 요청, 생산 스케줄 참고사항 등 본사 MD가 검토 시 참고해야 할 특이사항을 기재합니다.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">06</span>
    </div>
  </div>
  `;

  // PAGE 7: CHAPTER 02 - ITEM SELECTION & DYNAMIC TIERED PRICING
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 02 : Brand PO Request Management</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 02</span>
      <h1 class="chapter-title">품목 선택 및 FOB 티어 가격 실시간 연동</h1>
      <p>등록 완료된 자사 상품 카탈로그를 연동하여 품목을 선택하고, 수량에 따른 FOB 단가를 자동 산출합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/requests/new#items</span>
        </div>
        <img src="${scrs.scr3}" alt="품목 선택 및 티어 가격 연동" />
        <div class="screenshot-caption">[그림 2-3] SCR-B-ORD-003 : 품목 선택 모달 및 수량 입력에 따른 FOB Tiered Price 실시간 자동 계산</div>
      </div>
      
      <div class="section-title">2.3 FOB 수량별 티어 단가(Tiered Pricing) 자동 연산 메커니즘</div>
      <div class="card">
        <p style="font-size:7.5pt; margin-bottom:4px;">상품 관리(<code>MAN-B-PROD-001</code>)에서 사전에 설정된 <b>수량별 공급가 티어(Tiered Rates)</b>에 따라 요청 수량 입력 시 적용 단가(FOB Price) 및 총 공급가액이 실시간으로 자동 연산됩니다.</p>
        <div style="background:#F1F5F9; border-radius:4px; padding:6px; font-size:7pt; font-family:monospace;">
          예시 : 1~499개 ($12.00) | 500~1,999개 ($10.50) | 2,000개 이상 ($9.00)<br/>
          &rarr; 수량 600개 입력 시 $10.50 자동 적용 ($6,300.00 총액 연산)
        </div>
      </div>
      
      <div class="callout callout-success">
        <div class="callout-title">💡 단가 자동 고정 및 투명성</div>
        <div>공급사가 등록한 공식 FOB 기준 단가가 적용되므로 임의 가격 불일치를 원천 방지하며, 본사 MD 심사 시에도 승인된 가격 테이블 기준으로 신속한 심사가 가능합니다.</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">07</span>
    </div>
  </div>
  `;

  // PAGE 8: CHAPTER 02 - MOQ VALIDATION & SUBMISSION
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 02 : Brand PO Request Management</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 02</span>
      <h1 class="chapter-title">MOQ 가이드라인 검증 및 발주 요청 제출</h1>
      <p>최소 주문 수량(MOQ) 충족 여부를 시스템이 실시간 점검하며, 2가지 제출 방식을 제공합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/requests/new#submit</span>
        </div>
        <img src="${scrs.scr4}" alt="MOQ 검증 및 제출 버튼" />
        <div class="screenshot-caption">[그림 2-4] SCR-B-ORD-004 : MOQ 가이드라인 경고 안내 및 '임시 저장' / '발주 요청 제출' 2대 액션 버튼</div>
      </div>
      
      <div class="grid-2">
        <div class="card" style="border-left:3px solid #F59E0B;">
          <div class="card-title" style="color:#B45309;">⚠️ MOQ 가이드라인 동작 원리</div>
          <p style="font-size:7pt; color:#78350F;">
            상품별로 설정된 최소 주문 수량(MOQ)보다 적은 수량을 입력하면 노란색 경고 배너가 표시됩니다.<br/>
            <b>Non-blocking Alert:</b> 심사 시 본사 MD와 협의할 수 있도록 제출 자체를 차단하지는 않으나, 원활한 승인을 위해 권장 MOQ 준수가 권장됩니다.
          </p>
        </div>
        
        <div class="card" style="border-left:3px solid #10B981;">
          <div class="card-title" style="color:#047857;">🚀 2가지 제출 방식</div>
          <p style="font-size:7pt; color:#064E3B;">
            <b>1. 임시 저장 (Save as Draft):</b> 입력 중인 품목 및 수량을 저장하고 나중에 이어서 수정.<br/>
            <b>2. 발주 요청 제출 (Submit Request):</b> 본사 MD 심사 큐로 전송하여 상태를 <code>SUBMITTED</code>로 전환.
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">08</span>
    </div>
  </div>
  `;

  // PAGE 9: CHAPTER 03 - PO REQUEST REVIEW & CONVERSION
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 03 : Review &amp; Conversion</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 03</span>
      <h1 class="chapter-title">발주 요청 심사 및 공식 발주서(PO) 자동 전환</h1>
      <p>제출된 발주 요청서의 본사 MD 심사 진행 상황을 확인하고, 승인 시 공식 발주서로 전환되는 절차입니다.</p>
      
      <div class="grid-2">
        <div class="screenshot-box">
          <div class="screenshot-header">
            <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
            <span class="browser-url">/orders/requests/[id]</span>
          </div>
          <img src="${scrs.scr5}" alt="심사 상태 확인" style="max-height:85mm;" />
          <div class="screenshot-caption">[그림 3-1] SCR-B-ORD-005 : MD 심사 및 수정 요청(CHANGE_REQUESTED) 상태 확인</div>
        </div>
        
        <div class="screenshot-box">
          <div class="screenshot-header">
            <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
            <span class="browser-url">/orders/requests/[id] (Converted)</span>
          </div>
          <img src="${scrs.scr6}" alt="공식 발주서 전환" style="max-height:85mm;" />
          <div class="screenshot-caption">[그림 3-2] SCR-B-ORD-006 : CONVERTED_TO_PO 전환 및 공식 발주서 바로가기 링크</div>
        </div>
      </div>
      
      <div class="section-title">3.1 발주 요청 심사 상태 머신 (PO Request Lifecycle)</div>
      <table>
        <tr>
          <th>상태 코드</th>
          <th>한글명</th>
          <th>설명 및 공급사 대응 가이드</th>
        </tr>
        <tr>
          <td><span class="badge badge-gray">DRAFT</span></td>
          <td>작성중</td>
          <td>공급사 내부 작성 중인 상태 (언제든지 수정/삭제 가능)</td>
        </tr>
        <tr>
          <td><span class="badge badge-blue">SUBMITTED</span></td>
          <td>제출됨</td>
          <td>본사 MD 심사 대기 상태 (심사 전까지 수정 가능)</td>
        </tr>
        <tr>
          <td><span class="badge badge-yellow">CHANGE_REQUESTED</span></td>
          <td>수정요청</td>
          <td>본사 MD가 수량/단가/납기 조정을 요청한 상태 &rarr; 사유 확인 후 수정하여 재제출</td>
        </tr>
        <tr>
          <td><span class="badge badge-green">CONVERTED_TO_PO</span></td>
          <td>발주서 전환</td>
          <td><b>최종 승인 완료</b>: 공식 발주서 번호(PO-XXXX)가 부여되며 공식 발주서 메뉴로 자동 연동</td>
        </tr>
        <tr>
          <td><span class="badge badge-rose">REJECTED</span></td>
          <td>반려됨</td>
          <td>수요 불일치 또는 공급 불가로 반려된 상태 (반려 사유 확인 가능)</td>
        </tr>
      </table>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">09</span>
    </div>
  </div>
  `;

  // PAGE 10: CHAPTER 04 - OFFICIAL PURCHASE ORDERS DASHBOARD
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 04 : Official Purchase Orders</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 04</span>
      <h1 class="chapter-title">공식 발주서(Purchase Order) 목록 대시보드</h1>
      <p>본사에서 발행된 모든 공식 발주서 목록을 조회하고 6단계 진행 상태별로 관리합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/purchase-orders</span>
        </div>
        <img src="${scrs.scr7}" alt="공식 발주서 목록 대시보드" />
        <div class="screenshot-caption">[그림 4-1] SCR-B-ORD-007 : 공식 발주서 목록 — 발주번호, 발행일, 총금액, 납기일, 공급사 수락 여부 및 6단계 상태 배지</div>
      </div>
      
      <div class="grid-3">
        <div class="card">
          <div class="card-title">1. 발주서 식별자</div>
          <p style="font-size:7pt;">공식 발주번호(<code>PO-YYYYMMDD-XXXX</code>), 원본 발주 요청 번호 및 브랜드 명칭을 한눈에 식별합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">2. 공급사 수락 상태</div>
          <p style="font-size:7pt;"><code>PENDING</code> (확인 대기), <code>CONFIRMED</code> (수락 완료), <code>CHANGE_REQUESTED</code> (변경 요청) 상태 표시.</p>
        </div>
        <div class="card">
          <div class="card-title">3. 물류 이행 상태</div>
          <p style="font-size:7pt;"><code>PO Sent</code> &rarr; <code>Goods Ready</code> &rarr; <code>In Transit</code> &rarr; <code>Delivered</code> &rarr; <code>Completed</code> 단계 표시.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">10</span>
    </div>
  </div>
  `;

  // PAGE 11: CHAPTER 04 - PO DETAIL VIEW & STEPPER
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 04 : Official Purchase Orders</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 04</span>
      <h1 class="chapter-title">발주서 상세 화면 및 통합 상태 트래커</h1>
      <p>공식 발주서의 품목별 발주 내역, 계약 조건, 실시간 진행 상태 바 및 액션 패널을 확인합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/purchase-orders/[id]</span>
        </div>
        <img src="${scrs.scr8}" alt="발주서 상세 화면" />
        <div class="screenshot-caption">[그림 4-2] SCR-B-ORD-008 : 발주서 상세 Overview — 6단계 진행 바, 발주 요약 메타데이터, 주문 총액 및 수락/변경 버튼</div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-title">📊 6단계 인터랙티브 스테퍼 (Stepper Tracker)</div>
          <p style="font-size:7pt;">상단의 6단계 진행 바를 통해 현재 발주 건이 어느 물류/이행 단계에 있는지 실시간으로 확인하며, 완료된 단계는 녹색 체크 아이콘으로 표시됩니다.</p>
        </div>
        
        <div class="card">
          <div class="card-title">📝 발주 메타데이터 &amp; 총액</div>
          <p style="font-size:7pt;">총 발주 수량, FOB 총 공급가액(USD), 통관 통화, 목표 납기일(Delivery Due Date), 운송 책임(Shipping Responsibility)을 확인합니다.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">11</span>
    </div>
  </div>
  `;

  // PAGE 12: CHAPTER 04 - SUPPLIER CONFIRMATION & VARIANCE TABLE
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 04 : Official Purchase Orders</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 04</span>
      <h1 class="chapter-title">공급사 발주 수락(Confirmation) 및 품목 대조</h1>
      <p>발주서를 검토한 후 수락(Confirm)을 실행하거나 변경을 요청하며, 품목별 수량 흐름을 대조합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/purchase-orders/[id]#items</span>
        </div>
        <img src="${scrs.scr9}" alt="품목별 수량 흐름 대조 테이블" />
        <div class="screenshot-caption">[그림 4-3] SCR-B-ORD-009 : 품목별 수량 대조(Variance) 테이블 — 발주수량, 준비수량, 선적수량, 입고수량 실시간 추적</div>
      </div>
      
      <div class="grid-2">
        <div class="card" style="border-top:3px solid #10B981;">
          <div class="card-title" style="color:#047857;">✓ 발주 수락 (Confirm Purchase Order)</div>
          <p style="font-size:7pt;">발주 내용에 이상이 없을 경우 <b>[발주 수락 (Confirm PO)]</b> 버튼을 클릭합니다.<br/>
          &rarr; <code>supplier_confirmation_status</code>가 <code>CONFIRMED</code>로 전환되며, <b>정산 인보이스 생성 가능 대상(Eligible)으로 진입</b>합니다.</p>
        </div>
        
        <div class="card" style="border-top:3px solid #F59E0B;">
          <div class="card-title" style="color:#B45309;">⚠️ 변경 요청 (Request Change)</div>
          <p style="font-size:7pt;">생산 일정 지연, 수량 조정 필요 시 <b>[변경 요청 (Request Change)]</b> 버튼을 클릭하여 사유를 작성합니다.<br/>
          &rarr; 본사 MD가 사유를 검토하여 발주서 조건을 수정하거나 재협의를 진행합니다.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">12</span>
    </div>
  </div>
  `;

  // PAGE 13: CHAPTER 05 - GOODS READINESS
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 05 : Goods Readiness &amp; Shipping</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 05</span>
      <h1 class="chapter-title">출고 준비 등록(Goods Readiness): 실측 규격 및 서류</h1>
      <p>제품 생산 및 패킹이 완료되면 실측 카톤 규격과 필수 무역 서류를 등록하여 출고를 준비합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/purchase-orders/[id]/readiness</span>
        </div>
        <img src="${scrs.scr10}" alt="출고 준비 등록 폼" />
        <div class="screenshot-caption">[그림 5-1] SCR-B-ORD-010 : 출고 준비(Goods Readiness) 등록 — 준비 수량, 마스터 카톤수, 총중량, 실측 CBM 입력</div>
      </div>
      
      <div class="grid-3">
        <div class="card">
          <div class="card-title">1. 준비 수량 (Ready Qty)</div>
          <p style="font-size:7pt;">실제 생산 완료된 수량을 입력합니다. 발주 수량을 초과할 수 없습니다 (초과 방지 검증).</p>
        </div>
        <div class="card">
          <div class="card-title">2. 실측 CBM / 중량</div>
          <p style="font-size:7pt;">총 마스터 카톤 수, 총중량(kg/lb), 실측 체적(CBM)을 입력하여 포워더 배차를 지원합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">3. 필수 서류 첨부</div>
          <p style="font-size:7pt;">패킹리스트(Packing List) 및 상업송장(Commercial Invoice) PDF 파일을 업로드합니다.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">13</span>
    </div>
  </div>
  `;

  // PAGE 14: CHAPTER 05 - TRACK 1 LETUSTO_ARRANGED
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 05 : Goods Readiness &amp; Shipping</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 05</span>
      <h1 class="chapter-title">운송 책임 분기: Track 1 LETUSTO_ARRANGED (본사 지정 운송)</h1>
      <p>본사 지정 포워더가 공급사 공장/창고로 방문하여 화물을 픽업하는 FOB 조건 운송 워크플로우입니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/[id] (Letusto Track)</span>
        </div>
        <img src="${scrs.scr11}" alt="LETUSTO_ARRANGED 화물 인계" />
        <div class="screenshot-caption">[그림 5-2] SCR-B-ORD-011 : 본사 지정 포워더 픽업 후 브랜드사 '[물품 인계 완료 (Submit Handover)]' 처리 화면</div>
      </div>
      
      <div class="section-title">5.1 LETUSTO_ARRANGED 진행 순서</div>
      <div class="stepper">
        <div class="step-item">
          <span class="step-num">1</span>
          <div class="step-name">출고 준비 등록</div>
          <div class="step-desc">공급사: Ready Qty &amp; CBM 등록</div>
        </div>
        <div class="step-item">
          <span class="step-num">2</span>
          <div class="step-name">포워더 배정</div>
          <div class="step-desc">본사: 포워더 픽업 예약</div>
        </div>
        <div class="step-item">
          <span class="step-num">3</span>
          <div class="step-name">화물 수거 (Pickup)</div>
          <div class="step-desc">포워더 공장 방문 수거</div>
        </div>
        <div class="step-item" style="border-color:#3B82F6; background:#EFF6FF;">
          <span class="step-num" style="background:#2563EB;">4</span>
          <div class="step-name" style="color:#1D4ED8;">물품 인계 완료</div>
          <div class="step-desc"><b>공급사: Handover 클릭</b></div>
        </div>
        <div class="step-item">
          <span class="step-num">5</span>
          <div class="step-name">해상/항공 선적</div>
          <div class="step-desc">본사: Inbound 선적 진행</div>
        </div>
      </div>
      
      <div class="callout callout-info">
        <div class="callout-title">💡 공급사 Action : [물품 인계 완료] 버튼 클릭 필수</div>
        <div>포워더 기사님께 화물 실물을 전달한 후 포털 상세 화면에서 <b>[물품 인계 완료 (Submit Handover)]</b> 버튼을 클릭해야 본사 시스템에 인계 시점이 기록되고 선적 프로세스로 원활히 전환됩니다.</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">14</span>
    </div>
  </div>
  `;

  // PAGE 15: CHAPTER 05 - TRACK 2 SUPPLIER_ARRANGED
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 05 : Goods Readiness &amp; Shipping</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 05</span>
      <h1 class="chapter-title">운송 책임 분기: Track 2 SUPPLIER_ARRANGED (공급사 자체 운송)</h1>
      <p>공급사가 자체 계약 운송사를 통해 미국 K SELECT 물류센터까지 DDP 조건으로 직접 운송하는 워크플로우입니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/[id] (Supplier Track)</span>
        </div>
        <img src="${scrs.scr12}" alt="SUPPLIER_ARRANGED 운송 정보 등록" />
        <div class="screenshot-caption">[그림 5-3] SCR-B-ORD-012 : 공급사 운송사(Carrier), 운송장(Tracking / B/L) 번호 및 출고/도착 예정일(ETD/ETA) 입력 패널</div>
      </div>
      
      <div class="section-title">5.2 SUPPLIER_ARRANGED 필수 입력 항목</div>
      <div class="grid-3">
        <div class="card">
          <div class="card-title">1. 운송사 (Carrier)</div>
          <p style="font-size:7pt;">FedEx, DHL, UPS, 특송사 또는 포워더 명칭을 선택/입력합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">2. 추적번호 (Tracking / BL)</div>
          <p style="font-size:7pt;">화물 추적 번호(Tracking Number) 또는 해상/항공 선하증권(B/L) 번호를 입력합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">3. 일정 (ETD / ETA)</div>
          <p style="font-size:7pt;">한국 출항 예정일(ETD)과 미국 창고 도착 예정일(ETA)을 등록합니다.</p>
        </div>
      </div>
      
      <div class="callout callout-warning">
        <div class="callout-title">⚠️ 배송 출발 처리 후 상태 전환</div>
        <div>모든 운송 정보를 입력하고 <b>[배송 출발 및 선적 등록 (Ship &amp; Create Inbound)]</b>을 클릭하면 시스템 상태가 <code>IN_TRANSIT</code>으로 즉시 전환되며 미국 물류센터에 입고 예정 정보가 사전 통보됩니다.</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">15</span>
    </div>
  </div>
  `;

  // PAGE 16: CHAPTER 06 - RECEIVING & INSPECTION
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 06 : Receiving &amp; Document Center</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 06</span>
      <h1 class="chapter-title">미국 물류센터 실물 입고 검수(Receiving &amp; Inspection)</h1>
      <p>미국 현지 물류센터에 도착한 화물의 실물 바코드 스캔 검수 결과 및 최종 입고 수량을 확인합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/purchase-orders/[id]#receiving</span>
        </div>
        <img src="${scrs.scr13}" alt="입고 검수 결과 화면" />
        <div class="screenshot-caption">[그림 6-1] SCR-B-ORD-013 : 입고 검수 결과 탭 — 정상 입고(Accepted), 파손(Damaged), 불일치(Variance) 및 검수 전표 확인</div>
      </div>
      
      <div class="grid-3">
        <div class="card" style="border-left:3px solid #10B981;">
          <div class="card-title" style="color:#047857;">✓ 정상 입고 (Accepted Qty)</div>
          <p style="font-size:7pt;">바코드 스캔 및 외관 검수를 통과하여 정상 재고로 입고된 수량입니다.</p>
        </div>
        <div class="card" style="border-left:3px solid #EF4444;">
          <div class="card-title" style="color:#B91C1C;">🚨 파손 수량 (Damaged Qty)</div>
          <p style="font-size:7pt;">운송 중 파손되어 격리 보관된 수량 (파손 사진 및 사고 리포트 첨부).</p>
        </div>
        <div class="card" style="border-left:3px solid #F59E0B;">
          <div class="card-title" style="color:#B45309;">⚠️ 보류 수량 (Hold Qty)</div>
          <p style="font-size:7pt;">라벨 불일치, 바코드 미인식 등으로 검수가 보류된 수량.</p>
        </div>
      </div>
      
      <div class="callout callout-success">
        <div class="callout-title">✓ 오더 상태 완료 (COMPLETED) 전환 기준</div>
        <div>미국 물류센터의 모든 실물 검수가 완료되면 오더 상태가 최종 <b><code>COMPLETED (오더 이행 완료)</code></b>로 종결됩니다. (정산 대금 정산 완료와 독립적으로 처리됨)</div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">16</span>
    </div>
  </div>
  `;

  // PAGE 17: CHAPTER 06 - DOCUMENT REPOSITORY & FINANCE HANDOFF
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 06 : Receiving &amp; Document Center</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 06</span>
      <h1 class="chapter-title">무역 서류 보관함 &amp; 재무(Finance) Handoff 경계</h1>
      <p>발주 및 물류 관련 모든 공식 서류를 통합 보관하며, 재무(인보이스/정산) 도메인과의 연계 기준을 제시합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/purchase-orders/[id]#documents</span>
        </div>
        <img src="${scrs.scr14}" alt="무역 서류 보관함" />
        <div class="screenshot-caption">[그림 6-2] SCR-B-ORD-014 : 무역 서류 보관함 — 공식 발주서 PDF, 패킹리스트, 상업송장, 운송장, 검수 성적서 다운로드</div>
      </div>
      
      <div class="section-title">6.2 재무(Finance) Handoff 경계 및 인보이스 생성 조건</div>
      <div class="grid-2">
        <div class="card" style="background:#FDF2F8; border-color:#FBCFE8;">
          <div class="card-title" style="color:#9D174D;">💳 공급사 인보이스(Supplier Invoice) 생성 조건</div>
          <p style="font-size:7pt; color:#831843;">
            <code>po_status IN ('APPROVED', 'SENT') &amp;&amp; supplier_confirmation_status = 'CONFIRMED'</code><br/>
            공급사가 발주서를 정식 수락하고 PO가 유효 상태(APPROVED/SENT)인 시점부터 재무 도메인(<code>MAN-B-FIN-001</code>)에서 해당 PO에 대한 공급사 인보이스를 생성할 수 있는 자격(Eligible)이 부여됩니다.
          </p>
        </div>
        
        <div class="card" style="background:#F0FDF4; border-color:#BBF7D0;">
          <div class="card-title" style="color:#166534;">📦 물류(Logistics) 도메인과의 독립성</div>
          <p style="font-size:7pt; color:#14532D;">
            출고 준비(Goods Ready), 선적(In Transit), 입고(Delivered/Completed)는 물류 도메인의 진행 상태이며, 인보이스 생성의 절대적 선결 조건이 아닙니다. (단, 개별 지급 조건에 따른 정산 시점은 FIN에서 통제)
          </p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">17</span>
    </div>
  </div>
  `;

  // PAGE 18: CHAPTER 07 - GLOBAL SHIPPING HUB
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 07 : Global Shipping Hub</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 07</span>
      <h1 class="chapter-title">전사 통합 출고 및 선적 허브 (Shipping Hub)</h1>
      <p>모든 발주서의 출고 및 선적 내역을 한곳에서 모니터링하는 전사 물류 관리 화면입니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping</span>
        </div>
        <img src="${scrs.scr15}" alt="통합 선적 허브" />
        <div class="screenshot-caption">[그림 7-1] SCR-B-ORD-015 : 통합 선적 허브 — 전체 PO의 출고 준비(Ready), 선적 중(In Transit), 도착 완료(Delivered) 통합 모니터링</div>
      </div>
      
      <div class="grid-3">
        <div class="card">
          <div class="card-title">1. 출고 대기 탭 (Ready)</div>
          <p style="font-size:7pt;">출고 준비 등록이 완료되어 포워더 픽업 또는 공급사 발송을 대기 중인 모든 화물 목록.</p>
        </div>
        <div class="card">
          <div class="card-title">2. 선적 운송 탭 (In Transit)</div>
          <p style="font-size:7pt;">국제 해상/항공 운송 중인 모든 선적 건의 실시간 ETD, ETA, Tracking 번호 조회.</p>
        </div>
        <div class="card">
          <div class="card-title">3. 입고 완료 탭 (Delivered)</div>
          <p style="font-size:7pt;">미국 물류센터에 도착하여 검수가 완료된 과거 선적 이력 영구 보관.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">18</span>
    </div>
  </div>
  `;

  // PAGE 19: CHAPTER 08 - FAQS
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Chapter 08 : Frequently Asked Questions</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 08</span>
      <h1 class="chapter-title">오더 관리 자주 묻는 질문 (FAQ 8선)</h1>
      
      <div style="display:flex; flex-direction:column; gap:4px; font-size:7pt;">
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q1. 입점 신청이 승인되면 발주서가 자동으로 발행되나요?</div>
          <div style="color:#334155;"><b>A.</b> 아닙니다. 입점 승인(MAN-B-RET-001)은 파트너 적격성 완료 절차이며, 실제 발주는 공급사의 발주 요청 승인(Track A) 또는 본사의 직접 발주(Track B)를 통해서만 발행됩니다.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q2. 발주 요청 시 단가는 어떻게 결정되나요?</div>
          <div style="color:#334155;"><b>A.</b> 상품 등록(MAN-B-PROD-001) 시 입력된 FOB 수량별 티어 가격(Tiered Pricing)에 따라 요청 수량에 맞춰 단가가 자동 계산됩니다.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q3. 발주서 수락 후 생산 일정이나 수량을 변경할 수 있나요?</div>
          <div style="color:#334155;"><b>A.</b> 수락 전이라면 [변경 요청(Request Change)]을 통해 사유를 제출하며, 수락 후 불가피한 변경 시 포털 1:1 문의를 통해 본사 MD와 협의하여 변경합니다.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q4. 공급사 정산 인보이스(Supplier Invoice)는 언제 작성할 수 있나요?</div>
          <div style="color:#334155;"><b>A.</b> 공급사가 발주서를 확인하고 <code>[발주 수락(Confirm PO)]</code>을 완료하여 <code>Supplier Confirmed</code> 상태가 된 즉시 인보이스 작성 자격(Eligible)이 부여됩니다. 상세 작성은 MAN-B-FIN-001을 참조하세요.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q5. LETUSTO_ARRANGED 조건에서 화물을 보낸 후 무엇을 해야 하나요?</div>
          <div style="color:#334155;"><b>A.</b> 포워더 기사님께 화물을 인계한 즉시 포털 상세 화면에서 <code>[물품 인계 완료 (Submit Handover)]</code> 버튼을 클릭해야 본사 시스템에 정상 반영됩니다.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q6. SUPPLIER_ARRANGED 조건에서 운송장 번호는 언제 등록하나요?</div>
          <div style="color:#334155;"><b>A.</b> 자체 운송사 출고 즉시 Carrier 명칭, Tracking/BL 번호, ETD, ETA를 입력하고 [배송 출발]을 클릭해야 미국 물류센터에 사전 통보됩니다.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q7. 입고 검수 시 파손이나 수량 부족이 발생하면 어떻게 처리되나요?</div>
          <div style="color:#334155;"><b>A.</b> 미국 물류센터에서 파손/부족 수량을 검수 결과 탭에 기록하고 사진을 첨부하며, 귀책 사유에 따라 보험 청구 또는 정산 조정이 진행됩니다.</div>
        </div>
        
        <div class="card" style="padding:5px 8px; margin:0;">
          <div style="font-weight:800; color:#0284C7;">Q8. 오더 상태 COMPLETED는 대금 정산 완료를 의미하나요?</div>
          <div style="color:#334155;"><b>A.</b> 아닙니다. COMPLETED는 <b>물류센터 검수 완료 및 오더 이행 종결</b>을 의미하며, 대금 지급(PAID)은 계약된 결제 조건에 따라 재무 도메인(MAN-B-FIN-001)에서 독립적으로 처리됩니다.</div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001</span>
      <span class="page-num">19</span>
    </div>
  </div>
  `;

  // PAGE 20: APPENDIX - STATUS ENUMS & OPERATOR QUICK CHECKLIST
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">Appendix : Quick Reference &amp; Checklist</span>
      <span class="header-right">MAN-B-ORD-001</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">APPENDIX</span>
      <h1 class="chapter-title">오더 관리 실무자 퀵 체크리스트 &amp; 상태 요약표</h1>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-title">📋 실무자 퀵 체크리스트 (Quick Checklist)</div>
          <ul style="margin:0; padding-left:14px; font-size:7pt; color:#334155; line-height:1.45;">
            <li>□ <b>발주 요청 시:</b> 출고지 창고, 담당자, 희망 출고일, 품목별 티어 단가 확인</li>
            <li>□ <b>발주서 수락 시:</b> 품목, 수량, FOB 단가, 납기일 대조 후 <code>Confirm PO</code> 클릭</li>
            <li>□ <b>생산 완료 시:</b> 실제 패킹 카톤 규격, 중량, CBM 실측 및 P/L, C/I 업로드</li>
            <li>□ <b>FOB 출고 시:</b> 본사 포워더 픽업 후 <code>[물품 인계 완료]</code> 즉시 클릭</li>
            <li>□ <b>DDP 출고 시:</b> 자체 운송사, Tracking/BL 번호, ETD/ETA 정확히 등록</li>
            <li>□ <b>입고 확인 시:</b> 미국 물류센터 검수 수량(Accepted/Damaged) 최종 확인</li>
          </ul>
        </div>
        
        <div class="card">
          <div class="card-title">🗂️ 핵심 상태 코드 매트릭스 (Status Matrix)</div>
          <table style="font-size:6.5pt;">
            <tr><th>영역</th><th>상태 코드</th><th>의미</th></tr>
            <tr><td><b>발주요청</b></td><td>SUBMITTED</td><td>본사 MD 심사 대기</td></tr>
            <tr><td><b>발주요청</b></td><td>CONVERTED_TO_PO</td><td>공식 발주서 전환 완료</td></tr>
            <tr><td><b>공급사수락</b></td><td>CONFIRMED</td><td><b>발주 수락 &rarr; 인보이스 대상</b></td></tr>
            <tr><td><b>물류상태</b></td><td>READY_TO_SHIP</td><td>출고 준비 등록 완료</td></tr>
            <tr><td><b>물류상태</b></td><td>IN_TRANSIT</td><td>국제 운송 중 (해상/항공)</td></tr>
            <tr><td><b>물류상태</b></td><td>DELIVERED</td><td>미국 물류센터 도착 검수</td></tr>
            <tr><td><b>물류상태</b></td><td>COMPLETED</td><td><b>입고 검수 &amp; 오더 이행 종결</b></td></tr>
          </table>
        </div>
      </div>
      
      <div class="card" style="background:#F8FAFC; border:1px solid #CBD5E1; margin-top:4px;">
        <div class="card-title">📞 고객지원 및 문의 채널 안내</div>
        <div style="font-size:7pt; color:#475569; display:flex; justify-content:space-between;">
          <div><b>1:1 고객지원:</b> Brand Portal 좌측 사이드바 &gt; <code>고객지원(Help Center)</code> &gt; 1:1 문의하기</div>
          <div><b>발주/물류 문의:</b> <code>orders@kselectnetwork.com</code> | <b>운영시간:</b> 평일 09:00 ~ 18:00 (KST)</div>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT Brand Portal User Manual &bull; MAN-B-ORD-001 &bull; End of Document</span>
      <span class="page-num">20</span>
    </div>
  </div>
  `;

  html += `</body></html>`;
  return html;
}

async function generatePdf() {
  console.log('Generating MAN-B-ORD-001 Order Management PDF (Target: 20 Pages)...');
  const html = await buildHtml();
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const outDir = path.join(__dirname, '..', 'Manuals', 'MAN-B-ORD-001_Order-Management', '03_PUBLISHED');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outPdf = path.join(outDir, 'MAN-B-ORD-001_Order-Management_V1.pdf');
  
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  
  await browser.close();
  console.log('✓ PDF Successfully Generated at:', outPdf);
  console.log('  File Size:', fs.statSync(outPdf).size, 'bytes');
}

generatePdf().catch(err => {
  console.error('❌ Error generating PDF:', err);
  process.exit(1);
});
