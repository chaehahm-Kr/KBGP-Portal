"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import {
  resolveRetailerSalesPolicy,
  calculateApplicablePrice,
  isValidMoqOrderQuantity,
} from "@/lib/product/retailer-policy";
import { evaluateHubVisibility } from "@/lib/product/hub-visibility";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { getRetailerPaymentEligibility, getOrderPayments } from "@/lib/retailer/payment-actions";
import { RetailerPaymentMethod, RetailerPaymentRecord } from "@/lib/retailer/payment-types";
import {
  calculateProcessingFee,
  PaymentMethodSnapshot,
  OrderTotalSnapshot,
} from "@/lib/retailer/payment-policy";
import { resolveEffectivePaymentPolicy } from "@/lib/retailer/payment-policy-server";
import { getOrderFulfillments } from "@/lib/retailer/fulfillment-actions";
import { getRetailerAccountPurchaseAllowance } from "@/lib/retailer/purchase-limits";
import { evaluatePromotionsForCart } from "@/lib/retailer/promotions";

function parsePaymentNotesSnapshot(notes?: string | null): {
  payment_snapshot?: any;
  order_total_snapshot?: any;
  promotion_snapshot?: any;
} | null {
  if (!notes || !notes.includes("[PAYMENT_SNAPSHOT]:")) return null;
  try {
    const raw = notes.split("[PAYMENT_SNAPSHOT]:")[1].trim();
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export interface RetailerOrderSummary {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: RetailerPaymentMethod | null;
  paymentTerms: string;
  paymentDueDate: string | null;
  paidAt: string | null;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount?: number;
  processingFee?: number;
  couponCode?: string | null;
  paymentSnapshot?: PaymentMethodSnapshot | null;
  totalItemsCount: number;
  totalSkusCount: number;
  createdAt: string;
  storeId: string | null;
  storeName: string;
  isTest: boolean;
}

export interface RetailerOrderItemDetail {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brandName: string;
  unitWholesalePrice: number;
  unitMsrp: number | null;
  quantity: number;
  quantityShipped?: number;
  quantityDelivered?: number;
  casePackQty: number;
  lineTotal: number;
  discountAmount?: number;
  isBogoFree?: boolean;
}

export interface RetailerOrderDetail extends RetailerOrderSummary {
  taxAmount: number;
  shippingAmount: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingPhone: string | null;
  recipientName: string | null;
  notes: string | null;
  paymentProviderRef: string | null;
  paymentNotes: string | null;
  promotionSnapshot?: any | null;
  items: RetailerOrderItemDetail[];
  payments: RetailerPaymentRecord[];
  fulfillments: import("./fulfillment-types").RetailerFulfillment[];
}

export interface SubmitOrderPayload {
  storeId?: string;
  paymentMethod?: RetailerPaymentMethod;
  notes?: string;
  couponCode?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface SubmitOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

/**
 * Authoritative Server-side Retailer Wholesale Price Resolver
 * Hierarchy:
 * 1. Active Trading Promo Wholesale (if within valid date range)
 * 2. Trading Wholesale
 * 3. Approved legacy product_curations.wholesale_price
 * 4. Otherwise unavailable (FOB price_usd_fob is NEVER used!)
 */
function resolveAuthoritativeWholesalePrice(prod: {
  price_additional_info?: any;
  product_curations?: any;
  trading_wholesale_price?: number | null;
  trading_promo_wholesale_price?: number | null;
  trading_promo_start_date?: string | null;
  trading_promo_end_date?: string | null;
  estimated_retail_price?: number | null;
}): {
  wholesalePrice: number;
  isPromo: boolean;
  srp: number | null;
  isOrderable: boolean;
} {
  const info = (prod.price_additional_info as any) || {};
  const overrides = info.trading_overrides || {};
  const curation = Array.isArray(prod.product_curations)
    ? prod.product_curations[0]
    : prod.product_curations;

  const isPricingActive =
    overrides.is_pricing_active !== false && (prod as any).trading_pricing_active !== false;

  if (!isPricingActive) {
    return {
      wholesalePrice: 0,
      isPromo: false,
      srp: null,
      isOrderable: false,
    };
  }

  // 1. Check Promo Wholesale Price
  const now = new Date();
  const promoPrice = Number(
    overrides.promo_wholesale_price || (prod as any).trading_promo_wholesale_price || 0
  );
  const promoStart = overrides.promo_start_date || (prod as any).trading_promo_start_date;
  const promoEnd = overrides.promo_end_date || (prod as any).trading_promo_end_date;

  if (promoPrice > 0) {
    const isStartValid = !promoStart || new Date(promoStart) <= now;
    const isEndValid = !promoEnd || new Date(promoEnd) >= now;
    if (isStartValid && isEndValid) {
      return {
        wholesalePrice: promoPrice,
        isPromo: true,
        srp:
          Number(
            overrides.srp_price ||
              curation?.suggest_retail_price ||
              prod.estimated_retail_price ||
              0
          ) || null,
        isOrderable: true,
      };
    }
  }

  // 2. Check Standard Trading Wholesale Price
  const tradingWholesale = Number(
    overrides.wholesale_price || (prod as any).trading_wholesale_price || 0
  );
  if (tradingWholesale > 0) {
    return {
      wholesalePrice: tradingWholesale,
      isPromo: false,
      srp:
        Number(
          overrides.srp_price ||
            curation?.suggest_retail_price ||
            prod.estimated_retail_price ||
            0
        ) || null,
      isOrderable: true,
    };
  }

  // 3. Check Legacy Approved Wholesale Price from product_curations
  const curationWholesale = Number(curation?.wholesale_price || 0);
  if (curationWholesale > 0) {
    return {
      wholesalePrice: curationWholesale,
      isPromo: false,
      srp:
        Number(curation?.suggest_retail_price || prod.estimated_retail_price || 0) || null,
      isOrderable: true,
    };
  }

  // 4. Confidential FOB (price_usd_fob) is NEVER used as wholesale selling price!
  return {
    wholesalePrice: 0,
    isPromo: false,
    srp: null,
    isOrderable: false,
  };
}

/**
 * Submit a Retailer B2B Order
 */
export async function submitRetailerOrder(
  payload: SubmitOrderPayload
): Promise<SubmitOrderResult> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: "Order cart cannot be empty." };
    }

    // 1. Fetch Company & Retailer Profile
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id, companies!company_users_company_id_fkey(id, name)")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { success: false, error: "Retailer company membership not found." };
    }

    const companyName = (companyUser?.companies as any)?.name || "";
    const isTestCompany =
      companyName.toLowerCase().includes("test") ||
      companyName.toLowerCase().includes("qa") ||
      companyName.toLowerCase().includes("demo");

    // Check caller's role authorization in retailer_user_roles
    const { data: userRoleRow } = await adminClient
      .from("retailer_user_roles")
      .select("role, has_all_stores_access")
      .eq("user_id", session.userId)
      .eq("company_id", companyId)
      .maybeSingle();

    const userRole = userRoleRow?.role || "employee";
    const hasAllStoresAccess = userRoleRow?.has_all_stores_access ?? false;

    if (userRole !== "owner" && userRole !== "buyer" && userRole !== "store_manager") {
      return {
        success: false,
        error: `User role "${userRole}" is not authorized to submit orders. Only owners, buyers, and store managers can place orders.`,
      };
    }

    // 2. Validate Payment Eligibility & Terms via Authoritative Policy
    const policy = await resolveEffectivePaymentPolicy(companyId);
    let chosenPaymentMethod: RetailerPaymentMethod = payload.paymentMethod || "card";

    // Validate that the chosen payment method is allowed for this retailer
    if (chosenPaymentMethod === "terms") {
      if (!policy.terms.effectiveEnabled) {
        return {
          success: false,
          error: "Net terms are not authorized or approved for your account. Please select Card or ACH.",
        };
      }
    } else if (chosenPaymentMethod === "card") {
      if (!policy.card.effectiveEnabled) {
        return {
          success: false,
          error: "Card payments are currently disabled for your account. Please select ACH or Terms.",
        };
      }
    } else if (chosenPaymentMethod === "ach") {
      if (!policy.ach.effectiveEnabled) {
        return {
          success: false,
          error: "ACH payments are currently disabled for your account. Please select Card or Terms.",
        };
      }
    } else {
      chosenPaymentMethod = "card";
    }

    // Determine effective payment terms and due date
    let paymentTerms = "PREPAID";
    let paymentDueDate: string | null = null;

    if (chosenPaymentMethod === "terms") {
      paymentTerms = policy.terms.approvedTerms.toUpperCase();
      const days = policy.terms.termDays || 30;
      const due = new Date();
      due.setDate(due.getDate() + days);
      paymentDueDate = due.toISOString();
    } else if (chosenPaymentMethod === "card") {
      paymentTerms = "PREPAID_CARD";
    } else if (chosenPaymentMethod === "ach") {
      paymentTerms = "PREPAID_ACH";
    }

    // 3. Validate Store & Address
    let storeId: string | null = payload.storeId || null;
    let storeData: any = null;

    if (storeId) {
      const { data: store } = await adminClient
        .from("stores")
        .select("id, name, address, city, state, zip, phone, manager_name")
        .eq("id", storeId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!store) {
        return { success: false, error: "Selected store is invalid or not accessible." };
      }
      storeData = store;
    } else {
      // Auto-select primary store if exists
      const { data: stores } = await adminClient
        .from("stores")
        .select("id, name, address, city, state, zip, phone, manager_name")
        .eq("company_id", companyId)
        .limit(1);

      if (stores && stores.length > 0) {
        storeData = stores[0];
        storeId = stores[0].id;
      }
    }

    // If store_manager, verify store-scope assignment
    if (userRole === "store_manager" && !hasAllStoresAccess && storeId) {
      const { data: storeAccess } = await adminClient
        .from("retailer_user_store_access")
        .select("id")
        .eq("user_id", session.userId)
        .eq("company_id", companyId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (!storeAccess) {
        return {
          success: false,
          error: "You do not have authorization to place orders for the selected store.",
        };
      }
    }

    // 4. Fetch Real Products from Product Master & Validate
    const productIds = payload.items.map((i) => i.productId);
    const { data: dbProducts, error: prodErr } = await adminClient
      .from("products")
      .select(`
        id,
        name,
        name_en,
        brand_id,
        category,
        category_code,
        letusto_sku,
        manufacture_sku,
        status,
        selection_status,
        trading_status,
        retailer_visibility,
        trading_pricing_active,
        trading_wholesale_price,
        trading_promo_wholesale_price,
        trading_promo_start_date,
        trading_promo_end_date,
        estimated_retail_price,
        price_usd_fob,
        price_krw_retail,
        price_additional_info,
        origin,
        carton_pack_qty,
        package_width,
        package_depth,
        package_height,
        package_weight,
        upc,
        ean,
        brands (
          id,
          name
        ),
        product_curations (
          wholesale_price,
          suggest_retail_price
        ),
        product_images (
          id
        )
      `)
      .in("id", productIds);

    if (prodErr || !dbProducts) {
      return { success: false, error: "Failed to validate order products." };
    }

    const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Fetch stock balances for ordered items
    const { data: orderBalances } = await adminClient
      .from("inventory_balances")
      .select("product_id, qty_on_hand, qty_hold, qty_damaged")
      .in("product_id", productIds);

    const stockByProd = new Map<string, number>();
    (orderBalances ?? []).forEach((b: any) => {
      const onHand = Number(b.qty_on_hand || 0);
      const hold = Number(b.qty_hold || 0);
      const damaged = Number(b.qty_damaged || 0);
      const avail = Math.max(0, onHand - hold - damaged);
      stockByProd.set(b.product_id, (stockByProd.get(b.product_id) || 0) + avail);
    });

    // 5. Validate Quantities and Calculate Authoritative Server Snapshots
    let subtotalAmount = 0;
    let totalItemsCount = 0;
    const validatedLines: Array<{
      productId: string;
      sku: string;
      productName: string;
      brandName: string;
      unitWholesalePrice: number;
      unitMsrp: number | null;
      quantity: number;
      casePackQty: number;
      lineTotal: number;
    }> = [];

    for (const item of payload.items) {
      const prod = dbProductMap.get(item.productId);
      if (!prod) {
        return { success: false, error: `Product not found: ${item.productId}` };
      }

      const availableStock = stockByProd.get(item.productId) || 0;
      const visEval = evaluateHubVisibility(prod, availableStock);

      if (visEval.effectiveVisibility !== "PUBLISHED") {
        return {
          success: false,
          error: `Product "${prod.name}" is currently not available for ordering (${visEval.effectiveVisibilityLabel}: ${visEval.holdReasonLabels.join(", ") || "비노출"}).`,
        };
      }

      if (visEval.isSoldOut || !visEval.isOrderable) {
        return {
          success: false,
          error: `Product "${prod.name}" is out of stock or cannot be ordered (${visEval.orderabilityReason || "품절"}).`,
        };
      }

      if (item.quantity > availableStock) {
        return {
          success: false,
          error: `Requested quantity (${item.quantity} units) exceeds available stock (${availableStock} units) for product "${prod.name}".`,
        };
      }

      const info = (prod.price_additional_info as any) || {};
      const overrides = info.admin_overrides || {};
      const brand = (prod.brands as any) || {};
      const brandName = brand.name || "K SELECT Brand";
      const sku =
        resolveEffectiveSku(overrides.letusto_sku, prod.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, prod.manufacture_sku) ||
        "KS-SKU";

      const policy = resolveRetailerSalesPolicy(prod);

      if (!policy.isConfigured || policy.moq <= 0 || policy.baseWholesalePrice <= 0) {
        return {
          success: false,
          error: `Product "${prod.name}" has no valid retailer sales policy configured and cannot be ordered.`,
        };
      }

      // Enforce MOQ & Multiple
      if (!isValidMoqOrderQuantity(item.quantity, policy.moq)) {
        return {
          success: false,
          error: `Quantity for "${prod.name}" must be at least ${policy.moq} and a multiple of ${policy.moq}.`,
        };
      }

      // Enforce Retailer Account Purchase Limit
      if (policy.purchaseLimit?.enabled) {
        const allowance = await getRetailerAccountPurchaseAllowance(
          companyId,
          prod.id,
          policy.moq,
          availableStock,
          policy.purchaseLimit
        );

        if (item.quantity > allowance.remainingAllowance) {
          return {
            success: false,
            error: `Requested quantity (${item.quantity} units) exceeds your account purchase limit of ${allowance.limit} units for this ${allowance.period} (${allowance.remainingAllowance} units remaining) for product "${prod.name}".`,
          };
        }
      }

      const priceResult = calculateApplicablePrice(policy, item.quantity);
      if (!priceResult.isOrderable || priceResult.effectiveUnitPrice <= 0) {
        return {
          success: false,
          error: `Product "${prod.name}" cannot be ordered: ${priceResult.orderableReason || "Invalid price calculation"}`,
        };
      }

      let msrp: number | null = policy.srpPrice;
      if (!msrp || msrp <= 0) {
        msrp = Number((priceResult.effectiveUnitPrice * 2.0).toFixed(2));
      }

      const lineTotal = priceResult.subtotal;
      subtotalAmount += lineTotal;
      totalItemsCount += item.quantity;

      validatedLines.push({
        productId: prod.id,
        sku,
        productName: overrides.name?.trim() || prod.name,
        brandName,
        unitWholesalePrice: priceResult.effectiveUnitPrice,
        unitMsrp: msrp,
        quantity: item.quantity,
        casePackQty: policy.moq,
        lineTotal,
      });
    }

    subtotalAmount = Number(subtotalAmount.toFixed(2));

    // 5.1 Authoritative Server-Side Promotion Revalidation
    let promoDiscountAmount = 0;
    let appliedPromoId: string | null = null;
    let appliedCouponCode: string | null = payload.couponCode?.trim().toUpperCase() || null;
    let appliedPromotionSnapshot: any = null;

    const promoEvalResult = await evaluatePromotionsForCart(
      validatedLines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        brandName: line.brandName,
        wholesalePrice: line.unitWholesalePrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
      appliedCouponCode,
      companyId
    );

    if (appliedCouponCode && !promoEvalResult.isValid) {
      return {
        success: false,
        error:
          promoEvalResult.errorReason ||
          "This promotion is no longer available. Your order total has been updated.",
      };
    }

    if (promoEvalResult.totalDiscount > 0) {
      promoDiscountAmount = promoEvalResult.totalDiscount;
      const primaryPromo = promoEvalResult.appliedCoupon || promoEvalResult.appliedAutomatic;
      if (primaryPromo) {
        appliedPromotionSnapshot = {
          ...primaryPromo,
          applied_automatic: promoEvalResult.appliedAutomatic || null,
        };
        appliedPromoId = primaryPromo.promotion_id;
        appliedCouponCode = primaryPromo.coupon_code || null;
      }
    }

    const merchandisePayableSubtotal = Math.max(0, Number((subtotalAmount - promoDiscountAmount).toFixed(2)));

    // 5.2 Authoritative Server-Side Processing Fee Calculation & Credit Limit Guard
    const feeResult = calculateProcessingFee({
      paymentMethod: chosenPaymentMethod,
      chargeBase: merchandisePayableSubtotal,
      effectivePolicy: policy,
    });

    const finalTotalAmount = Number((merchandisePayableSubtotal + feeResult.feeAmount).toFixed(2));

    if (
      chosenPaymentMethod === "terms" &&
      policy.terms.creditLimit > 0 &&
      finalTotalAmount > policy.terms.creditLimit
    ) {
      return {
        success: false,
        error: `Your available credit is not enough for this order ($${finalTotalAmount.toFixed(2)} exceeds approved credit line $${policy.terms.creditLimit.toLocaleString()}). Please choose Card or ACH.`,
      };
    }

    const paymentSnapshot: PaymentMethodSnapshot = {
      payment_method: chosenPaymentMethod,
      payment_method_type: chosenPaymentMethod,
      fee_type: feeResult.feeType,
      fee_rate: feeResult.feeRate,
      fee_amount: feeResult.feeAmount,
      fee_source: feeResult.feeSource,
      charge_base: merchandisePayableSubtotal,
      policy_applied_at: new Date().toISOString(),
      terms_snapshot:
        chosenPaymentMethod === "terms"
          ? {
              approved_terms: policy.terms.approvedTerms,
              term_days: policy.terms.termDays,
              credit_limit: policy.terms.creditLimit,
            }
          : null,
      provider_key:
        chosenPaymentMethod === "card"
          ? "stripe"
          : chosenPaymentMethod === "ach"
          ? "bank_transfer"
          : "terms_invoice",
      provider_ready: false,
    };

    const orderTotalSnapshot: OrderTotalSnapshot = {
      merchandise_subtotal: subtotalAmount,
      discount_amount: promoDiscountAmount,
      processing_fee: feeResult.feeAmount,
      shipping_amount: 0.0,
      tax_amount: 0.0,
      total_amount: finalTotalAmount,
    };

    const snapshotJson = JSON.stringify({
      payment_snapshot: paymentSnapshot,
      order_total_snapshot: orderTotalSnapshot,
      promotion_snapshot: appliedPromotionSnapshot,
    });
    const paymentNotesContent = payload.notes
      ? `${payload.notes.trim()}\n\n[PAYMENT_SNAPSHOT]: ${snapshotJson}`
      : `[PAYMENT_SNAPSHOT]: ${snapshotJson}`;

    // 6. Generate Concurrency-Safe Order Number
    let orderNumber = `KSR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    try {
      const { data: generatedNo, error: rpcErr } = await adminClient.rpc(
        "generate_retailer_order_number"
      );
      if (!rpcErr && generatedNo) {
        orderNumber = generatedNo;
      }
    } catch (rpcEx) {
      console.warn("Could not generate order number via sequence, fallback used:", rpcEx);
    }

    // 7. Insert into retailer_orders
    const fullOrderPayload: any = {
      order_number: orderNumber,
      company_id: companyId,
      user_id: session.userId,
      store_id: storeId,
      order_status: "submitted",
      payment_status: "unpaid",
      payment_method: chosenPaymentMethod,
      payment_terms: paymentTerms,
      payment_due_date: paymentDueDate,
      subtotal_amount: subtotalAmount,
      discount_amount: promoDiscountAmount,
      processing_fee: feeResult.feeAmount,
      promotion_id: appliedPromoId,
      coupon_code: appliedCouponCode,
      promotion_snapshot: appliedPromotionSnapshot,
      payment_snapshot: paymentSnapshot,
      tax_amount: 0.0,
      shipping_amount: 0.0,
      total_amount: finalTotalAmount,
      total_items_count: totalItemsCount,
      total_skus_count: validatedLines.length,
      shipping_address: storeData?.address || null,
      shipping_city: storeData?.city || null,
      shipping_state: storeData?.state || null,
      shipping_zip: storeData?.zip || null,
      shipping_phone: storeData?.phone || null,
      recipient_name: storeData?.manager_name || session.email,
      notes: payload.notes || null,
      payment_notes: paymentNotesContent,
      is_test: isTestCompany,
    };

    let { data: orderRow, error: orderErr } = await adminClient
      .from("retailer_orders")
      .insert(fullOrderPayload)
      .select("id, order_number")
      .single();

    if (
      orderErr &&
      (orderErr.message?.includes("column") ||
        (orderErr as any).code === "PGRST204" ||
        (orderErr as any).code === "42703")
    ) {
      console.warn("Retrying order insertion with baseline schema columns:", orderErr.message);
      const baselinePayload = {
        order_number: orderNumber,
        company_id: companyId,
        user_id: session.userId,
        store_id: storeId,
        order_status: "submitted",
        payment_status: "unpaid",
        payment_method: chosenPaymentMethod,
        payment_terms: paymentTerms,
        payment_due_date: paymentDueDate,
        subtotal_amount: subtotalAmount,
        tax_amount: 0.0,
        shipping_amount: 0.0,
        total_amount: finalTotalAmount,
        total_items_count: totalItemsCount,
        total_skus_count: validatedLines.length,
        shipping_address: storeData?.address || null,
        shipping_city: storeData?.city || null,
        shipping_state: storeData?.state || null,
        shipping_zip: storeData?.zip || null,
        shipping_phone: storeData?.phone || null,
        recipient_name: storeData?.manager_name || session.email,
        notes: payload.notes || null,
        payment_notes: paymentNotesContent,
        is_test: isTestCompany,
      };
      const fallbackRes = await adminClient
        .from("retailer_orders")
        .insert(baselinePayload)
        .select("id, order_number")
        .single();
      orderRow = fallbackRes.data;
      orderErr = fallbackRes.error;
    }

    if (orderErr || !orderRow) {
      console.error("Order insertion error:", orderErr);
      return { success: false, error: orderErr?.message || "Failed to create order record." };
    }

    // 7.1 Record Promotion Usage
    if (appliedPromoId) {
      try {
        await adminClient.from("promotion_usages").insert({
          promotion_id: appliedPromoId,
          order_id: orderRow.id,
          company_id: companyId,
          discount_amount: promoDiscountAmount,
        });
      } catch (usageEx) {
        console.warn("Failed to record promotion usage:", usageEx);
      }
    }

    // 8. Insert into retailer_order_items
    const lineItemsToInsert = validatedLines.map((line) => ({
      order_id: orderRow.id,
      product_id: line.productId,
      sku: line.sku,
      product_name: line.productName,
      brand_name: line.brandName,
      unit_wholesale_price: line.unitWholesalePrice,
      unit_msrp: line.unitMsrp,
      quantity: line.quantity,
      case_pack_qty: line.casePackQty,
      line_total: line.lineTotal,
      discount_amount: 0.0,
      promotion_id: appliedPromoId,
    }));

    const { error: itemsErr } = await adminClient
      .from("retailer_order_items")
      .insert(lineItemsToInsert);

    if (itemsErr) {
      console.error("Order items insertion error:", itemsErr);
      return { success: false, error: "Failed to attach items to order." };
    }

    // 9. Revalidate paths
    revalidatePath("/retailer/orders");
    revalidatePath("/orders");
    revalidatePath("/retailer/checkout");

    return {
      success: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
    };
  } catch (err: any) {
    console.error("submitRetailerOrder exception:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while placing your order.",
    };
  }
}

/**
 * Fetch list of orders for the authenticated retailer
 */
export async function getRetailerOrders(): Promise<RetailerOrderSummary[]> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) return [];

    let orders: any[] | null = null;
    const { data: fullOrders, error: fullErr } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        order_status,
        payment_status,
        payment_method,
        payment_terms,
        payment_due_date,
        paid_at,
        payment_notes,
        total_amount,
        subtotal_amount,
        discount_amount,
        processing_fee,
        coupon_code,
        payment_snapshot,
        total_items_count,
        total_skus_count,
        created_at,
        store_id,
        is_test,
        stores (
          id,
          name
        )
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!fullErr && fullOrders) {
      orders = fullOrders;
    } else {
      const { data: baseOrders, error: baseErr } = await adminClient
        .from("retailer_orders")
        .select(`
          id,
          order_number,
          order_status,
          payment_status,
          payment_method,
          payment_terms,
          payment_due_date,
          paid_at,
          payment_notes,
          total_amount,
          subtotal_amount,
          total_items_count,
          total_skus_count,
          created_at,
          store_id,
          is_test,
          stores (
            id,
            name
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (baseErr || !baseOrders) {
        console.error("Error fetching retailer orders baseline:", baseErr);
        return [];
      }
      orders = baseOrders;
    }

    return orders.map((o) => {
      const parsed = parsePaymentNotesSnapshot(o.payment_notes);
      return {
        id: o.id,
        orderNumber: o.order_number,
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        paymentMethod: (o.payment_method as RetailerPaymentMethod) || null,
        paymentTerms: o.payment_terms || "PREPAID",
        paymentDueDate: o.payment_due_date,
        paidAt: o.paid_at,
        totalAmount: Number(o.total_amount),
        subtotalAmount: Number(o.subtotal_amount),
        discountAmount: Number(o.discount_amount || parsed?.order_total_snapshot?.discount_amount || 0),
        processingFee: Number(o.processing_fee || parsed?.payment_snapshot?.fee_amount || 0),
        couponCode: o.coupon_code || parsed?.promotion_snapshot?.coupon_code || null,
        paymentSnapshot: o.payment_snapshot || parsed?.payment_snapshot || null,
        totalItemsCount: o.total_items_count,
        totalSkusCount: o.total_skus_count,
        createdAt: o.created_at,
        storeId: o.store_id,
        storeName: (o.stores as any)?.name || "Main Store",
        isTest: Boolean(o.is_test),
      };
    });
  } catch (err) {
    console.error("getRetailerOrders exception:", err);
    return [];
  }
}

