"use client";

import React from "react";
import { HelpCenterMainView } from "@/components/knowledge/help-center-main-view";
import { useTranslation } from "@/lib/i18n";

export default function RetailerHelpCenterPage() {
  const { locale } = useTranslation();
  const isKo = locale === "ko";

  return (
    <HelpCenterMainView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiEndpoint="/api/retailer/help"
      heroBadgeText="Official Knowledge & Policy"
      heroTitle={isKo ? "무엇을 도와드릴까요?" : "Help Center"}
      heroSubtitle={
        isKo
          ? "K SELECT 이용에 필요한 도움말과 정책을 찾아보세요."
          : "Search verified knowledge, FAQs, and retail operating policies."
      }
      searchPlaceholder={
        isKo
          ? "궁금한 내용을 입력하세요... (예: 매장 발주, 재고 실사, 매장 설정)"
          : "Type your question or search keywords (e.g. Orders, Inventory, Stores)..."
      }
      supportCtaText={isKo ? "1:1 문의하기" : "Contact Support"}
      supportDescription={
        isKo
          ? "K SELECT 운영팀에 문의를 남겨주시면 담당자가 신속하고 정확하게 답변을 안내해 드립니다."
          : "Need additional assistance? Reach out to our operations support team."
      }
    />
  );
}
