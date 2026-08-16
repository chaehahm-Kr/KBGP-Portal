"use server";

import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetch all purchase orders belonging to the logged-in supplier company.
 */
export async function getPortalPurchaseOrders() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portal_purchase_orders")
    .select(`
      id,
      po_number,
      po_status,
      fulfillment_status,
      supplier_confirmation_status,
      order_date,
      currency,
      created_at,
      lines:purchase_order_lines(qty, confirmed_qty)
    `)
    .eq("supplier_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch portal purchase orders:", error);
    throw new Error("발주서 목록을 불러오지 못했습니다.");
  }

  // Calculate totals client-side or in action mapping
  return data ?? [];
}

/**
 * Fetch a single purchase order by ID with secure company-scoping.
 */
export async function getPortalPurchaseOrderById(id: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portal_purchase_orders")
    .select(`
      id,
      po_number,
      po_status,
      fulfillment_status,
      supplier_confirmation_status,
      order_date,
      currency,
      created_at,
      lines:purchase_order_lines(
        id,
        qty,
        confirmed_qty,
        unit_cost,
        line_note,
        product:products(
          id,
          name,
          letusto_sku,
          manufacture_sku
        )
      )
    `)
    .eq("id", id)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch portal purchase order detail:", error);
    throw new Error("발주서 상세 정보를 불러오지 못했습니다.");
  }

  if (!data) {
    throw new Error("발주서가 존재하지 않거나 접근 권한이 없습니다.");
  }

  // Format line products from array to a single object
  const formattedLines = (data.lines || []).map((l: any) => {
    const productArray = Array.isArray(l.product) ? l.product : (l.product ? [l.product] : []);
    const productObj = productArray[0] || { id: "", name: "", letusto_sku: "", manufacture_sku: "" };
    return {
      id: l.id,
      qty: l.qty,
      confirmed_qty: l.confirmed_qty,
      unit_cost: l.unit_cost,
      line_note: l.line_note,
      product: {
        id: productObj.id,
        name: productObj.name,
        letusto_sku: productObj.letusto_sku,
        manufacture_sku: productObj.manufacture_sku
      }
    };
  });

  return {
    id: data.id,
    po_number: data.po_number,
    po_status: data.po_status,
    fulfillment_status: data.fulfillment_status,
    supplier_confirmation_status: data.supplier_confirmation_status,
    order_date: data.order_date,
    currency: data.currency,
    created_at: data.created_at,
    lines: formattedLines
  };
}

/**
 * Fetch all shipments where the logged-in supplier participates.
 */
export async function getPortalShipments() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portal_inbound_shipments")
    .select(`
      id,
      shipment_number,
      status,
      shipping_method,
      shipping_responsibility,
      carrier,
      origin_port,
      destination_warehouse_id,
      etd,
      eta,
      actual_departure_date,
      actual_arrival_date,
      container_number,
      tracking_number,
      bill_of_lading,
      air_waybill,
      booking_number,
      created_at,
      lines:inbound_shipment_lines!inner(
        id,
        shipped_qty,
        purchase_order_line:purchase_order_lines!inner(
          id,
          qty,
          unit_cost,
          purchase_order:purchase_orders!inner(
            id,
            po_number,
            supplier_id
          )
        )
      )
    `)
    .eq("inbound_shipment_lines.purchase_order_line.purchase_order.supplier_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch portal shipments:", error);
    throw new Error("선적 목록을 불러오지 못했습니다.");
  }

  return data ?? [];
}

/**
 * Fetch a single shipment with secure company-scoping.
 */
export async function getPortalShipmentById(id: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portal_inbound_shipments")
    .select(`
      id,
      shipment_number,
      status,
      shipping_method,
      origin_port,
      destination_warehouse_id,
      etd,
      eta,
      actual_departure_date,
      actual_arrival_date,
      container_number,
      tracking_number,
      bill_of_lading,
      air_waybill,
      booking_number,
      created_at,
      lines:inbound_shipment_lines!inner(
        id,
        shipped_qty,
        line_note,
        product:products(
          id,
          name,
          letusto_sku,
          manufacture_sku
        ),
        purchase_order_line:purchase_order_lines!inner(
          id,
          qty,
          unit_cost,
          purchase_order:purchase_orders!inner(
            id,
            po_number,
            supplier_id
          )
        )
      )
    `)
    .eq("id", id)
    .eq("inbound_shipment_lines.purchase_order_line.purchase_order.supplier_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch portal shipment detail:", error);
    throw new Error("선적 상세 정보를 불러오지 못했습니다.");
  }

  if (!data) {
    throw new Error("선적 건이 존재하지 않거나 접근 권한이 없습니다.");
  }

  return data;
}

