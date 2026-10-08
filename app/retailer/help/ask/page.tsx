"use client";

import React from "react";
import { AskKSelectView } from "@/components/knowledge/ask-kselect-view";
import { useTranslation } from "@/lib/i18n";

export default function RetailerAskKSelectPage() {
  const { t } = useTranslation();

  return (
    <AskKSelectView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiEndpoint="/api/knowledge/ask"
      heroBadge={t.help.askHeroBadge}
      heroTitle={t.help.askHeroTitle}
      heroSubtitle={t.help.askHeroSubtitle}
      placeholderText={t.help.askPlaceholder}
    />
  );
}
