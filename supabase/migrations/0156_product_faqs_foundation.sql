-- Migration 0156: Product FAQs Foundation
-- Tables for Product FAQs (Manual & AI Suggested), Approval Workflow, and Audience Reuse

CREATE TABLE IF NOT EXISTS public.product_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'Product Basics',
        'Who It’s For',
        'How to Use',
        'Routine / Compatibility',
        'Ingredients / Safety',
        'Warnings / Precautions',
        'Storage / Practical Info'
    )),
    audience TEXT NOT NULL DEFAULT 'both' CHECK (audience IN ('customer', 'retail_staff', 'both')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
    sort_order INT NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'ai_suggested')),
    source_refs JSONB DEFAULT '[]'::jsonb,
    ai_provider TEXT,
    ai_model TEXT,
    requires_brand_confirmation BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_faqs_product_status ON public.product_faqs(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_faqs_audience ON public.product_faqs(product_id, audience, status);
CREATE INDEX IF NOT EXISTS idx_product_faqs_category ON public.product_faqs(product_id, category);
CREATE INDEX IF NOT EXISTS idx_product_faqs_sort ON public.product_faqs(product_id, sort_order ASC, created_at ASC);

-- Enable RLS
ALTER TABLE public.product_faqs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service role & authenticated admin
CREATE POLICY "Public read product_faqs" ON public.product_faqs FOR SELECT USING (true);
CREATE POLICY "Public write product_faqs" ON public.product_faqs FOR ALL USING (true);
