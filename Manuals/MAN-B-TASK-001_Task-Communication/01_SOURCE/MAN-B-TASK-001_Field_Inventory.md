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
| `related_po_id` | `uuid` | YES | NULL | `purchase_orders(id)` | **FK Relation**: 연계된 발주서(PO) ID |
| `related_invoice_id` | `uuid` | YES | NULL | — | 연계된 인보이스 컨텍스트 ID |
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
| `attachment_path` | `text` | YES | NULL | — | 메시지 첨부파일 Storage 경로 (`company-uploads`) |
| `attachment_filename`| `text` | YES | NULL | — | 메시지 첨부파일 원본 파일명 |
| `created_at` | `timestamptz` | NO | `now()` | — | 메시지 등록 일시 |

---

### 1.3 Table: `public.company_task_assignments` (회사 6대 업무별 주 담당자 라우팅)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `company_id` | `uuid` | NO | — | `companies(id)` | 회사 ID |
| `user_id` | `uuid` | NO | — | `company_users(id)` | 배정된 직원 ID |
| `task_code` | `text` | NO | — | `check_task_code` (6 Tasks) | `company_apply`, `contract`, `product_cert`, `pricing_quote`, `logistics_inventory`, `settlement_inquiry` |
| `is_primary` | `boolean` | NO | `false` | Unique per company | 해당 업무의 단일 주 담당자 여부 (회사당 1명) |
| `email_notify` | `boolean` | NO | `false` | — | 해당 업무 이메일 알림 수신 여부 |
| `updated_at` | `timestamptz` | NO | `now()` | — | 설정 변경 일시 |
| `updated_by` | `uuid` | YES | NULL | `profiles(id)` | 변경자 ID |
| `updated_path` | `text` | NO | — | `IN ('portal', 'admin')` | 변경 발생 경로 |

---

### 1.4 Table: `public.tasks` (어드민 내부 일감 스키마 — 미연계 상태)

| Column Name | Data Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | 태스크 고유 ID |
| `title` | `text` | NO | — | 태스크 제목 |
| `description` | `text` | YES | NULL | 태스크 상세 내용 |
| `company_id` | `uuid` | YES | NULL | 대상 회사 ID |
| `owner_id` | `uuid` | YES | NULL | 담당 운영 직원 ID |
| `priority` | `text` | NO | `'Medium'` | `'Low'`, `'Medium'`, `'High'`, `'Urgent'` |
| `status` | `text` | NO | `'Not Started'` | `'Not Started'`, `'In Progress'`, `'Completed'`, `'Waiting'` |
| `due_date` | `date` | YES | NULL | 완료 목표일 |

---

## 2. Status Models & Enums

### 2.1 4대 공식 케이스 표시 상태 (`OfficialCaseStatus`)

| 표시 상태 코드 | 한글 표기 | UI 배지 스타일 | 매핑되는 내부 DB `status` |
| :--- | :--- | :--- | :--- |
| `RECEIVED` | **접수됨** | `bg-amber-50 text-amber-800 border-amber-200` (🟡) | `open`, `pending` |
| `UNDER_REVIEW` | **검토중** | `bg-blue-50 text-blue-800 border-blue-200` (🔵) | `in_review`, `replied`, `processing`, `under_review`, `action_resolved`, `awaiting_reply`, `reopened` |
| `ACTION_REQUIRED` | **조치필요** | `bg-rose-50 text-rose-800 border-rose-200` (🔴) | `action_required` |
| `CLOSED` | **종료됨** | `bg-zinc-100 text-zinc-700 border-zinc-200` (⚫) | `closed`, `resolved` |

---

### 2.2 브랜드 포털 문의 9대 카테고리 (`category`)

| 코드 | 한글 명칭 | 영문 명칭 | 연계 도메인 / 특징 |
| :--- | :--- | :--- | :--- |
| `po_change` | **PO 변경 요청** | PO Change Request | 발주 수량, 단가, 출고지 변경 (`related_po_id` FK 연동) |
| `agreement_change`| **계약 변경 및 서명** | Agreement Change Request | 기본계약서 조항 및 서명권자 변경 문의 |
| `product` | **제품 등록 및 정보수정**| Product Registration | 제품 스펙, 성분표, 바코드 수정 요청 |
| `onboarding` | **입점 신청 및 심사** | Onboarding Review | 입점 심사 보완 서류 제출 |
| `logistics` | **물류 공급 및 패키징** | Logistics & Packaging | 카톤 규격, CBM, 선적항 문의 |
| `translation` | **번역 및 전성분표** | Translation & Ingredients| 영문 라벨 및 FDA 규정 성분 표기 |
| `settlement` | **정산 / 인보이스 문의**| Settlement / Invoice | 정산 금액, 세금계산서, AP 전표 문의 |
| `system` | **시스템 오류 및 제안** | System & Tech Support | 포털 기능 오류 제보 및 권한 문의 |
| `general` | **기타 일반 문의** | General Inquiry | 기타 파트너십 및 일반 운영 문의 |

---

## 3. UI Form Fields & Storage Specs

- **스토리지 버킷**: `"company-uploads"`
- **저장 경로**: `${companyId}/inquiries/${crypto.randomUUID()}.${ext}`
- **파일 크기 제한**: 최대 **20MB** (`validateUploadedFile`)
- **허용 MIME 타입**: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`
- **다운로드 방식**: `getSignedFileUrl("company-uploads", path)` 시간 제한 서명 URL

---
*End of MAN-B-TASK-001_Field_Inventory.md*
