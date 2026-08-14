-- 0050_knowledge_center_v1_schema.sql — K SELECT Knowledge Center Phase 1 Foundation Schema

-- 1. Main Knowledge Items Table
CREATE TABLE IF NOT EXISTS public.knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  title_ko text NOT NULL,
  title_en text DEFAULT '',
  summary_ko text DEFAULT '',
  summary_en text DEFAULT '',
  content_ko text DEFAULT '',
  content_en text DEFAULT '',
  type text NOT NULL CHECK (type IN (
    'MANUAL', 'POLICY', 'SOP', 'FAQ', 'SYSTEM_RULE', 
    'DEFINITION', 'GUIDE', 'DECISION_RECORD', 'INTERNAL_RULE', 'TRAINING'
  )),
  source_type text NOT NULL DEFAULT 'CONTENT' CHECK (source_type IN ('CONTENT', 'LIVE_SYSTEM', 'HYBRID')),
  linked_system_setting_key text DEFAULT NULL,
  linked_system_setting_name text DEFAULT NULL,
  linked_system_setting_value text DEFAULT NULL,
  category text DEFAULT 'GENERAL',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  owner_name text DEFAULT 'Knowledge Admin',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED'
  )),
  system_impact_status text NOT NULL DEFAULT 'NORMAL' CHECK (system_impact_status IN ('NORMAL', 'POTENTIALLY_OUTDATED')),
  system_impact_reason text DEFAULT NULL,
  system_impact_updated_at timestamptz DEFAULT NULL,
  audience jsonb NOT NULL DEFAULT '["INTERNAL"]'::jsonb,
  is_sensitive_internal boolean NOT NULL DEFAULT false,
  requires_external_approval boolean NOT NULL DEFAULT false,
  external_review_status text DEFAULT 'NONE' CHECK (external_review_status IN ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED')),
  external_reviewer_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  external_reviewed_at timestamptz DEFAULT NULL,
  current_version text NOT NULL DEFAULT 'v1.0',
  effective_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_items IS 'Source of Truth for all K SELECT Network Knowledge Center records';

-- 2. Knowledge Version History Table
CREATE TABLE IF NOT EXISTS public.knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED')),
  title_ko text NOT NULL,
  title_en text DEFAULT '',
  summary_ko text DEFAULT '',
  summary_en text DEFAULT '',
  content_ko text DEFAULT '',
  content_en text DEFAULT '',
  what_changed text DEFAULT '',
  why_changed text DEFAULT '',
  effective_date date DEFAULT CURRENT_DATE,
  created_by_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_by_name text DEFAULT '',
  reviewer_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  published_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_versions IS 'Immutable version snapshot history for knowledge records';

-- 3. Knowledge Platform Relations Table
CREATE TABLE IF NOT EXISTS public.knowledge_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  related_portal text DEFAULT NULL,
  related_module text DEFAULT NULL,
  related_menu text DEFAULT NULL,
  related_route text DEFAULT NULL,
  related_system_setting text DEFAULT NULL,
  target_knowledge_id uuid REFERENCES public.knowledge_items(id) ON DELETE SET NULL,
  manual_title text DEFAULT NULL,
  faq_question text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_relations IS 'Structured mapping between Knowledge items and platform modules/routes/settings';

-- 4. Knowledge Manual PDF Assets Table
CREATE TABLE IF NOT EXISTS public.knowledge_manual_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  manual_title text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0',
  language text NOT NULL DEFAULT 'KO',
  is_current boolean NOT NULL DEFAULT true,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  published_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_manual_assets IS 'Attached Manual PDF metadata assets connected to Knowledge records';

-- 5. Knowledge Audit Logs Table
CREATE TABLE IF NOT EXISTS public.knowledge_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text DEFAULT 'System',
  action text NOT NULL,
  previous_value jsonb DEFAULT '{}'::jsonb,
  new_value jsonb DEFAULT '{}'::jsonb,
  reason text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_audit_logs IS 'Complete governance timeline audit log for knowledge modifications';

-- 6. System Impact Triggers Log Table
CREATE TABLE IF NOT EXISTS public.knowledge_system_impact_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_name text NOT NULL,
  old_value text DEFAULT '',
  new_value text DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
  resolved_by uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  resolution_action text DEFAULT NULL,
  resolution_reason text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_system_impact_triggers IS 'Log of platform system setting changes causing potential knowledge outdatedness';

-- 7. Indexes for Fast Filter & Audience Security Querying
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON public.knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON public.knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_audience ON public.knowledge_items USING gin(audience);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_system_impact ON public.knowledge_items(system_impact_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_knowledge_id ON public.knowledge_versions(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_knowledge_id ON public.knowledge_relations(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_logs_knowledge_id ON public.knowledge_audit_logs(knowledge_id);

-- 8. Row Level Security Policies
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_manual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_system_impact_triggers ENABLE ROW LEVEL SECURITY;

-- Default Read Policies for Authenticated Admin Users
DROP POLICY IF EXISTS "knowledge_admin_select" ON public.knowledge_items;
CREATE POLICY "knowledge_admin_select" ON public.knowledge_items
  FOR SELECT TO authenticated USING (public.auth_is_admin());

DROP POLICY IF EXISTS "knowledge_admin_all" ON public.knowledge_items;
CREATE POLICY "knowledge_admin_all" ON public.knowledge_items
  FOR ALL TO authenticated USING (public.auth_is_admin());

DROP POLICY IF EXISTS "knowledge_versions_admin" ON public.knowledge_versions;
CREATE POLICY "knowledge_versions_admin" ON public.knowledge_versions
  FOR ALL TO authenticated USING (public.auth_is_admin());

DROP POLICY IF EXISTS "knowledge_relations_admin" ON public.knowledge_relations;
CREATE POLICY "knowledge_relations_admin" ON public.knowledge_relations
  FOR ALL TO authenticated USING (public.auth_is_admin());

DROP POLICY IF EXISTS "knowledge_assets_admin" ON public.knowledge_manual_assets;
CREATE POLICY "knowledge_assets_admin" ON public.knowledge_manual_assets
  FOR ALL TO authenticated USING (public.auth_is_admin());

DROP POLICY IF EXISTS "knowledge_logs_admin" ON public.knowledge_audit_logs;
CREATE POLICY "knowledge_logs_admin" ON public.knowledge_audit_logs
  FOR ALL TO authenticated USING (public.auth_is_admin());

DROP POLICY IF EXISTS "knowledge_triggers_admin" ON public.knowledge_system_impact_triggers;
CREATE POLICY "knowledge_triggers_admin" ON public.knowledge_system_impact_triggers
  FOR ALL TO authenticated USING (public.auth_is_admin());
