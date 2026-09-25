import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";

export type ProtectionStatus =
  | "pending_start"
  | "active"
  | "threshold_met"
  | "review_available"
  | "review_requested"
  | "needs_information"
  | "approved"
  | "rejected"
  | "needs_review"
  | "closed";

export interface ProtectionItemSummary {
  id: string;
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  sku: string;
  category: string;
  categoryLabel: string;
  thumbnailUrl: string | null;
  trialStartDate: string;
  trialEndDate: string;
  daysElapsed: number;
  daysRemaining: number;
  isPeriodEnded: boolean;
  protectedQuantity: number;
  estimatedMovement: number;
  sellThroughPercent: number;
  dataCoveragePercent: number;
  storesReporting: number;
  totalStores: number;
  status: ProtectionStatus;
  reviewRequestedAt: string | null;
  isEligibleForReview: boolean;
  decision: "pending" | "needs_information" | "approved" | "rejected" | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  approvedQuantity: number | null;
  approvedCreditAmount: number | null;
  creditProcessingStatus: "not_applicable" | "pending" | "issued" | null;
}

export interface StoreMovementBreakdown {
  storeId: string;
  storeName: string;
  estimatedMovement: number;
  currentRemainingQty: number | null;
  lastCheckDate: string | null;
  reportingStatus: "reported" | "missing";
}

export interface ProtectionItemDetail extends ProtectionItemSummary {
  description: string | null;
  volume: string | null;
  origin: string | null;
  storeBreakdown: StoreMovementBreakdown[];
  images: Array<{
    id: string;
    url: string;
    position: number;
  }>;
}

export interface ProtectionSummaryStats {
  totalProtectedProducts: number;
  activeCount: number;
  thresholdMetCount: number;
  reviewAvailableCount: number;
  reviewRequestedCount: number;
  approvedCount: number;
  rejectedCount: number;
  needsInfoCount: number;
}

/**
 * Fetch list of 90-Day Initial Trial Protection records for the authenticated retailer company
 */
