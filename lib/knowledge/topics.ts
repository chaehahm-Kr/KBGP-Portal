/**
 * Canonical Knowledge Topic Definitions & Mapping Logic
 * Standardized across K SELECT Brand Portal, Retail Portal, and Knowledge Center.
 */

export interface CanonicalTopic {
  id: string;
  key: string;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  icon: string;
  order: number;
  matchModules: string[];
  matchKeywords: string[];
}

export const CANONICAL_BRAND_TOPICS: CanonicalTopic[] = [
  {
    id: "topic-start",
    key: "START",
    title_ko: "시작하기",
    title_en: "Getting Started",
    description_ko: "회원가입, 회사 등록, 초기 계정 설정 및 온보딩",
    description_en: "Account registration, company setup, and onboarding guides",
    icon: "🚀",
    order: 1,
    matchModules: ["ONBOARDING", "SIGNUP", "ACCOUNT", "START", "SETUP"],
    matchKeywords: ["가입", "시작", "온보딩", "초기 설정", "계정", "onboarding", "signup", "start", "account"]
  },
  {
    id: "topic-brand",
    key: "BRAND",
    title_ko: "브랜드 관리",
    title_en: "Brand Management",
    description_ko: "브랜드 등록, 상표권 정책, 브랜드 권한 및 사용 중단 정책",
    description_en: "Brand registration, trademark policy, ownership, and deactivation rules",
    icon: "🏷️",
    order: 2,
    matchModules: ["BRAND", "BRANDS"],
    matchKeywords: ["브랜드", "상표권", "브랜드 삭제", "브랜드 비활성화", "brand", "trademark", "ownership", "man-brand-001"]
  },
  {
    id: "topic-product",
    key: "PRODUCT",
    title_ko: "상품 등록 & 관리",
    title_en: "Product Management",
    description_ko: "상품 신규 등록, SKU 관리, 상품 정보 수정 및 브랜드 연결",
    description_en: "Product registration, SKU management, catalog editing, and brand linking",
    icon: "📦",
    order: 3,
    matchModules: ["PRODUCTS", "PRODUCT", "SKU", "CATALOG"],
    matchKeywords: ["상품", "제품", "sku", "카탈로그", "바코드", "product", "item"]
  },
  {
    id: "topic-regulatory",
    key: "REGULATORY",
    title_ko: "인허가 & 규정",
    title_en: "Regulatory & Compliance",
    description_ko: "미국 판매 요건, FDA, MoCRA, 라벨링 및 필수 인증 서류",
    description_en: "US market compliance, FDA, MoCRA, labeling, and required certificates",
    icon: "📜",
    order: 4,
    matchModules: ["REGULATORY", "COMPLIANCE", "FDA", "MOCRA"],
    matchKeywords: ["인허가", "규정", "fda", "mocra", "라벨링", "성분", "certification", "compliance"]
  },
  {
    id: "topic-retail",
    key: "RETAIL",
    title_ko: "입점 & 리테일 네트워크",
    title_en: "Retail Network",
    description_ko: "바이어 매장 입점 신청, 리테일 네트워크 참여 및 테스트 프로그램",
    description_en: "Retail store applications, distribution network, and testing opportunities",
    icon: "🏬",
    order: 5,
    matchModules: ["RETAIL", "RETAILER", "STORE", "NETWORK"],
    matchKeywords: ["입점", "리테일", "매장", "네트워크", "스토어", "retail", "store", "network"]
  },
  {
    id: "topic-orders",
    key: "ORDERS",
    title_ko: "발주 요청 & 오더",
    title_en: "Orders & PO",
    description_ko: "리테일러 발주 요청(Request) 확인, 수락 및 정식 발주서(PO) 처리",
    description_en: "Retailer purchase requests, acceptance, and formal Purchase Order (PO) workflow",
    icon: "📋",
    order: 6,
    matchModules: ["ORDERS", "PURCHASE_ORDER", "ORDER", "PO"],
    matchKeywords: ["발주", "오더", "po", "발주서", "발주 요청", "purchase order", "order", "request"]
  },
  {
    id: "topic-logistics",
    key: "LOGISTICS",
    title_ko: "재고 & 물류",
    title_en: "Inventory & Logistics",
    description_ko: "물류 출고지/반품지 관리, 재고 현황, 배송 및 트래킹 추적",
    description_en: "Shipping origin, return address, inventory levels, and logistics tracking",
    icon: "🚚",
    order: 7,
    matchModules: ["LOGISTICS", "INVENTORY", "SHIPPING", "WAREHOUSE", "FULFILLMENT"],
    matchKeywords: ["물류", "재고", "출고지", "반품지", "배송", "창고", "shipping", "inventory", "warehouse"]
  },
  {
    id: "topic-finance",
    key: "FINANCE",
    title_ko: "정산 & 결제",
    title_en: "Settlement & Finance",
    description_ko: "판매대금 정산 내역, 인보이스, 송금 계좌 및 수수료 안내",
    description_en: "Settlement reports, invoices, remittance accounts, and platform fees",
    icon: "💳",
    order: 8,
    matchModules: ["FINANCE", "SETTLEMENT", "PAYMENT", "INVOICE"],
    matchKeywords: ["정산", "결제", "인보이스", "송금", "수수료", "finance", "settlement", "payment", "invoice"]
  },
  {
    id: "topic-marketing",
    key: "MARKETING",
    title_ko: "프로모션 & 마케팅",
    title_en: "Promotion & Marketing",
    description_ko: "마케팅 지원 프로그램, 할인 프로모션 및 캠페인 참여 안내",
    description_en: "Marketing support programs, discount promotions, and campaign participation",
    icon: "📣",
    order: 9,
    matchModules: ["PROMOTION", "MARKETING", "CAMPAIGN"],
    matchKeywords: ["프로모션", "마케팅", "캠페인", "할인", "이벤트", "promotion", "marketing", "campaign"]
  },
  {
    id: "topic-company",
    key: "COMPANY",
    title_ko: "회사 & 사용자 관리",
    title_en: "Company & Users",
    description_ko: "회사 정보 변경, 팀원 초대, 권한 설정 및 계정 관리",
    description_en: "Company details, team invitations, role permissions, and access settings",
    icon: "👥",
    order: 10,
    matchModules: ["COMPANY", "USERS", "SETTINGS", "MEMBERS"],
    matchKeywords: ["회사", "사용자", "팀원", "권한", "초대", "company", "user", "permission", "member"]
  }
];

