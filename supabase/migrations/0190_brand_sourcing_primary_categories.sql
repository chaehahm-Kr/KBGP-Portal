-- Migration: 0190_brand_sourcing_primary_categories.sql
-- Task ID: ADM-BSRC-011 / ADM-BSRC-011-R1
-- Task Name: SQL 0190 Safety Fix & Category Classification QA
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 24, Rule 27
-- Mode: Safe forward idempotent additive migration. No destructive alters, no table drops.

-- ------------------------------------------------------------------------------
-- 1. EXTEND TABLE: sourcing_companies
-- Add primary_product_categories array and confirmation flag with repeat-safe checks
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
-- 
-- SAFETY GUARDS (ADM-BSRC-011-R1):
-- - Never overwrites existing category selections.
-- - Never touches rows where primary_categories_confirmed = true (preserves intentionally empty confirmed values).
-- - Double guarded in both SELECT cursor and UPDATE statement.
-- - Avoids broad/ambiguous false positive keywords (bare eye, color, cream, hand, body, tool).
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
    WHERE (sc.primary_product_categories = '{}' OR sc.primary_product_categories IS NULL)
      AND (sc.primary_categories_confirmed = false OR sc.primary_categories_confirmed IS NULL)
    GROUP BY sc.id, sc.raw_payload_snapshot
  LOOP
    v_raw := lower(r.raw_snap_cats || ' ' || r.brand_cats);
    v_cats := '{}';

    -- 1. Skincare (스킨케어)
    -- High precision: skincare, derma, serum, ampoule, toner, facial mask, eye cream, moisture/nourishing cream
    -- Avoid bare 'cream' or '크림' to prevent matching hand cream, body cream, foot cream, or bb cream.
    IF v_raw ~* '(\y(skincare|skin\s*care|derma|serum|ampoule|toner|essence|facial\s*mask|sheet\s*mask|cleanser|cleansing|sunscreen|sun\s*cream|sun\s*care|eye\s*cream|moisturizer|moisturizing\s*cream|water\s*cream|hydrating\s*cream|nourishing\s*cream)\y|스킨케어|기초|세럼|앰플|토너|스킨|에멀전|에센스|수분크림|영양크림|탄력크림|재생크림|아이크림|마스크팩|시트마스크|클렌징|선크림|선케어)' THEN
      v_cats := array_append(v_cats, 'SKINCARE');
    END IF;

    -- 2. Haircare (헤어케어)
    -- High precision: haircare, scalp, shampoo, conditioner, hair treatment, hair oil/serum
    IF v_raw ~* '(\y(haircare|hair\s*care|scalp|scalp\s*care|shampoo|conditioner|hair\s*treatment|hair\s*oil|hair\s*serum|hair\s*mask|hair\s*tonic)\y|헤어케어|헤어|두피케어|두피|샴푸|컨디셔너|린스|트리트먼트|헤어팩|모발|탈모)' THEN
      v_cats := array_append(v_cats, 'HAIRCARE');
    END IF;

    -- 3. Makeup (메이크업)
    -- High precision: makeup, color cosmetics, lipstick, lip tint, lip gloss, foundation, cushion, bb/cc cream, mascara, eyeliner, eyeshadow, blusher
    -- Avoid bare 'color' (matches hair color) and bare 'eye' (matches eye cream) and bare 'lip' (substrings).
    IF v_raw ~* '(\y(makeup|make-up|color\s*cosmetics?|color\s*makeup|lipstick|lip\s*tint|lip\s*gloss|lip\s*balm|foundation|cushion|cushion\s*compact|bb\s*cream|cc\s*cream|concealer|mascara|eyeliner|eyeshadow|blusher|blush|highlighter)\y|메이크업|색조|색조화장|립스틱|립틴트|립글로스|립밤|파운데이션|쿠션|비비크림|컨실러|마스카라|아이라이너|아이섀도우|블러셔|하이라이터)' THEN
      v_cats := array_append(v_cats, 'MAKEUP');
    END IF;

    -- 4. Bodycare (바디케어)
    -- High precision: bodycare, body wash, body lotion, body cream, body oil, body scrub, shower gel
    -- Avoid bare 'body' (general words) and bare 'scrub' (facial scrub).
    IF v_raw ~* '(\y(bodycare|body\s*care|body\s*wash|body\s*lotion|body\s*cream|body\s*oil|body\s*scrub|body\s*mist|shower\s*gel|bath\s*salt)\y|바디케어|바디워시|바디로션|바디크림|바디오일|바디스크럽|샤워젤|입욕제)' THEN
      v_cats := array_append(v_cats, 'BODYCARE');
    END IF;

    -- 5. Personal Care (퍼스널케어)
    -- High precision: personal care, oral care, toothpaste, mouthwash, feminine wash, hand cream, hand wash, foot cream, foot care, deodorant
    -- Avoid bare 'hand' (matches handmade) and bare 'foot' (matches football) and bare 'oral' (matches oral presentation).
    IF v_raw ~* '(\y(personal\s*care|oral\s*care|toothpaste|mouthwash|toothbrush|feminine\s*wash|feminine\s*care|hand\s*cream|hand\s*wash|hand\s*lotion|hand\s*care|foot\s*cream|foot\s*care|foot\s*mask|deodorant|intimate\s*wash)\y|퍼스널케어|구강케어|구강청결|치약|칫솔|가글|여성청결제|여성케어|핸드크림|핸드워시|핸드로션|핸드케어|풋크림|풋케어|풋마스크|데오드란트)' THEN
      v_cats := array_append(v_cats, 'PERSONAL_CARE');
    END IF;

    -- 6. Beauty Tools (뷰티툴)
    -- High precision: beauty tool, beauty device, makeup brush, cosmetic brush, powder puff, makeup sponge, guasha, facial roller, eyelash curler
    -- Avoid bare 'tool' (matches dev tool) and bare 'device' (matches mobile device).
    IF v_raw ~* '(\y(beauty\s*tools?|beauty\s*devices?|makeup\s*brush(es)?|cosmetic\s*brush(es)?|powder\s*puff|makeup\s*sponge|facial\s*roller|guasha|galvanic|eyelash\s*curler|cleansing\s*device)\y|뷰티툴|미용기기|미용소품|메이크업브러쉬|브러쉬|퍼프|스펀지|괄사|갈바닉|마사지기|뷰러)' THEN
      v_cats := array_append(v_cats, 'BEAUTY_TOOLS');
    END IF;

    IF array_length(v_cats, 1) > 0 THEN
      UPDATE public.sourcing_companies
      SET primary_product_categories = v_cats,
          primary_categories_confirmed = false
      WHERE id = r.id
        AND (primary_product_categories = '{}' OR primary_product_categories IS NULL)
        AND (primary_categories_confirmed = false OR primary_categories_confirmed IS NULL);
    END IF;
  END LOOP;
END $$;
