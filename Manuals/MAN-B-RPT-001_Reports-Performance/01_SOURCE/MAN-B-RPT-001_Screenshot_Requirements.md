# MAN-B-RPT-001 — Screenshot Requirements Specification
## Reports & Performance Guide (01_SOURCE)

- **Manual ID:** `MAN-B-RPT-001`
- **Document Name:** `Screenshot Requirements Specification`
- **Audience:** `B` (Brand Portal Users & Manual Editors)
- **Effective Date:** 2026-10-01
- **Status:** `APPROVED CANONICAL SOURCE`

---

## 1. Screenshot Inventory & Priority Classification

본 매뉴얼을 위한 스크린샷 요구사항은 실사용자에게 가장 직관적인 성과 분석 및 모니터링 가이드를 제공할 수 있도록 **P0(핵심 화면)**, **P1(보조 화면)**, **P2(어드민 연계 화면)**의 3단계로 엄격히 분류됩니다.

| Screenshot ID | Priority | Production URL | Title & Core Subject | Manual Chapter Mapping |
| :--- | :---: | :--- | :--- | :---: |
| **SCR-B-RPT-001** | **P0 CORE** | `/portal` | **브랜드 포털 메인 운영 대시보드 (Operational Dashboard)**<br>- 발주/정산/제품/문의 4대 KPI 요약 카드 그리드 전체 화면 | 제1장: 성과 모듈 개요 & 제2장: 대시보드 KPI |
| **SCR-B-RPT-002** | **P0 CORE** | `/portal` | **실시간 긴급 조치 큐 (Action Required Queue)**<br>- URGENT(빨강), DUE_SOON(주황), NORMAL(파랑) 우선순위 배지 및 액션 버튼 | 제2장: 일일 건강성 진단 & 조치 큐 |
| **SCR-B-RPT-003** | **P0 CORE** | `/portal/orders/purchase-orders` | **발주 파이프라인 성과 요약 카드 (PO Pipeline Hub)**<br>- 5대 상태 집계(전체, 생산 중, 출고 준비, 입고 검수, 완료) & 90일 기간 필터 | 제3장: 발주 성과 & 파이프라인 분석 |
| **SCR-B-RPT-004** | **P1 SUPPORTING** | `/portal/orders/purchase-orders` | **발주 상태 필터 칩 및 정렬 기능 (PO Filter & Sort)**<br>- 상태 칩 다중 선택 및 최신순/금액순 정렬 드롭다운 | 제3장: 발주 성과 & 파이프라인 분석 |
| **SCR-B-RPT-005** | **P0 CORE** | `/portal/finance` | **정산 및 인보이스 실적 요약 화면 (Finance Tracking)**<br>- 총 청구액, 지급 완료액, 미지급 잔액 및 인보이스 목록 | 제4장: 재무 정산 & 자금 흐름 모니터링 |
| **SCR-B-RPT-006** | **P1 SUPPORTING** | `/portal/products` | **제품 등록 완성도 지표 및 보완 알림 (Catalog Readiness)**<br>- Complete vs Draft 뱃지 및 누락 필수 스펙 경고 | 제5장: 카탈로그 완성도 감사 |
| **SCR-B-RPT-007** | **P1 SUPPORTING** | `/portal/support` | **1:1 고객지원 문의 처리 현황 (Support Resolution)**<br>- 미종결 문의, 파트너 회신 대기 뱃지 및 상태 필터 | 제6장: 지원 성과 & 어드민 동기화 |
| **SCR-B-RPT-008** | **P2 OPTIONAL** | `/admin/purchasing/dashboard` | **어드민 전사 발주 대시보드 (Admin Purchasing Dashboard)**<br>- 공급사별/SKU별 성과 집계 및 날짜 프리셋 필터 | 제6장: 지원 성과 & 어드민 동기화 |

---

## 2. Detailed Screenshot Specifications

### 2.1 SCR-B-RPT-001: Operational Dashboard Overview (P0 CORE)
- **Production URL:** `https://portal.kselectnetwork.com/portal`
- **Visible State:** 브랜드 포털 로그인 후 메인 대시보드 첫 화면.
- **Required Data State:**
  - 활성 발주서 1건 이상, 발행된 인보이스 1건 이상, 등록된 제품 3건 이상(Complete 및 Draft 포함), 1:1 문의 1건 이상 존재하는 정상 운영 상태.
- **Important Visual Area:**
  - 상단 4대 영역 KPI 카드 (발주, 정산, 제품, 문의).
- **Annotation & Highlight Requirements:**
  - 박스 1: 발주 파이프라인 KPI (진행 중 / 출고 준비 / 입고 검수)
  - 박스 2: 정산 및 재무 KPI (총 청구액 / 지급 완료 / 미지급 잔액)
  - 박스 3: 카탈로그 완성도 KPI (등록 완료 / 보완 필요)
  - 박스 4: 문의 처리 현황 (미종결 / 회신 대기)
- **Manual Mapping:** 제1장 & 제2장

---

