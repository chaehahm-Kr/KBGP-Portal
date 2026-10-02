# MAN-B-ORD-001: Design & Visual Layout Blueprint

## 1. Document Specifications

| Parameter | Value |
| :--- | :--- |
| **Document ID** | `MAN-B-ORD-001` |
| **Document Title** | K SELECT Brand Portal Purchase Orders & Order Management Guide |
| **Document Subtitle** | 브랜드 포털 발주 요청 & 오더 관리 공식 가이드 |
| **Master Reference** | `MAN-BRAND-001 Brand Policy.pdf` |
| **Page Count** | 7 Pages (Target) |
| **Page Size** | Standard A4 Portrait (210mm × 297mm) |
| **Margins** | Top: 20mm, Bottom: 20mm, Left: 18mm, Right: 18mm |
| **Color Palette** | Slate/Zinc Neutral (`#09090b`), Brand Accent (`#059669`, `#3b82f6`, `#f59e0b`, `#f43f5e`) |

---

## 2. Page-by-Page Composition Blueprint

### Page 1: 1. 개요 및 오더 관리 아키텍처 (Order Architecture & Overview)
- **Top Header**: Document Series Tag (`K SELECT USER MANUAL SERIES`), Title, Version `v1.0`, Audience `B — Brand Portal`.
- **Section 1.1**: K SELECT 오더 관리 체계 소개 (발주 요청부터 미국 물류센터 최종 입고/검수까지).
- **Section 1.2**: **Dual-Track PO Architecture (이원화 발주 아키텍처)**
  - *Track A (Brand PO Request)*: 공급사가 필요 시 먼저 발주 요청서를 작성하여 본사에 심사를 요청하는 경로.
  - *Track B (Admin Direct PO)*: 본사 MD가 수요 예측 및 리테일러 공급 계획에 따라 공급사 앞 공식 발주서를 직접 발행하는 경로.
- **Section 1.3**: **중요 경계 원칙 (Cross-Domain Boundary)**
  - `Retail Application Approval ≠ Automatic Purchase Order Creation` (입점 승인은 파트너 자격 획득이며 발주서 자동 발행이 아님).
- **Visual Element**: Mermaid 기반 Dual-Track PO 아키텍처 & 6단계 통합 라이프사이클 다이어그램.

---

### Page 2: 2. 발주 요청(PO Request) 생성 및 관리 (`/portal/orders/requests`)
- **Section 2.1**: 발주 요청 목록 대시보드 구조 및 필터 (`SCR-B-ORD-001.png`).
- **Section 2.2**: 신규 발주 요청 작성 폼 (`SCR-B-ORD-002.png`):
  - 출고지(Ship-from Warehouse) 선택, 공급사 담당자 지정, 희망 출고일(Desired Ready Date).
- **Section 2.3**: 품목 검색 및 FOB 티어 가격 연동 (`SCR-B-ORD-003.png`):
  - 제품 카탈로그 연동, 주문 수량에 따른 FOB Tiered Price 자동 계산 원리.
- **Section 2.4**: MOQ 안내 및 최종 제출 (`SCR-B-ORD-004.png`):
  - MOQ 가이드라인(Warning 안내) 및 임시저장/최종 제출 유효성 검증.

---

### Page 3: 3. 발주 요청 심사 및 공식 발주서(PO) 전환
- **Section 3.1**: 본사 MD 심사 상태 확인 및 수정 요청 대응 (`SCR-B-ORD-005.png`).
- **Section 3.2**: 발주 요청의 공식 발주서 전환(CONVERTED_TO_PO) 및 바로가기 링크 (`SCR-B-ORD-006.png`).
- **Section 3.3**: 발주 요청(PO Request) 상태 머신 및 라이프사이클 정의 테이블.

---

### Page 4: 4. 공식 발주서(Purchase Order) 검토 및 공급사 수락 (`/portal/orders/purchase-orders`)
- **Section 4.1**: 공식 발주서 목록 대시보드 (`SCR-B-ORD-007.png`) 및 6단계 진행 상태 필터.
- **Section 4.2**: 발주서 상세 Overview 및 통합 진행 바 (`SCR-B-ORD-008.png`).
- **Section 4.3**: 공급사 발주 수락(Confirm PO) 및 조건 변경 요청(Request Change) 절차.
- **Section 4.4**: 품목별 수량 흐름 대조(Variance) 테이블 분석 (`SCR-B-ORD-009.png`).

---

### Page 5: 5. 출고 준비 등록(Goods Ready) 및 선적 책임별 물류 처리
- **Section 5.1**: 생산 완료 후 출고 준비 등록(Goods Ready) (`SCR-B-ORD-010.png`, `SCR-B-ORD-011.png`):
  - 실측 패킹 규격(Cartons, Gross Weight, CBM) 및 필수 무역 서류(Packing List, Commercial Invoice) 첨부.
- **Section 5.2**: **선적 책임별 물류 처리 분기**:
  - `LETUSTO_ARRANGED`: 본사 지정 포워더 픽업 및 화물 인계 보고(Submit Handover).
  - `SUPPLIER_ARRANGED`: 공급사 자체 운송사, B/L, 추적번호, ETD/ETA 등록 (`SCR-B-ORD-012.png`).

---

### Page 6: 6. 입고 검수(Receiving & Inspection) 및 문서 보관함
- **Section 6.1**: 미국 물류센터 실물 입고 검수 결과 확인 (`SCR-B-ORD-013.png`):
  - 입고 수량(Accepted), 파손(Damaged), 불일치(Variance) 및 검수 완료 상태.
- **Section 6.2**: 발주 관련 무역/통관 서류 통합 보관함 (`SCR-B-ORD-014.png`).
- **Section 6.3**: Finance(공급사 인보이스) 연계 조건 및 Handoff 기준:
  - `supplier_confirmation_status = 'CONFIRMED'` 조건 충족 시 정산 인보이스 생성 가능 (`MAN-B-FIN-001` 참조).

---

### Page 7: 7. 글로벌 선적 허브 & 자주 묻는 질문 (FAQ)
- **Section 7.1**: 전사 통합 출고 및 선적 허브 (`SCR-B-ORD-015.png`).
- **Section 7.2**: 자주 묻는 질문 (FAQ 8선) — 실무 운영 시 핵심 질문 정리.
- **Section 7.3**: 고객 지원 및 문의 채널 안내 (Inquiry / 고객센터).
