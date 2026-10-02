# MAN-B-FIN-001 — Finance Architecture Diagrams
## K SELECT Brand Portal & Admin: Finance & Settlement (아키텍처 다이어그램 모음)

---

## 1. Parallel Domain Handoff Architecture

```mermaid
flowchart TD
    subgraph ORD["Order Management Domain (MAN-B-ORD-001)"]
        PO_Approve["본사 발주 승인<br/>(po_status: APPROVED/SENT)"] --> PO_Confirm["공급사 발주 수락 완료<br/>(supplier_confirmation_status: CONFIRMED)"]
    end

    PO_Confirm --> PARALLEL_GATE{"공식 발주 수락 완료<br/>(Parallel Domain Gate)"}

    subgraph LOG["LOG / Shipping & Logistics Domain (MAN-B-LOG-001)"]
        PARALLEL_GATE --> GR["Goods Readiness 출고 준비"]
        GR --> Ship["인바운드 선적 & 입고 검수"]
    end

    subgraph FIN["FIN / Finance & Settlement Domain (MAN-B-FIN-001)"]
        PARALLEL_GATE --> Inv_Eligible["인보이스 발행 가능 발주로 식별<br/>(getEligiblePosForInvoice)"]
        Inv_Eligible --> Draft["인보이스 초안 작성<br/>(createPortalInvoiceDraft)"]
        Draft --> Submit["인보이스 제출<br/>(submitPortalInvoice)"]
        Submit --> Approve["본사 승인 / 채무 확정<br/>(approveInvoice)"]
        Approve --> Payment["본사 대금 송금 집행<br/>(createPayment ➔ COMPLETED)"]
        Payment --> Settlement["정산 최종 마감 종결<br/>(closeSettlement: SETTLED)"]
    end
```

---

## 2. Single Active Invoice Dual Enforcement Engine

```mermaid
flowchart TD
    Brand_User["Brand Portal User"] --> Request["인보이스 생성 요청 (/portal/finance/new)"]
    
    Request --> App_Check{"Application Level Pre-Check<br/>(supplier_invoices.invoice_status)"}
    App_Check -- "동일 PO에 NOT IN ('VOID','REJECTED') 존재" --> App_Error["App Exception:<br/>'한 PO당 1개의 활성 인보이스만 작성 가능합니다.'"]
    
    App_Check -- "활성 인보이스 없음" --> DB_Insert["DB INSERT Execution"]
    
    DB_Insert --> DB_Index{"DB Partial Unique Index Enforcement<br/>(idx_supplier_invoices_one_active_per_po)"}
    DB_Index -- "Unique Constraint Violation" --> DB_Error["DB 23505 Error:<br/>'이미 동일한 PO의 활성 인보이스가 존재합니다.'"]
    DB_Index -- "Constraint Passed" --> Success["인보이스 임시저장(DRAFT) 생성 성공"]
```

---

## 3. Disambiguated Status Domain State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Brand User 작성 (createPortalInvoiceDraft)
    DRAFT --> SUBMITTED: Brand User 제출 (submitPortalInvoice)
    DRAFT --> [*]: Brand User 삭제 (deletePortalInvoiceDraft)
    
    SUBMITTED --> APPROVED: Admin 승인 (approveInvoice)
    SUBMITTED --> REJECTED: Admin 반려 (rejectInvoice)
    SUBMITTED --> VOID: Admin 무효화 (voidInvoice)
    
    APPROVED --> VOID: Admin 무효화 (voidInvoice)
    REJECTED --> [*]: PO 활성 해제 ➔ 새 인보이스 생성 가능
    VOID --> [*]: 최종 무효 종결
    
    state "Payment Status (Dynamic Computed)" as PaymentState {
        [*] --> UNPAID: balance_due == invoice_total
        UNPAID --> PARTIALLY_PAID: amount_paid > 0 AND balance_due > 0
        PARTIALLY_PAID --> PAID: balance_due <= 0
        UNPAID --> PAID: 일시 완납 (balance_due <= 0)
    }
    
    state "Settlement Status" as SettlementState {
        [*] --> OPEN: 인보이스 생성 시 기본값
        OPEN --> SETTLED: closeSettlement 실행 (정산 마감)
    }
```

---

## 4. Financial Math & Adjustment Calculation Flow

```mermaid
flowchart LR
    subgraph INPUTS["Input Data"]
        Lines["Invoiced Lines Subtotal<br/>SUM(invoiced_qty * unit_price)"]
        Adjs["Adjustments<br/>SHORTAGE / DAMAGE / PRICE_DIFF"]
        Payments["Completed Payments<br/>SUM(supplier_payments)"]
    end

    subgraph ENGINE["Calculation Engine"]
        Direction{"Adjustment Direction"}
        Direction -- "CHARGE (+)" --> Add["+ adjustment_amount"]
        Direction -- "CREDIT (-)" --> Sub["- adjustment_amount"]
        
        Total["invoice_total = subtotal + adjustmentTotal"]
        Balance["balance_due = invoice_total - amount_paid"]
    end

    subgraph OUTPUTS["Status & Closing Outcomes"]
        Status_Check{"balance_due <= 0 ?"}
        Status_Check -- YES --> PAID["PaymentStatus: PAID"]
        Status_Check -- NO --> UNPAID_PARTIAL["PaymentStatus: UNPAID / PARTIALLY_PAID"]
        PAID --> Close["settlement_status: SETTLED (closeSettlement)"]
    end

    Lines --> Total
    Adjs --> Direction
    Add --> Total
    Sub --> Total
    Total --> Balance
    Payments --> Balance
    Balance --> Status_Check
```

---
