"use server";

import { getRetailerUserContext } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerARStatus } from "@/lib/finance/invoice-actions";
import { computeARStatus } from "@/lib/finance/invoice-types";
import { resolveEffectivePaymentPolicy } from "@/lib/retailer/payment-policy-server";
import { calculateProcessingFee } from "@/lib/retailer/payment-policy";
import type {
  RetailerBillSummary,
  RetailerBillDetail,
  RetailerBillsFeed,
} from "./bill-types";

/**
 * Fetches the authoritative bills list and live AR summary for the authenticated Retailer.
 * Guarantees strict tenant isolation by filtering solely by the caller's company_id.
 */
export async function getRetailerBillsAction(): Promise<{
  success: boolean;
  data?: RetailerBillsFeed;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    // 1. Live AR Summary from shared authoritative AR resolver
    const arSummary = await getRetailerARStatus(companyId);

    // 2. Query invoices belonging strictly to this retailer company (Tenant Isolation)
    const { data: invoiceRows, error: invErr } = await adminClient
      .from("retailer_invoices")
      .select(`
        *,
        retailer_orders:order_id (
          id,
          order_number,
          order_status,
          total_amount,
          total_skus_count
        )
      `)
      .eq("retailer_company_id", companyId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (invErr) {
      if (invErr.code === "PGRST205" || invErr.message?.includes("does not exist")) {
        return {
          success: true,
          data: {
            summary: arSummary,
            invoices: [],
          },
        };
      }
      return { success: false, error: invErr.message };
    }

    // In case any historical order record has null/0 total_skus_count, fetch fallback counts in single batch query (avoiding N+1)
    const missingOrderIds = (invoiceRows || [])
      .filter((r: any) => !r.retailer_orders?.total_skus_count && r.order_id)
      .map((r: any) => r.order_id);

    const fallbackSkuCounts: Record<string, number> = {};
    if (missingOrderIds.length > 0) {
      const { data: itemRows } = await adminClient
        .from("retailer_order_items")
        .select("order_id, sku")
        .in("order_id", missingOrderIds);

      if (itemRows) {
        const skuSets: Record<string, Set<string>> = {};
        for (const it of itemRows) {
          if (!skuSets[it.order_id]) skuSets[it.order_id] = new Set();
          if (it.sku) skuSets[it.order_id].add(it.sku);
        }
        for (const oid in skuSets) {
          fallbackSkuCounts[oid] = skuSets[oid].size;
        }
      }
    }

    const bills: RetailerBillSummary[] = (invoiceRows || []).map((row: any) => {
      const balanceDue = Number(row.balance_due || 0);
      const invoiceStatus = row.invoice_status || "open";
      const arStatus = computeARStatus({
        balance_due: balanceDue,
        due_date: row.due_date,
        invoice_status: invoiceStatus,
      });

      const totalSkus = Number(
        row.retailer_orders?.total_skus_count || fallbackSkuCounts[row.order_id] || 1
      );

      return {
        id: row.id,
        invoice_number: row.invoice_number,
        order_id: row.order_id,
        order_number: row.retailer_orders?.order_number || "—",
        retailer_company_id: row.retailer_company_id,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        terms_days: row.terms_days,
        terms_name: row.terms_name,
        total_amount: Number(row.total_amount || 0),
        amount_paid: Number(row.amount_paid || 0),
        balance_due: balanceDue,
        invoice_status: invoiceStatus,
        payment_status: row.payment_status || "unpaid",
        ar_status: arStatus,
        issued_at: row.issued_at,
        total_skus_count: totalSkus,
      };
    });

    return {
      success: true,
      data: {
        summary: arSummary,
        invoices: bills,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to load bills." };
  }
}

/**
 * Fetches the full bill details, line items, payment history, and current payment policy.
 * Verifies tenant ownership before returning any data.
 */
export async function getRetailerBillDetailAction(invoiceId: string): Promise<{
  success: boolean;
  bill?: RetailerBillDetail;
  effectivePolicy?: any;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "Access denied." };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    // 1. Fetch invoice and enforce strict tenant isolation
    const { data: inv, error: invErr } = await adminClient
      .from("retailer_invoices")
      .select(`
        *,
        retailer_orders:order_id (
          id,
          order_number,
          order_status,
          total_amount,
          total_skus_count,
          shipping_address,
          shipping_city,
          shipping_state,
          shipping_zip,
          shipping_phone,
          recipient_name
        )
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !inv) {
      return { success: false, error: "Bill not found." };
    }

    // TENANT ISOLATION GUARD: Verify invoice belongs to the requesting retailer company
    if (inv.retailer_company_id !== companyId) {
      console.warn(`[Security Alert] Unauthorized access attempt by company ${companyId} on invoice ${invoiceId}`);
      return { success: false, error: "Access denied: Bill does not belong to your account." };
    }

    // 2. Fetch order items
    const { data: items } = await adminClient
      .from("retailer_order_items")
      .select("id, product_name, sku, brand_name, quantity, unit_wholesale_price, line_total")
      .eq("order_id", inv.order_id);

    // 3. Fetch payment history
    const { data: payments } = await adminClient
      .from("retailer_order_payments")
      .select("id, created_at, payment_method, amount, fee_amount, fee_rate, status, notes")
      .or(`invoice_id.eq.${invoiceId},and(order_id.eq.${inv.order_id},status.eq.paid)`)
      .order("created_at", { ascending: false });

    // 4. Fetch billing address from company profile
    const { data: comp } = await adminClient
      .from("companies")
      .select("name, contact_name, contact_phone, address_1, address_2, city, state, zip_code")
      .eq("id", companyId)
      .maybeSingle();

    // 5. Fetch effective payment policy for live fee preview
    const effectivePolicy = await resolveEffectivePaymentPolicy(companyId);

    const balanceDue = Number(inv.balance_due || 0);
    const invoiceStatus = inv.invoice_status || "open";
    const arStatus = computeARStatus({
      balance_due: balanceDue,
      due_date: inv.due_date,
      invoice_status: invoiceStatus,
    });

    const billDetail: RetailerBillDetail = {
      id: inv.id,
      invoice_number: inv.invoice_number,
      order_id: inv.order_id,
      order_number: inv.retailer_orders?.order_number || "—",
      retailer_company_id: inv.retailer_company_id,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      terms_days: inv.terms_days,
      terms_name: inv.terms_name,
      total_skus_count: (inv.retailer_orders as any)?.total_skus_count ?? (items?.length || 1),
      subtotal: Number(inv.subtotal || 0),
      discount_total: Number(inv.discount_total || 0),
      processing_fee: Number(inv.processing_fee || 0),
      shipping: Number(inv.shipping || 0),
      tax: Number(inv.tax || 0),
      total_amount: Number(inv.total_amount || 0),
      amount_paid: Number(inv.amount_paid || 0),
      balance_due: balanceDue,
      invoice_status: invoiceStatus,
      payment_status: inv.payment_status || "unpaid",
      ar_status: arStatus,
      issued_at: inv.issued_at,
      notes: inv.notes,
      billing_address: {
        company_name: comp?.name || userContext.companyName,
        contact_name: comp?.contact_name || userContext.userName,
        phone: comp?.contact_phone,
        address_1: comp?.address_1,
        address_2: comp?.address_2,
        city: comp?.city,
        state: comp?.state,
        zip_code: comp?.zip_code,
      },
      line_items: (items || []).map((item: any) => ({
        id: item.id,
        product_name: item.product_name,
        sku: item.sku,
        variant_name: item.brand_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_wholesale_price || 0),
        total_price: Number(item.line_total || 0),
      })),
      payment_history: (payments || []).map((p: any) => {
        const principal = Number(p.amount || 0);
        const fee = Number(p.fee_amount || 0);
        return {
          id: p.id,
          created_at: p.created_at,
          payment_method: p.payment_method || "card",
          amount: principal,
          fee_amount: fee,
          fee_rate: Number(p.fee_rate || 0),
          total_charged: Math.round((principal + fee) * 100) / 100,
          status: p.status,
          notes: p.notes,
        };
      }),
    };

    return {
      success: true,
      bill: billDetail,
      effectivePolicy,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to load bill details." };
  }
}

/**
 * Pay Bill Server Action.
 * Validates invoice ownership, active balance, and payment method eligibility.
 * Protects financial integrity: if provider is not ready, never fakes payment or reduces balance.
 */
export async function payRetailerBillAction(params: {
  invoiceId: string;
  paymentMethod: "card" | "ach";
  amount?: number;
}): Promise<{
  success: boolean;
  providerPending?: boolean;
  error?: string;
  paymentDetails?: any;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "Access denied." };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    // 1. Fetch invoice and enforce tenant isolation
    const { data: inv, error: invErr } = await adminClient
      .from("retailer_invoices")
      .select("*")
      .eq("id", params.invoiceId)
      .maybeSingle();

    if (invErr || !inv) {
      return { success: false, error: "Invoice not found." };
    }

    if (inv.retailer_company_id !== companyId) {
      return { success: false, error: "Access denied: Invoice does not belong to your account." };
    }

    // 2. Validate invoice is active & payable
    if (inv.invoice_status === "void" || inv.invoice_status === "cancelled") {
      return { success: false, error: "This invoice is voided or cancelled and cannot be paid." };
    }

    const currentBalance = Number(inv.balance_due || 0);
    if (currentBalance <= 0) {
      return { success: false, error: "This invoice is already fully paid." };
    }

    // 3. Validate payment amount
    const payAmount = params.amount !== undefined ? Number(params.amount) : currentBalance;
    if (isNaN(payAmount) || payAmount <= 0) {
      return { success: false, error: "Please enter a valid payment amount." };
    }
    if (payAmount > currentBalance) {
      return {
        success: false,
        error: `Payment amount ($${payAmount.toFixed(2)}) cannot exceed the balance due ($${currentBalance.toFixed(2)}).`,
      };
    }

    // 4. Resolve current effective payment policy
    const effectivePolicy = await resolveEffectivePaymentPolicy(companyId);
    const channelPolicy = params.paymentMethod === "card" ? effectivePolicy.card : effectivePolicy.ach;

    if (!channelPolicy.effectiveEnabled) {
      return {
        success: false,
        error: `${params.paymentMethod.toUpperCase()} payments are not enabled for your store account.`,
      };
    }

    // 5. Calculate fee preview
    const feeResult = calculateProcessingFee({
      paymentMethod: params.paymentMethod,
      chargeBase: payAmount,
      effectivePolicy,
    });

    // 6. PROVIDER READINESS ENFORCEMENT (Rule 12 & 25)
    // Never create fake paid records or mark invoice paid if provider is not ready!
    if (!channelPolicy.providerReady) {
      return {
        success: false,
        providerPending: true,
        error:
          "Online payment setup is currently in progress. Automatic credit card and bank transfer processing will be enabled shortly. To pay this bill via manual wire transfer or check, please contact your Letusto account manager.",
        paymentDetails: {
          principalAmount: payAmount,
          processingFee: feeResult.feeAmount,
          totalCharged: feeResult.totalWithFee,
          method: params.paymentMethod,
        },
      };
    }

    // In future phase with live payment processor (Stripe / Plaid ACH):
    return {
      success: false,
      providerPending: true,
      error: "Payment provider integration is pending configuration.",
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Payment request failed." };
  }
}

export interface PayMultipleRetailerBillsParams {
  invoiceIds: string[];
  paymentMethod: "card" | "ach";
}

/**
 * Server Action for Multi-Invoice Payment Preview & Processing Guard
 * Validates selected invoices, enforces tenant isolation, calculates combined principal and fee,
 * and enforces Provider Pending protection (zero financial mutation).
 */
export async function payMultipleRetailerBillsAction(
  params: PayMultipleRetailerBillsParams
): Promise<{
  success: boolean;
  providerPending?: boolean;
  error?: string;
  paymentDetails?: {
    principalAmount: number;
    processingFee: number;
    totalCharged: number;
    invoiceCount: number;
    invoiceNumbers: string[];
    method: "card" | "ach";
  };
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "Access denied." };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    if (!params.invoiceIds || params.invoiceIds.length === 0) {
      return { success: false, error: "No bills selected for payment." };
    }

    // 1. Fetch invoices and enforce tenant isolation
    const { data: invoices, error: invErr } = await adminClient
      .from("retailer_invoices")
      .select("id, invoice_number, balance_due, invoice_status, retailer_company_id")
      .in("id", params.invoiceIds);

    if (invErr || !invoices || invoices.length === 0) {
      return { success: false, error: "Selected invoices could not be found." };
    }

    // Enforce tenant isolation for every invoice
    const unauthorized = invoices.some((inv) => inv.retailer_company_id !== companyId);
    if (unauthorized) {
      return { success: false, error: "Access denied: One or more selected invoices do not belong to your account." };
    }

    // Validate all invoices are active & payable
    const unpayable = invoices.filter(
      (inv) => inv.invoice_status === "void" || inv.invoice_status === "cancelled" || Number(inv.balance_due || 0) <= 0
    );
    if (unpayable.length > 0) {
      return {
        success: false,
        error: `Invoice ${unpayable[0].invoice_number} is not payable (already settled, voided, or cancelled).`,
      };
    }

    // 2. Sum principal balance due (100% of outstanding balance, no partial payments in Phase A)
    const principalTotal = invoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);
    const roundedPrincipal = Math.round(principalTotal * 100) / 100;

    // 3. Resolve current effective payment policy (shared policy resolver)
    const effectivePolicy = await resolveEffectivePaymentPolicy(companyId);
    const channelPolicy = params.paymentMethod === "card" ? effectivePolicy.card : effectivePolicy.ach;

    if (!channelPolicy.effectiveEnabled) {
      return {
        success: false,
        error: `${params.paymentMethod.toUpperCase()} payments are not enabled for your store account.`,
      };
    }

    // 4. Calculate fee preview
    const feeResult = calculateProcessingFee({
      paymentMethod: params.paymentMethod,
      chargeBase: roundedPrincipal,
      effectivePolicy,
    });

    // 5. PROVIDER READINESS ENFORCEMENT (Rule 12 & 25)
    // Live payment provider is not yet integrated.
    // Absolutely ZERO financial mutation or fake records!
    if (!channelPolicy.providerReady) {
      return {
        success: false,
        providerPending: true,
        error:
          "Online payment processing is currently in setup phase. Automated credit card and direct ACH settlement will be enabled shortly. To settle selected invoices via bank wire or invoice payment, please contact your Letusto account manager.",
        paymentDetails: {
          principalAmount: roundedPrincipal,
          processingFee: feeResult.feeAmount,
          totalCharged: feeResult.totalWithFee,
          invoiceCount: invoices.length,
          invoiceNumbers: invoices.map((i) => i.invoice_number),
          method: params.paymentMethod,
        },
      };
    }

    return {
      success: false,
      providerPending: true,
      error: "Payment provider integration is pending configuration.",
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Multi-invoice payment request failed." };
  }
}
