import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { RetailerCartView } from "@/components/retailer/cart-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Cart | K SELECT HUB Retailer",
  description: "Review your selected store order products and quantities.",
};

export default async function RetailerCartPage() {
  await verifyRetailerSession();
  return <RetailerCartView />;
}
