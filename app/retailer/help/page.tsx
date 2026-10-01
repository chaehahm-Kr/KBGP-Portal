"use client";

import React from "react";
import { HelpCenterMainView } from "@/components/knowledge/help-center-main-view";

export default function RetailerHelpCenterPage() {
  return (
    <HelpCenterMainView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiEndpoint="/api/retailer/help"
      heroBadgeText="Official Knowledge & Policy"
      heroTitle="Help Center"
      heroSubtitle="K SELECT 이용에 필요한 도움말과 정책을 찾아보세요."
      searchPlaceholder="무엇을 찾고 계신가요?"
      supportCtaText="1:1 문의하기"
      supportDescription="K SELECT 운영팀에 문의를 남겨주시면 담당자가 신속하고 정확하게 답변을 안내해 드립니다."
    />
  );
}
