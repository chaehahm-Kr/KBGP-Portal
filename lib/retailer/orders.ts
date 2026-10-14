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
import { resolveCarrierTrackingUrl } from "@/lib/orders/carrier-resolver";
import { computeAuthoritativeOrderStatus } from "@/lib/orders/order-status-utils";
import type { OrderInvoiceSummary } from "@/lib/orders/order-invoice-utils";
import {
  computeOrderInvoiceSummary,
  resolveAuthoritativeOrderPaymentStatus,
} from "@/lib/orders/order-invoice-utils";

function parsePaymentNotesSnapshot(notes?: string | null): {
  payment_snapshot?: any;
  order_total_snapshot?: any;
  promotion_snapshot?: any;
  shipping_snapshot?: any;
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
  totalOrderedUnits: number;
  totalShippedUnits: number;
  totalCancelledUnits: number;
  totalRemainingUnits: number;
  boxCount: number;
  packages?: Array<{
    id: string;
    boxNumber: number;
    boxTotal: number;
    carrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
  }>;
  fulfillments?: Array<{
    id: string;
    fulfillmentNumber: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: string;
    boxCount?: number;
    boxes?: import("./fulfillment-types").RetailerFulfillmentBox[];
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    invoiceStatus: string;
    paymentStatus: string;
    totalAmount?: number;
    amountPaid?: number;
    balanceDue: number;
    dueDate: string;
  }>;
  invoiceSummary?: OrderInvoiceSummary;
  cancellationRequested?: boolean;
  refundAmount?: number;
  refundStatus?: string;
  createdAt: string;
  storeId: string | null;
  storeName: string;
  destinationLabel: string;
  destinationType: string;
  isTest: boolean;
}

export interface GetRetailerOrdersFilter {
  search?: string;
  sku?: string;
  startDate?: string;
  endDate?: string;
  orderStatus?: string;
  paymentStatus?: string;
  orderStatuses?: string[];
  paymentMethods?: string[];
  invoiceStatuses?: string[];
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
  quantityCancelled?: number;
  quantityRemaining?: number;
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
  savedAddressId?: string;
  destinationType?: "store" | "saved_address" | "custom_address";
  customShippingAddress?: {
    label?: string;
    recipientName: string;
    attentionName?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    phone?: string;
    deliveryNotes?: string;
    saveToAddressBook?: boolean;
  };
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

    // 3. Resolve Delivery Destination (Store, Saved Shipping Address, or One-Time Custom Address)
    const destinationType = payload.destinationType || (payload.savedAddressId ? "saved_address" : payload.customShippingAddress ? "custom_address" : "store");

    let resolvedRecipient = session.email;
    let resolvedAttention: string | null = null;
    let resolvedAddressLine1 = "";
    let resolvedAddressLine2: string | null = null;
    let resolvedCity = "";
    let resolvedState = "";
    let resolvedZip = "";
    let resolvedCountry = "US";
    let resolvedPhone: string | null = null;
    let destinationLabel = "Store Destination";
    let resolvedStoreId: string | null = null;
    let resolvedSavedAddressId: string | null = null;

