export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { serverEnv } from "@/lib/env/server";

/**
 * 09_알림및문서관리규칙.md 이벤트 "추가 자료 회신 기한 임박/초과". Vercel Cron이
 * vercel.json 설정에 따라 매일 이 라우트를 호출한다(GET, Authorization: Bearer
 * {CRON_SECRET}). 같은 요청에 리마인드를 두 번 보내지 않도록 due_soon_notified_at /
 * overdue_notified_at 컬럼으로 발송 여부를 기록해둔다.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = serverEnv.CRON_SECRET ? `Bearer ${serverEnv.CRON_SECRET}` : null;

  if (expected) {
    if (authHeader !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // CRON_SECRET 없이 운영 환경에서 이 라우트가 열려 있으면 안 된다.
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  let dueSoonSent = 0;
  let overdueSent = 0;

  const { data: dueSoonRequests } = await admin
    .from("additional_info_requests")
    .select("id, company_id, application_id")
    .eq("status", "pending")
    .is("due_soon_notified_at", null)
    .lte("reply_due_at", soonThreshold.toISOString())
    .gt("reply_due_at", now.toISOString());

  for (const req of dueSoonRequests ?? []) {
    const { data: application } = await admin
      .from("applications")
      .select("application_number")
      .eq("id", req.application_id)
      .single();
    if (!application) continue;

    const { data: recipients } = await admin
      .from("company_users")
      .select("email")
      .eq("company_id", req.company_id)
      .in("status", ["active", "invited"]);

    for (const recipient of recipients ?? []) {
      await sendTemplatedEmail("info_request_due_soon", recipient.email, {
        applicationNumber: application.application_number,
        dueDate: formatDueDate(soonThreshold.toISOString()),
      });
    }

    await admin
      .from("additional_info_requests")
      .update({ due_soon_notified_at: now.toISOString() })
      .eq("id", req.id);

    dueSoonSent += 1;
  }

  const { data: overdueRequests } = await admin
    .from("additional_info_requests")
    .select("id, application_id, requested_by, reply_due_at")
    .eq("status", "pending")
    .is("overdue_notified_at", null)
    .lt("reply_due_at", now.toISOString());

  for (const req of overdueRequests ?? []) {
    const { data: application } = await admin
      .from("applications")
      .select("application_number")
      .eq("id", req.application_id)
      .single();
    if (!application) continue;

    const { data: staffMember } = await admin
      .from("staff_members")
      .select("email")
      .eq("id", req.requested_by)
      .maybeSingle();

    if (staffMember) {
      await sendTemplatedEmail("info_request_overdue", staffMember.email, {
        applicationNumber: application.application_number,
        dueDate: formatDueDate(req.reply_due_at),
      });
    }

    await admin
      .from("additional_info_requests")
      .update({ overdue_notified_at: now.toISOString() })
      .eq("id", req.id);

    overdueSent += 1;
  }

  return NextResponse.json({ dueSoonSent, overdueSent });
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
