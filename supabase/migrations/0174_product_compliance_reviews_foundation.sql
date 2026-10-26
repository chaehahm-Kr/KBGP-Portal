-- ==============================================================================
-- Migration: 0174_product_compliance_reviews_foundation.sql
-- Task ID: ADM-PRODUCT-COMPLIANCE-004
-- Target Project: shzfrppdobpmrstcjfqu (K SELECT Production)
-- Status: READY FOR OWNER REVIEW — NOT EXECUTED — DO NOT EXECUTE UNTIL APPROVED
--
-- Summary:
-- 1. Create public.product_compliance_reviews table for Admin compliance review tracking.
-- 2. Anti-destructive foreign key ON DELETE RESTRICT on product_id to protect review history.
-- 3. Reviewer foreign key on staff_members(id) ON DELETE SET NULL.
-- 4. Inquiry foreign key on partner_inquiries(id) ON DELETE SET NULL.
-- 5. Strict section constraint: ('overall', '1'..'7', plus canonical names).
-- 6. Strict status constraint: ('not_started', 'in_review', 'info_requested', 'needs_followup', 'completed').
-- 7. Composite uniqueness constraint: UNIQUE (product_id, section_id).
-- 8. High-performance indexes on product_id, status, reviewer_id, and related_inquiry_id.
-- 9. Automatic updated_at trigger function.
-- 10. Strict Row Level Security: Admin-only SELECT, INSERT, UPDATE. Super Admin DELETE only.
--     Zero access for Brand Portal and Retailer users.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.product_compliance_reviews
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_compliance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  section_id VARCHAR(50) NOT NULL DEFAULT 'overall',
  status VARCHAR(30) NOT NULL DEFAULT 'not_started',
  reviewer_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes TEXT,
  evidence_reference TEXT,
  related_inquiry_id UUID REFERENCES public.partner_inquiries(id) ON DELETE SET NULL,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_compliance_review UNIQUE (product_id, section_id),
  CONSTRAINT chk_compliance_review_status CHECK (
    status IN ('not_started', 'in_review', 'info_requested', 'needs_followup', 'completed')
  ),
  CONSTRAINT chk_compliance_review_section CHECK (
    section_id IN (
      'overall',
      '1', '2', '3', '4', '5', '6', '7',
      'product_classification',
      'product_labeling',
      'fda_related',
      'mocra',
      'otc_drug_facts',
      'certifications_testing',
      'import_customs'
    )
  )
);

-- ------------------------------------------------------------------------------
-- 2. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_product_id
  ON public.product_compliance_reviews(product_id);

CREATE INDEX IF NOT EXISTS idx_compliance_reviews_status
  ON public.product_compliance_reviews(status);

CREATE INDEX IF NOT EXISTS idx_compliance_reviews_related_inquiry_id
  ON public.product_compliance_reviews(related_inquiry_id);

CREATE INDEX IF NOT EXISTS idx_compliance_reviews_reviewer_id
  ON public.product_compliance_reviews(reviewer_id);

-- ------------------------------------------------------------------------------
-- 3. TRIGGER: updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_compliance_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_compliance_reviews_updated_at ON public.product_compliance_reviews;
CREATE TRIGGER trigger_compliance_reviews_updated_at
  BEFORE UPDATE ON public.product_compliance_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_compliance_reviews_updated_at();

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_compliance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_compliance_reviews FORCE ROW LEVEL SECURITY;

-- Policy 1: Admin staff SELECT access
DROP POLICY IF EXISTS "compliance_reviews_admin_select" ON public.product_compliance_reviews;
CREATE POLICY "compliance_reviews_admin_select"
  ON public.product_compliance_reviews
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

-- Policy 2: Admin staff INSERT access
DROP POLICY IF EXISTS "compliance_reviews_admin_insert" ON public.product_compliance_reviews;
CREATE POLICY "compliance_reviews_admin_insert"
  ON public.product_compliance_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_admin());

-- Policy 3: Admin staff UPDATE access
DROP POLICY IF EXISTS "compliance_reviews_admin_update" ON public.product_compliance_reviews;
CREATE POLICY "compliance_reviews_admin_update"
  ON public.product_compliance_reviews
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Policy 4: Super Admin DELETE access only (least-privilege audit defense)
DROP POLICY IF EXISTS "compliance_reviews_super_admin_delete" ON public.product_compliance_reviews;
CREATE POLICY "compliance_reviews_super_admin_delete"
  ON public.product_compliance_reviews
  FOR DELETE
  TO authenticated
  USING (public.auth_is_super_admin());

-- ------------------------------------------------------------------------------
-- 5. COLUMN & TABLE COMMENTS
-- ------------------------------------------------------------------------------
COMMENT ON TABLE public.product_compliance_reviews IS
  'Internal compliance review tracking and audit notes for admin staff. NOT public regulatory clearance.';
COMMENT ON COLUMN public.product_compliance_reviews.product_id IS
  'Target product ID. Protected by ON DELETE RESTRICT.';
COMMENT ON COLUMN public.product_compliance_reviews.section_id IS
  'Checklist section ID (overall, 1..7) matching Admin Compliance UI.';
COMMENT ON COLUMN public.product_compliance_reviews.status IS
  'Internal review workflow state: not_started, in_review, info_requested, needs_followup, completed.';
COMMENT ON COLUMN public.product_compliance_reviews.reviewer_id IS
  'Staff member ID who performed the latest review. References staff_members.id.';
COMMENT ON COLUMN public.product_compliance_reviews.notes IS
  'Confidential internal notes. Inaccessible to brand and retailer portals.';
COMMENT ON COLUMN public.product_compliance_reviews.related_inquiry_id IS
  'Linked Brand Inquiry ID in partner_inquiries.';

-- ==============================================================================
-- SAFE VERIFICATION QUERIES (RUN AFTER FUTURE OWNER EXECUTION)
-- ==============================================================================
-- 1. Verify table and columns:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'product_compliance_reviews'
-- ORDER BY ordinal_position;
--
-- 2. Verify constraints:
-- SELECT conname, contype, pg_get_constraintdef(c.oid)
-- FROM pg_constraint c
-- JOIN pg_class t ON c.conrelid = t.oid
-- WHERE t.relname = 'product_compliance_reviews';
--
-- 3. Verify RLS policies:
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'product_compliance_reviews';
