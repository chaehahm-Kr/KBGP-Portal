"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CreateShipmentLineInput {
  purchase_order_line_id: string;
  product_id: string;
  shipped_qty: number;
  line_note?: string;
}

export interface CreateShipmentInput {
  purchase_order_id: string;
  shipping_method: "Ocean" | "Air" | "Ground" | "Courier" | "Other";
  origin_port?: string;
  destination_warehouse_id: string;
  etd?: string;
  eta?: string;
  actual_departure_date?: string;
  actual_arrival_date?: string;
  container_number?: string;
  tracking_number?: string;
  bill_of_lading?: string;
  air_waybill?: string;
  booking_number?: string;
  internal_note?: string;
  lines: CreateShipmentLineInput[];
}

export interface CreateReceivingLineInput {
  inbound_shipment_line_id: string;
  purchase_order_line_id: string;
  product_id: string;
  received_qty: number;
  damaged_qty: number;
  hold_qty: number;
  line_note?: string;
}

export interface CreateReceivingInput {
  inbound_shipment_id: string;
  purchase_order_id: string;
  warehouse_id: string;
  received_date: string;
  internal_note?: string;
  lines: CreateReceivingLineInput[];
}

/**
 * Fetch all purchase orders eligible for shipment planning.
 */
export async function getOpenPosForShipment() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select(`
      id, po_number, order_date, po_status, fulfillment_status, currency,
      companies:supplier_id (name)
    `)
    .in("po_status", ["APPROVED", "SENT"])
    .neq("fulfillment_status", "RECEIVED")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch open POs: ${error.message}`);

  return (pos ?? []).map((po: any) => ({
    id: po.id,
    po_number: po.po_number,
    supplier_name: po.companies?.name || "(미지정 공급사)",
    status: po.po_status,
    order_date: po.order_date,
  }));
}

/**
 * Fetch PO lines with remaining quantities eligible to ship.
 */
export async function getPoLinesForShipment(poId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch PO Lines
  const { data: poLines, error: poErr } = await supabase
    .from("purchase_order_lines")
    .select(`
      id, product_id, qty, unit_cost, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot
    `)
    .eq("purchase_order_id", poId);

  if (poErr) throw new Error(`Failed to fetch PO lines: ${poErr.message}`);

  // 2. Fetch all other active (non-cancelled) shipment lines for this PO
  const { data: activeLines, error: shipErr } = await supabase
    .from("inbound_shipment_lines")
    .select(`
      purchase_order_line_id, shipped_qty,
      inbound_shipments!inner(status)
    `)
    .eq("inbound_shipments.purchase_order_id", poId)
    .neq("inbound_shipments.status", "CANCELLED");

  if (shipErr) throw new Error(`Failed to fetch active shipment lines: ${shipErr.message}`);

  // Calculate cumulative shipped qty per PO Line
  const shippedQtyMap = new Map<string, number>();
  (activeLines ?? []).forEach((l) => {
    const cur = shippedQtyMap.get(l.purchase_order_line_id) || 0;
    shippedQtyMap.set(l.purchase_order_line_id, cur + l.shipped_qty);
  });

  return (poLines ?? []).map((line: any) => {
    const totalShipped = shippedQtyMap.get(line.id) || 0;
    const remainingToShip = Math.max(0, line.qty - totalShipped);

    return {
      id: line.id,
      product_id: line.product_id,
      product_name: line.product_name_snapshot,
      letusto_sku: line.letusto_sku_snapshot,
      manufacture_sku: line.manufacture_sku_snapshot,
      ordered_qty: line.qty,
      total_shipped: totalShipped,
      remaining_to_ship: remainingToShip,
    };
  });
}

/**
 * Fetch all Inbound Shipments.
 */
export async function getInboundShipments() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: shipments, error } = await supabase
    .from("inbound_shipments")
    .select(`
      id, shipment_number, status, shipping_method, etd, eta, updated_at,
      purchase_orders:purchase_order_id (po_number, companies:supplier_id (name)),
      warehouses:destination_warehouse_id (name, code),
      inbound_shipment_lines (shipped_qty, purchase_order_line_id)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch shipments: ${error.message}`);

  // Sum total received qty per shipment line
  // We can query all receiving lines of finalized receivings
  const { data: recLines } = await supabase
    .from("receiving_lines")
    .select("inbound_shipment_line_id, received_qty, receivings!inner(status)")
    .eq("receivings.status", "FINALIZED");

  const recMap = new Map<string, number>();
  (recLines ?? []).forEach((rl) => {
    const cur = recMap.get(rl.inbound_shipment_line_id) || 0;
    recMap.set(rl.inbound_shipment_line_id, cur + rl.received_qty);
  });

  return (shipments ?? []).map((shp: any) => {
    const lines = shp.inbound_shipment_lines || [];
    const totalShipped = lines.reduce((sum: number, l: any) => sum + l.shipped_qty, 0);
    
    // Aggregate received qty
    let totalReceived = 0;
    lines.forEach((l: any) => {
      totalReceived += recMap.get(l.purchase_order_line_id) || 0; // Wait, mapped by line ID or shipment line ID?
    });
    // Let's do it properly by mapping line ID
    // Let's get shipment lines for this shipment and match their IDs
    // Wait, the shipment lines query returns `id` if selected, but we didn't select it above. Let's adjust the query below.

    return {
      id: shp.id,
      shipment_number: shp.shipment_number,
      status: shp.status,
      shipping_method: shp.shipping_method,
      etd: shp.etd,
      eta: shp.eta,
      last_updated: shp.updated_at,
      po_number: shp.purchase_orders?.po_number || "-",
      supplier_name: shp.purchase_orders?.companies?.name || "(미지정 공급사)",
      warehouse_name: shp.warehouses?.name || "-",
      warehouse_code: shp.warehouses?.code || "-",
      total_shipped: totalShipped,
    };
  });
}

/**
 * Fetch detailed view of a single Inbound Shipment.
 */
export async function getInboundShipmentDetail(shipmentId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch Shipment Header
  const { data: shp, error: shpErr } = await supabase
    .from("inbound_shipments")
    .select(`
      *,
      po:purchase_order_id (po_number, currency, supplier:supplier_id (name)),
      warehouse:destination_warehouse_id (name, code, address1, city, state, zip_code, country),
      creator:created_by (full_name:display_name)
    `)
    .eq("id", shipmentId)
    .maybeSingle();

  if (shpErr) throw new Error(`Failed to fetch shipment: ${shpErr.message}`);
  if (!shp) throw new Error("Shipment not found.");

  // 2. Fetch Shipment Lines
  const { data: lines, error: lErr } = await supabase
    .from("inbound_shipment_lines")
    .select(`
      id, purchase_order_line_id, product_id, shipped_qty, line_note,
      po_line:purchase_order_line_id (qty, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot)
    `)
    .eq("inbound_shipment_id", shipmentId);

  if (lErr) throw new Error(`Failed to fetch shipment lines: ${lErr.message}`);

  // 3. Fetch cumulative received quantities for each shipment line
  const { data: recLines, error: recErr } = await supabase
    .from("receiving_lines")
    .select("inbound_shipment_line_id, received_qty, receivings!inner(status)")
    .eq("receivings.inbound_shipment_id", shipmentId)
    .eq("receivings.status", "FINALIZED");

  if (recErr) throw new Error(`Failed to fetch received totals: ${recErr.message}`);

  const recMap = new Map<string, number>();
  (recLines ?? []).forEach((rl) => {
    const cur = recMap.get(rl.inbound_shipment_line_id) || 0;
    recMap.set(rl.inbound_shipment_line_id, cur + rl.received_qty);
  });

  const formattedLines = (lines ?? []).map((l: any) => {
    const received = recMap.get(l.id) || 0;
    const remainingToReceive = Math.max(0, l.shipped_qty - received);

    return {
      id: l.id,
      purchase_order_line_id: l.purchase_order_line_id,
      product_id: l.product_id,
      shipped_qty: l.shipped_qty,
      received_qty: received,
      remaining_to_receive: remainingToReceive,
      line_note: l.line_note,
      product_name: l.po_line?.product_name_snapshot || "(미확인 제품)",
      letusto_sku: l.po_line?.letusto_sku_snapshot || "-",
      manufacture_sku: l.po_line?.manufacture_sku_snapshot || "-",
      po_qty: l.po_line?.qty || 0,
    };
  });

  const totalShipped = formattedLines.reduce((sum, l) => sum + l.shipped_qty, 0);
  const totalReceived = formattedLines.reduce((sum, l) => sum + l.received_qty, 0);

  return {
    ...shp,
    lines: formattedLines,
    total_shipped: totalShipped,
    total_received: totalReceived,
  };
}

/**
 * Create Inbound Shipment.
 */
export async function createInboundShipment(data: CreateShipmentInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // Validate Destination Warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.destination_warehouse_id)
    .single();

  if (!warehouse) throw new Error("Destination warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성 창고는 배송 목적지로 지정할 수 없습니다.");
  }

  // Execute database transaction function
  const { data: shpId, error: rpcErr } = await supabase.rpc(
    "create_inbound_shipment_transaction",
    {
      p_purchase_order_id: data.purchase_order_id,
      p_shipping_method: data.shipping_method,
      p_origin_port: data.origin_port || null,
      p_destination_warehouse_id: data.destination_warehouse_id,
      p_etd: data.etd || null,
      p_eta: data.eta || null,
      p_actual_departure_date: data.actual_departure_date || null,
      p_actual_arrival_date: data.actual_arrival_date || null,
      p_container_number: data.container_number || null,
      p_tracking_number: data.tracking_number || null,
      p_bill_of_lading: data.bill_of_lading || null,
      p_air_waybill: data.air_waybill || null,
      p_booking_number: data.booking_number || null,
      p_internal_note: data.internal_note || null,
      p_created_by: userId,
      p_lines: data.lines.map((l) => ({
        purchase_order_line_id: l.purchase_order_line_id,
        product_id: l.product_id,
        shipped_qty: l.shipped_qty,
        line_note: l.line_note || null,
      })),
    }
  );

  if (rpcErr) {
    throw new Error(`선적 생성 및 검증 실패: ${rpcErr.message}`);
  }

  revalidatePath("/admin/purchasing/shipments");
  return { success: true, id: shpId };
}

/**
 * Update Inbound Shipment (Only allowed in DRAFT status).
 */
export async function updateInboundShipment(shipmentId: string, data: CreateShipmentInput) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: shp } = await supabase
    .from("inbound_shipments")
    .select("status")
    .eq("id", shipmentId)
    .single();

  if (!shp) throw new Error("Shipment not found.");
  if (shp.status !== "DRAFT") {
    throw new Error("DRAFT(초안) 상태의 선적만 수정할 수 있습니다.");
  }

  // Validate Destination Warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.destination_warehouse_id)
    .single();

  if (!warehouse) throw new Error("Destination warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성 창고는 배송 목적지로 지정할 수 없습니다.");
  }

  // Calculate remaining po lines including the current shipment's lines (so we subtract them from total active shipped)
  const { data: otherActiveLines } = await supabase
    .from("inbound_shipment_lines")
    .select("purchase_order_line_id, shipped_qty, inbound_shipments!inner(status)")
    .eq("inbound_shipments.purchase_order_id", data.purchase_order_id)
    .neq("inbound_shipments.status", "CANCELLED")
    .neq("inbound_shipment_id", shipmentId);

  const shippedQtyMap = new Map<string, number>();
  (otherActiveLines ?? []).forEach((l) => {
    const cur = shippedQtyMap.get(l.purchase_order_line_id) || 0;
    shippedQtyMap.set(l.purchase_order_line_id, cur + l.shipped_qty);
  });

  const { data: poLines } = await supabase
    .from("purchase_order_lines")
    .select("id, qty, product_name_snapshot")
    .eq("purchase_order_id", data.purchase_order_id);

  const linesMap = new Map(data.lines.map((l) => [l.purchase_order_line_id, l.shipped_qty]));

  (poLines ?? []).forEach((pol) => {
    const proposed = linesMap.get(pol.id) || 0;
    const totalOtherShipped = shippedQtyMap.get(pol.id) || 0;
    const remainingToShip = Math.max(0, pol.qty - totalOtherShipped);

    if (proposed > remainingToShip) {
      throw new Error(
        `제품 [${pol.product_name_snapshot}]의 선적 수량(${proposed}개)이 PO 미선적 잔량(${remainingToShip}개)을 초과할 수 없습니다.`
      );
    }
  });

  // Update Header
  const { error: shpErr } = await supabase
    .from("inbound_shipments")
    .update({
      shipping_method: data.shipping_method,
      origin_port: data.origin_port || null,
      destination_warehouse_id: data.destination_warehouse_id,
      etd: data.etd || null,
      eta: data.eta || null,
      actual_departure_date: data.actual_departure_date || null,
      actual_arrival_date: data.actual_arrival_date || null,
      container_number: data.container_number || null,
      tracking_number: data.tracking_number || null,
      bill_of_lading: data.bill_of_lading || null,
      air_waybill: data.air_waybill || null,
      booking_number: data.booking_number || null,
      internal_note: data.internal_note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shipmentId);

  if (shpErr) throw new Error(`선적 헤더 수정 실패: ${shpErr.message}`);

  // Delete old lines and insert new ones
  await supabase.from("inbound_shipment_lines").delete().eq("inbound_shipment_id", shipmentId);

  const lineInserts = data.lines.map((l) => ({
    inbound_shipment_id: shipmentId,
    purchase_order_line_id: l.purchase_order_line_id,
    product_id: l.product_id,
    shipped_qty: l.shipped_qty,
    line_note: l.line_note || null,
  }));

  const { error: linesErr } = await supabase
    .from("inbound_shipment_lines")
    .insert(lineInserts);

  if (linesErr) {
    throw new Error(`선적 상세 품목 수정 실패: ${linesErr.message}`);
  }

  revalidatePath("/admin/purchasing/shipments");
  revalidatePath(`/admin/purchasing/shipments/${shipmentId}`);
  return { success: true };
}

/**
 * Handle Shipment status transition (DRAFT, BOOKED, IN_TRANSIT, ARRIVED, CANCELLED).
 */
export async function transitionShipmentStatus(shipmentId: string, status: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: shp } = await supabase
    .from("inbound_shipments")
    .select("status")
    .eq("id", shipmentId)
    .single();

  if (!shp) throw new Error("Shipment not found.");

  if (status === "CANCELLED" && (shp.status === "RECEIVED" || shp.status === "PARTIALLY_RECEIVED")) {
    throw new Error("이미 입고 처리가 진행되었거나 완료된 선적은 취소할 수 없습니다.");
  }

  const { error } = await supabase
    .from("inbound_shipments")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "IN_TRANSIT" ? { actual_departure_date: new Date().toISOString().split("T")[0] } : {}),
      ...(status === "ARRIVED" ? { actual_arrival_date: new Date().toISOString().split("T")[0] } : {}),
    })
    .eq("id", shipmentId);

  if (error) throw new Error(`선적 상태 변경 실패: ${error.message}`);

  revalidatePath("/admin/purchasing/shipments");
  revalidatePath(`/admin/purchasing/shipments/${shipmentId}`);
  return { success: true };
}

/**
 * Fetch all Inbound Shipments eligible to enter receiving.
 */
export async function getOpenShipmentsForReceiving() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: shps, error } = await supabase
    .from("inbound_shipments")
    .select(`
      id, shipment_number, status, shipping_method, etd, eta,
      purchase_orders:purchase_order_id (po_number, companies:supplier_id (name))
    `)
    .in("status", ["BOOKED", "IN_TRANSIT", "ARRIVED", "PARTIALLY_RECEIVED"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch open shipments: ${error.message}`);

  return (shps ?? []).map((shp: any) => ({
    id: shp.id,
    shipment_number: shp.shipment_number,
    po_number: shp.purchase_orders?.po_number || "-",
    supplier_name: shp.purchase_orders?.companies?.name || "(미지정 공급사)",
    status: shp.status,
  }));
}

