-- ============================================================================
-- Migration: 0202_ksn_compliance_v1_retire_legacy_attributes.sql
-- Project: KSN-COMPLIANCE-V1 (KSN-CMP-010 Stage C — Post-Cutover Retirement)
-- Prerequisite:
--   1. 0200_ksn_compliance_v1_foundation.sql applied and verified
--   2. 0201_ksn_compliance_v1_data_migration.sql applied and verified
--   3. New application rebuilt and deployed with NEXT_PUBLIC_COMPLIANCE_V1_ENABLED=true
--      and verified serving the Regulatory & Compliance workspace live.
-- Safety:
--   - Soft-retires ONLY public.attributes.is_active = false for the 4 relocated codes.
--   - ZERO DELETE / ZERO DROP; all historical public.product_attribute_values rows
--     remain 100% intact for audit and instant non-destructive rollback.
-- ============================================================================

begin;

update public.attributes
set is_active = false
where code in ('FDA_STATUS', 'MOCRA_STATUS', 'OTC_STATUS', 'DRUG_FACTS_STATUS')
  and is_active = true;

commit;
