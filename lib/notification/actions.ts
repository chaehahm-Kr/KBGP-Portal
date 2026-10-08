"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface NotificationItem {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  content: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * DATA-JSON-MIG-007: 알림은 notifications 테이블(0146), 읽음 기록은 notification_reads 에 둔다.
 * 예전에는 PO 알림을 companies.intro JSON, 읽음 기록을 company_users.permissions JSON 에 저장했다.
 * 두 테이블 모두 쓰기 RLS 정책이 없으므로 쓰기는 로그인 확인 후 service role 로 한다.
 */

const CATEGORY_LABELS: Record<string, string> = {
  po_change:   "PO 변경 요청",
  product:     "제품 등록 및 스펙 수정",
  onboarding:  "입점 신청 및 심사 현황",
  logistics:   "물류 공급 및 패키징",
  translation: "번역 및 전성분표 기재",
  settlement:  "정산 / 인보이스 문의",
  system:      "시스템 오류 제보 및 기능 제안",
  general:     "기타 일반 문의"
};

/**
 * 시스템 혹은 다른 행위자가 특정 사용자에게 새 알림을 생성합니다.
 * 알림 생성 실패가 원래 작업을 막지 않도록 오류는 기록만 하고 성공으로 돌려준다.
 */
export async function createNotification(
  userId: string,
  senderId: string | null,
  title: string,
  content: string,
  linkUrl: string | null = null
) {
  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("notifications")
      .insert({
        user_id: userId,
        sender_id: senderId,
        type: "GENERAL",
        title: title.slice(0, 200),
        content,
        link_url: linkUrl,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.warn("[notifications] create failed:", error.message);
      return { success: true };
    }

    return { success: true, data };
  } catch (e) {
    console.warn("[notifications] create failed:", e);
    return { success: true };
  }
}

/**
 * PO 관련 이벤트(PO_RECEIVED, PO_REVISED, PO_CANCELLATION_REQUESTED, PO_CANCELLED)에 대한
 * 회사 전체 알림을 생성합니다. 같은 이벤트(같은 type·PO, 수정이면 같은 revision)는 한 번만 만든다.
 */
