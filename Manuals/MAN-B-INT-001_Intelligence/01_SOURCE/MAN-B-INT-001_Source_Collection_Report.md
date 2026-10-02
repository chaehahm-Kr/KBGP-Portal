# MAN-B-INT-001 — Source Collection Report
## K SELECT Brand Portal & Admin: Intelligence & Insights (인텔리전스 & 인사이트)

---

## 1. Executive Summary

본 보고서는 **K SELECT Brand Portal** 및 **K SELECT Admin**의 인텔리전스, 지능형 정책 도우미(Grounded Knowledge Assistant) 및 인사이트 자동화 엔진(Insights Auto-Engine System) 영역 전체를 대상으로 수행된 프로덕션 코드, UI 컴포넌트, 서버 액션, API 라우트, 데이터베이스 스키마, 가드레일 및 권한 감사의 최종 검증 결과물이다.

본 감사를 통해 확정된 핵심 도메인 아키텍처 및 경계는 다음과 같다:

1. **실제 프로덕션 인텔리전스 표면 (Verified Production Intelligence Surfaces)**:
   - **Surface 1: Brand Portal Grounded Knowledge Assistant (`/portal/help/ask`, `/portal/ask`)**: 공식 검증 및 게시된 지식 기반 문서(`knowledge_articles`)를 대상으로 결정론적 토큰/인텐트 매칭 및 규칙 기반 검색을 수행하여 실시간 안내와 공식 인용 출처(`sources`)를 제공 (`VERIFIED ACTIVE`).
   - **Surface 2: K SELECT Admin Insights & Auto-Engine System (`/admin/insights/*`)**: 시장 리서치 자동화(`market-researcher`), 6대 가중치 기반 주제 평가(`topic-evaluator`), 일일 3+3 쿼터 관리(`quota-manager`), 클레임 리스크 감사 및 안전 하향(`claim-auditor`), 다국어 초안 생성(`draft-generator`), 에디토리얼 검토 큐(Moderation Queue), 저자/카테고리/마스터 룰 관리, 독자 피드백 수집(`insights_reader_feedback`)을 수행하는 통합 인사이트 플랫폼 (`VERIFIED ACTIVE`).
   - **포털 대시보드(`portal`) 분리 확인**: 포털 대시보드의 KPI 카드, 온보딩 체크리스트, 조치 필요 알림은 순수 운영 및 실적 집계 데이터(`RPT` / `ONB` 도메인)이며, 인텔리전스 영역에 포함되지 않음 (`NOT INTELLIGENCE / OPERATIONAL BASELINE`).

2. **AI 검증 및 가드레일 아키텍처 (Guardrail & Fact-Check Architecture)**:
   - **Source Tier System**: 소스 출처를 `TIER_A` (공식 통계/정부/연구소), `TIER_B` (언론사/전문매체), `TIER_C` (블로그/커뮤니티), `SIGNAL` (시장 탐지 시그널)로 분리 관리 (`VERIFIED ACTIVE`).
   - **Claim Risk Audit Engine**: 추출된 주장(Claim)에 대해 `HIGH` (규제/MoCRA/정확한 수치/인과 보장), `MEDIUM` (시장 트렌드), `LOW` (K SELECT 권고사항) 등급을 평가하고, `PASS`, `DOWNGRADE` (신뢰도 미흡 시 SIGNAL로 하향 및 완화된 어조 변환), `REWRITE` (헤드라인 리스크 수정), `REMOVE`, `FAIL` 조치를 수행 (`VERIFIED ACTIVE`).
   - **Claim Status Disambiguation**: 주장의 성격을 `VERIFIED` (검증된 사실), `INFERRED` (추론), `ESTIMATE` (추정치), `SIGNAL` (시장 시그널), `INTERNAL` (자사 내부 운영 데이터/경험), `UNSUPPORTED` (근거 미흡)로 구분 (`VERIFIED ACTIVE`).

