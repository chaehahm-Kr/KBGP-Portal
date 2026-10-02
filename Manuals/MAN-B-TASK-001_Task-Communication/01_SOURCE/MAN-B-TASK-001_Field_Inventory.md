# FIELD INVENTORY: MAN-B-TASK-001
## Task & Communication System Field & Data Dictionary

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## 1. Database Schema Inventory

### 1.1 Table: `public.partner_inquiries` (1:1 케이스 및 문의 마스터)

| Column Name | Data Type | Nullable | Default | FK / References | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key | 케이스 고유 식별자 |
| `case_number` | `varchar(50)` | YES | NULL | — | 인간 가독형 케이스 식별 번호 (예: `CASE-2026-0042`) |
| `company_id` | `uuid` | NO | — | `companies(id)` | 문의를 등록한 회사/테넌트 ID |
| `created_by` | `uuid` | NO | — | `auth.users(id)` | 문의 작성자 사용자 ID |
| `category` | `varchar(50)` | NO | — | — | 문의 분류 카테고리 코드 |
| `title` | `varchar(200)` | NO | — | — | 문의 제목 |
| `content` | `text` | NO | — | — | 문의 본문 상세 내용 |
| `status` | `varchar(50)` | NO | `'open'` | — | 케이스 세부 진행 상태 |
| `priority` | `varchar(20)` | YES | `'normal'` | — | 케이스 우선순위 (`normal`, `high`, `urgent`) |
| `is_action_required` | `boolean` | NO | `false` | — | 브랜드사의 추가 조치 필요 여부 플래그 |
| `attachment_path` | `text` | YES | NULL | — | 최초 첨부파일 Storage 저장 경로 |
| `attachment_filename`| `text` | YES | NULL | — | 최초 첨부파일 원본 파일명 |
| `reply_content` | `text` | YES | NULL | — | 관리자 최종 답변 내용 (레거시 호환) |
| `replied_by` | `uuid` | YES | NULL | `staff_members(id)` | 답변 작성 어드민 직원 ID |
| `replied_at` | `timestamptz` | YES | NULL | — | 최초/최근 답변 일시 |
| `closed_at` | `timestamptz` | YES | NULL | — | 케이스 종결 완료 일시 |
| `closed_by` | `uuid` | YES | NULL | `auth.users(id)` | 케이스를 종결한 사용자/어드민 ID |
| `closed_by_side` | `text` | YES | NULL | — | 종결 주체 (`admin` 또는 `portal`) |
| `reopen_count` | `integer` | NO | `0` | — | 케이스 재오픈 누적 횟수 |
| `satisfaction_score` | `integer` | YES | NULL | — | 브랜드사 제출 만족도 점수 (1~5점) |
| `satisfaction_comment`| `text` | YES | NULL | — | 브랜드사 제출 만족도 평가 코멘트 |
| `source_type` | `text` | YES | `'brand'` | — | 파트너 구분 (`brand` / `retailer`) |
| `assigned_team` | `text` | YES | NULL | — | 담당 운영팀 (예: `운영지원팀`, `정산재무팀`) |
| `assigned_to` | `uuid` | YES | NULL | `staff_members(id)` | 배정된 K SELECT 담당 심사관/운영 직원 ID |
| `related_po_id` | `uuid` | YES | NULL | `purchase_orders(id)` | 연계된 발주서(PO) ID |
| `related_invoice_id` | `uuid` | YES | NULL | — | 연계된 인보이스 ID |
| `created_at` | `timestamptz` | NO | `now()` | — | 케이스 생성 일시 |
| `updated_at` | `timestamptz` | NO | `now()` | — | 케이스 최종 수정 일시 |

---

### 1.2 Table: `public.partner_inquiry_messages` (양방향 대화 및 이벤트 스레드)

