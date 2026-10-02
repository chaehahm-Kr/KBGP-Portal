# MAN-B-LOG-001: Field Inventory & Data Dictionary
## Brand Portal Shipping & Logistics (선적 & 출고 관리)

- **Manual ID:** `MAN-B-LOG-001`
- **Topic:** `Shipping & Logistics (출고, 선적 및 국제 물류 관리)`
- **Audience:** `B — Brand Portal`
- **Phase:** `01_SOURCE — Field Inventory`
- **Authoritative Date:** 2026-10-01

---

## 1. Shipping Hub Main Screen (`/portal/orders/shipping`)

### 1.1 Header & Tab Navigation
| UI 요소명 | 컨트롤 유형 | 표기 텍스트 / 옵션 | 설명 및 유효성 검증 규칙 |
| :--- | :--- | :--- | :--- |
| **페이지 헤더** | Title Text | `선적 & 출고 관리 (Shipping & Goods Ready)` | 모듈 메인 타이틀 |
| **페이지 서브설명** | Subtitle Text | `출고 준비 수량 및 카고 규격을 등록하고, 운송 일정에 따라 물품 인계 상태를 관리합니다.` | 기능 요약 설명 |
| **탭 1** | Tab Button | `출고 준비 등록 내역 (Goods Readiness)` | 출고 준비 완료 내역 및 인계 상태 리스트 탭 |
| **탭 2** | Tab Button | `선적 추적 내역 (Shipments)` | 생성된 국제 선적(Inbound Shipments) 추적 탭 |
| **새 출고 준비 버튼** | Primary Button | `+ 새 출고 준비 등록 (New Goods Ready)` | `orders:write` 권한 보유 시 표시. 클릭 시 등록 폼 토글 |

---

### 1.2 Goods Readiness List Table (`activeTab === 'readiness'`)
| 컬럼 헤더 | 데이터 타입 | 매핑 DB 필드 | UI 렌더링 및 뱃지 스타일 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| **PO Number** | String (Monospace) | `purchase_orders.po_number` | Black bold monospace text | 연계된 발주서 고유 번호 |
| **준비 예정일** | Date (`YYYY-MM-DD`) | `goods_readiness.goods_ready_date` | Text | 출고 준비 완료 예정 일자 |
| **운송 책임** | Enum Text | `purchase_orders.shipping_responsibility` | - `SUPPLIER_ARRANGED`: "공급사 배송"<br>- `LETUSTO_ARRANGED`: "Letusto 배송" | 운송 주관 주체 구분 |
| **인계 상태** | Badge Enum | `goods_readiness.handover_status` | - `DRAFT`: Gray badge `임시저장 (Draft)`<br>- `READY_SUBMITTED`: Blue badge `출고준비 완료`<br>- `HANDOVER_PENDING`: Amber badge `인계 대기`<br>- `HANDED_OVER`: Emerald badge `물품 인계 완료` | 물리적 화물 인계 라이프사이클 상태 |
| **수량 경고** | Indicator Text | `overageReviewRequired` | - Over limit: `⚠️ 초과 선적 경고` (Rose bold)<br>- Normal: `-` | 발주량 초과 여부 인디케이터 |
| **상세 보기** | Link Button | N/A | `상세 정보 →` (Indigo link) | `/portal/orders/shipping/[id]` 상세 화면으로 이동 |

---

### 1.3 Shipments List Table (`activeTab === 'shipments'`)
| 컬럼 헤더 | 데이터 타입 | 매핑 DB 필드 | UI 렌더링 및 뱃지 스타일 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| **Shipment Number**| String (Monospace) | `inbound_shipments.shipment_number` | Black bold monospace text | 국제 선적 고유 추적 번호 (예: `SHP-2026-0001`) |
| **운송 주체** | Enum Text | `inbound_shipments.shipping_responsibility` | - `SUPPLIER_ARRANGED`: "공급사 배송"<br>- `LETUSTO_ARRANGED`: "Letusto 배송" | 운송 관리 주체 |
| **배송사** | String | `inbound_shipments.carrier` | Monospace text (미입력 시 `-`) | 특송사 또는 해운/항공 운송사명 |
| **ETD** | Date (`YYYY-MM-DD`) | `inbound_shipments.etd` | Monospace text (미입력 시 `-`) | 출발 예정일 (Estimated Time of Departure) |
| **ETA** | Date (`YYYY-MM-DD`) | `inbound_shipments.eta` | Monospace text (미입력 시 `-`) | 도착 예정일 (Estimated Time of Arrival) |
| **선적 상태** | Badge Enum | `inbound_shipments.status` | Gray rounded badge (`CREATED`, `IN_TRANSIT`, `ARRIVED`, `RECEIVED`, `COMPLETED`, etc.) | 국제 선적 진행 상태 |

---

