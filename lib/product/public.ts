import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";

export interface PublicProductDetail {
  id: string;
  name: string;
  nameEn: string | null;
  brandName: string;
  sku: string;
  category: string;
  categoryLabel: string;
  origin: string;
  volume: string | null;
  description: string | null;
  bulletPoints: string[];
  ingredientsText: string | null;
  images: Array<{
    id: string;
    url: string;
    position: number;
  }>;
}

/**
 * Fetch strictly public, sanitized product information for public QR landing page
 * Absolutely NO wholesale prices, supplier FOB, internal notes, or retailer data
 */
export async function getPublicProductDetail(productId: string): Promise<PublicProductDetail | null> {
  const adminClient = createAdminClient();

  const { data: p, error } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      description,
      bullet_points,
      ingredients_text,
      category,
      category_code,
      letusto_sku,
      manufacture_sku,
      origin,
      volume,
      status,
      price_additional_info,
      brands (
        id,
        name
      ),
      product_images (
        id,
        storage_path,
        position
      )
    `)
    .eq("id", productId)
    .maybeSingle();

  if (error || !p) {
    return null;
  }

  const info = (p.price_additional_info as any) || {};
  if (info.deleted_at || (p as any).deleted_at || p.status === "discontinued") {
    return null;
  }

  const overrides = info.admin_overrides || {};
  const brand = (p.brands as any) || {};
  const brandName = brand.name || "K SELECT";

  const effectiveSku =
    resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
    resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
    "KS-PROD";

  // Parse bullet points
  let bulletPoints: string[] = [];
  if (Array.isArray(overrides.bullet_points)) {
    bulletPoints = overrides.bullet_points;
  } else if (Array.isArray(p.bullet_points)) {
    bulletPoints = p.bullet_points;
  } else if (typeof p.bullet_points === "string") {
    try {
      const parsed = JSON.parse(p.bullet_points);
      if (Array.isArray(parsed)) bulletPoints = parsed;
    } catch {
      bulletPoints = [p.bullet_points];
    }
  }

  // Sign public images
  const rawImages = (p.product_images as any[]) || [];
  const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const images: Array<{ id: string; url: string; position: number }> = [];

  for (const img of sortedImages) {
    if (img.storage_path) {
      try {
        const { data: signed } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(img.storage_path, 7200);
        if (signed?.signedUrl) {
          images.push({
            id: img.id,
            url: signed.signedUrl,
            position: img.position ?? 0,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    id: p.id,
    name: overrides.name?.trim() || p.name,
    nameEn: overrides.name_en?.trim() || p.name_en || null,
    brandName,
    sku: effectiveSku,
    category: p.category || "skincare",
    categoryLabel: formatCategoryName(p.category || p.category_code),
    origin: overrides.origin || p.origin || "Republic of Korea",
    volume: overrides.volume || p.volume || null,
    description: overrides.description || p.description || null,
    bulletPoints: bulletPoints.filter(Boolean),
    ingredientsText: p.ingredients_text || null,
    images,
  };
}
