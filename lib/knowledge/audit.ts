import { KnowledgeAuditLog } from "./types";
import { addStoreAuditLog, getStoreAuditLogs } from "./store";

export async function logKnowledgeActivity(
  knowledgeId: string,
  user: { id?: string; name: string },
  action: string,
  previousValue: Record<string, any> = {},
  newValue: Record<string, any> = {},
  reason?: string
): Promise<KnowledgeAuditLog> {
  const log: KnowledgeAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: knowledgeId,
    user_id: user.id || null,
    user_name: user.name || "System",
    action,
    previous_value: previousValue,
    new_value: newValue,
    reason: reason || null,
    created_at: new Date().toISOString()
  };

  return await addStoreAuditLog(log);
}

export async function fetchKnowledgeActivityLogs(knowledgeId: string): Promise<KnowledgeAuditLog[]> {
  return await getStoreAuditLogs(knowledgeId);
}