export async function createPoNotification(params: {
  companyId: string;
  type: "PO_RECEIVED" | "PO_REVISED" | "PO_CANCELLATION_REQUESTED" | "PO_CANCELLED";
  title: string;
  content: string;
  linkUrl: string;
  poNumber: string;
  poId: string;
  metadata?: Record<string, any>;
}) {
  try {
    const adminSupabase = createAdminClient();
    const metadata = { ...(params.metadata || {}), poId: params.poId, poNumber: params.poNumber };

    let dupQuery = adminSupabase
      .from("notifications")
      .select("id")
      .eq("company_id", params.companyId)
      .eq("type", params.type)
      .eq("metadata->>poId", params.poId)
      .limit(1);
    const revNo = params.metadata?.revision_no;
    if (params.type === "PO_REVISED" && revNo !== undefined) {
      dupQuery = dupQuery.eq("metadata->>revision_no", String(revNo));
    }
    const { data: existing, error: dupError } = await dupQuery;
    if (dupError) throw new Error(dupError.message);

    if (!existing || existing.length === 0) {
      const { error } = await adminSupabase.from("notifications").insert({
        company_id: params.companyId,
        type: params.type,
        title: params.title.slice(0, 200),
        content: params.content,
        link_url: params.linkUrl,
        metadata,
      });
      if (error) throw new Error(error.message);
    }

    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (err) {
    console.error("Failed to create PO notification:", err);
    return { success: false, error: err instanceof Error ? err.message : "알림 생성 실패" };
  }
}

async function getReadItemIds(adminSupabase: ReturnType<typeof createAdminClient>, userId: string): Promise<Set<string>> {
  const { data, error } = await adminSupabase
    .from("notification_reads")
    .select("item_id")
    .eq("user_id", userId);
  if (error) {
    console.warn("[notifications] read-state load failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: any) => r.item_id));
}

async function markItemsRead(adminSupabase: ReturnType<typeof createAdminClient>, userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return;
  const { error } = await adminSupabase
    .from("notification_reads")
    .upsert(itemIds.map((item_id) => ({ user_id: userId, item_id })), { onConflict: "user_id,item_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/**
 * 로그인한 사용자의 모든 알림을 최신순으로 가져옵니다.
 * Brand Portal 사용자의 경우:
 * 1. 회사 전체 알림(PO 발주 수신, 수정, 취소 등)과 본인 대상 알림
 * 2. Action Required 문의 메시지 알림
 * Admin 직원 등 회사 소속이 아니면 본인 대상 알림만.
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const adminSupabase = createAdminClient();

    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser && companyUser.company_id) {
      const companyId = companyUser.company_id;
      const readIds = await getReadItemIds(adminSupabase, user.id);
      const resultNotifications: NotificationItem[] = [];

      // 1-A. 회사 전체 알림 + 본인 대상 알림
      const { data: rows, error: rowsError } = await adminSupabase
        .from("notifications")
        .select("id, user_id, sender_id, title, content, link_url, metadata, created_at")
        .or(`company_id.eq.${companyId},user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (rowsError) console.warn("[notifications] load failed:", rowsError.message);

      (rows ?? []).forEach((n: any) => {
        resultNotifications.push({
          id: n.id,
          user_id: user.id,
          sender_id: n.sender_id,
          title: n.title,
          content: n.content,
          link_url: n.link_url || (n.metadata?.poId ? `/portal/orders/purchase-orders/${n.metadata.poId}` : null),
          is_read: readIds.has(n.id),
          created_at: n.created_at,
        });
      });

      // 1-B. Fetch Action Required messages sent by Admin for company cases
      const { data: inquiries } = await adminSupabase
        .from("partner_inquiries")
        .select("id, case_number, category, title")
        .eq("company_id", companyId);

      if (inquiries && inquiries.length > 0) {
        const inquiryMap = new Map(inquiries.map((i) => [i.id, i]));
        const inquiryIds = inquiries.map((i) => i.id);

        const { data: messages } = await adminSupabase
          .from("partner_inquiry_messages")
          .select("id, inquiry_id, sender_id, sender_name, content, message_type, is_action_flag, created_at")
          .in("inquiry_id", inquiryIds)
          .eq("sender_type", "admin")
          .eq("is_action_flag", true)
          .eq("message_type", "message")
          .order("created_at", { ascending: false });

        if (messages) {
          messages.forEach((msg) => {
            const inq = inquiryMap.get(msg.inquiry_id);
            const caseNum = inq?.case_number || "CASE";
            const catLabel = inq?.category ? (CATEGORY_LABELS[inq.category] || inq.category) : (inq?.title || "문의");
            const linkCaseIdentifier = inq?.case_number || inq?.id || msg.inquiry_id;

            resultNotifications.push({
              id: msg.id,
              user_id: user.id,
              sender_id: msg.sender_id,
              title: "조치가 필요한 문의가 있습니다.",
              content: `${caseNum} · ${catLabel}`,
              link_url: `/portal/support?case=${linkCaseIdentifier}`,
              is_read: readIds.has(msg.id),
              created_at: msg.created_at,
            });
          });
        }
      }

      resultNotifications.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return resultNotifications;
    }

    // 2. 회사 소속이 아닌 사용자(Admin 직원 등): 본인 대상 알림
    const { data, error } = await adminSupabase
      .from("notifications")
      .select("id, user_id, sender_id, title, content, link_url, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[notifications] load failed:", error.message);
      return [];
    }

    return (data || []) as NotificationItem[];
  } catch (e) {
    console.error("Failed to fetch notifications:", e);
    return [];
  }
}

/**
 * 특정 알림을 읽음 처리합니다.
 */
export async function markNotificationAsRead(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "로그인이 필요합니다." };

    const adminSupabase = createAdminClient();
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser) {
      await markItemsRead(adminSupabase, user.id, [id]);
    } else {
      const { error } = await adminSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to mark notification as read:", e);
    return { success: false, error: e instanceof Error ? e.message : "알림 읽음 처리 실패" };
  }
}

/**
 * 사용자의 모든 읽지 않은 알림을 일괄 읽음 처리합니다.
 */
export async function markAllNotificationsAsRead() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "로그인이 필요합니다." };

    const adminSupabase = createAdminClient();
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser) {
      const notifications = await getNotifications();
      await markItemsRead(adminSupabase, user.id, notifications.filter((n) => !n.is_read).map((n) => n.id));
    } else {
      const { error } = await adminSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to mark all notifications as read:", e);
    return { success: false, error: e instanceof Error ? e.message : "전체 알림 읽음 처리 실패" };
  }
}
