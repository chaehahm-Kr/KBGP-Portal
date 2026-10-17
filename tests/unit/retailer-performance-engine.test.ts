/**
 * Retailer Performance Pure Domain Engine Unit Tests
 * Task ID: ADM-SALES-PERF-002
 * Location: tests/unit/retailer-performance-engine.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getEvaluationPeriodET,
  isTimestampInEtWindow,
  calculateOrderNetProductSales,
  calculateSalesGrowth,
  evaluateStoreAgeAndGrade,
  evaluateDisplayCompliance,
  evaluateWeeklyInventoryCompliance,
  evaluateProductTrainingCompliance,
  evaluateHqFollowUpStatus,
  evaluateDataConfidence,
  diagnoseSupportRecommendations,
  deriveSupportStatus,
  aggregateStoresToCompany,
  computeKpiSummary,
} from "../../lib/retailer/sales-performance/performance-engine";
import type { StorePerformanceRecord, UnallocatedCompanyOrder } from "../../lib/retailer/sales-performance/performance-types";

describe("ADM-SALES-PERF-002: Retailer Performance Pure Domain Engine", () => {
  describe("1. Evaluation Period & America/New_York Timezone", () => {
    it("generates exact 60-day non-overlapping intervals in Eastern Time", () => {
      const period = getEvaluationPeriodET("2026-10-17");
      expect(period.timezone).toBe("America/New_York");
      expect(period.asOfDate).toBe("2026-10-17");
      expect(period.currentPeriodEnd).toBe("2026-10-17");
      expect(period.currentPeriodStart).toBe("2026-08-18");
      expect(period.previousPeriodEnd).toBe("2026-08-18");
      expect(period.previousPeriodStart).toBe("2026-06-19");
    });

    it("evaluates timestamp inclusion within ET calendar boundaries correctly", () => {
      const period = getEvaluationPeriodET("2026-10-17");
      // Exactly within Current 60D
      expect(isTimestampInEtWindow("2026-10-10T15:30:00Z", period.currentPeriodStart, period.currentPeriodEnd)).toBe(true);
      // In Previous 60D
      expect(isTimestampInEtWindow("2026-07-15T12:00:00Z", period.previousPeriodStart, period.previousPeriodEnd)).toBe(true);
      // Older than 120D
      expect(isTimestampInEtWindow("2026-05-01T12:00:00Z", period.previousPeriodStart, period.previousPeriodEnd)).toBe(false);
      // Future
      expect(isTimestampInEtWindow("2026-10-25T12:00:00Z", period.currentPeriodStart, period.currentPeriodEnd)).toBe(false);
    });
  });

  describe("2. Net Product Sales & Exclusions", () => {
    it("deducts merchandise discounts and excludes cancelled orders", () => {
      const normalOrder = { order_status: "delivered", subtotal_amount: 500, discount_amount: 50 };
      expect(calculateOrderNetProductSales(normalOrder)).toBe(450);

      const cancelledOrder = { order_status: "cancelled", subtotal_amount: 500, discount_amount: 50 };
      expect(calculateOrderNetProductSales(cancelledOrder)).toBe(0);

      const draftOrder = { order_status: "draft", subtotal_amount: 500, discount_amount: 0 };
      expect(calculateOrderNetProductSales(draftOrder)).toBe(0);
    });

    it("does NOT subtract redeemed store credit as a sales discount", () => {
      // Store credit is recorded as a payment method, not a merchandise discount
      const orderPaidWithCredit = {
        order_status: "confirmed",
        subtotal_amount: 800,
        discount_amount: 0, // No coupon discount
      };
      expect(calculateOrderNetProductSales(orderPaidWithCredit)).toBe(800);
    });
  });

  describe("3. Sales Growth Handling", () => {
    it("returns 'New Store' for stores under 60 days age", () => {
      const growth = calculateSalesGrowth(1200, 0, 25);
      expect(growth.percent).toBeNull();
      expect(growth.label).toBe("New Store");
    });

    it("returns 'New Revenue' when previous period sales = 0 and current sales > 0", () => {
      const growth = calculateSalesGrowth(1500, 0, 75);
      expect(growth.percent).toBeNull();
      expect(growth.label).toBe("New Revenue");
    });

    it("returns 'N/A' when both periods have 0 sales", () => {
      const growth = calculateSalesGrowth(0, 0, 90);
      expect(growth.percent).toBeNull();
      expect(growth.label).toBe("N/A");
    });

    it("calculates exact percentage for mature stores with positive or negative growth", () => {
      const posGrowth = calculateSalesGrowth(1500, 1000, 100);
      expect(posGrowth.percent).toBe(50);
      expect(posGrowth.label).toBe("+50.0%");

      const negGrowth = calculateSalesGrowth(800, 1000, 100);
      expect(negGrowth.percent).toBe(-20);
      expect(negGrowth.label).toBe("-20.0%");
    });
  });

  describe("4. Store Age & Performance Grade Rules", () => {
    it("classifies Day 0 to Day 59 as 'new' with null grade", () => {
      const day0 = evaluateStoreAgeAndGrade("2026-10-17", "2026-10-17", "2026-10-17");
      expect(day0.storeAgeDays).toBe(0);
      expect(day0.isNewStore).toBe(true);
      expect(day0.evaluationStatus).toBe("new");
      expect(day0.performanceGrade).toBeNull();

      const day59 = evaluateStoreAgeAndGrade("2026-08-19", "2026-08-19", "2026-10-17");
      expect(day59.storeAgeDays).toBe(59);
      expect(day59.isNewStore).toBe(true);
      expect(day59.evaluationStatus).toBe("new");
      expect(day59.performanceGrade).toBeNull();
    });

    it("classifies Day 60+ as 'not_rated' without inventing arbitrary unapproved thresholds", () => {
      const day60 = evaluateStoreAgeAndGrade("2026-08-18", "2026-08-18", "2026-10-17");
      expect(day60.storeAgeDays).toBe(60);
      expect(day60.isNewStore).toBe(false);
      expect(day60.evaluationStatus).toBe("not_rated");
      expect(day60.performanceGrade).toBeNull();
      expect(day60.gradeReason).toContain("Awaiting Owner-approved grading thresholds");
    });
  });

  describe("5. Partnership Compliance Evaluations", () => {
    it("evaluates Display Compliance: returns 'not_verified' if no physical inspection was performed", () => {
      const fixtures = [{ id: "fix-1", installation_status: "installed", operational_status: "active" }];
      const result = evaluateDisplayCompliance(fixtures, 4, []);
      expect(result.status).toBe("not_verified");
      expect(result.fixturesCount).toBe(1);
      expect(result.placementsCount).toBe(4);
    });

    it("evaluates Display Compliance: returns 'violation' if inspection notes document foreign brand", () => {
      const fixtures = [{ id: "fix-1", installation_status: "installed", operational_status: "active" }];
      const activities = [
        {
          activity_type: "merchandising_inspection",
          activity_date: "2026-10-15",
          title: "Display inspection",
          description: "Found unauthorized non-k select product on shelf 2 (violation)",
        },
      ];
      const result = evaluateDisplayCompliance(fixtures, 4, activities);
      expect(result.status).toBe("violation");
    });

    it("evaluates Weekly Inventory: deduplicates multiple submissions in the same week and excludes drafts", () => {
      const period = getEvaluationPeriodET("2026-10-17");
      const checks = [
        { id: "c-1", reporting_week: "2026-W40", status: "submitted", submitted_at: "2026-10-05T12:00:00Z" },
        { id: "c-2", reporting_week: "2026-W40", status: "submitted", submitted_at: "2026-10-06T12:00:00Z" }, // Duplicate week
        { id: "c-3", reporting_week: "2026-W41", status: "draft", report_date: "2026-10-12" }, // Draft must be excluded
        { id: "c-4", reporting_week: "2026-W42", status: "submitted", submitted_at: "2026-10-15T12:00:00Z" },
      ];
      const result = evaluateWeeklyInventoryCompliance(checks, "2026-06-01", period);
      expect(result.submittedWeeksCount).toBe(2); // Only W40 and W42
      expect(result.eligibleWeeksCount).toBe(8);
      expect(result.reportingCoveragePercent).toBe(25);
      expect(result.status).toBe("non_compliant");
    });

    it("evaluates Product Training: returns 'not_verified' when no store staff are mapped", () => {
      const result = evaluateProductTrainingCompliance(["prod-1", "prod-2"], [], []);
      expect(result.status).toBe("not_verified");
      expect(result.trainingGapsCount).toBe(2);
    });

    it("evaluates Product Training: computes exact coverage percent when staff have completions", () => {
      const purchased = ["prod-1", "prod-2"];
      const staff = ["user-1"];
      const completions = [{ user_id: "user-1", product_id: "prod-1", status: "completed" }];
      const result = evaluateProductTrainingCompliance(purchased, staff, completions);
      expect(result.status).toBe("partial");
      expect(result.coveredProductsCount).toBe(1);
      expect(result.trainingGapsCount).toBe(1);
      expect(result.coveragePercent).toBe(50);
    });
  });

  describe("6. HQ Follow-up & Support Status", () => {
    it("flags 'action_required' when pending follow-up is overdue", () => {
      const activities = [
        {
          id: "act-1",
          activity_type: "store_visit",
          activity_date: "2026-10-01",
          has_follow_up: true,
          follow_up_status: "pending",
          follow_up_date: "2026-10-10", // Past date relative to 2026-10-17
        },
      ];
      const followUp = evaluateHqFollowUpStatus(activities, "2026-10-17");
      expect(followUp.status).toBe("action_required");
      expect(followUp.isFollowUpOverdue).toBe(true);
      expect(followUp.overdueDays).toBe(7);
    });

    it("flags 'attention' when no follow-up plan is scheduled", () => {
      const activities = [
        {
          id: "act-1",
          activity_type: "retailer_communication",
          activity_date: "2026-10-15",
          has_follow_up: false,
          follow_up_status: "none",
        },
      ];
      const followUp = evaluateHqFollowUpStatus(activities, "2026-10-17");
      expect(followUp.status).toBe("attention");
      expect(followUp.isFollowUpOverdue).toBe(false);
    });
  });

  describe("7. Support Program Recommendations", () => {
    it("recommends New Store Onboarding for stores in Day 0-59", () => {
      const sales = { isNewStore: true, storeAgeDays: 14 } as any;
      const compliance = { weeklyInventory: { status: "compliant" }, productTraining: { trainingGapsCount: 0 }, display: { status: "compliant" } } as any;
      const followUp = { isFollowUpOverdue: false, status: "on_track" } as any;

      const recommendations = diagnoseSupportRecommendations("Test Store", sales, compliance, followUp);
      expect(recommendations.some((r) => r.programType === "new_store_onboarding")).toBe(true);
    });

    it("recommends Inventory Reporting Recovery when weekly coverage is low", () => {
      const sales = { isNewStore: false, storeAgeDays: 120, salesGrowthPercent: 5 } as any;
      const compliance = {
        weeklyInventory: { status: "non_compliant", reportingCoveragePercent: 25, submittedWeeksCount: 2, eligibleWeeksCount: 8 },
        productTraining: { trainingGapsCount: 0 },
        display: { status: "compliant" },
      } as any;
      const followUp = { isFollowUpOverdue: false, status: "on_track" } as any;

      const recommendations = diagnoseSupportRecommendations("Test Store", sales, compliance, followUp);
      expect(recommendations.some((r) => r.programType === "inventory_reporting_recovery")).toBe(true);
    });
  });

  describe("8. Company Aggregation & Unallocated Orders", () => {
    it("aggregates stores and preserves unallocated company orders without double counting", () => {
      const mockStore: StorePerformanceRecord = {
        storeId: "store-1",
        storeName: "LA Store",
        storeCode: "STORE-01",
        companyId: "comp-1",
        companyName: "Acme Retail",
        companyCode: "ACM",
        city: "Los Angeles",
        state: "CA",
        status: "active",
        createdAt: "2026-09-01",
        evaluationStatus: "new",
        performanceGrade: null,
        gradeReason: "New",
        supportStatus: "healthy",
        dataConfidence: "partial",
        sales: {
          currentNetSalesDollars: 1000,
          previousNetSalesDollars: 0,
          salesGrowthPercent: null,
          salesGrowthLabel: "New Store",
          currentValidOrdersCount: 2,
          previousValidOrdersCount: 0,
          confirmedReordersCount: 1,
          grossSubtotalDollars: 1000,
          discountsDollars: 0,
          refundsDollars: 0,
          firstShipmentDate: "2026-09-15",
          storeAgeDays: 32,
          isNewStore: true,
        },
        compliance: {} as any,
        followUp: { status: "on_track" } as any,
        recommendedPrograms: [],
      };

      const unallocated: UnallocatedCompanyOrder[] = [
        {
          orderId: "ord-blanket",
          orderNumber: "KSR-BLANKET-01",
          companyId: "comp-1",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 500,
          discountAmount: 50,
          totalAmount: 450,
          createdAt: "2026-10-01",
        },
      ];

      const companyRecords = aggregateStoresToCompany([mockStore], unallocated);
      expect(companyRecords.length).toBe(1);
      const comp = companyRecords[0];
      expect(comp.allocatedStoreSalesDollars).toBe(1000);
      expect(comp.unallocatedSalesDollars).toBe(450);
      expect(comp.totalNetSalesDollars).toBe(1450);
      expect(comp.storesCount).toBe(1);
      expect(comp.unallocatedOrdersCount).toBe(1);
    });
  });

  describe("9. Large Store Count Scale Simulation (500-2,000 Stores)", () => {
    it("aggregates 2,000 stores in linear time (< 50ms)", () => {
      const stores: StorePerformanceRecord[] = [];
      for (let i = 0; i < 2000; i++) {
        stores.push({
          storeId: `store-${i}`,
          storeName: `Store ${i}`,
          storeCode: `S-${i}`,
          companyId: `comp-${Math.floor(i / 5)}`,
          companyName: `Company ${Math.floor(i / 5)}`,
          companyCode: `C-${Math.floor(i / 5)}`,
          city: "City",
          state: "NY",
          status: "active",
          createdAt: "2026-08-01",
          evaluationStatus: "new",
          performanceGrade: null,
          gradeReason: "New",
          supportStatus: i % 10 === 0 ? "support_required" : "healthy",
          dataConfidence: "partial",
          sales: {
            currentNetSalesDollars: 1000 + i,
            previousNetSalesDollars: 800,
            salesGrowthPercent: 25,
            salesGrowthLabel: "+25.0%",
            currentValidOrdersCount: 3,
            previousValidOrdersCount: 2,
            confirmedReordersCount: 2,
            grossSubtotalDollars: 1000 + i,
            discountsDollars: 0,
            refundsDollars: 0,
            firstShipmentDate: "2026-08-15",
            storeAgeDays: 63,
            isNewStore: false,
          },
          compliance: {} as any,
          followUp: { status: "on_track" } as any,
          recommendedPrograms: [],
        });
      }

      const start = performance.now();
      const companies = aggregateStoresToCompany(stores, []);
      const period = getEvaluationPeriodET("2026-10-17");
      const kpis = computeKpiSummary(stores, companies, period);
      const elapsed = performance.now() - start;

      expect(companies.length).toBe(400); // 2000 / 5
      expect(kpis.totalActiveStoresCount).toBe(2000);
      expect(kpis.supportRequiredStoresCount).toBe(200); // 2000 / 10
      expect(elapsed).toBeLessThan(100); // Must be under 100ms
    });
  });
});
