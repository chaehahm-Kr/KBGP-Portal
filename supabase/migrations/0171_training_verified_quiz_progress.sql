-- ==============================================================================
-- Migration 0171: Training Verified Quiz Progress & Completion Integrity
-- Task ID: RTP-TRAINING-P1-001-R1
-- Status: PENDING OWNER APPROVAL (HELD — DO NOT APPLY TO PRODUCTION WITHOUT SIGN-OFF)
-- ==============================================================================
-- Description:
-- 1. Adds completion_type ('LEGACY_SELF_REPORTED', 'VERIFIED_QUIZ_PASSED') to
--    retailer_product_training_progress to distinguish self-attested legacy
--    records from server-graded 100% quiz passes.
-- 2. Stores audit metadata for verified completions (quiz_score, quiz_total,
--    quiz_version, answers).
-- 3. Backfills all pre-existing rows safely as 'LEGACY_SELF_REPORTED'.
-- ==============================================================================

ALTER TABLE public.retailer_product_training_progress
  ADD COLUMN IF NOT EXISTS completion_type text DEFAULT 'LEGACY_SELF_REPORTED'
    CHECK (completion_type IN ('LEGACY_SELF_REPORTED', 'VERIFIED_QUIZ_PASSED')),
  ADD COLUMN IF NOT EXISTS quiz_score integer,
  ADD COLUMN IF NOT EXISTS quiz_total integer,
  ADD COLUMN IF NOT EXISTS quiz_version text,
  ADD COLUMN IF NOT EXISTS quiz_answers jsonb;

-- Backfill pre-existing rows as LEGACY_SELF_REPORTED
UPDATE public.retailer_product_training_progress
SET completion_type = 'LEGACY_SELF_REPORTED'
WHERE completion_type IS NULL;
