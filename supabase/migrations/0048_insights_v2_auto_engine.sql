-- Migration 0048: K SELECT Daily Auto Insight Engine (Phase 2) Schema Extensions

-- 1. Extend public.insights_automation_runs with Phase 2 fields
ALTER TABLE public.insights_automation_runs
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT DEFAULT '05:00 AM',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS sources_accepted INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidates_generated INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidates_scored INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidates_gte_80 INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS critical_rejects INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_rejects INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_drafts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hub_drafts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shared_core_drafts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_core_drafts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visual_success INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visual_failed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS run_mode TEXT DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS no_draft_reason TEXT,
  ADD COLUMN IF NOT EXISTS research_summary JSONB DEFAULT '{}'::jsonb;

-- 2. Extend public.insights_articles with Core Research Brief
ALTER TABLE public.insights_articles
  ADD COLUMN IF NOT EXISTS research_brief JSONB DEFAULT '{}'::jsonb;
