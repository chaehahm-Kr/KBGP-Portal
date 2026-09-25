# K SELECT DEVELOPMENT HANDOFF REPORT

## Task
- Task ID: RTP-PAY-001-R1
- Task Name: Payment URL, Due-Date Semantics & Provider Readiness Correction

## 1. Domain / Clean URL Verification
- Retailer Portal Canonical Domain: `https://portal.kselecthub.com`
- Brand Portal Canonical Domain: `https://portal.kselectnetwork.com`
- Unified Admin Canonical Domain: `https://admin.kselectnetwork.com`
- Browser-facing Clean URLs:
  - `https://portal.kselecthub.com/checkout` (Clean /checkout)
  - `https://portal.kselecthub.com/orders` (Clean /orders)
  - `https://portal.kselecthub.com/orders/[orderNumber]` (Clean /orders/[id])
  - `https://portal.kselecthub.com/products`
  - `https://portal.kselecthub.com/check`
  - `https://portal.kselecthub.com/sales`
  - `https://portal.kselecthub.com/tags`
  - `https://portal.kselecthub.com/training`
- No browser-facing `/retailer/*` prefixes are exposed in client navigation or URLs. All internal routing seamlessly maps via Next.js proxy rewrite on `portal.kselecthub.com`.

## 2. Payment Provider Status
- Card Provider Configured: NO (`isCardProviderConfigured = false`)
- ACH Provider Configured: NO (`isAchProviderConfigured = false`)
- Method Eligibility (`card_enabled`, `ach_enabled`) is clearly separated from live provider processing integration.

## 3. Card / ACH Behavior
- Since no live PG credentials (e.g. Stripe, Plaid) are connected in this phase:
  - Orders submitted with Card or ACH are never automatically marked as paid.
  - Payment status is recorded as `unpaid` (Order Recorded — Pending Dispatch & Fulfillment).
  - Checkout UI renders an explicit notice: *"Online payment processing setup pending — order placed as Unpaid for invoice / manual settlement."*
  - No fake payment transaction records or charges are simulated.

## 4. Net Terms Due-Date Rule
- Currently, K SELECT does not have an automated post-dispatch invoice issuance workflow.
- Net Terms orders (Net 15, Net 30, Net 45, Net 60) calculate a reference due date as `Order Date + N Days`.
- This is explicitly displayed across the Retailer Checkout, Order Detail, and Admin views as:
  **Estimated Due Date (Provisional based on Order Date — formal invoice issued upon dispatch)**.
- It is not presented as a legally finalized invoice due date.

## 5. Credit Limit Semantics
- In the absence of an authoritative Accounts Receivable (A/R) invoice ledger:
  - The UI displays **Approved Credit Limit: $X,XXX USD** (or Authorized Open Terms).
  - Explicitly states: *"Total credit exposure is subject to commercial review and unbilled/unpaid invoice settlement."*
  - Avoids claiming an exact real-time unbilled balance calculation until the future A/R engine is developed.

## 6. Payment History Safety
- Table `retailer_order_payments` is strictly a settlement and audit log.
- No fabricated transactions are inserted upon Card/ACH order creation.
- Admin manual payments are explicitly recorded with `provider = 'manual'` and appropriate notes.
- Historical order line snapshots, wholesale prices, and order totals remain completely immutable.

## 7. Database / Migration
- Migration 0107 is already Production history.
- No schema alterations or additional migrations were required; this correction was achieved through application-layer URL hygiene, provider readiness flags, and semantic precision.

## 8. QA / Regression
- Retailer Canonical Domain (`portal.kselecthub.com`): PASS
- Clean `/checkout` URL: PASS
- Clean `/orders` URL: PASS
- No browser-facing `/retailer` routes: PASS
- Net Terms Due-Date Meaning (Provisional): PASS
- Provider Readiness Explicit: PASS
- No Fake Card Success: PASS
- No Fake ACH Success: PASS
- Net Terms Unpaid State: PASS
- Credit Limit Language: PASS
- FOB Never Used (`resolveAuthoritativeWholesalePrice` enforced): PASS
- Order / Payment Status Separation: PASS
- Admin Regression: PASS (0 errors)
- Brand Portal Regression: PASS (0 errors)

## 9. Issues / Risks
- None. Production build and type checking passed with 0 errors.

## 10. Recommended Next Task
- **RTP-FUL-001**: Order Fulfillment & Delivered Quantity Foundation (Admin warehouse pick/pack, shipment dispatch, tracking numbers, and Retailer delivery confirmation).

## Final Integrity
- Local HEAD = origin/main = Vercel Production = Custom Domain Runtime: YES
- Production Supabase Migration Applied & Schema Verified: YES (Migration 0107 verified)

## Final Status
COMPLETE
