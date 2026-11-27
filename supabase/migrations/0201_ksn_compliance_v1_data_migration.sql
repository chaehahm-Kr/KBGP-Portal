-- ============================================================================
-- Migration: 0201_ksn_compliance_v1_data_migration.sql
-- Project: KSN-COMPLIANCE-V1 (KSN-CMP-010 Stage B — Additive Data Migration)
-- Prerequisite: 0200_ksn_compliance_v1_foundation.sql MUST be applied first.
-- Safety:
--   - 100% IDEMPOTENT and NON-DESTRUCTIVE (zero DELETE, zero DROP).
--   - Safe to execute while the legacy Production app (or Gate-OFF app) is active.
--   - Uses actual Production soft-delete structure (price_additional_info->>'deleted_at').
--   - Guards all admin_overrides numeric casts against non-numeric strings.
--   - Does NOT retire the 4 legacy attributes in public.attributes (handled in 0202).
-- ============================================================================

begin;

with effective_products as (
  select
    p.id,
    p.brand_id,
    p.category_code,
    nullif(btrim(coalesce(p.price_additional_info->>'deleted_at', '')), '') as eff_deleted_at,
    coalesce(
      nullif(btrim(coalesce(p.price_additional_info->'admin_overrides'->>'manufacture_sku', '')), ''),
      nullif(btrim(coalesce(p.manufacture_sku, '')), '')
    ) as eff_sku,
    coalesce(
      nullif(btrim(coalesce(p.price_additional_info->'admin_overrides'->>'name_en', '')), ''),
      nullif(btrim(coalesce(p.name_en, '')), '')
    ) as eff_name_en,
    coalesce(
      nullif(btrim(coalesce(p.price_additional_info->'admin_overrides'->>'origin', '')), ''),
      nullif(btrim(coalesce(p.origin, '')), '')
    ) as eff_origin,
    coalesce(
      nullif(btrim(coalesce(p.price_additional_info->'admin_overrides'->>'how_to_use', '')), ''),
      nullif(btrim(coalesce(p.how_to_use, '')), '')
    ) as eff_how_to_use,
    coalesce(
      nullif(btrim(coalesce(p.price_additional_info->'admin_overrides'->>'upc', '')), ''),
      nullif(btrim(coalesce(p.upc, '')), '')
    ) as eff_upc,
    coalesce(
      nullif(btrim(coalesce(p.price_additional_info->'admin_overrides'->>'ean', '')), ''),
      nullif(btrim(coalesce(p.ean, '')), '')
    ) as eff_ean,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'price_krw_retail', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'price_krw_retail')::numeric end,
      p.price_krw_retail, 0
    ) as eff_price_krw,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'price_usd_fob', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'price_usd_fob')::numeric end,
      p.price_usd_fob, 0
    ) as eff_price_usd,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'item_width', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'item_width')::numeric end,
      p.item_width, 0
    ) as eff_item_w,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'item_depth', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'item_depth')::numeric end,
      p.item_depth, 0
    ) as eff_item_d,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'item_height', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'item_height')::numeric end,
      p.item_height, 0
    ) as eff_item_h,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'item_weight', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'item_weight')::numeric end,
      p.item_weight, 0
    ) as eff_item_wt,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'package_width', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'package_width')::numeric end,
      p.package_width, 0
    ) as eff_pkg_w,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'package_depth', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'package_depth')::numeric end,
      p.package_depth, 0
    ) as eff_pkg_d,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'package_height', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'package_height')::numeric end,
      p.package_height, 0
    ) as eff_pkg_h,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'package_weight', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'package_weight')::numeric end,
      p.package_weight, 0
    ) as eff_pkg_wt,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'carton_pack_qty', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'carton_pack_qty')::numeric end,
      p.carton_pack_qty, 0
    ) as eff_carton_qty,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'carton_width', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'carton_width')::numeric end,
      p.carton_width, 0
    ) as eff_carton_w,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'carton_depth', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'carton_depth')::numeric end,
      p.carton_depth, 0
    ) as eff_carton_d,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'carton_height', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'carton_height')::numeric end,
      p.carton_height, 0
    ) as eff_carton_h,
    coalesce(
      case when btrim(coalesce(p.price_additional_info->'admin_overrides'->>'carton_weight', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        then btrim(p.price_additional_info->'admin_overrides'->>'carton_weight')::numeric end,
      p.carton_weight, 0
    ) as eff_carton_wt
  from public.products p
  where p.compliance_facility_grandfathered = false
)
update public.products p
set compliance_facility_grandfathered = true
from effective_products ep
where p.id = ep.id
  and ep.eff_deleted_at is null
  and ep.brand_id is not null
  and ep.eff_sku is not null
  and upper(ep.eff_sku) not like 'DRAFT-SKU-%'
  and ep.eff_name_en is not null
  and upper(ep.eff_name_en) not like '[DRAFT]%'
  and ep.eff_origin is not null
  and ep.eff_how_to_use is not null
  and (
    coalesce(ep.eff_upc, '') ~ '^[0-9]{12}$'
    or coalesce(ep.eff_ean, '') ~ '^[0-9]{13}$'
  )
  and ep.eff_price_krw > 0
  and ep.eff_price_usd > 0
  and ep.eff_item_w > 0
  and ep.eff_item_d > 0
  and ep.eff_item_h > 0
  and ep.eff_item_wt > 0
  and ep.eff_pkg_w > 0
  and ep.eff_pkg_d > 0
  and ep.eff_pkg_h > 0
  and ep.eff_pkg_wt > 0
  and ep.eff_carton_qty > 0
  and ep.eff_carton_w > 0
  and ep.eff_carton_d > 0
  and ep.eff_carton_h > 0
  and ep.eff_carton_wt > 0
  and exists (
    select 1
    from public.categories c
    where c.code = ep.category_code
      and c.is_active = true
      and c.is_final = true
  )
  and exists (
    select 1
    from public.product_images pi
    where pi.product_id = ep.id
  );

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
    'migrationSource', '0201_ksn_compliance_v1_data_migration',
    'reviewWarnings', to_jsonb(array_remove(array[
      case when upper(coalesce(lp.otc_val, '')) in ('NOT_OTC', 'NO', 'NOT_APPLICABLE')
        then 'Legacy OTC_STATUS=NOT_OTC mapped to otc_applicability=NOT_APPLICABLE; US classification left UNDETERMINED for explicit review.' end,
      case when upper(coalesce(lp.otc_val, '')) in ('OTC', 'YES', 'APPLICABLE')
        then 'Legacy OTC_STATUS indicates OTC applicability; confirm OTC_DRUG vs COSMETIC_OTC_DUAL and NDC listing.' end,
      case when lp.mocra_val is not null and upper(lp.mocra_val) not in ('UNKNOWN', 'NOT_REVIEWED')
        then 'Ambiguous legacy MOCRA_STATUS="' || lp.mocra_val || '" preserved in snapshot; confirm MoCRA listing status & listing number.' end,
      case when lp.drug_facts_val is not null and upper(lp.drug_facts_val) not in ('NOT_REVIEWED', 'READY', 'DRAFT')
        and not (upper(lp.drug_facts_val) = 'NOT_APPLICABLE' and upper(coalesce(lp.otc_val, '')) in ('NOT_OTC', 'NO', 'NOT_APPLICABLE'))
        then 'Ambiguous legacy DRUG_FACTS_STATUS="' || lp.drug_facts_val || '" preserved for manual review.' end,
      case when lp.fda_val is not null
        then 'Original legacy FDA_STATUS="' || lp.fda_val || '" preserved verbatim in fda_legacy_status.' end
    ], null))
  ) as legacy_migration_snapshot,
  'UNREVIEWED' as verification_status,
  'NOT_EVALUATED' as import_readiness_status,
  now(),
  now()
from legacy_pivot lp
on conflict (product_id) do nothing;

commit;
