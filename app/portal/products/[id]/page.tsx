import type { Metadata } from "next";
import { ProductDetailTabs } from "@/components/product/product-detail-tabs";
import { getPortalProductDetail } from "@/lib/product/portal-detail-loader";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "제품 상세 | 파트너 포털",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const canRead = await hasPortalPermission("products", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="제품 관리 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const canWrite = await hasPortalPermission("products", "write");

  const { id } = await params;
  const detailData = await getPortalProductDetail(id);

  return (
    <ProductDetailTabs
      product={detailData.product}
      brandName={detailData.brandName}
      brands={detailData.brands}
      imageRows={detailData.imageRows}
      imageUrls={detailData.imageUrls}
      videoRows={detailData.videoRows}
      videoUrls={detailData.videoUrls}
      certificateRows={detailData.certificateRows}
      certificateUrls={detailData.certificateUrls}
      ingredientsFileUrl={detailData.ingredientsFileUrl}
      ingredientsFileUrlEn={detailData.ingredientsFileUrlEn}
      initialCategoryCompletion={detailData.initialCategoryCompletion}
      initialCategoriesTree={detailData.initialCategoriesTree}
      initialAttributeValues={detailData.initialAttributeValues}
      initialCategoryAttributes={detailData.initialCategoryAttributes}
      canWrite={canWrite}
    />
  );
}
