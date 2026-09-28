# ADM-IMP-001-R1 Technical Implementation Report

## Overview
- **Task ID**: `ADM-IMP-001-R1`
- **Task Name**: Impersonation Portal-Type Resolution & Session Launch Production Fix
- **Target Systems**: Admin (`admin.kselectnetwork.com`), Brand Portal (`portal.kselectnetwork.com`), Retailer Portal (`portal.kselecthub.com`)

## Key Architecture & Bug Fixes
1. **Authoritative Portal Type Resolution**:
   - `resolveAuthoritativePortalType(admin, companyId)` in `lib/auth/impersonation.ts` evaluates DB data (`company_roles`, `retailer_user_roles`, `stores`, `company_code`) instead of UI defaults.
2. **Cross-Domain Session Launch & Handoff**:
   - Single-use 60s HMAC-signed handoff token mechanism (`createHandoffToken` / `verifyHandoffToken`).
   - Endpoint `/api/auth/impersonation-handoff` sets domain-isolated `ksn_impersonation_session` cookie on target portal.
3. **Stale Session Auto-Cleanup**:
   - Automatically invalidates expired sessions for admin user before launching new session.
4. **Middleware Bypass (`lib/supabase/proxy.ts`)**:
   - Validates active impersonation cookie and allows requests to pass to `dal.ts` without login redirects.
