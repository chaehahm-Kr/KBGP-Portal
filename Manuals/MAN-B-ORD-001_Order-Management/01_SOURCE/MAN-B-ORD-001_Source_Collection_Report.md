# MAN-B-ORD-001 — Source Collection Report
## K SELECT Brand Portal: Purchase Orders & Order Management (발주 요청 & 오더 관리)

---

## 1. Executive Summary

본 보고서는 **K SELECT Brand Portal** 및 **K SELECT Admin**의 발주 및 주문 관리(Purchase Orders & Order Management) 영역 전체를 대상으로 수행된 프로덕션 코드, UI 컴포넌트, 서버 액션, API 라우트, 데이터베이스 스키마, 상태 머신 및 권한 감사의 최종 검증 결과물이다.

본 감사를 통해 확정된 핵심 도메인 아키텍처는 다음과 같다:

1. **이원화된 발주 프로세스 (Dual-Track Purchasing Architecture)**:
   - **Track A: Brand PO Request (공급사 발주 요청)**: 공급사(Brand)가 공급 희망 품목, 수량, 희망 출고일을 본사에 제안하는 요청 시스템 (`po_requests`). 본사 심사 후 공식 발주서로 전환(`CONVERTED_TO_PO`).
   - **Track B: Admin Direct PO (관리자 직접 발주)**: K SELECT 본사 MD가 수요 예측 및 리테일러 공급 계획에 따라 시스템에서 직접 생성하여 공급사에 발행하는 공식 발주서 (`purchase_orders`, `SENT`).
   - 두 트랙 모두 최종적으로 동일한 **공식 발주서 (Official Purchase Order, `purchase_orders`)** 엔티티로 수렴하여 동일한 물류·정산 규칙을 따름.
2. **독립 경계 원칙 (Retail Application Approval ≠ Automatic Purchase Order Creation)**:
   - Retail Application(`MAN-B-RET-001`) 승인은 파트너 등록 및 제품 판매 자격을 부여하는 절차이며, 발주서(PO)를 자동 발행하지 않음 (`VERIFIED SYSTEM BEHAVIOR`).
   - 발주는 Track A(PO Request 승인 전환) 또는 Track B(Admin 직접 발행)를 통해서만 독립적으로 시작됨.
3. **6단계 통합 상태 엔진 (Unified 6-Step Stepper Engine)**:
   - Step 1 `PO Sent / Received (발주 발송/접수)` ➔ Step 2 `Supplier Confirmed (공급사 수락/확인)` ➔ Step 3 `Ready to Ship (선적/출고 준비)` ➔ Step 4 `Shipped (선적/출고 완료)` ➔ Step 5 `Receiving / Inspection (입고/검수)` ➔ Step 6 `Completed (입고 종결)`.
4. **물류 책임 분기 (Shipping Responsibility Mode)**:
   - `LETUSTO_ARRANGED` (본사/포워더 지정 운송): 공급사는 Goods Readiness(실측 카톤, 중량, CBM, P/L, C/I) 등록 및 포워더 화물 인계 보고(Submit Handover)를 수행.
   - `SUPPLIER_ARRANGED` (공급사 자체 운송): 공급사가 운송사를 섭외하여 선적 정보(선사, B/L, AWB, 추적번호, ETD, ETA)를 직접 등록.
5. **정산/인보이스 연계 (Finance Handoff)**:
   - `po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'` 조건 충족 시 Supplier Invoice 생성 대상(Eligible)으로 등록됨 (`VERIFIED SYSTEM BEHAVIOR`). 실제 결제 및 정산 집행은 `MAN-B-FIN-001`로 격리.
6. **Inquiry 및 MOQ 프로덕션 동작 확인**:
   - PO 반려/수정 요청 시 Inquiry 티켓은 자동 생성되지 않음 (`SYSTEM GAP / NOT IMPLEMENTED` — 별도 1:1 고객지원 채널로만 안내).
   - MOQ 미만 입력은 저장/제출을 차단하지 않는 경고(`Recommended / Warning`)로 동작함 (`VERIFIED SYSTEM BEHAVIOR`).

