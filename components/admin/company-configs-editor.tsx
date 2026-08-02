"use client";

import React, { useState, useTransition } from "react";
import { updateSystemCompanyConfigs, type CompanyConfigsPayload, type PartnerStatusConfig } from "@/lib/settings/actions";

interface CompanyConfigsEditorProps {
  initialConfigs: CompanyConfigsPayload;
}

const colorOptions = [
  { value: "emerald", label: "Emerald (Green)", bg: "bg-emerald-500" },
  { value: "amber", label: "Amber (Orange/Yellow)", bg: "bg-amber-500" },
  { value: "rose", label: "Rose (Red)", bg: "bg-rose-500" },
  { value: "blue", label: "Blue", bg: "bg-blue-500" },
  { value: "zinc", label: "Zinc (Gray)", bg: "bg-zinc-500" },
];

export function CompanyConfigsEditor({ initialConfigs }: CompanyConfigsEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [types, setTypes] = useState<string[]>(initialConfigs.company_types);
  const [statuses, setStatuses] = useState<PartnerStatusConfig[]>(initialConfigs.partner_statuses);

  // Form states for adding new type
  const [newType, setNewType] = useState("");
  
  // Form states for adding new status
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("zinc");

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newType.trim();
    if (!val) return;
    if (types.includes(val)) {
      alert("이미 존재하는 회사 유형입니다.");
      return;
    }
    setTypes([...types, val]);
    setNewType("");
  };

  const handleRemoveType = (typeToRemove: string) => {
    if (confirm(`'${typeToRemove}' 유형을 삭제하시겠습니까?`)) {
      setTypes(types.filter((t) => t !== typeToRemove));
    }
  };

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newStatusLabel.trim();
    if (!label) return;
    
    // Status ID matches the label (but trimmed/normalized if needed, e.g. "Pending")
    if (statuses.some((s) => s.label.toLowerCase() === label.toLowerCase())) {
      alert("이미 존재하는 파트너 상태입니다.");
      return;
    }

    setStatuses([
      ...statuses,
      {
        id: label,
        label: label,
        color: newStatusColor,
      },
    ]);
    setNewStatusLabel("");
    setNewStatusColor("zinc");
  };

  const handleRemoveStatus = (statusId: string) => {
    if (confirm(`'${statusId}' 파트너 상태를 삭제하시겠습니까?`)) {
      setStatuses(statuses.filter((s) => s.id !== statusId));
    }
  };

  const handleSaveConfigs = () => {
    startTransition(async () => {
      try {
        await updateSystemCompanyConfigs({
          company_types: types,
          partner_statuses: statuses,
        });
        alert("시스템 설정이 저장되었습니다.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "설정 저장 실패");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">회사 설정 관리</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">
          파트너사 목록 및 상세 정보에서 사용할 회사 유형과 파트너 상태 옵션을 관리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Company Types Config Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
            회사 유형 설정 (Company Types)
          </h2>

          {/* Add Form */}
          <form onSubmit={handleAddType} className="flex gap-2">
            <input
              type="text"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="예: Broker, Retailer"
              className="flex-1 rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-400"
            />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            >
              추가
            </button>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {types.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between p-2.5 rounded-md border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800/80 dark:bg-zinc-950/20 text-xs text-zinc-800 dark:text-zinc-300"
              >
                <span className="font-semibold">{type}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveType(type)}
                  className="text-[10px] font-bold text-rose-600 hover:underline"
                >
                  제거
                </button>
              </div>
            ))}
            {types.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6">회사 유형이 비어 있습니다.</p>
            )}
          </div>
        </div>

        {/* Partner Statuses Config Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
            파트너 상태 설정 (Partner Statuses)
          </h2>

          {/* Add Form */}
          <form onSubmit={handleAddStatus} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                placeholder="상태명 (예: Suspension)"
                className="flex-1 rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-400"
              />
              <button
                type="submit"
                className="rounded bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shrink-0"
              >
                상태 추가
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">배지 색상 선택</label>
              <div className="flex flex-wrap gap-2.5">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => setNewStatusColor(opt.value)}
                    className={`h-5 w-5 rounded-full ${opt.bg} border-2 transition-all ${
                      newStatusColor === opt.value
                        ? "border-zinc-950 ring-2 ring-zinc-200 dark:border-white"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {statuses.map((status) => {
              const bgClass =
                status.color === "emerald"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                  : status.color === "amber"
                  ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                  : status.color === "rose"
                  ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                  : status.color === "blue"
                  ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                  : "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-350 dark:border-zinc-700";

              return (
                <div
                  key={status.id}
                  className="flex items-center justify-between p-2.5 rounded-md border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800/80 dark:bg-zinc-950/20 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${bgClass}`}>
                      {status.label}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-400 capitalize">{status.color}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStatus(status.id)}
                    className="text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    제거
                  </button>
                </div>
              );
            })}
            {statuses.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6">파트너 상태가 비어 있습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleSaveConfigs}
          disabled={isPending}
          className="rounded-md bg-zinc-950 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          {isPending ? "설정 저장 중..." : "시스템 설정 저장"}
        </button>
      </div>
    </div>
  );
}
