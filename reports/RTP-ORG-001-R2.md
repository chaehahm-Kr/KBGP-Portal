# RTP-ORG-001-R2: Retailer Account Information Architecture & Company/Store Separation Report

## 1. Information Architecture Before / After

### Before
- **Tab 1: Profile & Organization**: Mixed personal profile, company details, store locations, and theme toggle in one single crowded overview.
- **Tab 2: Team & Staff Access**: Staff roster & invitations.
- **Tab 3: Agreements & Documents**: Agreement PDF archive.

### After (4 Clear Functional Tabs)
- **Tab 1: Account Information** (`/account` or `/account?tab=account`):
  - Personal Profile (Display Name, Login Email, Phone, Assigned Retailer Role, Self-service Edit Profile).
  - Login & Security (Authentication method, active session indicator, permission scope, Sign Out).
- **Tab 2: Company & Store Locations** (`/account?tab=organization`):
  - **Section A: Company Information**: Legal entity name, Registration / Tax ID, Primary contact, Company email/phone, Headquarters / Billing address, Commercial terms badge (Admin underwritten), Edit Company action (Owner only).
  - **Section B: Physical Store Locations**: Independent section with `[+ Add Store]` button, store list cards with store name, code, status badge (Active/Inactive), physical address, phone, email, manager name/phone, Edit and Deactivate/Reactivate actions. Empty state when 0 stores exist.
  - **Add Store Convenience**: `[ ] Same as Company Address` pre-fill checkbox that populates store address from corporate HQ while saving as an independent Store record.
- **Tab 3: Team & Staff Access** (`/account?tab=team`):
  - Preserved RTP-ORG-001 team management view with invites, role assignments, store access, resend/revoke.
- **Tab 4: Agreements & Documents** (`/account?tab=documents`):
  - Preserved RTP-AGR-001 executed Operating Agreements, PDF preview, PDF download, and general document archive.

---

## 2. Company vs Store Entity Separation
- **Principle**: A Company (legal entity) is distinct from a Store (physical retail operating location).
- Even if a retailer company operates only ONE physical storefront, that store exists and is managed as a distinct `stores` record.
- Adding a store with "Same as Company Address" copies address fields for initial convenience without merging or synchronizing the underlying entities.
- Zero-store empty state informs user that stores must be added to enable ordering and inventory counting.

---

## 3. Theme & Interface Redundancy Removal
- The redundant "Theme & Interface" card was removed from the Account page.
- The global Theme Toggle in the header/top-right menu continues to handle light/dark/system mode preferences cleanly.

---

## 4. Permissions & Security
- Edit Company Information and Add/Edit Store Locations remain strictly restricted to authorized roles (Owner / Buyer).
- Self-role modification remains blocked on both client UI and server actions (`updatePersonalProfileAction`).

---

## 5. Parallel Agent Merge & Safety
- Pulled latest `origin/main` (including PORT-PO-012-R2 and RTP-PRD-001-R1).
- Verified zero conflicts with RTP-AGR-001 agreement viewer and RTP-ORG-001 team management.

---

## 6. QA & Verification
- **TypeScript**: PASS (0 errors, `npx tsc --noEmit`)
- **Production Build**: PASS (`npm run build` Success)
- **Database Migrations**: NO migrations required.
