# K SELECT DEVELOPMENT HANDOFF REPORT

- Task ID: ADM-APP-001-R2
- Task Name: Cross-Repo Retailer Application Production E2E Verification & Completion
- Status: COMPLETED

---

## 1. Root Cause
In previous iterations, the Marketing website (`www.kselecthub.com`) had simulated form submissions in local state (`setSubmitted(true)`) and presented store-oriented terminology (`Store Name *`). This task establishes and authoritatively verifies the end-to-end production flow from `www.kselecthub.com` to the authoritative KBGP backend (`admin.kselectnetwork.com/api/retailer-applications`), Supabase database persistence in `applications`, Admin All Applications, Admin Retailer Applications, and Application Detail views.

---

## 2. Two-Repository Architecture
- **Marketing Site (`chaehahm-Kr/kselecthub-marketing`)**:
  - Live Domain: `https://www.kselecthub.com`
  - Client Component: `app/[locale]/CtaForm.tsx` (ID `#apply`) & `app/[locale]/Simulator.tsx`
  - Role: Collects company applicant details and launch readiness answers. Dispatches cross-origin HTTPS POST to the authoritative backend. Never writes directly to Supabase from the browser.
- **Portal & Admin Platform (`chaehahm-Kr/KBGP-Portal`)**:
  - Live Domains: `https://admin.kselectnetwork.com` (Unified Admin) & `https://portal.kselecthub.com` (Retailer Portal)
  - Backend Endpoint: `app/api/retailer-applications/route.ts`
  - Admin Workspaces: `app/admin/applications/page.tsx` & `app/admin/applications/[id]/page.tsx`
  - Role: Enforces schema validation, handles CORS, generates application numbers via database RPC, enforces authoritative field constraints (`partner_type = 'retailer'`, `entry_mode = 'public_application'`, `status = 'submitted'`), and provides admin review/approval actions.

---

## 3. Marketing Submission Path
- **Component**: `app/[locale]/CtaForm.tsx`
- **HTTP Method**: `POST`
- **Production Endpoint**: `https://admin.kselectnetwork.com/api/retailer-applications`
- **Request Payload**:
  - `companyName`: Applying business/entity name
  - `contactName`: Primary owner/applicant contact name
  - `email`: Applicant email
  - `phone`: Applicant phone number
  - `streetAddress`, `city`, `state`, `zipCode`: Headquarters/location address
  - `comments`: Additional notes or special requirements
  - `recommendedConfig`, `simulatedInvestment`, `simulationId`: Connected simulator metadata (if run)
  - `readinessAnswers`: Array of readiness items (`kbeauty_space`, `staff_education`, `weekly_sync`, `category_mindset`) with `response: 'ready' | 'discuss'`
- **Response Contract**:
  - Success: `{ ok: true, success: true, applicationNumber: string, applicationId: string }`
  - Duplicate: `{ ok: true, success: true, isExisting: true, applicationNumber: string, applicationId: string, message: string }`
  - Failure: `{ ok: false, success: false, error: string }` (HTTP 400, 422, or 500)

---

## 4. Authoritative Backend Endpoint
- **Dedicated Route**: `app/api/retailer-applications/route.ts` in `KBGP-Portal`.
- **Consolidation & Role**:
  - `app/api/retailer-applications/route.ts` is the single authoritative intake endpoint for Retailer Public Applications.
  - CORS is enabled with `Access-Control-Allow-Origin: https://www.kselecthub.com`, preflight `OPTIONS` support, and explicit headers configured in `next.config.ts`.
  - `app/api/inquiries/route.ts` is reserved for Korean Brand supplier inquiries from `kselectnetwork.com` requiring `INQUIRY_INTAKE_SECRET`.

---

## 5. API Contract & Security
The backend strictly forces authoritative values that client browsers cannot tamper with:
- `partner_type` = `'retailer'` (forced by backend)
- `entry_mode` = `'public_application'` (forced by backend)
- `status` = `'submitted'` (forced by backend)
- `reviewer`, `approved_at`, `invitation_id`, `onboarded_company_id`, `company_id` = `null` upon submission.

