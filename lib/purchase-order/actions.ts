"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOverallStatus } from "./status-helper";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatEasternDateTime } from "@/lib/utils/timezone";
import { createPoNotification } from "@/lib/notification/actions";

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
  request_id?: string;
  supplier_id: string;
  order_date: string;
  currency: string;
  payment_terms?: string;
  incoterms?: string;
  port_of_loading?: string;
  expected_ready_date?: string;
  expected_ship_date?: string;
  eta?: string;
  ship_from_warehouse_id?: string | null;
  destination_warehouse_id: string;
  po_receiving_email?: string;
  internal_note?: string;
  supplier_facing_note?: string;
  lines: CreatePoLineInput[];
}

/**
 * Fetch all purchase orders with aggregated statistics, names, and enriched line items for product-level view.
 */
export async function getPurchaseOrders() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select(`
      id, po_number, order_date, po_status, fulfillment_status, supplier_confirmation_status, currency, expected_ready_date, updated_at,
      companies:supplier_id (id, name),
      destination_warehouse:destination_warehouse_id (id, name, code),
      ship_from_warehouse:ship_from_warehouse_id (id, name, code),
      purchase_order_lines (
        id, product_id, qty, unit_cost, confirmed_qty, product_name_snapshot, manufacture_sku_snapshot, letusto_sku_snapshot, line_note,
        products (
          id, name, name_en, manufacture_sku, letusto_sku, parent_sku, child_sku, brand_id, price_additional_info,
          brands (name),
          product_images (storage_path, position)
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch purchase orders: ${error.message}`);

  // Fetch all shipments with lines in batch
  const { data: allShipments } = await supabase
    .from("inbound_shipments")
    .select("id, purchase_order_id, status, eta, inbound_shipment_lines (purchase_order_line_id, shipped_qty)");

  // Fetch all receivings with lines in batch
  const { data: allReceivings } = await supabase
    .from("receivings")
    .select("id, purchase_order_id, status, receiving_lines (purchase_order_line_id, received_qty, damaged_qty, hold_qty)");

  // Build shipped & received maps by purchase_order_line_id
  const shippedLineMap = new Map<string, number>();
  (allShipments ?? []).forEach((s: any) => {
    if (s.status !== "CANCELLED") {
      (s.inbound_shipment_lines ?? []).forEach((sl: any) => {
        const cur = shippedLineMap.get(sl.purchase_order_line_id) || 0;
        shippedLineMap.set(sl.purchase_order_line_id, cur + (sl.shipped_qty || 0));
      });
    }
  });

  const receivedLineMap = new Map<string, number>();
  (allReceivings ?? []).forEach((r: any) => {
    (r.receiving_lines ?? []).forEach((rl: any) => {
      const cur = receivedLineMap.get(rl.purchase_order_line_id) || 0;
      const net = (rl.received_qty || 0) - (rl.damaged_qty || 0) - (rl.hold_qty || 0);
      receivedLineMap.set(rl.purchase_order_line_id, cur + Math.max(0, net));
    });
  });

  const { getSignedFileUrl } = await import("@/lib/files/storage");

  // Collect image paths to sign
  const storagePaths = new Set<string>();
  (pos ?? []).forEach((po: any) => {
    (po.purchase_order_lines ?? []).forEach((l: any) => {
      const imgs = l.products?.product_images || [];
      if (imgs.length > 0 && imgs[0]?.storage_path) {
        storagePaths.add(imgs[0].storage_path);
      }
    });
  });

  const signedImageMap = new Map<string, string>();
  for (const path of storagePaths) {
    try {
      const url = await getSignedFileUrl(path);
      if (url) signedImageMap.set(path, url);
    } catch {
      // Ignore
    }
  }

  return (pos ?? []).map((po: any) => {
    const rawLines = po.purchase_order_lines || [];
    const totalQty = rawLines.reduce((sum: number, l: any) => sum + l.qty, 0);
    const totalAmount = rawLines.reduce((sum: number, l: any) => sum + (l.qty * Number(l.unit_cost)), 0);

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

    const supplierName = po.companies?.name || "(미지정 공급사)";
    const warehouseName = po.destination_warehouse?.name || "(미지정 창고)";
    const warehouseCode = po.destination_warehouse?.code || "-";

    const lines = rawLines.map((l: any) => {
      const p = l.products || {};
      const adminOverrides = p.price_additional_info?.admin_overrides || {};
      const prodName = l.product_name_snapshot || adminOverrides.name_en || p.name_en || adminOverrides.name || p.name || "(이름 없음)";
      const letustoSku = l.letusto_sku_snapshot || resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku) || "-";
      const manufactureSku = l.manufacture_sku_snapshot || resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku) || "-";
      
      const shippedQty = shippedLineMap.get(l.id) || 0;
      const receivedQty = receivedLineMap.get(l.id) || 0;
      const remainingQty = Math.max(0, l.qty - receivedQty);

      const firstImg = (p.product_images || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0))[0];
      const imageUrl = firstImg?.storage_path ? signedImageMap.get(firstImg.storage_path) || null : null;

      return {
        id: l.id,
        po_id: po.id,
        po_number: po.po_number,
        product_id: l.product_id,
        product_name: prodName,
        letusto_sku: letustoSku,
        manufacture_sku: manufactureSku,
        brand_name: p.brands?.name || "(미지정 브랜드)",
        qty: l.qty,
        unit_cost: Number(l.unit_cost),
        confirmed_qty: l.confirmed_qty !== null ? Number(l.confirmed_qty) : null,
        line_note: l.line_note || "",
        shipped_qty: shippedQty,
        received_qty: receivedQty,
        remaining_qty: remainingQty,
        image_url: imageUrl,
        supplier_name: supplierName,
        order_date: po.order_date,
        po_status: po.po_status,
        fulfillment_status: po.fulfillment_status,
        supplier_confirmation_status: po.supplier_confirmation_status,
        warehouse_code: warehouseCode,
        warehouse_name: warehouseName,
        eta: eta,
      };
    });

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
      supplier_name: supplierName,
      supplier_id: po.companies?.id || "",
      warehouse_name: warehouseName,
      warehouse_code: warehouseCode,
      destination_warehouse_id: po.destination_warehouse_id,
      ship_from_name: po.ship_from_warehouse?.name || "-",
      ship_from_code: po.ship_from_warehouse?.code || "-",
      total_qty: totalQty,
      total_amount: totalAmount,
      overall_status: overallStatus,
      shipment_status: shipmentStatus,
      receiving_status: receivingStatus,
      final_qty: finalQty,
      eta: eta,
      lines: lines,
    };
  });
}

