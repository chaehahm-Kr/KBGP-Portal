import { SystemImpactTrigger, KnowledgeItem } from "./types";
import {
  getStoreKnowledgeItems,
  saveStoreKnowledgeItem,
  addStoreTrigger,
  getStoreTriggers,
  addStoreAuditLog
} from "./store";

/**
 * Triggers a System Setting Change notification.
 * Flags linked Knowledge items as POTENTIALLY_OUTDATED for human review.
 */
export async function triggerSystemSettingChange(
  settingKey: string,
  settingName: string,
  oldValue: string,
  newValue: string
): Promise<{ affectedCount: number; trigger: SystemImpactTrigger }> {
  const now = new Date().toISOString();

  const triggerRecord: SystemImpactTrigger = {
    id: `trig-${Date.now()}`,
    setting_key: settingKey,
    setting_name: settingName,
    old_value: oldValue,
    new_value: newValue,
    status: "PENDING",
    created_at: now
  };

  await addStoreTrigger(triggerRecord);

  // Find all knowledge items linked to this system setting
  const allItems = await getStoreKnowledgeItems();
  let affectedCount = 0;

  for (const item of allItems) {
    if (
      item.linked_system_setting_key === settingKey ||
      item.linked_system_setting_name?.toLowerCase().includes(settingName.toLowerCase())
    ) {
      const updatedItem: KnowledgeItem = {
        ...item,
        system_impact_status: "POTENTIALLY_OUTDATED",
        system_impact_reason: `System setting '${settingName}' changed from '${oldValue}' to '${newValue}'. Content review required.`,
        system_impact_updated_at: now,
        updated_at: now
      };
      await saveStoreKnowledgeItem(updatedItem);
      affectedCount++;

      await addStoreAuditLog({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        knowledge_id: item.id,
        user_name: "System Automation",
        action: "System Setting Impact Marked",
        previous_value: { linked_value: oldValue, status: "NORMAL" },
        new_value: { linked_value: newValue, status: "POTENTIALLY_OUTDATED" },
        reason: `Linked system setting '${settingName}' was modified. Marked for review.`,
        created_at: now
      });
    }
  }

  return { affectedCount, trigger: triggerRecord };
}

/**
 * Resolves System Change Impact for a Knowledge Item.
 * Actions:
 *   - 'CREATE_VERSION': User initiates updated draft version.
 *   - 'NO_UPDATE_REQUIRED': User marks item as normal, recording resolution reason.
 */
export async function resolveSystemImpact(
  knowledgeId: string,
  user: { id: string; name: string },
  action: "CREATE_VERSION" | "NO_UPDATE_REQUIRED",
  reason: string
): Promise<KnowledgeItem> {
  const allItems = await getStoreKnowledgeItems();
  const item = allItems.find(i => i.id === knowledgeId);

  if (!item) throw new Error("Knowledge item not found");

  const now = new Date().toISOString();

  const updatedItem: KnowledgeItem = {
    ...item,
    system_impact_status: "NORMAL",
    system_impact_reason: null,
    system_impact_updated_at: now,
    updated_at: now
  };

  await saveStoreKnowledgeItem(updatedItem);

  await addStoreAuditLog({
    id: `log-${Date.now()}`,
    knowledge_id: item.id,
    user_id: user.id,
    user_name: user.name,
    action: action === "NO_UPDATE_REQUIRED" ? "No Update Required" : "System Change Impact Resolved",
    previous_value: { status: "POTENTIALLY_OUTDATED", reason: item.system_impact_reason },
    new_value: { status: "NORMAL", action },
    reason: reason,
    created_at: now
  });

  return updatedItem;
}
