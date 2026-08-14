import {
  KnowledgeItem,
  SecurityUserContext,
  KnowledgeFilterOptions,
  AudienceType
} from "./types";
import { getStoreKnowledgeItems } from "./store";

/**
 * Deny-by-Default Security & Retrieval Engine for K SELECT Knowledge Center.
 *
 * Security Principle:
 *   Authentication -> Audience Permission -> Authorized Retrieval -> Search Result
 *
 * Un-authorized items are stripped out AT RETRIEVAL LEVEL.
 * Prompt/UI side hiding is strictly prohibited.
 */
export async function getAuthorizedKnowledgeList(
  userContext: SecurityUserContext,
  filters: KnowledgeFilterOptions = {}
): Promise<{ items: KnowledgeItem[]; total: number }> {
  const rawItems = await getStoreKnowledgeItems();

  // 1. Enforce Strict Audience Security (Deny by Default)
  const authorizedItems = rawItems.filter((item) => {
    return isAuthorizedForAudience(userContext, item);
  });

  // 2. Apply Status Filter (Default: Hide SUPERSEDED & ARCHIVED unless explicitly requested)
  let filtered = [...authorizedItems];

  if (filters.status && filters.status !== "ALL") {
    filtered = filtered.filter((item) => item.status === filters.status);
  } else {
    // Default search/library view excludes SUPERSEDED and ARCHIVED
    filtered = filtered.filter(
      (item) => item.status !== "SUPERSEDED" && item.status !== "ARCHIVED"
    );
  }

  // 3. Apply Type Filter
  if (filters.type && filters.type !== "ALL") {
    filtered = filtered.filter((item) => item.type === filters.type);
  }

  // 4. Apply Audience Filter
  if (filters.audience && filters.audience !== "ALL") {
    filtered = filtered.filter((item) => item.audience.includes(filters.audience as AudienceType));
  }

  // 5. Apply Module Filter
  if (filters.module && filters.module !== "ALL") {
    filtered = filtered.filter((item) => item.category === filters.module);
  }

  // 6. Apply Language Filter
  if (filters.language && filters.language !== "ALL") {
    if (filters.language === "KO") {
      filtered = filtered.filter((item) => Boolean(item.title_ko && item.content_ko));
    } else if (filters.language === "EN") {
      filtered = filtered.filter((item) => Boolean(item.title_en && item.content_en));
    } else if (filters.language === "BOTH") {
      filtered = filtered.filter((item) => Boolean(item.title_ko && item.title_en));
    }
  }

  // 7. Apply Text Search (Title, Summary, Content, Tags)
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.title_ko.toLowerCase().includes(q) ||
        item.title_en.toLowerCase().includes(q) ||
        item.summary_ko.toLowerCase().includes(q) ||
        item.summary_en.toLowerCase().includes(q) ||
        item.content_ko.toLowerCase().includes(q) ||
        item.content_en.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }

  // 8. Sorting
  if (filters.sortBy === "title") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (filters.sortBy === "updated") {
    filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } else {
    // default: latest created
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return {
    items: filtered,
    total: filtered.length
  };
}

/**
 * Checks if a specific security user context is authorized to access a knowledge item.
 */
export function isAuthorizedForAudience(
  context: SecurityUserContext,
  item: KnowledgeItem
): boolean {
  // Admin role gets full access to all items
  if (context.role === "admin") {
    return true;
  }

  const audience = item.audience || [];

  // Internal Knowledge: Brand / Retailer / Public / Anonymous CANNOT access
  if (audience.includes("INTERNAL") && !audience.includes("PUBLIC")) {
    return false;
  }

  if (context.role === "brand") {
    // Brand can access items marked with BRAND or PUBLIC
    const isBrandAllowed = audience.includes("BRAND") || audience.includes("PUBLIC");

    // Must be Published to be visible externally
    const isPublished = item.status === "PUBLISHED";

    // Unapproved external items are strictly hidden
    if (item.requires_external_approval && item.external_review_status !== "APPROVED") {
      return false;
    }

    return isBrandAllowed && isPublished;
  }

  if (context.role === "retailer") {
    // Retailer can access items marked with RETAILER or PUBLIC
    const isRetailerAllowed = audience.includes("RETAILER") || audience.includes("PUBLIC");

    // Must be Published to be visible externally
    const isPublished = item.status === "PUBLISHED";

    if (item.requires_external_approval && item.external_review_status !== "APPROVED") {
      return false;
    }

    return isRetailerAllowed && isPublished;
  }

  if (context.role === "public" || context.role === "anonymous") {
    const isPublicAllowed = audience.includes("PUBLIC");
    const isPublished = item.status === "PUBLISHED";
    return isPublicAllowed && isPublished && item.external_review_status === "APPROVED";
  }

  return false;
}
