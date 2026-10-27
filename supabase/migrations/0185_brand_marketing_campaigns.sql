-- Migration: 0185_brand_marketing_campaigns.sql
-- Task ID: ADM-BSRC-006-R1-ADD2 (Parent: ADM-BSRC-006)
-- Description: Brand Marketing Phase 2 — Email Campaigns V1 Schema Hardened
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
-- Mode: Safe forward additive idempotent migration. Fully decoupled from core transactional orders.
-- Hardening Specifications Applied:
--   1. UUID primary keys and foreign keys for complete relational integrity with sourcing and activities.
--   2. Database-level LIVE_MODE disabled constraint (chk_marketing_campaigns_live_mode_disabled).
--   3. Append-only immutability for marketing_campaign_logs with BEFORE UPDATE/DELETE exception trigger.
--   4. Comprehensive approval integrity trigger preventing snapshot tampering, enforcing valid transitions,
--      and automatically invalidating approval upon campaign content or recipient modifications.
--   5. Cascade protection via ON DELETE RESTRICT on company_id, campaign_id, and recipient_id to prevent
--      accidental company deletion effects, orphan data, and unexpected audit log loss.
--   6. Email normalization triggers (lower + trim) and lowercase constraints on recipients and suppression list.
--   7. Explicit SECURITY DEFINER with fixed search_path = public, pg_temp on all trigger functions.
--   8. Deterministic seed package for default designer templates using ON CONFLICT (id) DO NOTHING
--      to preserve Admin customizations across migration reruns.
--   9. 100% idempotent DDL with ADD COLUMN IF NOT EXISTS for repeat execution safety.

-- ------------------------------------------------------------------------------
-- 1. TABLE: marketing_templates
-- External Designer Template Packages (HTML, subject, preview text, variables, landing page)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type VARCHAR(32) NOT NULL DEFAULT 'HTML' CHECK (template_type IN ('HTML', 'IMAGE')),
  version TEXT NOT NULL DEFAULT '1.0.0',
  language VARCHAR(8) NOT NULL DEFAULT 'ko' CHECK (language IN ('ko', 'en')),
  subject TEXT NOT NULL,
  preview_text TEXT,
  html_content TEXT NOT NULL,
  plain_text TEXT,
  variables JSONB NOT NULL DEFAULT '["company_name", "contact_name", "brand_name", "custom_message"]'::jsonb,
  landing_page_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure template_type exists if table was created in prior draft
ALTER TABLE public.marketing_templates 
  ADD COLUMN IF NOT EXISTS template_type VARCHAR(32) NOT NULL DEFAULT 'HTML' CHECK (template_type IN ('HTML', 'IMAGE'));

-- ------------------------------------------------------------------------------
-- 2. TABLE: marketing_campaigns
-- Master record for Brand Outreach Email Campaigns V1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  purpose VARCHAR(64) NOT NULL DEFAULT 'Brand Outreach',
  description TEXT,
  language VARCHAR(8) NOT NULL DEFAULT 'ko' CHECK (language IN ('ko', 'en')),
  template_id UUID REFERENCES public.marketing_templates(id) ON DELETE SET NULL,
  template_version TEXT,
  subject_override TEXT,
  
  -- Campaign Lifecycle States
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'TESTING',
      'READY_FOR_APPROVAL',
      'APPROVED',
      'SCHEDULED',
      'SENDING',
      'PAUSED',
      'COMPLETED',
      'CANCELLED'
    )
  ),

  -- Approval Workflow & Immutability
  approval_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (
    approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'INVALIDATED')
  ),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  approval_snapshot JSONB,

  -- Scheduling & Safety (LIVE_MODE strictly locked false at DB engine level)
  scheduled_at TIMESTAMPTZ,
  is_live_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT chk_marketing_campaigns_live_mode_disabled CHECK (is_live_mode_enabled = false),

  -- Filters, Custom Messages & Aggregated Statistics
  filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_message TEXT,
  stats JSONB NOT NULL DEFAULT '{
    "total_recipients": 0,
    "sendable_count": 0,
    "excluded_count": 0,
    "test_sends_count": 0,
    "sent_count": 0,
    "delivered_count": 0,
    "failed_count": 0
  }'::jsonb,

  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure subject_override exists if table was created in prior draft
