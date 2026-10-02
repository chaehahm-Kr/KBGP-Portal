const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

async function publishRptKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-RPT-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-RPT-001_Reports-Performance/03_PUBLISHED/MAN-B-RPT-001_Reports-Performance_V1.pdf');
  const assetPdfPath = path.join(process.cwd(), 'private_assets/manuals/MAN-B-RPT-001_Reports-Performance_V1.pdf');

  if (!fs.existsSync(sourcePdfPath)) {
    console.error('FAIL: Source PDF does not exist at', sourcePdfPath);
    process.exit(1);
  }
  if (!fs.existsSync(assetPdfPath)) {
    console.log('Copying source PDF to private_assets...');
    fs.copyFileSync(sourcePdfPath, assetPdfPath);
  }

  const srcBuf = fs.readFileSync(sourcePdfPath);
  const assetBuf = fs.readFileSync(assetPdfPath);
  const srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
  const assetHash = crypto.createHash('sha256').update(assetBuf).digest('hex');

  console.log(`Source PDF SHA: ${srcHash}`);
  console.log(`Asset  PDF SHA: ${assetHash}`);
  if (srcHash !== assetHash) {
    console.error('FAIL: Source PDF and Asset PDF SHA-256 do not match!');
    process.exit(1);
  }
  console.log('✓ Source PDF ↔ Asset PDF SHA-256 MATCH VERIFIED\n');

  const pdfStats = fs.statSync(assetPdfPath);
  const now = new Date().toISOString();
  const today = '2026-10-02';

  // 2. Knowledge Item Definition
  const knowledgeItem = {
    id: "kno-reports-performance-v10",
    slug: "man-b-rpt-001-reports-performance-guide",
    title: "MAN-B-RPT-001: Reports & Performance Guide",
    title_ko: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
    title_en: "K SELECT Brand Portal Reports & Performance Guide (MAN-B-RPT-001)",
    summary_ko: "K SELECT Brand Portal 메인 대시보드(/portal), 4대 도메인 핵심 KPI(발주 파이프라인, 재무/정산 실적, 카탈로그 완성도, 고객지원 문의), 3단계 우선순위 실행 필요 큐(Action Required Queue: URGENT, DUE_SOON, NORMAL), 5대 발주 성과 집계 요약, 최근 90일 다차원 필터링 및 테이블 정렬, 재무 및 정산 실적 모니터링, 28대 기준 제품 카탈로그 완성도 감사, 1:1 고객지원 처리 현황 및 어드민 전사 발주 대시보드(/admin/purchasing/dashboard) 동기화 통합 가이드",
    summary_en: "Operational user manual for K SELECT Brand Portal main dashboard (/portal), 4-domain core KPIs (Orders, Finance, Products, Support), 3-level Action Required Queue (URGENT, DUE_SOON, NORMAL), 5-stage PO reporting pipeline aggregation, 90-day multi-dimensional filtering and table sorting, finance cash flow tracking, 28-criteria product catalog completeness audit, 1:1 support resolution tracking, and Admin purchasing dashboard synchronization.",
    content_ko: `# K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001 v1.0)

## 1. 개요 및 측정 계층 원칙 (Overview & Measurement Principles)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 플랫폼을 통해 진행하는 비즈니스 활동—발주 이행, 대금 정산, 제품 카탈로그 등록, 고객지원 문의 처리—의 현황을 종합 집계하여 일일 운영 건전성(Operational Health)을 진단하고 긴급 조치 작업을 처리할 수 있도록 돕는 통합 측정 및 분석 계층(Measurement & Reporting Layer) 실무 가이드입니다.

## 2. 핵심 경계 정의 (Critical Boundaries)
- **RPT ↔ ORD 경계**: RPT의 5대 성과 집계(전체 진행, 생산 중, 출고 준비, 입고/검수, 완료)는 파트너사 관점의 리포팅 그룹이며, ORD가 담당하는 6단계 권위적 트랜잭션 라이프사이클 상태 전이와 명확히 구분됩니다.
- **RPT ↔ FIN 경계**: RPT의 재무 실적(총 청구액, 지급 완료액, 미지급 잔액, 연체 잔액)은 분석적 롤업 지표이며, FIN의 은행 송금, 장부 분개 및 정산 차액 공제(Adjustments) 실행과 독립적입니다.
- **RPT ↔ PROD 경계**: 28대 등록 완성도 판정 체계(COMPLETE vs Draft)는 실시간 품질 검증 엔진이며, 카탈로그 속성의 권위적 스키마 원천은 PROD 도메인입니다.
- **RPT ↔ RET & PERM 경계**: 리테일 매장 진열 데이터 및 멀티테넌트 세션 격리(session company_id)를 준수합니다.
- **시스템 기능 범위 (System Gap)**: 별도의 독립 메뉴(/portal/reports), 일괄 대량 보고서 생성, AI 성과 예측은 현재 미제공(Not Implemented) 상태이며, 어드민 리포트 센터(/admin/reports)는 준비 중인 플레이스홀더 화면입니다.`,
    content_en: `# K SELECT Brand Portal Reports & Performance Guide (MAN-B-RPT-001 v1.0)

## 1. Overview & Measurement Principles
Official operational manual for K SELECT Brand Portal partners covering main dashboard KPIs (/portal), 3-priority Action Required queue (URGENT, DUE_SOON, NORMAL), 5-stage PO pipeline aggregation, 90-day multi-dimensional filtering, cash flow tracking, 28-criteria product catalog completeness audit, 1:1 support resolution tracking, and Admin purchasing dashboard synchronization.

## 2. Critical Boundaries
- RPT vs ORD: 5-Stage reporting aggregation (Total Open, In Production, Ready to Ship, Receiving, Completed) is an analytical summary layer; ORD retains authoritative 6-step transactional state transitions.
- RPT vs FIN: Cash flow metrics (Total Invoiced, Total Paid, Balance Due, Overdue) are analytical views; FIN executes payment, transfers, and adjustments.
- RPT vs PROD: 28-criteria completeness engine evaluates quality; PROD is authoritative catalog attribute source.
- System Gap: /portal/reports, bulk reports, and AI forecasting are Not Implemented; /admin/reports is a placeholder.`,
    type: "MANUAL",
    source_type: "CONTENT",
    module: "REPORTS",
    category: "Brand Portal",
    tags: ["MANUAL", "REPORTS", "PERFORMANCE", "DASHBOARD", "ACTION_REQUIRED", "Action Required", "PO_PIPELINE", "PO Pipeline", "FINANCE", "CASH_FLOW", "Cash Flow", "PRODUCT_COMPLETENESS", "Product Completeness", "SUPPORT", "PURCHASING_DASHBOARD", "Purchasing Dashboard", "KPI", "MAN-B-RPT-001", "OFFICIAL", "성과분석", "대시보드", "실행필요", "지표", "리포트"],
    owner_id: "staff-ops-01",
    owner_name: "Operations Analytics Desk",
    status: "PUBLISHED",
    system_impact_status: "NORMAL",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: "APPROVED",
    external_reviewer_id: "staff-superadmin-01",
    external_reviewed_at: "2026-10-02T12:00:00Z",
    current_version: "v1.0",
    effective_date: today,
    document_url: "/api/admin/knowledge/asset/asset-reports-performance-v10",
    document_name: "MAN-B-RPT-001_Reports-Performance_V1.pdf",
    document_size: pdfStats.size,
    document_type: "application/pdf",
    created_at: now,
    updated_at: now
  };

  // Upsert Knowledge Item into DB
  const { error: itemErr } = await admin
    .from('knowledge_items')
    .upsert(knowledgeItem, { onConflict: 'id' });

  if (itemErr) {
    console.error('Error upserting knowledge item:', itemErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Item kno-reports-performance-v10 registered in DB');

  // 3. Upsert Version Record
  const versionRecord = {
    id: 'ver-reports-performance-v10',
    knowledge_id: 'kno-reports-performance-v10',
    version: 'v1.0',
    status: 'PUBLISHED',
    title_ko: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001 v1.0)',
    title_en: 'K SELECT Brand Portal Reports & Performance Guide v1.0',
    summary_ko: '최초 공식 발행 버전 (21-Page Published PDF 배포)',
    summary_en: 'Initial official published manual version',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-RPT-001 Reports & Performance Guide 최초 공식 배포 (v1.0)',
    why_changed: '브랜드 파트너사 메인 대시보드 지표, 실행 필요 큐, 발주 파이프라인 집계, 재무/정산 모니터링, 28대 기준 카탈로그 완성도 감사 및 어드민 연계 가이드 정립',
    effective_date: today,
    document_url: '/api/admin/knowledge/asset/asset-reports-performance-v10',
    document_name: 'MAN-B-RPT-001_Reports-Performance_V1.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'Operations Analytics Desk',
    reviewer_id: 'staff-superadmin-01',
    approver_id: 'staff-superadmin-01',
    published_at: now,
    created_at: now
  };

  await admin.from('knowledge_versions').upsert(versionRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Version ver-reports-performance-v10 registered in DB');

  // 4. Upsert Asset Record
  const assetRecord = {
    id: 'asset-reports-performance-v10',
    knowledge_id: 'kno-reports-performance-v10',
    manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
    version: 'v1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-reports-performance-v10',
    file_name: 'MAN-B-RPT-001_Reports-Performance_V1.pdf',
    file_size: pdfStats.size,
    published_date: today,
    created_at: now
  };

  await admin.from('knowledge_manual_assets').upsert(assetRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Asset asset-reports-performance-v10 registered in DB');

  // 5. Upsert Relations
  const relations = [
    {
      id: 'rel-rpt-dashboard',
      knowledge_id: 'kno-reports-performance-v10',
      related_portal: 'Brand Portal',
      related_module: 'REPORTS',
      related_menu: 'Dashboard & Action Queue',
      related_route: '/portal',
      manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
      created_at: now
    },
    {
      id: 'rel-rpt-po-pipeline',
      knowledge_id: 'kno-reports-performance-v10',
      related_portal: 'Brand Portal',
      related_module: 'REPORTS',
      related_menu: 'PO Pipeline Performance',
      related_route: '/portal/orders/purchase-orders',
      manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
      created_at: now
    },
    {
      id: 'rel-rpt-finance',
      knowledge_id: 'kno-reports-performance-v10',
      related_portal: 'Brand Portal',
      related_module: 'REPORTS',
      related_menu: 'Finance Cash Flow Tracking',
      related_route: '/portal/finance',
      manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
      created_at: now
    },
    {
      id: 'rel-rpt-products',
      knowledge_id: 'kno-reports-performance-v10',
      related_portal: 'Brand Portal',
      related_module: 'REPORTS',
      related_menu: 'Product Completeness Audit',
      related_route: '/portal/products',
      manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
      created_at: now
    },
    {
      id: 'rel-rpt-support',
      knowledge_id: 'kno-reports-performance-v10',
      related_portal: 'Brand Portal',
      related_module: 'REPORTS',
      related_menu: 'Support Resolution Tracking',
      related_route: '/portal/support',
      manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
      created_at: now
    },
    {
      id: 'rel-admin-rpt-purchasing',
      knowledge_id: 'kno-reports-performance-v10',
      related_portal: 'Admin',
      related_module: 'REPORTS',
      related_menu: 'Admin Purchasing Dashboard',
      related_route: '/admin/purchasing/dashboard',
      manual_title: 'K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)',
      created_at: now
    }
  ];

  await admin.from('knowledge_relations').upsert(relations, { onConflict: 'id' });
  console.log('✓ Knowledge Relations registered in DB (6 relations)');

  console.log('\n====================================================');
  console.log('MAN-B-RPT-001 KNOWLEDGE CENTER PUBLISH COMPLETE');
  console.log('====================================================');
}

publishRptKnowledge().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