3. **도메인 경계 및 정보 처리 원칙 (Domain Boundary & Information Principles)**:
   - **INT ↔ RPT 경계**: RPT(Reports)는 과거/현재의 결정론적 운영·재무 지표를 집계하며, INT(Intelligence)는 시장 리서치, 통관/규제 준수 인텔리전스, Grounded Knowledge Q&A, 인사이트 분석 아티클을 전담 (`VERIFIED ACTIVE`).
   - **INT ↔ FAQ / KNOWLEDGE 경계**: Knowledge Center(`knowledge_articles`)는 공식 매뉴얼/정책 원문을 관리하고, FAQ(`faqs`)는 정형화된 Q&A를 제공하며, Ask Assistant(`/portal/help/ask`)는 Knowledge 문서를 검색/인용하여 답변을 제공하고, Insights(`insights_articles`)는 심층 시장 분석 아티클을 제공함 (`VERIFIED ACTIVE`).
   - **인사이트 인간 검토 게이트 (Human-in-the-Loop Moderation)**: 오토 엔진이 자동 생성한 초안은 반드시 검토 큐(`insights_articles.status = 'AI_DRAFT'`)에 진입하며, 어드민 승인 없이는 외부 게시되지 않음 (`VERIFIED ACTIVE`).
   - **독자 피드백 경계**: `insights_reader_feedback`은 독자의 유용성 평가(`HELPFUL` / `NOT_HELPFUL`)를 수집하여 에디터 분석 지표로 제공하며, 모델을 자동 재학습(Retraining)하거나 콘텐츠를 자동 변형하지 않음 (`VERIFIED ACTIVE`).

4. **미구현 시스템 경계 명시 (Not Implemented Boundaries)**:
   - **머신러닝 기반 수요/매출 예측 (Predictive Demand ML)**: 미구현 (`SYSTEM GAP / NOT IMPLEMENTED`).
   - **실시간 자동 다이내믹 프라이싱 (Automated Pricing Optimization)**: 미구현 (`SYSTEM GAP / NOT IMPLEMENTED`).
   - **자동 재고 배분 알고리즘 (Automated Stock Allocation Engine)**: 미구현 (`SYSTEM GAP / NOT IMPLEMENTED`).
   - **인간 개입 없는 전자동 외부 발행 (Fully Autonomous Unreviewed Publishing)**: 미구현 및 정책상 금지 (`NOT IMPLEMENTED / STRICTLY BLOCKED`).
   - **피드백 기반 AI 자동 파라미터 재학습 (Automated Feedback Retraining)**: 미구현 (`NOT IMPLEMENTED`).

---

## 2. Production Routes & URL Inventory

### 2.1 Brand Portal Routes (`portal.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/portal/help/ask` | `authenticated` | `app/portal/help/ask/page.tsx` | Grounded Knowledge Assistant 메인 라우트 (`AskKSelectView` 기반 정책 검색 및 공식 출처 인용) |
| `/portal/ask` | `authenticated` | `app/portal/ask/page.tsx` | 지능형 정책 도우미 에일리어스 라우트 (`BrandAskKSelectPage` 컴포넌트 렌더링) |

*(참고: `/portal` 메인 대시보드는 `RPT` / `ONB` 도메인의 운영 현황 집계 화면으로 분류됨)*

### 2.2 Admin System Routes (`admin.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/admin/insights` | `staff_roles` | `app/admin/insights/page.tsx` | 인사이트 시스템 오버뷰 대시보드 (발행 지표, 실행 통계, 검토 큐 요약) |
| `/admin/insights/all` | `staff_roles` | `app/admin/insights/all/page.tsx` | 인사이트 라이브러리 전체 아티클 목록 (검색, 필터링, 게시 상태 관리) |
| `/admin/insights/[id]` | `staff_roles` | `app/admin/insights/[id]/page.tsx` | 인사이트 아티클 상세 / 에디터 및 클레임 감사 리포트 확인 |
| `/admin/insights/queue` | `staff_roles` | `app/admin/insights/queue/page.tsx` | 오토 엔진 생성 아티클 검토 및 승인/반려 큐 |
| `/admin/insights/rules` | `staff_roles` | `app/admin/insights/rules/page.tsx` | 마스터 에디토리얼 룰, 스코어 가중치 및 일일 쿼터 설정 |
| `/admin/insights/automation-runs` | `staff_roles` | `app/admin/insights/automation-runs/page.tsx` | 오토 엔진 수집 및 생성 실행 이력 로그 |
| `/admin/insights/categories` | `staff_roles` | `app/admin/insights/categories/page.tsx` | 카테고리 및 분류 관리 |
| `/admin/insights/authors` | `staff_roles` | `app/admin/insights/authors/page.tsx` | 저자 프로필 및 소속 관리 |

