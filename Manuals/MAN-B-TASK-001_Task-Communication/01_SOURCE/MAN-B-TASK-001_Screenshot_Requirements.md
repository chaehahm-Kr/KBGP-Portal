# SCREENSHOT REQUIREMENTS: MAN-B-TASK-001
## Production Screenshot Matrix & Annotation Specification

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## 1. Screenshot Matrix Overview

| Screenshot ID | Semantic Screen Name | Target Route / URL | Target Chapter | Aspect / Viewport | Priority |
| :--- | :--- | :--- | :---: | :--- | :---: |
| `SCR-B-TASK-001` | Support Center Main Hub & Case List | `/portal/support` | Chapter 2.1 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-TASK-002` | New 1:1 Inquiry Submission Modal | `/portal/support?new=1` | Chapter 3.1 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-TASK-003` | Threaded Conversation & Message Stream | `/portal/support?case=CASE-2026-0001` | Chapter 4.1 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-TASK-004` | Action Required Alert & Supplement Reply Form | `/portal/support?case=CASE-2026-0002` | Chapter 4.2 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-TASK-005` | Case Closed & CSAT Satisfaction Rating | `/portal/support?case=CASE-2026-0003` | Chapter 4.3 | Desktop 1440×900 | **P0 (Core)** |
| `SCR-B-TASK-006` | PO Change Request Deep Link Prefill | `/portal/support?new=1&category=po_change&po_no=PO-2026-0008` | Chapter 5.1 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-TASK-007` | Settlement Inquiry Deep Link Prefill | `/portal/support?new=1&category=settlement&ap_no=AP-2026-0012` | Chapter 5.2 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-TASK-008` | In-App Header Notification Feed | `/portal` (Header Bell Dropdown) | Chapter 6.1 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-TASK-009` | Viewer Role Read-Only Restriction | `/portal/support` (`support:read`) | Chapter 7.1 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-TASK-010` | Access Denied View (No Support Permission) | `/portal/support` (`support:none`) | Chapter 7.1 | Desktop 1440×900 | **P1 (Supporting)** |
| `SCR-B-TASK-011` | Admin Partner Inquiries Console (Reference) | `/admin/partner-inquiries` | Chapter 6.2 | Desktop 1440×900 | **P2 (Optional)** |
| `SCR-B-TASK-012` | Admin Internal Tasks Console (Reference) | `/admin/tasks` | Chapter 1.2 | Desktop 1440×900 | **P2 (Optional)** |

---

## 2. Detailed Screenshot Specification & Callout Points

### [SCR-B-TASK-001] 지원 센터 메인 허브 및 케이스 목록 (`/portal/support`)
- **UI State**: 등록된 여러 건의 문의가 목록에 표시된 상태 (다양한 상태 배지: `접수됨`, `검토중`, `조치필요`, `종료됨`).
- **Must-Show Elements**:
  1. 상단 타이틀 및 `[+ 새 문의 작성]` 파란색 버튼.
  2. 상태 필터 탭 (전체 / 접수됨 / 검토중 / 조치필요 / 종료됨).
  3. 케이스 목록 카드 (케이스 번호, 카테고리 태그, 제목, 최종 업데이트 일시, 상태 배지).
- **Callout Pins**:
  - `(1)` `[+ 새 문의 작성]` 버튼
  - `(2)` 4대 공식 상태 필터 탭
  - `(3)` 케이스 식별 번호 (`CASE-XXXX`)
  - `(4)` 조치필요(`ACTION_REQUIRED`) 붉은색 강조 배지

---

### [SCR-B-TASK-002] 새 1:1 문의 등록 모달 (`/portal/support?new=1`)
- **UI State**: 신규 문의 작성 모달이 중앙에 열려 있는 상태.
- **Must-Show Elements**:
  1. 문의 분류 드롭다운 (9대 카테고리).
  2. 문의 제목 입력 필드.
  3. 문의 내용 멀티라인 입력창.
  4. 첨부파일 업로드 박스 (드래그 앤 드롭 및 파일 선택 버튼).
  5. `[취소]` 및 `[문의 등록하기]` 액션 버튼.
- **Callout Pins**:
  - `(1)` 카테고리 선택 드롭다운
  - `(2)` 제목 및 상세 설명 입력란
  - `(3)` 파일 첨부(최대 10MB) 영역
  - `(4)` 제출 버튼

---

### [SCR-B-TASK-003] 양방향 대화 스레드 상세 뷰 (`/portal/support?case=...`)
- **UI State**: 특정 케이스가 선택되어 우측에 대화 스레드가 시간순으로 나열된 상태.
- **Must-Show Elements**:
  1. 케이스 헤더 (케이스 번호, 카테고리, 상태 배지, 최초 등록자 정보).
  2. 사용자 메시지 말풍선 (우측/브랜드사).
  3. 어드민 운영팀 답변 말풍선 (좌측/K SELECT 운영 뱃지).
  4. 첨부파일 다운로드 링크 (Signed URL 서명 연동).
  5. 하단 새 답변 작성 폼.
- **Callout Pins**:
  - `(1)` 케이스 메타데이터 헤더
  - `(2)` 브랜드사 발신 메시지
  - `(3)` K SELECT 운영팀 답변 말풍선
  - `(4)` 암호화 첨부파일 다운로드

---

