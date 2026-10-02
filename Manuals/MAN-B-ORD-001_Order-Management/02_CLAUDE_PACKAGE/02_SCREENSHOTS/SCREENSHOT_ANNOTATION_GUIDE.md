# MAN-B-ORD-001: Screenshot Annotation & Callout Guide

본 가이드는 `02_SCREENSHOTS/`에 수록된 15개 실제 Production 스크린샷의 번호별 콜아웃(Callout), 강조 영역 및 매뉴얼 본문 캡션 매핑 규칙을 정의합니다.

---

## Screenshot Callout Map

### 1. `SCR-B-ORD-001.png` — 발주 요청 목록 대시보드 (`/portal/orders/requests`)
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **상단 상태 필터**: 전체, DRAFT, SUBMITTED, UNDER_REVIEW, CHANGE_REQUESTED, CONVERTED_TO_PO, REJECTED 탭.
  - ② **새 발주 요청 작성 버튼**: `+ 새 발주 요청 작성` 진입 버튼 (`orders:write` 권한자 전용).
  - ③ **발주 요청 목록 테이블**: 요청 번호, 출고지, 희망 출고일, 품목 수, 총 요청 수량, 진행 상태 배지.
- **본문 배치**: Chapter 2.1 발주 요청 목록

---

### 2. `SCR-B-ORD-002.png` — 신규 발주 요청 작성 폼 상단 (`/portal/orders/requests/new`)
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **출고지 선택 드롭다운**: 기등록된 공급사 창고/출고지 선택 필드.
  - ② **담당자 정보**: 자사 담당자 및 비상 연락처 지정.
  - ③ **희망 출고일 (Desired Ready Date)**: 생산 완료 및 출고 준비 목표 일자 캘린더.
- **본문 배치**: Chapter 2.2 기본 정보 입력

---

### 3. `SCR-B-ORD-003.png` — 품목 추가 모달 및 FOB 티어 가격
- **촬영 규격**: 1440 × 900 (Modal Overlay Viewport)
- **주요 콜아웃**:
  - ① **제품 검색 필터**: 자사 승인 완료 카탈로그 품목 검색바.
  - ② **FOB 티어 단가표**: 주문 수량 구간별 차등 단가 테이블.
  - ③ **권장 MOQ 안내**: 제품별 최소 주문 수량 가이드 및 선택 체크박스.
- **본문 배치**: Chapter 2.3 품목 추가 및 가격 연동

---

### 4. `SCR-B-ORD-004.png` — 발주 요청 수량 요약 및 제출
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **품목별 요청 수량 입력 필드**: 라인별 수량 및 메모 입력창.
  - ② **총 요청 요약 카드**: 총 SKU 수, 총 수량, 참고 예상 금액(USD).
  - ③ **액션 버튼 그룹**: `임시저장 (Save Draft)` 및 `발주 요청 제출 (Submit Request)`.
- **본문 배치**: Chapter 2.4 최종 검토 및 제출

---

### 5. `SCR-B-ORD-005.png` — 본사 수정 요청 배너 및 상세 (`/portal/orders/requests/[id]`)
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **수정 요청 알림 배너**: 본사 MD의 수량/일정 조정 요청 사유 박스.
  - ② **4단계 심사 진행 스테퍼**: Draft $\rightarrow$ Submitted $\rightarrow$ Under Review $\rightarrow$ Converted to PO.
  - ③ **요청서 수정 및 재제출 버튼**: 수정 폼 전환 액션.
- **본문 배치**: Chapter 3.1 심사 상태 및 수정 요청 대응

---

### 6. `SCR-B-ORD-006.png` — 공식 발주서(PO) 전환 완료 상세
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **전환 완료 배지**: `CONVERTED_TO_PO` 상태 및 완료 안내.
  - ② **공식 발주서 번호 링크**: 생성된 `PO-XXXX-XXXX` 하이퍼링크.
  - ③ **공식 발주서 바로가기 버튼**: 발주서 상세 페이지 즉시 이동 버튼.
- **본문 배치**: Chapter 3.2 공식 발주서 전환

---

### 7. `SCR-B-ORD-007.png` — 공식 발주서 목록 대시보드 (`/portal/orders/purchase-orders`)
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **6단계 라이프사이클 필터**: PO Sent, Supplier Confirmed, Goods Ready, In Transit, Delivered, Completed.
  - ② **발주서 요약 카드**: 발주 번호, 공급사명, 발주일자, 총 금액, 인도 조건(Incoterms).
  - ③ **상태별 컬러 배지**: 직관적인 단계별 진행 배지.
