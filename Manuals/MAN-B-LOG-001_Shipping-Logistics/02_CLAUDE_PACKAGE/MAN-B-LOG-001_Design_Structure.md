# MAN-B-LOG-001: Design Structure & Page Layout Specification
## K SELECT Brand Portal Shipping & Logistics Manual

- **Manual ID:** `MAN-B-LOG-001`
- **Topic:** `Shipping & Logistics (출고, 선적 및 국제 물류 관리)`
- **Audience:** `B — Brand Portal`
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Authoritative Date:** 2026-10-01

---

## 1. Document Overview & Page Budget

본 문서는 **K SELECT Brand Portal 선적 & 출고 관리(Shipping & Logistics)** 공식 매뉴얼의 인쇄 및 디지털 배포를 위한 페이지별 시각 디자인 레이아웃 명세서입니다.

총 **12~14페이지 내외의 컴팩트한 고밀도 북릿(Executive Booklet)** 구조를 권장하며, 각 페이지는 `MAN-B-BRAND-001_Brand-Policy_V1.pdf`의 엄격한 12-컬럼 그리드와 타이포그래피 계층을 따릅니다.

---

## 2. Page-by-Page Layout Blueprint

### [Page 1] Cover Page (표지)
- **Visual Composition:**
  - 상단: `K SELECT NETWORK` 공식 로고 (Black / Deep Navy)
  - 중앙 메인 타이틀: `K SELECT Brand Portal Manual Series: Shipping & International Logistics Guide` (28pt Bold)
  - 서브 타이틀: `출고 준비, 카고 규격 등록, 운송 분기 및 미국 창고 입고 인계 종합 가이드` (14pt Medium)
  - 우측/중앙 그래픽: 현대적인 국제 물류 컨테이너/화물 추적 인포그래픽 심볼
  - 하단 메타데이터 박스:
    - Manual ID: `MAN-B-LOG-001` | Version: `1.0.0` | Audience: `Brand Portal (B)`
    - Publisher: `Letusto Inc. Logistics Operations Team` | Date: `2026-10-01`

---

### [Page 2] Table of Contents & Executive Summary (목차 및 개요)
- **Left Column:** Table of Contents (Chapter 1 to Chapter 6 with page numbers & dotted leader lines)
- **Right Column:** Executive Summary Card
  - K SELECT의 4대 비즈니스 도메인(발주 확정 $\rightarrow$ 물류/출고 $\rightarrow$ 창고 검수 $\rightarrow$ 재무 정산) 개요.
  - 핵심 가치 제안: "출고 준비 스펙의 사전 등록을 통한 국제 운송 지연 감소 및 입고 검수 투명성 확보".
- **Bottom Banner:** `Important Terminology Disambiguation` (ARRIVED ≠ RECEIVED, RECEIVED ≠ COMPLETED).

---

### [Page 3] Chapter 1. 선적 및 국제 물류 개요 (Overview & Domain Philosophy)
- **Section 1.1:** K SELECT 물류 파이프라인 및 도메인 아키텍처
  - 다이어그램: `Diagram 7 — Multi-Manual Architecture & Domain Relationship` (ORD ↔ LOG ↔ 창고 입고 ↔ FIN)
  - 설명: 공식 발주 확정(`po_status: APPROVED/SENT`, `supplier_confirmation: CONFIRMED`) 이후 물류와 재무의 독립적 병렬 운영 원칙.
- **Section 1.2:** 운송 책임(Shipping Responsibility) 분기의 이해
  - `LETUSTO_ARRANGED` (FOB / 본사 지정 운송) vs `SUPPLIER_ARRANGED` (DDP / 공급사 자체 운송) 비교표.
- **Callout Box:** `⚠️ IMPORTANT — 계약 운송 조건 사전 확인`.

---

### [Page 4] Chapter 2. 선적 & 출고 관리 허브 둘러보기 (Shipping Hub UI)
- **Section 2.1:** 출고 준비 내역 (Goods Readiness Tab)
  - 스크린샷: `SCR-B-LOG-001.png` (Goods Readiness List) with 4 numbered callout pins.
  - 리스트 컬럼 해설: PO Number, 준비 예정일, 운송 책임, 인계 상태(DRAFT/READY_SUBMITTED/HANDED_OVER), 수량 경고.
- **Section 2.2:** 선적 추적 내역 (Shipments Tab)
  - 스크린샷: `SCR-B-LOG-002.png` (Shipments List) with numbered callout pins.
  - 추적 컬럼 해설: Shipment Number (SHP-XXXX), 운송 주체, 배송사(Carrier), ETD, ETA, 선적 상태.

---

### [Page 5] Chapter 3. 출고 준비 완료 등록 — 기본 정보 및 카고 스펙 (1)
- **Section 3.1:** 발주서(PO) 선택 및 기본 물류 정보 입력
  - 스크린샷: `SCR-B-LOG-003.png` (Header & Logistics Form)
  - 단계별 가이드:
    1. 대상 발주서 선택 (승인/확정 완료된 PO만 노출)
    2. 출고 준비 완료 예정일(`goodsReadyDate`) 지정
    3. FOB 선적항 및 상세 공장 출고지 주소 입력
    4. 현장 담당자 연락처 및 특이사항 작성
