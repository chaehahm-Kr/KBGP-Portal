import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";

export interface TrainingProductSummary {
  id: string;
  name: string;
  nameEn: string | null;
  brandId: string;
  brandName: string;
  sku: string;
  category: string;
  categoryLabel: string;
  origin: string;
  volume: string | null;
  thumbnailUrl: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface TrainingProductDetail extends TrainingProductSummary {
  trainingSummary: string;
  targetCustomer: string | null;
  keyBenefits: string[];
  howToUse: string;
  keyIngredients: string;
  sellingPoints: string[];
  importantNotes: string | null;
  videoUrl: string | null;
  images: Array<{
    id: string;
    url: string;
    position: number;
  }>;
  nextProductId: string | null;
  prevProductId: string | null;
  currentIndex: number;
  totalCount: number;
}

export interface TrainingProgressStats {
  totalCount: number;
  completedCount: number;
  percent: number;
}

/**
 * Fetch Store-specific Training Products list for authenticated user
 */
export async function getRetailerTrainingProducts(filters: {
  storeId?: string;
  search?: string;
  statusFilter?: "all" | "completed" | "not_completed";
} = {}): Promise<{
  products: TrainingProductSummary[];
  stats: TrainingProgressStats;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  userRole: string;
}> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId || stores.length === 0) {
    return {
      products: [],
      stats: { totalCount: 0, completedCount: 0, percent: 0 },
      stores: [],
      selectedStoreId: null,
      userRole: userRole || "employee",
    };
  }

  // Determine active store
  const selectedStoreId =
    filters.storeId && stores.some((s: { id: string }) => s.id === filters.storeId)
      ? filters.storeId
      : stores[0].id;

  // 1. Fetch store assortment from retailer_store_products
  let productIds: string[] = [];
  try {
    const { data: storeProducts } = await adminClient
      .from("retailer_store_products")
      .select("product_id")
      .eq("store_id", selectedStoreId)
      .eq("is_active", true);

    if (storeProducts && storeProducts.length > 0) {
      productIds = storeProducts.map((sp) => sp.product_id);
    }
  } catch (err) {
    console.warn("Error fetching store products for training:", err);
  }

  if (productIds.length === 0) {
    return {
      products: [],
      stats: { totalCount: 0, completedCount: 0, percent: 0 },
      stores,
      selectedStoreId,
      userRole,
    };
  }

  // 2. Fetch candidate products with images, brand, overrides
  const { data: rawProducts, error } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      category_code,
      letusto_sku,
      manufacture_sku,
      origin,
      volume,
      status,
      price_additional_info,
      created_at,
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
    .in("id", productIds)
    .neq("status", "discontinued");

  if (error || !rawProducts) {
    return {
      products: [],
      stats: { totalCount: 0, completedCount: 0, percent: 0 },
      stores,
      selectedStoreId,
      userRole,
    };
  }

  // 3. Fetch user's completion progress for these products
  const userProgressMap = new Map<string, string>(); // product_id -> completed_at
  try {
    const { data: progressRows } = await adminClient
      .from("retailer_product_training_progress")
      .select("product_id, completed_at, status")
      .eq("user_id", session.userId)
      .eq("status", "completed");

    if (progressRows) {
      progressRows.forEach((r) => {
        userProgressMap.set(r.product_id, r.completed_at);
      });
    }
  } catch {
    // table might be pending migration or empty
  }

  // 4. Map and sign thumbnail images
  const allSummaries: TrainingProductSummary[] = [];

  for (const p of rawProducts) {
    const info = (p.price_additional_info as any) || {};
    if (info.deleted_at || (p as any).deleted_at) continue;

    const overrides = info.admin_overrides || {};
    const brand = (p.brands as any) || {};
    const brandName = brand.name || "K SELECT";

    const effectiveSku =
      resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
      "KS-PROD";

    // Primary image
    const rawImages = (p.product_images as any[]) || [];
    const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    let thumbnailUrl: string | null = null;

    if (sortedImages.length > 0 && sortedImages[0].storage_path) {
      try {
        const { data: signed } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(sortedImages[0].storage_path, 7200);
        thumbnailUrl = signed?.signedUrl || null;
      } catch {
        // ignore
      }
    }

    const isCompleted = userProgressMap.has(p.id);
    const completedAt = userProgressMap.get(p.id) || null;

    allSummaries.push({
      id: p.id,
      name: overrides.name?.trim() || p.name,
      nameEn: overrides.name_en?.trim() || p.name_en || null,
      brandId: brand.id || "",
      brandName,
      sku: effectiveSku,
      category: p.category || "skincare",
      categoryLabel: formatCategoryName(p.category || p.category_code),
      origin: overrides.origin || p.origin || "Republic of Korea",
      volume: overrides.volume || p.volume || null,
      thumbnailUrl,
      isCompleted,
      completedAt,
    });
  }

  // Calculate overall stats for this store assortment
  const totalCount = allSummaries.length;
  const completedCount = allSummaries.filter((p) => p.isCompleted).length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 5. Apply search and status filters
  let filtered = allSummaries;

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.brandName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }

  if (filters.statusFilter === "completed") {
    filtered = filtered.filter((p) => p.isCompleted);
  } else if (filters.statusFilter === "not_completed") {
    filtered = filtered.filter((p) => !p.isCompleted);
  }

  return {
    products: filtered,
    stats: { totalCount, completedCount, percent },
    stores,
    selectedStoreId,
    userRole,
  };
}

