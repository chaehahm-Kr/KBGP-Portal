import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { getSystemCompanyConfigs } from "@/lib/settings/actions";
import { mockCompanies } from "@/lib/data/mockData";

export const metadata: Metadata = {
  title: "회사 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminCompaniesPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  const { data: dbCompanies } = await supabase
    .from("companies")
    .select(`
      id, name, country, status, intro, created_at,
      brands (id, is_active),
      products (id)
    `)
    .order("created_at", { ascending: false });

  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("company_id, name, email, phone, title, position, is_primary, status")
    .order("created_at", { ascending: true });

  const configs = await getSystemCompanyConfigs();

  const resolvedDbCompanies = await Promise.all(
    (dbCompanies ?? []).map(async (c) => {
      const parsed = await parseCompanyMetadata(c);
      const activeBrandsCount = ((c.brands as any[]) || []).filter((b) => b.is_active).length;
      const totalProductsCount = ((c.products as any[]) || []).length;

      // Find primary contact from company_users first
      const users = (companyUsers ?? []).filter((u) => u.company_id === c.id);
      const dbPrimary = users.find((u) => u.is_primary) || users[0] || null;

      // Fallback to parsed metadata contacts
      const metadataPrimary = parsed.contacts.find((contact) => contact.isPrimary) || parsed.contacts[0] || null;

      const primaryContact = dbPrimary || metadataPrimary;

      return {
        id: c.id,
        name: c.name,
        type: parsed.type,
        country: c.country,
        contactName: primaryContact ? primaryContact.name : "담당자 정보 없음",
        contactPhone: primaryContact ? primaryContact.phone : "-",
        contactEmail: primaryContact ? primaryContact.email : "-",
        contactTitle: primaryContact ? primaryContact.title : "",
        contactPosition: primaryContact ? primaryContact.position : "",
        brandsCount: activeBrandsCount,
        productsCount: totalProductsCount,
        appStatus: parsed.status === "Active" ? "Approved" : "Pending",
        partnerStatus: parsed.status,
        accountOwner: "Alex Kim",
        lastContact: new Date(c.created_at).toLocaleDateString(),
      };
    })
  );

  // DB 데이터와 모의 데이터 병합
  const unifiedCompanies = [
    ...resolvedDbCompanies,
    ...mockCompanies.filter((mc) => !(dbCompanies ?? []).some((dc) => dc.name === mc.name)).map(mc => ({
      ...mc,
      contactName: mc.contactName || "담당자 정보 없음",
      contactPhone: mc.phone || "-",
      contactEmail: mc.email || "-",
      contactTitle: "팀장",
      contactPosition: "해외영업",
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">회사 관리</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            K SELECT NETWORK 플랫폼에 등록된 한국 뷰티 기업들의 파트너 상태와 관련 브랜드를 관리합니다.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/admin/companies/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-650 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-650 transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold">+</span> 신규 회사 추가
          </Link>
        </div>
      </div>

      {/* Companies Table */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3 font-semibold">회사명</th>
                <th className="px-6 py-3 font-semibold">유형</th>
                <th className="px-6 py-3 font-semibold">국가</th>
                <th className="px-6 py-3 font-semibold text-center">브랜드 수</th>
                <th className="px-6 py-3 font-semibold text-center">등록 제품 수</th>
                <th className="px-6 py-3 font-semibold">파트너 상태</th>
                <th className="px-6 py-3 font-semibold">주 컨택 담당자</th>
                <th className="px-6 py-3 font-semibold">최근 연락</th>
                <th className="px-6 py-3 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {unifiedCompanies.map((company, index) => {
                const statusConfig = configs.partner_statuses.find(
                  (s) => s.id.toLowerCase() === company.partnerStatus.toLowerCase()
                ) || { label: company.partnerStatus, color: "zinc" };

                const statusClass =
                  statusConfig.color === "emerald"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                    : statusConfig.color === "amber"
                    ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                    : statusConfig.color === "rose"
                    ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                    : statusConfig.color === "blue"
                    ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                    : "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-850 dark:text-zinc-405 dark:border-zinc-700";

                const isTopRow = index < 3;
                const tooltipPositionClass = isTopRow ? "top-full mt-2.5" : "bottom-full mb-2.5";
                const tooltipArrowClass = isTopRow 
                  ? "absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-white dark:border-b-zinc-955 -mb-[1px]" 
                  : "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-zinc-955 -mt-[1px]";

                return (
                  <tr key={company.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-6 py-3.5 font-bold text-zinc-950 dark:text-white">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {company.type}
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {company.country}
                    </td>
                    <td className="px-6 py-3.5 text-center text-zinc-900 dark:text-white font-semibold">
                      {company.brandsCount}
                    </td>
                    <td className="px-6 py-3.5 text-center text-zinc-900 dark:text-white font-semibold">
                      {company.productsCount}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${statusClass}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    
                    {/* Primary Contact with hover Tooltip */}
                    <td className="px-6 py-3.5">
                      <div className="relative group inline-block">
                        <span className="cursor-help font-semibold text-zinc-800 dark:text-zinc-200 border-b border-dashed border-zinc-300 hover:text-zinc-955 dark:hover:text-white">
                          {company.contactName}
                        </span>
                        
                        {company.contactName !== "담당자 정보 없음" && (
                          <div className={`absolute ${tooltipPositionClass} left-1/2 -translate-x-1/2 hidden group-hover:block w-52 p-3.5 rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-850 dark:bg-zinc-955 z-20 pointer-events-none transition-all`}>
                            <div className="space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                              <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5 mb-1.5 dark:border-zinc-800">
                                <span className="font-bold text-zinc-955 dark:text-white text-xs">{company.contactName}</span>
                                <span className="rounded bg-emerald-50 text-emerald-705 px-1.5 py-0.5 text-[8px] font-bold dark:bg-emerald-950/40 dark:text-emerald-300">주 컨택</span>
                              </div>
                              {company.contactTitle && <p><span className="font-bold text-zinc-405 block mb-0.5">직함</span>{company.contactTitle}</p>}
                              {company.contactPosition && <p><span className="font-bold text-zinc-405 block mb-0.5">부서 / 포지션</span>{company.contactPosition}</p>}
                              {company.contactPhone && <p><span className="font-bold text-zinc-405 block mb-0.5">연락처</span>{company.contactPhone}</p>}
                              {company.contactEmail && <p className="truncate"><span className="font-bold text-zinc-405 block mb-0.5">이메일</span>{company.contactEmail}</p>}
                            </div>
                            {/* Arrow indicator */}
                            <div className={tooltipArrowClass} />
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-3.5 text-zinc-400">
                      {company.lastContact}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-zinc-900 dark:text-white">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="hover:underline"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {unifiedCompanies.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-zinc-400">
                    등록된 파트너 회사 정보가 존재하지 않습니다.
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
