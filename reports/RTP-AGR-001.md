# RTP-AGR-001: Retailer Agreement PDF, Document Archive & Acceptance Completion Report

## 1. Overview & Objectives
- **Task ID**: `RTP-AGR-001`
- **Task Name**: Retailer Agreement PDF, Document Archive & Acceptance Completion
- **Production Retailer Portal**: `https://portal.kselecthub.com`
- **Production Admin**: `https://admin.kselectnetwork.com`

---

## 2. Completed Deliverables

### A. Authoritative Agreement Version Integrity & Pre-Seeded v1.0
- Created table `public.retailer_agreement_versions` to store authoritative agreement text, effective dates, and statuses.
- Pre-seeded **Version 1.0 (Standard)** containing Articles 1 through 4 (Weekly Inventory Verification, Price & Tag Integrity, 90-Day Protection, Account & Confidentiality).

### B. Acceptance Evidence & Signatory Metadata
- Extended `public.retailer_agreement_acceptances` with:
  - `signer_title`: Signatory role / title (Owner, Buyer, Manager, Accounting, Employee).
  - `signer_email`: Normalized signatory email.
  - `agreement_snapshot`: Exact legal text snapshot at execution time.
  - `pdf_status`: Lifecycle tracker (`pending`, `generated`, `failed`).
  - `pdf_storage_path`, `pdf_filename`, `pdf_generated_at`, `pdf_error`.

### C. Immutable Server-Side PDF Generation (`pdf-lib`)
- Implemented `lib/retailer/agreement-pdf.ts` using `pdf-lib` (pure TypeScript, zero native runtime dependencies).
- Multi-page letter format with:
  - Header & Brand Bar: "K SELECT NETWORK - RETAIL PARTNER OPERATING AGREEMENT".
  - Metadata Box: Organization legal name, Tax ID, Signatory name, Signatory role, Email, IP address, Acceptance ID, Version.
  - Formatted Articles 1–4 with subheadings and indentation.
  - Legal Execution Attestation & Electronic Signature Block.
  - Running header and page numbering footers across all pages ("Page X of Y - Confidential & Authoritative Document").

### D. Secure Storage & Organization Document Archive
- Created table `public.retailer_documents` for tenant-scoped archival files.
- Automatically saves generated agreement PDFs to private Supabase Storage (`company-uploads/retailers/{company_id}/agreements/...`).
- Automatically resolves short-lived signed URLs (1 hour expiry) for secure viewing and download.

### E. Email Confirmation & Attachment Delivery
- Dispatches confirmation emails via Resend with base64-encoded PDF attachments and direct links to the Retailer Portal Document Archive upon onboarding completion.

### F. Retailer Portal "Agreements & Documents" UI
- Added `Agreements & Documents` tab to `/account` (`AccountOrganizationView`).
- Displays executed agreements, active standard badges, signatory information, execution timestamps, `[ 👁️ View PDF ]`, and `[ ⬇️ Download PDF ]` buttons.
- Displays company document archive for other certificates and invoices.

### G. Admin Retailer 360 Supervisory Control
- Added `Retailer Operating Agreement & Legal Evidence` card to `/admin/retailers/[id]` (Payments & Terms tab).
- Provides admin view/download signed URLs and `[ 🔄 Regenerate PDF ]` retry button for failed/legacy acceptances.

---

## 3. Mandatory Supabase SQL Migration
Run the following standalone SQL migration in the Supabase SQL Editor (`shzfrppdobpmrstcjfqu`):

