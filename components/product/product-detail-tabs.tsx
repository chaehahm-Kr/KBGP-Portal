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
  removeProductVideo,
  uploadIngredientsFile,
  deleteIngredientsFile,
  updateProductImagesOrder
} from "@/lib/product/actions";
import { ConfirmForm } from "@/components/common/confirm-form";
import { AddCertificateForm } from "@/components/product/add-certificate-form";

interface ProductDetailTabsProps {
  product: Product;
  brandName: string;
  brands: { id: string; name: string }[];
  imageRows: { id: string; storage_path: string }[];
  imageUrls: (string | null)[];
  videoRows: ProductVideo[];
  videoUrls: (string | null)[];
  certificateRows: { id: string; certificate_type: string; storage_path: string; original_filename: string | null; version: number }[];
  certificateUrls: (string | null)[];
  ingredientsFileUrl: string | null;
  ingredientsFileUrlEn: string | null;
}

export function ProductDetailTabs({
  product,
  brandName,
  brands,
  imageRows,
  imageUrls,
  videoRows,
  videoUrls,
  certificateRows,
  certificateUrls,
  ingredientsFileUrl,
  ingredientsFileUrlEn,
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "price" | "logistics" | "media" | "certs">("basic");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Read admin overrides (specifically for Letusto SKU)
  const adminOverrides = (product.price_additional_info as any)?.admin_overrides || {};
  const effectiveLetustoSku = adminOverrides.letusto_sku || product.letusto_sku || "";
  const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : product.manufacture_sku || "";

  // Resolve effective parent/child SKU (considering admin overrides)
  const getInitialParentState = () => {
    const ov = adminOverrides.parent_sku;
    if (ov === "Y") return true;
    if (ov === "N" || ov === "none") return false;
    return product.parent_sku === "Y" || product.parent_sku === "true" || product.parent_sku === "yes";
  };

  const getInitialChildState = () => {
    const ov = adminOverrides.child_sku;
    if (ov === "Y") return true;
    if (ov === "N" || ov === "none") return false;
    return product.child_sku === "Y" || product.child_sku === "true" || product.child_sku === "yes";
  };

  const [isParentSku, setIsParentSku] = useState(getInitialParentState());
  const [isChildSku, setIsChildSku] = useState(getInitialChildState());

  // Parse lead time value and unit
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

  const parsedLeadTime = parseLeadTime(product.lead_time);

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

  const [packageWidthInch, setPackageWidthInch] = useState(
    product.package_width ? (product.package_width * 0.393701).toFixed(2) : ""
  );
  const [packageDepthInch, setPackageDepthInch] = useState(
    product.package_depth ? (product.package_depth * 0.393701).toFixed(2) : ""
  );
  const [packageHeightInch, setPackageHeightInch] = useState(
    product.package_height ? (product.package_height * 0.393701).toFixed(2) : ""
  );
  const [packageWeightLb, setPackageWeightLb] = useState(
    product.package_weight ? (product.package_weight * 0.00220462).toFixed(3) : ""
  );
  const [packageWeightOz, setPackageWeightOz] = useState(
    product.package_weight ? (product.package_weight * 0.035274).toFixed(2) : ""
  );

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

  // FOB price state for dynamic discount calculations
  const [priceUsdFobState, setPriceUsdFobState] = useState(product.price_usd_fob || 0);

  // Video Inputs
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoFilePending, setVideoFilePending] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Tiered Pricing State
  const [priceTiers, setPriceTiers] = useState<{ qty: number; price: number }[]>(() => {
    const additionalInfo = product.price_additional_info as Record<string, any> | null;
    if (additionalInfo && Array.isArray(additionalInfo.price_tiers)) {
      return additionalInfo.price_tiers;
    }
    return [];
  });

  // Ingredients File State (Korean)
  const [ingredientsFilePendingKo, setIngredientsFilePendingKo] = useState(false);
  const [ingredientsErrorKo, setIngredientsErrorKo] = useState<string | null>(null);

  // New Selling States
  const [sellingOnline, setSellingOnline] = useState(!!product.selling_online);
  const [sellingOffline, setSellingOffline] = useState(!!product.selling_offline);
  const [salesLink1, setSalesLink1] = useState(product.sales_link_1 || "");
  const [salesLink2, setSalesLink2] = useState(product.sales_link_2 || "");

  // Required Fields States for reactive validation
  const [nameEn, setNameEn] = useState(product.name_en || "");
  const [manufactureSku, setManufactureSku] = useState(effectiveManufactureSku || "");
  const [brandId, setBrandId] = useState(product.brand_id || "");
  const [category, setCategory] = useState(product.category || "");
  const [origin, setOrigin] = useState(product.origin || "");
  const [priceKrwRetail, setPriceKrwRetail] = useState(product.price_krw_retail?.toString() || "");
  const [priceUsdFob, setPriceUsdFob] = useState(product.price_usd_fob?.toString() || "");
  const [upc, setUpc] = useState(product.upc || "");
  const [ean, setEan] = useState(product.ean || "");

  const getMissingFieldsList = () => {
    const missing = [];
    
    // Basic Info tab
    if (!brandId) missing.push({ tab: "basic", field: "브랜드", inputName: "brandId" });
    if (!category) missing.push({ tab: "basic", field: "카테고리", inputName: "category" });
    if (!nameEn.trim()) missing.push({ tab: "basic", field: "영문 제품명", inputName: "nameEn" });
    if (!manufactureSku.trim()) missing.push({ tab: "basic", field: "제조사 SKU", inputName: "manufactureSku" });
    if (!origin) missing.push({ tab: "basic", field: "원산지", inputName: "origin" });
    
    const hasUpc = !!upc.trim();
    const hasEan = !!ean.trim();
    if (!hasUpc && !hasEan) {
      missing.push({ tab: "basic", field: "식별 바코드 (UPC 또는 EAN 중 최소 하나 필수)", inputName: "upc" });
    } else if (hasUpc && hasEan) {
      missing.push({ tab: "basic", field: "식별 바코드 (UPC와 EAN은 동시에 입력할 수 없습니다)", inputName: "upc" });
    }
    
    if (sellingOnline && !salesLink1.trim()) {
      missing.push({ tab: "basic", field: "온라인 판매 링크 1", inputName: "salesLink1" });
    }
    
    // Price Info tab
    const krw = Number(priceKrwRetail || 0);
    if (!priceKrwRetail || krw <= 0) {
      missing.push({ tab: "price", field: "한국 소비자 판매가", inputName: "priceKrwRetail" });
    }
    const usd = Number(priceUsdFob || 0);
    if (!priceUsdFob || usd <= 0) {
      missing.push({ tab: "price", field: "미국 수출 FOB 가격", inputName: "priceUsdFob" });
    }
    
    // Logistics tab
    const w = Number(packageWidth || 0);
    const d = Number(packageDepth || 0);
    const h = Number(packageHeight || 0);
    const wt = Number(packageWeight || 0);
    if (!packageWidth || w <= 0 || !packageDepth || d <= 0 || !packageHeight || h <= 0 || !packageWeight || wt <= 0) {
      missing.push({ tab: "logistics", field: "단품 포장 패키지 규격(가로/세로/높이/무게)", inputName: "packageWidth" });
    }
    
    return missing;
  };

  // Ingredients Text State & Translation Tool States
  const [ingredientsText, setIngredientsText] = useState(product.ingredients_text || "");
  const [transSourceText, setTransSourceText] = useState("");
  const [transTargetText, setTransTargetText] = useState("");
  const [transSourceLang, setTransSourceLang] = useState("ko");
  const [transTargetLang, setTransTargetLang] = useState("en");
  const [transPending, setTransPending] = useState(false);

  const handleTranslate = async () => {
    if (!transSourceText.trim()) return;
    setTransPending(true);
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          transSourceText.trim()
        )}&langpair=${transSourceLang}|${transTargetLang}`
      );
      if (!response.ok) throw new Error("Translation failed");
      const data = await response.json();
      const translation = data.responseData?.translatedText || "";
      setTransTargetText(translation);
    } catch (err) {
      console.error(err);
      alert("번역 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setTransPending(false);
    }
  };

  const handleApplyTranslation = () => {
    setIngredientsText(transTargetText);
  };

  // Product Images Drag & Drop Ordering State
  const [localImages, setLocalImages] = useState(() => {
    return imageRows.map((row, idx) => ({
      ...row,
      url: imageUrls[idx] || null
    }));
  });

  useEffect(() => {
    setLocalImages(
      imageRows.map((row, idx) => ({
        ...row,
        url: imageUrls[idx] || null
      }))
    );
  }, [imageRows, imageUrls]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const items = [...localImages];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setLocalImages(items);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    const orderedIds = localImages.map((img) => img.id);
    try {
      await updateProductImagesOrder(product.id, orderedIds);
    } catch (err: any) {
      alert(err.message || "이미지 순서 저장에 실패했습니다.");
    }
  };

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

  // Tiered Pricing Helpers
  const addPriceTier = () => setPriceTiers([...priceTiers, { qty: 100, price: 0 }]);
  const removePriceTier = (idx: number) => {
    setPriceTiers(priceTiers.filter((_, i) => i !== idx));
  };
  const updatePriceTier = (idx: number, field: "qty" | "price", val: number) => {
    const updated = [...priceTiers];
    updated[idx] = { ...updated[idx], [field]: val };
    setPriceTiers(updated);
  };

  const handleMainFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage(null);

    const missingList = getMissingFieldsList();
    if (missingList.length > 0) {
      const firstError = missingList[0];
      setActiveTab(firstError.tab as any);
      
      setTimeout(() => {
        const inputElement = document.getElementsByName(firstError.inputName)[0] as HTMLInputElement | undefined;
        if (inputElement) {
          inputElement.focus();
          if (inputElement.select) inputElement.select();
        }
      }, 80);

      setStatusMessage({ 
        type: "error", 
        text: `필수 정보가 누락되었거나 형식이 올바르지 않습니다: "${firstError.field}" 항목을 입력해 주세요.` 
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    
    const formData = new FormData(e.currentTarget);

    // Set checkboxes explicitly as strings for action validation
    formData.set("sellingOnline", sellingOnline ? "true" : "false");
    formData.set("sellingOffline", sellingOffline ? "true" : "false");
    formData.set("salesLink1", salesLink1.trim());
    formData.set("salesLink2", salesLink2.trim());
    
    // Explicitly set bound values in formData to ensure they are captured correctly
    formData.set("nameEn", nameEn.trim());
    formData.set("manufactureSku", manufactureSku.trim());
    formData.set("brandId", brandId);
    formData.set("category", category);
    formData.set("origin", origin);
    formData.set("upc", upc.trim());
    formData.set("ean", ean.trim());
    formData.set("priceKrwRetail", priceKrwRetail.trim());
    formData.set("priceUsdFob", priceUsdFob.trim());

    // Combine leadTimeValue and leadTimeUnit into leadTime
    const leadTimeVal = formData.get("leadTimeValue") || "";
    const leadTimeUnit = formData.get("leadTimeUnit") || "";
    if (leadTimeVal) {
      formData.set("leadTime", `${String(leadTimeVal).trim()} ${leadTimeUnit}`);
    } else {
      formData.set("leadTime", "");
    }
    // Append bullet points
    bullets.forEach((b) => {
      if (b.trim()) {
        formData.append("bulletPoints", b.trim());
      }
    });

    // Append price tiers JSON string
    formData.append("priceTiers", JSON.stringify(priceTiers));

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

  const handleIngredientsFileSubmitKo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIngredientsErrorKo(null);
    setIngredientsFilePendingKo(true);
    setStatusMessage(null);
    try {
      const fd = new FormData();
      fd.append("ingredientsFile", file);
      await uploadIngredientsFile(product.id, "ko", fd);
      setStatusMessage({ type: "success", text: "한글 성분 인증 문서가 성공적으로 첨부되었습니다." });
    } catch (err: any) {
      setIngredientsErrorKo(err.message || "파일 업로드에 실패했습니다.");
    } finally {
      setIngredientsFilePendingKo(false);
    }
  };

  const handleIngredientsFileDeleteKo = async () => {
    if (!window.confirm("정말 이 한글 성분 인증 문서를 삭제하시겠습니까?")) return;

    setIngredientsErrorKo(null);
    setIngredientsFilePendingKo(true);
    setStatusMessage(null);
    try {
      await deleteIngredientsFile(product.id, "ko");
      setStatusMessage({ type: "success", text: "한글 성분 인증 문서가 삭제되었습니다." });
    } catch (err: any) {
      setIngredientsErrorKo(err.message || "파일 삭제에 실패했습니다.");
    } finally {
      setIngredientsFilePendingKo(false);
    }
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
    <div className="space-y-6 w-full max-w-7xl">
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

      {/* Missing Fields Warning Banner */}
      {getMissingFieldsList().length > 0 && (
        <div className="rounded-xl border border-rose-250 bg-rose-50/40 p-5 dark:border-rose-950/30 dark:bg-rose-950/10 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-3 text-rose-800 dark:text-rose-400">
            <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold dark:bg-rose-900/50 dark:text-rose-300">!</span>
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-400">필수 정보 보완 필요 (Draft 상태)</h4>
              <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-455">
                본 제품은 필수 정보가 누락되어 있습니다. 다음 탭으로 이동하여 해당 항목들을 모두 입력하고 전체 변경사항을 저장해 주세요:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {getMissingFieldsList().map((item, idx) => (
                  <button 
                    key={idx} 
                    type="button"
                    onClick={() => {
                      setActiveTab(item.tab as any);
                      setTimeout(() => {
                        const inputElement = document.getElementsByName(item.inputName)[0] as HTMLInputElement | undefined;
                        if (inputElement) {
                          inputElement.focus();
                          if (inputElement.select) inputElement.select();
                        }
                      }, 80);
                    }}
                    className="inline-flex items-center rounded-md bg-rose-100/70 hover:bg-rose-150 px-2.5 py-1 text-[10px] font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40 transition-colors cursor-pointer"
                  >
                    [{item.tab === "basic" ? "기본 정보" : item.tab === "price" ? "가격 정보" : "로지스틱스"}] {item.field}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
                {product.manufacture_sku && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>제조사 SKU: <strong className="text-zinc-700 dark:text-zinc-300 font-mono font-bold">{product.manufacture_sku}</strong></span>
                  </>
                )}
                {effectiveLetustoSku && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Letusto SKU: <strong className="text-indigo-650 dark:text-indigo-400 font-mono font-bold">{effectiveLetustoSku}</strong></span>
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
          ].map((tab) => {
            const missingList = getMissingFieldsList();
            const hasError = missingList.some((item) => item.tab === tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                <span>{tab.label}</span>
                {hasError && (
                  <span 
                    className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" 
                    title="이 탭에 누락 정보 또는 유효성 오류가 있습니다."
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Panel 1: 기본 정보 */}
        <div className={activeTab === "basic" ? "space-y-6" : "hidden"}>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              제품 기본 사양
            </h2>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제조사 SKU (Manufacture SKU) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="manufactureSku"
                  type="text"
                  required
                  value={manufactureSku} onChange={(e) => setManufactureSku(e.target.value)}
                  placeholder="제조사의 실제 SKU 코드"
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none font-mono ${!manufactureSku.trim() ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Letusto SKU <span className="text-[10px] text-zinc-400 font-normal">(기준 고유 SKU)</span>
                </label>
                <input
                  name="letustoSku"
                  type="text"
                  readOnly
                  defaultValue={effectiveLetustoSku}
                  placeholder="지정 대기 중"
                  className="block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 font-mono cursor-not-allowed select-none focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제품명 (영문) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="nameEn"
                  type="text"
                  required
                  value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                  placeholder="English Product Name"
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none ${!nameEn.trim() ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">제품명 (한글)</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={product.name || ""}
                  placeholder="한글 제품명"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">브랜드 <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <select
                  name="brandId"
                  value={brandId} onChange={(e) => setBrandId(e.target.value)}
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none ${!brandId ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
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

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">카테고리 <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <select
                  name="category"
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none ${!category ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
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
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">원산지 (Origin) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <select
                  name="origin"
                  value={origin} onChange={(e) => setOrigin(e.target.value)}
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none ${!origin ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                >
                  <option value="">선택 안 함 (None)</option>
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

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">리드 타임 (Lead Time)</label>
                <div className="flex gap-2">
                  <input
                    name="leadTimeValue"
                    type="number"
                    defaultValue={parsedLeadTime.value}
                    placeholder="숫자 입력"
                    className="block w-2/3 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                  <select
                    name="leadTimeUnit"
                    defaultValue={parsedLeadTime.unit}
                    className="block w-1/3 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  >
                    <option value="일">일 (Days)</option>
                    <option value="주">주 (Weeks)</option>
                    <option value="개월">개월 (Months)</option>
                  </select>
                </div>
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
                <select
                  name="colorMap"
                  defaultValue={product.color_map || ""}
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
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
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder="영문 혹은 한국어 전성분 정보를 입력해주세요. 번역 도구를 사용하여 한글 전성분을 영문으로 번역하여 기입하실 수 있습니다."
                className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-y"
              />
            </div>

            {/* Ingredients Translation Helper */}
            <div className="bg-zinc-50/50 dark:bg-zinc-950/20 rounded-xl border border-zinc-200 dark:border-zinc-850 p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-850 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌐</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-250">전성분 자동 번역 도구 (Ingredients Translator)</span>
                </div>
                <span className="text-[10px] font-medium text-zinc-400">화장품/식품 원료 번역 도우미</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Source (왼쪽) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">원본 언어 (Source Language)</label>
                    <select
                      value={transSourceLang}
                      onChange={(e) => setTransSourceLang(e.target.value)}
                      className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700 focus:outline-none dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-350"
                    >
                      <option value="ko">한국어 (Korean)</option>
                      <option value="en">영어 (English)</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    value={transSourceText}
                    onChange={(e) => setTransSourceText(e.target.value)}
                    placeholder="번역할 전성분을 복사하여 입력해 주세요."
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                  />
                </div>

                {/* Target (오른쪽) */}
                <div className="space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">번역 결과 (Target Language)</label>
                    <select
                      value={transTargetLang}
                      onChange={(e) => setTransTargetLang(e.target.value)}
                      className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700 focus:outline-none dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-355"
                    >
                      <option value="en">영어 (English)</option>
                      <option value="ko">한국어 (Korean)</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    value={transTargetText}
                    onChange={(e) => setTransTargetText(e.target.value)}
                    placeholder="번역된 결과가 여기에 표시됩니다."
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={transPending}
                  className="w-full sm:w-auto rounded bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  {transPending ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>번역 중...</span>
                    </>
                  ) : (
                    <>
                      <span>번역하기 (Translate)</span>
                      <span>➔</span>
                    </>
                  )}
                </button>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleApplyTranslation}
                    disabled={!transTargetText.trim()}
                    className="w-full sm:w-auto rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 dark:hover:bg-indigo-950/80 cursor-pointer shadow-sm transition-colors text-center"
                  >
                    리뷰 완료 및 적용 (Apply to field)
                  </button>
                </div>
              </div>
            </div>


            <div className="border-t border-zinc-100 dark:border-zinc-850 pt-4 space-y-4">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">성분 인증 증빙 서류 첨부 (PDF 또는 이미지)</label>
              
              <div className="rounded-lg border border-zinc-150 p-4 dark:border-zinc-800 bg-zinc-50/20 space-y-2">
                {ingredientsErrorKo && (
                  <p className="text-xs font-semibold text-rose-600">{ingredientsErrorKo}</p>
                )}
                {ingredientsFileUrl ? (
                  <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-850 text-xs">
                    <a
                      href={ingredientsFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-900 dark:text-white font-bold underline hover:text-indigo-650 truncate"
                    >
                      성분 인증 서류 보기 ↗
                    </a>
                    <button
                      type="button"
                      disabled={ingredientsFilePendingKo}
                      onClick={handleIngredientsFileDeleteKo}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {ingredientsFilePendingKo ? "삭제 중..." : "파일 삭제"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={ingredientsFilePendingKo}
                      onChange={handleIngredientsFileSubmitKo}
                      className="block w-full text-xs text-zinc-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-350 hover:file:bg-zinc-200 cursor-pointer disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Identification Numbers Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              식별 관리 번호
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="hidden" name="parentSku" value={isParentSku ? "Y" : ""} />
                <input type="hidden" name="childSku" value={isChildSku ? "Y" : ""} />
                
                <div 
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none bg-white dark:bg-zinc-950/40 ${
                    isParentSku 
                      ? "border-indigo-600 ring-1 ring-indigo-600 dark:border-indigo-500 dark:ring-indigo-500" 
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  }`}
                  onClick={() => { 
                    const nextVal = !isParentSku;
                    setIsParentSku(nextVal); 
                    if (nextVal) setIsChildSku(false); 
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isParentSku}
                    onChange={(e) => {
                      setIsParentSku(e.target.checked);
                      if (e.target.checked) setIsChildSku(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold text-zinc-900 dark:text-white">Parent SKU (상위 대표 상품)</span>
                    <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">본 상품이 여러 옵션들을 대표하는 상위 상품인 경우 선택합니다.</span>
                  </div>
                </div>

                <div 
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none bg-white dark:bg-zinc-950/40 ${
                    isChildSku 
                      ? "border-indigo-600 ring-1 ring-indigo-600 dark:border-indigo-500 dark:ring-indigo-500" 
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  }`}
                  onClick={() => { 
                    const nextVal = !isChildSku;
                    setIsChildSku(nextVal); 
                    if (nextVal) setIsParentSku(false); 
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChildSku}
                    onChange={(e) => {
                      setIsChildSku(e.target.checked);
                      if (e.target.checked) setIsParentSku(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold text-zinc-900 dark:text-white">Child SKU (하위 옵션 상품)</span>
                    <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">본 상품이 상위 상품에 종속되는 개별 옵션 상품인 경우 선택합니다.</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">미국 바코드 (UPC) {!ean.trim() && <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span>}</label>
                <input
                  name="upc"
                  type="text"
                  value={upc} onChange={(e) => setUpc(e.target.value)}
                  placeholder="12자리 미국 바코드 규격"
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none font-mono ${(!upc.trim() && !ean.trim()) || (upc.trim() && ean.trim()) ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">유럽/글로벌 바코드 (EAN) {!upc.trim() && <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span>}</label>
                <input
                  name="ean"
                  type="text"
                  value={ean} onChange={(e) => setEan(e.target.value)}
                  placeholder="13자리 글로벌 바코드 규격"
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none font-mono ${(!upc.trim() && !ean.trim()) || (upc.trim() && ean.trim()) ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                />
              </div>
            </div>
          </div>

          {/* [신규 카드]: 판매 채널 및 정보 */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              현재 제품 판매 채널 및 링크
            </h2>
            <div className="flex gap-6 py-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sellingOnline}
                  onChange={(e) => setSellingOnline(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                온라인 판매 중 (Online)
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sellingOffline}
                  onChange={(e) => setSellingOffline(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                오프라인 판매 중 (Offline)
              </label>
            </div>

            {sellingOnline && (
              <div className="grid gap-6 md:grid-cols-2 p-4 rounded-lg border border-zinc-150 dark:border-zinc-850 bg-zinc-50/10">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    온라인 판매 링크 1 *
                  </label>
                  <input
                    type="url"
                    value={salesLink1}
                    onChange={(e) => setSalesLink1(e.target.value)}
                    placeholder="https://example.com/product/1"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    온라인 판매 링크 2 (선택)
                  </label>
                  <input
                    type="url"
                    value={salesLink2}
                    onChange={(e) => setSalesLink2(e.target.value)}
                    placeholder="https://example.com/product/2"
                    className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>
            )}
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
        {/* Tab Panel 2: 가격 정보 */}
        <div className={activeTab === "price" ? "space-y-6" : "hidden"}>
          {/* Reference Prices Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              참고 가격 정보 (Reference Prices)
            </h2>
            
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">한국 소비자가 (₩, Retail KRW) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-400">₩</span>
                  <input
                    name="priceKrwRetail"
                    type="number"
                    required
                    value={priceKrwRetail} onChange={(e) => setPriceKrwRetail(e.target.value)}
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
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">예상 미국 소비자가 ($, Retail USD)</label>
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

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">수출용 FOB 가격 ($, Export USD FOB) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-400">$</span>
                  <input
                    name="priceUsdFob"
                    type="number"
                    required
                    step="0.01"
                    value={priceUsdFobState || ""}
                    onChange={(e) => setPriceUsdFobState(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tiered Supply Prices Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-850">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  수량별 B2B 공급 가격 (Tiered Supply Prices)
                </h2>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">바이어가 발주하는 최소 수량에 따른 할인율 단가를 설정할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={addPriceTier}
                className="rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer transition-colors"
              >
                + 공급가 구간 추가
              </button>
            </div>

            {priceTiers.length === 0 ? (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 p-8 rounded-lg text-center">
                <p className="text-xs text-zinc-450 dark:text-zinc-500">등록된 수량별 B2B 공급가가 없습니다. 구간별 공급 단가를 설정하려면 우측 상단의 버튼을 클릭해 주세요.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left font-bold text-zinc-500 dark:text-zinc-400">최소 주문 수량 (Quantity, 개 이상)</th>
                      <th className="px-4 py-2 text-left font-bold text-zinc-500 dark:text-zinc-400">구간별 공급 단가 (Unit Price, $)</th>
                      <th className="px-4 py-2 text-center font-bold text-zinc-500 dark:text-zinc-400 w-24">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                    {priceTiers.map((tier, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={tier.qty}
                            onChange={(e) => updatePriceTier(idx, "qty", Number(e.target.value))}
                            placeholder="100"
                            className="block w-full max-w-[200px] rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative w-full max-w-[150px]">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-450">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tier.price}
                                onChange={(e) => updatePriceTier(idx, "price", Number(e.target.value))}
                                placeholder="0.00"
                                className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            {priceUsdFobState > 0 && tier.price > 0 && (
                              <span className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-bold ${
                                priceUsdFobState > tier.price
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900"
                                  : "bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-650 border border-zinc-150 dark:border-zinc-800"
                              }`}>
                                {priceUsdFobState > tier.price
                                  ? `${(((priceUsdFobState - tier.price) / priceUsdFobState) * 100).toFixed(1)}% 할인`
                                  : "0% 할인"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removePriceTier(idx)}
                            className="text-rose-500 hover:text-rose-700 font-bold px-3 py-1 cursor-pointer transition-colors"
                          >
                            제거
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Tab Panel 3: 로지스틱스 정보 */}
        {/* Tab Panel 3: 로지스틱스 정보 */}
        <div className={activeTab === "logistics" ? "space-y-6" : "hidden"}>
          {/* Item */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M28 20V12h8v8" strokeLinecap="round"/>
                <path d="M24 20h16v32a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V20z"/>
                <line x1="32" y1="6" x2="32" y2="12" strokeLinecap="round"/>
                <path d="M32 20v28" strokeDasharray="3 3"/>
                <circle cx="32" cy="36" r="3" fill="currentColor"/>
              </svg>
              <span>1. 단품 규격 (Item Spec)</span>
            </h2>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
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
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 12l16-6 16 6v36l-16 6-16-6V12z"/>
                  <path d="M16 12l16 6 16-6"/>
                  <path d="M32 18v38"/>
                  <path d="M16 22l16 6 16-6" opacity="0.6"/>
                </svg>
                <span>2. 단품 포장 패키지 규격 (Package Spec)</span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-450 text-[10px] font-normal leading-relaxed mt-1">
                ※ 본 제품이 포장 박스에 포장된 최종 배송 규격을 기재해주세요. 고객에게 발송될 때 박스에 들어가 있거나 포장 완료된 상태의 실 측정 크기(가로/세로/높이)와 무게(g) 정보입니다.
              </p>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              {/* Width */}
              <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">가로 (Width, cm/inch) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
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
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">세로 (Depth, cm/inch) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
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
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">높이 (Height, cm/inch) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
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
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">무게 (Weight, g/lb/oz) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
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

          {/* Carton */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 18l22-8 22 8v28l-22 8-22-8V18z"/>
                <path d="M10 18l22 8 22-8"/>
                <path d="M32 26v28"/>
                <path d="M32 10l11 4M32 10L21 14" opacity="0.8"/>
                <path d="M21 21.5l11 4 11-4" strokeDasharray="2 2"/>
              </svg>
              <span>3. 아웃 카톤 규격 (Carton Box Specs)</span>
            </h2>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">입수 수량 (Qty, 개) *</label>
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
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">중량 (Weight, kg)</label>
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
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">부피 (CBM)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    name="cartonCbm"
                    type="text"
                    readOnly
                    value={cartonCbm}
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-center bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:border-zinc-800 dark:text-white cursor-not-allowed outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Palette */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 50h48v4H8z"/>
                <path d="M14 50v4M32 50v4M50 50v4"/>
                <path d="M12 24h18v22H12zm22 6h18v16H34zM20 12h24v12H20z"/>
              </svg>
              <span>4. 팔레트 규격 (Palette Specs)</span>
            </h2>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">박스수량 (Cartons)</label>
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
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">중량 (Weight, kg)</label>
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

          {/* Container Simulation & Overrides */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-center border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div className="flex-1">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-4 text-indigo-500 shrink-0" viewBox="0 0 80 40" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 15l20-6 44 6v18l-40 6-24-6V15z"/>
                    <path d="M8 15l20 6 44-6"/>
                    <path d="M28 21v18"/>
                    <path d="M13 16.5v16.5M18 18v16M23 19.5v15.5" opacity="0.6"/>
                    <path d="M36 20v17M44 19v15M52 18v13M60 17v11" opacity="0.6"/>
                  </svg>
                  <span>5. 컨테이너 적재 시뮬레이터 및 저장 정보</span>
                </h2>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">포장 규격을 기준으로 선적 컨테이너당 적재 가능량을 가상 계산해 볼 수 있습니다.</p>
              </div>
              <div className="shrink-0">
                <svg className="w-20 h-10 text-indigo-500 dark:text-indigo-400" viewBox="0 0 80 40" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 15l20-6 44 6v18l-40 6-24-6V15z"/>
                  <path d="M8 15l20 6 44-6"/>
                  <path d="M28 21v18"/>
                  <path d="M13 16.5v16.5M18 18v16M23 19.5v15.5" opacity="0.6"/>
                  <path d="M36 20v17M44 19v15M52 18v13M60 17v11" opacity="0.6"/>
                </svg>
              </div>
            </div>
            
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
            제품 이미지 관리 (최대 10장)
          </h2>
          
          {localImages.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center">등록된 제품 이미지가 없습니다. 아래 폼에서 이미지를 추가해 주세요.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-150 dark:border-zinc-850">
                <span>💡</span>
                <span>이미지를 마우스로 드래그 앤 드롭하여 순서를 변경할 수 있습니다. <strong>(1번 이미지가 자동으로 대표 이미지로 설정됩니다)</strong></span>
              </p>
              <div className="flex flex-wrap gap-4 pt-1">
                {localImages.map((img, i) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`relative group border rounded-lg p-1.5 bg-zinc-50/50 dark:bg-zinc-950 shadow-sm transition-all hover:shadow cursor-grab active:cursor-grabbing ${
                      draggedIndex === i ? "opacity-40 border-dashed border-indigo-500 ring-2 ring-indigo-500/20" : "border-zinc-150 dark:border-zinc-800"
                    }`}
                  >
                    {img.url && (
                      <img
                        src={img.url}
                        alt={`제품 이미지 ${i + 1}`}
                        className="h-28 w-28 rounded-lg object-cover pointer-events-none select-none"
                      />
                    )}
                    {/* Position Badge */}
                    {i === 0 ? (
                      <span className="absolute top-2 left-2 rounded bg-amber-500 text-white px-2 py-0.5 text-[9px] font-extrabold shadow-sm border border-amber-400">
                        대표 이미지
                      </span>
                    ) : (
                      <span className="absolute top-2 left-2 rounded bg-zinc-900/70 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold text-white">
                        서브 {i}
                      </span>
                    )}
                    
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
            </div>
          )}

          {imageRows.length < 10 && (
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
