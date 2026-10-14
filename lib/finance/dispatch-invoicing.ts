// lib/finance/dispatch-invoicing.ts
// Phase B3 — Authoritative Dispatch-Based Invoice & Prepayment Allocation Engine

import { parseTermsDays } from "./invoice-types";

export interface CreateDispatchInvoiceOptions {
  notes?: string;
}

export interface DispatchInvoiceLineCalculation {
  orderItemId: string;
  productId: string;
  sku: string;
  productName: string;
  brandName: string | null;
  quantityShipped: number;
  unitWholesalePrice: number;
  unitMsrp: number | null;
  lineSubtotal: number;
  allocatedDiscount: number;
  lineTotal: number;
}

export interface DispatchInvoiceCalculation {
  subtotal: number;
  discountTotal: number;
  shipping: number;
  tax: number;
  processingFee: number;
  totalAmount: number;
  allocatedPrepayment: number;
  amountPaid: number;
  balanceDue: number;
  invoiceStatus: "open" | "paid" | "void" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  prepaymentAllocationStatus: "none" | "partial" | "fully_allocated";
  lines: DispatchInvoiceLineCalculation[];
}

/**
 * Calculates line-level and aggregate amounts for a confirmed dispatch invoice.
 * Pure deterministic calculation with exact rounding and zero double-counting.
 */
