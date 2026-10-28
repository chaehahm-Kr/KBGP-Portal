/**
 * Category Classification Engine
 * ADM-BSRC-011 / ADM-BSRC-011-R1: Authoritative Six Primary Product Category Classification
 *
 * Classifications:
 * 1. SKINCARE      — 스킨케어
 * 2. HAIRCARE      — 헤어케어
 * 3. MAKEUP        — 메이크업
 * 4. BODYCARE      — 바디케어
 * 5. PERSONAL_CARE — 퍼스널케어
 * 6. BEAUTY_TOOLS  — 뷰티툴
 *
 * Safety & Accuracy Rules (ADM-BSRC-011-R1):
 * - Multi-select supported.
 * - Recommend based ONLY on concrete evidence (product info, raw categories, official website).
 * - Avoid ambiguous false positives:
 *     - "eye cream" is SKINCARE, never MAKEUP; bare "eye" or "eye-catching" matches neither.
 *     - "color cosmetics" / "색조" is MAKEUP; bare "color" (e.g. skin color, hair color) matches neither.
 *     - "hand cream" is PERSONAL_CARE, "body cream" is BODYCARE; bare "cream" matches neither.
 *     - "hand cream/wash/care" is PERSONAL_CARE; bare "hand" (e.g. handmade, second hand) matches neither.
 *     - "body care/wash/lotion" is BODYCARE; bare "body" (e.g. governing body) matches neither.
 *     - "beauty tools/devices" is BEAUTY_TOOLS; bare "tool" or "device" matches neither.
 * - If evidence is weak or absent, return empty array (renders as Unclassified).
 * - Automatic recommendations are always unconfirmed (primary_categories_confirmed = false).
 */

import { PrimaryProductCategory, PRIMARY_PRODUCT_CATEGORY_OPTIONS } from "./types";

export interface CategoryEvidenceInput {
  categories?: string[];
  products?: Array<{
    titleKr?: string | null;
    titleEn?: string | null;
    description?: string | null;
  }>;
  descriptions?: Array<string | null | undefined>;
  brandNames?: string[];
  websiteText?: string | null;
}