---

## 3. Intelligence Architecture & Data Flow

```
[Brand Portal User]
       │
       └──────► /portal/help/ask ───────► Deterministic Grounded Matching Engine (lib/knowledge/ask-engine.ts)
                                                   │
                                                   ├─► 1. Security Check (Prompt Injection & Out-of-Scope Defense)
                                                   ├─► 2. Audience Resolution (Deny-by-Default / BRAND Scoped)
                                                   ├─► 3. Filter Published Articles (is_published = true)
                                                   ├─► 4. Token & Domain Intent Matching
                                                   └─► 5. Grounded Direct Answer + Official Source Citations

[Admin System / Auto-Engine Pipeline]
       │
       ├──────► /admin/insights/* ──────► Editorial Control Center & Moderation Queue
       │
       └──────► Cron Daily Research ────► Auto-Engine Orchestrator (lib/insights/auto-engine/engine-runner.ts)
                                                   │
                                                   ├─► 1. Market Researcher (Live HTTP Scan: FDA, USITC, Customs, Trade Feeds)
                                                   ├─► 2. Topic Evaluator (Score 0-100 on 6 Weights; Quality Gate >= 80)
                                                   ├─► 3. Quota Manager (Target: NETWORK 3 + HUB 3; Shared Core Allocation)
                                                   ├─► 4. 2nd-Pass Research (Triggered if Network/Hub < 3)
                                                   ├─► 5. Claim Auditor (Classify Risk HIGH/MED/LOW; Downgrade & Rewrite)
                                                   ├─► 6. Draft Generator (Dual-Language KO/EN, 4 Content Layers, Visuals)
                                                   └─► 7. Save to DB (status = 'AI_DRAFT' ➔ Strict Human Approval Gate)
```

---

## 4. Auto-Engine Functional Breakdown

| Pipeline Stage | Module / Component | Classification | Operational Behavior & Boundaries |
| :--- | :--- | :--- | :--- |
| **Market Research** | `market-researcher.ts` | `AUTOMATED` | FDA MoCRA, USITC, 관세청, 뷰티 트레이드 피드 등 실제 HTTP 요청을 통한 출처 스캔 및 후보 수집 |
| **Topic Evaluation** | `topic-evaluator.ts` | `AUTOMATED` | 6대 가중치(연관성25, 실행성25, 근거20, 시의성15, 독창성10, 적합성5)로 0-100점 채점; 80점 이상 및 5대 필수조건 통과 시 채택 |
| **Quota Management** | `quota-manager.ts` | `AUTOMATED` | 채택된 주제를 NETWORK(최대 3개) 및 HUB(최대 3개)로 배분; 양 채널 모두 유용한 주제는 Shared Core로 공유 |
| **2nd-Pass Research** | `market-researcher.ts` | `AUTOMATED` | 1차 평가 후 채널별 3개 미달 시 동일 품질 기준(>=80점)으로 2차 추가 리서치 실행 |
| **Claim Risk Audit** | `claim-auditor.ts` | `SYSTEM ASSISTED` | 핵심 문장의 리스크(HIGH/MED/LOW) 분류, 소스 티어 검증, 허위 규제 주장 검출, 완화된 어조(SIGNAL)로 자동 안전 하향 |
| **Draft Generation** | `draft-generator.ts` | `AUTOMATED` | 한/영 병렬 제목, 요약문, 4대 콘텐츠 레이어(Fact, Signal, View, Action), 추천 비주얼 규격 생성 |
| **Editorial Review** | `/admin/insights/queue` | `HUMAN REVIEW` | 생성된 초안(`AI_DRAFT`)을 에디터가 검토, 리스크 요약 확인, 수정 요청(`insights_revision_requests`) |
| **Publishing Gate** | `/admin/insights/[id]` | `HUMAN REVIEW` | 에디터의 명시적 승인(`Publish Article`) 클릭 시에만 `PUBLISHED`로 전환되어 라이브 배포 |

