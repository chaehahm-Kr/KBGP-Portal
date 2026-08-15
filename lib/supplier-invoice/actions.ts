"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

// Role-based write permission validator
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

// Role-based approve permission validator
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

export interface InvoiceLineInput {
  purchase_order_line_id: string;
  product_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  invoiced_qty: number;
  unit_price: number;
  line_note?: string;
}

export interface CreateInvoiceInput {
  supplier_company_id: string;
  purchase_order_id: string;
  supplier_invoice_number: string;
  invoice_date: string;
  received_date: string;
  due_date: string;
  currency: string;
  payment_terms_snapshot?: string;
  incoterms_snapshot?: string;
  tax_amount?: number;
  other_charges?: number;
  internal_note?: string;
  attachment_path?: string;
  lines: InvoiceLineInput[];
}

export async function getEligiblePurchaseOrders() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      po_number,
      po_status,
      currency,
      payment_terms,
      incoterms,
      supplier_id,
      supplier:companies!supplier_id (id, name)
    `)
    .eq("po_status", "SENT")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPurchaseOrderForInvoice(poId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      po_number,
      currency,
      payment_terms,
      incoterms,
      supplier_id,
      supplier:companies!supplier_id (id, name),
      lines:purchase_order_lines (
        id,
        product_id,
        product_name_snapshot,
        qty,
        unit_cost,
        product:products!product_id (letusto_sku, manufacture_sku)
      )
    `)
    .eq("id", poId)
    .single();

  if (poErr || !po) throw new Error("Purchase Order not found.");

  // Fetch receiving lines to summarize received quantities
  const { data: recLines } = await supabase
    .from("receiving_lines")
    .select(`
      purchase_order_line_id,
      received_qty,
      hold_qty,
      damaged_qty,
      receiving:receivings!receiving_id (id, status)
    `);

  const recSummary: Record<string, { received: number; hold: number; damaged: number }> = {};
  po.lines.forEach((l: any) => {
    recSummary[l.id] = { received: 0, hold: 0, damaged: 0 };
  });

  if (recLines) {
    recLines.forEach((rl: any) => {
      if (rl.receiving?.status === "FINALIZED" && recSummary[rl.purchase_order_line_id]) {
        recSummary[rl.purchase_order_line_id].received += rl.received_qty || 0;
        recSummary[rl.purchase_order_line_id].hold += rl.hold_qty || 0;
        recSummary[rl.purchase_order_line_id].damaged += rl.damaged_qty || 0;
      }
    });
  }

  const lines = po.lines.map((l: any) => {
    const summary = recSummary[l.id] || { received: 0, hold: 0, damaged: 0 };
    return {
      ...l,
      resolved_qty: summary.received, // Good + Hold
      good_qty: summary.received - summary.hold,
      hold_qty: summary.hold,
      damaged_qty: summary.damaged,
    };
  });

  return {
    ...po,
    lines,
  };
}

