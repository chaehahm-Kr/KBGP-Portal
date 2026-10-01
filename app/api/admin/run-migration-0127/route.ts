import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const sql = `
    ALTER TABLE public.applications
      ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_applications_admin_read_at ON public.applications(admin_read_at);

    ALTER TABLE public.po_requests
      ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_po_requests_admin_read_at ON public.po_requests(admin_read_at);

    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_products_admin_read_at ON public.products(admin_read_at);

    ALTER TABLE public.supplier_invoices
      ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_supplier_invoices_admin_read_at ON public.supplier_invoices(admin_read_at);

    UPDATE public.applications
      SET admin_read_at = COALESCE(submitted_at, created_at, now())
      WHERE admin_read_at IS NULL;

    UPDATE public.po_requests
      SET admin_read_at = COALESCE(submitted_at, created_at, now())
      WHERE admin_read_at IS NULL;

    UPDATE public.products
      SET admin_read_at = COALESCE(created_at, now())
      WHERE admin_read_at IS NULL;

    UPDATE public.supplier_invoices
      SET admin_read_at = COALESCE(submitted_at, created_at, now())
      WHERE admin_read_at IS NULL;
  `;

  const { data, error } = await admin.rpc("exec_sql", { sql_query: sql });

  const [appsCheck, poCheck, prodsCheck, invCheck] = await Promise.all([
    admin.from("applications").select("id, admin_read_at").limit(1),
    admin.from("po_requests").select("id, admin_read_at").limit(1),
    admin.from("products").select("id, admin_read_at").limit(1),
    admin.from("supplier_invoices").select("id, admin_read_at").limit(1),
  ]);

  return NextResponse.json({
    rpcResult: data,
    rpcError: error?.message,
    status: {
      applications: !appsCheck.error,
      po_requests: !poCheck.error,
      products: !prodsCheck.error,
      supplier_invoices: !invCheck.error,
    },
    errors: {
      applications: appsCheck.error?.message,
      po_requests: poCheck.error?.message,
      products: prodsCheck.error?.message,
      supplier_invoices: invCheck.error?.message,
    },
  });
}
