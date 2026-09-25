import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { RetailerCheckoutView } from "@/components/retailer/checkout-view";
import { getRetailerPaymentEligibility } from "@/lib/retailer/payment-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Review & Checkout | K SELECT HUB Retailer",
  description: "Review destination store, select authorized payment method/terms, and submit your store order.",
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
  const companyId = company?.id || companyUser?.company_id || "7597f742-b9e7-4f67-8fd4-972168eb51ae";

  // 2. Fetch Authoritative Payment & Terms Eligibility
  const paymentEligibility = await getRetailerPaymentEligibility(companyId);

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
      paymentEligibility={paymentEligibility}
      stores={stores}
    />
  );
}
