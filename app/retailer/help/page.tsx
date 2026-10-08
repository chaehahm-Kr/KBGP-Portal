"use client";

import React from "react";
import { HelpCenterMainView } from "@/components/knowledge/help-center-main-view";
import { useTranslation } from "@/lib/i18n";

export default function RetailerHelpCenterPage() {
  const { t } = useTranslation();

  return (
    <HelpCenterMainView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiEndpoint="/api/retailer/help"
      heroBadgeText={t.help.heroBadge}
      heroTitle={t.help.heroTitle}
      heroSubtitle={t.help.heroSubtitle}
      searchPlaceholder={t.help.searchPlaceholder}
      supportCtaText={t.help.supportCta}
      supportDescription={t.help.supportDesc}
    />
  );
}
