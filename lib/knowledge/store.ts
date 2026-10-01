import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeRelation,
  ManualAsset,
  KnowledgeAuditLog,
  SystemImpactTrigger,
  KnowledgeFilterOptions,
  SecurityUserContext
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

// In-Memory Seed Storage for Fallback and State Guarantee
let INITIALIZED = false;

let memoryItems: KnowledgeItem[] = [];
let memoryVersions: KnowledgeVersion[] = [];
let memoryRelations: KnowledgeRelation[] = [];
let memoryAssets: ManualAsset[] = [];
let memoryLogs: KnowledgeAuditLog[] = [];
let memoryTriggers: SystemImpactTrigger[] = [];

export function initSeedData() {
  if (INITIALIZED) return;

  const now = new Date().toISOString();
  const today = "2026-08-14";

  // Official K SELECT INSIGHTS Seed Knowledge Set (Phase 1.1)
  memoryItems = [
    {
      id: "kno-insights-manual-v10",
      document_url: "/api/admin/knowledge/asset/asset-insights-manual-v10",
      document_name: "K_SELECT_INSIGHTS_실무자_운영_메뉴얼_v1.0.pdf",
      document_size: 7239179,
      document_type: "application/pdf",
      slug: "k-select-insights-operational-manual-v1",
      title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      title_ko: "K SELECT INSIGHTS 실무자 운영 매뉴얼",
      title_en: "K SELECT INSIGHTS Operational Manual v1.0",
      summary_ko: "Daily Auto Insight Engine + Editorial Control Center 실무자가 알아야 할 기능, 검토 기준, 승인 절차 종합 안내서",
      summary_en: "Comprehensive operational guide for K SELECT INSIGHTS Daily Auto Engine and Editorial Control Center.",
      content_ko: `## 1. 개요 (Overview)
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
> **기억할 한 문장**: AI는 조사와 초안을 담당하고, 최종 Editorial Authority는 사람에게 있습니다.`,
      content_en: `## 1. Overview
K SELECT INSIGHTS is a Daily Auto Insight Engine + Editorial Control Center scanning US K-Beauty retail market signals.

## 2. Core Operational Principles
- **AUTOMATION**: Daily 05:00 ET execution (America/New_York timezone)
- **QUOTA**: NETWORK / HUB Max 3 Drafts each (0 Draft day is normal)
- **QUALITY**: Topic Score 80+ points threshold
- **HUMAN GATE**: Automation creates up to AI_DRAFT. Automatic publish is strictly forbidden.

> [!IMPORTANT]
> **One Sentence to Remember**: AI handles research and drafting; final Editorial Authority belongs to humans.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "MANUAL", "OPERATIONS", "INTERNAL"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now
    },
    {
      id: "kno-insights-rule-daily-auto",
      slug: "insights-daily-auto-insight-operational-rule",
      title: "INSIGHTS Daily Auto Insight 운영 기준",
      title_ko: "INSIGHTS Daily Auto Insight 운영 기준",
      title_en: "INSIGHTS Daily Auto Insight Operational Rules",
      summary_ko: "매일 05:00 ET 자동 실행, Topic Score 80+, NETWORK/HUB 각 최대 3 Draft Quota 및 Human Approval 원칙",
      summary_en: "Operational rules for 05:00 ET Daily Auto Engine, minimum topic score 80+, max 3 draft quotas, and mandatory human approval.",
      content_ko: `## 1. 개요 (Overview)
본 시스템 룰은 K SELECT INSIGHTS Daily Auto Insight Engine의 자동 조사, 품질 스크리닝, 초안 생성을 위한 핵심 운영 기준입니다.

## 2. 매뉴얼 명시 핵심 운영 기준 (Core Criteria)
- **Daily Automation**: 매일 **05:00 ET** (America/New_York 타임존 기준) 자동 실행
- **Draft Quota**: **NETWORK 최대 3개, HUB 최대 3개** (기준을 통과한 Draft만 생성하며, 기준 미충족 시 **0개 Draft 생성도 정상**)
- **Quality Score**: **Topic Score 80점 이상** (주제 가치를 100점 만점으로 평가)
- **Human Gate (승인 통제)**: Automation은 **AI_DRAFT**까지만 생성합니다. 자동 Publish(Automatic Publish)는 엄격히 금지되며, 반드시 사람(Human Editor)의 검토 및 승인이 필요합니다.

## 3. 라이브 연동 시스템 설정 (Live Linked System Setting)
- **연결 메뉴**: Insights → Editorial Rules (\`/admin/insights/rules\`)
- **시스템 설정 항목**: \`insights_daily_auto_rule\` (05:00 ET / Score 80+ / Quota Max 3)
- **우선순위 원칙**: Live System Rule 설정값이 현재값의 우선 Source입니다.`,
      content_en: `## 1. Overview
Core system rule for K SELECT INSIGHTS Daily Auto Engine qualification and draft generation.

## 2. Core Criteria
- **Daily Automation**: Daily at 05:00 ET (America/New_York timezone)
- **Draft Quota**: NETWORK Max 3, HUB Max 3 (0 Draft day is normal)
- **Quality Score**: Topic Score 80+
- **Human Gate**: Automation stops at AI_DRAFT. Automatic publish forbidden.`,
      type: "SYSTEM_RULE",
      source_type: "HYBRID",
      linked_system_setting_key: "insights_daily_auto_rule",
      linked_system_setting_name: "Insights Editorial Rules → Daily Auto Insight Configuration",
      linked_system_setting_value: "05:00 ET | Score 80+ | Max 3 Drafts",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "SYSTEM_RULE", "HYBRID", "Topic Score", "Automation", "Quota"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now
    },
    {
      id: "kno-insights-policy-factcheck-risk",
      slug: "insights-fact-check-risk-review-policy",
      title: "INSIGHTS Fact Check & Risk Review 기준",
      title_ko: "INSIGHTS Fact Check & Risk Review 기준",
      title_en: "INSIGHTS Fact Check & Risk Review Policy",
      summary_ko: "HIGH(규제/숫자/강한인과), MEDIUM(트렌드/모멘텀), LOW(해석/권장) 위험도 분류별 검증 절차",
      summary_en: "Fact check and risk review policy categorizing HIGH, MEDIUM, and LOW risk claims.",
      type: "POLICY",
      source_type: "CONTENT",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "POLICY", "Fact Check", "Risk Review", "Evidence"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
본 정책은 K SELECT INSIGHTS에 수집 및 생성되는 모든 Claim과 데이터의 위험도별 Fact Check 및 검증 가이드라인입니다.

## 2. 위험도 단계별 검증 기준 (Risk Levels & Verification Criteria)

### HIGH Risk
- **대상**: 규제(Regulation), 정확한 숫자(%), 금액($), 시장 규모(Market Size), 성장률(Growth Rate), 강한 인과관계 문장
- **행동**: 반드시 뒷받침하는 **Source / Evidence**를 직접 재확인.
- **절대 승인 전 확인 문장 예시**: \`"FDA certification"\`, \`"매출 +22% 보장"\`, \`"객단가 $35 증가"\`, \`"미국 전역에서 폭발적 성장"\` 등 강한 표현은 HIGH Risk로 보고 근거 원본을 필수 확인.

### MEDIUM Risk
- **대상**: 시장 트렌드(Market Trend), 검색량 증가(Search Growth), 카테고리 모멘텀(Category Momentum)
- **행동**: 표현 강도가 적절한지 및 신호("signals suggest") 수준인지 근거 확인.

### LOW Risk
- **대상**: K SELECT 자체 해석(Interpretation), 운영 권장사항(Operational Recommendation), 체크리스트
- **행동**: K SELECT 내부 의견임이 명확하며 외부 객관적 Fact처럼 포장되지 않았는지 확인.`,
      content_en: `## 1. Overview
Fact Check & Risk Review guidelines for claims in K SELECT INSIGHTS.

## 2. Risk Levels
- **HIGH Risk**: Regulations, %, $, market size, growth rates, strong causal claims -> Source / Evidence verification mandatory.
- **MEDIUM Risk**: Market trends, search growth, category momentum -> Check expression strength and "signals suggest" wording.
- **LOW Risk**: K SELECT interpretation, operational recommendations -> Ensure internal opinion is not framed as external fact.`
    },
    {
      id: "kno-insights-def-claim-status",
      slug: "insights-claim-status-definitions",
      title: "INSIGHTS Claim Status 정의",
      title_ko: "INSIGHTS Claim Status 정의",
      title_en: "INSIGHTS Claim Status Definitions",
      summary_ko: "FACT VERIFIED, VIEW INFERRED, SIGNAL, INTERNAL, ESTIMATE, STOP / UNSUPPORTED 6가지 Claim Status의 상세 정의",
      summary_en: "Detailed definitions for 6 Insight Claim Status types.",
      type: "DEFINITION",
      source_type: "CONTENT",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "DEFINITION", "Claim Status", "Fact Check"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
K SELECT INSIGHTS 본문 내 개별 Claim에 부여되는 6가지 표준 상태(Claim Status)의 정의입니다.

## 2. Claim Status 분류 및 정의

1. **FACT VERIFIED**: 신뢰할 수 있는 외부 Source가 직접 뒷받침하는 검증된 사실.
2. **VIEW INFERRED**: 검증된 Fact를 바탕으로 도출한 K SELECT의 분석 및 해석.
3. **SIGNAL**: Search, Social, Marketplace 데이터에서 포착된 방향성 신호.
4. **INTERNAL**: K SELECT 내부 데이터, 운영 규칙 및 권장 가이드라인.
5. **ESTIMATE**: 데이터 모델링 및 계산에 기초한 추정치.
6. **STOP / UNSUPPORTED**: 근거 부족, 핵심 Claim이면 승인 금지.`,
      content_en: `## 1. Overview
Definitions for 6 Insight Claim Status types:
1. **FACT VERIFIED**: Directly supported fact by credible source.
2. **VIEW INFERRED**: K SELECT interpretation based on verified fact.
3. **SIGNAL**: Search/Social/Marketplace directional signal.
4. **INTERNAL**: K SELECT internal data, rules, or recommendations.
5. **ESTIMATE**: Modeling/calculated estimate.
6. **STOP / UNSUPPORTED**: Insufficient evidence. Approval forbidden if core claim.`
    },
    {
      id: "kno-insights-sop-review-decision",
      slug: "insights-approve-revision-reject-sop",
      title: "INSIGHTS Approve / Revision / Reject 판단 기준",
      title_ko: "INSIGHTS Approve / Revision / Reject 판단 기준",
      title_en: "INSIGHTS Approve, Revision, & Reject Decision SOP",
      summary_ko: "GO·APPROVE, FIX·REQUEST REVISION, STOP·REJECT 판단 기준과 구체적 Revision 요청 작성 원칙",
      summary_en: "Decision criteria for GO/FIX/STOP and specific revision request writing principles.",
      type: "SOP",
      source_type: "CONTENT",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "SOP", "Approve", "Revision", "Reject"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
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
- *"Hero Image가 기사보다 Cosmetic 광고처럼 보입니다. Scalp Care category signal을 보여주는 Editorial visual로 변경해주세요."*`,
      content_en: `## 1. Overview
Standard operating procedures for GO, FIX, and STOP editorial decisions.

## 2. Decision Criteria
- **GO · APPROVE**: Useful topic, safe fact check, clear audience action.
- **FIX · REQUEST REVISION**: Good idea but lacking phrasing, source, action, translation, or visual.
- **STOP · REJECT**: Low value, severe duplicate, or unverified evidence.

## 3. Revision Request Principle
Do not ask to rewrite completely. Specify:
> **"Which Audience / Which Section / What to change and how"**`
    },
    {
      id: "kno-insights-guide-automation-run-status",
      slug: "insights-automation-run-status-guide",
      title: "INSIGHTS Automation Run Status Guide",
      title_ko: "INSIGHTS Automation Run Status Guide",
      title_en: "INSIGHTS Automation Run Status Guide",
      summary_ko: "COMPLETED, PARTIAL, FAILED, SKIPPED_DUPLICATE, SKIPPED_TIME_WINDOW 상태와 \"0 Draft Day ≠ Failure\" 운영 원칙",
      summary_en: "Operational guide for Automation Run status codes and the \"0 Draft Day ≠ Failure\" principle.",
      type: "GUIDE",
      source_type: "CONTENT",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "GUIDE", "Automation Run", "Automation"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
매일 05:00 ET 자동 Research의 실행 상태(Automation Run Status)에 대한 해석 가이드입니다.

## 2. Automation Run Status 구분

- **COMPLETED**: 정상 종료 (Draft가 0개여도 기준 미달에 따른 정상이므로 성공 처리됨)
- **PARTIAL**: 일부 Candidate 분석 또는 Visual 생성 실패 (Error Summary 확인 필요)
- **FAILED**: Run 자체 실패 (Source, Scheduler, Auth 등 시스템 오류 확인)
- **SKIPPED_DUPLICATE**: 오늘 이미 Run이 성공 완료됨 (중복 실행 방지)
- **SKIPPED_TIME_WINDOW**: 05:00 ET 실행 창이 아님 (정상 보호 로직)

## 3. 핵심 운영 원칙: "0 Draft Day ≠ Failure"
기준을 통과한 Topic이 없으면 *"No qualifying Insight candidates today"*로 끝나는 것이 정상입니다. 수량을 채우기 위해 저품질 글을 만들지 않습니다.`,
      content_en: `## 1. Overview
Status guide for daily 05:00 ET Automation Runs.

## 2. Status Codes
- **COMPLETED**: Normal completion (0 Draft day is normal).
- **PARTIAL**: Partial candidate analysis or visual failure.
- **FAILED**: Run failure (Check sources, scheduler, auth).
- **SKIPPED_DUPLICATE**: Run already completed today.
- **SKIPPED_TIME_WINDOW**: Outside 05:00 ET execution window.

## 3. Principle: 0 Draft Day ≠ Failure
No qualifying candidates today is normal if no topic passes 80+ threshold.`
    },
    {
      id: "kno-insights-policy-prohibitions",
      slug: "insights-editor-prohibitions-policy",
      title: "INSIGHTS 실무자 금지사항",
      title_ko: "INSIGHTS 실무자 금지사항",
      title_en: "INSIGHTS Editor Prohibitions & Compliance Policy",
      summary_ko: "Editorial Rules 임의 변경, AI_DRAFT 바로 Publish, 근거 없는 숫자 유지 등 6대 금지사항",
      summary_en: "Six strict prohibition rules for INSIGHTS internal editors.",
      type: "POLICY",
      source_type: "CONTENT",
      module: "INSIGHTS",
      category: "INSIGHTS",
      tags: ["INSIGHTS", "POLICY", "Prohibitions", "Compliance", "Internal"],
      owner_id: "staff-admin-01",
      owner_name: "INSIGHTS Editorial Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: true,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
K SELECT INSIGHTS를 처음 사용하는 실무자가 반드시 준수해야 하는 6가지 철저한 금지사항(DO NOT Rules)입니다.

## 2. 실무자 6대 금지사항 (DO NOT Rules)

1. **DO NOT · Editorial Rules 임의 변경 금지**: 80점 기준, Quota, 실행 시간, Risk 기준은 운영 데이터를 바탕으로 관리자와 협의 후에만 조정합니다.
2. **DO NOT · AI_DRAFT 바로 Publish 금지**: 제목만 보고 승인하지 말고 HIGH Risk Claim과 Audience Action을 반드시 확인합니다.
3. **DO NOT · 숫자를 "그럴듯해서" 유지 금지**: Source Trace가 없으면 제거, 표현 완화 또는 Revision 요청을 우선적으로 수행합니다.
4. **DO NOT · NETWORK/HUB 동일 취급 금지**: Core Research는 공유하더라도 독자층(한국 브랜드 vs 미국 Store Owner)에 따른 행동 가이드는 달라야 합니다.
5. **DO NOT · Visual을 장식으로 승인 금지**: 단순 이미지가 아닌 기사 이해를 돕고 브랜드 광고처럼 오해되지 않는지 점검합니다.
6. **DO NOT · Production Auth 테스트용 계정 변경 금지**: 테스트/QA 계정을 사용하고 실제 Production Super Admin 정보나 권한을 임의 변경하지 않습니다.`,
      content_en: `## 1. Overview
Six strict prohibition rules for K SELECT INSIGHTS internal editors.

## 2. Six DO NOT Rules
1. **DO NOT change Editorial Rules arbitrarily**.
2. **DO NOT publish AI_DRAFT directly without review**.
3. **DO NOT keep unverified numbers just because they sound plausible**.
4. **DO NOT treat NETWORK and HUB identically**.
5. **DO NOT approve Visuals merely as decoration**.
6. **DO NOT alter Super Admin accounts for production auth testing**.`
    },
    {
      id: "kno-simulator-rule-config",
      slug: "growth-simulator-model-configuration-rule",
      title: "Growth Simulator 모형 설정 및 마진 시뮬레이션 기준",
      title_ko: "Growth Simulator 모형 설정 및 마진 시뮬레이션 기준",
      title_en: "Growth Simulator Model Configuration & Margin Simulation Rules",
      summary_ko: "Growth Simulator 모형 파라미터(원가, 수수료, 물류비, 마케팅비) 설정 및 Profitability 계산 기준",
      summary_en: "Model parameters (COGS, fee, logistics, marketing) setup and profitability calculation rules for Growth Simulator.",
      type: "SYSTEM_RULE",
      source_type: "HYBRID",
      linked_system_setting_key: "simulator_config_rule",
      linked_system_setting_name: "Growth Simulator Configuration Rules",
      linked_system_setting_value: "Default COGS 40% | Platform Fee 15% | Target Net Margin 20%",
      module: "SIMULATOR",
      category: "SIMULATOR",
      tags: ["SIMULATOR", "Growth Simulator", "SYSTEM_RULE", "Margin", "Profitability"],
      owner_id: "staff-admin-01",
      owner_name: "K SELECT Strategy Desk",
      status: "ARCHIVED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
Growth Simulator는 한국 K-Beauty 브랜드 및 리테일러의 미국 진출 수익성(Profitability) 및 마진 시뮬레이션을 실행하는 어드민 가이던스 툴입니다.

## 2. 시뮬레이터 모형 설정 파라미터 (Model Parameters)
- **COGS (제조원가)**: 공급가 기준 기본 35%~45% 범위 적용
- **Platform Fee (플랫폼 수수료)**: 기본 15% 설정 (프로그램별 차등 적용)
- **Logistics & Duty (물류비 및 관세)**: 건당 통관/배송비 $3.50 및 US Customs Tariff 적용
- **Target Net Margin (목표 순마진)**: 최소 20% 이상 확보를 목표로 수치 모델링

## 3. 실행 절차
1. Admin → Growth Simulator → Configuration (\`/admin/simulator/configuration\`) 이동
2. 브랜드/상품별 입력값 설정 및 저장
3. Sandbox (\`/admin/simulator/sandbox\`)에서 시나리오 실행 및 마진 리포트 확인`,
      content_en: `## 1. Overview
Growth Simulator guides K-Beauty brand profitability and margin modeling for US market entry.

## 2. Parameters
- **COGS**: 35%-45% default
- **Platform Fee**: 15% default
- **Target Net Margin**: Minimum 20% target.`
    },
    {
      id: "kno-simulator-guide-execution",
      slug: "growth-simulator-profitability-execution-guide",
      title: "Growth Simulator Profitability 시뮬레이션 실행 가이드",
      title_ko: "Growth Simulator Profitability 시뮬레이션 실행 가이드",
      title_en: "Growth Simulator Profitability Simulation Execution Guide",
      summary_ko: "Profitability 시뮬레이션 실행 방법, 시나리오 분석 및 결과 데이터 해석 가이드",
      summary_en: "Execution guide for profitability simulation, scenario analysis, and result interpretation.",
      type: "GUIDE",
      source_type: "CONTENT",
      module: "SIMULATOR",
      category: "SIMULATOR",
      tags: ["SIMULATOR", "Growth Simulator", "GUIDE", "Profitability", "Scenario"],
      owner_id: "staff-admin-01",
      owner_name: "K SELECT Strategy Desk",
      status: "ARCHIVED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-14T08:00:00Z",
      updated_at: now,
      content_ko: `## 1. 개요 (Overview)
Growth Simulator 시뮬레이션 실행 및 결과 데이터 해석을 위한 가이드입니다.

## 2. 시뮬레이션 실행 방법
1. Admin → Growth Simulator → Sandbox (\`/admin/simulator/sandbox\`)
2. 대상 브랜드 및 상품군 선택
3. 마진 변수(COGS, Marketing Spend, Retain Rate) 슬라이더 조절 후 'Calculate Profitability' 실행
4. 생성된 리포트 결과를 시뮬레이션 결과 목록 (\`/admin/simulator/results\`)에 저장 및 공유`,
      content_en: `## 1. Overview
Execution guide for Growth Simulator sandbox calculations.`
    },
    // Retaining legacy fallback mock items for full filter testing
    {
      id: "kno-001-internal-manual",
      slug: "admin-sourcing-sop-v1",
      title: "Admin Brand Sourcing & Verification Operations SOP",
      title_ko: "관리자 브랜드 소싱 및 검증 표준 운영 절차 (SOP)",
      title_en: "Admin Brand Sourcing & Verification Operations SOP",
      summary_ko: "신규 K-뷰티 브랜드 입점 신청서 검증, 내부 마진율 조건 및 규정 준수 평가 프로세스",
      summary_en: "Standard operating procedure for verifying new K-Beauty brand applications and compliance.",
      content_ko: `## 1. 개요 (Overview)
본 SOP는 K SELECT NETWORK 내부 관리자가 신규 한국 브랜드사의 입점 신청서를 검증할 때 준수해야 하는 표준 절차입니다.`,
      content_en: `## 1. Overview\nStandard procedure for internal managers verifying new brand applications.`,
      type: "SOP",
      source_type: "CONTENT",
      module: "OPERATIONS",
      category: "OPERATIONS",
      tags: ["SOP", "Internal", "Sourcing", "Verification"],
      owner_id: "staff-admin-01",
      owner_name: "Operations Governance Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: true,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.2",
      effective_date: today,
      created_at: "2026-08-01T10:00:00Z",
      updated_at: now
    },
    {
      id: "kno-002-brand-faq",
      slug: "brand-partner-onboarding-faq",
      title: "Brand Partner Onboarding & Product Listing FAQ",
      title_ko: "브랜드 파트너 온보딩 및 제품 등록 안내 FAQ",
      title_en: "Brand Partner Onboarding & Product Listing FAQ",
      summary_ko: "미국 유통 네트워크 입점을 원하는 한국 브랜드사를 위한 자주 묻는 질문 및 절차 안내",
      summary_en: "Frequently asked questions and guides for Korean brand partners entering US retail network.",
      content_ko: `## Q1. K SELECT NETWORK 입점 자격 요건은 무엇인가요?\n미국 시장 진출을 희망하는 정식 등록 한국 화장품 브랜드사입니다.`,
      content_en: `## Q1. What are the qualification criteria?\nKorean cosmetic brands with FDA registration.`,
      type: "FAQ",
      source_type: "CONTENT",
      module: "ONBOARDING",
      category: "ONBOARDING",
      tags: ["FAQ", "Brand", "Onboarding", "Registration"],
      owner_id: "staff-admin-02",
      owner_name: "Brand Sourcing Team",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "PUBLIC"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-08-05T14:30:00Z",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-05T09:00:00Z",
      updated_at: now
    },
    {
      id: "kno-brand-policy-v10",
      document_url: "/api/admin/knowledge/asset/asset-brand-policy-v10",
      document_name: "MAN-BRAND-001_Brand_Policy_v1.0.pdf",
      document_size: 1391802,
      document_type: "application/pdf",
      slug: "brand-registration-and-management-policy-v1",
      title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      title_ko: "K SELECT 브랜드 등록 및 관리 정책",
      title_en: "K SELECT Brand Registration & Management Policy",
      summary_ko: "K SELECT 파트너 포털 브랜드 등록 6대 핵심 원칙, 상표권과의 차이, 다중 입점사 지원 및 화면별 운영 가이드",
      summary_en: "Brand registration policies, multi-company rules, trademark differentiation, and screen guides for K SELECT Brand Portal.",
      content_ko: `## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK 파트너 포털(Brand Portal)**을 이용하는 모든 파트너사(브랜드 원소유사, 제조사, 공식 총판, 유통사, 셀러)가 브랜드를 올바르게 등록하고 효율적으로 관리할 수 있도록 수립된 표준 운영 가이드입니다.

K SELECT의 상품 큐레이션, 바이어 발주, 물류 풀필먼트, 미국 현지 통관 및 정산 시스템은 포털에 등록된 authoritative 브랜드 정보를 기반으로 유기적으로 동작합니다.

## 2. 브랜드 관리 6대 핵심 정책 (Core Policies)
- **Policy 01 (상품 등록 전 브랜드 등록 필수)**: 모든 상품은 반드시 등록된 활성(Active) 브랜드에 귀속되어야 합니다. 브랜드가 0개인 경우 상품 등록 진입 시 브랜드 생성 화면(\`/portal/brands/new\`)으로 자동 리다이렉트됩니다.
- **Policy 02 (브랜드 등록과 상표권 등록의 구분)**: 포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, 특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다 (미등록/출원 중 입점 가능).
- **Policy 03 (동일 브랜드 다중 파트너 취급 가능)**: 글로벌 B2B 유통 구조를 반영하여 동일 브랜드를 여러 회사(제조사, 총판, 셀러)가 독립적으로 취급할 수 있습니다.
- **Policy 04 (Brand Owner는 원천 1개사)**: 동일 브랜드를 여러 유통사가 취급하더라도 지식재산권을 직접 보유한 Brand Owner는 시스템상 1개사로 정의됩니다.
- **Policy 05 (상품 연결 브랜드 물리 삭제 불가)**: 단 1건이라도 상품이 등록된 브랜드는 발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가합니다.
- **Policy 06 (미사용 브랜드 비활성화 처리)**: 취급 중단 시 영구 삭제 대신 '사용 중단(Inactive)' 논리 삭제를 적용하며, 언제든지 재활성화가 가능합니다.

## 3. 관련 화면 및 기능 (Step-by-Step)
1. **브랜드 관리 메인** (\`/portal/brands\`): 회사 등록 브랜드 목록 조회, 상표권 배지, 사용 중단
2. **신규 브랜드 등록** (\`/portal/brands/new\`): 브랜드 기본 정보, 한글/영문명, 상표권 보유 여부 입력
3. **상품 등록** (\`/portal/products/new\`): 브랜드 선택 필수 및 유효성 검증`,
      content_en: `## 1. Introduction & Purpose
Official operational guide for K SELECT NETWORK Brand Portal partners managing brand registrations.

## 2. Six Core Policies
- **Policy 01 (Brand Required Prior to Products)**: Products must belong to an active registered brand.
- **Policy 02 (Brand Registration vs Trademark)**: Trademark registration is optional; brands without trademarks can be onboarded.
- **Policy 03 (Multi-Company Support)**: Multiple independent partners can distribute the same brand.
- **Policy 04 (Single Brand Owner)**: Only one authoritative brand owner per brand.
- **Policy 05 (No Physical Deletion with Associated Products)**: Brands with products cannot be hard-deleted.
- **Policy 06 (Deactivation / Logical Deletion)**: Unused brands are set to Inactive to preserve audit integrity.

## 3. Related Routes
- \`/portal/brands\` (Brand List)
- \`/portal/brands/new\` (New Brand)
- \`/portal/products/new\` (Product Registration with Brand Selection)`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "BRAND",
      category: "BRAND",
      tags: ["MANUAL", "POLICY", "BRAND", "PRODUCTS", "ONBOARDING", "MAN-BRAND-001"],
      owner_id: "staff-admin-01",
      owner_name: "Brand Operations Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-10-01T12:00:00Z",
      current_version: "v1.0",
      effective_date: "2026-10-01",
      created_at: "2026-10-01T09:00:00Z",
      updated_at: now
    }
  ];

  memoryVersions = [
    {
      id: "ver-insights-manual-v10",
      knowledge_id: "kno-insights-manual-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      title_en: "K SELECT INSIGHTS Operational Manual v1.0",
      summary_ko: "최초 공식 등록 버전",
      summary_en: "Initial official registered manual version",
      content_ko: memoryItems[0].content_ko,
      content_en: memoryItems[0].content_en,
      what_changed: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0 최초 공식 등록",
      why_changed: "Knowledge Center Phase 1.1 First Official Knowledge Set 등록",
      effective_date: today,
      created_by_name: "INSIGHTS Editorial Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-insights-rule-v10",
      knowledge_id: "kno-insights-rule-daily-auto",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "INSIGHTS Daily Auto Insight 운영 기준",
      title_en: "INSIGHTS Daily Auto Insight Operational Rules",
      summary_ko: "최초 공식 등록 버전",
      summary_en: "Initial official version",
      content_ko: memoryItems[1].content_ko,
      content_en: memoryItems[1].content_en,
      what_changed: "매뉴얼 기준 05:00 ET / Topic Score 80+ / Max 3 Quota 등록",
      why_changed: "운영 기준 공식화",
      effective_date: today,
      created_by_name: "INSIGHTS Editorial Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-brand-policy-v10",
      knowledge_id: "kno-brand-policy-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001 v1.0)",
      title_en: "K SELECT Brand Registration & Management Policy v1.0",
      summary_ko: "최초 공식 발행 버전 (Claude Design Word & PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems[memoryItems.length - 1]?.content_ko || "",
      content_en: memoryItems[memoryItems.length - 1]?.content_en || "",
      what_changed: "MAN-BRAND-001 Brand Registration & Management Policy 최초 공식 등록",
      why_changed: "브랜드 등록 6대 핵심 정책 및 포털 운영 표준 지침 공식화",
      effective_date: "2026-10-01",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    }
  ];

  memoryRelations = [
    {
      id: "rel-insights-manual-overview",
      knowledge_id: "kno-insights-manual-v10",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "Overview",
      related_route: "/admin/insights",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-insights-rule-daily-auto",
      knowledge_id: "kno-insights-rule-daily-auto",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "Editorial Rules",
      related_route: "/admin/insights/rules",
      related_system_setting: "insights_daily_auto_rule",
      target_knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-insights-policy-factcheck",
      knowledge_id: "kno-insights-policy-factcheck-risk",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "Review Queue",
      related_route: "/admin/insights/queue",
      target_knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-insights-def-claim-status",
      knowledge_id: "kno-insights-def-claim-status",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "Review Queue",
      related_route: "/admin/insights/queue",
      target_knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-insights-sop-review-decision",
      knowledge_id: "kno-insights-sop-review-decision",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "Review Queue",
      related_route: "/admin/insights/queue",
      target_knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-insights-guide-automation-run",
      knowledge_id: "kno-insights-guide-automation-run-status",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "Automation Runs",
      related_route: "/admin/insights/automation-runs",
      target_knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-insights-policy-prohibitions",
      knowledge_id: "kno-insights-policy-prohibitions",
      related_portal: "Admin",
      related_module: "INSIGHTS",
      related_menu: "All Insights",
      related_route: "/admin/insights/all",
      target_knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      created_at: now
    },
    {
      id: "rel-brand-portal-brands",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Brand Portal",
      related_module: "BRAND",
      related_menu: "Brand Management",
      related_route: "/portal/brands",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-brand-portal-brands-new",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Brand Portal",
      related_module: "BRAND",
      related_menu: "New Brand Registration",
      related_route: "/portal/brands/new",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-brand-portal-brands-id",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Brand Portal",
      related_module: "BRAND",
      related_menu: "Brand Detail & Edit",
      related_route: "/portal/brands/[id]",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-brand-portal-products",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Brand Portal",
      related_module: "PRODUCTS",
      related_menu: "Products List",
      related_route: "/portal/products",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-brand-portal-products-new",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Brand Portal",
      related_module: "PRODUCTS",
      related_menu: "New Product Registration",
      related_route: "/portal/products/new",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-brand-portal-applications",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Brand Portal",
      related_module: "ONBOARDING",
      related_menu: "Brand Applications",
      related_route: "/portal/applications",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-admin-brands",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Admin",
      related_module: "BRAND",
      related_menu: "Brands Management",
      related_route: "/admin/brands",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-admin-companies",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Admin",
      related_module: "ONBOARDING",
      related_menu: "Companies & Brands",
      related_route: "/admin/companies",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    },
    {
      id: "rel-admin-products",
      knowledge_id: "kno-brand-policy-v10",
      related_portal: "Admin",
      related_module: "PRODUCTS",
      related_menu: "Products Management",
      related_route: "/admin/products",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      created_at: now
    }
  ];

  memoryAssets = [
    {
      id: "asset-insights-manual-v10",
      knowledge_id: "kno-insights-manual-v10",
      manual_title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-insights-manual-v10",
      file_name: "K_SELECT_INSIGHTS_실무자_운영_메뉴얼_v1.0.pdf",
      file_size: 7239179,
      published_date: today,
      created_at: now
    },
    {
      id: "asset-brand-policy-v10",
      knowledge_id: "kno-brand-policy-v10",
      manual_title: "K SELECT 브랜드 등록 및 관리 정책 (MAN-BRAND-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-brand-policy-v10",
      file_name: "MAN-BRAND-001_Brand_Policy_v1.0.pdf",
      file_size: 1391802,
      published_date: "2026-10-01",
      created_at: now
    }
  ];

  memoryLogs = [
    {
      id: "log-insights-manual-v10",
      knowledge_id: "kno-insights-manual-v10",
      user_id: "user-admin-01",
      user_name: "INSIGHTS Editorial Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0", audience: ["INTERNAL"] },
      reason: "Knowledge Center Phase 1.1 Official Seed Manual Upload",
      created_at: now
    },
    {
      id: "log-brand-policy-v10",
      knowledge_id: "kno-brand-policy-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT 브랜드 등록 및 관리 정책", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-BRAND-001 Official Publication",
      created_at: now
    }
  ];

  memoryTriggers = [];

  INITIALIZED = true;
}

// Ensure memory store is initialized
initSeedData();

// Storage Methods with Supabase Sync & Merged Seed Guarantee
export async function getStoreKnowledgeItems(): Promise<KnowledgeItem[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_items")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      const mergedMap = new Map<string, KnowledgeItem>();
      memoryItems.forEach((item) => mergedMap.set(item.id, item));
      data.forEach((item: any) => {
        const fullItem = {
          ...item,
          module: item.module || item.category || "General",
          category: item.category || item.module || "General"
        } as KnowledgeItem;
        mergedMap.set(item.id, fullItem);
      });
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
  } catch (e) {
    // Return memory fallback cleanly
  }
  return memoryItems;
}

