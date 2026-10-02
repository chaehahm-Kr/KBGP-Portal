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

async function publishRetKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-RET-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-RET-001_Retail-Applications/03_PUBLISHED/MAN-B-RET-001_Retail-Applications_V1.pdf');
  const assetPdfPath = path.join(process.cwd(), 'private_assets/manuals/MAN-B-RET-001_Retail-Applications_V1.pdf');

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

  const now = new Date().toISOString();
  const today = '2026-10-01';

  // 2. Knowledge Item Definition
  const knowledgeItem = {
    id: "kno-retail-applications-v10",
    slug: "retail-applications-and-placement-guide-v1",
    title: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001)",
    title_ko: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼",
    title_en: "K SELECT Brand Portal Retail Applications & Placement Guide",
    summary_ko: "북미 리테일 네트워크 입점을 위한 신규 신청서 작성(Draft Mode), 다중 브랜드 제품 선택, 6대 참여 준비사항 자가진단, 제품별 심사 타임라인 모니터링, 추가자료요청(Info Request) 대응 및 승인 후속 절차 표준 가이드",
    summary_en: "Operational guide for Brand Portal partners submitting retail placement applications, multi-brand product selection, readiness self-assessment, product-level review tracking, Info Request responses, and post-approval workflows.",
    content_ko: `# K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001 v1.0)

## 1. 개요 및 파트너십 프로세스 (Introduction & Partnership Process)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 브랜드 파트너사가 미국 및 글로벌 오프라인 리테일 네트워크(Curation Program)에 입점 신청서를 제출하고, MD 심사 타임라인 모니터링, 추가자료요청(Info Request) 대응, 승인 후속 절차를 체계적으로 진행할 수 있도록 안내하는 공식 실무 가이드입니다.

---

## 2. 주요 관리 영역 (Core Functional Modules)
1. **신청 현황 대시보드 (\`/portal/applications\`)**: 신청 번호, 제출일시, 종합 진행 상태(작성중, 제출됨, 검토중, 추가자료요청, 재검토중, 승인됨, 부분승인, 보류, 반려) 및 상태별 색상 뱃지 확인.
2. **신규 입점 신청서 작성 (Draft Mode · \`/portal/applications/new\`)**:
   - 다중 브랜드 제품 선택: 계정에 등록된 여러 브랜드의 상품을 단일 신청서에 자유롭게 포함.
   - 6대 프로그램 참여 준비 사항 (Readiness Criteria): 유통 마진, 안정적 공급, 단상자 영문 라벨, 바코드(UPC/EAN), 마케팅 협력, 인허가 서류 자가진단 (\`진행 가능\` / \`협의 필요\`).
   - 임시저장(Draft) 및 제출 전 유효성 검증(Validation).
3. **제품별 심사 타임라인 & 종합 상태 집계**:
   - 개별 제품 심사 상태: \`approved\`, \`rejected\`, \`on_hold\`, \`pending\` 및 MD 피드백 사유 실시간 확인.
   - 자동 상태 집계 엔진 (\`computeAggregatedStatus\`): 전체 승인 시 \`approved\`, 일부 승인 시 \`partial_approved\`, 전체 반려 시 \`rejected\` 등으로 자동 판정.
4. **추가 자료 요청 (Info Request) 및 문서 제출**:
   - 상세 페이지 상단 노란색 긴급 알림 패널 및 회신 기한 확인.
   - 회신 내용 작성 및 증빙 서류(PDF, 이미지, 엑셀) 업로드 후 즉시 \`re_review\` 자동 전환.
5. **평가 요약 및 결과 후속 절차**:
   - 상세 우측 사이드바 평가 요약 카드(자가진단 결과 및 준비사항 응답).
   - 승인 시 북미 리테일 입점 및 공식 발주(PO) 연계 절차 진행.

---

## 3. 관련 화면 및 기능 (Related Routes)
- \`/portal/applications\` (신청 현황 대시보드)
- \`/portal/applications/new\` (신규 입점 신청서 작성)
- \`/portal/applications/[id]\` (신청 상세, 심사 타임라인, Info Request 회신)
- \`/admin/applications\` (어드민 입점 심사 관리)
- \`/admin/applications/[id]\` (어드민 제품별 심사 및 Info Request 발송)`,
    content_en: `# K SELECT Brand Portal Retail Applications & Placement Guide (MAN-B-RET-001 v1.0)

## 1. Introduction & Overview
Official guide for K SELECT Brand Portal partners submitting retail placement applications, tracking MD review timelines, and managing Info Requests.

## 2. Core Functional Modules
1. **Applications Dashboard (\`/portal/applications\`)**: Track application status with color-coded badges.
2. **Draft Application Creation (\`/portal/applications/new\`)**: Multi-brand product selection, 6 readiness criteria self-assessments, draft saving, and validation.
3. **Product Review Timeline & Aggregated Status**: Real-time product feedback and automated overall status calculation (\`computeAggregatedStatus\`).
4. **Info Request & Document Submission**: Yellow alert panel for MD information requests with deadline and document upload.
5. **Evaluation Summary & Post-Review Workflows**: Sidebar summary and transition to official onboarding and purchase orders upon approval.

## 3. Related Routes
- \`/portal/applications\`
- \`/portal/applications/new\`
- \`/portal/applications/[id]\`
- \`/admin/applications\`
- \`/admin/applications/[id]\``,
    type: "MANUAL",
    source_type: "DOCUMENT",
    linked_system_setting_key: null,
    linked_system_setting_name: null,
    linked_system_setting_value: null,
    module: "RETAIL",
    category: "Brand Portal",
    tags: [
      "MANUAL",
      "RETAIL",
      "APPLICATION",
      "PLACEMENT",
      "READINESS",
      "INFO_REQUEST",
      "MD_REVIEW",
      "MAN-B-RET-001",
      "OFFICIAL",
      "입점",
      "입점신청",
      "리테일",
      "자가진단"
    ],
    owner_id: "usr-admin-system",
    owner_name: "K SELECT Operations Team",
    status: "PUBLISHED",
    system_impact_status: "NORMAL",
    system_impact_reason: null,
    system_impact_updated_at: now,
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: "APPROVED",
    external_reviewer_id: "staff-superadmin-01",
    external_reviewed_at: now,
    current_version: "v1.0",
    effective_date: today,
    document_url: "/api/admin/knowledge/asset/asset-retail-applications-v10",
    document_name: "MAN-B-RET-001_Retail-Applications_V1.pdf",
    document_size: assetBuf.length,
    document_type: "application/pdf",
    created_at: now,
    updated_at: now
  };

  // 3. Knowledge Version Definition
  const knowledgeVersion = {
    id: "ver-retail-applications-v10",
    knowledge_id: "kno-retail-applications-v10",
    version: "v1.0",
    status: "PUBLISHED",
    title_ko: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 v1.0",
    title_en: "K SELECT Brand Portal Retail Applications & Placement Guide v1.0",
    summary_ko: "MAN-B-RET-001 최초 공식 배포 버전 (v1.0)",
    summary_en: "Initial official publication of MAN-B-RET-001 v1.0.",
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: "MAN-B-RET-001 Retail Applications & Placement Guide 공식 배포 (v1.0)",
    why_changed: "북미 리테일 입점 신청서 작성, 자가진단, 제품별 심사 타임라인 및 Info Request 대응 표준화",
    effective_date: today,
    document_url: "/api/admin/knowledge/asset/asset-retail-applications-v10",
    document_name: "MAN-B-RET-001_Retail-Applications_V1.pdf",
    created_by_id: "usr-admin-system",
    created_by_name: "K SELECT Operations Team",
    reviewer_id: "staff-superadmin-01",
    approver_id: "staff-superadmin-01",
    published_at: now,
    created_at: now
  };

  // 4. Knowledge Relations Definition
  const knowledgeRelations = [
    {
      id: "rel-ret-app-dashboard",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Brand Portal",
      related_module: "RETAIL",
      related_menu: "Applications Dashboard",
      related_route: "/portal/applications",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-ret-app-new",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Brand Portal",
      related_module: "RETAIL",
      related_menu: "New Application Draft",
      related_route: "/portal/applications/new",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-ret-app-detail",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Brand Portal",
      related_module: "RETAIL",
      related_menu: "Application Detail & Info Request",
      related_route: "/portal/applications/[id]",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-admin-ret-apps",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Admin",
      related_module: "RETAIL",
      related_menu: "Admin Applications Management",
      related_route: "/admin/applications",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-admin-ret-app-detail",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Admin",
      related_module: "RETAIL",
      related_menu: "Admin Product Review & Timeline",
      related_route: "/admin/applications/[id]",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    }
  ];

  // 5. Execute DB Upserts
  console.log('--- Upserting Knowledge Item ---');
  const { error: itemErr } = await admin.from('knowledge_items').upsert(knowledgeItem, { onConflict: 'id' });
  if (itemErr) {
    console.error('Error upserting knowledge_item:', itemErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Item upserted:', knowledgeItem.id);

  console.log('--- Upserting Knowledge Version ---');
  const { error: verErr } = await admin.from('knowledge_versions').upsert(knowledgeVersion, { onConflict: 'id' });
  if (verErr) {
    console.error('Error upserting knowledge_version:', verErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Version upserted:', knowledgeVersion.id);

  console.log('--- Upserting Knowledge Relations ---');
  for (const rel of knowledgeRelations) {
    const { error: relErr } = await admin.from('knowledge_relations').upsert(rel, { onConflict: 'id' });
    if (relErr) {
      console.error(`Error upserting relation ${rel.id}:`, relErr);
    } else {
      console.log(`✓ Knowledge Relation upserted: ${rel.id} -> ${rel.related_route}`);
    }
  }

  console.log('\n=== Knowledge Publish in DB Completed Successfully ===\n');
}

publishRetKnowledge().catch(console.error);
