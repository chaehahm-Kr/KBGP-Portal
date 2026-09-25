export type RetailerPaymentMethod = "card" | "ach" | "terms";

export type RetailerApprovedTerms = "prepaid" | "net15" | "net30" | "net45" | "net60";

export type RetailerTermsStatus = "pending" | "approved" | "suspended" | "rejected";

export type RetailerPaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "partially_paid"
  | "failed"
  | "refunded";

export interface RetailerPaymentEligibility {
  cardEnabled: boolean;
  achEnabled: boolean;
  termsEnabled: boolean;
  approvedTerms: RetailerApprovedTerms;
  termsStatus: RetailerTermsStatus;
  creditLimit: number;
  availableMethods: Array<{
    id: RetailerPaymentMethod;
    label: string;
    description: string;
    badge?: string;
    isTerms?: boolean;
    termsLabel?: string;
  }>;
}

export interface RetailerPaymentRecord {
  id: string;
  orderId: string;
  companyId: string;
  paymentMethod: RetailerPaymentMethod;
  provider: string;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  failureReason?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface RetailerOrderPaymentSummary {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paymentStatus: RetailerPaymentStatus;
  paymentMethod: RetailerPaymentMethod | null;
  paymentTerms: string;
  paymentDueDate: string | null;
  paidAt: string | null;
  paymentProvider: string | null;
  paymentProviderRef: string | null;
  payments: RetailerPaymentRecord[];
}