export async function createInvoice(input: CreateInvoiceInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  // Validate duplicate invoice number for the same supplier
  const { data: existing } = await supabase
    .from("supplier_invoices")
    .select("id")
    .eq("supplier_company_id", input.supplier_company_id)
    .eq("supplier_invoice_number", input.supplier_invoice_number.trim())
    .maybeSingle();

  if (existing) {
    throw new Error(`이미 해당 공급업체에 대한 인보이스 번호(${input.supplier_invoice_number})가 존재합니다.`);
  }

  // Calculate totals
  let subtotal = 0;
  const linesToInsert = input.lines.map(line => {
    const lineAmount = Number((line.invoiced_qty * line.unit_price).toFixed(2));
    subtotal += lineAmount;
    return {
      purchase_order_line_id: line.purchase_order_line_id,
      product_id: line.product_id,
      sku_snapshot: line.sku_snapshot,
      product_name_snapshot: line.product_name_snapshot,
      invoiced_qty: line.invoiced_qty,
      unit_price: line.unit_price,
      line_amount: lineAmount,
      line_note: line.line_note || null,
    };
  });

  const tax = input.tax_amount || 0;
  const other = input.other_charges || 0;
  const total = Number((subtotal + tax + other).toFixed(2));

  // Insert invoice header
  const { data: inv, error: invErr } = await supabase
    .from("supplier_invoices")
    .insert({
      supplier_company_id: input.supplier_company_id,
      purchase_order_id: input.purchase_order_id,
      supplier_invoice_number: input.supplier_invoice_number.trim(),
      invoice_date: input.invoice_date,
      received_date: input.received_date,
      due_date: input.due_date,
      currency: input.currency,
      payment_terms_snapshot: input.payment_terms_snapshot || null,
      incoterms_snapshot: input.incoterms_snapshot || null,
      subtotal,
      tax_amount: tax,
      other_charges: other,
      invoice_total: total,
      amount_paid: 0.00,
      balance_due: total,
      invoice_status: "DRAFT",
      payment_status: "UNPAID",
      attachment_path: input.attachment_path || null,
      internal_note: input.internal_note || null,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (invErr || !inv) {
    throw new Error(`인보이스 생성 실패: ${invErr?.message}`);
  }

  // Insert invoice lines
  const linesData = linesToInsert.map(line => ({
    ...line,
    supplier_invoice_id: inv.id,
  }));

  const { error: linesErr } = await supabase
    .from("supplier_invoice_lines")
    .insert(linesData);

  if (linesErr) {
    // Rollback header if lines fail
    await supabase.from("supplier_invoices").delete().eq("id", inv.id);
    throw new Error(`인보이스 품목 등록 실패: ${linesErr.message}`);
  }

  revalidatePath("/admin/purchasing/invoices");
  return inv;
}

export async function updateInvoice(id: string, input: Partial<CreateInvoiceInput>) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: current } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_status, supplier_company_id")
    .eq("id", id)
    .single();

  if (!current) throw new Error("Invoice not found.");
  if (current.invoice_status !== "DRAFT" && current.invoice_status !== "REJECTED") {
    throw new Error("DRAFT 또는 REJECTED 상태인 인보이스만 수정할 수 있습니다.");
  }

  // Validate duplicate invoice number if changed
  if (input.supplier_invoice_number) {
    const { data: existing } = await supabase
      .from("supplier_invoices")
      .select("id")
      .eq("supplier_company_id", current.supplier_company_id)
      .eq("supplier_invoice_number", input.supplier_invoice_number.trim())
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      throw new Error(`이미 해당 공급업체에 대한 인보이스 번호(${input.supplier_invoice_number})가 존재합니다.`);
    }
  }

  // Calculate totals
  let updateData: any = {
    invoice_date: input.invoice_date,
    received_date: input.received_date,
    due_date: input.due_date,
    currency: input.currency,
    payment_terms_snapshot: input.payment_terms_snapshot,
    incoterms_snapshot: input.incoterms_snapshot,
    attachment_path: input.attachment_path,
    internal_note: input.internal_note,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.supplier_invoice_number) {
    updateData.supplier_invoice_number = input.supplier_invoice_number.trim();
  }

  if (input.lines) {
    let subtotal = 0;
    const linesToInsert = input.lines.map(line => {
      const lineAmount = Number((line.invoiced_qty * line.unit_price).toFixed(2));
      subtotal += lineAmount;
      return {
        supplier_invoice_id: id,
        purchase_order_line_id: line.purchase_order_line_id,
        product_id: line.product_id,
        sku_snapshot: line.sku_snapshot,
        product_name_snapshot: line.product_name_snapshot,
        invoiced_qty: line.invoiced_qty,
        unit_price: line.unit_price,
        line_amount: lineAmount,
        line_note: line.line_note || null,
      };
    });

    const tax = input.tax_amount ?? 0;
    const other = input.other_charges ?? 0;
    const total = Number((subtotal + tax + other).toFixed(2));

    updateData.subtotal = subtotal;
    updateData.tax_amount = tax;
    updateData.other_charges = other;
    updateData.invoice_total = total;
    updateData.balance_due = total;

    // Delete and replace lines
    await supabase.from("supplier_invoice_lines").delete().eq("supplier_invoice_id", id);
    const { error: linesErr } = await supabase
      .from("supplier_invoice_lines")
      .insert(linesToInsert);

    if (linesErr) throw new Error(`인보이스 품목 수정 실패: ${linesErr.message}`);
  }

  const { error: headerErr } = await supabase
    .from("supplier_invoices")
    .update(updateData)
    .eq("id", id);

  if (headerErr) throw new Error(`인보이스 헤더 수정 실패: ${headerErr.message}`);

  revalidatePath("/admin/purchasing/invoices");
  revalidatePath(`/admin/purchasing/invoices/${id}`);
  return { success: true };
}