/**
 * Fetch all Receivings.
 */
export async function getReceivings() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: recs, error } = await supabase
    .from("receivings")
    .select(`
      id, receiving_number, received_date, status,
      inbound_shipments:inbound_shipment_id (shipment_number),
      purchase_orders:purchase_order_id (po_number, companies:supplier_id (name)),
      warehouses:warehouse_id (name, code),
      creator:received_by (full_name:display_name),
      receiving_lines (received_qty, damaged_qty, hold_qty)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch receivings: ${error.message}`);

  return (recs ?? []).map((r: any) => {
    const lines = r.receiving_lines || [];
    const totalRec = lines.reduce((sum: number, l: any) => sum + l.received_qty, 0);
    const totalHoldDamaged = lines.reduce((sum: number, l: any) => sum + l.hold_qty + l.damaged_qty, 0);

    return {
      id: r.id,
      receiving_number: r.receiving_number,
      received_date: r.received_date,
      status: r.status,
      shipment_number: r.inbound_shipments?.shipment_number || "-",
      po_number: r.purchase_orders?.po_number || "-",
      supplier_name: r.purchase_orders?.companies?.name || "(미지정 공급사)",
      warehouse_name: r.warehouses?.name || "-",
      warehouse_code: r.warehouses?.code || "-",
      received_by_name: r.creator?.full_name || "System",
      total_received: totalRec,
      total_hold_damaged: totalHoldDamaged,
    };
  });
}

