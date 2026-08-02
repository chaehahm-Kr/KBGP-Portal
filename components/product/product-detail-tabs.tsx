"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  type Product, 
  type ProductVideo, 
  PRODUCT_CATEGORY_LABEL, 
  type ProductCategory,
  CERTIFICATE_TYPE_LABEL,
  type CertificateType
} from "@/lib/product/types";
import { 
  updateProduct, 
  addProductImages, 
  removeProductImage, 
  addProductCertificate, 
  addProductVideoUrl, 
  addProductVideoFile, 
  removeProductVideo 
} from "@/lib/product/actions";
import { ConfirmForm } from "@/components/common/confirm-form";
import { AddCertificateForm } from "@/components/product/add-certificate-form";

interface ProductDetailTabsProps {
  product: Product;
  brandName: string;
  imageRows: { id: string; storage_path: string }[];
  imageUrls: (string | null)[];
  videoRows: ProductVideo[];
  videoUrls: (string | null)[];
  certificateRows: { id: string; certificate_type: string; storage_path: string; original_filename: string | null; version: number }[];
  certificateUrls: (string | null)[];
}

export function ProductDetailTabs({
  product,
  brandName,
  imageRows,
  imageUrls,
  videoRows,
  videoUrls,
  certificateRows,
  certificateUrls,
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "price" | "logistics" | "media" | "certs">("basic");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dynamic Bullet Points State
  const [bullets, setBullets] = useState<string[]>(
    product.bullet_points && product.bullet_points.length > 0
      ? product.bullet_points
      : ["", "", "", "", ""] // Default 5 lines
  );

  // Logistics Live Calculations State
  const [itemWidth, setItemWidth] = useState(product.item_width?.toString() || "");
  const [itemDepth, setItemDepth] = useState(product.item_depth?.toString() || "");
  const [itemHeight, setItemHeight] = useState(product.item_height?.toString() || "");
  const [itemWeight, setItemWeight] = useState(product.item_weight?.toString() || "");

  const [packageWidth, setPackageWidth] = useState(product.package_width?.toString() || "");
  const [packageDepth, setPackageDepth] = useState(product.package_depth?.toString() || "");
  const [packageHeight, setPackageHeight] = useState(product.package_height?.toString() || "");
  const [packageWeight, setPackageWeight] = useState(product.package_weight?.toString() || "");

  const [cartonPackQty, setCartonPackQty] = useState(product.carton_pack_qty?.toString() || "1");
  const [cartonWidth, setCartonWidth] = useState(product.carton_width?.toString() || "");
  const [cartonDepth, setCartonDepth] = useState(product.carton_depth?.toString() || "");
  const [cartonHeight, setCartonHeight] = useState(product.carton_height?.toString() || "");
  const [cartonWeight, setCartonWeight] = useState(product.carton_weight?.toString() || "");
  const [cartonCbm, setCartonCbm] = useState(product.carton_cbm?.toString() || "");

  const [paletteCartonQty, setPaletteCartonQty] = useState(product.palette_carton_qty?.toString() || "");
  const [paletteWidth, setPaletteWidth] = useState(product.palette_width?.toString() || "");
  const [paletteDepth, setPaletteDepth] = useState(product.palette_depth?.toString() || "");
  const [paletteHeight, setPaletteHeight] = useState(product.palette_height?.toString() || "");
  const [paletteWeight, setPaletteWeight] = useState(product.palette_weight?.toString() || "");

  // Override Container Loading states
  const [c20Qty, setC20Qty] = useState(product.container_20ft_qty?.toString() || "");
  const [c20Weight, setC20Weight] = useState(product.container_20ft_weight?.toString() || "");
  const [c20Cbm, setC20Cbm] = useState(product.container_20ft_cbm?.toString() || "");

  const [c40Qty, setC40Qty] = useState(product.container_40fthc_qty?.toString() || "");
  const [c40Weight, setC40Weight] = useState(product.container_40fthc_weight?.toString() || "");
  const [c40Cbm, setC40Cbm] = useState(product.container_40fthc_cbm?.toString() || "");

  // Video Inputs
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoFilePending, setVideoFilePending] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Auto calculation of Carton CBM
  useEffect(() => {
    if (cartonWidth && cartonDepth && cartonHeight) {
      const calculatedCbm = (Number(cartonWidth) * Number(cartonDepth) * Number(cartonHeight)) / 1000000;
      setCartonCbm(calculatedCbm.toFixed(5));
    }
  }, [cartonWidth, cartonDepth, cartonHeight]);

  // Handle dynamic simulation based on CBM and Carton Weight
  const simulate20ftQty = cartonCbm ? Math.floor(28 / Number(cartonCbm)) : 0;
  const simulate20ftWeight = simulate20ftQty && cartonWeight ? (simulate20ftQty * Number(cartonWeight)).toFixed(2) : "0";
  const simulate20ftCbm = simulate20ftQty && cartonCbm ? (simulate20ftQty * Number(cartonCbm)).toFixed(3) : "0";

  const simulate40ftQty = cartonCbm ? Math.floor(76 / Number(cartonCbm)) : 0;
  const simulate40ftWeight = simulate40ftQty && cartonWeight ? (simulate40ftQty * Number(cartonWeight)).toFixed(2) : "0";
  const simulate40ftCbm = simulate40ftQty && cartonCbm ? (simulate40ftQty * Number(cartonCbm)).toFixed(3) : "0";

  // Quick helper to fill simulation values into Container fields
  const apply20ftSimulation = () => {
    setC20Qty(simulate20ftQty.toString());
    setC20Weight(simulate20ftWeight);
    setC20Cbm(simulate20ftCbm);
  };

  const apply40ftSimulation = () => {
    setC40Qty(simulate40ftQty.toString());
    setC40Weight(simulate40ftWeight);
    setC40Cbm(simulate40ftCbm);
  };

  const addBullet = () => setBullets([...bullets, ""]);
  const removeBullet = (index: number) => {
    const updated = bullets.filter((_, i) => i !== index);
    setBullets(updated.length === 0 ? [""] : updated);
  };
  const handleBulletChange = (index: number, val: string) => {
    const updated = [...bullets];
    updated[index] = val;
    setBullets(updated);
  };

  const handleMainFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage(null);
    
    const formData = new FormData(e.currentTarget);
    // Append bullet points
    bullets.forEach((b) => {
      if (b.trim()) {
        formData.append("bulletPoints", b.trim());
      }
    });

    startTransition(async () => {
      const res = await updateProduct(product.id, undefined, formData);
      if (res?.error) {
        setStatusMessage({ type: "error", text: res.error });
      } else {
        setStatusMessage({ type: "success", text: "제품 정보가 성공적으로 업데이트되었습니다." });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  // Video Actions
  const handleVideoUrlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVideoError(null);
    try {
      await addProductVideoUrl(product.id, videoUrlInput);
      setVideoUrlInput("");
      setStatusMessage({ type: "success", text: "동영상 링크가 추가되었습니다." });
    } catch (err: any) {
      setVideoError(err.message || "동영상 추가에 실패했습니다.");
    }
  };

  const handleVideoFileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVideoError(null);
    setVideoFilePending(true);
    try {
      const fd = new FormData(e.currentTarget);
      await addProductVideoFile(product.id, fd);
      setStatusMessage({ type: "success", text: "동영상 파일이 성공적으로 업로드되었습니다." });
      e.currentTarget.reset();
    } catch (err: any) {
      setVideoError(err.message || "동영상 파일 업로드에 실패했습니다.");
    } finally {
      setVideoFilePending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Dynamic Status Banner */}
      {statusMessage && (
        <div 
          className={`p-4 rounded-lg text-xs font-semibold flex items-center justify-between border ${
            statusMessage.type === "success" 
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400" 
              : "bg-rose-50/80 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="cursor-pointer font-bold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main Form wraps all the fields to save text parameters */}
      <form onSubmit={handleMainFormSubmit} className="space-y-6">
        {/* Top Product Header Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* Primary default image shown in basic details header */}
            {imageUrls[0] ? (
              <img 
                src={imageUrls[0]} 
                alt={product.name} 
                className="h-16 w-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-bold text-2xl font-mono border border-zinc-200 dark:border-zinc-800">
                P
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-zinc-400 font-mono tracking-wider">PRODUCT CATALOG</span>
              <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-0.5">{product.name}</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex flex-wrap gap-2 items-center">
                <span>브랜드: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{brandName}</strong></span>
                <span className="opacity-40">•</span>
                <span>카테고리: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{PRODUCT_CATEGORY_LABEL[product.category as ProductCategory] || product.category}</strong></span>
                {product.letusto_sku && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Letusto SKU: <strong className="text-indigo-650 dark:text-indigo-400 font-mono font-bold">{product.letusto_sku}</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto text-center rounded-lg bg-zinc-900 hover:bg-zinc-850 px-5 py-2.5 text-xs font-bold text-white transition-all shadow dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "전체 변경사항 저장"}
            </button>
          </div>
        </div>

        {/* Elegant Glassmorphic Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar scroll-smooth gap-1">
          {[
            { id: "basic", label: "기본 정보" },
            { id: "price", label: "가격 정보" },
            { id: "logistics", label: "로지스틱스" },
            { id: "media", label: "미디어 (이미지/비디오)" },
            { id: "certs", label: "인허가 & 보증서" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Panel 1: 기본 정보 */}
        <div className={activeTab === "basic" ? "space-y-6" : "hidden"}>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              제품 기본 사양
            </h2>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제품명 (한글) *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={product.name}
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제품명 (영문)</label>
                <input
                  name="nameEn"
                  type="text"
                  defaultValue={product.name_en || ""}
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">카테고리 *</label>
                <select
                  name="category"
                  defaultValue={product.category}
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                >
                  {Object.entries(PRODUCT_CATEGORY_LABEL).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">규격/용량 (Volume)</label>
                <input
                  name="volume"
                  type="text"
                  defaultValue={product.volume || ""}
                  placeholder="예: 50ml, 120g"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">원산지 (Origin)</label>
                <input
                  name="origin"
                  type="text"
                  defaultValue={product.origin || ""}
                  placeholder="예: 대한민국 (South Korea)"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">리드 타임 (Lead Time)</label>
                <input
                  name="leadTime"
                  type="text"
                  defaultValue={product.lead_time || ""}
                  placeholder="예: 발주 후 2-3주"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">컬러 (Color)</label>
                <input
                  name="color"
                  type="text"
                  defaultValue={product.color || ""}
                  placeholder="예: Coral Pink"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">컬러 맵 (Color Map)</label>
                <input
                  name="colorMap"
                  type="text"
                  defaultValue={product.color_map || ""}
                  placeholder="예: Pink, Red"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제품 상세 설명 (Description)</label>
              <textarea
                name="description"
                rows={4}
                defaultValue={product.description || ""}
                placeholder="제품 마케팅 소구점 및 상세 설명을 적어주세요."
                className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">전성분표 (Ingredients)</label>
              <textarea
                name="ingredientsText"
                rows={4}
                defaultValue={product.ingredients_text || ""}
                placeholder="전성분 정보를 입력해주세요."
                className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-y"
              />
            </div>
          </div>

          {/* SKU Management Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              SKU 및 식별 번호 관리
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Letusto SKU <span className="text-[10px] text-zinc-400 font-normal">(기준 고유 SKU)</span>
                </label>
                <input
                  name="letustoSku"
                  type="text"
                  defaultValue={product.letusto_sku || ""}
                  placeholder="예: LTS-SUN-001"
                  className="block w-full rounded-lg border border-indigo-250 bg-indigo-50/10 px-3.5 py-2 text-xs text-zinc-900 dark:border-indigo-950 dark:bg-zinc-950 dark:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제조사 SKU (Manufacture SKU)</label>
                <input
                  name="manufactureSku"
                  type="text"
                  defaultValue={product.manufacture_sku || ""}
                  placeholder="제조사의 실제 SKU 코드"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Parent SKU</label>
                <input
                  name="parentSku"
                  type="text"
                  defaultValue={product.parent_sku || ""}
                  placeholder="상위 대표 SKU"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Child SKU</label>
                <input
                  name="childSku"
                  type="text"
                  defaultValue={product.child_sku || ""}
                  placeholder="하위 옵션 SKU"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Bullet Points Management Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-850">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                제품 블랙 포인트 (Bullet Points)
              </h2>
              <button
                type="button"
                onClick={addBullet}
                className="rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                + 추가
              </button>
            </div>
            
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">아마존 등 입점 사이트에 제품 소구 특징으로 5개 핵심 사항을 입력할 수 있습니다. 줄을 자유롭게 늘려가며 관리해 보세요.</p>

            <div className="space-y-3 mt-4">
              {bullets.map((bullet, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-zinc-400 shrink-0 w-6">Line {i + 1}</span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => handleBulletChange(i, e.target.value)}
                    placeholder="핵심 요약 포인트 입력"
                    className="block flex-1 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeBullet(i)}
                    className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 text-xs shrink-0 cursor-pointer"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Panel 2: 가격 정보 */}
        <div className={activeTab === "price" ? "space-y-6" : "hidden"}>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              다양한 판매 가격 등록
            </h2>
            
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">한국 리테일 소비자가 (₩, Retail KRW)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-400">₩</span>
                  <input
                    name="priceKrwRetail"
                    type="number"
                    defaultValue={product.price_krw_retail || ""}
                    placeholder="0"
                    className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">한국 도매가 (₩, Wholesale KRW)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-400">₩</span>
                  <input
                    name="priceKrwWholesale"
                    type="number"
                    defaultValue={product.price_krw_wholesale || ""}
                    placeholder="0"
                    className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">수출용 FOB 가격 ($, Export USD FOB)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-400">$</span>
                  <input
                    name="priceUsdFob"
                    type="number"
                    step="0.01"
                    defaultValue={product.price_usd_fob || ""}
                    placeholder="0.00"
                    className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">추정 소비자가 ($, Retail USD - 기존용)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-400">$</span>
                  <input
                    name="estimatedRetailPrice"
                    type="number"
                    step="0.01"
                    defaultValue={product.estimated_retail_price || ""}
                    placeholder="0.00"
                    className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Panel 3: 로지스틱스 정보 */}
        <div className={activeTab === "logistics" ? "space-y-6" : "hidden"}>
          {/* Item & Package Specs */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Item */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
                1. 단품 규격 (Item Dimension & Weight)
              </h2>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">가로 (Width, cm)</label>
                  <input
                    name="itemWidth"
                    type="number"
                    step="0.1"
                    value={itemWidth}
                    onChange={(e) => setItemWidth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">세로 (Depth, cm)</label>
                  <input
                    name="itemDepth"
                    type="number"
                    step="0.1"
                    value={itemDepth}
                    onChange={(e) => setItemDepth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">높이 (Height, cm)</label>
                  <input
                    name="itemHeight"
                    type="number"
                    step="0.1"
                    value={itemHeight}
                    onChange={(e) => setItemHeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">무게 (Weight, g)</label>
                  <input
                    name="itemWeight"
                    type="number"
                    step="0.1"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>
            </div>

            {/* Package */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
                2. 포장 패키지 규격 (Package Dimension & Weight)
              </h2>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">가로 (Width, cm)</label>
                  <input
                    name="packageWidth"
                    type="number"
                    step="0.1"
                    value={packageWidth}
                    onChange={(e) => setPackageWidth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">세로 (Depth, cm)</label>
                  <input
                    name="packageDepth"
                    type="number"
                    step="0.1"
                    value={packageDepth}
                    onChange={(e) => setPackageDepth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">높이 (Height, cm)</label>
                  <input
                    name="packageHeight"
                    type="number"
                    step="0.1"
                    value={packageHeight}
                    onChange={(e) => setPackageHeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">무게 (Weight, g)</label>
                  <input
                    name="packageWeight"
                    type="number"
                    step="0.1"
                    value={packageWeight}
                    onChange={(e) => setPackageWeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Carton & Palette Specs */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Carton */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
                3. 아웃 카톤 규격 (Carton Box Specs)
              </h2>
              <div className="grid gap-4 grid-cols-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">입수 수량 (Pack Qty - 카톤당 패키지 수) *</label>
                  <input
                    name="cartonPackQty"
                    type="number"
                    value={cartonPackQty}
                    onChange={(e) => setCartonPackQty(e.target.value)}
                    placeholder="1"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">가로 (Width, cm)</label>
                  <input
                    name="cartonWidth"
                    type="number"
                    step="0.1"
                    value={cartonWidth}
                    onChange={(e) => setCartonWidth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">세로 (Depth, cm)</label>
                  <input
                    name="cartonDepth"
                    type="number"
                    step="0.1"
                    value={cartonDepth}
                    onChange={(e) => setCartonDepth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">높이 (Height, cm)</label>
                  <input
                    name="cartonHeight"
                    type="number"
                    step="0.1"
                    value={cartonHeight}
                    onChange={(e) => setCartonHeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">총무게 (Gross Weight, kg)</label>
                  <input
                    name="cartonWeight"
                    type="number"
                    step="0.01"
                    value={cartonWeight}
                    onChange={(e) => setCartonWeight(e.target.value)}
                    placeholder="0.00"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div className="col-span-2 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-850 flex items-center justify-between mt-2">
                  <span className="text-xs font-bold text-zinc-500">자동 계산된 카톤 부피 (CBM):</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      name="cartonCbm"
                      type="text"
                      value={cartonCbm}
                      onChange={(e) => setCartonCbm(e.target.value)}
                      className="w-24 border border-zinc-300 text-center font-mono font-bold text-xs bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white py-0.5 rounded"
                    />
                    <span className="text-[10px] text-zinc-400 font-mono">CBM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Palette */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
                4. 팔레트 규격 (Palette Specs)
              </h2>
              <div className="grid gap-4 grid-cols-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">팔레트당 아웃 카톤 적재 수량 (Carton Qty per Palette)</label>
                  <input
                    name="paletteCartonQty"
                    type="number"
                    value={paletteCartonQty}
                    onChange={(e) => setPaletteCartonQty(e.target.value)}
                    placeholder="0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">가로 (Width, cm)</label>
                  <input
                    name="paletteWidth"
                    type="number"
                    step="0.1"
                    value={paletteWidth}
                    onChange={(e) => setPaletteWidth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">세로 (Depth, cm)</label>
                  <input
                    name="paletteDepth"
                    type="number"
                    step="0.1"
                    value={paletteDepth}
                    onChange={(e) => setPaletteDepth(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">높이 (Height, cm)</label>
                  <input
                    name="paletteHeight"
                    type="number"
                    step="0.1"
                    value={paletteHeight}
                    onChange={(e) => setPaletteHeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">총무게 (Total Weight, kg)</label>
                  <input
                    name="paletteWeight"
                    type="number"
                    step="0.1"
                    value={paletteWeight}
                    onChange={(e) => setPaletteWeight(e.target.value)}
                    placeholder="0.0"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Container Simulation & Overrides */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              5. 컨테이너 적재 시뮬레이터 및 저장 정보
            </h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* 20ft Container */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-850 pb-2">
                  <span className="font-extrabold text-xs text-zinc-800 dark:text-white">20ft Container (기본 규격 28 CBM)</span>
                  <button
                    type="button"
                    onClick={apply20ftSimulation}
                    className="rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] px-2 py-0.5 cursor-pointer"
                  >
                    시뮬레이션 값 적용
                  </button>
                </div>
                
                {/* Simulator output */}
                <div className="grid grid-cols-3 gap-2 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-900 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-400">예상 적재 수량</p>
                    <p className="text-xs font-extrabold font-mono text-zinc-800 dark:text-white mt-0.5">{simulate20ftQty} 카톤</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400">예상 총 중량</p>
                    <p className="text-xs font-extrabold font-mono text-zinc-800 dark:text-white mt-0.5">{simulate20ftWeight} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400">예상 총 CBM</p>
                    <p className="text-xs font-extrabold font-mono text-zinc-800 dark:text-white mt-0.5">{simulate20ftCbm} CBM</p>
                  </div>
                </div>

                {/* Overrides Input */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-zinc-500">실제 최종 입력값 (수정 및 저장 가능):</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-650 mb-0.5">수량 (카톤수)</label>
                      <input
                        name="container20ftQty"
                        type="number"
                        value={c20Qty}
                        onChange={(e) => setC20Qty(e.target.value)}
                        placeholder="0"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-650 mb-0.5">중량 (kg)</label>
                      <input
                        name="container20ftWeight"
                        type="number"
                        step="0.01"
                        value={c20Weight}
                        onChange={(e) => setC20Weight(e.target.value)}
                        placeholder="0.00"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-650 mb-0.5">총 CBM</label>
                      <input
                        name="container20ftCbm"
                        type="number"
                        step="0.001"
                        value={c20Cbm}
                        onChange={(e) => setC20Cbm(e.target.value)}
                        placeholder="0.000"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 40ft HC Container */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-850 pb-2">
                  <span className="font-extrabold text-xs text-zinc-800 dark:text-white">40ft HC Container (기본 규격 76 CBM)</span>
                  <button
                    type="button"
                    onClick={apply40ftSimulation}
                    className="rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] px-2 py-0.5 cursor-pointer"
                  >
                    시뮬레이션 값 적용
                  </button>
                </div>
                
                {/* Simulator output */}
                <div className="grid grid-cols-3 gap-2 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-900 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-400">예상 적재 수량</p>
                    <p className="text-xs font-extrabold font-mono text-zinc-800 dark:text-white mt-0.5">{simulate40ftQty} 카톤</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400">예상 총 중량</p>
                    <p className="text-xs font-extrabold font-mono text-zinc-800 dark:text-white mt-0.5">{simulate40ftWeight} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400">예상 총 CBM</p>
                    <p className="text-xs font-extrabold font-mono text-zinc-800 dark:text-white mt-0.5">{simulate40ftCbm} CBM</p>
                  </div>
                </div>

                {/* Overrides Input */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-zinc-500">실제 최종 입력값 (수정 및 저장 가능):</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-650 mb-0.5">수량 (카톤수)</label>
                      <input
                        name="container40fthcQty"
                        type="number"
                        value={c40Qty}
                        onChange={(e) => setC40Qty(e.target.value)}
                        placeholder="0"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-650 mb-0.5">중량 (kg)</label>
                      <input
                        name="container40fthcWeight"
                        type="number"
                        step="0.01"
                        value={c40Weight}
                        onChange={(e) => setC40Weight(e.target.value)}
                        placeholder="0.00"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-650 mb-0.5">총 CBM</label>
                      <input
                        name="container40fthcCbm"
                        type="number"
                        step="0.001"
                        value={c40Cbm}
                        onChange={(e) => setC40Cbm(e.target.value)}
                        placeholder="0.000"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Tab Panel 4: 미디어 관리 (이미지 & 동영상 업로드) */}
      <div className={activeTab === "media" ? "space-y-6" : "hidden"}>
        {/* Images List */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
            제품 이미지 관리 (최대 5장)
          </h2>
          
          {imageRows.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center">등록된 제품 이미지가 없습니다. 아래 폼에서 이미지를 추가해 주세요.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-4">
              {imageRows.map((img, i) => (
                <div key={img.id} className="relative group border border-zinc-150 dark:border-zinc-800 rounded-lg p-1.5 bg-zinc-50/50 dark:bg-zinc-950 shadow-sm transition-all hover:shadow">
                  {imageUrls[i] && (
                    <img
                      src={imageUrls[i]!}
                      alt={`제품 이미지 ${i + 1}`}
                      className="h-28 w-28 rounded-lg object-cover"
                    />
                  )}
                  {/* Position Badge */}
                  <span className="absolute top-2 left-2 rounded bg-zinc-900/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {i === 0 ? "대표 이미지" : `서브 ${i}`}
                  </span>
                  
                  <ConfirmForm
                    action={removeProductImage.bind(null, product.id, img.id)}
                    className="mt-2 text-center"
                    message="정말 이 제품 이미지를 삭제하시겠습니까?"
                  >
                    <button
                      type="submit"
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer py-1"
                    >
                      이미지 삭제
                    </button>
                  </ConfirmForm>
                </div>
              ))}
            </div>
          )}

          {imageRows.length < 5 && (
            <form
              action={addProductImages.bind(null, product.id)}
              className="mt-6 border-t border-zinc-100 dark:border-zinc-850 pt-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1">
                <input
                  name="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-750 cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-850 cursor-pointer"
              >
                이미지 추가
              </button>
            </form>
          )}
        </div>

        {/* Video Management Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
            제품 동영상 관리
          </h2>

          {videoError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450">
              {videoError}
            </div>
          )}

          {/* Current Videos Display */}
          {videoRows.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center">등록된 제품 동영상이 없습니다.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {videoRows.map((vid, idx) => (
                <div key={vid.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-950 space-y-3 shadow-sm">
                  {vid.video_url ? (
                    /* External video link (YouTube, Vimeo, etc.) */
                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black flex items-center justify-center text-xs text-zinc-400">
                      {vid.video_url.includes("youtube.com") || vid.video_url.includes("youtu.be") ? (
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${
                            vid.video_url.includes("watch?v=")
                              ? vid.video_url.split("watch?v=")[1]?.split("&")[0]
                              : vid.video_url.split("/").pop()
                          }`}
                          title="YouTube video"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <a 
                          href={vid.video_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-indigo-650 hover:underline font-bold truncate px-4 text-center"
                        >
                          외부 동영상 링크 열기 ↗
                          <p className="text-[10px] text-zinc-500 mt-1 font-normal">{vid.video_url}</p>
                        </a>
                      )}
                    </div>
                  ) : (
                    /* Uploaded file link */
                    videoUrls[idx] && (
                      <video 
                        src={videoUrls[idx]!} 
                        controls 
                        className="aspect-video w-full rounded-lg bg-black object-contain border border-zinc-200 dark:border-zinc-850"
                      />
                    )
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {vid.video_url ? "외부 링크 연동" : "직접 업로드 비디오"}
                    </span>
                    
                    <ConfirmForm
                      action={removeProductVideo.bind(null, product.id, vid.id)}
                      message="정말 이 동영상을 삭제하시겠습니까?"
                    >
                      <button
                        type="submit"
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        동영상 삭제
                      </button>
                    </ConfirmForm>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Video Actions */}
          <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-zinc-100 dark:border-zinc-850">
            {/* Action 1: Add external URL */}
            <form onSubmit={handleVideoUrlSubmit} className="space-y-3">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">방법 A: 외부 동영상 링크 등록 (YouTube / Vimeo)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  className="block flex-1 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-850 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
                >
                  등록
                </button>
              </div>
            </form>

            {/* Action 2: Direct Video File Upload */}
            <form onSubmit={handleVideoFileSubmit} className="space-y-3">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">방법 B: 직접 동영상 파일 업로드 (최대 50MB)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  name="videoFile"
                  type="file"
                  accept="video/mp4,video/webm"
                  className="block flex-1 text-xs text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer"
                />
                <button
                  type="submit"
                  disabled={videoFilePending}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  {videoFilePending ? "업로드 중..." : "업로드"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Tab Panel 5: 인허가 & 보증서 */}
      <div className={activeTab === "certs" ? "space-y-6" : "hidden"}>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
            인허가 및 보증 문서 관리
          </h2>
          
          {certificateRows.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center">등록된 보증서 또는 인허가 증빙 자료가 없습니다.</p>
          ) : (
            <ul className="space-y-3 mt-4">
              {certificateRows.map((cert, i) => (
                <li key={cert.id} className="flex items-center gap-3 text-xs border border-zinc-150 dark:border-zinc-800/80 p-3 rounded-lg bg-zinc-50/20 shadow-sm">
                  <span className="rounded bg-zinc-100 dark:bg-zinc-850 px-2.5 py-0.5 font-bold text-[10px] text-zinc-600 dark:text-zinc-350 shrink-0">
                    {CERTIFICATE_TYPE_LABEL[cert.certificate_type as CertificateType] || cert.certificate_type}
                  </span>
                  {certificateUrls[i] ? (
                    <a
                      href={certificateUrls[i]!}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-900 dark:text-white font-bold underline underline-offset-2 hover:text-zinc-600 flex-1 truncate"
                    >
                      {cert.original_filename ?? "파일 보기"}
                    </a>
                  ) : (
                    <span className="text-zinc-400 flex-1 truncate">{cert.original_filename}</span>
                  )}
                  <span className="text-[10px] font-bold text-zinc-400 shrink-0 font-mono">Version {cert.version}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <AddCertificateForm action={addProductCertificate.bind(null, product.id)} />
          </div>
        </div>
      </div>
    </div>
  );
}
