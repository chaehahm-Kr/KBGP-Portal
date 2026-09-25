import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRetailerSupportInquiries,
  getRetailerCaseCreationContext,
} from "@/lib/retailer/support-actions";
import { SupportView } from "@/components/retailer/support-view";

export const dynamic = "force-dynamic";

export default async function RetailerSupportPage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // Fetch company info
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, companies(id, name)")
    .eq("id", session.userId)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "Retailer Partner";
  const companyRole = companyUser?.company_role || "owner";

  // Fetch retailer specific role & primary store
  const { data: retailerRole } = await adminClient
    .from("retailer_user_roles")
    .select("role, default_store_id")
    .eq("user_id", session.userId)
    .maybeSingle();

  const [inquiries, context] = await Promise.all([
    getRetailerSupportInquiries(),
    getRetailerCaseCreationContext(),
  ]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <SupportView
        initialInquiries={inquiries}
        context={context}
        companyName={companyName}
        userRole={retailerRole?.role || companyRole}
        userStoreId={retailerRole?.default_store_id || null}
      />
    </div>
  );
}
