/**
 * Retailer Performance Pure Domain Engine
 * Task ID: ADM-SALES-PERF-002
 * Location: lib/retailer/sales-performance/performance-engine.ts
 *
 * Implements pure calculations for:
 * - America/New_York Eastern Timezone evaluation windows (Current 60D vs Previous 60D)
 * - Net product sales (excluding shipping, tax, cancelled orders, store credit)
 * - Sales growth (handling New Store, New Revenue, N/A)
 * - Store Age and Day 0-59 New Store grading isolation
 * - Partnership compliance (Display, Weekly Inventory, Product Training)
 * - HQ Follow-up status & Data confidence
 * - Fact-based support recommendations
 * - Company-level aggregation without join duplication
 */

import type {
  EvaluationPeriod,
  StoreSalesMetrics,
  StoreComplianceMetrics,
  StoreFollowUpMetrics,
  RecommendedSupportProgram,
  StorePerformanceRecord,
  CompanyPerformanceRecord,
  UnallocatedCompanyOrder,
  PerformanceKpiSummary,
  RetailerPerformanceOverview,
  SupportStatus,
  DataConfidence,
  DisplayComplianceStatus,
  WeeklyInventoryComplianceStatus,
  ProductTrainingComplianceStatus,
  HqFollowUpStatus,
} from "./performance-types";

/**
 * 1. Resolves Eastern Time (America/New_York) calendar-day boundaries
 */
export function getEvaluationPeriodET(asOfDateInput?: Date | string): EvaluationPeriod {
  // Target timezone
  const timeZone = "America/New_York";

  let d: Date;
  if (!asOfDateInput) {
    d = new Date();
  } else if (typeof asOfDateInput === "string") {
    // Treat YYYY-MM-DD as local ET date
    d = new Date(`${asOfDateInput}T12:00:00Z`);
  } else {
    d = asOfDateInput;
  }

  // Format as YYYY-MM-DD in America/New_York
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const asOfDateStr = formatter.format(d); // "YYYY-MM-DD"

  // Compute calendar days offset using date parts
  function addDays(dateStr: string, days: number): string {
    const [y, m, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, day));
    dateObj.setUTCDate(dateObj.getUTCDate() + days);
    return dateObj.toISOString().split("T")[0];
  }

  const currentPeriodEnd = asOfDateStr; // T
  const currentPeriodStart = addDays(asOfDateStr, -60); // T - 60 days
  const previousPeriodEnd = currentPeriodStart; // T - 60 days
  const previousPeriodStart = addDays(asOfDateStr, -120); // T - 120 days

  return {
    timezone: timeZone,
    asOfDate: asOfDateStr,
    currentPeriodStart,
    currentPeriodEnd,
    previousPeriodStart,
    previousPeriodEnd,
  };
}

/**
 * 2. Checks if an ISO timestamp falls within a [start, end) calendar interval in ET
 */
export function isTimestampInEtWindow(
  isoTimestamp: string | null | undefined,
  startDateStr: string,
  endDateStr: string
): boolean {
  if (!isoTimestamp) return false;
  const timeZone = "America/New_York";
  const dateObj = new Date(isoTimestamp);
  if (isNaN(dateObj.getTime())) return false;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateInEt = formatter.format(dateObj); // "YYYY-MM-DD"

  // [startDateStr, endDateStr)
  return dateInEt >= startDateStr && dateInEt < endDateStr;
}

/**
 * 3. Calculates Net Sales for an order
 * Excludes shipping, taxes, and cancelled orders.
 * Merchandise discounts are deducted.
 * Redeemed store credit is a settlement method and is NOT deducted.
 */
export function calculateOrderNetProductSales(order: {
  order_status?: string | null;
  subtotal_amount?: number | string | null;
  discount_amount?: number | string | null;
}): number {
  const status = (order.order_status || "").toLowerCase();
  if (status === "cancelled" || status === "draft") {
    return 0;
  }

  const subtotal = Number(order.subtotal_amount) || 0;
  const discount = Number(order.discount_amount) || 0;

  return Math.max(0, subtotal - discount);
}

