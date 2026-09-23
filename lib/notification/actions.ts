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
 * 로그인한 사용자의 모든 알림을 최신순으로 가져옵니다.
 * Brand Portal 사용자의 경우: 소속 회사의 Case 중 Action Required(조치 필요) 메시지를 알림으로 제공합니다.
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

      // Fetch partner inquiries for this company
      const { data: inquiries } = await adminSupabase
        .from("partner_inquiries")
        .select("id, case_number, category, title")
        .eq("company_id", companyId);

      if (!inquiries || inquiries.length === 0) {
        return [];
      }

      const inquiryMap = new Map(inquiries.map((i) => [i.id, i]));
      const inquiryIds = inquiries.map((i) => i.id);

      // Fetch Action Required messages sent by Admin
      const { data: messages, error: msgError } = await adminSupabase
        .from("partner_inquiry_messages")
        .select("id, inquiry_id, sender_id, sender_name, content, message_type, is_action_flag, created_at")
        .in("inquiry_id", inquiryIds)
        .eq("sender_type", "admin")
        .eq("is_action_flag", true)
        .eq("message_type", "message")
        .order("created_at", { ascending: false });

      if (msgError || !messages) {
        return [];
      }

      const notifications: NotificationItem[] = messages.map((msg) => {
        const inq = inquiryMap.get(msg.inquiry_id);
        const caseNum = inq?.case_number || "CASE";
        const catLabel = inq?.category ? (CATEGORY_LABELS[inq.category] || inq.category) : (inq?.title || "문의");
        const linkCaseIdentifier = inq?.case_number || inq?.id || msg.inquiry_id;

        return {
          id: msg.id,
          user_id: user.id,
          sender_id: msg.sender_id,
          title: "조치가 필요한 문의가 있습니다.",
          content: `${caseNum} · ${catLabel}`,
          link_url: `/portal/support?case=${linkCaseIdentifier}`,
          is_read: readIds.includes(msg.id),
          created_at: msg.created_at
        };
      });

      return notifications;
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
