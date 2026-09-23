"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOverallStatus, OVERALL_STATUS_LABELS, OVERALL_STATUS_COLORS } from "@/lib/purchase-order/status-helper";
import { resolveEffectiveSku } from "@/lib/product/types";

export interface DashboardFilterInput {
  dateRangePreset?: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  poStatus?: string;
  orderStatus?: string;
  destinationWarehouseId?: string;
}

export interface KpiSummary {
  totalPoCount: number;
  totalOrderedQty: number;
  totalOrderAmount: number;
  openPoAmount: number;
  unreceivedQty: number;
  unreceivedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overduePoCount: number;
}

export interface CanonicalStatusItem {
  key: 'Pending' | 'In Production' | 'Ready to Ship' | 'Shipped' | 'Received';
  label: string;
  poCount: number;
  orderedQty: number;
  orderAmount: number;
  colorClass: string;
}

export interface SupplierSummaryItem {
  supplierId: string;
  supplierName: string;
  poCount: number;
  openPoCount: number;
  orderedQty: number;
  orderAmount: number;
  shippedQty: number;
  receivedQty: number;
  paidAmount: number;
  outstandingAmount: number;
  lastOrderDate: string;
}

export interface ProductOrderSummaryItem {
  productId: string;
  productName: string;
  letustoSku: string;
  manufactureSku: string;
  supplierName: string;
  imageUrl: string | null;
  totalOrderedQty: number;
  shippedQty: number;
  receivedQty: number;
  remainingQty: number;
  totalOrderAmount: number;
  lastOrderDate: string;
}

export interface PaymentSummaryData {
  totalPoAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  supplierPayments: {
    supplierId: string;
    supplierName: string;
    invoicedAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  }[];
}

export interface AttentionItem {
  type: 'OVERDUE' | 'READY_TO_SHIP' | 'PARTIAL_SHIPMENT' | 'PARTIAL_RECEIVING' | 'PAYMENT_DUE';
  typeLabel: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  detailMessage: string;
  expectedDate?: string;
  badgeColor: string;
}

export interface PurchasingDashboardData {
  kpis: KpiSummary;
  orderStatusSummary: CanonicalStatusItem[];
  supplierSummary: SupplierSummaryItem[];
  productSummary: ProductOrderSummaryItem[];
  paymentSummary: PaymentSummaryData;
  attentionItems: AttentionItem[];
  suppliersList: { id: string; name: string }[];
  warehousesList: { id: string; name: string; code: string }[];
}

function computeCanonicalStatus(overallStatus: string): 'Pending' | 'In Production' | 'Ready to Ship' | 'Shipped' | 'Received' {
  switch (overallStatus) {
    case 'In Production':
      return 'In Production';
    case 'Ready to Ship':
      return 'Ready to Ship';
    case 'Shipped':
    case 'Arrived':
      return 'Shipped';
    case 'Receiving':
    case 'Completed':
      return 'Received';
    case 'Draft':
    case 'Approved':
    case 'Sent to Supplier':
    case 'Change Requested':
    case 'Supplier Confirmed':
    default:
      return 'Pending';
  }
}

export async function mapToCanonicalStatus(overallStatus: string): Promise<'Pending' | 'In Production' | 'Ready to Ship' | 'Shipped' | 'Received'> {
  return computeCanonicalStatus(overallStatus);
}

/**
 * Main Server Action to fetch and calculate Purchasing Dashboard Metrics with Filters.
 */
