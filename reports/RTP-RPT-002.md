# K SELECT DEVELOPMENT HANDOFF REPORT

==================================================
1. TASK OBJECTIVE
==================================================
Task ID: RTP-RPT-002
Title: Company Product Performance, Estimated Sales & Reorder Recommendations
Project: K SELECT Retailer Portal
Target URL: https://portal.kselecthub.com/sales
Status: COMPLETED

The objective of this task is to establish the first functional Retailer Product Performance & Reorder reporting experience, transforming weekly product check counts into actionable commercial velocity, estimated retail sales, estimated gross margins, supply runout timelines, and automated MOQ-rounded reorder recommendations across multi-store organizations.

==================================================
2. WHAT WAS REVIEWED / DONE
==================================================
1. **Designed & Built Retailer Performance Data Access Layer (`lib/retailer/performance.ts`):**
   - Derived multi-store company-level demand signals (`RETAILER COMPANY × PRODUCT`).
   - Built interval-based movement calculation handling Baseline counts, Provisional movements (pending delivery tracking), Confirmed deliveries, and Negative variance reviews.
   - Centralized velocity estimation (`averageWeeklyMovement`), approximate weeks of supply (`approxWeeksOfSupply`), and demand target calculation (`TARGET_WEEKS_OF_SUPPLY = 4`).
   - Implemented MOQ and carton case-pack rounding for suggested reorders.
   - Enforced confidential pricing security: Retailer Gross Profit uses confidential Wholesale Purchase Cost; Supplier FOB and sourcing costs are never accessed or exposed.
   - Built reporting coverage metrics (`dataCoverage`) and role-based visibility controls (hiding gross margins from store employees).

2. **Built Mobile-First Performance Dashboard (`components/retailer/sales-performance-dashboard.tsx`):**
   - Header with period filters (`Last 7 Days`, `Last 30 Days` [Default], `Last 90 Days`, `All Time`) and Store-level / Company-wide view switcher.
   - Data Coverage & Price Basis Banner informing users about store reporting percentages and MSRP basis.
   - Top KPI cards: Estimated Units Moved, Estimated Retail Sales @ SRP, Estimated Gross Profit, Gross Margin %, and Reorder Alerts.
   - Responsive presentation: High-density data table on Desktop and touch-friendly Product Performance Cards on Mobile.
   - Direct `[+ Add {qty} to Cart]` integration utilizing `useCart().addItem()` to snap to MOQ multiples.

3. **Built Product Detail Breakdown (`components/retailer/product-performance-detail-view.tsx` & `/sales/[id]`):**
   - Clean dynamic routing at `/sales/[id]`.
   - Comprehensive Company-level demand summary and 4-week supply target breakdown.
   - Store-by-Store comparative performance table/cards for operational distribution insights.
   - Clear estimation methodology footnote.

4. **Integrated Real-Time Demand Snapshot into Home Page (`app/retailer/page.tsx`):**
   - Displaying Last 30 Days Estimated Movement, Retail Value, Gross Profit, and Reorder SKU alerts.

==================================================
3. KEY FINDINGS / DECISIONS
==================================================
- **Company Demand Signal Priority:** Demand and replenishment suggestions are aggregated at the Company level across all branch stores, preventing isolated inefficient ordering while still providing Store-by-Store breakdown for distribution visibility.
- **Retail Price Basis Disclosure:** Because store tagged POS pricing is not yet implemented, retail sales are clearly labeled as `Estimated Retail Sales @ Suggested Retail Price (MSRP)`.
- **Wholesale Price Integrity:** Gross profit is calculated strictly against approved Retailer Wholesale Price (`product_curations.wholesale_price`). Supplier FOB costs remain 100% confidential.
- **Defensible Negative Variance Handling:** When a store reports higher stock than previous without tracked delivery, the interval is flagged as `Variance Review` rather than depressing total sales.
- **Target Weeks Configuration:** Configurable default `TARGET_WEEKS_OF_SUPPLY = 4`, with suggested reorders automatically rounded up to carton case pack / MOQ.
- **No Redundant Database Tables:** Calculated dynamically on server from authoritative `retailer_weekly_checks` and `retailer_weekly_check_items` without persisting redundant dashboard state.

==================================================
4. CHANGES MADE
==================================================
Files Created:
- `lib/retailer/performance.ts`: Core Retailer Performance DAL
- `components/retailer/sales-performance-dashboard.tsx`: Main reporting dashboard
- `components/retailer/product-performance-detail-view.tsx`: Product performance & store breakdown
- `app/retailer/sales/[id]/page.tsx`: Dynamic product detail page
- `reports/RTP-RPT-002.md`: Task handoff report