### 2.2 SCR-B-RPT-002: Action Required Queue & Priority Badges (P0 CORE)
- **Production URL:** `https://portal.kselectnetwork.com/portal`
- **Visible State:** 대시보드 상단 'Action Required (조치 필요)' 섹션 포커스.
- **Required Data State:**
  - `URGENT` 배지(발주서 수락 대기 또는 연체 인보이스) 및 `DUE_SOON` 배지(출고 패킹 등록 대기)가 포함된 2~3개 이상의 조치 필요 카드.
- **Important Visual Area:**
  - 우선순위 색상 뱃지, 발주/인보이스 참조 번호, 액션 바로가기 버튼.
- **Annotation & Highlight Requirements:**
  - 뱃지 하이라이트: 빨간색 `URGENT` 및 주황색 `DUE_SOON`
  - 버튼 하이라이트: 우측 원클릭 조치 이동 버튼
- **Manual Mapping:** 제2장

---

### 2.3 SCR-B-RPT-003: PO Pipeline Performance Summary (P0 CORE)
- **Production URL:** `https://portal.kselectnetwork.com/portal/orders/purchase-orders`
- **Visible State:** 발주 관리 메인 화면 상단 영역.
- **Required Filters:** 기본 `Last 90 Days` 날짜 범위 적용.
- **Important Visual Area:**
  - 상단 5개 요약 박스 (전체 진행 중, 생산 중, 출고 준비, 입고/검수, 완료).
- **Annotation & Highlight Requirements:**
  - 상단 5대 라이프사이클 카드 숫자 강조 표시.
  - 우측 상단 날짜 범위 선택기 (Last 90 Days) 하이라이트.
- **Manual Mapping:** 제3장

---

### 2.4 SCR-B-RPT-004: PO Filter Chips & Table Sorting (P1 SUPPORTING)
- **Production URL:** `https://portal.kselectnetwork.com/portal/orders/purchase-orders`
- **Visible State:** 발주 목록 필터 칩 선택 및 테이블 정렬 컨트롤.
- **Required Filters:** `IN_PRODUCTION` 및 `READY_TO_SHIP` 칩 활성화 상태.
- **Important Visual Area:**
  - 상태 칩 바, 검색창, 정렬 드롭다운 (Newest / Oldest / Amount).
- **Annotation & Highlight Requirements:**
  - 상태 칩 토글 버튼 및 정렬 드롭다운 강조.
- **Manual Mapping:** 제3장

---

### 2.5 SCR-B-RPT-005: Finance & Settlement Performance Summary (P0 CORE)
- **Production URL:** `https://portal.kselectnetwork.com/portal/finance`
- **Visible State:** 정산 관리 메인 화면.
- **Required Data State:**
  - 발행 인보이스 총액, 지급 완료액, 미지급 잔액(Balance Due)이 표시된 요약 카드 및 인보이스 목록.
- **Important Visual Area:**
  - 상단 재무 요약 배너 및 인보이스 상태 뱃지 (PAID / PARTIAL / UNPAID).
- **Annotation & Highlight Requirements:**
  - 미지급 잔액 및 지급 기한(Due Date) 칼럼 하이라이트.
- **Manual Mapping:** 제4장

---

### 2.6 SCR-B-RPT-006: Product Catalog Completeness & Issue Alerts (P1 SUPPORTING)
- **Production URL:** `https://portal.kselectnetwork.com/portal/products`
- **Visible State:** 제품 관리 목록 화면.
- **Required Data State:**
  - 녹색 `COMPLETE (등록 완료)` 뱃지 제품과 주황색 `Draft (보완 대기)` 뱃지 제품이 함께 표시된 상태.
- **Important Visual Area:**
  - 상태 칼럼 및 누락 필드 안내 배너.
- **Annotation & Highlight Requirements:**
  - `COMPLETE` 및 `Draft` 상태 뱃지 비교 표시.
- **Manual Mapping:** 제5장

---

### 2.7 SCR-B-RPT-007: Support Case Resolution Tracking Cards (P1 SUPPORTING)
- **Production URL:** `https://portal.kselectnetwork.com/portal/support`
- **Visible State:** 문의 지원 메인 화면.
- **Required Data State:**
  - 열린 문의(Open Cases) 및 파트너 회신 대기(Action Required) 건이 포함된 목록.
- **Important Visual Area:**
  - 상태 필터 탭 (전체 / 답변 대기 / 처리 중 / 완료) 및 티켓 카드.
- **Manual Mapping:** 제6장

---

### 2.8 SCR-B-RPT-008: Admin Purchasing Dashboard & Supplier Performance (P2 OPTIONAL)
- **Production URL:** `https://admin.kselectnetwork.com/admin/purchasing/dashboard`
- **Visible State:** 어드민 발주 현황 대시보드.
- **Required Filters:** 당월(`this_month`) 또는 최근 90일 필터.
- **Important Visual Area:**
  - 전사 발주 KPI, 공급사별 실적 테이블(Supplier Summary), SKU별 실적 테이블(Product Summary).
- **Annotation & Highlight Requirements:**
  - 공급사별 발주 건수, 미입고 수량, 정산 지급 현황 칼럼 강조.
- **Manual Mapping:** 제6장
