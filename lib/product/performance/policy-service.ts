"use server";

/**
 * Product Performance Settings V1.0 — Canonical Policy Service & Server Actions
 * Task ID: ADM-SALES-PERF-005-R2
 * Location: lib/product/performance/policy-service.ts
 *
 * Implements authoritative policy lifecycle management:
 * - Active policy resolution with deterministic fallback to OWNER_APPROVED_GRADE_POLICY.
 * - Multi-draft persistence with optimistic locking (lock_version).
 * - Owner-only publishing & rollback (Super Admin gating).
 * - Append-only audit logging.
 * - Structural impact preview against live catalog (no speculative A/B/C/D grading).
 * - Safe schema absence handling (read-only mode when migration 0182 is pending).
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminStaffContext } from "@/lib/auth/dal";
import {
  OWNER_APPROVED_GRADE_POLICY,
  checkProductEligibility,
  type GradePolicyContract,
  type ProductEligibilityInput,
} from "./grade-policy";
import {
  type PerformancePolicy,
  type PolicyDraftInput,
  type PolicyAuditLog,
  type PolicyStructuralPreviewResult,
  type PolicyStructuralPreviewItem,
  validatePolicyDraft,
  BASELINE_ACTIVE_POLICY,
  policyToContract,
} from "./policy-types";
import { queryProductPerformanceList } from "./performance-service";
import type { ProductPerformanceSummary } from "./types";

function mapRowToPolicy(row: any): PerformancePolicy {
  return {
    id: row.id,
    version: row.version || "draft",
    draftTitle: row.draft_title || "Untitled Draft",
    status: row.status,
    isActive: Boolean(row.is_active),
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null,
    evaluationPeriodDays: row.evaluation_period_days || 60,
    eligibilityCriteria: row.eligibility_criteria || {
      minOperatingHistoryDays: 60,
      minCompletedOrders: 3,
      minDistinctStores: 3,
      requireHistoricalLandedCost: true,
      missingCostPolicy: "N/A",
    },
    dimensionWeights: row.dimension_weights || OWNER_APPROVED_GRADE_POLICY.weights,
    gradeBands: row.grade_bands || OWNER_APPROVED_GRADE_POLICY.gradeBands,
    automaticGradingEnabled: false, // Strictly locked to false
    lockVersion: row.lock_version || 1,
    changeSummary: row.change_summary || null,
    createdBy: row.created_by || null,
    publishedBy: row.published_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at || null,
  };
}

function mapRowToAuditLog(row: any): PolicyAuditLog {
  return {
    id: row.id,
    policyId: row.policy_id,
    action: row.action,
    actorId: row.actor_id || null,
    actorEmail: row.actor_email || null,
    previousState: row.previous_state || null,
    newState: row.new_state || null,
    changeReason: row.change_reason || "",
    createdAt: row.created_at,
  };
}

// ============================================================================
// 2. SCHEMA READINESS DETECTION & ACTOR CONTEXT
// ============================================================================

/**
 * Checks whether the product_performance_policies table exists in Supabase.
 */
export async function checkPolicySchemaDeployed(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("product_performance_policies")
      .select("id")
      .limit(1);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return false;
      }
    }
    return !error;
  } catch {
    return false;
  }
}

/**
 * Resolves current admin staff context for RBAC in the UI.
 */
export async function getPolicyActorContext(): Promise<{
  isAuthenticated: boolean;
  isOwner: boolean;
  staffId: string | null;
  email: string | null;
  name: string | null;
}> {
  try {
    const staff = await getAdminStaffContext();
    return {
      isAuthenticated: true,
      isOwner: staff.isSuperAdmin,
      staffId: staff.staffId,
      email: staff.email,
      name: staff.name,
    };
  } catch {
    return {
      isAuthenticated: false,
      isOwner: false,
      staffId: null,
      email: null,
      name: null,
    };
  }
}

// ============================================================================
// 3. READ QUERIES
// ============================================================================

/**
 * Fetches the currently active policy from database.
 * Falls back deterministically to OWNER_APPROVED_GRADE_POLICY baseline if table
 * is missing or no active row is returned.
 */
export async function getActivePolicy(): Promise<PerformancePolicy> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_performance_policies")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return BASELINE_ACTIVE_POLICY;
    }

    return mapRowToPolicy(data);
  } catch {
    return BASELINE_ACTIVE_POLICY;
  }
}

