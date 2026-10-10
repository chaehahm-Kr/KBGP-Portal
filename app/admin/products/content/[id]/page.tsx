import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getContentProductDetail } from "@/lib/product/content-actions";
import { ContentProductDetail } from "@/components/admin/content/content-product-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getContentProductDetail(id);
  if (!product) {
    return {
      title: "Content & Training | K SELECT NETWORK 어드민",
    };
  }
  return {
    title: `${product.name} — Content & Training | K SELECT NETWORK 어드민`,
  };
}

export default async function AdminContentProductDetailPage({ params }: Props) {
  await verifyAdminSession();
  const { id } = await params;
  const product = await getContentProductDetail(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <ContentProductDetail product={product} />
    </div>
  );
}
