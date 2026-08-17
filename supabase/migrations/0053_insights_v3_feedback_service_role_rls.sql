-- Migration 0053: Reader Feedback Service Role RLS Minimization (ADM-INS-003-R2)

-- Drop previous policies
DROP POLICY IF EXISTS "Allow authenticated service role read access to insights_reader_feedback" ON public.insights_reader_feedback;
DROP POLICY IF EXISTS "Allow public read access to insights_reader_feedback" ON public.insights_reader_feedback;
DROP POLICY IF EXISTS "Allow public insert to insights_reader_feedback" ON public.insights_reader_feedback;

-- 1. Public / Anon Role: INSERT ONLY (Cannot SELECT, UPDATE, or DELETE raw records)
CREATE POLICY "Allow public insert only to insights_reader_feedback" 
ON public.insights_reader_feedback FOR INSERT TO public WITH CHECK (true);

-- 2. Service Role Only Policy for Raw SELECT (Regular 'authenticated' & 'anon' roles cannot SELECT raw records)
CREATE POLICY "Allow service role raw select access" 
ON public.insights_reader_feedback FOR SELECT TO service_role USING (true);

-- Ensure RLS is active
ALTER TABLE public.insights_reader_feedback ENABLE ROW LEVEL SECURITY;
