# PRODUCTION SOURCE COLLECTION REPORT: MAN-B-TASK-001
## Task & Communication Guide (할 일, 업무 조율 및 1:1 케이스 소통 가이드)

- **Manual ID:** `MAN-B-TASK-001`
- **Task ID:** `MAN-B-TASK-001-SRC-001`
- **Topic:** `Task & Communication (업무 할 일, 1:1 문의 및 브랜드 ↔ 어드민 케이스 소통)`
- **Audience:** `B — Brand Portal Users (회사 관리자, 운영 실무자, 권한 보유 사용자)`
- **Authoritative Date:** 2026-10-02
- **Source of Truth:** Production Codebase (`app/portal/support/*`, `app/admin/partner-inquiries/*`, `app/admin/tasks/*`, `lib/inquiry/*`, `lib/company/task-*`, `lib/notification/*`, `supabase/migrations/*`)

---

## 1. Executive Summary & Core Objective

본 문서는 K SELECT Brand Portal 및 Admin 콘솔에 실제 구현된 **Task(업무) & Communication(소통/케이스 관리)** 시스템의 프로덕션 코드, 데이터베이스 스키마, 서버 액션, API 라우트, RLS 보안 정책 및 알림 메커니즘을 전수 조사하여 정리한 **공식 01_SOURCE 보고서**입니다.

K SELECT의 Task & Communication 도메인은 브랜드사와 K SELECT 운영 본부(Letusto Admin) 간의 신속하고 투명한 협업을 지원하는 **티켓/케이스 기반 양방향 스레드 소통 시스템**과 **도메인별 비즈니스 액션 아이템 처리 메커니즘**으로 구성되어 있습니다.

---

## 2. Critical Boundary: Two Distinct "Task" Models in K SELECT

