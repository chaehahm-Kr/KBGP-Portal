# MAN-B-FIN-001 — Source Collection Report
## K SELECT Brand Portal & Admin: Finance & Settlement (정산 관리 & 인보이스)

---

## 1. Executive Summary

본 보고서는 **K SELECT Brand Portal** 및 **K SELECT Admin**의 정산, 인보이스, 금융 조정 및 대금 지급(Finance, Invoices, Adjustments & Payments) 영역 전체를 대상으로 수행된 프로덕션 코드, UI 컴포넌트, 서버 액션, API 라우트, 데이터베이스 스키마, 상태 머신 및 권한 감사의 최종 검증 결과물이다.

본 감사를 통해 확정된 핵심 도메인 아키텍처는 다음과 같다:

1. **발주(ORD) ➔ 정산(FIN) 이관 자격 원칙 (ORD-to-FIN Eligibility)**:
   - 인보이스 발행이 가능한 발주서(PO)는 공급사 확인이 완료된 상태(`supplier_confirmation_status = 'CONFIRMED'`)이고 발주 상태가 승인/발송 완료(`po_status IN ('APPROVED', 'SENT')`)된 발주서로 한정됨 (`VERIFIED SYSTEM BEHAVIOR`).
2. **단일 활성 인보이스 제약 (Single Active Invoice Rule)**:
   - 동일 발주서(PO)에 대해 진행 중인(무효/반려 제외: `invoice_status NOT IN ('VOID', 'REJECTED')`) 인보이스는 시스템적으로 **단 1개만 생성 가능**함. 중복 생성을 시도할 경우 예외 메시지와 함께 작성이 차단됨 (`VERIFIED SYSTEM BEHAVIOR`).
3. **3단계 통합 정산 탭 및 캔버스 (Unified Finance Hub)**:
   - **탭 1: 인보이스 (Invoices)**: 청구 인보이스 발행, 상태 조회, 수신/due 일자 추적, PDF 첨부.
   - **탭 2: 정산 (Settlements / Adjustments)**: 수량 부족(`SHORTAGE`), 파손(`DAMAGE`), 단가 차액(`PRICE_DIFFERENCE`), 기타(`OTHER`) 사유에 따른 대금 감액(`CREDIT`) 및 증액(`CHARGE`) 조정 내역 관리.
   - **탭 3: 지급 내역 (Payments)**: K SELECT 본사의 실제 대금 송금 및 지급 완료 내역(은행, 계좌 마스킹 정보, 지급 수단, 마스킹 SWIFT) 확인.
4. **동적 정산 지표 및 3중 수식 엔진 (Triple Financial Calculation Engine)**:
   - `subtotal = SUM(invoiced_qty * unit_price)`
   - `adjustmentTotal = SUM(PLUS / CHARGE) - SUM(MINUS / CREDIT)`
   - `invoice_total = subtotal + adjustmentTotal` (최종 청구 금액 < 0 일 경우 저장 차단)
   - `amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')`
   - `balance_due = invoice_total - amount_paid`
5. **정기 및 실시간 계산 상태 동기화 (Canonical Computed Payment Status)**:
   - DB에 저장된 `payment_status`와 별개로, 클라이언트 UI 및 조회 액션은 `balance_due`와 `amount_paid`를 기준으로 실시간 상태(`UNPAID`, `PARTIALLY_PAID`, `PAID`)를 동적 도출함 (`VERIFIED SYSTEM BEHAVIOR`).
6. **권한 및 보안 격리 (Multi-Tenant & RBAC Isolation)**:
   - Brand Portal: `finance:read` (조회), `finance:write` (DRAFT 작성/수정/SUBMIT), `finance:manage` (DRAFT 삭제). 권한 부재 시 `<AccessDeniedView>` 렌더링.
   - Admin Portal: `executive_viewer` 단독 계정은 모든 수정/승인 차단, `super_admin`, `operations`, `reviewer`에 한하여 승인/반려 권한 부여.

---

## 2. Production Routes & URL Inventory

### 2.1 Brand Portal Routes (`portal.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/portal/finance` | `finance:read` | `app/portal/finance/page.tsx` | 정산 메인 허브 (Invoices / Settlements / Payments 3개 탭, 지표 카드가, 검색/필터) |
| `/portal/finance/new` | `finance:write` | `app/portal/finance/new/page.tsx` | 신규 인보이스 발행 (자격 부여 PO 선택, 품목별 청구수량/단가 입력, 조정 항목, 첨부파일) |
| `/portal/finance/[id]` | `finance:read` | `app/portal/finance/[id]/page.tsx` | 인보이스 상세 조회 (헤더, 품목 청구 현황, 정산 조정 내역, 지급 이력, 증빙 다운로드) |
| `/portal/finance/[id]/edit` | `finance:write` | `app/portal/finance/[id]/edit/page.tsx` | 인보이스 초안 수정 (`DRAFT` 상태에 한함) |

