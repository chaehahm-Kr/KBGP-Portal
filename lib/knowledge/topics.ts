/**
 * Canonical Knowledge Topic Definitions & Mapping Logic
 * Standardized across K SELECT Brand Portal, Retail Portal, and Knowledge Center.
 *
 * SECTION 13 & 14 COMPLIANCE:
 * - One Primary Topic per Knowledge Item for deterministic classification and Topic counts.
 * - Related Topics supported for search/discovery without inflating Topic counts.
 */

export interface CanonicalTopic {
  id: string;
  key?: string;
  title_ko: string;
  title_en?: string;
  name_ko?: string;
  name_en?: string | null;
  short_desc_ko?: string | null;
  short_desc_en?: string | null;
  description_ko?: string | null;
  description_en?: string | null;
  icon: string;
  order?: number;
  display_order?: number;
  is_active?: boolean;
  portal_scope?: "BRAND" | "RETAILER";
  matchModules?: string[];
  matchKeywords?: string[];
  match_modules?: string[];
  match_keywords?: string[];
  faq_count?: number;
  knowledge_count?: number;
}


export const CANONICAL_BRAND_TOPICS: CanonicalTopic[] = [
  {
    id: "topic-start",
    key: "START",
    title_ko: "시작하기",
    title_en: "Getting Started",
    short_desc_ko: "가입 · 계정 · 기본 온보딩",
    short_desc_en: "Signup · Account · Onboarding",
    description_ko: "회원가입, 회사 등록, 초기 계정 설정 및 온보딩",
    description_en: "Account registration, company setup, and onboarding guides",
    icon: "🚀",
    order: 1,
    matchModules: ["ONBOARDING", "SIGNUP", "ACCOUNT", "START", "SETUP"],
    matchKeywords: ["가입", "시작", "온보딩", "초기 설정", "계정", "onboarding", "signup", "start", "account", "man-onb-001", "man-b-onb-001"]
  },
  {
    id: "topic-brand",
    key: "BRAND",
    title_ko: "브랜드 관리",
    title_en: "Brand Management",
    short_desc_ko: "등록 · 상표권 · 수정 · 사용 중단",
    short_desc_en: "Registration · Trademark · Inactive",
    description_ko: "브랜드 등록, 상표권 정책, 브랜드 권한 및 사용 중단 정책",
    description_en: "Brand registration, trademark policy, ownership, and deactivation rules",
    icon: "🏷️",
    order: 2,
    matchModules: ["BRAND", "BRANDS", "BRAND_POLICY"],
    matchKeywords: ["브랜드", "상표권", "브랜드 삭제", "브랜드 비활성화", "brand", "trademark", "ownership", "man-brand-001", "man-b-brand-001"]
  },
  {
    id: "topic-product",
    key: "PRODUCT",
    title_ko: "상품 등록 & 관리",
    title_en: "Product Management",
    short_desc_ko: "상품 등록 · SKU · 규격 · 승인",
    short_desc_en: "Products · SKU · Specs · Approval",
    description_ko: "상품 신규 등록, SKU 관리, 상품 정보 수정 및 브랜드 연결",
    description_en: "Product registration, SKU management, catalog editing, and brand linking",
    icon: "📦",
    order: 3,
    matchModules: ["PRODUCTS", "PRODUCT", "SKU", "CATALOG"],
    matchKeywords: [
      "상품", "제품", "sku", "카탈로그", "바코드", "product", "item", "man-prod-001", "man-b-prod-001",
      "상품 등록", "상품 수정", "이미지", "가격", "물류", "인증서", "cbm", "fob", "draft", "moq", "upc", "ean", "단품", "카톤",
      "add product", "draft product", "product image", "pricing", "logistics", "package", "certification"
    ]
  },
  {
    id: "topic-regulatory",
    key: "REGULATORY",
    title_ko: "인허가 & 규정",
    title_en: "Regulatory & Compliance",
    short_desc_ko: "FDA · MoCRA · 라벨 · 통관 인증",
    short_desc_en: "FDA · MoCRA · Labeling · US Compliance",
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
    short_desc_ko: "바이어 매칭 · 입점 신청 · 유통 채널",
    short_desc_en: "Buyer Matching · Placement · Channels",
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
    short_desc_ko: "발주서 · PO 접수 · 납기 관리",
    short_desc_en: "Purchase Orders · PO · Lead Time",
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
    short_desc_ko: "입고 · 출고지 · 3PL · 배송 정책",
    short_desc_en: "Origin · Return · 3PL · Logistics",
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
    short_desc_ko: "정산 주기 · 인보이스 · 세금계산서",
    short_desc_en: "Settlement · Invoice · Payout",
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
    short_desc_ko: "기획전 · 할인 · 프로모션 가이드",
    short_desc_en: "Promotions · Discounts · Campaigns",
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
    short_desc_ko: "사업자 정보 · 권한 · 팀원 초대",
    short_desc_en: "Company Profile · Roles · Invitations",
    description_ko: "회사 정보 변경, 팀원 초대, 권한 설정 및 계정 관리",
    description_en: "Company details, team invitations, role permissions, and access settings",
    icon: "👥",
    order: 10,
    matchModules: ["COMPANY", "USERS", "SETTINGS", "MEMBERS"],
    matchKeywords: ["회사", "사용자", "팀원", "권한", "초대", "company", "user", "permission", "member"]
  }
];

