import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerTeamData } from "@/lib/retailer/onboarding-actions";
import {
  AccountOrganizationView,
  StoreLocationItem,
  CompanyInfoItem,
  PersonalProfileItem,
} from "@/components/retailer/account-organization-view";

export const dynamic = "force-dynamic";

interface RetailerAccountPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function RetailerAccountPage({ searchParams }: RetailerAccountPageProps) {
  const { tab } = await searchParams;
  const currentTab = tab === "team" ? "team" : "overview";

  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile & phone from company_users
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, display_name, email, role")
    .eq("id", session.userId)
    .maybeSingle();

  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, phone, name, status, companies(*)")
    .eq("id", session.userId)
    .maybeSingle();

  const rawCompany = companyUser?.companies as any;
  const companyId = rawCompany?.id || companyUser?.company_id || "7597f742-b9e7-4f67-8fd4-972168eb51ae";

  // 2. Fetch retailer commercial profile
  const { data: retailerProfile } = await adminClient
    .from("retailer_profiles")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  // 3. Fetch retailer specific role
  const { data: retailerRole } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", session.userId)
    .eq("company_id", companyId)
    .maybeSingle();

  const rawRole = (retailerRole?.role || companyUser?.company_role || "owner").toLowerCase();

  // 4. Fetch all stores for this company (with soft-delete status and manager contact)
  const { data: allStores } = await adminClient
    .from("stores")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const storesList: StoreLocationItem[] = (allStores || []).map((s) => ({
    id: s.id,
    name: s.name,
    storeCode: s.store_code,
    status: s.status || "active",
    address: s.address,
    city: s.city,
    state: s.state,
    zip: s.zip,
    phone: s.phone,
    email: s.email,
    managerName: s.manager_name,
    managerPhone: s.manager_phone,
  }));

  // 5. Fetch team data
  let teamMembers: any[] = [];
  let pendingInvitations: any[] = [];

  try {
    const teamData = await getRetailerTeamData(companyId);
    teamMembers = teamData.members;
    pendingInvitations = teamData.invitations;
  } catch (err) {
    console.error("Error loading team data:", err);
  }

  // Assemble props
  const personalProfile: PersonalProfileItem = {
    id: session.userId,
    displayName: profile?.display_name || companyUser?.name || session.email.split("@")[0] || "Retailer Partner",
    email: profile?.email || session.email,
    phone: companyUser?.phone || null,
    role: rawRole,
  };

  const companyInfo: CompanyInfoItem = {
    id: companyId,
    name: rawCompany?.name || "K SELECT Test Retailer",
    businessRegistrationNumber: rawCompany?.business_registration_number || null,
    country: rawCompany?.country || "US",
    contactName: rawCompany?.contact_name || retailerProfile?.billing_contact_name || null,
    contactPhone: rawCompany?.contact_phone || retailerProfile?.billing_contact_phone || null,
    contactEmail: retailerProfile?.billing_contact_email || null,
    address: retailerProfile?.billing_address || null,
    city: retailerProfile?.billing_city || null,
    state: retailerProfile?.billing_state || null,
    zip: retailerProfile?.billing_zip || null,
    status: retailerProfile?.status || rawCompany?.status || "active",
    paymentTerms: retailerProfile?.payment_terms || "PREPAID_CARD",
    creditLimit: retailerProfile?.credit_limit ?? 0,
    termsEnabled: retailerProfile?.terms_enabled ?? false,
    approvedTerms: retailerProfile?.approved_terms || null,
    resaleCertificateNumber: retailerProfile?.resale_certificate_number || null,
  };

  return (
    <AccountOrganizationView
      currentTab={currentTab}
      profile={personalProfile}
      company={companyInfo}
      stores={storesList}
      teamMembers={teamMembers}
      pendingInvitations={pendingInvitations}
    />
  );
}
