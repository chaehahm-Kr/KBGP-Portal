const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

const rptFaqs = [
  {
    id: "faq-rpt-01",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: true,
    display_order: 1,
    generated_by: "MANUAL",
    question_ko: "K SELECT Reports & Performance 모듈의 역할은 무엇이며, 일반 운영 메뉴와 어떻게 다른가요?",
    question_en: "What is the role of the Reports & Performance module, and how does it differ from operational menus?",
    answer_ko: "Reports & Performance는 발주, 정산, 상품, 고객지원 등 브랜드사의 플랫폼 운영 데이터를 페이지 조회 시점에 집계하여 일일 운영 건전성을 진단하는 통합 측정 및 분석 계층(Measurement & Reporting Layer)입니다. 발주 승인이나 인보이스 결제 등의 실제 상태 전이 및 트랜잭션 처리는 각 전용 운영 메뉴(발주 관리, 정산 관리 등)에서 수행되며, Reports 모듈은 데이터를 임의로 변경하지 않습니다. (MAN-B-RPT-001 Chapter 01)",
    answer_en: "The Reports & Performance module serves as a Measurement & Reporting Layer aggregating operational data (orders, settlement, catalog, support) upon page view for daily operational health diagnostics. Authoritative state transitions (approving POs, settling invoices) occur within dedicated operational menus, and the Reports module does not mutate operational records. (MAN-B-RPT-001 Chapter 01)"
  },
  {
    id: "faq-rpt-02",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: true,
    display_order: 2,
    generated_by: "MANUAL",
    question_ko: "브랜드 포털 메인 대시보드(/portal)에서는 어떤 핵심 지표를 확인할 수 있나요?",
    question_en: "What core operational KPIs can be monitored on the main dashboard (/portal)?",
    answer_ko: "메인 대시보드 상단에는 4대 핵심 축의 요약 카드가 제공됩니다: 1) 발주 파이프라인(진행 중 발주서, 출고 준비, 입고 검수), 2) 재무 및 정산 실적(총 청구액, 지급 완료액, 미지급 잔액, 기한 초과 잔액), 3) 카탈로그 완성도(28대 기준 Complete vs 보완 필요 Draft), 4) 고객지원(미종결 문의, 파트너 회신 대기 건수). 파트너사는 로그인 즉시 브랜드 전반의 운영 건전성을 진단할 수 있습니다. (MAN-B-RPT-001 Chapter 02)",
    answer_en: "The main dashboard displays four domain summary cards: 1) Order Pipeline (Active POs, Ready to Ship, Receiving), 2) Finance & Settlement (Total Invoiced, Total Paid, Balance Due, Overdue Balance), 3) Catalog Completeness (Complete vs Draft SKUs based on 28 criteria), and 4) Support (Open Cases, Action Required Tickets). Partners can evaluate overall operational health immediately upon login. (MAN-B-RPT-001 Chapter 02)"
  },
  {
    id: "faq-rpt-03",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: true,
    display_order: 3,
    generated_by: "MANUAL",
    question_ko: "대시보드의 실행 필요(Action Required) 큐는 어떤 기준으로 우선순위가 나뉘며, 어떻게 해제되나요?",
    question_en: "How are items in the Action Required Queue prioritized, and how are they cleared?",
    answer_ko: "Action Required 큐는 업무 병목을 방지하기 위해 3단계 우선순위로 분류됩니다: 1) URGENT (빨간색): 발주서 수락 대기, 지급 기한 초과 인보이스, 운영팀 추가 회신 요청 문의. 2) DUE_SOON (주황색): 생산 완료 후 출고 서류 등록 대기, 미결제 인보이스 잔액. 3) NORMAL: 필수 스펙 누락 Draft 제품. 각 항목의 바로가기 버튼을 통해 해당 작업을 완료하면 페이지 재조회 시 큐에서 제거됩니다. (MAN-B-RPT-001 Chapter 02 & Appendix A)",
    answer_en: "The Action Required Queue categorizes operational bottlenecks into three priorities: 1) URGENT (Red): Unconfirmed POs, overdue invoices, inquiries awaiting brand reply. 2) DUE_SOON (Amber): Ready to ship packing list required, unpaid invoice balances. 3) NORMAL: Draft products with incomplete specs. Clicking the action button and completing the task clears the item upon page revalidation. (MAN-B-RPT-001 Chapter 02 & Appendix A)"
  },
  {
    id: "faq-rpt-04",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: false,
    display_order: 4,
    generated_by: "MANUAL",
    question_ko: "발주 관리(/portal/orders/purchase-orders)의 기간 필터와 상태 칩은 어떻게 작동하나요?",
    question_en: "How do date range filters and status chips operate in PO Pipeline management (/portal/orders/purchase-orders)?",
    answer_ko: "발주 목록 상단에는 기본 최근 90일(Last 90 Days) 또는 사용자 지정 기간 필터가 적용되어 해당 기간의 발주 데이터를 집계합니다. 생산 중, 출고 준비, 선적 운송, 입고 검수, 완료, 취소 등 공정 단계별 상태 칩을 클릭하여 특정 상태의 발주서만 필터링할 수 있으며, 최신순/과거순/금액순 정렬 및 PO 번호·SKU 검색을 지원합니다. (MAN-B-RPT-001 Chapter 03)",
    answer_en: "The PO pipeline view defaults to the Last 90 Days (with custom date picker support) to aggregate orders. Clicking process status chips (In Production, Ready to Ship, Shipped, Receiving, Completed, Cancelled) filters the order list, supported by sorting (newest, oldest, amount high/low) and PO number or SKU search. (MAN-B-RPT-001 Chapter 03)"
  },
  {
    id: "faq-rpt-05",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: true,
    display_order: 5,
    generated_by: "MANUAL",
    question_ko: "발주 관리 상단의 5대 집계 요약 카드와 정식 발주 라이프사이클은 어떤 관계인가요?",
    question_en: "What is the relationship between the 5-Stage PO summary cards and the authoritative PO lifecycle?",
    answer_ko: "상단 5대 요약 카드(전체 진행, 생산 중, 출고 준비, 입고/검수, 완료)는 ORD 도메인의 6단계 상태 전이(Draft → Sent to Supplier → Confirmed → Ready to Ship → Shipped/Receiving → Completed)를 파트너사 공정 관점에서 집계한 리포팅 그룹입니다. ORD가 트랜잭션 상태 머신을 권위적으로 관리하며, RPT는 해당 상태의 발주 건수와 납기 잔량을 분석용으로 산출합니다. (MAN-B-RPT-001 Chapter 03 & Appendix A)",
    answer_en: "The 5 summary cards (Total Open, In Production, Ready to Ship, Receiving, Completed) are analytical reporting groups mapping ORD's authoritative 6-step lifecycle (Draft -> Sent to Supplier -> Confirmed -> Ready to Ship -> Shipped/Receiving -> Completed) into partner-facing progress stages. ORD governs transactional state transitions, while RPT calculates metric counts and timelines. (MAN-B-RPT-001 Chapter 03 & Appendix A)"
  },
  {
    id: "faq-rpt-06",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: false,
    display_order: 6,
    generated_by: "MANUAL",
    question_ko: "정산 및 재무(/portal/finance) 메뉴의 실적 지표는 어떻게 산출되며, 인보이스 상세와 어떻게 대조하나요?",
    question_en: "How are settlement and Cash Flow metrics calculated in (/portal/finance), and how are they reconciled with invoice details?",
    answer_ko: "재무 요약 카드는 총 청구액(발행 인보이스 합계), 지급 완료액(실제 입금 정산액), 미지급 잔액(잔여 대기액), 기한 초과(계약 지급일 경과 건수)를 집계합니다. 각 인보이스 상세 페이지로 이동하면 발주서(PO) 번호 매칭 여부, 품목별 단가/수량 및 물류 파손·차액 공제(Adjustments) 내역을 투명하게 대조할 수 있습니다. (MAN-B-RPT-001 Chapter 04)",
    answer_en: "Financial summary cards aggregate Cash Flow metrics: Total Invoiced (issued invoices sum), Total Paid (settled amounts), Balance Due (pending payments), and Overdue count (past due date). Individual invoice detail pages allow transparent reconciliation against PO matching numbers, line quantities/costs, and deduction adjustment records. (MAN-B-RPT-001 Chapter 04)"
  },
  {
    id: "faq-rpt-07",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: false,
    display_order: 7,
    generated_by: "MANUAL",
    question_ko: "상품 관리(/portal/products)의 카탈로그 완성도(COMPLETE vs Draft)는 어떤 기준으로 판정되나요?",
    question_en: "How is Product Completeness (COMPLETE vs Draft) evaluated in Product Management (/portal/products)?",
    answer_ko: "K SELECT 평가 엔진은 28대 필수 기준—기본 정보(6), 가격 정보(2: KRW 소비자가, USD FOB 공급가), 단품 규격(4), 개별 포장 규격(4), 카톤 박스 규격(5), 표준 바코드 유효성(1: UPC/EAN), 고해상도 대표 이미지(1)—을 종합 검증합니다. 28개 전 항목이 충족되면 COMPLETE 상태로 승격되며, 1개라도 누락되면 Draft 상태로 유지되어 상단 배너에 보완 안내가 표시됩니다. (MAN-B-RPT-001 Chapter 05)",
    answer_en: "The Product Completeness evaluation engine audits 28 criteria: Basic Info (6), Pricing (2: KRW retail, USD FOB), Unit Specs (4), Package Specs (4), Carton Specs (5), Standard Barcode (1: UPC/EAN), and Image (1). Meeting all 28 criteria promotes the SKU to COMPLETE status, while any missing spec keeps it in Draft status with alert banners. (MAN-B-RPT-001 Chapter 05)"
  },
  {
    id: "faq-rpt-08",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: false,
    display_order: 8,
    generated_by: "MANUAL",
    question_ko: "도움말 및 지원(/portal/support) 메뉴의 1:1 문의 처리 현황은 어떻게 모니터링하나요?",
    question_en: "How is 1:1 support inquiry resolution tracked in the Help & Support menu (/portal/support)?",
    answer_ko: "파트너사는 상태 필터 탭(전체, 답변 대기, 처리 중, 완료)을 통해 접수된 문의의 처리 진행 속도와 운영팀 검토 상태를 확인합니다. 운영팀에서 추가 확인이나 서류를 요청한 경우 파트너 회신 대기(Action Required) 뱃지가 표시되며, 대시보드의 URGENT 큐에 연동되어 지연 없이 회신할 수 있습니다. (MAN-B-RPT-001 Chapter 06)",
    answer_en: "Partners monitor inquiry progress and review states via filter tabs (All, Awaiting Reply, In Progress, Closed). When operations staff requests additional documentation or clarification, an Action Required badge appears and synchronizes to the dashboard URGENT queue for prompt resolution. (MAN-B-RPT-001 Chapter 06)"
  },
  {
    id: "faq-rpt-09",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: false,
    display_order: 9,
    generated_by: "MANUAL",
    question_ko: "브랜드 포털의 발주 데이터는 어드민 백오피스와 어떻게 동기화되며, 타사 데이터 노출 위험은 없나요?",
    question_en: "How does portal order data synchronize with the Admin backoffice, and how is multi-tenant isolation preserved?",
    answer_ko: "브랜드 포털에서 등록된 발주 수락, 출고 서류 및 인보이스 내역은 데이터베이스를 통해 어드민 발주 현황 콘솔(/admin/purchasing/dashboard)과 동기화되어 공급사별 실적(Supplier Summary) 및 SKU별 미입고 잔량으로 전사 집계됩니다. 동시에 엄격한 멀티테넌트 Row-Level Security(RLS)가 적용되어 브랜드 파트너사는 자사(session company_id) 데이터만 독립적으로 조회할 수 있습니다. (MAN-B-RPT-001 Chapter 06 & Appendix B)",
    answer_en: "Order confirmations, shipment documents, and invoices registered in the Brand Portal synchronize via the database to the Admin Purchasing Dashboard (/admin/purchasing/dashboard) for cross-supplier summaries and unreceived SKU backlog tracking. Multi-tenant Row-Level Security (RLS) guarantees that brand users only access their own company (session company_id) records. (MAN-B-RPT-001 Chapter 06 & Appendix B)"
  },
  {
    id: "faq-rpt-10",
    kind: "FAQ",
    topic_id: "topic-start",
    source_knowledge_id: "kno-reports-performance-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    portal_scope: "BRAND",
    audience: ["BRAND"],
    status: "APPROVED",
    is_featured: false,
    display_order: 10,
    generated_by: "MANUAL",
    question_ko: "포털 내 독립된 보고서 메뉴(/portal/reports)나 대량 엑셀/PDF 다운로드 센터가 제공되나요?",
    question_en: "Is there a standalone reports module (/portal/reports) or bulk automated export center in the portal?",
    answer_ko: "현재 K SELECT 포털은 메인 대시보드 및 각 전용 도메인 허브(발주, 정산, 상품, 지원)에서 운영 지표 분석을 제공하며, 별도의 독립 메뉴(/portal/reports)는 제공되지 않습니다. 개별 발주서 PDF 및 인보이스 명세서는 각 상세 페이지에서 다운로드할 수 있으며, 일괄 대량 보고서 생성 기능 및 AI 성과 예측 기능은 지원되지 않습니다. 어드민 리포트 센터(/admin/reports)는 현재 준비 중인 플레이스홀더 화면입니다. (MAN-B-RPT-001 Chapter 06 & Reference)",
    answer_en: "K SELECT provides operational metrics within the main dashboard and dedicated functional hubs; a separate independent module (/portal/reports) is not provided. Individual PO PDFs and invoice statements are downloadable from their respective detail pages, while bulk automated report generation and AI performance forecasting are unsupported. The Admin Reports Center (/admin/reports) is currently a placeholder screen. (MAN-B-RPT-001 Chapter 06 & Reference)"
  }
];

async function publishRptFaqs() {
  console.log('====================================================');
  console.log('MAN-B-RPT-001 KNOWLEDGE CENTER FAQS PUBLISH');
  console.log('====================================================');

  const now = new Date().toISOString();
  for (const faq of rptFaqs) {
    const record = {
      ...faq,
      created_at: now,
      updated_at: now
    };

    const { error } = await admin
      .from('knowledge_faqs')
      .upsert(record, { onConflict: 'id' });

    if (error) {
      console.error(`Error inserting ${faq.id}:`, error);
      process.exit(1);
    }
    console.log(`✓ ${faq.id} (${faq.is_featured ? '★ Featured' : 'Normal'}) registered in DB`);
  }

  console.log('\n====================================================');
  console.log('MAN-B-RPT-001 FAQS PUBLISH COMPLETE (10 FAQS)');
  console.log('====================================================');
}

publishRptFaqs().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
