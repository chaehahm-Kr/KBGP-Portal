import { NextResponse } from "next/server";
import { runAutoInsightEngine } from "@/lib/insights/auto-engine/engine-runner";

/**
 * POST /api/admin/insights/automation-runs/execute
 * Triggers Manual Run (mode: "MANUAL") or Test Run (mode: "DRY_RUN")
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "DRY_RUN" ? "DRY_RUN" : "MANUAL";
    const triggeredBy = body.triggeredBy || "Admin User";

    const result = await runAutoInsightEngine({
      mode,
      triggeredBy,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: mode === "DRY_RUN"
        ? `Dry Run Completed successfully. Scanned ${result.sourcesScanned} sources, scored ${result.candidatesScored} candidates (${result.candidatesGte80} passed >=80 pts). No articles created.`
        : `Manual Research Run Completed. Generated ${result.uniqueCoreDrafts} Unique Core Insight Drafts in AI_DRAFT status.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Execution error" },
      { status: 500 }
    );
  }
}
