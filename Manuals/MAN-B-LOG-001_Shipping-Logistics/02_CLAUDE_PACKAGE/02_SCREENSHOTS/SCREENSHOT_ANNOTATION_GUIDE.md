# SCREENSHOT ANNOTATION GUIDE: MAN-B-LOG-001
## K SELECT Brand Portal Shipping & Logistics Manual

본 문서는 `MAN-B-LOG-001` 공식 매뉴얼에 수록될 **11개 프로덕션 스크린샷의 상세 시각 주석(Callout Pin), 캡션 및 레이아웃 배치 가이드**입니다.

---

## 1. Screenshot Matrix Overview

| File Name | Semantic Screen Name | Priority / Tier | Target Chapter | Aspect / Viewport |
| :--- | :--- | :---: | :--- | :--- |
| `SCR-B-LOG-001.png` | Goods Readiness List Hub | **P0 (Core)** | Chapter 2.1 | Desktop 1440x900 |
| `SCR-B-LOG-002.png` | Shipments Tracking List Hub | **P0 (Core)** | Chapter 2.2 | Desktop 1440x900 |
| `SCR-B-LOG-003.png` | Goods Ready Header & Logistics Form | **P0 (Core)** | Chapter 3.1 | Desktop 1440x900 |
| `SCR-B-LOG-004.png` | Packaging Lines & Documents Upload | **P0 (Core)** | Chapter 3.2, 3.3 | Desktop 1440x900 |
| `SCR-B-LOG-005.png` | Readiness Detail: Letusto Track Handover | **P0 (Core)** | Chapter 4.1 | Desktop 1440x900 |
| `SCR-B-LOG-006.png` | Readiness Detail: Supplier Track Dispatch | **P0 (Core)** | Chapter 4.2 | Desktop 1440x900 |
| `SCR-B-LOG-007.png` | Readiness Detail: Handed Over State | **P1 (Supporting)** | Chapter 4.3 | Desktop 1440x900 |
| `SCR-B-LOG-008.png` | Overage Warning & Protection Alert | **P1 (Supporting)** | Chapter 3.2, 6.2 | Desktop 1440x900 |
| `SCR-B-LOG-009.png` | Viewer Role Read-Only Restriction | **P1 (Supporting)** | Chapter 6.1 | Desktop 1440x900 |
| `SCR-B-LOG-010.png` | Admin Inbound Shipment Detail (Ref) | **P2 (Optional)** | Chapter 5.1 | Desktop 1440x900 |
| `SCR-B-LOG-011.png` | Admin Warehouse Receiving Inspection (Ref)| **P2 (Optional)** | Chapter 5.2 | Desktop 1440x900 |

---

## 2. Detailed Screenshot Callouts & Captions

### [SCR-B-LOG-001.png] 선적 & 출고 관리 허브 — 출고 준비 등록 내역 탭
- **Caption:** [그림 2-1] Brand Portal 선적 & 출고 관리 허브 메인 화면 (Goods Readiness List)
- **Callout Annotations:**
  - `(1)` **메인 탭 전환기**: `출고 준비 등록 내역 (Goods Readiness)` 및 `선적 추적 내역 (Shipments)` 탭 전환 버튼.
  - `(2)` **신규 등록 버튼**: `+ 새 출고 준비 등록 (New Goods Ready)` 버튼 (`orders:write` 권한 보유 시 노출).
  - `(3)` **인계 상태 뱃지**: `출고준비 완료`, `임시저장`, `인계 대기`, `물품 인계 완료` 상태 표시.
  - `(4)` **상세 보기 링크**: 개별 출고 건의 상세 관리 및 물류 액션 패널로 이동하는 `상세 정보 →` 링크.

---

### [SCR-B-LOG-002.png] 선적 & 출고 관리 허브 — 선적 추적 내역 탭
- **Caption:** [그림 2-2] 국제 선적 추적 내역 화면 (Shipments Inbound Tracking)
- **Callout Annotations:**
  - `(1)` **Shipment Number**: K SELECT 국제 선적 고유 번호 (`SHP-XXXX`).
  - `(2)` **운송 주체**: `Letusto 배송` vs `공급사 배송` 구분.
  - `(3)` **배송사 및 일정**: Carrier 명칭 및 출항(ETD) / 도착(ETA) 예정일.
  - `(4)` **선적 상태**: `CREATED`, `IN_TRANSIT`, `ARRIVED`, `RECEIVED` 선적 진행 단계 뱃지.

---

### [SCR-B-LOG-003.png] 출고 준비 완료 등록 — 기본 정보 및 카고 헤더 입력
- **Caption:** [그림 3-1] 출고 준비 완료 등록 화면 (기본 정보 및 공장 출고지 입력 폼)
- **Callout Annotations:**
  - `(1)` **대상 발주서 선택**: 승인 및 공급사 확정이 완료된 PO 드롭다운 선택.
  - `(2)` **출고 준비 예정일 & FOB Port**: 실제 출고 가능 일자 및 선적항 지정.
  - `(3)` **상세 픽업 주소 & 현장 연락처**: 포워더 방문 상차용 상세 주소 및 담당자 정보.

---

