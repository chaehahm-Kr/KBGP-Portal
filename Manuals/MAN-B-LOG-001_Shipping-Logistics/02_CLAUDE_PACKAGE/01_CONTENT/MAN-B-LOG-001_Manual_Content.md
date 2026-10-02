# K SELECT Brand Portal 사용자 매뉴얼
## MAN-B-LOG-001: 선적 및 국제 물류 관리 가이드 (Shipping & International Logistics)

- **Manual ID:** `MAN-B-LOG-001`
- **Version:** `1.0.0`
- **대상 독자:** 브랜드사 및 공급사 물류/출고/운영 담당자 (`Audience: B — Brand Portal`)
- **발행 기관:** Letusto Inc. / K SELECT 물류운영본부
- **발행 일자:** 2026-10-01
- **적용 시스템:** K SELECT Brand Portal (`https://portal.kselectnetwork.com`)

---

# Chapter 1. 선적 및 국제 물류 개요 (Logistics Overview)

## 1.1 K SELECT 국제 물류 파이프라인 및 도메인 구조
K SELECT의 글로벌 B2B 공급망 관리는 **주문(Order), 물류(Logistics), 창고(Warehouse Receiving), 재무(Finance)**의 4대 독립 도메인으로 구성되어 있으며, 각 단계는 명확한 책임 분계점(Handoff Boundary)을 통해 유기적으로 연결됩니다.

```
                                  ┌── [MAN-B-LOG-001] 선적 & 물류 도메인 ── [창고 도메인] 입고 검수
[MAN-B-ORD-001] 발주 및 계약 확정 ──┤   (Goods Readiness → Cargo Spec → Inbound Tracking → Arrival → Receiving Handoff)
(po_status: APPROVED/SENT         │
 supplier_confirmation: CONFIRMED)└── [MAN-B-FIN-001] 재무 & 정산 도메인
                                      (Invoice Creation → Approval → Settlement)
```

1. **발주 확정 단계 (`MAN-B-ORD-001`)**:
   - 관리자가 발행한 정식 발주서(PO)를 공급사가 검토하여 수락(`CONFIRMED`)함으로써 법적·상업적 계약이 체결됩니다.
   - 발주서의 내부 승인 상태가 `po_status IN ('APPROVED', 'SENT')`이고 공급사 확정 상태가 `supplier_confirmation_status = 'CONFIRMED'`가 되면, 즉시 **출고 준비(Goods Readiness)**와 **재무 인보이스(Invoice)** 작업이 각각 독립적으로 개시될 수 있습니다.
2. **선적 & 물류 단계 (`MAN-B-LOG-001` — 본 매뉴얼)**:
   - 상품 생산 완료 후 실제 출고 가능한 수량(`ready_qty`)과 실측 패킹 스펙(카톤 수, 총중량, CBM)을 등록하고 패킹리스트(P/L)와 상업송장(C/I)을 제출합니다.
   - 지정된 운송 책임 방식에 따라 화물을 인계하거나 직접 선적을 등록하여 미국 물류센터 도착(`ARRIVED`)까지의 운송 상태를 추적합니다.
3. **창고 입고 검수 단계 (Warehouse Receiving Domain)**:
   - 화물이 미국 창고 도크에 도착하면 현장 관리자가 카톤 바코드를 스캔하고 실물 피스 카운팅(Piece Count)을 수행하여 정상 입고(`received_qty`), 외관 파손(`damaged_qty`), 수량 불일치/오배송(`hold_qty`)을 판정합니다.
4. **재무 & 정산 단계 (`MAN-B-FIN-001`)**:
   - 확정된 PO를 바탕으로 합의된 상업적 결제 조건(선급금, 선적 시 정산, 또는 입고 검수 후 정산 등)에 따라 인보이스를 발행하고 대금 지급/송금을 처리합니다.

---

## 1.2 운송 책임(Shipping Responsibility) 분기 이해
K SELECT 시스템은 발주서 생성 시 합의된 무역 조건(Incoterms)에 따라 두 가지 운송 책임 트랙으로 자동 분기됩니다:

