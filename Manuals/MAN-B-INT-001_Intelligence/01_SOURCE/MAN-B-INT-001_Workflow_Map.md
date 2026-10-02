# MAN-B-INT-001 — Workflow Map
## Intelligence & Insights Domain: End-to-End Operational Workflows

---

## 1. Overview of Core Workflows

본 문서는 **K SELECT Brand Portal** 및 **K SELECT Admin** 시스템 내 Grounded Knowledge Assistant 및 Insights Auto-Engine의 5대 핵심 워크플로우를 명확히 정의한다.

1. **Workflow 1: Brand Portal Grounded Knowledge Q&A & Policy Guidance** (포털 지능형 정책 질문 및 검증 출처 확인)
2. **Workflow 2: Admin Automated Market Research & Topic Evaluation** (시장 데이터 자동 스캔 및 6대 가중치 주제 평가)
3. **Workflow 3: Claim Risk Auditing & Content Layering** (클레임 리스크 감사, 안전 하향 및 4대 콘텐츠 레이어 초안 생성)
4. **Workflow 4: Editorial Moderation, Revision & Human Approval Gate** (에디토리얼 검토 큐, 수정 요청 및 인간 승인 발행)
5. **Workflow 5: Reader Usefulness Feedback Collection & Editorial Monitoring** (독자 피드백 수집 및 에디터 지식 모니터링)

---

## 2. Workflow 1: Brand Portal Grounded Knowledge Q&A & Policy Guidance

```
[Brand User] ──► Navigate to /portal/help/ask ──► Enter Policy Question ──► POST /api/knowledge/ask
                                                                                   │
                                                                                   ▼
                                                                     1. Security & Prompt Injection Check
                                                                                   │
                                                                                   ▼
                                                                     2. Audience Resolution (BRAND Scoped)
                                                                                   │
                                                                                   ▼
                                                                     3. Deterministic Matching Engine
                                                                        (is_published = true in DB)
                                                                                   │
                                                                                   ▼
                                                                     4. Render Direct Answer + Source Citations
```

- **Actor**: Brand Portal User (`authenticated` / Brand Membership)
- **Route**: `/portal/help/ask` (Alias: `/portal/ask`)
- **Preconditions**: 지식 문서 데이터베이스(`knowledge_articles`)에 `is_published = true`인 매뉴얼 존재.
- **Detailed Execution Steps**:
  1. 사용자가 Brand Portal 정책 도우미 페이지(`/portal/help/ask`)로 접속.
  2. 질문 입력창(`question`)에 플랫폼 운영, 브랜드/상품 등록, 수출 규제 등에 관한 질의 입력 (예: "상품이 연결된 브랜드를 삭제할 수 있나요?").
  3. 클라이언트 컴포넌트(`AskKSelectView`)가 `/api/knowledge/ask` 엔드포인트로 질문 전송.
  4. **보안 및 유효성 검증**: 프롬프트 인젝션 패턴(`checkPromptInjectionOrAttack`) 및 일반 잡담/범위 외 질문(`checkGeneralOutOfScope`) 감지 시 차단 및 안내문 반환. 쓰기 시도 감지 시 Read-Only 경고 플래그 반환.
  5. **서버 세션 청중 격리**: 사용자 권한에 따라 `audience = 'BRAND'`로 강제하여 비공개 사내 문서 조회 원천 차단.
  6. **결정론적 지식 매칭**: `is_published = true`인 브랜드 매뉴얼 중 토큰, 태그 및 도메인 인텐트 매칭을 통해 최적의 매뉴얼 후보 선정.
  7. **답변 및 출처 렌더링**: 매칭된 공식 문서에 근거한 직접 답변(`directAnswer`), 핵심 규칙 요약 불릿(`currentRuleBullets`), 공식 인용 출처 카드(`sources`) 및 관련 액션 링크(`actions`)를 클라이언트에 서빙.
  8. **No Fabrication 원칙**: 등록된 공식 지식 중 매칭 기준(스코어 50점 이상)을 충족하는 문서가 없는 경우, 임의 추론을 배제하고 즉시 "도움말 센터 둘러보기" 및 "1:1 문의하기(`support`)" 링크를 포함한 안내문 반환.

---

## 3. Workflow 2: Admin Automated Market Research & Topic Evaluation

