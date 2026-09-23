"use client";

import { useState, useTransition } from "react";
import {
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  type WarehouseRow,
  type WarehousePayload,
  type UnlinkedShippingOriginItem,
} from "@/lib/warehouse/actions";

interface WarehouseSettingsManagerProps {
  initialWarehouses: (WarehouseRow & { companies: { name: string } | null })[];
  initialUnlinkedOrigins?: UnlinkedShippingOriginItem[];
  companies: { id: string; name: string }[];
  canEdit: boolean;
}

export function WarehouseSettingsManager({
  initialWarehouses,
  initialUnlinkedOrigins = [],
  companies,
  canEdit
}: WarehouseSettingsManagerProps) {
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [unlinkedOrigins, setUnlinkedOrigins] = useState<UnlinkedShippingOriginItem[]>(initialUnlinkedOrigins);
  const [activeTab, setActiveTab] = useState<"all" | "warehouses" | "origins">("all");
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<(WarehouseRow & { companies: { name: string } | null }) | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form State
  const [formData, setFormData] = useState<WarehousePayload>({
    name: "",
    code: "",
    company_id: "",
    type: "own",
    status: "active",
    is_default_receiving: false,
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "United States",
    internal_note: "",
    shipping_origin_id: undefined,
  });

  // Filtered Warehouses
  const filteredWarehouses = warehouses.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.companies?.name && w.companies.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      w.address1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.city.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany =
      selectedCompanyId === "all" ||
      (selectedCompanyId === "own_only" && (w.type === "own" || !w.company_id)) ||
      (selectedCompanyId === "company_linked" && w.type !== "own" && !!w.company_id) ||
      (w.company_id === selectedCompanyId && w.type !== "own");
    const matchesType = selectedType === "all" || w.type === selectedType;
    const matchesStatus = selectedStatus === "all" || w.status === selectedStatus;

    return matchesSearch && matchesCompany && matchesType && matchesStatus;
  });

  // Filtered Unlinked Shipping Origins
  const filteredUnlinkedOrigins = unlinkedOrigins.filter((origin) => {
    const matchesSearch =
      origin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (origin.company_name && origin.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      origin.address_line1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      origin.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (origin.contact_name && origin.contact_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCompany =
      selectedCompanyId === "all" ||
      (selectedCompanyId === "company_linked" && !!origin.company_id) ||
      origin.company_id === selectedCompanyId;

    const matchesStatus =
      selectedStatus === "all" || origin.status === selectedStatus;

    return matchesSearch && matchesCompany && matchesStatus;
  });

  const handleOpenCreate = () => {
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");
    setEditingWarehouse(null);
    setFormData({
      name: "",
      code: "",
      company_id: "",
      type: "own",
      status: "active",
      is_default_receiving: false,
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip_code: "",
      country: "United States",
      internal_note: "",
      shipping_origin_id: undefined,
    });
    setIsModalOpen(true);
  };

  const handleOpenCreateFromOrigin = (origin: UnlinkedShippingOriginItem) => {
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");
    setEditingWarehouse(null);
    setFormData({
      name: origin.name,
      code: "",
      company_id: origin.company_id,
      type: "partner",
      status: "active",
      is_default_receiving: false,
      address1: origin.address_line1 || "",
      address2: origin.address_line2 || "",
      city: origin.city || "",
      state: origin.state_province || "",
      zip_code: origin.postal_code || "",
      country: origin.country || "South Korea",
      internal_note: `[출고지 연동] ${origin.name}`,
      shipping_origin_id: origin.id,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: WarehouseRow & { companies: { name: string } | null }) => {
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");
    setEditingWarehouse(w);
    setFormData({
      name: w.name,
      code: w.code,
      company_id: w.type === "own" ? "" : (w.company_id || ""),
      type: (w.type as any) || "own",
      status: w.status as any,
      is_default_receiving: w.is_default_receiving,
      address1: w.address1,
      address2: w.address2 || "",
      city: w.city,
      state: w.state,
      zip_code: w.zip_code,
      country: w.country,
      internal_note: w.internal_note || ""
    });
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: "own" | "3pl" | "partner" | "other") => {
    if (newType === "own") {
      setFormData((prev) => ({ ...prev, type: newType, company_id: "" }));
    } else {
      setFormData((prev) => ({ ...prev, type: newType }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");

    // Front-end Validations
    if (!formData.name.trim()) return setErrorMsg("물류창고 이름을 입력해주세요.");
    if (!formData.code.trim()) return setErrorMsg("물류창고 코드를 입력해주세요.");
    if (formData.type === "3pl" && !formData.company_id) {
      return setErrorMsg("3PL 물류창고는 연결할 회사를 반드시 선택해주세요.");
    }
    if (formData.type === "partner" && !formData.company_id) {
      return setErrorMsg("파트너 창고는 연결할 파트너 회사를 반드시 선택해주세요.");
    }
    if (!formData.address1.trim()) return setErrorMsg("주소 1을 입력해주세요.");
    if (!formData.city.trim()) return setErrorMsg("도시(City)를 입력해주세요.");
    if (!formData.state.trim()) return setErrorMsg("주/도(State/Province)를 입력해주세요.");
    if (!formData.zip_code.trim()) return setErrorMsg("우편번호(ZIP/Postal Code)를 입력해주세요.");
    if (!formData.country.trim()) return setErrorMsg("국가(Country)를 입력해주세요.");

    startTransition(async () => {
      try {
        let result;
        if (editingWarehouse) {
          result = await updateWarehouse(editingWarehouse.id, formData);
        } else {
          result = await createWarehouse(formData);
        }

        if (result.success) {
          setSuccessMsg(editingWarehouse ? "물류창고가 성공적으로 수정되었습니다." : "물류창고가 성공적으로 등록되었습니다.");
          if (formData.shipping_origin_id) {
            setUnlinkedOrigins((prev) => prev.filter((o) => o.id !== formData.shipping_origin_id));
          }
          // Reload page state or refresh
          setTimeout(() => {
            setIsModalOpen(false);
            window.location.reload();
          }, 800);
        } else {
          setErrorMsg(result.error || "처리 중 오류가 발생했습니다.");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "서버 통신 오류가 발생했습니다.");
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    if (!confirm("정말로 이 물류창고를 삭제하시겠습니까?")) return;

    startTransition(async () => {
      try {
        const result = await deleteWarehouse(id);
        if (result.success) {
          window.location.reload();
        } else {
          alert(result.error || "삭제에 실패했습니다.");
        }
      } catch (err: any) {
        alert(err.message || "삭제 오류가 발생했습니다.");
      }
    });
  };

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          전체 보기 ({warehouses.length + unlinkedOrigins.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("warehouses")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "warehouses"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>🏢 등록된 물류창고</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === "warehouses" ? "bg-white/20 text-white dark:bg-zinc-950/20 dark:text-zinc-950" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
            {warehouses.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("origins")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "origins"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>📍 출고지 정보 (Warehouse 미연결)</span>
          {unlinkedOrigins.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === "origins" ? "bg-amber-400 text-zinc-950" : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"}`}>
              {unlinkedOrigins.length}
            </span>
          )}
        </button>
      </div>

      {/* Control Panel (Filters & Add button) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          {/* Search Input */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">창고명 / 코드 / 출고지명 / 회사 검색</span>
            <input
              type="text"
              placeholder="예: LETNJ1, ROLAND, 테스트..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
            />
          </div>

          {/* Company Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">회사 필터</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
            >
              <option value="all">전체 회사</option>
              <option value="own_only">🏢 자사 창고 (회사 연결 없음)</option>
              <option value="company_linked">🔗 파트너/3PL 연결 창고 및 출고지</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">유형 필터</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
            >
              <option value="all">전체 유형</option>
              <option value="own">자사 창고 (Own)</option>
              <option value="3pl">3PL 물류 창고 (3PL)</option>
              <option value="partner">파트너 창고 (Partner)</option>
              <option value="other">기타 (Other)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">상태 필터</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성 (Active)</option>
              <option value="inactive">비활성 (Inactive)</option>
            </select>
          </div>
        </div>

        {/* Add Warehouse Button */}
        {canEdit && (
          <div className="shrink-0 flex items-end">
            <button
              onClick={handleOpenCreate}
              className="w-full md:w-auto bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-900 dark:border-zinc-100 font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              신규 물류창고 등록
            </button>
          </div>
        )}
      </div>

      {/* Section A: 등록된 물류창고 */}
      {(activeTab === "all" || activeTab === "warehouses") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                <span>🏢</span>
                <span>Section A — 등록된 물류창고</span>
              </h3>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                {filteredWarehouses.length}개
              </span>
            </div>
            {activeTab === "all" && unlinkedOrigins.length > 0 && (
              <span className="text-[11px] text-zinc-400">
                아래에 미연결 출고지 {unlinkedOrigins.length}건이 있습니다.
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/20 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                    <th className="px-6 py-3.5 font-semibold">코드</th>
                    <th className="px-6 py-3.5 font-semibold">창고명</th>
                    <th className="px-6 py-3.5 font-semibold">연결 회사</th>
                    <th className="px-6 py-3.5 font-semibold">창고 유형</th>
                    <th className="px-6 py-3.5 font-semibold text-center">기본 입고지</th>
                    <th className="px-6 py-3.5 font-semibold text-center">상태</th>
                    <th className="px-6 py-3.5 font-semibold">주소</th>
                    <th className="px-6 py-3.5 font-semibold">메모</th>
                    {canEdit && <th className="px-6 py-3.5 text-right font-semibold">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredWarehouses.map((w) => {
                    const typeLabel =
                      w.type === "own"
                        ? "자사 창고"
                        : w.type === "3pl"
                        ? "3PL 물류창고"
                        : w.type === "partner"
                        ? "파트너 창고"
                        : "기타";
                    const typeBg =
                      w.type === "own"
                        ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40"
                        : w.type === "3pl"
                        ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/40"
                        : w.type === "partner"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40"
                        : "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-800";

                    return (
                      <tr key={w.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <td className="px-6 py-4 font-mono font-bold text-zinc-950 dark:text-white">
                          {w.code}
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{w.name}</span>
                            {w.shipping_origin_id && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                title={w.shipping_origin_name ? `출고지: ${w.shipping_origin_name}` : "출고지 연동 창고"}
                              >
                                📍 출고지 연동
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                          {w.type === "own" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-50/80 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50">
                              자사
                            </span>
                          ) : w.company_id && w.companies?.name ? (
                            <span>{w.companies.name}</span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold border ${typeBg}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {w.is_default_receiving ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-450 font-bold bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded text-[10px]">
                              ✓ 기본
                            </span>
                          ) : (
                            <span className="text-zinc-350 dark:text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${
                              w.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                                : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                            }`}
                          >
                            {w.status === "active" ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-650 dark:text-zinc-400 max-w-xs truncate" title={`${w.address1} ${w.address2 || ""} ${w.city}, ${w.state} ${w.zip_code}, ${w.country}`}>
                          {w.address1} {w.address2 ? `, ${w.address2}` : ""}, {w.city}, {w.state} {w.zip_code}, {w.country}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-500 max-w-xs truncate" title={w.internal_note || ""}>
                          {w.internal_note || "-"}
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <button
                                onClick={() => handleOpenEdit(w)}
                                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded cursor-pointer"
                              >
                                수정
                              </button>
                              {!w.is_default_receiving && (
                                <button
                                  onClick={() => handleDelete(w.id)}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded cursor-pointer"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredWarehouses.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 9 : 8} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                        등록된 물류창고 정보가 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section B: 출고지 정보 (Warehouse 미연결) */}
      {(activeTab === "all" || activeTab === "origins") && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Section B — 출고지 정보 (Warehouse 미연결)</span>
                </h3>
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {filteredUnlinkedOrigins.length}개 미연결
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                브랜드/파트너사가 등록한 출고지 중 아직 물류창고로 등록되지 않은 장소입니다. [물류창고로 등록] 시 마스터 창고로 승격되며 시스템 전반에 연동됩니다.
              </p>
            </div>
          </div>

          {filteredUnlinkedOrigins.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="mx-auto w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
                📍
              </div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                미연결 출고지가 없습니다.
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                모든 출고지가 물류창고로 연동되었거나 등록된 출고지가 없습니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUnlinkedOrigins.map((origin) => (
                <div
                  key={origin.id}
                  className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 shadow-sm flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
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
                        {/* Company Name */}
                        <div className="mt-1 flex items-center gap-1 text-[11px]">
                          <span className="text-zinc-400 font-medium">회사:</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {origin.company_name || "알 수 없는 회사"}
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                        <span>●</span> Warehouse 미연결
                      </span>
                    </div>

                    {/* Address Information */}
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/40 p-3 border border-zinc-150 dark:border-zinc-850 text-xs space-y-1">
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
                      <div className="text-[11px] space-y-0.5 text-zinc-600 dark:text-zinc-400 pt-0.5">
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
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/40 whitespace-pre-wrap">
                        <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">
                          메모:
                        </span>
                        {origin.notes}
                      </div>
                    )}
                  </div>

                  {/* Card Action */}
                  {canEdit && (
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                      <a
                        href={`/admin/companies/${origin.company_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline flex items-center gap-0.5"
                      >
                        <span>회사 상세 보기</span>
                        <span>↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateFromOrigin(origin)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 shadow-sm transition-colors cursor-pointer"
                      >
                        <span>🏢</span>
                        <span>물류창고로 등록</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn text-zinc-900 dark:text-zinc-100">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/20">
              <h3 className="text-sm font-bold">🏢 {editingWarehouse ? "물류창고 수정" : "신규 물류창고 등록"}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold cursor-pointer"
              >
                닫기
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto pr-3">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-100 dark:border-rose-950/40">
                  ⚠️ {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-100 dark:border-emerald-950/40">
                  ✓ {successMsg}
                </div>
              )}

              {editingWarehouse?.shipping_origin_id && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
                      <span>📍</span>
                      <span>
                        연결된 출고지: {editingWarehouse.shipping_origin_name || "출고지 연동 창고"}
                      </span>
                    </div>
                    {editingWarehouse.company_id && (
                      <a
                        href={`/admin/companies/${editingWarehouse.company_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline flex items-center gap-0.5"
                      >
                        <span>회사 출고지 보기</span>
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Code Field (disabled on edit) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">창고 코드 (대문자 고유값)</label>
                  <input
                    type="text"
                    placeholder="예: NJ1"
                    disabled={!!editingWarehouse || isPending}
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full disabled:opacity-50"
                  />
                  <span className="text-[10px] text-zinc-400">2~10자리 영대문자/숫자만 가능하며 생성 후 변경할 수 없습니다.</span>
                </div>

                {/* Name Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">창고 이름</label>
                  <input
                    type="text"
                    placeholder="예: NJ Main Warehouse"
                    disabled={isPending}
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Warehouse Type Field (First for conditional UX) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">창고 유형</label>
                  <select
                    disabled={isPending}
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value as any)}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none"
                  >
                    <option value="own">자사 창고 (Own)</option>
                    <option value="3pl">3PL 물류 창고 (3PL)</option>
                    <option value="partner">파트너 창고 (Partner)</option>
                    <option value="other">기타 (Other)</option>
                  </select>
                </div>

                {/* Company Link Field (Conditional based on Type) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      연결 파트너 회사
                      {(formData.type === "3pl" || formData.type === "partner") && (
                        <span className="text-rose-500 font-bold ml-1">*</span>
                      )}
                    </label>
                    {formData.type === "own" && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">(자사 창고 연결 없음)</span>
                    )}
                  </div>
                  {formData.type === "own" ? (
                    <select
                      disabled={true}
                      value=""
                      className="bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full opacity-70 cursor-not-allowed text-zinc-500 dark:text-zinc-400"
                    >
                      <option value="">연결 회사 없음 (자사 창고)</option>
                    </select>
                  ) : (
                    <select
                      disabled={isPending}
                      value={formData.company_id || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, company_id: e.target.value }))}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none"
                    >
                      <option value="">
                        {formData.type === "3pl" || formData.type === "partner"
                          ? "-- 연결 회사 선택 (필수) --"
                          : "-- 연결 회사 선택 안 함 (선택) --"}
                      </option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {formData.type === "own"
                      ? "💡 자사 창고는 특정 파트너 회사와 연결되지 않습니다."
                      : formData.type === "3pl"
                      ? "* 3PL 물류창고는 관리 책임을 갖는 회사를 필수로 지정해야 합니다."
                      : formData.type === "partner"
                      ? "* 파트너 창고는 해당 창고를 보유/운영하는 파트너 회사를 연결해야 합니다."
                      : "기타 창고는 필요 시 파트너 회사를 연결할 수 있습니다."}
                  </p>
                </div>
              </div>

              {/* Status and Default Receiving Toggles */}
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850">
                {/* Status Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">활성 상태</label>
                  <select
                    disabled={isPending}
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs w-full focus:outline-none"
                  >
                    <option value="active">활성 (Active)</option>
                    <option value="inactive">비활성 (Inactive)</option>
                  </select>
                </div>

                {/* Default Receiving Switch */}
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      disabled={isPending}
                      checked={formData.is_default_receiving}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          is_default_receiving: e.target.checked
                        }))
                      }
                      className="w-4 h-4 text-zinc-900 dark:text-white bg-zinc-100 border-zinc-300 rounded focus:ring-0 cursor-pointer"
                    />
                    기본 입고 창고 지정
                  </label>
                  <span className="text-[10px] text-zinc-400 mt-1">자사 창고 또는 각 회사별로 하나의 활성 창고만 기본 입고지로 설정 가능합니다.</span>
                </div>
              </div>

              {/* Address Fields */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1 text-zinc-400">위치 주소 정보 (Address)</h4>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">주소 1 (Street Address 1)</label>
                  <input
                    type="text"
                    placeholder="예: 23B Roland Avenue"
                    disabled={isPending}
                    value={formData.address1}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address1: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">주소 2 (Street Address 2 - 선택)</label>
                  <input
                    type="text"
                    placeholder="예: Suite 100"
                    disabled={isPending}
                    value={formData.address2 || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address2: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">도시 (City)</label>
                    <input
                      type="text"
                      placeholder="예: Mount Laurel"
                      disabled={isPending}
                      value={formData.city}
                      onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">주/도 (State / Province)</label>
                    <input
                      type="text"
                      placeholder="예: NJ"
                      disabled={isPending}
                      value={formData.state}
                      onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">우편번호 (ZIP / Postal Code)</label>
                    <input
                      type="text"
                      placeholder="예: 08054"
                      disabled={isPending}
                      value={formData.zip_code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, zip_code: e.target.value }))}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">국가 (Country)</label>
                    <input
                      type="text"
                      placeholder="예: United States"
                      disabled={isPending}
                      value={formData.country}
                      onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Note Field */}
              <div className="flex flex-col gap-1 pt-2">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">내부 메모 (Internal Note - 선택)</label>
                <textarea
                  placeholder="물류창고 비고 또는 내부 관리용 메모..."
                  disabled={isPending}
                  value={formData.internal_note || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, internal_note: e.target.value }))}
                  rows={3}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-850"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-900 dark:border-zinc-100 text-xs font-bold rounded-xl cursor-pointer transition-all duration-150 flex items-center gap-1.5"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
