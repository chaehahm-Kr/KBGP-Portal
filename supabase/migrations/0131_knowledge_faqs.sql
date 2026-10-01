-- Migration: 0131_knowledge_faqs.sql
-- Description: Create knowledge_faqs table for Governed FAQs and Suggested Questions derived from Published Knowledge

CREATE TABLE IF NOT EXISTS public.knowledge_faqs (
    id TEXT PRIMARY KEY,
    source_knowledge_id TEXT NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    source_version TEXT NOT NULL,
    source_title TEXT NOT NULL,
    question_ko TEXT NOT NULL,
    question_en TEXT,
    answer_ko TEXT NOT NULL,
    answer_en TEXT,
    audience TEXT[] NOT NULL DEFAULT '{"INTERNAL"}'::TEXT[],
    status TEXT NOT NULL DEFAULT 'CANDIDATE' CHECK (status IN ('CANDIDATE', 'APPROVED', 'REJECTED', 'INACTIVE', 'UPDATE_REQUIRED')),
    kind TEXT NOT NULL DEFAULT 'BOTH' CHECK (kind IN ('FAQ', 'SUGGESTED_QUESTION', 'BOTH')),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    generated_by TEXT NOT NULL DEFAULT 'AI' CHECK (generated_by IN ('AI', 'MANUAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_note TEXT,
    impact_reason TEXT
);

-- Indexes for efficient audience distribution, source tracking, and search
CREATE INDEX IF NOT EXISTS idx_knowledge_faqs_source ON public.knowledge_faqs (source_knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_faqs_status ON public.knowledge_faqs (status);
CREATE INDEX IF NOT EXISTS idx_knowledge_faqs_audience ON public.knowledge_faqs USING GIN (audience);
CREATE INDEX IF NOT EXISTS idx_knowledge_faqs_kind ON public.knowledge_faqs (kind);

-- Enable RLS
ALTER TABLE public.knowledge_faqs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to APPROVED non-sensitive FAQs
CREATE POLICY "Allow public read of approved faqs"
ON public.knowledge_faqs FOR SELECT
USING (status = 'APPROVED');

-- Allow service_role / authenticated admin full management
CREATE POLICY "Allow service_role full management on knowledge_faqs"
ON public.knowledge_faqs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
