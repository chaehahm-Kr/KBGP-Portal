"use client";

import React, { useState, useTransition } from "react";
import {
  type CompanyShippingOrigin,
  type ShippingOriginInput,
  adminCreateShippingOrigin,
  adminUpdateShippingOrigin,
  adminDeleteShippingOrigin,
  adminSetDefaultShippingOrigin,
  portalCreateShippingOrigin,
  portalUpdateShippingOrigin,
  portalDeleteShippingOrigin,
  portalSetDefaultShippingOrigin,
} from "@/lib/company/shipping-origin-actions";
import { CountrySelect } from "@/components/shared/country-select";
import { InternationalPhoneInput } from "@/components/shared/international-phone-input";

interface CompanyShippingOriginsTabProps {
  companyId: string;
  initialOrigins: CompanyShippingOrigin[];
  mode: "admin" | "portal";
  canEdit?: boolean;
}

export function CompanyShippingOriginsTab({
  companyId,
  initialOrigins = [],
  mode,
  canEdit = true,
}: CompanyShippingOriginsTabProps) {
  const [origins, setOrigins] = useState<CompanyShippingOrigin[]>(initialOrigins);
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState<CompanyShippingOrigin | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formCountry, setFormCountry] = useState("South Korea");
  const [formAddress1, setFormAddress1] = useState("");
  const [formAddress2, setFormAddress2] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Delete modal state
  const [deletingOrigin, setDeletingOrigin] = useState<CompanyShippingOrigin | null>(null);

  const openAddModal = () => {
    setEditingOrigin(null);
    setFormName("");
    setFormIsDefault(origins.length === 0);
    setFormStatus("active");
    setFormCountry("South Korea");
    setFormAddress1("");
    setFormAddress2("");
    setFormCity("");
    setFormState("");
    setFormPostalCode("");
    setFormContactName("");
    setFormPhone("");
    setFormEmail("");
    setFormNotes("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (origin: CompanyShippingOrigin) => {
    setEditingOrigin(origin);
    setFormName(origin.name);
    setFormIsDefault(origin.is_default);
    setFormStatus(origin.status || "active");
    setFormCountry(origin.country || "South Korea");
    setFormAddress1(origin.address_line1 || "");
    setFormAddress2(origin.address_line2 || "");
    setFormCity(origin.city || "");
    setFormState(origin.state_province || "");
    setFormPostalCode(origin.postal_code || "");
    setFormContactName(origin.contact_name || "");
    setFormPhone(origin.phone || "");
    setFormEmail(origin.email || "");
    setFormNotes(origin.notes || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveOrigin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("출고지명을 입력해주세요.");
      return;
    }
    if (!formCountry.trim()) {
      setFormError("국가를 선택해주세요.");
      return;
    }
    if (!formAddress1.trim()) {
      setFormError("주소 1(기본 주소)을 입력해주세요.");
      return;
    }
    if (!formCity.trim()) {
      setFormError("도시(City)를 입력해주세요.");
      return;
    }
    if (!formPostalCode.trim()) {
      setFormError("우편번호(Postal / ZIP Code)를 입력해주세요.");
      return;
    }

    const payload: ShippingOriginInput = {
      name: formName.trim(),
      is_default: formIsDefault,
      status: formStatus,
      country: formCountry.trim(),
      address_line1: formAddress1.trim(),
      address_line2: formAddress2.trim(),
      city: formCity.trim(),
      state_province: formState.trim(),
      postal_code: formPostalCode.trim(),
      contact_name: formContactName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      notes: formNotes.trim(),
    };

    startTransition(async () => {
      try {
        if (editingOrigin) {
          // Update
          let res;
          if (mode === "admin") {
            res = await adminUpdateShippingOrigin(editingOrigin.id, companyId, payload);
          } else {
            res = await portalUpdateShippingOrigin(editingOrigin.id, payload);
          }
          if (res.success) {
            setOrigins((prev) => {
              const updated = prev.map((o) => {
                if (o.id === editingOrigin.id) return res.data;
                if (payload.is_default) return { ...o, is_default: false };
                return o;
              });
              return updated.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
            });
            setIsModalOpen(false);
          }
        } else {
          // Create
          let res;
          if (mode === "admin") {
            res = await adminCreateShippingOrigin(companyId, payload);
          } else {
            res = await portalCreateShippingOrigin(payload);
          }
          if (res.success) {
            setOrigins((prev) => {
              let updated = prev;
              if (payload.is_default) {
                updated = updated.map((o) => ({ ...o, is_default: false }));
              }
              updated = [...updated, res.data];
              return updated.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
            });
            setIsModalOpen(false);
          }
        }
      } catch (err: any) {
        setFormError(err.message || "출고지 정보 저장 중 오류가 발생했습니다.");
      }
    });
  };

  const handleSetDefault = async (origin: CompanyShippingOrigin) => {
    if (origin.is_default) return;
    startTransition(async () => {
      try {
        if (mode === "admin") {
          await adminSetDefaultShippingOrigin(origin.id, companyId);
        } else {
          await portalSetDefaultShippingOrigin(origin.id);
        }
        setOrigins((prev) => {
          const updated = prev.map((o) => ({
            ...o,
            is_default: o.id === origin.id,
          }));
          return updated.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
        });
      } catch (err: any) {
        alert(err.message || "기본 출고지 설정 실패");
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingOrigin) return;
    startTransition(async () => {
      try {
        if (mode === "admin") {
          await adminDeleteShippingOrigin(deletingOrigin.id, companyId);
        } else {
          await portalDeleteShippingOrigin(deletingOrigin.id);
        }
        setOrigins((prev) => {
          const remaining = prev.filter((o) => o.id !== deletingOrigin.id);
          if (deletingOrigin.is_default && remaining.length === 1) {
            remaining[0].is_default = true;
          }
          return remaining;
        });
        setDeletingOrigin(null);
      } catch (err: any) {
        alert(err.message || "출고지 삭제 실패");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              출고지 정보 (Shipping Origin)
            </h3>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
              {origins.length}개
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            공급사/브랜드사가 실제 제품을 출고(Ship From)하는 장소의 기본 주소 및 담당자 정보를 관리합니다.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>+</span>
            <span>출고지 추가</span>
          </button>
        )}
      </div>

      {/* Origin Cards List */}
      {origins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-250 dark:border-zinc-800 p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="mx-auto w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
            📍
          </div>
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            등록된 출고지 정보가 없습니다.
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            새로운 출고지를 추가하여 상품 출고지 주소와 담당자 연락처를 등록하세요.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-3 inline-flex items-center gap-1 rounded bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              + 첫 번째 출고지 등록
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {origins.map((origin) => (
            <div
              key={origin.id}
              className={`rounded-lg border p-4 shadow-sm transition-all flex flex-col justify-between ${
                origin.is_default
                  ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-900 dark:bg-emerald-950/10 ring-1 ring-emerald-400/30"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="space-y-3">
                {/* Card Top Title & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                        {origin.name}
                      </h4>
                      {origin.is_default && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span>✓</span> 기본 출고지
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                          origin.status === "active"
                            ? "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                        }`}
                      >
                        {origin.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="rounded-md bg-zinc-50 dark:bg-zinc-950/40 p-2.5 border border-zinc-150 dark:border-zinc-850 text-xs space-y-1">
                  <div className="text-[11px] text-zinc-850 dark:text-zinc-200 font-medium">
                    {origin.address_line1}
                    {origin.address_line2 ? ` ${origin.address_line2}` : ""}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap font-mono">
                    <span>{origin.city}</span>
                    {origin.state_province && <span>, {origin.state_province}</span>}
                    <span className="font-bold">({origin.postal_code})</span>
                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                    <span className="font-sans font-semibold text-zinc-700 dark:text-zinc-300">
                      {origin.country}
                    </span>
                  </div>
                </div>

                {/* Contact Information */}
                {(origin.contact_name || origin.phone || origin.email) && (
                  <div className="text-[11px] space-y-0.5 text-zinc-600 dark:text-zinc-400 pt-1">
                    {origin.contact_name && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-12">
                          담당자
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {origin.contact_name}
                        </span>
                      </div>
                    )}
                    {origin.phone && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-12">
                          전화번호
                        </span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">
                          {origin.phone}
                        </span>
                      </div>
                    )}
                    {origin.email && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-12">
                          이메일
                        </span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">
                          {origin.email}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {origin.notes && (
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded border border-amber-200/60 dark:border-amber-900/40 whitespace-pre-wrap">
                    <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">
                      메모:
                    </span>
                    {origin.notes}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {canEdit && (
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div>
                    {!origin.is_default ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(origin)}
                        disabled={isPending}
                        className="text-[11px] font-bold text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        기본 출고지로 설정
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        ● 기본 출고지
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(origin)}
                      disabled={isPending}
                      className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingOrigin(origin)}
                      disabled={isPending}
                      className="rounded border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                {editingOrigin ? "출고지 정보 수정" : "신규 출고지 등록"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveOrigin} className="space-y-4 text-xs">
              {/* Row 1: Name & Default & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    출고지명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="예: 본사 메인 물류센터, 서울 오피스, 부산 물류창고"
                    required
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-900 dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    국가 <span className="text-rose-500">*</span>
                  </label>
                  <CountrySelect
                    value={formCountry}
                    onChange={(val) => setFormCountry(val)}
                    placeholder="국가 선택"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    상태
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="mt-1 w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                  >
                    <option value="active">Active (사용중)</option>
                    <option value="inactive">Inactive (미사용)</option>
                  </select>
                </div>
              </div>

              {/* Default Checkbox */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-150 dark:border-zinc-850">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      기본 출고지로 지정
                    </span>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      회사당 기본 출고지는 최대 1개만 지정됩니다. 새로 지정 시 기존 기본 출고지는 자동 해제됩니다.
                    </p>
                  </div>
                </label>
              </div>

              {/* Address Fields */}
              <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  출고지 주소 (Address)
                </span>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    기본 주소 (Address Line 1) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formAddress1}
                    onChange={(e) => setFormAddress1(e.target.value)}
                    placeholder="도로명 주소 또는 기본 주소 입력"
                    required
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    상세 주소 (Address Line 2, 선택)
                  </label>
                  <input
                    type="text"
                    value={formAddress2}
                    onChange={(e) => setFormAddress2(e.target.value)}
                    placeholder="동/호수, 층수, 물류동 번호 등 상세 주소"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      도시 (City) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="예: 서울특별시, Los Angeles"
                      required
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      주 / 도 (State / Prov, 선택)
                    </label>
                    <input
                      type="text"
                      value={formState}
                      onChange={(e) => setFormState(e.target.value)}
                      placeholder="예: 경기도, CA"
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      우편번호 (ZIP Code) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formPostalCode}
                      onChange={(e) => setFormPostalCode(e.target.value)}
                      placeholder="우편번호 입력"
                      required
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Fields */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  출고지 담당자 정보 (선택)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      담당자명
                    </label>
                    <input
                      type="text"
                      value={formContactName}
                      onChange={(e) => setFormContactName(e.target.value)}
                      placeholder="홍길동"
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      담당자 전화번호
                    </label>
                    <InternationalPhoneInput
                      value={formPhone}
                      onChange={(val) => setFormPhone(val)}
                      placeholder="전화번호 입력"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      담당자 이메일
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="shipping@company.com"
                      className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  메모 / 비고 (선택)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="출고지 출입 유의사항, 배송 기사 전달사항 등 자유 메모"
                  rows={2}
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="rounded px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "저장 중..." : editingOrigin ? "수정 완료" : "출고지 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrigin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h4 className="text-sm font-bold text-zinc-950 dark:text-white mb-2">
              출고지 삭제 확인
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              <span className="font-bold text-zinc-900 dark:text-white">
                "{deletingOrigin.name}"
              </span>{" "}
              출고지를 삭제하시겠습니까?
              {deletingOrigin.is_default && (
                <span className="block mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ 이 출고지는 현재 기본 출고지입니다.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingOrigin(null)}
                disabled={isPending}
                className="rounded px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
