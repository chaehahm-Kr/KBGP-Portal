-- Migration 0198: Normalize TARGET_GENDER and USAGE_FREQUENCY from MULTI_SELECT to SINGLE_SELECT
-- Task ID: BRAND-PRODUCT-BULK-002-R4
-- Governance: DEV-SQL-MIGRATION-STD-001 (Non-destructive, lossless 1-element array unwrap, strict multi-value guard, idempotent on scalar NA/string rows)

BEGIN;

-- 1. Safety Guard: Abort immediately if any product holds > 1 selected values for TARGET_GENDER or USAGE_FREQUENCY.
--    Uses CASE WHEN jsonb_typeof(value_json) = 'array' so PostgreSQL never calls jsonb_array_length() on scalar JSON strings (e.g. "NA").
DO $$
DECLARE
  v_conflict_count integer;
  v_conflict_sample text;
BEGIN
  SELECT
    count(*),
    string_agg(product_id::text || ':' || attribute_code || '=' || value_json::text, '; ')
  INTO v_conflict_count, v_conflict_sample
  FROM public.product_attribute_values
  WHERE attribute_code IN ('TARGET_GENDER', 'USAGE_FREQUENCY')
    AND (CASE WHEN jsonb_typeof(value_json) = 'array' THEN jsonb_array_length(value_json) ELSE -1 END) > 1;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION
      '[0198 ABORT] Found % product_attribute_values row(s) with multiple selected options for TARGET_GENDER/USAGE_FREQUENCY. Resolve before converting to SINGLE_SELECT: %',
      v_conflict_count,
      left(coalesce(v_conflict_sample, ''), 500);
  END IF;
END $$;

-- 2. Clean up empty JSON array rows (length = 0), matching saveProductAttributeValues empty-value semantics.
DELETE FROM public.product_attribute_values
WHERE attribute_code IN ('TARGET_GENDER', 'USAGE_FREQUENCY')
  AND (CASE WHEN jsonb_typeof(value_json) = 'array' THEN jsonb_array_length(value_json) ELSE -1 END) = 0
  AND (text_value IS NULL OR btrim(text_value) = '');

-- 3. Losslessly unwrap 1-element JSON arrays (e.g., ["UNISEX"] -> "UNISEX", ["DAILY"] -> "DAILY")
--    into canonical SINGLE_SELECT JSON scalar strings while preserving existing scalar strings (e.g., "NA") and text_value intact.
UPDATE public.product_attribute_values
SET value_json = value_json->0,
    updated_at = now()
WHERE attribute_code IN ('TARGET_GENDER', 'USAGE_FREQUENCY')
  AND (CASE WHEN jsonb_typeof(value_json) = 'array' THEN jsonb_array_length(value_json) ELSE -1 END) = 1;

-- 4. Update authoritative attribute metadata to SINGLE_SELECT (is_multiple = false).
UPDATE public.attributes
SET input_type = 'SINGLE_SELECT',
    is_multiple = false
WHERE scope = 'COMMON'
  AND code IN ('TARGET_GENDER', 'USAGE_FREQUENCY')
  AND (input_type <> 'SINGLE_SELECT' OR is_multiple <> false);

-- 5. Post-migration integrity verification inside the same transaction.
DO $$
DECLARE
  v_remaining_arrays integer;
  v_remaining_multi_meta integer;
BEGIN
  SELECT count(*)
  INTO v_remaining_arrays
  FROM public.product_attribute_values
  WHERE attribute_code IN ('TARGET_GENDER', 'USAGE_FREQUENCY')
    AND jsonb_typeof(value_json) = 'array';

  IF v_remaining_arrays > 0 THEN
    RAISE EXCEPTION '[0198 VERIFY FAILED] % array value_json row(s) still remain for TARGET_GENDER/USAGE_FREQUENCY.', v_remaining_arrays;
  END IF;

  SELECT count(*)
  INTO v_remaining_multi_meta
  FROM public.attributes
  WHERE scope = 'COMMON'
    AND code IN ('TARGET_GENDER', 'USAGE_FREQUENCY')
    AND (input_type <> 'SINGLE_SELECT' OR is_multiple <> false);

  IF v_remaining_multi_meta > 0 THEN
    RAISE EXCEPTION '[0198 VERIFY FAILED] attributes metadata for TARGET_GENDER/USAGE_FREQUENCY did not converge to SINGLE_SELECT / is_multiple=false.';
  END IF;
END $$;

COMMIT;
