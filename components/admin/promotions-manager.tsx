"use client";

import React, { useState, useMemo } from "react";
import {
  type AdminPromotionSummary,
  createAdminPromotionAction,
  updateAdminPromotionAction,
  setAdminPromotionStatusAction,
  deleteAdminDraftPromotionAction,
  getAdminPromotionDetailAction,
  type SavePromotionPayload,
} from "@/lib/retailer/promotion-actions";
import {
  generateRandomPromoCode,
  formatPromotionRulePreview,
  type PromotionStatus,
  type PromotionTriggerType,
  type PromotionDiscountType,
  type PromotionAppliesToScope,
  type PromotionRetailerScope,
} from "@/lib/retailer/promotion-types";
import { DateTimeField } from "@/components/admin/date-time-field";

interface FormOptions {
  products: Array<{ id: string; name: string; sku: string; brand_name: string }>;
  brands: Array<{ id: string; name: string }>;
  categories: Array<{ code: string; label: string }>;
  retailers: Array<{ id: string; name: string; code?: string }>;
}

interface PromotionsManagerProps {
  initialPromotions: AdminPromotionSummary[];
  options: FormOptions;
}

export function AdminPromotionsManager({
  initialPromotions,
  options,
}: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState<AdminPromotionSummary[]>(initialPromotions);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<AdminPromotionSummary | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailPromo, setDetailPromo] = useState<AdminPromotionSummary | null>(null);
  const [detailUsages, setDetailUsages] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [internalDescription, setInternalDescription] = useState("");
  const [triggerType, setTriggerType] = useState<PromotionTriggerType>("coupon");
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<PromotionDiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [maximumDiscount, setMaximumDiscount] = useState<string>("");
  const [status, setStatus] = useState<PromotionStatus>("active");
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [noExpiration, setNoExpiration] = useState(true);
  const [appliesToScope, setAppliesToScope] = useState<PromotionAppliesToScope>("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedCategoryCodes, setSelectedCategoryCodes] = useState<string[]>([]);
  const [retailerScope, setRetailerScope] = useState<PromotionRetailerScope>("all");
  const [selectedRetailerIds, setSelectedRetailerIds] = useState<string[]>([]);
  const [minimumSpend, setMinimumSpend] = useState<string>("");
  const [minimumQuantity, setMinimumQuantity] = useState<string>("");
  const [totalUsageLimit, setTotalUsageLimit] = useState<string>("");
  const [perRetailerUsageLimit, setPerRetailerUsageLimit] = useState<string>("");
  const [combinableWithQuantityTiers, setCombinableWithQuantityTiers] = useState(true);
  const [combinableWithAutomaticPromotions, setCombinableWithAutomaticPromotions] = useState(false);

  // BOGO fields
  const [bogoBuyQuantity, setBogoBuyQuantity] = useState<string>("5");
  const [bogoGetQuantity, setBogoGetQuantity] = useState<string>("1");
  const [bogoDiscountPercent, setBogoDiscountPercent] = useState<string>("100");

  // Search & filter states for modal selectors
  const [productSearch, setProductSearch] = useState("");
  const [showSelectedProductsOnly, setShowSelectedProductsOnly] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [retailerSearch, setRetailerSearch] = useState("");
  const [showSelectedRetailersOnly, setShowSelectedRetailersOnly] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate live effective status for each promotion
  const getComputedStatus = (p: AdminPromotionSummary): string => {
    if (p.status === "archived") return "archived";
    if (p.status === "draft") return "draft";
    if (p.status === "paused") return "paused";

    if (!p.no_expiration) {
      const now = new Date();
      if (p.start_at && new Date(p.start_at) > now) return "scheduled";
      if (p.end_at && new Date(p.end_at) < now) return "expired";
    }
    return "active";
  };

  // Filtered promotions
  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      const computed = getComputedStatus(p);
      if (activeTab !== "all" && computed !== activeTab) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCode = p.code ? p.code.toLowerCase().includes(q) : false;
        const matchesDesc = p.internal_description ? p.internal_description.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }

      return true;
    });
  }, [promotions, activeTab, searchQuery]);

  // Filtered selector lists
  const filteredProducts = useMemo(() => {
    return options.products.filter((p) => {
      if (showSelectedProductsOnly && !selectedProductIds.includes(p.id)) {
        return false;
      }
      if (!productSearch.trim()) return true;
      const q = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand_name && p.brand_name.toLowerCase().includes(q))
      );
    });
  }, [options.products, productSearch, showSelectedProductsOnly, selectedProductIds]);

  const filteredBrands = useMemo(() => {
    return options.brands.filter((b) => {
      if (!brandSearch.trim()) return true;
      return b.name.toLowerCase().includes(brandSearch.toLowerCase());
    });
  }, [options.brands, brandSearch]);

  const filteredCategories = useMemo(() => {
    return options.categories.filter((c) => {
      if (!categorySearch.trim()) return true;
      const q = categorySearch.toLowerCase();
      return c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    });
  }, [options.categories, categorySearch]);

  const filteredRetailers = useMemo(() => {
    return options.retailers.filter((r) => {
      if (showSelectedRetailersOnly && !selectedRetailerIds.includes(r.id)) {
        return false;
      }
      if (!retailerSearch.trim()) return true;
      const q = retailerSearch.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.code && r.code.toLowerCase().includes(q));
    });
  }, [options.retailers, retailerSearch, showSelectedRetailersOnly, selectedRetailerIds]);

  const handleOpenCreateForm = () => {
    setEditingPromo(null);
    setName("");
    setInternalDescription("");
    setTriggerType("coupon");
    setCode(generateRandomPromoCode("KS"));
    setDiscountType("percentage");
    setDiscountValue("10");
    setMaximumDiscount("");
    setStatus("active");

    const now = new Date();
    const startIso = `${now.toISOString().split("T")[0]}T${now.getHours().toString().padStart(2, "0")}:00`;
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const endIso = `${futureDate.toISOString().split("T")[0]}T23:59`;

    setStartAt(startIso);
    setEndAt(endIso);
    setNoExpiration(false);
    setAppliesToScope("all");
    setSelectedProductIds([]);
    setSelectedBrandIds([]);
    setSelectedCategoryCodes([]);
    setRetailerScope("all");
    setSelectedRetailerIds([]);
    setMinimumSpend("");
    setMinimumQuantity("");
    setTotalUsageLimit("");
    setPerRetailerUsageLimit("");
    setCombinableWithQuantityTiers(true);
    setCombinableWithAutomaticPromotions(false);
    setBogoBuyQuantity("5");
    setBogoGetQuantity("1");
    setBogoDiscountPercent("100");
    setProductSearch("");
    setShowSelectedProductsOnly(false);
    setBrandSearch("");
    setCategorySearch("");
    setRetailerSearch("");
    setShowSelectedRetailersOnly(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (p: AdminPromotionSummary) => {
    setEditingPromo(p);
    setName(p.name);
    setInternalDescription(p.internal_description || "");
    setTriggerType(p.trigger_type);
    setCode(p.code || "");
    setDiscountType(p.discount_type);
    setDiscountValue(p.discount_value.toString());
    setMaximumDiscount(p.maximum_discount ? p.maximum_discount.toString() : "");
    setStatus(p.status);
    setStartAt(p.start_at ? p.start_at.slice(0, 16) : "");
    setEndAt(p.end_at ? p.end_at.slice(0, 16) : "");
    setNoExpiration(p.no_expiration);
    setAppliesToScope(p.applies_to_scope);
    setSelectedProductIds(p.product_ids || []);
    setSelectedBrandIds(p.brand_ids || []);
    setSelectedCategoryCodes(p.category_codes || []);
    setRetailerScope(p.retailer_scope);
    setSelectedRetailerIds(p.retailer_ids || []);
    setMinimumSpend(p.minimum_spend > 0 ? p.minimum_spend.toString() : "");
    setMinimumQuantity(p.minimum_quantity > 0 ? p.minimum_quantity.toString() : "");
    setTotalUsageLimit(p.total_usage_limit ? p.total_usage_limit.toString() : "");
    setPerRetailerUsageLimit(p.per_retailer_usage_limit ? p.per_retailer_usage_limit.toString() : "");
    setCombinableWithQuantityTiers(p.combinable_with_quantity_tiers);
    setCombinableWithAutomaticPromotions(p.combinable_with_automatic_promotions);
    setBogoBuyQuantity(p.bogo_buy_quantity ? p.bogo_buy_quantity.toString() : "5");
    setBogoGetQuantity(p.bogo_get_quantity ? p.bogo_get_quantity.toString() : "1");
    setBogoDiscountPercent(p.bogo_discount_percent !== null ? p.bogo_discount_percent.toString() : "100");
    setProductSearch("");
    setShowSelectedProductsOnly(false);
    setBrandSearch("");
    setCategorySearch("");
    setRetailerSearch("");
    setShowSelectedRetailersOnly(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Promotion name is required.");
      return;
    }
    if (triggerType === "coupon" && !code.trim()) {
      setFormError("Coupon code is required.");
      return;
    }

    if (!noExpiration) {
      if (!startAt || !endAt) {
        setFormError("Please specify both Start Date and End Date, or check 'No Expiration Date'.");
        return;
      }
      const sTime = new Date(startAt).getTime();
      const eTime = new Date(endAt).getTime();
      if (isNaN(sTime) || isNaN(eTime)) {
        setFormError("Invalid date/time format for schedule.");
        return;
      }
      if (eTime <= sTime) {
        setFormError("End date and time must be strictly after the start date and time.");
        return;
      }
    }

    const payload: SavePromotionPayload = {
      name: name.trim(),
      internal_description: internalDescription.trim() || undefined,
      trigger_type: triggerType,
      code: triggerType === "coupon" ? code.trim().toUpperCase() : undefined,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      maximum_discount: maximumDiscount ? parseFloat(maximumDiscount) : null,
      status,
      start_at: !noExpiration && startAt ? new Date(startAt).toISOString() : null,
      end_at: !noExpiration && endAt ? new Date(endAt).toISOString() : null,
      no_expiration: noExpiration,
      applies_to_scope: appliesToScope,
      retailer_scope: retailerScope,
      minimum_spend: minimumSpend ? parseFloat(minimumSpend) : 0,
      minimum_quantity: minimumQuantity ? parseInt(minimumQuantity, 10) : 0,
      total_usage_limit: totalUsageLimit ? parseInt(totalUsageLimit, 10) : null,
      per_retailer_usage_limit: perRetailerUsageLimit ? parseInt(perRetailerUsageLimit, 10) : null,
      combinable_with_quantity_tiers: combinableWithQuantityTiers,
      combinable_with_automatic_promotions: combinableWithAutomaticPromotions,
      bogo_buy_quantity: discountType === "bogo" ? parseInt(bogoBuyQuantity, 10) || 1 : undefined,
      bogo_get_quantity: discountType === "bogo" ? parseInt(bogoGetQuantity, 10) || 1 : undefined,
      bogo_discount_percent: discountType === "bogo" ? parseFloat(bogoDiscountPercent) || 100 : undefined,
      product_ids: selectedProductIds,
      brand_ids: selectedBrandIds,
      category_codes: selectedCategoryCodes,
      retailer_ids: selectedRetailerIds,
    };

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingPromo) {
        const res = await updateAdminPromotionAction(editingPromo.id, payload);
        if (!res.success) throw new Error(res.error);
        setPromotions((prev) =>
          prev.map((item) =>
            item.id === editingPromo.id
              ? {
                  ...item,
                  ...payload,
                  discount_value: payload.discount_value,
                  minimum_spend: payload.minimum_spend || 0,
                  minimum_quantity: payload.minimum_quantity || 0,
                  maximum_discount: payload.maximum_discount || null,
                  code: payload.code || null,
                  internal_description: payload.internal_description || null,
                  start_at: payload.start_at || null,
                  end_at: payload.end_at || null,
                  bogo_buy_quantity: payload.bogo_buy_quantity || null,
                  bogo_get_quantity: payload.bogo_get_quantity || null,
                  bogo_discount_percent: payload.bogo_discount_percent || null,
                }
              : item
          )
        );
      } else {
        const res = await createAdminPromotionAction(payload);
        if (!res.success || !res.id) throw new Error(res.error);
        const newPromo: AdminPromotionSummary = {
          id: res.id,
          name: payload.name,
          internal_description: payload.internal_description || null,
          trigger_type: payload.trigger_type,
          code: payload.code || null,
          discount_type: payload.discount_type,
          discount_value: payload.discount_value,
          status: payload.status,
          start_at: payload.start_at || null,
          end_at: payload.end_at || null,
          no_expiration: payload.no_expiration,
          applies_to_scope: payload.applies_to_scope,
          retailer_scope: payload.retailer_scope,
          minimum_spend: payload.minimum_spend || 0,
          minimum_quantity: payload.minimum_quantity || 0,
          maximum_discount: payload.maximum_discount || null,
          total_usage_limit: payload.total_usage_limit || null,
          per_retailer_usage_limit: payload.per_retailer_usage_limit || null,
          combinable_with_quantity_tiers: payload.combinable_with_quantity_tiers,
          combinable_with_automatic_promotions: payload.combinable_with_automatic_promotions,
          bogo_buy_quantity: payload.bogo_buy_quantity || null,
          bogo_get_product_id: null,
          bogo_get_quantity: payload.bogo_get_quantity || null,
          bogo_discount_percent: payload.bogo_discount_percent || null,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
          orders_count: 0,
          total_discount_given: 0,
          product_ids: selectedProductIds,
          brand_ids: selectedBrandIds,
          category_codes: selectedCategoryCodes,
          retailer_ids: selectedRetailerIds,
        };
        setPromotions((prev) => [newPromo, ...prev]);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save promotion");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (p: AdminPromotionSummary, newStatus: PromotionStatus) => {
    try {
      const res = await setAdminPromotionStatusAction(p.id, newStatus);
      if (!res.success) throw new Error(res.error);
      setPromotions((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, status: newStatus } : item))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDeleteDraft = async (p: AdminPromotionSummary) => {
    if (!confirm(`Are you sure you want to delete draft "${p.name}"?`)) return;
    try {
      const res = await deleteAdminDraftPromotionAction(p.id);
      if (!res.success) throw new Error(res.error);
      setPromotions((prev) => prev.filter((item) => item.id !== p.id));
    } catch (err: any) {
      alert(err.message || "Failed to delete promotion");
    }
  };

  const handleViewDetail = async (p: AdminPromotionSummary) => {
    setDetailPromo(p);
    setIsDetailOpen(true);
    setIsLoadingDetail(true);
    try {
      const res = await getAdminPromotionDetailAction(p.id);
      if (res.success && res.usages) {
        setDetailUsages(res.usages);
      }
    } catch (err) {
      console.error("Failed to load promotion detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Live Rule Preview computation
  const livePreviewString = useMemo(() => {
    return formatPromotionRulePreview({
      trigger_type: triggerType,
      code,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      applies_to_scope: appliesToScope,
      product_ids: selectedProductIds,
      brand_ids: selectedBrandIds,
      category_codes: selectedCategoryCodes,
      retailer_scope: retailerScope,
      retailer_ids: selectedRetailerIds,
      minimum_spend: minimumSpend ? parseFloat(minimumSpend) : 0,
      minimum_quantity: minimumQuantity ? parseInt(minimumQuantity, 10) : 0,
      maximum_discount: maximumDiscount ? parseFloat(maximumDiscount) : null,
      total_usage_limit: totalUsageLimit ? parseInt(totalUsageLimit, 10) : null,
      per_retailer_usage_limit: perRetailerUsageLimit ? parseInt(perRetailerUsageLimit, 10) : null,
      no_expiration: noExpiration,
      start_at: startAt || null,
      end_at: endAt || null,
      combinable_with_quantity_tiers: combinableWithQuantityTiers,
      combinable_with_automatic_promotions: combinableWithAutomaticPromotions,
      bogo_buy_quantity: parseInt(bogoBuyQuantity, 10) || 1,
      bogo_get_quantity: parseInt(bogoGetQuantity, 10) || 1,
      bogo_discount_percent: parseFloat(bogoDiscountPercent) || 100,
    });
  }, [
    triggerType,
    code,
    discountType,
    discountValue,
    appliesToScope,
    selectedProductIds,
    selectedBrandIds,
    selectedCategoryCodes,
    retailerScope,
    selectedRetailerIds,
    minimumSpend,
    minimumQuantity,
    maximumDiscount,
    totalUsageLimit,
    perRetailerUsageLimit,
    noExpiration,
    startAt,
    endAt,
    combinableWithQuantityTiers,
    combinableWithAutomaticPromotions,
    bogoBuyQuantity,
    bogoGetQuantity,
    bogoDiscountPercent,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Promotions & Coupons
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Create, schedule, and manage promotional discount rules and coupon codes for retailer partners.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <span>+ Create Promotion</span>
        </button>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Status Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 overflow-x-auto max-w-full">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "scheduled", label: "Scheduled" },
            { id: "paused", label: "Paused" },
            { id: "expired", label: "Expired" },
            { id: "draft", label: "Draft" },
            { id: "archived", label: "Archived" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search promo name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
        </div>
      </div>

      {/* Promotions Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Promotion Name</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3">Code / Trigger</th>
                <th className="py-3.5 px-3">Discount</th>
                <th className="py-3.5 px-3">Scope</th>
                <th className="py-3.5 px-3">Retailers</th>
                <th className="py-3.5 px-3">Schedule</th>
                <th className="py-3.5 px-3">Usage</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-400">
                    No promotions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPromotions.map((p) => {
                  const computedStatus = getComputedStatus(p);
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* Name & Internal Description */}
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(p)}
                          className="hover:underline hover:text-indigo-600 text-left font-bold"
                        >
                          {p.name}
                        </button>
                        {p.internal_description && (
                          <div className="text-[11px] text-zinc-400 font-normal truncate max-w-xs">
                            {p.internal_description}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3">
                        {p.trigger_type === "coupon" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            🎟️ Coupon
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            ⚡ Automatic
                          </span>
                        )}
                      </td>

                      {/* Code / Trigger */}
                      <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                        {p.code ? p.code : <span className="text-zinc-400 font-sans text-[11px]">Auto Apply</span>}
                      </td>

                      {/* Discount */}
                      <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {p.discount_type === "percentage" && `${p.discount_value}% OFF`}
                        {p.discount_type === "fixed_amount" && `$${p.discount_value.toFixed(2)} OFF`}
                        {p.discount_type === "unit_discount" && `$${p.discount_value.toFixed(2)}/unit`}
                        {p.discount_type === "bogo" && `Buy ${p.bogo_buy_quantity || 1} Get ${p.bogo_get_quantity || 1}`}
                      </td>

                      {/* Scope */}
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                        {p.applies_to_scope === "all" && "All Products"}
                        {p.applies_to_scope === "selected_products" && `${p.product_ids?.length || 0} Products`}
                        {p.applies_to_scope === "selected_brands" && `${p.brand_ids?.length || 0} Brands`}
                        {p.applies_to_scope === "selected_categories" && `${p.category_codes?.length || 0} Categories`}
                      </td>

                      {/* Retailers */}
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                        {p.retailer_scope === "all" ? (
                          <span className="text-zinc-500">All Retailers</span>
                        ) : (
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {p.retailer_ids?.length || 0} Selected
                          </span>
                        )}
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-3 text-zinc-500 text-[11px]">
                        {p.no_expiration ? (
                          <span className="text-emerald-600 font-medium">No Expiration</span>
                        ) : (
                          <span>
                            {p.start_at ? new Date(p.start_at).toLocaleDateString() : "Now"} –{" "}
                            {p.end_at ? new Date(p.end_at).toLocaleDateString() : "Open"}
                          </span>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                        {p.usage_count}
                        {p.total_usage_limit ? ` / ${p.total_usage_limit}` : " uses"}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            computedStatus === "active"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200"
                              : computedStatus === "scheduled"
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200"
                              : computedStatus === "paused"
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200"
                              : computedStatus === "expired"
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200"
                              : computedStatus === "draft"
                              ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200"
                              : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                          }`}
                        >
                          {computedStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(p)}
                          className="px-2 py-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title="View Usage & Orders"
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(p)}
                          className="px-2 py-1 rounded text-indigo-600 hover:text-indigo-700 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          Edit
                        </button>
                        {p.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p, "paused")}
                            className="px-2 py-1 rounded text-amber-600 hover:text-amber-700 font-medium hover:bg-amber-50"
                          >
                            Pause
                          </button>
                        )}
                        {p.status === "paused" && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p, "active")}
                            className="px-2 py-1 rounded text-emerald-600 hover:text-emerald-700 font-medium hover:bg-emerald-50"
                          >
                            Resume
                          </button>
                        )}
                        {p.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p, "archived")}
                            className="px-2 py-1 rounded text-zinc-400 hover:text-zinc-600 font-medium"
                          >
                            Archive
                          </button>
                        )}
                        {p.status === "draft" && p.usage_count === 0 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(p)}
                            className="px-2 py-1 rounded text-red-500 hover:text-red-700 font-medium hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full flex flex-col max-h-[92vh] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* STICKY HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                  {editingPromo ? "Edit Promotion Rule" : "Create New Promotion Rule"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Configure discount formula, eligible scopes, usage limits, and schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium">
                  ⚠️ {formError}
                </div>
              )}

              <form id="promo-form" onSubmit={handleSavePromotion} className="space-y-6">
                {/* SECTION A — BASIC */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Section A — Basic Identity & Trigger
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Promotion Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. KLALAB Fall Launch 10% OFF"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Trigger Type
                      </label>
                      <select
                        value={triggerType}
                        onChange={(e) => setTriggerType(e.target.value as PromotionTriggerType)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      >
                        <option value="coupon">Coupon Code (Retailer enters code)</option>
                        <option value="automatic">Automatic Promotion (Applied when qualified)</option>
                      </select>
                    </div>
                  </div>

                  {triggerType === "coupon" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Coupon Code *
                          </label>
                          <button
                            type="button"
                            onClick={() => setCode(generateRandomPromoCode("KS"))}
                            className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            🎲 Generate Random Code
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. KLALAB10"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          required={triggerType === "coupon"}
                          className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          Internal Operational Notes
                        </label>
                        <input
                          type="text"
                          placeholder="Purpose, target campaign, marketing reference"
                          value={internalDescription}
                          onChange={(e) => setInternalDescription(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION B — DISCOUNT */}
                <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Section B — Discount Formula
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as PromotionDiscountType)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      >
                        <option value="percentage">Percentage Off (%)</option>
                        <option value="fixed_amount">Fixed Amount Off ($)</option>
                        <option value="unit_discount">Product Unit Discount ($/ea)</option>
                        <option value="bogo">Buy X Get Y (BOGO)</option>
                      </select>
                    </div>

                    {discountType !== "bogo" ? (
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          Discount Value ({discountType === "percentage" ? "%" : "$"})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          required
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          Buy Quantity (X)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={bogoBuyQuantity}
                          onChange={(e) => setBogoBuyQuantity(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    )}

                    {discountType === "bogo" ? (
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          Get Free Quantity (Y)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={bogoGetQuantity}
                          onChange={(e) => setBogoGetQuantity(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                          Maximum Discount Cap ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Optional cap (e.g. 50.00)"
                          value={maximumDiscount}
                          onChange={(e) => setMaximumDiscount(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION C — APPLIES TO (SCOPE) */}
                <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Section C — Product Scope (Applies To)
                    </h3>
                    {appliesToScope === "selected_products" && (
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        {selectedProductIds.length} Selected
                      </span>
                    )}
                    {appliesToScope === "selected_brands" && (
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        {selectedBrandIds.length} Selected
                      </span>
                    )}
                    {appliesToScope === "selected_categories" && (
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        {selectedCategoryCodes.length} Selected
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4 text-xs font-semibold">
                      {[
                        { id: "all", label: "All Products" },
                        { id: "selected_products", label: "Selected Products" },
                        { id: "selected_brands", label: "Selected Brands" },
                        { id: "selected_categories", label: "Selected Categories" },
                      ].map((opt) => (
                        <label key={opt.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="appliesToScope"
                            checked={appliesToScope === opt.id}
                            onChange={() => setAppliesToScope(opt.id as PromotionAppliesToScope)}
                            className="text-indigo-600"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Sub-selector for Selected Products */}
                    {appliesToScope === "selected_products" && (
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Search products by name, SKU, brand..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSelectedProductsOnly(!showSelectedProductsOnly)}
                            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                              showSelectedProductsOnly
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                                : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            {showSelectedProductsOnly ? "✓ Showing Selected" : `Show Selected (${selectedProductIds.length})`}
                          </button>
                        </div>

                        <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 space-y-1 bg-zinc-50 dark:bg-zinc-800/40">
                          {filteredProducts.length === 0 ? (
                            <div className="text-center py-4 text-xs text-zinc-400">
                              No products match your search.
                            </div>
                          ) : (
                            filteredProducts.map((p) => {
                              const checked = selectedProductIds.includes(p.id);
                              return (
                                <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800/80 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedProductIds((prev) =>
                                        checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                      );
                                    }}
                                    className="rounded text-indigo-600"
                                  />
                                  <span className="font-mono text-[11px] text-zinc-400 shrink-0">{p.sku}</span>
                                  {p.brand_name && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0">
                                      {p.brand_name}
                                    </span>
                                  )}
                                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{p.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sub-selector for Selected Brands */}
                    {appliesToScope === "selected_brands" && (
                      <div className="pt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="Search brands..."
                          value={brandSearch}
                          onChange={(e) => setBrandSearch(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500"
                        />
                        <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 space-y-1 bg-zinc-50 dark:bg-zinc-800/40">
                          {filteredBrands.length === 0 ? (
                            <div className="text-center py-4 text-xs text-zinc-400">
                              No brands match your search.
                            </div>
                          ) : (
                            filteredBrands.map((b) => {
                              const checked = selectedBrandIds.includes(b.id);
                              return (
                                <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800/80 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedBrandIds((prev) =>
                                        checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                                      );
                                    }}
                                    className="rounded text-indigo-600"
                                  />
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{b.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sub-selector for Selected Categories */}
                    {appliesToScope === "selected_categories" && (
                      <div className="pt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500"
                        />
                        <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 space-y-1 bg-zinc-50 dark:bg-zinc-800/40">
                          {filteredCategories.length === 0 ? (
                            <div className="text-center py-4 text-xs text-zinc-400">
                              No categories match your search.
                            </div>
                          ) : (
                            filteredCategories.map((c) => {
                              const checked = selectedCategoryCodes.includes(c.code);
                              return (
                                <label key={c.code} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800/80 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedCategoryCodes((prev) =>
                                        checked ? prev.filter((code) => code !== c.code) : [...prev, c.code]
                                      );
                                    }}
                                    className="rounded text-indigo-600"
                                  />
                                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.label}</span>
                                  <span className="font-mono text-[10px] text-zinc-400">({c.code})</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION D — RETAILERS */}
                <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Section D — Retailer Eligibility Scope
                    </h3>
                    {retailerScope === "selected_retailers" && (
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        {selectedRetailerIds.length} Selected
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-4 text-xs font-semibold">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="retailerScope"
                          checked={retailerScope === "all"}
                          onChange={() => setRetailerScope("all")}
                          className="text-indigo-600"
                        />
                        <span>All Retailers</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="retailerScope"
                          checked={retailerScope === "selected_retailers"}
                          onChange={() => setRetailerScope("selected_retailers")}
                          className="text-indigo-600"
                        />
                        <span>Selected Retailers Only</span>
                      </label>
                    </div>

                    {retailerScope === "selected_retailers" && (
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Search retailers by company name or code..."
                            value={retailerSearch}
                            onChange={(e) => setRetailerSearch(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSelectedRetailersOnly(!showSelectedRetailersOnly)}
                            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                              showSelectedRetailersOnly
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                                : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            {showSelectedRetailersOnly ? "✓ Showing Selected" : `Show Selected (${selectedRetailerIds.length})`}
                          </button>
                        </div>

                        <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 space-y-1 bg-zinc-50 dark:bg-zinc-800/40">
                          {filteredRetailers.length === 0 ? (
                            <div className="text-center py-4 text-xs text-zinc-400">
                              No retailers match your search.
                            </div>
                          ) : (
                            filteredRetailers.map((r) => {
                              const checked = selectedRetailerIds.includes(r.id);
                              return (
                                <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800/80 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedRetailerIds((prev) =>
                                        checked ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                                      );
                                    }}
                                    className="rounded text-indigo-600"
                                  />
                                  {r.code && (
                                    <span className="font-mono text-[11px] text-zinc-400 shrink-0">[{r.code}]</span>
                                  )}
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{r.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION E & F — REQUIREMENTS & LIMITS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  {/* Requirements */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Section E — Order Requirements
                    </h3>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Minimum Order Spend ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 200.00"
                        value={minimumSpend}
                        onChange={(e) => setMinimumSpend(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Minimum Eligible Quantity (Units)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 24"
                        value={minimumQuantity}
                        onChange={(e) => setMinimumQuantity(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Usage Limits */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Section F — Usage Limits
                    </h3>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Total Usage Limit (All Retailers)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Leave blank for unlimited"
                        value={totalUsageLimit}
                        onChange={(e) => setTotalUsageLimit(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Per Account Usage Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 1 use per retailer account"
                        value={perRetailerUsageLimit}
                        onChange={(e) => setPerRetailerUsageLimit(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Limits redemptions per Retailer Account (company), shared across all store locations.
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION G & H — SCHEDULE & COMBINATIONS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  {/* Schedule */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Section G — Schedule & Validity
                    </h3>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noExpiration}
                        onChange={(e) => setNoExpiration(e.target.checked)}
                        className="text-indigo-600 rounded"
                      />
                      <span>No Expiration Date (Always Valid)</span>
                    </label>

                    {!noExpiration && (
                      <div className="space-y-3 pt-1">
                        <DateTimeField
                          label="Start Date & Time"
                          value={startAt}
                          onChange={setStartAt}
                          required={!noExpiration}
                        />
                        <DateTimeField
                          label="End Date & Time"
                          value={endAt}
                          onChange={setEndAt}
                          required={!noExpiration}
                        />
                        <p className="text-[11px] text-zinc-500">
                          Promotions automatically activate and expire at the specified dates & times.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Combinations */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Section H — Combinations & Stacking
                    </h3>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={combinableWithQuantityTiers}
                        onChange={(e) => setCombinableWithQuantityTiers(e.target.checked)}
                        className="text-indigo-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="font-bold">Combinable with Quantity Tier Discount</span>
                        <p className="text-[11px] text-zinc-500">
                          When OFF, items with case-pack quantity tier benefits cannot receive this promotion.
                        </p>
                      </div>
                    </label>

                    {triggerType === "coupon" && (
                      <label className="flex items-start gap-2 text-xs cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={combinableWithAutomaticPromotions}
                          onChange={(e) => setCombinableWithAutomaticPromotions(e.target.checked)}
                          className="text-indigo-600 rounded mt-0.5"
                        />
                        <div>
                          <span className="font-bold">Combinable with Automatic Promotions</span>
                          <p className="text-[11px] text-zinc-500">
                            When ON, qualifying automatic promotions will also apply alongside this coupon.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* LIVE RULE PREVIEW (Requirement 19) */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    ℹ️ Live Rule Preview (Before Saving)
                  </div>
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 font-medium leading-relaxed">
                    {livePreviewString}
                  </div>
                </div>
              </form>
            </div>

            {/* STICKY FOOTER */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="promo-form"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSaving ? "Saving..." : editingPromo ? "Update Promotion" : "Create Promotion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL & USAGE HISTORY MODAL */}
      {isDetailOpen && detailPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {detailPromo.name}
                </h2>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                  Code: {detailPromo.code || "Automatic"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Total Uses</div>
                <div className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                  {detailPromo.usage_count}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Orders</div>
                <div className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                  {detailPromo.orders_count}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Total Discount</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ${detailPromo.total_discount_given.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Status</div>
                <div className="text-xs font-bold uppercase text-zinc-900 dark:text-white mt-1">
                  {getComputedStatus(detailPromo)}
                </div>
              </div>
            </div>

            {/* Usage Orders List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Order Application History
              </h3>

              {isLoadingDetail ? (
                <div className="py-8 text-center text-xs text-zinc-400">Loading order history...</div>
              ) : detailUsages.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  No orders have applied this promotion yet.
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Order Number</th>
                        <th className="py-2.5 px-3">Retailer</th>
                        <th className="py-2.5 px-3">Discount</th>
                        <th className="py-2.5 px-3">Order Total</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {detailUsages.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                            {u.order_number}
                          </td>
                          <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 font-medium">
                            {u.company_name}
                          </td>
                          <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                            -${u.discount_amount.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-bold text-zinc-900 dark:text-white">
                            ${u.total_amount.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 text-[11px]">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