| 구분 | Track 1: `LETUSTO_ARRANGED` (본사 지정 운송) | Track 2: `SUPPLIER_ARRANGED` (공급사 자체 운송) |
| :--- | :--- | :--- |
| **기준 거래조건** | **FOB (Free On Board)** / FCA 기준 | **DDP (Delivered Duty Paid)** / DAP 기준 |
| **국제 운송 주관** | **Letusto Inc. (K SELECT 본사 지정 포워더)** | **브랜드사 / 공급사 자체 계약 운송사** |
| **공급사 주요 역할** | - 출고 준비 완료 등록 (스펙, 중량, CBM, P/L, C/I)<br>- 포워더 방문 픽업 지원 및 실물 화물 상차<br>- Brand Portal에서 **`물품 인계 완료 (Handed Over)`** 클릭 | - 출고 준비 완료 등록 (스펙, 중량, CBM, P/L, C/I)<br>- 자체 특송/해운사(FedEx, DHL, 포워더)를 통한 발송<br>- 상세 화면에서 **배송 정보(Carrier, Tracking/BL, ETD/ETA) 직접 등록** |
| **선적 번호 생성** | Letusto 관리자가 부킹 후 Admin에서 생성 | 공급사가 선적 정보 등록 시 시스템 자동 생성 |
| **적용 권장 대상** | 대량 컨테이너 선적(FCL/LCL) 및 본사 통합 물류 이용 시 | 긴급 소량 항공 특송(Courier) 및 자체 물류망 보유 시 |

---

# Chapter 2. 선적 & 출고 관리 허브 둘러보기 (Shipping Hub UI)

## 2.1 출고 준비 등록 내역 (Goods Readiness Tab)
Brand Portal 좌측 메뉴에서 **`주문 관리 > 선적 & 출고 관리`**(`/portal/orders/shipping`)로 이동하면 기본적으로 **출고 준비 등록 내역** 탭이 활성화됩니다.

*(참조 화면: `SCR-B-LOG-001.png`)*

- **주요 표시 항목**:
  1. **PO Number**: 연계된 정식 발주서 번호 (예: `PO-2026-0008`).
  2. **준비 예정일**: 공급사가 입력한 출고 준비 완료 목표 일자.
  3. **운송 책임**: `Letusto 배송` 또는 `공급사 배송` 뱃지.
  4. **인계 상태 (Handover Status)**:
     - `임시저장 (Draft)`: 기본 정보가 임시 저장된 상태 (수량/서류 자유 수정 가능).
     - `출고준비 완료 (Ready Submitted)`: 수량 및 실측 스펙 제출 완료 상태.
     - `인계 대기 (Handover Pending)`: 포워더 픽업 예약 진행 중.
     - `물품 인계 완료 (Handed Over)`: 포워더 또는 운송사에 화물 인계 완료.
  5. **수량 경고**: 발주 가용량을 초과하여 입력된 경우 `⚠️ 초과 선적 경고` 배지 표시.
  6. **상세 보기**: 출고 준비 상세 페이지(`/portal/orders/shipping/[id]`)로 이동하는 링크.

---

## 2.2 선적 추적 내역 (Shipments Tab)
상단 탭에서 **`선적 추적 내역 (Shipments)`** 버튼을 클릭하면 실제 국제 운송이 진행 중인 Inbound Shipments 목록을 확인할 수 있습니다.

*(참조 화면: `SCR-B-LOG-002.png`)*

- **주요 추적 항목**:
  - **Shipment Number**: 국제 선적 관리 고유 번호 (예: `SHP-2026-0041`).
  - **운송 주체**: `Letusto 배송` 또는 `공급사 배송`.
  - **배송사 (Carrier)**: 선박사, 항공사, 또는 특송사 명칭 (예: Maersk, FedEx, DHL).
  - **ETD (Estimated Time of Departure)**: 출항/출발 예정일.
  - **ETA (Estimated Time of Arrival)**: 미국 현지 도착 예정일.
  - **선적 상태**: 물류 운송 단계(`CREATED` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `ARRIVED`) 및 창고 입고 인계 후 상태(`PARTIALLY_RECEIVED` / `RECEIVED` $\rightarrow$ `COMPLETED`).

