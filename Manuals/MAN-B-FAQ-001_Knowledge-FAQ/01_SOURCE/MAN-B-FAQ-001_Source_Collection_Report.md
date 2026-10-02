# MAN-B-FAQ-001: Knowledge Center FAQ — Production Source Collection & Architecture Audit Report

- **문서 번호:** `MAN-B-FAQ-001-SRC-001-R1`  
- **문서 명칭:** Knowledge Center FAQ Architecture & Production Source Master Reference  
- **작성 일자:** 2026-10-02  
- **대상 시스템:** K SELECT NETWORK Portal (Brand Portal & Admin Console)  
- **책임 부서:** Brand Operations & Knowledge Architecture Desk (`Audience: BRAND, INTERNAL, ADMIN`)  
- **표준 토픽:** `전체 토픽 (Cross-Topic Knowledge Core)`  
- **검증 기준:** 실제 Production Codebase (`lib/knowledge/*`, `components/knowledge/*`, `app/portal/help/*`, `app/admin/knowledge/*`), Supabase DB (`knowledge_faqs`, `knowledge_items`, `knowledge_topics`), In-Memory Store (`lib/knowledge/store.ts`), 기발행 정본 매뉴얼  

---

## 1. 개요 및 감사 목적 (Executive Summary & Audit Purpose)

본 문서는 **K SELECT NETWORK Knowledge Center** 내 FAQ 시스템의 전체 아키텍처, 데이터 모델, 검색 및 토픽 매핑 엔진, 거버넌스 라이프사이클 및 현재 운영(Production) 환경에 배포된 **총 63개 공식 FAQ**의 전수 조사(Audit) 결과를 집대성한 정본(Canonical) Source of Truth 문서입니다.

향후 제작될 모든 Knowledge Manual FAQ 및 시스템 도움말 콘텐츠는 본 문서에서 규정한 도메인 경계, 검색 인덱싱 규칙, 소스 근거성 원칙 및 중복 방지 거버넌스 표준을 준수해야 합니다.

### 1.1 핵심 운영 현황 요약
- **전체 배포 FAQ 수:** `63개` (DB `knowledge_faqs` 테이블 및 메모리 스토어 동기화 완료)
- **발행 매뉴얼 연계 그룹:** 6개 그룹 (BRAND, ONBOARDING, PRODUCTS, ORDERS, REGULATORY, RETAIL)
- **주요 토픽 매핑:** 6개 활성 표준 토픽 (`topic-brand`, `topic-start`, `topic-product`, `topic-orders`, `topic-regulatory`, `topic-retail`)
- **Featured FAQ 수:** 총 26개 (각 매뉴얼별 3~5개 배정, 데이터 패턴 기반)
- **근거성 검증 결과:** 63개 전 항목 Published Manual 및 Production Code 1:1 근거 확인 완료 (`VERIFIED: 63 / 63`)
- **비인가/미지원 클레임:** `0건` (자동 PO 생성, 무조건 승인, 예측 AI 등 미지원 문구 배제)
- **미발행 FAQ 도메인:** 6개 도메인 (LOG, FIN, PERM, TASK, RPT, INT) → `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` 분류

---

## 2. FAQ 시스템 아키텍처 및 라우팅 토폴로지 (System Architecture & Routing Topology)

K SELECT Knowledge Center는 단일 정본 데이터베이스를 기반으로 어드민 관리 뷰와 브랜드 포털 헬프센터 뷰를 동기화합니다.