```sql
-- Migration 0111: Retailer Agreement Versions, Document Archive & PDF Lifecycle (RTP-AGR-001)

CREATE TABLE IF NOT EXISTS public.retailer_agreement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  content_text text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_agreement_versions_status 
  ON public.retailer_agreement_versions(status);

INSERT INTO public.retailer_agreement_versions (
  version,
  title,
  effective_date,
  content_text,
  status
) VALUES (
  '1.0',
  'K SELECT Retailer Partner Operating Standards & Agreement',
  '2026-09-01',
  'K SELECT RETAILER PARTNER OPERATING STANDARDS & AGREEMENT (v1.0)

ARTICLE 1: WEEKLY COUNT VERIFICATION & REPORTING
Retailer Partner agrees to perform accurate, defensible weekly inventory counts for all active K SELECT product assortments. Submissions must be completed using the Retailer Portal mobile QR scanner or shelf verification module on a weekly cadence. Timely reporting ensures accurate reorder recommendations, replenishment continuity, and protection eligibility.

ARTICLE 2: STORE PRICE & TAG INTEGRITY
Retailer Partner maintains full autonomy to establish store regular retail prices and promotional sale prices. Retailer agrees to display standardized K SELECT item price tags and preserve common product QR code links to ensure authentic customer transparency and brand integrity.

ARTICLE 3: 90-DAY INITIAL TRIAL PROTECTION
Eligible first-time brand assortments qualify for formal protection review when cumulative store sell-through remains below 50% over the 90-day trial period, provided all required weekly inventory checks were submitted consistently. Approved reviews may result in return authorization, assortment rebalancing, or credit adjustment.

ARTICLE 4: ACCOUNT, STORE ACCESS & TENANT CONFIDENTIALITY
Retailer Partner is responsible for maintaining the confidentiality and access privileges of all authorized company users, roles, and assigned store scopes. User accounts must not be shared outside the retailer organization. Commercial terms, wholesale pricing, and operational records remain strictly confidential between Retailer Partner and K SELECT NETWORK.',
  'active'
) ON CONFLICT (version) DO UPDATE SET
  title = EXCLUDED.title,
  content_text = EXCLUDED.content_text,
  status = EXCLUDED.status;

ALTER TABLE public.retailer_agreement_acceptances
  ADD COLUMN IF NOT EXISTS signer_title text,
  ADD COLUMN IF NOT EXISTS signer_email text,
  ADD COLUMN IF NOT EXISTS agreement_snapshot text,
  ADD COLUMN IF NOT EXISTS pdf_status text NOT NULL DEFAULT 'pending' CHECK (pdf_status IN ('pending', 'generated', 'failed')),
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_error text;

CREATE TABLE IF NOT EXISTS public.retailer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  agreement_acceptance_id uuid REFERENCES public.retailer_agreement_acceptances(id) ON DELETE SET NULL,
  agreement_version text,
  title text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  file_size_bytes bigint,
  signer_name text,
  signer_email text,
  signer_title text,
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_documents_company_id 
  ON public.retailer_documents(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_documents_type 
  ON public.retailer_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_retailer_documents_acceptance_id 
  ON public.retailer_documents(agreement_acceptance_id);

ALTER TABLE public.retailer_agreement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active agreement versions" ON public.retailer_agreement_versions;
CREATE POLICY "Authenticated users can view active agreement versions"
  ON public.retailer_agreement_versions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage agreement versions" ON public.retailer_agreement_versions;
CREATE POLICY "Admins can manage agreement versions"
  ON public.retailer_agreement_versions
  FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Retailers can view own company documents" ON public.retailer_documents;
CREATE POLICY "Retailers can view own company documents"
  ON public.retailer_documents
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Admins and service role can manage retailer documents" ON public.retailer_documents;
CREATE POLICY "Admins and service role can manage retailer documents"
  ON public.retailer_documents
  FOR ALL
  TO authenticated
  USING (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.auth_is_admin()
    OR auth.role() = 'service_role'
  );

NOTIFY pgrst, 'reload schema';
```

---

## 4. Final Deployment Integrity
- **Local HEAD**: `0da382be02fe9e5fb28947a1717a96251524a2a9`
- **origin/main**: `0da382be02fe9e5fb28947a1717a96251524a2a9`
- **Vercel Production**: `0da382be02fe9e5fb28947a1717a96251524a2a9`
- **Custom Domain Runtime**: `0da382be02fe9e5fb28947a1717a96251524a2a9`
