import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PO 요청은 po_requests 워크플로 테이블(0092)이 운영 DB에 없어서, 실제로는
 * companies.intro 의 "__COMPANY_METADATA__:" JSON(po_requests 배열)에 저장된다
 * (lib/purchase-order/request-actions.ts 의 saveRequestToMeta 참고).
 * Admin 미읽음 배지와 읽음 처리도 같은 저장소를 보도록 이 파일에서 다룬다.
 */
const META_PREFIX = "__COMPANY_METADATA__:";

/** Admin 이 처리해야 하는 상태 — getAdminUnreadCounts 의 테이블 조건과 같다. */
const UNREAD_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "CHANGE_REQUESTED"]);

type MetaPoRequest = {
  id: string;
  status?: string;
  admin_read_at?: string | null;
  admin_read_by?: string | null;
};

function parseMeta(intro: string | null): Record<string, unknown> | null {
  if (!intro || !intro.startsWith(META_PREFIX)) return null;
  try {
    return JSON.parse(intro.substring(META_PREFIX.length));
  } catch {
    return null;
  }
}

function metaRequests(meta: Record<string, unknown> | null): MetaPoRequest[] {
  return meta && Array.isArray(meta.po_requests) ? (meta.po_requests as MetaPoRequest[]) : [];
}

export async function countUnreadMetaPoRequests(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select("intro")
    .like("intro", `${META_PREFIX}%`);
  if (error) {
    console.warn("[po-request-badge] metadata count failed", error.message);
    return 0;
  }

  let count = 0;
  for (const row of data ?? []) {
    for (const r of metaRequests(parseMeta(row.intro))) {
      if (r.status && UNREAD_STATUSES.has(r.status) && !r.admin_read_at) count++;
    }
  }
  return count;
}

/** 해당 요청을 담은 회사의 메타데이터에 admin_read_at 을 기록한다. 이미 읽었으면 그대로 둔다. */
export async function markMetaPoRequestAsRead(requestId: string, adminUserId?: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select("id, intro")
    .like("intro", `%"id":"${requestId}"%`);
  if (error) {
    console.warn("[po-request-badge] metadata lookup failed", error.message);
    return false;
  }

  for (const row of data ?? []) {
    const meta = parseMeta(row.intro);
    const list = metaRequests(meta);
    const target = list.find((r) => r.id === requestId);
    if (!meta || !target) continue;
    if (target.admin_read_at) return true;

    target.admin_read_at = new Date().toISOString();
    if (adminUserId) target.admin_read_by = adminUserId;

    const { error: updateError } = await admin
      .from("companies")
      .update({ intro: `${META_PREFIX}${JSON.stringify(meta)}` })
      .eq("id", row.id);
    if (updateError) {
      console.warn("[po-request-badge] metadata mark-read failed", updateError.message);
      return false;
    }
    return true;
  }
  return false;
}
