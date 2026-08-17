"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

export interface CompanyUserItem {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface CompanyRowItem {
  id: string;
  name: string;
  type: string;
  country: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactTitle: string;
  contactPosition: string;
  brandsCount: number;
  productsCount: number;
  appStatus: string;
  partnerStatus: string;
  accountOwner: string;
  lastContact: string;
  users?: CompanyUserItem[];
}

interface CompaniesTableClientProps {
  companies: CompanyRowItem[];
  partnerStatuses: { id: string; label: string; color: string }[];
}

export function CompaniesTableClient({ companies, partnerStatuses }: CompaniesTableClientProps) {
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Popover Open states
  const [openTypeFilter, setOpenTypeFilter] = useState(false);
  const [openCountryFilter, setOpenCountryFilter] = useState(false);
  const [openStatusFilter, setOpenStatusFilter] = useState(false);

  // Extract unique types, countries, and statuses for dropdown filters
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.type) set.add(c.type);
    });
    return Array.from(set).sort();
  }, [companies]);

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.country) set.add(c.country);
    });
    return Array.from(set).sort();
  }, [companies]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.partnerStatus) set.add(c.partnerStatus);
    });
    return Array.from(set).sort();
  }, [companies]);

  // Combined Search & Multi-Filter Logic
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // 1. Search Query (Partial Match across Company Name, Company Email, Contact Name, User Names, User Emails)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = company.name.toLowerCase().includes(q);
        const matchContactName = company.contactName.toLowerCase().includes(q);
        const matchContactEmail = company.contactEmail.toLowerCase().includes(q);
        const matchUsers = company.users?.some(
          (u) =>
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q))
        );

        if (!matchName && !matchContactName && !matchContactEmail && !matchUsers) {
          return false;
        }
      }

      // 2. Type Multi-Filter (OR within group)
      if (selectedTypes.length > 0 && !selectedTypes.includes(company.type)) {
        return false;
      }

      // 3. Country Multi-Filter (OR within group)
      if (selectedCountries.length > 0 && !selectedCountries.includes(company.country)) {
        return false;
      }

      // 4. Partner Status Multi-Filter (OR within group)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(company.partnerStatus)) {
        return false;
      }

      return true;
    });
  }, [companies, search, selectedTypes, selectedCountries, selectedStatuses]);

  const isFiltered =
    search.trim() !== "" ||
    selectedTypes.length > 0 ||
    selectedCountries.length > 0 ||
    selectedStatuses.length > 0;

  const handleReset = () => {
    setSearch("");
    setSelectedTypes([]);
    setSelectedCountries([]);
    setSelectedStatuses([]);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies, emails, contacts, users..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {/* Multi-Filter Dropdowns Group */}
          <div className="flex flex-wrap items-center gap-2 relative">
            {/* Type Multi-Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenTypeFilter(!openTypeFilter);
                  setOpenCountryFilter(false);
                  setOpenStatusFilter(false);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                  selectedTypes.length > 0
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-955 font-bold"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                }`}
              >
                <span>유형</span>
                {selectedTypes.length > 0 && (
                  <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[9px] font-extrabold">
                    {selectedTypes.length}
                  </span>
                )}
                <span className="text-[9px]">▼</span>
              </button>

              {openTypeFilter && (
                <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex justify-between items-center pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">회사 유형 선택</span>
                    {selectedTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTypes([])}
                        className="text-[10px] text-rose-500 hover:underline font-bold"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                    {uniqueTypes.map((t) => {
                      const isChecked = selectedTypes.includes(t);
                      return (
                        <label
                          key={t}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleType(t)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 dark:border-zinc-700"
                          />
                          <span>{t}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Country Multi-Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenCountryFilter(!openCountryFilter);
                  setOpenTypeFilter(false);
                  setOpenStatusFilter(false);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                  selectedCountries.length > 0
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-955 font-bold"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                }`}
              >
                <span>국가</span>
                {selectedCountries.length > 0 && (
                  <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[9px] font-extrabold">
                    {selectedCountries.length}
                  </span>
                )}
                <span className="text-[9px]">▼</span>
              </button>

              {openCountryFilter && (
                <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex justify-between items-center pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">국가 선택</span>
                    {selectedCountries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCountries([])}
                        className="text-[10px] text-rose-500 hover:underline font-bold"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                    {uniqueCountries.map((c) => {
                      const isChecked = selectedCountries.includes(c);
                      return (
                        <label
                          key={c}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCountry(c)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 dark:border-zinc-700"
                          />
                          <span>{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Status Multi-Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenStatusFilter(!openStatusFilter);
                  setOpenTypeFilter(false);
                  setOpenCountryFilter(false);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                  selectedStatuses.length > 0
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-955 font-bold"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                }`}
              >
                <span>파트너 상태</span>
                {selectedStatuses.length > 0 && (
                  <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[9px] font-extrabold">
                    {selectedStatuses.length}
                  </span>
                )}
                <span className="text-[9px]">▼</span>
              </button>

              {openStatusFilter && (
                <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex justify-between items-center pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">상태 선택</span>
                    {selectedStatuses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses([])}
                        className="text-[10px] text-rose-500 hover:underline font-bold"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                    {uniqueStatuses.map((s) => {
                      const isChecked = selectedStatuses.includes(s);
                      const statusConfig = partnerStatuses.find(
                        (p) => p.id.toLowerCase() === s.toLowerCase()
                      );
                      return (
                        <label
                          key={s}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStatus(s)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 dark:border-zinc-700"
                          />
                          <span>{statusConfig?.label || s}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Clear / Reset Filter Button */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                필터 초기화 (Reset)
              </button>
            )}
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex justify-between items-center text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
          <span>
            조회 결과: <strong className="text-zinc-900 dark:text-white font-bold">{filteredCompanies.length}</strong> / 전체 {companies.length}개 회사
          </span>
        </div>
      </div>

      {/* Companies Table Card */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3.5 font-semibold">회사명</th>
                <th className="px-6 py-3.5 font-semibold">유형</th>
                <th className="px-6 py-3.5 font-semibold">국가</th>
                <th className="px-6 py-3.5 font-semibold text-center">브랜드 수</th>
                <th className="px-6 py-3.5 font-semibold text-center">등록 제품 수</th>
                <th className="px-6 py-3.5 font-semibold">파트너 상태</th>
                <th className="px-6 py-3.5 font-semibold">주 컨택 담당자</th>
                <th className="px-6 py-3.5 font-semibold text-center">등록 인원</th>
                <th className="px-6 py-3.5 font-semibold">최근 연락</th>
                <th className="px-6 py-3.5 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredCompanies.map((company, index) => {
                const statusConfig = partnerStatuses.find(
                  (s) => s.id.toLowerCase() === company.partnerStatus.toLowerCase()
                ) || { label: company.partnerStatus, color: "zinc" };

                const statusClass =
                  statusConfig.color === "emerald"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                    : statusConfig.color === "amber"
                    ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                    : statusConfig.color === "rose"
                    ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                    : statusConfig.color === "blue"
                    ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                    : "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-850 dark:text-zinc-300 dark:border-zinc-700";

                const isTopRow = index < 3;
                const tooltipPositionClass = isTopRow ? "top-full mt-2.5" : "bottom-full mb-2.5";
                const tooltipArrowClass = isTopRow 
                  ? "absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-white dark:border-b-zinc-955 -mb-[1px]" 
                  : "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-zinc-955 -mt-[1px]";

                return (
                  <tr key={company.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-6 py-3.5 font-bold text-zinc-950 dark:text-white">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-300"
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300 font-medium">
                      {company.type}
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {company.country}
                    </td>
                    <td className="px-6 py-3.5 text-center text-zinc-900 dark:text-white font-semibold">
                      {company.brandsCount}
                    </td>
                    <td className="px-6 py-3.5 text-center text-zinc-900 dark:text-white font-semibold">
                      {company.productsCount}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${statusClass}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    
                    {/* Primary Contact with hover Tooltip */}
                    <td className="px-6 py-3.5">
                      <div className="relative group inline-block">
                        <span className="cursor-help font-semibold text-zinc-800 dark:text-zinc-200 border-b border-dashed border-zinc-300 hover:text-zinc-955 dark:hover:text-white">
                          {company.contactName}
                        </span>
                        
                        {company.contactName !== "담당자 정보 없음" && (
                          <div className={`absolute ${tooltipPositionClass} left-1/2 -translate-x-1/2 hidden group-hover:block w-56 p-3.5 rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 z-20 pointer-events-none transition-all`}>
                            <div className="space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                              <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5 mb-1.5 dark:border-zinc-800">
                                <span className="font-bold text-zinc-955 dark:text-white text-xs">{company.contactName}</span>
                                <span className="rounded bg-emerald-50 text-emerald-705 px-1.5 py-0.5 text-[8px] font-bold dark:bg-emerald-950/40 dark:text-emerald-300">주 컨택</span>
                              </div>
                              {company.contactTitle && <p><span className="font-bold text-zinc-405 block mb-0.5">직함</span>{company.contactTitle}</p>}
                              {company.contactPosition && <p><span className="font-bold text-zinc-405 block mb-0.5">부서 / 포지션</span>{company.contactPosition}</p>}
                              {company.contactPhone && <p><span className="font-bold text-zinc-405 block mb-0.5">연락처</span>{company.contactPhone}</p>}
                              {company.contactEmail && <p className="truncate"><span className="font-bold text-zinc-405 block mb-0.5">이메일</span>{company.contactEmail}</p>}
                            </div>
                            <div className={tooltipArrowClass} />
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Registered Users Count Column (Admin + Staff) */}
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white px-2.5 py-0.5 font-bold font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                        {company.users && company.users.length > 0
                          ? company.users.filter((u) => u.name || u.email).length
                          : (company.contactName && company.contactName !== "담당자 정보 없음" ? 1 : 0)}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-zinc-400">
                      {company.lastContact}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-zinc-900 dark:text-white">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500">
                    검색 조건과 일치하는 회사가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
