"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PoRequestDetail,
  PoRequestStatus,
  PO_REQUEST_STATUS_LABELS_EN,
  PO_REQUEST_STATUS_COLORS,
} from "@/lib/purchase-order/request-types";
import { formatEasternDate } from "@/lib/utils/timezone";

interface AdminPoRequestListProps {
  initialRequests: PoRequestDetail[];
  initialCounts: Record<string, number>;
  companies: { id: string; name: string }[];
}

export function AdminPoRequestList({
  initialRequests,
  initialCounts,
  companies,
}: AdminPoRequestListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("ALL");

  const filtered = initialRequests.filter((r) => {
    const matchesStatus = selectedStatus === "ALL" || r.status === selectedStatus;
    const matchesCompany = selectedCompanyId === "ALL" || r.company_id === selectedCompanyId;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      r.request_number.toLowerCase().includes(term) ||
      r.company_name.toLowerCase().includes(term) ||
      (r.contact_name || "").toLowerCase().includes(term) ||
      (r.contact_email || "").toLowerCase().includes(term) ||
      (r.converted_po_number || "").toLowerCase().includes(term) ||
      r.lines.some(
        (l) =>
          l.product_name_snapshot.toLowerCase().includes(term) ||
          (l.letusto_sku_snapshot || "").toLowerCase().includes(term)
      );

    return matchesStatus && matchesCompany && matchesSearch;
  });

  const statusTabItems = [
    { key: "ALL", label: "All Requests", count: initialCounts.ALL || 0 },
    { key: "SUBMITTED", label: "Submitted", count: initialCounts.SUBMITTED || 0 },
    { key: "UNDER_REVIEW", label: "Under Review", count: initialCounts.UNDER_REVIEW || 0 },
    { key: "CHANGE_REQUESTED", label: "Change Requested", count: initialCounts.CHANGE_REQUESTED || 0 },
    { key: "CONVERTED_TO_PO", label: "Converted to PO", count: initialCounts.CONVERTED_TO_PO || 0 },
    { key: "REJECTED", label: "Rejected", count: initialCounts.REJECTED || 0 },
    { key: "DRAFT", label: "Draft", count: initialCounts.DRAFT || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">PO Requests Review</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            파트너사에서 제출한 발주 요청서를 검토하고, 수량/단가 조정 및 정식 Purchase Order로 전환합니다.
          </p>
        </div>
      </div>

      {/* Status Metric Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800 text-xs">
        {statusTabItems.map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-3 py-2 rounded-t-lg font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-2 ${
                isActive
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white bg-zinc-50 dark:bg-zinc-850"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by Request #, Company, Contact, SKU, Product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 text-xs"
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-xs font-medium"
          >
            <option value="ALL">All Companies ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50/70 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                <th className="px-4 py-3.5">Request No.</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Request Date</th>
                <th className="px-4 py-3.5 text-center">Lines</th>
                <th className="px-4 py-3.5 text-right">Req. Qty</th>
                <th className="px-4 py-3.5 text-right">Est. Amount</th>
                <th className="px-4 py-3.5">Ready Date</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors">
                  {/* Request Number */}
                  <td className="px-4 py-3.5 font-mono font-bold text-zinc-900 dark:text-white">
                    <Link
                      href={`/admin/purchasing/requests/${req.id}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      {req.request_number}
                    </Link>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-white">
                    {req.company_name}
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                    <div>{req.contact_name || "-"}</div>
                    {req.contact_email && (
                      <span className="text-[10px] text-zinc-400 font-mono block">{req.contact_email}</span>
                    )}
                  </td>

                  {/* Request Date */}
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {req.submitted_at ? formatEasternDate(req.submitted_at) : formatEasternDate(req.created_at)}
                  </td>

                  {/* Lines Count */}
                  <td className="px-4 py-3.5 text-center font-mono font-medium text-zinc-700 dark:text-zinc-300">
                    {req.lines.length}
                  </td>

                  {/* Requested Qty */}
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                    {req.total_requested_qty.toLocaleString()}
                  </td>

                  {/* Estimated Amount */}
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    ${req.total_estimated_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Target Ready Date */}
                  <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {req.requested_ready_date || "-"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                          PO_REQUEST_STATUS_COLORS[req.status] || "bg-zinc-100 text-zinc-700 border-zinc-200"
                        }`}
                      >
                        {PO_REQUEST_STATUS_LABELS_EN[req.status] || req.status}
                      </span>
                      {req.status === "CONVERTED_TO_PO" && req.converted_po_number && (
                        <Link
                          href={`/admin/purchasing/${req.converted_po_id}`}
                          className="font-mono font-bold text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>📄 #{req.converted_po_number}</span>
                        </Link>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        href={`/admin/purchasing/requests/${req.id}`}
                        className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-850 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs transition-colors shadow-sm"
                      >
                        Review
                      </Link>
                      {req.status === "CONVERTED_TO_PO" && req.converted_po_id && (
                        <Link
                          href={`/admin/purchasing/${req.converted_po_id}`}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs transition-colors border border-emerald-200 dark:border-emerald-800"
                        >
                          View PO
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center p-8 text-zinc-400 font-semibold">
                    No PO Requests match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