export async function getStoreKnowledgeById(id: string): Promise<KnowledgeItem | null> {
  const items = await getStoreKnowledgeItems();
  return items.find(item => item.id === id || item.slug === id) || null;
}

export async function saveStoreKnowledgeItem(item: KnowledgeItem): Promise<KnowledgeItem> {
  initSeedData();
  const existingIdx = memoryItems.findIndex(i => i.id === item.id);
  if (existingIdx >= 0) {
    memoryItems[existingIdx] = { ...item, updated_at: new Date().toISOString() };
  } else {
    memoryItems.unshift(item);
  }

  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_items").upsert(item);
  } catch (e) {}

  return item;
}

export async function getStoreVersions(knowledgeId: string): Promise<KnowledgeVersion[]> {
  initSeedData();
  let dbVersions: KnowledgeVersion[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_versions")
      .select("*")
      .eq("knowledge_id", knowledgeId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) dbVersions = data as KnowledgeVersion[];
  } catch (e) {}

  const memVersions = memoryVersions.filter(v => v.knowledge_id === knowledgeId);
  const versionMap = new Map<string, KnowledgeVersion>();
  memVersions.forEach(v => versionMap.set(v.id, v));
  dbVersions.forEach(v => versionMap.set(v.id, v));
  return Array.from(versionMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function saveStoreVersion(version: KnowledgeVersion): Promise<KnowledgeVersion> {
  initSeedData();
  memoryVersions.unshift(version);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_versions").insert(version);
  } catch (e) {}

  // Auto-resolve any active UPDATE_REQUIRED impact when a new published version is created
  if (version.status === "PUBLISHED") {
    try {
      const item = await getStoreKnowledgeById(version.knowledge_id);
      if (item && (item.system_impact_status === "UPDATE_REQUIRED" || item.system_impact_status === "POTENTIALLY_OUTDATED")) {
        await resolveKnowledgeImpact(version.knowledge_id, {
          resolvedBy: version.created_by_name || "Admin",
          action: "VERSION_CREATED",
          reason: `Resolved via New Version Publish (${version.version}): ${version.what_changed || "Manual content updated"}`
        });
      }
    } catch (e) {}
  }

  return version;
}

export async function getStoreRelations(knowledgeId: string): Promise<KnowledgeRelation[]> {
  initSeedData();
  let dbRelations: KnowledgeRelation[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_relations")
      .select("*")
      .eq("knowledge_id", knowledgeId);
    if (data && data.length > 0) dbRelations = data as KnowledgeRelation[];
  } catch (e) {}

  const memRelations = memoryRelations.filter(r => r.knowledge_id === knowledgeId);
  const relationMap = new Map<string, KnowledgeRelation>();
  memRelations.forEach(r => relationMap.set(r.id, r));
  dbRelations.forEach(r => relationMap.set(r.id, r));
  return Array.from(relationMap.values());
}

export async function saveStoreRelation(relation: KnowledgeRelation): Promise<KnowledgeRelation> {
  initSeedData();
  memoryRelations.push(relation);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_relations").insert(relation);
  } catch (e) {}
  return relation;
}

