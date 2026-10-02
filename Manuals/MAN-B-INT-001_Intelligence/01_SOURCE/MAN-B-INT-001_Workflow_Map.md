# MAN-B-INT-001 — Workflow Map
## Intelligence & Insights Domain: End-to-End Operational Workflows

---

## 1. Overview of Core Workflows

본 문서는 **K SELECT Brand Portal** 및 **K SELECT Admin** 시스템 내 인텔리전스, 지능형 RAG Q&A 및 인사이트 오토 엔진 프로세스의 5가지 핵심 워크플로우를 명확히 정의한다.

1. **Workflow 1: Brand Portal Operational Intelligence Inspection** (대시보드 운영 현황 및 상품 등록 완성도 점검)
2. **Workflow 2: Grounded AI Help Search & Policy Q&A** (RAG 기반 지능형 정책 질문 및 답변 확인)
3. **Workflow 3: Admin Automated Market Research & Claim Auditing** (자동 시장 리서치 실행 및 클레임 리스크 감사)
4. **Workflow 4: Editorial Article Review, Moderation & Publishing** (인사이트 아티클 검토, 모더레이션 승인 및 최종 게시)
5. **Workflow 5: Reader Feedback Collection & Insights Optimization** (독자 피드백 수집 및 인사이트 지식 개선)

---

## 2. Workflow 1: Brand Portal Operational Intelligence Inspection

```
[Brand User Logged In] ──► Navigate to /portal ──► Load DB Real-time Metrics
                                                        │
                                                        ├─► Check Onboarding Checklist
                                                        ├─► Review Product Completeness (%)
                                                        ├─► Inspect Open PO & Unpaid Invoices
                                                        └─► Review Partner Support Inquiries
```

- **Actor**: Brand Portal User (`authenticated`)
- **Route**: `/portal`
- **Preconditions**: 로그인 성공 및 브랜드 권한 보유.
- **Detailed Execution Steps**:
  1. 사용자가 `/portal` 페이지로 접속.
  2. 시스템은 서버 사이드 및 클라이언트 쿼리를 통해 `brands`, `products`, `purchase_orders`, `supplier_invoices`, `partner_inquiries` 테이블 데이터를 결정론적으로 집계.
  3. **Onboarding Bar**: 온보딩 진행 단계 및 필수 제출 완료 여부 노출.
  4. **Product Registration Completeness**: `evaluateProductRegistrationStatus()` 결과에 따라 0-100% 진행률 프로그레스 바 표시. 미완성 항목 존재 시 직관적 툴팁 서빙.
  5. **Operational KPI Summary Cards**:
     - `pendingPoCount`: 승인 대기 중인 발주서 수.
     - `unpaidInvoiceSubtotal`: 정산 예정인 인보이스 미지급 잔액 합계 (`balance_due`).
     - `openInquiryCount`: 답변 대기 중인 고객/브랜드 문의 건수.
  6. 사용자는 각 카드를 클릭하여 해당 업무 라우터(`/portal/products`, `/portal/orders`, `/portal/finance`, `/portal/support`)로 즉시 이동.

---

## 3. Workflow 2: Grounded AI Help Search & Policy Q&A

```
[Brand User] ──► Navigate to /portal/help/ask ──► Input User Query ──► API /api/knowledge/ask
                                                                              │
                                                                              ▼
                                                                Vector/Keyword RAG Search
                                                                              │
                                                                              ▼
                                                                  Filter Published Articles
                                                                              │
                                                                              ▼
                                                              Generate Grounded Answer + Citations
```

- **Actor**: Brand Portal User (`authenticated`)
- **Route**: `/portal/help/ask` (Alias: `/portal/ask`)
- **Preconditions**: 지식 문서 데이터베이스에 `is_published = true` 상태인 아티클 존재.
- **Detailed Execution Steps**:
  1. 사용자가 지능형 정책 도우미 페이지(`/portal/help/ask`) 접속.
  2. 질문 입력창(`userQuery`)에 궁금한 브랜드 운영/입점 정책 질의 입력 (예: "브랜드 상표권 등록 서류 제출 기간이 어떻게 되나요?").
  3. `AskKSelectView` 컴포넌트가 `/api/knowledge/ask` 서버 엔드포인트로 POST 요청 전송.
  4. 서버 RAG 엔진은 `knowledge_articles` 테이블 중 게시 완료(`is_published = true`)된 문서를 대상으로 임베딩 및 키워드 유사도 검색 수행.
  5. 검색된 상위 컨텍스트(Context Excerpts)만을 프롬프트 바운더리로 지정하여 LLM 기반 Grounded Answer 작성. 외부 인터넷 정보 및 임의 추론은 거부 조치.
  6. 클라이언트 화면에 최종 답변(Markdown)과 함께 하단에 참고한 공식 지식 문서 출처 카드(`sourceCitations`)를 렌더링.
  7. 사용자는 출처 링크를 클릭하여 해당 지식 문서 전체 내용을 상세 페이지에서 확인 가능.

---

## 4. Workflow 3: Admin Automated Market Research & Claim Auditing

```
[Cron / Admin Trigger] ──► Trigger Orchestrator ──► Market Researcher (Tier A/B/C/SIGNAL)
                                                                 │
                                                                 ▼
                                                    Topic Evaluator (Audience Filter)
                                                                 │
                                                                 ▼
                                                    Claim Auditor (Risk Audit Engine)
                                                                 │
                                                                 ▼
                                                    Draft Generator ──► Save to Queue (DRAFT)
```

