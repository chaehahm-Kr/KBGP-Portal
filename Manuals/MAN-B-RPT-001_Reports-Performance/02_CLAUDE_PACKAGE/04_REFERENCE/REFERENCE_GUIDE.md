# REFERENCE GUIDE: MAN-B-RPT-001
## Reports & Performance Metric Specifications, Formulas & Domain Boundaries

- **Manual ID:** `MAN-B-RPT-001`
- **Topic:** `Reports & Performance (성과 분석, 대시보드 KPI 및 운영 지표)`
- **Audience:** `B — Brand Portal Users & Operators`
- **Authoritative Date:** 2026-10-01

---

## 1. 7 Core Metric Groups Summary

| Group ID | Metric Group Name | Primary Surface / Route | Core Subject & Key Indicators |
| :---: | :--- | :--- | :--- |
| **G1** | **대시보드 총괄 KPI** | `/portal` | 진행 중 발주서, 미지급 정산 잔액, 제품 완성도, 미종결 문의 건수 |
| **G2** | **긴급 조치 큐** | `/portal` | 3단계 우선순위(`URGENT`, `DUE_SOON`, `NORMAL`) 기반 업무 병목 큐 |
| **G3** | **발주 파이프라인 성과** | `/portal/orders/purchase-orders` | 5대 라이프사이클 집계, 90일 기간 필터, 6대 상태 칩, 다중 정렬 |
| **G4** | **재무 및 정산 실적** | `/portal/finance` | 총 청구액, 지급 완료액, 미지급 잔액, 지급 기한 초과(Overdue) 잔액 |
| **G5** | **카탈로그 완성도 지표** | `/portal/products` | 28대 기준 평가기 기반 `COMPLETE` vs `Draft (Incomplete)` 분류 |
| **G6** | **1:1 고객지원 처리 현황** | `/portal/support` | 열린 문의, 파트너 회신 대기(`Action Required`), 운영팀 검토 중 |
| **G7** | **어드민 전사 발주 지표** | `/admin/purchasing/dashboard` | 전사 발주 총액, 공급사별 실적(Supplier Summary), SKU별 미입고 수량 |

---

## 2. Action Required Priority & Trigger Matrix

| Priority Level | Badge Color | Trigger Condition | Target Entity | Action Link (Route) | Action CTA Label |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `URGENT` | Red (`#EF4444`) | • 발주서 수락 대기 (`supplier_confirmation_status === 'PENDING'`)<br>• 지급 기한 초과 인보이스 (`balanceDue > 0 && dueDate < now`)<br>• 운영팀 추가 답변 요청 (`case.status === 'action_required'`) | PO / Invoice / Case | `/portal/orders/purchase-orders/[id]`<br>`/portal/finance/[id]`<br>`/portal/support?case=[id]` | 발주서 확인<br>인보이스 확인<br>답변 작성 |
| `DUE_SOON` | Amber (`#F59E0B`) | • 생산 완료 후 출고 서류 대기 (`overall_status === 'Ready to Ship'`)<br>• 미결제 인보이스 잔액 존재 (`balanceDue > 0`) | PO / Invoice | `/portal/orders/purchase-orders/[id]`<br>`/portal/finance/[id]` | 출고 정보 등록<br>인보이스 확인 |
| `NORMAL` | Blue/Gray (`#3B82F6`) | • 필수 스펙/바코드 누락 제품 (`status === 'Draft'`) | Product | `/portal/products/[id]` | 제품 정보 수정 |

---

## 3. Order Pipeline Status Mapping Matrix (RPT Aggregation vs ORD Lifecycle)

| Pipeline Stage Card (RPT) | Overall Statuses Included | Business Definition |
| :--- | :--- | :--- |
| **전체 진행 중 (Total Open)** | `Sent to Supplier`, `Supplier Confirmed`, `In Production`, `Change Requested`, `Ready to Ship`, `Shipped`, `Arrived`, `Receiving` | 완료(Completed) 또는 취소(Cancelled) 상태를 제외한 활성 발주서 합계 |
| **생산 중 (In Production)** | `Sent to Supplier`, `Supplier Confirmed`, `In Production`, `Change Requested` | 발주 수락 및 공장 생산 진행 단계 |
| **출고 준비 (Ready to Ship)** | `Ready to Ship` | 생산 완료 후 수출 패킹리스트 등록 대기 단계 |
| **입고/검수 (Receiving)** | `Shipped`, `Arrived`, `Receiving` | 수출 선적 운송 중 및 미국 물류센터 입고/검수 단계 |
| **완료 (Completed)** | `Completed` | 실물 입고 검수 및 정산 연계가 완료되어 최종 종결된 발주서 |

