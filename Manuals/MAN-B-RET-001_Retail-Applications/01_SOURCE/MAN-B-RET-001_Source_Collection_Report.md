# MAN-B-RET-001: Brand Portal Retail Placement & Application Guide
## Phase 01: Production Source Collection Report (Refined)

---

### Executive Summary

| Attribute | Specification |
| :--- | :--- |
| **Manual ID** | `MAN-B-RET-001` |
| **Manual Title (EN)** | Brand Portal Retail Placement & Application Guide |
| **Manual Title (KO)** | 브랜드 포털 입점 신청 및 리테일 네트워크 가이드 |
| **Audience Code** | `B` (Brand Portal User / Brand Administrator & Manager) |
| **Canonical Topic** | `topic-retail` (입점 & 리테일 네트워크 / Retail Network) |
| **Topic Order** | 5 (Follows `topic-regulatory` / `MAN-B-REG-001`) |
| **Source Authority** | K SELECT Production Codebase & DB Architecture |
| **Document Phase** | `01_SOURCE` (Source Collection & Technical Audit) |
| **Status** | `SOURCE INTEGRITY REFINED` |

---

### 1. System Scope & Codebase Architecture

The Retail Placement & Application module allows registered brand companies to select registered products, evaluate partnership readiness criteria, submit formal retail placement applications, track product-level MD reviews in real time, and exchange additional compliance/sales documentation with K SELECT Merchandisers (MD).

#### Primary Routes & Components
- **Applications Overview**: `app/portal/applications/page.tsx`
- **Application Detail & Workspace**: `app/portal/applications/[id]/page.tsx`
- **Draft Form Component**: `components/application/application-draft-form.tsx`
- **Submit Action Component**: `components/application/submit-application-button.tsx`
- **Info Request Reply Component**: `components/application/reply-info-request-form.tsx`
- **Server Actions & DAL**:
  - `lib/application/actions.ts` (`createDraftApplication`, `saveDraftApplication`, `submitApplication`, `deleteApplicationAction`)
  - `lib/application/info-request-actions.ts` (`createInfoRequest`, `replyToInfoRequest`)
  - `lib/application/review-actions.ts` (`reviewApplicationProduct`, `computeAggregatedStatus`, `notifyCompanyOfResult`)
  - `lib/application/invitation-actions.ts` (`adminInviteBrandPartner`, `approveAndInviteApplication`, `checkDuplicateEmailAction`)
  - `lib/application/types.ts` (`ApplicationStatus`, `OFFICIAL_READINESS_ITEMS`, `APPLICATION_STATUS_LABEL`, `REVIEW_STATUS_LABEL`)

#### Database Entities & Relationships
- `applications`: Master intake table storing application number, company ID, status, motivation note, readiness answers, and submission timestamp.
- `application_products`: Junction table linking selected products (`product_id`) to an application (`application_id`) with individual `review_status` and `review_reason`.
- `additional_info_requests`: Threaded request/reply records for MD documentation inquiries, due dates, reply content, and storage file attachments.
- `activity_logs`: Immutable audit trail recording state transitions, timestamps, actors, and decision reasons.
- `partner_inquiries` & `notifications`: Integrated notification pipeline routing urgent MD info requests to portal banners, support tickets, and email alerts.

---

### 2. Verified System Behavior (100% Code-Verified Facts)

#### A. Access Control & Permission Guards
1. **Read Permission**: Requires `hasPortalPermission("application", "read")`. If unauthorized, renders `AccessDeniedView`.
2. **Write Permission**: Requires `hasPortalPermission("application", "write")`. Without write permission, the "새 신청서 작성" (New Application) button and form submission actions are hidden/blocked.
3. **Tenant Isolation**: All queries enforce `company_id = tenantContext.companyId` via Row Level Security (RLS) and server-side DAL checks.

#### B. Application Creation & Draft Mode Workflow
1. **Draft Initialization**: Clicking "새 신청서 작성" calls `createDraftApplication()`, inserting a blank application row linked to `company_id` and redirecting immediately to `/portal/applications/[id]`.
2. **Multi-Brand Product Selection**:
   - The system retrieves all registered products under the tenant company (`status === 'draft' ? products WHERE company_id = tenantContext.companyId`).
   - Products are automatically grouped by Brand Name in the UI.
   - Brand users can select products from multiple brands in a single application via checkboxes.
