-- Migration: 0185_brand_marketing_campaigns.sql
-- Task ID: ADM-BSRC-006
-- Description: Brand Marketing Phase 2 — Email Campaigns V1 Schema (Templates, Campaigns, Recipients, Logs, Suppression)
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
-- Mode: Safe forward additive idempotent migration. Decoupled from core transactional emails.

-- ------------------------------------------------------------------------------
-- 1. TABLE: marketing_templates
-- External Designer Template Packages (HTML, subject, preview text, variables, landing page)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
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
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_snapshot JSONB,

  -- Scheduling & Safety
  scheduled_at TIMESTAMPTZ,
  is_live_mode_enabled BOOLEAN NOT NULL DEFAULT false, -- STRICTLY FALSE in V1

  -- Filters, Custom Messages & Stats
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

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. TABLE: marketing_campaign_recipients
-- Frozen recipient snapshots per campaign with personalized values and delivery state
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.sourcing_companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.sourcing_contacts(id) ON DELETE SET NULL,
  
  -- Recipient details (frozen snapshot at dry run/send time)
  recipient_email TEXT NOT NULL,
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

  CONSTRAINT uq_campaign_recipient_email UNIQUE (campaign_id, recipient_email)
);

-- ------------------------------------------------------------------------------
-- 4. TABLE: marketing_campaign_logs
-- Immutable audit log for campaign actions, test dispatches, and dry-run evaluations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.marketing_campaign_recipients(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. TABLE: marketing_suppression_list
-- Commercial email opt-out and bounce suppression registry
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason VARCHAR(32) NOT NULL DEFAULT 'UNSUBSCRIBED' CHECK (
    reason IN ('UNSUBSCRIBED', 'BOUNCED', 'COMPLAINT', 'MANUAL_ADMIN')
  ),
  notes TEXT,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------------------------
-- 6. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_marketing_templates_status ON public.marketing_templates(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_approval ON public.marketing_campaigns(approval_status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_cid ON public.marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_email ON public.marketing_campaign_recipients(lower(recipient_email));
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_logs_cid ON public.marketing_campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_suppression_email ON public.marketing_suppression_list(lower(email));

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_recipients TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_suppression_list TO authenticated, service_role;

REVOKE ALL ON public.marketing_templates FROM anon;
REVOKE ALL ON public.marketing_campaigns FROM anon;
REVOKE ALL ON public.marketing_campaign_recipients FROM anon;
REVOKE ALL ON public.marketing_campaign_logs FROM anon;
REVOKE ALL ON public.marketing_suppression_list FROM anon;

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

-- Admin-only policies
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

DROP POLICY IF EXISTS "marketing_logs_admin_all" ON public.marketing_campaign_logs;
CREATE POLICY "marketing_logs_admin_all"
  ON public.marketing_campaign_logs
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

DROP POLICY IF EXISTS "marketing_suppression_admin_all" ON public.marketing_suppression_list;
CREATE POLICY "marketing_suppression_admin_all"
  ON public.marketing_suppression_list
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