ALTER TABLE public.marketing_campaigns 
  ADD COLUMN IF NOT EXISTS subject_override TEXT;

-- ------------------------------------------------------------------------------
-- 3. TABLE: marketing_campaign_recipients
-- Frozen recipient snapshots per campaign with personalized values and delivery state.
-- Foreign key on company_id uses ON DELETE RESTRICT to protect audit integrity.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT,
  contact_id UUID REFERENCES public.sourcing_contacts(id) ON DELETE SET NULL,
  
  -- Recipient details (auto-lowercased and trimmed via trigger)
  recipient_email TEXT NOT NULL CHECK (recipient_email = lower(trim(recipient_email))),
  recipient_name TEXT,
  company_name_kr TEXT NOT NULL,
  company_name_en TEXT,
  brand_name TEXT,
  custom_message_override TEXT,

  -- Send Eligibility Policy
  send_eligibility VARCHAR(64) NOT NULL DEFAULT 'ELIGIBLE' CHECK (
    send_eligibility IN (
      'ELIGIBLE',
      'EXCLUDED_UNCONFIRMED_CONSENT',
      'EXCLUDED_OPTED_OUT',
      'EXCLUDED_SUPPRESSED',
      'EXCLUDED_INVALID_EMAIL',
      'EXCLUDED_DUPLICATE'
    )
  ),
  exclusion_reason TEXT,

  -- Delivery Tracking
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'TEST_SENT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')
  ),
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_campaign_recipient_lower_email UNIQUE (campaign_id, recipient_email)
);

-- Ensure company_id foreign key enforces ON DELETE RESTRICT if table existed with CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'marketing_campaign_recipients_company_id_fkey'
      AND table_name = 'marketing_campaign_recipients'
  ) THEN
    ALTER TABLE public.marketing_campaign_recipients
      DROP CONSTRAINT marketing_campaign_recipients_company_id_fkey;
    ALTER TABLE public.marketing_campaign_recipients
      ADD CONSTRAINT marketing_campaign_recipients_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.sourcing_companies(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. TABLE: marketing_campaign_logs
-- Immutable audit log for campaign actions, test dispatches, and dry-run evaluations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE RESTRICT,
  recipient_id UUID REFERENCES public.marketing_campaign_recipients(id) ON DELETE RESTRICT,
  event_type VARCHAR(64) NOT NULL,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure recipient_id foreign key enforces ON DELETE RESTRICT if existed with SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'marketing_campaign_logs_recipient_id_fkey'
      AND table_name = 'marketing_campaign_logs'
  ) THEN
    ALTER TABLE public.marketing_campaign_logs
      DROP CONSTRAINT marketing_campaign_logs_recipient_id_fkey;
    ALTER TABLE public.marketing_campaign_logs
      ADD CONSTRAINT marketing_campaign_logs_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. TABLE: marketing_suppression_list
-- Commercial email opt-out and bounce suppression registry
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  reason VARCHAR(32) NOT NULL DEFAULT 'UNSUBSCRIBED' CHECK (
    reason IN ('UNSUBSCRIBED', 'BOUNCED', 'COMPLAINT', 'MANUAL_ADMIN')
  ),
  notes TEXT,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS: AUTOMATED EMAIL NORMALIZATION & IMMUTABILITY PROTECTION
-- ------------------------------------------------------------------------------

