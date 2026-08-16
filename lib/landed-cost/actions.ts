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
    throw new Error("권한이 없습니다. 이 작업은 Super Admin, Operations, Reviewer 권한을 가진 계정만 가능합니다.");
  }
}

export interface CreateCaseInput {
  shipment_ids: string[];
  description?: string;
  internal_note?: string;
}

export interface ExpenseInput {
  cost_type: 'OCEAN_FREIGHT' | 'AIR_FREIGHT' | 'DUTY' | 'CUSTOMS_BROKER' | 'PORT_TERMINAL' | 'TRUCKING' | 'DOMESTIC_FREIGHT' | 'INSURANCE' | 'INSPECTION' | 'STORAGE_DEMURRAGE' | 'OTHER';
  vendor_company_id?: string | null;
  description?: string | null;
  currency: string;
  estimated_amount: number;
  actual_amount?: number | null;
  fx_rate_to_base: number;
  allocation_method: 'CBM' | 'WEIGHT' | 'VALUE' | 'DIRECT' | 'MANUAL';
  invoice_reference?: string | null;
  invoice_date?: string | null;
  attachment_path?: string | null;
  internal_note?: string | null;
}

export async function getLandedCostCases() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("landed_cost_cases")
    .select(`
      id,
      landed_cost_number,
      status,
      description,
      created_at,
      shipments:landed_cost_case_shipments (
        inbound_shipment_id,
        shipment:inbound_shipments (shipment_number)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getLandedCostCaseById(id: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("landed_cost_cases")
    .select(`
      *,
      creator:profiles!created_by (full_name),
      finalizer:profiles!finalized_by (full_name),
      reopener:profiles!reopened_by (full_name),
      shipments:landed_cost_case_shipments (
        inbound_shipment_id,
        shipment:inbound_shipments (
          id,
          shipment_number,
          purchase_order_id,
          status,
          po:purchase_orders (po_number)
        )
      ),
      expenses:landed_cost_expenses (
        *,
        vendor:companies!vendor_company_id (name),
        allocations:landed_cost_allocations (*)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) throw new Error("Landed Cost Case not found.");
  return data;
}

