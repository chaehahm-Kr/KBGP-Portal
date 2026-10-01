import { KnowledgeItem, KnowledgeVersion } from "./types";
import {
  getStoreKnowledgeById,
  saveStoreKnowledgeItem,
  getStoreVersions,
  saveStoreVersion,
  addStoreAuditLog,
  resolveKnowledgeImpact
} from "./store";

export interface PublishValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates mandatory governance requirements before publishing a Knowledge Item or Version.
 * Section 3 Requirements:
 * - Title exists
 * - Knowledge Type exists
 * - Audience contains at least 1 audience (INTERNAL, BRAND, RETAIL)
 * - Module exists
 * - Version exists
 * - Content OR Official Document exists
 */
export function validateKnowledgeForPublish(item: Partial<KnowledgeItem>): PublishValidationResult {
  const errors: string[] = [];

  const title = item.title?.trim() || item.title_ko?.trim() || item.title_en?.trim();
  if (!title) {
    errors.push("문서 제목(Title)이 입력되지 않았습니다.");
  }

  if (!item.type) {
    errors.push("문서 유형(Knowledge Type)이 지정되지 않았습니다.");
  }

  if (!item.audience || item.audience.length === 0) {
    errors.push("배포 대상(Audience: INTERNAL, BRAND, RETAIL 등)이 최소 1개 이상 지정되어야 합니다.");
  }

  const mod = item.module?.trim() || item.category?.trim();
  if (!mod) {
    errors.push("소속 모듈(Module / Category)이 지정되지 않았습니다.");
  }

  const ver = item.current_version?.trim();
  if (!ver) {
    errors.push("버전 정보(Version, 예: v1.0, v1.1)가 지정되지 않았습니다.");
  }

  const hasContent = Boolean(
    (item.content_ko && item.content_ko.trim().length > 0) ||
    (item.content_en && item.content_en.trim().length > 0) ||
    (item.document_url && item.document_url.trim().length > 0)
  );

  if (!hasContent) {
    errors.push("본문 내용(Content) 또는 공식 배포 문서(PDF)가 최소 1개 이상 등록되어야 합니다.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a new Draft version from a currently Published Knowledge Item.
 * IMPORTANT: The main Knowledge Item remains PUBLISHED with its current version as the active
 * official source of truth while the new draft version is being prepared.
 */
export async function createNewDraftVersion(
  knowledgeId: string,
  user: { id: string; name: string },
  changeNotes: { whatChanged: string; whyChanged: string; version?: string }
): Promise<{ item: KnowledgeItem; version: KnowledgeVersion }> {
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) {
    throw new Error("Knowledge item not found");
  }

  let newVerStr = changeNotes.version?.trim();
  if (!newVerStr) {
    const currentVerStr = (item.current_version || "v1.0").replace(/^v/, "").replace(/\s*\(Draft\)$/i, "");
    const parts = currentVerStr.split(".");
    const major = parseInt(parts[0] || "1", 10);
    const minor = parseInt(parts[1] || "0", 10) + 1;
    newVerStr = `v${major}.${minor}`;
  }
  if (!newVerStr.startsWith("v")) {
    newVerStr = `v${newVerStr}`;
  }

  // Check for duplicate versions
  const existingVersions = await getStoreVersions(knowledgeId);
  if (existingVersions.some(v => v.version === newVerStr && v.status === "PUBLISHED")) {
    throw new Error(`버전 ${newVerStr}은(는) 이미 배포된 버전 번호입니다. 다른 버전 번호를 지정해 주세요.`);
  }

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  const versionRecord: KnowledgeVersion = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    knowledge_id: item.id,
    version: newVerStr,
    status: "DRAFT",
    title_ko: item.title_ko || item.title,
    title_en: item.title_en || item.title,
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

  await addStoreAuditLog({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: item.id,
    user_id: user.id,
    user_name: user.name,
    action: "VERSION_CREATED",
    previous_value: { current_version: item.current_version, status: item.status },
    new_value: { draft_version: newVerStr, status: "DRAFT" },
    reason: `새 개정 초안(${newVerStr}) 생성: ${changeNotes.whyChanged}`,
    created_at: now
  });

  return { item, version: versionRecord };
}

/**
 * Publishes a Draft version, establishing it as the Current Official Source of Truth.
 * 1. Validates all mandatory fields.
 * 2. Marks previous PUBLISHED versions as SUPERSEDED (preserving historical records).
 * 3. Sets target version status to PUBLISHED.
 * 4. Updates Knowledge Item status to PUBLISHED, current_version to new version.
 * 5. Automatically resolves any active UPDATE_REQUIRED impact status to NORMAL.
 * 6. Records full audit logging.
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

  const cleanVerStr = newVersionStr.trim().replace(/\s*\(Draft\)$/i, "");

  // Section 3: Mandatory Validation check
  const validation = validateKnowledgeForPublish({
    ...item,
    current_version: cleanVerStr
  });

  if (!validation.valid) {
    throw new Error(`배포 요건 검증 실패:\n- ${validation.errors.join("\n- ")}`);
  }

  const now = new Date().toISOString();
  const versions = await getStoreVersions(knowledgeId);

  // Preserve history: Mark all previously PUBLISHED versions as SUPERSEDED (never delete/overwrite)
  for (const ver of versions) {
    if (ver.status === "PUBLISHED" && ver.version !== cleanVerStr) {
      ver.status = "SUPERSEDED";
      await saveStoreVersion(ver);
    }
  }

  // Find or create the target version snapshot
  let targetVer = versions.find(v => v.version === cleanVerStr);
  if (targetVer) {
    targetVer.status = "PUBLISHED";
    targetVer.published_at = now;
    targetVer.approver_id = user.id;
    await saveStoreVersion(targetVer);
  } else {
    // Create new version snapshot if directly publishing
    targetVer = {
      id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      knowledge_id: item.id,
      version: cleanVerStr,
      status: "PUBLISHED",
      title_ko: item.title_ko || item.title,
      title_en: item.title_en || item.title,
      summary_ko: item.summary_ko,
      summary_en: item.summary_en,
      content_ko: item.content_ko,
      content_en: item.content_en,
      what_changed: `공식 배포 (${cleanVerStr})`,
      why_changed: "공식 Source of Truth 배포 승인",
      effective_date: now.split("T")[0],
      created_by_id: user.id,
      created_by_name: user.name,
      published_at: now,
      created_at: now
    };
    await saveStoreVersion(targetVer);
  }

  const wasImpacted = item.system_impact_status === "UPDATE_REQUIRED" || item.system_impact_status === "POTENTIALLY_OUTDATED";

  const publishedItem: KnowledgeItem = {
    ...item,
    current_version: cleanVerStr,
    status: "PUBLISHED",
    system_impact_status: "NORMAL",
    system_impact_reason: null,
    system_impact_updated_at: wasImpacted ? now : item.system_impact_updated_at,
    updated_at: now
  };

  await saveStoreKnowledgeItem(publishedItem);

  // If item had active UPDATE_REQUIRED, resolve it and record resolution
  if (wasImpacted) {
    await resolveKnowledgeImpact(knowledgeId, {
      resolvedBy: user.name,
      action: "VERSION_CREATED",
      reason: `New Version ${cleanVerStr} published. System impact resolved.`
    });
  }

  await addStoreAuditLog({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: item.id,
    user_id: user.id,
    user_name: user.name,
    action: "VERSION_PUBLISHED",
    previous_value: {
      status: item.status,
      version: item.current_version,
      system_impact_status: item.system_impact_status
    },
    new_value: {
      status: "PUBLISHED",
      version: cleanVerStr,
      system_impact_status: "NORMAL",
      audience: publishedItem.audience
    },
    reason: wasImpacted
      ? `새 버전(${cleanVerStr}) 배포 완료 및 시스템 변경 영향(UPDATE REQUIRED) 해소`
      : `공식 버전(${cleanVerStr}) 배포 완료`,
    created_at: now
  });

  // Source Version Governance: Trigger review for linked FAQs (Section 17 & 18)
  try {
    const { triggerSourceVersionFaqImpact } = await import("./faq-engine");
    await triggerSourceVersionFaqImpact(knowledgeId, cleanVerStr, user.name);
  } catch (e) {}

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
