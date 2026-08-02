import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { serverEnv } from "@/lib/env/server";

// lib/company/invite-actions.ts의 초대 링크 만료 기준과 동일하게 7일로 맞춘다.
const INVITE_EXPIRY_DAYS = 7;

/**
 * 09_알림및문서관리규칙.md 이벤트 "초대 만료 임박". 매일 한 번, 초대 후 6~7일차
 * 구간(=만료 24시간 전)에 들어온 미수락 초대를 찾아 초대한 사람에게 알린다.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = serverEnv.CRON_SECRET ? `Bearer ${serverEnv.CRON_SECRET}` : null;

  if (expected) {
    if (authHeader !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const expiryCutoff = new Date(
    now.getTime() - (INVITE_EXPIRY_DAYS * 24 - 24) * 60 * 60 * 1000
  );

  const { data: expiringInvites } = await admin
    .from("company_users")
    .select("id, name, email, invited_by")
    .eq("status", "invited")
    .is("expiry_notified_at", null)
    .not("invited_at", "is", null)
    .lte("invited_at", expiryCutoff.toISOString());

  let sent = 0;

  for (const invite of expiringInvites ?? []) {
    if (!invite.invited_by) continue;

    const { data: inviter } = await admin
      .from("company_users")
      .select("email")
      .eq("id", invite.invited_by)
      .maybeSingle();

    if (inviter) {
      await sendTemplatedEmail("invite_expiring_soon", inviter.email, {
        inviteeName: invite.name,
        inviteeEmail: invite.email,
      });
    }

    await admin
      .from("company_users")
      .update({ expiry_notified_at: now.toISOString() })
      .eq("id", invite.id);

    sent += 1;
  }

  return NextResponse.json({ sent });
}
