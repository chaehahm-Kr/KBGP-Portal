```markdown
K SELECT DEVELOPMENT HANDOFF REPORT

Task ID:
RTP-ENV-001

Status:
COMPLETED


1. TASK OBJECTIVE

- Perform a comprehensive, read-only environment and infrastructure review across GitHub, Vercel, Supabase, Auth, RLS, Storage, Resend, Payments, and Mobile/PWA for the new K SELECT Retailer Portal (portal.kselecthub.com) prior to any development.


2. WHAT WAS REVIEWED / DONE

- Inspected current Next.js 16 App Router repository structure (`KSelectNetwork-Portal` on GitHub `chaehahm-Kr/KBGP-Portal.git`).
- Analyzed Vercel project configuration (`kselectnetwork-portal` / `team_Feq6rB744rUBEXbm92eDZl6s`) and multi-domain host routing logic in `proxy.ts`.
- Inspected Supabase database schema and migrations (`0001` through `0095`), including `profiles`, `companies`, `company_roles`, `company_users`, `products`, `brands`, `stores`, `placements`, `supplier_invoices`, and `supplier_payments`.
- Analyzed authentication and tenant security architecture (`lib/auth/dal.ts`, cookie isolation by prefix, RLS helper functions `auth_company_id()`, `auth_is_admin()`, `auth_is_super_admin()`).
- Evaluated Supabase Storage bucket (`company-uploads`) RLS policies and asset access constraints.
- Reviewed email infrastructure (`lib/notifications/email.ts`, `templates.ts`, and `email_templates` table) powered by Resend.
- Reviewed payment capabilities and confirmed existing code only handles manual B2B AP ledger records without any payment gateway integration.
- Analyzed mobile/PWA readiness, responsive layout foundation, and camera-based QR code scanning requirements for store staff.
- Documented REUSE / EXTEND / NEW matrix and formulated approval decisions for Chae.


3. KEY FINDINGS / DECISIONS

- REPOSITORY STRATEGY: Recommend developing the Retailer Portal within the existing repository (Option A) to share types, Supabase client/auth helpers, and product models without duplication or multi-repo drift.
- VERCEL & DOMAIN: Single Vercel project with host-based routing (`host.includes("portal.kselecthub.com")`) using isolated cookie prefix `retailer-sb-` to prevent session conflict with Admin and Brand Portal.
- SUPABASE REUSE: Share the single Supabase project (`shzfrppdobpmrstcjfqu`). Product/SKU master, brand assets, category attributes, and warehouse master are directly reused.
- TENANT ISOLATION: Strong 3-way RLS isolation between Admin (supervisory), Brand (supply-side), and Retailer (store/buying operations). Brands can never view Retailer orders, inspections, or sales. Retailers can never view Brand supply costs, supplier POs, or supplier remittance details.
- PAYMENTS: Stripe is recommended for Credit Card & ACH payment collection, with Admin-approved Net Terms (e.g. Net 45) managed via database flags.
- MOBILE/PWA: Next.js 16 + Tailwind CSS v4 supports PWA (`manifest.json`) and Web Camera QR scanning (`html5-qrcode`) cleanly without native app overhead.


4. CHANGES MADE

Files Created:
- reports/RTP-ENV-001.md

Files Modified:
- None

Database / Schema Changes:
- None — review/planning task only.

API Changes:
- None — review/planning task only.

Authentication / RLS / Security Changes:
- None — review/planning task only.

Environment / Infrastructure Changes:
- None — review/planning task only.


5. DEPLOYMENT

Environment:
None

Deployment Performed:
No

Production Changed:
No


6. QA / VERIFICATION

- Inspected Git remote, branches, and commit logs (verified branch `main` at commit `d4cb6cd`).
- Inspected all Supabase SQL migration files (0001 through 0095) for schema patterns, RLS policies, and enum types.
- Inspected session management and cookie prefixing in `proxy.ts` and `lib/auth/dal.ts`.
- Inspected Resend integration in `lib/notifications/`.
- Inspected `.vercel/project.json` for team and project metadata.
- Confirmed zero modifications were made to production systems or databases.


7. ISSUES / RISKS

- Existing `stores` table (from migration 0014) has an open SELECT policy (`USING (true)`) and lacks a `company_id` foreign key. It must be updated with proper retailer tenancy and RLS before production launch.
- Existing `company-uploads` storage bucket RLS restricts reading to the uploading company. A secure view policy or signed URL pipeline must be established so Retailers can view approved brand product images.
- `public.app_role` enum currently only contains `('portal', 'admin')`. Adding `'retailer'` will require careful migration and DAL extension.


8. APPROVAL REQUIRED

1. Decision: Repository Architecture (Unified Monolith vs Separate Repository)
   - Recommended Option: Add Retailer Portal routes (`/retailer` or host-based route group) to the existing repository.
   - Alternative: Create a new standalone Next.js repository `Portal.kselecthub`.
   - Reason: Unified repo eliminates duplicate types, models, and helper maintenance, allowing seamless end-to-end type safety with Admin.

2. Decision: Vercel Project Structure
   - Recommended Option: Attach `portal.kselecthub.com` to existing Vercel project with proxy host routing and `retailer-sb-` cookie prefix.
   - Alternative: Create a separate Vercel Project in the same Vercel team pointing to a standalone repo.
   - Reason: Simplified deployment pipeline, single environment variable management for shared Supabase/Resend keys.

3. Decision: Payment Gateway Provider
   - Recommended Option: Stripe (Card + ACH + Customer Portal) + Admin-approved Terms (Net 45).
   - Alternative: Manual Invoicing / Wire only.
   - Reason: Standard US B2B retail workflow requires both instant card payments and ACH/Terms for wholesale volume.


9. RECOMMENDED NEXT TASK

Task ID:
RTP-DB-001

Objective:
Design and implement the Retailer Portal database schema and RLS policies (retailer profiles, multi-store management, retailer pricing, orders, and weekly check reports) on the shared Supabase database.


10. IMPORTANT NOTES FOR NEXT AGENT

- Do not alter existing Brand Portal or Admin RLS policies or tables without ensuring full backward compatibility.
- When creating Retailer models, always use `company_roles` (which already has `'Retailer'`) and attach new Retailer entities to `company_id`.
- Ensure all new tables force and enable RLS with strict `auth.uid()` and `auth_company_id()` tenant filtering.
```
