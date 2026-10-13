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
import type {
  AuthoritativeCompanyCore,
  EffectiveRetailerBillingInfo,
} from "@/lib/retailer/organization-mapping";
import { CountrySelect } from "@/components/shared/country-select";

interface RetailerCompanySettingsViewProps {
  profile: PersonalProfileItem;
  company: CompanyInfoItem;
  companyCore?: AuthoritativeCompanyCore;
  billing?: EffectiveRetailerBillingInfo;
  stores: StoreLocationItem[];
  canViewAgreements: boolean;
  companyAgreement?: CompanyAgreementItem | null;
  agreementError?: string | null;
  documents?: RetailerDocumentRecord[];
}

export function RetailerCompanySettingsView({
  profile,
  company,
  companyCore,
  billing,
  stores,
  canViewAgreements,
  companyAgreement = null,
  agreementError = null,
  documents = [],
}: RetailerCompanySettingsViewProps) {
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useTranslation();

  // 1. Company Info & Billing Modal State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [compName, setCompName] = useState(companyCore?.name || company.name);
  const [compRegNo, setCompRegNo] = useState(companyCore?.businessRegistrationNumber || company.businessRegistrationNumber || "");
  const [compCountry, setCompCountry] = useState(companyCore?.country || company.country || "US");
  const [compContactName, setCompContactName] = useState(companyCore?.contactName || company.contactName || "");
  const [compContactPhone, setCompContactPhone] = useState(companyCore?.contactPhone || company.contactPhone || "");
  const [compAddress1, setCompAddress1] = useState(companyCore?.address1 || company.address || "");
  const [compAddress2, setCompAddress2] = useState(companyCore?.address2 || "");
  const [compCity, setCompCity] = useState(companyCore?.city || company.city || "");
  const [compState, setCompState] = useState(companyCore?.state || company.state || "");
  const [compZip, setCompZip] = useState(companyCore?.zipCode || company.zip || "");

  const [billingSameAsHq, setBillingSameAsHq] = useState(billing?.billingSameAsHq ?? true);
  const [billingAddress, setBillingAddress] = useState(billing?.customBillingAddress || "");
  const [billingCity, setBillingCity] = useState(billing?.customBillingCity || "");
  const [billingState, setBillingState] = useState(billing?.customBillingState || "");
  const [billingZip, setBillingZip] = useState(billing?.customBillingZip || "");

  const [billingContactSameAsPrimary, setBillingContactSameAsPrimary] = useState(billing?.billingContactSameAsPrimary ?? true);
  const [billingContactName, setBillingContactName] = useState(billing?.customBillingContactName || "");
  const [billingContactPhone, setBillingContactPhone] = useState(billing?.customBillingContactPhone || "");
  const [billingContactEmail, setBillingContactEmail] = useState(billing?.billingContactEmail || company.contactEmail || "");

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
    setCompName(companyCore?.name || company.name);
    setCompRegNo(companyCore?.businessRegistrationNumber || company.businessRegistrationNumber || "");
    setCompCountry(companyCore?.country || company.country || "US");
    setCompContactName(companyCore?.contactName || company.contactName || "");
    setCompContactPhone(companyCore?.contactPhone || company.contactPhone || "");
    setCompAddress1(companyCore?.address1 || company.address || "");
    setCompAddress2(companyCore?.address2 || "");
    setCompCity(companyCore?.city || company.city || "");
    setCompState(companyCore?.state || company.state || "");
    setCompZip(companyCore?.zipCode || company.zip || "");

    setBillingSameAsHq(billing?.billingSameAsHq ?? true);
    setBillingAddress(billing?.customBillingAddress || "");
    setBillingCity(billing?.customBillingCity || "");
    setBillingState(billing?.customBillingState || "");
    setBillingZip(billing?.customBillingZip || "");

    setBillingContactSameAsPrimary(billing?.billingContactSameAsPrimary ?? true);
    setBillingContactName(billing?.customBillingContactName || "");
    setBillingContactPhone(billing?.customBillingContactPhone || "");
    setBillingContactEmail(billing?.billingContactEmail || company.contactEmail || "");

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
        country: compCountry.trim() || "US",
        contactName: compContactName.trim() || undefined,
        contactPhone: compContactPhone.trim() || undefined,
        address1: compAddress1.trim() || undefined,
        address2: compAddress2.trim() || undefined,
        city: compCity.trim() || undefined,
        state: compState.trim() || undefined,
        zipCode: compZip.trim() || undefined,

        billingSameAsHq,
        billingAddress: billingSameAsHq ? undefined : billingAddress.trim() || undefined,
        billingCity: billingSameAsHq ? undefined : billingCity.trim() || undefined,
        billingState: billingSameAsHq ? undefined : billingState.trim() || undefined,
        billingZip: billingSameAsHq ? undefined : billingZip.trim() || undefined,

        billingContactSameAsPrimary,
        billingContactName: billingContactSameAsPrimary ? undefined : billingContactName.trim() || undefined,
        billingContactPhone: billingContactSameAsPrimary ? undefined : billingContactPhone.trim() || undefined,
        billingContactEmail: billingContactEmail.trim() || undefined,
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
        {/* SECTION 1: Company Core & Billing Profile */}
        <div className="space-y-4">
          {/* Card 1: Authoritative Company Core */}
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
                      {locale === "ko" ? "법인 기본 정보" : "Company Core"}
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {locale === "ko"
                      ? "공식 법인 식별 정보, 사업자 등록 번호 및 본사 소재지 주소입니다."
                      : "Official legal entity identity, tax registration, primary representative, and corporate headquarters address."}
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "법인 회사명" : "Legal Company Name"}
                </span>
                <span className="font-bold text-zinc-900 dark:text-white text-sm block mt-0.5">
                  {companyCore?.name || company.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "기업 코드" : "Company Code"}
                </span>
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 block mt-0.5">
                  {companyCore?.companyCode || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {t.account.businessNumber}
                </span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5">
                  {companyCore?.businessRegistrationNumber || company.businessRegistrationNumber || (locale === "ko" ? "미등록" : "Not recorded")}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "국가" : "Country"}
                </span>
                <span className="font-semibold text-zinc-900 dark:text-white block mt-0.5">
                  🇺🇸 {companyCore?.country || company.country}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "대표 담당자" : "Primary Contact Name"}
                </span>
                <span className="text-zinc-900 dark:text-white font-medium block mt-0.5">
                  {companyCore?.contactName || company.contactName || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "대표 전화번호" : "Primary Phone"}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200 font-mono block mt-0.5">
                  {companyCore?.contactPhone || company.contactPhone || "—"}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "본사 소재지 주소 (HQ Address)" : "Corporate Headquarters Address"}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200 block mt-0.5">
                  {companyCore?.formattedHqAddress || (locale === "ko" ? "본사 주소가 등록되지 않았습니다." : "No corporate HQ address recorded")}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Retailer Commercial & Billing Profile */}
          <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/10 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200/50 dark:border-indigo-900/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100/70 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-lg">
                  💳
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>{locale === "ko" ? "청구지 및 도매 거래 조건" : "Retailer Billing & Commercial Setup"}</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                      {locale === "ko" ? "상거래 프로필" : "Commercial Profile"}
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {locale === "ko"
                      ? "인보이스 청구지 주소, 회계 담당자, 재판매 면허 번호 및 승인된 결제 조건입니다."
                      : "Invoicing billing address, accounting contact, resale certificate, and approved wholesale payment terms."}
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={handleOpenCompanyModal}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer shrink-0"
                >
                  {locale === "ko" ? "청구 정보 수정" : "Edit Billing Details"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {locale === "ko" ? "인보이스 청구지 주소" : "Billing Address"}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                    billing?.billingSameAsHq
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                  }`}>
                    {billing?.billingSameAsHq ? (locale === "ko" ? "본사 주소와 동일" : "Same as HQ") : (locale === "ko" ? "별도 청구지" : "Custom Address")}
                  </span>
                </div>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium block mt-1">
                  {billing?.formattedBillingAddress || (locale === "ko" ? "청구지 주소 미입력" : "No billing address recorded")}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {locale === "ko" ? "청구 / 회계 담당자" : "Billing Contact"}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                    billing?.billingContactSameAsPrimary
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                  }`}>
                    {billing?.billingContactSameAsPrimary ? (locale === "ko" ? "대표 담당자와 동일" : "Same as Primary") : (locale === "ko" ? "별도 담당자" : "Custom Contact")}
                  </span>
                </div>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium block mt-1">
                  {billing?.effectiveBillingContactName || "—"}
                  {billing?.effectiveBillingContactPhone ? ` (${billing.effectiveBillingContactPhone})` : ""}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono block mt-0.5">
                  {billing?.billingContactEmail || company.contactEmail || "—"}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "ko" ? "재판매 면허 번호 (Resale Certificate)" : "Resale Certificate / Tax ID"}
                </span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-white block mt-1">
                  {company.resaleCertificateNumber || (locale === "ko" ? "미등록 (과세 대상)" : "Not recorded")}
                </span>
              </div>

              <div className="col-span-full p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
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

              {/* SECTION 1: Authoritative Company Core */}
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 dark:border-zinc-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🏢</span> {locale === "ko" ? "1. 법인 기본 정보 (Company Core)" : "1. Company Information"}
                  </h4>
                  <span className="text-[10px] font-medium text-zinc-400">
                    {locale === "ko" ? "공식 법인 식별 (`companies` 마스터)" : "Authoritative Company Core"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
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

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {locale === "ko" ? "기업 코드" : "Company Code"}
                    </label>
                    <input
                      type="text"
                      disabled
                      value={companyCore?.companyCode || "Auto-assigned"}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-800 text-zinc-500 font-mono"
                    />
                  </div>

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
                    <CountrySelect
                      value={compCountry}
                      onChange={(val) => setCompCountry(val)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {locale === "ko" ? "대표 담당자명" : "Primary Contact Name"}
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
                      {locale === "ko" ? "대표 전화번호" : "Primary Phone"}
                    </label>
                    <input
                      type="text"
                      value={compContactPhone}
                      onChange={(e) => setCompContactPhone(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {locale === "ko" ? "본사 주소 Line 1" : "HQ Street Address Line 1"}
                    </label>
                    <input
                      type="text"
                      value={compAddress1}
                      onChange={(e) => setCompAddress1(e.target.value)}
                      placeholder="e.g. 123 Main St"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {locale === "ko" ? "본사 주소 Line 2 (선택)" : "HQ Address Line 2 (Optional)"}
                    </label>
                    <input
                      type="text"
                      value={compAddress2}
                      onChange={(e) => setCompAddress2(e.target.value)}
                      placeholder="Suite, Unit, Floor"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>

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

                  <div className="grid grid-cols-2 gap-2">
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
                </div>
              </div>

              {/* SECTION 2: Retailer Commercial & Billing Profile */}
              <div className="space-y-3 rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2 dark:border-indigo-900/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>💳</span> {locale === "ko" ? "2. 청구지 및 인보이스 프로필 (Billing Profile)" : "2. Invoicing & Billing Profile"}
                  </h4>
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                    {locale === "ko" ? "리테일 상거래 정보 (`retailer_profiles`)" : "Retailer Commercial Profile"}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Billing Address Toggle & Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                        {locale === "ko" ? "인보이스 청구지 주소" : "Billing Address"}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={billingSameAsHq}
                          onChange={(e) => setBillingSameAsHq(e.target.checked)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-[11px]">
                          {locale === "ko" ? "본사 주소와 동일 (Same as HQ)" : "Same as Company HQ Address"}
                        </span>
                      </label>
                    </div>

                    {billingSameAsHq ? (
                      <div className="p-2.5 rounded-lg bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {locale === "ko" ? "본사 주소 적용:" : "Using HQ Address:"}
                        </span>{" "}
                        {[compAddress1, compCity, compState, compZip].filter(Boolean).join(", ") || "(HQ address not yet entered)"}
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          placeholder="Separate Billing Street Address"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={billingCity}
                            onChange={(e) => setBillingCity(e.target.value)}
                            placeholder="Billing City"
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={billingState}
                            onChange={(e) => setBillingState(e.target.value)}
                            placeholder="State"
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={billingZip}
                            onChange={(e) => setBillingZip(e.target.value)}
                            placeholder="ZIP"
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Billing Contact Toggle & Fields */}
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                        {locale === "ko" ? "청구 / 회계 담당자" : "Billing Contact"}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={billingContactSameAsPrimary}
                          onChange={(e) => setBillingContactSameAsPrimary(e.target.checked)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-[11px]">
                          {locale === "ko" ? "대표 담당자와 동일 (Same as Primary)" : "Same as Primary Contact"}
                        </span>
                      </label>
                    </div>

                    {billingContactSameAsPrimary ? (
                      <div className="p-2.5 rounded-lg bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {locale === "ko" ? "대표 담당자 정보 적용:" : "Using Primary Contact:"}
                        </span>{" "}
                        {compContactName ? `${compContactName} (${compContactPhone || "No phone"})` : "(Primary contact not entered)"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <input
                          type="text"
                          value={billingContactName}
                          onChange={(e) => setBillingContactName(e.target.value)}
                          placeholder="Billing Contact Person"
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={billingContactPhone}
                          onChange={(e) => setBillingContactPhone(e.target.value)}
                          placeholder="Billing Phone"
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Billing Email Field */}
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {locale === "ko" ? "인보이스 및 청구 안내 수신 이메일" : "Billing & Invoicing Email Address"}
                    </label>
                    <input
                      type="email"
                      value={billingContactEmail}
                      onChange={(e) => setBillingContactEmail(e.target.value)}
                      placeholder="ap@retailer.com or accounting@store.com"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                    />
                    <span className="text-[10px] text-zinc-400 mt-1 block">
                      {locale === "ko"
                        ? "도매 발주서 영수증, 결제 내역서 및 정산 안내가 발송되는 이메일입니다."
                        : "Commercial invoice statements, order receipts, and billing notifications are routed here."}
                    </span>
                  </div>
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