| Column Name | Data Type | Nullable | Default | FK / References | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key | 메시지 고유 식별자 |
| `inquiry_id` | `uuid` | NO | — | `partner_inquiries(id)` | 소속 케이스/문의 ID (CASCADE) |
| `sender_type` | `varchar(20)` | NO | — | — | 발신 주체 (`partner`, `admin`, `system`) |
| `sender_id` | `uuid` | YES | NULL | `auth.users(id)` | 발신자 계정 ID |
| `sender_name` | `varchar(100)` | NO | — | — | 화면 표시용 발신자 성명/직함 |
| `content` | `text` | NO | — | — | 메시지 본문 |
| `message_type` | `varchar(30)` | NO | `'message'` | — | 메시지 유형 (`message`, `action_required`, `action_resolved`, `status_change`, `case_closed`, `case_reopened`, `satisfaction`) |
| `is_action_flag` | `boolean` | NO | `false` | — | 조치 요구 플래그 |
| `attachment_path` | `text` | YES | NULL | — | 메시지 첨부파일 Storage 경로 |
| `attachment_filename`| `text` | YES | NULL | — | 메시지 첨부파일 원본 파일명 |
| `created_at` | `timestamptz` | NO | `now()` | — | 메시지 등록 일시 |

---

### 1.3 Table: `public.notifications` (인앱 알림 피드)

| Column Name | Data Type | Nullable | Default | FK / References | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key | 알림 고유 식별자 |
| `user_id` | `uuid` | YES | NULL | `auth.users(id)` | 수신 대상 사용자 ID |
| `company_id` | `uuid` | YES | NULL | `companies(id)` | 수신 대상 회사 ID |
| `sender_id` | `uuid` | YES | NULL | `auth.users(id)` | 발신자 ID |
| `type` | `varchar(50)` | NO | — | — | 알림 유형 (`INQUIRY_REPLY`, `ACTION_REQUIRED`, `PO_STATUS_CHANGE` 등) |
| `title` | `varchar(200)` | NO | — | — | 알림 헤드라인 제목 |
| `content` | `text` | NO | — | — | 알림 요약 내용 |
| `link_url` | `varchar(255)` | YES | NULL | — | 클릭 시 이동할 포털 내부 링크 |
| `is_read` | `boolean` | NO | `false` | — | 인앱 읽음 여부 |
| `metadata` | `jsonb` | NO | `'{}'` | — | 관련 비즈니스 컨텍스트 메타데이터 |
| `created_at` | `timestamptz` | NO | `now()` | — | 알림 발생 일시 |

---

### 1.4 Table: `public.company_task_assignments` (회사 6대 업무별 주 담당자 라우팅)

| Column Name | Data Type | Nullable | Default | FK / References | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `company_id` | `uuid` | NO | — | `companies(id)` | 회사 ID |
| `user_id` | `uuid` | NO | — | `company_users(id)` | 배정된 직원 ID |
| `task_code` | `text` | NO | — | — | 업무 분류 코드 (6대 영역) |
| `is_primary` | `boolean` | NO | `false` | — | 해당 업무의 단일 주 담당자 여부 (회사당 1명) |
| `email_notify` | `boolean` | NO | `false` | — | 해당 업무 이메일 알림 수신 여부 |
| `updated_at` | `timestamptz` | NO | `now()` | — | 설정 변경 일시 |
| `updated_by` | `uuid` | YES | NULL | `profiles(id)` | 변경자 ID |
| `updated_path` | `text` | NO | — | — | 변경 발생 경로 (`portal` / `admin`) |

---

## 2. Enums, Status Models & Taxonomies

### 2.1 4대 공식 케이스 상태 (Official Case Status)

| Official Status Code | 한글 표기 | UI 배지 스타일 | 포털 사용자 가이드 |
| :--- | :--- | :--- | :--- |
| `RECEIVED` | **접수됨** | `bg-amber-50 text-amber-800 border-amber-200` (🟡) | 신규 문의가 정상 등록되어 담당자 배정 및 검토를 대기 중인 상태 |
| `UNDER_REVIEW` | **검토중** | `bg-blue-50 text-blue-800 border-blue-200` (🔵) | 운영팀 담당자가 배정되어 문의 내용을 분석하고 답변을 준비 중인 상태 |
| `ACTION_REQUIRED` | **조치필요** | `bg-rose-50 text-rose-800 border-rose-200` (🔴) | 운영팀 요청에 따라 브랜드사의 추가 서류 제출 또는 정보 수정이 필요한 상태 |
| `CLOSED` | **종료됨** | `bg-zinc-100 text-zinc-700 border-zinc-200` (⚫) | 답변이 완료되어 케이스가 종결된 상태 (만족도 평가 가능) |

---

### 2.2 브랜드 포털 문의 9대 카테고리 (`category`)

