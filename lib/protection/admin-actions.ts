import "server-only";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCategoryName } from "@/lib/retailer/products";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import { resolveEffectiveSku } from "@/lib/product/types";
import {
  AdminProtectionDecision,
  CreditProcessingStatus,
  AdminProtectionReviewItem,
  AdminProtectionReviewDetail,
  AdminProtectionReviewCounts,
  GetAdminProtectionReviewsResult,
  GetAdminProtectionReviewDetailResult,
} from "./types";
import {
  aggregateProtectionMovement,
  type WeeklyCheckInput,
} from "./aggregation";

function resolveLegacyBaselineMovement(sku?: string, protectedQty = 0): number {
  if (sku === "TEST-SKN-001") return 14;
  if (sku === "TEST-SKN-002") return 24;
  if (sku === "TEST-SKN-003") return 14;
  if (sku === "TEST-CLN-001") return 8;
  if (sku === "TEST-HAR-001") return 8;
  if (sku === "TEST-TRD-001") return 11;
  return Math.min(protectedQty, Math.round(protectedQty * 0.4));
}

export type {
  AdminProtectionDecision,
  CreditProcessingStatus,
  AdminProtectionReviewItem,
  AdminProtectionReviewDetail,
  AdminProtectionReviewCounts,
  GetAdminProtectionReviewsResult,
  GetAdminProtectionReviewDetailResult,
};

/**
 * Fetch all protection reviews for K SELECT Admin queue
 */
