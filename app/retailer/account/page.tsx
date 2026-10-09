import React from "react";
import { redirect } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RetailerAccountSettingsView,
  PersonalProfileItem,
} from "@/components/retailer/retailer-account-settings-view";

export const dynamic = "force-dynamic";

interface RetailerAccountPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function RetailerAccountPage({ searchParams }: RetailerAccountPageProps) {
  const { tab } = await searchParams;

  // Compatibility redirects for legacy tab deep links
  if (tab === "organization" || tab === "company" || tab === "documents") {
    redirect("/settings/company");
  }

  if (tab === "team") {
    redirect("/settings/team");
  }

  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", session.userId)
    .maybeSingle();

  // 2. Fetch company user relation
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, phone, name, status, email")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;

  // 3. Fetch retailer specific role
  const { data: retailerRole } = companyId
    ? await adminClient
        .from("retailer_user_roles")
        .select("role, has_all_stores_access")
        .eq("user_id", session.userId)
        .eq("company_id", companyId)
        .maybeSingle()
    : { data: null };

  const rawRole = (retailerRole?.role || companyUser?.company_role || "owner").toLowerCase();

  const personalProfile: PersonalProfileItem = {
    id: session.userId,
    displayName: profile?.display_name || companyUser?.name || session.email.split("@")[0] || "Retailer Partner",
    email: companyUser?.email || session.email,
    phone: companyUser?.phone || null,
    role: rawRole,
  };

  return <RetailerAccountSettingsView profile={personalProfile} />;
}
