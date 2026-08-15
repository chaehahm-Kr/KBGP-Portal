"use client";

import { useState, useTransition } from "react";
import {
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  type WarehouseRow,
  type WarehousePayload
} from "@/lib/warehouse/actions";

interface WarehouseSettingsManagerProps {
  initialWarehouses: (WarehouseRow & { companies: { name: string } | null })[];
  companies: { id: string; name: string }[];
  canEdit: boolean;
}

export function WarehouseSettingsManager({
  initialWarehouses,
  companies,
  canEdit
}: WarehouseSettingsManagerProps) {
  const [warehouses, setWarehouses] = useState(initialWarehouses);
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
    internal_note: ""
  });

  // Filtered Warehouses
  const filteredWarehouses = warehouses.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = selectedCompanyId === "all" || w.company_id === selectedCompanyId;
    const matchesType = selectedType === "all" || w.type === selectedType;
    const matchesStatus = selectedStatus === "all" || w.status === selectedStatus;

    return matchesSearch && matchesCompany && matchesType && matchesStatus;
  });

  const handleOpenCreate = () => {
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");
    setEditingWarehouse(null);
    setFormData({
      name: "",
      code: "",
      company_id: companies[0]?.id || "",
      type: "own",
      status: "active",
      is_default_receiving: false,
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip_code: "",
      country: "United States",
      internal_note: ""
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
      company_id: w.company_id,
      type: w.type as any,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMsg("");
    setSuccessMsg("");

    // Front-end Validations
    if (!formData.name.trim()) return setErrorMsg("물류창고 이름을 입력해주세요.");
    if (!formData.code.trim()) return setErrorMsg("물류창고 코드를 입력해주세요.");
    if (!formData.company_id) return setErrorMsg("연결할 회사를 선택해주세요.");
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
          // Reload page state or refresh
          setTimeout(() => {
            setIsModalOpen(false);
            window.location.reload();
          }, 1000);
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
      {/* Control Panel (Filters & Add button) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          {/* Search Input */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">창고명 / 코드 검색</span>
            <input
              type="text"
              placeholder="예: NJ1 또는 NJ Main..."
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
              <option value="3pl">3PL 물류창고</option>
              <option value="other">기타</option>
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

      {/* Warehouse List Table */}
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
                  w.type === "own" ? "자사 창고" : w.type === "3pl" ? "3PL 물류" : "기타";
                const typeBg =
                  w.type === "own"
                    ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40"
                    : w.type === "3pl"
                    ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/40"
                    : "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-800";

                return (
                  <tr key={w.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-mono font-bold text-zinc-950 dark:text-white">
                      {w.code}
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {w.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                      {w.companies?.name || "-"}
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
                {/* Company Link Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">연결 파트너 회사</label>
                  <select
                    disabled={isPending}
                    value={formData.company_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, company_id: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warehouse Type Field */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">창고 유형</label>
                  <select
                    disabled={isPending}
                    value={formData.type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as any }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none"
                  >
                    <option value="own">자사 창고 (Own)</option>
                    <option value="3pl">3PL 물류창고</option>
                    <option value="other">기타</option>
                  </select>
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
                  <span className="text-[10px] text-zinc-400 mt-1">회사별로 하나의 활성 창고만 기본 입고지로 설정 가능합니다.</span>
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