/**
 * 4. Calculates Sales Growth % and label
 */
export function calculateSalesGrowth(
  currentSales: number,
  previousSales: number,
  storeAgeDays: number
): { percent: number | null; label: string } {
  if (storeAgeDays < 60) {
    return { percent: null, label: "New Store" };
  }

  if (previousSales === 0) {
    if (currentSales > 0) {
      return { percent: null, label: "New Revenue" };
    }
    return { percent: null, label: "N/A" };
  }

  const diff = currentSales - previousSales;
  const percent = (diff / previousSales) * 100;
  const sign = percent > 0 ? "+" : "";
  const label = `${sign}${percent.toFixed(1)}%`;

  return { percent, label };
}

/**
 * 5. Store Age and Performance Grade Evaluation
 * Day 0-59: EvaluationStatus = "new", Grade = null
 * Day 60+: EvaluationStatus = "not_rated", Grade = null (No arbitrary unapproved thresholds)
 */
export function evaluateStoreAgeAndGrade(
  firstShipmentDate: string | null,
  storeCreatedAt: string,
  asOfDateStr: string
): {
  storeAgeDays: number;
  isNewStore: boolean;
  evaluationStatus: "new" | "not_rated" | "graded";
  performanceGrade: null;
  gradeReason: string;
} {
  const referenceDate = firstShipmentDate || storeCreatedAt;
  const asOf = new Date(`${asOfDateStr}T12:00:00Z`).getTime();
  const ref = new Date(referenceDate).getTime();
  const diffDays = Math.max(0, Math.floor((asOf - ref) / (1000 * 60 * 60 * 24)));

  const isNewStore = diffDays < 60;

  if (isNewStore) {
    return {
      storeAgeDays: diffDays,
      isNewStore: true,
      evaluationStatus: "new",
      performanceGrade: null,
      gradeReason: "New Store (Day 0-59 initial stocking and onboarding period)",
    };
  }

  return {
    storeAgeDays: diffDays,
    isNewStore: false,
    evaluationStatus: "not_rated",
    performanceGrade: null,
    gradeReason: "Not Rated (Awaiting Owner-approved grading thresholds for mature stores)",
  };
}

/**
 * 6. Display Compliance Evaluation
 */
export function evaluateDisplayCompliance(
  fixtures: Array<{
    id: string;
    installation_status?: string | null;
    operational_status?: string | null;
    last_inspected_at?: string | null;
    notes?: string | null;
  }>,
  placementsCount: number,
  activities: Array<{
    activity_type?: string | null;
    activity_date?: string | null;
    title?: string | null;
    description?: string | null;
  }>
): StoreComplianceMetrics["display"] {
  if (!fixtures || fixtures.length === 0) {
    return {
      status: "not_verified",
      fixturesCount: 0,
      placementsCount: 0,
      lastInspectedDate: null,
      evidenceNotes: "No K SELECT fixtures registered for this store",
    };
  }

  // Find latest inspection in activities or fixture record
  const inspectionActivities = activities.filter(
    (a) => a.activity_type === "merchandising_inspection" || a.activity_type === "fixture_follow_up"
  );

  let lastInspectedDate: string | null = null;
  for (const f of fixtures) {
    if (f.last_inspected_at) {
      const d = f.last_inspected_at.split("T")[0];
      if (!lastInspectedDate || d > lastInspectedDate) lastInspectedDate = d;
    }
  }
  for (const a of inspectionActivities) {
    if (a.activity_date && (!lastInspectedDate || a.activity_date > lastInspectedDate)) {
      lastInspectedDate = a.activity_date;
    }
  }

  // Check if any explicit violation is documented in notes or activity description
  const hasViolation = inspectionActivities.some((a) => {
    const text = `${a.title || ""} ${a.description || ""}`.toLowerCase();
    return text.includes("violation") || text.includes("non-k select") || text.includes("unauthorized brand");
  });

  if (hasViolation) {
    return {
      status: "violation",
      fixturesCount: fixtures.length,
      placementsCount,
      lastInspectedDate,
      evidenceNotes: "Inspection records indicate unauthorized merchandise on fixture",
    };
  }

  // If inspection was conducted and no violation was logged
  if (lastInspectedDate) {
    return {
      status: "compliant",
      fixturesCount: fixtures.length,
      placementsCount,
      lastInspectedDate,
      evidenceNotes: "Verified via physical fixture merchandising inspection",
    };
  }

  return {
    status: "not_verified",
    fixturesCount: fixtures.length,
    placementsCount,
    lastInspectedDate: null,
    evidenceNotes: "Fixture installed; awaiting verified physical inspection",
  };
}

