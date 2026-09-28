# ADM-IMP-001-R2 Technical Implementation Report

## Overview
- **Task ID**: `ADM-IMP-001-R2`
- **Task Name**: Real Browser Impersonation Launch Failure & Session State Fix
- **Target Systems**: Admin (`admin.kselectnetwork.com`), Brand Portal (`portal.kselectnetwork.com`), Retailer Portal (`portal.kselecthub.com`)

## Root Causes Identified & Fixed
1. **Admin Domain Cookie Pollution**:
   - `startImpersonationAction` previously set `ksn_impersonation_session` on `admin.kselectnetwork.com`, causing `admin.kselectnetwork.com` to think an active impersonation session existed.
   - **Fix**: Removed Admin domain cookie setting in `startImpersonationAction`. Only target portal handoff routes (`/api/auth/impersonation-handoff`) on `portal.kselectnetwork.com` and `portal.kselecthub.com` set the target portal cookie.
2. **Active / Stale Session Deadlock**:
   - `startImpersonationAction` rejected with error when an active session cookie was present without providing a way to overwrite or recover.
   - **Fix**: Added `forceRestart: true` support and auto-clearing of stale/overridden sessions. Updated `StartImpersonationModal` UI to allow "기존 세션 종료 및 새로 시작" (End Current Session & Start New).
3. **Retailer Portal Landing Path Redirection**:
   - `app/api/auth/impersonation-handoff/route.ts` redirected to `/retailer` for Retailer Portal, triggering an unnecessary middleware 302 redirect from `/retailer` to `/`.
   - **Fix**: `getPortalLandingPath` returns `/` for Retailer Portal in Production (`portal.kselecthub.com`), allowing middleware to internally rewrite `/` to `/retailer` without 302 redirects.