---

# Chapter 3. 출고 준비 완료 등록 (Goods Readiness Submission)

공식 확정된 발주서에 대해 상품 생산 및 포장이 완료되면, Brand Portal에서 출고 준비 정보를 등록합니다.

## 3.1 발주서 선택 및 기본 물류 정보 입력
우측 상단의 **`+ 새 출고 준비 등록 (New Goods Ready)`** 버튼을 클릭하면 출고 등록 폼이 펼쳐집니다.

*(참조 화면: `SCR-B-LOG-003.png`)*

1. **대상 발주서 선택 (PO)**: 드롭다운에서 대상 발주서를 선택합니다. 승인 및 공급사 확정이 완료된(`po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'`) 발주서만 목록에 표시됩니다.
2. **출고 준비 완료 예정일 (Goods Ready Date)**: 화물이 공장/창고에서 출고 가능한 상태가 되는 정확한 일자를 선택합니다.
3. **FOB Port / Port of Loading**: 해상/항공 선적항 (예: `Busan Port CFS`, `Incheon Airport`).
4. **상세 픽업 주소 / 공장 출고지**: 포워더 차량이 진입하여 상차할 실제 도로명 주소를 상세히 입력합니다.
5. **인계 목적지 (Handover Location)**: LETUSTO 지정 창고 또는 인계 장소 (예: `Letusto PA Warehouse Hub`).
6. **현장 담당자 연락처**: 상차 당일 현장에서 기사님과 직접 통화 가능한 담당자 성명 및 연락처를 기재합니다.
7. **회사명 / 공장 주소**: 원산지 제조 공장 상호 및 사업장 주소를 입력합니다.
8. **기타 요청 및 특이사항**: 팔레트 규격, 지게차 지원 여부, 상차 제한 시간 등 특이사항을 작성합니다.

---

## 3.2 품목별 수량 배정 및 실측 카고 스펙 산출
발주서를 선택하면 하단에 발주 품목 라인이 자동으로 불러와집니다.

*(참조 화면: `SCR-B-LOG-004.png`)*

- **수량 필드 계산 규칙**:
  - **확정량 (`confirmed_qty`)**: 발주서 확정 총 수량.
  - **선적 완료량 (`cumulative_shipped`)**: 기존에 이미 출항/선적된 누적 수량.
  - **미선적 잔량**: $\text{확정량} - \text{선적 완료량}$.
  - **준비 가용 수량 (`availableReadiness`)**: $\text{미선적 잔량} - \text{다른 진행 중인 준비 수량}$.
- **실측 패킹 4대 스펙 입력**:
  1. **금번 준비 완료 등록 (`ready_qty`)**: 이번 차수에 실제 출고 준비된 완제품 수량 (EA).
  2. **박스 수 (`cartons`)**: 해당 품목이 포장된 총 카톤(Box) 개수.
  3. **중량 (`gross_weight`)**: 제품, 완충재, 외박스를 모두 포함한 총 실측 중량 (kg).
  4. **체적 (`cbm`)**: 화물의 총 부피($\text{m}^3$).
     $$\text{CBM} = \text{카톤 가로(m)} \times \text{세로(m)} \times \text{높이(m)} \times \text{박스 수}$$

> 🚨 **수량 초과 방지 원칙 (Overage Protection)**:
> 준비 가용 수량을 초과하여 `ready_qty`를 입력할 경우 즉시 붉은색 경고 테두리(`border-rose-300`)와 함께 상단에 `⚠️ 경고: 준비 가용 수량을 초과하는 Ready Qty가 존재합니다` 알림이 표시되며, 저장이 엄격히 차단됩니다. *(참조 화면: `SCR-B-LOG-008.png`)*

---

