-- Migration: 0090_partner_inquiries_created_source.sql
-- Add created_source and priority columns to partner_inquiries

ALTER TABLE public.partner_inquiries
ADD COLUMN IF NOT EXISTS created_source TEXT NOT NULL DEFAULT 'portal' CHECK (created_source IN ('portal', 'admin')),
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_partner_inquiries_created_source ON public.partner_inquiries(created_source);
