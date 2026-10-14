-- ==============================================================================
-- Migration 0171: Weekly Report Snapshots & Email Delivery Audit Logs
-- Task ID: RTP-WEEKLY-INV-P3-001
-- Description:
-- 1. Creates email_delivery_logs table for tracking all outbound notification emails
--    (weekly report summaries, admin check reminders, system alerts).
-- 2. Indexes for tenant company lookups, template tracking, and delivery auditing.
-- 3. RLS policies allowing authenticated admin and company users access.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  template_key text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'simulated')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_company 
  ON public.email_delivery_logs(company_id);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_store 
  ON public.email_delivery_logs(store_id);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_template 
  ON public.email_delivery_logs(template_key);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_sent_at 
  ON public.email_delivery_logs(sent_at DESC);

ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'email_delivery_logs' 
    AND policyname = 'email_delivery_logs_authenticated_access'
  ) THEN
    CREATE POLICY email_delivery_logs_authenticated_access
      ON public.email_delivery_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
