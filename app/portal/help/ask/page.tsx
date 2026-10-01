"use client";

import React from "react";
import { AskKSelectView } from "@/components/knowledge/ask-kselect-view";

export default function BrandAskKSelectPage() {
  return (
    <AskKSelectView
      portalType="BRAND"
      baseHelpPath="/portal/help"
      baseSupportPath="/portal/support"
      apiEndpoint="/api/knowledge/ask"
      heroBadge="Official Brand Knowledge Assistant"
      heroTitle="Ask K SELECT (지능형 정책 도우미)"
      heroSubtitle="공식 승인된 Brand Portal 운영 매뉴얼 및 정책에 기반하여 실시간으로 안내해 드립니다."
      placeholderText="브랜드 등록, 상표권, 삭제 정책 등 궁금한 점을 질문해 보세요..."
    />
  );
}
