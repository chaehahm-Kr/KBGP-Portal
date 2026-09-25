export type RetailerFulfillmentStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface RetailerFulfillmentItem {
  id: string;
  fulfillmentId: string;
  orderItemId: string;
  productId: string;
  sku: string;
  productName: string;
  quantityShipped: number;
  quantityDelivered: number;
  createdAt: string;
}

export interface RetailerFulfillment {
  id: string;
  fulfillmentNumber: string;
  orderId: string;
  companyId: string;
  storeId: string;
  status: RetailerFulfillmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippedBy: string | null;
  deliveredBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: RetailerFulfillmentItem[];
}

export interface OrderFulfillmentProgress {
  totalOrderedUnits: number;
  totalShippedUnits: number;
  totalDeliveredUnits: number;
  remainingToShipUnits: number;
  fulfillmentStatusSummary:
    | "unfulfilled"
    | "partially_shipped"
    | "shipped"
    | "partially_delivered"
    | "delivered";
  fulfillments: RetailerFulfillment[];
}