3. **Official Program Readiness Criteria (6 Standards)**:
   Brand applicants must respond to 6 official partnership readiness items:
   - `stable_supply`: 안정적인 생산 및 공급망 확보 (지속적인 생산 및 공급 가능 여부)
   - `us_regulatory_compliance`: 미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비
   - `initial_test_quantity`: 초기 파트너십 테스트 물량 공급 의향 (초도 테스트 물량 공급 협력)
   - `north_america_distribution`: 북미 온/오프라인 유통 및 가격 정책 동의
   - `joint_marketing`: 북미 현지 공동 마케팅 협력 의향
   - `sales_content_support`: 상세 페이지 및 현지화 마케팅 콘텐츠 지원
   - Response Options: Each item offers a binary choice: `🟢 진행 가능 (available)` or `🟡 협의 필요 (discussion_required)`.
4. **Draft Persistence**: Clicking "임시저장" (`saveDraftApplication`) updates `eligibility_responses`, `self_check_answers`, and synchronizes `application_products` records without submitting.
5. **Submission Validation**:
   - The submit button is disabled/hidden if 0 products are selected.
   - Calling `submitApplication()` strictly validates `count(application_products) >= 1`.
   - On valid submit, the system calls database RPC `generate_application_number`, updates status to `submitted`, sets `submitted_at`, and dispatches transactional emails + B2B notification alerts.

#### C. Application Lifecycle & Status State Machine
The system supports the following canonical status lifecycle:
- `draft` (임시저장): Application is being drafted; full editing permitted.
- `submitted` (제출됨 / 접수): Submitted by brand; locked from direct editing; pending MD review.
- `assigned` (배정됨): Internal reviewer/MD assigned to evaluate the application.
- `under_review` (심사중): MD is actively reviewing individual products.
- `info_requested` (추가자료요청): MD requested additional compliance, pricing, or product documents.
- `re_review` (재검토중): Brand replied to info request; returned to MD queue.
- `partial_approved` (부분승인): Some products approved, while others were rejected or held.
- `approved` (승인됨 / 최종 승인): All products in the application approved for retail placement.
- `invitation_sent` (초대장 발송): Official onboarding invitation issued to partner.
- `onboarding` (온보딩 진행중): Partner onboarding in progress.
- `onboarded` (온보딩 완료): Successfully integrated into K SELECT Retail Network.
- `on_hold` (보류): Application or products placed on hold pending external conditions.
- `rejected` (반려됨): Application or products rejected by MD with formal reasoning.
- `cancelled` (취소): Application cancelled.
- `deleted` (삭제): Soft-deleted by Administrator.

#### D. Granular Multi-Product Review & Status Aggregation
1. **Independent Product Review**: Each product attached to an application has an independent `review_status` (`pending`, `reviewing`, `info_requested`, `approved`, `on_hold`, `rejected`).
2. **Automated Application Status Aggregation (`computeAggregatedStatus`)**:
   - If any product is `pending`, `reviewing`, or `info_requested` $\rightarrow$ Application remains `under_review`.
   - If 100% of products are `approved` $\rightarrow$ Application becomes `approved`.
   - If 100% of products are `rejected` $\rightarrow$ Application becomes `rejected`.
   - If 0 products are approved but some are held/rejected $\rightarrow$ Application becomes `on_hold`.
   - If some products are approved and others rejected/held $\rightarrow$ Application becomes `partial_approved`.
3. **Mandatory Reason for Non-Approval**: MD must provide a non-empty `reviewReason` when setting a product to `rejected` or `on_hold`.
4. **Real-Time Audit Timeline**: The brand portal displays an interactive timeline for each product, showing every status change, timestamp, and MD feedback reason.

#### E. Additional Info Request & Reply Loop
1. **MD Trigger**: When an MD creates an info request, the application status switches to `info_requested`, an urgent banner appears on the brand portal detail page, a linked 1:1 support inquiry ticket is generated (`is_action_required = true`), and an email notification with optional due date is dispatched.
2. **Brand Reply Flow**:
   - The brand user accesses `/portal/applications/[id]`.
   - Enters reply text in `replyContent` and optionally uploads supporting files (`.pdf`, `.jpg`, `.png`, `.webp`, `.csv`, `.xlsx`).
   - Files are validated and securely stored in Supabase storage bucket `company-uploads`.
   - Submitting updates request status to `replied`, resets application status to `re_review`, and alerts the assigned MD.

---

### 3. Future Policy / Enhancement Backlog (Non-Blocking)

The following items are separated into the future backlog and are not part of the active production user manual:
1. **Re-application Policy**: Administrative rules regarding cooldown periods or re-submission procedures for rejected products.
2. **Physical Sample Logistics & Tracking**: Detailed warehouse intake and shipping tracking workflows for physical sample evaluation.

---