---

## 4. 28-Criteria Product Completeness Checklist Matrix

| Spec Category | Required Criteria Fields (28 Items Checked) | Evaluation Fail State |
| :--- | :--- | :---: |
| **기본 정보 (Basic - 6)** | 국문 제품명, 영문 제품명, 귀속 브랜드 ID, 카테고리 코드, 제조 SKU, 원산지 국가 | `Draft` 판정 |
| **가격 정보 (Pricing - 2)** | 한국 소비자 정가(`price_krw_retail` > 0), 수출 공급 단가 FOB(`price_usd_fob` > 0) | `Draft` 판정 |
| **단품 규격 (Unit Spec - 4)** | 단품 가로, 세로, 높이, 순중량 (단위: mm, g) | `Draft` 판정 |
| **개별 포장 규격 (Package - 4)**| 포장 가로, 세로, 높이, 포장 총중량 | `Draft` 판정 |
| **카톤 박스 규격 (Carton - 5)** | 카톤 입수량(>= 1), 카톤 가로, 세로, 높이, 카톤 총중량 | `Draft` 판정 |
| **식별 바코드 (Barcode - 1)** | 12자리 UPC (`/^\d{12}$/`) 또는 13자리 EAN (`/^\d{13}$/`) 유효성 | `Draft` 판정 |
| **대표 이미지 (Images - 1)** | 고해상도 대표 상품 이미지 1장 이상 등록 | `Draft` 판정 |
| **종합 판정** | **28개 전 항목 충족 시 `COMPLETE` 승격 / 1개라도 누락 시 `Draft` 유지** | — |

---

## 5. Admin Purchasing KPI Calculation Formulas

| Metric Key | Display Label (KO) | Aggregation Formula | Operational Scope |
| :--- | :--- | :--- | :--- |
| `totalPoCount` | 총 발주 건수 | `count(purchase_orders)` matching date/status filters | All Filtered POs |
| `totalOrderedQty` | 총 주문 수량 | `sum(purchase_order_lines.qty)` | Total Units |
| `totalOrderAmount` | 총 발주 금액 | `sum(purchase_order_lines.qty * unit_cost)` | Total PO USD |
| `openPoAmount` | 진행 중 발주 금액 | `sum(open_pos.totalOrderAmount)` | Active Pipeline USD |
| `unreceivedQty` | 미입고 잔여 수량 | `sum(max(0, ordered_qty - received_qty))` | Backlog Units |
| `unreceivedAmount` | 미입고 잔여 금액 | `sum(remaining_qty * unit_cost)` | Backlog USD |
| `paidAmount` | 공급사 정산 지급액 | `sum(supplier_invoices.amount_paid)` | Settled USD |
| `outstandingAmount` | 공급사 정산 미지급액 | `sum(supplier_invoices.balance_due)` | Payable USD |
| `overduePoCount` | 납기 지연 발주 건수 | `count(open_pos where expectedDate < today)` | Overdue POs |

---

## 6. Authoritative Cross-Domain Boundary Formulas

1. **`RPT ↔ PROD`**: `PROD Spec Completeness Definition ≠ RPT Dashboard Display` (PROD is the Authoritative Attribute Source; RPT only evaluates and displays completeness).
2. **`RPT ↔ ORD`**: `PO Lifecycle Execution (ORD 6-Step) ≠ Performance Aggregation (RPT 5-Stage)` (ORD manages authoritative state transitions; RPT computes counts, timelines, and backlog).
3. **`RPT ↔ FIN`**: `Invoice Settlement Processing ≠ Cash Flow Reporting` (FIN executes bank transfers and adjustments; RPT aggregates balances and overdue totals).
4. **`RPT ↔ RET`**: `Store Placement Operations (RET) ≠ Performance Aggregation (RPT)` (RET manages operational store audits; /retailer/sales is a separate retailer surface, RPT only displays verified performance metrics).
5. **`RPT ↔ PERM`**: `Role & ACL Enforcement ≠ Metric Visibility` (PERM enforces multi-tenant RLS; RPT respects session company isolation).

---
*End of REFERENCE_GUIDE.md*
