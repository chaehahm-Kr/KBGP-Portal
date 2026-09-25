# RTP-ADM-001-R1: Retailer 360 Financial KPI Semantics & Data Integrity Audit Report

## 1. Executive Summary
- **Task ID**: `RTP-ADM-001-R1`
- **Task Name**: Retailer 360 Financial KPI Semantics & Data Integrity Audit
- **Project**: K SELECT Unified Admin (`https://admin.kselectnetwork.com`)
- **Objective**: Audit and correct the Retailer 360 overview financial metrics, terminology, and data integrity so that every displayed number is backed by authoritative Production data without implying accounting precision (such as fake Accounts Receivable or fake Available Credit) that the current system does not possess.
- **Database Migrations**: NO database migrations required (terminology and calculation audit across DAL and Admin UI).

---

## 2. KPI Source-of-Truth & Semantics Audit Table

| Metric | Source Table(s) / Columns | Calculation / Logic | Semantic Meaning & Boundaries |
| :--- | :--- | :--- | :--- |
| **Store Count** | `stores` (`company_id`) | Total count of store records linked to this retailer company. | Total physical storefront locations registered. |
| **Active Users** | `company_users`, `retailer_user_roles` | Count of registered company members. | Active invited & accepted team members. |
| **Submitted Order Value (Gross)** | `retailer_orders.total_amount` | `SUM(total_amount)` for orders where `order_status != 'cancelled'` and `is_test = false`. | **Gross Submitted Wholesale Order Value**. Does **NOT** represent settled revenue or recognized accounting revenue. |
| **Estimated Unpaid Order Value** | `retailer_orders.total_amount`, `payment_status` | `SUM(total_amount)` for active non-test orders where `payment_status IN ('unpaid', 'pending', 'failed', 'processing')`. | **Estimated Order Exposure**. Represents uncollected order totals based on order payment status. Explicitly **NOT** an authoritative Accounts Receivable (A/R) ledger balance. |
| **Approved Credit Limit** | `retailer_profiles.credit_limit`, `approved_terms` | Read directly from `retailer_profiles.credit_limit`. | Commercial underwriting credit ceiling (e.g., $10,000 Net 30). Actual available terms capacity is subject to commercial review; **no fake "Available Credit = Limit - Balance" calculation is displayed**. |
| **Delivered Quantity** | `retailer_order_fulfillment_items.quantity_delivered` | `SUM(quantity_delivered)` across non-cancelled fulfillments. | Authoritative confirmed physical units delivered to stores. |
| **Weekly Coverage** | `retailer_weekly_checks`, `stores` | `(Distinct stores with submitted weekly checks / Total active stores) * 100` | Percentage of active stores submitting regular inventory checks. |
| **Reorder Signals** | `retailer_weekly_checks`, `products` | Count of SKUs where `Weeks of Supply < 2` based on avg weekly movement. | Operational reorder alert count (identical to `/sales` formula). |
| **Training Progress** | `retailer_product_training_progress` | `(Completed modules / (Total modules * Eligible users)) * 100` | Staff knowledge guide completion percentage. |
| **90-Day Protection** | `retailer_initial_trial_protections` | Count of active 90-day trial records. | Number of products under guaranteed trial period. |
| **Open Support Cases** | `partner_inquiries` | Count of cases where `source_type = 'retailer'` and `status NOT IN ('closed', 'resolved')`. | Real active partner support tickets. |

---

## 3. Key Financial Decisions & Corrections

### A. GMV / Order Value Decision
- **Correction**: Replaced ambiguous / misleading "GMV" labels with **"Submitted Order Value (Gross)"**.
- **Scope**: Includes all placed orders in `retailer_orders` where `order_status != 'cancelled'` and `is_test = false`.
- **Disclaimer**: Displayed with clear subtext: *"Gross total of submitted non-cancelled wholesale orders. Does not represent settled or recognized accounting revenue."*

### B. Outstanding Balance Decision
- **Correction**: Replaced "Outstanding Balance" with **"Estimated Unpaid Order Value"**.
- **Scope**: Aggregates orders with `payment_status` of `unpaid`, `pending`, `failed`, or `processing` (excluding test orders).
- **Disclaimer**: Clarified that this represents order-level unpaid exposure, not an authoritative accounting A/R ledger balance.

### C. Credit Limit & Available Credit Decision
- **Correction**: Removed all automatic calculation of `Available Credit = Credit Limit - Outstanding Balance`.
- **Display**: Displays **"Approved Credit Limit"** ($X,XXX) alongside the approved terms (e.g. `NET_30`), with explicit notice: *"Actual available terms capacity is subject to commercial review."*

### D. Order Payment Status Breakdown
- Added an authoritative breakdown card on the Overview tab displaying:
  - **Paid Orders**: Sum & count of orders marked `paid` / `settled`
  - **Pending / Processing**: Sum & count of orders awaiting payment confirmation
  - **Unpaid (Net Terms)**: Sum & count of orders on Net Terms invoice
  - **Failed / Declined**: Sum & count of failed payment attempts
- Config toggles (`payment_method_card_enabled`, `payment_method_ach_enabled`) are strictly displayed as policy flags and not counted as transaction records.

### E. Test Data Isolation
- Orders flagged with `is_test = true` are explicitly excluded from aggregate commercial figures (`submittedOrderValue`, `estimatedUnpaidOrderValue`, and `paidOrderValue`).
- An informative notification banner is displayed when test orders are present for a company.

---

## 4. Needs Attention Action Center Audit
All 5 alert types are verified to trigger strictly from actual database state:
1. **Pending Fulfillment**: Triggers only when non-cancelled orders have unfulfilled or partially fulfilled packages.
2. **Missing Weekly Check**: Triggers only when active stores have no submitted report within the last 10 days.
3. **Pending Commercial Terms**: Triggers when `terms_status === 'pending_review'` or terms requested without admin approval.
4. **Protection Reviews Requested**: Triggers when `retailer_initial_trial_protections` has status `review_requested` or `needs_review`.
5. **Open Support Cases**: Triggers when `partner_inquiries` for this retailer has open tickets requiring response.

---

## 5. Pilot Readiness & Dependency Status
- **RTP-CAS-001-R2 Dependency**: The Retailer 360° workspace correctly renders existing Retailer Case records and deep-links to `/admin/partner-inquiries`. However, the Retailer-facing Case submission modal fixes and creation validations are tracked under `RTP-CAS-001-R2`. This remains an outstanding Pilot-readiness dependency.

---

## 6. QA & Verification Checklist
- **GMV / Order Value Meaning**: PASS (Explicitly labeled as Submitted Order Value Gross)
- **Outstanding Balance Meaning**: PASS (Estimated Unpaid Order Value, no fake ledger balance)
- **No Fake A/R Precision**: PASS (Clearly noted as order payment exposure)
- **Credit Limit Meaning**: PASS (Approved Credit Limit with commercial review disclaimer)
- **No Fake Available Credit**: PASS (No auto-subtracted credit line displayed)
- **Payment Summary**: PASS (Authoritative breakdown by actual order payment status)
- **Test Data Isolation**: PASS (Test orders excluded from commercial metrics)
- **Needs Attention Real Data**: PASS (All alerts derived from real relational state)
- **Retailer Case Deep Links**: PASS (Links to `/admin/partner-inquiries` functioning)
- **TypeScript QA**: PASS (`npx tsc --noEmit` -> 0 errors)
- **Production Build**: PASS (`npm run build` -> Success)
- **Retailer Portal Regression**: PASS (No regression on `/checkout`, `/orders`, `/sales`)
- **Brand Portal Regression**: PASS (No regression on Brand workflows)
