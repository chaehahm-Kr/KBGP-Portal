import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const sql = `
    CREATE TABLE IF NOT EXISTS public.impersonation_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id text NOT NULL,
      admin_user_id uuid NOT NULL,
      admin_email text NOT NULL,
      target_user_id uuid NOT NULL,
      target_user_email text NOT NULL,
      target_company_id uuid NOT NULL,
      target_company_name text NOT NULL,
      portal_type text NOT NULL,
      action text NOT NULL,
      reason text NOT NULL,
      note text,
      exit_reason text,
      duration_seconds integer,
      ip_address text,
      user_agent text,
      started_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin ON public.impersonation_audit_logs(admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target ON public.impersonation_audit_logs(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_impersonation_logs_company ON public.impersonation_audit_logs(target_company_id);
    CREATE INDEX IF NOT EXISTS idx_impersonation_logs_session ON public.impersonation_audit_logs(session_id);
  `;

  // 1. Try RPC exec_sql if available
  const { data, error } = await admin.rpc("exec_sql", { sql_query: sql });

  // 2. Query impersonation_audit_logs table to test if table exists
  const { data: logs, error: selectErr } = await admin
    .from("impersonation_audit_logs")
    .select("*")
    .limit(10);

  return NextResponse.json({
    rpcResult: data,
    rpcError: error?.message,
    tableReady: !selectErr,
    logsCount: logs?.length || 0,
    selectError: selectErr?.message,
  });
}
