import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { resolveAuthoritativeProductImages } from "@/lib/retailer/product-images";

// ==============================================================================
// Types for Admin Retailer Training Analytics (ADM-TRAINING-P2-001)
// ==============================================================================

export interface Retailer360TrainingSummary {
  storeCoveragePercent: number | null; // e.g. 75 or null if no eligible published modules
  coveredPairsCount: number;          // Count of covered (Store, Product) pairs
  eligiblePairsCount: number;         // Count of eligible published (Store, Product) pairs
  coveredProductsCount: number;       // Distinct published products covered by at least 1 store
  eligiblePublishedProductsCount: number; // Distinct published products carried by at least 1 store
  totalCompanyProductsCount: number;  // Total distinct company assortment/ordered products
  employeesTrainedCount: number;      // Distinct employees with at least 1 verified completion
  totalEmployeesCount: number;        // Total active company staff members
  trainingGapsCount: number;          // eligiblePairsCount - coveredPairsCount
}

export interface Retailer360StoreProductDetail {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  sku: string;
  brandName: string;
  category: string;
  thumbnailUrl?: string | null;
  trainingStatus: "published" | "draft" | "in_review" | "unavailable";
  trainingVersion: string;
  versionType?: "minor" | "major" | null;
  coverageStatus: "covered" | "needs_training" | "not_available";
  qualifiedEmployees: string[];
  latestPassDate: string | null;
}

export interface Retailer360StoreCoverageItem {
  storeId: string;
  storeName: string;
  city?: string | null;
  state?: string | null;
  publishedProductsCount: number;     // Denominator: published products relevant to this store
  coveredProductsCount: number;       // At least 1 assigned employee has a qualifying pass
  needsTrainingCount: number;         // publishedProductsCount - coveredProductsCount
  coveragePercent: number | null;     // null if publishedProductsCount === 0 -> "N/A"
  lastCompletedAt: string | null;     // ISO timestamp of latest completion by assigned employee
  assignedEmployeesCount: number;     // Count of employees assigned to this store
  assignedEmployeeNames: string[];    // Names of assigned staff
  products: Retailer360StoreProductDetail[]; // Per-store product breakdown for drill-down
}

export interface Retailer360EmployeeProductCompletionDetail {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  sku: string;
  brandName: string;
  category: string;
  thumbnailUrl?: string | null;
  trainingVersion: string;
  isCompleted: boolean;
  completedAt: string | null;
  isVerifiedQuiz: boolean;
  versionStatus: "valid" | "not_started";
  relevantStoreNames: string[];
}

export interface Retailer360EmployeeTrainingItem {
  userId: string;
  userName: string;
  email: string;
  role: string;
  assignedStores: { id: string; name: string }[];
  hasAllStoresAccess: boolean;
  productsCompletedCount: number;
  availablePublishedCount: number;
  completionPercent: number;
  latestCompletionAt: string | null;
  status: "certified" | "in_progress" | "not_started";
  completions: Retailer360EmployeeProductCompletionDetail[];
}

export interface Retailer360TrainingGapStoreDetail {
  storeId: string;
  storeName: string;
  isCovered: boolean;
  coveringEmployees: string[];
}

export interface Retailer360TrainingGapItem {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  sku: string;
  brandName: string;
  category: string;
  thumbnailUrl?: string | null;
  trainingStatus: "published" | "draft" | "in_review" | "unavailable";
  trainingVersion: string;
  eligibleStores: Retailer360TrainingGapStoreDetail[];
  coveredStoresCount: number;
  eligibleStoresCount: number;
  status: "covered" | "partial" | "needs_training" | "unavailable";
}

export interface Retailer360TrainingLegacyItem {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  brandName: string;
  sku: string;
  category: string;
  completedUsersCount: number;
  totalEligibleUsersCount: number;
  completionPercent: number;
}

export interface RetailerTrainingAnalyticsData {
  summary: Retailer360TrainingSummary;
  stores: Retailer360StoreCoverageItem[];
  employees: Retailer360EmployeeTrainingItem[];
  gaps: Retailer360TrainingGapItem[];
  // Backwards-compatibility fields for legacy Tab 7 callers
  products: Retailer360TrainingLegacyItem[];
  overallCompletionPercent: number;
  totalProductsCount: number;
}

// ==============================================================================
// Authoritative Validation for Server-Verified Quiz Completions
// ==============================================================================

