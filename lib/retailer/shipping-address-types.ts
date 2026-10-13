export interface RetailerShippingAddress {
  id: string;
  companyId: string;
  label: string;
  recipientName: string;
  attentionName?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
  deliveryNotes?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShippingAddressInput {
  label: string;
  recipientName: string;
  attentionName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone?: string;
  deliveryNotes?: string;
  isDefault?: boolean;
}

export interface UpdateShippingAddressInput extends Partial<CreateShippingAddressInput> {
  isActive?: boolean;
}

export type ShippingDestinationType = "store" | "saved_address" | "custom_address";

export interface OrderShippingSnapshot {
  destinationType: ShippingDestinationType;
  storeId?: string | null;
  storeName?: string | null;
  savedAddressId?: string | null;
  label?: string | null;
  recipientName: string;
  attentionName?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
  deliveryNotes?: string | null;
}
