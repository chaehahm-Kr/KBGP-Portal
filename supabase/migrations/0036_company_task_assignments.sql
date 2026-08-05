-- 0036_company_task_assignments.sql
-- K-Select Network 회사별 6대 담당 업무 배정 및 알림 수신 설정 테이블

-- 1. 담당 업무 배정 테이블 생성
CREATE TABLE IF NOT EXISTS public.company_task_assignments (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.company_users (id) ON DELETE CASCADE,
  task_code text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  email_notify boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_path text NOT NULL CHECK (updated_path IN ('portal', 'admin')),
  PRIMARY KEY (company_id, user_id, task_code),
  CONSTRAINT check_task_code CHECK (task_code IN (
    'company_apply', 
    'contract', 
    'product_cert', 
    'pricing_quote', 
    'logistics_inventory', 
    'settlement_inquiry'
  ))
);

-- 2. RLS 활성화
ALTER TABLE public.company_task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_task_assignments FORCE ROW LEVEL SECURITY;

-- 3. 주 담당자 중복 방지 고유 인덱스 설정 (회사당 각 업무별 주 담당자는 단 1명만 허용)
CREATE UNIQUE INDEX IF NOT EXISTS company_task_assignments_unique_primary 
ON public.company_task_assignments (company_id, task_code) 
WHERE (is_primary = true);

-- 4. RLS Select 정책: 본인 소속 회사 데이터이거나 Letusto 어드민인 경우 조회 가능
CREATE POLICY "company_task_assignments_select" 
  ON public.company_task_assignments FOR SELECT 
  TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());

-- 5. RLS Insert/Update/Delete 정책: 본인 회사 소속의 Admin(company_admin) 이거나 Letusto 어드민인 경우 변경 가능
CREATE POLICY "company_task_assignments_all_write" 
  ON public.company_task_assignments FOR ALL
  TO authenticated 
  USING (
    public.auth_is_admin() OR 
    (
      company_id = public.auth_company_id() AND 
      EXISTS (
        SELECT 1 FROM public.company_users 
        WHERE id = auth.uid() AND company_role = 'company_admin'
      )
    )
  );

-- 6. 담당 업무 변경 로그(이력) 테이블 생성
CREATE TABLE IF NOT EXISTS public.company_task_assignment_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  task_code text NOT NULL,
  is_primary boolean NOT NULL,
  email_notify boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  changed_path text NOT NULL
);

-- 로그 테이블 RLS 활성화 및 권한 설정
ALTER TABLE public.company_task_assignment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_task_assignment_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_task_assignment_logs_select" 
  ON public.company_task_assignment_logs FOR SELECT 
  TO authenticated 
  USING (company_id = public.auth_company_id() OR public.auth_is_admin());
