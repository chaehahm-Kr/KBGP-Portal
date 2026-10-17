"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSalesOverviewData, type SalesOverviewQueryOptions } from "./overview-service";
import type { SalesOverviewDashboardData } from "./types";

export interface SalesOverviewActionResponse {
  success: boolean;
  data?: SalesOverviewDashboardData;
  error?: string;
  benchmarkMs?: number;
}

/**
 * Server action to fetch Sales Overview V1.0 executive metrics.
 * Strictly protected by verifyAdminSession() check.
 */
export async function fetchSalesOverviewAction(
  options: Omit<SalesOverviewQueryOptions, "client"> = {}
): Promise<SalesOverviewActionResponse> {
  try {
    await verifyAdminSession();
    const admin = createAdminClient();

    const result = await getSalesOverviewData({
      ...options,
      client: admin,
    });

    return result;
  } catch (err: any) {
    console.error("[fetchSalesOverviewAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Failed to load Sales Overview metrics.",
    };
  }
}
