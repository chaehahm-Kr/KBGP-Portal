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
    .select("id, name, intro, logo_path, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!selectError && brandWithTrademarks) {
    brandData = brandWithTrademarks;
  } else {
    // Fallback to core columns if database migration hasn't been run yet
    const { data: coreBrand } = await supabase
      .from("brands")
      .select("id, name, intro, logo_path")
      .eq("id", id)
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

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">브랜드 수정</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">등록된 브랜드 정보를 업데이트합니다.</p>
      </div>
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
