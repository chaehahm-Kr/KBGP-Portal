export type RetailerRole = "owner" | "buyer" | "store_manager" | "employee" | "accounting";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface RetailerInvitationItem {
  id: string;
  companyId: string;
  companyName?: string;
  email: string;
  role: RetailerRole;
  hasAllStoresAccess: boolean;
  storeIds: string[];
  status: InvitationStatus;
  expiresAt: string;
  invitedByEmail?: string | null;
  acceptedAt?: string | null;
  acceptedByEmail?: string | null;
  emailDeliveryStatus: "sent" | "failed" | "skipped";
  createdAt: string;
}

export interface RetailerTeamMember {
  id: string; // User ID
  name: string;
  email: string;
  role: RetailerRole;
  hasAllStoresAccess: boolean;
  assignedStores: Array<{
    id: string;
    name: string;
    city?: string;
  }>;
  status: "active" | "invited" | "suspended";
  isPrimary: boolean;
  joinedAt: string;
}

export interface RetailerCompanyProfile {
  id: string;
  name: string;
  businessRegistrationNumber?: string;
  country: string;
  contactEmail?: string;
  phone?: string;
  status: string;
  retailerProfileStatus?: string;
  paymentTerms?: string;
  creditLimit?: number;
  storesCount: number;
  stores: Array<{
    id: string;
    storeCode?: string;
    name: string;
    type?: string;
    status: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    email?: string;
  }>;
}

export interface InvitationValidationResult {
  valid: boolean;
  error?: string;
  invitation?: {
    id: string;
    companyId: string;
    companyName: string;
    email: string;
    role: RetailerRole;
    hasAllStoresAccess: boolean;
    assignedStores: Array<{
      id: string;
      name: string;
      city?: string;
    }>;
    expiresAt: string;
  };
}
