import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityEntityType = "application" | "application_product" | "assignment";

type RecordActivityInput = {
  entityType: ActivityEntityType;
  entityId: string;
  beforeState: string | null;
  afterState: string;
  changedBy: string;
  reason?: string | null;
};

/**
 * 07_데이터모델.md ActivityLog. "최소 버전"이라 실패해도 원래 작업(심사 저장,
 * 배정 등)을 막지 않는다 — 로그 기록은 부가 기능이지 트랜잭션의 필수 조건이
 * 아니므로, 에러가 나면 콘솔에만 남기고 조용히 넘어간다.
 */
export async function recordActivity(input: RecordActivityInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("activity_logs").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    before_state: input.beforeState,
    after_state: input.afterState,
    changed_by: input.changedBy,
    reason: input.reason ?? null,
  });

  if (error) {
    console.error("[activity_logs] 기록 실패", error);
  }
}
