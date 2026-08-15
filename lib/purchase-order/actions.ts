"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CreatePoLineInput {
  product_id: string;
  qty: number;
  unit_cost: number;
  line_note?: string;
}

export interface CreatePoInput {
  supplier_id: string;
  order_date: string;
  currency: string;
  payment_terms?: string;
  incoterms?: string;
  port_of_loading?: string;
  expected_ready_date?: string;
  expected_ship_date?: string;
  destination_warehouse_id: string;
  po_receiving_email?: string;
  internal_note?: string;
  supplier_facing_note?: string;
  lines: CreatePoLineInput[];
}

/**
 * Fetch all purchase orders with aggregated statistics and names.
 */
export async function getPurchaseOrders() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select(`
      id, po_number, order_date, status, currency, expected_ready_date, updated_at,
      companies:supplier_id (name),
      warehouses:destination_warehouse_id (name, code),
      purchase_order_lines (qty, unit_cost)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch purchase orders: ${error.message}`);

  return (pos ?? []).map((po: any) => {
    const lines = po.purchase_order_lines || [];
    const totalQty = lines.reduce((sum: number, l: any) => sum + l.qty, 0);
    const totalAmount = lines.reduce((sum: number, l: any) => sum + (l.qty * Number(l.unit_cost)), 0);

    return {
      id: po.id,
      po_number: po.po_number,
      order_date: po.order_date,
      status: po.status,
      currency: po.currency,
      expected_ready_date: po.expected_ready_date,
      last_updated: po.updated_at,
      supplier_name: po.companies?.name || "(미지정 공급사)",
      warehouse_name: po.warehouses?.name || "(미지정 창고)",
      warehouse_code: po.warehouses?.code || "-",
      total_qty: totalQty,
      total_amount: totalAmount,
    };
  });
}

/**
 * Fetch detailed view of a single purchase order.
 */
export async function getPurchaseOrderDetail(poId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch PO Header
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      supplier:supplier_id (id, name, address, business_registration_number),
      warehouse:destination_warehouse_id (id, name, code, address1, city, state, zip_code, country),
      creator:created_by (full_name),
      approver:approved_by (full_name),
      canceller:cancelled_by (full_name)
    `)
    .eq("id", poId)
    .maybeSingle();

  if (poErr) throw new Error(`Failed to fetch purchase order header: ${poErr.message}`);
  if (!po) throw new Error("Purchase order not found.");

  // 2. Fetch PO Lines
  const { data: lines, error: lErr } = await supabase
    .from("purchase_order_lines")
    .select(`
      id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
      qty, unit_cost, line_note,
      products:product_id (brand_id, brands (name))
    `)
    .eq("purchase_order_id", poId);

  if (lErr) throw new Error(`Failed to fetch purchase order lines: ${lErr.message}`);

  const formattedLines = (lines ?? []).map((l: any) => ({
    id: l.id,
    product_id: l.product_id,
    product_name: l.product_name_snapshot,
    letusto_sku: l.letusto_sku_snapshot,
    manufacture_sku: l.manufacture_sku_snapshot,
    qty: l.qty,
    unit_cost: Number(l.unit_cost),
    line_total: l.qty * Number(l.unit_cost),
    line_note: l.line_note,
    brand_name: l.products?.brands?.name || "(미지정 브랜드)",
  }));

  const totalQty = formattedLines.reduce((sum, l) => sum + l.qty, 0);
  const totalAmount = formattedLines.reduce((sum, l) => sum + l.line_total, 0);

  return {
    ...po,
    lines: formattedLines,
    total_qty: totalQty,
    total_amount: totalAmount,
  };
}

/**
 * Fetch all companies that have the active Supplier role profile mapping.
 */
export async function getSuppliersForPo() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // Fetch company IDs that have the Supplier role
  const { data: roles, error: rErr } = await supabase
    .from("company_roles")
    .select("company_id")
    .eq("role", "Supplier");

  if (rErr) throw new Error(`Failed to fetch company roles: ${rErr.message}`);

  const supplierIds = (roles ?? []).map((r) => r.company_id);
  if (supplierIds.length === 0) return [];

  // Fetch supplier profiles that are active joined with their company details
  const { data: profiles, error: pErr } = await supabase
    .from("supplier_profiles")
    .select(`
      company_id, default_currency, default_payment_terms, default_payment_terms_custom,
      default_incoterms, default_port_of_loading, default_production_lead_time, po_receiving_email,
      companies:company_id (name, address)
    `)
    .in("company_id", supplierIds)
    .eq("status", "active")
    .order("companies(name)", { ascending: true } as any);

  if (pErr) throw new Error(`Failed to fetch active supplier profiles: ${pErr.message}`);

  return (profiles ?? []).map((p: any) => ({
    id: p.company_id,
    name: p.companies?.name || "",
    address: p.companies?.address || "",
    default_currency: p.default_currency || "USD",
    default_payment_terms: p.default_payment_terms || "",
    default_payment_terms_custom: p.default_payment_terms_custom || "",
    default_incoterms: p.default_incoterms || "",
    default_port_of_loading: p.default_port_of_loading || "",
    default_production_lead_time: p.default_production_lead_time || "",
    po_receiving_email: p.po_receiving_email || "",
  }));
}

/**
 * Fetch active trading products belonging to a supplier.
 */
export async function getProductsForSupplier(supplierId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, name_en, manufacture_sku, letusto_sku, price_usd_fob, price_additional_info")
    .eq("company_id", supplierId)
    .eq("trading_status", "active")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch products: ${error.message}`);

  return (products ?? []).map((p: any) => {
    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku;
    const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : p.manufacture_sku;
    const effectiveFob = adminOverrides.price_usd_fob !== undefined ? parseFloat(adminOverrides.price_usd_fob) : (p.price_usd_fob || 0);

    return {
      id: p.id,
      name: p.name,
      display_name: displayName,
      letusto_sku: effectiveLetustoSku,
      manufacture_sku: effectiveManufactureSku,
      price_usd_fob: effectiveFob,
    };
  });
}

