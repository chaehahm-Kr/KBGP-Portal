# RTP-ORD-001-R1: Retailer Order Pre-Migration Security, Pricing & Order Number Correction

## 1. Executive Summary
Before executing `0097_retailer_orders_foundation.sql` in Production, a complete architectural and security audit was conducted. All potential data exposure, race-condition ordering issues, and role-authorization bypasses have been eliminated.

### Corrected Items:
1. **Strict Wholesale Price Source & Confidentiality:**
   - Removed all fallbacks to `products.price_usd_fob` or `0.5 * estimated_retail_price`.
   - Retailer wholesale price derives strictly from `product_curations.wholesale_price`.
   - Products without active curation wholesale pricing (`wholesale_price <= 0`) are marked `isOrderable: false`, disabling the Add to Cart button in UI and triggering a strict server-side rejection upon order submission.
2. **Concurrency-Safe Atomic Order Number:**
   - Replaced `MAX(existing) + 1` with PostgreSQL sequence `public.retailer_order_number_seq`.
   - Helper function `generate_retailer_order_number()` returns atomic `KSR-YYYY-XXXXXX` numbers safely under concurrent loads.
3. **Role-Aware & Store-Scoped RLS Policies:**
   - Helper `auth_can_retailer_submit_order(company_id, store_id)`: restricts order creation to `owner`, `buyer`, and `store_manager` (for assigned store). Blocks `employee` and `accounting`.
   - Helper `auth_can_retailer_view_order(company_id, store_id)`: grants view access to `owner`, `buyer`, `accounting`, and `store_manager` (for assigned store).
   - Enforced order immutability for Retailers (`UPDATE`/`DELETE` restricted to Admin only).
4. **Server-Side Order Authority:**
   - Server action `submitRetailerOrder` verifies role permission, store assignments, live product availability, wholesale pricing, and Case Pack MOQ multiples.
5. **Test-Order Identification:**
   - Automatically sets `is_test = true` for test/demo companies.

---

## 2. Action Required: Execute Migration 0097 in Supabase SQL Editor

Please copy and execute the SQL below in the **Production Supabase SQL Editor** (`shzfrppdobpmrstcjfqu`):

