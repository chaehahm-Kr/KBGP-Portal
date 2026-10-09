import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyAgreement } from "@/lib/agreement/actions";
import { getRetailerCompanyAgreementsAndDocuments } from "@/lib/retailer/agreement-actions";
import {
  RetailerCompanySettingsView,
} from "@/components/retailer/retailer-company-settings-view";
import type {
  StoreLocationItem,
  CompanyInfoItem,
  PersonalProfileItem,
} from "@/components/retailer/account-organization-view";

export const dynamic = "force-dynamic";

export default async function RetailerCompanySettingsPage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", session.userId)
    .maybeSingle();

  // 2. Fetch company user relation
  const { data: companyUser, error: cuError } = await adminClient
    .from("company_users")
    .select("company_id, company_role, phone, name, status, email")
    .eq("id", session.userId)
    .maybeSingle();

  if (cuError || !companyUser) {
    console.error("[RetailerCompanySettingsPage] RETAILER_USER_NOT_RESOLVED:", session.userId, cuError);
  }

  const companyId = companyUser?.company_id;

  // 3. Fetch authoritative company legal entity
  let rawCompany: any = null;
  if (companyId) {
    const { data: compData } = await adminClient
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    rawCompany = compData;
  }

  // 4. Fetch retailer commercial profile
  let retailerProfile: any = null;
  if (companyId) {
    const { data: rpData } = await adminClient
      .from("retailer_profiles")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    retailerProfile = rpData;
  }

  // 5. Fetch retailer specific role
  const { data: retailerRole } = companyId
    ? await adminClient
        .from("retailer_user_roles")
        .select("role, has_all_stores_access")
        .eq("user_id", session.userId)
        .eq("company_id", companyId)
        .maybeSingle()
    : { data: null };

  const rawRole = (retailerRole?.role || companyUser?.company_role || "owner").toLowerCase();

  // 6. Fetch all stores for this company
  let storesList: StoreLocationItem[] = [];
  if (companyId) {
    const { data: allStores } = await adminClient
      .from("stores")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    storesList = (allStores || []).map((s) => ({
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
  }

  // 7. Permission-controlled Agreements & Documents fetching
  const canViewAgreements = ["owner", "buyer"].includes(rawRole);
  let companyAgreement: any = null;
  let agreementError: string | null = null;
  let documents: any[] = [];

  if (companyId && canViewAgreements) {
    try {
      const [agrData, docsData] = await Promise.all([
        getCompanyAgreement(companyId, "RETAILER"),
        getRetailerCompanyAgreementsAndDocuments(companyId),
      ]);
      companyAgreement = agrData.agreement;
      agreementError = agrData.error || null;
      documents = docsData.documents;
    } catch (err: any) {
      console.error("[RetailerCompanySettingsPage] RETAILER_AGREEMENT_LOAD_FAILED:", err);
      agreementError = err?.message || "Failed to load agreement data.";
    }
  }

  const personalProfile: PersonalProfileItem = {
    id: session.userId,
    displayName: profile?.display_name || companyUser?.name || session.email.split("@")[0] || "Retailer Partner",
    email: companyUser?.email || session.email,
    phone: companyUser?.phone || null,
    role: rawRole,
  };

  const companyAddressStr = [
    retailerProfile?.billing_address || rawCompany?.address,
    retailerProfile?.billing_city || rawCompany?.city,
    retailerProfile?.billing_state || rawCompany?.state,
    retailerProfile?.billing_zip || rawCompany?.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const companyInfo: CompanyInfoItem = {
    id: companyId || "",
    name: rawCompany?.name || "K SELECT Retailer Partner",
    businessRegistrationNumber: rawCompany?.business_registration_number || null,
    country: rawCompany?.country || "US",
    contactName: rawCompany?.contact_name || retailerProfile?.billing_contact_name || null,
    contactPhone: rawCompany?.contact_phone || retailerProfile?.billing_contact_phone || null,
    contactEmail: retailerProfile?.billing_contact_email || null,
    address: companyAddressStr || null,
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
    <RetailerCompanySettingsView
      profile={personalProfile}
      company={companyInfo}
      stores={storesList}
      canViewAgreements={canViewAgreements}
      companyAgreement={companyAgreement}
      agreementError={agreementError}
      documents={documents}
    />
  );
}
