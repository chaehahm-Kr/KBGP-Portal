"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  type RetailerInvoice,
  type RetailerARStatus,
  type GlobalARSummary,
  computeARStatus,
  parseTermsDays,
} from "./invoice-types";

/**
 * Shared Authoritative Resolver: Computes the live AR Status and Available Credit for a Retailer.
 * Available Credit = Credit Limit - Open AR Balance
 * Can be reused across Checkout, Net Terms Guards, and Admin 360 views.
 */
export async function getRetailerARStatus(companyId: string): Promise<RetailerARStatus> {
  const adminClient = createAdminClient();

  // 1. Fetch retailer credit limit from retailer_profiles
  const { data: profile } = await adminClient
    .from("retailer_profiles")
    .select("credit_limit, approved_terms")
    .eq("company_id", companyId)
    .maybeSingle();

  const creditLimit = Number(profile?.credit_limit || 0);

  // 2. Fetch active invoices for this retailer
  const { data: invoices, error } = await adminClient
    .from("retailer_invoices")
    .select("id, balance_due, due_date, invoice_status, payment_status")
    .eq("retailer_company_id", companyId)
    .not("invoice_status", "in", '("void","cancelled")');

  if (error || !invoices) {
    return {
      companyId,
      openAR: 0,
      pastDueAmount: 0,
      dueSoonAmount: 0,
      openInvoiceCount: 0,
      pastDueInvoiceCount: 0,
      hasPastDue: false,
      creditLimit,
      availableCredit: creditLimit,
    };
  }

  let openAR = 0;
  let pastDueAmount = 0;
  let dueSoonAmount = 0;
  let openInvoiceCount = 0;
  let pastDueInvoiceCount = 0;

  for (const inv of invoices) {
    const balance = Number(inv.balance_due || 0);
    if (balance > 0) {
      openAR += balance;
      openInvoiceCount += 1;

      const arStatus = computeARStatus({
        balance_due: balance,
        due_date: inv.due_date,
        invoice_status: inv.invoice_status,
      });

      if (arStatus === "PAST_DUE") {
        pastDueAmount += balance;
        pastDueInvoiceCount += 1;
      } else if (arStatus === "DUE_SOON") {
        dueSoonAmount += balance;
      }
    }
  }

  const availableCredit = Math.max(0, creditLimit - openAR);

  return {
    companyId,
    openAR: Math.round(openAR * 100) / 100,
    pastDueAmount: Math.round(pastDueAmount * 100) / 100,
    dueSoonAmount: Math.round(dueSoonAmount * 100) / 100,
    openInvoiceCount,
    pastDueInvoiceCount,
    hasPastDue: pastDueInvoiceCount > 0,
    creditLimit,
    availableCredit: Math.round(availableCredit * 100) / 100,
  };
}

/**
 * Shared Authoritative Resolver: Computes network-wide Accounts Receivable summary for Admin Dashboard.
 */
export async function getGlobalARSummary(): Promise<GlobalARSummary> {
  const adminClient = createAdminClient();

  const { data: invoices, error } = await adminClient
    .from("retailer_invoices")
    .select("id, balance_due, due_date, invoice_status")
    .not("invoice_status", "in", '("void","cancelled")');

  if (error || !invoices) {
    return {
      totalOpenAR: 0,
      totalPastDueAmount: 0,
      totalDueSoonAmount: 0,
      openInvoiceCount: 0,
      pastDueInvoiceCount: 0,
      paidInvoiceCount: 0,
    };
  }

  let totalOpenAR = 0;
  let totalPastDueAmount = 0;
  let totalDueSoonAmount = 0;
  let openInvoiceCount = 0;
  let pastDueInvoiceCount = 0;
  let paidInvoiceCount = 0;

  for (const inv of invoices) {
    const balance = Number(inv.balance_due || 0);
    if (balance > 0) {
      totalOpenAR += balance;
      openInvoiceCount += 1;

      const arStatus = computeARStatus({
        balance_due: balance,
        due_date: inv.due_date,
        invoice_status: inv.invoice_status,
      });

      if (arStatus === "PAST_DUE") {
        totalPastDueAmount += balance;
        pastDueInvoiceCount += 1;
      } else if (arStatus === "DUE_SOON") {
        totalDueSoonAmount += balance;
      }
    } else {
      paidInvoiceCount += 1;
    }
  }

  return {
    totalOpenAR: Math.round(totalOpenAR * 100) / 100,
    totalPastDueAmount: Math.round(totalPastDueAmount * 100) / 100,
    totalDueSoonAmount: Math.round(totalDueSoonAmount * 100) / 100,
    openInvoiceCount,
    pastDueInvoiceCount,
    paidInvoiceCount,
  };
}