export async function getStoreAssets(knowledgeId: string): Promise<ManualAsset[]> {
  initSeedData();
  let dbAssets: ManualAsset[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_manual_assets")
      .select("*")
      .eq("knowledge_id", knowledgeId);
    if (data && data.length > 0) dbAssets = data as ManualAsset[];
  } catch (e) {}

  const memAssets = memoryAssets.filter(a => a.knowledge_id === knowledgeId);
  const assetMap = new Map<string, ManualAsset>();
  memAssets.forEach(a => assetMap.set(a.id, a));
  dbAssets.forEach(a => assetMap.set(a.id, a));
  return Array.from(assetMap.values());
}

export async function getStoreAssetById(assetId: string): Promise<ManualAsset | undefined> {
  initSeedData();
  const foundMem = memoryAssets.find(a => a.id === assetId);
  if (foundMem) return foundMem;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_manual_assets")
      .select("*")
      .eq("id", assetId)
      .single();
    if (data) return data as ManualAsset;
  } catch (e) {}
  return undefined;
}

export async function saveStoreAsset(asset: ManualAsset): Promise<ManualAsset> {
  initSeedData();
  memoryAssets.unshift(asset);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_manual_assets").insert(asset);
  } catch (e) {}
  return asset;
}

export async function getStoreAuditLogs(knowledgeId: string): Promise<KnowledgeAuditLog[]> {
  initSeedData();
  let dbLogs: KnowledgeAuditLog[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_audit_logs")
      .select("*")
      .eq("knowledge_id", knowledgeId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) dbLogs = data as KnowledgeAuditLog[];
  } catch (e) {}

  const memLogs = memoryLogs.filter(l => l.knowledge_id === knowledgeId);
  const logMap = new Map<string, KnowledgeAuditLog>();
  memLogs.forEach(l => logMap.set(l.id, l));
  dbLogs.forEach(l => logMap.set(l.id, l));
  return Array.from(logMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addStoreAuditLog(log: KnowledgeAuditLog): Promise<KnowledgeAuditLog> {
  initSeedData();
  memoryLogs.unshift(log);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_audit_logs").insert(log);
  } catch (e) {}
  return log;
}

export async function getStoreTriggers(): Promise<SystemImpactTrigger[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_system_impact_triggers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) return data as SystemImpactTrigger[];
  } catch (e) {}

  return memoryTriggers;
}

