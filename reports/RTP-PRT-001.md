# K SELECT DEVELOPMENT HANDOFF REPORT

==================================================
1. TASK OBJECTIVE
==================================================
Task ID: RTP-PRT-001
Title: 90-Day Initial Trial Protection Foundation
Project: K SELECT Retailer Portal
Production URL: https://portal.kselecthub.com
Primary URL: https://portal.kselecthub.com/protection
Status: COMPLETED

The objective of RTP-PRT-001 is to establish the first production-ready foundation for the K SELECT 90-Day Initial Trial Protection Program.
This program provides guaranteed retail reassurance to Retailer partners when adopting new K-Beauty product lines:
- Protection is evaluated at **Retailer Company × Product × Initial Trial** (aggregating all company stores).
- A product receives strictly **ONE Initial Trial Protection** opportunity per Retailer Company.
- If company-wide estimated sell-through is below 50% after the 90-day trial period, the retailer can submit a **Protection Review Request**.

==================================================
2. INITIAL TRIAL BUSINESS RULES
==================================================
1. **Company-Wide Aggregation:** Protection performance combines weekly count velocity across all participating store locations under the retailer company.
2. **50% Performance Threshold:** If estimated sell-through reaches or exceeds 50% of the protected initial quantity, the performance threshold is met (`threshold_met`).
3. **90-Day Trial Window:** The trial runs for 90 days from the explicit trial activation date (`trial_start_date` to `trial_end_date = trial_start_date + 90 days`). Order submission date does NOT automatically start the trial clock.
4. **Fixed Protected Quantity:** The protected quantity represents the original initial placement quantity and does NOT expand upon subsequent reorders.
5. **Reorders Do Not Reset Trial:** Reorders during or after the 90-day period do not create new trial windows or alter the original protected quantity.
6. **First-Trial Only:** Once a trial protection record exists for a Company + Product, the unique constraint `uq_retailer_trial_protection_company_product` strictly prevents duplicate protection records.

==================================================
3. DATA MODEL
==================================================
- **Table:** `public.retailer_initial_trial_protections`
  - `id`: UUID (Primary Key)
  - `company_id`: UUID (FK to `companies.id` ON DELETE CASCADE)
  - `product_id`: UUID (FK to `products.id` ON DELETE CASCADE)
  - `trial_start_date`: DATE (Start of 90-day trial)
  - `trial_end_date`: DATE (Start Date + 90 days)
  - `protected_quantity`: INTEGER (Initial trial quantity covered)
  - `status`: TEXT ('pending_start', 'active', 'threshold_met', 'review_available', 'review_requested', 'needs_review', 'closed')
  - `activation_source`: TEXT ('initial_order', 'manual_admin', 'confirmed_delivery', 'test_seed')
  - `source_order_id`: UUID (Nullable FK to `retailer_orders.id`)
  - `source_delivery_reference`: TEXT (Nullable)
  - `review_requested_at`: TIMESTAMPTZ (Nullable)
  - `review_requested_by`: UUID (Nullable FK to `auth.users.id`)
  - `review_notes`: TEXT (Nullable)
  - `is_test`: BOOLEAN (Default false)
  - `created_at` / `updated_at`: TIMESTAMPTZ
  - **Constraint:** `CONSTRAINT uq_retailer_trial_protection_company_product UNIQUE (company_id, product_id)`

==================================================
4. TRIAL ACTIVATION / DATE MODEL
==================================================
- Date-based calculation avoids timezone skew.
- Trial days elapsed: `max(0, floor((today - trial_start_date) in days))`
- Trial days remaining: `max(0, ceil((trial_end_date - today) in days))`
- Trial period ended: `today >= trial_end_date`

==================================================
5. COMPANY-WIDE MOVEMENT CALCULATION
==================================================
- Authoritative Movement Source: Reuses the movement logic from Weekly Product Checks (`lib/retailer/performance.ts`).
- For each store of the retailer: aggregates units moved between `trial_start_date` and `trial_end_date`.
- Company Estimated Movement: `Sum of store estimated movements`.

==================================================
6. SELL-THROUGH & 50% THRESHOLD
==================================================
- Estimated Sell-Through % = `Math.min(100, Math.round((Company Estimated Movement / Protected Initial Quantity) * 100))`.
- If Estimated Sell-Through >= 50%: Status is `threshold_met` (regardless of days remaining).
- If Estimated Sell-Through < 50% and 90 days completed: Status becomes `review_available` (or `needs_review` if reporting coverage is incomplete).

==================================================
7. DATA COVERAGE HANDLING
==================================================
- Data Reporting Coverage % = `(Stores with submitted Weekly Checks / Total stores carrying product) * 100%`.
- If data coverage is below 50% at day 90: Status is marked as `needs_review` to prevent premature automatic review approval on uncounted stores.

==================================================
8. STATUS MODEL
==================================================
- `pending_start`: Trial scheduled for future start date.
- `active`: Trial in progress (Day 1–89), sell-through < 50%.
- `threshold_met`: Sell-through reached or exceeded 50%.
- `review_available`: 90 days ended, sell-through < 50%, data coverage complete.
- `review_requested`: Retailer Owner/Buyer submitted a review request.
- `needs_review`: Data coverage partial/incomplete.
- `closed`: Trial completed/resolved.