export async function createLandedCostCase(input: CreateCaseInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  if (!input.shipment_ids || input.shipment_ids.length === 0) {
    throw new Error("최소 하나 이상의 선적(Shipment)을 선택해야 합니다.");
  }

  // 1. Insert header
  const { data: lcCase, error: caseErr } = await supabase
    .from("landed_cost_cases")
    .insert({
      description: input.description || null,
      internal_note: input.internal_note || null,
      status: "OPEN",
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (caseErr || !lcCase) {
    throw new Error(`Landed Cost Case 생성 실패: ${caseErr?.message}`);
  }

  // 2. Map shipments
  const shipmentData = input.shipment_ids.map(sid => ({
    landed_cost_case_id: lcCase.id,
    inbound_shipment_id: sid
  }));

  const { error: shipErr } = await supabase
    .from("landed_cost_case_shipments")
    .insert(shipmentData);

  if (shipErr) {
    // Cleanup case header
    await supabase.from("landed_cost_cases").delete().eq("id", lcCase.id);
    throw new Error(`선적 매핑 실패 (선적이 이미 다른 활성 케이스에 포함되어 있을 수 있습니다): ${shipErr.message}`);
  }

  revalidatePath("/admin/finance/landed-cost");
  return lcCase;
}

export async function updateLandedCostCase(id: string, input: Partial<CreateCaseInput>) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: lcCase } = await supabase
    .from("landed_cost_cases")
    .select("status")
    .eq("id", id)
    .single();

  if (!lcCase) throw new Error("Case not found.");
  if (lcCase.status === "FINALIZED") {
    throw new Error("확정(FINALIZED) 상태의 케이스는 수정할 수 없습니다.");
  }

  const { error } = await supabase
    .from("landed_cost_cases")
    .update({
      description: input.description,
      internal_note: input.internal_note,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
  revalidatePath(`/admin/finance/landed-cost/${id}`);
  return { success: true };
}

export async function addExpense(caseId: string, input: ExpenseInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: lcCase } = await supabase
    .from("landed_cost_cases")
    .select("status")
    .eq("id", caseId)
    .single();

  if (!lcCase) throw new Error("Case not found.");
  if (lcCase.status === "FINALIZED") {
    throw new Error("확정(FINALIZED) 상태의 케이스에는 비용을 추가할 수 없습니다.");
  }

  const est = Number(input.estimated_amount);
  const act = input.actual_amount !== undefined && input.actual_amount !== null ? Number(input.actual_amount) : null;
  const rate = Number(input.fx_rate_to_base);
  
  // Rule: open case uses actual amount if exists, otherwise estimated
  const amt = act !== null ? act : est;
  const baseCurrencyAmount = Number((amt * rate).toFixed(2));

  const { data: expense, error: expErr } = await supabase
    .from("landed_cost_expenses")
    .insert({
      landed_cost_case_id: caseId,
      cost_type: input.cost_type,
      vendor_company_id: input.vendor_company_id || null,
      description: input.description || null,
      currency: input.currency,
      estimated_amount: est,
      actual_amount: act,
      fx_rate_to_base: rate,
      base_currency_amount: baseCurrencyAmount,
      allocation_method: input.allocation_method,
      invoice_reference: input.invoice_reference || null,
      invoice_date: input.invoice_date || null,
      attachment_path: input.attachment_path || null,
      internal_note: input.internal_note || null,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (expErr || !expense) {
    throw new Error(`비용 추가 실패: ${expErr?.message}`);
  }

  // Trigger auto allocation
  try {
    await autoAllocateExpense(expense.id);
  } catch (allocErr) {
    console.error("Auto allocation during expense creation failed:", allocErr);
  }

  revalidatePath(`/admin/finance/landed-cost/${caseId}`);
  return expense;
}

export async function updateExpense(expenseId: string, input: Partial<ExpenseInput>) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: expense } = await supabase
    .from("landed_cost_expenses")
    .select("*, case:landed_cost_cases(status)")
    .eq("id", expenseId)
    .single();

  if (!expense) throw new Error("Expense not found.");
  if ((expense.case as any).status === "FINALIZED") {
    throw new Error("확정(FINALIZED) 상태의 케이스 비용은 수정할 수 없습니다.");
  }

  const est = input.estimated_amount !== undefined ? Number(input.estimated_amount) : Number(expense.estimated_amount);
  const act = input.actual_amount !== undefined ? (input.actual_amount !== null ? Number(input.actual_amount) : null) : (expense.actual_amount !== null ? Number(expense.actual_amount) : null);
  const rate = input.fx_rate_to_base !== undefined ? Number(input.fx_rate_to_base) : Number(expense.fx_rate_to_base);

  const amt = act !== null ? act : est;
  const baseCurrencyAmount = Number((amt * rate).toFixed(2));

  const { error } = await supabase
    .from("landed_cost_expenses")
    .update({
      cost_type: input.cost_type,
      vendor_company_id: input.vendor_company_id,
      description: input.description,
      currency: input.currency,
      estimated_amount: est,
      actual_amount: act,
      fx_rate_to_base: rate,
      base_currency_amount: baseCurrencyAmount,
      allocation_method: input.allocation_method,
      invoice_reference: input.invoice_reference,
      invoice_date: input.invoice_date,
      attachment_path: input.attachment_path,
      internal_note: input.internal_note,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId);

  if (error) throw error;

  // Recalculate allocations
  await autoAllocateExpense(expenseId);

  revalidatePath(`/admin/finance/landed-cost/${expense.landed_cost_case_id}`);
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: expense } = await supabase
    .from("landed_cost_expenses")
    .select("*, case:landed_cost_cases(status)")
    .eq("id", expenseId)
    .single();

  if (!expense) throw new Error("Expense not found.");
  if ((expense.case as any).status === "FINALIZED") {
    throw new Error("확정(FINALIZED) 상태의 케이스 비용은 삭제할 수 없습니다.");
  }

  const { error } = await supabase
    .from("landed_cost_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) throw error;

  revalidatePath(`/admin/finance/landed-cost/${expense.landed_cost_case_id}`);
  return { success: true };
}

// Fetch helper to get settled line acquisition value or PO fallback cost
async function getLineAcquisitionValue(supabase: any, rl: any): Promise<number> {
  // 1. Fetch PO Line cost
  const { data: poLine } = await supabase
    .from("purchase_order_lines")
    .select("unit_cost")
    .eq("id", rl.purchase_order_line_id)
    .single();

  const poCost = poLine ? Number(poLine.unit_cost) : 0;
  const fallbackTotal = Number((rl.received_qty * poCost).toFixed(2));

  // 2. Fetch invoice lines matching this PO Line
  const { data: invLines } = await supabase
    .from("supplier_invoice_lines")
    .select("id, unit_price, invoiced_qty, supplier_invoice_id")
    .eq("purchase_order_line_id", rl.purchase_order_line_id);

  if (!invLines || invLines.length === 0) {
    return fallbackTotal;
  }

  // Filter only invoice lines belonging to APPROVED invoices
  const approvedInvLines = [];
  for (const il of invLines) {
    const { data: inv } = await supabase
      .from("supplier_invoices")
      .select("id")
      .eq("id", il.supplier_invoice_id)
      .eq("invoice_status", "APPROVED")
      .maybeSingle();

    if (inv) approvedInvLines.push(il);
  }

  if (approvedInvLines.length === 0) {
    return fallbackTotal;
  }

  let totalAcquisitionValue = 0;

  for (const il of approvedInvLines) {
    const lineAmount = Number((il.invoiced_qty * Number(il.unit_price)).toFixed(2));

    // Get all line-level approved adjustments
    const { data: lineAdjs } = await supabase
      .from("supplier_invoice_adjustments")
      .select("adjustment_amount, adjustment_direction")
      .eq("supplier_invoice_line_id", il.id)
      .eq("status", "APPROVED");

    let lineCredits = 0;
    let lineCharges = 0;
    (lineAdjs ?? []).forEach((a: any) => {
      if (a.adjustment_direction === "CREDIT") lineCredits += Number(a.adjustment_amount);
      else lineCharges += Number(a.adjustment_amount);
    });

    const adjustedLineAmount = lineAmount + lineCharges - lineCredits;

    // Get proportion of header adjustments
    const { data: allInvLines } = await supabase
      .from("supplier_invoice_lines")
      .select("id, unit_price, invoiced_qty")
      .eq("supplier_invoice_id", il.supplier_invoice_id);

    const totalInvoiceLinesValue = (allInvLines ?? []).reduce(
      (sum: number, x: any) => sum + Number((x.invoiced_qty * Number(x.unit_price)).toFixed(2)),
      0
    );

    const lineRatio = totalInvoiceLinesValue > 0 ? (lineAmount / totalInvoiceLinesValue) : 0;

    const { data: headerAdjs } = await supabase
      .from("supplier_invoice_adjustments")
      .select("adjustment_amount, adjustment_direction")
      .eq("supplier_invoice_id", il.supplier_invoice_id)
      .is("supplier_invoice_line_id", null)
      .eq("status", "APPROVED");

    let headerCredits = 0;
    let headerCharges = 0;
    (headerAdjs ?? []).forEach((a: any) => {
      if (a.adjustment_direction === "CREDIT") headerCredits += Number(a.adjustment_amount);
      else headerCharges += Number(a.adjustment_amount);
    });

    const allocatedHeaderAdj = (headerCharges - headerCredits) * lineRatio;

    totalAcquisitionValue += adjustedLineAmount + allocatedHeaderAdj;
  }

  // Calculate proportion of received items relative to total invoiced
  const totalInvoicedQty = approvedInvLines.reduce((sum, il) => sum + Number(il.invoiced_qty), 0);
  if (totalInvoicedQty <= 0) return fallbackTotal;

  const finalValueProportion = Number(((rl.received_qty / totalInvoicedQty) * totalAcquisitionValue).toFixed(2));
  return finalValueProportion;
}

export async function autoAllocateExpense(expenseId: string, directLineId?: string | null) {
  const supabase = createAdminClient();

  // 1. Fetch expense details
  const { data: expense } = await supabase
    .from("landed_cost_expenses")
    .select("*, case:landed_cost_cases(status)")
    .eq("id", expenseId)
    .single();

  if (!expense) throw new Error("Expense not found.");
  if ((expense.case as any).status === "FINALIZED") {
    throw new Error("확정된 케이스는 재배분할 수 없습니다.");
  }

  const caseId = expense.landed_cost_case_id;

  // Fetch shipments in this case
  const { data: caseShipments } = await supabase
    .from("landed_cost_case_shipments")
    .select("inbound_shipment_id")
    .eq("landed_cost_case_id", caseId);
  const shipmentIds = (caseShipments ?? []).map(s => s.inbound_shipment_id);

  // Fetch receivings for those shipments
  const { data: recs } = await supabase
    .from("receivings")
    .select("id")
    .in("inbound_shipment_id", shipmentIds.length > 0 ? shipmentIds : ["00000000-0000-0000-0000-000000000000"]);
  const receivingIds = (recs ?? []).map(r => r.id);

  // 2. Fetch all receiving lines belonging to shipments in this case
  const { data: lines, error: lineErr } = await supabase
    .from("receiving_lines")
    .select(`
      id,
      received_qty,
      purchase_order_line_id,
      product_id,
      product:products (
        item_weight,
        package_weight,
        carton_weight,
        carton_pack_qty,
        carton_cbm,
        package_width,
        package_depth,
        package_height
      ),
      receiving:receivings!receiving_id (
        inbound_shipment_id,
        warehouse_id,
        received_date
      )
    `)
    .in("receiving_id", receivingIds.length > 0 ? receivingIds : ["00000000-0000-0000-0000-000000000000"]);

  if (lineErr) throw lineErr;

  const totalExpenseAmount = Number(expense.base_currency_amount);
  if (totalExpenseAmount <= 0) {
    // Delete allocations if amount is 0
    await supabase.from("landed_cost_allocations").delete().eq("landed_cost_expense_id", expenseId);
    return;
  }

  let allocationsToInsert: any[] = [];

  // DIRECT
  if (expense.allocation_method === "DIRECT") {
    const targetLineId = directLineId || (lines && lines.length > 0 ? lines[0].id : null);
    if (!targetLineId) throw new Error("DIRECT 배분을 위한 수령 품목 라인이 없습니다.");

    allocationsToInsert = (lines ?? []).map(l => ({
      landed_cost_expense_id: expenseId,
      receiving_line_id: l.id,
      allocated_amount: l.id === targetLineId ? totalExpenseAmount : 0.00
    }));
  }
  // CBM, WEIGHT, VALUE ratio allocation
  else if (["CBM", "WEIGHT", "VALUE"].includes(expense.allocation_method)) {
    let totalMetric = 0;
    const lineMetrics = [];

    for (const l of (lines ?? [])) {
      let metricValue = 0;

      if (expense.allocation_method === "CBM") {
        const prod = l.product as any;
        const packQty = prod?.carton_pack_qty || 1;
        const cartonCbm = prod?.carton_cbm ? Number(prod.carton_cbm) : null;
        
        let unitCbm = 0;
        if (cartonCbm !== null) {
          unitCbm = cartonCbm / packQty;
        } else if (prod?.package_width && prod?.package_depth && prod?.package_height) {
          unitCbm = (Number(prod.package_width) * Number(prod.package_depth) * Number(prod.package_height)) / 1000000;
        }
        
        // Fallback default volume (0.001 CBM)
        if (unitCbm <= 0) unitCbm = 0.001;
        metricValue = l.received_qty * unitCbm;
      }
      else if (expense.allocation_method === "WEIGHT") {
        const prod = l.product as any;
        const packQty = prod?.carton_pack_qty || 1;
        
        let unitWeight = prod?.package_weight ? Number(prod.package_weight) : null;
        if (unitWeight === null && prod?.carton_weight) {
          unitWeight = Number(prod.carton_weight) / packQty;
        }
        if (unitWeight === null && prod?.item_weight) {
          unitWeight = Number(prod.item_weight);
        }

        // Fallback default weight (0.1 kg)
        if (unitWeight === null || unitWeight <= 0) unitWeight = 0.1;
        metricValue = l.received_qty * unitWeight;
      }
      else if (expense.allocation_method === "VALUE") {
        metricValue = await getLineAcquisitionValue(supabase, l);
      }

      lineMetrics.push({ lineId: l.id, metricValue });
      totalMetric += metricValue;
    }

    if (totalMetric <= 0) {
      // Equal split if metric sum is 0
      const equalAmt = Number((totalExpenseAmount / lines.length).toFixed(2));
      allocationsToInsert = (lines ?? []).map((l, idx) => ({
        landed_cost_expense_id: expenseId,
        receiving_line_id: l.id,
        allocated_amount: idx === lines.length - 1 ? Number((totalExpenseAmount - (equalAmt * (lines.length - 1))).toFixed(2)) : equalAmt
      }));
    } else {
      let allocatedSum = 0;
      allocationsToInsert = lineMetrics.map((lm, idx) => {
        let amt = Number(((lm.metricValue / totalMetric) * totalExpenseAmount).toFixed(2));
        if (idx === lineMetrics.length - 1) {
          // Adjust rounding difference to match the total expense exactly
          amt = Number((totalExpenseAmount - allocatedSum).toFixed(2));
        } else {
          allocatedSum += amt;
        }
        return {
          landed_cost_expense_id: expenseId,
          receiving_line_id: lm.lineId,
          allocated_amount: amt
        };
      });
    }
  }
  // MANUAL (requires user override, default to equal split if not provided)
  else {
    const equalAmt = Number((totalExpenseAmount / lines.length).toFixed(2));
    allocationsToInsert = (lines ?? []).map((l, idx) => ({
      landed_cost_expense_id: expenseId,
      receiving_line_id: l.id,
      allocated_amount: idx === lines.length - 1 ? Number((totalExpenseAmount - (equalAmt * (lines.length - 1))).toFixed(2)) : equalAmt
    }));
  }

  // 3. Save allocations
  await supabase
    .from("landed_cost_allocations")
    .delete()
    .eq("landed_cost_expense_id", expenseId);

  const { error: insErr } = await supabase
    .from("landed_cost_allocations")
    .insert(allocationsToInsert);

  if (insErr) throw insErr;
}

export async function finalizeLandedCostCase(caseId: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyApprovePermission(supabase, userId);

  const { data: lcCase } = await supabase
    .from("landed_cost_cases")
    .select("status")
    .eq("id", caseId)
    .single();

  if (!lcCase) throw new Error("Case not found.");
  if (lcCase.status === "FINALIZED") {
    throw new Error("이미 확정(FINALIZED)된 Landed Cost 케이스입니다.");
  }

  // 1. Validate expenses have actual amounts
  const { data: expenses } = await supabase
    .from("landed_cost_expenses")
    .select("*")
    .eq("landed_cost_case_id", caseId);

  for (const exp of (expenses ?? [])) {
    if (exp.actual_amount === null || exp.actual_amount === undefined) {
      throw new Error(`실제 확정 금액(Actual Amount)이 누락된 비용 항목이 있습니다: ${exp.cost_type}`);
    }
  }

  // Fetch shipments in this case
  const { data: caseShipments } = await supabase
    .from("landed_cost_case_shipments")
    .select("inbound_shipment_id")
    .eq("landed_cost_case_id", caseId);
  const shipmentIds = (caseShipments ?? []).map(s => s.inbound_shipment_id);

  // Fetch receivings for those shipments
  const { data: recs } = await supabase
    .from("receivings")
    .select("id")
    .in("inbound_shipment_id", shipmentIds.length > 0 ? shipmentIds : ["00000000-0000-0000-0000-000000000000"]);
  const receivingIds = (recs ?? []).map(r => r.id);

  // 2. Fetch all receiving lines in the case shipments
  const { data: lines, error: lineErr } = await supabase
    .from("receiving_lines")
    .select(`
      id,
      received_qty,
      purchase_order_line_id,
      product_id,
      receiving:receivings!receiving_id (
        inbound_shipment_id,
        warehouse_id,
        received_date
      )
    `)
    .in("receiving_id", receivingIds.length > 0 ? receivingIds : ["00000000-0000-0000-0000-000000000000"]);

  if (lineErr) throw lineErr;

  // 3. For each line, compute and insert landed cost results & FIFO layers
  for (const l of (lines ?? [])) {
    const subAcqCost = await getLineAcquisitionValue(supabase, l);

    // Sum allocated costs by category
    const { data: allocs } = await supabase
      .from("landed_cost_allocations")
      .select("*, expense:landed_cost_expenses(*)")
      .eq("receiving_line_id", l.id);

    let freight = 0;
    let duty = 0;
    let broker = 0;
    let port = 0;
    let trucking = 0;
    let insurance = 0;
    let inspection = 0;
    let other = 0;

    (allocs ?? []).forEach((al: any) => {
      const type = al.expense.cost_type;
      const amt = Number(al.allocated_amount);
      if (['OCEAN_FREIGHT', 'AIR_FREIGHT'].includes(type)) freight += amt;
      else if (type === 'DUTY') duty += amt;
      else if (type === 'CUSTOMS_BROKER') broker += amt;
      else if (type === 'PORT_TERMINAL') port += amt;
      else if (type === 'TRUCKING') trucking += amt;
      else if (type === 'INSURANCE') insurance += amt;
      else if (type === 'INSPECTION') inspection += amt;
      else other += amt;
    });

    const totalAncillary = freight + duty + broker + port + trucking + insurance + inspection + other;
    const totalLanded = subAcqCost + totalAncillary;
    
    const den = Number(l.received_qty);
    const unitLanded = den > 0 ? Number((totalLanded / den).toFixed(4)) : 0.0000;

    // Insert result snapshot
    const { data: res, error: resErr } = await supabase
      .from("landed_cost_results")
      .insert({
        landed_cost_case_id: caseId,
        receiving_line_id: l.id,
        product_id: l.product_id,
        received_date: (l.receiving as any).received_date,
        inventory_received_qty: den,
        supplier_acquisition_cost: subAcqCost,
        freight_cost: freight,
        duty_cost: duty,
        broker_cost: broker,
        port_cost: port,
        trucking_cost: trucking,
        insurance_cost: insurance,
        inspection_cost: inspection,
        other_cost: other,
        total_ancillary_cost: totalAncillary,
        total_landed_cost: totalLanded,
        unit_landed_cost: unitLanded,
        cost_status: 'FINAL'
      })
      .select()
      .single();

    if (resErr || !res) {
      throw new Error(`원가 결과 스냅샷 생성 실패: ${resErr?.message}`);
    }

    // Insert FIFO Cost Layer
    const { error: layerErr } = await supabase
      .from("inventory_cost_layers")
      .insert({
        product_id: l.product_id,
        warehouse_id: (l.receiving as any).warehouse_id,
        receiving_line_id: l.id,
        landed_cost_result_id: res.id,
        received_date: (l.receiving as any).received_date,
        original_qty: den,
        remaining_qty: den,
        unit_landed_cost: unitLanded,
        original_total_cost: totalLanded,
        status: 'ACTIVE'
      });

    if (layerErr) {
      throw new Error(`FIFO Cost Layer 생성 실패: ${layerErr.message}`);
    }
  }

  // 4. Update Case Header Status
  const { error: finalErr } = await supabase
    .from("landed_cost_cases")
    .update({
      status: "FINALIZED",
      finalized_at: new Date().toISOString(),
      finalized_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (finalErr) throw finalErr;

  revalidatePath("/admin/finance/landed-cost");
  revalidatePath(`/admin/finance/landed-cost/${caseId}`);
  return { success: true };
}

export async function reopenLandedCostCase(caseId: string, reason: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyApprovePermission(supabase, userId);

  const { data: lcCase } = await supabase
    .from("landed_cost_cases")
    .select("status")
    .eq("id", caseId)
    .single();

  if (!lcCase) throw new Error("Case not found.");
  if (lcCase.status !== "FINALIZED") {
    throw new Error("초안(OPEN) 상태인 케이스는 재개할 수 없습니다.");
  }

  // Verify that NONE of the associated cost layers have been consumed
  const { data: layers } = await supabase
    .from("inventory_cost_layers")
    .select("*")
    .eq("landed_cost_result_id", (
      supabase
        .from("landed_cost_results")
        .select("id")
        .eq("landed_cost_case_id", caseId)
    ));

  const hasConsumption = (layers ?? []).some(layer => Number(layer.remaining_qty) < Number(layer.original_qty));
  if (hasConsumption) {
    throw new Error("이미 입고된 재고 레이어에서 출고/판매 소비가 일어났으므로 정산 케이스를 재개할 수 없습니다.");
  }

  // Delete layers & results in a transaction-like execution
  const layerIds = (layers ?? []).map(l => l.id);
  if (layerIds.length > 0) {
    await supabase.from("inventory_cost_layers").delete().in("id", layerIds);
  }

  await supabase.from("landed_cost_results").delete().eq("landed_cost_case_id", caseId);

  const { error } = await supabase
    .from("landed_cost_cases")
    .update({
      status: "OPEN",
      reopened_at: new Date().toISOString(),
      reopened_by: userId,
      reopen_reason: reason,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (error) throw error;

  revalidatePath("/admin/finance/landed-cost");
  revalidatePath(`/admin/finance/landed-cost/${caseId}`);
  return { success: true };
}

// Fetch helper to aggregate cost summary details for a product (Section 32)
export async function getProductCostSummary(productId: string) {
  const supabase = createAdminClient();

  // 1. Fetch current inventory on hand across all warehouses
  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("qty_on_hand")
    .eq("product_id", productId);

  const currentInventory = (balances ?? []).reduce((sum, b) => sum + Number(b.qty_on_hand), 0);

  // 2. Fetch Latest Final Landed Cost
  const { data: latestResult } = await supabase
    .from("landed_cost_results")
    .select("unit_landed_cost, received_date")
    .eq("product_id", productId)
    .eq("cost_status", "FINAL")
    .order("received_date", { ascending: false })
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestLandedCost = latestResult ? Number(latestResult.unit_landed_cost) : 0.00;

  // 3. Fetch Current FIFO Cost (oldest positive layer unit cost)
  const { data: oldestLayer } = await supabase
    .from("inventory_cost_layers")
    .select("unit_landed_cost")
    .eq("product_id", productId)
    .eq("status", "ACTIVE")
    .order("received_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const currentFifoCost = oldestLayer ? Number(oldestLayer.unit_landed_cost) : latestLandedCost;

  // 4. Calculate Current Weighted Average & Total Value
  const { data: activeLayers } = await supabase
    .from("inventory_cost_layers")
    .select("remaining_qty, unit_landed_cost")
    .eq("product_id", productId)
    .eq("status", "ACTIVE");

  let totalValue = 0;
  let totalRemainingQty = 0;
  (activeLayers ?? []).forEach(layer => {
    totalValue += Number(layer.remaining_qty) * Number(layer.unit_landed_cost);
    totalRemainingQty += Number(layer.remaining_qty);
  });

  const weightedAverage = totalRemainingQty > 0 ? Number((totalValue / totalRemainingQty).toFixed(2)) : latestLandedCost;

  // 5. Fetch Previous Landed Cost & Calculation Trend
  const { data: prevResults } = await supabase
    .from("landed_cost_results")
    .select("unit_landed_cost")
    .eq("product_id", productId)
    .eq("cost_status", "FINAL")
    .order("received_date", { ascending: false })
    .order("calculated_at", { ascending: false })
    .limit(2);

  const previousLandedCost = prevResults && prevResults.length > 1 ? Number(prevResults[1].unit_landed_cost) : 0.00;

  let costChangePercent = 0;
  if (previousLandedCost > 0) {
    costChangePercent = Number((((latestLandedCost - previousLandedCost) / previousLandedCost) * 100).toFixed(1));
  }

  // 6. Fetch historical landed cost entries for the table
  const { data: history } = await supabase
    .from("landed_cost_results")
    .select(`
      id,
      received_date,
      inventory_received_qty,
      supplier_acquisition_cost,
      freight_cost,
      duty_cost,
      total_ancillary_cost,
      unit_landed_cost,
      landed_cost_case_id,
      case:landed_cost_cases (landed_cost_number)
    `)
    .eq("product_id", productId)
    .eq("cost_status", "FINAL")
    .order("received_date", { ascending: false });

  return {
    currentInventory,
    latestLandedCost,
    currentFifoCost,
    weightedAverage,
    currentInventoryCostValue: totalValue > 0 ? totalValue : (currentInventory * latestLandedCost),
    previousLandedCost,
    costChangePercent,
    history: history ?? []
  };
}

export async function getEligibleShipmentsForLandedCost() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch shipments already assigned to any case
  const { data: assigned, error: assignErr } = await supabase
    .from("landed_cost_case_shipments")
    .select("inbound_shipment_id");

  if (assignErr) throw assignErr;
  const assignedIds = (assigned ?? []).map(a => a.inbound_shipment_id).filter(Boolean);

  // 2. Query eligible shipments
  let query = supabase
    .from("inbound_shipments")
    .select(`
      id,
      shipment_number,
      status,
      purchase_order_id,
      po:purchase_orders!purchase_order_id (
        po_number,
        supplier:companies!supplier_id (name)
      )
    `)
    .in("status", ["ARRIVED", "PARTIALLY_RECEIVED", "RECEIVED"]);

  if (assignedIds.length > 0) {
    query = query.not("id", "in", `(${assignedIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    id: s.id,
    shipment_number: s.shipment_number,
    status: s.status,
    po_number: s.po?.po_number || "(PO 없음)",
    supplier_name: s.po?.supplier?.name || "(공급사 없음)"
  }));
}