/**
 * Shared Authoritative Validator for Server-Verified Quiz Completions
 * Criteria per DEPLOY-STD-001 / ADM-TRAINING-P2-001-R1:
 * - status === 'completed'
 * - completed_at is not null
 * - completion_type is NOT 'LEGACY_SELF_REPORTED'
 * - If quiz score/total exist, quiz_score === quiz_total (100% server-graded pass)
 */
export function isServerVerifiedTrainingPass(progress: {
  status?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  completion_type?: string | null;
  quiz_score?: number | null;
  quiz_total?: number | null;
}): boolean {
  if (progress.status !== "completed") return false;
  const completedAt = progress.completed_at || progress.completedAt;
  if (!completedAt) return false;
  if (progress.completion_type === "LEGACY_SELF_REPORTED") return false;
  if (
    progress.quiz_score !== undefined &&
    progress.quiz_score !== null &&
    progress.quiz_total !== undefined &&
    progress.quiz_total !== null &&
    progress.quiz_total > 0
  ) {
    if (progress.quiz_score < progress.quiz_total) return false;
  }
  return true;
}

// ==============================================================================
// Authoritative Computation Function
// ==============================================================================

interface ComputeOptions {
  companyId: string;
  stores: Array<{ id: string; name: string; city?: string | null; state?: string | null }>;
  members: Array<{
    id: string;
    fullName?: string | null;
    email?: string | null;
    role: string;
    hasAllStoresAccess?: boolean;
    assignedStores?: Array<{ id: string; name: string }>;
  }>;
  adminClient: SupabaseClient;
}

