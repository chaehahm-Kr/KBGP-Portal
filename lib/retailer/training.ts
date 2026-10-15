import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";

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
  trainingStatus: "published" | "preparing" | "unavailable";
  trainingStatusLabel: string;
  canStartTraining: boolean;
}

export interface EnrichedMediaAsset {
  id: string;
  assetType: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  status: string;
}

export interface TrainingQuizQuestion {
  id?: string;
  category?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TrainingQuizQuestionClient {
  id?: string;
  category?: string;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface CustomerObjection {
  id: string;
  objection: string;
  answer: string;
}

export interface TrainingProductDetail extends TrainingProductSummary {
  trainingSummary: string;
  targetCustomer: string | null;
  keyBenefits: string[];
  howToUse: string;
  keyIngredients: string;
  pitch15s: string | null;
  sellingPoints: string[];
  customerObjections: CustomerObjection[];
  importantNotes: string | null;
  storageHandlingSop: string | null;
  quizQuestions: TrainingQuizQuestionClient[];
  videoUrl: string | null;
  mediaAssets: EnrichedMediaAsset[];
  benefitGraphicUrl: string | null;
  infographicUrl: string | null;
  lifestyleImageUrl: string | null;
  howToGraphicUrl: string | null;
  hasVideo: boolean;
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
  availableCount: number;
  completedCount: number;
  toLearnCount: number;
  percent: number;
}

/**
 * Fetch Store-specific or Company-Wide Training Products list for authenticated user
 * Incorporates the authoritative Union Set (Active Store Products + Valid Orders + Counted Weekly Checks)
 */
export async function getRetailerTrainingProducts(filters: {
  storeId?: string;
  search?: string;
  statusFilter?: "all" | "completed" | "not_completed";
} = {}): Promise<{
  products: TrainingProductSummary[];
  stats: TrainingProgressStats;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string;
  userRole: string;
}> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId || stores.length === 0) {
    return {
      products: [],
      stats: { totalCount: 0, availableCount: 0, completedCount: 0, toLearnCount: 0, percent: 0 },
      stores: [],
      selectedStoreId: "all",
      userRole: userRole || "employee",
    };
  }

  // Determine active store view: default is "all"
  const isAllStores = !filters.storeId || filters.storeId === "all";
  const selectedStoreId = isAllStores
    ? "all"
    : stores.some((s: { id: string }) => s.id === filters.storeId)
    ? filters.storeId!
    : "all";

  // 1. Fetch store assortment union set (retailer_store_products + valid retailer_orders + submitted weekly checks)
  const storeAssortmentIds = new Set<string>();

  // A. Active store assortment products
  try {
    let spQuery = adminClient
      .from("retailer_store_products")
      .select("product_id")
      .eq("company_id", companyId)
      .eq("is_active", true);

    if (selectedStoreId !== "all") {
      spQuery = spQuery.eq("store_id", selectedStoreId);
    }

    const { data: storeProducts } = await spQuery;
    (storeProducts || []).forEach((sp) => {
      if (sp.product_id) storeAssortmentIds.add(sp.product_id);
    });
  } catch (err) {
    console.warn("Error fetching store products for training:", err);
  }

  // B. Products from valid non-cancelled orders for this company & store
  try {
    let ordQuery = adminClient
      .from("retailer_orders")
      .select(`
        id,
        store_id,
        order_status,
        retailer_order_items (
          product_id
        )
      `)
      .eq("company_id", companyId)
      .in("order_status", ["confirmed", "processing", "partially_shipped", "shipped", "delivered"]);

    if (selectedStoreId !== "all") {
      ordQuery = ordQuery.eq("store_id", selectedStoreId);
    }

    const { data: storeOrders } = await ordQuery;
    (storeOrders || []).forEach((order) => {
      const items = (order.retailer_order_items as any[]) || [];
      items.forEach((it) => {
        if (it.product_id) storeAssortmentIds.add(it.product_id);
      });
    });
  } catch (err) {
    console.warn("Error fetching store orders for training:", err);
  }

