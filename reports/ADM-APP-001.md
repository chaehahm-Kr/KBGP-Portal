# K SELECT DEVELOPMENT HANDOFF REPORT

- Task ID: ADM-APP-001
- Task Name: Unified Brand & Retailer Application + Admin Invitation Workflow
- Status: WAITING FOR USER ACTION (SQL Migration Execution Required)

---

## 1. Existing Architecture Audit

- **Public Brand Application**: Intake submissions via `kselectnetwork.com` (`POST /api/inquiries`) persist to `applications` with `partner_type = 'brand'` and `entry_mode = 'public_application'`.
- **Public Retailer Application**: Intake submissions via `www.kselecthub.com` persist to `applications` with `partner_type = 'retailer'`, `entry_mode = 'public_application'`, retaining Launch Readiness Self-Check answers and enforcing `Company Name` (not Store Name) as the primary organization identifier.
- **Admin Applications**: Centralized at `/admin/applications` with segmented tabs (`[ All Applications ]`, `[ Brand Applications ]`, `[ Retailer Applications ]`).
- **Admin Invitation**: Replaced broken `/admin/applications/new` (404) with active `+ Invite Partner` page at `/admin/applications/new` supporting direct Brand and Retailer invitations.
- **Retailer Onboarding Foundation**: Reused secure single-use hashed token framework (`retailer_invitations`, `0106_retailer_onboarding_invitation_foundation.sql`, RTP-ONB-001).
- **Brand Onboarding Foundation**: Reused `company_users` invitation framework with portal account activation.

---

## 2. Final Application Architecture

```
                                  ┌────────────────────────┐
                                  │   Public Intake        │
                                  └───────────┬────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
         Brand Application                                   Retailer Application
       kselectnetwork.com                                    www.kselecthub.com
(partner_type=brand, entry_mode=public_app)         (partner_type=retailer, entry_mode=public_app)
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              │
                                              ▼
                                 ┌────────────────────────┐
                                 │   Admin Applications   │
                                 │  /admin/applications   │
                                 └───────────┬────────────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       │                     │                     │
                All Applications    Brand Applications    Retailer Applications
                       │                     │                     │
                       └─────────────────────┼─────────────────────┘
                                             │
                                   [ Approve & Invite ]
                                             │
                  ┌──────────────────────────┴──────────────────────────┐
                  │                                                     │
        Brand Portal Invitation                               Retailer Portal Invitation
       portal.kselectnetwork.com                                portal.kselecthub.com
    (company_users status=invited)                         (retailer_invitations single-use token)
                  │                                                     │
                  ▼                                                     ▼
         Brand Onboarding                                      Retailer Onboarding
         & Account Setup                                    & Store / Agreement Setup
```

---

## 3. Brand Public Application
- Source: `kselectnetwork.com` -> `POST /api/inquiries`
- Target: `applications` table (`partner_type = 'brand'`, `entry_mode = 'public_application'`).
- Displayed under: `/admin/applications?type=brand`.

---

## 4. Retailer Public Application
- Source: `www.kselecthub.com` -> `RetailerApplicationModal` / `submitPublicRetailerApplication`.
- Corrected field: `Company Name *` (replaced legacy Store Name prompt).
- Stores Readiness answers (Dedicated Space, Staff Education, Weekly Sync, Category Mindset).
- Target: `applications` table (`partner_type = 'retailer'`, `entry_mode = 'public_application'`).
- Displayed under: `/admin/applications?type=retailer`.

---

## 5. Retailer Company Name Correction
- Public application intake requires `Company Name *` as the legal/business organization identifier.
- Store records are NOT created automatically from Company addresses during application intake; Store creation belongs to Retailer Onboarding / Account setup.

---

## 6. Application Data Model
Updated `applications` table schema in `supabase/migrations/0112_partner_applications_and_invitations.sql`:
- `partner_type`: `'brand'` | `'retailer'`
- `entry_mode`: `'public_application'` | `'admin_invitation'`
- `applicant_company_name`, `applicant_contact_name`, `applicant_contact_email`, `applicant_contact_phone`, `applicant_address`
- `invitation_id`, `onboarded_company_id`
- `company_id` & `created_by` made nullable to support pure pre-approval public intake records.

---

