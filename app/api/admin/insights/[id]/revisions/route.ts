import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const { requested_by, comment, target_section, revision_number } = body;

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: "Comment is required for revision request" }, { status: 400 });
    }

    // 1. Insert revision request record
    const { data: revRequest, error: revError } = await supabase
      .from("insights_revision_requests")
      .insert({
        article_id: id,
        requested_by: requested_by || "Reviewer",
        comment: comment.trim(),
        target_section: target_section || "CORE",
        revision_number: revision_number || 1,
        resolution_status: "OPEN"
      })
      .select()
      .single();

    if (revError) {
      console.error("Error creating revision request:", revError);
      return NextResponse.json({ error: revError.message }, { status: 500 });
    }

    // 2. Update article status to REVISION_REQUESTED
    const { data: updatedArticle, error: artError } = await supabase
      .from("insights_articles")
      .update({
        status: "REVISION_REQUESTED",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (artError) {
      console.error("Error updating article status for revision:", artError);
    }

    // 3. Log snapshot to version history
    try {
      await supabase.from("insights_version_history").insert({
        article_id: id,
        version_number: (revision_number || 1) + 1,
        changed_by: requested_by || "Reviewer",
        change_type: "REVISION_REQUESTED",
        review_note: comment.trim(),
        snapshot: updatedArticle || {}
      });
    } catch (e) {
      console.warn("Version log error:", e);
    }

    return NextResponse.json({
      revisionRequest: revRequest,
      article: updatedArticle
    }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/insights/[id]/revisions exception:", err);
    return NextResponse.json({ error: err.message || "Failed to create revision request" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const { revision_id, resolution_status } = body;

    if (!revision_id || !resolution_status) {
      return NextResponse.json({ error: "revision_id and resolution_status are required" }, { status: 400 });
    }

    const { data: updatedRev, error } = await supabase
      .from("insights_revision_requests")
      .update({ resolution_status })
      .eq("id", revision_id)
      .eq("article_id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ revisionRequest: updatedRev });
  } catch (err: any) {
    console.error("PATCH /api/admin/insights/[id]/revisions exception:", err);
    return NextResponse.json({ error: err.message || "Failed to update revision request" }, { status: 500 });
  }
}
