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
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  // Combined Search & Filter Logic
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

      // 2. Type Filter
      if (typeFilter !== "ALL" && company.type !== typeFilter) {
        return false;
      }

      // 3. Country Filter
      if (countryFilter !== "ALL" && company.country !== countryFilter) {
        return false;
      }

      // 4. Partner Status Filter
      if (statusFilter !== "ALL" && company.partnerStatus !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [companies, search, typeFilter, countryFilter, statusFilter]);

  const isFiltered = search.trim() !== "" || typeFilter !== "ALL" || countryFilter !== "ALL" || statusFilter !== "ALL";

  const handleReset = () => {
    setSearch("");
    setTypeFilter("ALL");
    setCountryFilter("ALL");
    setStatusFilter("ALL");
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

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="ALL">모든 유형 (All Types)</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Country Filter */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="ALL">모든 국가 (All Countries)</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="ALL">모든 상태 (All Statuses)</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Clear / Reset Filter Button */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
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
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500">
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
