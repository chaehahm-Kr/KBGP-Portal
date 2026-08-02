"use client";

import React, { useState, useTransition } from "react";
import { updateCompanyPortalMetadata } from "@/lib/company/portal-actions";
import { type CompanyContact, type CompanyParsedMetadata } from "@/lib/company/admin-actions";

interface CompanyProfileManagerProps {
  company: {
    id: string;
    name: string;
    business_registration_number: string;
    country: string;
    status: string;
    created_at: string;
  };
  parsedMeta: CompanyParsedMetadata;
  companyRole: string; // "company_admin" | "company_staff"
}

export function CompanyProfileManager({
  company,
  parsedMeta,
  companyRole,
}: CompanyProfileManagerProps) {
  const isCompanyAdmin = companyRole === "company_admin";
  const [isPending, startTransition] = useTransition();

  // Company editable states
  const [address, setAddress] = useState(parsedMeta.address);
  const [website, setWebsite] = useState(parsedMeta.website);
  
  // Contacts state
  const contacts = parsedMeta.contacts;

  // Edit modes
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  // Temp edit states
  const [tempAddress, setTempAddress] = useState(address);
  const [tempWebsite, setTempWebsite] = useState(website);

  // Form handlers
  const handleSaveMeta = async () => {
    startTransition(async () => {
      try {
        await updateCompanyPortalMetadata(company.id, {
          address: tempAddress,
          website: tempWebsite,
          contacts, // Keep contacts unchanged
        });
        setAddress(tempAddress);
        setWebsite(tempWebsite);
        setIsEditingMeta(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "회사 정보 저장 실패");
      }
    });
  };

  const getStatusBadgeClass = () => {
    if (parsedMeta.status === "Active") {
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    } else if (parsedMeta.status === "Pending") {
      return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    }
    return "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-350 dark:border-zinc-700";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">회사 정보 관리</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">
          귀사의 소속 법인 정보와 웹사이트, 그리고 소속 담당자들의 연락망을 확인하고 수정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-start">
        {/* Left Column: General & Legal Info */}
        <div className="md:col-span-1 space-y-6">
          {/* General Profile Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                회사 정보 설정
              </span>
              {isCompanyAdmin && (
                !isEditingMeta ? (
                  <button
                    onClick={() => {
                      setTempAddress(address);
                      setTempWebsite(website);
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
                )
              )}
            </div>

            <div className="space-y-4 text-xs">
              {/* Partner Status */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">파트너 상태</span>
                <span className={`mt-1 inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${getStatusBadgeClass()}`}>
                  {parsedMeta.status}
                </span>
              </div>

              {/* Company Type */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 유형</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{parsedMeta.type}</span>
              </div>

              {/* Country (ReadOnly) */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  설립 국가 <span title="어드민 전용 필드로 수정이 불가합니다.">🔒</span>
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.country}</span>
              </div>

              {/* Business Registration Number (ReadOnly) */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  사업자등록번호 <span title="어드민 전용 필드로 수정이 불가합니다.">🔒</span>
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.business_registration_number}</span>
              </div>

              {/* Official Corporate Name (ReadOnly) */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  공식 법인명 <span title="어드민 전용 필드로 수정이 불가합니다.">🔒</span>
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.name}</span>
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
          </div>
        </div>
      </div>

      {/* Right Column: Contacts List */}
      <div className="md:col-span-2 space-y-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">소속 담당자 목록 ({contacts.length})</h3>
          </div>

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
                          <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-650 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
                            직함: {contact.title}
                          </span>
                        )}
                        {contact.position && (
                          <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-650 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
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

            {isCompanyAdmin && (
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <a
                  href="/portal/company/users"
                  className="inline-block text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-450"
                >
                  담당자 초대, 수정 및 권한 관리는 [사용자 관리] 메뉴에서 진행할 수 있습니다. →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
