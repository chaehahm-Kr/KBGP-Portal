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

## R5 Fix Summary: Executed Agreement Signed URL Production User Fix & Controlled Test Reset
- **Task ID**: `PORT-AGR-001-R5`
- **Task Name**: Executed Agreement Signed URL Production User Fix & Controlled Test Reset
- **Root Cause Discovered**:
  - `getSignedExecutedPdfUrlAction()` in `lib/agreement/actions.ts` previously called `getSignedFileUrl()` in `lib/files/storage.ts`, which instantiated `const supabase = await createClient();` (the standard user/anon client).
  - Because `company-uploads` is a **Private Storage Bucket**, Supabase Storage RLS enforces access controls on `storage.objects`. Standard user sessions lack direct RLS permissions to sign objects in private buckets, causing `createSignedUrl()` to return `StorageApiError: Object not found`.
  - Consequently, `getSignedFileUrl()` returned `null`, triggering the user-facing error: `"서명된 다운로드 URL을 생성할 수 없습니다."`.
- **Architectural Solution**:
  1. `getSignedExecutedPdfUrlAction()` performs strict server-side authentication (`supabase.auth.getUser()`) and tenant authorization (`company_users.id = user.id AND status = 'active'` OR `staff_members`).
  2. AFTER server-side authorization passes, `getSignedExecutedPdfUrlAction()` uses `createAdminClient()` (`admin.storage.from("company-uploads").createSignedUrl(targetPath, 3600, options)`) on the server to generate short-lived signed URLs securely.
  3. Added structured error logging (`[Auth Security Audit] [SIGNED_URL_CREATION_FAILED]`, `[AGREEMENT_COMPANY_MISMATCH]`).
- **Empirical Proof & Verification**:
  - Verified with real user session `account@letusto.com` (`ae811579-4b8e-4cc6-aae7-deab0635e814`):
    - View URL: Generated HTTP 200 signed URL (`https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/sign/company-uploads/...`).
    - Download URL: Generated HTTP 200 signed URL with header `Content-Disposition: attachment; filename=K_SELECT_Agreement_KSN-AGR-2026-000001.pdf`.
    - Tenant Isolation: Unauthorized user returns `해당 계약서에 접근할 권한이 없습니다.`.
- **Controlled Test Reset for Brands Global Inc.**:
  - Reset Agreement state for `Brands Global Inc.` (`4c845ae8-b93b-4db2-858f-bda3252e8167`):
    - Deleted test recipient records from `company_agreement_recipients`.
    - Deleted test audit logs from `agreement_audit_logs`.
    - Removed test executed PDF from private storage (`agreements/4c845ae8-b93b-4db2-858f-bda3252e8167/KSN-AGR-2026-000001.pdf`).
    - Reset `company_agreements` row status to `pending` with cleared signature metadata.
    - Preserved Agreement Template v1.0, company profile, products, users, applications, and all other company data.
  - Final Status: **Pending / 계약 서명 필요** (Ready for User E2E Test).

## R6 Fix Summary: Executed PDF Layout & Signature Rendering Refinement
- **Task ID**: `PORT-AGR-001-R6`
- **Task Name**: Executed PDF Layout & Signature Rendering Refinement
- **Scope & Objectives**:
  - Refactor `lib/agreement/pdf-generator.ts` to improve layout alignment, dynamic text wrapping, cursive script electronic signature rendering, and field positioning on the final executed agreement PDF.
  - Retain source template PDF (`private_assets/agreements/template_v1.pdf`), legal text, recipient logic, email logic, Admin features, and storage workflows without alteration.
