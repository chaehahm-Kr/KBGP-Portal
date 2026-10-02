# MAN-B-INT-001 — Screenshot Requirements
## Intelligence & Insights Domain: Production UI Capture Specifications & Annotation Map

---

## 1. Executive Overview

본 문서는 **MAN-B-INT-001 Intelligence Guide** 매뉴얼 제작을 위해 추후 `02_CLAUDE_PACKAGE/02_SCREENSHOTS/` 단계에서 캡처 및 검증해야 하는 총 13종의 프로덕션 화면 캡처 규격을 정의한다.

모든 캡처 대상 화면은 **K SELECT Brand Portal** 및 **K SELECT Admin**의 실시간 프로덕션 URL 및 구동 컴포넌트를 기반으로 하며, 도메인 핵심 지표, Grounded AI 서빙, 팩트체크 리스크 감사 보고서 및 오토 엔진 관리 화면을 포함한다.

---

## 2. Screenshot Master Inventory (13 Items)

| No | File Identifier | Target Route / Page | Screen Description & Required Elements | Priority |
| :--- | :--- | :--- | :--- | :--- |
| 01 | `01_portal_dashboard_kpi_overview.png` | `/portal` | 브랜드 포털 대시보드 메인 화면. 온보딩 체크리스트, 미지급 정산액, 발주/문의 요약 카드 포함. | `P0 (Critical)` |
| 02 | `02_portal_onboarding_product_completeness.png` | `/portal` | 상품 등록 완성도 프로그레스 바(0-100%) 및 미입력 항목 가이드 툴팁 확대 화면. | `P1 (High)` |
| 03 | `03_portal_grounded_ask_main_view.png` | `/portal/help/ask` | Grounded AI 정책 도우미 메인 검색 화면 (질문 입력창, 히어로 타이틀, 공식 배지). | `P0 (Critical)` |
| 04 | `04_portal_grounded_ask_result_citations.png` | `/portal/help/ask` | AI 질문 검색 결과 화면 (검증된 Markdown 답변, 인용 출처 카드 `sourceCitations`). | `P0 (Critical)` |
| 05 | `05_admin_insights_overview_dashboard.png` | `/admin/insights` | 어드민 인사이트 시스템 오버뷰 대시보드 (총 아티클 수, 실행 통계, 검토 큐 위젯). | `P0 (Critical)` |
| 06 | `06_admin_insights_all_articles_library.png` | `/admin/insights/all` | 인사이트 전체 아티클 라이브러리 목록 (상태별 필터, 검색, 피처드 지정). | `P1 (High)` |
| 07 | `07_admin_insights_article_editor_detail.png` | `/admin/insights/[id]` | 인사이트 아티클 편집기 상세 화면 (본문 마크다운 에디터, 메타데이터, 저자/카테고리). | `P1 (High)` |
| 08 | `08_admin_insights_claim_audit_report.png` | `/admin/insights/[id]` | 클레임 리스크 감사 패널 화면 (HIGH/MED/LOW 리스크 현황, Auditor Action 조치 결과). | `P0 (Critical)` |
| 09 | `09_admin_insights_moderation_queue.png` | `/admin/insights/queue` | 오토 엔진 생성 아티클 검토 및 승인/반려 큐 목록 화면. | `P0 (Critical)` |
| 10 | `10_admin_insights_automation_runs_log.png` | `/admin/insights/automation-runs` | 오토 엔진 실행 이력 및 생성 아티클 수집 이력 로그 화면. | `P1 (High)` |
| 11 | `11_admin_insights_rules_configuration.png` | `/admin/insights/rules` | 자동화 키워드 리서치 규칙 설정 화면 (키워드 목록, 타겟 카테고리, 크론 주기). | `P1 (High)` |
| 12 | `12_admin_insights_authors_categories.png` | `/admin/insights/categories` | 인사이트 카테고리/태그 계층 관리 및 저자 프로필 설정 화면. | `P2 (Normal)` |
| 13 | `13_admin_insights_reader_feedback_analytics.png` | `/admin/insights/[id]` | 아티클 하단 독자 만족도 피드백 수집 지표 및 서술 의견 확인 패널. | `P2 (Normal)` |

---

## 3. Screen-by-Screen Annotation Details

### 3.1 `01_portal_dashboard_kpi_overview.png`
- **Target Route**: `https://portal.kselectnetwork.com/portal`
- **Focus Area**: 메인 대시보드 상단 요약 카드 영역.
- **Key Callouts**:
  - `[1] Onboarding Progress`: 온보딩 단계 지표.
  - `[2] Product Completeness`: 상품 완성도 지수 (%).
  - `[3] Pending POs`: 승인 대기 발주서 건수.
  - `[4] Unpaid Amount`: 미지급 정산 잔액 (`balance_due`).
  - `[5] Open Inquiries`: 답변 대기 문의 건수.

### 3.2 `04_portal_grounded_ask_result_citations.png`
- **Target Route**: `https://portal.kselectnetwork.com/portal/help/ask`
- **Focus Area**: AI 답변 및 하단 인용 출처 카드.
- **Key Callouts**:
  - `[1] Grounded Response`: 검증된 공식 지식 문서 기반 작성 답변.
  - `[2] Source Citations`: 참고한 공식 브랜드 매뉴얼 아티클 링크 및 카테고리.
  - `[3] Helpfulness Feedback`: 답변 하단 만족도 투표 컴포넌트.

### 3.3 `08_admin_insights_claim_audit_report.png`
- **Target Route**: `https://admin.kselectnetwork.com/admin/insights/[id]`
- **Focus Area**: 아티클 상세 우측/하단의 Claim Risk Audit Summary.
- **Key Callouts**:
  - `[1] Claim Risk Summary`: High / Medium / Low Risk 수치 및 Fact-Check Status.
  - `[2] Claim Status Badge`: `VERIFIED`, `INFERRED`, `ESTIMATE`, `SIGNAL`, `INTERNAL` 태그.
  - `[3] Auditor Action`: `PASS`, `DOWNGRADE`, `REWRITE`, `REMOVE` 실행 결과.

---

## 4. Technical Capture Requirements & Guidelines

1. **Resolution & Display**:
   - Desktop Standard: 1920 x 1080 (16:9 Aspect Ratio).
   - Viewport: Full browser window clear render without developer tool overlay.
2. **Data Cleanliness**:
   - 테스트용 임의 텍스트가 아닌 프로덕션 호환 데이터 표출.
   - 개인정보(실제 비밀번호, 결제 카드 번호 등) 마스킹 처리.
3. **Format**: High-resolution PNG format.

---

## 5. Audit Conclusion

- 본 캡처 요구사항 문서는 Intelligence 도메인의 포털 대시보드, Grounded AI Q&A 및 어드민 인사이트 오토 엔진 전체 기능을 포함하도록 명세되었다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL SCREENSHOT REQUIREMENTS**
