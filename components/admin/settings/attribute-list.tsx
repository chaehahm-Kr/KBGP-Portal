"use client";

import { useState, useTransition } from "react";
import { 
  toggleAttributeActive, 
  saveAttribute, 
  deleteAttribute,
  type AttributeMasterItem 
} from "@/lib/product/attribute-actions";

export function AttributeList({ initialAttributes }: { initialAttributes: AttributeMasterItem[] }) {
  const [attributes, setAttributes] = useState<AttributeMasterItem[]>(initialAttributes);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScope, setFilterScope] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<AttributeMasterItem | null>(null); // null means "Create"
  const [modalData, setModalData] = useState({
    code: "",
    nameKo: "",
    nameEn: "",
    scope: "COMMON" as "COMMON" | "PROFILE",
    attrGroup: "",
    inputType: "SINGLE_SELECT",
    isMultiple: false,
    unitSet: "",
    isRequired: false,
    allowNa: true,
    allowUnknown: true,
    allowOther: false,
    brandEditable: true,
    adminOnly: false,
    isSearchable: true,
    displayOrder: 10,
    helpText: "",
    isActive: true
  });
  
  // Attribute options sub-form state
  interface OptionRow {
    optionCode: string;
    optionKo: string;
    optionEn: string;
    displayOrder: number;
  }
  const [optionsList, setOptionsList] = useState<OptionRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const handleActiveToggle = async (code: string, currentActive: boolean) => {
    const updatedActive = !currentActive;
    
    setAttributes((prev) => 
      prev.map((a) => a.code === code ? { ...a, isActive: updatedActive } as any : a)
    );

    startTransition(async () => {
      try {
        await toggleAttributeActive(code, updatedActive);
      } catch (err) {
        console.error("속성 활성 토글 에러", err);
        setAttributes((prev) => 
          prev.map((a) => a.code === code ? { ...a, isActive: currentActive } as any : a)
        );
      }
    });
  };

  const handleOpenCreate = () => {
    setErrorMsg("");
    setEditingAttr(null);
    setModalData({
      code: "",
      nameKo: "",
      nameEn: "",
      scope: "COMMON",
      attrGroup: "공통 속성",
      inputType: "SINGLE_SELECT",
      isMultiple: false,
      unitSet: "",
      isRequired: false,
      allowNa: true,
      allowUnknown: true,
      allowOther: false,
      brandEditable: true,
      adminOnly: false,
      isSearchable: true,
      displayOrder: 10,
      helpText: "",
      isActive: true
    });
    setOptionsList([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: AttributeMasterItem) => {
    setErrorMsg("");
    setEditingAttr(a);
    setModalData({
      code: a.code,
      nameKo: a.nameKo,
      nameEn: a.nameEn || "",
      scope: a.scope,
      attrGroup: a.attrGroup || "",
      inputType: a.inputType,
      isMultiple: a.isMultiple,
      unitSet: a.unitSet || "",
      isRequired: a.isRequired,
      allowNa: a.allowNa !== false,
      allowUnknown: a.allowUnknown !== false,
      allowOther: !!a.allowOther,
      brandEditable: a.brandEditable,
      adminOnly: a.adminOnly,
      isSearchable: a.isSearchable !== false,
      displayOrder: a.displayOrder || 10,
      helpText: a.helpText || "",
      isActive: (a as any).isActive !== false
    });

    const optRows = (a.options || []).map((o, idx) => ({
      optionCode: o.optionCode,
      optionKo: o.optionKo,
      optionEn: o.optionEn || "",
      displayOrder: o.displayOrder || (idx + 1) * 10
    }));
    setOptionsList(optRows);
    setIsModalOpen(true);
  };

  const handleAddOptionRow = () => {
    setOptionsList((prev) => [
      ...prev,
      {
        optionCode: "",
        optionKo: "",
        optionEn: "",
        displayOrder: (prev.length + 1) * 10
      }
    ]);
  };

  const handleRemoveOptionRow = (index: number) => {
    setOptionsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOptionRowChange = (index: number, key: keyof OptionRow, val: any) => {
    setOptionsList((prev) =>
      prev.map((o, idx) => (idx === index ? { ...o, [key]: val } : o))
    );
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!modalData.code.trim()) {
      setErrorMsg("속성 코드를 입력해 주십시오.");
      return;
    }
    if (!modalData.nameKo.trim()) {
      setErrorMsg("속성 한글 라벨을 입력해 주십시오.");
      return;
    }

    // Validate options if SELECT type
    const needOptions = modalData.inputType === "SINGLE_SELECT" || modalData.inputType === "MULTI_SELECT";
    if (needOptions && optionsList.length === 0) {
      setErrorMsg("선택형 속성은 최소 1개 이상의 옵션 후보를 입력해야 합니다.");
      return;
    }

    for (const opt of optionsList) {
      if (!opt.optionCode.trim() || !opt.optionKo.trim()) {
        setErrorMsg("모든 옵션의 코드와 한글 표기명은 필수입니다.");
        return;
      }
    }

    startTransition(async () => {
      try {
        await saveAttribute(
          {
            code: modalData.code,
            nameKo: modalData.nameKo,
            nameEn: modalData.nameEn || null,
            scope: modalData.scope,
            attrGroup: modalData.attrGroup || null,
            inputType: modalData.inputType,
            isMultiple: modalData.isMultiple,
            unitSet: modalData.unitSet || null,
            isRequired: modalData.isRequired,
            allowNa: modalData.allowNa,
            allowUnknown: modalData.allowUnknown,
            allowOther: modalData.allowOther,
            brandEditable: modalData.brandEditable,
            adminOnly: modalData.adminOnly,
            isSearchable: modalData.isSearchable,
            displayOrder: modalData.displayOrder,
            helpText: modalData.helpText || null,
            isActive: modalData.isActive
          },
          optionsList
        );
        window.location.reload();
      } catch (err: any) {
        setErrorMsg(err.message || "속성 저장에 실패했습니다.");
      }
    });
  };

  const handleDeleteAttribute = async (code: string) => {
    if (!confirm(`정말로 이 속성 명세(${code})를 삭제/비활성화하시겠습니까?`)) return;
    startTransition(async () => {
      try {
        await deleteAttribute(code);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "삭제 실패");
      }
    });
  };

  const filtered = attributes.filter((a) => {
    const matchesSearch = 
      a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.nameKo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.attrGroup || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesScope = 
      filterScope === "ALL" || 
      a.scope === filterScope;

    return matchesSearch && matchesScope;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filter Header Panel */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-950/20 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400 dark:text-zinc-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id="attr-search-input"
            type="text"
            placeholder="속성명, 코드, 그룹 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleOpenCreate}
            className="bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer mr-4"
          >
            + 신규 속성 정의
          </button>

          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold mr-1">분류 범위:</span>
          {["ALL", "COMMON", "PROFILE"].map((scope) => (
            <button
              id={`filter-scope-${scope}`}
              key={scope}
              onClick={() => setFilterScope(scope)}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${filterScope === scope 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }
              `}
            >
              {scope === "ALL" ? "전체" : scope === "COMMON" ? "공통" : "프로필군"}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-950/20">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300">
          <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-6 py-4">속성 정보 (그룹/코드)</th>
              <th className="px-6 py-4">한/영 속성명</th>
              <th className="px-6 py-4">입력 형식</th>
              <th className="px-6 py-4">속성 옵션 (Options)</th>
              <th className="px-6 py-4 text-center">브랜드 수정</th>
              <th className="px-6 py-4 text-center">필수여부</th>
              <th className="px-6 py-4 text-center">제어</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-150 dark:divide-zinc-900/60 bg-transparent">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                  검색 조건에 맞는 속성이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const isActive = (a as any).isActive !== false;
                return (
                  <tr 
                    key={a.code} 
                    className={`transition-colors hover:bg-zinc-100/30 dark:hover:bg-zinc-900/20 ${!isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 w-fit mb-1 font-sans">
                          {a.attrGroup || "미분류"}
                        </span>
                        <span className="font-mono text-xs font-semibold text-indigo-650 dark:text-indigo-400 tracking-wide">{a.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{a.nameKo}</span>
                        {a.nameEn && <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal">{a.nameEn}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">{a.inputType}</span>
                        {a.isMultiple && (
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/30 px-1.5 py-0.2 rounded w-fit">
                            다중선택 가능
                          </span>
                        )}
                        {a.unitSet && (
                          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                            단위: {a.unitSet}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      {a.options && a.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                          {a.options.map((opt) => (
                            <span 
                              key={opt.optionCode}
                              className="text-[10px] bg-zinc-150 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md"
                            >
                              {opt.optionKo}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-italic">자유입력 / 옵션없음</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`
                        text-[10px] font-semibold px-2 py-0.5 rounded
                        ${a.brandEditable ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'}
                      `}>
                        {a.brandEditable ? "수정 가능" : "수정 불가"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`
                        text-[10px] font-bold px-2 py-0.5 rounded
                        ${a.isRequired ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}
                      `}>
                        {a.isRequired ? "필수" : "선택"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(a)}
                          className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 text-xs font-bold rounded cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-900/60"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteAttribute(a.code)}
                          className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30 text-xs font-bold rounded cursor-pointer hover:bg-rose-100/60 dark:hover:bg-rose-900/60"
                        >
                          삭제
                        </button>

                        <button
                          id={`toggle-attr-${a.code}`}
                          disabled={isPending}
                          onClick={() => handleActiveToggle(a.code, isActive)}
                          className={`
                            relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                            transition-colors duration-200 ease-in-out focus:outline-none
                            ${isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}
                          `}
                        >
                          <span
                            className={`
                              pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 
                              transition duration-200 ease-in-out
                              ${isActive ? 'translate-x-4' : 'translate-x-0'}
                            `}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CUD 모달 다이얼로그 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn text-zinc-900 dark:text-zinc-100 my-8">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/20">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>⚙️ {editingAttr ? "속성 마스터 명세 편집" : "신규 속성 정의"}</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Code */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">속성 코드 (PK, 대문자 영문 고유값)</label>
                  <input
                    type="text"
                    placeholder="예: SPF_VALUE"
                    disabled={!!editingAttr || isPending}
                    value={modalData.code}
                    onChange={(e) => setModalData(prev => ({ ...prev, code: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none disabled:opacity-60"
                  />
                </div>

                {/* Scope */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">적용 범위 (Scope)</label>
                  <select
                    value={modalData.scope}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, scope: e.target.value as any }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="COMMON">공통 속성 (COMMON)</option>
                    <option value="PROFILE">제품군 특화 속성 (PROFILE)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Korean Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">속성명 한글</label>
                  <input
                    type="text"
                    placeholder="예: SPF 지수"
                    value={modalData.nameKo}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, nameKo: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>

                {/* English Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">속성명 영문</label>
                  <input
                    type="text"
                    placeholder="예: SPF Value"
                    value={modalData.nameEn}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, nameEn: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Group */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">속성 그룹</label>
                  <input
                    type="text"
                    placeholder="예: 제품 기본스펙"
                    value={modalData.attrGroup}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, attrGroup: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>

                {/* Input Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">입력 양식 (Input Type)</label>
                  <select
                    value={modalData.inputType}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, inputType: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="SINGLE_SELECT">객관식 단일 선택 (SINGLE_SELECT)</option>
                    <option value="MULTI_SELECT">객관식 다중 선택 (MULTI_SELECT)</option>
                    <option value="YES_NO_NA">Yes / No / N.A 선택 (YES_NO_NA)</option>
                    <option value="NUMBER_UNIT">숫자 + 단위 입력 (NUMBER_UNIT)</option>
                    <option value="NUMBER">순수 숫자 입력 (NUMBER)</option>
                    <option value="TEXT">단행 텍스트 입력 (TEXT)</option>
                    <option value="LONG_TEXT">다행 텍스트 입력 (LONG_TEXT)</option>
                  </select>
                </div>

                {/* Unit Set */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500">단위 셋트 (Unit Set)</label>
                  <input
                    type="text"
                    placeholder="CELSIUS, MONTH, PERCENT 등"
                    value={modalData.unitSet}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, unitSet: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                  />
                </div>
              </div>

              {/* Checkboxes grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-multiple"
                    checked={modalData.isMultiple}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, isMultiple: e.target.checked }))}
                    className="rounded text-indigo-650 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chk-multiple" className="text-xs font-bold cursor-pointer">다중값 허용</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-required"
                    checked={modalData.isRequired}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, isRequired: e.target.checked }))}
                    className="rounded text-indigo-650 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chk-required" className="text-xs font-bold cursor-pointer">필수 입력</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-brand"
                    checked={modalData.brandEditable}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, brandEditable: e.target.checked }))}
                    className="rounded text-indigo-650 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chk-brand" className="text-xs font-bold cursor-pointer">브랜드 수정허용</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-admin"
                    checked={modalData.adminOnly}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, adminOnly: e.target.checked }))}
                    className="rounded text-indigo-650 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chk-admin" className="text-xs font-bold cursor-pointer">어드민 전용</label>
                </div>
              </div>

              {/* Dynamic options editor (Only for select types) */}
              {(modalData.inputType === "SINGLE_SELECT" || modalData.inputType === "MULTI_SELECT") && (
                <div className="flex flex-col gap-2 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">📝 객관식 선택 옵션 구성 ({optionsList.length}개)</span>
                    <button
                      type="button"
                      onClick={handleAddOptionRow}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      + 옵션 행 추가
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {optionsList.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <input
                          type="text"
                          placeholder="코드 (예: SPF_50)"
                          value={row.optionCode}
                          onChange={(e) => handleOptionRowChange(idx, "optionCode", e.target.value)}
                          className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs w-1/4"
                        />
                        <input
                          type="text"
                          placeholder="한글 (예: SPF 50+)"
                          value={row.optionKo}
                          onChange={(e) => handleOptionRowChange(idx, "optionKo", e.target.value)}
                          className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs w-1/3"
                        />
                        <input
                          type="text"
                          placeholder="영문 (Optional)"
                          value={row.optionEn}
                          onChange={(e) => handleOptionRowChange(idx, "optionEn", e.target.value)}
                          className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs w-1/3"
                        />
                        <input
                          type="number"
                          placeholder="순서"
                          value={row.displayOrder}
                          onChange={(e) => handleOptionRowChange(idx, "displayOrder", Number(e.target.value))}
                          className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs w-16"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionRow(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold text-xs px-2 cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500">속성 도움말 (Help Text)</label>
                <textarea
                  placeholder="실무자가 입력창 밑에서 볼 수 있는 간단한 부연설명입니다."
                  value={modalData.helpText}
                  disabled={isPending}
                  onChange={(e) => setModalData(prev => ({ ...prev, helpText: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full h-20 resize-none focus:outline-none"
                />
              </div>

              {/* Bottom Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950 disabled:opacity-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "저장 중..." : "속성 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
