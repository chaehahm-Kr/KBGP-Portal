import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalTenantContext } from "@/lib/company/dal";
import { BrandForm } from "@/components/brand/brand-form";
import { updateBrand, parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "브랜드 수정 | 파트너 포털",
};

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const canWrite = await hasPortalPermission("brands", "write");
  if (!canWrite) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="브랜드 정보를 수정할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const { id } = await params;
  const { companyId, supabase } = await getPortalTenantContext();

  let brandData: any = null;

  // Try fetching with new trademark columns first
  const { data: brandWithTrademarks, error: selectError } = await supabase
    .from("brands")
    .select("id, name, intro, logo_path, is_active, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!selectError && brandWithTrademarks) {
    brandData = brandWithTrademarks;
  } else {
    // Fallback if schema differs
    const { data: coreBrand } = await supabase
      .from("brands")
      .select("id, name, intro, logo_path, is_active")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();
    brandData = coreBrand;
  }

  if (!brandData) {
    notFound();
  }

  const parsedTrademarks = await parseBrandTrademarks(brandData);

  const logoUrl = brandData.logo_path ? await getSignedFileUrl(brandData.logo_path) : undefined;
  const krTrademarkUrl = parsedTrademarks.kr_trademark_path ? await getSignedFileUrl(parsedTrademarks.kr_trademark_path) : undefined;
  const usTrademarkUrl = parsedTrademarks.us_trademark_path ? await getSignedFileUrl(parsedTrademarks.us_trademark_path) : undefined;

  const isInactive = brandData.is_active === false;

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">브랜드 수정</h1>
          {isInactive && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100/80 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-300/60 dark:border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>사용 중단 (Inactive)</span>
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">등록된 브랜드 정보를 업데이트합니다.</p>
      </div>

      {isInactive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>본 브랜드는 현재 사용 중단(Inactive) 상태입니다. 정보 수정은 가능하나 신규 상품 등록 브랜드 목록에는 노출되지 않습니다.</span>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 hover:border-[#131E2E]/80 transition-colors shadow-sm">
        <BrandForm
          action={updateBrand.bind(null, brandData.id)}
          defaultName={brandData.name}
          defaultIntro={parsedTrademarks.intro_text ?? undefined}
          defaultLogoUrl={logoUrl ?? undefined}
          defaultHasKrTrademark={parsedTrademarks.has_kr_trademark}
          defaultKrTrademarkNumber={parsedTrademarks.kr_trademark_number ?? undefined}
          defaultKrTrademarkFileUrl={krTrademarkUrl ?? undefined}
          defaultKrTrademarkPath={parsedTrademarks.kr_trademark_path ?? undefined}
          defaultHasUsTrademark={parsedTrademarks.has_us_trademark}
          defaultUsTrademarkNumber={parsedTrademarks.us_trademark_number ?? undefined}
          defaultUsTrademarkFileUrl={usTrademarkUrl ?? undefined}
          defaultUsTrademarkPath={parsedTrademarks.us_trademark_path ?? undefined}
          submitLabel="저장"
        />
      </div>
    </div>
  );
}
