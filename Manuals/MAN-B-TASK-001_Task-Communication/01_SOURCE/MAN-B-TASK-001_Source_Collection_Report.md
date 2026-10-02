# PRODUCTION SOURCE COLLECTION REPORT: MAN-B-TASK-001
## Task & Communication Guide (할 일, 업무 조율 및 1:1 케이스 소통 가이드)

- **Manual ID:** `MAN-B-TASK-001`
- **Task ID:** `MAN-B-TASK-001-SRC-001-R1`
- **Topic:** `Task & Communication (업무 할 일, 1:1 문의 및 브랜드 ↔ 어드민 케이스 소통)`
- **Audience:** `B — Brand Portal Users (회사 관리자, 운영 실무자, 권한 보유 사용자)`
- **Authoritative Date:** 2026-10-02
- **Source Basis:** Production Codebase (`app/portal/support/*`, `app/admin/partner-inquiries/*`, `app/admin/tasks/*`, `lib/inquiry/*`, `lib/company/task-*`, `lib/notification/*`, `supabase/migrations/*`)

---

## 1. Executive Summary & Core Objective

본 문서는 K SELECT Brand Portal 및 Admin 콘솔의 **Task(업무) & Communication(1:1 케이스 소통)** 시스템에 대한 프로덕션 코드, 데이터베이스 스키마, 서버 액션, 스토리지 정책, RLS 보안 및 알림 트리거를 전수 검증하여 재작성한 **01_SOURCE 정합성 감사 보고서**입니다.

---

## 2. Critical Architectural Boundaries

### 2.1 PERM Operational Contact Tasks (`MAN-B-PERM-001`) vs Task & Communication (`MAN-B-TASK-001`)

