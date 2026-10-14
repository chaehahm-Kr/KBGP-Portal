"use client";

import React, { useState, useTransition } from "react";
import { updateFulfillmentSettings } from "@/lib/settings/fulfillment-settings";
import {
  DEFAULT_ESTIMATED_SHIPPING_DAYS,
  type FulfillmentSettingsPayload,
} from "@/lib/settings/fulfillment-constants";

interface FulfillmentSettingsCardProps {
  initialSettings: FulfillmentSettingsPayload;
  canEdit: boolean;
}

export function FulfillmentSettingsCard({
  initialSettings,
  canEdit,
}: FulfillmentSettingsCardProps) {
  const [days, setDays] = useState<number>(
    initialSettings.default_estimated_shipping_days || DEFAULT_ESTIMATED_SHIPPING_DAYS
  );
  const [lastSavedDays, setLastSavedDays] = useState<number>(
    initialSettings.default_estimated_shipping_days || DEFAULT_ESTIMATED_SHIPPING_DAYS
  );
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(
    initialSettings.updated_at
  );
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = () => {
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");

    const parsed = Math.round(Number(days));
    if (isNaN(parsed) || parsed < 1 || parsed > 30) {
      setErrorMsg("예상 배송 기간은 1일에서 30일 사이의 정수여야 합니다.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateFulfillmentSettings(parsed);
        setLastSavedDays(res.default_estimated_shipping_days);
        setUpdatedAt(res.updated_at);
        setSuccessMsg(`예상 배송 기간이 ${res.default_estimated_shipping_days}일로 성공적으로 저장되었습니다.`);
        setTimeout(() => setSuccessMsg(""), 4000);
      } catch (err: any) {
        setErrorMsg(err.message || "설정 저장에 실패했습니다.");
      }
    });
  };

  const isChanged = days !== lastSavedDays;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-zinc-900 dark:text-white">
              기본 예상 배송/입고 소요일수 설정 (Default Estimated Shipping Period)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              RTP-PERFORMANCE-P2
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            발송 확인(Confirmed Dispatch) 및 송장 발행일로부터 리테일러 매장 입고(Est. Received)까지 소요되는 기본 예상 일수입니다. 리테일러 포털의 Product Performance 및 입고 예정(Incoming) 수량 산정에 즉시 반영됩니다.
          </p>
        </div>

        {updatedAt && (
          <div className="text-[11px] text-zinc-400 flex-shrink-0">
            최종 갱신: {new Date(updatedAt).toLocaleDateString()} {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
        <div className="flex items-center gap-2.5">
          <label htmlFor="shipping-days-input" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            예상 배송 소요일:
          </label>
          <div className="relative inline-flex items-center">
            <input
              id="shipping-days-input"
              type="number"
              min={1}
              max={30}
              step={1}
              disabled={!canEdit || isPending}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-24 px-3 py-1.5 text-sm font-bold text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
            <span className="ml-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              일 (Calendar Days)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={isPending || (!isChanged && !errorMsg)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                isChanged
                  ? "bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              {isPending ? "저장 중..." : "설정 저장"}
            </button>
          )}

          {isChanged && !isPending && (
            <button
              onClick={() => {
                setDays(lastSavedDays);
                setErrorMsg("");
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              되돌리기
            </button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-50/70 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 space-y-1">
        <div className="font-semibold text-zinc-600 dark:text-zinc-300">
          💡 정책 및 작동 방식 안내
        </div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>기본 정책:</strong> Invoice / Confirmed Dispatch + 기본 배송기간(기본값 5일) 기준.</li>
          <li><strong>입고 예정(In Transit):</strong> 발송 후 경과일수가 설정된 배송 소요일수 미만인 건은 &lsquo;배송 중(In Transit)&rsquo;으로 자동 분류됩니다.</li>
          <li><strong>매장 입고(Est. Received):</strong> 발송 후 설정된 일수가 경과했거나 관리자가 명시적으로 배송완료(Delivered)로 지정한 건은 &lsquo;입고 완료(Est. Received)&rsquo;로 자동 분류됩니다.</li>
          <li><strong>무효 송장(Void):</strong> 주문 취소 등으로 송장이 무효화(Void)된 건은 허위 입고가 발생하지 않도록 자동 배제됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
