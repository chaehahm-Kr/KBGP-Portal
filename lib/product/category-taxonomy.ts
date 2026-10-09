import { type Locale } from "@/lib/i18n/types";

export interface CategoryItem {
  code: string;
  name_en: string;
  name_ko: string;
  depth: 1 | 2 | 3;
  parent_code: string | null;
  display_order: number;
  product_count: number;
}

export interface CategoryHierarchy {
  depth1: CategoryItem[];
  depth2ByParent: Record<string, CategoryItem[]>;
  depth3ByParent: Record<string, CategoryItem[]>;
  categoryByCode: Record<string, CategoryItem>;
}

export interface ResolvedProductCategoryPath {
  depth1Code: string;
  depth1LabelEn: string;
  depth1LabelKo: string;
  depth2Code: string | null;
  depth2LabelEn: string | null;
  depth2LabelKo: string | null;
  depth3Code: string | null;
  depth3LabelEn: string | null;
  depth3LabelKo: string | null;
}

// Fallback legacy map from product.category to depth 1 code
export const LEGACY_CATEGORY_TO_DEPTH1: Record<string, string> = {
  skincare: "SKINCARE",
  hair_scalp: "HAIR_CARE",
  hair_care: "HAIR_CARE",
  makeup: "MAKEUP",
  beauty_tools: "BEAUTY_TOOLS",
  daily_care: "BODY_CARE",
  body_care: "BODY_CARE",
  wellness_patch: "PERSONAL_CARE",
  personal_care: "PERSONAL_CARE",
  other: "OTHER",
};

/**
 * Resolves a product's full 3-depth category branch using categories lookup
 */
export function resolveProductCategoryBranch(
  product: { category?: string | null; category_code?: string | null },
  categoryByCode: Record<string, CategoryItem>
): ResolvedProductCategoryPath {
  const rawCode = product.category_code?.trim();
  const rawCat = product.category?.trim().toLowerCase();

  let d1: CategoryItem | null = null;
  let d2: CategoryItem | null = null;
  let d3: CategoryItem | null = null;

  if (rawCode && categoryByCode[rawCode]) {
    const matched = categoryByCode[rawCode];
    if (matched.depth === 3) {
      d3 = matched;
      if (matched.parent_code && categoryByCode[matched.parent_code]) {
        d2 = categoryByCode[matched.parent_code];
        if (d2.parent_code && categoryByCode[d2.parent_code]) {
          d1 = categoryByCode[d2.parent_code];
        }
      }
    } else if (matched.depth === 2) {
      d2 = matched;
      if (matched.parent_code && categoryByCode[matched.parent_code]) {
        d1 = categoryByCode[matched.parent_code];
      }
    } else if (matched.depth === 1) {
      d1 = matched;
    }
  }

  // Fallback to legacy product.category if d1 not resolved
  if (!d1 && rawCat && LEGACY_CATEGORY_TO_DEPTH1[rawCat]) {
    const d1Code = LEGACY_CATEGORY_TO_DEPTH1[rawCat];
    if (categoryByCode[d1Code]) {
      d1 = categoryByCode[d1Code];
    }
  }

  // Default fallback if still null
  const fallbackD1 = d1 || {
    code: "SKINCARE",
    name_en: "Skincare",
    name_ko: "스킨케어",
    depth: 1,
    parent_code: null,
    display_order: 1,
    product_count: 0,
  };

  return {
    depth1Code: fallbackD1.code,
    depth1LabelEn: fallbackD1.name_en,
    depth1LabelKo: fallbackD1.name_ko,
    depth2Code: d2?.code || null,
    depth2LabelEn: d2?.name_en || null,
    depth2LabelKo: d2?.name_ko || null,
    depth3Code: d3?.code || null,
    depth3LabelEn: d3?.name_en || null,
    depth3LabelKo: d3?.name_ko || null,
  };
}

/**
 * Builds CategoryHierarchy and aggregates product counts across branches
 */
export function buildCategoryTreeWithCounts(
  categoryList: CategoryItem[],
  products: Array<{ category?: string | null; category_code?: string | null }>
): CategoryHierarchy {
  const categoryByCode: Record<string, CategoryItem> = {};
  categoryList.forEach((c) => {
    categoryByCode[c.code] = { ...c, product_count: 0 };
  });

  // Count products across their resolved hierarchy
  products.forEach((p) => {
    const branch = resolveProductCategoryBranch(p, categoryByCode);
    if (branch.depth1Code && categoryByCode[branch.depth1Code]) {
      categoryByCode[branch.depth1Code].product_count += 1;
    }
    if (branch.depth2Code && categoryByCode[branch.depth2Code]) {
      categoryByCode[branch.depth2Code].product_count += 1;
    }
    if (branch.depth3Code && categoryByCode[branch.depth3Code]) {
      categoryByCode[branch.depth3Code].product_count += 1;
    }
  });

  const depth1: CategoryItem[] = [];
  const depth2ByParent: Record<string, CategoryItem[]> = {};
  const depth3ByParent: Record<string, CategoryItem[]> = {};

  Object.values(categoryByCode).forEach((cat) => {
    if (cat.depth === 1) {
      depth1.push(cat);
    } else if (cat.depth === 2 && cat.parent_code) {
      if (!depth2ByParent[cat.parent_code]) depth2ByParent[cat.parent_code] = [];
      depth2ByParent[cat.parent_code].push(cat);
    } else if (cat.depth === 3 && cat.parent_code) {
      if (!depth3ByParent[cat.parent_code]) depth3ByParent[cat.parent_code] = [];
      depth3ByParent[cat.parent_code].push(cat);
    }
  });

  // Sort by display_order
  depth1.sort((a, b) => a.display_order - b.display_order);
  Object.keys(depth2ByParent).forEach((key) => {
    depth2ByParent[key].sort((a, b) => a.display_order - b.display_order);
  });
  Object.keys(depth3ByParent).forEach((key) => {
    depth3ByParent[key].sort((a, b) => a.display_order - b.display_order);
  });

  return {
    depth1,
    depth2ByParent,
    depth3ByParent,
    categoryByCode,
  };
}

/**
 * Get category display name for given locale
 */
export function getCategoryDisplayName(cat: CategoryItem | undefined, locale: Locale): string {
  if (!cat) return "";
  return locale === "ko" ? cat.name_ko : cat.name_en;
}
