"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEasternTodayString, formatEasternDate } from "@/lib/utils/timezone";

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

// Helper to normalize payment method string to valid DB constraint values ('WIRE', 'ACH', 'CHECK', 'OTHER')
export async function normalizePaymentMethod(method?: string | null): Promise<'WIRE' | 'ACH' | 'CHECK' | 'OTHER'> {
  if (!method) return 'WIRE';
  const upper = method.trim().toUpperCase();
  if (upper.includes('WIRE') || upper.includes('송금') || upper.includes('TT') || upper.includes('BANK')) return 'WIRE';
  if (upper.includes('ACH')) return 'ACH';
  if (upper.includes('CHECK') || upper.includes('수표')) return 'CHECK';
  if (['WIRE', 'ACH', 'CHECK', 'OTHER'].includes(upper)) return upper as any;
  return 'OTHER';
}

// Authoritative Calculation: updates invoice_total, amount_paid, balance_due, and payment_status on the invoice
export async function recalculateInvoicePaymentStatus(supabase: any, invoiceId: string) {
  // 1. Fetch invoice info
  const { data: invoice, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, subtotal, tax_amount, other_charges, currency")
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

  const baseInvoiceAmount = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax_amount || 0);
  const other = Number(invoice.other_charges || 0);
  const finalPayable = Number((baseInvoiceAmount + tax + other + charges - credits).toFixed(2));

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
  } else if (formattedAmountPaid < finalPayable - 0.001) {
    paymentStatus = 'PARTIALLY_PAID';
  } else {
    paymentStatus = 'PAID';
  }

  // 4. Update invoice
  const { error: updateErr } = await supabase
    .from("supplier_invoices")
    .update({
      invoice_total: finalPayable,
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
      creator:profiles!created_by (full_name:display_name),
      completer:profiles!completed_by (full_name:display_name),
      voider:profiles!voided_by (full_name:display_name)
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

export interface RecordInvoicePaymentInput {
  supplier_invoice_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: 'WIRE' | 'ACH' | 'CHECK' | 'OTHER';
  bank_reference?: string | null;
  remittance_reference?: string | null;
  internal_note?: string | null;
  attachment_path?: string | null;
}

/**
 * Authoritative Canonical Action: Records an executed payment directly from Invoice Detail.
 * Immediately registers as COMPLETED, recalculates invoice balance and payment status,
 * and tracks audit trail (creator, completer, timestamps).
 */
export async function recordInvoicePayment(input: RecordInvoicePaymentInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const amount = Number(input.payment_amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("지급 금액은 0보다 커야 합니다.");
  }

  // 1. Fetch invoice
  const { data: invoice, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_status, settlement_status, currency, supplier_company_id, subtotal, tax_amount, other_charges")
    .eq("id", input.supplier_invoice_id)
    .single();

  if (invErr || !invoice) throw new Error("대상 인보이스를 찾을 수 없습니다.");
  if (invoice.invoice_status !== "APPROVED") {
    throw new Error("승인(APPROVED) 완료된 인보이스에 대해서만 대금 지급을 등록할 수 있습니다.");
  }

  // 2. Compute authoritative Final Payable & current remaining balance
  const { data: adjs } = await supabase
    .from("supplier_invoice_adjustments")
    .select("adjustment_amount, adjustment_direction")
    .eq("supplier_invoice_id", input.supplier_invoice_id)
    .eq("status", "APPROVED");

  let credits = 0;
  let charges = 0;
  (adjs ?? []).forEach((a: any) => {
    if (a.adjustment_direction === 'CREDIT') credits += Number(a.adjustment_amount);
    else charges += Number(a.adjustment_amount);
  });

  const baseInvoiceAmount = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax_amount || 0);
  const other = Number(invoice.other_charges || 0);
  const finalPayable = Number((baseInvoiceAmount + tax + other + charges - credits).toFixed(2));

  // 3. Sum existing completed payments
  const { data: pmts } = await supabase
    .from("supplier_payments")
    .select("payment_amount")
    .eq("supplier_invoice_id", input.supplier_invoice_id)
    .eq("status", "COMPLETED");

  const totalPaidSoFar = (pmts ?? []).reduce((sum: number, p: any) => sum + Number(p.payment_amount), 0);
  const remainingBalance = Math.max(Number((finalPayable - totalPaidSoFar).toFixed(2)), 0);

  // Validate amount does not exceed remaining balance
  if (amount > remainingBalance + 0.001) {
    throw new Error(`지급 금액(${invoice.currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })})은 남은 미지급 잔액(${invoice.currency} ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})을 초과할 수 없습니다.`);
  }

  // 4. Load Remittance Bank Details for historical snapshot
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

  // 5. Insert completed payment directly
  const now = new Date().toISOString();
  const { data: payment, error: pmtErr } = await supabase
    .from("supplier_payments")
    .insert({
      supplier_invoice_id: input.supplier_invoice_id,
      supplier_remittance_id: remittance?.company_id || null,
      payment_date: input.payment_date || getEasternTodayString(),
      payment_amount: amount,
      currency: invoice.currency,
      payment_method: await normalizePaymentMethod(input.payment_method),
      bank_reference: input.bank_reference?.trim() || null,
      remittance_reference: input.remittance_reference?.trim() || null,
      internal_note: input.internal_note?.trim() || null,
      attachment_path: input.attachment_path || null,
      status: "COMPLETED",
      completed_at: now,
      completed_by: userId,
      created_by: userId,
      updated_by: userId,
      remittance_bank_name: bankName,
      remittance_beneficiary_name: beneficiaryName,
      remittance_account_last4: accountLast4,
      remittance_swift_bic_masked: swiftBicMasked,
    })
    .select()
    .single();

  if (pmtErr || !payment) {
    throw new Error(`지급 등록 실패: ${pmtErr?.message}`);
  }

  // 6. Recalculate invoice payment status
  await recalculateInvoicePaymentStatus(supabase, input.supplier_invoice_id);

  revalidatePath("/admin/finance/payments");
  revalidatePath(`/admin/finance/invoices/${input.supplier_invoice_id}`);
  revalidatePath("/admin/finance/invoices");
  revalidatePath("/portal/finance");
  revalidatePath(`/portal/finance/${input.supplier_invoice_id}`);

  return { success: true, payment };
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
    .eq("invoice_status", "APPROVED");
      
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

export interface PaymentDashboardKPIs {
  dueTodayCount: number;
  dueTodayAmount: number;
  dueThisWeekCount: number;
  dueThisWeekAmount: number;
  dueNext30DaysCount: number;
  dueNext30DaysAmount: number;
  overdueCount: number;
  overdueAmount: number;
  totalOutstandingAmount: number;
  paidThisMonthAmount: number;
}

export interface PaymentScheduleItem {
  id: string;
  internal_ap_number: string;
  supplier_invoice_number: string;
  supplier_company_id: string;
  supplier_name: string;
  po_number?: string | null;
  due_date: string;
  currency: string;
  subtotal: number;
  final_payable: number;
  amount_paid: number;
  balance_due: number;
  payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  settlement_status: string;
  invoice_status: string;
  d_day_label: string;
  is_overdue: boolean;
}

export interface PaymentHistoryItem {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_amount: number;
  currency: string;
  payment_method: string;
  bank_reference: string | null;
  remittance_reference: string | null;
  status: string;
  attachment_path: string | null;
  attachment_url?: string | null;
  internal_note: string | null;
  created_at: string;
  creator_name?: string | null;
  supplier_name: string;
  invoice_id: string;
  internal_ap_number: string;
  supplier_invoice_number: string;
}

/**
 * Loads consolidated data for the Finance > Payments Dashboard:
 * - Real-time KPI summaries (Due Today, This Week, Next 30 Days, Overdue, Outstanding, Paid This Month)
 * - Complete Upcoming & Outstanding payment schedule across all approved invoices
 * - Historical ledger of all executed payments
 */
export async function getPaymentsDashboardData(): Promise<{
  kpis: PaymentDashboardKPIs;
  schedule: PaymentScheduleItem[];
  history: PaymentHistoryItem[];
}> {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const todayStr = getEasternTodayString();
  const todayDate = new Date(todayStr + "T00:00:00Z");

  const addDays = (d: Date, days: number) => {
    const copy = new Date(d);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy.toISOString().split("T")[0];
  };

  const next7DaysStr = addDays(todayDate, 7);
  const next30DaysStr = addDays(todayDate, 30);
  const firstDayOfMonthStr = todayStr.slice(0, 7) + "-01";

  // 1. Fetch all approved invoices with adjustments, supplier and PO
  const { data: rawInvoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select(`
      id,
      internal_ap_number,
      supplier_invoice_number,
      supplier_company_id,
      purchase_order_id,
      invoice_date,
      due_date,
      currency,
      subtotal,
      invoice_total,
      amount_paid,
      balance_due,
      payment_status,
      settlement_status,
      invoice_status,
      supplier:companies!supplier_company_id (name),
      po:purchase_orders!purchase_order_id (po_number),
      adjustments:supplier_invoice_adjustments (
        adjustment_amount,
        adjustment_direction,
        status
      )
    `)
    .eq("invoice_status", "APPROVED")
    .order("due_date", { ascending: true });

  if (invErr) {
    console.error("Failed to fetch invoices for payment dashboard:", invErr);
  }

  // 2. Fetch all payments from supplier_payments
  const { data: rawPayments, error: pmtErr } = await supabase
    .from("supplier_payments")
    .select(`
      id,
      payment_number,
      supplier_invoice_id,
      payment_date,
      payment_amount,
      currency,
      payment_method,
      bank_reference,
      remittance_reference,
      internal_note,
      attachment_path,
      status,
      created_at,
      creator:profiles!created_by (display_name),
      invoice:supplier_invoices!supplier_invoice_id (
        id,
        internal_ap_number,
        supplier_invoice_number,
        supplier:companies!supplier_company_id (name)
      )
    `)
    .order("payment_date", { ascending: false });

  if (pmtErr) {
    console.error("Failed to fetch payments for dashboard:", pmtErr);
  }

  // KPI aggregations
  let dueTodayCount = 0;
  let dueTodayAmount = 0;
  let dueThisWeekCount = 0;
  let dueThisWeekAmount = 0;
  let dueNext30DaysCount = 0;
  let dueNext30DaysAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let totalOutstandingAmount = 0;
  let paidThisMonthAmount = 0;

  const schedule: PaymentScheduleItem[] = [];

  (rawInvoices || []).forEach((inv: any) => {
    let credits = 0;
    let charges = 0;
    (inv.adjustments || []).forEach((a: any) => {
      if (a.status === "APPROVED") {
        if (a.adjustment_direction === "CREDIT") credits += Number(a.adjustment_amount);
        else charges += Number(a.adjustment_amount);
      }
    });

    const finalPayable = Number((Number(inv.invoice_total) + charges - credits).toFixed(2));
    const paidAmount = Number(Number(inv.amount_paid || 0).toFixed(2));
    const balanceDue = Math.max(Number((finalPayable - paidAmount).toFixed(2)), 0);

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
    if (paidAmount === 0) paymentStatus = 'UNPAID';
    else if (paidAmount < finalPayable) paymentStatus = 'PARTIALLY_PAID';
    else paymentStatus = 'PAID';

    const dueDate = inv.due_date || "";
    let dDayLabel = "-";
    let isOverdue = false;

    if (dueDate) {
      if (dueDate === todayStr) {
        dDayLabel = "오늘 만기 (D-Day)";
      } else if (dueDate > todayStr) {
        const diffMs = new Date(dueDate + "T00:00:00Z").getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        dDayLabel = `D-${diffDays}`;
      } else {
        const diffMs = todayDate.getTime() - new Date(dueDate + "T00:00:00Z").getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        dDayLabel = `연체 D+${diffDays}`;
        isOverdue = true;
      }
    }

    // Accumulate KPIs if balance > 0
    if (balanceDue > 0) {
      totalOutstandingAmount += balanceDue;

      if (dueDate === todayStr) {
        dueTodayCount++;
        dueTodayAmount += balanceDue;
      }
      if (dueDate >= todayStr && dueDate <= next7DaysStr) {
        dueThisWeekCount++;
        dueThisWeekAmount += balanceDue;
      }
      if (dueDate >= todayStr && dueDate <= next30DaysStr) {
        dueNext30DaysCount++;
        dueNext30DaysAmount += balanceDue;
      }
      if (dueDate < todayStr && dueDate !== "") {
        overdueCount++;
        overdueAmount += balanceDue;
      }
    }

    const supplierObj: any = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier;
    const poObj: any = Array.isArray(inv.po) ? inv.po[0] : inv.po;

    schedule.push({
      id: inv.id,
      internal_ap_number: inv.internal_ap_number,
      supplier_invoice_number: inv.supplier_invoice_number,
      supplier_company_id: inv.supplier_company_id,
      supplier_name: supplierObj?.name || "-",
      po_number: poObj?.po_number || null,
      due_date: dueDate,
      currency: inv.currency || "USD",
      subtotal: Number(inv.subtotal || 0),
      final_payable: finalPayable,
      amount_paid: paidAmount,
      balance_due: balanceDue,
      payment_status: paymentStatus,
      settlement_status: inv.settlement_status || "OPEN",
      invoice_status: inv.invoice_status,
      d_day_label: dDayLabel,
      is_overdue: isOverdue,
    });
  });

  const history: PaymentHistoryItem[] = [];

  (rawPayments || []).forEach((p: any) => {
    const pmtAmount = Number(p.payment_amount || 0);
    if (p.status === "COMPLETED") {
      if (p.payment_date >= firstDayOfMonthStr) {
        paidThisMonthAmount += pmtAmount;
      }
    }

    const invObj: any = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
    const suppObj: any = invObj ? (Array.isArray(invObj.supplier) ? invObj.supplier[0] : invObj.supplier) : null;
    const creatorObj: any = Array.isArray(p.creator) ? p.creator[0] : p.creator;

    history.push({
      id: p.id,
      payment_number: p.payment_number,
      payment_date: p.payment_date,
      payment_amount: pmtAmount,
      currency: p.currency || "USD",
      payment_method: p.payment_method,
      bank_reference: p.bank_reference || null,
      remittance_reference: p.remittance_reference || null,
      status: p.status,
      attachment_path: p.attachment_path || null,
      internal_note: p.internal_note || null,
      created_at: p.created_at,
      creator_name: creatorObj?.display_name || null,
      supplier_name: suppObj?.name || "-",
      invoice_id: p.supplier_invoice_id,
      internal_ap_number: invObj?.internal_ap_number || "-",
      supplier_invoice_number: invObj?.supplier_invoice_number || "-",
    });
  });

  const kpis: PaymentDashboardKPIs = {
    dueTodayCount,
    dueTodayAmount: Number(dueTodayAmount.toFixed(2)),
    dueThisWeekCount,
    dueThisWeekAmount: Number(dueThisWeekAmount.toFixed(2)),
    dueNext30DaysCount,
    dueNext30DaysAmount: Number(dueNext30DaysAmount.toFixed(2)),
    overdueCount,
    overdueAmount: Number(overdueAmount.toFixed(2)),
    totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
    paidThisMonthAmount: Number(paidThisMonthAmount.toFixed(2)),
  };

  return {
    kpis,
    schedule,
    history,
  };
}