### 4. Topic Boundaries & Relationship to Other Manuals

```
┌────────────────────────────────────────────────────────────────────────┐
│                        K SELECT Brand Portal Manuals                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. MAN-B-ONB-001  : Account Signup, Company Setup & Brand Onboarding  │
│ 2. MAN-B-BRAND-001: Brand Ownership, Trademark & Brand Management      │
│ 3. MAN-B-PROD-001 : Product Catalog, SKU, Specs & Approval Pipeline    │
│ 4. MAN-B-REG-001  : US FDA, MoCRA & Regulatory Compliance              │
├────────────────────────────────────────────────────────────────────────┤
│ 5. MAN-B-RET-001  : Retail Placement, Product Application & MD Review  │◄── THIS MANUAL
├────────────────────────────────────────────────────────────────────────┤
│ 6. MAN-B-ORD-001  : Purchase Orders, PO Requests & Fulfillment         │
│ 7. MAN-B-LOG-001  : Warehouse Origin, 3PL & Shipping Logistics         │
└────────────────────────────────────────────────────────────────────────┘
```

- **Scope of MAN-B-RET-001**:
  - Application dashboard (`/portal/applications`)
  - Product selection (multi-brand support)
  - 6 Official Readiness evaluation criteria
  - Submission & Application number generation
  - Multi-product MD review tracking & status aggregation
  - Additional Info Request & Reply workflow
  - Application outcome review (Approved, Partial Approved, On Hold, Rejected)
- **Out of Scope (Covered by Downstream Manuals)**:
  - Purchase Orders, PO Requests & Fulfillment $\rightarrow$ `MAN-B-ORD-001`
  - Warehouse Origin, 3PL, Shipping Logistics $\rightarrow$ `MAN-B-LOG-001`
  - Financial Settlement & Payouts $\rightarrow$ `MAN-B-FIN-001`

---

### 5. Grounded FAQ Candidates (7 Questions)

1. **Q1. 입점 신청서는 브랜드별로 따로 작성해야 하나요?**
   - **A:** 아니요. 하나의 신청서에 동일 회사 계정에 등록된 여러 브랜드의 제품을 한 번에 담아 신청할 수 있습니다. 화면에서 브랜드별로 분류된 제품 목록 중 원하는 제품을 체크하여 함께 제출할 수 있습니다.
2. **Q2. 신청서를 제출한 후 제품을 추가하거나 내용을 수정할 수 있나요?**
   - **A:** 신청서가 '제출됨(submitted)' 상태로 변경된 이후에는 브랜드사에서 직접 수정할 수 없습니다. 수정을 원하시면 MD 담당자에게 추가자료 요청 시 회신하거나 1:1 문의 채널을 통해 요청해야 합니다.
3. **Q3. 프로그램 참여 준비 사항(Readiness)에서 '협의 필요'를 선택하면 심사에서 탈락하나요?**
   - **A:** 아닙니다. '협의 필요' 항목은 탈락 사유가 아니며, K SELECT MD 팀과 북미 진출 조건(초도 물량, 유통가, 마케팅 분담 등)을 사전 조율하기 위한 협의 지점으로 활용됩니다.
4. **Q4. 심사 결과가 '부분 승인(partial_approved)'인 경우 어떻게 진행되나요?**
   - **A:** 신청서에 포함된 제품 중 승인된 제품에 대해서만 우선적으로 리테일 네트워크 입점 및 후속 절차가 진행됩니다. 보류 또는 반려된 제품은 사유를 확인한 후 보완하여 관리할 수 있습니다.
5. **Q5. MD 담당자로부터 추가 자료 요청을 받으면 어떻게 회신하나요?**
   - **A:** 신청서 상세 페이지 상단에 노출되는 노란색 알림 패널에서 요청 내용을 확인하고, 회신 내용 작성 및 증빙 파일(PDF, 이미지, 엑셀 등)을 첨부하여 '회신 제출'을 누르면 즉시 심사팀에 전달됩니다.
6. **Q6. 심사 반려 사유는 어디에서 확인할 수 있나요?**
   - **A:** 신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 각 제품명 아래의 상세 타임라인을 통해 MD가 기록한 구체적인 심사 사유를 투명하게 확인할 수 있습니다.
7. **Q7. 입점 신청 승인 후 다음 단계는 어떻게 안내되나요?**
   - **A:** 승인 완료 시 신청서 상태가 '승인됨(approved)' 또는 '부분승인(partial_approved)'으로 변경되며, 안내 메일 및 포털 알림을 통해 후속 절차 및 가이드가 전달됩니다.
