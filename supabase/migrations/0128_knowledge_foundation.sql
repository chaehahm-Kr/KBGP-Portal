-- Migration: 0128_knowledge_foundation.sql
-- Description: Knowledge Foundation & Storage Schema for K SELECT NETWORK (ADM-KNW-001)

-- 1. Knowledge Items Table
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id text PRIMARY KEY,
    slug text UNIQUE,
    title text NOT NULL,
    title_ko text,
    title_en text,
    summary_ko text,
    summary_en text,
    content_ko text,
    content_en text,
    type text NOT NULL DEFAULT 'MANUAL',
    source_type text DEFAULT 'CONTENT',
    linked_system_setting_key text,
    linked_system_setting_name text,
    linked_system_setting_value text,
    module text NOT NULL DEFAULT 'General',
    category text DEFAULT 'General',
    tags text[] DEFAULT '{}',
    owner_id text,
    owner_name text,
    status text NOT NULL DEFAULT 'PUBLISHED',
    system_impact_status text DEFAULT 'NORMAL',
    system_impact_reason text,
    system_impact_updated_at timestamptz,
    audience text[] DEFAULT '{"INTERNAL"}',
    is_sensitive_internal boolean DEFAULT false,
    requires_external_approval boolean DEFAULT false,
    external_review_status text DEFAULT 'NONE',
    external_reviewer_id text,
    external_reviewed_at timestamptz,
    current_version text DEFAULT 'v1.0',
    effective_date text,
    document_url text,
    document_name text,
    document_size bigint,
    document_type text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Knowledge Versions Table
