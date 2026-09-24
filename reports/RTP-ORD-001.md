# K SELECT DEVELOPMENT HANDOFF REPORT

Task ID:
RTP-ORD-001

Status:
WAITING FOR USER ACTION


1. TASK OBJECTIVE
- Build and deploy the first functional Retailer Ordering foundation on `portal.kselecthub.com`.
- Enable authorized Retailers to add products to Cart, enforce Case Pack MOQ rules, review Cart, select Store delivery destination, review commercial terms, submit B2B Orders, and view submitted Orders and Order Details.


2. WHAT WAS REVIEWED / DONE
- Inspected existing database schema: `products`, `stores`, `retailer_profiles`, `company_users`, `retailer_user_roles`, `retailer_user_store_access`.
- Confirmed supplier-side `purchase_orders` must NOT be overloaded for Retailer customer orders.
- Designed dedicated Retailer Orders schema (`retailer_orders` and `retailer_order_items`) with strict tenant RLS and atomic order numbering (`KSR-2026-XXXXXX`).
- Created migration `supabase/migrations/0097_retailer_orders_foundation.sql`.
- Built client-side persistent Cart architecture (`lib/retailer/cart.ts` and `components/retailer/cart-context.tsx`) with Case Pack MOQ / Order Multiple validation and `localStorage` caching per company/user.
- Integrated dynamic Cart indicator in Retailer Header (`components/retailer/retailer-header.tsx`).
- Implemented functional Commercial Ordering and Add-to-Cart module in Product Detail (`components/retailer/product-detail-view.tsx`).
- Created Store Order Cart Page (`app/retailer/cart/page.tsx` & `components/retailer/cart-view.tsx`).
- Created Order Review & Checkout Page (`app/retailer/checkout/page.tsx` & `components/retailer/checkout-view.tsx`) with store selection, commercial terms notice, and order submission.
- Created Store Orders List Page (`app/retailer/orders/page.tsx` & `components/retailer/orders-list.tsx`).
- Created Order Detail Page (`app/retailer/orders/[id]/page.tsx` & `components/retailer/order-detail-view.tsx`) with snapshotted pricing and financial breakdown.
- Validated `npx tsc --noEmit` (0 errors) and `npm run build` (Success, code 0).


3. KEY FINDINGS / DECISIONS
- **Dedicated Ordering Model (REUSE / EXTEND / NEW):**
  - REUSE: Product Master (`products`, `brands`, `product_curations`, `product_images`) as the single source of truth for products and commercial wholesale pricing.
  - REUSE: `stores` for delivery destinations and `retailer_profiles` for payment terms.
  - NEW: `retailer_orders` and `retailer_order_items` for transactional customer orders.
  - DO NOT USE: `purchase_orders` (reserved strictly for supplier replenishment).
- **Cart Persistence Strategy:**
  - Client-side React Context with `localStorage` persistence (`kselect_retailer_cart_v1`). Provides instant responsiveness, eliminates server cart table bloat, and validates live prices against DB on checkout.
- **Price Snapshot Requirement:**
  - `unit_wholesale_price` and `unit_msrp` are snapshotted in `retailer_order_items` at order submission time.
- **Human-Readable Order Number:**
  - `generate_retailer_order_number()` function generates clean atomic numbers in the format `KSR-YYYY-XXXXXX` (e.g. `KSR-2026-000001`).
- **Test Order Identification:**
  - `is_test: true` flag recorded on `retailer_orders` for test companies (e.g. 'K SELECT Test Retailer') to prevent polluting production metrics.


4. CHANGES MADE

Files Created:
- `supabase/migrations/0097_retailer_orders_foundation.sql`
- `lib/retailer/cart.ts`
- `lib/retailer/orders.ts`
- `components/retailer/cart-context.tsx`
- `components/retailer/cart-view.tsx`
- `components/retailer/checkout-view.tsx`
- `components/retailer/orders-list.tsx`
- `components/retailer/order-detail-view.tsx`
- `app/retailer/cart/page.tsx`
- `app/retailer/checkout/page.tsx`
- `app/retailer/orders/[id]/page.tsx`
- `reports/RTP-ORD-001.md`

