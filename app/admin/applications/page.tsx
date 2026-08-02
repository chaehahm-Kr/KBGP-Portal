import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";

export const metadata: Metadata = {
  title: "신청서 관리 | K SELECT NETWORK 어드민",
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  "submitted",
  "assigned",
  "under_review",
  "info_requested",
  "re_review",
  "partial_approved",
  "approved",
  "on_hold",
  "rejected",
  "cancelled",
];

const STATUS_BADGE_STYLE: Record<ApplicationStatus, string> = {
  draft: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  assigned: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  under_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  info_requested: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  re_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  partial_approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  on_hold: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  cancelled: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; company?: string }>;
}) {
  await verifyAdminSession();
  const { status, company } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select("id, application_number, status, company_id, submitted_at, created_at")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: applications } = await query;

  const { data: companies } = await supabase.from("companies").select("id, name");
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  const { data: staffMembers } = await supabase.from("staff_members").select("id, name, email");
  const staffNameById = new Map(
    (staffMembers ?? []).map((s) => [s.id, s.name || s.email])
  );

  const { data: assignments } = await supabase
    .from("assignments")
    .select("application_id, staff_id")
    .eq("is_current", true);
  const assigneeByApplication = new Map(
    (assignments ?? []).map((a) => [a.application_id, a.staff_id])
  );

  const filtered = (applications ?? []).filter((app) => {
    if (!company) return true;
    const name = companyNameById.get(app.company_id) ?? "";
    return name.toLowerCase().includes(company.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">신청서 목록</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            전체 파트너 회사가 제출한 입점 신청서 내역을 조회하고 배정 및 심사를 처리합니다.
          </p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">회사명 검색</span>
            <input
              type="text"
              name="company"
              defaultValue={company}
              placeholder="회사명을 입력하세요..."
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          <div className="flex min-w-[150px] flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">심사 상태</span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            >
              <option value="">전체 상태</option>
              {STATUS_OPTIONS.map((val) => (
                <option key={val} value={val}>
                  {APPLICATION_STATUS_LABEL[val]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex h-11 items-end">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 h-8"
            >
              필터 적용
            </button>
          </div>
        </form>
      </div>

      {/* Applications Table */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3 font-semibold">신청번호</th>
                <th className="px-6 py-3 font-semibold">회사명</th>
                <th className="px-6 py-3 font-semibold">심사 상태</th>
                <th className="px-6 py-3 font-semibold">담당 심사원</th>
                <th className="px-6 py-3 font-semibold">제출일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((app) => {
                const badgeClass = STATUS_BADGE_STYLE[app.status as ApplicationStatus] || "bg-zinc-100 text-zinc-800";
                return (
                  <tr key={app.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-6 py-3.5 font-semibold text-zinc-950 dark:text-white">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                      >
                        {app.application_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {companyNameById.get(app.company_id) ?? "-"}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                        {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {assigneeByApplication.has(app.id) ? (
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {staffNameById.get(assigneeByApplication.get(app.id)!) ?? "-"}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          미배정
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-zinc-400">
                      {app.submitted_at
                        ? new Date(app.submitted_at).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "-"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-zinc-400">
                    조건에 부합하는 신청서 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
