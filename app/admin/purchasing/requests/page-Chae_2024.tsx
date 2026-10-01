import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminPoRequests } from "@/lib/purchase-order/request-actions";
import { AdminPoRequestList } from "@/components/admin/po-request-list";

export const metadata: Metadata = {
  title: "PO Requests Review | K SELECT NETWORK 어드민",
};

export default async function AdminPoRequestsPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  const { requests, counts } = await getAdminPoRequests();

  return (
    <div className="space-y-6">
      <AdminPoRequestList
        initialRequests={requests}
        initialCounts={counts}
        companies={companies ?? []}
      />
    </div>
  );
}
