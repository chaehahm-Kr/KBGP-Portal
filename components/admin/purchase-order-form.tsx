"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  getProductsForSupplier,
  getCompanyOriginsAndContacts,
} from "@/lib/purchase-order/actions";
import { formatEasternDate, getEasternTodayString } from "@/lib/utils/timezone";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  type?: string;
  company_id?: string;
}

interface SupplierOption {
  id: string;
  name: string;
  default_currency: string;
  default_payment_terms: string;
  default_payment_terms_custom: string;
  default_incoterms: string;
  default_port_of_loading: string;
  default_production_lead_time: string;
  po_receiving_email: string;
  default_ship_from_warehouse_id: string;
}

interface CompanyOrigin {
  id: string;
  origin_id: string;
  name: string;
  is_default: boolean;
  country?: string;
  city?: string;
  address_line1?: string;
  postal_code?: string;
  contact_name?: string;
  phone?: string;
}

interface CompanyContact {
  id: string;
  name: string;
  email: string;
  title?: string;
  position?: string;
  is_primary: boolean;
  is_logistics_assigned: boolean;
}

interface PriceTier {
  qty: number;
  price: number;
}

interface FormLine {
  product_id: string;
  name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  qty: number;
  unit_cost: number;
  line_note: string;
  // Intelligence fields
  base_fob?: number;
  price_tiers?: PriceTier[];
  applied_tier_qty?: number | null;
  carton_pack_qty?: number;
  carton_width?: number | null;
  carton_depth?: number | null;
  carton_height?: number | null;
  carton_weight?: number | null;
  carton_cbm?: number | null;
  is_custom_price?: boolean;
}

interface PurchaseOrderFormProps {
  initialPo?: any;
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  defaultWarehouseId: string;
}

const INCOTERMS_PRESETS = [
  { value: "EXW", label: "EXW (Ex Works / 공장인도)" },
  { value: "FOB", label: "FOB (Free on Board / 본선인도)" },
  { value: "FCA", label: "FCA (Free Carrier / 운송인인도)" },
  { value: "CIF", label: "CIF (Cost, Insurance and Freight / 운임·보험료포함)" },
  { value: "CFR", label: "CFR (Cost and Freight / 운임포함)" },
  { value: "DDP", label: "DDP (Delivered Duty Paid / 관세지급인도)" },
  { value: "DAP", label: "DAP (Delivered at Place / 도착장소인도)" },
  { value: "OTHER", label: "Other / 직접 입력" },
];

function computeTierPrice(baseFob: number, priceTiers: PriceTier[] | undefined, qty: number) {
  if (!priceTiers || priceTiers.length === 0) {
    return { price: baseFob || 0, appliedTierQty: null };
  }
  let matchingTier: PriceTier | null = null;
  for (const t of priceTiers) {
    if (qty >= t.qty) {
      matchingTier = t;
    }
  }
  if (matchingTier) {
    return { price: matchingTier.price, appliedTierQty: matchingTier.qty };
  }
  return { price: baseFob || 0, appliedTierQty: null };
}