export async function computeRetailerTrainingAnalytics({
  companyId,
  stores,
  members,
  adminClient,
}: ComputeOptions): Promise<RetailerTrainingAnalyticsData> {
  const storeIds = stores.map((s) => s.id);

  // 1. Fetch Store Assortments across all stores of this company
  // Union: retailer_store_products + non-cancelled retailer_orders + submitted retailer_weekly_checks
  const storeProductsMap = new Map<string, Set<string>>();
  stores.forEach((st) => storeProductsMap.set(st.id, new Set<string>()));
  const allCompanyProductIds = new Set<string>();

  // A. Active store assortment products
  try {
    const { data: spRows } = await adminClient
      .from("retailer_store_products")
      .select("product_id, store_id")
      .eq("company_id", companyId)
      .eq("is_active", true);

    (spRows || []).forEach((row) => {
      if (row.product_id && row.store_id && storeProductsMap.has(row.store_id)) {
        storeProductsMap.get(row.store_id)!.add(row.product_id);
        allCompanyProductIds.add(row.product_id);
      }
    });
  } catch (err) {
    console.warn("[Training Analytics] Error fetching retailer_store_products:", err);
  }

  // B. Products from non-cancelled orders
  try {
    const { data: ordRows } = await adminClient
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

    (ordRows || []).forEach((ord) => {
      const targetStoreId = ord.store_id;
      const items = (ord.retailer_order_items as any[]) || [];
      items.forEach((it) => {
        if (!it.product_id) return;
        allCompanyProductIds.add(it.product_id);
        if (targetStoreId && storeProductsMap.has(targetStoreId)) {
          storeProductsMap.get(targetStoreId)!.add(it.product_id);
        } else if (storeIds.length === 1) {
          storeProductsMap.get(storeIds[0])!.add(it.product_id);
        }
      });
    });
  } catch (err) {
    console.warn("[Training Analytics] Error fetching retailer_orders:", err);
  }

  // C. Products from submitted weekly checks
  try {
    const { data: chkRows } = await adminClient
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

    (chkRows || []).forEach((chk) => {
      const targetStoreId = chk.store_id;
      const items = (chk.retailer_weekly_check_items as any[]) || [];
      items.forEach((it) => {
        if (!it.is_counted || !it.product_id) return;
        allCompanyProductIds.add(it.product_id);
        if (targetStoreId && storeProductsMap.has(targetStoreId)) {
          storeProductsMap.get(targetStoreId)!.add(it.product_id);
        }
      });
    });
  } catch (err) {
    console.warn("[Training Analytics] Error fetching retailer_weekly_checks:", err);
  }

  const distinctProductIds = Array.from(allCompanyProductIds);

  // 2. Fetch Catalog Details, Images & Training Content for candidate products
  const productCatalogMap = new Map<string, any>();
  const trainingContentMap = new Map<string, any>();
  let productImagesMap: Record<string, { primaryUrl: string | null; galleryUrls: string[] }> = {};

  if (distinctProductIds.length > 0) {
    try {
      const [prodsRes, tContentsRes, imagesResult] = await Promise.all([
        adminClient
          .from("products")
          .select(`
            id,
            name,
            name_en,
            category,
            category_code,
            letusto_sku,
            manufacture_sku,
            price_additional_info,
            brands (
              id,
              name
            )
          `)
          .in("id", distinctProductIds),
        adminClient
          .from("retailer_product_training_content")
          .select(`
            product_id,
            status,
            is_published,
            version,
            version_type,
            quiz_questions,
            published_at
          `)
          .in("product_id", distinctProductIds),
        resolveAuthoritativeProductImages(adminClient, distinctProductIds),
      ]);

      (prodsRes.data || []).forEach((p) => productCatalogMap.set(p.id, p));
      (tContentsRes.data || []).forEach((tc) => trainingContentMap.set(tc.product_id, tc));
      productImagesMap = imagesResult || {};
    } catch (err) {
      console.warn("[Training Analytics] Error fetching catalog & training data:", err);
    }
  }

  // 3. Fetch Verified Employee Completions for this Company
  // Defensively handle progress query with or without completion_type column
  type UserCompletionEntry = { completedAt: string; isVerified: boolean; isLegacy?: boolean };
  const userCompletionsMap = new Map<string, Map<string, UserCompletionEntry>>();
  try {
    let progRows: any[] = [];
    const res = await adminClient
      .from("retailer_product_training_progress")
      .select("product_id, user_id, status, completed_at, completion_type, quiz_score, quiz_total, quiz_version")
      .eq("company_id", companyId)
      .eq("status", "completed");

    if (res.error) {
      // Column completion_type might not exist in database if 0171 was held
      const fallbackRes = await adminClient
        .from("retailer_product_training_progress")
        .select("product_id, user_id, status, completed_at")
        .eq("company_id", companyId)
        .eq("status", "completed");
      progRows = fallbackRes.data || [];
    } else {
      progRows = res.data || [];
    }

    (progRows || []).forEach((row) => {
      // Exclude unverified legacy completions from verified store coverage calculation
      const isVerified = isServerVerifiedTrainingPass(row);
      const isLegacy = row.completion_type === "LEGACY_SELF_REPORTED";
      if (!userCompletionsMap.has(row.user_id)) {
        userCompletionsMap.set(row.user_id, new Map());
      }
      userCompletionsMap.get(row.user_id)!.set(row.product_id, {
        completedAt: row.completed_at || new Date().toISOString(),
        isLegacy,
        isVerified,
      });
    });
  } catch (err) {
    console.warn("[Training Analytics] Error fetching training progress:", err);
  }

  // 4. Map Members to Stores
  // Rules (Section 8):
  // - If member is 'owner' or hasAllStoresAccess === true: assigned to ALL stores
  // - Else if member has explicit assignedStores: assigned to those stores
  // - Else: Unassigned / Needs Review (personal passes preserved, but do NOT cover any store)
  const storeAssignedMembersMap = new Map<string, Array<{ id: string; name: string }>>();
  stores.forEach((st) => storeAssignedMembersMap.set(st.id, []));

  const memberNormalizedStoreMap = new Map<string, Set<string>>();

  members.forEach((m) => {
    const isAllStores = m.role === "owner" || Boolean(m.hasAllStoresAccess);
    const assignedSet = new Set<string>();

    if (isAllStores) {
      stores.forEach((st) => {
        assignedSet.add(st.id);
        storeAssignedMembersMap.get(st.id)?.push({
          id: m.id,
          name: m.fullName || m.email || "Staff Member",
        });
      });
    } else {
      (m.assignedStores || []).forEach((st) => {
        assignedSet.add(st.id);
        storeAssignedMembersMap.get(st.id)?.push({
          id: m.id,
          name: m.fullName || m.email || "Staff Member",
        });
      });
    }
    memberNormalizedStoreMap.set(m.id, assignedSet);
  });

  // Helper to check if a product has published training
  const isPublishedTraining = (productId: string) => {
    const tc = trainingContentMap.get(productId);
    if (!tc) return false;
    return tc.status === "published" || tc.is_published === true;
  };

  // 5. Compute Store-by-Store Coverage & Store Product Breakdown
  // Coverage Rule: Store S & Product P Covered = TRUE only when at least 1 qualifying employee
  // assigned to Store S has completed Product P.
  let totalEligiblePairs = 0;
  let totalCoveredPairs = 0;
  const storeCoverageItems: Retailer360StoreCoverageItem[] = [];

  stores.forEach((st) => {
    const rawStoreProductIds = Array.from(storeProductsMap.get(st.id) || []);
    // Fallback: If company has products and store has no explicit assortment, use company products
    const effectiveStoreProductIds =
      rawStoreProductIds.length > 0
        ? rawStoreProductIds
        : stores.length === 1
        ? distinctProductIds
        : rawStoreProductIds;

    // Count only published training products in this store's scope
    const publishedProducts = effectiveStoreProductIds.filter(isPublishedTraining);
    const publishedCount = publishedProducts.length;

    const assignedStaff = storeAssignedMembersMap.get(st.id) || [];
    const assignedUserIds = assignedStaff.map((u) => u.id);

    let coveredCount = 0;
    let latestTimestamp: string | null = null;

    // Build store product drill-down list
    const storeProductDetailList: Retailer360StoreProductDetail[] = effectiveStoreProductIds.map((pId) => {
      const p = productCatalogMap.get(pId);
      const tc = trainingContentMap.get(pId);
      const isPub = isPublishedTraining(pId);

      const coveringStaff: string[] = [];
      let latestPassForProd: string | null = null;

      assignedUserIds.forEach((uId) => {
        const userComp = userCompletionsMap.get(uId)?.get(pId);
        // Exclude legacy unverified self-reported records; require server-verified pass
        if (userComp && userComp.isVerified) {
          const staffMember = assignedStaff.find((s) => s.id === uId);
          if (staffMember) {
            coveringStaff.push(staffMember.name);
          }
          if (!latestPassForProd || new Date(userComp.completedAt) > new Date(latestPassForProd)) {
            latestPassForProd = userComp.completedAt;
          }
          if (!latestTimestamp || new Date(userComp.completedAt) > new Date(latestTimestamp)) {
            latestTimestamp = userComp.completedAt;
          }
        }
      });

      const isCovered = isPub && coveringStaff.length > 0;
      if (isCovered) {
        coveredCount++;
      }

      const coverageStatus: "covered" | "needs_training" | "not_available" =
        !isPub ? "not_available" : isCovered ? "covered" : "needs_training";

      const overrides = (p?.price_additional_info as any)?.admin_overrides || {};
      const sku =
        resolveEffectiveSku(overrides.letusto_sku, p?.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p?.manufacture_sku) ||
        "KS-SKU";

      return {
        productId: pId,
        productName: p?.name || "Product Training Guide",
        productNameEn: p?.name_en,
        sku,
        brandName: p?.brands?.name || "K SELECT Brand",
        category: formatCategoryName(p?.category || p?.category_code),
        thumbnailUrl: productImagesMap[pId]?.primaryUrl || null,
        trainingStatus: !tc
          ? "unavailable"
          : tc.status === "draft"
          ? "draft"
          : tc.status === "in_review"
          ? "in_review"
          : isPub
          ? "published"
          : "unavailable",
        trainingVersion: tc?.version || "1.0.0",
        versionType: tc?.version_type || "minor",
        coverageStatus,
        qualifiedEmployees: coveringStaff,
        latestPassDate: latestPassForProd,
      };
    });

    const needsCount = Math.max(0, publishedCount - coveredCount);
    const pct = publishedCount > 0 ? Math.round((coveredCount / publishedCount) * 100) : null;

    totalEligiblePairs += publishedCount;
    totalCoveredPairs += coveredCount;

    storeCoverageItems.push({
      storeId: st.id,
      storeName: st.name,
      city: st.city,
      state: st.state,
      publishedProductsCount: publishedCount,
      coveredProductsCount: coveredCount,
      needsTrainingCount: needsCount,
      coveragePercent: pct,
      lastCompletedAt: latestTimestamp,
      assignedEmployeesCount: assignedStaff.length,
      assignedEmployeeNames: assignedStaff.map((s) => s.name),
      products: storeProductDetailList,
    });
  });

  // 6. Compute Employee Completion View & Drill-Down
  const employeeItems: Retailer360EmployeeTrainingItem[] = [];
  const employeesWithPasses = new Set<string>();

  // Determine list of all published products across the company
  const companyPublishedProductIds = distinctProductIds.filter(isPublishedTraining);

  members.forEach((m) => {
    const assignedStoreIds = memberNormalizedStoreMap.get(m.id) || new Set<string>();

    // Available published trainings relevant to this employee's assigned stores
    const employeeEligibleProductIds = new Set<string>();
    assignedStoreIds.forEach((stId) => {
      const stProds = storeProductsMap.get(stId) || new Set<string>();
      stProds.forEach((pId) => {
        if (isPublishedTraining(pId)) {
          employeeEligibleProductIds.add(pId);
        }
      });
    });

    // If employee is assigned to all stores or no store products yet, fallback to company-wide published
    const targetProductIds =
      employeeEligibleProductIds.size > 0
        ? Array.from(employeeEligibleProductIds)
        : companyPublishedProductIds;

    const userComps = userCompletionsMap.get(m.id) || new Map<string, UserCompletionEntry>();

    let completedCount = 0;
    let latestDate: string | null = null;
    const detailList: Retailer360EmployeeProductCompletionDetail[] = [];

    // Relevant store names for this employee
    const assignedStoreObjs = stores.filter((s) => assignedStoreIds.has(s.id));
    const assignedStoreNames = assignedStoreObjs.map((s) => s.name);

    targetProductIds.forEach((pId) => {
      const p = productCatalogMap.get(pId);
      const tc = trainingContentMap.get(pId);
      const comp = userComps.get(pId);
      const isComp = Boolean(comp && comp.isVerified);

      if (isComp) {
        completedCount++;
        employeesWithPasses.add(m.id);
        if (!latestDate || (comp && new Date(comp.completedAt) > new Date(latestDate))) {
          latestDate = comp!.completedAt;
        }
      }

      const overrides = (p?.price_additional_info as any)?.admin_overrides || {};
      const sku =
        resolveEffectiveSku(overrides.letusto_sku, p?.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p?.manufacture_sku) ||
        "KS-SKU";

      detailList.push({
        productId: pId,
        productName: p?.name || "Product Training Guide",
        productNameEn: p?.name_en,
        sku,
        brandName: p?.brands?.name || "K SELECT Brand",
        category: formatCategoryName(p?.category || p?.category_code),
        thumbnailUrl: productImagesMap[pId]?.primaryUrl || null,
        trainingVersion: tc?.version || "1.0.0",
        isCompleted: isComp,
        completedAt: comp?.completedAt || null,
        isVerifiedQuiz: Boolean(tc?.quiz_questions && tc.quiz_questions.length > 0),
        versionStatus: isComp ? "valid" : "not_started",
        relevantStoreNames: assignedStoreNames,
      });
    });

    const availCount = targetProductIds.length;
    const pct = availCount > 0 ? Math.round((completedCount / availCount) * 100) : 0;
    const status: "certified" | "in_progress" | "not_started" =
      pct === 100 && availCount > 0
        ? "certified"
        : completedCount > 0
        ? "in_progress"
        : "not_started";

    employeeItems.push({
      userId: m.id,
      userName: m.fullName || m.email?.split("@")[0] || "Staff Member",
      email: m.email || "No email",
      role: m.role,
      assignedStores: assignedStoreObjs.map((s) => ({ id: s.id, name: s.name })),
      hasAllStoresAccess: Boolean(m.role === "owner" || m.hasAllStoresAccess),
      productsCompletedCount: completedCount,
      availablePublishedCount: availCount,
      completionPercent: pct,
      latestCompletionAt: latestDate,
      status,
      completions: detailList,
    });
  });

  // 7. Compute Product Training Gaps View
  const gapItems: Retailer360TrainingGapItem[] = [];
  const distinctCoveredProductIds = new Set<string>();

  distinctProductIds.forEach((pId) => {
    const p = productCatalogMap.get(pId);
    const tc = trainingContentMap.get(pId);

    const overrides = (p?.price_additional_info as any)?.admin_overrides || {};
    const sku =
      resolveEffectiveSku(overrides.letusto_sku, p?.letusto_sku) ||
      resolveEffectiveSku(overrides.manufacture_sku, p?.manufacture_sku) ||
      "KS-SKU";

    // Determine publication status
    const trainingStatus: "published" | "draft" | "in_review" | "unavailable" = !tc
      ? "unavailable"
      : tc.status === "draft"
      ? "draft"
      : tc.status === "in_review"
      ? "in_review"
      : tc.status === "published" || tc.is_published === true
      ? "published"
      : "unavailable";

    // Eligible stores carrying this product
    const eligibleStoresList: Retailer360TrainingGapStoreDetail[] = [];
    let coveredCount = 0;

    stores.forEach((st) => {
      const carried =
        storeProductsMap.get(st.id)?.has(pId) ||
        (stores.length === 1 && allCompanyProductIds.has(pId));
      if (!carried) return;

      const assignedStaff = storeAssignedMembersMap.get(st.id) || [];
      const coveringEmployees: string[] = [];

      assignedStaff.forEach((staff) => {
        const comp = userCompletionsMap.get(staff.id)?.get(pId);
        if (comp && comp.isVerified) {
          coveringEmployees.push(staff.name);
        }
      });

      const isStoreCovered = coveringEmployees.length > 0;
      if (isStoreCovered) {
        coveredCount++;
        distinctCoveredProductIds.add(pId);
      }

      eligibleStoresList.push({
        storeId: st.id,
        storeName: st.name,
        isCovered: isStoreCovered,
        coveringEmployees,
      });
    });

    const eligibleStoresCount = eligibleStoresList.length;
    let gapStatus: "covered" | "partial" | "needs_training" | "unavailable" = "unavailable";

    if (trainingStatus !== "published") {
      gapStatus = "unavailable";
    } else if (eligibleStoresCount > 0 && coveredCount === eligibleStoresCount) {
      gapStatus = "covered";
    } else if (coveredCount > 0) {
      gapStatus = "partial";
    } else {
      gapStatus = "needs_training";
    }

    gapItems.push({
      productId: pId,
      productName: p?.name || "Product Guide",
      productNameEn: p?.name_en,
      sku,
      brandName: p?.brands?.name || "K SELECT Brand",
      category: formatCategoryName(p?.category || p?.category_code),
      thumbnailUrl: productImagesMap[pId]?.primaryUrl || null,
      trainingStatus,
      trainingVersion: tc?.version || "1.0.0",
      eligibleStores: eligibleStoresList,
      coveredStoresCount: coveredCount,
      eligibleStoresCount,
      status: gapStatus,
    });
  });

  // 8. Company Summary KPIs
  const storeCoveragePercent =
    totalEligiblePairs > 0 ? Math.round((totalCoveredPairs / totalEligiblePairs) * 100) : null;

  const summary: Retailer360TrainingSummary = {
    storeCoveragePercent,
    coveredPairsCount: totalCoveredPairs,
    eligiblePairsCount: totalEligiblePairs,
    coveredProductsCount: distinctCoveredProductIds.size,
    eligiblePublishedProductsCount: companyPublishedProductIds.length,
    totalCompanyProductsCount: distinctProductIds.length,
    employeesTrainedCount: employeesWithPasses.size,
    totalEmployeesCount: members.length,
    trainingGapsCount: Math.max(0, totalEligiblePairs - totalCoveredPairs),
  };

  // Legacy list for backward compatibility
  const legacyProducts: Retailer360TrainingLegacyItem[] = gapItems.map((g) => ({
    productId: g.productId,
    productName: g.productName,
    productNameEn: g.productNameEn,
    brandName: g.brandName,
    sku: g.sku,
    category: g.category,
    completedUsersCount: g.coveredStoresCount,
    totalEligibleUsersCount: g.eligibleStoresCount,
    completionPercent:
      g.eligibleStoresCount > 0 ? Math.round((g.coveredStoresCount / g.eligibleStoresCount) * 100) : 0,
  }));

  return {
    summary,
    stores: storeCoverageItems,
    employees: employeeItems,
    gaps: gapItems,
    products: legacyProducts,
    overallCompletionPercent: storeCoveragePercent ?? 0,
    totalProductsCount: distinctProductIds.length,
  };
}