/**
 * Fetch all receivings associated with the logged-in supplier's POs.
 */
export async function getPortalReceivings() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portal_receivings")
    .select(`
      id,
      receiving_number,
      inbound_shipment_id,
      purchase_order_id,
      warehouse_id,
      received_date,
      status,
      created_at,
      purchase_order:purchase_orders!inner(
        id,
        po_number,
        supplier_id
      )
    `)
    .eq("purchase_order.supplier_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch portal receivings:", error);
    throw new Error("입고 내역 목록을 불러오지 못했습니다.");
  }

  return data ?? [];
}

/**
 * Fetch a single receiving record with secure company-scoping.
 */
export async function getPortalReceivingById(id: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portal_receivings")
    .select(`
      id,
      receiving_number,
      inbound_shipment_id,
      purchase_order_id,
      warehouse_id,
      received_date,
      status,
      created_at,
      purchase_order:purchase_orders!inner(
        id,
        po_number,
        supplier_id
      ),
      lines:receiving_lines!inner(
        id,
        received_qty,
        hold_qty,
        damaged_qty,
        product:products(
          id,
          name,
          letusto_sku,
          manufacture_sku
        ),
        purchase_order_line:purchase_order_lines!inner(
          id,
          qty,
          unit_cost
        )
      )
    `)
    .eq("id", id)
    .eq("purchase_order.supplier_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch portal receiving detail:", error);
    throw new Error("입고 상세 정보를 불러오지 못했습니다.");
  }

  if (!data) {
    throw new Error("입고 내역이 존재하지 않거나 접근 권한이 없습니다.");
  }

  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// PO Collaboration Server Actions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Supplier confirms a PO directly (confirmed_qty = qty for all lines).
 */
export async function confirmPortalPurchaseOrder(poId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // 1. Verify PO exists and belongs to company
  const { data: po, error: poErr } = await supabase
    .from("portal_purchase_orders")
    .select("id, po_status")
    .eq("id", poId)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (poErr || !po) {
    throw new Error("발주서를 찾을 수 없거나 접근 권한이 없습니다.");
  }

  // 2. Fetch lines
  const { data: lines, error: linesErr } = await supabase
    .from("purchase_order_lines")
    .select("id, qty")
    .eq("purchase_order_id", poId);

  if (linesErr || !lines) {
    throw new Error("발주 품목 상세 조회를 실패했습니다.");
  }

  // 3. Set confirmed_qty = qty
  for (const line of lines) {
    const { error: updateLineErr } = await supabase
      .from("purchase_order_lines")
      .update({ confirmed_qty: line.qty })
      .eq("id", line.id);

    if (updateLineErr) throw updateLineErr;
  }

  // 4. Update PO confirmation status
  const { error: updatePoErr } = await supabase
    .from("purchase_orders")
    .update({ supplier_confirmation_status: "CONFIRMED" })
    .eq("id", poId);

  if (updatePoErr) throw updatePoErr;

  revalidatePath(`/portal/orders/purchase-orders/${poId}`);
  revalidatePath(`/admin/purchasing/${poId}`);
  return { success: true };
}

/**
 * Supplier submits a change request proposal for PO lines.
 */
