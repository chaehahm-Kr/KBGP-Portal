import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: runs, error } = await supabase
      .from("insights_automation_runs")
      .select("*")
      .order("started_at", { ascending: false });

    if (error) {
      console.warn("Automation runs fetch warning:", error);
      return NextResponse.json({ runs: [] });
    }

    return NextResponse.json({ runs: runs || [] });
  } catch (err: any) {
    console.error("GET /api/admin/insights/automation-runs exception:", err);
    return NextResponse.json({ runs: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const payload = {
      run_date: body.run_date || new Date().toISOString().split("T")[0],
      started_at: body.started_at || new Date().toISOString(),
      completed_at: body.completed_at || new Date().toISOString(),
      sources_scanned: body.sources_scanned || 12,
      candidates_found: body.candidates_found || 5,
      candidates_rejected: body.candidates_rejected || 1,
      network_drafts_created: body.network_drafts_created || 2,
      hub_drafts_created: body.hub_drafts_created || 2,
      shared_drafts_created: body.shared_drafts_created || 2,
      errors: body.errors || [],
      status: body.status || "COMPLETED"
    };

    const { data: run, error } = await supabase
      .from("insights_automation_runs")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ run }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/insights/automation-runs exception:", err);
    return NextResponse.json({ error: err.message || "Failed to record run" }, { status: 500 });
  }
}
