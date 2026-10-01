"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeRelation,
  ManualAsset,
  KnowledgeAuditLog,
  AudienceType
} from "@/lib/knowledge/types";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function DetailView({ id }: { id: string }) {
  const [data, setData] = useState<{
    item: KnowledgeItem;
    versions: KnowledgeVersion[];
    relations: KnowledgeRelation[];
    assets: ManualAsset[];
    auditLogs: KnowledgeAuditLog[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"CONTENT" | "ACCESS" | "VERSIONS" | "ACTIVITY">("CONTENT");
  const [language, setLanguage] = useState<"KO" | "EN">("KO");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<KnowledgeItem>>({});

  // Version modal
  const [newVersionModal, setNewVersionModal] = useState(false);
  const [whatChanged, setWhatChanged] = useState("");
  const [whyChanged, setWhyChanged] = useState("");
  const [newVersionString, setNewVersionString] = useState("");

  // No Update Needed Modal (Section 12 Governance)
  const [noUpdateModal, setNoUpdateModal] = useState(false);
  const [noUpdateReason, setNoUpdateReason] = useState("");

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setEditForm(json.item);
      }
    } catch (e) {
      console.error("Failed to load detail:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        alert("수정사항이 저장되었습니다.");
        setIsEditing(false);
        fetchDetail();
      } else {
        const err = await res.json();
        alert(`저장 실패: ${err.error}`);
      }
    } catch (e) {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!whatChanged.trim() || !whyChanged.trim()) {
      alert("변경 내용(What changed)과 사유(Why changed)를 입력해 주세요.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/knowledge/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_DRAFT",
          version: newVersionString.trim() || undefined,
          what_changed: whatChanged,
          why_changed: whyChanged
        })
      });
      if (res.ok) {
        alert("새 버전 초안이 생성되었습니다!");
        setNewVersionModal(false);
        setWhatChanged("");
        setWhyChanged("");
        setNewVersionString("");
        fetchDetail();
      } else {
        const err = await res.json();
        alert(`버전 생성 실패: ${err.error}`);
      }
    } catch (e) {
      alert("버전 생성 중 오류가 발생했습니다.");
    }
  };

  const handlePublishVersion = async (versionStr: string) => {
    if (!confirm(`버전 ${versionStr}을(를) 공식 배포(Publish)하시겠습니까? 현재 버전이 공식 Source of Truth로 전환되며 기존 버전은 이력으로 보존됩니다.`)) return;
    try {
      const res = await fetch(`/api/admin/knowledge/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PUBLISH",
          version: versionStr
        })
      });
      if (res.ok) {
        alert("버전이 성공적으로 공식 배포(Publish)되었습니다!");
        fetchDetail();
      } else {
        const err = await res.json();
        alert(`배포 실패:\n${err.error}`);
      }
    } catch (e) {
      alert("버전 배포 중 오류가 발생했습니다.");
    }
  };

  const handlePublishItem = async () => {
    if (!confirm(`본 지식 항목(${item?.title})을 공식 배포(Publish)하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PUBLISH",
          version: item?.current_version || "v1.0"
        })
      });
      if (res.ok) {
        alert("성공적으로 공식 배포(Publish)되었습니다!");
        fetchDetail();
      } else {
        const err = await res.json();
        alert(`배포 실패:\n${err.error}`);
      }
    } catch (e) {
      alert("배포 처리 중 오류가 발생했습니다.");
    }
  };

  const handleConfirmNoUpdateNeeded = async () => {
    if (!noUpdateReason.trim()) {
      alert("검토 사유를 반드시 입력해 주세요.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "no_update_needed",
          reason: noUpdateReason
        })
      });
      if (res.ok) {
        alert("검토 완료(수정 불필요) 처리되었습니다. 영향 상태가 정상(NORMAL)으로 복원되었습니다.");
        setNoUpdateModal(false);
        setNoUpdateReason("");
        fetchDetail();
      } else {
        const err = await res.json();
        alert(`처리 실패: ${err.error}`);
      }
    } catch (e) {
      alert("검토 처리 중 오류가 발생했습니다.");
    }
  };

  const toggleAudience = (aud: AudienceType) => {
    const current = (editForm.audience || item?.audience || []) as AudienceType[];
    let updated: AudienceType[];
    if (current.includes(aud)) {
      if (current.length === 1) {
        alert("최소 1개 이상의 배포 대상(Audience)을 유지해야 합니다.");
        return;
      }
      updated = current.filter(a => a !== aud);
    } else {
      updated = [...current, aud];
    }
    setEditForm({ ...editForm, audience: updated });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <KnowledgeNavTabs />
        <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-96 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  const item = data?.item;
  if (!item) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold text-zinc-500">지식 항목을 찾을 수 없습니다.</p>
        <Link href="/admin/knowledge/library" className="mt-3 inline-block text-xs text-blue-600 hover:underline">
          &larr; 라이브러리로 돌아가기
        </Link>
      </div>
    );
  }

  const versions = data?.versions || [];
  const auditLogs = data?.auditLogs || [];
  const assets = data?.assets || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">PUBLISHED</span>;
      case "DRAFT":
      case "IN_REVIEW":
        return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">DRAFT</span>;
      case "ARCHIVED":
      case "SUPERSEDED":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">ARCHIVED</span>;
      default:
        return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-700">{status}</span>;
    }
  };

  const hasInternal = item.audience?.some(a => ["INTERNAL", "ADMIN / MANAGEMENT"].includes(a.toUpperCase()));
  const hasBrand = item.audience?.some(a => a.toUpperCase() === "BRAND");
  const hasRetail = item.audience?.some(a => ["RETAIL", "RETAILER"].includes(a.toUpperCase()));

  return (
    <div className="space-y-6 max-w-6xl">
      <KnowledgeNavTabs />

      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            <Link href="/admin/knowledge/library" className="hover:text-zinc-900 dark:hover:text-white">
              Library
            </Link>
            <span>/</span>
            <span>{item.module || item.category || "General"}</span>
            <span>/</span>
            <span className="font-mono text-zinc-400">{item.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {item.title}
            </h1>
            {getStatusBadge(item.status)}
            {item.system_impact_status === "UPDATE_REQUIRED" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse">
                ⚠️ UPDATE REQUIRED
              </span>
            )}
            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {item.type}
            </span>
            <span className="font-mono text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
              {item.current_version || "v1.0"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg bg-[#131E2E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] cursor-pointer"
              >
                {saving ? "저장 중..." : "저장 완료"}
              </button>
            </>
          ) : (
            <>
              {item.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={handlePublishItem}
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  🚀 공식 배포 (Publish)
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer shadow-xs"
              >
                ✏️ 수정
              </button>
              <button
                type="button"
                onClick={() => setNewVersionModal(true)}
                className="rounded-lg bg-[#131E2E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] cursor-pointer shadow-xs"
              >
                + 새 버전 생성
              </button>
            </>
          )}
        </div>
      </div>

      {/* Prominent Impact Alert Banner (Section 11 & 12 Governance) */}
      {(item.system_impact_status === "UPDATE_REQUIRED" || item.system_impact_status === "POTENTIALLY_OUTDATED") && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50/90 dark:border-amber-600 dark:bg-amber-950/40 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="text-2xl mt-0.5 select-none">⚠️</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    시스템 변경 감지: 매뉴얼/지식 개정 필요 (UPDATE REQUIRED)
                  </h3>
                  <span className="rounded bg-amber-200/80 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-900 dark:text-amber-200">
                    {item.system_impact_status}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  {item.system_impact_reason || "관련 기능 또는 연동 화면의 시스템 변경이 감지되었습니다. 운영자는 매뉴얼 내용을 검토하고 필요시 새 버전을 발행해 주세요."}
                </p>
                {item.system_impact_updated_at && (
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400 font-mono">
                    감지 시점: {new Date(item.system_impact_updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setNoUpdateModal(true)}
                className="w-full sm:w-auto rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 px-3.5 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 shadow-xs cursor-pointer transition-colors"
              >
                ✓ 수정 불필요 확인 (No Update Needed)
              </button>
              <button
                type="button"
                onClick={() => {
                  setWhatChanged(`[시스템 변경 반영] ${item.system_impact_reason || "화면 및 기능 변경에 따른 매뉴얼 개정"}`);
                  setWhyChanged("관련 시스템 및 라우트 변경사항 반영");
                  setNewVersionModal(true);
                }}
                className="w-full sm:w-auto rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shadow-xs cursor-pointer transition-colors"
              >
                + 개정 버전 작성 &amp; Publish (Update Required)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-6 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold select-none">
        <button
          onClick={() => setActiveTab("CONTENT")}
          className={`pb-3 transition-colors relative cursor-pointer ${
            activeTab === "CONTENT"
              ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white font-bold"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Overview & Content (본문)
        </button>
        <button
          onClick={() => setActiveTab("ACCESS")}
          className={`pb-3 transition-colors relative cursor-pointer ${
            activeTab === "ACCESS"
              ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white font-bold"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Publication & Distribution (배포 대상)
        </button>
        <button
          onClick={() => setActiveTab("VERSIONS")}
          className={`pb-3 transition-colors relative cursor-pointer ${
            activeTab === "VERSIONS"
              ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white font-bold"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Versions (버전 이력 {versions.length > 0 && `(${versions.length})`})
        </button>
        <button
          onClick={() => setActiveTab("ACTIVITY")}
          className={`pb-3 transition-colors relative cursor-pointer ${
            activeTab === "ACTIVITY"
              ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white font-bold"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Activity Logs (변경 이력 {auditLogs.length > 0 && `(${auditLogs.length})`})
        </button>
      </div>

      {/* Tab 1: Overview & Content */}
      {activeTab === "CONTENT" && (
        <div className="space-y-6">
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            <div>
              <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Module</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.module || editForm.category || ""}
                  onChange={(e) => setEditForm({ ...editForm, module: e.target.value, category: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
              ) : (
                <span className="font-bold text-zinc-900 dark:text-white">{item.module || item.category || "General"}</span>
              )}
            </div>
            <div>
              <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Owner / Publisher</span>
              <span className="font-bold text-zinc-900 dark:text-white">{item.owner_name || "Knowledge Admin"}</span>
            </div>
            <div>
              <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Status</span>
              {isEditing ? (
                <select
                  value={editForm.status || item.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="mt-1 w-full rounded border border-zinc-300 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              ) : (
                <span className="font-bold text-zinc-900 dark:text-white">{item.status}</span>
              )}
            </div>
            <div>
              <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Effective / Updated</span>
              <span className="font-bold text-zinc-900 dark:text-white">{new Date(item.updated_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Official Document Banner if present */}
          {(item.document_url || assets.length > 0) && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    Official Distribution Document (공식 배포 문서)
                  </h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {item.document_name || assets[0]?.file_name || "Official_Manual.pdf"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={item.document_url || assets[0]?.file_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                >
                  문서 보기 (View)
                </a>
                <a
                  href={`${item.document_url || assets[0]?.file_url || "#"}?action=download`}
                  download
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                >
                  다운로드 (Download)
                </a>
              </div>
            </div>
          )}

          {/* Summary Box */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
              Summary (요약)
            </span>
            {isEditing ? (
              <textarea
                value={editForm.summary_ko || ""}
                onChange={(e) => setEditForm({ ...editForm, summary_ko: e.target.value })}
                rows={2}
                className="w-full rounded border border-zinc-300 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            ) : (
              <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                {language === "KO" ? item.summary_ko || item.summary_en : item.summary_en || item.summary_ko}
              </p>
            )}
          </div>

          {/* Structured Content Box */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Structured Content (본문)
              </h2>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setLanguage("KO")}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    language === "KO"
                      ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  KO (한국어)
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("EN")}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    language === "EN"
                      ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  EN (English)
                </button>
              </div>
            </div>

            {isEditing ? (
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === "KO" ? "한국어 본문 수정 (Markdown)" : "English Content (Markdown)"}
                </label>
                <textarea
                  value={language === "KO" ? (editForm.content_ko || "") : (editForm.content_en || "")}
                  onChange={(e) => {
                    if (language === "KO") setEditForm({ ...editForm, content_ko: e.target.value });
                    else setEditForm({ ...editForm, content_en: e.target.value });
                  }}
                  rows={16}
                  className="w-full font-mono text-xs rounded-md border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-950 text-zinc-900 dark:text-white"
                />
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                {language === "KO"
                  ? item.content_ko || "한국어 본문이 아직 등록되지 않았습니다."
                  : item.content_en || "English content is not yet available."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Publication & Audience Distribution (Section 4, 5, 6) */}
      {activeTab === "ACCESS" && (
        <div className="space-y-6">
          {/* Publication Info Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              Publication Status &amp; Authority
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Publication Status</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {getStatusBadge(item.status)}
                </div>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Current Official Version</span>
                <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white mt-1 block">
                  {item.current_version || "v1.0"}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Published / Effective Date</span>
                <span className="font-bold text-xs text-zinc-900 dark:text-white mt-1 block">
                  {item.effective_date || new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[10px] uppercase">Owner / Publisher</span>
                <span className="font-bold text-xs text-zinc-900 dark:text-white mt-1 block truncate">
                  {item.owner_name || "K SELECT Operations"}
                </span>
              </div>
            </div>
          </div>

          {/* Distribution Audience Grid */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Audience Distribution Boundary
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  공식 배포(PUBLISHED) 상태의 지식이 조회될 수 있는 사용자 권한 및 포털 배포 경계입니다.
                </p>
              </div>
              {isEditing && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                  체크박스를 클릭하여 배포 대상을 변경할 수 있습니다.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Internal / Admin */}
              <div
                onClick={() => isEditing && toggleAudience("INTERNAL")}
                className={`p-5 rounded-xl border transition-all ${
                  isEditing ? "cursor-pointer hover:border-slate-400" : ""
                } ${
                  hasInternal
                    ? "border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50 ring-1 ring-slate-400/30"
                    : "border-zinc-200 bg-zinc-50/30 opacity-50 dark:border-zinc-800 dark:bg-zinc-950/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <span className="font-bold text-xs text-zinc-900 dark:text-white">Internal / Admin</span>
                  </div>
                  {hasInternal ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ 배포 활성 (Active)
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800">
                      — 미배포 (Inactive)
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  어드민 콘솔 및 내부 운영팀 전용 지식입니다.
                </p>
                <div className="mt-3 text-[10px] font-mono text-zinc-500">
                  Distribution: {hasInternal && item.status === "PUBLISHED" ? "YES (Eligible)" : "NO"}
                </div>
              </div>

              {/* Brand Portal */}
              <div
                onClick={() => isEditing && toggleAudience("BRAND")}
                className={`p-5 rounded-xl border transition-all ${
                  isEditing ? "cursor-pointer hover:border-blue-400" : ""
                } ${
                  hasBrand
                    ? "border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30 ring-1 ring-blue-400/30"
                    : "border-zinc-200 bg-zinc-50/30 opacity-50 dark:border-zinc-800 dark:bg-zinc-950/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏢</span>
                    <span className="font-bold text-xs text-zinc-900 dark:text-white">Brand Portal</span>
                  </div>
                  {hasBrand ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ 배포 활성 (Active)
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800">
                      — 미배포 (Inactive)
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  브랜드사 파트너 포털 및 브랜드 헬프 센터 배포 대상입니다.
                </p>
                <div className="mt-3 text-[10px] font-mono text-zinc-500">
                  Distribution: {hasBrand && item.status === "PUBLISHED" && !item.is_sensitive_internal ? "YES (Eligible)" : "NO"}
                </div>
              </div>

              {/* Retail Portal */}
              <div
                onClick={() => isEditing && toggleAudience("RETAILER")}
                className={`p-5 rounded-xl border transition-all ${
                  isEditing ? "cursor-pointer hover:border-purple-400" : ""
                } ${
                  hasRetail
                    ? "border-purple-300 bg-purple-50/60 dark:border-purple-700 dark:bg-purple-950/30 ring-1 ring-purple-400/30"
                    : "border-zinc-200 bg-zinc-50/30 opacity-50 dark:border-zinc-800 dark:bg-zinc-950/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛒</span>
                    <span className="font-bold text-xs text-zinc-900 dark:text-white">Retail Portal</span>
                  </div>
                  {hasRetail ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ 배포 활성 (Active)
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800">
                      — 미배포 (Inactive)
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  미국 리테일러/바이어 포털 및 리테일 헬프 센터 배포 대상입니다.
                </p>
                <div className="mt-3 text-[10px] font-mono text-zinc-500">
                  Distribution: {hasRetail && item.status === "PUBLISHED" && !item.is_sensitive_internal ? "YES (Eligible)" : "NO"}
                </div>
              </div>
            </div>

            {/* Security Isolation Notice */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
              <span className="text-base select-none mt-0.5">🔒</span>
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-zinc-900 dark:text-white">
                  Audience Isolation &amp; Security Boundary (보안 격리 원칙)
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  PUBLISHED 상태인 지식만 배포 쿼리에 노출되며, BRAND 전용 지식은 RETAIL 사용자에게 노출되지 않고,
                  INTERNAL 전용 지식 및 민감 정보(Sensitive)는 외부 포털 API 쿼리에서 원천 차단됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Versions */}
      {activeTab === "VERSIONS" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Version History
              </h2>
              <p className="text-xs text-zinc-500">지식의 공식 버전 개정 이력입니다.</p>
            </div>
            <button
              type="button"
              onClick={() => setNewVersionModal(true)}
              className="rounded-md bg-[#131E2E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1f3047] cursor-pointer"
            >
              + 새 버전 생성
            </button>
          </div>

          <div className="space-y-4">
            {versions.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">버전 이력이 없습니다. 현재 버전: {item.current_version || "v1.0"}</p>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">{v.version}</span>
                      {getStatusBadge(v.status)}
                      <span className="text-xs text-zinc-400">&bull; {new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 font-semibold mt-1">{v.what_changed || v.title_ko}</p>
                    {v.why_changed && <p className="text-[11px] text-zinc-500 mt-0.5">사유: {v.why_changed}</p>}
                  </div>
                  {v.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handlePublishVersion(v.version)}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      공식 배포 (Publish)
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Activity Logs */}
      {activeTab === "ACTIVITY" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
            Activity &amp; Audit Logs
          </h2>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {auditLogs.length === 0 ? (
              <p className="py-6 text-center text-zinc-400">활동 기록이 없습니다.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-white">{log.action}</span>
                      <span className="text-zinc-400 text-[11px]">&bull; {log.user_name || "Admin"}</span>
                    </div>
                    {log.reason && <p className="text-zinc-500 text-[11px] mt-0.5">{log.reason}</p>}
                  </div>
                  <span className="text-zinc-400 text-[11px]">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Create New Version */}
      {newVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-zinc-900 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              + 새 버전 생성 (Create New Version)
            </h3>
            <p className="text-xs text-zinc-500">
              기존 지식을 개정하기 위해 새 드래프트 버전을 생성합니다.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  버전 번호 (예: v1.1, v2.0)
                </label>
                <input
                  type="text"
                  value={newVersionString}
                  onChange={(e) => setNewVersionString(e.target.value)}
                  placeholder="v1.1"
                  className="w-full rounded border border-zinc-300 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  변경 내용 (What changed) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={whatChanged}
                  onChange={(e) => setWhatChanged(e.target.value)}
                  rows={2}
                  placeholder="개정된 정책 및 수정 사항을 요약해 주세요."
                  className="w-full rounded border border-zinc-300 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  개정 사유 (Why changed) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={whyChanged}
                  onChange={(e) => setWhyChanged(e.target.value)}
                  rows={2}
                  placeholder="정책 변경, 프로세스 개선 등 개정 사유를 입력해 주세요."
                  className="w-full rounded border border-zinc-300 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setNewVersionModal(false)}
                className="rounded px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateNewVersion}
                className="rounded bg-[#131E2E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1f3047] cursor-pointer"
              >
                버전 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: No Update Needed Confirmation (Section 12 Governance) */}
      {noUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-zinc-900 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              ✓ 수정 불필요 확인 (No Update Needed)
            </h3>
            <p className="text-xs text-zinc-500">
              시스템 변경사항을 검토하였으며, 본 매뉴얼의 내용 수정 없이 정상 상태(NORMAL)로 복구합니다.
            </p>
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                검토 사유 (Review Reason) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={noUpdateReason}
                onChange={(e) => setNoUpdateReason(e.target.value)}
                rows={3}
                placeholder="예: 변경된 화면 UI가 기존 매뉴얼 설명과 부합함을 확인하여 내용 개정 불필요로 판단함."
                className="w-full rounded border border-zinc-300 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setNoUpdateModal(false)}
                className="rounded px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmNoUpdateNeeded}
                className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                검토 완료 및 NORMAL 복구
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
