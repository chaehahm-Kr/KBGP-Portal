-- 0152_retailer_saved_collections.sql
-- RTP-PROD-LIST-001: Retailer Saved Products & Multi-Collections Architecture

-- 1. Create retailer_collections table
CREATE TABLE IF NOT EXISTS public.retailer_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retailer_collection_name UNIQUE (retailer_id, name)
);

CREATE INDEX IF NOT EXISTS idx_retailer_collections_retailer_id ON public.retailer_collections(retailer_id);

COMMENT ON TABLE public.retailer_collections IS '리테일러별 커스텀 관심 상품 컬렉션 (폴더) 목록';

-- 2. Create retailer_saved_products table
CREATE TABLE IF NOT EXISTS public.retailer_saved_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.retailer_collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_retailer_saved_product_collection 
  ON public.retailer_saved_products(retailer_id, COALESCE(collection_id, '00000000-0000-0000-0000-000000000000'::uuid), product_id);

CREATE INDEX IF NOT EXISTS idx_retailer_saved_products_retailer_id ON public.retailer_saved_products(retailer_id);
CREATE INDEX IF NOT EXISTS idx_retailer_saved_products_collection_id ON public.retailer_saved_products(collection_id);
CREATE INDEX IF NOT EXISTS idx_retailer_saved_products_product_id ON public.retailer_saved_products(product_id);

COMMENT ON TABLE public.retailer_saved_products IS '리테일러가 저장(Heart)한 관심 상품 매핑 테이블';

-- 3. Enable RLS
ALTER TABLE public.retailer_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_saved_products ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Service role full access on retailer_collections"
  ON public.retailer_collections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on retailer_saved_products"
  ON public.retailer_saved_products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
