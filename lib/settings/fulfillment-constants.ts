export const DEFAULT_ESTIMATED_SHIPPING_DAYS = 5;

export interface FulfillmentSettingsPayload {
  default_estimated_shipping_days: number;
  updated_at?: string;
}
