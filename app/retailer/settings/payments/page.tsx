import React from "react";
import type { Metadata } from "next";
import { verifyRetailerSession, getRetailerUserContext } from "@/lib/auth/dal";
import { getRetailerPaymentMethodsAction } from "@/lib/retailer/payment-method-actions";
import { resolveEffectivePaymentPolicy } from "@/lib/retailer/payment-policy-server";
import { RetailerPaymentsSettingsView } from "@/components/retailer/retailer-payments-settings-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Methods | K SELECT HUB Retailer",
  description: "View authorized payment methods, trade credit lines, and payment settings.",
};

export default async function RetailerPaymentsSettingsPage() {
  await verifyRetailerSession();
  const userContext = await getRetailerUserContext();

  const [methodsRes, policy] = await Promise.all([
    getRetailerPaymentMethodsAction(),
    resolveEffectivePaymentPolicy(userContext.companyId!),
  ]);

  return (
    <RetailerPaymentsSettingsView
      statusData={
        methodsRes.data || {
          providerReady: false,
          providerStatus: "setup_pending",
          cardProcessingAllowed: true,
          achProcessingAllowed: true,
          methods: [],
        }
      }
      policy={policy}
      companyName={userContext.companyName || "My Retail Company"}
    />
  );
}
