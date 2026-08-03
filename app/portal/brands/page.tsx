import type { Metadata } from "next";
import Link from "next/link";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { deactivateBrand, parseBrandTrademarks } from "@/lib/brand/actions";

import { ConfirmForm } from "@/components/common/confirm-form";

export const metadata: Metadata = {
  title: "브랜드 관리 | 파트너 포털",
};

export default async function BrandsPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // Safely fetch brands with trademark columns
  let brandsData: any[] = [];
  const { data: brandsWithTrademarks, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, intro, logo_path, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!brandsError && brandsWithTrademarks) {
    brandsData = brandsWithTrademarks;
  } else {
    // Fallback to core columns if database migration hasn't been run yet
    const { data: coreBrands } = await supabase
      .from("brands")
      .select("id, name, intro, logo_path")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    brandsData = coreBrands ?? [];
  }

  // Parse and resolve trademark information and logos
  const resolvedBrands = await Promise.all(
    brandsData.map(async (brand) => {
      const tm = await parseBrandTrademarks(brand);
      const logoUrl = brand.logo_path ? await getSignedFileUrl(brand.logo_path) : null;
      return {
        ...brand,
        logoUrl,
        introText: tm.intro_text,
        hasKr: tm.has_kr_trademark,
        hasUs: tm.has_us_trademark,
      };
    })
  );

  return (
    <div className="space-y-6 w-full max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">브랜드 관리</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            K SELECT NETWORK 입점 신청 및 제품 등록에서 활용할 브랜드 목록을 구성합니다.
          </p>
        </div>
        <Link
          href="/portal/brands/new"
          className="w-full sm:w-auto text-center rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          새 브랜드 추가
        </Link>
      </div>

      {/* Brands Grid */}
      {resolvedBrands.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white py-12 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 text-xs">
          등록된 브랜드가 아직 존재하지 않습니다. 상단 '새 브랜드 추가' 단추를 이용해 첫 브랜드를 개설해 보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {resolvedBrands.map((brand) => (
            <div
              key={brand.id}
              className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brand.logoUrl}
                      alt=""
                      className="h-10 w-10 rounded border border-zinc-200 dark:border-zinc-800 object-cover bg-zinc-50 dark:bg-zinc-950"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-850 text-[10px] font-bold text-zinc-400 select-none">
                      LOGO
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                      {brand.name}
                    </h3>
                  </div>
                </div>

                {/* Professional Trademark Statuses */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-[10px] font-semibold text-zinc-550 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>대한민국 상표권 등록 여부</span>
                    {brand.hasKr ? (
                      <span className="text-emerald-600 dark:text-emerald-450 font-bold bg-emerald-50/60 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">보유</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-650 font-medium">미보유</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>미국 USPTO 상표권 등록 여부</span>
                    {brand.hasUs ? (
                      <span className="text-emerald-600 dark:text-emerald-450 font-bold bg-emerald-50/60 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">보유</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-650 font-medium">미보유</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-50 pt-3 dark:border-zinc-800 text-xs">
                <Link
                  href={`/portal/brands/${brand.id}`}
                  className="font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  브랜드 수정
                </Link>
                <ConfirmForm
                  action={deactivateBrand.bind(null, brand.id)}
                  message="정말 이 브랜드를 사용 중단하시겠습니까?\n(사용 중단된 브랜드는 신청서 및 제품 목록에서 비활성화됩니다.)"
                >
                  <button
                    type="submit"
                    className="font-semibold text-destructive hover:underline cursor-pointer"
                  >
                    사용 중단
                  </button>
                </ConfirmForm>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