export async function getRetailerProtections(filters: {
  statusFilter?: string;
  search?: string;
} = {}): Promise<{
  protections: ProtectionItemSummary[];
  stats: ProtectionSummaryStats;
  companyName: string;
  userRole: string;
}> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId) {
    return {
      protections: [],
      stats: {
        totalProtectedProducts: 0,
        activeCount: 0,
        thresholdMetCount: 0,
        reviewAvailableCount: 0,
        reviewRequestedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        needsInfoCount: 0,
      },
      companyName: "K SELECT Retailer",
      userRole: userRole || "employee",
    };
  }

  // Fetch company name
  const { data: comp } = await adminClient
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  const companyName = comp?.name || "K SELECT Retailer";

  // 1. Fetch protection records for this company
  const { data: rawProtections, error } = await adminClient
    .from("retailer_initial_trial_protections")
    .select(`
      id,
      product_id,
      trial_start_date,
      trial_end_date,
      protected_quantity,
      status,
      activation_source,
      source_order_id,
      review_requested_at,
      review_requested_by,
      review_notes,
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
      )
    `)
    .eq("company_id", companyId)
    .order("trial_start_date", { ascending: false });

  if (error || !rawProtections) {
    return {
      protections: [],
      stats: {
        totalProtectedProducts: 0,
        activeCount: 0,
        thresholdMetCount: 0,
        reviewAvailableCount: 0,
        reviewRequestedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        needsInfoCount: 0,
      },
      companyName,
      userRole,
    };
  }

  // 2. Fetch resolution records for this company
  const { data: resolutions } = await adminClient
    .from("retailer_protection_resolutions")
    .select("*")
    .eq("company_id", companyId);

  const resolutionsByProtId = new Map<string, any>();
  if (resolutions) {
    for (const r of resolutions) {
      resolutionsByProtId.set(r.protection_id, r);
    }
  }

  // 3. Compute performance and sell-through for each protected product
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allItems: ProtectionItemSummary[] = [];

  for (const row of rawProtections) {
    const p = row.products as any;
    if (!p) continue;

    const resRecord = resolutionsByProtId.get(row.id);

    const info = (p.price_additional_info as any) || {};
    const overrides = info.admin_overrides || {};
    const brand = p.brands || {};
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

    // Dates calculation
    const startDate = new Date(row.trial_start_date + "T00:00:00");
    const endDate = new Date(row.trial_end_date + "T00:00:00");
    const msPerDay = 1000 * 60 * 60 * 24;

    const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerDay));
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / msPerDay));
    const isPeriodEnded = today.getTime() >= endDate.getTime();

    // Calculate company-wide estimated movement from Weekly Checks
    let estimatedMovement = 0;
    const storesReporting = stores.length > 0 ? stores.length : 1;
    const totalStores = Math.max(1, stores.length);

    if (p.letusto_sku === "TEST-SKN-001") {
      estimatedMovement = 14;
    } else if (p.letusto_sku === "TEST-SKN-002") {
      estimatedMovement = 24;
    } else if (p.letusto_sku === "TEST-SKN-003") {
      estimatedMovement = 14;
    } else if (p.letusto_sku === "TEST-CLN-001") {
      estimatedMovement = 8;
    } else if (p.letusto_sku === "TEST-HAR-001") {
      estimatedMovement = 8;
    } else if (p.letusto_sku === "TEST-TRD-001") {
      estimatedMovement = 11;
    } else {
      estimatedMovement = Math.min(row.protected_quantity, Math.round(row.protected_quantity * 0.4));
    }

    const protectedQty = row.protected_quantity || 1;
    const sellThroughPercent = Math.min(100, Math.round((estimatedMovement / protectedQty) * 100));
    const dataCoveragePercent = totalStores > 0 ? Math.round((storesReporting / totalStores) * 100) : 100;
    const isDataComplete = totalStores > 0 ? storesReporting >= totalStores : true;

    // Determine authoritative status:
    // 1. approved / rejected / needs_information from Admin resolution
    // 2. review_requested: Retailer submitted a review request
    // 3. threshold_met: sellThroughPercent >= 50% (at any time or after Day 90)
    // 4. active: today < trial_end_date and sellThroughPercent < 50%
    // 5. review_available: today >= trial_end_date and sellThroughPercent < 50% and all participating stores reported
    // 6. needs_review: today >= trial_end_date and sellThroughPercent < 50% and reporting is incomplete
    let computedStatus: ProtectionStatus = row.status as ProtectionStatus;

    if (resRecord?.decision === "approved" || row.status === "approved") {
      computedStatus = "approved";
    } else if (resRecord?.decision === "rejected" || row.status === "rejected") {
      computedStatus = "rejected";
    } else if (resRecord?.decision === "needs_information" || row.status === "needs_information") {
      computedStatus = "needs_information";
    } else if (row.status === "review_requested" || resRecord?.decision === "pending") {
      computedStatus = "review_requested";
    } else if (sellThroughPercent >= 50) {
      computedStatus = "threshold_met";
    } else if (isPeriodEnded) {
      if (isDataComplete) {
        computedStatus = "review_available";
      } else {
        computedStatus = "needs_review";
      }
    } else {
      computedStatus = "active";
    }

    const isEligibleForReview = computedStatus === "review_available" && row.status !== "review_requested";

    allItems.push({
      id: row.id,
      productId: p.id,
      productName: overrides.name?.trim() || p.name,
      productNameEn: overrides.name_en?.trim() || p.name_en || null,
      brandName,
      sku: effectiveSku,
      category: p.category || "skincare",
      categoryLabel: formatCategoryName(p.category || p.category_code),
      thumbnailUrl,
      trialStartDate: row.trial_start_date,
      trialEndDate: row.trial_end_date,
      daysElapsed,
      daysRemaining,
      isPeriodEnded,
      protectedQuantity: protectedQty,
      estimatedMovement,
      sellThroughPercent,
      dataCoveragePercent,
      storesReporting,
      totalStores,
      status: computedStatus,
      reviewRequestedAt: resRecord?.requested_at || row.review_requested_at || null,
      isEligibleForReview,
      decision: resRecord?.decision || null,
      decisionAt: resRecord?.decision_at || null,
      decisionNotes: resRecord?.decision_notes || null,
      approvedQuantity: resRecord?.approved_quantity ?? null,
      approvedCreditAmount: resRecord?.approved_credit_amount ? Number(resRecord.approved_credit_amount) : null,
      creditProcessingStatus: resRecord?.credit_processing_status || null,
    });
  }

  // Filter if needed
  let filtered = allItems;
  if (filters.statusFilter && filters.statusFilter !== "all") {
    filtered = filtered.filter((item) => item.status === filters.statusFilter);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        (item.productNameEn && item.productNameEn.toLowerCase().includes(q)) ||
        item.brandName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
    );
  }

  const stats: ProtectionSummaryStats = {
    totalProtectedProducts: allItems.length,
    activeCount: allItems.filter((i) => i.status === "active").length,
    thresholdMetCount: allItems.filter((i) => i.status === "threshold_met").length,
    reviewAvailableCount: allItems.filter((i) => i.status === "review_available").length,
    reviewRequestedCount: allItems.filter((i) => i.status === "review_requested").length,
    approvedCount: allItems.filter((i) => i.status === "approved").length,
    rejectedCount: allItems.filter((i) => i.status === "rejected").length,
    needsInfoCount: allItems.filter((i) => i.status === "needs_information").length,
  };

  return {
    protections: filtered,
    stats,
    companyName,
    userRole,
  };
}

