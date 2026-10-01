"use client";

import React from "react";
import { HelpCenterDetailView } from "@/components/knowledge/help-center-detail-view";

export default function RetailerHelpDetailPage() {
  return (
    <HelpCenterDetailView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiDetailBaseEndpoint="/api/retailer/help"
      supportCtaText="1:1 문의하기"
      supportDescription="문서에 기재되지 않은 특수 사례나 추가 문의사항은 K SELECT 운영팀에 남겨주시면 안내해 드립니다."
    />
  );
}
