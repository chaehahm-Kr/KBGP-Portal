"use client";

import React, { useState, useTransition } from "react";
import {
  updateRetailerCompanyInfoAction,
  addRetailerStoreByOwnerAction,
  updateRetailerStoreByOwnerAction,
  setRetailerStoreStatusByOwnerAction,
} from "@/lib/retailer/organization-actions";
import { RetailerAgreementCard } from "@/components/retailer/retailer-agreement-card";
import type { CompanyAgreementItem } from "@/lib/agreement/types";
import type { RetailerDocumentRecord } from "@/lib/retailer/agreement-actions";
import { useTranslation } from "@/lib/i18n";
import type { StoreLocationItem, CompanyInfoItem, PersonalProfileItem } from "@/components/retailer/account-organization-view";

interface RetailerCompanySettingsViewProps {
  profile: PersonalProfileItem;
  company: CompanyInfoItem;
  stores: StoreLocationItem[];
  canViewAgreements: boolean;
  companyAgreement?: CompanyAgreementItem | null;
  agreementError?: string | null;
  documents?: RetailerDocumentRecord[];
}

export function RetailerCompanySettingsView({
  profile,
  company,
  stores,
  canViewAgreements,
  companyAgreement = null,
  agreementError = null,
  documents = [],
}: RetailerCompanySettingsViewProps) {
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useTranslation();

  // 1. Company Info Modal State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [compName, setCompName] = useState(company.name);
  const [compRegNo, setCompRegNo] = useState(company.businessRegistrationNumber || "");
  const [compCountry, setCompCountry] = useState(company.country || "US");
  const [compContactName, setCompContactName] = useState(company.contactName || "");
  const [compContactPhone, setCompContactPhone] = useState(company.contactPhone || "");
  const [compContactEmail, setCompContactEmail] = useState(company.contactEmail || "");
  const [compAddress, setCompAddress] = useState(company.address || "");
  const [compCity, setCompCity] = useState(company.city || "");
  const [compState, setCompState] = useState(company.state || "");
  const [compZip, setCompZip] = useState(company.zip || "");
  const [companyError, setCompanyError] = useState("");

  // 2. Store Add/Edit Modal State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocationItem | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeState, setStoreState] = useState("");
  const [storeZip, setStoreZip] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeManagerName, setStoreManagerName] = useState("");
  const [storeManagerPhone, setStoreManagerPhone] = useState("");
  const [sameAsCompany, setSameAsCompany] = useState(false);
  const [storeError, setStoreError] = useState("");

  const isOwner = profile.role.toLowerCase() === "owner";
  const isOwnerOrBuyer = ["owner", "buyer"].includes(profile.role.toLowerCase());

  // Company Handlers
  const handleOpenCompanyModal = () => {
    setCompName(company.name);
    setCompRegNo(company.businessRegistrationNumber || "");
    setCompCountry(company.country || "US");
    setCompContactName(company.contactName || "");
    setCompContactPhone(company.contactPhone || "");
    setCompContactEmail(company.contactEmail || "");
    setCompAddress(company.address || "");
    setCompCity(company.city || "");
    setCompState(company.state || "");
    setCompZip(company.zip || "");
    setCompanyError("");
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError("");

    if (!compName.trim()) {
      setCompanyError(locale === "ko" ? "회사명은 필수입니다." : "Company name is required.");
      return;
    }

    startTransition(async () => {
      const res = await updateRetailerCompanyInfoAction({
        companyId: company.id,
        name: compName.trim(),
        businessRegistrationNumber: compRegNo.trim() || undefined,
        contactName: compContactName.trim() || undefined,
        contactPhone: compContactPhone.trim() || undefined,
        contactEmail: compContactEmail.trim() || undefined,
        address: compAddress.trim() || undefined,
        city: compCity.trim() || undefined,
        state: compState.trim() || undefined,
        zip: compZip.trim() || undefined,
      });

      if (res.success) {
        setIsCompanyModalOpen(false);
        window.location.reload();
      } else {
        setCompanyError(res.error || (locale === "ko" ? "회사 정보 수정에 실패했습니다." : "Failed to update company info."));
      }
    });
  };

  // Store Handlers
  const handleOpenAddStoreModal = () => {
    setEditingStore(null);
    setStoreName("");
    setStoreCode("");
    setStoreAddress("");
    setStoreCity("");
    setStoreState("");
    setStoreZip("");
    setStorePhone("");
    setStoreEmail("");
    setStoreManagerName("");
    setStoreManagerPhone("");
    setSameAsCompany(false);
    setStoreError("");
    setIsStoreModalOpen(true);
  };

  const handleOpenEditStoreModal = (st: StoreLocationItem) => {
    setEditingStore(st);
    setStoreName(st.name);
    setStoreCode(st.storeCode || "");
    setStoreAddress(st.address || "");
    setStoreCity(st.city || "");
    setStoreState(st.state || "");
    setStoreZip(st.zip || "");
    setStorePhone(st.phone || "");
    setStoreEmail(st.email || "");
    setStoreManagerName(st.managerName || "");
    setStoreManagerPhone(st.managerPhone || "");
    setSameAsCompany(false);
    setStoreError("");
    setIsStoreModalOpen(true);
  };

  const handleToggleSameAsCompany = (checked: boolean) => {
    setSameAsCompany(checked);
    if (checked) {
      setStoreAddress(company.address || "");
      setStoreCity(company.city || "");
      setStoreState(company.state || "");
      setStoreZip(company.zip || "");
      if (company.contactPhone) setStorePhone(company.contactPhone);
    }
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError("");

    if (!storeName.trim()) {
      setStoreError(locale === "ko" ? "매장명은 필수입니다." : "Store name is required.");
      return;
    }

    startTransition(async () => {
      if (editingStore) {
        const res = await updateRetailerStoreByOwnerAction({
          storeId: editingStore.id,
          name: storeName.trim(),
          storeCode: storeCode.trim() || undefined,
          address: storeAddress.trim() || undefined,
          city: storeCity.trim() || undefined,
          state: storeState.trim() || undefined,
          zip: storeZip.trim() || undefined,
          phone: storePhone.trim() || undefined,
          email: storeEmail.trim() || undefined,
          managerName: storeManagerName.trim() || undefined,
          managerPhone: storeManagerPhone.trim() || undefined,
        });

        if (res.success) {
          setIsStoreModalOpen(false);
          window.location.reload();
        } else {
          setStoreError(res.error || (locale === "ko" ? "매장 수정에 실패했습니다." : "Failed to update store."));
        }
      } else {
        const res = await addRetailerStoreByOwnerAction({
          companyId: company.id,
          name: storeName.trim(),
          storeCode: storeCode.trim() || undefined,
          address: storeAddress.trim() || undefined,
          city: storeCity.trim() || undefined,
          state: storeState.trim() || undefined,
          zip: storeZip.trim() || undefined,
          phone: storePhone.trim() || undefined,
          email: storeEmail.trim() || undefined,
          managerName: storeManagerName.trim() || undefined,
          managerPhone: storeManagerPhone.trim() || undefined,
        });

        if (res.success) {
          setIsStoreModalOpen(false);
          window.location.reload();
        } else {
          setStoreError(res.error || (locale === "ko" ? "매장 추가에 실패했습니다." : "Failed to add store."));
        }
      }
    });
  };

  const handleToggleStoreStatus = (st: StoreLocationItem) => {
    const isCurrentlyActive = st.status === "active";
    const nextStatus = isCurrentlyActive ? "inactive" : "active";

    const promptText = isCurrentlyActive
      ? (locale === "ko"
          ? `"${st.name}" 매장을 비활성화하시겠습니까?\n\n기존 주문 및 재고 기록은 보존되지만, 새로운 주문 및 주간 점검 목록에서 제외됩니다.`
          : `Are you sure you want to deactivate "${st.name}"?\n\nHistorical transactions, orders, and weekly count records for this store will remain preserved, but the store will no longer be available for new orders or inventory counts.`)
      : (locale === "ko"
          ? `"${st.name}" 매장을 다시 활성화하시겠습니까?`
          : `Reactivate "${st.name}" for active store operations?`);

    if (!confirm(promptText)) return;

    startTransition(async () => {
      const res = await setRetailerStoreStatusByOwnerAction({
        storeId: st.id,
        status: nextStatus,
      });

      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || (locale === "ko" ? "매장 상태 변경에 실패했습니다." : "Failed to update store status."));
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {t.account.companySettingsTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t.account.companySettingsSubtitle}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* SECTION 1: Company Information */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                🏢
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{t.account.companyInfo}</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {locale === "ko" ? "법인 기업" : "Legal Entity"}
                  </span>
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {locale === "ko"
                    ? "사업자 등록 정보, 본사 주소 및 도매 거래 조건입니다."
                    : "Corporate legal entity, registration details, headquarters address, and commercial terms."}
                </p>
              </div>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={handleOpenCompanyModal}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                {t.account.editCompany}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-1">
            <div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {locale === "ko" ? "법인 회사명" : "Legal Company Name"}
              </span>
              <span className="font-bold text-zinc-900 dark:text-white text-sm block mt-0.5">{company.name}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {t.account.businessNumber}
              </span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5">
                {company.businessRegistrationNumber || (locale === "ko" ? "미등록" : "Not recorded")}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {locale === "ko" ? "국가" : "Country"}
              </span>
              <span className="font-semibold text-zinc-900 dark:text-white block mt-0.5">🇺🇸 {company.country}</span>
            </div>

            <div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {locale === "ko" ? "대표 담당자" : "Primary Contact Name"}
              </span>
              <span className="text-zinc-900 dark:text-white font-medium block mt-0.5">{company.contactName || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {locale === "ko" ? "대표 전화번호" : "Company Phone"}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 font-mono block mt-0.5">{company.contactPhone || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {locale === "ko" ? "대표 이메일" : "Company Email"}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 font-mono block mt-0.5">{company.contactEmail || "—"}</span>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                {t.account.address}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 block mt-0.5">
                {company.address
                  ? `${company.address}${company.city ? `, ${company.city}` : ""}${company.state ? ` ${company.state}` : ""}${company.zip ? ` ${company.zip}` : ""}`
                  : (locale === "ko" ? "본사 주소가 등록되지 않았습니다." : "No corporate address recorded")}
              </span>
            </div>
          </div>

          {/* Commercial Terms Summary (Read-Only) */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
            <div>
              <span className="text-zinc-400 block text-[10px] font-medium">
                {locale === "ko" ? "도매 결제 및 거래 조건" : "Payment & Commercial Terms"}
              </span>
              <span className="font-bold text-zinc-900 dark:text-white">
                {company.approvedTerms || company.paymentTerms || "Prepaid Card"}
                {company.creditLimit ? ` · ${locale === "ko" ? "여신 한도" : "Credit Limit"}: $${company.creditLimit.toLocaleString()}` : ""}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0">
              {locale === "ko" ? "본사 심사 승인" : "Admin Underwritten"}
            </span>
          </div>
        </div>

        {/* SECTION 2: Physical Store Locations */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                📍
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{locale === "ko" ? "오프라인 매장 지점" : "Physical Store Locations"}</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {stores.length}
                  </span>
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {locale === "ko"
                    ? "오프라인 리테일 매장 목록입니다. 각 매장별로 별도의 주간 상품 점검 및 가격표 태그를 운영할 수 있습니다."
                    : "Physical storefront retail operating locations. Each store maintains separate weekly inventory counts, assortment, and price tags."}
                </p>
              </div>
            </div>

            {isOwnerOrBuyer && (
              <button
                type="button"
                onClick={handleOpenAddStoreModal}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <span>{t.account.addStore}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {stores.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-zinc-400 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl mx-auto">
                  🏪
                </div>
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {locale === "ko" ? "등록된 매장 지점이 없습니다." : "No store locations have been added yet."}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {locale === "ko"
                      ? "첫 번째 매장 지점을 등록하여 도매 발주와 주간 상품 점검을 시작하세요."
                      : "Add your first store location to enable ordering and weekly inventory counts."}
                  </p>
                </div>
                {isOwnerOrBuyer && (
                  <button
                    type="button"
                    onClick={handleOpenAddStoreModal}
                    className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                  >
                    {t.account.addStore}
                  </button>
                )}
              </div>
            ) : (
              stores.map((st) => {
                const isActive = st.status === "active";
                return (
                  <div
                    key={st.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900"
                        : "border-zinc-200/60 dark:border-zinc-800/50 bg-zinc-100/40 dark:bg-zinc-950/40 opacity-75"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-zinc-900 dark:text-white">
                              🏪 {st.name}
                            </span>
                            {st.storeCode && (
                              <span className="text-[10px] font-mono text-zinc-400">
                                ({st.storeCode})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {st.address ? `${st.address}, ` : ""}{st.city ? `${st.city}, ${st.state || ""}` : (locale === "ko" ? "주소 미입력" : "Address pending")}
                          </p>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                          }`}
                        >
                          {isActive ? t.stores.active : t.stores.inactive}
                        </span>
                      </div>

                      {(st.phone || st.managerName || st.email) && (
                        <div className="pt-2 text-[10px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/80 space-y-0.5 font-mono">
                          {st.phone && <div>📞 {st.phone}</div>}
                          {st.email && <div>✉️ {st.email}</div>}
                          {st.managerName && <div>👤 {locale === "ko" ? "매니저" : "Manager"}: {st.managerName}</div>}
                        </div>
                      )}
                    </div>

                    {isOwnerOrBuyer && (
                      <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenEditStoreModal(st)}
                          className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                        >
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStoreStatus(st)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                            isActive
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400"
                          }`}
                        >
                          {isActive ? t.stores.deactivate : t.stores.reactivate}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 3: Agreements & Documents (Protected / Sensitive) */}
        {canViewAgreements && (
          <div className="space-y-6">
            {/* Section 3-A: Retailer Supply & Platform Operating Agreement */}
            <RetailerAgreementCard
              initialAgreement={companyAgreement}
              error={agreementError}
              companyInfo={{
                id: company.id,
                name: company.name,
                address: company.address,
                representativeName: company.contactName,
              }}
              currentUser={{
                displayName: profile.displayName,
                email: profile.email,
                role: profile.role,
              }}
              onOpenCompanyEdit={handleOpenCompanyModal}
            />

            {/* Section 3-B: General Organization Documents Archive */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-lg">
                  📁
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                    {locale === "ko" ? "조직 서류 보관함" : "Document Archive"}
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {locale === "ko"
                      ? "사업자등록증, 인보이스 및 체결된 공식 계약 서류 보관함입니다."
                      : "All official company certificates, invoices, and signed files associated with your retail account."}
                  </p>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  {locale === "ko" ? "현재 보관된 추가 서류가 없습니다." : "No additional archived files for your organization at this time."}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">{doc.title}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{doc.description || doc.filename}</p>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(doc.createdAt).toLocaleDateString("en-US")} {doc.fileSizeBytes ? `• ${(doc.fileSizeBytes / 1024).toFixed(1)} KB` : ""}
                        </span>
                      </div>

                      {doc.signedUrl && (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors inline-flex items-center gap-1 shrink-0"
                        >
                          <span>⬇️ {t.common.download}</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Company Edit Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {t.account.editCompany}
              </h3>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-3.5 pt-4 text-xs">
              {companyError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {companyError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "회사명" : "Company Legal Name"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.account.businessNumber}
                  </label>
                  <input
                    type="text"
                    value={compRegNo}
                    onChange={(e) => setCompRegNo(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                    placeholder="e.g. 12-3456789"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "국가" : "Country"}
                  </label>
                  <input
                    type="text"
                    value={compCountry}
                    onChange={(e) => setCompCountry(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "담당자명" : "Primary Contact Name"}
                  </label>
                  <input
                    type="text"
                    value={compContactName}
                    onChange={(e) => setCompContactName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "담당자 전화번호" : "Primary Contact Phone"}
                  </label>
                  <input
                    type="text"
                    value={compContactPhone}
                    onChange={(e) => setCompContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "담당자 이메일" : "Primary Contact Email"}
                </label>
                <input
                  type="email"
                  value={compContactEmail}
                  onChange={(e) => setCompContactEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "본사 주소" : "Street Address"}
                </label>
                <input
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  placeholder="e.g. 123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "도시" : "City"}
                  </label>
                  <input
                    type="text"
                    value={compCity}
                    onChange={(e) => setCompCity(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "주 (State)" : "State"}
                  </label>
                  <input
                    type="text"
                    value={compState}
                    onChange={(e) => setCompState(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "우편번호" : "ZIP"}
                  </label>
                  <input
                    type="text"
                    value={compZip}
                    onChange={(e) => setCompZip(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? t.account.saving : t.account.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Store Add/Edit Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {editingStore ? (locale === "ko" ? "매장 지점 수정" : "Edit Store Location") : t.account.addStore}
              </h3>
              <button
                type="button"
                onClick={() => setIsStoreModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-3.5 pt-4 text-xs">
              {storeError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {storeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "매장명" : "Store Name"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    placeholder="e.g. Downtown Branch"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.stores.storeCode} <span className="text-zinc-400 font-normal">({locale === "ko" ? "선택" : "Optional"})</span>
                  </label>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                    placeholder="e.g. STR-002"
                  />
                </div>
              </div>

              {!editingStore && company.address && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsCompany}
                    onChange={(e) => handleToggleSameAsCompany(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-0"
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    {locale === "ko" ? "회사 본사 주소와 동일하게 적용" : "Same address as Company Headquarters"}
                  </span>
                </label>
              )}

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "ko" ? "매장 주소" : "Store Street Address"}
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  placeholder="e.g. 456 Fashion Ave"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "도시" : "City"}
                  </label>
                  <input
                    type="text"
                    value={storeCity}
                    onChange={(e) => setStoreCity(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "주 (State)" : "State"}
                  </label>
                  <input
                    type="text"
                    value={storeState}
                    onChange={(e) => setStoreState(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "우편번호" : "ZIP"}
                  </label>
                  <input
                    type="text"
                    value={storeZip}
                    onChange={(e) => setStoreZip(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "매장 매니저명" : "Manager Name"}
                  </label>
                  <input
                    type="text"
                    value={storeManagerName}
                    onChange={(e) => setStoreManagerName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {locale === "ko" ? "매장 전화번호" : "Store Phone"}
                  </label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                >
                  {isPending ? t.account.saving : (editingStore ? (locale === "ko" ? "수정사항 저장" : "Save Changes") : t.account.addStore)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
