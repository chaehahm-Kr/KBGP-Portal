-- 0017: Unified company users permissions & contacts mapping
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
ALTER TABLE public.company_users ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

-- Comment for metadata audit
COMMENT ON COLUMN public.company_users.is_primary IS '대표 담당자(주 컨택 직원) 지정 플래그';
COMMENT ON COLUMN public.company_users.permissions IS '메뉴별 ACL 권한 매트릭스 (none, read_only, read_write)';