export function PurchaseOrderForm({
  initialPo,
  warehouses,
  suppliers,
  defaultWarehouseId,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const isEdit = !!initialPo;

  // Header Fields
  const [supplierId, setSupplierId] = useState(initialPo?.supplier_id || "");
  const [orderDate, setOrderDate] = useState(
    initialPo?.order_date || getEasternTodayString()
  );
  const [currency, setCurrency] = useState(initialPo?.currency || "USD");
  const [paymentTerms, setPaymentTerms] = useState(initialPo?.payment_terms || "");

  // Incoterms Preset & Custom Input
  const initialIncotermsVal = initialPo?.incoterms || "";
  const isInitialPreset = INCOTERMS_PRESETS.some((p) => p.value === initialIncotermsVal && p.value !== "OTHER");
  const [incotermsType, setIncotermsType] = useState(
    initialIncotermsVal ? (isInitialPreset ? initialIncotermsVal : "OTHER") : ""
  );
  const [incotermsCustom, setIncotermsCustom] = useState(
    initialIncotermsVal && !isInitialPreset ? initialIncotermsVal : ""
  );

  const [portOfLoading, setPortOfLoading] = useState(initialPo?.port_of_loading || "");
  const [expectedReadyDate, setExpectedReadyDate] = useState(initialPo?.expected_ready_date || "");
  const [expectedShipDate, setExpectedShipDate] = useState(initialPo?.expected_ship_date || "");
  const [eta, setEta] = useState(initialPo?.eta || "");

  // Scoped Shipping Origins and Company Contacts
  const [shipFromWarehouseId, setShipFromWarehouseId] = useState(initialPo?.ship_from_warehouse_id || "");
  const [availableOrigins, setAvailableOrigins] = useState<CompanyOrigin[]>([]);
  const [availableContacts, setAvailableContacts] = useState<CompanyContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [customPoEmail, setCustomPoEmail] = useState("");
  const [poReceivingEmail, setPoReceivingEmail] = useState(initialPo?.po_receiving_email || "");
  const [isLoadingCompanyData, setIsLoadingCompanyData] = useState(false);

  const [destinationWarehouseId, setDestinationWarehouseId] = useState(
    initialPo?.destination_warehouse_id || defaultWarehouseId
  );
  const [internalNote, setInternalNote] = useState(initialPo?.internal_note || "");
  const [supplierFacingNote, setSupplierFacingNote] = useState(initialPo?.supplier_facing_note || "");

  // Lines
  const [lines, setLines] = useState<FormLine[]>(() => {
    if (!initialPo?.lines) return [];
    return initialPo.lines.map((l: any) => ({
      product_id: l.product_id,
      name: l.product_name || l.name,
      letusto_sku: l.letusto_sku,
      manufacture_sku: l.manufacture_sku,
      qty: l.qty,
      unit_cost: l.unit_cost,
      line_note: l.line_note || "",
      base_fob: l.unit_cost,
      price_tiers: [],
      applied_tier_qty: null,
      carton_pack_qty: 1,
      is_custom_price: false,
    }));
  });

  // Reactive state for selected supplier's products
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [searchProductTerm, setSearchProductTerm] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTierTooltipIdx, setActiveTierTooltipIdx] = useState<number | null>(null);

  // Fetch company origins and contacts when supplierId changes
  useEffect(() => {
    if (!supplierId) {
      setAvailableOrigins([]);
      setAvailableContacts([]);
      setSelectedContactIds([]);
      return;
    }

    let isMounted = true;
    const loadCompanyData = async () => {
      setIsLoadingCompanyData(true);
      try {
        const result = await getCompanyOriginsAndContacts(supplierId);
        if (!isMounted) return;

        setAvailableOrigins(result.origins);
        setAvailableContacts(result.contacts);

        if (!isEdit) {
          // Auto-select default origin if available
          if (result.defaultOriginId) {
            setShipFromWarehouseId(result.defaultOriginId);
          } else {
            setShipFromWarehouseId("");
          }

          // Auto-check recommended contacts (logistics_assigned or primary)
          setSelectedContactIds(result.defaultContactIds);

          const defaultEmails = result.contacts
            .filter((c: any) => result.defaultContactIds.includes(c.id))
            .map((c: any) => c.email)
            .filter(Boolean);

          setPoReceivingEmail(defaultEmails.join(", "));
        } else {
          // In Edit mode: match existing po_receiving_email with contact emails
          const existingEmails = (initialPo?.po_receiving_email || "")
            .split(",")
            .map((e: string) => e.trim().toLowerCase())
            .filter(Boolean);

          const matchedIds = result.contacts
            .filter((c: any) => c.email && existingEmails.includes(c.email.toLowerCase()))
            .map((c: any) => c.id);

          setSelectedContactIds(matchedIds);
        }
      } catch (err) {
        console.error("Failed to load company origins and contacts:", err);
      } finally {
        if (isMounted) setIsLoadingCompanyData(false);
      }
    };

    loadCompanyData();

    return () => {
      isMounted = false;
    };
  }, [supplierId, isEdit]);

  // Load supplier defaults when supplier changes
  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;

    if (lines.length > 0) {
      const confirmChange = window.confirm(
        "공급사를 변경하면 현재 선택된 발주 상품이 제거됩니다. 계속하시겠습니까?"
      );
      if (!confirmChange) {
        return;
      }
    }

    setSupplierId(sId);
    setLines([]); // Clear added lines when supplier changes to prevent mismatched product associations

    const supplier = suppliers.find((s) => s.id === sId);
    if (supplier) {
      setCurrency(supplier.default_currency || "USD");
      setPaymentTerms(supplier.default_payment_terms_custom || supplier.default_payment_terms || "");

      // Handle Incoterms preset matching
      const sIncoterms = supplier.default_incoterms || "";
      const isPreset = INCOTERMS_PRESETS.some((p) => p.value === sIncoterms && p.value !== "OTHER");
      if (sIncoterms) {
        if (isPreset) {
          setIncotermsType(sIncoterms);
          setIncotermsCustom("");
        } else {
          setIncotermsType("OTHER");
          setIncotermsCustom(sIncoterms);
        }
      } else {
        setIncotermsType("");
        setIncotermsCustom("");
      }

      setPortOfLoading(supplier.default_port_of_loading || "");
      
      // Compute default expected ready date if production lead time is a number
      if (supplier.default_production_lead_time) {
        const days = parseInt(supplier.default_production_lead_time);
        if (!isNaN(days)) {
          const readyDate = new Date();
          readyDate.setDate(readyDate.getDate() + days);
          setExpectedReadyDate(formatEasternDate(readyDate));
        }
      }
    }
  };

  // Fetch supplier products when supplierId changes
  useEffect(() => {
    if (!supplierId) {
      setSupplierProducts([]);
      return;
    }

    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const prods = await getProductsForSupplier(supplierId);
        setSupplierProducts(prods);

        // If in edit mode, enrich initial lines with carton & tier info
        if (isEdit && lines.length > 0) {
          setLines((prevLines) =>
            prevLines.map((line) => {
              const matched = prods.find((p: any) => p.id === line.product_id);
              if (matched) {
                const { price, appliedTierQty } = computeTierPrice(
                  matched.price_usd_fob,
                  matched.price_tiers,
                  line.qty
                );
                return {
                  ...line,
                  base_fob: matched.price_usd_fob,
                  price_tiers: matched.price_tiers,
                  applied_tier_qty: line.unit_cost === price ? appliedTierQty : null,
                  carton_pack_qty: matched.carton_pack_qty || 1,
                  carton_width: matched.carton_width,
                  carton_depth: matched.carton_depth,
                  carton_height: matched.carton_height,
                  carton_weight: matched.carton_weight,
                  carton_cbm: matched.carton_cbm,
                };
              }
              return line;
            })
          );
        }
      } catch (err) {
        console.error("Failed to load products for supplier", err);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [supplierId]);

  // Handle contact checkbox toggles
  const handleContactToggle = (contactId: string, checked: boolean) => {
    const next = checked
      ? [...selectedContactIds, contactId]
      : selectedContactIds.filter((id) => id !== contactId);

    setSelectedContactIds(next);

    const contactEmails = availableContacts
      .filter((c) => next.includes(c.id))
      .map((c) => c.email)
      .filter(Boolean);

    if (customPoEmail.trim()) {
      contactEmails.push(customPoEmail.trim());
    }

    setPoReceivingEmail(contactEmails.join(", "));
  };

  const handleCustomEmailChange = (val: string) => {
    setCustomPoEmail(val);
    const contactEmails = availableContacts
      .filter((c) => selectedContactIds.includes(c.id))
      .map((c) => c.email)
      .filter(Boolean);

    if (val.trim()) {
      contactEmails.push(val.trim());
    }
    setPoReceivingEmail(contactEmails.join(", "));
  };

  // Add single Product to line
  const handleAddProduct = (prodId: string) => {
    const prod = supplierProducts.find((p) => p.id === prodId);
    if (!prod) return;

    if (lines.some((l) => l.product_id === prodId)) {
      alert("이미 추가된 제품입니다.");
      return;
    }

    const { price, appliedTierQty } = computeTierPrice(prod.price_usd_fob, prod.price_tiers, 1);

    const newLine: FormLine = {
      product_id: prod.id,
      name: prod.display_name,
      letusto_sku: prod.letusto_sku,
      manufacture_sku: prod.manufacture_sku,
      qty: 1,
      unit_cost: price,
      line_note: "",
      base_fob: prod.price_usd_fob || 0,
      price_tiers: prod.price_tiers || [],
      applied_tier_qty: appliedTierQty,
      carton_pack_qty: prod.carton_pack_qty || 1,
      carton_width: prod.carton_width,
      carton_depth: prod.carton_depth,
      carton_height: prod.carton_height,
      carton_weight: prod.carton_weight,
      carton_cbm: prod.carton_cbm,
      is_custom_price: false,
    };

    setLines([...lines, newLine]);
    setSearchProductTerm("");
  };

  // Add multiple products from modal to lines
  const handleAddSelectedProducts = (selectedProducts: any[]) => {
    const newLines = [...lines];
    selectedProducts.forEach((prod) => {
      if (!newLines.some((l) => l.product_id === prod.id)) {
        const { price, appliedTierQty } = computeTierPrice(prod.price_usd_fob, prod.price_tiers, 1);
        newLines.push({
          product_id: prod.id,
          name: prod.display_name || prod.name,
          letusto_sku: prod.letusto_sku,
          manufacture_sku: prod.manufacture_sku,
          qty: 1,
          unit_cost: price,
          line_note: "",
          base_fob: prod.price_usd_fob || 0,
          price_tiers: prod.price_tiers || [],
          applied_tier_qty: appliedTierQty,
          carton_pack_qty: prod.carton_pack_qty || 1,
          carton_width: prod.carton_width,
          carton_depth: prod.carton_depth,
          carton_height: prod.carton_height,
          carton_weight: prod.carton_weight,
          carton_cbm: prod.carton_cbm,
          is_custom_price: false,
        });
      }
    });
    setLines(newLines);
    setIsModalOpen(false);
  };

  // Modify line quantity with automatic tier recalculation
  const handleQtyChange = (index: number, val: number) => {
    const updated = [...lines];
    const line = updated[index];
    const newQty = Math.max(1, val);
    line.qty = newQty;

    // If unit_cost has NOT been manually customized, recalculate tier price
    if (!line.is_custom_price && line.price_tiers && line.price_tiers.length > 0) {
      const { price, appliedTierQty } = computeTierPrice(line.base_fob || 0, line.price_tiers, newQty);
      line.unit_cost = price;
      line.applied_tier_qty = appliedTierQty;
    }

    setLines(updated);
  };

  // Modify line unit cost (manual override)
  const handleUnitCostChange = (index: number, val: number) => {
    const updated = [...lines];
    const line = updated[index];
    line.unit_cost = val;
    line.is_custom_price = true;
    line.applied_tier_qty = null;
    setLines(updated);
  };

  // Modify line note
  const handleLineNoteChange = (index: number, val: string) => {
    const updated = [...lines];
    updated[index].line_note = val;
    setLines(updated);
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    const updated = [...lines];
    updated.splice(index, 1);
    setLines(updated);
  };

  // Calculation totals & carton estimates
  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);
  const totalAmount = lines.reduce((sum, l) => sum + l.qty * l.unit_cost, 0);
  const totalEstCartons = lines.reduce((sum, l) => sum + Math.ceil(l.qty / (l.carton_pack_qty || 1)), 0);
  const totalCbm = lines.reduce(
    (sum, l) => sum + Math.ceil(l.qty / (l.carton_pack_qty || 1)) * (l.carton_cbm || 0),
    0
  );

  // Form Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (!supplierId) throw new Error("공급사(Supplier)를 선택해 주세요.");
      if (!destinationWarehouseId) throw new Error("입고 목적 창고를 선택해 주세요.");
      if (lines.length === 0) throw new Error("최소 한 개 이상의 라인 품목을 추가해 주세요.");

      const effectiveIncoterms = incotermsType === "OTHER" ? incotermsCustom.trim() : incotermsType;

      const payload = {
        supplier_id: supplierId,
        order_date: orderDate,
        currency,
        payment_terms: paymentTerms,
        incoterms: effectiveIncoterms,
        port_of_loading: portOfLoading,
        expected_ready_date: expectedReadyDate || undefined,
        expected_ship_date: expectedShipDate || undefined,
        eta: eta || undefined,
        ship_from_warehouse_id: shipFromWarehouseId || null,
        destination_warehouse_id: destinationWarehouseId,
        po_receiving_email: poReceivingEmail,
        internal_note: internalNote,
        supplier_facing_note: supplierFacingNote,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_cost: l.unit_cost,
          line_note: l.line_note,
        })),
      };

      if (isEdit) {
        await updatePurchaseOrder(initialPo.id, payload);
        router.push(`/admin/purchasing/${initialPo.id}`);
      } else {
        const res = await createPurchaseOrder(payload);
        router.push(`/admin/purchasing/${res.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "발주서 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter supplier products list in quick search selector
  const filteredSupplierProducts = supplierProducts.filter((p) => {
    const keyword = searchProductTerm.toLowerCase();
    return (
      p.display_name.toLowerCase().includes(keyword) ||
      (p.letusto_sku || "").toLowerCase().includes(keyword) ||
      (p.manufacture_sku || "").toLowerCase().includes(keyword)
    );
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {submitError}
        </div>
      )}

      {/* PO Header Fields Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          기본 발주 정보 및 상업 조건
        </h3>

        {/* Top 3 Core Selectors: Supplier, Order Date, Destination */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Supplier */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              공급사 (Supplier Company) <span className="text-rose-500">*</span>
            </label>
            <select
              value={supplierId}
              onChange={handleSupplierChange}
              disabled={isEdit}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none disabled:bg-zinc-50 dark:disabled:bg-zinc-850 font-medium"
              required
            >
              <option value="">-- 공급사를 선택해 주세요 --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Order Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              발주 일자 (Order Date) <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-medium"
              required
            />
          </div>

          {/* Destination Warehouse */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              입고 목적 창고 (Destination) <span className="text-rose-500">*</span>
            </label>
            <select
              value={destinationWarehouseId}
              onChange={(e) => setDestinationWarehouseId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-medium"
              required
            >
              {warehouses
                .filter((wh) => !wh.type || wh.type.toLowerCase() === "own")
                .map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    [{wh.code}] {wh.name}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-zinc-400">자사 직영 물류 창고만 선택 가능합니다.</p>
          </div>
        </div>

        {/* Logistics & Locations: Ship From (Scoped) & Dates (ETD/ETA/Ready) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          {/* Ship From Origin (Scoped to selected Supplier) */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                출고지 창고 (Ship From Origin)
              </label>
              {isLoadingCompanyData && (
                <span className="text-[10px] text-blue-600 animate-pulse font-medium">출고지 로딩 중...</span>
              )}
            </div>
            <select
              value={shipFromWarehouseId}
              onChange={(e) => setShipFromWarehouseId(e.target.value)}
              disabled={!supplierId || isLoadingCompanyData}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none disabled:opacity-50 font-medium"
            >
              {!supplierId ? (
                <option value="">공급사를 먼저 선택해 주세요</option>
              ) : availableOrigins.length === 0 ? (
                <option value="">등록된 출고지 없음 (Not Set)</option>
              ) : (
                <>
                  <option value="">미지정 (Not Set)</option>
                  {availableOrigins.map((orig) => (
                    <option key={orig.id} value={orig.id}>
                      {orig.name} {orig.is_default ? "★ (기본 출고지)" : ""} —{" "}
                      {[orig.city, orig.country].filter(Boolean).join(", ")}
                    </option>
                  ))}
                </>
              )}
            </select>
            {supplierId && availableOrigins.length > 0 && (
              <p className="text-[10px] text-zinc-400">
                선택한 공급사({suppliers.find((s) => s.id === supplierId)?.name})의 등록된 출고지만 표시됩니다.
              </p>
            )}
          </div>

          {/* Port of Loading */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">선적항 (Port of Loading)</label>
            <input
              type="text"
              placeholder="예: Busan Port, Incheon Airport"
              value={portOfLoading}
              onChange={(e) => setPortOfLoading(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Expected Ready Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">생산완료예정일 (Ready Date)</label>
            <input
              type="date"
              value={expectedReadyDate}
              onChange={(e) => setExpectedReadyDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* ETD (Estimated Ship Date) */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              ETD (예상 출발일 / Departure)
            </label>
            <input
              type="date"
              value={expectedShipDate}
              onChange={(e) => setExpectedShipDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* ETA (Estimated Arrival Date) */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              ETA (예상 도착일 / Arrival)
            </label>
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">정산 통화 (Currency)</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold font-mono"
            >
              <option value="USD">USD ($)</option>
              <option value="KRW">KRW (₩)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>

        {/* Commercial Terms: Payment Terms & Incoterms Presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          {/* Payment Terms */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">결제 조건 (Payment Terms)</label>
            <input
              type="text"
              placeholder="예: 30% Deposit / 70% Balance before shipment"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
            />
          </div>

          {/* Incoterms (Preset + Custom Input) */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              인도 조건 (Incoterms)
            </label>
            <div className="flex gap-2">
              <select
                value={incotermsType}
                onChange={(e) => setIncotermsType(e.target.value)}
                className="w-1/2 rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-bold font-mono"
              >
                <option value="">선택 (Select)</option>
                {INCOTERMS_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {incotermsType === "OTHER" ? (
                <input
                  type="text"
                  placeholder="인코텀즈 직접 입력..."
                  value={incotermsCustom}
                  onChange={(e) => setIncotermsCustom(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-medium"
                  required
                />
              ) : (
                <div className="flex-1 flex items-center px-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono text-xs">
                  {incotermsType ? `${incotermsType} 조건 적용` : "인코텀즈 조건을 선택하세요"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PO Receiving Contacts Integration */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
          <div className="flex justify-between items-center">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              공급사 발주 수신 담당자 (PO Receiving Contacts)
            </label>
            {supplierId && (
              <span className="text-[11px] text-zinc-500 font-medium">
                체크된 담당자의 이메일로 발주서 통지가 발송됩니다.
              </span>
            )}
          </div>

          {!supplierId ? (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-400">
              공급사를 선택하면 등록된 담당자 목록이 표시됩니다.
            </div>
          ) : availableContacts.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500">
                등록된 공급사 담당자가 없습니다. 수신할 이메일 주소를 직접 입력해 주세요.
              </p>
              <input
                type="text"
                placeholder="supplier-contact@example.com"
                value={poReceivingEmail}
                onChange={(e) => setPoReceivingEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none font-mono"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {availableContacts.map((contact) => {
                  const isChecked = selectedContactIds.includes(contact.id);
                  return (
                    <label
                      key={contact.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-950/20"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleContactToggle(contact.id, e.target.checked)}
                        className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-white truncate">
                            {contact.name}
                          </span>
                          {contact.title && (
                            <span className="text-[10px] text-zinc-500 font-medium truncate">
                              ({contact.title})
                            </span>
                          )}
                          {contact.is_logistics_assigned && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                              발주·물류
                            </span>
                          )}
                          {contact.is_primary && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                              대표
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 block truncate">
                          {contact.email || "이메일 미등록"}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Direct email display / addition */}
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center pt-1">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                  수신 이메일 문자열:
                </span>
                <input
                  type="text"
                  value={poReceivingEmail}
                  onChange={(e) => setPoReceivingEmail(e.target.value)}
                  placeholder="선택한 담당자들의 이메일이 자동 조합됩니다 (수정 가능)"
                  className="flex-1 w-full rounded border border-zinc-200 px-2.5 py-1.5 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 font-mono text-xs outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Product Selector to add lines */}
        <div className="space-y-2 text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          <label className="font-bold text-zinc-700 dark:text-zinc-300">발주 상품 추가하기</label>
          <div className="flex gap-2 items-center max-w-2xl">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={
                  supplierId
                    ? "추가할 제품명, Letusto SKU, 제조사 SKU 검색..."
                    : "공급사를 먼저 선택해 주세요..."
                }
                value={searchProductTerm}
                onChange={(e) => {
                  if (!supplierId) {
                    alert("먼저 공급사를 선택해주세요. 공급사를 선택하면 해당 공급사가 등록한 상품만 조회됩니다.");
                    return;
                  }
                  setSearchProductTerm(e.target.value);
                }}
                disabled={!supplierId}
                className="w-full rounded-lg border border-zinc-200 p-2.5 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 text-xs disabled:opacity-50 font-medium"
              />

              {supplierId && searchProductTerm && (
                <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-20 text-xs font-semibold">
                  {isLoadingProducts ? (
                    <div className="p-3 text-zinc-400">제품 로딩 중...</div>
                  ) : filteredSupplierProducts.length === 0 ? (
                    <div className="p-3 text-zinc-400">검색된 제품이 없습니다.</div>
                  ) : (
                    filteredSupplierProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p.id)}
                        className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="text-zinc-900 dark:text-white block font-bold">{p.display_name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            SKU: {p.letusto_sku || "지정대기"} | 제조사: {p.manufacture_sku || "미입력"} | 박스:{" "}
                            {p.carton_pack_qty || 1}개입
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block font-mono">
                            {currency} {p.price_usd_fob?.toFixed(2) || "0.00"}
                          </span>
                          {p.price_tiers && p.price_tiers.length > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              수량별 할인 ({p.price_tiers.length} Tiers)
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!supplierId) {
                  alert("먼저 공급사를 선택해주세요. 공급사를 선택하면 해당 공급사가 등록한 상품만 조회됩니다.");
                  return;
                }
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-850 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm"
            >
              상품 찾아보기 (모달)
            </button>
          </div>
          {!supplierId && (
            <p className="text-[10px] text-zinc-500 font-medium">
              ※ 상품을 선택하려면 상단에서 먼저 공급사를 지정해 주세요.
            </p>
          )}
        </div>

        {/* Lines Table */}
        {lines.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-950/50 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-3.5 py-3">Letusto SKU</th>
                  <th className="px-3.5 py-3">제조사 SKU</th>
                  <th className="px-3.5 py-3">제품명</th>
                  <th className="px-3.5 py-3 w-28 text-right">발주수량 *</th>
                  <th className="px-3.5 py-3 w-40 text-right">FOB 단가 ({currency}) *</th>
                  <th className="px-3.5 py-3 w-32 text-right">합계 금액</th>
                  <th className="px-3.5 py-3 w-44">포장 단위 / 예상 박스</th>
                  <th className="px-3.5 py-3">라인 비고</th>
                  <th className="px-3.5 py-3 w-16 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line, index) => {
                  const packQty = line.carton_pack_qty || 1;
                  const fullCartons = Math.floor(line.qty / packQty);
                  const remainder = line.qty % packQty;
                  const hasTiers = line.price_tiers && line.price_tiers.length > 0;

                  return (
                    <tr key={line.product_id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10">
                      {/* Letusto SKU */}
                      <td className="px-3.5 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                        {line.letusto_sku || (
                          <span className="text-zinc-400 italic font-sans font-normal">지정 대기</span>
                        )}
                      </td>

                      {/* Manufacture SKU */}
                      <td className="px-3.5 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {line.manufacture_sku || (
                          <span className="text-zinc-400 italic font-sans font-normal">미입력</span>
                        )}
                      </td>

                      {/* Product Name */}
                      <td className="px-3.5 py-3 font-bold text-zinc-900 dark:text-white max-w-xs">
                        <div className="truncate" title={line.name}>
                          {line.name}
                        </div>
                      </td>

                      {/* Order Quantity */}
                      <td className="px-3.5 py-3 text-right">
                        <input
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(e) => handleQtyChange(index, parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono font-bold rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                          required
                        />
                      </td>

                      {/* Unit Cost with Tier Intelligence & Popover */}
                      <td className="px-3.5 py-3 text-right">
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={line.unit_cost}
                            onChange={(e) => handleUnitCostChange(index, parseFloat(e.target.value) || 0)}
                            className="w-full text-right font-mono font-bold rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                            required
                          />

                          {/* Tier Badge and Tooltip Trigger */}
                          <div className="flex items-center justify-end gap-1 text-[10px]">
                            {line.applied_tier_qty && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold">
                                Tier {line.applied_tier_qty}+ 적용
                              </span>
                            )}
                            {hasTiers && (
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveTierTooltipIdx(
                                      activeTierTooltipIdx === index ? null : index
                                    )
                                  }
                                  className="text-zinc-400 hover:text-blue-600 font-bold cursor-pointer"
                                  title="수량별 할인 단가표 보기"
                                >
                                  ℹ️ 단가표
                                </button>

                                {activeTierTooltipIdx === index && (
                                  <div className="absolute right-0 bottom-full mb-1 w-48 p-2.5 rounded-lg bg-zinc-900 text-white shadow-xl z-30 text-[10px] text-left">
                                    <div className="font-bold border-b border-zinc-700 pb-1 mb-1.5 flex justify-between">
                                      <span>수량별 단가표</span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTierTooltipIdx(null)}
                                        className="text-zinc-400 hover:text-white"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                    <div className="space-y-1 font-mono">
                                      <div className="flex justify-between text-zinc-300">
                                        <span>기본 (1+)</span>
                                        <span>
                                          {currency} {line.base_fob?.toFixed(2) || "0.00"}
                                        </span>
                                      </div>
                                      {line.price_tiers?.map((t) => (
                                        <div
                                          key={t.qty}
                                          className={`flex justify-between ${
                                            line.applied_tier_qty === t.qty
                                              ? "font-bold text-emerald-400"
                                              : "text-zinc-300"
                                          }`}
                                        >
                                          <span>{t.qty}+ 개</span>
                                          <span>
                                            {currency} {t.price.toFixed(2)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Line Total */}
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {currency}{" "}
                        {(line.qty * line.unit_cost).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Carton Specs & Estimated Cartons */}
                      <td className="px-3.5 py-3">
                        <div className="space-y-0.5">
                          {remainder === 0 ? (
                            <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              📦 {fullCartons.toLocaleString()} Cartons
                            </div>
                          ) : (
                            <div
                              className="font-mono font-bold text-amber-600 dark:text-amber-400"
                              title="박스 포장 단위 배수가 아니어서 낱개 잔여 수량이 발생합니다."
                            >
                              ⚠️ {fullCartons} Box + {remainder}개 잔여
                              <span className="block text-[9px] text-zinc-400 font-normal">
                                (총 {fullCartons + 1}박스 필요)
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-400">
                            {packQty}개/Box
                            {line.carton_cbm ? ` · ${line.carton_cbm} CBM` : ""}
                          </div>
                        </div>
                      </td>

                      {/* Line Note */}
                      <td className="px-3.5 py-3">
                        <input
                          type="text"
                          placeholder="라인 메모..."
                          value={line.line_note}
                          onChange={(e) => handleLineNoteChange(index, e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white text-xs outline-none"
                        />
                      </td>

                      {/* Delete */}
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Aggregate Totals & Carton Summary Panel */}
        {lines.length > 0 && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">발주 요약</span>
              <div className="text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                총 품목: <strong className="text-zinc-900 dark:text-white">{lines.length}</strong>개 · 총 예상 박스:{" "}
                <strong className="text-zinc-900 dark:text-white">{totalEstCartons.toLocaleString()}</strong> Cartons
                {totalCbm > 0 && (
                  <span>
                    {" "}
                    · 총 체적: <strong className="text-zinc-900 dark:text-white">{totalCbm.toFixed(3)}</strong> CBM
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 수량 (Total Qty)</span>
                <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                  {totalQty.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">
                  총 발주 금액 (Total Amount)
                </span>
                <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                  {currency}{" "}
                  {totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          비고 및 세부 특약사항
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">내부 관리용 메모 (Internal Note)</label>
            <textarea
              placeholder="재고 입고 조건이나 특별한 사내 협의 내용을 작성해 주세요..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              공급사 전달용 메모 (Supplier-facing Note)
            </label>
            <textarea
              placeholder="공급사 측에서 발주서 확인 시 전달할 패킹 요청이나 배송 수칙 등을 입력해 주세요..."
              value={supplierFacingNote}
              onChange={(e) => setSupplierFacingNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-955 dark:text-white outline-none min-h-[80px]"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3.5">
        <button
          type="button"
          onClick={() => {
            if (isEdit) {
              router.push(`/admin/purchasing/${initialPo.id}`);
            } else {
              router.push("/admin/purchasing");
            }
          }}
          className="px-5 py-2.5 bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-xl font-bold cursor-pointer transition-all text-xs"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-850 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-all text-xs"
        >
          {isSubmitting ? "저장 중..." : isEdit ? "발주서 수정" : "초안(Draft) 임시저장"}
        </button>
      </div>

      {/* Product Browser Modal */}
      {isModalOpen && (
        <ProductBrowseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          supplierName={suppliers.find((s) => s.id === supplierId)?.name || ""}
          products={supplierProducts}
          onAddProducts={handleAddSelectedProducts}
          addedProductIds={new Set(lines.map((l) => l.product_id))}
          currency={currency}
        />
      )}
    </form>
  );
}

interface ProductBrowseModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string;
  products: any[];
  onAddProducts: (selectedProducts: any[]) => void;
  addedProductIds: Set<string>;
  currency: string;
}

function ProductBrowseModal({
  isOpen,
  onClose,
  supplierName,
  products,
  onAddProducts,
  addedProductIds,
  currency,
}: ProductBrowseModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Extract unique brands and categories
  const uniqueBrands = Array.from(new Set(products.map((p) => p.brand_name).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(products.map((p) => p.category_label).filter(Boolean))) as string[];

  // Filter products based on search term, category, and brand
  const filteredProducts = products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [p.display_name, p.brand_name, p.letusto_sku, p.manufacture_sku, p.upc].some((field) =>
        (field || "").toLowerCase().includes(term)
      );

    const matchesBrand = selectedBrand === "all" || p.brand_name === selectedBrand;
    const matchesCategory = selectedCategory === "all" || p.category_label === selectedCategory;

    return matchesSearch && matchesBrand && matchesCategory;
  });

  // Grouping logic for Parent/Variant structures
  const parentSkus = new Set<string>();
  filteredProducts.forEach((p) => {
    if (p.parent_sku) {
      parentSkus.add(p.parent_sku);
    }
  });

  const parents: any[] = [];
  const childrenMap = new Map<string, any[]>();
  const standalones: any[] = [];

  filteredProducts.forEach((p) => {
    if (p.parent_sku) {
      const list = childrenMap.get(p.parent_sku) || [];
      list.push(p);
      childrenMap.set(p.parent_sku, list);
    } else if (p.letusto_sku && parentSkus.has(p.letusto_sku)) {
      parents.push(p);
    } else {
      standalones.push(p);
    }
  });

  // Handle virtual parents where parent record is missing from catalog
  for (const parentSku of parentSkus) {
    const hasParent = parents.some((p) => p.letusto_sku === parentSku);
    if (!hasParent) {
      const children = childrenMap.get(parentSku) || [];
      if (children.length > 0) {
        parents.push({
          id: `virtual-${parentSku}`,
          display_name: children[0].display_name.replace(/\s*[-–].*$/, "") || `Product (${parentSku})`,
          brand_name: children[0].brand_name,
          category_label: children[0].category_label,
          letusto_sku: parentSku,
          photo_url: children[0].photo_url,
          is_virtual: true,
        });
      }
    }
  }

  // Toggle expand
  const toggleParentExpand = (parentSku: string) => {
    const next = new Set(expandedParents);
    if (next.has(parentSku)) {
      next.delete(parentSku);
    } else {
      next.add(parentSku);
    }
    setExpandedParents(next);
  };

  const handleSelectProduct = (id: string, checked: boolean) => {
    const next = new Set(selectedProductIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedProductIds(next);
  };

  const handleSelectParentAll = (parentSku: string, checked: boolean) => {
    const next = new Set(selectedProductIds);
    const children = childrenMap.get(parentSku) || [];
    children.forEach((c) => {
      if (!addedProductIds.has(c.id)) {
        if (checked) {
          next.add(c.id);
        } else {
          next.delete(c.id);
        }
      }
    });
    setSelectedProductIds(next);
  };

  const handleSelectAllVisible = (checked: boolean) => {
    const next = new Set(selectedProductIds);
    filteredProducts.forEach((p) => {
      const hasChildren = parentSkus.has(p.letusto_sku || "");
      const isCheckable = !p.parent_sku ? !hasChildren : true;
      if (isCheckable && !addedProductIds.has(p.id)) {
        if (checked) {
          next.add(p.id);
        } else {
          next.delete(p.id);
        }
      }
    });
    for (const parentSku of parentSkus) {
      const children = childrenMap.get(parentSku) || [];
      children.forEach((c) => {
        if (!addedProductIds.has(c.id)) {
          if (checked) {
            next.add(c.id);
          } else {
            next.delete(c.id);
          }
        }
      });
    }
    setSelectedProductIds(next);
  };

  const checkableProducts = filteredProducts.filter((p) => {
    const hasChildren = parentSkus.has(p.letusto_sku || "");
    const isCheckable = !p.parent_sku ? !hasChildren : true;
    return isCheckable && !addedProductIds.has(p.id);
  });
  const allChecked = checkableProducts.length > 0 && checkableProducts.every((p) => selectedProductIds.has(p.id));

  const handleAddClick = () => {
    const selected = products.filter((p) => selectedProductIds.has(p.id));
    onAddProducts(selected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh] text-xs">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            상품 선택 — <span className="text-zinc-655 dark:text-zinc-350">{supplierName}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-base font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-955/20 border-b border-zinc-150 dark:border-zinc-800 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="제품명 / Brand / Letusto SKU / Supplier SKU / UPC 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-white outline-none"
            >
              <option value="all">All Brands</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-white outline-none"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-550 dark:text-zinc-400 font-bold border-b border-zinc-150 dark:border-zinc-800">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => handleSelectAllVisible(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 w-16">이미지</th>
                <th className="px-4 py-3">제품명 / 상세 정보</th>
                <th className="px-4 py-3 w-28">브랜드</th>
                <th className="px-4 py-3 w-28">카테고리</th>
                <th className="px-4 py-3 w-28">제조사 SKU</th>
                <th className="px-4 py-3 w-28">Letusto SKU</th>
                <th className="px-4 py-3 w-28">박스 규격</th>
                <th className="px-4 py-3 w-32 text-right">FOB 단가 ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* Standalones */}
              {standalones.map((p) => {
                const isAdded = addedProductIds.has(p.id);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        disabled={isAdded}
                        checked={isAdded || selectedProductIds.has(p.id)}
                        onChange={(e) => handleSelectProduct(p.id, e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 overflow-hidden flex items-center justify-center">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-zinc-400">No Image</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white block">{p.display_name}</span>
                      {isAdded && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-[9px]">
                          이미 발주에 추가됨
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400">{p.brand_name}</td>
                    <td className="px-4 py-3 text-zinc-500">{p.category_label}</td>
                    <td className="px-4 py-3 font-mono text-zinc-750 dark:text-zinc-450">
                      {p.manufacture_sku || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {p.letusto_sku || "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                      {p.carton_pack_qty || 1}개/Box
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      <div>{(p.price_usd_fob || 0).toFixed(2)}</div>
                      {p.price_tiers && p.price_tiers.length > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-sans block">
                          Tier 할인 가능
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Parents with child variants */}
              {parents.map((parent) => {
                const children = childrenMap.get(parent.letusto_sku) || [];
                const isExpanded = expandedParents.has(parent.letusto_sku);
                const checkableChildren = children.filter((c) => !addedProductIds.has(c.id));
                const allChildrenSelected =
                  checkableChildren.length > 0 && checkableChildren.every((c) => selectedProductIds.has(c.id));

                return (
                  <React.Fragment key={parent.id}>
                    {/* Parent Row */}
                    <tr className="bg-zinc-50/20 dark:bg-zinc-900/10 font-bold border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          disabled={checkableChildren.length === 0}
                          checked={allChildrenSelected}
                          onChange={(e) => handleSelectParentAll(parent.letusto_sku, e.target.checked)}
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 overflow-hidden flex items-center justify-center">
                          {parent.photo_url ? (
                            <img src={parent.photo_url} alt={parent.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-zinc-400">No Image</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-900 dark:text-white text-xs">{parent.display_name}</span>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/10 text-blue-600 dark:text-blue-400 text-[9px] ml-1.5">
                          {children.length} Variants
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400">{parent.brand_name}</td>
                      <td className="px-4 py-3 text-zinc-500">{parent.category_label || "-"}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">-</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">{parent.letusto_sku}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">-</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleParentExpand(parent.letusto_sku)}
                          className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold cursor-pointer"
                        >
                          {isExpanded ? "옵션 접기 ▲" : `옵션 펼치기 (${children.length}) ▼`}
                        </button>
                      </td>
                    </tr>

                    {/* Children Rows */}
                    {isExpanded &&
                      children.map((child) => {
                        const isAdded = addedProductIds.has(child.id);
                        return (
                          <tr
                            key={child.id}
                            className="bg-zinc-50/10 dark:bg-zinc-900/5 hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5"
                          >
                            <td className="px-4 py-3 text-center pl-8">
                              <input
                                type="checkbox"
                                disabled={isAdded}
                                checked={isAdded || selectedProductIds.has(child.id)}
                                onChange={(e) => handleSelectProduct(child.id, e.target.checked)}
                                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                              />
                            </td>
                            <td className="px-4 py-3 pl-8">
                              <div className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 overflow-hidden flex items-center justify-center">
                                {child.photo_url ? (
                                  <img src={child.photo_url} alt={child.display_name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] text-zinc-400">No Image</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 pl-6">
                              <span className="text-zinc-700 dark:text-zinc-300 font-bold block">
                                {child.display_name}
                              </span>
                              {isAdded && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-[9px]">
                                  이미 발주에 추가됨
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{child.brand_name}</td>
                            <td className="px-4 py-3 text-zinc-400">{child.category_label}</td>
                            <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-400">
                              {child.manufacture_sku || "-"}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                              {child.letusto_sku || "-"}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                              {child.carton_pack_qty || 1}개/Box
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                              <div>{(child.price_usd_fob || 0).toFixed(2)}</div>
                              {child.price_tiers && child.price_tiers.length > 0 && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-sans block">
                                  Tier 할인 가능
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-zinc-400 font-semibold">
                    조회된 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="font-bold text-zinc-500">{selectedProductIds.size}개 상품 선택됨</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-750 dark:text-zinc-300 font-bold transition-all cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleAddClick}
              disabled={selectedProductIds.size === 0}
              className="px-4 py-2 rounded bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold disabled:opacity-50 transition-all cursor-pointer"
            >
              선택한 {selectedProductIds.size}개 상품 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
