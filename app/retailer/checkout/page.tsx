import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { RetailerCheckoutView } from "@/components/retailer/checkout-view";
import { getRetailerPaymentEligibility } from "@/lib/retailer/payment-actions";
import { resolveCompanyDefaultShippingDestination } from "@/lib/retailer/shipping-address-actions";
import { isExchangeCreditCheckoutEnabled } from "@/lib/retailer/exchange-credit-checkout";

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
    .select("company_id, companies!company_users_company_id_fkey(id, name)")
    .eq("id", session.userId)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "K SELECT Retailer";
  const companyId = companyUser?.company_id || company?.id;

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

  // 4. Fetch Saved Shipping Addresses
  const savedAddresses: import("@/lib/retailer/shipping-address-types").RetailerShippingAddress[] = [];
  if (companyId) {
    try {
      const { data: addressRows } = await adminClient
        .from("retailer_shipping_addresses")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (addressRows) {
        savedAddresses.push(
          ...addressRows.map((r: any) => ({
            id: r.id,
            companyId: r.company_id,
            label: r.label,
            recipientName: r.recipient_name,
            attentionName: r.attention_name || null,
            addressLine1: r.address_line1,
            addressLine2: r.address_line2 || null,
            city: r.city,
            state: r.state,
            zip: r.zip,
            country: r.country || "US",
            phone: r.phone || null,
            deliveryNotes: r.delivery_notes || null,
            isDefault: Boolean(r.is_default),
            isActive: Boolean(r.is_active),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }))
        );
      }
    } catch (e) {
      // Pending migration / schema cache fallback
    }
  }

  // 5. Authoritatively resolve default shipping destination
  let defaultDestination = null;
  if (companyId) {
    defaultDestination = await resolveCompanyDefaultShippingDestination(companyId, adminClient);
  }

  // 6. Check Exchange Credit Feature Gate (Default: false)
  const isCreditCheckoutEnabled = await isExchangeCreditCheckoutEnabled();

  return (
    <RetailerCheckoutView
      companyName={companyName}
      userEmail={session.email}
      paymentEligibility={paymentEligibility}
      stores={stores}
      savedAddresses={savedAddresses}
      defaultDestination={defaultDestination}
      isCreditCheckoutEnabled={isCreditCheckoutEnabled}
    />
  );
}
