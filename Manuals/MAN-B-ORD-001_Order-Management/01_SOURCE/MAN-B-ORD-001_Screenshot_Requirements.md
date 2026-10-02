# MAN-B-ORD-001 — Screenshot Requirements
## K SELECT Brand Portal: Purchase Orders & Order Management (매뉴얼 스크린샷 가이드)

본 문서는 향후 `MAN-B-ORD-001` 공식 매뉴얼(PDF 및 Claude Package) 제작에 필요한 실제 Production 스크린샷의 촬영 규격, 대상 화면, 필수 데이터 조건, 강조 영역 및 챕터 매핑을 정의한다.

---

### Table Format
`ID | Tier | Route | Screen/State | Required Data | Highlight Area | Manual Chapter | Annotation`

---

## 1. Production Screenshot Requirements Inventory

### 🟢 CORE Screenshots (핵심 매뉴얼 필수 수록 — 11개)
| ID | Tier | Route | Screen / State | Required Data | Highlight Area | Manual Chapter | Annotation |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-ORD-01` | **CORE** | `/portal/orders/requests` | 발주 요청 목록 (List View) | 3건 이상의 요청서 (DRAFT, SUBMITTED, CONVERTED_TO_PO) | 상단 '+ 새 발주 요청 작성' 버튼 & 상태 필터 셀렉터 | Chapter 2 | 발주 요청서 목록 및 신규 작성 진입점 안내 |
| `SCR-ORD-02` | **CORE** | `/portal/orders/requests/new` | 신규 발주 요청 작성 폼 (상단) | 유효한 출고지, 담당자, 희망 출고일 입력 상태 | 출고지 선택 드롭다운, 담당자 정보 카드, 희망 Ready Date | Chapter 2 | 출고지 및 담당자 지정 기본 입력 폼 |
| `SCR-ORD-03` | **CORE** | `/portal/orders/requests/new` | 신규 발주 요청 작성 폼 (품목 선택 모달) | 2개 이상의 제품 검색 및 티어 가격이 표시된 모달 | FOB 기본가 및 수량별 티어 가격(Price Tiers) 안내 영역 | Chapter 2 | FOB 티어 가격 자동 연동 및 품목 추가 절차 |
| `SCR-ORD-05` | **CORE** | `/portal/orders/requests/[id]` | 발주 요청 상세 (UNDER_REVIEW / CHANGE_REQUESTED) | `CHANGE_REQUESTED` 상태의 발주 요청서 | 4단계 진행 스테퍼 & 상단 본사 수정 요청 사유 알림 배너 | Chapter 2 | 심사 진행 상태 확인 및 본사 수정 지시 대응 |
| `SCR-ORD-06` | **CORE** | `/portal/orders/requests/[id]` | 발주 요청 상세 (CONVERTED_TO_PO) | `CONVERTED_TO_PO` 상태 및 연결된 PO 번호 | 녹색 축하 배너 & '공식 발주서 보기' 버튼 | Chapter 2 | 공식 발주서(PO)로의 전환 완료 및 바로가기 |
| `SCR-ORD-07` | **CORE** | `/portal/orders/purchase-orders` | 공식 발주서 목록 (List View) | 3건 이상의 공식 발주서 (PO Sent, Confirmed, Shipped, Completed) | 6단계 진행 상태 필터 & 발주 번호/금액 요약 열 | Chapter 3 | 정식 발주서 목록 및 통합 진행 상태 확인 |
| `SCR-ORD-08` | **CORE** | `/portal/orders/purchase-orders/[id]?tab=overview` | 공식 발주서 상세 (Overview / Step 1 PO Sent) | `SENT` 상태 및 `supplier_confirmation_status: PENDING` | 6단계 통합 프로그레스 스테퍼 & 우측 상단 '발주 수락(Confirm PO)' 버튼 | Chapter 3 | 발주서 수신 검토 및 공급사 발주 수락 절차 |
| `SCR-ORD-11` | **CORE** | `/portal/orders/purchase-orders/[id]?tab=shipments` | 공식 발주서 상세 (선적 및 출고 탭) | `Step 2 Supplier Confirmed` 상태의 발주서 | '+ 출고 준비 등록(Goods Ready)' 버튼 및 선적 책임 배지 | Chapter 4 | 생산 완료 후 출고 준비 등록 진입점 |
| `SCR-ORD-12` | **CORE** | `/portal/orders/purchase-orders/[id]?tab=shipments` | Goods Ready 등록 모달 | 품목별 준비수량, 카톤수, 총중량, CBM 입력 상태 | 패킹 규격 입력 필드 및 패킹리스트/상업송장 파일 첨부 영역 | Chapter 4 | 실측 카톤 규격 및 필수 선적 서류 등록 모달 |
| `SCR-ORD-15` | **CORE** | `/portal/orders/purchase-orders/[id]?tab=receiving` | 공식 발주서 상세 (입고 내역 탭) | 입고 검수가 완료(`FINALIZED`)된 검수 레코드 | 정상 입고 수량(Accepted), 파손(Damaged), 홀드(Hold) 수량 카드 | Chapter 5 | 미국 물류센터 실물 입고 검수 결과 확인 |
| `SCR-ORD-16` | **CORE** | `/portal/orders/purchase-orders/[id]?tab=documents` | 공식 발주서 상세 (문서 보관함 탭) | Packing List, Commercial Invoice, B/L 등 등록된 서류 목록 | 문서 유형 선택 드롭다운, 파일 업로드 버튼 및 다운로드 링크 | Chapter 4 & 5 | 무역/통관 필수 문서 통합 보관 및 관리 |

### 🟡 SUPPORTING Screenshots (상세 보조 설명 — 5개)
| ID | Tier | Route | Screen / State | Required Data | Highlight Area | Manual Chapter | Annotation |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-ORD-04` | **SUPPORTING** | `/portal/orders/requests/new` | 신규 발주 요청 작성 폼 (하단 및 요약) | 품목 2개 추가 완료, 라인별 수량/메모 입력 | 총 요청 수량 및 예상 참고 금액(USD) 요약 박스, 임시저장/제출 버튼 | Chapter 2 | 발주 요청 최종 검토 및 제출 액션 |
| `SCR-ORD-09` | **SUPPORTING** | `/portal/orders/purchase-orders/[id]?tab=overview` | 공식 발주서 상세 (Overview / Change Request) | 수락 전 조율 필요 상태 | '변경 요청(Request Change)' 버튼 및 1:1 조율 모달/배너 | Chapter 3 | 수량/단가/납기 조율을 위한 변경 요청 절차 |
| `SCR-ORD-10` | **SUPPORTING** | `/portal/orders/purchase-orders/[id]?tab=overview` | 공식 발주서 상세 (Overview / 품목 및 차이 테이블) | 발주수량, 확정수량, 준비수량, 선적수량, 입고수량이 채워진 라인 | 품목별 수량 흐름 대조 테이블 (Variance 표시) | Chapter 3 | 발주 이행 수량 실시간 대조 내역 |
| `SCR-ORD-13` | **SUPPORTING** | `/portal/orders/purchase-orders/[id]?tab=shipments` | Goods Ready 등록 완료 & 화물 인계 상태 | 등록 완료된 Goods Ready 레코드 | '포워더 화물 인계 보고(Submit Handover)' 버튼 | Chapter 4 | 본사 지정 포워더 픽업 시 화물 인계 보고 절차 |
| `SCR-ORD-14` | **SUPPORTING** | `/portal/orders/purchase-orders/[id]?tab=shipments` | 공급사 직접 선적 등록 폼 (Supplier Arranged) | `SUPPLIER_ARRANGED` 모드의 발주서 | 선사/항공사, B/L, AWB, 추적번호, ETD/ETA 입력 폼 | Chapter 4 | 공급사 자체 운송 시 선적 정보 직접 등록 |