## 3.3 필수 서류 첨부: Packing List & Commercial Invoice
국제 운송 및 미국 세관 수입 통관을 위해 2대 필수 무역 서류를 첨부해야 합니다:
- **패킹 리스트 (Packing List)**: 품목별 박스 번호, 박스당 입수량, 순중량(Net Weight), 총중량(Gross Weight), CBM이 기재된 서류.
- **상업 송장 (Commercial Invoice)**: 발주 번호, 품목명, 단가, 총금액, 거래조건(Incoterms)이 명시된 공식 인보이스.
- **파일 업로드**: `.pdf`, `.png`, `.jpg` 형식 지원. 업로드 즉시 Private Storage에 암호화 저장되며, 업로드 완료 시 파일명 옆에 녹색 체크마크(`✓ filename.pdf`)가 표시됩니다.

---

## 3.4 임시 저장(Save Draft) 및 출고 완료 제출(Submit)
- **임시 저장 (Save Draft)**: 입력 중인 정보를 보관하며, `goods_readiness.handover_status`가 `DRAFT`로 유지됩니다. 언제든 다시 열어 수정할 수 있습니다.
- **출고 완료 제출 (Submit)**: 등록을 확정하여 `goods_readiness.handover_status`가 `READY_SUBMITTED`로 전환됩니다. 연계된 발주서의 물류 이행 상태(`fulfillment_status`)가 자동으로 **`READY_TO_SHIP`**으로 업데이트되며, 발주서 액티비티 로그에 공식 기록됩니다.

---

# Chapter 4. 운송 책임별 출고 및 선적 이행 (Fulfillment Execution)

## 4.1 [Track 1] LETUSTO 지정 운송 (FOB): 포워더 픽업 및 인계
`LETUSTO_ARRANGED` 발주서의 경우, 출고 준비 제출 완료 후 본사가 지정한 국제 포워더가 배정됩니다.

*(참조 화면: `SCR-B-LOG-005.png`)*

1. **포워더 조율**: Letusto 물류팀이 선적 스케줄을 확정하고 포워더 배차 정보를 등록합니다.
2. **화물 픽업 (Pickup)**: 지정된 일시에 포워더 운송 차량이 공장/창고로 방문하여 실물 화물과 서류를 수거합니다.
3. **물품 인계 완료 처리**:
   - 실물 상차가 완료되면 출고 준비 상세 화면(`/portal/orders/shipping/[id]`)의 우측 **물류 액션 패널**로 이동합니다.
   - **`물품 인계 완료 (Handed Over)`** (인디고 버튼)을 클릭합니다.
   - 확인 팝업(*"물류 담당사(또는 Letusto 지정 운송사)에 물품 인계를 완료했습니까?"*)에서 확인을 누르면 상태가 **`HANDED_OVER`**로 갱신됩니다.
4. **선적 관리 연계**: 이후 Letusto 물류팀이 B/L을 발행하고 Inbound Shipment를 생성하여 해상/항공 선적을 진행합니다.

---

## 4.2 [Track 2] 공급사 자체 운송 (DDP): 특송/포워더 배송 정보 등록
`SUPPLIER_ARRANGED` 발주서의 경우, 공급사가 자체 물류망을 통해 직접 출고 및 국제 선적을 진행합니다.

*(참조 화면: `SCR-B-LOG-006.png`)*

1. **화물 발송**: 공급사가 계약한 특송사(FedEx, DHL, UPS 등) 또는 포워더에 화물을 인계하고 운송장을 발급받습니다.
2. **배송 정보 직접 입력**:
   - 출고 준비 상세 화면의 **물류 액션 패널** 입력 폼에 배송 정보를 기재합니다.
   - **배송사 (Carrier)**: 예, `FedEx International Priority`, `DHL Express`, `CJ대한통운`.
   - **송장번호 (Tracking Number)**: 국제 운송장 번호.
   - **B/L 또는 AWB 번호**: 선하증권(Ocean B/L) 또는 항공화물운송장(Air Waybill) 번호.
   - **ETD (출발일)** & **ETA (도착예정일)**: 운송사에서 제공한 예상 출항/도착 일자.