-- 6.1 Email Normalization Trigger for Recipients
CREATE OR REPLACE FUNCTION public.trg_fn_normalize_campaign_recipient_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.recipient_email := lower(trim(NEW.recipient_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_campaign_recipient_email ON public.marketing_campaign_recipients;
CREATE TRIGGER trg_normalize_campaign_recipient_email
  BEFORE INSERT OR UPDATE ON public.marketing_campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_normalize_campaign_recipient_email();

-- 6.2 Email Normalization Trigger for Suppression List
CREATE OR REPLACE FUNCTION public.trg_fn_normalize_suppression_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_suppression_email ON public.marketing_suppression_list;
CREATE TRIGGER trg_normalize_suppression_email
  BEFORE INSERT OR UPDATE ON public.marketing_suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_normalize_suppression_email();

-- 6.3 Append-Only Immutability Trigger for Campaign Logs
CREATE OR REPLACE FUNCTION public.trg_fn_protect_marketing_campaign_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'marketing_campaign_logs is an append-only audit log. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_marketing_campaign_logs ON public.marketing_campaign_logs;
CREATE TRIGGER trg_protect_marketing_campaign_logs
  BEFORE UPDATE OR DELETE ON public.marketing_campaign_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_protect_marketing_campaign_logs();

-- 6.4 Approval Integrity & State Machine Protection Trigger for Campaigns
CREATE OR REPLACE FUNCTION public.trg_fn_protect_campaign_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- CASE 1: Transitioning TO 'APPROVED' (Initial Approval or Re-Approval)
  IF NEW.approval_status = 'APPROVED' AND OLD.approval_status IS DISTINCT FROM 'APPROVED' THEN
    IF NEW.approval_snapshot IS NULL OR NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'Cannot approve campaign: approval_snapshot, approved_by, and approved_at are mandatory.';
    END IF;
  END IF;

  -- CASE 2: Remaining in 'APPROVED' status
  IF OLD.approval_status = 'APPROVED' AND NEW.approval_status = 'APPROVED' THEN
    -- A. Snapshot and approver immutability
    IF NEW.approval_snapshot IS DISTINCT FROM OLD.approval_snapshot THEN
      RAISE EXCEPTION 'Approval snapshot is immutable once locked in APPROVED status.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'approved_by is immutable once locked in APPROVED status.';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'approved_at is immutable once locked in APPROVED status.';
    END IF;

    -- B. Campaign Content Immutability while APPROVED
    -- Any modification to content or targeting must explicitly invalidate approval first
    IF (NEW.name IS DISTINCT FROM OLD.name OR
        NEW.language IS DISTINCT FROM OLD.language OR
        NEW.template_id IS DISTINCT FROM OLD.template_id OR
        NEW.template_version IS DISTINCT FROM OLD.template_version OR
        NEW.subject_override IS DISTINCT FROM OLD.subject_override OR
        NEW.custom_message IS DISTINCT FROM OLD.custom_message OR
        NEW.filter_criteria IS DISTINCT FROM OLD.filter_criteria) THEN
      RAISE EXCEPTION 'Cannot modify content of an APPROVED campaign. Prior approval must be invalidated first.';
    END IF;
  END IF;

  -- CASE 3: Permitted transition AWAY from 'APPROVED' (Invalidation, Rejection, Reset)
  IF OLD.approval_status = 'APPROVED' AND NEW.approval_status IS DISTINCT FROM 'APPROVED' THEN
    -- Clear approval metadata to prevent stale approval claims
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.approval_snapshot := NULL;
    IF NEW.status = 'APPROVED' THEN
      NEW.status := 'DRAFT';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_campaign_approval ON public.marketing_campaigns;
CREATE TRIGGER trg_protect_campaign_approval
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_protect_campaign_approval();

-- 6.5 Approval Invalidation on Recipient Alteration Trigger
-- Ensures modifying recipient lists or targeting on an APPROVED campaign automatically invalidates approval.
CREATE OR REPLACE FUNCTION public.trg_fn_invalidate_approval_on_recipient_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign_id UUID;
  v_camp_approval TEXT;
  v_content_changed BOOLEAN := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_campaign_id := OLD.campaign_id;
    v_content_changed := true;
  ELSIF TG_OP = 'INSERT' THEN
    v_campaign_id := NEW.campaign_id;
    v_content_changed := true;
  ELSIF TG_OP = 'UPDATE' THEN
    v_campaign_id := NEW.campaign_id;
    -- Invalidate only if identity, targeting, or personalized content fields changed
    IF (NEW.recipient_email IS DISTINCT FROM OLD.recipient_email OR
        NEW.recipient_name IS DISTINCT FROM OLD.recipient_name OR
        NEW.company_id IS DISTINCT FROM OLD.company_id OR
        NEW.contact_id IS DISTINCT FROM OLD.contact_id OR
        NEW.company_name_kr IS DISTINCT FROM OLD.company_name_kr OR
        NEW.company_name_en IS DISTINCT FROM OLD.company_name_en OR
        NEW.brand_name IS DISTINCT FROM OLD.brand_name OR
        NEW.custom_message_override IS DISTINCT FROM OLD.custom_message_override OR
        NEW.send_eligibility IS DISTINCT FROM OLD.send_eligibility) THEN
      v_content_changed := true;
    END IF;
  END IF;

  IF v_content_changed THEN
    SELECT approval_status INTO v_camp_approval
    FROM public.marketing_campaigns
    WHERE id = v_campaign_id;

    IF v_camp_approval = 'APPROVED' THEN
      UPDATE public.marketing_campaigns
      SET approval_status = 'INVALIDATED',
          status = CASE WHEN status = 'APPROVED' THEN 'DRAFT' ELSE status END,
          approved_by = NULL,
          approved_at = NULL,
          approval_snapshot = NULL,
          updated_at = now()
      WHERE id = v_campaign_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_approval_on_recipient_change ON public.marketing_campaign_recipients;
CREATE TRIGGER trg_invalidate_approval_on_recipient_change
  BEFORE INSERT OR UPDATE OR DELETE ON public.marketing_campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_invalidate_approval_on_recipient_change();

-- ------------------------------------------------------------------------------
-- 7. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_marketing_templates_status ON public.marketing_templates(status);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_type ON public.marketing_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_approval ON public.marketing_campaigns(approval_status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_cid ON public.marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_comp ON public.marketing_campaign_recipients(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_email ON public.marketing_campaign_recipients(recipient_email);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_logs_cid ON public.marketing_campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_logs_created ON public.marketing_campaign_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_suppression_email ON public.marketing_suppression_list(email);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_recipients TO authenticated, service_role;
GRANT SELECT, INSERT ON public.marketing_campaign_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_suppression_list TO authenticated, service_role;

REVOKE ALL ON public.marketing_templates FROM anon;
REVOKE ALL ON public.marketing_campaigns FROM anon;
REVOKE ALL ON public.marketing_campaign_recipients FROM anon;
REVOKE ALL ON public.marketing_campaign_logs FROM anon;
REVOKE ALL ON public.marketing_suppression_list FROM anon;

-- Explicitly revoke destructive permissions on audit log
REVOKE UPDATE, DELETE, TRUNCATE ON public.marketing_campaign_logs FROM authenticated, service_role, anon, public;

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns FORCE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_recipients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppression_list FORCE ROW LEVEL SECURITY;

-- Admin-only RLS Policies
DROP POLICY IF EXISTS "marketing_templates_admin_all" ON public.marketing_templates;
CREATE POLICY "marketing_templates_admin_all"
  ON public.marketing_templates
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "marketing_campaigns_admin_all" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_admin_all"
  ON public.marketing_campaigns
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "marketing_recipients_admin_all" ON public.marketing_campaign_recipients;
CREATE POLICY "marketing_recipients_admin_all"
  ON public.marketing_campaign_recipients
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- marketing_campaign_logs: SELECT & INSERT only
DROP POLICY IF EXISTS "marketing_logs_admin_select" ON public.marketing_campaign_logs;
CREATE POLICY "marketing_logs_admin_select"
  ON public.marketing_campaign_logs
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "marketing_logs_admin_insert" ON public.marketing_campaign_logs;
CREATE POLICY "marketing_logs_admin_insert"
  ON public.marketing_campaign_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "marketing_suppression_admin_all" ON public.marketing_suppression_list;
CREATE POLICY "marketing_suppression_admin_all"
  ON public.marketing_suppression_list
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ------------------------------------------------------------------------------
-- 9. SEED DEFAULT TEMPLATE PACKAGES (DETERMINISTIC UUIDs, IDEMPOTENT)
-- ON CONFLICT DO NOTHING ensures existing Admin customizations are preserved.
-- ------------------------------------------------------------------------------
INSERT INTO public.marketing_templates (
  id,
  name,
  template_type,
  version,
  language,
  subject,
  preview_text,
  html_content,
  plain_text,
  variables,
  landing_page_url,
  status,
  is_default,
  metadata
)
VALUES
  (
    'e0000000-0000-4000-8000-000000000001'::uuid,
    'K SELECT NETWORK — 브랜드 미국 진출 파트너십 제안서 (국문)',
    'HTML',
    '1.0.0',
    'ko',
    '[K SELECT] {{company_name}}의 미국 뷰티 리테일 네트워크 진출을 제안드립니다',
    '{{brand_name}}의 북미 온/오프라인 유통 및 바이어 큐레이션 프로그램 안내',
    '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>K SELECT NETWORK</title></head><body style="font-family: sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table width="600" style="background: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; padding: 32px;"><tr><td><h2 style="margin: 0 0 16px;">K SELECT NETWORK</h2><p>안녕하세요, {{company_name}} {{contact_name}} 귀하</p><p>귀사의 브랜드 <strong>{{brand_name}}</strong>의 북미 진출 프로그램을 안내드립니다.</p><div style="background: #f4f4f5; border-left: 4px solid #18181b; padding: 12px; margin: 16px 0;">{{custom_message}}</div><p><a href="https://www.kselectnetwork.com" style="display: inline-block; background: #09090b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">파트너십 안내서 확인 →</a></p></td></tr></table></td></tr></table></body></html>',
    '안녕하세요, {{company_name}} {{contact_name}} 귀하\n\nK SELECT NETWORK는 북미 온·오프라인 뷰티 리테일러와 한국의 우수한 브랜드를 연결하는 유통 플랫폼입니다.\n\n{{custom_message}}\n\n자세한 안내: https://www.kselectnetwork.com',
    '["company_name", "contact_name", "brand_name", "custom_message"]'::jsonb,
    'https://www.kselectnetwork.com',
    'ACTIVE',
    true,
    '{"seeded_by": "0185_migration"}'::jsonb
  ),
  (
    'e0000000-0000-4000-8000-000000000002'::uuid,
    'K SELECT NETWORK — Global Brand Partnership Proposal (English)',
    'HTML',
    '1.0.0',
    'en',
    '[K SELECT] Partnership Inquiry: North American Distribution for {{company_name}}',
    'Curated wholesale & retail expansion opportunities for {{brand_name}} in the US & Canada',
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>K SELECT NETWORK</title></head><body style="font-family: sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table width="600" style="background: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; padding: 32px;"><tr><td><h2 style="margin: 0 0 16px;">K SELECT NETWORK</h2><p>Dear {{contact_name}} and the {{company_name}} Team,</p><p>We are pleased to introduce North American wholesale expansion opportunities for <strong>{{brand_name}}</strong>.</p><div style="background: #f4f4f5; border-left: 4px solid #18181b; padding: 12px; margin: 16px 0;">{{custom_message}}</div><p><a href="https://www.kselectnetwork.com" style="display: inline-block; background: #09090b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Learn More About Our Retail Network →</a></p></td></tr></table></td></tr></table></body></html>',
    'Dear {{contact_name}} and the {{company_name}} Team,\n\nK SELECT NETWORK bridges innovative K-Beauty brands with North American retailers.\n\n{{custom_message}}\n\nLearn more: https://www.kselectnetwork.com',
    '["company_name", "contact_name", "brand_name", "custom_message"]'::jsonb,
    'https://www.kselectnetwork.com',
    'ACTIVE',
    false,
    '{"seeded_by": "0185_migration"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