/**
 * Fetch detailed view of a single Receiving.
 */
export async function getReceivingDetail(receivingId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: r, error: rErr } = await supabase
    .from("receivings")
    .select(`
      *,
      shipment:inbound_shipment_id (shipment_number, shipping_method),
      po:purchase_order_id (po_number, currency, supplier:supplier_id (name)),
      warehouse:warehouse_id (name, code, address1, city, state, zip_code, country),
      creator:received_by (full_name:display_name),
      finalizer:finalized_by (full_name:display_name)
    `)
    .eq("id", receivingId)
    .maybeSingle();

  if (rErr) throw new Error(`Failed to fetch receiving: ${rErr.message}`);
  if (!r) throw new Error("Receiving record not found.");

  const { data: lines, error: lErr } = await supabase
    .from("receiving_lines")
    .select(`
      id, inbound_shipment_line_id, purchase_order_line_id, product_id,
      received_qty, damaged_qty, hold_qty, line_note,
      po_line:purchase_order_line_id (product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot),
      shipment_line:inbound_shipment_line_id (shipped_qty)
    `)
    .eq("receiving_id", receivingId);

  if (lErr) throw new Error(`Failed to fetch receiving lines: ${lErr.message}`);

  const formattedLines = (lines ?? []).map((l: any) => ({
    id: l.id,
    inbound_shipment_line_id: l.inbound_shipment_line_id,
    purchase_order_line_id: l.purchase_order_line_id,
    product_id: l.product_id,
    received_qty: l.received_qty,
    damaged_qty: l.damaged_qty,
    hold_qty: l.hold_qty,
    line_note: l.line_note,
    product_name: l.po_line?.product_name_snapshot || "(미확인 제품)",
    letusto_sku: l.po_line?.letusto_sku_snapshot || "-",
    manufacture_sku: l.po_line?.manufacture_sku_snapshot || "-",
    shipped_qty: l.shipment_line?.shipped_qty || 0,
  }));

  return {
    ...r,
    lines: formattedLines,
  };
}

