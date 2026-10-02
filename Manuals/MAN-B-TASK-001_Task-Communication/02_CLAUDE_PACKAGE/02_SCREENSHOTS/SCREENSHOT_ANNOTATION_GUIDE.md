# SCREENSHOT ANNOTATION GUIDE: MAN-B-TASK-001
## Task & Communication System Visual Annotation & Callout Matrix

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Total Production Screenshots:** 12 Images (`SCR-B-TASK-001.png` ~ `SCR-B-TASK-012.png`)
- **Authoritative Date:** 2026-10-02

---

## 1. Annotation Design Philosophy & Standards

1. **Pin Style**:
   - Primary Accent Pin: Indigo `#4F46E5` / Solid Circle with White Number `(1)`, `(2)`, `(3)`, `(4)`
   - Warning/Action Pin: Rose `#E11D48` / Used for `ACTION_REQUIRED` or Alert areas
2. **Typography**:
   - Sans-serif Bold 12pt (Callout Numbers)
   - Caption: Korean Clear Sans / 9.5pt Neutral Gray
3. **Grid Placement**:
   - Master Reference: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 2. Comprehensive Screenshot Matrix & Pin Specifications

### [SCR-B-TASK-001] 지원 센터 메인 허브 및 케이스 목록 (`/portal/support`)
- **File:** `02_SCREENSHOTS/SCR-B-TASK-001.png`
- **Chapter Mapping:** Chapter 2.1 — 지원 센터 메인 허브 및 인터페이스 구성
- **UI State:** 등록된 복수 건의 케이스 목록이 카드 형태로 렌더링된 메인 화면.
- **Callout Pins & Explanations:**
  - `(1)` **[+ 새 문의 작성] 버튼**: `support:write` 권한을 가진 사용자에게 표시되는 신규 케이스 등록 진입점.
  - `(2)` **4대 공식 상태 필터 탭**: `전체`, `접수됨(RECEIVED)`, `검토중(UNDER_REVIEW)`, `조치필요(ACTION_REQUIRED)`, `종료됨(CLOSED)` 탭.
  - `(3)` **케이스 식별 번호 (`CASE-XXXX`)**: 고유하게 부여된 가독형 티켓 번호 및 카테고리 태그.
  - `(4)` **조치 필요(`ACTION_REQUIRED`) 강조 배지**: 운영팀의 후속 서류/자료 요청이 발생한 최우선 확인 케이스.

---

### [SCR-B-TASK-002] 새 1:1 문의 등록 모달 (`/portal/support?new=1`)
- **File:** `02_SCREENSHOTS/SCR-B-TASK-002.png`
- **Chapter Mapping:** Chapter 3.1 — 신규 문의 작성 절차
- **UI State:** 문의 유형, 제목, 상세 내용 및 첨부파일을 입력하는 팝업 모달.
- **Callout Pins & Explanations:**
  - `(1)` **카테고리 선택 드롭다운**: 9대 표준 업무 분류(`po_change`, `settlement`, `product` 등) 선택.
  - `(2)` **제목 및 상세 설명 입력란**: 핵심 안건과 구체적인 질의/요청 사항을 작성하는 필드.
  - `(3)` **파일 첨부(최대 20MB) 영역**: 이미지(PNG/JPEG/WEBP) 및 PDF 문서를 안전하게 업로드하는 영역.
  - `(4)` **[문의 등록하기] 액션 버튼**: 서버 액션을 통해 데이터를 전송하고 `RECEIVED` 상태를 생성하는 버튼.

---

