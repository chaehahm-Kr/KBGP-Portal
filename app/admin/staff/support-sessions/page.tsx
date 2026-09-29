import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupportSessionLogsAction } from "@/lib/auth/impersonation-actions";
import { SupportSessionLogsClient } from "@/components/admin/support-session-logs-client";

export const metadata: Metadata = {
  title: "Support Session Logs | K SELECT NETWORK 관리자 콘솔",
};

export const dynamic = "force-dynamic";

export default async function SupportSessionLogsPage() {
  await verifyAdminSession();
  const admin = createAdminClient();

  // 1. Fetch initial logs
  const { logs } = await getSupportSessionLogsAction();

  // 2. Fetch staff members list for drilldown filter
  const { data: staff } = await admin
    .from("staff_members")
    .select("id, name, email")
    .order("name", { ascending: true });

  // 3. Fetch company list for company filter
  const { data: companies } = await admin
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <SupportSessionLogsClient
      initialLogs={logs || []}
      staffMembers={staff || []}
      companies={companies || []}
    />
  );
}