interface CategoryDefinition {
  category: PrimaryProductCategory;
  categoryPatterns: RegExp[];
  keywordPatterns: RegExp[];
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    category: "SKINCARE",
    categoryPatterns: [
      /\bskin\s*care\b/i,
      /\bskincare\b/i,
      /\bfacial\s*mask\b/i,
      /\bderma\b/i,
      /\bcosmeceutical\b/i,
      /스킨케어/i,
      /기초화장품/i,
      /기초케어/i,
      /마스크팩/i,
      /수분크림/i,
      /영양크림/i,
    ],
    keywordPatterns: [
      /\b(skincare|skin\s*care|serum|ampoule|toner|essence|facial\s*mask|sheet\s*mask|cleanser|cleansing\s*foam|moisturizer|moisturizing\s*cream|water\s*cream|hydrating\s*cream|nourishing\s*cream|sunscreen|sun\s*cream|sun\s*care|eye\s*cream)\b/i,
      /(스킨케어|기초화장품|기초케어|세럼|앰플|토너|스킨|로션|에멀전|에센스|수분크림|영양크림|탄력크림|재생크림|아이크림|마스크팩|시트마스크|클렌징|클렌징폼|선크림|선케어|선블록)/i,
    ],
  },
  {
    category: "HAIRCARE",
    categoryPatterns: [
      /\bhair\s*care\b/i,
      /\bhaircare\b/i,
      /\bscalp\s*care\b/i,
      /헤어케어/i,
      /두피케어/i,
    ],
    keywordPatterns: [
      /\b(haircare|hair\s*care|shampoo|conditioner|hair\s*treatment|scalp\s*care|hair\s*oil|hair\s*serum|hair\s*mask|hair\s*tonic)\b/i,
      /(헤어케어|헤어|샴푸|컨디셔너|린스|트리트먼트|헤어팩|두피케어|두피|탈모|모발케어|모발)/i,
    ],
  },
  {
    category: "MAKEUP",
    categoryPatterns: [
      /\bmake\s*up\b/i,
      /\bmakeup\b/i,
      /\bcolor\s*cosmetics?\b/i,
      /\bcolor\s*makeup\b/i,
      /\bfoundation\b/i,
      /\bcushion\s*(compact|foundation)?\b/i,
      /메이크업/i,
      /색조/i,
      /색조화장/i,
    ],
    keywordPatterns: [
      /\b(makeup|make-up|color\s*cosmetics?|color\s*makeup|lipstick|lip\s*tint|lip\s*gloss|lip\s*balm|foundation|cushion|cushion\s*compact|bb\s*cream|cc\s*cream|concealer|mascara|eyeliner|eyeshadow|blusher|blush|highlighter)\b/i,
      /(메이크업|색조|색조화장|립스틱|립틴트|립글로스|립밤|파운데이션|쿠션|비비크림|cc크림|컨실러|마스카라|아이라이너|아이섀도우|블러셔|볼터치|하이라이터)/i,
    ],
  },
  {
    category: "BODYCARE",
    categoryPatterns: [
      /\bbody\s*care\b/i,
      /\bbodycare\b/i,
      /\bbody\s*wash\b/i,
      /바디케어/i,
      /바디워시/i,
    ],
    keywordPatterns: [
      /\b(body\s*care|bodycare|body\s*wash|body\s*lotion|body\s*cream|body\s*oil|body\s*scrub|body\s*mist|shower\s*gel|bath\s*salt)\b/i,
      /(바디케어|바디워시|바디로션|바디크림|바디오일|바디스크럽|샤워젤|입욕제|바디미스트)/i,
    ],
  },
  {
    category: "PERSONAL_CARE",
    categoryPatterns: [
      /\bpersonal\s*care\b/i,
      /\bpersonalcare\b/i,
      /\boral\s*care\b/i,
      /\bfeminine\s*(care|wash)\b/i,
      /\bhand\s*care\b/i,
      /\bfoot\s*care\b/i,
      /퍼스널케어/i,
      /구강케어/i,
      /구강청결/i,
      /여성청결제/i,
      /핸드케어/i,
      /풋케어/i,
    ],
    keywordPatterns: [
      /\b(personal\s*care|oral\s*care|toothpaste|mouthwash|toothbrush|feminine\s*wash|feminine\s*care|hand\s*cream|hand\s*wash|hand\s*lotion|hand\s*care|foot\s*cream|foot\s*care|foot\s*mask|deodorant|intimate\s*wash)\b/i,
      /(퍼스널케어|구강케어|구강청결|치약|칫솔|가글|여성청결제|여성케어|핸드크림|핸드워시|핸드로션|핸드케어|풋크림|풋케어|풋마스크|데오드란트)/i,
    ],
  },
  {
    category: "BEAUTY_TOOLS",
    categoryPatterns: [
      /\bbeauty\s*tools?\b/i,
      /\bbeauty\s*devices?\b/i,
      /\btools\s*&\s*accessories\b/i,
      /뷰티툴/i,
      /미용기기/i,
      /미용소품/i,
    ],
    keywordPatterns: [
      /\b(beauty\s*tools?|beauty\s*devices?|makeup\s*brush(es)?|cosmetic\s*brush(es)?|powder\s*puff|makeup\s*sponge|facial\s*roller|guasha|galvanic|eyelash\s*curler|cleansing\s*device)\b/i,
      /(뷰티툴|미용기기|미용소품|메이크업브러쉬|브러쉬|퍼프|스펀지|괄사|갈바닉|마사지기|뷰러)/i,
    ],
  },
];

/**
 * Recommends primary product categories from concrete evidence.
 * If evidence is insufficient, returns an empty array (Unclassified).
 */
export function recommendPrimaryProductCategories(
  input: CategoryEvidenceInput
): PrimaryProductCategory[] {
  const recommended = new Set<PrimaryProductCategory>();

  // 1. Compile all raw categories
  const rawCategories = (input.categories || []).filter(Boolean);

  // 2. Compile all product text
  const productTexts: string[] = [];
  if (input.products) {
    for (const p of input.products) {
      if (p.titleKr) productTexts.push(p.titleKr);
      if (p.titleEn) productTexts.push(p.titleEn);
      if (p.description) productTexts.push(p.description);
    }
  }

  // 3. Compile all descriptions & website text
  const textCorpus: string[] = [
    ...(input.descriptions || []).filter((d): d is string => typeof d === "string" && d.length > 0),
    ...(input.brandNames || []),
    input.websiteText || "",
    ...productTexts,
  ];
  const combinedCorpus = textCorpus.join(" ");

  for (const def of CATEGORY_DEFINITIONS) {
    // Check official category matches first (highest precision)
    const hasCategoryMatch = rawCategories.some((rc) =>
      def.categoryPatterns.some((pattern) => pattern.test(rc))
    );

    if (hasCategoryMatch) {
      recommended.add(def.category);
      continue;
    }

    // Check product titles and description keywords (concrete evidence)
    if (combinedCorpus) {
      const hasKeywordMatch = def.keywordPatterns.some((pattern) => pattern.test(combinedCorpus));
      if (hasKeywordMatch) {
        recommended.add(def.category);
      }
    }
  }

  // Return in canonical order
  return PRIMARY_PRODUCT_CATEGORY_OPTIONS
    .map((opt) => opt.value)
    .filter((cat) => recommended.has(cat));
}
