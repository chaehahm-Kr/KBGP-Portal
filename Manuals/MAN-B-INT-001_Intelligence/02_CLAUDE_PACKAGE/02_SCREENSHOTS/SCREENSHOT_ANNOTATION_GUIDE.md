# MAN-B-INT-001 — Screenshot Annotation & Callout Guide
## Production UI Screen Specifications, Pin Coordinates & Focus Areas

---

## 1. Screenshot Inventory & Priority Summary (11 Items)

| Identifier | Route / URL | Component / Context | Priority |
| :--- | :--- | :--- | :--- |
| `SCR-B-INT-001.png` | `https://portal.kselectnetwork.com/portal/help/ask` | Grounded Knowledge Assistant Main View | `P0 CORE` |
| `SCR-B-INT-002.png` | `https://portal.kselectnetwork.com/portal/help/ask` | Grounded Assistant Search Result & Citations | `P0 CORE` |
| `SCR-B-INT-003.png` | `https://admin.kselectnetwork.com/admin/insights` | Admin Insights System Overview Dashboard | `P0 CORE` |
| `SCR-B-INT-004.png` | `https://admin.kselectnetwork.com/admin/insights/queue` | Auto-Engine Moderation & Review Queue | `P0 CORE` |
| `SCR-B-INT-005.png` | `https://admin.kselectnetwork.com/admin/insights/[id]` | Claim Risk Audit Panel & Fact-Check Summary | `P0 CORE` |
| `SCR-B-INT-006.png` | `https://admin.kselectnetwork.com/admin/insights/all` | Admin Insights All Articles Library | `P1 SUPPORTING` |
| `SCR-B-INT-007.png` | `https://admin.kselectnetwork.com/admin/insights/[id]` | Article Editor Detail View (Dual-Language Blocks) | `P1 SUPPORTING` |
| `SCR-B-INT-008.png` | `https://admin.kselectnetwork.com/admin/insights/automation-runs` | Automation Runs Execution Log & Quality Metrics | `P1 SUPPORTING` |
| `SCR-B-INT-009.png` | `https://admin.kselectnetwork.com/admin/insights/rules` | Master Editorial Rules & Daily Quota Settings | `P1 SUPPORTING` |
| `SCR-B-INT-010.png` | `https://admin.kselectnetwork.com/admin/insights/categories` | Categories & Author Profiles Management | `P2 OPTIONAL` |
| `SCR-B-INT-011.png` | `https://admin.kselectnetwork.com/admin/insights/[id]` | Reader Helpfulness Feedback Analytics Panel | `P2 OPTIONAL` |

---

## 2. Screen-by-Screen Detailed Annotation Callouts

### 2.1 `SCR-B-INT-001.png` — Grounded Knowledge Assistant Main View
- **Route**: `https://portal.kselectnetwork.com/portal/help/ask`
- **Focus Area**: 질문 입력창, 히어로 헤더 및 안내 뱃지.
- **Pin Callouts**:
  - `(1)` **질문 입력 필드 (Search Input)**: 2자 이상의 자연어 질의를 입력하는 중앙 입력창.
  - `(2)` **청중 격리 안내 배지 (Audience Boundary)**: Brand Portal 권한 기반 비공개 사내 문서 조회 차단 및 공개 지식 문서 한정 안내.
  - `(3)` **조회 전용 가드 (Read-Only Guard)**: 쓰기/수정 시도 시 관리 메뉴 직접 수정을 안내하는 읽기 전용 가드레일.

### 2.2 `SCR-B-INT-002.png` — Search Result & Official Citations
- **Route**: `https://portal.kselectnetwork.com/portal/help/ask`
- **Focus Area**: 답변 영역 및 하단 인용 출처 카드.
- **Pin Callouts**:
  - `(1)` **검증된 직접 답변 (Grounded Direct Answer)**: 공식 매뉴얼 원문에 근거한 마크다운 직접 답변.
  - `(2)` **핵심 정책 불릿 요약 (Policy Bullets)**: 2~4개 핵심 실행 규칙 불릿 요약.
  - `(3)` **공식 인용 출처 카드 (Official Citations)**: 참고한 브랜드 매뉴얼 식별자(`id`), 제목, 버전 및 효력일자.
  - `(4)` **원클릭 액션 링크 (Action Links)**: 매뉴얼 전문 보기, 등록 화면 바로가기, 1:1 고객지원(`support`) 링크.

### 2.3 `SCR-B-INT-003.png` — Admin Insights System Overview Dashboard
- **Route**: `https://admin.kselectnetwork.com/admin/insights`
- **Focus Area**: 대시보드 상단 통계 카드 및 오토 엔진 요약 위젯.
- **Pin Callouts**:
  - `(1)` **발행 아티클 통계 (Published Metrics)**: 전체 게시 완료 아티클 수 및 누적 조회수.
  - `(2)` **검토 큐 요약 위젯 (Review Queue Widget)**: 에디터 검토 대기 중인 초안(`AI_DRAFT`) 수.
  - `(3)` **오토 엔진 실행 통계 (Auto-Engine Run Status)**: 최근 실행 결과 및 생성된 일일 초안 수.

### 2.4 `SCR-B-INT-004.png` — Auto-Engine Moderation & Review Queue
- **Route**: `https://admin.kselectnetwork.com/admin/insights/queue`
- **Focus Area**: 검토 대기 목록 테이블 및 타겟 채널 태그.
- **Pin Callouts**:
  - `(1)` **초안 대기 목록 (Draft Queue Table)**: 오토 엔진이 생성한 대기 아티클 목록.
  - `(2)` **타겟 채널 태그 (Publish Channels)**: `NETWORK`, `HUB`, `BOTH` 타겟 표시.
  - `(3)` **토픽 점수 배지 (Topic Score Badge)**: 80점 이상 합격 점수 표시.
  - `(4)` **검토 상세 진입 (Review Action)**: 에디터 상세 편집 및 클레임 감사 확인 링크.

