"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NEW_BRAND_ACTION = "__NEW_BRAND_SHORTCUT__";
import { CategoryAttributeForm, type CategoryAttributeFormHandle } from "@/components/product/category-attribute-form";
import { 
  type Product, 
  type ProductVideo, 
  PRODUCT_CATEGORY_LABEL, 
  type ProductCategory,
  CERTIFICATE_TYPE_LABEL,
  type CertificateType,
  sanitizeSku,
  trimSkuSeparators,
  resolveEffectiveSku,
  cleanPlaceholderName,
  cleanPlaceholderSku
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
import { LogisticsHelpModal, type LogisticsHelpSectionKey } from "@/components/product/logistics-help-modal";

import { type CategoryCompletionResult } from "@/lib/product/attribute-completion";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  SELECTION_STATUS_LABELS,
  SELECTION_STATUS_STYLES,
  SALES_STATUS_LABELS,
  SALES_STATUS_STYLES,
  type SelectionStatus,
  type SalesStatus,
} from "@/lib/product/registration-status";

const normalizePriceTiers = (tiers: { qty: number | string; price: number | string }[]) => {
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t) => ({
      qty: t.qty !== undefined && t.qty !== null ? String(t.qty).trim() : "",
      price: t.price !== undefined && t.price !== null ? String(t.price).trim() : "",
    }))
    .filter((t) => t.qty !== "" || t.price !== "");
};