/**
 * Create a new Purchase Order in DRAFT status.
 */
export async function createPurchaseOrder(data: CreatePoInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Verify Destination Warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.destination_warehouse_id)
    .single();

  if (!warehouse) throw new Error("Destination warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성(Inactive) 상태의 물류창고는 입고지로 지정할 수 없습니다.");
  }

  // 2. Validate Lines are present
  if (!data.lines || data.lines.length === 0) {
    throw new Error("최소 한 개 이상의 제품 품목이 추가되어야 합니다.");
  }

  // Validate quantities and unit costs
  data.lines.forEach((l) => {
    if (l.qty <= 0) throw new Error("주문 수량은 0보다 커야 합니다.");
    if (l.unit_cost < 0) throw new Error("구매 단가는 0 이상이어야 합니다.");
  });

  // 3. Create PO Header
  const { data: newPo, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      supplier_id: data.supplier_id,
      order_date: data.order_date,
      currency: data.currency,
      payment_terms: data.payment_terms || null,
      incoterms: data.incoterms || null,
      port_of_loading: data.port_of_loading || null,
      expected_ready_date: data.expected_ready_date || null,
      expected_ship_date: data.expected_ship_date || null,
      destination_warehouse_id: data.destination_warehouse_id,
      po_receiving_email: data.po_receiving_email || null,
      internal_note: data.internal_note || null,
      supplier_facing_note: data.supplier_facing_note || null,
      created_by: userId,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (poErr) throw new Error(`발주서 헤더 생성 실패: ${poErr.message}`);
  const poId = newPo.id;

  // 4. Create PO Lines (taking snapshotted details from product master)
  const productIds = data.lines.map((l) => l.product_id);
  const { data: dbProducts } = await supabase
    .from("products")
    .select("id, name, name_en, manufacture_sku, letusto_sku, price_additional_info")
    .in("id", productIds);

  const productMap = new Map((dbProducts ?? []).map((p) => [p.id, p]));

  const lineInserts = data.lines.map((l) => {
    const p = productMap.get(l.product_id);
    if (!p) throw new Error("유효하지 않은 제품이 라인에 포함되어 있습니다.");

    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku;
    const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : p.manufacture_sku;

    return {
      purchase_order_id: poId,
      product_id: l.product_id,
      product_name_snapshot: displayName,
      letusto_sku_snapshot: effectiveLetustoSku,
      manufacture_sku_snapshot: effectiveManufactureSku,
      qty: l.qty,
      unit_cost: l.unit_cost,
      line_note: l.line_note || null,
    };
  });

  const { error: linesErr } = await supabase
    .from("purchase_order_lines")
    .insert(lineInserts);

  if (linesErr) {
    // Attempt rollback header
    await supabase.from("purchase_orders").delete().eq("id", poId);
    throw new Error(`발주서 라인 품목 추가 실패: ${linesErr.message}`);
  }

  revalidatePath("/admin/purchasing");
  return { success: true, id: poId };
}

/**
 * Update an existing Purchase Order (Only available in DRAFT status).
 */
