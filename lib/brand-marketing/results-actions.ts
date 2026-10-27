"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession, getAdminStaffContext } from "@/lib/auth/dal";
import {
  CampaignSummaryMetrics,
  CompanyResultItem,
  CompanyResultsFilterCriteria,
  UpdateCompanyInterestInput,
  UpdateCompanyFollowupInput,
  CompanyInterestStatus,
} from "./results-types";
import {
  getCampaignResultsSummary,
  listCompanyResults,
  updateCompanyInterestStatus,
  updateCompanyFollowup,
  recordVerifiedReply,
} from "./results-data-access";
import { listMarketingCampaigns } from "./campaign-data-access";

async function requireResultsAdmin() {
  const session = await verifyAdminSession();
  const staffCtx = await getAdminStaffContext();
  return {
    userId: session.userId,
    email: staffCtx?.email || "admin@kselectnetwork.com",
  };
}

/**
 * Fetches campaign selector options.
 */
export async function listCampaignsForSelectorAction(): Promise<{
  success: boolean;
  campaigns?: Array<{ id: string; name: string; status: string; language: "ko" | "en"; createdAt: string }>;
  error?: string;
}> {
  try {
    await requireResultsAdmin();
    const allCampaigns = await listMarketingCampaigns();
    if (allCampaigns && allCampaigns.length > 0) {
      return {
        success: true,
        campaigns: allCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          language: c.language,
          createdAt: c.createdAt,
        })),
      };
    }

    return {
      success: true,
      campaigns: [
        {
          id: "camp_autumn_outreach_2026",
          name: "2026 K-Beauty Global Outreach (Autumn Batch)",
          status: "COMPLETED",
          language: "ko",
          createdAt: "2026-10-20T09:00:00Z",
        },
      ],
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load campaigns list" };
  }
}

/**
 * Fetches summary metrics for Tab A (Campaign Results).
 */
export async function getCampaignResultsSummaryAction(campaignId: string): Promise<{
  success: boolean;
  metrics?: CampaignSummaryMetrics | null;
  error?: string;
}> {
  try {
    await requireResultsAdmin();
    const metrics = await getCampaignResultsSummary(campaignId);
    return { success: true, metrics };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load campaign results summary" };
  }
}

/**
 * Fetches company results list for Tab B (Company Results).
 */
export async function listCompanyResultsAction(
  filter: CompanyResultsFilterCriteria = {}
): Promise<{
  success: boolean;
  results?: CompanyResultItem[];
  error?: string;
}> {
  try {
    await requireResultsAdmin();
    const results = await listCompanyResults(filter);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load company results" };
  }
}

/**
 * Updates company interest status manually.
 */
export async function updateCompanyInterestStatusAction(
  input: UpdateCompanyInterestInput
): Promise<{
  success: boolean;
  interestStatus?: CompanyInterestStatus;
  error?: string;
}> {
  try {
    const admin = await requireResultsAdmin();
    const res = await updateCompanyInterestStatus(input, admin.email);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update interest status" };
  }
}

/**
 * Updates company follow-up details (date, note, completed).
 */
export async function updateCompanyFollowupAction(
  input: UpdateCompanyFollowupInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const admin = await requireResultsAdmin();
    const res = await updateCompanyFollowup(input, admin.email);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update follow-up" };
  }
}

/**
 * Manually records a verified response from a prospect company.
 */
export async function recordVerifiedReplyAction(
  companyId: string,
  campaignId?: string,
  recipientId?: string,
  notes?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const admin = await requireResultsAdmin();
    const res = await recordVerifiedReply(companyId, campaignId, recipientId, notes, admin.email);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record verified reply" };
  }
}
