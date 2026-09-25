"use server";

import { submitAdminProtectionDecisionAction as submitAction } from "@/lib/protection/admin-actions";

export async function submitAdminProtectionDecisionAction(params: {
  protectionId: string;
  decision: "approved" | "rejected" | "needs_information";
  decisionNotes?: string;
  approvedQuantity?: number | null;
  approvedCreditAmount?: number | null;
}) {
  return await submitAction(params);
}