### 2.5 `SCR-B-INT-005.png` — Claim Risk Audit Panel & Fact-Check Summary
- **Route**: `https://admin.kselectnetwork.com/admin/insights/[id]`
- **Focus Area**: 아티클 상세 우측/하단 Claim Risk Audit Panel.
- **Pin Callouts**:
  - `(1)` **Fact-Check Status 배지**: 전체 검증 상태 (`PASS` / `NEEDS_ATTENTION`).
  - `(2)` **리스크 수치 그리드 (Risk Count Grid)**: High / Medium / Low 리스크 문장 수.
  - `(3)` **클레임 상태 태그 (Claim Status Tags)**: `VERIFIED`, `SIGNAL`, `INFERRED`, `INTERNAL` 배지.
  - `(4)` **안전 하향 조치 로그 (Safe Downgrade Reason)**: 1급 근거 미흡 주장의 SIGNAL 자동 하향 내역.

### 2.6 `SCR-B-INT-006.png` — Admin Insights All Articles Library
- **Route**: `https://admin.kselectnetwork.com/admin/insights/all`
- **Focus Area**: 아티클 전체 라이브러리 목록 및 상태 필터 바.
- **Pin Callouts**:
  - `(1)` **상태 필터 바 (Status Filters)**: `ALL`, `PUBLISHED`, `AI_DRAFT`, `IN_REVIEW`, `ARCHIVED`.
  - `(2)` **검색 및 카테고리 필터 (Search & Category)**: 키워드 검색 및 카테고리 필터링.
  - `(3)` **피처드 토글 (Featured Switch)**: 메인 상단 피처드 노출 지정 스위치.

### 2.7 `SCR-B-INT-007.png` — Article Editor Detail View
- **Route**: `https://admin.kselectnetwork.com/admin/insights/[id]`
- **Focus Area**: 한/영 본문 탭, 4대 콘텐츠 레이어 및 메타데이터 폼.
- **Pin Callouts**:
  - `(1)` **다국어 탭 (KO / EN Tabs)**: 국문/영문 제목, 요약, 본문 블록 탭.
  - `(2)` **4대 콘텐츠 레이어 (Content Layers)**: Market Facts, Signals, Views, Actions 분리 블록.
  - `(3)` **발행 승인 버튼 (Publish Article)**: `status = 'PUBLISHED'` 전환 최종 승인 버튼.

### 2.8 `SCR-B-INT-008.png` — Automation Runs Execution Log
- **Route**: `https://admin.kselectnetwork.com/admin/insights/automation-runs`
- **Focus Area**: 실행 로그 테이블 및 3+3 쿼터 통계.
- **Pin Callouts**:
  - `(1)` **실행 일시 및 모드 (Run Metadata)**: 매일 오전 5시(ET) 실행 일시 및 SCHEDULED 모드.
  - `(2)` **스캔 소스 및 채택 소스 (Sources Scanned / Accepted)**: 실시간 수집 소스 수.
  - `(3)` **3+3 채널별 생성 통계 (Channel Drafts)**: Network 초안 수, Hub 초안 수, Shared Core 수.
  - `(4)` **품질 탈락 지표 (Critical / Duplicate Rejects)**: 기준 미달 탈락 건수.

### 2.9 `SCR-B-INT-009.png` — Master Editorial Rules & Daily Quota Settings
- **Route**: `https://admin.kselectnetwork.com/admin/insights/rules`
- **Focus Area**: 에디토리얼 마스터 룰 및 가중치 설정 패널.
- **Pin Callouts**:
  - `(1)` **6대 가중치 설정 (Score Weights)**: 연관성(25), 실행성(25), 근거강도(20), 시의성(15), 독창성(10), 전략적합성(5).
  - `(2)` **품질 합격 기준선 (Score Threshold)**: 최소 토픽 스코어 80점 강제.
  - `(3)` **일일 쿼터 상한 (Daily Draft Limits)**: Network 3건, Hub 3건 상한선.
  - `(4)` **인간 승인 강제 스위치 (Human Approval Required)**: 자동 발행 차단 및 검토 필수 지정.

### 2.10 `SCR-B-INT-010.png` — Categories & Author Profiles Management
- **Route**: `https://admin.kselectnetwork.com/admin/insights/categories`
- **Focus Area**: 4대 표준 카테고리 목록 및 공식 저자 프로필.
- **Pin Callouts**:
  - `(1)` **4대 표준 카테고리 (Category List)**: U.S. MARKET ENTRY, RETAIL TRENDS, CONSUMER INSIGHTS, COMPLIANCE & LEGAL.
  - `(2)` **공식 데스크 저자 프로필 (Author Profiles)**: Compliance Desk, Market Intelligence Desk 등 소속 관리.

### 2.11 `SCR-B-INT-011.png` — Reader Helpfulness Feedback Analytics Panel
- **Route**: `https://admin.kselectnetwork.com/admin/insights/[id]`
- **Focus Area**: 아티클 하단 독자 유용성 피드백 집계 패널.
- **Pin Callouts**:
  - `(1)` **유용성 만족도 지수 (Helpful Rate %)**: 독자 긍정 투표 백분율.
  - `(2)` **총 투표 통계 (Total Feedback Count)**: Helpful / Not Helpful 건수.
  - `(3)` **HMAC-SHA256 중복 방지 (Duplicate Protection)**: 24시간 중복 투표 차단 메커니즘.

---
*End of SCREENSHOT_ANNOTATION_GUIDE.md*