### 2.1 라우팅 및 컴포넌트 토폴로지
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   K SELECT KNOWLEDGE ARCHITECTURE                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
┌──────────────────────────────────────┐                         ┌──────────────────────────────────────┐
│       BRAND PORTAL HELP CENTER       │                         │       ADMIN KNOWLEDGE CENTER         │
├──────────────────────────────────────┤                         ├──────────────────────────────────────┤
│ • /portal/help                       │                         │ • /admin/knowledge                   │
│   (Help Center Main & Topic View)    │                         │   (Overview & Operations KPI)        │
│ • /portal/help/[slug]                │                         │ • /admin/knowledge/library           │
│   (Manual View & Related FAQs)       │                         │   (All Knowledge Items List)         │
│ • /portal/help/ask                   │                         │ • /admin/knowledge/topics-faq        │
│   (Ask K SELECT Grounded Search)     │                         │   (FAQ Candidate Review & Manage)    │
│ • components/knowledge/              │                         │ • /admin/knowledge/[id]              │
│   - help-center-main-view.tsx        │                         │   (Knowledge Detail & Asset Inspect) │
│   - help-center-detail-view.tsx      │                         │ • components/admin/knowledge/        │
│   - ask-kselect-view.tsx             │                         │   - topics-faq-view.tsx              │
└──────────────────────────────────────┘                         └──────────────────────────────────────┘
                   │                                                                 │
                   └────────────────────────────────┬────────────────────────────────┘
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       API LAYER & ENGINES                                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • /api/knowledge/faqs              : FAQ 조회 및 필터링 (audience, topic_id, kind, search)             │
│ • /api/knowledge/topics            : 활성 토픽 목록 및 매핑 모듈/키워드 제공                          │
│ • /api/knowledge/ask               : 질문 임베딩 및 그라운디드 답변 생성 엔진 (AskEngine)             │
│ • /api/admin/knowledge/faqs        : 어드민 FAQ 승인/반려/수정/후보 생성 API                           │
│ • lib/knowledge/faq-engine.ts      : 중복 검사 (Levenshtein), 후보 생성, 상태 전이 머신               │
│ • lib/knowledge/search.ts          : 한국어-영어 동의어 사전, 토큰 정규화, 가중치 랭킹 엔진           │
│ • lib/knowledge/topics.ts          : 모듈/키워드 기반 토픽 자동 분류기 (matchTopicForFaq)             │
│ • lib/knowledge/store.ts           : Supabase DB 연동 및 In-Memory Fallback Seed 스토어               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       DATABASE LAYER (SUPABASE)                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • public.knowledge_faqs            : FAQ 정본 레코드 (63 records)                                      │
│ • public.knowledge_items           : 발행 매뉴얼 정본 레코드 (6 published, 11 total)                   │
│ • public.knowledge_topics          : 10대 표준 토픽 분류표                                             │
│ • public.knowledge_relations       : 화면(Route) 및 매뉴얼 간 매핑 관계                               │
│ • public.knowledge_audit_logs      : 변경 이력 감사 로그                                               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 데이터베이스 스키마 및 모델 명세 (Database Schema & Models)

### 3.1 `knowledge_faqs` 테이블 컬럼 구조 (22 Columns)
| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | 고유 식별자 (예: `faq-brand-01`, `faq-prod-03`) |
| `portal_scope` | `TEXT` | `DEFAULT 'BRAND'` | 접근 포털 범위 (`BRAND`, `RETAILER`) |
| `topic_id` | `TEXT` | `REFERENCES knowledge_topics(id)` | 표준 토픽 ID (예: `topic-product`) |
| `source_knowledge_id`| `TEXT` | `REFERENCES knowledge_items(id)` | 원천 매뉴얼 ID (예: `kno-product-management-v10`) |
| `source_version` | `TEXT` | `NOT NULL` | 원천 매뉴얼 버전 (예: `v1.0`, `v1.1.0`) |
| `source_title` | `TEXT` | `NOT NULL` | 원천 매뉴얼 정식 국문 명칭 |
| `question_ko` | `TEXT` | `NOT NULL` | 국문 질문 |
| `question_en` | `TEXT` | `NOT NULL` | 영문 질문 |
| `answer_ko` | `TEXT` | `NOT NULL` | 국문 답변 (출처 섹션 인용 포함) |
| `answer_en` | `TEXT` | `NOT NULL` | 영문 답변 |
| `audience` | `TEXT[]` | `NOT NULL` | 열람 대상 (`["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"]`) |
| `status` | `TEXT` | `NOT NULL` | 거버넌스 상태 (`APPROVED`, `CANDIDATE`, `INACTIVE`) |
| `kind` | `TEXT` | `DEFAULT 'BOTH'` | 표시 종류 (`FAQ`, `SUGGESTED_QUESTION`, `BOTH`) |
| `display_order` | `INTEGER` | `DEFAULT 0` | 매뉴얼 내 정렬 순서 (1부터 오름차순) |
| `is_featured` | `BOOLEAN` | `DEFAULT FALSE` | 주요 Featured FAQ 여부 |
| `generated_by` | `TEXT` | `DEFAULT 'MANUAL'` | 생성 주체 (`MANUAL`, `AI`) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | 레코드 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | 최근 수정 일시 |
| `reviewed_at` | `TIMESTAMPTZ` | `NULLABLE` | 심사 승인 일시 |
| `reviewed_by` | `TEXT` | `NULLABLE` | 심사 승인자 ID |
| `review_note` | `TEXT` | `NULLABLE` | 심사 코멘트 |
| `impact_reason`| `TEXT` | `NULLABLE` | 개정/등록 사유 |