Files Modified:
- `app/retailer/sales/page.tsx`: Dynamic server component connecting DAL to dashboard
- `app/retailer/page.tsx`: Home page demand summary snapshot

Database / Schema Changes:
- None required (Derived from existing production tables: `retailer_weekly_checks`, `retailer_weekly_check_items`, `retailer_store_products`, `products`, `brands`, `product_curations`).

==================================================
5. PERFORMANCE CALCULATION
==================================================
- **Movement Formula:**
  - Case A (Baseline): `previous_reported_qty === null` -> Baseline count (No movement).
  - Case B (Confirmed Delivery): `previous_reported_qty + delivered_since_previous - reported_remaining_qty`.
  - Case C (Delivery Unknown): `previous_reported_qty - reported_remaining_qty` (Provisional).
- **Retail Price Basis:** K SELECT Suggested Retail Price / MSRP (`product_curations.suggest_retail_price` or `products.estimated_retail_price`).
- **Wholesale Cost Basis:** Approved Retailer Wholesale Price (`product_curations.wholesale_price`).
- **Estimated Retail Sales:** `Estimated Movement × Suggested Retail Price (MSRP)`.
- **Estimated Gross Profit:** `Estimated Retail Sales − (Estimated Movement × Wholesale Price)`.
- **Gross Margin Formula:** `(Estimated Gross Profit / Estimated Retail Sales) × 100%`.
- **Average Weekly Movement:** `Sum of Usable Movements / Usable Submitted Intervals`.
- **Weeks of Supply:** `Latest Reported Remaining / Average Weekly Movement`.
- **Target Weeks:** `TARGET_WEEKS_OF_SUPPLY = 4`.
- **Suggested Reorder Formula:** `Target Qty (Avg Velocity × 4) − Reported Remaining`, rounded UP to product `carton_pack_qty` (MOQ).
- **Confidence Rules:** 0 intervals = Insufficient Data, 1 interval = Early Signal, 2+ intervals = Recommendation Available, Negative = Needs Review.

==================================================
6. COMPANY / STORE REPORTING
==================================================
- **Company Aggregation:** Multi-store sums for units moved, remaining stock, retail value, and gross profit.
- **Store Breakdown:** Tabular view of store-level counts, movement status, velocity, and runout weeks.
- **Data Coverage:** Percentage of assigned stores that have submitted weekly counts in the period.
- **Role Visibility:** Owners, Buyers, and Accounting see full financial margins; Store Employees see operational movement & stock counts only.

==================================================
7. DEPLOYMENT & USER TEST
==================================================
Local QA: PASS (TypeScript 0 errors)
Build: PASS (Next.js 16.2.12 Production Build)
Deployment: Ready & Live in Production
Production URL: https://portal.kselecthub.com/sales

- Company View: PASS
- Store Filter: PASS
- Estimated Movement: PASS
- Estimated Retail Sales: PASS
- Estimated Gross Profit: PASS
- Reorder Recommendation: PASS
- Add to Cart: PASS
- Mobile View: PASS
- Weekly Check Regression: PASS
- Order Regression: PASS
- Admin Regression: PASS
- Brand Portal Regression: PASS

USER TEST INSTRUCTIONS:
1. Login to https://portal.kselecthub.com as Retailer user (`tammyhahm@gmail.com`).
2. Navigate to https://portal.kselecthub.com/sales.
3. Select "Last 30 Days" filter and inspect Top KPI summary cards.
4. Verify Estimated Movement, Retail Sales @ SRP, Gross Profit, and Gross Margin %.
5. Verify Data Coverage banner (e.g. 1 of 1 Stores - 100%).
6. Browse Product Performance Table / Mobile Cards.
7. Click a product to open `/sales/[id]` and review the Store-by-Store breakdown.
8. Click `+ Add {qty} to Cart` on a product needing reorder and verify items appear in `/cart`.
9. Test Store Filter dropdown between "All Stores" and specific store.

KNOWN LIMITATIONS:
- Actual store tagged POS price will be incorporated once RTP-TAG-001 (Price Tag module) is implemented; until then, Suggested Retail Price (MSRP) is used as explicit fallback.

==================================================
8. QA / VERIFICATION
==================================================
- TypeScript (`npx tsc --noEmit`): 0 errors
- Production Build (`npm run build`): SUCCESS
- Remote Diagnostics Fingerprint: MATCH

==================================================
9. ISSUES / RISKS
==================================================
None.

==================================================
10. APPROVAL REQUIRED
==================================================
None.

==================================================
11. RECOMMENDED NEXT TASK
==================================================
RTP-TAG-001: Price Tag & QR Foundation

==================================================
12. FINAL STATUS
==================================================
COMPLETED
