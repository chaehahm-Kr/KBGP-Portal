-- Migration: 0195_enable_marketing_campaigns_live_mode.sql
-- Task: ADM-EMAIL-APP-008
-- Description: Drop hardcoded live_mode_disabled check constraint from marketing_campaigns
--              to allow controlled, persistent per-campaign LIVE mode activation.

-- 1. Drop the check constraint that forced is_live_mode_enabled = false
ALTER TABLE public.marketing_campaigns 
  DROP CONSTRAINT IF EXISTS chk_marketing_campaigns_live_mode_disabled;

-- 2. Ensure default remains false for strict fail-safe security
ALTER TABLE public.marketing_campaigns 
  ALTER COLUMN is_live_mode_enabled SET DEFAULT false;

-- 3. Document column
COMMENT ON COLUMN public.marketing_campaigns.is_live_mode_enabled IS 
  'Flag indicating whether this approved campaign is authorized for real email delivery (LIVE mode). Managed via explicit admin activation.';