---

## 5. Claim Risk Audit & Fact Grounding Specification

### 5.1 Claim Definition & Extraction
아티클 내 포함된 모든 사실적 서술, 규제 준수 요건, 정량적 수치(%, $), 시장 트렌드 및 권고사항 문장을 Claim으로 정의하여 `claims` (JSONB)에 저장함.

### 5.2 Risk Classification & Source Tier Rules
- **HIGH RISK**: 규제(FDA/MoCRA/CBP), 법적 의무, 강한 인과 표현("보장", "무조건"), 정확한 금액($) 및 비율(%).
  - **검증 규칙**: 반드시 `TIER_A` (정부/공식기관) 또는 `TIER_B` (공인 언론) 출처가 뒷받침되어야 함. 미충족 시 `SIGNAL`로 상태가 자동 하향(Downgrade)되며 완화된 어조("신호가 감지됨")로 자동 수정됨.
- **MEDIUM RISK**: 카테고리 트렌드, 검색 관심도 증가, 진열대 확장 등 시장 모멘텀.
  - **검증 규칙**: 검색/소셜 시그널 기반 시 `SIGNAL` 상태로 분류됨.
- **LOW RISK**: K SELECT 플랫폼 내부 운영 가이드, 실무 체크리스트 및 추천 플레이북.
  - **검증 규칙**: `INTERNAL` 상태 및 `K_SELECT_RECOMMENDATION` 유형으로 분류됨.

### 5.3 Universal Critical Failures Detection
1. **Fabricated Source Check**: 유효하지 않거나 위조된 URL 검출 시 실패 처리.
2. **Regulatory Overstatement Check**: 단순 시설 등록(Facility Registration)을 FDA 승인(FDA Approval/Certification)으로 과장한 경우 검출 및 차단.
3. **False Causal Claim Check**: 검증되지 않은 수익 보장("50% 마진 보장") 주장 검출 및 차단.
- 검출 시 `fact_check_status = 'NEEDS_ATTENTION'` 플래그가 설정되어 에디터에게 주의 경고를 전달함.

---

## 6. Reader Usefulness Feedback Specification

- **저장 테이블**: `public.insights_reader_feedback`
- **수집 방식**: 익명 독자의 유용성 평가(`HELPFUL` / `NOT_HELPFUL`) 버튼 클릭.
- **보안 및 중복 방지**: 서버 환경변수(`INSIGHTS_FEEDBACK_HASH_SECRET`) 기반 HMAC-SHA256 단방향 해시(`client_hash`)를 생성하여 24시간 내 중복 제출을 방지함. 원본 IP 및 User-Agent는 저장하지 않음.
- **활용 범위**: 에디터의 아티클 유용성 모니터링 지표로만 활용되며, AI 모델을 자동 재학습하거나 아티클을 자동 변형하지 않음.

---

## 7. Multi-Channel Publishing & 3+3 Target Rule

- **K SELECT Network (`NETWORK`)**: 한국 화장품 브랜드사 대상. 미국 수출 규제, FOB 가격 전략, 물류 및 패키징 준수 가이드 제공.
- **K SELECT Hub (`HUB`)**: 미국 독립 뷰티 유통/스토어 바이어 대상. 매장 마진 구조, 4FT K-Beauty 진열대 배치, POS 안내문, 고객 전환율 가이드 제공.
- **3+3 Target Quota Rule**: 일일 목표 생성량은 NETWORK 최대 3건, HUB 최대 3건임. 두 타겟 모두에게 유용한 고품질 주제는 중복 패널티 없이 양 채널에 'Shared Core'로 동시 배정됨.
- **품질 우선 원칙 (0 Draft Day)**: 채점 기준(Topic Score >= 80점) 및 필수 조건을 통과하는 주제가 없는 경우 당일 생성량이 0건이 되는 것이 정상 동작임.

