# MAN-B-FIN-001 — Source Collection Report
## K SELECT Brand Portal & Admin: Finance & Settlement (정산 관리 & 인보이스)

---

## 1. Executive Summary

본 보고서는 **K SELECT Brand Portal** 및 **K SELECT Admin**의 정산, 인보이스, 금융 조정 및 대금 지급(Finance, Invoices, Adjustments & Payments) 영역 전체를 대상으로 수행된 프로덕션 코드, UI 컴포넌트, 서버 액션, API 라우트, 데이터베이스 스키마, 상태 머신 및 권한 감사의 최종 검증 결과물이다.

본 감사를 통해 확정된 핵심 도메인 아키텍처는 다음과 같다:

1. **병렬 도메인 전환 아키텍처 (Parallel Domain Handoff Architecture)**:
   - 공식 발주 수락(`po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'`) 완료 시, 도메인은 **물류(LOG / Shipping & Logistics)**와 **정산(FIN / Invoice & Settlement)** 두 축으로 **병렬 분기(Parallel Handoff)**함 (`VERIFIED SYSTEM BEHAVIOR`).
   - 정산(FIN) 진입 및 인보이스 발행은 물류/입고(LOG) 완료를 필수 직렬 전제조건(Universal Prerequisite)으로 요구하지 않으며, 발주 수락 직후 정산 프로세스를 독립적으로 시작할 수 있음.
2. **이중 메커니즘 단일 활성 인보이스 제약 (Single Active Invoice Rule — Enforcement: BOTH)**:
   - 동일 발주서(PO)에 대해 진행 중인(무효/반려 제외: `invoice_status NOT IN ('VOID', 'REJECTED')`) 인보이스는 **단 1개만 허용**함.
   - **DB Level**: 부분 유일 인덱스 (`CREATE UNIQUE INDEX idx_supplier_invoices_one_active_per_po ON supplier_invoices(purchase_order_id) WHERE invoice_status NOT IN ('VOID', 'REJECTED')`)로 DB 레벨 제약 처리 (`VERIFIED SYSTEM BEHAVIOR`).
   - **Application Level**: `createPortalInvoiceDraft` 및 `createInvoice` 서버 액션 내 사전 검화 쿼리로 이중 검증 및 사용자 친화적 에러 메시지 반환 (`VERIFIED SYSTEM BEHAVIOR`).
3. **독립 4대 상태 도메인 명확 분리 (4 Disambiguated Status Domains)**:
   - **Invoice Status (문서 결재 상태)**: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`
   - **Payment Status (대금 이행 상태)**: `UNPAID`, `PARTIALLY_PAID`, `PAID` (`balance_due` 및 `amount_paid` 기반 동적 산출)
   - **Settlement Status (정산 종결 상태)**: `OPEN`, `SETTLED` (`closeSettlement`에 의한 행정 마감/동결)
   - **PO Status (발주 진행 상태)**: `DRAFT`, `APPROVED`, `SENT`, `COMPLETED`, `CANCELLED`
   - **독립 경계 원칙**: `Invoice Status ≠ Payment Status`, `Payment Status ≠ Settlement Status`, `PO Completed ≠ Invoice Paid`, `Shipping Completed ≠ Settlement Completed`.
4. **정산 조정 수식 엔진 (Adjustment & Payable Calculation Engine)**:
   - `subtotal = SUM(invoiced_qty * unit_price)`
   - `adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)`
     - `CREDIT` (감액): payable amount 감소 (-)
     - `CHARGE` (증액): payable amount 증가 (+)
   - `invoice_total = subtotal + adjustmentTotal` (`invoice_total < 0` 일 경우 저장 차단)
   - `amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')`
   - `balance_due = invoice_total - amount_paid`
5. **Brand vs Admin 역할 경계 확립 (Brand Portal vs Admin Scope)**:
   - Brand Portal User: 인보이스 작성/수정/제출/삭제 (`DRAFT` 상태 한정), 인보이스/조정/지급 현황 조회.
   - Admin User (참조): 인보이스 승인/반려/무효화, 조정 항목 검토, 대금 송금 집행 및 지급 확정 (`COMPLETED`), 정산 종결 (`closeSettlement`).

---

## 2. Production Routes & URL Inventory

