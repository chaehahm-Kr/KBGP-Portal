# MAN-B-RET-001: Production Screenshot Annotation Guide

---

## 1. Production Screenshot Inventory & Verification

All 9 screenshots below were captured directly from the live production environment (`portal.kselectnetwork.com`) using Playwright browser automation.

| Shot ID | File Name | Viewport | Dimensions | File Size | SHA256 Hash | Target Screen & State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-01` | `SCR-B-RET-001.png` | Desktop | 1440×900 | 58,197 B | `5d64c918a2c82134cf1d0b62b1c54b8af73b42b6c662e1c318a35bbeff4f1be8` | `/portal/applications` (신청 목록 대시보드) |
| `SCR-02` | `SCR-B-RET-002.png` | Desktop | 1440×900 | 99,007 B | `09c248c7e45b4d70fd5cba438e039555ff2b1bce4a71338e6751f43a2bf0ace4` | `/portal/applications/[id]` (드래프트: 다중 브랜드 제품 선택) |
| `SCR-03` | `SCR-B-RET-003.png` | Desktop | 1440×900 | 86,240 B | `3208b4ffa0aacfd7fb8901ead0b4c9301d23fec9219b14acf7c7ab1adb7645f1` | `/portal/applications/[id]` (드래프트: 6대 준비사항 자가진단) |
| `SCR-04` | `SCR-B-RET-004.png` | Desktop | 1440×900 | 74,512 B | `fba9e4ed220ecd13810a060ad9743a239bc651f1913c9fa23f6d8ea1dc728ae8` | `/portal/applications/[id]` (드래프트: 임시저장 및 제출 액션바) |
| `SCR-05` | `SCR-B-RET-005.png` | Desktop | 1440×900 | 80,660 B | `9ac8cb6490de7fc5e3d225538e28d0abfd84154476950286d58381ad054943b2` | `/portal/applications/[id]` (상세: 신청번호 헤더 및 상태 뱃지) |
| `SCR-06` | `SCR-B-RET-006.png` | Desktop | 1440×900 | 80,356 B | `2fb591604457b08586fefbce9738df286e0d1059a88e30ce16591bd38040ad38` | `/portal/applications/[id]` (상세: 긴급 추가 자료 요청 패널) |
| `SCR-07` | `SCR-B-RET-007.png` | Desktop | 1440×900 | 82,424 B | `48d2bc7ef2c5f6eef02e19f56fdde7b412241475af977c053d73b864b39b186a` | `/portal/applications/[id]` (상세: 제품별 심사 현황 및 타임라인) |
| `SCR-08` | `SCR-B-RET-008.png` | Desktop | 1440×900 | 82,406 B | `54a43423841bf609d251ce3b096f6f8bdfaee2adbb5d8480d190b1263c002f32` | `/portal/applications/[id]` (상세: 사이드바 자가진단/준비사항) |
| `SCR-09` | `SCR-B-RET-009.png` | Mobile | 390×844 | 32,427 B | `b80c28a4e752b8fcb38b8b376ebcb5c093ce9e86f733518b4f34f73d3d9da059` | `/portal/applications` (모바일 반응형 신청 대시보드) |

---

## 2. Callout & Annotation Plan for Claude Design

### Shot 01: `SCR-B-RET-001.png` (Applications Dashboard)
- **Callout 1 (Top Right Button)**: `[새 신청서 작성]` — `application:write` 권한자 전용 신규 생성 버튼
- **Callout 2 (First Column)**: `[신청 번호]` — 공식 발급 번호 링크 (임시저장 시 `(임시저장 상태)` 표시)
- **Callout 3 (Second Column)**: `[신청 상태 뱃지]` — 컬러 코딩된 진행 상태 (`승인됨`, `심사중`, `임시저장` 등)
- **Callout 4 (Third & Fourth Columns)**: `[포함 제품 수 및 최종 변경일]` — 포함 상품 개수 및 최종 타임스탬프

### Shot 02: `SCR-B-RET-002.png` (Draft Mode: Product Selection)
- **Callout 1 (Brand Category Headers)**: `[브랜드별 그룹화]` — 회사에 등록된 브랜드별로 제품 자동 분류
- **Callout 2 (Checkboxes)**: `[제품 다중 선택]` — 한 번에 여러 브랜드 제품 동시 선택 가능
- **Callout 3 (Helper Notice)**: `[1개 이상 선택 안내]` — 제출을 위해 최소 1개 제품 선택 필수

### Shot 03: `SCR-B-RET-003.png` (Draft Mode: 6 Readiness Standards)
- **Callout 1 (Standard Card Titles)**: `[6대 준비사항 항목]` — 생산 안정성, MoCRA/FDA, 초도 물량, 유통 정책, 마케팅 협력, 상세 콘텐츠
- **Callout 2 (Radio Selectors)**: `[2지선다 응답]` — `🟢 진행 가능 (available)` vs `🟡 협의 필요 (discussion_required)`
- **Callout 3 (Card Descriptions)**: `[평가 기준 설명]` — 각 항목별 구체적인 협력 요구사항 가이드

### Shot 04: `SCR-B-RET-004.png` (Draft Mode: Action Bar)
- **Callout 1 (Save Draft Button)**: `[임시저장]` — 입력된 제품 및 준비사항을 저장하고 추후 재작성 가능
- **Callout 2 (Submit Notice Box)**: `[제출 안내]` — 제출 시 직접 수정이 잠기고 공식 심사가 시작됨을 명시
- **Callout 3 (Submit Button)**: `[신청서 제출]` — 1개 이상 제품 선택 시 활성화 및 신청번호 자동 발급

### Shot 05: `SCR-B-RET-005.png` (Detail Header & Status)
- **Callout 1 (Top Identifier)**: `[APPLICATION NUMBER]` — 발급된 고유 번호 (예: `APP-20260919-0011`)
- **Callout 2 (Submission Date)**: `[제출 일자]` — 제출 타임스탬프 (`YYYY. MM. DD. HH:mm:ss`)
- **Callout 3 (Status Pill)**: `[통합 심사 상태]` — 전체 제품의 자동 집계 상태 표시

### Shot 06: `SCR-B-RET-006.png` (Info Request Panel)
- **Callout 1 (Urgent Header)**: `[추가 자료 제출 필요]` — MD의 보완 요청 발생 시 상단 긴급 노출
- **Callout 2 (Request & Due Date)**: `[요청 사항 및 회신 기한]` — 구체적 요청 내용과 회신 마감일
- **Callout 3 (Reply & File Upload)**: `[회신 내용 및 첨부파일]` — 답변 작성 및 증빙 서류 업로드 영역

### Shot 07: `SCR-B-RET-007.png` (Granular Product Review Timeline)
- **Callout 1 (Product Name & Status)**: `[개별 심사 상태]` — 제품별 독립적 심사 결과 (`승인`, `반려`, `보류`, `심사중`)
- **Callout 2 (Audit Timeline Dots)**: `[진행 이력 타임라인]` — 단계별 처리 시점 및 상태 변경 로그
- **Callout 3 (Reviewer Reason)**: `[MD 심사 사유]` — 반려 또는 보류 시 MD가 기록한 공식 사유

### Shot 08: `SCR-B-RET-008.png` (Sidebar Evaluation Summary)
- **Callout 1 (Self Check Box)**: `[참여 조건 자가진단]` — 신청 시 동의한 6대 자가진단 결과 (`✅`/`❌`)
- **Callout 2 (Readiness Box)**: `[프로그램 참여 준비 사항]` — 6대 항목 응답 요약 (`🟢 진행 가능`/`🟡 협의 필요`)

### Shot 09: `SCR-B-RET-009.png` (Mobile Applications Dashboard)
- **Callout 1 (Mobile Navigation)**: `[모바일 반응형 최적화]` — 390px 뷰포트에서의 대시보드 카드 레이아웃