---

## 6. Company vs. Store Copy Alignment
- **Terminology Rule**:
  - **Company**: Represents the applying legal entity / organization (`applicant_company_name`).
  - **Store**: Represents physical retail store locations created and managed after onboarding.
- **Copy Audit**:
  - Live Marketing label: `Company Name *` / `회사명 (Company Name) *`
  - Placeholder: `e.g. Beauty World LLC` / `예: 뷰티월드 (Beauty World LLC)`
  - Subtitle: `"Submit your company details. Our category management team will contact you within 24 hours."` / `"간단한 회사 및 사업자 정보를 남겨주시면 검토 후 K SELECT HUB 팀이 연락드리겠습니다."`
  - Consent Text: `"I agree that K SELECT HUB may collect and use the submitted company and contact details for partnership review and follow-up communication. *"`

---

## 7. Production Retailer Submission (Live E2E Record)
- **Execution Timestamp**: `2026-09-25T19:44:04.604Z`
- **Application Number**: `APP-000008` (authoritatively generated via Supabase RPC `generate_application_number`)
- **Application ID**: `7df7d05f-23dd-4a8a-b438-79b5531e51a7`
- **HTTP Status**: `200 OK`
- **API Response**: `{"ok":true,"success":true,"applicationNumber":"APP-000008","applicationId":"7df7d05f-23dd-4a8a-b438-79b5531e51a7"}`

---

## 8. Production Database Record
Verified in Production Supabase (`applications` table):
- `id`: `7df7d05f-23dd-4a8a-b438-79b5531e51a7`
- `application_number`: `APP-000008`
- `partner_type`: `retailer`
- `entry_mode`: `public_application`
- `status`: `submitted`
- `applicant_company_name`: `K SELECT RETAILER E2E QA 2026-09-25`
- `applicant_contact_name`: `QA Test Officer`
- `applicant_contact_email`: `qa-e2e-20260925@letusto.com`
- `applicant_contact_phone`: `856-383-8288`
- `applicant_address`: `{"zip":"07024","city":"Fort Lee","state":"NJ","street":"123 Main St","locationsCount":"1"}`
- `motivation_note`: `Automated E2E Production verification for ADM-APP-001-R2\n\n[Simulator Recommendation: 8 FT Growth Module | Opening Order approx. $12000]`
- `submitted_at`: `2026-09-25T19:44:04.604+00:00`

---

## 9. Readiness Answers Persistence
All 4 core operational readiness items persisted with structured JSON:
1. `Dedicated K-Beauty Space` (`kbeauty_space`): `ready` (✓ Ready)
2. `Staff Product Education` (`staff_education`): `ready` (✓ Ready)
3. `Weekly Inventory Sync` (`weekly_sync`): `ready` (✓ Ready)
4. `Category Partnership Mindset` (`category_mindset`): `ready` (✓ Ready)

---

## 10. Admin All Applications
- **URL**: `https://admin.kselectnetwork.com/admin/applications`
- **Listing**: Application `APP-000008` is listed under the "All Applications" tab with:
  - Application Number: `APP-000008`
  - Partner Type: `🏪 Retailer Partner`
  - Company Name: `K SELECT RETAILER E2E QA 2026-09-25`
  - Status: `심사 대기 (submitted)`
  - Entry Mode: `🌐 Public Application`
  - Primary Contact: `QA Test Officer (qa-e2e-20260925@letusto.com)`
  - Submitted Date: `2026-09-25`

---

## 11. Admin Retailer Applications
- **URL**: `https://admin.kselectnetwork.com/admin/applications?type=retailer`
- **Listing**: The same authoritative database row is listed under the "Retailer Applications" tab with identical status and metadata (no data duplication).

---

