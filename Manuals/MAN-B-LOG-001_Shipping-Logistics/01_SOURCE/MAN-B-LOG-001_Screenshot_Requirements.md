# MAN-B-LOG-001: Screenshot Requirements & Capture Specification
## Brand Portal Shipping & Logistics (선적 & 출고 관리 스크린샷 규격서)

- **Manual ID:** `MAN-B-LOG-001`
- **Topic:** `Shipping & Logistics (출고, 선적 및 국제 물류 관리)`
- **Audience:** `B — Brand Portal`
- **Phase:** `01_SOURCE — Screenshot Specifications`
- **Authoritative Date:** 2026-10-01

---

## 1. Screenshot Capture Principles & Standards

1. **Production Grounding**: 모든 스크린샷은 실제 Production 브라우저 환경에서 실제 UI 컴포넌트를 직접 렌더링하여 캡처해야 합니다.
2. **Semantic Uniqueness**: 각 스크린샷은 고유한 비즈니스 상태와 UI 요소를 명확히 대변해야 하며, 단순 반복 캡처를 엄격히 금지합니다.
3. **Clean Presentation**: 뷰포트는 데스크톱 표준 1440x900(또는 1280x800)을 유지하며, 중요한 상호작용 지점에 포커스를 둡니다.

---

## 2. Structured Screenshot Specifications

### 2.1 Tier 1: CORE (필수 핵심 화면 — Priority P0)

#### `LOG_01_SHIPPING_HUB_READINESS`
- **화면명:** 선적 & 출고 관리 허브 — 출고 준비 등록 내역 탭
- **대상 경로:** `/portal/orders/shipping`
- **필수 상태 / 조건:**
  - `activeTab === 'readiness'`
  - Goods Readiness 목록에 최소 2건 이상의 출고 준비 레코드(`READY_SUBMITTED`, `HANDED_OVER` 등) 표시
  - 우측 상단 `+ 새 출고 준비 등록 (New Goods Ready)` 버튼 활성화
- **강조 영역 (Highlight):** 헤더 타이틀, 탭 전환 버튼, 인계 상태 뱃지, `상세 정보 →` 링크
- **매뉴얼 배치:** Chapter 2.1 출고 준비 등록 내역 둘러보기

#### `LOG_02_SHIPPING_HUB_SHIPMENTS`
- **화면명:** 선적 & 출고 관리 허브 — 선적 추적 내역 탭
- **대상 경로:** `/portal/orders/shipping`
- **필수 상태 / 조건:**
  - `activeTab === 'shipments'`
  - Inbound Shipments 목록에 실제 운송 정보(Shipment Number, 배송사, ETD, ETA, 상태 `IN_TRANSIT` 등) 렌더링
- **강조 영역 (Highlight):** 선적 번호(SHP-XXXX), 운송 주체, 배송사, ETD/ETA, 선적 상태 뱃지
- **매뉴얼 배치:** Chapter 2.2 선적 추적 내역 및 물류 상태 모니터링

#### `LOG_03_GOODS_READY_FORM_HEADER`
- **화면명:** 출고 준비 완료 등록 — 기본 정보 및 카고 헤더 입력
- **대상 경로:** `/portal/orders/shipping` (`isCreating === true`)
- **필수 상태 / 조건:**
  - 대상 발주서(PO) 드롭다운 선택 완료 상태
  - 출고 준비 완료 예정일, FOB Port, 상세 픽업 주소, 현장 연락처가 정상 입력된 상태
- **강조 영역 (Highlight):** 발주서 선택 드롭다운, 준비 예정일 및 픽업지 주소 입력 필드
- **매뉴얼 배치:** Chapter 3.1 발주서 선택 및 기본 물류 정보 입력

#### `LOG_04_GOODS_READY_FORM_LINES_AND_DOCS`
- **화면명:** 출고 준비 완료 등록 — 품목별 실측 규격 및 서류 첨부
- **대상 경로:** `/portal/orders/shipping` (`isCreating === true`)
- **필수 상태 / 조건:**
  - PO Line 품목 테이블에 확정량, 가용 수량, Ready Qty, Cartons, Weight, CBM이 모두 입력된 상태
  - 우측 P/L 및 C/I 파일 첨부 완료 체크마크(`✓ filename.pdf`) 표시
