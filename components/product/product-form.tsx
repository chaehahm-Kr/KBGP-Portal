"use client";

import React, { useState, useRef, useTransition, useActionState, startTransition } from "react";
import type { ProductFormState } from "@/lib/product/actions";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";
const labelClass = "block text-sm font-semibold text-zinc-700 dark:text-zinc-300";

type ProductFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  brands: { id: string; name: string }[];
};

export function ProductForm({ action, brands }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<
    ProductFormState,
    FormData
  >(action, undefined);

  // Form field state for change detection (isDirty)
  const [brandId, setBrandId] = useState(brands[0]?.id || "");
  const [manufactureSku, setManufactureSku] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState("skincare");
  const [priceKrwRetail, setPriceKrwRetail] = useState("");
  const [priceUsdFob, setPriceUsdFob] = useState("");
  
  // Dimensions & weight with metric-imperial sync
  const [packageWidth, setPackageWidth] = useState("");
  const [packageWidthInch, setPackageWidthInch] = useState("");
  const [packageDepth, setPackageDepth] = useState("");
  const [packageDepthInch, setPackageDepthInch] = useState("");
  const [packageHeight, setPackageHeight] = useState("");
  const [packageHeightInch, setPackageHeightInch] = useState("");
  const [packageWeight, setPackageWeight] = useState("");
  const [packageWeightLb, setPackageWeightLb] = useState("");
  const [packageWeightOz, setPackageWeightOz] = useState("");

  const [submitActionVal, setSubmitActionVal] = useState("continue");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const listSubmitBtnRef = useRef<HTMLButtonElement>(null);

  // Sync handers
  const handleWidthCmChange = (val: string) => {
    setPackageWidth(val);
    if (val === "") {
      setPackageWidthInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageWidthInch((num * 0.393701).toFixed(2));
      }
    }
  };

  const handleWidthInchChange = (val: string) => {
    setPackageWidthInch(val);
    if (val === "") {
      setPackageWidth("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageWidth((num * 2.54).toFixed(1));
      }
    }
  };

  const handleDepthCmChange = (val: string) => {
    setPackageDepth(val);
    if (val === "") {
      setPackageDepthInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageDepthInch((num * 0.393701).toFixed(2));
      }
    }
  };

  const handleDepthInchChange = (val: string) => {
    setPackageDepthInch(val);
    if (val === "") {
      setPackageDepth("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageDepth((num * 2.54).toFixed(1));
      }
    }
  };

  const handleHeightCmChange = (val: string) => {
    setPackageHeight(val);
    if (val === "") {
      setPackageHeightInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageHeightInch((num * 0.393701).toFixed(2));
      }
    }
  };

  const handleHeightInchChange = (val: string) => {
    setPackageHeightInch(val);
    if (val === "") {
      setPackageHeight("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageHeight((num * 2.54).toFixed(1));
      }
    }
  };

  const handleWeightGChange = (val: string) => {
    setPackageWeight(val);
    if (val === "") {
      setPackageWeightLb("");
      setPackageWeightOz("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageWeightLb((num * 0.00220462).toFixed(3));
        setPackageWeightOz((num * 0.035274).toFixed(2));
      }
    }
  };

  const handleWeightLbChange = (val: string) => {
    setPackageWeightLb(val);
    if (val === "") {
      setPackageWeight("");
      setPackageWeightOz("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageWeight((num * 453.59237).toFixed(1));
        setPackageWeightOz((num * 16).toFixed(2));
      }
    }
  };

  const handleWeightOzChange = (val: string) => {
    setPackageWeightOz(val);
    if (val === "") {
      setPackageWeight("");
      setPackageWeightLb("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageWeight((num * 28.349523).toFixed(1));
        setPackageWeightLb((num * 0.0625).toFixed(3));
      }
    }
  };

  const isDirty =
    manufactureSku.trim() !== "" ||
    nameEn.trim() !== "" ||
    priceKrwRetail !== "" ||
    priceUsdFob !== "" ||
    packageWidth !== "" ||
    packageDepth !== "" ||
    packageHeight !== "" ||
    packageWeight !== "";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(() => {
      formAction(formData);
    });
  };

  const handleExitClick = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      window.location.href = "/portal/products";
    }
  };

  const handleSaveAndExit = () => {
    setShowExitConfirm(false);
    setSubmitActionVal("list");
    setTimeout(() => {
      listSubmitBtnRef.current?.click();
    }, 50);
  };

  const handleDiscardAndExit = () => {
    window.location.href = "/portal/products";
  };

  return (
    <div className="relative">
      {/* Exit (X) Button */}
      <button
        type="button"
        onClick={handleExitClick}
        className="absolute -top-3 right-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer"
        aria-label="나가기"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        {/* Hidden inputs to pass action state */}
        <input type="hidden" name="submitAction" value={submitActionVal} />

        {/* Section 1: 기본 정보 */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
            1. 제품 기본 정보
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="brandId" className={labelClass}>
                브랜드 *
              </label>
              <select
                id="brandId"
                name="brandId"
                required
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className={inputClass}
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="category" className={labelClass}>
                카테고리 *
              </label>
              <select
                id="category"
                name="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {(Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]).map((value) => (
                  <option key={value} value={value}>
                    {PRODUCT_CATEGORY_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="manufactureSku" className={labelClass}>
                제조사 SKU (Manufacture SKU) *
              </label>
              <input
                id="manufactureSku"
                name="manufactureSku"
                required
                placeholder="예: ABC-123-001"
                value={manufactureSku}
                onChange={(e) => setManufactureSku(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label htmlFor="nameEn" className={labelClass}>
                제품명 (영문) *
              </label>
              <input
                id="nameEn"
                name="nameEn"
                required
                placeholder="예: Best Sun Block"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Section 2: 가격 정보 */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800 flex items-center">
            <span>2. 가격 정보</span>
            <div className="relative group inline-block ml-1.5 cursor-help">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-zinc-200 text-zinc-650 text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-450 hover:bg-zinc-300 transition-colors">?</span>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 hidden group-hover:block bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] rounded-lg p-2 shadow-lg z-50 leading-relaxed font-normal normal-case">
                한국 시장 판매 가격 및 수출 거래 시 기준이 되는 1개당 FOB 공급 가격 정보입니다.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-950 dark:border-t-white"></div>
              </div>
            </div>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="priceKrwRetail" className={labelClass}>
                한국 소비자 판매가 (₩, Retail KRW) *
              </label>
              <input
                id="priceKrwRetail"
                name="priceKrwRetail"
                type="number"
                required
                placeholder="예: 25000"
                value={priceKrwRetail}
                onChange={(e) => setPriceKrwRetail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="priceUsdFob" className={labelClass}>
                미국 수출 FOB 가격 ($, Export USD FOB) *
              </label>
              <input
                id="priceUsdFob"
                name="priceUsdFob"
                type="number"
                step="0.01"
                required
                placeholder="예: 12.50"
                value={priceUsdFob}
                onChange={(e) => setPriceUsdFob(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Section 3: 제품 패키지 정보 */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800 flex items-center">
            <span>3. 단품 포장 패키지 정보 (배송 규격)</span>
            <div className="relative group inline-block ml-1.5 cursor-help">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-zinc-200 text-zinc-650 text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-450 hover:bg-zinc-300 transition-colors">?</span>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 hidden group-hover:block bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] rounded-lg p-3 shadow-lg z-50 leading-relaxed font-normal normal-case">
                실제 제품 1개가 포장 박스에 포장된 최종 배송 규격을 기재해주세요. 가로, 세로, 높이 및 무게 중 미터법(cm/g) 또는 야드파운드법(inch/lb/oz) 어느 단위로 입력하시더라도 반대 단위로 자동 계산하여 동기화해 줍니다.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-950 dark:border-t-white"></div>
              </div>
            </div>
          </h2>
          
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic leading-normal -mt-2">
            ※ cm/g 또는 inch/lb/oz 단위 중 편리한 쪽에 입력하시면 반대편 단위의 칸이 실시간으로 소수점 자동 계산됩니다.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Width */}
            <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">가로 (Width, cm/inch) *</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                  <input
                    name="packageWidth"
                    type="number"
                    step="0.1"
                    required
                    placeholder="0.0"
                    value={packageWidth}
                    onChange={(e) => handleWidthCmChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동 계산)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageWidthInch}
                    onChange={(e) => handleWidthInchChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Depth */}
            <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">세로 (Depth, cm/inch) *</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                  <input
                    name="packageDepth"
                    type="number"
                    step="0.1"
                    required
                    placeholder="0.0"
                    value={packageDepth}
                    onChange={(e) => handleDepthCmChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동 계산)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageDepthInch}
                    onChange={(e) => handleDepthInchChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Height */}
            <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">높이 (Height, cm/inch) *</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                  <input
                    name="packageHeight"
                    type="number"
                    step="0.1"
                    required
                    placeholder="0.0"
                    value={packageHeight}
                    onChange={(e) => handleHeightCmChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동 계산)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageHeightInch}
                    onChange={(e) => handleHeightInchChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Weight */}
            <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">무게 (Weight, g/lb/oz) *</label>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[9px] text-zinc-400 font-semibold block">g</span>
                  <input
                    name="packageWeight"
                    type="number"
                    step="0.1"
                    required
                    placeholder="0.0"
                    value={packageWeight}
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
                    value={packageWeightLb}
                    onChange={(e) => handleWeightLbChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">oz (자동)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packageWeightOz}
                    onChange={(e) => handleWeightOzChange(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {state?.error && (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-450" role="alert">
            {state.error}
          </p>
        )}

        {/* Form Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="submit"
            disabled={pending}
            onClick={() => setSubmitActionVal("continue")}
            className="rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-zinc-855 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
          >
            {pending && submitActionVal === "continue" ? "등록 중..." : "제품 등록 및 계속"}
          </button>
          
          <button
            type="submit"
            formNoValidate
            disabled={pending}
            onClick={() => setSubmitActionVal("list")}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
          >
            {pending && submitActionVal === "list" ? "저장 중..." : "임시 저장 후 나중에 등록"}
          </button>

          {/* Hidden button for triggering list submit bypass validation inside exit dialog */}
          <button
            ref={listSubmitBtnRef}
            type="submit"
            formNoValidate
            name="submitAction"
            value="list"
            className="hidden"
          />
        </div>
      </form>

      {/* Exit confirmation modal overlay */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">등록 취소 확인</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-455 leading-relaxed">
              작성 중인 제품 정보가 있습니다. 어떻게 하시겠습니까?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="w-full rounded-lg bg-zinc-950 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-850 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                임시 저장 후 나가기
              </button>
              <button
                type="button"
                onClick={handleDiscardAndExit}
                className="w-full rounded-lg bg-rose-50 border border-rose-200 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/30 cursor-pointer"
              >
                입력 내용 삭제하고 나가기
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full rounded-lg border border-zinc-200 py-2 text-xs font-semibold text-zinc-655 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
              >
                취소 (계속 작성)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
