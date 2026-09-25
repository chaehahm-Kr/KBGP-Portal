# RTP-ONB-001: Retailer Onboarding, Team Invitation & Store Access Foundation

## Task
- Task ID: RTP-ONB-001
- Task Name: Retailer Onboarding, Team Invitation & Store Access Foundation

## Development
- Modified Files:
  - `app/retailer/account/page.tsx` (Added Team & Staff Access tab switcher and live team query)
  - `components/admin/sidebar.tsx` (Added Retailers link under Retail Network navigation)
  - `lib/supabase/proxy.ts` (Whitelisted `/invite` and `/retailer/invite` for unauthenticated onboarding)
- Created Files:
  - `supabase/migrations/0106_retailer_onboarding_invitation_foundation.sql` (Tables `retailer_invitations`, `retailer_agreement_acceptances`, RLS policies)
  - `lib/retailer/onboarding-types.ts` (Core types for invitations, roles, team members, validation)
  - `lib/retailer/onboarding-actions.ts` (Token hashing/verification, accept flow, invitation lifecycle, Resend emails)
  - `lib/retailer/admin-retailer-actions.ts` (Admin actions for retailer creation, terms management, store creation, staff invitation)
  - `app/retailer/account/team-actions.ts` (Server actions for retailer team member invitation, resend, revoke)
  - `components/retailer/onboarding-wizard.tsx` (4-step onboarding wizard for credential setup, store confirmation, agreement acceptance)
  - `components/retailer/team-management-view.tsx` (Team member management, roles, store access matrix, pending invites)
  - `components/admin/retailers-list.tsx` (Admin searchable table of all retailer companies, stores, commercial terms, active/pending users)
  - `components/admin/retailer-create-form.tsx` (Admin onboarding form for company, initial store, credit terms, owner invitation)
  - `components/admin/retailer-detail-view.tsx` (Admin 360 detail management, commercial setup, store list, agreement audit log)
  - `app/invite/[token]/page.tsx` (Public invitation acceptance page)
  - `app/retailer/invite/[token]/page.tsx` (Retailer host alias for invitation acceptance)
  - `app/admin/retailers/page.tsx` (Admin Retailers List page)
  - `app/admin/retailers/new/page.tsx` (Admin New Retailer Onboarding page)
  - `app/admin/retailers/[id]/page.tsx` (Admin Retailer Detail & Terms page)
- Migration Files:
  - `supabase/migrations/0106_retailer_onboarding_invitation_foundation.sql`

## QA
- TypeScript: `npx tsc --noEmit` PASS (0 errors)
- Build: `npm run build` PASS (Turbopack compile successful)
- Functional Test: Token validation, single-use security, role permission filtering, Resend branded email dispatch

## Git
- Commit SHA: `6790619079bbbd03bef66eadb8fec26d80d5c560`
- Commit Message: `feat(retailer): RTP-ONB-001 retailer onboarding, team invitation & store access foundation`
- origin/main SHA: `6790619079bbbd03bef66eadb8fec26d80d5c560`
- Push Status: Cleanly pushed to `origin/main`

## Vercel
- Production Deployment: `kbgp-portal-mqcne3bd2-letusto.vercel.app`
- Production SHA: `6790619079bbbd03bef66eadb8fec26d80d5c560`
- Deployment Status: Ready

## Production Domain
- Admin: `https://admin.kselectnetwork.com`
- Portal: `https://portal.kselecthub.com`

## Supabase
- Production Project Ref: `shzfrppdobpmrstcjfqu`
- Migration Applied: Migration `0106` applied to Production DB
- Schema Verified: `retailer_invitations`, `retailer_agreement_acceptances` tables, constraints, indexes & RLS active

## Production Browser QA
- Tested URL: `https://portal.kselecthub.com/account?tab=team`, `https://admin.kselectnetwork.com/admin/retailers`
- Scenario: Verified Admin Retailer Creation, Onboarding link generation, Team & Staff access control, store scope mapping, agreement audit trail
- Persistence: All data persisted in Supabase with tenant isolation
- Regression: Existing weekly check, products, pricing, orders, training, and protection workflows verified intact

## Final Integrity
- Local HEAD = origin/main = Vercel Production = Custom Domain Runtime: YES
- Production Supabase Migration Applied & Schema Verified: YES

## Final Status
COMPLETE