- **강조 영역 (Highlight):** 품목별 카고 스펙 입력 열, 파일 첨부 완료 영역, `출고 완료 제출 (Submit)` 버튼
- **매뉴얼 배치:** Chapter 3.2 품목별 수량 배정 및 실측 패킹 스펙 입력

#### `LOG_05_READINESS_DETAIL_LETUSTO_TRACK`
- **화면명:** 출고 상세 내역 — 본사 지정 운송 (LETUSTO_ARRANGED) 인계 패널
- **대상 경로:** `/portal/orders/shipping/[id]`
- **필수 상태 / 조건:**
  - `shippingResponsibility === 'LETUSTO_ARRANGED'`인 출고 준비 상세 화면
  - 카고 요약 카드 및 첨부 P/L, C/I 다운로드 링크 정상 표시
  - 물류 액션 패널에 `[물품 인계 완료 (Handed Over)]` 인디고 버튼 노출
- **강조 영역 (Highlight):** 운송 주체 뱃지, 첨부 문서 다운로드 링크, `물품 인계 완료` 액션 버튼
- **매뉴얼 배치:** Chapter 4.1 LETUSTO 지정 운송: 포워더 픽업 및 인계 완료

#### `LOG_06_READINESS_DETAIL_SUPPLIER_TRACK`
- **화면명:** 출고 상세 내역 — 공급사 자체 운송 (SUPPLIER_ARRANGED) 선적 등록 폼
- **대상 경로:** `/portal/orders/shipping/[id]`
- **필수 상태 / 조건:**
  - `shippingResponsibility === 'SUPPLIER_ARRANGED'`인 출고 준비 상세 화면
  - 물류 액션 패널에 Carrier, Tracking Number, B/L, ETD, ETA 입력 폼 노출
- **강조 영역 (Highlight):** 공급사 배송 뱃지, 배송사/송장번호/ETD/ETA 입력 필드, `[배송 출발 및 선적 등록]` 버튼
- **매뉴얼 배치:** Chapter 4.2 공급사 자체 운송: 특송/포워더 배송 정보 등록

---

### 2.2 Tier 2: SUPPORTING (보조 설명 화면 — Priority P1)

#### `LOG_07_READINESS_DETAIL_HANDED_OVER`
- **화면명:** 출고 상세 내역 — 인계 및 발송 처리 완료 상태
- **대상 경로:** `/portal/orders/shipping/[id]`
- **필수 상태 / 조건:**
  - `handoverStatus === 'HANDED_OVER'`인 상세 화면
  - 물류 액션 패널에 `✓ 물류 인계 및 발송 처리가 종료된 건입니다.` 안내 표시
- **강조 영역 (Highlight):** `물품 인계 완료` 녹색 뱃지 및 완료 안내 패널
- **매뉴얼 배치:** Chapter 4.3 인계 완료 후 상태 확인

#### `LOG_08_OVERAGE_WARNING_ALERT`
- **화면명:** 출고 준비 수량 초과 경고 (Overage Warning)
- **대상 경로:** `/portal/orders/shipping` (`isCreating === true`)
- **필수 상태 / 조건:**
  - Ready Qty 입력값이 준비 가용 수량을 초과하여 입력된 상태
  - 테이블 상단에 붉은색 경고 배지(`⚠️ 경고: 준비 가용 수량을 초과하는 Ready Qty가 존재합니다`) 표시
  - 초과 입력된 행의 Input box가 붉은색 테두리(`border-rose-300 bg-rose-50`)로 강조
- **강조 영역 (Highlight):** 붉은색 경고 배지 및 하이라이트된 수량 입력 필드
- **매뉴얼 배치:** Chapter 6.2 수량 초과 경고 및 예외 처리

