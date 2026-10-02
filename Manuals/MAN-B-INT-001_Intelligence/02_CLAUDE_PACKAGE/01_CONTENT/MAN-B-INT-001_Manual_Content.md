# MAN-B-INT-001: Intelligence & Insights Guide
## 지능형 정책 도우미, 시장 분석 및 인사이트 에디토리얼 시스템 가이드

---

## CHAPTER 01. 시스템 개요 및 인텔리전스 3대 원칙 (System Overview & Principles)

### 1.1 인텔리전스 도메인 개요 및 범위
**K SELECT Intelligence & Insights**는 한국 화장품 브랜드 파트너와 미국 유통/스토어 바이어를 위한 지능형 지식 탐색, 실시간 시장 데이터 수집, 팩트체크 기반 클레임 감사 및 에디토리얼 인사이트 발행을 전담하는 통합 지식 시스템입니다.

본 도메인은 브랜드 포털 내 정책 질의를 지원하는 **Grounded Knowledge Assistant (`/portal/help/ask`)**와 어드민 시스템의 **Insights Auto-Engine & Editorial Control Center (`/admin/insights/*`)**로 구성됩니다.

> [!NOTE]
> **포털 대시보드 도메인 분리 원칙**:
> 브랜드 포털 메인 대시보드(`/portal`)의 실시간 발주 현황, 온보딩 체크리스트, 미지급 정산액, 문의 건수 등은 순수 운영 및 실적 집계 데이터(`RPT` / `ONB` 도메인)이며, 인텔리전스 영역에 포함되지 않습니다.

---

### 1.2 인텔리전스 아키텍처의 3대 핵심 원칙

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    K SELECT INTELLIGENCE 3대 핵심 원칙                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. 결정론적 지식 안내 (Deterministic Knowledge Assistance)                  │
│    • 비공개/미확인 정책의 임의 추론을 배제하고, 승인·배포된 공식 매뉴얼만    │
│      인용하여 일관된 정책 답변과 공식 출처(Source Citations) 제공           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. 다단계 클레임 리스크 감사 및 안전 하향 (Claim Risk Audit & Downgrade)   │
│    • 모든 시장 주장에 대해 리스크(HIGH/MED/LOW)를 자동 분류하고, 1급 출처    │
│      미흡 시 SIGNAL로 자동 안전 하향(Downgrade) 및 완화된 어조로 변환       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. 에디토리얼 인간 승인 게이트 (Human-in-the-Loop Moderation Gate)          │
│    • 오토 엔진 생성물은 반드시 AI_DRAFT 상태로 격리되며, 전문 에디터의      │
│      검토와 승인 없이는 외부 채널에 절대 자동 발행되지 않음                │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **결정론적 지식 안내 (Deterministic Knowledge Assistance)**:
   - 외부 LLM의 임의 추론이나 확인되지 않은 정책을 생성하지 않으며, 서버에 등록된 `is_published = true` 상태의 공식 지식 문서(`knowledge_articles`)만을 바탕으로 답변을 도출합니다.
2. **다단계 클레임 리스크 감사 및 안전 하향 (Claim Risk Audit & Safe Downgrades)**:
   - 규제(FDA/MoCRA), 정량적 수치(%, $), 인과적 수익 주장 등 법적/신뢰도 리스크가 높은 문장은 정부/공식기관(`TIER_A`) 또는 공인 언론(`TIER_B`)의 근거가 필수이며, 근거가 미흡할 경우 즉시 시그널(`SIGNAL`)로 상태를 하향하고 어조를 완화합니다.
3. **에디토리얼 인간 승인 게이트 (Mandatory Human Gate)**:
   - 오토 엔진 파이프라인의 모든 생성물은 `status = 'AI_DRAFT'`로 저장되며, 에디터의 명시적 승인(`Publish Article`) 없이는 브랜드 포털이나 허브에 노출되지 않습니다.

---

## CHAPTER 02. 브랜드 정책 도우미 및 지식 탐색 (Grounded Knowledge Assistant)