### 2.1 Brand Portal Routes (`portal.kselectnetwork.com`) — Main Scope
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/portal/finance` | `finance:read` | `app/portal/finance/page.tsx` | 정산 메인 허브 (Invoices / Settlements / Payments 3개 탭, 지표 카드, 검색/필터) |
| `/portal/finance/new` | `finance:write` | `app/portal/finance/new/page.tsx` | 신규 인보이스 발행 (자격 부여 PO 선택, 품목별 청구수량/단가 입력, 조정 항목, 첨부파일) |
| `/portal/finance/[id]` | `finance:read` | `app/portal/finance/[id]/page.tsx` | 인보이스 상세 조회 (헤더, 품목 청구 현황, 정산 조정 내역, 지급 이력, 증빙 다운로드) |
| `/portal/finance/[id]/edit` | `finance:write` | `app/portal/finance/[id]/edit/page.tsx` | 인보이스 초안 수정 (`DRAFT` 상태일 때만 접근 및 수정 허용) |

### 2.2 Admin System Routes (`admin.kselectnetwork.com`) — Reference Scope Only
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/admin/finance/invoices` | `staff_roles` | `app/admin/finance/invoices/page.tsx` | 어드민 인보이스 전체 목록 조회 및 검토 |
| `/admin/finance/invoices/new` | `admin:write` | `app/admin/finance/invoices/new/page.tsx` | 어드민 대리 인보이스 생성 |
| `/admin/finance/invoices/[id]` | `staff_roles` | `app/admin/finance/invoices/[id]/page.tsx` | 어드민 인보이스 상세 (승인 `approveInvoice`, 반려 `rejectInvoice`, 무효화 `voidInvoice`) |
| `/admin/finance/invoices/[id]/edit` | `admin:write` | `app/admin/finance/invoices/[id]/edit/page.tsx` | 어드민 인보이스 수정 (`DRAFT` 상태 한정) |
| `/admin/finance/payments` | `staff_roles` | `app/admin/finance/payments/page.tsx` | 대금 지급 관리 목록 |
| `/admin/finance/payments/new` | `admin:write` | `app/admin/finance/payments/new/page.tsx` | 신규 대금 지급 등록 (`createPayment`) |
| `/admin/finance/payments/[id]` | `staff_roles` | `app/admin/finance/payments/[id]/page.tsx` | 대금 지급 상세 및 지급 확정 (`transitionPaymentStatus('COMPLETED')`) |
| `/admin/finance/payments/[id]/edit` | `admin:write` | `app/admin/finance/payments/[id]/edit/page.tsx` | 초안 지급 내역 수정 |
| `/admin/finance/landed-cost` | `staff_roles` | `app/admin/finance/landed-cost/page.tsx` | 부대비용 및 랜디드 코스트 배부 관리 |

---

## 3. Invoice Status Lifecycle & Action Matrix

Production Code (`lib/portal/actions.ts` & `lib/supplier-invoice/actions.ts`) 기준 검증된 상태별 액션 매트릭스:

| InvoiceStatus | Brand Portal User Allowed Actions | Admin User Allowed Actions | Permitted Action Triggers | Disallowed Actions (Strictly Enforced) |
| :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | View, Edit, Delete, Submit | View, Edit, Delete, Submit | `updatePortalInvoiceDraft`<br/>`deletePortalInvoiceDraft`<br/>`submitPortalInvoice` | Approve / Reject / Void 불가 (제출 전 상태) |
| `SUBMITTED` | View Only (Read-Only) | View, Approve, Reject, Void | `approveInvoice`<br/>`rejectInvoice`<br/>`voidInvoice` | Brand User의 수정(`Edit`), 삭제(`Delete`), 제출 취소 불가 |
| `APPROVED` | View Only (Read-Only) | View, Void | `voidInvoice` | Brand User/Admin의 수정(`Edit`), 삭제(`Delete`), 승인 취소 불가 |
| `REJECTED` | View Only (Rejection Reason) | View | None (Terminal Status) | 제자리 수정(`Edit`), 재제출(`Resubmit`), 삭제 불가. (단, PO의 활성 상태가 해제되어 **새 인보이스 작성** 가능) |
| `VOID` | View Only (Void Status) | View | None (Terminal Status) | 수정, 삭제, 승인, 지급 처리 불가 |

---

## 4. Status Domain Disambiguation Matrix

