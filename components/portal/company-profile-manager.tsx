"use client";

import React, { useState, useTransition } from "react";
import { updateCompanyPortalMetadata, portalUploadCompanyLogo, portalUpdateSupplierProfile, portalUpdateSupplierRemittance } from "@/lib/company/portal-actions";
import { type CompanyContact, type CompanyParsedMetadata } from "@/lib/company/admin-actions";
import { assignTaskPrimaryUser, type TaskAssignmentItem, toggleTaskEmailNotification } from "@/lib/company/task-actions";

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
  companyRole: string; 
  taskAssignments: TaskAssignmentItem[];
  companyUsers: any[];
  initialSupplierProfile: any;
  initialSupplierRemittance: any;
  warehouses: any[];
}

export function CompanyProfileManager({
  company,
  parsedMeta,
  companyRole,
  taskAssignments,
  companyUsers,
  initialSupplierProfile,
  initialSupplierRemittance,
  warehouses,
}: CompanyProfileManagerProps) {
  const isCompanyAdmin = companyRole === "company_admin";
  const [isPending, startTransition] = useTransition();

  const [address, setAddress] = useState(parsedMeta.address);
  const [address1, setAddress1] = useState(parsedMeta.address_1 || "");
  const [address2, setAddress2] = useState(parsedMeta.address_2 || "");
  const [city, setCity] = useState(parsedMeta.city || "");
  const [stateProv, setStateProv] = useState(parsedMeta.state || "");
  const [zipCode, setZipCode] = useState(parsedMeta.zip_code || "");

  const [website, setWebsite] = useState(parsedMeta.website);
  const contacts = parsedMeta.contacts;
  const [logoUrl, setLogoUrl] = useState(parsedMeta.logoUrl || null);
  const [tempLogoFile, setTempLogoFile] = useState<File | null>(null);

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [tempAddress1, setTempAddress1] = useState(address1);
  const [tempAddress2, setTempAddress2] = useState(address2);
  const [tempCity, setTempCity] = useState(city);
  const [tempStateProv, setTempStateProv] = useState(stateProv);

  // Supplier Profile state
  const [supplierProfile, setSupplierProfile] = useState(initialSupplierProfile);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  
  const [supStatus, setSupStatus] = useState(initialSupplierProfile?.status || "active");
  const [supCurrency, setSupCurrency] = useState(initialSupplierProfile?.default_currency || "");
  const [supPaymentTerms, setSupPaymentTerms] = useState(initialSupplierProfile?.default_payment_terms || "");
  const [supPaymentTermsCustom, setSupPaymentTermsCustom] = useState(initialSupplierProfile?.default_payment_terms_custom || "");
  const [supIncoterms, setSupIncoterms] = useState(initialSupplierProfile?.default_incoterms || "");
  const [supShipFromWarehouseId, setSupShipFromWarehouseId] = useState(initialSupplierProfile?.default_ship_from_warehouse_id || "");
  const [supPortOfLoading, setSupPortOfLoading] = useState(initialSupplierProfile?.default_port_of_loading || "");
  const [supLeadTime, setSupLeadTime] = useState(initialSupplierProfile?.default_production_lead_time || "");
  const [supMOQ, setSupMOQ] = useState(
    initialSupplierProfile?.default_moq !== null && initialSupplierProfile?.default_moq !== undefined 
      ? String(initialSupplierProfile.default_moq) 
      : ""
  );
  const [supReceivingEmail, setSupReceivingEmail] = useState(initialSupplierProfile?.po_receiving_email || "");
  const [supShippingResponsibility, setSupShippingResponsibility] = useState(initialSupplierProfile?.default_shipping_responsibility || "LETUSTO_ARRANGED");

  // Supplier Remittance state
  const [supplierRemittance, setSupplierRemittance] = useState(initialSupplierRemittance);
  const [isEditingRemittance, setIsEditingRemittance] = useState(false);

  const [remMethod, setRemMethod] = useState(initialSupplierRemittance?.payment_method || "Wire Transfer");
  const [remReceivingCurrency, setRemReceivingCurrency] = useState(initialSupplierRemittance?.account_currency || "USD");
  const [remBeneficiaryName, setRemBeneficiaryName] = useState(initialSupplierRemittance?.beneficiary_name || "");
  const [remBeneficiaryAddress, setRemBeneficiaryAddress] = useState(initialSupplierRemittance?.beneficiary_address || "");
  const [remBankName, setRemBankName] = useState(initialSupplierRemittance?.bank_name || "");
  const [remBankCountry, setRemBankCountry] = useState(initialSupplierRemittance?.bank_country || "");
  const [remBankAddress, setRemBankAddress] = useState(initialSupplierRemittance?.bank_address || "");
  const [remAccountNumber, setRemAccountNumber] = useState(initialSupplierRemittance?.account_number || "");
  const [remSwiftBic, setRemSwiftBic] = useState(initialSupplierRemittance?.swift_bic || "");
  const [remRoutingNumber, setRemRoutingNumber] = useState(initialSupplierRemittance?.routing_number || "");
  const [remIntermediaryBank, setRemIntermediaryBank] = useState(initialSupplierRemittance?.intermediary_bank_info || "");
  const [remNote, setRemNote] = useState(initialSupplierRemittance?.remittance_note || "");
  const [tempZipCode, setTempZipCode] = useState(zipCode);
  const [tempWebsite, setTempWebsite] = useState(website);

  // [신규 기능]: 담당 업무 상태 로컬 관리
  const [tasks, setTasks] = useState<TaskAssignmentItem[]>(taskAssignments);

  // [신규 기능]: 인쇄할 이메일 알림 수신자 목록 헬퍼 (로컬 수집 보강)
  const getEmailRecipientsForTask = (taskCode: string) => {
    return companyUsers
      .filter(u => u.status === "active" && u.task_assignments?.some((a: any) => a.task_code === taskCode && a.email_notify))
      .map(u => u.name || "(이름 없음)")
      .join(", ") || "없음";
  };

  // [신규 기능]: 알림 수신인 인라인 토글
  const handleToggleEmailNotification = async (taskCode: string, userId: string, checked: boolean) => {
    startTransition(async () => {
      try {
        await toggleTaskEmailNotification(company.id, taskCode, userId, checked, "portal");
        // 로컬 상태 동기화 갱신
        const matchedUser = companyUsers.find(u => u.id === userId);
        if (matchedUser) {
          if (!matchedUser.task_assignments) {
            matchedUser.task_assignments = [];
          }
          const taskAssign = matchedUser.task_assignments.find((a: any) => a.task_code === taskCode);
          if (taskAssign) {
            taskAssign.email_notify = checked;
          } else {
            matchedUser.task_assignments.push({ task_code: taskCode, is_primary: false, email_notify: checked });
          }
        }
        // 강제로 컴포넌트 리렌더링 유도를 위해 tasks 상태 업데이트
        setTasks(prev => [...prev]);
      } catch (err) {
        alert(err instanceof Error ? err.message : "알림 설정 수정 실패");
      }
    });
  };

  // [신규 기능]: 주 담당자 직접 변경 핸들러
  const handleAssignPrimaryUser = async (taskCode: string, targetUserId: string | null) => {
    const targetUser = companyUsers.find(u => u.id === targetUserId);
    const currentPrimary = tasks.find(t => t.taskCode === taskCode);

    if (targetUserId && currentPrimary?.userId && currentPrimary.userId !== targetUserId) {
      const confirmChange = confirm(
        `현재 이 업무에는 다른 주 담당자(${currentPrimary.userName || "미지정"})가 지정되어 있습니다. 주 담당자를 변경하시겠습니까?`
      );
      if (!confirmChange) return;
    }

    startTransition(async () => {
      try {
        await assignTaskPrimaryUser(company.id, taskCode, targetUserId, "portal");

        // 로컬 상태 동기화 갱신
        setTasks(prev => 
          prev.map(t => {
            if (t.taskCode === taskCode) {
              return {
                ...t,
                userId: targetUserId,
                isPrimary: !!targetUserId,
                userName: targetUser?.name || null,
                userTitle: targetUser?.title || null,
                userPosition: targetUser?.position || null,
                userEmail: targetUser?.email || null,
                userPhone: targetUser?.phone || null,
              };
            }
            return t;
          })
        );

        // companyUsers 측에서도 주담당자 정보(is_primary) 업데이트 처리
        companyUsers.forEach(u => {
          if (!u.task_assignments) u.task_assignments = [];
          const taskAssign = u.task_assignments.find((a: any) => a.task_code === taskCode);
          if (u.id === targetUserId) {
            if (taskAssign) {
              taskAssign.is_primary = true;
              taskAssign.email_notify = true; // 주담당자는 이메일 알림 기본 활성화
            } else {
              u.task_assignments.push({ task_code: taskCode, is_primary: true, email_notify: true });
            }
          } else {
            if (taskAssign) {
              taskAssign.is_primary = false;
            }
          }
        });

        alert("담당자 배정이 완료되었습니다.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "담당자 배정에 실패했습니다.");
      }
    });
  };

  const handleSaveMeta = async () => {
    if (!tempAddress1.trim() || !tempCity.trim() || !tempStateProv.trim() || !tempZipCode.trim()) {
      alert("회사 주소 중 기본 주소, 시, 도, 우편번호는 필수 기입 항목입니다.");
      return;
    }

    startTransition(async () => {
      try {
        if (tempLogoFile) {
          const formData = new FormData();
          formData.append("logo", tempLogoFile);
          await portalUploadCompanyLogo(company.id, formData);
        }

        const fullAddress = `${tempAddress1.trim()}${tempAddress2.trim() ? " " + tempAddress2.trim() : ""}${tempCity.trim() ? ", " + tempCity.trim() : ""}${tempStateProv.trim() ? ", " + tempStateProv.trim() : ""}${tempZipCode.trim() ? " (" + tempZipCode.trim() + ")" : ""}`;

        await updateCompanyPortalMetadata(company.id, {
          address: fullAddress,
          address_1: tempAddress1.trim(),
          address_2: tempAddress2.trim(),
          city: tempCity.trim(),
          state: tempStateProv.trim(),
          zip_code: tempZipCode.trim(),
          website: tempWebsite,
          contacts, 
        });
        setAddress1(tempAddress1.trim());
        setAddress2(tempAddress2.trim());
        setCity(tempCity.trim());
        setStateProv(tempStateProv.trim());
        setZipCode(tempZipCode.trim());
        setAddress(fullAddress);
        setWebsite(tempWebsite);
        setTempLogoFile(null);
        setIsEditingMeta(false);
        alert("회사 정보가 성공적으로 저장되었습니다. 로고 이미지 반영을 위해 화면이 리로드됩니다.");
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "회사 정보 저장 실패");
      }
    });
  };

  const handleSaveSupplierProfile = async () => {
    startTransition(async () => {
      try {
        const profilePayload = {
          status: supStatus,
          default_currency: supCurrency,
          default_payment_terms: supPaymentTerms,
          default_payment_terms_custom: supPaymentTerms === "Custom" ? supPaymentTermsCustom : "",
          default_incoterms: supIncoterms,
          default_ship_from_warehouse_id: supShipFromWarehouseId || null,
          default_port_of_loading: supPortOfLoading,
          default_production_lead_time: supLeadTime,
          default_moq: supMOQ.trim() ? parseInt(supMOQ) : null,
          po_receiving_email: supReceivingEmail,
          default_shipping_responsibility: supShippingResponsibility,
        };

        await portalUpdateSupplierProfile(company.id, profilePayload);
        setSupplierProfile(profilePayload);
        setIsEditingSupplier(false);
        alert("거래 정보가 성공적으로 저장되었습니다.");
      } catch (err: any) {
        alert(err.message || "거래 정보 저장 중 오류가 발생했습니다.");
      }
    });
  };

  const handleSaveSupplierRemittance = async () => {
    startTransition(async () => {
      try {
        const remittancePayload = {
          payment_method: remMethod,
          account_currency: remReceivingCurrency,
          beneficiary_name: remBeneficiaryName,
          beneficiary_address: remBeneficiaryAddress,
          bank_name: remBankName,
          bank_country: remBankCountry,
          bank_address: remBankAddress,
          account_number: remAccountNumber,
          swift_bic: remSwiftBic,
          routing_number: remRoutingNumber,
          intermediary_bank_info: remIntermediaryBank,
          remittance_note: remNote,
        };

        await portalUpdateSupplierRemittance(company.id, remittancePayload);
        setSupplierRemittance(remittancePayload);
        setIsEditingRemittance(false);
        alert("계좌 정보가 성공적으로 저장되었습니다.");
      } catch (err: any) {
        alert(err.message || "계좌 정보 저장 중 오류가 발생했습니다.");
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

  // 활성 상태의 소속 사용자만 선택 가능
  const activeMembers = companyUsers.filter(u => u.status === "active");

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
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                회사 정보 설정
              </span>
              {isCompanyAdmin && (
                !isEditingMeta ? (
                  <button
                    onClick={() => {
                      setTempAddress1(address1);
                      setTempAddress2(address2);
                      setTempCity(city);
                      setTempStateProv(stateProv);
                      setTempZipCode(zipCode);
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
              <div className="flex flex-col items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-150 dark:border-zinc-850">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="h-16 w-16 rounded object-cover border border-zinc-200 dark:border-zinc-800"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-850 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-sans">
                    LOGO
                  </div>
                )}
                {isEditingMeta && (
                  <div className="w-full mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setTempLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-[10px] text-zinc-555 dark:text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-200 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-300 dark:hover:file:bg-zinc-750 cursor-pointer"
                    />
                    {tempLogoFile && (
                      <p className="text-[9px] text-emerald-600 font-semibold mt-1">✓ 파일 대기 중: {tempLogoFile.name}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">파트너 상태</span>
                <span className={`mt-1 inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${getStatusBadgeClass()}`}>
                  {parsedMeta.status}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 유형</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{parsedMeta.type}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  설립 국가 🔒
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.country}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  사업자등록번호 🔒
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.business_registration_number}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  공식 법인명 🔒
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.name}</span>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 주소</span>
                {isEditingMeta ? (
                  <div className="space-y-2 mt-1">
                    <div>
                      <span className="text-[9px] text-zinc-400 block font-semibold">기본 주소 (필수)</span>
                      <input
                        type="text"
                        value={tempAddress1}
                        onChange={(e) => setTempAddress1(e.target.value)}
                        placeholder="기본 주소를 입력하세요"
                        required
                        className="mt-0.5 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block font-semibold">상세 주소 (선택)</span>
                      <input
                        type="text"
                        value={tempAddress2}
                        onChange={(e) => setTempAddress2(e.target.value)}
                        placeholder="상세 주소를 입력하세요"
                        className="mt-0.5 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[9px] text-zinc-400 block font-semibold">시 (City, 필수)</span>
                        <input
                          type="text"
                          value={tempCity}
                          onChange={(e) => setTempCity(e.target.value)}
                          placeholder="예: 서울특별시 / New York"
                          required
                          className="mt-0.5 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 block font-semibold">도 (State/Province, 필수)</span>
                        <input
                          type="text"
                          value={tempStateProv}
                          onChange={(e) => setTempStateProv(e.target.value)}
                          placeholder="예: 경기도 / NY"
                          required
                          className="mt-0.5 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block font-semibold">우편번호 (Zip Code, 필수)</span>
                      <input
                        type="text"
                        value={tempZipCode}
                        onChange={(e) => setTempZipCode(e.target.value)}
                        placeholder="우편번호 입력"
                        required
                        className="mt-0.5 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 block whitespace-pre-wrap leading-relaxed">
                    {address || "주소 미등록"}
                  </span>
                )}
              </div>

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

        {/* Right Column: Contacts & Task Assignments */}
        <div className="md:col-span-2 space-y-6">
          {/* 거래 정보 (Supplier / Trading Info) Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">거래 정보 (Supplier / Trading Info)</h3>
              {isCompanyAdmin && (
                !isEditingSupplier ? (
                  <button
                    onClick={() => {
                      setSupStatus(supplierProfile?.status || "active");
                      setSupCurrency(supplierProfile?.default_currency || "");
                      setSupPaymentTerms(supplierProfile?.default_payment_terms || "");
                      setSupPaymentTermsCustom(supplierProfile?.default_payment_terms_custom || "");
                      setSupIncoterms(supplierProfile?.default_incoterms || "");
                      setSupShipFromWarehouseId(supplierProfile?.default_ship_from_warehouse_id || "");
                      setSupPortOfLoading(supplierProfile?.default_port_of_loading || "");
                      setSupLeadTime(supplierProfile?.default_production_lead_time || "");
                      setSupMOQ(supplierProfile?.default_moq !== null && supplierProfile?.default_moq !== undefined ? String(supplierProfile.default_moq) : "");
                      setSupReceivingEmail(supplierProfile?.po_receiving_email || "");
                      setSupShippingResponsibility(supplierProfile?.default_shipping_responsibility || "LETUSTO_ARRANGED");
                      setIsEditingSupplier(true);
                    }}
                    className="text-xs font-semibold text-zinc-550 hover:underline dark:text-zinc-400"
                  >
                    수정
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveSupplierProfile}
                      disabled={isPending}
                      className="text-xs font-bold text-emerald-650 hover:underline disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setIsEditingSupplier(false)}
                      className="text-xs font-semibold text-zinc-400 hover:underline"
                    >
                      취소
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">거래 상태 (Trading Status)</span>
                {isEditingSupplier ? (
                  <select
                    value={supStatus}
                    onChange={(e) => setSupStatus(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                ) : (
                  <span className={`mt-1 inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${
                    (supplierProfile?.status || 'active') === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' 
                      : 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                  }`}>
                    {(supplierProfile?.status || 'active').toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">기본 결제 통화 (Default Currency)</span>
                {isEditingSupplier ? (
                  <select
                    value={supCurrency}
                    onChange={(e) => setSupCurrency(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="">미지정 (Not Set)</option>
                    <option value="USD">USD ($)</option>
                    <option value="KRW">KRW (₩)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierProfile?.default_currency || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">기본 결제 조건 (Default Payment Terms)</span>
                {isEditingSupplier ? (
                  <div className="space-y-1.5 mt-1">
                    <select
                      value={supPaymentTerms}
                      onChange={(e) => setSupPaymentTerms(e.target.value)}
                      className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="">미지정 (Not Set)</option>
                      <option value="Prepaid 100%">Prepaid 100%</option>
                      <option value="30% Deposit / 70% Balance">30% Deposit / 70% Balance</option>
                      <option value="50% Deposit / 50% Balance">50% Deposit / 50% Balance</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                      <option value="Custom">Custom (직접 입력)</option>
                    </select>
                    {supPaymentTerms === "Custom" && (
                      <input
                        type="text"
                        placeholder="결제 조건을 직접 입력하세요..."
                        value={supPaymentTermsCustom}
                        onChange={(e) => setSupPaymentTermsCustom(e.target.value)}
                        className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    )}
                  </div>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">
                    {supplierProfile?.default_payment_terms === "Custom"
                      ? `Custom: ${supplierProfile?.default_payment_terms_custom || ""}`
                      : supplierProfile?.default_payment_terms || "미지정"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">인코텀즈 조건 (Default Incoterms)</span>
                {isEditingSupplier ? (
                  <select
                    value={supIncoterms}
                    onChange={(e) => setSupIncoterms(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="">미지정 (Not Set)</option>
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="CIF">CIF</option>
                    <option value="DDP">DDP</option>
                    <option value="DAP">DAP</option>
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierProfile?.default_incoterms || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">기본 출고지 주소 (Ship-from Address)</span>
                {isEditingSupplier ? (
                  <select
                    value={supShipFromWarehouseId}
                    onChange={(e) => setSupShipFromWarehouseId(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="">미지정 (Not Set)</option>
                    {warehouses.map((wh: any) => (
                      <option key={wh.id} value={wh.id}>
                        [{wh.code}] {wh.name} ({wh.address1})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">
                    {(() => {
                      const selectedWh = warehouses.find(w => w.id === supplierProfile?.default_ship_from_warehouse_id);
                      return selectedWh 
                        ? `[${selectedWh.code}] ${selectedWh.name} (${selectedWh.address1})`
                        : "미지정 (Not Set)";
                    })()}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">선적항 (Port of Loading)</span>
                {isEditingSupplier ? (
                  <input
                    type="text"
                    value={supPortOfLoading}
                    onChange={(e) => setSupPortOfLoading(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="예: Busan, Incheon..."
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierProfile?.default_port_of_loading || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">평균 리드타임 (Lead Time)</span>
                {isEditingSupplier ? (
                  <input
                    type="text"
                    value={supLeadTime}
                    onChange={(e) => setSupLeadTime(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="예: 30 days, 6 weeks..."
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierProfile?.default_production_lead_time || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">기본 MOQ</span>
                {isEditingSupplier ? (
                  <input
                    type="number"
                    value={supMOQ}
                    onChange={(e) => setSupMOQ(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="최소 구매 수량"
                    min="0"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">
                    {supplierProfile?.default_moq !== null && supplierProfile?.default_moq !== undefined 
                      ? `${supplierProfile.default_moq.toLocaleString()} pcs` 
                      : "제한 없음"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">PO 수신 공식 이메일</span>
                {isEditingSupplier ? (
                  <input
                    type="email"
                    value={supReceivingEmail}
                    onChange={(e) => setSupReceivingEmail(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="orders@company.com"
                  />
                ) : (
                  <span className="font-semibold text-zinc-750 dark:text-zinc-300 mt-1 block font-mono">{supplierProfile?.po_receiving_email || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">기본 운송 책임 (Shipping Responsibility)</span>
                {isEditingSupplier ? (
                  <select
                    value={supShippingResponsibility}
                    onChange={(e) => setSupShippingResponsibility(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="LETUSTO_ARRANGED">LETUSTO_ARRANGED (Letusto 수배)</option>
                    <option value="SUPPLIER_ARRANGED">SUPPLIER_ARRANGED (공급처 수배)</option>
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">
                    {supplierProfile?.default_shipping_responsibility === 'SUPPLIER_ARRANGED' 
                      ? 'SUPPLIER_ARRANGED (공급처 수배)' 
                      : 'LETUSTO_ARRANGED (Letusto 수배)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Payment & Remittance Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">송금 계좌 정보 (Payment & Remittance)</h3>
              {isCompanyAdmin && (
                !isEditingRemittance ? (
                  <button
                    onClick={() => {
                      setRemMethod(supplierRemittance?.payment_method || "Wire Transfer");
                      setRemReceivingCurrency(supplierRemittance?.account_currency || "USD");
                      setRemBeneficiaryName(supplierRemittance?.beneficiary_name || "");
                      setRemBeneficiaryAddress(supplierRemittance?.beneficiary_address || "");
                      setRemBankName(supplierRemittance?.bank_name || "");
                      setRemBankCountry(supplierRemittance?.bank_country || "");
                      setRemBankAddress(supplierRemittance?.bank_address || "");
                      setRemAccountNumber(supplierRemittance?.account_number || "");
                      setRemSwiftBic(supplierRemittance?.swift_bic || "");
                      setRemRoutingNumber(supplierRemittance?.routing_number || "");
                      setRemIntermediaryBank(supplierRemittance?.intermediary_bank_info || "");
                      setRemNote(supplierRemittance?.remittance_note || "");
                      setIsEditingRemittance(true);
                    }}
                    className="text-xs font-semibold text-zinc-550 hover:underline dark:text-zinc-400"
                  >
                    수정
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveSupplierRemittance}
                      disabled={isPending}
                      className="text-xs font-bold text-emerald-650 hover:underline disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setIsEditingRemittance(false)}
                      className="text-xs font-semibold text-zinc-400 hover:underline"
                    >
                      취소
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">지불 방법 (Payment Method)</span>
                {isEditingRemittance ? (
                  <select
                    value={remMethod}
                    onChange={(e) => setRemMethod(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="Wire Transfer">Wire Transfer (T/T)</option>
                    <option value="L/C">Letter of Credit (L/C)</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.payment_method || "Wire Transfer"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">수취 계좌 통화 (Receiving Currency)</span>
                {isEditingRemittance ? (
                  <select
                    value={remReceivingCurrency}
                    onChange={(e) => setRemReceivingCurrency(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KRW">KRW (₩)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="CNY">CNY (¥)</option>
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.account_currency || "USD"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">예금주명 (Beneficiary Name)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remBeneficiaryName}
                    onChange={(e) => setRemBeneficiaryName(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="수취인 실명"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.beneficiary_name || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">수취인 주소 (Beneficiary Address)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remBeneficiaryAddress}
                    onChange={(e) => setRemBeneficiaryAddress(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="송금 수취인 영문 주소"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.beneficiary_address || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">은행명 (Bank Name)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remBankName}
                    onChange={(e) => setRemBankName(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="수취 은행명"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.bank_name || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">은행 국가 (Bank Country)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remBankCountry}
                    onChange={(e) => setRemBankCountry(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="예: South Korea, USA..."
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.bank_country || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">은행 주소 (Bank Address)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remBankAddress}
                    onChange={(e) => setRemBankAddress(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="수취 은행 지점 영문 주소"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.bank_address || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">계좌 번호 (Account Number)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remAccountNumber}
                    onChange={(e) => setRemAccountNumber(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="계좌 번호 입력"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block font-mono">
                    {supplierRemittance?.account_number || "미지정"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">SWIFT / BIC</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remSwiftBic}
                    onChange={(e) => setRemSwiftBic(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    placeholder="8자 또는 11자 코드"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block font-mono">{supplierRemittance?.swift_bic || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Routing Number / ABA / Transit</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remRoutingNumber}
                    onChange={(e) => setRemRoutingNumber(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    placeholder="미국 송금 시 필수 (9자리)"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block font-mono">{supplierRemittance?.routing_number || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">중개 은행 정보 (Intermediary Bank Info)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remIntermediaryBank}
                    onChange={(e) => setRemIntermediaryBank(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="중개 은행 필요 시 정보 입력"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.intermediary_bank_info || "미지정"}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">송금 참고사항 (Remittance Note)</span>
                {isEditingRemittance ? (
                  <input
                    type="text"
                    value={remNote}
                    onChange={(e) => setRemNote(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    placeholder="기타 참고 이체 정보 등"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-1 block">{supplierRemittance?.remittance_note || "미지정"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Contacts List Card */}
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

          {/* [신규 기능]: 담당 업무 및 주 담당자 관리 테이블 카드 */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">담당 업무 및 주 담당자</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="px-4 py-3">업무명</th>
                    <th className="px-4 py-3">주 담당자 정보</th>
                    <th className="px-4 py-3">알림 수신인</th>
                    <th className="px-4 py-3 text-center w-28">지정 상태</th>
                    {isCompanyAdmin && <th className="px-4 py-3 text-right">담당자 변경</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {tasks.map((task) => {
                    const notifyNames = getEmailRecipientsForTask(task.taskCode);
                    return (
                      <tr key={task.taskCode} className="hover:bg-zinc-50/20">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-zinc-850 dark:text-zinc-200 block">{task.label}</span>
                          <span className="text-[9px] text-zinc-400 block mt-0.5 leading-relaxed max-w-xs">{task.desc}</span>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-350">
                          {task.userId ? (
                            <div className="space-y-0.5">
                              <a
                                href="/portal/company/users"
                                className="font-semibold text-emerald-600 hover:underline dark:text-emerald-450 text-[13px]"
                              >
                                {task.userName}
                              </a>
                              {task.userTitle || task.userPosition ? (
                                <p className="text-[10px] text-zinc-400">
                                  {task.userTitle || ""}{task.userTitle && task.userPosition ? " / " : ""}{task.userPosition || ""}
                                </p>
                              ) : null}
                              <p className="text-[9px] text-zinc-450 font-mono">{task.userEmail}</p>
                              {task.userPhone && <p className="text-[9px] text-zinc-400">📞 {task.userPhone}</p>}
                            </div>
                          ) : (
                            <span className="text-zinc-450 italic">주 담당자 미지정</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400">
                          {isCompanyAdmin ? (
                            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto p-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 w-[140px] shadow-2xs">
                              {activeMembers.map(u => {
                                const isNotified = u.task_assignments?.some((a: any) => a.task_code === task.taskCode && a.email_notify);
                                return (
                                  <label key={u.id} className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={!!isNotified}
                                      onChange={(e) => handleToggleEmailNotification(task.taskCode, u.id, e.target.checked)}
                                      disabled={isPending}
                                      className="h-3.5 w-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="truncate max-w-[80px]" title={u.name || "(이름 없음)"}>{u.name || "(이름 없음)"}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="truncate max-w-xxs block" title={notifyNames}>{notifyNames}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {task.userId ? (
                            <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                              설정 완료
                            </span>
                          ) : (
                            <span className="inline-block rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold border border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                              미지정
                            </span>
                          )}
                        </td>
                        {isCompanyAdmin && (
                          <td className="px-4 py-3.5 text-right">
                            <select
                              value={task.userId || ""}
                              onChange={(e) => handleAssignPrimaryUser(task.taskCode, e.target.value || null)}
                              disabled={isPending}
                              className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white max-w-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="">-- 담당자 선택 --</option>
                              {activeMembers.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name || "(이름 없음)"} ({u.title || "멤버"})
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
