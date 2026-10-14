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

export interface StoreShippingOption {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  managerName?: string | null;
  isEligible: boolean;
  isExplicitDefault?: boolean;
}

export interface ResolvedDefaultShippingDestination {
  type: "saved_address" | "store";
  id: string;
  name: string;
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
  isExplicitDefault: boolean;
  isStoreFallback: boolean;
}

export interface RetailerShippingDestinationsResult {
  savedAddresses: RetailerShippingAddress[];
  stores: StoreShippingOption[];
  defaultDestination: ResolvedDefaultShippingDestination | null;
}

