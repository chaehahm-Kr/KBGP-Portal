"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { adminUpdateAPInfo } from "@/lib/product/admin-actions";

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
  avgMsp: number;
  avgMargin: number;
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
  const [aps, setAps] = useState<APInfo[]>(initialAPs);
  const [editingAP, setEditingAP] = useState<APInfo | null>(null);
  const [isPending, startTransition] = useTransition();

  // Edit fields state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTargetSku, setEditTargetSku] = useState("");

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

  const handleEditClick = (ap: APInfo) => {
    setEditingAP(ap);
    setEditName(ap.name);
    setEditDesc(ap.description);
    setEditTargetSku(ap.target_sku.toString());
  };

  const handleSaveEdit = () => {
    if (!editingAP) return;
    const targetSkuNum = parseInt(editTargetSku) || 0;

    startTransition(async () => {
      try {
        await adminUpdateAPInfo(editingAP.id, {
          name: editName,
          description: editDesc,
          target_sku: targetSkuNum,
        });

        // Update local state
        setAps((prev) =>
          prev.map((ap) =>
            ap.id === editingAP.id
              ? { ...ap, name: editName, description: editDesc, target_sku: targetSkuNum }
              : ap
          )
        );

        setEditingAP(null);
      } catch (err: any) {
        alert(err.message || "AP 정보 수정 실패");
      }
    });
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
                  ? "border-zinc-950 bg-white ring-2 ring-zinc-950 dark:border-white dark:ring-white dark:bg-zinc-900"
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
                  <p className="text-[10px] text-zinc-400 font-medium">Active SKU</p>
                  <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                    {prog.activeSku}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-medium">AP Count</p>
                  <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                    {prog.apCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-medium">Brands</p>
                  <p className="text-base font-bold text-zinc-950 dark:text-white mt-0.5">
                    {prog.brandCount}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AP List for Selected Program */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="border-b border-zinc-150 pb-2 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-850 dark:text-white">
            {getProgramLabel(selectedProgram)} - Assortment Profiles (AP-01 ~ AP-06)
          </h3>
          <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
            Total {filteredAPs.length} Profiles
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-250 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500">
                <th className="p-3 font-bold w-[15%]">Code</th>
                <th className="p-3 font-bold w-[25%]">AP Name & Description</th>
                <th className="p-3 font-bold text-center w-[12%]">Target SKU</th>
                <th className="p-3 font-bold text-center w-[12%]">Selected SKU</th>
                <th className="p-3 font-bold text-center w-[10%]">Brands</th>
                <th className="p-3 font-bold text-center w-[12%]">Avg MSRP</th>
                <th className="p-3 font-bold text-center w-[12%]">Avg Margin</th>
                <th className="p-3 font-bold text-center w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAPs.map((ap) => {
                const targetMatch = ap.selectedSku === ap.target_sku;
                return (
                  <tr
                    key={ap.id}
                    className="border-b border-zinc-150 dark:border-zinc-850 hover:bg-zinc-50/20 dark:hover:bg-zinc-950/20"
                  >
                    <td className="p-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {ap.code}
                    </td>
                    <td className="p-3 space-y-0.5">
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">{ap.name}</p>
                      {ap.description && (
                        <p className="text-[10px] text-zinc-400 line-clamp-1">{ap.description}</p>
                      )}
                    </td>
                    <td className="p-3 font-bold text-center text-zinc-900 dark:text-white">
                      {ap.target_sku}
                    </td>
                    <td className="p-3 text-center">
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
                        <span className="ml-1 text-[9px] font-bold px-1 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                          {ap.selectedSku > ap.target_sku ? `+${ap.selectedSku - ap.target_sku}` : `-${ap.target_sku - ap.selectedSku}`}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-center text-zinc-900 dark:text-white">
                      {ap.brandCount}
                    </td>
                    <td className="p-3 font-bold text-center text-zinc-900 dark:text-white">
                      {ap.avgMsp > 0 ? `$${ap.avgMsp.toFixed(2)}` : "-"}
                    </td>
                    <td className="p-3 font-bold text-center text-zinc-900 dark:text-white">
                      {ap.avgMargin > 0 ? `${ap.avgMargin.toFixed(1)}%` : "-"}
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => handleEditClick(ap)}
                        className="text-[11px] font-bold text-zinc-550 hover:underline dark:text-zinc-400 cursor-pointer"
                      >
                        설정
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <Link
                        href={`/admin/products/curation/${ap.display_program}/${ap.code}`}
                        className="text-[11px] font-bold text-indigo-650 hover:underline dark:text-indigo-400"
                      >
                        진열 관리 ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit AP Modal */}
      {editingAP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-[90%] max-w-md shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                Assortment Profile 설정 수정 ({editingAP.code})
              </h4>
              <p className="text-[10px] text-zinc-400">AP의 타겟 정보 및 메타데이터를 편집합니다.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500">AP 이름</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500">설명</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500">Target SKU (목표 상품 개수)</label>
                <input
                  type="number"
                  value={editTargetSku}
                  onChange={(e) => setEditTargetSku(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingAP(null)}
                className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-650 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isPending}
                className="rounded bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                {isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