K SELECT 시스템에는 서로 다른 목적과 생명주기를 가진 두 가지 "Task" 개념이 존재하며, 이를 명확히 분리하여 이해해야 합니다:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           K SELECT TWO-LAYER TASK ARCHITECTURE                          │
├─────────────────────────────────────────────┬───────────────────────────────────────────┤
│ Layer A: Company Operational Contact Tasks  │ Layer B: Work Item / Case Communication   │
│ (MAN-B-PERM-001 연계)                       │ (MAN-B-TASK-001 본 매뉴얼 관할)          │
├─────────────────────────────────────────────┼───────────────────────────────────────────┤
│ • Table: `company_task_assignments`         │ • Table: `partner_inquiries`,             │
│ • Concept: 회사 단위 6대 업무별 주 담당자   │          `partner_inquiry_messages`,      │
│   및 이메일 알림 라우팅 수신인 지정         │          `tasks`                          │
│ • 6대 영역: 계약, 신청, 제품인증, 견적,     │ • Concept: 개별 업무 이슈, 발주 변경 요청,│
│   물류재고, 정산문의                        │   정산 문의, 조치요청(Action Item),       │
│ • 목적: 시스템 알림 및 대외 소통 창구 지정  │   양방향 스레드 대화 및 티켓 종결         │
│ • 특징: ACL 권한과 독립적 정적 담당자 매핑 │ • 특징: 실시간 상태 전이 및 감사 추적     │
└─────────────────────────────────────────────┴───────────────────────────────────────────┘
```

> **Canonical Boundary Rule**:
> `MAN-B-PERM-001`의 "Operational Task Assignment"는 특정 업무 영역의 **대표 수신인/주 담당자(Primary Contact)**를 지정하는 계정 설정이며, `MAN-B-TASK-001`의 "Task & Communication"은 실제 발생한 비즈니스 이슈, 문의, 발주 변경, 조치 요구사항을 등록하고 대화로 해결하는 **실행형 케이스/티켓 워크플로우**입니다.

---

## 3. Production Routes & UI Structure

### 3.1 Brand Portal Routes
| Route | Page / View Component | Access Permission (ACL) | Purpose |
| :--- | :--- | :--- | :--- |
| `/portal/support` | `app/portal/support/page.tsx`<br>`components/support/portal-support-view.tsx` | `support:read` (조회)<br>`support:write` (등록/답변)<br>`support:manage` (종결/평가) | 브랜드사 1:1 문의/케이스 센터 메인 화면 (목록, 상세 대화 스레드, 새 문의 작성 폼, 만족도 평가) |

### 3.2 Admin Routes
| Route | Page / View Component | Admin Roles | Purpose |
| :--- | :--- | :--- | :--- |
| `/admin/partner-inquiries` | `app/admin/partner-inquiries/page.tsx`<br>`components/admin/admin-partner-inquiries.tsx` | `super_admin`, `reviewer`, `admin` | 파트너사(브랜드/리테일러) 1:1 문의 통합 관리, 팀 배정, 답변 발송, 조치 요청/해제, 케이스 종결 |
| `/admin/inquiries` | `app/admin/inquiries/page.tsx`<br>`app/admin/inquiries/[id]/page.tsx` | `super_admin`, `reviewer` | 공개 웹사이트를 통한 비회원 입점/파트너십 문의 수신 및 검토 |
| `/admin/tasks` | `app/admin/tasks/page.tsx` | `super_admin`, `admin` | 운영팀 내부 일감/업무 목록 모니터링 콘솔 |

### 3.3 API Endpoints
| API Endpoint | Method | Purpose |
| :--- | :---: | :--- |
| `/api/inquiries` | POST | 공개 웹 인바운드 문의 접수 |
| `/api/inquiries/send-verification` | POST | 문의자 이메일 인증번호 발송 |
| `/api/inquiries/verify-code` | POST | 인증번호 검증 |

---

## 4. Database Schema & Tables Verified

### 4.1 `public.partner_inquiries` (파트너사 1:1 문의 및 케이스 마스터)
- **Primary Key:** `id` (UUID)
- **Foreign Keys:**
  - `company_id` $\rightarrow$ `public.companies(id)` (ON DELETE CASCADE)
  - `created_by` $\rightarrow$ `auth.users(id)`
  - `related_po_id` $\rightarrow$ `public.purchase_orders(id)` (ON DELETE SET NULL)
  - `assigned_to` $\rightarrow$ `public.staff_members(id)`
- **Key Columns:**
  - `case_number`: `varchar(50)` (예: `CASE-2026-0042`)
  - `category`: `varchar(50)` (`po_change`, `agreement_change`, `product`, `onboarding`, `logistics`, `translation`, `settlement`, `system`, `general` 등)
  - `title`: `varchar(200)`
  - `content`: `text`
  - `status`: `varchar(50)` (`open`, `in_review`, `awaiting_reply`, `action_required`, `action_resolved`, `resolved`, `closed`, `reopened`)
  - `priority`: `varchar(20)` (`normal`, `high`, `urgent`)
  - `is_action_required`: `boolean` (조치 필요 플래그)
  - `attachment_path`: `text` (Supabase Storage 경로)
  - `attachment_filename`: `text` (원본 파일명)
  - `reply_content`: `text` (단일 답변 레거시 호환용)
  - `replied_by`: `uuid` / `replied_at`: `timestamptz`
  - `closed_at`: `timestamptz` / `closed_by`: `uuid` / `closed_by_side`: `text` (`admin` / `portal`)
  - `reopen_count`: `integer` (기본값: 0)
  - `satisfaction_score`: `integer` (1~5점) / `satisfaction_comment`: `text`
  - `source_type`: `text` (`brand` / `retailer`)

### 4.2 `public.partner_inquiry_messages` (양방향 대화 및 이벤트 스레드)
- **Primary Key:** `id` (UUID)
- **Foreign Key:** `inquiry_id` $\rightarrow$ `public.partner_inquiries(id)` (ON DELETE CASCADE)
- **Key Columns:**
  - `sender_type`: `varchar(20)` (`partner`, `admin`, `system`)
  - `sender_id`: `uuid`
  - `sender_name`: `varchar(100)`
  - `content`: `text`
  - `message_type`: `varchar(30)` (`message`, `status_change`, `action_required`, `action_resolved`, `case_closed`, `case_reopened`, `satisfaction`)
  - `is_action_flag`: `boolean` (해당 메시지가 브랜드사 조치를 요구하는지 여부)
  - `attachment_path`: `text` / `attachment_filename`: `text`
  - `created_at`: `timestamptz`

### 4.3 `public.notifications` (사용자 알림 및 인앱 피드)
- **Primary Key:** `id` (UUID)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth.users(id)`
  - `company_id` $\rightarrow$ `public.companies(id)`
- **Key Columns:**
  - `type`: `varchar(50)` (예: `INQUIRY_REPLY`, `ACTION_REQUIRED`, `PO_STATUS_CHANGE`)
  - `title`: `varchar(200)`
  - `content`: `text`
  - `link_url`: `varchar(255)`
  - `is_read`: `boolean` (인앱 읽음 여부)
  - `metadata`: `jsonb`
  - `created_at`: `timestamptz`

### 4.4 `public.tasks` (운영팀 업무 / 할 일 기본 스키마)
- **Primary Key:** `id` (UUID)
- **Columns:** `title`, `description`, `company_id`, `owner_id`, `priority` (`Low`, `Medium`, `High`, `Urgent`), `status` (`Not Started`, `In Progress`, `Completed`, `Waiting`), `due_date`, `created_at`, `updated_at`.

---

## 5. Case Status Model: 4 Official Statuses vs DB Statuses

