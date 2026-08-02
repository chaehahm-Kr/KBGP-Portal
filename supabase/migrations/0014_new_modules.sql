-- 0014_new_modules.sql
-- Create database schema for Retail Network, Placements, Samples, Amazon launch, and Tasks

-- 1. Retail Stores (리테일 매장 정보)
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Chain Beauty Supply', 'Specialty Retailer', 'Independent Beauty Supply'
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    manager_name TEXT,
    manager_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for public.stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on stores" ON public.stores
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write access on stores" ON public.stores
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles
            WHERE staff_roles.staff_id = auth.uid() AND staff_roles.role IN ('super_admin', 'reviewer')
        )
    );

-- 2. Placements (매장 진열 정보)
CREATE TABLE IF NOT EXISTS public.placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    module_name TEXT NOT NULL, -- e.g., '4 ft K-Beauty Shelf', 'Endcap Display'
    shelf_level TEXT, -- 'Top Shelf', 'Eye-level Shelf', 'Middle Shelf', 'Bottom Shelf'
    current_inventory INTEGER DEFAULT 0 NOT NULL,
    weekly_sales INTEGER DEFAULT 0 NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Swap Required', 'Low Stock'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for public.placements
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on placements" ON public.placements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write access on placements" ON public.placements
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles
            WHERE staff_roles.staff_id = auth.uid() AND staff_roles.role IN ('super_admin', 'reviewer')
        )
    );

-- 3. Samples (샘플 관리)
CREATE TABLE IF NOT EXISTS public.samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    evaluator_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Requested', -- 'Requested', 'Received', 'Under Evaluation', 'Approved', 'Rejected'
    evaluation_score NUMERIC(3, 1), -- 1.0 to 10.0
    evaluation_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for public.samples
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on samples" ON public.samples
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write access on samples" ON public.samples
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles
            WHERE staff_roles.staff_id = auth.uid() AND staff_roles.role IN ('super_admin', 'reviewer')
        )
    );

-- 4. Amazon Launch Projects (아마존 런칭 및 리스팅 프로젝트)
CREATE TABLE IF NOT EXISTS public.amazon_launches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    launch_status TEXT NOT NULL DEFAULT 'None', -- 'None', 'Pipeline', 'Listings', 'Amazon Sales', 'Ads', 'Reviews', 'Inventory'
    fnsku TEXT,
    asin TEXT,
    price NUMERIC(10, 2),
    stock_qty INTEGER DEFAULT 0 NOT NULL,
    ad_spend NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    ad_sales NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    review_rating NUMERIC(2, 1),
    review_count INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for public.amazon_launches
ALTER TABLE public.amazon_launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on amazon_launches" ON public.amazon_launches
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write access on amazon_launches" ON public.amazon_launches
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles
            WHERE staff_roles.staff_id = auth.uid() AND staff_roles.role IN ('super_admin', 'reviewer')
        )
    );

-- 5. Tasks (업무 및 태스크 관리)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Urgent'
    status TEXT NOT NULL DEFAULT 'Not Started', -- 'Not Started', 'In Progress', 'Completed', 'Waiting'
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for public.tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on tasks" ON public.tasks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write access on tasks" ON public.tasks
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles
            WHERE staff_roles.staff_id = auth.uid() AND staff_roles.role IN ('super_admin', 'reviewer')
        )
    );