export async function updatePurchaseOrder(poId: string, data: CreatePoInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Verify PO exists and is DRAFT
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");
  if (po.status !== "DRAFT") {
    throw new Error("DRAFT(초안) 상태인 발주서만 수정할 수 있습니다.");
  }

  // 2. Verify Destination Warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.destination_warehouse_id)
    .single();

  if (!warehouse) throw new Error("Destination warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성(Inactive) 상태의 물류창고는 입고지로 지정할 수 없습니다.");
  }

  // 3. Validate Lines
  if (!data.lines || data.lines.length === 0) {
    throw new Error("최소 한 개 이상의 제품 품목이 추가되어야 합니다.");
  }

  data.lines.forEach((l) => {
    if (l.qty <= 0) throw new Error("주문 수량은 0보다 커야 합니다.");
    if (l.unit_cost < 0) throw new Error("구매 단가는 0 이상이어야 합니다.");
  });

  // 4. Update Header
  const { error: poErr } = await supabase
    .from("purchase_orders")
    .update({
      supplier_id: data.supplier_id,
      order_date: data.order_date,
      currency: data.currency,
      payment_terms: data.payment_terms || null,
      incoterms: data.incoterms || null,
      port_of_loading: data.port_of_loading || null,
      expected_ready_date: data.expected_ready_date || null,
      expected_ship_date: data.expected_ship_date || null,
      destination_warehouse_id: data.destination_warehouse_id,
      po_receiving_email: data.po_receiving_email || null,
      internal_note: data.internal_note || null,
      supplier_facing_note: data.supplier_facing_note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (poErr) throw new Error(`발주서 헤더 수정 실패: ${poErr.message}`);

  // 5. Delete old lines and insert new ones
  await supabase.from("purchase_order_lines").delete().eq("purchase_order_id", poId);

  const productIds = data.lines.map((l) => l.product_id);
  const { data: dbProducts } = await supabase
    .from("products")
    .select("id, name, name_en, manufacture_sku, letusto_sku, price_additional_info")
    .in("id", productIds);

  const productMap = new Map((dbProducts ?? []).map((p) => [p.id, p]));

  const lineInserts = data.lines.map((l) => {
    const p = productMap.get(l.product_id);
    if (!p) throw new Error("유효하지 않은 제품이 라인에 포함되어 있습니다.");

    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku;
    const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : p.manufacture_sku;

    return {
      purchase_order_id: poId,
      product_id: l.product_id,
      product_name_snapshot: displayName,
      letusto_sku_snapshot: effectiveLetustoSku,
      manufacture_sku_snapshot: effectiveManufactureSku,
      qty: l.qty,
      unit_cost: l.unit_cost,
      line_note: l.line_note || null,
    };
  });

  const { error: linesErr } = await supabase
    .from("purchase_order_lines")
    .insert(lineInserts);

  if (linesErr) {
    throw new Error(`발주서 라인 품목 수정 실패: ${linesErr.message}`);
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${poId}`);
  return { success: true };
}

/**
 * Handle state transitions in the PO workflow (Approve, Send, Cancel, etc.)
 */
export async function transitionPoStatus(poId: string, targetStatus: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");

  // Transition validation
  if (targetStatus === "APPROVED") {
    if (po.status !== "DRAFT") throw new Error("DRAFT 상태인 발주서만 승인할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        status: "APPROVED",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "SENT") {
    if (po.status !== "APPROVED") throw new Error("APPROVED 상태인 발주서만 발송 처리할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        status: "SENT",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "IN_PRODUCTION") {
    if (po.status !== "SENT") throw new Error("SENT 상태인 발주서만 생산 상태로 변경할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        status: "IN_PRODUCTION",
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "READY_TO_SHIP") {
    if (po.status !== "IN_PRODUCTION") throw new Error("IN_PRODUCTION 상태인 발주서만 선적대기 상태로 변경할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        status: "READY_TO_SHIP",
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "CANCELLED") {
    if (po.status === "CANCELLED") throw new Error("이미 취소된 발주서입니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        status: "CANCELLED",
        cancelled_by: userId,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else {
    throw new Error(`알 수 없는 발주 진행 상태입니다: ${targetStatus}`);
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${poId}`);
  return { success: true };
}

/**
 * Permanently delete a DRAFT purchase order (header & lines).
 */
export async function deleteDraftPo(poId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");
  if (po.status !== "DRAFT") {
    throw new Error("DRAFT(초안) 상태의 발주서만 영구 삭제가 가능합니다.");
  }

  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", poId);

  if (error) throw new Error(`발주서 삭제 실패: ${error.message}`);

  revalidatePath("/admin/purchasing");
  return { success: true };
}