export async function submitInvoice(id: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { error } = await supabase
    .from("supplier_invoices")
    .update({
      invoice_status: "SUBMITTED",
      submitted_at: new Date().toISOString(),
      submitted_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`인보이스 제출 실패: ${error.message}`);

  revalidatePath("/admin/purchasing/invoices");
  revalidatePath(`/admin/purchasing/invoices/${id}`);
  return { success: true };
}

export async function approveInvoice(id: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyApprovePermission(supabase, userId);

  const { error } = await supabase
    .from("supplier_invoices")
    .update({
      invoice_status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`인보이스 승인 실패: ${error.message}`);

  revalidatePath("/admin/purchasing/invoices");
  revalidatePath(`/admin/purchasing/invoices/${id}`);
  return { success: true };
}

export async function rejectInvoice(id: string, reason: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyApprovePermission(supabase, userId);

  if (!reason || reason.trim() === "") {
    throw new Error("반려 사유는 필수 입력 사항입니다.");
  }

  const { error } = await supabase
    .from("supplier_invoices")
    .update({
      invoice_status: "REJECTED",
      rejection_reason: reason.trim(),
      rejected_at: new Date().toISOString(),
      rejected_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`인보이스 반려 실패: ${error.message}`);

  revalidatePath("/admin/purchasing/invoices");
  revalidatePath(`/admin/purchasing/invoices/${id}`);
  return { success: true };
}

export async function voidInvoice(id: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { error } = await supabase
    .from("supplier_invoices")
    .update({
      invoice_status: "VOID",
      voided_at: new Date().toISOString(),
      voided_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`인보이스 무효화 실패: ${error.message}`);

  revalidatePath("/admin/purchasing/invoices");
  revalidatePath(`/admin/purchasing/invoices/${id}`);
  return { success: true };
}

export async function getSupplierRemittanceMasked(supplierId: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  
  // Check if current user is Super Admin
  const { data: userRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", userId);
    
  const isSuperAdmin = (userRoles ?? []).some((r: any) => r.role === "super_admin");

  const { data, error } = await supabase
    .from("supplier_remittances")
    .select("*")
    .eq("company_id", supplierId)
    .maybeSingle();

  if (error || !data) return null;

  if (isSuperAdmin) {
    return {
      ...data,
      is_masked: false
    };
  } else {
    // Mask raw bank details for other admins
    const mask = (str: string | null) => {
      if (!str) return "";
      if (str.length <= 4) return "****";
      return "****" + str.substring(str.length - 4);
    };
    return {
      company_id: data.company_id,
      bank_name: data.bank_name,
      beneficiary_name: data.beneficiary_name,
      account_number: mask(data.account_number),
      routing_number: mask(data.routing_number),
      swift_bic: mask(data.swift_bic),
      account_currency: data.account_currency,
      is_masked: true
    };
  }
}

export async function getSupplierInvoices() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("supplier_invoices")
    .select(`
      id,
      internal_ap_number,
      supplier_invoice_number,
      invoice_date,
      due_date,
      currency,
      invoice_total,
      amount_paid,
      balance_due,
      invoice_status,
      payment_status,
      supplier:companies!supplier_company_id (id, name),
      po:purchase_orders!purchase_order_id (id, po_number)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getSupplierInvoiceById(id: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: inv, error: invErr } = await supabase
    .from("supplier_invoices")
    .select(`
      id,
      internal_ap_number,
      supplier_invoice_number,
      invoice_date,
      received_date,
      due_date,
      currency,
      payment_terms_snapshot,
      incoterms_snapshot,
      subtotal,
      tax_amount,
      other_charges,
      invoice_total,
      amount_paid,
      balance_due,
      invoice_status,
      payment_status,
      attachment_path,
      internal_note,
      rejection_reason,
      submitted_at,
      submitted_by,
      approved_at,
      approved_by,
      rejected_at,
      rejected_by,
      voided_at,
      voided_by,
      created_at,
      created_by,
      updated_at,
      updated_by,
      supplier:companies!supplier_company_id (id, name),
      po:purchase_orders!purchase_order_id (id, po_number),
      lines:supplier_invoice_lines (
        id,
        purchase_order_line_id,
        product_id,
        sku_snapshot,
        product_name_snapshot,
        invoiced_qty,
        unit_price,
        line_amount,
        line_note
      ),
      creator:profiles!created_by (full_name),
      submitter:profiles!submitted_by (full_name),
      approver:profiles!approved_by (full_name),
      rejecter:profiles!rejected_by (full_name),
      voider:profiles!voided_by (full_name)
    `)
    .eq("id", id)
    .single();

  if (invErr || !inv) throw new Error("Invoice not found.");
  return inv;
}

export async function uploadInvoiceAttachment(formData: FormData) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {};
  }
  
  // Import dynamically to avoid server-side dependency issues on validate in other contexts
  const { validateUploadedFile } = await import("@/lib/files/validate");
  
  const validation = await validateUploadedFile(file, ["image", "document"]);
  if (!validation.ok) {
    throw new Error(`파일 검증 실패: ${validation.error}`);
  }
  
  let ext = "pdf";
  if (validation.detectedMime.startsWith("image/")) {
    ext = validation.detectedMime === "image/png" ? "png" : validation.detectedMime === "image/webp" ? "webp" : "jpg";
  }
  
  const path = `invoices/${crypto.randomUUID()}.${ext}`;
  
  const { error } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: validation.detectedMime, upsert: false });
    
  if (error) {
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }
  
  return { path };
}

export async function getInvoiceAttachmentUrl(path: string) {
  await verifyAdminSession();
  const { getSignedFileUrl } = await import("@/lib/files/storage");
  return await getSignedFileUrl(path);
}