/**
 * Fetches all policies (active, drafts, superseded, archived) plus schema ready flag.
 */
export async function getAllPolicies(): Promise<{
  policies: PerformancePolicy[];
  isSchemaReady: boolean;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_performance_policies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          policies: [BASELINE_ACTIVE_POLICY],
          isSchemaReady: false,
        };
      }
      return {
        policies: [BASELINE_ACTIVE_POLICY],
        isSchemaReady: false,
      };
    }

    if (!data || data.length === 0) {
      return {
        policies: [BASELINE_ACTIVE_POLICY],
        isSchemaReady: true,
      };
    }

    return {
      policies: data.map(mapRowToPolicy),
      isSchemaReady: true,
    };
  } catch {
    return {
      policies: [BASELINE_ACTIVE_POLICY],
      isSchemaReady: false,
    };
  }
}

/**
 * Fetches audit logs for policy change histories.
 */
export async function getPolicyAuditLogs(policyId?: string): Promise<PolicyAuditLog[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("product_performance_policy_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (policyId) {
      query = query.eq("policy_id", policyId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map(mapRowToAuditLog);
  } catch {
    return [];
  }
}

// ============================================================================
// 4. WRITE ACTIONS & MUTATIONS
// ============================================================================

/**
 * Saves a policy draft (create or update).
 * Enforces optimistic locking via lock_version.
 */
export async function saveDraftPolicyAction(
  draft: PolicyDraftInput
): Promise<{ success: boolean; policy?: PerformancePolicy; error?: string }> {
  try {
    const staff = await getAdminStaffContext();
    if (!staff.session) {
      return { success: false, error: "Unauthorized: Active Admin session required." };
    }

    // 1. Validate draft invariants
    const validation = validatePolicyDraft(draft);
    if (!validation.isValid) {
      const errorMsg = [
        ...validation.weightErrors,
        ...validation.bandErrors,
        ...validation.eligibilityErrors,
        ...validation.generalErrors,
      ].join(" | ");
      return { success: false, error: `Validation Failed: ${errorMsg}` };
    }

    const admin = createAdminClient();

    // 2. Check if schema is deployed
    const isSchemaReady = await checkPolicySchemaDeployed();
    if (!isSchemaReady) {
      return {
        success: false,
        error:
          "Schema Pending: The product_performance_policies database table has not yet been deployed to the target database. Draft saving is disabled until database migration 0182 is executed.",
      };
    }

    const now = new Date().toISOString();

    if (draft.id) {
      // 3. Update existing draft with Optimistic Lock check
      const { data: existing, error: fetchErr } = await admin
        .from("product_performance_policies")
        .select("id, status, lock_version")
        .eq("id", draft.id)
        .maybeSingle();

      if (fetchErr || !existing) {
        return { success: false, error: "Draft not found." };
      }

      if (existing.status !== "draft") {
        return {
          success: false,
          error: "Only draft policies can be modified. Published or superseded policies are immutable.",
        };
      }

      if (
        typeof draft.lockVersion === "number" &&
        existing.lock_version !== draft.lockVersion
      ) {
        return {
          success: false,
          error: `Concurrency Conflict: This draft was modified by another user (expected version ${draft.lockVersion}, current is ${existing.lock_version}). Please reload the draft.`,
        };
      }

      const nextLockVersion = existing.lock_version + 1;

      const { data: updated, error: updateErr } = await admin
        .from("product_performance_policies")
        .update({
          draft_title: draft.draftTitle.trim(),
          evaluation_period_days: draft.evaluationPeriodDays,
          eligibility_criteria: draft.eligibilityCriteria,
          dimension_weights: draft.dimensionWeights,
          grade_bands: draft.gradeBands,
          change_summary: draft.changeSummary?.trim() || null,
          lock_version: nextLockVersion,
          updated_at: now,
        })
        .eq("id", draft.id)
        .eq("lock_version", existing.lock_version)
        .select()
        .single();

      if (updateErr || !updated) {
        return {
          success: false,
          error: "Failed to update draft. A concurrent update may have occurred. Please retry.",
        };
      }

      // Append audit log
      await admin.from("product_performance_policy_audit_logs").insert({
        policy_id: draft.id,
        action: "update_draft",
        actor_id: staff.staffId,
        actor_email: staff.email,
        previous_state: existing,
        new_state: updated,
        change_reason: draft.changeSummary || "Draft updated by Admin",
      });

      revalidatePath("/admin/settings/product-performance");
      return { success: true, policy: mapRowToPolicy(updated) };
    } else {
      // 4. Create new draft
      const { data: created, error: insertErr } = await admin
        .from("product_performance_policies")
        .insert({
          version: "draft",
          draft_title: draft.draftTitle.trim(),
          status: "draft",
          is_active: false,
          evaluation_period_days: draft.evaluationPeriodDays,
          eligibility_criteria: draft.eligibilityCriteria,
          dimension_weights: draft.dimensionWeights,
          grade_bands: draft.gradeBands,
          automatic_grading_enabled: false,
          lock_version: 1,
          change_summary: draft.changeSummary?.trim() || "Initial draft created",
          created_by: staff.staffId,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insertErr || !created) {
        return { success: false, error: `Failed to create draft: ${insertErr?.message || "Unknown error"}` };
      }

      // Append audit log
      await admin.from("product_performance_policy_audit_logs").insert({
        policy_id: created.id,
        action: "create_draft",
        actor_id: staff.staffId,
        actor_email: staff.email,
        previous_state: null,
        new_state: created,
        change_reason: draft.changeSummary || "Draft created by Admin",
      });

      revalidatePath("/admin/settings/product-performance");
      return { success: true, policy: mapRowToPolicy(created) };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred while saving the draft." };
  }
}

/**
 * Discards a policy draft.
 */
export async function discardDraftAction(
  draftId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const staff = await getAdminStaffContext();
    if (!staff.session) {
      return { success: false, error: "Unauthorized: Active Admin session required." };
    }

    const isSchemaReady = await checkPolicySchemaDeployed();
    if (!isSchemaReady) {
      return { success: false, error: "Schema Pending: Action disabled until migration is applied." };
    }

    const admin = createAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from("product_performance_policies")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { success: false, error: "Draft not found." };
    }

    if (existing.status !== "draft") {
      return { success: false, error: "Only drafts can be discarded. Published policies cannot be discarded." };
    }

    // Set to archived or delete
    const { error: delErr } = await admin
      .from("product_performance_policies")
      .delete()
      .eq("id", draftId);

    if (delErr) {
      return { success: false, error: `Failed to discard draft: ${delErr.message}` };
    }

    await admin.from("product_performance_policy_audit_logs").insert({
      policy_id: draftId,
      action: "discard_draft",
      actor_id: staff.staffId,
      actor_email: staff.email,
      previous_state: existing,
      new_state: null,
      change_reason: "Draft discarded by Admin",
    });

    revalidatePath("/admin/settings/product-performance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Publishes a draft policy.
 * Strictly restricted to Owner (Super Admin).
 */
export async function publishPolicyAction(
  draftId: string,
  changeSummary: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const staff = await getAdminStaffContext();
    if (!staff.session) {
      return { success: false, error: "Unauthorized: Active Admin session required." };
    }

    // RBAC: Owner Only
    if (!staff.isSuperAdmin) {
      return {
        success: false,
        error: "Forbidden: Only the Owner (Super Admin) is authorized to publish Product Performance evaluation policies.",
      };
    }

    if (!changeSummary || changeSummary.trim().length === 0) {
      return { success: false, error: "Change summary / reason is required for publishing." };
    }

    const isSchemaReady = await checkPolicySchemaDeployed();
    if (!isSchemaReady) {
      return {
        success: false,
        error: "Schema Pending: Publishing is disabled until database migration 0182 is executed.",
      };
    }

    const admin = createAdminClient();

    // 1. Fetch draft to publish
    const { data: draft, error: draftErr } = await admin
      .from("product_performance_policies")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();

    if (draftErr || !draft) {
      return { success: false, error: "Target draft not found." };
    }

    if (draft.status !== "draft") {
      return { success: false, error: "Only draft policies can be published." };
    }

    // 2. Validate draft integrity
    const validation = validatePolicyDraft({
      draftTitle: draft.draft_title,
      evaluationPeriodDays: draft.evaluation_period_days,
      eligibilityCriteria: draft.eligibility_criteria,
      dimensionWeights: draft.dimension_weights,
      gradeBands: draft.grade_bands,
    });

    if (!validation.isValid) {
      return { success: false, error: "Policy draft failed validation checks. Cannot publish." };
    }

    // 3. Determine next version number
    const { data: latestPublished } = await admin
      .from("product_performance_policies")
      .select("version")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextVersion = "v1.1.0";
    if (latestPublished?.version && latestPublished.version.startsWith("v")) {
      const parts = latestPublished.version.replace("v", "").split(".");
      const major = parseInt(parts[0], 10) || 1;
      const minor = parseInt(parts[1], 10) || 0;
      nextVersion = `v${major}.${minor + 1}.0`;
    }

    const now = new Date().toISOString();

    // 4. Fetch current active policy for audit comparison
    const { data: previousActive } = await admin
      .from("product_performance_policies")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    // 5. Deactivate current active policy
    if (previousActive) {
      await admin
        .from("product_performance_policies")
        .update({
          is_active: false,
          status: "superseded",
          effective_to: now,
          updated_at: now,
        })
        .eq("id", previousActive.id);
    }

    // 6. Activate new policy
    const { data: published, error: pubErr } = await admin
      .from("product_performance_policies")
      .update({
        version: nextVersion,
        status: "published",
        is_active: true,
        effective_from: now,
        published_at: now,
        published_by: staff.staffId,
        change_summary: changeSummary.trim(),
        lock_version: draft.lock_version + 1,
        updated_at: now,
      })
      .eq("id", draftId)
      .select()
      .single();

    if (pubErr || !published) {
      return { success: false, error: `Failed to publish policy: ${pubErr?.message || "Unknown error"}` };
    }

    // 7. Append audit log
    await admin.from("product_performance_policy_audit_logs").insert({
      policy_id: draftId,
      action: "publish",
      actor_id: staff.staffId,
      actor_email: staff.email,
      previous_state: previousActive || null,
      new_state: published,
      change_reason: changeSummary.trim(),
    });

    revalidatePath("/admin/settings/product-performance");
    revalidatePath("/admin/products/performance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred during publish." };
  }
}

/**
 * Rolls back to a previous policy configuration.
 * Creates a NEW published version referencing the target configuration without deleting history.
 * Strictly restricted to Owner (Super Admin).
 */
export async function rollbackPolicyAction(
  targetPolicyId: string,
  changeSummary: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const staff = await getAdminStaffContext();
    if (!staff.session) {
      return { success: false, error: "Unauthorized: Active Admin session required." };
    }

    // RBAC: Owner Only
    if (!staff.isSuperAdmin) {
      return {
        success: false,
        error: "Forbidden: Only the Owner (Super Admin) is authorized to rollback performance policies.",
      };
    }

    if (!changeSummary || changeSummary.trim().length === 0) {
      return { success: false, error: "Rollback reason / change summary is required." };
    }

    const isSchemaReady = await checkPolicySchemaDeployed();
    if (!isSchemaReady) {
      return {
        success: false,
        error: "Schema Pending: Rollback is disabled until database migration 0182 is executed.",
      };
    }

    const admin = createAdminClient();

    // 1. Fetch target historical policy
    const { data: target, error: targetErr } = await admin
      .from("product_performance_policies")
      .select("*")
      .eq("id", targetPolicyId)
      .maybeSingle();

    if (targetErr || !target) {
      return { success: false, error: "Target historical policy not found." };
    }

    // 2. Fetch current active policy
    const { data: currentActive } = await admin
      .from("product_performance_policies")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    const now = new Date().toISOString();

    // 3. Deactivate current active policy
    if (currentActive) {
      await admin
        .from("product_performance_policies")
        .update({
          is_active: false,
          status: "superseded",
          effective_to: now,
          updated_at: now,
        })
        .eq("id", currentActive.id);
    }

    // 4. Generate next rollback version string
    const rollbackVersion = `${target.version}-reverted-${Date.now().toString(36).slice(-4)}`;

    // 5. Insert new active policy with target's configuration
    const { data: newPolicy, error: insErr } = await admin
      .from("product_performance_policies")
      .insert({
        version: rollbackVersion,
        draft_title: `Rollback to ${target.version} (${target.draft_title || "Policy"})`,
        status: "published",
        is_active: true,
        effective_from: now,
        evaluation_period_days: target.evaluation_period_days,
        eligibility_criteria: target.eligibility_criteria,
        dimension_weights: target.dimension_weights,
        grade_bands: target.grade_bands,
        automatic_grading_enabled: false, // Locked to false
        lock_version: 1,
        change_summary: `[Rollback to ${target.version}]: ${changeSummary.trim()}`,
        created_by: staff.staffId,
        published_by: staff.staffId,
        published_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insErr || !newPolicy) {
      return { success: false, error: `Failed to execute rollback: ${insErr?.message || "Unknown error"}` };
    }

    // 6. Append audit log
    await admin.from("product_performance_policy_audit_logs").insert({
      policy_id: newPolicy.id,
      action: "rollback",
      actor_id: staff.staffId,
      actor_email: staff.email,
      previous_state: currentActive || null,
      new_state: newPolicy,
      change_reason: `Rollback to ${target.version}: ${changeSummary.trim()}`,
    });

    revalidatePath("/admin/settings/product-performance");
    revalidatePath("/admin/products/performance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred during rollback." };
  }
}

// ============================================================================
// 5. DETERMINISTIC STRUCTURAL PREVIEW
// ============================================================================

/**
 * Representative deterministic fallback catalog for simulation when DB catalog is empty or offline.
 */
const DETERMINISTIC_FALLBACK_CATALOG: Array<{
  product: { id: string; sku: string; name: string; brandName: string };
  eligibilityInput: ProductEligibilityInput;
}> = [
  {
    product: { id: "p1", sku: "SKU-BEAUTY-001", name: "Hydrating Serum 50ml", brandName: "GlowLab" },
    eligibilityInput: {
      product_id: "p1",
      operatingHistoryDays: 120,
      completedOrdersCount: 8,
      distinctStoresCount: 5,
      hasHistoricalCost: true,
    },
  },
  {
    product: { id: "p2", sku: "SKU-BEAUTY-002", name: "Centella Calming Toner", brandName: "GlowLab" },
    eligibilityInput: {
      product_id: "p2",
      operatingHistoryDays: 45, // < 60 days -> NEW in baseline
      completedOrdersCount: 4,
      distinctStoresCount: 3,
      hasHistoricalCost: true,
    },
  },
  {
    product: { id: "p3", sku: "SKU-FOOD-001", name: "Organic Crispy Seaweed 20g", brandName: "NatureSnack" },
    eligibilityInput: {
      product_id: "p3",
      operatingHistoryDays: 90,
      completedOrdersCount: 2, // < 3 orders -> NOT_RATED in baseline
      distinctStoresCount: 2,
      hasHistoricalCost: true,
    },
  },
  {
    product: { id: "p4", sku: "SKU-FOOD-002", name: "Premium Roasted Sesame Oil", brandName: "NatureSnack" },
    eligibilityInput: {
      product_id: "p4",
      operatingHistoryDays: 180,
      completedOrdersCount: 15,
      distinctStoresCount: 10,
      hasHistoricalCost: false, // missing cost -> NOT_RATED
    },
  },
  {
    product: { id: "p5", sku: "SKU-HOME-001", name: "Aromatherapy Reed Diffuser", brandName: "LivingWell" },
    eligibilityInput: {
      product_id: "p5",
      operatingHistoryDays: 55, // 55 days
      completedOrdersCount: 3,
      distinctStoresCount: 3,
      hasHistoricalCost: true,
    },
  },
  {
    product: { id: "p6", sku: "SKU-BEAUTY-003", name: "Snail Mucin Essence", brandName: "K-Beauty Co" },
    eligibilityInput: {
      product_id: "p6",
      operatingHistoryDays: 75,
      completedOrdersCount: 6,
      distinctStoresCount: 4,
      hasHistoricalCost: true,
    },
  },
  {
    product: { id: "p7", sku: "SKU-FOOD-003", name: "Sweet Potato Chews 100g", brandName: "NatureSnack" },
    eligibilityInput: {
      product_id: "p7",
      operatingHistoryDays: 30, // NEW
      completedOrdersCount: 1,
      distinctStoresCount: 1,
      hasHistoricalCost: true,
    },
  },
  {
    product: { id: "p8", sku: "SKU-BEAUTY-004", name: "Vitamin C Brightening Mask", brandName: "GlowLab" },
    eligibilityInput: {
      product_id: "p8",
      operatingHistoryDays: 200,
      completedOrdersCount: 20,
      distinctStoresCount: 12,
      hasHistoricalCost: true,
    },
  },
];

/**
 * Simulates structural policy eligibility shifts between current Active Policy and proposed Draft.
 * CRITICAL: Only projects eligibility shifts. MUST NOT fabricate speculative A/B/C/D grades.
 */
export async function simulatePolicyStructuralPreviewAction(
  draft: PolicyDraftInput
): Promise<{
  success: boolean;
  preview?: PolicyStructuralPreviewResult;
  error?: string;
}> {
  try {
    const activePolicy = await getActivePolicy();
    const activeContract = await policyToContract(activePolicy);

    const draftContract: GradePolicyContract = {
      evaluationPeriodDays: draft.evaluationPeriodDays,
      eligibility: {
        minOperatingHistoryDays: draft.eligibilityCriteria.minOperatingHistoryDays,
        minCompletedOrders: draft.eligibilityCriteria.minCompletedOrders,
        minDistinctStores: draft.eligibilityCriteria.minDistinctStores,
        missingHistoricalCostPolicy: draft.eligibilityCriteria.missingCostPolicy,
      },
      weights: draft.dimensionWeights,
      gradeBands: draft.gradeBands,
      automaticGradingEnabled: false,
    };

    // 1. Fetch live catalog products or fallback to deterministic catalog
    let catalogItems: Array<{
      product: { id: string; sku: string; name: string; brandName: string };
      eligibilityInput: ProductEligibilityInput;
    }> = [];

    try {
      const res = await queryProductPerformanceList({ pageSize: 100 });
      if (res && res.items && res.items.length > 0) {
        catalogItems = res.items.map((item: ProductPerformanceSummary) => ({
          product: {
            id: item.productId,
            sku: item.sku,
            name: item.productName,
            brandName: item.brand.name,
          },
          eligibilityInput: {
            product_id: item.productId,
            operatingHistoryDays: item.gradeReadiness.metrics.operatingHistoryDays,
            completedOrdersCount: item.gradeReadiness.metrics.completedOrdersCount,
            distinctStoresCount: item.gradeReadiness.metrics.distinctStoresCount,
            hasHistoricalCost: item.gradeReadiness.metrics.hasHistoricalCost,
          },
        }));
      }
    } catch {
      // Fallback
    }

    if (catalogItems.length === 0) {
      catalogItems = DETERMINISTIC_FALLBACK_CATALOG;
    }

    // 2. Evaluate both policies for each SKU
    let activeEligibleCount = 0;
    let activeNewCount = 0;
    let activeNotRatedCount = 0;

    let draftEligibleCount = 0;
    let draftNewCount = 0;
    let draftNotRatedCount = 0;
    let draftMissingCostCount = 0;

    const sampleItems: PolicyStructuralPreviewItem[] = [];

    for (const item of catalogItems) {
      const activeRes = checkProductEligibility(item.eligibilityInput, activeContract);
      const draftRes = checkProductEligibility(item.eligibilityInput, draftContract);

      if (activeRes.isEligible) activeEligibleCount++;
      else if (activeRes.status === "NEW") activeNewCount++;
      else activeNotRatedCount++;

      if (draftRes.isEligible) draftEligibleCount++;
      else if (draftRes.status === "NEW") draftNewCount++;
      else draftNotRatedCount++;

      if (!item.eligibilityInput.hasHistoricalCost) {
        draftMissingCostCount++;
      }

      const isChanged = activeRes.status !== draftRes.status;

      sampleItems.push({
        productId: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        brandName: item.product.brandName,
        operatingHistoryDays: item.eligibilityInput.operatingHistoryDays || 0,
        completedOrdersCount: item.eligibilityInput.completedOrdersCount || 0,
        distinctStoresCount: item.eligibilityInput.distinctStoresCount || 0,
        hasHistoricalCost: Boolean(item.eligibilityInput.hasHistoricalCost),
        currentStatus: activeRes.status,
        projectedStatus: draftRes.status,
        isStatusChanged: isChanged,
        projectedReasons: draftRes.allReasons,
      });
    }

    // Sort samples: Changed status items first
    sampleItems.sort((a, b) => (b.isStatusChanged ? 1 : 0) - (a.isStatusChanged ? 1 : 0));

    const previewResult: PolicyStructuralPreviewResult = {
      totalCatalogSkus: catalogItems.length,
      eligibleSkusCount: draftEligibleCount,
      newSkusCount: draftNewCount,
      notRatedSkusCount: draftNotRatedCount,
      missingCostSkusCount: draftMissingCostCount,
      activePolicyComparison: {
        eligibleSkusDelta: draftEligibleCount - activeEligibleCount,
        newSkusDelta: draftNewCount - activeNewCount,
        notRatedSkusDelta: draftNotRatedCount - activeNotRatedCount,
      },
      sampleItems: sampleItems.slice(0, 15),
    };

    return { success: true, preview: previewResult };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate structural preview." };
  }
}
