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
      document_size: 4188914,
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
    },
    {
      id: "kno-regulatory-compliance-v11",
      document_url: "/api/admin/knowledge/asset/asset-regulatory-compliance-v11",
      document_name: "MAN-B-REG-001_Regulatory-Compliance_V1.pdf",
      document_size: 1915000,
      document_type: "application/pdf",
      slug: "man-b-reg-001-regulatory-compliance-guide",
      title: "MAN-B-REG-001: Regulatory, Certification & Compliance User Guide",
      title_ko: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      title_en: "K SELECT Brand Portal Regulatory, Certification & Compliance User Guide (MAN-B-REG-001)",
      summary_ko: "미국 화장품 규제 현대화법(MoCRA) 및 FDA 기준에 맞춘 한/미 상표권(KIPO/USPTO), 전성분 실시간 영문 INCI 번역기, 5대 인허가 서류(FDA 등록증, 상표권, COA/MSDS 성분인증, 특허, 기타) 버전 관리 및 식별 바코드(UPC/EAN) 유효성 검증을 위한 공식 사용자 매뉴얼입니다.",
      summary_en: "Official user manual for K SELECT Brand Portal covering KIPO/USPTO trademark declarations, dual-language ingredient declarations with real-time AI INCI translation, 5 certificate categories with lossless versioning, and UPC/EAN barcode validation.",
      content_ko: `## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 브랜드 파트너사가 미국 화장품 규제 현대화법(MoCRA) 및 FDA 규정에 부합하도록 상표권 증빙, 이중언어 전성분(INCI), 5대 인허가 서류(FDA 등록, 상표권, MSDS/COA 성분인증, 특허, 기타) 및 식별 바코드(UPC/EAN)를 체계적으로 관리할 수 있도록 안내하는 공식 실무 가이드입니다.

## 2. 4대 규제 관리 영역
1. **상표권 관리 (Policy 02)**: 상표권 미보유 브랜드도 포털 개설 가능, 한국(KIPO)/미국(USPTO) 번호 및 증빙 서류 관리.
2. **이중언어 전성분 선언 & AI 번역기**: 국문 성분 입력 시 국제 표준 INCI 영문명 실시간 AI 번역 및 원클릭 적용.
3. **5대 인허가 서류 버전 관리**: fda_registration, trademark, ingredient_certification(MSDS/COA), patent, other 서류 업로드 및 v1 -> v2 무손실 버전 관리.
4. **글로벌 식별 바코드 검증**: 12자리 UPC / 13자리 EAN 유효성 검증 및 새 바코드 문의 지원.

## 3. 어드민 심사 및 변경 이력 감사
어드민 실시간 서류 대조 검증 및 product_change_history 불변 감사 로그 기록.`,
      content_en: `## 1. Introduction & Purpose
Official user guide for K SELECT Brand Portal partners to comply with US MoCRA and FDA cosmetic regulations.

## 2. 4 Core Pillars
- Trademark Management (KIPO / USPTO with Policy 02)
- Dual-Language Ingredients & Real-Time AI INCI Translator
- 5 Certificate Categories with Lossless Versioning
- UPC (12-digit) / EAN (13-digit) Barcode Validation

## 3. Admin Verification & Audit History
Real-time proof verification in Admin and immutable diff change history logging.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "REGULATORY",
      category: "Brand Portal",
      tags: ["MANUAL", "REGULATORY", "COMPLIANCE", "CERTIFICATION", "TRADEMARK", "KIPO", "USPTO", "INGREDIENTS", "INCI", "FDA", "CERTIFICATE", "BARCODE", "MAN-B-REG-001", "OFFICIAL", "인허가", "상표권", "전성분"],
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
      current_version: "v1.1.0",
      effective_date: "2026-10-01",
      created_at: "2026-10-01T09:00:00Z",
      updated_at: now
    },
    {
      id: "kno-retail-applications-v10",
      document_url: "/api/admin/knowledge/asset/asset-retail-applications-v10",
      document_name: "MAN-B-RET-001_Retail-Applications_V1.pdf",
      document_size: 1129760,
      document_type: "application/pdf",
      slug: "man-b-ret-001-retail-applications-guide",
      title: "MAN-B-RET-001: Retail Applications & Placement User Guide",
      title_ko: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      title_en: "K SELECT Brand Portal Retail Applications & Placement User Guide (MAN-B-RET-001)",
      summary_ko: "미국 메이저 온/오프라인 리테일 네트워크(TJX, Nordstrom Rack, Ross, Marshalls, Burlington, Target, Ulta 등) 입점 신청, 카탈로그 선택, 공급 역량 및 리드타임 선언, Readiness 검증, MD 팀 추가 정보 요청(Info Request) 소통 및 승인 심사 프로세스를 체계적으로 안내하는 공식 사용자 매뉴얼입니다.",
      summary_en: "Official user manual for K SELECT Brand Portal covering retail network placement applications, product catalog selection, capacity and lead time declaration, Readiness validation, MD Info Request response workflow, and approval review processes.",
      content_ko: `## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 브랜드 파트너사가 미국 메이저 온/오프라인 리테일러 입점 신청을 준비하고, 제품 카탈로그 선택, 공급 역량 및 리드타임 선언, Readiness 자격 검증, MD 팀 추가 정보 요청(Info Request) 대응 및 최종 승인 결과를 관리할 수 있도록 지원하는 공식 실무 가이드입니다.

## 2. 5단계 입점 신청 라이프사이클
1. **DRAFT (임시저장)**: 리테일러 선택, 희망 제품군 선택, 공급 가능 수량/MOQ/리드타임/제안 단가 입력.
2. **SUBMITTED (제출완료)**: Readiness Check 통과 후 MD 심사팀으로 정식 접수.
3. **UNDER_REVIEW (심사중)**: K SELECT MD 팀의 카테고리 적합성, 바코드/서류 상태 및 납기 역량 정밀 평가.
4. **INFO_REQUESTED (추가 정보 요청)**: MD 팀의 보완 요청 확인 및 회신/보완 서류 제출.
5. **APPROVED / REJECTED (승인 / 거절)**: 최종 입점 확정 및 후속 PO 연계, 또는 명확한 사유 확인.

## 3. 핵심 주의사항
- "협의 필요" 상태는 탈락 사유가 아니며, MD 팀과 공급 일정 및 물량을 사전 조율하는 협의 단계입니다.
- 필수 규제 서류 및 UPC 바코드가 준비된 상품만 입점 승인율이 높습니다.`,
      content_en: `## 1. Introduction & Purpose
Official user guide for K SELECT Brand Portal partners to prepare retail placement applications, select product catalogs, declare capacity and lead time, validate readiness, respond to MD Info Requests, and manage approval results.

## 2. 5-Stage Retail Application Lifecycle
1. **DRAFT**: Retailer selection, product catalog selection, capacity/MOQ/lead time/pricing input.
2. **SUBMITTED**: Formal submission after Readiness Check.
3. **UNDER_REVIEW**: K SELECT MD team review on category fit, barcodes, documents, and lead time capacity.
4. **INFO_REQUESTED**: Brand response and document upload for MD inquiries.
5. **APPROVED / REJECTED**: Final placement decision and next steps.

## 3. Core Policy Reminders
- '협의 필요' (Negotiation Needed) is not a rejection reason; it is an active coordination step with the MD team.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "RETAIL",
      category: "Brand Portal",
      tags: ["MANUAL", "RETAIL", "APPLICATION", "PLACEMENT", "READINESS", "INFO_REQUEST", "MD_REVIEW", "CATALOG", "TJX", "ROSS", "TARGET", "ULTA", "MAN-B-RET-001", "OFFICIAL", "리테일", "입점신청", "입점관리"],
      owner_id: "staff-admin-01",
      owner_name: "Brand Operations Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-10-02T12:00:00Z",
      current_version: "v1.0",
      effective_date: "2026-10-02",
      created_at: "2026-10-02T09:00:00Z",
      updated_at: now
    },
    {
      id: "kno-shipping-logistics-v10",
      document_url: "/api/admin/knowledge/asset/asset-shipping-logistics-v10",
      document_name: "MAN-B-LOG-001_Shipping-Logistics_V1.pdf",
      document_size: 3495347,
      document_type: "application/pdf",
      slug: "man-b-log-001-shipping-logistics-guide",
      title: "MAN-B-LOG-001: Shipping & International Logistics Guide",
      title_ko: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      title_en: "K SELECT Brand Portal Shipping & International Logistics Guide (MAN-B-LOG-001)",
      summary_ko: "국제 B2B 공급망 출고 준비(Goods Readiness), 운송 책임(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED) 트랙, 무역 서류(P/L, C/I) 업로드, CBM 카고 스펙 산출, Inbound 선적 추적 및 미국 창고 입고 검수(Receiving) 통합 가이드",
      summary_en: "Operational guide for B2B shipping readiness submission, transport responsibility tracks (LETUSTO_ARRANGED vs SUPPLIER_ARRANGED), trade documents (P/L, C/I), CBM cargo specs, inbound shipment tracking, and US warehouse receiving inspection.",
      content_ko: `# K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 발주 확정 후 출고 준비 완료 등록(Goods Readiness), 무역 서류 첨부, 선적 모니터링, 미국 창고 입고 검수에 이르는 국제 물류 절차를 안내하는 공식 실무 가이드입니다.

## 2. 운송 책임 트랙 (Shipping Responsibility Tracks)
1. **Track 1: LETUSTO_ARRANGED (본사 지정 운송 - FOB 등)**: 본사 지정 포워더가 공급사 창고에서 화물을 수거하여 국제 운송 및 입고를 담당합니다.
2. **Track 2: SUPPLIER_ARRANGED (공급사 자체 운송 - DDP 등)**: 공급사가 자체 물류망을 이용해 미국 현지 물류센터 도크까지 직접 운송을 수행합니다.

## 3. 핵심 규칙 및 수량 차단 (Overage Protection)
- **가용 출고 수량 (availableReadiness)**: 발주 수량에서 기존 출고 완료 수량을 차단한 잔여 범위 내에서만 출고 등록이 허용됩니다.
- **2대 필수 무역 서류**: 패킹리스트(Packing List) 및 상업송장(Commercial Invoice)을 PDF/이미지 형태로 필수 첨부해야 합니다.`,
      content_en: `# K SELECT Brand Portal Shipping & International Logistics Guide (MAN-B-LOG-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners submitting shipping readiness, uploading trade documents, tracking inbound shipments, and monitoring US warehouse receiving.

## 2. Transport Responsibility Tracks
1. Track 1: LETUSTO_ARRANGED (FOB): Headquarters-designated freight forwarder handles pickup and international transport.
2. Track 2: SUPPLIER_ARRANGED (DDP): Supplier handles direct shipment to US fulfillment center dock.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "LOGISTICS",
      category: "Brand Portal",
      tags: ["MANUAL", "LOGISTICS", "SHIPPING", "EXPORT", "READINESS", "FOB", "DDP", "CBM", "MAN-B-LOG-001", "OFFICIAL", "물류", "선적", "출고"],
      owner_id: "staff-logistics-01",
      owner_name: "Logistics Operations Desk",
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
      id: "kno-permissions-user-management-v10",
      document_url: "/api/admin/knowledge/asset/asset-permissions-user-management-v10",
      document_name: "MAN-B-PERM-001_Permissions-User-Management_V1.pdf",
      document_size: 1441842,
      document_type: "application/pdf",
      slug: "man-b-perm-001-permissions-user-management-guide",
      title: "MAN-B-PERM-001: Permissions & User Management Guide",
      title_ko: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      title_en: "K SELECT Brand Portal Permissions & User Management Guide (MAN-B-PERM-001)",
      summary_ko: "K SELECT Brand Portal 소속 팀원 초대, 5대 역할 프리셋(restricted / viewer / staff / manager / admin), 9대 업무 영역 × 4단계 접근 레벨 ACL 매트릭스 설정, 6대 담당 업무 배정(Task Assignment) 및 세이프티 차단 규칙(Initial Owner / Last Admin / Self-delete protection) 통합 운영 매뉴얼",
      summary_en: "Operational guide for team member invitations, 5 role presets (restricted / viewer / staff / manager / admin), 9 ACL categories x 4 levels access matrix, 6 primary contact task assignments, and account safety protections.",
      content_ko: `# K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001 v1.0)

## 1. 개요 및 권한 구조 (Overview & Architecture)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 회사 소속 멤버를 초대하고, 5대 역할 프리셋 및 9대 업무 영역의 ACL(Access Control List) 매트릭스를 설정하며, 6대 담당 업무를 배정하고 멤버 제거 및 보호 규칙을 관리하는 공식 실무 가이드입니다.

## 2. 5대 역할 프리셋 & 2대 DB 멤버십
- **Role Presets**: restricted(접근 제한), viewer(조회 사용자), staff(담당자), manager(매니저), admin(관리자)
- **DB Membership**: company_admin, company_staff

## 3. 9대 업무 영역 × 4단계 ACL 매트릭스
- **Categories**: application, brands, products, orders, finance, support, company_info, bank_info, agreements
- **Levels**: none(0), read(1), write(2), manage(3)

## 4. 담당 업무 배정 ≠ ACL 권한 경계
6대 담당 업무 배정(company_apply, contract, product_cert, pricing_quote, logistics_inventory, settlement_inquiry)은 운영팀 소통 및 알림 수신 목적이며 포털 메뉴 권한에는 영향을 주지 않습니다.`,
      content_en: `# K SELECT Brand Portal Permissions & User Management Guide (MAN-B-PERM-001 v1.0)

## 1. Overview & Architecture
Official user manual for K SELECT Brand Portal partners managing team invitations, 5 role presets, 9-category ACL matrix, 6 primary contact task assignments, and safety protections.

## 2. 5 Role Presets & 2 DB Memberships
- Role Presets: restricted, viewer, staff, manager, admin
- DB Membership: company_admin, company_staff

## 3. 9 Categories x 4 Levels ACL Matrix
- Categories: application, brands, products, orders, finance, support, company_info, bank_info, agreements
- Levels: none, read, write, manage`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "COMPANY",
      category: "Brand Portal",
      tags: ["MANUAL", "PERMISSIONS", "USERS", "COMPANY", "ACL", "ROLES", "PRESETS", "TASK_ASSIGNMENT", "MAN-B-PERM-001", "OFFICIAL", "권한", "사용자", "팀원", "역할"],
      owner_id: "staff-admin-01",
      owner_name: "Brand Operations Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-10-02T12:00:00Z",
      current_version: "v1.0",
      effective_date: "2026-10-02",
      created_at: now,
      updated_at: now
    },
    {
      id: "kno-finance-settlement-v10",
      document_url: "/api/admin/knowledge/asset/asset-finance-settlement-v10",
      document_name: "MAN-B-FIN-001_Finance-Settlement_V1.pdf",
      document_size: 4716798,
      document_type: "application/pdf",
      slug: "man-b-fin-001-finance-settlement-guide",
      title: "MAN-B-FIN-001: Finance & Settlement User Guide",
      title_ko: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      title_en: "K SELECT Brand Portal Finance & Settlement User Guide (MAN-B-FIN-001)",
      summary_ko: "K SELECT Brand Portal의 공식 발주 확정(PO Confirmed) 후 인보이스 발행, 3대 독립 상태 분리(Invoice ≠ Payment ≠ Settlement), Single Active Invoice 단일 활성 인보이스 규칙, 실시간 미지급 잔액(balance_due) 연산, 단가/수량/파손 정산 조정(Adjustment) 및 본사 대금 결재/송금 집행을 위한 공식 사용자 매뉴얼입니다.",
      summary_en: "Official user manual for K SELECT Brand Portal covering post-PO confirmation invoice creation, strict tri-state disambiguation (Invoice ≠ Payment ≠ Settlement), Single Active Invoice dual enforcement, real-time balance_due calculation, settlement adjustments (shortage, damage, price differences), and admin remittance payout execution.",
      content_ko: `# K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 입점 브랜드 파트너사가 공식 발주 확정(PO Status: APPROVED / SENT 및 supplier_confirmation: CONFIRMED) 완료 후 대금 청구를 위한 공급사 인보이스(Supplier Invoice)를 작성·제출하고, 3대 독립 상태 차원(Invoice ≠ Payment ≠ Settlement) 및 실시간 미지급 잔액(balance_due)을 관리하며 본사 대금 결재/송금 집행을 완수할 수 있도록 안내하는 공식 실무 가이드입니다.

---

## 2. 3대 핵심 도메인 경계 원칙 (Core Governance & Disambiguation)
1. **발주 확정 병렬 전환 (ORD → FIN Parallel Handoff)**:
   - 공식 발주 확정 완료 시 물류(LOG)와 정산(FIN) 도메인으로 동시 전환되며, 인보이스 작성은 물류 입고 검수 완료를 직렬 전제조건으로 기다리지 않습니다.
2. **물류 완료 ≠ 정산 완료 (FIN ↔ LOG Boundary)**:
   - 물류 도메인의 배송 상태(SHIPPED / ARRIVED / RECEIVED)와 정산 도메인의 상태(Invoice, Payment, Settlement)는 상호 독립적인 상태 머신으로 작동합니다 (**Shipping Complete ≠ Settlement Complete**).
3. **3대 독립 상태 차원 (Tri-State Disambiguation: Invoice ≠ Payment ≠ Settlement)**:
   - **문서 상태 (Invoice Status)**: DRAFT(초안) → SUBMITTED(제출완료) → APPROVED(승인) / REJECTED(반려) / VOID(무효화)
   - **지급 상태 (Payment Status)**: 실시간 잔액 기반 동적 산출 UNPAID(미지급) → PARTIALLY_PAID(일부지급) → PAID(지급완료)
   - **정산 상태 (Settlement Status)**: 행정적 마감 상태 OPEN(정산대기) → SETTLED(정산종결)

---

## 3. 핵심 비즈니스 규칙 및 안전장치 (Key Business Rules)
1. **Single Active Invoice 단일 활성 인보이스 규칙**:
   - 1개 발주서(PO)에는 최대 1건의 활성 인보이스(invoice_status NOT IN ('VOID', 'REJECTED'))만 존재할 수 있으며, Application 사전 검증과 Database Partial Unique Index(\`idx_supplier_invoices_one_active_per_po\`) 양단계에서 중복 생성이 원천 차단됩니다.
2. **실시간 정산 및 잔액 연산 수식 (Real-Time Calculation Formulas)**:
   - \`subtotal = SUM(invoiced_qty * unit_price)\`
   - \`adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)\`
   - \`invoice_total = subtotal + adjustmentTotal\`
   - \`amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')\`
   - \`balance_due = invoice_total - amount_paid\`
3. **System Gaps (현재 미지원 / 미구현 기능 명시)**:
   - \`1:N 분할 인보이스 (Partial Invoicing)\`: 1개 PO에 대해 여러 차례 나누어 인보이스를 분할 발행하는 기능은 **지원되지 않습니다 (NOT SUPPORTED)**.
   - \`포털 내 PDF 자동 변환 (PDF Export)\`: 입력 데이터를 PDF로 자동 변환하는 기능은 **구현되어 있지 않으며 (NOT IMPLEMENTED)**, 공급사가 외부 작성 송장 PDF를 직접 첨부합니다.

---

## 4. 관련 화면 및 기능 (Related Routes)
- \`/portal/finance\` (정산 & 인보이스 관리 허브)
- \`/portal/finance/new\` (새 인보이스 작성 및 발주서 선택)
- \`/portal/finance/[id]\` (인보이스 상세 조회 및 실시간 잔액 확인)
- \`/portal/finance/[id]/edit\` (인보이스 초안 수정)
- \`/admin/finance/invoices\` (어드민 전체 인보이스 관리)
- \`/admin/finance/invoices/[id]\` (어드민 인보이스 심사 및 승인/반려/무효화)
- \`/admin/finance/payments\` (어드민 대금 송금 집행 관리)
- \`/admin/finance/payments/new\` (어드민 대금 이체 내역 등록)
- \`/admin/finance/payments/[id]\` (어드민 지급 내역 상세)`,
      content_en: `# K SELECT Brand Portal Finance & Settlement User Guide (MAN-B-FIN-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners to create supplier invoices following official PO Confirmation, track tri-state dimensions (Invoice ≠ Payment ≠ Settlement), manage settlement adjustments, monitor real-time balance_due, and verify headquarters payout remittances.

## 2. Core Operational Governance
1. **Parallel Domain Handoff (ORD → FIN)**: Official PO Confirmation immediately unlocks invoice creation without serial dependency on warehouse receiving.
2. **FIN ↔ LOG Boundary**: Shipping Complete ≠ Settlement Complete. Logistics shipping status operates independently from finance settlement status.
3. **Tri-State Disambiguation**:
   - Invoice Status: DRAFT / SUBMITTED / APPROVED / REJECTED / VOID
   - Payment Status (Computed): UNPAID / PARTIALLY_PAID / PAID
   - Settlement Status: OPEN / SETTLED

## 3. Business Rules & Safety Mechanisms
1. **Single Active Invoice**: Only 1 active invoice per PO enforced by application logic and database partial unique index (\`idx_supplier_invoices_one_active_per_po\`).
2. **Formulas**:
   - \`subtotal = SUM(invoiced_qty * unit_price)\`
   - \`adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)\`
   - \`invoice_total = subtotal + adjustmentTotal\`
   - \`balance_due = invoice_total - amount_paid\`
3. **System Gaps (Explicitly Classified)**:
   - 1:N Partial Invoicing: NOT SUPPORTED
   - Portal PDF Auto Export: NOT IMPLEMENTED (Suppliers attach external PDF invoices).

## 4. Related Routes
- \`/portal/finance\`
- \`/portal/finance/new\`
- \`/portal/finance/[id]\`
- \`/portal/finance/[id]/edit\`
- \`/admin/finance/invoices\`
- \`/admin/finance/invoices/[id]\`
- \`/admin/finance/payments\`
- \`/admin/finance/payments/new\`
- \`/admin/finance/payments/[id]\``,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "FINANCE",
      category: "Brand Portal",
      tags: ["MANUAL", "FINANCE", "SETTLEMENT", "INVOICE", "PAYMENT", "PAYOUT", "BALANCE_DUE", "Balance Due", "PARTIAL_PAYMENT", "Partial Payment", "ADJUSTMENT", "SINGLE_ACTIVE_INVOICE", "Single Active Invoice", "MAN-B-FIN-001", "OFFICIAL", "정산", "결제", "인보이스", "송장", "송금", "대금지급", "미지급잔액", "분할지급"],
      owner_id: "staff-finance-01",
      owner_name: "Finance Operations Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-10-02T12:00:00Z",
      current_version: "v1.0",
      effective_date: "2026-10-02",
      created_at: now,
      updated_at: now
    },
    {
      id: "kno-task-communication-v10",
      document_url: "/api/admin/knowledge/asset/asset-task-communication-v10",
      document_name: "MAN-B-TASK-001_Task-Communication_V1.pdf",
      document_size: 3664407,
      document_type: "application/pdf",
      slug: "man-b-task-001-task-communication-guide",
      title: "MAN-B-TASK-001: Task & Communication Guide",
      title_ko: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      title_en: "K SELECT Brand Portal Task & Communication Guide (MAN-B-TASK-001)",
      summary_ko: "K SELECT Brand Portal 1:1 문의(partner_inquiries) 접수, 9대 업무 카테고리 분류, 4단계 케이스 라이프사이클(RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), 만족도 평가(CSAT), 교차 도메인 연동(PO 변경 real FK vs 정산/계약 prefill), support ACL(none/read/write/manage), 인앱/이메일 알림 규칙 및 20MB 첨부파일 보안 통합 가이드",
      summary_en: "Operational guide for Brand Portal 1:1 support inquiries (partner_inquiries), 9 categories, 4 case statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), CSAT evaluation, cross-domain linking, support ACL permissions, notifications, and 20MB private storage security.",
      content_ko: `# K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 운영팀과의 1:1 문의(partner_inquiries) 접수 및 소통, 9대 업무 카테고리 분류, 4단계 상태 라이프사이클(RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), 만족도 평가(CSAT) 및 교차 도메인 연동을 관리하는 공식 실무 가이드입니다.

## 2. 핵심 경계 정의 (Critical Boundaries)
- **PERM ↔ TASK 경계**: PERM(company_task_assignments)의 6대 주 담당자는 소통 책임자 지정 및 알림 라우팅 용도이며, TASK(partner_inquiries)의 실시간 1:1 지원 케이스와 독립 구분됩니다.
- **어드민 내부 일감 경계**: /admin/tasks (public.tasks)는 운영팀 내부 작업 프로토타입이며 파트너 문의 케이스와 직접 연결되지 않습니다.
- **CLOSE ≠ CSAT**: 케이스 종결(CLOSED) 상태 전환과 CSAT 평가 제출은 별개 단계입니다.
- **교차 도메인 연동**: PO 변경 문의는 real DB FK(related_po_id)로 연결되며, 정산/계약 문의는 Pre-populated Context 방식으로 연동됩니다.`,
      content_en: `# K SELECT Brand Portal Task & Communication Guide (MAN-B-TASK-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners to submit and track 1:1 support cases (partner_inquiries), 9 categories, 4 case statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), CSAT evaluation, and cross-domain linking.

## 2. Critical Boundaries
- PERM vs TASK: company_task_assignments (6 primary owner routing) vs partner_inquiries (dynamic 1:1 cases).
- Internal Admin Prototype: public.tasks / /admin/tasks is an unlinked internal prototype.
- CLOSE != CSAT: Case close and CSAT evaluation are separate steps.
- Cross-Domain FK: PO Change has real DB FK (related_po_id), while Settlement/Agreement uses Context Prefill.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "TASK",
      category: "Brand Portal",
      tags: ["MANUAL", "TASK", "SUPPORT", "INQUIRY", "COMMUNICATION", "PARTNER_INQUIRIES", "ACTION_REQUIRED", "Action Required", "CASE", "Case", "CSAT", "PO_CHANGE", "PO Change", "SETTLEMENT", "Settlement", "ACL", "SUPPORT_DESK", "support:manage", "MAN-B-TASK-001", "OFFICIAL", "문의", "소통", "지원센터", "1대1문의", "케이스"],
      owner_id: "staff-support-01",
      owner_name: "Support Operations Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-10-02T12:00:00Z",
      current_version: "v1.0",
      effective_date: "2026-10-02",
      created_at: now,
      updated_at: now
    },
    {
      id: "kno-reports-performance-v10",
      document_url: "/api/admin/knowledge/asset/asset-reports-performance-v10",
      document_name: "MAN-B-RPT-001_Reports-Performance_V1.pdf",
      document_size: 2503532,
      document_type: "application/pdf",
      slug: "man-b-rpt-001-reports-performance-guide",
      title: "MAN-B-RPT-001: Reports & Performance Guide",
      title_ko: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      title_en: "K SELECT Brand Portal Reports & Performance Guide (MAN-B-RPT-001)",
      summary_ko: "K SELECT Brand Portal 메인 대시보드(/portal), 4대 도메인 핵심 KPI(발주 파이프라인, 재무/정산 실적, 카탈로그 완성도, 고객지원 문의), 3단계 우선순위 실행 필요 큐(Action Required Queue: URGENT, DUE_SOON, NORMAL), 5대 발주 성과 집계 요약, 최근 90일 다차원 필터링 및 테이블 정렬, 재무 및 정산 실적 모니터링, 28대 기준 제품 카탈로그 완성도 감사, 1:1 고객지원 처리 현황 및 어드민 전사 발주 대시보드(/admin/purchasing/dashboard) 동기화 통합 가이드",
      summary_en: "Operational user manual for K SELECT Brand Portal main dashboard (/portal), 4-domain core KPIs (Orders, Finance, Products, Support), 3-level Action Required Queue (URGENT, DUE_SOON, NORMAL), 5-stage PO reporting pipeline aggregation, 90-day multi-dimensional filtering and table sorting, finance cash flow tracking, 28-criteria product catalog completeness audit, 1:1 support resolution tracking, and Admin purchasing dashboard synchronization.",
      content_ko: `# K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001 v1.0)

## 1. 개요 및 측정 계층 원칙 (Overview & Measurement Principles)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 플랫폼을 통해 진행하는 비즈니스 활동—발주 이행, 대금 정산, 제품 카탈로그 등록, 고객지원 문의 처리—의 현황을 종합 집계하여 일일 운영 건전성(Operational Health)을 진단하고 긴급 조치 작업을 처리할 수 있도록 돕는 통합 측정 및 분석 계층(Measurement & Reporting Layer) 실무 가이드입니다.

## 2. 핵심 경계 정의 (Critical Boundaries)
- **RPT ↔ ORD 경계**: RPT의 5대 성과 집계(전체 진행, 생산 중, 출고 준비, 입고/검수, 완료)는 파트너사 관점의 리포팅 그룹이며, ORD가 담당하는 6단계 권위적 트랜잭션 라이프사이클 상태 전이와 명확히 구분됩니다.
- **RPT ↔ FIN 경계**: RPT의 재무 실적(총 청구액, 지급 완료액, 미지급 잔액, 연체 잔액)은 분석적 롤업 지표이며, FIN의 은행 송금, 장부 분개 및 정산 차액 공제(Adjustments) 실행과 독립적입니다.
- **RPT ↔ PROD 경계**: 28대 등록 완성도 판정 체계(COMPLETE vs Draft)는 실시간 품질 검증 엔진이며, 카탈로그 속성의 권위적 스키마 원천은 PROD 도메인입니다.
- **RPT ↔ RET & PERM 경계**: 리테일 매장 진열 데이터 및 멀티테넌트 세션 격리(session company_id)를 준수합니다.
- **시스템 기능 범위 (System Gap)**: 별도의 독립 메뉴(/portal/reports), 일괄 대량 보고서 생성, AI 성과 예측은 현재 미제공(Not Implemented) 상태이며, 어드민 리포트 센터(/admin/reports)는 준비 중인 플레이스홀더 화면입니다.`,
      content_en: `# K SELECT Brand Portal Reports & Performance Guide (MAN-B-RPT-001 v1.0)

## 1. Overview & Measurement Principles
Official operational manual for K SELECT Brand Portal partners covering main dashboard KPIs (/portal), 3-priority Action Required queue (URGENT, DUE_SOON, NORMAL), 5-stage PO pipeline aggregation, 90-day multi-dimensional filtering, cash flow tracking, 28-criteria product catalog completeness audit, 1:1 support resolution tracking, and Admin purchasing dashboard synchronization.

## 2. Critical Boundaries
- RPT vs ORD: 5-Stage reporting aggregation (Total Open, In Production, Ready to Ship, Receiving, Completed) is an analytical summary layer; ORD retains authoritative 6-step transactional state transitions.
- RPT vs FIN: Cash flow metrics (Total Invoiced, Total Paid, Balance Due, Overdue) are analytical views; FIN executes payment, transfers, and adjustments.
- RPT vs PROD: 28-criteria completeness engine evaluates quality; PROD is authoritative catalog attribute source.
- System Gap: /portal/reports, bulk reports, and AI forecasting are Not Implemented; /admin/reports is a placeholder.`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "REPORTS",
      category: "Brand Portal",
      tags: ["MANUAL", "REPORTS", "PERFORMANCE", "DASHBOARD", "ACTION_REQUIRED", "Action Required", "PO_PIPELINE", "PO Pipeline", "FINANCE", "CASH_FLOW", "Cash Flow", "PRODUCT_COMPLETENESS", "Product Completeness", "SUPPORT", "PURCHASING_DASHBOARD", "Purchasing Dashboard", "KPI", "MAN-B-RPT-001", "OFFICIAL", "성과분석", "대시보드", "실행필요", "지표", "리포트"],
      owner_id: "staff-ops-01",
      owner_name: "Operations Analytics Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-10-02T12:00:00Z",
      current_version: "v1.0",
      effective_date: "2026-10-02",
      created_at: now,
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
    },
    {
      id: "faq-ord-01",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "발주 요청(PO Request)과 정식 발주서(Official Purchase Order)는 어떻게 다른가요?",
      question_en: "What is the difference between a Purchase Order Request and an Official Purchase Order?",
      answer_ko: "K SELECT 오더 시스템은 2-Phase 아키텍처로 운영됩니다. ①발주 요청(/portal/orders/requests)은 리테일러/바이어가 상품 구매 의사를 타진하는 사전 조율 단계이며, ②정식 발주서(/portal/orders/purchase-orders)는 승인된 요청에 대해 관리자가 정식 발주 번호(PO-YYYYMMDD-XXXX)를 부여하여 발행하는 법적 구속력을 갖는 정식 납품 계약입니다. (Chapter 01 & 02)",
      answer_en: "K SELECT operates a 2-Phase Order Architecture: ①PO Requests (/portal/orders/requests) are preliminary buyer purchase proposals, and ②Official Purchase Orders (/portal/orders/purchase-orders) are legally binding fulfillment contracts issued by Admin with formal PO numbers (PO-YYYYMMDD-XXXX). (Chapter 01 & 02)",
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
      id: "faq-ord-02",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "바이어의 발주 요청(PO Request)을 승인하거나 거절하려면 어떻게 해야 하나요?",
      question_en: "How do I approve or reject a Retailer Purchase Order Request?",
      answer_ko: "발주 요청 상세 화면(/portal/orders/requests/[id])에서 품목, 희망 수량, 제안 납기일, 단가를 확인한 후 우측 상단의 [요청 승인(Approve)] 또는 [요청 거절(Reject)] 버튼을 클릭합니다. 거절 시에는 바이어에게 전달될 구체적인 사유(재고 부족, 생산 일정 불가 등)를 필수로 입력해야 합니다. (Chapter 02 · Section 2.2)",
      answer_en: "In the PO Request Detail screen (/portal/orders/requests/[id]), review items, requested quantity, proposed delivery date, and unit price, then click [Approve] or [Reject]. If rejecting, entering a specific reason (e.g., out of stock, production lead time mismatch) is mandatory. (Chapter 02 · Section 2.2)",
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
      id: "faq-ord-03",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "발주 요청(PO Request)을 한 번 승인하거나 거절한 후 상태를 다시 변경할 수 있나요?",
      question_en: "Can I revert or change the status of a PO Request after approving or rejecting it?",
      answer_ko: "아니요. 상태 불변(State Immutability) 원칙에 따라 발주 요청은 승인(APPROVED) 또는 거절(REJECTED) 처리되는 즉시 상태가 영구 동결(Frozen)되며 되돌릴 수 없습니다. 검토 시 생산 일정 및 재고 수량을 면밀히 확인한 후 신중하게 결정해 주시기 바랍니다. (Chapter 02 · Status Immutability)",
      answer_en: "No. Under the State Immutability rule, once a PO Request is Approved (APPROVED) or Rejected (REJECTED), its status is permanently frozen and cannot be reverted. Please verify production schedules and stock availability thoroughly before confirming. (Chapter 02 · Status Immutability)",
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
      id: "faq-ord-04",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "발주 요청을 승인하면 즉시 제품 생산 및 출고를 진행해야 하나요?",
      question_en: "Should I start production and shipping immediately after approving a PO Request?",
      answer_ko: "아닙니다. 발주 요청 승인(APPROVED)은 구매 의사 수락 단계이며, 즉시 생산을 시작하는 것이 아닙니다. 관리자(Admin)가 승인된 요청을 검토하여 정식 발주서(Official PO)를 발행하고 포털에 PO Sent 상태로 도달한 후, 공급자 주문 확정(Confirm PO)을 완료한 시점부터 본격적인 생산 공정을 진행합니다. (Chapter 02 & 03)",
      answer_en: "No. Approving a PO Request only confirms acceptance of buyer intent. Production begins after Admin issues an Official PO, reaches PO Sent status in the portal, and the brand completes Supplier Confirmation (Confirm PO). (Chapter 02 & 03)",
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
      id: "faq-ord-05",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "정식 발주서(Official PO)의 6단계 라이프사이클은 어떻게 진행되나요?",
      question_en: "What is the 6-step lifecycle of an Official Purchase Order?",
      answer_ko: "정식 발주서는 ①발주서 발행(PO Sent / ISSUED) → ②공급자 주문 확정(Supplier Confirmed) → ③생산 중(In Production) → ④출고 준비(Ready to Ship / Goods Ready) → ⑤배송 중(Shipped / In Transit) → ⑥입고/오더 완료(Completed)의 6단계 표준 라이프사이클을 거칩니다. (Chapter 03 · 6-Step Stepper)",
      answer_en: "Official POs progress through a 6-step lifecycle: ①PO Sent (ISSUED) → ②Supplier Confirmed → ③In Production → ④Ready to Ship (Goods Ready) → ⑤Shipped (In Transit) → ⑥Completed (Fulfillment Closed). (Chapter 03 · 6-Step Stepper)",
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
      id: "faq-ord-06",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "발주서의 수량, 단가, 납기일에 변경이 필요한 경우 어떻게 처리하나요?",
      question_en: "How do I request adjustments if order quantities, pricing, or dates need revision?",
      answer_ko: "발주서 상세(/portal/orders/purchase-orders/[id])의 [Overview] 탭에서 수량 및 납기일을 확인하고, 이견이 있는 경우 [수정 요청(Request Change)]을 통해 변경 희망 사항을 입력하거나 Help Center 1:1 지원 문의로 전담 매니저에게 통보하여 발주서 정정(PO Revision) 절차를 진행할 수 있습니다. (Chapter 03 · Section 3.2)",
      answer_en: "On the PO Detail Overview tab (/portal/orders/purchase-orders/[id]), review quantities and dates. If adjustments are required, click [Request Change] or submit a ticket via Help Center 1:1 Support to request a formal PO Revision with your account manager. (Chapter 03 · Section 3.2)",
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
      id: "faq-ord-07",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "공급자 발주서 확정(Confirm PO)을 완료하면 정산(Finance) 인보이스는 언제 발행할 수 있나요?",
      question_en: "When can I create a Supplier Invoice in Finance after confirming an order?",
      answer_ko: "po_status IN ('APPROVED', 'SENT') 및 supplier_confirmation_status = 'CONFIRMED' 조건을 충족하고 기존에 유효한(non-VOID/non-REJECTED) 공급사 인보이스가 존재하지 않는 경우, 재무 도메인(/portal/finance/invoices)에서 해당 PO에 대한 공급사 인보이스(Supplier Invoice) 생성 자격이 활성화됩니다. 상세 인보이스 작성 및 AP 승인 절차는 MAN-B-FIN-001을 참조하세요. (Chapter 06 · Finance Handoff)",
      answer_en: "When po_status IN ('APPROVED', 'SENT') and supplier_confirmation_status = 'CONFIRMED' are met with no active (non-VOID/non-REJECTED) invoice already existing, the PO becomes eligible for Supplier Invoice creation in Finance (/portal/finance/invoices). Refer to MAN-B-FIN-001 for invoice filing. (Chapter 06 · Finance Handoff)",
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
      id: "faq-ord-08",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "제품 생산 완료 후 물류 출고 준비(Goods Ready)는 어떻게 통보하나요?",
      question_en: "How do I notify the team when products are finished and ready for shipment (Goods Ready)?",
      answer_ko: "생산이 완료되고 마스터 카톤 패킹 및 라벨링이 준비되면, 발주서 상세의 [Goods Ready] 버튼을 클릭하여 실제 생산 완료 수량, 패킹 카톤 수, 포워더 인계 가능 일자(Ready Date)를 입력하고 제출합니다. 상태는 자동으로 Step 4(Ready to Ship)로 전환됩니다. (Chapter 04 · Goods Ready)",
      answer_en: "When production and carton labeling are complete, click [Goods Ready] in the PO Detail to submit ready quantities, total carton count, and ready date. The PO automatically transitions to Step 4 (Ready to Ship). (Chapter 04 · Goods Ready)",
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
      id: "faq-ord-09",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "화물 배송(Step 5: Shipped) 단계에서 등록해야 하는 필수 물류 정보는 무엇인가요?",
      question_en: "What mandatory logistics tracking information is required at Step 5 (Shipped)?",
      answer_ko: "지정 3PL 운송사 또는 포워더에 화물을 인계한 후, 선하증권(B/L) 번호, 택배 송장번호(Tracking Number), 배송 업체명, 출고 일시를 등록해야 합니다. 등록된 운송장 정보는 바이어 및 운영팀에 실시간 공유되어 입고 스케줄링에 활용됩니다. (Chapter 04 · Section 4.2)",
      answer_en: "After handing cargo over to the 3PL carrier or forwarder, enter the B/L number, tracking number, carrier name, and departure date. This tracking data is synced in real time for warehouse receiving scheduling. (Chapter 04 · Section 4.2)",
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
      id: "faq-ord-10",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "오더 라이프사이클의 마지막 단계인 'COMPLETED(입고/오더 완료)'는 판매대금 지급(정산)을 의미하나요?",
      question_en: "Does the final lifecycle status 'COMPLETED' mean payment settlement?",
      answer_ko: "아닙니다. COMPLETED는 미국 현지 물류센터(Fulfillment Center)에 화물이 실물 도착하여 입고 검수(Receiving Inspection)를 정상 통과하고 '물류센터 검수 완료 및 오더 이행 최종 종결(Order Fulfillment Completed)'되었음을 의미합니다. 판매대금 지급 및 정산(PAID)은 재무 도메인(MAN-B-FIN-001)에서 독립적으로 처리되며 오더 이행 종결과 정산 완료는 분리되어 있습니다. (Chapter 05 · Completed Definition)",
      answer_en: "No. COMPLETED means cargo arrived at the US fulfillment center, passed receiving inspection, and order fulfillment is formally closed. Payment remittance and settlement (PAID) are managed independently in the Finance domain (MAN-B-FIN-001). (Chapter 05 · Completed Definition)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-ord-11",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "물류 배송(LOG)과 대금 정산(FIN)은 순차적으로 종속되어 진행되나요?",
      question_en: "Are Logistics (LOG) and Finance (FIN) sequentially dependent workflows?",
      answer_ko: "아닙니다. 공식 발주서가 확정(Confirm PO)되면 물류(출고/선적) 트랙과 재무(인보이스/정산) 트랙은 각각 독립된 병렬(Parallel) 구조로 운영됩니다. 선적이나 입고 완료 여부와 무관하게 계약 조건에 따라 인보이스 심사 및 지급 절차가 별도 일정으로 진행됩니다. (Chapter 01 · Parallel Domains)",
      answer_en: "No. Once an Official PO is confirmed (Confirm PO), Logistics (fulfillment/shipping) and Finance (invoice/settlement) operate as independent parallel tracks. Invoicing and payout schedules follow financial contract terms separately from shipping milestones. (Chapter 01 · Parallel Domains)",
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
      id: "faq-ord-12",
      portal_scope: "BRAND",
      topic_id: "topic-orders",
      source_knowledge_id: "kno-order-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
      question_ko: "발주서 PDF, 패킹리스트, 상업송장 등 무역 서류는 어디서 다운로드할 수 있나요?",
      question_en: "Where can I download Official PO PDFs, Packing Lists, and Commercial Invoices?",
      answer_ko: "발주서 상세 화면(/portal/orders/purchase-orders/[id])의 [무역 서류 보관함(Documents)] 탭에서 공식 발주서(Official PO PDF), 패킹리스트(Packing List), 상업송장(Commercial Invoice), 운송장 라벨 및 물류센터 검수 성적서를 언제든지 원클릭으로 다운로드할 수 있습니다. (Chapter 06 · Document Hub)",
      answer_en: "Navigate to the [Documents] tab in the PO Detail screen (/portal/orders/purchase-orders/[id]) to download the Official PO PDF, Packing List, Commercial Invoice, Shipping Labels, and Warehouse Inspection Reports with one click. (Chapter 06 · Document Hub)",
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
      id: "faq-reg-01",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "미국 수출(MoCRA) 및 규제 대응을 위해 K SELECT 포털에서 관리하는 주요 인허가 영역은 무엇인가요?",
      question_en: "What core regulatory and compliance areas are managed in the K SELECT portal for US export (MoCRA)?",
      answer_ko: "포털 시스템에서 4대 인허가 영역을 관리합니다: ①브랜드 상표권(대한민국 KIPO 및 미국 USPTO 등록 정보·증빙 파일), ②전성분표(국문/영문 텍스트 선언 및 AI 영문 INCI 번역), ③인증 보증서(FDA 등록, 상표권, 성분 인증, 특허, 기타 5대 카테고리 서류 및 버전 관리), ④상품 식별 바코드(12자리 UPC 및 13자리 EAN 규격 검증). (MAN-B-REG-001 Chapter 01)",
      answer_en: "The portal manages 4 core compliance pillars: ①Brand Trademarks (KIPO and USPTO registration data/files), ②Ingredients (Dual-language text and AI INCI translation), ③Certificates (5 categories: FDA, Trademark, Ingredient, Patent, Other with version control), and ④Product Barcodes (12-digit UPC and 13-digit EAN validation). (MAN-B-REG-001 Chapter 01)",
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
      id: "faq-reg-02",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "상표권(특허청 등록증)이 아직 없는 신규 브랜드도 포털에 등록할 수 있나요?",
      question_en: "Can a brand without official trademark registrations be registered in the portal?",
      answer_ko: "네, 가능합니다. 포털 내 브랜드 등록 시 특허청 상표권 등록이 필수 전제 조건은 아닙니다(Policy 02). 브랜드 신규 등록 화면(/portal/brands/new)에서 KIPO/USPTO 체크박스를 해제한 상태로 브랜드를 등록할 수 있으며, 향후 상표권을 취득하면 브랜드 수정 화면(/portal/brands/[id])에서 등록번호와 증빙 서류를 추가할 수 있습니다. (MAN-B-REG-001 Chapter 02 · Policy 02)",
      answer_en: "Yes. Trademark registration is not a mandatory prerequisite for creating a brand in the portal (Policy 02). You can register a brand in the New Brand screen (/portal/brands/new) with the KIPO/USPTO checkboxes unchecked. Once trademarks are issued, you can add registration numbers and certificates in the Brand Edit screen (/portal/brands/[id]). (MAN-B-REG-001 Chapter 02 · Policy 02)",
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
      id: "faq-reg-03",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "브랜드 상표권(KIPO / USPTO) 등록 및 증빙 서류는 어떻게 첨부하고 수정하나요?",
      question_en: "How do I enter KIPO and USPTO trademark data and manage certificate files?",
      answer_ko: "브랜드 등록(/portal/brands/new) 또는 수정(/portal/brands/[id]) 화면에서 대한민국 특허청(KIPO) 및 미국 특허청(USPTO) 상표권 보유 여부를 각각 체크합니다. 상표권을 보유한 경우 체크 후 상표 등록번호를 입력하고 증빙 파일(PDF/이미지)을 첨부합니다. 이미 등록된 브랜드의 경우 [보기] 링크를 통해 기존 서류를 확인하거나 삭제 및 새 파일로 교체할 수 있습니다. (MAN-B-REG-001 Chapter 02 · Section 2.2 & 2.3)",
      answer_en: "In the Brand Registration (/portal/brands/new) or Brand Edit (/portal/brands/[id]) screen, check the KIPO or USPTO boxes independently. Enter the official registration number and attach the certificate file (PDF/image). For existing brands, click [View] to inspect the uploaded document, delete it, or replace it with a new file. (MAN-B-REG-001 Chapter 02 · Section 2.2 & 2.3)",
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
      id: "faq-reg-04",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "상품의 국문 전성분 입력과 AI 기반 영문 INCI 번역 기능은 어떻게 사용하나요?",
      question_en: "How do I enter Korean ingredients and use the AI-based English INCI translation tool?",
      answer_ko: "상품 상세 페이지(/portal/products/[id])의 [기본 정보] 탭(Tab 1) 내 전성분 영역에서 국문 전성분 텍스트를 입력한 후 [번역하기(Translate)] 버튼을 누릅니다. 시스템이 화장품 국제 표준 INCI(International Nomenclature of Cosmetic Ingredients) 명칭으로 자동 변환하며, 프리뷰 확인 후 [리뷰 완료 및 적용(Apply to field)] 버튼을 클릭하면 영문 전성분 필드에 자동 입력됩니다. (MAN-B-REG-001 Chapter 03 · Section 3.2)",
      answer_en: "In Product Detail (/portal/products/[id]) Tab 1 (Basic Info), enter Korean ingredients in the ingredients field and click [Translate]. The system converts them into standard INCI nomenclature. Review the preview and click [Apply to field] to automatically populate the English ingredients field. (MAN-B-REG-001 Chapter 03 · Section 3.2)",
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
      id: "faq-reg-05",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "AI 전성분 번역 도구(Tab 1)와 성분 인증 서류 업로드(Tab 6)는 어떻게 구분되나요?",
      question_en: "What is the boundary between the AI Ingredients Translator (Tab 1) and Ingredient Certificate Upload (Tab 6)?",
      answer_ko: "두 기능은 시스템상 엄격히 분리된 워크플로우입니다. Tab 1의 'AI 전성분 번역'은 상품 기본 정보에 라벨 표기용 국문/영문 INCI 텍스트를 선언하는 기능이며, Tab 6의 서류 업로드를 대체하지 않습니다. 전성분 분석표, MSDS(물질안전보건자료), COA(시험성적서) 등 성분 관련 증빙 파일은 [인허가 & 보증서] 탭(Tab 6)의 [성분 인증(`ingredient_certification`)] 또는 [기타(`other`)] 카테고리를 통해 별도로 업로드해야 합니다. (MAN-B-REG-001 Chapter 03 & 04)",
      answer_en: "These are strictly separated workflows in the portal. AI Translation (Tab 1) declares dual-language INCI text for basic product specifications and does not replace document uploads. Supporting files such as ingredient analyses, MSDS, or COA must be uploaded separately via the [Ingredient Certification (`ingredient_certification`)] or [Other (`other`)] category in Tab 6 (Certificates). (MAN-B-REG-001 Chapter 03 & 04)",
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
      id: "faq-reg-06",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "상품 상세 [인허가 & 보증서] 탭(Tab 6)에서 등록할 수 있는 5대 서류 카테고리는 무엇인가요?",
      question_en: "What are the 5 certificate categories supported in Product Detail Tab 6 (Certificates)?",
      answer_ko: "Tab 6에서 다음 5가지 서류 카테고리를 지원합니다: ①`fda_registration` (FDA 등록: 시설 등록 FFRM, 제품 리스팅 PDRM 증빙), ②`trademark` (상표권: 특정 상품 전용 상표 등록 서류), ③`ingredient_certification` (성분 인증: 전성분 분석표, MSDS, COA 등), ④`patent` (특허: 용기 구조, 성분 추출 기술 특허증), ⑤`other` (기타: 위생 허가증, 자유판매증명서 CFS 등). (MAN-B-REG-001 Chapter 04 · Section 4.1)",
      answer_en: "Tab 6 supports 5 categories: ①`fda_registration` (FDA registration: FFRM and PDRM proofs), ②`trademark` (product trademarks), ③`ingredient_certification` (ingredient analyses, MSDS, COA), ④`patent` (patents, utility models), and ⑤`other` (sanitary certificates, CFS, and other guarantees). (MAN-B-REG-001 Chapter 04 · Section 4.1)",
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
      id: "faq-reg-07",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "기존에 등록된 인허가 서류를 갱신하거나 새 파일로 다시 업로드하면 어떻게 처리되나요?",
      question_en: "How are renewed certificate files processed when uploaded for an existing document type?",
      answer_ko: "동일한 서류 카테고리에 새 파일을 등록하면, 시스템이 자동으로 버전(Version) 번호를 `+1` 증가(예: Version 1 -> Version 2)시키며 최신 서류(`is_current: true`)로 지정합니다. 이전 업로드 파일은 `is_current: false` 상태로 자동 변경되어 서류 이력으로 보존됩니다. (MAN-B-REG-001 Chapter 04 · Section 4.2)",
      answer_en: "When a new file is uploaded under the same certificate category, the system automatically increments the version number by `+1` (e.g., Version 1 -> Version 2) and designates it as active (`is_current: true`). The previously uploaded file is automatically changed to `is_current: false` and retained as history. (MAN-B-REG-001 Chapter 04 · Section 4.2)",
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
      id: "faq-reg-08",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "상품 등록 완료(COMPLETE)를 위한 바코드(UPC / EAN) 규격과 검증 규칙은 무엇인가요?",
      question_en: "What are the barcode standards (UPC / EAN) and validation rules to achieve COMPLETE product status?",
      answer_ko: "상품이 최종 `COMPLETE (등록 완료)` 상태로 전환되기 위해서는 식별 바코드가 필수적으로 검증되어야 합니다. 북미 표준인 12자리 UPC(`/^\\d{12}$/`) 또는 국제 표준인 13자리 EAN(`/^\\d{13}$/`) 숫자 규격만 유효합니다. 자릿수 오류나 숫자가 아닌 문자가 포함된 경우 등록 평가기(Registration Evaluator)에 의해 `Draft (보완 대기)` 상태로 유지됩니다. (MAN-B-REG-001 Chapter 05 · Section 5.1)",
      answer_en: "Product status can only advance to `COMPLETE` with a validated barcode. Exactly 12-digit numeric UPC (`/^\d{12}$/`) or 13-digit numeric EAN (`/^\d{13}$/`) is required. Invalid lengths or non-numeric characters will hold the product in `Draft` status. (MAN-B-REG-001 Chapter 05 · Section 5.1)",
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
      id: "faq-reg-09",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "바코드(UPC/EAN) 유효성 검증과 규제/인허가 승인은 동일한 절차인가요?",
      question_en: "Is barcode (UPC/EAN) validation the same procedure as regulatory and compliance approval?",
      answer_ko: "아닙니다. 바코드 입력은 물류 식별(WMS) 및 리테일 POS 스캔을 위한 상품 식별 번호 검증 절차이며, FDA 등록이나 법적 인허가 승인을 대신하지 않습니다. 바코드 검증과 규제 서류 승인은 독립된 영역이므로 규제 요건 충족을 위해서는 Tab 6([인허가 & 보증서])에 필요한 인증 서류를 별도로 등록해야 합니다. (MAN-B-REG-001 Chapter 01 & Chapter 05)",
      answer_en: "No. Barcode entry validates product identification for warehouse WMS and retail POS scanning, and does not substitute for FDA registrations or legal compliance approvals. Barcode validation and regulatory document approval are distinct; compliance requirements must be met by uploading required certificates in Tab 6. (MAN-B-REG-001 Chapter 01 & Chapter 05)",
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
      id: "faq-reg-10",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "바코드(UPC/EAN)가 아직 발급되지 않은 신규 상품은 어떻게 지원받을 수 있나요?",
      question_en: "How can I request support if a barcode (UPC/EAN) has not yet been issued for a new product?",
      answer_ko: "상품 등록/수정 화면의 바코드 입력란 우측에 위치한 [💬 바코드 문의] 링크를 클릭하여 지원을 요청할 수 있습니다. 바코드 신규 발급 또는 식별 관리와 관련하여 헬프센터 1:1 지원 채널을 통해 안내를 받으실 수 있습니다. (MAN-B-REG-001 Chapter 05 · Section 5.1 & 그림 5.1)",
      answer_en: "Click the [💬 Inquire Barcode] link located to the right of the barcode input field. You can request assistance with barcode issuance and product identification through the Help Center 1:1 support channel. (MAN-B-REG-001 Chapter 05 · Section 5.1 & Figure 5.1)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-reg-11",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "브랜드가 등록한 상표권 및 상품 인허가 서류는 어드민(Admin)에서 어떻게 확인되나요?",
      question_en: "How are brand trademarks and product certificate documents viewed and audited by Admin operators?",
      answer_ko: "브랜드사가 등록한 상표권 및 인허가 보증서 파일은 어드민 상세 화면(/admin/brands/[brandId] 및 /admin/products/[id])에서 운영 담당자에게 실시간 동기화됩니다. 어드민 사용자는 [보기] 또는 [다운로드] 버튼을 통해 브랜드사가 제출한 서류 원본을 열람하여 검증할 수 있습니다. (MAN-B-REG-001 Chapter 06 · Section 6.1)",
      answer_en: "Trademarks and certificates registered by brands synchronize in real time to Admin detail screens (/admin/brands/[brandId] and /admin/products/[id]). Admin operators can inspect and verify submitted original documents using the [View] or [Download] buttons. (MAN-B-REG-001 Chapter 06 · Section 6.1)",
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
      id: "faq-reg-12",
      portal_scope: "BRAND",
      topic_id: "topic-regulatory",
      source_knowledge_id: "kno-regulatory-compliance-v11",
      source_version: "v1.1.0",
      source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      question_ko: "인허가 서류, 전성분 또는 상표권 정보의 수정 이력은 어디서 감사(Audit)할 수 있나요?",
      question_en: "Where can I audit the modification history for certificates, ingredients, or trademarks?",
      answer_ko: "브랜드사 또는 어드민이 전성분, 상표권, 인허가 보증서 파일을 수정·추가·삭제하면 시스템 변경 감사 모듈(`product_change_history`)에 변경 내역이 기록됩니다. 이를 통해 변경 일시와 내역을 투명하게 추적할 수 있으며, 어드민과 브랜드 포털 간 실시간 데이터 갱신이 수행됩니다. (MAN-B-REG-001 Chapter 06 · Section 6.2)",
      answer_en: "When ingredients, trademarks, or certificates are modified, added, or deleted by brands or admins, change records are captured in the system change audit module (`product_change_history`). This allows transparent tracking of modification timestamps and details with real-time synchronization between Admin and Brand Portal. (MAN-B-REG-001 Chapter 06 · Section 6.2)",
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
      id: "faq-ret-01",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "K SELECT Retail Placement(리테일 입점 신청)이란 무엇이며 어떤 절차로 진행되나요?",
      question_en: "What is K SELECT Retail Placement, how do brands apply, and what is the application process?",
      answer_ko: "K SELECT의 입점 신청(Retail Placement Application)은 브랜드 파트너사가 등록된 상품을 선택하여 북미 온·오프라인 리테일 네트워크 유통을 위한 공식 심사를 신청하는 시스템입니다. 전체 프로세스는 `1. 상품 선택(다중 브랜드 지원)` → `2. 6대 프로그램 참여 준비사항 자가진단(Readiness Criteria)` → `3. 신청서 제출 및 MD 실시간 심사` → `4. 승인 및 입점 파트너십 확정` 순서로 진행됩니다. (MAN-B-RET-001 Chapter 01 · Section 1.1)",
      answer_en: "K SELECT Retail Placement Application is a system where brand partners apply with registered products to request official review for distribution across North American retail networks. The process flows through: 1. Product selection (multi-brand supported) -> 2. 6 Readiness Criteria self-assessment -> 3. Submission & real-time MD review -> 4. Approval & placement partnership finalization. (MAN-B-RET-001 Chapter 01 · Section 1.1)",
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
      id: "faq-ret-02",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "입점 신청서를 작성하기 전에 반드시 완료해야 하는 사전 필수 준비사항은 무엇인가요?",
      question_en: "What are the mandatory prerequisites required before creating a retail placement application?",
      answer_ko: "입점 신청서 작성 전 브랜드 포털에서 다음 3가지 항목이 완료되어 있어야 합니다: 1. **브랜드 등록 완료 (`MAN-B-BRAND-001`)**: 계정에 입점 대상 브랜드가 등록 및 승인되어야 합니다. 2. **상품 카탈로그 등록 완료 (`MAN-B-PROD-001`)**: 신청 대상 상품의 기본 정보, 규격, 카테고리가 등록되어 있어야 합니다. 3. **미국 규제 및 MoCRA 대응 확인 (`MAN-B-REG-001`)**: FDA 요건, 전성분(INCI), 식별 바코드(UPC/EAN) 준비 상태를 사전에 확인해야 합니다. (MAN-B-RET-001 Chapter 01 · Section 1.2)",
      answer_en: "Before creating an application, three prerequisites must be completed on the Brand Portal: 1. Brand Registration (`MAN-B-BRAND-001`), 2. Product Catalog Registration (`MAN-B-PROD-001`) with specifications and categories, 3. US Regulatory & MoCRA Compliance Check (`MAN-B-REG-001`) verifying FDA requirements, INCI ingredients, and UPC/EAN barcodes. (MAN-B-RET-001 Chapter 01 · Section 1.2)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 2,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-ret-03",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "여러 브랜드를 운영하는 경우 브랜드별로 입점 신청서를 따로 작성해야 하나요?",
      question_en: "If managing multiple brands, do I need to create separate applications for each brand?",
      answer_ko: "아닙니다. 동일 회사 계정에 등록된 여러 브랜드의 상품이 제품 선택 영역에 브랜드별로 자동 그룹화되어 표시됩니다. 단일 신청서 안에서 서로 다른 브랜드의 제품을 복수 선택하여 한 번에 입점 심사를 신청할 수 있습니다. (MAN-B-RET-001 Chapter 03 · Section 3.1 & Chapter 07 · Q1)",
      answer_en: "No. Products from multiple brands registered under the same company account are automatically grouped by brand. You can select products across multiple brands within a single application and submit them together. (MAN-B-RET-001 Chapter 03 · Section 3.1 & Chapter 07 · Q1)",
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
      id: "faq-ret-04",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "6대 프로그램 참여 준비 사항(Readiness)에서 '협의 필요'를 선택하면 심사에서 불이익이나 탈락 사유가 되나요?",
      question_en: "Does selecting '협의 필요 (Negotiation Needed)' in the 6 Readiness Criteria result in penalties or disqualification?",
      answer_ko: "절대 감점이나 탈락 사유가 되지 않습니다. K SELECT의 확정 정책에 따라 **협의 필요는 탈락 사유가 아니며 MD 팀과의 사전 조율 단계**입니다. 초도 물량, 마케팅 협력, 유통 가격 및 공급 조건 등에 대해 K SELECT MD 심사팀과 상호 협의하여 맞춤형 조건을 도출하기 위한 정상적인 소통 절차입니다. (MAN-B-RET-001 Chapter 03 · Section 3.2 & Chapter 07 · Q3)",
      answer_en: "Absolutely not. Under K SELECT's established policy, **'협의 필요 (Negotiation Needed)' is not a rejection reason, but an active coordination step with the MD team**. It is a normal collaboration procedure to align on initial quantities, marketing cooperation, distribution pricing, and supply conditions. (MAN-B-RET-001 Chapter 03 · Section 3.2 & Chapter 07 · Q3)",
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
      id: "faq-ret-05",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "신규 입점 신청서 작성 중 임시저장(Draft)과 최종 제출의 차이는 무엇인가요?",
      question_en: "What is the difference between Draft saving and Final Submission in Retail Applications?",
      answer_ko: "작성 화면 하단의 **[임시저장]**을 클릭하면 선택한 제품과 6대 준비사항 응답이 저장되며 상태가 `임시저장(draft)`으로 유지되어 언제든지 재방문하여 내용을 수정할 수 있습니다. 최소 1개 이상의 제품을 선택한 후 **[신청서 제출]**을 클릭하면 공식 신청번호(예: `APP-20261001-0001`)가 발급되고 상태가 `제출됨(submitted)`으로 변경됩니다. 최종 제출 후에는 브랜드사에서 내용을 직접 수정할 수 없으며 MD 심사 단계로 전환됩니다. (MAN-B-RET-001 Chapter 03 · Section 3.3)",
      answer_en: "Clicking **[임시저장 (Save Draft)]** stores selected products and readiness answers under `draft` status, allowing ongoing edits. After selecting at least one product, clicking **[신청서 제출 (Submit Application)]** generates an official application ID (e.g. `APP-20261001-0001`) and transitions status to `submitted`. Once submitted, direct edits by the brand are locked as it enters MD review. (MAN-B-RET-001 Chapter 03 · Section 3.3)",
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
      id: "faq-ret-06",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "신청서 제출 후 진행 상태(Status)는 어떻게 구분되며 어떤 의미인가요?",
      question_en: "How are application statuses defined and what do they mean after submission?",
      answer_ko: "신청서는 9가지 상태로 관리됩니다: 1. `draft(임시저장)`: 작성 중, 2. `submitted(제출됨)`: 접수 완료 및 심사 대기, 3. `under_review(심사중)`: MD 심사 진행 중, 4. `info_requested(추가자료요청)`: MD의 추가 자료 요청 상태, 5. `re_review(재검토중)`: 브랜드 추가 자료 회신 후 재심사 대기, 6. `partial_approved(부분승인)`: 일부 제품 승인 완료, 7. `approved(승인됨)`: 전체 제품 승인 완료, 8. `on_hold(보류)`: 심사 일시 보류, 9. `rejected(반려됨)`: 심사 반려. (MAN-B-RET-001 Chapter 02 · Section 2.2)",
      answer_en: "Applications are tracked across 9 statuses: 1. `draft`: in progress, 2. `submitted`: received & waiting review, 3. `under_review`: active MD review, 4. `info_requested`: MD requesting additional info, 5. `re_review`: brand replied & awaiting re-review, 6. `partial_approved`: some products approved, 7. `approved`: all products approved, 8. `on_hold`: review temporarily paused, 9. `rejected`: review rejected. (MAN-B-RET-001 Chapter 02 · Section 2.2)",
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
      id: "faq-ret-07",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "신청서에 포함된 여러 제품의 개별 심사 상태와 전체 종합 상태는 어떻게 집계되나요?",
      question_en: "How are individual product review statuses and the aggregated application status calculated?",
      answer_ko: "신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 각 제품마다 독립적으로 `검토대기`, `심사 진행 중`, `보완 요청`, `심사 보류`, `심사 반려`, `심사 승인` 상태와 MD 피드백 사유(`↳ 사유: ...`)가 기록됩니다. 시스템의 자동 상태 집계 엔진(`computeAggregatedStatus`)은 모든 제품이 승인되면 `approved`, 모든 제품이 반려되면 `rejected`, 일부 제품만 승인되면 `partial_approved`, 심사 중인 제품이 남아있으면 `under_review`로 전체 상태를 실시간 산출합니다. (MAN-B-RET-001 Chapter 04 · Section 4.1 & 4.2)",
      answer_en: "Each product independently tracks status (`pending`, `under_review`, `info_requested`, `on_hold`, `rejected`, `approved`) with MD feedback reasons. The automated aggregation engine (`computeAggregatedStatus`) computes overall application status in real-time: `approved` if all products approved, `rejected` if all rejected, `partial_approved` if some approved, and `under_review` if any product is actively under review. (MAN-B-RET-001 Chapter 04 · Section 4.1 & 4.2)",
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
      id: "faq-ret-08",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "MD 심사역으로부터 추가 자료 요청(Info Request)을 받았을 때 어떻게 확인하고 회신하나요?",
      question_en: "How do I check and reply when receiving an Info Request from the MD review team?",
      answer_ko: "MD가 성분 분석표(COA), 영문 라벨, 상표권 증빙 등 추가 자료를 요청하면 신청서 상세 페이지 상단에 **노란색 긴급 알림 패널**이 활성화되고 회신 기한이 표시됩니다. 패널 내 회신 내용 입력란에 답변을 작성하고 필요 시 **[파일 선택]** 버튼을 통해 증빙 파일(PDF, PNG, JPG, WEBP, CSV, XLSX)을 첨부한 후 **[회신 제출]**을 클릭합니다. 제출 즉시 신청서 상태가 `재검토중(re_review)`으로 자동 전환되어 MD에게 전달됩니다. (MAN-B-RET-001 Chapter 05 · Section 5.1 & 5.2)",
      answer_en: "When MDs request additional documents (e.g., COA, English labeling, trademark proof), a yellow alert panel appears at the top of the application detail page with a reply deadline. Type your response in the text area, attach files (PDF, PNG, JPG, WEBP, CSV, XLSX) via **[파일 선택 (Choose File)]**, and click **[회신 제출 (Submit Reply)]**. The status immediately updates to `re_review`. (MAN-B-RET-001 Chapter 05 · Section 5.1 & 5.2)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 8,
      is_featured: true,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-ret-09",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "신청서 내 일부 제품만 승인되고 일부 제품이 반려/보류된 경우(부분승인) 어떻게 처리되나요?",
      question_en: "What happens if only some products are approved while others are rejected or put on hold (Partial Approval)?",
      answer_ko: "신청서 상태가 `부분승인(partial_approved)`으로 전환됩니다. 승인된 품목에 대해서만 우선적으로 K SELECT 북미 리테일 유통망 입점 및 후속 비즈니스 협의가 진행됩니다. 반려되거나 보류된 품목은 승인된 품목의 입점 진행에 부정적인 영향을 미치지 않으며, 각 품목별 타임라인에서 반려/보류 사유를 개별 확인할 수 있습니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q4)",
      answer_en: "The overall application status becomes `partial_approved`. Retail placement and subsequent business onboarding proceed for approved products immediately. Rejected or on-hold items do not hinder the progress of approved items, and reasons for each item can be reviewed in their respective timelines. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q4)",
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
      id: "faq-ret-10",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "입점 신청이 최종 승인(Approved)되면 발주서(PO)나 출고가 자동으로 생성되나요?",
      question_en: "Does Retail Application approval automatically generate a Purchase Order (PO) or shipment?",
      answer_ko: "아닙니다. 입점 신청 승인(Retail Placement Approval)은 해당 상품의 북미 리테일 유통 자격 심사가 완료되었음을 의미하며, 실제 발주서(Purchase Order), 오더 요청(Order Request), 출고(Shipment), 정산(Settlement)이 자동으로 생성되지 않습니다. 실물 발주 및 납품은 `MAN-B-ORD-001` 매뉴얼의 독립적인 오더 관리 절차(브랜드사 발주 요청 또는 본사 공식 PO 발행 및 확인)를 통해 별도로 진행됩니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q7)",
      answer_en: "No. Retail Placement Approval confirms retailer eligibility and does NOT automatically generate Purchase Orders, Order Requests, Shipments, or Settlements. Actual ordering and physical supply fulfillment proceed separately through the independent order management workflows defined in `MAN-B-ORD-001`. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q7)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-ret-11",
      portal_scope: "BRAND",
      topic_id: "topic-retail",
      source_knowledge_id: "kno-retail-applications-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      question_ko: "제품 심사가 반려(Rejected) 또는 보류(On Hold)된 경우 사유를 확인하고 어떻게 대처해야 하나요?",
      question_en: "If a product review is Rejected or On Hold, where can I check the reason and how should I respond?",
      answer_ko: "신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 해당 제품 하단 타임라인의 `↳ 사유: ...` 항목을 통해 MD 심사역이 기재한 공식 피드백을 확인할 수 있습니다. 보류(`on_hold`)된 경우 MD 담당자와 1:1 지원 채널을 통해 추가 협의를 진행할 수 있으며, 반려(`rejected`)된 경우 규제 서류, 성분, 영문 라벨, 바코드 등 미비 사항을 보완하여 향후 신규 신청을 준비할 수 있습니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q6)",
      answer_en: "Official feedback from the MD review team can be checked under each product's timeline row via `↳ 사유: ...`. For items on hold (`on_hold`), you can consult with MDs through support channels. For rejected (`rejected`) items, review the specific reasons (regulatory documents, ingredients, labeling, barcodes) to prepare for future new submissions. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q6)",
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
      id: "faq-log-01",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "선적 및 출고 관리(Shipping & Logistics) 프로세스는 어떤 단계로 진행되나요?",
      question_en: "How does the Shipping & International Logistics process work across lifecycle stages?",
      answer_ko: "공식 발주 확정(PO Status: APPROVED / SENT 및 supplier_confirmation: CONFIRMED) 완료 후, `1. 출고 준비 등록(Goods Readiness)` → `2. 실측 패킹 스펙(카톤 수, 중량, CBM) 입력 및 2대 무역 서류(P/L, C/I) 첨부` → `3. 운송 책임(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED)별 배송 이행` → `4. 국제 운송 추적(Inbound Tracking)` → `5. 미국 창고 도크 도착(ARRIVED) 및 실물 입고 검수(Warehouse Receiving)` 순서로 진행됩니다. (MAN-B-LOG-001 Chapter 01 · Section 1.1 & Diagram 1)",
      answer_en: "After formal PO Confirmation, the shipping lifecycle proceeds through: 1. Goods Readiness submission -> 2. Packaging specs (Cartons, Weight, CBM) & Trade Documents (P/L, C/I) upload -> 3. Shipping execution by responsibility track (LETUSTO_ARRANGED vs SUPPLIER_ARRANGED) -> 4. International inbound tracking -> 5. US warehouse arrival (ARRIVED) and physical receiving inspection. (MAN-B-LOG-001 Chapter 01 · Section 1.1 & Diagram 1)",
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
      id: "faq-log-02",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "운송 책임 트랙인 LETUSTO_ARRANGED와 SUPPLIER_ARRANGED의 차이는 무엇인가요?",
      question_en: "What is the difference between LETUSTO_ARRANGED and SUPPLIER_ARRANGED shipping tracks?",
      answer_ko: "무역 조건(Incoterms)에 따라 두 가지 트랙으로 분기됩니다: 1. **LETUSTO_ARRANGED (FOB/FCA 기준)**: 본사 지정 국제 포워더가 공급사 창고로 방문하여 화물을 수거(Pickup)하며, 상차 완료 후 포털 상세 화면에서 `[물품 인계 완료 (Handed Over)]`를 클릭합니다. 2. **SUPPLIER_ARRANGED (DDP/DAP 기준)**: 공급사가 자체 특송/운송사를 통해 미국 물류센터 도크까지 직접 발송하고 배송사(Carrier), 송장/BL 번호, ETD/ETA를 등록합니다. (MAN-B-LOG-001 Chapter 01 · Section 1.2 & Chapter 04)",
      answer_en: "Operations branch based on Incoterms: 1. LETUSTO_ARRANGED (FOB/FCA): Headquarters-designated freight forwarder handles pickup from the supplier origin; upon loading, click `[물품 인계 완료 (Handed Over)]`. 2. SUPPLIER_ARRANGED (DDP/DAP): Supplier ships directly via self-contracted carriers and registers Carrier, Tracking/BL, and ETD/ETA dates. (MAN-B-LOG-001 Chapter 01 · Section 1.2 & Chapter 04)",
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
      id: "faq-log-03",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "하나의 발주서(PO)에 대해 여러 번 나누어 분할 출고(Partial Shipment)를 진행할 수 있나요?",
      question_en: "Can I perform partial shipments for a single Purchase Order (PO)?",
      answer_ko: "네, 가능합니다. 발주서의 품목별 잔여 가용 수량(`availableReadiness = 확정량 - 기선적량 - 다른 진행중 준비량`) 범위 내라면 여러 차례 나누어 출고 준비(Goods Readiness)를 등록할 수 있습니다. 각 출고 건마다 독립된 CBM, 중량, 패킹리스트, 인계 상태가 관리됩니다. 단, 가용 수량을 초과하는 입력은 Overage Protection 유효성 검증에 의해 저장이 엄격히 차단됩니다. (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Chapter 06 · Q1)",
      answer_en: "Yes. As long as quantities stay within the item's remaining available readiness (`availableReadiness = confirmed_qty - cumulative_shipped - other pending`), multiple partial shipments can be submitted. Each readiness submission maintains independent CBM, weight, packing list, and handover status. Submissions exceeding available quota are blocked by Overage Protection validation. (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Chapter 06 · Q1)",
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
      id: "faq-log-04",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "출고 준비(Goods Readiness) 등록 시 필수로 첨부해야 하는 무역 서류는 무엇인가요?",
      question_en: "What mandatory trade documents are required for Goods Readiness submission?",
      answer_ko: "국제 운송 및 미국 세관 수입 통관을 위해 2대 필수 무역 서류인 **패킹 리스트 (Packing List, P/L)**와 **상업 송장 (Commercial Invoice, C/I)**을 첨부해야 합니다. `.pdf`, `.png`, `.jpg` 형식 업로드를 지원하며, 업로드된 서류는 Private Storage에 안전하게 암호화 보관됩니다. (MAN-B-LOG-001 Chapter 03 · Section 3.3)",
      answer_en: "For international freight and US customs clearance, two mandatory documents must be attached: **Packing List (P/L)** and **Commercial Invoice (C/I)**. Supported formats include `.pdf`, `.png`, and `.jpg`, stored encrypted in Private Storage. (MAN-B-LOG-001 Chapter 03 · Section 3.3)",
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
      id: "faq-log-05",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "CBM(Cubic Meter, 입방미터)과 실측 카고 스펙은 어떻게 산출 및 등록하나요?",
      question_en: "How are CBM and physical cargo specifications calculated and registered?",
      answer_ko: "CBM 산출 공식은 `카톤 가로(m) × 세로(m) × 높이(m) × 총 박스 수(Cartons)`입니다. (예: 50cm × 40cm × 30cm 박스 20개 = 0.5 × 0.4 × 0.3 × 20 = 1.200 CBM). 출고 등록 화면에서 준비 완료 수량(`Ready Qty`), 총 박스 수(`Cartons`), 포장재 포함 저울 실측 중량(`Gross Weight kg`), 총 체적(`CBM m³`)의 4대 스펙을 실측치 기준으로 입력합니다. (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Appendix B)",
      answer_en: "CBM is calculated as `Carton Width(m) × Length(m) × Height(m) × Total Cartons` (e.g., 20 boxes of 50cm × 40cm × 30cm = 0.5 × 0.4 × 0.3 × 20 = 1.200 CBM). On the submission form, 4 physical specs must be entered based on actual measurements: Ready Qty, Cartons, Gross Weight (kg), and CBM (m³). (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Appendix B)",
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
      id: "faq-log-06",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "물류 출고나 미국 창고 도착이 완료되면 대금 정산(Finance) 및 인보이스 결제가 자동으로 완료되나요?",
      question_en: "Does shipment completion or warehouse arrival automatically trigger finance settlement?",
      answer_ko: "아닙니다. 물류(LOG)와 재무/정산(FIN)은 상호 독립적인 비즈니스 도메인입니다 (**Shipping Complete ≠ Settlement Complete**). 공식 발주 확정 이후 양사 간 체결된 계약 조건(선급금 조건, 선적 시 청구 조건, 입고 검수 후 청구 조건 등)에 따라 `MAN-B-FIN-001` 재무 메뉴에서 독립적으로 인보이스를 발행하고 대금 지급/정산 절차를 진행합니다. (MAN-B-LOG-001 Chapter 01 · Section 1.1, Chapter 06 · Q6 & Appendix C 03)",
      answer_en: "No. Shipping/Logistics (LOG) and Finance/Settlement (FIN) operate as independent parallel business domains (**Shipping Complete ≠ Settlement Complete**). Following formal PO Confirmation, invoices and payouts are processed independently in the `MAN-B-FIN-001` Finance menu according to contractual payment terms (advance, on-shipment, or post-receiving terms). (MAN-B-LOG-001 Chapter 01 · Section 1.1, Chapter 06 · Q6 & Appendix C 03)",
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
      id: "faq-log-07",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "ARRIVED 상태와 RECEIVED 상태는 어떻게 다르며 입고 검수 판정은 어떻게 이루어지나요?",
      question_en: "What is the difference between ARRIVED and RECEIVED states, and how is warehouse inspection determined?",
      answer_ko: "`ARRIVED`는 화물이 미국 물류센터 도크에 물리적으로 도착한 시점(물류 운송 완료 및 창고 인계)이며, `RECEIVED`는 창고 검수자가 카톤을 개봉하여 바코드를 스캔하고 실물 수량/품질을 전수 검수한 완료 시점입니다 (**ARRIVED ≠ RECEIVED**). 실물 검수 결과는 1. 정상 입고 수량(`received_qty`), 2. 파손 격리 수량(`damaged_qty`), 3. 수량 불일치/라벨 보류 수량(`hold_qty`)의 3분류로 판정되어 입고 전표에 기록됩니다. (MAN-B-LOG-001 Chapter 05 · Section 5.1 & 5.2, Chapter 06 · Q3)",
      answer_en: "`ARRIVED` marks physical delivery at the US warehouse dock (logistics transit end & warehouse handoff), whereas `RECEIVED` marks completion of carton unboxing, barcode scanning, and piece-count quality inspection (**ARRIVED ≠ RECEIVED**). Inspection results are categorized into: 1. Normal received (`received_qty`), 2. Damaged quarantine (`damaged_qty`), and 3. Hold/discrepancy (`hold_qty`). (MAN-B-LOG-001 Chapter 05 · Section 5.1 & 5.2, Chapter 06 · Q3)",
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
      id: "faq-log-08",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "출고 준비 완료를 제출(READY_SUBMITTED)한 후 수량이나 출고지 정보를 수정할 수 있나요?",
      question_en: "Can I edit quantities or pickup address after submitting Goods Readiness (READY_SUBMITTED)?",
      answer_ko: "포워더 또는 배송사에 물품을 인계하기 전(`handover_status`가 `HANDED_OVER`로 전환되기 전)이라면 언제든지 출고 준비 정보를 수정하여 재제출할 수 있습니다. 수정 시 변경 이력은 발주서 액티비티 로그에 자동으로 기록됩니다. 단, 실물 화물 인계 또는 선적 등록이 완료된 이후에는 임의 수정이 제한됩니다. (MAN-B-LOG-001 Chapter 03 · Section 3.4 & Chapter 06 · Q2)",
      answer_en: "Before physical cargo handover to the forwarder/carrier (prior to `handover_status` changing to `HANDED_OVER`), readiness details can be modified and resubmitted anytime, with updates recorded in PO activity logs. Once handed over or dispatched, modifications are locked. (MAN-B-LOG-001 Chapter 03 · Section 3.4 & Chapter 06 · Q2)",
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
      id: "faq-log-09",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "브랜드 포털 사용자 역할(Admin/Operator vs Viewer)에 따른 물류 및 선적 권한 차이는 무엇인가요?",
      question_en: "What are the permission differences between Admin/Operator and Viewer roles for Shipping & Logistics?",
      answer_ko: "회사 관리자(Admin/Owner) 및 운영자(Operator)는 목록/상세 조회, 서류 다운로드, 새 출고 준비 등록(`+ New Goods Ready`), 물품 인계 처리(`Handed Over`), 직배송 선적 등록(`Dispatch Form`)을 모두 실행할 수 있습니다. 반면 조회 전용 사용자(Viewer)는 목록/상세 및 서류 다운로드만 가능하며, 신규 등록 버튼이 노출되지 않고 인계/선적 액션 폼이 읽기 전용으로 비활성화됩니다. (MAN-B-LOG-001 Chapter 06 · Section 6.1)",
      answer_en: "Company Admins/Owners and Operators have full access to view listings/details, download attachments, create goods readiness (`+ New Goods Ready`), complete handovers (`Handed Over`), and register dispatches. Viewer role users have read-only access to view and download, with creation buttons hidden and dispatch/handover forms deactivated. (MAN-B-LOG-001 Chapter 06 · Section 6.1)",
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
      id: "faq-log-10",
      portal_scope: "BRAND",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      question_ko: "선적 및 출고 관련 문의나 지원이 필요한 경우 어떤 채널을 이용할 수 있나요?",
      question_en: "What support channels are available for shipping and international logistics inquiries?",
      answer_ko: "1. **Ask K SELECT (Knowledge Assistant)**: Brand Portal의 Ask K SELECT에서 Published Knowledge를 기반으로 정책 및 물류 가이드를 검색할 수 있습니다. 2. **1:1 운영 문의 (Support Center)**: `https://portal.kselectnetwork.com/portal/support` 에서 물류/선적 문의 티켓을 발행하여 운영팀의 지원을 받을 수 있습니다. 3. **긴급 물류 핫라인**: 본사 물류운영본부(`logistics@letusto.com`)를 통해 소통할 수 있습니다. (MAN-B-LOG-001 Appendix D)",
      answer_en: "1. **Ask K SELECT (Knowledge Assistant)**: Search logistics guidelines and policies grounded in Published Knowledge. 2. **1:1 Support Center**: Submit logistics tickets at `https://portal.kselectnetwork.com/portal/support`. 3. **Urgent Logistics Desk**: Contact Headquarters Logistics Operations directly via `logistics@letusto.com`. (MAN-B-LOG-001 Appendix D)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-perm-01",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "한 명의 직원이 여러 회사의 포털 계정에 동시에 소속될 수 있나요?",
      question_en: "Can a single user belong to multiple company portal accounts simultaneously?",
      answer_ko: "아니오. 1 사용자 이메일 = 1 회사 계정의 1:1 바인딩 원칙을 적용합니다. 다른 회사에 참여하려면 별도의 비즈니스 이메일로 초대받아야 합니다.",
      answer_en: "No, a strict 1 user email = 1 company binding rule applies. To join a different company, invitation to a separate business email address is required.",
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
      id: "faq-perm-02",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "역할 템플릿(Preset)을 선택한 뒤 특정 메뉴의 권한만 따로 바꿀 수 있나요?",
      question_en: "Can I customize individual menu permissions after selecting a Role Preset?",
      answer_ko: "네, 가능합니다. 역할 프리셋(restricted / viewer / staff / manager / admin)으로 기본 권한을 불러온 후, 매트릭스에서 원하는 9대 카테고리의 접근 레벨(none / read / write / manage) 라디오 버튼을 개별 클릭하여 커스텀 권한으로 지정할 수 있습니다.",
      answer_en: "Yes. After loading default permissions with a Role Preset, individual category levels (none / read / write / manage) can be customized via the ACL matrix.",
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
      id: "faq-perm-03",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "발송된 초대 링크가 만료되었다고 표시됩니다.",
      question_en: "Why does the invitation link show as expired?",
      answer_ko: "초대 링크는 보안을 위해 발송 후 7일간 1회만 유효합니다. 만료된 경우 회사 관리자에게 소속 멤버 목록에서 [재초대]를 실행해 새 초대장을 발송해 달라고 요청하세요.",
      answer_en: "Invitation links expire after 7 days for security. If expired, request a company admin to click [Re-invite] from the member list to issue a new link.",
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
      id: "faq-perm-04",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "주 담당자로 지정되면 포털 권한도 자동으로 부여되나요?",
      question_en: "Does being assigned as a Primary Task Owner automatically grant portal ACL permissions?",
      answer_ko: "아닙니다. 6대 담당 업무 배정(company_apply, contract, product_cert, pricing_quote, logistics_inventory, settlement_inquiry)은 K SELECT 운영팀 소통 책임자 지정 및 이메일 알림 수신 라우팅 용도입니다. 실제 포털 메뉴 접근 및 수정 권한은 오직 ACL 매트릭스에 의해서만 결정됩니다.",
      answer_en: "No. Primary task assignments serve communication and email notification routing purposes only. Actual menu access and edit rights are governed solely by the ACL matrix.",
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
      id: "faq-perm-05",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "최초 관리자 계정을 다른 담당자로 변경하거나 삭제할 수 있나요?",
      question_en: "Can the Initial Owner admin account be deleted or transferred?",
      answer_ko: "회사를 최초 개설한 초기 관리자(Initial Owner) 계정은 시스템 세이프티 차단 규칙에 의해 임의 삭제가 불가능합니다. 권한 이양이나 대표자 변경은 K SELECT 지원팀으로 서면 문의하시기 바랍니다.",
      answer_en: "The Initial Owner account that created the company cannot be deleted due to system safety rules. Contact Support for official ownership transfer.",
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
      id: "faq-perm-06",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "퇴사한 팀원의 계정을 삭제하면 등록한 제품이나 발주 내역도 삭제되나요?",
      question_en: "Will products or order records be deleted if a team member account is removed?",
      answer_ko: "아니오. 등록된 브랜드, 제품, 발주서, 인보이스 데이터는 회사(company_id) 자산으로 귀속되어 보존되므로 멤버를 제거해도 회사의 비즈니스 데이터는 유지됩니다.",
      answer_en: "No. All brands, products, purchase orders, and financial data belong to the company asset scope (company_id) and remain preserved when a member is removed.",
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
      id: "faq-perm-07",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      question_ko: "이용 상태를 이용 일시정지(Deactive)로 변경하면 어떻게 되나요?",
      question_en: "What happens when a user status is changed to Suspended (Deactive)?",
      answer_ko: "해당 사용자의 활성 로그인 세션이 즉시 무효화되어 포털 접속이 차단됩니다. 추후 관리자가 Active(정상 이용) 상태로 재활성화하여 접속을 재개할 수 있습니다.",
      answer_en: "Active login sessions are immediately invalidated, blocking portal access. A company admin can reactivate the account status to Active later.",
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
      id: "faq-fin-01",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "공식 발주 확정(PO Confirmed) 후 대금 청구를 위한 인보이스 발행은 어떤 절차로 진행되나요?",
      question_en: "What is the end-to-end process for issuing a supplier invoice after PO Confirmation?",
      answer_ko: "공식 발주 확정(`CONFIRMED`) 완료 시 정산(FIN) 도메인이 즉시 활성화됩니다. 브랜드사는 `/portal/finance/new`에서 발주서를 선택하여 인보이스를 생성(`DRAFT`)하고, 수량·단가 확인 및 외부 송장 PDF를 첨부한 뒤 제출(`SUBMITTED`)합니다. 이후 본사 검토를 거쳐 승인(`APPROVED`), 대금 송금 집행(`PAID`), 정산 마감(`SETTLED`) 순으로 완수됩니다. (MAN-B-FIN-001 Chapter 01 · Section 1.1 & Diagram 01)",
      answer_en: "Following official PO Confirmation (`CONFIRMED`), the finance domain unlocks immediately. Brands create an invoice draft at `/portal/finance/new`, verify item lines/pricing, attach external invoice PDFs, and submit (`SUBMITTED`). The lifecycle concludes through Admin review/approval (`APPROVED`), remittance payment (`PAID`), and settlement closing (`SETTLED`). (MAN-B-FIN-001 Chapter 01 · Section 1.1 & Diagram 01)",
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
      id: "faq-fin-02",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "인보이스 상태(Invoice Status), 지급 상태(Payment Status), 정산 상태(Settlement Status)는 어떻게 구별되나요?",
      question_en: "How are Invoice Status, Payment Status, and Settlement Status disambiguated?",
      answer_ko: "세 가지 상태는 상호 독립적인 상태 머신으로 작동합니다 (**Invoice ≠ Payment ≠ Settlement**). 1. **인보이스 상태**: 문서 결재 단계(`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`). 2. **지급 상태**: 실제 송금 실적 및 잔액 기반 자동 산출(`UNPAID`, `PARTIALLY_PAID`, `PAID`). 3. **정산 상태**: 행정적 마감 상태(`OPEN`, `SETTLED`). \"승인됨(APPROVED)\"이 대금 지급 완료를 의미하지 않으며, \"지급 완료(PAID)\" 후에도 별도의 정산 마감 절차가 수행됩니다. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Diagram 02)",
      answer_en: "The 3 status dimensions operate as independent parallel state machines (**Invoice ≠ Payment ≠ Settlement**): 1. **Invoice Status**: Document workflow (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`). 2. **Payment Status**: Dynamically computed from remittance (`UNPAID`, `PARTIALLY_PAID`, `PAID`). 3. **Settlement Status**: Administrative closing (`OPEN`, `SETTLED`). \"APPROVED\" does not mean payment is executed, and \"PAID\" does not automatically close the settlement file. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Diagram 02)",
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
      id: "faq-fin-03",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "물류 출고나 미국 창고 도착(Shipping/Receiving)이 완료되면 정산 및 대금 지급이 자동으로 완료되나요?",
      question_en: "Does shipping completion or US warehouse receiving automatically trigger settlement or payment?",
      answer_ko: "아닙니다. 물류(LOG)와 정산(FIN)은 독립된 병렬 비즈니스 도메인입니다 (**Shipping Complete ≠ Settlement Complete**). 발주서가 완료(`PO COMPLETED`)되거나 화물이 도착(`ARRIVED`/`RECEIVED`)하더라도 인보이스나 지급 상태가 자동으로 변경되지 않습니다. 대금 지급은 양사 계약 조건(선급금, 선적 시 청구, 입고 후 청구 등)에 따라 독립된 인보이스 승인 및 송금 절차를 거쳐 집행됩니다. (MAN-B-FIN-001 Chapter 01 · Boundary 02 & Chapter 06 · Q6)",
      answer_en: "No. Shipping/Logistics (LOG) and Finance/Settlement (FIN) operate as independent parallel business domains (**Shipping Complete ≠ Settlement Complete**). PO completion or warehouse arrival does not alter Invoice or Payment statuses. Payments are executed independently via invoice review and remittance according to agreed contract terms. (MAN-B-FIN-001 Chapter 01 · Boundary 02 & Chapter 06 · Q6)",
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
      id: "faq-fin-04",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "하나의 발주서(PO)에 대해 여러 개의 인보이스를 동시에 생성하거나 등록할 수 있나요?",
      question_en: "Can multiple active invoices be created for a single Purchase Order (PO)?",
      answer_ko: "아니요, 불가능합니다. 1개 PO당 최대 1건의 활성 인보이스(`invoice_status NOT IN ('VOID', 'REJECTED')`)만 존재할 수 있는 **Single Active Invoice** 규칙이 적용됩니다. 동일 PO에 이미 활성 인보이스가 존재할 경우, 포털 화면 사전 검증(Check 1) 및 데이터베이스 고유 인덱스(`idx_supplier_invoices_one_active_per_po`, Check 2) 양단계에서 신규 생성이 원천 차단됩니다. (MAN-B-FIN-001 Chapter 06 · Section 6.2 & Diagram 04)",
      answer_en: "No. K SELECT enforces the **Single Active Invoice** policy where only 1 active invoice (`invoice_status NOT IN ('VOID', 'REJECTED')`) is allowed per PO. If an active invoice already exists, duplicate creation is strictly blocked by both application pre-checks (Check 1) and database partial unique index constraints (`idx_supplier_invoices_one_active_per_po`, Check 2). (MAN-B-FIN-001 Chapter 06 · Section 6.2 & Diagram 04)",
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
      id: "faq-fin-05",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "인보이스 청구 총액(invoice_total)과 미지급 잔액(balance_due)은 어떤 공식으로 산출되나요?",
      question_en: "How are the invoice total (invoice_total) and balance due (balance_due) calculated?",
      answer_ko: "시스템은 다음 5대 수식에 따라 실시간으로 연산합니다: 1. 품목 소계: `subtotal = SUM(invoiced_qty * unit_price)`, 2. 정산 조정 합계: `adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)`, 3. 최종 청구 총액: `invoice_total = subtotal + adjustmentTotal`, 4. 지급 완료 누적액: `amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')`, 5. 미지급 잔액: `balance_due = invoice_total - amount_paid`. 최종 청구 총액이 0 미만인 경우 저장이 자동 차단됩니다. (MAN-B-FIN-001 Chapter 06 · Section 6.1)",
      answer_en: "The system calculates amounts in real time using 5 authoritative formulas: 1. Line subtotal: `subtotal = SUM(invoiced_qty * unit_price)`, 2. Adjustment total: `adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)`, 3. Final Invoice Total: `invoice_total = subtotal + adjustmentTotal`, 4. Completed Remittance: `amount_paid = SUM(completed payments)`, 5. Balance Due: `balance_due = invoice_total - amount_paid`. Submissions with negative totals (< $0) are automatically blocked. (MAN-B-FIN-001 Chapter 06 · Section 6.1)",
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
      id: "faq-fin-06",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "대금이 분할 이체(Partial Payment)되는 경우 지급 상태는 어떻게 변경되나요?",
      question_en: "How does Payment Status change when partial payments are remitted?",
      answer_ko: "지급 상태는 잔액(`balance_due`)에 따라 동적으로 자동 산출됩니다. 송금 전에는 `UNPAID(미지급)` 상태이며, 일부 금액만 이체되어 `amount_paid > 0` 및 `balance_due > 0`인 경우 `PARTIALLY_PAID(일부지급)`으로 자동 전환됩니다. 최종 잔여 금액이 모두 송금되어 `balance_due <= 0`이 되면 `PAID(지급완료)` 상태로 전환됩니다. 일시 완납 시에는 UNPAID에서 PAID로 즉시 변경됩니다. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Chapter 05 · Section 5.1)",
      answer_en: "Payment Status is computed dynamically based on `balance_due`: It starts as `UNPAID`. When partial payments occur (`amount_paid > 0` and `balance_due > 0`), it transitions automatically to `PARTIALLY_PAID`. Once full remittance reduces `balance_due <= 0`, status becomes `PAID`. In full single payouts, it transitions directly from UNPAID to PAID. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Chapter 05 · Section 5.1)",
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
      id: "faq-fin-07",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "입고 검수 시 수량 부족(Shortage)이나 파손(Damage)이 발생하면 인보이스 정산 조정(Adjustment)은 어떻게 반영되나요?",
      question_en: "How are warehouse shortages, damages, or price differences handled via settlement adjustments?",
      answer_ko: "본사 어드민 심사 시 실물 입고 검수 결과에 따라 3대 조정 유형이 인보이스에 추가됩니다: 1. `SHORTAGE` (수량 부족 감액 CREDIT), 2. `DAMAGE` (파손 격리 감액 CREDIT), 3. `PRICE_DIFFERENCE` (단가 차액 감액 CREDIT 또는 증액 CHARGE). 조정 항목이 반영되면 `adjustmentTotal`이 재연산되어 최종 청구 총액(`invoice_total`)에 자동 반영됩니다. (MAN-B-FIN-001 Chapter 04 · Section 4.2 & Appendix B.1)",
      answer_en: "Admin reviewers apply 3 standard adjustment categories based on warehouse inspection: 1. `SHORTAGE` (quantity deficiency CREDIT deduction), 2. `DAMAGE` (damaged cargo CREDIT deduction), 3. `PRICE_DIFFERENCE` (contract unit price difference CREDIT/CHARGE). Adjustments update `adjustmentTotal`, which recalculates final `invoice_total` automatically. (MAN-B-FIN-001 Chapter 04 · Section 4.2 & Appendix B.1)",
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
      id: "faq-fin-08",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "포털 내에서 PDF 인보이스를 자동 생성하거나 1개 PO에 대해 여러 번 분할 인보이스(Partial Invoicing)를 청구할 수 있나요?",
      question_en: "Does the portal support automatic PDF export or 1:N partial invoicing for a single PO?",
      answer_ko: "1. **1:N 분할 인보이스 (Partial Invoicing)**: 1개 PO에 대해 여러 차례 나누어 인보이스를 청구하는 기능은 **지원되지 않습니다 (NOT SUPPORTED)** (Single Active Invoice 원칙). 2. **포털 내 PDF 자동 변환 (PDF Export)**: 입력 데이터를 PDF로 자동 변환·내보내는 기능은 **구현되어 있지 않습니다 (NOT IMPLEMENTED)**. 브랜드사는 외부 회계 시스템에서 발행한 정식 PDF 송장 파일을 직접 첨부해야 합니다. (MAN-B-FIN-001 Chapter 06 · Section 6.3)",
      answer_en: "1. **1:N Partial Invoicing**: Submitting multiple partial invoices for 1 PO is **NOT SUPPORTED** (Single Active Invoice constraint). 2. **Portal PDF Auto Export**: Converting input forms into PDF documents is **NOT IMPLEMENTED**. Partner brands must attach their externally generated commercial invoice PDF directly to the submission form. (MAN-B-FIN-001 Chapter 06 · Section 6.3)",
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
      id: "faq-fin-09",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "제출한 인보이스가 본사 심사에서 반려(REJECTED)되거나 무효화(VOID)된 경우 어떻게 대처해야 하나요?",
      question_en: "What should I do if an invoice is Rejected (REJECTED) or Voided (VOID) by Admin review?",
      answer_ko: "인보이스가 `REJECTED` 또는 `VOID` 처리되면 해당 PO에 걸려 있던 활성 인보이스 잠금이 즉시 해제됩니다. 브랜드사는 상세 화면에서 반려 사유를 확인한 후, `/portal/finance/new`에서 해당 발주서를 다시 선택하여 수정된 내용과 정정 서류를 첨부한 새 인보이스를 즉시 작성·제출할 수 있습니다. (MAN-B-FIN-001 Chapter 04 · Section 4.3 & Chapter 05 · Section 5.2)",
      answer_en: "When an invoice is transitioned to `REJECTED` or `VOID`, the active invoice lock on that PO is immediately released. Brands can review the rejection reason on the detail page, then navigate to `/portal/finance/new` to create and submit a corrected invoice for the PO with revised attachments. (MAN-B-FIN-001 Chapter 04 · Section 4.3 & Chapter 05 · Section 5.2)",
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
      id: "faq-fin-10",
      portal_scope: "BRAND",
      topic_id: "topic-finance",
      source_knowledge_id: "kno-finance-settlement-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      question_ko: "브랜드 포털 사용자 역할에 따른 정산 메뉴 권한과 정산 관련 1:1 문의 채널은 어떻게 되나요?",
      question_en: "What permissions are granted by role for Finance, and how can I escalate settlement inquiries?",
      answer_ko: "관리자(Admin/Owner) 및 매니저(Manager/Operator)는 인보이스 작성, 수정, 제출, 삭제를 모두 실행할 수 있습니다. 조회 전용 사용자(Viewer)는 목록 및 상세 조회만 가능합니다. 정산 문의나 송금 일정 확인이 필요한 경우, 상세 화면의 `[💬 정산 문의]` 버튼을 클릭하면 카테고리(`finance`)와 AP/송장 번호가 사전 입력된 1:1 지원 센터(`https://portal.kselectnetwork.com/portal/support`)로 자동 연계됩니다. (MAN-B-FIN-001 Chapter 06 · Section 6.1 & Appendix D)",
      answer_en: "Admins/Owners and Managers have full permissions to create, edit, submit, and delete invoices. Viewer users have read-only access. For settlement or remittance inquiries, clicking `[💬 Settlement Inquiry]` pre-fills the ticket category (`finance`) and AP/Invoice context directly into the 1:1 Support Desk form (`https://portal.kselectnetwork.com/portal/support`). (MAN-B-FIN-001 Chapter 06 · Section 6.1 & Appendix D)",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
      is_featured: false,
      generated_by: "MANUAL",
      created_at: now,
      updated_at: now
    },
    {
      id: "faq-task-01",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "1:1 지원 센터(Support Center)에서 문의 및 이슈를 접수하려면 어떻게 해야 하나요?",
      question_en: "How do I submit a 1:1 support inquiry in the Brand Portal Support Center?",
      answer_ko: "브랜드 포털 상단 지원 센터 메뉴(/portal/support)에서 [+ 신규 문의 접수] 버튼을 클릭하여 9개 카테고리 중 하나를 선택하고 제목, 상세 내용 및 증빙 파일(최대 20MB)을 첨부하여 등록합니다.",
      answer_en: "Navigate to Support Center (/portal/support), click [+ New Inquiry], select one of the 9 categories, enter title and details, and attach files (up to 20MB per file).",
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
      id: "faq-task-02",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "접수된 문의(Support Case)의 진행 상태(Status) 라이프사이클은 어떻게 관리되나요?",
      question_en: "How does the support case status lifecycle progress?",
      answer_ko: "문의 접수 완료(RECEIVED) → K SELECT 운영팀 담당자 심사 진행(UNDER_REVIEW) → 필요 시 추가 정보 또는 보완 서류 요청(ACTION_REQUIRED) → 보완 제출 후 조치 완료 시 케이스 종결(CLOSED) 순으로 진행됩니다.",
      answer_en: "Cases move through: RECEIVED -> UNDER_REVIEW -> ACTION_REQUIRED (if supplementation is requested) -> UNDER_REVIEW -> CLOSED upon resolution.",
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
      id: "faq-task-03",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "운영팀으로부터 조치 요청(ACTION_REQUIRED)을 받았을 때 보완 회신은 어떻게 제출하나요?",
      question_en: "How do I respond when a case status is set to ACTION_REQUIRED?",
      answer_ko: "해당 케이스 상세 화면에서 운영팀의 보완 요청 메시지를 확인한 후, 메시지 입력창에 회신 내용을 작성하고 보완 서류를 첨부하여 [보완 완료 제출] 버튼을 클릭합니다. 제출 즉시 상태가 UNDER_REVIEW로 환원됩니다.",
      answer_en: "Review the admin request in case details, enter reply text, attach requested documents, and click [Submit Supplement]. Status automatically returns to UNDER_REVIEW.",
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
      id: "faq-task-04",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "문의 케이스 종결(CLOSED)과 서비스 만족도 평가(CSAT)는 어떤 관계인가요?",
      question_en: "What is the relationship between Case Closing (CLOSED) and CSAT survey evaluation?",
      answer_ko: "케이스 종결(CLOSED)과 만족도 평가(CSAT)는 독립된 별개의 절차입니다 (CLOSE ≠ CSAT). 케이스가 종결된 후 브랜드 사용자는 5점 만점 별점 평가 및 피드백을 자율적으로 작성하여 제출할 수 있습니다.",
      answer_en: "Case closing and CSAT submission are separate steps (CLOSE ≠ CSAT). After a case is CLOSED, brand users can voluntarily submit a 5-star rating and feedback.",
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
      id: "faq-task-05",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "지원 센터 문의 접수 시 선택할 수 있는 9개 업무 카테고리는 무엇인가요?",
      question_en: "What are the 9 inquiry categories available in the Support Center?",
      answer_ko: "일반 문의(general_inquiry), 브랜드 정책(brand_policy), 상품 등록(product_listing), 발주 이행(order_fulfillment), 물류 배송(logistics_shipping), 정산 결제(finance_settlement), 인허가 규정(regulatory_compliance), 입점 신청(retail_placement), 계정 보안(account_security) 9가지입니다.",
      answer_en: "The 9 categories are: General Inquiry, Brand Policy, Product Listing, Order Fulfillment, Logistics & Shipping, Finance & Settlement, Regulatory Compliance, Retail Placement, and Account Security.",
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
      id: "faq-task-06",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "문의 등록 시 첨부 가능한 파일의 스펙과 보안 다운로드 방식은 무엇인가요?",
      question_en: "What are the attachment file specifications and security download rules?",
      answer_ko: "이미지(PNG, JPEG, WEBP) 및 문서(PDF) 형식을 지원하며 파일당 최대 20MB로 제한됩니다. 모든 첨부파일은 독립된 Private 스토리지(company-uploads)에 암호화 저장되며, 시간 제한 서명 URL(Signed URL)을 통해서만 다운로드할 수 있습니다.",
      answer_en: "Supports PNG, JPEG, WEBP, and PDF up to 20MB per file. Files are stored in private bucket company-uploads and downloaded strictly via temporary Signed URLs.",
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
      id: "faq-task-07",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "발주, 정산, 계약 메뉴에서 지원 센터로 문의 이동 시 교차 도메인 연동은 어떻게 동작하나요?",
      question_en: "How does cross-domain linking work when navigating to Support from Order, Finance, or Agreement pages?",
      answer_ko: "발주 변경 문의 시에는 발주서 데이터베이스 외래키(related_po_id real DB FK)가 직접 바인딩되며, 정산 및 계약 문의의 경우 사전 입력 컨텍스트(kselect_support_handoff context prefill)가 문의 작성 폼에 자동 삽입됩니다.",
      answer_en: "PO Change inquiries bind the actual DB foreign key (related_po_id FK), while Settlement and Agreement inquiries automatically pre-fill context via kselect_support_handoff.",
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
      id: "faq-task-08",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "사용자의 포털 권한(ACL) 레벨에 따라 1:1 문의 기능 이용 범위가 어떻게 달라지나요?",
      question_en: "How do support ACL permission levels restrict Support Center actions?",
      answer_ko: "support:none(접근 차단), support:read(문의 및 대화 단순 열람), support:write(신규 문의 작성, 회신 및 보완 제출), support:manage(작성/회신 + 케이스 직접 종결 closeCase) 권한 범위로 정밀제어됩니다.",
      answer_en: "support:none blocks access, support:read grants read-only viewing, support:write enables creation and replies, and support:manage allows case closing (closeCase).",
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
      id: "faq-task-09",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "문의 상태 변경 및 답변 등록 시 인앱 알림과 이메일 알림은 어떻게 발송되나요?",
      question_en: "How are in-app and transactional email notifications routed for support inquiries?",
      answer_ko: "인앱 알림은 6대 주요 이벤트 발생 시 항상 생성됩니다. 반면 이메일은 운영팀의 긴급 조치 요청(isActionRequired=true 및 이메일 발송 옵션 선택) 시에만 제한적으로 발송되어 피로도를 방지합니다.",
      answer_en: "In-app notifications are always generated for all 6 events. Transactional emails are sent strictly when urgent action is required (isActionRequired=true and email option selected).",
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
      id: "faq-task-10",
      portal_scope: "BRAND",
      topic_id: "topic-company",
      source_knowledge_id: "kno-task-communication-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      question_ko: "사용자 관리의 주 담당자 배정(PERM)과 지원 센터 1:1 문의(TASK)는 어떻게 구분되나요?",
      question_en: "How is Primary Task Owner Routing (PERM) disambiguated from Dynamic 1:1 Support Cases (TASK)?",
      answer_ko: "PERM(company_task_assignments)의 6대 담당 업무 설정은 운영 소통 책임자 지정 및 알림 수신용 정적 라우팅입니다. TASK(partner_inquiries)는 실시간 1:1 대화 및 상태 추적을 다루는 독립 도메인입니다.",
      answer_en: "PERM task assignment specifies static primary contact routing for email notifications, while TASK manages dynamic 1:1 inquiry cases independently.",
      audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
      status: "APPROVED",
      kind: "BOTH",
      display_order: 10,
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
    },
    {
      id: "ver-regulatory-compliance-v11",
      knowledge_id: "kno-regulatory-compliance-v11",
      version: "v1.1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001 v1.1.0)",
      title_en: "K SELECT Brand Portal Regulatory, Certification & Compliance User Guide v1.1.0",
      summary_ko: "최초 공식 발행 버전 (15-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-regulatory-compliance-v11")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-regulatory-compliance-v11")?.content_en || "",
      what_changed: "MAN-B-REG-001 Regulatory, Certification & Compliance User Guide 공식 배포 (v1.1.0)",
      why_changed: "미국 MoCRA 및 FDA 화장품 수출 규정 준수, 상표권 및 인허가 서류 버전 관리 표준화",
      effective_date: "2026-10-01",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-retail-applications-v10",
      knowledge_id: "kno-retail-applications-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001 v1.0)",
      title_en: "K SELECT Brand Portal Retail Applications & Placement User Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (12-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-retail-applications-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-retail-applications-v10")?.content_en || "",
      what_changed: "MAN-B-RET-001 Retail Applications & Placement User Guide 공식 배포 (v1.0)",
      why_changed: "미국 메이저 리테일러 입점 신청, 카탈로그 선택, 공급 역량 선언 및 MD 심사 프로세스 표준화",
      effective_date: "2026-10-02",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-shipping-logistics-v10",
      knowledge_id: "kno-shipping-logistics-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001 v1.0)",
      title_en: "K SELECT Brand Portal Shipping & International Logistics Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (22-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-shipping-logistics-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-shipping-logistics-v10")?.content_en || "",
      what_changed: "MAN-B-LOG-001 Shipping & International Logistics Guide 공식 배포 (v1.0)",
      why_changed: "국제 B2B 공급망 출고 준비, Dual-Track 운송 책임, 무역 서류 업로드 및 창고 입고 검수 프로세스 표준화",
      effective_date: "2026-10-01",
      created_by_name: "Logistics Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-permissions-user-management-v10",
      knowledge_id: "kno-permissions-user-management-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001 v1.0)",
      title_en: "K SELECT Brand Portal Permissions & User Management Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (15-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-permissions-user-management-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-permissions-user-management-v10")?.content_en || "",
      what_changed: "MAN-B-PERM-001 Permissions & User Management Guide 공식 배포 (v1.0)",
      why_changed: "브랜드 파트너사 사용자 초대, 권한 설정, 업무 배정 및 안전 계정 정책 가이드 정립",
      effective_date: "2026-10-02",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-finance-settlement-v10",
      knowledge_id: "kno-finance-settlement-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001 v1.0)",
      title_en: "K SELECT Brand Portal Finance & Settlement User Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (21-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-finance-settlement-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-finance-settlement-v10")?.content_en || "",
      what_changed: "MAN-B-FIN-001 Finance & Settlement User Guide 공식 배포 (v1.0)",
      why_changed: "B2B 공급망 인보이스 발행, 3대 독립 상태 차원(Invoice ≠ Payment ≠ Settlement), Single Active Invoice 및 정산 조정 프로세스 표준화",
      effective_date: "2026-10-02",
      created_by_name: "Finance Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-task-communication-v10",
      knowledge_id: "kno-task-communication-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001 v1.0)",
      title_en: "K SELECT Brand Portal Task & Communication Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (22-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-task-communication-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-task-communication-v10")?.content_en || "",
      what_changed: "MAN-B-TASK-001 Task & Communication Guide 공식 배포 (v1.0)",
      why_changed: "브랜드 파트너사 1:1 문의 접수, 4단계 케이스 라이프사이클, CSAT 만족도 평가 및 교차 도메인 연동 가이드 정립",
      effective_date: "2026-10-02",
      created_by_name: "Support Operations Desk",
      published_at: now,
      created_at: now
    },
    {
      id: "ver-reports-performance-v10",
      knowledge_id: "kno-reports-performance-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001 v1.0)",
      title_en: "K SELECT Brand Portal Reports & Performance Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (21-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-reports-performance-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-reports-performance-v10")?.content_en || "",
      what_changed: "MAN-B-RPT-001 Reports & Performance Guide 공식 배포 (v1.0)",
      why_changed: "브랜드 파트너사 메인 대시보드 지표, 실행 필요 큐, 발주 파이프라인 집계, 재무/정산 모니터링, 28대 기준 카탈로그 완성도 감사 및 어드민 연계 가이드 정립",
      effective_date: "2026-10-02",
      created_by_name: "Operations Analytics Desk",
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
    },
    {
      id: "rel-reg-brand-new",
      knowledge_id: "kno-regulatory-compliance-v11",
      related_portal: "Brand Portal",
      related_module: "REGULATORY",
      related_menu: "New Brand Trademark Registration",
      related_route: "/portal/brands/new",
      manual_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      created_at: now
    },
    {
      id: "rel-reg-brand-detail",
      knowledge_id: "kno-regulatory-compliance-v11",
      related_portal: "Brand Portal",
      related_module: "REGULATORY",
      related_menu: "Brand Trademark & Document Edit",
      related_route: "/portal/brands/[id]",
      manual_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      created_at: now
    },
    {
      id: "rel-reg-product-detail",
      knowledge_id: "kno-regulatory-compliance-v11",
      related_portal: "Brand Portal",
      related_module: "REGULATORY",
      related_menu: "Product Ingredients & Certificates (Tab 1 & 6)",
      related_route: "/portal/products/[id]",
      manual_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      created_at: now
    },
    {
      id: "rel-admin-reg-brand",
      knowledge_id: "kno-regulatory-compliance-v11",
      related_portal: "Admin",
      related_module: "REGULATORY",
      related_menu: "Admin Brand Trademark Inspection",
      related_route: "/admin/brands/[brandId]",
      manual_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      created_at: now
    },
    {
      id: "rel-admin-reg-product",
      knowledge_id: "kno-regulatory-compliance-v11",
      related_portal: "Admin",
      related_module: "REGULATORY",
      related_menu: "Admin Product Certificates Audit",
      related_route: "/admin/products/[id]",
      manual_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      created_at: now
    },
    {
      id: "rel-ret-app-dashboard",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Brand Portal",
      related_module: "RETAIL",
      related_menu: "Retail Applications Dashboard",
      related_route: "/portal/applications",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-ret-app-new",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Brand Portal",
      related_module: "RETAIL",
      related_menu: "New Retail Application",
      related_route: "/portal/applications/new",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-ret-app-detail",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Brand Portal",
      related_module: "RETAIL",
      related_menu: "Retail Application Detail & Info Reply",
      related_route: "/portal/applications/[id]",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-admin-ret-apps",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Admin",
      related_module: "RETAIL",
      related_menu: "Admin Retail Applications Review",
      related_route: "/admin/applications",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-admin-ret-app-detail",
      knowledge_id: "kno-retail-applications-v10",
      related_portal: "Admin",
      related_module: "RETAIL",
      related_menu: "Admin Retail Application Evaluation & Info Request",
      related_route: "/admin/applications/[id]",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      created_at: now
    },
    {
      id: "rel-log-shipping-hub",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Brand Portal",
      related_module: "LOGISTICS",
      related_menu: "Shipping & Logistics Hub",
      related_route: "/portal/orders/shipping",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-log-goods-readiness",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Brand Portal",
      related_module: "LOGISTICS",
      related_menu: "New Goods Readiness",
      related_route: "/portal/orders/shipping/new",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-log-shipping-detail",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Brand Portal",
      related_module: "LOGISTICS",
      related_menu: "Goods Readiness Detail & Handover",
      related_route: "/portal/orders/shipping/[id]",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-admin-shipments-mgmt",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Admin",
      related_module: "LOGISTICS",
      related_menu: "Admin Shipments Management",
      related_route: "/admin/orders/shipments",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-admin-shipment-detail",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Admin",
      related_module: "LOGISTICS",
      related_menu: "Admin Inbound Shipment Detail",
      related_route: "/admin/orders/shipments/[id]",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-admin-warehouse-receiving",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Admin",
      related_module: "LOGISTICS",
      related_menu: "Admin Warehouse Receiving Inspection",
      related_route: "/admin/warehouse/receiving/[id]",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-perm-company-users",
      knowledge_id: "kno-permissions-user-management-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Company & User Management",
      related_route: "/portal/company/users",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      created_at: now
    },
    {
      id: "rel-perm-invite-accept",
      knowledge_id: "kno-permissions-user-management-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Invite Accept & Onboarding",
      related_route: "/portal/invite/accept",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      created_at: now
    },
    {
      id: "rel-perm-my-account",
      knowledge_id: "kno-permissions-user-management-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "My Account Settings",
      related_route: "/portal/account",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      created_at: now
    },
    {
      id: "rel-fin-hub",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Brand Portal",
      related_module: "FINANCE",
      related_menu: "Finance & Invoices Hub",
      related_route: "/portal/finance",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-fin-new-invoice",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Brand Portal",
      related_module: "FINANCE",
      related_menu: "New Supplier Invoice",
      related_route: "/portal/finance/new",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-fin-invoice-detail",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Brand Portal",
      related_module: "FINANCE",
      related_menu: "Invoice Detail View",
      related_route: "/portal/finance/[id]",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-fin-invoice-edit",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Brand Portal",
      related_module: "FINANCE",
      related_menu: "Edit Invoice Draft",
      related_route: "/portal/finance/[id]/edit",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-admin-fin-invoices",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Admin",
      related_module: "FINANCE",
      related_menu: "Admin Invoices Management",
      related_route: "/admin/finance/invoices",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-admin-fin-invoice-detail",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Admin",
      related_module: "FINANCE",
      related_menu: "Admin Invoice Review & Approval",
      related_route: "/admin/finance/invoices/[id]",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-admin-fin-payments",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Admin",
      related_module: "FINANCE",
      related_menu: "Admin Payments Management",
      related_route: "/admin/finance/payments",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-admin-fin-payment-new",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Admin",
      related_module: "FINANCE",
      related_menu: "Admin New Payment Execution Form",
      related_route: "/admin/finance/payments/new",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-admin-fin-payment-detail",
      knowledge_id: "kno-finance-settlement-v10",
      related_portal: "Admin",
      related_module: "FINANCE",
      related_menu: "Admin Payment Detail View",
      related_route: "/admin/finance/payments/[id]",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      created_at: now
    },
    {
      id: "rel-task-support-hub",
      knowledge_id: "kno-task-communication-v10",
      related_portal: "Brand Portal",
      related_module: "TASK",
      related_menu: "Support Center & 1:1 Inquiries",
      related_route: "/portal/support",
      manual_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      created_at: now
    },
    {
      id: "rel-admin-task-inquiries",
      knowledge_id: "kno-task-communication-v10",
      related_portal: "Admin",
      related_module: "TASK",
      related_menu: "Admin Partner Inquiries Management",
      related_route: "/admin/partner-inquiries",
      manual_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      created_at: now
    },
    {
      id: "rel-rpt-dashboard",
      knowledge_id: "kno-reports-performance-v10",
      related_portal: "Brand Portal",
      related_module: "REPORTS",
      related_menu: "Dashboard & Action Queue",
      related_route: "/portal",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      created_at: now
    },
    {
      id: "rel-rpt-po-pipeline",
      knowledge_id: "kno-reports-performance-v10",
      related_portal: "Brand Portal",
      related_module: "REPORTS",
      related_menu: "PO Pipeline Performance",
      related_route: "/portal/orders/purchase-orders",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      created_at: now
    },
    {
      id: "rel-rpt-finance",
      knowledge_id: "kno-reports-performance-v10",
      related_portal: "Brand Portal",
      related_module: "REPORTS",
      related_menu: "Finance Cash Flow Tracking",
      related_route: "/portal/finance",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      created_at: now
    },
    {
      id: "rel-rpt-products",
      knowledge_id: "kno-reports-performance-v10",
      related_portal: "Brand Portal",
      related_module: "REPORTS",
      related_menu: "Product Completeness Audit",
      related_route: "/portal/products",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      created_at: now
    },
    {
      id: "rel-rpt-support",
      knowledge_id: "kno-reports-performance-v10",
      related_portal: "Brand Portal",
      related_module: "REPORTS",
      related_menu: "Support Resolution Tracking",
      related_route: "/portal/support",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      created_at: now
    },
    {
      id: "rel-admin-rpt-purchasing",
      knowledge_id: "kno-reports-performance-v10",
      related_portal: "Admin",
      related_module: "REPORTS",
      related_menu: "Admin Purchasing Dashboard",
      related_route: "/admin/purchasing/dashboard",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
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
      file_size: 4188914,
      published_date: "2026-10-01",
      created_at: now
    },
    {
      id: "asset-regulatory-compliance-v11",
      knowledge_id: "kno-regulatory-compliance-v11",
      manual_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
      version: "v1.1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-regulatory-compliance-v11",
      file_name: "MAN-B-REG-001_Regulatory-Compliance_V1.pdf",
      file_size: 1915000,
      published_date: "2026-10-01",
      created_at: now
    },
    {
      id: "asset-retail-applications-v10",
      knowledge_id: "kno-retail-applications-v10",
      manual_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-retail-applications-v10",
      file_name: "MAN-B-RET-001_Retail-Applications_V1.pdf",
      file_size: 1129760,
      published_date: "2026-10-02",
      created_at: now
    },
    {
      id: "asset-shipping-logistics-v10",
      knowledge_id: "kno-shipping-logistics-v10",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-shipping-logistics-v10",
      file_name: "MAN-B-LOG-001_Shipping-Logistics_V1.pdf",
      file_size: 3495347,
      published_date: "2026-10-01",
      created_at: now
    },
    {
      id: "asset-permissions-user-management-v10",
      knowledge_id: "kno-permissions-user-management-v10",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-permissions-user-management-v10",
      file_name: "MAN-B-PERM-001_Permissions-User-Management_V1.pdf",
      file_size: 1441842,
      published_date: "2026-10-02",
      created_at: now
    },
    {
      id: "asset-finance-settlement-v10",
      knowledge_id: "kno-finance-settlement-v10",
      manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-finance-settlement-v10",
      file_name: "MAN-B-FIN-001_Finance-Settlement_V1.pdf",
      file_size: 4716798,
      published_date: "2026-10-02",
      created_at: now
    },
    {
      id: "asset-task-communication-v10",
      knowledge_id: "kno-task-communication-v10",
      manual_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-task-communication-v10",
      file_name: "MAN-B-TASK-001_Task-Communication_V1.pdf",
      file_size: 3664407,
      published_date: "2026-10-02",
      created_at: now
    },
    {
      id: "asset-reports-performance-v10",
      knowledge_id: "kno-reports-performance-v10",
      manual_title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드 (MAN-B-RPT-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-reports-performance-v10",
      file_name: "MAN-B-RPT-001_Reports-Performance_V1.pdf",
      file_size: 2503532,
      published_date: "2026-10-02",
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
    },
    {
      id: "log-regulatory-compliance-v11",
      knowledge_id: "kno-regulatory-compliance-v11",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-REG-001 Official Publication",
      created_at: now
    },
    {
      id: "log-retail-applications-v10",
      knowledge_id: "kno-retail-applications-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-RET-001 Official Publication",
      created_at: now
    },
    {
      id: "log-shipping-logistics-v10",
      knowledge_id: "kno-shipping-logistics-v10",
      user_id: "user-admin-01",
      user_name: "Logistics Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-LOG-001 Official Publication",
      created_at: now
    },
    {
      id: "log-permissions-user-management-v10",
      knowledge_id: "kno-permissions-user-management-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-PERM-001 Official Publication",
      created_at: now
    },
    {
      id: "log-task-communication-v10",
      knowledge_id: "kno-task-communication-v10",
      user_id: "user-admin-01",
      user_name: "Support Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-TASK-001 Official Publication",
      created_at: now
    },
    {
      id: "log-reports-performance-v10",
      knowledge_id: "kno-reports-performance-v10",
      user_id: "user-admin-01",
      user_name: "Operations Analytics Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-RPT-001 Official Publication",
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



