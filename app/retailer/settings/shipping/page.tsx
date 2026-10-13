import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession, getRetailerUserContext } from "@/lib/auth/dal";
import { getRetailerShippingAddressesAction } from "@/lib/retailer/shipping-address-actions";
import { RetailerShippingSettingsView } from "@/components/retailer/retailer-shipping-settings-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping Addresses | K SELECT HUB Retailer",
  description: "Manage reusable delivery locations and warehouses for wholesale order fulfillment.",
};

export default async function RetailerShippingSettingsPage() {
  await verifyRetailerSession();
  const userContext = await getRetailerUserContext();
  const addressRes = await getRetailerShippingAddressesAction();

  return (
    <RetailerShippingSettingsView
      initialAddresses={addressRes.data || []}
      companyName={userContext.companyName || "My Retail Company"}
    />
  );
}
