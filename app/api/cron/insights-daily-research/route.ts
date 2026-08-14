import { NextResponse } from "next/server";
import { runAutoInsightEngine } from "@/lib/insights/auto-engine/engine-runner";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Returns current date and hour in America/New_York timezone
 */
function getNewYorkTimeInfo(): { nyDateStr: string; nyHour: number; nyTimeString: string } {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dateFormatter.formatToParts(now);
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  const nyDateStr = `${year}-${month}-${day}`;

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const nyHour = parseInt(hourFormatter.format(now), 10);

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const nyTimeString = timeFormatter.format(now);

  return { nyDateStr, nyHour, nyTimeString };
}

/**
 * Idempotency Check: Returns true if a SCHEDULED run has already executed today in New York
 */
async function hasRunTodayInNewYork(nyDateStr: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data: runs } = await supabase
      .from("insights_automation_runs")
      .select("id, run_mode, status")
      .eq("run_date", nyDateStr)
      .eq("run_mode", "SCHEDULED")
      .in("status", ["COMPLETED", "PARTIAL", "RUNNING", "SKIPPED_DUPLICATE"]);

    return (runs || []).length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * GET/POST /api/cron/insights-daily-research
 * DST-Safe Hourly Scheduled Cron endpoint triggered at 05:00 AM America/New_York
 */
export async function GET(request: Request) {
  return handleScheduledCron(request);
}

export async function POST(request: Request) {
  return handleScheduledCron(request);
}

async function handleScheduledCron(request: Request) {
  try {
    // 1. Cron Endpoint Security Check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: Invalid or missing CRON_SECRET" },
          { status: 401 }
        );
      }
    }

    // 2. DST-Safe Time Window Check (America/New_York)
    const { nyDateStr, nyHour, nyTimeString } = getNewYorkTimeInfo();

    // Read configured target time from Editorial Rules
    let targetHour = 5; // Default 05:00 AM ET
    const supabase = createAdminClient();
    try {
      const { data: rules } = await supabase
        .from("insights_editorial_rules")
        .select("daily_run_time")
        .eq("rule_key", "DEFAULT_MASTER_RULES")
        .maybeSingle();

      if (rules?.daily_run_time) {
        if (rules.daily_run_time.includes("05:00")) targetHour = 5;
        else if (rules.daily_run_time.includes("06:00")) targetHour = 6;
      }
    } catch (e) {}

    // Allow execution if caller bypasses hour check via query parameter `force=true`
    const url = new URL(request.url);
    const forceRun = url.searchParams.get("force") === "true";

    if (nyHour !== targetHour && !forceRun) {
      return NextResponse.json({
        success: true,
        status: "SKIPPED_TIME_WINDOW",
        message: `Current New York time is ${nyTimeString} (Hour: ${nyHour}). Daily research is scheduled for 05:00 AM ET.`,
        nyDateStr,
        nyHour,
      });
    }

    // 3. Idempotency Guard Check (1 Scheduled Run per New York Local Date)
    const alreadyExecutedToday = await hasRunTodayInNewYork(nyDateStr);
    if (alreadyExecutedToday && !forceRun) {
      // Record SKIPPED_DUPLICATE run entry in DB
      try {
        await supabase.from("insights_automation_runs").insert({
          run_date: nyDateStr,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          scheduled_time: "05:00 AM",
          timezone: "America/New_York",
          run_mode: "SCHEDULED",
          status: "SKIPPED_DUPLICATE",
          no_draft_reason: `Daily Scheduled Run already completed for New York date ${nyDateStr}. Idempotency guard activated.`,
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        status: "SKIPPED_DUPLICATE",
        message: `Daily Scheduled Run has already executed for New York date ${nyDateStr}. Zero new drafts created to prevent duplicate runs.`,
        nyDateStr,
      });
    }

    // 4. Execute Daily Auto Insight Engine
    const result = await runAutoInsightEngine({
      mode: "SCHEDULED",
      triggeredBy: `Vercel Cron (New York Time: ${nyTimeString})`,
    });

    return NextResponse.json({
      success: true,
      data: result,
      nyDateStr,
      nyTimeString,
      message: `Daily Scheduled Auto Insight Engine executed successfully at 05:00 AM ET (${nyDateStr}). Generated ${result.uniqueCoreDrafts} Unique Core Drafts in AI_DRAFT status.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Daily Cron execution failed" },
      { status: 500 }
    );
  }
}