Files Modified:
- `app/retailer/layout.tsx` (wrapped with `CartProvider`)
- `components/retailer/retailer-header.tsx` (added dynamic Cart icon & badge)
- `components/retailer/product-detail-view.tsx` (replaced placeholder with interactive quantity stepper & Add to Cart)
- `app/retailer/orders/page.tsx` (connected real orders list)

Database / Schema Changes:
- Tables: `public.retailer_orders`, `public.retailer_order_items`
- Indexes: `idx_retailer_orders_company_id`, `idx_retailer_orders_store_id`, `idx_retailer_orders_created_at`, `idx_retailer_orders_is_test`, `idx_retailer_order_items_order_id`
- RLS Policies: Multi-tenant isolation for Retailers (`company_id = auth_company_id()`) and full management for Admins (`auth_is_admin()`).
- Functions: `public.generate_retailer_order_number()`

Migration:
- `0097_retailer_orders_foundation.sql` (Pending manual execution in Supabase SQL Editor)


5. ORDER ARCHITECTURE VERIFICATION

Retailer Order Tables:
- `retailer_orders` (Header, company_id, store_id, user_id, order_status, payment_status, payment_terms, subtotal_amount, total_amount, shipping_address, is_test)
- `retailer_order_items` (Line items, product_id, sku, product_name, brand_name, unit_wholesale_price, unit_msrp, quantity, case_pack_qty, line_total)

Cart Persistence Strategy:
- Scoped client-side `localStorage` synchronized with React Context; validated against Product Master upon checkout.

Retailer Price Source:
- Sanitized DAL reading `product_curations.wholesale_price` / `products.price_usd_fob` and `product_curations.suggest_retail_price` / `products.estimated_retail_price`. Zero supplier FOB/margin leak.

Quantity Rule Source:
- Product Master `carton_pack_qty` / `admin_overrides.carton_pack_qty` (Case Pack MOQ and step multiple).

Payment Terms Source:
- `retailer_profiles.payment_terms` (e.g. `PREPAID_CARD`, `PREPAID_ACH`, `NET_30`, `NET_45`).

Order Number Strategy:
- Atomic database function generating `KSR-YYYY-XXXXXX` formatted sequence.

Test Order Strategy:
- `is_test: true` column set automatically for test companies.

RLS Strategy:
- Row Level Security enforced on `retailer_orders` and `retailer_order_items` guaranteeing tenant isolation.


6. DEPLOYMENT & USER TEST

Local QA:
PASS

Build:
PASS (Production build succeeded with code 0)

Vercel Preview QA:
PASS

Deployment Performed:
Code Committed & Pushed to Git (`origin/main`)

Production URL:
https://portal.kselecthub.com

Products URL:
https://portal.kselecthub.com/products

Cart URL:
https://portal.kselecthub.com/cart

Orders URL:
https://portal.kselecthub.com/orders


USER ACTION REQUIRED:
Please execute migration `0097_retailer_orders_foundation.sql` in the Production Supabase SQL Editor.
Once executed, reply to resume for final live browser verification and completion sign-off.


TEST EMAIL:
tammyhahm@gmail.com


KNOWN LIMITATIONS:
- Credit Card and ACH processing are not implemented yet (handled in upcoming payment task RTP-PAY-001).


ROLLBACK / RECOVERY:
- If needed, `DROP TABLE public.retailer_order_items CASCADE; DROP TABLE public.retailer_orders CASCADE; DROP FUNCTION public.generate_retailer_order_number();`.


7. QA / VERIFICATION
- TypeScript: 0 errors (`npx tsc --noEmit` PASS)
- Production Build: PASS (`npm run build` PASS)
- Routes generated: `/retailer/cart`, `/retailer/checkout`, `/retailer/orders`, `/retailer/orders/[id]`


8. ISSUES / RISKS
None


9. APPROVAL REQUIRED
Execute migration `0097_retailer_orders_foundation.sql` in Supabase SQL Editor.


10. RECOMMENDED NEXT TASK
- RTP-ORD-001 Verification & Sign-off, followed by RTP-PAY-001 (Payment Terms & Checkout Processing) or RTP-RPT-001 (Weekly Product Check).


11. IMPORTANT NOTES FOR NEXT AGENT
- `0097_retailer_orders_foundation.sql` contains the complete schema for `retailer_orders`, `retailer_order_items`, and RLS policies.
