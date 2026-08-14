import { KnowledgeItem, KnowledgeVersion } from "./types";
import {
  getStoreKnowledgeById,
  saveStoreKnowledgeItem,
  getStoreVersions,
  saveStoreVersion,
  addStoreAuditLog
} from "./store";

/**
 * Creates a new Draft version from a currently Published Knowledge Item.
 * Example: v1.2 Current/Published -> Creates v1.3 Draft
 */
export async function createNewDraftVersion(
  knowledgeId: string,
  user: { id: string; name: string },
  changeNotes: { whatChanged: string; whyChanged: string }
): Promise<{ item: KnowledgeItem; version: KnowledgeVersion }> {
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) {
    throw new Error("Knowledge item not found");
  }

  // Parse version e.g. v1.2 -> v1.3
  const currentVerStr = item.current_version.replace(/^v/, "");
  const parts = currentVerStr.split(".");
  const major = parseInt(parts[0] || "1", 10);
  const minor = parseInt(parts[1] || "0", 10) + 1;
  const newVerStr = `v${major}.${minor}`;

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  const versionRecord: KnowledgeVersion = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    knowledge_id: item.id,
    version: newVerStr,
    status: "DRAFT",
    title_ko: item.title_ko,
    title_en: item.title_en,
    summary_ko: item.summary_ko,
    summary_en: item.summary_en,
    content_ko: item.content_ko,
    content_en: item.content_en,
    what_changed: changeNotes.whatChanged,
    why_changed: changeNotes.whyChanged,
    effective_date: today,
    created_by_id: user.id,
    created_by_name: user.name,
    created_at: now
  };

  await saveStoreVersion(versionRecord);

  // Update item to DRAFT with new version tag
  const updatedItem: KnowledgeItem = {
    ...item,
    current_version: `${newVerStr} (Draft)`,
    status: "DRAFT",
    updated_at: now
  };

  await saveStoreKnowledgeItem(updatedItem);

  await addStoreAuditLog({
    id: `log-${Date.now()}`,
    knowledge_id: item.id,
    user_id: user.id,
    user_name: user.name,
    action: "Version Created",
    previous_value: { version: item.current_version, status: item.status },
    new_value: { version: newVerStr, status: "DRAFT" },
    reason: changeNotes.whyChanged,
    created_at: now
  });

  return { item: updatedItem, version: versionRecord };
}

/**
 * Publishes a Draft version, automatically marking the previous current version as SUPERSEDED.
 */
export async function publishDraftVersion(
  knowledgeId: string,
  user: { id: string; name: string },
  newVersionStr: string
): Promise<KnowledgeItem> {
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) {
    throw new Error("Knowledge item not found");
  }

  const now = new Date().toISOString();
  const versions = await getStoreVersions(knowledgeId);

  // Mark all existing PUBLISHED versions for this knowledge item as SUPERSEDED
  for (const ver of versions) {
    if (ver.status === "PUBLISHED") {
      ver.status = "SUPERSEDED";
      await saveStoreVersion(ver);
    }
  }

  const cleanVerStr = newVersionStr.replace(/\s*\(Draft\)$/i, "");

  // Find or create version snapshot
  const targetVer = versions.find(v => v.version === cleanVerStr);
  if (targetVer) {
    targetVer.status = "PUBLISHED";
    targetVer.published_at = now;
    targetVer.approver_id = user.id;
    await saveStoreVersion(targetVer);
  }

  const publishedItem: KnowledgeItem = {
    ...item,
    current_version: cleanVerStr,
    status: "PUBLISHED",
    updated_at: now
  };

  await saveStoreKnowledgeItem(publishedItem);

  await addStoreAuditLog({
    id: `log-${Date.now()}`,
    knowledge_id: item.id,
    user_id: user.id,
    user_name: user.name,
    action: "Published",
    previous_value: { status: item.status, version: item.current_version },
    new_value: { status: "PUBLISHED", version: cleanVerStr },
    reason: "New version published. Previous version marked as SUPERSEDED.",
    created_at: now
  });

  return publishedItem;
}

/**
 * Rollback helper: Creates a new DRAFT version initialized with historical content instead of mutating history.
 */
export async function rollbackToHistoricalVersion(
  knowledgeId: string,
  targetVersionId: string,
  user: { id: string; name: string }
): Promise<{ item: KnowledgeItem; version: KnowledgeVersion }> {
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) throw new Error("Knowledge item not found");

  const versions = await getStoreVersions(knowledgeId);
  const targetVer = versions.find(v => v.id === targetVersionId || v.version === targetVersionId);

  if (!targetVer) throw new Error("Target version snapshot not found");

  // Create new Draft version based on target historical version
  const result = await createNewDraftVersion(
    knowledgeId,
    user,
    {
      whatChanged: `Rollback restored content from historical version ${targetVer.version}`,
      whyChanged: `Restoration of previous approved policy baseline (${targetVer.version})`
    }
  );

  // Apply historical content to the newly created draft item
  const restoredItem: KnowledgeItem = {
    ...result.item,
    title_ko: targetVer.title_ko,
    title_en: targetVer.title_en,
    summary_ko: targetVer.summary_ko,
    summary_en: targetVer.summary_en,
    content_ko: targetVer.content_ko,
    content_en: targetVer.content_en,
    updated_at: new Date().toISOString()
  };

  await saveStoreKnowledgeItem(restoredItem);

  return { item: restoredItem, version: result.version };
}
