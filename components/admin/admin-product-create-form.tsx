"use client";

import React, { useState, useEffect, useTransition, useActionState, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@/lib/product/types";
import { adminCreateProduct, type AdminProductFormState } from "@/lib/product/admin-actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-indigo-500";
const labelClass = "block text-sm font-semibold text-zinc-700 dark:text-zinc-300";

interface CompanyItem {
  id: string;
  name: string;
}

interface BrandItem {
  id: string;
  name: string;
  company_id: string;
}

interface AdminProductCreateFormProps {
  companies: CompanyItem[];
  brands: BrandItem[];
}

export function AdminProductCreateForm({ companies, brands }: AdminProductCreateFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AdminProductFormState, FormData>(
    adminCreateProduct,
    undefined
  );

  // States
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [filteredBrands, setFilteredBrands] = useState<BrandItem[]>([]);
  const [brandId, setBrandId] = useState("");

  const [category, setCategory] = useState("skincare");
  const [manufactureSku, setManufactureSku] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [upc, setUpc] = useState("");
  const [ean, setEan] = useState("");

  const [priceKrwRetail, setPriceKrwRetail] = useState("");
  const [priceUsdFob, setPriceUsdFob] = useState("");

  const [sellingOnline, setSellingOnline] = useState(false);
  const [sellingOffline, setSellingOffline] = useState(false);
  const [salesLink1, setSalesLink1] = useState("");
  const [salesLink2, setSalesLink2] = useState("");

  // Dimensions & Weight Sync
  const [packageWidth, setPackageWidth] = useState("");
  const [packageWidthInch, setPackageWidthInch] = useState("");
  const [packageDepth, setPackageDepth] = useState("");
  const [packageDepthInch, setPackageDepthInch] = useState("");
  const [packageHeight, setPackageHeight] = useState("");
  const [packageHeightInch, setPackageHeightInch] = useState("");
  const [packageWeight, setPackageWeight] = useState("");
  const [packageWeightLb, setPackageWeightLb] = useState("");
  const [packageWeightOz, setPackageWeightOz] = useState("");

  // Filter brands based on companyId
  useEffect(() => {
    if (companyId) {
      const filtered = brands.filter((b) => b.company_id === companyId);
      setFilteredBrands(filtered);
      if (filtered.length > 0) {
        setBrandId(filtered[0].id);
      } else {
        setBrandId("");
      }
    } else {
      setFilteredBrands([]);
      setBrandId("");
    }
  }, [companyId, brands]);

  // Dimension/Weight conversion handlers
  const handleWidthCmChange = (val: string) => {
    setPackageWidth(val);
    if (val === "") {
      setPackageWidthInch("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        setPackageWidthInch((num / 2.54).toFixed(2));
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
        setPackageDepthInch((num / 2.54).toFixed(2));
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
        setPackageHeightInch((num / 2.54).toFixed(2));
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!brandId) {
      alert("등록할 브랜드를 지정해야 합니다. 브랜드가 없다면 먼저 브랜드를 생성해 주세요.");
      return;
    }
    if (!upc.trim() && !ean.trim()) {
      alert("UPC 또는 EAN 번호 중 최소 하나는 반드시 입력해야 합니다.");
      return;
    }
    if (upc.trim() && ean.trim()) {
      alert("UPC와 EAN 번호는 동시에 입력할 수 없습니다. 둘 중 하나만 입력해 주세요.");
      return;
    }
    if (sellingOnline && !salesLink1.trim()) {
      alert("온라인 판매 중인 경우, 최소 한 개 이상의 온라인 판매 링크(링크 1)를 입력해 주세요.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("sellingOnline", sellingOnline ? "true" : "false");
    formData.set("sellingOffline", sellingOffline ? "true" : "false");

    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* 1. 회사 및 브랜드 지정 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          1. 회사 및 브랜드 지정
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="companyId" className={labelClass}>
              회사 선택 *
            </label>
            <select
              id="companyId"
              name="companyId"
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={inputClass}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="brandId" className={labelClass}>
              브랜드 선택 *
            </label>
            <select
              id="brandId"
              name="brandId"
              required
              value={brandId}
              disabled={filteredBrands.length === 0}
              onChange={(e) => setBrandId(e.target.value)}
              className={inputClass}
            >
              {filteredBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            {filteredBrands.length === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold mt-1">
                ※ 선택한 회사에 등록된 브랜드가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. 제품 기본 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          2. 제품 기본 정보
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <div>
          <label htmlFor="nameEn" className={labelClass}>
            영문 제품명 *
          </label>
          <input
            id="nameEn"
            name="nameEn"
            required
            placeholder="예: Best Aloe Vera Soothing Gel Pouch"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="upc" className={labelClass}>
              미국 바코드 (UPC)
            </label>
            <input
              id="upc"
              name="upc"
              placeholder="12자리 미국 바코드 규격"
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="ean" className={labelClass}>
              유럽/글로벌 바코드 (EAN)
            </label>
            <input
              id="ean"
              name="ean"
              placeholder="13자리 글로벌 바코드 규격"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
          ※ UPC 또는 EAN 번호 중 최소 하나는 입력되어야 하며, 두 값을 동시에 등록할 수 없습니다.
        </p>
      </div>

      {/* 3. 가격 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          3. 가격 정보
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

      {/* 4. 판매 채널 및 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          4. 판매 채널 및 정보
        </h2>

        <div className="flex gap-6 py-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sellingOnline}
              onChange={(e) => setSellingOnline(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
            />
            온라인 판매 중 (Online)
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sellingOffline}
              onChange={(e) => setSellingOffline(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
            />
            오프라인 판매 중 (Offline)
          </label>
        </div>

        {sellingOnline && (
          <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/10 transition-all">
            <div>
              <label htmlFor="salesLink1" className={labelClass}>
                온라인 판매 링크 1 *
              </label>
              <input
                id="salesLink1"
                name="salesLink1"
                type="url"
                required={sellingOnline}
                placeholder="https://example.com/product/1"
                value={salesLink1}
                onChange={(e) => setSalesLink1(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="salesLink2" className={labelClass}>
                온라인 판매 링크 2 (선택)
              </label>
              <input
                id="salesLink2"
                name="salesLink2"
                type="url"
                placeholder="https://example.com/product/2"
                value={salesLink2}
                onChange={(e) => setSalesLink2(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. 단품 포장 패키지 정보 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-800">
          5. 단품 포장 패키지 정보 (배송 규격)
        </h2>

        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic leading-normal -mt-2">
          ※ cm/g 또는 inch/lb/oz 단위 중 편리한 쪽에 입력하시면 반대편 단위의 칸이 실시간으로 소수점 자동 계산됩니다.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Width */}
          <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">가로 (Width) *</label>
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
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">세로 (Depth) *</label>
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
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">높이 (Height) *</label>
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
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">무게 (Weight) *</label>
            <div className="grid grid-cols-3 gap-2">
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
      <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="submit"
          disabled={pending || !brandId}
          className="rounded-xl bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-5 py-2.5 text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {pending ? "등록 중..." : "제품 등록"}
        </button>

        <Link
          href="/admin/products"
          className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