    if (destinationType === "saved_address" && payload.savedAddressId) {
      const { data: savedAddr } = await adminClient
        .from("retailer_shipping_addresses")
        .select("*")
        .eq("id", payload.savedAddressId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!savedAddr) {
        return { success: false, error: "Selected shipping address is invalid or not accessible." };
      }

      resolvedRecipient = savedAddr.recipient_name;
      resolvedAttention = savedAddr.attention_name || null;
      resolvedAddressLine1 = savedAddr.address_line1;
      resolvedAddressLine2 = savedAddr.address_line2 || null;
      resolvedCity = savedAddr.city;
      resolvedState = savedAddr.state;
      resolvedZip = savedAddr.zip;
      resolvedCountry = savedAddr.country || "US";
      resolvedPhone = savedAddr.phone || null;
      destinationLabel = savedAddr.label;
      resolvedSavedAddressId = savedAddr.id;
    } else if (destinationType === "custom_address" && payload.customShippingAddress) {
      const c = payload.customShippingAddress;
      if (!c.recipientName?.trim() || !c.addressLine1?.trim() || !c.city?.trim() || !c.state?.trim() || !c.zip?.trim()) {
        return { success: false, error: "Recipient name, address line 1, city, state, and zip are required for custom shipping address." };
      }

      resolvedRecipient = c.recipientName.trim();
      resolvedAttention = c.attentionName?.trim() || null;
      resolvedAddressLine1 = c.addressLine1.trim();
      resolvedAddressLine2 = c.addressLine2?.trim() || null;
      resolvedCity = c.city.trim();
      resolvedState = c.state.trim().toUpperCase();
      resolvedZip = c.zip.trim();
      resolvedCountry = c.country?.trim() || "US";
      resolvedPhone = c.phone?.trim() || null;
      destinationLabel = c.label?.trim() || "Custom Delivery Address";

      // If user checked "Save this address for future orders", persist it safely
      if (c.saveToAddressBook) {
        try {
          const { data: savedRow } = await adminClient
            .from("retailer_shipping_addresses")
            .insert({
              company_id: companyId,
              label: destinationLabel,
              recipient_name: resolvedRecipient,
              attention_name: resolvedAttention,
              address_line1: resolvedAddressLine1,
              address_line2: resolvedAddressLine2,
              city: resolvedCity,
              state: resolvedState,
              zip: resolvedZip,
              country: resolvedCountry,
              phone: resolvedPhone,
              delivery_notes: c.deliveryNotes?.trim() || null,
              is_default: false,
              is_active: true,
            })
            .select("id")
            .maybeSingle();

          if (savedRow?.id) {
            resolvedSavedAddressId = savedRow.id;
          }
        } catch (saveErr) {
          console.warn("Could not save one-time address to address book:", saveErr);
        }
      }
    } else {
      // Default: Store Destination
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

      resolvedStoreId = storeId;
      destinationLabel = storeData?.name || "Store Destination";
      resolvedRecipient = storeData?.manager_name || session.email;
      resolvedAddressLine1 = storeData?.address || "";
      resolvedCity = storeData?.city || "";
      resolvedState = storeData?.state || "";
      resolvedZip = storeData?.zip || "";
      resolvedPhone = storeData?.phone || null;
    }

