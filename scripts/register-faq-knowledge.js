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

async function publishFaqKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-FAQ-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================\n');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-FAQ-001_Knowledge-FAQ/03_PUBLISHED/MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf');
  const assetPdfPath = path.join(process.cwd(), 'private_assets/manuals/MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf');

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
    id: "kno-knowledge-center-faq-v10",
    slug: "man-b-faq-001-knowledge-faq-guide",
    title: "MAN-B-FAQ-001: Knowledge Center & FAQ Guide",
    title_ko: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
    title_en: "K SELECT Knowledge Center & FAQ Guide (MAN-B-FAQ-001)",
    summary_ko: "K SELECT 도움말 센터(/portal/help), 자연어 지식 검색 어시스턴트(Ask K SELECT - /portal/help/ask), 12개 발행 도메인과 120개 공식 FAQ 소유 구조, 10대 활성 표준 토픽 그리드, 정본 매뉴얼 상세 뷰어(/portal/help/[slug]), 1:1 지원 센터 연계 인입(Support Handoff - kselect_support_handoff), 검색 엔진 다계층 매칭/랭킹 스코어링 파이프라인, 모바일 반응형 도움말 센터, 그리고 어드민 지식 운영 콘솔(/admin/knowledge/topics-faq, /admin/knowledge/library)을 포괄하는 지식 센터 정본 가이드입니다.",
    summary_en: "Authoritative operational guide for the K SELECT Help Center (/portal/help), Grounded Natural Language Knowledge Assistant (Ask K SELECT - /portal/help/ask), 12-domain 120-FAQ governance architecture, 10 active topic cards, canonical manual viewer (/portal/help/[slug]), 1:1 support escalation handoff (kselect_support_handoff), multi-tier search scoring/ranking engine, mobile responsive UI, and admin knowledge management consoles (/admin/knowledge/topics-faq, /admin/knowledge/library).",
    content_ko: `# K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001 v1.0)

## 1. 시스템 개요 및 지식 센터 원칙 (Overview & Principles)
K SELECT 도움말 센터(\`/portal/help\`)는 브랜드 파트너사가 플랫폼을 이용하면서 발생하는 다양한 업무 규정, 운영 정책, 시스템 기능 및 절차에 대한 공식 안내를 제공하는 통합 지식 허브입니다.

파트너사는 1:1 지원 센터에 문의하기 전에 지식 센터의 토픽별 FAQ 탐색 및 지식 검색(Ask K SELECT)을 통해 게시된 공식 지식 문서(Published Knowledge) 및 FAQ를 기반으로 관련 답변과 안내 지침을 확인할 수 있습니다.

### 거버넌스 3대 원칙
1. **정본 매뉴얼 연계 (Canonical Manual Grounding)**: 등록된 모든 FAQ는 Published Knowledge Manual 및 검증된 운영 기준을 근거로 관리됩니다.
2. **도메인 경계 분리 (Strict Domain Boundaries)**: 각 FAQ는 배정된 단 하나의 업무 도메인과 표준 토픽에 귀속되며, 인접 도메인의 비즈니스 규칙을 임의로 확장하거나 침범하지 않습니다.
3. **지속적 정합성 유지 (Living Documentation)**: 상위 정책 매뉴얼이 개정되면 연계된 FAQ 역시 운영팀의 재심사를 거쳐 최신 규정으로 동기화됩니다.

---

## 2. 도움말 센터 FAQ 운영 현황 (Production Baseline)
- **승인된 공식 FAQ**: 12개 발행 도메인 총 **120건**
- **발행된 도메인 매뉴얼**: **12개 전 도메인 PUBLISHED** (Pending Domain: **0건**)
- **주요 Featured FAQ**: 12개 도메인에 걸쳐 총 **50건** 지정
- **활성 표준 토픽**: 총 **10개 토픽** 운영

### 12개 도메인 소유 구조
| Group | Code | Domain | Canonical Manual ID | FAQs | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| 01 | BRAND | 브랜드 관리 | MAN-B-BRAND-001 | 5 | PUBLISHED |
| 02 | ONB | 온보딩 · 시작하기 | MAN-B-ONB-001 | 9 | PUBLISHED |
| 03 | PROD | 상품 등록 · 관리 | MAN-B-PROD-001 | 14 | PUBLISHED |
| 04 | ORD | 발주 요청 · 오더 | MAN-B-ORD-001 | 12 | PUBLISHED |
| 05 | REG | 인허가 · 규정 | MAN-B-REG-001 | 12 | PUBLISHED |
| 06 | RET | 입점 · 리테일 네트워크 | MAN-B-RET-001 | 11 | PUBLISHED |
| 07 | LOG | 재고 · 물류 | MAN-B-LOG-001 | 10 | PUBLISHED |
| 08 | FIN | 정산 · 재무 | MAN-B-FIN-001 | 10 | PUBLISHED |
| 09 | PERM | 권한 관리 | MAN-B-PERM-001 | 7 | PUBLISHED |
| 10 | TASK | 할 일 · 소통 | MAN-B-TASK-001 | 10 | PUBLISHED |
| 11 | RPT | 리포트 | MAN-B-RPT-001 | 10 | PUBLISHED |
| 12 | INT | 인텔리전스 | MAN-B-INT-001 | 10 | PUBLISHED |
| **TOTAL** | **12 Domains** | **10 Active Topics** | **12 Published Manuals** | **120** | **12 / 12 PUBLISHED** |

### Featured FAQ 정책
Featured FAQ는 \`knowledge_faqs.is_featured\` (Boolean) 값으로 표시되는 Editorial Policy 및 Current Data Pattern입니다. DB check constraint나 애플리케이션 clamp 로직에 의한 강제 제약이 아니며, 현재 12개 발행 매뉴얼에 걸쳐 총 50건이 지정되어 있습니다.

### 핵심 교차 도메인 경계 공식 (Cross-Domain Boundary Formulas)
1. \`Retail Application Approval ≠ Automatic Purchase Order Creation\`
2. \`ARRIVED ≠ RECEIVED ≠ COMPLETED ≠ PAID\`
3. \`Shipping Complete ≠ Settlement Complete\`
4. \`협의 필요 ≠ Rejection\`
5. \`PERM Operational Task Assignment ≠ TASK Support Case\`
6. \`AI INCI Translation ≠ Regulatory Certificate Upload\`
7. \`Barcode Validation ≠ Regulatory Approval\`

---

## 3. 도움말 센터 주요 기능 및 라우트 (Features & Routes)
1. **메인 허브 (\`/portal/help\`)**: 히어로 검색창, 빠른 추천 질문 칩, 10대 활성 표준 토픽 그리드, 1:1 문의 CTA.
2. **토픽별 FAQ 탐색**: 카드를 클릭하여 아코디언 형태로 전체 FAQ 목록 확인, \`FEATURED\` 배지 및 정본 매뉴얼 링크 연계.
3. **자연어 질의응답 (Ask K SELECT - \`/portal/help/ask\`)**: 직접 답변 카드(Direct Answer Card), 공식 출처 인용(Source Citations), 유용성 피드백.
4. **정본 매뉴얼 상세 뷰어 (\`/portal/help/[slug]\`)**: 장·절 구조 본문 및 연계 FAQ 목록 통합 제공.
5. **1:1 문의 연계 인입 (Support Handoff - \`/portal/support\`)**: \`kselect_support_handoff\` SessionStorage 기반으로 질문 컨텍스트를 문의 폼에 자동 사전 주입.
6. **어드민 지식 운영 콘솔**:
   - \`/admin/knowledge/topics-faq\`: FAQ 승인, 수정, Featured 지정 및 토픽 관리.
   - \`/admin/knowledge/library\`: 공식 매뉴얼 라이브러리 라이프사이클 및 버전 통제.`,
    content_en: `# K SELECT Knowledge Center & FAQ Guide (MAN-B-FAQ-001 v1.0)

## 1. System Overview & Knowledge Principles
K SELECT Help Center (/portal/help) serves as the official knowledge hub for brand partners, providing verified guidance on platform policies, operational rules, and workflows.

### 3 Governance Principles
1. **Canonical Manual Grounding**: All FAQs originate from and link to Published Knowledge Manuals.
2. **Strict Domain Boundaries**: Each FAQ strictly belongs to a single domain and standard topic.
3. **Living Documentation**: Revisions to authoritative manuals trigger re-review and synchronization of related FAQs.

## 2. Production Baseline
- **Approved FAQs**: 120 across 12 published domains.
- **Published Manuals**: 12 / 12 PUBLISHED (0 pending domains).
- **Featured FAQs**: 50 designated across 12 domains.
- **Active Topics**: 10 standard topic cards.

## 3. Core Features & Routes
- Main Help Center: \`/portal/help\`
- Grounded Ask K SELECT: \`/portal/help/ask\`
- Manual Viewer: \`/portal/help/[slug]\`
- Support Handoff: \`/portal/support\` via \`kselect_support_handoff\`
- Admin FAQ Management: \`/admin/knowledge/topics-faq\`
- Admin Knowledge Library: \`/admin/knowledge/library\``,
    type: "MANUAL",
    source_type: "CONTENT",
    module: "KNOWLEDGE",
    category: "Brand Portal",
    tags: [
      "MANUAL", "KNOWLEDGE", "FAQ", "HELP_CENTER", "ASK_K_SELECT", "Ask K SELECT",
      "SUPPORT_HANDOFF", "Support Handoff", "TOPIC_GRID", "Topic Grid", "SEARCH_ENGINE",
      "Search Engine", "MAN-B-FAQ-001", "OFFICIAL", "도움말센터", "도움말 센터", "지식센터",
      "지식 검색", "자연어검색", "1:1문의", "어드민지식관리"
    ],
    owner_id: "staff-editorial-01",
    owner_name: "Knowledge Operations Desk",
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
    document_url: "/api/admin/knowledge/asset/asset-knowledge-center-faq-v10",
    document_name: "MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf",
    document_size: pdfStats.size,
    document_type: "application/pdf",
    created_at: now,
    updated_at: now
  };

  // 3. Upsert Knowledge Item into Supabase
  const { data: itemData, error: itemError } = await admin
    .from('knowledge_items')
    .upsert(knowledgeItem, { onConflict: 'id' })
    .select();

  if (itemError) {
    console.error('FAIL: Upsert knowledge_items error:', itemError);
    process.exit(1);
  }
  console.log('✓ Upserted knowledge_items:', knowledgeItem.id, '->', itemData[0].title);

  // 4. Upsert Knowledge Version
  const knowledgeVersion = {
    id: "ver-knowledge-center-faq-v10",
    knowledge_id: "kno-knowledge-center-faq-v10",
    version: "v1.0",
    status: "PUBLISHED",
    title_ko: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001 v1.0)",
    title_en: "K SELECT Knowledge Center & FAQ Guide v1.0",
    summary_ko: "최초 공식 발행 버전 (16-Page Published PDF 배포)",
    summary_en: "Initial official published manual version",
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: "MAN-B-FAQ-001 Knowledge Center & FAQ Guide 최초 공식 배포 (v1.0)",
    why_changed: "도움말 센터 운영 체계, 12개 도메인 120개 공식 FAQ 소유 구조, Ask K SELECT 자연어 검색 엔진, 1:1 지원 연계 Handoff 및 어드민 지식 관리 운영 기준 정립",
    effective_date: today,
    created_by_name: "Knowledge Operations Desk",
    published_at: now,
    created_at: now
  };

  const { data: verData, error: verError } = await admin
    .from('knowledge_versions')
    .upsert(knowledgeVersion, { onConflict: 'id' })
    .select();

  if (verError) {
    console.error('FAIL: Upsert knowledge_versions error:', verError);
    process.exit(1);
  }
  console.log('✓ Upserted knowledge_versions:', knowledgeVersion.id);

  // 5. Upsert Knowledge Manual Asset
  const manualAsset = {
    id: "asset-knowledge-center-faq-v10",
    knowledge_id: "kno-knowledge-center-faq-v10",
    manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
    version: "v1.0",
    language: "KO",
    is_current: true,
    file_url: "/api/admin/knowledge/asset/asset-knowledge-center-faq-v10",
    file_name: "MAN-B-FAQ-001_Knowledge-FAQ_V1.pdf",
    file_size: pdfStats.size,
    published_date: today,
    created_at: now
  };

  const { data: assetData, error: assetError } = await admin
    .from('knowledge_manual_assets')
    .upsert(manualAsset, { onConflict: 'id' })
    .select();

  if (assetError) {
    console.error('FAIL: Upsert knowledge_manual_assets error:', assetError);
    process.exit(1);
  }
  console.log('✓ Upserted knowledge_manual_assets:', manualAsset.id);

  // 6. Upsert Knowledge Relations
  const relations = [
    {
      id: "rel-faq-help-main",
      knowledge_id: "kno-knowledge-center-faq-v10",
      related_portal: "Brand Portal",
      related_module: "KNOWLEDGE",
      related_menu: "Help Center Main",
      related_route: "/portal/help",
      manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
      created_at: now
    },
    {
      id: "rel-faq-help-ask",
      knowledge_id: "kno-knowledge-center-faq-v10",
      related_portal: "Brand Portal",
      related_module: "KNOWLEDGE",
      related_menu: "Grounded Knowledge Assistant (Ask K SELECT)",
      related_route: "/portal/help/ask",
      manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
      created_at: now
    },
    {
      id: "rel-faq-help-slug",
      knowledge_id: "kno-knowledge-center-faq-v10",
      related_portal: "Brand Portal",
      related_module: "KNOWLEDGE",
      related_menu: "Canonical Manual Viewer",
      related_route: "/portal/help/[slug]",
      manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
      created_at: now
    },
    {
      id: "rel-faq-support",
      knowledge_id: "kno-knowledge-center-faq-v10",
      related_portal: "Brand Portal",
      related_module: "SUPPORT",
      related_menu: "1:1 Support Ticket Escalation Handoff",
      related_route: "/portal/support",
      manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
      created_at: now
    },
    {
      id: "rel-admin-faq-topics",
      knowledge_id: "kno-knowledge-center-faq-v10",
      related_portal: "Admin",
      related_module: "KNOWLEDGE",
      related_menu: "Topics & FAQ Management Console",
      related_route: "/admin/knowledge/topics-faq",
      manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
      created_at: now
    },
    {
      id: "rel-admin-faq-library",
      knowledge_id: "kno-knowledge-center-faq-v10",
      related_portal: "Admin",
      related_module: "KNOWLEDGE",
      related_menu: "Knowledge Library & Publication Console",
      related_route: "/admin/knowledge/library",
      manual_title: "K SELECT 도움말 센터 FAQ 및 지식 검색 가이드 (MAN-B-FAQ-001)",
      created_at: now
    }
  ];

  for (const rel of relations) {
    const { error: relError } = await admin
      .from('knowledge_relations')
      .upsert(rel, { onConflict: 'id' });
    if (relError) {
      console.error('FAIL: Upsert knowledge_relations error for', rel.id, relError);
      process.exit(1);
    }
  }
  console.log(`✓ Upserted ${relations.length} knowledge_relations`);

  console.log('\n====================================================');
  console.log('MAN-B-FAQ-001 PUBLICATION COMPLETED SUCCESSFULLY IN DB');
  console.log('====================================================');
}

publishFaqKnowledge().catch(console.error);
