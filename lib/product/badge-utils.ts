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
}

export interface ActiveMarketingBadge {
  type: "promotion" | "sale" | "new";
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
 * Resolves up to 3 active marketing badges for a product
 */
export function resolveActiveMarketingBadges(
  product: {
    isPromoActive?: boolean;
    price_additional_info?: any;
  },
  locale: Locale = "en"
): ActiveMarketingBadge[] {
  const badges: ActiveMarketingBadge[] = [];
  const priceInfo = product.price_additional_info || {};
  const hubBadges: HubBadgesConfig = priceInfo.hub_badges || {};

  // 1. Promotion Badge
  const hasPromo = Boolean(product.isPromoActive);
  if (hasPromo) {
    badges.push({
      type: "promotion",
      label: locale === "ko" ? "프로모션" : "Promotion",
      badgeStyle: "bg-amber-500 text-white border-amber-600 shadow-xs",
    });
  }

  // 2. Sale Badge (avoid duplicate if promotion is active and configured same)
  const saleConfig = hubBadges.sale;
  if (saleConfig?.is_active && isDateInRange(saleConfig.start_date, saleConfig.end_date)) {
    if (!hasPromo) {
      const label = locale === "ko"
        ? (saleConfig.label_ko || "세일")
        : (saleConfig.label_en || "Sale");
      badges.push({
        type: "sale",
        label,
        badgeStyle: "bg-rose-500 text-white border-rose-600 shadow-xs",
      });
    }
  }

  // 3. New Badge
  const newConfig = hubBadges.new;
  if (newConfig?.is_active && isDateInRange(newConfig.start_date, newConfig.end_date)) {
    const label = locale === "ko"
      ? (newConfig.label_ko || "신상품")
      : (newConfig.label_en || "New");
    badges.push({
      type: "new",
      label,
      badgeStyle: "bg-indigo-600 text-white border-indigo-700 shadow-xs",
    });
  }

  // Maximum 3 badges
  return badges.slice(0, 3);
}