/**
 * Fetch detailed view of a single purchase order.
 */
export async function getPurchaseOrderDetail(poId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch PO Header safely
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      supplier:supplier_id (*),
      warehouse:destination_warehouse_id (id, name, code, address1, city, state, zip_code, country),
      ship_from_warehouse:ship_from_warehouse_id (id, name, code, address1, city, state, zip_code, country)
    `)
    .eq("id", poId)
    .maybeSingle();

  if (poErr) throw new Error(`Failed to fetch purchase order header: ${poErr.message}`);
  if (!po) throw new Error("Purchase order not found.");

  // Fetch creator, approver, canceller display names from profiles separately if IDs exist
  const userIds = [po.created_by, po.approved_by, po.cancelled_by].filter(Boolean);
  let creatorName: string | null = null;
  let approverName: string | null = null;
  let cancellerName: string | null = null;

  if (userIds.length > 0) {
    try {
      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      const profileMap = new Map((userProfiles ?? []).map((p: any) => [p.id, p.display_name]));
      if (po.created_by) creatorName = profileMap.get(po.created_by) || null;
      if (po.approved_by) approverName = profileMap.get(po.approved_by) || null;
      if (po.cancelled_by) cancellerName = profileMap.get(po.cancelled_by) || null;
    } catch {}
  }

  // Parse supplier company metadata if present
  let supplierMetadata: any = {};
  if (po.supplier?.intro && po.supplier.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      supplierMetadata = JSON.parse(po.supplier.intro.substring("__COMPANY_METADATA__:".length));
    } catch {}
  }

  // Fetch company users to match contact names
  const { data: compUsers } = await supabase
    .from("company_users")
    .select("id, name, email, title, position, is_primary")
    .eq("company_id", po.supplier_id)
    .eq("status", "active");

  const contactsList = [
    ...(compUsers || []),
    ...(supplierMetadata.contacts || [])
  ];

  const receivingEmails = (po.po_receiving_email || "")
    .split(",")
    .map((e: string) => e.trim())
    .filter(Boolean);

  const primaryEmail = receivingEmails[0] || supplierMetadata.contacts?.[0]?.email || "";
  const matchedContact = contactsList.find((c: any) => c.email && c.email.toLowerCase() === primaryEmail.toLowerCase());
  const primaryContactName = matchedContact?.name || supplierMetadata.contacts?.[0]?.name || po.supplier?.contact_name || "";
  const primaryContactTitle = matchedContact?.title || matchedContact?.position || supplierMetadata.contacts?.[0]?.title || "";

  const enrichedSupplier = {
    ...po.supplier,
    official_name: po.supplier?.name || "Supplier Company",
    address_line1: supplierMetadata.address_1 || supplierMetadata.address || po.supplier?.country || "",
    address_line2: supplierMetadata.address_2 || "",
    city_state_zip: [supplierMetadata.city, supplierMetadata.state, supplierMetadata.zip_code].filter(Boolean).join(", "),
    country: po.supplier?.country || supplierMetadata.country || "",
    phone: supplierMetadata.phone || po.supplier?.contact_phone || supplierMetadata.contacts?.[0]?.phone || "",
    contact_name: primaryContactName,
    contact_title: primaryContactTitle,
    contact_email: primaryEmail,
    additional_emails: receivingEmails.slice(1).join(", "),
  };

  // 2. Fetch PO Lines safely
  const { data: lines, error: lErr } = await supabase
    .from("purchase_order_lines")
    .select(`
      id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
      qty, confirmed_qty, unit_cost, line_note
    `)
    .eq("purchase_order_id", poId);

  if (lErr) throw new Error(`Failed to fetch purchase order lines: ${lErr.message}`);

  // Batch fetch brand names for products
  const productIds = Array.from(new Set((lines ?? []).map((l: any) => l.product_id).filter(Boolean)));
  const brandMap = new Map<string, string>();
  if (productIds.length > 0) {
    try {
      const { data: prods } = await supabase
        .from("products")
        .select("id, brand_id, brands:brand_id(name)")
        .in("id", productIds);
      (prods ?? []).forEach((p: any) => {
        const brandName = Array.isArray(p.brands) ? p.brands[0]?.name : p.brands?.name;
        if (brandName) brandMap.set(p.id, brandName);
      });
    } catch {}
  }

  // Fetch active shipped totals per PO line
  const { data: shipData } = await supabase
    .from("inbound_shipment_lines")
    .select("purchase_order_line_id, shipped_qty, inbound_shipments!inner(status)")
    .eq("inbound_shipments.purchase_order_id", poId)
    .neq("inbound_shipments.status", "CANCELLED");

  const shippedMap = new Map<string, number>();
  (shipData ?? []).forEach((s: any) => {
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
  (recData ?? []).forEach((r: any) => {
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
      product_name: l.product_name_snapshot || "(제품명 없음)",
      name: l.product_name_snapshot || "(제품명 없음)",
      letusto_sku: l.letusto_sku_snapshot || null,
      manufacture_sku: l.manufacture_sku_snapshot || null,
      qty: Number(l.qty) || 0,
      confirmed_qty: l.confirmed_qty !== null && l.confirmed_qty !== undefined ? Number(l.confirmed_qty) : null,
      unit_cost: Number(l.unit_cost) || 0,
      line_total: (Number(l.qty) || 0) * (Number(l.unit_cost) || 0),
      line_note: l.line_note || "",
      brand_name: brandMap.get(l.product_id) || "(미지정 브랜드)",
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

  // 3. Fetch linked support cases from partner_inquiries
  let linkedCases: any[] = [];
  try {
    const { data: inqs, error: inqErr } = await supabase
      .from("partner_inquiries")
      .select("id, case_number, title, category, status, created_at")
      .or(`related_po_id.eq.${poId},title.ilike.%${po.po_number}%`)
      .order("created_at", { ascending: false });

    if (!inqErr && inqs) {
      linkedCases = inqs;
    } else {
      // Fallback query if related_po_id column is not in DB schema cache yet
      const { data: fallbackInqs } = await supabase
        .from("partner_inquiries")
        .select("id, case_number, title, category, status, created_at")
        .ilike("title", `%${po.po_number}%`)
        .order("created_at", { ascending: false });
      linkedCases = fallbackInqs || [];
    }
  } catch {}

  return {
    ...po,
    revision_no: po.revision_no != null && !isNaN(Number(po.revision_no)) ? Number(po.revision_no) : 1,
    supplier_confirmation_status: po.supplier_confirmation_status || "PENDING",
    confirmed_by_name: po.confirmed_by_name || null,
    confirmed_at: po.confirmed_at || null,
    cancellation_status: po.cancellation_status || "NONE",
    cancellation_reason: po.cancellation_reason || null,
    cancellation_requested_at: po.cancellation_requested_at || null,
    cancellation_confirmed_by: po.cancellation_confirmed_by || null,
    cancellation_confirmed_at: po.cancellation_confirmed_at || null,
    cancellation_rejected_by: po.cancellation_rejected_by || null,
    cancellation_rejected_at: po.cancellation_rejected_at || null,
    cancellation_reject_reason: po.cancellation_reject_reason || null,
    creator: creatorName ? { full_name: creatorName } : null,
    approver: approverName ? { full_name: approverName } : null,
    canceller: cancellerName ? { full_name: cancellerName } : null,
    activity_logs: Array.isArray(po.activity_logs) ? po.activity_logs : [],
    revisions: Array.isArray(po.revisions) ? po.revisions : [],
    linkedCases,
    supplier: enrichedSupplier,
    lines: formattedLines,
    total_qty: totalQty,
    total_amount: totalAmount,
    total_shipped: totalShipped,
    total_received: totalReceived,
    destination_warehouse_id: po.destination_warehouse_id || "",
    ship_from_warehouse_id: po.ship_from_warehouse_id || "",
    expected_ready_date: po.expected_ready_date || null,
    expected_ship_date: po.expected_ship_date || null,
    port_of_loading: po.port_of_loading || "",
    payment_terms: po.payment_terms || "",
    incoterms: po.incoterms || "",
    currency: po.currency || "USD",
    internal_note: po.internal_note || "",
    supplier_facing_note: po.supplier_facing_note || "",
    po_receiving_email: po.po_receiving_email || "",
  };
}

/**
 * Fetch all active companies to serve as Suppliers for Purchase Orders.
 */
export async function getSuppliersForPo() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // Fetch active companies
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id, name, country, contact_name, contact_phone, status, company_code")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (cErr) throw new Error(`Failed to fetch active companies: ${cErr.message}`);
  if (!companies || companies.length === 0) return [];

  const companyIds = companies.map((c) => c.id);

  // Fetch optional supplier profiles for commercial defaults
  const { data: profiles } = await supabase
    .from("supplier_profiles")
    .select(`
      company_id, default_currency, default_payment_terms, default_payment_terms_custom,
      default_incoterms, default_port_of_loading, default_production_lead_time, po_receiving_email,
      default_ship_from_warehouse_id
    `)
    .in("company_id", companyIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.company_id, p]));

  return companies.map((c) => {
    const p = profileMap.get(c.id);
    return {
      id: c.id,
      name: c.name || "(이름 없음)",
      company_code: c.company_code || "",
      address: c.country || "",
      default_currency: p?.default_currency || "USD",
      default_payment_terms: p?.default_payment_terms || "",
      default_payment_terms_custom: p?.default_payment_terms_custom || "",
      default_incoterms: p?.default_incoterms || "",
      default_port_of_loading: p?.default_port_of_loading || "",
      default_production_lead_time: p?.default_production_lead_time || "",
      po_receiving_email: p?.po_receiving_email || "",
      default_ship_from_warehouse_id: p?.default_ship_from_warehouse_id || "",
    };
  });
}

/**
 * Fetch company shipping origins and registered contacts with task assignment recommendations.
 */
export async function getCompanyOriginsAndContacts(companyId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch Shipping Origins for this company
  const { getCompanyShippingOrigins } = await import("@/lib/company/shipping-origin-actions");
  const origins = await getCompanyShippingOrigins(companyId);

  // Identify default origin
  const defaultOrigin = origins.find((o) => o.is_default) || origins[0] || null;

  // 2. Fetch active Company Users
  const { data: users, error: uErr } = await supabase
    .from("company_users")
    .select("id, name, email, title, position, is_primary, company_role, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  const activeUsers = users ?? [];

  // 3. Fetch Task Assignments for 'logistics_inventory'
  let taskAssignUserIds: string[] = [];
  try {
    const { data: taskData } = await supabase
      .from("company_task_assignments")
      .select("user_id, is_primary, email_notify")
      .eq("company_id", companyId)
      .eq("task_code", "logistics_inventory");

    if (taskData && taskData.length > 0) {
      const primary = taskData.filter((t) => t.is_primary).map((t) => t.user_id);
      const notify = taskData.filter((t) => t.email_notify).map((t) => t.user_id);
      taskAssignUserIds = Array.from(new Set([...primary, ...notify]));
    }
  } catch {
    // If table not queried, fallback
  }

  // If no task assignments, fallback to is_primary user or first active user
  let defaultCheckedUserIds: string[] = [];
  if (taskAssignUserIds.length > 0) {
    defaultCheckedUserIds = taskAssignUserIds.filter((id) => activeUsers.some((u) => u.id === id));
  }
  if (defaultCheckedUserIds.length === 0) {
    const primaryUser = activeUsers.find((u) => u.is_primary);
    if (primaryUser) {
      defaultCheckedUserIds = [primaryUser.id];
    } else if (activeUsers.length > 0) {
      defaultCheckedUserIds = [activeUsers[0].id];
    }
  }

  return {
    origins: origins.map((o) => ({
      id: o.warehouse_id || o.id,
      origin_id: o.id,
      name: o.name,
      is_default: o.is_default,
      country: o.country,
      city: o.city,
      address_line1: o.address_line1,
      postal_code: o.postal_code,
      contact_name: o.contact_name,
      phone: o.phone,
    })),
    defaultOriginId: defaultOrigin ? (defaultOrigin.warehouse_id || defaultOrigin.id) : "",
    contacts: activeUsers.map((u) => ({
      id: u.id,
      name: u.name || "(이름 없음)",
      email: u.email || "",
      title: u.title || "",
      position: u.position || "",
      is_primary: u.is_primary || false,
      is_logistics_assigned: taskAssignUserIds.includes(u.id),
    })),
    defaultContactIds: defaultCheckedUserIds,
  };
}

/**
 * Fetch active products associated with a supplier company (via company_id, brand ownership, or product_suppliers).
 */
export async function getProductsForSupplier(supplierId: string) {
  if (!supplierId) return [];

  const supabase = createAdminClient();

  // Validate session: allow Admin or Portal user of supplierId
  const { createClient } = await import("@/lib/supabase/server");
  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    throw new Error("인증 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", user.id);

  const isStaffAdmin = (staffRoles ?? []).length > 0;
  const isAdmin = profile?.role === "admin" || isStaffAdmin;

  if (isAdmin) {
    // Admin user: full access to any supplier's products
  } else if (profile?.role === "portal") {
    // Portal user: verify user belongs to supplierId
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, status")
      .eq("id", user.id)
      .maybeSingle();

    if (!companyUser || companyUser.status !== "active") {
      throw new Error("현재 계정에 연결된 활성 회사 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.");
    }
    if (companyUser.company_id !== supplierId) {
      throw new Error("타사 제품 정보를 조회할 수 없습니다.");
    }
  } else {
    // Default to admin access if session verified or fallback
  }


  // 1. Fetch brand IDs owned by this company
  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .eq("company_id", supplierId);
  const brandIds = (brands ?? []).map((b) => b.id);

  // 2. Fetch mapped product IDs from product_suppliers if any
  let mappedProductIds: string[] = [];
  try {
    const { data: mappedProducts } = await supabase
      .from("product_suppliers")
      .select("product_id")
      .eq("supplier_id", supplierId);
    mappedProductIds = (mappedProducts ?? []).map((mp) => mp.product_id);
  } catch {
    // If table doesn't exist, proceed
  }

  // 3. Construct OR filter for supplier association
  const orFilters = [`company_id.eq.${supplierId}`];
  if (brandIds.length > 0) {
    orFilters.push(`brand_id.in.(${brandIds.join(",")})`);
  }
  if (mappedProductIds.length > 0) {
    orFilters.push(`id.in.(${mappedProductIds.join(",")})`);
  }

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id, name, name_en, manufacture_sku, letusto_sku, parent_sku, child_sku, price_usd_fob, price_additional_info, category, brand_id, company_id,
      carton_pack_qty, carton_width, carton_depth, carton_height, carton_weight, carton_cbm,
      brands (name), upc, ean, status, trading_status
    `)
    .or(orFilters.join(","))
    .order("name", { ascending: true });

  if (error) throw new Error(`공급사 제품 조회 실패: ${error.message}`);
  if (!products || products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  // 4. Fetch first images (lowest position) for these products
  const { data: productImages } = await supabase
    .from("product_images")
    .select("product_id, storage_path, position")
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

  const { PRODUCT_CATEGORY_LABEL, resolveEffectiveSku } = await import("@/lib/product/types");

  return products.map((p: any) => {
    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);

    // Priority:
    // 1. Admin FOB Override (if present, non-null, > 0)
    // 2. Base FOB from product catalog (p.price_usd_fob >= 0)
    // 3. Fallback to 0
    let effectiveFob = 0;
    const overrideFob = adminOverrides.price_usd_fob;
    if (overrideFob !== undefined && overrideFob !== null && overrideFob !== "") {
      const parsed = typeof overrideFob === "number" ? overrideFob : parseFloat(overrideFob);
      if (!isNaN(parsed) && parsed > 0) {
        effectiveFob = parsed;
      }
    }
    if (effectiveFob === 0 && p.price_usd_fob !== undefined && p.price_usd_fob !== null && p.price_usd_fob !== "") {
      const parsed = typeof p.price_usd_fob === "number" ? p.price_usd_fob : parseFloat(p.price_usd_fob);
      if (!isNaN(parsed) && parsed >= 0) {
        effectiveFob = parsed;
      }
    }

    const effectiveUpc = adminOverrides.upc || p.upc || adminOverrides.ean || p.ean || "";
    const effectiveParentSku = adminOverrides.parent_sku || p.parent_sku || null;
    const effectiveChildSku = adminOverrides.child_sku || p.child_sku || null;

    const catValue = p.category || "";
    const catLabel = (PRODUCT_CATEGORY_LABEL as any)[catValue] || catValue || "기타";

    // Pricing tiers extraction
    const rawTiers = adminOverrides.price_tiers || p.price_additional_info?.price_tiers || [];
    const priceTiers = Array.isArray(rawTiers)
      ? rawTiers
          .filter((t: any) => t && Number(t.qty) > 0 && Number(t.price) > 0)
          .map((t: any) => ({ qty: Number(t.qty), price: Number(t.price) }))
          .sort((a: any, b: any) => a.qty - b.qty)
      : [];

    // Carton specs extraction
    const cartonPackQty = adminOverrides.carton_pack_qty !== undefined && adminOverrides.carton_pack_qty !== null && adminOverrides.carton_pack_qty !== ""
      ? Number(adminOverrides.carton_pack_qty)
      : (p.carton_pack_qty || 1);
    const cartonWidth = adminOverrides.carton_width !== undefined && adminOverrides.carton_width !== null && adminOverrides.carton_width !== ""
      ? Number(adminOverrides.carton_width)
      : p.carton_width;
    const cartonDepth = adminOverrides.carton_depth !== undefined && adminOverrides.carton_depth !== null && adminOverrides.carton_depth !== ""
      ? Number(adminOverrides.carton_depth)
      : p.carton_depth;
    const cartonHeight = adminOverrides.carton_height !== undefined && adminOverrides.carton_height !== null && adminOverrides.carton_height !== ""
      ? Number(adminOverrides.carton_height)
      : p.carton_height;
    const cartonWeight = adminOverrides.carton_weight !== undefined && adminOverrides.carton_weight !== null && adminOverrides.carton_weight !== ""
      ? Number(adminOverrides.carton_weight)
      : p.carton_weight;
    const cartonCbm = adminOverrides.carton_cbm !== undefined && adminOverrides.carton_cbm !== null && adminOverrides.carton_cbm !== ""
      ? Number(adminOverrides.carton_cbm)
      : p.carton_cbm;

    return {
      id: p.id,
      name: p.name,
      display_name: displayName,
      letusto_sku: effectiveLetustoSku,
      manufacture_sku: effectiveManufactureSku,
      price_usd_fob: effectiveFob,
      price_tiers: priceTiers,
      carton_pack_qty: cartonPackQty,
      carton_width: cartonWidth,
      carton_depth: cartonDepth,
      carton_height: cartonHeight,
      carton_weight: cartonWeight,
      carton_cbm: cartonCbm,
      upc: effectiveUpc || "",
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
 * Helper to generate PO Number following convention: PO-YYYYMMDD-COMPANYCODE-###
 * Sequence restarts at 001 for each Supplier + Order Date.
 */
export async function generateNextPoNumber(
  supabase: any,
  supplierId: string,
  orderDateStr: string,
  extraOffset: number = 0
): Promise<{ poNumber: string; companyCode: string }> {
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("id, name, company_code")
    .eq("id", supplierId)
    .single();

  if (cErr || !company) {
    throw new Error("공급사 회사 정보를 찾을 수 없습니다.");
  }

  let rawCode = (company.company_code || "").trim();
  if (!rawCode) {
    const derived = (company.name || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
    rawCode = derived || "SUP";
  }

  const companyCode = rawCode.toUpperCase();
  const dateFormatted = orderDateStr.replace(/-/g, "");
  const prefix = `PO-${dateFormatted}-${companyCode}-`;

  const { data: existingPos } = await supabase
    .from("purchase_orders")
    .select("po_number")
    .eq("supplier_id", supplierId)
    .eq("order_date", orderDateStr);

  let maxSeq = 0;
  (existingPos ?? []).forEach((p: any) => {
    const poNum = p.po_number || "";
    if (poNum.startsWith(prefix)) {
      const parts = poNum.split("-");
      const seqPart = parts[parts.length - 1];
      const seqNum = parseInt(seqPart, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  });

  const nextSeq = maxSeq + 1 + extraOffset;
  const seqStr = String(nextSeq).padStart(3, "0");
  const poNumber = `${prefix}${seqStr}`;

  return { poNumber, companyCode };
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

  // 3. Create PO Header with convention PO-YYYYMMDD-COMPANYCODE-###
  let newPo: any = null;
  let poErr: any = null;
  let attempts = 0;

  while (!newPo && attempts < 5) {
    const { poNumber } = await generateNextPoNumber(
      supabase,
      data.supplier_id,
      data.order_date,
      attempts
    );

    const insertPayload: any = {
      po_number: poNumber,
      supplier_id: data.supplier_id,
      order_date: data.order_date,
      currency: data.currency,
      payment_terms: data.payment_terms || null,
      incoterms: data.incoterms || null,
      port_of_loading: data.port_of_loading || null,
      expected_ready_date: data.expected_ready_date || null,
      expected_ship_date: data.expected_ship_date || null,
      eta: data.eta || null,
      ship_from_warehouse_id: data.ship_from_warehouse_id || null,
      destination_warehouse_id: data.destination_warehouse_id,
      po_receiving_email: data.po_receiving_email || null,
      internal_note: data.internal_note || null,
      supplier_facing_note: data.supplier_facing_note || null,
      created_by: userId,
      po_status: "DRAFT",
      fulfillment_status: "PENDING",
    };

    const res = await supabase
      .from("purchase_orders")
      .insert(insertPayload)
      .select("id, po_number")
      .single();

    if (!res.error && res.data) {
      newPo = res.data;
    } else {
      poErr = res.error;
      if (res.error?.message?.includes("eta") || res.error?.code === "42703") {
        delete insertPayload.eta;
        const retryRes = await supabase
          .from("purchase_orders")
          .insert(insertPayload)
          .select("id, po_number")
          .single();
        if (!retryRes.error && retryRes.data) {
          newPo = retryRes.data;
          break;
        }
      }

      if (res.error?.code === "23505" || res.error?.message?.includes("po_number")) {
        attempts++;
      } else {
        throw new Error(`발주서 헤더 생성 실패: ${res.error?.message || "알 수 없는 오류"}`);
      }
    }
  }

  if (!newPo) throw new Error(`발주서 헤더 생성 실패: ${poErr?.message || "알 수 없는 오류"}`);
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
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);

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

  // 5. If created from a PO Request, link request atomically and mark as CONVERTED_TO_PO
  if (data.request_id) {
    try {
      const { linkCreatedPoToRequest } = await import("./request-actions");
      await linkCreatedPoToRequest(data.request_id, poId, (newPo as any).po_number);
    } catch (linkErr) {
      console.error("Auto-linking created PO to PO Request failed:", linkErr);
    }
  }

  revalidatePath("/admin/purchasing");
  return { success: true, id: poId, po_number: (newPo as any).po_number as string | undefined };
}

/**
 * Update an existing Purchase Order.
 * Rules:
 * - DRAFT / APPROVED: Freely editable by Admin without revision increment.
 * - SENT (Pending or Confirmed): Increments revision_no, snapshots previous version in revisions,
 *   resets supplier_confirmation_status to "PENDING", logs "Revised", and creates PO_REVISED notification.
 */
export async function updatePurchaseOrder(poId: string, data: CreatePoInput) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  // 1. Fetch current user name
  const { data: staff } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const actorName = staff?.display_name || "어드민";

  // 2. Fetch current PO
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");
  if (po.po_status === "CANCELLED") {
    throw new Error("취소된 발주서는 수정할 수 없습니다.");
  }

  // 3. Verify Destination Warehouse status
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("status")
    .eq("id", data.destination_warehouse_id)
    .single();

  if (!warehouse) throw new Error("Destination warehouse not found.");
  if (warehouse.status === "inactive") {
    throw new Error("비활성(Inactive) 상태의 물류창고는 입고지로 지정할 수 없습니다.");
  }

  // 4. Validate Lines
  if (!data.lines || data.lines.length === 0) {
    throw new Error("최소 한 개 이상의 제품 품목이 추가되어야 합니다.");
  }

  data.lines.forEach((l) => {
    if (l.qty <= 0) throw new Error("주문 수량은 0보다 커야 합니다.");
    if (l.unit_cost < 0) throw new Error("구매 단가는 0 이상이어야 합니다.");
  });

  const easternNow = formatEasternDateTime(new Date().toISOString());
  const isSent = po.po_status === "SENT";
  const newRevisionNo = isSent ? (po.revision_no || 1) + 1 : (po.revision_no || 1);

  // Fetch current lines for revision snapshot if isSent
  const currentRevisions = Array.isArray(po.revisions) ? po.revisions : [];
  let updatedRevisions = currentRevisions;

  if (isSent) {
    const { data: oldLines } = await supabase
      .from("purchase_order_lines")
      .select("product_id, qty, unit_cost, product_name_snapshot, manufacture_sku_snapshot, letusto_sku_snapshot, line_note")
      .eq("purchase_order_id", poId);

    const snapshot = {
      revision_no: po.revision_no || 1,
      modified_at: new Date().toISOString(),
      modified_at_eastern: easternNow,
      modified_by: actorName,
      lines: oldLines || [],
      terms: {
        currency: po.currency,
        payment_terms: po.payment_terms,
        incoterms: po.incoterms,
        port_of_loading: po.port_of_loading,
        expected_ready_date: po.expected_ready_date,
        expected_ship_date: po.expected_ship_date,
        eta: po.eta,
        supplier_facing_note: po.supplier_facing_note,
      },
    };
    updatedRevisions = [snapshot, ...currentRevisions];
  }

  const currentLogs = Array.isArray(po.activity_logs) ? po.activity_logs : [];
  const logEvent = isSent ? "Revised" : "Admin Modified";
  const newLogs = [
    {
      event: logEvent,
      actor: actorName,
      revision_no: newRevisionNo,
      timestamp: easternNow,
    },
    ...currentLogs,
  ];

  // 5. Update Header
  const updatePayload: any = {
    supplier_id: data.supplier_id,
    order_date: data.order_date,
    currency: data.currency,
    payment_terms: data.payment_terms || null,
    incoterms: data.incoterms || null,
    port_of_loading: data.port_of_loading || null,
    expected_ready_date: data.expected_ready_date || null,
    expected_ship_date: data.expected_ship_date || null,
    eta: data.eta || null,
    ship_from_warehouse_id: data.ship_from_warehouse_id || null,
    destination_warehouse_id: data.destination_warehouse_id,
    po_receiving_email: data.po_receiving_email || null,
    internal_note: data.internal_note || null,
    supplier_facing_note: data.supplier_facing_note || null,
    revision_no: newRevisionNo,
    supplier_confirmation_status: isSent ? "PENDING" : (po.supplier_confirmation_status || "PENDING"),
    confirmed_by_id: isSent ? null : po.confirmed_by_id,
    confirmed_by_name: isSent ? null : po.confirmed_by_name,
    confirmed_at: isSent ? null : po.confirmed_at,
    revisions: updatedRevisions,
    activity_logs: newLogs,
    updated_at: new Date().toISOString(),
  };

  await safeUpdatePurchaseOrder(supabase, poId, updatePayload);

  // 6. Delete old lines and insert new ones
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
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name || "(제품명 없음)";
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);

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

  // 7. If isSent, trigger PO_REVISED notification
  if (isSent) {
    try {
      await createPoNotification({
        companyId: data.supplier_id || po.supplier_id,
        type: "PO_REVISED",
        title: "발주서가 수정되었습니다.",
        content: `${po.po_number} · Revision ${newRevisionNo}`,
        linkUrl: `/portal/orders/purchase-orders/${poId}`,
        poNumber: po.po_number,
        poId: poId,
        metadata: { revision_no: newRevisionNo }
      });
    } catch (notifErr) {
      console.warn("Failed to create PO_REVISED notification:", notifErr);
    }
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${poId}`);
  revalidatePath(`/portal/orders/purchase-orders/${poId}`);
  revalidatePath("/portal/orders/purchase-orders");
  return { success: true, revision_no: newRevisionNo };
}

/**
 * Safe helper to update purchase order with multi-tier schema fallback
 */
async function safeUpdatePurchaseOrder(supabase: any, poId: string, payload: any) {
  let { error } = await supabase
    .from("purchase_orders")
    .update(payload)
    .eq("id", poId);

  if (error && (error.code === "PGRST204" || error.code === "42703" || error.message?.includes("column") || error.message?.includes("schema cache"))) {
    const safePayload = { ...payload };
    delete safePayload.eta;
    delete safePayload.revision_no;
    delete safePayload.revisions;
    delete safePayload.activity_logs;
    delete safePayload.confirmed_by_id;
    delete safePayload.confirmed_by_name;
    delete safePayload.confirmed_at;
    delete safePayload.cancellation_status;
    delete safePayload.cancellation_reason;
    delete safePayload.cancellation_requested_by;
    delete safePayload.cancellation_requested_at;
    delete safePayload.cancellation_confirmed_by;
    delete safePayload.cancellation_confirmed_at;
    delete safePayload.cancellation_rejected_by;
    delete safePayload.cancellation_rejected_at;
    delete safePayload.cancellation_reject_reason;

    const retryRes = await supabase
      .from("purchase_orders")
      .update(safePayload)
      .eq("id", poId);
    error = retryRes.error;
  }

  if (error) {
    throw new Error(`발주서 헤더 수정 실패: ${error.message}`);
  }
}

/**
 * Handle state transitions in the PO workflow (Approve, Send, Cancel, etc.)
 */
export async function transitionPoStatus(poId: string, targetStatus: string) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const actorName = staff?.display_name || "어드민";

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");

  const easternNow = formatEasternDateTime(new Date().toISOString());
  const currentLogs = Array.isArray(po.activity_logs) ? po.activity_logs : [];

  // Transition validation
  if (targetStatus === "APPROVED") {
    if (po.po_status !== "DRAFT") throw new Error("DRAFT 상태인 발주서만 승인할 수 있습니다.");
    
    const newLogs = [{ event: "Approved", actor: actorName, timestamp: easternNow }, ...currentLogs];
    await safeUpdatePurchaseOrder(supabase, poId, {
      po_status: "APPROVED",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      activity_logs: newLogs,
      updated_at: new Date().toISOString(),
    });
  } else if (targetStatus === "SENT") {
    if (po.po_status !== "APPROVED") throw new Error("APPROVED 상태인 발주서만 발송 처리할 수 있습니다.");

    // Compute total quantity
    const { data: poLines } = await supabase.from("purchase_order_lines").select("qty").eq("purchase_order_id", poId);
    const totalQty = (poLines || []).reduce((sum: number, l: any) => sum + (Number(l.qty) || 0), 0);

    const newLogs = [{ event: "Sent", actor: actorName, timestamp: easternNow }, ...currentLogs];
    await safeUpdatePurchaseOrder(supabase, poId, {
      po_status: "SENT",
      fulfillment_status: "PENDING",
      supplier_confirmation_status: po.supplier_confirmation_status || "PENDING",
      sent_at: new Date().toISOString(),
      activity_logs: newLogs,
      updated_at: new Date().toISOString(),
    });

    // Create PO_RECEIVED notification for Brand Portal
    await createPoNotification({
      companyId: po.supplier_id,
      type: "PO_RECEIVED",
      title: "새로운 발주서가 도착했습니다.",
      content: `${po.po_number} · 총 수량 ${totalQty}개`,
      linkUrl: `/portal/orders/purchase-orders/${poId}`,
      poNumber: po.po_number,
      poId: poId,
      metadata: { total_qty: totalQty }
    });
  } else if (targetStatus === "IN_PRODUCTION") {
    if (po.po_status !== "SENT") throw new Error("SENT 상태인 발주서만 생산 상태로 변경할 수 있습니다.");
    
    const newLogs = [{ event: "In Production", actor: actorName, timestamp: easternNow }, ...currentLogs];
    await safeUpdatePurchaseOrder(supabase, poId, {
      fulfillment_status: "IN_PRODUCTION",
      activity_logs: newLogs,
      updated_at: new Date().toISOString(),
    });
  } else if (targetStatus === "READY_TO_SHIP") {
    if (po.po_status !== "SENT") throw new Error("SENT 상태인 발주서만 선적대기 상태로 변경할 수 있습니다.");
    
    const newLogs = [{ event: "Ready to Ship", actor: actorName, timestamp: easternNow }, ...currentLogs];
    await safeUpdatePurchaseOrder(supabase, poId, {
      fulfillment_status: "READY_TO_SHIP",
      activity_logs: newLogs,
      updated_at: new Date().toISOString(),
    });
  } else if (targetStatus === "CANCELLED") {
    if (po.po_status === "CANCELLED") throw new Error("이미 취소된 발주서입니다.");

    // Direct Cancellation Rule:
    // If supplier already CONFIRMED, Admin cannot cancel directly. Must request cancellation!
    if (po.supplier_confirmation_status === "CONFIRMED") {
      throw new Error("공급사가 이미 확인 완료(Confirmed)한 발주서는 직접 취소할 수 없습니다. '발주 취소 요청'을 진행해주세요.");
    }
    
    const newLogs = [
      {
        event: "Cancelled",
        actor: actorName,
        previous_status: po.po_status,
        timestamp: easternNow,
      },
      ...currentLogs,
    ];

    await safeUpdatePurchaseOrder(supabase, poId, {
      po_status: "CANCELLED",
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
      cancellation_status: "CANCELLED",
      activity_logs: newLogs,
      updated_at: new Date().toISOString(),
    });

    // If it was SENT, send PO_CANCELLED notification to Portal
    if (po.po_status === "SENT" || po.sent_at) {
      await createPoNotification({
        companyId: po.supplier_id,
        type: "PO_CANCELLED",
        title: "발주서가 취소되었습니다.",
        content: `${po.po_number}`,
        linkUrl: `/portal/orders/purchase-orders/${poId}`,
        poNumber: po.po_number,
        poId: poId,
      });
    }
  } else {
    throw new Error(`알 수 없는 발주 진행 상태입니다: ${targetStatus}`);
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${poId}`);
  revalidatePath(`/portal/orders/purchase-orders/${poId}`);
  revalidatePath("/portal/orders/purchase-orders");
  return { success: true };
}

/**
 * Admin requests PO cancellation after Supplier has already Confirmed.
 */
export async function requestPoCancellation(
  poId: string,
  reason: string,
  reasonCategory: string = "Other"
) {
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();
  await verifyWritePermission(supabase, userId);

  if (!reason || reason.trim().length === 0) {
    throw new Error("취소 요청 사유를 입력해주세요.");
  }

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const actorName = staff?.display_name || "어드민";

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .single();

  if (!po) throw new Error("Purchase order not found.");
  if (po.po_status === "CANCELLED") throw new Error("이미 취소된 발주서입니다.");

  const easternNow = formatEasternDateTime(new Date().toISOString());
  const currentLogs = Array.isArray(po.activity_logs) ? po.activity_logs : [];
  const newLogs = [
    {
      event: "Cancellation Requested",
      actor: actorName,
      reason,
      reason_category: reasonCategory,
      timestamp: easternNow,
    },
    ...currentLogs,
  ];

  await supabase
    .from("purchase_orders")
    .update({
      cancellation_status: "CANCELLATION_REQUESTED",
      cancellation_reason: reason,
      cancellation_requested_by: userId,
      cancellation_requested_at: new Date().toISOString(),
      activity_logs: newLogs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  // Send PO_CANCELLATION_REQUESTED notification to Portal
  await createPoNotification({
    companyId: po.supplier_id,
    type: "PO_CANCELLATION_REQUESTED",
    title: "발주 취소 요청이 접수되었습니다.",
    content: `${po.po_number}`,
    linkUrl: `/portal/orders/purchase-orders/${poId}`,
    poNumber: po.po_number,
    poId: poId,
    metadata: { reason, reason_category: reasonCategory }
  });

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${poId}`);
  revalidatePath(`/portal/orders/purchase-orders/${poId}`);
  revalidatePath("/portal/orders/purchase-orders");
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
