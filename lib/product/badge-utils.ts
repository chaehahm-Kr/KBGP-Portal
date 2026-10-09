import { type Locale } from "@/lib/i18n/types";

export interface HubBadgeItemConfig {
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  label_en?: string | null;
  label_ko?: string | null;
}

export interface HubBadgesConfig {
  sale?: HubBadgeItemConfig;
  new?: HubBadgeItemConfig;
  hot?: HubBadgeItemConfig;
  priority?: string[];
}

export interface ActiveMarketingBadge {
  type: "promotion" | "sale" | "hot" | "new";
  label: string;
  badgeStyle: string;
}

function isDateInRange(start?: string | null, end?: string | null): boolean {
  const now = new Date();
  if (start) {
    const s = new Date(start);
    if (s > now) return false;
  }
  if (end) {
    let e = new Date(end);
    if (end.length === 10) {
      e = new Date(`${end}T23:59:59.999Z`);
    }
    if (e < now) return false;
  }
  return true;
}

/**
 * Resolves active marketing badges for a product according to priority order
 */
export function resolveActiveMarketingBadges(
  product: {
    isPromoActive?: boolean;
    price_additional_info?: any;
  },
  locale: Locale = "en"
): ActiveMarketingBadge[] {
  const priceInfo = product.price_additional_info || {};
  const hubBadges: HubBadgesConfig = priceInfo.hub_badges || {};

  const activeBadgesMap: Record<string, ActiveMarketingBadge> = {};

  // 1. Promotion Badge
  const hasPromo = Boolean(product.isPromoActive);
  if (hasPromo) {
    activeBadgesMap["promotion"] = {
      type: "promotion",
      label: locale === "ko" ? "프로모션" : "Promotion",
      badgeStyle: "bg-amber-500 text-white border-amber-600 shadow-xs",
    };
  }

  // 2. Sale Badge (avoid duplicate if promotion is active)
  const saleConfig = hubBadges.sale;
  if (saleConfig?.is_active && isDateInRange(saleConfig.start_date, saleConfig.end_date)) {
    if (!hasPromo) {
      const label = locale === "ko"
        ? (saleConfig.label_ko || "세일")
        : (saleConfig.label_en || "Sale");
      activeBadgesMap["sale"] = {
        type: "sale",
        label,
        badgeStyle: "bg-rose-500 text-white border-rose-600 shadow-xs",
      };
    }
  }

  // 3. Hot Badge
  const hotConfig = hubBadges.hot;
  if (hotConfig?.is_active && isDateInRange(hotConfig.start_date, hotConfig.end_date)) {
    const label = locale === "ko"
      ? (hotConfig.label_ko || "인기")
      : (hotConfig.label_en || "Hot");
    activeBadgesMap["hot"] = {
      type: "hot",
      label,
      badgeStyle: "bg-orange-500 text-white border-orange-600 shadow-xs",
    };
  }

  // 4. New Badge
  const newConfig = hubBadges.new;
  if (newConfig?.is_active && isDateInRange(newConfig.start_date, newConfig.end_date)) {
    const label = locale === "ko"
      ? (newConfig.label_ko || "신상품")
      : (newConfig.label_en || "New");
    activeBadgesMap["new"] = {
      type: "new",
      label,
      badgeStyle: "bg-indigo-600 text-white border-indigo-700 shadow-xs",
    };
  }

  // Priority order (default: promotion -> sale -> hot -> new)
  const defaultPriority = ["promotion", "sale", "hot", "new"];
  const configuredPriority = Array.isArray(hubBadges.priority) && hubBadges.priority.length > 0
    ? hubBadges.priority
    : defaultPriority;

  const fullPriority = [...configuredPriority];
  for (const k of defaultPriority) {
    if (!fullPriority.includes(k)) {
      fullPriority.push(k);
    }
  }

  const result: ActiveMarketingBadge[] = [];
  for (const key of fullPriority) {
    if (activeBadgesMap[key]) {
      result.push(activeBadgesMap[key]);
    }
  }

  return result;
}
