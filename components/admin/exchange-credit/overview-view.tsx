"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ExchangeCreditOverviewStats,
  CompanyExchangeEnrollment,
  ProtectedSupplyCohort,
  EnrollmentAuditLog,
} from "@/lib/retailer/exchange-credit-types";
import { CohortTable } from "./cohort-table";
import { CompanySettingsView } from "./company-settings-view";
import { CohortDetailView } from "./cohort-detail-view";
import { RegisterCohortModal } from "./register-cohort-modal";

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"cohorts" | "companies" | "audit">("cohorts");
  const [selectedCohort, setSelectedCohort] = useState<ProtectedSupplyCohort | null>(null);
  const [showRegisterCohortModal, setShowRegisterCohortModal] = useState(false);

  const { isSchemaAvailable, stats, enrollments, cohorts, auditLogs } = initialData;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* 1. Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
        <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          Admin
        </Link>
        <span>/</span>
        <span className="font-bold text-zinc-900 dark:text-white">90-Day Exchange Credit</span>
      </div>

      {/* 2. Schema Availability Banner (Safe Runtime Guarantee) */}
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

      {/* 3. Page Header */}
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

        {/* Global Action: ONE Primary Action */}
        <div className="flex items-center gap-2">
          {isSchemaAvailable && (
            <button
              type="button"
              onClick={() => setShowRegisterCohortModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-98"
            >
              <span>+</span>
              <span>Register Protected Cohort</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. KPI Summary Cards (4-Column Responsive, Equal-Width) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
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
          <p className="mt-1 text-[11px] text-zinc-500">Retailers enrolled in 90-day pilot (Active vs Paused)</p>
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
          <p className="mt-1 text-[11px] text-zinc-500">Distinct Store+SKU cohorts in active 90-day trial</p>
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
          <p className="mt-1 text-[11px] text-zinc-500">Frozen wholesale cost baseline (at original order price)</p>
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
          <p className="mt-1 text-[11px] text-zinc-500">Cohorts reaching Day 100 evaluation</p>
        </div>
      </div>

      {/* 5. Main Body: Drill-down or Tabs */}
      {selectedCohort ? (
        <CohortDetailView
          cohort={selectedCohort}
          onBack={() => setSelectedCohort(null)}
          isSchemaAvailable={isSchemaAvailable}
        />
      ) : (
        <div className="space-y-4 w-full">
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

      {/* Guided Register Protected Cohort Modal */}
      <RegisterCohortModal
        isOpen={showRegisterCohortModal}
        onClose={() => setShowRegisterCohortModal(false)}
        onSuccess={() => {
          setShowRegisterCohortModal(false);
          router.refresh();
        }}
        enrollments={enrollments}
        onSwitchToCompanyEnrollment={() => setActiveTab("companies")}
      />
    </div>
  );
}
