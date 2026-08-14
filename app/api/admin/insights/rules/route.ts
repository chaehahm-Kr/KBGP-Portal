import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_RULES = {
  daily_run_time: "05:00 AM",
  timezone: "America/New_York",
  minimum_topic_score: 80,
  network_daily_draft_max: 3,
  hub_daily_draft_max: 3,
  topic_score_weights: {
    relevance: 25,
    actionability: 25,
    evidence_strength: 20,
    timeliness: 15,
    originality: 10,
    strategic_fit: 5
  },
  human_approval_required: true,
  auto_publish: false,
  auto_visual_preparation: true,
  auto_translation: true,
  source_validation_required: true,
  duplicate_check_required: true
};

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: rules, error } = await supabase
      .from("insights_editorial_rules")
      .select("*")
      .eq("rule_key", "DEFAULT_MASTER_RULES")
      .maybeSingle();

    if (error || !rules) {
      return NextResponse.json({ rules: DEFAULT_RULES });
    }

    return NextResponse.json({ rules });
  } catch (err: any) {
    console.error("GET /api/admin/insights/rules exception:", err);
    return NextResponse.json({ rules: DEFAULT_RULES });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const payload = {
      rule_key: "DEFAULT_MASTER_RULES",
      daily_run_time: body.daily_run_time || "05:00 AM",
      timezone: body.timezone || "America/New_York",
      minimum_topic_score: Number(body.minimum_topic_score) || 80,
      network_daily_draft_max: Number(body.network_daily_draft_max) || 3,
      hub_daily_draft_max: Number(body.hub_daily_draft_max) || 3,
      topic_score_weights: body.topic_score_weights || DEFAULT_RULES.topic_score_weights,
      human_approval_required: body.human_approval_required !== false,
      auto_publish: body.auto_publish === true,
      auto_visual_preparation: body.auto_visual_preparation !== false,
      auto_translation: body.auto_translation !== false,
      source_validation_required: body.source_validation_required !== false,
      duplicate_check_required: body.duplicate_check_required !== false,
      updated_at: new Date().toISOString(),
      updated_by: body.updated_by || "Admin"
    };

    const { data: updatedRules, error } = await supabase
      .from("insights_editorial_rules")
      .upsert(payload, { onConflict: "rule_key" })
      .select()
      .single();

    if (error) {
      console.error("Error updating editorial rules:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: updatedRules });
  } catch (err: any) {
    console.error("PUT /api/admin/insights/rules exception:", err);
    return NextResponse.json({ error: err.message || "Failed to update rules" }, { status: 500 });
  }
}
