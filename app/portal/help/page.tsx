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
      heroTitle="무엇을 도와드릴까요?"
      heroSubtitle="K SELECT 이용 방법이나 정책에 대해 궁금한 내용을 질문해 주세요."
      searchPlaceholder="궁금한 내용을 입력해 주세요... (예: 브랜드 등록, 상표권, 출고지, FAQ 등)"
      supportCtaText="1:1 문의하기"
      supportDescription="도움말에서 해결되지 않은 문제는 담당자에게 문의해 주세요."
    />
  );
}
