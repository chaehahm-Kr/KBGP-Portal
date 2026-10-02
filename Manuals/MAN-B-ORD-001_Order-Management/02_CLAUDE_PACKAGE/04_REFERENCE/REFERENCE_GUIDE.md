# MAN-B-ORD-001: Technical Reference & Data Dictionary

---

## 1. System Constants & Status Enums

### A. 발주 요청 상태 (`PoRequestStatus`)
| Status Code | 한글 표기 | UI Badge Color | 설명 |
| :--- | :--- | :--- | :--- |
| `DRAFT` | 임시저장 | Zinc / 회색 | 공급사 작성 중 상태. 자유롭게 수정/삭제 가능 |
| `SUBMITTED` | 요청 제출됨 | Blue / 파란색 | 공급사가 작성을 마치고 본사에 심사를 요청한 상태 |
| `UNDER_REVIEW` | 심사중 | Amber / 주황색 | 본사 담당 MD가 배정되어 품목 및 조건을 검토 중인 상태 |
| `CHANGE_REQUESTED` | 수정 요청 | Amber / 주황색 | 본사 MD가 수량, 단가, 출고일 등에 대한 보완/수정을 요청한 상태 |
| `CONVERTED_TO_PO` | 발주서 전환 완료 | Emerald / 녹색 | 승인되어 공식 발주서(`purchase_orders`)로 전환 완료된 상태 |
| `REJECTED` | 반려됨 | Rose / 빨간색 | 요청이 부적격 판정 등으로 최종 반려된 상태 |
| `CANCELLED` | 취소됨 | Zinc / 회색 | 공급사 또는 관리자에 의해 취소된 상태 |

---

### B. 공식 발주서 상태 (`PoStatus`)
| Status Code | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `DRAFT` | 발주서 작성중 | 본사 내부 작성 단계 |
| `APPROVED` | 승인됨 | 본사 내부 결재 승인 완료 |
| `SENT` | 발주서 발송됨 | 공급사 포털에 정식 공개 및 전달된 상태 (공급사 확인 대기) |
| `CANCELLED` | 취소됨 | 발주가 공식 취소된 상태 |

---

### C. 공급사 발주 확인 상태 (`SupplierConfirmationStatus`)
| Status Code | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `PENDING` | 확인 대기 | 공급사 검토 및 수락 전 상태 |
| `CONFIRMED` | 발주 수락(확정) | 공급사가 발주 조건을 수락한 상태 (**정산 인보이스 대상 진입**) |
| `CHANGE_REQUESTED` | 조건 변경 요청 | 공급사가 수량, 납기 등의 조율을 요청한 상태 |
| `REJECTED` | 공급사 거절 | 공급사가 납품 불가 사유로 거절한 상태 |

---

### D. 발주 이행 상태 (`FulfillmentStatus`)
| Status Code | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `UNFULFILLED` | 이행 대기 | 발주 확정 직후 생산 준비 전 단계 |
| `IN_PRODUCTION` | 생산/준비중 | 공급사에서 제품 생산 및 패킹 진행 중 |
| `READY_TO_SHIP` | 출고 준비 완료 | 공급사 Goods Ready 등록 완료 상태 |
| `IN_TRANSIT` | 운송중 | 포워더 인계 완료 또는 선적 출발 상태 |
| `DELIVERED` | 창고 도착 | 미국 물류센터 실물 도착 상태 |
| `COMPLETED` | 입고/오더 완료 | 물류센터 검수 완료 및 최종 종결 |
| `CANCELLED` | 이행 취소 | 진행 중 취소된 상태 |

---

