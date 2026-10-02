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
  const scrDir = 'Manuals/MAN-B-LOG-001_Shipping-Logistics/02_CLAUDE_PACKAGE/02_SCREENSHOTS';
  const logoLight = getImageBase64('public/ksn-logo-new.png') || getImageBase64('public/ksn-logo-admin.png');
  const logoDark = getImageBase64('public/ksn-logo-dark.png') || getImageBase64('public/ksn-logo.jpg');

  const scrs = {};
  for (let i = 1; i <= 11; i++) {
    const numStr = String(i).padStart(3, '0');
    scrs[`scr${i}`] = getImageBase64(`${scrDir}/SCR-B-LOG-${numStr}.png`);
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
      font-size: 8.5pt;
      line-height: 1.45;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 15mm 18mm 13mm 18mm;
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
      margin-top: 35mm;
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
      font-size: 12pt;
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
    
    .cover-toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 15px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
    }
    
    .cover-toc-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 8pt;
      color: #CBD5E1;
    }
    
    .cover-toc-num {
      color: #38BDF8;
      font-weight: 800;
      font-size: 7.5pt;
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
      padding-bottom: 6px;
      margin-bottom: 8px;
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
      padding-top: 5px;
      margin-top: 6px;
      font-size: 7pt;
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
      gap: 7px;
      overflow: hidden;
    }
    
    .chapter-tag {
      display: inline-block;
      background: #E0F2FE;
      color: #0369A1;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 800;
      margin-bottom: 1px;
      letter-spacing: 0.03em;
    }
    
    .chapter-title {
      font-size: 13pt;
      font-weight: 900;
      color: #0F172A;
      margin: 0 0 3px 0;
      letter-spacing: -0.01em;
    }
    
    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      color: #1E293B;
      margin: 4px 0 2px 0;
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
    
    p {
      margin: 0 0 4px 0;
      color: #334155;
    }
    
    /* Cards & Boxes */
    .card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 7px 9px;
      margin-bottom: 4px;
    }
    
    .card-title {
      font-size: 8pt;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 3px;
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
      padding: 6px 9px;
      margin: 3px 0;
      font-size: 7.5pt;
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
      font-size: 7.5pt;
      margin-bottom: 1px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    /* Screenshot Box */
    .screenshot-box {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
      background: #FFFFFF;
      margin: 3px 0;
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
      max-height: 110mm;
      object-fit: contain;
      background: #090D16;
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
      margin: 3px 0;
    }
    
    th {
      background: #F1F5F9;
      color: #1E293B;
      font-weight: 800;
      text-align: left;
      padding: 4px 6px;
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
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 6.5pt;
      font-weight: 700;
    }
    
    .badge-blue { background: #E0F2FE; color: #0369A1; }
    .badge-green { background: #DCFCE7; color: #166534; }
    .badge-amber { background: #FEF3C7; color: #92400E; }
    .badge-purple { background: #F3E8FF; color: #6B21A8; }
    .badge-red { background: #FEE2E2; color: #991B1B; }
    
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #F1F5F9;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7pt;
      color: #0284C7;
    }
  `;

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>MAN-B-LOG-001 Shipping & International Logistics Manual</title>
  <style>${css}</style>
</head>
<body>
`;

  // PAGE 1: COVER
  html += `
  <div class="page page-cover">
    <div class="cover-header">
      <div class="cover-brand">
        ${logoLight ? `<img src="${logoLight}" alt="K SELECT NETWORK" />` : '<span style="font-weight:900; font-size:14pt; letter-spacing:0.05em;">K SELECT NETWORK</span>'}
      </div>
      <div class="cover-badge">BRAND PORTAL USER GUIDE</div>
    </div>
    
    <div class="cover-body">
      <div class="cover-doc-id">MAN-B-LOG-001 &bull; VERSION 1.0.0</div>
      <div class="cover-title">선적 및 국제 물류<br>관리 가이드</div>
      <div class="cover-subtitle">Shipping &amp; International Logistics Guide<br>출고 준비, 카고 규격 등록, 운송 분기 및 미국 창고 입고 인계 종합 가이드</div>
      
      <div class="cover-tags">
        <div class="cover-tag">물류/선적 관리</div>
        <div class="cover-tag">Goods Readiness</div>
        <div class="cover-tag">카고 스펙 (CBM/중량)</div>
        <div class="cover-tag">FOB / DDP 운송 분기</div>
        <div class="cover-tag">입고 검수 인계</div>
      </div>
      
      <div class="cover-toc-grid">
        <div class="cover-toc-item"><span class="cover-toc-num">01</span> 선적 및 국제 물류 개요</div>
        <div class="cover-toc-item"><span class="cover-toc-num">04</span> 운송 책임별 출고 및 선적 이행</div>
        <div class="cover-toc-item"><span class="cover-toc-num">02</span> 선적 &amp; 출고 관리 허브 둘러보기</div>
        <div class="cover-toc-item"><span class="cover-toc-num">05</span> 선적 추적 및 미국 창고 입고 인계</div>
        <div class="cover-toc-item"><span class="cover-toc-num">03</span> 출고 준비 완료 등록</div>
        <div class="cover-toc-item"><span class="cover-toc-num">06</span> 권한 관리 및 문제 해결 FAQ</div>
      </div>
    </div>
    
    <div class="cover-footer">
      <div><b>대상 독자:</b> 브랜드사 및 공급사 물류/출고 담당자 (Brand Portal B)</div>
      <div><b>발행 기관:</b> Letusto Inc. / K SELECT 물류운영본부 &bull; 2026-10-01</div>
    </div>
  </div>
  `;

  // PAGE 2: TABLE OF CONTENTS & GOVERNANCE
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CONTENTS</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">TABLE OF CONTENTS</span>
      <h1 class="chapter-title">목차 및 매뉴얼 거버넌스 가이드</h1>
      
      <div class="grid-2" style="margin-top:4px;">
        <div class="card" style="background:#FFFFFF; border:1px solid #CBD5E1;">
          <div class="card-title" style="color:#0284C7; font-size:8.5pt;">📖 매뉴얼 목차 (Table of Contents)</div>
          <table style="font-size:7pt; margin:0;">
            <tr><th style="width:25%;">장</th><th>주제 및 상세 내용</th><th style="width:15%; text-align:right;">Page</th></tr>
            <tr><td><b>Chapter 01</b></td><td>선적 및 국제 물류 개요 &bull; 파이프라인 &bull; 운송 책임 분기</td><td style="text-align:right;">P. 03</td></tr>
            <tr><td><b>Diagram 01</b></td><td>전체 국제 물류 라이프사이클 다이어그램 (Handoff Pipeline)</td><td style="text-align:right;">P. 05</td></tr>
            <tr><td><b>Chapter 02</b></td><td>선적 &amp; 출고 관리 허브 (Goods Readiness / Shipments)</td><td style="text-align:right;">P. 06</td></tr>
            <tr><td><b>Chapter 03</b></td><td>출고 준비 등록 (기본 정보, 카고 스펙, Overage, 서류 첨부)</td><td style="text-align:right;">P. 08</td></tr>
            <tr><td><b>Chapter 04</b></td><td>운송 책임별 이행 (Track 1 FOB vs Track 2 DDP 선적)</td><td style="text-align:right;">P. 12</td></tr>
            <tr><td><b>Chapter 05</b></td><td>선적 추적 및 미국 창고 입고 인계 (Inbound &amp; Receiving)</td><td style="text-align:right;">P. 16</td></tr>
            <tr><td><b>Chapter 06</b></td><td>권한 관리 (ACL) 및 자주 묻는 질문 (FAQ Top 6)</td><td style="text-align:right;">P. 19</td></tr>
            <tr><td><b>Appendix</b></td><td>상태 코드 사전 &bull; CBM 공식 &bull; 용어 원칙 &bull; 고객지원</td><td style="text-align:right;">P. 21</td></tr>
          </table>
        </div>
        
        <div class="card" style="background:#F8FAFC; border:1px solid #E2E8F0;">
          <div class="card-title" style="color:#0F172A; font-size:8.5pt;">🏛️ 3대 핵심 거버넌스 원칙 (Core Principles)</div>
          
          <div style="font-size:7pt; color:#334155; display:flex; flex-direction:column; gap:6px;">
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px; border-radius:4px;">
              <b style="color:#0284C7;">1. 상태 분리 원칙 (State Disambiguation)</b><br>
              <code>po_status</code>(내부 승인)와 <code>supplier_confirmation_status</code>(공급사 확정)는 별개입니다. 공급사 확정이 완료된(<code>CONFIRMED</code>) 발주서만 출고 준비 및 인보이스 청구 대상이 됩니다.
            </div>
            
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px; border-radius:4px;">
              <b style="color:#D97706;">2. 물류-창고 인계 분계점 (ARRIVED &ne; RECEIVED)</b><br>
              <code>ARRIVED</code>는 화물이 목적지 도크에 도달한 물리적 도착 시점이며, <code>RECEIVED</code>는 창고 검수자가 박스를 개봉하고 바코드를 스캔하여 실물 검수를 완료한 시점입니다.
            </div>
            
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px; border-radius:4px;">
              <b style="color:#059669;">3. 재무 도메인의 독립적 병렬 운영</b><br>
              재무 도메인(<code>MAN-B-FIN-001</code>)은 물류의 종속 단계가 아니며, 공식 발주 확정 이후 양사 계약 조건(선급금, 선적 시, 입고 후 등)에 따라 독립적으로 인보이스를 발행합니다.
            </div>
          </div>
        </div>
      </div>
      
      <div class="callout callout-info" style="margin-top:4px;">
        <div class="callout-title">📌 매뉴얼 활용 안내</div>
        본 매뉴얼은 브랜드사 및 공급사의 물류/출고 실무자를 위한 표준 운영 가이드입니다. 각 화면 설명에는 실제 프로덕션 UI 캡처와 고유 화면 식별자(SCR-B-LOG-xxx)가 포함되어 있어 직관적인 업무 수행이 가능합니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">2 / 22</span>
    </div>
  </div>
  `;

  // PAGE 3: CHAPTER 1 - LOGISTICS OVERVIEW
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 01 &bull; OVERVIEW</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 01</span>
      <h1 class="chapter-title">선적 및 국제 물류 개요 (Logistics Overview)</h1>
      
      <div class="section-title">1.1 K SELECT 국제 물류 파이프라인 및 도메인 구조</div>
      <p>K SELECT의 글로벌 B2B 공급망 관리는 <b>주문(Order), 물류(Logistics), 창고(Warehouse Receiving), 재무(Finance)</b>의 4대 독립 도메인으로 구성되어 있으며, 각 단계는 명확한 책임 분계점(Handoff Boundary)을 통해 유기적으로 연결됩니다.</p>
      
      <div class="card" style="background:#0F172A; color:#FFFFFF; border:none; padding:10px; margin:4px 0;">
        <div style="font-size:7.5pt; font-weight:700; color:#38BDF8; margin-bottom:4px;">📊 4대 비즈니스 도메인 아키텍처 및 연계 흐름</div>
        <div style="font-family:monospace; font-size:6.8pt; line-height:1.4; color:#E2E8F0;">
                                          ┌── [MAN-B-LOG-001] 선적 &amp; 물류 도메인 ── [창고 도메인] 입고 검수<br>
        [MAN-B-ORD-001] 발주 및 계약 확정 ──┤   (Goods Readiness → Cargo Spec → Inbound Tracking → Arrival → Receiving Handoff)<br>
        (po_status: APPROVED/SENT         │<br>
         supplier_confirmation: CONFIRMED)└── [MAN-B-FIN-001] 재무 &amp; 정산 도메인<br>
                                              (Invoice Creation → Approval → Settlement)
        </div>
      </div>
      
      <div class="grid-2" style="margin-top:2px;">
        <div class="card">
          <div class="card-title">1️⃣ 발주 확정 단계 (MAN-B-ORD-001)</div>
          <p style="font-size:7pt; margin:0;">관리자가 발행한 정식 발주서(PO)를 공급사가 수락(<code>CONFIRMED</code>)함으로써 법적 계약이 체결됩니다. 승인(<code>APPROVED/SENT</code>) 및 확정 후 출고 준비와 재무 작업이 독립 개시됩니다.</p>
        </div>
        <div class="card">
          <div class="card-title">2️⃣ 선적 &amp; 물류 단계 (MAN-B-LOG-001 &bull; 본 매뉴얼)</div>
          <p style="font-size:7pt; margin:0;">생산 완료 후 준비 수량(<code>ready_qty</code>)과 실측 패킹 스펙(카톤 수, 총중량, CBM, P/L, C/I)을 등록하고, 지정된 운송 방식에 따라 화물을 인계하여 미국 도착(<code>ARRIVED</code>)까지 추적합니다.</p>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-title">3️⃣ 창고 입고 검수 단계 (Warehouse Domain)</div>
          <p style="font-size:7pt; margin:0;">화물이 미국 창고에 도착하면 현장 관리자가 바코드를 스캔하고 피스 카운팅을 진행하여 정상 입고(<code>received_qty</code>), 파손(<code>damaged_qty</code>), 보류(<code>hold_qty</code>)를 판정합니다.</p>
        </div>
        <div class="card">
          <div class="card-title">4️⃣ 재무 &amp; 정산 단계 (MAN-B-FIN-001)</div>
          <p style="font-size:7pt; margin:0;">확정된 PO를 바탕으로 합의된 상업적 결제 조건(선급금, 선적 시 정산, 입고 검수 후 정산 등)에 따라 인보이스를 발행하고 대금 지급 및 정산을 처리합니다.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">3 / 22</span>
    </div>
  </div>
  `;

  // PAGE 4: CHAPTER 1 - SHIPPING RESPONSIBILITY
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 01 &bull; OVERVIEW</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 01</span>
      <h1 class="chapter-title">1.2 운송 책임(Shipping Responsibility) 분기 이해</h1>
      <p>K SELECT 시스템은 발주서 생성 시 합의된 무역 조건(Incoterms)에 따라 두 가지 운송 책임 트랙으로 자동 분기됩니다.</p>
      
      <table>
        <tr>
          <th style="width:20%;">구분</th>
          <th style="width:40%;">Track 1: LETUSTO_ARRANGED (본사 지정 운송)</th>
          <th style="width:40%;">Track 2: SUPPLIER_ARRANGED (공급사 자체 운송)</th>
        </tr>
        <tr>
          <td><b>기준 거래조건</b></td>
          <td><span class="badge badge-blue">FOB (Free On Board)</span> / FCA 기준</td>
          <td><span class="badge badge-purple">DDP (Delivered Duty Paid)</span> / DAP 기준</td>
        </tr>
        <tr>
          <td><b>국제 운송 주관</b></td>
          <td><b>Letusto Inc. (K SELECT 본사 지정 포워더)</b></td>
          <td><b>브랜드사 / 공급사 자체 계약 운송사</b></td>
        </tr>
        <tr>
          <td><b>공급사 주요 역할</b></td>
          <td>
            &bull; 출고 준비 등록 (스펙, 중량, CBM, P/L, C/I)<br>
            &bull; 포워더 방문 픽업 지원 및 실물 화물 상차<br>
            &bull; Portal에서 <code>[물품 인계 완료 (Handed Over)]</code> 클릭
          </td>
          <td>
            &bull; 출고 준비 등록 (스펙, 중량, CBM, P/L, C/I)<br>
            &bull; 자체 특송/해운사(FedEx, DHL 등)를 통한 발송<br>
            &bull; 상세 화면에서 <b>배송 정보(Carrier, 송장/BL, ETD/ETA) 직접 등록</b>
          </td>
        </tr>
        <tr>
          <td><b>선적 번호 생성</b></td>
          <td>Letusto 관리자가 포워더 부킹 후 Admin에서 생성</td>
          <td>공급사가 선적 정보 등록 시 시스템 자동 생성</td>
        </tr>
        <tr>
          <td><b>적용 권장 대상</b></td>
          <td>대량 컨테이너 선적(FCL/LCL) 및 본사 통합 물류 이용 시</td>
          <td>긴급 소량 항공 특송(Courier) 및 자체 물류망 보유 시</td>
        </tr>
      </table>
      
      <div class="callout callout-warning">
        <div class="callout-title">⚠️ IMPORTANT &bull; 계약 운송 조건 사전 확인</div>
        발주서가 발행된 이후에는 운송 책임 방식을 임의로 변경할 수 없습니다. 발주서 수락 전 반드시 상단에 표기된 <code>shipping_responsibility</code>(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED)를 확인하시기 바랍니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">4 / 22</span>
    </div>
  </div>
  `;

  // PAGE 5: DIAGRAM 1 - END-TO-END INTERNATIONAL LOGISTICS PROCESS
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">DIAGRAM 1 &bull; END-TO-END</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">DIAGRAM 1</span>
      <h1 class="chapter-title">전체 국제 물류 라이프사이클 (End-to-End Logistics Process)</h1>
      <p>공식 발주 확정부터 최종 미국 물류센터 입고 검수 및 행정 마감까지의 6단계 Handoff 파이프라인입니다.</p>
      
      <div class="card" style="background:#F8FAFC; border:1px solid #CBD5E1; padding:10px;">
        <div style="display:flex; flex-direction:column; gap:8px;">
          
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="background:#0F172A; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-weight:800; font-size:7pt; width:70px; text-align:center;">STEP 01</div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px; flex:1; font-size:7.2pt;">
              <b>발주 및 계약 확정 (MAN-B-ORD-001)</b><br>
              <span style="color:#64748B;">Admin 발주서 승인(APPROVED) &rarr; Brand 수락 확정(CONFIRMED) &rarr; 물류 이행 개시</span>
            </div>
          </div>
          
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="background:#0284C7; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-weight:800; font-size:7pt; width:70px; text-align:center;">STEP 02</div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px; flex:1; font-size:7.2pt;">
              <b>출고 준비 완료 등록 (Goods Readiness Submission)</b><br>
              <span style="color:#64748B;">준비 수량(ready_qty), 실측 패킹 스펙(Cartons, Gross Weight, CBM), P/L &amp; C/I 첨부 제출</span>
            </div>
          </div>
          
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="background:#4F46E5; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-weight:800; font-size:7pt; width:70px; text-align:center;">STEP 03</div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px; flex:1; font-size:7.2pt;">
              <b>운송 책임별 출고 이행 (Track 1 FOB vs Track 2 DDP)</b><br>
              <span style="color:#64748B;">[Track 1] 본사 지정 포워더 픽업 &rarr; [인계 완료] 클릭 | [Track 2] 공급사 특송 발송 &rarr; [선적 등록] 입력</span>
            </div>
          </div>
          
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="background:#0891B2; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-weight:800; font-size:7pt; width:70px; text-align:center;">STEP 04</div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px; flex:1; font-size:7.2pt;">
              <b>국제 운송 및 선적 추적 (Inbound Tracking)</b><br>
              <span style="color:#64748B;">CREATED (선적 생성) &rarr; IN_TRANSIT (항공/해상 운송 중) &rarr; 미국 세관 통관 &rarr; ARRIVED (창고 도착)</span>
            </div>
          </div>
          
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="background:#D97706; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-weight:800; font-size:7pt; width:70px; text-align:center;">STEP 05</div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px; flex:1; font-size:7.2pt;">
              <b>미국 창고 입고 검수 및 인계 (Warehouse Receiving Handoff)</b><br>
              <span style="color:#64748B;">외관 검사 &bull; 피스 카운팅 &bull; 3분류 판정: 양품(received_qty) / 파손(damaged_qty) / 보류(hold_qty)</span>
            </div>
          </div>
          
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="background:#059669; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-weight:800; font-size:7pt; width:70px; text-align:center;">STEP 06</div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px 10px; border-radius:4px; flex:1; font-size:7.2pt;">
              <b>입고 전표 확정 및 오더 종결 (Receiving Finalized &amp; Completed)</b><br>
              <span style="color:#64748B;">발주서 물류 이행 완료(RECEIVED / COMPLETED) &bull; (재무 인보이스는 계약에 따라 독립 정산)</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">5 / 22</span>
    </div>
  </div>
  `;

  // PAGE 6: CHAPTER 2 - SHIPPING HUB UI (GOODS READINESS TAB)
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 02 &bull; SHIPPING HUB</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 02</span>
      <h1 class="chapter-title">선적 &amp; 출고 관리 허브 둘러보기 (Shipping Hub UI)</h1>
      
      <div class="section-title">2.1 출고 준비 등록 내역 (Goods Readiness Tab)</div>
      <p>Brand Portal 좌측 메뉴에서 <code>주문 관리 &gt; 선적 &amp; 출고 관리</code>(<code>/portal/orders/shipping</code>)로 이동하면 <b>출고 준비 등록 내역</b> 탭이 기본 표시됩니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping</span>
        </div>
        <img src="${scrs.scr1}" alt="SCR-B-LOG-001" />
        <div class="screenshot-caption">SCR-B-LOG-001 &bull; [그림 2-1] 선적 &amp; 출고 관리 허브 — 출고 준비 등록 내역 탭 목록 화면</div>
      </div>
      
      <div class="grid-3" style="font-size:7pt;">
        <div class="card">
          <b>① PO Number</b><br>
          연계된 공식 발주서 번호 (예: PO-2026-0008).
        </div>
        <div class="card">
          <b>② 운송 책임 &amp; 준비일</b><br>
          Letusto 배송 / 공급사 배송 뱃지 및 출고 예정일.
        </div>
        <div class="card">
          <b>③ 인계 상태 &amp; 상세</b><br>
          DRAFT / READY_SUBMITTED / HANDED_OVER.
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">6 / 22</span>
    </div>
  </div>
  `;

  // PAGE 7: CHAPTER 2 - SHIPMENTS TAB
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 02 &bull; SHIPPING HUB</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 02</span>
      <h1 class="chapter-title">2.2 선적 추적 내역 (Shipments Tab)</h1>
      <p>상단 탭에서 <code>선적 추적 내역 (Shipments)</code> 버튼을 클릭하면 실제 국제 운송이 진행 중인 Inbound Shipments 목록을 확인할 수 있습니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping?tab=shipments</span>
        </div>
        <img src="${scrs.scr2}" alt="SCR-B-LOG-002" />
        <div class="screenshot-caption">SCR-B-LOG-002 &bull; [그림 2-2] 선적 &amp; 출고 관리 허브 — 선적 추적 내역(Shipments) 탭 목록 화면</div>
      </div>
      
      <div class="grid-3" style="font-size:7pt;">
        <div class="card">
          <b>선적 번호 (Shipment No)</b><br>
          고유 식별자 (예: SHP-2026-0041).
        </div>
        <div class="card">
          <b>배송사 &amp; 스케줄</b><br>
          Carrier(FedEx, Maersk 등), ETD, ETA.
        </div>
        <div class="card">
          <b>선적 및 입고 상태</b><br>
          CREATED &rarr; IN_TRANSIT &rarr; ARRIVED.
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">7 / 22</span>
    </div>
  </div>
  `;

  // PAGE 8: CHAPTER 3 - GOODS READINESS SUBMISSION (FORM HEADER)
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 03 &bull; GOODS READINESS</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 03</span>
      <h1 class="chapter-title">출고 준비 완료 등록 (Goods Readiness Submission)</h1>
      
      <div class="section-title">3.1 발주서 선택 및 기본 물류 정보 입력</div>
      <p>우측 상단의 <code>+ 새 출고 준비 등록 (New Goods Ready)</code> 버튼을 클릭하여 출고 정보를 작성합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/new</span>
        </div>
        <img src="${scrs.scr3}" alt="SCR-B-LOG-003" />
        <div class="screenshot-caption">SCR-B-LOG-003 &bull; [그림 3-1] 새 출고 준비 등록 — 대상 발주서 선택 및 기본 물류 정보 입력 폼</div>
      </div>
      
      <div class="grid-2" style="font-size:7pt;">
        <div class="card">
          <b>1. 대상 발주서 선택 (PO Number)</b><br>
          승인 및 확정된(<code>CONFIRMED</code>) 발주서만 목록에 노출됩니다.
        </div>
        <div class="card">
          <b>2. 출고 준비 완료 예정일</b><br>
          화물이 포장 완료되어 출고 가능한 목표 일자 지정.
        </div>
        <div class="card">
          <b>3. FOB 선적항 및 공장 출고지 주소</b><br>
          포워더 기사님이 직접 방문하여 상차할 상세 도로명 주소.
        </div>
        <div class="card">
          <b>4. 현장 담당자 연락처 &amp; 특이사항</b><br>
          상차 당일 연락 가능한 담당자 성명, 직통 번호, 지게차 여부.
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">8 / 22</span>
    </div>
  </div>
  `;

  // PAGE 9: CHAPTER 3 - PACKAGING LINES & CARGO SPEC
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 03 &bull; GOODS READINESS</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 03</span>
      <h1 class="chapter-title">3.2 품목별 수량 배정 및 실측 카고 스펙 산출</h1>
      <p>발주서를 선택하면 하단에 발주 품목 라인이 자동으로 표시됩니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/new#items</span>
        </div>
        <img src="${scrs.scr4}" alt="SCR-B-LOG-004" />
        <div class="screenshot-caption">SCR-B-LOG-004 &bull; [그림 3-2] 출고 품목별 준비 수량 및 실측 패킹 스펙(카톤 수, 중량, CBM) 입력 화면</div>
      </div>
      
      <div class="grid-2" style="font-size:7pt;">
        <div class="card">
          <b>📊 수량 필드 계산 규칙</b><br>
          &bull; 확정량(<code>confirmed_qty</code>): 발주 확정 총량<br>
          &bull; 누적 선적량(<code>cumulative_shipped</code>): 기존 선적 완료 수량<br>
          &bull; 준비 가용 수량(<code>availableReadiness</code>): 미선적 잔여 수량
        </div>
        <div class="card">
          <b>📦 4대 실측 패킹 스펙</b><br>
          &bull; <code>Ready Qty</code>: 이번 차수 준비 수량 (EA)<br>
          &bull; <code>Cartons</code>: 포장된 총 박스 수<br>
          &bull; <code>Gross Weight</code>: 포장재 포함 총중량 (kg)<br>
          &bull; <code>CBM</code>: 총 화물 부피 (m&sup3; = W &times; L &times; H &times; Cartons)
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">9 / 22</span>
    </div>
  </div>
  `;

  // PAGE 10: CHAPTER 3 - OVERAGE PROTECTION
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 03 &bull; GOODS READINESS</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CRITICAL GUARDRAIL</span>
      <h1 class="chapter-title">3.2 수량 초과 방지 원칙 (Overage Protection)</h1>
      <p>시스템은 계약된 발주 가용량을 초과하는 출고 등록을 원천 차단합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/new#overage</span>
        </div>
        <img src="${scrs.scr8}" alt="SCR-B-LOG-008" />
        <div class="screenshot-caption">SCR-B-LOG-008 &bull; [그림 3-3] 발주 가용 수량 초과 입력 시 실시간 경고 배너 및 필드 강조 표시</div>
      </div>
      
      <div class="callout callout-danger">
        <div class="callout-title">🚨 CRITICAL &bull; 가용 수량 초과 입력 시 저장 차단</div>
        준비 가용 수량(<code>availableReadiness</code>)을 초과하여 <code>ready_qty</code>를 입력하면 입력창 테두리가 붉은색으로 강조되고, 상단에 <code>⚠️ 경고: 준비 가용 수량을 초과하는 Ready Qty가 존재합니다</code> 배너가 출력되며 저장이 차단됩니다.
      </div>
      
      <div class="card" style="font-size:7.2pt; margin-top:4px;">
        <b>💡 추가 수량 출고가 필요한 경우</b><br>
        생산 수량 증가 등으로 추가 출고가 필요한 경우, 출고 준비 등록 전 담당 관리자에게 <b>발주 수량 증액(PO Revision)</b>을 요청하여 확정(<code>CONFIRMED</code>)된 후 출고를 진행해야 합니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">10 / 22</span>
    </div>
  </div>
  `;

  // PAGE 11: CHAPTER 3 - DOCUMENTS & SUBMIT
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 03 &bull; GOODS READINESS</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 03</span>
      <h1 class="chapter-title">3.3 필수 서류 첨부 &bull; 3.4 임시 저장 및 제출</h1>
      
      <div class="section-title">3.3 필수 서류 첨부: Packing List (P/L) &amp; Commercial Invoice (C/I)</div>
      <p>국제 운송 및 미국 세관 수입 통관을 위해 2대 필수 무역 서류를 첨부해야 합니다.</p>
      
      <div class="grid-2">
        <div class="card">
          <b>📄 패킹 리스트 (Packing List)</b><br>
          <span style="font-size:7pt; color:#64748B;">박스 번호, 박스당 입수량, 순중량(Net Weight), 총중량(Gross Weight), CBM이 기재된 서류. (.pdf, .png, .jpg)</span>
        </div>
        <div class="card">
          <b>📄 상업 송장 (Commercial Invoice)</b><br>
          <span style="font-size:7pt; color:#64748B;">발주 번호, 품목명, 단가, 총금액, 거래조건(Incoterms)이 명시된 공식 인보이스. (.pdf, .png, .jpg)</span>
        </div>
      </div>
      
      <div class="section-title" style="margin-top:6px;">3.4 임시 저장(Save Draft) 및 출고 완료 제출(Submit)</div>
      <div class="grid-2">
        <div class="card" style="border-left:3px solid #64748B;">
          <b>💾 임시 저장 (Save Draft)</b><br>
          <span style="font-size:7pt; color:#334155;">입력 중인 정보를 보관하며, 상태가 <code>DRAFT</code>로 유지됩니다. 언제든 다시 열어 수량, 스펙, 첨부파일을 자유롭게 수정할 수 있습니다.</span>
        </div>
        <div class="card" style="border-left:3px solid #0284C7;">
          <b>🚀 출고 완료 제출 (Submit)</b><br>
          <span style="font-size:7pt; color:#334155;">등록을 확정하여 <code>READY_SUBMITTED</code>로 전환됩니다. 발주서의 이행 상태(<code>fulfillment_status</code>)가 <code>READY_TO_SHIP</code>으로 자동 업데이트됩니다.</span>
        </div>
      </div>
      
      <div class="callout callout-info" style="margin-top:6px;">
        <div class="callout-title">🔒 Private Storage 보안 스토리지 저장</div>
        업로드된 P/L 및 C/I 서류는 Letusto의 보안 스토리지(Private Bucket)에 안전하게 암호화 저장되며, 권한이 있는 담당자만 Signed URL을 통해 안전하게 열람/다운로드할 수 있습니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">11 / 22</span>
    </div>
  </div>
  `;

  // PAGE 12: CHAPTER 4 - TRACK 1 LETUSTO ARRANGED
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 04 &bull; FULFILLMENT</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 04</span>
      <h1 class="chapter-title">운송 책임별 출고 및 선적 이행 (Fulfillment Execution)</h1>
      
      <div class="section-title">4.1 [Track 1] LETUSTO 지정 운송 (FOB): 포워더 픽업 및 인계</div>
      <p><code>LETUSTO_ARRANGED</code> 발주서의 경우, 출고 준비 제출 완료 후 본사가 지정한 국제 포워더가 배정됩니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/[id]</span>
        </div>
        <img src="${scrs.scr5}" alt="SCR-B-LOG-005" />
        <div class="screenshot-caption">SCR-B-LOG-005 &bull; [그림 4-1] Track 1 LETUSTO 지정 운송 — 출고 준비 상세 및 물품 인계 완료(Handed Over) 액션 패널</div>
      </div>
      
      <div class="grid-3" style="font-size:7pt;">
        <div class="card">
          <b>1. 포워더 조율</b><br>
          Letusto 물류팀이 선적 스케줄을 확정하고 포워더 배차 정보를 등록합니다.
        </div>
        <div class="card">
          <b>2. 화물 픽업 (Pickup)</b><br>
          지정 일시에 운송 차량이 방문하여 실물 화물과 서류를 상차 수거합니다.
        </div>
        <div class="card">
          <b>3. [물품 인계 완료] 클릭</b><br>
          상차 완료 후 인디고 버튼을 클릭하여 상태를 <code>HANDED_OVER</code>로 갱신합니다.
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">12 / 22</span>
    </div>
  </div>
  `;

  // PAGE 13: CHAPTER 4 - TRACK 2 SUPPLIER ARRANGED
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 04 &bull; FULFILLMENT</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 04</span>
      <h1 class="chapter-title">4.2 [Track 2] 공급사 자체 운송 (DDP): 특송/포워더 배송 정보 등록</h1>
      <p><code>SUPPLIER_ARRANGED</code> 발주서의 경우, 공급사가 자체 물류망을 통해 직접 출고 및 국제 선적을 진행합니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/[id]</span>
        </div>
        <img src="${scrs.scr6}" alt="SCR-B-LOG-006" />
        <div class="screenshot-caption">SCR-B-LOG-006 &bull; [그림 4-2] Track 2 공급사 자체 운송 — 배송사, 송장/BL 번호, ETD/ETA 입력 폼 화면</div>
      </div>
      
      <div class="grid-2" style="font-size:7pt;">
        <div class="card">
          <b>입력 필드 안내</b><br>
          &bull; <b>배송사 (Carrier):</b> FedEx, DHL, CJ대한통운 등<br>
          &bull; <b>송장번호 (Tracking No):</b> 국제 특송 송장 번호<br>
          &bull; <b>B/L 또는 AWB 번호:</b> 해상 B/L 또는 항공운송장 번호<br>
          &bull; <b>ETD &amp; ETA:</b> 출항 예정일 및 현지 도착 예정일
        </div>
        <div class="card">
          <b>[배송 출발 및 선적 등록] 실행</b><br>
          버튼 클릭 시 신규 <code>inbound_shipments</code> 레코드가 자동 생성되며, 선적 상태가 <code>IN_TRANSIT</code>으로 즉시 전환됩니다. 발주서의 물류 상태는 <code>SHIPPED</code>로 갱신됩니다.
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">13 / 22</span>
    </div>
  </div>
  `;

  // PAGE 14: CHAPTER 4 - HANDED OVER STATE
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 04 &bull; FULFILLMENT</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 04</span>
      <h1 class="chapter-title">4.2 [Track 2] 계속: 물품 인계 및 발송 처리 종료 상태</h1>
      <p>배송 등록이 완료되면 출고 준비 상세 화면에 녹색 안내 배너가 표시되며 물류 인계가 완료됩니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/[id]</span>
        </div>
        <img src="${scrs.scr7}" alt="SCR-B-LOG-007" />
        <div class="screenshot-caption">SCR-B-LOG-007 &bull; [그림 4-3] 물류 인계 및 발송 처리 종료 상태 안내 배너 화면</div>
      </div>
      
      <div class="callout callout-success">
        <div class="callout-title">✓ 물류 인계 및 발송 처리가 종료된 건입니다.</div>
        공급사 직배송 선적 등록 또는 포워더 인계 처리가 완료되면 추가 수정이 제한되며, 이후 진행 상태는 <b>선적 추적 내역(Shipments)</b> 탭에서 실시간으로 확인하실 수 있습니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">14 / 22</span>
    </div>
  </div>
  `;

  // PAGE 15: DIAGRAM 2 & 3 - DETAILED SEQUENCES
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 04 &bull; FULFILLMENT</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">WORKFLOW SEQUENCES</span>
      <h1 class="chapter-title">운송 책임별 상세 시퀀스 다이어그램 (Dual-Track Sequences)</h1>
      
      <div class="card" style="background:#F0F9FF; border:1px solid #BAE6FD;">
        <div class="card-title" style="color:#0369A1;">🔵 Diagram 2: Track 1 LETUSTO_ARRANGED (FOB) 상세 시퀀스</div>
        <div style="font-family:monospace; font-size:6.8pt; line-height:1.4; color:#0C4A6E;">
        [공급사] ── 출고 준비 등록(스펙/서류) ──► [READY_SUBMITTED]<br>
                     │<br>
                     ▼<br>
        [Letusto 물류팀] ── 포워더 배정 &amp; 픽업 스케줄링 ──► [포워더 공장 방문]<br>
                     │<br>
                     ▼<br>
        [공급사] ── 실물 화물 상차 후 ──► [물품 인계 완료(HANDED_OVER) 클릭]<br>
                     │<br>
                     ▼<br>
        [Letusto 물류팀] ── 선적 B/L 발행 &amp; Inbound Shipment 생성 ──► [IN_TRANSIT]
        </div>
      </div>
      
      <div class="card" style="background:#FAF5FF; border:1px solid #E9D5FF; margin-top:4px;">
        <div class="card-title" style="color:#6B21A8;">🟣 Diagram 3: Track 2 SUPPLIER_ARRANGED (DDP) 상세 시퀀스</div>
        <div style="font-family:monospace; font-size:6.8pt; line-height:1.4; color:#581C87;">
        [공급사] ── 출고 준비 등록(스펙/서류) ──► [READY_SUBMITTED]<br>
                     │<br>
                     ▼<br>
        [공급사] ── 자체 특송사(FedEx/DHL) 화물 인계 및 송장 발급<br>
                     │<br>
                     ▼<br>
        [공급사] ── Carrier, 송장번호, ETD/ETA 입력 ──► [배송 출발 및 선적 등록]<br>
                     │<br>
                     ▼<br>
        [시스템] ── inbound_shipments 자동 생성 &amp; 상태 전환 ──► [IN_TRANSIT]
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">15 / 22</span>
    </div>
  </div>
  `;

  // PAGE 16: CHAPTER 5 - INBOUND TRACKING & RECEIVING HANDOFF
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 05 &bull; INBOUND &amp; RECEIVING</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 05</span>
      <h1 class="chapter-title">선적 추적 및 미국 창고 입고 인계 (Inbound Tracking &amp; Receiving Handoff)</h1>
      
      <div class="section-title">5.1 선적 진행 상태 모니터링 (Inbound Tracking)</div>
      <p>선적이 개시되면 Brand Portal의 <b>선적 추적 내역 (Shipments)</b> 탭에서 실시간 운송 상태를 모니터링할 수 있습니다.</p>
      
      <div class="card" style="background:#0F172A; color:#FFFFFF; border:none; padding:8px;">
        <div style="font-size:7pt; font-weight:700; color:#38BDF8; margin-bottom:3px;">📈 선적 상태 전이 머신 (Inbound Shipment State Machine)</div>
        <div style="font-family:monospace; font-size:6.5pt; line-height:1.35; color:#E2E8F0;">
        [ LOGISTICS 관할 (브랜드 포털 물류) ]                    [ WAREHOUSE RECEIVING 관할 (Admin/창고) ]<br>
        [ CREATED ] ──► [ IN_TRANSIT ] ──► [ ARRIVED ] ──► [ HANDOFF ] ──► [ PARTIALLY_RECEIVED / RECEIVED ] ──► [ COMPLETED ]
        </div>
      </div>
      
      <div class="grid-2" style="font-size:7pt; margin-top:2px;">
        <div class="card">
          <b>🌊 물류 운송 단계 (Brand Responsibility)</b><br>
          &bull; <code>CREATED</code>: 선적 번호 생성 및 스케줄 확정<br>
          &bull; <code>IN_TRANSIT</code>: 선박/항공 출항하여 국제 운송 중<br>
          &bull; <code>ARRIVED</code>: 미국 물류센터 도크 도착 (물류 책임 종료)
        </div>
        <div class="card">
          <b>🏬 창고 입고 검수 단계 (Warehouse Domain)</b><br>
          &bull; <code>PARTIALLY_RECEIVED</code>: 일부 카톤 바코드 검수 완료<br>
          &bull; <code>RECEIVED</code>: 전체 실물 피스 카운팅 완료<br>
          &bull; <code>COMPLETED</code>: 행정/입고 프로세스 최종 종결
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">16 / 22</span>
    </div>
  </div>
  `;

  // PAGE 17: CHAPTER 5 - ADMIN REFERENCE (INBOUND SHIPMENT DETAIL)
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 05 &bull; INBOUND &amp; RECEIVING</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag" style="background:#F1F5F9; color:#475569;">ADMIN REFERENCE</span>
      <h1 class="chapter-title">K SELECT 관리자 인바운드 선적 콘솔 (참고 화면)</h1>
      <p style="font-size:7pt; color:#64748B;">본 화면은 K SELECT 관리자(Admin) 전용 화면으로, 브랜드 포털 사용자에게는 노출되지 않는 백오피스 운영 화면입니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://admin.kselectnetwork.com/admin/orders/shipments/[id]</span>
        </div>
        <img src="${scrs.scr10}" alt="SCR-B-LOG-010" />
        <div class="screenshot-caption">SCR-B-LOG-010 &bull; [그림 5-1] K SELECT 관리자 인바운드 선적 상세 화면 (선적 번호, B/L, 도착 창고 관리)</div>
      </div>
      
      <div class="card" style="font-size:7pt;">
        <b>💡 관리자 선적 관리 역할</b><br>
        Letusto 물류팀은 Admin 콘솔에서 선적 마스터 번호(SHP-XXXX)를 부여하고, 컨테이너 B/L 및 선박 운항 정보를 실시간 연동하여 브랜드 포털에 최신 선적 상태를 제공합니다.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">17 / 22</span>
    </div>
  </div>
  `;

  // PAGE 18: CHAPTER 5 - WAREHOUSE RECEIVING HANDOFF
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 05 &bull; INBOUND &amp; RECEIVING</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 05</span>
      <h1 class="chapter-title">5.2 미국 창고 입고 검수 및 실물 인계 (Warehouse Receiving)</h1>
      <p>화물이 미국 물류센터 도크에 도착(<code>ARRIVED</code>)하면 실물 입고 검수가 개시됩니다.</p>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://admin.kselectnetwork.com/admin/warehouse/receiving/[id]</span>
        </div>
        <img src="${scrs.scr11}" alt="SCR-B-LOG-011" />
        <div class="screenshot-caption">SCR-B-LOG-011 &bull; [그림 5-2] 미국 창고 현장 실물 입고 검수 콘솔 — 바코드 스캔 및 3분류 판정 화면</div>
      </div>
      
      <div class="grid-3" style="font-size:7pt;">
        <div class="card" style="border-top:3px solid #059669;">
          <b style="color:#059669;">1. 정상 입고 (Received)</b><br>
          양품으로 확인되어 창고 실물 재고로 공식 반영되는 수량 (<code>received_qty</code>).
        </div>
        <div class="card" style="border-top:3px solid #E11D48;">
          <b style="color:#E11D48;">2. 파손 격리 (Damaged)</b><br>
          운송 중 찌그러짐, 파손, 오염 등으로 불량 격리되는 수량 (<code>damaged_qty</code>).
        </div>
        <div class="card" style="border-top:3px solid #D97706;">
          <b style="color:#D97706;">3. 판정 보류 (Hold)</b><br>
          라벨 오부착, 바코드 인식 불가, 수량 불일치 보류 수량 (<code>hold_qty</code>).
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">18 / 22</span>
    </div>
  </div>
  `;

  // PAGE 19: CHAPTER 6 - ACL & VIEWER ROLE RESTRICTIONS (CLEAN - NO PRODUCTION NOTE)
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 06 &bull; ACL &amp; FAQ</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 06</span>
      <h1 class="chapter-title">권한 관리 및 문제 해결 FAQ (ACL &amp; Troubleshooting)</h1>
      
      <div class="section-title">6.1 권한 체계 (Role Permissions)</div>
      <p>K SELECT Brand Portal은 회사 구성원의 역할에 따라 엄격한 기능 권한을 부여합니다.</p>
      
      <table style="font-size:7.2pt;">
        <tr>
          <th>메뉴 및 기능</th>
          <th style="text-align:center;">회사 관리자 (Admin / Owner)</th>
          <th style="text-align:center;">운영자 (Operator)</th>
          <th style="text-align:center;">조회 전용 사용자 (Viewer)</th>
        </tr>
        <tr>
          <td><b>선적/출고 목록 및 상세 조회</b></td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
        </tr>
        <tr>
          <td><b>첨부파일(P/L, C/I) 다운로드</b></td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
        </tr>
        <tr>
          <td><b>새 출고 준비 등록 (+ New Goods Ready)</b></td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center; color:#E11D48;">○ 버튼 미노출</td>
        </tr>
        <tr>
          <td><b>물품 인계 완료 처리 (Handed Over)</b></td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center; color:#E11D48;">○ "조회 전용 권한입니다" 배너 표시</td>
        </tr>
        <tr>
          <td><b>공급사 직배송 선적 등록 (Dispatch Form)</b></td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center;">● 가능</td>
          <td style="text-align:center; color:#E11D48;">○ 입력 폼 비활성화</td>
        </tr>
      </table>
      
      <div class="screenshot-box">
        <div class="screenshot-header">
          <span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>
          <span class="browser-url">https://portal.kselectnetwork.com/portal/orders/shipping/[id]</span>
        </div>
        <img src="${scrs.scr9}" alt="SCR-B-LOG-009" />
        <div class="screenshot-caption">SCR-B-LOG-009 &bull; [그림 6-2] 조회 전용 권한(Viewer) 계정의 읽기 전용 모드 화면</div>
      </div>
      
      <div class="grid-2" style="font-size:7pt;">
        <div class="card">
          <b>1. 생성 버튼 미노출:</b> 우측 상단 <code>+ 새 출고 준비 등록</code> 버튼 비표시.
        </div>
        <div class="card">
          <b>2. 조회 전용 안내 패널:</b> <code>조회 전용 권한입니다 (선적 및 인계 작업 불가)</code> 배너 표시.
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">19 / 22</span>
    </div>
  </div>
  `;

  // PAGE 20: CHAPTER 6 - LOGISTICS FAQ TOP 6
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">CHAPTER 06 &bull; ACL &amp; FAQ</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">CHAPTER 06</span>
      <h1 class="chapter-title">6.2 자주 묻는 질문 (Logistics FAQ Top 6)</h1>
      
      <div style="display:flex; flex-direction:column; gap:5px; font-size:7.2pt;">
        <div class="card">
          <b style="color:#0284C7;">Q1. 하나의 발주서(PO)에 대해 여러 번 나누어 분할 출고(Partial Shipment)를 할 수 있나요?</b>
          <p style="margin:2px 0 0 0; color:#334155;"><b>A:</b> 네, 가능합니다. 발주서의 잔여 가용 수량(<code>availableReadiness</code>) 범위 내라면 여러 차례에 걸쳐 분할 출고 준비(<code>Goods Readiness</code>)를 등록할 수 있습니다. 각 출고 건마다 독립된 실측 CBM, 중량, 패킹리스트, 인계 상태가 관리됩니다.</p>
        </div>
        
        <div class="card">
          <b style="color:#0284C7;">Q2. 출고 준비 완료를 제출(READY_SUBMITTED)한 후 수량이나 주소를 수정할 수 있나요?</b>
          <p style="margin:2px 0 0 0; color:#334155;"><b>A:</b> 포워더에 물품을 인계하기 전(<code>handover_status</code>가 <code>HANDED_OVER</code>로 변경되기 전)이라면 언제든지 출고 준비 정보를 수정하여 재제출할 수 있습니다. 수정 시 변경 이력이 발주서 액티비티 로그에 자동으로 기록됩니다.</p>
        </div>
        
        <div class="card">
          <b style="color:#0284C7;">Q3. ARRIVED 상태와 RECEIVED 상태는 무엇이 다른가요?</b>
          <p style="margin:2px 0 0 0; color:#334155;"><b>A:</b> <code>ARRIVED</code>는 화물이 미국 물류센터 도크에 물리적으로 도착한 시점을 뜻하며(운송 단계 완료), <code>RECEIVED</code>는 창고 검수자가 박스를 개봉하여 실물 수량과 품질을 전수 검수한 후 입고 전표를 확정한 시점을 뜻합니다.</p>
        </div>
        
        <div class="card">
          <b style="color:#0284C7;">Q4. 패킹리스트와 상업송장 파일 첨부는 필수인가요?</b>
          <p style="margin:2px 0 0 0; color:#334155;"><b>A:</b> 국제 운송 및 미국 세관 통관을 위해 P/L과 C/I 첨부는 강력히 권장됩니다. 서류가 누락될 경우 포워더 픽업이나 현지 세관 통관이 지연될 수 있습니다.</p>
        </div>
        
        <div class="card">
          <b style="color:#0284C7;">Q5. 가용 수량을 초과하여 출고해야 하는 특별한 사정이 있는 경우 어떻게 하나요?</b>
          <p style="margin:2px 0 0 0; color:#334155;"><b>A:</b> 시스템상 계약 가용량을 초과하는 수량은 입력되지 않도록 유효성 검증(Validation)이 적용됩니다. 생산 수량 증가 등으로 추가 출고가 필요한 경우, 먼저 관리자에게 발주 수량 증액(PO Revision)을 요청하여 확정된 후 출고를 진행하셔야 합니다.</p>
        </div>
        
        <div class="card">
          <b style="color:#0284C7;">Q6. 인보이스 청구는 반드시 물류 도착이나 입고 검수 후에만 가능한가요?</b>
          <p style="margin:2px 0 0 0; color:#334155;"><b>A:</b> 아닙니다. 공식 발주서 확정(<code>po_status IN ('APPROVED', 'SENT')</code> AND <code>supplier_confirmation_status = 'CONFIRMED'</code>) 이후에는 양사 간 체결된 계약 조건(선급금 조건, 선적 시 청구 조건, 입고 후 청구 조건 등)에 따라 MAN-B-FIN-001 재무 메뉴에서 독립적으로 인보이스를 발행할 수 있습니다.</p>
        </div>
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">20 / 22</span>
    </div>
  </div>
  `;

  // PAGE 21: APPENDIX A - DOMAIN STATUS CODES
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">APPENDIX &bull; QUICK REFERENCE</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">APPENDIX A</span>
      <h1 class="chapter-title">상태 코드 및 용어 사전 (Domain Status Codes &amp; Glossary)</h1>
      
      <div class="grid-2" style="font-size:6.8pt;">
        <div>
          <b>A.1 purchase_orders.po_status 발주서 승인 상태</b>
          <table>
            <tr><th style="width:30%;">코드</th><th style="width:25%;">라벨</th><th>설명</th></tr>
            <tr><td><code>DRAFT</code></td><td>임시저장</td><td>관리자 작성 중 초기 상태</td></tr>
            <tr><td><code>PENDING_APPROVAL</code></td><td>승인대기</td><td>발주서 내부 결재 진행 중</td></tr>
            <tr><td><code>APPROVED</code></td><td>승인완료</td><td>공급사에 발송 가능한 상태</td></tr>
            <tr><td><code>SENT</code></td><td>발송완료</td><td>공급사에 공식 전달된 상태</td></tr>
            <tr><td><code>CANCELLED</code></td><td>취소됨</td><td>발주서 공식 취소 상태</td></tr>
          </table>
          
          <b style="margin-top:4px; display:block;">A.2 supplier_confirmation_status 수락 상태</b>
          <table>
            <tr><th style="width:30%;">코드</th><th style="width:25%;">라벨</th><th>설명</th></tr>
            <tr><td><code>PENDING</code></td><td>확인대기</td><td>공급사 수락/반려 검토 대기</td></tr>
            <tr><td><code>CONFIRMED</code></td><td>확정완료</td><td><b>계약 성립 (출고/인보이스 가능)</b></td></tr>
            <tr><td><code>REJECTED</code></td><td>거절/반려</td><td>공급사 조건 수정 요청/거절</td></tr>
          </table>
        </div>
        
        <div>
          <b>A.3 purchase_orders.fulfillment_status 이행 진척도</b>
          <table>
            <tr><th style="width:35%;">코드</th><th>설명</th></tr>
            <tr><td><code>PENDING</code></td><td>발주 확정 후 출고 준비 대기</td></tr>
            <tr><td><code>READY_TO_SHIP</code></td><td>Goods Readiness 제출 완료</td></tr>
            <tr><td><code>PARTIALLY_SHIPPED</code></td><td>발주 수량 일부 출항/선적</td></tr>
            <tr><td><code>SHIPPED</code></td><td>발주 전체 수량 선적 운송 중</td></tr>
            <tr><td><code>RECEIVED</code></td><td>미국 물류센터 전수 검수 완료</td></tr>
          </table>
          
          <b style="margin-top:4px; display:block;">A.4 goods_readiness.handover_status 인계 상태</b>
          <table>
            <tr><th style="width:35%;">코드</th><th>설명</th></tr>
            <tr><td><code>DRAFT</code></td><td>출고 정보 임시저장 (수정 가능)</td></tr>
            <tr><td><code>READY_SUBMITTED</code></td><td>출고 스펙 및 서류 제출 완료</td></tr>
            <tr><td><code>HANDOVER_PENDING</code></td><td>포워더 픽업 예약 진행 중</td></tr>
            <tr><td><code>HANDED_OVER</code></td><td>화물 상차 또는 선적 등록 완료</td></tr>
          </table>
        </div>
      </div>
      
      <b style="font-size:7pt; margin-top:2px; display:block;">A.5 inbound_shipments.status 국제 선적 상태</b>
      <table style="font-size:6.8pt;">
        <tr><th style="width:22%;">코드</th><th style="width:18%;">라벨</th><th>설명</th><th style="width:25%;">관할 도메인</th></tr>
        <tr><td><code>CREATED</code></td><td>선적생성</td><td>선적 마스터 번호 생성 및 부킹 단계</td><td><span class="badge badge-blue">LOGISTICS</span></td></tr>
        <tr><td><code>IN_TRANSIT</code></td><td>운송중</td><td>항공/해상 출항하여 미국으로 이동 중</td><td><span class="badge badge-blue">LOGISTICS</span></td></tr>
        <tr><td><code>ARRIVED</code></td><td>창고도착</td><td>미국 현지 물류센터 도크 화물 도착</td><td><span class="badge badge-amber">LOGISTICS &bull; HANDOFF</span></td></tr>
        <tr><td><code>PARTIALLY_RECEIVED</code></td><td>부분입고</td><td>일부 카톤 바코드 검수 완료 상태</td><td><span class="badge badge-purple">WAREHOUSE</span></td></tr>
        <tr><td><code>RECEIVED</code></td><td>전수검수완료</td><td>전체 화물 피스 카운팅 검수 완료</td><td><span class="badge badge-purple">WAREHOUSE</span></td></tr>
        <tr><td><code>COMPLETED</code></td><td>행정종결</td><td>선적 및 창고 검수 프로세스 최종 종결</td><td><span class="badge badge-green">WAREHOUSE</span></td></tr>
      </table>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">21 / 22</span>
    </div>
  </div>
  `;

  // PAGE 22: APPENDIX B, C, D - PACKAGING, DISAMBIGUATION & SUPPORT (CORRECTED TEXT)
  html += `
  <div class="page">
    <div class="page-header">
      <span class="header-left">K SELECT NETWORK &bull; MAN-B-LOG-001</span>
      <span class="header-right">APPENDIX &bull; QUICK REFERENCE</span>
    </div>
    
    <div class="content-area">
      <span class="chapter-tag">APPENDIX B &bull; C &bull; D</span>
      <h1 class="chapter-title">패킹 공식, 용어 원칙 및 고객지원 (Quick Reference)</h1>
      
      <div class="card" style="border:1px solid #E2E8F0;">
        <div class="card-title" style="color:#0284C7; font-size:7.8pt;">APPENDIX B &bull; 패킹 규격(CBM/중량) 계산 공식</div>
        <div class="grid-2" style="font-size:7pt;">
          <div>
            <b>B.1 CBM (Cubic Meter, 입방미터) 산출 공식</b><br>
            <code>CBM = 카톤 가로(m) &times; 세로(m) &times; 높이(m) &times; 총 박스 수</code><br>
            <span style="color:#64748B;">예: 50cm &times; 40cm &times; 30cm = 0.5 &times; 0.4 &times; 0.3 = 0.06 CBM/박스<br>20박스 &rarr; 총 CBM = 0.06 &times; 20 = 1.200 CBM</span>
          </div>
          <div>
            <b>B.2 실측 중량 vs 용적 중량</b><br>
            &bull; <b>실측 총중량(Gross Weight):</b> 제품, 완충재, 외박스 포함 저울 실측 중량 (kg)<br>
            &bull; <b>항공 용적 중량:</b> 가로(cm) &times; 세로(cm) &times; 높이(cm) &divide; 6,000 (kg)<br>
            &bull; <b>해상 운임 기준:</b> 1 CBM &asymp; 1,000 kg (R/T 기준)
          </div>
        </div>
      </div>
      
      <div class="card" style="border:1px solid #E2E8F0; margin-top:2px;">
        <div class="card-title" style="color:#0F172A; font-size:7.8pt;">APPENDIX C &bull; 용어 혼동 방지 원칙 (Disambiguation Principles)</div>
        <div style="font-size:7pt; display:flex; flex-direction:column; gap:3px;">
          <div><b>01. ARRIVED &ne; RECEIVED:</b> <code>ARRIVED</code>는 목적지 도크 도착 물리적 시점이며, <code>RECEIVED</code>는 창고 검수자가 박스를 개봉하고 바코드를 스캔하여 실물 검수한 완료 시점입니다.</div>
          <div><b>02. RECEIVED &ne; COMPLETED:</b> <code>RECEIVED</code>는 물품 검수 완료이며, <code>COMPLETED</code>는 정산 전표 및 행정 물류 절차가 최종 마감된 상태입니다.</div>
          <div><b>03. Shipping Complete &ne; Settlement Complete:</b> 물류의 선적/도착 완료와 재무의 대금 결제/정산은 독립적인 비즈니스 이벤트입니다.</div>
        </div>
      </div>
      
      <div class="card" style="border:1px solid #CBD5E1; background:#F8FAFC; margin-top:2px;">
        <div class="card-title" style="color:#0F172A; font-size:7.8pt;">APPENDIX D &bull; 고객지원 및 문의 채널 (Support &amp; Inquiry Channels)</div>
        <div class="grid-3" style="font-size:7pt;">
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px; border-radius:4px;">
            <b style="color:#0284C7;">Ask K SELECT (Knowledge Assistant)</b><br>
            Brand Portal의 <code>Ask K SELECT</code>에서 Published Knowledge를 기반으로 정책 및 물류 가이드를 검색하고 관련 안내를 확인할 수 있습니다.
          </div>
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px; border-radius:4px;">
            <b>1:1 운영 문의 (Support Center)</b><br>
            <code>https://portal.kselectnetwork.com/portal/support</code> 에서 물류/선적 문의 티켓 발행.
          </div>
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:6px; border-radius:4px;">
            <b>긴급 물류 핫라인</b><br>
            <code>logistics@letusto.com</code> &bull; 본사 물류운영본부.
          </div>
        </div>
      </div>
      
      <div style="font-size:6.5pt; color:#94A3B8; text-align:center; margin-top:2px;">
        MAN-B-LOG-001 &bull; VERSION 1.0.0 &bull; 2026-10-01 &bull; Letusto Inc. / K SELECT 물류운영본부 &bull; Confidential &amp; Proprietary &copy; 2026 Letusto Inc.
      </div>
    </div>
    
    <div class="page-footer">
      <span>K SELECT 선적 및 국제 물류 관리 가이드 &bull; v1.0.0</span>
      <span class="page-num">22 / 22</span>
    </div>
  </div>
  `;

  html += `</body></html>`;
  return html;
}

async function generatePdf() {
  console.log('Generating MAN-B-LOG-001 Shipping & International Logistics PDF (Target: 22 Pages)...');
  const html = await buildHtml();
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const outDir = path.join(__dirname, '..', 'Manuals', 'MAN-B-LOG-001_Shipping-Logistics', '03_PUBLISHED');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outPdf = path.join(outDir, 'MAN-B-LOG-001_Shipping-Logistics_V1.pdf');
  
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