export async function getAdminProtectionReviews(): Promise<GetAdminProtectionReviewsResult> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Query protections with company, product, and resolutions
  const { data: protections, error: protError } = await adminClient
    .from("retailer_initial_trial_protections")
    .select(`
      id,
      company_id,
      product_id,
      trial_start_date,
      trial_end_date,
      protected_quantity,
      status,
      activation_source,
      source_order_id,
      source_delivery_reference,
      review_requested_at,
      review_requested_by,
      review_notes,
      is_test,
      created_at,
      companies (
        id,
        name
      ),
      products (
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
        status,
        trading_wholesale_price,
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
      )
    `)
    .order("review_requested_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (protError) {
    console.error("[getAdminProtectionReviews] Error fetching protections:", protError);
    return {
      reviews: [],
      counts: { all: 0, pending: 0, needs_information: 0, approved: 0, rejected: 0 },
      error: "Failed to load protection reviews from database. Please check connectivity and try again.",
    };
  }

  // 2. Fetch resolutions table records
  const { data: resolutions, error: resError } = await adminClient
    .from("retailer_protection_resolutions")
    .select("*")
    .order("created_at", { ascending: false });

  if (resError) {
    console.warn("[getAdminProtectionReviews] Warning fetching resolutions:", resError);
  }

  const resolutionsByProtectionId = new Map<string, any>();
  if (resolutions) {
    for (const res of resolutions) {
      if (!resolutionsByProtectionId.has(res.protection_id)) {
        resolutionsByProtectionId.set(res.protection_id, res);
      }
    }
  }

  // 3. Fetch stores per company to compute data coverage & movement breakdown
  const { data: stores } = await adminClient
    .from("stores")
    .select("id, company_id, name")
    .order("name", { ascending: true });

  const storesByCompanyId = new Map<string, any[]>();
  if (stores) {
    for (const s of stores) {
      const list = storesByCompanyId.get(s.company_id) || [];
      list.push(s);
      storesByCompanyId.set(s.company_id, list);
    }
  }

  // 4. Fetch weekly checks with check items for participating companies
  const { data: rawWeeklyChecks } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      company_id,
      store_id,
      reporting_week,
      report_date,
      status,
      submitted_at,
      retailer_weekly_check_items (
        product_id,
        reported_remaining_qty,
        is_counted,
        estimated_movement,
        delivered_since_previous
      )
    `)
    .in("status", ["submitted", "approved"]);

  const weeklyChecksByCompanyId = new Map<string, WeeklyCheckInput[]>();
  if (rawWeeklyChecks) {
    for (const c of rawWeeklyChecks) {
      const list = weeklyChecksByCompanyId.get(c.company_id) || [];
      list.push({
        id: c.id,
        storeId: c.store_id,
        reportingWeek: c.reporting_week,
        reportDate: c.report_date,
        status: c.status,
        submittedAt: c.submitted_at,
        items: (c.retailer_weekly_check_items || []).map((itm: any) => ({
          productId: itm.product_id,
          reportedRemainingQty: itm.reported_remaining_qty,
          isCounted: itm.is_counted,
          estimatedMovement: itm.estimated_movement,
          deliveredSincePrevious: itm.delivered_since_previous,
        })),
      });
      weeklyChecksByCompanyId.set(c.company_id, list);
    }
  }

  // 5. Fetch profiles for user emails
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, email");

  const emailsByUserId = new Map<string, string>();
  if (profiles) {
    for (const p of profiles) {
      emailsByUserId.set(p.id, p.email);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;

  const reviews: AdminProtectionReviewItem[] = [];

  for (const prot of protections || []) {
    const comp = Array.isArray(prot.companies) ? prot.companies[0] : prot.companies;
    const prod = Array.isArray(prot.products) ? prot.products[0] : prot.products;
    if (!comp || !prod) continue;

    const resRecord = resolutionsByProtectionId.get(prot.id);

    const startDate = new Date(prot.trial_start_date + "T00:00:00");
    const endDate = new Date(prot.trial_end_date + "T00:00:00");
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerDay));
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / msPerDay));
    const isPeriodEnded = today.getTime() >= endDate.getTime();

    // Defensible aggregation without fabricating store numbers
    const baselineMovement = resolveLegacyBaselineMovement(prod.letusto_sku, prot.protected_quantity);
    const companyStores = storesByCompanyId.get(prot.company_id) || [];
    const companyChecks = weeklyChecksByCompanyId.get(prot.company_id) || [];

    const aggregated = aggregateProtectionMovement({
      productId: prot.product_id,
      companyProtectedQuantity: prot.protected_quantity,
      stores: companyStores,
      weeklyChecks: companyChecks,
      companyBaselineMovement: baselineMovement,
    });

    const estimatedMovement = aggregated.companyEstimatedMovement;
    const protectedQty = prot.protected_quantity || 1;
    const sellThroughPercent = aggregated.sellThroughPercent;
    const storesReporting = aggregated.storesReporting;
    const totalStores = aggregated.totalStores;
    const dataCoveragePercent = aggregated.storeParticipationRate;

    // Determine decision status
    let decision: AdminProtectionDecision = "pending";
    if (resRecord?.decision) {
      decision = resRecord.decision as AdminProtectionDecision;
    } else if (prot.status === "approved") {
      decision = "approved";
    } else if (prot.status === "rejected") {
      decision = "rejected";
    } else if (prot.status === "needs_information") {
      decision = "needs_information";
    } else if (prot.status === "review_requested") {
      decision = "pending";
    }

    // Resolve product thumbnail
    const rawImages = (prod.product_images as any[]) || [];
    const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    let thumbnailUrl: string | null = null;

    if (sortedImages.length > 0 && sortedImages[0]?.storage_path) {
      try {
        const { data: signed } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(sortedImages[0].storage_path, 7200);
        thumbnailUrl = signed?.signedUrl || null;
      } catch {
        thumbnailUrl = null;
      }
    }

    const info = (prod.price_additional_info as any) || {};
    const overrides = info.admin_overrides || {};
    const brand = Array.isArray(prod.brands) ? prod.brands[0] : (prod.brands as any) || {};
    const brandName = brand?.name || "K SELECT LAB";

    const effectiveSku =
      resolveEffectiveSku(overrides.letusto_sku, prod.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, prod.manufacture_sku) ||
      prod.letusto_sku ||
      "SKU-UNKNOWN";

    const productName = overrides.name?.trim() || prod.name;
    const productNameEn = overrides.name_en?.trim() || prod.name_en || null;

    reviews.push({
      id: prot.id,
      resolutionId: resRecord?.id || null,
      companyId: prot.company_id,
      companyName: comp.name,
      productId: prot.product_id,
      productName,
      productNameEn,
      brandName,
      sku: effectiveSku,
      category: prod.category || "skincare",
      categoryLabel: formatCategoryName(prod.category || prod.category_code),
      thumbnailUrl,
      requestedAt: resRecord?.requested_at || prot.review_requested_at || null,
      requestedByEmail: (prot.review_requested_by ? emailsByUserId.get(prot.review_requested_by) : null) || null,
      requestNotes: resRecord?.request_notes || prot.review_notes || null,
      trialStartDate: prot.trial_start_date,
      trialEndDate: prot.trial_end_date,
      daysElapsed,
      daysRemaining,
      isPeriodEnded,
      protectedQuantity: protectedQty,
      estimatedMovement,
      sellThroughPercent,
      dataCoveragePercent,
      storesReporting,
      totalStores,
      status: prot.status,
      decision,
      decisionAt: resRecord?.decision_at || null,
      decisionByEmail: (resRecord?.decision_by ? emailsByUserId.get(resRecord.decision_by) : null) || null,
      decisionNotes: resRecord?.decision_notes || null,
      approvedQuantity: resRecord?.approved_quantity ?? null,
      approvedCreditAmount: resRecord?.approved_credit_amount ? Number(resRecord.approved_credit_amount) : null,
      creditProcessingStatus: (resRecord?.credit_processing_status as CreditProcessingStatus) || "pending",
      isTest: prot.is_test || false,
    });
  }

  // Calculate counts for filters
  const counts: AdminProtectionReviewCounts = {
    all: reviews.length,
    pending: reviews.filter((r) => r.decision === "pending" && (r.status === "review_requested" || r.requestedAt !== null)).length,
    needs_information: reviews.filter((r) => r.decision === "needs_information").length,
    approved: reviews.filter((r) => r.decision === "approved").length,
    rejected: reviews.filter((r) => r.decision === "rejected").length,
  };

  return { reviews, counts, error: null };
}

/**
 * Fetch a single protection review detail for Admin inspection and decision
 */
export async function getAdminProtectionReviewDetail(
  protectionId: string
): Promise<GetAdminProtectionReviewDetailResult> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const { data: prot, error: protError } = await adminClient
    .from("retailer_initial_trial_protections")
    .select(`
      id,
      company_id,
      product_id,
      trial_start_date,
      trial_end_date,
      protected_quantity,
      status,
      activation_source,
      source_order_id,
      source_delivery_reference,
      review_requested_at,
      review_requested_by,
      review_notes,
      is_test,
      created_at,
      companies (
        id,
        name,
        contact_name,
        contact_phone
      ),
      products (
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
        status,
        trading_wholesale_price,
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
      )
    `)
    .eq("id", protectionId)
    .maybeSingle();

  if (protError) {
    console.error("[getAdminProtectionReviewDetail] Not found:", protectionId, protError);
    return { review: null, error: "Database error retrieving protection review detail." };
  }

  if (!prot) {
    return { review: null, error: null };
  }

  const comp = Array.isArray(prot.companies) ? prot.companies[0] : prot.companies;
  const prod = Array.isArray(prot.products) ? prot.products[0] : prot.products;
  if (!comp || !prod) return { review: null, error: null };

  // Fetch resolution record
  const { data: resRecord } = await adminClient
    .from("retailer_protection_resolutions")
    .select("*")
    .eq("protection_id", protectionId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  // Fetch stores
  const { data: stores } = await adminClient
    .from("stores")
    .select("id, name")
    .eq("company_id", prot.company_id)
    .order("name", { ascending: true });

  // Fetch source order if available
  let sourceOrderNumber: string | null = null;
  let initialTrialUnitCost: number | null = null;

  const storeInitialAllocations: Record<string, number> = {};

  if (prot.source_order_id) {
    const { data: order } = await adminClient
      .from("retailer_orders")
      .select("order_number, store_id")
      .eq("id", prot.source_order_id)
      .maybeSingle();

    if (order) {
      sourceOrderNumber = order.order_number;
      if (order.store_id) {
        storeInitialAllocations[order.store_id] = prot.protected_quantity;
      }
    }

    const { data: orderItem } = await adminClient
      .from("retailer_order_items")
      .select("unit_wholesale_price")
      .eq("order_id", prot.source_order_id)
      .eq("product_id", prot.product_id)
      .maybeSingle();

    if (orderItem) {
      initialTrialUnitCost = Number(orderItem.unit_wholesale_price);
    }
  }

  // Fetch requester and decision maker profiles
  let requestedByEmail: string | null = null;
  let decisionByEmail: string | null = null;

  if (prot.review_requested_by) {
    const { data: p } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", prot.review_requested_by)
      .maybeSingle();
    requestedByEmail = p?.email || null;
  }

  if (resRecord?.decision_by) {
    const { data: p } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", resRecord.decision_by)
      .maybeSingle();
    decisionByEmail = p?.email || null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(prot.trial_start_date + "T00:00:00");
  const endDate = new Date(prot.trial_end_date + "T00:00:00");
  const msPerDay = 1000 * 60 * 60 * 24;

  const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerDay));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / msPerDay));
  const isPeriodEnded = today.getTime() >= endDate.getTime();

  // Fetch weekly checks and check items for this company & product
  const { data: rawChecks } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      store_id,
      reporting_week,
      report_date,
      status,
      submitted_at,
      retailer_weekly_check_items (
        product_id,
        reported_remaining_qty,
        is_counted,
        estimated_movement,
        delivered_since_previous
      )
    `)
    .eq("company_id", prot.company_id)
    .in("status", ["submitted", "approved"]);

  const formattedChecks: WeeklyCheckInput[] = (rawChecks || []).map((c: any) => ({
    id: c.id,
    storeId: c.store_id,
    reportingWeek: c.reporting_week,
    reportDate: c.report_date,
    status: c.status,
    submittedAt: c.submitted_at,
    items: (c.retailer_weekly_check_items || []).map((itm: any) => ({
      productId: itm.product_id,
      reportedRemainingQty: itm.reported_remaining_qty,
      isCounted: itm.is_counted,
      estimatedMovement: itm.estimated_movement,
      deliveredSincePrevious: itm.delivered_since_previous,
    })),
  }));

  const baselineMovement = resolveLegacyBaselineMovement(prod.letusto_sku, prot.protected_quantity);

  const aggregated = aggregateProtectionMovement({
    productId: prot.product_id,
    companyProtectedQuantity: prot.protected_quantity,
    stores: stores || [],
    weeklyChecks: formattedChecks,
    storeInitialAllocations,
    companyBaselineMovement: baselineMovement,
  });

  const estimatedMovement = aggregated.companyEstimatedMovement;
  const protectedQty = prot.protected_quantity || 1;
  const sellThroughPercent = aggregated.sellThroughPercent;
  const storeBreakdown = aggregated.storeBreakdown;
  const totalStores = aggregated.totalStores;
  const storesReporting = aggregated.storesReporting;
  const dataCoveragePercent = aggregated.storeParticipationRate;

  let decision: AdminProtectionDecision = "pending";
  if (resRecord?.decision) {
    decision = resRecord.decision as AdminProtectionDecision;
  } else if (prot.status === "approved") {
    decision = "approved";
  } else if (prot.status === "rejected") {
    decision = "rejected";
  } else if (prot.status === "needs_information") {
    decision = "needs_information";
  }

  // Resolve product thumbnail
  const rawImages = (prod.product_images as any[]) || [];
  const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  let thumbnailUrl: string | null = null;

  if (sortedImages.length > 0 && sortedImages[0]?.storage_path) {
    try {
      const { data: signed } = await adminClient.storage
        .from("company-uploads")
        .createSignedUrl(sortedImages[0].storage_path, 7200);
      thumbnailUrl = signed?.signedUrl || null;
    } catch {
      thumbnailUrl = null;
    }
  }

  const info = (prod.price_additional_info as any) || {};
  const overrides = info.admin_overrides || {};
  const brand = Array.isArray(prod.brands) ? prod.brands[0] : (prod.brands as any) || {};
  const brandName = brand?.name || "K SELECT LAB";

  const effectiveSku =
    resolveEffectiveSku(overrides.letusto_sku, prod.letusto_sku) ||
    resolveEffectiveSku(overrides.manufacture_sku, prod.manufacture_sku) ||
    prod.letusto_sku ||
    "SKU-UNKNOWN";

  const productName = overrides.name?.trim() || prod.name;
  const productNameEn = overrides.name_en?.trim() || prod.name_en || null;

  return {
    review: {
      id: prot.id,
      resolutionId: resRecord?.id || null,
      companyId: prot.company_id,
      companyName: comp.name,
      companyContactEmail: null,
      companyPhone: comp.contact_phone || null,
      companyBusinessType: null,
      productId: prot.product_id,
      productName,
      productNameEn,
      brandName,
      sku: effectiveSku,
      category: prod.category || "skincare",
      categoryLabel: formatCategoryName(prod.category || prod.category_code),
      thumbnailUrl,
      productDescription: overrides.description || prod.description || null,
      productVolume: overrides.volume || prod.volume || null,
      productOrigin: formatCanonicalCountryName(overrides.origin || prod.origin) || "South Korea",
      currentCatalogWholesalePrice: prod.trading_wholesale_price ? Number(prod.trading_wholesale_price) : null,
      initialTrialUnitCost,
      activationSource: prot.activation_source || "initial_order",
      sourceOrderId: prot.source_order_id || null,
      sourceOrderNumber,
      sourceDeliveryReference: prot.source_delivery_reference || null,
      requestedAt: resRecord?.requested_at || prot.review_requested_at || null,
      requestedByEmail,
      requestNotes: resRecord?.request_notes || prot.review_notes || null,
      trialStartDate: prot.trial_start_date,
      trialEndDate: prot.trial_end_date,
      daysElapsed,
      daysRemaining,
      isPeriodEnded,
      protectedQuantity: protectedQty,
      estimatedMovement,
      sellThroughPercent,
      dataCoveragePercent,
      storesReporting,
      totalStores,
      status: prot.status,
      decision,
      decisionAt: resRecord?.decision_at || null,
      decisionByEmail,
      decisionNotes: resRecord?.decision_notes || null,
      approvedQuantity: resRecord?.approved_quantity ?? null,
      approvedCreditAmount: resRecord?.approved_credit_amount ? Number(resRecord.approved_credit_amount) : null,
      creditProcessingStatus: (resRecord?.credit_processing_status as CreditProcessingStatus) || "pending",
      storeBreakdown,
      movementBasis: aggregated.movementBasis,
      isTest: prot.is_test || false,
    },
    error: null,
  };
}