사용자 UI 복잡도를 줄이고 명확한 의사결정을 유도하기 위해, 시스템은 내부 DB 상태를 4개의 **공식 사용자 표시 상태(Official Case Status)**로 정규화(`getNormalizedStatus`)하여 렌더링합니다:

| 공식 표시 상태 (Official Status) | UI 배지 색상 / 이모지 | 포털 사용자 관점 의미 | 대응되는 DB `status` 값 |
| :--- | :---: | :--- | :--- |
| **`RECEIVED` (접수됨)** | 🟡 Amber (`bg-amber-50`) | 문의가 성공적으로 등록되어 운영팀 확인 대기 중 | `open`, `pending` |
| **`UNDER_REVIEW` (검토중)** | 🔵 Blue (`bg-blue-50`) | K SELECT 담당자가 확인 후 답변 작성 중 또는 검토 진행 중 | `in_review`, `replied`, `processing`, `awaiting_reply`, `reopened` |
| **`ACTION_REQUIRED` (조치필요)** | 🔴 Rose (`bg-rose-50`) | 브랜드사의 추가 서류 제출, 수량 수정, 확인 등 액션이 필요함 | `action_required` |
| **`CLOSED` (종료됨)** | ⚫ Zinc (`bg-zinc-100`) | 문제 해결 및 답변 완료 후 케이스가 최종 마감됨 | `closed`, `resolved`, `action_resolved` |

---

## 6. Communication & Action Item Mechanics

### 6.1 양방향 스레드 대화 (Threaded Conversation)
- 브랜드사 사용자와 어드민 담당자가 하나의 케이스 내에서 타임스탬프 순으로 연속 대화를 나눕니다.
- 발신 주체(`sender_type`)에 따라 UI가 명확히 구분됩니다:
  - `partner`: 브랜드사 담당자 (우측 정렬 또는 브랜드사 컬러)
  - `admin`: K SELECT 운영팀 (좌측 정렬 또는 운영팀 뱃지)
  - `system`: 상태 변경, 케이스 종결, 조치 완료 등 자동 시스템 이벤트 로그

### 6.2 조치 요청(Action Required) 및 해제 플로우
1. 어드민이 답변 작성 시 `isActionRequired: true`를 체크하고 발송하면:
   - 케이스 상태가 **`ACTION_REQUIRED` (🔴 조치필요)**로 즉시 전환됩니다.
   - 해당 메시지에 `⚠️ 조치요청` 라벨이 부착됩니다.
   - 브랜드사 사용자에게 인앱 알림 및 이메일 알림이 전송됩니다.
2. 브랜드사가 요구된 정보를 보완하여 답변(Reply)을 제출하거나 어드민이 조치 완료 처리를 하면:
   - 케이스가 자동으로 **`UNDER_REVIEW` (🔵 검토중)** 상태로 복귀됩니다.
   - 메시지 스레드에 `✅ 조치완료` 시스템 이벤트가 기록됩니다.

### 6.3 케이스 종결 및 만족도 평가 (Resolution & CSAT)
- **종결 주체**: 브랜드사(`closeCase`) 및 관리자(`closeCaseAdmin`, `answerAndClosePartnerInquiry`) 양측 모두 케이스 종결 가능.
- **만족도 평가 (CSAT)**:
  - 케이스가 `CLOSED` 상태가 되면 브랜드사 화면 하단에 5점 만점 별점(`satisfaction_score`) 및 코멘트(`satisfaction_comment`) 입력 폼이 활성화됩니다.
  - 제출된 만족도는 `partner_inquiries` 테이블에 기록되어 서비스 품질 모니터링에 활용됩니다.
- **재오픈 (Reopen)**: 종결된 케이스라도 동일 사안에 추가 문의가 필요한 경우 재오픈 가능 (`reopen_count` 증가).

---

## 7. Cross-Domain Deep Linking & Prefill Mechanics

K SELECT의 Task & Communication 시스템은 타 비즈니스 도메인(발주, 정산, 계약, 제품)에서 문제 발생 시 원클릭으로 컨텍스트를 유지한 채 문의를 시작할 수 있는 강력한 **URL 파라미터 사전 입력(Prefill) 메커니즘**을 탑재하고 있습니다:

```
[ PO 상세 화면 (/portal/orders/[id]) ]
   └─► [PO 변경 요청] 클릭 ──► `/portal/support?new=1&category=po_change&po_id=...&po_no=PO-2026-0008`

[ 정산/인보이스 화면 (/portal/settlement) ]
   └─► [정산 문의] 클릭 ────► `/portal/support?new=1&category=settlement&invoice_id=...&ap_no=AP-2026-0012`

[ 계약 및 약관 화면 (/portal/agreements) ]
   └─► [계약 수정 문의] 클릭 ─► `/portal/support?new=1&category=agreement_change&agreement_id=...`
```