- **본문 배치**: Chapter 4.1 공식 발주서 목록

---

### 8. `SCR-B-ORD-008.png` — 발주서 상세 Overview 및 수락 액션
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **6단계 프로그레스 바**: 현재 발주서의 진행 단계 인디케이터.
  - ② **계약 및 물류 기본 정보**: 결제 조건(Payment Terms), 인도 조건, 선적 책임.
  - ③ **발주 수락 (Confirm PO) & 변경 요청 (Request Change)** 버튼 그룹.
- **본문 배치**: Chapter 4.2 발주서 검토 및 수락

---

### 9. `SCR-B-ORD-009.png` — 품목별 수량 흐름 대조 (Variance) 테이블
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **주문 품목 리스트**: 제품명, SKU, 단위 단가, 발주 수량.
  - ② **실시간 수량 흐름 열**: Ordered $\rightarrow$ Confirmed $\rightarrow$ Ready $\rightarrow$ Shipped $\rightarrow$ Received.
  - ③ **차이(Variance) 인디케이터**: 불일치 수량 하이라이트.
- **본문 배치**: Chapter 4.3 품목별 수량 대조

---

### 10. `SCR-B-ORD-010.png` — 선적 및 출고 탭 & Goods Ready 버튼
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **[선적 및 출고] 탭**: 발주 상세 내 선적 관리 전용 뷰.
  - ② **선적 책임 배지**: `LETUSTO_ARRANGED` 또는 `SUPPLIER_ARRANGED`.
  - ③ **`+ 출고 준비 등록 (Goods Ready)` 버튼**: 생산 완료 후 실측 규격 등록 진입점.
- **본문 배치**: Chapter 5.1 출고 준비 등록 진입

---

### 11. `SCR-B-ORD-011.png` — Goods Ready 등록 모달
- **촬영 규격**: 1440 × 900 (Modal Overlay Viewport)
- **주요 콜아웃**:
  - ① **실측 패킹 규격 입력**: 품목별 준비수량, 총 카톤 수, 총 중량(kg), 총 부피(CBM).
  - ② **필수 서류 업로더**: 패킹리스트(P/L) 및 상업송장(C/I) 첨부 필드.
  - ③ **등록 확인 버튼**: `출고 준비 완료 제출 (Submit Goods Ready)`.
- **본문 배치**: Chapter 5.1 실측 패킹 및 서류 등록

---

### 12. `SCR-B-ORD-012.png` — 화물 인계 보고 & 선적 정보 등록
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **포워더 화물 인계 보고 (Handover)**: 본사 지정 운송 시 인계 확정 버튼.
  - ② **공급사 자체 선적 폼**: 선사, B/L, 추적번호, ETD/ETA 입력 폼 (`SUPPLIER_ARRANGED`).
  - ③ **선적 완료 상태 뱃지**: `In Transit` 전환 표시.
- **본문 배치**: Chapter 5.2 선적 책임별 처리

---

### 13. `SCR-B-ORD-013.png` — 물류센터 실물 입고 검수 결과 탭
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **[입고 내역] 탭**: 미국 현지 물류센터 검수 전용 뷰.
  - ② **검수 요약 카드**: 정상 입고(Accepted), 파손(Damaged), 홀드(Hold) 수량.
  - ③ **최종 검수 상태**: `FINALIZED` 확정 배지.
- **본문 배치**: Chapter 6.1 입고 검수 결과 확인

---

### 14. `SCR-B-ORD-014.png` — 무역 및 계약 문서 보관함 탭
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **[문서 보관함] 탭**: PO 관련 모든 서류 통합 보관소.
  - ② **문서 카테고리 목록**: 발주서 PDF, P/L, C/I, B/L, 검수 보고서.
  - ③ **다운로드 및 추가 업로드 버튼**.
- **본문 배치**: Chapter 6.2 문서 통합 보관

---

### 15. `SCR-B-ORD-015.png` — 글로벌 선적 및 출고 허브 (`/portal/orders/shipping`)
- **촬영 규격**: 1440 × 900 (Desktop Viewport)
- **주요 콜아웃**:
  - ① **출고 준비 현황 그리드**: 전사 발주 대상 Goods Ready 목록.
  - ② **인바운드 선적 추적 탭**: 현재 해상/항공 운송 중인 화물 위치 및 ETA.
  - ③ **통합 필터 및 검색바**.
- **본문 배치**: Chapter 7.1 글로벌 선적 허브