export async function submitPortalPoChangeRequest(
  poId: string,
  lineRequests: { lineId: string; proposedQty: number; reason: string }[]
) {
  const { companyId, userId } = await requireCompanyMembership();
  const supabase = await createClient();

  if (lineRequests.length === 0) {
    throw new Error("변경 요청 항목이 존재하지 않습니다.");
  }

  // 1. Verify PO belongs to company
  const { data: po, error: poErr } = await supabase
    .from("portal_purchase_orders")
    .select("id")
    .eq("id", poId)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (poErr || !po) {
    throw new Error("발주서를 찾을 수 없거나 접근 권한이 없습니다.");
  }

  // 2. Check for existing PENDING request on these lines
  const targetLineIds = lineRequests.map(r => r.lineId);
  const { data: activePending } = await supabase
    .from("purchase_order_change_requests")
    .select("purchase_order_line_id")
    .in("purchase_order_line_id", targetLineIds)
    .eq("status", "PENDING");

  if (activePending && activePending.length > 0) {
    throw new Error("이미 진행 중인(대기 상태인) 변경 요청이 일부 항목에 존재합니다. 승인/반려 완료 후 재시도하세요.");
  }

  // 3. Fetch original lines
  const { data: lines, error: linesErr } = await supabase
    .from("purchase_order_lines")
    .select("id, qty, unit_cost")
    .in("id", targetLineIds);

  if (linesErr || !lines) {
    throw new Error("발주 품목의 원본 세부 정보를 매칭하지 못했습니다.");
  }

  const linesMap = new Map(lines.map(l => [l.id, l]));

  // 4. Insert change requests
  const inserts = lineRequests.map(req => {
    const orig = linesMap.get(req.lineId);
    if (!orig) throw new Error("유효하지 않은 발주 품목 라인 ID가 포함되어 있습니다.");

    return {
      purchase_order_id: poId,
      purchase_order_line_id: req.lineId,
      requested_by: userId,
      requested_by_company_id: companyId,
      request_type: "QUANTITY" as const,
      original_qty: orig.qty,
      proposed_qty: req.proposedQty,
      original_unit_price: Number(orig.unit_cost),
      proposed_unit_price: Number(orig.unit_cost), // PRICE change deferred for V1
      reason: req.reason,
      status: "PENDING" as const
    };
  });

  const { error: insertErr } = await supabase
    .from("purchase_order_change_requests")
    .insert(inserts);

  if (insertErr) {
    console.error("Change request insertion error:", insertErr);
    throw new Error(`변경 제안 등록에 실패했습니다: ${insertErr.message}`);
  }

  // 5. Update PO level confirmation status
  const { error: updatePoErr } = await supabase
    .from("purchase_orders")
    .update({ supplier_confirmation_status: "CHANGE_REQUESTED" })
    .eq("id", poId);

  if (updatePoErr) throw updatePoErr;

  revalidatePath(`/portal/orders/purchase-orders/${poId}`);
  revalidatePath(`/admin/purchasing/${poId}`);
  return { success: true };
}

/**
 * Supplier withdraws a pending change request.
 */
