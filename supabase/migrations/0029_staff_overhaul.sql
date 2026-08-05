-- 0029_staff_overhaul.sql — 직원 및 권한 관리 시스템 전면 개편

-- 1. 부서(departments) 테이블 생성
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments IS '직원 소속 부서 목록';

-- 2. 직책(job_titles) 테이블 생성
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_titles IS '직원 직책 목록';

-- 3. 기존 staff_members 테이블 컬럼 확장
ALTER TABLE public.staff_members 
  ADD COLUMN IF NOT EXISTS english_name text,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ko',
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS base_role text DEFAULT 'reviewer',
  ADD COLUMN IF NOT EXISTS menu_permissions jsonb,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 4. status check 제약조건 갱신
ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS staff_members_status_check;
ALTER TABLE public.staff_members ADD CONSTRAINT staff_members_status_check 
  CHECK (status IN ('pending', 'invited', 'setting_up', 'active', 'suspended', 'locked'));

-- 5. 변경 이력 / 감사 로그(staff_audit_logs) 테이블 생성
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff_audit_logs IS '직원 계정 설정 및 권한 변경 감사 로그';

-- 6. RLS 및 정책 적용
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_select_admin" ON public.departments;
CREATE POLICY "departments_select_admin" ON public.departments 
  FOR SELECT TO authenticated USING (public.auth_is_admin());

ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_titles_select_admin" ON public.job_titles;
CREATE POLICY "job_titles_select_admin" ON public.job_titles 
  FOR SELECT TO authenticated USING (public.auth_is_admin());

ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_audit_logs_select_admin" ON public.staff_audit_logs;
CREATE POLICY "staff_audit_logs_select_admin" ON public.staff_audit_logs 
  FOR SELECT TO authenticated USING (public.auth_is_admin());

-- 7. handle_new_user() 트리거 함수 업데이트 (직원 추가 컬럼 메타데이터 이식)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role public.app_role;
  meta_base_role text;
  meta_dept_id uuid;
  meta_title_id uuid;
BEGIN
  resolved_role := COALESCE((new.raw_user_meta_data ->> 'role')::public.app_role, 'portal');

  INSERT INTO public.profiles (id, role, display_name)
  VALUES (new.id, resolved_role, new.raw_user_meta_data ->> 'display_name')
  ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(new.raw_user_meta_data ->> 'display_name', public.profiles.display_name);

  IF resolved_role = 'admin' THEN
    meta_base_role := COALESCE(new.raw_user_meta_data ->> 'base_role', 'reviewer');
    
    -- Extract optional metadata for department and title if present
    IF new.raw_user_meta_data ->> 'department_id' IS NOT NULL THEN
      meta_dept_id := (new.raw_user_meta_data ->> 'department_id')::uuid;
    END IF;
    
    IF new.raw_user_meta_data ->> 'job_title_id' IS NOT NULL THEN
      meta_title_id := (new.raw_user_meta_data ->> 'job_title_id')::uuid;
    END IF;

    INSERT INTO public.staff_members (
      id, 
      name, 
      email, 
      status, 
      base_role, 
      department_id, 
      job_title_id, 
      must_change_password
    )
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data ->> 'display_name', ''), 
      new.email, 
      'invited', -- Default state when invited
      meta_base_role,
      meta_dept_id,
      meta_title_id,
      true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- 8. 기초 데이터 시딩 (Seeding)
INSERT INTO public.departments (name) VALUES
  ('Management'),
  ('Brand Sourcing'),
  ('Product Review'),
  ('Regulatory'),
  ('Account Management'),
  ('Amazon Operations'),
  ('Retail Operations'),
  ('Marketing'),
  ('Finance'),
  ('IT & System')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.job_titles (name) VALUES
  ('Executive'),
  ('Director'),
  ('Manager'),
  ('Senior Specialist'),
  ('Specialist'),
  ('Coordinator'),
  ('Reviewer')
ON CONFLICT (name) DO NOTHING;