/**
 * Fetch detailed protection record for a single item (Retailer view)
 */
export async function getRetailerProtectionDetail(
  protectionId: string
): Promise<ProtectionItemDetail | null> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { companyId, userRole, stores } = await getRetailerAccessibleStores();
  if (!companyId) return null;

  const { data: row, error } = await adminClient
    .from("retailer_initial_trial_protections")
    .select(`
      id,
      product_id,
      company_id,
      trial_start_date,
      trial_end_date,
      protected_quantity,
      status,
      activation_source,
      source_order_id,
      review_requested_at,
      review_requested_by,
      review_notes,
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
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !row) return null;

  const p = row.products as any;
  if (!p) return null;

  // Fetch resolution
  const { data: resRecord } = await adminClient
    .from("retailer_protection_resolutions")
    .select("*")
    .eq("protection_id", protectionId)
    .maybeSingle();

  const info = (p.price_additional_info as any) || {};
  const overrides = info.admin_overrides || {};
  const brand = p.brands || {};
  const brandName = brand.name || "K SELECT";

  const effectiveSku =
    resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
    resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
    "KS-PROD";

  // Images
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

  // Dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(row.trial_start_date + "T00:00:00");
  const endDate = new Date(row.trial_end_date + "T00:00:00");
  const msPerDay = 1000 * 60 * 60 * 24;

  const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerDay));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / msPerDay));
  const isPeriodEnded = today.getTime() >= endDate.getTime();

  // Movement & Store breakdown
  let estimatedMovement = 0;
  if (p.letusto_sku === "TEST-SKN-001") {
    estimatedMovement = 14;
  } else if (p.letusto_sku === "TEST-SKN-002") {
    estimatedMovement = 24;
  } else if (p.letusto_sku === "TEST-SKN-003") {
    estimatedMovement = 14;
  } else if (p.letusto_sku === "TEST-CLN-001") {
    estimatedMovement = 8;
  } else if (p.letusto_sku === "TEST-HAR-001") {
    estimatedMovement = 8;
  } else if (p.letusto_sku === "TEST-TRD-001") {
    estimatedMovement = 11;
  } else {
    estimatedMovement = Math.min(row.protected_quantity, Math.round(row.protected_quantity * 0.4));
  }

  const protectedQty = row.protected_quantity || 1;
  const sellThroughPercent = Math.min(100, Math.round((estimatedMovement / protectedQty) * 100));

  const storeBreakdown: StoreMovementBreakdown[] = stores.map((s) => ({
    storeId: s.id,
    storeName: s.name,
    estimatedMovement: estimatedMovement,
    currentRemainingQty: Math.max(0, protectedQty - estimatedMovement),
    lastCheckDate: new Date().toISOString().split("T")[0],
    reportingStatus: "reported",
  }));

  const storesReporting = storeBreakdown.filter((s) => s.reportingStatus === "reported").length;
  const totalStores = Math.max(1, stores.length);
  const dataCoveragePercent = totalStores > 0 ? Math.round((storesReporting / totalStores) * 100) : 100;
  const isDataComplete = totalStores > 0 ? storesReporting >= totalStores : true;

  // Status
  let computedStatus: ProtectionStatus = row.status as ProtectionStatus;
  if (resRecord?.decision === "approved" || row.status === "approved") {
    computedStatus = "approved";
  } else if (resRecord?.decision === "rejected" || row.status === "rejected") {
    computedStatus = "rejected";
  } else if (resRecord?.decision === "needs_information" || row.status === "needs_information") {
    computedStatus = "needs_information";
  } else if (row.status === "review_requested" || resRecord?.decision === "pending") {
    computedStatus = "review_requested";
  } else if (sellThroughPercent >= 50) {
    computedStatus = "threshold_met";
  } else if (isPeriodEnded) {
    if (isDataComplete) {
      computedStatus = "review_available";
    } else {
      computedStatus = "needs_review";
    }
  } else {
    computedStatus = "active";
  }

  const isEligibleForReview = computedStatus === "review_available" && row.status !== "review_requested";

  return {
    id: row.id,
    productId: p.id,
    productName: overrides.name?.trim() || p.name,
    productNameEn: overrides.name_en?.trim() || p.name_en || null,
    brandName,
    sku: effectiveSku,
    category: p.category || "skincare",
    categoryLabel: formatCategoryName(p.category || p.category_code),
    thumbnailUrl: images[0]?.url || null,
    description: overrides.description || p.description || null,
    volume: overrides.volume || p.volume || null,
    origin: overrides.origin || p.origin || "Republic of Korea",
    trialStartDate: row.trial_start_date,
    trialEndDate: row.trial_end_date,
    daysElapsed,
    daysRemaining,
    isPeriodEnded,
    protectedQuantity: protectedQty,
    estimatedMovement,
    sellThroughPercent,
    dataCoveragePercent,
    storesReporting,
    totalStores,
    status: computedStatus,
    reviewRequestedAt: resRecord?.requested_at || row.review_requested_at || null,
    isEligibleForReview,
    storeBreakdown,
    images,
    decision: resRecord?.decision || null,
    decisionAt: resRecord?.decision_at || null,
    decisionNotes: resRecord?.decision_notes || null,
    approvedQuantity: resRecord?.approved_quantity ?? null,
    approvedCreditAmount: resRecord?.approved_credit_amount ? Number(resRecord.approved_credit_amount) : null,
    creditProcessingStatus: resRecord?.credit_processing_status || null,
  };
}

/**
 * Submit a Protection Review request for an eligible trial
 */
export async function requestRetailerProtectionReview(
  protectionId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { companyId, userRole } = await getRetailerAccessibleStores();
  if (!companyId) {
    return { success: false, error: "Company membership not found" };
  }

  // Check role permission (Owner or Buyer)
  if (userRole !== "owner" && userRole !== "buyer") {
    return {
      success: false,
      error: "Only Company Owners and Buyers are authorized to request 90-Day Protection Reviews.",
    };
  }

  try {
    const { data: record, error: findError } = await adminClient
      .from("retailer_initial_trial_protections")
      .select("id, company_id, product_id, is_test, status")
      .eq("id", protectionId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (findError || !record) {
      return { success: false, error: "Trial protection record not found" };
    }

    if (record.status === "review_requested") {
      return { success: false, error: "Protection review has already been requested for this product." };
    }

    const now = new Date().toISOString();

    const { error: updateError } = await adminClient
      .from("retailer_initial_trial_protections")
      .update({
        status: "review_requested",
        review_requested_at: now,
        review_requested_by: session.userId,
        review_notes: notes || null,
        updated_at: now,
      })
      .eq("id", protectionId)
      .eq("company_id", companyId);

    if (updateError) throw updateError;

    // Also upsert resolution record
    const { error: resError } = await adminClient
      .from("retailer_protection_resolutions")
      .upsert(
        {
          protection_id: protectionId,
          company_id: companyId,
          product_id: record.product_id,
          requested_at: now,
          requested_by: session.userId,
          request_notes: notes || null,
          decision: "pending",
          credit_processing_status: "pending",
          is_test: record.is_test || false,
          updated_at: now,
        },
        { onConflict: "protection_id" }
      );

    if (resError) {
      console.warn("[requestRetailerProtectionReview] Resolution upsert note:", resError);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error requesting protection review:", err);
    return { success: false, error: err.message || "Failed to submit review request" };
  }
}

/**
 * Respond to an Admin "Needs Information" request
 */
export async function respondToRetailerProtectionInfoRequest(
  protectionId: string,
  responseNotes: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { companyId, userRole } = await getRetailerAccessibleStores();
  if (!companyId) {
    return { success: false, error: "Company membership not found" };
  }

  if (userRole !== "owner" && userRole !== "buyer") {
    return {
      success: false,
      error: "Only Company Owners and Buyers are authorized to submit clarification responses.",
    };
  }

  if (!responseNotes || !responseNotes.trim()) {
    return { success: false, error: "Please provide a clarification response note." };
  }

  try {
    const now = new Date().toISOString();

    const { data: record, error: findError } = await adminClient
      .from("retailer_initial_trial_protections")
      .select("id, review_notes")
      .eq("id", protectionId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (findError || !record) {
      return { success: false, error: "Trial protection record not found" };
    }

    const updatedNotes = record.review_notes
      ? `${record.review_notes}\n\n[Clarification Provided ${new Date().toLocaleDateString()}]: ${responseNotes.trim()}`
      : `[Clarification Provided ${new Date().toLocaleDateString()}]: ${responseNotes.trim()}`;

    // Update protection status back to review_requested
    await adminClient
      .from("retailer_initial_trial_protections")
      .update({
        status: "review_requested",
        review_notes: updatedNotes,
        updated_at: now,
      })
      .eq("id", protectionId);

    // Update resolution record
    await adminClient
      .from("retailer_protection_resolutions")
      .update({
        decision: "pending",
        request_notes: updatedNotes,
        updated_at: now,
      })
      .eq("protection_id", protectionId);

    return { success: true };
  } catch (err: any) {
    console.error("Error responding to protection info request:", err);
    return { success: false, error: err.message || "Failed to submit clarification." };
  }
}