export async function withdrawPortalPoChangeRequest(requestId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // 1. Fetch request to verify ownership and status
  const { data: req, error: reqErr } = await supabase
    .from("purchase_order_change_requests")
    .select("id, purchase_order_id, status")
    .eq("id", requestId)
    .eq("requested_by_company_id", companyId)
    .maybeSingle();

  if (reqErr || !req) {
    throw new Error("해당 변경 요청 건을 찾을 수 없거나 접근 권한이 없습니다.");
  }

  if (req.status !== "PENDING") {
    throw new Error("이미 심사 완료된(APPROVED/REJECTED/WITHDRAWN) 요청은 철회할 수 없습니다.");
  }

  // 2. Perform atomic UPDATE
  const { error: updateErr } = await supabase
    .from("purchase_order_change_requests")
    .update({ status: "WITHDRAWN", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateErr) throw updateErr;

  // 3. Evaluate if there are other pending requests for this PO
  const { data: remainingPending } = await supabase
    .from("purchase_order_change_requests")
    .select("id")
    .eq("purchase_order_id", req.purchase_order_id)
    .eq("status", "PENDING");

  if (!remainingPending || remainingPending.length === 0) {
    // Revert PO status back to PENDING if no other requests are pending
    const { error: poRestoreErr } = await supabase
      .from("purchase_orders")
      .update({ supplier_confirmation_status: "PENDING" })
      .eq("id", req.purchase_order_id);

    if (poRestoreErr) throw poRestoreErr;
  }

  revalidatePath(`/portal/orders/purchase-orders/${req.purchase_order_id}`);
  revalidatePath(`/admin/purchasing/${req.purchase_order_id}`);
  return { success: true };
}

/**
 * Fetch all change requests for a given PO in the portal.
 */
export async function getPortalPoChangeRequests(poId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

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
      reviewer:profiles!reviewed_by(display_name)
    `)
    .eq("purchase_order_id", poId)
    .eq("requested_by_company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch portal PO change requests:", error);
    throw new Error("변경 요청 이력을 불러오지 못했습니다.");
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
    reviewerName: r.reviewer?.display_name || null
  }));
}

/**
 * Upload a document to company-uploads bucket under the shipping/ path.
 */
export async function uploadShippingAttachment(formData: FormData) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient(); // run upload as authenticated user to verify storage RLS

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "업로드할 파일을 찾을 수 없습니다." };
  }

  // Validate file
  const { validateUploadedFile } = await import("@/lib/files/validate");
  const validation = await validateUploadedFile(file, ["image", "document"]);
  if (!validation.ok) {
    throw new Error(`파일 검증 실패: ${validation.error}`);
  }

  let ext = "pdf";
  if (validation.detectedMime.startsWith("image/")) {
    ext = validation.detectedMime === "image/png" ? "png" : validation.detectedMime === "image/webp" ? "webp" : "jpg";
  }

  // Pre-qualify paths with companyId to enforce storage policies
  const path = `${companyId}/shipping/${globalThis.crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: validation.detectedMime, upsert: false });

  if (error) {
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  return { path, filename: file.name };
}

export async function getShippingAttachmentUrl(path: string) {
  // Verifies membership
  const { companyId } = await requireCompanyMembership();
  
  // Verify that the file path prefix folder matches the supplier's companyId
  const pathParts = path.split('/');
  const pathCompanyId = pathParts[0];
  if (pathCompanyId !== companyId) {
    throw new Error("Access denied: You do not own this attachment.");
  }

  const { getSignedFileUrl } = await import("@/lib/files/storage");
  return await getSignedFileUrl(path);
}

/**
 * Submit or update draft goods readiness from supplier.
 */
export async function submitPortalGoodsReady(input: {
  id?: string;
  purchaseOrderId: string;
  goodsReadyDate: string;
  pickupLocation: string;
  handoverLocation: string;
  fobPort: string;
  warehouseFactoryAddress: string;
  contactPerson: string;
  specialInstructions: string;
  packingListPath: string | null;
  packingListFilename: string | null;
  commercialInvoicePath: string | null;
  commercialInvoiceFilename: string | null;
  handoverStatus: 'DRAFT' | 'READY_SUBMITTED';
  lines: Array<{
    purchaseOrderLineId: string;
    productId: string;
    readyQty: number;
    cartons: number;
    grossWeight: number;
    cbm: number;
  }>;
}) {
  const { companyId, userId } = await requireCompanyMembership();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient(); // Bypasses RLS to write to restricted tables

  // 1. Verify PO ownership
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, shipping_responsibility")
    .eq("id", input.purchaseOrderId)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (poErr || !po) {
    throw new Error("발주서 정보를 확인하지 못했거나 접근 권한이 없습니다.");
  }

  // 2. Compute Overage
  let overageDetected = false;
  const verifiedLines = [];

  for (const line of input.lines) {
    // Get PO line details
    const { data: pol } = await supabase
      .from("purchase_order_lines")
      .select("qty, confirmed_qty, product_name_snapshot")
      .eq("id", line.purchaseOrderLineId)
      .maybeSingle();

    if (!pol) throw new Error("발주 품목 라인을 확인할 수 없습니다.");

    // 1. Fetch cumulative shipped quantities
    const { data: shipData } = await supabase
      .from("inbound_shipment_lines")
      .select("shipped_qty, inbound_shipments!inner(status)")
      .eq("purchase_order_line_id", line.purchaseOrderLineId)
      .neq("inbound_shipments.status", "CANCELLED");

    const cumulativeShipped = (shipData ?? []).reduce((sum, s: any) => sum + s.shipped_qty, 0);

    // 2. Fetch active readiness lines (excluding current readiness ID)
    const { data: grLines } = await supabase
      .from("goods_readiness_lines")
      .select("id, ready_qty, goods_readiness!inner(id, handover_status)")
      .eq("purchase_order_line_id", line.purchaseOrderLineId)
      .neq("goods_readiness.id", input.id || "00000000-0000-0000-0000-000000000000")
      .in("goods_readiness.handover_status", ["READY_SUBMITTED", "HANDOVER_PENDING", "HANDED_OVER"]);

    let activeReady = 0;
    for (const grl of (grLines ?? [])) {
      const { data: linkedShip } = await supabase
        .from("inbound_shipment_lines")
        .select("id, inbound_shipments!inner(status)")
        .eq("goods_readiness_line_id", grl.id)
        .neq("inbound_shipments.status", "CANCELLED")
        .maybeSingle();

      if (!linkedShip) {
        activeReady += grl.ready_qty;
      }
    }

    const targetQty = pol.confirmed_qty !== null ? pol.confirmed_qty : pol.qty;
    const remainingAvailable = Math.max(0, targetQty - cumulativeShipped - activeReady);

    if (line.readyQty > remainingAvailable) {
      overageDetected = true;
    }

    verifiedLines.push({
      purchase_order_line_id: line.purchaseOrderLineId,
      product_id: line.productId,
      ready_qty: line.readyQty,
      cartons: line.cartons,
      gross_weight: line.grossWeight,
      cbm: line.cbm
    });
  }

  const timestamp = new Date().toISOString();
  let readinessId = input.id;

  if (readinessId) {
    // Update existing
    const { error: hErr } = await supabase
      .from("goods_readiness")
      .update({
        goods_ready_date: input.goodsReadyDate,
        pickup_location: input.pickupLocation,
        handover_location: input.handoverLocation,
        fob_port: input.fobPort,
        warehouse_factory_address: input.warehouseFactoryAddress,
        contact_person: input.contactPerson,
        special_instructions: input.specialInstructions,
        packing_list_path: input.packingListPath,
        packing_list_filename: input.packingListFilename,
        commercial_invoice_path: input.commercialInvoicePath,
        commercial_invoice_filename: input.commercialInvoiceFilename,
        handover_status: input.handoverStatus,
        overage_review_required: overageDetected,
        updated_at: timestamp
      })
      .eq("id", readinessId)
      .eq("supplier_id", companyId);

    if (hErr) throw hErr;

    // Recreate lines
    await supabase.from("goods_readiness_lines").delete().eq("goods_readiness_id", readinessId);
    const { error: linesErr } = await supabase
      .from("goods_readiness_lines")
      .insert(verifiedLines.map(l => ({ ...l, goods_readiness_id: readinessId })));
    if (linesErr) throw linesErr;

  } else {
    // Insert new
    const { data: grHeader, error: hErr } = await supabase
      .from("goods_readiness")
      .insert({
        purchase_order_id: input.purchaseOrderId,
        supplier_id: companyId,
        goods_ready_date: input.goodsReadyDate,
        pickup_location: input.pickupLocation,
        handover_location: input.handoverLocation,
        fob_port: input.fobPort,
        warehouse_factory_address: input.warehouseFactoryAddress,
        contact_person: input.contactPerson,
        special_instructions: input.specialInstructions,
        packing_list_path: input.packingListPath,
        packing_list_filename: input.packingListFilename,
        commercial_invoice_path: input.commercialInvoicePath,
        commercial_invoice_filename: input.commercialInvoiceFilename,
        handover_status: input.handoverStatus,
        overage_review_required: overageDetected,
        created_by: userId
      })
      .select("id")
      .single();

    if (hErr || !grHeader) throw hErr || new Error("Failed to save readiness header");
    readinessId = grHeader.id;

    const { error: linesErr } = await supabase
      .from("goods_readiness_lines")
      .insert(verifiedLines.map(l => ({ ...l, goods_readiness_id: readinessId })));
    if (linesErr) throw linesErr;
  }

  // Update PO fulfillment_status to READY_TO_SHIP if submitted and po status is approved/sent
  if (input.handoverStatus === 'READY_SUBMITTED') {
    await supabase
      .from("purchase_orders")
      .update({ fulfillment_status: "READY_TO_SHIP" })
      .eq("id", input.purchaseOrderId);
  }

  revalidatePath(`/portal/orders/shipping`);
  revalidatePath(`/portal/orders/shipping/${readinessId}`);
  revalidatePath(`/portal/orders/purchase-orders/${input.purchaseOrderId}`);
  return { success: true, id: readinessId, overageDetected };
}

/**
 * Mark a goods readiness record as Handed Over.
 */
export async function submitPortalHandover(readinessId: string) {
  const { companyId } = await requireCompanyMembership();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: gr } = await supabase
    .from("goods_readiness")
    .select("purchase_order_id")
    .eq("id", readinessId)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (!gr) throw new Error("출고 준비 정보를 찾을 수 없거나 접근 권한이 없습니다.");

  const { error } = await supabase
    .from("goods_readiness")
    .update({ handover_status: "HANDED_OVER", updated_at: new Date().toISOString() })
    .eq("id", readinessId);

  if (error) throw error;

  revalidatePath(`/portal/orders/shipping`);
  revalidatePath(`/portal/orders/shipping/${readinessId}`);
  return { success: true };
}

