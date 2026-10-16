-- ==============================================================================
-- Migration 0173: Reconcile Store Fixtures, Placements & Multi-Tenant Security
-- Task ID: ADM-STORE-OPS-P3-001-R3
-- Target Project: shzfrppdobpmrstcjfqu (K SELECT Production)
-- Status: READY FOR OWNER APPROVAL — NOT EXECUTED
-- 
-- Summary:
-- 1. Reconcile manually executed R1 fixture tables with approved R2 MVP design.
-- 2. Add multi-bay support (bay_count, bay_number) for 4ft, 8ft, 12ft modular displays.
-- 3. Add has_header_signage to separate illuminated graphics from product shelves.
-- 4. Establish anti-destructive delete protection (ON DELETE RESTRICT on store_id & product_id).
-- 5. Update placement uniqueness constraint to include bay_number.
-- 6. Configure explicit, strict multi-tenant Row Level Security (RLS) policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.store_fixtures (Reconciliation & Additions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  fixture_code VARCHAR(50) NOT NULL,
  fixture_name VARCHAR(100) NOT NULL,
  fixture_type VARCHAR(50) NOT NULL DEFAULT 'wall_4ft'
    CHECK (fixture_type IN ('wall_4ft', 'wall_8ft', 'wall_12ft', 'endcap_3ft', 'countertop', 'custom')),
  shelf_count INT NOT NULL DEFAULT 5 CHECK (shelf_count BETWEEN 1 AND 15),
  in_store_location VARCHAR(120),
  installation_status VARCHAR(30) NOT NULL DEFAULT 'planned'
    CHECK (installation_status IN ('planned', 'shipped', 'delivered', 'installed', 'inspected', 'retired')),
  operational_status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (operational_status IN ('active', 'needs_maintenance', 'damaged', 'retired')),
  installation_date DATE,
  installed_by VARCHAR(100),
  primary_photo_url TEXT,
  last_inspected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_store_fixture_code UNIQUE (store_id, fixture_code)
);

-- Add multi-bay support (1 for 4ft, 2 for 8ft, 3 for 12ft, N for custom)
ALTER TABLE public.store_fixtures
  ADD COLUMN IF NOT EXISTS bay_count INT NOT NULL DEFAULT 1
  CHECK (bay_count BETWEEN 1 AND 6);

-- Add header signage flag (distinguishes top banner/lightbox from product shelves)
ALTER TABLE public.store_fixtures
  ADD COLUMN IF NOT EXISTS has_header_signage BOOLEAN NOT NULL DEFAULT true;

-- Update foreign key delete behavior to RESTRICT (Anti-Destructive Protection)
DO $$
BEGIN
  -- Reconcile store_fixtures_store_id_fkey
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'store_fixtures_store_id_fkey'
      AND table_name = 'store_fixtures'
  ) THEN
    ALTER TABLE public.store_fixtures
      DROP CONSTRAINT store_fixtures_store_id_fkey;
  END IF;

  ALTER TABLE public.store_fixtures
    ADD CONSTRAINT store_fixtures_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;

  -- Reconcile store_fixtures_company_id_fkey
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'store_fixtures_company_id_fkey'
      AND table_name = 'store_fixtures'
  ) THEN
    ALTER TABLE public.store_fixtures
      DROP CONSTRAINT store_fixtures_company_id_fkey;
  END IF;

  ALTER TABLE public.store_fixtures
    ADD CONSTRAINT store_fixtures_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.store_fixture_placements (Reconciliation & Additions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_fixture_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_fixture_id UUID NOT NULL REFERENCES public.store_fixtures(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  shelf_level INT NOT NULL CHECK (shelf_level BETWEEN 1 AND 15),
  position_slot INT NOT NULL CHECK (position_slot BETWEEN 1 AND 25),
  facing_count INT NOT NULL DEFAULT 1 CHECK (facing_count BETWEEN 1 AND 10),
  capacity_units INT DEFAULT 6 CHECK (capacity_units >= 0),
  placement_status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (placement_status IN ('planned', 'active', 'clearance', 'removed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add bay_number to support multi-bay slot coordinates
ALTER TABLE public.store_fixture_placements
  ADD COLUMN IF NOT EXISTS bay_number INT NOT NULL DEFAULT 1
  CHECK (bay_number BETWEEN 1 AND 6);

-- Reconcile slot uniqueness constraint to include bay_number
DO $$
BEGIN
  -- Drop legacy constraint if present
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_fixture_shelf_position'
      AND table_name = 'store_fixture_placements'
  ) THEN
    ALTER TABLE public.store_fixture_placements
      DROP CONSTRAINT uq_fixture_shelf_position;
  END IF;

  -- Re-add multi-bay aware uniqueness constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_fixture_bay_shelf_slot'
      AND table_name = 'store_fixture_placements'
  ) THEN
    ALTER TABLE public.store_fixture_placements
      ADD CONSTRAINT uq_fixture_bay_shelf_slot
      UNIQUE (store_fixture_id, bay_number, shelf_level, position_slot);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. SUPPORTING PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_store_fixtures_store_id
  ON public.store_fixtures(store_id);

CREATE INDEX IF NOT EXISTS idx_store_fixtures_company_id
  ON public.store_fixtures(company_id);

CREATE INDEX IF NOT EXISTS idx_store_fixtures_status
  ON public.store_fixtures(operational_status);

CREATE INDEX IF NOT EXISTS idx_store_fixture_placements_fixture
  ON public.store_fixture_placements(store_fixture_id);

CREATE INDEX IF NOT EXISTS idx_store_fixture_placements_product
  ON public.store_fixture_placements(product_id);

CREATE INDEX IF NOT EXISTS idx_store_fixture_placements_store
  ON public.store_fixture_placements(store_id);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & MULTI-TENANT ACCESS CONTROL
-- ------------------------------------------------------------------------------
ALTER TABLE public.store_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_fixtures FORCE ROW LEVEL SECURITY;

ALTER TABLE public.store_fixture_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_fixture_placements FORCE ROW LEVEL SECURITY;

-- A. store_fixtures Policies
DROP POLICY IF EXISTS "store_fixtures_admin_all" ON public.store_fixtures;
CREATE POLICY "store_fixtures_admin_all"
  ON public.store_fixtures
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "store_fixtures_retailer_select" ON public.store_fixtures;
CREATE POLICY "store_fixtures_retailer_select"
  ON public.store_fixtures
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_company_id()
    OR store_id IN (
      SELECT id FROM public.stores
      WHERE company_id = public.auth_company_id()
    )
  );

-- B. store_fixture_placements Policies
DROP POLICY IF EXISTS "store_fixture_placements_admin_all" ON public.store_fixture_placements;
CREATE POLICY "store_fixture_placements_admin_all"
  ON public.store_fixture_placements
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "store_fixture_placements_retailer_select" ON public.store_fixture_placements;
CREATE POLICY "store_fixture_placements_retailer_select"
  ON public.store_fixture_placements
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores
      WHERE company_id = public.auth_company_id()
    )
    OR store_fixture_id IN (
      SELECT id FROM public.store_fixtures
      WHERE company_id = public.auth_company_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 5. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
