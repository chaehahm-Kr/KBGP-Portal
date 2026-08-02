import type { Metadata } from "next";
import Link from "next/link";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createDraftApplication } from "@/lib/application/actions";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";

export const metadata: Metadata = {
  title: "신청 현황 | 파트너 포털",
};

export default async function ApplicationsPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("applications")
    .select("id, application_number, status, submitted_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const { data: links } = await supabase
    .from("application_products")
    .select("application_id")
    .eq("company_id", companyId);

  const countByApplication = new Map<string, number>();
  for (const link of links ?? []) {
    countByApplication.set(
      link.application_id,
      (countByApplication.get(link.application_id) ?? 0) + 1
    );
  }

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
      case "draft":
        return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
      default:
        return "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-450 dark:border-zinc-750";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">입점 신청 현황</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            제출하신 K SELECT NETWORK 참가 신청서 목록 및 상태를 확인합니다.
          </p>
        </div>
        <form action={createDraftApplication}>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            새 신청서 작성
          </button>
        </form>
      </div>

      {/* Table Card Container */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-250 bg-zinc-50/50 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-6 py-3">신청 번호</th>
                <th className="px-6 py-3">신청 상태</th>
                <th className="px-6 py-3">포함 제품 수</th>
                <th className="px-6 py-3">최종 변경일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/60">
              {(applications ?? []).map((app) => (
                <tr
                  key={app.id}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">
                    <Link
                      href={`/portal/applications/${app.id}`}
                      className="hover:underline"
                    >
                      {app.application_number ?? "(임시저장 상태)"}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(
                        app.status
                      )}`}
                    >
                      {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus]}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">
                    {countByApplication.get(app.id) ?? 0}개
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-450 font-mono">
                    {new Date(app.submitted_at ?? app.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}

              {(applications ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500"
                  >
                    아직 등록된 입점 신청서가 존재하지 않습니다. 상단의 '새 신청서 작성'을 클릭해 진행해 주세요.
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
