# Implementation Report: Agreement System R3 Final Production Root-Cause Fix

## Task Summary
- **Task ID**: `PORT-AGR-001-R3`
- **Task Name**: Final Agreement Execution Production Root-Cause Fix
- **Repository**: `chaehahm-Kr/KBGP-Portal`

## Root Cause Investigation Evidence & Verification

### 1. Exact Failing Query & Error (Empirically Verified via Live DB Execution)
- **Failing Query**:
  ```ts
  admin
    .from("company_agreements")
    .select("*, companies(id, name, address, address_detail, representative_name, city, state, country, zip_code)")
    .eq("id", input.companyAgreementId)
    .single();
  ```
- **Postgres Error Returned**: `42703 (column companies_1.address does not exist)`
- **Failure Chain**:
  1. In Production Supabase DB schema, table `public.companies` does NOT have columns `address`, `address_detail`, `representative_name`, `city`, `state`, or `zip_code`.
  2. All company address, contact, and representative details are stored inside `companies.intro` JSON string prefixed with `__COMPANY_METADATA__:`.
  3. When `signCompanyAgreementAction()` executed, Supabase PostgREST rejected the query with Error 42703.
  4. The code check `if (fetchErr || !ca)` caught the query error and returned the user-facing message: `"계약서 정보를 찾을 수 없습니다. 소속 회사 정보를 다시 확인해 주세요."`

### 2. Live DB Rows & Data Relationship Audit for `account@letusto.com`
- **Target User**: `account@letusto.com` (Auth User ID: `ae811579-4b8e-4cc6-aae7-deab0635e814`)
- **Company User**: `id = 'ae811579-4b8e-4cc6-aae7-deab0635e814'`, `company_id = '4c845ae8-b93b-4db2-858f-bda3252e8167'`
- **Company Record**: `name = 'Brands Global Inc.'`, `intro = '__COMPANY_METADATA__:{"address":"225 kangnam Dae ro 2FL, Seoul, Seoul (060223)", "contacts":[{"name":"Tammy Hahm", "isPrimary":true}], ...}'`
- **Pending Agreement**: `id = '396397c3-dcf8-4dd0-ba5b-09e2f0bd26a7'`, `agreement_id = 'KSN-AGR-2026-000001'`, `company_id = '4c845ae8-b93b-4db2-858f-bda3252e8167'`, `status = 'pending'`

### 3. Structural Code Fix
1. Created `parseCompanyMetadata(comp)` helper function in `lib/agreement/actions.ts` to extract `address` and `representativeName` from `comp.intro` JSON metadata.
2. Updated all PostgREST `.select()` queries across `getCompanyAgreement()`, `signCompanyAgreementAction()`, and `adminListCompanyAgreementsAction()` to select valid columns:
   `.select("*, companies(id, name, country, contact_name, contact_phone, intro)")`.
3. Verified clean execution with live DB test script `scripts/test-prod-sign-action.js`:
   `Fetch Error: null`
   `Parsed Company Info: { id: '4c845ae8-b93b-4db2-858f-bda3252e8167', name: 'Brands Global Inc.', address: '225 kangnam Dae ro 2FL, Seoul, Seoul (060223)', representativeName: 'Tammy Hahm' }`.

## R4 Fix Summary: Executed Agreement PDF View & Download Production Fix
- **Task ID**: `PORT-AGR-001-R4`
- **Task Name**: Executed Agreement PDF View & Download Production Fix
- **Root Causes Discovered**:
  1. **[계약서 보기] Popup Blocking**: Calling `window.open(res.url, "_blank")` AFTER `await getSignedExecutedPdfUrlAction(...)` in an async handler caused modern web browsers to block the window opening as an untrusted popup.
  2. **[PDF 다운로드] Cross-Origin `a.download` Limitation**: Standard HTML5 `a.download` attribute is ignored for cross-origin URLs (`https://shzfrppdobpmrstcjfqu.supabase.co`). Without specifying `{ download: filename }` in Supabase `createSignedUrl`, Supabase omitted the `Content-Disposition: attachment` HTTP header, preventing browser file downloads.
  3. **Tenant Security & Path Resolution**: Updated `getSignedExecutedPdfUrlAction()` to validate user authentication, verify company membership, and pass `{ download: filename }` option to Supabase Storage.
- **Client Handler Fixes**:
  - `handleOpenPdfWindow`: Pre-opens `window.open("about:blank", "_blank")` BEFORE the `await` call to bypass popup blockers reliably, then updates `win.location.href = res.url`.
  - `handleDownloadCompletedPdf` & `handleDownloadPdf`: Calls `getSignedExecutedPdfUrlAction(path, { downloadFilename })` which sets `Content-Disposition: attachment; filename=K_SELECT_Agreement_KSN-AGR-2026-000001.pdf`, triggering instant native browser file downloads.
- **Production Verification**:
  - Live executed agreement `KSN-AGR-2026-000001` (PDF SHA: `b3b6f0d6c81af3f78988020ddcbcb0be838c28f54fcf8d2a6e94067330ee94b3`, path: `agreements/4c845ae8-b93b-4db2-858f-bda3252e8167/KSN-AGR-2026-000001.pdf`).
  - View Signed URL: HTTP status 200, valid PDF header.
  - Download Signed URL: HTTP status 200, `Content-Disposition: attachment; filename=K_SELECT_Agreement_KSN-AGR-2026-000001.pdf`.
  - Tenant Isolation: Unauthorized user access returns `해당 계약서에 접근할 권한이 없습니다.`.