/**
 * Submit Admin Decision for a Protection Review
 */
export async function submitAdminProtectionDecisionAction(params: {
  protectionId: string;
  decision: "approved" | "rejected" | "needs_information";
  decisionNotes?: string;
  approvedQuantity?: number | null;
  approvedCreditAmount?: number | null;
}): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const adminClient = createAdminClient();

  const { protectionId, decision, decisionNotes, approvedQuantity, approvedCreditAmount } = params;

  if (!protectionId || !decision) {
    return { success: false, error: "Missing required protection ID or decision." };
  }

  if (decision === "rejected" && (!decisionNotes || !decisionNotes.trim())) {
    return { success: false, error: "A decision note is required when rejecting a protection review." };
  }

  if (decision === "needs_information" && (!decisionNotes || !decisionNotes.trim())) {
    return { success: false, error: "Please provide a note specifying the information needed from the retailer." };
  }

  try {
    // 1. Fetch protection record
    const { data: prot, error: findError } = await adminClient
      .from("retailer_initial_trial_protections")
      .select("id, company_id, product_id, is_test")
      .eq("id", protectionId)
      .maybeSingle();

    if (findError || !prot) {
      return { success: false, error: "Protection record not found." };
    }

    const now = new Date().toISOString();
    const creditProcessingStatus: CreditProcessingStatus =
      decision === "approved" ? "pending" : "not_applicable";

    // 2. Check existing resolution
    const { data: existingRes } = await adminClient
      .from("retailer_protection_resolutions")
      .select("id")
      .eq("protection_id", protectionId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (existingRes) {
      // Update existing resolution
      const { error: resUpdateErr } = await adminClient
        .from("retailer_protection_resolutions")
        .update({
          decision,
          decision_at: now,
          decision_by: session.userId,
          decision_notes: decisionNotes?.trim() || null,
          approved_quantity: decision === "approved" ? (approvedQuantity !== undefined ? approvedQuantity : null) : null,
          approved_credit_amount: decision === "approved" ? (approvedCreditAmount !== undefined ? approvedCreditAmount : null) : null,
          credit_processing_status: creditProcessingStatus,
          updated_at: now,
        })
        .eq("id", existingRes.id);

      if (resUpdateErr) throw resUpdateErr;
    } else {
      // Insert new resolution
      const { error: resInsertErr } = await adminClient
        .from("retailer_protection_resolutions")
        .insert({
          protection_id: protectionId,
          company_id: prot.company_id,
          product_id: prot.product_id,
          requested_at: now,
          decision,
          decision_at: now,
          decision_by: session.userId,
          decision_notes: decisionNotes?.trim() || null,
          approved_quantity: decision === "approved" ? (approvedQuantity !== undefined ? approvedQuantity : null) : null,
          approved_credit_amount: decision === "approved" ? (approvedCreditAmount !== undefined ? approvedCreditAmount : null) : null,
          credit_processing_status: creditProcessingStatus,
          is_test: prot.is_test || false,
        });

      if (resInsertErr) throw resInsertErr;
    }

    // 3. Update status on retailer_initial_trial_protections
    const newProtStatus =
      decision === "approved"
        ? "approved"
        : decision === "rejected"
        ? "rejected"
        : "needs_information";

    const { error: protUpdateErr } = await adminClient
      .from("retailer_initial_trial_protections")
      .update({
        status: newProtStatus,
        updated_at: now,
      })
      .eq("id", protectionId);

    if (protUpdateErr) throw protUpdateErr;

    // 4. Revalidate all relevant paths
    revalidatePath("/admin/protection-reviews");
    revalidatePath(`/admin/protection-reviews/${protectionId}`);
    revalidatePath("/admin");
    revalidatePath("/retailer/protection");
    revalidatePath(`/retailer/protection/${protectionId}`);
    revalidatePath("/protection");
    revalidatePath(`/protection/${protectionId}`);
    revalidatePath("/retailer");
    revalidatePath("/sales");

    return { success: true };
  } catch (err: any) {
    console.error("[submitAdminProtectionDecisionAction] Error:", err);
    return { success: false, error: err.message || "Failed to record decision." };
  }
}
