-- Migration: 0132_knowledge_topics_and_portal_scope.sql
-- Description: Create knowledge_topics table for independent Brand and Retail taxonomies, and link knowledge_faqs with topic_id and portal_scope.

CREATE TABLE IF NOT EXISTS public.knowledge_topics (
    id TEXT PRIMARY KEY,
    portal_scope TEXT NOT NULL CHECK (portal_scope IN ('BRAND', 'RETAILER')),
    name_ko TEXT NOT NULL,
    name_en TEXT,
    short_desc_ko TEXT,
    short_desc_en TEXT,
    description_ko TEXT,
    description_en TEXT,
    icon TEXT NOT NULL DEFAULT '📁',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    match_modules TEXT[] DEFAULT '{}'::TEXT[],
    match_keywords TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for knowledge_topics
CREATE INDEX IF NOT EXISTS idx_knowledge_topics_scope_active ON public.knowledge_topics (portal_scope, is_active, display_order);

-- Enable RLS on knowledge_topics
ALTER TABLE public.knowledge_topics ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active topics
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_topics' AND policyname = 'Allow public read of active topics'
    ) THEN
        CREATE POLICY "Allow public read of active topics"
        ON public.knowledge_topics FOR SELECT
        USING (is_active = true);
    END IF;
END $$;

-- Allow service_role full management
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_topics' AND policyname = 'Allow service_role full management on knowledge_topics'
    ) THEN
        CREATE POLICY "Allow service_role full management on knowledge_topics"
        ON public.knowledge_topics FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Extend knowledge_faqs table with portal_scope and topic_id
ALTER TABLE public.knowledge_faqs
ADD COLUMN IF NOT EXISTS portal_scope TEXT NOT NULL DEFAULT 'BRAND' CHECK (portal_scope IN ('BRAND', 'RETAILER')),
ADD COLUMN IF NOT EXISTS topic_id TEXT REFERENCES public.knowledge_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_faqs_scope_topic ON public.knowledge_faqs (portal_scope, topic_id);

