-- ==============================================================================
-- Migration 0197: Marketing Email Delivery Event Ledger
-- Authoritative immutable ledger for Resend webhooks and delivery telemetry
-- Task: ADM-EMAIL-APP-012
-- Standards: DEPLOY-STD-001, DEV-SQL-MIGRATION-STD-001
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL DEFAULT 'resend',
  provider_message_id TEXT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  recipient_email TEXT NOT NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.marketing_campaign_recipients(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_msg_id 
  ON public.marketing_delivery_events(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_camp_id 
  ON public.marketing_delivery_events(campaign_id);

CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_email 
  ON public.marketing_delivery_events(recipient_email);

CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_created 
  ON public.marketing_delivery_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.marketing_delivery_events ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access
DROP POLICY IF EXISTS "Service role full access on marketing_delivery_events" 
  ON public.marketing_delivery_events;
CREATE POLICY "Service role full access on marketing_delivery_events"
  ON public.marketing_delivery_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated Admin Read Access
DROP POLICY IF EXISTS "Admin users can view marketing_delivery_events" 
  ON public.marketing_delivery_events;
CREATE POLICY "Admin users can view marketing_delivery_events"
  ON public.marketing_delivery_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      JOIN public.companies c ON c.id = cu.company_id
      WHERE cu.user_id = auth.uid()
        AND c.company_type = 'PLATFORM_OPERATOR'
        AND cu.status = 'active'
    )
  );

COMMENT ON TABLE public.marketing_delivery_events IS 'Immutable authoritative ledger for email delivery telemetry, webhook events, and reconciliation receipts';
