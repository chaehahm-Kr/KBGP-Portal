# MAN-B-FIN-001 — Design Structure & Layout Specification
## K SELECT Brand Portal: Finance & Settlement Guide (디자인 구조 명세서)

---

## 1. Document Architecture & Chapter Layout

```text
MAN-B-FIN-001_Finance-Settlement Guide
├── Document Metadata & Master Reference Notice (MAN-B-BRAND-001)
├── Executive Summary & Core Finance Principles
├── Chapter 1. 정산 관리 개요 & Finance Hub Navigation
│   ├── 1.1 Finance Hub 메인 탭 구조 (Invoices / Settlements / Payments)
│   ├── 1.2 상단 요약 지표 카드 (총 청구액 / 총 집행액 / 미지급 잔액)
│   └── 1.3 검색 & 필터링바 구동 방식
│       └── [Screenshot SCR-B-FIN-001]
├── Chapter 2. 발주 연동 & 인보이스 작성 (Invoice Creation)
│   ├── 2.1 ORD ➔ FIN 병렬 전환 및 자격 발주서(PO) 선택
│   │   └── [Screenshot SCR-B-FIN-002]
│   └── 2.2 품목 청구 수량/단가 입력, 정산 조정 및 송장 증빙 첨부
│       └── [Screenshot SCR-B-FIN-003]
├── Chapter 3. 인보이스 생애주기 관리 (Invoice Lifecycle)
│   ├── 3.1 임시저장(DRAFT) 인보이스 조회, 제출 및 삭제
│   │   └── [Screenshot SCR-B-FIN-004]
│   ├── 3.2 임시저장 인보이스 수정 (DRAFT 한정)
│   │   └── [Screenshot SCR-B-FIN-005]
│   └── 3.3 제출 완료(SUBMITTED) 인보이스 조회 (Read-Only)
│       └── [Screenshot SCR-B-FIN-006]
├── Chapter 4. 인보이스 결재 결과 & 대금 수령
│   ├── 4.1 승인 완료(APPROVED) 인보이스 및 완납(PAID) 수령 확인
│   │   └── [Screenshot SCR-B-FIN-007]
│   └── 4.2 반려 완료(REJECTED) 인보이스 사유 확인 및 재작성 안내
│       └── [Screenshot SCR-B-FIN-008]
├── Chapter 5. 정산 조정 & 대금 지급 추적 (Settlements & Payments)
│   ├── 5.1 정산 조정 내역 추적 (SHORTAGE / DAMAGE / PRICE_DIFFERENCE / OTHER)
│   │   └── [Screenshot SCR-B-FIN-009]
│   └── 5.2 대금 송금 및 지급 완료 내역 확인 (WIRE / ACH / 은행 마스킹 계좌)
│       └── [Screenshot SCR-B-FIN-010]
├── Chapter 6. 도메인 수식 및 기술 제약 사항 (Calculations & Technical Rules)
│   ├── 6.1 3중 정산 수식 엔진 (subtotal, adjustmentTotal, invoice_total, balance_due)
│   ├── 6.2 단일 활성 인보이스 제약 (Enforcement: BOTH)
│   └── 6.3 미구현 기능 명시 (1:N 분할 청구 미지원 / 자동 PDF 변환 미구현)
└── Appendix A. 본사 어드민 검토 절차 [내부 참조용]
    ├── A.1 관리자 인보이스 전체 목록 조회 [Screenshot SCR-B-FIN-011]
    ├── A.2 본사 검토 및 승인/반려/무효화 처리 [Screenshot SCR-B-FIN-012]
    └── A.3 본사 대금 송금 집행 및 정산 종결 [Screenshot SCR-B-FIN-013]
```

---

## 2. Master Design System Layout Components

- **Master Design System Reference**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Component System**:
  - `Header Container`: K SELECT Dark Theme `#09090B` with White Bold Brand Monospace ID.
  - `Callout Alert Cards`:
    - `[NOTE]`: Indigo border `#4F46E5`, bg `#EEF2FF` — 도메인 설명 및 수식 안내
    - `[IMPORTANT]`: Amber border `#D97706`, bg `#FFFBEB` — 단일 활성 인보이스 제약 및 음수 청구 금지
    - `[SYSTEM GAP]`: Zinc border `#71717A`, bg `#F4F4F5` — 미구현 기능 명시 (1:N 분할 청구 / PDF 자동생성 미지원)
  - `Status Badge Colors`:
    - `DRAFT`: Zinc (`#71717A`)
    - `SUBMITTED`: Blue (`#2563EB`)
    - `APPROVED` / `PAID`: Emerald (`#059669`)
    - `REJECTED`: Rose (`#E11D48`)
    - `UNPAID` / `OPEN`: Amber (`#D97706`)

---