---

## 2. Production Routes & URL Inventory

### 2.1 Brand Portal Routes (`portal.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/portal/orders` | `orders:read` | `app/portal/orders/page.tsx` | `/portal/orders/purchase-orders`로 자동 리다이렉트 |
| `/portal/orders/purchase-orders` | `orders:read` | `app/portal/orders/purchase-orders/page.tsx` | 공식 발주서 목록 조회, 상태 필터링, 검색, 요약 지표 |
| `/portal/orders/purchase-orders/[id]` | `orders:read` | `app/portal/orders/purchase-orders/[id]/page.tsx` | 발주서 상세(Overview/Shipments/Receiving/Documents/Communication) |
| `/portal/orders/requests` | `orders:read` | `app/portal/orders/requests/page.tsx` | 브랜드사 발주 요청 목록 조회, 상태별 필터링, 신규 작성 진입 |
| `/portal/orders/requests/new` | `orders:write` | `app/portal/orders/requests/new/page.tsx` | 신규 발주 요청서 작성 (출고지, 담당자, 품목, 수량, 첨부파일) |
| `/portal/orders/requests/[id]` | `orders:read` | `app/portal/orders/requests/[id]/page.tsx` | 발주 요청서 상세, 심사 상태 스테퍼, 공식 PO 전환 링크, 취소 |
| `/portal/orders/requests/[id]/edit` | `orders:write` | `app/portal/orders/requests/[id]/edit/page.tsx` | 발주 요청서 수정 (`DRAFT`, `CHANGE_REQUESTED` 상태만 가능) |
| `/portal/orders/shipping` | `orders:read` | `app/portal/orders/shipping/page.tsx` | 선적 & 출고 관리 허브 (Goods Ready 목록, 선적 추적 내역) |
| `/portal/orders/shipping/[id]` | `orders:read` | `app/portal/orders/shipping/[id]/page.tsx` | 단일 선적(Shipment) 상세 추적 내역 및 품목별 선적 수량 조회 |

### 2.2 Admin Portal Routes (`admin.kselectnetwork.com`)
| Route | Access Guard | Page Component | Functional Scope |
| :--- | :--- | :--- | :--- |
| `/admin/purchasing` | `staff_roles` | `app/admin/purchasing/page.tsx` | `/admin/purchasing/dashboard`로 자동 리다이렉트 |
| `/admin/purchasing/dashboard` | `staff_roles` | `app/admin/purchasing/dashboard/page.tsx` | 발주 종합 대시보드 (총 발주액, 진행 단계별 현황, 미처리 알림) |
| `/admin/purchasing/orders` | `staff_roles` | `app/admin/purchasing/orders/page.tsx` | 관리자 공식 발주서 관리 목록, 공급사/창고/상태 필터링 |
| `/admin/purchasing/new` | `admin:write` | `app/admin/purchasing/new/page.tsx` | 관리자 직발행 공식 발주서 생성 (Supplier 선택, 품목/단가 입력) |
| `/admin/purchasing/[id]` | `staff_roles` | `app/admin/purchasing/[id]/page.tsx` | 공식 발주서 상세 (승인/전송/선적등록/입고검수/종결/취소요청) |
| `/admin/purchasing/[id]/edit` | `admin:write` | `app/admin/purchasing/[id]/edit/page.tsx` | 발주서 초안 수정 (`DRAFT` 상태에 한함) |
| `/admin/purchasing/requests` | `staff_roles` | `app/admin/purchasing/requests/page.tsx` | 브랜드사 PO Request 심사 목록 (대기/검토중/수정요청/전환완료) |
| `/admin/purchasing/requests/[id]` | `staff_roles` | `app/admin/purchasing/requests/[id]/page.tsx` | PO Request 심사 상세, 수량/단가 조정, 공식 PO 변환 실행 |
| `/admin/purchasing/shipments` | `staff_roles` | `app/admin/purchasing/shipments/page.tsx` | 인바운드 선적 관리 (ETD/ETA, 선적 서류, 컨테이너 추적) |
| `/admin/purchasing/receiving` | `staff_roles` | `app/admin/purchasing/receiving/page.tsx` | 창고 입고 검수 관리 (실입고/파손/홀드 수량 판정 및 확정) |
| `/admin/purchasing/landed-cost` | `staff_roles` | `app/admin/purchasing/landed-cost/page.tsx` | 부대비용 및 랜디드 코스트 배부 계산 관리 |

