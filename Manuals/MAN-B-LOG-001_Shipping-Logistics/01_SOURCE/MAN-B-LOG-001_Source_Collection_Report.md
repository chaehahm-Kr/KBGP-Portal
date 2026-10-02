# MAN-B-LOG-001: Source Collection & Production System Audit Report
## Brand Portal Shipping & Logistics Management (출고, 선적 및 국제 물류 관리)

- **Manual ID:** `MAN-B-LOG-001`
- **Manual Title:** K SELECT Brand Portal Shipping & International Logistics Guide (출고 준비, 선적 및 물류 추적 가이드)
- **Audience:** `B — Brand Portal (브랜드사 / 공급사 물류 및 출고 담당자)`
- **Target Topic:** `물류 & 선적 / topic-logistics`
- **Audit Phase:** `01_SOURCE — Production Source Collection & Baseline Audit`
- **Audited Repository:** `KSelectNetwork-Portal` & `KSelectNetwork-ADMIN`
- **Authoritative Date:** 2026-10-01
- **Status:** `READY FOR CHATGPT SOURCE REVIEW`

---

## 1. Executive Summary & Audit Scope

본 보고서는 K SELECT Brand Portal의 **출고 준비(Goods Readiness), 국제 선적(Inbound Shipments), 운송 책임(Shipping Responsibility), 카고 규격/패킹 서류 등록, 화물 인계(Handover), 그리고 미국 창고 입고(Warehouse Receiving) 인계 프로세스**의 실제 Production 구현 상태를 전수 감사(Audit)하여 공식 매뉴얼 제작을 위한 Single Source of Truth를 구축한 결과입니다.

### 1.1 Cross-Manual Domain Architecture & Multi-Track Boundaries
K SELECT의 주문, 물류, 창고, 재무 시스템은 독립된 책임 영역을 가지며, 공식 발주 확정(PO Confirmation) 이후 물류와 정산이 병렬/직교적으로 진행될 수 있는 구조로 설계되어 있습니다:

```text
                                  ┌── [MAN-B-LOG-001] 선적 & 물류 도메인 ── [창고 도메인] 입고 검수
[MAN-B-ORD-001] 발주 및 계약 확정 ──┤   (Goods Readiness → Cargo Spec → Inbound Tracking → Arrival → Receiving Handoff)
(po_status: APPROVED/SENT         │
 supplier_confirmation: CONFIRMED)└── [MAN-B-FIN-001] 재무 & 정산 도메인
                                      (Invoice Creation → Approval → Settlement)
```

| 매뉴얼 / 도메인 | 핵심 질문 및 관할 영역 | 주요 엔티티 및 상태 필드 | 도메인 인계 / 관계 지점 |
| :--- | :--- | :--- | :--- |
| **`MAN-B-ORD-001`**<br>Order Management | *"PO를 어떻게 접수·확정하고 계약 수량을 이행하는가?"*<br>- 발주 요청(PO Request) 생성<br>- 정식 PO 검토 및 수락/반려<br>- 품목별 계약 수량 이행률 관리 | `purchase_orders.po_status`<br>`purchase_orders.supplier_confirmation_status`<br>`purchase_orders.fulfillment_status` | `po_status IN ('APPROVED', 'SENT')` 및 `supplier_confirmation_status = 'CONFIRMED'` 조건 충족 시 LOG 및 FIN 도메인 진입 가용 |
| **`MAN-B-LOG-001`**<br>*(본 매뉴얼)*<br>Shipping & Logistics | *"상품 출고 준비 후 실제 물류가 어떻게 패킹·선적·추적·인계되는가?"*<br>- 출고 준비 완료 등록 (Ready Qty, Cartons, Weight, CBM)<br>- 패킹리스트(P/L) 및 상업송장(C/I) 첨부<br>- `LETUSTO_ARRANGED` vs `SUPPLIER_ARRANGED` 운송 분기<br>- 운송사 인계 및 Inbound Shipment 추적 | `goods_readiness.handover_status`<br>`inbound_shipments.status`<br>`purchase_orders.fulfillment_status` | 화물이 미국 물류센터에 도착(`ARRIVED`/`DELIVERED`)하여 창고 입고 검수로 실물 인계 |
| **창고 입고 도메인**<br>Warehouse Receiving | *"도착한 화물의 실물 수량과 품질을 어떻게 검수하는가?"*<br>- 현장 카톤 바코드 스캔<br>- 실물 피스 카운팅 (정상/파손/보류 격리)<br>- 입고 전표 확정 | `receivings.status`<br>`receiving_lines.received_qty`<br>`receiving_lines.damaged_qty`<br>`receiving_lines.hold_qty` | 물리적 검수 완료(`RECEIVED`) 기록 |
| **`MAN-B-FIN-001`**<br>Finance & Settlement | *"확정된 발주 및 거래 조건에 따라 어떻게 청구·정산하는가?"*<br>- 인보이스(Invoice) 작성 및 청구<br>- 승인 및 대금 결제/송금 관리 | `invoices.status`<br>`invoice_lines`<br>`settlements` | 확정 PO를 바탕으로 별도 계약/거래 조건에 따라 청구 및 정산 진행 |

