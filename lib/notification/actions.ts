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
      console.error("Failed to create notification:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (e) {
    console.error("Failed to create notification:", e);
    return { success: false, error: e instanceof Error ? e.message : "알림 생성 실패" };
  }
}

/**
 * 로그인한 사용자의 모든 알림을 최신순으로 가져옵니다.
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch notifications:", error);
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

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return { success: false, error: error.message };
    }

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

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Failed to mark all notifications as read:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error("Failed to mark all notifications as read:", e);
    return { success: false, error: e instanceof Error ? e.message : "전체 알림 읽음 처리 실패" };
  }
}