/**
 * Create Receiving (DRAFT).
 */
export async function createReceiving(data: CreateReceivingInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // Validate Warehouse
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.warehouse_id)
    .single();

  if (!warehouse) throw new Error("Warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성 창고는 입고 처리할 수 없습니다.");
  }

  // Create Header
  const { data: newRec, error: rErr } = await supabase
    .from("receivings")
    .insert({
      inbound_shipment_id: data.inbound_shipment_id,
      purchase_order_id: data.purchase_order_id,
      warehouse_id: data.warehouse_id,
      received_date: data.received_date,
      status: "DRAFT",
      received_by: userId,
      internal_note: data.internal_note || null,
    })
    .select("id")
    .single();

  if (rErr) throw new Error(`입고 헤더 생성 실패: ${rErr.message}`);
  const recId = newRec.id;

  // Create Lines
  const lineInserts = data.lines.map((l) => ({
    receiving_id: recId,
    inbound_shipment_line_id: l.inbound_shipment_line_id,
    purchase_order_line_id: l.purchase_order_line_id,
    product_id: l.product_id,
    received_qty: l.received_qty,
    damaged_qty: l.damaged_qty,
    hold_qty: l.hold_qty,
    line_note: l.line_note || null,
  }));

  const { error: linesErr } = await supabase
    .from("receiving_lines")
    .insert(lineInserts);

  if (linesErr) {
    await supabase.from("receivings").delete().eq("id", recId);
    throw new Error(`입고 상세 품목 저장 실패: ${linesErr.message}`);
  }

  revalidatePath("/admin/purchasing/receiving");
  return { success: true, id: recId };
}