---

## 3. Canonical Status Dictionary

### 3.1 발주 요청 상태 (`PoRequestStatus`)
| DB/Internal Status | Portal Display Label | 영문 라벨 | 의미 및 비즈니스 정의 | 상태 전이 Trigger | 다음 가능한 상태 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | 작성 중 | Draft | 공급사 작성 임시저장 상태 | '임시저장' 클릭 | `SUBMITTED`, `CANCELLED` |
| `SUBMITTED` | 제출 완료 | Submitted | 본사에 심사 요청 제출된 상태 | '발주 요청 제출' 클릭 | `UNDER_REVIEW`, `CANCELLED` |
| `UNDER_REVIEW` | 검토 중 | Under Review | 본사 MD가 배정되어 검토 중인 상태 | Admin MD 심사 시작 | `CHANGE_REQUESTED`, `CONVERTED_TO_PO`, `REJECTED` |
| `CHANGE_REQUESTED` | 수정 요청 | Change Requested | 본사 MD가 수량/일정 조정을 요청한 상태 | Admin 수정 요청 작성 | `SUBMITTED` (수정 후 재제출) |
| `CONVERTED_TO_PO` | PO 전환 완료 | Converted to PO | 승인되어 공식 발주서로 전환 완료된 상태 | Admin 승인 및 PO 생성 | `[*]` (공식 발주서 진행) |
| `REJECTED` | 반려 | Rejected | 요청이 최종 반려된 상태 | Admin 반려 사유 입력 | `[*]` (종결) |
| `CANCELLED` | 취소 | Cancelled | 공급사 또는 관리자에 의해 취소된 상태 | '요청 취소' 클릭 | `[*]` (종결) |

---

### 3.2 공식 발주서 헤더 상태 (`PoStatus`)
| DB/Internal Status | Portal Display Label | 영문 라벨 | 의미 및 비즈니스 정의 | 상태 전이 Trigger | 다음 가능한 상태 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | 발주서 작성중 | Draft | 본사 내부 작성 단계 | Admin 발주서 생성 | `APPROVED`, `CANCELLED` |
| `APPROVED` | 승인됨 | Approved | 본사 결재 승인 완료 상태 | Admin 내부 결재 | `SENT`, `CANCELLED` |
| `SENT` | 발주서 발송됨 | Sent | 공급사 포털에 정식 공개된 상태 | Admin 발송(Send) 실행 | `CANCELLED` (진행 완료 시 `COMPLETED`) |
| `CANCELLED` | 취소됨 | Cancelled | 발주가 공식 취소된 상태 | 취소 합의 확정 | `[*]` (종결) |

---

