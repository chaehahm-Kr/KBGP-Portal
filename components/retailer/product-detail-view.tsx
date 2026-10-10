"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";
import { RetailerProductDetail } from "@/lib/retailer/products";
import {
  resolveRetailerSalesPolicy,
  calculateApplicablePrice,
  isValidMoqOrderQuantity,
} from "@/lib/product/retailer-policy";

interface ProductDetailViewProps {
  product: RetailerProductDetail;
}

export function RetailerProductDetailView({ product }: ProductDetailViewProps) {
  const { addItem } = useCart();
  
  // Resolve Sales Policy
  const policy = useMemo(() => {
    return product.salesPolicy || resolveRetailerSalesPolicy(product);
  }, [product]);

  const moq = policy.moq > 0 ? policy.moq : Math.max(1, product.cartonPackQty || 1);
  const [orderQty, setOrderQty] = useState<number>(moq);
  const [rawQtyInput, setRawQtyInput] = useState<string>(moq.toString());
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);
  type DetailTab = "overview" | "specifications" | "packaging_shipping" | "retail_assets" | "customer_qr";
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mediaFilter, setMediaFilter] = useState<"all" | "images" | "videos">("all");
  const [downloadingAll, setDownloadingAll] = useState(false);

  const totalSpecificationsCount = useMemo(() => {
    return product.specifications?.reduce((sum, g) => sum + g.items.length, 0) || 0;
  }, [product.specifications]);

  const packagingShippingData = useMemo(() => {
    const orderingItems: Array<{ label: string; value: string }> = [];
    if (product.cartonPackQty && product.cartonPackQty > 0) {
      orderingItems.push({
        label: "Case Pack (Units per Case)",
        value: `${product.cartonPackQty} units / case`,
      });
    }
    if (moq > 0) {
      orderingItems.push({
        label: "Minimum Order Quantity (MOQ)",
        value: `${moq} units`,
      });
      orderingItems.push({
        label: "Order Multiple",
        value: `${moq} units batch`,
      });
    }

    const unitItems: Array<{ label: string; value: string }> = [];
    const unitDim = product.unitDimensions || product.packageDimensions;
    if (unitDim && (unitDim.width || unitDim.depth || unitDim.height)) {
      const parts: string[] = [];
      if (unitDim.width && unitDim.width > 0) parts.push(`${unitDim.width}`);
      if (unitDim.depth && unitDim.depth > 0) parts.push(`${unitDim.depth}`);
      if (unitDim.height && unitDim.height > 0) parts.push(`${unitDim.height}`);
      if (parts.length > 0) {
        unitItems.push({
          label: "Unit Dimensions (W × D × H)",
          value: `${parts.join(" × ")} mm`,
        });
      }
    }

    const rawUnitWeight = product.unitWeight || product.packageDimensions?.weight;
    if (rawUnitWeight && rawUnitWeight > 0) {
      const grams = rawUnitWeight;
      const oz = (grams / 28.3495).toFixed(1);
      unitItems.push({
        label: "Unit Weight",
        value: `${grams} g (${oz} oz)`,
      });
    }

    const caseItems: Array<{ label: string; value: string }> = [];
    const caseDim = product.caseDimensions;
    if (caseDim && (caseDim.width || caseDim.depth || caseDim.height)) {
      const parts: string[] = [];
      if (caseDim.width && caseDim.width > 0) parts.push(`${caseDim.width}`);
      if (caseDim.depth && caseDim.depth > 0) parts.push(`${caseDim.depth}`);
      if (caseDim.height && caseDim.height > 0) parts.push(`${caseDim.height}`);
      if (parts.length > 0) {
        caseItems.push({
          label: "Case Dimensions (W × D × H)",
          value: `${parts.join(" × ")} mm`,
        });
      }
    }

    const rawCaseWeight = product.caseWeight;
    if (rawCaseWeight && rawCaseWeight > 0) {
      const kg = rawCaseWeight;
      const lb = (kg * 2.20462).toFixed(1);
      caseItems.push({
        label: "Case Weight",
        value: `${kg} kg (${lb} lb)`,
      });
    }

    const totalItemCount = orderingItems.length + unitItems.length + caseItems.length;

    return {
      orderingItems,
      unitItems,
      caseItems,
      totalItemCount,
      isEmpty: totalItemCount === 0,
    };
  }, [product, moq]);

  const totalAssetsCount = (product.images?.length || 0) + (product.videos?.length || 0);
  const totalImagesCount = product.images?.length || 0;
  const totalVideosCount = product.videos?.length || 0;

  const mediaList = useMemo(() => {
    const list: Array<{
      id: string;
      type: "image" | "video";
      url: string;
      position: number;
      title: string;
      category: string;
    }> = [];

    (product.images || []).forEach((img, idx) => {
      list.push({
        id: img.id,
        type: "image",
        url: img.url,
        position: img.position ?? idx,
        title: idx === 0 ? "Primary Packshot" : `Gallery Shot #${idx + 1}`,
        category: idx === 0 ? "Packshot" : "Gallery Image",
      });
    });

    (product.videos || []).forEach((vid, idx) => {
      list.push({
        id: vid.id,
        type: "video",
        url: vid.url,
        position: vid.position ?? (product.images?.length || 0) + idx,
        title: vid.title || `Product Video #${idx + 1}`,
        category: "Video",
      });
    });

    return list;
  }, [product.images, product.videos]);

  const filteredMedia = useMemo(() => {
    if (mediaFilter === "images") return mediaList.filter((m) => m.type === "image");
    if (mediaFilter === "videos") return mediaList.filter((m) => m.type === "video");
    return mediaList;
  }, [mediaList, mediaFilter]);

  React.useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredMedia.length - 1));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev !== null && prev < filteredMedia.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, filteredMedia.length]);

  const handleDownloadAsset = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleDownloadAllImages = async () => {
    if (product.images.length === 0) return;
    setDownloadingAll(true);
    try {
      for (let i = 0; i < product.images.length; i++) {
        const img = product.images[i];
        const ext = img.url.includes(".png") ? "png" : img.url.includes(".svg") ? "svg" : "jpg";
        const filename = `${product.sku || "product"}_asset_${i + 1}.${ext}`;
        await handleDownloadAsset(img.url, filename);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  // Validate Quantity
  const parsedQty = parseInt(rawQtyInput, 10);
  const isQtyValid = !isNaN(parsedQty) && isValidMoqOrderQuantity(parsedQty, moq);

  // Live Price Calculation based on Policy and Quantity
  const livePriceResult = useMemo(() => {
    return calculateApplicablePrice(policy, isQtyValid ? parsedQty : moq);
  }, [policy, parsedQty, isQtyValid, moq]);

  const activeImage =
    product.images.length > 0
      ? product.images[selectedImageIndex]?.url || product.thumbnailUrl
      : null;

  const handleCopySku = () => {
    navigator.clipboard.writeText(product.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleQtyChange = (valStr: string) => {
    setRawQtyInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setOrderQty(parsed);
    }
  };

  const handleStepQty = (delta: number) => {
    const current = isNaN(parsedQty) || parsedQty <= 0 ? moq : parsedQty;
    const next = Math.max(moq, current + delta * moq);
    setOrderQty(next);
    setRawQtyInput(next.toString());
  };

  const handleQuickSelect = (targetQty: number) => {
    setOrderQty(targetQty);
    setRawQtyInput(targetQty.toString());
  };

  const handleAddToCart = () => {
    if (!isQtyValid) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        nameEn: product.nameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: livePriceResult.effectiveUnitPrice,
        msrp: product.msrp,
        marginPercent: livePriceResult.retailerMarginPercent ?? product.marginPercent,
        cartonPackQty: moq,
      },
      parsedQty
    );
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link
          href="/products"
          className="hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1 font-medium"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
          Products
        </Link>
        <span>/</span>
        <span className="text-zinc-400 dark:text-zinc-600">{product.brandName}</span>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white font-medium truncate max-w-[200px] sm:max-w-md">
          {product.name}
        </span>
      </nav>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image Gallery (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Showcase Image */}
          <div className="relative aspect-square w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center p-6 shadow-xs">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-contain object-center transition-all duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 gap-3">
                <svg
                  className="w-16 h-16 stroke-current opacity-30"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                <span className="text-xs font-medium">No packshot available</span>
              </div>
            )}

            {/* Category & Status Tag Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 backdrop-blur-md shadow-xs border border-zinc-200/60 dark:border-zinc-700/60">
                {product.categoryLabel}
              </span>
              {product.isSoldOut && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                  품절 (Out of Stock)
                </span>
              )}
              {policy.hasActivePromo && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                  🔥 Active Promotion
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail Gallery Carousel */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {product.images.map((img, idx) => {
                const isSelected = selectedImageIndex === idx;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-18 h-18 rounded-xl border-2 overflow-hidden shrink-0 bg-white dark:bg-zinc-900 p-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Commercial & Product Details (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header & Badges */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {product.brandName}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                type="button"
                onClick={handleCopySku}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md cursor-pointer"
                title="Click to copy SKU"
              >
                <span>SKU: {product.sku}</span>
                <span className="text-[10px] text-zinc-400">{copiedSku ? "✓ Copied" : "📋"}</span>
              </button>
              {product.origin && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Origin: {product.origin}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
              {product.name}
            </h1>

            {product.nameEn && product.nameEn !== product.name && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal">
                {product.nameEn}
              </p>
            )}

            {product.shortDescription && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium line-clamp-2 leading-snug mt-1">
                {product.shortDescription}
              </p>
            )}
          </div>

          {/* Commercial Pricing Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Wholesale Price */}
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                  <span>Wholesale B2B Price</span>
                  {policy.hasActivePromo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      Promo
                    </span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-0.5 flex items-baseline gap-1">
                  <span>
                    {livePriceResult.effectiveUnitPrice > 0
                      ? `$${livePriceResult.effectiveUnitPrice.toFixed(2)}`
                      : "Pricing on Request"}
                  </span>
                  <span className="text-xs font-normal text-zinc-400">/ EA</span>
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  Per single unit • Excl. local sales taxes
                </div>
              </div>

              {/* Retail MSRP & Margin */}
              <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1">
                <div className="text-right">
                  <div className="text-xs uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                    MSRP (Suggested Retail)
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-zinc-700 dark:text-zinc-300">
                    {product.msrp > 0 ? `$${product.msrp.toFixed(2)}` : "—"}
                  </div>
                </div>

                {livePriceResult.retailerMarginPercent !== null && livePriceResult.retailerMarginPercent > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {livePriceResult.retailerMarginPercent}% Estimated Margin
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400 font-medium">Margin: —</span>
                )}
              </div>
            </div>

            {/* Quantity Discount Tiers Table (Published Tiers Only) */}
            {policy.publishedTiers.length > 0 && (
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>📊</span> Quantity Discount Tiers (수량별 공급 단가)
                  </span>
                  <span className="text-[11px] text-zinc-400">Packs of {moq} units</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                        <th className="py-2 px-3">Order Quantity</th>
                        <th className="py-2 px-2 text-center">Batch Multiple</th>
                        <th className="py-2 px-2 text-center">Discount</th>
                        <th className="py-2 px-2 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Pack Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {policy.publishedTiers.map((t) => {
                        const isCurrentActive = isQtyValid && livePriceResult.appliedTierId === t.id && livePriceResult.appliedReason !== "promotion";
                        return (
                          <tr
                            key={t.id}
                            className={`transition-colors ${
                              isCurrentActive
                                ? "bg-indigo-50/80 dark:bg-indigo-950/40 font-bold"
                                : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                            }`}
                          >
                            <td className="py-2 px-3 font-semibold text-zinc-800 dark:text-zinc-200">
                              {t.min_qty.toLocaleString()} units +
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-zinc-500 dark:text-zinc-400">
                              {t.multiple}× MOQ
                            </td>
                            <td className="py-2 px-2 text-center">
                              {t.discount_percent > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  {t.discount_percent}% OFF
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-normal">Base</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900 dark:text-white">
                              ${t.unit_price.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                              ${(t.min_qty * t.unit_price).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ordering MOQ & Case Pack Strip */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Order Multiple / MOQ:</span>
                <strong className="text-zinc-900 dark:text-white font-semibold">
                  최소 {moq}개 · {moq}개 단위 묶음 (Batch of {moq} units)
                </strong>
              </div>
              {product.volume && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Volume:</span>
                  <strong className="text-zinc-900 dark:text-white font-semibold">
                    {product.volume}
                  </strong>
                </div>
              )}
            </div>

            {/* Quick Tier Selection Buttons */}
            {policy.publishedTiers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                  Quick Select Quantity:
                </span>
                <div className="flex flex-wrap gap-2">
                  {policy.publishedTiers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleQuickSelect(t.min_qty)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        parsedQty === t.min_qty
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {t.min_qty} units {t.discount_percent > 0 ? `(${t.discount_percent}% off)` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ordering Controls & Add to Cart */}
            {product.isSoldOut ? (
              <div className="pt-2 space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                    <span className="text-base">🚨</span>
                    <span>현재 가용 재고가 소진되어 품절(Out of Stock) 상태입니다.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-rose-100 dark:border-rose-950 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                    <div className="font-semibold text-zinc-900 dark:text-white">재입고 안내 (Restock Information):</div>
                    <div>
                      {product.restockEta ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          입고 예정일: {new Date(product.restockEta).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} ({product.restockEta})
                        </span>
                      ) : (
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                          재입고 일정을 확인 중입니다. (재입고 일정 미정)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed text-center"
                  >
                    품절 (Out of Stock — 주문 불가)
                  </button>
                </div>
              </div>
            ) : product.isOrderable && product.wholesalePrice > 0 ? (
              <div className="pt-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Order Quantity</span>
                      <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                        (Multiple of {moq} units)
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Line Total:{" "}
                      <strong className="text-zinc-900 dark:text-white font-bold text-base font-mono">
                        ${isQtyValid ? livePriceResult.subtotal.toFixed(2) : "—"}
                      </strong>
                      {isQtyValid && (
                        <span className="text-[11px] text-zinc-400 ml-2">
                          (${livePriceResult.effectiveUnitPrice.toFixed(2)} × {parsedQty} units)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-1">
                      <button
                        type="button"
                        onClick={() => handleStepQty(-1)}
                        disabled={parsedQty <= moq}
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={moq}
                        step={moq}
                        value={rawQtyInput}
                        onChange={(e) => handleQtyChange(e.target.value)}
                        className={`w-16 text-center font-bold font-mono text-sm bg-transparent border-0 focus:outline-hidden ${
                          !isQtyValid ? "text-rose-600 dark:text-rose-400 ring-2 ring-rose-500 rounded" : "text-zinc-900 dark:text-white"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleStepQty(1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Warning Banner if not a multiple */}
                {!isQtyValid && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <span className="font-bold text-sm">⚠️</span>
                    <span>
                      주문 수량은 최소 {moq}개 이상이며, <strong>{moq}개 단위의 배수</strong>({moq}, {moq * 2}, {moq * 3}...)여야 합니다.
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!isQtyValid}
                    className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      addedSuccess
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95"
                    }`}
                  >
                    {addedSuccess ? (
                      <>
                        <span>✓</span>
                        <span>Added to Cart ({parsedQty} units)</span>
                      </>
                    ) : (
                      <>
                        <span>🛒</span>
                        <span>Add {isQtyValid ? `${parsedQty} units` : ""} to Cart</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
                This item is currently not available for purchase.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Information Tabs */}
      <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
        {/* Tab Header Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-2.5 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "font-bold border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                : "font-semibold border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Product Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("specifications")}
            className={`px-5 py-2.5 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "specifications"
                ? "font-bold border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                : "font-semibold border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Specifications</span>
            {totalSpecificationsCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "specifications"
                    ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {totalSpecificationsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("packaging_shipping")}
            className={`px-5 py-2.5 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "packaging_shipping"
                ? "font-bold border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                : "font-semibold border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Packaging & Shipping</span>
            {packagingShippingData.totalItemCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "packaging_shipping"
                    ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {packagingShippingData.totalItemCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("retail_assets")}
            className={`px-5 py-2.5 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "retail_assets"
                ? "font-bold border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                : "font-semibold border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Retail Assets</span>
            {totalAssetsCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "retail_assets"
                    ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {totalAssetsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customer_qr")}
            className={`px-5 py-2.5 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "customer_qr"
                ? "font-bold border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400"
                : "font-semibold border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span>Customer Page & QR</span>
          </button>
        </div>

        {/* Tab Panel: Product Overview */}
        {activeTab === "overview" && (
          <div className="space-y-8 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
            {/* A. Product Description */}
            {product.description && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Product Description
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* B. Key Benefits */}
            {product.bulletPoints && product.bulletPoints.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Key Benefits
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {product.bulletPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-150/60 dark:border-zinc-800/80"
                    >
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* C. How to Use */}
            {product.howToUse && (
              <div className="space-y-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  How to Use
                </h3>
                <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-150/60 dark:border-zinc-800/80">
                  {product.howToUse}
                </div>
              </div>
            )}

            {/* D. Ingredients */}
            {product.ingredients && (
              <div className="space-y-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Ingredients (전성분)
                </h3>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-150/60 dark:border-zinc-800/80 font-mono">
                  {product.ingredients}
                </div>
              </div>
            )}

            {/* E. Product Details Grid */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Product Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                  <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Brand</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{product.brandName}</span>
                </div>
                {product.categoryPath && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Category</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{product.categoryPath}</span>
                  </div>
                )}
                {product.volume && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Size / Volume</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{product.volume}</span>
                  </div>
                )}
                {product.origin && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Country of Origin</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{product.origin}</span>
                  </div>
                )}
                {product.formulation && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Formulation</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{product.formulation}</span>
                  </div>
                )}
                {product.storageCondition && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">Storage Condition</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{product.storageCondition}</span>
                  </div>
                )}
                {product.upc && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 space-y-0.5">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase">UPC</span>
                    <span className="font-semibold font-mono text-zinc-900 dark:text-white">{product.upc}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Panel: Specifications */}
        {activeTab === "specifications" && (
          <div className="space-y-6 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
            {(!product.specifications || product.specifications.length === 0) ? (
              <div className="py-16 text-center text-zinc-400 dark:text-zinc-500">
                <span className="text-4xl block mb-3">📋</span>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No detailed specifications configured for this product.
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  General product details and characteristics are available in the Product Overview tab.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {product.specifications.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-3.5">
                    {/* Group Header */}
                    <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        {group.group}
                      </h3>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">
                        ({group.items.length})
                      </span>
                    </div>

                    {/* Group Items Grid (2-column desktop / 1-column mobile) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150/60 dark:border-zinc-800/80 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
                        >
                          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider shrink-0 sm:max-w-[45%]">
                            {item.name}
                          </span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm sm:text-right break-words">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Panel: Packaging & Shipping */}
        {activeTab === "packaging_shipping" && (
          <div className="space-y-6 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                    Packaging & Shipping Specifications
                  </h3>
                  {packagingShippingData.totalItemCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {packagingShippingData.totalItemCount} Specifications
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Logistics, master carton packing units, product dimensions, and shipping weights.
                </p>
              </div>
            </div>

            {packagingShippingData.isEmpty ? (
              <div className="py-16 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
                <span className="text-4xl block mb-3">📦</span>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Packaging and shipping specifications are currently being updated for this product.
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  For bulk freight inquiries or customized pallet dimensions, please contact your account manager.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Group A: Ordering Specifications */}
                {packagingShippingData.orderingItems.length > 0 && (
                  <div className="space-y-3.5 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center gap-2 border-b border-zinc-200/60 dark:border-zinc-700/60 pb-3">
                      <span className="text-base">📦</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Ordering & Case Pack
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {packagingShippingData.orderingItems.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                            {item.label}
                          </span>
                          <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group B: Unit Specifications */}
                {packagingShippingData.unitItems.length > 0 && (
                  <div className="space-y-3.5 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center gap-2 border-b border-zinc-200/60 dark:border-zinc-700/60 pb-3">
                      <span className="text-base">📏</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Single Unit Specs
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {packagingShippingData.unitItems.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                            {item.label}
                          </span>
                          <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group C: Master Case Specifications */}
                {packagingShippingData.caseItems.length > 0 && (
                  <div className="space-y-3.5 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center gap-2 border-b border-zinc-200/60 dark:border-zinc-700/60 pb-3">
                      <span className="text-base">🚛</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Master Carton Specs
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {packagingShippingData.caseItems.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                            {item.label}
                          </span>
                          <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Panel: Retail Assets (Media Kit) */}
        {activeTab === "retail_assets" && (
          <div className="space-y-6 bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                    Retail Assets & Media Kit
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {totalAssetsCount} Assets
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  High-resolution product photography, e-commerce packshots, and marketing media assets for retail merchandising.
                </p>
              </div>

              {/* Filter Pills & Batch Download */}
              <div className="flex flex-wrap items-center gap-2">
                {totalVideosCount > 0 && (
                  <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
                    <button
                      type="button"
                      onClick={() => setMediaFilter("all")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        mediaFilter === "all"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      All ({totalAssetsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaFilter("images")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        mediaFilter === "images"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      Images ({totalImagesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaFilter("videos")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        mediaFilter === "videos"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      Videos ({totalVideosCount})
                    </button>
                  </div>
                )}

                {totalImagesCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadAllImages}
                    disabled={downloadingAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <span>{downloadingAll ? "⏳" : "⬇️"}</span>
                    <span>{downloadingAll ? "Downloading..." : `Download All (${totalImagesCount})`}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Media Grid */}
            {filteredMedia.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 dark:text-zinc-500">
                <span className="text-4xl block mb-3">🖼️</span>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No retail media assets available for this product.
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Product images and videos will appear here once registered by the brand.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredMedia.map((media, mIdx) => {
                  const isPackshot = media.type === "image" && media.position === 0;
                  const isVideo = media.type === "video";

                  return (
                    <div
                      key={media.id || mIdx}
                      className="group relative flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/80 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 shadow-2xs hover:shadow-md"
                    >
                      {/* Media Preview Box */}
                      <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {isVideo ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-zinc-900 text-white">
                            <video
                              src={media.url}
                              className="w-full h-full object-cover opacity-70"
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl text-white shadow-lg group-hover:scale-110 transition-transform">
                                ▶
                              </span>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={media.url}
                            alt={media.title}
                            className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}

                        {/* Top Badge */}
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight shadow-xs ${
                              isPackshot
                                ? "bg-indigo-600 text-white"
                                : isVideo
                                ? "bg-purple-600 text-white"
                                : "bg-black/60 backdrop-blur-xs text-white"
                            }`}
                          >
                            {isPackshot ? "⭐ Packshot" : isVideo ? "🎥 Video" : `Gallery #${media.position + 1}`}
                          </span>
                        </div>

                        {/* Hover Quick Action Buttons Overlay */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => setLightboxIndex(mIdx)}
                            className="p-2.5 rounded-xl bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white hover:scale-105 transition-transform shadow-md cursor-pointer text-xs font-semibold flex items-center gap-1"
                            title="Expand Preview"
                          >
                            <span>🔍</span>
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadAsset(
                                media.url,
                                `${product.sku || "product"}_${media.type}_${media.position + 1}.${
                                  media.url.includes(".png") ? "png" : media.url.includes(".svg") ? "svg" : isVideo ? "mp4" : "jpg"
                                }`
                              )
                            }
                            className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 transition-all shadow-md cursor-pointer text-xs font-semibold flex items-center gap-1"
                            title="Download High-Res Asset"
                          >
                            <span>⬇️</span>
                            <span>Download</span>
                          </button>
                        </div>
                      </div>

                      {/* Bottom Info Bar */}
                      <div className="p-3 flex items-center justify-between gap-2 border-t border-zinc-150/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {media.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider truncate">
                            {media.category} · High-Res
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadAsset(
                              media.url,
                              `${product.sku || "product"}_${media.type}_${media.position + 1}.${
                                media.url.includes(".png") ? "png" : media.url.includes(".svg") ? "svg" : isVideo ? "mp4" : "jpg"
                              }`
                            )
                          }
                          aria-label={`Download ${media.title}`}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Download Asset"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Panel: Customer Page & QR (Coming Soon Placeholder) */}
        {activeTab === "customer_qr" && (
          <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 sm:p-14 shadow-xs text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-3xl mx-auto shadow-xs">
                📱
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60">
                  <span>⚡</span>
                  <span>Feature in Preparation</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  Customer Page & QR Code — Coming Soon
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Smart digital shelf QR codes, verified consumer reviews, compliance disclosures, and interactive product storytelling pages are currently being prepared in the Admin catalog.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap justify-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-mono">
                  SKU: {product.sku}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-mono">
                  Brand: {product.brandName}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxIndex !== null && filteredMedia[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white">
                  {filteredMedia[lightboxIndex].title}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  ({lightboxIndex + 1} / {filteredMedia.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadAsset(
                      filteredMedia[lightboxIndex].url,
                      `${product.sku || "product"}_${filteredMedia[lightboxIndex].type}_${lightboxIndex + 1}.${
                        filteredMedia[lightboxIndex].url.includes(".png")
                          ? "png"
                          : filteredMedia[lightboxIndex].url.includes(".svg")
                          ? "svg"
                          : filteredMedia[lightboxIndex].type === "video"
                          ? "mp4"
                          : "jpg"
                      }`
                    )
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>⬇️</span>
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  aria-label="Close Preview"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Image / Video Display */}
            <div className="relative flex-1 min-h-[360px] sm:min-h-[500px] flex items-center justify-center p-4 bg-zinc-950 overflow-hidden">
              {filteredMedia[lightboxIndex].type === "video" ? (
                <video
                  src={filteredMedia[lightboxIndex].url}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-lg"
                />
              ) : (
                <img
                  src={filteredMedia[lightboxIndex].url}
                  alt={filteredMedia[lightboxIndex].title}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              )}

              {/* Navigation Chevrons */}
              {filteredMedia.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) =>
                        prev !== null && prev > 0 ? prev - 1 : filteredMedia.length - 1
                      );
                    }}
                    aria-label="Previous Asset"
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-transform hover:scale-110 cursor-pointer shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) =>
                        prev !== null && prev < filteredMedia.length - 1 ? prev + 1 : 0
                      );
                    }}
                    aria-label="Next Asset"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-transform hover:scale-110 cursor-pointer shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
              <span>{filteredMedia[lightboxIndex].category} · High Resolution</span>
              <a
                href={filteredMedia[lightboxIndex].url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
              >
                <span>Open Original in New Tab</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
