-- ============================================================================
-- Migration: 0201_ksn_compliance_v1_data_migration.sql
-- Project: KSN-COMPLIANCE-V1 (KSN-CMP-010 Stage B — Cutover Data Migration)
-- Prerequisite: 0200_ksn_compliance_v1_foundation.sql MUST be applied first.
-- Safety: 100% IDEMPOTENT, NON-DESTRUCTIVE (zero DELETE, zero DROP).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Selective Grandfathering for Pre-Cutover COMPLETE Products ONLY
--    Sets compliance_facility_grandfathered = true ONLY for non-deleted
--    products that already satisfy pre-cutover COMPLETE registration criteria
--    (basic info, 2Depth+ category, pricing, logistics, barcode, and >= 1 image).
--    DRAFT products remain compliance_facility_grandfathered = false.
-- ----------------------------------------------------------------------------
update public.products p
set compliance_facility_grandfathered = true
where p.deleted_at is null
  and p.compliance_facility_grandfathered = false
  and p.brand_id is not null
  and nullif(btrim(coalesce(p.manufacture_sku, '')), '') is not null
  and upper(btrim(p.manufacture_sku)) not like 'DRAFT-SKU-%'
  and nullif(btrim(coalesce(p.name_en, '')), '') is not null
  and upper(btrim(p.name_en)) not like '[DRAFT]%'
  and nullif(btrim(coalesce(p.origin, '')), '') is not null
  and nullif(btrim(coalesce(p.how_to_use, '')), '') is not null
  and (
    nullif(btrim(coalesce(p.upc, '')), '') is not null
    or nullif(btrim(coalesce(p.ean, '')), '') is not null
  )
  and coalesce(p.price_krw_retail, 0) > 0
  and coalesce(p.price_usd_fob, 0) > 0
  and coalesce(p.item_width, 0) > 0
  and coalesce(p.item_depth, 0) > 0
  and coalesce(p.item_height, 0) > 0
  and coalesce(p.item_weight, 0) > 0
  and coalesce(p.package_width, 0) > 0
  and coalesce(p.package_depth, 0) > 0
  and coalesce(p.package_height, 0) > 0
  and coalesce(p.package_weight, 0) > 0
  and coalesce(p.carton_pack_qty, 0) > 0
  and coalesce(p.carton_width, 0) > 0
  and coalesce(p.carton_depth, 0) > 0
  and coalesce(p.carton_height, 0) > 0
  and coalesce(p.carton_weight, 0) > 0
  and exists (
    select 1
    from public.categories c
    where c.code = p.category_code
      and c.depth >= 2
  )
  and exists (
    select 1
    from public.product_images pi
    where pi.product_id = p.id
  );

-- ----------------------------------------------------------------------------
-- 2. Lossless Migration of Legacy Regulatory Attributes -> product_regulatory_compliance
--    Reads FDA_STATUS, MOCRA_STATUS, OTC_STATUS, DRUG_FACTS_STATUS from
--    public.product_attribute_values without deleting or modifying any source rows.
--    Conservative mapping:
--      - us_classification always starts as 'UNDETERMINED' for explicit review
--      - NOT_OTC -> otc_applicability='NOT_APPLICABLE', otc_listing_status='NOT_APPLICABLE'
--      - OTC / YES / APPLICABLE -> otc_applicability='APPLICABLE'
--      - DRUG_FACTS_STATUS READY/DRAFT/NOT_APPLICABLE mapped conservatively (never VERIFIED)
--      - Exact FDA_STATUS preserved in fda_legacy_status
--      - All 4 raw legacy values preserved in legacy_migration_snapshot JSONB
-- ----------------------------------------------------------------------------
with legacy_pivot as (
  select
    pav.product_id,
    p.company_id,
    max(case when pav.attribute_code = 'FDA_STATUS'
      then nullif(btrim(coalesce(pav.text_value, trim(both '"' from pav.value_json::text))), '') end) as fda_val,
    max(case when pav.attribute_code = 'MOCRA_STATUS'
      then nullif(btrim(coalesce(pav.text_value, trim(both '"' from pav.value_json::text))), '') end) as mocra_val,
    max(case when pav.attribute_code = 'OTC_STATUS'
      then nullif(btrim(coalesce(pav.text_value, trim(both '"' from pav.value_json::text))), '') end) as otc_val,
    max(case when pav.attribute_code = 'DRUG_FACTS_STATUS'
      then nullif(btrim(coalesce(pav.text_value, trim(both '"' from pav.value_json::text))), '') end) as drug_facts_val
  from public.product_attribute_values pav
  join public.products p on p.id = pav.product_id
  where pav.attribute_code in ('FDA_STATUS', 'MOCRA_STATUS', 'OTC_STATUS', 'DRUG_FACTS_STATUS')
  group by pav.product_id, p.company_id
)
insert into public.product_regulatory_compliance (
  product_id,
  company_id,
  us_classification,
  otc_applicability,
  mocra_listing_status,
  otc_listing_status,
  drug_facts_status,
  fda_legacy_status,
  legacy_migration_snapshot,
  verification_status,
  import_readiness_status,
  created_at,
  updated_at
)
select
  lp.product_id,
  lp.company_id,
  'UNDETERMINED' as us_classification,
  case
    when upper(coalesce(lp.otc_val, '')) in ('NOT_OTC', 'NO', 'NOT_APPLICABLE') then 'NOT_APPLICABLE'
    when upper(coalesce(lp.otc_val, '')) in ('OTC', 'YES', 'APPLICABLE') then 'APPLICABLE'
    else 'UNKNOWN'
  end as otc_applicability,
  'UNKNOWN' as mocra_listing_status,
  case
    when upper(coalesce(lp.otc_val, '')) in ('NOT_OTC', 'NO', 'NOT_APPLICABLE') then 'NOT_APPLICABLE'
    else 'UNKNOWN'
  end as otc_listing_status,
  case
    when upper(coalesce(lp.drug_facts_val, '')) = 'NOT_APPLICABLE'
      and upper(coalesce(lp.otc_val, '')) in ('NOT_OTC', 'NO', 'NOT_APPLICABLE') then 'NOT_APPLICABLE'
    when upper(coalesce(lp.drug_facts_val, '')) = 'READY' then 'READY'
    when upper(coalesce(lp.drug_facts_val, '')) = 'DRAFT' then 'DRAFT'
    else 'UNKNOWN'
  end as drug_facts_status,
  lp.fda_val as fda_legacy_status,
  jsonb_build_object(
    'fdaStatus', lp.fda_val,
    'mocraStatus', lp.mocra_val,
    'otcStatus', lp.otc_val,
    'drugFactsStatus', lp.drug_facts_val,
    'migratedAt', now(),
    'migrationSource', '0201_ksn_compliance_v1_data_migration'
  ) as legacy_migration_snapshot,
  'UNREVIEWED' as verification_status,
  'NOT_EVALUATED' as import_readiness_status,
  now(),
  now()
from legacy_pivot lp
on conflict (product_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Soft-Retire Legacy Regulatory Attributes from Category & Attributes
--    Preserves all historical product_attribute_values rows untouched.
--    Only executed during approved Stage B cutover.
-- ----------------------------------------------------------------------------
update public.attributes
set is_active = false
where code in ('FDA_STATUS', 'MOCRA_STATUS', 'OTC_STATUS', 'DRUG_FACTS_STATUS')
  and is_active = true;

commit;
