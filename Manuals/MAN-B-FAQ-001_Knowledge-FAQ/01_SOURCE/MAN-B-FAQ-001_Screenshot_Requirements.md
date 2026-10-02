# SCREENSHOT REQUIREMENTS: MAN-B-FAQ-001
## Knowledge Center FAQ Production Screenshot Matrix & Annotation Specification

- **Manual ID:** `MAN-B-FAQ-001`
- **Topic:** `Knowledge Center FAQ (도움말 센터, 자주 묻는 질문 및 지식 검색)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## 1. Screenshot Matrix Overview

| Screenshot ID | Semantic Screen Name | Target Route / URL | Target Section | Aspect / Viewport | Priority |
| :--- | :--- | :--- | :---: | :--- | :---: |
| `SCR-B-FAQ-001` | Help Center Main Hero & Search Hub | `/portal/help` | Section 2.1 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-FAQ-002` | Topic Navigation Grid & Featured FAQs | `/portal/help` (Topic Grid Section) | Section 2.2 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-FAQ-003` | Topic Selected & FAQ Accordion Expanded | `/portal/help` (Topic Selected View) | Section 3.1 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-FAQ-004` | Grounded Ask K SELECT Direct Answer View | `/portal/help/ask` (Answer Card) | Section 4.1 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-FAQ-005` | Grounded Search Citations & Source Links | `/portal/help/ask` (Sources Section) | Section 4.2 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-FAQ-006` | Knowledge Manual Detail & Related FAQs View | `/portal/help/[slug]` | Section 5.1 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-FAQ-007` | Support Escalation Handoff with Pre-filled Question | `/portal/support` (Handoff Inflow) | Section 5.2 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-FAQ-008` | Mobile Responsive Viewport of Help Center | `/portal/help` (Mobile 375px) | Section 2.3 | Mobile 375×812 | **P1 (Supporting)** |
| `SCR-B-FAQ-009` | Admin FAQ Candidate Review & Publishing Console | `/admin/knowledge/topics-faq` | Section 6.1 | Desktop 1440×900 | **P2 (Admin Ref)** |
| `SCR-B-FAQ-010` | Admin Knowledge Library Management Console | `/admin/knowledge/library` | Section 6.2 | Desktop 1440×900 | **P2 (Admin Ref)** |

---

## 2. Detailed Screenshot Specification & Callout Points

### [SCR-B-FAQ-001] 헬프센터 메인 히어로 및 검색창 (`/portal/help`)
- **UI State**: 브랜드 포털 도움말 센터 최상단 히어로 검색바 및 안내 문구.
- **Must-Show Elements**:
  1. 상단 히어로 배지 (`Official Knowledge & Policy`).
  2. 질문 검색 인풋 필드 (`궁금한 내용을 입력해 주세요...`).
  3. 빠른 추천 질문 칩 (Suggested Question Chips).
  4. 1:1 문의 연계 안내 문구.
- **Callout Pins**:
  - `(1)` 공식 지식 허브 타이틀
  - `(2)` 자연어 질문 검색창
  - `(3)` 빠른 질문 제안 칩
  - `(4)` 1:1 문의하기 바로가기 CTA

---

### [SCR-B-FAQ-002] 6대 표준 토픽 그리드 및 Featured FAQ 영역 (`/portal/help`)
- **UI State**: 히어로 하단에 6개 활성 표준 토픽 카드 그리드 및 주요 Featured FAQ 목록이 노출된 화면.
- **Must-Show Elements**:
  1. 6개 토픽 카드 (시작하기, 브랜드 관리, 상품 등록, 발주 관리, 인허가, 리테일 네트워크).
  2. Featured FAQ 뱃지 (`⭐ Featured`).
  3. FAQ 질문 목록 및 요약.
- **Callout Pins**:
  - `(1)` 6대 표준 업무 토픽 카드
  - `(2)` 토픽별 배정 FAQ 수 카운터
  - `(3)` Featured FAQ 하이라이트
  - `(4)` 토픽 상세 진입 화살표

---

### [SCR-B-FAQ-003] 토픽 선택 및 FAQ 아코디언 확장 뷰 (`/portal/help`)
- **UI State**: 특정 토픽(예: 발주 관리 `topic-orders`)이 선택되어 해당 토픽에 배정된 12개 FAQ가 아코디언으로 펼쳐진 화면.
- **Must-Show Elements**:
  1. 선택된 토픽 타이틀 및 설명 배너.
  2. 아코디언 형태로 펼쳐진 국문 답변 (`answer_ko`) 및 근거 조항 인용.
  3. 정본 매뉴얼 상세 보기 링크.
- **Callout Pins**:
  - `(1)` 선택된 활성 토픽 배너
  - `(2)` 펼쳐진 FAQ 질문 및 상세 답변
  - `(3)` 정본 매뉴얼 조항 인용구
  - `(4)` 관련 매뉴얼 전문 보기 링크

---

