import { NextRequest, NextResponse } from "next/server";
import { getStoreKnowledgeById, saveStoreKnowledgeItem } from "@/lib/knowledge/store";
import { logKnowledgeActivity } from "@/lib/knowledge/audit";
import { KnowledgeItem } from "@/lib/knowledge/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await getStoreKnowledgeById(id);

    if (!item) {
      return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
    }

    const body = await request.json();
    const action = body.action || "APPROVE"; // APPROVE or REJECT
    const now = new Date().toISOString();

    const approverName = body.approver_name || "Super Admin";

    if (action === "APPROVE") {
      const cleanVerStr = item.current_version.replace(/\s*\(Draft\)$/i, "");
      const updatedItem: KnowledgeItem = {
        ...item,
        status: "PUBLISHED",
        external_review_status: "APPROVED",
        external_reviewer_id: body.approver_id || "staff-superadmin-01",
        external_reviewed_at: now,
        current_version: cleanVerStr,
        updated_at: now
      };

      await saveStoreKnowledgeItem(updatedItem);

      await logKnowledgeActivity(
        item.id,
        { name: approverName },
        "Approved & Published External Knowledge",
        { external_status: item.external_review_status, status: item.status },
        { external_status: "APPROVED", status: "PUBLISHED" },
        body.comment || "External publication review approved by authorized approver."
      );

      return NextResponse.json({ item: updatedItem });
    } else {
      const updatedItem: KnowledgeItem = {
        ...item,
        external_review_status: "REJECTED",
        status: "DRAFT",
        updated_at: now
      };

      await saveStoreKnowledgeItem(updatedItem);

      await logKnowledgeActivity(
        item.id,
        { name: approverName },
        "External Publication Review Rejected",
        { external_status: item.external_review_status },
        { external_status: "REJECTED" },
        body.comment || "External publication review rejected."
      );

      return NextResponse.json({ item: updatedItem });
    }
  } catch (err: any) {
    console.error("POST /api/admin/knowledge/[id]/approve error:", err);
    return NextResponse.json({ error: err.message || "Failed to approve external publication" }, { status: 500 });
  }
}
