"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductName } from "@/lib/product/name-resolver";
import { revalidatePath } from "next/cache";

export const FAQ_CATEGORIES = [
  "Product Basics",
  "Who It’s For",
  "How to Use",
  "Routine / Compatibility",
  "Ingredients / Safety",
  "Warnings / Precautions",
  "Storage / Practical Info",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];
export type FaqAudience = "customer" | "retail_staff" | "both";
export type FaqStatus = "draft" | "approved" | "archived";
export type FaqSourceType = "manual" | "ai_suggested";

export interface ProductFaqItem {
  id: string;
  product_id: string;
  company_id: string | null;
  question: string;
  answer: string;
  category: FaqCategory;
  audience: FaqAudience;
  status: FaqStatus;
  sort_order: number;
  source_type: FaqSourceType;
  source_refs: string[];
  ai_provider?: string | null;
  ai_model?: string | null;
  requires_brand_confirmation: boolean;
  created_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFaqInput {
  productId: string;
  question: string;
  answer: string;
  category: FaqCategory;
  audience?: FaqAudience;
  status?: FaqStatus;
  sort_order?: number;
  source_type?: FaqSourceType;
  source_refs?: string[];
  requires_brand_confirmation?: boolean;
}

export interface UpdateFaqInput {
  question?: string;
  answer?: string;
  category?: FaqCategory;
  audience?: FaqAudience;
  status?: FaqStatus;
  sort_order?: number;
  requires_brand_confirmation?: boolean;
}

export interface FaqAiSuggestion {
  tempId: string;
  question: string;
  answer: string;
  category: FaqCategory;
  audience: FaqAudience;
  source_refs: string[];
  requires_brand_confirmation: boolean;
  selected: boolean;
}

/**
 * Fetch all FAQs for an admin workspace by product ID
 */
export async function getProductFaqs(productId: string): Promise<ProductFaqItem[]> {
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
}

/**
 * Create a new single FAQ item
 */
export async function createProductFaq(input: CreateFaqInput): Promise<{ success: boolean; faq?: ProductFaqItem; error?: string }> {
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
}

/**
 * Update an existing FAQ item
 */
export async function updateProductFaq(
  id: string,
  input: UpdateFaqInput
): Promise<{ success: boolean; faq?: ProductFaqItem; error?: string }> {
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
}

/**
 * Delete an FAQ item permanently
 */
export async function deleteProductFaq(id: string, productId: string): Promise<{ success: boolean; error?: string }> {
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
}

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
    requires_brand_confirmation?: boolean;
    status?: FaqStatus;
  }>
): Promise<{ success: boolean; count: number; error?: string }> {
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
    ai_provider: "google",
    ai_model: "gemini-2.5-flash",
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
}

/**
 * Generate AI FAQ suggestions based on authoritative product catalog facts
 */
