"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { updateCompanyAdminMetadata, type CompanyContact, type CompanyParsedMetadata } from "@/lib/company/admin-actions";
import { type PartnerStatusConfig } from "@/lib/settings/actions";

interface CompanyDetailManagerProps {
  company: {
    id: string;
    name: string;
    business_registration_number: string;
    country: string;
    status: string;
    created_at: string;
  };
  parsedMeta: CompanyParsedMetadata;
  brands: {
    id: string;
    name: string;
    logoUrl: string | null;
    introText: string | null;
    hasKr: boolean;
    krNum: string | null;
    krUrl: string | null;
    hasUs: boolean;
    usNum: string | null;
    usUrl: string | null;
  }[];
  products: {
    id: string;
    name: string;
    brand_id: string;
  }[];
  applications: {
    id: string;
    application_number: string;
    status: string;
    submitted_at: string;
  }[];
  brandNameById: Map<string, string>;
  typeOptions: string[];
  statusOptions: PartnerStatusConfig[];
}

export function CompanyDetailManager({
  company,
  parsedMeta,
  brands,
  products,
  applications,
  brandNameById,
  typeOptions,
  statusOptions,
}: CompanyDetailManagerProps) {
  const [activeTab, setActiveTab] = useState<"brands" | "products" | "applications">("brands");
  const [isPending, startTransition] = useTransition();

  // Company general metadata states
  const [address, setAddress] = useState(parsedMeta.address);
  const [website, setWebsite] = useState(parsedMeta.website);
  const [adminMemo, setAdminMemo] = useState(parsedMeta.adminMemo);
  const [type, setType] = useState(parsedMeta.type);
  const [status, setStatus] = useState(parsedMeta.status);
  
  // Contacts state
  const [contacts, setContacts] = useState<CompanyContact[]>(parsedMeta.contacts);
  
  // Editing modes
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);

  // Temporary edit states
  const [tempAddress, setTempAddress] = useState(address);
  const [tempWebsite, setTempWebsite] = useState(website);
  const [tempAdminMemo, setTempAdminMemo] = useState(adminMemo);
  const [tempType, setTempType] = useState(type);
  const [tempStatus, setTempStatus] = useState(status);
  
  const [tempContacts, setTempContacts] = useState<CompanyContact[]>([...contacts]);

  // Form submit handles
  const handleSaveMeta = async () => {
    startTransition(async () => {
      try {
        await updateCompanyAdminMetadata(company.id, {
          address: tempAddress,
          website: tempWebsite,
          adminMemo: tempAdminMemo,
          contacts: contacts, // keep contacts unchanged
          type: tempType,
          status: tempStatus,
        });
        setAddress(tempAddress);
        setWebsite(tempWebsite);
        setAdminMemo(tempAdminMemo);
        setType(tempType);
        setStatus(tempStatus);
        setIsEditingMeta(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "정보 저장 실패");
      }
    });
  };

  const handleSaveContacts = async () => {
    startTransition(async () => {
      try {
        // Validate contacts
        const invalid = tempContacts.some(c => !c.name.trim());
        if (invalid) {
          alert("담당자 이름은 필수 입력 항목입니다.");
          return;
        }

        // Ensure at least one contact is marked isPrimary if list is not empty
        if (tempContacts.length > 0) {
          const hasPrimary = tempContacts.some(c => c.isPrimary);
          if (!hasPrimary) {
            tempContacts[0].isPrimary = true;
          }
        }

        await updateCompanyAdminMetadata(company.id, {
          address,
          website,
          adminMemo,
          contacts: tempContacts,
          type,
          status,
        });
        setContacts(tempContacts);
        setIsEditingContacts(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "담당자 정보 저장 실패");
      }
    });
  };

  const addContactRow = () => {
    const isFirst = tempContacts.length === 0;
    setTempContacts([
      ...tempContacts,
      {
        id: crypto.randomUUID(),
        name: "",
        phone: "",
        email: "",
        title: "",
        position: "",
        isPrimary: isFirst,
      },
    ]);
  };

  const removeContactRow = (id: string) => {
    const target = tempContacts.find(c => c.id === id);
    const filtered = tempContacts.filter(c => c.id !== id);
    
    // If we removed a primary contact, make the first remaining one primary
    if (target?.isPrimary && filtered.length > 0) {
      filtered[0].isPrimary = true;
    }
    setTempContacts(filtered);
  };

  const updateContactField = (id: string, field: keyof CompanyContact, value: any) => {
    setTempContacts(
      tempContacts.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleTogglePrimary = (id: string) => {
    setTempContacts(
      tempContacts.map(c => ({
        ...c,
        isPrimary: c.id === id,
      }))
    );
  };

  // Get status color configuration
  const statusConfig = statusOptions.find(s => s.id === status) || { label: status, color: "zinc" };
  const statusColorClass =
    statusConfig.color === "emerald"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-105 dark:border-emerald-900"
      : statusConfig.color === "amber"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-105 dark:border-amber-900"
      : statusConfig.color === "rose"
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-105 dark:border-rose-900"
      : statusConfig.color === "blue"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-105 dark:border-blue-900"
      : "bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-350 border-zinc-105 dark:border-zinc-700";

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/companies"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            &larr; 회사 목록으로 돌아가기
          </Link>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white mt-1">
            {company.name} 상세 정보
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Left Column: Fixed General Company & Contact Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Company Details Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                회사 기본 정보
              </span>
              {!isEditingMeta ? (
                <button
                  onClick={() => {
                    setTempAddress(address);
                    setTempWebsite(website);
                    setTempAdminMemo(adminMemo);
                    setTempType(type);
                    setTempStatus(status);
                    setIsEditingMeta(true);
                  }}
                  className="text-xs font-semibold text-zinc-550 hover:underline dark:text-zinc-400"
                >
                  수정
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMeta}
                    disabled={isPending}
                    className="text-xs font-bold text-emerald-650 hover:underline disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setIsEditingMeta(false)}
                    className="text-xs font-semibold text-zinc-400 hover:underline"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 text-xs">
              {/* Status Section */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">파트너 상태</span>
                {isEditingMeta ? (
                  <select
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`mt-1 inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${statusColorClass}`}
                  >
                    {statusConfig.label}
                  </span>
                )}
              </div>

              {/* Type Section */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 유형</span>
                {isEditingMeta ? (
                  <select
                    value={tempType}
                    onChange={(e) => setTempType(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{type}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">국가</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{company.country}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">사업자등록번호</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{company.business_registration_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">등록일</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">
                  {new Date(company.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Address (Editable) */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 주소</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempAddress}
                    onChange={(e) => setTempAddress(e.target.value)}
                    placeholder="회사 주소를 입력해주세요"
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 block whitespace-pre-wrap">
                    {address || "주소 미등록"}
                  </span>
                )}
              </div>

              {/* Website (Editable) */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">웹사이트</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempWebsite}
                    onChange={(e) => setTempWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                ) : (
                  website ? (
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-600 dark:text-emerald-450 hover:underline mt-0.5 inline-block"
                    >
                      {website}
                    </a>
                  ) : (
                    <span className="font-semibold text-zinc-400 mt-0.5 block">웹사이트 미등록</span>
                  )
                )}
              </div>

              {/* Admin Memo (Editable) */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase block">관리자 메모</span>
                {isEditingMeta ? (
                  <textarea
                    value={tempAdminMemo}
                    onChange={(e) => setTempAdminMemo(e.target.value)}
                    placeholder="관리자용 내부 메모를 작성하세요"
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                  />
                ) : (
                  <div className="bg-zinc-50 p-2.5 rounded-md mt-1 border border-zinc-150 text-[11px] text-zinc-600 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-400 min-h-[50px] whitespace-pre-wrap leading-relaxed">
                    {adminMemo || "작성된 관리자 메모가 없습니다."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-950 dark:text-white">담당자 목록 ({contacts.length})</h3>
              {!isEditingContacts ? (
                <button
                  onClick={() => {
                    setTempContacts([...contacts]);
                    setIsEditingContacts(true);
                  }}
                  className="text-xs font-semibold text-zinc-550 hover:underline dark:text-zinc-400"
                >
                  관리
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveContacts}
                    disabled={isPending}
                    className="text-xs font-bold text-emerald-650 hover:underline disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setIsEditingContacts(false)}
                    className="text-xs font-semibold text-zinc-400 hover:underline"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            {!isEditingContacts ? (
              <div className="space-y-4">
                {contacts.length > 0 ? (
                  contacts.map((contact, index) => (
                    <div key={contact.id || index} className={`text-xs space-y-2 ${index > 0 ? "pt-4 border-t border-zinc-100 dark:border-zinc-800/80" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="font-bold text-zinc-900 dark:text-white text-[13px] flex items-center gap-1.5">
                            {contact.name}
                            {contact.isPrimary && (
                              <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                                주 컨택
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {contact.title && (
                            <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-600 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
                              직함: {contact.title}
                            </span>
                          )}
                          {contact.position && (
                            <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-600 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
                              부서: {contact.position}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-550 dark:text-zinc-450">
                        {contact.phone && <p>📞 {contact.phone}</p>}
                        {contact.email && <p>✉️ {contact.email}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400 py-3 text-center">등록된 담당자 정보가 없습니다.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {tempContacts.map((contact, index) => (
                  <div key={contact.id} className="p-3 rounded-md border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2.5 relative">
                    <button
                      type="button"
                      onClick={() => removeContactRow(contact.id)}
                      className="absolute top-2 right-2 text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      삭제
                    </button>
                    
                    {/* Primary checkbox selector */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`primary-${contact.id}`}
                        checked={contact.isPrimary}
                        onChange={() => handleTogglePrimary(contact.id)}
                        className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3 w-3"
                      />
                      <label htmlFor={`primary-${contact.id}`} className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 select-none">
                        대표 담당자(주 컨택 직원)로 지정
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 block">이름</label>
                        <input
                          type="text"
                          required
                          value={contact.name}
                          onChange={(e) => updateContactField(contact.id, "name", e.target.value)}
                          placeholder="담당자 이름"
                          className="mt-0.5 w-full rounded border border-zinc-200 p-1 text-[11px] outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 block">직함</label>
                        <input
                          type="text"
                          value={contact.title}
                          onChange={(e) => updateContactField(contact.id, "title", e.target.value)}
                          placeholder="예: 과장, 대표"
                          className="mt-0.5 w-full rounded border border-zinc-200 p-1 text-[11px] outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 block">포지션 / 부서</label>
                        <input
                          type="text"
                          value={contact.position}
                          onChange={(e) => updateContactField(contact.id, "position", e.target.value)}
                          placeholder="예: 해외영업부, 마케팅"
                          className="mt-0.5 w-full rounded border border-zinc-200 p-1 text-[11px] outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 block">연락처</label>
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={(e) => updateContactField(contact.id, "phone", e.target.value)}
                          placeholder="010-1234-5678"
                          className="mt-0.5 w-full rounded border border-zinc-200 p-1 text-[11px] outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 block">이메일</label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateContactField(contact.id, "email", e.target.value)}
                        placeholder="user@example.com"
                        className="mt-0.5 w-full rounded border border-zinc-200 p-1 text-[11px] outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addContactRow}
                  className="w-full py-1.5 border border-dashed border-zinc-300 rounded-md text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-950/20"
                >
                  + 담당자 추가
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tabbed Lists (Brands, Products, Applications) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Selector Buttons */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab("brands")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                activeTab === "brands"
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              등록 브랜드 ({brands.length})
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                activeTab === "products"
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              등록 제품 목록 ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("applications")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-[2px] ${
                activeTab === "applications"
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              입점 신청 이력 ({applications.length})
            </button>
          </div>

          {/* Tab Contents */}
          <div className="pt-2">
            {activeTab === "brands" && (
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                {brands.length > 0 ? (
                  <div className="space-y-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {brands.map((brand, idx) => (
                      <div key={brand.id} className={`flex flex-col md:flex-row gap-4 ${idx > 0 ? "pt-4" : ""}`}>
                        {/* Logo */}
                        <div className="shrink-0">
                          {brand.logoUrl ? (
                            <img
                              src={brand.logoUrl}
                              alt=""
                              className="h-12 w-12 rounded-md border border-zinc-200 dark:border-zinc-800 object-cover bg-zinc-50 dark:bg-zinc-950"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-400 select-none">
                              LOGO
                            </div>
                          )}
                        </div>
                        {/* Meta & Trademarks */}
                        <div className="flex-1 space-y-2 text-xs">
                          <div>
                            <h4 className="font-bold text-zinc-900 dark:text-white text-sm">{brand.name}</h4>
                            {brand.introText && (
                              <p className="text-zinc-550 dark:text-zinc-400 mt-0.5 leading-snug">{brand.introText}</p>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50/50 p-3 rounded-lg border border-zinc-150 dark:bg-zinc-950/20 dark:border-zinc-800/50">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-wider block">대한민국 특허청 상표권</span>
                              {brand.hasKr ? (
                                <div className="space-y-1">
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-450">등록 완료</span>
                                  {brand.krNum && (
                                    <p className="text-zinc-600 dark:text-zinc-300">번호: <span className="font-mono">{brand.krNum}</span></p>
                                  )}
                                  {brand.krUrl && (
                                    <a
                                      href={brand.krUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-block text-[10px] text-zinc-500 hover:text-zinc-900 underline underline-offset-2 font-semibold"
                                    >
                                      📄 증빙서류 보기
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-650 font-medium">미등록 / 해당없음</span>
                              )}
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase tracking-wider block">미국 USPTO 상표권</span>
                              {brand.hasUs ? (
                                <div className="space-y-1">
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-450">등록 완료</span>
                                  {brand.usNum && (
                                    <p className="text-zinc-600 dark:text-zinc-300">번호: <span className="font-mono">{brand.usNum}</span></p>
                                  )}
                                  {brand.usUrl && (
                                    <a
                                      href={brand.usUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-block text-[10px] text-zinc-500 hover:text-zinc-900 underline underline-offset-2 font-semibold"
                                    >
                                      📄 증빙서류 보기
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-650 font-medium">미등록 / 해당없음</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 py-6 text-center">등록된 브랜드 정보가 없습니다.</p>
                )}
              </div>
            )}

            {activeTab === "products" && (
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                      <thead>
                        <tr className="border-b border-zinc-100 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                          <th className="py-2">제품명</th>
                          <th className="py-2">브랜드</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850">
                        {products.map((product) => (
                          <tr key={product.id}>
                            <td className="py-3 font-semibold text-zinc-900 dark:text-white">{product.name}</td>
                            <td className="py-3 text-zinc-550 dark:text-zinc-400">
                              {brandNameById.get(product.brand_id) || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 py-6 text-center">등록된 제품 정보가 없습니다.</p>
                )}
              </div>
            )}

            {activeTab === "applications" && (
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {applications.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                      <thead>
                        <tr className="border-b border-zinc-100 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                          <th className="py-2">신청번호</th>
                          <th className="py-2">상태</th>
                          <th className="py-2">제출일</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850">
                        {applications.map((app) => (
                          <tr key={app.id}>
                            <td className="py-3 font-semibold text-zinc-900 dark:text-white">
                              <Link
                                href={`/admin/applications/${app.id}`}
                                className="text-emerald-600 hover:underline dark:text-emerald-450"
                              >
                                {app.application_number}
                              </Link>
                            </td>
                            <td className="py-3">
                              <span className="inline-block rounded bg-zinc-100 text-zinc-700 px-2 py-0.5 text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-350">
                                {app.status}
                              </span>
                            </td>
                            <td className="py-3 text-zinc-400">
                              {new Date(app.submitted_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 py-6 text-center">제출된 신청서 이력이 없습니다.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
