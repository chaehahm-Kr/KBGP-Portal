"use client";

import React, { useEffect, useRef } from "react";

export type LogisticsHelpSectionKey = "item" | "package" | "carton" | "pallet" | "all";

interface LogisticsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: LogisticsHelpSectionKey;
}

export function LogisticsHelpModal({
  isOpen,
  onClose,
  initialSection = "all",
}: LogisticsHelpModalProps) {
  const [activeSection, setActiveSection] = React.useState<LogisticsHelpSectionKey>(initialSection);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection || "all");
      // Focus close button for keyboard accessibility
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [isOpen, initialSection]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logistics-help-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 id="logistics-help-title" className="text-base font-bold text-zinc-900 dark:text-white">
                물류 규격 입력 가이드 <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-1.5">(Logistics Specification Guide)</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                제품 본체부터 단품 포장, 마스터 카톤, 팔레트까지 각 물류 단계별 측정 기준을 안내합니다.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="가이드 닫기"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Master Overview Hierarchy Flow */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <span>📋 4단계 물류 계층 전체 요약 (Logistics Hierarchy Overview)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
              {/* Step 1 */}
              <button
                type="button"
                onClick={() => setActiveSection("item")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  activeSection === "item"
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                  <span>1. ITEM</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">본체</span>
                </div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">제품 본체</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">튜브, 병, 용기 등 실제 내용물 용기</div>
              </button>

              {/* Step 2 */}
              <button
                type="button"
                onClick={() => setActiveSection("package")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  activeSection === "package"
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                  <span>2. PACKAGE</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">판매포장</span>
                </div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">개별 판매 포장</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">단상자 등 1개 판매 포장 (배송박스 제외)</div>
              </button>

              {/* Step 3 */}
              <button
                type="button"
                onClick={() => setActiveSection("carton")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  activeSection === "carton"
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                  <span>3. CARTON</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">운송카톤</span>
                </div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">마스터 카톤</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">여러 Package를 담아 운송하는 박스</div>
              </button>

              {/* Step 4 */}
              <button
                type="button"
                onClick={() => setActiveSection("pallet")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  activeSection === "pallet"
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                  <span>4. PALLET</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">최종출고</span>
                </div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">팔레트 적재</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">팔레트 본체 포함 최종 적재 출고 단위</div>
              </button>
            </div>
          </div>

          {/* Section Detail Cards */}
          <div className="space-y-6">
            {/* 1. Item Spec */}
            <div
              className={`rounded-xl border p-5 transition-all ${
                activeSection === "item" || activeSection === "all"
                  ? "border-indigo-300 bg-white dark:border-indigo-800 dark:bg-zinc-900 shadow-sm"
                  : "border-zinc-200 bg-zinc-50/40 opacity-75 dark:border-zinc-800 dark:bg-zinc-950/20"
              }`}
            >
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Visual SVG Graphic */}
                <div className="w-full md:w-48 shrink-0 flex flex-col items-center justify-center p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  <svg className="w-24 h-24 text-indigo-500 dark:text-indigo-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                    {/* Bottle / Tube Illustration */}
                    <path d="M42 20h16v10H42z" fill="currentColor" fillOpacity="0.1" />
                    <rect x="42" y="15" width="16" height="12" rx="2" strokeWidth="2.5" />
                    <path d="M30 35c0-4 4-8 10-8h20c6 0 10 4 10 8v45c0 4-4 7-10 7H40c-6 0-10-3-10-7V35z" strokeWidth="2.5" />
                    <line x1="38" y1="48" x2="62" y2="48" strokeDasharray="3 3" opacity="0.6" />
                    <line x1="38" y1="58" x2="54" y2="58" strokeDasharray="3 3" opacity="0.6" />
                    <text x="50" y="75" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor" stroke="none">ITEM</text>
                  </svg>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-2">제품 본체 (Item Only)</span>
                </div>

                {/* Content Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-extrabold px-2 py-0.5">1단계</span>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">1. 단품 규격 (Item Spec)</h4>
                  </div>
                  <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed">
                    제품 자체의 실제 크기와 무게를 입력합니다. 튜브, 병, 용기 등 제품 본체 기준입니다.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
                      <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">✓ 포함 항목 (Included)</span>
                      <ul className="text-emerald-900 dark:text-emerald-300 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>제품 본체 (용기, 튜브, 병, 파우치)</li>
                        <li>내용물 포함 실제 제품 중량</li>
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900">
                      <span className="font-bold text-rose-800 dark:text-rose-400 block mb-1">✕ 제외 항목 (Not Included)</span>
                      <ul className="text-rose-900 dark:text-rose-300 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>판매용 단상자 포장</li>
                        <li>외부 택배/배송 박스, 마스터 카톤, 팔레트</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium italic">
                    💡 캡션: 제품 본체 자체의 크기(가로/세로/높이)와 무게(g)를 측정합니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Package Spec */}
            <div
              className={`rounded-xl border p-5 transition-all ${
                activeSection === "package" || activeSection === "all"
                  ? "border-indigo-300 bg-white dark:border-indigo-800 dark:bg-zinc-900 shadow-sm"
                  : "border-zinc-200 bg-zinc-50/40 opacity-75 dark:border-zinc-800 dark:bg-zinc-950/20"
              }`}
            >
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Visual SVG Graphic */}
                <div className="w-full md:w-48 shrink-0 flex flex-col items-center justify-center p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  <svg className="w-24 h-24 text-indigo-500 dark:text-indigo-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                    {/* Outer Retail Box */}
                    <rect x="25" y="20" width="50" height="65" rx="3" strokeWidth="2.5" fill="currentColor" fillOpacity="0.05" />
                    {/* Inner Product Outline */}
                    <rect x="38" y="32" width="24" height="42" rx="2" strokeDasharray="3 3" strokeWidth="1.5" />
                    <path d="M42 27h16v5H42z" strokeWidth="1.5" />
                    <text x="50" y="80" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">RETAIL BOX</text>
                  </svg>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-2">개별 판매 포장 (Package)</span>
                </div>

                {/* Content Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-extrabold px-2 py-0.5">2단계</span>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">2. 단품 포장 패키지 규격 (Package Spec)</h4>
                  </div>
                  <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed">
                    제품 1개의 최종 판매 포장 상태의 크기와 무게를 입력합니다. 단상자 등 판매용 포장은 포함하며, 택배·배송용 외부 박스는 포함하지 않습니다.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
                      <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">✓ 포함 항목 (Included)</span>
                      <ul className="text-emerald-900 dark:text-emerald-300 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>제품 본체 + 개별 판매 단상자 (종이 상자)</li>
                        <li>블리스터, 단품 실링 포장 등 1개 판매 단위 포장</li>
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-800">
                      <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">🚨 절대 제외 항목 (MUST EXCLUDE)</span>
                      <ul className="text-amber-950 dark:text-amber-200 text-[11px] space-y-0.5 list-disc list-inside font-medium">
                        <li>택배·배송용 외부 배송 박스 (Shipping Box)</li>
                        <li>마스터 카톤 (Master Carton), 팔레트</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium italic">
                    💡 캡션: 소비자가 실제로 구매하는 1개 제품의 최종 판매 포장 상태를 기준으로 합니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Master Carton Spec */}
            <div
              className={`rounded-xl border p-5 transition-all ${
                activeSection === "carton" || activeSection === "all"
                  ? "border-indigo-300 bg-white dark:border-indigo-800 dark:bg-zinc-900 shadow-sm"
                  : "border-zinc-200 bg-zinc-50/40 opacity-75 dark:border-zinc-800 dark:bg-zinc-950/20"
              }`}
            >
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Visual SVG Graphic */}
                <div className="w-full md:w-48 shrink-0 flex flex-col items-center justify-center p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  <svg className="w-24 h-24 text-indigo-500 dark:text-indigo-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                    {/* Master Carton Isometric / Front Box */}
                    <path d="M15 30l35-12 35 12v45l-35 12-35-12V30z" strokeWidth="2.5" fill="currentColor" fillOpacity="0.05" />
                    <path d="M15 30l35 12 35-12" strokeWidth="2" />
                    <path d="M50 42v45" strokeWidth="2" />
                    {/* Inner Packages Grid */}
                    <rect x="25" y="48" width="12" height="18" strokeDasharray="2 2" />
                    <rect x="40" y="53" width="12" height="18" strokeDasharray="2 2" />
                    <rect x="63" y="48" width="12" height="18" strokeDasharray="2 2" />
                    <text x="50" y="78" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">MASTER CARTON</text>
                  </svg>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-2">마스터 카톤 (Master Carton)</span>
                </div>

                {/* Content Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-extrabold px-2 py-0.5">3단계</span>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">3. 마스터 카톤 규격 (Master Carton Specs)</h4>
                  </div>
                  <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed">
                    여러 개의 단품 판매 패키지를 담아 보관·운송하는 카톤의 입수 수량, 크기와 총중량을 입력합니다.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
                      <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">✓ 포함 항목 (Included)</span>
                      <ul className="text-emerald-900 dark:text-emerald-300 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>입수된 여러 개의 단품 판매 패키지 (Retail Packages)</li>
                        <li>물류 보관 및 무역 수송용 외부 골판지 마스터 카톤</li>
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900">
                      <span className="font-bold text-indigo-800 dark:text-indigo-300 block mb-1">📌 주요 입력 항목 (Required Metrics)</span>
                      <ul className="text-indigo-900 dark:text-indigo-200 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>입수 수량 (Qty per Carton, 예: 24개/카톤)</li>
                        <li>외부 크기: 가로 × 세로 × 높이 (cm)</li>
                        <li>카톤 총중량 (Gross Weight, kg)</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium italic">
                    💡 캡션: 여러 개의 판매용 제품을 담아 보관·운송하는 마스터 카톤 기준입니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Pallet Spec */}
            <div
              className={`rounded-xl border p-5 transition-all ${
                activeSection === "pallet" || activeSection === "all"
                  ? "border-indigo-300 bg-white dark:border-indigo-800 dark:bg-zinc-900 shadow-sm"
                  : "border-zinc-200 bg-zinc-50/40 opacity-75 dark:border-zinc-800 dark:bg-zinc-950/20"
              }`}
            >
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Visual SVG Graphic */}
                <div className="w-full md:w-48 shrink-0 flex flex-col items-center justify-center p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  <svg className="w-24 h-24 text-indigo-500 dark:text-indigo-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                    {/* Stacked Cartons on Pallet */}
                    <path d="M20 30l30-8 30 8v20l-30 8-30-8V30z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05" />
                    <path d="M20 50l30-8 30 8v20l-30 8-30-8V50z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
                    {/* Pallet Wooden Base */}
                    <path d="M15 75h70v8H15z" strokeWidth="2.5" fill="currentColor" fillOpacity="0.2" />
                    <path d="M25 83v5M50 83v5M75 83v5" strokeWidth="2.5" />
                    <text x="50" y="70" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">PALLET LOAD</text>
                  </svg>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-2">팔레트 규격 (Pallet Specs)</span>
                </div>

                {/* Content Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-extrabold px-2 py-0.5">4단계</span>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">4. 팔레트 규격 (Pallet Specs)</h4>
                  </div>
                  <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed">
                    여러 마스터 카톤을 팔레트에 적재한 최종 출고 상태의 정보를 입력합니다. 팔레트 자체를 포함한 전체 크기, 총중량, 적재 카톤 수를 기준으로 합니다.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
                      <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">✓ 포함 항목 (Included)</span>
                      <ul className="text-emerald-900 dark:text-emerald-300 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>적재된 마스터 카톤 전체 (Master Cartons)</li>
                        <li><strong className="underline decoration-indigo-500">팔레트 자체 포함 (Pallet Base Included!)</strong></li>
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900">
                      <span className="font-bold text-indigo-800 dark:text-indigo-300 block mb-1">📌 주요 측정 항목 (Metrics)</span>
                      <ul className="text-indigo-900 dark:text-indigo-200 text-[11px] space-y-0.5 list-disc list-inside">
                        <li>적재 카톤 수 (Cartons per Pallet)</li>
                        <li>팔레트 포함 전체 크기: 가로 × 세로 × 적재높이(cm)</li>
                        <li>팔레트 포함 총중량 (Gross Weight, kg)</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium italic">
                    💡 캡션: 팔레트 자체와 적재된 마스터 카톤을 모두 포함한 최종 출고 상태를 기준으로 합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-zinc-200 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
          <p className="text-[11px] text-zinc-450 dark:text-zinc-500">
            * 수치 측정 시 정합성이 맞도록 인치(inch), 파운드(lb) 자동 환산 값을 확인해 주세요.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            확인 (Understood)
          </button>
        </div>
      </div>
    </div>
  );
}
