import { NextRequest, NextResponse } from "next/server";
import {
  getStoreKnowledgeById,
  saveStoreKnowledgeItem,
  getStoreVersions,
  getStoreRelations,
  getStoreAssets,
  getStoreAuditLogs,
  saveStoreRelation,
  saveStoreAsset,
  addStoreAuditLog,
  resolveKnowledgeImpact
} from "@/lib/knowledge/store";
import { publishDraftVersion, validateKnowledgeForPublish } from "@/lib/knowledge/versioning";
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
    const userName = body.user_name || "Knowledge Admin";
    const userId = body.user_id || "usr-admin-system";

    // 1. Direct Publish Action (ADM-KNW-002)
    if (body.action === "PUBLISH" || body.action === "publish") {
      const versionStr = body.version || item.current_version || "v1.0";
      const publishedItem = await publishDraftVersion(
        item.id,
        { id: userId, name: userName },
        versionStr
      );
      return NextResponse.json({
        success: true,
        item: publishedItem,
        message: `Version ${versionStr} published successfully.`
      });
    }

    // 2. Governance: Review - No Update Needed (Section 12)
    if (body.action === "resolve_impact" || body.action === "no_update_needed" || body.action === "mark_reviewed") {
      if (!body.reason || !body.reason.trim()) {
        return NextResponse.json(
          { error: "검토 사유(Reason)를 입력해야 정상화(No Update Needed) 처리가 가능합니다." },
          { status: 400 }
        );
      }
      const resolvedItem = await resolveKnowledgeImpact(item.id, {
        resolvedBy: userName,
        reason: body.reason,
        action: "NO_UPDATE_REQUIRED"
      });

      await addStoreAuditLog({
        id: `log-rev-no-${Date.now()}`,
        knowledge_id: item.id,
        user_id: userId,
        user_name: userName,
        action: "IMPACT_REVIEWED_NO_UPDATE_NEEDED",
        previous_value: { system_impact_status: "UPDATE_REQUIRED" },
        new_value: { system_impact_status: "NORMAL" },
        reason: body.reason,
        created_at: now
      });

      return NextResponse.json({
        item: resolvedItem,
        success: true,
        message: "Impact marked as reviewed (No Update Needed). Status restored to NORMAL."
      });
    }

    // 3. Governance: Review - Update Required (Section 12)
    if (body.action === "update_required") {
      await addStoreAuditLog({
        id: `log-rev-upd-${Date.now()}`,
        knowledge_id: item.id,
        user_id: userId,
        user_name: userName,
        action: "IMPACT_REVIEWED_UPDATE_REQUIRED",
        previous_value: { system_impact_status: item.system_impact_status },
        new_value: { system_impact_status: "UPDATE_REQUIRED" },
        reason: body.reason || "Admin confirmed that manual update is required following system change.",
        created_at: now
      });
      return NextResponse.json({
        item,
        success: true,
        message: "Impact reviewed: manual update confirmed."
      });
    }

    // 4. General Item Update / Audience Update
    const prevItem = { ...item };
    const newAudience = body.audience !== undefined ? body.audience : item.audience;
    const isAudienceChanged = JSON.stringify(prevItem.audience) !== JSON.stringify(newAudience);

    const hasExternalAudience = (newAudience || []).some((a: string) =>
      ["BRAND", "RETAILER", "PUBLIC"].includes(a)
    );

    let requires_external_approval = item.requires_external_approval;
    let external_review_status = item.external_review_status;

    if (hasExternalAudience && !item.requires_external_approval) {
      requires_external_approval = true;
      external_review_status = "REQUESTED";
    }

    const updatedModule = body.module !== undefined
      ? body.module
      : (body.category !== undefined ? body.category : (item.module || item.category || "General"));

    const updatedItem: KnowledgeItem = {
      ...item,
      system_impact_status: body.system_impact_status !== undefined ? body.system_impact_status : item.system_impact_status,
      system_impact_reason: body.system_impact_reason !== undefined ? body.system_impact_reason : item.system_impact_reason,
      system_impact_updated_at: body.system_impact_status !== undefined ? now : item.system_impact_updated_at,
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
      module: updatedModule,
      category: updatedModule,
      tags: body.tags !== undefined ? body.tags : item.tags,
      status: body.status !== undefined ? body.status : item.status,
      audience: newAudience,
      is_sensitive_internal: body.is_sensitive_internal !== undefined ? Boolean(body.is_sensitive_internal) : item.is_sensitive_internal,
      requires_external_approval,
      external_review_status,
      document_url: body.document_url !== undefined ? body.document_url : item.document_url,
      document_name: body.document_name !== undefined ? body.document_name : item.document_name,
      document_size: body.document_size !== undefined ? body.document_size : item.document_size,
      document_type: body.document_type !== undefined ? body.document_type : item.document_type,
      updated_at: now
    };

    await saveStoreKnowledgeItem(updatedItem);

    // Record Audience Audit Log if audience changed
    if (isAudienceChanged) {
      await addStoreAuditLog({
        id: `log-aud-${Date.now()}`,
        knowledge_id: item.id,
        user_id: userId,
        user_name: userName,
        action: "AUDIENCE_UPDATED",
        previous_value: { audience: prevItem.audience },
        new_value: { audience: updatedItem.audience },
        reason: body.update_reason || "Distribution audience updated by admin",
        created_at: now
      });
    } else {
      await addStoreAuditLog({
        id: `log-edit-${Date.now()}`,
        knowledge_id: item.id,
        user_id: userId,
        user_name: userName,
        action: "KNOWLEDGE_EDITED",
        previous_value: { status: prevItem.status, module: prevItem.module },
        new_value: { status: updatedItem.status, module: updatedItem.module },
        reason: body.update_reason || "Knowledge content updated",
        created_at: now
      });
    }

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

    await addStoreAuditLog({
      id: `log-arch-${Date.now()}`,
      knowledge_id: item.id,
      user_id: "usr-admin-system",
      user_name: "Knowledge Admin",
      action: "KNOWLEDGE_ARCHIVED",
      previous_value: { status: item.status },
      new_value: { status: "ARCHIVED" },
      reason: "Knowledge record archived from active governance",
      created_at: now
    });

    return NextResponse.json({ item: archivedItem });
  } catch (err: any) {
    console.error("DELETE /api/admin/knowledge/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to archive item" }, { status: 500 });
  }
}
