import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICATION_STATUS_LABEL,
  PARTNER_TYPE_LABEL,
  ENTRY_MODE_LABEL,
  type ApplicationStatus,
  type ApplicationPartnerType,
  type ApplicationEntryMode,
} from "@/lib/application/types";
import { sendPortalInvitationAction } from "@/lib/company/admin-actions";

export const metadata: Metadata = {
  title: "신청서 및 파트너 초대 관리 | K SELECT NETWORK 어드민",
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  "submitted",
  "assigned",
  "under_review",
  "info_requested",
  "re_review",
  "partial_approved",
  "approved",
  "invitation_sent",
  "onboarding",
  "onboarded",
  "on_hold",
  "rejected",
  "cancelled",
  "deleted",
];

const STATUS_BADGE_STYLE: Record<ApplicationStatus, string> = {
  draft: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50",
  assigned: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50",
  under_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50",
  info_requested: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-100 dark:border-red-900/50",
  re_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50",
  partial_approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50",
  invitation_sent: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50",
  onboarding: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-100 dark:border-sky-900/50",
  onboarded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800",
  on_hold: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-100 dark:border-red-900/50",
  cancelled: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  deleted: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    status?: string;
    mode?: string;
    company?: string;
    show_deleted?: string;
  }>;
}) {
  await verifyAdminSession();
  const { type, status, mode, company, show_deleted } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select(
      "id, application_number, partner_type, entry_mode, status, company_id, onboarded_company_id, applicant_company_name, applicant_contact_name, applicant_contact_email, applicant_contact_phone, submitted_at, created_at, eligibility_responses, self_check_answers"
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("partner_type", type);
  }
  if (status) {
    query = query.eq("status", status);
  } else if (show_deleted !== "true") {
    query = query.neq("status", "deleted");
  }
  if (mode) {
    query = query.eq("entry_mode", mode);
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
      description,
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
    const cInfo = app.company_id ? companyMap.get(app.company_id) : null;
    const name = cInfo?.name || app.applicant_company_name || "";
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
    return diffDays === 0 ? "오늘 접수" : `${diffDays}일 경과`;
  };

  const currentTab = type || "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-950 dark:text-white">
            신청서 및 파트너 초대 관리 (Applications & Invitations)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            브랜드 및 리테일러 파트너사의 입점 신청서 내역을 심사하고 정식 계정 초대를 발송합니다.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/admin/applications/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span className="text-sm font-bold">+</span> Invite Partner (파트너 초대)
          </Link>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex space-x-6 text-xs font-semibold">
          <Link
            href="/admin/applications"
            className={`pb-3 border-b-2 transition-colors ${
              currentTab === "all"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            🌐 전체 신청서 (All Applications)
          </Link>
          <Link
            href="/admin/applications?type=brand"
            className={`pb-3 border-b-2 transition-colors ${
              currentTab === "brand"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            🏷️ 브랜드 신청서 (Brand Applications)
          </Link>
          <Link
            href="/admin/applications?type=retailer"
            className={`pb-3 border-b-2 transition-colors ${
              currentTab === "retailer"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            🏪 리테일러 신청서 (Retailer Applications)
          </Link>
        </nav>
      </div>

      {/* Filter Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
        <form method="get" className="flex flex-wrap items-center gap-3">
          {type && <input type="hidden" name="type" value={type} />}

          <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">회사명 검색</span>
            <input
              type="text"
              name="company"
              defaultValue={company}
              placeholder="회사명을 입력하세요..."
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            />
          </div>

          <div className="flex min-w-[140px] flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">유입 경로 (Entry Mode)</span>
            <select
              name="mode"
              defaultValue={mode ?? ""}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">전체 유입</option>
              <option value="public_application">공개 신청 (Public)</option>
              <option value="admin_invitation">어드민 직접 초대 (Admin Invite)</option>
            </select>
          </div>

          <div className="flex min-w-[140px] flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">진행 상태</span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
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
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors h-8 cursor-pointer"
            >
              필터 적용
            </button>
          </div>
        </form>
      </div>

      {/* Applications Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-5 py-3 font-semibold">신청번호</th>
                <th className="px-4 py-3 font-semibold">구분 (Type)</th>
                <th className="px-5 py-3 font-semibold">회사명 (Company)</th>
                <th className="px-4 py-3 font-semibold">진행 상태</th>
                <th className="px-4 py-3 font-semibold">유입 경로</th>
                <th className="px-4 py-3 font-semibold">담당 심사원</th>
                <th className="px-5 py-3 font-semibold text-center">주 담당자</th>
                <th className="px-4 py-3 font-semibold">포털 / 온보딩 상태</th>
                <th className="px-5 py-3 font-semibold">접수 / 생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((app) => {
                const partnerType: ApplicationPartnerType = app.partner_type || "brand";
                const entryMode: ApplicationEntryMode = app.entry_mode || "public_application";
                const badgeClass = STATUS_BADGE_STYLE[app.status as ApplicationStatus] || "bg-zinc-100 text-zinc-800";
                
                const compInfo = app.company_id ? companyMap.get(app.company_id) : null;
                const companyName = compInfo?.name || app.applicant_company_name || "-";
                const contactName = compInfo?.contactName || app.applicant_contact_name || "-";
                const contactEmail = compInfo?.contactEmail || app.applicant_contact_email || "-";
                const contactPhone = compInfo?.contactPhone || app.applicant_contact_phone || "-";

                return (
                  <tr key={app.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-5 py-3.5 font-bold font-mono text-zinc-950 dark:text-white whitespace-nowrap">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                      >
                        {app.application_number}
                      </Link>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {partnerType === "retailer" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                          🏪 Retailer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                          🏷️ Brand
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-zinc-900 dark:text-zinc-100 font-bold">
                      {companyName}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                        {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus] || app.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-[10px]">
                      {entryMode === "admin_invitation" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900">
                          ⚡ Admin Invite
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          🌐 Public Form
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {assigneeByApplication.has(app.id) ? (
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {staffNameById.get(assigneeByApplication.get(app.id)!) ?? "-"}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          미배정
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center relative group whitespace-nowrap">
                      <span className="font-semibold text-zinc-900 dark:text-white underline decoration-dotted cursor-help decoration-zinc-400">
                        {contactName}
                      </span>
                      {/* Contact Tooltip */}
                      <div className="absolute left-1/2 bottom-full mb-2 w-72 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3.5 text-left text-xs text-zinc-700 shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-30 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        <h4 className="font-bold text-zinc-900 dark:text-white text-[13px] border-b border-zinc-100 pb-1.5 mb-2 dark:border-zinc-800">
                          {contactName}
                        </h4>
                        <div className="space-y-1 text-xs font-mono">
                          <p><span className="text-zinc-400 font-sans">이메일:</span> {contactEmail}</p>
                          <p><span className="text-zinc-400 font-sans">연락처:</span> {contactPhone}</p>
                        </div>
                        <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {(() => {
                        if (app.status === "onboarded") {
                          return (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                              ✓ 온보딩 완료
                            </span>
                          );
                        }
                        if (app.status === "invitation_sent") {
                          return (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200">
                              📨 초대장 발송됨
                            </span>
                          );
                        }

                        const usersOfCompany = app.company_id
                          ? (companyUsers ?? []).filter((u) => u.company_id === app.company_id)
                          : [];
                        const primaryUser = usersOfCompany.find((u) => u.is_primary) || usersOfCompany[0];
                        if (!primaryUser) return <span className="text-zinc-400 font-medium">미초대</span>;

                        if (primaryUser.status === "active") {
                          return (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100">
                              가입 완료
                            </span>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-100">
                              가입 대기
                            </span>
                            <form action={sendPortalInvitationAction.bind(null, primaryUser.id)}>
                              <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors h-5 cursor-pointer"
                              >
                                재요청
                              </button>
                            </form>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
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
                        new Date(app.created_at).toLocaleDateString("ko-KR")
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-zinc-400">
                    조건에 부합하는 신청서 및 파트너 초대 내역이 없습니다.
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
