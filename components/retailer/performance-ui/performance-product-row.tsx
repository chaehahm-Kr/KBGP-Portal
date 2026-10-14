"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PerformanceProductRowProps } from "./types";
import { DataReliabilityBadge } from "./data-reliability-badge";

export function PerformanceProductRow({
  product,
  onSelectProduct,
  onAddToCartPlaceholder,
}: PerformanceProductRowProps) {
  const [imgError, setImgError] = useState(false);

  const {
    productId,
    productName,
    productNameEn,
    brandName,
    sku,
    thumbnailUrl,
    categoryLabel,
    cartonPackQty,
    periodEstUnitsSold,
    periodEstRetailSales,
    periodEstGrossProfit,
    periodEstGrossMargin,
    financialState,
    reportedStock,
    incomingQty,
    avgWeeklySales,
    coverageTarget,
    suggestedReorderQty,
    suggestedCases,
    reorderSignal,
  } = product;

  const handleRowClick = () => {
    if (onSelectProduct) {
      onSelectProduct(productId);
    }
  };

  return (
    <>
      {/* Desktop Table Row */}
      <tr
        onClick={handleRowClick}
        className="hidden md:table-row hover:bg-zinc-800/40 cursor-pointer transition-colors border-b border-zinc-800/60"
      >
        {/* Product Identity */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-3">
            {/* Thumbnail with robust fallback */}
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
              {thumbnailUrl && !imgError ? (
                <Image
                  src={thumbnailUrl}
                  alt={productName}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-xs font-bold text-zinc-400 uppercase">
                  {brandName.slice(0, 2) || "KS"}
                </span>
              )}
            </div>

            <div className="space-y-0.5 max-w-[200px]">
              <div className="text-xs font-semibold text-white truncate" title={productName}>
                {productName}
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
                <span className="font-mono text-zinc-300">{sku}</span>
                <span>·</span>
                <span>{brandName}</span>
              </div>
            </div>
          </div>
        </td>

        {/* Est. Units Sold */}
        <td className="py-3 px-3 text-right">
          {periodEstUnitsSold !== null ? (
            <span className="text-xs font-bold text-zinc-100">
              {periodEstUnitsSold.toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-zinc-500 italic">No Data</span>
          )}
        </td>

        {/* Est. Retail Sales */}
        <td className="py-3 px-3 text-right">
          {periodEstRetailSales !== null ? (
            <span className="text-xs font-bold text-zinc-100">
              ${periodEstRetailSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-xs text-zinc-500 italic">N/A</span>
          )}
        </td>

        {/* Est. Gross Profit & Margin */}
        <td className="py-3 px-3 text-right">
          {periodEstGrossProfit !== null ? (
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-teal-400">
                ${periodEstGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {periodEstGrossMargin !== null && (
                <span className="text-[10px] text-zinc-400 font-medium">
                  {periodEstGrossMargin.toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-zinc-500 italic">N/A</span>
          )}
        </td>

        {/* Reported Stock */}
        <td className="py-3 px-3 text-right">
          {reportedStock !== null ? (
            <span className="text-xs font-medium text-zinc-200">{reportedStock}</span>
          ) : (
            <span className="text-xs text-zinc-500 italic">Unreported</span>
          )}
        </td>

        {/* Incoming Qty */}
        <td className="py-3 px-3 text-right">
          {incomingQty > 0 ? (
            <span className="text-xs font-bold text-amber-400">+{incomingQty}</span>
          ) : (
            <span className="text-xs text-zinc-500">0</span>
          )}
        </td>

        {/* Avg Weekly Sales */}
        <td className="py-3 px-3 text-right">
          {avgWeeklySales !== null ? (
            <span className="text-xs font-medium text-zinc-300">{avgWeeklySales}/wk</span>
          ) : (
            <span className="text-xs text-zinc-500">—</span>
          )}
        </td>

        {/* Reorder Recommendation */}
        <td className="py-3 px-3 text-right">
          {reorderSignal === "insufficient_data" ? (
            <span className="text-xs text-zinc-500 italic">Insufficient Data</span>
          ) : suggestedReorderQty > 0 ? (
            <div className="flex flex-col items-end">
              <span className="text-xs font-extrabold text-indigo-400">
                {suggestedReorderQty} units
              </span>
              <span className="text-[10px] text-zinc-400">
                ({suggestedCases} {suggestedCases === 1 ? "case" : "cases"})
              </span>
            </div>
          ) : (
            <span className="text-xs text-emerald-400/80 font-medium">Adequate (0)</span>
          )}
        </td>

        {/* Status Badge */}
        <td className="py-3 px-3 text-center">
          <DataReliabilityBadge signal={reorderSignal} size="sm" />
        </td>
      </tr>

      {/* Mobile Card Row */}
      <tr className="md:hidden border-b border-zinc-800">
        <td colSpan={9} className="p-3">
          <div
            onClick={handleRowClick}
            className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-3.5 space-y-3 cursor-pointer hover:border-zinc-700 transition-colors"
          >
            {/* Header: Thumbnail, Name, Badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                  {thumbnailUrl && !imgError ? (
                    <Image
                      src={thumbnailUrl}
                      alt={productName}
                      width={44}
                      height={44}
                      className="object-cover w-full h-full"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="text-xs font-bold text-zinc-400 uppercase">
                      {brandName.slice(0, 2) || "KS"}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white line-clamp-1">{productName}</div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <span className="font-mono text-zinc-300">{sku}</span>
                    <span>·</span>
                    <span>{brandName}</span>
                  </div>
                </div>
              </div>
              <DataReliabilityBadge signal={reorderSignal} size="sm" />
            </div>

            {/* Metrics Matrix */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/60 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 block">Est. Sold</span>
                <span className="font-bold text-zinc-100">
                  {periodEstUnitsSold !== null ? `${periodEstUnitsSold} units` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Est. Sales</span>
                <span className="font-bold text-zinc-100">
                  {periodEstRetailSales !== null ? `$${periodEstRetailSales.toFixed(0)}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Gross Profit</span>
                <span className="font-bold text-teal-400">
                  {periodEstGrossProfit !== null ? `$${periodEstGrossProfit.toFixed(0)}` : "—"}
                </span>
              </div>
            </div>

            {/* Stock & Reorder Bottom Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs bg-zinc-800/30 -mx-3.5 -mb-3.5 p-3 rounded-b-xl">
              <div className="flex items-center gap-3 text-[11px]">
                <span>
                  Stock: <strong className="text-zinc-200">{reportedStock !== null ? reportedStock : "N/R"}</strong>
                </span>
                <span>
                  Incoming:{" "}
                  <strong className={incomingQty > 0 ? "text-amber-400" : "text-zinc-400"}>
                    +{incomingQty}
                  </strong>
                </span>
              </div>
              <div>
                {suggestedReorderQty > 0 ? (
                  <span className="text-xs font-bold text-indigo-400">
                    Order: {suggestedReorderQty} units
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-400/80 font-medium">Adequate</span>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
