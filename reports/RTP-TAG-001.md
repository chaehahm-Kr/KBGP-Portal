# K SELECT DEVELOPMENT HANDOFF REPORT

==================================================
1. TASK OBJECTIVE
==================================================
Task ID: RTP-TAG-001
Title: Store Price Tag & Common Product QR Foundation
Project: K SELECT Retailer Portal + Public KSelectHub
Target URL: https://portal.kselecthub.com/tags & https://www.kselecthub.com/products/[id]
Status: WAITING FOR USER ACTION (Execute Migration 0100 in Supabase SQL Editor)

The objective of this task is to establish the Store-level Price Tag & Common Product QR foundation, enabling Retailers to set custom Store Regular Prices and promotional Sale Prices (with automated discount % calculation), preview and print shelf tags (single & batch) formatted for standard 2.25" × 1.25" fixtures, and include a canonical, public product-level QR code that customers can scan to view authentic product details without login walls or internal commercial leaks.

==================================================
2. WHAT WAS REVIEWED / DONE
==================================================
1. **Designed Migration 0100 (`0100_retailer_store_price_and_tag_foundation.sql`):**
   - `public.retailer_store_product_prices`: Table storing store-specific regular price, optional sale price, sale date ranges, and creator tracking with unique constraint `(store_id, product_id)`.
   - Forward-looking price snapshot foundation: Added `retail_price_snapshot` and `retail_price_basis` columns to `retailer_weekly_check_items`.
   - Security: RLS helper functions and multi-tenant policies enforcing store-level authorization (Owner, Buyer, Store Manager edit; Employee & Accounting view).

2. **Built Common Product QR Generation & Resolution (`lib/product/qr.ts`):**
   - Canonical public URL: `https://www.kselecthub.com/products/{productId}`.
   - SVG and PNG Data URL generators using maintained `qrcode` library for sharp label printing.
   - Strictly product-level: never encodes store, retailer, price, user, or session.
   - Utility `parseKSelectProductQr()` supporting future Weekly Check scanner resolution.

3. **Built Public Product Scan Landing Page (`app/products/[id]/page.tsx` & `components/public/public-product-view.tsx`):**
   - Publicly accessible without authentication.
   - Displays authentic product gallery, brand, name, Korean origin, volume, key benefits, description, and formulation.
   - Zero commercial leaks: strictly excludes wholesale price, supplier FOB, internal notes, and store prices.

4. **Built Store Price Tag Management & Batch Print UI (`components/retailer/price-tags-dashboard.tsx`):**
   - Accessible via `/tags` / `/retailer/tags` with dedicated navigation item.
   - Store selector and search filter.
   - Displays Wholesale Cost, Suggested MSRP guidance, Store Regular Price, Sale Price, Discount %, and Tag Status.
   - Modal with `[Use Suggested MSRP]` convenience button and live tag preview.
   - Single tag preview & Batch print view with `@media print` CSS for standard 2.25" × 1.25" shelf fixtures.

==================================================
3. KEY FINDINGS / DECISIONS
==================================================
- **Store Price Control:** Retailers control their retail selling prices; Suggested Retail Price (MSRP) is provided as guidance and is never silently converted into store price without user confirmation.
- **Product-Level QR Stability:** The QR encodes ONLY the canonical product URL and remains 100% stable regardless of store price changes, sales, or retailer transfers.
- **Print Layout:** Configured for standard shelf tag holders (2.25" × 1.25" / 57mm × 32mm) with dedicated print stylesheet that strips web headers/sidebars during browser printing.
- **Historical Price Safety:** Future store price snapshots on weekly checks will preserve historical integrity without rewriting past performance data.

==================================================
4. CHANGES MADE
==================================================
Files Created:
- `supabase/migrations/0100_retailer_store_price_and_tag_foundation.sql`
- `lib/product/qr.ts`
- `lib/product/public.ts`
- `lib/retailer/store-pricing-types.ts`
- `lib/retailer/store-pricing.ts`
- `lib/retailer/store-pricing-actions.ts`
- `components/public/public-product-view.tsx`
- `components/retailer/price-tag-card.tsx`
- `components/retailer/price-tag-modal.tsx`
- `components/retailer/price-tags-dashboard.tsx`
- `app/products/[id]/page.tsx`
- `app/retailer/tags/page.tsx`
- `reports/RTP-TAG-001.md`

Files Modified:
- `lib/retailer/navigation.ts`
- `components/retailer/nav-icon.tsx`
- `package.json` & `package-lock.json`

==================================================
5. STORE PRICE ARCHITECTURE
==================================================
- Table: `public.retailer_store_product_prices`
- Store Scope: `Retailer Company × Store × Product` (Unique: `store_id + product_id`)
- Regular Price: Required (`regular_price > 0`)
- Sale Price: Optional (`0 < sale_price < regular_price`)
- Sale Dates: Optional `sale_start_date` and `sale_end_date`
- Discount %: Dynamically computed as `((Regular - Sale) / Regular) * 100`
- Role Permissions: Owner/Buyer/Store Manager edit; Employee view/print.

==================================================
6. PRICE TAG ARCHITECTURE
==================================================
- Normal Tag: Brand, Product Name, SKU, Store Regular Price, Product QR.
- Sale Tag: Brand, Product Name, SKU, Regular Price (strikethrough), SALE Price, SAVE X% badge, Product QR.
- Physical Size: Standard 2.25" × 1.25" (57mm × 32mm) shelf fixture tag.
- Print Support: Browser print dialog with clean `@media print` CSS (Single & Batch).

==================================================
7. COMMON QR ARCHITECTURE
==================================================
- Canonical URL: `https://www.kselecthub.com/products/{productId}`
- Public Page: Unauthenticated, sanitized product details, authentic origin badge.
- Future Scanner Resolution: `parseKSelectProductQr(payload)` parses QR URL or UUID back to `productId`.

==================================================
8. PERFORMANCE PRICE INTEGRATION
==================================================
- Forward-looking: Incorporates active store tagged prices ahead of MSRP fallback.
- Snapshot columns: `retail_price_snapshot` and `retail_price_basis` on `retailer_weekly_check_items`.

==================================================
9. DATABASE / MIGRATION STATUS
==================================================
0100 Required: YES
0100 Production Applied: WAITING FOR USER ACTION

==================================================
10. DEPLOYMENT & USER TEST
==================================================
Local QA: PASS (TypeScript 0 errors)
Build: PASS (Next.js 16.2.12 Production Build)

USER TEST INSTRUCTIONS (After Migration 0100 Execution):
1. Login to https://portal.kselecthub.com as Retailer user.
2. Navigate to https://portal.kselecthub.com/tags.
3. Select "Test Store 01".
4. Click `✏️ Edit Price` on an assorted product.
5. Set Regular Price (or click `[Use Suggested MSRP]`) and optionally set Sale Price.
6. Observe real-time tag preview and Save Price.
7. Click `👁️ Preview` to see the shelf tag and canonical QR code.
8. Select multiple products and click `🖨️ Print Selected` to test batch print dialog.
9. Scan QR with your smartphone to verify public product page at https://www.kselecthub.com/products/[id].

==================================================
11. FINAL STATUS
==================================================
WAITING FOR USER ACTION (Execute Migration 0100 in Supabase SQL Editor)
