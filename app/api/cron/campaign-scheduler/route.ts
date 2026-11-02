export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { processScheduledCampaigns } from "@/lib/brand-marketing/campaign-data-access";

/**
 * Campaign Delivery Background Scheduler Cron
 * Standard: DEPLOY-STD-001, Task ID: ADM-EMAIL-APP-002
 * Triggered periodically by Vercel Cron or on-demand worker.
 * Idempotently evaluates scheduled campaigns and processes delivery under LIVE_MODE: FALSE.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = serverEnv.CRON_SECRET ? `Bearer ${serverEnv.CRON_SECRET}` : null;

  if (expected) {
    if (authHeader !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  try {
    const summary = await processScheduledCampaigns();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount: summary.processedCount,
      results: summary.results,
    });
  } catch (err: any) {
    console.error("[cron:campaign-scheduler] Error processing scheduled campaigns:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
