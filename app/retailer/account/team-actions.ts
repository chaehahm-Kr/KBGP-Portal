"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import {
  createRetailerInvitation,
  acceptRetailerInvitation,
  resendRetailerInvitation,
  revokeRetailerInvitation,
} from "@/lib/retailer/onboarding-actions";
import { RetailerRole } from "@/lib/retailer/onboarding-types";

export async function inviteTeamMemberAction(params: {
  companyId?: string;
  email: string;
  role: RetailerRole;
  hasAllStoresAccess?: boolean;
  storeIds?: string[];
}) {
  const session = await verifyRetailerSession();
  const { companyId: defaultCompanyId, userRole } = await getRetailerAccessibleStores();

  const targetCompanyId = params.companyId || defaultCompanyId;

  if (!targetCompanyId) {
    return { success: false, error: "Company not found." };
  }

  if (userRole !== "owner" && userRole !== "buyer") {
    return {
      success: false,
      error: "Only Company Owners and Buyers are authorized to invite team members.",
    };
  }

  const res = await createRetailerInvitation({
    companyId: targetCompanyId,
    email: params.email,
    role: params.role,
    hasAllStoresAccess: params.hasAllStoresAccess,
    storeIds: params.storeIds,
    invitedBy: session.userId,
  });

  if (res.success) {
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/account/team");
    revalidatePath("/account");
  }

  return res;
}

export async function acceptInvitationAction(params: {
  rawToken: string;
  name: string;
  password?: string;
  acceptedTerms: boolean;
}) {
  return await acceptRetailerInvitation(params);
}

export async function resendTeamInvitationAction(invitationId: string) {
  await verifyRetailerSession();
  const { userRole } = await getRetailerAccessibleStores();

  if (userRole !== "owner" && userRole !== "buyer") {
    return {
      success: false,
      error: "Only Company Owners and Buyers are authorized to resend invitations.",
    };
  }

  const res = await resendRetailerInvitation(invitationId);
  if (res.success) {
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/account/team");
    revalidatePath("/account");
  }
  return res;
}

export async function revokeTeamInvitationAction(invitationId: string) {
  await verifyRetailerSession();
  const { userRole } = await getRetailerAccessibleStores();

  if (userRole !== "owner" && userRole !== "buyer") {
    return {
      success: false,
      error: "Only Company Owners and Buyers are authorized to revoke invitations.",
    };
  }

  const res = await revokeRetailerInvitation(invitationId);
  if (res.success) {
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/account/team");
    revalidatePath("/account");
  }
  return res;
}
