"use client";

import React from "react";
import { AskKSelectView } from "@/components/knowledge/ask-kselect-view";
import { useTranslation } from "@/lib/i18n";

export default function RetailerAskKSelectPage() {
  const { locale } = useTranslation();
  const isKo = locale === "ko";

  return (
    <AskKSelectView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiEndpoint="/api/knowledge/ask"
      heroBadge="Official Retail Knowledge Assistant"
      heroTitle="Ask K SELECT"
      heroSubtitle={
        isKo
          ? "K SELECT Retail Portal 공식 도움말에 기반하여 실시간으로 안내해 드립니다."
          : "Real-time operational guidance grounded in official K SELECT Retail Portal manuals."
      }
      placeholderText={
        isKo
          ? "바이어 발주, 매장 설정, 정산 정책 등 질문을 입력하세요..."
          : "Ask about store orders, inventory checks, retail terms, or operational policies..."
      }
    />
  );
}