- **Actor**: System Cron Job (`app/api/cron/insights-daily-research`) / Admin Staff
- **Route**: `/admin/insights/automation-runs`, `/admin/insights/rules`
- **Preconditions**: 활성화된 오토 엔진 규칙(`insights_auto_rules.is_active = true`) 등록됨.
- **Detailed Execution Steps**:
  1. 정해진 크론 스케줄(예: 매일 오전 9시)에 따라 `insights-daily-research` API 실행.
  2. **Market Researcher**: 수집 키워드 기반으로 시장 데이터 및 뉴스 탐지. 소스 출처를 `TIER_A` (공식/정부), `TIER_B` (언론사), `TIER_C` (커뮤니티), `SIGNAL`로 분류.
  3. **Topic Evaluator**: 추출된 팩트/시그널이 K SELECT Network 브랜드 및 허브 운영자와 연관성이 있는지 타겟 적합도 평가 (`NETWORK` / `HUB` / `BOTH`).
  4. **Claim Auditor**: 포함된 핵심 문장에 대해 팩트체크 수행:
     - Claim Status 할당: `VERIFIED`, `INFERRED`, `ESTIMATE`, `SIGNAL`, `INTERNAL`, `UNSUPPORTED`.
     - Risk Level 평가: `HIGH` (과장/법적 위험), `MEDIUM` (단순 미확인), `LOW` (검증완료).
     - Auditor Action 조치: `PASS` (통과), `DOWNGRADE` (상태 하향), `REWRITE` (재작성), `REMOVE` (삭제), `FAIL` (탈락).
  5. **Draft Generator**: 검증된 팩트를 바탕으로 Market Facts, Market Signals, K-Select Views 3개 레이어 구조의 아티클 초안 생성.
  6. 생성된 초안을 `insights_articles` 테이블에 `status = 'DRAFT'` 상태로 저장하고 `insights_auto_runs`에 실행 이력 로그 수집.

---

## 5. Workflow 4: Editorial Article Review, Moderation & Publishing

```
[Admin Editor] ──► Open /admin/insights/queue ──► Select Draft Article ──► Review Claim Audit Report
                                                                                    │
                                                                                    ▼
                                                                     Edit Text / Fix High Risk Claims
                                                                                    │
                                                                                    ▼
                                                                     Click [Publish Article]
                                                                                    │
                                                                                    ▼
                                                                Status: PUBLISHED ➔ Live on Portal
```

- **Actor**: Admin Staff (`staff_roles`)
- **Route**: `/admin/insights/queue` ➔ `/admin/insights/[id]` ➔ `/admin/insights/all`
- **Preconditions**: `status = 'DRAFT'` 또는 `IN_REVIEW` 인 아티클 존재.
- **Detailed Execution Steps**:
  1. 어드민 에디터가 인사이트 검토 큐(`/admin/insights/queue`)로 이동.
  2. 오토 엔진이 생성하였거나 작성자가 제출한 대기 목록 아티클 선택.
  3. 상세 페이지(`/admin/insights/[id]`)에서 아티클 본문 및 우측/하단의 **Claim Risk Audit Summary** 확인.
  4. `HIGH` 리스크 주장이나 `UNSUPPORTED` 문장이 있는 경우 본문을 수정하거나 수동 팩트 재확인.
  5. 필요 시 카테고리, 저자, 피처드 표출 여부(`is_featured`), 읽기 시간 설정 업데이트.
  6. **게시 승인**: [Publish Article] 버튼 클릭 시 `status = 'PUBLISHED'` 및 `published_at = now()` 로 전환.
  7. 아티클이 인사이트 라이브러리 및 브랜드 포털 검색 대상에 즉시 실시간 공개됨.

---

## 6. Workflow 5: Reader Feedback Collection & Insights Optimization

```
[Brand Reader] ──► View Insight Article ──► Click Helpful [Yes / No] + Optional Comment
                                                              │
                                                              ▼
                                                   Save to insights_article_feedback
                                                              │
                                                              ▼
                                               Admin Review & Knowledge Optimization
```

- **Actor**: Brand Portal User / External Reader & Admin Staff
- **Route**: Brand Knowledge View ➔ Admin Insights Article Detail (`/admin/insights/[id]`)
- **Preconditions**: 게시된 인사이트 아티클 노출.
- **Detailed Execution Steps**:
  1. 브랜드 사용자가 인사이트 아티클을 읽은 후 하단의 "이 내용이 도움이 되었나요?" 피드백 컴포넌트에 참여.
  2. [도움됨(Yes)] 또는 [도움안됨(No)] 버튼 클릭 및 상세 피드백 텍스트 작성 후 제출.
  3. `insights_article_feedback` 테이블에 Service Role RLS를 통해 피드백 데이터 저장.
  4. 어드민 관리자는 아티클 상세 화면에서 독자 만족도 지표 및 피드백 텍스트를 모니터링.
  5. 부정 피드백 비율이 높은 문서는 내용을 보완하거나 최신 정책으로 갱신하는 지식 개선(Knowledge Optimization) 순환 수행.

---

## 7. Workflow Audit Summary

- 본 워크플로우 맵은 프로덕션 오토 엔진 아키텍처(`lib/insights/auto-engine/*`) 및 포털 RAG 서비스(`lib/knowledge/ask-assistant.ts`)의 실제 구동 순서와 100% 일치한다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL WORKFLOW MAP**