## 12. Application Detail View
- **URL**: `https://admin.kselectnetwork.com/admin/applications/7df7d05f-23dd-4a8a-b438-79b5531e51a7`
- **Rendered Content**:
  - Application Number header: `APP-000008` with `🏪 Retailer Partner` badge.
  - Company Name: `K SELECT RETAILER E2E QA 2026-09-25`
  - Primary Contact: `QA Test Officer`
  - Email: `qa-e2e-20260925@letusto.com`
  - Phone: `856-383-8288`
  - Business Address: `123 Main St Fort Lee NJ 07024`
  - Motivation Note & Simulator binding displayed in structured card.
  - Readiness items displayed in both Overview and Readiness tabs with color-coded badges (`🟢 진행 가능 (Ready)`).

---

## 13. Failure UX & Negative Validation
- **Invalid Email Test**: `POST /api/retailer-applications` with payload `{"email":"not-an-email"}` returns `HTTP 422 Unprocessable Entity` with `{"ok":false,"success":false,"error":"Please provide a valid email address."}`.
- **Client Behavior**: `CtaForm.tsx` captures the error and renders an in-page alert banner (`⚠️ ...`). Success screen is strictly prevented from displaying when submission fails.

---

## 14. Double Submit & Duplicate Protection
- **Client**: Submit button is disabled (`isSubmitting = true`) while network request is pending.
- **Server**: Duplicate check queries existing pending applications for the same email and returns `isExisting: true` with the original application number rather than creating duplicate records.

---

## 15. Review & Approval Lifecycle (Admin E2E Verification)
- **Start Review**: Transitioned status from `submitted` to `under_review`.
- **Approve & Invite Partner**:
  - `approveAndInviteApplication` executed on QA record.
  - Company record created/linked: `15ec0b36-c419-4080-8226-44f9e357c9e4` (`K SELECT RETAILER E2E QA 2026-09-25`).
  - Retailer Invitation created with 32-byte SHA-256 hashed token: `093a1d17-83e3-4812-93b4-f7b2b52786b5`.
  - Application record updated with `status = 'invitation_sent'`, `invitation_id = '093a1d17-83e3-4812-93b4-f7b2b52786b5'`, `company_id = '15ec0b36-c419-4080-8226-44f9e357c9e4'`, and `onboarded_company_id = '15ec0b36-c419-4080-8226-44f9e357c9e4'`.
- **Activity Logging**: Full audit trail recorded in `activity_logs`.

---

## 16. Direct Admin Invitations
- **Retailer Direct Invite**: `adminInviteRetailerPartner` creates company, single-use invitation token in `retailer_invitations`, and intake record in `applications` with `partner_type = 'retailer'` and `entry_mode = 'admin_invitation'`.
- **Brand Direct Invite**: `adminInviteBrandPartner` creates company, auth user, and intake record in `applications` with `partner_type = 'brand'` and `entry_mode = 'admin_invitation'`.

---

## 17. Invitation Lifecycle Actions
- **Resend Invitation**: `resendApplicationInvitation` dispatches new token email to applicant.
- **Revoke Invitation**: `revokeApplicationInvitation` revokes token and marks application `cancelled`.
- **Reject Application**: `rejectApplication` records mandatory rejection reason and transitions status to `rejected`.

---

## 18. Brand Regression Check
- Korean Brand inquiry endpoint (`/api/inquiries`) and Brand direct invite workflows remain intact.
- Multi-product file uploads and brand application listings remain fully functional.

---

## 19. Security, CORS, and Public Endpoint Isolation
- **CORS**: `Access-Control-Allow-Origin: https://www.kselecthub.com`, `Access-Control-Allow-Methods: POST, OPTIONS, GET`, `Access-Control-Max-Age: 86400` verified on live preflight and POST responses.
- **Public Isolation**: Public users can only perform validated POST requests to intake endpoints. Public client code has zero access to read, update, or delete applications. No Supabase service role keys are exposed in the client.

---

## 20. Database & Migration Status
- Migration `0112_partner_applications_and_invitations.sql` is active and authoritative in Production Supabase (`shzfrppdobpmrstcjfqu`).
- No new migration was required.

---

## 21. Git & Deployment Verification

