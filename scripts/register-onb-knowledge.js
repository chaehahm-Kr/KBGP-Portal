const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function main() {
  const now = new Date().toISOString();
  const pdfStats = fs.statSync(path.join(__dirname, '..', 'Manuals', 'MAN-B-ONB-001_Onboarding', '03_PUBLISHED', 'MAN-B-ONB-001_Onboarding_Guide_v1.0.pdf'));

  const knowledgeItem = {
    id: 'kno-onboarding-guide-v10',
    slug: 'man-b-onb-001-onboarding-guide',
    title: 'MAN-B-ONB-001: Brand Portal Onboarding Guide',
    title_ko: 'K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)',
    title_en: 'K SELECT Brand Portal Onboarding Guide (MAN-B-ONB-001)',
    summary_ko: 'K SELECT Brand Portal 가입 후 7단계 온보딩(회사정보, 관리자프로필, 브랜드, 팀원초대, 6대담당업무, 상품등록, 기본공급계약 전자서명)을 완수하기 위한 공식 가이드입니다.',
    summary_en: 'Official 7-step onboarding guide for K SELECT Brand Portal partners covering company info, admin profile, brand verification, task owners, product listing, and master agreement signing.',
    content_ko: `# K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001 v1.0)

## 1. 개요 및 매뉴얼 목적
본 매뉴얼은 K SELECT NETWORK Brand Portal에 입점한 브랜드 파트너사가 최초 가입 후 포털 내 필수 기업·브랜드·상품 정보를 구성하고 기본 계약을 체결하기까지 필요한 7단계 온보딩(Onboarding) 절차를 안내하는 공식 사용자 가이드입니다.

---

## 2. 7-Step 온보딩 로드맵 (7-Step Roadmap)
1. **STEP 1 (회사 정보 확인)**: 공식 법인명, 대표 연락처, 필수 4대 주소(기본주소, 시, 도, 우편번호) 등록 (\`/portal/company/info\`)
2. **STEP 2 (관리자 정보 확인)**: 대표 관리자의 국문/영문 성명, 직함(Job Title), 대표 연락처 등록 (\`/portal/account\`)
3. **STEP 3 (브랜드 정보 확인)**: 대표 브랜드명, 로고 및 대한민국(KIPO)/미국(USPTO) 상표권 보유 현황 확인 (\`/portal/brands\`)
4. **STEP 4 (팀원 초대 - 선택)**: 포털을 함께 운영할 사내 동료 초대 및 권한 설정 (1인 기업의 경우 '나중에 하기' 가능) (\`/portal/company/users\`)
5. **STEP 5 (6대 담당업무 지정)**: 회사·계약·제품·가격·물류·정산 6대 핵심 업무별 사내 주 담당자(Primary Owner) 및 알림 수신인 지정 (\`/portal/company/info?tab=tasks\`)
6. **STEP 6 (상품 등록 완료)**: 대표 상품을 최소 1개 이상 등록 완료(COMPLETE) 상태로 등록 (\`/portal/products\`)
7. **STEP 7 (기본계약 체결)**: 브랜드 공급 및 플랫폼 이용 기본계약서 검토 및 자필 전자서명 체결 (\`/portal/company/info?tab=agreements\`)

---

## 3. 온보딩 완료 판정 기준
대시보드 상단의 7개 단계가 모두 충족되면 **7 / 7 완료 (100%)** 녹색 배지가 표시되며 정식 운영 단계로 전환됩니다.`,
    content_en: `# K SELECT Brand Portal Onboarding Guide (MAN-B-ONB-001 v1.0)

## 1. Purpose and Scope
Official step-by-step user manual for partner brands to complete the 7-step onboarding process on K SELECT Brand Portal.

## 2. 7-Step Onboarding Roadmap
1. STEP 1 (Company Info): Corporate address, city, state, zip code (/portal/company/info)
2. STEP 2 (Admin Profile): Full legal KR/EN name, title, contact (/portal/account)
3. STEP 3 (Brand Info): Brand name, logo, KIPO/USPTO trademarks (/portal/brands)
4. STEP 4 (Team Members - Optional): Invite colleagues or skip (/portal/company/users)
5. STEP 5 (Task Owners): Assign primary owners across 6 operational areas (/portal/company/info?tab=tasks)
6. STEP 6 (Product Registration): Register at least 1 COMPLETE product (/portal/products)
7. STEP 7 (Master Agreement): Review terms and execute electronic signature (/portal/company/info?tab=agreements)

## 3. Completion Criteria
Achieving 7 / 7 (100%) unlocks regular portal operations.`,
    type: 'MANUAL',
    source_type: 'DOCUMENT',
    module: 'ONBOARDING',
    category: 'Brand Portal',
    tags: ['MANUAL', 'ONBOARDING', 'GUIDE', 'BRAND', 'MAN-B-ONB-001', 'OFFICIAL', 'START'],
    owner_id: 'usr-admin-system',
    owner_name: 'K SELECT Operations Team',
    status: 'PUBLISHED',
    system_impact_status: 'NORMAL',
    system_impact_reason: null,
    system_impact_updated_at: now,
    audience: ['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: 'APPROVED',
    external_reviewer_id: 'staff-superadmin-01',
    external_reviewed_at: now,
    current_version: 'v1.0',
    effective_date: '2026-10-01',
    document_url: '/api/admin/knowledge/asset/asset-onboarding-guide-v10',
    document_name: 'MAN-B-ONB-001_Onboarding_Guide_v1.0.pdf',
    document_size: pdfStats.size,
    document_type: 'application/pdf',
    created_at: now,
    updated_at: now
  };

  console.log('Upserting knowledge_items:', knowledgeItem.id);
  const { data: itemData, error: itemError } = await supabase
    .from('knowledge_items')
    .upsert(knowledgeItem)
    .select();

  if (itemError) {
    console.error('Error upserting knowledge_item:', itemError);
  } else {
    console.log('Successfully upserted knowledge_item:', itemData[0].id);
  }

  const versionRecord = {
    id: 'ver-onboarding-guide-v10',
    knowledge_id: 'kno-onboarding-guide-v10',
    version: 'v1.0',
    status: 'PUBLISHED',
    title_ko: 'K SELECT Brand Portal 온보딩 가이드 v1.0',
    title_en: 'K SELECT Brand Portal Onboarding Guide v1.0',
    summary_ko: 'MAN-B-ONB-001 첫 공식 배포 버전입니다.',
    summary_en: 'Initial official publication of MAN-B-ONB-001.',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-ONB-001 Brand Portal Onboarding Guide 최초 공식 배포',
    why_changed: '파트너사 온보딩 7단계 표준 절차 가이드 정립',
    effective_date: '2026-10-01',
    document_url: '/api/admin/knowledge/asset/asset-onboarding-guide-v10',
    document_name: 'MAN-B-ONB-001_Onboarding_Guide_v1.0.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'K SELECT Operations Team',
    reviewer_id: 'staff-superadmin-01',
    approver_id: 'staff-superadmin-01',
    published_at: now,
    created_at: now
  };

  console.log('Upserting knowledge_versions:', versionRecord.id);
  const { data: verData, error: verError } = await supabase
    .from('knowledge_versions')
    .upsert(versionRecord)
    .select();

  if (verError) {
    console.error('Error upserting knowledge_version:', verError);
  } else {
    console.log('Successfully upserted knowledge_version:', verData[0].id);
  }
}

main().catch(console.error);
