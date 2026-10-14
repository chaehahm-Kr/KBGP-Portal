import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession, getRetailerUserContext } from "@/lib/auth/dal";
import { getRetailerShippingDestinationsAction } from "@/lib/retailer/shipping-address-actions";
import { RetailerShippingSettingsView } from "@/components/retailer/retailer-shipping-settings-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping Addresses | K SELECT HUB Retailer",
  description: "Manage reusable delivery locations, store destinations, and warehouses for wholesale order fulfillment.",
};

export default async function RetailerShippingSettingsPage() {
  await verifyRetailerSession();
  const userContext = await getRetailerUserContext();
  const destinationsRes = await getRetailerShippingDestinationsAction();

  return (
    <RetailerShippingSettingsView
      initialAddresses={destinationsRes.data?.savedAddresses || []}
      stores={destinationsRes.data?.stores || []}
      initialDefaultDestination={destinationsRes.data?.defaultDestination || null}
      companyName={userContext.companyName || "My Retail Company"}
    />
  );
}