### [SCR-B-TASK-003] 양방향 대화 스레드 상세 뷰 (`/portal/support?case=...`)
- **File:** `02_SCREENSHOTS/SCR-B-TASK-003.png`
- **Chapter Mapping:** Chapter 4.1 — 스레드 기반 메시지 타임라인
- **UI State:** 특정 케이스의 전체 대화 타임라인과 운영팀의 답변이 표시된 상세 화면.
- **Callout Pins & Explanations:**
  - `(1)` **케이스 메타데이터 헤더**: 케이스 번호, 접수 일시, 카테고리 태그, 현재 진행 상태 배지.
  - `(2)` **브랜드사 발신 메시지**: 회사 담당자가 작성한 메시지 말풍선 (우측 정렬).
  - `(3)` **K SELECT 운영팀 공식 답변**: 운영팀 심사관이 작성한 공식 답변 및 배지 (좌측 정렬).
  - `(4)` **암호화 첨부파일 다운로드**: 시간 제한 서명 URL(`getSignedFileUrl`)을 통해 안전하게 다운로드되는 파일 링크.

---

### [SCR-B-TASK-004] 조치 필요(Action Required) 배너 및 보완 폼
- **File:** `02_SCREENSHOTS/SCR-B-TASK-004.png`
- **Chapter Mapping:** Chapter 5.1 — 조치 필요(Action Required) 대응 절차
- **UI State:** 운영팀이 자료 보완을 요청하여 상단에 붉은색 경고 배너가 활성화된 화면.
- **Callout Pins & Explanations:**
  - `(1)` **조치 필요 상단 안내 배너**: 브랜드사의 추가 회신이 요구됨을 알리는 로즈 컬러 배너.
  - `(2)` **조치 요청 플래그 메시지**: 운영팀의 구체적인 보완 요구 사항 및 `⚠️ 조치요청` 태그.
  - `(3)` **보완 서류 첨부 및 회신 입력 영역**: 정정 서류를 업로드하고 보완 완료 메시지를 제출하는 폼.

---

### [SCR-B-TASK-005] 케이스 종결 및 5점 만족도 평가 (CSAT)
- **File:** `02_SCREENSHOTS/SCR-B-TASK-005.png`
- **Chapter Mapping:** Chapter 5.2 — 케이스 종결 및 5점 만족도 평가 (CSAT)
- **UI State:** 안건 처리가 완료되어 `CLOSED` 배지와 함께 하단에 5점 만족도 평가창이 노출된 화면.
- **Callout Pins & Explanations:**
  - `(1)` **케이스 종결 표시**: 안건 해결 완료를 나타내는 `⚫ 종료됨 (CLOSED)` 배지.
  - `(2)` **5점 별점 평가 컴포넌트**: 서비스 품질 만족도를 1점부터 5점까지 선택하는 상호작용 별점 바.
  - `(3)` **만족도 제출 버튼**: 평가 점수와 코멘트를 저장하여 피드백을 전달하는 액션 버튼.

---

### [SCR-B-TASK-006] PO 변경 요청 딥링크 사전 입력
- **File:** `02_SCREENSHOTS/SCR-B-TASK-006.png`
- **Chapter Mapping:** Chapter 6.1 — 발주(PO) 상세 연계 문의
- **UI State:** 발주 관리 화면에서 `[발주 문의]`를 클릭하여 PO 번호와 외래키가 바인딩된 모달.
- **Callout Pins & Explanations:**
  - `(1)` **자동 지정된 PO 변경 카테고리**: 드롭다운이 `po_change (PO 변경 요청)`으로 자동 잠금/지정.
  - `(2)` **사전 주입된 발주 번호**: 제목에 `[PO-2026-0008]` 발주 번호가 자동 삽입.
  - `(3)` **외래키(FK) 연계**: 데이터베이스 상의 `related_po_id` 필드에 실제 발주서 식별자가 바인딩.

---

### [SCR-B-TASK-007] 정산 문의 딥링크 사전 입력
- **File:** `02_SCREENSHOTS/SCR-B-TASK-007.png`
- **Chapter Mapping:** Chapter 6.2 — 정산 및 계약 연계 문의
- **UI State:** 정산 관리 화면에서 문의하기를 클릭하여 매입전표(AP) 번호가 삽입된 모달.
- **Callout Pins & Explanations:**
  - `(1)` **정산/인보이스 카테고리**: 드롭다운이 `settlement`로 자동 선택.
  - `(2)` **AP 전표 번호 사전 바인딩**: 제목 및 설명에 정산 대상 매입전표 번호가 자동 구성.

