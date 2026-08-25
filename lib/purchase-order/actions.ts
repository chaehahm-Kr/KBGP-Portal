"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOverallStatus } from "./status-helper";

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
}

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
  ship_from_warehouse_id?: string | null;
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
      id, po_number, order_date, po_status, fulfillment_status, supplier_confirmation_status, currency, expected_ready_date, updated_at,
      companies:supplier_id (name),
      destination_warehouse:destination_warehouse_id (name, code),
      ship_from_warehouse:ship_from_warehouse_id (name, code),
      purchase_order_lines (qty, unit_cost)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch purchase orders: ${error.message}`);

  // Fetch all shipments and receivings in batch for mapping
  const { data: allShipments } = await supabase
    .from("inbound_shipments")
    .select("purchase_order_id, status, eta");

  const { data: allReceivings } = await supabase
    .from("receivings")
    .select("purchase_order_id, status, receiving_lines(received_qty, damaged_qty, hold_qty)");

  return (pos ?? []).map((po: any) => {
    const lines = po.purchase_order_lines || [];
    const totalQty = lines.reduce((sum: number, l: any) => sum + l.qty, 0);
    const totalAmount = lines.reduce((sum: number, l: any) => sum + (l.qty * Number(l.unit_cost)), 0);

    const shipments = (allShipments ?? []).filter((s) => s.purchase_order_id === po.id);
    const receivings = (allReceivings ?? []).filter((r) => r.purchase_order_id === po.id);

    const overallStatus = getOverallStatus(po, shipments, receivings);

    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");
    const shipmentStatus = activeShipments.length > 0 ? activeShipments[0].status : "PENDING";

    const activeReceivings = receivings.filter((r) => r.status === "DRAFT");
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");
    const receivingStatus =
      po.fulfillment_status === "RECEIVED" || po.fulfillment_status === "COMPLETED" || finalizedReceivings.length > 0
        ? "RECEIVED"
        : activeReceivings.length > 0
        ? "RECEIVING"
        : "PENDING";

    const finalQty = receivings.reduce(
      (sum, r) =>
        sum +
        (r.receiving_lines ?? []).reduce(
          (lSum: number, rl: any) => lSum + rl.received_qty - rl.damaged_qty - rl.hold_qty,
          0
        ),
      0
    );

    const eta = activeShipments.length > 0 && activeShipments[0].eta ? activeShipments[0].eta : po.expected_ready_date;

    return {
      id: po.id,
      po_number: po.po_number,
      order_date: po.order_date,
      po_status: po.po_status,
      fulfillment_status: po.fulfillment_status,
      supplier_confirmation_status: po.supplier_confirmation_status,
      status: po.po_status, // backwards compatibility
      currency: po.currency,
      expected_ready_date: po.expected_ready_date,
      last_updated: po.updated_at,
      supplier_name: po.companies?.name || "(미지정 공급사)",
      warehouse_name: po.destination_warehouse?.name || "(미지정 창고)",
      warehouse_code: po.destination_warehouse?.code || "-",
      ship_from_name: po.ship_from_warehouse?.name || "-",
      ship_from_code: po.ship_from_warehouse?.code || "-",
      total_qty: totalQty,
      total_amount: totalAmount,
      overall_status: overallStatus,
      shipment_status: shipmentStatus,
      receiving_status: receivingStatus,
      final_qty: finalQty,
      eta: eta,
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
      supplier:supplier_id (id, name, business_registration_number),
      warehouse:destination_warehouse_id (id, name, code, address1, city, state, zip_code, country),
      ship_from_warehouse:ship_from_warehouse_id (id, name, code, address1, city, state, zip_code, country),
      creator:created_by (full_name:display_name),
      approver:approved_by (full_name:display_name),
      canceller:cancelled_by (full_name:display_name)
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
      qty, confirmed_qty, unit_cost, line_note,
      products:product_id (brand_id, brands (name))
    `)
    .eq("purchase_order_id", poId);

  if (lErr) throw new Error(`Failed to fetch purchase order lines: ${lErr.message}`);

  // Fetch active shipped totals per PO line
  const { data: shipData } = await supabase
    .from("inbound_shipment_lines")
    .select("purchase_order_line_id, shipped_qty, inbound_shipments!inner(status)")
    .eq("inbound_shipments.purchase_order_id", poId)
    .neq("inbound_shipments.status", "CANCELLED");

  const shippedMap = new Map<string, number>();
  (shipData ?? []).forEach((s) => {
    const cur = shippedMap.get(s.purchase_order_line_id) || 0;
    shippedMap.set(s.purchase_order_line_id, cur + s.shipped_qty);
  });

  // Fetch finalized received totals per PO line
  const { data: recData } = await supabase
    .from("receiving_lines")
    .select("purchase_order_line_id, received_qty, receivings!inner(status)")
    .eq("receivings.purchase_order_id", poId)
    .eq("receivings.status", "FINALIZED");

  const receivedMap = new Map<string, number>();
  (recData ?? []).forEach((r) => {
    const cur = receivedMap.get(r.purchase_order_line_id) || 0;
    receivedMap.set(r.purchase_order_line_id, cur + r.received_qty);
  });

  const formattedLines = (lines ?? []).map((l: any) => {
    const shipped = shippedMap.get(l.id) || 0;
    const received = receivedMap.get(l.id) || 0;
    const remainingToShip = Math.max(0, l.qty - shipped);
    const remainingToReceive = Math.max(0, l.qty - received);

    return {
      id: l.id,
      product_id: l.product_id,
      product_name: l.product_name_snapshot,
      letusto_sku: l.letusto_sku_snapshot,
      manufacture_sku: l.manufacture_sku_snapshot,
      qty: l.qty,
      confirmed_qty: l.confirmed_qty !== null ? Number(l.confirmed_qty) : null,
      unit_cost: Number(l.unit_cost),
      line_total: l.qty * Number(l.unit_cost),
      line_note: l.line_note,
      brand_name: l.products?.brands?.name || "(미지정 브랜드)",
      shipped_qty: shipped,
      received_qty: received,
      remaining_to_ship: remainingToShip,
      remaining_to_receive: remainingToReceive,
    };
  });

  const totalQty = formattedLines.reduce((sum, l) => sum + l.qty, 0);
  const totalAmount = formattedLines.reduce((sum, l) => sum + l.line_total, 0);
  const totalShipped = formattedLines.reduce((sum, l) => sum + l.shipped_qty, 0);
  const totalReceived = formattedLines.reduce((sum, l) => sum + l.received_qty, 0);

  return {
    ...po,
    lines: formattedLines,
    total_qty: totalQty,
    total_amount: totalAmount,
    total_shipped: totalShipped,
    total_received: totalReceived,
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
      default_ship_from_warehouse_id,
      companies:company_id (name)
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
    default_ship_from_warehouse_id: p.default_ship_from_warehouse_id || "",
  }));
}

