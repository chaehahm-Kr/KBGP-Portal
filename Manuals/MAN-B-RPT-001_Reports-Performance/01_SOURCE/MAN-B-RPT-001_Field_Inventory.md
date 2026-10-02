# MAN-B-RPT-001 — Field & Metric Inventory
## Reports & Performance Guide (01_SOURCE)

- **Manual ID:** `MAN-B-RPT-001`
- **Document Name:** `Field & Metric Inventory`
- **Audience:** `B` (Brand Portal Users & Operators)
- **Effective Date:** 2026-10-01
- **Status:** `APPROVED CANONICAL SOURCE`

---

## 1. Metric & Field Groups Overview

K SELECT 포털의 성과 및 지표 데이터는 7대 핵심 그룹으로 구성되어 운영됩니다:
1. **Group 1: 대시보드 총괄 KPI (Dashboard Overall KPIs)**
2. **Group 2: 긴급 실행 필요 큐 (Action Required Queue Engine)**
3. **Group 3: 발주 성과 및 파이프라인 지표 (PO Performance & Pipeline Metrics)**
4. **Group 4: 재무 및 정산 성과 지표 (Finance & Settlement Metrics)**
5. **Group 5: 카탈로그 완성도 평가 지표 (Product Catalog Readiness Metrics)**
6. **Group 6: 1:1 고객지원 처리 지표 (Support Resolution Metrics)**
7. **Group 7: 어드민 발주 현황 대시보드 지표 (Admin Purchasing Analytics)**

---

## 2. Group 1: Brand Portal Dashboard Summary KPIs (`/portal`)

| Field / Metric Key | UI Display Label (KO) | UI Display Label (EN) | Data Type | Unit / Format | Calculation Formula / Source | Nullability & Default |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `openPoCount` | 진행 중 발주서 | Open POs | Integer | 건 (Count) | `count(pos where overall_status NOT IN ('Completed', 'Cancelled'))` | Non-nullable (0) |
| `readyToShipCount` | 출고 준비 완료 | Ready to Ship | Integer | 건 (Count) | `count(pos where overall_status === 'Ready to Ship')` | Non-nullable (0) |
| `receivingCount` | 입고/검수 진행 중 | In Receiving | Integer | 건 (Count) | `count(pos where overall_status IN ('Receiving', 'Arrived'))` | Non-nullable (0) |
| `totalInvoiceAmount` | 총 청구 금액 | Total Invoiced | Decimal | USD ($) | `sum(invoices.invoiceTotal)` | Non-nullable ($0) |
| `totalPaidAmount` | 총 정산 완료액 | Total Paid | Decimal | USD ($) | `sum(invoices.amountPaid)` | Non-nullable ($0) |
| `totalOutstandingBalance` | 미지급 정산 잔액 | Balance Due | Decimal | USD ($) | `sum(invoices.balanceDue)` | Non-nullable ($0) |
| `totalOverdueAmount` | 지급 기한 초과 | Overdue Balance | Decimal | USD ($) | `sum(invoices.balanceDue where dueDate < now)` | Non-nullable ($0) |
| `nextDueInvoice` | 차기 지급 예정일 | Next Due Date | Object | YYYY-MM-DD | `min(invoices.dueDate where balanceDue > 0)` | Nullable (없음) |
| `completeProductCount` | 등록 완료 제품 | Complete Products | Integer | 개 (SKU) | `count(products passing 28 criteria)` | Non-nullable (0) |
| `incompleteProductCount` | 보완 필요 제품 | Draft / Incomplete | Integer | 개 (SKU) | `count(products with missing fields)` | Non-nullable (0) |
| `openCaseCount` | 미종결 문의 | Open Cases | Integer | 건 (Count) | `count(supportCases where status !== 'CLOSED')` | Non-nullable (0) |
| `awaitingBrandCasesCount` | 파트너 회신 대기 | Awaiting Brand | Integer | 건 (Count) | `count(cases in 'action_required', 'awaiting_reply')` | Non-nullable (0) |
| `awaitingLetustoCasesCount` | 운영팀 검토 중 | Under Review | Integer | 건 (Count) | `count(cases in 'RECEIVED', 'UNDER_REVIEW')` | Non-nullable (0) |

---

## 3. Group 2: Action Required Queue Priority Engine (`/portal`)

대시보드 상단의 **실행 필요(Action Required)** 큐는 브랜드사의 일일 업무 병목을 방지하기 위해 3단계 우선순위 알고리즘으로 실시간 산출됩니다.

