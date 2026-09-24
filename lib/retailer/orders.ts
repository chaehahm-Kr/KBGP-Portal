"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";

export interface RetailerOrderSummary {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentTerms: string;
  totalAmount: number;
  subtotalAmount: number;
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
  casePackQty: number;
  lineTotal: number;
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
  items: RetailerOrderItemDetail[];
}

export interface SubmitOrderPayload {
  storeId?: string;
  notes?: string;
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
      .select("company_id, companies(id, name)")
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

    // Fetch Profile Payment Terms
    const { data: retailerProfile } = await adminClient
      .from("retailer_profiles")
      .select("payment_terms, terms_approved_by_admin")
      .eq("company_id", companyId)
      .maybeSingle();

    const paymentTerms = retailerProfile?.payment_terms || "PREPAID_CARD";

    // 2. Validate Store & Address
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

    // 3. Fetch Real Products from Product Master & Validate
    const productIds = payload.items.map((i) => i.productId);
    const { data: dbProducts, error: prodErr } = await adminClient
      .from("products")
      .select(`
        id,
        name,
        name_en,
        brand_id,
        letusto_sku,
        manufacture_sku,
        status,
        estimated_retail_price,
        price_usd_fob,
        price_additional_info,
        carton_pack_qty,
        brands (
          id,
          name
        ),
        product_curations (
          wholesale_price,
          suggest_retail_price
        )
      `)
      .in("id", productIds);

    if (prodErr || !dbProducts) {
      return { success: false, error: "Failed to validate order products." };
    }

    const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 4. Validate Quantities and Calculate Snapshots
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

      const info = (prod.price_additional_info as any) || {};
      if (info.deleted_at || prod.status === "discontinued") {
        return { success: false, error: `Product "${prod.name}" is no longer available.` };
      }

      const overrides = info.admin_overrides || {};
      const curation = Array.isArray(prod.product_curations)
        ? prod.product_curations[0]
        : prod.product_curations;

      const brand = (prod.brands as any) || {};
      const brandName = brand.name || "K SELECT Brand";
      const sku =
        resolveEffectiveSku(overrides.letusto_sku, prod.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, prod.manufacture_sku) ||
        "KS-SKU";

      const pack = Math.max(1, overrides.carton_pack_qty || prod.carton_pack_qty || 1);

      // Enforce MOQ & Multiple
      if (item.quantity < pack || item.quantity % pack !== 0) {
        return {
          success: false,
          error: `Quantity for "${prod.name}" must be at least ${pack} and a multiple of ${pack}.`,
        };
      }

      // Snapshot Wholesale & MSRP
      let wholesalePrice = 0;
      if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
        wholesalePrice = Number(curation.wholesale_price);
      } else if (prod.price_usd_fob && Number(prod.price_usd_fob) > 0) {
        wholesalePrice = Number(prod.price_usd_fob);
      } else if (prod.estimated_retail_price && Number(prod.estimated_retail_price) > 0) {
        wholesalePrice = Number((Number(prod.estimated_retail_price) * 0.5).toFixed(2));
      }

      let msrp: number | null = null;
      if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
        msrp = Number(curation.suggest_retail_price);
      } else if (prod.estimated_retail_price && Number(prod.estimated_retail_price) > 0) {
        msrp = Number(prod.estimated_retail_price);
      } else if (wholesalePrice > 0) {
        msrp = Number((wholesalePrice * 2.0).toFixed(2));
      }

      const lineTotal = Number((item.quantity * wholesalePrice).toFixed(2));
      subtotalAmount += lineTotal;
      totalItemsCount += item.quantity;

      validatedLines.push({
        productId: prod.id,
        sku,
        productName: overrides.name?.trim() || prod.name,
        brandName,
        unitWholesalePrice: wholesalePrice,
        unitMsrp: msrp,
        quantity: item.quantity,
        casePackQty: pack,
        lineTotal,
      });
    }

    subtotalAmount = Number(subtotalAmount.toFixed(2));
    const totalAmount = subtotalAmount; // Tax and shipping calculated at dispatch

    // 5. Generate Human-Readable Order Number
    let orderNumber = `KSR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    try {
      const { data: generatedNo } = await adminClient.rpc("generate_retailer_order_number");
      if (generatedNo) {
        orderNumber = generatedNo;
      }
    } catch {
      // Fallback unique order number
    }

    // 6. Insert into retailer_orders
    const { data: orderRow, error: orderErr } = await adminClient
      .from("retailer_orders")
      .insert({
        order_number: orderNumber,
        company_id: companyId,
        user_id: session.userId,
        store_id: storeId,
        order_status: "submitted",
        payment_status: "unpaid",
        payment_terms: paymentTerms,
        subtotal_amount: subtotalAmount,
        tax_amount: 0.00,
        shipping_amount: 0.00,
        total_amount: totalAmount,
        total_items_count: totalItemsCount,
        total_skus_count: validatedLines.length,
        shipping_address: storeData?.address || null,
        shipping_city: storeData?.city || null,
        shipping_state: storeData?.state || null,
        shipping_zip: storeData?.zip || null,
        shipping_phone: storeData?.phone || null,
        recipient_name: storeData?.manager_name || session.email,
        notes: payload.notes || null,
        is_test: isTestCompany,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !orderRow) {
      console.error("Order insertion error:", orderErr);
      return { success: false, error: orderErr?.message || "Failed to create order record." };
    }

    // 7. Insert into retailer_order_items
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
    }));

    const { error: itemsErr } = await adminClient
      .from("retailer_order_items")
      .insert(lineItemsToInsert);

    if (itemsErr) {
      console.error("Order items insertion error:", itemsErr);
      return { success: false, error: "Failed to attach items to order." };
    }

    // 8. Revalidate paths
    revalidatePath("/retailer/orders");
    revalidatePath("/orders");

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

    const { data: orders, error } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        order_status,
        payment_status,
        payment_terms,
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

    if (error || !orders) {
      console.error("Error fetching retailer orders:", error);
      return [];
    }

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      orderStatus: o.order_status,
      paymentStatus: o.payment_status,
      paymentTerms: o.payment_terms || "PREPAID",
      totalAmount: Number(o.total_amount),
      subtotalAmount: Number(o.subtotal_amount),
      totalItemsCount: o.total_items_count,
      totalSkusCount: o.total_skus_count,
      createdAt: o.created_at,
      storeId: o.store_id,
      storeName: (o.stores as any)?.name || "Main Store",
      isTest: Boolean(o.is_test),
    }));
  } catch (err) {
    console.error("getRetailerOrders exception:", err);
    return [];
  }
}

/**
 * Fetch detailed order and its snapshotted items
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

    // Check by ID or order_number
    let query = adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        order_status,
        payment_status,
        payment_terms,
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
          line_total
        )
      `)
      .eq("company_id", companyId);

    if (
      orderIdentifier.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    ) {
      query = query.eq("id", orderIdentifier);
    } else {
      query = query.eq("order_number", orderIdentifier);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      console.error("Error fetching retailer order detail:", error);
      return null;
    }

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
      casePackQty: item.case_pack_qty,
      lineTotal: Number(item.line_total),
    }));

    return {
      id: order.id,
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentTerms: order.payment_terms || "PREPAID",
      totalAmount: Number(order.total_amount),
      subtotalAmount: Number(order.subtotal_amount),
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
    };
  } catch (err) {
    console.error("getRetailerOrderDetail exception:", err);
    return null;
  }
}