    const shippingSnapshot = {
      destination_type: destinationType,
      label: destinationLabel,
      store_id: resolvedStoreId,
      saved_address_id: resolvedSavedAddressId,
      recipient_name: resolvedRecipient,
      attention_name: resolvedAttention,
      address_line1: resolvedAddressLine1,
      address_line2: resolvedAddressLine2,
      city: resolvedCity,
      state: resolvedState,
      zip: resolvedZip,
      country: resolvedCountry,
      phone: resolvedPhone,
      delivery_notes: payload.customShippingAddress?.deliveryNotes || payload.notes || null,
    };

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
      if (!isValidMoqOrderQuantity(item.quantity, policy.moq, policy.orderMultiple)) {
        const mult = policy.orderMultiple || policy.moq;
        return {
          success: false,
          error: `Quantity for "${prod.name}" must be at least ${policy.moq} and a multiple of ${mult}.`,
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

    if (chosenPaymentMethod === "terms") {
      const { getRetailerCreditExposure } = await import("@/lib/finance/credit-exposure");
      const exposure = await getRetailerCreditExposure(companyId, adminClient);

      if (policy.terms.creditLimit > 0 && finalTotalAmount > exposure.availableCredit) {
        return {
          success: false,
          error: `Your available credit is not enough for this order ($${finalTotalAmount.toFixed(2)} exceeds available credit $${exposure.availableCredit.toFixed(2)}). Total credit exposure is $${exposure.totalExposure.toFixed(2)} against approved credit line $${exposure.creditLimit.toFixed(2)}. Please choose Card or ACH.`,
        };
      }
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
      shipping_snapshot: shippingSnapshot,
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
      store_id: resolvedStoreId,
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
      shipping_address: resolvedAddressLine2 ? `${resolvedAddressLine1}, ${resolvedAddressLine2}` : resolvedAddressLine1,
      shipping_address_line2: resolvedAddressLine2,
      shipping_city: resolvedCity,
      shipping_state: resolvedState,
      shipping_zip: resolvedZip,
      shipping_phone: resolvedPhone,
      recipient_name: resolvedRecipient,
      shipping_destination_type: destinationType,
      shipping_snapshot: shippingSnapshot,
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
        store_id: resolvedStoreId,
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
        shipping_address: resolvedAddressLine2 ? `${resolvedAddressLine1}, ${resolvedAddressLine2}` : resolvedAddressLine1,
        shipping_city: resolvedCity,
        shipping_state: resolvedState,
        shipping_zip: resolvedZip,
        shipping_phone: resolvedPhone,
        recipient_name: resolvedRecipient,
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
      if (orderErr?.message?.includes("INSUFFICIENT_CREDIT")) {
        const cleanMsg = orderErr.message.replace(/^.*?INSUFFICIENT_CREDIT:\s*/i, "").split("\n")[0];
        return { success: false, error: cleanMsg };
      }
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

    let { error: itemsErr } = await adminClient
      .from("retailer_order_items")
      .insert(lineItemsToInsert);

    if (
      itemsErr &&
      (itemsErr.code === "PGRST204" ||
        itemsErr.message?.includes("column") ||
        itemsErr.message?.includes("does not exist"))
    ) {
      console.warn("Retrying retailer_order_items insertion with baseline columns (schema cache fallback)...");
      const baselineItems = validatedLines.map((line) => ({
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
      }));
      const retryResult = await adminClient
        .from("retailer_order_items")
        .insert(baselineItems);
      itemsErr = retryResult.error;
    }

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
 * Fetch list of orders for the authenticated retailer with optional server-side filters
 */
export async function getRetailerOrders(
  filters?: GetRetailerOrdersFilter
): Promise<RetailerOrderSummary[]> {
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

    // 1. SKU Search: If a dedicated SKU or general search is provided, check matching line items
    const skuQuery = (filters?.sku || "").trim();
    const generalSearch = (filters?.search || "").trim();
    let skuMatchedOrderIds: string[] | null = null;

    if (skuQuery) {
      const { data: itemRows } = await adminClient
        .from("retailer_order_items")
        .select("order_id")
        .ilike("sku", `%${skuQuery}%`);

      skuMatchedOrderIds = Array.from(new Set((itemRows || []).map((r) => r.order_id)));
      if (skuMatchedOrderIds.length === 0) {
        return [];
      }
    } else if (generalSearch) {
      const { data: itemRows } = await adminClient
        .from("retailer_order_items")
        .select("order_id")
        .ilike("sku", `%${generalSearch}%`);

      skuMatchedOrderIds = Array.from(new Set((itemRows || []).map((r) => r.order_id)));
    }

    // 2. Query retailer_orders strictly scoped to companyId (Tenant Isolation)
    let query = adminClient
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
        shipping_destination_type,
        shipping_snapshot,
        shipping_address,
        recipient_name,
        stores (
          id,
          name
        )
      `)
      .eq("company_id", companyId);

    // Filter by SKU or general search
    if (skuQuery) {
      if (skuMatchedOrderIds && skuMatchedOrderIds.length > 0) {
        query = query.in("id", skuMatchedOrderIds);
      }
    } else if (generalSearch) {
      if (skuMatchedOrderIds && skuMatchedOrderIds.length > 0) {
        query = query.or(`order_number.ilike.%${generalSearch}%,id.in.(${skuMatchedOrderIds.join(",")})`);
      } else {
        query = query.ilike("order_number", `%${generalSearch}%`);
      }
    }

    // Date range filter
    if (filters?.startDate) {
      query = query.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
    }
    if (filters?.endDate) {
      query = query.lte("created_at", `${filters.endDate}T23:59:59.999Z`);
    }

    // Status filter criteria
    const targetOrderStatuses: string[] = [];
    if (Array.isArray(filters?.orderStatuses) && filters.orderStatuses.length > 0) {
      targetOrderStatuses.push(...filters.orderStatuses.map((s) => s.toLowerCase().trim()).filter(Boolean));
    } else if (filters?.orderStatus && filters.orderStatus !== "all") {
      targetOrderStatuses.push(
        ...filters.orderStatus
          .split(",")
          .map((s) => s.toLowerCase().trim())
          .filter((s) => Boolean(s) && s !== "all")
      );
    }

    const targetPaymentMethods: string[] = [];
    if (Array.isArray(filters?.paymentMethods) && filters.paymentMethods.length > 0) {
      targetPaymentMethods.push(...filters.paymentMethods.map((m) => m.toLowerCase().trim()).filter(Boolean));
    }

    const targetInvoiceStatuses: string[] = [];
    if (Array.isArray(filters?.invoiceStatuses) && filters.invoiceStatuses.length > 0) {
      targetInvoiceStatuses.push(...filters.invoiceStatuses.map((s) => s.toLowerCase().trim()).filter(Boolean));
    } else if (filters?.paymentStatus && filters.paymentStatus !== "all") {
      targetInvoiceStatuses.push(
        ...filters.paymentStatus
          .split(",")
          .map((s) => s.toLowerCase().trim())
          .filter((s) => Boolean(s) && s !== "all")
      );
    }

    query = query.order("created_at", { ascending: false });

    let orders: any[] | null = null;
    const { data: initialOrders, error: fullErr } = await query;
    orders = initialOrders;

    if (fullErr) {
      console.warn("Retrying retailer_orders with baseline columns:", fullErr.message);
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
        .eq("company_id", companyId);

      if (skuQuery && skuMatchedOrderIds) {
        baseQuery = baseQuery.in("id", skuMatchedOrderIds);
      } else if (generalSearch) {
        if (skuMatchedOrderIds && skuMatchedOrderIds.length > 0) {
          baseQuery = baseQuery.or(`order_number.ilike.%${generalSearch}%,id.in.(${skuMatchedOrderIds.join(",")})`);
        } else {
          baseQuery = baseQuery.ilike("order_number", `%${generalSearch}%`);
        }
      }
      if (filters?.startDate) {
        baseQuery = baseQuery.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
      }
      if (filters?.endDate) {
        baseQuery = baseQuery.lte("created_at", `${filters.endDate}T23:59:59.999Z`);
      }
      baseQuery = baseQuery.order("created_at", { ascending: false });

      const fallbackRes = await baseQuery;
      orders = fallbackRes.data;
    }

    if (!orders) return [];

    const orderIds = orders.map((o) => o.id);
    const itemsMap = new Map<string, any[]>();
    const packagesMap = new Map<string, any[]>();
    const invoicesMap = new Map<string, any[]>();
    const fulfillmentsMap = new Map<string, any[]>();
    const paymentsMap = new Map<string, any[]>();
    const boxesByFulfillmentId = new Map<string, any[]>();
    const boxesByOrderId = new Map<string, any[]>();

    if (orderIds.length > 0) {
      const [itemsRes, pkgsRes, invsRes, fulsRes, paymentsRes, boxesRes] = await Promise.all([
        adminClient.from("retailer_order_items").select("order_id, quantity, quantity_shipped, quantity_cancelled").in("order_id", orderIds),
        adminClient.from("retailer_order_packages").select("*").in("order_id", orderIds).order("box_number", { ascending: true }),
        adminClient.from("retailer_invoices").select("id, order_id, invoice_number, invoice_status, payment_status, total_amount, amount_paid, balance_due, due_date").in("order_id", orderIds),
        adminClient.from("retailer_order_fulfillments").select(`
          id, order_id, fulfillment_number, carrier, tracking_number, tracking_url, status, box_count,
          retailer_order_fulfillment_items ( order_item_id, quantity_shipped, quantity_delivered )
        `).in("order_id", orderIds).order("created_at", { ascending: true }),
        adminClient.from("retailer_order_payments").select("id, order_id, payment_method, status, amount, fee_amount, created_at").in("order_id", orderIds),
        (async () => {
          try {
            return await adminClient.from("retailer_order_fulfillment_boxes").select("*").in("order_id", orderIds).neq("status", "void").order("box_number", { ascending: true });
          } catch {
            return { data: null };
          }
        })(),
      ]);

      if (boxesRes?.data && boxesRes.data.length > 0) {
        boxesRes.data.forEach((b: any) => {
          const item = {
            id: b.id,
            fulfillmentId: b.fulfillment_id,
            orderId: b.order_id,
            boxNumber: b.box_number,
            boxTotal: b.box_total || 1,
            carrier: b.carrier,
            trackingNumber: b.tracking_number,
            trackingUrl: resolveCarrierTrackingUrl(b.carrier, b.tracking_number, b.tracking_url),
            weightLbs: b.weight_lbs,
            dimensionsInch: b.dimensions_inch,
            notes: b.notes,
            status: b.status,
            createdAt: b.created_at,
          };
          const fArr = boxesByFulfillmentId.get(b.fulfillment_id) || [];
          fArr.push(item);
          boxesByFulfillmentId.set(b.fulfillment_id, fArr);

          const oArr = boxesByOrderId.get(b.order_id) || [];
          oArr.push(item);
          boxesByOrderId.set(b.order_id, oArr);
        });
      }

      if (itemsRes.data) {
        itemsRes.data.forEach((it: any) => {
          const arr = itemsMap.get(it.order_id) || [];
          arr.push(it);
          itemsMap.set(it.order_id, arr);
        });
      }
      if (pkgsRes.data) {
        pkgsRes.data.forEach((p: any) => {
          const arr = packagesMap.get(p.order_id) || [];
          arr.push({
            id: p.id,
            boxNumber: p.box_number,
            boxTotal: p.box_total,
            carrier: p.carrier,
            trackingNumber: p.tracking_number,
            trackingUrl: resolveCarrierTrackingUrl(p.carrier, p.tracking_number, p.tracking_url),
          });
          packagesMap.set(p.order_id, arr);
        });
      }
      if (invsRes.data) {
        invsRes.data.forEach((inv: any) => {
          const arr = invoicesMap.get(inv.order_id) || [];
          arr.push({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            invoiceStatus: inv.invoice_status,
            paymentStatus: inv.payment_status,
            totalAmount: Number(inv.total_amount || 0),
            amountPaid: Number(inv.amount_paid || 0),
            balanceDue: Number(inv.balance_due || 0),
            dueDate: inv.due_date,
          });
          invoicesMap.set(inv.order_id, arr);
        });
      }
      if (fulsRes.data) {
        fulsRes.data.forEach((f: any) => {
          const fBoxes = boxesByFulfillmentId.get(f.id) || [];
          // Safe legacy fallback: if no dedicated boxes recorded but fulfillment has tracking, synthesize 1 box
          const finalBoxes = fBoxes.length > 0
            ? fBoxes
            : f.tracking_number
            ? [
                {
                  id: `legacy-${f.id}`,
                  fulfillmentId: f.id,
                  orderId: f.order_id,
                  boxNumber: 1,
                  boxTotal: 1,
                  carrier: f.carrier || "Standard Freight",
                  trackingNumber: f.tracking_number,
                  trackingUrl: resolveCarrierTrackingUrl(f.carrier, f.tracking_number, f.tracking_url),
                  status: "active",
                  createdAt: f.created_at,
                },
              ]
            : [];

          const arr = fulfillmentsMap.get(f.order_id) || [];
          arr.push({
            id: f.id,
            fulfillmentNumber: f.fulfillment_number,
            carrier: f.carrier,
            trackingNumber: f.tracking_number,
            trackingUrl: resolveCarrierTrackingUrl(f.carrier, f.tracking_number, f.tracking_url),
            status: f.status,
            boxCount: finalBoxes.length > 0 ? finalBoxes.length : Number(f.box_count || 0),
            boxes: finalBoxes,
            items: f.retailer_order_fulfillment_items || [],
          });
          fulfillmentsMap.set(f.order_id, arr);
        });
      }
      if (paymentsRes.data) {
        paymentsRes.data.forEach((p: any) => {
          const arr = paymentsMap.get(p.order_id) || [];
          arr.push(p);
          paymentsMap.set(p.order_id, arr);
        });
      }
    }

    let mappedOrders = orders.map((o: any) => {
      const parsed = parsePaymentNotesSnapshot(o.payment_notes);
      const snap = o.shipping_snapshot || parsed?.shipping_snapshot;

      let destinationLabel = (o.stores as any)?.name || "Main Store";
      let destinationType = o.shipping_destination_type || "store";

      if (snap) {
        if (snap.label) {
          destinationLabel = snap.label;
        } else if (snap.store_name) {
          destinationLabel = snap.store_name;
        } else if (snap.recipient_name) {
          destinationLabel = snap.recipient_name;
        }
        if (snap.destination_type) {
          destinationType = snap.destination_type;
        }
      } else if (o.recipient_name && o.shipping_destination_type === "custom_address") {
        destinationLabel = o.recipient_name;
      }

      const oItems = itemsMap.get(o.id) || [];
      const fuls = fulfillmentsMap.get(o.id) || [];

      // Authoritative shipped calculation: confirmed dispatches only (status in 'shipped', 'delivered')
      const confirmedFulfillments = fuls.filter((f) => f.status === "shipped" || f.status === "delivered");
      const confirmedShippedFromFulfillments = confirmedFulfillments.reduce((sum, f) => {
        return sum + (f.items || []).reduce((iSum: number, it: any) => iSum + Number(it.quantity_shipped || 0), 0);
      }, 0);

      const totalOrderedUnits = oItems.length > 0 
        ? oItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0)
        : Number(o.total_ordered_units || o.total_items_count || 0);

      const totalCancelledUnits = oItems.length > 0
        ? oItems.reduce((acc, it) => acc + Number(it.quantity_cancelled || 0), 0)
        : Number(o.total_cancelled_units || (o.order_status === "cancelled" ? totalOrderedUnits : 0));

      const oItemsShipped = oItems.reduce((acc, it) => acc + Number(it.quantity_shipped || 0), 0);
      const isLegacyShipped = ["shipped", "delivered"].includes((o.order_status || "").toLowerCase());

      const totalShippedUnits = fuls.length > 0
        ? confirmedShippedFromFulfillments
        : Math.max(
            oItemsShipped,
            Number(o.total_shipped_units || 0),
            isLegacyShipped ? Math.max(0, totalOrderedUnits - totalCancelledUnits) : 0
          );

      const totalRemainingUnits = Math.max(0, totalOrderedUnits - totalShippedUnits - totalCancelledUnits);
      const oBoxes = boxesByOrderId.get(o.id) || [];
      const pkgs = packagesMap.get(o.id) || [];
      const effectivePackages = oBoxes.length > 0
        ? oBoxes.map((b: any) => ({
            id: b.id,
            boxNumber: b.boxNumber,
            boxTotal: b.boxTotal,
            carrier: b.carrier,
            trackingNumber: b.trackingNumber,
            trackingUrl: b.trackingUrl,
          }))
        : pkgs;
      const totalBoxCountFromFulfillments = fuls.reduce((sum, f) => sum + (f.boxes ? f.boxes.length : (f.trackingNumber ? 1 : 0)), 0);
      const boxCount = totalBoxCountFromFulfillments > 0 ? totalBoxCountFromFulfillments : effectivePackages.length;
      const invs = invoicesMap.get(o.id) || [];
      const invoiceSummary = computeOrderInvoiceSummary(invs);
      const oPayments = paymentsMap.get(o.id) || [];
      const authoritativePaymentStatus = resolveAuthoritativeOrderPaymentStatus(
        o,
        oPayments,
        invoiceSummary
      );

      const authoritativeStatus = computeAuthoritativeOrderStatus(
        o.order_status,
        totalOrderedUnits,
        totalShippedUnits,
        totalCancelledUnits
      );

      return {
        id: o.id,
        orderNumber: o.order_number,
        orderStatus: authoritativeStatus,
        paymentStatus: authoritativePaymentStatus,
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
        totalItemsCount: Number(o.total_items_count || 0),
        totalSkusCount: Number(o.total_skus_count || 0),
        totalOrderedUnits,
        totalShippedUnits,
        totalCancelledUnits,
        totalRemainingUnits,
        boxCount,
        packages: effectivePackages,
        fulfillments: fuls,
        invoices: invs,
        invoiceSummary,
        cancellationRequested: Boolean(o.cancellation_requested),
        refundAmount: Number(o.refund_amount || 0),
        refundStatus: o.refund_status || "none",
        createdAt: o.created_at,
        storeId: o.store_id,
        storeName: (o.stores as any)?.name || "Main Store",
        destinationLabel,
        destinationType,
        isTest: Boolean(o.is_test),
      };
    });

    // Multi-select Fulfillment filter (OR logic within group)
    if (targetOrderStatuses.length > 0) {
      mappedOrders = mappedOrders.filter((o) =>
        targetOrderStatuses.includes(o.orderStatus.toLowerCase())
      );
    }

    // Multi-select Payment Method filter (OR logic within group)
    if (targetPaymentMethods.length > 0) {
      mappedOrders = mappedOrders.filter((o) => {
        const m = (o.paymentMethod || "").toLowerCase();
        return targetPaymentMethods.some((target) => {
          if (target === "card" || target === "credit_card") return m === "card" || m === "credit_card";
          if (target === "terms" || target === "net_terms") return m === "terms" || m === "net_terms";
          return m === target;
        });
      });
    }

    // Multi-select Invoice Status filter (OR logic within group)
    if (targetInvoiceStatuses.length > 0) {
      mappedOrders = mappedOrders.filter((o) => {
        const invStatus = (o.invoiceSummary?.status || "not_issued").toLowerCase();
        return targetInvoiceStatuses.includes(invStatus);
      });
    }

    return mappedOrders;
  } catch (err) {
    console.error("getRetailerOrders exception:", err);
    return [];
  }
}

/**
 * Server Action for dynamic live order filtering and search
 */
export async function getRetailerOrdersAction(
  filters?: GetRetailerOrdersFilter
): Promise<RetailerOrderSummary[]> {
  return getRetailerOrders(filters);
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
        total_ordered_units,
        total_shipped_units,
        total_cancelled_units,
        total_remaining_units,
        cancellation_requested,
        cancellation_notes,
        refund_amount,
        refund_status,
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
          quantity_shipped,
          quantity_cancelled,
          case_pack_qty,
          line_total,
          discount_amount,
          is_bogo_free,
          cancellation_reason,
          cancelled_at
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
          total_ordered_units,
          total_shipped_units,
          total_cancelled_units,
          total_remaining_units,
          cancellation_requested,
          cancellation_notes,
          refund_amount,
          refund_status,
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
            quantity_shipped,
            quantity_cancelled,
            case_pack_qty,
            line_total,
            discount_amount,
            is_bogo_free,
            cancellation_reason,
            cancelled_at
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
    const snap = (order as any).shipping_snapshot || (parsedSnapshot as any)?.shipping_snapshot;

    let destinationLabel = (order.stores as any)?.name || "Main Store";
    let destinationType = (order as any).shipping_destination_type || "store";

    if (snap) {
      if (snap.label) {
        destinationLabel = snap.label;
      } else if (snap.store_name) {
        destinationLabel = snap.store_name;
      } else if (snap.recipient_name) {
        destinationLabel = snap.recipient_name;
      }
      if (snap.destination_type) {
        destinationType = snap.destination_type;
      }
    }

    // Fetch payments, fulfillments, packages, and invoices
    const [payments, fulfillments, rawPackagesRes, rawInvoicesRes] = await Promise.all([
      getOrderPayments(order.id),
      getOrderFulfillments(order.id),
      adminClient.from("retailer_order_packages").select("*").eq("order_id", order.id).order("box_number", { ascending: true }),
      adminClient.from("retailer_invoices").select("id, invoice_number, invoice_status, payment_status, total_amount, amount_paid, balance_due, due_date").eq("order_id", order.id),
    ]);

    const packages = (rawPackagesRes.data || []).map((p: any) => ({
      id: p.id,
      boxNumber: p.box_number,
      boxTotal: p.box_total,
      carrier: p.carrier,
      trackingNumber: p.tracking_number,
      trackingUrl: resolveCarrierTrackingUrl(p.carrier, p.tracking_number, p.tracking_url),
    }));

    const invoices = (rawInvoicesRes.data || []).map((inv: any) => {
      const isVoid = ["void", "cancelled"].includes((inv.invoice_status || "").toLowerCase());
      const rawBal = Number(inv.balance_due || 0);
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceStatus: inv.invoice_status,
        paymentStatus: inv.payment_status,
        totalAmount: Number(inv.total_amount || 0),
        amountPaid: Number(inv.amount_paid || 0),
        balanceDue: isVoid ? 0.0 : rawBal,
        dueDate: inv.due_date,
      };
    });

    // Calculate line-item cumulative shipped and delivered quantities
    const lineShippedMap = new Map<string, number>();
    const lineDeliveredMap = new Map<string, number>();

    fulfillments
      .filter((f) => f.status === "shipped" || f.status === "delivered")
      .forEach((f) => {
        f.items.forEach((it) => {
          const s = lineShippedMap.get(it.orderItemId) || 0;
          lineShippedMap.set(it.orderItemId, s + it.quantityShipped);

          const d = lineDeliveredMap.get(it.orderItemId) || 0;
          lineDeliveredMap.set(it.orderItemId, d + it.quantityDelivered);
        });
      });

    const rawItems = (order.retailer_order_items as any[]) || [];
    const items: RetailerOrderItemDetail[] = rawItems.map((item) => {
      const qOrdered = Number(item.quantity || 0);
      const isLegacyShipped = ["shipped", "delivered"].includes((order.order_status || "").toLowerCase());
      const hasFulfillments = fulfillments.length > 0;
      const qShipped = hasFulfillments
        ? (lineShippedMap.get(item.id) || 0)
        : Number(item.quantity_shipped || (isLegacyShipped ? qOrdered : 0));
      const qCancelled = Number(item.quantity_cancelled || 0);
      const qRemaining = Math.max(0, qOrdered - qShipped - qCancelled);

      return {
        id: item.id,
        productId: item.product_id,
        sku: item.sku,
        productName: item.product_name,
        brandName: item.brand_name,
        unitWholesalePrice: Number(item.unit_wholesale_price),
        unitMsrp: item.unit_msrp ? Number(item.unit_msrp) : null,
        quantity: qOrdered,
        quantityShipped: qShipped,
        quantityCancelled: qCancelled,
        quantityRemaining: qRemaining,
        quantityDelivered: lineDeliveredMap.get(item.id) || 0,
        casePackQty: item.case_pack_qty,
        line_total: Number(item.line_total),
        lineTotal: Number(item.line_total),
        discountAmount: Number(item.discount_amount || 0),
        isBogoFree: Boolean(item.is_bogo_free),
      };
    });

    const totalOrderedUnits = items.length > 0
      ? items.reduce((acc, it) => acc + it.quantity, 0)
      : Number(order.total_ordered_units || order.total_items_count || 0);

    const totalShippedUnits = items.length > 0
      ? items.reduce((acc, it) => acc + (it.quantityShipped || 0), 0)
      : Number(order.total_shipped_units || 0);

    const totalCancelledUnits = items.length > 0 && items.some((it) => (it.quantityCancelled || 0) > 0)
      ? items.reduce((acc, it) => acc + (it.quantityCancelled || 0), 0)
      : Number(order.total_cancelled_units || (order.order_status === "cancelled" ? totalOrderedUnits : 0));

    const totalRemainingUnits = items.length > 0
      ? Math.max(0, totalOrderedUnits - totalShippedUnits - totalCancelledUnits)
      : Number(order.total_remaining_units ?? Math.max(0, totalOrderedUnits - totalShippedUnits - totalCancelledUnits));

    // Box count comes strictly from package records; do NOT fabricate box counts or assume 1 Dispatch = 1 Box
    const boxCount = packages.length;

    const authoritativeStatus = computeAuthoritativeOrderStatus(
      order.order_status,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits
    );

    return {
      id: order.id,
      orderNumber: order.order_number,
      orderStatus: authoritativeStatus,
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
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits,
      totalRemainingUnits,
      boxCount,
      packages,
      invoices,
      cancellationRequested: Boolean(order.cancellation_requested),
      refundAmount: Number(order.refund_amount || 0),
      refundStatus: order.refund_status || "none",
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
      destinationLabel,
      destinationType,
      items,
      payments,
      fulfillments,
    };
  } catch (err) {
    console.error("getRetailerOrderDetail exception:", err);
    return null;
  }
}