-- Seed Canonical Brand Topics (10 canonical items)
INSERT INTO public.knowledge_topics (id, portal_scope, name_ko, name_en, short_desc_ko, short_desc_en, description_ko, description_en, icon, display_order, is_active, match_modules, match_keywords)
VALUES
('topic-start', 'BRAND', '시작하기', 'Getting Started', '가입 · 계정 · 기본 온보딩', 'Signup · Account · Onboarding', '회원가입, 회사 등록, 초기 계정 설정 및 온보딩', 'Account registration, company setup, and onboarding guides', '🚀', 1, true, ARRAY['ONBOARDING', 'SIGNUP', 'ACCOUNT', 'START', 'SETUP'], ARRAY['가입', '시작', '온보딩', '초기 설정', '계정', 'onboarding', 'signup', 'start', 'account']),
('topic-brand', 'BRAND', '브랜드 관리', 'Brand Management', '등록 · 상표권 · 수정 · 사용 중단', 'Registration · Trademark · Inactive', '브랜드 등록, 상표권 정책, 브랜드 권한 및 사용 중단 정책', 'Brand registration, trademark policy, ownership, and deactivation rules', '🏷️', 2, true, ARRAY['BRAND', 'BRANDS', 'BRAND_POLICY'], ARRAY['브랜드', '상표권', '브랜드 삭제', '브랜드 비활성화', 'brand', 'trademark', 'ownership', 'man-brand-001']),
('topic-product', 'BRAND', '상품 등록 & 관리', 'Product Management', '상품 등록 · SKU · 규격 · 승인', 'Products · SKU · Specs · Approval', '상품 신규 등록, SKU 관리, 상품 정보 수정 및 브랜드 연결', 'Product registration, SKU management, catalog editing, and brand linking', '📦', 3, true, ARRAY['PRODUCTS', 'PRODUCT', 'SKU', 'CATALOG'], ARRAY['상품', '제품', 'sku', '카탈로그', '바코드', 'product', 'item']),
('topic-regulatory', 'BRAND', '인허가 & 규정', 'Regulatory & Compliance', 'FDA · MoCRA · 라벨 · 통관 인증', 'FDA · MoCRA · Labeling · US Compliance', '미국 판매 요건, FDA, MoCRA, 라벨링 및 필수 인증 서류', 'US market compliance, FDA, MoCRA, labeling, and required certificates', '📜', 4, true, ARRAY['REGULATORY', 'COMPLIANCE', 'FDA', 'MOCRA'], ARRAY['인허가', '규정', 'fda', 'mocra', '라벨링', '성분', 'certification', 'compliance']),
('topic-retail', 'BRAND', '입점 & 리테일 네트워크', 'Retail Network', '바이어 매칭 · 입점 신청 · 유통 채널', 'Buyer Matching · Placement · Channels', '바이어 매장 입점 신청, 리테일 네트워크 참여 및 테스트 프로그램', 'Retail store applications, distribution network, and testing opportunities', '🏬', 5, true, ARRAY['RETAIL', 'RETAILER', 'STORE', 'NETWORK'], ARRAY['입점', '리테일', '매장', '네트워크', '스토어', 'retail', 'store', 'network']),
('topic-orders', 'BRAND', '발주 요청 & 오더', 'Orders & PO', '발주서 · PO 접수 · 납기 관리', 'Purchase Orders · PO · Lead Time', '리테일러 발주 요청(Request) 확인, 수락 및 정식 발주서(PO) 처리', 'Retailer purchase requests, acceptance, and formal Purchase Order (PO) workflow', '📋', 6, true, ARRAY['ORDERS', 'PURCHASE_ORDER', 'ORDER', 'PO'], ARRAY['발주', '오더', 'po', '발주서', '발주 요청', 'purchase order', 'order', 'request']),
('topic-logistics', 'BRAND', '재고 & 물류', 'Inventory & Logistics', '입고 · 출고지 · 3PL · 배송 정책', 'Origin · Return · 3PL · Logistics', '물류 출고지/반품지 관리, 재고 현황, 배송 및 트래킹 추적', 'Shipping origin, return address, inventory levels, and logistics tracking', '🚚', 7, true, ARRAY['LOGISTICS', 'INVENTORY', 'SHIPPING', 'WAREHOUSE', 'FULFILLMENT'], ARRAY['물류', '재고', '출고지', '반품지', '배송', '창고', 'shipping', 'inventory', 'warehouse']),
('topic-finance', 'BRAND', '정산 & 결제', 'Settlement & Finance', '정산 주기 · 인보이스 · 세금계산서', 'Settlement · Invoice · Payout', '판매대금 정산 내역, 인보이스, 송금 계좌 및 수수료 안내', 'Settlement reports, invoices, remittance accounts, and platform fees', '💳', 8, true, ARRAY['FINANCE', 'SETTLEMENT', 'PAYMENT', 'INVOICE'], ARRAY['정산', '결제', '인보이스', '송금', '수수료', 'finance', 'settlement', 'payment', 'invoice']),
('topic-marketing', 'BRAND', '프로모션 & 마케팅', 'Promotion & Marketing', '기획전 · 할인 · 프로모션 가이드', 'Promotions · Discounts · Campaigns', '마케팅 지원 프로그램, 할인 프로모션 및 캠페인 참여 안내', 'Marketing support programs, discount promotions, and campaign participation', '📣', 9, true, ARRAY['PROMOTION', 'MARKETING', 'CAMPAIGN'], ARRAY['프로모션', '마케팅', '캠페인', '할인', '이벤트', 'promotion', 'marketing', 'campaign']),
('topic-company', 'BRAND', '회사 & 사용자 관리', 'Company & Users', '사업자 정보 · 권한 · 팀원 초대', 'Company Profile · Roles · Invitations', '회사 정보 변경, 팀원 초대, 권한 설정 및 계정 관리', 'Company details, team invitations, role permissions, and access settings', '👥', 10, true, ARRAY['COMPANY', 'USERS', 'SETTINGS', 'MEMBERS'], ARRAY['회사', '사용자', '팀원', '권한', '초대', 'company', 'user', 'permission', 'member'])
ON CONFLICT (id) DO UPDATE SET
  portal_scope = EXCLUDED.portal_scope,
  name_ko = EXCLUDED.name_ko,
  name_en = EXCLUDED.name_en,
  short_desc_ko = EXCLUDED.short_desc_ko,
  short_desc_en = EXCLUDED.short_desc_en,
  description_ko = EXCLUDED.description_ko,
  description_en = EXCLUDED.description_en,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  match_modules = EXCLUDED.match_modules,
  match_keywords = EXCLUDED.match_keywords,
  updated_at = NOW();

