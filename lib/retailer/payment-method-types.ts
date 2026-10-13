export interface RetailerPaymentMethodRecord {
  id: string;
  companyId: string;
  paymentMethodType: "card" | "ach";
  providerName: string;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  bankName?: string | null;
  accountHolderType?: string | null;
  isDefault: boolean;
  status: "active" | "inactive" | "revoked";
  createdAt: string;
}

export interface PaymentMethodsStatusResponse {
  providerReady: boolean;
  providerStatus: "setup_pending" | "connected" | "disabled";
  cardProcessingAllowed: boolean;
  achProcessingAllowed: boolean;
  methods: RetailerPaymentMethodRecord[];
}