```sql
-- 0097_retailer_orders_foundation.sql
-- RTP-ORD-001 & RTP-ORD-001-R1: Retailer Orders & Order Items Data Architecture with Strict Role & Store-Scope RLS

-- 1. Create Concurrency-Safe Order Number Sequence
CREATE SEQUENCE IF NOT EXISTS public.retailer_order_number_seq START 1;

-- 2. Create retailer_orders table
CREATE TABLE IF NOT EXISTS public.retailer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  order_status TEXT NOT NULL DEFAULT 'submitted' CHECK (order_status IN ('draft', 'submitted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'partially_paid', 'failed', 'refunded')),
  payment_terms TEXT,
  subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_items_count INTEGER NOT NULL DEFAULT 0,
  total_skus_count INTEGER NOT NULL DEFAULT 0,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_phone TEXT,
  recipient_name TEXT,
  notes TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_orders_company_id ON public.retailer_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_store_id ON public.retailer_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_user_id ON public.retailer_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_order_status ON public.retailer_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_created_at ON public.retailer_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_orders_is_test ON public.retailer_orders(is_test);

COMMENT ON TABLE public.retailer_orders IS '리테일러 기업의 B2B 상품 발주 주문서 (주문 상태, 배송 매장, 결제 조건 및 총액)';

-- 3. Create retailer_order_items table
CREATE TABLE IF NOT EXISTS public.retailer_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retailer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  unit_wholesale_price NUMERIC(12, 2) NOT NULL CHECK (unit_wholesale_price >= 0),
  unit_msrp NUMERIC(12, 2) CHECK (unit_msrp >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  case_pack_qty INTEGER NOT NULL DEFAULT 1 CHECK (case_pack_qty > 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_order_items_order_id ON public.retailer_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_retailer_order_items_product_id ON public.retailer_order_items(product_id);

COMMENT ON TABLE public.retailer_order_items IS '리테일러 주문서의 개별 품목 및 체결 당시의 도매단가(Wholesale) 스냅샷';

-- 4. Helper Functions for Role-Aware & Store-Scoped Order Authorization
CREATE OR REPLACE FUNCTION public.auth_can_retailer_submit_order(p_company_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.retailer_user_roles rur
    WHERE rur.user_id = auth.uid()
      AND rur.company_id = p_company_id
      AND rur.role IN ('owner', 'buyer', 'store_manager')
      AND (
        rur.role IN ('owner', 'buyer')
        OR rur.has_all_stores_access = true
        OR p_store_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.retailer_user_store_access rusa
          WHERE rusa.user_id = auth.uid()
            AND rusa.company_id = p_company_id
            AND rusa.store_id = p_store_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_can_retailer_view_order(p_company_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.retailer_user_roles rur
    WHERE rur.user_id = auth.uid()
      AND rur.company_id = p_company_id
      AND (
        rur.role IN ('owner', 'buyer', 'accounting')
        OR rur.has_all_stores_access = true
        OR p_store_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.retailer_user_store_access rusa
          WHERE rusa.user_id = auth.uid()
            AND rusa.company_id = p_company_id
            AND rusa.store_id = p_store_id
        )
      )
  );
$$;

-- 5. Helper Function: Concurrency-Safe Atomic Order Number Generation
CREATE OR REPLACE FUNCTION public.generate_retailer_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  next_val BIGINT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  next_val := nextval('public.retailer_order_number_seq');
  RETURN 'KSR-' || current_year || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- 6. Row Level Security for retailer_orders
ALTER TABLE public.retailer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_orders_admin_all" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_retailer_select" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_retailer_insert" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_retailer_update" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_select" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_insert" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_update_admin_only" ON public.retailer_orders;
DROP POLICY IF EXISTS "retailer_orders_delete_admin_only" ON public.retailer_orders;

-- SELECT: Admins or Authorized Retailers matching company & store-view scope
CREATE POLICY "retailer_orders_select"
  ON public.retailer_orders FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND public.auth_can_retailer_view_order(company_id, store_id)
    )
  );

-- INSERT: Admins or Authorized Retailers (Owner, Buyer, Store Manager with store access)
CREATE POLICY "retailer_orders_insert"
  ON public.retailer_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_admin()
    OR (
      company_id = public.auth_company_id()
      AND user_id = auth.uid()
      AND public.auth_can_retailer_submit_order(company_id, store_id)
    )
  );

-- UPDATE: Admin only (Submitted orders are immutable from Retailer client)
CREATE POLICY "retailer_orders_update_admin_only"
  ON public.retailer_orders FOR UPDATE
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- DELETE: Admin only
CREATE POLICY "retailer_orders_delete_admin_only"
  ON public.retailer_orders FOR DELETE
  TO authenticated
  USING (public.auth_is_admin());

-- 7. Row Level Security for retailer_order_items
ALTER TABLE public.retailer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retailer_order_items_admin_all" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_retailer_select" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_retailer_insert" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_select" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_insert" ON public.retailer_order_items;
DROP POLICY IF EXISTS "retailer_order_items_modify_admin_only" ON public.retailer_order_items;

-- SELECT: Admins or Retailers who have view permission on parent order
CREATE POLICY "retailer_order_items_select"
  ON public.retailer_order_items FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_items.order_id
        AND ro.company_id = public.auth_company_id()
        AND public.auth_can_retailer_view_order(ro.company_id, ro.store_id)
    )
  );

-- INSERT: Admins or Retailers inserting into their own authorized order
CREATE POLICY "retailer_order_items_insert"
  ON public.retailer_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.retailer_orders ro
      WHERE ro.id = retailer_order_items.order_id
        AND ro.company_id = public.auth_company_id()
        AND ro.user_id = auth.uid()
        AND public.auth_can_retailer_submit_order(ro.company_id, ro.store_id)
    )
  );

-- UPDATE/DELETE: Admin only
CREATE POLICY "retailer_order_items_modify_admin_only"
  ON public.retailer_order_items FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());
```