/**
 * For SUPPLIER_ARRANGED shipments: Supplier submits transportation details.
 */
export async function submitPortalSupplierArrangedShipment(
  readinessId: string,
  shippingDetails: {
    carrier: string;
    trackingNumber: string;
    billOfLading: string;
    etd: string;
    eta: string;
  }
) {
  const { companyId, userId } = await requireCompanyMembership();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // 1. Fetch readiness header
  const { data: gr } = await supabase
    .from("goods_readiness")
    .select("purchase_order_id, destination_warehouse_id:purchase_orders(destination_warehouse_id, shipping_responsibility)")
    .eq("id", readinessId)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (!gr) throw new Error("출고 준비 정보를 찾을 수 없거나 접근 권한이 없습니다.");

  const poInfo: any = gr.destination_warehouse_id;
  if (poInfo.shipping_responsibility !== "SUPPLIER_ARRANGED") {
    throw new Error("공급사 직배송(SUPPLIER_ARRANGED) 발주서만 직접 선적을 등록할 수 있습니다.");
  }

  // 2. Fetch lines
  const { data: lines } = await supabase
    .from("goods_readiness_lines")
    .select("id, purchase_order_line_id, product_id, ready_qty")
    .eq("goods_readiness_id", readinessId);

  if (!lines || lines.length === 0) {
    throw new Error("출고 품목을 찾을 수 없습니다.");
  }

  // 3. Create Inbound Shipment Header
  const { data: shp, error: shpErr } = await supabase
    .from("inbound_shipments")
    .insert({
      purchase_order_id: gr.purchase_order_id,
      status: "IN_TRANSIT",
      shipping_method: "Courier", // default or lookup
      shipping_responsibility: "SUPPLIER_ARRANGED",
      carrier: shippingDetails.carrier,
      tracking_number: shippingDetails.trackingNumber,
      bill_of_lading: shippingDetails.billOfLading,
      etd: shippingDetails.etd || null,
      eta: shippingDetails.eta || null,
      destination_warehouse_id: poInfo.destination_warehouse_id,
      created_by: userId
    })
    .select("id")
    .single();

  if (shpErr || !shp) throw shpErr || new Error("선적을 생성하지 못했습니다.");

  // 4. Create Shipment Lines
  const shpLines = lines.map(l => ({
    inbound_shipment_id: shp.id,
    purchase_order_line_id: l.purchase_order_line_id,
    product_id: l.product_id,
    shipped_qty: l.ready_qty,
    goods_readiness_line_id: l.id
  }));

  const { error: shpLinesErr } = await supabase
    .from("inbound_shipment_lines")
    .insert(shpLines);

  if (shpLinesErr) throw shpLinesErr;

  // 5. Mark Goods Readiness as Handed Over
  await supabase
    .from("goods_readiness")
    .update({ handover_status: "HANDED_OVER", updated_at: new Date().toISOString() })
    .eq("id", readinessId);

  // Update PO fulfillment_status to SHIPPED
  await supabase
    .from("purchase_orders")
    .update({ fulfillment_status: "SHIPPED" })
    .eq("id", gr.purchase_order_id);

  revalidatePath(`/portal/orders/shipping`);
  revalidatePath(`/portal/orders/shipping/${readinessId}`);
  return { success: true, shipmentId: shp.id };
}


