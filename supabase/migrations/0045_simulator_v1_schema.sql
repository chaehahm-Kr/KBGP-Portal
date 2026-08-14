-- 0045_simulator_v1_schema.sql — K SELECT Growth Simulator Engine v1 설계 스키마 정의
-- [ADDITIVE / NON-DESTRUCTIVE 버전 — 데이터와 기존 테이블을 절대 DROP하지 않음]
--

-- 1. 설문지 마스터 테이블 (Simulator Questionnaires)
CREATE TABLE IF NOT EXISTS public.simulator_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.simulator_questionnaires IS '설문지 버전 관리 및 활성화 상태 마스터';

-- 2. 질문 마스터 테이블 (Simulator Questions)
CREATE TABLE IF NOT EXISTS public.simulator_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.simulator_questionnaires(id) ON DELETE CASCADE,
  question_id text NOT NULL, -- 예: Q1, Q2
  section text NOT NULL, -- 예: BASIC, DETAIL, FINANCIAL, BEHAVIOR
  importance text NOT NULL CHECK (importance IN ('A', 'B', 'C')),
  type text NOT NULL CHECK (type IN ('single-select', 'multi-select', 'ranking')),
  label_ko text NOT NULL,
  label_en text NOT NULL,
  multi_select_policy text NOT NULL DEFAULT 'NEUTRAL' CHECK (multi_select_policy IN ('NEUTRAL', 'STRONGEST_SIGNAL_ONLY', 'UNIQUE_TAG_ACCUMULATION', 'CUMULATIVE_WITH_CAP', 'RANK_POSITION_WEIGHT_REQUIRED')),
  max_question_contribution numeric, -- 질문 단위 가점 제한 상한선
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_question_per_version UNIQUE (questionnaire_id, question_id)
);

COMMENT ON TABLE public.simulator_questions IS '설문지 내 질문 정보 마스터';

-- 3. 답변 선택지 테이블 (Simulator Answers)
CREATE TABLE IF NOT EXISTS public.simulator_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.simulator_questions(id) ON DELETE CASCADE,
  answer_id text NOT NULL, -- 예: Q1_A1, Q1_A2
  label_ko text NOT NULL,
  label_en text NOT NULL,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_answer_per_question UNIQUE (question_id, answer_id)
);

COMMENT ON TABLE public.simulator_answers IS '질문별 분기 답변 선택지 마스터';

-- 4. 답변 매핑 규칙 테이블 (Simulator Answer Mappings)
CREATE TABLE IF NOT EXISTS public.simulator_answer_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL UNIQUE REFERENCES public.simulator_answers(id) ON DELETE CASCADE,
  tag_code text, -- public.matching_tags(tag_code)와 연계
  tag_strength text CHECK (tag_strength IN ('WEAK', 'MEDIUM', 'STRONG', 'NEUTRAL', NULL)),
  ap_signal_path text NOT NULL DEFAULT 'NEUTRAL' CHECK (ap_signal_path IN ('NEUTRAL', 'TAG_ONLY', 'DIRECT_AP_ONLY', 'TAG_PLUS_DIRECT_AP_JUSTIFIED', 'REMOVE_DIRECT_AP')),
  direct_ap text CHECK (direct_ap IN ('BALANCE', 'SKIN', 'HAIR', 'ESSENTIAL', 'TREND', 'PREMIUM', 'NEUTRAL', NULL)),
  display_signal text, -- 예: START, GROW, EXPAND, NEUTRAL, START / GROW, etc.
  display_strength text NOT NULL DEFAULT 'NEUTRAL' CHECK (display_strength IN ('NEUTRAL', 'WEAK_EVIDENCE', 'MEDIUM_EVIDENCE', 'STRONG_EVIDENCE', 'HARD_CONSTRAINT')),
  hard_constraint text, -- 예: EXCLUDE GROW_8FT, EXCLUDE EXPAND_12FT
  turnover_category text NOT NULL DEFAULT 'NONE' CHECK (turnover_category IN ('NONE', 'DEMAND_VELOCITY', 'REPLENISHMENT_EFFICIENCY', 'BOTH', 'CONTEXT_DEPENDENT')),
  turnover_direction text NOT NULL DEFAULT 'NEUTRAL' CHECK (turnover_direction IN ('NEUTRAL', 'POSITIVE', 'NEGATIVE', 'CONTEXT_DEPENDENT')),
  financial_category text NOT NULL DEFAULT 'NO_FINANCIAL_SIGNAL' CHECK (financial_category IN ('NO_FINANCIAL_SIGNAL', 'PRICE_MIX', 'PURCHASE_CAPACITY', 'INITIAL_BUDGET', 'MARGIN_ASSUMPTION')),
  confidence_signal text NOT NULL DEFAULT 'NEUTRAL' CHECK (confidence_signal IN ('NEUTRAL', 'HIGH_QUALITY', 'PENALTY', 'LOWER_INFORMATION_QUALITY')),
  business_rationale text,
  validation_status text NOT NULL DEFAULT 'READY_FOR_CALIBRATION' CHECK (validation_status IN ('READY_FOR_CALIBRATION', 'NEUTRAL_CONFIRMED', 'CONTEXT_DEPENDENT', 'BUSINESS_REVIEW_REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.simulator_answer_mappings IS '각 답변 선택지별 계산 엔진 연동 속성 및 비즈니스 매핑';

-- 5. 조건부 노출 규칙 테이블 (Simulator Conditional Rules)
CREATE TABLE IF NOT EXISTS public.simulator_conditional_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.simulator_questionnaires(id) ON DELETE CASCADE,
  target_question_id text NOT NULL, -- 종속 질문 ID (예: Q30)
  trigger_question_id text NOT NULL, -- 트리거 질문 ID (예: Q3)
  trigger_values text[] NOT NULL, -- 트리거를 만족하는 답변 라벨 배열 (한국어 매칭 기준)
  action text NOT NULL DEFAULT 'show',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_conditional_rule UNIQUE (questionnaire_id, target_question_id, trigger_question_id)
);

COMMENT ON TABLE public.simulator_conditional_rules IS '설문지 내 질문 간 동적 SHOW/HIDE 조건부 규칙';

-- 6. 중앙 보정 매개변수 테이블 (Simulator Parameters)
CREATE TABLE IF NOT EXISTS public.simulator_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.simulator_questionnaires(id) ON DELETE CASCADE,
  parameter_key text NOT NULL, -- 예: display_weight_strong, q35_base_turns
  parameter_value jsonb NOT NULL, -- 복합 값(배열, 객체 등) 저장을 위한 JSONB
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_parameter_per_version UNIQUE (questionnaire_id, parameter_key)
);

