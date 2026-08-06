"use client";

import { useState, useEffect, useTransition } from "react";
import { 
  toggleCategoryActive, 
  saveCategory, 
  deleteCategory,
  saveCategoryProfileMapping,
  type CategoryNode 
} from "@/lib/product/attribute-actions";
import { createClient } from "@/lib/supabase/client";

interface SimpleProfile {
  code: string;
  name_ko: string;
}

export function CategoryTreeList({ initialTree }: { initialTree: CategoryNode[] }) {
  const [tree, setTree] = useState<CategoryNode[]>(initialTree);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // Profiles list for final category mapping
  const [profiles, setProfiles] = useState<SimpleProfile[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({}); // category_code -> profile_code

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<CategoryNode | null>(null); // null means "Create"
  const [modalData, setModalData] = useState({
    code: "",
    nameKo: "",
    nameEn: "",
    depth: 1,
    parentCode: "",
    isFinal: false,
    isActive: true,
    profileCode: ""
  });
  const [errorMsg, setErrorMsg] = useState("");

  // Load profiles and current mappings
  useEffect(() => {
    async function loadMetadata() {
      const supabase = createClient();
      
      // Load active profiles
      const { data: profs } = await supabase
        .from("attribute_profiles")
        .select("code, name_ko")
        .eq("is_active", true);
      if (profs) setProfiles(profs);

      // Load mappings
      const { data: maps } = await supabase
        .from("category_profile_mappings")
        .select("category_code, profile_code")
        .eq("is_active", true);
      
      if (maps) {
        const mapObj: Record<string, string> = {};
        maps.forEach(m => {
          mapObj[m.category_code] = m.profile_code;
        });
        setMappings(mapObj);
      }
    }
    loadMetadata();
  }, []);

  // 카테고리 코드 실시간 자동완성 (신규 등록 시에만 작동)
  useEffect(() => {
    if (editingNode) return; // 수정 시에는 코드 고정

    const cleanName = modalData.nameEn
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");

    let autoCode = "";
    if (modalData.depth === 1) {
      autoCode = cleanName;
    } else {
      if (modalData.parentCode) {
        autoCode = `${modalData.parentCode}_${cleanName}`;
      } else {
        autoCode = cleanName;
      }
    }

    setModalData((prev) => {
      if (prev.code === autoCode) return prev;
      return { ...prev, code: autoCode };
    });
  }, [modalData.nameEn, modalData.parentCode, modalData.depth, editingNode]);

  const handleToggleExpand = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleActiveToggle = async (code: string, currentActive: boolean) => {
    const updatedActive = !currentActive;
    
    const updateNodeInTree = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.map((node) => {
        if (node.code === code) {
          return { ...node, is_active: updatedActive } as any;
        }
        if (node.children && node.children.length > 0) {
          return { ...node, children: updateNodeInTree(node.children) };
        }
        return node;
      });
    };

    setTree((prev) => updateNodeInTree(prev));

    startTransition(async () => {
      try {
        await toggleCategoryActive(code, updatedActive);
      } catch (err) {
        console.error("카테고리 활성 토글 에러", err);
        setTree((prev) => updateNodeInTree(prev));
      }
    });
  };

  // Open modal for Create
  const handleOpenCreate = (parentCode = "", depth = 1) => {
    setErrorMsg("");
    setEditingNode(null);
    setModalData({
      code: "",
      nameKo: "",
      nameEn: "",
      depth,
      parentCode,
      isFinal: depth === 3, // Default to final category if depth is 3
      isActive: true,
      profileCode: ""
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (node: CategoryNode, depth: number) => {
    setErrorMsg("");
    setEditingNode(node);
    setModalData({
      code: node.code,
      nameKo: node.nameKo,
      nameEn: node.nameEn || "",
      depth,
      parentCode: (node as any).parent_code || "",
      isFinal: node.isFinal,
      isActive: (node as any).is_active !== false,
      profileCode: mappings[node.code] || ""
    });
    setIsModalOpen(true);
  };

  // Submit Modal
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!modalData.code.trim()) {
      setErrorMsg("카테고리 코드를 기입하십시오.");
      return;
    }
    if (!modalData.nameKo.trim()) {
      setErrorMsg("카테고리 한글 이름을 입력하십시오.");
      return;
    }

    startTransition(async () => {
      try {
        // 1. 카테고리 UPSERT
        const resCat = await saveCategory({
          code: modalData.code,
          nameKo: modalData.nameKo,
          nameEn: modalData.nameEn || null,
          depth: modalData.depth,
          parentCode: modalData.parentCode || null,
          isFinal: modalData.isFinal,
          isActive: modalData.isActive
        });

        if (!resCat.success) {
          setErrorMsg(resCat.error || "카테고리 저장에 실패했습니다.");
          return;
        }

        // 2. 최종 카테고리일 시 프로필 매핑 처리
        if (modalData.isFinal) {
          const resMap = await saveCategoryProfileMapping(modalData.code, modalData.profileCode || null);
          if (!resMap.success) {
            setErrorMsg(resMap.error || "프로필 매핑 연동에 실패했습니다.");
            return;
          }
          setMappings(prev => ({ ...prev, [modalData.code]: modalData.profileCode }));
        } else {
          const resMap = await saveCategoryProfileMapping(modalData.code, null); // Clear mapping
          if (!resMap.success) {
            setErrorMsg(resMap.error || "프로필 매핑 해제에 실패했습니다.");
            return;
          }
        }

        // 3. 모달 창을 즉시 닫고, RSC 스트리밍 응답이 브라우저에 안전하게 주입된 후에 새로고침 처리 (RSC Aborted 방지)
        setIsModalOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 150);
      } catch (err: any) {
        setErrorMsg(err.message || "작업을 완료할 수 없습니다.");
      }
    });
  };

  // Delete Category
  const handleDeleteCategory = async (code: string) => {
    if (!confirm(`정말로 이 카테고리(${code})를 삭제/비활성화하시겠습니까?`)) return;

    startTransition(async () => {
      try {
        await deleteCategory(code);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "삭제 실패");
      }
    });
  };

  // 1Depth, 2Depth 납작 목록
  const getFlatCategoriesByDepth = (targetDepth: number): Array<{ code: string; nameKo: string }> => {
    const list: Array<{ code: string; nameKo: string }> = [];
    const traverse = (nodes: CategoryNode[]) => {
      nodes.forEach(n => {
        const d = (n as any).depth || (n.isFinal ? 3 : 1); // approximate
        if (d === targetDepth) {
          list.push({ code: n.code, nameKo: n.nameKo });
        }
        if (n.children && n.children.length > 0) {
          traverse(n.children);
        }
      });
    };
    traverse(tree);
    return list;
  };

  const renderNode = (node: CategoryNode, depth = 0) => {
    const isExpanded = !!expanded[node.code];
    const hasChildren = node.children && node.children.length > 0;
    const isActive = (node as any).is_active !== false; 
    const mappedProfile = mappings[node.code];

    return (
      <div key={node.code} className="select-none">
        <div 
          className={`
            flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-200 mb-1.5
            ${depth === 0 ? 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800' : ''}
            ${depth === 1 ? 'bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850/50 ml-6' : ''}
            ${depth === 2 ? 'bg-zinc-50/20 dark:bg-zinc-900/10 border border-zinc-100 dark:border-zinc-850/20 ml-12' : ''}
            ${!isActive ? 'opacity-50 line-through text-zinc-400 dark:text-zinc-500' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button 
                onClick={() => handleToggleExpand(node.code)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              </div>
            )}

            <div className="flex flex-col">
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {node.nameKo}
                {node.nameEn && (
                  <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">({node.nameEn})</span>
                )}
                {mappedProfile && (
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 text-[9px] font-bold px-2 py-0.2 rounded shadow-sm">
                    🧬 {profiles.find(p => p.code === mappedProfile)?.name_ko || mappedProfile}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 tracking-wider">
                {node.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className={`
              text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border
              ${depth === 0 ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700' : ''}
              ${depth === 1 ? 'bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-350 border-zinc-200/60 dark:border-zinc-800/60' : ''}
              ${depth === 2 ? 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-500 border-zinc-200/40 dark:border-zinc-900/40' : ''}
            `}>
              Depth {depth + 1}
            </span>

            {node.isFinal && (
              <span className="text-[9px] px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">
                최종분류
              </span>
            )}

            {/* 개별 CUD 편집 툴바 */}
            <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-3">
              {depth < 2 && (
                <button
                  onClick={() => handleOpenCreate(node.code, depth + 2)}
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-900 dark:border-zinc-100 rounded text-[10px] font-bold cursor-pointer transition-all duration-150"
                  title="하위 카테고리 신설"
                >
                  + 하위
                </button>
              )}
              <button
                onClick={() => handleOpenEdit(node.code as any ? node : node, depth + 1)}
                className="px-2 py-1 bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-750 rounded text-[10px] font-bold cursor-pointer transition-all duration-150"
              >
                수정
              </button>
              <button
                onClick={() => handleDeleteCategory(node.code)}
                className="px-2 py-1 bg-white hover:bg-rose-50/50 dark:bg-zinc-800 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-450 border border-rose-200 dark:border-rose-900/30 rounded text-[10px] font-bold cursor-pointer transition-all duration-150"
              >
                삭제
              </button>
            </div>

            {/* 활성/비활성 스위치 */}
            <button
              id={`toggle-category-${node.code}`}
              disabled={isPending}
              onClick={() => handleActiveToggle(node.code, isActive)}
              className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                  transition duration-200 ease-in-out
                  ${isActive ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="transition-all duration-300">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 최상단 추가 제어판 */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => handleOpenCreate("", 1)}
          className="bg-[#18181b] hover:bg-[#27272a] dark:bg-[#f4f4f5] dark:hover:bg-[#e4e4e7] text-white dark:text-[#09090b] border border-[#18181b] dark:border-[#f4f4f5] font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          신규 대분류(1Depth) 카테고리 신설
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {tree.map((root) => renderNode(root))}
      </div>

      {/* CUD 모달 다이얼로그 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn text-zinc-900 dark:text-zinc-100">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/20">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>📁 {editingNode ? "카테고리 마스터 편집" : "신규 카테고리 등록"}</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Category Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500">카테고리 코드 (PK, 대문자 영문 고유값)</label>
                <input
                  type="text"
                  placeholder="예: SK_SUNSCREEN"
                  disabled={!!editingNode || isPending}
                  value={modalData.code}
                  onChange={(e) => setModalData(prev => ({ ...prev, code: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              {/* Korean Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500">한글 명칭</label>
                <input
                  type="text"
                  placeholder="예: 선스크린"
                  disabled={isPending}
                  value={modalData.nameKo}
                  onChange={(e) => setModalData(prev => ({ ...prev, nameKo: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* English Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500">영문 명칭</label>
                <input
                  type="text"
                  placeholder="예: Sunscreen"
                  disabled={isPending}
                  value={modalData.nameEn}
                  onChange={(e) => setModalData(prev => ({ ...prev, nameEn: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Depth 및 Parent Code (신규 추가 시에만 선택 가능) */}
              {!editingNode && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500">Depth 계층구조</label>
                    <select
                      value={modalData.depth}
                      disabled={isPending}
                      onChange={(e) => setModalData(prev => ({ 
                        ...prev, 
                        depth: Number(e.target.value),
                        isFinal: Number(e.target.value) === 3
                      }))}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                    >
                      <option value={1}>1Depth 대분류</option>
                      <option value={2}>2Depth 중분류</option>
                      <option value={3}>3Depth 소분류</option>
                    </select>
                  </div>

                  {modalData.depth > 1 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-500">부모 카테고리 선택</label>
                      <select
                        value={modalData.parentCode}
                        disabled={isPending}
                        onChange={(e) => setModalData(prev => ({ ...prev, parentCode: e.target.value }))}
                        className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                      >
                        <option value="">-- 부모 선택 --</option>
                        {getFlatCategoriesByDepth(modalData.depth - 1).map(p => (
                          <option key={p.code} value={p.code}>{p.nameKo} ({p.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Is Final Category */}
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold">최종 카테고리 여부</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">제품에 직접 맵핑되는 최하위 3Depth 계층일 경우 켭니다.</span>
                </div>
                <input
                  type="checkbox"
                  checked={modalData.isFinal}
                  disabled={isPending}
                  onChange={(e) => setModalData(prev => ({ ...prev, isFinal: e.target.checked }))}
                  className="rounded text-indigo-650 focus:ring-indigo-500 bg-white dark:bg-zinc-950 border-zinc-300 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Profile Mapping (Only show if isFinal is true) */}
              {modalData.isFinal && (
                <div className="flex flex-col gap-1.5 p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                  <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400">🧬 제품군 속성 프로필 매핑</label>
                  <select
                    value={modalData.profileCode}
                    disabled={isPending}
                    onChange={(e) => setModalData(prev => ({ ...prev, profileCode: e.target.value }))}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- 매핑 안함 --</option>
                    {profiles.map(p => (
                      <option key={p.code} value={p.code}>{p.name_ko} ({p.code})</option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="px-5 py-2.5 bg-[#18181b] hover:bg-[#27272a] dark:bg-[#f4f4f5] dark:hover:bg-[#e4e4e7] text-white dark:text-[#09090b] border border-[#18181b] dark:border-[#f4f4f5] text-xs font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer transition-all duration-150"
                >
                  {isPending ? "저장 중..." : "카테고리 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

