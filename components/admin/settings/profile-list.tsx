"use client";

import { useState, useTransition } from "react";
import { toggleProfileActive, type ProfileSummaryItem } from "@/lib/product/attribute-actions";

export function ProfileList({ initialProfiles }: { initialProfiles: ProfileSummaryItem[] }) {
  const [profiles, setProfiles] = useState<ProfileSummaryItem[]>(initialProfiles);
  const [isPending, startTransition] = useTransition();

  const handleActiveToggle = async (code: string, currentActive: boolean) => {
    const updatedActive = !currentActive;
    
    // Optimistic Update
    setProfiles((prev) => 
      prev.map((p) => p.code === code ? { ...p, isActive: updatedActive } : p)
    );

    startTransition(async () => {
      try {
        await toggleProfileActive(code, updatedActive);
      } catch (err) {
        console.error("프로필 활성 토글 에러", err);
        // revert
        setProfiles((prev) => 
          prev.map((p) => p.code === code ? { ...p, isActive: currentActive } : p)
        );
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {profiles.map((p) => {
        return (
          <div 
            key={p.code}
            className={`
              bg-slate-950/40 border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:scale-[1.01] hover:bg-slate-950/60
              ${p.isActive ? 'border-slate-800' : 'border-slate-900 opacity-60'}
            `}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex flex-col">
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                    {p.nameKo}
                    {p.nameEn && (
                      <span className="text-xs font-normal text-slate-400">({p.nameEn})</span>
                    )}
                  </h3>
                  <span className="text-xs font-mono text-slate-500 tracking-wide mt-0.5">{p.code}</span>
                </div>

                {/* 활성 토글 */}
                <button
                  id={`toggle-profile-${p.code}`}
                  disabled={isPending}
                  onClick={() => handleActiveToggle(p.code, p.isActive)}
                  className={`
                    relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                    transition-colors duration-200 ease-in-out focus:outline-none
                    ${p.isActive ? 'bg-emerald-500' : 'bg-slate-850'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 
                      transition duration-200 ease-in-out
                      ${p.isActive ? 'translate-x-4' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed min-h-[32px] line-clamp-2">
                {p.description || "이 프로필에 대한 상세 설명이 지정되지 않았습니다."}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-900/60 text-[11px] text-slate-400">
              <span className="bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                📂 카테고리 매핑 <strong className="text-slate-200">{p.categoriesCount}</strong>개
              </span>
              <span className="bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                ⚙️ 소속 속성 <strong className="text-slate-200">{p.attributesCount}</strong>개
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
