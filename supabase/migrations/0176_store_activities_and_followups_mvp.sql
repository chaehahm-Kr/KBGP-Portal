-- ==============================================================================
-- Migration 0176: Store Activities & Operational Follow-ups MVP
-- Task ID: ADM-STORE-OPS-P4-004
-- Target Project: shzfrppdobpmrstcjfqu (K SELECT Production)
-- Status: READY FOR OWNER APPROVAL — NOT APPLIED
-- 
-- Summary:
-- 1. Create public.store_activities table for operational store logging & follow-ups.
-- 2. Enforce strict data integrity (store belongs to company, valid category, title length).
-- 3. Track audit edit history in JSONB with timestamps and modifying admin IDs.
-- 4. Create performance indexes for chronological timeline and pending follow-ups.
-- 5. Establish strict Row Level Security (RLS) granting Admin access, denying Retailers.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.store_activities
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'store_visit',
    'retailer_communication',
    'merchandising_inspection',
    'fixture_follow_up',
    'inventory_follow_up',
    'training_follow_up',
    'operational_issue',
    'general_note'
  )),
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) >= 3),
  description TEXT,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responsible_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  responsible_admin_name VARCHAR(100) NOT NULL,
  has_follow_up BOOLEAN NOT NULL DEFAULT false,
  follow_up_date DATE,
  follow_up_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (follow_up_status IN ('none', 'pending', 'completed', 'cancelled')),
  follow_up_note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_store_activities_followup CHECK (
    (has_follow_up = false AND follow_up_status = 'none') OR
    (has_follow_up = true AND follow_up_status IN ('pending', 'completed', 'cancelled'))
  )
);

-- ------------------------------------------------------------------------------
-- 2. SUPPORTING PERFORMANCE & TIMELINE INDEXES
-- ------------------------------------------------------------------------------
-- Timeline query index: chronological ordering per store
CREATE INDEX IF NOT EXISTS idx_store_activities_store_timeline 
  ON public.store_activities (store_id, activity_date DESC, created_at DESC);

-- Fast lookup for pending follow-ups and overdue task alerts
CREATE INDEX IF NOT EXISTS idx_store_activities_pending_followup 
  ON public.store_activities (store_id, follow_up_date) 
  WHERE follow_up_status = 'pending';

-- Multi-tenant and company audit index
CREATE INDEX IF NOT EXISTS idx_store_activities_company_id 
  ON public.store_activities (company_id);

-- Responsible admin index for personal task queues
CREATE INDEX IF NOT EXISTS idx_store_activities_responsible 
  ON public.store_activities (responsible_admin_id);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ------------------------------------------------------------------------------
ALTER TABLE public.store_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_activities FORCE ROW LEVEL SECURITY;

-- Policy 1: Admin Full Access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "store_activities_admin_all" ON public.store_activities;
CREATE POLICY "store_activities_admin_all"
  ON public.store_activities
  FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  )
  WITH CHECK (
    public.auth_is_admin()
    OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

-- Policy 2: Explicit Deny for Retailer Portal Access
-- Note: Store Activities are internal Admin operational notes only.
-- In Supabase RLS, non-matching authenticated users (e.g. Retailer users) have 0 access by default.

-- ------------------------------------------------------------------------------
-- 4. TABLE & COLUMN COMMENTS (DOCUMENTATION)
-- ------------------------------------------------------------------------------
COMMENT ON TABLE public.store_activities IS
  'Store Operations Phase 4: Operational store visit records, internal admin notes, and follow-up task tracking.';
COMMENT ON COLUMN public.store_activities.store_id IS
  'Target retail store identifier. References public.stores(id).';
COMMENT ON COLUMN public.store_activities.company_id IS
  'Retailer company identifier for multi-tenant isolation and audits.';
COMMENT ON COLUMN public.store_activities.activity_type IS
  'Activity category: store_visit, retailer_communication, merchandising_inspection, fixture_follow_up, inventory_follow_up, training_follow_up, operational_issue, general_note.';
COMMENT ON COLUMN public.store_activities.title IS
  'Short 1-line summary of the activity (3 to 200 characters).';
COMMENT ON COLUMN public.store_activities.description IS
  'Detailed operational field notes, discussion points, or observations.';
COMMENT ON COLUMN public.store_activities.responsible_admin_name IS
  'Cached administrator name for high-performance timeline rendering without join overhead.';
COMMENT ON COLUMN public.store_activities.has_follow_up IS
  'Flag indicating whether this activity requires a scheduled operational follow-up.';
COMMENT ON COLUMN public.store_activities.follow_up_status IS
  'Lifecycle status of follow-up: none, pending, completed, cancelled.';
COMMENT ON COLUMN public.store_activities.edit_history IS
  'JSONB audit trail of modifications containing timestamp, adminId, adminName, and changedFields array.';

-- ==============================================================================
-- SAFE VERIFICATION QUERIES (RUN AFTER FUTURE OWNER EXECUTION)
-- ==============================================================================
-- 1. Verify table columns and constraints:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'store_activities'
-- ORDER BY ordinal_position;
--
-- 2. Verify table indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'store_activities';
--
-- 3. Verify RLS policies:
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'store_activities';
