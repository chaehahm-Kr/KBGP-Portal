// lib/admin/orders-types.ts
// Phase B6 Admin Retailer Orders Centralized Architecture Types

export type ApprovedOrderStatus =
  | "submitted"
  | "processing"
  | "partially_shipped"
  | "shipped"
  | "partially_cancelled"
  | "cancelled";

export interface AdminOrderPackageItem {
  orderItemId: string;
  sku: string;
  productName: string;
  quantity: number;
}

export interface AdminOrderPackage {
  id: string;
  fulfillmentId: string;
  orderId: string;
  boxNumber: number;
  boxTotal: number;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  weightLbs: number | null;
  dimensionsInch: string | null;
  packageItems: AdminOrderPackageItem[];
  createdAt: string;
}

export interface AdminOrderBox {
  id: string;
  fulfillmentId: string;
  orderId: string;
  boxNumber: number;
  boxTotal: number;
  carrier: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  weightLbs?: number | null;
  dimensionsInch?: string | null;
  status: "active" | "void" | "archived";
  notes?: string | null;
  createdAt: string;
}

export interface AdminOrderShipmentItem {
  id: string;
  fulfillmentId: string;
  orderItemId: string;
  productId: string;
  sku: string;
  productName: string;
  quantityShipped: number;
  quantityDelivered: number;
}

export interface AdminOrderShipment {
  id: string;
  fulfillmentNumber: string;
  orderId: string;
  companyId: string;
  storeId: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  boxCount: number;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippedByName?: string | null;
  notes: string | null;
  createdAt: string;
  items: AdminOrderShipmentItem[];
  packages: AdminOrderPackage[];
  boxes: AdminOrderBox[];
}

export interface AdminOrderLineItem {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  productName: string;
  brandName: string;
  unitWholesalePrice: number;
  unitMsrp: number | null;
  quantityOrdered: number;
  quantityShipped: number;
  quantityCancelled: number;
  quantityRemaining: number;
  casePackQty: number;
  lineTotal: number;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
}

export interface AdminOrderDispatchSummary {
  id: string;
  fulfillmentNumber: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  boxCount: number;
  shippedAt: string | null;
  notes?: string | null;
  createdAt: string;
  boxes: AdminOrderBox[];
  isTrackingComplete: boolean;
}

export interface AdminOrderInvoiceSummary {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  invoiceStatus: "draft" | "open" | "paid" | "void" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid" | "failed" | "refunded";
  termsName: string;
  fulfillmentId?: string | null;
  fulfillmentNumber?: string | null;
  prepaymentAllocatedAmount?: number;
}

export interface AdminRetailerOrderSummary {
  id: string;
  orderNumber: string;
  companyId: string;
  companyName: string;
  companyCode?: string | null;
  storeId: string | null;
  storeName: string;
  destinationLabel: string;
  destinationType: string;
  orderStatus: ApprovedOrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  paymentTerms: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount?: number;
  couponCode?: string | null;
  totalSkusCount: number;
  totalOrderedUnits: number;
  totalShippedUnits: number;
  totalCancelledUnits: number;
  totalRemainingUnits: number;
  totalBoxCount: number;
  packages: AdminOrderPackage[];
  dispatches: AdminOrderDispatchSummary[];
  untrackedDispatchesCount: number;
  hasConfirmedDispatch: boolean;
  daysOpen: number | null;
  isCompleted: boolean;
  invoices: AdminOrderInvoiceSummary[];
  cancellationRequested: boolean;
  refundAmount: number;
  refundStatus: string;
  processingFee?: number;
  isTest: boolean;
  shippingCity?: string | null;
  shippingState?: string | null;
  lastActivityAt?: string;
  dispatchCount?: number;
  hasMissingTracking?: boolean;
  actionRequired?: "new_order" | "ready_to_ship" | "hold_cancellation" | "tracking_needed" | "completed" | "none";
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderSummaryCounters {
  total: number;
  newOrders: number;
  readyToProcess: number;
  partiallyShipped: number;
  onHold: number;
  trackingMissing: number;
  completed: number;
}

export interface AdminRetailerOrderDetail extends AdminRetailerOrderSummary {
  shippingAddress: string | null;
  shippingAddressLine2?: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingPhone: string | null;
  recipientName: string | null;
  shippingNotes: string | null;
  taxAmount: number;
  shippingAmount: number;
  cancellationNotes: string | null;
  refundedAt: string | null;
  items: AdminOrderLineItem[];
  shipments: AdminOrderShipment[];
}

export interface AdminOrderFilter {
  quickFilter?: "all" | "new" | "ready" | "partially_shipped" | "on_hold" | "tracking_missing" | "completed";
  search?: string;
  sku?: string;
  status?: string | string[];
  paymentStatus?: string;
  companyId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  datePreset?: "all" | "today" | "7d" | "30d" | "custom";
  testMode?: "all" | "live" | "test";
  sortBy?: "created_at" | "updated_at" | "order_number" | "retailer" | "remaining" | "total" | "days_open";
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface AdminRetailerOrdersResult {
  orders: AdminRetailerOrderSummary[];
  totalCount: number;
  summaryCounters: AdminOrderSummaryCounters;
  companies: { id: string; name: string; companyCode?: string | null }[];
  stores: { id: string; name: string; companyId: string; city?: string | null; state?: string | null }[];
}