| Domain | Status Enum | Primary Controlling Entity | Calculation / Value Origin | Business Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Invoice Status** | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID` | `supplier_invoices.invoice_status` | 결재 및 검토 워크플로우 액션 | 인보이스 문서의 검토 및 결재 승인 상태 |
| **Payment Status** | `UNPAID`, `PARTIALLY_PAID`, `PAID` | Computed Canonical UI Status / `supplier_invoices.payment_status` | `balance_due` & `amount_paid` | 인보이스 청구액 대비 실제 금전 송금 집행 완납 현황 |
| **Settlement Status** | `OPEN`, `SETTLED` | `supplier_invoices.settlement_status` | `closeSettlement(invoiceId)` | 정산 파일의 행정적 최종 마감 및 수정 동결 상태 |
| **PO Status** | `DRAFT`, `APPROVED`, `SENT`, `COMPLETED`, `CANCELLED` | `purchase_orders.po_status` | 발주 및 물류 이행 프로세스 | 발주서 계약 및 물류 수불 완료 현황 |

---

## 5. Adjustments & Financial Math Rules

### 5.1 Adjustment Properties & Behavior
- **`AdjustmentType`**: `SHORTAGE` (수량부족), `DAMAGE` (파손), `PRICE_DIFFERENCE` (단가차액), `OTHER` (기타)
- **`AdjustmentDirection`**:
  - `CREDIT`: 감액 처리 ➔ 청구 금액 차감 (-). 공급사 청구 금액을 줄임.
  - `CHARGE`: 증액 처리 ➔ 청구 금액 추가 (+). 공급사 청구 금액을 늘림.
- **수식 산출 경로**:
  - `subtotal = SUM(supplier_invoice_lines.line_amount)`
  - `adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)`
  - `invoice_total = subtotal + adjustmentTotal`
  - `amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')`
  - `balance_due = invoice_total - amount_paid`
  - **결과 연동**: `balance_due` 감소 시 `PAID` 상태 도달 속도가 가속화되며, `balance_due = 0` 달성 시 `closeSettlement`에 의해 `settlement_status = 'SETTLED'`로 종결할 수 있음.

---

## 6. Single Active Invoice Rule (Enforcement: BOTH)

- **Claim**: 하나의 PO 당 진행 중인 활성 인보이스(`invoice_status NOT IN ('VOID', 'REJECTED')`)는 오직 1개만 존재할 수 있다.
- **Enforcement Type**: **`BOTH` (DB Partial Unique Index + Application-Level Validation)**
  - **DB Level**: `CREATE UNIQUE INDEX idx_supplier_invoices_one_active_per_po ON public.supplier_invoices(purchase_order_id) WHERE invoice_status NOT IN ('VOID', 'REJECTED');` (`supabase/migrations/0095_invoice_remittance_and_case_link.sql`).
  - **App Level**: `lib/portal/actions.ts: createPortalInvoiceDraft` 내 `not("invoice_status", "in", '("VOID","REJECTED")')` 쿼리로 사전에 검사 후 명시적 오류 메시지 반환.

---

## 7. Source Classification & Evidence Mapping

### 7.1 VERIFIED SYSTEM BEHAVIOR (코드/DB 검증 완료)
1. **병렬 발주 전환**: PO confirmation 완료 후 LOG와 FIN 도메인 병렬 전환.
2. **이중 단일 활성 인보이스 제약**: DB partial unique index 및 app pre-check 지원.
3. **DRAFT 상태 한정 수정/삭제**: `updatePortalInvoiceDraft`, `deletePortalInvoiceDraft`, `submitPortalInvoice` 모두 `invoice_status === 'DRAFT'` 검사.
4. **REJECTED 상태의 수정/재제출 불가**: REJECTED 인보이스는 제자리 수정/재제출이 불가하며, PO 활성이 해제되어 새 인보이스를 생성해야 함.
5. **동적 지급 상태 도출**: `getCanonicalPaymentStatus`를 통한 실시간 `UNPAID`, `PARTIALLY_PAID`, `PAID` 렌더링.
6. **마스킹 계좌 정보**: `remittance_account_last4` 및 마스킹 SWIFT 제공.

### 7.2 SYSTEM GAP / NOT IMPLEMENTED (미구현 사항)
1. **1:N 분할 인보이스 (Partial Invoicing)**: 1개 PO에 복수 인보이스를 나누어 발행하는 기능 미지원 (`Single Active Invoice` 제한).
2. **포털 내 PDF 양식 자동 변환 (PDF Export)**: 제출된 데이터를 PDF 문서로 자동 생성하는 엔진 미구현 (사용자가 외부 PDF 파일 첨부).

### 7.3 DECISION REQUIRED (의사결정 필요 사항)
1. **이종 통화 결제 (Multi-Currency Settlement)**: PO/Invoice 통화와 Payment 송금 통화가 다를 경우 적용할 환율 산정 기준 정의 필요.

---
