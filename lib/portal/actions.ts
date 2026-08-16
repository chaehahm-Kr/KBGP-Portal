"use server";

import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";

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
      order_date,
      currency,
      created_at
    `)
    .eq("supplier_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch portal purchase orders:", error);
    throw new Error("발주서 목록을 불러오지 못했습니다.");
  }

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
      order_date,
      currency,
      created_at,
      lines:purchase_order_lines(
        id,
        qty,
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

  return data;
}

/**
 * Fetch all shipments where the logged-in supplier participates.
 * Uses inner joins on lines and POs to filter shipments at the query level.
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
 * Fetch a single shipment with secure company-scoping and no cross-supplier leak.
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
