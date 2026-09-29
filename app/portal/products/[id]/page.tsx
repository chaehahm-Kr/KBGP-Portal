import type { Metadata } from "next";
import { ProductDetailTabs } from "@/components/product/product-detail-tabs";
import { getPortalProductDetail } from "@/lib/product/portal-detail-loader";

export const metadata: Metadata = {
  title: "제품 상세 | 파트너 포털",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    />
  );
}