-- Seed 5 Approved Brand FAQs for MAN-BRAND-001 under topic-brand
INSERT INTO public.knowledge_faqs (id, portal_scope, topic_id, source_knowledge_id, source_version, source_title, question_ko, question_en, answer_ko, answer_en, audience, status, kind, display_order, is_featured, generated_by)
VALUES
('faq-brand-01', 'BRAND', 'topic-brand', 'kno-brand-policy-v10', 'v1.0', 'K SELECT 브랜드 등록 및 관리 정책', '브랜드는 어떻게 등록하나요?', 'How do I register a brand in the portal?', '포털 내 브랜드 관리 메뉴(/portal/brands) 또는 신규 등록 화면(/portal/brands/new)에서 브랜드 국문/영문명, 사업자 등록번호, 대표 카테고리, 슬로건 및 물류 출고지/반품지 정보를 입력하여 등록합니다. 상품 등록 전 활성 브랜드 등록이 필수입니다. (Policy 01)', 'Navigate to Brand Management (/portal/brands) or New Brand (/portal/brands/new) to enter brand names, business ID, category, and logistics origins. Brand registration is mandatory before product listings. (Policy 01)', ARRAY['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'], 'APPROVED', 'BOTH', 1, true, 'MANUAL'),
('faq-brand-02', 'BRAND', 'topic-brand', 'kno-brand-policy-v10', 'v1.0', 'K SELECT 브랜드 등록 및 관리 정책', '상표권이 없어도 브랜드 등록이 가능한가요?', 'Can I register a brand without an official trademark?', '네, 가능합니다. 포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, 특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다. 상표권이 없거나 출원 중인 브랜드도 자유롭게 등록하여 입점할 수 있습니다. (Policy 02)', 'Yes. Brand registration in the portal is for catalog classification and does not require official trademark registration. Brands without trademarks or with pending applications can be registered. (Policy 02)', ARRAY['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'], 'APPROVED', 'BOTH', 2, true, 'MANUAL'),
('faq-brand-03', 'BRAND', 'topic-brand', 'kno-brand-policy-v10', 'v1.0', 'K SELECT 브랜드 등록 및 관리 정책', '상품이 연결된 브랜드를 삭제할 수 있나요?', 'Can I delete a brand that has associated products?', '단 1건이라도 상품이 등록된 브랜드는 발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가합니다. 취급 중단 시 영구 삭제 대신 ''사용 중단(Inactive)'' 비활성화 처리를 적용하며, 언제든지 재활성화가 가능합니다. (Policy 05 & 06)', 'Brands associated with even one product cannot be physically hard-deleted to preserve order, customs, and invoice audit integrity. Use Inactive status instead. (Policy 05 & 06)', ARRAY['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'], 'APPROVED', 'BOTH', 3, true, 'MANUAL'),
('faq-brand-04', 'BRAND', 'topic-brand', 'kno-brand-policy-v10', 'v1.0', 'K SELECT 브랜드 등록 및 관리 정책', '동일한 브랜드를 여러 회사가 취급할 수 있나요?', 'Can multiple partner companies distribute the same brand?', '네, 글로벌 B2B 유통 구조를 반영하여 동일 브랜드를 여러 회사(제조사, 공식 총판, 셀러)가 독립적으로 취급할 수 있습니다. 단, 지식재산권을 직접 보유한 원천 Brand Owner는 시스템상 1개사로 정의됩니다. (Policy 03 & 04)', 'Yes. Multiple independent companies (manufacturers, distributors, sellers) can distribute the same brand, while authoritative Brand Ownership is maintained at 1 entity. (Policy 03 & 04)', ARRAY['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'], 'APPROVED', 'BOTH', 4, false, 'MANUAL'),
('faq-brand-05', 'BRAND', 'topic-brand', 'kno-brand-policy-v10', 'v1.0', 'K SELECT 브랜드 등록 및 관리 정책', '사용하지 않는 브랜드는 어떻게 처리하나요?', 'How do I handle unused or discontinued brands?', '취급을 중단하거나 사용하지 않는 브랜드는 브랜드 관리 목록에서 ''사용 중단(Inactive)''으로 전환합니다. 비활성화된 브랜드는 신규 상품 등록 목록에서 제외되지만 기존 거래 내역은 안전하게 보존됩니다. (Policy 06)', 'Set discontinued brands to Inactive in the Brand Management screen. Inactive brands are hidden from new product selection while preserving audit history. (Policy 06)', ARRAY['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'], 'APPROVED', 'BOTH', 5, false, 'MANUAL')
ON CONFLICT (id) DO UPDATE SET
  portal_scope = EXCLUDED.portal_scope,
  topic_id = EXCLUDED.topic_id,
  source_knowledge_id = EXCLUDED.source_knowledge_id,
  source_version = EXCLUDED.source_version,
  source_title = EXCLUDED.source_title,
  question_ko = EXCLUDED.question_ko,
  question_en = EXCLUDED.question_en,
  answer_ko = EXCLUDED.answer_ko,
  answer_en = EXCLUDED.answer_en,
  audience = EXCLUDED.audience,
  status = EXCLUDED.status,
  kind = EXCLUDED.kind,
  display_order = EXCLUDED.display_order,
  is_featured = EXCLUDED.is_featured,
  generated_by = EXCLUDED.generated_by,
  updated_at = NOW();