| 카테고리 코드 (`key`) | 한글 명칭 | 영문 명칭 | 대표 문의 내용 및 연계 도메인 |
| :--- | :--- | :--- | :--- |
| `po_change` | **PO 변경 요청** | PO Change Request | 발주 수량, 단가, 납기일, 출고지 변경 요청 (`MAN-B-ORD-001`) |
| `agreement_change`| **계약 변경 및 서명** | Agreement Change Request | 기본계약서 조항 수정 요청, 서명권자 변경 (`MAN-B-PERM-001`) |
| `product` | **제품 등록 및 정보수정**| Product Registration | 제품 스펙, 전성분, 이미지, 바코드 수정 요청 |
| `onboarding` | **입점 신청 및 심사** | Onboarding Review | 입점 심사 보완 요청, 서류 추가 제출 |
| `logistics` | **물류 공급 및 패키징** | Logistics & Packaging | 카톤 규격, CBM, 선적항, 포워더 배차 문의 (`MAN-B-LOG-001`) |
| `translation` | **번역 및 전성분표** | Translation & Ingredients| 영문 라벨 번역, FDA 규정 전성분 표기 문의 |
| `settlement` | **정산 / 인보이스 문의**| Settlement / Invoice | 세금계산서, 지급 일정, 수수료, AP 전표 문의 (`MAN-B-FIN-001`) |
| `system` | **시스템 오류 및 제안** | System & Tech Support | 포털 기능 오류 제보, 권한 이상, 개선 아이디어 |
| `general` | **기타 일반 문의** | General Inquiry | 기타 파트너십 및 일반 운영 문의 |

---

### 2.3 메시지 스레드 유형 (`message_type`)

| Message Type | 아이콘 / 태그 | 설명 |
| :--- | :---: | :--- |
| `message` | 💬 | 일반 텍스트 대화 및 첨부파일 메시지 |
| `action_required` | ⚠️ **조치요청** | 브랜드사의 후속 조치를 공식 요구하는 메시지 |
| `action_resolved` | ✅ **조치완료** | 브랜드사가 조치를 이행하여 시스템에 기록된 이벤트 |
| `status_change` | 🔄 **상태변경** | 검토중 $\leftrightarrow$ 접수됨 등 상태 전환 알림 |
| `case_closed` | 🔒 **케이스종료** | 문의 해결 완료 및 종결 안내 |
| `case_reopened` | 🔓 **케이스재오픈** | 종결된 문의에 추가 질문이 등록되어 재활성화됨 |
| `satisfaction` | ⭐ **만족도평가** | 케이스 종결 후 제출된 별점 및 피드백 코멘트 |

---

## 3. UI Form Fields & Validation Rules

### 3.1 새 1:1 문의 등록 폼 (`New Inquiry Form`)
- **문의 카테고리 (`category`)**: 드롭다운 선택 (필수, 기본값: `general` 또는 URL 파라미터).
- **문의 제목 (`title`)**: 단일 텍스트 입력 (필수, 최소 2자 ~ 최대 200자).
- **문의 내용 (`content`)**: 멀티라인 텍스트에어리어 (필수, 최소 5자 이상).
- **첨부파일 (`attachment`)**:
  - 허용 포맷: PDF(`.pdf`), 이미지(`.png`, `.jpg`, `.jpeg`, `.webp`).
  - 단일 파일 최대 용량: 10MB.
  - 보안: Private Storage 버킷(`inquiry-attachments`)에 저장되며 Signed URL을 통해서만 접근 가능.
- **사전 입력(Prefill) 컨텍스트 배지**:
  - 발주서 연계 시: `[PO-2026-0008]` 파란색 배지 상단 표시.
  - 정산서 연계 시: `[AP-2026-0012]` 청록색 배지 상단 표시.

### 3.2 스레드 답변 작성 폼 (`Thread Reply Form`)
- **답변 내용 (`content`)**: 멀티라인 텍스트에어리어 (필수).
- **추가 첨부파일 (`attachment`)**: 선택 사항 (최대 10MB).
- **조치 요청 플래그 (어드민 전용)**: `isActionRequired` 체크박스.
- **이메일 알림 발송 (어드민 전용)**: `sendEmail` 체크박스.

### 3.3 케이스 종결 및 만족도 평가 모달 (`CSAT Rating Modal`)
- **별점 선택 (`satisfaction_score`)**: 1점부터 5점까지 별 클릭 (필수).
- **상세 평가 코멘트 (`satisfaction_comment`)**: 텍스트 입력 (선택).

---
*End of MAN-B-TASK-001_Field_Inventory.md*
