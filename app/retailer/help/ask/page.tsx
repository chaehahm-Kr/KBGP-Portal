"use client";

import React from "react";
import { AskKSelectView } from "@/components/knowledge/ask-kselect-view";

export default function RetailerAskKSelectPage() {
  return (
    <AskKSelectView
      portalType="RETAILER"
      baseHelpPath="/retailer/help"
      baseSupportPath="/retailer/support"
      apiEndpoint="/api/knowledge/ask"
      heroBadge="Official Retail Knowledge Assistant"
      heroTitle="Ask K SELECT"
      heroSubtitle="K SELECT Retail Portal 공식 도움말에 기반하여 실시간으로 안내해 드립니다."
      placeholderText="바이어 발주, 매장 설정, 정산 정책 등 질문을 입력하세요..."
    />
  );
}