export async function addStoreTrigger(trigger: SystemImpactTrigger): Promise<SystemImpactTrigger> {
  initSeedData();
  memoryTriggers.unshift(trigger);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_system_impact_triggers").insert(trigger);
  } catch (e) {}
  return trigger;
}

// --------------------------------------------------
// System Impact Engine (ADM-KNW-001-R1)
// --------------------------------------------------

export async function triggerKnowledgeImpact(params: {
  knowledgeId?: string;
  route?: string;
  module?: string;
  settingKey?: string;
  taskId?: string;
  reason: string;
  triggeredBy?: string;
}): Promise<{ impactedCount: number; impactedIds: string[] }> {
  initSeedData();
  const allItems = await getStoreKnowledgeItems();
  const matchedIds = new Set<string>();

  if (params.knowledgeId) {
    matchedIds.add(params.knowledgeId);
  }

  // Match by route or module or setting via relations
  if (params.route || params.module || params.settingKey) {
    for (const item of allItems) {
      const rels = await getStoreRelations(item.id);
      const isRouteMatch = Boolean(
        params.route &&
        rels.some(r => r.related_route && (params.route?.includes(r.related_route) || r.related_route.includes(params.route || "")))
      );
      const isModuleMatch = Boolean(
        params.module && (
          (item.module && item.module.toLowerCase() === params.module.toLowerCase()) ||
          rels.some(r => r.related_module && r.related_module.toLowerCase() === params.module?.toLowerCase())
        )
      );
      const isSettingMatch = Boolean(
        params.settingKey && (
          item.linked_system_setting_key === params.settingKey ||
          rels.some(r => r.related_system_setting === params.settingKey)
        )
      );

      if (isRouteMatch || isModuleMatch || isSettingMatch) {
        matchedIds.add(item.id);
      }
    }
  }

  const impactedIds = Array.from(matchedIds);
  const now = new Date().toISOString();
  const reasonText = params.taskId ? `[${params.taskId}] ${params.reason}` : params.reason;

  for (const id of impactedIds) {
    const item = allItems.find(i => i.id === id);
    if (item) {
      const prevImpact = item.system_impact_status;
      const updatedItem: KnowledgeItem = {
        ...item,
        system_impact_status: "UPDATE_REQUIRED",
        system_impact_reason: reasonText,
        system_impact_updated_at: now,
        updated_at: now
      };
      await saveStoreKnowledgeItem(updatedItem);

      await addStoreAuditLog({
        id: `log-impact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        knowledge_id: id,
        user_name: params.triggeredBy || "System Impact Engine",
        action: "Impact Detected: UPDATE_REQUIRED",
        previous_value: { system_impact_status: prevImpact },
        new_value: { system_impact_status: "UPDATE_REQUIRED", reason: reasonText },
        reason: reasonText,
        created_at: now
      });
    }
  }

  // Create system impact trigger record
  if (impactedIds.length > 0) {
    const trigger: SystemImpactTrigger = {
      id: `trig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      setting_key: params.settingKey || params.route || params.module || "SYSTEM_CHANGE",
      setting_name: params.taskId || params.reason,
      old_value: "PREVIOUS_STATE",
      new_value: reasonText,
      status: "PENDING",
      created_at: now
    };
    await addStoreTrigger(trigger);
  }

  return { impactedCount: impactedIds.length, impactedIds };
}

export async function resolveKnowledgeImpact(
  knowledgeId: string,
  options?: { resolvedBy?: string; reason?: string; action?: "VERSION_CREATED" | "NO_UPDATE_REQUIRED" }
): Promise<KnowledgeItem | null> {
  initSeedData();
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) return null;

  const now = new Date().toISOString();
  const prevReason = item.system_impact_reason;
  const updatedItem: KnowledgeItem = {
    ...item,
    system_impact_status: "NORMAL",
    system_impact_reason: null,
    system_impact_updated_at: now,
    updated_at: now
  };

  await saveStoreKnowledgeItem(updatedItem);

  // Mark pending triggers as RESOLVED
  try {
    const supabase = createAdminClient();
    await supabase
      .from("knowledge_system_impact_triggers")
      .update({
        status: "RESOLVED",
        resolved_by: options?.resolvedBy || "Admin",
        resolution_action: options?.action || "NO_UPDATE_REQUIRED",
        resolution_reason: options?.reason || "Admin confirmed manual is up-to-date."
      })
      .eq("status", "PENDING");
  } catch (e) {}

  await addStoreAuditLog({
    id: `log-resolve-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: knowledgeId,
    user_name: options?.resolvedBy || "Admin",
    action: options?.action === "VERSION_CREATED" ? "Resolved via New Version Publish" : "Marked as Reviewed: NORMAL",
    previous_value: { system_impact_status: "UPDATE_REQUIRED", reason: prevReason },
    new_value: { system_impact_status: "NORMAL" },
    reason: options?.reason || "Admin review completed. Manual matches current system specifications.",
    created_at: now
  });

  return updatedItem;
}

