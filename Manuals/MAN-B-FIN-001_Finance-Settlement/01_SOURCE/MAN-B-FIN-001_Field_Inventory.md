# MAN-B-FIN-001 — Field Inventory
## K SELECT Brand Portal & Admin: Finance & Settlement (필드 인벤토리 & 데이터 사전)

---

## 1. Executive Overview

본 문서는 **K SELECT Brand Portal** (주요 대상) 및 **Admin System** (참조 대상)의 Finance & Settlement 모듈에서 사용되는 데이터 필드, UI 입력 요소, 데이터베이스 스키마, 데이터 타입, 필수 여부, 유효성 검증 규칙 및 비즈니스 로직을 명세한 필드 인벤토리이다.

---

## 2. Entity Field Dictionary

### 2.1 Supplier Invoices Header (`supplier_invoices`)
| DB Field Name | UI Label (KR) | Primary Scope | Data Type | Nullable | Validation & Constraints | Business Logic & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | - | Both | UUID | No | Primary Key | 시스템 고유 식별자 |
| `supplier_company_id` | 공급사 | Brand Portal | UUID | No | FK -> `companies.id` | 테넌트 멀티사 격리용 공급사 ID |
| `purchase_order_id` | 관련 PO 번호 | Brand Portal | UUID | No | FK -> `purchase_orders.id` | 청구 대상이 되는 발주서 ID (1 PO : 1 Active Inv) |
| `internal_ap_number` | AP 번호 | Both | Text | Yes | Unique per tenant | 본사 내부 생성 AP 관리 번호 |
| `supplier_invoice_number` | 공급사 인보이스 번호 | Brand Portal | Text | No | Required | 공급사가 자체 발행한 청구 송장 번호 |
| `invoice_date` | 발행 일자 | Brand Portal | Date | No | YYYY-MM-DD | 공급사가 송장을 공식 발행한 날짜 |
| `received_date` | 수신 일자 | Admin Ref | Date | Yes | YYYY-MM-DD | 본사가 송장을 수령/접수한 날짜 |
| `due_date` | 지급 만기일 | Brand Portal | Date | No | YYYY-MM-DD | 대금 지급 합의 만기일 |
| `currency` | 통화 | Brand Portal | Text | No | Default `USD` | 결제 통화 (ISO 4217, 예: USD, KRW) |
| `payment_terms_snapshot` | 대금 결제 조건 | Brand Portal | Text | Yes | Snapshot | 발주서 확정 시점의 결제 조건 (예: Net 30, 30% Deposit) |
| `incoterms_snapshot` | 인도 조건 | Brand Portal | Text | Yes | Snapshot | 발주서 확정 시점의 인도 조건 (예: FOB, CIF, DDP) |
| `subtotal` | 품목 소계 | Both | Numeric(15,2) | No | >= 0 | 청구 품목 라인 금액 합계 (`SUM(line_amount)`) |
| `tax_amount` | 세금 | Both | Numeric(15,2) | Yes | Default 0.00 | 적용 세금 |
| `other_charges` | 기타 부대비용 | Both | Numeric(15,2) | Yes | Default 0.00 | 기타 추가 청구금 |
| `invoice_total` | 송장 총액 | Both | Numeric(15,2) | No | >= 0 | 최종 청구 총액 (`subtotal + adjustmentTotal`) |
| `amount_paid` | 지급 완료 금액 | Both | Numeric(15,2) | No | Default 0.00 | 누적 대금 송금 완료 금액 |
| `balance_due` | 미지급 잔액 | Both | Numeric(15,2) | No | `>= 0` | 잔여 미지급 금액 (`invoice_total - amount_paid`) |
| `invoice_status` | 문서 상태 | Both | Enum | No | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID` | 인보이스의 결재/검토 승인 상태 |
| `payment_status` | 지급 상태 | Both | Enum | No | `UNPAID`, `PARTIALLY_PAID`, `PAID` | 대금 지급 이행 현황 상태 (동적 렌더링) |
| `settlement_status` | 정산 상태 | Both | Enum | No | `OPEN`, `SETTLED` | 정산 마감 및 이행 동결 상태 |
| `attachment_path` | 첨부파일 | Brand Portal | Text | Yes | Storage Path | PDF/이미지 송장 증빙 파일 경로 (`company-uploads`) |
| `rejection_reason` | 반려 사유 | Both | Text | Yes | Max 500 chars | 본사 승인 반려 시 작성된 사유 |

---

### 2.2 Supplier Invoice Lines (`supplier_invoice_lines`)
| DB Field Name | UI Label (KR) | Primary Scope | Data Type | Nullable | Constraints | Business Logic & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | - | Both | UUID | No | PK | 라인 품목 식별자 |
| `supplier_invoice_id` | - | Both | UUID | No | FK -> `supplier_invoices.id` | 소속 인보이스 헤더 ID |
| `purchase_order_line_id` | - | Both | UUID | No | FK -> `purchase_order_lines.id` | 소속 발주 품목 라인 ID |
| `product_id` | 제품 ID | Both | UUID | No | FK -> `products.id` | 마스터 제품 ID |
| `sku_snapshot` | SKU | Brand Portal | Text | No | Snapshot | 청구 시점의 K SELECT SKU 코드 |
| `product_name_snapshot` | 제품명 | Brand Portal | Text | No | Snapshot | 청구 시점의 제품 한글/영문명 |
| `invoiced_qty` | 청구 수량 | Brand Portal | Integer | No | > 0 | 공급사가 청구하는 수량 |
| `unit_price` | 청구 단가 | Brand Portal | Numeric(15,2) | No | >= 0 | 계약된 공급 단가 |
| `line_amount` | 라인 총액 | Brand Portal | Numeric(15,2) | No | `= invoiced_qty * unit_price` | 해당 라인의 청구 소계 금액 |
| `line_note` | 라인 비고 | Brand Portal | Text | Yes | Max 200 chars | 라인별 특이사항 메모 |

---

### 2.3 Supplier Invoice Adjustments (`supplier_invoice_adjustments`)
| DB Field Name | UI Label (KR) | Primary Scope | Data Type | Nullable | Values / Constraints | Business Logic & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | - | Both | UUID | No | PK | 정산 조정 건 식별자 |
| `supplier_invoice_id` | 관련 인보이스 | Both | UUID | No | FK -> `supplier_invoices.id` | 소속 인보이스 ID |
| `adjustment_type` | 조정 타입 | Both | Enum | No | `SHORTAGE`, `DAMAGE`, `PRICE_DIFFERENCE`, `OTHER` | 정산 금액 변동 사유 분류 |
| `adjustment_direction` | 구분 (방향) | Both | Enum | No | `CREDIT` (감액 -), `CHARGE` (증액 +) | 대금 차감(-) 또는 증액(+) 구분 |
| `quantity` | 수량 | Both | Integer | Yes | >= 0 | 부족/파손 발생 수량 |
| `unit_amount` | 단가 | Both | Numeric(15,2) | Yes | >= 0 | 수량당 차감 단가 |
| `adjustment_amount` | 조정 금액 | Both | Numeric(15,2) | No | > 0 | 최종 정산 조정 금액 |
| `reason` | 사유 | Both | Text | No | Required | 조정 발생에 대한 명확한 사유 |
| `status` | 조정 상태 | Admin Ref | Enum | No | `PENDING`, `APPROVED`, `REJECTED`, `VOID` | 조정 건의 승인 처리 상태 |

---

### 2.4 Supplier Payments (`supplier_payments`) — Admin Reference & Brand Read View
| DB Field Name | UI Label (KR) | Primary Scope | Data Type | Nullable | Values / Constraints | Business Logic & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | - | Both | UUID | No | PK | 대금 지급 식별자 |
| `payment_number` | 지급 번호 | Both | Text | No | Unique | 본사 자동 생성 지급 식별 번호 |
| `supplier_invoice_id` | 관련 인보이스 | Both | UUID | No | FK -> `supplier_invoices.id` | 지급 대상 인보이스 ID |
| `payment_date` | 지급 일자 | Both | Date | No | YYYY-MM-DD | 실제 송금/지급이 이행된 날짜 |
| `payment_amount` | 지급 금액 | Both | Numeric(15,2) | No | > 0 | 송금집행 금액 |
| `currency` | 통화 | Both | Text | No | ISO 4217 | 송금 통화 |
| `payment_method` | 지급 방법 | Both | Enum | No | `WIRE`, `ACH`, `CHECK`, `OTHER` | 대금 집행 수단 |
| `bank_reference` | 은행 승인번호 | Both | Text | Yes | - | 송금 이체 확인 번호 (Wire Ref) |
| `remittance_bank_name` | 송금 은행 | Brand Read | Text | Yes | - | 대금 송금 처리 은행명 |
| `remittance_account_last4` | 계좌 (마스킹) | Brand Read | Text | Yes | Max 4 chars | 수령 계좌 뒷 4자리 |
| `status` | 지급 상태 | Admin Ref | Enum | No | `DRAFT`, `COMPLETED`, `VOID` | 지급 집행 및 확정 상태 |

---

## 3. Brand Portal UI Controls & Filter Inputs

### 3.1 Finance Hub Header Summary Cards (`/portal/finance`)
- **총 인보이스 금액 Card**: 현재 적용된 필터 조건 기준 전체 인보이스 청구 총액 합계 (`formatCurrency(totalInvoiceAmount)`).
- **총 지급 금액 (Paid) Card**: 현재 적용된 필터 조건 기준 누적 집행 완료된 대금 합계 (`formatCurrency(totalPaidAmount)`).
- **총 잔액 (Balance Due) Card**: 현재 적용된 필터 조건 기준 지급 예정 잔여 미지급 총액 합계 (`formatCurrency(totalBalanceDue)`).

### 3.2 Invoices Tab Controls (`/portal/finance` — Invoices Tab)
- **검색어 입력 (Search Input)**: 인보이스 번호(`supplierInvoiceNumber`), PO 번호(`poNumber`), AP 번호(`internalApNumber`) 키워드 검색.
- **기간 지정 (Date Range Picker)**: 시작일(`startDate`) ~ 종료일(`endDate`) 인보이스 발행일 기준 필터링.
- **날짜 프리셋 버튼 (Date Presets)**: `전체 (ALL)`, `이번 달 (THIS_MONTH)`, `최근 30일 (LAST_30_DAYS)`.
- **지급 상태 드롭다운 (Payment Status Filter)**: `전체`, `미지급 (UNPAID)`, `일부 지급 (PARTIALLY_PAID)`, `지급 완료 (PAID)`.
- **문서 상태 드롭다운 (Document Status Filter)**: `전체`, `임시저장 (DRAFT)`, `제출됨 (SUBMITTED)`, `승인됨 (APPROVED)`, `반려됨 (REJECTED)`, `무효 (VOID)`.
- **'+ 새 인보이스 발행' 버튼**: `/portal/finance/new` 진입 액션 (작성 권한 `finance:write` 보유 시만 노출).

---