### 2.2 Admin Portal Routes (`admin.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/admin/finance/invoices` | `staff_roles` | `app/admin/finance/invoices/page.tsx` | 어드민 공급사 인보이스 전체 목록 조회, 공급사별/상태별 검색 |
| `/admin/finance/invoices/new` | `admin:write` | `app/admin/finance/invoices/new/page.tsx` | 어드민 대리 인보이스 생성 |
| `/admin/finance/invoices/[id]` | `staff_roles` | `app/admin/finance/invoices/[id]/page.tsx` | 어드민 인보이스 상세 (검토, 승인 `approveInvoice`, 반려 `rejectInvoice`, 무효화 `voidInvoice`) |
| `/admin/finance/invoices/[id]/edit` | `admin:write` | `app/admin/finance/invoices/[id]/edit/page.tsx` | 어드민 인보이스 수정 (`DRAFT` 상태에 한함) |
| `/admin/finance/payments` | `staff_roles` | `app/admin/finance/payments/page.tsx` | 대금 지급 관리 목록 (지급 등록, 집행 완료, 수표/전송 수단별 추적) |
| `/admin/finance/payments/new` | `admin:write` | `app/admin/finance/payments/new/page.tsx` | 신규 대금 지급 등록 (`createPayment`, 송금 증빙 첨부) |
| `/admin/finance/payments/[id]` | `staff_roles` | `app/admin/finance/payments/[id]/page.tsx` | 대금 지급 상세 (지급 확정 `transitionPaymentStatus('COMPLETED')`, 무효 `VOID`) |
| `/admin/finance/payments/[id]/edit` | `admin:write` | `app/admin/finance/payments/[id]/edit/page.tsx` | 초안 지급 내역 수정 |
| `/admin/finance/landed-cost` | `staff_roles` | `app/admin/finance/landed-cost/page.tsx` | 부대비용 및 랜디드 코스트 배부 관리 (`getEligibleShipmentsForLandedCost`) |

---

## 3. Canonical Status Dictionary

### 3.1 인보이스 문서 상태 (`InvoiceStatus`)
| DB Status | Portal Display Label | 영문 라벨 | 비즈니스 정의 | 전이 Trigger | 다음 가능한 상태 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | 임시저장 | Draft | 브랜드사가 인보이스 작성 중인 임시 상태 | '임시저장' 클릭 | `SUBMITTED`, 삭제(`DELETED`) |
| `SUBMITTED` | 제출됨 | Submitted | 본사 검토 및 승인을 위해 제출된 상태 | '인보이스 제출' 클릭 | `APPROVED`, `REJECTED`, `VOID` |
| `APPROVED` | 승인됨 | Approved | 본사 매니저에 의해 인보이스가 채무로 확정 승인된 상태 | Admin '승인 (Approve)' | `VOID` |
| `REJECTED` | 반려됨 | Rejected | 입력 오류 또는 조건 불일치로 반려된 상태 (사유 필수) | Admin '반려 (Reject)' | `[*]` (종결) |
| `VOID` | 무효 | Void | 발행 후 취소/무효 처리된 상태 | Admin '무효화 (Void)' | `[*]` (종결) |

### 3.2 지급 상태 (`PaymentStatus` & Computed Canonical Status)
| DB / Computed | UI Display Label | 계산 / 판정 조건 | 비즈니스 정의 |
| :--- | :--- | :--- | :--- |
| `UNPAID` | 미지급 (Unpaid) | `amountPaid == 0 && balanceDue == invoiceTotal` | 지급액이 전혀 없는 초기 청구 상태 |
| `PARTIALLY_PAID` | 일부 지급 (Partially Paid) | `amountPaid > 0 && balanceDue > 0` | 인보이스 총액 중 일부만 대금 송금이 완료된 상태 |
| `PAID` | 지급 완료 (Paid) | `balanceDue <= 0 && invoiceTotal > 0` | 청구 총액 전체에 대해 송금이 완납된 상태 |

### 3.3 정산 상태 (`SettlementStatus`)
| DB Status | Display Label | 비즈니스 정의 | 상태 전이 Trigger |
| :--- | :--- | :--- | :--- |
| `OPEN` | 정산 진행 중 | 지급 및 정산 조정을 계속 수용할 수 있는 열린 상태 | 인보이스 생성 시 기본값 |
| `SETTLED` | 정산 종결 | 완납 또는 본사 관리에 의해 정산이 마감된 동결 상태 | `closeSettlement` 실행 |

