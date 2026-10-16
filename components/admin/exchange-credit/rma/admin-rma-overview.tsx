"use client";

import React, { useState, useMemo } from "react";
import type { AdminRmaOverviewProps, AdminRmaFilterCategory } from "./admin-rma-types";
import { RMA_STATUS_UI_CONFIG } from "./admin-rma-types";
import { AdminRmaDetail } from "./admin-rma-detail";
import type { RmaAggregate } from "@/lib/retailer/rma";
import { calculateShippingDeadline } from "@/lib/retailer/rma";

export function AdminRmaOverview({
  rmas,
  isLoading = false,
  onSelectRma,
  onApproveRma,
  onCancelRma,
}: AdminRmaOverviewProps) {
  const [selectedRma, setSelectedRma] = useState<RmaAggregate | null>(null);
  const [activeFilter, setActiveFilter] = useState<AdminRmaFilterCategory>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // KPI Calculations
  const kpis = useMemo(() => {
    let pendingApproval = 0;
    let awaitingShipment = 0;
    let inTransit = 0;
    let inspection = 0;
    let exceptions = 0;
    let resolutionReady = 0;
    let totalWholesaleValueCents = 0;

    for (const r of rmas) {
      if (r.status === "awaiting_admin_approval") pendingApproval++;
      if (r.status === "approved") awaitingShipment++;
      if (r.status === "shipped") inTransit++;
      if (
        r.status === "delivered" ||
        r.status === "inspection_in_progress" ||
        r.status === "inspection_completed"
      ) {
        inspection++;
      }
      if (r.status === "exception" || (r.exceptions && r.exceptions.length > 0)) exceptions++;
      if (r.status === "resolution_ready") resolutionReady++;

      for (const line of r.lines) {
        totalWholesaleValueCents += line.quantityAuthorized * line.frozenWholesalePriceCents;
      }
    }

    return {
      total: rmas.length,
      pendingApproval,
      awaitingShipment,
      inTransit,
      inspection,
      exceptions,
      resolutionReady,
      totalWholesaleValueDollars: totalWholesaleValueCents / 100,
    };
  }, [rmas]);

  // Filtered List
  const filteredRmas = useMemo(() => {
    return rmas.filter((r) => {
      // 1. Status Filter
      if (activeFilter === "pending_approval" && r.status !== "awaiting_admin_approval") return false;
      if (activeFilter === "awaiting_shipment" && r.status !== "approved") return false;
      if (activeFilter === "in_transit" && r.status !== "shipped") return false;
      if (
        activeFilter === "warehouse_inspection" &&
        r.status !== "delivered" &&
        r.status !== "inspection_in_progress" &&
        r.status !== "inspection_completed"
      ) {
        return false;
      }
      if (activeFilter === "exceptions" && r.status !== "exception" && (!r.exceptions || r.exceptions.length === 0)) {
        return false;
      }
      if (activeFilter === "resolution_ready" && r.status !== "resolution_ready") return false;
      if (activeFilter === "completed_cancelled" && r.status !== "cancelled" && r.status !== "expired") {
        return false;
      }

      // 2. Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesRma = r.rmaNumber.toLowerCase().includes(q);
        const matchesClaim = r.claimNumber.toLowerCase().includes(q);
        const matchesStore = r.storeId.toLowerCase().includes(q);
        const matchesCompany = r.companyId.toLowerCase().includes(q);
        const matchesSku = r.lines.some(
          (l) => l.productSku.toLowerCase().includes(q) || l.productName.toLowerCase().includes(q)
        );
        if (!matchesRma && !matchesClaim && !matchesStore && !matchesCompany && !matchesSku) {
          return false;
        }
      }

      return true;
    });
  }, [rmas, activeFilter, searchTerm]);

  // If viewing detail
  if (selectedRma) {
    return (
      <AdminRmaDetail
        rma={selectedRma}
        onBack={() => setSelectedRma(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Option B Return & RMA Management
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Phase 3 · Returns & RMA Engine
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Store-level Option B return authorizations, prepaid carrier labels, warehouse inspection, and 100% wholesale credit reconciliation
          </p>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Total RMAs
          </div>
          <div className="mt-1 text-2xl font-bold text-white">{kpis.total}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">All Option B claims</div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Pending Approval
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{kpis.pendingApproval}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Awaiting Admin</div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            In Transit
          </div>
          <div className="mt-1 text-2xl font-bold text-cyan-400">{kpis.inTransit}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Carrier handoff verified</div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Warehouse Inspection
          </div>
          <div className="mt-1 text-2xl font-bold text-purple-400">{kpis.inspection}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Delivered & inspecting</div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Exceptions
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-400">{kpis.exceptions}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Requires review</div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Resolution Ready
          </div>
          <div className="mt-1 text-2xl font-bold text-teal-300">{kpis.resolutionReady}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Settlement proposed</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          <div className="relative min-w-[220px] mr-2">
            <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search RMA, Claim, Store, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {(
            [
              { id: "all", label: "All" },
              { id: "pending_approval", label: "Pending Approval" },
              { id: "awaiting_shipment", label: "Awaiting Shipment" },
              { id: "in_transit", label: "In Transit" },
              { id: "warehouse_inspection", label: "Warehouse Inspection" },
              { id: "exceptions", label: "Exceptions" },
              { id: "resolution_ready", label: "Resolution Ready" },
              { id: "completed_cancelled", label: "Closed / Cancelled" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === filter.id
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. RMA Management Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">RMA / Claim Ref</th>
                <th className="py-3 px-4">Store & Company</th>
                <th className="py-3 px-4 text-center">SKU Lines</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">14-Day Deadline</th>
                <th className="py-3 px-4 text-center">Tracking & Boxes</th>
                <th className="py-3 px-4">Inspection</th>
                <th className="py-3 px-4 text-right">Wholesale Value</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredRmas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">📦</span>
                      <p className="text-sm font-semibold text-zinc-400">No RMA records found</p>
                      <p className="text-xs text-zinc-500">
                        {searchTerm || activeFilter !== "all"
                          ? "Try clearing filters or search terms."
                          : "Option B Return requests submitted by retailers will appear here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRmas.map((rma) => {
                  const statusConf = RMA_STATUS_UI_CONFIG[rma.status] || {
                    label: rma.status,
                    badgeClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
                    dotColor: "bg-zinc-500",
                  };
                  const deadline = rma.approvalDate
                    ? calculateShippingDeadline(rma.approvalDate)
                    : null;
                  const totalUnits = rma.lines.reduce((acc, l) => acc + l.quantityAuthorized, 0);
                  const totalValueCents = rma.lines.reduce(
                    (acc, l) => acc + l.quantityAuthorized * l.frozenWholesalePriceCents,
                    0
                  );

                  return (
                    <tr
                      key={rma.id}
                      onClick={() => setSelectedRma(rma)}
                      className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white font-mono">{rma.rmaNumber}</div>
                        <div className="text-[11px] text-zinc-500">Claim: {rma.claimNumber}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-200">{rma.storeId}</div>
                        <div className="text-[11px] text-zinc-500">{rma.companyId}</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-zinc-200">{rma.lines.length} lines</span>
                        <div className="text-[11px] text-zinc-500 font-mono">({totalUnits} units)</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusConf.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotColor}`} />
                          <span>{statusConf.label}</span>
                        </span>
                        {rma.exceptions && rma.exceptions.length > 0 && (
                          <div className="text-[9px] text-rose-400 mt-0.5 font-semibold">
                            ⚠️ {rma.exceptions.length} exception(s)
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {deadline ? (
                          <div>
                            <div
                              className={`text-[11px] font-bold ${
                                deadline.isOverdue ? "text-rose-400" : "text-zinc-200"
                              }`}
                            >
                              {deadline.deadlineDate}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {deadline.isOverdue ? (
                                <span className="text-rose-400 font-semibold">Overdue ({deadline.daysElapsed}d)</span>
                              ) : (
                                <span>{deadline.daysRemaining}d remaining</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">Pending Approval</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-zinc-300">{rma.boxes.length} box(es)</span>
                        {rma.boxes[0]?.trackingNumber && (
                          <div className="text-[10px] font-mono text-cyan-400 truncate max-w-[120px] mx-auto">
                            {rma.boxes[0].carrier}: {rma.boxes[0].trackingNumber}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {rma.inspectionRecord ? (
                          <div>
                            <div className="text-[11px] font-semibold text-emerald-400">
                              {rma.inspectionRecord.totalAcceptedResaleable} / {rma.inspectionRecord.totalReceived} accepted
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {rma.inspectionRecord.hasDiscrepancies ? "⚠️ Discrepancy logged" : "Exact match"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">Not inspected</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                        ${(totalValueCents / 100).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRma(rma);
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                        >
                          View ↗
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