/**
 * Fetches all invoices with relations, search, and AR status filtering for Admin.
 */
export async function getAdminInvoicesAction(filters?: {
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; invoices: RetailerInvoice[]; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    let query = adminClient
      .from("retailer_invoices")
      .select(`
        *,
        companies:retailer_company_id (id, name, company_code),
        retailer_orders:order_id (id, order_number, order_status, total_amount)
      `)
      .order("created_at", { ascending: false });

    if (filters?.startDate) {
      query = query.gte("invoice_date", filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte("invoice_date", filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      // Graceful fallback if table does not yet exist in schema cache
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { success: true, invoices: [] };
      }
      return { success: false, invoices: [], error: error.message };
    }

    const formattedInvoices: RetailerInvoice[] = (data || []).map((row: any) => {
      const balanceDue = Number(row.balance_due || 0);
      const invoiceStatus = row.invoice_status || "open";
      const arStatus = computeARStatus({
        balance_due: balanceDue,
        due_date: row.due_date,
        invoice_status: invoiceStatus,
      });

      return {
        id: row.id,
        invoice_number: row.invoice_number,
        order_id: row.order_id,
        retailer_company_id: row.retailer_company_id,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        terms_days: row.terms_days,
        terms_name: row.terms_name,
        subtotal: Number(row.subtotal || 0),
        discount_total: Number(row.discount_total || 0),
        processing_fee: Number(row.processing_fee || 0),
        shipping: Number(row.shipping || 0),
        tax: Number(row.tax || 0),
        total_amount: Number(row.total_amount || 0),
        amount_paid: Number(row.amount_paid || 0),
        balance_due: balanceDue,
        invoice_status: invoiceStatus,
        payment_status: row.payment_status || "unpaid",
        issued_at: row.issued_at,
        paid_at: row.paid_at || null,
        voided_at: row.voided_at || null,
        notes: row.notes || null,
        terms_snapshot: row.terms_snapshot,
        billing_snapshot: row.billing_snapshot,
        created_at: row.created_at,
        updated_at: row.updated_at,
        retailer: row.companies
          ? {
              id: row.companies.id,
              name: row.companies.name,
              company_code: row.companies.company_code,
            }
          : undefined,
        order: row.retailer_orders
          ? {
              id: row.retailer_orders.id,
              order_number: row.retailer_orders.order_number,
              order_status: row.retailer_orders.order_status,
              total_amount: Number(row.retailer_orders.total_amount || 0),
            }
          : undefined,
        ar_status: arStatus,
      };
    });

    // In-memory filter for computed AR status tabs
    let filtered = formattedInvoices;
    if (filters?.status && filters.status !== "all") {
      const s = filters.status.toUpperCase();
      if (s === "OPEN") {
        filtered = filtered.filter((i) => i.ar_status === "OPEN" || i.ar_status === "DUE_SOON");
      } else if (s === "DUE_SOON") {
        filtered = filtered.filter((i) => i.ar_status === "DUE_SOON");
      } else if (s === "PAST_DUE") {
        filtered = filtered.filter((i) => i.ar_status === "PAST_DUE");
      } else if (s === "PAID") {
        filtered = filtered.filter((i) => i.ar_status === "PAID");
      } else if (s === "VOID") {
        filtered = filtered.filter((i) => i.ar_status === "VOID");
      }
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          i.order?.order_number.toLowerCase().includes(q) ||
          i.retailer?.name.toLowerCase().includes(q) ||
          (i.retailer?.company_code && i.retailer.company_code.toLowerCase().includes(q))
      );
    }

    return { success: true, invoices: filtered };
  } catch (err: any) {
    console.error("getAdminInvoicesAction error:", err);
    return { success: false, invoices: [], error: err.message };
  }
}