## 2. Goods Readiness Creation Form (`isCreating === true`)

### 2.1 Header & Basic Logistics Information
| 필드 라벨 | HTML 입력 타입 | DB 매핑 필드 | 필수 여부 | 유효성 검증 규칙 및 조건 |
| :--- | :--- | :--- | :---: | :--- |
| **대상 발주서 선택 (PO)** | `<select>` Dropdown | `goods_readiness.purchase_order_id` | **필수 (Required)** | - Eligibility: `po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'`<br>- 미선택 시 저장 불가 에러 발생 |
| **출고 준비 완료 예정일** | `<input type="date">` | `goods_readiness.goods_ready_date` | **필수 (Required)** | - 유효한 날짜 선택 필수<br>- 미입력 시 "출고 준비 완료 예정일을 입력해 주세요" 에러 |
| **FOB Port / Port of Loading**| `<input type="text">` | `goods_readiness.fob_port` | 선택 (Optional) | 예: `Busan`, `Port of LA`, `Incheon` |
| **상세 픽업 주소 / 공장 출고지**| `<input type="text">` | `goods_readiness.pickup_location` | 선택 (Optional) | 공장 또는 출고 창고의 실제 도로명/지번 주소 |
| **인계 목적지 (Handover Location)**| `<input type="text">` | `goods_readiness.handover_location` | 선택 (Optional) | 예: `Letusto PA warehouse`, `Busan Port CFS` |
| **현장 담당자 연락처** | `<input type="text">` | `goods_readiness.contact_person` | 선택 (Optional) | 현장 출고 담당자 이름 및 휴대전화/유선 번호 |
| **회사명 / 공장 주소** | `<input type="text">` | `goods_readiness.warehouse_factory_address` | 선택 (Optional) | 제조사 상호명 및 원산지 제조 공장 주소 |
| **기타 요청 및 특이사항** | `<textarea rows={3}>` | `goods_readiness.special_instructions` | 선택 (Optional) | 패킹 방식, 취급 주의사항, 상차 시간대 등 작성 |

---

### 2.2 Shipping Documents Upload Panel
| 필드 라벨 | 컨트롤 유형 | DB 매핑 필드 | 허용 확장자 | 스토리지 및 서명 보안 |
| :--- | :--- | :--- | :--- | :--- |
| **패킹 리스트 (Packing List) 첨부** | `<input type="file">` | `goods_readiness.packing_list_path`<br>`goods_readiness.packing_list_filename` | `.pdf`, `.png`, `.jpg`, `.jpeg` | Supabase Private Storage (`shipping-attachments`) 버킷에 업로드. 성공 시 녹색 체크마크 표시 |
| **상업 송장 (Commercial Invoice) 첨부** | `<input type="file">` | `goods_readiness.commercial_invoice_path`<br>`goods_readiness.commercial_invoice_filename` | `.pdf`, `.png`, `.jpg`, `.jpeg` | Supabase Private Storage (`shipping-attachments`) 버킷에 업로드. 성공 시 녹색 체크마크 표시 |

---

### 2.3 Product Line Items & Cargo Packaging Table
| 컬럼 라벨 | 입력/표시 타입 | 계산/검증 로직 | 단위 / 포맷 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| **제품명 / SKU** | Display Text | `product_name`, `letusto_sku`, `manufacture_sku` | Text | 품목 명칭 및 K SELECT / 제조사 고유 SKU |
| **확정량** | Display Number | `confirmed_qty` (또는 `qty`) | Number (천단위) | PO 계약 확정 수량 |
| **선적 완료량** | Display Number | `cumulative_shipped` | Number (천단위) | 기존에 이미 출항/선적 완료된 누적 수량 |
| **미선적 잔량** | Display Number | `remainingConfirmed = confirmedQty - cumulativeShipped` | Number (천단위) | 전체 계약 대비 아직 선적되지 않은 잔여 수량 |
| **준비 가용 수량** | Display Number | `availableReadiness = remainingConfirmed - activeReady` | Number (천단위) | 금번 출고 준비로 등록 가능한 최대 가용 수량 |
| **금번 준비 완료 등록 (Ready Qty)** | `<input type="number">` | - 기본값: `availableReadiness`<br>- $\ge 0$ 정수<br>- 가용 수량 초과 시 에러 차단 | Number (EA) | 이번에 실제로 출고 준비를 마친 제품 개수 |
| **박스수 (Cartons)** | `<input type="number">` | - $\ge 0$ 정수 | Number (Box/CTN) | 포장된 총 카톤(Box) 수량 |
| **중량 (Gross Weight)** | `<input type="number">` | - $\ge 0$ 실수 | Number (kg) | 카톤 및 포장재를 포함한 총 실측 중량 (kg) |
| **체적 (CBM)** | `<input type="number" step="0.001">` | - $\ge 0$ 소수점 3자리 실수 | Number ($\text{m}^3$) | 카고 총 체적 ($\text{가로}\text{m} \times \text{세로}\text{m} \times \text{높이}\text{m} \times \text{박스수}$) |

