import { NextRequest, NextResponse } from "next/server";
import {
  createNewDraftVersion,
  publishDraftVersion,
  rollbackToHistoricalVersion
} from "@/lib/knowledge/versioning";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action || "CREATE_DRAFT";

    const user = {
      id: body.user_id || "admin-01",
      name: body.user_name || "Knowledge Operator"
    };

    if (action === "CREATE_DRAFT") {
      const result = await createNewDraftVersion(id, user, {
        whatChanged: body.what_changed || "New revision draft initialized",
        whyChanged: body.why_changed || "Regular policy & content update cycle"
      });
      return NextResponse.json(result);
    }

    if (action === "PUBLISH") {
      const versionStr = body.version || "v1.1";
      const item = await publishDraftVersion(id, user, versionStr);
      return NextResponse.json({ item });
    }

    if (action === "ROLLBACK") {
      const targetVersionId = body.target_version_id;
      if (!targetVersionId) {
        return NextResponse.json({ error: "target_version_id required for rollback" }, { status: 400 });
      }
      const result = await rollbackToHistoricalVersion(id, targetVersionId, user);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid versioning action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/admin/knowledge/[id]/versions error:", err);
    return NextResponse.json({ error: err.message || "Failed to process version action" }, { status: 500 });
  }
}
