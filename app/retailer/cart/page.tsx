import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession, getRetailerUserContext } from "@/lib/auth/dal";
import { resolveCompanyDefaultShippingDestination } from "@/lib/retailer/shipping-address-actions";
import { RetailerCartView } from "@/components/retailer/cart-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Cart | K SELECT HUB Retailer",
  description: "Review your selected store order products and quantities.",
};

export default async function RetailerCartPage() {
  await verifyRetailerSession();
  const userContext = await getRetailerUserContext();
  let defaultShippingDestination = null;
  if (userContext.companyId) {
    defaultShippingDestination = await resolveCompanyDefaultShippingDestination(userContext.companyId);
  }

  return <RetailerCartView defaultShippingDestination={defaultShippingDestination} />;
}
