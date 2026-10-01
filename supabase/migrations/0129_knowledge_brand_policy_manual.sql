-- Migration: 0129_knowledge_brand_policy_manual.sql
-- Description: Seed MAN-BRAND-001 (Brand Registration & Management Policy) into Knowledge Foundation (ADM-KNW-001-R1)

-- 1. Insert or Update MAN-BRAND-001 in knowledge_items
INSERT INTO public.knowledge_items (
    id, slug, title, title_ko, title_en,
    summary_ko, summary_en,
    content_ko, content_en,
    type, source_type, module, category, tags,
    owner_id, owner_name, status,
    system_impact_status, audience, is_sensitive_internal,
    current_version, effective_date,
    document_url, document_name, document_size, document_type,
    created_at, updated_at
) VALUES (
    'kno-brand-policy-v10',
    'man-brand-001-brand-policy',
    'MAN-BRAND-001: Brand Registration & Management Policy',
    'K SELECT 브랜드 등록 및 관리 정책',
    'K SELECT Brand Registration & Management Policy',
    'K SELECT NETWORK에 브랜드를 등록하고 카테고리, 원산지, 물류/배송 정보, 입점 신청 및 상품 연동을 수행하는 표준 정책 및 운영 가이드입니다.',
    'Official standard policy and operational manual for registering and managing brands, categories, origin, logistics, applications, and product linkages on K SELECT NETWORK.',
    '# K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)

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
2. 승인 완료된 브랜드에 한하여 상품 등록(`Product Registration`) 및 미국 리테일러 입점 신청(`Retail Application`)이 활성화됩니다.
3. 허위 정보나 인증 미비 서류가 확인될 경우 등록이 취소되거나 서비스 이용이 제한될 수 있습니다.',
    '# K SELECT Brand Registration & Management Policy (MAN-BRAND-001)

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
Submitted brands undergo verification by K SELECT Admin operations before acquiring APPROVED status to register products and submit retail applications.',
    'MANUAL',
    'DOCUMENT',
    'Brand & Products',
    'Brand Portal',
    ARRAY['Brand', 'Registration', 'Policy', 'Manual', 'MAN-BRAND-001', 'Official'],
    'usr-admin-system',
    'K SELECT Operations Team',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL', 'BRAND'],
    false,
    'v1.0',
    '2026-03-01',
    '/api/admin/knowledge/download/MAN-BRAND-001_Brand_Policy_v1.0.pdf',
    'MAN-BRAND-001 Brand Policy.pdf',
    1391802,
    'application/pdf',
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_ko = EXCLUDED.title_ko,
    title_en = EXCLUDED.title_en,
    summary_ko = EXCLUDED.summary_ko,
    summary_en = EXCLUDED.summary_en,
    content_ko = EXCLUDED.content_ko,
    content_en = EXCLUDED.content_en,
    document_url = EXCLUDED.document_url,
    document_name = EXCLUDED.document_name,
    document_size = EXCLUDED.document_size,
    document_type = EXCLUDED.document_type,
    updated_at = now();

-- 2. Insert or Update Version in knowledge_versions
INSERT INTO public.knowledge_versions (
    id, knowledge_id, version, status,
    title_ko, title_en, summary_ko, summary_en,
    content_ko, content_en,
    what_changed, why_changed, effective_date,
    document_url, document_name,
    created_by_id, created_by_name,
    published_at, created_at
) VALUES (
    'ver-brand-policy-v10',
    'kno-brand-policy-v10',
    'v1.0',
    'PUBLISHED',
    'K SELECT 브랜드 등록 및 관리 정책 v1.0',
    'K SELECT Brand Registration & Management Policy v1.0',
    'MAN-BRAND-001 첫 공식 배포 버전입니다.',
    'Initial official publication of MAN-BRAND-001.',
    '# K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)\n\n본 문서는 K SELECT Brand Portal 브랜드 등록 및 관리에 관한 공식 표준 매뉴얼입니다.',
    '# K SELECT Brand Registration & Management Policy (MAN-BRAND-001)\n\nOfficial operational manual for brand management.',
    '초기 공식 매뉴얼 배포 (Initial Official Manual Release)',
    '브랜드 등록 및 관리 표준 프로세스 정립',
    '2026-03-01',
    '/api/admin/knowledge/download/MAN-BRAND-001_Brand_Policy_v1.0.pdf',
    'MAN-BRAND-001 Brand Policy.pdf',
    'usr-admin-system',
    'K SELECT Operations Team',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert or Update Asset in knowledge_manual_assets
INSERT INTO public.knowledge_manual_assets (
    id, knowledge_id, manual_title, version, language, is_current,
    file_url, file_name, file_size, published_date, created_at
) VALUES (
    'asset-brand-policy-v10',
    'kno-brand-policy-v10',
    'MAN-BRAND-001 K SELECT 브랜드 등록 및 관리 정책',
    'v1.0',
    'KO',
    true,
    '/api/admin/knowledge/download/MAN-BRAND-001_Brand_Policy_v1.0.pdf',
    'MAN-BRAND-001 Brand Policy.pdf',
    1391802,
    '2026-03-01',
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Relations in knowledge_relations
INSERT INTO public.knowledge_relations (
    id, knowledge_id, related_portal, related_module, related_menu, related_route, created_at
) VALUES
    ('rel-brand-01', 'kno-brand-policy-v10', 'BRAND_PORTAL', 'Brand Management', 'Brand Profile', '/portal/brands', now()),
    ('rel-brand-02', 'kno-brand-policy-v10', 'BRAND_PORTAL', 'Brand Registration', 'New Brand Form', '/portal/brands/new', now()),
    ('rel-brand-03', 'kno-brand-policy-v10', 'BRAND_PORTAL', 'Brand Detail', 'Brand Edit', '/portal/brands/[id]', now()),
    ('rel-brand-04', 'kno-brand-policy-v10', 'BRAND_PORTAL', 'Products', 'Product List', '/portal/products', now()),
    ('rel-brand-05', 'kno-brand-policy-v10', 'BRAND_PORTAL', 'Products', 'Product Register', '/portal/products/new', now()),
    ('rel-brand-06', 'kno-brand-policy-v10', 'BRAND_PORTAL', 'Applications', 'Retail Application', '/portal/applications', now()),
    ('rel-brand-07', 'kno-brand-policy-v10', 'ADMIN', 'Brand Management', 'Admin Brands', '/admin/brands', now()),
    ('rel-brand-08', 'kno-brand-policy-v10', 'ADMIN', 'Company Management', 'Admin Companies', '/admin/companies', now()),
    ('rel-brand-09', 'kno-brand-policy-v10', 'ADMIN', 'Product Management', 'Admin Products', '/admin/products', now())
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Initial Audit Log in knowledge_audit_logs
INSERT INTO public.knowledge_audit_logs (
    id, knowledge_id, action, user_id, user_name, reason, created_at
) VALUES (
    'log-brand-init',
    'kno-brand-policy-v10',
    'INITIAL_PUBLISH',
    'usr-admin-system',
    'K SELECT Operations Team',
    'Official MAN-BRAND-001 Brand Registration & Management Policy published with verified PDF asset.',
    now()
)
ON CONFLICT (id) DO NOTHING;