| Priority Level | Badge Color | Trigger Condition | Target Entity | Action Link (Route) | Button CTA Label |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `URGENT` | Red (빨간색) | • 발주서 미확정 (`supplier_confirmation_status === 'PENDING'`)<br>• 지급 기한 초과 인보이스 (`balanceDue > 0 && dueDate < now`)<br>• 운영팀의 추가 자료/답변 요청 (`case.status === 'action_required'`) | PO / Invoice / Case | `/portal/orders/purchase-orders/[id]`<br>`/portal/finance/[id]`<br>`/portal/support?case=[id]` | 발주서 확인<br>인보이스 확인<br>답변 작성 |
| `DUE_SOON` | Amber (주황색) | • 생산 완료 후 출고 준비 상태 (`overall_status === 'Ready to Ship'`)<br>• 미지급 인보이스 잔액 존재 (`balanceDue > 0`) | PO / Invoice | `/portal/orders/purchase-orders/[id]`<br>`/portal/finance/[id]` | 출고 정보 등록<br>인보이스 확인 |
| `NORMAL` | Gray / Blue (회색) | • 필수 스펙/바코드 누락 제품 (`status === 'Draft'`) | Product | `/portal/products/[id]` | 제품 정보 수정 |

### Action Item Data Structure
```typescript
interface ActionRequiredItem {
  id: string; // Unique entity identifier (e.g. po-conf-xxx, inv-xxx, case-xxx)
  priority: "URGENT" | "DUE_SOON" | "NORMAL";
  typeLabel: string; // Domain label (e.g. "발주서 확인", "정산 인보이스", "1:1 문의 회신")
  referenceNumber: string; // PO Number, Invoice No, Case No, or SKU
  title: string; // Human-readable bottleneck summary
  description: string; // Detailed action instructions
  updatedAt?: string | null; // ISO DateTime string
  href: string; // Destination action route
  actionLabel: string; // Button CTA text
}
```

---

## 4. Group 3: Order Performance & PO Pipeline Metrics (`/portal/orders/purchase-orders`)

### 4.1 Global Pipeline KPI Cards
- **전체 진행 중 (Total Open)**: `metrics.totalOpen` (Sent, Confirmed, In Production, Ready to Ship, Shipped, Arrived, Receiving 합산)
- **생산 중 (In Production)**: `metrics.inProduction` (Sent to Supplier, Supplier Confirmed, In Production, Change Requested)
- **출고 준비 (Ready to Ship)**: `metrics.readyToShip` (생산 완료 후 패킹리스트 등록 대기)
- **입고/검수 (Receiving)**: `metrics.receiving` (Shipped, Arrived, Receiving)
- **완료 (Completed)**: `metrics.completed` (검수 완료 및 종결)

### 4.2 PO Filter & Sorting Parameters
| Parameter | Type | Default Value | Supported Options | Logic Description |
| :--- | :--- | :--- | :--- | :--- |
| `fromDate` | Date string (YYYY-MM-DD) | Current Date - 90 Days | Any valid ISO date | Filter POs where `order_date >= fromDate` |
| `toDate` | Date string (YYYY-MM-DD) | Current Date | Any valid ISO date | Filter POs where `order_date <= toDate` |
| `activePreset` | String | `last_90` | `last_30`, `last_90`, `this_year`, `custom` | Quick date calculation helper |
| `selectedCategories` | Array of strings | `['IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'RECEIVING']` | `IN_PRODUCTION`, `READY_TO_SHIP`, `SHIPPED`, `RECEIVING`, `COMPLETED`, `CANCELLED` | Filters PO by overall lifecycle category. Default excludes Completed/Cancelled to focus on active operations. |
| `searchTerm` | String | `""` | Any text | Matches `po_number`, `primary_product_name`, `primary_sku` (case-insensitive) |
| `sortBy` | String | `newest` | `newest`, `oldest`, `amount_desc`, `amount_asc` | Sorts PO table rows |

---

## 5. Group 4: Finance & Settlement Performance Metrics (`/portal/finance`)

| Metric Key | UI Label (KO) | UI Label (EN) | Calculation Rule | Business Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| `totalInvoiced` | 총 인보이스 발행액 | Invoiced Amount | `sum(invoice_total)` | 공급사가 K SELECT에 청구한 총 정산 금액 |
| `totalPaid` | 정산 지급 완료액 | Total Paid | `sum(amount_paid)` | K SELECT가 공급사 계좌로 송금 완료한 누적 금액 |
| `balanceDue` | 미지급 잔액 | Balance Due | `sum(balance_due)` | 아직 송금되지 않은 미결제 정산 잔액 |
| `overdueInvoices` | 지급 기한 초과 건수 | Overdue Invoices | `count(balance_due > 0 && due_date < today)` | 계약 지급일을 초과한 지연 정산 건수 |
| `adjustmentsTotal` | 정산 조정 금액 | Adjustments | `sum(adjustment_amount)` | 물류 손실, 품질 이슈, 단가 차액 등 공제/가산 금액 |

---

## 6. Group 5: Product Catalog Completeness Metrics (`/portal/products`)

등록 평가기(`evaluateProductRegistrationStatus`)가 평가하는 28대 기준:

| Spec Category | Required Fields Checked | Completeness Status Criteria |
| :--- | :--- | :--- |
| **기본 정보 (Basic)** | • 국문 제품명 (`name`)<br>• 영문 제품명 (`name_en`)<br>• 귀속 브랜드 (`brand_id`)<br>• 카테고리 코드 (`category_code`)<br>• 공급사 제조 SKU (`manufacture_sku`)<br>• 원산지 국가 (`origin`) | 누락 시 `Draft (Incomplete)` 판정 |
| **가격 정보 (Pricing)** | • 한국 소비자 정가 (`price_krw_retail` > 0)<br>• 수출 공급 단가 FOB (`price_usd_fob` > 0) | 미입력 시 `Draft` 판정 |
| **단품 규격 (Unit Spec)** | • 가로/세로/높이 (`item_width, item_depth, item_height` > 0)<br>• 순중량 (`item_weight` > 0) | 단위(mm, g) 필수 검증 |
| **개별 포장 규격 (Package)** | • 포장 가로/세로/높이 (`package_width, package_depth, package_height` > 0)<br>• 포장 중량 (`package_weight` > 0) | 포장 박스/용기 규격 |
| **카톤 박스 규격 (Carton)** | • 카톤 입수량 (`carton_pack_qty` >= 1)<br>• 카톤 가로/세로/높이 (`carton_width, carton_depth, carton_height` > 0)<br>• 카톤 총중량 (`carton_weight` > 0) | 물류 파레트 적재 기준 |
| **식별 바코드 (Barcode)** | • 12자리 UPC (`/^\d{12}$/`) 또는 13자리 EAN (`/^\d{13}$/`) | 포맷 미충족 시 `Draft` 유지 |
| **대표 이미지 (Images)** | • 대표 상품 이미지 1장 이상 등록 (`product_images.length >= 1`) | 이미지 필수 |

---

## 7. Group 6: Support Resolution Metrics (`/portal/support`)

| Metric Key | UI Label (KO) | UI Label (EN) | Operational Significance |
| :--- | :--- | :--- | :--- |
| `openCases` | 열린 문의 | Open Tickets | 현재 해결이 완료되지 않은 모든 1:1 지원 티켓 |
| `awaitingBrand` | 파트너 회신 대기 | Awaiting Supplier | 운영팀이 요청한 추가 자료나 확인 회신을 기다리는 긴급 건 |
| `underReview` | 운영팀 검토 중 | In Review | 파트너가 접수한 문의를 K SELECT 전문 담당자가 검토 중인 건 |
| `closedCases` | 해결 완료 | Resolved | 문의 사항이 최종 종결 처리된 건수 |

---

## 8. Group 7: Admin Purchasing Performance Metrics (`/admin/purchasing/dashboard`)

| Metric Key | Display Label (KO) | Formula / Aggregation Logic | Scope |
| :--- | :--- | :--- | :--- |
| `totalPoCount` | 총 발주 건수 | `count(purchase_orders)` matching filters | All filtered POs |
| `totalOrderedQty` | 총 주문 수량 | `sum(purchase_order_lines.qty)` | Total Units |
| `totalOrderAmount` | 총 발주 금액 | `sum(purchase_order_lines.qty * unit_cost)` | Total PO USD |
| `openPoAmount` | 진행 중 발주 금액 | `sum(open_pos.totalOrderAmount)` | Active Pipeline USD |
| `unreceivedQty` | 미입고 잔여 수량 | `sum(max(0, ordered_qty - received_qty))` | Backlog Units |
| `unreceivedAmount` | 미입고 잔여 금액 | `sum(remaining_qty * unit_cost)` | Backlog USD |
| `paidAmount` | 공급사 정산 지급액 | `sum(supplier_invoices.amount_paid)` | Settled USD |
| `outstandingAmount` | 공급사 정산 미지급액 | `sum(supplier_invoices.balance_due)` | Payable USD |
| `overduePoCount` | 납기 지연 발주 건수 | `count(open_pos where expectedDate < today)` | Overdue Orders |

---

## 9. Discrepancy Analysis (UI Label vs Backend Formula)

1. **Overall Status vs PO Table Status**:
   - UI는 공급사 혼선을 방지하기 위해 `In Production`, `Ready to Ship`, `Receiving`, `Completed`의 직관적인 상위 카테고리 칩으로 그룹화하여 표시하지만, 실제 백엔드는 `po_status`, `fulfillment_status`, `supplier_confirmation_status`, 실물 선적(`inbound_shipments`) 및 창고 검수(`receivings`) 레코드를 종합 연산(`getOverallStatus()`)하여 도출합니다.
2. **Catalog Completeness Percentage**:
   - 단순 필수 텍스트 유무뿐만 아니라 바코드 정규식 검증(`/^\d{12}$/|/^\d{13}$/`)과 카테고리별 동적 필수 속성(`getBatchProductCategoryCompletions`)까지 충족해야 `COMPLETE`로 계산됩니다.
3. **Currency & Timezone**:
   - 모든 금액 지표는 미국 달러(USD, `$`)를 기준으로 집계되며, 한국 원화(KRW) 소비자가는 참고용으로 보존됩니다.
   - 모든 날짜는 미국 동부 표준시(Eastern Time, ET) 및 UTC 기준 일관된 ISO 포맷(`YYYY-MM-DD`)으로 정규화됩니다.
