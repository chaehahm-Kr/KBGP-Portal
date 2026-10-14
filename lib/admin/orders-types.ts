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
  invoices: AdminOrderInvoiceSummary[];
  cancellationRequested: boolean;
  refundAmount: number;
  refundStatus: string;
  processingFee?: number;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
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
  search?: string;
  sku?: string;
  status?: string;
  paymentStatus?: string;
  companyId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}
