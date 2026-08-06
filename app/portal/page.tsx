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
        .select("name, intro")
        .eq("id", companyUser.company_id)
        .single()
    : { data: null };

  // 1. Query company users count
  const { count: memberCount } = companyUser
    ? await supabase
        .from("company_users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyUser.company_id)
    : { count: 0 };

  // 2. Query products count
  let productCount = 0;
  if (companyUser) {
    let countRes = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyUser.company_id)
      .is("deleted_at", null);
      
    if (countRes.error) {
      countRes = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyUser.company_id);
    }
    productCount = countRes.count ?? 0;
  }

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

  // Query company task assignments setup progress
  const { getCompanyTaskSetupStatus } = await import("@/lib/company/task-actions");
  const taskStatus = companyUser
    ? await getCompanyTaskSetupStatus(companyUser.company_id)
    : { completedCount: 6, totalCount: 6, percent: 100 };

  // 4. Parse company address status
  const { parseCompanyMetadata } = await import("@/lib/company/admin-actions");
  const parsedMeta = company ? await parseCompanyMetadata(company) : null;
  const hasAddress = !!parsedMeta?.address_1;

  // Onboarding checklist steps
  const onboardingSteps = [
    {
      id: "invite_members",
      label: "소속 팀원 초대",
      desc: "포털을 함께 관리할 브랜드사 팀원(최소 2명 이상)을 초대하세요.",
      isComplete: (memberCount ?? 0) >= 2,
      progressText: `현재 ${(memberCount ?? 0)}명`,
      href: "/portal/company/users",
      actionText: "팀원 초대하기",
    },
    {
      id: "assign_primary",
      label: "업무별 주 담당자 지정",
      desc: "계약, 가격, 물류 등 6대 핵심 업무의 주 담당자를 지정하세요.",
      isComplete: taskStatus.completedCount === taskStatus.totalCount,
      progressText: `${taskStatus.completedCount}/${taskStatus.totalCount} 완료`,
      href: "/portal/company/info",
      actionText: "담당자 설정하기",
    },
    {
      id: "fill_address",
      label: "회사 주소 필수 입력",
      desc: "세분화된 주소(기본 주소, 시, 도, 우편번호)를 모두 기입하세요.",
      isComplete: hasAddress,
      progressText: hasAddress ? "등록 완료" : "미등록",
      href: "/portal/company/info",
      actionText: "주소 입력하기",
    },
    {
      id: "register_product",
      label: "최소 1개 이상의 제품 등록",
      desc: "글로벌 유통 및 파트너 매칭을 위해 1개 이상의 제품을 등록하세요.",
      isComplete: (productCount ?? 0) >= 1,
      progressText: `현재 ${(productCount ?? 0)}개`,
      href: "/portal/products",
      actionText: "제품 등록하기",
    },
  ];

  const completedStepsCount = onboardingSteps.filter(s => s.isComplete).length;
  const onboardingPercent = Math.round((completedStepsCount / onboardingSteps.length) * 100);
  const showOnboarding = onboardingPercent < 100;

  const isCompanyAdmin = companyUser?.company_role === "company_admin";

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

      {/* Onboarding Checklist Guide */}
      {showOnboarding && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#8C1C2B] animate-pulse" />
                포털 시작하기 필수 가이드 (온보딩 체크리스트)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                K SELECT NETWORK 입점 심사 및 원활한 글로벌 파트너 매칭을 위해 아래 4개 필수 단계를 완료해 주세요.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-zinc-650 dark:text-zinc-300 font-mono">진행 상태 {onboardingPercent}%</span>
              <div className="h-2 w-32 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                <div 
                  className="h-full bg-[#131E2E] dark:bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${onboardingPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {onboardingSteps.map((step, idx) => (
              <div 
                key={step.id} 
                className={`relative flex flex-col justify-between p-4 rounded-lg border transition-all ${
                  step.isComplete 
                    ? "bg-emerald-50/20 border-emerald-250 dark:bg-emerald-950/10 dark:border-emerald-900/50" 
                    : "bg-zinc-50/50 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-950/20 dark:border-zinc-800 dark:hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 font-mono">STEP 0${idx + 1}</span>
                    {step.isComplete ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-150 dark:border-emerald-900/50">
                        ✓ 완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 border border-amber-150 dark:border-amber-900/50">
                        대기
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-zinc-850 dark:text-white mt-2">{step.label}</h3>
                  <p className="text-[10px] text-zinc-450 dark:text-zinc-400 mt-1 leading-relaxed">{step.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-405 font-mono">{step.progressText}</span>
                  {!step.isComplete && (
                    <Link
                      href={step.href}
                      className="inline-flex items-center rounded-md bg-[#131E2E] dark:bg-indigo-650 hover:bg-[#8C1C2B] dark:hover:bg-indigo-700 px-2.5 py-1.5 text-[10px] font-bold text-white transition-all"
                    >
                      {step.actionText}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