/**
 * Fetch detailed training module for a specific product
 */
export async function getRetailerTrainingDetail(
  productId: string,
  storeId?: string
): Promise<TrainingProductDetail | null> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch Product Master info
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

  if (error || !p) return null;

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

  // Parse default bullet points
  let defaultBulletPoints: string[] = [];
  if (Array.isArray(overrides.bullet_points)) {
    defaultBulletPoints = overrides.bullet_points;
  } else if (Array.isArray(p.bullet_points)) {
    defaultBulletPoints = p.bullet_points;
  } else if (typeof p.bullet_points === "string") {
    try {
      const parsed = JSON.parse(p.bullet_points);
      if (Array.isArray(parsed)) defaultBulletPoints = parsed;
    } catch {
      defaultBulletPoints = [p.bullet_points];
    }
  }

  // 2. Fetch enriched training content from retailer_product_training_content (if available)
  let trainingSummary = overrides.description || p.description || "Comprehensive K-Beauty product training guide.";
  let targetCustomer: string | null = null;
  let keyBenefits = defaultBulletPoints.filter(Boolean);
  let howToUse = "Apply as directed on product packaging. Use morning and night for best results.";
  let keyIngredients = p.ingredients_text || "Formulated with premium Korean botanical extracts.";
  let sellingPoints: string[] = [
    "High customer satisfaction and gentle daily formulation",
    "Clean K-Beauty quality with proven consumer demand",
    "Great cross-sell addition to any daily routine"
  ];
  let importantNotes: string | null = "For external use only. Store in a cool, dry place away from direct sunlight.";
  let videoUrl: string | null = null;

  try {
    const { data: tc } = await adminClient
      .from("retailer_product_training_content")
      .select("*")
      .eq("product_id", productId)
      .eq("is_published", true)
      .maybeSingle();

    if (tc) {
      if (tc.training_summary) trainingSummary = tc.training_summary;
      if (tc.target_customer) targetCustomer = tc.target_customer;
      if (Array.isArray(tc.key_benefits) && tc.key_benefits.length > 0) keyBenefits = tc.key_benefits;
      if (tc.how_to_use) howToUse = tc.how_to_use;
      if (tc.key_ingredients) keyIngredients = tc.key_ingredients;
      if (Array.isArray(tc.selling_points) && tc.selling_points.length > 0) sellingPoints = tc.selling_points;
      if (tc.important_notes) importantNotes = tc.important_notes;
      if (tc.video_url) videoUrl = tc.video_url;
    }
  } catch {
    // training content table might not exist yet; fallbacks used
  }

  // 3. User completion progress
  let isCompleted = false;
  let completedAt: string | null = null;
  try {
    const { data: progress } = await adminClient
      .from("retailer_product_training_progress")
      .select("completed_at, status")
      .eq("user_id", session.userId)
      .eq("product_id", productId)
      .eq("status", "completed")
      .maybeSingle();

    if (progress) {
      isCompleted = true;
      completedAt = progress.completed_at;
    }
  } catch {
    // ignore
  }

  // 4. Sign product images
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

  // 5. Calculate previous/next product in current Store assortment
  const { products: storeProducts } = await getRetailerTrainingProducts({ storeId });
  const currentIndex = storeProducts.findIndex((sp) => sp.id === productId);
  const totalCount = storeProducts.length;

  const prevProductId = currentIndex > 0 ? storeProducts[currentIndex - 1].id : null;
  const nextProductId = currentIndex >= 0 && currentIndex < totalCount - 1 ? storeProducts[currentIndex + 1].id : null;

  return {
    id: p.id,
    name: overrides.name?.trim() || p.name,
    nameEn: overrides.name_en?.trim() || p.name_en || null,
    brandId: brand.id || "",
    brandName,
    sku: effectiveSku,
    category: p.category || "skincare",
    categoryLabel: formatCategoryName(p.category || p.category_code),
    origin: overrides.origin || p.origin || "Republic of Korea",
    volume: overrides.volume || p.volume || null,
    thumbnailUrl: images[0]?.url || null,
    isCompleted,
    completedAt,
    trainingSummary,
    targetCustomer,
    keyBenefits,
    howToUse,
    keyIngredients,
    sellingPoints,
    importantNotes,
    videoUrl,
    images,
    prevProductId,
    nextProductId,
    currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
    totalCount: totalCount > 0 ? totalCount : 1,
  };
}

/**
 * Toggle user training completion for a product
 */
export async function toggleRetailerTrainingCompletion(
  productId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;
  if (!companyId) return { success: false, error: "Company membership not found" };

  try {
    if (completed) {
      const { error } = await adminClient
        .from("retailer_product_training_progress")
        .upsert(
          {
            company_id: companyId,
            user_id: session.userId,
            product_id: productId,
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,product_id" }
        );

      if (error) throw error;
    } else {
      const { error } = await adminClient
        .from("retailer_product_training_progress")
        .delete()
        .eq("user_id", session.userId)
        .eq("product_id", productId);

      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error toggling training progress:", err);
    return { success: false, error: err.message || "Failed to update training progress" };
  }
}
