# MAN-B-INT-001 — Source Collection Report
## K SELECT Brand Portal & Admin: Intelligence & Insights (인텔리전스 & 인사이트)

---

## 1. Executive Summary

본 보고서는 **K SELECT Brand Portal** 및 **K SELECT Admin**의 인텔리전스, 운영 현황 요약 지표, RAG 기반 AI 지능형 검색 및 인사이트 자동화 엔진(Intelligence, Operational Dashboard, Grounded AI Ask Assistant & Insights Auto-Engine) 영역 전체를 대상으로 수행된 프로덕션 코드, UI 컴포넌트, 서버 액션, API 라우트, 데이터베이스 스키마, AI 가드레일 및 권한 감사의 최종 검증 결과물이다.

본 감사를 통해 확정된 핵심 도메인 아키텍처는 다음과 같다:

1. **3대 표면 분리 아키텍처 (Three-Surface Intelligence Architecture)**:
   - **Surface 1: Brand Portal Operational Intelligence Dashboard (`/portal`)**: 실시간 데이터베이스(상품 등록 완성도 `products`, 발주 현황 `purchase_orders`, 인보이스 정산 `supplier_invoices`, 문의 처리 `partner_inquiries`)를 결정론적(Deterministic) 쿼리로 집계하여 운영 통계 카드, 온보딩 체크리스트 및 상태 알림을 제공 (`VERIFIED ACTIVE`).
   - **Surface 2: Brand Portal Grounded AI Assistant (`/portal/ask`, `/portal/help/ask`)**: 공식 검증 및 게시된 브랜드 매뉴얼/지식 기반 문서(`knowledge_articles`)에 기반하여 RAG(Retrieval-Augmented Generation) 방식으로 사용자 질문에 실시간 답변 및 인용 출처(Source Citations)를 제공 (`VERIFIED ACTIVE`).
   - **Surface 3: K SELECT Admin Insights & Auto-Engine System (`/admin/insights/*`)**: 시장 리서치 자동화(`market-researcher`), 주제 평가(`topic-evaluator`), 클레임 팩트체크/팩트감사(`claim-auditor`), 초안 생성(`draft-generator`), 검토 큐(Moderation Queue), 저자/카테고리/자동화 규칙 관리를 수행하는 통합 인사이트 플랫폼 (`VERIFIED ACTIVE`).

2. **AI 검증 및 가드레일 아키텍처 (AI Guardrail & Fact-Check Architecture)**:
   - **Source Tier System**: 소스 출처를 `TIER_A` (공식 통계/정부/연구소), `TIER_B` (언론사/전문매체), `TIER_C` (블로그/커뮤니티), `SIGNAL` (시장 탐지 시그널)로 분리 관리 (`VERIFIED ACTIVE`).
   - **Claim Risk Audit Engine**: 추출된 주장(Claim)에 대해 `HIGH`, `MEDIUM`, `LOW` 리스크 등급을 평가하고, `PASS`, `DOWNGRADE`, `REWRITE`, `REMOVE`, `FAIL` 조치를 자동 수행 (`VERIFIED ACTIVE`).
   - **Claim Status Disambiguation**: 주장의 성격을 `VERIFIED` (검증된 사실), `INFERRED` (추론), `ESTIMATE` (추정치), `SIGNAL` (시장 시그널), `INTERNAL` (자사 내부 데이터/경험), `UNSUPPORTED` (근거 미흡)로 엄격히 구분 (`VERIFIED ACTIVE`).

3. **도메인 경계 및 정보 처리 원칙 (Domain Boundary & Information Principles)**:
   - **결정론적 지표 (Deterministic Metrics)**: 실시간 재무, 발주, 상품, 물류 지표는 AI 추정치를 사용하지 않고 DB 집계 쿼리로만 산출 (`VERIFIED ACTIVE`).
   - **Grounded AI (RAG Guarded)**: AI 정책 도우미는 외부 웹 검색이나 임의 추론을 배제하고, `is_published = true`인 지식 문서 데이터베이스만을 기반으로 답변 생성 (`VERIFIED ACTIVE`).
   - **인사이트 인간 검토 보장 (Human-in-the-Loop Moderation)**: 인사이트 오토 엔진이 자동 생성한 초안은 검토 큐(`insights_articles.status = 'DRAFT'`)에 진입하며, 어드민 승인 없이는 외부 게시되지 않음 (`VERIFIED ACTIVE`).

4. **미구현 시스템 경계 명시 (Not Implemented Boundaries)**:
   - **예측형 매출/수요 AI (Predictive ML Forecasting)**: 미구현 (`SYSTEM GAP / NOT IMPLEMENTED`).
   - **실시간 자동 다이내믹 프라이싱 (Automated Pricing Optimization)**: 미구현 (`SYSTEM GAP / NOT IMPLEMENTED`).
   - **자동 재고 배분 알고리즘 (Automated Stock Allocation Engine)**: 미구현 (`SYSTEM GAP / NOT IMPLEMENTED`).

---

## 2. Production Routes & URL Inventory

### 2.1 Brand Portal Routes (`portal.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/portal` | `authenticated` | `app/portal/page.tsx` | 브랜드 메인 대시보드 (운영 요약 카운드, 온보딩 체크리스트, 상품 완성도, 발주/정산/문의 지표) |
| `/portal/ask` | `authenticated` | `app/portal/ask/page.tsx` | 지능형 정책 도우미 에일리어스 라우트 (`BrandAskKSelectPage` 컴포넌트 렌더링) |
| `/portal/help/ask` | `authenticated` | `app/portal/help/ask/page.tsx` | Grounded AI Help Assistant 메인 라우트 (`AskKSelectView` 기반 실시간 정책 RAG Q&A) |

