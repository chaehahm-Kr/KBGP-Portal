import type { Metadata } from "next";
import Link from "next/link";
import { getPortalTenantContext } from "@/lib/company/dal";
import { getSignedFileUrl } from "@/lib/files/storage";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { BrandOnboardingBanner } from "@/components/brand/brand-onboarding-banner";
import { BrandListClient, type BrandItemResolved } from "@/components/brand/brand-list-client";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "브랜드 관리 | 파트너 포털",
};

export default async function BrandsPage() {
  const canRead = await hasPortalPermission("brands", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="브랜드 관리 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const canWrite = await hasPortalPermission("brands", "write");
  const canManage = await hasPortalPermission("brands", "manage");

  const { companyId, supabase } = await getPortalTenantContext();

  // Fetch company intro to check onboarding confirmation
  const { data: company } = await supabase
    .from("companies")
    .select("intro")
    .eq("id", companyId)
    .single();

  const parsedMeta = await parseCompanyMetadata(company || {});

  // Fetch all brands (both active and inactive)
  let brandsData: any[] = [];
  const { data: brandsWithTrademarks, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, intro, logo_path, is_active, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (!brandsError && brandsWithTrademarks) {
    brandsData = brandsWithTrademarks;
  } else {
    // Fallback if schema differs
    const { data: coreBrands } = await supabase
      .from("brands")
      .select("id, name, intro, logo_path, is_active")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    brandsData = coreBrands ?? [];
  }

  // Fetch products to count connected products per brand
  const { data: productsData } = await supabase
    .from("products")
    .select("id, brand_id")
    .eq("company_id", companyId);

  const productCountByBrandId = new Map<string, number>();
  (productsData ?? []).forEach((p) => {
    if (p.brand_id) {
      productCountByBrandId.set(p.brand_id, (productCountByBrandId.get(p.brand_id) || 0) + 1);
    }
  });

  // Resolve signed URLs and trademark information
  const resolvedBrands: BrandItemResolved[] = await Promise.all(
    brandsData.map(async (brand) => {
      const tm = await parseBrandTrademarks(brand);
      const logoUrl = brand.logo_path ? await getSignedFileUrl(brand.logo_path) : null;
      const productCount = productCountByBrandId.get(brand.id) || 0;
      return {
        id: brand.id,
        name: brand.name,
        introText: tm.intro_text,
        logoUrl,
        hasKr: tm.has_kr_trademark,
        hasUs: tm.has_us_trademark,
        isActive: brand.is_active !== false,
        productCount,
      };
    })
  );

  const activeBrands = resolvedBrands.filter((b) => b.isActive);
  const isBrandConfirmed = Boolean(parsedMeta.brand_onboarding_confirmed_at && activeBrands.length > 0);

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
        {canWrite && (
          <Link
            href="/portal/brands/new"
            className="w-full sm:w-auto text-center rounded-md bg-[#131E2E] hover:bg-[#1f3047] px-4 py-2 text-xs font-semibold text-white transition-colors dark:bg-white dark:text-[#131E2E] dark:hover:bg-zinc-100"
          >
            새 브랜드 추가
          </Link>
        )}
      </div>

      {/* Onboarding Banner */}
      <BrandOnboardingBanner isConfirmed={isBrandConfirmed} />

      {/* Interactive Brand List Client */}
      <BrandListClient
        brands={resolvedBrands}
        canWrite={canWrite}
        canManage={canManage}
      />
    </div>
  );
}
