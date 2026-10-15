-- ==============================================================================
-- Migration 0172: Retailer Weekly Report External Recipients Reference Schema
-- Task ID: RTP-WEEKLY-INV-P3-001-R2
-- Description:
-- Optional relational table for external email recipient storage.
-- Current application tier persists recipient rosters seamlessly via
-- company_users.permissions without requiring production DDL execution.
-- Provided here for owner review and future relational extraction if desired.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.retailer_weekly_report_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  opt_in boolean NOT NULL DEFAULT true,
  opted_in_at timestamptz DEFAULT now(),
  unsubscribed boolean NOT NULL DEFAULT false,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_recipient_email UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_retailer_report_recipients_company
  ON public.retailer_weekly_report_recipients(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_report_recipients_lookup
  ON public.retailer_weekly_report_recipients(company_id, email);

ALTER TABLE public.retailer_weekly_report_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'retailer_weekly_report_recipients'
    AND policyname = 'retailer_weekly_report_recipients_access'
  ) THEN
    CREATE POLICY retailer_weekly_report_recipients_access
      ON public.retailer_weekly_report_recipients
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