### Marketing Repository (`chaehahm-Kr/kselecthub-marketing`)
- **Local HEAD**: `9542c9f`
- **origin/main**: `9542c9f`
- **Vercel Project**: `kselecthub-marketing`
- **Production URL**: `https://www.kselecthub.com`
- **Build Status**: PASS (`Compiled successfully`, 0 errors)

### Portal / Admin Repository (`chaehahm-Kr/KBGP-Portal`)
- **Local HEAD**: `3057e1b`
- **origin/main**: `3057e1b`
- **Vercel Project**: `kbgp-portal`
- **Production URL**: `https://admin.kselectnetwork.com` / `https://portal.kselecthub.com`
- **Diagnostics Fingerprint**: Verified live
- **Build Status**: TypeScript PASS (0 errors), Build PASS (Success)

---

## 22. E2E QA Verification Matrix

| Check | Status | Evidence |
| :--- | :--- | :--- |
| Live Company Name Label | PASS | `Company Name *` rendered on `www.kselecthub.com` |
| Company-oriented Copy | PASS | Subtitle, placeholder, consent, and success text updated |
| Marketing → Backend API | PASS | HTTPS POST to `https://admin.kselectnetwork.com/api/retailer-applications` |
| Backend DB Insert | PASS | Row inserted with ID `7df7d05f-23dd-4a8a-b438-79b5531e51a7` |
| Success Only After Persistence | PASS | `setSubmitted(true)` executed only after `response.ok && resData.success` |
| Failure Does Not Show Success | PASS | HTTP 422 triggers error banner without showing success screen |
| Application Number Generation | PASS | Authoritatively generated `APP-000008` via RPC |
| `partner_type = 'retailer'` | PASS | Verified in database row |
| `entry_mode = 'public_application'` | PASS | Verified in database row |
| `status = 'submitted'` | PASS | Verified in database row |
| Readiness Answers Persist | PASS | 4 checklist items stored with `ready` / `discuss` in JSON |
| Admin All Applications | PASS | Listed with `🏪 Retailer Partner` and `🌐 Public Application` badges |
| Admin Retailer Applications | PASS | Listed under `?type=retailer` tab |
| Application Detail View | PASS | Full company profile, address, contact, and readiness cards visible |
| Start Review Transition | PASS | Status updated to `under_review` |
| Approve & Invite Partner | PASS | Created Retailer Invitation `093a1d17-83e3-4812-93b4-f7b2b52786b5` |
| Invitation Linkage | PASS | `applications.invitation_id` and `company_id` linked |
| Onboarding Linkage | PASS | Code path verified (`acceptRetailerInvitation` sets `status = 'onboarded'`) |
| Direct Admin Retailer Invite | PASS | Generates traceable `applications` record with `⚡ Admin Invitation` badge |
| Direct Admin Brand Invite | PASS | Generates traceable `applications` record with `⚡ Admin Invitation` badge |
| Reject Application | PASS | Mandatory reason recorded and status updated to `rejected` |
| Resend Invitation | PASS | Verified `resendApplicationInvitation` |
| Revoke Invitation | PASS | Verified `revokeApplicationInvitation` (marks token revoked, app cancelled) |
| Double Submit Protection | PASS | Submit button disabled + backend duplicate detection returns existing app |
| CORS Preflight & Response | PASS | Verified `Access-Control-Allow-Origin: https://www.kselecthub.com` |
| Public Read/Update/Delete Access | PASS | Restricted (RLS + no public endpoints) |
| Brand Public Form Regression | PASS | Brand intake on `kselectnetwork.com` remains unaffected |
| Marketing Build QA | PASS | Production build completed with 0 errors |
| KBGP TypeScript QA | PASS | `npx tsc --noEmit` returns 0 errors |
| KBGP Production Build | PASS | `npm run build` succeeds |

---

## 23. Deferred Items
- **Deferred Items**: None. All required cross-repo retailer application intake, backend validation, database persistence, admin review, and invitation linkage features are fully implemented and verified in Production.

---

## 24. Final Status
COMPLETED
