"use client";

import React from "react";
import { HelpCenterDetailView } from "@/components/knowledge/help-center-detail-view";
import { useTranslation } from "@/lib/i18n";

export default function RetailerHelpDetailPage() {
  const { t } = useTranslation();

  return (
    <HelpCenterDetailView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiDetailBaseEndpoint="/api/retailer/help"
      supportCtaText={t.help.supportCta}
      supportDescription={t.help.detailSupportDesc}
    />
  );
}