- **지원 도메인 및 쿼리 파라미터**:
  1. **PO 변경 요청 (`po_change`)**: `po_id`, `po_no`, `order_date`, `po_status`, `revision_no` 자동 바인딩.
  2. **정산/인보이스 문의 (`settlement`)**: `invoice_id`, `invoice_no`, `ap_no`, `po_id`, `invoice_total`, `outstanding_balance` 자동 바인딩.
  3. **계약 변경 문의 (`agreement_change`)**: `agreement_id`, `agreement_version`, `agreement_status` 자동 바인딩.

---

## 8. Notification & Read-State System

### 8.1 인앱 알림 (In-App Notifications)
- 브랜드사 사용자가 로그인하면 헤더의 알림 센터에서 미확인 답변 및 조치 요청 목록을 확인할 수 있습니다.
- 읽음 상태는 `company_users.permissions.read_notification_ids` (JSONB 배열) 및 `notifications.is_read`를 통해 사용자별로 추적됩니다.

### 8.2 트랜잭션 이메일 알림 (Transactional Email via Resend)
- 어드민이 문의에 답변하거나 조치를 요청할 때 `sendEmail` 옵션이 활성화되면 브랜드사의 주 담당자(`company_task_assignments.is_primary = true`) 및 알림 수신 동의자에게 즉시 이메일이 발송됩니다.

---

## 9. Security, ACL & RLS Enforcement

1. **포털 ACL 권한 분기 (`support` 카테고리)**:
   - `none (0)`: `/portal/support` 접근 차단 (`AccessDeniedView` 렌더링).
   - `read (1)`: 회사 소속 문의 내역 및 대화 스레드 열람 가능.
   - `write (2)`: 신규 1:1 문의 등록, 대화 스레드 답변 작성, 첨부파일 업로드 가능.
   - `manage (3)`: 케이스 직접 종결(`closeCase`) 및 만족도 평가 제출 가능.
2. **테넌트 격리 (Multi-Tenant RLS)**:
   - 브랜드사 사용자는 본인 회사(`company_id = auth_company_id()`)의 문의 건만 조회 및 수정할 수 있습니다.
   - 타사 문의는 데이터베이스 레벨에서 원천적으로 격리됩니다.

---

## 10. Fact Classification

| 항목 (Fact / Feature) | 상태 (Classification) | 설명 및 코드 근거 |
| :--- | :---: | :--- |
| **Brand Portal 1:1 문의 센터 (`/portal/support`)** | `VERIFIED` | `app/portal/support/page.tsx`, `components/support/portal-support-view.tsx` 완비 |
| **Admin 파트너 문의 관리 (`/admin/partner-inquiries`)** | `VERIFIED` | `app/admin/partner-inquiries/page.tsx`, `components/admin/admin-partner-inquiries.tsx` 완비 |
| **양방향 스레드 대화 (`partner_inquiry_messages`)** | `VERIFIED` | `0023_partner_inquiry_messages.sql`, `replyToPartnerInquiry` 구현 완료 |
| **4대 공식 상태 정규화 (`getNormalizedStatus`)** | `VERIFIED` | `RECEIVED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `CLOSED` 4단계 매핑 완료 |
| **조치 요청 / 조치 완료 플래그 (`is_action_required`)** | `VERIFIED` | `resolvePartnerInquiryAction`, `MSG_TYPE_META` 완비 |
| **도메인 간 Prefill 딥링크 (PO / 정산 / 계약)** | `VERIFIED` | `buildPoChangeInquiryUrl`, `buildSettlementInquiryUrl`, `buildAgreementChangeInquiryUrl` 구현 |
| **첨부파일 업로드 및 Signed URL 서명** | `VERIFIED` | `inquiry-attachments` 버킷, `validateUploadedFile`, `getSignedFileUrl` 완비 |
| **케이스 종결 및 5점 만족도 평가 (CSAT)** | `VERIFIED` | `closeCase`, `submitSatisfactionRating` 구현 완료 |
| **회사 6대 업무별 주 담당자 라우팅 (`company_task_assignments`)** | `VERIFIED` | `0036_company_task_assignments.sql`, `lib/company/task-actions.ts` 완비 |
| **Admin Tasks 일감 모니터링 (`/admin/tasks`)** | `VERIFIED` | `app/admin/tasks/page.tsx` (UI 뷰 구축 완료, 백엔드 연계 기반 확보) |
| **실시간 웹소켓 채팅 (Live Chatting)** | `NOT IMPLEMENTED` | 현재는 비동기 티켓/스레드 방식으로 동작 (실시간 소켓 미적용) |
| **브랜드사 간 티켓 공유 / 공개 포럼** | `NOT IMPLEMENTED` | 테넌트별 1:1 비밀 소통 전용이며 공개 게시판 기능은 제외 |

---
*End of MAN-B-TASK-001_Source_Collection_Report.md*
