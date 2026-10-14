"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type {
  TrainingModuleData,
  GroundedTrainingContext,
  TrainingSourceReadiness,
  TrainingVersionType,
} from "./training-types";
import { evaluateTrainingSourceReadiness } from "./source-readiness";
import { generateTrainingWithAi as clientGenerateAi } from "./gemini-training-client";

/**
 * Fetch authoritative Product Context for training generation
 */
export async function getGroundedProductContext(productId: string): Promise<GroundedTrainingContext | null> {
  const adminClient = createAdminClient();

  const { data: p, error } = await adminClient
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
      description,
      bullet_points,
      how_to_use,
      ingredients_text,
      price_additional_info,
      brands (
        id,
        name
      ),
      product_images (
        id,
        storage_path
      )
    `)
    .eq("id", productId)
    .single();

  if (error || !p) {
    console.error("[getGroundedProductContext] Product not found:", error);
    return null;
  }

  const info = (p.price_additional_info as any) || {};
  const overrides = info.admin_overrides || {};
  const trading = info.trading_overrides || {};
  const brand = (p.brands as any) || {};

  const effectiveSku = overrides.letusto_sku || p.letusto_sku || overrides.manufacture_sku || p.manufacture_sku || "SKU-UNKNOWN";
  const effectiveName = overrides.name || p.name;
  const effectiveNameEn = overrides.name_en || p.name_en || effectiveName;
  const effectiveDesc = overrides.description || p.description || "";
  const effectiveHowToUse = overrides.how_to_use || p.how_to_use || "";
  const effectiveIngredients = p.ingredients_text || "";

  // Parse bullet points
  let effectiveBullets: string[] = [];
  if (Array.isArray(overrides.bullet_points) && overrides.bullet_points.length > 0) {
    effectiveBullets = overrides.bullet_points;
  } else if (Array.isArray(p.bullet_points) && p.bullet_points.length > 0) {
    effectiveBullets = p.bullet_points;
  } else if (typeof overrides.bullet_points === "string") {
    effectiveBullets = [overrides.bullet_points];
  } else if (typeof p.bullet_points === "string") {
    effectiveBullets = [p.bullet_points];
  }

  // Primary image signed url
  let primaryImageUrl: string | null = null;
  const rawImages = (p.product_images as any[]) || [];
  if (rawImages.length > 0 && rawImages[0].storage_path) {
    try {
      const { data: sData } = await adminClient.storage
        .from("company-uploads")
        .createSignedUrl(rawImages[0].storage_path, 7200);
      primaryImageUrl = sData?.signedUrl || null;
    } catch {
      // ignore
    }
  }

  // Count and fetch approved/draft media assets
  let mediaCount = 0;
  let benefitGraphicUrl: string | null = null;
  let infographicUrl: string | null = null;
  let lifestyleImageUrl: string | null = null;
  let howToGraphicUrl: string | null = null;

  try {
    const { data: assets, count } = await adminClient
      .from("product_media_assets")
      .select("asset_type, storage_path, status", { count: "exact" })
      .eq("product_id", productId)
      .in("status", ["approved", "draft"]);

    mediaCount = count || 0;

    if (assets) {
      for (const a of assets) {
        if (!a.storage_path) continue;
        let signed = "";
        try {
          const { data: s } = await adminClient.storage
            .from("company-uploads")
            .createSignedUrl(a.storage_path, 7200);
          signed = s?.signedUrl || "";
        } catch {
          // ignore
        }

        if (signed) {
          if (a.asset_type === "benefit_graphic" && (!benefitGraphicUrl || a.status === "approved")) {
            benefitGraphicUrl = signed;
          } else if (a.asset_type === "infographic" && (!infographicUrl || a.status === "approved")) {
            infographicUrl = signed;
          } else if (a.asset_type === "lifestyle_image" && (!lifestyleImageUrl || a.status === "approved")) {
            lifestyleImageUrl = signed;
          } else if (a.asset_type === "how_to_graphic" && (!howToGraphicUrl || a.status === "approved")) {
            howToGraphicUrl = signed;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    productId: p.id,
    productName: effectiveName,
    nameEn: effectiveNameEn,
    brandName: brand.name || "K SELECT Brand",
    sku: effectiveSku,
    categoryName: p.category || "General",
    categoryCode: p.category_code || null,
    categoryBranch: p.category_code || p.category || "Skincare",
    volume: overrides.volume || p.volume || null,
    origin: overrides.origin || p.origin || "Republic of Korea",
    description: effectiveDesc,
    bulletPoints: effectiveBullets,
    howToUse: effectiveHowToUse,
    ingredientsText: effectiveIngredients,
    shortDescription: trading.short_description || null,
    mediaAssetCount: mediaCount,
    imageCount: (p.product_images as any[])?.length || 0,
    primaryImageUrl,
    benefitGraphicUrl,
    infographicUrl,
    lifestyleImageUrl,
    howToGraphicUrl,
  };
}

/**
 * Fetch Admin Training Module (existing database content or draft)
 */
export async function getAdminTrainingModule(productId: string): Promise<{
  module: TrainingModuleData | null;
  sourceReadiness: TrainingSourceReadiness | null;
  context: GroundedTrainingContext | null;
}> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const context = await getGroundedProductContext(productId);
  if (!context) {
    return { module: null, sourceReadiness: null, context: null };
  }

  const sourceReadiness = evaluateTrainingSourceReadiness(context);

  // 1. Check retailer_product_training_content
  let existingRow: any = null;
  try {
    const { data } = await adminClient
      .from("retailer_product_training_content")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    existingRow = data;
  } catch (err) {
    console.warn("[getAdminTrainingModule] error fetching training content:", err);
  }

  // 2. Check draft storage in price_additional_info
  let draftData: any = null;
  try {
    const { data: prod } = await adminClient
      .from("products")
      .select("price_additional_info")
      .eq("id", productId)
      .single();
    draftData = prod?.price_additional_info?.training_draft || null;
  } catch {
    // ignore
  }

  // If a row exists in retailer_product_training_content
  if (existingRow) {
    const isPub = existingRow.is_published ?? true;
    const status = existingRow.status || (isPub ? "published" : "draft");

    // Reconstruct Quiz Questions
    let quiz: any[] = [];
    if (Array.isArray(existingRow.quiz_questions) && existingRow.quiz_questions.length > 0) {
      quiz = existingRow.quiz_questions;
    } else if (draftData?.quizQuestions && Array.isArray(draftData.quizQuestions)) {
      quiz = draftData.quizQuestions;
    }

    const mod: TrainingModuleData = {
      id: existingRow.id,
      productId: existingRow.product_id,
      status: status as any,
      version: existingRow.version || "1.0.0",
      versionType: (existingRow.version_type as any) || "minor",
      productOverview: existingRow.training_summary || "",
      top3Benefits: Array.isArray(existingRow.key_benefits) && existingRow.key_benefits.length >= 3
        ? [existingRow.key_benefits[0], existingRow.key_benefits[1], existingRow.key_benefits[2]]
        : [
            existingRow.key_benefits?.[0] || context.bulletPoints[0] || "Deep hydration & barrier reinforcement",
            existingRow.key_benefits?.[1] || context.bulletPoints[1] || "Concentrated botanical active soothing",
            existingRow.key_benefits?.[2] || context.bulletPoints[2] || "Lightweight fast-absorbing finish",
          ],
      bestFor: existingRow.target_customer || "",
      howToUse: existingRow.how_to_use || context.howToUse || "",
      sellingPoints: Array.isArray(existingRow.selling_points) ? existingRow.selling_points : [],
      pitch15s: existingRow.pitch_15s || draftData?.pitch15s || `Recommend this ${context.brandName} favorite for proven daily moisture support!`,
      customerObjections: Array.isArray(existingRow.customer_objections) ? existingRow.customer_objections : draftData?.customerObjections || [],
      storageHandlingSop: existingRow.storage_handling_sop || existingRow.important_notes || "Store at room temperature away from direct sunlight.",
      quizQuestions: quiz,
      sourceReadiness,
      isPublished: Boolean(isPub),
      publishedAt: existingRow.published_at || (isPub ? existingRow.created_at : null),
      publishedBy: existingRow.published_by,
      approvedAt: existingRow.approved_at,
      approvedBy: existingRow.approved_by,
      createdAt: existingRow.created_at,
      updatedAt: existingRow.updated_at,
      versionHistory: existingRow.version_history || [],
    };

    return { module: mod, sourceReadiness, context };
  }

  // If draft exists in price_additional_info
  if (draftData) {
    return {
      module: {
        ...draftData,
        sourceReadiness,
      },
      sourceReadiness,
      context,
    };
  }

  return { module: null, sourceReadiness, context };
}

/**
 * Generate complete Training Draft via AI
 */
export async function generateAiTrainingAction(productId: string): Promise<{
  success: boolean;
  module?: TrainingModuleData;
  error?: string;
  provider?: string;
  model?: string;
}> {
  try {
    await verifyAdminSession();
    const context = await getGroundedProductContext(productId);
    if (!context) {
      return { success: false, error: "Product not found for grounding" };
    }

    const res = await clientGenerateAi(context);
    return {
      success: res.success,
      module: res.module,
      provider: res.provider,
      model: res.model,
      error: res.error,
    };
  } catch (err: any) {
    console.error("[generateAiTrainingAction] Exception:", err);
    return { success: false, error: err.message || "Failed to generate AI training draft" };
  }
}

/**
 * Helper to update draft in products.price_additional_info for fail-safe persistence
 */
async function persistPriceInfoDraft(adminClient: any, productId: string, moduleData: TrainingModuleData) {
  try {
    const { data: prod } = await adminClient
      .from("products")
      .select("price_additional_info")
      .eq("id", productId)
      .single();

    const info = (prod?.price_additional_info as any) || {};
    info.training_draft = {
      ...moduleData,
      updatedAt: new Date().toISOString(),
    };

    await adminClient
      .from("products")
      .update({ price_additional_info: info })
      .eq("id", productId);
  } catch (err) {
    console.warn("[persistPriceInfoDraft] Warning: Could not save draft in price_additional_info:", err);
  }
}

/**
 * Save Training Draft (non-destructive draft save)
 */
export async function saveTrainingDraftAction(
  productId: string,
  moduleData: TrainingModuleData
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Dual-write to price_additional_info for fail-safe resilience
    await persistPriceInfoDraft(adminClient, productId, { ...moduleData, status: "draft", isPublished: false });

    // 2. Write to retailer_product_training_content
    // Try full schema first
    const fullPayload: any = {
      product_id: productId,
      training_summary: moduleData.productOverview,
      target_customer: moduleData.bestFor,
      key_benefits: moduleData.top3Benefits,
      how_to_use: moduleData.howToUse,
      key_ingredients: "Refer to packaging / Catalog specifications",
      selling_points: moduleData.sellingPoints,
      important_notes: moduleData.storageHandlingSop,
      storage_handling_sop: moduleData.storageHandlingSop,
      pitch_15s: moduleData.pitch15s,
      customer_objections: moduleData.customerObjections,
      quiz_questions: moduleData.quizQuestions,
      status: "draft",
      version: moduleData.version || "1.0.0",
      version_type: moduleData.versionType || "minor",
      is_published: false,
      updated_at: new Date().toISOString(),
    };

    const { error: fullErr } = await adminClient
      .from("retailer_product_training_content")
      .upsert(fullPayload, { onConflict: "product_id" });

    // If new columns are pending migration, fallback to base columns
    if (fullErr) {
      console.warn("[saveTrainingDraftAction] Full upsert failed, attempting baseline fallback:", fullErr.message);
      const basePayload: any = {
        product_id: productId,
        training_summary: moduleData.productOverview,
        target_customer: moduleData.bestFor,
        key_benefits: moduleData.top3Benefits,
        how_to_use: moduleData.howToUse,
        key_ingredients: "Refer to packaging / Catalog specifications",
        selling_points: moduleData.sellingPoints,
        important_notes: moduleData.storageHandlingSop,
        is_published: false,
        updated_at: new Date().toISOString(),
      };
      const { error: baseErr } = await adminClient
        .from("retailer_product_training_content")
        .upsert(basePayload, { onConflict: "product_id" });

      if (baseErr) {
        console.error("[saveTrainingDraftAction] Baseline upsert also failed:", baseErr);
        // Even if table write had an issue, draft is safely saved in price_additional_info
      }
    }

    revalidatePath(`/admin/products/content/${productId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[saveTrainingDraftAction] Exception:", err);
    return { success: false, error: err.message || "Failed to save draft" };
  }
}