### 3.4 정산 조정 타입 및 방향 (`AdjustmentType` & `AdjustmentDirection`)
| Adjustment Type | Korean Label | Adjustment Direction | Effect on Invoice Total |
| :--- | :--- | :--- | :--- |
| `SHORTAGE` | 수량 부족 | `CREDIT` (감액) | 청구 금액 차감 (-) |
| `DAMAGE` | 파손 | `CREDIT` (감액) | 청구 금액 차감 (-) |
| `PRICE_DIFFERENCE` | 단가 차액 | `CREDIT` / `CHARGE` | 차액 방향에 따라 감액/증액 |
| `OTHER` | 기타 | `CREDIT` / `CHARGE` | 사유에 따라 감액/증액 |

### 3.5 대금 지급 수단 (`PaymentMethod`)
| Enum Code | Display Label | 설명 |
| :--- | :--- | :--- |
| `WIRE` | 계좌이체 (Wire Transfer) | 은행 전신환 송금 |
| `ACH` | ACH 자동이체 | 자동 계좌 이체 |
| `CHECK` | 수표 (Check) | 당좌/수표 지급 |
| `OTHER` | 기타 | 기타 지급 방식 |

---

## 4. ORD ➔ FIN Handoff Rules & Eligibility Audit

### 4.1 발주서(PO) 대상 자격 검증 (`getEligiblePosForInvoice`)
```typescript
// lib/portal/actions.ts
.from("purchase_orders")
.select("id, po_number, order_date, currency")
.eq("supplier_id", companyId)
.in("po_status", ["APPROVED", "SENT"])
.eq("supplier_confirmation_status", "CONFIRMED")
.order("created_at", { ascending: false });
```
- **자격 요건 1**: 발주서가 공급사에 할당되어 있어야 함 (`supplier_id = companyId`).
- **자격 요건 2**: 발주 상태가 승인/발송 완료(`APPROVED`, `SENT`)이어야 함.
- **자격 요건 3**: 공급사가 포털에서 공식 수락(`CONFIRMED`)을 완료해야 함.

### 4.2 1 PO : 1 Active Invoice 규칙
- 시스템은 하나의 PO당 오직 **1개의 활성 인보이스**만 허용함.
- `invoice_status NOT IN ('VOID', 'REJECTED')` 조건으로 활성 인보이스 존재 여부를 검사하며, 이미 활성 인보이스가 존재할 경우 신규 생성을 엄격히 차단함 (`VERIFIED SYSTEM BEHAVIOR`).

---

## 5. Storage & File Attachment Audit

### 5.1 파일 버킷 및 경로 세부 사항
- **Storage Bucket Name**: `company-uploads`
- **Brand Portal 업로드 경로**: `[companyId]/invoice/[uuid].pdf` (`uploadPortalInvoiceAttachment`)
- **Admin Portal 업로드 경로**: `invoices/[uuid].[ext]` (`uploadInvoiceAttachment`)
- **접근 권한 및 보안**:
  - 서명된 URL(`getSignedFileUrl`)을 통해서만 다운로드 가능.
  - Brand Portal에서는 `pathCompanyId === companyId` 테넌트 소유권 검사 후 URL을 발급하여 타사 문서 접근을 원천 차단함 (`VERIFIED SYSTEM BEHAVIOR`).

---

## 6. Empirical System Findings & Classification

### 6.1 Verified System Behavior (검증된 시스템 동작)
1. **발주 수락 필수성**: `supplier_confirmation_status = 'CONFIRMED'`가 아닌 발주서는 인보이스 발행 목록에 나타나지 않음.
2. **단일 인보이스 제한**: 동일 PO에 복수 활성 인보이스 생성이 시도되면 에러 반환.
3. **음수 청구 금지**: 조정 내역을 적용한 최종 `invoice_total < 0` 일 경우 제출이 차단됨.
4. **마스킹 처리**: 공급사 송금 계좌 정보는 뒷 4자리(`remittance_account_last4`) 및 마스킹 SWIFT 코드만 포털에 노출됨.

### 6.2 System Gap / Not Implemented (시스템 미구현 사항)
1. **분할 인보이스 (Partial Invoicing)**: 1개 PO에 대해 2회 이상으로 나누어 인보이스를 발행하는 1:N 분할 청구 기능은 현재 미지원됨.
2. **포털 내 PDF 자동 생성 (PDF Export)**: 발행된 인보이스 데이터를 양식화된 PDF 파일로 자동 변환/다운로드하는 엔진은 미구현됨 (외부 PDF 직접 첨부 방식).

### 6.3 Decision Required (의사결정 필요 사항)
1. **통화 환율 처리 (Currency Exchange Rates)**: PO 통화와 Payment 통화가 상이할 경우의 환율 적용 및 외환 차손익 처리 규칙 정의 필요.

---
