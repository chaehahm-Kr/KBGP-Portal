import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeRelation,
  ManualAsset,
  KnowledgeAuditLog,
  SystemImpactTrigger,
  KnowledgeFilterOptions,
  SecurityUserContext,
  KnowledgeFaqItem,
  FaqStatus,
  FaqKind,
  AudienceType,
  PortalScope,
  KnowledgeTopic
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
let memoryFaqs: KnowledgeFaqItem[] = [];
let memoryTopics: KnowledgeTopic[] = [];


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
      status: "ARCHIVED",
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
      status: "ARCHIVED",
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
      status: "ARCHIVED",
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
      status: "ARCHIVED",
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
      status: "ARCHIVED",
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
      tags: ["MANUAL", "POLICY", "BRAND", "PRODUCTS", "ONBOARDING", "MAN-BRAND-001", "MAN-B-BRAND-001"],
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
    },
    {
      id: "kno-onboarding-guide-v10",
      document_url: "/api/admin/knowledge/asset/asset-onboarding-guide-v10",
      document_name: "MAN-B-ONB-001_Onboarding_Guide_v1.0.pdf",
      document_size: 3948614,
      document_type: "application/pdf",
      slug: "man-b-onb-001-onboarding-guide",
      title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      title_ko: "K SELECT Brand Portal 온보딩 가이드",
      title_en: "K SELECT Brand Portal Onboarding Guide",
      summary_ko: "K SELECT Brand Portal 가입 후 7단계 온보딩(회사정보, 관리자프로필, 브랜드, 팀원초대, 6대담당업무, 상품등록, 기본공급계약 전자서명)을 완수하기 위한 공식 가이드입니다.",
      summary_en: "Official 7-step onboarding guide for K SELECT Brand Portal partners covering company info, admin profile, brand verification, task owners, product listing, and master agreement signing.",
      content_ko: `## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**에 입점한 브랜드 파트너사가 최초 가입 후 포털 내 필수 기업·브랜드·상품 정보를 구성하고 기본 계약을 체결하기까지 필요한 7단계 온보딩(Onboarding) 절차를 안내하는 공식 사용자 가이드입니다.

온보딩 7단계를 완료하면 파트너사의 법인 정보, 관리자 프로필, 브랜드 상표권 점검, 담당 업무 지정, 최소 1개 상품 등록 및 공급 기본계약 체결이 완료되어 Brand Portal의 운영 기능을 정상적으로 이용할 수 있습니다.

## 2. 7-Step 온보딩 로드맵 (7-Step Roadmap)
- **STEP 1 (회사 정보 확인)**: 공식 법인명, 대표 연락처, 필수 4대 주소(기본주소, 시, 주/도, 우편번호) 등록 (\`/portal/company/info\`)
- **STEP 2 (관리자 정보 확인)**: 대표 관리자의 국문/영문 성명, 직함(Job Title), 대표 연락처 등록 (\`/portal/account\`)
- **STEP 3 (브랜드 정보 확인)**: 대표 브랜드명, 로고 및 대한민국(KIPO)/미국(USPTO) 상표권 보유 현황 확인 (\`/portal/brands\`)
- **STEP 4 (팀원 초대 - 선택)**: 포털을 함께 운영할 사내 동료 초대 및 권한 설정 (1인 기업의 경우 '나중에 하기' 건너뛰기 가능) (\`/portal/company/users\`)
- **STEP 5 (6대 담당업무 지정)**: 회사·계약·제품·가격·물류·정산 6대 핵심 업무별 사내 주 담당자(Primary Owner) 및 알림 수신인 지정 (\`/portal/company/info?tab=tasks\`)
- **STEP 6 (상품 등록 완료)**: 대표 상품을 최소 1개 이상 등록 완료(COMPLETE) 상태로 등록 (\`/portal/products\`)
- **STEP 7 (기본계약 체결)**: 브랜드 공급 및 플랫폼 이용 기본계약서 검토 및 자필 전자서명 체결 (\`/portal/company/info?tab=agreements\`)

## 3. 온보딩 완료 판정 기준 (Completion Criteria)
대시보드 상단의 7개 단계가 모두 충족되면 **7 / 7 완료 (100%)** 녹색 배지가 표시되며 정식 운영 단계로 전환됩니다.`,
      content_en: `## 1. Introduction & Purpose
Official step-by-step user manual for partner brands to complete the 7-step onboarding process on K SELECT Brand Portal.

## 2. 7-Step Onboarding Roadmap
- STEP 1 (Company Info): Corporate address, city, state, zip code (/portal/company/info)
- STEP 2 (Admin Profile): Full legal KR/EN name, title, contact (/portal/account)
- STEP 3 (Brand Info): Brand name, logo, KIPO/USPTO trademarks (/portal/brands)
- STEP 4 (Team Members - Optional): Invite colleagues or skip (/portal/company/users)
- STEP 5 (Task Owners): Assign primary owners across 6 operational areas (/portal/company/info?tab=tasks)
- STEP 6 (Product Registration): Register at least 1 COMPLETE product (/portal/products)
- STEP 7 (Master Agreement): Review terms and execute electronic signature (/portal/company/info?tab=agreements)

## 3. Completion Criteria
Achieving 7 / 7 (100%) unlocks regular portal operations.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "ONBOARDING",
      category: "ONBOARDING",
      tags: ["MANUAL", "ONBOARDING", "GUIDE", "BRAND", "MAN-B-ONB-001", "OFFICIAL", "START"],
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
    },
    {
      id: "kno-product-management-v10",
      document_url: "/api/admin/knowledge/asset/asset-product-management-v10",
      document_name: "MAN-B-PROD-001_Product-Management_V1.pdf",
      document_size: 3296047,
      document_type: "application/pdf",
      slug: "man-b-prod-001-product-management-guide",
      title: "MAN-B-PROD-001: Brand Portal Product Registration & Management Guide",
      title_ko: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      title_en: "K SELECT Brand Portal Product Registration & Management Guide (MAN-B-PROD-001)",
      summary_ko: "K SELECT Brand Portal의 2-Phase 상품 등록(Phase 1 신규 등록, Phase 2 6대 전문 관리 탭), 10대 등록 완료 조건, 카테고리 동적 속성, FOB 가격 체계, 로지스틱스 3단계 규격, 미디어 관리 및 3대 독립 상태 관리를 위한 공식 사용자 매뉴얼입니다.",
      summary_en: "Official user manual for K SELECT Brand Portal covering 2-Phase product registration, 10 completion criteria, 3-depth category attributes, FOB pricing, 3-tier logistics, container simulation, media management, and 3 independent status dimensions.",
      content_ko: `## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 브랜드 파트너사가 신규 상품을 올바르게 등록하고, 6대 전문 관리 탭을 통해 글로벌 수출 및 온/오프라인 유통에 필요한 상세 스펙을 관리할 수 있도록 수립된 공식 사용자 가이드입니다.

## 2. 2-Phase 상품 등록 라이프사이클 (2-Phase Lifecycle)
- **Phase 1: 신규 상품 등록 (\`/portal/products/new\`)**: 소속 브랜드, 국문/영문명, 바코드(UPC/EAN), 제조사 SKU, 소비자가(KRW), FOB(USD), 패키지 규격 입력.
- **Phase 2: 전문 관리 탭 완성 (\`/portal/products/[id]\`)**: 기본정보, 3-Depth 카테고리/속성, 4대 가격, 3단계 규격 및 컨테이너 시뮬레이터, 미디어(최대 10장), 인허가 서류(v1, v2) 및 감사 로그.

## 3. 10대 상품 등록 완료(COMPLETE) 판정 기준
1. 소속 브랜드 (is_active=true)
2. 3-Depth 리프 카테고리
3. 카테고리 필수 속성(*) 100%
4. 영문 공식 제품명
5. 제조사 SKU 코드
6. 원산지 (Origin)
7. 2대 필수 가격 (한국소비자가 + FOB)
8. 3단계 물리 규격 (단품+패키지+마스터카톤/입수량)
9. 식별 바코드 (UPC/EAN)
10. 대표 상품 이미지 (Position 0 최소 1장)

## 4. 3대 독립 상태 차원
- **등록 상태 (Registration)**: DRAFT (보완 대기) / COMPLETE (등록 완료)
- **선정 상태 (Selection)**: UNREVIEWED / UNDER_REVIEW / INFO_REQUESTED / SELECTED / NOT_SELECTED
- **판매 상태 (Sales)**: PREPARING / ON_SALE / PAUSED / ENDED`,
      content_en: `## 1. Introduction & Purpose
Official user guide for K SELECT Brand Portal partners to register products and manage full export specifications across 6 specialized tabs.

## 2. 2-Phase Lifecycle
- Phase 1: New Product Registration (/portal/products/new) with Draft vs Save & Continue
- Phase 2: Product Detail 6 Specialized Tabs (/portal/products/[id])

## 3. 10 Completion Criteria (COMPLETE)
All 10 mandatory spec domains must be 100% fulfilled.

## 4. 3 Independent Status Dimensions
- Registration Status: DRAFT / COMPLETE
- Selection Status: UNREVIEWED / UNDER_REVIEW / INFO_REQUESTED / SELECTED / NOT_SELECTED
- Sales Status: PREPARING / ON_SALE / PAUSED / ENDED`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "PRODUCTS",
      category: "Brand Portal",
      tags: ["MANUAL", "PRODUCTS", "PRODUCT", "PRODUCT_REGISTRATION", "PRODUCT_MANAGEMENT", "LOGISTICS", "GUIDE", "BRAND", "MAN-B-PROD-001", "OFFICIAL", "상품등록", "상품관리", "PRODUCT MANAGEMENT"],
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
    },
    {
      id: "kno-order-management-v10",
      document_url: "/api/admin/knowledge/asset/asset-order-management-v10",
      document_name: "MAN-B-ORD-001_Order-Management_V1.pdf",
      document_size: 4188373,
      document_type: "application/pdf",
      slug: "man-b-ord-001-order-management-guide",
      title: "MAN-B-ORD-001: Brand Portal Order Management & Purchase Order Guide",
      title_ko: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      title_en: "K SELECT Brand Portal Order Management & Purchase Order Guide (MAN-B-ORD-001)",
      summary_ko: "K SELECT Brand Portal의 발주 요청(PO Request) 승인/거절, 정식 발주서(Official Purchase Order) 6단계 라이프사이클(ISSUED → SUPPLIER_CONFIRMED → PRODUCTION → PREPARING_SHIPMENT → SHIPPED → COMPLETED), 공급자 주문 확정, 물류 출고 연결, 인보이스(Invoice) 청구 자격 및 물류센터 입고/검수 종결을 위한 공식 사용자 매뉴얼입니다.",
      summary_en: "Official user manual for K SELECT Brand Portal covering Retailer Purchase Requests, Official Purchase Order 6-step lifecycle (ISSUED -> SUPPLIER_CONFIRMED -> PRODUCTION -> PREPARING_SHIPMENT -> SHIPPED -> COMPLETED), supplier confirmation, logistics shipment, invoice eligibility, and warehouse receiving completion.",
      content_ko: `## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 입점 브랜드 파트너사가 바이어/리테일러의 구매 의사 타진 단계인 **발주 요청(PO Request)**을 검토하고, 정식 계약 문서인 **발주서(Official Purchase Order)**의 6단계 라이프사이클에 따라 납기 확인, 공급자 승인, 물류 출고 및 정산 인보이스 청구까지 안전하게 완수할 수 있도록 제작된 공식 실무 가이드입니다.

## 2. 2-Phase 오더 아키텍처 (Two-Phase Order Architecture)
- **Phase 1: 발주 요청 (Purchase Order Request)**: 바이어의 사전 구매 의사 타진 (PENDING, APPROVED, REJECTED 3대 상태 관리 및 상태 불변 원칙 적용).
- **Phase 2: 정식 발주서 (Official Purchase Order)**: 법적 구속력을 갖는 정식 납품 계약 (Approved 발주 요청에 대해 정식 PO-YYYYMMDD-XXXX 번호 발행).

## 3. 정식 PO 6단계 표준 라이프사이클 (Official PO 6-Step Lifecycle)
1. **발주서 발행 (ISSUED)**: Admin이 정식 PO 발행, 품목/단가/수량/납기 검토.
2. **공급자 주문 확정 (SUPPLIER_CONFIRMED)**: 브랜드의 납기 및 생산 최종 승낙. **MAN-B-FIN-001 도메인 공급자 인보이스(Supplier Invoice) 청구 자격 활성화**.
3. **생산 중 (PRODUCTION)**: 제품 생산 및 1차 포장 진행.
4. **출고 준비 (PREPARING_SHIPMENT)**: 마스터 카톤 패킹, 라벨링, 선적 서류 준비.
5. **배송 중 (SHIPPED)**: 3PL 배송 인계 및 B/L·운송장 등록.
6. **입고/오더 완료 (COMPLETED)**: 물류센터 실물 도착 및 입고 검수 완료, **오더 이행 최종 종결(Order Fulfillment Completed)**. (정산 대금 지급 PAID는 MAN-B-FIN-001에서 병렬 독립 관리).

## 4. 4대 독립 상태 차원
- **발주 요청 상태**: PENDING / APPROVED / REJECTED
- **공급자 확정 상태**: DRAFT / PENDING_CONFIRMATION / CONFIRMED / REJECTED
- **오더 이행 상태**: ISSUED → SUPPLIER_CONFIRMED → PRODUCTION → PREPARING_SHIPMENT → SHIPPED → COMPLETED
- **결제 및 정산 상태**: UNPAID / PARTIALLY_PAID / PAID (MAN-B-FIN-001 연계)`,
      content_en: `## 1. Introduction & Purpose
Official user guide for K SELECT Brand Portal partners to review Retailer Purchase Requests and execute Official Purchase Orders through the 6-step lifecycle.

## 2. Two-Phase Order Architecture
- Phase 1: Purchase Order Requests (/portal/orders/requests)
- Phase 2: Official Purchase Orders (/portal/orders/purchase-orders)

## 3. Official PO 6-Step Lifecycle
1. ISSUED
2. SUPPLIER_CONFIRMED (Eligible for Supplier Invoice in MAN-B-FIN-001)
3. PRODUCTION
4. PREPARING_SHIPMENT
5. SHIPPED
6. COMPLETED (Order Fulfillment Completed upon warehouse receiving inspection)

## 4. Status Dimensions & Domain Boundaries
- Parallel domain operation: Logistics (MAN-B-LOG-001) & Finance (MAN-B-FIN-001)
- COMPLETED means order fulfillment closed; PAID is managed in Finance.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "ORDERS",
      category: "Brand Portal",
      tags: ["MANUAL", "ORDERS", "PURCHASE_ORDER", "PO", "PO_REQUEST", "ORDER_MANAGEMENT", "LOGISTICS", "GUIDE", "BRAND", "MAN-B-ORD-001", "OFFICIAL", "발주", "오더", "발주관리", "발주서", "PURCHASING"],
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

  memoryTopics = [
    {
      id: "topic-start",
      portal_scope: "BRAND",
      name_ko: "시작하기",
      name_en: "Getting Started",
      short_desc_ko: "가입 · 계정 · 기본 온보딩",
      short_desc_en: "Signup · Account · Onboarding",
      description_ko: "회원가입, 회사 등록, 초기 계정 설정 및 온보딩",
      description_en: "Account registration, company setup, and onboarding guides",
      icon: "🚀",
      display_order: 1,
      is_active: true,
      match_modules: ["ONBOARDING", "SIGNUP", "ACCOUNT", "START", "SETUP"],
      match_keywords: ["가입", "시작", "온보딩", "초기 설정", "계정", "onboarding", "signup", "start", "account"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-brand",
      portal_scope: "BRAND",
      name_ko: "브랜드 관리",
      name_en: "Brand Management",
      short_desc_ko: "등록 · 상표권 · 수정 · 사용 중단",
      short_desc_en: "Registration · Trademark · Inactive",
      description_ko: "브랜드 등록, 상표권 정책, 브랜드 권한 및 사용 중단 정책",
      description_en: "Brand registration, trademark policy, ownership, and deactivation rules",
      icon: "🏷️",
      display_order: 2,
      is_active: true,
      match_modules: ["BRAND", "BRANDS", "BRAND_POLICY"],
      match_keywords: ["브랜드", "상표권", "브랜드 삭제", "브랜드 비활성화", "brand", "trademark", "ownership", "man-brand-001"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-product",
      portal_scope: "BRAND",
      name_ko: "상품 등록 & 관리",
      name_en: "Product Management",
      short_desc_ko: "상품 등록 · SKU · 규격 · 승인",
      short_desc_en: "Products · SKU · Specs · Approval",
      description_ko: "상품 신규 등록, SKU 관리, 상품 정보 수정 및 브랜드 연결",
      description_en: "Product registration, SKU management, catalog editing, and brand linking",
      icon: "📦",
      display_order: 3,
      is_active: true,
      match_modules: ["PRODUCTS", "PRODUCT", "SKU", "CATALOG"],
      match_keywords: [
        "상품", "제품", "sku", "카탈로그", "바코드", "product", "item", "man-prod-001", "man-b-prod-001",
        "상품 등록", "상품 수정", "이미지", "가격", "물류", "인증서", "cbm", "fob", "draft", "moq", "upc", "ean", "단품", "카톤",
        "add product", "draft product", "product image", "pricing", "logistics", "package", "certification"
      ],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-regulatory",
      portal_scope: "BRAND",
      name_ko: "인허가 & 규정",
      name_en: "Regulatory & Compliance",
      short_desc_ko: "FDA · MoCRA · 라벨 · 통관 인증",
      short_desc_en: "FDA · MoCRA · Labeling · US Compliance",
      description_ko: "미국 판매 요건, FDA, MoCRA, 라벨링 및 필수 인증 서류",
      description_en: "US market compliance, FDA, MoCRA, labeling, and required certificates",
      icon: "📜",
      display_order: 4,
      is_active: true,
      match_modules: ["REGULATORY", "COMPLIANCE", "FDA", "MOCRA"],
      match_keywords: ["인허가", "규정", "fda", "mocra", "라벨링", "성분", "certification", "compliance"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-retail",
      portal_scope: "BRAND",
      name_ko: "입점 & 리테일 네트워크",
      name_en: "Retail Network",
      short_desc_ko: "바이어 매칭 · 입점 신청 · 유통 채널",
      short_desc_en: "Buyer Matching · Placement · Channels",
      description_ko: "바이어 매장 입점 신청, 리테일 네트워크 참여 및 테스트 프로그램",
      description_en: "Retail store applications, distribution network, and testing opportunities",
      icon: "🏬",
      display_order: 5,
      is_active: true,
      match_modules: ["RETAIL", "RETAILER", "STORE", "NETWORK"],
      match_keywords: ["입점", "리테일", "매장", "네트워크", "스토어", "retail", "store", "network"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-orders",
      portal_scope: "BRAND",
      name_ko: "발주 요청 & 오더",
      name_en: "Orders & PO",
      short_desc_ko: "발주서 · PO 접수 · 납기 관리",
      short_desc_en: "Purchase Orders · PO · Lead Time",
      description_ko: "리테일러 발주 요청(Request) 확인, 수락 및 정식 발주서(PO) 처리",
      description_en: "Retailer purchase requests, acceptance, and formal Purchase Order (PO) workflow",
      icon: "📋",
      display_order: 6,
      is_active: true,
      match_modules: ["ORDERS", "PURCHASE_ORDER", "ORDER", "PO"],
      match_keywords: ["발주", "오더", "po", "발주서", "발주 요청", "purchase order", "order", "request"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-logistics",
      portal_scope: "BRAND",
      name_ko: "재고 & 물류",
      name_en: "Inventory & Logistics",
      short_desc_ko: "입고 · 출고지 · 3PL · 배송 정책",
      short_desc_en: "Origin · Return · 3PL · Logistics",
      description_ko: "물류 출고지/반품지 관리, 재고 현황, 배송 및 트래킹 추적",
      description_en: "Shipping origin, return address, inventory levels, and logistics tracking",
      icon: "🚚",
      display_order: 7,
      is_active: true,
      match_modules: ["LOGISTICS", "INVENTORY", "SHIPPING", "WAREHOUSE", "FULFILLMENT"],
      match_keywords: ["물류", "재고", "출고지", "반품지", "배송", "창고", "shipping", "inventory", "warehouse"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-finance",
      portal_scope: "BRAND",
      name_ko: "정산 & 결제",
      name_en: "Settlement & Finance",
      short_desc_ko: "정산 주기 · 인보이스 · 세금계산서",
      short_desc_en: "Settlement · Invoice · Payout",
      description_ko: "판매대금 정산 내역, 인보이스, 송금 계좌 및 수수료 안내",
      description_en: "Settlement reports, invoices, remittance accounts, and platform fees",
      icon: "💳",
      display_order: 8,
      is_active: true,
      match_modules: ["FINANCE", "SETTLEMENT", "PAYMENT", "INVOICE"],
      match_keywords: ["정산", "결제", "인보이스", "송금", "수수료", "finance", "settlement", "payment", "invoice"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-marketing",
      portal_scope: "BRAND",
      name_ko: "프로모션 & 마케팅",
      name_en: "Promotion & Marketing",
      short_desc_ko: "기획전 · 할인 · 프로모션 가이드",
      short_desc_en: "Promotions · Discounts · Campaigns",
      description_ko: "마케팅 지원 프로그램, 할인 프로모션 및 캠페인 참여 안내",
      description_en: "Marketing support programs, discount promotions, and campaign participation",
      icon: "📣",
      display_order: 9,
      is_active: true,
      match_modules: ["PROMOTION", "MARKETING", "CAMPAIGN"],
      match_keywords: ["프로모션", "마케팅", "캠페인", "할인", "이벤트", "promotion", "marketing", "campaign"],
      created_at: now,
      updated_at: now
    },
    {
      id: "topic-company",
      portal_scope: "BRAND",
      name_ko: "회사 & 사용자 관리",
      name_en: "Company & Users",
      short_desc_ko: "사업자 정보 · 권한 · 팀원 초대",
      short_desc_en: "Company Profile · Roles · Invitations",
      description_ko: "회사 정보 변경, 팀원 초대, 권한 설정 및 계정 관리",
      description_en: "Company details, team invitations, role permissions, and access settings",
      icon: "👥",
      display_order: 10,
      is_active: true,
      match_modules: ["COMPANY", "USERS", "SETTINGS", "MEMBERS"],
      match_keywords: ["회사", "사용자", "팀원", "권한", "초대", "company", "user", "permission", "member"],
      created_at: now,
      updated_at: now
    }
  ];

  memoryFaqs = [
    {
      id: "faq-brand-01",
      portal_scope: "BRAND",
      topic_id: "topic-brand",
      source_knowledge_id: "kno-brand-policy-v10",
      source_version: "v1.0",
      source_title: "K SELECT 브랜드 등록 및 관리 정책",
      question_ko: "브랜드는 어떻게 등록하나요?",
      question_en: "How do I register a brand in the portal?",
      answer_ko: "포털 내 브랜드 관리 메뉴(/portal/brands) 또는 신규 등록 화면(/portal/brands/new)에서 브랜드 국문/영문명, 사업자 등록번호, 대표 카테고리, 슬로건 및 물류 출고지/반품지 정보를 입력하여 등록합니다. 상품 등록 전 활성 브랜드 등록이 필수입니다. (Policy 01)",
      answer_en: "Navigate to Brand Management (/portal/brands) or New Brand (/portal/brands/new) to enter brand names, business ID, category, and logistics origins. Brand registration is mandatory before product listings. (Policy 01)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 1,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-brand-02",
      portal_scope: "BRAND",
      topic_id: "topic-brand",
      source_knowledge_id: "kno-brand-policy-v10",
      source_version: "v1.0",
      source_title: "K SELECT 브랜드 등록 및 관리 정책",
      question_ko: "상표권이 없어도 브랜드 등록이 가능한가요?",
      question_en: "Can I register a brand without an official trademark?",
      answer_ko: "네, 가능합니다. 포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, 특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다. 상표권이 없거나 출원 중인 브랜드도 자유롭게 등록하여 입점할 수 있습니다. (Policy 02)",
      answer_en: "Yes. Brand registration in the portal is for catalog classification and does not require official trademark registration. Brands without trademarks or with pending applications can be registered. (Policy 02)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 2,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-brand-03",
      portal_scope: "BRAND",
      topic_id: "topic-brand",
      source_knowledge_id: "kno-brand-policy-v10",
      source_version: "v1.0",
      source_title: "K SELECT 브랜드 등록 및 관리 정책",
      question_ko: "상품이 연결된 브랜드를 삭제할 수 있나요?",
      question_en: "Can I delete a brand that has associated products?",
      answer_ko: "단 1건이라도 상품이 등록된 브랜드는 발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가합니다. 취급 중단 시 영구 삭제 대신 '사용 중단(Inactive)' 비활성화 처리를 적용하며, 언제든지 재활성화가 가능합니다. (Policy 05 & 06)",
      answer_en: "Brands associated with even one product cannot be physically hard-deleted to preserve order, customs, and invoice audit integrity. Use Inactive status instead. (Policy 05 & 06)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 3,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-brand-04",
      portal_scope: "BRAND",
      topic_id: "topic-brand",
      source_knowledge_id: "kno-brand-policy-v10",
      source_version: "v1.0",
      source_title: "K SELECT 브랜드 등록 및 관리 정책",
      question_ko: "동일한 브랜드를 여러 회사가 취급할 수 있나요?",
      question_en: "Can multiple partner companies distribute the same brand?",
      answer_ko: "네, 글로벌 B2B 유통 구조를 반영하여 동일 브랜드를 여러 회사(제조사, 공식 총판, 셀러)가 독립적으로 취급할 수 있습니다. 단, 지식재산권을 직접 보유한 원천 Brand Owner는 시스템상 1개사로 정의됩니다. (Policy 03 & 04)",
      answer_en: "Yes. Multiple independent companies (manufacturers, distributors, sellers) can distribute the same brand, while authoritative Brand Ownership is maintained at 1 entity. (Policy 03 & 04)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 4,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-brand-05",
      portal_scope: "BRAND",
      topic_id: "topic-brand",
      source_knowledge_id: "kno-brand-policy-v10",
      source_version: "v1.0",
      source_title: "K SELECT 브랜드 등록 및 관리 정책",
      question_ko: "사용하지 않는 브랜드는 어떻게 처리하나요?",
      question_en: "How do I handle unused or discontinued brands?",
      answer_ko: "취급을 중단하거나 사용하지 않는 브랜드는 브랜드 관리 목록에서 '사용 중단(Inactive)'으로 전환합니다. 비활성화된 브랜드는 신규 상품 등록 목록에서 제외되지만 기존 거래 내역은 안전하게 보존됩니다. (Policy 06)",
      answer_en: "Set discontinued brands to Inactive in the Brand Management screen. Inactive brands are hidden from new product selection while preserving audit history. (Policy 06)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 5,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-01",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "처음 가입하면 무엇부터 해야 하나요? 온보딩 절차가 어떻게 되나요?",
      question_en: "What should I do first after signing up? What is the onboarding process?",
      answer_ko: "포털 로그인 후 대시보드(/portal)의 7단계 온보딩 로드맵에 따라 회사 정보 확인 ➔ 관리자 프로필 ➔ 브랜드 정보 ➔ 팀원 초대(선택) ➔ 6대 담당업무 지정 ➔ 상품 등록 ➔ 기본계약 전자서명을 진행합니다. 각 단계는 서류 및 정보 준비 상황에 따라 원하는 순서대로 자유롭게 선택하여 진행할 수 있습니다. (Chapter 02 · 7-Step Roadmap)",
      answer_en: "After logging in, follow the 7-step onboarding roadmap on the dashboard (/portal): Company Info -> Admin Profile -> Brand Info -> Team Invitation (Optional) -> 6 Task Owners -> Product Listing -> Master Agreement. Steps can be completed in any flexible order based on your document readiness. (Chapter 02 · 7-Step Roadmap)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 1,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-02",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "회사 정보 등록 시 필수 입력 항목은 무엇인가요?",
      question_en: "What are the mandatory fields when registering company information?",
      answer_ko: "회사 정보 관리 메뉴(/portal/company/info)에서 공식 법인명, 대표 연락처와 함께 필수 4대 주소(기본 주소 address_1, 시 City, 주/도 State/Province, 우편번호 Zip Code)를 입력해야 합니다. 4개 주소 필드가 모두 저장되어야 온보딩 1단계(STEP 1)가 완료 처리됩니다. (Chapter 04 · STEP 1)",
      answer_en: "In Company Information (/portal/company/info), you must provide legal corporate name, contact phone, and all 4 mandatory address fields: Address 1, City, State/Province, and Zip Code. All 4 address fields must be saved to complete STEP 1. (Chapter 04 · STEP 1)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 2,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-03",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "관리자 정보에서 영문 이름은 왜 필수이며 어떻게 입력해야 하나요?",
      question_en: "Why is English name required in admin profile and how should it be entered?",
      answer_ko: "내 계정 메뉴(/portal/account)에서 등록하는 대표 관리자의 영문 성명(First Name, Last Name)은 글로벌 무역 서류 및 통관, 공식 파트너십 커뮤니케이션에 활용되므로 여권상 영문 표기와 동일하게 입력해야 합니다. 국문 성명, 직함(Job Title), 연락처와 함께 저장하면 2단계(STEP 2)가 완료됩니다. (Chapter 05 · STEP 2)",
      answer_en: "The administrator's English name (First Name, Last Name) in My Account (/portal/account) is used for global trade documents, customs, and official partnership communications, so it must match your passport exactly. Save along with Korean name, Job Title, and phone to complete STEP 2. (Chapter 05 · STEP 2)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 3,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-04",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "브랜드 정보 확인 단계(STEP 3)에서는 무엇을 확인하나요?",
      question_en: "What should I verify during the Brand Information step (STEP 3)?",
      answer_ko: "브랜드 관리 메뉴(/portal/brands)에서 등록된 대표 브랜드명, 브랜드 로고, 대한민국(KIPO)/미국(USPTO) 상표권 보유 현황을 점검하고 상단 배너의 '브랜드 정보 확인 완료 ✓' 버튼을 클릭합니다. 신규 브랜드 추가 및 상표권 상세 정책은 MAN-BRAND-001 문서를 참고해 주시기 바랍니다. (Chapter 06 · STEP 3)",
      answer_en: "In Brand Management (/portal/brands), check your registered brand name, logo, and KIPO/USPTO trademark registration status, then click 'Confirm Brand Information ✓'. For detailed brand registration and trademark policies, refer to MAN-BRAND-001. (Chapter 06 · STEP 3)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 4,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-05",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "팀원 초대는 필수인가요? 1인 기업은 어떻게 하나요?",
      question_en: "Is team invitation mandatory? How do solo/single-person businesses proceed?",
      answer_ko: "팀원 초대는 선택 사항(Optional)입니다. 사내 동료가 있는 경우 소속 사용자 관리(/portal/company/users)에서 이메일로 초대할 수 있으며, 1인 기업이거나 즉시 초대가 불필요한 경우 대시보드 온보딩 체크리스트 STEP 4 카드의 '나중에 하기' 버튼을 누르면 본 단계를 건너뛰고 완료할 수 있습니다. (Chapter 07 · STEP 4)",
      answer_en: "Team invitation is optional. If you have colleagues, you can invite them via email in Team Management (/portal/company/users). For solo entrepreneurs or if immediate invitations are not needed, click 'Do this later' on the STEP 4 dashboard card to skip and complete this step. (Chapter 07 · STEP 4)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 5,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-06",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "6대 담당업무는 어떻게 지정하며, 한 사람이 여러 업무를 담당할 수 있나요?",
      question_en: "How are the 6 core task owners assigned, and can one person hold multiple roles?",
      answer_ko: "회사 정보 관리 > 담당 업무 탭(/portal/company/info?tab=tasks)에서 6대 핵심 업무(회사·신청, 계약, 제품·콘텐츠·인증, 가격·견적, 발주·물류·재고, 정산·문의)별 사내 주 담당자(Primary Owner)를 드롭다운에서 지정합니다. 1인 기업 또는 소규모 팀의 경우 대표 관리자 1인이 6개 업무를 모두 겸임하여 지정할 수 있습니다. (Chapter 08 · STEP 5)",
      answer_en: "Navigate to Company Info > Task Owners tab (/portal/company/info?tab=tasks) to assign Primary Owners across 6 operational areas (Company, Contract, Product/Cert, Pricing/Quote, Orders/Logistics, Settlement/Inquiry). For solo or small teams, a single admin can hold all 6 primary owner roles. (Chapter 08 · STEP 5)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 6,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-07",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "온보딩을 완료하려면 상품을 몇 개 등록해야 하며, 어떤 상태여야 하나요?",
      question_en: "How many products must be registered to complete onboarding, and what status is required?",
      answer_ko: "대표 상품을 최소 1개 이상 '등록 완료(COMPLETE)' 상태로 등록(/portal/products)해야 합니다. 단순 임시저장(Draft) 상태는 인정되지 않으며, 기본정보, 카테고리 필수 속성, 가격(소비자가/FOB가), 3단계 로지스틱스 규격(단품/패키지/카톤), 바코드(UPC/EAN), 대표 이미지가 모두 입력되어야 합니다. (Chapter 09 · STEP 6)",
      answer_en: "You must register at least 1 representative product in 'COMPLETE' status in Product Management (/portal/products). Draft status is not accepted. All requirements including basic info, category attributes, pricing (Retail/FOB), 3-tier specs (Item/Package/Carton), barcode (UPC/EAN), and image must be filled. (Chapter 09 · STEP 6)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 7,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-08",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "기본계약 체결은 언제 어떻게 진행하나요? 계약 전에도 상품 등록이 가능한가요?",
      question_en: "When and how is the Master Agreement signed? Can products be listed before signing?",
      answer_ko: "회사 정보 관리 > 공급 및 이용 약관 탭(/portal/company/info?tab=agreements)에서 비독점 기본공급계약서 전문을 검토한 후 서명 패드에 자필 전자서명을 작성하여 체결합니다. 계약 체결 전이라도 상품 등록 및 기본 정보 입력 등 사전 준비 작업은 자유롭게 진행하실 수 있습니다. (Chapter 10 · STEP 7)",
      answer_en: "In Company Info > Agreements tab (/portal/company/info?tab=agreements), review the Non-Exclusive Master Agreement terms and execute electronic signature on the pad. Product listing and preparatory tasks can be conducted freely even before agreement execution. (Chapter 10 · STEP 7)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 8,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-onb-09",
      portal_scope: "BRAND",
      topic_id: "topic-start",
      source_knowledge_id: "kno-onboarding-guide-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      question_ko: "온보딩 7단계를 모두 완료하면 어떻게 되나요?",
      question_en: "What happens after completing all 7 onboarding steps?",
      answer_ko: "7개 단계가 모두 완료되면 대시보드 상단에 '7 / 7 완료 (100%)' 녹색 배지가 표시되며 Brand Portal의 정식 운영 기능이 활성화됩니다. 온보딩 완료 후에도 회사 주소, 담당자, 계좌, 상품 정보 등 변경 사항이 발생하면 언제든지 해당 메뉴에서 실시간으로 수정할 수 있습니다. (Chapter 11 · Onboarding Complete)",
      answer_en: "Once all 7 steps are complete, the '7 / 7 Complete (100%)' green badge appears on the dashboard, unlocking standard Brand Portal operations. Even after completion, company details, owners, and product specs can be updated in real time whenever changes occur. (Chapter 11 · Onboarding Complete)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 9,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-01",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "신규 상품 등록(Add Product)을 진행하려면 어떤 사전 준비가 필요한가요?",
      question_en: "What preparations are needed before adding a new product (Product Registration)?",
      answer_ko: "상품 등록(Product Registration)을 시작하기 전에 먼저 포털에 등록된 활성(Active) 브랜드가 1개 이상 존재해야 합니다. 브랜드가 없는 경우 신규 브랜드 등록 화면(/portal/brands/new)으로 자동 이동하며, 등록 시 영문 제품명, 자사 제조사 SKU, 바코드(UPC/EAN), 기본 가격 및 패키지 규격을 준비하면 신속하게 등록할 수 있습니다. (Chapter 02 · Phase 1)",
      answer_en: "At least one active brand must be registered in the portal before adding a new product (Product Registration). If no brand exists, you will be redirected to New Brand (/portal/brands/new). Have your English product name, manufacturer SKU, barcode (UPC/EAN), basic pricing, and package dimensions ready. (Chapter 02 · Phase 1)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 1,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-02",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "임시 저장(Draft Product)과 제품 등록(Complete)의 차이는 무엇인가요?",
      question_en: "What is the difference between saving a draft product and complete product registration?",
      answer_ko: "임시 저장(Draft Product)은 브랜드, 카테고리, 영문명, 제조사 SKU만 입력하여 보완 대기 상태로 저장하는 것이며, '제품 등록 및 계속'은 필수 유효성을 충족한 후 상세 관리 화면(/portal/products/[id])으로 이동하는 방식입니다. 파트너사 온보딩 완수 및 MD 입점 검토를 위해서는 10대 필수 조건이 모두 입력된 등록 완료(COMPLETE) 상태여야 합니다. (Chapter 03 · Draft vs Complete)",
      answer_en: "Saving a draft product records basic identifiers into Draft status for later completion, while 'Register & Continue' validates Phase 1 and moves to Product Detail (/portal/products/[id]). Completing onboarding and MD selection reviews requires full 'COMPLETE' status across all 10 criteria. (Chapter 03 · Draft vs Complete)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 2,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-03",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "상품 등록 완료(COMPLETE)를 판정하는 10대 필수 조건은 무엇인가요?",
      question_en: "What are the 10 mandatory criteria for complete product registration?",
      answer_ko: "①소속 활성 브랜드, ②3-Depth 리프 카테고리, ③카테고리 필수 동적 속성(*), ④영문 공식 제품명, ⑤제조사 SKU 코드, ⑥원산지 국가, ⑦2대 필수 가격(한국소비자가 KRW + 수출FOB가 USD), ⑧3단계 물리 규격(단품/패키지/마스터카톤 및 입수량), ⑨식별 바코드(12자리 UPC 또는 13자리 EAN), ⑩대표 상품 이미지(1장 이상)가 모두 입력되어야 합니다. (Chapter 10 · Complete Criteria)",
      answer_en: "①Active Brand, ②3-Depth Leaf Category, ③Mandatory Category Attributes (*), ④English Product Name, ⑤Manufacturer SKU, ⑥Country of Origin, ⑦2 Required Prices (KRW Retail + FOB USD), ⑧3-Tier Physical Specs (Item/Package/Carton + Pack Qty), ⑨Barcode (12-digit UPC or 13-digit EAN), and ⑩At least 1 product image. (Chapter 10 · Complete Criteria)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 3,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-04",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "필수 항목을 입력했는데도 계속 Draft(보완 대기)로 표시되면 어떻게 하나요?",
      question_en: "Why does my product stay in Draft status and how do I fix missing fields?",
      answer_ko: "상품 상세 화면 상단의 로즈색 보완 대기 배너에 표시된 누락 항목 뱃지(예: [FOB 수출 가격 누락], [마스터 카톤 규격 누락])를 클릭하세요. 스마트 자동 포커스 기능이 해당 입력 탭으로 즉시 전환하고 누락된 필드로 스크롤하여 붉은색 테두리로 강조 표시해 줍니다. (Chapter 11 · Autofocus Navigation)",
      answer_en: "Click any missing field badge displayed in the rose-colored Draft banner at the top of the Product Detail screen. The interactive autofocus system will automatically switch to the correct tab, scroll directly to the missing input, and highlight it with a red border. (Chapter 11 · Autofocus Navigation)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 4,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-05",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "카테고리 선택 및 동적 속성은 어떻게 입력하나요?",
      question_en: "How do I select categories and enter dynamic attributes?",
      answer_ko: "탭 2(카테고리 & 속성)에서 3단계(대분류 ➔ 중분류 ➔ 소분류 리프) 카테고리를 선택하거나, 스마트 동의어 검색창에 키워드(예: 수분크림, Sunscreen)를 입력하여 즉시 지정합니다. 선택된 카테고리에 따라 피부 타입, 제형, SPF 등 맞춤형 동적 속성 폼이 자동으로 나타나며 붉은 별표(*) 필수 항목을 입력하면 됩니다. (Chapter 05 · Tab 2)",
      answer_en: "In Tab 2 (Category & Attributes), navigate through the 3-Depth hierarchy or use the smart synonym search (e.g., 'Moisturizer', 'Sunscreen') to select the leaf category. Tailored dynamic attribute forms (Skin Type, Formulation, SPF, etc.) load automatically based on your category. (Chapter 05 · Tab 2)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 5,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-06",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "미국 바코드(UPC)와 국제 바코드(EAN) 중 무엇을 입력해야 하나요?",
      question_en: "Should I enter a US UPC barcode or an international EAN barcode?",
      answer_ko: "미국 대형 오프라인 리테일러 입점을 위해서는 숫자 12자리 UPC 바코드 입력을 적극 권장합니다. 현재 UPC가 없는 경우 한국 880 표준을 포함한 숫자 13자리 EAN 바코드를 입력해도 등록 완료(COMPLETE)가 가능합니다. (Chapter 02 & 14 · Barcode Specs)",
      answer_en: "A 12-digit UPC barcode is strongly recommended for US brick-and-mortar retail placement. If you do not currently have a UPC, a standard 13-digit EAN barcode (including Korean 880 barcodes) is accepted for COMPLETE registration. (Chapter 02 & 14 · Barcode Specs)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 6,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-07",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "가격 정보(FOB, 소비자가) 및 수량별 공급가(Pricing)는 어떻게 설정하나요?",
      question_en: "How do I set pricing (FOB, Retail) and tiered quantity rates (MOQ Pricing)?",
      answer_ko: "탭 3(가격 정보)에서 한국 소비자가(KRW)와 수출용 FOB 공급가(USD)를 필수로 입력합니다. 시스템이 환율 기반 FOB 마진율(%)과 배수를 실시간 자동 연산하며, 대량 발주에 대응하기 위해 수량 구간별(MOQ Tier) 차등 공급가(Tiered Pricing)를 추가로 구성할 수 있습니다. (Chapter 06 · Tab 3)",
      answer_en: "In Tab 3 (Pricing Info), KRW Retail price and FOB Export price (USD) are mandatory. The system calculates real-time FOB margin (%) and multiples based on daily exchange rates. You can also configure quantity-based tiered pricing rates for bulk MOQ orders. (Chapter 06 · Tab 3)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 7,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-08",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "물류(Logistics) 3단계 물리 규격(단품, 패키지, 마스터 카톤)과 CBM은 어떻게 입력하나요?",
      question_en: "How do I enter the 3-tier logistics and package specifications, and calculate CBM?",
      answer_ko: "탭 4(물류 / 로지스틱스)에서 ①단품 본품 크기/순중량, ②단상자 개별 포장 패키지(Package) 규격/총중량, ③수출용 마스터 카톤 규격 및 카톤당 입수량을 입력합니다. cm/inch 및 g/kg/lb 단위 입력 시 실시간 자동 환산되며, 카톤 체적(CBM)은 공식에 따라 실시간 자동 계산됩니다. (Chapter 07 · Tab 4)",
      answer_en: "In Tab 4 (Logistics), enter ①Item specs (net dimensions/weight), ②Package specs (unit box dimensions/gross weight), and ③Master Carton dimensions with pack quantity. Units convert bidirectionally (cm/inch, g/kg/lb) and CBM is calculated automatically. (Chapter 07 · Tab 4)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 8,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-09",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "컨테이너 적재 시뮬레이터(Container Simulator)는 어떻게 활용하나요?",
      question_en: "How does the Container Load Simulator work for sea shipping logistics?",
      answer_ko: "탭 4에 마스터 카톤 규격과 카톤당 입수량을 입력하면, 해상 선적용 20ft 표준(28 CBM), 40ft 표준(58 CBM), 40ft High Cube(68 CBM) 컨테이너별 최대 적재 가능 카톤 수 및 총 제품 수량이 실시간 자동 시뮬레이션되어 표시됩니다. (Chapter 07 · Container Simulator)",
      answer_en: "When you enter master carton dimensions and pack quantity in Tab 4, the system automatically simulates maximum loadable cartons and total unit capacity across 20ft (28 CBM), 40ft (58 CBM), and 40ft HQ (68 CBM) sea containers in real time. (Chapter 07 · Container Simulator)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 9,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-10",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "상품 이미지(Product Image) 등록 요건과 대표 썸네일 변경 방법은 무엇인가요?",
      question_en: "What are the product image requirements and how do I change the thumbnail?",
      answer_ko: "상품 이미지는 최대 10장, 파일당 최대 10MB까지 등록할 수 있으며 JPG, PNG, WEBP 포맷을 지원합니다 (1000×1000 이상 흰색 배경 정방형 권장). 탭 5(미디어)에서 등록된 이미지 카드를 드래그하여 첫 번째(Position 0) 위치에 놓으면 대표 썸네일로 즉시 자동 지정 및 저장됩니다. (Chapter 08 · Tab 5)",
      answer_en: "Upload up to 10 product images (max 10MB each, JPG/PNG/WEBP; 1000x1000 white background square recommended). In Tab 5 (Media), drag and drop any image card to the first position (Position 0) to instantly set and save it as the primary thumbnail. (Chapter 08 · Tab 5)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-11",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "국문 전성분 번역 및 원산지, 리드타임은 어떻게 등록하나요?",
      question_en: "How do I register ingredients translation, country of origin, and lead time?",
      answer_ko: "탭 1(기본 정보)에서 원산지 국가와 출고 리드타임(예: 14일), 용량/중량을 입력합니다. 한글 전성분 텍스트를 입력창에 붙여넣고 '영문 번역' 버튼을 클릭하면 전문 화장품 용어로 실시간 번역되어 영문 전성분 필드에 원클릭으로 자동 적용됩니다. (Chapter 04 · Tab 1)",
      answer_en: "In Tab 1 (Basic Info), enter Country of Origin, Lead Time (e.g., 14 days), and Volume/Weight. Paste Korean ingredients and click 'Translate to English' to perform real-time cosmetic terminology translation and auto-populate English ingredients. (Chapter 04 · Tab 1)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 11,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-12",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "인증서(Certification), 상표권 및 인허가 서류는 어떻게 업로드하고 버전 관리되나요?",
      question_en: "How are certification documents, trademarks, and compliance certificates uploaded and versioned?",
      answer_ko: "탭 6(인허가 & 보증서 / 인증서)에서 전성분표, 상표등록증, 시험성적서, 유통 증빙 서류 등을 업로드합니다. 동일 서류 항목에 새로운 파일을 업로드하면 이전 파일이 삭제되지 않고 v1, v2, v3 형태로 과거 버전 이력이 자동 보존됩니다. 미국 MoCRA 등 심층 규제 절차는 MAN-B-REG-001 문서를 참조하세요. (Chapter 09 · Tab 6)",
      answer_en: "In Tab 6 (Certificates), upload ingredient sheets, trademark registrations, test reports, and compliance certification documents. Uploading updated files automatically preserves past history as v1, v2, v3 versioning without overwriting. Refer to MAN-B-REG-001 for MoCRA compliance details. (Chapter 09 · Tab 6)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 12,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-13",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "상품의 3대 독립 상태(등록, 선정, 판매)는 각각 무엇을 의미하나요?",
      question_en: "What do the 3 independent status dimensions (Registration, Selection, Sales) mean?",
      answer_ko: "①등록 상태(Draft/Complete): 브랜드사가 10대 필수 정보를 입력 완료했는지 나타냄, ②선정 상태(Unreviewed/Under Review/Selected/Info Req/Not Selected): K SELECT MD가 미국 유통 공급 대상 여부를 심사함, ③판매 상태(Preparing/On Sale/Paused/Ended): 통관 및 현지 발주/판매 진행 상태를 나타내며 세 상태는 독립적으로 동작합니다. (Chapter 12 · 3 Status Dimensions)",
      answer_en: "①Registration Status (Draft/Complete): Whether mandatory product data is 100% complete; ②Selection Status (Unreviewed/Under Review/Selected/Info Req): K SELECT MD review for retail placement; ③Sales Status (Preparing/On Sale/Paused/Ended): Logistics, clearance, and retail order execution. (Chapter 12 · 3 Status Dimensions)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 13,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-prod-14",
      portal_scope: "BRAND",
      topic_id: "topic-product",
      source_knowledge_id: "kno-product-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      question_ko: "등록된 상품 수정 및 삭제는 어떻게 하며, 삭제 후 복구가 필요한 경우 어떻게 하나요?",
      question_en: "How do I edit or delete a product, and how can I request recovery if deleted?",
      answer_ko: "상품 정보 수정(상품 수정)은 상품 상세 화면에서 언제든지 실시간으로 가능하며, 상품 삭제 시 물리적 데이터는 삭제되지 않고 deleted_at 타임스탬프가 기록되어 'Deleted (삭제됨)' 필터 탭으로 안전하게 격리 보관됩니다. SKU 및 과거 주문 이력은 영구 보존되며, 실수로 삭제하여 복구 및 재활성화가 필요한 경우 Help Center 1:1 고객지원으로 문의하시면 운영팀이 처리해 드립니다. (Chapter 13 · Soft Delete)",
      answer_en: "Product editing can be performed at any time in the Product Detail screen. Product deletion performs a soft delete with a deleted_at timestamp, safely moving the product to the 'Deleted' filter tab. SKU and order histories are preserved. If you accidentally deleted an item and need recovery support, contact Help Center 1:1 Support. (Chapter 13 · Soft Delete)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 14,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
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
    },
    {
      id: "ver-onboarding-guide-v10",
      knowledge_id: "kno-onboarding-guide-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001 v1.0)",
      title_en: "K SELECT Brand Portal Onboarding Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (Claude Design PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-onboarding-guide-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-onboarding-guide-v10")?.content_en || "",
      what_changed: "MAN-B-ONB-001 Brand Portal Onboarding Guide 최초 공식 배포",
      why_changed: "파트너사 온보딩 7단계 표준 절차 가이드 정립",
      effective_date: "2026-10-01",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-product-management-v10",
      knowledge_id: "kno-product-management-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001 v1.0)",
      title_en: "K SELECT Brand Portal Product Registration & Management Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (29-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-product-management-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-product-management-v10")?.content_en || "",
      what_changed: "MAN-B-PROD-001 Brand Portal Product Registration & Management Guide 최초 공식 배포",
      why_changed: "브랜드 파트너사 상품 등록 및 관리 표준 절차 가이드 정립",
      effective_date: "2026-10-01",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-order-management-v10",
      knowledge_id: "kno-order-management-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001 v1.0)",
      title_en: "K SELECT Brand Portal Order Management & Purchase Order Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (20-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-order-management-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-order-management-v10")?.content_en || "",
      what_changed: "MAN-B-ORD-001 Brand Portal Order Management Guide 최초 공식 배포 (2-Phase 아키텍처 및 6단계 PO 라이프사이클)",
      why_changed: "브랜드 파트너사 발주 요청 검토 및 정식 PO 이행 표준 절차 가이드 정립",
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
    },
    {
      id: "rel-onboarding-dashboard",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "ONBOARDING",
      related_menu: "Dashboard Onboarding Checklist",
      related_route: "/portal",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-company",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Company Information",
      related_route: "/portal/company/info",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-account",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "ACCOUNT",
      related_menu: "Admin Profile",
      related_route: "/portal/account",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-brands",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "BRAND",
      related_menu: "Brand Management",
      related_route: "/portal/brands",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-users",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Team Members",
      related_route: "/portal/company/users",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-tasks",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Task Owners",
      related_route: "/portal/company/info?tab=tasks",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-products",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "PRODUCTS",
      related_menu: "Product Registration",
      related_route: "/portal/products",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-onboarding-agreements",
      knowledge_id: "kno-onboarding-guide-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Agreement Signing",
      related_route: "/portal/company/info?tab=agreements",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      created_at: now
    },
    {
      id: "rel-product-list",
      knowledge_id: "kno-product-management-v10",
      related_portal: "Brand Portal",
      related_module: "PRODUCTS",
      related_menu: "Product List",
      related_route: "/portal/products",
      manual_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      created_at: now
    },
    {
      id: "rel-product-new",
      knowledge_id: "kno-product-management-v10",
      related_portal: "Brand Portal",
      related_module: "PRODUCTS",
      related_menu: "New Product Registration",
      related_route: "/portal/products/new",
      manual_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      created_at: now
    },
    {
      id: "rel-product-detail",
      knowledge_id: "kno-product-management-v10",
      related_portal: "Brand Portal",
      related_module: "PRODUCTS",
      related_menu: "Product Detail Tabs",
      related_route: "/portal/products/[id]",
      manual_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      created_at: now
    },
    {
      id: "rel-admin-products-mgmt",
      knowledge_id: "kno-product-management-v10",
      related_portal: "Admin",
      related_module: "PRODUCTS",
      related_menu: "Products Management",
      related_route: "/admin/products",
      manual_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      created_at: now
    },
    {
      id: "rel-order-requests",
      knowledge_id: "kno-order-management-v10",
      related_portal: "Brand Portal",
      related_module: "ORDERS",
      related_menu: "Purchase Order Requests",
      related_route: "/portal/orders/requests",
      manual_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      created_at: now
    },
    {
      id: "rel-order-purchase-orders",
      knowledge_id: "kno-order-management-v10",
      related_portal: "Brand Portal",
      related_module: "ORDERS",
      related_menu: "Purchase Orders",
      related_route: "/portal/orders/purchase-orders",
      manual_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      created_at: now
    },
    {
      id: "rel-order-shipping",
      knowledge_id: "kno-order-management-v10",
      related_portal: "Brand Portal",
      related_module: "ORDERS",
      related_menu: "Shipments & Tracking",
      related_route: "/portal/orders/shipping",
      manual_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      created_at: now
    },
    {
      id: "rel-admin-orders-mgmt",
      knowledge_id: "kno-order-management-v10",
      related_portal: "Admin",
      related_module: "ORDERS",
      related_menu: "Purchase Orders Management",
      related_route: "/admin/orders",
      manual_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
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
    },
    {
      id: "asset-onboarding-guide-v10",
      knowledge_id: "kno-onboarding-guide-v10",
      manual_title: "K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-onboarding-guide-v10",
      file_name: "MAN-B-ONB-001_Onboarding_Guide_v1.0.pdf",
      file_size: 3948614,
      published_date: "2026-10-01",
      created_at: now
    },
    {
      id: "asset-product-management-v10",
      knowledge_id: "kno-product-management-v10",
      manual_title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-product-management-v10",
      file_name: "MAN-B-PROD-001_Product-Management_V1.pdf",
      file_size: 3296047,
      published_date: "2026-10-01",
      created_at: now
    },
    {
      id: "asset-order-management-v10",
      knowledge_id: "kno-order-management-v10",
      manual_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-order-management-v10",
      file_name: "MAN-B-ORD-001_Order-Management_V1.pdf",
      file_size: 4188373,
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
    },
    {
      id: "log-onboarding-guide-v10",
      knowledge_id: "kno-onboarding-guide-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 온보딩 가이드", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-ONB-001 Official Publication",
      created_at: now
    },
    {
      id: "log-product-management-v10",
      knowledge_id: "kno-product-management-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 상품 등록 및 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-PROD-001 Official Publication",
      created_at: now
    },
    {
      id: "log-order-management-v10",
      knowledge_id: "kno-order-management-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-ORD-001 Official Publication",
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

// --------------------------------------------------
// FAQ & Suggested Questions Store Methods (KNW-FAQ-001 & ADM-KNW-003)
// --------------------------------------------------

export async function getStoreFaqs(
  knowledgeId?: string,
  status?: FaqStatus,
  audience?: AudienceType,
  portalScope?: PortalScope,
  topicId?: string
): Promise<KnowledgeFaqItem[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    let query = supabase.from("knowledge_faqs").select("*");

    if (knowledgeId) {
      query = query.eq("source_knowledge_id", knowledgeId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (portalScope) {
      query = query.eq("portal_scope", portalScope);
    }
    if (topicId) {
      query = query.eq("topic_id", topicId);
    }

    const { data } = await query.order("display_order", { ascending: true });
    if (data && data.length > 0) {
      // Sync in-memory store
      data.forEach((dbFaq: KnowledgeFaqItem) => {
        const idx = memoryFaqs.findIndex(f => f.id === dbFaq.id);
        if (idx >= 0) memoryFaqs[idx] = dbFaq;
        else memoryFaqs.push(dbFaq);
      });
    }
  } catch (e) {}

  let list = [...memoryFaqs];
  if (knowledgeId) {
    list = list.filter(f => f.source_knowledge_id === knowledgeId);
  }
  if (status) {
    list = list.filter(f => f.status === status);
  }
  if (portalScope) {
    list = list.filter(f => (f.portal_scope || "BRAND") === portalScope);
  }
  if (topicId) {
    list = list.filter(f => f.topic_id === topicId);
  }
  if (audience) {
    const target = audience.toUpperCase();
    list = list.filter(f => {
      const auds = (f.audience || []).map(a => a.toUpperCase());
      if (target === "BRAND") return auds.includes("BRAND");
      if (target === "RETAIL" || target === "RETAILER") return auds.includes("RETAIL") || auds.includes("RETAILER");
      if (target === "INTERNAL") return auds.includes("INTERNAL") || auds.includes("ADMIN / MANAGEMENT");
      if (target === "PUBLIC") return auds.includes("PUBLIC");
      return auds.includes(target);
    });
  }

  list.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return list;
}

export async function getStoreFaqById(id: string): Promise<KnowledgeFaqItem | null> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("knowledge_faqs").select("*").eq("id", id).maybeSingle();
    if (data) {
      const idx = memoryFaqs.findIndex(f => f.id === data.id);
      if (idx >= 0) memoryFaqs[idx] = data as KnowledgeFaqItem;
      else memoryFaqs.push(data as KnowledgeFaqItem);
      return data as KnowledgeFaqItem;
    }
  } catch (e) {}

  return memoryFaqs.find(f => f.id === id) || null;
}

export async function saveStoreFaq(faq: KnowledgeFaqItem): Promise<KnowledgeFaqItem> {
  initSeedData();
  const idx = memoryFaqs.findIndex(f => f.id === faq.id);
  if (idx >= 0) {
    memoryFaqs[idx] = faq;
  } else {
    memoryFaqs.unshift(faq);
  }

  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_faqs").upsert(faq);
  } catch (e) {}

  return faq;
}

export async function deleteStoreFaq(id: string): Promise<boolean> {
  initSeedData();
  memoryFaqs = memoryFaqs.filter(f => f.id !== id);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_faqs").delete().eq("id", id);
  } catch (e) {}
  return true;
}

// --------------------------------------------------
// Topic Management Store Methods (ADM-KNW-003)
// --------------------------------------------------

export async function getStoreTopics(
  portalScope?: PortalScope,
  includeInactive: boolean = false
): Promise<KnowledgeTopic[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    let query = supabase.from("knowledge_topics").select("*");
    if (portalScope) {
      query = query.eq("portal_scope", portalScope);
    }
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data } = await query.order("display_order", { ascending: true });
    if (data && data.length > 0) {
      data.forEach((dbTopic: KnowledgeTopic) => {
        const idx = memoryTopics.findIndex(t => t.id === dbTopic.id);
        if (idx >= 0) memoryTopics[idx] = dbTopic;
        else memoryTopics.push(dbTopic);
      });
    }
  } catch (e) {}

  let list = [...memoryTopics];
  if (portalScope) {
    list = list.filter(t => t.portal_scope === portalScope);
  }
  if (!includeInactive) {
    list = list.filter(t => t.is_active);
  }

  list.sort((a, b) => a.display_order - b.display_order);

  // Compute counts for topics
  const allFaqs = memoryFaqs;
  const allKnowledge = memoryItems.filter(k => k.status === "PUBLISHED");

  return list.map(t => {
    const topicFaqs = allFaqs.filter(f => f.topic_id === t.id && (f.portal_scope || "BRAND") === t.portal_scope);
    // Count knowledge items matching this topic
    const topicKnowledge = allKnowledge.filter(k => {
      const mod = (k.module || "").toUpperCase();
      const cat = (k.category || "").toUpperCase();
      if (t.match_modules && t.match_modules.length > 0) {
        if (t.match_modules.some(m => mod.includes(m.toUpperCase()) || cat.includes(m.toUpperCase()))) {
          return true;
        }
      }
      if (t.match_keywords && t.match_keywords.length > 0) {
        const title = `${k.title_ko || ""} ${k.title || ""}`.toLowerCase();
        if (t.match_keywords.some(kw => title.includes(kw.toLowerCase()))) {
          return true;
        }
      }
      return false;
    });

    return {
      ...t,
      faq_count: topicFaqs.length,
      knowledge_count: topicKnowledge.length
    };
  });
}

export async function getStoreTopicById(id: string): Promise<KnowledgeTopic | null> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("knowledge_topics").select("*").eq("id", id).maybeSingle();
    if (data) {
      const idx = memoryTopics.findIndex(t => t.id === data.id);
      if (idx >= 0) memoryTopics[idx] = data as KnowledgeTopic;
      else memoryTopics.push(data as KnowledgeTopic);
      return data as KnowledgeTopic;
    }
  } catch (e) {}

  return memoryTopics.find(t => t.id === id) || null;
}

export async function saveStoreTopic(topic: KnowledgeTopic): Promise<KnowledgeTopic> {
  initSeedData();
  const idx = memoryTopics.findIndex(t => t.id === topic.id);
  if (idx >= 0) {
    memoryTopics[idx] = topic;
  } else {
    memoryTopics.push(topic);
  }

  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_topics").upsert(topic);
  } catch (e) {}

  return topic;
}

export async function createStoreTopic(data: Partial<KnowledgeTopic>): Promise<KnowledgeTopic> {
  initSeedData();
  const now = new Date().toISOString();
  const portalScope = data.portal_scope || "BRAND";
  
  // Calculate next display_order
  const scopeTopics = memoryTopics.filter(t => t.portal_scope === portalScope);
  const maxOrder = scopeTopics.reduce((max, t) => Math.max(max, t.display_order || 0), 0);

  const slugId = data.id || `topic-${portalScope.toLowerCase()}-${Date.now().toString(36)}`;

  const newTopic: KnowledgeTopic = {
    id: slugId,
    portal_scope: portalScope,
    name_ko: data.name_ko || "새로운 토픽",
    name_en: data.name_en || null,
    short_desc_ko: data.short_desc_ko || null,
    short_desc_en: data.short_desc_en || null,
    description_ko: data.description_ko || null,
    description_en: data.description_en || null,
    icon: data.icon || "📁",
    display_order: data.display_order ?? (maxOrder + 1),
    is_active: data.is_active ?? true,
    match_modules: data.match_modules || [],
    match_keywords: data.match_keywords || [],
    created_at: now,
    updated_at: now
  };

  return await saveStoreTopic(newTopic);
}

export async function updateStoreTopic(
  id: string,
  updates: Partial<KnowledgeTopic>
): Promise<KnowledgeTopic | null> {
  initSeedData();
  const existing = await getStoreTopicById(id);
  if (!existing) return null;

  const updated: KnowledgeTopic = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  return await saveStoreTopic(updated);
}

export async function deleteStoreTopic(id: string): Promise<boolean> {
  initSeedData();
  memoryTopics = memoryTopics.filter(t => t.id !== id);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_topics").delete().eq("id", id);
  } catch (e) {}
  return true;
}

export async function reorderStoreTopics(
  portalScope: PortalScope,
  orderedIds: string[]
): Promise<KnowledgeTopic[]> {
  initSeedData();
  const updatedTopics: KnowledgeTopic[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const topic = memoryTopics.find(t => t.id === id && t.portal_scope === portalScope);
    if (topic) {
      topic.display_order = i + 1;
      topic.updated_at = new Date().toISOString();
      updatedTopics.push(topic);
      try {
        const supabase = createAdminClient();
        await supabase.from("knowledge_topics").update({ display_order: i + 1, updated_at: topic.updated_at }).eq("id", id);
      } catch (e) {}
    }
  }

  return await getStoreTopics(portalScope, true);
}



