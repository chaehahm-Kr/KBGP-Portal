# MAN-B-INT-001 — Screenshot Requirements
## Intelligence & Insights Domain: Production UI Capture Specifications & Priority Map

---

## 1. Executive Overview

본 문서는 **MAN-B-INT-001 Intelligence Guide** 매뉴얼 제작을 위해 추후 `02_CLAUDE_PACKAGE/02_SCREENSHOTS/` 단계에서 캡처 및 검증해야 하는 프로덕션 화면 캡처 규격을 정의한다.

모든 캡처 대상 화면은 **K SELECT Brand Portal** 및 **K SELECT Admin**의 실시간 프로덕션 URL 및 구동 컴포넌트를 기반으로 하며, Grounded Knowledge Q&A 서빙, 인사이트 오토 엔진, 클레임 리스크 감사 보고서 및 에디토리얼 모더레이션 큐를 포함한다.

*(참고: 포털 메인 대시보드 KPI 및 온보딩 완성도 화면은 `RPT` / `ONB` 도메인에 해당하므로 본 Intelligence 캡처 인벤토리에서 제외됨)*

---

## 2. Screenshot Priority & Master Inventory (11 Retained / 13 Evaluated)

| No | File Identifier | Target Route / Page | Screen Description & Required Elements | Priority Classification |
| :--- | :--- | :--- | :--- | :--- |
| -- | `01_portal_dashboard_kpi_overview.png` | `/portal` | *(제외: RPT / ONB 운영 대시보드 도메인 항목)* | `REMOVE` |
| -- | `02_portal_onboarding_product_completeness.png` | `/portal` | *(제외: ONB / PROD 온보딩 완성도 도메인 항목)* | `REMOVE` |
| 01 | `SCR-B-INT-001_ask_main_view.png` | `/portal/help/ask` | Grounded Knowledge Assistant 메인 검색 화면 (질문 입력창, 가이드 뱃지). | `P0 CORE` |
| 02 | `SCR-B-INT-002_ask_result_citations.png` | `/portal/help/ask` | 정책 질문 검색 결과 화면 (검증된 Markdown 답변, 핵심 불릿, 공식 인용 출처 `sources`). | `P0 CORE` |
| 03 | `SCR-B-INT-003_admin_insights_overview.png` | `/admin/insights` | 어드민 인사이트 시스템 오버뷰 대시보드 (총 아티클 수, 오토 엔진 실행 통계, 검토 큐 위젯). | `P0 CORE` |
| 04 | `SCR-B-INT-004_admin_insights_queue.png` | `/admin/insights/queue` | 오토 엔진 생성 아티클 검토 및 승인/반려 모더레이션 큐 화면. | `P0 CORE` |
| 05 | `SCR-B-INT-005_admin_claim_audit_report.png` | `/admin/insights/[id]` | 클레임 리스크 감사 패널 화면 (HIGH/MED/LOW 리스크 현황, Safe Downgrade 조치 결과). | `P0 CORE` |
| 06 | `SCR-B-INT-006_admin_insights_all_library.png` | `/admin/insights/all` | 인사이트 전체 아티클 라이브러리 목록 (상태별 필터, 검색, 피처드 지정). | `P1 SUPPORTING` |
| 07 | `SCR-B-INT-007_admin_article_editor.png` | `/admin/insights/[id]` | 인사이트 아티클 편집기 상세 화면 (국/영문 본문 블록, 4대 콘텐츠 레이어, 비주얼 에셋). | `P1 SUPPORTING` |
| 08 | `SCR-B-INT-008_admin_automation_runs.png` | `/admin/insights/automation-runs` | 오토 엔진 실행 이력 및 3+3 쿼터 생성 로그 화면. | `P1 SUPPORTING` |
| 09 | `SCR-B-INT-009_admin_rules_configuration.png` | `/admin/insights/rules` | 마스터 에디토리얼 룰 및 가중치 설정 화면 (최소 점수 80점, 일일 3+3 쿼터). | `P1 SUPPORTING` |
| 10 | `SCR-B-INT-010_admin_categories_authors.png` | `/admin/insights/categories` | 인사이트 카테고리 계층 및 저자 프로필 설정 화면. | `P2 OPTIONAL` |
| 11 | `SCR-B-INT-011_admin_reader_feedback.png` | `/admin/insights/[id]` | 아티클 하단 독자 유용성 피드백(Helpful Rate %) 집계 패널. | `P2 OPTIONAL` |

---

## 3. Screen-by-Screen Annotation Specifications

### 3.1 `SCR-B-INT-001_ask_main_view.png`
- **Target Route**: `https://portal.kselectnetwork.com/portal/help/ask`
- **Focus Area**: 메인 질문 입력창 및 안내 히어로 섹션.
- **Key Callouts**:
  - `[1] Search Input`: 최소 2자 이상 정책 질의 입력 필드.
  - `[2] Audience Boundary`: Brand Portal 전용 공개 지식 문서 한정 검색 안내 배지.
  - `[3] Read-Only Guard`: 조회 전용 안내 (설정 변경/쓰기 작업 불가 안내).

### 3.2 `SCR-B-INT-002_ask_result_citations.png`
- **Target Route**: `https://portal.kselectnetwork.com/portal/help/ask`
- **Focus Area**: 답변 본문 및 하단 인용 출처 카드.
- **Key Callouts**:
  - `[1] Grounded Answer`: 검증된 공식 매뉴얼 기반 Markdown 직접 답변.
  - `[2] Policy Summary Bullets`: 2~4개 핵심 정책 요약 불릿.
  - `[3] Official Citations`: 참고한 공식 브랜드 매뉴얼 링크 (`id`, `title`, `version`, `url`).
  - `[4] Action Links`: 매뉴얼 상세 및 1:1 지원 센터(`support`) 바로가기.

### 3.3 `SCR-B-INT-005_admin_claim_audit_report.png`
- **Target Route**: `https://admin.kselectnetwork.com/admin/insights/[id]`
- **Focus Area**: 아티클 상세 우측/하단의 Claim Risk Audit Summary.
- **Key Callouts**:
  - `[1] Risk Summary`: High / Medium / Low Risk 수치 및 Fact-Check Status.
  - `[2] Claim Status Badge`: `VERIFIED`, `SIGNAL`, `INFERRED`, `INTERNAL` 태그.
  - `[3] Safe Downgrade`: 근거 미흡 주장의 `SIGNAL` 자동 하향 및 완화 문구 변환.
  - `[4] 4 Content Layers`: Market Facts, Signals, K-Select Views, Actions 분리 블록.

---

## 4. Technical Capture Requirements & Guidelines

1. **Resolution & Viewport**:
   - Desktop Standard: 1920 x 1080 (16:9 Aspect Ratio).
   - Clean render without developer tools or debug overlays.
2. **Data Integrity**:
   - 프로덕션 호환 실제 데이터 표출 (임의의 로렘 입숨 배제).
3. **Format**: High-resolution lossless PNG format.

---

## 5. Audit Conclusion

- 본 캡처 요구사항 문서는 Intelligence 도메인의 Grounded Knowledge Q&A 및 어드민 인사이트 오토 엔진 실제 프로덕션 기능에 맞추어 검증 및 정정되었다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL SCREENSHOT REQUIREMENTS (R1 REVISED)**