- **Key Enhancements**:
  1. **Structured Template Configuration (`TEMPLATE_V1_CONFIG`)**:
     - Centralized page coordinates for Page 1 company fields, Page 5 signature block, Page 5 electronic execution record table, and page footers.
  2. **Dynamic Text Wrapping & Scaling (`wrapAndFitText`)**:
     - Dynamically measures text widths using `pdf-lib` fonts (`font.widthOfTextAtSize`).
     - Prevents company address text from overflowing single-line fields by wrapping long addresses into up to 2 neatly formatted lines.
     - Separates Company Name, Representative Name, and Company Address into distinct dedicated fields on Page 1.
  3. **Embedded Cursive Script Electronic Signature**:
     - Installed `AlexBrush-Regular.ttf` font asset into `private_assets/fonts/AlexBrush-Regular.ttf`.
     - Renders typed electronic signatures in elegant cursive script using dark navy ink (`rgb(0.05, 0.12, 0.42)`).
     - Dynamically scales signature font size to remain perfectly bounded within the signature box (`maxWidth: 125`).
  4. **Electronic Execution Record Table**:
     - Formats platform name (`K SELECT NETWORK`), version, agreement ID, and executed date cleanly inside the execution record table at `y: 174`.
     - Draws agreement ID as a single continuous string without letter spacing anomalies.

## R7 Fix Summary: Executed PDF Overlay Alignment Refinement + Brands Global Inc. Test Reset
- **Task ID**: `PORT-AGR-001-R7`
- **Task Name**: Executed PDF Overlay Alignment Refinement + Brands Global Inc. Test Reset
- **Root Cause Analysis**:
  - In `pdf-lib`, text rendering origin `(0, 0)` is located at the **bottom-left** of the PDF page, and `drawText({ x, y })` positions text by its **baseline**.
  - On Page 1 and Page 5, previous field coordinates were placed too low (approx. 8–18 points below cell baseline), causing text to sit on or near the lower cell borders/lines.
- **Coordinate Recalibration (`TEMPLATE_V1_CONFIG`)**:
  1. **Page 1**:
     - `companyName.y`: `609` -> `624` (+15pt up) for centered positioning in the Company Name box.
     - `companyAddress.y`: `568` -> `584` (+16pt up), with `lineHeight = 12` to center 1-line or 2-line wrapped addresses neatly between top and bottom borders.
     - `representativeName.y`: `518` -> `536` (+18pt up) for centered positioning in the Representative box.
  2. **Page 5**:
     - `companyName.y`: `432` -> `444` (+12pt up).
     - `signerName.y`: `382` -> `390` (+8pt up).
     - `signerTitle.y`: `356` -> `356` (verified clearly above signature area).
     - `signatureBox.y`: `288` -> `304` (+16pt up) to position the cursive script signature (`AlexBrush-Regular`) cleanly inside the signature box, clear of the bottom line.
     - `brandDate.y` & `letustoDate.y`: `240` -> `248` (+8pt up) for natural alignment with the Date line.
  3. **Execution Record Table**:
     - `executedVia`, `version`, `agreementId`, `executedDate`: `174` -> `178` (+4pt up) for table row centering.
- **Controlled Test Reset for Brands Global Inc. (`4c845ae8-b93b-4db2-858f-bda3252e8167`)**:
  - `company_agreements` status updated to `pending` with cleared signature metadata.
  - Recipient records deleted (`company_agreement_recipients`: 0 remaining).
  - Audit log records deleted (`agreement_audit_logs`: 0 remaining).
  - Test executed PDF removed from private storage (`company-uploads`).
  - Agreement Template v1.0 and all other company data preserved intact.
  - Final Status: **Pending / 계약 서명 필요** (Ready for User E2E Test).

## R8 Fix Summary: Supplier Overlay Upward Recalibration + Brands Global Inc. Test Reset
- **Task ID**: `PORT-AGR-001-R8`
- **Task Name**: Supplier Overlay Upward Recalibration + Brands Global Inc. Test Reset
- **Root Cause & Visual Alignment Analysis**:
  - Based on user visual markup (`media_1790471437824.png`), Page 1 and Page 5 supplier dynamic values were sitting low relative to the template box underlines, and Date values were sitting completely below the `날짜:` line outside the supplier/Letusto signature boxes.