/**
 * Authoritative Primary Topic mapping for known Knowledge IDs.
 */
const AUTHORITATIVE_PRIMARY_TOPIC_MAP: Record<string, string> = {
  "kno-brand-policy-v10": "topic-brand", // MAN-B-BRAND-001 -> 브랜드 관리
  "kno-onboarding-guide-v10": "topic-start", // MAN-B-ONB-001 -> 시작하기
  "kno-product-management-v10": "topic-product", // MAN-B-PROD-001 -> 상품 등록 & 관리
  "kno-002-brand-faq": "topic-start", // Onboarding FAQ -> 시작하기
  "kno-insights-manual-v10": "topic-start",
  "kno-insights-policy-prohibitions": "topic-start"
};

/**
 * Matches a knowledge item to exactly ONE canonical Primary Topic.
 * Enforces Section 13 (One Primary Topic per Knowledge item).
 */
export function matchTopicForKnowledge(
  item: {
    id?: string;
    module?: string;
    category?: string;
    tags?: string[];
    title?: string;
    title_ko?: string;
  },
  availableTopics: CanonicalTopic[] = CANONICAL_BRAND_TOPICS
): CanonicalTopic {
  const topics = availableTopics.length > 0 ? availableTopics : CANONICAL_BRAND_TOPICS;

  // 1. Authoritative Override
  if (item.id && AUTHORITATIVE_PRIMARY_TOPIC_MAP[item.id]) {
    const found = topics.find(t => t.id === AUTHORITATIVE_PRIMARY_TOPIC_MAP[item.id!]);
    if (found) return found;
  }

  const mod = (item.module || "").toUpperCase();
  const cat = (item.category || "").toUpperCase();
  const title = `${item.title_ko || ""} ${item.title || ""}`.toLowerCase();

  // 2. Direct Module Match (Exact Primary Module)
  if (mod) {
    for (const topic of topics) {
      const matchMods = (topic.matchModules || topic.match_modules || []).map(m => m.toUpperCase());
      if (matchMods.includes(mod) || matchMods.some(m => mod.includes(m))) {
        return topic;
      }
    }
  }

  // 3. Direct Category Match
  if (cat) {
    for (const topic of topics) {
      const matchMods = (topic.matchModules || topic.match_modules || []).map(m => m.toUpperCase());
      if (matchMods.includes(cat) || matchMods.some(m => cat.includes(m))) {
        return topic;
      }
    }
  }

  // 4. Keyword Match from Title
  for (const topic of topics) {
    const keywords = (topic.matchKeywords || topic.match_keywords || []).map(k => k.toLowerCase());
    if (keywords.some(kw => title.includes(kw))) {
      return topic;
    }
  }

  // Default fallback
  return topics[0] || CANONICAL_BRAND_TOPICS[0];
}

/**
 * Matches an FAQ to exactly ONE canonical Primary Topic.
 */
export function matchTopicForFaq(
  faq: {
    id?: string;
    topic_id?: string | null;
    source_knowledge_id?: string;
    source_title?: string;
    question_ko?: string;
    question_en?: string;
  },
  parentKnowledgeItem?: any,
  availableTopics: CanonicalTopic[] = CANONICAL_BRAND_TOPICS
): CanonicalTopic {
  const topics = availableTopics.length > 0 ? availableTopics : CANONICAL_BRAND_TOPICS;

  // 0. Direct Topic ID Link
  if (faq.topic_id) {
    const directTopic = topics.find(t => t.id === faq.topic_id);
    if (directTopic) return directTopic;
  }

  // If parent knowledge item exists, match to parent's Primary Topic
  if (parentKnowledgeItem) {
    return matchTopicForKnowledge(parentKnowledgeItem, topics);
  }

  if (faq.source_knowledge_id && AUTHORITATIVE_PRIMARY_TOPIC_MAP[faq.source_knowledge_id]) {
    const found = topics.find(t => t.id === AUTHORITATIVE_PRIMARY_TOPIC_MAP[faq.source_knowledge_id!]);
    if (found) return found;
  }

  const q = `${faq.question_ko || ""} ${faq.question_en || ""} ${faq.source_title || ""}`.toLowerCase();

  for (const topic of topics) {
    const keywords = (topic.matchKeywords || topic.match_keywords || []).map(k => k.toLowerCase());
    if (keywords.some(kw => q.includes(kw))) {
      return topic;
    }
  }

  return topics[1] || topics[0] || CANONICAL_BRAND_TOPICS[1]; // Default
}
