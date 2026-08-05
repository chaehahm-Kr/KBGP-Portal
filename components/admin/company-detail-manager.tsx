"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateCompanyAdminMetadata,
  adminInviteCompanyUser,
  adminUpdateCompanyUser,
  adminDeleteCompanyUser,
  type CompanyContact,
  type CompanyParsedMetadata
} from "@/lib/company/admin-actions";
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
  companyUsers: any[];
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
  companyUsers,
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
  
  // Editing modes
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  // Temporary edit states
  const [tempAddress, setTempAddress] = useState(address);
  const [tempWebsite, setTempWebsite] = useState(website);
  const [tempAdminMemo, setTempAdminMemo] = useState(adminMemo);
  const [tempType, setTempType] = useState(type);
  const [tempStatus, setTempStatus] = useState(status);

  // New States for Portal User Manager
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Add User Form States
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addPosition, setAddPosition] = useState("");
  const [addRole, setAddRole] = useState<"company_admin" | "company_staff">("company_staff");
  const [addIsPrimary, setAddIsPrimary] = useState(false);
  const [addPermissions, setAddPermissions] = useState({
    application: "none",
    brands: "none",
    products: "none",
    company_info: "none",
  });

  // Edit User Form States
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editRole, setEditRole] = useState<"company_admin" | "company_staff">("company_staff");
  const [editStatus, setEditStatus] = useState<"active" | "suspended" | "invited">("active");
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editPermissions, setEditPermissions] = useState({
    application: "none",
    brands: "none",
    products: "none",
    company_info: "none",
  });

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditName(user.name || "");
    setEditPhone(user.phone || "");
    setEditTitle(user.title || "");
    setEditPosition(user.position || "");
    setEditRole(user.company_role || "company_staff");
    setEditStatus(user.status || "active");
    setEditIsPrimary(user.is_primary || false);
    setEditPermissions(
      user.permissions || {
        application: "none",
        brands: "none",
        products: "none",
        company_info: "none",
      }
    );
    setIsEditUserOpen(true);
  };

  // Form submit handles
  const handleSaveMeta = async () => {
    startTransition(async () => {
      try {
        await updateCompanyAdminMetadata(company.id, {
          address: tempAddress,
          website: tempWebsite,
          adminMemo: tempAdminMemo,
          contacts: [], // Keep intro contacts array empty or unchanged since we drive from company_users now!
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

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) {
      alert("이름과 이메일은 필수 입력 사항입니다.");
      return;
    }
    startTransition(async () => {
      try {
        await adminInviteCompanyUser(company.id, {
          name: addName,
          email: addEmail,
          phone: addPhone,
          title: addTitle,
          position: addPosition,
          companyRole: addRole,
          isPrimary: addIsPrimary,
          permissions: addPermissions,
        });
        setIsAddUserOpen(false);
        // Reset states
        setAddName("");
        setAddEmail("");
        setAddPhone("");
        setAddTitle("");
        setAddPosition("");
        setAddRole("company_staff");
        setAddIsPrimary(false);
        setAddPermissions({
          application: "none",
          brands: "none",
          products: "none",
          company_info: "none",
        });
      } catch (err: any) {
        alert(err.message || "담당자 초대 실패");
      }
    });
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!editName.trim()) {
      alert("이름은 필수 입력 사항입니다.");
      return;
    }
    startTransition(async () => {
      try {
        await adminUpdateCompanyUser(company.id, selectedUser.id, {
          name: editName,
          phone: editPhone,
          title: editTitle,
          position: editPosition,
          companyRole: editRole,
          status: editStatus,
          isPrimary: editIsPrimary,
          permissions: editPermissions,
        });
        setIsEditUserOpen(false);
      } catch (err: any) {
        alert(err.message || "담당자 정보 수정 실패");
      }
    });
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`${selectedUser.name || selectedUser.email} 담당자를 삭제하시겠습니까?\n삭제 시 이 사용자는 더 이상 포털에 로그인할 수 없습니다.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await adminDeleteCompanyUser(company.id, selectedUser.id);
        setIsEditUserOpen(false);
      } catch (err: any) {
        alert(err.message || "담당자 삭제 실패");
      }
    });
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
              <h3 className="text-xs font-bold text-zinc-950 dark:text-white">담당자 및 포털 사용자 ({companyUsers.length})</h3>
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="rounded bg-zinc-900 px-2 py-1 text-[10px] font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                + 신규 담당자 초대
              </button>
            </div>

            <div className="space-y-4">
              {companyUsers.length > 0 ? (
                companyUsers.map((user, index) => (
                  <div key={user.id} className={`text-xs space-y-2 ${index > 0 ? "pt-4 border-t border-zinc-150 dark:border-zinc-800/80" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="font-bold text-zinc-900 dark:text-white text-[13px] flex flex-wrap items-center gap-1.5">
                          {user.name || "이름 없음"}
                          {user.is_primary && (
                            <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                              주 컨택
                            </span>
                          )}
                          <span className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : user.status === "suspended"
                              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                              : "bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-350"
                          }`}>
                            {user.status === "active" ? "정상 이용" : user.status === "suspended" ? "이용 정지" : "초대 대기"}
                          </span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded bg-zinc-100 border border-zinc-150 text-zinc-600 px-1 py-0.2 text-[8px] font-bold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
                            {user.company_role === "company_admin" ? "관리자 (Admin)" : "담당자 (Staff)"}
                          </span>
                          {user.title && (
                            <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-500 px-1 py-0.2 text-[8px] font-semibold dark:bg-zinc-850 dark:border-zinc-750">
                              직함: {user.title}
                            </span>
                          )}
                          {user.position && (
                            <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-500 px-1 py-0.2 text-[8px] font-semibold dark:bg-zinc-850 dark:border-zinc-750">
                              부서: {user.position}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="text-xs font-semibold text-indigo-650 hover:underline dark:text-indigo-400"
                      >
                        수정
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-0.5 text-[11px] text-zinc-550 dark:text-zinc-450 font-mono">
                      {user.phone && <p>📞 {user.phone}</p>}
                      <p>✉️ {user.email}</p>
                    </div>
                    {/* Permissions summary */}
                    {user.permissions && (
                      <div className="mt-1 flex flex-wrap gap-1 items-center bg-zinc-50/50 p-1.5 rounded border border-zinc-100 dark:bg-zinc-950/20 dark:border-zinc-850">
                        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mr-1">권한:</span>
                        <span className="text-[9px] text-zinc-600 dark:text-zinc-350">신청서({
                          user.permissions.application === "read_write" ? "쓰기" : user.permissions.application === "read_only" ? "읽기" : "없음"
                        })</span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-[9px] text-zinc-600 dark:text-zinc-350">브랜드({
                          user.permissions.brands === "read_write" ? "쓰기" : user.permissions.brands === "read_only" ? "읽기" : "없음"
                        })</span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-[9px] text-zinc-600 dark:text-zinc-350">제품({
                          user.permissions.products === "read_write" ? "쓰기" : user.permissions.products === "read_only" ? "읽기" : "없음"
                        })</span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-[9px] text-zinc-600 dark:text-zinc-350">회사정보({
                          user.permissions.company_info === "read_write" ? "쓰기" : user.permissions.company_info === "read_only" ? "읽기" : "없음"
                        })</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 py-3 text-center">등록된 담당자가 없습니다.</p>
              )}
            </div>
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
                      <div id={`brand-${brand.id}`} key={brand.id} className={`flex flex-col md:flex-row gap-4 scroll-mt-20 ${idx > 0 ? "pt-4" : ""}`}>
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
                            <td className="py-3 font-semibold text-zinc-900 dark:text-white">
                              <Link
                                href={`/admin/products/${product.id}`}
                                className="text-emerald-600 hover:underline dark:text-emerald-450 font-bold"
                              >
                                {product.name}
                              </Link>
                            </td>
                            <td className="py-3 text-zinc-550 dark:text-zinc-400">
                              <button
                                onClick={() => {
                                  setActiveTab("brands");
                                  setTimeout(() => {
                                    document.getElementById(`brand-${product.brand_id}`)?.scrollIntoView({ behavior: "smooth" });
                                  }, 100);
                                }}
                                className="text-emerald-600 hover:underline dark:text-emerald-450 font-bold text-left cursor-pointer"
                              >
                                {brandNameById.get(product.brand_id) || "-"}
                              </button>
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

      {/* Invite User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-955 dark:text-white mb-4">신규 담당자 초대</h3>
            <form onSubmit={handleAddUserSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이름</label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이메일 계정</label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">연락처</label>
                  <input
                    type="text"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">회사 내 역할 (Role)</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="company_staff">담당자 (Staff)</option>
                    <option value="company_admin">관리자 (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">부서 (Position)</label>
                  <input
                    type="text"
                    value={addPosition}
                    onChange={(e) => setAddPosition(e.target.value)}
                    placeholder="예: 마케팅부"
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">직함 (Title)</label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="예: 과장"
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="add-primary"
                  checked={addIsPrimary}
                  onChange={(e) => setAddIsPrimary(e.target.checked)}
                  className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="add-primary" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  대표 담당자(주 컨택 직원)로 설정
                </label>
              </div>

              {/* Permissions matrix */}
              <div className="rounded-lg border border-zinc-150 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 space-y-3">
                <h4 className="font-bold text-[11px] text-zinc-450 dark:text-zinc-550 uppercase tracking-wider">메뉴별 상세 권한 설정</h4>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">입점 신청서</span>
                    <select
                      value={addPermissions.application}
                      onChange={(e) => setAddPermissions({ ...addPermissions, application: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">브랜드 관리</span>
                    <select
                      value={addPermissions.brands}
                      onChange={(e) => setAddPermissions({ ...addPermissions, brands: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">제품 관리</span>
                    <select
                      value={addPermissions.products}
                      onChange={(e) => setAddPermissions({ ...addPermissions, products: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">회사 정보</span>
                    <select
                      value={addPermissions.company_info}
                      onChange={(e) => setAddPermissions({ ...addPermissions, company_info: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="rounded border border-zinc-200 px-4 py-2 font-bold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-950"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-950 px-4 py-2 font-bold text-white hover:bg-zinc-850 disabled:opacity-50 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100"
                >
                  {isPending ? "초대중..." : "초대 발송"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditUserOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-zinc-955 dark:text-white">담당자 상세 설정</h3>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isPending}
                className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
              >
                이 담당자 삭제
              </button>
            </div>
            <form onSubmit={handleUpdateUserSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이름</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이메일 계정 (수정 불가)</label>
                  <input
                    type="text"
                    disabled
                    value={selectedUser.email}
                    className="w-full rounded border border-zinc-150 p-2 outline-none bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-950/50 text-zinc-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">연락처</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">회사 내 역할 (Role)</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="company_staff">담당자 (Staff)</option>
                    <option value="company_admin">관리자 (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">부서 (Position)</label>
                  <input
                    type="text"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">직함 (Title)</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이용 상태 (Status)</label>
                  <select
                    value={editStatus}
                    disabled={selectedUser.status === "invited"}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white disabled:bg-zinc-50/50 disabled:text-zinc-400"
                  >
                    <option value="active">정상 이용 (Active)</option>
                    <option value="suspended">이용 정지 (Suspended)</option>
                    <option value="invited">초대 대기중 (Invited)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-primary"
                      checked={editIsPrimary}
                      onChange={(e) => setEditIsPrimary(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="edit-primary" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      대표 담당자(주 컨택 직원)로 설정
                    </label>
                  </div>
                </div>
              </div>

              {/* Permissions matrix */}
              <div className="rounded-lg border border-zinc-150 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 space-y-3">
                <h4 className="font-bold text-[11px] text-zinc-450 dark:text-zinc-550 uppercase tracking-wider">메뉴별 상세 권한 설정</h4>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">입점 신청서</span>
                    <select
                      value={editPermissions.application}
                      onChange={(e) => setEditPermissions({ ...editPermissions, application: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">브랜드 관리</span>
                    <select
                      value={editPermissions.brands}
                      onChange={(e) => setEditPermissions({ ...editPermissions, brands: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">제품 관리</span>
                    <select
                      value={editPermissions.products}
                      onChange={(e) => setEditPermissions({ ...editPermissions, products: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">회사 정보</span>
                    <select
                      value={editPermissions.company_info}
                      onChange={(e) => setEditPermissions({ ...editPermissions, company_info: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditUserOpen(false)}
                  className="rounded border border-zinc-200 px-4 py-2 font-bold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-950"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-950 px-4 py-2 font-bold text-white hover:bg-zinc-850 disabled:opacity-50 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100"
                >
                  {isPending ? "저장중..." : "변경 사항 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
