import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { mockBrands, mockCompanies } from "@/lib/data/mockData";

export const metadata: Metadata = {
  title: "브랜드 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminBrandsPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  // Safely fetch brands with trademark columns
  let brandsData: any[] = [];
  const { data: brandsWithTrademarks, error: brandsError } = await supabase
    .from("brands")
    .select(`
      id, name, intro, logo_path, company_id, created_at, updated_at,
      companies (id, name),
      has_kr_trademark, kr_trademark_number, kr_trademark_path,
      has_us_trademark, us_trademark_number, us_trademark_path
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!brandsError && brandsWithTrademarks) {
    brandsData = brandsWithTrademarks;
  } else {
    // Fallback to core columns if database migration hasn't been run yet
    const { data: coreBrands } = await supabase
      .from("brands")
      .select(`
        id, name, intro, logo_path, company_id, created_at, updated_at,
        companies (id, name)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    brandsData = coreBrands ?? [];
  }

  // Parse and resolve trademark information and logos
  const resolvedBrands = await Promise.all(
    brandsData.map(async (brand) => {
      const tm = await parseBrandTrademarks(brand);
      const logoUrl = brand.logo_path ? await getSignedFileUrl(brand.logo_path) : null;
      return {
        id: brand.id,
        name: brand.name,
        logoUrl,
        companyName: brand.companies?.name || "알 수 없음",
        companyId: brand.companies?.id || brand.company_id,
        hasKr: tm.has_kr_trademark,
        hasUs: tm.has_us_trademark,
        lastUpdated: new Date(brand.updated_at || brand.created_at).toLocaleDateString(),
      };
    })
  );

  // DB 데이터와 모의 데이터 병합
  const unifiedBrands = [
    ...resolvedBrands,
    ...mockBrands
      .filter((mb) => !brandsData.some((dbB) => dbB.name === mb.name))
      .map((mb) => {
        const company = mockCompanies.find((mc) => mc.id === mb.companyId);
        return {
          id: mb.id,
          name: mb.name,
          logoUrl: null,
          companyName: company ? company.name : "모의 회사",
          companyId: mb.companyId,
          hasKr: mb.id === "b-1" || mb.id === "b-2" || mb.id === "b-3", // Give some mock values
          hasUs: mb.id === "b-1" || mb.id === "b-3",
          lastUpdated: "2026-07-31",
        };
      }),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">브랜드 관리</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          K SELECT NETWORK 플랫폼에 파트너사들이 등록하고 보유 중인 브랜드들의 상표권 및 정보 현황을 조회합니다.
        </p>
      </div>

      {/* Brands Table */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-55/40 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3 font-semibold w-16">로고</th>
                <th className="px-6 py-3 font-semibold">브랜드명</th>
                <th className="px-6 py-3 font-semibold">보유 회사</th>
                <th className="px-6 py-3 font-semibold text-center">대한민국 상표권 등록 여부</th>
                <th className="px-6 py-3 font-semibold text-center">미국 USPTO 상표권 등록 여부</th>
                <th className="px-6 py-3 font-semibold">최근 업데이트일</th>
                <th className="px-6 py-3 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {unifiedBrands.map((brand) => (
                <tr key={brand.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                  <td className="px-6 py-3">
                    {brand.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded-md border border-zinc-200 object-cover bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-400 select-none">
                        LOGO
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-bold text-zinc-950 dark:text-white">
                    <Link
                      href={`/admin/companies/${brand.companyId}`}
                      className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                    >
                      {brand.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                    <Link
                      href={`/admin/companies/${brand.companyId}`}
                      className="hover:underline text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      {brand.companyName}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {brand.hasKr ? (
                      <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-705 dark:bg-emerald-950/40 dark:text-emerald-300">
                        보유
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-850 dark:text-zinc-600">
                        미보유
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {brand.hasUs ? (
                      <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-705 dark:bg-emerald-950/40 dark:text-emerald-300">
                        보유
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-850 dark:text-zinc-600">
                        미보유
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-zinc-400">
                    {brand.lastUpdated}
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold text-zinc-900 dark:text-white">
                    <Link
                      href={`/admin/companies/${brand.companyId}`}
                      className="hover:underline"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
              {unifiedBrands.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-zinc-400">
                    등록된 브랜드 정보가 존재하지 않습니다.
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
