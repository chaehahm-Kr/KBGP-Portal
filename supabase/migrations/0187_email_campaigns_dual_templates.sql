-- Migration: 0187_email_campaigns_dual_templates.sql
-- Task ID: ADM-BSRC-006-R1-ADD1
-- Description: Add dual template formats (IMAGE/HTML) and editable campaign subject override
-- Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27

-- 1. Add subject_override to marketing_campaigns
ALTER TABLE public.marketing_campaigns 
  ADD COLUMN IF NOT EXISTS subject_override TEXT;

-- 2. Add template_type to marketing_templates
ALTER TABLE public.marketing_templates 
  ADD COLUMN IF NOT EXISTS template_type VARCHAR(32) NOT NULL DEFAULT 'HTML' CHECK (template_type IN ('HTML', 'IMAGE'));

-- 3. Create index for template_type
CREATE INDEX IF NOT EXISTS idx_marketing_templates_type ON public.marketing_templates(template_type);

-- Notify schema cache
NOTIFY pgrst, 'reload schema';