```
[Daily Cron (05:00 ET)] ──► Trigger /api/cron/insights-daily-research ──► Market Researcher (Live HTTP Scan)
                                                                                  │
                                                                                  ▼
                                                                     Topic Evaluator (6 Weights)
                                                                                  │
                                                                                  ├─► Topic Score >= 80 & 5 Critical Conditions PASS?
                                                                                  │     ├─► YES: Passed Candidate Pool
                                                                                  │     └─► NO: Critical Reject (Logged)
                                                                                  │
                                                                                  ▼
                                                                     Quota Manager (NETWORK 3 + HUB 3)
                                                                                  │
                                                                                  └─► Less than 3? ➔ 2nd-Pass Research Triggered
```

- **Actor**: System Cron Job (`app/api/cron/insights-daily-research`) / Admin Staff (`/admin/insights`)
- **Route**: `/admin/insights/automation-runs`, `/admin/insights/rules`
- **Preconditions**: 마스터 룰(`insights_editorial_rules`) 활성화 상태.
- **Detailed Execution Steps**:
  1. 매일 오전 5시(ET) 크론에 의해 오토 엔진 오케스트레이터(`engine-runner.ts`) 자동 실행.
  2. **Market Researcher**: U.S. FDA MoCRA 포털, USITC 수출입 매트릭스, 관세청 무역통계, 뷰티 트레이드 모니터 및 검색 시그널에 실시간 HTTP 요청을 전송하여 소스 수집 및 출처 티어(`TIER_A`, `TIER_B`, `TIER_C`, `SIGNAL`) 분류.
  3. **Topic Evaluator**: 수집된 소스를 바탕으로 생성된 주제 후보(Topic Candidate)에 대해 6대 가중치(연관성25, 실행성25, 근거강도20, 시의성15, 독창성10, 전략적합성5) 채점 실행.
  4. **Quality Gate**: 총점 80점 이상 및 5대 필수 조건(Evidence Quality, Claim Validation, Duplicate Check, Audience Relevance, Actionability)을 모두 통과한 후보만 채택. 미달 후보는 사유와 함께 탈락 처리.
  5. **Quota Allocation (3+3 Rule)**: 채택된 주제를 NETWORK(최대 3건) 및 HUB(최대 3건)로 배분. 양 채널 모두에 유용한 주제는 Shared Core로 동시 배정.
  6. **2nd-Pass Research**: 1차 배분 결과 Network 또는 Hub 목표(3건)에 미달할 경우, 동일한 엄격한 품질 기준(>=80점)으로 2차 추가 리서치를 즉시 실행하여 보완. 통과 주제가 없을 경우 0건 생성이 정상 처리됨.

---

## 4. Workflow 3: Claim Risk Auditing & Content Layering

```
[Selected Candidates] ──► Claim Auditor (classifyClaimRisk)
                                   │
                                   ├─► HIGH: Regulation, %, $, Hard Causal Assertion ➔ Require Tier A/B
                                   │     └─► If source is Tier C/Signal: Auto DOWNGRADE to SIGNAL & Phrasing Moderated
                                   ├─► MEDIUM: Market Trend, Category Momentum ➔ Classified as SIGNAL
                                   └─► LOW: K SELECT Recommendations ➔ Classified as INTERNAL
                                   │
                                   ▼
                             Universal Critical Failures Check (Fabricated URL, False FDA Approval)
                                   │
                                   ▼
                             Draft Generator: Construct Dual-Language KO/EN & 4 Content Layers
                                   │
                                   ▼
                             Save to insights_articles (status = 'AI_DRAFT')
```

- **Actor**: Auto-Engine Orchestrator (`lib/insights/auto-engine/*`)
- **Target DB**: `insights_articles`, `insights_automation_runs`
- **Detailed Execution Steps**:
  1. 채택된 주제별 추출 문장에 대해 클레임 리스크 등급(`HIGH`, `MEDIUM`, `LOW`) 자동 분류.
  2. **HIGH RISK 클레임 감사**: 규제(FDA/MoCRA) 및 정량적 수치 문장이 `TIER_A`/`TIER_B` 소스로 검증되지 않은 경우, 주장을 안전하게 `SIGNAL`로 하향(`DOWNGRADE`)하고 표현을 완화("신호가 감지됨")하여 재작성.
  3. **헤드라인 리스크 감사**: 제목에 과장된 단속/압류("Crackdown", "Seizure") 단어가 포함되어 있고 1급 증거가 없는 경우, 실무 가이드라인 형태로 자동 재작성(`REWRITE`).
  4. **4대 콘텐츠 레이어 분리**:
     - `market_facts`: 공식 검증된 시장 사실 (`VERIFIED`)
     - `market_signals`: 시장 검색/소셜 모멘텀 (`SIGNAL` / `ESTIMATE`)
     - `k_select_views`: K SELECT 분석 관점 (`INFERRED`)
     - `k_select_actions`: 브랜드/바이어 실행 가이드 (`INTERNAL`)
  5. **초안 저장**: 생성된 페이로드를 `insights_articles` 테이블에 `status = 'AI_DRAFT'`로 영속화하고, 실행 통계 및 리스크 요약을 `insights_automation_runs`에 로깅.

