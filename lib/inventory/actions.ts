"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";

export interface InventoryBalanceItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_hold: number;
  available: number;
  created_at: string;
  updated_at: string;
  warehouse_name: string;
  warehouse_code: string;
  warehouse_status: string;
}

export interface InventoryMovementItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  type: "OPENING_BALANCE" | "MANUAL_ADJUSTMENT" | "RECEIVING" | "SHIPMENT" | "TRANSFER";
  qty_change: number;
  qty_hold_change: number;
  balance_on_hand_after: number;
  balance_hold_after: number;
  reason: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string;
}

export interface WarehouseBalanceDetail {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_code: string;
  warehouse_status: string;
  qty_on_hand: number;
  qty_hold: number;
  available: number;
  last_activity: string;
}

export interface InventoryOverviewItem {
  id: string;
  product_id: string;
  name: string;
  display_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  parent_sku: string | null;
  child_sku: string | null;
  brand_id: string | null;
  brand_name: string;
  company_id: string | null;
  company_name: string;
  photoPath: string | null;
  photoUrl?: string | null;
  category: string | null;
  price_usd_fob?: number | null;
  trading_status: string;
  sales_status: string;
  selection_status: string;
  qty_on_hand: number;
  qty_hold: number;
  available: number;
  incoming: number;
  last_activity: string;
  warehouse_balances: WarehouseBalanceDetail[];
}

/**
 * Fetch all trading/selected products, their inventory balances, and incoming PO quantities.
 * Products with no inventory will be displayed with zero quantities and incoming totals.
 */