/**
 * Fetch active trading products mapped to a supplier.
 */
export async function getProductsForSupplier(supplierId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch mapped product IDs for this supplier
  const { data: mappedProducts, error: mapErr } = await supabase
    .from("product_suppliers")
    .select("product_id")
    .eq("supplier_id", supplierId);

  if (mapErr) throw new Error(`공급사 매핑 제품 조회 실패: ${mapErr.message}`);
  
  const productIds = (mappedProducts ?? []).map((mp) => mp.product_id);
  if (productIds.length === 0) return [];

  // 2. Fetch active trading products for these IDs
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, name_en, manufacture_sku, letusto_sku, parent_sku, child_sku, price_usd_fob, price_additional_info, category, brand_id, brands (name), upc, ean")
    .in("id", productIds)
    .eq("trading_status", "active")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch products: ${error.message}`);

  // 3. Fetch first images (lowest position) for these products
  const { data: productImages } = await supabase
    .from("product_images")
    .select("product_id, storage_path")
    .in("product_id", productIds)
    .order("position", { ascending: true });

  const { getSignedFileUrl } = await import("@/lib/files/storage");
  const imageMap = new Map<string, string>();
  if (productImages && productImages.length > 0) {
    const processed = new Set<string>();
    for (const img of productImages) {
      if (!processed.has(img.product_id)) {
        processed.add(img.product_id);
        if (img.storage_path) {
          try {
            const url = await getSignedFileUrl(img.storage_path);
            if (url) imageMap.set(img.product_id, url);
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  const { PRODUCT_CATEGORY_LABEL } = await import("@/lib/product/types");

  return (products ?? []).map((p: any) => {
    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku;
    const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : p.manufacture_sku;
    const effectiveFob = adminOverrides.price_usd_fob !== undefined ? parseFloat(adminOverrides.price_usd_fob) : (p.price_usd_fob || 0);
    const effectiveUpc = adminOverrides.upc !== undefined ? adminOverrides.upc : p.upc;
    const effectiveEan = adminOverrides.ean !== undefined ? adminOverrides.ean : p.ean;
    const effectiveParentSku = adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : p.parent_sku;
    const effectiveChildSku = adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : p.child_sku;

    const catValue = p.category || "";
    const catLabel = (PRODUCT_CATEGORY_LABEL as any)[catValue] || catValue || "기타";

    return {
      id: p.id,
      name: p.name,
      display_name: displayName,
      letusto_sku: effectiveLetustoSku,
      manufacture_sku: effectiveManufactureSku,
      price_usd_fob: effectiveFob,
      upc: effectiveUpc || effectiveEan || "",
      parent_sku: effectiveParentSku || null,
      child_sku: effectiveChildSku || null,
      brand_name: p.brands?.name || "(미지정 브랜드)",
      category_label: catLabel,
      photo_url: imageMap.get(p.id) || null,
    };
  });
}

/**
 * Update the list of mapped suppliers for a product.
 */
export async function updateProductSuppliers(productId: string, supplierIds: string[]) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Delete all existing supplier mapping rows for this product
  const { error: delErr } = await supabase
    .from("product_suppliers")
    .delete()
    .eq("product_id", productId);

  if (delErr) throw new Error(`기존 공급처 매핑 삭제 실패: ${delErr.message}`);

  // 2. Insert new mappings if any are selected
  if (supplierIds.length > 0) {
    const inserts = supplierIds.map((sId) => ({
      product_id: productId,
      supplier_id: sId,
    }));

    const { error: insErr } = await supabase
      .from("product_suppliers")
      .insert(inserts);

    if (insErr) throw new Error(`신규 공급처 매핑 추가 실패: ${insErr.message}`);
  }

  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/**
 * Create a new Purchase Order in DRAFT status.
 */
export async function createPurchaseOrder(data: CreatePoInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

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
      ship_from_warehouse_id: data.ship_from_warehouse_id || null,
      destination_warehouse_id: data.destination_warehouse_id,
      po_receiving_email: data.po_receiving_email || null,
      internal_note: data.internal_note || null,
      supplier_facing_note: data.supplier_facing_note || null,
      created_by: userId,
      po_status: "DRAFT",
      fulfillment_status: "PENDING",
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
  await verifyWritePermission(supabase, userId);

  // 1. Verify PO exists and is DRAFT
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("po_status")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");
  if (po.po_status !== "DRAFT") {
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
      ship_from_warehouse_id: data.ship_from_warehouse_id || null,
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
  await verifyWritePermission(supabase, userId);

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("po_status, fulfillment_status")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");

  // Transition validation
  if (targetStatus === "APPROVED") {
    if (po.po_status !== "DRAFT") throw new Error("DRAFT 상태인 발주서만 승인할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        po_status: "APPROVED",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "SENT") {
    if (po.po_status !== "APPROVED") throw new Error("APPROVED 상태인 발주서만 발송 처리할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        po_status: "SENT",
        fulfillment_status: "PENDING",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "IN_PRODUCTION") {
    if (po.po_status !== "SENT") throw new Error("SENT 상태인 발주서만 생산 상태로 변경할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        fulfillment_status: "IN_PRODUCTION",
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "READY_TO_SHIP") {
    if (po.po_status !== "SENT") throw new Error("SENT 상태인 발주서만 선적대기 상태로 변경할 수 있습니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        fulfillment_status: "READY_TO_SHIP",
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  } else if (targetStatus === "CANCELLED") {
    if (po.po_status === "CANCELLED") throw new Error("이미 취소된 발주서입니다.");
    
    await supabase
      .from("purchase_orders")
      .update({
        po_status: "CANCELLED",
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
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("po_status")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");
  if (po.po_status !== "DRAFT") {
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

/**
 * Fetch all supplier change requests for a given PO on the admin side.
 */
export async function getSupplierPoChangeRequests(poId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("purchase_order_change_requests")
    .select(`
      id,
      purchase_order_line_id,
      request_type,
      original_qty,
      proposed_qty,
      reason,
      status,
      review_note,
      created_at,
      updated_at,
      requested_by_user:profiles!requested_by(display_name),
      requested_by_company:companies!requested_by_company_id(name)
    `)
    .eq("purchase_order_id", poId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch supplier change requests: ${error.message}`);
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    purchaseOrderLineId: r.purchase_order_line_id,
    requestType: r.request_type,
    originalQty: r.original_qty,
    proposedQty: r.proposed_qty,
    reason: r.reason,
    status: r.status,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    requestedByName: r.requested_by_user?.display_name || "Unknown Partner",
    companyName: r.requested_by_company?.name || "Unknown Company"
  }));
}