3. **배송 출발 및 선적 등록 실행**:
   - **`배송 출발 및 선적 등록`** 버튼을 클릭합니다.
   - 시스템이 즉시 신규 `inbound_shipments` 레코드를 자동 생성하며, 선적 상태를 **`IN_TRANSIT`**으로 전환합니다.
   - 출고 준비 상태는 **`HANDED_OVER`**로, 발주서의 물류 상태는 **`SHIPPED`**로 즉시 갱신됩니다.
4. **처리 완료 확인**:
   - 화면에 `✓ 물류 인계 및 발송 처리가 종료된 건입니다.` 녹색 안내 배너가 표시됩니다. *(참조 화면: `SCR-B-LOG-007.png`)*

---

# Chapter 5. 선적 추적 및 미국 창고 입고 인계 (Inbound Tracking & Receiving Handoff)

## 5.1 선적 진행 상태 모니터링 (Inbound Tracking)
선적이 개시되면 Brand Portal의 **선적 추적 내역 (Shipments)** 탭에서 실시간 운송 상태를 모니터링할 수 있습니다.

```
[ LOGISTICS 관할 (브랜드 포털 물류) ]                    [ WAREHOUSE RECEIVING 관할 (Admin/창고) ]
[ CREATED ] (선적 생성) ──► [ IN_TRANSIT ] (국제 운송 중) ──► [ ARRIVED ] (도착) ──► [ HANDOFF ] ──► [ PARTIALLY_RECEIVED / RECEIVED ] ──► [ COMPLETED ]
```

- **물류 운송 단계 (Brand Logistics Responsibility)**:
  - `CREATED`: 선적 번호 생성 및 부킹/스케줄 확정.
  - `IN_TRANSIT`: 항공기 또는 선박이 출항하여 국제 운송 중인 상태.
  - `ARRIVED / DELIVERED`: 미국 현지 통관을 마치고 목적지인 Letusto 물류센터 도크에 화물이 도착한 상태 (브랜드 포털 물류 책임 종료 및 창고 인계).
- **창고 입고 검수 단계 (Warehouse Receiving Domain / Admin 관할)**:
  - `PARTIALLY_RECEIVED / RECEIVED`: 창고 관리자가 카톤을 개봉하고 바코드를 스캔하여 실물 검수를 완료한 상태.
  - `COMPLETED`: 입고 검수 및 행정 절차가 최종 종결된 상태.
- *(참조 관리자 화면: `SCR-B-LOG-010.png` — Admin Inbound Shipment Detail)*

---

## 5.2 미국 창고 입고 검수 및 실물 인계 (Warehouse Receiving Handoff)
화물이 물류센터에 도착(`ARRIVED`)하면 본 **선적 & 물류 도메인(`MAN-B-LOG-001`)**의 책임 범위가 종료되고, **창고 입고 도메인(Warehouse Receiving)**으로 실물이 인계됩니다.

*(참조 관리자 화면: `SCR-B-LOG-011.png` — Admin Warehouse Receiving Inspection)*

1. **실물 검수 프로세스**:
   - 창고 검수팀이 카톤 외관 검사 및 바코드 스캔을 진행합니다.
   - 박스를 개봉하여 실물 피스 카운팅(Piece Count)을 수행합니다.
2. **검수 결과 3대 분류**:
   - **정상 입고 수량 (`received_qty`)**: 양품으로 확인되어 창고 재고로 공식 반영되는 수량.
   - **파손 수량 (`damaged_qty`)**: 운송 중 찌그러짐, 파손, 오염 등으로 불량 격리되는 수량.
   - **보류 수량 (`hold_qty`)**: 라벨 오부착, 바코드 인식 불가, 수량 불일치로 판정 보류된 수량.
3. **입고 전표 확정 (`FINALIZED / RECEIVED`)**:
   - 창고 실물 검수가 완료되면 최종 입고 실적이 발주서 이행 실적에 공식 반영되어 입고 처리가 종결됩니다.
   - *(참고: 재무 도메인(`MAN-B-FIN-001`)은 공식 발주 확정 이후 계약 조건에 따라 병렬로 작동하는 독립 도메인이며, 물류 및 입고 단계와 독립적으로 관리됩니다.)*