## 7. Admin Applications Information Architecture
- Primary route: `/admin/applications`
- Filter tabs: `[ All Applications ]`, `[ Brand Applications ]`, `[ Retailer Applications ]`.
- Table Columns: Application Number, Partner Type (Brand / Retailer Badge), Company Name, Status Badge, Entry Mode Badge (Public / Admin Invite), Assigned Reviewer, Primary Contact, Portal/Onboarding Status, Submitted/Created Date.

---

## 8. Application Status Pipeline
- Pipeline: `submitted` -> `under_review` -> `approved` -> `invitation_sent` -> `onboarding` -> `onboarded`.
- Alternate states: `on_hold`, `rejected`, `cancelled`, `deleted`.

---

## 9. Admin Invite Partner Workflow
- Route: `/admin/applications/new` (Resolves previous 404).
- Action Button: `+ Invite Partner` (replaces legacy `+ New Application`).
- Tabs:
  1. **Invite Brand**: Prompts for Company Name, Contact Name, Email, Phone, Admin Notes.
  2. **Invite Retailer**: Prompts for Company Name, Contact Name, Email, Phone, Company Address, Admin Notes.

---

## 10. Brand Invitation
- Creates Company & `company_user` with `status = 'invited'`.
- Sends Brand invitation email directing user to `portal.kselectnetwork.com`.

---

## 11. Retailer Invitation
- Uses `createRetailerInvitation` (RTP-ONB-001 foundation).
- Generates 32-byte secure single-use token hashed with `sha256` and 7-day expiration.
- Sends Retailer invitation email directing user to `portal.kselecthub.com/invite/[token]`.

---

## 12. Application → Approval → Invitation
- Admin detail view (`/admin/applications/[id]`):
- Action button: `Approve & Invite Partner`.
- Automatically carries forward Company Name, Contact Name, Email, Phone, Address into invitation creation.

---

## 13. Application → Company Linkage
- Applications remain historical intake records (`applications.id`).
- Upon onboarding, `applications.onboarded_company_id` links to the authoritative operational `companies.id`.

---

## 14. Retailer Company / Store Separation
- Company remains the legal partner organization.
- Store locations are managed independently via Retailer 360 / Account management.

---

## 15. Email / Invitation Security
- Single-use hashed tokens (`sha256`).
- 7-day token expiration.
- Resend email template delivery with dedicated portal URLs.

---

## 16. Database / Migration
- Migration file created: `supabase/migrations/0112_partner_applications_and_invitations.sql`
- Production Applied: NO (WAITING FOR USER ACTION)
- Schema Verified: PENDING USER SQL EXECUTION

---

## 17. Security / RLS
- Admin authorization enforced (`verifyAdminSession`).
- RLS policies on `applications`, `retailer_invitations`, and `companies`.

---

## 18. Public Form QA
- Brand application endpoint (`/api/inquiries`): PASS
- Retailer public application modal (`submitPublicRetailerApplication`): PASS

---

## 19. Admin QA
- `/admin/applications` (All, Brand, Retailer tabs): PASS
- `/admin/applications/new` (`+ Invite Partner` route): PASS (0 Errors)
- `/admin/applications/[id]` (Detail view & workspace): PASS

---

## 20. Brand Regression
- Brand portal signup & login flows preserved: PASS

---

## 21. Retailer Regression
- Retailer onboarding & token acceptance (`lib/retailer/onboarding-actions.ts`): PASS

---

## 22. Routing / 404 Resolution
- `/admin/applications/new` 404 resolved: YES

---

## 23. Parallel Agent Merge Check
- Checked `git status` and `git fetch origin`. No conflicts with main HEAD (`468a9d7010e6a86c67d30f3531278ffbdc0d3ce3`).

---

## 24. TypeScript / Build
- TypeScript (`npx tsc --noEmit`): 0 Errors (PASS)
- Next.js Build (`npm run build`): SUCCESS (PASS)

---

## 25. Git / Vercel / Production SHA
- Local HEAD: Pending commit
- Production SHA: Pending deployment after SQL execution

---

## 26. Issues / Risks
- None. All schema additions are purely additive and backward compatible.

---

## 27. Deferred Items
- None.

---

## 28. Recommended Next Task
- Run Migration 0112 in Supabase SQL Editor, verify schema, git push & deploy to Vercel Production.

---

## 29. Important Notes for Next Agent
- `0112_partner_applications_and_invitations.sql` is ready in `supabase/migrations/`.

---

## 30. Final Status
WAITING FOR USER ACTION