==================================================
9. REVIEW REQUEST FLOW
==================================================
- When status is `review_available`: Retailer Owner/Buyer can click `[🛡️ Request Protection Review]`.
- Retailer can optionally provide merchandising notes.
- Server Action `requestProtectionReviewAction()` verifies authorization, sets `review_requested_at = now()`, `review_requested_by = auth.uid()`, and transitions status to `review_requested`.
- Displays confirmation banner: `✓ Protection Review Requested on {Date}`.

==================================================
10. ROLE / RLS SECURITY
==================================================
- Tenant Isolation: Retailer users can only view and interact with their company's trial protection records (`company_id IN (SELECT company_id FROM company_users WHERE id = auth.uid())`).
- Review Request Authorization: Only users with role `owner` or `buyer` are permitted to submit protection review requests.
- Server-side Data Sanitization: Confidential supplier FOB costs, landed costs, and supplier margins are never transmitted or exposed in protection views.

==================================================
11. TEST DATA
==================================================
Deterministic test scenarios established for `K SELECT Test Retailer` (`dc9249be-a9e0-4975-a4c9-b602bb2baa47`) and the 6 `K SELECT LAB` products:
1. `TEST-SKN-001` (Barrier Repair Ceramide Serum): **Active Trial** (Day 35 of 90, 55 days left, 39% sell-through).
2. `TEST-SKN-002` (Brightening Toner Pads): **Threshold Met** (67% sell-through ≥ 50%).
3. `TEST-SKN-003` (Cooling Eye Patches): **Review Available** (Day 95, 29% sell-through < 50%, full data coverage).
4. `TEST-CLN-001` (Foam Cleanser): **Active Trial** (Day 15 of 90, 75 days left, 17% sell-through).
5. `TEST-HAR-001` (Hair Mask): **Review Requested** (Day 92, 33% sell-through, review requested 2 days ago).
6. `TEST-TRD-001` (Lip & Cheek Balm): **Active Trial** (Day 20 of 90, 70 days left, 23% sell-through).

==================================================
12. DATABASE / MIGRATION
==================================================
- Migration Number: `0104_retailer_initial_trial_protection_foundation.sql`
- Production Applied: YES (Executed in Supabase SQL Editor; schema, unique constraint, and 6 demo records verified)

==================================================
13. DEPLOYMENT
==================================================
- Production URL: `https://portal.kselecthub.com`
- Routes:
  - `/protection`: Overview of all 90-Day Initial Trial Protections with KPI strip, status tabs, search, and progress cards.
  - `/protection/[id]`: Detailed trial performance page with 50% threshold gauge, store location breakdown, and review request CTA.
  - `/sales`: Banner link to `/protection`.

==================================================
14. QA & REGRESSION AUDIT
==================================================
- One Trial per Company × Product Constraint: PASS (Postgres unique constraint 23505 verified)
- 90-Day Trial Date Calculation: PASS
- Protected Quantity Immutability: PASS
- 50% Threshold Recognition: PASS
- Store-by-Store Movement Aggregation: PASS
- Data Coverage & Incomplete Data Safety: PASS
- Protection Review Request Server Action: PASS
- Role-based Authorization: PASS
- TypeScript (`npx tsc --noEmit`): PASS (0 errors)
- Production Build (`npm run build`): PASS (Next.js 16 Turbopack Production Build Success)
- Regression (Training, Weekly Check, Orders, Cart, Tags, Scanner, Sales Analytics): PASS

==================================================
15. USER TEST INSTRUCTIONS
==================================================
1. Login to `https://portal.kselecthub.com`.
2. Open `https://portal.kselecthub.com/protection` (or click `90-Day Protection →` from `/sales`).
3. Verify the 6 demo protection products appear with accurate statuses.
4. Open `TEST-SKN-001` (Barrier Repair Serum): Confirm Active Trial gauge (Day 35 of 90, 55 days left, 36 protected units).
5. Open `TEST-SKN-002` (Brightening Toner Pads): Confirm green `✓ Threshold Met (67%)` badge.
6. Open `TEST-SKN-003` (Cooling Eye Patches): Confirm amber `⚠️ Review Available (29%)` banner with `[🛡️ Request Protection Review]` button.
7. Click `[🛡️ Request Protection Review]` on `TEST-SKN-003`, optionally enter notes, and confirm submission.
8. Verify status updates to `✓ Protection Review Requested` and persists on page reload.
9. Verify the Store Location breakdown table displays store name, movement, remaining quantity, and reporting status.

==================================================
16. ISSUES / RISKS
==================================================
- None. Return logistics, credit issuance, and RMA workflows are cleanly deferred to the subsequent Admin Credit processing phase as planned.

==================================================
17. RECOMMENDED NEXT TASK
==================================================
- **Next Task:** `RTP-PRT-002` (Admin Protection Review & Credit Memo Foundation) or Next Roadmap Priority.
- *Do not begin automatically.*

==================================================
18. IMPORTANT NOTES FOR NEXT AGENT
==================================================
- Migration 0104 is applied in Production Supabase (`shzfrppdobpmrstcjfqu`).
- Table `retailer_initial_trial_protections` manages company-level trial records with unique constraint on `(company_id, product_id)`.
- Reorders do not alter `protected_quantity` or restart the 90-day trial window.
- Report saved to `reports/RTP-PRT-001.md`.
