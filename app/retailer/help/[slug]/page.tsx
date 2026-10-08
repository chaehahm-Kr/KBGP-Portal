"use client";

import React from "react";
import { HelpCenterDetailView } from "@/components/knowledge/help-center-detail-view";
import { useTranslation } from "@/lib/i18n";

export default function RetailerHelpDetailPage() {
  const { locale } = useTranslation();
  const isKo = locale === "ko";

  return (
    <HelpCenterDetailView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiDetailBaseEndpoint="/api/retailer/help"
      supportCtaText={isKo ? "1:1 문의하기" : "Contact Support"}
      supportDescription={
        isKo
          ? "문서에 기재되지 않은 특수 사례나 추가 문의사항은 K SELECT 운영팀에 남겨주시면 안내해 드립니다."
          : "For specific cases or questions not covered in this guide, contact our operations support team."
      }
    />
  );
}
