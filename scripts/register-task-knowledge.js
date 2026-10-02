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

async function publishTaskKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-TASK-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-TASK-001_Task-Communication/03_PUBLISHED/MAN-B-TASK-001_Task-Communication_V1.pdf');
  const destDir = path.join(process.cwd(), 'private_assets/manuals');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const assetPdfPath = path.join(destDir, 'MAN-B-TASK-001_Task-Communication_V1.pdf');

  if (!fs.existsSync(assetPdfPath)) {
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
    id: "kno-task-communication-v10",
    slug: "man-b-task-001-task-communication-guide",
    title: "MAN-B-TASK-001: Task & Communication Guide",
    title_ko: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
    title_en: "K SELECT Brand Portal Task & Communication Guide (MAN-B-TASK-001)",
    summary_ko: "K SELECT Brand Portal 1:1 문의(partner_inquiries) 접수, 9대 업무 카테고리 분류, 4단계 케이스 라이프사이클(RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), 만족도 평가(CSAT), 교차 도메인 연동(PO 변경 real FK vs 정산/계약 prefill), support ACL(none/read/write/manage), 인앱/이메일 알림 규칙 및 20MB 첨부파일 보안 통합 가이드",
    summary_en: "Operational guide for Brand Portal 1:1 support inquiries (partner_inquiries), 9 categories, 4 case statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), CSAT evaluation, cross-domain linking, support ACL permissions, notifications, and 20MB private storage security.",
    content_ko: `# K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 운영팀과의 1:1 문의(partner_inquiries) 접수 및 소통, 9대 업무 카테고리 분류, 4단계 상태 라이프사이클(RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), 만족도 평가(CSAT) 및 교차 도메인 연동을 관리하는 공식 실무 가이드입니다.

## 2. 핵심 경계 정의 (Critical Boundaries)
- **PERM ↔ TASK 경계**: PERM(company_task_assignments)의 6대 주 담당자는 소통 책임자 지정 및 알림 라우팅 용도이며, TASK(partner_inquiries)의 실시간 1:1 지원 케이스와 독립 구분됩니다.
- **어드민 내부 일감 경계**: /admin/tasks (public.tasks)는 운영팀 내부 작업 프로토타입이며 파트너 문의 케이스와 직접 연결되지 않습니다.
- **CLOSE ≠ CSAT**: 케이스 종결(CLOSED) 상태 전환과 CSAT 평가 제출은 별개 단계입니다.
- **교차 도메인 연동**: PO 변경 문의는 real DB FK(related_po_id)로 연결되며, 정산/계약 문의는 Pre-populated Context 방식으로 연동됩니다.`,
    content_en: `# K SELECT Brand Portal Task & Communication Guide (MAN-B-TASK-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners to submit and track 1:1 support cases (partner_inquiries), 9 categories, 4 case statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), CSAT evaluation, and cross-domain linking.

## 2. Critical Boundaries
- PERM vs TASK: company_task_assignments (6 primary owner routing) vs partner_inquiries (dynamic 1:1 cases).
- Internal Admin Prototype: public.tasks / /admin/tasks is an unlinked internal prototype.
- CLOSE != CSAT: Case close and CSAT evaluation are separate steps.
- Cross-Domain FK: PO Change has real DB FK (related_po_id), while Settlement/Agreement uses Context Prefill.`,
    type: "MANUAL",
    source_type: "CONTENT",
    module: "TASK",
    category: "Brand Portal",
    tags: ["MANUAL", "TASK", "SUPPORT", "INQUIRY", "COMMUNICATION", "PARTNER_INQUIRIES", "ACTION_REQUIRED", "CSAT", "ACL", "SUPPORT_DESK", "MAN-B-TASK-001", "OFFICIAL", "문의", "소통", "지원센터", "1대1문의", "케이스"],
    owner_id: "staff-support-01",
    owner_name: "Support Operations Desk",
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
  console.log('✓ Knowledge Item kno-task-communication-v10 registered in DB');

  // 3. Upsert Version Record
  const versionRecord = {
    id: 'ver-task-communication-v10',
    knowledge_id: 'kno-task-communication-v10',
    version_tag: 'v1.0',
    title_ko: 'K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 v1.0',
    title_en: 'K SELECT Brand Portal Task & Communication Guide v1.0',
    summary_ko: 'MAN-B-TASK-001 첫 공식 배포 버전입니다.',
    summary_en: 'Initial official publication of MAN-B-TASK-001.',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-TASK-001 Brand Portal Task & Communication Guide 최초 공식 배포 (4단계 라이프사이클 & support ACL)',
    why_changed: '브랜드 파트너사 1:1 문의 접수, 상태 라이프사이클, 만족도 평가 및 교차 도메인 연동 가이드 정립',
    effective_date: today,
    document_url: '/api/admin/knowledge/asset/asset-task-communication-v10',
    document_name: 'MAN-B-TASK-001_Task-Communication_V1.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'K SELECT Operations Team',
    reviewer_id: 'staff-superadmin-01',
    approver_id: 'staff-superadmin-01',
    published_at: now,
    created_at: now
  };

  await admin.from('knowledge_versions').upsert(versionRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Version ver-task-communication-v10 registered in DB');

  // 4. Upsert Asset Record
  const assetRecord = {
    id: 'asset-task-communication-v10',
    knowledge_id: 'kno-task-communication-v10',
    manual_title: 'K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)',
    version: 'v1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-task-communication-v10',
    file_name: 'MAN-B-TASK-001_Task-Communication_V1.pdf',
    file_size: pdfStats.size,
    published_date: today,
    created_at: now
  };

  await admin.from('knowledge_manual_assets').upsert(assetRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Asset asset-task-communication-v10 registered in DB');

  // 5. Upsert Relations
  const relations = [
    {
      id: 'rel-task-support-hub',
      knowledge_id: 'kno-task-communication-v10',
      related_portal: 'Brand Portal',
      related_module: 'TASK',
      related_menu: 'Support Center & 1:1 Inquiries',
      related_route: '/portal/support',
      manual_title: 'K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)',
      created_at: now
    },
    {
      id: 'rel-admin-task-inquiries',
      knowledge_id: 'kno-task-communication-v10',
      related_portal: 'Admin',
      related_module: 'TASK',
      related_menu: 'Admin Partner Inquiries Management',
      related_route: '/admin/partner-inquiries',
      manual_title: 'K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)',
      created_at: now
    }
  ];

  await admin.from('knowledge_relations').upsert(relations, { onConflict: 'id' });
  console.log('✓ Knowledge Relations registered in DB');

  console.log('\n====================================================');
  console.log('MAN-B-TASK-001 KNOWLEDGE CENTER PUBLISH COMPLETE');
  console.log('====================================================');
}

publishTaskKnowledge().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