/**
 * 7. Weekly Inventory Reporting Compliance Evaluation
 */
export function evaluateWeeklyInventoryCompliance(
  checks: Array<{
    id: string;
    reporting_week: string;
    status: string;
    report_date?: string | null;
    submitted_at?: string | null;
  }>,
  storeCreatedAt: string,
  period: EvaluationPeriod
): StoreComplianceMetrics["weeklyInventory"] {
  // Deduplicate submitted checks by reporting_week within current 60D window
  const submittedChecksMap = new Map<string, { submittedAt: string | null; reportDate: string | null }>();

  for (const c of checks) {
    if (c.status === "submitted" && c.reporting_week) {
      if (isTimestampInEtWindow(c.submitted_at || c.report_date, period.currentPeriodStart, period.currentPeriodEnd)) {
        if (!submittedChecksMap.has(c.reporting_week)) {
          submittedChecksMap.set(c.reporting_week, {
            submittedAt: c.submitted_at || null,
            reportDate: c.report_date || null,
          });
        }
      }
    }
  }

  // Approximate 60D window as ~8.5 weeks (8 full reporting cycles)
  // Adjusted if store was created recently within the 60D window
  const storeStart = new Date(storeCreatedAt).toISOString().split("T")[0];
  const effectiveStart = storeStart > period.currentPeriodStart ? storeStart : period.currentPeriodStart;
  const daysActive = Math.max(1, Math.floor(
    (new Date(`${period.currentPeriodEnd}T12:00:00Z`).getTime() - new Date(`${effectiveStart}T12:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24)
  ));
  const eligibleWeeksCount = Math.max(1, Math.min(8, Math.floor(daysActive / 7)));

  const submittedWeeksCount = submittedChecksMap.size;
  const missedWeeksCount = Math.max(0, eligibleWeeksCount - submittedWeeksCount);
  const reportingCoveragePercent = Math.min(100, Math.round((submittedWeeksCount / eligibleWeeksCount) * 100));

  let lastSubmittedDate: string | null = null;
  let latestReportingWeek: string | null = null;
  for (const [week, info] of submittedChecksMap.entries()) {
    if (!latestReportingWeek || week > latestReportingWeek) {
      latestReportingWeek = week;
      lastSubmittedDate = info.submittedAt?.split("T")[0] || info.reportDate;
    }
  }

  let status: WeeklyInventoryComplianceStatus = "compliant";
  if (reportingCoveragePercent >= 80) {
    status = "compliant";
  } else if (reportingCoveragePercent >= 50) {
    status = "partial";
  } else {
    status = "non_compliant";
  }

  return {
    status,
    eligibleWeeksCount,
    submittedWeeksCount,
    reportingCoveragePercent,
    missedWeeksCount,
    lastSubmittedDate,
    latestReportingWeek,
  };
}

/**
 * 8. Product Training Compliance Evaluation
 */
export function evaluateProductTrainingCompliance(
  purchasedProductIds: string[],
  storeStaffUserIds: string[],
  completedRecords: Array<{ user_id: string; product_id: string; status: string }>
): StoreComplianceMetrics["productTraining"] {
  const distinctProducts = Array.from(new Set(purchasedProductIds));
  if (distinctProducts.length === 0) {
    return {
      status: "not_verified",
      purchasedProductsCount: 0,
      coveredProductsCount: 0,
      trainingGapsCount: 0,
      coveragePercent: null,
      assignedStaffCount: storeStaffUserIds.length,
      qualifiedStaffCount: 0,
    };
  }

  if (storeStaffUserIds.length === 0) {
    return {
      status: "not_verified",
      purchasedProductsCount: distinctProducts.length,
      coveredProductsCount: 0,
      trainingGapsCount: distinctProducts.length,
      coveragePercent: null,
      assignedStaffCount: 0,
      qualifiedStaffCount: 0,
    };
  }

  const staffSet = new Set(storeStaffUserIds);
  const coveredProductSet = new Set<string>();
  const qualifiedStaffSet = new Set<string>();

  for (const rec of completedRecords) {
    if (rec.status === "completed" && staffSet.has(rec.user_id)) {
      if (distinctProducts.includes(rec.product_id)) {
        coveredProductSet.add(rec.product_id);
        qualifiedStaffSet.add(rec.user_id);
      }
    }
  }

  const coveredCount = coveredProductSet.size;
  const trainingGapsCount = Math.max(0, distinctProducts.length - coveredCount);
  const coveragePercent = Math.round((coveredCount / distinctProducts.length) * 100);

  let status: ProductTrainingComplianceStatus = "compliant";
  if (coveragePercent >= 100) {
    status = "compliant";
  } else if (coveragePercent >= 50) {
    status = "partial";
  } else {
    status = "non_compliant";
  }

  return {
    status,
    purchasedProductsCount: distinctProducts.length,
    coveredProductsCount: coveredCount,
    trainingGapsCount,
    coveragePercent,
    assignedStaffCount: storeStaffUserIds.length,
    qualifiedStaffCount: qualifiedStaffSet.size,
  };
}

/**
 * 9. HQ Follow-up Status Evaluation
 */
export function evaluateHqFollowUpStatus(
  activities: Array<{
    id: string;
    activity_type?: string | null;
    activity_date?: string | null;
    responsible_admin_name?: string | null;
    has_follow_up?: boolean | null;
    follow_up_date?: string | null;
    follow_up_status?: string | null;
  }> | null | undefined,
  asOfDateStr: string
): StoreFollowUpMetrics {
  if (activities === null || activities === undefined) {
    return {
      status: "data_review",
      totalActivitiesCount: 0,
      lastActivityDate: null,
      lastActivityType: null,
      lastResponsibleAdmin: null,
      hasPendingFollowUp: false,
      nextFollowUpDate: null,
      isFollowUpOverdue: false,
      overdueDays: 0,
    };
  }

  if (activities.length === 0) {
    return {
      status: "attention",
      totalActivitiesCount: 0,
      lastActivityDate: null,
      lastActivityType: null,
      lastResponsibleAdmin: null,
      hasPendingFollowUp: false,
      nextFollowUpDate: null,
      isFollowUpOverdue: false,
      overdueDays: 0,
    };
  }

  // Sort activities newest first
  const sorted = [...activities].sort((a, b) => (b.activity_date || "").localeCompare(a.activity_date || ""));
  const latest = sorted[0];

  // Find overdue pending follow-ups
  let isFollowUpOverdue = false;
  let overdueDays = 0;
  let nextFollowUpDate: string | null = null;
  let hasPendingFollowUp = false;

  for (const act of activities) {
    if (act.has_follow_up && act.follow_up_status === "pending" && act.follow_up_date) {
      hasPendingFollowUp = true;
      if (!nextFollowUpDate || act.follow_up_date < nextFollowUpDate) {
        nextFollowUpDate = act.follow_up_date;
      }
      if (act.follow_up_date < asOfDateStr) {
        isFollowUpOverdue = true;
        const diff = Math.floor(
          (new Date(`${asOfDateStr}T12:00:00Z`).getTime() - new Date(`${act.follow_up_date}T12:00:00Z`).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diff > overdueDays) overdueDays = diff;
      }
    }
  }

  let status: HqFollowUpStatus = "on_track";
  if (isFollowUpOverdue) {
    status = "action_required";
  } else if (!hasPendingFollowUp) {
    status = "attention";
  }

  return {
    status,
    totalActivitiesCount: activities.length,
    lastActivityDate: latest.activity_date || null,
    lastActivityType: latest.activity_type || null,
    lastResponsibleAdmin: latest.responsible_admin_name || null,
    hasPendingFollowUp,
    nextFollowUpDate,
    isFollowUpOverdue,
    overdueDays,
  };
}

/**
 * 10. Data Confidence Derivation
 */
export function evaluateDataConfidence(
  sales: StoreSalesMetrics,
  compliance: StoreComplianceMetrics,
  followUp: StoreFollowUpMetrics
): DataConfidence {
  // High confidence: Store age >= 60 days, submitted checks >= 4, active orders present
  if (sales.storeAgeDays >= 60 && compliance.weeklyInventory.submittedWeeksCount >= 4 && sales.currentValidOrdersCount > 0) {
    return "high";
  }

  // Partial confidence: At least 1 valid order or some weekly checks submitted
  if (sales.currentValidOrdersCount > 0 || compliance.weeklyInventory.submittedWeeksCount > 0 || followUp.totalActivitiesCount > 0) {
    return "partial";
  }

  return "insufficient";
}

/**
 * 11. Support Recommendations Generator
 */
export function diagnoseSupportRecommendations(
  storeName: string,
  sales: StoreSalesMetrics,
  compliance: StoreComplianceMetrics,
  followUp: StoreFollowUpMetrics
): RecommendedSupportProgram[] {
  const programs: RecommendedSupportProgram[] = [];

  // 1. New Store Onboarding
  if (sales.isNewStore) {
    programs.push({
      programType: "new_store_onboarding",
      title: "New Store Onboarding & Stocking Review",
      priority: "high",
      reason: `Store is in day ${sales.storeAgeDays} of initial 60-day launch period.`,
      triggerMetric: `Store Age: ${sales.storeAgeDays} days (< 60 days)`,
      suggestedAction: "Conduct onboarding check-in to confirm shelf merchandising and initial customer response.",
      targetActivityType: "store_visit",
    });
  }

  // 2. Follow-up Recovery (Action Required)
  if (followUp.isFollowUpOverdue) {
    programs.push({
      programType: "follow_up_recovery",
      title: "Overdue Follow-up Recovery",
      priority: "high",
      reason: `Scheduled follow-up is overdue by ${followUp.overdueDays} days.`,
      triggerMetric: `Overdue Follow-up Date: ${followUp.nextFollowUpDate}`,
      suggestedAction: "Contact store manager immediately to resolve pending operational task.",
      targetActivityType: "retailer_communication",
    });
  }

  // 3. Inventory Reporting Recovery
  if (compliance.weeklyInventory.status === "non_compliant" || (compliance.weeklyInventory.reportingCoveragePercent !== null && compliance.weeklyInventory.reportingCoveragePercent < 50)) {
    programs.push({
      programType: "inventory_reporting_recovery",
      title: "Weekly Inventory Reporting Assistance",
      priority: "medium",
      reason: `Store has submitted only ${compliance.weeklyInventory.submittedWeeksCount} of ${compliance.weeklyInventory.eligibleWeeksCount} eligible weekly reports (${compliance.weeklyInventory.reportingCoveragePercent ?? 0}%).`,
      triggerMetric: `Coverage: ${compliance.weeklyInventory.reportingCoveragePercent ?? 0}% (< 50%)`,
      suggestedAction: "Schedule a walkthrough with store manager to demonstrate mobile inventory check submission.",
      targetActivityType: "inventory_follow_up",
    });
  }

  // 4. Training Support
  if (compliance.productTraining.trainingGapsCount > 0) {
    programs.push({
      programType: "training_support",
      title: "Staff Product Training Assistance",
      priority: "medium",
      reason: `Store carries ${compliance.productTraining.purchasedProductsCount} products with ${compliance.productTraining.trainingGapsCount} uncompleted training modules.`,
      triggerMetric: `${compliance.productTraining.trainingGapsCount} SKU Training Gaps`,
      suggestedAction: "Send Learning Center quick links and invite store staff to complete required product modules.",
      targetActivityType: "training_follow_up",
    });
  }

  // 5. Display Compliance Review
  if (compliance.display.status === "not_verified" || compliance.display.status === "violation") {
    programs.push({
      programType: "display_compliance_review",
      title: "Fixture Display Inspection",
      priority: compliance.display.status === "violation" ? "high" : "low",
      reason: compliance.display.evidenceNotes || "Awaiting verified physical merchandising inspection.",
      triggerMetric: `Display Status: ${compliance.display.status.toUpperCase()}`,
      suggestedAction: "Schedule visual audit or request photo verification of K SELECT fixture shelves.",
      targetActivityType: "merchandising_inspection",
    });
  }

  // 6. Sales Improvement (Declining Sales)
  if (sales.salesGrowthPercent !== null && sales.salesGrowthPercent < -15) {
    programs.push({
      programType: "sales_improvement",
      title: "Sales Velocity & Reorder Support",
      priority: "medium",
      reason: `60-day Net Sales declined by ${Math.abs(sales.salesGrowthPercent).toFixed(1)}% compared to previous period.`,
      triggerMetric: `Growth: ${sales.salesGrowthLabel}`,
      suggestedAction: "Review local top sellers and evaluate assortment rebalancing or promotional support.",
      targetActivityType: "retailer_communication",
    });
  }

  // 7. Growth Expansion (High Growth Store)
  if (sales.salesGrowthPercent !== null && sales.salesGrowthPercent > 20 && sales.confirmedReordersCount >= 1) {
    programs.push({
      programType: "growth_expansion",
      title: "Top Performer Expansion Review",
      priority: "low",
      reason: `Strong sales expansion (+${sales.salesGrowthPercent.toFixed(1)}%) with ${sales.confirmedReordersCount} confirmed reorders.`,
      triggerMetric: `Growth: ${sales.salesGrowthLabel}, Reorders: ${sales.confirmedReordersCount}`,
      suggestedAction: "Explore expanding shelf facings or introducing high-margin new arrivals.",
      targetActivityType: "store_visit",
    });
  }

  return programs;
}

/**
 * 12. Support Status Derivation
 */
export function deriveSupportStatus(
  sales: StoreSalesMetrics,
  compliance: StoreComplianceMetrics,
  followUp: StoreFollowUpMetrics
): SupportStatus {
  if (followUp.isFollowUpOverdue) {
    return "action_required";
  }

  if (
    compliance.weeklyInventory.status === "non_compliant" ||
    compliance.productTraining.status === "non_compliant" ||
    (sales.salesGrowthPercent !== null && sales.salesGrowthPercent < -25)
  ) {
    return "support_required";
  }

  if (followUp.status === "attention" || compliance.weeklyInventory.status === "partial") {
    return "monitor";
  }

  return "healthy";
}

/**
 * 13. Aggregates Store Records into Company Records with Unallocated Company Orders
 */
export function aggregateStoresToCompany(
  stores: StorePerformanceRecord[],
  unallocatedOrders: UnallocatedCompanyOrder[]
): CompanyPerformanceRecord[] {
  const companyMap = new Map<string, {
    companyId: string;
    companyName: string;
    companyCode: string | null;
    stores: StorePerformanceRecord[];
    unallocated: UnallocatedCompanyOrder[];
  }>();

  for (const s of stores) {
    if (!companyMap.has(s.companyId)) {
      companyMap.set(s.companyId, {
        companyId: s.companyId,
        companyName: s.companyName,
        companyCode: s.companyCode,
        stores: [],
        unallocated: [],
      });
    }
    companyMap.get(s.companyId)!.stores.push(s);
  }

  for (const u of unallocatedOrders) {
    if (!companyMap.has(u.companyId)) {
      companyMap.set(u.companyId, {
        companyId: u.companyId,
        companyName: "Unknown Company",
        companyCode: null,
        stores: [],
        unallocated: [],
      });
    }
    companyMap.get(u.companyId)!.unallocated.push(u);
  }

  const result: CompanyPerformanceRecord[] = [];

  for (const entry of companyMap.values()) {
    const allocatedStoreSales = entry.stores.reduce((acc, s) => acc + s.sales.currentNetSalesDollars, 0);
    const unallocatedSales = entry.unallocated.reduce((acc, u) => acc + Math.max(0, u.subtotalAmount - u.discountAmount), 0);
    const totalNetSales = allocatedStoreSales + unallocatedSales;

    const totalValidOrders =
      entry.stores.reduce((acc, s) => acc + s.sales.currentValidOrdersCount, 0) + entry.unallocated.length;

    const supportRequiredStoresCount = entry.stores.filter(
      (s) => s.supportStatus === "support_required" || s.supportStatus === "action_required"
    ).length;

    const actionRequiredStoresCount = entry.stores.filter((s) => s.supportStatus === "action_required").length;

    result.push({
      companyId: entry.companyId,
      companyName: entry.companyName,
      companyCode: entry.companyCode,
      storesCount: entry.stores.length,
      activeStoresCount: entry.stores.filter((s) => s.status === "active").length,
      totalNetSalesDollars: Math.round(totalNetSales * 100) / 100,
      allocatedStoreSalesDollars: Math.round(allocatedStoreSales * 100) / 100,
      unallocatedSalesDollars: Math.round(unallocatedSales * 100) / 100,
      unallocatedOrdersCount: entry.unallocated.length,
      unallocatedOrders: entry.unallocated,
      totalValidOrdersCount: totalValidOrders,
      supportRequiredStoresCount,
      actionRequiredStoresCount,
      stores: entry.stores,
    });
  }

  return result.sort((a, b) => b.totalNetSalesDollars - a.totalNetSalesDollars);
}

/**
 * 14. Performance KPI Summary
 */
export function computeKpiSummary(
  stores: StorePerformanceRecord[],
  companies: CompanyPerformanceRecord[],
  period: EvaluationPeriod
): PerformanceKpiSummary {
  let totalNetSalesDollars = 0;
  let previousNetSalesDollars = 0;

  for (const c of companies) {
    totalNetSalesDollars += c.totalNetSalesDollars;
  }

  for (const s of stores) {
    previousNetSalesDollars += s.sales.previousNetSalesDollars;
  }

  const growth = calculateSalesGrowth(totalNetSalesDollars, previousNetSalesDollars, 999);

  const distinctSupportRequired = stores.filter(
    (s) => s.supportStatus === "support_required" || s.supportStatus === "action_required"
  ).length;

  const distinctHqGaps = stores.filter(
    (s) => s.followUp.status === "action_required" || s.followUp.status === "attention"
  ).length;

  return {
    totalNetSalesDollars: Math.round(totalNetSalesDollars * 100) / 100,
    previousNetSalesDollars: Math.round(previousNetSalesDollars * 100) / 100,
    salesGrowthPercent: growth.percent,
    salesGrowthLabel: growth.label,
    totalActiveStoresCount: stores.filter((s) => s.status === "active").length,
    supportRequiredStoresCount: distinctSupportRequired,
    hqFollowUpGapsCount: distinctHqGaps,
    evaluationPeriod: period,
    lastRefreshedAt: new Date().toISOString(),
  };
}
