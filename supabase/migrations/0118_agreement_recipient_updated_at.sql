-- Migration 0118: Add updated_at column to company_agreement_recipients
-- PORT-AGR-001-R11 / RTP-AGR-001-R3

ALTER TABLE public.company_agreement_recipients
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NULL;