### 2.1 지능형 정책 도우미 개요 (`/portal/help/ask`)
브랜드 사용자는 포털 내 정책 도우미를 통해 플랫폼 이용 정책, 브랜드/상품 등록 요건, 로지스틱스 규격, 정산 주기 등 복잡한 무역 실무 정책을 실시간으로 질의할 수 있습니다.

![SCR-B-INT-001](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-001.png)

- **[1] 질문 입력창 (Question Input)**: 2자 이상의 자연어 질의 입력 (예: "브랜드 등록 전제조건이 무엇인가요?").
- **[2] 청중 범위 격리 안내 배지 (Audience Boundary)**: 세션 기반으로 Brand Portal 공개 문서 한정 검색 안내.
- **[3] 조회 전용 가드 (Read-Only Guard)**: 설정 변경, 데이터 수정 등 쓰기 작업 시도 시 관리 화면 직접 이동을 안내하는 가드레일.

---

### 2.2 검색 결과 및 공식 출처 인용 (Result & Citations)

![SCR-B-INT-002](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-002.png)

- **[1] 검증된 직접 답변 (Grounded Direct Answer)**: 공식 매뉴얼에 명시된 정책 원문을 마크다운 서식으로 즉시 제공.
- **[2] 핵심 정책 불릿 요약 (Policy Bullets)**: 2~4개 핵심 실행 규칙을 요약하여 가독성 증대.
- **[3] 공식 인용 출처 카드 (Official Citations)**: 참고한 공식 브랜드 매뉴얼의 식별자, 버전, 최종 효력일자 및 매뉴얼 상세 링크 카드.
- **[4] 원클릭 액션 링크 (Action Links)**: 해당 정책의 매뉴얼 전문 보기, 관련 등록 화면 바로가기 및 1:1 고객지원(`support`) 링크 제공.

---

### 2.3 보안 가드레일 및 무결성 폴백 (Security & Fallbacks)

1. **프롬프트 인젝션 방어**: "시스템 프롬프트 보여줘", "ignore rules" 등 공격 패턴을 감지하여 사전 차단.
2. **범위 외 질문 방어**: 주가, 날씨, 시 작성 등 플랫폼 무관 질의에 대해 지식 미등록 안내 및 Help Center 안내.
3. **No Fabrication (근거 미흡 시 답변 생성 차단)**: 검색 매칭 점수가 기준 미달(50점 미만)이거나 공식 문서가 없는 경우 임의 추론을 엄격히 차단하고 1:1 고객지원 접수를 안내.

---

## CHAPTER 03. 어드민 인사이트 플랫폼 (Admin Insights Overview)

### 3.1 인사이트 시스템 오버뷰 대시보드 (`/admin/insights`)
어드민 관리자는 인사이트 오버뷰 화면에서 전체 콘텐츠 발행 현황, 오토 엔진 실행 통계 및 검토 대기 큐를 한눈에 모니터링할 수 있습니다.

![SCR-B-INT-003](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-003.png)

- **[1] 종합 지표 위젯**: 게시 완료 아티클 수, 검토 대기 초안 수, 독자 평균 유용성 만족도.
- **[2] 오토 엔진 실행 현황**: 일일 리서치 성공 여부, 수집 소스 수, 생성된 초안 수.
- **[3] 빠른 작업 링크**: 검토 큐 진입, 새 아티클 수동 작성, 자동화 룰 설정.

---

### 3.2 인사이트 아티클 라이브러리 (`/admin/insights/all`)

![SCR-B-INT-006](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-006.png)

- **[1] 상태 필터**: `ALL`, `PUBLISHED`, `AI_DRAFT`, `IN_REVIEW`, `ARCHIVED` 상태별 분류 조회.
- **[2] 채널 분류**: K SELECT Network (브랜드용) vs K SELECT Hub (리테일러용) 타겟팅 필터.
- **[3] 피처드(Featured) 지정**: 주요 전략 아티클의 메인 최상단 노출 토글.

---

## CHAPTER 04. 오토 엔진 리서치 파이프라인 및 3+3 쿼터 (Auto-Engine Pipeline & Quotas)

