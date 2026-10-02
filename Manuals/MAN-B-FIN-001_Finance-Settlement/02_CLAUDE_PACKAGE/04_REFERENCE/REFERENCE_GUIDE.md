# MAN-B-FIN-001 — Reference Guide & Master Assets
## K SELECT Brand Portal: Finance & Settlement (브랜드 참조 가이드 & 마스터 자산)

---

## 1. Master Design System Reference
- **Master Reference File**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Application Guidelines**:
  - All visual assets, manual headers, typography, color themes, and alert cards used for publishing **MAN-B-FIN-001** MUST strictly comply with the design definitions established in `MAN-B-BRAND-001`.
  - Color Palette:
    - Dark Brand Background: `#09090B`
    - Brand Primary Accent: `#4F46E5` (Indigo)
    - Success / Paid Accent: `#059669` (Emerald)
    - Warning / Unpaid Accent: `#D97706` (Amber)
    - Alert / Rejected Accent: `#E11D48` (Rose)

---

## 2. Technical Code & Schema Reference Mapping

| Reference Asset Name | Primary Code Location | Description |
| :--- | :--- | :--- |
| `supplier_invoices` Table | `supabase/migrations/0061_supplier_invoices.sql` | 인보이스 헤더 테이블 스키마 |
| `supplier_invoice_lines` Table | `supabase/migrations/0061_supplier_invoices.sql` | 인보이스 품목 라인 테이블 스키마 |
| `supplier_invoice_adjustments` Table | `supabase/migrations/0063_supplier_invoice_adjustments.sql` | 수량부족/파손 정산 조정 스키마 |
| `supplier_payments` Table | `supabase/migrations/0064_supplier_payments.sql` | 대금 송금 집행 및 이체 스키마 |
| Partial Unique Index | `supabase/migrations/0095_invoice_remittance_and_case_link.sql` | `idx_supplier_invoices_one_active_per_po` 유일 인덱스 |
| Portal Server Actions | `lib/portal/actions.ts` | Brand Portal 인보이스 생성/수정/제출/조회 |
| Admin Server Actions | `lib/supplier-invoice/actions.ts` & `lib/supplier-payment/actions.ts` | Admin 인보이스 승인/반려/무효화 및 대금 집행 |

---

## 3. Approved Terminology Glossary

- **Supplier Invoice (청구 인보이스 / 송장)**: 공급사(Brand)가 본사에 대금을 청구하기 위해 작성 및 발행하는 문서.
- **Internal AP Number (내부 AP 번호)**: 본사 시스템 내부에서 인보이스 관리를 위해 자동 부여하는 관리 번호.
- **Adjustment (정산 조정)**: 입고 검수 시 발생한 수량 부족(`SHORTAGE`), 파손(`DAMAGE`), 단가 차액(`PRICE_DIFFERENCE`)에 대한 감액(`CREDIT`) 또는 증액(`CHARGE`) 처리.
- **Balance Due (미지급 잔액)**: 인보이스 청구 총액(`invoice_total`) 중 본사가 아직 이체하지 않은 잔여 미지급 금액.
- **Settlement Closing (정산 종결)**: 인보이스 대금 완납 및 조정 처리가 완료되어 정산 파일을 마감/동결하는 행정적 절차.

---