CREATE TABLE IF NOT EXISTS public.knowledge_versions (
    id text PRIMARY KEY,
    knowledge_id text NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    version text NOT NULL,
    status text NOT NULL DEFAULT 'PUBLISHED',
    title_ko text,
    title_en text,
    summary_ko text,
    summary_en text,
    content_ko text,
    content_en text,
    what_changed text,
    why_changed text,
    effective_date text,
    document_url text,
    document_name text,
    created_by_id text,
    created_by_name text,
    reviewer_id text,
    approver_id text,
    published_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 3. Knowledge Manual / Document Assets Table
CREATE TABLE IF NOT EXISTS public.knowledge_manual_assets (
    id text PRIMARY KEY,
    knowledge_id text NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    manual_title text NOT NULL,
    version text NOT NULL DEFAULT 'v1.0',
    language text NOT NULL DEFAULT 'KO',
    is_current boolean NOT NULL DEFAULT true,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    published_date text,
    created_at timestamptz DEFAULT now()
);

-- 4. Knowledge Relations Table
CREATE TABLE IF NOT EXISTS public.knowledge_relations (
    id text PRIMARY KEY,
    knowledge_id text NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    related_portal text,
    related_module text,
    related_menu text,
    related_route text,
    related_system_setting text,
    target_knowledge_id text,
    manual_title text,
    faq_question text,
    created_at timestamptz DEFAULT now()
);

-- 5. Knowledge Audit Logs Table
CREATE TABLE IF NOT EXISTS public.knowledge_audit_logs (
    id text PRIMARY KEY,
    knowledge_id text NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    user_id text,
    user_name text,
    action text NOT NULL,
    previous_value jsonb DEFAULT '{}'::jsonb,
    new_value jsonb DEFAULT '{}'::jsonb,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- 6. Knowledge System Impact Triggers Table
CREATE TABLE IF NOT EXISTS public.knowledge_system_impact_triggers (
    id text PRIMARY KEY,
    setting_key text NOT NULL,
    setting_name text,
    old_value text,
    new_value text,
    impacted_knowledge_ids text[] DEFAULT '{}',
    triggered_by text,
    resolved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Indexes for Fast Search and Filter
CREATE INDEX IF NOT EXISTS idx_knowledge_items_module ON public.knowledge_items(module);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON public.knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON public.knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_audience ON public.knowledge_items USING gin(audience);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_kid ON public.knowledge_versions(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_kid ON public.knowledge_manual_assets(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_kid ON public.knowledge_relations(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_kid ON public.knowledge_audit_logs(knowledge_id);

-- Enable RLS on all tables
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_manual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_system_impact_triggers ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access Policies
DROP POLICY IF EXISTS "Service role full access on knowledge_items" ON public.knowledge_items;
CREATE POLICY "Service role full access on knowledge_items" ON public.knowledge_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on knowledge_versions" ON public.knowledge_versions;
CREATE POLICY "Service role full access on knowledge_versions" ON public.knowledge_versions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on knowledge_manual_assets" ON public.knowledge_manual_assets;
CREATE POLICY "Service role full access on knowledge_manual_assets" ON public.knowledge_manual_assets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on knowledge_relations" ON public.knowledge_relations;
CREATE POLICY "Service role full access on knowledge_relations" ON public.knowledge_relations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on knowledge_audit_logs" ON public.knowledge_audit_logs;
CREATE POLICY "Service role full access on knowledge_audit_logs" ON public.knowledge_audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on knowledge_system_impact_triggers" ON public.knowledge_system_impact_triggers;
CREATE POLICY "Service role full access on knowledge_system_impact_triggers" ON public.knowledge_system_impact_triggers FOR ALL USING (true) WITH CHECK (true);

-- Authenticated Read Policies
DROP POLICY IF EXISTS "Allow authenticated read for published knowledge" ON public.knowledge_items;
CREATE POLICY "Allow authenticated read for published knowledge" ON public.knowledge_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated read for knowledge versions" ON public.knowledge_versions;
CREATE POLICY "Allow authenticated read for knowledge versions" ON public.knowledge_versions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated read for knowledge manual assets" ON public.knowledge_manual_assets;
CREATE POLICY "Allow authenticated read for knowledge manual assets" ON public.knowledge_manual_assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated read for knowledge relations" ON public.knowledge_relations;
CREATE POLICY "Allow authenticated read for knowledge relations" ON public.knowledge_relations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated read for knowledge audit logs" ON public.knowledge_audit_logs;
CREATE POLICY "Allow authenticated read for knowledge audit logs" ON public.knowledge_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated read for knowledge triggers" ON public.knowledge_system_impact_triggers;
CREATE POLICY "Allow authenticated read for knowledge triggers" ON public.knowledge_system_impact_triggers FOR SELECT USING (true);

-- 7. Seed Official Knowledge Set (11 Canonical Items)
INSERT INTO public.knowledge_items (
    id, slug, title, title_ko, title_en, summary_ko, summary_en, content_ko, content_en,
    type, source_type, linked_system_setting_key, linked_system_setting_name, linked_system_setting_value,
    module, category, tags, owner_id, owner_name, status, system_impact_status,
    audience, is_sensitive_internal, requires_external_approval, external_review_status,
    current_version, effective_date, document_url, document_name, document_size, document_type,
    created_at, updated_at
) VALUES
(
    'kno-insights-manual-v10',
    'k-select-insights-operational-manual-v1',
    'K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0',
    'K SELECT INSIGHTS 실무자 운영 매뉴얼',
    'K SELECT INSIGHTS Operational Manual v1.0',
    'Daily Auto Insight Engine + Editorial Control Center 실무자가 알아야 할 기능, 검토 기준, 승인 절차 종합 안내서',
    'Comprehensive operational guide for K SELECT INSIGHTS Daily Auto Engine and Editorial Control Center.',
    '## 1. 개요 (Overview)
K SELECT INSIGHTS는 매일 아침 미국 K-Beauty 유통/브랜드 시장 시그널을 조사하고 분석하여 실무자의 신속한 의사 결정을 지원하는 Daily Auto Insight Engine + Editorial Control Center입니다.

## 2. 주요 운영 원칙 (Core Operational Principles)
- **AUTOMATION**: 매일 05:00 ET (America/New_York 타임존) 자동 실행
- **QUOTA**: NETWORK / HUB 각 최대 3개 Draft (기준 통과 초안만 생성, 0개도 정상)
- **QUALITY**: Topic Score 80점 이상 주제만 후보로 채택
- **HUMAN GATE**: Automation은 AI_DRAFT까지만 생성하며, 자동 Publish 금지 (최종 승인 권한은 사람에게 있음)

## 3. 실무자의 역할 4가지
1. 오늘 생성된 Draft 확인
2. 내용 · Fact Check · Source · Audience 적합성 검토
3. 필요 시 Revision 요청
4. 최종 승인 후 Schedule 또는 Publish

> [!IMPORTANT]
> **기억할 한 문장**: AI는 조사와 초안을 담당하고, 최종 Editorial Authority는 사람에게 있습니다.',
    '## 1. Overview
K SELECT INSIGHTS is a Daily Auto Insight Engine + Editorial Control Center scanning US K-Beauty retail market signals.

## 2. Core Operational Principles
- **AUTOMATION**: Daily 05:00 ET execution (America/New_York timezone)
- **QUOTA**: NETWORK / HUB Max 3 Drafts each (0 Draft day is normal)
- **QUALITY**: Topic Score 80+ points threshold
- **HUMAN GATE**: Automation creates up to AI_DRAFT. Automatic publish is strictly forbidden.

> [!IMPORTANT]
> **One Sentence to Remember**: AI handles research and drafting; final Editorial Authority belongs to humans.',
    'MANUAL',
    'CONTENT',
    NULL, NULL, NULL,
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'MANUAL', 'OPERATIONS', 'INTERNAL'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    '/api/admin/knowledge/asset/asset-insights-manual-v10',
    'K_SELECT_INSIGHTS_실무자_운영_메뉴얼_v1.0.pdf',
    7239179,
    'application/pdf',
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-insights-rule-daily-auto',
    'insights-daily-auto-insight-operational-rule',
    'INSIGHTS Daily Auto Insight 운영 기준',
    'INSIGHTS Daily Auto Insight 운영 기준',
    'INSIGHTS Daily Auto Insight Operational Rules',
    '매일 05:00 ET 자동 실행, Topic Score 80+, NETWORK/HUB 각 최대 3 Draft Quota 및 Human Approval 원칙',
    'Operational rules for 05:00 ET Daily Auto Engine, minimum topic score 80+, max 3 draft quotas, and mandatory human approval.',
    '## 1. 개요 (Overview)
본 시스템 룰은 K SELECT INSIGHTS Daily Auto Insight Engine의 자동 조사, 품질 스크리닝, 초안 생성을 위한 핵심 운영 기준입니다.

## 2. 매뉴얼 명시 핵심 운영 기준 (Core Criteria)
- **Daily Automation**: 매일 **05:00 ET** (America/New_York 타임존 기준) 자동 실행
- **Draft Quota**: **NETWORK 최대 3개, HUB 최대 3개** (기준을 통과한 Draft만 생성하며, 기준 미충족 시 **0개 Draft 생성도 정상**)
- **Quality Score**: **Topic Score 80점 이상** (주제 가치를 100점 만점으로 평가)
- **Human Gate (승인 통제)**: Automation은 **AI_DRAFT**까지만 생성합니다. 자동 Publish(Automatic Publish)는 엄격히 금지되며, 반드시 사람(Human Editor)의 검토 및 승인이 필요합니다.

## 3. 라이브 연동 시스템 설정 (Live Linked System Setting)
- **연결 메뉴**: Insights → Editorial Rules (`/admin/insights/rules`)
- **시스템 설정 항목**: `insights_daily_auto_rule` (05:00 ET / Score 80+ / Quota Max 3)
- **우선순위 원칙**: Live System Rule 설정값이 현재값의 우선 Source입니다.',
    '## 1. Overview
Core system rule for K SELECT INSIGHTS Daily Auto Engine qualification and draft generation.

## 2. Core Criteria
- **Daily Automation**: Daily at 05:00 ET (America/New_York timezone)
- **Draft Quota**: NETWORK Max 3, HUB Max 3 (0 Draft day is normal)
- **Quality Score**: Topic Score 80+
- **Human Gate**: Automation stops at AI_DRAFT. Automatic publish forbidden.',
    'SYSTEM_RULE',
    'HYBRID',
    'insights_daily_auto_rule',
    'Insights Editorial Rules → Daily Auto Insight Configuration',
    '05:00 ET | Score 80+ | Max 3 Drafts',
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'SYSTEM_RULE', 'HYBRID', 'Topic Score', 'Automation', 'Quota'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL', 'ADMIN / MANAGEMENT'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-insights-policy-factcheck-risk',
    'insights-fact-check-risk-review-policy',
    'INSIGHTS Fact Check & Risk Review 기준',
    'INSIGHTS Fact Check & Risk Review 기준',
    'INSIGHTS Fact Check & Risk Review Policy',
    'HIGH(규제/숫자/강한인과), MEDIUM(트렌드/모멘텀), LOW(해석/권장) 위험도 분류별 검증 절차',
    'Fact check and risk review policy categorizing HIGH, MEDIUM, and LOW risk claims.',
    '## 1. 개요 (Overview)
본 정책은 K SELECT INSIGHTS에 수집 및 생성되는 모든 Claim과 데이터의 위험도별 Fact Check 및 검증 가이드라인입니다.

## 2. 위험도 단계별 검증 기준 (Risk Levels & Verification Criteria)

### HIGH Risk
- **대상**: 규제(Regulation), 정확한 숫자(%), 금액($), 시장 규모(Market Size), 성장률(Growth Rate), 강한 인과관계 문장
- **행동**: 반드시 뒷받침하는 **Source / Evidence**를 직접 재확인.
- **절대 승인 전 확인 문장 예시**: `"FDA certification"`, `"매출 +22% 보장"`, `"객단가 $35 증가"`, `"미국 전역에서 폭발적 성장"` 등 강한 표현은 HIGH Risk로 보고 근거 원본을 필수 확인.

### MEDIUM Risk
- **대상**: 시장 트렌드(Market Trend), 검색량 증가(Search Growth), 카테고리 모멘텀(Category Momentum)
- **행동**: 표현 강도가 적절한지 및 신호("signals suggest") 수준인지 근거 확인.

### LOW Risk
- **대상**: K SELECT 자체 해석(Interpretation), 운영 권장사항(Operational Recommendation), 체크리스트
- **행동**: K SELECT 내부 의견임이 명확하며 외부 객관적 Fact처럼 포장되지 않았는지 확인.',
    '## 1. Overview
Fact Check & Risk Review guidelines for claims in K SELECT INSIGHTS.

## 2. Risk Levels
- **HIGH Risk**: Regulations, %, $, market size, growth rates, strong causal claims -> Source / Evidence verification mandatory.
- **MEDIUM Risk**: Market trends, search growth, category momentum -> Check expression strength and "signals suggest" wording.
- **LOW Risk**: K SELECT interpretation, operational recommendations -> Ensure internal opinion is not framed as external fact.',
    'POLICY',
    'CONTENT',
    NULL, NULL, NULL,
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'POLICY', 'Fact Check', 'Risk Review', 'Evidence'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-insights-def-claim-status',
    'insights-claim-status-definitions',
    'INSIGHTS Claim Status 정의',
    'INSIGHTS Claim Status 정의',
    'INSIGHTS Claim Status Definitions',
    'FACT VERIFIED, VIEW INFERRED, SIGNAL, INTERNAL, ESTIMATE, STOP / UNSUPPORTED 6가지 Claim Status의 상세 정의',
    'Detailed definitions for 6 Insight Claim Status types.',
    '## 1. 개요 (Overview)
K SELECT INSIGHTS 본문 내 개별 Claim에 부여되는 6가지 표준 상태(Claim Status)의 정의입니다.

## 2. Claim Status 분류 및 정의

1. **FACT VERIFIED**: 신뢰할 수 있는 외부 Source가 직접 뒷받침하는 검증된 사실.
2. **VIEW INFERRED**: 검증된 Fact를 바탕으로 도출한 K SELECT의 분석 및 해석.
3. **SIGNAL**: Search, Social, Marketplace 데이터에서 포착된 방향성 신호.
4. **INTERNAL**: K SELECT 내부 데이터, 운영 규칙 및 권장 가이드라인.
5. **ESTIMATE**: 데이터 모델링 및 계산에 기초한 추정치.
6. **STOP / UNSUPPORTED**: 근거 부족, 핵심 Claim이면 승인 금지.',
    '## 1. Overview
Definitions for 6 Insight Claim Status types:
1. **FACT VERIFIED**: Directly supported fact by credible source.
2. **VIEW INFERRED**: K SELECT interpretation based on verified fact.
3. **SIGNAL**: Search/Social/Marketplace directional signal.
4. **INTERNAL**: K SELECT internal data, rules, or recommendations.
5. **ESTIMATE**: Modeling/calculated estimate.
6. **STOP / UNSUPPORTED**: Insufficient evidence. Approval forbidden if core claim.',
    'DEFINITION',
    'CONTENT',
    NULL, NULL, NULL,
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'DEFINITION', 'Claim Status', 'Fact Check'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-insights-sop-review-decision',
    'insights-approve-revision-reject-sop',
    'INSIGHTS Approve / Revision / Reject 판단 기준',
    'INSIGHTS Approve / Revision / Reject 판단 기준',
    'INSIGHTS Approve, Revision, & Reject Decision SOP',
    'GO·APPROVE, FIX·REQUEST REVISION, STOP·REJECT 판단 기준과 구체적 Revision 요청 작성 원칙',
    'Decision criteria for GO/FIX/STOP and specific revision request writing principles.',
    '## 1. 개요 (Overview)
AI_DRAFT 검토 후 실무자가 내리는 3가지 결정 상태(GO / FIX / STOP)에 대한 표준 운영 절차입니다.

## 2. 판단 기준 (Decision Criteria)

- **GO · APPROVE**: 주제가 유용하고 Fact Check가 안전하며 Audience Action이 분명할 때 최종 승인합니다.
- **FIX · REQUEST REVISION**: 아이디어는 좋지만 표현, Source, Action, 번역, Visual 중 일부가 부족할 때 수정 요청합니다.
- **STOP · REJECT**: 주제 자체가 가치가 없거나 중복이 심하거나 핵심 Evidence가 성립하지 않을 때 거절합니다.

## 3. Revision 요청 작성 원칙 (Revision Principles)
전체 글을 무조건 다시 쓰게 하지 말고, 다음 세 가지 요소를 구체적으로 명시하여 요청합니다:
> **"어느 Audience / 어느 Section / 무엇을 어떻게 바꿀지"**

### 작성 예시:
- *"HUB Retailer Action이 너무 일반적입니다. Independent Beauty Supply 기준으로 3개 행동으로 구체화해주세요."*
- *"$35 basket increase 수치는 Source가 불명확합니다. 근거를 연결하거나 숫자를 제거하고 Opportunity 표현으로 낮춰주세요."*
- *"Hero Image가 기사보다 Cosmetic 광고처럼 보입니다. Scalp Care category signal을 보여주는 Editorial visual로 변경해주세요."*',
    '## 1. Overview
Standard operating procedures for GO, FIX, and STOP editorial decisions.

## 2. Decision Criteria
- **GO · APPROVE**: Useful topic, safe fact check, clear audience action.
- **FIX · REQUEST REVISION**: Good idea but lacking phrasing, source, action, translation, or visual.
- **STOP · REJECT**: Low value, severe duplicate, or unverified evidence.

## 3. Revision Request Principle
Do not ask to rewrite completely. Specify:
> **"Which Audience / Which Section / What to change and how"**',
    'SOP',
    'CONTENT',
    NULL, NULL, NULL,
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'SOP', 'Approve', 'Revision', 'Reject'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-insights-guide-automation-run-status',
    'insights-automation-run-status-guide',
    'INSIGHTS Automation Run Status Guide',
    'INSIGHTS Automation Run Status Guide',
    'INSIGHTS Automation Run Status Guide',
    'COMPLETED, PARTIAL, FAILED, SKIPPED_DUPLICATE, SKIPPED_TIME_WINDOW 상태와 "0 Draft Day ≠ Failure" 운영 원칙',
    'Operational guide for Automation Run status codes and the "0 Draft Day ≠ Failure" principle.',
    '## 1. 개요 (Overview)
매일 05:00 ET 자동 Research의 실행 상태(Automation Run Status)에 대한 해석 가이드입니다.

## 2. Automation Run Status 구분

- **COMPLETED**: 정상 종료 (Draft가 0개여도 기준 미달에 따른 정상이므로 성공 처리됨)
- **PARTIAL**: 일부 Candidate 분석 또는 Visual 생성 실패 (Error Summary 확인 필요)
- **FAILED**: Run 자체 실패 (Source, Scheduler, Auth 등 시스템 오류 확인)
- **SKIPPED_DUPLICATE**: 오늘 이미 Run이 성공 완료됨 (중복 실행 방지)
- **SKIPPED_TIME_WINDOW**: 05:00 ET 실행 창이 아님 (정상 보호 로직)

## 3. 핵심 운영 원칙: "0 Draft Day ≠ Failure"
기준을 통과한 Topic이 없으면 *"No qualifying Insight candidates today"*로 끝나는 것이 정상입니다. 수량을 채우기 위해 저품질 글을 만들지 않습니다.',
    '## 1. Overview
Status guide for daily 05:00 ET Automation Runs.

## 2. Status Codes
- **COMPLETED**: Normal completion (0 Draft day is normal).
- **PARTIAL**: Partial candidate analysis or visual failure.
- **FAILED**: Run failure (Check sources, scheduler, auth).
- **SKIPPED_DUPLICATE**: Run already completed today.
- **SKIPPED_TIME_WINDOW**: Outside 05:00 ET execution window.

## 3. Principle: 0 Draft Day ≠ Failure
No qualifying candidates today is normal if no topic passes 80+ threshold.',
    'GUIDE',
    'CONTENT',
    NULL, NULL, NULL,
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'GUIDE', 'Automation Run', 'Automation'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-insights-policy-prohibitions',
    'insights-editor-prohibitions-policy',
    'INSIGHTS 실무자 금지사항',
    'INSIGHTS 실무자 금지사항',
    'INSIGHTS Editor Prohibitions & Compliance Policy',
    'Editorial Rules 임의 변경, AI_DRAFT 바로 Publish, 근거 없는 숫자 유지 등 6대 금지사항',
    'Six strict prohibition rules for INSIGHTS internal editors.',
    '## 1. 개요 (Overview)
K SELECT INSIGHTS를 처음 사용하는 실무자가 반드시 준수해야 하는 6가지 철저한 금지사항(DO NOT Rules)입니다.

## 2. 실무자 6대 금지사항 (DO NOT Rules)

1. **DO NOT · Editorial Rules 임의 변경 금지**: 80점 기준, Quota, 실행 시간, Risk 기준은 운영 데이터를 바탕으로 관리자와 협의 후에만 조정합니다.
2. **DO NOT · AI_DRAFT 바로 Publish 금지**: 제목만 보고 승인하지 말고 HIGH Risk Claim과 Audience Action을 반드시 확인합니다.
3. **DO NOT · 숫자를 "그럴듯해서" 유지 금지**: Source Trace가 없으면 제거, 표현 완화 또는 Revision 요청을 우선적으로 수행합니다.
4. **DO NOT · NETWORK/HUB 동일 취급 금지**: Core Research는 공유하더라도 독자층(한국 브랜드 vs 미국 Store Owner)에 따른 행동 가이드는 달라야 합니다.
5. **DO NOT · Visual을 장식으로 승인 금지**: 단순 이미지가 아닌 기사 이해를 돕고 브랜드 광고처럼 오해되지 않는지 점검합니다.
6. **DO NOT · Production Auth 테스트용 계정 변경 금지**: 테스트/QA 계정을 사용하고 실제 Production Super Admin 정보나 권한을 임의 변경하지 않습니다.',
    '## 1. Overview
Six strict prohibition rules for K SELECT INSIGHTS internal editors.

## 2. Six DO NOT Rules
1. **DO NOT change Editorial Rules arbitrarily**.
2. **DO NOT publish AI_DRAFT directly without review**.
3. **DO NOT keep unverified numbers just because they sound plausible**.
4. **DO NOT treat NETWORK and HUB identically**.
5. **DO NOT approve Visuals merely as decoration**.
6. **DO NOT alter Super Admin accounts for production auth testing**.',
    'POLICY',
    'CONTENT',
    NULL, NULL, NULL,
    'INSIGHTS',
    'INSIGHTS',
    ARRAY['INSIGHTS', 'POLICY', 'Prohibitions', 'Compliance', 'Internal'],
    'staff-admin-01',
    'INSIGHTS Editorial Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    true,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-simulator-rule-config',
    'growth-simulator-model-configuration-rule',
    'Growth Simulator 모형 설정 및 마진 시뮬레이션 기준',
    'Growth Simulator 모형 설정 및 마진 시뮬레이션 기준',
    'Growth Simulator Model Configuration & Margin Simulation Rules',
    'Growth Simulator 모형 파라미터(원가, 수수료, 물류비, 마케팅비) 설정 및 Profitability 계산 기준',
    'Model parameters (COGS, fee, logistics, marketing) setup and profitability calculation rules for Growth Simulator.',
    '## 1. 개요 (Overview)
Growth Simulator는 한국 K-Beauty 브랜드 및 리테일러의 미국 진출 수익성(Profitability) 및 마진 시뮬레이션을 실행하는 어드민 가이던스 툴입니다.

## 2. 시뮬레이터 모형 설정 파라미터 (Model Parameters)
- **COGS (제조원가)**: 공급가 기준 기본 35%~45% 범위 적용
- **Platform Fee (플랫폼 수수료)**: 기본 15% 설정 (프로그램별 차등 적용)
- **Logistics & Duty (물류비 및 관세)**: 건당 통관/배송비 $3.50 및 US Customs Tariff 적용
- **Target Net Margin (목표 순마진)**: 최소 20% 이상 확보를 목표로 수치 모델링

## 3. 실행 절차
1. Admin → Growth Simulator → Configuration (`/admin/simulator/configuration`) 이동
2. 브랜드/상품별 입력값 설정 및 저장
3. Sandbox (`/admin/simulator/sandbox`)에서 시나리오 실행 및 마진 리포트 확인',
    '## 1. Overview
Growth Simulator guides K-Beauty brand profitability and margin modeling for US market entry.

## 2. Parameters
- **COGS**: 35%-45% default
- **Platform Fee**: 15% default
- **Target Net Margin**: Minimum 20% target.',
    'SYSTEM_RULE',
    'HYBRID',
    'simulator_config_rule',
    'Growth Simulator Configuration Rules',
    'Default COGS 40% | Platform Fee 15% | Target Net Margin 20%',
    'SIMULATOR',
    'SIMULATOR',
    ARRAY['SIMULATOR', 'Growth Simulator', 'SYSTEM_RULE', 'Margin', 'Profitability'],
    'staff-admin-01',
    'K SELECT Strategy Desk',
    'ARCHIVED',
    'NORMAL',
    ARRAY['INTERNAL', 'ADMIN / MANAGEMENT'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-simulator-guide-execution',
    'growth-simulator-profitability-execution-guide',
    'Growth Simulator Profitability 시뮬레이션 실행 가이드',
    'Growth Simulator Profitability 시뮬레이션 실행 가이드',
    'Growth Simulator Profitability Simulation Execution Guide',
    'Profitability 시뮬레이션 실행 방법, 시나리오 분석 및 결과 데이터 해석 가이드',
    'Execution guide for profitability simulation, scenario analysis, and result interpretation.',
    '## 1. 개요 (Overview)
Growth Simulator 시뮬레이션 실행 및 결과 데이터 해석을 위한 가이드입니다.

## 2. 시뮬레이션 실행 방법
1. Admin → Growth Simulator → Sandbox (`/admin/simulator/sandbox`)
2. 대상 브랜드 및 상품군 선택
3. 마진 변수(COGS, Marketing Spend, Retain Rate) 슬라이더 조절 후 ''Calculate Profitability'' 실행
4. 생성된 리포트 결과를 시뮬레이션 결과 목록 (`/admin/simulator/results`)에 저장 및 공유',
    '## 1. Overview
Execution guide for Growth Simulator sandbox calculations.',
    'GUIDE',
    'CONTENT',
    NULL, NULL, NULL,
    'SIMULATOR',
    'SIMULATOR',
    ARRAY['SIMULATOR', 'Growth Simulator', 'GUIDE', 'Profitability', 'Scenario'],
    'staff-admin-01',
    'K SELECT Strategy Desk',
    'ARCHIVED',
    'NORMAL',
    ARRAY['INTERNAL'],
    false,
    false,
    'NONE',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-14T08:00:00Z',
    now()
),
(
    'kno-001-internal-manual',
    'admin-sourcing-sop-v1',
    'Admin Brand Sourcing & Verification Operations SOP',
    '관리자 브랜드 소싱 및 검증 표준 운영 절차 (SOP)',
    'Admin Brand Sourcing & Verification Operations SOP',
    '신규 K-뷰티 브랜드 입점 신청서 검증, 내부 마진율 조건 및 규정 준수 평가 프로세스',
    'Standard operating procedure for verifying new K-Beauty brand applications and compliance.',
    '## 1. 개요 (Overview)
본 SOP는 K SELECT NETWORK 내부 관리자가 신규 한국 브랜드사의 입점 신청서를 검증할 때 준수해야 하는 표준 절차입니다.',
    '## 1. Overview
Standard procedure for internal managers verifying new brand applications.',
    'SOP',
    'CONTENT',
    NULL, NULL, NULL,
    'OPERATIONS',
    'OPERATIONS',
    ARRAY['SOP', 'Internal', 'Sourcing', 'Verification'],
    'staff-admin-01',
    'Operations Governance Desk',
    'PUBLISHED',
    'NORMAL',
    ARRAY['INTERNAL'],
    true,
    false,
    'NONE',
    'v1.2',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-01T10:00:00Z',
    now()
),
(
    'kno-002-brand-faq',
    'brand-partner-onboarding-faq',
    'Brand Partner Onboarding & Product Listing FAQ',
    '브랜드 파트너 온보딩 및 제품 등록 안내 FAQ',
    'Brand Partner Onboarding & Product Listing FAQ',
    '미국 유통 네트워크 입점을 원하는 한국 브랜드사를 위한 자주 묻는 질문 및 절차 안내',
    'Frequently asked questions and guides for Korean brand partners entering US retail network.',
    '## Q1. K SELECT NETWORK 입점 자격 요건은 무엇인가요?
미국 시장 진출을 희망하는 정식 등록 한국 화장품 브랜드사입니다.',
    '## Q1. What are the qualification criteria?
Korean cosmetic brands with FDA registration.',
    'FAQ',
    'CONTENT',
    NULL, NULL, NULL,
    'ONBOARDING',
    'ONBOARDING',
    ARRAY['FAQ', 'Brand', 'Onboarding', 'Registration'],
    'staff-admin-02',
    'Brand Sourcing Team',
    'PUBLISHED',
    'NORMAL',
    ARRAY['BRAND', 'PUBLIC'],
    false,
    true,
    'APPROVED',
    'v1.0',
    '2026-08-14',
    NULL, NULL, NULL, NULL,
    '2026-08-05T09:00:00Z',
    now()
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_ko = EXCLUDED.title_ko,
    title_en = EXCLUDED.title_en,
    summary_ko = EXCLUDED.summary_ko,
    summary_en = EXCLUDED.summary_en,
    content_ko = EXCLUDED.content_ko,
    content_en = EXCLUDED.content_en,
    type = EXCLUDED.type,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    status = EXCLUDED.status,
    audience = EXCLUDED.audience,
    current_version = EXCLUDED.current_version,
    effective_date = EXCLUDED.effective_date,
    document_url = EXCLUDED.document_url,
    document_name = EXCLUDED.document_name,
    document_size = EXCLUDED.document_size,
    document_type = EXCLUDED.document_type,
    updated_at = now();

-- 8. Seed Initial Versions for Registered Knowledge Items
INSERT INTO public.knowledge_versions (
    id, knowledge_id, version, status, title_ko, title_en, summary_ko, summary_en,
    content_ko, content_en, what_changed, why_changed, effective_date, created_by_name, published_at, created_at
) VALUES
(
    'ver-insights-manual-v10',
    'kno-insights-manual-v10',
    'v1.0',
    'PUBLISHED',
    'K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0',
    'K SELECT INSIGHTS Operational Manual v1.0',
    '최초 공식 등록 버전',
    'Initial official registered manual version',
    '## 1. 개요 (Overview)
K SELECT INSIGHTS는 매일 아침 미국 K-Beauty 유통/브랜드 시장 시그널을 조사하고 분석하여 실무자의 신속한 의사 결정을 지원하는 Daily Auto Insight Engine + Editorial Control Center입니다.

## 2. 주요 운영 원칙 (Core Operational Principles)
- **AUTOMATION**: 매일 05:00 ET (America/New_York 타임존) 자동 실행
- **QUOTA**: NETWORK / HUB 각 최대 3개 Draft (기준 통과 초안만 생성, 0개도 정상)
- **QUALITY**: Topic Score 80점 이상 주제만 후보로 채택
- **HUMAN GATE**: Automation은 AI_DRAFT까지만 생성하며, 자동 Publish 금지 (최종 승인 권한은 사람에게 있음)

## 3. 실무자의 역할 4가지
1. 오늘 생성된 Draft 확인
2. 내용 · Fact Check · Source · Audience 적합성 검토
3. 필요 시 Revision 요청
4. 최종 승인 후 Schedule 또는 Publish',
    '## 1. Overview
K SELECT INSIGHTS is a Daily Auto Insight Engine + Editorial Control Center scanning US K-Beauty retail market signals.',
    'K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0 최초 공식 등록',
    'Knowledge Center Foundation Registered Item',
    '2026-08-14',
    'INSIGHTS Editorial Desk',
    now(),
    now()
),
(
    'ver-insights-rule-v10',
    'kno-insights-rule-daily-auto',
    'v1.0',
    'PUBLISHED',
    'INSIGHTS Daily Auto Insight 운영 기준',
    'INSIGHTS Daily Auto Insight Operational Rules',
    '최초 공식 등록 버전',
    'Initial official version',
    '## 1. 개요 (Overview)
본 시스템 룰은 K SELECT INSIGHTS Daily Auto Insight Engine의 자동 조사, 품질 스크리닝, 초안 생성을 위한 핵심 운영 기준입니다.',
    '## 1. Overview
Core system rule for K SELECT INSIGHTS Daily Auto Engine qualification and draft generation.',
    'Daily Auto Insight 기준 최초 제정',
    'Editorial System Rule 수립',
    '2026-08-14',
    'INSIGHTS Editorial Desk',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;
