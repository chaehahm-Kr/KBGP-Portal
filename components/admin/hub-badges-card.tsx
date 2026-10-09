"use client";

import React, { useState } from "react";
import { updateHubBadges, type UpdateHubBadgesInput } from "@/lib/product/trading-actions";

interface HubBadgesCardProps {
  productId: string;
  isPromoActive?: boolean;
  hubBadges?: {
    sale?: {
      is_active: boolean;
      start_date?: string | null;
      end_date?: string | null;
      label_en?: string | null;
      label_ko?: string | null;
    };
    new?: {
      is_active: boolean;
      start_date?: string | null;
      end_date?: string | null;
      label_en?: string | null;
      label_ko?: string | null;
    };
  };
}

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

  const [newActive, setNewActive] = useState<boolean>(hubBadges?.new?.is_active || false);
  const [newStartDate, setNewStartDate] = useState<string>(hubBadges?.new?.start_date || "");
  const [newEndDate, setNewEndDate] = useState<string>(hubBadges?.new?.end_date || "");
  const [newLabelEn, setNewLabelEn] = useState<string>(hubBadges?.new?.label_en || "New");
  const [newLabelKo, setNewLabelKo] = useState<string>(hubBadges?.new?.label_ko || "신상품");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
        new: {
          is_active: newActive,
          start_date: newStartDate || null,
          end_date: newEndDate || null,
          label_en: newLabelEn.trim() || "New",
          label_ko: newLabelKo.trim() || "신상품",
        },
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
            리테일러 허브 상품 카드 이미지 상단에 노출되는 마케팅 배지(최대 3개: Promotion, Sale, New)를 관리합니다.
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            상단의 <strong className="text-zinc-700 dark:text-zinc-300">+ 프로모션</strong> 또는 판매 정책에서 유효한 프로모션 단가가 적용 중일 때 자동 노출됩니다.
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
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">시작일</label>
                <input
                  type="date"
                  value={saleStartDate}
                  onChange={(e) => setSaleStartDate(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">종료일</label>
                <input
                  type="date"
                  value={saleEndDate}
                  onChange={(e) => setSaleEndDate(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">영문 라벨</label>
                <input
                  type="text"
                  placeholder="Sale"
                  value={saleLabelEn}
                  onChange={(e) => setSaleLabelEn(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">국문 라벨</label>
                <input
                  type="text"
                  placeholder="세일"
                  value={saleLabelKo}
                  onChange={(e) => setSaleLabelKo(e.target.value)}
                  disabled={!saleActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. New Badge Settings */}
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
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">시작일</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">종료일</label>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">영문 라벨</label>
                <input
                  type="text"
                  placeholder="New"
                  value={newLabelEn}
                  onChange={(e) => setNewLabelEn(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-0.5">국문 라벨</label>
                <input
                  type="text"
                  placeholder="신상품"
                  value={newLabelKo}
                  onChange={(e) => setNewLabelKo(e.target.value)}
                  disabled={!newActive}
                  className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
