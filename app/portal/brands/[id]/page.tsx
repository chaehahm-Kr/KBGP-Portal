import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { BrandForm } from "@/components/brand/brand-form";
import { updateBrand, parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";

export const metadata: Metadata = {
  title: "브랜드 수정 | 파트너 포털",
};

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCompanyMembership();
  const supabase = await createClient();

  // RLS(brands_select_own_or_admin)가 본인 회사 브랜드가 아니면 애초에 결과를 안 준다 —
  // 그 경우를 "없는 브랜드"와 동일하게 404로 처리한다.
  let brandData: any = null;

  // Try fetching with new trademark columns first
  const { data: brandWithTrademarks, error: selectError } = await supabase
    .from("brands")
    .select("id, name, intro, logo_path, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
    .eq("id", id)
    .single();

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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">브랜드 수정</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">등록된 브랜드 정보를 업데이트합니다.</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
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
