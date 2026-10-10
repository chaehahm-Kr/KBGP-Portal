-- Migration 0155: Product Media Assets Foundation
-- Tables for Source Materials, Media Assets (Drafts/Approved), and AI Generation Jobs

CREATE TABLE IF NOT EXISTS public.product_media_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    company_id UUID,
    group_type TEXT NOT NULL CHECK (group_type IN ('product_info', 'product_media', 'brand_materials', 'existing_content', 'reference_files')),
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT NOT NULL DEFAULT 'document',
    storage_path TEXT,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    company_id UUID,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('packshot', 'gallery', 'lifestyle', 'benefit_graphic', 'infographic', 'how_to_graphic', 'product_video', 'how_to_video')),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived', 'failed')),
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    storage_path TEXT,
    thumbnail_path TEXT,
    content_data JSONB DEFAULT '{}'::jsonb,
    source_material_ids JSONB DEFAULT '[]'::jsonb,
    used_in TEXT[] DEFAULT ARRAY[]::TEXT[],
    parent_asset_id UUID REFERENCES public.product_media_assets(id) ON DELETE SET NULL,
    version INT NOT NULL DEFAULT 1,
    created_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_media_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    company_id UUID,
    asset_id UUID REFERENCES public.product_media_assets(id) ON DELETE SET NULL,
    output_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    creation_settings JSONB DEFAULT '{}'::jsonb,
    selected_source_ids JSONB DEFAULT '[]'::jsonb,
    provider TEXT NOT NULL DEFAULT 'none',
    model TEXT NOT NULL DEFAULT 'none',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_media_sources_product ON public.product_media_sources(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_assets_product ON public.product_media_assets(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_media_generation_jobs_product ON public.product_media_generation_jobs(product_id, status);

-- Enable RLS
ALTER TABLE public.product_media_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service role & authenticated admin
CREATE POLICY "Public read product_media_sources" ON public.product_media_sources FOR SELECT USING (true);
CREATE POLICY "Public write product_media_sources" ON public.product_media_sources FOR ALL USING (true);

CREATE POLICY "Public read product_media_assets" ON public.product_media_assets FOR SELECT USING (true);
CREATE POLICY "Public write product_media_assets" ON public.product_media_assets FOR ALL USING (true);

CREATE POLICY "Public read product_media_generation_jobs" ON public.product_media_generation_jobs FOR SELECT USING (true);
CREATE POLICY "Public write product_media_generation_jobs" ON public.product_media_generation_jobs FOR ALL USING (true);