export async function getPurchasingDashboardData(filters: DashboardFilterInput = {}): Promise<PurchasingDashboardData> {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch all Suppliers & Warehouses for filter dropdowns
  const { data: dbCompanies } = await supabase
    .from("companies")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, type")
    .eq("status", "active")
    .order("name", { ascending: true });

  const suppliersList = (dbCompanies ?? []).map((c: any) => ({ id: c.id, name: c.name || "(미지정 공급사)" }));
  const warehousesList = (dbWarehouses ?? [])
    .filter((w: any) => (w.type || "").toLowerCase() === "own")
    .map((w: any) => ({ id: w.id, name: w.name, code: w.code }));

  // 2. Fetch all Purchase Orders with relations
  const { data: rawPos, error: poErr } = await supabase
    .from("purchase_orders")
    .select(`
      id, po_number, order_date, po_status, fulfillment_status, supplier_confirmation_status, currency,
      expected_ready_date, expected_ship_date, updated_at, created_at,
      supplier_id, destination_warehouse_id, ship_from_warehouse_id,
      companies:supplier_id (id, name),
      destination_warehouse:destination_warehouse_id (id, name, code),
      purchase_order_lines (
        id, product_id, qty, unit_cost, confirmed_qty, product_name_snapshot, manufacture_sku_snapshot, letusto_sku_snapshot, line_note,
        products (
          id, name, name_en, manufacture_sku, letusto_sku, parent_sku, child_sku, brand_id, price_additional_info,
          brands (name),
          product_images (storage_path, position)
        )
      )
    `)
    .order("order_date", { ascending: false });

  if (poErr) throw new Error(`Failed to fetch purchase orders: ${poErr.message}`);

  // 3. Fetch Shipments with lines
  const { data: allShipments } = await supabase
    .from("inbound_shipments")
    .select("id, purchase_order_id, status, eta, inbound_shipment_lines (purchase_order_line_id, shipped_qty)");

  // 4. Fetch Receivings with lines
  const { data: allReceivings } = await supabase
    .from("receivings")
    .select("id, purchase_order_id, status, receiving_lines (purchase_order_line_id, received_qty, damaged_qty, hold_qty)");

  // 5. Fetch Supplier Invoices & Payments
  const { data: allInvoices } = await supabase
    .from("supplier_invoices")
    .select("id, purchase_order_id, company_id, invoice_number, invoice_total, amount_paid, balance_due, invoice_status, payment_status, due_date");

  const { data: allPayments } = await supabase
    .from("supplier_payments")
    .select("id, supplier_invoice_id, payment_amount, status, payment_date");

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

  // Get signed file URLs for images
  const { getSignedFileUrl } = await import("@/lib/files/storage");
  const storagePaths = new Set<string>();
  (rawPos ?? []).forEach((po: any) => {
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

  // Pre-process all POs with calculated metrics
  const processedPos = (rawPos ?? []).map((po: any) => {
    const poShipments = (allShipments ?? []).filter((s) => s.purchase_order_id === po.id);
    const poReceivings = (allReceivings ?? []).filter((r) => r.purchase_order_id === po.id);

    const overallStatus = getOverallStatus(po, poShipments, poReceivings);
    const canonicalStatus = computeCanonicalStatus(overallStatus);

    const rawLines = po.purchase_order_lines || [];
    let totalOrderedQty = 0;
    let totalOrderAmount = 0;
    let totalShippedQty = 0;
    let totalReceivedQty = 0;

    const enrichedLines = rawLines.map((l: any) => {
      const p = l.products || {};
      const adminOverrides = p.price_additional_info?.admin_overrides || {};
      const prodName = l.product_name_snapshot || adminOverrides.name_en || p.name_en || adminOverrides.name || p.name || "(이름 없음)";
      
      const rawLetustoSku = l.letusto_sku_snapshot || resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
      const letustoSku = rawLetustoSku && rawLetustoSku !== "-" ? rawLetustoSku : "지정 대기";
      const manufactureSku = l.manufacture_sku_snapshot || resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku) || "-";

      const qty = l.qty || 0;
      const unitCost = Number(l.unit_cost || 0);
      const shippedQty = shippedLineMap.get(l.id) || 0;
      const receivedQty = receivedLineMap.get(l.id) || 0;
      const remainingQty = Math.max(0, qty - receivedQty);

      totalOrderedQty += qty;
      totalOrderAmount += qty * unitCost;
      totalShippedQty += shippedQty;
      totalReceivedQty += receivedQty;

      const firstImg = (p.product_images || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0))[0];
      const imageUrl = firstImg?.storage_path ? signedImageMap.get(firstImg.storage_path) || null : null;

      return {
        id: l.id,
        productId: l.product_id,
        productName: prodName,
        letustoSku,
        manufactureSku,
        qty,
        unitCost,
        shippedQty,
        receivedQty,
        remainingQty,
        lineTotal: qty * unitCost,
        imageUrl,
      };
    });

    const supplierId = po.companies?.id || po.supplier_id || "";
    const supplierName = po.companies?.name || "(미지정 공급사)";
    const warehouseId = po.destination_warehouse_id || "";
    const warehouseName = po.destination_warehouse?.name || "(미지정 창고)";
    const warehouseCode = po.destination_warehouse?.code || "-";

    const isCompletedOrCancelled = overallStatus === "Completed" || po.po_status === "CANCELLED";
    const isOpen = !isCompletedOrCancelled;

    const unreceivedQty = Math.max(0, totalOrderedQty - totalReceivedQty);
    const unreceivedAmount = enrichedLines.reduce((sum: number, l: any) => sum + l.remainingQty * l.unitCost, 0);

    // Linked invoices
    const poInvoices = (allInvoices ?? []).filter((i: any) => i.purchase_order_id === po.id && i.invoice_status !== 'CANCELLED');
    const invoicedAmount = poInvoices.reduce((sum: number, i: any) => sum + Number(i.invoice_total || 0), 0);
    const paidAmount = poInvoices.reduce((sum: number, i: any) => sum + Number(i.amount_paid || 0), 0);
    const outstandingAmount = poInvoices.reduce((sum: number, i: any) => sum + Number(i.balance_due || 0), 0);

    // Check overdue
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = po.expected_ready_date || po.expected_ship_date || po.order_date;
    const isOverdue = isOpen && targetDate && targetDate < todayStr;

    return {
      id: po.id,
      poNumber: po.po_number,
      orderDate: po.order_date,
      expectedDate: targetDate,
      poStatus: po.po_status,
      overallStatus,
      canonicalStatus,
      supplierId,
      supplierName,
      warehouseId,
      warehouseName,
      warehouseCode,
      currency: po.currency || "USD",
      isOpen,
      isOverdue,
      totalOrderedQty,
      totalOrderAmount,
      totalShippedQty,
      totalReceivedQty,
      unreceivedQty,
      unreceivedAmount,
      invoicedAmount,
      paidAmount,
      outstandingAmount,
      lines: enrichedLines,
      invoices: poInvoices,
    };
  });

  // Apply Filters to POs
  let filteredPos = processedPos;

  // Date Filter
  if (filters.dateRangePreset && filters.dateRangePreset !== 'custom') {
    const now = new Date();
    let start: Date;
    let end: Date = new Date();

    if (filters.dateRangePreset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filters.dateRangePreset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filters.dateRangePreset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (filters.dateRangePreset === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    filteredPos = filteredPos.filter((po) => po.orderDate >= startStr && po.orderDate <= endStr);
  } else if (filters.startDate || filters.endDate) {
    if (filters.startDate) {
      filteredPos = filteredPos.filter((po) => po.orderDate >= filters.startDate!);
    }
    if (filters.endDate) {
      filteredPos = filteredPos.filter((po) => po.orderDate <= filters.endDate!);
    }
  }

  // Supplier Filter
  if (filters.supplierId && filters.supplierId !== 'ALL') {
    filteredPos = filteredPos.filter((po) => po.supplierId === filters.supplierId);
  }

  // PO Status Filter
  if (filters.poStatus && filters.poStatus !== 'ALL') {
    filteredPos = filteredPos.filter((po) => po.poStatus === filters.poStatus);
  }

  // Order Status (Canonical) Filter
  if (filters.orderStatus && filters.orderStatus !== 'ALL') {
    filteredPos = filteredPos.filter((po) => po.canonicalStatus === filters.orderStatus);
  }

  // Destination Warehouse Filter
  if (filters.destinationWarehouseId && filters.destinationWarehouseId !== 'ALL') {
    filteredPos = filteredPos.filter((po) => po.warehouseId === filters.destinationWarehouseId);
  }

  // === CALCULATE 1. TOP KPI SUMMARY ===
  const activeFilteredPos = filteredPos.filter((po) => po.poStatus !== "CANCELLED");

  const kpis: KpiSummary = {
    totalPoCount: activeFilteredPos.length,
    totalOrderedQty: activeFilteredPos.reduce((sum, po) => sum + po.totalOrderedQty, 0),
    totalOrderAmount: activeFilteredPos.reduce((sum, po) => sum + po.totalOrderAmount, 0),
    openPoAmount: activeFilteredPos.filter((po) => po.isOpen).reduce((sum, po) => sum + po.totalOrderAmount, 0),
    unreceivedQty: activeFilteredPos.reduce((sum, po) => sum + po.unreceivedQty, 0),
    unreceivedAmount: activeFilteredPos.reduce((sum, po) => sum + po.unreceivedAmount, 0),
    paidAmount: activeFilteredPos.reduce((sum, po) => sum + po.paidAmount, 0),
    outstandingAmount: activeFilteredPos.reduce((sum, po) => sum + po.outstandingAmount, 0),
    overduePoCount: activeFilteredPos.filter((po) => po.isOverdue).length,
  };

  // === CALCULATE 2. ORDER STATUS SUMMARY ===
  const statusConfig: { key: 'Pending' | 'In Production' | 'Ready to Ship' | 'Shipped' | 'Received'; label: string; colorClass: string }[] = [
    { key: 'Pending', label: '발주/확인 대기 (Pending)', colorClass: 'bg-zinc-500' },
    { key: 'In Production', label: '생산중 (In Production)', colorClass: 'bg-amber-500' },
    { key: 'Ready to Ship', label: '선적 대기 (Ready to Ship)', colorClass: 'bg-emerald-500' },
    { key: 'Shipped', label: '출고/운송중 (Shipped)', colorClass: 'bg-sky-500' },
    { key: 'Received', label: '입고/종결 (Received)', colorClass: 'bg-indigo-500' },
  ];

  const orderStatusSummary: CanonicalStatusItem[] = statusConfig.map((cfg) => {
    const matchingPos = activeFilteredPos.filter((po) => po.canonicalStatus === cfg.key);
    return {
      key: cfg.key,
      label: cfg.label,
      poCount: matchingPos.length,
      orderedQty: matchingPos.reduce((sum, po) => sum + po.totalOrderedQty, 0),
      orderAmount: matchingPos.reduce((sum, po) => sum + po.totalOrderAmount, 0),
      colorClass: cfg.colorClass,
    };
  });

  // === CALCULATE 3. SUPPLIER SUMMARY ===
  const supplierMap = new Map<string, SupplierSummaryItem>();

  activeFilteredPos.forEach((po) => {
    const sId = po.supplierId || "unknown";
    const sName = po.supplierName;

    let item = supplierMap.get(sId);
    if (!item) {
      item = {
        supplierId: sId,
        supplierName: sName,
        poCount: 0,
        openPoCount: 0,
        orderedQty: 0,
        orderAmount: 0,
        shippedQty: 0,
        receivedQty: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        lastOrderDate: po.orderDate || "",
      };
      supplierMap.set(sId, item);
    }

    item.poCount += 1;
    if (po.isOpen) item.openPoCount += 1;
    item.orderedQty += po.totalOrderedQty;
    item.orderAmount += po.totalOrderAmount;
    item.shippedQty += po.totalShippedQty;
    item.receivedQty += po.totalReceivedQty;
    item.paidAmount += po.paidAmount;
    item.outstandingAmount += po.outstandingAmount;
    if (po.orderDate > item.lastOrderDate) {
      item.lastOrderDate = po.orderDate;
    }
  });

  const supplierSummary = Array.from(supplierMap.values()).sort((a, b) => b.orderAmount - a.orderAmount);

  // === CALCULATE 4. PRODUCT ORDER SUMMARY ===
  const productMap = new Map<string, ProductOrderSummaryItem>();

  activeFilteredPos.forEach((po) => {
    po.lines.forEach((l: any) => {
      const pId = l.productId || "unknown";
      let pItem = productMap.get(pId);

      if (!pItem) {
        pItem = {
          productId: pId,
          productName: l.productName,
          letustoSku: l.letustoSku,
          manufactureSku: l.manufactureSku,
          supplierName: po.supplierName,
          imageUrl: l.imageUrl,
          totalOrderedQty: 0,
          shippedQty: 0,
          receivedQty: 0,
          remainingQty: 0,
          totalOrderAmount: 0,
          lastOrderDate: po.orderDate || "",
        };
        productMap.set(pId, pItem);
      }

      pItem.totalOrderedQty += l.qty;
      pItem.shippedQty += l.shippedQty;
      pItem.receivedQty += l.receivedQty;
      pItem.remainingQty += l.remainingQty;
      pItem.totalOrderAmount += l.lineTotal;
      if (po.orderDate > pItem.lastOrderDate) {
        pItem.lastOrderDate = po.orderDate;
      }
    });
  });

  const productSummary = Array.from(productMap.values()).sort((a, b) => b.totalOrderAmount - a.totalOrderAmount);

  // === CALCULATE 5. PAYMENT SUMMARY ===
  const totalPoAmount = kpis.totalOrderAmount;
  const invoicedAmount = activeFilteredPos.reduce((sum, po) => sum + po.invoicedAmount, 0);
  const paidAmount = kpis.paidAmount;
  const outstandingAmount = kpis.outstandingAmount;

  const supplierPayments = supplierSummary.map((s) => ({
    supplierId: s.supplierId,
    supplierName: s.supplierName,
    invoicedAmount: activeFilteredPos.filter((po) => po.supplierId === s.supplierId).reduce((sum, po) => sum + po.invoicedAmount, 0),
    paidAmount: s.paidAmount,
    outstandingAmount: s.outstandingAmount,
  }));

  const paymentSummary: PaymentSummaryData = {
    totalPoAmount,
    invoicedAmount,
    paidAmount,
    outstandingAmount,
    supplierPayments,
  };

  // === CALCULATE 6. ATTENTION REQUIRED SECTION ===
  const attentionItems: AttentionItem[] = [];

  activeFilteredPos.forEach((po) => {
    // 1. Overdue PO
    if (po.isOverdue) {
      attentionItems.push({
        type: 'OVERDUE',
        typeLabel: '지연 PO (Overdue)',
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        expectedDate: po.expectedDate,
        detailMessage: `예정일(${po.expectedDate})이 경과되었으나 미종결 상태입니다.`,
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
      });
    }

    // 2. Ready to Ship
    if (po.overallStatus === "Ready to Ship") {
      attentionItems.push({
        type: 'READY_TO_SHIP',
        typeLabel: '선적 대기 (Ready to Ship)',
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        detailMessage: `공급사의 제품 생산이 완료되어 선적(Inbound Shipment) 등록이 필요합니다.`,
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
      });
    }

    // 3. Partial Shipment
    if (po.totalShippedQty > 0 && po.totalShippedQty < po.totalOrderedQty && po.isOpen) {
      attentionItems.push({
        type: 'PARTIAL_SHIPMENT',
        typeLabel: '부분 출고 (Partial Shipment)',
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        detailMessage: `주문수량 ${po.totalOrderedQty.toLocaleString()}개 중 ${po.totalShippedQty.toLocaleString()}개 출고됨 (잔여: ${(po.totalOrderedQty - po.totalShippedQty).toLocaleString()}개)`,
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
      });
    }

    // 4. Partial Receiving
    if (po.totalReceivedQty > 0 && po.totalReceivedQty < po.totalOrderedQty && po.isOpen) {
      attentionItems.push({
        type: 'PARTIAL_RECEIVING',
        typeLabel: '부분 입고 (Partial Receiving)',
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        detailMessage: `주문수량 ${po.totalOrderedQty.toLocaleString()}개 중 ${po.totalReceivedQty.toLocaleString()}개 입고 완료됨 (미입고: ${po.unreceivedQty.toLocaleString()}개)`,
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
      });
    }

    // 5. Payment Due / Outstanding
    if (po.outstandingAmount > 0) {
      attentionItems.push({
        type: 'PAYMENT_DUE',
        typeLabel: '미지급 잔액 (Payment Due)',
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        detailMessage: `미지급 금액: $${po.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800',
      });
    }
  });

  return {
    kpis,
    orderStatusSummary,
    supplierSummary,
    productSummary,
    paymentSummary,
    attentionItems,
    suppliersList,
    warehousesList,
  };
}
