"use client";

import React from "react";
import { HelpCenterMainView } from "@/components/knowledge/help-center-main-view";

export default function BrandHelpCenterPage() {
  return (
    <HelpCenterMainView
      portalType="BRAND"
      baseHelpPath="/portal/help"
      baseSupportPath="/portal/support"
      apiEndpoint="/api/portal/help"
      heroBadgeText="Official Knowledge & Policy"
      heroTitle="Help Center (도움말 센터)"
      heroSubtitle="K SELECT NETWORK 이용에 필요한 공식 매뉴얼, 브랜드 등록 정책, FAQ를 검색하고 해결해 보세요."
      searchPlaceholder="무엇을 찾고 계신가요? (예: 브랜드 등록, 상표권, 출고지, FAQ 등)"
      supportCtaText="1:1 문의하기"
      supportDescription="K SELECT 운영팀에 문의를 남겨주시면 담당자가 신속하고 정확하게 답변을 안내해 드립니다."
    />
  );
}
