# SCREENSHOT ANNOTATION GUIDE: MAN-B-RPT-001
## Reports & Performance High-Resolution Screenshot Annotations & Callouts

- **Manual ID:** `MAN-B-RPT-001`
- **Topic:** `Reports & Performance (성과 분석, 대시보드 KPI 및 운영 지표)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-01

---

## 1. SCR-B-RPT-001: Operational Dashboard Overview
- **File:** `SCR-B-RPT-001.png`
- **Route:** `/portal`
- **Title:** 브랜드 포털 메인 운영 대시보드 (Operational Dashboard Overview)
- **Callout Pins:**
  - `(1)`: 발주 파이프라인 KPI 요약 카드 (진행 중 발주서, 출고 준비, 입고 검수)
  - `(2)`: 재무 및 정산 실적 카드 (총 청구액, 정산 완료액, 미지급 잔액, 연체 잔액)
  - `(3)`: 카탈로그 완성도 지표 (등록 완료 vs 보완 대기 SKU)
  - `(4)`: 고객지원 문의 현황 (미종결 문의, 파트너 회신 대기)

---

## 2. SCR-B-RPT-002: Action Required Queue & Priority Badges
- **File:** `SCR-B-RPT-002.png`
- **Route:** `/portal`
- **Title:** 긴급 조치 큐 (Action Required Queue)
- **Callout Pins:**
  - `(1)`: `URGENT` 빨간색 우선순위 뱃지 (발주서 미확정, 연체 인보이스)
  - `(2)`: `DUE_SOON` 주황색 뱃지 (출고 패킹 정보 등록 대기)
  - `(3)`: 업무 참조 번호 및 핵심 병목 설명 (PO 번호, 인보이스 번호)
  - `(4)`: 원클릭 조치 바로가기 버튼 (`발주서 확인`, `인보이스 확인`)

---

## 3. SCR-B-RPT-003: PO Pipeline Performance Summary
- **File:** `SCR-B-RPT-003.png`
- **Route:** `/portal/orders/purchase-orders`
- **Title:** 발주 파이프라인 성과 요약 카드 (PO Pipeline Hub)
- **Callout Pins:**
  - `(1)`: 상단 5대 발주 성과 집계 카드 (전체 진행, 생산 중, 출고 준비, 입고 검수, 완료)
  - `(2)`: 기본 90일 기간 필터 (`Last 90 Days`) 및 커스텀 날짜 선택기
  - `(3)`: 발주 목록 테이블 헤더 및 상태 칩 요약
  - `(4)`: 공급사별 총 발주 금액 및 미입고 잔량 표시

---

## 4. SCR-B-RPT-004: PO Filter Chips & Table Sorting
- **File:** `SCR-B-RPT-004.png`
- **Route:** `/portal/orders/purchase-orders`
- **Title:** 발주 상태 필터 칩 및 테이블 정렬 (PO Filter & Sort)
- **Callout Pins:**
  - `(1)`: 공정 단계별 상태 칩 (`생산 중`, `출고 준비`, `선적 운송`, `입고 검수`, `완료`, `취소`)
  - `(2)`: 발주서 검색창 (PO 번호, 상품명, SKU 검색)
  - `(3)`: 정렬 드롭다운 (최신순, 과거순, 금액 높은순, 금액 낮은순)
  - `(4)`: 필터링된 발주 상세 목록 및 품목 수 요약

---

## 5. SCR-B-RPT-005: Finance & Settlement Performance Summary
- **File:** `SCR-B-RPT-005.png`
- **Route:** `/portal/finance`
- **Title:** 정산 및 인보이스 실적 요약 (Finance & Settlement Summary)
- **Callout Pins:**
  - `(1)`: 상단 재무 총괄 요약 카드 (총 청구액, 지급 완료액, 미지급 잔액)
  - `(2)`: 인보이스 상태 뱃지 (`PAID`, `PARTIAL`, `UNPAID`)
  - `(3)`: 계약 지급 기한(Due Date) 및 지급일 경과 알림
  - `(4)`: 인보이스 상세 조회 및 조정 내역(Adjustment) 확인 버튼

---

## 6. SCR-B-RPT-006: Product Catalog Completeness & Issue Alerts
- **File:** `SCR-B-RPT-006.png`
- **Route:** `/portal/products`
- **Title:** 제품 등록 완성도 지표 및 보완 알림 (Catalog Completeness Audit)
- **Callout Pins:**
  - `(1)`: `COMPLETE` 녹색 등록 완료 뱃지 (28대 기준 통과)
  - `(2)`: `Draft` 주황색 보완 대기 뱃지
  - `(3)`: 상단 필수 스펙 누락 안내 배너
  - `(4)`: 제품 상세 수정 화면 이동 버튼

---

## 7. SCR-B-RPT-007: Support Case Resolution Tracking
- **File:** `SCR-B-RPT-007.png`
- **Route:** `/portal/support`
- **Title:** 1:1 고객지원 문의 처리 현황 (Support Resolution Tracking)
- **Callout Pins:**
  - `(1)`: 상태 필터 탭 (전체, 답변 대기, 처리 중, 완료)
  - `(2)`: 파트너 회신 대기(`Action Required`) 강조 뱃지
  - `(3)`: 문의 유형(정산, 발주, 시스템) 및 접수 일시
  - `(4)`: 신규 1:1 문의 접수 버튼

---

## 8. SCR-B-RPT-008: Admin Purchasing Dashboard & Supplier Performance
- **File:** `SCR-B-RPT-008.png`
- **Route:** `/admin/purchasing/dashboard`
- **Title:** 어드민 전사 발주 대시보드 (Admin Purchasing Dashboard)
- **Callout Pins:**
  - `(1)`: 전사 발주 KPI 요약 (총 발주 건수, 총 금액, 미입고 잔량)
  - `(2)`: 날짜 프리셋 필터 (당월, 전월, 당분기, 커스텀)
  - `(3)`: 공급사별 실적 집계 테이블 (Supplier Summary)
  - `(4)`: SKU별 주문 수량 및 미입고 잔량 테이블 (Product Summary)

---
*End of SCREENSHOT_ANNOTATION_GUIDE.md*