K SELECT 시스템에는 목적과 범위가 완전히 다른 두 개의 업무/태스크 구조가 존재합니다:

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                            TWO DISTINCT TASK & COMMUNICATION DOMAINS                      │
├──────────────────────────────────────────────┬────────────────────────────────────────────┤
│ Domain A: Company Operational Task Routing   │ Domain B: 1:1 Case Communication & Actions │
│ (MAN-B-PERM-001 관할)                        │ (MAN-B-TASK-001 본 매뉴얼 관할)            │
├──────────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Tables: `company_task_assignments`,        │ • Tables: `partner_inquiries`,             │
│          `company_task_assignment_logs`      │          `partner_inquiry_messages`        │
│ • Canonical 6 Tasks (DB Constraint / Code):  │ • Concept: 개별 비즈니스 이슈 제기,        │
│   1. `company_apply` (회사·신청)             │   발주 변경 요청, 정산 전표 문의,          │
│   2. `contract` (계약)                       │   조치 요청(Action Required) 해결,         │
│   3. `product_cert` (제품·콘텐츠·인증)       │   양방향 스레드 대화 및 티켓 종결          │
│   4. `pricing_quote` (가격·견적)             │ • 성격: 동적 티켓/이슈 라이프사이클        │
│   5. `logistics_inventory` (발주·물류·재고)   │ • RLS/권한: `support` 카테고리 ACL 및      │
│   6. `settlement_inquiry` (정산·문의)        │   `requireCompanyMembership()` 테넌트 통제 │
│ • 성격: 회사 단위의 정적 주 담당자/알림 라우팅 │                                            │
└──────────────────────────────────────────────┴────────────────────────────────────────────┘
```

> **Authoritative Task Code Verification**:
> `0036_company_task_assignments.sql`의 `check_task_code` 제약 조건 및 `lib/company/task-constants.ts`에 정의된 공식 6대 업무 코드는 `company_apply`, `contract`, `product_cert`, `pricing_quote`, `logistics_inventory`, `settlement_inquiry`입니다. (일부 기획안에 등장했던 `business_contract` 등은 가상 명칭이며, 실제 프로덕션 DB 및 TS 코드는 위의 6개 코드를 authoritative truth로 사용합니다.)

---

### 2.2 `partner_inquiries` vs `public.tasks`

- **`public.partner_inquiries` & `public.partner_inquiry_messages`**:
  - 브랜드 포털(`/portal/support`) 및 어드민 파트너 문의(`/admin/partner-inquiries`)에서 실제 운영되는 **Active Production 케이스 소통 시스템**입니다.
  - 양방향 스레드 대화, 상태 전이, 조치 플래그, 첨부파일, CSAT 만족도 평가가 정상 동작합니다.
- **`public.tasks`**:
  - `0014_new_modules.sql`에서 생성된 초기 어드민 내부 업무 스키마입니다.
  - 현재 `/admin/tasks` 페이지는 `mockTasks` 기반의 모니터링 뷰로 렌더링되며, `partner_inquiries`와의 FK 연계, 트리거, 자동 생성 로직은 존재하지 않습니다.
  - 따라서 두 시스템은 **독립된 별개 엔터티**로 다루어지며, 파트너 소통의 authoritative model은 `partner_inquiries`입니다.

---

## 3. Case Status Model: Presentation Normalization vs Database Enums

### 3.1 4-Stage Presentation Normalization (`OfficialCaseStatus`)
브랜드 포털 UI(`components/support/portal-support-view.tsx`)는 `lib/inquiry/types.ts`의 `getNormalizedStatus()` 함수를 통해 내부 DB 상태를 4개의 직관적인 표시 상태로 정규화합니다:

| 표시 상태 (`OfficialCaseStatus`) | UI 배지 스타일 | 매핑되는 내부 DB `status` 값 | 사용자 관점 의미 |
| :--- | :---: | :--- | :--- |
| **`RECEIVED` (접수됨)** | 🟡 Amber (`bg-amber-50`) | `open`, `pending` | 문의가 등록되어 K SELECT 운영팀 확인을 대기 중인 상태 |
| **`UNDER_REVIEW` (검토중)** | 🔵 Blue (`bg-blue-50`) | `in_review`, `replied`, `processing`, `under_review`, `action_resolved`, `awaiting_reply`, `reopened` | 어드민 담당자가 내용을 확인하고 검토 및 답변을 진행 중인 상태 |
| **`ACTION_REQUIRED` (조치필요)** | 🔴 Rose (`bg-rose-50`) | `action_required` | 브랜드사의 추가 서류 제출, 정보 수정 등 후속 조치가 요구된 상태 |
| **`CLOSED` (종료됨)** | ⚫ Zinc (`bg-zinc-100`) | `closed`, `resolved` | 문제 해결이 완료되어 케이스가 종결된 상태 |

---

## 4. ACL & Server Action Authorization

### 4.1 포털 권한 체계 (`support` 카테고리)
- **`support:none (0)`**: `/portal/support` 접근 시 `AccessDeniedView` 표시 및 메뉴 차단.
- **`support:read (1)`**: 소속 회사 문의 목록 및 대화 스레드 열람 가능. (`+ 새 문의 등록` 버튼 미노출, 답변 입력창 비활성화).
- **`support:write (2)`**: 신규 문의 등록(`createPartnerInquiry`), 스레드 답변 작성(`replyToPartnerInquiry`), 조치 이행(`resolvePartnerInquiryAction`) 가능.
- **`support:manage (3)`**: 케이스 직접 종결(`closeCase`) 가능.

### 4.2 종결(Close) vs 만족도 평가(CSAT) 권한 분리
- **케이스 종결 (`closeCase`)**:
  - 브랜드 포털 사용자(`closeCase`) 및 K SELECT 어드민(`closeCaseAdmin`, `answerAndClosePartnerInquiry`) 양측 모두 실행 가능.
  - 실행 시 `status = 'closed'`, `closed_at`, `closed_by`, `closed_by_side` 기록.
- **만족도 평가 (`submitSatisfactionRating`)**:
  - 케이스가 `CLOSED` 상태일 때 **브랜드사 사용자 전용**으로 활성화됨.
  - 1~5점 별점(`satisfaction_score`) 및 코멘트(`satisfaction_comment`)를 제출하면 `partner_inquiry_messages`에 `satisfaction` 타입 이벤트 메시지가 추가 기록됨.

---

## 5. Notification & Email Trigger Audit

실제 프로덕션 코드(`lib/inquiry/actions.ts`, `lib/notification/actions.ts`, `lib/notifications/email.ts`) 검증 결과:

| 이벤트 (Event) | 인앱 알림 (`notifications`) | 트랜잭션 이메일 (`sendEmail` via Resend) | 실제 트리거 조건 및 동작 |
| :--- | :---: | :---: | :--- |
| **1. 신규 문의 등록** | ✅ 생성 | ❌ 미발송 | 브랜드사 문의 제출 시 어드민 인앱 알림 발생 |
| **2. 어드민 일반 답변** | ✅ 생성 | ❌ 미발송 | 일반 메시지 등록 시 브랜드사 인앱 알림 발생 |
| **3. 조치 요청 (Action Required)** | ✅ 생성 | ✅ **조건부 발송** | 어드민이 `isActionRequired: true` 및 `sendEmail: true` 설정 시 주 담당자에게 이메일 발송 |
| **4. 브랜드사 조치 완료 회신** | ✅ 생성 | ❌ 미발송 | 브랜드사 보완 답변 제출 시 어드민 인앱 알림 발생 |
| **5. 어드민 새 케이스 직접 생성** | ✅ 생성 | ✅ **조건부 발송** | 어드민이 파트너사 대행 케이스 생성 시 `send_email` 옵션에 따라 이메일 발송 |
| **6. 케이스 종결** | ✅ 생성 | ❌ 미발송 | 종결 알림 인앱 피드에 기록 |
| **7. 만족도 평가 제출** | ✅ 생성 | ❌ 미발송 | CSAT 점수 등록 시 스레드 이벤트 및 인앱 알림 기록 |

> **인앱 읽음 상태 관리**: 회사 소속 다중 사용자의 독립적 읽음 처리를 위해 `company_users.permissions.read_notification_ids` (JSONB 배열)에 읽은 메시지 ID를 누적 저장합니다.

---

## 6. Attachment & Private Storage Security

- **Storage Bucket:** `"company-uploads"` (프로덕션 실제 버킷명).
- **저장 경로 구조:** `${company_id}/inquiries/${uuid}.${ext}`.
- **파일 검증 (`validateUploadedFile`):**
  - 최대 허용 크기: **20MB**.
  - 허용 카테고리: `image` (`image/png`, `image/jpeg`, `image/webp`), `document` (`application/pdf`).
- **다운로드 보안:** Private 버킷으로 관리되며, 다운로드 시 서버에서 `getSignedFileUrl("company-uploads", path)`를 통해 시간 제한 서명 URL을 발급받아 접근합니다.

---

## 7. Cross-Domain Deep Linking & Relations

| 도메인 | 출발 화면 | 생성되는 URL 파라미터 | 데이터베이스 연계 방식 |
| :--- | :--- | :--- | :--- |
| **발주 (PO)** | `/portal/orders/[id]` | `?new=1&category=po_change&po_id=...&po_no=PO-2026-0008` | **FK Relation**: `partner_inquiries.related_po_id` (`REFERENCES purchase_orders(id)`) |
| **정산 (Settlement)** | `/portal/settlement` | `?new=1&category=settlement&invoice_id=...&ap_no=AP-2026-0012` | **Context Prefill**: 제목 및 메타데이터에 AP 번호 바인딩 |
| **계약 (Agreements)** | `/portal/agreements` | `?new=1&category=agreement_change&agreement_id=...` | **Context Prefill**: 제목 및 카테고리에 계약 컨텍스트 바인딩 |

---

## 8. System Gaps & Not Implemented Items

| 항목 | 분류 | 상세 내용 |
| :--- | :---: | :--- |
| **`public.tasks` 미연계** | `SYSTEM GAP` | `public.tasks` 테이블이 존재하나 `partner_inquiries`와 연동되지 않고 `/admin/tasks`는 목업 데이터를 렌더링함 |
| **실시간 웹소켓 채팅** | `NOT IMPLEMENTED` | 실시간 채팅이 아닌 비동기 티켓/스레드 방식으로 동작 |
| **전체 메시지 이메일 발송** | `SYSTEM GAP / DESIGNED` | 모든 대화가 이메일로 가지 않고 `ACTION_REQUIRED` 플래그 및 신규 케이스 생성 시에만 선별 발송 |
| **브랜드사 간 공개 포럼** | `NOT IMPLEMENTED` | 멀티테넌트 보안 격리에 따라 브랜드사 간 티켓 공유는 엄격히 불가 |

---
*End of MAN-B-TASK-001_Source_Collection_Report.md*
