"use client";

import React, { useState } from "react";
import { updateTradingShortDescription } from "@/lib/product/trading-actions";

interface RetailerShortDescriptionCardProps {
  productId: string;
  initialShortDescription?: string | null;
}

export function RetailerShortDescriptionCard({
  productId,
  initialShortDescription = "",
}: RetailerShortDescriptionCardProps) {
  const [shortDesc, setShortDesc] = useState<string>(initialShortDescription || "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await updateTradingShortDescription(productId, {
        short_description: shortDesc,
      });
      if (res.success) {
        setFeedback({ type: "success", message: "리테일러용 간략 설명이 성공적으로 저장되었습니다." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "저장 중 오류가 발생했습니다." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>📝</span> 리테일러용 간략 설명 (Retailer Short Description)
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Retailer Portal 상품 카드 및 상세 페이지에 표시되는 2줄 이내의 마케팅 포인트/셀링 텍스트입니다.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-xs shrink-0"
        >
          {isSaving ? "저장 중..." : "설명 저장"}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
          간략 설명 문구 (Short Description)
        </label>
        <textarea
          rows={3}
          value={shortDesc}
          onChange={(e) => setShortDesc(e.target.value)}
          placeholder="예: Premium hydrating facial serum formulated with 5-type Hyaluronic Acid for all-day skin glow."
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-400">
          <span>권장: 100자 ~ 200자 이내 (영문 마케팅 문구)</span>
          <span>{shortDesc.length}자</span>
        </div>
      </div>
    </div>
  );
}
