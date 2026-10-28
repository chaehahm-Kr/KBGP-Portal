/**
 * Category Classification Engine
 * ADM-BSRC-011: Authoritative Six Primary Product Category Classification
 *
 * Classifications:
 * 1. SKINCARE      — 스킨케어
 * 2. HAIRCARE      — 헤어케어
 * 3. MAKEUP        — 메이크업
 * 4. BODYCARE      — 바디케어
 * 5. PERSONAL_CARE — 퍼스널케어
 * 6. BEAUTY_TOOLS  — 뷰티툴
 *
 * Rules:
 * - Multi-select supported.
 * - Automatically recommend based ONLY on available product info, raw categories, and website evidence.
 * - Do not infer without concrete evidence.
 * - If evidence is insufficient, return empty array (renders as Unclassified).
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
      /skin\s*care/i,
      /skincare/i,
      /facial\s*mask/i,
      /derma/i,
      /cosmeceutical/i,
      /스킨케어/i,
      /마스크팩/i,
      /기초화장품/i,
      /수분크림/i,
    ],
    keywordPatterns: [
      /\b(skincare|skin\s*care|serum|ampoule|toner|facial\s*mask|sheet\s*mask|cleanser|cleansing\s*foam|moisturizer|sunscreen|sun\s*cream|sun\s*care|essence|eye\s*cream)\b/i,
      /(스킨케어|기초화장품|세럼|앰플|토너|로션|에멀전|크림|마스크팩|시트마스크|클렌징|선크림|선케어|에센스|아이크림|수분크림)/i,
    ],
  },
  {
    category: "HAIRCARE",
    categoryPatterns: [
      /hair\s*care/i,
      /haircare/i,
      /scalp\s*care/i,
      /헤어케어/i,
      /두피케어/i,
    ],
    keywordPatterns: [
      /\b(haircare|hair\s*care|shampoo|conditioner|hair\s*treatment|scalp|hair\s*oil|hair\s*serum|hair\s*essence|hair\s*tonic)\b/i,
      /(헤어케어|샴푸|컨디셔너|린스|트리트먼트|헤어팩|두피|두피케어|탈모|모발케어)/i,
    ],
  },
  {
    category: "MAKEUP",
    categoryPatterns: [
      /make\s*up/i,
      /makeup/i,
      /color\s*cosmetics/i,
      /lip/i,
      /cushion/i,
      /foundation/i,
      /메이크업/i,
      /색조/i,
    ],
    keywordPatterns: [
      /\b(makeup|make-up|color\s*cosmetics?|lipstick|lip\s*tint|lip\s*gloss|foundation|cushion|bb\s*cream|cc\s*cream|concealer|mascara|eyeliner|eyeshadow|blusher|blush|highlighter)\b/i,
      /(메이크업|색조|색조화장|립스틱|립틴트|틴트|파운데이션|쿠션|비비크림|컨실러|마스카라|아이라이너|아이섀도우|블러셔|볼터치|하이라이터)/i,
    ],
  },
  {
    category: "BODYCARE",
    categoryPatterns: [
      /body\s*care/i,
      /bodycare/i,
      /body\s*wash/i,
      /바디케어/i,
    ],
    keywordPatterns: [
      /\b(body\s*care|bodycare|body\s*wash|body\s*lotion|body\s*cream|body\s*oil|body\s*scrub|shower\s*gel|bath\s*salt)\b/i,
      /(바디케어|바디워시|바디로션|바디크림|바디오일|바디스크럽|샤워젤|입욕제)/i,
    ],
  },
  {
    category: "PERSONAL_CARE",
    categoryPatterns: [
      /personal\s*care/i,
      /personalcare/i,
      /oral\s*care/i,
      /feminine\s*care/i,
      /hand\s*care/i,
      /foot\s*care/i,
      /퍼스널케어/i,
      /구강케어/i,
      /여성청결제/i,
    ],
    keywordPatterns: [
      /\b(personal\s*care|oral\s*care|toothpaste|mouthwash|feminine\s*wash|hand\s*cream|hand\s*wash|foot\s*cream|deodorant|soap\s*bar)\b/i,
      /(퍼스널케어|핸드크림|핸드워시|풋크림|풋케어|치약|가글|구강청결제|여성청결제|데오드란트)/i,
    ],
  },
  {
    category: "BEAUTY_TOOLS",
    categoryPatterns: [
      /beauty\s*tools?/i,
      /beauty\s*devices?/i,
      /tools\s*&\s*accessories/i,
      /뷰티툴/i,
      /미용기기/i,
      /미용소품/i,
    ],
    keywordPatterns: [
      /\b(beauty\s*tool|beauty\s*device|makeup\s*brush|puff|sponge|cleansing\s*device|facial\s*roller|guasha|applicator)\b/i,
      /(뷰티툴|미용기기|미용소품|브러쉬|퍼프|스펀지|괄사|갈바닉|마사지기|뷰러)/i,
    ],
  },
];

/**
 * Recommends primary product categories from evidence.
 * If evidence is insufficient, returns an empty array.
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
