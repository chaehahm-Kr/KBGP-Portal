# CLAUDE DESIGN HANDOFF PROMPT
## MAN-B-FIN-001 Finance & Settlement Guide

```markdown
# HANDOFF PROMPT: K SELECT Brand Portal Finance Manual Design Handoff & Publishing

This handoff document guides the automated publishing pipeline for **MAN-B-FIN-001 (Finance & Settlement Guide)**.

## 1. Master Design System Alignment
- **Master Reference**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Visual Family**: K SELECT Official Manual Series (Same fonts, card containers, callouts, and table borders as `MAN-B-ORD-001` and `MAN-B-PROD-001`).

## 2. Asset Binding & Verification Check
Prior to publishing, verify that all 13 production screenshot assets exist in `02_SCREENSHOTS/` and match their designated locations:
1. `SCR-B-FIN-001.png` — Chapter 1: Finance Hub Overview
2. `SCR-B-FIN-002.png` — Chapter 2.1: New Invoice PO Selection
3. `SCR-B-FIN-003.png` — Chapter 2.2: New Invoice Form & Lines
4. `SCR-B-FIN-004.png` — Chapter 3.1: Invoice Detail (Draft State)
5. `SCR-B-FIN-005.png` — Chapter 3.2: Invoice Edit (Draft State)
6. `SCR-B-FIN-006.png` — Chapter 3.3: Invoice Detail (Submitted State)
7. `SCR-B-FIN-007.png` — Chapter 4.1: Invoice Detail (Approved & Paid State)
8. `SCR-B-FIN-008.png` — Chapter 4.2: Invoice Detail (Rejected State)
9. `SCR-B-FIN-009.png` — Chapter 5.1: Settlements (Adjustments) Tab
10. `SCR-B-FIN-010.png` — Chapter 5.2: Payments Tab
11. `SCR-B-FIN-011.png` — Appendix A.1: Admin Invoices List (Reference)
12. `SCR-B-FIN-012.png` — Appendix A.2: Admin Invoice Approval (Reference)
13. `SCR-B-FIN-013.png` — Appendix A.3: Admin Payment Execution (Reference)

## 3. Strict Domain Compliance Checks
- **Handoff Mode**: ORD ➔ FIN Parallel Handoff (NOT a sequential chain following LOG receiving).
- **Status Separation**: `InvoiceStatus` (5 states), `PaymentStatus` (3 states), `SettlementStatus` (2 states), `PO Status` (5 states).
- **Single Active Invoice**: Verified DB partial unique index `idx_supplier_invoices_one_active_per_po` + APP pre-check.
- **Adjustments**: `SHORTAGE`, `DAMAGE`, `PRICE_DIFFERENCE`, `OTHER` (`CREDIT` - / `CHARGE` +).
- **Audience**: Primary Brand Portal User focus. Admin operations clearly marked as internal reference.
- **Unsupported Features**: 1:N partial invoicing per PO and automatic PDF conversion marked as unsupported system gaps.

Publish the final HTML/PDF rendering to `03_PUBLISHED/` upon successful verification.
```