/**
 * Fetch portal goods readiness list.
 */
export async function getPortalReadinessList() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goods_readiness")
    .select(`
      id,
      purchase_order_id,
      goods_ready_date,
      handover_status,
      overage_review_required,
      created_at,
      purchase_orders(po_number, shipping_responsibility)
    `)
    .eq("supplier_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch portal readiness list:", error);
    throw new Error("출고 준비 내역을 불러오지 못했습니다.");
  }

  return (data ?? []).map((gr: any) => {
    const poInfo = (Array.isArray(gr.purchase_orders) ? gr.purchase_orders[0] : gr.purchase_orders) as any;
    return {
      id: gr.id,
      purchaseOrderId: gr.purchase_order_id,
      goodsReadyDate: gr.goods_ready_date,
      handoverStatus: gr.handover_status,
      overageReviewRequired: gr.overage_review_required,
      createdAt: gr.created_at,
      poNumber: poInfo?.po_number || "-",
      shippingResponsibility: poInfo?.shipping_responsibility || "LETUSTO_ARRANGED"
    };
  });
}

/**
 * Fetch a single goods readiness by ID.
 */
export async function getPortalReadinessById(id: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goods_readiness")
    .select(`
      id,
      purchase_order_id,
      goods_ready_date,
      pickup_location,
      handover_location,
      fob_port,
      warehouse_factory_address,
      contact_person,
      special_instructions,
      handover_status,
      overage_review_required,
      packing_list_path,
      packing_list_filename,
      commercial_invoice_path,
      commercial_invoice_filename,
      created_at,
      purchase_orders(po_number, shipping_responsibility),
      lines:goods_readiness_lines(
        id,
        purchase_order_line_id,
        product_id,
        ready_qty,
        cartons,
        gross_weight,
        cbm,
        products:product_id(name, letusto_sku, manufacture_sku)
      )
    `)
    .eq("id", id)
    .eq("supplier_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch portal readiness by ID:", error);
    throw new Error("출고 준비 상세 내역을 불러오지 못했습니다.");
  }

  if (!data) return null;

  // Format lines
  const formattedLines = (data.lines || []).map((l: any) => {
    const prodArray = Array.isArray(l.products) ? l.products : (l.products ? [l.products] : []);
    const prodObj = prodArray[0] || { name: "", letusto_sku: "", manufacture_sku: "" };
    return {
      id: l.id,
      purchaseOrderLineId: l.purchase_order_line_id,
      productId: l.product_id,
      readyQty: l.ready_qty,
      cartons: l.cartons,
      grossWeight: Number(l.gross_weight || 0),
      cbm: Number(l.cbm || 0),
      productName: prodObj.name,
      letustoSku: prodObj.letusto_sku,
      manufactureSku: prodObj.manufacture_sku
    };
  });

  return {
    id: data.id,
    purchaseOrderId: data.purchase_order_id,
    goodsReadyDate: data.goods_ready_date,
    pickupLocation: data.pickup_location,
    handoverLocation: data.handover_location,
    fobPort: data.fob_port,
    warehouseFactoryAddress: data.warehouse_factory_address,
    contactPerson: data.contact_person,
    specialInstructions: data.special_instructions,
    handoverStatus: data.handover_status,
    overageReviewRequired: data.overage_review_required,
    packingListPath: data.packing_list_path,
    packingListFilename: data.packing_list_filename,
    commercialInvoicePath: data.commercial_invoice_path,
    commercialInvoiceFilename: data.commercial_invoice_filename,
    createdAt: data.created_at,
    poNumber: ((Array.isArray(data.purchase_orders) ? data.purchase_orders[0] : data.purchase_orders) as any)?.po_number || "-",
    shippingResponsibility: ((Array.isArray(data.purchase_orders) ? data.purchase_orders[0] : data.purchase_orders) as any)?.shipping_responsibility || "LETUSTO_ARRANGED",
    lines: formattedLines
  };
}