### 2.2 Admin System Routes (`admin.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/admin/insights` | `staff_roles` | `app/admin/insights/page.tsx` | 인사이트 시스템 오버뷰 대시보드 (발행 인사이트, 오토 엔진 실행 현황, 검토 큐 지표) |
| `/admin/insights/all` | `staff_roles` | `app/admin/insights/all/page.tsx` | 인사이트 라이브러리 전체 아티클 목록 (검색, 필터링, 게시 상태 관리) |
| `/admin/insights/[id]` | `staff_roles` | `app/admin/insights/[id]/page.tsx` | 인사이트 아티클 상세 / 에디터 및 클레임 감사 리포트 확인 |
| `/admin/insights/authors` | `staff_roles` | `app/admin/insights/authors/page.tsx` | 인사이트 저자 프로필 및 소속 관리 |
| `/admin/insights/automation-runs` | `staff_roles` | `app/admin/insights/automation-runs/page.tsx` | 오토 엔진 수집 및 생성 실행 이력 로그 |
| `/admin/insights/categories` | `staff_roles` | `app/admin/insights/categories/page.tsx` | 카테고리 및 태그 계층구조 관리 |
| `/admin/insights/queue` | `staff_roles` | `app/admin/insights/queue/page.tsx` | 오토 엔진 생성 아티클 검토 및 승인/반려 큐 |
| `/admin/insights/rules` | `staff_roles` | `app/admin/insights/rules/page.tsx` | 인사이트 자동 리서치 규칙 및 키워드 설정 |

---

## 3. Intelligence Architecture & Data Flow

```
[Brand Portal User]
       │
       ├──────► /portal (Dashboard) ────► Deterministic SQL Aggregation ──► Products, PO, Invoices, Inquiries
       │
       └──────► /portal/help/ask ───────► Grounded RAG Assistant Engine ──► Verified Knowledge DB Articles
                                                  │
                                                  ▼
                                       Embedding & Similarity Search
                                                  │
                                                  ▼
                                       Citations & Grounded Answer

[Admin System / Automation Engine]
       │
       ├──────► /admin/insights/* ──────► Editorial Management & Moderation Queue
       │
       └──────► Cron Daily Research ────► Auto-Engine Orchestrator
                                                  │
                                                  ├─► 1. Market Researcher (Source Tier A/B/C/SIGNAL)
                                                  ├─► 2. Topic Evaluator (Audience Relevance)
                                                  ├─► 3. Claim Auditor (Risk Level HIGH/MED/LOW & Action PASS/DOWNGRADE/REWRITE)
                                                  └─► 4. Draft Generator (Market Facts / Signals / K-Select Views)
```

---

## 4. Operational Classification Matrix

| Feature / Domain Surface | Classification | Underlying Mechanism / Tech Stack | Source of Truth |
| :--- | :--- | :--- | :--- |
| Brand Onboarding Checklist | `VERIFIED ACTIVE` | `evaluateProductRegistrationStatus` & DB query | `products`, `brands` |
| Operational KPI Cards | `VERIFIED ACTIVE` | SQL Aggregation (`COUNT`, `SUM`) | `purchase_orders`, `supplier_invoices`, `partner_inquiries` |
| Grounded AI Assistant (Ask) | `VERIFIED ACTIVE` | RAG, Vector/Keyword Search, Grounded Prompt | `knowledge_articles` (`is_published = true`) |
| Insights Editorial Library | `VERIFIED ACTIVE` | Supabase CRUD & Role ACL | `insights_articles`, `insights_categories` |
| Insights Auto-Engine Orchestrator | `VERIFIED ACTIVE` | Server-side Pipeline & Cron API | `lib/insights/auto-engine/*` |
| Claim Audit & Risk System | `VERIFIED ACTIVE` | Deterministic Rule & AI Claim Review | `insights_claims_audit` |
| Reader Feedback (V3) | `VERIFIED ACTIVE` | RLS Service Role Feedback Logging | `insights_article_feedback` |
| Predictive Sales ML | `SYSTEM GAP / NOT IMPLEMENTED` | None | N/A |
| Dynamic Auto Pricing | `SYSTEM GAP / NOT IMPLEMENTED` | None | N/A |
| Automatic Stock Allocation | `SYSTEM GAP / NOT IMPLEMENTED` | None | N/A |

---

## 5. System Gaps & Non-Implemented Features

본 감사를 통해 확인된 미구현/범위 외 기능 항목:

1. **머신러닝 기반 매출 및 주문 예측 (Predictive Demand ML)**:
   - 현재 대시보드 지표는 과거 및 현재의 누적/진행 상태 데이터를 결정론적으로 집계할 뿐, 향후 30일/90일 수요를 예측하는 ML 모델은 구현되어 있지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
2. **실시간 자동 가격 조정 (Dynamic Price Optimization Engine)**:
   - 환율, 수수료, 경쟁사 가격을 추적하여 자동으로 판매가를 변동시키는 알고리즘은 존재하지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
3. **자동재고 할당 알고리즘 (Automatic Inventory Allocation System)**:
   - 물류 센터 간 자동 재고 배치 지능형 알고리즘은 구현되지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).

---

## 6. Audit Conclusion & Source Validity

- 본 보고서에 포함된 모든 라우트, DB 테이블, 에러 처리 및 상태 구조는 `KSelectNetwork-Portal` 프로덕션 소스 코드 및 마이그레이션 파일(`0046_insights_v1_schema.sql` ~ `0053_insights_v3_feedback_service_role_rls.sql`)에 근거하여 직접 감사를 완료하였다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL SOURCE DOCUMENT**
