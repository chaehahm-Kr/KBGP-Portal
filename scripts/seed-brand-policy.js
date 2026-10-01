const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync('.env.local', 'utf8');
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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function seedBrandPolicyToSupabase() {
  console.log('Seeding MAN-BRAND-001 into Supabase...');

  // 1. knowledge_items
  const { data: itemData, error: itemErr } = await client.from('knowledge_items').upsert({
    id: 'kno-brand-policy-v10',
    slug: 'man-brand-001-brand-policy',
    title: 'MAN-BRAND-001: Brand Registration & Management Policy',
    title_ko: 'K SELECT 브랜드 등록 및 관리 정책',
    title_en: 'K SELECT Brand Registration & Management Policy',
    summary_ko: 'K SELECT NETWORK에 브랜드를 등록하고 카테고리, 원산지, 물류/배송 정보, 입점 신청 및 상품 연동을 수행하는 표준 정책 및 운영 가이드입니다.',
    summary_en: 'Official standard policy and operational manual for registering and managing brands, categories, origin, logistics, applications, and product linkages on K SELECT NETWORK.',
    content_ko: `# K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)

## 1. 목적 및 적용 범위
본 정책 및 운영 매뉴얼은 K SELECT NETWORK 플랫폼을 이용하는 모든 파트너 브랜드사가 플랫폼 내에서 브랜드를 등록하고, 상품을 연동하며, 브랜드 프로필 및 물류 출고지 정보를 운영·관리함에 있어 준수해야 할 기본 원칙과 표준 절차를 규정합니다.

### 적용 대상
- K SELECT Brand Portal 사용자 및 브랜드 관리자
- K SELECT Admin 운영팀 (승인 및 검토 담당자)

---

## 2. 브랜드 등록 절차 및 필수 요건

### 2.1 브랜드 기본 정보
브랜드 신규 등록 시 아래 필수 정보를 정확히 기재해야 합니다:
1. **브랜드명 (국문/영문)**: 상표권 또는 사업자등록증 상의 공식 브랜드 명칭.
2. **사업자 등록번호**: 국내외 적법한 사업자 식별 번호.
3. **대표 카테고리**: 화장품(Cosmetics), 식품(Food), 패션(Fashion), 생활용품(Living) 등.
4. **브랜드 슬로건 및 소개 (국문/영문)**: 바이어 및 리테일러에게 노출되는 공식 소개문.

### 2.2 물류 및 출고지 정보
- **출고지 국가 및 주소 (Shipping Origin)**: 제품 출고지 주소 및 우편번호.
- **반품지 주소 (Return Address)**: 반품 및 교환 처리 담당지 주소.
- **리드타임 (Fulfillment Lead Time)**: 주문 접수 후 미국 현지 배송 또는 한국 수출 출고 소요 일수.

---

## 3. 심사 및 승인 기준 (Governance)
1. 등록 신청된 브랜드는 K SELECT 운영팀의 내부 심사를 거쳐 **승인(APPROVED)** 또는 **보완요청(REJECTED/PENDING)** 처리됩니다.
2. 승인 완료된 브랜드에 한하여 상품 등록(\`Product Registration\`) 및 미국 리테일러 입점 신청(\`Retail Application\`)이 활성화됩니다.
3. 허위 정보나 인증 미비 서류가 확인될 경우 등록이 취소되거나 서비스 이용이 제한될 수 있습니다.`,
    content_en: `# K SELECT Brand Registration & Management Policy (MAN-BRAND-001)

## 1. Purpose and Scope
This policy defines the standard operating principles and procedures for partner brands registering and managing their brands, shipping origins, applications, and product linkages on K SELECT NETWORK.

### Target Audience
- K SELECT Brand Portal Users & Brand Admins
- K SELECT Admin Operations Team

---

## 2. Brand Registration Requirements
1. **Brand Name (KR/EN)**: Official trade name.
2. **Business Registration Number**: Valid business ID.
3. **Primary Category**: Cosmetics, Food, Fashion, Living, etc.
4. **Brand Intro & Slogan**: Official brand introduction.
5. **Shipping Origin & Returns**: Accurate warehouse origin and return addresses.

---

## 3. Governance and Approval
Submitted brands undergo verification by K SELECT Admin operations before acquiring APPROVED status to register products and submit retail applications.`,
    type: 'MANUAL',
    source_type: 'DOCUMENT',
    module: 'Brand & Products',
    category: 'Brand Portal',
    tags: ['Brand', 'Registration', 'Policy', 'Manual', 'MAN-BRAND-001', 'Official'],
    owner_id: 'usr-admin-system',
    owner_name: 'K SELECT Operations Team',
    status: 'PUBLISHED',
    system_impact_status: 'NORMAL',
    audience: ['INTERNAL', 'BRAND'],
    is_sensitive_internal: false,
    current_version: 'v1.0',
    effective_date: '2026-03-01',
    document_url: '/api/admin/knowledge/asset/asset-brand-policy-v10',
    document_name: 'MAN-BRAND-001 Brand Policy.pdf',
    document_size: 1391802,
    document_type: 'application/pdf',
    updated_at: new Date().toISOString()
  });

  if (itemErr) {
    console.error('Failed to upsert item:', itemErr);
  } else {
    console.log('✓ Upserted kno-brand-policy-v10 into knowledge_items');
  }

  // 2. knowledge_versions
  const { error: verErr } = await client.from('knowledge_versions').upsert({
    id: 'ver-brand-policy-v10',
    knowledge_id: 'kno-brand-policy-v10',
    version: 'v1.0',
    status: 'PUBLISHED',
    title_ko: 'K SELECT 브랜드 등록 및 관리 정책 v1.0',
    title_en: 'K SELECT Brand Registration & Management Policy v1.0',
    summary_ko: 'MAN-BRAND-001 첫 공식 배포 버전입니다.',
    summary_en: 'Initial official publication of MAN-BRAND-001.',
    what_changed: '초기 공식 매뉴얼 배포 (Initial Official Manual Release)',
    why_changed: '브랜드 등록 및 관리 표준 프로세스 정립',
    effective_date: '2026-03-01',
    document_url: '/api/admin/knowledge/asset/asset-brand-policy-v10',
    document_name: 'MAN-BRAND-001 Brand Policy.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'K SELECT Operations Team',
    published_at: new Date().toISOString()
  });
  if (verErr) console.error('Version error:', verErr);
  else console.log('✓ Upserted ver-brand-policy-v10');

  // 3. knowledge_manual_assets
  const { error: assetErr } = await client.from('knowledge_manual_assets').upsert({
    id: 'asset-brand-policy-v10',
    knowledge_id: 'kno-brand-policy-v10',
    manual_title: 'K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)',
    version: 'v1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-brand-policy-v10',
    file_name: 'MAN-BRAND-001_Brand_Policy_v1.0.pdf',
    file_size: 1391802,
    published_date: '2026-10-01'
  });
  if (assetErr) console.error('Asset error:', assetErr);
  else console.log('✓ Upserted asset-brand-policy-v10');

  // 4. knowledge_relations
  const relations = [
    { id: 'rel-brand-01', knowledge_id: 'kno-brand-policy-v10', related_portal: 'BRAND_PORTAL', related_module: 'Brand Management', related_menu: 'Brand Profile', related_route: '/portal/brands' },
    { id: 'rel-brand-02', knowledge_id: 'kno-brand-policy-v10', related_portal: 'BRAND_PORTAL', related_module: 'Brand Registration', related_menu: 'New Brand Form', related_route: '/portal/brands/new' },
    { id: 'rel-brand-03', knowledge_id: 'kno-brand-policy-v10', related_portal: 'BRAND_PORTAL', related_module: 'Brand Detail', related_menu: 'Brand Edit', related_route: '/portal/brands/[id]' },
    { id: 'rel-brand-04', knowledge_id: 'kno-brand-policy-v10', related_portal: 'BRAND_PORTAL', related_module: 'Products', related_menu: 'Product List', related_route: '/portal/products' },
    { id: 'rel-brand-05', knowledge_id: 'kno-brand-policy-v10', related_portal: 'BRAND_PORTAL', related_module: 'Products', related_menu: 'Product Register', related_route: '/portal/products/new' },
    { id: 'rel-brand-06', knowledge_id: 'kno-brand-policy-v10', related_portal: 'BRAND_PORTAL', related_module: 'Applications', related_menu: 'Retail Application', related_route: '/portal/applications' },
    { id: 'rel-brand-07', knowledge_id: 'kno-brand-policy-v10', related_portal: 'ADMIN', related_module: 'Brand Management', related_menu: 'Admin Brands', related_route: '/admin/brands' },
    { id: 'rel-brand-08', knowledge_id: 'kno-brand-policy-v10', related_portal: 'ADMIN', related_module: 'Company Management', related_menu: 'Admin Companies', related_route: '/admin/companies' },
    { id: 'rel-brand-09', knowledge_id: 'kno-brand-policy-v10', related_portal: 'ADMIN', related_module: 'Product Management', related_menu: 'Admin Products', related_route: '/admin/products' }
  ];
  const { error: relErr } = await client.from('knowledge_relations').upsert(relations);
  if (relErr) console.error('Relation error:', relErr);
  else console.log('✓ Upserted 9 knowledge relations for MAN-BRAND-001');

  // 5. knowledge_audit_logs
  const { error: logErr } = await client.from('knowledge_audit_logs').upsert({
    id: 'log-brand-init',
    knowledge_id: 'kno-brand-policy-v10',
    action: 'INITIAL_PUBLISH',
    user_id: 'usr-admin-system',
    user_name: 'K SELECT Operations Team',
    reason: 'Official MAN-BRAND-001 Brand Registration & Management Policy published with verified PDF asset.'
  });
  if (logErr) console.error('Audit log error:', logErr);
  else console.log('✓ Upserted initial audit log for MAN-BRAND-001');

  console.log('Done!');
}

seedBrandPolicyToSupabase().catch(console.error);
