"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession, verifyAdminSession } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import {
  RetailerPaymentEligibility,
  RetailerApprovedTerms,
  RetailerTermsStatus,
  RetailerPaymentMethod,
  RetailerPaymentStatus,
  RetailerPaymentRecord,
} from "./payment-types";

/**
 * Fetch authoritative payment method eligibility and commercial terms for a retailer company
 */
export async function getRetailerPaymentEligibility(
  companyId: string
): Promise<RetailerPaymentEligibility> {
  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("retailer_profiles")
    .select(`
      payment_method_card_enabled,
      payment_method_ach_enabled,
      terms_enabled,
      approved_terms,
      terms_status,
      credit_limit,
      payment_terms
    `)
    .eq("company_id", companyId)
    .maybeSingle();

  const cardEnabled = profile?.payment_method_card_enabled ?? true;
  const achEnabled = profile?.payment_method_ach_enabled ?? true;
  const termsEnabled = profile?.terms_enabled ?? false;
  const approvedTerms = (profile?.approved_terms || "prepaid") as RetailerApprovedTerms;
  const termsStatus = (profile?.terms_status || "pending") as RetailerTermsStatus;
  const creditLimit = Number(profile?.credit_limit || 0);

  const availableMethods: RetailerPaymentEligibility["availableMethods"] = [];

  // Card Option
  if (cardEnabled) {
    availableMethods.push({
      id: "card",
      label: "Credit / Debit Card",
      description: "Pay securely via corporate credit/debit card (Prepaid)",
      badge: "Prepaid",
    });
  }

  // ACH Option
  if (achEnabled) {
    availableMethods.push({
      id: "ach",
      label: "ACH Direct Bank Transfer",
      description: "Direct bank debit / ACH invoice settlement",
      badge: "Prepaid",
    });
  }

  // Net Terms Option (Only shown if authorized & approved by Admin)
  if (termsEnabled && termsStatus === "approved" && approvedTerms !== "prepaid") {
    const termsDisplayMap: Record<string, string> = {
      net15: "Net 15 Days",
      net30: "Net 30 Days",
      net45: "Net 45 Days",
      net60: "Net 60 Days",
    };
    const termsLabel = termsDisplayMap[approvedTerms] || approvedTerms.toUpperCase();

    availableMethods.push({
      id: "terms",
      label: `${termsLabel} Terms`,
      description: `Approved B2B credit line. Invoice payment due within ${approvedTerms.replace("net", "")} days of order dispatch.`,
      badge: "Approved Credit",
      isTerms: true,
      termsLabel,
    });
  }

  return {
    cardEnabled,
    achEnabled,
    termsEnabled,
    approvedTerms,
    termsStatus,
    creditLimit,
    availableMethods,
  };
}

/**
 * Fetch payment details and transaction history for an order
 */
export async function getOrderPayments(orderId: string): Promise<RetailerPaymentRecord[]> {
  const adminClient = createAdminClient();

  const { data: payments, error } = await adminClient
    .from("retailer_order_payments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error || !payments) {
    return [];
  }

  return payments.map((p) => ({
    id: p.id,
    orderId: p.order_id,
    companyId: p.company_id,
    paymentMethod: p.payment_method as RetailerPaymentMethod,
    provider: p.provider,
    providerPaymentId: p.provider_payment_id,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    failureReason: p.failure_reason,
    notes: p.notes,
    createdAt: p.created_at,
  }));
}

/**
 * Admin Action: Update Order Payment Status and record payment entry
 */
export async function adminUpdateOrderPaymentStatusAction(params: {
  orderId: string;
  paymentStatus: RetailerPaymentStatus;
  paymentMethod?: RetailerPaymentMethod;
  amount?: number;
  providerRef?: string;
  notes?: string;
}) {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const { orderId, paymentStatus, paymentMethod, amount, providerRef, notes } = params;

  // 1. Fetch order
  const { data: order, error: orderErr } = await adminClient
    .from("retailer_orders")
    .select("id, company_id, total_amount, order_number")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return { success: false, error: "Order not found." };
  }

  const now = new Date().toISOString();
  const updatePayload: any = {
    payment_status: paymentStatus,
    updated_at: now,
  };

  if (paymentStatus === "paid") {
    updatePayload.paid_at = now;
  }
  if (providerRef) {
    updatePayload.payment_provider_ref = providerRef.trim();
  }
  if (paymentMethod) {
    updatePayload.payment_method = paymentMethod;
  }
  if (notes) {
    updatePayload.payment_notes = notes.trim();
  }

  // 2. Update retailer_orders
  const { error: updateErr } = await adminClient
    .from("retailer_orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateErr) {
    console.error("Error updating order payment status:", updateErr);
    return { success: false, error: updateErr.message };
  }

  // 3. Record in retailer_order_payments if paid or partially paid
  if (paymentStatus === "paid" || paymentStatus === "partially_paid") {
    await adminClient.from("retailer_order_payments").insert({
      order_id: order.id,
      company_id: order.company_id,
      payment_method: paymentMethod || "terms",
      provider: "manual",
      provider_payment_id: providerRef || null,
      amount: amount ?? Number(order.total_amount),
      currency: "USD",
      status: "paid",
      notes: notes || `Marked as ${paymentStatus} by Admin`,
    });
  }

  revalidatePath(`/admin/purchasing/orders/${orderId}`);
  revalidatePath(`/admin/retailers/${order.company_id}`);
  revalidatePath(`/orders/${order.order_number}`);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/retailer/orders");

  return { success: true };
}
