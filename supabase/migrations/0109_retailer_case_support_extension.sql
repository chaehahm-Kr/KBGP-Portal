-- ==============================================================================
-- Migration 0109: Retailer Support Case Integration Using Shared Partner Inquiries
-- Task ID: RTP-CAS-001
-- Description:
-- 1. Extend partner_inquiries table with source_type ('brand' | 'retailer')
-- 2. Add Retailer operational relation fields (store_id, related_order_id, related_fulfillment_id, related_product_id, related_protection_id)
-- 3. Add future-ready assignment fields (assigned_team, assigned_to)
-- 4. Create indexes for high-performance filtering across source_type and relational contexts
-- 5. Preserve 100% existing Brand Case data and backward compatibility
-- ==============================================================================

-- 1. Add source_type column (defaults to 'brand' so all existing cases remain Brand cases)
ALTER TABLE public.partner_inquiries
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'brand'
  CHECK (source_type IN ('brand', 'retailer'));

-- 2. Add Retailer relational context columns
ALTER TABLE public.partner_inquiries
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES public.retailer_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_fulfillment_id UUID REFERENCES public.retailer_order_fulfillments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_protection_id UUID REFERENCES public.retailer_initial_trial_protections(id) ON DELETE SET NULL;

-- 3. Add future-ready assignment columns
ALTER TABLE public.partner_inquiries
  ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(50),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.staff_members(id) ON DELETE SET NULL;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_partner_inquiries_source_type
  ON public.partner_inquiries(source_type);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_store_id
  ON public.partner_inquiries(store_id);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_order_id
  ON public.partner_inquiries(related_order_id);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_fulfillment_id
  ON public.partner_inquiries(related_fulfillment_id);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_product_id
  ON public.partner_inquiries(related_product_id);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_protection_id
  ON public.partner_inquiries(related_protection_id);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_assigned_to
  ON public.partner_inquiries(assigned_to);

-- 5. Add column comments
COMMENT ON COLUMN public.partner_inquiries.source_type IS '파트너 문의 출처 구분: brand (브랜드 포털) / retailer (소매점 리테일러 포털)';
COMMENT ON COLUMN public.partner_inquiries.store_id IS '리테일러 문의 대상 매장 (stores.id)';
COMMENT ON COLUMN public.partner_inquiries.related_order_id IS '관련 리테일러 주문 ID (retailer_orders.id)';
COMMENT ON COLUMN public.partner_inquiries.related_fulfillment_id IS '관련 배송 출고 ID (retailer_order_fulfillments.id)';
COMMENT ON COLUMN public.partner_inquiries.related_product_id IS '관련 상품 ID (products.id)';
COMMENT ON COLUMN public.partner_inquiries.related_protection_id IS '관련 90일 보호 신청 ID (retailer_initial_trial_protections.id)';
COMMENT ON COLUMN public.partner_inquiries.assigned_team IS '담당 부서 (예: brand_ops, retail_ops, finance, technical)';
COMMENT ON COLUMN public.partner_inquiries.assigned_to IS '담당 어드민 스태프 (staff_members.id)';

-- 6. Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
