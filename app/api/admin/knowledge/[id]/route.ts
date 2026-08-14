import { NextRequest, NextResponse } from "next/server";
import {
  getStoreKnowledgeById,
  saveStoreKnowledgeItem,
  getStoreVersions,
  getStoreRelations,
  getStoreAssets,
  getStoreAuditLogs,
  saveStoreRelation,
  saveStoreAsset
} from "@/lib/knowledge/store";
import { logKnowledgeActivity } from "@/lib/knowledge/audit";
import { KnowledgeItem, KnowledgeRelation, ManualAsset } from "@/lib/knowledge/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await getStoreKnowledgeById(id);

    if (!item) {
      return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
    }

    const versions = await getStoreVersions(item.id);
    const relations = await getStoreRelations(item.id);
    const assets = await getStoreAssets(item.id);
    const auditLogs = await getStoreAuditLogs(item.id);

    return NextResponse.json({
      item,
      versions,
      relations,
      assets,
      auditLogs
    });
  } catch (err: any) {
    console.error("GET /api/admin/knowledge/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch detail" }, { status: 500 });
  }
}

export async function PATCH(
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
    const now = new Date().toISOString();
    const prevItem = { ...item };

    // Check if audience is changing to external
    const newAudience = body.audience || item.audience;
    const hasExternalAudience = newAudience.some((a: string) =>
      ["BRAND", "RETAILER", "PUBLIC"].includes(a)
    );

    let requires_external_approval = item.requires_external_approval;
    let external_review_status = item.external_review_status;

    if (hasExternalAudience && !item.requires_external_approval) {
      requires_external_approval = true;
      external_review_status = "REQUESTED";
    }

    const updatedItem: KnowledgeItem = {
      ...item,
      title: body.title !== undefined ? body.title : item.title,
      title_ko: body.title_ko !== undefined ? body.title_ko : item.title_ko,
      title_en: body.title_en !== undefined ? body.title_en : item.title_en,
      summary_ko: body.summary_ko !== undefined ? body.summary_ko : item.summary_ko,
      summary_en: body.summary_en !== undefined ? body.summary_en : item.summary_en,
      content_ko: body.content_ko !== undefined ? body.content_ko : item.content_ko,
      content_en: body.content_en !== undefined ? body.content_en : item.content_en,
      type: body.type !== undefined ? body.type : item.type,
      source_type: body.source_type !== undefined ? body.source_type : item.source_type,
      linked_system_setting_key: body.linked_system_setting_key !== undefined ? body.linked_system_setting_key : item.linked_system_setting_key,
      linked_system_setting_name: body.linked_system_setting_name !== undefined ? body.linked_system_setting_name : item.linked_system_setting_name,
      linked_system_setting_value: body.linked_system_setting_value !== undefined ? body.linked_system_setting_value : item.linked_system_setting_value,
      category: body.category !== undefined ? body.category : item.category,
      tags: body.tags !== undefined ? body.tags : item.tags,
      status: body.status !== undefined ? body.status : item.status,
      audience: newAudience,
      is_sensitive_internal: body.is_sensitive_internal !== undefined ? Boolean(body.is_sensitive_internal) : item.is_sensitive_internal,
      requires_external_approval,
      external_review_status,
      updated_at: now
    };

    await saveStoreKnowledgeItem(updatedItem);

    // Save relation if provided
    if (body.relation) {
      const rel: KnowledgeRelation = {
        id: `rel-${Date.now()}`,
        knowledge_id: item.id,
        related_portal: body.relation.related_portal || "Admin",
        related_module: body.relation.related_module || item.category,
        related_menu: body.relation.related_menu || null,
        related_route: body.relation.related_route || null,
        related_system_setting: body.relation.related_system_setting || null,
        manual_title: body.relation.manual_title || null,
        faq_question: body.relation.faq_question || null,
        created_at: now
      };
      await saveStoreRelation(rel);
    }

    // Save PDF manual asset if provided
    if (body.manual_asset) {
      const asset: ManualAsset = {
        id: `asset-${Date.now()}`,
        knowledge_id: item.id,
        manual_title: body.manual_asset.manual_title || item.title,
        version: item.current_version,
        language: body.manual_asset.language || "KO",
        is_current: true,
        file_url: body.manual_asset.file_url || "/manuals/sample.pdf",
        file_name: body.manual_asset.file_name || "sample.pdf",
        file_size: body.manual_asset.file_size || 1024000,
        published_date: now.split("T")[0],
        created_at: now
      };
      await saveStoreAsset(asset);
    }

    // Audit log
    await logKnowledgeActivity(
      item.id,
      { name: body.user_name || "Knowledge Operator" },
      "Edited",
      { audience: prevItem.audience, status: prevItem.status, sensitive: prevItem.is_sensitive_internal },
      { audience: updatedItem.audience, status: updatedItem.status, sensitive: updatedItem.is_sensitive_internal },
      body.update_reason || "Knowledge content updated"
    );

    return NextResponse.json({ item: updatedItem });
  } catch (err: any) {
    console.error("PATCH /api/admin/knowledge/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await getStoreKnowledgeById(id);

    if (!item) {
      return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const archivedItem: KnowledgeItem = {
      ...item,
      status: "ARCHIVED",
      updated_at: now
    };

    await saveStoreKnowledgeItem(archivedItem);

    await logKnowledgeActivity(
      item.id,
      { name: "Knowledge Admin" },
      "Archived",
      { status: item.status },
      { status: "ARCHIVED" },
      "Knowledge record archived from active governance"
    );

    return NextResponse.json({ item: archivedItem });
  } catch (err: any) {
    console.error("DELETE /api/admin/knowledge/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to archive item" }, { status: 500 });
  }
}
