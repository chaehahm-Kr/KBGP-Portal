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

const CATEGORY_LABELS: Record<string, string> = {
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
 * RLS 우회를 위해 admin 클라이언트를 사용합니다.
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
        title,
        content,
        link_url: linkUrl,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      return { success: true };
    }

    return { success: true, data };
  } catch {
    return { success: true };
  }
}

/**
 * PO 관련 이벤트(PO_RECEIVED, PO_REVISED, PO_CANCELLATION_REQUESTED, PO_CANCELLED)에 대한 알림을 생성합니다.
 * 중복 생성을 방지하며 회사 메타데이터 및 notifications 테이블에 안전하게 기록합니다.
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
    const notificationId = `po-${params.type.toLowerCase()}-${params.poId}-${Date.now()}`;

    // 1. Fetch company intro JSON
    const { data: comp } = await adminSupabase
      .from("companies")
      .select("intro")
      .eq("id", params.companyId)
      .maybeSingle();

    let metaObj: any = {};
    if (comp && comp.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        metaObj = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
      } catch (e) {}
    }

    const existingNotifs: any[] = Array.isArray(metaObj.notifications) ? metaObj.notifications : [];
    
    // Deduplication check for identical event (same type, poId, and revision if revised)
    const revNo = params.metadata?.revision_no;
    const isDuplicate = existingNotifs.some((n: any) => {
      if (n.type !== params.type || n.poId !== params.poId) return false;
      if (params.type === "PO_REVISED" && revNo !== undefined) {
        return n.metadata?.revision_no === revNo;
      }
      return true;
    });

    if (!isDuplicate) {
      const newNotif = {
        id: notificationId,
        companyId: params.companyId,
        type: params.type,
        title: params.title,
        content: params.content,
        link_url: params.linkUrl,
        poNumber: params.poNumber,
        poId: params.poId,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      };

      existingNotifs.unshift(newNotif);
      // Keep up to 100 recent notifications
      metaObj.notifications = existingNotifs.slice(0, 100);

      await adminSupabase
        .from("companies")
        .update({
          intro: `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`,
        })
        .eq("id", params.companyId);
    }

    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (err) {
    console.error("Failed to create PO notification:", err);
    return { success: false, error: err instanceof Error ? err.message : "알림 생성 실패" };
  }
}

/**
 * 로그인한 사용자의 모든 알림을 최신순으로 가져옵니다.
 * Brand Portal 사용자의 경우:
 * 1. PO 관련 이벤트 알림 (발주 수신, 수정, 취소 등)
 * 2. Action Required 문의 메시지 알림
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const adminSupabase = createAdminClient();

    // 1. Check if user belongs to a company (Brand Portal User)
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id, permissions")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser && companyUser.company_id) {
      const companyId = companyUser.company_id;
      const readIds: string[] = Array.isArray(companyUser.permissions?.read_notification_ids)
        ? companyUser.permissions.read_notification_ids
        : [];

      const resultNotifications: NotificationItem[] = [];

      // 1-A. Fetch PO notifications from Company Metadata
      const { data: comp } = await adminSupabase
        .from("companies")
        .select("intro")
        .eq("id", companyId)
        .maybeSingle();

      if (comp && comp.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
        try {
          const parsed = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
          if (Array.isArray(parsed.notifications)) {
            parsed.notifications.forEach((n: any) => {
              resultNotifications.push({
                id: n.id,
                user_id: user.id,
                sender_id: null,
                title: n.title,
                content: n.content,
                link_url: n.link_url || `/portal/orders/purchase-orders/${n.poId}`,
                is_read: readIds.includes(n.id),
                created_at: n.created_at,
              });
            });
          }
        } catch (e) {}
      }

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
              is_read: readIds.includes(msg.id),
              created_at: msg.created_at,
            });
          });
        }
      }

      // Sort all notifications by created_at descending
      resultNotifications.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return resultNotifications;
    }

    // 2. Fallback for staff or system notifications table
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return [];
    }

    return data || [];
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

    // Check company user
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("permissions")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser) {
      const currentPerms = (companyUser.permissions && typeof companyUser.permissions === "object")
        ? companyUser.permissions
        : {};
      const currentReadIds: string[] = Array.isArray(currentPerms.read_notification_ids)
        ? currentPerms.read_notification_ids
        : [];

      if (!currentReadIds.includes(id)) {
        const nextReadIds = [...currentReadIds, id];
        await adminSupabase
          .from("company_users")
          .update({
            permissions: {
              ...currentPerms,
              read_notification_ids: nextReadIds
            }
          })
          .eq("id", user.id);
      }

      revalidatePath("/portal", "layout");
      return { success: true };
    }

    // Fallback for notifications table
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);

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

    const notifications = await getNotifications();
    const allIds = notifications.map((n) => n.id);

    const adminSupabase = createAdminClient();
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("permissions")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser) {
      const currentPerms = (companyUser.permissions && typeof companyUser.permissions === "object")
        ? companyUser.permissions
        : {};
      const currentReadIds: string[] = Array.isArray(currentPerms.read_notification_ids)
        ? currentPerms.read_notification_ids
        : [];

      const mergedReadIds = Array.from(new Set([...currentReadIds, ...allIds]));

      await adminSupabase
        .from("company_users")
        .update({
          permissions: {
            ...currentPerms,
            read_notification_ids: mergedReadIds
          }
        })
        .eq("id", user.id);

      revalidatePath("/portal", "layout");
      return { success: true };
    }

    // Fallback for notifications table
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (e) {
    console.error("Failed to mark all notifications as read:", e);
    return { success: false, error: e instanceof Error ? e.message : "전체 알림 읽음 처리 실패" };
  }
}
