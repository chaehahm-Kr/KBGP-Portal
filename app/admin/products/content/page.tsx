import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getContentStatusProducts } from "@/lib/product/content-actions";
import { ContentStatusList } from "@/components/admin/content/content-status-list";

export const metadata: Metadata = {
  title: "콘텐츠 및 교육 관리 (Content & Training) | K SELECT NETWORK 어드민",
  description: "상품별 고객 안내 페이지, 교육 자료, 미디어 에셋, FAQ, 리뷰, QR 퍼블리싱 현황을 관리합니다.",
};

export default async function AdminContentAndTrainingPage() {
  await verifyAdminSession();
  const { products, filterOptions } = await getContentStatusProducts();

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <ContentStatusList initialProducts={products} filterOptions={filterOptions} />
    </div>
  );
}
