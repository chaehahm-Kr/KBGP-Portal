"use client";

import React, { useState } from "react";
import Link from "next/link";

interface CasesListProps {
  initialCases: any[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  FINALIZED: "bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "기입 중 (Open)",
  FINALIZED: "확정됨 (Finalized)",
};

export function CasesList({ initialCases }: CasesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredCases = initialCases.filter((c) => {
    const cNumber = c.landed_cost_number || "";
    const desc = c.description || "";
    const shipmentNumbers = (c.shipments ?? []).map((s: any) => s.shipment?.shipment_number || "").join(" ");

    const matchSearch =
      cNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipmentNumbers.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === "" || c.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            type="text"
            placeholder="케이스 번호, 선적 번호, 설명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
          >
            <option value="">모든 케이스 상태</option>
            <option value="OPEN">기입 중 (Open)</option>
            <option value="FINALIZED">확정됨 (Finalized)</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                <th className="px-5 py-3 w-36">케이스 번호</th>
                <th className="px-5 py-3 w-28">상태</th>
                <th className="px-5 py-3">매핑 선적 (Shipments)</th>
                <th className="px-5 py-3 w-32">생성 일자</th>
                <th className="px-5 py-3">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-400 font-medium">
                    등록된 Landed Cost 정산 케이스가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5 transition-colors">
                    {/* Case Number */}
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-650 hover:underline">
                      <Link href={`/admin/finance/landed-cost/${c.id}`}>
                        {c.landed_cost_number}
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-bold ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>

                    {/* Shipments list */}
                    <td className="px-5 py-3.5 font-medium text-zinc-700 dark:text-zinc-300">
                      <div className="flex flex-wrap gap-1.5">
                        {c.shipments && c.shipments.length > 0 ? (
                          c.shipments.map((s: any, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 dark:bg-zinc-805 dark:border-zinc-800 rounded font-mono text-[9px]">
                              {s.shipment?.shipment_number}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-350 italic">지정 없음</span>
                        )}
                      </div>
                    </td>

                    {/* Created date */}
                    <td className="px-5 py-3.5 font-mono text-zinc-650">
                      {new Date(c.created_at).toISOString().split("T")[0]}
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3.5 font-medium text-zinc-850 dark:text-zinc-250 truncate max-w-xs">
                      {c.description || <span className="text-zinc-350 italic">설명 없음</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
