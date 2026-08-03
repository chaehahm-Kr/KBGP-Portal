import type { Metadata } from "next";
import Link from "next/link";
import { verifyPortalSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";

export const metadata: Metadata = {
  title: "대시보드 | 파트너 포털",
};

export default async function PortalHomePage() {
  const session = await verifyPortalSession();
  const supabase = await createClient();

  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id, company_role")
    .eq("id", session.userId)
    .single();

  const { data: company } = companyUser
    ? await supabase
        .from("companies")
        .select("name")
        .eq("id", companyUser.company_id)
        .single()
    : { data: null };

  const { data: applications } = await supabase
    .from("applications")
    .select("id, application_number, status, submitted_at, created_at")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const applicationRows = applications ?? [];

  // Count states
  const statusCounts = {
    submitted: 0,
    under_review: 0,
    info_requested: 0,
    approved: 0,
    rejected: 0,
  };

  for (const app of applicationRows) {
    const status = app.status as keyof typeof statusCounts;
    if (status in statusCounts) {
      statusCounts[status]++;
    }
  }

  const { data: pendingRequests } = await supabase
    .from("additional_info_requests")
    .select("id, application_id, request_content, reply_due_at")
    .eq("status", "pending")
    .order("reply_due_at", { ascending: true });

  const pendingRequestRows = pendingRequests ?? [];
  const applicationNumberById = new Map(
    applicationRows.map((a) => [a.id, a.application_number])
  );

  const recentApplications = applicationRows.slice(0, 5);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
      case "info_requested":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
      case "under_review":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
      default:
        return "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
    }
  };

  return (
    <div className="space-y-8 w-full max-w-7xl">
      {/* Top Banner */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
          환영합니다, {session.email}
        </h1>
        {companyUser && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            소속 기업: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{company?.name}</span> ·{" "}
            <span className="text-xs rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium">
              {companyUser.company_role === "company_admin" ? "관리자" : "담당자"}
            </span>
          </p>
        )}
      </div>

      {/* Info Requests Alert Banner */}
      {pendingRequestRows.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-950 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-505/10 animate-pulse" />
            <h2 className="text-sm font-semibold">
              회신 대기 중인 추가 자료 요청 {pendingRequestRows.length}건이 있습니다.
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            {pendingRequestRows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-100 bg-white p-3 text-xs dark:border-amber-900/30 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/portal/applications/${r.application_id}`}
                    className="font-bold text-zinc-900 hover:underline dark:text-white"
                  >
                    {applicationNumberById.get(r.application_id) ?? "신청서"}
                  </Link>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    — {r.request_content.slice(0, 50)}
                    {r.request_content.length > 50 ? "..." : ""}
                  </span>
                </div>
                {r.reply_due_at && (
                  <span className="font-mono text-destructive dark:text-rose-450">
                    기한: {new Date(r.reply_due_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">제출 신청</p>
          <p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{applicationRows.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">검토 중</p>
          <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{statusCounts.under_review}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">자료 요청</p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{statusCounts.info_requested}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">승인 완료</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{statusCounts.approved}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">반려됨</p>
          <p className="mt-2 text-2xl font-bold text-zinc-650 dark:text-zinc-400">{statusCounts.rejected}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Recent Applications */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">최근 제출한 입점 신청서</h2>
            <Link
              href="/portal/applications"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            >
              전체 보기 →
            </Link>
          </div>

          {recentApplications.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              아직 제출한 신청서가 없습니다.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-bold text-zinc-500 dark:border-zinc-800">
                    <th className="py-2">신청 번호</th>
                    <th className="py-2">상태</th>
                    <th className="py-2">제출 일자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 text-xs dark:divide-zinc-800/50">
                  {recentApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/30">
                      <td className="py-3 font-semibold text-zinc-900 dark:text-white">
                        <Link
                          href={`/portal/applications/${app.id}`}
                          className="hover:underline"
                        >
                          {app.application_number}
                        </Link>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(app.status)}`}>
                          {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus]}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-500 font-mono">
                        {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Quick Links */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-4 dark:border-zinc-800">
            빠른 메뉴 바로가기
          </h2>
          <div className="grid grid-cols-1 gap-2">
            <Link
              href="/portal/brands"
              className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/20"
            >
              <span>브랜드 관리</span>
              <span className="text-zinc-400">→</span>
            </Link>
            <Link
              href="/portal/products"
              className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/20"
            >
              <span>제품 관리</span>
              <span className="text-zinc-400">→</span>
            </Link>
            <Link
              href="/portal/applications"
              className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/20"
            >
              <span>입점 신청 내역</span>
              <span className="text-zinc-400">→</span>
            </Link>
            {companyUser?.company_role === "company_admin" && (
              <Link
                href="/portal/company/users"
                className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/20"
              >
                <span>소속 사용자 관리</span>
                <span className="text-zinc-400">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
