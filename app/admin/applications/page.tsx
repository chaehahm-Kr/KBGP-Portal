import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";
import { sendPortalInvitationAction } from "@/lib/company/admin-actions";

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
  "deleted",
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
  deleted: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; company?: string; show_deleted?: string }>;
}) {
  await verifyAdminSession();
  const { status, company, show_deleted } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select("id, application_number, status, company_id, submitted_at, created_at, eligibility_responses, self_check_answers")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else if (show_deleted !== "true") {
    query = query.neq("status", "deleted");
  }

  const { data: applications } = await query;

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, intro, contact_name, contact_phone");

  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("id, company_id, name, email, phone, title, position, is_primary, status, invited_at")
    .order("created_at", { ascending: true });
  
  const companyMap = new Map<
    string,
    {
      name: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      contactTitle: string;
      contactPosition: string;
      description: string;
    }
  >();

  for (const c of companies ?? []) {
    const users = (companyUsers ?? []).filter((u) => u.company_id === c.id);
    const dbPrimary = users.find((u) => u.is_primary) || users[0];

    let description = "";
    let contactEmail = "";
    let contactPhone = c.contact_phone || "";
    let contactName = c.contact_name || "";
    let contactTitle = "";
    let contactPosition = "";

    if (dbPrimary) {
      contactName = dbPrimary.name || contactName;
      contactEmail = dbPrimary.email || "";
      contactPhone = dbPrimary.phone || contactPhone;
      contactTitle = dbPrimary.title || "";
      contactPosition = dbPrimary.position || "";
    } else if (c.intro && c.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const jsonStr = c.intro.substring("__COMPANY_METADATA__:".length);
        const data = JSON.parse(jsonStr);
        const contacts = data.contacts || [];
        const primary = contacts.find((x: any) => x.isPrimary) || contacts[0];
        if (primary) {
          contactName = primary.name || contactName;
          contactEmail = primary.email || "";
          contactPhone = primary.phone || contactPhone;
          contactTitle = primary.title || "";
          contactPosition = primary.position || "";
        }
      } catch (e) {}
    }

    if (c.intro && c.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const jsonStr = c.intro.substring("__COMPANY_METADATA__:".length);
        const data = JSON.parse(jsonStr);
        description = data.description || "";
      } catch (e) {}
    } else {
      description = c.intro || "";
    }

    companyMap.set(c.id, {
      name: c.name,
      contactName: contactName || "-",
      contactEmail,
      contactPhone,
      contactTitle,
      contactPosition,
      description
    });
  }

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
    const cInfo = companyMap.get(app.company_id);
    const name = cInfo?.name ?? "";
    return name.toLowerCase().includes(company.toLowerCase());
  });

  const getDaysPassed = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const submittedDate = new Date(dateStr);
    submittedDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - submittedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? "오늘 제출" : `${diffDays}일 경과`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">신청서 목록</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            전체 파트너 회사가 제출한 입점 신청서 내역을 조회하고 배정 및 심사를 처리합니다.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/admin/applications/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-955 px-4 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span className="text-sm font-bold">+</span> New Application
          </Link>
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

          <div className="flex h-11 items-center gap-2 pl-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-650 dark:text-zinc-400 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                name="show_deleted"
                value="true"
                defaultChecked={show_deleted === "true"}
                className="cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:accent-white"
              />
              <span>삭제 포함</span>
            </label>
          </div>

          <div className="flex h-11 items-end">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 h-8"
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
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-955 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3 font-semibold">신청번호</th>
                <th className="px-6 py-3 font-semibold">회사명</th>
                <th className="px-6 py-3 font-semibold">심사 상태</th>
                <th className="px-6 py-3 font-semibold">준비 사항</th>
                <th className="px-6 py-3 font-semibold">담당 심사원</th>
                <th className="px-6 py-3 font-semibold text-center">브랜드 담당자</th>
                <th className="px-6 py-3 font-semibold">포털 가입 상태</th>
                <th className="px-6 py-3 font-semibold">제출일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((app) => {
                const badgeClass = STATUS_BADGE_STYLE[app.status as ApplicationStatus] || "bg-zinc-100 text-zinc-800";
                const compInfo = companyMap.get(app.company_id);
                return (
                  <tr key={app.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-6 py-3.5 font-semibold text-zinc-955 dark:text-white">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                      >
                        {app.application_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300 font-medium">
                      {compInfo?.name ?? "-"}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                        {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {(() => {
                        const allowedKeys = [
                          "stable_supply",
                          "us_regulatory_compliance",
                          "initial_test_quantity",
                          "north_america_distribution",
                          "joint_marketing",
                          "sales_content_support",
                        ];
                        const defaultEligibility = allowedKeys.map((key, index) => {
                          const isChecked = (app.self_check_answers as boolean[] | null)?.[index] ?? true;
                          return {
                            itemKey: key,
                            response: isChecked ? "available" : "discussion_required",
                          };
                        });
                        const list = app.eligibility_responses
                          ? (app.eligibility_responses as any[])
                          : defaultEligibility;
                        const available = list.filter((r) => r.response === "available").length;
                        const discussion = list.filter((r) => r.response === "discussion_required").length;
                        return (
                          <div className="flex gap-1.5 text-[10px]">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-350 border border-emerald-100 dark:border-emerald-900/50">
                              🟢 {available}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-350 border border-amber-100 dark:border-amber-900/50">
                              🟡 {discussion}
                            </span>
                          </div>
                        );
                      })()}
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
                    <td className="px-6 py-3.5 text-center relative group">
                      {compInfo ? (
                        <>
                          <span className="font-semibold text-zinc-900 dark:text-white underline decoration-dotted cursor-help decoration-zinc-400 hover:text-indigo-650 dark:hover:text-indigo-400">
                            {compInfo.contactName}
                          </span>
                          {/* Hover Popover Tooltip */}
                          <div className="absolute left-1/2 bottom-full mb-2 w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3.5 text-left text-xs text-zinc-700 shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-35 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                            <h4 className="font-bold text-zinc-900 dark:text-white text-[13px] border-b border-zinc-100 pb-1.5 mb-2 dark:border-zinc-900 flex justify-between items-center">
                              <span>{compInfo.contactName} {compInfo.contactTitle && `(${compInfo.contactTitle})`}</span>
                              <span className="text-[10px] font-normal text-zinc-400">{compInfo.contactPosition}</span>
                            </h4>
                            <div className="space-y-1 text-xs">
                              <p className="flex justify-between gap-2">
                                <span className="text-zinc-400 shrink-0 font-medium">이메일:</span>
                                <span className="font-semibold text-zinc-900 dark:text-white truncate">{compInfo.contactEmail || "-"}</span>
                              </p>
                              <p className="flex justify-between gap-2">
                                <span className="text-zinc-400 shrink-0 font-medium">연락처:</span>
                                <span className="font-semibold text-zinc-900 dark:text-white">{compInfo.contactPhone || "-"}</span>
                              </p>
                              {compInfo.description && (
                                <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                                  <span className="block text-[10px] text-zinc-400 font-bold mb-1">회사 소개</span>
                                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-3">{compInfo.description}</p>
                                </div>
                              )}
                            </div>
                            {/* Arrow */}
                            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {(() => {
                        const usersOfCompany = (companyUsers ?? []).filter((u) => u.company_id === app.company_id);
                        const primaryUser = usersOfCompany.find((u) => u.is_primary) || usersOfCompany[0];
                        if (!primaryUser) return <span className="text-zinc-400">-</span>;
                        
                        let badgeClass = "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
                        let label = "요청 전";
                        let showBtn = false;
                        let btnText = "";
                        
                        if (primaryUser.status === "active") {
                          badgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-350 border border-emerald-100 dark:border-emerald-900/50";
                          label = "가입 완료";
                        } else if (primaryUser.status === "invited") {
                          if (primaryUser.invited_at) {
                            badgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-350 border border-amber-100 dark:border-amber-900/50";
                            label = "가입 대기";
                            showBtn = true;
                            btnText = "재요청";
                          } else {
                            badgeClass = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-250 dark:border-zinc-700";
                            label = "요청 전";
                            showBtn = true;
                            btnText = "가입 요청";
                          }
                        }
                        
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                              {label}
                            </span>
                            {showBtn && (
                              <form action={sendPortalInvitationAction.bind(null, primaryUser.id)}>
                                <button
                                  type="submit"
                                  className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 transition-colors h-6 cursor-pointer"
                                >
                                  {btnText}
                                </button>
                              </form>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-3.5 text-zinc-650 dark:text-zinc-400">
                      {app.submitted_at ? (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {new Date(app.submitted_at).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-bold">
                            ({getDaysPassed(app.submitted_at)})
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-zinc-400">
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