---

### [SCR-B-TASK-008] 헤더 인앱 알림 피드
- **File:** `02_SCREENSHOTS/SCR-B-TASK-008.png`
- **Chapter Mapping:** Chapter 7.1 — 인앱 알림 및 이메일 수신 메커니즘
- **UI State:** 상단 헤더의 종(Bell) 아이콘을 클릭하여 최신 알림 목록 드롭다운이 열린 화면.
- **Callout Pins & Explanations:**
  - `(1)` **헤더 알림 벨 아이콘**: 읽지 않은 알림 개수를 표시하는 붉은색 배지.
  - `(2)` **문의 알림 항목**: 운영팀 답변 및 조치 요청 알림 피드.
  - `(3)` **클릭 시 케이스 직행 링크**: 알림을 클릭하면 해당 케이스 상세 화면으로 즉시 이동.

---

### [SCR-B-TASK-009] 뷰어 역할 읽기 전용 모드
- **File:** `02_SCREENSHOTS/SCR-B-TASK-009.png`
- **Chapter Mapping:** Chapter 7.3 — 역할별 ACL 권한 통제
- **UI State:** `support:read` 권한을 가진 사용자가 지원 센터에 접속한 화면.
- **Callout Pins & Explanations:**
  - `(1)` **신규 작성 버튼 미노출**: 상단의 `[+ 새 문의 작성]` 버튼이 비노출 처리됨.
  - `(2)` **대화 입력창 비활성화**: 스레드 상세 화면에서 답변 전송 입력창이 잠금 처리됨.

---

### [SCR-B-TASK-010] 권한 없음 접근 차단 화면
- **File:** `02_SCREENSHOTS/SCR-B-TASK-010.png`
- **Chapter Mapping:** Chapter 7.3 — 역할별 ACL 권한 통제
- **UI State:** `support:none` 권한을 가진 사용자가 `/portal/support`에 접속 시 표시되는 차단 뷰.
- **Callout Pins & Explanations:**
  - `(1)` **접근 권한 제한 경고**: 지원 센터 열람 권한이 없음을 알리는 보안 안내 문구.
  - `(2)` **회사 관리자 문의 안내**: 권한 변경을 위해 회사 마스터 관리자에게 문의하도록 유도.

---

### [SCR-B-TASK-011] 어드민 파트너 문의 관리 콘솔 (Reference)
- **File:** `02_SCREENSHOTS/SCR-B-TASK-011.png`
- **Chapter Mapping:** Chapter 8 — 부록: 어드민 운영 콘솔 연계
- **UI State:** K SELECT 운영팀이 파트너사의 문의를 심사하고 답변을 작성하는 관리자 콘솔.
- **Callout Pins & Explanations:**
  - `(1)` **파트너사별 문의 집계 테이블**: 전체 브랜드사의 케이스 목록 및 실시간 상태 모니터링.
  - `(2)` **조치 요청 플래그 스위치**: 운영팀이 브랜드사에 `ACTION_REQUIRED`를 설정하는 컨트롤.

---

### [SCR-B-TASK-012] 어드민 내부 일감 콘솔 (Reference)
- **File:** `02_SCREENSHOTS/SCR-B-TASK-012.png`
- **Chapter Mapping:** Chapter 8 — 부록: 어드민 운영 콘솔 연계
- **UI State:** 어드민 내부 일감 스키마(`public.tasks`)를 모니터링하는 내부 관리 화면.
- **Callout Pins & Explanations:**
  - `(1)` **내부 작업 목록**: 운영팀 내부 할 일 및 진행률 모니터링 뷰.
  - `(2)` **파트너 문의와의 분리**: `partner_inquiries`와는 상호 독립된 별개 스키마로 운영됨을 확인.

---
*End of SCREENSHOT_ANNOTATION_GUIDE.md*
