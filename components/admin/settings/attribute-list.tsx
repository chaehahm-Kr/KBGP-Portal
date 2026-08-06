"use client";

import { useState, useTransition } from "react";
import { toggleAttributeActive, type AttributeMasterItem } from "@/lib/product/attribute-actions";

export function AttributeList({ initialAttributes }: { initialAttributes: AttributeMasterItem[] }) {
  const [attributes, setAttributes] = useState<AttributeMasterItem[]>(initialAttributes);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScope, setFilterScope] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  const handleActiveToggle = async (code: string, currentActive: boolean) => {
    const updatedActive = !currentActive;
    
    // Optimistic Update
    setAttributes((prev) => 
      prev.map((a) => a.code === code ? { ...a, isActive: updatedActive } as any : a)
    );

    startTransition(async () => {
      try {
        await toggleAttributeActive(code, updatedActive);
      } catch (err) {
        console.error("속성 활성 토글 에러", err);
        // revert
        setAttributes((prev) => 
          prev.map((a) => a.code === code ? { ...a, isActive: currentActive } as any : a)
        );
      }
    });
  };

  // Filter & Search
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
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
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
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-400 font-semibold mr-1">분류 범위:</span>
          {["ALL", "COMMON", "PROFILE"].map((scope) => (
            <button
              id={`filter-scope-${scope}`}
              key={scope}
              onClick={() => setFilterScope(scope)}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterScope === scope 
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/20' 
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }
              `}
            >
              {scope === "ALL" ? "전체" : scope === "COMMON" ? "공통" : "프로필군"}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-6 py-4">속성 정보 (그룹/코드)</th>
              <th className="px-6 py-4">한/영 속성명</th>
              <th className="px-6 py-4">입력 형식</th>
              <th className="px-6 py-4">속성 옵션 (Options)</th>
              <th className="px-6 py-4 text-center">브랜드 수정</th>
              <th className="px-6 py-4 text-center">필수여부</th>
              <th className="px-6 py-4 text-center">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60 bg-transparent">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                  검색 조건에 맞는 속성이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const isActive = (a as any).isActive !== false;
                return (
                  <tr 
                    key={a.code} 
                    className={`transition-colors hover:bg-slate-900/20 ${!isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/40 w-fit mb-1">
                          {a.attrGroup || "미분류"}
                        </span>
                        <span className="font-mono text-xs font-semibold text-violet-400 tracking-wide">{a.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100">{a.nameKo}</span>
                        {a.nameEn && <span className="text-xs text-slate-400 font-normal">{a.nameEn}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-300">{a.inputType}</span>
                        {a.isMultiple && (
                          <span className="text-[10px] font-bold text-sky-400 bg-sky-950/20 border border-sky-900/30 px-1.5 py-0.2 rounded w-fit">
                            다중선택 가능
                          </span>
                        )}
                        {a.unitSet && (
                          <span className="text-[10px] font-medium text-slate-500">
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
                              className="text-[10px] bg-slate-800/70 border border-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md"
                            >
                              {opt.optionKo}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-italic">자유입력 / 옵션없음</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`
                        text-[10px] font-semibold px-2 py-0.5 rounded
                        ${a.brandEditable ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' : 'bg-rose-950/30 text-rose-400 border border-rose-900/30'}
                      `}>
                        {a.brandEditable ? "수정 가능" : "수정 불가"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`
                        text-[10px] font-bold px-2 py-0.5 rounded
                        ${a.isRequired ? 'bg-amber-950/40 text-amber-400 border border-amber-800/20' : 'bg-slate-900 text-slate-500'}
                      `}>
                        {a.isRequired ? "필수" : "선택"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        id={`toggle-attr-${a.code}`}
                        disabled={isPending}
                        onClick={() => handleActiveToggle(a.code, isActive)}
                        className={`
                          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                          transition-colors duration-200 ease-in-out focus:outline-none
                          ${isActive ? 'bg-emerald-500' : 'bg-slate-850'}
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