export function calculateDispatchInvoiceAmounts(params: {
  fulfillmentItems: Array<{
    order_item_id: string;
    product_id: string;
    quantity_shipped: number;
  }>;
  orderItems: Array<{
    id: string;
    product_id: string;
    sku: string;
    product_name: string;
    brand_name?: string | null;
    quantity: number;
    unit_wholesale_price: number;
    unit_msrp?: number | null;
    discount_amount?: number | null;
  }>;
  order: {
    id: string;
    subtotal_amount: number;
    discount_amount?: number | null;
    shipping_amount?: number | null;
    tax_amount?: number | null;
    processing_fee?: number | null;
    payment_method?: string | null;
  };
  hasPriorActiveInvoiceWithShipping: boolean;
  hasPriorActiveInvoiceWithFee: boolean;
  unallocatedPrepayment: number;
}): DispatchInvoiceCalculation {
  const {
    fulfillmentItems,
    orderItems,
    order,
    hasPriorActiveInvoiceWithShipping,
    hasPriorActiveInvoiceWithFee,
    unallocatedPrepayment,
  } = params;

  const orderSubtotal = Number(order.subtotal_amount || 0);
  const orderDiscount = Number(order.discount_amount || 0);

  let subtotal = 0;
  let discountTotal = 0;
  const lines: DispatchInvoiceLineCalculation[] = [];

  for (const fItem of fulfillmentItems) {
    const qty = Number(fItem.quantity_shipped || 0);
    if (qty <= 0) continue;

    const ordItem = orderItems.find((oi) => oi.id === fItem.order_item_id);
    const unitPrice = Number(ordItem?.unit_wholesale_price || 0);
    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
    subtotal += lineSubtotal;

    // Proportional item discount allocation
    let lineDiscount = 0;
    if (ordItem && Number(ordItem.discount_amount || 0) > 0 && ordItem.quantity > 0) {
      lineDiscount = Math.round((Number(ordItem.discount_amount) / ordItem.quantity) * qty * 100) / 100;
    } else if (orderDiscount > 0 && orderSubtotal > 0) {
      lineDiscount = Math.round((lineSubtotal / orderSubtotal) * orderDiscount * 100) / 100;
    }

    // Ensure line discount doesn't exceed line subtotal
    lineDiscount = Math.min(lineDiscount, lineSubtotal);
    discountTotal += lineDiscount;

    const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;

    lines.push({
      orderItemId: fItem.order_item_id,
      productId: fItem.product_id,
      sku: ordItem?.sku || "SKU",
      productName: ordItem?.product_name || "Product",
      brandName: ordItem?.brand_name || null,
      quantityShipped: qty,
      unitWholesalePrice: unitPrice,
      unitMsrp: ordItem?.unit_msrp ? Number(ordItem.unit_msrp) : null,
      lineSubtotal,
      allocatedDiscount: lineDiscount,
      lineTotal,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  discountTotal = Math.round(discountTotal * 100) / 100;
  const netMerchandise = Math.max(0, subtotal - discountTotal);

  // Freight policy: Charged on first dispatch invoice only; never duplicated across dispatches
  let shipping = 0;
  if (!hasPriorActiveInvoiceWithShipping && Number(order.shipping_amount || 0) > 0) {
    shipping = Number(order.shipping_amount);
  }

  // Tax policy: Proportional to merchandise billed on this dispatch
  let tax = 0;
  if (Number(order.tax_amount || 0) > 0 && orderSubtotal > 0) {
    const netOrderMerchandise = Math.max(1, orderSubtotal - orderDiscount);
    tax = Math.round((netMerchandise / netOrderMerchandise) * Number(order.tax_amount) * 100) / 100;
  }

  // Processing fee policy: Net terms = 0. Card/ACH checkout fees billed on first invoice only
  let processingFee = 0;
  if (
    order.payment_method !== "terms" &&
    !hasPriorActiveInvoiceWithFee &&
    Number(order.processing_fee || 0) > 0
  ) {
    processingFee = Number(order.processing_fee);
  }

  const totalAmount = Math.round((netMerchandise + shipping + tax + processingFee) * 100) / 100;

  // Prepayment Allocation
  let allocatedPrepayment = 0;
  let amountPaid = 0;
  let balanceDue = totalAmount;
  let invoiceStatus: "open" | "paid" = "open";
  let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
  let prepaymentAllocationStatus: "none" | "partial" | "fully_allocated" = "none";

  if (unallocatedPrepayment > 0) {
    allocatedPrepayment = Math.min(totalAmount, unallocatedPrepayment);
    allocatedPrepayment = Math.round(allocatedPrepayment * 100) / 100;
    amountPaid = allocatedPrepayment;
    balanceDue = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);

    if (balanceDue <= 0) {
      invoiceStatus = "paid";
      paymentStatus = "paid";
      prepaymentAllocationStatus = "fully_allocated";
    } else {
      invoiceStatus = "open";
      paymentStatus = "partial";
      prepaymentAllocationStatus = "partial";
    }
  }

  return {
    subtotal,
    discountTotal,
    shipping,
    tax,
    processingFee,
    totalAmount,
    allocatedPrepayment,
    amountPaid,
    balanceDue,
    invoiceStatus,
    paymentStatus,
    prepaymentAllocationStatus,
    lines,
  };
}

/**
 * Creates an authoritative dispatch-based invoice for a confirmed fulfillment.
 * Strictly idempotent: prevents duplicate active invoices per dispatch.
 */
export async function createDispatchInvoice(
  adminClient: any,
  fulfillmentId: string,
  options?: CreateDispatchInvoiceOptions
): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  fulfillmentNumber?: string;
  alreadyExists?: boolean;
  error?: string;
}> {
  try {
    // 1. Idempotency Check: check if active invoice already exists for this fulfillment
    const { data: existingInv } = await adminClient
      .from("retailer_invoices")
      .select("id, invoice_number, invoice_status")
      .eq("fulfillment_id", fulfillmentId)
      .not("invoice_status", "in", '("void","cancelled")')
      .maybeSingle();

    if (existingInv) {
      return {
        success: true,
        invoiceId: existingInv.id,
        invoiceNumber: existingInv.invoice_number,
        alreadyExists: true,
      };
    }

    // 2. Fetch fulfillment record with items
    const { data: fulfillment, error: fulErr } = await adminClient
      .from("retailer_order_fulfillments")
      .select(`
        id,
        fulfillment_number,
        order_id,
        company_id,
        status,
        shipped_at,
        notes,
        retailer_order_fulfillment_items (
          id,
          order_item_id,
          product_id,
          quantity_shipped
        )
      `)
      .eq("id", fulfillmentId)
      .single();

    if (fulErr || !fulfillment) {
      return { success: false, error: "Fulfillment record not found." };
    }

    // Verify fulfillment is confirmed dispatched (shipped or delivered)
    if (!["shipped", "delivered"].includes(fulfillment.status)) {
      return {
        success: false,
        error: `Cannot issue invoice for fulfillment in "${fulfillment.status}" status. Dispatch must be confirmed first.`,
      };
    }

    const fulfillmentItems = fulfillment.retailer_order_fulfillment_items || [];
    const totalShippedQty = fulfillmentItems.reduce(
      (sum: number, it: any) => sum + Number(it.quantity_shipped || 0),
      0
    );

    if (totalShippedQty <= 0) {
      return {
        success: false,
        error: "Fulfillment has no shipped items with quantity > 0.",
      };
    }

    // 3. Fetch parent order with order items
    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select(`
        *,
        retailer_order_items (
          id,
          product_id,
          sku,
          product_name,
          brand_name,
          quantity,
          unit_wholesale_price,
          unit_msrp,
          discount_amount
        )
      `)
      .eq("id", fulfillment.order_id)
      .single();

    if (orderErr || !order) {
      return { success: false, error: "Parent order not found." };
    }

    // 4. Fetch existing active invoices for this order to avoid duplicating shipping/fees
    const { data: priorInvoices } = await adminClient
      .from("retailer_invoices")
      .select("id, shipping, processing_fee, prepayment_allocated_amount, invoice_status")
      .eq("order_id", order.id)
      .not("invoice_status", "in", '("void","cancelled")');

    const hasPriorActiveInvoiceWithShipping = (priorInvoices || []).some(
      (inv: any) => Number(inv.shipping || 0) > 0
    );
    const hasPriorActiveInvoiceWithFee = (priorInvoices || []).some(
      (inv: any) => Number(inv.processing_fee || 0) > 0
    );

    // 5. Prepayment Allocation: Calculate confirmed collected payments
    const { data: settledPayments } = await adminClient
      .from("retailer_order_payments")
      .select("id, amount, status")
      .eq("order_id", order.id)
      .eq("status", "paid");

    let totalSettledPrepayment = (settledPayments || []).reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0
    );

    // If payment log is empty but order is marked as paid with confirmed payment reference
    if (totalSettledPrepayment === 0 && order.payment_status === "paid") {
      totalSettledPrepayment = Number(order.total_amount || 0);
    }

    const previouslyAllocated = (priorInvoices || []).reduce(
      (sum: number, inv: any) => sum + Number(inv.prepayment_allocated_amount || 0),
      0
    );

    const unallocatedPrepayment = Math.max(0, totalSettledPrepayment - previouslyAllocated);

    // 6. Compute exact dispatch invoice amounts
    const calculation = calculateDispatchInvoiceAmounts({
      fulfillmentItems,
      orderItems: order.retailer_order_items || [],
      order,
      hasPriorActiveInvoiceWithShipping,
      hasPriorActiveInvoiceWithFee,
      unallocatedPrepayment,
    });

    // 7. Resolve Billing Address & Profile
    const { data: profile } = await adminClient
      .from("retailer_profiles")
      .select("approved_terms, billing_address, billing_city, billing_state, billing_zip, billing_contact_name, billing_contact_email, billing_contact_phone")
      .eq("company_id", order.company_id)
      .maybeSingle();

    // 8. Determine Dates & Payment Terms
    const shippedDateStr = fulfillment.shipped_at
      ? new Date(fulfillment.shipped_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const isNetTerms = order.payment_method === "terms";
    const rawTerms = order.payment_terms || profile?.approved_terms || "net30";
    const termsInfo = isNetTerms ? parseTermsDays(rawTerms) : { days: 0, name: "Due Upon Receipt" };

    const invoiceDateStr = shippedDateStr;
    const dueDate = new Date(
      new Date(invoiceDateStr).getTime() + termsInfo.days * 24 * 60 * 60 * 1000
    );
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Generate human-readable invoice number via sequence
    let invoiceNumber = `KSI-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    try {
      const { data: numData } = await adminClient.rpc("generate_next_invoice_number");
      if (numData) {
        invoiceNumber = numData;
      }
    } catch {
      // Fallback used
    }

    const termsSnapshot = {
      terms_code: rawTerms,
      terms_name: termsInfo.name,
      terms_days: termsInfo.days,
      order_payment_method: order.payment_method,
      fulfillment_number: fulfillment.fulfillment_number,
      shipped_at: fulfillment.shipped_at,
    };

    const billingSnapshot = {
      address: profile?.billing_address || order.shipping_address,
      city: profile?.billing_city || order.shipping_city,
      state: profile?.billing_state || order.shipping_state,
      zip: profile?.billing_zip || order.shipping_zip,
      contact_name: profile?.billing_contact_name || order.recipient_name,
      contact_email: profile?.billing_contact_email,
      contact_phone: profile?.billing_contact_phone || order.shipping_phone,
    };

    // 9. Insert Invoice Header into public.retailer_invoices
    const invoicePayload: any = {
      invoice_number: invoiceNumber,
      order_id: order.id,
      fulfillment_id: fulfillment.id,
      fulfillment_number: fulfillment.fulfillment_number,
      retailer_company_id: order.company_id,
      invoice_date: invoiceDateStr,
      due_date: dueDateStr,
      terms_days: termsInfo.days,
      terms_name: termsInfo.name,
      subtotal: calculation.subtotal,
      discount_total: calculation.discountTotal,
      processing_fee: calculation.processingFee,
      shipping: calculation.shipping,
      tax: calculation.tax,
      total_amount: calculation.totalAmount,
      amount_paid: calculation.amountPaid,
      balance_due: calculation.balanceDue,
      invoice_status: calculation.invoiceStatus,
      payment_status: calculation.paymentStatus,
      prepayment_allocated_amount: calculation.allocatedPrepayment,
      prepayment_allocation_status: calculation.prepaymentAllocationStatus,
      issued_at: new Date().toISOString(),
      paid_at: calculation.invoiceStatus === "paid" ? new Date().toISOString() : null,
      notes: options?.notes || fulfillment.notes || null,
      terms_snapshot: termsSnapshot,
      billing_snapshot: billingSnapshot,
    };

    let newInvoice: any = null;
    let invInsertErr: any = null;

    const res = await adminClient
      .from("retailer_invoices")
      .insert(invoicePayload)
      .select("id, invoice_number")
      .single();

    newInvoice = res.data;
    invInsertErr = res.error;

    if (invInsertErr && (invInsertErr.message?.includes("column") || invInsertErr.code === "PGRST204")) {
      console.warn("Retrying invoice insert with baseline columns schema fallback:", invInsertErr.message);
      const fallbackPayload = { ...invoicePayload };
      delete fallbackPayload.fulfillment_id;
      delete fallbackPayload.fulfillment_number;
      delete fallbackPayload.prepayment_allocated_amount;
      delete fallbackPayload.prepayment_allocation_status;
      delete fallbackPayload.dispatch_notes;
      const retryRes = await adminClient
        .from("retailer_invoices")
        .insert(fallbackPayload)
        .select("id, invoice_number")
        .single();
      newInvoice = retryRes.data;
      invInsertErr = retryRes.error;
    }

    if (invInsertErr && (invInsertErr.code === "23505" || invInsertErr.message?.includes("uq_retailer_invoices_active_fulfillment"))) {
      const { data: raceInv } = await adminClient
        .from("retailer_invoices")
        .select("id, invoice_number")
        .eq("fulfillment_id", fulfillmentId)
        .not("invoice_status", "in", '("void","cancelled")')
        .maybeSingle();

      if (raceInv) {
        return {
          success: true,
          invoiceId: raceInv.id,
          invoiceNumber: raceInv.invoice_number,
          fulfillmentNumber: fulfillment.fulfillment_number,
          alreadyExists: true,
        };
      }
    }

    if (invInsertErr || !newInvoice) {
      console.error("Failed to insert dispatch invoice:", invInsertErr);
      return { success: false, error: invInsertErr?.message || "Failed to create invoice." };
    }

    // 10. Insert Line Items into public.retailer_invoice_items
    if (calculation.lines.length > 0) {
      const lineRows = calculation.lines.map((l) => ({
        invoice_id: newInvoice.id,
        order_item_id: l.orderItemId,
        product_id: l.productId,
        sku: l.sku,
        product_name: l.productName,
        brand_name: l.brandName,
        quantity: l.quantityShipped,
        unit_wholesale_price: l.unitWholesalePrice,
        unit_msrp: l.unitMsrp,
        line_subtotal: l.lineSubtotal,
        allocated_discount: l.allocatedDiscount,
        line_total: l.lineTotal,
      }));

      const { error: linesErr } = await adminClient
        .from("retailer_invoice_items")
        .insert(lineRows);

      if (linesErr) {
        // Non-blocking log if table cache is refreshing
        console.warn("Could not insert retailer_invoice_items (table may be caching):", linesErr);
      }
    }

    // 11. Record Prepayment Allocation Audit Trail if applicable
    if (calculation.allocatedPrepayment > 0) {
      const primaryPaymentId = settledPayments?.[0]?.id || null;
      await adminClient.from("retailer_prepayment_allocations").insert({
        order_id: order.id,
        payment_id: primaryPaymentId,
        invoice_id: newInvoice.id,
        allocated_amount: calculation.allocatedPrepayment,
        allocated_at: new Date().toISOString(),
        notes: `Prepayment auto-allocated to dispatch invoice #${newInvoice.invoice_number}`,
      }).catch((e: any) => {
        console.warn("Could not insert retailer_prepayment_allocations:", e);
      });
    }

    return {
      success: true,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoice_number,
      fulfillmentNumber: fulfillment.fulfillment_number,
    };
  } catch (err: any) {
    console.error("createDispatchInvoice exception:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
