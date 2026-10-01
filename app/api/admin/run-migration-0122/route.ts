import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const sql = `
    ALTER TABLE public.company_users 
      ADD COLUMN IF NOT EXISTS english_name text;

    COMMENT ON COLUMN public.company_users.english_name IS 'Official English legal/business name used for POs, Invoices, English agreements, and shipping/export documents.';
  `;

  // Try rpc exec_sql
  const { data, error } = await admin.rpc("exec_sql", { sql_query: sql });

  // Test selecting english_name from company_users
  const { data: users, error: selectErr } = await admin
    .from("company_users")
    .select("id, name, english_name, email")
    .limit(5);

  return NextResponse.json({
    rpcResult: data,
    rpcError: error?.message,
    tableReady: !selectErr,
    usersCount: users?.length || 0,
    sampleUsers: users,
    selectError: selectErr?.message,
  });
}
