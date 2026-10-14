import "server-only";
import { type SupabaseClient } from "@supabase/supabase-js";

export interface AuthoritativeProductImageResult {
  primaryUrl: string | null;
  galleryUrls: string[];
}

export type AuthoritativeProductImageMap = Record<string, AuthoritativeProductImageResult>;

/**
 * Authoritative Image Resolver for Retailer Portal (Catalog, Detail, Cart, Checkout)
 * 
 * Priority Rules:
 * 1. Product Catalog Main / Representative Image (lowest position in product_images, position: 0)
 * 2. First valid Product Gallery Images (position: 1, 2, ... in product_images)
 * 3. Existing valid product thumbnail/image fallback in products table (price_additional_info)
 * 4. Graceful null (placeholder) when no valid image exists
 * 
 * Image URLs are signed with 24 hours (86,400s) validity to prevent stale/broken URLs in cart sessions.
 */
// In-memory cache for signed storage paths to guarantee stable URLs across requests
// storagePath -> { signedUrl: string, expiresAt: number }
const signedUrlCache = new Map<string, { signedUrl: string; expiresAt: number }>();

async function getOrSignStoragePath(client: SupabaseClient, storagePath: string): Promise<string | null> {
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  const now = Date.now();
  const cached = signedUrlCache.get(storagePath);
  // If cached and still valid for at least 1 hour (3600 seconds)
  if (cached && cached.expiresAt - now > 3600 * 1000) {
    return cached.signedUrl;
  }

  try {
    const { data: signed } = await client.storage
      .from("company-uploads")
      .createSignedUrl(storagePath, 86400); // 24 hours validity

    if (signed?.signedUrl) {
      signedUrlCache.set(storagePath, {
        signedUrl: signed.signedUrl,
        expiresAt: now + 86400 * 1000,
      });
      return signed.signedUrl;
    }
  } catch (err) {
    console.warn(`[resolveAuthoritativeProductImages] Failed to sign image path ${storagePath}:`, err);
  }
  return null;
}

export async function resolveAuthoritativeProductImages(
  client: SupabaseClient,
  productIds: string[]
): Promise<AuthoritativeProductImageMap> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  // 1. Query product_images table (authoritative primary and gallery images)
  const { data: rawImages, error: imgError } = await client
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .in("product_id", uniqueIds);

  if (imgError) {
    console.error("[resolveAuthoritativeProductImages] Error querying product_images:", imgError);
  }

  const imagesByProd = new Map<string, Array<{ storage_path: string; position: number }>>();
  for (const img of rawImages || []) {
    if (!img.storage_path) continue;
    const list = imagesByProd.get(img.product_id) || [];
    list.push({
      storage_path: img.storage_path,
      position: img.position ?? 0,
    });
    imagesByProd.set(img.product_id, list);
  }

  // 2. Identify any products with no product_images records to query fallback from products table
  const missingProductIds = uniqueIds.filter(
    (id) => !imagesByProd.has(id) || (imagesByProd.get(id) || []).length === 0
  );

  const fallbackImagesByProd = new Map<string, string[]>();
  if (missingProductIds.length > 0) {
    const { data: fallbackProds, error: fbError } = await client
      .from("products")
      .select("id, price_additional_info")
      .in("id", missingProductIds);

    if (!fbError && fallbackProds) {
      for (const fp of fallbackProds) {
        const fallbacks: string[] = [];
        const info = (fp.price_additional_info as any) || {};
        const overrides = info.admin_overrides || {};
        if (typeof overrides.thumbnail_url === "string" && overrides.thumbnail_url) {
          fallbacks.push(overrides.thumbnail_url);
        }
        if (Array.isArray(overrides.images)) {
          for (const imgPath of overrides.images) {
            if (typeof imgPath === "string" && imgPath) fallbacks.push(imgPath);
          }
        }
        if (fallbacks.length > 0) {
          fallbackImagesByProd.set(fp.id, fallbacks);
        }
      }
    }
  }

  // 3. Sign storage paths and construct authoritative image map using cached signed URLs
  const resultMap: AuthoritativeProductImageMap = {};

  for (const pid of uniqueIds) {
    const prodImgs = imagesByProd.get(pid) || [];
    // Sort ascending by position: position 0 is main/representative, position 1, 2... are gallery
    prodImgs.sort((a, b) => a.position - b.position);

    const signedUrls: string[] = [];

    // Sign product_images items
    for (const img of prodImgs) {
      const url = await getOrSignStoragePath(client, img.storage_path);
      if (url) {
        signedUrls.push(url);
      }
    }

    // If no valid images from product_images, check fallback
    if (signedUrls.length === 0) {
      const fbPaths = fallbackImagesByProd.get(pid) || [];
      for (const fbPath of fbPaths) {
        const url = await getOrSignStoragePath(client, fbPath);
        if (url) {
          signedUrls.push(url);
        }
      }
    }

    resultMap[pid] = {
      primaryUrl: signedUrls.length > 0 ? signedUrls[0] : null,
      galleryUrls: signedUrls,
    };
  }

  return resultMap;
}