COMMENT ON TABLE public.simulator_parameters IS '시뮬레이터 가중치 및 재무/신뢰도 계산용 글로벌 파라미터 버전 설정';

-- 7. 기존 simulation_results 테이블에 questionnaire_id 참조 컬럼 추가 (ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.simulation_results 
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES public.simulator_questionnaires(id) ON DELETE SET NULL;


-- RLS(Row Level Security) 활성화 (동일 명령 재실행 시 오류 없음)
ALTER TABLE public.simulator_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_answer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_conditional_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_parameters ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (CREATE POLICY 오류 방지용 안전 장치)
DROP POLICY IF EXISTS simulator_questionnaires_select ON public.simulator_questionnaires;
DROP POLICY IF EXISTS simulator_questions_select ON public.simulator_questions;
DROP POLICY IF EXISTS simulator_answers_select ON public.simulator_answers;
DROP POLICY IF EXISTS simulator_answer_mappings_select ON public.simulator_answer_mappings;
DROP POLICY IF EXISTS simulator_conditional_rules_select ON public.simulator_conditional_rules;
DROP POLICY IF EXISTS simulator_parameters_select ON public.simulator_parameters;

DROP POLICY IF EXISTS simulator_questionnaires_admin_all ON public.simulator_questionnaires;
DROP POLICY IF EXISTS simulator_questions_admin_all ON public.simulator_questions;
DROP POLICY IF EXISTS simulator_answers_admin_all ON public.simulator_answers;
DROP POLICY IF EXISTS simulator_answer_mappings_admin_all ON public.simulator_answer_mappings;
DROP POLICY IF EXISTS simulator_conditional_rules_admin_all ON public.simulator_conditional_rules;
DROP POLICY IF EXISTS simulator_parameters_admin_all ON public.simulator_parameters;

-- SELECT 정책: 누구나 (anon 및 authenticated) 활성 스키마를 조회하여 엔진 계산에 사용할 수 있음
CREATE POLICY "simulator_questionnaires_select" ON public.simulator_questionnaires FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "simulator_questions_select" ON public.simulator_questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "simulator_answers_select" ON public.simulator_answers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "simulator_answer_mappings_select" ON public.simulator_answer_mappings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "simulator_conditional_rules_select" ON public.simulator_conditional_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "simulator_parameters_select" ON public.simulator_parameters FOR SELECT TO anon, authenticated USING (true);

-- ALL 정책: 어드민 직원(auth_is_admin)만 등록/수정/삭제 가능
CREATE POLICY "simulator_questionnaires_admin_all" ON public.simulator_questionnaires FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "simulator_questions_admin_all" ON public.simulator_questions FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "simulator_answers_admin_all" ON public.simulator_answers FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "simulator_answer_mappings_admin_all" ON public.simulator_answer_mappings FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "simulator_conditional_rules_admin_all" ON public.simulator_conditional_rules FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "simulator_parameters_admin_all" ON public.simulator_parameters FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
