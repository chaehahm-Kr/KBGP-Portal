import { createAdminClient } from "@/lib/supabase/admin";

export async function recordBrandCommsAudit(params: {
  entityType: "ANNOUNCEMENT" | "RESOURCE";
  entityId: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  summary: string;
  metadata?: Record<string, any>;
}) {
  try {
    const adminDb = createAdminClient();
    const { error } = await adminDb.from("brand_comms_audit_logs").insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      summary: params.summary,
      metadata: params.metadata || {},
    });
    if (error) {
      console.warn("[brand-comms/audit] Audit log insert warning:", error.message);
    }
  } catch (err) {
    console.warn("[brand-comms/audit] Audit log failed:", err);
  }
}
