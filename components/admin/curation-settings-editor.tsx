"use client";

import { useState, useTransition } from "react";
import {
  adminUpdateDisplayProgram,
  adminUpdateAPSettings,
  adminCreateDisplayProgram,
  adminCreateAPSettings,
  adminSearchMatchingTags,
  adminCreateMatchingTag,
} from "@/lib/product/admin-actions";

interface DisplayProgram {
  code: string;
  name: string;
  description: string | null;
  min_sku?: number;
  max_sku?: number;
  is_active: boolean;
}

interface MatchingTag {
  id: number;
  tag_code: string;
  name_ko: string;
  name_en: string;
  is_active: boolean;
}

interface ApMatchingTagRelation {
  display_order: number;
  matching_tags: MatchingTag | null;
}

interface AssortmentProfile {
  id: number;
  display_program: string;
  code: string;
  name: string;
  description: string | null;
  target_sku?: number;
  is_active: boolean;
  ap_matching_tags?: ApMatchingTagRelation[];
}

interface Props {
  initialPrograms: DisplayProgram[];
  initialProfiles: AssortmentProfile[];
}

export function CurationSettingsEditor({ initialPrograms, initialProfiles }: Props) {
  const [activeTab, setActiveTab] = useState<"programs" | "profiles">("programs");
  const [programs, setPrograms] = useState<DisplayProgram[]>(initialPrograms);
  const [profiles, setProfiles] = useState<AssortmentProfile[]>(initialProfiles);

  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("START_4FT");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit / Creation States (Split Panel Bindings)
  const [editingProgram, setEditingProgram] = useState<DisplayProgram | null>(null);
  const [editingProfile, setEditingProfile] = useState<AssortmentProfile | null>(null);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Tag editor states
  const [isSearchingTag, setIsSearchingTag] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MatchingTag[]>([]);

  const [newTagNameKo, setNewTagNameKo] = useState("");

  const handleTagSearch = async (query: string) => {
    setTagQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await adminSearchMatchingTags(query);
      setSearchResults(results || []);
    } catch (err) {
      console.error("Tag search failed:", err);
    }
  };

  const handleAddTag = (tag: MatchingTag) => {
    if (!editingProfile) return;
    const currentTags = editingProfile.ap_matching_tags || [];
    if (currentTags.some((rel) => rel.matching_tags?.id === tag.id)) {
      return;
    }
    const updatedTags = [
      ...currentTags,
      {
        display_order: currentTags.length,
        matching_tags: tag,
      },
    ];
    setEditingProfile({
      ...editingProfile,
      ap_matching_tags: updatedTags,
    });
    setTagQuery("");
    setSearchResults([]);
    setIsSearchingTag(false);
  };

  const handleRemoveTag = (tagId: number) => {
    if (!editingProfile) return;
    const currentTags = editingProfile.ap_matching_tags || [];
    const updatedTags = currentTags
      .filter((rel) => rel.matching_tags?.id !== tagId)
      .map((rel, idx) => ({ ...rel, display_order: idx }));
    setEditingProfile({
      ...editingProfile,
      ap_matching_tags: updatedTags,
    });
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagNameKo.trim()) {
      alert("태그 이름을 입력해야 합니다.");
      return;
    }
    try {
      const newTags = await adminCreateMatchingTag({
        name: newTagNameKo.trim(),
      });
      if (newTags && newTags.length > 0) {
        if (!editingProfile) return;
        let currentTags = editingProfile.ap_matching_tags || [];

        for (const tag of newTags) {
          if (!currentTags.some((rel) => rel.matching_tags?.id === tag.id)) {
            currentTags = [
              ...currentTags,
              {
                display_order: currentTags.length,
                matching_tags: tag,
              },
            ];
          }
        }

        setEditingProfile({
          ...editingProfile,
          ap_matching_tags: currentTags,
        });

        setNewTagNameKo("");
        setIsCreatingTag(false);
      }
    } catch (err: any) {
      alert(err.message || "태그 생성 실패");
    }
  };

  // Program creation form states
  const [newProgCode, setNewProgCode] = useState("");
  const [newProgName, setNewProgName] = useState("");
  const [newProgDesc, setNewProgDesc] = useState("");
  const [newProgMinSku, setNewProgMinSku] = useState(0);
  const [newProgMaxSku, setNewProgMaxSku] = useState(0);
  const [newProgActive, setNewProgActive] = useState(true);

  // AP creation form states
  const [newApProgram, setNewApProgram] = useState("START_4FT");
  const [newApCode, setNewApCode] = useState("");
  const [newApName, setNewApName] = useState("");
  const [newApDesc, setNewApDesc] = useState("");
  const [newApTargetSku, setNewApTargetSku] = useState(10);
  const [newApActive, setNewApActive] = useState(true);

  // Custom sort: START -> GROW -> EXPAND, then others
  const sortPrograms = (list: DisplayProgram[]) => {
    const order: Record<string, number> = {
      START_4FT: 1,
      GROW_8FT: 2,
      EXPAND_12FT: 3,
    };
    return [...list].sort((a, b) => {
      const orderA = order[a.code] || 999;
      const orderB = order[b.code] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.code.localeCompare(b.code);
    });
  };

  const sortedPrograms = sortPrograms(programs);

  // Handle Create Program
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgCode.trim() || !newProgName.trim()) {
      setMessage({ type: "error", text: "프로그램 식별 코드와 명칭은 필수입니다." });
      return;
    }

    const cleanCode = newProgCode.trim().toUpperCase();

    if (programs.some((p) => p.code === cleanCode)) {
      setMessage({ type: "error", text: `이미 존재하는 식별 코드입니다: ${cleanCode}` });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await adminCreateDisplayProgram({
          code: cleanCode,
          name: newProgName,
          description: newProgDesc,
          min_sku: newProgMinSku,
          max_sku: newProgMaxSku,
          is_active: newProgActive,
        });

        if (res.success) {
          const addedProgram: DisplayProgram = {
            code: cleanCode,
            name: newProgName,
            description: newProgDesc,
            min_sku: newProgMinSku,
            max_sku: newProgMaxSku,
            is_active: newProgActive,
          };

          setPrograms((prev) => [...prev, addedProgram]);

          // Sync default APs (AP-01 ~ AP-06) locally
          const addedProfiles: AssortmentProfile[] = [
            { id: Date.now() + 1, display_program: cleanCode, code: "AP-01", name: `${newProgName} - 기본 구성 01`, description: "표준형 Assortment 01", target_sku: 10, is_active: true },
            { id: Date.now() + 2, display_program: cleanCode, code: "AP-02", name: `${newProgName} - 기본 구성 02`, description: "표준형 Assortment 02", target_sku: 10, is_active: true },
            { id: Date.now() + 3, display_program: cleanCode, code: "AP-03", name: `${newProgName} - 기본 구성 03`, description: "표준형 Assortment 03", target_sku: 10, is_active: true },
            { id: Date.now() + 4, display_program: cleanCode, code: "AP-04", name: `${newProgName} - 기본 구성 04`, description: "표준형 Assortment 04", target_sku: 10, is_active: true },
            { id: Date.now() + 5, display_program: cleanCode, code: "AP-05", name: `${newProgName} - 기본 구성 05`, description: "표준형 Assortment 05", target_sku: 10, is_active: true },
            { id: Date.now() + 6, display_program: cleanCode, code: "AP-06", name: `${newProgName} - 기본 구성 06`, description: "표준형 Assortment 06", target_sku: 10, is_active: true },
          ];
          setProfiles((prev) => [...prev, ...addedProfiles]);

          setMessage({ type: "success", text: `Display Program ${cleanCode}이 정상 등록되었습니다.` });
          setIsCreatingProgram(false);
          setNewProgCode("");
          setNewProgName("");
          setNewProgDesc("");
          setNewProgMinSku(0);
          setNewProgMaxSku(0);
          setNewProgActive(true);
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "프로그램 생성 실패" });
      }
    });
  };

  // Program Update
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await adminUpdateDisplayProgram(editingProgram.code, {
          name: editingProgram.name,
          description: editingProgram.description || "",
          min_sku: editingProgram.min_sku || 0,
          max_sku: editingProgram.max_sku || 0,
          is_active: editingProgram.is_active,
        });

        if (res.success) {
          setPrograms((prev) =>
            prev.map((p) => (p.code === editingProgram.code ? editingProgram : p))
          );
          if (!editingProgram.is_active) {
            setProfiles((prev) =>
              prev.map((ap) =>
                ap.display_program === editingProgram.code ? { ...ap, is_active: false } : ap
              )
            );
          }
          setMessage({ type: "success", text: `${editingProgram.name} 설정이 저장되었습니다.` });
          setEditingProgram(null);
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "설정 저장 실패" });
      }
    });
  };

  // AP Creation
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApCode.trim() || !newApName.trim()) {
      setMessage({ type: "error", text: "AP Code와 이름은 필수 항목입니다." });
      return;
    }

    const cleanApCode = newApCode.trim().toUpperCase();

    // Check duplicate code under program
    if (profiles.some((p) => p.display_program === newApProgram && p.code === cleanApCode)) {
      setMessage({ type: "error", text: `해당 프로그램에 이미 존재하는 AP Code입니다: ${cleanApCode}` });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await adminCreateAPSettings({
          display_program: newApProgram,
          code: cleanApCode,
          name: newApName,
          description: newApDesc,
          target_sku: newApTargetSku,
          is_active: newApActive,
        });

        if (res.success) {
          const addedAp: AssortmentProfile = {
            id: Date.now(), // Temp unique numeric key for local list
            display_program: newApProgram,
            code: cleanApCode,
            name: newApName,
            description: newApDesc,
            target_sku: newApTargetSku,
            is_active: newApActive,
          };
          setProfiles((prev) => [...prev, addedAp]);
          setMessage({ type: "success", text: `AP ${cleanApCode}가 성공적으로 추가되었습니다.` });
          setIsCreatingProfile(false);
          setNewApCode("");
          setNewApName("");
          setNewApDesc("");
          setNewApTargetSku(10);
          setNewApActive(true);
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "AP 추가 실패" });
      }
    });
  };

  // AP Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const tagIds = editingProfile.ap_matching_tags
          ?.map((rel) => rel.matching_tags?.id)
          .filter((id): id is number => typeof id === "number");

        const res = await adminUpdateAPSettings(
          editingProfile.id,
          {
            name: editingProfile.name,
            description: editingProfile.description || "",
            target_sku: editingProfile.target_sku || 0,
            is_active: editingProfile.is_active,
          },
          tagIds
        );

        if (res.success) {
          setProfiles((prev) =>
            prev.map((p) => (p.id === editingProfile.id ? editingProfile : p))
          );
          setMessage({ type: "success", text: `AP ${editingProfile.code} 설정이 저장되었습니다.` });
          setEditingProfile(null);
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "설정 저장 실패" });
      }
    });
  };

  const getProgramBadgeText = (code: string) => {
    switch (code) {
      case "START_4FT":
        return "START · 4FT";
      case "GROW_8FT":
        return "GROW · 8FT";
      case "EXPAND_12FT":
        return "EXPAND · 12FT";
      default:
        return code;
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Message */}
      {message && (
        <div
          className={`p-4 rounded-lg text-xs font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
              : "bg-rose-50 text-rose-800 border border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => {
            setActiveTab("programs");
            setMessage(null);
            setEditingProgram(null);
            setEditingProfile(null);
            setIsCreatingProgram(false);
            setIsCreatingProfile(false);
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "programs"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          A. Display Programs
        </button>
        <button
          onClick={() => {
            setActiveTab("profiles");
            setMessage(null);
            setEditingProgram(null);
            setEditingProfile(null);
            setIsCreatingProgram(false);
            setIsCreatingProfile(false);
            setNewApProgram(selectedProgramFilter); // Set program context
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "profiles"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          B. Assortment Profiles (AP)
        </button>
      </div>

      {/* Main 2-Column Split View Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column (Width: 3/5) */}
        <div className="w-full lg:w-3/5 space-y-4">
          {activeTab === "programs" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-850">
                <span className="text-[11px] font-bold text-zinc-500">등록 프로그램 ({programs.length}개)</span>
                <button
                  onClick={() => {
                    setIsCreatingProgram(true);
                    setEditingProgram(null);
                    setEditingProfile(null);
                    setIsCreatingProfile(false);
                    setMessage(null);
                  }}
                  className="bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-white font-bold text-[11px] px-3.5 py-1.5 rounded transition-all shadow-sm"
                >
                  + 신규 프로그램 추가
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {sortedPrograms.map((prog) => {
                  const isSelected = editingProgram?.code === prog.code;
                  return (
                    <div
                      key={prog.code}
                      onClick={() => {
                        setEditingProgram(prog);
                        setEditingProfile(null);
                        setIsCreatingProgram(false);
                        setIsCreatingProfile(false);
                        setMessage(null);
                      }}
                      className={`rounded-xl border p-5 bg-white shadow-sm dark:bg-zinc-900 flex items-start justify-between cursor-pointer transition-all hover:border-zinc-400 ${
                        isSelected
                          ? "border-zinc-950 ring-1 ring-zinc-950 dark:border-white dark:ring-white"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="space-y-2 flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                            {prog.name}
                          </h4>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              prog.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900"
                                : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-600 dark:border-zinc-850"
                            }`}
                          >
                            {prog.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                          {prog.description || "설명이 등록되지 않았습니다."}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-zinc-400">
                          <span className="font-mono bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded">
                            Code: {prog.code}
                          </span>
                          <span>
                            Target SKU 가이드: <strong>{prog.min_sku ?? 0} ~ {prog.max_sku ?? 0} SKU</strong>
                          </span>
                        </div>
                      </div>
                      <span className="text-zinc-350 text-xs font-bold shrink-0 self-center">편집 ➔</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "profiles" && (
            <div className="space-y-4">
              {/* Program filter header */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase px-2">프로그램 필터:</span>
                  {programs.map((p) => (
                    <button
                      key={p.code}
                      onClick={() => {
                        setSelectedProgramFilter(p.code);
                        setNewApProgram(p.code);
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                        selectedProgramFilter === p.code
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                          : "text-zinc-650 hover:bg-zinc-150/40 dark:text-zinc-400"
                      }`}
                    >
                      {getProgramBadgeText(p.code)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setIsCreatingProfile(true);
                    setEditingProfile(null);
                    setEditingProgram(null);
                    setIsCreatingProgram(false);
                    setNewApProgram(selectedProgramFilter);
                    setMessage(null);
                  }}
                  className="bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-white font-bold text-[11px] px-3.5 py-1.5 rounded transition-all shadow-sm shrink-0"
                >
                  + 신규 AP 추가
                </button>
              </div>

              {/* Profiles Table */}
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <th className="p-3 font-bold text-zinc-550 w-20">AP Code</th>
                      <th className="p-3 font-bold text-zinc-555">AP 명칭 (Name) & Target SKU</th>
                      <th className="p-3 font-bold text-zinc-550 w-20">Status</th>
                      <th className="p-3 font-bold text-zinc-550 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles
                      .filter((p) => p.display_program === selectedProgramFilter)
                      .map((prof) => {
                        const isSelected = editingProfile?.id === prof.id;
                        return (
                          <tr
                            key={prof.id}
                            onClick={() => {
                              setEditingProfile(prof);
                              setEditingProgram(null);
                              setIsCreatingProgram(false);
                              setIsCreatingProfile(false);
                              setMessage(null);
                              setIsSearchingTag(false);
                              setIsCreatingTag(false);
                              setTagQuery("");
                              setSearchResults([]);
                              setNewTagNameKo("");
                            }}
                            className={`border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50/20 dark:hover:bg-zinc-950/20 cursor-pointer ${
                              isSelected ? "bg-zinc-50/70 dark:bg-zinc-800/40" : ""
                            }`}
                          >
                            <td className="p-3 font-mono font-bold text-zinc-900 dark:text-white">
                              {prof.code}
                            </td>
                            <td className="p-3">
                              <div className="flex items-baseline gap-2">
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{prof.name}</span>
                                <span className="text-[10px] text-zinc-400 font-semibold bg-zinc-50 dark:bg-zinc-950 px-1.5 py-0.5 rounded">
                                  목표: {prof.target_sku ?? 0} SKU
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                                {prof.description || "설명 없음"}
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                  prof.is_active
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900"
                                    : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-600 dark:border-zinc-850"
                                }`}
                              >
                                {prof.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-[10px] font-bold text-indigo-650 hover:underline dark:text-indigo-400">
                                편집 ➔
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Width: 2/5 - Detail Editing Form) */}
        <div className="w-full lg:w-2/5 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm min-h-[380px] flex flex-col justify-between">
          {/* Edit Program Form */}
          {editingProgram && !isCreatingProgram && (
            <form onSubmit={handleSaveProgram} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b pb-2 dark:border-zinc-800 mb-4">
                  Display Program 설정 편집
                </h3>
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">프로그램명</label>
                    <input
                      type="text"
                      value={editingProgram.name}
                      onChange={(e) =>
                        setEditingProgram({ ...editingProgram, name: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-semibold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">프로그램 식별 코드</label>
                    <span className="block p-2 text-xs font-mono font-bold bg-zinc-150/40 dark:bg-zinc-950 rounded text-zinc-500 border border-zinc-200 dark:border-zinc-850">
                      {editingProgram.code} (식별자 불변)
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">상세 설명</label>
                    <textarea
                      value={editingProgram.description || ""}
                      onChange={(e) =>
                        setEditingProgram({ ...editingProgram, description: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 h-24 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">최소 SKU 수</label>
                      <input
                        type="number"
                        value={editingProgram.min_sku ?? 0}
                        onChange={(e) =>
                          setEditingProgram({ ...editingProgram, min_sku: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded border border-zinc-200 dark:border-zinc-855 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-bold"
                        min="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">최대 SKU 수</label>
                      <input
                        type="number"
                        value={editingProgram.max_sku ?? 0}
                        onChange={(e) =>
                          setEditingProgram({ ...editingProgram, max_sku: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded border border-zinc-200 dark:border-zinc-855 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-bold"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="edit_prog_active"
                      checked={editingProgram.is_active}
                      onChange={(e) =>
                        setEditingProgram({ ...editingProgram, is_active: e.target.checked })
                      }
                      className="rounded border-zinc-300 accent-zinc-950 dark:accent-white cursor-pointer"
                    />
                    <label
                      htmlFor="edit_prog_active"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      프로그램 활성화 (Active Status)
                    </label>
                  </div>
                  {!editingProgram.is_active && (
                    <p className="text-[9.5px] text-amber-600 dark:text-amber-400 leading-normal">
                      * 비활성화 시 이 프로그램 하위의 모든 AP(Assortment Profiles)가 일괄 비활성화됩니다.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingProgram(null)}
                  className="px-3 py-1.5 text-xs font-bold rounded border hover:bg-zinc-150/40"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          )}

          {/* Creation Program Form */}
          {isCreatingProgram && (
            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b pb-2 dark:border-zinc-800 mb-4">
                  신규 Display Program 등록
                </h3>
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">식별 코드 (Code)</label>
                    <input
                      type="text"
                      placeholder="예: PREMIUM_16FT"
                      value={newProgCode}
                      onChange={(e) => setNewProgCode(e.target.value)}
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-mono font-bold uppercase"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">프로그램명 (Name)</label>
                    <input
                      type="text"
                      placeholder="예: PREMIUM · 16FT"
                      value={newProgName}
                      onChange={(e) => setNewProgName(e.target.value)}
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-semibold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">상세 설명</label>
                    <textarea
                      placeholder="프로그램 목적 및 특징 입력"
                      value={newProgDesc}
                      onChange={(e) => setNewProgDesc(e.target.value)}
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 h-24 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">최소 SKU 수</label>
                      <input
                        type="number"
                        value={newProgMinSku}
                        onChange={(e) => setNewProgMinSku(parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-zinc-200 dark:border-zinc-855 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-bold"
                        min="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">최대 SKU 수</label>
                      <input
                        type="number"
                        value={newProgMaxSku}
                        onChange={(e) => setNewProgMaxSku(parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-zinc-200 dark:border-zinc-855 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-bold"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="new_prog_active"
                      checked={newProgActive}
                      onChange={(e) => setNewProgActive(e.target.checked)}
                      className="rounded border-zinc-300 accent-zinc-950 dark:accent-white cursor-pointer"
                    />
                    <label
                      htmlFor="new_prog_active"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      프로그램 활성화 (Active Status)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingProgram(false)}
                  className="px-3 py-1.5 text-xs font-bold rounded border hover:bg-zinc-150/40"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "추가 중..." : "추가"}
                </button>
              </div>
            </form>
          )}

          {/* Edit AP Profile Form */}
          {editingProfile && !isCreatingProfile && !isCreatingProgram && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b pb-2 dark:border-zinc-800 mb-4">
                  Assortment Profile (AP) 설정 편집
                </h3>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Program</label>
                      <span className="block p-2 text-xs font-bold bg-zinc-150/40 dark:bg-zinc-950 rounded text-zinc-500 border border-zinc-200 dark:border-zinc-850">
                        {getProgramBadgeText(editingProfile.display_program)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">AP Code</label>
                      <span className="block p-2 text-xs font-mono font-bold bg-zinc-150/40 dark:bg-zinc-950 rounded text-zinc-500 border border-zinc-200 dark:border-zinc-850">
                        {editingProfile.code}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">AP 이름 (Name)</label>
                    <input
                      type="text"
                      value={editingProfile.name}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, name: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-semibold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Target SKU (목표 상품 개수)</label>
                    <input
                      type="number"
                      value={editingProfile.target_sku ?? 0}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, target_sku: parseInt(e.target.value) || 0 })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-bold"
                      min="0"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">상세 설명 (Description)</label>
                    <textarea
                      value={editingProfile.description || ""}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, description: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-855 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 h-24 resize-none leading-relaxed"
                    />
                  </div>
                  {/* MATCHING TAGS SECTION */}
                  <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-3.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Matching Tags (추천 매칭 태그)
                    </label>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-normal">
                      Growth Simulator에서 매장 특성 및 리테일러 답변과 해당 AP를 매칭하기 위해 사용하는 태그입니다.
                    </p>

                    {/* Tags List */}
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
                      {editingProfile.ap_matching_tags?.map((rel) => {
                        const tag = rel.matching_tags;
                        if (!tag) return null;
                        const displayName = tag.name_ko === tag.name_en ? tag.name_ko : `${tag.name_ko} (${tag.name_en})`;
                        return (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-855 text-zinc-800 dark:text-zinc-200 text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800"
                          >
                            {displayName}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag.id)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-extrabold cursor-pointer text-[10px] w-3 h-3 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-750"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      {(!editingProfile.ap_matching_tags || editingProfile.ap_matching_tags.length === 0) && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic block py-0.5">
                          등록된 매칭 태그가 없습니다.
                        </span>
                      )}
                    </div>

                    {/* Tag Search/Add Panel */}
                    <div className="pt-1.5">
                      {!isSearchingTag ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchingTag(true);
                            setIsCreatingTag(false);
                          }}
                          className="inline-flex items-center text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-250 dark:border-zinc-800 rounded px-2 py-1 bg-zinc-50 dark:bg-zinc-950 transition-colors cursor-pointer"
                        >
                          + 태그 추가
                        </button>
                      ) : (
                        <div className="space-y-2 border border-zinc-200 dark:border-zinc-800 rounded p-2.5 bg-zinc-50/50 dark:bg-zinc-950/20">
                          {!isCreatingTag ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="태그 검색 (예: 피부, 트렌드, HAIR)..."
                                  value={tagQuery}
                                  onChange={(e) => handleTagSearch(e.target.value)}
                                  className="flex-1 rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-1.5 text-[11px] outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSearchingTag(false);
                                    setTagQuery("");
                                    setSearchResults([]);
                                  }}
                                  className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 px-1 py-0.5 cursor-pointer"
                                >
                                  닫기
                                </button>
                              </div>

                              {/* Autocomplete Results */}
                              {tagQuery.trim() !== "" && (
                                <div className="max-h-36 overflow-y-auto border border-zinc-150 dark:border-zinc-850 bg-white dark:bg-zinc-950 rounded shadow-sm text-[11px] divide-y divide-zinc-100 dark:divide-zinc-850">
                                  {searchResults
                                    .filter(t => !(editingProfile.ap_matching_tags || []).some(rel => rel.matching_tags?.id === t.id))
                                    .map((tag) => (
                                      <div
                                        key={tag.id}
                                        onClick={() => handleAddTag(tag)}
                                        className="p-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex justify-between items-center"
                                      >
                                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{tag.name_ko} ({tag.name_en})</span>
                                        <span className="text-[9px] text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{tag.tag_code}</span>
                                      </div>
                                    ))}
                                  {searchResults.filter(t => !(editingProfile.ap_matching_tags || []).some(rel => rel.matching_tags?.id === t.id)).length === 0 && (
                                    <div className="p-2 text-zinc-400 italic text-center">
                                      검색된 기존 태그가 없습니다.
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-between items-center pt-0.5">
                                <span className="text-[9px] text-zinc-400 italic">
                                  기존에 등록된 태그를 검색해 바로 매핑하세요.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsCreatingTag(true)}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                                >
                                  새 태그 만들기
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Create New Tag Form
                            <div className="space-y-2.5">
                              <div className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 pb-1.5 flex justify-between">
                                <span>새 매칭 태그 추가</span>
                                <button
                                  type="button"
                                  onClick={() => setIsCreatingTag(false)}
                                  className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                >
                                  이전
                                </button>
                              </div>
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-semibold text-zinc-400">태그 이름 (한국어 또는 영어)</label>
                                  <input
                                    type="text"
                                    placeholder="예: 피부 트러블 케어 또는 Skin Trouble Care"
                                    value={newTagNameKo}
                                    onChange={(e) => setNewTagNameKo(e.target.value)}
                                    className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950"
                                  />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsCreatingTag(false);
                                      setNewTagNameKo("");
                                    }}
                                    className="px-3 py-1 rounded border text-[10px] font-bold hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCreateNewTag}
                                    className="px-3 py-1 rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-bold hover:opacity-90 cursor-pointer"
                                  >
                                    생성 및 추가
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="edit_ap_active"
                      checked={editingProfile.is_active}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, is_active: e.target.checked })
                      }
                      className="rounded border-zinc-300 accent-zinc-950 dark:accent-white cursor-pointer"
                    />
                    <label
                      htmlFor="edit_ap_active"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      AP 활성화 (Active Status)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-3 py-1.5 text-xs font-bold rounded border hover:bg-zinc-150/40"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          )}

          {/* Creation AP Profile Form */}
          {isCreatingProfile && (
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b pb-2 dark:border-zinc-800 mb-4">
                  신규 Assortment Profile (AP) 등록
                </h3>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Target Program</label>
                      <select
                        value={newApProgram}
                        onChange={(e) => setNewApProgram(e.target.value)}
                        className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-semibold"
                      >
                        {programs.map((p) => (
                          <option key={p.code} value={p.code}>
                            {getProgramBadgeText(p.code)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">AP Code</label>
                      <input
                        type="text"
                        placeholder="예: AP-07"
                        value={newApCode}
                        onChange={(e) => setNewApCode(e.target.value)}
                        className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-mono font-bold uppercase"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">AP 이름 (Name)</label>
                    <input
                      type="text"
                      placeholder="예: START 4FT - 기본 구성 07"
                      value={newApName}
                      onChange={(e) => setNewApName(e.target.value)}
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-semibold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Target SKU (목표 상품 개수)</label>
                    <input
                      type="number"
                      value={newApTargetSku}
                      onChange={(e) => setNewApTargetSku(parseInt(e.target.value) || 0)}
                      className="w-full rounded border border-zinc-200 dark:border-zinc-850 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 font-bold"
                      min="0"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">상세 설명 (Description)</label>
                    <textarea
                      placeholder="AP 상세 용도 및 목적 기술"
                      value={newApDesc}
                      onChange={(e) => setNewApDesc(e.target.value)}
                      className="w-full rounded border border-zinc-200 dark:border-zinc-855 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 h-20 resize-none leading-relaxed"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="new_ap_active"
                      checked={newApActive}
                      onChange={(e) => setNewApActive(e.target.checked)}
                      className="rounded border-zinc-300 accent-zinc-950 dark:accent-white cursor-pointer"
                    />
                    <label
                      htmlFor="new_ap_active"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      AP 활성화 (Active Status)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(false)}
                  className="px-3 py-1.5 text-xs font-bold rounded border hover:bg-zinc-150/40"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "추가 중..." : "추가"}
                </button>
              </div>
            </form>
          )}

          {/* Empty State detail guide */}
          {!editingProgram && !editingProfile && !isCreatingProgram && !isCreatingProfile && (
            <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-2">
              <span className="text-zinc-300 text-3xl">⚙️</span>
              <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">편집기 상세 패널</h4>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed max-w-[220px]">
                좌측 목록에서 편집할 프로그램 또는 AP 항목을 클릭하거나, 신규 항목을 추가해 주세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
