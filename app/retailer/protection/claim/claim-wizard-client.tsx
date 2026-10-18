"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ClaimWizardContainer } from "@/components/retailer/exchange-credit";
import {
  ClaimWizardStore,
  ClaimWizardProductItem,
} from "@/components/retailer/exchange-credit/claim-wizard-types";

interface ClaimWizardClientProps {
  stores: ClaimWizardStore[];
  selectedStoreId: string;
  products: ClaimWizardProductItem[];
  companyEnrollmentStatus: string;
}

export function ClaimWizardClient({
  stores,
  selectedStoreId,
  products,
  companyEnrollmentStatus,
}: ClaimWizardClientProps) {
  const router = useRouter();

  return (
    <div className="w-full">
      <ClaimWizardContainer
        stores={stores}
        selectedStoreId={selectedStoreId}
        products={products}
        onCancel={() => router.push("/retailer/protection")}
        isPreviewMode={false}
      />
    </div>
  );
}
