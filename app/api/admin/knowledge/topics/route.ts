import { NextRequest, NextResponse } from "next/server";
import {
  getStoreTopics,
  createStoreTopic,
  updateStoreTopic,
  deleteStoreTopic,
  reorderStoreTopics,
  getStoreTopicById
} from "@/lib/knowledge/store";
import { PortalScope } from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portalScope = (searchParams.get("portal_scope") as PortalScope) || undefined;
    const includeInactive = searchParams.get("include_inactive") !== "false";

    const topics = await getStoreTopics(portalScope, includeInactive);
    return NextResponse.json({ success: true, count: topics.length, topics });
  } catch (error: any) {
    console.error("GET /api/admin/knowledge/topics error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch topics" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portal_scope, name_ko, name_en, short_desc_ko, short_desc_en, description_ko, description_en, icon, display_order, is_active, match_modules, match_keywords } = body;

    if (!name_ko) {
      return NextResponse.json({ error: "name_ko is required" }, { status: 400 });
    }

    const topic = await createStoreTopic({
      portal_scope: portal_scope || "BRAND",
      name_ko,
      name_en,
      short_desc_ko,
      short_desc_en,
      description_ko,
      description_en,
      icon: icon || "📁",
      display_order: typeof display_order === "number" ? display_order : undefined,
      is_active: is_active ?? true,
      match_modules: Array.isArray(match_modules) ? match_modules : [],
      match_keywords: Array.isArray(match_keywords) ? match_keywords : []
    });

    return NextResponse.json({ success: true, topic });
  } catch (error: any) {
    console.error("POST /api/admin/knowledge/topics error:", error);
    return NextResponse.json({ error: error.message || "Failed to create topic" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, portal_scope, ordered_ids, updates } = body;

    if (action === "REORDER") {
      if (!portal_scope || !Array.isArray(ordered_ids)) {
        return NextResponse.json({ error: "portal_scope and ordered_ids array required" }, { status: 400 });
      }
      const topics = await reorderStoreTopics(portal_scope, ordered_ids);
      return NextResponse.json({ success: true, topics });
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const topic = await updateStoreTopic(id, updates || {});
    if (!topic) {
      return NextResponse.json({ error: `Topic '${id}' not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, topic });
  } catch (error: any) {
    console.error("PATCH /api/admin/knowledge/topics error:", error);
    return NextResponse.json({ error: error.message || "Failed to update topic" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteStoreTopic(id);
    return NextResponse.json({ success: true, message: `Topic ${id} deleted` });
  } catch (error: any) {
    console.error("DELETE /api/admin/knowledge/topics error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete topic" }, { status: 500 });
  }
}
