-- Migration 0052: Insights Reader Feedback Security Revision (ADM-INS-003-R1)

-- Drop public read policy if exists
DROP POLICY IF EXISTS "Allow public read access to insights_reader_feedback" ON public.insights_reader_feedback;
DROP POLICY IF EXISTS "Allow public insert to insights_reader_feedback" ON public.insights_reader_feedback;

-- 1. Public Insert Policy: Allow public to insert feedback
CREATE POLICY "Allow public insert to insights_reader_feedback" 
ON public.insights_reader_feedback FOR INSERT TO public WITH CHECK (true);

-- 2. Service Role & Authenticated Only Policy for SELECT: Block anonymous raw SELECT
CREATE POLICY "Allow authenticated service role read access to insights_reader_feedback" 
ON public.insights_reader_feedback FOR SELECT TO authenticated USING (true);

-- Note: Anonymous 'anon' role cannot SELECT from public.insights_reader_feedback.
-- All queries by public API endpoints execute via Supabase Service Role client, returning ONLY aggregated metrics.
