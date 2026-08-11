"use client";

import { useState, useTransition } from "react";
import { adminUpdateDisplayProgram, adminUpdateAPSettings } from "@/lib/product/admin-actions";

interface DisplayProgram {
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface AssortmentProfile {
  id: number;
  display_program: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
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

  // Edit Modal/Inline States
  const [editingProgram, setEditingProgram] = useState<DisplayProgram | null>(null);
  const [editingProfile, setEditingProfile] = useState<AssortmentProfile | null>(null);

  // Program Save
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await adminUpdateDisplayProgram(editingProgram.code, {
          name: editingProgram.name,
          description: editingProgram.description || "",
          is_active: editingProgram.is_active,
        });

        if (res.success) {
          setPrograms((prev) =>
            prev.map((p) => (p.code === editingProgram.code ? editingProgram : p))
          );
          // If a program is deactivated, also sync-deactivate its local profiles state
          if (!editingProgram.is_active) {
            setProfiles((prev) =>
              prev.map((ap) =>
                ap.display_program === editingProgram.code ? { ...ap, is_active: false } : ap
              )
            );
          }
          setMessage({ type: "success", text: "Display Program 설정이 저장되었습니다." });
          setEditingProgram(null);
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "설정 저장 실패" });
      }
    });
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await adminUpdateAPSettings(editingProfile.id, {
          name: editingProfile.name,
          description: editingProfile.description || "",
          is_active: editingProfile.is_active,
        });

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

      {/* Programs Tab Content */}
      {activeTab === "programs" && (
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {programs.map((prog) => (
              <div
                key={prog.code}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-zinc-850 dark:text-white">
                      {prog.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        prog.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900"
                          : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-600 dark:border-zinc-850"
                      }`}
                    >
                      {prog.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 min-h-12 leading-relaxed">
                    {prog.description || "설명이 입력되지 않았습니다."}
                  </p>
                  <span className="inline-block text-[9.5px] font-mono text-zinc-400 font-bold bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-600 px-2 py-1 rounded">
                    Code: {prog.code}
                  </span>
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setEditingProgram(prog);
                      setEditingProfile(null);
                    }}
                    className="text-xs font-bold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    설정 편집
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Program Edit Modal */}
          {editingProgram && (
            <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveProgram}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b pb-2">
                  Display Program 설정 편집
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">프로그램명</label>
                    <input
                      type="text"
                      value={editingProgram.name}
                      onChange={(e) =>
                        setEditingProgram({ ...editingProgram, name: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">프로그램 상세 설명</label>
                    <textarea
                      value={editingProgram.description || ""}
                      onChange={(e) =>
                        setEditingProgram({ ...editingProgram, description: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 h-20 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="prog_active"
                      checked={editingProgram.is_active}
                      onChange={(e) =>
                        setEditingProgram({ ...editingProgram, is_active: e.target.checked })
                      }
                      className="rounded border-zinc-300 accent-zinc-950 dark:accent-white"
                    />
                    <label
                      htmlFor="prog_active"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                    >
                      프로그램 활성화 (Active)
                    </label>
                  </div>
                  {!editingProgram.is_active && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      * 경고: 프로그램 비활성화 시 연계된 모든 AP(Assortment Profiles)들도 일괄 비활성 상태로 강제 조정됩니다.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setEditingProgram(null)}
                    className="px-3 py-1.5 text-xs font-bold rounded border hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
            </div>
          )}
        </div>
      )}

      {/* Profiles Tab Content */}
      {activeTab === "profiles" && (
        <div className="space-y-6">
          {/* Program Filters Row */}
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase px-2">프로그램 필터:</span>
            {["START_4FT", "GROW_8FT", "EXPAND_12FT"].map((prog) => (
              <button
                key={prog}
                onClick={() => setSelectedProgramFilter(prog)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                  selectedProgramFilter === prog
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-650 hover:bg-zinc-150/40 dark:text-zinc-400"
                }`}
              >
                {getProgramBadgeText(prog)}
              </button>
            ))}
          </div>

          {/* AP Profiles Table */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <th className="p-3.5 font-bold text-zinc-500 w-24">AP Code</th>
                  <th className="p-3.5 font-bold text-zinc-550">Name (설정 명칭)</th>
                  <th className="p-3.5 font-bold text-zinc-550">Description (설명)</th>
                  <th className="p-3.5 font-bold text-zinc-500 w-24">Status</th>
                  <th className="p-3.5 font-bold text-zinc-500 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles
                  .filter((p) => p.display_program === selectedProgramFilter)
                  .map((prof) => (
                    <tr
                      key={prof.id}
                      className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50/20 dark:hover:bg-zinc-950/20"
                    >
                      <td className="p-3.5 font-mono font-bold text-zinc-900 dark:text-white">
                        {prof.code}
                      </td>
                      <td className="p-3.5 font-bold text-zinc-800 dark:text-zinc-250">
                        {prof.name}
                      </td>
                      <td className="p-3.5 text-zinc-500 dark:text-zinc-400">
                        {prof.description || "(설명 없음)"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            prof.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900"
                              : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-600 dark:border-zinc-850"
                          }`}
                        >
                          {prof.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setEditingProfile(prof);
                            setEditingProgram(null);
                          }}
                          className="text-[11px] font-bold text-indigo-650 hover:underline dark:text-indigo-400"
                        >
                          편집
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* AP Edit Modal */}
          {editingProfile && (
            <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveProfile}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b pb-2">
                  Assortment Profile (AP) 설정 편집
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Program</label>
                      <span className="block p-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-950 rounded text-zinc-500 border border-zinc-100 dark:border-zinc-900">
                        {getProgramBadgeText(editingProfile.display_program)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">AP Code</label>
                      <span className="block p-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-950 rounded text-zinc-500 border border-zinc-100 dark:border-zinc-900">
                        {editingProfile.code} (식별자 불변)
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">AP 이름 (Name)</label>
                    <input
                      type="text"
                      value={editingProfile.name}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, name: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">상세 설명 (Description)</label>
                    <textarea
                      value={editingProfile.description || ""}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, description: e.target.value })
                      }
                      className="w-full rounded border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white p-2 text-xs outline-none focus:border-zinc-950 h-20 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="ap_active"
                      checked={editingProfile.is_active}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, is_active: e.target.checked })
                      }
                      className="rounded border-zinc-300 accent-zinc-950 dark:accent-white"
                    />
                    <label
                      htmlFor="ap_active"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                    >
                      AP 활성화 (Active)
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    className="px-3 py-1.5 text-xs font-bold rounded border hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