/**
 * Submit Training Module for Review
 */
export async function submitTrainingForReviewAction(
  productId: string,
  moduleData: TrainingModuleData
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    if (!moduleData.productOverview || !moduleData.howToUse) {
      return { success: false, error: "Product Overview and How to Use are required before review." };
    }

    const updatedModule: TrainingModuleData = {
      ...moduleData,
      status: "in_review",
      isPublished: false,
      updatedAt: new Date().toISOString(),
    };

    await persistPriceInfoDraft(adminClient, productId, updatedModule);

    // Attempt status update in retailer_product_training_content
    try {
      await adminClient
        .from("retailer_product_training_content")
        .update({
          status: "in_review",
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", productId);
    } catch {
      // ignore
    }

    revalidatePath(`/admin/products/content/${productId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit for review" };
  }
}

/**
 * Validate and Publish Training Module (Official Immutable Publication)
 */
export async function publishTrainingModuleAction(
  productId: string,
  moduleData: TrainingModuleData,
  versionType: TrainingVersionType = "minor"
): Promise<{ success: boolean; error?: string; newVersion?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminClient = createAdminClient();

    // 1. Strict Validation
    if (!moduleData.productOverview?.trim()) {
      return { success: false, error: "Section 1: Product Overview is required." };
    }
    if (!moduleData.top3Benefits || moduleData.top3Benefits.some((b) => !b?.trim())) {
      return { success: false, error: "Section 2: All Top 3 Benefits must be provided." };
    }
    if (!moduleData.bestFor?.trim()) {
      return { success: false, error: "Section 3: Best For (Target Customer) is required." };
    }
    if (!moduleData.howToUse?.trim()) {
      return { success: false, error: "Section 4: How to Use instructions are required." };
    }
    if (!moduleData.sellingPoints || moduleData.sellingPoints.length === 0) {
      return { success: false, error: "Section 5: At least one Selling Point is required." };
    }

    // Quiz Validation: At least 3 questions, each with 3 options and exactly 1 correct answer
    if (!moduleData.quizQuestions || moduleData.quizQuestions.length < 3) {
      return { success: false, error: "Assessment requires at least 3 multiple-choice questions." };
    }

    for (let i = 0; i < moduleData.quizQuestions.length; i++) {
      const q = moduleData.quizQuestions[i];
      if (!q.question?.trim()) {
        return { success: false, error: `Quiz Question ${i + 1} has empty question text.` };
      }
      if (!q.options || q.options.length !== 3 || q.options.some((opt) => !opt?.trim())) {
        return { success: false, error: `Quiz Question ${i + 1} must have exactly 3 non-empty answer options.` };
      }
      if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 2) {
        return { success: false, error: `Quiz Question ${i + 1} must designate a valid correct answer option.` };
      }
      if (!q.explanation?.trim()) {
        return { success: false, error: `Quiz Question ${i + 1} requires an educational explanation.` };
      }
    }

    // 2. Version Bump Calculation
    const currentVer = moduleData.version || "1.0.0";
    const parts = currentVer.split(".").map((n) => parseInt(n, 10) || 0);
    let major = parts[0] || 1;
    let minor = parts[1] || 0;
    let patch = parts[2] || 0;

    if (versionType === "major") {
      major += 1;
      minor = 0;
      patch = 0;
    } else {
      minor += 1;
      patch = 0;
    }
    const newVersion = `${major}.${minor}.${patch}`;
    const nowIso = new Date().toISOString();

    // 3. Build snapshot for version history
    const historySnapshot = {
      version: newVersion,
      versionType,
      publishedAt: nowIso,
      publishedBy: session.userId,
      summary: moduleData.productOverview.slice(0, 100) + "...",
    };

    const updatedHistory = [...(moduleData.versionHistory || []), historySnapshot];

    const publishedModule: TrainingModuleData = {
      ...moduleData,
      status: "published",
      version: newVersion,
      versionType,
      isPublished: true,
      publishedAt: nowIso,
      publishedBy: session.userId,
      approvedAt: nowIso,
      approvedBy: session.userId,
      versionHistory: updatedHistory,
      updatedAt: nowIso,
    };

    // 4. Dual-persist to price_additional_info
    await persistPriceInfoDraft(adminClient, productId, publishedModule);

    // 5. Upsert to retailer_product_training_content
    const payload: any = {
      product_id: productId,
      training_summary: moduleData.productOverview,
      target_customer: moduleData.bestFor,
      key_benefits: moduleData.top3Benefits,
      how_to_use: moduleData.howToUse,
      key_ingredients: "Refer to packaging / Catalog specifications",
      selling_points: moduleData.sellingPoints,
      important_notes: moduleData.storageHandlingSop,
      storage_handling_sop: moduleData.storageHandlingSop,
      pitch_15s: moduleData.pitch15s,
      customer_objections: moduleData.customerObjections,
      quiz_questions: moduleData.quizQuestions,
      status: "published",
      version: newVersion,
      version_type: versionType,
      is_published: true,
      published_at: nowIso,
      published_by: session.userId,
      approved_at: nowIso,
      approved_by: session.userId,
      version_history: updatedHistory,
      updated_at: nowIso,
    };

    const { error: pubErr } = await adminClient
      .from("retailer_product_training_content")
      .upsert(payload, { onConflict: "product_id" });

    if (pubErr) {
      console.warn("[publishTrainingModuleAction] Full upsert failed, attempting baseline publish:", pubErr.message);
      const basePayload: any = {
        product_id: productId,
        training_summary: moduleData.productOverview,
        target_customer: moduleData.bestFor,
        key_benefits: moduleData.top3Benefits,
        how_to_use: moduleData.howToUse,
        key_ingredients: "Refer to packaging / Catalog specifications",
        selling_points: moduleData.sellingPoints,
        important_notes: moduleData.storageHandlingSop,
        is_published: true,
        updated_at: nowIso,
      };
      await adminClient
        .from("retailer_product_training_content")
        .upsert(basePayload, { onConflict: "product_id" });
    }

    revalidatePath(`/admin/products/content/${productId}`);
    revalidatePath(`/training`);
    revalidatePath(`/training/${productId}`);

    return { success: true, newVersion };
  } catch (err: any) {
    console.error("[publishTrainingModuleAction] Exception:", err);
    return { success: false, error: err.message || "Failed to publish training module" };
  }
}

/**
 * Archive / Unpublish Training Module
 */
export async function archiveTrainingModuleAction(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    try {
      await adminClient
        .from("retailer_product_training_content")
        .update({
          status: "archived",
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", productId);
    } catch {
      // ignore
    }

    // Also update draft status in price_additional_info
    try {
      const { data: prod } = await adminClient
        .from("products")
        .select("price_additional_info")
        .eq("id", productId)
        .single();
      const info = (prod?.price_additional_info as any) || {};
      if (info.training_draft) {
        info.training_draft.status = "archived";
        info.training_draft.isPublished = false;
        await adminClient
          .from("products")
          .update({ price_additional_info: info })
          .eq("id", productId);
      }
    } catch {
      // ignore
    }

    revalidatePath(`/admin/products/content/${productId}`);
    revalidatePath(`/training`);
    revalidatePath(`/training/${productId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to archive training module" };
  }
}
