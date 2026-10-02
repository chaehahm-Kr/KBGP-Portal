# MAN-B-RET-001: Production Screenshot Requirements & Annotation Plan

---

### Screenshot Specifications for Phase 02 Package Preparation

| Shot ID | File Name | Target Screen & Route | Viewport | Required State & Data | Key Annotation & Callout Focus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-01` | `SCR-B-RET-001.png` | **신청 현황 대시보드**<br/>`/portal/applications` | Desktop (1440×900) | Logged-in Brand Manager with multiple applications in various statuses (`submitted`, `under_review`, `approved`). | 1. '새 신청서 작성' 액션 버튼<br/>2. 신청번호 링크 및 임시저장 표시<br/>3. 컬러 코딩된 신청 상태 뱃지 체계<br/>4. 포함 제품 수 및 최종 변경일 컬럼 |
| `SCR-02` | `SCR-B-RET-002.png` | **드래프트: 다중 브랜드 제품 선택**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Application in `draft` status with products registered across multiple brands. | 1. 브랜드별 그룹 헤더<br/>2. 제품 다중 선택 체크박스<br/>3. 최소 1개 제품 선택 필수 안내 |
| `SCR-03` | `SCR-B-RET-003.png` | **드래프트: 6대 프로그램 참여 준비 사항**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Draft application showing the 6 official readiness cards. | 1. 6대 항목 타이틀 및 세부 가이드<br/>2. `🟢 진행 가능` / `🟡 협의 필요` 2지선다 라디오 버튼<br/>3. 협의 필요 항목의 목적 (탈락이 아닌 조율 협의) |
| `SCR-04` | `SCR-B-RET-004.png` | **드래프트: 임시저장 및 제출 유효성**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Draft application with selected products and readiness answers completed. | 1. '임시저장' 버튼 (언제든 수정 가능)<br/>2. '신청서 제출' 확인 안내 문구<br/>3. 제출 시 신청번호 자동 발급 안내 |
| `SCR-05` | `SCR-B-RET-005.png` | **신청서 상세 헤더 및 상태 뱃지**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Submitted application (`submitted` or `under_review`). | 1. 공식 신청번호 (`APP-YYYYMMDD-XXXX`)<br/>2. 제출 일자 타임스탬프<br/>3. 심사 상태 뱃지 (`심사중` / `제출됨`) |
| `SCR-06` | `SCR-B-RET-006.png` | **MD 추가 자료 요청 알림 패널**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Application with `pendingRequests.length > 0` (status: `info_requested`). | 1. 노란색 긴급 안내 펄스 헤더<br/>2. MD 구체적 요청 사항 텍스트<br/>3. 회신 기한 뱃지 (예: YYYY년 M월 D일까지)<br/>4. 회신 입력란 및 파일 첨부 (PDF/이미지/엑셀) 폼 |
| `SCR-07` | `SCR-B-RET-007.png` | **제품별 심사 현황 및 타임라인**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Application with multiple products undergoing review with history logs. | 1. 제품별 개별 심사 상태 뱃지 (`승인`, `반려`, `보류`, `심사중`)<br/>2. 세부 타임라인 점 및 일시<br/>3. MD 공식 사유 코멘트 (`↳ 사유: ...`) |
| `SCR-08` | `SCR-B-RET-008.png` | **사이드바 자가진단 및 준비사항 요약**<br/>`/portal/applications/[id]` | Desktop (1440×900) | Right sidebar on application detail view. | 1. 참여 조건 자가진단 결과 (`✅`/`❌`)<br/>2. 프로그램 참여 준비 사항 요약 (`🟢`/`🟡`) |
| `SCR-09` | `SCR-B-RET-009.png` | **모바일 반응형 신청 현황**<br/>`/portal/applications` | Mobile (390×844) | Mobile viewport layout check. | 1. 모바일 최적화 헤더 및 신규 신청 버튼<br/>2. 모바일 반응형 카드/테이블 뷰 |

---

### Annotation & Callout Guidelines for Claude Design

1. **Badge Colors**:
   - `approved`: Green (`#10b981`)
   - `under_review`: Blue (`#3b82f6`)
   - `info_requested`: Amber (`#f59e0b`)
   - `rejected`: Rose (`#f43f5e`)
   - `draft`: Zinc (`#71717a`)
2. **Key Security Note**:
   - All screenshots must blur internal test emails or confidential company identification numbers before final publication.
3. **Step Number Callouts**:
   - Numbered circular badges (`1`, `2`, `3`) should guide the user through:
     - `1. 제품 선택` $\rightarrow$ `2. 준비사항 응답` $\rightarrow$ `3. 임시저장 및 제출` $\rightarrow$ `4. 심사 모니터링 & 자료 요청 대응`.
