-- 0044_simulation_results.sql — B2B 리테일러 성장 시뮬레이터 연산 이력 적재
--

CREATE TABLE IF NOT EXISTS public.simulation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  answers_snapshot jsonb NOT NULL,
  result_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.simulation_results IS 
  '미국 리테일러 바이어의 성장 시뮬레이터 설문 응답 및 엔진 계산 결과 히스토리 아카이브';

-- RLS 활성화
ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_results FORCE ROW LEVEL SECURITY;

-- 정책 1: 어드민 직원은 모든 기록을 조회할 수 있음.
CREATE POLICY "simulation_results_admin_select" 
  ON public.simulation_results FOR SELECT 
  TO authenticated 
  USING (public.auth_is_admin());

-- 정책 2: 누구나 (비로그인 익명 유저 포함) 시뮬레이션 결과를 DB에 신규 입력할 수 있음.
-- (마케팅 사이트 kselecthub.com 에서 설문을 마치면 API를 통해 DB에 이력을 적재해야 하기 때문)
CREATE POLICY "simulation_results_public_insert" 
  ON public.simulation_results FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);