---

# Chapter 6. 권한 관리 및 문제 해결 FAQ (ACL & Troubleshooting)

## 6.1 권한 체계 (Role Permissions)
K SELECT Brand Portal은 회사 구성원의 역할에 따라 엄격한 기능 권한을 부여합니다:

| 메뉴 및 기능 | 회사 관리자 (Admin / Owner) | 운영자 (Operator) | 조회 전용 사용자 (Viewer) |
| :--- | :---: | :---: | :---: |
| **선적/출고 목록 및 상세 조회** | ✅ 가능 | ✅ 가능 | ✅ 가능 |
| **첨부파일(P/L, C/I) 다운로드** | ✅ 가능 | ✅ 가능 | ✅ 가능 |
| **새 출고 준비 등록 (`+ New Goods Ready`)** | ✅ 가능 | ✅ 가능 | ❌ 버튼 미노출 |
| **물품 인계 완료 처리 (`Handed Over`)** | ✅ 가능 | ✅ 가능 | ❌ "조회 전용 권한입니다" 배너 표시 |
| **공급사 직배송 선적 등록 (`Dispatch Form`)** | ✅ 가능 | ✅ 가능 | ❌ 입력 폼 비활성화 |

*(참조 화면: `SCR-B-LOG-009.png` — Viewer Role Read-Only Restriction)*

---

## 6.2 자주 묻는 질문 (Logistics FAQ Top 6)

### Q1. 하나의 발주서(PO)에 대해 여러 번 나누어 분할 출고(Partial Shipment)를 할 수 있나요?
**A:** 네, 가능합니다. 발주서의 잔여 가용 수량(`availableReadiness`) 범위 내라면 여러 차례에 걸쳐 분할 출고 준비(`Goods Readiness`)를 등록할 수 있습니다. 각 출고 건마다 독립된 실측 CBM, 중량, 패킹리스트, 인계 상태가 관리됩니다.

### Q2. 출고 준비 완료를 제출(`READY_SUBMITTED`)한 후 수량이나 주소를 수정할 수 있나요?
**A:** 포워더에 물품을 인계하기 전(`handover_status`가 `HANDED_OVER`로 변경되기 전)이라면 언제든지 출고 준비 정보를 수정하여 재제출할 수 있습니다. 수정 시 변경 이력이 발주서 액티비티 로그에 자동으로 기록됩니다.

### Q3. `ARRIVED` 상태와 `RECEIVED` 상태는 무엇이 다른가요?
**A:** `ARRIVED`는 화물이 미국 물류센터 도크에 물리적으로 도착한 시점을 뜻하며(운송 단계 완료), `RECEIVED`는 창고 검수자가 박스를 개봉하여 실물 수량과 품질을 전수 검수한 후 입고 전표를 확정한 시점을 뜻합니다.

### Q4. 패킹리스트와 상업송장 파일 첨부는 필수인가요?
**A:** 국제 운송 및 미국 세관 통관을 위해 P/L과 C/I 첨부는 강력히 권장됩니다. 서류가 누락될 경우 포워더 픽업이나 현지 세관 통관이 지연될 수 있습니다.

### Q5. 가용 수량을 초과하여 출고해야 하는 특별한 사정이 있는 경우 어떻게 하나요?
**A:** 시스템상 계약 가용량을 초과하는 수량은 입력되지 않도록 유효성 검증(Validation)이 적용됩니다. 생산 수량 증가 등으로 추가 출고가 필요한 경우, 먼저 관리자에게 발주 수량 증액(PO Revision)을 요청하여 확정된 후 출고를 진행하셔야 합니다.

### Q6. 인보이스 청구는 반드시 물류 도착이나 입고 검수 후에만 가능한가요?
**A:** 아닙니다. 공식 발주서 확정(`po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'`) 이후에는 양사 간 체결된 계약 조건(선급금 조건, 선적 시 청구 조건, 입고 후 청구 조건 등)에 따라 `MAN-B-FIN-001` 재무 메뉴에서 독립적으로 인보이스를 발행할 수 있습니다.
