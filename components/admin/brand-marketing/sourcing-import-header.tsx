"use client";

import React, { useMemo } from "react";
import { SourcingProvider } from "@/lib/brand-sourcing/types";
import { sourceRegistry } from "@/lib/brand-sourcing/source-registry";

export interface SourcingImportHeaderProps {
  importMode: "PARSING" | "MANUAL";
  onModeChange: (mode: "PARSING" | "MANUAL") => void;

  selectedProvider: SourcingProvider;
  onProviderChange: (provider: SourcingProvider) => void;

  sourceUrl: string;
  onSourceUrlChange: (url: string) => void;
  enrichWebsite: boolean;
  onEnrichWebsiteChange: (enrich: boolean) => void;
  isExtracting: boolean;
  onExtract: (e?: React.FormEvent) => void;

  onStartManualEntry: () => void;
  hasActiveManualDraft?: boolean;

  extractError?: string | null;
  onClearError?: () => void;
  saveSuccessMessage?: string | null;
  onViewBrandList?: () => void;
}

export function SourcingImportHeader({
  importMode,
  onModeChange,
  selectedProvider,
  onProviderChange,
  sourceUrl,
  onSourceUrlChange,
  enrichWebsite,
  onEnrichWebsiteChange,
  isExtracting,
  onExtract,
  onStartManualEntry,
  hasActiveManualDraft = false,
  extractError,
  onClearError,
  saveSuccessMessage,
  onViewBrandList,
}: SourcingImportHeaderProps) {
  const registeredSources = useMemo(() => sourceRegistry.getAllSources(), []);
  const activeSourceDef = useMemo(
    () => sourceRegistry.getSourceById(selectedProvider) || registeredSources[0],
    [selectedProvider, registeredSources]
  );

  // Auto-detect source provider if user pastes an Indie Beauty Show or InterCHARM link
  const handleUrlChange = (newUrl: string) => {
    onSourceUrlChange(newUrl);
    if (newUrl.trim()) {
      const detected = sourceRegistry.detectSourceByUrl(newUrl.trim());
      if (detected && detected.id !== selectedProvider) {
        onProviderChange(detected.id);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
      {/* 1. Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-zinc-850 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Brand Sourcing — Import & Review
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Multi-Source
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {importMode === "PARSING"
              ? "전시회 참가업체 상세 URL을 입력해 기업, 브랜드, 제품 및 담당자 정보를 자동 파싱합니다."
              : "전시회 URL 없이 신규 기업 및 브랜드를 직접 검토 워크스페이스에 입력하여 등록합니다."}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="inline-flex rounded-lg p-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0">
          <button
            type="button"
            onClick={() => onModeChange("PARSING")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              importMode === "PARSING"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            🌐 웹사이트 추출 (Website Parsing)
          </button>
          <button
            type="button"
            onClick={() => {
              onModeChange("MANUAL");
              onStartManualEntry();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              importMode === "MANUAL"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            ✍️ 직접 등록 (Manual Entry)
          </button>
        </div>
      </div>

      {/* 2. MODE A: WEBSITE PARSING */}
      {importMode === "PARSING" && (
        <div className="space-y-4">
          {/* Source Selector & Options */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                수집 소스 (Source):
              </span>
              <div className="flex items-center gap-1.5">
                {registeredSources.map((source) => {
                  const isSelected = source.id === selectedProvider;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => onProviderChange(source.id)}
                      className={`px-3 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold border-zinc-900 dark:border-white shadow-xs"
                          : "bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {source.shortName}
                      {source.exhibitionYear && (
                        <span className="ml-1 opacity-75 font-normal text-[10px]">
                          {source.exhibitionYear}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Official Website Enrichment Toggle */}
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-750">
              <input
                type="checkbox"
                checked={enrichWebsite}
                onChange={(e) => onEnrichWebsiteChange(e.target.checked)}
                className="rounded text-zinc-900 focus:ring-zinc-900 dark:text-white"
              />
              <span>Official Website Enrichment (공식 웹사이트 연계 분석)</span>
            </label>
          </div>

          {/* URL Form */}
          <form onSubmit={onExtract} className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={activeSourceDef?.urlPlaceholder || "https://..."}
              className="flex-1 px-3 py-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 font-mono text-[11px]"
            />
            <button
              type="submit"
              disabled={isExtracting}
              className="px-5 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded-md hover:bg-zinc-800 dark:hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {isExtracting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Extracting...</span>
                </>
              ) : (
                <span>Extract Exhibitor Info</span>
              )}
            </button>
          </form>

          {/* Quick Test Samples */}
          {activeSourceDef?.sampleUrls && activeSourceDef.sampleUrls.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-850 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                {activeSourceDef.shortName} Quick Samples:
              </span>
              {activeSourceDef.sampleUrls.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => {
                    handleUrlChange(sample.url);
                    if (onClearError) onClearError();
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                >
                  {sample.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. MODE B: MANUAL ENTRY INTRO & ACTION */}
      {importMode === "MANUAL" && (
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200 dark:border-zinc-750 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base">✍️</span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                신규 회사 직접 등록 (Manual Company Registration)
              </h3>
              {hasActiveManualDraft && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  작성 중 (Active Draft)
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              전시회 스크래핑 없이 빈 초안 워크스페이스를 열어 기업 기본 정보, 대표자, 주소, 담당자, 대표 브랜드를 직접 입력하고 저장합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartManualEntry}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
          >
            <span>+ 빈 양식 시작 (New Blank Form)</span>
          </button>
        </div>
      )}

      {/* Error Message Banner */}
      {extractError && (
        <div className="p-3 text-xs rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          <strong>Extraction Failed:</strong> {extractError}
        </div>
      )}

      {/* Success Message Banner */}
      {saveSuccessMessage && (
        <div className="p-3.5 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex justify-between items-center flex-wrap gap-2">
          <span className="font-semibold">{saveSuccessMessage}</span>
          {onViewBrandList && (
            <button
              type="button"
              onClick={onViewBrandList}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer shadow-xs"
            >
              Brand List 상세 보기 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
