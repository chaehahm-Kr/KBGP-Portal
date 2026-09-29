import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const sql = `
    ALTER TABLE public.impersonation_audit_logs 
      ADD COLUMN IF NOT EXISTS admin_name text,
      ADD COLUMN IF NOT EXISTS target_user_name text,
      ADD COLUMN IF NOT EXISTS expires_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_impersonation_logs_started_at ON public.impersonation_audit_logs(started_at DESC);
  `;

  // Try rpc exec_sql
  const { data, error } = await admin.rpc("exec_sql", { sql_query: sql });

  // Test selecting from impersonation_audit_logs
  const { data: logs, error: selectErr } = await admin
    .from("impersonation_audit_logs")
    .select("*")
    .limit(5);

  return NextResponse.json({
    rpcResult: data,
    rpcError: error?.message,
    tableReady: !selectErr,
    logsCount: logs?.length || 0,
    selectError: selectErr?.message,
  });
}