/**
 * Fetch detailed order, snapshotted items, and payment transaction history
 */
export async function getRetailerOrderDetail(
  orderIdentifier: string
): Promise<RetailerOrderDetail | null> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) return null;

    const isUuid = Boolean(
      orderIdentifier.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    );

    let order: any = null;
    let fullQuery = adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        order_status,
        payment_status,
        payment_method,
        payment_terms,
        payment_due_date,
        paid_at,
        payment_provider,
        payment_provider_ref,
        payment_notes,
        subtotal_amount,
        discount_amount,
        processing_fee,
        coupon_code,
        promotion_snapshot,
        payment_snapshot,
        tax_amount,
        shipping_amount,
        total_amount,
        total_items_count,
        total_skus_count,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_zip,
        shipping_phone,
        recipient_name,
        notes,
        is_test,
        created_at,
        store_id,
        stores (
          id,
          name
        ),
        retailer_order_items (
          id,
          product_id,
          sku,
          product_name,
          brand_name,
          unit_wholesale_price,
          unit_msrp,
          quantity,
          case_pack_qty,
          line_total,
          discount_amount,
          is_bogo_free
        )
      `)
      .eq("company_id", companyId);

    if (isUuid) {
      fullQuery = fullQuery.eq("id", orderIdentifier);
    } else {
      fullQuery = fullQuery.eq("order_number", orderIdentifier);
    }

    const { data: fullOrder, error: fullOrderErr } = await fullQuery.maybeSingle();

    if (!fullOrderErr && fullOrder) {
      order = fullOrder;
    } else {
      let baseQuery = adminClient
        .from("retailer_orders")
        .select(`
          id,
          order_number,
          order_status,
          payment_status,
          payment_method,
          payment_terms,
          payment_due_date,
          paid_at,
          payment_provider,
          payment_provider_ref,
          payment_notes,
          subtotal_amount,
          tax_amount,
          shipping_amount,
          total_amount,
          total_items_count,
          total_skus_count,
          shipping_address,
          shipping_city,
          shipping_state,
          shipping_zip,
          shipping_phone,
          recipient_name,
          notes,
          is_test,
          created_at,
          store_id,
          stores (
            id,
            name
          ),
          retailer_order_items (
            id,
            product_id,
            sku,
            product_name,
            brand_name,
            unit_wholesale_price,
            unit_msrp,
            quantity,
            case_pack_qty,
            line_total,
            discount_amount,
            is_bogo_free
          )
        `)
        .eq("company_id", companyId);

      if (isUuid) {
        baseQuery = baseQuery.eq("id", orderIdentifier);
      } else {
        baseQuery = baseQuery.eq("order_number", orderIdentifier);
      }

      const { data: baseOrder, error: baseErr } = await baseQuery.maybeSingle();
      if (baseErr || !baseOrder) {
        console.error("Error fetching retailer order detail baseline:", baseErr);
        return null;
      }
      order = baseOrder;
    }

    const parsedSnapshot = parsePaymentNotesSnapshot(order.payment_notes);

    // Fetch payments history
    const payments = await getOrderPayments(order.id);

    // Fetch fulfillments history
    const fulfillments = await getOrderFulfillments(order.id);

    // Calculate line-item cumulative shipped and delivered quantities
    const lineShippedMap = new Map<string, number>();
    const lineDeliveredMap = new Map<string, number>();

    fulfillments
      .filter((f) => f.status !== "cancelled")
      .forEach((f) => {
        f.items.forEach((it) => {
          const s = lineShippedMap.get(it.orderItemId) || 0;
          lineShippedMap.set(it.orderItemId, s + it.quantityShipped);

          const d = lineDeliveredMap.get(it.orderItemId) || 0;
          lineDeliveredMap.set(it.orderItemId, d + it.quantityDelivered);
        });
      });

    const rawItems = (order.retailer_order_items as any[]) || [];
    const items: RetailerOrderItemDetail[] = rawItems.map((item) => ({
      id: item.id,
      productId: item.product_id,
      sku: item.sku,
      productName: item.product_name,
      brandName: item.brand_name,
      unitWholesalePrice: Number(item.unit_wholesale_price),
      unitMsrp: item.unit_msrp ? Number(item.unit_msrp) : null,
      quantity: item.quantity,
      quantityShipped: lineShippedMap.get(item.id) || 0,
      quantityDelivered: lineDeliveredMap.get(item.id) || 0,
      casePackQty: item.case_pack_qty,
      line_total: Number(item.line_total),
      lineTotal: Number(item.line_total),
      discountAmount: Number(item.discount_amount || 0),
      isBogoFree: Boolean(item.is_bogo_free),
    }));

    return {
      id: order.id,
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentMethod: (order.payment_method as RetailerPaymentMethod) || null,
      paymentTerms: order.payment_terms || "PREPAID",
      paymentDueDate: order.payment_due_date,
      paidAt: order.paid_at,
      paymentProviderRef: order.payment_provider_ref,
      paymentNotes: order.payment_notes,
      totalAmount: Number(order.total_amount),
      subtotalAmount: Number(order.subtotal_amount),
      discountAmount: Number(
        order.discount_amount || parsedSnapshot?.order_total_snapshot?.discount_amount || 0
      ),
      processingFee: Number(
        order.processing_fee || parsedSnapshot?.payment_snapshot?.fee_amount || 0
      ),
      couponCode: order.coupon_code || parsedSnapshot?.promotion_snapshot?.coupon_code || null,
      promotionSnapshot: order.promotion_snapshot || parsedSnapshot?.promotion_snapshot || null,
      paymentSnapshot: order.payment_snapshot || parsedSnapshot?.payment_snapshot || null,
      taxAmount: Number(order.tax_amount || 0),
      shippingAmount: Number(order.shipping_amount || 0),
      totalItemsCount: order.total_items_count,
      totalSkusCount: order.total_skus_count,
      shippingAddress: order.shipping_address,
      shippingCity: order.shipping_city,
      shippingState: order.shipping_state,
      shippingZip: order.shipping_zip,
      shippingPhone: order.shipping_phone,
      recipientName: order.recipient_name,
      notes: order.notes,
      isTest: Boolean(order.is_test),
      createdAt: order.created_at,
      storeId: order.store_id,
      storeName: (order.stores as any)?.name || "Main Store",
      items,
      payments,
      fulfillments,
    };
  } catch (err) {
    console.error("getRetailerOrderDetail exception:", err);
    return null;
  }
}
