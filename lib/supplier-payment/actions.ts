"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

// Role-based write permission validator (from supplier-invoice actions)
async function verifyWritePermission(supabase: any, userId: string) {
  const { data: userRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", userId);

  const roles = (userRoles ?? []).map((r: any) => r.role);
  const isReadOnly = roles.length === 0 || (roles.length === 1 && roles[0] === "executive_viewer");
  if (isReadOnly) {
    throw new Error("권한이 없습니다. 일반 조회(Executive Viewer) 계정은 이 작업을 수행할 수 없습니다.");
  }
  return roles;
}

// Role-based approve permission validator (from supplier-invoice actions)
async function verifyApprovePermission(supabase: any, userId: string) {
  const { data: userRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", userId);

  const roles = (userRoles ?? []).map((r: any) => r.role);
  const canApprove = roles.some((role: any) => ["super_admin", "operations", "reviewer"].includes(role));
  if (!canApprove) {
    throw new Error("권한이 없습니다. 승인/반려 작업은 Super Admin, Operations, Reviewer 권한을 가진 계정만 가능합니다.");
  }
}

export interface CreatePaymentInput {
  supplier_invoice_id: string;
  payment_date: string;
  payment_amount: number;
  currency: string;
  payment_method: 'WIRE' | 'ACH' | 'CHECK' | 'OTHER';
  bank_reference?: string | null;
  remittance_reference?: string | null;
  internal_note?: string | null;
  attachment_path?: string | null;
}

// Authoritative Calculation: updates amount_paid, balance_due, and payment_status on the invoice
export async function recalculateInvoicePaymentStatus(supabase: any, invoiceId: string) {
  // 1. Fetch invoice info
  const { data: invoice, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_total, currency")
    .eq("id", invoiceId)
    .single();

  if (invErr || !invoice) throw new Error("Invoice not found during recalculation.");

  // 2. Fetch approved adjustments to get Final Payable
  const { data: adjs } = await supabase
    .from("supplier_invoice_adjustments")
    .select("adjustment_amount, adjustment_direction")
    .eq("supplier_invoice_id", invoiceId)
    .eq("status", "APPROVED");

  let credits = 0;
  let charges = 0;
  (adjs ?? []).forEach((a: any) => {
    if (a.adjustment_direction === 'CREDIT') credits += Number(a.adjustment_amount);
    else charges += Number(a.adjustment_amount);
  });

  const finalPayable = Number((Number(invoice.invoice_total) + charges - credits).toFixed(2));

  // 3. Sum completed payments
  const { data: pmts } = await supabase
    .from("supplier_payments")
    .select("payment_amount")
    .eq("supplier_invoice_id", invoiceId)
    .eq("status", "COMPLETED");

  const amountPaid = (pmts ?? []).reduce((sum: number, p: any) => sum + Number(p.payment_amount), 0);
  const formattedAmountPaid = Number(amountPaid.toFixed(2));

  const balanceDue = Math.max(Number((finalPayable - formattedAmountPaid).toFixed(2)), 0);

  // Determine Payment Status
  let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
  if (formattedAmountPaid === 0) {
    paymentStatus = 'UNPAID';
  } else if (formattedAmountPaid < finalPayable) {
    paymentStatus = 'PARTIALLY_PAID';
  } else {
    paymentStatus = 'PAID';
  }

  // 4. Update invoice
  const { error: updateErr } = await supabase
    .from("supplier_invoices")
    .update({
      amount_paid: formattedAmountPaid,
      balance_due: balanceDue,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (updateErr) throw new Error(`Invoice payment update failed: ${updateErr.message}`);
}

export async function getSupplierPayments() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("supplier_payments")
    .select(`
      id,
      payment_number,
      supplier_invoice_id,
      payment_date,
      payment_amount,
      currency,
      payment_method,
      status,
      invoice:supplier_invoices!supplier_invoice_id (
        id,
        internal_ap_number,
        supplier_invoice_number,
        supplier:companies!supplier_company_id (name)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getSupplierPaymentById(id: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("supplier_payments")
    .select(`
      *,
      invoice:supplier_invoices!supplier_invoice_id (
        id,
        internal_ap_number,
        supplier_invoice_number,
        invoice_total,
        amount_paid,
        balance_due,
        invoice_status,
        payment_status,
        settlement_status,
        currency,
        supplier:companies!supplier_company_id (id, name),
        po:purchase_orders!purchase_order_id (id, po_number),
        adjustments:supplier_invoice_adjustments (
          adjustment_amount,
          adjustment_direction,
          status
        )
      ),
      creator:profiles!created_by (full_name),
      completer:profiles!completed_by (full_name),
      voider:profiles!voided_by (full_name)
    `)
    .eq("id", id)
    .single();

  if (error || !data) throw new Error("Payment record not found.");
  return data;
}

export async function createPayment(input: CreatePaymentInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  // 1. Validate payment amount
  if (Number(input.payment_amount) <= 0) {
    throw new Error("지급 금액은 0보다 커야 합니다.");
  }

  // 2. Fetch invoice and validate eligibility
  const { data: invoice, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_status, settlement_status, currency, supplier_company_id")
    .eq("id", input.supplier_invoice_id)
    .single();

  if (invErr || !invoice) throw new Error("대상 인보이스를 찾을 수 없습니다.");
  if (invoice.invoice_status !== "APPROVED") {
    throw new Error("승인(APPROVED) 상태인 인보이스에 대해서만 대금 지급을 등록할 수 있습니다.");
  }
  if (invoice.settlement_status !== "SETTLED") {
    throw new Error("정산 종결(SETTLED) 상태인 인보이스에 대해서만 대금 지급을 등록할 수 있습니다.");
  }
  if (invoice.currency !== input.currency) {
    throw new Error(`인보이스 통화(${invoice.currency})와 지급 통화(${input.currency})가 일치해야 합니다.`);
  }

  // 3. Load Remittance Bank Details for historical snapshot
  const { data: remittance } = await supabase
    .from("supplier_remittances")
    .select("*")
    .eq("company_id", invoice.supplier_company_id)
    .maybeSingle();

  const mask = (str: string | null) => {
    if (!str) return "";
    if (str.length <= 4) return "****";
    return "****" + str.substring(str.length - 4);
  };

  const bankName = remittance?.bank_name || null;
  const beneficiaryName = remittance?.beneficiary_name || null;
  const accountLast4 = remittance?.account_number ? remittance.account_number.substring(Math.max(0, remittance.account_number.length - 4)) : null;
  const swiftBicMasked = remittance?.swift_bic ? mask(remittance.swift_bic) : null;

  // 4. Insert Payment record as DRAFT
  const { data: payment, error: pmtErr } = await supabase
    .from("supplier_payments")
    .insert({
      supplier_invoice_id: input.supplier_invoice_id,
      supplier_remittance_id: remittance?.company_id || null,
      payment_date: input.payment_date,
      payment_amount: Number(input.payment_amount),
      currency: input.currency,
      payment_method: input.payment_method,
      bank_reference: input.bank_reference || null,
      remittance_reference: input.remittance_reference || null,
      internal_note: input.internal_note || null,
      attachment_path: input.attachment_path || null,
      status: "DRAFT",
      
      remittance_bank_name: bankName,
      remittance_beneficiary_name: beneficiaryName,
      remittance_account_last4: accountLast4,
      remittance_swift_bic_masked: swiftBicMasked,
      
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (pmtErr || !payment) {
    throw new Error(`지급 등록 실패: ${pmtErr?.message}`);
  }

  revalidatePath("/admin/finance/payments");
  revalidatePath(`/admin/finance/invoices/${input.supplier_invoice_id}`);
  return payment;
}

export async function updatePayment(id: string, input: Partial<CreatePaymentInput>) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: pmt, error: pmtErr } = await supabase
    .from("supplier_payments")
    .select("id, status, supplier_invoice_id")
    .eq("id", id)
    .single();

  if (pmtErr || !pmt) throw new Error("지급 내역을 찾을 수 없습니다.");
  if (pmt.status !== "DRAFT") {
    throw new Error("초안(DRAFT) 상태인 지급 내역만 수정할 수 있습니다.");
  }

  const { error: updateErr } = await supabase
    .from("supplier_payments")
    .update({
      payment_date: input.payment_date,
      payment_amount: input.payment_amount !== undefined ? Number(input.payment_amount) : undefined,
      payment_method: input.payment_method,
      bank_reference: input.bank_reference,
      remittance_reference: input.remittance_reference,
      internal_note: input.internal_note,
      attachment_path: input.attachment_path,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) throw new Error(`지급 내역 수정 실패: ${updateErr.message}`);

  revalidatePath("/admin/finance/payments");
  revalidatePath(`/admin/finance/payments/${id}`);
  revalidatePath(`/admin/finance/invoices/${pmt.supplier_invoice_id}`);
  return { success: true };
}

export async function transitionPaymentStatus(id: string, newStatus: 'COMPLETED' | 'VOID') {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: pmt, error: pmtErr } = await supabase
    .from("supplier_payments")
    .select("id, status, supplier_invoice_id")
    .eq("id", id)
    .single();

  if (pmtErr || !pmt) throw new Error("지급 내역을 찾을 수 없습니다.");
  
  // Transition check validations
  if (pmt.status === "VOID") {
    throw new Error("이미 무효화(VOID) 처리된 지급 내역은 상태를 변경할 수 없습니다.");
  }
  if (newStatus === "COMPLETED" && pmt.status !== "DRAFT") {
    throw new Error("DRAFT 상태인 지급 항목만 COMPLETED 처리할 수 있습니다.");
  }

  const updateFields: any = {
    status: newStatus,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "COMPLETED") {
    await verifyApprovePermission(supabase, userId);
    updateFields.completed_at = new Date().toISOString();
    updateFields.completed_by = userId;
  } else if (newStatus === "VOID") {
    await verifyWritePermission(supabase, userId);
    updateFields.voided_at = new Date().toISOString();
    updateFields.voided_by = userId;
  }

  const { error: transitionErr } = await supabase
    .from("supplier_payments")
    .update(updateFields)
    .eq("id", id);

  if (transitionErr) throw new Error(`지급 상태 변경 실패: ${transitionErr.message}`);

  // Recalculate invoice totals based on completed payments
  await recalculateInvoicePaymentStatus(supabase, pmt.supplier_invoice_id);

  revalidatePath("/admin/finance/payments");
  revalidatePath(`/admin/finance/payments/${id}`);
  revalidatePath(`/admin/finance/invoices/${pmt.supplier_invoice_id}`);
  return { success: true };
}

export async function deleteDraftPayment(id: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: pmt, error: pmtErr } = await supabase
    .from("supplier_payments")
    .select("id, status, supplier_invoice_id")
    .eq("id", id)
    .single();

  if (pmtErr || !pmt) throw new Error("지급 내역을 찾을 수 없습니다.");
  if (pmt.status !== "DRAFT") {
    throw new Error("초안(DRAFT) 상태인 지급 항목만 삭제할 수 있습니다.");
  }

  const { error: deleteErr } = await supabase
    .from("supplier_payments")
    .delete()
    .eq("id", id);

  if (deleteErr) throw new Error(`지급 항목 삭제 실패: ${deleteErr.message}`);

  revalidatePath("/admin/finance/payments");
  revalidatePath(`/admin/finance/invoices/${pmt.supplier_invoice_id}`);
  return { success: true };
}

export async function getEligibleInvoicesForPayment() {
  await verifyAdminSession();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_invoices")
    .select("id, internal_ap_number, supplier_invoice_number, currency, invoice_total, amount_paid, balance_due, supplier:companies!supplier_company_id (name)")
    .eq("invoice_status", "APPROVED")
    .eq("settlement_status", "SETTLED");
      
  if (error) throw error;
    
  const formattedInvoices = [];
  for (const inv of (data ?? [])) {
    const { data: adjs } = await supabase
      .from("supplier_invoice_adjustments")
      .select("adjustment_amount, adjustment_direction")
      .eq("supplier_invoice_id", inv.id)
      .eq("status", "APPROVED");
        
    let credits = 0;
    let charges = 0;
    (adjs ?? []).forEach((a: any) => {
      if (a.adjustment_direction === 'CREDIT') credits += Number(a.adjustment_amount);
      else charges += Number(a.adjustment_amount);
    });
      
    const finalPayable = Number(inv.invoice_total) + charges - credits;
    const balanceDue = Math.max(finalPayable - Number(inv.amount_paid), 0);
      
    const supplierObj: any = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier;
    formattedInvoices.push({
      id: inv.id,
      internal_ap_number: inv.internal_ap_number,
      supplier_invoice_number: inv.supplier_invoice_number,
      currency: inv.currency,
      invoice_total: Number(inv.invoice_total),
      amount_paid: Number(inv.amount_paid),
      balance_due: balanceDue,
      supplier_name: supplierObj?.name || "(미지정)",
      final_payable: finalPayable
    });
  }
  return formattedInvoices;
}