### [SCR-B-TASK-004] 조치 필요(Action Required) 배너 및 보완 폼
- **UI State**: 어드민이 조치 요청을 보낸 케이스 상세 화면 (`ACTION_REQUIRED`).
- **Must-Show Elements**:
  1. 상단 붉은색 경고 배너 (`⚠️ 운영팀의 추가 조치가 필요한 사안입니다`).
  2. 운영팀의 구체적 보완 요구 메시지 (`⚠️ 조치요청` 태그).
  3. 하단 보완 서류 업로드 및 답변 입력창.
- **Callout Pins**:
  - `(1)` 조치 필요 상단 안내 배너
  - `(2)` 조치 요청 플래그 메시지
  - `(3)` 보완 서류 첨부 및 회신 입력 영역

---

### [SCR-B-TASK-005] 케이스 종결 및 5점 만족도 평가 (CSAT)
- **UI State**: 케이스가 `CLOSED` 처리된 후 하단에 만족도 평가 UI가 활성화된 화면.
- **Must-Show Elements**:
  1. 종결 완료 회색 배지 (`⚫ 종료됨`).
  2. 만족도 별점 선택기 (1★ ~ 5★).
  3. 상세 의견 입력란 및 `[만족도 제출]` 버튼.
- **Callout Pins**:
  - `(1)` 케이스 종결 표시
  - `(2)` 5점 별점 평가 컴포넌트
  - `(3)` 만족도 제출 버튼

---

### [SCR-B-TASK-006] 발주(PO) 변경 요청 딥링크 연계 화면
- **UI State**: PO 상세 화면에서 `[PO 변경 요청]`을 눌러 열린 문의 모달.
- **Must-Show Elements**:
  1. 카테고리가 `PO 변경 요청`으로 자동 고정.
  2. 상단에 `[연계 발주서: PO-2026-0008]` 파란색 컨텍스트 배지 표시.
  3. 제목에 `[PO-2026-0008] 변경 요청` 자동 제안.
- **Callout Pins**:
  - `(1)` 자동 바인딩된 발주서 식별 배지
  - `(2)` 자동 설정된 `po_change` 카테고리

---

### [SCR-B-TASK-007] 정산(Settlement) 문의 딥링크 연계 화면
- **UI State**: 정산/인보이스 화면에서 `[정산 문의]`를 눌러 열린 문의 모달.
- **Must-Show Elements**:
  1. 카테고리가 `정산 / 인보이스 문의`로 자동 고정.
  2. `[연계 정산전표: AP-2026-0012]` 청록색 컨텍스트 배지 표시.
- **Callout Pins**:
  - `(1)` 자동 바인딩된 정산 전표 식별 배지
  - `(2)` 자동 설정된 `settlement` 카테고리

---

### [SCR-B-TASK-008] 포털 헤더 알림 센터 드롭다운 피드
- **UI State**: 포털 우측 상단 종(🔔) 아이콘을 클릭하여 알림 드롭다운이 열린 상태.
- **Must-Show Elements**:
  1. 읽지 않은 알림 빨간색 뱃지.
  2. 1:1 문의 답변 및 조치 요청 알림 리스트.
  3. 클릭 시 해당 케이스로 직행하는 딥링크.
- **Callout Pins**:
  - `(1)` 미확인 알림 카운트 뱃지
  - `(2)` 케이스 답변 알림 항목
  - `(3)` 전체 읽음 처리 액션

---

### [SCR-B-TASK-009] 조회자(Viewer) 역할 읽기 전용 제한 화면
- **UI State**: `support:read` 권한을 가진 사용자 화면.
- **Must-Show Elements**:
  1. `[+ 새 문의 작성]` 버튼 비노출.
  2. 하단 답변 입력창이 비활성화되고 "조회 전용 권한입니다" 툴팁/배너 노출.
- **Callout Pins**:
  - `(1)` 신규 작성 버튼 숨김
  - `(2)` 답변 입력 비활성화 안내

---

### [SCR-B-TASK-010] 접근 권한 없음(Access Denied) 화면
- **UI State**: `support:none` 권한을 가진 사용자가 `/portal/support` 직접 접근 시.
- **Must-Show Elements**:
  1. 자물쇠 아이콘 및 `접근 권한이 없습니다` 안내.
  2. 관리자에게 권한 조정을 요청하라는 안내 문구.
- **Callout Pins**:
  - `(1)` 접근 제한 안내 화면

---

### [SCR-B-TASK-011] 어드민 파트너 문의 통합 관리 화면 (Reference)
- **UI State**: K SELECT 어드민 `/admin/partner-inquiries` 메인 화면.
- **Must-Show Elements**:
  1. 전체 회사 문의 목록 및 회사명 컬럼.
  2. 담당 팀 배정 드롭다운 및 상태 변경 컨트롤러.
  3. 답변 작성 폼의 `조치 필요(isActionRequired)` 및 `이메일 발송` 체크박스.
- **Callout Pins**:
  - `(1)` 다중 테넌트 문의 목록
  - `(2)` 조치 요청 플래그 컨트롤

---

### [SCR-B-TASK-012] 어드민 내부 할 일(Tasks) 관리 화면 (Reference)
- **UI State**: `/admin/tasks` 운영팀 일감 모니터링 화면.
- **Must-Show Elements**:
  1. Task Title, Company, Priority, Status, Owner, Due Date 테이블.
- **Callout Pins**:
  - `(1)` 운영팀 내부 업무 모니터링 테이블

---
*End of MAN-B-TASK-001_Screenshot_Requirements.md*