---

### 2.4 Form Actions
| 버튼 라벨 | 액션 함수 | 결과 및 상태 변경 |
| :--- | :--- | :--- |
| **뒤로가기 (Cancel)** | `setIsCreating(false)` | 입력 내용 취소 후 목록 뷰로 복귀 |
| **임시 저장 (Save Draft)** | `handleSubmitReadiness("DRAFT")` | `goods_readiness.handover_status = 'DRAFT'`로 저장. PO fulfillment 상태 유지 |
| **출고 완료 제출 (Submit)** | `handleSubmitReadiness("READY_SUBMITTED")` | `goods_readiness.handover_status = 'READY_SUBMITTED'`로 저장. PO fulfillment 상태를 `READY_TO_SHIP`으로 자동 전환하고 PO Activity Log에 `GOODS_READY_SUBMITTED` 기록 |

---

## 3. Goods Readiness Detail View (`/portal/orders/shipping/[id]`)

### 3.1 Cargo & Pickup Details Summary Card
- **인계 상태 (Handover Status)**: 현재 라이프사이클 상태 뱃지 표시 (`DRAFT`, `READY_SUBMITTED`, `HANDOVER_PENDING`, `HANDED_OVER`)
- **운송 주체 (Shipping Responsibility)**: `공급사 배송 (Supplier Arranged)` 또는 `Letusto 배송 (Letusto Arranged)`
- **출고 준비 완료일**: `goods_ready_date`
- **FOB Point / Port**: `fob_port`
- **픽업 상세 주소**: `pickup_location`
- **인계 목적지**: `handover_location`
- **출고 공장 및 제조사**: `warehouse_factory_address`
- **현장 연락처/담당자**: `contact_person`
- **요청 사항**: `special_instructions`

### 3.2 Attached Documents Card
- **Packing List**: `readiness.packingListFilename` 링크 (클릭 시 Private Storage의 Signed URL을 통해 새 탭에서 즉시 열람/다운로드)
- **Commercial Invoice**: `readiness.commercialInvoiceFilename` 링크 (클릭 시 Signed URL 다운로드)

### 3.3 Dynamic Logistics Action Panel (물류 액션 패널)
권한 및 `shipping_responsibility`에 따라 UI가 동적으로 전환됩니다:

#### Case A: Viewer Role (`canWrite === false`)
- 안내 문구 표시: `조회 전용 권한입니다 (선적 및 인계 작업 불가).`

#### Case B: `LETUSTO_ARRANGED` Track (`canWrite === true` & `handoverStatus !== 'HANDED_OVER'`)
- 안내 문구: `Letusto가 수거/운송을 주관합니다. 지정 차량이나 운송사에 물품 인계가 완료되면 아래 버튼을 눌러 상태를 변경해 주세요.`
- 액션 버튼: **`물품 인계 완료 (Handed Over)`** (Indigo button)
  - 실행 시 Confirmation 다이얼로그 노출: *"물류 담당사(또는 Letusto 지정 운송사)에 물품 인계를 완료했습니까?"*
  - 승인 시 `submitPortalHandover(readinessId)` 호출 $\rightarrow$ `goods_readiness.handover_status = 'HANDED_OVER'`

#### Case C: `SUPPLIER_ARRANGED` Track (`canWrite === true` & `handoverStatus !== 'HANDED_OVER'`)
- 안내 문구: `공급사 책임 배송입니다. 배송 정보를 입력하여 선적 등록을 진행해 주세요.`
- 입력 필드 폼:
  1. **배송사 (Carrier)**: `<input type="text">` (필수, 예: DHL, FedEx, CJ대한통운)
  2. **송장번호 (Tracking Number)**: `<input type="text">` (송장번호 또는 B/L 중 최소 1개 필수)
  3. **B/L 또는 AWB 번호**: `<input type="text">` (선하증권 또는 항공화물운송장 번호)
  4. **ETD (출발일)**: `<input type="date">`
  5. **ETA (도착예정일)**: `<input type="date">`
- 액션 버튼: **`배송 출발 및 선적 등록`** (Black button)
  - 실행 시 `submitPortalSupplierArrangedShipment(readinessId, ...)` 호출
  - 신규 `inbound_shipments` 레코드 생성 (상태 `IN_TRANSIT`), `goods_readiness.handover_status = 'HANDED_OVER'`, PO `fulfillment_status = 'SHIPPED'`로 일괄 갱신

#### Case D: Completed State (`handoverStatus === 'HANDED_OVER'`)
- 완료 배지 표시: `✓ 물류 인계 및 발송 처리가 종료된 건입니다.`