### [SCR-B-FAQ-004] Ask K SELECT 자연어 질문 답변 카드 (`/portal/help/ask`)
- **UI State**: 사용자의 자연어 질문에 대해 검색 엔진이 직접 답변(Direct Answer)을 생성하여 카드로 표시한 화면.
- **Must-Show Elements**:
  1. 사용자 입력 질문 요약.
  2. 구조화된 공식 답변 본문.
  3. 신뢰도/근거 확인 뱃지.
- **Callout Pins**:
  - `(1)` 사용자 입력 질문
  - `(2)` 정본 기반 직접 답변 본문
  - `(3)` 답변 신뢰성 안내 태그

---

### [SCR-B-FAQ-005] 출처 인용 및 정본 매뉴얼 링크 (`/portal/help/ask`)
- **UI State**: 직접 답변 하단에 인용된 정본 매뉴얼(`knowledge_items`) 출처 카드 및 버전 정보.
- **Must-Show Elements**:
  1. 인용 매뉴얼 카드 (`source_title`, `version`).
  2. 매뉴얼 뷰어 바로가기 버튼.
  3. 추가 질문 피드백 버튼 ("도움이 되었나요?").
- **Callout Pins**:
  - `(1)` 출처 매뉴얼 식별 정보
  - `(2)` 매뉴얼 버전 (`v1.0`)
  - `(3)` 정본 매뉴얼 이동 버튼
  - `(4)` 사용자 피드백 제출 버튼

---

### [SCR-B-FAQ-006] 매뉴얼 상세 뷰어 및 하단 연계 FAQ (`/portal/help/[slug]`)
- **UI State**: 특정 매뉴얼 본문 뷰어 페이지 하단에 해당 매뉴얼과 연계된 FAQ 목록이 렌더링된 화면.
- **Must-Show Elements**:
  1. 매뉴얼 본문 렌더링 영역.
  2. 하단 "이 매뉴얼의 자주 묻는 질문" 섹션.
  3. 연계 FAQ 리스트.
- **Callout Pins**:
  - `(1)` 정본 매뉴얼 헤더 및 버전
  - `(2)` 연계 FAQ 아코디언 섹션
  - `(3)` 질문 클릭 시 인라인 답변 표시

---

### [SCR-B-FAQ-007] 1:1 문의 연계 시 질문 사전 입력 화면 (`/portal/support`)
- **UI State**: 도움말 센터에서 해결되지 않아 [1:1 문의하기] 클릭 시 `kselect_support_handoff` 컨텍스트가 주입되어 문의 작성 창이 열린 화면.
- **Must-Show Elements**:
  1. 헬프센터 검색어 자동 바인딩.
  2. 사전 입력된 문의 제목 및 본문 컨텍스트.
- **Callout Pins**:
  - `(1)` 자동 주입된 문의 제목
  - `(2)` 헬프센터 검색 이력 컨텍스트
  - `(3)` 추가 내용 작성 및 제출 버튼

---

### [SCR-B-FAQ-008] 모바일 뷰포트 도움말 센터 (`/portal/help` - 375px)
- **UI State**: 모바일 환경에서 최적화된 검색바, 토픽 스크롤, 반응형 아코디언 화면.
- **Must-Show Elements**:
  1. 모바일 1열 토픽 카드 리스트.
  2. 터치 최적화 아코디언 UI.
- **Callout Pins**:
  - `(1)` 모바일 히어로 검색
  - `(2)` 모바일 1열 토픽 리스트
  - `(3)` 간결한 모바일 답변 아코디언

---

### [SCR-B-FAQ-009] 어드민 FAQ 심사 및 배포 관리 콘솔 (`/admin/knowledge/topics-faq`)
- **UI State**: K SELECT 운영팀이 FAQ 후보(`CANDIDATE`)를 검토하고 승인(`APPROVED`) 처리하는 관리 화면.
- **Must-Show Elements**:
  1. 토픽별 FAQ 목록 테이블.
  2. 승인/반려 액션 버튼.
  3. `is_featured` 토글 스위치 및 정렬 순서(`display_order`) 설정.
- **Callout Pins**:
  - `(1)` 토픽 선택 탭
  - `(2)` FAQ 승인 상태 배지
  - `(3)` Featured 토글 스위치
  - `(4)` FAQ 수정 및 저장 액션

---

### [SCR-B-FAQ-010] 어드민 지식 라이브러리 관리 콘솔 (`/admin/knowledge/library`)
- **UI State**: 발행된 정본 매뉴얼(`knowledge_items`)의 라이프사이클 및 연계 FAQ 수를 모니터링하는 화면.
- **Must-Show Elements**:
  1. 매뉴얼 목록 및 상태 (`PUBLISHED`, `ARCHIVED`).
  2. 연계 FAQ 수 통계.
- **Callout Pins**:
  - `(1)` 발행 매뉴얼 목록
  - `(2)` 연계 FAQ 집계 카운터
  - `(3)` 매뉴얼 상세 및 자산 검사 링크

---
*End of MAN-B-FAQ-001_Screenshot_Requirements.md*
