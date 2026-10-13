"use server";

import { getRetailerUserContext, verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectivePaymentPolicy } from "./payment-policy-server";
import type {
  RetailerPaymentMethodRecord,
  PaymentMethodsStatusResponse,
} from "./payment-method-types";

/**
 * Fetch saved payment methods and payment gateway readiness for the authenticated Retailer.
 * Guarantees zero sensitive data disclosure and strictly enforces tenant isolation.
 */
export async function getRetailerPaymentMethodsAction(): Promise<{
  success: boolean;
  data?: PaymentMethodsStatusResponse;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const companyId = userContext.companyId;
    const policy = await resolveEffectivePaymentPolicy(companyId);
    const adminClient = createAdminClient();

    let methods: RetailerPaymentMethodRecord[] = [];

    const { data: rows, error } = await adminClient
      .from("retailer_payment_methods")
      .select("id, company_id, payment_method_type, provider_name, brand, last4, exp_month, exp_year, bank_name, account_holder_type, is_default, status, created_at")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("is_default", { ascending: false });

    if (!error && rows) {
      methods = rows.map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        paymentMethodType: r.payment_method_type,
        providerName: r.provider_name,
        brand: r.brand,
        last4: r.last4,
        expMonth: r.exp_month,
        expYear: r.exp_year,
        bankName: r.bank_name,
        accountHolderType: r.account_holder_type,
        isDefault: Boolean(r.is_default),
        status: r.status,
        createdAt: r.created_at,
      }));
    }

    const providerReady = policy.card.providerReady || policy.ach.providerReady;

    return {
      success: true,
      data: {
        providerReady,
        providerStatus: providerReady ? "connected" : "setup_pending",
        cardProcessingAllowed: policy.card.retailerAllowed && policy.card.globalEnabled,
        achProcessingAllowed: policy.ach.retailerAllowed && policy.ach.globalEnabled,
        methods,
      },
    };
  } catch (err: any) {
    console.error("getRetailerPaymentMethodsAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin action: View safe payment methods status for a retailer company.
 */
export async function adminGetRetailerPaymentMethodsAction(
  companyId: string
): Promise<{
  success: boolean;
  data?: PaymentMethodsStatusResponse;
  error?: string;
}> {
  try {
    await verifyAdminSession();
    const policy = await resolveEffectivePaymentPolicy(companyId);
    const adminClient = createAdminClient();

    let methods: RetailerPaymentMethodRecord[] = [];

    const { data: rows } = await adminClient
      .from("retailer_payment_methods")
      .select("id, company_id, payment_method_type, provider_name, brand, last4, exp_month, exp_year, bank_name, account_holder_type, is_default, status, created_at")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("is_default", { ascending: false });

    if (rows) {
      methods = rows.map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        paymentMethodType: r.payment_method_type,
        providerName: r.provider_name,
        brand: r.brand,
        last4: r.last4,
        expMonth: r.exp_month,
        expYear: r.exp_year,
        bankName: r.bank_name,
        accountHolderType: r.account_holder_type,
        isDefault: Boolean(r.is_default),
        status: r.status,
        createdAt: r.created_at,
      }));
    }

    const providerReady = policy.card.providerReady || policy.ach.providerReady;

    return {
      success: true,
      data: {
        providerReady,
        providerStatus: providerReady ? "connected" : "setup_pending",
        cardProcessingAllowed: policy.card.retailerAllowed && policy.card.globalEnabled,
        achProcessingAllowed: policy.ach.retailerAllowed && policy.ach.globalEnabled,
        methods,
      },
    };
  } catch (err: any) {
    console.error("adminGetRetailerPaymentMethodsAction error:", err);
    return { success: false, error: err.message };
  }
}