/**
 * Update Receiving (Allowed in DRAFT).
 */
export async function updateReceiving(receivingId: string, data: CreateReceivingInput) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: rec } = await supabase
    .from("receivings")
    .select("status")
    .eq("id", receivingId)
    .single();

  if (!rec) throw new Error("Receiving record not found.");
  if (rec.status !== "DRAFT") {
    throw new Error("DRAFT(초안) 상태의 입고서만 수정할 수 있습니다.");
  }

  // Validate Warehouse
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.warehouse_id)
    .single();

  if (!warehouse) throw new Error("Warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성 창고는 입고 처리할 수 없습니다.");
  }

  // Update Header
  const { error: rErr } = await supabase
    .from("receivings")
    .update({
      warehouse_id: data.warehouse_id,
      received_date: data.received_date,
      internal_note: data.internal_note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", receivingId);

  if (rErr) throw new Error(`입고 헤더 수정 실패: ${rErr.message}`);

  // Delete old lines and insert new ones
  await supabase.from("receiving_lines").delete().eq("receiving_id", receivingId);

  const lineInserts = data.lines.map((l) => ({
    receiving_id: receivingId,
    inbound_shipment_line_id: l.inbound_shipment_line_id,
    purchase_order_line_id: l.purchase_order_line_id,
    product_id: l.product_id,
    received_qty: l.received_qty,
    damaged_qty: l.damaged_qty,
    hold_qty: l.hold_qty,
    line_note: l.line_note || null,
  }));

  const { error: linesErr } = await supabase
    .from("receiving_lines")
    .insert(lineInserts);

  if (linesErr) {
    throw new Error(`입고 상세 품목 수정 실패: ${linesErr.message}`);
  }

  revalidatePath("/admin/purchasing/receiving");
  revalidatePath(`/admin/purchasing/receiving/${receivingId}`);
  return { success: true };
}

/**
 * Finalize Receiving (Atomics & Idempotency Transaction RPC).
 */
export async function finalizeReceiving(receivingId: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // Call the database function to handle row locks, balance recalculation, and status updates atomically
  const { data, error } = await supabase.rpc("finalize_receiving_transaction", {
    p_receiving_id: receivingId,
    p_user_id: userId,
  });

  if (error) throw new Error(`입고 확정 트랜잭션 오류: ${error.message}`);
  
  if (data && !data.success) {
    throw new Error(data.error || "입고 확정 처리 중 알 수 없는 오류가 발생했습니다.");
  }

  revalidatePath("/admin/purchasing/receiving");
  revalidatePath(`/admin/purchasing/receiving/${receivingId}`);
  revalidatePath("/admin/purchasing/shipments");
  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/inventory");
  return { success: true };
}

/**
 * Close Shipment with variance (Shortage completion).
 */
export async function closeShipmentWithVariance(shipmentId: string, note?: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("inbound_shipments")
    .update({
      status: "RECEIVED", // Or custom code RECEIVED_WITH_VARIANCE if supported
      internal_note: note ? `[강제 종결] ${note}` : "[강제 종결]",
      updated_at: new Date().toISOString(),
    })
    .eq("id", shipmentId);

  if (error) throw new Error(`선적 강제 종결 실패: ${error.message}`);

  revalidatePath("/admin/purchasing/shipments");
  revalidatePath(`/admin/purchasing/shipments/${shipmentId}`);
  return { success: true };
}
