-- ==============================================================================
-- Migration 0197: Marketing Email Delivery Event Ledger
-- Authoritative immutable append-only ledger for Resend webhooks and delivery telemetry
-- Task: ADM-EMAIL-APP-012-R1
-- Standards: DEPLOY-STD-001, DEV-SQL-MIGRATION-STD-001
-- ==============================================================================

-- 1. Create table with provider_event_id and composite uniqueness
CREATE TABLE IF NOT EXISTS public.marketing_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL DEFAULT 'resend',
  provider_event_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  recipient_email TEXT NOT NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.marketing_campaign_recipients(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketing_delivery_events_provider_event UNIQUE (provider, provider_event_id)
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_msg_id 
  ON public.marketing_delivery_events(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_camp_id 
  ON public.marketing_delivery_events(campaign_id);

CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_email 
  ON public.marketing_delivery_events(recipient_email);

CREATE INDEX IF NOT EXISTS idx_marketing_delivery_events_created 
  ON public.marketing_delivery_events(created_at DESC);

-- 3. Append-Only Immutability Enforcement (Triggers)
CREATE OR REPLACE FUNCTION public.prevent_marketing_delivery_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'marketing_delivery_events is an immutable append-only ledger: % operation is forbidden.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_marketing_delivery_events_mutation 
  ON public.marketing_delivery_events;

CREATE TRIGGER trg_prevent_marketing_delivery_events_mutation
BEFORE UPDATE OR DELETE ON public.marketing_delivery_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_marketing_delivery_events_mutation();

-- 4. Least-Privilege Permissions
REVOKE ALL ON TABLE public.marketing_delivery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketing_delivery_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.marketing_delivery_events TO service_role;

-- 5. Row Level Security (RLS)
ALTER TABLE public.marketing_delivery_events ENABLE ROW LEVEL SECURITY;

-- Service Role insert and read access
DROP POLICY IF EXISTS "Service role insert and read on marketing_delivery_events" 
  ON public.marketing_delivery_events;
DROP POLICY IF EXISTS "Service role full access on marketing_delivery_events" 
  ON public.marketing_delivery_events;
CREATE POLICY "Service role insert and read on marketing_delivery_events"
  ON public.marketing_delivery_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated Admin Read Access (Uses canonical public.auth_is_admin())
DROP POLICY IF EXISTS "Admin users can view marketing_delivery_events" 
  ON public.marketing_delivery_events;
CREATE POLICY "Admin users can view marketing_delivery_events"
  ON public.marketing_delivery_events
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

COMMENT ON TABLE public.marketing_delivery_events IS 'Immutable authoritative append-only ledger for email delivery telemetry, webhook events, and reconciliation receipts';
