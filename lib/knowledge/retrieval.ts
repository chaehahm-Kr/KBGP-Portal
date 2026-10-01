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
import { searchKnowledgeCore } from "./search";

export async function getAuthorizedKnowledgeList(
  userContext: SecurityUserContext,
  filters: KnowledgeFilterOptions = {}
): Promise<{ items: KnowledgeItem[]; total: number; suggestionNotice?: string | null }> {
  const result = await searchKnowledgeCore(filters.search || "", {
    mode: "LIBRARY",
    userContext,
    filters
  });

  return {
    items: result.items,
    total: result.total,
    suggestionNotice: result.suggestionNotice
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

  const audience = (item.audience || []).map(a => a.toUpperCase());

  const roleStr = (context.role || "").toString().toLowerCase();

  if (roleStr === "brand" || roleStr === "portal" || roleStr === "company") {
    // Brand can access items marked with BRAND or PUBLIC
    const isBrandAllowed = audience.includes("BRAND") || audience.includes("PUBLIC");

    // Must be Published to be visible externally
    const isPublished = item.status === "PUBLISHED";

    // Sensitive internal documents are strictly forbidden for external users
    if (item.is_sensitive_internal) {
      return false;
    }

    // Unapproved external items are strictly hidden
    if (item.requires_external_approval && item.external_review_status !== "APPROVED") {
      return false;
    }

    return isBrandAllowed && isPublished;
  }

  if (roleStr === "retailer" || roleStr === "retail" || roleStr === "buyer") {
    // Retailer can access items marked with RETAILER, RETAIL, or PUBLIC
    const isRetailerAllowed = audience.includes("RETAILER") || audience.includes("RETAIL") || audience.includes("PUBLIC");

    // Must be Published to be visible externally
    const isPublished = item.status === "PUBLISHED";

    if (item.is_sensitive_internal) {
      return false;
    }

    if (item.requires_external_approval && item.external_review_status !== "APPROVED") {
      return false;
    }

    return isRetailerAllowed && isPublished;
  }

  if (context.role === "public" || context.role === "anonymous") {
    const isPublicAllowed = audience.includes("PUBLIC");
    const isPublished = item.status === "PUBLISHED";
    return isPublicAllowed && isPublished && !item.is_sensitive_internal && (!item.requires_external_approval || item.external_review_status === "APPROVED");
  }

  return false;
}
