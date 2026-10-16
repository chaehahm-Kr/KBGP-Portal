"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CompanyExchangeEnrollment,
  EnrollmentAuditLog,
  ProtectedSupplyCohort,
  ProtectedSupplyShipment,
  EnrollCompanyInput,
  UpdateEnrollmentInput,
  PauseEnrollmentInput,
  RegisterProtectedCohortInput,
  LinkSplitShipmentInput,
  ExchangeCreditOverviewStats,
  StoreProtectionSummary,
  ProtectedCohortStatus,
} from "./exchange-credit-types";
import { COHORT_STATUS_CONFIG } from "./exchange-credit-types";

// Helper: Add days to ISO date string (YYYY-MM-DD)
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * 1. Safe Schema Availability Check
 * Returns false cleanly if Migration 0175 has not yet been executed in Supabase.
 */
export async function checkExchangeCreditSchemaAvailability(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("retailer_exchange_program_enrollments")
      .select("id")
      .limit(1);

    if (error) {
      // PGRST205: relation does not exist
      if (error.code === "PGRST205" || error.message.includes("does not exist") || error.code === "42P01") {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 2. Get Exchange Credit Overview Dashboard Data
 */
export async function getExchangeCreditOverviewData(): Promise<{
  isSchemaAvailable: boolean;
  stats: ExchangeCreditOverviewStats;
  enrollments: CompanyExchangeEnrollment[];
  cohorts: ProtectedSupplyCohort[];
  auditLogs: EnrollmentAuditLog[];
}> {
  await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();

  const emptyResult = {
    isSchemaAvailable: isAvailable,
    stats: {
      isSchemaAvailable: isAvailable,
      totalEnrolledCompanies: 0,
      activeCompaniesCount: 0,
      pausedCompaniesCount: 0,
      totalProtectedCohortsCount: 0,
      activeProtectedCohortsCount: 0,
      totalProtectedWholesaleValue: 0,
      upcomingDay100Count: 0,
    },
    enrollments: [],
    cohorts: [],
    auditLogs: [],
  };

  if (!isAvailable) {
    return emptyResult;
  }

  const supabase = createAdminClient();

  try {
    // A. Fetch Enrollments
    const { data: rawEnrollments, error: enrollErr } = await supabase
      .from("retailer_exchange_program_enrollments")
      .select(`
        *,
        companies:company_id(id, name, code)
      `)
      .order("created_at", { ascending: false });

    if (enrollErr) throw enrollErr;

    // B. Fetch Cohorts
    const { data: rawCohorts, error: cohortErr } = await supabase
      .from("retailer_protected_supply_cohorts")
      .select(`
        *,
        companies:company_id(name),
        stores:store_id(name, store_code),
        products:product_id(name, letusto_sku, primary_image_url),
        retailer_orders:source_order_id(order_number)
      `)
      .order("created_at", { ascending: false });

    if (cohortErr) throw cohortErr;

    // C. Fetch Audit Logs
    const { data: rawAuditLogs, error: auditErr } = await supabase
      .from("retailer_exchange_program_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (auditErr) throw auditErr;

    const enrollments: CompanyExchangeEnrollment[] = (rawEnrollments || []).map((e) => {
      const company = Array.isArray(e.companies) ? e.companies[0] : e.companies;
      return {
        id: e.id,
        companyId: e.company_id,
        companyName: company?.name || "Unknown Retailer",
        companyCode: company?.code || null,
        status: e.status,
        optionACreditRate: Number(e.option_a_credit_rate),
        optionBCreditRate: Number(e.option_b_credit_rate),
        minInventoryReportingWeeks: e.min_inventory_reporting_weeks,
        trialPeriodDays: e.trial_period_days,
        evaluationDay: e.evaluation_day,
        claimWindowDays: e.claim_window_days,
        enrolledBy: e.enrolled_by,
        enrolledAt: e.enrolled_at,
        effectiveDate: e.effective_date,
        pausedAt: e.paused_at,
        pausedBy: e.paused_by,
        pauseReason: e.pause_reason,
        notes: e.notes,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      };
    });

    const cohorts: ProtectedSupplyCohort[] = (rawCohorts || []).map((c) => {
      const comp = Array.isArray(c.companies) ? c.companies[0] : c.companies;
      const st = Array.isArray(c.stores) ? c.stores[0] : c.stores;
      const prod = Array.isArray(c.products) ? c.products[0] : c.products;
      const ord = Array.isArray(c.retailer_orders) ? c.retailer_orders[0] : c.retailer_orders;

      const statusKey = c.status as ProtectedCohortStatus;
      const statusConfig = COHORT_STATUS_CONFIG[statusKey] || { label: c.status };

      return {
        id: c.id,
        cohortCode: c.cohort_code,
        companyId: c.company_id,
        companyName: comp?.name || "Unknown Company",
        storeId: c.store_id,
        storeName: st?.name || "Unknown Store",
        storeCode: st?.store_code || null,
        productId: c.product_id,
        productName: prod?.name || "Unknown Product",
        productSku: prod?.letusto_sku || "N/A",
        productThumbnailUrl: prod?.primary_image_url || null,
        enrollmentId: c.enrollment_id,
        sourceOrderId: c.source_order_id,
        sourceOrderNumber: ord?.order_number || "N/A",
        sourceOrderItemId: c.source_order_item_id,
        totalProtectedQuantity: c.total_protected_quantity,
        fulfilledProtectedQuantity: c.fulfilled_protected_quantity,
        frozenUnitWholesalePrice: Number(c.frozen_unit_wholesale_price),
        frozenOptionARate: Number(c.frozen_option_a_rate),
        frozenOptionBRate: Number(c.frozen_option_b_rate),
        frozenMinReportingWeeks: c.frozen_min_reporting_weeks,
        status: statusKey,
        statusLabel: statusConfig.label,
        firstShipmentDate: c.first_shipment_date,
        firstDeliveryDate: c.first_delivery_date,
        protectionStartDate: c.protection_start_date,
        trialEndDate: c.trial_end_date,
        evaluationDate: c.evaluation_date,
        claimDeadlineDate: c.claim_deadline_date,
        disqualificationReason: c.disqualification_reason,
        disqualifiedAt: c.disqualified_at,
        disqualifiedByOrderId: c.disqualified_by_order_id,
        disqualifiedByOrderNumber: null,
        createdBy: c.created_by,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });

    const auditLogs: EnrollmentAuditLog[] = (rawAuditLogs || []).map((a) => ({
      id: a.id,
      enrollmentId: a.enrollment_id,
      companyId: a.company_id,
      action: a.action,
      changedBy: a.changed_by,
      oldValues: a.old_values,
      newValues: a.new_values,
      reason: a.reason,
      createdAt: a.created_at,
    }));

    // Compute stats
    const totalEnrolled = enrollments.length;
    const activeCompanies = enrollments.filter((e) => e.status === "active").length;
    const pausedCompanies = enrollments.filter((e) => e.status === "paused").length;
    const totalCohorts = cohorts.length;
    const activeCohorts = cohorts.filter((c) => c.status === "active_protection").length;
    const totalWholesaleVal = cohorts.reduce((acc, c) => acc + c.totalProtectedQuantity * c.frozenUnitWholesalePrice, 0);

    const todayStr = new Date().toISOString().split("T")[0];
    const twoWeeksLater = addDays(todayStr, 14);
    const upcomingDay100 = cohorts.filter(
      (c) =>
        c.evaluationDate &&
        c.evaluationDate >= todayStr &&
        c.evaluationDate <= twoWeeksLater &&
        c.status === "active_protection"
    ).length;

    return {
      isSchemaAvailable: true,
      stats: {
        isSchemaAvailable: true,
        totalEnrolledCompanies: totalEnrolled,
        activeCompaniesCount: activeCompanies,
        pausedCompaniesCount: pausedCompanies,
        totalProtectedCohortsCount: totalCohorts,
        activeProtectedCohortsCount: activeCohorts,
        totalProtectedWholesaleValue: totalWholesaleVal,
        upcomingDay100Count: upcomingDay100,
      },
      enrollments,
      cohorts,
      auditLogs,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[getExchangeCreditOverviewData] Error fetching overview data:", message);
    return emptyResult;
  }
}

/**
 * 3. Enroll Company in 90-Day Exchange Credit Program
 */
export async function enrollCompanyExchangeProgramAction(
  input: EnrollCompanyInput
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  const session = await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();
  if (!isAvailable) {
    return {
      success: false,
      error: "Migration 0175 schema is not yet applied to the Production database. Manual Owner execution required.",
    };
  }

  const { companyId, optionARate = 0.4, optionBRate = 0.2, minReportingWeeks = 8, effectiveDate, notes } = input;

  if (!companyId) {
    return { success: false, error: "Company ID is required." };
  }
  if (optionARate < 0.2 || optionARate > 0.5) {
    return { success: false, error: "Option A Credit Rate must be between 20% (0.20) and 50% (0.50)." };
  }
  if (optionBRate < 0.1 || optionBRate > 0.35) {
    return { success: false, error: "Option B Credit Rate must be between 10% (0.10) and 35% (0.35)." };
  }
  if (minReportingWeeks < 4 || minReportingWeeks > 12) {
    return { success: false, error: "Minimum reporting weeks must be between 4 and 12 weeks." };
  }

  const supabase = createAdminClient();

  // Check if company exists
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (compErr || !company) {
    return { success: false, error: "Target company does not exist." };
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("retailer_exchange_program_enrollments")
    .select("id, status")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing && existing.status !== "terminated") {
    return {
      success: false,
      error: `Company is already enrolled with status: ${existing.status}. Update policy instead of re-enrolling.`,
    };
  }

  // Perform Insert
  const { data: newEnrollment, error: insertErr } = await supabase
    .from("retailer_exchange_program_enrollments")
    .insert({
      company_id: companyId,
      status: "active",
      option_a_credit_rate: optionARate,
      option_b_credit_rate: optionBRate,
      min_inventory_reporting_weeks: minReportingWeeks,
      trial_period_days: 90,
      evaluation_day: 100,
      claim_window_days: 50,
      enrolled_by: session.userId,
      effective_date: effectiveDate || new Date().toISOString().split("T")[0],
      notes: notes || null,
    })
    .select("id")
    .single();

  if (insertErr || !newEnrollment) {
    return { success: false, error: insertErr?.message || "Failed to create company enrollment." };
  }

  // Record Audit Log
  await supabase.from("retailer_exchange_program_audit_logs").insert({
    enrollment_id: newEnrollment.id,
    company_id: companyId,
    action: "enroll",
    changed_by: session.userId,
    old_values: null,
    new_values: {
      status: "active",
      option_a_credit_rate: optionARate,
      option_b_credit_rate: optionBRate,
      min_inventory_reporting_weeks: minReportingWeeks,
      effective_date: effectiveDate || new Date().toISOString().split("T")[0],
      notes,
    },
    reason: notes || "Initial company program enrollment by Admin.",
  });

  revalidatePath("/admin/exchange-credit");
  return { success: true, enrollmentId: newEnrollment.id };
}

/**
 * 4. Update Future Enrollment Policy Settings
 * Note: Only applies to future cohorts; previously registered cohorts retain their frozen snapshot.
 */
export async function updateCompanyExchangeEnrollmentAction(
  input: UpdateEnrollmentInput
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();
  if (!isAvailable) {
    return { success: false, error: "Migration 0175 schema is not yet applied." };
  }

  const { enrollmentId, optionARate, optionBRate, minReportingWeeks, reason } = input;
  if (!enrollmentId || !reason || reason.trim().length < 5) {
    return { success: false, error: "Enrollment ID and a descriptive reason (at least 5 characters) are required." };
  }

  const supabase = createAdminClient();

  const { data: current, error: fetchErr } = await supabase
    .from("retailer_exchange_program_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: "Enrollment record not found." };
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (optionARate !== undefined) {
    if (optionARate < 0.2 || optionARate > 0.5) {
      return { success: false, error: "Option A Rate must be between 20% and 50%." };
    }
    updates.option_a_credit_rate = optionARate;
  }

  if (optionBRate !== undefined) {
    if (optionBRate < 0.1 || optionBRate > 0.35) {
      return { success: false, error: "Option B Rate must be between 10% and 35%." };
    }
    updates.option_b_credit_rate = optionBRate;
  }

  if (minReportingWeeks !== undefined) {
    if (minReportingWeeks < 4 || minReportingWeeks > 12) {
      return { success: false, error: "Minimum reporting weeks must be between 4 and 12." };
    }
    updates.min_inventory_reporting_weeks = minReportingWeeks;
  }

  const { error: updateErr } = await supabase
    .from("retailer_exchange_program_enrollments")
    .update(updates)
    .eq("id", enrollmentId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit
  await supabase.from("retailer_exchange_program_audit_logs").insert({
    enrollment_id: enrollmentId,
    company_id: current.company_id,
    action: "update_policy",
    changed_by: session.userId,
    old_values: {
      option_a_credit_rate: current.option_a_credit_rate,
      option_b_credit_rate: current.option_b_credit_rate,
      min_inventory_reporting_weeks: current.min_inventory_reporting_weeks,
    },
    new_values: updates,
    reason,
  });

  revalidatePath("/admin/exchange-credit");
  return { success: true };
}

/**
 * 5. Pause Company Exchange Enrollment
 */
export async function pauseCompanyExchangeEnrollmentAction(
  input: PauseEnrollmentInput
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();
  if (!isAvailable) {
    return { success: false, error: "Migration 0175 schema is not yet applied." };
  }

  const { enrollmentId, pauseReason } = input;
  if (!enrollmentId || !pauseReason || pauseReason.trim().length < 5) {
    return { success: false, error: "Enrollment ID and a descriptive pause reason are required." };
  }

  const supabase = createAdminClient();

  const { data: current, error: fetchErr } = await supabase
    .from("retailer_exchange_program_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: "Enrollment record not found." };
  }

  const { error: updateErr } = await supabase
    .from("retailer_exchange_program_enrollments")
    .update({
      status: "paused",
      paused_at: new Date().toISOString(),
      paused_by: session.userId,
      pause_reason: pauseReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from("retailer_exchange_program_audit_logs").insert({
    enrollment_id: enrollmentId,
    company_id: current.company_id,
    action: "pause",
    changed_by: session.userId,
    old_values: { status: current.status },
    new_values: { status: "paused", pause_reason: pauseReason },
    reason: pauseReason,
  });

  revalidatePath("/admin/exchange-credit");
  return { success: true };
}

/**
 * 6. Register Protected Supply Cohort
 * Lifetime 1-time enforcement for Store + SKU combination!
 */
export async function registerProtectedSupplyCohortAction(
  input: RegisterProtectedCohortInput
): Promise<{ success: boolean; cohortId?: string; cohortCode?: string; error?: string }> {
  const session = await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();
  if (!isAvailable) {
    return { success: false, error: "Migration 0175 schema is not yet applied." };
  }

  const {
    companyId,
    storeId,
    productId,
    sourceOrderId,
    sourceOrderItemId,
    protectedQuantity,
    unitWholesalePrice,
    firstShipmentDate,
    firstDeliveryDate,
  } = input;

  if (!companyId || !storeId || !productId || !sourceOrderId || !sourceOrderItemId) {
    return { success: false, error: "All relational context fields (Company, Store, Product, Order, Item) are required." };
  }
  if (!protectedQuantity || protectedQuantity <= 0) {
    return { success: false, error: "Protected quantity must be greater than 0." };
  }
  if (unitWholesalePrice === undefined || unitWholesalePrice < 0) {
    return { success: false, error: "Unit wholesale price must be non-negative." };
  }

  const supabase = createAdminClient();

  // 1. Verify Company Enrollment
  const { data: enrollment, error: enrollErr } = await supabase
    .from("retailer_exchange_program_enrollments")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (enrollErr || !enrollment) {
    return { success: false, error: "Retailer company is not enrolled in the 90-Day Exchange Credit program." };
  }
  if (enrollment.status !== "active") {
    return {
      success: false,
      error: `Company enrollment is currently ${enrollment.status}. New protected cohorts cannot be registered.`,
    };
  }

  // 2. Lifetime 1-time Store + SKU Protection Enforcement
  const { data: existingCohort } = await supabase
    .from("retailer_protected_supply_cohorts")
    .select("id, cohort_code, status")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingCohort) {
    return {
      success: false,
      error: `Store already has a lifetime protected cohort for this SKU (${existingCohort.cohort_code}, Status: ${existingCohort.status}). Subsequent orders are considered reorders and cannot be protected.`,
    };
  }

  // 3. Generate Cohort Code
  const currentYear = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const cohortCode = `PSC-${currentYear}-${randomSuffix}`;

  // 4. Calculate Dates if first shipment date provided
  const anchorDate = firstDeliveryDate || firstShipmentDate || null;
  const trialEndDate = anchorDate ? addDays(anchorDate, 90) : null;
  const evalDate = anchorDate ? addDays(anchorDate, 100) : null;
  const claimDeadline = anchorDate ? addDays(anchorDate, 150) : null;

  const { data: newCohort, error: insertErr } = await supabase
    .from("retailer_protected_supply_cohorts")
    .insert({
      cohort_code: cohortCode,
      company_id: companyId,
      store_id: storeId,
      product_id: productId,
      enrollment_id: enrollment.id,
      source_order_id: sourceOrderId,
      source_order_item_id: sourceOrderItemId,
      total_protected_quantity: protectedQuantity,
      fulfilled_protected_quantity: 0,
      frozen_unit_wholesale_price: unitWholesalePrice,
      frozen_option_a_rate: enrollment.option_a_credit_rate,
      frozen_option_b_rate: enrollment.option_b_credit_rate,
      frozen_min_reporting_weeks: enrollment.min_inventory_reporting_weeks,
      status: "registered",
      first_shipment_date: firstShipmentDate || null,
      first_delivery_date: firstDeliveryDate || null,
      protection_start_date: anchorDate,
      trial_end_date: trialEndDate,
      evaluation_date: evalDate,
      claim_deadline_date: claimDeadline,
      created_by: session.userId,
    })
    .select("id, cohort_code")
    .single();

  if (insertErr || !newCohort) {
    return { success: false, error: insertErr?.message || "Failed to register protected supply cohort." };
  }

  revalidatePath("/admin/exchange-credit");
  return { success: true, cohortId: newCohort.id, cohortCode: newCohort.cohort_code };
}

/**
 * 7. Link Authorized Split Shipment to Cohort
 */
export async function associateSplitShipmentAction(
  input: LinkSplitShipmentInput
): Promise<{ success: boolean; error?: string }> {
  await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();
  if (!isAvailable) {
    return { success: false, error: "Migration 0175 schema is not yet applied." };
  }

  const { cohortId, fulfillmentId, fulfillmentItemId, quantityShipped, quantityDelivered = 0, shippedAt, deliveredAt, carrier, trackingNumber, isFirstShipment, notes } = input;

  if (!cohortId || !fulfillmentId || !quantityShipped || quantityShipped <= 0) {
    return { success: false, error: "Cohort ID, Fulfillment ID, and a positive quantity shipped are required." };
  }

  const supabase = createAdminClient();

  // 1. Fetch Cohort
  const { data: cohort, error: cohortErr } = await supabase
    .from("retailer_protected_supply_cohorts")
    .select("*")
    .eq("id", cohortId)
    .single();

  if (cohortErr || !cohort) {
    return { success: false, error: "Target protected cohort not found." };
  }

  // 2. Count existing shipments to determine sequence
  const { count: existingShipmentCount } = await supabase
    .from("retailer_protected_supply_shipments")
    .select("*", { count: "exact", head: true })
    .eq("cohort_id", cohortId);

  const sequence = (existingShipmentCount || 0) + 1;
  const isFirst = isFirstShipment !== undefined ? isFirstShipment : sequence === 1;

  // 3. Insert shipment record
  const { error: shipErr } = await supabase
    .from("retailer_protected_supply_shipments")
    .insert({
      cohort_id: cohortId,
      fulfillment_id: fulfillmentId,
      fulfillment_item_id: fulfillmentItemId || null,
      shipment_sequence: sequence,
      quantity_shipped: quantityShipped,
      quantity_delivered: quantityDelivered,
      shipped_at: shippedAt || new Date().toISOString(),
      delivered_at: deliveredAt || null,
      carrier: carrier || null,
      tracking_number: trackingNumber || null,
      is_first_shipment: isFirst,
      notes: notes || null,
    });

  if (shipErr) {
    return { success: false, error: shipErr.message };
  }

  // 4. Update Cohort metrics
  const newFulfilledQty = (cohort.fulfilled_protected_quantity || 0) + quantityShipped;
  const isFullyFulfilled = newFulfilledQty >= cohort.total_protected_quantity;

  const updates: Record<string, unknown> = {
    fulfilled_protected_quantity: newFulfilledQty,
    updated_at: new Date().toISOString(),
  };

  if (isFirst) {
    const shipmentDateStr = shippedAt ? shippedAt.split("T")[0] : new Date().toISOString().split("T")[0];
    updates.first_shipment_date = shipmentDateStr;
    if (deliveredAt) {
      const delivDateStr = deliveredAt.split("T")[0];
      updates.first_delivery_date = delivDateStr;
      updates.protection_start_date = delivDateStr;
      updates.trial_end_date = addDays(delivDateStr, 90);
      updates.evaluation_date = addDays(delivDateStr, 100);
      updates.claim_deadline_date = addDays(delivDateStr, 150);
    }
  }

  if (isFullyFulfilled) {
    updates.status = "active_protection";
  } else {
    updates.status = "partially_fulfilled";
  }

  await supabase
    .from("retailer_protected_supply_cohorts")
    .update(updates)
    .eq("id", cohortId);

  revalidatePath("/admin/exchange-credit");
  return { success: true };
}

/**
 * 8. Read Store-level Protection Summary
 */
export async function getStoreProtectionSummaryAction(
  storeId: string
): Promise<StoreProtectionSummary> {
  await verifyAdminSession();
  const isAvailable = await checkExchangeCreditSchemaAvailability();
  if (!isAvailable || !storeId) {
    return { storeId, activeCohortsCount: 0, totalWholesaleValue: 0, cohorts: [] };
  }

  const supabase = createAdminClient();
  const { data: rawCohorts } = await supabase
    .from("retailer_protected_supply_cohorts")
    .select(`
      id,
      cohort_code,
      total_protected_quantity,
      frozen_unit_wholesale_price,
      status,
      evaluation_date,
      products:product_id(name, letusto_sku)
    `)
    .eq("store_id", storeId);

  if (!rawCohorts || rawCohorts.length === 0) {
    return { storeId, activeCohortsCount: 0, totalWholesaleValue: 0, cohorts: [] };
  }

  const activeCohorts = rawCohorts.filter((c) => c.status === "active_protection");
  const totalVal = rawCohorts.reduce((acc, c) => acc + c.total_protected_quantity * Number(c.frozen_unit_wholesale_price), 0);

  return {
    storeId,
    activeCohortsCount: activeCohorts.length,
    totalWholesaleValue: totalVal,
    cohorts: rawCohorts.map((c) => {
      const prod = Array.isArray(c.products) ? c.products[0] : c.products;
      return {
        id: c.id,
        cohortCode: c.cohort_code,
        productName: prod?.name || "Unknown Product",
        productSku: prod?.letusto_sku || "N/A",
        protectedQuantity: c.total_protected_quantity,
        status: c.status as ProtectedCohortStatus,
        evaluationDate: c.evaluation_date,
      };
    }),
  };
}