export async function getInventoryOverview(): Promise<InventoryOverviewItem[]> {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch active/historical trading products or selected products
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, name, name_en, category, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_usd_fob, price_krw_retail, price_additional_info, selection_status, sales_status, trading_status, created_at, updated_at")
    .or("trading_status.in.(active,historical),selection_status.eq.SELECTED")
    .order("created_at", { ascending: false });

  if (pErr) throw new Error(`Failed to fetch products for inventory: ${pErr.message}`);

  // 2. Fetch all companies for name mapping
  const { data: companies } = await supabase.from("companies").select("id, name");
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

  // 3. Fetch all brands for name mapping
  const { data: brands } = await supabase.from("brands").select("id, name");
  const brandMap = new Map((brands ?? []).map((b) => [b.id, b.name]));

  // 4. Fetch all product images to show thumbnail
  const { data: productImages } = await supabase
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .order("position", { ascending: true });

  // 5. Fetch finalized receiving lines to calculate accurate received qty per PO line
  const { data: receivingLines } = await supabase
    .from("receiving_lines")
    .select("purchase_order_line_id, received_qty, receivings!inner(status)")
    .eq("receivings.status", "FINALIZED");

  const receivedMap = new Map<string, number>();
  (receivingLines ?? []).forEach((r: any) => {
    const cur = receivedMap.get(r.purchase_order_line_id) || 0;
    receivedMap.set(r.purchase_order_line_id, cur + Number(r.received_qty || 0));
  });

  // 6. Fetch active open PO lines to compute incoming quantities
  const { data: poLines } = await supabase
    .from("purchase_order_lines")
    .select(`
      id, product_id, qty, confirmed_qty,
      purchase_orders!inner(id, po_number, po_status, fulfillment_status)
    `)
    .in("purchase_orders.po_status", ["APPROVED", "SENT"]);

  const incomingMap = new Map<string, number>();
  (poLines ?? []).forEach((pol: any) => {
    const po = pol.purchase_orders;
    if (!po) return;
    if (po.fulfillment_status === "COMPLETED" || po.fulfillment_status === "CANCELLED" || po.po_status === "CANCELLED") return;

    const targetQty = pol.confirmed_qty !== null && pol.confirmed_qty !== undefined ? Number(pol.confirmed_qty) : Number(pol.qty);
    const received = receivedMap.get(pol.id) || 0;
    const remaining = Math.max(0, targetQty - received);
    if (remaining > 0) {
      incomingMap.set(pol.product_id, (incomingMap.get(pol.product_id) || 0) + remaining);
    }
  });

  // 7. Fetch all inventory balances with warehouse information
  const { data: balances, error: bErr } = await supabase
    .from("inventory_balances")
    .select(`
      id, product_id, warehouse_id, qty_on_hand, qty_hold, updated_at,
      warehouses:warehouse_id (name, code, status)
    `);

  if (bErr) throw new Error(`Failed to fetch inventory balances: ${bErr.message}`);

  const balanceMap = new Map<string, any[]>();
  (balances ?? []).forEach((b: any) => {
    const list = balanceMap.get(b.product_id) || [];
    list.push(b);
    balanceMap.set(b.product_id, list);
  });

  const overviewList: InventoryOverviewItem[] = [];

  for (const p of products ?? []) {
    const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);

    // Find thumbnail photo path
    const firstImage = (productImages ?? []).find((img) => img.product_id === p.id);
    const photoPath = firstImage?.storage_path || null;

    const prodBalances = balanceMap.get(p.id) || [];

    const totalOnHand = prodBalances.reduce((sum, b) => sum + Number(b.qty_on_hand || 0), 0);
    const totalHold = prodBalances.reduce((sum, b) => sum + Number(b.qty_hold || 0), 0);
    const totalAvailable = totalOnHand - totalHold;
    const incomingQty = incomingMap.get(p.id) || 0;

    let latestActivity = p.updated_at || p.created_at;
    const warehouseDetails: WarehouseBalanceDetail[] = prodBalances.map((b: any) => {
      const wh = b.warehouses || {};
      if (b.updated_at && b.updated_at > latestActivity) {
        latestActivity = b.updated_at;
      }
      return {
        id: b.id,
        warehouse_id: b.warehouse_id,
        warehouse_name: wh.name || "(미지정 창고)",
        warehouse_code: wh.code || "-",
        warehouse_status: wh.status || "-",
        qty_on_hand: Number(b.qty_on_hand || 0),
        qty_hold: Number(b.qty_hold || 0),
        available: Number(b.qty_on_hand || 0) - Number(b.qty_hold || 0),
        last_activity: b.updated_at || "-",
      };
    });

    overviewList.push({
      id: p.id,
      product_id: p.id,
      name: p.name,
      display_name: displayName,
      letusto_sku: effectiveLetustoSku,
      manufacture_sku: effectiveManufactureSku,
      parent_sku: adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : p.parent_sku,
      child_sku: adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : p.child_sku,
      brand_id: p.brand_id,
      brand_name: brandMap.get(p.brand_id) || "(미지정 브랜드)",
      company_id: p.company_id,
      company_name: companyMap.get(p.company_id) || "(미지정 회사)",
      photoPath,
      category: p.category,
      price_usd_fob: adminOverrides.price_usd_fob !== undefined ? adminOverrides.price_usd_fob : p.price_usd_fob,
      trading_status: p.trading_status || "active",
      sales_status: p.sales_status || "PREPARING",
      selection_status: p.selection_status || "UNREVIEWED",
      qty_on_hand: totalOnHand,
      qty_hold: totalHold,
      available: totalAvailable,
      incoming: incomingQty,
      last_activity: latestActivity,
      warehouse_balances: warehouseDetails,
    });
  }

  return overviewList;
}

/**
 * Fetch detailed inventory breakdown and movement logs for a single product.
 */