### ⚪ OPTIONAL Screenshots (선택적 참고 화면 — 2개)
| ID | Tier | Route | Screen / State | Required Data | Highlight Area | Manual Chapter | Annotation |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-ORD-17` | **OPTIONAL** | `/portal/orders/purchase-orders/[id]?tab=communication` | 공식 발주서 상세 (소통 및 변경 이력 탭) | 연결된 `partner_inquiries` 케이스 및 리비전 이력 | 케이스 번호, 처리 상태 배지 및 발주 수정 리비전 타임라인 | Chapter 3 | 발주 관련 1:1 소통 및 변경 이력 추적 |
| `SCR-ORD-18` | **OPTIONAL** | `/portal/orders/shipping` | 선적 & 출고 관리 허브 (`/portal/orders/shipping`) | 전체 발주 대상 Goods Ready 내역 및 선적 목록 | 출고 준비 현황 그리드 및 인바운드 선적 추적 탭 | Chapter 4 | 전사 통합 출고 및 운송 현황 대시보드 |

---

## 2. Screenshot Summary by Tier
- **CORE**: 11 Screenshots (매뉴얼 본문 10~12개 목표 부합)
- **SUPPORTING**: 5 Screenshots (심화 팁 및 서브 모달 설명용)
- **OPTIONAL**: 2 Screenshots (부록 및 전체 허브 뷰)
- **Total**: 18 Screenshots

---

## 3. Screenshot Capture Guidelines for Phase 02/03

1. **해상도 및 뷰포트**: 1440 × 900 (Desktop Standard Viewport).
2. **테마**: Light Mode 권장 (문서 출력 및 가독성 최적화).
3. **민감 정보 보호**: 실제 개인정보(전화번호, 개인 이메일)는 테스트 계정 데이터(`support123@letusto.com` 등) 또는 가명 처리된 데이터 사용.
4. **강조 방식**: 빨간색/파란색 둥근 사각 테두리(Bounding Box, 2px) 및 숫자 콜아웃(Numbered Badges ①, ②, ③) 사용.
