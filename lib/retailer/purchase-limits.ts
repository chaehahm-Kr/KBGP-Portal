import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ResolvedPurchaseLimit,
  type PurchaseLimitPeriod,
  resolveRetailerSalesPolicy,
} from "@/lib/product/retailer-policy";

export interface RetailerPurchaseAllowance {
  productId: string;
  limit: number;
  period: PurchaseLimitPeriod;
  periodStart: string;
  periodEnd: string;
  purchasedInPeriod: number;
  remainingAllowance: number;
  availableStock: number;
  effectiveMaxPurchasable: number; // Max valid multiple of MOQ <= MIN(availableStock, remainingAllowance)
  rawMaxPurchasable: number; // Pure MIN(availableStock, remainingAllowance)
  moq: number;
  isLimitReached: boolean;
  limitEnabled: boolean;
}

export const QUALIFYING_ORDER_STATUSES = [
  "submitted",
  "confirmed",
  "processing",
  "fulfilled",
  "shipped",
  "completed",
];

/**
 * Computes UTC period start and end for account purchase limits
 */
export function getPurchaseLimitPeriodRange(
  period: PurchaseLimitPeriod = "monthly",
  now: Date = new Date()
): { start: Date; end: Date } {
  if (period === "daily") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { start, end };
  }

  if (period === "weekly") {
    const day = now.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const diff = (day === 0 ? -6 : 1) - day;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff, 0, 0, 0, 0));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6, 23, 59, 59, 999));
    return { start, end };
  }

  // Default: monthly
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const end = new Date(nextMonth.getTime() - 1);
  return { start, end };
}

/**
 * Calculates a single retailer company's purchase allowance for a product
 */
export async function getRetailerAccountPurchaseAllowance(
  companyId: string,
  productId: string,
  moq: number,
  availableStock: number,
  purchaseLimit?: ResolvedPurchaseLimit
): Promise<RetailerPurchaseAllowance> {
  const adminClient = createAdminClient();

  const safeMoq = Math.max(1, moq || 1);
  const limitConfig = purchaseLimit || {
    enabled: true,
    useDefault: true,
    period: "monthly" as PurchaseLimitPeriod,
    maxQuantity: safeMoq * 10,
  };

  const period = limitConfig.period || "monthly";
  const { start, end } = getPurchaseLimitPeriodRange(period);

  let purchasedInPeriod = 0;

  if (limitConfig.enabled && companyId) {
    try {
      const { data: orderItems, error: itemsErr } = await adminClient
        .from("retailer_order_items")
        .select(`
          quantity,
          retailer_orders!inner(id, company_id, order_status, created_at)
        `)
        .eq("product_id", productId)
        .eq("retailer_orders.company_id", companyId)
        .in("retailer_orders.order_status", QUALIFYING_ORDER_STATUSES)
        .gte("retailer_orders.created_at", start.toISOString());

      if (!itemsErr && orderItems) {
        purchasedInPeriod = orderItems.reduce((acc, row: any) => acc + (Number(row.quantity) || 0), 0);
      }
    } catch (err) {
      console.error("[PurchaseLimit] Failed to query qualifying orders:", err);
    }
  }

  const limit = limitConfig.enabled ? Math.max(1, limitConfig.maxQuantity) : 999999;
  const remainingAllowance = limitConfig.enabled ? Math.max(0, limit - purchasedInPeriod) : 999999;
  const rawMax = Math.min(availableStock, remainingAllowance);
  const effectiveMaxPurchasable = rawMax < safeMoq ? 0 : Math.floor(rawMax / safeMoq) * safeMoq;
  const isLimitReached = limitConfig.enabled && remainingAllowance < safeMoq;

  return {
    productId,
    limit,
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    purchasedInPeriod,
    remainingAllowance,
    availableStock,
    effectiveMaxPurchasable,
    rawMaxPurchasable: rawMax,
    moq: safeMoq,
    isLimitReached,
    limitEnabled: limitConfig.enabled,
  };
}

/**
 * Batch resolves allowances and live stock for multiple products in cart/detail
 */
export async function getRetailerAccountPurchaseAllowances(
  companyId: string,
  productIds: string[]
): Promise<Record<string, RetailerPurchaseAllowance>> {
  if (!productIds || productIds.length === 0) return {};

  const adminClient = createAdminClient();

  // 1. Fetch products & inventory
  const [productsRes, balancesRes] = await Promise.all([
    adminClient
      .from("products")
      .select("id, carton_pack_qty, price_additional_info, trading_wholesale_price, trading_promo_wholesale_price, trading_promo_start_date, trading_promo_end_date, estimated_retail_price")
      .in("id", productIds),
    adminClient
      .from("inventory_balances")
      .select("product_id, qty_on_hand, qty_hold, qty_damaged")
      .in("product_id", productIds),
  ]);

  const stockByProd = new Map<string, number>();
  (balancesRes.data ?? []).forEach((b: any) => {
    const onHand = Number(b.qty_on_hand || 0);
    const hold = Number(b.qty_hold || 0);
    const damaged = Number(b.qty_damaged || 0);
    const avail = Math.max(0, onHand - hold - damaged);
    stockByProd.set(b.product_id, (stockByProd.get(b.product_id) || 0) + avail);
  });

  const results: Record<string, RetailerPurchaseAllowance> = {};

  await Promise.all(
    (productsRes.data ?? []).map(async (prod: any) => {
      const policy = resolveRetailerSalesPolicy(prod);
      const moq = policy.moq > 0 ? policy.moq : (prod.carton_pack_qty || 1);
      const availableStock = stockByProd.get(prod.id) ?? 0;

      const allowance = await getRetailerAccountPurchaseAllowance(
        companyId,
        prod.id,
        moq,
        availableStock,
        policy.purchaseLimit
      );
      results[prod.id] = allowance;
    })
  );

  return results;
}
