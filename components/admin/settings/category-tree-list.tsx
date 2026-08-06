"use client";

import { useState, useTransition } from "react";
import { toggleCategoryActive, type CategoryNode } from "@/lib/product/attribute-actions";

export function CategoryTreeList({ initialTree }: { initialTree: CategoryNode[] }) {
  const [tree, setTree] = useState<CategoryNode[]>(initialTree);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const handleToggleExpand = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleActiveToggle = async (code: string, currentActive: boolean) => {
    // Optimistic Update
    const updatedActive = !currentActive;
    
    const updateNodeInTree = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.map((node) => {
        if (node.code === code) {
          return { ...node, is_active: updatedActive } as any; // update active
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
        // revert on failure
        setTree((prev) => updateNodeInTree(prev));
      }
    });
  };

  const renderNode = (node: CategoryNode, depth = 0) => {
    const isExpanded = !!expanded[node.code];
    const hasChildren = node.children && node.children.length > 0;
    
    // Check active status fallback
    const isActive = (node as any).is_active !== false; 

    return (
      <div key={node.code} className="select-none">
        <div 
          className={`
            flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-200 mb-1.5
            ${depth === 0 ? 'bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/50' : ''}
            ${depth === 1 ? 'bg-slate-900/40 hover:bg-slate-800/30 border border-slate-900/50 ml-6' : ''}
            ${depth === 2 ? 'bg-slate-900/10 hover:bg-slate-800/10 border border-slate-900/20 ml-12' : ''}
            ${!isActive ? 'opacity-50 line-through text-slate-500' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button 
                onClick={() => handleToggleExpand(node.code)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
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
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              </div>
            )}

            <div className="flex flex-col">
              <span className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                {node.nameKo}
                {node.nameEn && (
                  <span className="text-xs font-normal text-slate-400">({node.nameEn})</span>
                )}
              </span>
              <span className="text-[11px] font-mono text-slate-500 tracking-wider">
                {node.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className={`
              text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider
              ${depth === 0 ? 'bg-violet-950/40 text-violet-400 border border-violet-800/30' : ''}
              ${depth === 1 ? 'bg-blue-950/40 text-blue-400 border border-blue-800/30' : ''}
              ${depth === 2 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' : ''}
            `}>
              Depth {depth + 1}
            </span>

            {node.isFinal && (
              <span className="text-[10px] px-2.5 py-0.5 bg-amber-950/30 text-amber-400 border border-amber-800/20 rounded-full font-semibold">
                최종 카테고리
              </span>
            )}

            {/* 활성/비활성 스위치 */}
            <button
              id={`toggle-category-${node.code}`}
              disabled={isPending}
              onClick={() => handleActiveToggle(node.code, isActive)}
              className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950
                ${isActive ? 'bg-emerald-500' : 'bg-slate-700'}
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
    <div className="flex flex-col gap-2">
      {tree.map((root) => renderNode(root))}
    </div>
  );
}
