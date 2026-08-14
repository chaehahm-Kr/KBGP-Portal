-- Migration 0047: Insights V1 Editorial Control Center Schema Extensions

-- 1. Extend insights_articles table with Editorial Workflow fields
ALTER TABLE public.insights_articles 
  ADD COLUMN IF NOT EXISTS primary_language TEXT DEFAULT 'KO',
  ADD COLUMN IF NOT EXISTS analysis_confidence INT DEFAULT 85,
  ADD COLUMN IF NOT EXISTS topic_score INT DEFAULT 85,
  ADD COLUMN IF NOT EXISTS topic_score_breakdown JSONB DEFAULT '{"relevance": 25, "actionability": 25, "evidence_strength": 20, "timeliness": 15, "originality": 10, "strategic_fit": 5}'::jsonb,
  ADD COLUMN IF NOT EXISTS critical_conditions JSONB DEFAULT '{"evidence_quality": "PASS", "duplicate_check": "PASS", "claim_validation": "PASS", "audience_relevance": "PASS"}'::jsonb,
  ADD COLUMN IF NOT EXISTS relation_type TEXT DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS related_insight_id UUID REFERENCES public.insights_articles(id) ON DELETE SET NULL,
  
  -- Dual Language Core Fields
  ADD COLUMN IF NOT EXISTS title_ko TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_ko TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_en TEXT,
  ADD COLUMN IF NOT EXISTS summary_ko TEXT,
  ADD COLUMN IF NOT EXISTS summary_en TEXT,
  ADD COLUMN IF NOT EXISTS body_blocks_ko JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS body_blocks_en JSONB DEFAULT '[]'::jsonb,
  
  -- K SELECT NETWORK Audience Fields
  ADD COLUMN IF NOT EXISTS network_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS network_category TEXT,
  ADD COLUMN IF NOT EXISTS network_brand_takeaway_ko TEXT,
  ADD COLUMN IF NOT EXISTS network_brand_takeaway_en TEXT,
  ADD COLUMN IF NOT EXISTS network_brand_actions_ko JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS network_brand_actions_en JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS network_implication_ko TEXT,
  ADD COLUMN IF NOT EXISTS network_implication_en TEXT,
  ADD COLUMN IF NOT EXISTS network_cta_ko TEXT,
  ADD COLUMN IF NOT EXISTS network_cta_en TEXT,
  ADD COLUMN IF NOT EXISTS network_publish_status TEXT DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS network_publish_date TIMESTAMPTZ,
  
  -- K SELECT HUB Audience Fields
  ADD COLUMN IF NOT EXISTS hub_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS hub_category TEXT,
  ADD COLUMN IF NOT EXISTS hub_retailer_takeaway_ko TEXT,
  ADD COLUMN IF NOT EXISTS hub_retailer_takeaway_en TEXT,
  ADD COLUMN IF NOT EXISTS hub_retailer_actions_ko JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hub_retailer_actions_en JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hub_checklist_ko JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hub_checklist_en JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hub_opportunity_ko TEXT,
  ADD COLUMN IF NOT EXISTS hub_opportunity_en TEXT,
  ADD COLUMN IF NOT EXISTS hub_cta_ko TEXT,
  ADD COLUMN IF NOT EXISTS hub_cta_en TEXT,
  ADD COLUMN IF NOT EXISTS hub_publish_status TEXT DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS hub_publish_date TIMESTAMPTZ,
  
  -- Suitability & Verification Fields
  ADD COLUMN IF NOT EXISTS network_suitability TEXT DEFAULT 'HIGH',
  ADD COLUMN IF NOT EXISTS hub_suitability TEXT DEFAULT 'HIGH',
  ADD COLUMN IF NOT EXISTS sources_detail JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS claims JSONB DEFAULT '[]'::jsonb,
  
  -- Visuals & Motion Assets
  ADD COLUMN IF NOT EXISTS visuals JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visual_status TEXT DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS animation_recommendations JSONB DEFAULT '[]'::jsonb,
  
  -- Editorial Audit Metadata
  ADD COLUMN IF NOT EXISTS reviewer_id UUID,
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS generated_date TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_count INT DEFAULT 0;

