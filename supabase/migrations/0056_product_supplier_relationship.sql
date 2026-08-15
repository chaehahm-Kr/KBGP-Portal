-- 0056_product_supplier_relationship.sql — Supplier ↔ Product Relationship
--

-- 1. Create product_suppliers table
CREATE TABLE IF NOT EXISTS public.product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_supplier_unique UNIQUE (product_id, supplier_id)
);

COMMENT ON TABLE public.product_suppliers IS '상품과 발주 공급사(Supplier) 간의 다대다 거래 매핑 정보';

-- Enable RLS
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_suppliers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_suppliers_admin_all" ON public.product_suppliers;
CREATE POLICY "product_suppliers_admin_all"
  ON public.product_suppliers
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- 2. Backfill existing relationships from products.company_id to product_suppliers
-- Since the brand owner/submitting company (products.company_id) is the default supplier.
INSERT INTO public.product_suppliers (product_id, supplier_id)
SELECT id, company_id 
FROM public.products 
WHERE company_id IS NOT NULL
ON CONFLICT DO NOTHING;