/**
 * Fetches complete invoice detail, including items, company billing details, and payment history.
 */
export async function getAdminInvoiceDetailAction(invoiceId: string) {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: inv, error: invErr } = await adminClient
      .from("retailer_invoices")
      .select(`
        *,
        companies:retailer_company_id (id, name, company_code),
        retailer_orders:order_id (
          id, order_number, order_status, shipping_address, shipping_city, shipping_state, shipping_zip, recipient_name, shipping_phone
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invErr || !inv) {
      return { success: false, error: invErr?.message || "Invoice not found" };
    }

    // Line items from retailer_order_items
    const { data: items } = await adminClient
      .from("retailer_order_items")
      .select("*")
      .eq("order_id", inv.order_id);

    // Payments history from retailer_order_payments
    const { data: payments } = await adminClient
      .from("retailer_order_payments")
      .select("*")
      .or(`invoice_id.eq.${invoiceId},order_id.eq.${inv.order_id}`)
      .order("created_at", { ascending: false });

    const arStatus = computeARStatus({
      balance_due: Number(inv.balance_due || 0),
      due_date: inv.due_date,
      invoice_status: inv.invoice_status,
    });

    return {
      success: true,
      invoice: {
        ...inv,
        ar_status: arStatus,
        items: items || [],
        payments: payments || [],
      },
    };
  } catch (err: any) {
    console.error("getAdminInvoiceDetailAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Issues an invoice for an order.
 * Strictly enforces Idempotency: checks whether an active invoice already exists for this order.
 */
export async function issueInvoiceForOrderAction(
  orderId: string,
  options?: { notes?: string; customDueDays?: number }
): Promise<{ success: boolean; invoice?: RetailerInvoice; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Idempotency Guard: check if an active invoice already exists
    const { data: existingInvoices } = await adminClient
      .from("retailer_invoices")
      .select("id, invoice_number, invoice_status")
      .eq("order_id", orderId)
      .not("invoice_status", "in", '("void","cancelled")');

    if (existingInvoices && existingInvoices.length > 0) {
      return {
        success: false,
        error: `Order already has an active invoice (${existingInvoices[0].invoice_number}). Cannot create duplicate active invoices.`,
      };
    }

    // 2. Fetch order data with snapshot values
    const { data: order, error: orderErr } = await adminClient
      .from("retailer_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: "Order not found." };
    }

    // 3. Fetch retailer profile billing snapshot
    const { data: profile } = await adminClient
      .from("retailer_profiles")
      .select("approved_terms, billing_address, billing_city, billing_state, billing_zip, billing_contact_name, billing_contact_email, billing_contact_phone")
      .eq("company_id", order.company_id)
      .maybeSingle();

    // 4. Resolve terms from Order Snapshot (Authoritative) or Profile fallback
    const rawTerms = order.payment_terms || order.payment_snapshot?.payment_terms || profile?.approved_terms || "net30";
    const termsInfo = parseTermsDays(options?.customDueDays ? `net${options.customDueDays}` : rawTerms);

    const invoiceDate = new Date();
    const invoiceDateStr = invoiceDate.toISOString().split("T")[0];

    const dueDate = new Date(invoiceDate.getTime() + termsInfo.days * 24 * 60 * 60 * 1000);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const subtotal = Number(order.subtotal_amount || 0);
    const discount = Number(order.discount_amount || 0);
    // Net terms invoices do not carry card/ACH checkout fees into principal
    const processingFee = order.payment_method === "terms" ? 0 : Number(order.processing_fee || 0);
    const shipping = Number(order.shipping_amount || 0);
    const tax = Number(order.tax_amount || 0);
    const totalAmount = Number(order.total_amount || 0);

    const isOrderPaid = order.payment_status === "paid";
    const amountPaid = isOrderPaid ? totalAmount : 0;
    const balanceDue = totalAmount - amountPaid;
    const invoiceStatus = balanceDue <= 0 ? "paid" : "open";
    const paymentStatus = balanceDue <= 0 ? "paid" : "unpaid";

    const termsSnapshot = {
      terms_code: rawTerms,
      terms_name: termsInfo.name,
      terms_days: termsInfo.days,
      order_payment_method: order.payment_method,
      order_created_at: order.created_at,
      payment_snapshot: order.payment_snapshot,
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

    // 5. Generate human-readable invoice number via sequence if supported, or fallback
    let invoiceNumber: string | undefined;
    const { data: numData } = await adminClient.rpc("generate_next_invoice_number");
    if (numData) {
      invoiceNumber = numData;
    } else {
      const year = new Date().getFullYear();
      const randSuffix = Math.floor(100000 + Math.random() * 900000);
      invoiceNumber = `KSI-${year}-${randSuffix}`;
    }

    const { data: newInvoice, error: insertErr } = await adminClient
      .from("retailer_invoices")
      .insert({
        invoice_number: invoiceNumber,
        order_id: orderId,
        retailer_company_id: order.company_id,
        invoice_date: invoiceDateStr,
        due_date: dueDateStr,
        terms_days: termsInfo.days,
        terms_name: termsInfo.name,
        subtotal,
        discount_total: discount,
        processing_fee: processingFee,
        shipping,
        tax,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        invoice_status: invoiceStatus,
        payment_status: paymentStatus,
        issued_at: new Date().toISOString(),
        paid_at: isOrderPaid ? new Date().toISOString() : null,
        notes: options?.notes || null,
        terms_snapshot: termsSnapshot,
        billing_snapshot: billingSnapshot,
      })
      .select()
      .single();

    if (insertErr || !newInvoice) {
      console.error("Failed to insert invoice:", insertErr);
      return { success: false, error: insertErr?.message || "Failed to create invoice." };
    }

    revalidatePath("/admin/finance/receivables");
    revalidatePath("/admin");

    return { success: true, invoice: newInvoice };
  } catch (err: any) {
    console.error("issueInvoiceForOrderAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Voids an active invoice.
 */
export async function voidInvoiceAction(invoiceId: string, reason?: string) {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("retailer_invoices")
      .update({
        invoice_status: "void",
        voided_at: new Date().toISOString(),
        notes: reason ? `[VOIDED: ${reason}]` : undefined,
      })
      .eq("id", invoiceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/finance/receivables");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("voidInvoiceAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves orders eligible for invoice creation (orders that do not yet have an active invoice).
 */
export async function getEligibleOrdersForInvoicingAction() {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Fetch active invoice order IDs
    const { data: existingInvoices } = await adminClient
      .from("retailer_invoices")
      .select("order_id")
      .not("invoice_status", "in", '("void","cancelled")');

    const invoicedOrderIds = new Set((existingInvoices || []).map((i) => i.order_id));

    // 2. Fetch orders
    const { data: orders, error } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        company_id,
        order_status,
        payment_method,
        payment_terms,
        total_amount,
        created_at,
        companies:company_id (id, name, company_code)
      `)
      .order("created_at", { ascending: false });

    if (error || !orders) {
      return { success: true, orders: [] };
    }

    const eligible = orders
      .filter((o) => !invoicedOrderIds.has(o.id))
      .map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        company_id: o.company_id,
        company_name: o.companies?.name || "Unknown Retailer",
        company_code: o.companies?.company_code,
        order_status: o.order_status,
        payment_method: o.payment_method,
        payment_terms: o.payment_terms,
        total_amount: Number(o.total_amount || 0),
        created_at: o.created_at,
      }));

    return { success: true, orders: eligible };
  } catch (err: any) {
    console.error("getEligibleOrdersForInvoicingAction error:", err);
    return { success: false, orders: [], error: err.message };
  }
}