  // C. Products counted in submitted weekly checks for this company & store
  try {
    let chkQuery = adminClient
      .from("retailer_weekly_checks")
      .select(`
        id,
        store_id,
        retailer_weekly_check_items (
          product_id,
          is_counted
        )
      `)
      .eq("company_id", companyId)
      .eq("status", "submitted");

    if (selectedStoreId !== "all") {
      chkQuery = chkQuery.eq("store_id", selectedStoreId);
    }

    const { data: checks } = await chkQuery;
    (checks || []).forEach((c) => {
      const items = (c.retailer_weekly_check_items as any[]) || [];
      items.forEach((it) => {
        if (it.is_counted && it.product_id) {
          storeAssortmentIds.add(it.product_id);
        }
      });
    });
  } catch (err) {
    console.warn("Error fetching weekly checks for training:", err);
  }

  const productIds = Array.from(storeAssortmentIds);

  if (productIds.length === 0) {
    return {
      products: [],
      stats: { totalCount: 0, availableCount: 0, completedCount: 0, toLearnCount: 0, percent: 0 },
      stores,
      selectedStoreId,
      userRole,
    };
  }

  // 2. Fetch candidate products with brand and pricing details
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
      )
    `)
    .in("id", productIds)
    .neq("status", "discontinued");

  if (error || !rawProducts) {
    return {
      products: [],
      stats: { totalCount: 0, availableCount: 0, completedCount: 0, toLearnCount: 0, percent: 0 },
      stores,
      selectedStoreId,
      userRole,
    };
  }

  // 3. Fetch training content rows for all these products
  const trainingContentMap = new Map<string, any>();
  try {
    const { data: tcRows } = await adminClient
      .from("retailer_product_training_content")
      .select("*")
      .in("product_id", productIds);

    if (tcRows) {
      tcRows.forEach((r) => trainingContentMap.set(r.product_id, r));
    }
  } catch {
    // ignore
  }

  // 4. Fetch user's completion progress for these products
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

  // 5. Authoritative Image Resolution & Training Product Summaries
  const imageMap = await resolveAuthoritativeProductImages(adminClient, productIds);
  const allSummaries: TrainingProductSummary[] = [];

  for (const p of rawProducts) {
    const info = (p.price_additional_info as any) || {};
    // Note: Do not drop products on brand-portal soft-delete (info.deleted_at),
    // because historical retailer purchases and store inventory remain company-eligible learning assets.
    if ((p as any).deleted_at) continue;

    const overrides = info.admin_overrides || {};
    const brand = (p.brands as any) || {};
    const brandName = brand.name || "K SELECT";

    const effectiveSku =
      resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
      "KS-PROD";

    const thumbnailUrl = imageMap[p.id]?.primaryUrl || null;
    const isCompleted = userProgressMap.has(p.id);
    const completedAt = userProgressMap.get(p.id) || null;

    // Determine Training Status
    const tc = trainingContentMap.get(p.id);
    const draftInPrice = info.training_draft;

    let trainingStatus: "published" | "preparing" | "unavailable" = "unavailable";
    let trainingStatusLabel = "Training Not Available Yet";
    let canStartTraining = false;

    if (tc && tc.is_published === true && tc.status === "published") {
      trainingStatus = "published";
      trainingStatusLabel = "Published";
      canStartTraining = true;
    } else if (
      (tc && (tc.status === "draft" || tc.status === "in_review" || !tc.is_published)) ||
      draftInPrice
    ) {
      trainingStatus = "preparing";
      trainingStatusLabel = "Training Preparing";
      canStartTraining = false; // Strictly locked for Retailer Portal
    }

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
      trainingStatus,
      trainingStatusLabel,
      canStartTraining,
    });
  }

  // Calculate overall stats for this view
  const totalCount = allSummaries.length;
  const availableCount = allSummaries.filter((p) => p.trainingStatus === "published").length;
  const completedCount = allSummaries.filter((p) => p.trainingStatus === "published" && p.isCompleted).length;
  const toLearnCount = availableCount - completedCount;
  const percent = availableCount > 0 ? Math.round((completedCount / availableCount) * 100) : 0;

  // 6. Apply search and status filters
  let filtered = allSummaries;

  if (filters.search && filters.search.trim()) {
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
    // Only published trainings that are not yet completed
    filtered = filtered.filter((p) => p.trainingStatus === "published" && !p.isCompleted);
  }

  return {
    products: filtered,
    stats: {
      totalCount,
      availableCount,
      completedCount,
      toLearnCount,
      percent,
    },
    stores,
    selectedStoreId,
    userRole,
  };
}

/**
 * Fetch detailed training module for a specific product
 * Enriched with approved Media Assets, 7 structured sections, and Quiz
 */
export async function getRetailerTrainingDetail(
  productId: string,
  storeId?: string,
  isAdminPreview: boolean = false
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
      how_to_use,
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

  // 2. Fetch training content from retailer_product_training_content
  let tc: any = null;
  try {
    const { data } = await adminClient
      .from("retailer_product_training_content")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    tc = data;
  } catch (err) {
    console.warn("Error fetching retailer training content:", err);
  }

  const isPublished = tc?.is_published === true && tc?.status === "published";

  // STRICT PUBLICATION SECURITY ENFORCEMENT:
  // Non-admin Retailer Portal sessions are strictly forbidden from accessing Draft / In-Review content.
  if (!isAdminPreview && !isPublished) {
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

  // Populate training content fields
  let trainingSummary = overrides.description || p.description || "Comprehensive K-Beauty product training guide.";
  let targetCustomer: string | null = null;
  let keyBenefits = defaultBulletPoints.filter(Boolean);
  let howToUse = overrides.how_to_use || (p as any).how_to_use || "Apply as directed on product packaging. Use morning and night for best results.";
  let keyIngredients = p.ingredients_text || "Formulated with premium Korean botanical extracts.";
  let pitch15s: string | null = "Recommend this clean K-Beauty staple for proven daily skin barrier hydration.";
  let sellingPoints: string[] = [
    "High customer satisfaction and gentle daily formulation",
    "Clean K-Beauty quality with proven consumer demand",
    "Great cross-sell addition to any daily routine",
  ];
  let customerObjections: CustomerObjection[] = [];
  let storageHandlingSop: string | null = "Store at room temperature (15–25°C / 59–77°F). Keep away from direct sunlight.";
  let importantNotes: string | null = "For external use only. Store in a cool, dry place away from direct sunlight.";
  let rawQuizQuestions: TrainingQuizQuestion[] = [];
  let videoUrl: string | null = null;
  let trainingStatus: "published" | "preparing" | "unavailable" = isPublished ? "published" : "preparing";
  let trainingStatusLabel = isPublished ? "Published" : "Training Preparing";

  if (tc) {
    if (tc.training_summary) trainingSummary = tc.training_summary;
    if (tc.target_customer) targetCustomer = tc.target_customer;
    if (Array.isArray(tc.key_benefits) && tc.key_benefits.length > 0) keyBenefits = tc.key_benefits;
    if (tc.how_to_use) howToUse = tc.how_to_use;
    if (tc.key_ingredients) keyIngredients = tc.key_ingredients;
    if (tc.pitch_15s) pitch15s = tc.pitch_15s;
    if (Array.isArray(tc.selling_points) && tc.selling_points.length > 0) sellingPoints = tc.selling_points;
    if (Array.isArray(tc.customer_objections) && tc.customer_objections.length > 0) customerObjections = tc.customer_objections;
    if (tc.storage_handling_sop) storageHandlingSop = tc.storage_handling_sop;
    if (tc.important_notes) importantNotes = tc.important_notes;
    if (Array.isArray(tc.quiz_questions) && tc.quiz_questions.length > 0) rawQuizQuestions = tc.quiz_questions;
    if (tc.video_url) videoUrl = tc.video_url;
  }

  // Admin preview draft fallback
  if (isAdminPreview) {
    const draft = info.training_draft;
    if (draft) {
      if (!tcSummaryHasContent(trainingSummary) && draft.productOverview) trainingSummary = draft.productOverview;
      if ((!targetCustomer || targetCustomer === "") && draft.bestFor) targetCustomer = draft.bestFor;
      if (keyBenefits.length === 0 && Array.isArray(draft.top3Benefits) && draft.top3Benefits.length > 0) {
        keyBenefits = draft.top3Benefits;
      }
      if ((!howToUse || howToUse.includes("as directed")) && draft.howToUse) howToUse = draft.howToUse;
      if ((!pitch15s || pitch15s.includes("Recommend this")) && draft.pitch15s) pitch15s = draft.pitch15s;
      if (sellingPoints.length <= 3 && Array.isArray(draft.sellingPoints) && draft.sellingPoints.length > 0) {
        sellingPoints = draft.sellingPoints;
      }
      if (customerObjections.length === 0 && Array.isArray(draft.customerObjections)) {
        customerObjections = draft.customerObjections;
      }
      if ((!storageHandlingSop || storageHandlingSop.includes("room temperature")) && draft.storageHandlingSop) {
        storageHandlingSop = draft.storageHandlingSop;
      }
      if (rawQuizQuestions.length === 0 && Array.isArray(draft.quizQuestions) && draft.quizQuestions.length > 0) {
        rawQuizQuestions = draft.quizQuestions;
      }
    }
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

  // 5. Query and sign Media Assets: ONLY APPROVED ASSETS (strictly exclude draft/failed/rejected)
  const mediaAssets: EnrichedMediaAsset[] = [];
  let benefitGraphicUrl: string | null = null;
  let infographicUrl: string | null = null;
  let lifestyleImageUrl: string | null = null;
  let howToGraphicUrl: string | null = null;
  let hasVideo = !!videoUrl;

  try {
    const { data: dbAssets } = await adminClient
      .from("product_media_assets")
      .select("id, asset_type, title, status, storage_path, content_data")
      .eq("product_id", productId)
      .eq("status", "approved")
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false });

    if (dbAssets && dbAssets.length > 0) {
      for (const item of dbAssets) {
        let signedUrl = "";
        if (item.storage_path) {
          try {
            const { data: sData } = await adminClient.storage
              .from("company-uploads")
              .createSignedUrl(item.storage_path, 7200);
            signedUrl = sData?.signedUrl || "";
          } catch {
            // ignore
          }
        }

        if (signedUrl) {
          mediaAssets.push({
            id: item.id,
            assetType: item.asset_type,
            title: item.title,
            url: signedUrl,
            status: item.status,
          });

          if (item.asset_type === "benefit_graphic" && !benefitGraphicUrl) {
            benefitGraphicUrl = signedUrl;
          } else if (item.asset_type === "infographic" && !infographicUrl) {
            infographicUrl = signedUrl;
          } else if (item.asset_type === "lifestyle_image" && !lifestyleImageUrl) {
            lifestyleImageUrl = signedUrl;
          } else if (item.asset_type === "how_to_graphic" && !howToGraphicUrl) {
            howToGraphicUrl = signedUrl;
          } else if (item.asset_type === "product_video" || item.asset_type === "how_to_video") {
            hasVideo = true;
            if (!videoUrl) videoUrl = signedUrl;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Error fetching media assets for training detail:", err);
  }

  // 6. Map quiz questions to client-safe representation (omit correctIndex and explanation for security)
  const clientQuizQuestions: TrainingQuizQuestionClient[] = rawQuizQuestions.map((q, idx) => ({
    id: q.id || `q_${idx + 1}`,
    category: q.category,
    question: q.question,
    options: q.options || [],
  }));

  // 7. Calculate previous/next product in current Store assortment union set
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
    trainingStatus,
    trainingStatusLabel,
    canStartTraining: isPublished,
    trainingSummary,
    targetCustomer,
    keyBenefits,
    howToUse,
    keyIngredients,
    pitch15s,
    sellingPoints,
    customerObjections,
    importantNotes,
    storageHandlingSop,
    quizQuestions: clientQuizQuestions,
    videoUrl,
    mediaAssets,
    benefitGraphicUrl,
    infographicUrl,
    lifestyleImageUrl,
    howToGraphicUrl,
    hasVideo,
    images,
    prevProductId,
    nextProductId,
    currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
    totalCount: totalCount > 0 ? totalCount : 1,
  };
}

function tcSummaryHasContent(summary: string): boolean {
  return summary !== "" && !summary.includes("Comprehensive K-Beauty product training guide.");
}

export interface QuizQuestionGradeResult {
  questionIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizSubmissionResponse {
  success: boolean;
  passed: boolean;
  score: number;
  total: number;
  results: QuizQuestionGradeResult[];
  completedAt?: string;
  error?: string;
}

/**
 * Server-authoritative assessment quiz grading
 * Requires 100% correct to pass and mark verified completion.
 * Never leaks the correct-answer keys before server evaluation.
 */
export async function submitRetailerQuiz(
  productId: string,
  userAnswers: Record<number, number>
): Promise<QuizSubmissionResponse> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;
  if (!companyId) {
    return {
      success: false,
      passed: false,
      score: 0,
      total: 0,
      results: [],
      error: "Company membership not found",
    };
  }

  // Fetch authoritative published training content
  const { data: tc, error } = await adminClient
    .from("retailer_product_training_content")
    .select("status, is_published, version, quiz_questions")
    .eq("product_id", productId)
    .maybeSingle();

  if (error || !tc || tc.status !== "published" || tc.is_published !== true) {
    return {
      success: false,
      passed: false,
      score: 0,
      total: 0,
      results: [],
      error: "Published training assessment not found for this product.",
    };
  }

  const authoritativeQuestions: TrainingQuizQuestion[] = Array.isArray(tc.quiz_questions)
    ? (tc.quiz_questions as any[])
    : [];

  if (authoritativeQuestions.length === 0) {
    return {
      success: false,
      passed: false,
      score: 0,
      total: 0,
      results: [],
      error: "No assessment quiz configured for this product.",
    };
  }

  const results: QuizQuestionGradeResult[] = [];
  let correctCount = 0;

  for (let i = 0; i < authoritativeQuestions.length; i++) {
    const q = authoritativeQuestions[i];
    const selected = userAnswers[i];
    const isCorrect = typeof selected === "number" && selected === q.correctIndex;
    if (isCorrect) correctCount++;

    results.push({
      questionIndex: i,
      isCorrect,
      explanation: q.explanation || "Please review the product study guide for more details.",
    });
  }

  const total = authoritativeQuestions.length;
  const passed = correctCount === total;

  let completedAt: string | undefined;

  if (passed) {
    completedAt = new Date().toISOString();
    // Persist verified completion in retailer_product_training_progress
    try {
      const { error: upsertErr } = await adminClient
        .from("retailer_product_training_progress")
        .upsert(
          {
            company_id: companyId,
            user_id: session.userId,
            product_id: productId,
            status: "completed",
            completed_at: completedAt,
            updated_at: completedAt,
          },
          { onConflict: "user_id,product_id" }
        );

      if (upsertErr) {
        console.error("Error saving verified training completion:", upsertErr);
      }
    } catch (err) {
      console.error("Exception saving verified training progress:", err);
    }
  }

  return {
    success: true,
    passed,
    score: correctCount,
    total,
    results,
    completedAt,
  };
}

/**
 * Toggle user training completion for a product.
 * STRICT SECURITY: If a product has a published quiz, manual self-reporting bypass is forbidden.
 */
export async function toggleRetailerTrainingCompletion(
  productId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // If marking complete, check if the product has a published quiz requirement
  if (completed) {
    const { data: tc } = await adminClient
      .from("retailer_product_training_content")
      .select("status, is_published, quiz_questions")
      .eq("product_id", productId)
      .maybeSingle();

    if (tc && tc.is_published && Array.isArray(tc.quiz_questions) && tc.quiz_questions.length > 0) {
      return {
        success: false,
        error: "This product requires passing the verified knowledge assessment quiz.",
      };
    }
  }

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
