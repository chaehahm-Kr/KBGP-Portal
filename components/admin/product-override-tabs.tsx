"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { 
  type Product, 
  type ProductVideo,
  PRODUCT_CATEGORY_LABEL, 
  type ProductCategory,
  CERTIFICATE_TYPE_LABEL,
  type CertificateType
} from "@/lib/product/types";
import { adminUpdateProductOverrides } from "@/lib/product/admin-actions";
import { CategoryAttributeForm } from "@/components/product/category-attribute-form";

interface ProductOverrideTabsProps {
  product: Product;
  brandName: string;
  brands: { id: string; name: string }[];
  companyName: string;
  imageRows: { id: string; storage_path: string }[];
  imageUrls: (string | null)[];
  videoRows: ProductVideo[];
  videoUrls: (string | null)[];
  certificateRows: { id: string; certificate_type: string; storage_path: string; original_filename: string | null; version: number }[];
  certificateUrls: (string | null)[];
  ingredientsFileUrl: string | null;
  ingredientsFileUrlEn: string | null;
}

export function ProductOverrideTabs({
  product,
  brandName,
  brands,
  companyName,
  imageRows,
  imageUrls,
  videoRows,
  videoUrls,
  certificateRows,
  certificateUrls,
  ingredientsFileUrl,
  ingredientsFileUrlEn,
}: ProductOverrideTabsProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "category_attributes" | "price" | "logistics" | "media" | "certs">("basic");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load existing overrides
  const overrides = (product.price_additional_info as any)?.admin_overrides || {};

  // Form States for Overrides
  const [ovName, setOvName] = useState(overrides.name || "");
  const [ovNameEn, setOvNameEn] = useState(overrides.name_en || "");
  const [ovBrandId, setOvBrandId] = useState(product.brand_id);
  const [ovCategory, setOvCategory] = useState(overrides.category || "");
  const [ovVolume, setOvVolume] = useState(overrides.volume || "");
  const [ovOrigin, setOvOrigin] = useState(overrides.origin || "");
  
  // Parse lead time value and unit for overrides
  const parseLeadTime = (leadTimeStr?: string | null) => {
    if (!leadTimeStr) return { value: "", unit: "주" };
    const match = leadTimeStr.trim().match(/^(\d+)\s*(일|주|개월|days|weeks|months|day|week|month)?$/i);
    if (match) {
      const val = match[1];
      let unit = match[2] || "주";
      if (unit.toLowerCase().startsWith("day") || unit === "일") unit = "일";
      else if (unit.toLowerCase().startsWith("week") || unit === "주") unit = "주";
      else if (unit.toLowerCase().startsWith("month") || unit === "개월") unit = "개월";
      return { value: val, unit };
    }
    return { value: leadTimeStr, unit: "주" };
  };

  const parsedOverrideLeadTime = parseLeadTime(overrides.lead_time);
  const [ovLeadTimeValue, setOvLeadTimeValue] = useState(parsedOverrideLeadTime.value);
  const [ovLeadTimeUnit, setOvLeadTimeUnit] = useState(parsedOverrideLeadTime.unit);
  const [ovColor, setOvColor] = useState(overrides.color || "");
  const [ovColorMap, setOvColorMap] = useState(overrides.color_map || "");
  const [ovDescription, setOvDescription] = useState(overrides.description || "");
  const [ovBullets, setOvBullets] = useState<string[]>(
    overrides.bullet_points && overrides.bullet_points.length > 0
      ? overrides.bullet_points
      : ["", "", "", "", ""]
  );

  // SKU overrides
  const [ovManufactureSku, setOvManufactureSku] = useState(overrides.manufacture_sku || "");
  const [ovLetustoSku, setOvLetustoSku] = useState(overrides.letusto_sku || "");
  const [ovParentSku, setOvParentSku] = useState(overrides.parent_sku || "");
  const [ovChildSku, setOvChildSku] = useState(overrides.child_sku || "");

  const getInitialSkuTypeOverride = () => {
    if (overrides.parent_sku === "Y") return "parent";
    if (overrides.child_sku === "Y") return "child";
    if (overrides.parent_sku === "N" || overrides.child_sku === "N" || overrides.parent_sku === "none" || overrides.child_sku === "none") return "none";
    return "";
  };
  const [skuTypeOverride, setSkuTypeOverride] = useState(getInitialSkuTypeOverride());

  const handleSkuTypeOverrideChange = (val: string) => {
    setSkuTypeOverride(val);
    if (val === "parent") {
      setOvParentSku("Y");
      setOvChildSku("N");
    } else if (val === "child") {
      setOvParentSku("N");
      setOvChildSku("Y");
    } else if (val === "none") {
      setOvParentSku("N");
      setOvChildSku("N");
    } else {
      setOvParentSku("");
      setOvChildSku("");
    }
  };
  const [ovUpc, setOvUpc] = useState(overrides.upc || "");
  const [ovEan, setOvEan] = useState(overrides.ean || "");

  // Selection & Sales Statuses
  const [selectionStatus, setSelectionStatus] = useState(product.selection_status || "UNREVIEWED");
  const [salesStatus, setSalesStatus] = useState(product.sales_status || "PREPARING");

  const handleSelectionStatusChange = (val: string) => {
    setSelectionStatus(val);
    if (val !== "SELECTED") {
      setSalesStatus("PREPARING");
    }
  };

  // Price overrides
  const [ovPriceKrwRetail, setOvPriceKrwRetail] = useState(overrides.price_krw_retail?.toString() || "");
  const [ovPriceKrwWholesale, setOvPriceKrwWholesale] = useState(overrides.price_krw_wholesale?.toString() || "");
  const [ovPriceUsdFob, setOvPriceUsdFob] = useState(overrides.price_usd_fob?.toString() || "");
  const [ovEstimatedRetailPrice, setOvEstimatedRetailPrice] = useState(overrides.estimated_retail_price?.toString() || "");

  // Logistics overrides
  const [ovItemWidth, setOvItemWidth] = useState(overrides.item_width?.toString() || "");
  const [ovItemDepth, setOvItemDepth] = useState(overrides.item_depth?.toString() || "");
  const [ovItemHeight, setOvItemHeight] = useState(overrides.item_height?.toString() || "");
  const [ovItemWeight, setOvItemWeight] = useState(overrides.item_weight?.toString() || "");

  const [ovPackageWidth, setOvPackageWidth] = useState(overrides.package_width?.toString() || "");
  const [ovPackageDepth, setOvPackageDepth] = useState(overrides.package_depth?.toString() || "");
  const [ovPackageHeight, setOvPackageHeight] = useState(overrides.package_height?.toString() || "");
  const [ovPackageWeight, setOvPackageWeight] = useState(overrides.package_weight?.toString() || "");

  const [ovPackageWidthInch, setOvPackageWidthInch] = useState(
    overrides.package_width ? (overrides.package_width * 0.393701).toFixed(2) : ""
  );
  const [ovPackageDepthInch, setOvPackageDepthInch] = useState(
    overrides.package_depth ? (overrides.package_depth * 0.393701).toFixed(2) : ""
  );
  const [ovPackageHeightInch, setOvPackageHeightInch] = useState(
    overrides.package_height ? (overrides.package_height * 0.393701).toFixed(2) : ""
  );
  const [ovPackageWeightLb, setOvPackageWeightLb] = useState(
    overrides.package_weight ? (overrides.package_weight * 0.00220462).toFixed(3) : ""
  );
  const [ovPackageWeightOz, setOvPackageWeightOz] = useState(
    overrides.package_weight ? (overrides.package_weight * 0.035274).toFixed(2) : ""
  );

  const handleWidthCmChange = (val: string) => {
    setOvPackageWidth(val);
    if (val === "") {
      setOvPackageWidthInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageWidthInch((num * 0.393701).toFixed(2));
      }
    }
  };

  const handleWidthInchChange = (val: string) => {
    setOvPackageWidthInch(val);
    if (val === "") {
      setOvPackageWidth("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageWidth((num * 2.54).toFixed(1));
      }
    }
  };

  const handleDepthCmChange = (val: string) => {
    setOvPackageDepth(val);
    if (val === "") {
      setOvPackageDepthInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageDepthInch((num * 0.393701).toFixed(2));
      }
    }
  };

  const handleDepthInchChange = (val: string) => {
    setOvPackageDepthInch(val);
    if (val === "") {
      setOvPackageDepth("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageDepth((num * 2.54).toFixed(1));
      }
    }
  };

  const handleHeightCmChange = (val: string) => {
    setOvPackageHeight(val);
    if (val === "") {
      setOvPackageHeightInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageHeightInch((num * 0.393701).toFixed(2));
      }
    }
  };

  const handleHeightInchChange = (val: string) => {
    setOvPackageHeightInch(val);
    if (val === "") {
      setOvPackageHeight("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageHeight((num * 2.54).toFixed(1));
      }
    }
  };

  const handleWeightGChange = (val: string) => {
    setOvPackageWeight(val);
    if (val === "") {
      setOvPackageWeightLb("");
      setOvPackageWeightOz("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageWeightLb((num * 0.00220462).toFixed(3));
        setOvPackageWeightOz((num * 0.035274).toFixed(2));
      }
    }
  };

  const handleWeightLbChange = (val: string) => {
    setOvPackageWeightLb(val);
    if (val === "") {
      setOvPackageWeight("");
      setOvPackageWeightOz("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageWeight((num * 453.59237).toFixed(1));
        setOvPackageWeightOz((num * 16).toFixed(2));
      }
    }
  };

  const handleWeightOzChange = (val: string) => {
    setOvPackageWeightOz(val);
    if (val === "") {
      setOvPackageWeight("");
      setOvPackageWeightLb("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setOvPackageWeight((num * 28.349523).toFixed(1));
        setOvPackageWeightLb((num * 0.0625).toFixed(3));
      }
    }
  };

  const [ovCartonPackQty, setOvCartonPackQty] = useState(overrides.carton_pack_qty?.toString() || "");
  const [ovCartonWidth, setOvCartonWidth] = useState(overrides.carton_width?.toString() || "");
  const [ovCartonDepth, setOvCartonDepth] = useState(overrides.carton_depth?.toString() || "");
  const [ovCartonHeight, setOvCartonHeight] = useState(overrides.carton_height?.toString() || "");
  const [ovCartonWeight, setOvCartonWeight] = useState(overrides.carton_weight?.toString() || "");
  const [ovCartonCbm, setOvCartonCbm] = useState(overrides.carton_cbm?.toString() || "");

  const [ovPaletteCartonQty, setOvPaletteCartonQty] = useState(overrides.palette_carton_qty?.toString() || "");
  const [ovPaletteWidth, setOvPaletteWidth] = useState(overrides.palette_width?.toString() || "");
  const [ovPaletteDepth, setOvPaletteDepth] = useState(overrides.palette_depth?.toString() || "");
  const [ovPaletteHeight, setOvPaletteHeight] = useState(overrides.palette_height?.toString() || "");
  const [ovPaletteWeight, setOvPaletteWeight] = useState(overrides.palette_weight?.toString() || "");

  const [ovC20Qty, setOvC20Qty] = useState(overrides.container_20ft_qty?.toString() || "");
  const [ovC20Weight, setOvC20Weight] = useState(overrides.container_20ft_weight?.toString() || "");
  const [ovC20Cbm, setOvC20Cbm] = useState(overrides.container_20ft_cbm?.toString() || "");

  const [ovC40Qty, setOvC40Qty] = useState(overrides.container_40fthc_qty?.toString() || "");
  const [ovC40Weight, setOvC40Weight] = useState(overrides.container_40fthc_weight?.toString() || "");
  const [ovC40Cbm, setOvC40Cbm] = useState(overrides.container_40fthc_cbm?.toString() || "");

  const handleSave = () => {
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const payload: Record<string, any> = {};

        // Parse helper
        const addString = (key: string, val: string) => {
          if (val.trim() !== "") payload[key] = val.trim();
          else payload[key] = null; // Clear override
        };
        const addNum = (key: string, val: string) => {
          if (val.trim() !== "") payload[key] = parseFloat(val);
          else payload[key] = null; // Clear override
        };

        payload.selection_status = selectionStatus;
        payload.sales_status = salesStatus;

        addString("name", ovName);
        addString("name_en", ovNameEn);
        payload.brand_id = ovBrandId;
        addString("category", ovCategory);
        addString("volume", ovVolume);
        addString("origin", ovOrigin);
        if (ovLeadTimeValue.trim() !== "") {
          payload["lead_time"] = `${ovLeadTimeValue.trim()} ${ovLeadTimeUnit}`;
        } else {
          payload["lead_time"] = null;
        }
        addString("color", ovColor);
        addString("color_map", ovColorMap);
        addString("description", ovDescription);

        // Filter and clean bullet points
        const cleanedBullets = ovBullets.map((b) => b.trim()).filter((b) => b !== "");
        if (cleanedBullets.length > 0) payload["bullet_points"] = cleanedBullets;
        else payload["bullet_points"] = null;

        addString("manufacture_sku", ovManufactureSku);
        addString("letusto_sku", ovLetustoSku);
        addString("parent_sku", ovParentSku);
        addString("child_sku", ovChildSku);
        addString("upc", ovUpc);
        addString("ean", ovEan);

        addNum("price_krw_retail", ovPriceKrwRetail);
        addNum("price_krw_wholesale", ovPriceKrwWholesale);
        addNum("price_usd_fob", ovPriceUsdFob);
        addNum("estimated_retail_price", ovEstimatedRetailPrice);

        addNum("item_width", ovItemWidth);
        addNum("item_depth", ovItemDepth);
        addNum("item_height", ovItemHeight);
        addNum("item_weight", ovItemWeight);

        addNum("package_width", ovPackageWidth);
        addNum("package_depth", ovPackageDepth);
        addNum("package_height", ovPackageHeight);
        addNum("package_weight", ovPackageWeight);

        addNum("carton_pack_qty", ovCartonPackQty);
        addNum("carton_width", ovCartonWidth);
        addNum("carton_depth", ovCartonDepth);
        addNum("carton_height", ovCartonHeight);
        addNum("carton_weight", ovCartonWeight);
        addNum("carton_cbm", ovCartonCbm);

        addNum("palette_carton_qty", ovPaletteCartonQty);
        addNum("palette_width", ovPaletteWidth);
        addNum("palette_depth", ovPaletteDepth);
        addNum("palette_height", ovPaletteHeight);
        addNum("palette_weight", ovPaletteWeight);

        addNum("container_20ft_qty", ovC20Qty);
        addNum("container_20ft_weight", ovC20Weight);
        addNum("container_20ft_cbm", ovC20Cbm);

        addNum("container_40fthc_qty", ovC40Qty);
        addNum("container_40fthc_weight", ovC40Weight);
        addNum("container_40fthc_cbm", ovC40Cbm);

        await adminUpdateProductOverrides(product.id, payload);
        setStatusMessage({ type: "success", text: "어드민 오버라이드가 성공적으로 저장되었습니다." });
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "저장 실패" });
      }
    });
  };

  return (
    <div className="space-y-6 w-full max-w-7xl pb-12">
      {/* Back button and breadcrumb (Sticky float header) */}
      <div className="sticky top-0 z-30 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between transition-colors mb-2">
        <Link
          href="/admin/products"
          className="text-xs font-bold text-zinc-550 hover:underline flex items-center gap-1 dark:text-zinc-400"
        >
          ← 전체 제품 목록으로 돌아가기
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer"
          >
            {isPending ? "저장 중..." : "변경 사항 저장"}
          </button>
        </div>
      </div>

      {/* Main product summary card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row gap-6 items-start justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>브랜드: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{brandName}</strong></span>
            <span className="opacity-40">•</span>
            <span>제조사: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{companyName}</strong></span>
            <span className="opacity-40">•</span>
            <span>Letusto SKU: <strong className="text-indigo-650 dark:text-indigo-400 font-mono font-bold">{ovLetustoSku || product.letusto_sku || "지정 대기 중"}</strong></span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            {ovName || product.name}
            {ovName && (
              <span className="ml-2 inline-block rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold border border-indigo-100 dark:border-indigo-900">
                어드민 명칭 적용됨
              </span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            포털에서 입력한 모든 정보들을 검토하고 어드민 측에서 필요 시 커스텀 오버라이드 값을 씌울 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          {imageUrls[0] && (
            <img
              src={imageUrls[0]}
              alt={product.name}
              className="h-16 w-16 object-cover rounded-md border border-zinc-200 dark:border-zinc-800 shadow-sm"
            />
          )}
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3.5 rounded-lg border text-xs font-semibold ${
          statusMessage.type === "success"
            ? "bg-emerald-50 border-emerald-250 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300"
            : "bg-red-50 border-red-250 text-red-800 dark:bg-red-950/20 dark:border-red-900 dark:text-red-300"
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* Tabs list */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("basic")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "basic"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          기본 정보
        </button>
        <button
          onClick={() => setActiveTab("category_attributes")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "category_attributes"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          카테고리 & 속성
        </button>
        <button
          onClick={() => setActiveTab("price")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "price"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          가격 정보
        </button>
        <button
          onClick={() => setActiveTab("logistics")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "logistics"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          로지스틱스
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "media"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          미디어 (이미지/비디오)
        </button>
        <button
          onClick={() => setActiveTab("certs")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "certs"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          인허가 & 보증서
        </button>
      </div>

      {/* Tabs Panels Container */}
      <div className="space-y-6">
        {/* Basic & SKU Tab */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            {/* 제품 관리 상태 설정 (선정 및 판매 상태) */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                제품 관리 상태 설정 (선정 및 판매 상태)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 제품 선정 상태 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450">제품 선정 상태</label>
                  <select
                    value={selectionStatus}
                    onChange={(e) => handleSelectionStatusChange(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold"
                  >
                    <option value="UNREVIEWED">미검토</option>
                    <option value="UNDER_REVIEW">검토 중</option>
                    <option value="INFO_REQUESTED">정보 요청</option>
                    <option value="SELECTED">선정</option>
                    <option value="NOT_SELECTED">미선정</option>
                  </select>
                  <p className="text-[10px] text-zinc-400">최초 등록 제품의 기본값은 '미검토'입니다.</p>
                </div>

                {/* 판매 상태 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-455">판매 상태</label>
                  <select
                    value={salesStatus}
                    onChange={(e) => setSalesStatus(e.target.value)}
                    disabled={selectionStatus !== "SELECTED"}
                    className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold disabled:bg-zinc-50 disabled:text-zinc-400 dark:disabled:bg-zinc-900"
                  >
                    <option value="PREPARING">판매 준비</option>
                    <option value="ON_SALE">판매 중</option>
                    <option value="PAUSED">일시 중지</option>
                    <option value="ENDED">판매 종료</option>
                  </select>
                  {selectionStatus !== "SELECTED" ? (
                    <p className="text-[10px] text-rose-600 font-bold dark:text-rose-400 mt-1 flex items-center gap-1">
                      <span>⚠️</span> 선정된 제품만 판매 상태를 변경할 수 있습니다.
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500">선정된 제품의 실시간 판매 노출 상태를 제어합니다.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                제품 기본 정보 비교 및 오버라이드
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Manufacture SKU */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">제조사 SKU *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850 font-mono">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase font-sans">포털 원본</span>
                      {product.manufacture_sku || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovManufactureSku}
                      onChange={(e) => setOvManufactureSku(e.target.value)}
                      placeholder="제조사 SKU 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Letusto SKU */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Letusto SKU</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850 font-mono">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase font-sans">포털 원본</span>
                      {product.letusto_sku || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovLetustoSku}
                      onChange={(e) => setOvLetustoSku(e.target.value)}
                      placeholder="Letusto SKU 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Product Name (EN) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">제품명 (영문) *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.name_en || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovNameEn}
                      onChange={(e) => setOvNameEn(e.target.value)}
                      placeholder="English Product Name"
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* Product Name (KR) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">제품명 (한글)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.name || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovName}
                      onChange={(e) => setOvName(e.target.value)}
                      placeholder="한글 제품명"
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* Brand */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">브랜드 *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {brandName}
                    </div>
                    <select
                      value={ovBrandId}
                      onChange={(e) => setOvBrandId(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    >
                      {(() => {
                        const hasCurrentBrand = brands.some((b) => b.id === product.brand_id);
                        const selectableBrands = hasCurrentBrand
                          ? brands
                          : [{ id: product.brand_id, name: brandName }, ...brands];
                        return selectableBrands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">카테고리 *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {PRODUCT_CATEGORY_LABEL[product.category as ProductCategory] || product.category}
                    </div>
                    <select
                      value={ovCategory}
                      onChange={(e) => setOvCategory(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    >
                      <option value="">-- 오버라이드 안 함 --</option>
                      {Object.entries(PRODUCT_CATEGORY_LABEL).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Volume */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">규격/용량 (Volume)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.volume || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovVolume}
                      onChange={(e) => setOvVolume(e.target.value)}
                      placeholder="예: 50ml, 120g"
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* Origin */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">원산지 (Origin)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.origin || "-"}
                    </div>
                    <select
                      value={ovOrigin}
                      onChange={(e) => setOvOrigin(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    >
                      <option value="">-- 오버라이드 안 함 --</option>
                      <optgroup label="주요 국가 (Major Countries)">
                        <option value="대한민국">대한민국 (South Korea)</option>
                        <option value="미국">미국 (United States)</option>
                        <option value="중국">중국 (China)</option>
                        <option value="베트남">베트남 (Vietnam)</option>
                      </optgroup>
                      <optgroup label="기타 국가 (Other Countries)">
                        <option value="일본">일본 (Japan)</option>
                        <option value="대만">대만 (Taiwan)</option>
                        <option value="태국">태국 (Thailand)</option>
                        <option value="인도네시아">인도네시아 (Indonesia)</option>
                        <option value="말레이시아">말레이시아 (Malaysia)</option>
                        <option value="필리핀">필리핀 (Philippines)</option>
                        <option value="싱가포르">싱가포르 (Singapore)</option>
                        <option value="프랑스">프랑스 (France)</option>
                        <option value="독일">독일 (Germany)</option>
                        <option value="영국">영국 (United Kingdom)</option>
                        <option value="이탈리아">이탈리아 (Italy)</option>
                        <option value="캐나다">캐나다 (Canada)</option>
                        <option value="호주">호주 (Australia)</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Lead Time */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">리드 타임 (Lead Time)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.lead_time || "-"}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={ovLeadTimeValue}
                        onChange={(e) => setOvLeadTimeValue(e.target.value)}
                        placeholder="숫자 입력"
                        className="w-2/3 rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                      />
                      <select
                        value={ovLeadTimeUnit}
                        onChange={(e) => setOvLeadTimeUnit(e.target.value)}
                        className="w-1/3 rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                      >
                        <option value="일">일</option>
                        <option value="주">주</option>
                        <option value="개월">개월</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">컬러 (Color)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.color || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovColor}
                      onChange={(e) => setOvColor(e.target.value)}
                      placeholder="예: Coral Pink"
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* Color Map dropdown */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">컬러 맵 (Color Map)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.color_map || "-"}
                    </div>
                    <select
                      value={ovColorMap}
                      onChange={(e) => setOvColorMap(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    >
                      <option value="">선택 안 함 (None)</option>
                      {[
                        "White", "Black", "Grey", "Silver", "Gold", "Red", "Pink", "Coral", "Orange", 
                        "Yellow", "Green", "Blue", "Purple", "Brown", "Beige", "Ivory", "Clear", "Multi-Color"
                      ].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">제품 상세 설명 (Description)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850 whitespace-pre-wrap leading-relaxed">
                    <span className="text-[8px] font-bold text-zinc-400 block mb-1 uppercase font-sans">포털 원본</span>
                    {product.description || "등록된 설명 없음"}
                  </div>
                  <textarea
                    value={ovDescription}
                    onChange={(e) => setOvDescription(e.target.value)}
                    placeholder="제품 상세 설명 오버라이드 작성..."
                    rows={4}
                    className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Bullet Points */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">주요 특장점 (Bullet Points - 최대 5개)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850 space-y-1">
                    <span className="text-[8px] font-bold text-zinc-400 block mb-1 uppercase font-sans">포털 원본</span>
                    {product.bullet_points && product.bullet_points.length > 0 ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {product.bullet_points.map((pt, idx) => <li key={idx}>{pt}</li>)}
                      </ul>
                    ) : (
                      <p className="italic text-zinc-400">설정된 주요 특장점이 없습니다.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {ovBullets.map((bullet, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-zinc-400 w-4">{idx + 1}.</span>
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            const newB = [...ovBullets];
                            newB[idx] = e.target.value;
                            setOvBullets(newB);
                          }}
                          placeholder={`제품 특징 또는 장점 ${idx + 1}`}
                          className="flex-1 rounded border border-zinc-200 p-1.5 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Identification Numbers Section */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                식별 관리 번호 비교 및 오버라이드
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SKU 구분 (Parent / Child SKU) */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">SKU 구분 (Parent / Child SKU)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase font-sans">포털 원본</span>
                      {product.parent_sku === "Y" || product.parent_sku === "true" || product.parent_sku === "yes"
                        ? "Parent SKU (상위 대표 상품)"
                        : product.child_sku === "Y" || product.child_sku === "true" || product.child_sku === "yes"
                        ? "Child SKU (하위 옵션 상품)"
                        : "일반 단품 (해당 없음)"}
                    </div>
                    <select
                      value={skuTypeOverride}
                      onChange={(e) => handleSkuTypeOverrideChange(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    >
                      <option value="">-- 오버라이드 안 함 --</option>
                      <option value="parent">Parent SKU (상위 대표 상품)</option>
                      <option value="child">Child SKU (하위 옵션 상품)</option>
                      <option value="none">일반 단품 (해당 없음)</option>
                    </select>
                  </div>
                </div>

                {/* UPC */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">UPC (미국식 바코드)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850 font-mono">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase font-sans">포털 원본</span>
                      {product.upc || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovUpc}
                      onChange={(e) => setOvUpc(e.target.value)}
                      placeholder="UPC 번호 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* EAN */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">EAN (유럽/글로벌 바코드)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850 font-mono">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase font-sans">포털 원본</span>
                      {product.ean || "-"}
                    </div>
                    <input
                      type="text"
                      value={ovEan}
                      onChange={(e) => setOvEan(e.target.value)}
                      placeholder="EAN 번호 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Price Tab */}
        {activeTab === "price" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                제품 가격 정보 비교 및 오버라이드
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KRW Retail */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">한국 소비자가 (Retail KRW) *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.price_krw_retail ? `${product.price_krw_retail.toLocaleString()} 원` : "-"}
                    </div>
                    <input
                      type="number"
                      value={ovPriceKrwRetail}
                      onChange={(e) => setOvPriceKrwRetail(e.target.value)}
                      placeholder="소비자가 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* KRW Wholesale */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">도매 공급가 (Wholesale KRW)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.price_krw_wholesale ? `${product.price_krw_wholesale.toLocaleString()} 원` : "-"}
                    </div>
                    <input
                      type="number"
                      value={ovPriceKrwWholesale}
                      onChange={(e) => setOvPriceKrwWholesale(e.target.value)}
                      placeholder="도매가 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* FOB supply price (USD) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">FOB 공급 가격 (USD) *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.price_usd_fob ? `$ ${product.price_usd_fob.toLocaleString()}` : "-"}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={ovPriceUsdFob}
                      onChange={(e) => setOvPriceUsdFob(e.target.value)}
                      placeholder="FOB 공급가 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* Estimated Retail Price (USD) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 미국 소비자가 (MSRP USD)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-150 text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-850">
                      <span className="text-[8px] font-bold text-zinc-400 block mb-0.5 uppercase">포털 원본</span>
                      {product.estimated_retail_price ? `$ ${product.estimated_retail_price.toLocaleString()}` : "-"}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={ovEstimatedRetailPrice}
                      onChange={(e) => setOvEstimatedRetailPrice(e.target.value)}
                      placeholder="예상 미국 소비자가 오버라이드..."
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Display existing tiered pricing read-only */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <h4 className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">포털 수량별 슬라이딩 공급 가격 (Tiered Pricing Tiers)</h4>
                {product.price_additional_info?.price_tiers && product.price_additional_info.price_tiers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {product.price_additional_info.price_tiers.map((tier: any, idx: number) => {
                      const effectiveFobPrice = ovPriceUsdFob.trim() !== "" ? parseFloat(ovPriceUsdFob) : (product.price_usd_fob || 0);
                      return (
                        <div key={idx} className="p-2.5 rounded bg-zinc-50 border border-zinc-150 text-xs text-zinc-650 dark:bg-zinc-950/40 dark:border-zinc-850 font-mono flex justify-between items-center">
                          <span>{tier.qty ? `${tier.qty.toLocaleString()} 개 이상` : "최소 수량"}</span>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-zinc-900 dark:text-white">${tier.price?.toFixed(2)}</strong>
                            {effectiveFobPrice > 0 && tier.price > 0 && (
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                effectiveFobPrice > tier.price
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60"
                                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-650 border border-zinc-200 dark:border-zinc-800"
                              }`}>
                                {effectiveFobPrice > tier.price
                                  ? `${(((effectiveFobPrice - tier.price) / effectiveFobPrice) * 100).toFixed(1)}%`
                                  : "0%"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">설정된 슬라이딩 가격 스케일이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Category & Attributes Tab */}
        {activeTab === "category_attributes" && (
          <div className="bg-slate-900/10 p-2 rounded-2xl">
            <CategoryAttributeForm
              productId={product.id}
              initialCategoryCode={(product as any).category_code || null}
              brandName={brandName}
              companyName={companyName}
              productName={product.name}
              productNameEn={product.name_en || null}
              manufactureSku={product.manufacture_sku || null}
              letustoSku={product.letusto_sku || null}
              origin={product.origin || null}
              volume={product.volume || null}
              colorMap={product.color_map || null}
              isAdmin={true}
            />
          </div>
        )}

        {/* Logistics Tab */}
        {activeTab === "logistics" && (
          <div className="space-y-6">
            {/* Item Spec Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider border-b border-zinc-100 pb-2.5 dark:border-zinc-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M28 20V12h8v8" strokeLinecap="round"/>
                  <path d="M24 20h16v32a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V20z"/>
                  <line x1="32" y1="6" x2="32" y2="12" strokeLinecap="round"/>
                  <path d="M32 20v28" strokeDasharray="3 3"/>
                  <circle cx="32" cy="36" r="3" fill="currentColor"/>
                </svg>
                <span>1. 단품 아이템 스펙 (Item Spec)</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {/* Width */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-450 block">가로 (Width, mm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.item_width || 0}</div>
                  <input type="number" step="0.1" value={ovItemWidth} onChange={(e) => setOvItemWidth(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Depth */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">세로 (Depth, mm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.item_depth || 0}</div>
                  <input type="number" step="0.1" value={ovItemDepth} onChange={(e) => setOvItemDepth(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Height */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">높이 (Height, mm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.item_height || 0}</div>
                  <input type="number" step="0.1" value={ovItemHeight} onChange={(e) => setOvItemHeight(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Weight */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">중량 (Weight, g)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.item_weight || 0}</div>
                  <input type="number" step="0.1" value={ovItemWeight} onChange={(e) => setOvItemWeight(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
              </div>
            </div>

            {/* Package Spec Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider border-b border-zinc-100 pb-2.5 dark:border-zinc-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 12l16-6 16 6v36l-16 6-16-6V12z"/>
                  <path d="M16 12l16 6 16-6"/>
                  <path d="M32 18v38"/>
                  <path d="M16 22l16 6 16-6" opacity="0.6"/>
                </svg>
                <span>2. 단품 포장 패키지 스펙 (Package Spec)</span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                {/* Width */}
                <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">가로 (Width, cm/inch) *</label>
                    <span className="text-[9px] text-zinc-400 font-mono">원본: {product.package_width || 0} cm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={ovPackageWidth}
                        onChange={(e) => handleWidthCmChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동)</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ovPackageWidthInch}
                        onChange={(e) => handleWidthInchChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Depth */}
                <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">세로 (Depth, cm/inch) *</label>
                    <span className="text-[9px] text-zinc-400 font-mono">원본: {product.package_depth || 0} cm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={ovPackageDepth}
                        onChange={(e) => handleDepthCmChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동)</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ovPackageDepthInch}
                        onChange={(e) => handleDepthInchChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">높이 (Height, cm/inch) *</label>
                    <span className="text-[9px] text-zinc-400 font-mono">원본: {product.package_height || 0} cm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={ovPackageHeight}
                        onChange={(e) => handleHeightCmChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-455 dark:text-zinc-500 font-semibold block">inch (자동)</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ovPackageHeightInch}
                        onChange={(e) => handleHeightInchChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Weight */}
                <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">무게 (Weight, g/lb/oz) *</label>
                    <span className="text-[9px] text-zinc-400 font-mono">원본: {product.package_weight || 0} g</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-semibold block">g</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={ovPackageWeight}
                        onChange={(e) => handleWeightGChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">lb (자동)</span>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={ovPackageWeightLb}
                        onChange={(e) => handleWeightLbChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-455 dark:text-zinc-500 font-semibold block">oz (자동)</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ovPackageWeightOz}
                        onChange={(e) => handleWeightOzChange(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Carton Spec Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider border-b border-zinc-100 pb-2.5 dark:border-zinc-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 18l22-8 22 8v28l-22 8-22-8V18z"/>
                  <path d="M10 18l22 8 22-8"/>
                  <path d="M32 26v28"/>
                  <path d="M32 10l11 4M32 10L21 14" opacity="0.8"/>
                  <path d="M21 21.5l11 4 11-4" strokeDasharray="2 2"/>
                </svg>
                <span>3. 아웃박스 카톤 스펙 (Carton Box Spec)</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                {/* Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">입수량 (Qty, 개)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.carton_pack_qty || 1}</div>
                  <input type="number" value={ovCartonPackQty} onChange={(e) => setOvCartonPackQty(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Width */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">가로 (Width, cm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.carton_width || 0}</div>
                  <input type="number" step="0.1" value={ovCartonWidth} onChange={(e) => setOvCartonWidth(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Depth */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">세로 (Depth, cm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.carton_depth || 0}</div>
                  <input type="number" step="0.1" value={ovCartonDepth} onChange={(e) => setOvCartonDepth(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Height */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">높이 (Height, cm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.carton_height || 0}</div>
                  <input type="number" step="0.1" value={ovCartonHeight} onChange={(e) => setOvCartonHeight(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Weight */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">중량 (Weight, kg)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.carton_weight || 0}</div>
                  <input type="number" step="0.1" value={ovCartonWeight} onChange={(e) => setOvCartonWeight(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* CBM */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">부피 (CBM)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.carton_cbm || 0}</div>
                  <input type="number" step="0.001" value={ovCartonCbm} onChange={(e) => setOvCartonCbm(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
              </div>
            </div>

            {/* Palette Spec Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider border-b border-zinc-100 pb-2.5 dark:border-zinc-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 50h48v4H8z"/>
                  <path d="M14 50v4M32 50v4M50 50v4"/>
                  <path d="M12 24h18v22H12zm22 6h18v16H34zM20 12h24v12H20z"/>
                </svg>
                <span>4. 적재 단위 팔레트 스펙 (Palette Spec)</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                {/* Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">박스수량 (Cartons)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.palette_carton_qty || 0}</div>
                  <input type="number" value={ovPaletteCartonQty} onChange={(e) => setOvPaletteCartonQty(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Width */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">가로 (Width, mm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.palette_width || 0}</div>
                  <input type="number" value={ovPaletteWidth} onChange={(e) => setOvPaletteWidth(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Depth */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">세로 (Depth, mm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.palette_depth || 0}</div>
                  <input type="number" value={ovPaletteDepth} onChange={(e) => setOvPaletteDepth(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Height */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">높이 (Height, mm)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.palette_height || 0}</div>
                  <input type="number" value={ovPaletteHeight} onChange={(e) => setOvPaletteHeight(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
                {/* Weight */}
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-455 block">중량 (Weight, kg)</label>
                  <div className="p-1 rounded bg-zinc-50 text-[10px] text-zinc-400 dark:bg-zinc-950/20 font-mono text-center">원본: {product.palette_weight || 0}</div>
                  <input type="number" value={ovPaletteWeight} onChange={(e) => setOvPaletteWeight(e.target.value)} className="w-full rounded border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none" />
                </div>
              </div>
            </div>

            {/* Container Loading Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider border-b border-zinc-100 pb-2.5 dark:border-zinc-800 flex items-center gap-2">
                <svg className="w-6 h-4 text-indigo-500 shrink-0" viewBox="0 0 80 40" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 15l20-6 44 6v18l-40 6-24-6V15z"/>
                  <path d="M8 15l20 6 44-6"/>
                  <path d="M28 21v18"/>
                  <path d="M13 16.5v16.5M18 18v16M23 19.5v15.5" opacity="0.6"/>
                  <path d="M36 20v17M44 19v15M52 18v13M60 17v11" opacity="0.6"/>
                </svg>
                <span>5. 컨테이너 선적 스펙 (Container Loading Spec)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* 20ft Container */}
                <div className="p-4 rounded-lg bg-zinc-50/50 border border-zinc-150 dark:bg-zinc-950/40 dark:border-zinc-850 space-y-3">
                  <h4 className="font-bold text-zinc-800 dark:text-white">20ft 컨테이너 (20ft Standard)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">수량 (개)</label>
                      <input type="number" value={ovC20Qty} onChange={(e) => setOvC20Qty(e.target.value)} className="w-full rounded border border-zinc-200 text-zinc-900 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-center" />
                      <span className="text-[9px] text-zinc-400 block text-center mt-0.5">원본: {product.container_20ft_qty || 0}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">중량 (kg)</label>
                      <input type="number" value={ovC20Weight} onChange={(e) => setOvC20Weight(e.target.value)} className="w-full rounded border border-zinc-200 text-zinc-900 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-center" />
                      <span className="text-[9px] text-zinc-400 block text-center mt-0.5">원본: {product.container_20ft_weight || 0}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">부피 (CBM)</label>
                      <input type="number" step="0.1" value={ovC20Cbm} onChange={(e) => setOvC20Cbm(e.target.value)} className="w-full rounded border border-zinc-200 text-zinc-900 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-center" />
                      <span className="text-[9px] text-zinc-400 block text-center mt-0.5">원본: {product.container_20ft_cbm || 0}</span>
                    </div>
                  </div>
                </div>

                {/* 40ft HC Container */}
                <div className="p-4 rounded-lg bg-zinc-50/50 border border-zinc-150 dark:bg-zinc-950/40 dark:border-zinc-850 space-y-3">
                  <h4 className="font-bold text-zinc-800 dark:text-white">40ft HC 컨테이너 (40ft High Cube)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">수량 (개)</label>
                      <input type="number" value={ovC40Qty} onChange={(e) => setOvC40Qty(e.target.value)} className="w-full rounded border border-zinc-200 text-zinc-900 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-center" />
                      <span className="text-[9px] text-zinc-400 block text-center mt-0.5">원본: {product.container_40fthc_qty || 0}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">중량 (kg)</label>
                      <input type="number" value={ovC40Weight} onChange={(e) => setOvC40Weight(e.target.value)} className="w-full rounded border border-zinc-200 text-zinc-900 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-center" />
                      <span className="text-[9px] text-zinc-400 block text-center mt-0.5">원본: {product.container_40fthc_weight || 0}</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">부피 (CBM)</label>
                      <input type="number" step="0.1" value={ovC40Cbm} onChange={(e) => setOvC40Cbm(e.target.value)} className="w-full rounded border border-zinc-200 text-zinc-900 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none text-center" />
                      <span className="text-[9px] text-zinc-400 block text-center mt-0.5">원본: {product.container_40fthc_cbm || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Media Tab (Read Only Reference) */}
        {activeTab === "media" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                등록 미디어 자료 조회 (포털 원본 파일)
              </h3>

              {/* Images list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-white">등록 상품 이미지 목록 ({imageUrls.length}개)</h4>
                {imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {imageUrls.map((url, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 group shadow-sm aspect-square">
                        {url ? (
                          <img src={url} alt={`제품 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-rose-500 font-bold">로딩 실패</div>
                        )}
                        {idx === 0 ? (
                          <span className="absolute top-2 left-2 rounded bg-amber-500 text-white px-2 py-0.5 text-[9px] font-extrabold shadow-sm border border-amber-400">
                            대표 이미지
                          </span>
                        ) : (
                          <span className="absolute top-2 left-2 rounded bg-black/60 text-white px-1.5 py-0.5 text-[9px] font-semibold">
                            서브 {idx}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-3 text-center">등록된 사진 이미지가 없습니다.</p>
                )}
              </div>

              {/* Videos list */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-white font-sans">등록 상품 홍보 동영상 ({videoUrls.length}개)</h4>
                {videoUrls.length > 0 ? (
                  <div className="space-y-4">
                    {videoRows.map((v, idx) => {
                      const url = videoUrls[idx];
                      return (
                        <div key={v.id} className="p-4 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 flex flex-col md:flex-row gap-4 items-start">
                          <div className="text-xs font-semibold text-zinc-500 w-16">동영상 {idx + 1}</div>
                          <div className="flex-1 space-y-2 text-xs">
                            {v.video_url ? (
                              <p>외부 링크: <a href={v.video_url} target="_blank" rel="noreferrer" className="text-indigo-650 hover:underline font-mono dark:text-indigo-400">{v.video_url}</a></p>
                            ) : (
                              <p className="text-zinc-600 dark:text-zinc-400">직접 업로드 비디오 파일</p>
                            )}
                            {url && (
                              <div className="max-w-md rounded border border-zinc-200 overflow-hidden shadow-sm">
                                <video src={url} controls className="w-full max-h-56" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-3 text-center">등록된 홍보 동영상이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Certifications Tab */}
        {activeTab === "certs" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                원료 및 인허가 보증서 조회 (포털 원본 문서)
              </h3>

              {/* Special files: Ingredient Certs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-850 dark:text-white">성분 표 및 인증서 (Ingredients Sheets)</h4>
                <div className="grid grid-cols-1 gap-4">
                  {/* Unified Sheet */}
                  <div className="p-4 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">성분 인증 증빙 서류</span>
                    {ingredientsFileUrl ? (
                      <a href={ingredientsFileUrl} target="_blank" rel="noreferrer" className="inline-block rounded bg-indigo-650 hover:bg-indigo-750 text-white px-3 py-1.5 font-bold shadow-sm transition-colors">
                        인증 서류 다운로드 ↗
                      </a>
                    ) : (
                      <span className="text-zinc-400 italic block py-1">첨부된 성분 인증 서류 파일이 없습니다.</span>
                    )}
                  </div>
                </div>

                {/* Plain Ingredients Text (Original) */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">전성분 기입 텍스트 (국문 원본)</span>
                  <div className="p-3 bg-zinc-50 border border-zinc-150 rounded text-xs text-zinc-600 dark:bg-zinc-950/30 dark:border-zinc-850 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                    {product.ingredients_text || "전성분 기입 텍스트가 존재하지 않습니다."}
                  </div>
                </div>
              </div>

              {/* General Certificates List */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-zinc-850 dark:text-white">보증서 인증 파일 목록 ({certificateRows.length}개)</h4>
                {certificateRows.length > 0 ? (
                  <div className="space-y-2">
                    {certificateRows.map((cert, idx) => {
                      const url = certificateUrls[idx];
                      return (
                        <div key={cert.id} className="p-3 rounded-md border border-zinc-150 bg-zinc-50/20 dark:border-zinc-800 dark:bg-zinc-950/20 flex items-center justify-between gap-4 text-xs">
                          <div className="space-y-0.5">
                            <span className="inline-block rounded bg-zinc-100 text-zinc-700 px-1.5 py-0.5 text-[9px] font-bold dark:bg-zinc-800 dark:text-zinc-350 mr-1.5 border border-zinc-200 dark:border-zinc-750">
                              {CERTIFICATE_TYPE_LABEL[cert.certificate_type as CertificateType] || cert.certificate_type}
                            </span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{cert.original_filename || "인허가 보증서 파일"}</span>
                            <span className="text-[10px] text-zinc-400 ml-1.5 font-mono">v{cert.version}</span>
                          </div>
                          {url && (
                            <a href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-650 hover:underline dark:text-indigo-400 whitespace-nowrap">
                              파일 다운로드 ↗
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-3 text-center">업로드된 추가 보증서 서류가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Save Button Row */}
      <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-zinc-950 px-6 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
        >
          {isPending ? "저장 중..." : "변경 사항 저장"}
        </button>
      </div>
    </div>
  );
}