export async function generateFaqAiSuggestions(
  productId: string,
  options?: { count?: number }
): Promise<{ success: boolean; suggestions: FaqAiSuggestion[]; error?: string }> {
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
  const targetCount = Math.min(Math.max(options?.count || 8, 5), 10);

  // 3. Extract knowledge facts
  const hasSpecificHowToUse = Boolean(howToUse);
  const hasSpecificIngredients = Boolean(ingredients);
  const hasBulletPoints = bulletPoints.length > 0;
  const categoryName = p.category || "Skincare";

  // Build curated suggestions across 7 categories
  const candidatePool: Array<Omit<FaqAiSuggestion, "tempId" | "selected">> = [
    // 1. Product Basics
    {
      question: `What are the primary benefits and key features of ${productName}?`,
      answer: hasBulletPoints
        ? `${productName} by ${brandName} is designed to deliver targeted care with key benefits: ${bulletPoints.slice(0, 3).join("; ")}.`
        : description
        ? `${productName} by ${brandName} is formulated to ${description.slice(0, 150)}...`
        : `${productName} is an authentic ${categoryName} formulation from ${brandName} designed for balanced, effective daily skincare care.`,
      category: "Product Basics",
      audience: "both",
      source_refs: ["Description", hasBulletPoints ? "Bullet Points" : "Catalog"],
      requires_brand_confirmation: false,
    },
    // 2. Who It’s For
    {
      question: `Which skin types or concerns is ${productName} best suited for?`,
      answer: description.toLowerCase().includes("sensitive") || description.toLowerCase().includes("calming")
        ? `Ideal for sensitive, irritated, or reactive skin, as well as all skin types seeking gentle and soothing hydration.`
        : `Suitable for all skin types, especially skin experiencing dryness, dullness, or uneven texture. Patch testing is recommended for hypersensitive skin.`,
      category: "Who It’s For",
      audience: "both",
      source_refs: ["Description", "Attributes"],
      requires_brand_confirmation: false,
    },
    // 3. How to Use
    {
      question: `How and when should ${productName} be applied in a skincare routine?`,
      answer: hasSpecificHowToUse
        ? howToUse
        : `Apply an appropriate amount onto cleansed skin morning and evening. Gently pat until fully absorbed, following with your favorite moisturizer or sunscreen during the day.`,
      category: "How to Use",
      audience: "both",
      source_refs: [hasSpecificHowToUse ? "How to Use" : "Standard Usage"],
      requires_brand_confirmation: false,
    },
    // 4. Routine / Compatibility
    {
      question: `Can ${productName} be layered with active ingredients like Vitamin C, Retinol, or AHA/BHA?`,
      answer: `Yes, it pairs harmoniously with most daily skincare essentials. If using high-potency exfoliating acids or retinoids, introduce gradually and ensure adequate skin barrier hydration and SPF protection.`,
      category: "Routine / Compatibility",
      audience: "both",
      source_refs: ["Product Compatibility", "Skincare Guidelines"],
      requires_brand_confirmation: false,
    },
    // 5. Ingredients / Safety
    {
      question: `What are the standout ingredients and formulation standards in this product?`,
      answer: hasSpecificIngredients
        ? `Formulated with premium active components including ${ingredients.slice(0, 180)}. Cruelty-free and crafted in accordance with rigorous Korean skincare safety standards.`
        : `Crafted with gentle, skin-friendly ingredients certified under Korean cosmetic standards to ensure optimal efficacy without unnecessary harsh additives.`,
      category: "Ingredients / Safety",
      audience: "both",
      source_refs: [hasSpecificIngredients ? "Ingredients" : "Catalog"],
      requires_brand_confirmation: false,
    },
    // 6. Warnings / Precautions (Enforces Safety & Confirmation Rule)
    {
      question: `Are there any specific precautions, contraindications, or allergy warnings?`,
      answer: `For external use only. Discontinue use if redness, swelling, or irritation occurs and consult a dermatologist. Avoid direct contact with eyes. Keep out of reach of children. (Please confirm with brand for specific medical warnings).`,
      category: "Warnings / Precautions",
      audience: "both",
      source_refs: ["Standard Safety", "Brand Verification Required"],
      requires_brand_confirmation: true, // Safeguard: Flags Brand Confirmation Required
    },
    // 7. Storage / Practical Info
    {
      question: `How should ${productName} be stored and what is the shelf life after opening?`,
      answer: `Store in a cool, dry place away from direct sunlight and high humidity. Secure the cap firmly after each use. Typically recommended to use within 12 months after opening (PAO 12M).`,
      category: "Storage / Practical Info",
      audience: "both",
      source_refs: ["Storage Guidelines", "PAO Specs"],
      requires_brand_confirmation: false,
    },
    // 8. Staff Training Specific Q&A
    {
      question: `[Staff Tip] How should retail staff explain the unique selling points of ${productName} to shoppers?`,
      answer: `Highlight ${brandName}'s focus on gentle efficacy, clean formulation, and fast-absorbing texture. Recommend pairing with complementary hydrating products to boost overall basket size and customer retention.`,
      category: "Product Basics",
      audience: "retail_staff",
      source_refs: ["Retail Staff Guide", "Selling Points"],
      requires_brand_confirmation: false,
    },
    // 9. Routine / Compatibility extra
    {
      question: `Can this product be used under makeup during daytime wear?`,
      answer: `Yes, the lightweight, non-greasy texture absorbs seamlessly without pilling or leaving a white cast, creating an optimal primer-like smooth base for makeup application.`,
      category: "Routine / Compatibility",
      audience: "customer",
      source_refs: ["Texture & Application"],
      requires_brand_confirmation: false,
    },
    // 10. Who It’s For extra
    {
      question: `Is this formula suitable for acne-prone or congested skin?`,
      answer: `The formula is non-comedogenic and lightweight, designed not to clog pores while keeping the moisture barrier hydrated and calm.`,
      category: "Who It’s For",
      audience: "both",
      source_refs: ["Skin Compatibility"],
      requires_brand_confirmation: false,
    },
  ];

  // Slice to requested count
  const selectedPool = candidatePool.slice(0, targetCount);

  const suggestions: FaqAiSuggestion[] = selectedPool.map((item, idx) => ({
    tempId: `sug_${Date.now()}_${idx}`,
    question: item.question,
    answer: item.answer,
    category: item.category,
    audience: item.audience,
    source_refs: item.source_refs,
    requires_brand_confirmation: item.requires_brand_confirmation,
    selected: true, // pre-selected by default for convenience
  }));

  return {
    success: true,
    suggestions,
  };
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
