"use client";

import React, { useState } from "react";
import Link from "next/link";

interface ProgramInfo {
  key: string;
  activeSku: number;
  brandCount: number;
  apCount: number;
  status: string;
}

interface APInfo {
  id: number;
  display_program: string;
  code: string;
  name: string;
  description: string;
  target_sku: number;
  selectedSku: number;
  brandCount: number;
  totalSupply: number;
  totalMsrp: number;
  totalMargin: number;
  status: string;
}

interface CurationControlClientProps {
  initialPrograms: ProgramInfo[];
  initialAPs: APInfo[];
}

export function CurationControlClient({
  initialPrograms,
  initialAPs,
}: CurationControlClientProps) {
  const [selectedProgram, setSelectedProgram] = useState<string>("START_4FT");
  const [aps] = useState<APInfo[]>(initialAPs);

  const filteredAPs = aps.filter((ap) => ap.display_program === selectedProgram);

  const getProgramLabel = (key: string) => {
    switch (key) {
      case "START_4FT":
        return "START · 4FT";
      case "GROW_8FT":
        return "GROW · 8FT";
      case "EXPAND_12FT":
        return "EXPAND · 12FT";
      default:
        return key;
    }
  };

  return (
    <div className="space-y-8">
      {/* 3 Display Program Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {initialPrograms.map((prog) => {
          const isSelected = selectedProgram === prog.key;
          return (
            <div
              key={prog.key}
              onClick={() => setSelectedProgram(prog.key)}
              className={`rounded-xl border p-6 shadow-sm cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "border-zinc-900 bg-zinc-50/10 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100 dark:bg-zinc-950/40"
                  : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                    Display Program
                  </span>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                    {getProgramLabel(prog.key)}
                  </h3>
                </div>
                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                  {prog.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <div>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Active SKU</p>
                  <p className="text-base font-bold text-zinc-800 dark:text-zinc-250 mt-1">
                    {prog.activeSku}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">AP Count</p>
                  <p className="text-base font-bold text-zinc-800 dark:text-zinc-250 mt-1">
                    {prog.apCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Brands</p>
                  <p className="text-base font-bold text-zinc-800 dark:text-zinc-250 mt-1">
                    {prog.brandCount}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AP List for Selected Program */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-6 pb-4 flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            {getProgramLabel(selectedProgram)} - Assortment Profiles (AP-01 ~ AP-06)
          </h3>
          <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
            Total {filteredAPs.length} Profiles
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-bold dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-6 py-3.5 whitespace-nowrap w-[10%]">Code</th>
                <th className="px-6 py-3.5 whitespace-nowrap w-[20%]">AP Name & Description</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center w-[10%]">Target SKU</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center w-[10%]">Selected SKU</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center w-[8%]">Brands</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center w-[12%]">Total Supply</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center w-[12%]">Total MSRP</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center w-[10%]">Total Margin</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right w-[8%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {filteredAPs.map((ap) => {
                const targetMatch = ap.selectedSku === ap.target_sku;
                return (
                  <tr
                    key={ap.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                  >
                    <td className="px-6 py-4 align-middle font-mono font-bold text-zinc-955 dark:text-white whitespace-nowrap">
                      {ap.code}
                    </td>
                    <td className="px-6 py-4 align-middle min-w-[200px]">
                      <div className="flex flex-col gap-0.5">
                        <p className="font-bold text-zinc-900 dark:text-white">{ap.name}</p>
                        {ap.description && (
                          <p className="text-[10px] text-zinc-400 line-clamp-1">{ap.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle font-bold text-center text-zinc-900 dark:text-white">
                      {ap.target_sku}
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      <span
                        className={`font-bold ${
                          targetMatch
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {ap.selectedSku}
                      </span>
                      {!targetMatch && (
                        <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 border border-amber-200/50">
                          {ap.selectedSku > ap.target_sku ? `+${ap.selectedSku - ap.target_sku}` : `-${ap.target_sku - ap.selectedSku}`}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle font-bold text-center text-zinc-900 dark:text-white">
                      {ap.brandCount}
                    </td>
                    <td className="px-6 py-4 align-middle font-bold text-center text-zinc-900 dark:text-white whitespace-nowrap">
                      {ap.totalSupply > 0 ? `$${ap.totalSupply.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 align-middle font-bold text-center text-zinc-900 dark:text-white whitespace-nowrap">
                      {ap.totalMsrp > 0 ? `$${ap.totalMsrp.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 align-middle font-bold text-center text-zinc-900 dark:text-white whitespace-nowrap">
                      {ap.totalMargin > 0 ? `${ap.totalMargin.toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                      <Link
                        href={`/admin/products/curation/${ap.display_program}/${ap.code}`}
                        className="rounded bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-955 border border-zinc-900 dark:border-zinc-100 px-3 py-2 font-bold text-xs transition-all"
                      >
                        진열 관리
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