/**
 * Review a supplier change request (APPROVE or REJECT).
 */
export async function reviewSupplierPoChangeRequest(
  poId: string,
  requestId: string,
  action: "APPROVE" | "REJECT",
  note: string
) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  // 1. Fetch the request to verify status and details (with concurrency check)
  const { data: req, error: reqErr } = await supabase
    .from("purchase_order_change_requests")
    .select("id, status, proposed_qty, purchase_order_line_id")
    .eq("id", requestId)
    .eq("purchase_order_id", poId)
    .maybeSingle();

  if (reqErr || !req) {
    throw new Error("변경 요청 정보를 찾을 수 없습니다.");
  }

  if (req.status !== "PENDING") {
    throw new Error("이미 심사 완료된(APPROVED/REJECTED/WITHDRAWN) 요청은 다시 처리할 수 없습니다.");
  }

  const timestamp = new Date().toISOString();
  const finalStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  // 2. Perform Atomic status update first (filters on status = 'PENDING')
  const { data: updatedReq, error: updateErr } = await supabase
    .from("purchase_order_change_requests")
    .update({
      status: finalStatus,
      reviewed_by: userId,
      reviewed_at: timestamp,
      review_note: note,
      updated_at: timestamp
    })
    .eq("id", requestId)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();

  if (updateErr) throw new Error(`변경 제안 상태 업데이트 실패: ${updateErr.message}`);

  if (!updatedReq) {
    throw new Error("이미 다른 어드민이 처리 완료했거나 취소된 요청입니다.");
  }

  // 3. Apply confirmed_qty on the target line if approved
  if (action === "APPROVE") {
    const { error: lineErr } = await supabase
      .from("purchase_order_lines")
      .update({ confirmed_qty: req.proposed_qty })
      .eq("id", req.purchase_order_line_id);

    if (lineErr) throw new Error(`발주 품목 확정 수량 업데이트 실패: ${lineErr.message}`);
  }

  // 3. Evaluate PO-level supplier_confirmation_status
  // Check if any other PENDING requests remain
  const { data: pendingReqs } = await supabase
    .from("purchase_order_change_requests")
    .select("id")
    .eq("purchase_order_id", poId)
    .eq("status", "PENDING");

  if (!pendingReqs || pendingReqs.length === 0) {
    // Check if ALL lines of the PO now have confirmed_qty populated
    const { data: lines } = await supabase
      .from("purchase_order_lines")
      .select("id, confirmed_qty")
      .eq("purchase_order_id", poId);

    const allLinesConfirmed = lines && lines.length > 0 && lines.every(l => l.confirmed_qty !== null);

    if (allLinesConfirmed) {
      await supabase
        .from("purchase_orders")
        .update({ supplier_confirmation_status: "CONFIRMED" })
        .eq("id", poId);
    } else {
      // Revert status to PENDING so supplier can take action
      await supabase
        .from("purchase_orders")
        .update({ supplier_confirmation_status: "PENDING" })
        .eq("id", poId);
    }
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${poId}`);
  revalidatePath(`/portal/orders/purchase-orders/${poId}`);

  return { success: true };
}
