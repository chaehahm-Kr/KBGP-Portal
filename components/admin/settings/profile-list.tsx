"use client";

import { useState, useEffect, useTransition } from "react";
import { 
  toggleProfileActive, 
  saveAttributeProfile, 
  saveProfileAttributeMappings,
  type ProfileSummaryItem 
} from "@/lib/product/attribute-actions";
import { createClient } from "@/lib/supabase/client";

interface SimpleAttribute {
  code: string;
  name_ko: string;
  scope: string;
}

export function ProfileList({ initialProfiles }: { initialProfiles: ProfileSummaryItem[] }) {
  const [profiles, setProfiles] = useState<ProfileSummaryItem[]>(initialProfiles);
  const [isPending, startTransition] = useTransition();

  // All attributes for mapping
  const [allAttributes, setAllAttributes] = useState<SimpleAttribute[]>([]);

  // Modal states for Profile Creation/Editing
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileSummaryItem | null>(null);
  const [profileData, setProfileData] = useState({
    code: "",
    nameKo: "",
    nameEn: "",
    isActive: true
  });

  // Modal states for Attribute Mapping
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingTargetProfile, setMappingTargetProfile] = useState<ProfileSummaryItem | null>(null);
  const [checkedAttributes, setCheckedAttributes] = useState<Record<string, { isRequired: boolean; order: number }>>({}); // attr_code -> mapping options
  
  const [errorMsg, setErrorMsg] = useState("");

  // Load all attributes from DB on mount (only PROFILE scope ones make sense to map, but load all just in case)
  useEffect(() => {
    async function loadAttributes() {
      const supabase = createClient();
      const { data } = await supabase
        .from("attributes")
        .select("code, name_ko, scope")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (data) setAllAttributes(data);
    }
    loadAttributes();
  }, []);

  const handleActiveToggle = async (code: string, currentActive: boolean) => {
    const updatedActive = !currentActive;
    
    setProfiles((prev) => 
      prev.map((p) => p.code === code ? { ...p, isActive: updatedActive } : p)
    );

    startTransition(async () => {
      try {
        await toggleProfileActive(code, updatedActive);
      } catch (err) {
        console.error("프로필 활성 토글 에러", err);
        setProfiles((prev) => 
          prev.map((p) => p.code === code ? { ...p, isActive: currentActive } : p)
        );
      }
    });
  };

  const handleOpenCreate = () => {
    setErrorMsg("");
    setEditingProfile(null);
    setProfileData({
      code: "",
      nameKo: "",
      nameEn: "",
      isActive: true
    });
    setIsProfileModalOpen(true);
  };

  const handleOpenEdit = (p: ProfileSummaryItem) => {
    setErrorMsg("");
    setEditingProfile(p);
    setProfileData({
      code: p.code,
      nameKo: p.nameKo,
      nameEn: p.nameEn || "",
      isActive: p.isActive
    });
    setIsProfileModalOpen(true);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!profileData.code.trim()) {
      setErrorMsg("프로필 코드를 입력하십시오.");
      return;
    }
    if (!profileData.nameKo.trim()) {
      setErrorMsg("프로필 한글 이름을 입력하십시오.");
      return;
    }

    startTransition(async () => {
      try {
        await saveAttributeProfile({
          code: profileData.code,
          nameKo: profileData.nameKo,
          nameEn: profileData.nameEn || null,
          isActive: profileData.isActive
        });
        window.location.reload();
      } catch (err: any) {
        setErrorMsg(err.message || "프로필 저장 실패");
      }
    });
  };

  // Open mapping modal and load existing associations
  const handleOpenMapping = async (p: ProfileSummaryItem) => {
    setErrorMsg("");
    setMappingTargetProfile(p);
    
    const supabase = createClient();
    const { data } = await supabase
      .from("profile_attributes")
      .select("attribute_code, is_required_override, display_order")
      .eq("profile_code", p.code)
      .eq("is_active", true);

    const initialChecked: Record<string, { isRequired: boolean; order: number }> = {};
    if (data) {
      data.forEach((row) => {
        initialChecked[row.attribute_code] = {
          isRequired: !!row.is_required_override,
          order: row.display_order || 10
        };
      });
    }
    setCheckedAttributes(initialChecked);
    setIsMappingModalOpen(true);
  };

  const handleToggleAttributeChecked = (code: string) => {
    setCheckedAttributes((prev) => {
      const copy = { ...prev };
      if (copy[code]) {
        delete copy[code];
      } else {
        copy[code] = { isRequired: false, order: (Object.keys(copy).length + 1) * 10 };
      }
      return copy;
    });
  };

  const handleMappingOptionChange = (code: string, key: "isRequired" | "order", val: any) => {
    setCheckedAttributes((prev) => {
      if (!prev[code]) return prev;
      return {
        ...prev,
        [code]: {
          ...prev[code],
          [key]: val
        }
      };
    });
  };

  const handleMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingTargetProfile) return;

    setErrorMsg("");

    const payload = Object.entries(checkedAttributes).map(([code, config]) => ({
      attributeCode: code,
      isRequiredOverride: config.isRequired,
      displayOrder: config.order
    }));

    startTransition(async () => {
      try {
        await saveProfileAttributeMappings(mappingTargetProfile.code, payload);
        window.location.reload();
      } catch (err: any) {
        setErrorMsg(err.message || "매핑 저장 실패");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 최상단 제어 패널 */}
      <div className="flex justify-end">
        <button
          onClick={handleOpenCreate}
          className="bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          신규 속성 프로필 생성
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((p) => {
          return (
            <div 
              key={p.code}
              className={`
                bg-zinc-50 dark:bg-zinc-950/40 border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:scale-[1.01] hover:bg-zinc-100/10
                ${p.isActive ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-300 dark:border-zinc-900 opacity-60'}
              `}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-col">
                    <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-100 flex items-center gap-1.5">
                      {p.nameKo}
                      {p.nameEn && (
                        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">({p.nameEn})</span>
                      )}
                    </h3>
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 tracking-wide mt-0.5">{p.code}</span>
                  </div>

                  {/* 활성 토글 */}
                  <button
                    id={`toggle-profile-${p.code}`}
                    disabled={isPending}
                    onClick={() => handleActiveToggle(p.code, p.isActive)}
                    className={`
                      relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                      transition-colors duration-200 ease-in-out focus:outline-none
                      ${p.isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}
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

                <p className="text-xs text-zinc-450 dark:text-zinc-400 leading-relaxed min-h-[32px] line-clamp-2 mt-1">
                  {p.description || "해당 프로필 카테고리의 스펙 명세가 관리되고 있습니다."}
                </p>
              </div>

              {/* 매핑 요약 정보 및 개별 제어 */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-900/60">
                <div className="flex items-center gap-2 text-[10px] text-zinc-450 dark:text-zinc-400">
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-bold">
                    📂 {p.categoriesCount}개 분류
                  </span>
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-bold">
                    ⚙️ {p.attributesCount}개 속성
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenMapping(p)}
                    className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 text-[10px] font-bold rounded cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-900/60"
                  >
                    소속 속성 연결 ({p.attributesCount})
                  </button>
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-350 text-[10px] font-bold rounded cursor-pointer"
                  >
                    수정
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1. 프로필 정보 편집 모달 */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fadeIn text-zinc-900 dark:text-zinc-100">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/20">
              <h3 className="text-base font-bold">🏷️ {editingProfile ? "프로필 수정" : "신규 프로필 생성"}</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 text-sm font-bold cursor-pointer">닫기</button>
            </div>
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              {errorMsg && <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold">⚠️ {errorMsg}</div>}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">프로필 코드 (대문자 영문 고유값)</label>
                <input
                  type="text"
                  placeholder="예: SK_SUNCARE"
                  disabled={!!editingProfile || isPending}
                  value={profileData.code}
                  onChange={(e) => setProfileData(prev => ({ ...prev, code: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">한글 명칭</label>
                <input
                  type="text"
                  placeholder="예: 선케어"
                  disabled={isPending}
                  value={profileData.nameKo}
                  onChange={(e) => setProfileData(prev => ({ ...prev, nameKo: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500">영문 명칭</label>
                <input
                  type="text"
                  placeholder="예: Suncare"
                  disabled={isPending}
                  value={profileData.nameEn}
                  onChange={(e) => setProfileData(prev => ({ ...prev, nameEn: e.target.value }))}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm w-full"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold cursor-pointer">취소</button>
                <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl cursor-pointer">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 소속 속성 매핑 목록 편집 모달 */}
      {isMappingModalOpen && mappingTargetProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn text-zinc-900 dark:text-zinc-100">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/20">
              <div>
                <h3 className="text-base font-bold">🧬 {mappingTargetProfile.nameKo} 프로필 속성 연동 편집</h3>
                <span className="text-[10px] text-zinc-400 font-mono">{mappingTargetProfile.code}</span>
              </div>
              <button onClick={() => setIsMappingModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 text-sm font-bold cursor-pointer">닫기</button>
            </div>
            
            <form onSubmit={handleMappingSubmit} className="p-6 space-y-4">
              {errorMsg && <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold">⚠️ {errorMsg}</div>}
              
              <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
                이 프로필이 적용되는 카테고리 제품들의 추가 속성 입력 필드로 노출시킬 마스터 속성들을 체크해 주십시오.
              </div>

              {/* Attributes check list with sub-options (Required Override, Order) */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {allAttributes.filter(a => a.scope === "PROFILE").map((attr) => {
                  const isChecked = !!checkedAttributes[attr.code];
                  const cfg = checkedAttributes[attr.code] || { isRequired: false, order: 10 };

                  return (
                    <div 
                      key={attr.code}
                      className={`
                        flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                        ${isChecked ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900' : 'bg-zinc-50 dark:bg-zinc-950/25 border-zinc-200 dark:border-zinc-850'}
                      `}
                    >
                      <div className="flex items-center gap-3 w-1/2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAttributeChecked(attr.code)}
                          className="rounded text-indigo-650 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{attr.name_ko}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{attr.code}</span>
                        </div>
                      </div>

                      {/* Mapping options */}
                      {isChecked && (
                        <div className="flex items-center gap-4 w-1/2 justify-end">
                          {/* Required override */}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              id={`req-override-${attr.code}`}
                              checked={cfg.isRequired}
                              onChange={(e) => handleMappingOptionChange(attr.code, "isRequired", e.target.checked)}
                              className="rounded text-indigo-650 w-3.5 h-3.5 cursor-pointer"
                            />
                            <label htmlFor={`req-override-${attr.code}`} className="text-[10px] font-semibold cursor-pointer">필수 입력 강제</label>
                          </div>

                          {/* Display order override */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-400">정렬 순서:</span>
                            <input
                              type="number"
                              value={cfg.order}
                              onChange={(e) => handleMappingOptionChange(attr.code, "order", Number(e.target.value))}
                              className="w-14 bg-white dark:bg-zinc-950 border border-zinc-350 dark:border-zinc-800 rounded px-1.5 py-0.5 text-xs text-center"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setIsMappingModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold cursor-pointer">취소</button>
                <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl cursor-pointer">매핑 연동 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

