"use client";

import React, { useState } from "react";
import { updateHubBadges, type UpdateHubBadgesInput } from "@/lib/product/trading-actions";

interface HubBadgeItem {
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  label_en?: string | null;
  label_ko?: string | null;
}

interface HubBadgesCardProps {
  productId: string;
  isPromoActive?: boolean;
  hubBadges?: {
    sale?: HubBadgeItem;
    new?: HubBadgeItem;
    hot?: HubBadgeItem;
    priority?: string[];
  };
}

const BADGE_NAMES: Record<string, { nameKo: string; nameEn: string; icon: string }> = {
  promotion: { nameKo: "프로모션 (Promotion)", nameEn: "Promotion", icon: "🔥" },
  sale: { nameKo: "세일 (Sale)", nameEn: "Sale", icon: "🏷️" },
  hot: { nameKo: "인기 (Hot)", nameEn: "Hot", icon: "🔥" },
  new: { nameKo: "신상품 (New)", nameEn: "New", icon: "✨" },
};

export function HubBadgesCard({
  productId,
  isPromoActive = false,
  hubBadges = {},
}: HubBadgesCardProps) {
  const [saleActive, setSaleActive] = useState<boolean>(hubBadges?.sale?.is_active || false);
  const [saleStartDate, setSaleStartDate] = useState<string>(hubBadges?.sale?.start_date || "");
  const [saleEndDate, setSaleEndDate] = useState<string>(hubBadges?.sale?.end_date || "");
  const [saleLabelEn, setSaleLabelEn] = useState<string>(hubBadges?.sale?.label_en || "Sale");
  const [saleLabelKo, setSaleLabelKo] = useState<string>(hubBadges?.sale?.label_ko || "세일");

  const [hotActive, setHotActive] = useState<boolean>(hubBadges?.hot?.is_active || false);
  const [hotStartDate, setHotStartDate] = useState<string>(hubBadges?.hot?.start_date || "");
  const [hotEndDate, setHotEndDate] = useState<string>(hubBadges?.hot?.end_date || "");
  const [hotLabelEn, setHotLabelEn] = useState<string>(hubBadges?.hot?.label_en || "Hot");
  const [hotLabelKo, setHotLabelKo] = useState<string>(hubBadges?.hot?.label_ko || "인기");

  const [newActive, setNewActive] = useState<boolean>(hubBadges?.new?.is_active || false);
  const [newStartDate, setNewStartDate] = useState<string>(hubBadges?.new?.start_date || "");
  const [newEndDate, setNewEndDate] = useState<string>(hubBadges?.new?.end_date || "");
  const [newLabelEn, setNewLabelEn] = useState<string>(hubBadges?.new?.label_en || "New");
  const [newLabelKo, setNewLabelKo] = useState<string>(hubBadges?.new?.label_ko || "신상품");

  // Priority Order State
  const defaultPriority = ["promotion", "sale", "hot", "new"];
  const initialPriority = Array.isArray(hubBadges?.priority) && hubBadges.priority.length > 0
    ? hubBadges.priority
    : defaultPriority;
  
  const fullInitial = [...initialPriority];
  for (const b of defaultPriority) {
    if (!fullInitial.includes(b)) fullInitial.push(b);
  }
  const [priorityOrder, setPriorityOrder] = useState<string[]>(fullInitial);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const movePriority = (index: number, direction: "up" | "down") => {
    const newOrder = [...priorityOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setPriorityOrder(newOrder);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload: UpdateHubBadgesInput = {
        sale: {
          is_active: saleActive,
          start_date: saleStartDate || null,
          end_date: saleEndDate || null,
          label_en: saleLabelEn.trim() || "Sale",
          label_ko: saleLabelKo.trim() || "세일",
        },
        hot: {
          is_active: hotActive,
          start_date: hotStartDate || null,
          end_date: hotEndDate || null,
          label_en: hotLabelEn.trim() || "Hot",
          label_ko: hotLabelKo.trim() || "인기",
        },
        new: {
          is_active: newActive,
          start_date: newStartDate || null,
          end_date: newEndDate || null,
          label_en: newLabelEn.trim() || "New",
          label_ko: newLabelKo.trim() || "신상품",
        },
        priority: priorityOrder,
      };

      const res = await updateHubBadges(productId, payload);
      if (res.success) {
        setFeedback({ type: "success", message: "Hub 표시 배지 설정이 성공적으로 저장되었습니다." });
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "배지 설정 저장 중 오류가 발생했습니다." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="hub-badges-card" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>🏷️</span> Hub 표시 마케팅 배지 (Hub Display Badges)
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            리테일러 허브 상품 카드 이미지 상단에 노출되는 마케팅 배지(Promotion, Sale, Hot, New) 및 우선순위를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs disabled:opacity-50 shrink-0"
        >
          {isSaving ? "저장 중..." : "배지 설정 저장"}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-2.5 rounded-lg text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Auto Promotion Status */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              🔥 Promotion 배지
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isPromoActive
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {isPromoActive ? "자동 활성 (Active)" : "비활성 (Inactive)"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
            상단 프로모션 또는 단가 정책에서 유효한 프로모션 단가가 적용 중일 때 자동 노출됩니다.
          </p>
        </div>

        {/* 2. Sale Badge Settings */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              🏷️ Sale (세일) 배지
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={saleActive}
                onChange={(e) => setSaleActive(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-zinc-300 dark:border-zinc-700 focus:ring-rose-500 cursor-pointer"
              />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {saleActive ? "활성" : "비활성"}
              </span>
            </label>
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">시작일</label>
                <input
                  type="date"
                  value={saleStartDate}
                  onChange={(e) => setSaleStartDate(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">종료일</label>
                <input
                  type="date"
                  value={saleEndDate}
                  onChange={(e) => setSaleEndDate(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">영문 라벨</label>
                <input
                  type="text"
                  placeholder="Sale"
                  value={saleLabelEn}
                  onChange={(e) => setSaleLabelEn(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">국문 라벨</label>
                <input
                  type="text"
                  placeholder="세일"
                  value={saleLabelKo}
                  onChange={(e) => setSaleLabelKo(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Hot Badge Settings */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              🔥 Hot (인기) 배지
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={hotActive}
                onChange={(e) => setHotActive(e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-zinc-300 dark:border-zinc-700 focus:ring-orange-500 cursor-pointer"
              />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {hotActive ? "활성" : "비활성"}
              </span>
            </label>
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">시작일</label>
                <input
                  type="date"
                  value={hotStartDate}
                  onChange={(e) => setHotStartDate(e.target.value)}
                  disabled={!hotActive}
                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">종료일</label>
                <input
                  type="date"
                  value={hotEndDate}
                  onChange={(e) => setHotEndDate(e.target.value)}
                  disabled={!hotActive}
                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">영문 라벨</label>
                <input
                  type="text"
                  placeholder="Hot"
                  value={hotLabelEn}
                  onChange={(e) => setHotLabelEn(e.target.value)}
                  disabled={!hotActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">국문 라벨</label>
                <input
                  type="text"
                  placeholder="인기"
                  value={hotLabelKo}
                  onChange={(e) => setHotLabelKo(e.target.value)}
                  disabled={!hotActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. New Badge Settings */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              ✨ New (신상품) 배지
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={newActive}
                onChange={(e) => setNewActive(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {newActive ? "활성" : "비활성"}
              </span>
            </label>
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">시작일</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">종료일</label>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">영문 라벨</label>
                <input
                  type="text"
                  placeholder="New"
                  value={newLabelEn}
                  onChange={(e) => setNewLabelEn(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">국문 라벨</label>
                <input
                  type="text"
                  placeholder="신상품"
                  value={newLabelKo}
                  onChange={(e) => setNewLabelKo(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Order Bar */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <span>📊</span> 배지 노출 우선순위 설정 (Badge Display Priority)
          </label>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            앞쪽에 위치할수록 Hub 카드에서 우선적으로 노출됩니다 (최대 3개).
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {priorityOrder.map((key, idx) => {
            const info = BADGE_NAMES[key] || { nameKo: key, nameEn: key, icon: "🏷️" };
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-2xs"
              >
                <span className="text-zinc-400 text-[10px] font-bold">#{idx + 1}</span>
                <span>{info.icon}</span>
                <span>{info.nameKo}</span>
                <div className="flex items-center gap-0.5 ml-1 border-l border-zinc-200 dark:border-zinc-700 pl-1.5">
                  <button
                    type="button"
                    onClick={() => movePriority(idx, "up")}
                    disabled={idx === 0}
                    className="p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                    title="우선순위 높이기"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => movePriority(idx, "down")}
                    disabled={idx === priorityOrder.length - 1}
                    className="p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                    title="우선순위 낮추기"
                  >
                    ▶
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
