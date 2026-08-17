import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";
import {
  mockCompanies,
  mockProducts,
  mockStores,
  mockTasks,
  mockSalesData
} from "@/lib/data/mockData";

import { getPendingPartnerInquiriesCount } from "@/lib/inquiry/actions";

export const metadata: Metadata = {
  title: "대시보드 | K SELECT NETWORK 어드민",
};

export default async function AdminHomePage() {
  const session = await verifyAdminSession();
  const supabase = await createClient();
  const pendingInquiriesCount = await getPendingPartnerInquiriesCount();

  // DB 실시간 데이터 가져오기
  const { data: dbApps } = await supabase
    .from("applications")
    .select("id, application_number, status, company_id, created_at, submitted_at")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const { data: dbCompanies } = await supabase.from("companies").select("id, name");
  const dbCompanyNameMap = new Map((dbCompanies ?? []).map((c) => [c.id, c.name]));

  const dbAppsCount = dbApps?.length ?? 0;
  const pendingAppsCount = dbApps?.filter((app) => ["submitted", "under_review", "info_requested"].includes(app.status))?.length ?? 0;
  const approvedCompaniesCount = dbCompanies?.length ?? 0;

  // KPI 계산 (실시간 DB + 모의 데이터 병합)
  const totalApplications = dbAppsCount + 20; // DB + Mock
  const pendingReviews = pendingAppsCount + 3;
  const approvedCompanies = approvedCompaniesCount + 8;
  const activeProducts = mockProducts.length;
  const retailStores = mockStores.length;
  const productsInTesting = mockProducts.filter((p) => p.retailStatus === "Testing").length;
  const amazonLaunches = mockProducts.filter((p) => p.amazonStatus === "Launching").length;
  const monthlyNetSales = "$119,500"; // Mocked total

  return (
    <div className="space-y-6">
      {/* Pending Partner Inquiries Action Card */}
      {pendingInquiriesCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-extrabold text-sm shadow-xs">
              {pendingInquiriesCount}
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                처리 대기 Partner 문의 {pendingInquiriesCount}건
              </h3>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5">
                Partner inquiries awaiting review: {pendingInquiriesCount}. 파트너사의 신규 문의 및 답변 요청을 확인해주세요.
              </p>
            </div>
          </div>
          <Link
            href="/admin/partner-inquiries"
            className="rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            Partner Inquiries 바로가기 →
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Applications", value: totalApplications, change: "+12.5%", period: "vs last month" },
          { label: "Pending Reviews", value: pendingReviews, change: "+5.1%", period: "vs last week" },
          { label: "Approved Companies", value: approvedCompanies, change: "+8.2%", period: "vs last month" },
          { label: "Active Products", value: activeProducts, change: "+15.0%", period: "vs last month" },
          { label: "Retail Stores", value: retailStores, change: "0.0%", period: "vs last month" },
          { label: "Products in Testing", value: productsInTesting, change: "+25.0%", period: "vs last week" },
          { label: "Amazon Launches", value: amazonLaunches, change: "+50.0%", period: "vs last month" },
          { label: "Monthly Net Sales", value: monthlyNetSales, change: "+18.3%", period: "vs last month" },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {kpi.label}
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold text-zinc-900 dark:text-white">
                {kpi.value}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {kpi.change}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
              {kpi.period}
            </span>
          </div>
        ))}
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 columns: Sales Trend & Recent applications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sales Trend Visualization */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">
              Sales Trend (Monthly Net Sales)
            </h2>
            <div className="flex h-48 items-end gap-2 px-2 pb-2 pt-6">
              {mockSalesData.monthlyNetSales.map((data, idx) => {
                const maxVal = 70000;
                const retailHeight = (data.retail / maxVal) * 100;
                const amazonHeight = (data.amazon / maxVal) * 100;

                return (
                  <div key={idx} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex w-full flex-col justify-end gap-1 h-36">
                      <div
                        style={{ height: `${retailHeight}%` }}
                        className="w-full rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-300 dark:hover:bg-zinc-200 transition-all duration-300"
                      />
                      <div
                        style={{ height: `${amazonHeight}%` }}
                        className="w-full rounded bg-zinc-400 hover:bg-zinc-300 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-all duration-300"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400">{data.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex gap-4 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 justify-center">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded bg-zinc-900 dark:bg-white" />
                <span>Retail Sales</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded bg-zinc-400 dark:bg-zinc-600" />
                <span>Amazon Sales</span>
              </div>
            </div>
          </div>

          {/* Recent Applications Table */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">최근 접수된 신청서</h2>
              <Link
                href="/admin/applications"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                전체보기 →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-100 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                    <th className="py-2.5">신청번호</th>
                    <th className="py-2.5">회사명</th>
                    <th className="py-2.5">상태</th>
                    <th className="py-2.5">신청일</th>
                    <th className="py-2.5 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {dbApps?.slice(0, 5).map((app) => (
                    <tr key={app.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="py-3 font-semibold text-zinc-950 dark:text-white">
                        {app.application_number}
                      </td>
                      <td className="py-3">{dbCompanyNameMap.get(app.company_id) || "-"}</td>
                      <td className="py-3">
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus]}
                        </span>
                      </td>
                      <td className="py-3">
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className="font-semibold text-zinc-900 hover:underline dark:text-white"
                        >
                          심사하기
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {dbAppsCount === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-zinc-400">
                        현재 대기중인 신청서가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 column: Tasks & Attention List */}
        <div className="space-y-6">
          {/* Upcoming Tasks */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">
              진행 중인 할 일
            </h2>
            <div className="space-y-3">
              {mockTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded border border-zinc-100 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                      {task.company}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                        task.priority === "Urgent"
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : task.priority === "High"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-zinc-900 dark:text-white">
                    {task.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-400">
                    <span>담당: {task.owner}</span>
                    <span>기한: {task.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Products requiring attention */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">
              주의가 필요한 제품
            </h2>
            <div className="space-y-3 text-xs">
              {[
                { name: "어성초 스팟 패드 (Abib)", issue: "Compliance Review Required", type: "Docs" },
                { name: "윤조 에센스 (Sulwhasoo)", issue: "Missing FDA certificates", type: "Docs" },
                { name: "블랙티 시너지 토너", issue: "Sample evaluation requested", type: "Sample" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-zinc-50 pb-2 dark:border-zinc-800">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-white">{item.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{item.issue}</p>
                  </div>
                  <span className="rounded bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300 shrink-0">
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