export async function getProductInventory(productId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch product
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, name, name_en, trading_status")
    .eq("id", productId)
    .single();

  if (pErr) throw new Error("Product not found.");

  // 2. Fetch warehouse breakdown of balances
  const { data: balances, error: bErr } = await supabase
    .from("inventory_balances")
    .select(`
      id, product_id, warehouse_id, qty_on_hand, qty_hold, created_at, updated_at,
      warehouses:warehouse_id (name, code, status)
    `)
    .eq("product_id", productId);

  if (bErr) throw new Error(`Failed to fetch product inventory: ${bErr.message}`);

  const formattedBalances: InventoryBalanceItem[] = (balances ?? []).map((b: any) => ({
    id: b.id,
    product_id: b.product_id,
    warehouse_id: b.warehouse_id,
    qty_on_hand: b.qty_on_hand,
    qty_hold: b.qty_hold,
    available: b.qty_on_hand - b.qty_hold,
    created_at: b.created_at,
    updated_at: b.updated_at,
    warehouse_name: b.warehouses?.name || "",
    warehouse_code: b.warehouses?.code || "",
    warehouse_status: b.warehouses?.status || "",
  }));

  // 3. Fetch movements with user profile names for auditing
  const { data: movements, error: mErr } = await supabase
    .from("inventory_movements")
    .select(`
      id, product_id, warehouse_id, type, qty_change, qty_hold_change, 
      balance_on_hand_after, balance_hold_after, reason, note, reference_type, reference_id, created_by, created_at,
      profiles:created_by (full_name:display_name)
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (mErr) throw new Error(`Failed to fetch inventory movements: ${mErr.message}`);

  const formattedMovements: any[] = (movements ?? []).map((m: any) => ({
    id: m.id,
    product_id: m.product_id,
    warehouse_id: m.warehouse_id,
    type: m.type,
    qty_change: m.qty_change,
    qty_hold_change: m.qty_hold_change,
    balance_on_hand_after: m.balance_on_hand_after,
    balance_hold_after: m.balance_hold_after,
    reason: m.reason,
    note: m.note,
    reference_type: m.reference_type,
    reference_id: m.reference_id,
    created_by: m.created_by,
    created_at: m.created_at,
    creator_name: m.profiles?.full_name || "System/Admin",
  }));

  return {
    product,
    balances: formattedBalances,
    movements: formattedMovements,
  };
}

/**
 * Record initial opening balance for a product at a specific warehouse.
 */
export async function recordOpeningBalance(
  productId: string,
  warehouseId: string,
  qty: number,
  note?: string
) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // Validate Quantity
  if (qty < 0) {
    throw new Error("기초 재고는 0 이상이어야 합니다.");
  }

  // 1. Verify product status
  const { data: product } = await supabase
    .from("products")
    .select("trading_status")
    .eq("id", productId)
    .single();

  if (!product) throw new Error("제품을 찾을 수 없습니다.");
  if (product.trading_status === "inactive") {
    throw new Error("비대상(Inactive) 상품에는 재고 조작을 수행할 수 없습니다.");
  }

  // 2. Verify warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", warehouseId)
    .single();

  if (!warehouse) throw new Error("물류창고를 찾을 수 없습니다.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성(Inactive) 상태의 물류창고에는 재고를 등록할 수 없습니다.");
  }

  // 3. Verify no existing balance row
  const { data: existingBalance } = await supabase
    .from("inventory_balances")
    .select("id")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (existingBalance) {
    throw new Error(
      "이 물류창고에는 이미 등록된 재고 기록이 존재합니다. 재고를 변경하려면 수동 재고 조정을 이용해 주세요."
    );
  }

  // 4. Insert opening balance movement (the trigger will create the balance row)
  const { error: moveErr } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: productId,
      warehouse_id: warehouseId,
      type: "OPENING_BALANCE",
      qty_change: qty,
      qty_hold_change: 0,
      note: note || "기초 재고 입력",
      created_by: userId,
    });

  if (moveErr) {
    throw new Error(`기초 재고 입력 실패: ${moveErr.message}`);
  }

  revalidatePath(`/admin/products/trading/${productId}`);
  revalidatePath("/admin/inventory");
  return { success: true };
}

/**
 * Record a manual inventory adjustment.
 */
export async function recordManualAdjustment(
  productId: string,
  warehouseId: string,
  qtyChange: number,
  qtyHoldChange: number,
  reason: string,
  note?: string
) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Verify product status
  const { data: product } = await supabase
    .from("products")
    .select("trading_status")
    .eq("id", productId)
    .single();

  if (!product) throw new Error("제품을 찾을 수 없습니다.");
  if (product.trading_status === "inactive") {
    throw new Error("비대상(Inactive) 상품에는 재고 조작을 수행할 수 없습니다.");
  }

  // 2. Verify warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", warehouseId)
    .single();

  if (!warehouse) throw new Error("물류창고를 찾을 수 없습니다.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성(Inactive) 상태의 물류창고에는 재고를 등록할 수 없습니다.");
  }

  // 3. Insert movement (trigger will update balance and validate non-negative constraints)
  const { error: moveErr } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: productId,
      warehouse_id: warehouseId,
      type: "MANUAL_ADJUSTMENT",
      qty_change: qtyChange,
      qty_hold_change: qtyHoldChange,
      reason,
      note: note || "수동 재고 조정",
      created_by: userId,
    });

  if (moveErr) {
    throw new Error(`재고 조정 실패: ${moveErr.message}`);
  }

  revalidatePath(`/admin/products/trading/${productId}`);
  revalidatePath("/admin/inventory");
  return { success: true };
}
