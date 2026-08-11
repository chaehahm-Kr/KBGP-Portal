"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  adminAddProductToAP,
  adminRemoveProductFromAP,
  adminChangeProductRoleInAP,
  adminReplaceProductInAP,
} from "@/lib/product/admin-actions";

interface AP {
  id: number;
  display_program: string;
  code: string;
  name: string;
  description: string;
  target_sku: number;
}

interface SelectedProduct {
  id: string;
  name: string;
  letusto_sku: string;
  brandName: string;
  brand_id: string;
  category_code: string | null;
  estimated_retail_price: number;
  price_usd_fob: number;
  retailerMarginPercent?: number;
  imageUrl?: string | null;
  sales_status: string;
  selection_status: string;
  curationRole: string; // REQUIRED, CORE, OPTIONAL, TEST
}

interface Category {
  code: string;
  name_ko: string;
  name_en: string;
  depth: number;
  parent_code: string | null;
}

interface AllProduct {
  id: string;
  name: string;
  letusto_sku: string;
  brandName: string;
  brand_id: string;
  category_code: string | null;
  estimated_retail_price: number;
  price_usd_fob: number;
  retailerMarginPercent?: number;
  imageUrl?: string | null;
  sales_status: string;
  selection_status: string;
}

interface APDetailClientProps {
  ap: AP;
  selectedProducts: SelectedProduct[];
  categories: Category[];
  allProducts: AllProduct[];
}