// ==============================================================================
// Batch Store Coverage Calculation for Admin Retailers List (app/admin/retailers)
// ==============================================================================

export interface BatchRetailerTrainingSummary {
  coveredPairsCount: number;
  eligiblePairsCount: number;
  storeCoveragePercent: number | null;
  trainingStatusText: string;
}

export async function computeBatchRetailersTrainingCoverage(
  adminClient: SupabaseClient,
  companies: Array<{ id: string; stores?: Array<{ id: string }> }>
): Promise<Map<string, BatchRetailerTrainingSummary>> {
  const resultMap = new Map<string, BatchRetailerTrainingSummary>();

  // Default every company to "N/A"
  companies.forEach((c) => {
    resultMap.set(c.id, {
      coveredPairsCount: 0,
      eligiblePairsCount: 0,
      storeCoveragePercent: null,
      trainingStatusText: "N/A",
    });
  });

  const companyIds = companies.map((c) => c.id).filter(Boolean);
  if (companyIds.length === 0) return resultMap;

  try {
    // 1. Fetch all published training product IDs across the catalog
    const { data: publishedRows } = await adminClient
      .from("retailer_product_training_content")
      .select("product_id, status, is_published");

    const publishedProductIds = new Set<string>();
    (publishedRows || []).forEach((r) => {
      const isPub =
        r.status === "published" ||
        (r.status !== "archived" && r.status !== "draft" && r.status !== "in_review" && r.is_published === true);
      if (isPub && r.product_id) {
        publishedProductIds.add(r.product_id);
      }
    });

    if (publishedProductIds.size === 0) {
      return resultMap;
    }

    const publishedIdList = Array.from(publishedProductIds);

    // 2. Fetch relevant company data in parallel
    const [spRes, ordRes, chkRes, progRes, accessRes, rolesRes] = await Promise.all([
      adminClient
        .from("retailer_store_products")
        .select("company_id, store_id, product_id")
        .in("company_id", companyIds)
        .in("product_id", publishedIdList)
        .eq("is_active", true),
      adminClient
        .from("retailer_orders")
        .select(`
          company_id,
          store_id,
          order_status,
          retailer_order_items (
            product_id
          )
        `)
        .in("company_id", companyIds)
        .in("order_status", ["confirmed", "processing", "partially_shipped", "shipped", "delivered"]),
      adminClient
        .from("retailer_weekly_checks")
        .select(`
          company_id,
          store_id,
          status,
          retailer_weekly_check_items (
            product_id,
            is_counted
          )
        `)
        .in("company_id", companyIds)
        .eq("status", "submitted"),
      adminClient
        .from("retailer_product_training_progress")
        .select("company_id, user_id, product_id, status, completed_at, completion_type, quiz_score, quiz_total")
        .in("company_id", companyIds)
        .in("product_id", publishedIdList)
        .eq("status", "completed")
        .not("completed_at", "is", null),
      adminClient
        .from("retailer_user_store_access")
        .select("company_id, user_id, store_id")
        .in("company_id", companyIds),
      adminClient
        .from("retailer_user_roles")
        .select("company_id, user_id, role, has_all_stores_access")
        .in("company_id", companyIds),
    ]);

    // Build store-level product sets per company: companyId -> Map<storeId, Set<productId>>
    const companyStoreProducts = new Map<string, Map<string, Set<string>>>();
    companies.forEach((comp) => {
      const stMap = new Map<string, Set<string>>();
      (comp.stores || []).forEach((st) => stMap.set(st.id, new Set<string>()));
      companyStoreProducts.set(comp.id, stMap);
    });

    // A. From retailer_store_products
    (spRes.data || []).forEach((row: any) => {
      const stMap = companyStoreProducts.get(row.company_id);
      if (stMap && row.store_id && stMap.has(row.store_id) && publishedProductIds.has(row.product_id)) {
        stMap.get(row.store_id)!.add(row.product_id);
      }
    });

    // B. From retailer_orders
    (ordRes.data || []).forEach((ord: any) => {
      const stMap = companyStoreProducts.get(ord.company_id);
      if (!stMap) return;
      const targetStoreId = ord.store_id;
      const items = (ord.retailer_order_items as any[]) || [];
      const storeIds = Array.from(stMap.keys());
      items.forEach((it) => {
        if (!it.product_id || !publishedProductIds.has(it.product_id)) return;
        if (targetStoreId && stMap.has(targetStoreId)) {
          stMap.get(targetStoreId)!.add(it.product_id);
        } else if (storeIds.length === 1) {
          stMap.get(storeIds[0])!.add(it.product_id);
        }
      });
    });

    // C. From retailer_weekly_checks
    (chkRes.data || []).forEach((chk: any) => {
      const stMap = companyStoreProducts.get(chk.company_id);
      if (!stMap) return;
      const targetStoreId = chk.store_id;
      const items = (chk.retailer_weekly_check_items as any[]) || [];
      items.forEach((it) => {
        if (!it.is_counted || !it.product_id || !publishedProductIds.has(it.product_id)) return;
        if (targetStoreId && stMap.has(targetStoreId)) {
          stMap.get(targetStoreId)!.add(it.product_id);
        }
      });
    });

    // Build user store access sets per company: companyId -> Map<userId, { all: boolean, stores: Set<string> }>
    const companyUserAccess = new Map<string, Map<string, { all: boolean; stores: Set<string> }>>();
    (rolesRes.data || []).forEach((r: any) => {
      if (!companyUserAccess.has(r.company_id)) companyUserAccess.set(r.company_id, new Map());
      const uMap = companyUserAccess.get(r.company_id)!;
      const isOwner = (r.role || "").toLowerCase() === "owner";
      const hasAll = Boolean(r.has_all_stores_access) || isOwner;
      uMap.set(r.user_id, { all: hasAll, stores: new Set() });
    });

    (accessRes.data || []).forEach((acc: any) => {
      if (!companyUserAccess.has(acc.company_id)) companyUserAccess.set(acc.company_id, new Map());
      const uMap = companyUserAccess.get(acc.company_id)!;
      if (!uMap.has(acc.user_id)) {
        uMap.set(acc.user_id, { all: false, stores: new Set() });
      }
      uMap.get(acc.user_id)!.stores.add(acc.store_id);
    });

    // Build verified completions per company: companyId -> Map<productId, Set<userId>>
    const companyCompletions = new Map<string, Map<string, Set<string>>>();
    (progRes.data || []).forEach((p: any) => {
      // Exclude unverified legacy self-reported completions; require server-verified pass
      if (!isServerVerifiedTrainingPass(p)) return;
      if (!companyCompletions.has(p.company_id)) companyCompletions.set(p.company_id, new Map());
      const pMap = companyCompletions.get(p.company_id)!;
      if (!pMap.has(p.product_id)) pMap.set(p.product_id, new Set());
      pMap.get(p.product_id)!.add(p.user_id);
    });

    // Calculate store coverage per company
    companies.forEach((comp) => {
      const stMap = companyStoreProducts.get(comp.id);
      const uMap = companyUserAccess.get(comp.id) || new Map();
      const pMap = companyCompletions.get(comp.id) || new Map();

      if (!stMap || stMap.size === 0) {
        resultMap.set(comp.id, {
          coveredPairsCount: 0,
          eligiblePairsCount: 0,
          storeCoveragePercent: null,
          trainingStatusText: "N/A",
        });
        return;
      }

      let totalEligiblePairs = 0;
      let totalCoveredPairs = 0;

      stMap.forEach((productIds, storeId) => {
        productIds.forEach((productId) => {
          totalEligiblePairs += 1;
          const userIdsWhoPassed = pMap.get(productId);
          if (userIdsWhoPassed && userIdsWhoPassed.size > 0) {
            let isCovered = false;
            for (const uid of Array.from(userIdsWhoPassed)) {
              const access = uMap.get(uid);
              if (!access) continue;
              if (access.all || access.stores.has(storeId)) {
                isCovered = true;
                break;
              }
            }
            if (isCovered) {
              totalCoveredPairs += 1;
            }
          }
        });
      });

      if (totalEligiblePairs === 0) {
        resultMap.set(comp.id, {
          coveredPairsCount: 0,
          eligiblePairsCount: 0,
          storeCoveragePercent: null,
          trainingStatusText: "N/A",
        });
      } else {
        const pct = Math.round((totalCoveredPairs / totalEligiblePairs) * 100);
        resultMap.set(comp.id, {
          coveredPairsCount: totalCoveredPairs,
          eligiblePairsCount: totalEligiblePairs,
          storeCoveragePercent: pct,
          trainingStatusText: `${totalCoveredPairs} / ${totalEligiblePairs} (${pct}%)`,
        });
      }
    });
  } catch (err) {
    console.error("[computeBatchRetailersTrainingCoverage] Error calculating batch coverage:", err);
  }

  return resultMap;
}
