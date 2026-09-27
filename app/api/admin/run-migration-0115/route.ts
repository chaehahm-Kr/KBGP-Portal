import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const sql = `
    ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS agreement_type text NOT NULL DEFAULT 'BRAND_SUPPLIER';
    ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS created_by text;
    ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS notes text;

    UPDATE public.agreement_templates SET agreement_type = 'BRAND_SUPPLIER' WHERE agreement_type IS NULL OR agreement_type = '';

    ALTER TABLE public.agreement_templates DROP CONSTRAINT IF EXISTS uq_agreement_template_name_version;
    ALTER TABLE public.agreement_templates DROP CONSTRAINT IF EXISTS uq_agreement_template_type_version;
    ALTER TABLE public.agreement_templates ADD CONSTRAINT uq_agreement_template_type_version UNIQUE (agreement_type, version);

    CREATE INDEX IF NOT EXISTS idx_agreement_templates_type ON public.agreement_templates(agreement_type);
    CREATE INDEX IF NOT EXISTS idx_agreement_templates_type_status ON public.agreement_templates(agreement_type, status);

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
  `;

  // 1. Try RPC exec_sql if available
  const { data, error } = await admin.rpc("exec_sql", { sql_query: sql });

  // 2. Also query current templates
  const { data: templates, error: selectErr } = await admin
    .from("agreement_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({
    rpcResult: data,
    rpcError: error?.message,
    templatesCount: templates?.length || 0,
    templates,
    selectError: selectErr?.message,
  });
}
