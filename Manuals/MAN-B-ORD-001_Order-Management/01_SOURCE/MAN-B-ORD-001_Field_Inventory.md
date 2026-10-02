# MAN-B-ORD-001 — Field Inventory
## K SELECT Brand Portal: Purchase Orders & Order Management (화면별 필드 전수 조사)

본 인벤토리는 Brand Portal의 발주 및 주문 관리 영역에 실제 존재하는 모든 UI 화면 필드, 데이터 타입, 필수 여부, 수정 권한, 유효성 검증 규칙, DB 매핑 및 상세 설명을 기록한다.

---

### Table Format
`Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes`

---

## 1. 발주 요청 목록 (`/portal/orders/requests`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 발주 요청 목록 | 검색어 입력창 | Text | No | All Users | 실시간 필터링 (요청번호, PO번호, 제품명, SKU) | Client-side filter | 검색어 매칭 |
| 발주 요청 목록 | 상태 필터 드롭다운 | Select | No | All Users | `ALL`, `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `CHANGE_REQUESTED`, `CONVERTED_TO_PO`, `REJECTED`, `CANCELLED` | `po_requests.status` | 상태별 필터링 |
| 발주 요청 목록 | 새 발주 요청 작성 버튼 | Button / Link | No | `orders:write` | 권한 보유자에게만 노출 | `/portal/orders/requests/new` | 작성 페이지 이동 |
| 발주 요청 목록 | 요청 번호 (Request Number) | Text (Link) | - | Read Only | `REQ-YYYYMMDD-XXXX` 포맷 | `po_requests.request_number` | 상세 페이지 이동 링크 |
| 발주 요청 목록 | 요청일자 (Request Date) | Date | - | Read Only | YYYY-MM-DD (Eastern Date) | `po_requests.submitted_at` or `created_at` | 제출 일시 |
| 발주 요청 목록 | 제품 품목수 (SKU Count) | Number | - | Read Only | 0 이상의 정수 | `COUNT(po_request_lines.id)` | 요청 라인 품목 수 |
| 발주 요청 목록 | 총 요청 수량 (Total Qty) | Number | - | Read Only | 0 이상의 정수 (콤마 포맷) | `SUM(po_request_lines.requested_qty)` | 총 수량 합계 |
| 발주 요청 목록 | 예상 참고 금액 (Est. Amount) | Currency | - | Read Only | USD 소수점 2자리 | `SUM(po_request_lines.estimated_line_total)` | Reference FOB 합산 |
| 발주 요청 목록 | 희망 Ready Date | Date | - | Read Only | YYYY-MM-DD | `po_requests.requested_ready_date` | 공급사 희망 출고일 |
| 발주 요청 목록 | 진행 상태 (Status Badge) | Badge | - | Read Only | 상태별 색상 및 한글 라벨 | `po_requests.status` | 상태 배지 |
| 발주 요청 목록 | 연결된 PO 번호 (Linked PO) | Text (Link) | - | Read Only | `PO-YYYY-XXXX` 포맷 | `po_requests.converted_po_number` | 공식 PO 바로가기 링크 |

---

## 2. 신규 발주 요청서 작성 & 수정 (`/portal/orders/requests/new`, `/portal/orders/requests/[id]/edit`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 발주 요청 작성 | 출고지 선택 (Shipping Origin) | Select | **Yes** | `orders:write` | 등록된 `company_shipping_origins` 목록 | `po_requests.shipping_origin_id` | 기본 출고지 자동 선택 |
| 발주 요청 작성 | 담당자 선택 (Contact Person) | Select | **Yes** | `orders:write` | 활성 `company_users` 목록 | `po_requests.contact_user_id` | 담당자 선택 시 이름/이메일 자동 반영 |
| 발주 요청 작성 | 담당자 이름 (Contact Name) | Text | **Yes** | `orders:write` | 1자 이상 100자 이하 | `po_requests.contact_name` | 담당자 성명 |
| 발주 요청 작성 | 담당자 이메일 (Contact Email) | Email | **Yes** | `orders:write` | 유효한 이메일 형식 | `po_requests.contact_email` | 통지 수신 이메일 |
| 발주 요청 작성 | 희망 출고일 (Requested Ready Date) | Date | **Yes** | `orders:write` | 오늘 이후 날짜 (YYYY-MM-DD) | `po_requests.requested_ready_date` | 생산 완료 희망일 |
| 발주 요청 작성 | 요청 비고 (Notes) | Textarea | No | `orders:write` | 최대 2,000자 | `po_requests.notes` | 특이사항 및 전달 메모 |
| 발주 요청 작성 | 품목 검색 및 추가 버튼 | Modal Trigger | - | `orders:write` | 공급사 등록 상품 검색 | `products` | 품목 선택 모달 열기 |
| 발주 요청 작성 | 품목명 (Product Name) | Text | - | Read Only | 마스터 상품명 스냅샷 | `po_request_lines.product_name_snapshot` | 제품 표시명 |
| 발주 요청 작성 | Letusto SKU / 제조사 SKU | Text | - | Read Only | SKU 코드 스냅샷 | `po_request_lines.letusto_sku_snapshot`, `manufacture_sku_snapshot` | 식별 SKU |
| 발주 요청 작성 | 요청 수량 (Requested Qty) | Number | **Yes** | `orders:write` | 1 이상의 정수 (Carton Pack 배수 안내) | `po_request_lines.requested_qty` | 요청 수량 |
| 발주 요청 작성 | 참고 FOB 단가 (Reference FOB) | Currency | - | Read Only | FOB 기본가 또는 티어가 자동 계산 | `po_request_lines.reference_unit_cost` | 수량별 티어 가격 반영 |
| 발주 요청 작성 | 예상 품목 총액 (Estimated Total) | Currency | - | Read Only | 수량 × 참고 단가 | `po_request_lines.estimated_line_total` | 라인 합계 |
| 발주 요청 작성 | 품목별 메모 (Line Note) | Text | No | `orders:write` | 최대 500자 | `po_request_lines.line_note` | 개별 품목 특이사항 |
| 발주 요청 작성 | 임시저장 버튼 (Save Draft) | Button | No | `orders:write` | `DRAFT` 상태로 저장 | `po_requests.status = 'DRAFT'` | 수정 계속 가능 |
| 발주 요청 작성 | 제출하기 버튼 (Submit Request) | Button | No | `orders:write` | 최소 1개 라인 필요, `SUBMITTED`로 전환 | `po_requests.status = 'SUBMITTED'` | 본사 검토 착수 |

---

## 3. 발주 요청 상세 (`/portal/orders/requests/[id]`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 발주 요청 상세 | 요청 번호 & 상태 배지 | Header | - | Read Only | `REQ-YYYYMMDD-XXXX` + 상태별 색상 | `po_requests.request_number`, `status` | 헤더 타이틀 |
| 발주 요청 상세 | 4단계 진행 스테퍼 | Stepper | - | Read Only | 작성 중 ➔ 제출 완료 ➔ 검토 중 ➔ PO 전환 완료 | `po_requests.status` | 심사 진행 시각화 |
| 발주 요청 상세 | 수정 요청 사유 배너 | Alert Banner | - | Read Only | `CHANGE_REQUESTED` 상태 시 노출 | `po_requests.change_request_reason` | 본사 수정 지시 사항 |
| 발주 요청 상세 | PO 전환 완료 축하 배너 | Banner & Link | - | Read Only | `CONVERTED_TO_PO` 상태 시 노출 | `po_requests.converted_po_id`, `converted_po_number` | 정식 PO 상세 링크 제공 |
| 발주 요청 상세 | 출고지 정보 | Text Card | - | Read Only | 출고지명, 주소, 담당자, 연락처 | `company_shipping_origins` | 실물 화물 픽업지 |
| 발주 요청 상세 | 품목 테이블 | Table | - | Read Only | 품목명, SKU, 수량, 참고단가, 예상금액, 라인메모 | `po_request_lines` | 요청 품목 전수 표시 |
| 발주 요청 상세 | 요청서 수정 버튼 | Button / Link | No | `orders:write` | `DRAFT` 또는 `CHANGE_REQUESTED` 시만 노출 | `/portal/orders/requests/[id]/edit` | 수정 화면 이동 |
| 발주 요청 상세 | 요청 취소 버튼 | Button | No | `orders:write` | `CONVERTED_TO_PO`, `CANCELLED` 제외 노출 | `po_requests.status = 'CANCELLED'` | 공급사 자체 취소 |

---

## 4. 공식 발주서 목록 (`/portal/orders/purchase-orders`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 공식 발주서 목록 | 통합 검색창 | Text | No | All Users | 발주번호, 품목명, SKU 실시간 검색 | Client-side filter | 검색 바 |
| 공식 발주서 목록 | 6단계 진행 상태 필터 | Select | No | All Users | 전체, PO Sent, Supplier Confirmed, Ready to Ship, Shipped, Receiving, Completed, Cancelled | `purchase_orders.po_status` & `status-helper` | 통합 상태 필터링 |
| 공식 발주서 목록 | 발주 번호 (PO Number) | Text (Link) | - | Read Only | `PO-YYYY-XXXX` 포맷 | `purchase_orders.po_number` | 상세 페이지 링크 |
| 공식 발주서 목록 | 발주일자 (Order Date) | Date | - | Read Only | YYYY-MM-DD | `purchase_orders.order_date` | 공식 발주 체결일 |
| 공식 발주서 목록 | 품목수 (Line Count) | Number | - | Read Only | 1 이상의 정수 | `COUNT(purchase_order_lines.id)` | 품목 가짓수 |
| 공식 발주서 목록 | 총 발주 수량 (Total PO Qty) | Number | - | Read Only | 정수 콤마 포맷 | `SUM(purchase_order_lines.qty)` | 발주 총 수량 |
| 공식 발주서 목록 | 총 발주 금액 (Total Amount) | Currency | - | Read Only | 통화 기호 + 소수점 2자리 | `SUM(qty * unit_cost)` | 발주 총액 |
| 공식 발주서 목록 | 희망 납기일 (Expected Ready Date) | Date | - | Read Only | YYYY-MM-DD | `purchase_orders.expected_ready_date` | 납기 요구일 |
| 공식 발주서 목록 | 도착 창고 (Destination Warehouse) | Text | - | Read Only | 창고명 및 창고 코드 | `warehouses.name` | 미국 입고 목적지 |
| 공식 발주서 목록 | 통합 진행 상태 (Overall Status) | Badge | - | Read Only | 6단계 상태 및 색상 | `getOverallStatus()` | 통합 상태 배지 |

---

## 5. 공식 발주서 상세 — 기본 정보 탭 (`/portal/orders/purchase-orders/[id]?tab=overview`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| PO 상세 (Overview) | 6단계 통합 프로그레스 바 | Stepper | - | Read Only | 1. PO Sent ➔ 2. Confirmed ➔ 3. Ready ➔ 4. Shipped ➔ 5. Receiving ➔ 6. Completed | `getOverallStatus()` | 실시간 동기화 스테퍼 |
| PO 상세 (Overview) | 발주 수락 버튼 (Confirm PO) | Button | No | `orders:write` | `supplier_confirmation_status === 'PENDING'` 시 활성화 | `purchase_orders.supplier_confirmation_status = 'CONFIRMED'` | 공급사 발주 체결 수락 |
| PO 상세 (Overview) | 변경 요청 버튼 (Request Change) | Button | No | `orders:write` | 수락 전 또는 조율 필요 시 1:1 케이스 모달 오픈 | `partner_inquiries` (category: `po_change`) | 1:1 조율 케이스 연동 |
| PO 상세 (Overview) | 인코텀즈 (Incoterms) | Text Badge | - | Read Only | FOB, EXW, FCA, CIF, CFR, DDP, DAP | `purchase_orders.incoterms` | 거래 무역 조건 |
| PO 상세 (Overview) | 결제 조건 (Payment Terms) | Text Badge | - | Read Only | Net 30, Net 60, Advance, etc. | `purchase_orders.payment_terms` | 대금 결제 조건 |
| PO 상세 (Overview) | 선적 책임 (Shipping Responsibility) | Text Badge | - | Read Only | `LETUSTO_ARRANGED` / `SUPPLIER_ARRANGED` | `purchase_orders.shipping_responsibility` | 운송 주체 구분 |
| PO 상세 (Overview) | 선적항 / 선적지 (Port of Loading) | Text | - | Read Only | 항구명 또는 공항명 | `purchase_orders.port_of_loading` | 출발지 항구 |
| PO 상세 (Overview) | 출고 예정일 / 납기일 | Date | - | Read Only | YYYY-MM-DD | `purchase_orders.expected_ready_date` | 공장 출고 목표일 |
| PO 상세 (Overview) | 예상 출항일 (Expected Ship Date) | Date | - | Read Only | YYYY-MM-DD | `purchase_orders.expected_ship_date` | 선박/항공 출항일 |
| PO 상세 (Overview) | 예상 도착일 (ETA) | Date | - | Read Only | YYYY-MM-DD | `purchase_orders.eta` | 미국 창고 도착일 |
| PO 상세 (Overview) | 공급사 전달 메모 (Supplier Note) | Text | - | Read Only | 본사 작성 메모 | `purchase_orders.supplier_facing_note` | 발주 관련 지시사항 |
| PO 상세 (Overview) | 품목 라인 테이블 | Table | - | Read Only | 제품명, SKU, 발주수량, 확정수량, 단가, 총액, 출고준비수량, 선적수량, 입고수량, 차이 | `purchase_order_lines` | 수량 흐름 종합 대조 |

---

## 6. 공식 발주서 상세 — 선적 및 출고 탭 & Goods Ready 모달 (`/portal/orders/purchase-orders/[id]?tab=shipments`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 선적 & 출고 관리 | 출고 준비 등록 버튼 (Goods Ready) | Modal Trigger | No | `orders:write` | 발주 수락 완료(`CONFIRMED`) 건에 한함 | `goods_readiness` | 출고 정보 등록 모달 오픈 |
| Goods Ready 모달 | 출고 준비 완료일 (Goods Ready Date) | Date | **Yes** | `orders:write` | YYYY-MM-DD | `goods_readiness.goods_ready_date` | 픽업 가능 일자 |
| Goods Ready 모달 | 품목별 준비 수량 (Ready Qty) | Number | **Yes** | `orders:write` | 0 이상의 정수 (발주 확정 수량 기준) | `goods_readiness_lines.ready_qty` | 실제 생산 완료 수량 |
| Goods Ready 모달 | 총 카톤 수 (Cartons) | Number | **Yes** | `orders:write` | 1 이상의 정수 | `goods_readiness_lines.cartons` | 패킹 박스 총 수량 |
| Goods Ready 모달 | 총 중량 (Gross Weight kg) | Number | **Yes** | `orders:write` | 0보다 큰 실수 (소수점 2자리) | `goods_readiness_lines.gross_weight` | 총 화물 무게 |
| Goods Ready 모달 | 총 부피 (CBM) | Number | **Yes** | `orders:write` | 0보다 큰 실수 (소수점 3자리) | `goods_readiness_lines.cbm` | 총 입방미터 |
| Goods Ready 모달 | 패킹리스트 첨부 (Packing List) | File Upload | **Yes** | `orders:write` | PDF, Excel, 이미지 (최대 15MB) | `goods_readiness.packing_list_path` | 필수 패킹 서류 |
| Goods Ready 모달 | 상업송장 첨부 (Commercial Invoice) | File Upload | **Yes** | `orders:write` | PDF, Excel, 이미지 (최대 15MB) | `goods_readiness.commercial_invoice_path` | 필수 통관 서류 |
| 선적 & 출고 관리 | 화물 인계 보고 버튼 (Handover) | Button | No | `orders:write` | `LETUSTO_ARRANGED` 모드에서 포워더 인계 시 | `goods_readiness.handover_status = 'HANDED_OVER'` | 포워더 인계 완료 처리 |
| 선적 & 출고 관리 | 공급사 직접 선적 정보 등록 | Form | No | `orders:write` | `SUPPLIER_ARRANGED` 모드에서 공급사 직접 운송 시 | `inbound_shipments` | B/L, Carrier, ETD/ETA 등록 |

---

## 7. 공식 발주서 상세 — 입고 검수 탭 (`/portal/orders/purchase-orders/[id]?tab=receiving`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 입고 내역 | 입고 번호 (Receiving Number) | Text | - | Read Only | `RCV-YYYY-XXXX` | `receivings.receiving_number` | 창고 검수 번호 |
| 입고 내역 | 입고 검수 일자 (Received Date) | Date | - | Read Only | YYYY-MM-DD | `receivings.received_date` | 실물 입고 검수일 |
| 입고 내역 | 검수 창고 (Warehouse) | Text | - | Read Only | 창고명 및 위치 | `warehouses.name` | 검수 창고 |
| 입고 내역 | 정상 입고 수량 (Accepted Qty) | Number | - | Read Only | 0 이상의 정수 | `receiving_lines.received_qty - damaged - hold` | 양품 재고 반영 수량 |
| 입고 내역 | 파손 수량 (Damaged Qty) | Number | - | Read Only | 0 이상의 정수 | `receiving_lines.damaged_qty` | 파손 판정 수량 |
| 입고 내역 | 홀드 수량 (Hold Qty) | Number | - | Read Only | 0 이상의 정수 | `receiving_lines.hold_qty` | 라벨/규격 이상 보류 수량 |
| 입고 내역 | 검수 결과 상태 (Status) | Badge | - | Read Only | DRAFT(검수중), FINALIZED(확정) | `receivings.status` | 입고 검수 확정 상태 |
| 입고 내역 | 창고 검수 메모 (Inspection Notes) | Text | - | Read Only | 창고 관리자 실물 소견 | `receivings.inspection_notes` | 실물 검수 특이사항 |

---

## 8. 공식 발주서 상세 — 문서 보관함 탭 (`/portal/orders/purchase-orders/[id]?tab=documents`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 문서 보관함 | 문서 유형 선택 (Document Type) | Select | **Yes** | `orders:write` | Packing List, Commercial Invoice, B/L, AWB, Inspection Report, Customs Clearance, Certificate of Origin, Other | `po_documents.document_type` | 서류 카테고리 |
| 문서 보관함 | 파일 선택 (File Upload) | File | **Yes** | `orders:write` | PDF, PNG, JPG, XLSX (최대 20MB) | `po_documents.storage_path` | 서류 원본 파일 |
| 문서 보관함 | 문서 메모 (Document Note) | Text | No | `orders:write` | 최대 200자 | `po_documents.notes` | 서류 설명 |
| 문서 보관함 | 다운로드 버튼 (Download) | Button / Link | - | All Users | 서명된 임시 보안 다운로드 URL 발급 | Supabase Storage Signed URL | 안전한 파일 열람 |

---

## 9. 공식 발주서 상세 — 소통 및 변경 이력 탭 (`/portal/orders/purchase-orders/[id]?tab=communication`)

| Screen | Field | Type | Required | Editable By | Validation | DB Mapping | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 소통 및 변경 이력 | 케이스 번호 (Case Number) | Text (Link) | - | Read Only | `CAS-XXXXXX` | `partner_inquiries.case_number` | 1:1 문의 케이스 링크 |
| 소통 및 변경 이력 | 케이스 제목 (Case Title) | Text | - | Read Only | 예: "[PO 변경 요청] PO-2026-0001 수량 조율" | `partner_inquiries.title` | 조율 안건 제목 |
| 소통 및 변경 이력 | 케이스 상태 (Case Status) | Badge | - | Read Only | OPEN, IN_PROGRESS, RESOLVED, CLOSED | `partner_inquiries.status` | 처리 상태 |
| 소통 및 변경 이력 | 변경 리비전 이력 (Revision History) | Timeline | - | Read Only | Rev.0 ➔ Rev.1 등 변경 일시, 변경자, 변경 사유 | `purchase_orders.revisions` | 변경 추적 타임라인 |