### E. 선적 책임 구분 (`ShippingResponsibility`)
- `LETUSTO_ARRANGED`: 본사(K SELECT/Letusto) 및 본사 지정 포워더가 한국 출고지에서 미국 물류센터까지의 국제 운송을 책임짐. 공급사는 Goods Ready 등록 및 화물 인계 보고를 수행.
- `SUPPLIER_ARRANGED`: 공급사가 직접 해상/항공 운송사를 섭외하여 미국 물류센터까지 선적. 공급사는 B/L, 추적번호, ETD/ETA를 직접 등록.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Operation / Feature | Portal Viewer (`orders:read`) | Portal Operator / Admin (`orders:write`) | Admin MD / Reviewer | Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| **발주 요청 목록/상세 조회** | ✅ (자사 데이터) | ✅ (자사 데이터) | ✅ (전사) | ✅ (전사) |
| **신규 발주 요청 작성 및 임시저장** | ❌ | ✅ | ❌ | ✅ |
| **발주 요청 제출 / 재제출** | ❌ | ✅ | ❌ | ✅ |
| **발주 요청 취소 / 삭제** | ❌ | ✅ (Draft만) | ❌ | ✅ |
| **발주 요청 심사 / 수정요청 / 반려** | ❌ | ❌ | ✅ | ✅ |
| **발주 요청 $\rightarrow$ PO 변환** | ❌ | ❌ | ✅ | ✅ |
| **공식 발주서 목록/상세 조회** | ✅ (자사 데이터) | ✅ (자사 데이터) | ✅ (전사) | ✅ (전사) |
| **공식 발주서 수락 (Confirm PO)** | ❌ | ✅ | ❌ | ✅ |
| **공식 발주서 변경 요청 (Request Change)**| ❌ | ✅ | ❌ | ✅ |
| **출고 준비 등록 (Goods Ready)** | ❌ | ✅ | ❌ | ✅ |
| **포워더 화물 인계 보고 (Handover)** | ❌ | ✅ | ❌ | ✅ |
| **선적 정보 등록 (Supplier Arranged)**| ❌ | ✅ | ❌ | ✅ |
| **물류센터 입고 검수 결과 등록** | ❌ | ❌ | ✅ (물류팀) | ✅ |

---

## 3. Database Entities & Schemas

### `po_requests`
- `id`: UUID (Primary Key)
- `request_number`: Text (Unique, e.g., `REQ-202610-0001`)
- `company_id`: UUID (FK $\rightarrow$ `companies.id`, NOT NULL)
- `status`: `PoRequestStatus` (Default: `DRAFT`)
- `ship_from_warehouse_id`: UUID (FK $\rightarrow$ `company_warehouses.id`)
- `contact_person_id`: UUID (FK $\rightarrow$ `company_users.id`)
- `desired_ready_date`: Date (YYYY-MM-DD)
- `notes`: Text
- `rejection_reason`: Text
- `change_request_notes`: Text
- `converted_po_id`: UUID (FK $\rightarrow$ `purchase_orders.id`, Nullable)

### `purchase_orders`
- `id`: UUID (Primary Key)
- `po_number`: Text (Unique, e.g., `PO-202610-0001`)
- `supplier_id`: UUID (FK $\rightarrow$ `companies.id`, NOT NULL)
- `order_date`: Date
- `po_status`: `PoStatus` (`DRAFT`, `APPROVED`, `SENT`, `CANCELLED`)
- `supplier_confirmation_status`: `SupplierConfirmationStatus` (`PENDING`, `CONFIRMED`, `CHANGE_REQUESTED`, `REJECTED`)
- `fulfillment_status`: `FulfillmentStatus`
- `currency`: Text (`USD`)
- `payment_terms`: Text (`NET 30`, `NET 60`, `NET 120`, etc.)
- `incoterms`: Text (`FOB`, `DDP`, `EXW`, etc.)
- `shipping_responsibility`: `ShippingResponsibility` (`LETUSTO_ARRANGED`, `SUPPLIER_ARRANGED`)
- `expected_ready_date`: Date
- `expected_ship_date`: Date
- `ship_from_warehouse_id`: UUID
- `destination_warehouse_id`: UUID

---

## 4. Cross-Manual Domain Boundaries

```text
[입점 신청 & 심사] ──(독립)──> MAN-B-RET-001 (Retail Applications)
                                     │ (파트너 승인)
                                     ▼
[발주 & 오더 관리] ─────────> MAN-B-ORD-001 (Purchase Orders)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [국제 물류 & 배송 상세]                     [대금 정산 & 인보이스]
         MAN-B-LOG-001                               MAN-B-FIN-001
```
