"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { CurationSettingsIcon } from "@/components/admin/icons";
import {
  CurationControlClient,
  type ProgramInfo,
  type APInfo,
} from "./curation-control-client";
import {
  CurationSettingsEditor,
  type DisplayProgram,
  type AssortmentProfile,
} from "@/components/admin/curation-settings-editor";

export type CurationTabKey = "control" | "settings";

export interface CurationManagementViewProps {
  initialPrograms: ProgramInfo[];
  initialAPs: APInfo[];
  settingsPrograms: DisplayProgram[];
  settingsProfiles: AssortmentProfile[];
  initialTab?: string;
}

function normalizeTab(rawTab?: string | null): CurationTabKey {
  if (!rawTab) return "control";
  const normalized = rawTab.toLowerCase().trim();
  if (
    normalized === "settings" ||
    normalized === "curation-settings" ||
    normalized === "config" ||
    normalized === "profile" ||
    normalized === "profiles" ||
    normalized === "program" ||
    normalized === "programs"
  ) {
    return "settings";
  }
  return "control";
}

export function CurationManagementView({
  initialPrograms,
  initialAPs,
  settingsPrograms,
  settingsProfiles,
  initialTab,
}: CurationManagementViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial tab from URL or server props
  const urlTab = searchParams?.get("tab");
  const defaultTab = normalizeTab(urlTab || initialTab);
  const [activeTab, setActiveTab] = useState<CurationTabKey>(defaultTab);

  // Sync state if URL changes externally (e.g. Back/Forward button)
  useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const tabParam = currentParams.get("tab");
      setActiveTab(normalizeTab(tabParam));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (urlTab) {
      setActiveTab(normalizeTab(urlTab));
    }
  }, [urlTab]);

  const handleTabClick = (tabKey: CurationTabKey) => {
    if (tabKey === activeTab) return;
    setActiveTab(tabKey);

    // Update URL query string with pushState to avoid page flicker or full RSC re-render
    const params = new URLSearchParams(window.location.search);
    if (tabKey === "control") {
      params.delete("tab");
    } else {
      params.set("tab", tabKey);
    }

    const queryStr = params.toString();
    const newUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
    window.history.pushState({ tab: tabKey }, "", newUrl);
  };

  const tabs = [
    {
      id: "control" as CurationTabKey,
      label: "상품 구성 · Curation Control",
      badge: `${initialPrograms.length}개 프로그램 · ${initialAPs.length}개 AP`,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: "settings" as CurationTabKey,
      label: "기본 설정 · Curation Settings",
      badge: `${settingsPrograms.length}개 프로그램 · ${settingsProfiles.length}개 프로필`,
      icon: <CurationSettingsIcon size={16} className="shrink-0" />,
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Unified Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 shrink-0">
            <CurationSettingsIcon size={22} />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              큐레이션 관리 (Curation Management)
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Display Program별 상품 진열 구성(Control) 및 마스터 프로필 설정(Settings)을 통합 관리합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav
          className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto"
          aria-label="Curation Management Tabs"
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tab-panel-${tab.id}`}
                onClick={() => handleTabClick(tab.id)}
                type="button"
                className={`group inline-flex items-center gap-2.5 py-3.5 px-3 sm:px-4 border-b-2 font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 font-semibold"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-700"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    isActive
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 font-semibold"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Curation Control Panel */}
      <div
        id="tab-panel-control"
        role="tabpanel"
        aria-labelledby="tab-control"
        className={activeTab === "control" ? "block space-y-6" : "hidden"}
      >
        <div className="bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            📦 상품 구성 및 진열 현황 (Curation Control)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            전체 Assortment와 SKU 구성을 관리하고 Display Program별 진열 세트 구성을 분석합니다.
          </p>
        </div>

        <CurationControlClient
          initialPrograms={initialPrograms}
          initialAPs={initialAPs}
        />
      </div>

      {/* Tab 2: Curation Settings Panel */}
      <div
        id="tab-panel-settings"
        role="tabpanel"
        aria-labelledby="tab-settings"
        className={activeTab === "settings" ? "block space-y-6" : "hidden"}
      >
        <div className="bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            ⚙️ 기본 설정 관리 (Curation Settings)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Display Program 및 Assortment Profile(AP) 명칭, 설명, 활성 상태를 통합 관리합니다.
          </p>
        </div>

        <CurationSettingsEditor
          initialPrograms={settingsPrograms}
          initialProfiles={settingsProfiles}
        />
      </div>
    </div>
  );
}
