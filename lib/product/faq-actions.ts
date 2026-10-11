"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductName } from "@/lib/product/name-resolver";
import { revalidatePath } from "next/cache";

import type {
  FaqCategory,
  FaqAudience,
  FaqStatus,
  FaqSourceType,
  ProductFaqItem,
  CreateFaqInput,
  UpdateFaqInput,
  FaqAiSuggestion,
} from "./faq-types";

/**
 * Fetch all FAQs for an admin workspace by product ID
 */
export async function getProductFaqs(productId: string): Promise<ProductFaqItem[]> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("product_faqs")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getProductFaqs] Error:", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      product_id: row.product_id,
      company_id: row.company_id,
      question: row.question,
      answer: row.answer,
      category: row.category as FaqCategory,
      audience: (row.audience as FaqAudience) || "both",
      status: (row.status as FaqStatus) || "draft",
      sort_order: row.sort_order ?? 0,
      source_type: (row.source_type as FaqSourceType) || "manual",
      source_refs: Array.isArray(row.source_refs) ? row.source_refs : [],
      ai_provider: row.ai_provider,
      ai_model: row.ai_model,
      requires_brand_confirmation: Boolean(row.requires_brand_confirmation),
      created_by: row.created_by,
      approved_at: row.approved_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (err) {
    console.error("[getProductFaqs] Unexpected exception:", err);
    return [];
  }
}

/**
 * Create a new single FAQ item
 */
