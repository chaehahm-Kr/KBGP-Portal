-- Migration 0115: Brand & Retailer Agreement Template Management
-- ADM-AGR-002

-- 1. Add agreement_type, created_by, notes columns to public.agreement_templates
ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS agreement_type text NOT NULL DEFAULT 'BRAND_SUPPLIER';
ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS notes text;

-- 2. Update existing records to BRAND_SUPPLIER
UPDATE public.agreement_templates SET agreement_type = 'BRAND_SUPPLIER' WHERE agreement_type IS NULL OR agreement_type = '';

-- 3. Replace old unique constraint with type + version unique constraint
ALTER TABLE public.agreement_templates DROP CONSTRAINT IF EXISTS uq_agreement_template_name_version;
ALTER TABLE public.agreement_templates DROP CONSTRAINT IF EXISTS uq_agreement_template_type_version;
ALTER TABLE public.agreement_templates ADD CONSTRAINT uq_agreement_template_type_version UNIQUE (agreement_type, version);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_agreement_templates_type ON public.agreement_templates(agreement_type);
CREATE INDEX IF NOT EXISTS idx_agreement_templates_type_status ON public.agreement_templates(agreement_type, status);

-- 5. Seed Initial Retailer Agreement Template Version 1.0 (Active)
INSERT INTO public.agreement_templates (
  agreement_type,
  name,
  version,
  status,
  source_pdf_path,
  letusto_signer_name,
  letusto_signer_title,
  letusto_company_name,
  letusto_address,
  initial_term_years,
  renewal_term_years,
  non_renewal_notice_days,
  notes,
  activated_at
) VALUES (
  'RETAILER',
  'Retailer Supply & K SELECT Platform Agreement',
  '1.0',
  'active',
  '/agreements/retailer_template_v1.pdf',
  'Chae Hahm',
  'CEO',
  'Letusto Inc.',
  '23B Roland Ave. Mount Laurel NJ 08054 USA',
  2,
  2,
  90,
  'Initial Retailer Agreement Template (S1 source specification)',
  now()
) ON CONFLICT (agreement_type, version) DO NOTHING;