---

## 2. Production Code & UI Surface Architecture

### 2.1 Brand Portal Routes & UI Components
| Route / URL | Server Component / Page | Client Component | Data Fetching & Server Actions |
| :--- | :--- | :--- | :--- |
| `/portal/orders/shipping` | `app/portal/orders/shipping/page.tsx` | `components/portal/shipping-client.tsx` | - `getPortalReadinessList()`<br>- `getPortalShipments()`<br>- Eligible POs Query (`po_status IN ('APPROVED', 'SENT') AND supplier_confirmation_status = 'CONFIRMED'`) |
| `/portal/orders/shipping/[id]` | `app/portal/orders/shipping/[id]/page.tsx` | `app/portal/orders/shipping/[id]/detail-client.tsx` | - `getPortalReadinessById(id)`<br>- `getShippingAttachmentUrl(path)`<br>- `submitPortalHandover(id)`<br>- `submitPortalSupplierArrangedShipment(...)` |
| `/api/portal/purchase-orders/[id]` | `app/api/portal/purchase-orders/[id]/route.ts` | Modal Dynamic Fetcher | PO Line 품목 정보, 확정 수량, 기선적 수량, 잔여 가용 수량 조회 |

### 2.2 Server Actions (`lib/portal/actions.ts`)
1. **`getPortalReadinessList()`**: 브랜드사(`supplier_id = companyId`)의 Goods Readiness 목록 조회.
2. **`getPortalReadinessById(id)`**: 출고 준비 헤더, 품목별 실측 규격(Cartons, Gross Weight, CBM), 첨부파일 경로 조회.
3. **`getPortalShipments()`**: `portal_inbound_shipments` 뷰를 통해 브랜드사가 참여하는 모든 입고 선적 추적 내역 조회.
4. **`submitPortalGoodsReady(input)`**: 신규 출고 준비 정보 등록 또는 기존 Draft/Submitted 정보 수정. PO `fulfillment_status`를 `READY_TO_SHIP`으로 자동 전환.
5. **`submitPortalHandover(readinessId)`**: LETUSTO 지정 포워더에 물품 인계 완료 시 `handover_status`를 `HANDED_OVER`로 갱신.
6. **`submitPortalSupplierArrangedShipment(readinessId, shippingDetails)`**: 공급사 직배송 건에 대해 선적(`inbound_shipments`)을 직접 등록하고 상태를 `IN_TRANSIT`으로 갱신, PO `fulfillment_status`를 `SHIPPED`로 전환.
7. **`uploadShippingAttachment(formData)`** & **`getShippingAttachmentUrl(path)`**: Private Storage 버킷(`shipping-attachments`)에 P/L, C/I 업로드 및 인증 서명 URL(Signed URL) 발급.

---

## 3. Database Schema & State Fields Disambiguation

### 3.1 상태 필드 명확화 및 용어 정의 (State Disambiguation)
Production 데이터베이스에서는 주문, 출고, 선적, 입고가 독립된 상태 컬럼으로 관리되므로, 이를 하나의 "상태"로 혼합하여 표현하지 않습니다:

1. **`purchase_orders.po_status`**: 공식 발주서의 내부 계약 승인 상태 (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SENT`, `CANCELLED`).
2. **`purchase_orders.supplier_confirmation_status`**: 공급사의 정식 발주 수락 상태 (`PENDING`, `CONFIRMED`, `REJECTED`).
3. **`purchase_orders.fulfillment_status`**: 발주서의 전반적 물류 이행 진척도 (`PENDING`, `READY_TO_SHIP`, `PARTIALLY_SHIPPED`, `SHIPPED`, `RECEIVED`).
4. **`goods_readiness.handover_status`**: 공급사의 개별 출고 건 물리적 인계 상태 (`DRAFT`, `READY_SUBMITTED`, `HANDOVER_PENDING`, `HANDED_OVER`).
5. **`inbound_shipments.status`**: 국제 운송 선적 건의 이동 상태 (`CREATED`, `IN_TRANSIT`, `ARRIVED`, `RECEIVED`, `COMPLETED`, `CANCELLED`).

> **핵심 원칙**:
> - `ARRIVED ≠ RECEIVED`: `ARRIVED`는 화물이 목적지 항구/창고 도크에 도착한 상태이며, `RECEIVED`는 창고에서 물리적 개봉/바코드 스캔/수량 및 품질 검수가 완료된 상태입니다.
> - `RECEIVED ≠ COMPLETED`: `RECEIVED`는 물품 입고 검수 완료를 의미하며, `COMPLETED`는 행정/물류 프로세스의 최종 종결을 의미합니다.
> - `Shipping Complete ≠ Settlement Complete`: 물류의 선적/도착 완료와 재무 도메인의 인보이스 대금 결제/정산 완료는 별개의 비즈니스 이벤트입니다.

---

## 4. Dual Track Shipping Responsibility Breakdown

K SELECT 시스템의 물류는 발주서에 지정된 `shipping_responsibility`에 따라 완전히 분기된 업무 흐름을 따릅니다:

### Track 1: `LETUSTO_ARRANGED` (본사 지정 운송 / FOB 기준)
1. **Goods Readiness 등록 조건**:
   - `po_status IN ('APPROVED', 'SENT')`
   - `supplier_confirmation_status = 'CONFIRMED'`
2. **브랜드사 액션**:
   - 출고 준비 완료 예정일(`goodsReadyDate`), FOB 선적항(`fobPort`), 출고지 공장 주소 및 현장 연락처 입력.
   - 품목별 실측 패킹 스펙 입력: 준비 수량(`readyQty`), 박스 수(`cartons`), 총중량(`grossWeight` kg), 체적(`cbm` $\text{m}^3$).
   - Packing List (P/L) 및 Commercial Invoice (C/I) 파일 첨부.
   - 제출(`READY_SUBMITTED`) 후 Letusto 포워더가 공장/창고로 방문하여 물품 수거(Pickup).
   - 수거 완료 시 상세 화면에서 **`물품 인계 완료 (Handed Over)`** 버튼 클릭 $\rightarrow$ `goods_readiness.handover_status`가 `HANDED_OVER`로 변경.
3. **Admin / Letusto 액션**:
   - 포워더 배정, 부킹(Booking) 진행, B/L 발급, Inbound Shipment 생성.
   - 컨테이너 적재, 해상/항공 운송, 미국 세관 통관 및 내륙 운송 추적.

### Track 2: `SUPPLIER_ARRANGED` (공급사 자체 운송 / DDP 기준)
1. **Goods Readiness 등록 조건**:
   - `po_status IN ('APPROVED', 'SENT')`
   - `supplier_confirmation_status = 'CONFIRMED'`
2. **브랜드사 액션**:
   - 출고 준비 정보 등록 (스펙, 박스수, CBM, 중량, P/L, C/I 등록).
   - 브랜드사가 직접 계약한 국제 특송/포워더(DHL, FedEx, UPS, 해운 포워더 등)를 통해 물품 출고 및 선적.
   - Brand Portal 출고 준비 상세 화면(`/portal/orders/shipping/[id]`)의 **물류 액션 패널**에서 직접 선적 등록:
     - 배송사(`carrier`): 예, FedEx, DHL, CJ대한통운 등
     - 송장번호(`trackingNumber`) 또는 선하증권(`billOfLading` / `airWaybill`)
     - 출발일(`etd`) 및 도착예정일(`eta`)
   - **`배송 출발 및 선적 등록`** 버튼 클릭 $\rightarrow$ 즉시 `inbound_shipments` 레코드가 자동 생성되며 선적 상태가 `IN_TRANSIT`으로 전환, PO `fulfillment_status`가 `SHIPPED`로 갱신됨.
3. **Admin / Letusto 액션**:
   - 등록된 Tracking Number / B/L 정보를 모니터링하고 미국 물류센터 도착 시 입고 검수(Receiving) 준비.

---

## 5. Lifecycle State Machines & Business Rules

### 5.1 Goods Readiness Status Lifecycle
```
[ DRAFT ] (임시저장 - 수량/서류 자유 수정 가능)
    │
    ▼ submitPortalGoodsReady(status: 'READY_SUBMITTED')
[ READY_SUBMITTED ] (출고 준비 완료 제출 - PO fulfillment_status: READY_TO_SHIP)
    │
    ▼ (포워더 픽업 예약 또는 선적 준비 진행)
[ HANDOVER_PENDING ] (인계 대기)
    │
    ├──────────────────────────────────────────────────────┐
    │ (LETUSTO_ARRANGED: 포워더 수거 확인)                 │ (SUPPLIER_ARRANGED: 직배송 선적 등록)
    ▼ submitPortalHandover()                              ▼ submitPortalSupplierArrangedShipment()
[ HANDED_OVER ] (물품 인계 완료)                       [ HANDED_OVER ] (선적 생성 & IN_TRANSIT 전환)
```

### 5.2 Inbound Shipment Status Lifecycle & Warehouse Handoff
```
[ CREATED / DRAFT ] (선적 생성 및 부킹)
    │
    ▼ (선적 출항 / 화물 발송)
[ SHIPPED / IN_TRANSIT ] (운송 중 - ETD/ETA/Tracking 추적)
    │
    ▼ (미국 현지 창고 도착)
[ ARRIVED / DELIVERED ] (창고 도착 - Logistics 도메인 완료 & Warehouse Receiving 도메인으로 Handoff)
    │
    ├─────────────────────────────┐
    ▼ (일부 수량 실물 검수)         ▼ (전수 실물 검수 완료)
[ PARTIALLY_RECEIVED ]        [ RECEIVED ] (물리적 입고 검수 완료)
    │                             │
    └─────────────────────────────┴──► [ COMPLETED ] (선적 및 입고 행정 종결)
```

### 5.3 Overage & Quantity Protection Rules
- **잔여 가용 수량 연산 공식**:
  $$\text{Available Readiness Qty} = \text{Confirmed Qty} - \text{Cumulative Shipped Qty} - \text{Other Active Ready Qty}$$
- **엄격한 수량 초과 방지**: `readyQty > availableReadiness`인 경우 서버 액션에서 예외(`throw Error`)를 발생시켜 과도한 출고 등록을 원천 차단함.
- **UI 시각 경고**: 실시간으로 가용 수량을 초과하는 입력 시 입력 필드가 붉은색 테두리(`border-rose-300 bg-rose-50`)로 강조되고 경고 배지가 표시됨.

---

## 6. Access Control & Role Permissions

Brand Portal의 선적/출고 모듈은 Company Member ACL에 의해 엄격히 제어됩니다:

| 역할 (Role) | `orders:read` | `orders:write` | 출고/선적 목록 조회 | 상세 정보 및 첨부 다운로드 | 새 출고 등록 및 인계/선적 실행 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Owner / Admin** | ✅ | ✅ | ✅ 허용 | ✅ 허용 | ✅ 허용 |
| **Operator (운영자)** | ✅ | ✅ | ✅ 허용 | ✅ 허용 | ✅ 허용 |
| **Viewer (조회자)** | ✅ | ❌ | ✅ 허용 | ✅ 허용 | ❌ 버튼 비활성화 / 차단 문구 표시 |
| **외부 비인가자** | ❌ | ❌ | ❌ Access Denied | ❌ Access Denied | ❌ Access Denied |

---

## 7. 4-Tier Source Audit Classification

### 7.1 VERIFIED SYSTEM BEHAVIOR (코드/DB/UI 검증 완료 사실)
1. `/portal/orders/shipping` 화면은 `출고 준비 등록 내역 (Goods Readiness)`과 `선적 추적 내역 (Shipments)`의 2개 탭으로 분리되어 있음.
2. 신규 출고 준비 대상 PO 조건은 `po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'`임.
3. 동일한 확정 PO 조건(`APPROVED/SENT` + `CONFIRMED`)에서 `MAN-B-FIN-001`의 인보이스 작성(`getEligiblePosForInvoice`)도 독립적으로 가능하여 두 도메인은 병렬 운영됨.
4. 품목별로 박스 수(Cartons), 총중량(Gross Weight kg), 체적(CBM $\text{m}^3$)을 입력하며, 패킹리스트와 상업송장은 Private Storage에 안전하게 업로드되어 Signed URL로만 다운로드 가능함.
5. `LETUSTO_ARRANGED` 건은 포워더 픽업 후 `물품 인계 완료 (Handed Over)` 버튼을 누르면 상태가 `HANDED_OVER`로 갱신됨.
6. `SUPPLIER_ARRANGED` 건은 브랜드사가 Carrier, Tracking Number / B/L, ETD, ETA를 입력하여 직접 `inbound_shipments`를 생성하고 `IN_TRANSIT` 상태로 진입시킴.
7. 선적 화물이 미국 창고에 도착(`ARRIVED`)하면 관리자 입고 검수(`receivings`)로 인계되며, 검수 결과(정상 입고 수량, 파손 `damaged_qty`, 보류 `hold_qty`)가 기록됨.

### 7.2 INFERENCE (업무 흐름상 논리적 추론이나 시스템 명시가 필요한 항목)
1. **포워더 지정 알림**: `LETUSTO_ARRANGED` 제출 후 본사가 포워더를 배정했을 때 이메일/알림톡으로 담당자 연락처가 통보되는 것으로 예상되나, 포털 UI 내에는 별도 포워더 배정 Push 알림 UI가 존재하지 않고 Admin이 기재한 필드로 표시됨.
2. **출고지 자동완성**: 회사 관리의 `company_shipping_origins`에 등록된 기본 출고지가 향후 출고 준비 작성 시 자동 채워질 수 있으나, 현재 구현에서는 사용자가 직접 텍스트를 입력하거나 확인하도록 되어 있음.

### 7.3 DECISION REQUIRED (정책 확정 필요 사항)
1. **출고 분할 횟수 제한**: 동일 PO에 대해 여러 차례 분할 출고(Partial Readiness) 등록이 시스템상 가용 수량 내에서 무제한 가능함. 표준 운영 가이드상 최대 분할 횟수 권고 여부.
2. **문서 필수 첨부 여부**: 현재 코드는 P/L 및 C/I 없이도 `READY_SUBMITTED` 저장이 기술적으로 허용되나, 실제 운영 정책상 필수 제출 서류로 안내할 것인지 권장으로 안내할 것인지의 정책 일치.

### 7.4 SYSTEM GAP (향후 기능 개선 과제)
1. **실시간 화물 API 연동**: 현재 Carrier 및 Tracking Number는 수동 텍스트로 관리되며, 메이저 특송사(FedEx/DHL) API와의 실시간 위치 Webhook 연동은 추후 로드맵에 해당함.
2. **라벨 자동 출력**: 창고 입고용 카톤 바코드 라벨(UCC-128 / Shipping Marks) 자동 PDF 출력 기능은 추후 확장 예정.

---

## 8. Recommended Manual Table of Contents (TOC)

추후 제작될 `MAN-B-LOG-001` 공식 매뉴얼의 권장 목차 구조:

- **Chapter 1. 선적 및 국제 물류 개요 (Overview & Logistics Philosophy)**
  - 1.1 K SELECT 물류 파이프라인 및 도메인 범위 (ORD ↔ LOG ↔ 창고 입고 ↔ FIN)
  - 1.2 운송 책임 분기 이해: LETUSTO 지정 운송 vs 공급사 자체 운송
- **Chapter 2. 선적 & 출고 관리 허브 둘러보기 (Shipping Hub UI)**
  - 2.1 출고 준비 내역 (Goods Readiness Tab) 및 상태 인디케이터
  - 2.2 선적 추적 내역 (Shipments Tab) 및 물류 진행 정보
- **Chapter 3. 출고 준비 완료 등록 (Goods Readiness Submission)**
  - 3.1 발주서(PO) 선택 및 기본 정보 입력 (예정일, 출고지, 연락처)
  - 3.2 품목별 수량 배정 및 카고 스펙 실측 (박스수, 중량, CBM 산출법)
  - 3.3 필수 서류 첨부: 패킹 리스트(P/L) & 상업 송장(C/I) 업로드 가이드
  - 3.4 임시 저장(Draft) 및 출고 완료 제출(Submit)
- **Chapter 4. 운송 책임별 출고 및 선적 이행 (Fulfillment Execution)**
  - 4.1 [Track 1] LETUSTO 지정 운송: 포워더 픽업 조율 및 물품 인계(Handover) 완료
  - 4.2 [Track 2] 공급사 자체 운송: 특송/포워더 배송 등록 (Carrier, Tracking/BL, ETD/ETA)
- **Chapter 5. 선적 추적 및 미국 창고 입고 인계 (Inbound Tracking & Receiving Handoff)**
  - 5.1 선적 진행 상태 모니터링 (In Transit $\rightarrow$ Arrived $\rightarrow$ Received)
  - 5.2 미국 창고 입고 검수(Receiving) 및 파손/수량 불일치(Discrepancy) 처리 원칙
- **Chapter 6. 권한 관리 및 문제 해결 FAQ (ACL & Troubleshooting)**
  - 6.1 관리자(Admin/Operator) vs 조회자(Viewer) 권한 비교
  - 6.2 수량 초과 경고 및 서류 수정 관련 자주 묻는 질문