export async function createProductFaq(input: CreateFaqInput): Promise<{ success: boolean; faq?: ProductFaqItem; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    // Get current max sort_order
    const { data: currentFaqs } = await adminSupabase
      .from("product_faqs")
      .select("sort_order")
      .eq("product_id", input.productId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = input.sort_order !== undefined
      ? input.sort_order
      : (currentFaqs && currentFaqs.length > 0 ? (currentFaqs[0].sort_order + 1) : 0);

    const status = input.status || "draft";
    const approvedAt = status === "approved" ? new Date().toISOString() : null;

    const { data, error } = await adminSupabase
      .from("product_faqs")
      .insert({
        product_id: input.productId,
        question: input.question.trim(),
        answer: input.answer.trim(),
        category: input.category,
        audience: input.audience || "both",
        status,
        sort_order: nextSortOrder,
        source_type: input.source_type || "manual",
        source_refs: input.source_refs || [],
        requires_brand_confirmation: Boolean(input.requires_brand_confirmation),
        created_by: session?.userId || null,
        approved_at: approvedAt,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[createProductFaq] Error:", error);
      return { success: false, error: error?.message || "Failed to create FAQ" };
    }

    revalidatePath(`/admin/products/content/${input.productId}`);
    revalidatePath("/admin/products/content");

    return {
      success: true,
      faq: {
        id: data.id,
        product_id: data.product_id,
        company_id: data.company_id,
        question: data.question,
        answer: data.answer,
        category: data.category as FaqCategory,
        audience: (data.audience as FaqAudience) || "both",
        status: (data.status as FaqStatus) || "draft",
        sort_order: data.sort_order ?? 0,
        source_type: (data.source_type as FaqSourceType) || "manual",
        source_refs: Array.isArray(data.source_refs) ? data.source_refs : [],
        ai_provider: data.ai_provider,
        ai_model: data.ai_model,
        requires_brand_confirmation: Boolean(data.requires_brand_confirmation),
        created_by: data.created_by,
        approved_at: data.approved_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  } catch (err: any) {
    console.error("[createProductFaq] Exception:", err);
    return { success: false, error: err.message || "Failed to create FAQ" };
  }
}

/**
 * Update an existing FAQ item
 */
export async function updateProductFaq(
  id: string,
  input: UpdateFaqInput
): Promise<{ success: boolean; faq?: ProductFaqItem; error?: string }> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.question !== undefined) updatePayload.question = input.question.trim();
    if (input.answer !== undefined) updatePayload.answer = input.answer.trim();
    if (input.category !== undefined) updatePayload.category = input.category;
    if (input.audience !== undefined) updatePayload.audience = input.audience;
    if (input.sort_order !== undefined) updatePayload.sort_order = input.sort_order;
    if (input.requires_brand_confirmation !== undefined) {
      updatePayload.requires_brand_confirmation = input.requires_brand_confirmation;
    }
    if (input.status !== undefined) {
      updatePayload.status = input.status;
      if (input.status === "approved") {
        updatePayload.approved_at = new Date().toISOString();
      } else {
        updatePayload.approved_at = null;
      }
    }

    const { data, error } = await adminSupabase
      .from("product_faqs")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[updateProductFaq] Error:", error);
      return { success: false, error: error?.message || "Failed to update FAQ" };
    }

    revalidatePath(`/admin/products/content/${data.product_id}`);
    revalidatePath("/admin/products/content");

    return {
      success: true,
      faq: {
        id: data.id,
        product_id: data.product_id,
        company_id: data.company_id,
        question: data.question,
        answer: data.answer,
        category: data.category as FaqCategory,
        audience: (data.audience as FaqAudience) || "both",
        status: (data.status as FaqStatus) || "draft",
        sort_order: data.sort_order ?? 0,
        source_type: (data.source_type as FaqSourceType) || "manual",
        source_refs: Array.isArray(data.source_refs) ? data.source_refs : [],
        ai_provider: data.ai_provider,
        ai_model: data.ai_model,
        requires_brand_confirmation: Boolean(data.requires_brand_confirmation),
        created_by: data.created_by,
        approved_at: data.approved_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  } catch (err: any) {
    console.error("[updateProductFaq] Exception:", err);
    return { success: false, error: err.message || "Failed to update FAQ" };
  }
}

/**
 * Delete an FAQ item permanently
 */
export async function deleteProductFaq(id: string, productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from("product_faqs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[deleteProductFaq] Error:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/products/content/${productId}`);
    revalidatePath("/admin/products/content");
    return { success: true };
  } catch (err: any) {
    console.error("[deleteProductFaq] Exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update FAQ status directly (e.g. approve or archive)
 */
export async function updateFaqStatus(
  id: string,
  productId: string,
  status: FaqStatus
): Promise<{ success: boolean; error?: string }> {
  return updateProductFaq(id, { status });
}

/**
 * Reorder FAQs
 */
export async function reorderProductFaqs(
  productId: string,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    const promises = orderedIds.map((id, index) =>
      adminSupabase
        .from("product_faqs")
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq("id", id)
    );

    const results = await Promise.all(promises);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("[reorderProductFaqs] Error:", failed.error);
      return { success: false, error: failed.error.message };
    }

    revalidatePath(`/admin/products/content/${productId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[reorderProductFaqs] Exception:", err);
    return { success: false, error: err.message };
  }
}

import { generateGeminiFaqs } from "./gemini-faq-client";

/**
 * Save multiple draft FAQs (from AI suggestions or import)
 */
export async function saveBulkDraftFaqs(
  productId: string,
  faqs: Array<{
    question: string;
    answer: string;
    category: FaqCategory;
    audience: FaqAudience;
    source_refs?: string[];
    ai_provider?: string | null;
    ai_model?: string | null;
    requires_brand_confirmation?: boolean;
    status?: FaqStatus;
  }>
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = await verifyAdminSession();
    const adminSupabase = createAdminClient();

    if (!faqs || faqs.length === 0) {
      return { success: true, count: 0 };
    }

    // Get current max sort order
    const { data: currentFaqs } = await adminSupabase
      .from("product_faqs")
      .select("sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: false })
      .limit(1);

    let baseSortOrder = currentFaqs && currentFaqs.length > 0 ? currentFaqs[0].sort_order + 1 : 0;

    const rows = faqs.map((f, i) => ({
      product_id: productId,
      question: f.question.trim(),
      answer: f.answer.trim(),
      category: f.category,
      audience: f.audience || "both",
      status: f.status || "draft",
      sort_order: baseSortOrder + i,
      source_type: "ai_suggested" as const,
      source_refs: f.source_refs || [],
      ai_provider: f.ai_provider || "local",
      ai_model: f.ai_model || "deterministic-grounded-v1",
      requires_brand_confirmation: Boolean(f.requires_brand_confirmation),
      created_by: session?.userId || null,
      approved_at: f.status === "approved" ? new Date().toISOString() : null,
    }));

    const { error } = await adminSupabase.from("product_faqs").insert(rows);

    if (error) {
      console.error("[saveBulkDraftFaqs] Error:", error);
      return { success: false, count: 0, error: error.message };
    }

    revalidatePath(`/admin/products/content/${productId}`);
    revalidatePath("/admin/products/content");

    return { success: true, count: rows.length };
  } catch (err: any) {
    console.error("[saveBulkDraftFaqs] Exception:", err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Generate AI FAQ suggestions based on authoritative product catalog facts
 * Hybrid Pipeline: Real Google Gemini Generation -> Rule-Based Grounding & Validation Fallback
 */
export async function generateFaqAiSuggestions(
  productId: string,
  options?: { count?: number }
): Promise<{ success: boolean; suggestions: FaqAiSuggestion[]; error?: string }> {
  try {
    await verifyAdminSession();
    const adminSupabase = createAdminClient();

    // 1. Fetch authoritative product data
    const { data: p, error: pErr } = await adminSupabase
      .from("products")
      .select(`
        id, name, name_en, category, brand_id, company_id,
        letusto_sku, description, how_to_use, ingredients_text,
        bullet_points, price_additional_info
      `)
      .eq("id", productId)
      .maybeSingle();

    if (pErr || !p) {
      return { success: false, suggestions: [], error: "Product not found" };
    }

    // 2. Fetch Brand Name
    const { data: brand } = await adminSupabase
      .from("brands")
      .select("name")
      .eq("id", p.brand_id)
      .maybeSingle();

    const brandName = brand?.name || "K-Beauty Brand";
    const productName = resolveProductName(p);
    const info = (p.price_additional_info as any) || {};
    const description = (p.description || "").trim();
    const howToUse = (p.how_to_use || info.how_to_use || "").trim();
    const bulletPoints: string[] = Array.isArray(p.bullet_points)
      ? p.bullet_points
      : Array.isArray(info.bullet_points)
      ? info.bullet_points
      : [];
    const ingredients = (p.ingredients_text || info.ingredients || "").trim();
    const categoryName = p.category || "Skincare";
    const targetCount = Math.min(Math.max(options?.count || 8, 5), 10);

    // Build Grounded Product Context
    const groundedContext = {
      productName,
      brandName,
      categoryName,
      description,
      bulletPoints,
      howToUse,
      ingredients,
    };

    // 3. Attempt Live Google Gemini Generation
    const geminiResult = await generateGeminiFaqs(groundedContext, targetCount);

    if (geminiResult.success && geminiResult.suggestions.length > 0) {
      console.log(`[generateFaqAiSuggestions] Generated ${geminiResult.suggestions.length} FAQs via Gemini (${geminiResult.model})`);
      return {
        success: true,
        suggestions: geminiResult.suggestions,
      };
    }

    // 4. Grounding Layer Fallback: Deterministic Rule-Based Generation
    console.log("[generateFaqAiSuggestions] Using Grounding Layer Deterministic Fallback");
    const hasSpecificHowToUse = Boolean(howToUse);
    const hasSpecificIngredients = Boolean(ingredients);
    const hasBulletPoints = bulletPoints.length > 0;
    const hasDescription = Boolean(description);

    const candidatePool: Array<Omit<FaqAiSuggestion, "tempId" | "selected">> = [];

    // Product Basics
    if (hasBulletPoints || hasDescription) {
      candidatePool.push({
        question: `What are the primary benefits and key features of ${productName}?`,
        answer: hasBulletPoints
          ? `${productName} by ${brandName} is formulated with key features: ${bulletPoints.slice(0, 3).join("; ")}.`
          : `${productName} by ${brandName}: ${description.slice(0, 200)}...`,
        category: "Product Basics",
        audience: "both",
        source_refs: hasBulletPoints ? ["Bullet Points"] : ["Description"],
        ai_provider: "local",
        ai_model: "deterministic-grounded-v1",
        requires_brand_confirmation: false,
      });
    }

    // Who It’s For
    const combinedText = `${description} ${bulletPoints.join(" ")}`.toLowerCase();
    const matchedConcerns: string[] = [];
    if (combinedText.includes("sensitive")) matchedConcerns.push("sensitive skin");
    if (combinedText.includes("calming") || combinedText.includes("soothing")) matchedConcerns.push("soothing and calming care");
    if (combinedText.includes("hydrat") || combinedText.includes("moistur")) matchedConcerns.push("hydration and moisture care");
    if (combinedText.includes("dry")) matchedConcerns.push("dry skin");
    if (combinedText.includes("brighten") || combinedText.includes("tone")) matchedConcerns.push("brightening and skin tone care");
    if (combinedText.includes("barrier")) matchedConcerns.push("skin barrier support");
    if (combinedText.includes("acne") || combinedText.includes("trouble") || combinedText.includes("blemish")) matchedConcerns.push("blemish-prone skin");

    if (matchedConcerns.length > 0) {
      candidatePool.push({
        question: `Which skin concerns is ${productName} suited for?`,
        answer: `Based on product specifications from ${brandName}, this formula is targeted for ${matchedConcerns.join(", ")}.`,
        category: "Who It’s For",
        audience: "both",
        source_refs: hasBulletPoints ? ["Bullet Points", "Description"] : ["Description"],
        ai_provider: "local",
        ai_model: "deterministic-grounded-v1",
        requires_brand_confirmation: false,
      });
    }

    // How to Use
    if (hasSpecificHowToUse) {
      candidatePool.push({
        question: `How should ${productName} be applied according to instructions?`,
        answer: howToUse,
        category: "How to Use",
        audience: "both",
        source_refs: ["How to Use"],
        ai_provider: "local",
        ai_model: "deterministic-grounded-v1",
        requires_brand_confirmation: false,
      });
    }

    // Ingredients / Safety
    if (hasSpecificIngredients) {
      candidatePool.push({
        question: `What ingredients are listed for ${productName}?`,
        answer: `Official ingredients list: ${ingredients.slice(0, 220)}${ingredients.length > 220 ? "..." : ""}`,
        category: "Ingredients / Safety",
        audience: "both",
        source_refs: ["Ingredients"],
        ai_provider: "local",
        ai_model: "deterministic-grounded-v1",
        requires_brand_confirmation: false,
      });
    }

    // Warnings / Precautions
    candidatePool.push({
      question: `Are there specific safety precautions or warnings for ${productName}?`,
      answer: `For external use only. Discontinue use if irritation develops. Brand confirmation is required for specific medical warnings, active ingredient contraindications, and allergen disclosures.`,
      category: "Warnings / Precautions",
      audience: "both",
      source_refs: ["Brand Confirmation Required"],
      ai_provider: "local",
      ai_model: "deterministic-grounded-v1",
      requires_brand_confirmation: true,
    });

    // Storage / Practical Info
    candidatePool.push({
      question: `How should ${productName} be stored?`,
      answer: `Store in a cool, dry place away from direct sunlight and excessive heat. Keep the container securely closed after each use.`,
      category: "Storage / Practical Info",
      audience: "both",
      source_refs: ["Catalog Specifications"],
      ai_provider: "local",
      ai_model: "deterministic-grounded-v1",
      requires_brand_confirmation: false,
    });

    // Retail Staff Training Q&A
    if (hasBulletPoints || hasDescription) {
      candidatePool.push({
        question: `[Staff Tip] What key product details should retail staff highlight to customers?`,
        answer: `Highlight ${brandName}'s core product identity: ${
          hasBulletPoints ? bulletPoints.slice(0, 2).join("; ") : description.slice(0, 140)
        }.`,
        category: "Product Basics",
        audience: "retail_staff",
        source_refs: hasBulletPoints ? ["Bullet Points", "Catalog"] : ["Description"],
        ai_provider: "local",
        ai_model: "deterministic-grounded-v1",
        requires_brand_confirmation: false,
      });
    }

    const selectedPool = candidatePool.slice(0, targetCount);

    const suggestions: FaqAiSuggestion[] = selectedPool.map((item, idx) => ({
      tempId: `fallback_${Date.now()}_${idx}`,
      question: item.question,
      answer: item.answer,
      category: item.category,
      audience: item.audience,
      source_refs: item.source_refs,
      ai_provider: item.ai_provider || "local",
      ai_model: item.ai_model || "deterministic-grounded-v1",
      requires_brand_confirmation: item.requires_brand_confirmation,
      selected: true,
    }));

    return {
      success: true,
      suggestions,
    };
  } catch (err: any) {
    console.error("[generateFaqAiSuggestions] Exception:", err);
    return { success: false, suggestions: [], error: err.message || "Failed to generate suggestions" };
  }
}

/**
 * Reusable Query Helper: Customer Page FAQs
 * Returns approved FAQs for customer display (audience: 'customer' or 'both')
 */
export async function getCustomerPageFaqs(productId: string): Promise<ProductFaqItem[]> {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("product_faqs")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .in("audience", ["customer", "both"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getCustomerPageFaqs] Error:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    company_id: row.company_id,
    question: row.question,
    answer: row.answer,
    category: row.category as FaqCategory,
    audience: row.audience as FaqAudience,
    status: row.status as FaqStatus,
    sort_order: row.sort_order ?? 0,
    source_type: (row.source_type as FaqSourceType) || "manual",
    source_refs: Array.isArray(row.source_refs) ? row.source_refs : [],
    ai_provider: row.ai_provider,
    ai_model: row.ai_model,
    requires_brand_confirmation: Boolean(row.requires_brand_confirmation),
    created_by: row.created_by,
    approved_at: row.approved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Reusable Query Helper: Training / Retail Staff FAQs
 * Returns approved FAQs for staff training (audience: 'retail_staff' or 'both')
 */
export async function getTrainingFaqs(productId: string): Promise<ProductFaqItem[]> {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("product_faqs")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .in("audience", ["retail_staff", "both"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getTrainingFaqs] Error:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    company_id: row.company_id,
    question: row.question,
    answer: row.answer,
    category: row.category as FaqCategory,
    audience: row.audience as FaqAudience,
    status: row.status as FaqStatus,
    sort_order: row.sort_order ?? 0,
    source_type: (row.source_type as FaqSourceType) || "manual",
    source_refs: Array.isArray(row.source_refs) ? row.source_refs : [],
    ai_provider: row.ai_provider,
    ai_model: row.ai_model,
    requires_brand_confirmation: Boolean(row.requires_brand_confirmation),
    created_by: row.created_by,
    approved_at: row.approved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