const getInitialPriceTiers = (storedTiers: any) => {
  const tiers = Array.isArray(storedTiers) ? storedTiers : [];
  if (tiers.length === 0) {
    return [
      { qty: "", price: "" },
      { qty: "", price: "" },
    ];
  }
  if (tiers.length === 1) {
    return [
      { qty: tiers[0].qty !== undefined && tiers[0].qty !== null ? tiers[0].qty : "", price: tiers[0].price !== undefined && tiers[0].price !== null ? tiers[0].price : "" },
      { qty: "", price: "" },
    ];
  }
  return tiers.map((t: any) => ({
    qty: t.qty !== undefined && t.qty !== null ? t.qty : "",
    price: t.price !== undefined && t.price !== null ? t.price : "",
  }));
};

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
  initialCategoryCompletion?: CategoryCompletionResult | null;
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
  initialCategoryCompletion,
}: ProductDetailTabsProps) {
  const router = useRouter();
  const isDeleted = Boolean(product.deleted_at || (product.price_additional_info as any)?.deleted_at);
  const [activeTab, setActiveTab] = useState<"basic" | "category_attributes" | "price" | "logistics" | "media" | "certs">("basic");
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [categoryCompletion, setCategoryCompletion] = useState<CategoryCompletionResult | null>(initialCategoryCompletion || null);
  const categoryAttrRef = React.useRef<CategoryAttributeFormHandle>(null);

  const handleCompletionChange = React.useCallback((status: any) => {
    setCategoryCompletion((prev) => {
      if (
        prev &&
        prev.categoryComplete === status.categoryComplete &&
        prev.requiredAttributesComplete === status.requiredAttributesComplete &&
        prev.completionPercent === status.completionPercent &&
        JSON.stringify(prev.missingRequiredAttributes) === JSON.stringify(status.missingRequiredAttributes)
      ) {
        return prev;
      }
      return prev ? { ...prev, ...status } : status;
    });
  }, []);

  const handleCatAttrDirtyChange = React.useCallback((isDirty: boolean) => {
    setIsCatAttrDirty((prev) => (prev === isDirty ? prev : isDirty));
  }, []);

  // Sync activeTab from URL search params (?tab=...) or hash (#attr-...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTabFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab");
      const hash = window.location.hash;

      if (hash.startsWith("#attr-") || hash === "#category_attributes") {
        setActiveTab("category_attributes");
      } else if (tabParam && ["basic", "category_attributes", "price", "logistics", "media", "certs"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    };

    syncTabFromUrl();
    window.addEventListener("hashchange", syncTabFromUrl);
    return () => window.removeEventListener("hashchange", syncTabFromUrl);
  }, []);

  const handleBrandSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === NEW_BRAND_ACTION) {
      const ok = window.confirm(
        "브랜드 관리 페이지로 이동하시겠습니까?\n현재 입력 중인 저장되지 않은 내용은 사라질 수 있습니다."
      );
      if (ok) {
        router.push("/portal/brands");
      }
      return;
    }
    setBrandId(selected);
  };

  // Read admin overrides (specifically for Letusto SKU & Manufacture SKU)
  const adminOverrides = (product.price_additional_info as any)?.admin_overrides || {};
  const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, product.letusto_sku) || "";
  const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, product.manufacture_sku) || "";

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

  const [isLogisticsHelpOpen, setIsLogisticsHelpOpen] = useState(false);
  const [activeLogisticsHelpSection, setActiveLogisticsHelpSection] = useState<LogisticsHelpSectionKey>("all");

  const openLogisticsHelp = (section: LogisticsHelpSectionKey) => {
    setActiveLogisticsHelpSection(section);
    setIsLogisticsHelpOpen(true);
  };

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

  // Override Container Loading states (20FT, 40FT, 40HQ)
  const [c20Qty, setC20Qty] = useState(product.container_20ft_qty?.toString() || "");
  const [c20Weight, setC20Weight] = useState(product.container_20ft_weight?.toString() || "");
  const [c20Cbm, setC20Cbm] = useState(product.container_20ft_cbm?.toString() || "");

  const [c40Qty, setC40Qty] = useState((product.price_additional_info as any)?.container_40ft_qty?.toString() || "");
  const [c40Weight, setC40Weight] = useState((product.price_additional_info as any)?.container_40ft_weight?.toString() || "");
  const [c40Cbm, setC40Cbm] = useState((product.price_additional_info as any)?.container_40ft_cbm?.toString() || "");

  const [c40hqQty, setC40hqQty] = useState(product.container_40fthc_qty?.toString() || "");
  const [c40hqWeight, setC40hqWeight] = useState(product.container_40fthc_weight?.toString() || "");
  const [c40hqCbm, setC40hqCbm] = useState(product.container_40fthc_cbm?.toString() || "");

  // FOB price state for dynamic discount calculations
  const [priceUsdFobState, setPriceUsdFobState] = useState<number | string>(product.price_usd_fob ? product.price_usd_fob.toString() : "");

  // Video Inputs
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoFilePending, setVideoFilePending] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Tiered Pricing State
  const [priceTiers, setPriceTiers] = useState<{ qty: number | string; price: number | string }[]>(() => {
    const additionalInfo = product.price_additional_info as Record<string, any> | null;
    const stored = (additionalInfo && Array.isArray(additionalInfo.price_tiers))
      ? additionalInfo.price_tiers
      : (additionalInfo && Array.isArray((additionalInfo as any).tiered_prices) ? (additionalInfo as any).tiered_prices : []);
    return getInitialPriceTiers(stored);
  });

  // Ingredients File State (Korean)
  const [ingredientsFilePendingKo, setIngredientsFilePendingKo] = useState(false);
  const [ingredientsErrorKo, setIngredientsErrorKo] = useState<string | null>(null);

  // New Selling States
  const [sellingOnline, setSellingOnline] = useState(!!product.selling_online);
  const [sellingOffline, setSellingOffline] = useState(!!product.selling_offline);
  const [salesLink1, setSalesLink1] = useState(product.sales_link_1 || "");
  const [salesLink2, setSalesLink2] = useState(product.sales_link_2 || "");

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

  // Required Fields States for reactive validation
  const initialManufactureSku = cleanPlaceholderSku(effectiveManufactureSku) || "";
  const initialNameEn = cleanPlaceholderName(product.name_en) || "";
  const initialName = cleanPlaceholderName(product.name) || "";
  const [nameEn, setNameEn] = useState(initialNameEn);
  const [name, setName] = useState(initialName);
  const [manufactureSku, setManufactureSku] = useState(initialManufactureSku);
  const [brandId, setBrandId] = useState(product.brand_id || "");
  const [category, setCategory] = useState(product.category || "");
  const [volume, setVolume] = useState(product.volume || "");
  const [origin, setOrigin] = useState(product.origin || "");
  const [leadTimeValue, setLeadTimeValue] = useState(parsedLeadTime.value || "");
  const [leadTimeUnit, setLeadTimeUnit] = useState(parsedLeadTime.unit || "주");
  const [color, setColor] = useState(product.color || "");
  const [colorMap, setColorMap] = useState(product.color_map || "");
  const [description, setDescription] = useState(product.description || "");
  const [priceKrwRetail, setPriceKrwRetail] = useState(product.price_krw_retail?.toString() || "");
  const [priceKrwWholesale, setPriceKrwWholesale] = useState(product.price_krw_wholesale?.toString() || "");
  const [estimatedRetailPrice, setEstimatedRetailPrice] = useState(product.estimated_retail_price?.toString() || "");
  const [upc, setUpc] = useState(product.upc || "");
  const [ean, setEan] = useState(product.ean || "");
  const [isCatAttrDirty, setIsCatAttrDirty] = useState(false);

  // Pending Product Images Upload Staging State
  interface PendingImageFile {
    id: string;
    file: File;
    previewUrl: string;
    formattedSize: string;
    error?: string;
  }
  const [pendingImages, setPendingImages] = useState<PendingImageFile[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    const MAX_TOTAL_IMAGES = 10;

    let currentValidCount = localImages.length + pendingImages.filter((p) => !p.error).length;

    const newPending: PendingImageFile[] = fileList.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      const sizeInKb = file.size / 1024;
      const formattedSize = sizeInKb > 1024 
        ? `${(sizeInKb / 1024).toFixed(1)} MB` 
        : `${Math.round(sizeInKb)} KB`;

      // Validation 1: Format
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      const isFormatAllowed = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);

      // Validation 2: Size
      const isSizeAllowed = file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES;

      // Validation 3: Duplicate in pending
      const isDuplicate = pendingImages.some((p) => p.file.name === file.name && p.file.size === file.size);

      let validationError: string | undefined;
      if (!isFormatAllowed) {
        validationError = "지원하지 않는 형식 (JPG, PNG, WEBP만 가능)";
      } else if (!isSizeAllowed) {
        validationError = file.size === 0 ? "빈 파일 (0 바이트)" : "파일 크기 초과 (최대 10MB)";
      } else if (isDuplicate) {
        validationError = "이미 선택된 중복 파일";
      } else if (currentValidCount >= MAX_TOTAL_IMAGES) {
        validationError = `최대 ${MAX_TOTAL_IMAGES}장 등록 한도 초과`;
      } else {
        currentValidCount++;
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
        formattedSize,
        error: validationError,
      };
    });

    setPendingImages((prev) => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUploadPendingImages = async () => {
    const validPending = pendingImages.filter((item) => !item.error);
    if (validPending.length === 0) {
      setStatusMessage({ type: "error", text: "업로드 가능한 유효한 이미지가 없습니다. 오류 항목을 확인해주세요." });
      return;
    }
    setUploadingImages(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      validPending.forEach((item) => {
        formData.append("images", item.file);
      });
      const res = await addProductImages(product.id, formData);

      if (res.results && res.results.length > 0) {
        const succeededNames = new Set(res.results.filter((r) => r.success).map((r) => r.fileName));
        const failedMap = new Map(res.results.filter((r) => !r.success).map((r) => [r.fileName, r.error || "업로드 실패"]));

        // Revoke URLs for succeeded files
        pendingImages.forEach((item) => {
          if (succeededNames.has(item.file.name)) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });

        // Keep remaining/failed items in pending with updated error message
        setPendingImages((prev) =>
          prev
            .filter((item) => !succeededNames.has(item.file.name))
            .map((item) => {
              if (failedMap.has(item.file.name)) {
                return { ...item, error: failedMap.get(item.file.name) };
              }
              return item;
            })
        );

        if (res.uploadedCount > 0 && res.uploadedCount === validPending.length) {
          setStatusMessage({ type: "success", text: `이미지 ${res.uploadedCount}장이 성공적으로 등록되었습니다.` });
        } else if (res.uploadedCount > 0) {
          setStatusMessage({
            type: "error",
            text: `${res.uploadedCount}장 등록 완료, ${validPending.length - res.uploadedCount}장 업로드 실패. 오류 항목을 확인해주세요.`,
          });
        } else {
          setStatusMessage({ type: "error", text: res.error || "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요." });
        }
      } else if (res.success) {
        validPending.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setPendingImages((prev) => prev.filter((item) => item.error));
        setStatusMessage({ type: "success", text: "이미지가 성공적으로 추가되었습니다." });
      } else {
        setStatusMessage({ type: "error", text: res.error || "이미지 업로드에 실패했습니다." });
      }
      router.refresh();
    } catch (err: any) {
      console.error("Upload error:", err);
      setStatusMessage({ type: "error", text: err.message || "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setUploadingImages(false);
    }
  };

  const initialSnapshotRef = React.useRef({
    nameEn: initialNameEn,
    name: initialName,
    manufactureSku: initialManufactureSku,
    brandId: product.brand_id || "",
    category: product.category || "",
    volume: product.volume || "",
    origin: product.origin || "",
    leadTimeValue: parsedLeadTime.value || "",
    leadTimeUnit: parsedLeadTime.unit || "주",
    color: product.color || "",
    colorMap: product.color_map || "",
    description: product.description || "",
    ingredientsText: product.ingredients_text || "",
    isParentSku: getInitialParentState(),
    isChildSku: getInitialChildState(),
    upc: product.upc || "",
    ean: product.ean || "",
    sellingOnline: !!product.selling_online,
    sellingOffline: !!product.selling_offline,
    salesLink1: product.sales_link_1 || "",
    salesLink2: product.sales_link_2 || "",
    bullets: JSON.stringify(product.bullet_points && product.bullet_points.length > 0 ? product.bullet_points : ["", "", "", "", ""]),
    priceKrwRetail: product.price_krw_retail?.toString() || "",
    priceKrwWholesale: product.price_krw_wholesale?.toString() || "",
    estimatedRetailPrice: product.estimated_retail_price?.toString() || "",
    priceUsdFobState: product.price_usd_fob ? product.price_usd_fob.toString() : "",
    priceTiers: JSON.stringify(normalizePriceTiers(
      (product.price_additional_info as any)?.price_tiers || (product.price_additional_info as any)?.tiered_prices || []
    )),
    itemWidth: product.item_width?.toString() || "",
    itemDepth: product.item_depth?.toString() || "",
    itemHeight: product.item_height?.toString() || "",
    itemWeight: product.item_weight?.toString() || "",
    packageWidth: product.package_width?.toString() || "",
    packageDepth: product.package_depth?.toString() || "",
    packageHeight: product.package_height?.toString() || "",
    packageWeight: product.package_weight?.toString() || "",
    cartonPackQty: product.carton_pack_qty?.toString() || "1",
    cartonWidth: product.carton_width?.toString() || "",
    cartonDepth: product.carton_depth?.toString() || "",
    cartonHeight: product.carton_height?.toString() || "",
    cartonWeight: product.carton_weight?.toString() || "",
    paletteCartonQty: product.palette_carton_qty?.toString() || "",
    paletteWidth: product.palette_width?.toString() || "",
    paletteDepth: product.palette_depth?.toString() || "",
    paletteHeight: product.palette_height?.toString() || "",
    paletteWeight: product.palette_weight?.toString() || "",
    c20Qty: product.container_20ft_qty?.toString() || "",
    c20Weight: product.container_20ft_weight?.toString() || "",
    c20Cbm: product.container_20ft_cbm?.toString() || "",
    c40Qty: (product.price_additional_info as any)?.container_40ft_qty?.toString() || "",
    c40Weight: (product.price_additional_info as any)?.container_40ft_weight?.toString() || "",
    c40Cbm: (product.price_additional_info as any)?.container_40ft_cbm?.toString() || "",
    c40hqQty: product.container_40fthc_qty?.toString() || "",
    c40hqWeight: product.container_40fthc_weight?.toString() || "",
    c40hqCbm: product.container_40fthc_cbm?.toString() || ""
  });

  const getMissingFieldsList = () => {
    const missing = [];
    
    // Basic Info tab
    if (!brandId) missing.push({ tab: "basic", field: "브랜드", inputName: "brandId" });
    if (!nameEn.trim()) missing.push({ tab: "basic", field: "영문 제품명", inputName: "nameEn" });
    if (!manufactureSku.trim()) missing.push({ tab: "basic", field: "제조사 SKU", inputName: "manufactureSku" });
    if (!origin) missing.push({ tab: "basic", field: "원산지", inputName: "origin" });
    
    const hasUpc = !!upc.trim();
    const hasEan = !!ean.trim();
    if (!hasUpc && !hasEan) {
      missing.push({ tab: "basic", field: "식별 바코드 (UPC 또는 EAN 중 최소 하나 필수)", inputName: "upc" });
    }
    
    if (sellingOnline && !salesLink1.trim()) {
      missing.push({ tab: "basic", field: "온라인 판매 링크 1", inputName: "salesLink1" });
    }

    // Category & Dynamic Attributes tab
    if (categoryCompletion) {
      if (!categoryCompletion.categoryComplete) {
        missing.push({ tab: "category_attributes", field: "카테고리 미선택 (3Depth 최종 카테고리 지정 필수)", inputName: "categorySelect" });
      } else if (!categoryCompletion.requiredAttributesComplete) {
        if (categoryCompletion.missingRequiredAttributes && categoryCompletion.missingRequiredAttributes.length > 0) {
          categoryCompletion.missingRequiredAttributes.forEach(attr => {
            missing.push({ tab: "category_attributes", field: `${attr.nameKo} (필수 속성)`, inputName: `attr-field-${attr.code}` });
          });
        } else {
          missing.push({ tab: "category_attributes", field: "카테고리 필수 속성 미입력", inputName: "categoryAttributes" });
        }
      }
    } else if (!product.category_code) {
      missing.push({ tab: "category_attributes", field: "카테고리 및 속성 미선택", inputName: "categorySelect" });
    }
    
    // Price Info tab
    const krw = Number(priceKrwRetail || 0);
    if (!priceKrwRetail || krw <= 0) {
      missing.push({ tab: "price", field: "한국 소비자 판매가", inputName: "priceKrwRetail" });
    }
    const usd = Number(priceUsdFobState || 0);
    if (!priceUsdFobState || usd <= 0) {
      missing.push({ tab: "price", field: "미국 수출 FOB 가격", inputName: "priceUsdFob" });
    }
    
    // Logistics tab
    const iw = Number(itemWidth || 0);
    const id = Number(itemDepth || 0);
    const ih = Number(itemHeight || 0);
    const iwt = Number(itemWeight || 0);
    if (!itemWidth || iw <= 0 || !itemDepth || id <= 0 || !itemHeight || ih <= 0 || !itemWeight || iwt <= 0) {
      missing.push({ tab: "logistics", field: "단품 규격 (가로/세로/높이/무게)", inputName: "itemWidth" });
    }
    
    const pw = Number(packageWidth || 0);
    const pd = Number(packageDepth || 0);
    const ph = Number(packageHeight || 0);
    const pwt = Number(packageWeight || 0);
    if (!packageWidth || pw <= 0 || !packageDepth || pd <= 0 || !packageHeight || ph <= 0 || !packageWeight || pwt <= 0) {
      missing.push({ tab: "logistics", field: "단품 포장 패키지 규격 (가로/세로/높이/무게)", inputName: "packageWidth" });
    }

    const cq = Number(cartonPackQty || 0);
    const cw = Number(cartonWidth || 0);
    const cd = Number(cartonDepth || 0);
    const ch = Number(cartonHeight || 0);
    const cwt = Number(cartonWeight || 0);
    if (!cartonPackQty || cq <= 0 || !cartonWidth || cw <= 0 || !cartonDepth || cd <= 0 || !cartonHeight || ch <= 0 || !cartonWeight || cwt <= 0) {
      missing.push({ tab: "logistics", field: "마스터 카톤 규격 (입수량/가로/세로/높이/무게)", inputName: "cartonPackQty" });
    }
    
    // Media tab
    if (localImages.length === 0) {
      missing.push({ tab: "media", field: "대표 이미지 (최소 1개 이상의 제품 이미지 필수)", inputName: "images" });
    }
    
    return missing;
  };

  const getCriticalErrors = () => {
    const errors = [];
    
    const hasUpc = !!upc.trim();
    const hasEan = !!ean.trim();
    
    // 1. Barcode missing (both empty)
    if (!hasUpc && !hasEan) {
      errors.push({ 
        tab: "basic", 
        field: "식별 바코드", 
        inputName: "upc", 
        message: "미국 바코드(UPC) 또는 유럽 바코드(EAN) 중 최소 하나는 반드시 입력해야 합니다." 
      });
    }
    
    // 3. Online sales link missing
    if (sellingOnline && !salesLink1.trim()) {
      errors.push({ 
        tab: "basic", 
        field: "온라인 판매 링크 1", 
        inputName: "salesLink1", 
        message: "온라인 판매 중인 경우, 최소 한 개 이상의 판매 링크(링크 1)를 입력해 주세요." 
      });
    }

    // 4. Tiered Supply Prices validation (partial input check)
    const hasIncompleteTier = priceTiers.some((tier) => {
      const q = String(tier.qty ?? "").trim();
      const p = String(tier.price ?? "").trim();
      return (q !== "" && p === "") || (q === "" && p !== "");
    });
    if (hasIncompleteTier) {
      errors.push({
        tab: "price",
        field: "수량별 B2B 공급 가격",
        inputName: "priceTiers",
        message: "수량별 B2B 공급가 항목에서 최소 주문 수량과 구간별 공급 단가를 모두 입력해 주세요."
      });
    }
    
    return errors;
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

  // Helper to detect missing fields required for container simulation
  const getMissingContainerSimFields = () => {
    const missing = [];
    const cbm = Number(cartonCbm || 0);
    const packQty = Number(cartonPackQty || 0);
    const weight = Number(cartonWeight || 0);

    if (!cbm || cbm <= 0) missing.push("마스터 카톤 규격 (CBM)");
    if (!packQty || packQty <= 0) missing.push("마스터 카톤 입수 수량");
    if (!weight || weight <= 0) missing.push("마스터 카톤 무게");

    return missing;
  };

  // Dynamic Container Simulator Calculation (20FT=28 CBM, 40FT=58 CBM, 40HQ=68 CBM)
  const computeContainerSim = (maxCbm: number) => {
    const cbm = Number(cartonCbm || 0);
    const packQty = Number(cartonPackQty || 0);
    const weight = Number(cartonWeight || 0);

    if (!cbm || cbm <= 0) {
      return {
        isValid: false,
        cartons: 0,
        products: 0,
        totalWeight: "0",
        totalCbm: "0",
        maxCbm,
      };
    }

    const cartons = Math.floor(maxCbm / cbm);
    const products = packQty > 0 ? cartons * packQty : 0;
    const totalWeight = weight > 0 ? (cartons * weight).toFixed(2) : "0";
    const totalCbm = (cartons * cbm).toFixed(3);

    return {
      isValid: true,
      cartons,
      products,
      totalWeight,
      totalCbm,
      maxCbm,
    };
  };

  const sim20FT = computeContainerSim(28);
  const sim40FT = computeContainerSim(58);
  const sim40HQ = computeContainerSim(68);

  // Quick helper to fill simulation values into Container manual input fields
  const apply20ftSimulation = () => {
    setC20Qty(sim20FT.cartons.toString());
    setC20Weight(sim20FT.totalWeight);
    setC20Cbm(sim20FT.totalCbm);
  };

  const apply40ftSimulation = () => {
    setC40Qty(sim40FT.cartons.toString());
    setC40Weight(sim40FT.totalWeight);
    setC40Cbm(sim40FT.totalCbm);
  };

  const apply40hqSimulation = () => {
    setC40hqQty(sim40HQ.cartons.toString());
    setC40hqWeight(sim40HQ.totalWeight);
    setC40hqCbm(sim40HQ.totalCbm);
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
  const addPriceTier = () => setPriceTiers([...priceTiers, { qty: "", price: "" }]);
  const removePriceTier = (idx: number) => {
    const updated = priceTiers.filter((_, i) => i !== idx);
    while (updated.length < 2) {
      updated.push({ qty: "", price: "" });
    }
    setPriceTiers(updated);
  };
  const updatePriceTier = (idx: number, field: "qty" | "price", val: string | number) => {
    const updated = [...priceTiers];
    updated[idx] = { ...updated[idx], [field]: val };
    setPriceTiers(updated);
  };

  const isBasicDirty = (
    nameEn !== initialSnapshotRef.current.nameEn ||
    name !== initialSnapshotRef.current.name ||
    manufactureSku !== initialSnapshotRef.current.manufactureSku ||
    brandId !== initialSnapshotRef.current.brandId ||
    category !== initialSnapshotRef.current.category ||
    volume !== initialSnapshotRef.current.volume ||
    origin !== initialSnapshotRef.current.origin ||
    leadTimeValue !== initialSnapshotRef.current.leadTimeValue ||
    leadTimeUnit !== initialSnapshotRef.current.leadTimeUnit ||
    color !== initialSnapshotRef.current.color ||
    colorMap !== initialSnapshotRef.current.colorMap ||
    description !== initialSnapshotRef.current.description ||
    ingredientsText !== initialSnapshotRef.current.ingredientsText ||
    isParentSku !== initialSnapshotRef.current.isParentSku ||
    isChildSku !== initialSnapshotRef.current.isChildSku ||
    upc !== initialSnapshotRef.current.upc ||
    ean !== initialSnapshotRef.current.ean ||
    sellingOnline !== initialSnapshotRef.current.sellingOnline ||
    sellingOffline !== initialSnapshotRef.current.sellingOffline ||
    salesLink1 !== initialSnapshotRef.current.salesLink1 ||
    salesLink2 !== initialSnapshotRef.current.salesLink2 ||
    JSON.stringify(bullets) !== initialSnapshotRef.current.bullets
  );

  const isCategoryDirty = isCatAttrDirty;

  const isPriceDirty = (
    priceKrwRetail !== initialSnapshotRef.current.priceKrwRetail ||
    priceKrwWholesale !== initialSnapshotRef.current.priceKrwWholesale ||
    estimatedRetailPrice !== initialSnapshotRef.current.estimatedRetailPrice ||
    priceUsdFobState !== initialSnapshotRef.current.priceUsdFobState ||
    JSON.stringify(normalizePriceTiers(priceTiers)) !== initialSnapshotRef.current.priceTiers
  );

  const isLogisticsDirty = (
    itemWidth !== initialSnapshotRef.current.itemWidth ||
    itemDepth !== initialSnapshotRef.current.itemDepth ||
    itemHeight !== initialSnapshotRef.current.itemHeight ||
    itemWeight !== initialSnapshotRef.current.itemWeight ||
    packageWidth !== initialSnapshotRef.current.packageWidth ||
    packageDepth !== initialSnapshotRef.current.packageDepth ||
    packageHeight !== initialSnapshotRef.current.packageHeight ||
    packageWeight !== initialSnapshotRef.current.packageWeight ||
    cartonPackQty !== initialSnapshotRef.current.cartonPackQty ||
    cartonWidth !== initialSnapshotRef.current.cartonWidth ||
    cartonDepth !== initialSnapshotRef.current.cartonDepth ||
    cartonHeight !== initialSnapshotRef.current.cartonHeight ||
    cartonWeight !== initialSnapshotRef.current.cartonWeight ||
    paletteCartonQty !== initialSnapshotRef.current.paletteCartonQty ||
    paletteWidth !== initialSnapshotRef.current.paletteWidth ||
    paletteDepth !== initialSnapshotRef.current.paletteDepth ||
    paletteHeight !== initialSnapshotRef.current.paletteHeight ||
    paletteWeight !== initialSnapshotRef.current.paletteWeight ||
    c20Qty !== initialSnapshotRef.current.c20Qty ||
    c20Weight !== initialSnapshotRef.current.c20Weight ||
    c20Cbm !== initialSnapshotRef.current.c20Cbm ||
    c40Qty !== initialSnapshotRef.current.c40Qty ||
    c40Weight !== initialSnapshotRef.current.c40Weight ||
    c40Cbm !== initialSnapshotRef.current.c40Cbm ||
    c40hqQty !== initialSnapshotRef.current.c40hqQty ||
    c40hqWeight !== initialSnapshotRef.current.c40hqWeight ||
    c40hqCbm !== initialSnapshotRef.current.c40hqCbm
  );

  const isMediaDirty = pendingImages.length > 0;
  const isAnyDirty = isBasicDirty || isCategoryDirty || isPriceDirty || isLogisticsDirty || isMediaDirty;

  const handleTabChange = (targetTab: "basic" | "category_attributes" | "price" | "logistics" | "media" | "certs") => {
    if (pendingImages.length > 0 && activeTab === "media" && targetTab !== "media") {
      const confirmLeave = window.confirm(
        "선택한 이미지가 아직 추가되지 않았습니다.\n다른 탭으로 이동하면 선택한 이미지 목록이 취소됩니다. 이동하시겠습니까?"
      );
      if (!confirmLeave) return;
    }
    setActiveTab(targetTab);
  };

  const saveAllData = async (): Promise<{ success: boolean; error?: string }> => {
    if (isSaving) return { success: false, error: "저장 중입니다." };
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const criticalErrors = getCriticalErrors();
      if (criticalErrors.length > 0) {
        const firstError = criticalErrors[0];
        setActiveTab(firstError.tab as any);
        
        setTimeout(() => {
          const inputElement = document.getElementsByName(firstError.inputName)[0] as HTMLInputElement | undefined;
          if (inputElement) {
            inputElement.focus();
            if (inputElement.select) inputElement.select();
          }
        }, 80);

        const errorMsg = firstError.message;
        setStatusMessage({ 
          type: "error", 
          text: errorMsg
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return { success: false, error: errorMsg };
      }

      // 2. Validate category & dynamic attributes if category form ref is present
      if (categoryAttrRef.current) {
        const catValidation = categoryAttrRef.current.validate();
        if (!catValidation.isValid) {
          setActiveTab("category_attributes");
          const errText = `카테고리 필수 입력 속성이 누락되었습니다: ${catValidation.missingRequired.join(", ")}`;
          setStatusMessage({
            type: "error",
            text: errText,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return { success: false, error: errText };
        }
      }

      const formData = new FormData();
      formData.set("sellingOnline", sellingOnline ? "true" : "false");
      formData.set("sellingOffline", sellingOffline ? "true" : "false");
      formData.set("salesLink1", salesLink1.trim());
      formData.set("salesLink2", salesLink2.trim());
      formData.set("nameEn", nameEn.trim());
      formData.set("name", name.trim());
      formData.set("manufactureSku", trimSkuSeparators(manufactureSku));
      formData.set("brandId", brandId);
      formData.set("category", category);
      formData.set("volume", volume.trim());
      formData.set("origin", origin);
      formData.set("color", color.trim());
      formData.set("colorMap", colorMap);
      formData.set("description", description.trim());
      formData.set("ingredientsText", ingredientsText.trim());
      formData.set("parentSku", isParentSku ? "Y" : "");
      formData.set("childSku", isChildSku ? "Y" : "");
      formData.set("letustoSku", effectiveLetustoSku || product.letusto_sku || "");
      formData.set("upc", upc.trim());
      formData.set("ean", ean.trim());
      formData.set("priceKrwRetail", priceKrwRetail.trim());
      formData.set("priceKrwWholesale", priceKrwWholesale.trim());
      formData.set("estimatedRetailPrice", estimatedRetailPrice.trim());
      formData.set("priceUsdFob", priceUsdFobState ? priceUsdFobState.toString() : "");

      // Logistics fields
      formData.set("itemWidth", itemWidth);
      formData.set("itemDepth", itemDepth);
      formData.set("itemHeight", itemHeight);
      formData.set("itemWeight", itemWeight);
      formData.set("packageWidth", packageWidth);
      formData.set("packageDepth", packageDepth);
      formData.set("packageHeight", packageHeight);
      formData.set("packageWeight", packageWeight);
      formData.set("cartonPackQty", cartonPackQty);
      formData.set("cartonWidth", cartonWidth);
      formData.set("cartonDepth", cartonDepth);
      formData.set("cartonHeight", cartonHeight);
      formData.set("cartonWeight", cartonWeight);
      formData.set("cartonCbm", cartonCbm);
      formData.set("paletteCartonQty", paletteCartonQty);
      formData.set("paletteWidth", paletteWidth);
      formData.set("paletteDepth", paletteDepth);
      formData.set("paletteHeight", paletteHeight);
      formData.set("paletteWeight", paletteWeight);
      formData.set("container20ftQty", c20Qty);
      formData.set("container20ftWeight", c20Weight);
      formData.set("container20ftCbm", c20Cbm);
      formData.set("container40ftQty", c40Qty);
      formData.set("container40ftWeight", c40Weight);
      formData.set("container40ftCbm", c40Cbm);
      formData.set("container40fthcQty", c40hqQty);
      formData.set("container40fthcWeight", c40hqWeight);
      formData.set("container40fthcCbm", c40hqCbm);

      if (leadTimeValue.trim()) {
        formData.set("leadTime", `${leadTimeValue.trim()} ${leadTimeUnit}`);
      } else {
        formData.set("leadTime", "");
      }
      formData.set("leadTimeValue", leadTimeValue.trim());
      formData.set("leadTimeUnit", leadTimeUnit);

      bullets.forEach((b) => {
        if (b.trim()) {
          formData.append("bulletPoints", b.trim());
        }
      });

      const validPriceTiers = normalizePriceTiers(priceTiers);
      formData.append("priceTiers", JSON.stringify(validPriceTiers));

      if (categoryAttrRef.current) {
        const catRes = await categoryAttrRef.current.save();
        if (!catRes.success) {
          const catErr = catRes.error || "카테고리 및 속성 저장 중 오류가 발생했습니다.";
          setStatusMessage({
            type: "error",
            text: catErr,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return { success: false, error: catErr };
        }
      }

      const res = await updateProduct(product.id, undefined, formData);
      if (res?.error) {
        setStatusMessage({ type: "error", text: res.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return { success: false, error: res.error };
      }

      // Update initial baseline snapshots
      initialSnapshotRef.current = {
        nameEn,
        name,
        manufactureSku,
        brandId,
        category,
        volume,
        origin,
        leadTimeValue,
        leadTimeUnit,
        color,
        colorMap,
        description,
        ingredientsText,
        isParentSku,
        isChildSku,
        upc,
        ean,
        sellingOnline,
        sellingOffline,
        salesLink1,
        salesLink2,
        bullets: JSON.stringify(bullets),
        priceKrwRetail,
        priceKrwWholesale,
        estimatedRetailPrice,
        priceUsdFobState: priceUsdFobState ? priceUsdFobState.toString() : "",
        priceTiers: JSON.stringify(validPriceTiers),
        itemWidth,
        itemDepth,
        itemHeight,
        itemWeight,
        packageWidth,
        packageDepth,
        packageHeight,
        packageWeight,
        cartonPackQty,
        cartonWidth,
        cartonDepth,
        cartonHeight,
        cartonWeight,
        paletteCartonQty,
        paletteWidth,
        paletteDepth,
        paletteHeight,
        paletteWeight,
        c20Qty,
        c20Weight,
        c20Cbm,
        c40Qty,
        c40Weight,
        c40Cbm,
        c40hqQty,
        c40hqWeight,
        c40hqCbm
      };
      setIsCatAttrDirty(false);

      setStatusMessage({ type: "success", text: "변경사항이 성공적으로 저장되었습니다." });
      startTransition(() => {
        router.refresh();
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return { success: true };
    } catch (err: any) {
      const errMsg = err.message || "저장 중 예상치 못한 오류가 발생했습니다.";
      setStatusMessage({
        type: "error",
        text: errMsg,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return { success: false, error: errMsg };
    } finally {
      setIsSaving(false);
    }
  };

  const { guardModalNode, confirmNavigation } = useUnsavedChangesGuard({
    isDirty: isAnyDirty,
    onSave: async () => {
      return await saveAllData();
    },
  });

  const handleSaveClick = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    await saveAllData();
  };

  const handleMainFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await saveAllData();
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
    <div data-active-tab={activeTab} className="space-y-6 w-full max-w-7xl">
      {guardModalNode}

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

      {/* Soft-Deleted Product Banner */}
      {isDeleted && (
        <div className="rounded-xl border border-zinc-300 bg-zinc-100/90 p-5 dark:border-zinc-800 dark:bg-zinc-850 shadow-xs">
          <div className="flex items-start gap-3 text-zinc-700 dark:text-zinc-300">
            <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 text-[11px] font-bold dark:bg-zinc-700 dark:text-zinc-200">
              ℹ️
            </span>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                삭제(비활성화)된 제품
              </h4>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                본 제품은 현재 비활성화(삭제) 상태입니다. 상품 정보는 안전하게 보존되어 조회할 수 있습니다.
              </p>
            </div>
          </div>
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
                {getMissingFieldsList().map((item, idx) => {
                  const tabLabels: Record<string, string> = {
                    basic: "기본 정보",
                    category_attributes: "카테고리 & 속성",
                    price: "가격 정보",
                    logistics: "로지스틱스",
                    media: "미디어",
                    certs: "인허가 & 보증서",
                  };
                  return (
                    <button 
                      key={idx} 
                      type="button"
                      data-banner-jump={item.tab}
                      onClick={() => {
                        setActiveTab(item.tab as any);
                        setTimeout(() => {
                          if (item.tab === "category_attributes" && item.inputName.startsWith("attr-field-")) {
                            const el = document.getElementById(item.inputName);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              return;
                            }
                          }
                          const inputElement = document.getElementsByName(item.inputName)[0] as HTMLInputElement | undefined;
                          if (inputElement) {
                            inputElement.focus();
                            if (inputElement.select) inputElement.select();
                          }
                        }, 80);
                      }}
                      className="inline-flex items-center rounded-md bg-rose-100/70 hover:bg-rose-150 px-2.5 py-1 text-[10px] font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40 transition-colors cursor-pointer"
                    >
                      [{tabLabels[item.tab] || item.tab}] {item.field}
                    </button>
                  );
                })}
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
              <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
                {nameEn || product.name_en || name || product.name}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex flex-wrap gap-2 items-center">
                <span>브랜드: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{brandName}</strong></span>
                <span className="opacity-40">•</span>
                <span>
                  Letusto SKU:{" "}
                  {effectiveLetustoSku ? (
                    <strong className="text-indigo-650 dark:text-indigo-400 font-mono font-bold">{effectiveLetustoSku}</strong>
                  ) : (
                    <strong className="text-zinc-400 dark:text-zinc-500 font-mono font-medium">지정 대기 중</strong>
                  )}
                </span>
                <span className="opacity-40">•</span>
                <span>
                  제조사 SKU: <strong className="text-zinc-700 dark:text-zinc-300 font-mono font-bold">{effectiveManufactureSku || manufactureSku || product.manufacture_sku || "-"}</strong>
                </span>
              </p>

              {/* 3-Status Badges: Registration, Selection, Sales */}
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                {/* 1. Registration Status Badge */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">등록 상태:</span>
                  {isDeleted ? (
                    <span className="inline-flex items-center rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-2 py-0.5 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                      Deleted (삭제됨)
                    </span>
                  ) : getMissingFieldsList().length > 0 ? (
                    <span className="inline-flex items-center rounded bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 px-2 py-0.5 text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 whitespace-nowrap">
                      Draft (보완 대기)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/50 whitespace-nowrap">
                      등록 완료
                    </span>
                  )}
                </div>

                <span className="text-zinc-300 dark:text-zinc-700">•</span>

                {/* 2. Selection Status Badge (Read Only) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">선정 상태:</span>
                  {(() => {
                    const selKey = (product.selection_status || "UNREVIEWED") as SelectionStatus;
                    const label = SELECTION_STATUS_LABELS[selKey] || product.selection_status || "미검토";
                    const style = SELECTION_STATUS_STYLES[selKey] || {
                      bg: "bg-zinc-100 dark:bg-zinc-800",
                      text: "text-zinc-700 dark:text-zinc-300",
                      border: "border-zinc-200 dark:border-zinc-700",
                    };
                    return (
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${style.bg} ${style.text} ${style.border} whitespace-nowrap`}
                        title="어드민 검토 상태 (Read Only)"
                      >
                        {label}
                      </span>
                    );
                  })()}
                </div>

                <span className="text-zinc-300 dark:text-zinc-700">•</span>

                {/* 3. Sales Status Badge (Read Only) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">판매 상태:</span>
                  {(() => {
                    const salesKey = (product.sales_status || "PREPARING") as SalesStatus;
                    const label = SALES_STATUS_LABELS[salesKey] || product.sales_status || "판매 준비";
                    const style = SALES_STATUS_STYLES[salesKey] || {
                      bg: "bg-zinc-100 dark:bg-zinc-800",
                      text: "text-zinc-700 dark:text-zinc-300",
                      border: "border-zinc-200 dark:border-zinc-700",
                    };
                    return (
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${style.bg} ${style.text} ${style.border} whitespace-nowrap`}
                        title="어드민 판매 운영 상태 (Read Only)"
                      >
                        {label}
                      </span>
                    );
                  })()}
                </div>

                <span className="text-zinc-300 dark:text-zinc-700">•</span>

                {/* 4. Attribute Completion Badge */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">속성 완성도:</span>
                  {(() => {
                    const percent = categoryCompletion?.completionPercent ?? initialCategoryCompletion?.completionPercent ?? 0;
                    const is100 = percent === 100;
                    const isHalf = percent >= 50;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap font-mono ${
                          is100
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                            : isHalf
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
                        }`}
                        title="카테고리 필수/권장 속성 입력 완성도"
                      >
                        {percent}%
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isAnyDirty && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>저장되지 않은 변경사항이 있습니다.</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => confirmNavigation("/portal/products")}
              className="w-full sm:w-auto text-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 px-5 py-2.5 text-xs font-bold text-zinc-700 transition-all dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
            >
              목록으로 돌아가기
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving}
              className="w-full sm:w-auto text-center rounded-lg bg-zinc-900 hover:bg-zinc-850 px-5 py-2.5 text-xs font-bold text-white transition-all shadow dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "변경사항 저장"}
            </button>
          </div>
        </div>

        {/* Elegant Glassmorphic Tab Navigation */}
        <div data-tab-nav="true" className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar scroll-smooth gap-1">
          {[
            { id: "basic", label: "기본 정보", isDirty: isBasicDirty },
            { id: "category_attributes", label: "카테고리 & 속성", isDirty: isCategoryDirty },
            { id: "price", label: "가격 정보", isDirty: isPriceDirty },
            { id: "logistics", label: "로지스틱스", isDirty: isLogisticsDirty },
            { id: "media", label: "미디어 (이미지/비디오)", isDirty: isMediaDirty },
            { id: "certs", label: "인허가 & 보증서", isDirty: false }
          ].map((tab) => {
            const missingList = getMissingFieldsList();
            const hasError = missingList.some((item) => item.tab === tab.id);
            return (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id as any)}
                className={`px-5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                <span>{tab.label}</span>
                {tab.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm" title="저장되지 않은 변경사항" />
                )}
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
                  value={manufactureSku} 
                  onChange={(e) => setManufactureSku(sanitizeSku(e.target.value))}
                  onBlur={(e) => setManufactureSku(trimSkuSeparators(e.target.value))}
                  placeholder="제조사의 실제 SKU 코드"
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none font-mono ${!manufactureSku.trim() ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-550 mt-1 leading-normal">
                  ※ 영문 대문자, 숫자, 하이픈(-), 언더스코어(_)만 허용됩니다. (소문자는 자동 대문자 변환, 공백 및 기타 특수문자 제한)
                </p>
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="한글 제품명"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">브랜드 <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <select
                  name="brandId"
                  value={brandId}
                  onChange={handleBrandSelectChange}
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
                  <option disabled value="">────────────</option>
                  <option value={NEW_BRAND_ACTION} className="font-semibold text-emerald-600 dark:text-emerald-400">
                    + 브랜드 추가
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">카테고리 <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <select
                  name="category"
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  className={`block w-full rounded-lg border px-3.5 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white focus:outline-none ${!category ? "border-rose-350 dark:border-rose-900/60 focus:border-rose-500" : "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white"}`}
                >
                  <option value="">카테고리 선택</option>
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
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
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
                    value={leadTimeValue}
                    onChange={(e) => setLeadTimeValue(e.target.value)}
                    placeholder="숫자 입력"
                    className="block w-2/3 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                  <select
                    name="leadTimeUnit"
                    value={leadTimeUnit}
                    onChange={(e) => setLeadTimeUnit(e.target.value)}
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
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="예: Coral Pink"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">컬러 맵 (Color Map)</label>
                <select
                  name="colorMap"
                  value={colorMap}
                  onChange={(e) => setColorMap(e.target.value)}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

        {/* Tab Panel 2: 카테고리 & 속성 */}
        <div className={activeTab === "category_attributes" ? "space-y-6" : "hidden"}>
          <CategoryAttributeForm
            ref={categoryAttrRef}
            productId={product.id}
            initialCategoryCode={(product as any).category_code || null}
            brandName={brandName}
            productName={name}
            productNameEn={nameEn || null}
            manufactureSku={manufactureSku || null}
            letustoSku={effectiveLetustoSku || null}
            origin={origin || null}
            volume={volume || null}
            colorMap={colorMap || null}
            isAdmin={false}
            onCompletionChange={handleCompletionChange}
            onDirtyChange={handleCatAttrDirtyChange}
          />
        </div>

        {/* Tab Panel 3: 가격 정보 */}
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
                    type="text"
                    inputMode="numeric"
                    value={priceKrwRetail}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPriceKrwRetail(e.target.value.replace(/[^0-9]/g, ""))}
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
                    type="text"
                    inputMode="numeric"
                    value={priceKrwWholesale}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPriceKrwWholesale(e.target.value.replace(/[^0-9]/g, ""))}
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
                    type="text"
                    inputMode="decimal"
                    value={estimatedRetailPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEstimatedRetailPrice(e.target.value.replace(/[^0-9.]/g, ""))}
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
                    type="text"
                    inputMode="decimal"
                    value={priceUsdFobState}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPriceUsdFobState(e.target.value.replace(/[^0-9.]/g, ""))}
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
                          type="text"
                          inputMode="numeric"
                          value={tier.qty}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updatePriceTier(idx, "qty", e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="100"
                          className="block w-full max-w-[200px] rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-full max-w-[150px]">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-zinc-450">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={tier.price}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updatePriceTier(idx, "price", e.target.value.replace(/[^0-9.]/g, ""))}
                              placeholder="0.00"
                              className="block w-full rounded-lg border border-zinc-300 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          {(() => {
                            const fobNum = Number(priceUsdFobState) || 0;
                            const tierPriceNum = Number(tier.price) || 0;
                            if (fobNum > 0 && tierPriceNum > 0) {
                              const isDiscount = fobNum > tierPriceNum;
                              return (
                                <span className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-bold ${
                                  isDiscount
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900"
                                    : "bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-650 border border-zinc-150 dark:border-zinc-800"
                                }`}>
                                  {isDiscount
                                    ? `${(((fobNum - tierPriceNum) / fobNum) * 100).toFixed(1)}% 할인`
                                    : "0% 할인"}
                                </span>
                              );
                            }
                            return null;
                          })()}
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
          </div>
        </div>

        {/* Tab Panel 3: 로지스틱스 정보 */}
        <div className={activeTab === "logistics" ? "space-y-6" : "hidden"}>
          {/* Item */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col gap-1.5 border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M28 20V12h8v8" strokeLinecap="round"/>
                    <path d="M24 20h16v32a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V20z"/>
                    <line x1="32" y1="6" x2="32" y2="12" strokeLinecap="round"/>
                    <path d="M32 20v28" strokeDasharray="3 3"/>
                    <circle cx="32" cy="36" r="3" fill="currentColor"/>
                  </svg>
                  <span>1. 단품 규격 (Item Spec)</span>
                  <button
                    type="button"
                    onClick={() => openLogisticsHelp("item")}
                    aria-label="Item Spec 도움말"
                    title="Item Spec 도움말 보기"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer ml-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    ?
                  </button>
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                제품 자체의 실제 크기와 무게를 입력합니다. 튜브, 병, 용기 등 제품 본체 기준입니다.
              </p>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">가로 (Width, cm) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="itemWidth"
                  type="text"
                  inputMode="decimal"
                  value={itemWidth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setItemWidth(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">세로 (Depth, cm) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="itemDepth"
                  type="text"
                  inputMode="decimal"
                  value={itemDepth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setItemDepth(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">높이 (Height, cm) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="itemHeight"
                  type="text"
                  inputMode="decimal"
                  value={itemHeight}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setItemHeight(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">무게 (Weight, g) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="itemWeight"
                  type="text"
                  inputMode="decimal"
                  value={itemWeight}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setItemWeight(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
            </div>
          </div>

          {/* Package */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col gap-1.5 border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 12l16-6 16 6v36l-16 6-16-6V12z"/>
                    <path d="M16 12l16 6 16-6"/>
                    <path d="M32 18v38"/>
                    <path d="M16 22l16 6 16-6" opacity="0.6"/>
                  </svg>
                  <span>2. 단품 포장 패키지 규격 (Package Spec)</span>
                  <button
                    type="button"
                    onClick={() => openLogisticsHelp("package")}
                    aria-label="Package Spec 도움말"
                    title="Package Spec 도움말 보기"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer ml-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    ?
                  </button>
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                제품 1개의 최종 판매 포장 상태의 크기와 무게를 입력합니다. 단상자 등 판매용 포장은 포함하며, 택배·배송용 외부 박스는 포함하지 않습니다.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              {/* Width */}
              <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">가로 (Width, cm/inch) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-zinc-400 font-semibold block">cm</span>
                    <input
                      name="packageWidth"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={packageWidth}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWidthCmChange(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동 계산)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={packageWidthInch}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWidthInchChange(e.target.value.replace(/[^0-9.]/g, ""))}
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
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={packageDepth}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleDepthCmChange(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동 계산)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={packageDepthInch}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleDepthInchChange(e.target.value.replace(/[^0-9.]/g, ""))}
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
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={packageHeight}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleHeightCmChange(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">inch (자동 계산)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={packageHeightInch}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleHeightInchChange(e.target.value.replace(/[^0-9.]/g, ""))}
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
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={packageWeight}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightGChange(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">lb (자동)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.000"
                      value={packageWeightLb}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightLbChange(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold block">oz (자동)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={packageWeightOz}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightOzChange(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-0.5 block w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Master Carton */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-col gap-1.5 border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 18l22-8 22 8v28l-22 8-22-8V18z"/>
                    <path d="M10 18l22 8 22-8"/>
                    <path d="M32 26v28"/>
                    <path d="M32 10l11 4M32 10L21 14" opacity="0.8"/>
                    <path d="M21 21.5l11 4 11-4" strokeDasharray="2 2"/>
                  </svg>
                  <span>3. 마스터 카톤 규격 (Master Carton Specs)</span>
                  <button
                    type="button"
                    onClick={() => openLogisticsHelp("carton")}
                    aria-label="Master Carton 도움말"
                    title="Master Carton 도움말 보기"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer ml-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    ?
                  </button>
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                여러 개의 단품 판매 패키지를 담아 보관·운송하는 카톤의 입수 수량, 크기와 총중량을 입력합니다.
              </p>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">입수 수량 (Qty, 개) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="cartonPackQty"
                  type="text"
                  inputMode="numeric"
                  value={cartonPackQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCartonPackQty(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="1"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">가로 (Width, cm) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="cartonWidth"
                  type="text"
                  inputMode="decimal"
                  value={cartonWidth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCartonWidth(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">세로 (Depth, cm) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="cartonDepth"
                  type="text"
                  inputMode="decimal"
                  value={cartonDepth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCartonDepth(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">높이 (Height, cm) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="cartonHeight"
                  type="text"
                  inputMode="decimal"
                  value={cartonHeight}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCartonHeight(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-650 dark:text-zinc-300 mb-1">중량 (Weight, kg) <span className="text-rose-600 dark:text-rose-400 font-bold ml-0.5">*</span></label>
                <input
                  name="cartonWeight"
                  type="text"
                  inputMode="decimal"
                  value={cartonWeight}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCartonWeight(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
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
            <div className="flex flex-col gap-1.5 border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 50h48v4H8z"/>
                    <path d="M14 50v4M32 50v4M50 50v4"/>
                    <path d="M12 24h18v22H12zm22 6h18v16H34zM20 12h24v12H20z"/>
                  </svg>
                  <span>4. 팔레트 규격 (Pallet Specs)</span>
                  <button
                    type="button"
                    onClick={() => openLogisticsHelp("pallet")}
                    aria-label="Pallet Specs 도움말"
                    title="Pallet Specs 도움말 보기"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer ml-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    ?
                  </button>
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                여러 마스터 카톤을 팔레트에 적재한 최종 출고 상태의 정보를 입력합니다. 팔레트 자체를 포함한 전체 크기, 총중량, 적재 카톤 수를 기준으로 합니다.
              </p>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">박스수량 (Cartons)</label>
                <input
                  name="paletteCartonQty"
                  type="number"
                  value={paletteCartonQty}
                  onFocus={(e) => e.target.select()}
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
                  onFocus={(e) => e.target.select()}
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
                  onFocus={(e) => e.target.select()}
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
                  onFocus={(e) => e.target.select()}
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
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPaletteWeight(e.target.value)}
                  placeholder="0.0"
                  className="block w-full rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
            </div>
          </div>

          {/* Container Simulation & Overrides */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start justify-between border-b border-zinc-100 dark:border-zinc-850 pb-4">
              <div className="space-y-1.5 flex-1">
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
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                  본 시뮬레이터는 입력된 패키지 및 마스터 카톤 규격을 기준으로 한 <strong>이론적 적재 추정치</strong>입니다. 실제 선적 시 발생하는 적재 손실, 적재 방향, 혼적, 빈 공간, 마스터 카톤/팔레트 적재 제약 등은 반영되지 않으므로 참고용으로 활용해 주세요.
                </p>
              </div>
            </div>

            {/* Missing specs guidance banner */}
            {getMissingContainerSimFields().length > 0 && (
              <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <span className="font-bold block text-amber-950 dark:text-amber-100">컨테이너 적재 시뮬레이션을 위한 필수 미입력 항목</span>
                  <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">
                    시뮬레이션 자동 계산을 위해 상단 3. 마스터 카톤 규격 섹션에서 <strong>{getMissingContainerSimFields().join(", ")}</strong> 정보를 입력해 주세요.
                  </p>
                </div>
              </div>
            )}
            
            <div className="grid gap-6 md:grid-cols-3">
              {/* 20FT Container */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-850 pb-2 mb-3">
                    <div>
                      <span className="font-extrabold text-xs text-zinc-900 dark:text-white block">20FT Container</span>
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold">최대 28 CBM</span>
                    </div>
                    <button
                      type="button"
                      onClick={apply20ftSimulation}
                      disabled={!sim20FT.isValid}
                      className="rounded bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] px-2 py-1 cursor-pointer transition-colors"
                    >
                      시뮬레이션 값 적용
                    </button>
                  </div>
                  
                  {/* Simulator output */}
                  <div className="space-y-2 bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-900 text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 상품 수량</span>
                      <span className="font-extrabold font-mono text-indigo-650 dark:text-indigo-400 text-xs">
                        {sim20FT.isValid ? `${sim20FT.products.toLocaleString()} 개` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 카톤 수량</span>
                      <span className="font-extrabold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim20FT.isValid ? `${sim20FT.cartons.toLocaleString()} 카톤` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">예상 총 중량</span>
                      <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim20FT.isValid ? `${sim20FT.totalWeight} kg` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">예상 총 CBM</span>
                      <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim20FT.isValid ? `${sim20FT.totalCbm} CBM` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500">컨테이너 최대 CBM</span>
                      <span className="font-semibold text-[11px] text-zinc-600 dark:text-zinc-400">
                        28 CBM
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overrides Input */}
                <div className="space-y-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-850">
                  <p className="text-[10px] font-bold text-zinc-500">실제 최종 입력값 (수정 및 저장 가능):</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">수량(카톤)</label>
                      <input
                        name="container20ftQty"
                        type="number"
                        value={c20Qty}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC20Qty(e.target.value)}
                        placeholder="0"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">중량(kg)</label>
                      <input
                        name="container20ftWeight"
                        type="number"
                        step="0.01"
                        value={c20Weight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC20Weight(e.target.value)}
                        placeholder="0.00"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">총 CBM</label>
                      <input
                        name="container20ftCbm"
                        type="number"
                        step="0.001"
                        value={c20Cbm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC20Cbm(e.target.value)}
                        placeholder="0.000"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 40FT Container */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-850 pb-2 mb-3">
                    <div>
                      <span className="font-extrabold text-xs text-zinc-900 dark:text-white block">40FT Container</span>
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold">최대 58 CBM</span>
                    </div>
                    <button
                      type="button"
                      onClick={apply40ftSimulation}
                      disabled={!sim40FT.isValid}
                      className="rounded bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] px-2 py-1 cursor-pointer transition-colors"
                    >
                      시뮬레이션 값 적용
                    </button>
                  </div>
                  
                  {/* Simulator output */}
                  <div className="space-y-2 bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-900 text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 상품 수량</span>
                      <span className="font-extrabold font-mono text-indigo-650 dark:text-indigo-400 text-xs">
                        {sim40FT.isValid ? `${sim40FT.products.toLocaleString()} 개` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 카톤 수량</span>
                      <span className="font-extrabold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim40FT.isValid ? `${sim40FT.cartons.toLocaleString()} 카톤` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">예상 총 중량</span>
                      <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim40FT.isValid ? `${sim40FT.totalWeight} kg` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">예상 총 CBM</span>
                      <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim40FT.isValid ? `${sim40FT.totalCbm} CBM` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500">컨테이너 최대 CBM</span>
                      <span className="font-semibold text-[11px] text-zinc-600 dark:text-zinc-400">
                        58 CBM
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overrides Input */}
                <div className="space-y-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-850">
                  <p className="text-[10px] font-bold text-zinc-500">실제 최종 입력값 (수정 및 저장 가능):</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">수량(카톤)</label>
                      <input
                        name="container40ftQty"
                        type="number"
                        value={c40Qty}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC40Qty(e.target.value)}
                        placeholder="0"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">중량(kg)</label>
                      <input
                        name="container40ftWeight"
                        type="number"
                        step="0.01"
                        value={c40Weight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC40Weight(e.target.value)}
                        placeholder="0.00"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">총 CBM</label>
                      <input
                        name="container40ftCbm"
                        type="number"
                        step="0.001"
                        value={c40Cbm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC40Cbm(e.target.value)}
                        placeholder="0.000"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 40HQ Container */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-850 pb-2 mb-3">
                    <div>
                      <span className="font-extrabold text-xs text-zinc-900 dark:text-white block">40HQ Container</span>
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold">최대 68 CBM</span>
                    </div>
                    <button
                      type="button"
                      onClick={apply40hqSimulation}
                      disabled={!sim40HQ.isValid}
                      className="rounded bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] px-2 py-1 cursor-pointer transition-colors"
                    >
                      시뮬레이션 값 적용
                    </button>
                  </div>
                  
                  {/* Simulator output */}
                  <div className="space-y-2 bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-900 text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 상품 수량</span>
                      <span className="font-extrabold font-mono text-indigo-650 dark:text-indigo-400 text-xs">
                        {sim40HQ.isValid ? `${sim40HQ.products.toLocaleString()} 개` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">예상 카톤 수량</span>
                      <span className="font-extrabold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim40HQ.isValid ? `${sim40HQ.cartons.toLocaleString()} 카톤` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">예상 총 중량</span>
                      <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim40HQ.isValid ? `${sim40HQ.totalWeight} kg` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-1.5">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">예상 총 CBM</span>
                      <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                        {sim40HQ.isValid ? `${sim40HQ.totalCbm} CBM` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500">컨테이너 최대 CBM</span>
                      <span className="font-semibold text-[11px] text-zinc-600 dark:text-zinc-400">
                        68 CBM
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overrides Input */}
                <div className="space-y-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-850">
                  <p className="text-[10px] font-bold text-zinc-500">실제 최종 입력값 (수정 및 저장 가능):</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">수량(카톤)</label>
                      <input
                        name="container40fthcQty"
                        type="number"
                        value={c40hqQty}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC40hqQty(e.target.value)}
                        placeholder="0"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">중량(kg)</label>
                      <input
                        name="container40fthcWeight"
                        type="number"
                        step="0.01"
                        value={c40hqWeight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC40hqWeight(e.target.value)}
                        placeholder="0.00"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-0.5">총 CBM</label>
                      <input
                        name="container40fthcCbm"
                        type="number"
                        step="0.001"
                        value={c40hqCbm}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setC40hqCbm(e.target.value)}
                        placeholder="0.000"
                        className="block w-full text-center rounded border border-zinc-300 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-850 pb-3 gap-3">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              제품 이미지 관리 (최대 10장)
            </h2>
            <div className="flex items-center gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span>등록된 이미지: <strong className="text-zinc-900 dark:text-white font-bold">{localImages.length}개</strong></span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span>추가 대기 이미지: <strong className="text-indigo-650 dark:text-indigo-400 font-bold">{pendingImages.length}개</strong></span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span>최대: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">10개</strong></span>
            </div>
          </div>
          
          {/* Upload Guidelines Helper Section */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
              <span>💡</span>
              <span>제품 이미지 업로드 가이드 (Upload Guidelines)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">최대 등록 수:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">최대 10장</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">허용 확장자:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">JPG, PNG, WEBP</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">파일당 용량:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">최대 10MB</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">권장 해상도:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">1000×1000px 이상 (1:1)</span>
              </div>
            </div>
          </div>

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
                      draggedIndex === i 
                        ? "opacity-40 border-dashed border-indigo-500 ring-2 ring-indigo-500/20" 
                        : i === 0
                          ? "border-amber-500 dark:border-amber-400 border-2 shadow-amber-100/50 dark:shadow-none ring-2 ring-amber-500/10"
                          : "border-zinc-150 dark:border-zinc-800"
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

          {/* Staging Area for Selected Pending Files */}
          {pendingImages.length > 0 && (
            <div className="mt-4 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/30 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-2.5">
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <span className="text-base">📸</span>
                  <span>
                    추가 대기 목록 ({pendingImages.length}개 선택됨
                    {pendingImages.some((p) => p.error) && (
                      <span className="text-rose-600 dark:text-rose-400 font-bold ml-1.5 text-[11px]">
                        • {pendingImages.filter((p) => p.error).length}개 오류
                      </span>
                    )}
                    )
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  아래 [선택한 이미지 {pendingImages.filter((p) => !p.error).length}개 추가] 버튼을 눌러야 저장됩니다.
                </span>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                {pendingImages.map((img) => (
                  <div
                    key={img.id}
                    className={`relative group border rounded-xl p-2 bg-white dark:bg-zinc-900 shadow-sm w-36 flex flex-col items-center text-center ${
                      img.error
                        ? "border-rose-400 dark:border-rose-700 ring-2 ring-rose-400/20 bg-rose-50/20 dark:bg-rose-950/20"
                        : "border-indigo-200 dark:border-indigo-800"
                    }`}
                  >
                    <div className="relative w-full h-24">
                      <img
                        src={img.previewUrl}
                        alt={img.file.name}
                        className="h-24 w-full rounded-lg object-cover border border-zinc-100 dark:border-zinc-800"
                      />
                      {img.error && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center p-1">
                          <span className="text-[10px] font-extrabold text-white bg-rose-600/90 px-1.5 py-0.5 rounded shadow">
                            업로드 불가
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold text-zinc-900 dark:text-white truncate w-full px-1" title={img.file.name}>
                      {img.file.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {img.formattedSize}
                    </p>

                    {img.error && (
                      <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-tight px-1 break-words w-full">
                        ⚠️ {img.error}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemovePendingImage(img.id)}
                      className="mt-2 w-full rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold py-1 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer flex items-center justify-center gap-1"
                      title="이 선택 파일 제외"
                    >
                      <span>✕</span>
                      <span>제외</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-indigo-100 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-indigo-900 dark:text-indigo-200 font-semibold">
                  {pendingImages.filter((p) => !p.error).length > 0
                    ? `유효한 ${pendingImages.filter((p) => !p.error).length}개의 이미지를 업로드할 수 있습니다.`
                    : "선택된 파일 중 업로드 가능한 파일이 없습니다. 오류 항목을 확인해주세요."}
                </p>
                <button
                  type="button"
                  onClick={handleUploadPendingImages}
                  disabled={uploadingImages || pendingImages.filter((p) => !p.error).length === 0}
                  className="rounded-xl bg-indigo-650 hover:bg-indigo-700 active:scale-95 text-white px-6 py-2.5 text-xs font-extrabold shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-indigo-500 ring-2 ring-indigo-500/30 shrink-0"
                >
                  {uploadingImages ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>이미지 업로드 중...</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>선택한 이미지 {pendingImages.filter((p) => !p.error).length}개 추가</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {localImages.length + pendingImages.filter((p) => !p.error).length < 10 && (
            <div className="mt-6 border-t border-zinc-100 dark:border-zinc-850 pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  컴퓨터에서 이미지 선택 (다중 선택 가능)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className="block w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-750 cursor-pointer"
                />
              </div>
              <div className="text-[11px] text-zinc-400 self-end pb-1.5 font-medium">
                (등록 가능: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{10 - localImages.length - pendingImages.filter((p) => !p.error).length}</strong>장 남음)
              </div>
            </div>
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

      {/* Bottom Save Button Row */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div>
          {isAnyDirty && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>저장되지 않은 변경사항이 있습니다.</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          className="rounded bg-zinc-950 px-6 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
        >
          {isSaving ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
      {/* Logistics Visual Help Modal */}
      <LogisticsHelpModal
        isOpen={isLogisticsHelpOpen}
        onClose={() => setIsLogisticsHelpOpen(false)}
        initialSection={activeLogisticsHelpSection}
      />
    </div>
  );
}