- **Coordinate Recalibration (`TEMPLATE_V1_CONFIG`)**:
  1. **Page 1**:
     - `companyName.y`: `624` -> `658` (+34pt up) to match Letusto Inc. alignment line.
     - `companyAddress.y`: `584` -> `598` (+14pt up, line 1 at 598, line 2 at 586) to match Letusto address lines.
     - `representativeName.y`: `536` -> `540` (+4pt up) to match Chae Hahm baseline.
  2. **Page 5**:
     - `companyName.y`: `444` -> `448` (+4pt up).
     - `signerName.y`: `390` -> `394` (+4pt up).
     - `signerTitle.y`: `356` -> `360` (+4pt up) to sit cleanly in `직책:` area above signature box.
     - `signatureBox.y`: `304` -> `318` (+14pt up) to center cursive script signature (`AlexBrush-Regular`) inside the `[280, 340]` signature box.
     - `brandDate.y` & `letustoDate.y`: `248` -> `270` (+22pt up) to place dates inside the signature box above the `날짜:` line.
  3. **Execution Record Table**:
     - `executedVia`, `version`, `agreementId`, `executedDate`: `178` -> `184` (+6pt up) to sit centered inside execution record table cells.
- **Controlled Test Reset for Brands Global Inc. (`4c845ae8-b93b-4db2-858f-bda3252e8167`)**:
  - `company_agreements` status updated to `pending` with cleared signature metadata.
  - Recipient records deleted (`company_agreement_recipients`: 0 remaining).
  - Audit log records deleted (`agreement_audit_logs`: 0 remaining).
  - Test executed PDF removed from private storage (`company-uploads`).
  - Agreement Template v1.0 and all other company data preserved intact.
  - Final Status: **Pending / 계약 서명 필요** (Ready for User E2E Test).

## R9 Fix Summary: Agreement Completion UI Simplification + External Agreement ID Privacy Improvement
- **Task ID**: `PORT-AGR-001-R9`
- **Task Name**: Agreement Completion UI Simplification + External Agreement ID Privacy Improvement
- **Portal UI Simplification**:
  1. **Removed `계약 변경 문의` CTA**: Removed the inquiry link button from the completed Agreement card (`components/portal/agreement-card.tsx`).
  2. **Removed `갱신 거절 통지 기한` Card**: Removed the deadline display card from the completed card grid. Contract terms and 90-day notice logic remain fully operational in underlying code and operating info notes.
  3. **Summary Grid Rebalance**: Rebalanced the details grid from 4 columns to 3 clean, focused cards:
     - `계약 체결자 (Signed By)`
     - `계약 발효일 (Effective Date)`
     - `최초 만료일 (Term Expiration)`
- **External Agreement ID Privacy Improvement**:
  1. **Privacy & Security Goal**: Replaced public global sequence numbers (e.g., `KSN-AGR-2026-000001`) for FUTURE Agreements with non-sequential, company-specific, privacy-preserving external IDs: `KSN-AGR-{COMPANY_CODE}-{YY}-{RANDOM_SUFFIX}`.
  2. **Company Code Helper (`generateCompanyShortCode`)**: Derives a clean, uppercase 3-to-5 character alphanumeric short code from company name (e.g. `Brands Global Inc.` -> `BGI`).
  3. **Random Suffix Generator (`generateRandomAgreementSuffix`)**: Generates a 4-character non-sequential uppercase alphanumeric suffix using unambiguous characters (`2-9`, `A-Z` without `0`, `O`, `1`, `I`).
  4. **Collision Handling (`generateUniqueExternalAgreementId`)**: Checks database uniqueness before insertion; retries with fresh random suffix on collision (up to 5 retries).
  5. **Persistence & Surface Consistency**: Generated external ID is stored once in `company_agreements.agreement_id` and reused consistently across Portal, Admin, PDF overlay, download filename, emails, recipient history, audit logs, and storage path.
  6. **Historical Agreement Integrity**: Existing historical Agreements (e.g., `KSN-AGR-2026-000001`) are preserved unchanged without destructive renaming.
- **Controlled Test Reset for Brands Global Inc. (`4c845ae8-b93b-4db2-858f-bda3252e8167`)**:
  - Assigned new non-sequential external Agreement ID format: `KSN-AGR-BGI-26-8J8W`.
  - Recipient records deleted (`company_agreement_recipients`: 0 remaining).
  - Audit log records deleted (`agreement_audit_logs`: 0 remaining).
  - Test executed PDF removed from private storage (`company-uploads`).
  - Final Status: **Pending / 계약 서명 필요** (Ready for User E2E Test).


