import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { RetailerCheckoutView } from "@/components/retailer/checkout-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Review & Checkout | K SELECT HUB Retailer",
  description: "Review destination store, terms, and submit your store order.",
};

export default async function RetailerCheckoutPage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch Company Info
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, companies(id, name)")
    .eq("id", session.userId)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "K SELECT Retailer";
  const companyId = company?.id || companyUser?.company_id;

  // 2. Fetch Profile Payment Terms
  let paymentTerms = "PREPAID_CARD";
  let termsApproved = false;
  if (companyId) {
    const { data: profile } = await adminClient
      .from("retailer_profiles")
      .select("payment_terms, terms_approved_by_admin")
      .eq("company_id", companyId)
      .maybeSingle();

    if (profile) {
      paymentTerms = profile.payment_terms || "PREPAID_CARD";
      termsApproved = Boolean(profile.terms_approved_by_admin);
    }
  }

  // 3. Fetch Authorized Stores
  const stores: Array<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
  }> = [];

  if (companyId) {
    const { data: storeRows } = await adminClient
      .from("stores")
      .select("id, name, address, city, state, zip, phone")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (storeRows) {
      stores.push(...storeRows);
    }
  }

  return (
    <RetailerCheckoutView
      companyName={companyName}
      userEmail={session.email}
      paymentTerms={paymentTerms}
      termsApproved={termsApproved}
      stores={stores}
    />
  );
}