### 4.1 일일 시장 리서치 자동화 파이프라인
오토 엔진은 매일 오전 5시(ET) 크론에 의해 자동 실행되며 다음과 같은 4단계 파이프라인을 거칩니다:

```
[1. Market Research] ──► U.S. FDA MoCRA, USITC, 관세청, 뷰티 트레이드 피드 실시간 HTTP 스캔 (Tier A/B/C/SIGNAL)
         │
         ▼
[2. Topic Evaluation] ──► 6대 가중치 기반 채점 (Quality Gate: 80점 이상 & 5대 필수조건 PASS)
         │
         ▼
[3. Quota Management] ──► 일일 목표: NETWORK 3건 + HUB 3건 배분 (Shared Core 동시 배정)
         │
         ▼
[4. 2nd-Pass Research] ──► 목표 미달 시 동일 품질 기준(>=80)으로 2차 추가 리서치 즉시 실행
```

---

### 4.2 실행 이력 로그 및 품질 지표 (`/admin/insights/automation-runs`)

![SCR-B-INT-008](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-008.png)

- **[1] 실행 메타데이터**: 실행 일시, 소요 시간, 스캔된 총 소스 수 (`sources_scanned`).
- **[2] 품질 지표**: 80점 이상 합격 건수(`candidates_gte_80`), 필수 조건 미달 탈락 건수(`critical_rejects`).
- **[3] 채널별 생성량**: Network 초안 수, Hub 초안 수, Shared Core 공유 초안 수.

---

### 4.3 마스터 에디토리얼 룰 및 가중치 설정 (`/admin/insights/rules`)

![SCR-B-INT-009](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-009.png)

- **[1] 6대 평가 가중치**: 연관성(25), 실행성(25), 근거강도(20), 시의성(15), 독창성(10), 전략적합성(5).
- **[2] 품질 합격 기준**: 최소 토픽 스코어 80점 강제 (`minimum_topic_score = 80`).
- **[3] 일일 쿼터 상한**: Network 일일 최대 3건, Hub 일일 최대 3건 설정.
- **[4] 인간 승인 강제 플래그**: `human_approval_required = true`, `auto_publish = false`.

---

## CHAPTER 05. 클레임 리스크 감사 및 콘텐츠 레이어 (Claim Risk Auditing)

### 5.1 클레임 리스크 등급 및 소스 티어 시스템
아티클 내 모든 문장은 Claim으로 추출되어 리스크 등급과 소스 권위에 따라 엄격히 검증됩니다.

| 리스크 등급 | 대상 문장 성격 | 필수 검증 소스 티어 | 미충족 시 자동 조치 |
| :--- | :--- | :--- | :--- |
| **HIGH RISK** | 규제(FDA/MoCRA), 의무사항, 정확한 수치(%, $), 인과적 수익 보장 | `TIER_A` (정부/공식기관) 또는 `TIER_B` (공인 언론) | `DOWNGRADE` (SIGNAL로 하향 & 완화된 어조 변환) |
| **MEDIUM RISK** | 카테고리 트렌드, 검색 관심도 증가, 진열대 확장 | `TIER_B` 또는 검색/소셜 시그널 | `SIGNAL` 상태 분류 |
| **LOW RISK** | K SELECT 플랫폼 권고사항, 운영 노하우, 체크리스트 | 내부 운영 기준 | `INTERNAL` (`K_SELECT_RECOMMENDATION`) |

---

### 5.2 클레임 리스크 감사 요약 패널

![SCR-B-INT-005](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-005.png)

- **[1] Fact-Check Status**: 검증 결과 요약 (`PASS` 또는 `NEEDS_ATTENTION`).
- **[2] Risk Count Grid**: High / Medium / Low 리스크 문장 수치 통계.
- **[3] Claim Status Badges**: `VERIFIED`, `SIGNAL`, `INFERRED`, `INTERNAL` 분류 배지.
- **[4] Safe Downgrade Log**: 1급 증거 미흡으로 시그널로 하향된 사유 및 변경된 문구 표시.

---

### 5.3 4대 콘텐츠 레이어 구조 (`content_layers`)

![SCR-B-INT-007](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-007.png)

