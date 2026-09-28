# ADM-IMP-001-R3 Technical Implementation Report

## Overview
- **Task ID**: `ADM-IMP-001-R3`
- **Task Name**: Brand Portal Impersonation Redirect Loop Fix & Exit Return Route Refinement
- **Target Systems**: Admin (`admin.kselectnetwork.com`), Brand Portal (`portal.kselectnetwork.com`), Retailer Portal (`portal.kselecthub.com`)

## Root Causes Identified & Fixed
1. **Brand Portal `ERR_TOO_MANY_REDIRECTS` Loop**:
   - **Root Cause**: `requireCompanyMembership()` in `lib/company/dal.ts` was calling `createClient()` (RLS client) which evaluated `auth.uid()` as NULL during impersonation. When RLS blocked `company_users` query, `requireCompanyMembership()` executed `redirect("/portal")` on `/portal` itself, creating an infinite redirect loop.
   - **Fix**: Updated `requireCompanyMembership()` to use `createAdminClient()` during impersonated sessions (`session.isImpersonating`), avoiding RLS block. Also updated invalid membership fallback redirect from `/portal` to `/portal/login?reason=membership_inactive`.
2. **Impersonated Brand Portal Page Queries**:
   - **Fix**: Updated `PortalHomePage` in `app/portal/page.tsx` and `PartnerPortalLayout` in `app/portal/layout.tsx` to use `createAdminClient()` when `session.isImpersonating` is true, enabling smooth rendering of products, applications, and company data for impersonated users.
3. **Exit Return Destinations Refinement**:
   - **Fix**: Updated `stopImpersonationAction` in `lib/auth/impersonation.ts`:
     - Brand Exit -> `/admin/companies` (Companies & Brands list)
     - Retailer Exit -> `/admin/retailers` (Retail Network list)
