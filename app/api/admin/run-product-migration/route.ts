import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-ignore
import pg from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();

  // Test if product_change_logs exists
  const { data: testData, error: testError } = await supabase
    .from("product_change_logs")
    .select("id")
    .limit(1);

  if (!testError) {
    return NextResponse.json({ success: true, message: "Table product_change_logs already exists!" });
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS public.product_change_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      user_email TEXT,
      source TEXT NOT NULL CHECK (source IN ('ADMIN', 'BRAND_PORTAL', 'SYSTEM', 'AUTOMATION')),
      company_name TEXT,
      section TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATUS_CHANGE')),
      summary TEXT NOT NULL,
      changes JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_product_change_logs_product_id ON public.product_change_logs (product_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_product_change_logs_created_at ON public.product_change_logs (created_at DESC);

    ALTER TABLE public.product_change_logs ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_change_logs_select_admin' AND tablename = 'product_change_logs') THEN
        CREATE POLICY "product_change_logs_select_admin" ON public.product_change_logs FOR SELECT TO authenticated USING (public.auth_is_admin());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_change_logs_select_portal' AND tablename = 'product_change_logs') THEN
        CREATE POLICY "product_change_logs_select_portal" ON public.product_change_logs FOR SELECT TO authenticated USING (
          EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.company_users cu ON cu.company_id = p.company_id
            WHERE p.id = product_change_logs.product_id
            AND cu.id = auth.uid()
          )
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_change_logs_insert_authenticated' AND tablename = 'product_change_logs') THEN
        CREATE POLICY "product_change_logs_insert_authenticated" ON public.product_change_logs FOR INSERT TO authenticated WITH CHECK (true);
      END IF;
    END $$;

    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated_by_name TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated_source TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  `;

  // 1. Try direct pg connection with any available connection string
  const pgConn = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (pgConn) {
    try {
      const client = new pg.Client({ connectionString: pgConn, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(sql);
      await client.end();
      return NextResponse.json({ success: true, method: "pg_direct", message: "Migration 0085 applied via POSTGRES_URL!" });
    } catch (pgErr: any) {
      console.error("Direct pg error:", pgErr);
    }
  }

  // 2. Try RPC
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
  return NextResponse.json({ rpcResult: data, rpcError: error?.message, testError: testError?.message });
}
