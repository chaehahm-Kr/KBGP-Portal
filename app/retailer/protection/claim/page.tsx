import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerClaimWizardData } from "@/lib/retailer/exchange-credit-claim-actions";
import { ClaimWizardClient } from "./claim-wizard-client";

export const dynamic = "force-dynamic";

interface RetailerClaimPageProps {
  searchParams: Promise<{
    storeId?: string;
  }>;
}

export default async function RetailerClaimPage({
  searchParams,
}: RetailerClaimPageProps) {
  await verifyRetailerSession();
  const { storeId } = await searchParams;

  const data = await getRetailerClaimWizardData(storeId);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href="/retailer/protection"
          className="hover:text-zinc-300 transition-colors"
        >
          90-Day Initial Trial Protection
        </Link>
        <span>/</span>
        <span className="text-zinc-200 font-medium">90-Day Exchange Credit Claim Wizard</span>
      </nav>

      {/* Main Wizard Area */}
      <ClaimWizardClient
        stores={data.stores}
        selectedStoreId={data.selectedStoreId}
        products={data.products}
        companyEnrollmentStatus={data.companyEnrollmentStatus}
      />
    </div>
  );
}
