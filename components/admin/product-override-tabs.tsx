"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  type Product, 
  type ProductVideo,
  PRODUCT_CATEGORY_LABEL, 
  type ProductCategory,
  CERTIFICATE_TYPE_LABEL,
  type CertificateType
} from "@/lib/product/types";
import { 
  adminUpdateProductOverrides, 
  adminUpdateProductCuration,
  adminAddProductImages,
  adminRemoveProductImage,
  adminAddProductVideoUrl,
  adminAddProductVideoFile,
  adminRemoveProductVideo,
  adminAddProductCertificate,
  adminUploadIngredientsFile,
  adminDeleteIngredientsFile
} from "@/lib/product/admin-actions";
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
  curation: {
    status: string;
    curator: string | null;
    last_review_date: string | null;
    next_review_date: string | null;
    role: string;
  };
  matrix: Record<string, string>;
  curators: { id: string; name: string; email: string }[];
  apProfiles: { id: number; display_program: string; code: string; name: string; description: string | null; is_active: boolean }[];
  displayPrograms: { code: string; name: string; description: string | null; min_sku?: number; max_sku?: number; is_active: boolean }[];
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
  curation,
  matrix,
  curators,
  apProfiles,
  displayPrograms,
}: ProductOverrideTabsProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "category" ? "category_attributes" : "basic";
  const [activeTab, setActiveTab] = useState<"basic" | "category_attributes" | "price" | "logistics" | "media" | "certs" | "curation">(initialTab as any);

  // Local state for media / cert updates loading
  const [mediaPending, setMediaPending] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // 1. Image upload handler
  const handleImageUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;

    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        for (const file of Array.from(fileInput.files || [])) {
          formData.append("images", file);
        }
        await adminAddProductImages(product.id, formData);
        form.reset();
      } catch (err: any) {
        setMediaError(err.message || "이미지 업로드 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 2. Image delete handler
  const handleImageDelete = (imageId: string) => {
    if (!confirm("정말 이 제품 이미지를 삭제하시겠습니까?")) return;
    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        await adminRemoveProductImage(product.id, imageId);
      } catch (err: any) {
        setMediaError(err.message || "이미지 삭제 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 3. Video upload file handler
  const handleVideoFileUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("video", file);
        await adminAddProductVideoFile(product.id, formData);
        form.reset();
      } catch (err: any) {
        setMediaError(err.message || "동영상 업로드 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 4. Video Link upload handler
  const [videoLinkInput, setVideoLinkInput] = useState("");
  const handleVideoLinkUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoLinkInput.trim()) return;

    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        await adminAddProductVideoUrl(product.id, videoLinkInput.trim());
        setVideoLinkInput("");
      } catch (err: any) {
        setMediaError(err.message || "동영상 링크 등록 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 5. Video delete handler
  const handleVideoDelete = (videoId: string) => {
    if (!confirm("정말 이 동영상을 삭제하시겠습니까?")) return;
    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        await adminRemoveProductVideo(product.id, videoId);
      } catch (err: any) {
        setMediaError(err.message || "동영상 삭제 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 6. Ingredients File Upload handler
  const handleIngredientsUpload = (lang: "ko" | "en", file: File) => {
    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await adminUploadIngredientsFile(product.id, lang, formData);
      } catch (err: any) {
        setMediaError(err.message || "성분표 업로드 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 7. Ingredients File Delete handler
  const handleIngredientsDelete = (lang: "ko" | "en") => {
    if (!confirm("정말 성분표 문서를 삭제하시겠습니까?")) return;
    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        await adminDeleteIngredientsFile(product.id, lang);
      } catch (err: any) {
        setMediaError(err.message || "성분표 삭제 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };

  // 8. General Certificate Upload handler
  const [certTypeInput, setCertTypeInput] = useState("ingredient_certification");
  const handleCertificateUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setMediaPending(true);
    setMediaError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await adminAddProductCertificate(product.id, certTypeInput, file.name, formData);
        form.reset();
      } catch (err: any) {
        setMediaError(err.message || "인허가 서류 업로드 실패");
      } finally {
        setMediaPending(false);
      }
    });
  };
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 90 days calculator helper
  const get90DaysLater = (dateStr?: string | null) => {
    const baseDate = dateStr ? new Date(dateStr) : new Date();
    baseDate.setDate(baseDate.getDate() + 90);
    return baseDate.toISOString().split("T")[0];
  };

  // Automated date helper from intervals
  const updateNextReviewDate = (days: number, baseDateStr?: string | null) => {
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    base.setDate(base.getDate() + days);
    setOvNextReviewDate(base.toISOString().split("T")[0]);
  };

  // Curation States
  const [curationStatus, setCurationStatus] = useState(curation.status || "NOT_REVIEWED");
  const [ovCurator, setOvCurator] = useState(curation.curator || ""); // Stores Curator UUID (staff_members.id)
  const [isCuratorOpen, setIsCuratorOpen] = useState(false);
  const [curatorSearch, setCuratorSearch] = useState("");
  const [ovLastReviewDate, setOvLastReviewDate] = useState(curation.last_review_date || "");
  const [reviewInterval, setReviewInterval] = useState<string>("90");
  const [customReviewDays, setCustomReviewDays] = useState<number>(90);
  const [ovNextReviewDate, setOvNextReviewDate] = useState(
    curation.next_review_date || get90DaysLater(curation.last_review_date || new Date().toISOString().split("T")[0])
  );
  const [curationRole, setCurationRole] = useState(curation.role || "SUPPORT");
  const [ovMatrix, setOvMatrix] = useState<Record<string, string>>(matrix || {});

  // Admin Curation Pricing States
  const [ovLandedCost, setOvLandedCost] = useState<string>((curation as any).landed_cost?.toString() || "");
  const [ovWholesalePrice, setOvWholesalePrice] = useState<string>((curation as any).wholesale_price?.toString() || "");
  const [ovSuggestRetailPrice, setOvSuggestRetailPrice] = useState<string>((curation as any).suggest_retail_price?.toString() || "");

  // Load existing overrides
  const overrides = (product.price_additional_info as any)?.admin_overrides || {};

  // 누락 항목 분석 (Draft 상태 판정)
  const missingFields: string[] = [];
  const effectiveManufactureSku = overrides.manufacture_sku !== undefined ? overrides.manufacture_sku : product.manufacture_sku;
  
  if (!product.brand_id) missingFields.push("브랜드 지정");
  if (!product.category) missingFields.push("카테고리 지정");
  if (!product.name_en?.trim()) missingFields.push("영문 제품명");
  if (!(effectiveManufactureSku || "").trim()) missingFields.push("제조사 SKU");
  if (!product.origin?.trim()) missingFields.push("원산지");
  if (!product.price_krw_retail || Number(product.price_krw_retail) <= 0) missingFields.push("소비자 판매가");
  if (!product.price_usd_fob || Number(product.price_usd_fob) <= 0) missingFields.push("FOB 수출 가격");
  
  const widthVal = Number(product.package_width || 0);
  const depthVal = Number(product.package_depth || 0);
  const heightVal = Number(product.package_height || 0);
  const weightVal = Number(product.package_weight || 0);
  if (widthVal <= 0 || depthVal <= 0 || heightVal <= 0 || weightVal <= 0) {
    missingFields.push("패키지 배송 규격");
  }
  
  if (!product.upc?.trim() && !product.ean?.trim()) {
    missingFields.push("식별 바코드 (UPC 또는 EAN)");
  }
  
  const hasImages = imageUrls.length > 0 && imageUrls[0] !== null;
  if (!hasImages) {
    missingFields.push("대표 이미지 업로드");
  }
  const isDraft = missingFields.length > 0;

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
        await adminUpdateProductCuration(
          product.id,
          {
            status: curationStatus,
            curator: ovCurator,
            last_review_date: ovLastReviewDate || null,
            next_review_date: ovNextReviewDate || null,
            role: curationRole,
            landed_cost: ovLandedCost.trim() !== "" ? parseFloat(ovLandedCost) : null,
            wholesale_price: ovWholesalePrice.trim() !== "" ? parseFloat(ovWholesalePrice) : null,
            suggest_retail_price: ovSuggestRetailPrice.trim() !== "" ? parseFloat(ovSuggestRetailPrice) : null,
          },
          ovMatrix
        );
        setStatusMessage({ type: "success", text: "어드민 오버라이드 및 큐레이션 설정이 성공적으로 저장되었습니다." });
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
            {ovNameEn || product.name_en || ovName || product.name}
            {(ovNameEn || ovName) && (
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

      {isDraft && (
        <div className="rounded-xl border border-amber-250 bg-amber-50/55 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
            <span>⚠️ 정보 보완 필요 (Draft 상태)</span>
            <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              미입력 항목 {missingFields.length}개
            </span>
          </div>
          <p className="text-[11px] text-zinc-550 dark:text-zinc-400">
            브랜드사(제조사) 또는 어드민 관리자가 아래 필수 항목들을 보완 완료해야만 최종 'Active' 등록 상태로 전환할 수 있습니다:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {missingFields.map((field) => (
              <span
                key={field}
                className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/10 dark:bg-amber-950/40 dark:text-amber-450 dark:ring-amber-900/30"
              >
                • {field}
              </span>
            ))}
          </div>
        </div>
      )}

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
        <button
          onClick={() => setActiveTab("curation")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === "curation"
              ? "border-zinc-950 text-zinc-955 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          큐레이션 (Curation)
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

              {/* Admin Curation Pricing & Realtime Margin Calculator */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <div className="border-b border-zinc-100 pb-2 dark:border-zinc-800 flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    어드민 핵심 가격 책정 & 마진 계산기 (Curation Base)
                  </span>
                  <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                    어드민 전용
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  당사의 실질 수입 원가, 뷰티 서플라이 공급가, 권장 소비자가를 책정하여 당사 도매 마진과 소매점 마진을 실시간으로 확인하고 큐레이션 가격 원천으로 사용합니다.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Landed Cost */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450 block">
                      Landed Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="수입 원가 (배송/통관 포함)..."
                      value={ovLandedCost}
                      onChange={(e) => setOvLandedCost(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>

                  {/* Beauty Supply Wholesale Price */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-455 block">
                      Beauty Supply 공급가 ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="뷰티 서플라이 납품 도매가..."
                      value={ovWholesalePrice}
                      onChange={(e) => setOvWholesalePrice(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>

                  {/* Suggested Retail Price */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-455 block">
                      Suggested Retail Price (SRP, $)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="권장 미국 소비자가 (MSRP)..."
                      value={ovSuggestRetailPrice}
                      onChange={(e) => setOvSuggestRetailPrice(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                    />
                  </div>
                </div>

                {/* Margin Calculator Gauge / Cards */}
                {(() => {
                  const landed = parseFloat(ovLandedCost) || 0;
                  const wholesale = parseFloat(ovWholesalePrice) || 0;
                  const srp = parseFloat(ovSuggestRetailPrice) || 0;

                  const ourMargin = wholesale > 0 ? ((wholesale - landed) / wholesale) * 100 : 0;
                  const retailMargin = srp > 0 ? ((srp - wholesale) / srp) * 100 : 0;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {/* Our Margin Card */}
                      <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/20 dark:border-indigo-950/40 dark:bg-indigo-950/10 space-y-1.5 shadow-sm">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-indigo-800 dark:text-indigo-300">당사 도매 마진 (Our Margin)</span>
                          <span className="text-[9px] text-zinc-400 font-mono">((공급가 - 원가) / 공급가)</span>
                        </div>
                        <div className="flex items-baseline gap-2 pt-1">
                          <span className="text-xl font-extrabold text-indigo-750 dark:text-indigo-400">
                            {ourMargin > 0 ? `${ourMargin.toFixed(1)}%` : "0.0%"}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            (수익: ${wholesale > landed ? (wholesale - landed).toFixed(2) : "0.00"})
                          </span>
                        </div>
                      </div>

                      {/* Retailer Margin Card */}
                      <div className="p-3.5 rounded-lg border border-emerald-100 bg-emerald-50/20 dark:border-emerald-950/40 dark:bg-emerald-950/10 space-y-1.5 shadow-sm">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300">소매상 마진 (Retailer Margin)</span>
                          <span className="text-[9px] text-zinc-400 font-mono">((SRP - 공급가) / SRP)</span>
                        </div>
                        <div className="flex items-baseline gap-2 pt-1">
                          <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-450">
                            {retailMargin > 0 ? `${retailMargin.toFixed(1)}%` : "0.0%"}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            (수익: ${srp > wholesale ? (srp - wholesale).toFixed(2) : "0.00"})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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

        {/* Media Tab */}
        {activeTab === "media" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  제품 미디어 자료 관리 (이미지 및 동영상)
                </h3>
                {mediaPending && (
                  <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold animate-pulse">
                    처리 중...
                  </span>
                )}
              </div>

              {mediaError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450">
                  ⚠️ {mediaError}
                </div>
              )}

              {/* Images list */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-white">등록 상품 이미지 목록 ({imageUrls.length}개 / 최대 10개)</h4>
                {imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {imageUrls.map((url, idx) => {
                      const imgRow = imageRows[idx];
                      return (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 group shadow-sm flex flex-col justify-between aspect-square p-2">
                          <div className="relative w-full flex-1 rounded overflow-hidden">
                            {url ? (
                              <img src={url} alt={`제품 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-rose-500 font-bold">로딩 실패</div>
                            )}
                            {idx === 0 ? (
                              <span className="absolute top-1 left-1 rounded bg-amber-500 text-white px-1.5 py-0.5 text-[8px] font-extrabold shadow-sm border border-amber-400">
                                대표 이미지
                              </span>
                            ) : (
                              <span className="absolute top-1 left-1 rounded bg-black/60 text-white px-1.5 py-0.5 text-[8px] font-semibold">
                                서브 {idx}
                              </span>
                            )}
                          </div>
                          {imgRow && (
                            <button
                              type="button"
                              onClick={() => handleImageDelete(imgRow.id)}
                              disabled={mediaPending}
                              className="mt-1.5 w-full text-center text-[9px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer disabled:opacity-50"
                            >
                              이미지 삭제
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-3 text-center">등록된 사진 이미지가 없습니다.</p>
                )}

                {/* Image upload form */}
                {imageUrls.length < 10 && (
                  <form
                    onSubmit={handleImageUpload}
                    className="border-t border-zinc-100 dark:border-zinc-850 pt-3 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={mediaPending}
                        className="block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-750 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={mediaPending}
                      className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-850 cursor-pointer disabled:opacity-50"
                    >
                      이미지 추가
                    </button>
                  </form>
                )}
              </div>

              {/* Videos list */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-850 space-y-4">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-white font-sans">등록 상품 홍보 동영상 ({videoUrls.length}개)</h4>
                {videoUrls.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {videoRows.map((v, idx) => {
                      const url = videoUrls[idx];
                      return (
                        <div key={v.id} className="p-3.5 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 flex flex-col justify-between gap-3 shadow-sm">
                          <div className="space-y-2 text-xs">
                            {v.video_url ? (
                              <p className="truncate">외부 링크: <a href={v.video_url} target="_blank" rel="noreferrer" className="text-indigo-650 hover:underline font-mono dark:text-indigo-400">{v.video_url}</a></p>
                            ) : (
                              <p className="text-zinc-650 dark:text-zinc-400">직접 업로드 비디오 파일</p>
                            )}
                            {v.video_url ? (
                              <div className="aspect-video w-full rounded-lg overflow-hidden border border-zinc-200 bg-black flex items-center justify-center text-xs text-zinc-400">
                                {v.video_url.includes("youtube.com") || v.video_url.includes("youtu.be") ? (
                                  <iframe
                                    width="100%"
                                    height="100%"
                                    src={`https://www.youtube.com/embed/${
                                      v.video_url.includes("watch?v=")
                                        ? v.video_url.split("watch?v=")[1]?.split("&")[0]
                                        : v.video_url.split("/").pop()
                                    }`}
                                    title="YouTube video"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  ></iframe>
                                ) : (
                                  <a href={v.video_url} target="_blank" rel="noreferrer" className="text-indigo-650 hover:underline font-bold px-2 py-1 dark:text-indigo-400">
                                    외부 동영상 링크 열기 ↗
                                  </a>
                                )}
                              </div>
                            ) : (
                              url && (
                                <div className="max-w-md rounded border border-zinc-200 overflow-hidden shadow-sm aspect-video">
                                  <video src={url} controls className="w-full h-full object-contain bg-black" />
                                </div>
                              )
                            )}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                              {v.video_url ? "외부 링크" : "직접 업로드"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleVideoDelete(v.id)}
                              disabled={mediaPending}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer disabled:opacity-50"
                            >
                              동영상 삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-3 text-center">등록된 홍보 동영상이 없습니다.</p>
                )}

                {/* Add Video Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-zinc-100 dark:border-zinc-850 pt-4">
                  {/* Video Link form */}
                  <form onSubmit={handleVideoLinkUpload} className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450 block">
                      방법 A: 외부 동영상 링크 등록 (YouTube 등)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={videoLinkInput}
                        onChange={(e) => setVideoLinkInput(e.target.value)}
                        disabled={mediaPending}
                        className="flex-1 rounded border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={mediaPending}
                        className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-850 cursor-pointer disabled:opacity-50"
                      >
                        링크 등록
                      </button>
                    </div>
                  </form>

                  {/* Video File form */}
                  <form onSubmit={handleVideoFileUpload} className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-455 block">
                      방법 B: 동영상 파일 직접 업로드 (MP4 등)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        disabled={mediaPending}
                        className="block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-750 cursor-pointer disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={mediaPending}
                        className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-850 cursor-pointer disabled:opacity-50"
                      >
                        비디오 파일 업로드
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Certifications Tab */}
        {activeTab === "certs" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  원료 및 인허가 보증서 관리
                </h3>
                {mediaPending && (
                  <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold animate-pulse">
                    처리 중...
                  </span>
                )}
              </div>

              {mediaError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450">
                  ⚠️ {mediaError}
                </div>
              )}

              {/* Special files: Ingredient Certs */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-850 dark:text-white">성분 표 및 인증서 (Ingredients Sheets)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* KO Sheet */}
                  <div className="p-4 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs space-y-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">성분 인증 증빙 서류 (국문)</span>
                    {ingredientsFileUrl ? (
                      <div className="flex items-center justify-between">
                        <a href={ingredientsFileUrl} target="_blank" rel="noreferrer" className="inline-block rounded bg-[#18181b] hover:bg-[#27272a] dark:bg-[#f4f4f5] dark:hover:bg-[#e4e4e7] text-white dark:text-[#09090b] border border-[#18181b] dark:border-[#f4f4f5] px-3 py-1.5 font-bold shadow-sm transition-all duration-150">
                          국문 서류 다운로드 ↗
                        </a>
                        <button
                          type="button"
                          disabled={mediaPending}
                          onClick={() => handleIngredientsDelete("ko")}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer disabled:opacity-50"
                        >
                          파일 삭제
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-400 italic block py-1">첨부된 국문 성분 인증 서류가 없습니다.</span>
                    )}

                    <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <label className="text-[9px] font-bold text-zinc-500 block mb-1">국문 서류 업로드/갱신</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={mediaPending}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleIngredientsUpload("ko", e.target.files[0]);
                          }
                        }}
                        className="block w-full text-[10px] text-zinc-500 dark:text-zinc-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* EN Sheet */}
                  <div className="p-4 rounded-lg border border-zinc-150 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs space-y-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">성분 인증 증빙 서류 (영문)</span>
                    {ingredientsFileUrlEn ? (
                      <div className="flex items-center justify-between">
                        <a href={ingredientsFileUrlEn} target="_blank" rel="noreferrer" className="inline-block rounded bg-[#18181b] hover:bg-[#27272a] dark:bg-[#f4f4f5] dark:hover:bg-[#e4e4e7] text-white dark:text-[#09090b] border border-[#18181b] dark:border-[#f4f4f5] px-3 py-1.5 font-bold shadow-sm transition-all duration-150">
                          영문 서류 다운로드 ↗
                        </a>
                        <button
                          type="button"
                          disabled={mediaPending}
                          onClick={() => handleIngredientsDelete("en")}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer disabled:opacity-50"
                        >
                          파일 삭제
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-400 italic block py-1">첨부된 영문 성분 인증 서류가 없습니다.</span>
                    )}

                    <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <label className="text-[9px] font-bold text-zinc-500 block mb-1">영문 서류 업로드/갱신</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={mediaPending}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleIngredientsUpload("en", e.target.files[0]);
                          }
                        }}
                        className="block w-full text-[10px] text-zinc-500 dark:text-zinc-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer disabled:opacity-50"
                      />
                    </div>
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
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
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

                {/* Upload new Certificate */}
                <form
                  onSubmit={handleCertificateUpload}
                  className="border-t border-zinc-100 dark:border-zinc-850 pt-4 space-y-3"
                >
                  <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450 block">
                    인허가/보증서 신규 파일 등록
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={certTypeInput}
                      onChange={(e) => setCertTypeInput(e.target.value)}
                      disabled={mediaPending}
                      className="rounded border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 disabled:opacity-50"
                    >
                      <option value="ingredient_certification">성분 분석 인증서 (Ingredients Sheets)</option>
                      <option value="fda_registration">FDA 등록 증빙 (FDA Registration)</option>
                      <option value="trademark">상표 등록증 (Trademark)</option>
                      <option value="other">기타 인증서/보증서 (Other)</option>
                    </select>

                    <div className="flex-1 flex gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={mediaPending}
                        className="block flex-1 text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={mediaPending}
                        className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-850 cursor-pointer disabled:opacity-50"
                      >
                        문서 업로드
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Curation Tab */}
        {activeTab === "curation" && (
          <div className="space-y-6">
            {/* 1. 큐레이션 기본 정보 설정 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                큐레이션 기본 설정
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 큐레이션 상태 */}
                <div className="space-y-1.5">
                  <div className="flex items-center">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450">큐레이션 상태 (Curation Status)</label>
                    <div className="relative group/tooltip inline-block ml-1.5 align-middle cursor-pointer">
                      <span className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-350 text-xs">ⓘ</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-zinc-950 text-white rounded-lg shadow-xl text-[10px] leading-relaxed transition-all duration-200 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible z-50 font-normal">
                        <p className="font-bold border-b border-zinc-800 pb-1 mb-1">Curation Status 안내</p>
                        <ul className="space-y-1">
                          <li><strong>Not Reviewed</strong>: 아직 검토하지 않은 상품</li>
                          <li><strong>Candidate</strong>: 큐레이션 후보로 평가 중</li>
                          <li><strong>Approved</strong>: 큐레이션 사용 승인 완료</li>
                          <li><strong>Active</strong>: 현재 실제 Curation Set에서 사용 중</li>
                          <li><strong>Hold</strong>: 일시적으로 사용 보류</li>
                          <li><strong>Removed</strong>: 큐레이션 대상에서 제외</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <select
                    value={curationStatus}
                    onChange={(e) => {
                      setCurationStatus(e.target.value);
                      // Update next review automatically if empty or unset
                      if (!ovNextReviewDate) {
                        setOvNextReviewDate(get90DaysLater(ovLastReviewDate || new Date().toISOString().split("T")[0]));
                      }
                    }}
                    className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold"
                  >
                    <option value="NOT_REVIEWED">Not Reviewed (미검토)</option>
                    <option value="CANDIDATE">Candidate (후보)</option>
                    <option value="APPROVED">Approved (승인)</option>
                    <option value="ACTIVE">Active (활성)</option>
                    <option value="HOLD">Hold (보류)</option>
                    <option value="REMOVED">Removed (제외)</option>
                  </select>
                </div>

                {/* 큐레이션 역할 */}
                <div className="space-y-1.5">
                  <div className="flex items-center">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450">큐레이션 역할 (Curation Role)</label>
                    <div className="relative group/tooltip inline-block ml-1.5 align-middle cursor-pointer">
                      <span className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-350 text-xs">ⓘ</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-zinc-950 text-white rounded-lg shadow-xl text-[10px] leading-relaxed transition-all duration-200 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible z-50 font-normal">
                        <p className="font-bold border-b border-zinc-800 pb-1 mb-1">Curation Role 안내</p>
                        <ul className="space-y-1">
                          <li><strong>Hero</strong>: 카테고리를 대표하는 핵심/추천 상품</li>
                          <li><strong>Core</strong>: 지속적으로 유지해야 하는 기본 상품</li>
                          <li><strong>Traffic</strong>: 고객 유입과 구매를 유도하는 상품</li>
                          <li><strong>Trend</strong>: 현재 K-Beauty 트렌드를 반영하는 상품</li>
                          <li><strong>Margin</strong>: Retailer 수익성이 높은 상품</li>
                          <li><strong>Trial</strong>: 시장 반응 테스트용 상품</li>
                          <li><strong>Support</strong>: 카테고리 구성을 보완하는 상품</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <select
                    value={curationRole}
                    onChange={(e) => setCurationRole(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold"
                  >
                    <option value="HERO">Hero (핵심 유입 제품)</option>
                    <option value="CORE">Core (표준 구성)</option>
                    <option value="TRAFFIC">Traffic (볼륨 및 인지도 유도)</option>
                    <option value="TREND">Trend (시즌 트렌드 대응)</option>
                    <option value="MARGIN">Margin (수익률 특화)</option>
                    <option value="TRIAL">Trial (초기 매대 진입 테스트)</option>
                    <option value="SUPPORT">Support (기타 보완 제품)</option>
                  </select>
                </div>

                {/* 담당 큐레이터 (Searchable Dropdown) */}
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-455">담당 큐레이터 (Curator)</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCuratorOpen(!isCuratorOpen)}
                      className="w-full rounded border border-zinc-200 p-2.5 text-xs text-left text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-medium flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">
                        {curators.find((c) => c.id === ovCurator)
                          ? `${curators.find((c) => c.id === ovCurator)?.name} (${curators.find((c) => c.id === ovCurator)?.email})`
                          : "담당 큐레이터 선택 (미지정)"}
                      </span>
                      <span className="text-zinc-400 text-[10px]">▼</span>
                    </button>

                    {isCuratorOpen && (
                      <div className="absolute left-0 right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg max-h-60 flex flex-col overflow-hidden">
                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                          <input
                            type="text"
                            value={curatorSearch}
                            onChange={(e) => setCuratorSearch(e.target.value)}
                            placeholder="이름 또는 이메일 검색..."
                            className="w-full p-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950"
                          />
                        </div>
                        <div className="overflow-y-auto flex-1 divide-y divide-zinc-55 dark:divide-zinc-850">
                          <button
                            type="button"
                            onClick={() => {
                              setOvCurator("");
                              setIsCuratorOpen(false);
                              setCuratorSearch("");
                            }}
                            className="w-full text-left p-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-red-600 dark:text-red-400 font-bold"
                          >
                            비우기 (미지정)
                          </button>
                          {curators
                            .filter(
                              (c) =>
                                c.name.toLowerCase().includes(curatorSearch.toLowerCase()) ||
                                c.email.toLowerCase().includes(curatorSearch.toLowerCase())
                            )
                            .map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setOvCurator(c.id);
                                  setIsCuratorOpen(false);
                                  setCuratorSearch("");
                                }}
                                className={`w-full text-left p-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                                  ovCurator === c.id
                                    ? "bg-zinc-55 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-white"
                                    : "text-zinc-700 dark:text-zinc-350"
                                }`}
                              >
                                {c.name} ({c.email})
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 검토 일자 피커 및 간편 일수 입력 툴 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">최종 검토일</label>
                    <input
                      type="date"
                      value={ovLastReviewDate}
                      disabled
                      className="w-full rounded border border-zinc-200 p-2 text-xs text-zinc-400 bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950 dark:text-zinc-500 focus:outline-none cursor-not-allowed font-medium"
                    />
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block">* 저장 시 당일로 자동 갱신됩니다.</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-650 dark:text-zinc-450">차기 검토 예정일 설정</label>
                    <div className="flex gap-2">
                      <select
                        value={reviewInterval}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReviewInterval(val);
                          if (val !== "custom") {
                            const days = parseInt(val);
                            setCustomReviewDays(days);
                            updateNextReviewDate(days, ovLastReviewDate || new Date().toISOString().split("T")[0]);
                          }
                        }}
                        className="rounded border border-zinc-200 p-1.5 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white outline-none font-semibold flex-1"
                      >
                        <option value="14">14일 후</option>
                        <option value="30">30일 후</option>
                        <option value="90">90일 후 (기본)</option>
                        <option value="120">120일 후</option>
                        <option value="custom">직접 일수 입력</option>
                      </select>
                      {reviewInterval === "custom" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={customReviewDays}
                            onChange={(e) => {
                              const days = parseInt(e.target.value) || 0;
                              setCustomReviewDays(days);
                              updateNextReviewDate(days, ovLastReviewDate || new Date().toISOString().split("T")[0]);
                            }}
                            className="w-16 rounded border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white p-1 text-xs outline-none focus:border-zinc-950 font-bold"
                          />
                          <span className="text-[10px] text-zinc-400">일 후</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="date"
                      value={ovNextReviewDate}
                      onChange={(e) => {
                        setOvNextReviewDate(e.target.value);
                        setReviewInterval("custom"); // Manually chosen date -> set custom
                      }}
                      className="w-full rounded border border-zinc-200 p-1.5 text-xs text-zinc-900 bg-white dark:border-zinc-850 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-medium mt-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Display Program & AP 3x6 설정 Matrix */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Display Program Assortment Matrix
                </h3>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">각 6개 AP별로 이 상품이 가질 진열 역할(Required / Core / Optional / Test)을 정하고 미진열은 Exclude로 선택합니다.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <th className="p-3 font-bold text-zinc-500 dark:text-zinc-455 w-1/4">Assortment Profile (AP)</th>
                      {(() => {
                        const order: Record<string, number> = { START_4FT: 1, GROW_8FT: 2, EXPAND_12FT: 3 };
                        const sortedProgs = [...displayPrograms].sort((a, b) => {
                          const orderA = order[a.code] || 999;
                          const orderB = order[b.code] || 999;
                          return orderA !== orderB ? orderA - orderB : a.code.localeCompare(b.code);
                        });
                        return sortedProgs.map((p) => (
                          <th key={p.code} className="p-3 font-bold text-zinc-550 dark:text-zinc-350 text-center w-1/4">
                            {p.name}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const apCodes = Array.from(new Set(apProfiles.map((p) => p.code))).sort((a, b) => a.localeCompare(b));
                      return apCodes.map((apCode) => {
                        const order: Record<string, number> = { START_4FT: 1, GROW_8FT: 2, EXPAND_12FT: 3 };
                        const sortedProgs = [...displayPrograms].sort((a, b) => {
                          const orderA = order[a.code] || 999;
                          const orderB = order[b.code] || 999;
                          return orderA !== orderB ? orderA - orderB : a.code.localeCompare(b.code);
                        });

                        const sampleProfile = apProfiles.find((p) => p.code === apCode);
                        const nameLabel = sampleProfile?.name.replace(/^START 4FT - /, "").replace(/^START 4FT -/, "").replace(/^GROW 8FT - /, "").replace(/^EXPAND 12FT - /, "") || apCode;

                        return (
                          <tr key={apCode} className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50/20 dark:hover:bg-zinc-950/20">
                            <td className="p-3 font-bold text-zinc-800 dark:text-zinc-200">
                              <div className="flex items-center gap-1.5">
                                <span>{apCode} · {nameLabel}</span>
                                <div className="relative group/ap-tooltip inline-block cursor-pointer align-middle">
                                  <span className="text-zinc-400 hover:text-zinc-650 dark:text-zinc-500 text-xs">ⓘ</span>
                                  <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-zinc-950 text-white rounded-lg shadow-xl text-[10px] leading-relaxed transition-all duration-200 opacity-0 invisible group-hover/ap-tooltip:opacity-100 group-hover/ap-tooltip:visible z-50 font-normal normal-case">
                                    <p className="font-bold border-b border-zinc-800 pb-1 mb-1.5">AP 세부 설명 ({apCode})</p>
                                    <div className="space-y-1.5">
                                      {sortedProgs.map((p) => {
                                        const apProfile = apProfiles.find((ap) => ap.display_program === p.code && ap.code === apCode);
                                        return apProfile ? (
                                          <p key={p.code}><strong>{p.name}:</strong> {apProfile.description || "설명 없음"}</p>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            {sortedProgs.map((prog) => {
                              const matrixKey = `${prog.code}:${apCode}`;
                              const val = ovMatrix[matrixKey] || "EXCLUDE";
                              return (
                                <td key={prog.code} className="p-2 text-center">
                                  <select
                                    value={val}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setOvMatrix((prev) => ({ ...prev, [matrixKey]: newVal }));
                                    }}
                                    className={`rounded border p-1.5 text-xs focus:border-zinc-950 outline-none w-[90%] font-semibold ${
                                      val === "EXCLUDE"
                                        ? "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-850 dark:bg-zinc-950 dark:text-zinc-600"
                                        : val === "REQUIRED"
                                        ? "border-emerald-250 bg-emerald-50 text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-450"
                                        : val === "CORE"
                                        ? "border-indigo-250 bg-indigo-50 text-indigo-800 dark:border-indigo-950 dark:bg-indigo-950/20 dark:text-indigo-450"
                                        : val === "OPTIONAL"
                                        ? "border-amber-250 bg-amber-50 text-amber-800 dark:border-amber-950 dark:bg-amber-950/20 dark:text-amber-450"
                                        : "border-sky-250 bg-sky-50 text-sky-800 dark:border-sky-950 dark:bg-sky-950/20 dark:text-sky-450"
                                    }`}
                                  >
                                    <option value="EXCLUDE">Exclude (미진열)</option>
                                    <option value="REQUIRED">Required (필수 진열)</option>
                                    <option value="CORE">Core (표준 진열)</option>
                                    <option value="OPTIONAL">Optional (선택 진열)</option>
                                    <option value="TEST">Test (임시 테스트)</option>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    })()}
                  </tbody>
                </table>
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
