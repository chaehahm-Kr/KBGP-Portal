# CLAUDE DESIGN MASTER PROMPT
## MAN-B-FIN-001 Finance & Settlement Guide

```markdown
# TASK PROMPT: K SELECT Brand Portal Finance & Settlement Manual Design Generation

You are tasked with generating the complete, beautifully formatted, production-grade PDF and HTML Web User Manual for **K SELECT Brand Portal: Finance & Settlement Guide (MAN-B-FIN-001)**.

## 1. Master Design System Reference
All visual styling, typography, color palettes, spacing, UI component containers, step-by-step callouts, and table formats MUST strictly follow:
**`MAN-B-BRAND-001_Brand-Policy_V1.pdf`** as the authoritative **MASTER DESIGN REFERENCE**.

- Primary Color: K SELECT Zinc / Indigo Dark (`#09090B`, `#4F46E5`)
- Accent / Success Color: Emerald (`#059669`)
- Warning / Partial Color: Amber (`#D97706`)
- Typography: Inter / Pretentard, Monospace for identifiers (PO / AP / Invoice numbers)

## 2. Target Audience & Scope Boundaries
- **Primary Audience**: Brand Portal User / Supplier Finance User.
- **Brand Portal Capabilities**: Creating, editing (`DRAFT` state only), deleting (`DRAFT` state only), submitting invoices (`DRAFT` -> `SUBMITTED`), viewing settlement adjustments and payment status.
- **Admin System Capabilities**: Admin screens (`/admin/finance/*`) are provided strictly for **background reference only** to explain the approval (`approveInvoice`), rejection (`rejectInvoice`), voiding (`voidInvoice`), payment execution (`createPayment`), and settlement closure (`closeSettlement`) workflow boundaries.
- **DO NOT** represent Admin-only features as actions accessible to Brand Portal users.

## 3. Strict Technical & Domain Constraints
1. **ORD ➔ FIN Parallel Handoff**:
   - Official PO Confirmation (`supplier_confirmation_status = 'CONFIRMED'` AND `po_status IN ('APPROVED', 'SENT')`) triggers parallel handoff into both **LOG (Shipping & Logistics)** and **FIN (Finance & Settlement)**.
   - Receiving/Inspection is NOT a universal prerequisite for FIN entry.
2. **Disambiguated Status Domains**:
   - `Invoice Status` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`)
   - `Payment Status` (`UNPAID`, `PARTIALLY_PAID`, `PAID`) — computed dynamically from `balance_due` and `amount_paid`.
   - `Settlement Status` (`OPEN`, `SETTLED`) — administrative closing via `closeSettlement`.
   - `PO Status` (`DRAFT`, `APPROVED`, `SENT`, `COMPLETED`, `CANCELLED`).
   - `Invoice Status ≠ Payment Status ≠ Settlement Status ≠ PO Status`.
3. **Single Active Invoice Rule**:
   - Exactly 1 active invoice per PO (`invoice_status NOT IN ('VOID', 'REJECTED')`). Enforced at **BOTH** DB level (partial unique index `idx_supplier_invoices_one_active_per_po`) and App level (`createPortalInvoiceDraft`).
   - Multiple partial invoices per PO are NOT supported.
4. **Adjustments**:
   - `SHORTAGE`, `DAMAGE`, `PRICE_DIFFERENCE`, `OTHER`
   - `CREDIT` (Deduction -) / `CHARGE` (Addition +)
5. **System Gaps**:
   - Explicitly classify 1:N Partial Invoicing and Automatic PDF Invoice Export as **currently unsupported system gaps**. Do not render fake UI controls for them.

## 4. Input Package Files
Use the contents of the following files provided in `02_CLAUDE_PACKAGE/`:
- Content Source: `01_CONTENT/MAN-B-FIN-001_Manual_Content.md`
- Screenshots (13 PNGs): `02_SCREENSHOTS/SCR-B-FIN-001.png` through `SCR-B-FIN-013.png`
- Screenshot Guide: `02_SCREENSHOTS/SCREENSHOT_ANNOTATION_GUIDE.md`
- Diagrams: `03_DIAGRAMS/FINANCE_ARCHITECTURE_DIAGRAMS.md`
- Layout Specification: `MAN-B-FIN-001_Design_Structure.md`

Generate the publication artifact preserving 100% technical fidelity with zero unsupported claims.
```