/**
 * Matches a knowledge item to a canonical topic.
 */
export function matchTopicForKnowledge(item: {
  module?: string;
  category?: string;
  tags?: string[];
  title?: string;
  title_ko?: string;
}): CanonicalTopic {
  const mod = (item.module || item.category || "").toUpperCase();
  const tags = (item.tags || []).map(t => t.toUpperCase());
  const title = `${item.title_ko || ""} ${item.title || ""}`.toLowerCase();

  // 1. Direct Module Match
  for (const topic of CANONICAL_BRAND_TOPICS) {
    if (topic.matchModules.includes(mod)) {
      return topic;
    }
  }

  // 2. Tag Match
  for (const topic of CANONICAL_BRAND_TOPICS) {
    if (topic.matchModules.some(m => tags.includes(m))) {
      return topic;
    }
  }

  // 3. Keyword Match
  for (const topic of CANONICAL_BRAND_TOPICS) {
    if (topic.matchKeywords.some(kw => title.includes(kw.toLowerCase()))) {
      return topic;
    }
  }

  // Default fallback: 시작하기 (Getting Started)
  return CANONICAL_BRAND_TOPICS[0];
}

/**
 * Matches an FAQ to a canonical topic.
 */
export function matchTopicForFaq(faq: {
  source_knowledge_id?: string;
  source_title?: string;
  question_ko?: string;
  question_en?: string;
}, parentKnowledgeItem?: any): CanonicalTopic {
  if (parentKnowledgeItem) {
    return matchTopicForKnowledge(parentKnowledgeItem);
  }

  const q = `${faq.question_ko || ""} ${faq.question_en || ""} ${faq.source_title || ""}`.toLowerCase();

  for (const topic of CANONICAL_BRAND_TOPICS) {
    if (topic.matchKeywords.some(kw => q.includes(kw.toLowerCase()))) {
      return topic;
    }
  }

  return CANONICAL_BRAND_TOPICS[0];
}
