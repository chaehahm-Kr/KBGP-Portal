-- Migration 0051: Insights Reader Feedback & Editorial Principle Data Foundation (Phase 3)

-- 1. Create Reader Feedback Table
CREATE TABLE IF NOT EXISTS public.insights_reader_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.insights_articles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'NETWORK', -- 'NETWORK' | 'HUB'
    feedback TEXT NOT NULL, -- 'HELPFUL' | 'NOT_HELPFUL'
    client_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.insights_reader_feedback ENABLE ROW LEVEL SECURITY;

-- Allow public insert (anonymous feedback)
CREATE POLICY "Allow public insert to insights_reader_feedback" 
ON public.insights_reader_feedback FOR INSERT TO public WITH CHECK (true);

-- Allow public and authenticated read
CREATE POLICY "Allow public read access to insights_reader_feedback" 
ON public.insights_reader_feedback FOR SELECT TO public USING (true);

-- 2. Extend Master Editorial Rules with Editorial Principle Guidance
ALTER TABLE public.insights_editorial_rules
  ADD COLUMN IF NOT EXISTS reader_usefulness_priority BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS editorial_principle_note TEXT DEFAULT 'Primary goal of Insights is reader usefulness in market understanding and decision-making, not aggressive K SELECT sales pitches. Avoid explicit conflicts of interest.';