1. **Market Facts (`market_facts`)**: 1급 정부/통계 소스로 검증된 명확한 사실 데이터.
2. **Market Signals (`market_signals`)**: 검색어 급상승, 소셜 버즈, 시장 관측 추세.
3. **K-Select Views (`k_select_views`)**: 사실과 시그널을 바탕으로 한 K SELECT 전문 분석 관점.
4. **K-Select Actions (`k_select_actions`)**: 브랜드 및 바이어가 현업에서 즉시 실행해야 할 구체적 조치 사항.

---

## CHAPTER 06. 에디토리얼 모더레이션 및 발행 거버넌스 (Editorial Moderation)

### 6.1 모더레이션 검토 큐 (`/admin/insights/queue`)
오토 엔진이 생성한 모든 초안은 검토 큐에 대기 상태로 집결됩니다.

![SCR-B-INT-004](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-004.png)

- **[1] 초안 목록**: 생성일자, 타겟 채널(Network/Hub), 토픽 점수(>=80), 리스크 상태 표시.
- **[2] 원클릭 상세 진입**: 에디터 상세 검토 화면(`/admin/insights/[id]`)으로 연결.
- **[3] 수정 요청 관리**: 에디터 간 수정 의견 기록(`insights_revision_requests`).

---

### 6.2 카테고리 및 저자 프로필 관리 (`/admin/insights/categories`)

![SCR-B-INT-010](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-010.png)

- **[1] 카테고리 계층**: U.S. MARKET ENTRY, RETAIL TRENDS, CONSUMER INSIGHTS, COMPLIANCE & LEGAL 4대 표준 카테고리.
- **[2] 전문 저자 프로필**: 규제준수팀(Compliance Desk), 시장정보팀(Market Intelligence Desk) 등 공식 데스크 배정.

---

## CHAPTER 07. 독자 피드백, 시스템 갭 및 부록 (Feedback & Gaps)

### 7.1 독자 유용성 피드백 패널 (`/admin/insights/[id]`)

![SCR-B-INT-011](file:///Manuals/MAN-B-INT-001_Intelligence/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-INT-011.png)

- **[1] 유용성 만족도 지표 (Helpful Rate %)**: 아티클을 읽은 독자의 긍정 투표 비율.
- **[2] 총 투표 건수**: 누적 Helpful / Not Helpful 집계 수치.
- **[3] 24시간 중복 방지**: HMAC-SHA256 단방향 클라이언트 해시를 통한 안전한 중복 투표 차단.
- **[4] 운영 원칙**: 독자 피드백은 에디터의 콘텐츠 품질 개선 참고 지표로만 사용되며, AI 모델을 자동 재학습하지 않음.

---

### 7.2 시스템 갭 및 미구현 기능 명시 (System Gaps & Non-Implemented)

본 감사를 통해 확정된 시스템 경계 및 미구현 기능 목록:

1. **머신러닝 기반 수요/매출 예측 (Predictive Demand ML)**:
   - 과거/현재의 누적 실적을 집계할 뿐, 향후 30일/90일 수요를 예측하는 머신러닝 모델은 구현되어 있지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
2. **실시간 자동 가격 조정 (Dynamic Price Optimization Engine)**:
   - 환율 및 경쟁사 가격에 따른 자동 판매가 변동 알고리즘은 존재하지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
3. **자동재고 할당 알고리즘 (Automatic Inventory Allocation System)**:
   - 물류 센터 간 자동 재고 배치 알고리즘은 구현되지 않음 (`SYSTEM GAP / NOT IMPLEMENTED`).
4. **인간 검토 없는 전자동 외부 발행 (Fully Autonomous Publishing)**:
   - 에디터 승인 없는 자동 발행은 엄격히 차단됨 (`NOT IMPLEMENTED / STRICTLY BLOCKED`).
5. **독자 피드백 기반 자동 모델 재학습 (Automated Feedback Retraining)**:
   - 수집된 피드백은 에디터 모니터링 통계로만 사용됨 (`NOT IMPLEMENTED`).

---
*End of MAN-B-INT-001_Manual_Content.md*