### 3.3 공급사 발주 확인 상태 (`SupplierConfirmationStatus`)
| DB/Internal Status | Portal Display Label | 의미 및 비즈니스 정의 | 상태 전이 Trigger | 다음 가능한 상태 |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING` | 확인 대기 | 공급사 검토 및 수락 전 상태 | PO 발송 시 기본값 | `CONFIRMED`, `CHANGE_REQUESTED`, `REJECTED` |
| `CONFIRMED` | 발주 수락(확정) | 공급사가 발주 조건을 수락함 (**정산 인보이스 대상 진입**) | 공급사 '발주 수락(Confirm PO)' 클릭 | `CHANGE_REQUESTED` (예외적 조율) |
| `CHANGE_REQUESTED` | 변경 제안됨 | 공급사가 수량/납기 등의 조율을 제안한 상태 | 공급사 '변경 요청(Request Change)' 클릭 | `CONFIRMED` (조율 후 재수락), `REJECTED` |
| `REJECTED` | 공급사 거절 | 공급사가 생산/납품 불가 사유로 거절한 상태 | 공급사 거절 처리 | `[*]` (발주 취소/종결) |

---

### 3.4 발주 이행 상태 (`FulfillmentStatus`)
| DB/Internal Status | Portal Display Label | 의미 및 비즈니스 정의 | 상태 전이 Trigger | 다음 가능한 상태 |
| :--- | :--- | :--- | :--- | :--- |
| `UNFULFILLED` | 이행 대기 | 발주 확정 직후 생산 준비 전 단계 | PO 확정 시 기본값 | `IN_PRODUCTION`, `READY_TO_SHIP` |
| `IN_PRODUCTION` | 생산중 | 공급사에서 생산/패킹 진행 중인 상태 | 생산 착수 업데이트 | `READY_TO_SHIP` |
| `READY_TO_SHIP` | 선적 대기 | 공급사 Goods Ready 등록 완료 상태 | Goods Ready 등록 제출 | `IN_TRANSIT`, `SHIPPED` |
| `IN_TRANSIT` / `SHIPPED` | 출고/선적 완료 | 포워더 화물 인계 또는 선적 완료 상태 | 화물 인계 보고 또는 선적 등록 | `DELIVERED`, `ARRIVED`, `RECEIVING` |
| `DELIVERED` / `ARRIVED` | 창고 도착 | 미국 물류센터 화물 도착 상태 | 창고 도착 확인 | `RECEIVING` |
| `PARTIALLY_RECEIVED` | 부분 입고 | 일부 수량 입고 검수 진행 중 | 1차 입고 검수 | `RECEIVED`, `COMPLETED` |
| `RECEIVED` / `COMPLETED` | 입고 종결 | 미국 물류센터 검수 완료 및 재고 반영 | 물류센터 최종 검수 확정 | `[*]` (종결) |

---

### 3.5 6단계 프로그레스 스테퍼 매핑 (`PO_6_STEPS`)
| Step # | Stepper Key | Stepper UI Label (한글 / 영문) | 시스템 산출 기준 (`getOverallStatus`) |
| :---: | :--- | :--- | :--- |
| **Step 1** | `PO_SENT` | 발주 발송 / 접수 (`PO Sent / Received`) | `po_status === 'SENT'` AND `supplier_confirmation_status === 'PENDING'` |
| **Step 2** | `SUPPLIER_CONFIRMED` | 공급사 수락 / 확인 (`Supplier Confirmed`) | `supplier_confirmation_status === 'CONFIRMED'` OR `fulfillment_status === 'IN_PRODUCTION'` |
| **Step 3** | `READY_TO_SHIP` | 선적 / 출고 준비 (`Ready to Ship`) | `fulfillment_status === 'READY_TO_SHIP'` OR `goods_readiness` 등록 완료 (`ready_qty > 0`) |
| **Step 4** | `SHIPPED` | 선적 / 출고 완료 (`Shipped`) | `fulfillment_status IN ('SHIPPED', 'IN_TRANSIT')` OR `inbound_shipments` 생성 (`shipped_qty > 0`) |
| **Step 5** | `RECEIVING` | 입고 / 검수 (`Receiving / Inspection`) | `receivings` 생성 (Draft/Finalized) OR `fulfillment_status IN ('PARTIALLY_RECEIVED', 'RECEIVED')` |
| **Step 6** | `COMPLETED` | 입고 종결 (`Completed`) | `fulfillment_status === 'COMPLETED'` (Admin Complete PO 액션 확정) |

---

## 4. User Action Matrix (권한 및 주체별 액션 매트릭스)

| Action / Operation | Brand Portal (`orders:read`) | Brand Portal (`orders:write`) | Admin MD / Staff | System (Automatic) |
| :--- | :---: | :---: | :---: | :---: |
| **발주 요청서(PO Request) 목록/상세 조회** | ✅ (자사 한정) | ✅ (자사 한정) | ✅ (전사) | - |
| **신규 발주 요청서 작성 & 임시저장** | ❌ | ✅ | ❌ | - |
| **발주 요청서 제출 (Submit)** | ❌ | ✅ | ❌ | - |
| **발주 요청서 수정 (Draft / Change Requested)** | ❌ | ✅ | ❌ | - |
| **발주 요청서 취소 (Cancel)** | ❌ | ✅ (Draft만) | ✅ | - |
| **발주 요청서 심사 (Under Review)** | ❌ | ❌ | ✅ | - |
| **발주 요청서 수정 요청 (Change Request)** | ❌ | ❌ | ✅ | - |
| **발주 요청서 승인 및 공식 PO 변환** | ❌ | ❌ | ✅ | ✅ (PO 레코드 생성) |
| **공식 발주서(Purchase Order) 직접 발행 (Track B)** | ❌ | ❌ | ✅ | - |
| **공식 발주서 목록/상세 조회** | ✅ (자사 한정) | ✅ (자사 한정) | ✅ (전사) | - |
| **공식 발주서 수락 (Confirm PO)** | ❌ | ✅ | ❌ | ✅ (Invoice 대상 등록) |
| **공식 발주서 조건 변경 요청 (Request Change)** | ❌ | ✅ | ❌ | - |
| **공식 발주서 취소 응답 (동의/거절)** | ❌ | ✅ | ❌ | - |
| **출고 준비 등록 (Goods Ready)** | ❌ | ✅ | ✅ | - |
| **포워더 화물 인계 보고 (Submit Handover)** | ❌ | ✅ | ✅ | - |
| **공급사 직접 선적 정보 등록 (Supplier Arranged)** | ❌ | ✅ | ✅ | - |
| **미국 물류센터 실물 입고 검수 등록/확정** | ❌ | ❌ | ✅ (현지 검수팀) | - |
| **발주서 최종 종결 (Complete PO)** | ❌ | ❌ | ✅ | - |
| **정산 인보이스(Supplier Invoice) 생성** | ❌ | ✅ (PO Confirmed 시) | ❌ | - |

---

## 5. Shipping Responsibility In-Depth Breakdown

### 5.1 Option A: `LETUSTO_ARRANGED` (본사/포워더 지정 운송)
- **비즈니스 조건**: FOB, EXW 등 본사가 국제 운송을 총괄하는 인코텀즈 계약.
- **공급사 입력 필드**:
  - 품목별 실제 출고 준비 수량 (`ready_qty`, 필수)
  - 총 포장 카톤 수 (`cartons`, 필수)
  - 총 중량 (`gross_weight`, kg, 필수)
  - 총 부피 (`cbm`, ㎥, 필수)
  - 패킹리스트 파일 (`packing_list_url`, 필수)
  - 상업송장 파일 (`commercial_invoice_url`, 필수)
- **공급사 후속 액션**: 본사 지정 포워더 픽업 상차 후 `포워더 화물 인계 보고 (Submit Handover)` 버튼 클릭.
- **Admin/본사 역할**: B/L 발행, 선적 스케줄 등록, 컨테이너 추적 및 미국 내륙 운송 관리.

---

### 5.2 Option B: `SUPPLIER_ARRANGED` (공급사 자체 운송)
- **비즈니스 조건**: DDP, CIF 등 공급사가 미국 물류센터까지 운송을 책임지는 인코텀즈 계약.
- **공급사 입력 필드**:
  - 선사 / 항공사명 (`carrier_name`, 필수)
  - Master / House B/L 또는 AWB 번호 (`tracking_number`, 필수)
  - 출항일 (`etd`, YYYY-MM-DD, 필수)
  - 미국 물류센터 도착예정일 (`eta`, YYYY-MM-DD, 필수)
  - 선적 서류 첨부 (B/L, AWB PDF, 선택)
- **공급사 후속 액션**: 선적 정보 입력 완료 후 `선적 완료 등록 (Submit Shipment)` 클릭.
- **Admin/본사 역할**: 입항 및 물류센터 도착 일정 모니터링, 하역 스케줄 배정.

---

## 6. Retail Application & PO Domain Boundary

```text
[MAN-B-RET-001: 입점 신청 & 심사]
  └── 신청서 접수 ➔ 적격성 심사 ➔ 최종 승인(Approved) ➔ 공급사 계정 초대/활성화(Invitation Sent)
                                │
                                └─── (※ 발주서 자동 발행 없음: 독립 경계 확정)
                                                │