---

## 4. Featured FAQ 모델 분석 (Featured Model Classification)

- **검증 결과**:
  - `knowledge_faqs.is_featured`는 단순 `BOOLEAN` 컬럼입니다.
  - 데이터베이스 스키마 상에 매뉴얼당 개수를 강제하는 DB 트리거/제약조건(Check Constraint)은 존재하지 않습니다.
  - 애플리케이션 코드 상에서도 인위적인 clamp 로직이 없으며, `is_featured === true`인 레코드가 UI 상단 뱃지와 함께 우선 노출됩니다.
  - 현재 운영 데이터(Production DB) 상의 배정 현황:
    * `kno-brand-policy-v10`: 3개
    * `kno-onboarding-guide-v10`: 5개
    * `kno-product-management-v10`: 5개
    * `kno-order-management-v10`: 5개
    * `kno-regulatory-compliance-v11`: 4개
    * `kno-retail-applications-v10`: 4개
    * **총 Featured FAQ 수: 26개**
  - 따라서 `매뉴얼당 3~5개 Featured FAQ`는 시스템 강제 제약이 아니라 **운영 에디토리얼 정책(Editorial Policy) 및 현행 데이터 패턴(Data Pattern)**으로 분류합니다.

---

## 5. 검색 및 매칭 엔진 구조 (Search Engine Architecture)

`lib/knowledge/search.ts`에 구현된 프로덕션 검색 엔진은 다음 4단계 파이프라인으로 동작합니다:

### 5.1 1단계: 보안 인가 및 필터링 (Security & Scope Filtering)
- `isAuthorizedForAudience(userContext, item)`에 의한 접근 통제 (Deny-by-default).
- Guide 모드 시 `PUBLISHED` 상태 및 비-draft 버전만 후보군으로 추출.

### 5.2 2단계: 쿼리 정규화 및 어휘 확장 (Normalization & Synonym Expansion)
- `normalizeQueryString`: 특수문자 제거, 공백 축약, 영문 소문자화.
- `expandQueryAliasesAndTypos`: `ALIAS_DICTIONARY` 기반 한/영 동의어 및 축약어 확장 (INSIGHTS, SIMULATOR, MANUAL, APPROVE, REVISION, REVIEW, AUTOMATION, PUBLISHED, SYSTEM_RULE, SOP, POLICY, FAQ, DEFINITION, BRAND, RETAILER, OUTDATED).

### 5.3 3단계: 다층 스코어링 엔진 (Multi-Tier Scoring Algorithm)
- **Natural Language Intent Boosting**:
  * 사전 정의된 구어체 패턴 매칭 시 `+120` 또는 `+150` 점수 부스팅.
- **Canonical & Alias Term Match**:
  * `titleText` 포함 시 `+80`
  * `item.type` 일치 시 `+70`
  * `itemTags` 포함 시 `+60`
  * `item.category` 일치 시 `+50`
  * `summaryText` 포함 시 `+40`
- **Expanded Token Match**:
  * `titleText` 포함 시 `+40`
  * `itemTags` 포함 시 `+35`
  * `summaryText` 포함 시 `+20`
  * `contentText` 포함 시 `+10`
- **Fuzzy String Matching (Levenshtein Distance)**:
  * 3글자 이상 단어에 대해 `calculateLevenshtein(w, target) <= 2` 만족 시 `+50`.
- **Context & Type Priority Hierarchy**:
  * Guide 모드 시 라우트 일치 `+25`
  * 콘텐츠 타입 가중치: `MANUAL (+20)`, `SOP (+15)`, `POLICY (+15)`, `RULE (+15)`, `GUIDE (+10)`, `FAQ (+10)`.

### 5.4 4단계: 정렬 및 UI 제공 (Sorting & Presentation)
- 계산된 종합 점수 내림차순 정렬 후 최종 검색 결과 및 연관 질문 반환.

---

## 6. 도메인 경계성 및 소유권 검증 (Domain Ownership & Cross-Domain Isolation)