export function APDetailClient({
  ap,
  selectedProducts: initialProducts,
  categories,
  allProducts,
}: APDetailClientProps) {
  const [products, setProducts] = useState<SelectedProduct[]>(initialProducts);
  const [isPending, startTransition] = useTransition();

  // Curation Report Dashboard States
  const [subcatLimit, setSubcatLimit] = useState<number>(10);
  const [brandLimit, setBrandLimit] = useState<number>(10);
  const [activeDrawer, setActiveDrawer] = useState<"subcategory" | "brand" | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerSort, setDrawerSort] = useState<"count" | "name">("count");
  const [drawerPage, setDrawerPage] = useState(1);
  const [chartFilter, setChartFilter] = useState<{
    type: "category" | "subcategory" | "detailCategory" | "brand" | "role" | "status" | "price";
    value: string;
    label: string;
  } | null>(null);

  // Search & Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleForAdd, setSelectedRoleForAdd] = useState("REQUIRED");

  const [replacingProduct, setReplacingProduct] = useState<SelectedProduct | null>(null);
  const [replaceQuery, setReplaceQuery] = useState("");

  // Categories helper maps
  const catMap = React.useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => {
      map[c.code] = c;
    });
    return map;
  }, [categories]);

  // Find Depth 1 Main Category for a category code
  const getMainCategory = (code: string | null): string => {
    if (!code || !catMap[code]) return "기타 (Other)";
    let curr = catMap[code];
    while (curr.depth > 1 && curr.parent_code && catMap[curr.parent_code]) {
      curr = catMap[curr.parent_code];
    }
    return curr.name_ko || curr.name_en || "기타 (Other)";
  };

  // Find Depth 2 Subcategory for a category code
  const getSubcategory = (code: string | null): string => {
    if (!code || !catMap[code]) return "기타 (Other)";
    let curr = catMap[code];
    if (curr.depth === 3 && curr.parent_code && catMap[curr.parent_code]) {
      curr = catMap[curr.parent_code];
    }
    if (curr.depth === 2) {
      return curr.name_ko || curr.name_en || "기타 (Other)";
    }
    return "기타 (Other)";
  };

  // Find Depth 3 Detail Category for a category code
  const getDetailCategory = (code: string | null): string => {
    if (!code || !catMap[code]) return "기타 (Other)";
    const curr = catMap[code];
    if (curr.depth === 3) {
      return curr.name_ko || curr.name_en || "기타 (Other)";
    }
    return "기타 (Other)";
  };

  // KPI Calculations
  const selectedSkuCount = products.length;
  const brandCount = new Set(products.map((p) => p.brand_id)).size;
  const categoryCount = new Set(products.map((p) => p.category_code).filter(Boolean)).size;

  let srpSum = 0;
  let srpCount = 0;
  let supplySum = 0;
  let supplyCount = 0;
  let marginSum = 0;
  let marginCount = 0;

  products.forEach((p) => {
    const srp = p.estimated_retail_price;
    const supply = p.price_usd_fob;
    
    if (srp > 0) {
      srpSum += srp;
      srpCount++;
    }
    if (supply > 0) {
      supplySum += supply;
      supplyCount++;
    }
    if (srp > 0 && supply > 0) {
      marginSum += ((srp - supply) / srp) * 100;
      marginCount++;
    }
  });

  const avgSrp = srpCount > 0 ? srpSum / srpCount : 0;
  const avgSupply = supplyCount > 0 ? supplySum / supplyCount : 0;
  const avgMargin = marginCount > 0 ? marginSum / marginCount : 0;

  // Warning Checks
  const hasTargetMismatch = selectedSkuCount !== ap.target_sku;
  const inactiveProducts = products.filter((p) => p.sales_status !== "ON_SALE");
  const complianceIssues = products.filter(
    (p) => !["SELECTED"].includes(p.selection_status)
  );

  // 1. Add Product Logic
  const handleAddProduct = (prodId: string) => {
    startTransition(async () => {
      try {
        await adminAddProductToAP(ap.id, prodId, selectedRoleForAdd);
        
        // Update local state
        const added = allProducts.find((p) => p.id === prodId);
        if (added) {
          const newRow: SelectedProduct = {
            ...added,
            curationRole: selectedRoleForAdd,
          };
          setProducts((prev) => [...prev, newRow]);
        }
        setIsAddOpen(false);
        setSearchQuery("");
      } catch (err: any) {
        alert(err.message || "상품 추가 실패");
      }
    });
  };

  // 2. Remove Product Logic
  const handleRemoveProduct = (prodId: string) => {
    if (!confirm("이 상품을 진열 세트에서 제외하시겠습니까?")) return;
    startTransition(async () => {
      try {
        await adminRemoveProductFromAP(ap.id, prodId);
        setProducts((prev) => prev.filter((p) => p.id !== prodId));
      } catch (err: any) {
        alert(err.message || "상품 제외 실패");
      }
    });
  };

  // 3. Replace Product Logic
  const handleReplaceProduct = (newProdId: string) => {
    if (!replacingProduct) return;
    startTransition(async () => {
      try {
        await adminReplaceProductInAP(
          ap.id,
          replacingProduct.id,
          newProdId,
          replacingProduct.curationRole
        );

        // Update local state
        const added = allProducts.find((p) => p.id === newProdId);
        if (added) {
          const newRow: SelectedProduct = {
            ...added,
            curationRole: replacingProduct.curationRole,
          };
          setProducts((prev) =>
            prev.map((p) => (p.id === replacingProduct.id ? newRow : p))
          );
        }
        setReplacingProduct(null);
        setReplaceQuery("");
      } catch (err: any) {
        alert(err.message || "상품 대체 실패");
      }
    });
  };

  // 4. Change Role Logic
  const handleChangeRole = (prodId: string, role: string) => {
    startTransition(async () => {
      try {
        await adminChangeProductRoleInAP(ap.id, prodId, role);
        setProducts((prev) =>
          prev.map((p) => (p.id === prodId ? { ...p, curationRole: role } : p))
        );
      } catch (err: any) {
        alert(err.message || "역할 수정 실패");
      }
    });
  };

  // Filter out already added products
  const candidateProducts = allProducts.filter(
    (aprod) => !products.some((p) => p.id === aprod.id)
  );

  // Search filtered products for modals
  const filteredCandidates = candidateProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.letusto_sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReplaceCandidates = candidateProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(replaceQuery.toLowerCase()) ||
      p.brandName.toLowerCase().includes(replaceQuery.toLowerCase()) ||
      p.letusto_sku.toLowerCase().includes(replaceQuery.toLowerCase())
  );

  // ----------------------------------------
  // CHART MIX CALCULATION HELPERS
  // ----------------------------------------
  const calcDistribution = (itemsList: any[], keyGetter: (it: any) => string) => {
    const counts: Record<string, number> = {};
    itemsList.forEach((it) => {
      const k = keyGetter(it);
      counts[k] = (counts[k] || 0) + 1;
    });
    const total = itemsList.length;
    return Object.keys(counts).map((key) => ({
      name: key,
      value: counts[key],
      percentage: total > 0 ? (counts[key] / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  };

  // Mixes
  const categoryMix = calcDistribution(products, (p) => getMainCategory(p.category_code));
  const subcategoryMix = calcDistribution(products, (p) => getSubcategory(p.category_code));
  const detailCategoryMix = calcDistribution(products, (p) => getDetailCategory(p.category_code));
  const brandMix = calcDistribution(products, (p) => p.brandName);
  const roleMix = calcDistribution(products, (p) => p.curationRole);
  const statusMix = calcDistribution(products, (p) =>
    p.sales_status === "ON_SALE" ? "Active (판매 중)" : "Inactive (판매대기/종료)"
  );
  
  // Price range helper for filter checks
  const getPriceRangeLabel = (msrp: number): string => {
    if (msrp < 15) return "$15 미만";
    if (msrp < 25) return "$15 - $25";
    if (msrp < 40) return "$25 - $40";
    return "$40 이상";
  };

  // Rank-based color class mapping
  const getRankColorClass = (idx: number): string => {
    switch (idx) {
      case 0: return "bg-emerald-600 dark:bg-emerald-500"; // 1위 (Required 그린)
      case 1: return "bg-indigo-600 dark:bg-indigo-400";   // 2위 (Core 보라/인디고)
      case 2: return "bg-sky-500 dark:bg-sky-400";         // 3위 (Test 블루)
      case 3: return "bg-amber-500 dark:bg-amber-400";     // 4위 (Optional 옐로우/오렌지)
      default: return "bg-zinc-400 dark:bg-zinc-650";      // 5위 이하 (회색)
    }
  };

  // Price Mix (MSRP range setup)
  const priceMix = React.useMemo(() => {
    const ranges = [
      { name: "$15 미만", count: 0 },
      { name: "$15 - $25", count: 0 },
      { name: "$25 - $40", count: 0 },
      { name: "$40 이상", count: 0 },
    ];
    products.forEach((p) => {
      const msrp = p.estimated_retail_price;
      if (msrp < 15) ranges[0].count++;
      else if (msrp < 25) ranges[1].count++;
      else if (msrp < 40) ranges[2].count++;
      else ranges[3].count++;
    });
    const total = products.length;
    return ranges.map((r) => ({
      name: r.name,
      value: r.count,
      percentage: total > 0 ? (r.count / total) * 100 : 0,
    })).filter(r => r.value > 0);
  }, [products]);

  // Mix Progress Bar UI Helper
  const renderMixBar = (title: string, mixData: any[]) => {
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-350">{title}</h4>
        <div className="space-y-2">
          {mixData.slice(0, 5).map((row) => (
            <div key={row.name} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[70%]">{row.name}</span>
                <span className="font-bold text-zinc-900 dark:text-white">{row.value}개 ({row.percentage.toFixed(1)}%)</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-950 dark:bg-white rounded-full"
                  style={{ width: `${row.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Map and filter Selected Products table
  const filteredProductsByChart = React.useMemo(() => {
    if (!chartFilter) return products;
    return products.filter((p) => {
      switch (chartFilter.type) {
        case "category":
          return getMainCategory(p.category_code) === chartFilter.value;
        case "subcategory":
          return getSubcategory(p.category_code) === chartFilter.value;
        case "detailCategory":
          return getDetailCategory(p.category_code) === chartFilter.value;
        case "brand":
          return p.brandName === chartFilter.value;
        case "role":
          return p.curationRole === chartFilter.value;
        case "status":
          const statusText = p.sales_status === "ON_SALE" ? "Active (판매 중)" : "Inactive (판매대기/종료)";
          return statusText === chartFilter.value;
        case "price":
          return getPriceRangeLabel(p.estimated_retail_price) === chartFilter.value;
        default:
          return true;
      }
    });
  }, [products, chartFilter]);

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

  return (
    <div className="space-y-6">
      {/* 1. AP Header Warning Banners */}
      {(hasTargetMismatch || inactiveProducts.length > 0 || complianceIssues.length > 0) && (
        <div className="space-y-3">
          {/* Target Mismatch Warning */}
          {hasTargetMismatch && (
            <div className="rounded-xl border border-amber-250 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-955/20 text-xs text-amber-800 dark:text-amber-400 flex items-start gap-3 shadow-sm">
              <span className="text-base">⚠️</span>
              <div>
                <p className="font-bold">MSRP Target SKU 불일치 경고</p>
                <p className="mt-0.5 opacity-90">
                  설정된 목표 SKU 수({ap.target_sku}개)와 실제 선택된 진열 상품 수({selectedSkuCount}개)가 다릅니다. 진열 세트 구성을 확인해 주세요.
                </p>
              </div>
            </div>
          )}

          {/* Inactive & Compliance Warnings */}
          {(inactiveProducts.length > 0 || complianceIssues.length > 0) && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-955/20 text-xs text-red-800 dark:text-red-400 flex items-start gap-3 shadow-sm">
              <span className="text-base">🚨</span>
              <div className="space-y-1.5 flex-1">
                <p className="font-bold">진열 상품 경고 (Inactive / Compliance 이슈)</p>
                <p className="opacity-90">
                  선택된 진열 세트 내에 활성화되지 않았거나 인허가(Compliance) 검토 상태가 승인되지 않은 상품이 포함되어 있습니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-red-150/40 mt-2">
                  {inactiveProducts.length > 0 && (
                    <div>
                      <p className="font-bold uppercase tracking-wider text-[9px] opacity-75">미활성 진열 상품 ({inactiveProducts.length}개):</p>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        {inactiveProducts.map(p => (
                          <li key={p.id} className="truncate max-w-[300px]">
                            {p.name} <span className="opacity-70">({p.letusto_sku})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {complianceIssues.length > 0 && (
                    <div>
                      <p className="font-bold uppercase tracking-wider text-[9px] opacity-75">Compliance 미승인 상품 ({complianceIssues.length}개):</p>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        {complianceIssues.map(p => (
                          <li key={p.id} className="truncate max-w-[300px]">
                            {p.name} <span className="opacity-70">({p.selection_status})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

            {/* 2. Top KPI Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {/* Total 계열 (1~6) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Target SKU</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{ap.target_sku}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Selected SKU</p>
          <p className={`text-xl font-bold mt-1 ${selectedSkuCount === ap.target_sku ? "text-emerald-600" : "text-amber-600"}`}>
            {selectedSkuCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Brands</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{brandCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Supply Price</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">${supplySum.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Retail MSRP</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">${srpSum.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Retailer Margin</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{avgMargin.toFixed(1)}%</p>
        </div>

        {/* Average 계열 (7~8) - 구분하기 쉬운 연한 인디고 틴트 테마 */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-4 shadow-sm dark:border-indigo-950/40 dark:bg-indigo-950/10">
          <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Avg Supply Price</p>
          <p className="text-xl font-bold text-indigo-950 dark:text-indigo-200 mt-1">${avgSupply.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-4 shadow-sm dark:border-indigo-950/40 dark:bg-indigo-950/10">
          <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Avg Retail SRP</p>
          <p className="text-xl font-bold text-indigo-950 dark:text-indigo-200 mt-1">${avgSrp.toFixed(2)}</p>
        </div>
      </div>

      {/* 3. Curation Report Analytics Dashboard */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-150 pb-4 dark:border-zinc-800 gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">큐레이션 분석 보고서 (Curation Report)</h3>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Assortment 세트 진열 구성을 실시간으로 다각 분석합니다. (각 그래프를 누르면 하단 리스트가 필터링됩니다)</p>
          </div>

          {/* Curation Health Summary */}
          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-600 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300">
              Selected: <strong className="ml-1 text-zinc-900 dark:text-white">{selectedSkuCount}/{ap.target_sku} SKU</strong>
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-600 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300">
              Categories: <strong className="ml-1 text-zinc-900 dark:text-white">{categoryCount} 대분류</strong>
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-600 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300">
              Brands: <strong className="ml-1 text-zinc-900 dark:text-white">{brandCount}개</strong>
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded bg-red-50 border border-red-100 text-red-700 dark:bg-red-955/20 dark:border-red-900/50 dark:text-red-400">
              Inactive SKU: <strong className="ml-1">{products.filter((p) => p.sales_status !== "ON_SALE").length}개</strong>
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded bg-amber-50 border border-amber-100 text-amber-700 dark:bg-amber-955/20 dark:border-amber-900/50 dark:text-amber-400">
              Issues: <strong className="ml-1">{products.filter((p) => !["SELECTED"].includes(p.selection_status)).length}개</strong>
            </span>
          </div>
        </div>

        {/* 1st Row: Main / Sub / Detail Categories & Brands */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Category Mix (1Depth) - 전체 다 보여주기 */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Main Category (1Depth)</h4>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {categoryMix.map((item, idx) => (
                <div
                  key={item.name}
                  onClick={() => setChartFilter({ type: "category", value: item.name, label: `대분류: ${item.name}` })}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 group-hover:underline">{item.name}</span>
                    <span className="text-zinc-400">{item.value}개 ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all group-hover:opacity-85 ${getRankColorClass(idx)}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subcategory Mix (2Depth) - TOP 5/10/20 + 전체보기 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Subcategory (2Depth)</h4>
              <div className="flex items-center gap-2">
                <select
                  value={subcatLimit}
                  onChange={(e) => setSubcatLimit(Number(e.target.value))}
                  className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[9px] font-bold outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                >
                  <option value={5}>TOP 5</option>
                  <option value={10}>TOP 10</option>
                  <option value={20}>TOP 20</option>
                </select>
                <button
                  onClick={() => {
                    setDrawerSearch("");
                    setDrawerSort("count");
                    setDrawerPage(1);
                    setActiveDrawer("subcategory");
                  }}
                  className="text-[9px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  전체보기
                </button>
              </div>
            </div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {subcategoryMix.slice(0, subcatLimit).map((item, idx) => (
                <div
                  key={item.name}
                  onClick={() => setChartFilter({ type: "subcategory", value: item.name, label: `중분류: ${item.name}` })}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 group-hover:underline">
                      <span className="text-zinc-400 mr-1 font-mono font-bold">#{idx + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-zinc-400">{item.value}개 ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all group-hover:opacity-85 ${getRankColorClass(idx)}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Category Mix (3Depth) - 전체 표시 */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Detail Category (3Depth)</h4>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {detailCategoryMix.map((item, idx) => (
                <div
                  key={item.name}
                  onClick={() => setChartFilter({ type: "detailCategory", value: item.name, label: `소분류: ${item.name}` })}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 group-hover:underline">
                      <span className="text-zinc-400 mr-1 font-mono font-bold">#{idx + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-zinc-400">{item.value}개 ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all group-hover:opacity-85 ${getRankColorClass(idx)}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Mix - TOP 5/10/20 + 전체보기 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Brand Mix</h4>
              <div className="flex items-center gap-2">
                <select
                  value={brandLimit}
                  onChange={(e) => setBrandLimit(Number(e.target.value))}
                  className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[9px] font-bold outline-none dark:bg-zinc-955 dark:border-zinc-800 dark:text-white"
                >
                  <option value={5}>TOP 5</option>
                  <option value={10}>TOP 10</option>
                  <option value={20}>TOP 20</option>
                </select>
                <button
                  onClick={() => {
                    setDrawerSearch("");
                    setDrawerSort("count");
                    setDrawerPage(1);
                    setActiveDrawer("brand");
                  }}
                  className="text-[9px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  전체보기
                </button>
              </div>
            </div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {brandMix.slice(0, brandLimit).map((item, idx) => (
                <div
                  key={item.name}
                  onClick={() => setChartFilter({ type: "brand", value: item.name, label: `브랜드: ${item.name}` })}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 group-hover:underline">
                      <span className="text-zinc-400 mr-1 font-mono font-bold">#{idx + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-zinc-400">{item.value}개 ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all group-hover:opacity-85 ${getRankColorClass(idx)}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2nd Row: Price Mix, Curation Role, Sales Status Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-zinc-150 dark:border-zinc-800">
          
          {/* 1. Price Mix - Segmented Horizontal Distribution Bar */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Price Mix (SRP)</h4>
            <div className="space-y-6 pt-2">
              {/* Segmented Bar Container */}
              <div className="h-4 w-full flex rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-inner">
                {priceMix.map((segment, idx) => {
                  const colors = [
                    "bg-emerald-600 dark:bg-emerald-500",
                    "bg-indigo-600 dark:bg-indigo-400",
                    "bg-sky-500 dark:bg-sky-400",
                    "bg-amber-500 dark:bg-amber-400",
                  ];
                  if (segment.value === 0) return null;
                  return (
                    <div
                      key={segment.name}
                      onClick={() => setChartFilter({ type: "price", value: segment.name, label: `가격대: ${segment.name}` })}
                      className={`h-full cursor-pointer hover:opacity-85 transition-opacity ${colors[idx % colors.length]}`}
                      style={{ width: `${segment.percentage}%` }}
                      title={`${segment.name}: ${segment.value}개 (${segment.percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>

              {/* Legends Table */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {priceMix.map((segment, idx) => {
                  const colors = [
                    "bg-emerald-600 dark:bg-emerald-500",
                    "bg-indigo-600 dark:bg-indigo-400",
                    "bg-sky-500 dark:bg-sky-400",
                    "bg-amber-500 dark:bg-amber-400",
                  ];
                  return (
                    <div
                      key={segment.name}
                      onClick={() => setChartFilter({ type: "price", value: segment.name, label: `가격대: ${segment.name}` })}
                      className="flex items-center gap-1.5 cursor-pointer hover:underline"
                    >
                      <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">{segment.name}:</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">{segment.value}개 ({segment.percentage.toFixed(1)}%)</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Curation Role Mix - 전체 콤팩트 가로 바 */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Curation Role Mix</h4>
            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
              {roleMix.map((item, idx) => (
                <div
                  key={item.name}
                  onClick={() => setChartFilter({ type: "role", value: item.name, label: `Curation Role: ${item.name}` })}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 group-hover:underline">{item.name}</span>
                    <span className="text-zinc-400">{item.value}개 ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all group-hover:opacity-85 ${getRankColorClass(idx)}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Product Sales Status - SVG Donut Chart */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Product Sales Status</h4>
            <div className="flex items-center justify-center gap-6 pt-2">
              {/* Pure SVG Donut Chart */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    fill="transparent"
                    stroke="#f4f4f5"
                    strokeWidth="8"
                    className="dark:stroke-zinc-800"
                  />
                  {(() => {
                    let accumulatedOffset = 0;
                    return statusMix.map((seg, idx) => {
                      const colors = ["#09090b", "#71717a", "#d4d4d8"]; // zinc dark scale
                      const strokeDash = 2 * Math.PI * 30; // 188.49
                      const strokeLen = (seg.percentage / 100) * strokeDash;
                      const offset = strokeDash - strokeLen + accumulatedOffset;
                      accumulatedOffset -= strokeLen;

                      return (
                        <circle
                          key={seg.name}
                          cx="40"
                          cy="40"
                          r="30"
                          fill="transparent"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="8"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={offset}
                          className="transition-all hover:stroke-indigo-650 cursor-pointer"
                          onClick={() => setChartFilter({ type: "status", value: seg.name, label: `상태: ${seg.name}` })}
                        >
                          <title>{`${seg.name}: ${seg.value}개`}</title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                {/* Central SKU Counter */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[14px] font-bold text-zinc-900 dark:text-white leading-none">{selectedSkuCount}</span>
                  <span className="text-[7px] text-zinc-400 uppercase tracking-tighter mt-0.5">Total</span>
                </div>
              </div>

              {/* Legends list */}
              <div className="flex flex-col gap-2 text-[10px]">
                {statusMix.map((seg, idx) => {
                  const colors = ["bg-zinc-950 dark:bg-zinc-100", "bg-zinc-500", "bg-zinc-300"];
                  return (
                    <div
                      key={seg.name}
                      onClick={() => setChartFilter({ type: "status", value: seg.name, label: `상태: ${seg.name}` })}
                      className="flex items-center gap-1.5 cursor-pointer hover:underline"
                    >
                      <span className={`w-2.5 h-2.5 rounded-sm ${colors[idx % colors.length]}`} />
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">{seg.name}</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">{seg.value}개 ({seg.percentage.toFixed(1)}%)</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Selected Product List Management */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="border-b border-zinc-155 pb-2 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white">Selected Products</h3>
            {chartFilter && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 text-[9px] font-bold">
                필터: {chartFilter.label}
                <button
                  onClick={() => setChartFilter(null)}
                  className="hover:text-red-600 font-mono font-bold ml-1 text-xs cursor-pointer"
                  title="필터 해제"
                >
                  ×
                </button>
              </span>
            )}
            <Link
              href="/admin/products/curation"
              className="text-[11px] font-bold text-zinc-450 hover:underline dark:text-zinc-500"
            >
              ← Back to Curation
            </Link>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="rounded bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer flex items-center gap-1"
          >
            <span>+</span> Add Product
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-250 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500">
                <th className="p-3 font-bold text-center whitespace-nowrap">L.SKU</th>
                <th className="p-3 font-bold w-[20%]">Product</th>
                <th className="p-3 font-bold">Brand</th>
                <th className="p-3 font-bold">Main Category</th>
                <th className="p-3 font-bold">Subcategory</th>
                <th className="p-3 font-bold">Detail Category</th>
                <th className="p-3 font-bold text-center w-[10%]">Curation Role</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">Supply Price</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">Retailer Margin</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">MSRP (Retail Price)</th>
                <th className="p-3 font-bold text-center">Status</th>
                <th className="p-3 font-bold text-center w-[15%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length > 0 ? (
                products.map((p) => {
                  const isInactive = p.sales_status !== "ON_SALE";
                  const hasComplianceIssue = !["SELECTED"].includes(p.selection_status);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-150 dark:border-zinc-850 hover:bg-zinc-50/20 dark:hover:bg-zinc-955/20"
                    >
                      <td className="p-3 text-center whitespace-nowrap">
                        <a
                          href={`/admin/products/${p.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-indigo-650 dark:text-indigo-400 font-bold hover:underline"
                        >
                          {p.letusto_sku}
                        </a>
                      </td>
                      <td className="p-3 font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-10 w-10 rounded object-cover border border-zinc-200 dark:border-zinc-800 animate-fade-in"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded border border-zinc-200 bg-zinc-100 flex items-center justify-center text-[8px] font-bold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-850 font-sans">
                            NO IMG
                          </div>
                        )}
                        <span className="truncate max-w-[200px]" title={p.name}>{p.name}</span>
                      </td>
                      <td className="p-3 text-zinc-600 dark:text-zinc-400 font-medium">
                        {p.brandName}
                      </td>
                      <td className="p-3 text-zinc-650 dark:text-zinc-400">
                        {getMainCategory(p.category_code)}
                      </td>
                      <td className="p-3 text-zinc-650 dark:text-zinc-400">
                        {getSubcategory(p.category_code)}
                      </td>
                      <td className="p-3 text-zinc-650 dark:text-zinc-400 font-medium">
                        {getDetailCategory(p.category_code)}
                      </td>
                      <td className="p-2 text-center">
                        <select
                          value={p.curationRole}
                          onChange={(e) => handleChangeRole(p.id, e.target.value)}
                          className="rounded border border-zinc-200 bg-white p-1 text-[11px] font-semibold focus:border-zinc-955 outline-none w-full dark:bg-zinc-955 dark:border-zinc-800 dark:text-white"
                        >
                          <option value="REQUIRED">Required</option>
                          <option value="CORE">Core</option>
                          <option value="OPTIONAL">Optional</option>
                          <option value="TEST">Test</option>
                        </select>
                      </td>
                      <td className="p-3 font-bold text-center text-zinc-900 dark:text-white">
                        ${p.price_usd_fob.toFixed(2)}
                      </td>
                      <td className="p-3 font-bold text-center text-emerald-600 dark:text-emerald-450 whitespace-nowrap leading-tight">
                        <div>${(p.estimated_retail_price - p.price_usd_fob).toFixed(2)}</div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">
                          ({p.retailerMarginPercent !== undefined ? p.retailerMarginPercent.toFixed(1) : "0.0"}%)
                        </div>
                      </td>
                      <td className="p-3 font-bold text-center text-zinc-900 dark:text-white">
                        ${p.estimated_retail_price.toFixed(2)}
                      </td>
                      <td className="p-3 text-center space-y-1">
                        {isInactive ? (
                          <span className="inline-block rounded bg-red-50 text-red-700 px-2 py-0.5 text-[9px] font-bold border border-red-100 dark:bg-red-955/20 dark:text-red-400 dark:border-red-900">
                            INACTIVE
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-bold border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900">
                            ACTIVE
                          </span>
                        )}
                        {hasComplianceIssue && (
                          <span className="block rounded bg-amber-50 text-amber-700 px-1 py-0.5 text-[9px] font-bold border border-amber-100 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900">
                            COMPLIANCE
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center space-x-1">
                        <button
                          onClick={() => setReplacingProduct(p)}
                          className="text-[10px] font-bold text-zinc-555 hover:underline dark:text-zinc-400 cursor-pointer"
                        >
                          대체
                        </button>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <button
                          onClick={() => handleRemoveProduct(p.id)}
                          className="text-[10px] font-bold text-red-650 hover:underline dark:text-red-400 cursor-pointer"
                        >
                          제외
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-zinc-400 italic">
                    선택된 진열 상품이 없습니다. 상단 우측 [+ 진열 상품 추가] 버튼을 눌러 상품을 큐레이션 하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

{/* 5. Add Product Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-[90%] max-w-lg shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">진열 상품 추가</h4>
              <p className="text-[10px] text-zinc-400">AP 진열에 미등록된 상품을 검색하고 추가합니다.</p>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품명, 브랜드명, Letusto SKU 검색..."
                className="flex-1 rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950"
              />
              <select
                value={selectedRoleForAdd}
                onChange={(e) => setSelectedRoleForAdd(e.target.value)}
                className="rounded border border-zinc-200 p-2 text-xs font-semibold bg-white dark:bg-zinc-950 dark:border-zinc-850 dark:text-white"
              >
                <option value="REQUIRED">Required</option>
                <option value="CORE">Core</option>
                <option value="OPTIONAL">Optional</option>
                <option value="TEST">Test</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border border-zinc-100 dark:border-zinc-800 rounded-md divide-y divide-zinc-100 dark:divide-zinc-850">
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between gap-4 text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20"
                  >
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {p.brandName} • SKU: {p.letusto_sku} • MSRP: ${p.estimated_retail_price}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddProduct(p.id)}
                      disabled={isPending}
                      className="rounded bg-zinc-950 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
                    >
                      추가
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 italic p-8 text-center">검색 결과 또는 추가 가능한 상품이 없습니다.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setSearchQuery("");
                }}
                className="rounded border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-650 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Replace Product Modal */}
      {replacingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-[90%] max-w-lg shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                진열 상품 대체
              </h4>
              <p className="text-[10px] text-zinc-400">
                선택된 <strong className="text-zinc-850 dark:text-white">[{replacingProduct.name}]</strong> 상품을 다른 상품으로 1:1 대체합니다. (역할은 보존됩니다.)
              </p>
            </div>

            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="대체할 신규 상품명, 브랜드명, SKU 검색..."
              className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950"
            />

            <div className="flex-1 overflow-y-auto border border-zinc-100 dark:border-zinc-800 rounded-md divide-y divide-zinc-100 dark:divide-zinc-850">
              {filteredReplaceCandidates.length > 0 ? (
                filteredReplaceCandidates.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between gap-4 text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-955/20"
                  >
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {p.brandName} • SKU: {p.letusto_sku} • MSRP: ${p.estimated_retail_price}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReplaceProduct(p.id)}
                      disabled={isPending}
                      className="rounded bg-zinc-955 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 cursor-pointer"
                    >
                      대체하기
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 italic p-8 text-center">검색 결과 또는 대체 가능한 상품이 없습니다.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setReplacingProduct(null);
                  setReplaceQuery("");
                }}
                className="rounded border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-650 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side Drawer for Full Curation Analysis */}
      {activeDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay Background */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveDrawer(null)}
          />

          {/* Drawer Body Container */}
          <div className="relative w-full max-w-lg h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-slide-in">
            {/* Drawer Header */}
            <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {activeDrawer === "subcategory" ? "Subcategory (2Depth) 전체 분석" : "Brand Mix 전체 분석"}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">AP 내에 구성된 전체 유통 비중 데이터입니다.</p>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 font-mono font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Filter controls */}
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex gap-3">
              <input
                type="text"
                value={drawerSearch}
                onChange={(e) => {
                  setDrawerSearch(e.target.value);
                  setDrawerPage(1);
                }}
                placeholder="이름 검색..."
                className="flex-1 rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold focus:border-zinc-900 outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
              />
              <select
                value={drawerSort}
                onChange={(e) => {
                  setDrawerSort(e.target.value as "count" | "name");
                  setDrawerPage(1);
                }}
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-bold outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
              >
                <option value="count">건수 많은 순</option>
                <option value="name">가나다 순</option>
              </select>
            </div>

            {/* Scrollable Data List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(() => {
                const sourceMix = activeDrawer === "subcategory" ? subcategoryMix : brandMix;
                const filtered = sourceMix.filter((item) =>
                  item.name.toLowerCase().includes(drawerSearch.toLowerCase())
                );
                const sorted = [...filtered].sort((a, b) => {
                  if (drawerSort === "count") return b.value - a.value;
                  return a.name.localeCompare(b.name, "ko");
                });

                const pageSize = 10;
                const totalPage = Math.ceil(sorted.length / pageSize) || 1;
                const paginated = sorted.slice((drawerPage - 1) * pageSize, drawerPage * pageSize);

                return (
                  <>
                    <div className="space-y-4">
                      {paginated.map((item) => {
                        const rankIndex = sorted.findIndex((s) => s.name === item.name) + 1;
                        return (
                          <div
                            key={item.name}
                            onClick={() => {
                              setChartFilter({
                                type: activeDrawer,
                                value: item.name,
                                label: `${activeDrawer === "subcategory" ? "중분류" : "브랜드"}: ${item.name}`
                              });
                              setActiveDrawer(null);
                            }}
                            className="group cursor-pointer p-2.5 rounded-lg border border-zinc-150 hover:border-zinc-400 bg-zinc-50/30 hover:bg-zinc-50/70 transition-all dark:border-zinc-800 dark:hover:border-zinc-700"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-zinc-900 dark:text-white group-hover:underline">
                                <span className="text-zinc-400 mr-1.5 font-mono">#{rankIndex}</span>
                                {item.name}
                              </span>
                              <span className="text-zinc-500 font-medium">
                                {item.value}개 ({item.percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden mt-2 dark:bg-zinc-800">
                              <div
                                className={`h-full transition-all group-hover:opacity-85 ${getRankColorClass(rankIndex - 1)}`}
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {sorted.length === 0 && (
                        <p className="text-center text-xs text-zinc-400 py-12">검색 결과가 존재하지 않습니다.</p>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPage > 1 && (
                      <div className="flex items-center justify-center gap-4 pt-4 text-xs font-bold">
                        <button
                          disabled={drawerPage === 1}
                          onClick={() => setDrawerPage((prev) => Math.max(prev - 1, 1))}
                          className="rounded border border-zinc-200 px-3 py-1 bg-white hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-955 dark:border-zinc-800 dark:hover:bg-zinc-900 cursor-pointer"
                        >
                          이전
                        </button>
                        <span className="text-zinc-500">
                          {drawerPage} / {totalPage}
                        </span>
                        <button
                          disabled={drawerPage === totalPage}
                          onClick={() => setDrawerPage((prev) => Math.min(prev + 1, totalPage))}
                          className="rounded border border-zinc-200 px-3 py-1 bg-white hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-955 dark:border-zinc-800 dark:hover:bg-zinc-900 cursor-pointer"
                        >
                          다음
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
