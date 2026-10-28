-- Migration: 0190_brand_sourcing_primary_categories.sql
-- Task ID: ADM-BSRC-011
-- Task Name: Product Category Classification & Brand List UI Optimization
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24, Rule 27
-- Mode: Safe forward idempotent additive migration. No destructive alters, no table drops.

-- ------------------------------------------------------------------------------
-- 1. EXTEND TABLE: sourcing_companies
-- Add primary_product_categories array and confirmation flag
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_companies'
      AND column_name = 'primary_product_categories'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN primary_product_categories TEXT[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sourcing_companies'
      AND column_name = 'primary_categories_confirmed'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD COLUMN primary_categories_confirmed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Enforce valid category taxonomy on primary_product_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_sourcing_companies_primary_categories'
  ) THEN
    ALTER TABLE public.sourcing_companies
      ADD CONSTRAINT chk_sourcing_companies_primary_categories
      CHECK (
        primary_product_categories <@ ARRAY[
          'SKINCARE',
          'HAIRCARE',
          'MAKEUP',
          'BODYCARE',
          'PERSONAL_CARE',
          'BEAUTY_TOOLS'
        ]::TEXT[]
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. GIN INDEX FOR FAST ARRAY SEARCH & FILTERING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sourcing_companies_primary_categories
  ON public.sourcing_companies USING GIN (primary_product_categories);

-- ------------------------------------------------------------------------------
-- 3. SAFE INITIAL BACKFILL FOR EXISTING CANDIDATES
-- Recommends categories from existing raw category text in raw_payload_snapshot
-- and sourcing_brands. Keeps primary_categories_confirmed = false.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_cats TEXT[];
  v_raw TEXT;
BEGIN
  FOR r IN
    SELECT sc.id,
           coalesce(sc.raw_payload_snapshot->>'categories', '') AS raw_snap_cats,
           coalesce(string_agg(sb.categories::text, ' '), '') AS brand_cats
    FROM public.sourcing_companies sc
    LEFT JOIN public.sourcing_brands sb ON sb.company_id = sc.id
    WHERE sc.primary_product_categories = '{}' OR sc.primary_product_categories IS NULL
    GROUP BY sc.id, sc.raw_payload_snapshot
  LOOP
    v_raw := lower(r.raw_snap_cats || ' ' || r.brand_cats);
    v_cats := '{}';

    -- 1. Skincare (스킨케어)
    IF v_raw ~* '(skin|derma|mask|facial|serum|cream|cosmeceutical|스킨|마스크|크림|세럼|앰플)' THEN
      v_cats := array_append(v_cats, 'SKINCARE');
    END IF;

    -- 2. Haircare (헤어케어)
    IF v_raw ~* '(hair|scalp|shampoo|헤어|두피|샴푸|트리트먼트)' THEN
      v_cats := array_append(v_cats, 'HAIRCARE');
    END IF;

    -- 3. Makeup (메이크업)
    IF v_raw ~* '(make\s*up|color|lip|cushion|foundation|eye|메이크업|색조|립|쿠션)' THEN
      v_cats := array_append(v_cats, 'MAKEUP');
    END IF;

    -- 4. Bodycare (바디케어)
    IF v_raw ~* '(body|바디|샤워|scrub)' THEN
      v_cats := array_append(v_cats, 'BODYCARE');
    END IF;

    -- 5. Personal Care (퍼스널케어)
    IF v_raw ~* '(personal\s*care|oral|hand|foot|퍼스널|구강|청결제|핸드)' THEN
      v_cats := array_append(v_cats, 'PERSONAL_CARE');
    END IF;

    -- 6. Beauty Tools (뷰티툴)
    IF v_raw ~* '(tool|device|brush|puff|뷰티툴|미용기기|브러쉬|퍼프)' THEN
      v_cats := array_append(v_cats, 'BEAUTY_TOOLS');
    END IF;

    IF array_length(v_cats, 1) > 0 THEN
      UPDATE public.sourcing_companies
      SET primary_product_categories = v_cats,
          primary_categories_confirmed = false
      WHERE id = r.id
        AND (primary_product_categories = '{}' OR primary_product_categories IS NULL);
    END IF;
  END LOOP;
END $$;