| 도메인 | 원천 정본 매뉴얼 | 매핑 토픽 | 배포 FAQ 수 | 핵심 비즈니스 경계 원칙 (Authoritative Boundaries) |
| :--- | :--- | :--- | :---: | :--- |
| **BRAND** | `kno-brand-policy-v10` | `topic-brand` | 5 | 브랜드 승인이 제품/발주 승인을 대신하지 않음 |
| **ONB** | `kno-onboarding-guide-v10` | `topic-start` | 9 | 회사 온보딩 완료와 브랜드 생성은 분리된 단계임 |
| **PROD** | `kno-product-management-v10`| `topic-product` | 14 | 바코드 유효성 검증과 인허가 승인은 별개 단계임 |
| **REG** | `kno-regulatory-compliance-v11`| `topic-regulatory` | 12 | AI INCI 전성분 번역은 규제 서류 업로드를 대체하지 않음 |
| **RET** | `kno-retail-applications-v10`| `topic-retail` | 11 | **리테일 입점 승인은 후속 발주(PO)를 자동 생성하지 않음** |
| **ORD** | `kno-order-management-v10` | `topic-orders` | 12 | **발주(PO) 승인/출고는 실물 입고검수(LOG) 및 정산(FIN)과 분리됨** |
| **LOG** | *(미발행: MAN-B-LOG-001)* | `topic-logistics` | 0 | `ARRIVED ≠ RECEIVED ≠ COMPLETED` (물류 도착과 입고 검수 분리) |
| **FIN** | *(미발행: MAN-B-FIN-001)* | `topic-finance` | 0 | `Shipping Complete ≠ Settlement Complete` (출고와 대금 정산 분리) |
| **PERM** | *(미발행: MAN-B-PERM-001)* | `topic-company` | 0 | PERM 6대 주 담당자 라우팅과 TASK 1:1 케이스 티켓 분리 |
| **TASK** | *(미발행: MAN-B-TASK-001)* | `topic-company` | 0 | 동적 1:1 문의 티켓 라이프사이클과 내부 일감 스키마 분리 |
| **RPT** | *(미발행: MAN-B-RPT-001)* | `topic-marketing` | 0 | 리포트 조회는 과거 집계 데이터 기반이며 정책 승인 기능 없음 |
| **INT** | *(미발행: MAN-B-INT-001)* | `topic-marketing` | 0 | 인텔리전스 분석 리포트는 참고 지표이며 자동 계약을 체결하지 않음 |

---

## 7. 미발행 FAQ 도메인 관리 (Pending FAQ Domains)

다음 6개 도메인은 현재 정본 매뉴얼 배포 대기 중이므로 FAQ가 0건으로 유지됩니다:
- `LOG` (물류·배송)
- `FIN` (정산·재무)
- `PERM` (권한·사용자 관리)
- `TASK` (할 일·소통)
- `RPT` (리포트·분석)
- `INT` (인텔리전스)

> **거버넌스 원칙**:
> `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION`으로 분류하며, 상위 매뉴얼의 승인 및 배포가 완료된 후에만 정본 소스 기반으로 FAQ를 순차 발행합니다.

---

## 8. 시스템 갭 및 미구현 항목 (System Gaps & Not Implemented)

### 8.1 SYSTEM GAP (구조는 존재하나 운영 기능 보완 필요)
1. **미발행 6개 도메인의 FAQ 부재**: 상위 매뉴얼 발행 완료 후 순차 연계 필요.
2. **다국어(일어/중어) 사전 확장**: 현재 한국어 및 영어 동의어 사전만 탑재됨.

### 8.2 NOT IMPLEMENTED (현재 구현되지 않은 기능)
1. **어드민 FAQ 다중 일괄 선택/태깅 UI**: 현재 단건 등록 및 API 기반 관리만 지원.
2. **사용자 직접 FAQ 작성/제출 기능**: 파트너사는 1:1 문의를 통해서만 질의 가능하며 FAQ 직접 등록은 관리자 전용임.

### 8.3 PENDING CONTENT (아키텍처 지원되나 콘텐츠 대기 중)
1. LOG, FIN, PERM, TASK, RPT, INT 전용 FAQ 세트.

---

## 9. 결론 및 향후 거버넌스 준수 서약

1. **Grounded First**: FAQ는 독립된 상상이나 계획이 아니며 오직 정본 매뉴얼에 기술된 사실만을 인덱싱한다.
2. **Boundary Integrity**: 도메인 간 자동 전이나 침범을 배제하고 단일 진실 공급원(Single Source of Truth) 원칙을 유지한다.
3. **No Absolute Claims**: 기술적으로 검증되지 않은 과장된 표현을 사용하지 않는다.

---
*End of MAN-B-FAQ-001_Source_Collection_Report.md*
