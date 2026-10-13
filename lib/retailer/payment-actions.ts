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

import { resolveEffectivePaymentPolicy } from "./payment-policy-server";

/**
 * Fetch authoritative payment method eligibility and commercial terms for a retailer company
 */
export async function getRetailerPaymentEligibility(
  companyId: string
): Promise<RetailerPaymentEligibility> {
  const policy = await resolveEffectivePaymentPolicy(companyId);

  const availableMethods: RetailerPaymentEligibility["availableMethods"] = [];

  // Card Option
  if (policy.card.effectiveEnabled) {
    availableMethods.push({
      id: "card",
      label: "Credit / Debit Card",
      description: policy.card.providerReady
        ? "Pay securely via corporate credit/debit card."
        : "Online card gateway setup pending — order placed as Unpaid for manual invoice / card settlement.",
      badge: policy.card.providerReady ? "Prepaid" : "Setup Pending",
      providerConfigured: policy.card.providerReady,
      feeType: policy.card.feeType,
      feeRate: policy.card.feeRate,
      feeAmount: policy.card.feeAmount,
      feeSource: policy.card.feeSource,
      disclosureLabel: policy.card.disclosureLabel,
    });
  }

  // ACH Option
  if (policy.ach.effectiveEnabled) {
    availableMethods.push({
      id: "ach",
      label: "ACH Bank Transfer",
      description: policy.ach.providerReady
        ? "Direct bank debit / ACH invoice settlement."
        : "Online direct debit setup pending — order placed as Unpaid for bank transfer / invoice settlement.",
      badge: policy.ach.providerReady ? "Prepaid" : "Setup Pending",
      providerConfigured: policy.ach.providerReady,
      feeType: policy.ach.feeType,
      feeRate: policy.ach.feeRate,
      feeAmount: policy.ach.feeAmount,
      feeSource: policy.ach.feeSource,
      disclosureLabel: policy.ach.disclosureLabel,
    });
  }

  // Net Terms Option (Shown if authorized & approved by Admin, or enabled)
  if (policy.terms.effectiveEnabled || (policy.terms.termsStatus === "approved" && policy.terms.approvedTerms !== "prepaid")) {
    const isPastDueBlocked = Boolean(policy.terms.isBlockedByPastDue);

    availableMethods.push({
      id: "terms",
      label: policy.terms.termsDisplayLabel,
      description: `Invoice issued after order release. Payment due ${policy.terms.termDays} days from invoice date.`,
      badge: isPastDueBlocked ? "Past Due Hold" : "Approved Terms",
      isTerms: true,
      termsLabel: policy.terms.termsDisplayLabel,
      providerConfigured: true,
      feeType: "waived",
      feeRate: 0,
      feeAmount: 0,
      feeSource: "waived",
      disclosureLabel: policy.terms.disclosureLabel,
      disabled: isPastDueBlocked,
      disabledReason: isPastDueBlocked
        ? "Net Terms checkout is temporarily suspended because your account has past-due invoices. Please settle outstanding balances or select Card / ACH."
        : undefined,
    });
  }

  return {
    cardEnabled: policy.card.effectiveEnabled,
    achEnabled: policy.ach.effectiveEnabled,
    termsEnabled: policy.terms.effectiveEnabled,
    approvedTerms: policy.terms.approvedTerms,
    termsStatus: policy.terms.termsStatus,
    creditLimit: policy.terms.creditLimit,
    isCardProviderConfigured: policy.card.providerReady,
    isAchProviderConfigured: policy.ach.providerReady,
    effectivePolicy: policy,
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