### [SCR-B-LOG-004.png] 출고 준비 완료 등록 — 품목별 실측 규격 및 서류 첨부
- **Caption:** [그림 3-2] 품목별 실측 패킹 스펙 입력 테이블 및 무역 서류 첨부 영역
- **Callout Annotations:**
  - `(1)` **수량 대조 열**: 계약 확정량, 기선적량, 미선적 잔량, 준비 가용 수량 자동 계산 표시.
  - `(2)` **실측 패킹 입력**: 준비 수량(EA), 카톤 수(Cartons), 총중량(kg), CBM($\text{m}^3$) 입력 필드.
  - `(3)` **서류 첨부 패널**: Packing List (P/L) 및 Commercial Invoice (C/I) 파일 업로드 및 체크마크.
  - `(4)` **제출 액션 버튼**: `임시 저장 (Save Draft)` 및 `출고 완료 제출 (Submit)` 버튼.

---

### [SCR-B-LOG-005.png] 출고 상세 내역 — 본사 지정 운송 (LETUSTO_ARRANGED) 인계 패널
- **Caption:** [그림 4-1] LETUSTO 지정 운송 출고 상세 화면 및 물품 인계 완료 패널
- **Callout Annotations:**
  - `(1)` **운송 주체 표시**: `Letusto 배송 (Letusto Arranged)` 뱃지.
  - `(2)` **첨부 서류 다운로드**: 암호화 저장된 P/L 및 C/I 서명 다운로드 링크.
  - `(3)` **물품 인계 완료 버튼**: 포워더 픽업 후 상태를 확정하는 `물품 인계 완료 (Handed Over)` 인디고 버튼.

---

### [SCR-B-LOG-006.png] 출고 상세 내역 — 공급사 자체 운송 (SUPPLIER_ARRANGED) 선적 등록 폼
- **Caption:** [그림 4-2] 공급사 자체 운송 출고 상세 화면 및 배송 출발/선적 등록 폼
- **Callout Annotations:**
  - `(1)` **운송 주체 표시**: `공급사 배송 (Supplier Arranged)` 뱃지.
  - `(2)` **배송 정보 입력 필드**: 배송사(Carrier), 송장번호(Tracking Number), B/L/AWB, ETD, ETA 입력 폼.
  - `(3)` **배송 출발 및 선적 등록 버튼**: 선적 레코드를 생성하고 `IN_TRANSIT`으로 전환하는 등록 버튼.

---

### [SCR-B-LOG-007.png] 출고 상세 내역 — 물품 인계 완료 상태
- **Caption:** [그림 4-3] 물품 인계 및 발송 처리가 정상 종료된 출고 상세 화면
- **Callout Annotations:**
  - `(1)` **인계 상태 뱃지**: `물품 인계 완료 (HANDED_OVER)` 녹색 뱃지.
  - `(2)` **종료 안내 패널**: `✓ 물류 인계 및 발송 처리가 종료된 건입니다.` 안내 배너.

---

### [SCR-B-LOG-008.png] 출고 준비 수량 초과 경고 (Overage Warning Alert)
- **Caption:** [그림 6-1] 준비 가용 수량 초과 입력 시 실시간 경고 및 입력 차단 화면
- **Callout Annotations:**
  - `(1)` **초과 경고 배너**: `⚠️ 경고: 준비 가용 수량을 초과하는 Ready Qty가 존재합니다` 붉은색 알림.
  - `(2)` **하이라이트 입력 필드**: 가용 수량을 초과한 행의 붉은색 테두리(`border-rose-300 bg-rose-50`).

---

### [SCR-B-LOG-009.png] 조회자(Viewer) 역할 읽기 전용 접근 제한 화면
- **Caption:** [그림 6-2] 조회 전용 권한(Viewer) 계정의 읽기 전용 모드 화면
- **Callout Annotations:**
  - `(1)` **생성 버튼 미노출**: 우측 상단 `+ 새 출고 준비 등록` 버튼 비표시.
  - `(2)` **조회 전용 안내 패널**: `조회 전용 권한입니다 (선적 및 인계 작업 불가).` 배너 표시.

---

### [SCR-B-LOG-010.png] K SELECT 관리자 인바운드 선적 관리 화면 (Admin Reference)
- **Caption:** [그림 5-1] K SELECT 관리자 인바운드 선적 상세 화면 (선적 번호, B/L, 도착 창고 관리)
- **Callout Annotations:**
  - `(1)` **선적 마스터 정보**: 선적 상태(`IN_TRANSIT`), B/L 번호, 출항/도착 항구.
  - `(2)` **도착 창고 정보**: 미국 목적지 창고(Destination Warehouse) 배정 현황.

---

### [SCR-B-LOG-011.png] K SELECT 관리자 창고 입고 검수 화면 (Admin Reference)
- **Caption:** [그림 5-2] K SELECT 관리자 미국 물류센터 입고 검수(Receiving) 화면
- **Callout Annotations:**
  - `(1)` **입고 검수 번호 및 상태**: `RCV-XXXX` 및 입고 상태 (`FINALIZED`).
  - `(2)` **실물 검수 수량 대조**: 정상 입고(`received_qty`), 파손(`damaged_qty`), 보류(`hold_qty`) 기록 테이블.
