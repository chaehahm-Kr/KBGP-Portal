"use client";

import React, { useState } from "react";
import type {
  ExchangeCreditOverviewStats,
  CompanyExchangeEnrollment,
  ProtectedSupplyCohort,
  EnrollmentAuditLog,
} from "@/lib/retailer/exchange-credit-types";
import { CohortTable } from "./cohort-table";
import { CompanySettingsView } from "./company-settings-view";
import { CohortDetailView } from "./cohort-detail-view";
import { registerProtectedSupplyCohortAction } from "@/lib/retailer/exchange-credit-actions";

interface ExchangeCreditOverviewViewProps {
  initialData: {
    isSchemaAvailable: boolean;
    stats: ExchangeCreditOverviewStats;
    enrollments: CompanyExchangeEnrollment[];
    cohorts: ProtectedSupplyCohort[];
    auditLogs: EnrollmentAuditLog[];
  };
}

export function ExchangeCreditOverviewView({ initialData }: ExchangeCreditOverviewViewProps) {
  const [activeTab, setActiveTab] = useState<"cohorts" | "companies" | "audit">("cohorts");
  const [selectedCohort, setSelectedCohort] = useState<ProtectedSupplyCohort | null>(null);
  const [showRegisterCohortModal, setShowRegisterCohortModal] = useState(false);

  // Form state for Register Cohort Modal
  const [companyId, setCompanyId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [sourceOrderId, setSourceOrderId] = useState("");
  const [sourceOrderItemId, setSourceOrderItemId] = useState("");
  const [protectedQty, setProtectedQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [firstShipDate, setFirstShipDate] = useState("");
  const [firstDelivDate, setFirstDelivDate] = useState("");
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const { isSchemaAvailable, stats, enrollments, cohorts, auditLogs } = initialData;

  const handleOpenRegisterCohort = () => {
    setCompanyId("");
    setStoreId("");
    setProductId("");
    setSourceOrderId("");
    setSourceOrderItemId("");
    setProtectedQty("");
    setUnitCost("");
    setFirstShipDate("");
    setFirstDelivDate("");
    setRegisterError("");
    setShowRegisterCohortModal(true);
  };

  const handleRegisterCohortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterSubmitting(true);
    setRegisterError("");

    try {
      const res = await registerProtectedSupplyCohortAction({
        companyId: companyId.trim(),
        storeId: storeId.trim(),
        productId: productId.trim(),
        sourceOrderId: sourceOrderId.trim(),
        sourceOrderItemId: sourceOrderItemId.trim(),
        protectedQuantity: parseInt(protectedQty, 10),
        unitWholesalePrice: parseFloat(unitCost),
        firstShipmentDate: firstShipDate || undefined,
        firstDeliveryDate: firstDelivDate || undefined,
      });

      if (!res.success) {
        setRegisterError(res.error || "Failed to register cohort.");
      } else {
        setShowRegisterCohortModal(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setRegisterError(message || "An unexpected error occurred.");
    } finally {
      setRegisterSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Schema Availability Banner (Safe Runtime Guarantee) */}
      {!isSchemaAvailable && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 shadow-xs">
          <span className="text-xl">⚠️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-200">
              Exchange Credit Phase 1: Migration 0175 Awaiting Owner Execution
            </h4>
            <p className="text-amber-300/90 leading-relaxed">
              The database tables for the 90-Day Exchange Credit Program (
              <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200">
                retailer_exchange_program_enrollments
              </code>
              ,{" "}
              <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200">
                retailer_protected_supply_cohorts
              </code>
              , and shipments) are prepared in{" "}
              <strong className="text-white">Migration 0175</strong> and pending manual execution by the
              Owner in the Supabase SQL Editor. Safe preview mode is currently active.
            </p>
          </div>
        </div>
      )}

      {/* 2. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">90-Day Exchange Credit</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Phase 1 · Foundation
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Company program enrollment, lifetime Store/SKU protected cohorts, and frozen wholesale baseline management
          </p>
        </div>

        {/* Global Action / Status */}
        <div className="flex items-center gap-2">
          {isSchemaAvailable && (
            <button
              type="button"
              onClick={handleOpenRegisterCohort}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>+</span>
              <span>Register Protected Cohort</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Enrolled Retailers */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Enrolled Retailers
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{stats.totalEnrolledCompanies}</span>
            <span className="text-xs text-zinc-500">
              ({stats.activeCompaniesCount} active / {stats.pausedCompaniesCount} paused)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Companies participating in 90-day program</p>
        </div>

        {/* Active Protected Cohorts */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Active Protected SKUs
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400">{stats.activeProtectedCohortsCount}</span>
            <span className="text-xs text-zinc-500">of {stats.totalProtectedCohortsCount} total</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Currently in active 90-day trial window</p>
        </div>

        {/* Protected Wholesale Value */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Protected Wholesale Value
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-cyan-400">
              ${stats.totalProtectedWholesaleValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Frozen inventory baseline at wholesale cost</p>
        </div>

        {/* Upcoming Day 100 Evaluations */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Upcoming Evaluations (Day 100)
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-400">{stats.upcomingDay100Count}</span>
            <span className="text-xs text-zinc-500">within next 14 days</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Cohorts nearing eligibility determination</p>
        </div>
      </div>

      {/* 4. Main Body: Drill-down or Tabs */}
      {selectedCohort ? (
        <CohortDetailView
          cohort={selectedCohort}
          onBack={() => setSelectedCohort(null)}
          isSchemaAvailable={isSchemaAvailable}
        />
      ) : (
        <div className="space-y-4">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-zinc-800 pb-px">
            <button
              type="button"
              onClick={() => setActiveTab("cohorts")}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "cohorts"
                  ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Protected Supply Cohorts ({cohorts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("companies")}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "companies"
                  ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Company Enrollments & Policies ({enrollments.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "cohorts" && (
            <CohortTable
              cohorts={cohorts}
              onSelectCohort={(c) => setSelectedCohort(c)}
              onOpenRegisterModal={handleOpenRegisterCohort}
              isSchemaAvailable={isSchemaAvailable}
            />
          )}

          {activeTab === "companies" && (
            <CompanySettingsView
              enrollments={enrollments}
              auditLogs={auditLogs}
              isSchemaAvailable={isSchemaAvailable}
            />
          )}
        </div>
      )}

      {/* Register Protected Cohort Modal */}
      {showRegisterCohortModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Register Initial Protected Supply Cohort</h3>
            <p className="text-[11px] text-zinc-400">
              Establish the initial protected inventory baseline for a Store + SKU combination.
              Only initial orders are protected; subsequent orders are reorders and disqualified.
            </p>
            {registerError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {registerError}
              </div>
            )}
            <form onSubmit={handleRegisterCohortSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Company UUID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Company ID"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Store UUID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Store ID"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Product UUID *</label>
                <input
                  type="text"
                  required
                  placeholder="Product ID"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Source Order UUID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Order ID"
                    value={sourceOrderId}
                    onChange={(e) => setSourceOrderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Order Item UUID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Order Item ID"
                    value={sourceOrderItemId}
                    onChange={(e) => setSourceOrderItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Protected Quantity (Units) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 50"
                    value={protectedQty}
                    onChange={(e) => setProtectedQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Unit Wholesale Cost ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 14.50"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">First Shipment Date</label>
                  <input
                    type="date"
                    value={firstShipDate}
                    onChange={(e) => setFirstShipDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">First Delivery Date</label>
                  <input
                    type="date"
                    value={firstDelivDate}
                    onChange={(e) => setFirstDelivDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterCohortModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {registerSubmitting ? "Registering..." : "Register Cohort"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
