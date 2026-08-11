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

      {/* 3. Curation Report Dashboard Area (Moved here, above Selected Products) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="border-b border-zinc-150 pb-2 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-850 dark:text-white">큐레이션 분석 보고서 (Curation Report)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {renderMixBar("Main Category Mix (1Depth)", categoryMix)}
          {renderMixBar("Subcategory Mix (2Depth)", subcategoryMix)}
          {renderMixBar("Detail Category Mix (3Depth)", detailCategoryMix)}
          {renderMixBar("Brand Mix", brandMix)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          {renderMixBar("Price Mix (SRP)", priceMix)}
          {renderMixBar("Curation Role Mix", roleMix)}
          {renderMixBar("Product Sales Status Mix", statusMix)}
        </div>
      </div>

      {/* 4. Selected Product List Management */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="border-b border-zinc-155 pb-2 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white">진열 상품 리스트 (Selected Products)</h3>
            <Link
              href="/admin/products/curation"
              className="text-[11px] font-bold text-zinc-450 hover:underline dark:text-zinc-500"
            >
              ← 목록으로
            </Link>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="rounded bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer flex items-center gap-1"
          >
            <span>+</span> 진열 상품 추가
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-250 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500">
                <th className="p-3 font-bold text-center">L.SKU</th>
                <th className="p-3 font-bold w-[25%]">Product</th>
                <th className="p-3 font-bold">Brand</th>
                <th className="p-3 font-bold">Main Category</th>
                <th className="p-3 font-bold">Subcategory</th>
                <th className="p-3 font-bold text-center w-[12%]">Curation Role</th>
                <th className="p-3 font-bold text-center">공급가</th>
                <th className="p-3 font-bold text-center">소매 마진</th>
                <th className="p-3 font-bold text-center">SRP (소비자가)</th>
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
                      <td className="p-3 text-center">
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
                      <td className="p-3 font-bold text-center text-emerald-600 dark:text-emerald-450 whitespace-nowrap">
                        ${(p.estimated_retail_price - p.price_usd_fob).toFixed(2)} ({p.retailerMarginPercent !== undefined ? p.retailerMarginPercent.toFixed(1) : "0.0"}%)
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
    </div>
  );
}
