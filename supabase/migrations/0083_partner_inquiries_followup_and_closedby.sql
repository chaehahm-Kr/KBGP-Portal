-- Migration: 0083_partner_inquiries_followup_and_closedby.sql
-- Add previous_case_id for Follow-up Case relationship and closed_by_side for tracking close side

ALTER TABLE public.partner_inquiries
ADD COLUMN IF NOT EXISTS previous_case_id UUID REFERENCES public.partner_inquiries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS closed_by_side TEXT CHECK (closed_by_side IN ('admin', 'portal'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_partner_inquiries_previous_case_id ON public.partner_inquiries(previous_case_id);
