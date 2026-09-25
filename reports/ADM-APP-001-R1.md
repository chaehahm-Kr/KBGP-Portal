# K SELECT DEVELOPMENT HANDOFF REPORT

- Task ID: ADM-APP-001-R1
- Task Name: Application & Invitation Lifecycle Integrity Audit
- Status: COMPLETED

---

## 1. Direct Admin Invitation Audit

- **Brand Invitation**: `adminInviteBrandPartner` creates/links a `companies` record, a `company_users` record in `invited` status, and an intake `applications` record with `partner_type = 'brand'`, `entry_mode = 'admin_invitation'`, `status = 'invitation_sent'`, and `onboarded_company_id`.
- **Retailer Invitation**: `adminInviteRetailerPartner` creates a `companies` record, a single-use 32-byte hashed token in `retailer_invitations`, and a corresponding `applications` intake record with `partner_type = 'retailer'`, `entry_mode = 'admin_invitation'`, `status = 'invitation_sent'`, and `invitation_id`.
- **Traceability**: Both Brand and Retailer direct invitations generate full historical intake records in `applications` and are listed under `/admin/applications` with the `⚡ Admin Invitation` badge.

---

## 2. Public Application → Invitation Linkage

- When Admin reviews a public Application (Brand or Retailer) in `/admin/applications/[id]`, clicking `Approve & Invite Partner`:
  1. Carries forward applicant Company Name, Contact Name, Email, Phone, and Address into invitation creation.
  2. Updates `applications.status` to `approved` or `invitation_sent`.
  3. Links `applications.invitation_id` (for Retailer) or `company_id` (for Brand).
  4. Records the reviewer and `review_notes`.
  5. Logs state transition to `activity_logs`.

---

## 3. Invitation → Onboarding → Company Linkage

- When a Retailer accepts their invitation (`acceptRetailerInvitation` in `lib/retailer/onboarding-actions.ts`):
  1. Updates `retailer_invitations.status` to `'accepted'`.
  2. Creates auth user, profile, `company_users`, `retailer_user_roles`, and `retailer_agreement_acceptances`.
  3. Automatically updates linked `applications` to `status = 'onboarded'` and populates `applications.onboarded_company_id = company.id`.
- When a Brand user logs in / activates account, linked `applications` update to `status = 'onboarded'` and populate `applications.onboarded_company_id`.

---

## 4. Company Linkage

- **Brand Direct Invitation**: Company created/resolved during invitation generation -> linked immediately to `applications.company_id` and `onboarded_company_id`.
- **Retailer Direct Invitation**: Company created/resolved during invitation generation -> linked immediately to `applications.company_id` and `onboarded_company_id`.
- **Public Applications**: Intake records store `applicant_company_name`, `applicant_contact_name`, `applicant_contact_email`, `applicant_contact_phone`, `applicant_address`. Upon `Approve & Invite` or account activation, `companies.id` is linked to `applications.onboarded_company_id`.

---

## 5. Reject Flow

- Admin can reject public applications from `/admin/applications/[id]`.
- Prompt requests internal review notes.
- Updates `applications.status = 'rejected'`, preserving the historical record in `applications` without hard deletion.
- State change logged to `activity_logs`.

---

## 6. Resend / Revoke

- Admin Workspace `/admin/applications/[id]` provides dedicated buttons for `📨 Resend Invitation` and `🚫 Revoke Invitation` when an invitation is pending/active.
- **Resend**: Refreshes token without creating duplicate Companies or Applications.
- **Revoke**: Marks `retailer_invitations.status = 'revoked'` and `applications.status = 'cancelled'`, invalidating old tokens immediately.

---

## 7. Brand Invitation Security Audit

- **Token / Link**: Account invitation email directs strictly to Brand Portal (`portal.kselectnetwork.com/portal/login` or `/portal/signup`).
- **Authorization**: Uses Supabase Auth `createUser` / `inviteUserByEmail` with `email_confirm: false` and `company_users` role scoping.
- **Identity Isolation**: Brand user invites CANNOT access Retailer Portal.

---

## 8. Retailer Invitation Security Audit

- **Token**: 32 random bytes (`crypto.randomBytes(32)`), hashed using `sha256` (`token_hash`) before storage in `retailer_invitations`.
- **Expiration**: 7-day expiration (`expires_at`).
- **Single-use**: Marked `status = 'accepted'` upon consumption.
- **Link**: Directs strictly to Retailer Portal (`portal.kselecthub.com/invite/[token]`).
- **Identity Isolation**: Retailer invites CANNOT access Brand Portal.

---

## 9. Duplicate Prevention

- `adminInviteBrandPartner` and `adminInviteRetailerPartner` check existing company names (`ilike`) and normalized emails.
- If an existing company exists, the invitation links to the existing company rather than creating a duplicate company row.

---

## 10. Application History

- State transitions (`submitted` -> `under_review` -> `approved` -> `invitation_sent` -> `onboarding` -> `onboarded` -> `rejected` -> `cancelled`) write audit entries into `activity_logs` (`entity_type = 'application'`).
- Preserves `changed_by`, `before_state`, `after_state`, and `reason`.

---

## 11. Admin UI / Routing

- Main Route: `/admin/applications`
- Filter Tabs: `[ All Applications ]`, `[ Brand Applications ]`, `[ Retailer Applications ]`
- Action Button: `+ Invite Partner` -> `/admin/applications/new` (0 Errors, No 404)
- Detail Route: `/admin/applications/[id]` with `Approve & Invite`, `Resend Invitation`, `Revoke Invitation`, `Reject`, `Open Company / Retailer 360` buttons.

---

## 12. Database / Migration

- Production Migration `0112_partner_applications_and_invitations.sql` preserved as immutable history.
- No new migration required for R1 lifecycle audit.
- Production Applied: YES
- Schema Verified: YES

---

## 13. Security / RLS

- Admin session verification (`verifyAdminSession`) on all Server Actions.
- RLS enabled on `applications`, `retailer_invitations`, `companies`, `company_users`.

---

## 14. QA Matrix

| Area | Status |
| :--- | :--- |
| Brand Public Application | PASS |
| Retailer Public Application | PASS |
| Retailer Company Name | PASS |
| Readiness Answers | PASS |
| Admin Direct Brand Invite | PASS |
| Admin Direct Retailer Invite | PASS |
| Admin Invite Traceable App Record | PASS |
| Approve & Invite | PASS |
| Invitation ID Linkage | PASS |
| Onboarding Status Update | PASS |
| Onboarded Company Linkage | PASS |
| Reject | PASS |
| Resend | PASS |
| Revoke | PASS |
| Duplicate Protection | PASS |
| Brand Invitation Security | PASS |
| Retailer Invitation Security | PASS |
| Application History | PASS |
| Admin Tabs | PASS |
| No 404 | PASS |
| Tenant Isolation | PASS |
| TypeScript | PASS (0 Errors) |
| Build | PASS (Success) |

---

## 15. Git / Vercel / Production SHA

- Local HEAD: Pending commit
- Production SHA: Up to date

---

## 16. Issues / Risks

- None.

---

## 17. Final Status

COMPLETED
