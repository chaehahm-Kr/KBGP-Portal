-- Migration 0049: Phase 2.1 Risk-Based Source Integrity & Fact Verification Extensions

-- 1. Extend insights_articles table with Phase 2.1 risk summary & content layers
ALTER TABLE public.insights_articles
  ADD COLUMN IF NOT EXISTS claim_risk_summary JSONB DEFAULT '{
    "high_risk_count": 0,
    "medium_risk_count": 0,
    "low_risk_count": 0,
    "verified_count": 0,
    "inferred_count": 0,
    "signal_count": 0,
    "internal_count": 0,
    "unsupported_count": 0,
    "fact_check_status": "PASS"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS content_layers JSONB DEFAULT '{
    "market_facts": [],
    "market_signals": [],
    "k_select_views": [],
    "k_select_actions": []
  }'::jsonb;

-- 2. Extend insights_automation_runs table with Phase 2.1 Quality Metrics
ALTER TABLE public.insights_automation_runs
  ADD COLUMN IF NOT EXISTS high_risk_claims_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_risk_passed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medium_risk_claims_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claims_downgraded_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsupported_numeric_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regulatory_failures_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drafts_rewritten_by_auditor INTEGER DEFAULT 0;

COMMENT ON COLUMN public.insights_articles.claim_risk_summary IS 'Phase 2.1 Risk-based claim audit breakdown and status';
COMMENT ON COLUMN public.insights_articles.content_layers IS 'Phase 2.1 Content layer separation (Market Fact, Signal, K Select View, Action)';
