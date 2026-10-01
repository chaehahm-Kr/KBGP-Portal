import { KnowledgeItem, AudienceType, SecurityUserContext } from "./types";
import { getStoreKnowledgeItems, getStoreAssets } from "./store";

export interface AudienceDistributionResult {
  success: boolean;
  audience: AudienceType;
  totalCount: number;
  items: Array<{
    id: string;
    slug: string;
    title: string;
    title_ko: string;
    title_en: string;
    summary_ko: string;
    summary_en: string;
    type: string;
    module: string;
    category: string;
    tags: string[];
    current_version: string;
    effective_date: string;
    audience: AudienceType[];
    document_url?: string | null;
    document_name?: string | null;
    document_size?: number | null;
    document_type?: string | null;
    updated_at: string;
  }>;
}

/**
 * Normalizes audience input string to standard AudienceType.
 */
export function normalizeAudience(rawAudience: string): AudienceType | null {
  const upper = rawAudience.trim().toUpperCase();
  if (upper === "BRAND") return "BRAND";
  if (upper === "RETAIL" || upper === "RETAILER") return "RETAILER";
  if (upper === "INTERNAL" || upper === "ADMIN") return "INTERNAL";
  if (upper === "PUBLIC") return "PUBLIC";
  return null;
}

/**
 * Validates whether a knowledge item is eligible for distribution to a specific audience.
 * Rules:
 * 1. Must be PUBLISHED (DRAFT or ARCHIVED are strictly excluded).
 * 2. Audience metadata must contain the target audience.
 * 3. If target audience is external (BRAND, RETAIL, PUBLIC), item cannot be sensitive internal.
 */
export function isEligibleForAudience(
  item: KnowledgeItem,
  targetAudience: AudienceType
): boolean {
  // Rule 1: Must be PUBLISHED
  if (item.status !== "PUBLISHED") {
    return false;
  }

  // Rule 2: Target audience isolation & matching
  const itemAudiences = (item.audience || []).map(a => a.toUpperCase());
  const normTarget = targetAudience.toUpperCase();

  let matchesAudience = false;
  if (normTarget === "BRAND" && itemAudiences.includes("BRAND")) {
    matchesAudience = true;
  } else if ((normTarget === "RETAIL" || normTarget === "RETAILER") && (itemAudiences.includes("RETAIL") || itemAudiences.includes("RETAILER"))) {
    matchesAudience = true;
  } else if (normTarget === "INTERNAL" && (itemAudiences.includes("INTERNAL") || itemAudiences.includes("ADMIN / MANAGEMENT"))) {
    matchesAudience = true;
  } else if (normTarget === "PUBLIC" && itemAudiences.includes("PUBLIC")) {
    matchesAudience = true;
  }

  if (!matchesAudience) {
    return false;
  }

  // Rule 3: External portals must not receive sensitive internal documents
  if (normTarget !== "INTERNAL" && item.is_sensitive_internal) {
    return false;
  }

  return true;
}

/**
 * Query Foundation: Audience-Scoped Published Knowledge Retrieval.
 * Usable by Brand Portal, Retail Portal, and Internal Knowledge Guide / Ask K SELECT.
 */
export async function getPublishedKnowledgeForAudience(
  audience: AudienceType,
  options?: {
    module?: string;
    type?: string;
    search?: string;
    userContext?: SecurityUserContext;
  }
): Promise<AudienceDistributionResult> {
  const allItems = await getStoreKnowledgeItems();

  // Filter only eligible published items for this audience
  let eligibleItems = allItems.filter(item => isEligibleForAudience(item, audience));

  // Optional Module filter
  if (options?.module && options.module !== "ALL") {
    const modLower = options.module.toLowerCase();
    eligibleItems = eligibleItems.filter(
      item => item.module?.toLowerCase() === modLower || item.category?.toLowerCase() === modLower
    );
  }

  // Optional Type filter
  if (options?.type && options.type !== "ALL") {
    eligibleItems = eligibleItems.filter(item => item.type === options.type);
  }

  // Optional Search filter
  if (options?.search) {
    const q = options.search.toLowerCase();
    eligibleItems = eligibleItems.filter(item =>
      item.title?.toLowerCase().includes(q) ||
      item.title_ko?.toLowerCase().includes(q) ||
      item.title_en?.toLowerCase().includes(q) ||
      item.summary_ko?.toLowerCase().includes(q) ||
      item.summary_en?.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  const resultItems = eligibleItems.map(item => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    title_ko: item.title_ko,
    title_en: item.title_en,
    summary_ko: item.summary_ko,
    summary_en: item.summary_en,
    type: item.type,
    module: item.module || item.category || "General",
    category: item.category || item.module || "General",
    tags: item.tags || [],
    current_version: item.current_version,
    effective_date: item.effective_date,
    audience: item.audience,
    document_url: item.document_url,
    document_name: item.document_name,
    document_size: item.document_size,
    document_type: item.document_type,
    updated_at: item.updated_at
  }));

  return {
    success: true,
    audience,
    totalCount: resultItems.length,
    items: resultItems
  };
}