- **Callout Box:** `💡 TIP — 정확한 현장 출고지 및 상차 시간대 기재 요령`.

---

### [Page 6] Chapter 3. 출고 준비 완료 등록 — 품목 스펙 및 서류 첨부 (2)
- **Section 3.2:** 품목별 수량 배정 및 실측 카고 스펙 산출
  - 스크린샷: `SCR-B-LOG-004.png` (Packaging Lines & Documents Upload)
  - 4대 패킹 스펙 가이드:
    - Ready Qty (준비 완료 수량 EA)
    - Cartons (총 박스 수)
    - Gross Weight (포장재 포함 총중량 kg)
    - CBM (가로m x 세로m x 높이m x 박스수)
- **Section 3.3:** 필수 무역 서류 첨부: Packing List (P/L) & Commercial Invoice (C/I)
  - Private Storage 보안 및 Signed URL 다운로드 구조 설명.
- **Section 3.4:** 임시 저장(Save Draft) vs 출고 완료 제출(Submit)의 차이.

---

### [Page 7] Chapter 4. 운송 책임별 출고 이행 — Track 1: LETUSTO 지정 운송
- **Section 4.1:** LETUSTO 지정 운송(FOB) 픽업 및 인계 프로세스
  - 다이어그램: `Diagram 2 — Track 1 LETUSTO_ARRANGED Detailed Sequence`
  - 스크린샷: `SCR-B-LOG-005.png` (Readiness Detail — Letusto Track Handover Button)
  - 액션 가이드:
    1. 출고 준비 제출 후 Letusto 포워더 부킹
    2. 포워더 방문 및 실물 화물 수거 (Pickup)
    3. Brand Portal 상세 화면에서 `[물품 인계 완료 (Handed Over)]` 클릭
- **Callout Box:** `💡 TIP — 인계 완료 처리 시 즉시 물류팀에 실시간 동기화`.

---

### [Page 8] Chapter 4. 운송 책임별 출고 이행 — Track 2: SUPPLIER 자체 운송
- **Section 4.2:** 공급사 자체 운송(DDP) 선적 정보 등록
  - 다이어그램: `Diagram 3 — Track 2 SUPPLIER_ARRANGED Detailed Sequence`
  - 스크린샷: `SCR-B-LOG-006.png` (Readiness Detail — Supplier Track Dispatch Form)
  - 입력 필드 가이드:
    - 배송사(Carrier: DHL, FedEx, UPS 등)
    - 송장번호(Tracking Number) 또는 B/L 번호
    - ETD (출발일) 및 ETA (도착예정일)
  - 결과: `[배송 출발 및 선적 등록]` 클릭 시 `inbound_shipments` 자동 생성 및 `IN_TRANSIT` 상태 진입.
- **Section 4.3:** 물품 인계 및 발송 처리 종료 상태
  - 스크린샷: `SCR-B-LOG-007.png` (`handoverStatus === 'HANDED_OVER'`).

---

### [Page 9] Chapter 5. 선적 추적 및 미국 창고 입고 인계 (Inbound & Warehouse)
- **Section 5.1:** 국제 선적 진행 상태 모니터링
  - 다이어그램: `Diagram 5 — Inbound Shipment State Machine` (Logistics: `CREATED` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `ARRIVED` | Handoff | Warehouse Receiving: `PARTIALLY_RECEIVED` / `RECEIVED` $\rightarrow$ `COMPLETED`)
  - 스크린샷: `SCR-B-LOG-010.png` (Admin Inbound Shipment Detail — Reference)
- **Section 5.2:** 미국 창고 도착(Arrival) 및 입고 검수(Receiving Handoff)
  - 다이어그램: `Diagram 6 — Shipping to Warehouse Receiving Handoff Boundary`
  - 스크린샷: `SCR-B-LOG-011.png` (Admin Warehouse Receiving Inspection — Reference)
  - 실물 검수 항목: 정상 입고(`received_qty`), 파손 격리(`damaged_qty`), 보류(`hold_qty`).

---

### [Page 10] Chapter 6. 권한 관리 및 예외 처리 (ACL & Troubleshooting)
- **Section 6.1:** 권한 관리 (Role Permissions)
  - 스크린샷: `SCR-B-LOG-009.png` (Viewer Role Read-Only Restriction)
  - Owner / Admin / Operator vs Viewer (조회자) 권한 비교표.
- **Section 6.2:** 수량 초과 방지 및 경고 (Overage Protection)
  - 스크린샷: `SCR-B-LOG-008.png` (Overage Warning Alert)
  - 가용 수량 초과 입력 시 붉은색 경고 및 서버 예외 차단 로직 설명.

---

### [Page 11-12] Appendix & Quick Reference Guide (부록 및 퀵 레퍼런스)
- **Section A:** 상태 코드 및 용어 사전 (Status Code Reference)
- **Section B:** 패킹 규격(CBM/중량) 계산 공식 및 환산표
- **Section C:** 자주 묻는 질문 (Logistics FAQ Top 8)
- **Section D:** 고객지원 및 문의 채널 안내 (Ask K SELECT)