#### `LOG_09_VIEWER_ROLE_READONLY`
- **화면명:** 조회자(Viewer) 계정의 읽기 전용 접근 제한 화면
- **대상 경로:** `/portal/orders/shipping` 및 `/portal/orders/shipping/[id]`
- **필수 상태 / 조건:**
  - Viewer 계정으로 로그인한 상태
  - 메인 허브 우측 상단 `+ 새 출고 준비 등록` 버튼 미표시
  - 상세 화면 물류 액션 패널에 `조회 전용 권한입니다 (선적 및 인계 작업 불가).` 표시
- **강조 영역 (Highlight):** 생성 버튼 미노출 영역 및 조회 전용 안내 배너
- **매뉴얼 배치:** Chapter 6.1 권한 관리 및 조회자(Viewer) 역할 제한

---

### 2.3 Tier 3: OPTIONAL (참조 화면 — Priority P2)

#### `LOG_10_ADMIN_INBOUND_SHIPMENT_DETAIL`
- **화면명:** K SELECT 관리자 인바운드 선적 관리 화면 (Admin Reference)
- **대상 경로:** `/admin/purchasing/shipments/[id]`
- **필수 상태 / 조건:**
  - 관리자 계정으로 선적 상세 조회
  - B/L, 컨테이너 정보, 출항/도착 일자 및 연결된 PO Line 매핑 표시
- **강조 영역 (Highlight):** 선적 마스터 정보 및 도착 창고
- **매뉴얼 배치:** Chapter 5.1 선적 진행 상태 모니터링 (관리자 연계 참고용)

#### `LOG_11_ADMIN_RECEIVING_INSPECTION`
- **화면명:** K SELECT 관리자 창고 입고 검수 화면 (Admin Reference)
- **대상 경로:** `/admin/purchasing/receiving/[id]`
- **필수 상태 / 조건:**
  - 정상 입고 수량(`received_qty`), 파손(`damaged_qty`), 보류(`hold_qty`) 기록 테이블 표시
- **강조 영역 (Highlight):** 입고 판정 및 수량 대조 결과
- **매뉴얼 배치:** Chapter 5.2 미국 창고 입고 검수 및 수량 불일치 처리 원칙

---

## 3. Summary of Screenshot Matrix

| Code | Title | Priority | Target URL | Manual Chapter |
| :--- | :--- | :---: | :--- | :--- |
| `LOG_01` | Goods Readiness List Hub | **P0 (Core)** | `/portal/orders/shipping` | Ch 2.1 |
| `LOG_02` | Shipments Tracking List Hub | **P0 (Core)** | `/portal/orders/shipping` | Ch 2.2 |
| `LOG_03` | Goods Ready Header & Logistics Form | **P0 (Core)** | `/portal/orders/shipping` (Create) | Ch 3.1 |
| `LOG_04` | Packaging Lines & Documents Upload | **P0 (Core)** | `/portal/orders/shipping` (Create) | Ch 3.2 |
| `LOG_05` | Readiness Detail: Letusto Track Handover | **P0 (Core)** | `/portal/orders/shipping/[id]` | Ch 4.1 |
| `LOG_06` | Readiness Detail: Supplier Track Dispatch | **P0 (Core)** | `/portal/orders/shipping/[id]` | Ch 4.2 |
| `LOG_07` | Readiness Detail: Handed Over State | **P1 (Supporting)** | `/portal/orders/shipping/[id]` | Ch 4.3 |
| `LOG_08` | Overage Warning & Protection Alert | **P1 (Supporting)** | `/portal/orders/shipping` (Create) | Ch 6.2 |
| `LOG_09` | Viewer Role Read-Only Restriction | **P1 (Supporting)** | `/portal/orders/shipping/[id]` | Ch 6.1 |
| `LOG_10` | Admin Inbound Shipment Detail (Ref) | **P2 (Optional)** | `/admin/purchasing/shipments/[id]` | Ch 5.1 |
| `LOG_11` | Admin Warehouse Receiving Inspection (Ref)| **P2 (Optional)** | `/admin/purchasing/receiving/[id]` | Ch 5.2 |