---

## 8. Database Tables Inventory & Usage Classification

| Table Name | Schema Migration | Usage Classification | Operational Description |
| :--- | :--- | :--- | :--- |
| `insights_articles` | `0046`, `0047`, `0048`, `0049` | `ACTIVE` | 인사이트 아티클 마스터 저장소 (한/영 본문, JSONB `claims`, `claim_risk_summary`, `content_layers`, `research_brief` 포함) |
| `insights_categories` | `0047` | `ACTIVE` | 인사이트 카테고리 분류 (U.S. MARKET ENTRY, RETAIL TRENDS, CONSUMER INSIGHTS, COMPLIANCE & LEGAL) |
| `insights_authors` | `0047` | `ACTIVE` | 저자 프로필 및 소속 부서 관리 |
| `insights_editorial_rules` | `0047`, `0051` | `ACTIVE` | 마스터 에디토리얼 룰, 점수 가중치, 일일 쿼터 및 인간 승인 필수 플래그 관리 |
| `insights_automation_runs` | `0047`, `0048`, `0049` | `ACTIVE` | 오토 엔진 실행 이력, 수집 출처 수, 품질 지표 및 실행 상태 로그 |
| `insights_reader_feedback` | `0051`, `0052`, `0053` | `ACTIVE` | HMAC-SHA256 중복 방지 기반 익명 독자 유용성 피드백 수집 |
| `insights_revision_requests` | `0047` | `ACTIVE` | 아티클 내부 수정 요청 및 처리 상태 관리 |
| `insights_version_history` | `0047` | `ACTIVE` | 아티클 스냅샷 버전 변경 이력 추적 |
| `insights_claims_audit` | *(N/A - Embedded)* | `EMBEDDED JSONB` | 독립 테이블이 아니며, `insights_articles.claims` 및 `claim_risk_summary` JSONB 컬럼에 내장 관리됨 |
| `insights_auto_rules` | *(Legacy Ref)* | `REPLACED` | `insights_editorial_rules`로 통합 대체됨 |
| `insights_auto_runs` | *(Legacy Ref)* | `REPLACED` | `insights_automation_runs`로 통합 대체됨 |

---

## 9. System Gaps & Non-Implemented Features

1. **머신러닝 기반 매출 및 주문 예측 (Predictive Demand ML)**:
   - 과거/현재의 누적 데이터를 결정론적으로 집계할 뿐, 머신러닝 기반 수요 예측 모델은 구현되어 있지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
2. **실시간 자동 가격 조정 (Dynamic Price Optimization Engine)**:
   - 경쟁사 가격 추적 및 자동 판매가 변동 알고리즘은 존재하지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
3. **자동재고 할당 알고리즘 (Automatic Inventory Allocation System)**:
   - 물류 센터 간 자동 재고 배치 알고리즘은 구현되지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
4. **인간 개입 없는 전자동 외부 발행 (Fully Autonomous Publishing)**:
   - 모든 오토 엔진 생성물은 `AI_DRAFT`로 저장되며, 에디터의 수동 승인이 필수로 강제됨 (`NOT IMPLEMENTED / STRICTLY BLOCKED`).
5. **독자 피드백 기반 자동 모델 재학습 (Automated Feedback Retraining)**:
   - 수집된 피드백은 에디터 확인용 통계로만 집계되며, 모델 파라미터를 자동 재학습하지 않음 (`NOT IMPLEMENTED`).

---

## 10. Audit Conclusion & Source Validity

- 본 보고서는 프로덕션 코드(`lib/knowledge/ask-engine.ts`, `lib/insights/auto-engine/*`, `app/api/insights/*`) 및 데이터베이스 마이그레이션(`0046_...sql` ~ `0053_...sql`)에 기반하여 철저히 검증 및 정정되었다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL SOURCE DOCUMENT (R1 REVISED)**