[MAN-B-ORD-001: 발주 및 오더 관리] ◄──────────┘
  ├── Track A: 공급사 발주 요청(PO Request) ➔ 심사 ➔ 승인 변환(Converted to PO) ──┐
  │                                                                                 ├─► 공식 발주서 (Official PO)
  └── Track B: 본사 직접 발주(Admin Direct PO) ➔ 발주서 발송(PO Sent) ──────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[MAN-B-LOG-001: 국제 물류 상세]               [MAN-B-FIN-001: 대금 정산 & 인보이스]
  - 컨테이너 적재, 통관, 관세                     - PO Confirmed 기준 Supplier Invoice 작성
  - 내륙 트럭킹, 화물 사고 처리                   - Net 지급 조건, 송금 승인, 정산 대사
```

---

## 7. Finance Handoff Verification

- **자격 검증 쿼리 (`lib/portal/actions.ts: getEligiblePosForInvoice`)**:
  ```typescript
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, po_number, total_amount, currency, supplier_confirmation_status")
    .eq("supplier_id", companyId)
    .in("po_status", ["APPROVED", "SENT"])
    .eq("supplier_confirmation_status", "CONFIRMED");
  ```
- **Handoff 원칙**:
  - 공급사가 발주서를 수락(`supplier_confirmation_status = 'CONFIRMED'`)한 시점에만 인보이스 생성이 가능함.
  - 인보이스 작성, 정산 주기, 지급 일정 및 세무 처리는 `MAN-B-FIN-001`에서 독립적으로 다룸.

---

## 8. Source Classification Audit

### 8.1 VERIFIED SYSTEM BEHAVIOR (프로덕션 코드/DB/UI 검증 완료)
1. **Dual-Track PO 생성 구조**: Track A (`po_requests` 승인 변환) 및 Track B (`purchase_orders` 직접 생성) 모두 실제 시스템에 구현되어 정상 작동함.
2. **Retail Application 독립성**: `Retail Application Approval` 시 발주서가 자동 생성되지 않으며, 독자적인 발주 워크플로우를 필요로 함.
3. **6단계 프로그레스 스테퍼**: `PO_6_STEPS`와 `getOverallStatus` 계산 엔진을 통해 6단계 상태가 정확히 산출됨.
4. **선적 책임 2원화**: `LETUSTO_ARRANGED` 및 `SUPPLIER_ARRANGED` 분기에 따라 폼과 액션이 다르게 렌더링됨.
5. **MOQ 동작**: 최소 주문 수량 미만 입력 시 경고(Warning)만 표시되며 저장을 차단하지 않음.
6. **Finance 자격 조건**: `supplier_confirmation_status = 'CONFIRMED'` 조건이 인보이스 생성의 필수 전제조건임.

### 8.2 INFERENCE (추론 ➔ 프로덕션 사실 정제 완료)
- 기존에 "법적·물류적 확정 발주서"로 기술되었던 표현은 법률적 해석을 배제하고 시스템 데이터 엔티티인 **"공식 발주서 (Official Purchase Order)"**로 정제 완료.

### 8.3 DECISION REQUIRED (정책 확인 사항)
- **리비전(Revision) 변경 시 기존 Goods Ready 유지 정책**: 발주 조건 변경으로 리비전 번호가 증가할 때 이미 등록된 Goods Ready 데이터의 무효화 여부 (현재 시스템은 기존 레코드를 보존함).

### 8.4 SYSTEM GAP / NOT IMPLEMENTED (현재 미구현 기능)
- **PO 수정/반려 시 Inquiry 티켓 자동 생성**: 현재 시스템은 반려 사유(`rejection_reason`)만 DB에 기록하며, Inquiry 티켓을 자동 발급하지 않음. (매뉴얼에는 별도 1:1 고객지원 채널로만 서술).
