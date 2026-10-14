-- ==============================================================================
-- Migration 0170: Admin Product Training Studio Extensions
-- Task ID: ADM-TRAINING-P1-001
-- Description:
-- 1. Extends retailer_product_training_content with lifecycle status, versioning,
--    15s counter pitch, objections & answers, handling SOP, quiz questions,
--    source readiness snapshots, and approval audit metadata.
-- 2. Fully backwards-compatible with existing migration 0102 seed data.
-- 3. Indexes for fast status lookups and version tracking.
-- ==============================================================================

ALTER TABLE public.retailer_product_training_content 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS version_type text DEFAULT 'minor' CHECK (version_type IN ('minor', 'major')),
  ADD COLUMN IF NOT EXISTS pitch_15s text,
  ADD COLUMN IF NOT EXISTS customer_objections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS storage_handling_sop text,
  ADD COLUMN IF NOT EXISTS quiz_questions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_readiness jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_refs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS version_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid;

CREATE INDEX IF NOT EXISTS idx_retailer_training_content_status
  ON public.retailer_product_training_content(status);

-- Ensure existing 6 seeded rows have consistent published status
UPDATE public.retailer_product_training_content
SET 
  status = CASE WHEN is_published = true THEN 'published' ELSE 'draft' END,
  version = COALESCE(version, '1.0.0'),
  pitch_15s = COALESCE(pitch_15s, 'Recommend this clean K-Beauty staple for proven daily skin barrier hydration.'),
  storage_handling_sop = COALESCE(storage_handling_sop, important_notes, 'Store in a cool, dry place away from direct sunlight.'),
  customer_objections = COALESCE(customer_objections, '[]'::jsonb),
  quiz_questions = COALESCE(quiz_questions, '[]'::jsonb),
  published_at = COALESCE(published_at, created_at)
WHERE status IS NULL OR pitch_15s IS NULL;