---

## 5. Workflow 4: Editorial Moderation, Revision & Human Approval Gate

```
[Admin Editor] ──► Open /admin/insights/queue ──► Select AI Draft ──► Inspect Claim Risk Audit Summary
                                                                                │
                                                                                ├─► Needs Revision? ➔ Record insights_revision_requests
                                                                                │
                                                                                └─► Approved? ➔ Click [Publish Article]
                                                                                                      │
                                                                                                      ▼
                                                                                             status = 'PUBLISHED'
                                                                                             (Live on Portal / Hub)
```

- **Actor**: Admin Staff (`staff_roles` / Insight Editor)
- **Route**: `/admin/insights/queue` ➔ `/admin/insights/[id]`
- **Preconditions**: `status = 'AI_DRAFT'` 또는 `REVIEW` 상태인 아티클 존재.
- **Detailed Execution Steps**:
  1. 에디터가 검토 큐(`/admin/insights/queue`)에서 생성된 초안 목록 확인.
  2. 아티클 상세 화면(`/admin/insights/[id]`)으로 진입하여 본문 및 **Claim Risk Audit Summary** (High/Medium/Low 리스크 문장 수, 팩트체크 상태) 검토.
  3. `HIGH` 리스크 또는 주의 플래그(`NEEDS_ATTENTION`)가 설정된 항목의 근거 소스 확인.
  4. 수정이 필요한 경우 본문/헤드라인을 직접 수정하거나 수정 요청 내역(`insights_revision_requests`)을 작성하여 버전 이력(`insights_version_history`)에 기록.
  5. 검토 완료 후 **[Publish Article]** 버튼을 클릭하여 `status = 'PUBLISHED'`로 전환.
  6. 승인된 아티클만 Brand Portal 라이브러리 및 K SELECT Hub에 실시간 노출됨.

---

## 6. Workflow 5: Reader Usefulness Feedback Collection & Editorial Monitoring

```
[Reader / Brand User] ──► View Published Insight ──► Click [Helpful 👍] or [Not Helpful 👎]
                                                              │
                                                              ▼
                                                   POST /api/insights/feedback
                                                              │
                                                              ├─► HMAC-SHA256 Client Hash Generated
                                                              ├─► Duplicate Check within 24h
                                                              └─► Save to insights_reader_feedback
                                                              │
                                                              ▼
[Admin Staff] ──────────► Inspect Helpfulness Rate (%) on /admin/insights/[id]
```

- **Actor**: Reader (Brand User / Retailer User) & Admin Staff
- **Route**: Brand Knowledge View ➔ Admin Insights Article Detail (`/admin/insights/[id]`)
- **Preconditions**: 게시된 인사이트 아티클 노출.
- **Detailed Execution Steps**:
  1. 독자가 아티클 하단의 "이 인사이트가 유용했나요?" 피드백 영역에서 [도움됨(Helpful)] 또는 [도움안됨(Not Helpful)] 버튼 클릭.
  2. `/api/insights/feedback` API가 호출되며 서버에서 `INSIGHTS_FEEDBACK_HASH_SECRET` 환경변수를 사용하여 HMAC-SHA256 해시를 생성.
  3. 24시간 내 동일 클라이언트 해시 제출 여부를 검사하여 중복 투표를 방지하고 `insights_reader_feedback`에 저장.
  4. 어드민 에디터는 아티클 상세 화면에서 독자 유용성 만족도 비율(Helpful Rate %) 및 총 투표 수를 모니터링하여 향후 리서치 주제 선정 및 지식 개정에 참고.

---

## 7. Workflow Audit Summary

- 본 워크플로우 맵은 프로덕션 오토 엔진(`lib/insights/auto-engine/*`), 지능형 정책 도우미(`lib/knowledge/ask-engine.ts`) 및 피드백 엔드포인트(`app/api/insights/feedback/route.ts`)의 실제 구동 아키텍처와 100% 일치한다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL WORKFLOW MAP (R1 REVISED)**
