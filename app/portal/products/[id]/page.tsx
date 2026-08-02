import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { ProductDetailTabs } from "@/components/product/product-detail-tabs";
import type { Product, ProductVideo } from "@/lib/product/types";

export const metadata: Metadata = {
  title: "제품 상세 | 파트너 포털",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`
      id, name, name_en, category, volume, estimated_retail_price, ingredients_text, brand_id,
      description, bullet_points, color, color_map, origin, lead_time,
      parent_sku, child_sku, manufacture_sku, letusto_sku,
      price_krw_retail, price_krw_wholesale, price_usd_fob, price_additional_info,
      item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      carton_pack_qty, carton_width, carton_depth, carton_height, carton_weight, carton_cbm,
      palette_carton_qty, palette_width, palette_depth, palette_height, palette_weight,
      container_20ft_qty, container_20ft_weight, container_20ft_cbm,
      container_40fthc_qty, container_40fthc_weight, container_40fthc_cbm
    `)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (!product) {
    notFound();
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", product.brand_id)
    .single();

  const { data: images } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .eq("product_id", id)
    .order("position", { ascending: true });

  const { data: videos } = await supabase
    .from("product_videos")
    .select("id, storage_path, video_url, position")
    .eq("product_id", id)
    .order("position", { ascending: true });

  const { data: certificates } = await supabase
    .from("product_certificates")
    .select("id, certificate_type, storage_path, original_filename, version")
    .eq("product_id", id)
    .eq("is_current", true)
    .order("created_at", { ascending: true });

  const imageRows = images ?? [];
  const imageUrls = await Promise.all(
    imageRows.map((img) => getSignedFileUrl(img.storage_path))
  );

  const videoRows = (videos ?? []) as ProductVideo[];
  const videoUrls = await Promise.all(
    videoRows.map(async (v) => {
      if (v.storage_path) {
        try {
          return await getSignedFileUrl(v.storage_path);
        } catch {
          return null;
        }
      }
      return v.video_url || null;
    })
  );

  const certificateRows = certificates ?? [];
  const certificateUrls = await Promise.all(
    certificateRows.map((cert) => getSignedFileUrl(cert.storage_path))
  );

  return (
    <ProductDetailTabs
      product={product as unknown as Product}
      brandName={brand?.name ?? "(미확인 브랜드)"}
      imageRows={imageRows}
      imageUrls={imageUrls}
      videoRows={videoRows}
      videoUrls={videoUrls}
      certificateRows={certificateRows}
      certificateUrls={certificateUrls}
    />
  );
}

