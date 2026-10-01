"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPoRequest,
  updatePoRequest,
} from "@/lib/purchase-order/request-actions";
import { PoRequestDetail } from "@/lib/purchase-order/request-types";
import { CompanyShippingOrigin } from "@/lib/company/shipping-origin-actions";

interface ProductMasterItem {
  id: string;
  name: string;
  display_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  price_usd_fob: number;
  price_tiers: { qty: number; price: number }[];
  carton_pack_qty: number;
  photo_url?: string | null;
  category_label?: string;
  brand_name?: string;
}

interface CompanyContactItem {
  id: string;
  name: string;
  email: string;
  title?: string;
  is_primary?: boolean;
}

interface FormLineItem {
  product_id: string;
  display_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  requested_qty: number;
  reference_unit_cost: number;
  base_fob: number;
  price_tiers: { qty: number; price: number }[];
  carton_pack_qty: number;
  photo_url?: string | null;
  line_note: string;
  applied_tier_qty: number | null;
}

interface PoRequestFormProps {
  initialRequest?: PoRequestDetail;
  companyId: string;
  companyName: string;
  origins: CompanyShippingOrigin[];
  contacts: CompanyContactItem[];
  currentUser: { id: string; name: string; email: string };
  products: ProductMasterItem[];
}

function computeReferenceTierPrice(baseFob: number, priceTiers: { qty: number; price: number }[], qty: number) {
  if (!priceTiers || priceTiers.length === 0) {
    return { price: baseFob || 0, appliedTierQty: null };
  }
  let matchingTier: { qty: number; price: number } | null = null;
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

export function PoRequestForm({
  initialRequest,
  companyId,
  companyName,
  origins,
  contacts,
  currentUser,
  products,
}: PoRequestFormProps) {
  const router = useRouter();
  const isEdit = !!initialRequest;

  // Header State
  const defaultOrigin = origins.find((o) => o.is_default) || origins[0] || null;
  const [shippingOriginId, setShippingOriginId] = useState(
    initialRequest?.shipping_origin_id || defaultOrigin?.id || ""
  );

  const [contactUserId, setContactUserId] = useState(
    initialRequest?.contact_user_id || currentUser.id
  );

  const initialContact = contacts.find((c) => c.id === contactUserId) || {
    name: currentUser.name,
    email: currentUser.email,
  };

  const [contactName, setContactName] = useState(initialRequest?.contact_name || initialContact.name);
  const [contactEmail, setContactEmail] = useState(initialRequest?.contact_email || initialContact.email);
  const [requestedReadyDate, setRequestedReadyDate] = useState(
    initialRequest?.requested_ready_date || ""
  );
  const [notes, setNotes] = useState(initialRequest?.notes || "");

  // Lines State
  const [lines, setLines] = useState<FormLineItem[]>(() => {
    if (!initialRequest?.lines) return [];
    return initialRequest.lines.map((l) => {
      const matched = products.find((p) => p.id === l.product_id);
      const tiers = matched?.price_tiers || l.price_tiers || [];
      const baseFob = matched?.price_usd_fob || l.base_fob || l.reference_unit_cost;
      const { price, appliedTierQty } = computeReferenceTierPrice(baseFob, tiers, l.requested_qty);

      return {
        product_id: l.product_id,
        display_name: l.product_name_snapshot,
        letusto_sku: l.letusto_sku_snapshot,
        manufacture_sku: l.manufacture_sku_snapshot,
        requested_qty: l.requested_qty,
        reference_unit_cost: l.reference_unit_cost || price,
        base_fob: baseFob,
        price_tiers: tiers,
        carton_pack_qty: matched?.carton_pack_qty || l.carton_pack_qty || 1,
        photo_url: matched?.photo_url || l.photo_url,
        line_note: l.line_note || "",
        applied_tier_qty: appliedTierQty,
      };
    });
  });

  const [searchProdTerm, setSearchProdTerm] = useState("");
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeTierTooltipIdx, setActiveTierTooltipIdx] = useState<number | null>(null);

  // Handle contact user change
  const handleContactChange = (userId: string) => {
    setContactUserId(userId);
    const target = contacts.find((c) => c.id === userId);
    if (target) {
      setContactName(target.name);
      setContactEmail(target.email);
    }
  };

  // Add Product to line
  const handleAddProduct = (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    if (lines.some((l) => l.product_id === prodId)) {
      alert("이미 추가된 제품입니다.");
      return;
    }

    const { price, appliedTierQty } = computeReferenceTierPrice(prod.price_usd_fob, prod.price_tiers, 1);

    const newLine: FormLineItem = {
      product_id: prod.id,
      display_name: prod.display_name,
      letusto_sku: prod.letusto_sku,
      manufacture_sku: prod.manufacture_sku,
      requested_qty: 1,
      reference_unit_cost: price,
      base_fob: prod.price_usd_fob,
      price_tiers: prod.price_tiers || [],
      carton_pack_qty: prod.carton_pack_qty || 1,
      photo_url: prod.photo_url,
      line_note: "",
      applied_tier_qty: appliedTierQty,
    };

    setLines([...lines, newLine]);
    setSearchProdTerm("");
  };

  // Add multiple selected from modal
  const handleAddModalProducts = (selectedProducts: ProductMasterItem[]) => {
    const newLines = [...lines];
    selectedProducts.forEach((prod) => {
      if (!newLines.some((l) => l.product_id === prod.id)) {
        const { price, appliedTierQty } = computeReferenceTierPrice(prod.price_usd_fob, prod.price_tiers, 1);
        newLines.push({
          product_id: prod.id,
          display_name: prod.display_name,
          letusto_sku: prod.letusto_sku,
          manufacture_sku: prod.manufacture_sku,
          requested_qty: 1,
          reference_unit_cost: price,
          base_fob: prod.price_usd_fob,
          price_tiers: prod.price_tiers || [],
          carton_pack_qty: prod.carton_pack_qty || 1,
          photo_url: prod.photo_url,
          line_note: "",
          applied_tier_qty: appliedTierQty,
        });
      }
    });
    setLines(newLines);
    setIsBrowseModalOpen(false);
  };

  // Modify line quantity with automatic tier recalculation
  const handleQtyChange = (index: number, val: number) => {
    const updated = [...lines];
    const line = updated[index];
    const newQty = Math.max(1, val);
    line.requested_qty = newQty;

    if (line.price_tiers && line.price_tiers.length > 0) {
      const { price, appliedTierQty } = computeReferenceTierPrice(line.base_fob, line.price_tiers, newQty);
      line.reference_unit_cost = price;
      line.applied_tier_qty = appliedTierQty;
    }

    setLines(updated);
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    const updated = [...lines];
    updated.splice(index, 1);
    setLines(updated);
  };

  // Totals
  const totalQty = lines.reduce((sum, l) => sum + l.requested_qty, 0);
  const totalEstAmount = lines.reduce((sum, l) => sum + l.requested_qty * l.reference_unit_cost, 0);
  const totalBoxes = lines.reduce((sum, l) => sum + Math.ceil(l.requested_qty / (l.carton_pack_qty || 1)), 0);

  // Form Submit Handler
  const handleFormSubmit = async (submitNow: boolean) => {
    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (lines.length === 0) {
        throw new Error("최소 1개 이상의 발주 요청 제품을 추가해 주세요.");
      }

      const payload = {
        contact_user_id: contactUserId,
        contact_name: contactName,
        contact_email: contactEmail,
        shipping_origin_id: shippingOriginId || undefined,
        requested_ready_date: requestedReadyDate || undefined,
        notes: notes.trim() || undefined,
        submit_now: submitNow,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          requested_qty: l.requested_qty,
          reference_unit_cost: l.reference_unit_cost,
          line_note: l.line_note || undefined,
        })),
      };

      if (isEdit) {
        await updatePoRequest(initialRequest.id, payload);
        router.push(`/portal/orders/requests/${initialRequest.id}`);
      } else {
        const res = await createPoRequest(payload);
        router.push(`/portal/orders/requests/${res.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "발주 요청 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuickProducts = products.filter((p) => {
    const q = searchProdTerm.trim().toLowerCase();
    return (
      !q ||
      p.display_name.toLowerCase().includes(q) ||
      (p.letusto_sku || "").toLowerCase().includes(q) ||
      (p.manufacture_sku || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
          {isEdit ? `발주 요청 수정 (${initialRequest.request_number})` : "신규 발주 요청 작성 (New PO Request)"}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          본사에 발주할 희망 제품과 수량, 출고지, 납기일을 입력하여 정식 검토를 요청합니다.
        </p>
      </div>

      {submitError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {submitError}
        </div>
      )}

      {/* Pricing Disclaimer Alert */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
        <span className="text-lg">📢</span>
        <div className="space-y-1">
          <p className="font-bold text-sm">발주 요청 및 예상 단가 안내</p>
          <p className="leading-relaxed">
            화면에 표시되는 단가는 상품 마스터 기준 참고 가격(Reference FOB)입니다.{" "}
            <strong>최종 발주 가격 및 확정 수량은 Letusto 검토 후 정식 발주서 전환 시 확정됩니다.</strong>
          </p>
        </div>
      </div>

      {/* Header Fields Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6 text-xs">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
          기본 요청 정보 (Request Details)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Shipping Origin (Scoped to company) */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              출고지 (Shipping Origin) <span className="text-rose-500">*</span>
            </label>
            <select
              value={shippingOriginId}
              onChange={(e) => setShippingOriginId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 font-medium"
              required
            >
              {origins.length === 0 ? (
                <option value="">등록된 출고지가 없습니다</option>
              ) : (
                origins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.is_default ? "★ (기본 출고지)" : ""} — {[o.city, o.country].filter(Boolean).join(", ")}
                  </option>
                ))
              )}
            </select>
            <p className="text-[10px] text-zinc-400">등록된 자사 출고지 중에서 선택합니다.</p>
          </div>

          {/* Contact User */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              담당자 (Contact Person) <span className="text-rose-500">*</span>
            </label>
            <select
              value={contactUserId}
              onChange={(e) => handleContactChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 font-medium"
              required
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.title ? `(${c.title})` : ""} — {c.email}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-400">발주 진행 관련 소통을 담당할 회사 사용자입니다.</p>
          </div>

          {/* Requested Ready Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              희망 생산 완료일 (Target Ready Date)
            </label>
            <input
              type="date"
              value={requestedReadyDate}
              onChange={(e) => setRequestedReadyDate(e.target.value)}
              onClick={(e) => (e.target as any).showPicker?.()}
              className="w-full rounded-lg border border-zinc-200 p-2.5 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 font-medium cursor-pointer"
            />
            <p className="text-[10px] text-zinc-400">공장에서 출고 준비가 완료되길 희망하는 일자입니다.</p>
          </div>
        </div>

        {/* Product Selector Bar */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          <label className="font-bold text-zinc-700 dark:text-zinc-300">요청 상품 추가하기</label>
          <div className="flex gap-2 items-center max-w-2xl">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="추가할 제품명, Letusto SKU, 제조사 SKU 검색..."
                value={searchProdTerm}
                onChange={(e) => setSearchProdTerm(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-2.5 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-950 text-xs font-medium"
              />

              {searchProdTerm && (
                <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-20 text-xs font-semibold">
                  {filteredQuickProducts.length === 0 ? (
                    <div className="p-3 text-zinc-400">검색된 제품이 없습니다.</div>
                  ) : (
                    filteredQuickProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p.id)}
                        className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="text-zinc-900 dark:text-white block font-bold">{p.display_name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            SKU: {p.letusto_sku || "지정대기"} | 제조사: {p.manufacture_sku || "미입력"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block font-mono">
                            ${p.price_usd_fob.toFixed(2)} (FOB)
                          </span>
                          {p.price_tiers && p.price_tiers.length > 0 && (
                            <span className="text-[10px] text-emerald-600 font-bold">수량별 할인 가능</span>
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
              onClick={() => setIsBrowseModalOpen(true)}
              className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-850 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm"
            >
              상품 찾아보기 (모달)
            </button>
          </div>
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
                  <th className="px-3.5 py-3 w-28 text-right">요청 수량 *</th>
                  <th className="px-3.5 py-3 w-36 text-right">예상 FOB 단가 *</th>
                  <th className="px-3.5 py-3 w-32 text-right">예상 합계</th>
                  <th className="px-3.5 py-3 w-40">포장 단위 / 예상 박스</th>
                  <th className="px-3.5 py-3">요청 메모</th>
                  <th className="px-3.5 py-3 w-16 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line, index) => {
                  const packQty = line.carton_pack_qty || 1;
                  const fullBoxes = Math.floor(line.requested_qty / packQty);
                  const remainder = line.requested_qty % packQty;
                  const hasTiers = line.price_tiers && line.price_tiers.length > 0;

                  return (
                    <tr key={line.product_id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10">
                      {/* Letusto SKU */}
                      <td className="px-3.5 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                        {line.letusto_sku || <span className="text-zinc-400 italic font-sans font-normal">지정 대기</span>}
                      </td>

                      {/* Manufacture SKU */}
                      <td className="px-3.5 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {line.manufacture_sku || <span className="text-zinc-400 italic font-sans font-normal">미입력</span>}
                      </td>

                      {/* Product Name */}
                      <td className="px-3.5 py-3 font-bold text-zinc-900 dark:text-white max-w-xs">
                        <div className="truncate" title={line.display_name}>
                          {line.display_name}
                        </div>
                      </td>

                      {/* Requested Qty */}
                      <td className="px-3.5 py-3 text-right">
                        <input
                          type="number"
                          min="1"
                          value={line.requested_qty}
                          onChange={(e) => handleQtyChange(index, parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono font-bold rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 outline-none"
                          required
                        />
                      </td>

                      {/* Reference Unit Cost */}
                      <td className="px-3.5 py-3 text-right">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white block">
                            ${line.reference_unit_cost.toFixed(2)}
                          </span>
                          <div className="flex items-center justify-end gap-1 text-[10px]">
                            {line.applied_tier_qty && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-bold">
                                Tier {line.applied_tier_qty}+ 적용
                              </span>
                            )}
                            {hasTiers && (
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveTierTooltipIdx(activeTierTooltipIdx === index ? null : index)
                                  }
                                  className="text-zinc-400 hover:text-blue-600 font-bold cursor-pointer"
                                >
                                  ℹ️ 단가표
                                </button>
                                {activeTierTooltipIdx === index && (
                                  <div className="absolute right-0 bottom-full mb-1 w-44 p-2.5 rounded-lg bg-zinc-900 text-white shadow-xl z-30 text-[10px] text-left">
                                    <div className="font-bold border-b border-zinc-700 pb-1 mb-1 flex justify-between">
                                      <span>수량별 단가표</span>
                                      <button type="button" onClick={() => setActiveTierTooltipIdx(null)}>
                                        &times;
                                      </button>
                                    </div>
                                    <div className="space-y-1 font-mono">
                                      <div className="flex justify-between text-zinc-300">
                                        <span>기본 (1+)</span>
                                        <span>${line.base_fob.toFixed(2)}</span>
                                      </div>
                                      {line.price_tiers.map((t) => (
                                        <div
                                          key={t.qty}
                                          className={`flex justify-between ${
                                            line.applied_tier_qty === t.qty ? "font-bold text-emerald-400" : "text-zinc-300"
                                          }`}
                                        >
                                          <span>{t.qty}+ 개</span>
                                          <span>${t.price.toFixed(2)}</span>
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

                      {/* Estimated Line Total */}
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        ${(line.requested_qty * line.reference_unit_cost).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Carton Info */}
                      <td className="px-3.5 py-3">
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                            📦 {fullBoxes} Box {remainder > 0 ? `+ ${remainder}개` : ""}
                          </div>
                          <div className="text-[10px] text-zinc-400">{packQty}개/Box</div>
                        </div>
                      </td>

                      {/* Line Note */}
                      <td className="px-3.5 py-3">
                        <input
                          type="text"
                          placeholder="품목별 특별 요청사항..."
                          value={line.line_note}
                          onChange={(e) => {
                            const updated = [...lines];
                            updated[index].line_note = e.target.value;
                            setLines(updated);
                          }}
                          className="w-full rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white text-xs outline-none"
                        />
                      </td>

                      {/* Delete */}
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          className="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer"
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

        {/* Aggregate Summary Panel */}
        {lines.length > 0 && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">요청 집계</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                총 품목 <strong>{lines.length}</strong>개 · 예상 <strong>{totalBoxes}</strong> Cartons
              </span>
            </div>

            <div className="flex gap-6">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 요청 수량</span>
                <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                  {totalQty.toLocaleString()} 개
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 예상 금액 (Reference)</span>
                <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                  ${totalEstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Overall Notes */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          <label className="font-bold text-zinc-700 dark:text-zinc-300">
            요청 비고 및 전달사항 (Request Notes)
          </label>
          <textarea
            placeholder="납기일 관련 요청사항이나 포장 조건, 기타 본사 전달 메모를 자유롭게 작성해 주세요..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none min-h-[80px]"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3.5">
        <button
          type="button"
          onClick={() => router.push("/portal/orders/requests")}
          className="px-5 py-2.5 bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-xl font-bold cursor-pointer transition-all text-xs"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => handleFormSubmit(false)}
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:bg-zinc-850 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 rounded-xl font-bold cursor-pointer transition-all text-xs"
        >
          {isSubmitting ? "저장 중..." : "임시 저장 (Draft)"}
        </button>
        <button
          type="button"
          onClick={() => handleFormSubmit(true)}
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-all text-xs"
        >
          {isSubmitting ? "제출 처리 중..." : isEdit ? "수정 사항 제출" : "발주 요청 제출하기 (Submit)"}
        </button>
      </div>

      {/* Product Browse Modal */}
      {isBrowseModalOpen && (
        <PortalProductBrowseModal
          isOpen={isBrowseModalOpen}
          onClose={() => setIsBrowseModalOpen(false)}
          products={products}
          onAddProducts={handleAddModalProducts}
          addedProductIds={new Set(lines.map((l) => l.product_id))}
        />
      )}
    </div>
  );
}

interface PortalProductBrowseModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductMasterItem[];
  onAddProducts: (selected: ProductMasterItem[]) => void;
  addedProductIds: Set<string>;
}

function PortalProductBrowseModal({
  isOpen,
  onClose,
  products,
  onAddProducts,
  addedProductIds,
}: PortalProductBrowseModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const filtered = products.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    return (
      !q ||
      p.display_name.toLowerCase().includes(q) ||
      (p.letusto_sku || "").toLowerCase().includes(q) ||
      (p.manufacture_sku || "").toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    const selected = products.filter((p) => selectedIds.has(p.id));
    onAddProducts(selected);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh] text-xs">
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">자사 등록 상품 선택</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 font-bold text-base">
            &times;
          </button>
        </div>

        <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/20 border-b border-zinc-150 dark:border-zinc-800">
          <input
            type="text"
            placeholder="제품명, SKU 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 outline-none text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 font-bold border-b border-zinc-150 dark:border-zinc-800">
                <th className="px-3 py-2.5 w-10 text-center">선택</th>
                <th className="px-3 py-2.5">제품명</th>
                <th className="px-3 py-2.5">Letusto SKU</th>
                <th className="px-3 py-2.5">제조사 SKU</th>
                <th className="px-3 py-2.5">포장 단위</th>
                <th className="px-3 py-2.5 text-right">참고 FOB 단가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((p) => {
                const isAdded = addedProductIds.has(p.id);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20">
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={isAdded}
                        checked={isAdded || selectedIds.has(p.id)}
                        onChange={(e) => toggleSelect(p.id, e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-zinc-900 dark:text-white block">{p.display_name}</span>
                      {isAdded && (
                        <span className="text-[9px] font-bold text-zinc-400 block">이미 추가됨</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">{p.letusto_sku || "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-500">{p.manufacture_sku || "-"}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{p.carton_pack_qty || 1}개/Box</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                      ${p.price_usd_fob.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <span className="font-bold text-zinc-500">{selectedIds.size}개 상품 선택됨</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded bg-white text-zinc-700 font-bold"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 rounded bg-zinc-950 text-white font-bold disabled:opacity-50"
            >
              선택한 {selectedIds.size}개 상품 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
