"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
  type CategoryNode, 
  type ProfileSummaryItem, 
  type AttributeMasterItem 
} from "@/lib/product/attribute-actions";
import { ExcelImporter } from "@/components/admin/settings/excel-importer";
import { CategoryTreeList } from "@/components/admin/settings/category-tree-list";
import { ProfileList } from "@/components/admin/settings/profile-list";
import { AttributeList } from "@/components/admin/settings/attribute-list";
import { 
  CategoriesSubIcon, 
  AttributeProfilesIcon, 
  AttributesOptionsIcon 
} from "@/components/admin/icons";

export type TabKey = "categories" | "attribute-profiles" | "attributes";

interface CategoryAttributeViewProps {
  initialTree: CategoryNode[];
  initialProfiles: ProfileSummaryItem[];
  initialAttributes: AttributeMasterItem[];
  initialTab?: string;
}

function countNodes(nodes: CategoryNode[]): number {
  let count = nodes.length;
  nodes.forEach((n) => {
    if (n.children && n.children.length > 0) {
      count += countNodes(n.children);
    }
  });
  return count;
}

function normalizeTab(rawTab?: string | null): TabKey {
  if (!rawTab) return "categories";
  const normalized = rawTab.toLowerCase().trim();
  if (normalized === "attribute-profiles" || normalized === "profiles" || normalized === "profile") {
    return "attribute-profiles";
  }
  if (
    normalized === "attributes" ||
    normalized === "attributes-options" ||
    normalized === "options" ||
    normalized === "attribute"
  ) {
    return "attributes";
  }
  return "categories";
}

export function CategoryAttributeView({
  initialTree,
  initialProfiles,
  initialAttributes,
  initialTab,
}: CategoryAttributeViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read current tab from URL or fallback
  const urlTab = searchParams?.get("tab");
  const defaultTab = normalizeTab(urlTab || initialTab);
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

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

  const handleTabClick = (tabKey: TabKey) => {
    if (tabKey === activeTab) return;
    setActiveTab(tabKey);

    // Update URL query string with pushState to avoid page flicker or full RSC re-render
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tabKey);
    const newUrl = `${pathname}?${params.toString()}`;
    window.history.pushState({ tab: tabKey }, "", newUrl);
  };

  const totalCategoriesCount = useMemo(() => countNodes(initialTree), [initialTree]);
  const totalProfilesCount = initialProfiles.length;
  const totalAttributesCount = initialAttributes.length;

  const tabs = [
    {
      id: "categories" as TabKey,
      label: "Categories",
      koreanLabel: "카테고리 마스터",
      icon: CategoriesSubIcon,
      count: totalCategoriesCount,
      countUnit: "개 분류",
    },
    {
      id: "attribute-profiles" as TabKey,
      label: "Attribute Profiles",
      koreanLabel: "제품군 속성 프로필",
      icon: AttributeProfilesIcon,
      count: totalProfilesCount,
      countUnit: "개 프로필",
    },
    {
      id: "attributes" as TabKey,
      label: "Attributes & Options",
      koreanLabel: "속성 및 옵션 마스터",
      icon: AttributesOptionsIcon,
      count: totalAttributesCount,
      countUnit: "개 속성",
    },
  ];

  return (
    <div className="w-full text-zinc-900 dark:text-zinc-100 min-h-screen">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shrink-0">
              <CategoriesSubIcon className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                Categories & Attribute
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                카테고리 분류 체계, 제품군 속성 프로필 및 속성·옵션 마스터 데이터를 통합 관리합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 공통 엑셀 일괄 동기화 컴포넌트 (중복 없이 상단 단일 배치) */}
      <ExcelImporter />

      {/* Tab Navigation Bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 mb-8">
        <nav
          className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto"
          aria-label="Categories and Attribute Tabs"
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

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
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-700"
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels: Keep all mounted to avoid flicker, preserve filter/search state, and avoid refetches */}

      {/* 1. Categories Tab */}
      <div
        id="tab-panel-categories"
        role="tabpanel"
        aria-labelledby="tab-categories"
        className={activeTab === "categories" ? "block space-y-6" : "hidden"}
      >
        <div className="bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
            📁 카테고리 마스터 관리
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            최대 3Depth로 구성된 제품 카테고리 체계를 관리합니다. 최종 카테고리는 제품군 속성 프로필과 자동으로 맵핑됩니다.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            🌳 계층 구조 카테고리 트리 (총 {totalCategoriesCount}개 분류 활성화)
          </h3>

          {initialTree.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              등록된 카테고리 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
            </div>
          ) : (
            <CategoryTreeList initialTree={initialTree} />
          )}
        </div>
      </div>

      {/* 2. Attribute Profiles Tab */}
      <div
        id="tab-panel-attribute-profiles"
        role="tabpanel"
        aria-labelledby="tab-attribute-profiles"
        className={activeTab === "attribute-profiles" ? "block space-y-6" : "hidden"}
      >
        <div className="bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
            🏷️ 제품군 속성 프로필 관리
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            최종 카테고리별로 자동 적용되는 dynamic 제품군 속성 프로필의 명세를 확인하고 활성 여부를 조절합니다.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            📋 제품군 프로필 리스트 (총 {totalProfilesCount}개 정의됨)
          </h3>

          {initialProfiles.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              등록된 프로필 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
            </div>
          ) : (
            <ProfileList initialProfiles={initialProfiles} />
          )}
        </div>
      </div>

      {/* 3. Attributes & Options Tab */}
      <div
        id="tab-panel-attributes"
        role="tabpanel"
        aria-labelledby="tab-attributes"
        className={activeTab === "attributes" ? "block space-y-6" : "hidden"}
      >
        <div className="bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
            ⚙️ 속성 및 옵션 마스터 관리
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            모든 제품에 적용되는 공통 속성 및 카테고리별 프로필 속성 목록을 확인하고, 입력타입 및 허용값 규칙을 검토합니다.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            🛠️ 속성 명세 상세 조회 (총 {totalAttributesCount}개 정의됨)
          </h3>

          {initialAttributes.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
              등록된 속성 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
            </div>
          ) : (
            <AttributeList initialAttributes={initialAttributes} />
          )}
        </div>
      </div>
    </div>
  );
}