-- Backfill title_ko / summary_ko for existing rows if needed
UPDATE public.insights_articles 
SET 
  title_ko = COALESCE(title_ko, title),
  subtitle_ko = COALESCE(subtitle_ko, subtitle),
  summary_ko = COALESCE(summary_ko, excerpt),
  body_blocks_ko = CASE WHEN jsonb_array_length(body_blocks_ko) = 0 THEN body_blocks ELSE body_blocks_ko END,
  network_brand_takeaway_ko = COALESCE(network_brand_takeaway_ko, brand_takeaway),
  network_brand_actions_ko = CASE WHEN jsonb_array_length(network_brand_actions_ko) = 0 THEN brand_actions ELSE network_brand_actions_ko END,
  hub_retailer_takeaway_en = COALESCE(hub_retailer_takeaway_en, retailer_takeaway),
  hub_retailer_actions_en = CASE WHEN jsonb_array_length(hub_retailer_actions_en) = 0 THEN retailer_actions ELSE hub_retailer_actions_en END
WHERE title_ko IS NULL;


-- 2. Create Revision Requests Table
CREATE TABLE IF NOT EXISTS public.insights_revision_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.insights_articles(id) ON DELETE CASCADE,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT now(),
    comment TEXT NOT NULL,
    target_section TEXT DEFAULT 'CORE',
    revision_number INT DEFAULT 1,
    resolution_status TEXT DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.insights_revision_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff full access to insights_revision_requests" 
ON public.insights_revision_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. Create Version History Table
CREATE TABLE IF NOT EXISTS public.insights_version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.insights_articles(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    change_type TEXT NOT NULL,
    review_note TEXT,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.insights_version_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff full access to insights_version_history" 
ON public.insights_version_history FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 4. Create Master Editorial Rules Table
CREATE TABLE IF NOT EXISTS public.insights_editorial_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key TEXT UNIQUE NOT NULL DEFAULT 'DEFAULT_MASTER_RULES',
    daily_run_time TEXT DEFAULT '05:00 AM',
    timezone TEXT DEFAULT 'America/New_York',
    minimum_topic_score INT DEFAULT 80,
    network_daily_draft_max INT DEFAULT 3,
    hub_daily_draft_max INT DEFAULT 3,
    topic_score_weights JSONB DEFAULT '{"relevance": 25, "actionability": 25, "evidence_strength": 20, "timeliness": 15, "originality": 10, "strategic_fit": 5}'::jsonb,
    human_approval_required BOOLEAN DEFAULT true,
    auto_publish BOOLEAN DEFAULT false,
    auto_visual_preparation BOOLEAN DEFAULT true,
    auto_translation BOOLEAN DEFAULT true,
    source_validation_required BOOLEAN DEFAULT true,
    duplicate_check_required BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);

ALTER TABLE public.insights_editorial_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff full access to insights_editorial_rules" 
ON public.insights_editorial_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default rules row if not exists
INSERT INTO public.insights_editorial_rules (rule_key)
VALUES ('DEFAULT_MASTER_RULES')
ON CONFLICT (rule_key) DO NOTHING;


-- 5. Create Automation Runs Log Table
CREATE TABLE IF NOT EXISTS public.insights_automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    sources_scanned INT DEFAULT 0,
    candidates_found INT DEFAULT 0,
    candidates_rejected INT DEFAULT 0,
    network_drafts_created INT DEFAULT 0,
    hub_drafts_created INT DEFAULT 0,
    shared_drafts_created INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.insights_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff full access to insights_automation_runs" 
ON public.insights_automation_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 6. Create Categories Table
CREATE TABLE IF NOT EXISTS public.insights_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.insights_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff full access to insights_categories" 
ON public.insights_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.insights_categories (name, description) VALUES
('U.S. MARKET ENTRY', 'Regulations, MoCRA compliance, import customs, and U.S. distribution strategy'),
('RETAIL TRENDS', 'Independent beauty supply stores, chain retailers, and offline shelf dynamics'),
('CONSUMER INSIGHTS', 'U.S. K-Beauty consumer behavior, ingredient trends, and product preferences'),
('COMPLIANCE & LEGAL', 'FDA, FTC claims, safety substantiation, and packaging guidelines')
ON CONFLICT (name) DO NOTHING;


-- 7. Create Authors Table
CREATE TABLE IF NOT EXISTS public.insights_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    role TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.insights_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff full access to insights_authors" 
ON public.insights_authors FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.insights_authors (name, role) VALUES
('Compliance Operations Team', 'K SELECT Regulatory & Compliance Desk'),
('Market Intelligence Desk', 'K SELECT U.S. Retail & Market Research'),
('K-Beauty Strategy Team', 'K SELECT Brand Acceleration Team')
ON CONFLICT (name) DO NOTHING;
