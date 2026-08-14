-- Create insights_articles table
CREATE TABLE IF NOT EXISTS public.insights_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    subtitle TEXT,
    category TEXT NOT NULL,
    content_type TEXT NOT NULL,
    hero_image TEXT,
    excerpt TEXT,
    body_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    author TEXT NOT NULL,
    publish_date TIMESTAMPTZ,
    sources JSONB DEFAULT '[]'::jsonb,
    seo_title TEXT,
    meta_description TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'
    audience TEXT NOT NULL DEFAULT 'BRAND', -- 'RETAILER', 'BRAND', 'BOTH'
    publish_channels TEXT[] NOT NULL DEFAULT '{}'::text[], -- 'K_SELECT_HUB', 'K_SELECT_NETWORK'
    featured BOOLEAN DEFAULT false,
    trending BOOLEAN DEFAULT false,
    brand_takeaway TEXT,
    brand_actions JSONB DEFAULT '[]'::jsonb,
    retailer_takeaway TEXT,
    retailer_actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.insights_articles ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow public read access to published insights" 
ON public.insights_articles
FOR SELECT 
USING (status = 'PUBLISHED');

-- Allow staff read access to all insights
CREATE POLICY "Allow authenticated staff read access to all insights" 
ON public.insights_articles
FOR SELECT 
TO authenticated
USING (true);

-- Allow staff write access to all insights
CREATE POLICY "Allow authenticated staff full write access to insights" 
ON public.insights_articles
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);
