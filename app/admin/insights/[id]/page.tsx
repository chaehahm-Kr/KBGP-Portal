"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import InsightPreviewModal from "@/components/admin/insights/insight-preview-modal";

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export default function InsightEditorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [activeTab, setActiveTab] = useState<
    "CORE" | "NETWORK" | "HUB" | "VISUALS" | "SOURCES" | "HISTORY"
  >("CORE");
  const [bodyLangTab, setBodyLangTab] = useState<"KO" | "EN">("KO");
  const [article, setArticle] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [saveBanner, setSaveBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable PDF card labels
  const [pdfCardMeta, setPdfCardMeta] = useState({
    card_title_ko: "",
    card_description_ko: "",
    button_label_ko: "무료 PDF 다운로드",
    card_title_en: "",
    card_description_en: "",
    button_label_en: "Download Free PDF",
  });

  // New Revision Modal
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [revisionSection, setRevisionSection] = useState("CORE");

  const fetchDetail = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/insights/${id}`);
      if (res.ok) {
        const data = await res.json();
        setArticle(data.article);
        setRevisions(data.revisions || []);
        setVersionHistory(data.versionHistory || []);
        if (data.article?.pdf_attachment) {
          const p = data.article.pdf_attachment;
          setPdfCardMeta({
            card_title_ko: p.card_title_ko || "",
            card_description_ko: p.card_description_ko || "",
            button_label_ko: p.button_label_ko || "무료 PDF 다운로드",
            card_title_en: p.card_title_en || "",
            card_description_en: p.card_description_en || "",
            button_label_en: p.button_label_en || "Download Free PDF",
          });
        }
      }
    } catch (e) {
      console.error("Failed to load insight detail:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleSave = async (overrides?: any) => {
    try {
      setIsSaving(true);
      setSaveBanner(null);
      const payload = {
        ...article,
        ...overrides,
        change_type: overrides?.status ? `STATUS_${overrides.status}` : "EDITOR_MODIFIED",
      };

      const res = await fetch(`/api/admin/insights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchDetail();
        setSaveBanner({
          type: "success",
          text: overrides?.status
            ? `Article status updated to ${overrides.status}.`
            : "Changes saved successfully.",
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveBanner({
          type: "error",
          text: errData.error || "Failed to save changes.",
        });
      }
    } catch {
      setSaveBanner({ type: "error", text: "Error saving insight." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string, confirmMessage?: string) => {
    const msg = confirmMessage || `Change article status to ${newStatus}?`;
    if (!confirm(msg)) return;
    await handleSave({ status: newStatus });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setIsUploadingPdf(true);
      setPdfFeedback(null);
      const fd = new FormData();
      fd.append("file", selectedFile);
      if (pdfCardMeta.card_title_ko) fd.append("card_title_ko", pdfCardMeta.card_title_ko);
      if (pdfCardMeta.card_description_ko)
        fd.append("card_description_ko", pdfCardMeta.card_description_ko);
      if (pdfCardMeta.button_label_ko) fd.append("button_label_ko", pdfCardMeta.button_label_ko);
      if (pdfCardMeta.card_title_en) fd.append("card_title_en", pdfCardMeta.card_title_en);
      if (pdfCardMeta.card_description_en)
        fd.append("card_description_en", pdfCardMeta.card_description_en);
      if (pdfCardMeta.button_label_en) fd.append("button_label_en", pdfCardMeta.button_label_en);

      const res = await fetch(`/api/admin/insights/${id}/attachment`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPdfFeedback({
          type: "error",
          text: data.error || "PDF 업로드에 실패했습니다.",
        });
      } else {
        setPdfFeedback({
          type: "success",
          text: `PDF 첨부 완료: ${data.attachment.file_name} (${data.attachment.page_count}페이지 · SHA-256 검증 통과)`,
        });
        await fetchDetail();
      }
    } catch (err: any) {
      setPdfFeedback({
        type: "error",
        text: err?.message || "PDF 업로드 중 오류가 발생했습니다.",
      });
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSavePdfCardLabels = async () => {
    try {
      setIsUploadingPdf(true);
      setPdfFeedback(null);
      const res = await fetch(`/api/admin/insights/${id}/attachment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfCardMeta),
      });
      const data = await res.json();
      if (res.ok) {
        setPdfFeedback({
          type: "success",
          text: "PDF 다운로드 카드 문구가 저장되었습니다.",
        });
        await fetchDetail();
      } else {
        setPdfFeedback({
          type: "error",
          text: data.error || "PDF 카드 문구 저장 실패",
        });
      }
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleRemovePdf = async () => {
    if (!confirm("첨부된 PDF 가이드 파일을 이 아티클에서 제거하시겠습니까?")) return;
    try {
      setIsUploadingPdf(true);
      setPdfFeedback(null);
      const res = await fetch(`/api/admin/insights/${id}/attachment`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPdfFeedback({ type: "success", text: "PDF 첨부가 제거되었습니다." });
        await fetchDetail();
      } else {
        setPdfFeedback({ type: "error", text: "PDF 첨부 제거에 실패했습니다." });
      }
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleAddRevisionRequest = async () => {
    if (!revisionComment.trim()) {
      alert("Please enter a revision request note.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/insights/${id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: "Senior Editor",
          comment: revisionComment.trim(),
          target_section: revisionSection,
        }),
      });

      if (res.ok) {
        setIsRevisionModalOpen(false);
        setRevisionComment("");
        fetchDetail();
      }
    } catch {
      alert("Error submitting revision request.");
    }
  };

  if (isLoading || !article) {
    return (
      <div className="w-full p-12 text-center text-sm text-zinc-500">
        Loading insight editor detail...
      </div>
    );
  }

  const topicScoreBreakdown = article.topic_score_breakdown || {
    relevance: 25,
    actionability: 25,
    evidence_strength: 20,
    timeliness: 15,
    originality: 10,
    strategic_fit: 5,
  };

  const criticalConds = article.critical_conditions || {
    evidence_quality: "PASS",
    duplicate_check: "PASS",
    claim_validation: "PASS",
    audience_relevance: "PASS",
  };

  const activeBodyField = bodyLangTab === "KO" ? "body_blocks_ko" : "body_blocks_en";
  const currentBodyBlocks: any[] = Array.isArray(article[activeBodyField])
    ? article[activeBodyField]
    : [];

  const setBodyBlocksForLang = (nextBlocks: any[]) => {
    if (bodyLangTab === "KO") {
      setArticle({ ...article, body_blocks_ko: nextBlocks, body_blocks: nextBlocks });
    } else {
      setArticle({ ...article, body_blocks_en: nextBlocks });
    }
  };

  const updateBlockAt = (idx: number, patch: Record<string, any>) => {
    const next = currentBodyBlocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    setBodyBlocksForLang(next);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= currentBodyBlocks.length) return;
    const next = [...currentBodyBlocks];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    setBodyBlocksForLang(next);
  };

  const removeBlockAt = (idx: number) => {
    setBodyBlocksForLang(currentBodyBlocks.filter((_, i) => i !== idx));
  };

  const addNewBlock = (blockType: string) => {
    let newBlock: any = { type: blockType, value: "" };
    if (blockType === "CHECKLIST") {
      newBlock = { type: "CHECKLIST", title: "", items: [""] };
    } else if (blockType === "RELATED_INSIGHT") {
      newBlock = { type: "RELATED_INSIGHT", title: "", description: "", href: "/insights/" };
    } else if (blockType === "PDF_DOWNLOAD") {
      newBlock = { type: "PDF_DOWNLOAD" };
    }
    setBodyBlocksForLang([...currentBodyBlocks, newBlock]);
  };

  const pdfAtt = article.pdf_attachment;

  return (
    <div className="w-full space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/insights/all"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              ← Back to Insights Directory
            </Link>
            <span>•</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              ID: {article.id?.substring(0, 8)}
            </span>
            {pdfAtt && (
              <>
                <span>•</span>
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  PDF Attached ({pdfAtt.page_count}p)
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            {article.title_ko || article.title || "Untitled Insight Draft"}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 font-mono">Slug: /insights/{article.slug}</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
          >
            Live Preview (KO/EN)
          </button>

          {article.owner_preview_url && (
            <a
              href={article.owner_preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
            >
              Website Preview ↗
            </a>
          )}

          <button
            type="button"
            onClick={() => setIsRevisionModalOpen(true)}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 cursor-pointer"
          >
            Request Revision
          </button>

          {article.status !== "APPROVED" && article.status !== "PUBLISHED" && (
            <button
              type="button"
              onClick={() =>
                handleStatusChange(
                  "APPROVED",
                  "Approve this article? (It will remain unpublished until you click Publish Channels.)"
                )
              }
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
            >
              Approve Article
            </button>
          )}

          {article.status === "APPROVED" && (
            <button
              type="button"
              onClick={() =>
                handleStatusChange(
                  "PUBLISHED",
                  "Publish this article publicly to its enabled channel(s)?"
                )
              }
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 cursor-pointer"
            >
              Publish Channels
            </button>
          )}

          {(article.status === "PUBLISHED" || article.status === "APPROVED") && (
            <button
              type="button"
              onClick={() =>
                handleStatusChange(
                  "DRAFT",
                  "Revert this article back to unpublished DRAFT status?"
                )
              }
              className="rounded-lg border border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 cursor-pointer"
            >
              {article.status === "PUBLISHED" ? "Unpublish to Draft" : "Revert to Draft"}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {saveBanner && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
            saveBanner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {saveBanner.text}
        </div>
      )}

      {/* Workflow & Channel Status Badges */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 text-xs">
        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">Article Status:</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {article.status}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">K SELECT NETWORK:</span>
          <span
            className={`rounded px-2 py-0.5 font-bold ${
              article.network_enabled &&
              article.status === "PUBLISHED" &&
              article.network_publish_status === "PUBLISHED"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {article.network_enabled
              ? article.status === "PUBLISHED"
                ? "PUBLISHED"
                : `ENABLED (${article.status})`
              : "DISABLED"}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">K SELECT HUB:</span>
          <span
            className={`rounded px-2 py-0.5 font-bold ${
              article.hub_enabled &&
              article.status === "PUBLISHED" &&
              article.hub_publish_status === "PUBLISHED"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {article.hub_enabled
              ? article.status === "PUBLISHED"
                ? "PUBLISHED"
                : `ENABLED (${article.status})`
              : "DISABLED"}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div>
          <span className="text-zinc-400 font-semibold mr-1.5">Topic Score:</span>
          <span className="font-extrabold text-blue-600 dark:text-blue-400">
            {article.topic_score || 85} / 100
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <nav className="flex space-x-6 min-w-max">
          {[
            { key: "CORE", label: "A. CORE INSIGHT & PDF GUIDE" },
            { key: "NETWORK", label: "B. K SELECT NETWORK" },
            { key: "HUB", label: "C. K SELECT HUB" },
            { key: "VISUALS", label: "D. VISUALS & ASSETS" },
            { key: "SOURCES", label: "E. SOURCES & CLAIMS" },
            { key: "HISTORY", label: "F. REVISIONS & HISTORY" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`border-b-2 py-3 text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB CONTENTS */}
      <div className="space-y-6">
        {/* TAB A: CORE */}
        {activeTab === "CORE" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Titles & Slug */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  Core Article Information (KO / EN)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Title (Korean KO)
                    </label>
                    <input
                      type="text"
                      value={article.title_ko || article.title || ""}
                      onChange={(e) =>
                        setArticle({
                          ...article,
                          title_ko: e.target.value,
                          title: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Title (English EN)
                    </label>
                    <input
                      type="text"
                      value={article.title_en || ""}
                      onChange={(e) => setArticle({ ...article, title_en: e.target.value })}
                      placeholder="English business title"
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Subtitle (KO)
                    </label>
                    <input
                      type="text"
                      value={article.subtitle_ko || article.subtitle || ""}
                      onChange={(e) =>
                        setArticle({
                          ...article,
                          subtitle_ko: e.target.value,
                          subtitle: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Subtitle (EN)
                    </label>
                    <input
                      type="text"
                      value={article.subtitle_en || ""}
                      onChange={(e) => setArticle({ ...article, subtitle_en: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Slug (URL Key)
                  </label>
                  <input
                    type="text"
                    value={article.slug || ""}
                    onChange={(e) => setArticle({ ...article, slug: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Category
                    </label>
                    <select
                      value={article.category || "U.S. MARKET ENTRY"}
                      onChange={(e) => setArticle({ ...article, category: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="U.S. MARKET ENTRY">U.S. MARKET ENTRY</option>
                      <option value="U.S. K-BEAUTY MARKET">U.S. K-BEAUTY MARKET</option>
                      <option value="PRODUCT & CATEGORY">PRODUCT & CATEGORY</option>
                      <option value="BRAND GROWTH PLAYBOOK">BRAND GROWTH PLAYBOOK</option>
                      <option value="RETAIL TRENDS">RETAIL TRENDS</option>
                      <option value="CONSUMER INSIGHTS">CONSUMER INSIGHTS</option>
                      <option value="COMPLIANCE & LEGAL">COMPLIANCE & LEGAL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Content Type
                    </label>
                    <input
                      type="text"
                      value={article.content_type || "PRACTICAL_GUIDE"}
                      onChange={(e) => setArticle({ ...article, content_type: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Author
                    </label>
                    <input
                      type="text"
                      value={article.author || "Compliance Operations Team"}
                      onChange={(e) => setArticle({ ...article, author: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                {/* Core Summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Core Executive Summary (KO)
                    </label>
                    <textarea
                      value={article.summary_ko || article.excerpt || ""}
                      onChange={(e) =>
                        setArticle({
                          ...article,
                          summary_ko: e.target.value,
                          excerpt: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Core Executive Summary (EN)
                    </label>
                    <textarea
                      value={article.summary_en || ""}
                      onChange={(e) => setArticle({ ...article, summary_en: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>

                {/* SEO Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      SEO Title
                    </label>
                    <input
                      type="text"
                      value={article.seo_title || ""}
                      onChange={(e) => setArticle({ ...article, seo_title: e.target.value })}
                      placeholder="SEO Title for search engines"
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      SEO Meta Description
                    </label>
                    <input
                      type="text"
                      value={article.meta_description || ""}
                      onChange={(e) => setArticle({ ...article, meta_description: e.target.value })}
                      placeholder="Concise search engine meta description"
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* Bilingual Structured Article Body Editor */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Article Body Content ({bodyLangTab === "KO" ? "Korean KO" : "English EN"})
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Supports inline links via [Label](https://...) or [Label](/insights/slug).
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
                    <button
                      type="button"
                      onClick={() => setBodyLangTab("KO")}
                      className={`rounded-md px-3 py-1 text-xs font-bold cursor-pointer ${
                        bodyLangTab === "KO"
                          ? "bg-blue-600 text-white shadow"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      KO Body ({(article.body_blocks_ko || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyLangTab("EN")}
                      className={`rounded-md px-3 py-1 text-xs font-bold cursor-pointer ${
                        bodyLangTab === "EN"
                          ? "bg-blue-600 text-white shadow"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      EN Body ({(article.body_blocks_en || []).length})
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                  {currentBodyBlocks.map((blk: any, bIdx: number) => {
                    const bType = String(blk?.type || "TEXT").toUpperCase();
                    return (
                      <div
                        key={bIdx}
                        className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                            #{bIdx + 1} · {bType}
                          </span>
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              type="button"
                              onClick={() => moveBlock(bIdx, -1)}
                              className="rounded px-2 py-0.5 border border-zinc-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 hover:bg-zinc-100 cursor-pointer"
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBlock(bIdx, 1)}
                              className="rounded px-2 py-0.5 border border-zinc-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 hover:bg-zinc-100 cursor-pointer"
                              title="Move Down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlockAt(bIdx)}
                              className="rounded px-2 py-0.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {bType === "CHECKLIST" ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={blk.title || ""}
                              onChange={(e) => updateBlockAt(bIdx, { title: e.target.value })}
                              placeholder="Checklist heading"
                              className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-950"
                            />
                            <textarea
                              rows={3}
                              value={Array.isArray(blk.items) ? blk.items.join("\n") : ""}
                              onChange={(e) =>
                                updateBlockAt(bIdx, {
                                  items: e.target.value.split("\n"),
                                })
                              }
                              placeholder="One checklist item per line"
                              className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                            />
                          </div>
                        ) : bType === "MARKET_DATA" ? (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                            <div className="font-semibold">
                              Table Columns: {(blk.headers || []).join(" | ")} ({(blk.rows || []).length} rows)
                            </div>
                          </div>
                        ) : bType === "RELATED_INSIGHT" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={blk.title || ""}
                              onChange={(e) => updateBlockAt(bIdx, { title: e.target.value })}
                              placeholder="Related guide title"
                              className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                            />
                            <input
                              type="text"
                              value={blk.href || ""}
                              onChange={(e) => updateBlockAt(bIdx, { href: e.target.value })}
                              placeholder="/insights/target-slug"
                              className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-950"
                            />
                            <input
                              type="text"
                              value={blk.description || ""}
                              onChange={(e) => updateBlockAt(bIdx, { description: e.target.value })}
                              placeholder="Brief cross-link description"
                              className="md:col-span-2 w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                            />
                          </div>
                        ) : bType === "PDF_DOWNLOAD" ? (
                          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                            Renders the attached PDF Guide Download Card at this position in the article.
                          </p>
                        ) : (
                          <textarea
                            rows={bType === "HEADING" ? 1 : 3}
                            value={blk.value ?? blk.content ?? ""}
                            onChange={(e) =>
                              updateBlockAt(bIdx, { value: e.target.value, content: undefined })
                            }
                            className="w-full rounded border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-500">Add Block:</span>
                  {[
                    { type: "HEADING", label: "+ Heading" },
                    { type: "TEXT", label: "+ Paragraph" },
                    { type: "KEY_TAKEAWAY", label: "+ Key Takeaway" },
                    { type: "CHECKLIST", label: "+ Checklist" },
                    { type: "RELATED_INSIGHT", label: "+ Related Guide Link" },
                    { type: "PDF_DOWNLOAD", label: "+ PDF Download Card" },
                  ].map((btn) => (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => addNewBlock(btn.type)}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: PDF Attachment Manager + Score Breakdown & Critical Conditions */}
            <div className="space-y-6">
              {/* PDF Guide Attachment Management Card */}
              <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-900/60 dark:bg-zinc-950 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Downloadable PDF Guide
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Original PDF attachment for public login-free download once published.
                    </p>
                  </div>
                </div>

                {pdfFeedback && (
                  <div
                    className={`rounded-lg p-2.5 text-xs font-medium ${
                      pdfFeedback.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
                    }`}
                  >
                    {pdfFeedback.text}
                  </div>
                )}

                {pdfAtt ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60 space-y-2 text-xs">
                    <div className="font-bold text-zinc-900 dark:text-white break-all">
                      {pdfAtt.file_name}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span>{pdfAtt.page_count} Pages</span>
                      <span>•</span>
                      <span>{formatFileSize(pdfAtt.file_size)}</span>
                      <span>•</span>
                      <span>{pdfAtt.mime_type}</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 break-all">
                      SHA-256: {pdfAtt.sha256}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      <a
                        href={`/api/admin/insights/${article.id}/attachment`}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
                      >
                        Download / Verify PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
                      >
                        {isUploadingPdf ? "Uploading..." : "Replace PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePdf}
                        disabled={isUploadingPdf}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-700 space-y-2">
                    <p className="text-xs text-zinc-500">No PDF guide attached yet.</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPdf}
                      className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isUploadingPdf ? "Uploading PDF..." : "Upload Original PDF"}
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />

                {/* Download Card UI Copy Fields */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  <div className="font-bold text-zinc-800 dark:text-zinc-200">
                    Public Download Card Labels
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">
                      Card Title (KO)
                    </label>
                    <input
                      type="text"
                      value={pdfCardMeta.card_title_ko}
                      onChange={(e) =>
                        setPdfCardMeta({ ...pdfCardMeta, card_title_ko: e.target.value })
                      }
                      placeholder="예: MoCRA 직접 등록 가이드 PDF"
                      className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">
                      Card Description (KO)
                    </label>
                    <input
                      type="text"
                      value={pdfCardMeta.card_description_ko}
                      onChange={(e) =>
                        setPdfCardMeta({ ...pdfCardMeta, card_description_ko: e.target.value })
                      }
                      placeholder="예: 25페이지 | 2026 Updated Edition"
                      className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">
                      Button Text (KO)
                    </label>
                    <input
                      type="text"
                      value={pdfCardMeta.button_label_ko}
                      onChange={(e) =>
                        setPdfCardMeta({ ...pdfCardMeta, button_label_ko: e.target.value })
                      }
                      className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">
                      Card Title (EN)
                    </label>
                    <input
                      type="text"
                      value={pdfCardMeta.card_title_en}
                      onChange={(e) =>
                        setPdfCardMeta({ ...pdfCardMeta, card_title_en: e.target.value })
                      }
                      placeholder="e.g. FDA MoCRA Direct Registration Guide PDF"
                      className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-0.5">
                      Card Description (EN)
                    </label>
                    <input
                      type="text"
                      value={pdfCardMeta.card_description_en}
                      onChange={(e) =>
                        setPdfCardMeta({ ...pdfCardMeta, card_description_en: e.target.value })
                      }
                      placeholder="e.g. 25 Pages | 2026 Updated Edition"
                      className="w-full rounded border border-zinc-300 bg-white p-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  {pdfAtt && (
                    <button
                      type="button"
                      onClick={handleSavePdfCardLabels}
                      disabled={isUploadingPdf}
                      className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      Save PDF Card Labels
                    </button>
                  )}
                </div>
              </div>

              {/* Critical Conditions Check Results */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                  Critical Conditions Audit
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Evidence Quality</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.evidence_quality || "PASS"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Duplicate Check</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.duplicate_check || "PASS"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Claim Validation</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.claim_validation || "PASS"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">Audience Relevance</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {criticalConds.audience_relevance || "PASS"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Topic Score Breakdown */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                    Topic Score Weightings
                  </h4>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                    {article.topic_score || 85} / 100
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Relevance (Max 25)", val: topicScoreBreakdown.relevance || 25, max: 25 },
                    { label: "Actionability (Max 25)", val: topicScoreBreakdown.actionability || 25, max: 25 },
                    { label: "Evidence Strength (Max 20)", val: topicScoreBreakdown.evidence_strength || 20, max: 20 },
                    { label: "Timeliness (Max 15)", val: topicScoreBreakdown.timeliness || 15, max: 15 },
                    { label: "Originality (Max 10)", val: topicScoreBreakdown.originality || 10, max: 10 },
                    { label: "Strategic Fit (Max 5)", val: topicScoreBreakdown.strategic_fit || 5, max: 5 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
                        <span>{item.label}</span>
                        <span>{item.val}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${(item.val / item.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB B: K SELECT NETWORK */}
        {activeTab === "NETWORK" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  K SELECT NETWORK Version (Target: K-Beauty Brands & Manufacturers)
                </h3>
                <p className="text-xs text-zinc-500">
                  Published to https://www.kselectnetwork.com/insights when article status is PUBLISHED.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span>NETWORK Enabled:</span>
                <input
                  type="checkbox"
                  checked={article.network_enabled !== false}
                  onChange={(e) => setArticle({ ...article, network_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Takeaway (Korean KO)
                </label>
                <textarea
                  value={article.network_brand_takeaway_ko || article.brand_takeaway || ""}
                  onChange={(e) =>
                    setArticle({
                      ...article,
                      network_brand_takeaway_ko: e.target.value,
                      brand_takeaway: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Takeaway (English EN)
                </label>
                <textarea
                  value={article.network_brand_takeaway_en || ""}
                  onChange={(e) =>
                    setArticle({ ...article, network_brand_takeaway_en: e.target.value })
                  }
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Action Checklist (KO — one per line)
                </label>
                <textarea
                  value={
                    Array.isArray(article.network_brand_actions_ko)
                      ? article.network_brand_actions_ko.join("\n")
                      : ""
                  }
                  onChange={(e) => {
                    const list = e.target.value.split("\n");
                    setArticle({
                      ...article,
                      network_brand_actions_ko: list,
                      brand_actions: list,
                    });
                  }}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Action Checklist (EN — one per line)
                </label>
                <textarea
                  value={
                    Array.isArray(article.network_brand_actions_en)
                      ? article.network_brand_actions_en.join("\n")
                      : ""
                  }
                  onChange={(e) =>
                    setArticle({
                      ...article,
                      network_brand_actions_en: e.target.value.split("\n"),
                    })
                  }
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB C: K SELECT HUB */}
        {activeTab === "HUB" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  K SELECT HUB Version (Target: U.S. Retailers)
                </h3>
                <p className="text-xs text-zinc-500">
                  Leave unchecked when targeting K SELECT NETWORK ONLY.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span>HUB Enabled:</span>
                <input
                  type="checkbox"
                  checked={article.hub_enabled !== false}
                  onChange={(e) => setArticle({ ...article, hub_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Retailer Takeaway (Korean KO)
                </label>
                <textarea
                  value={article.hub_retailer_takeaway_ko || ""}
                  onChange={(e) =>
                    setArticle({ ...article, hub_retailer_takeaway_ko: e.target.value })
                  }
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Retailer Takeaway (English EN)
                </label>
                <textarea
                  value={article.hub_retailer_takeaway_en || article.retailer_takeaway || ""}
                  onChange={(e) =>
                    setArticle({
                      ...article,
                      hub_retailer_takeaway_en: e.target.value,
                      retailer_takeaway: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB D: VISUALS & ASSETS */}
        {activeTab === "VISUALS" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Cover Visual & Attached Assets
                </h3>
                <p className="text-xs text-zinc-500">
                  Manage featured cover visual and review attached downloadable PDF guide metadata.
                </p>
              </div>
              <span
                className={`rounded px-2.5 py-1 text-xs font-bold ${
                  article.visual_status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                Visual Status: {article.visual_status || "APPROVED"}
              </span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-900 dark:text-white">
                Hero / Cover Image URL
              </label>
              <input
                type="text"
                value={article.hero_image || ""}
                onChange={(e) => setArticle({ ...article, hero_image: e.target.value })}
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
              {article.hero_image && (
                <div className="h-44 w-80 rounded-lg bg-zinc-100 overflow-hidden border border-zinc-200 dark:border-zinc-800">
                  <img
                    src={article.hero_image}
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB E: SOURCES & CLAIMS */}
        {activeTab === "SOURCES" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-6">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Official Sources & Claim Validation
              </h3>
              <p className="text-xs text-zinc-500">
                Primary official FDA references and compliance verification sources.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                Registered Sources
              </h4>
              <ul className="space-y-2 text-xs">
                {(article.sources_detail && article.sources_detail.length > 0
                  ? article.sources_detail
                  : article.sources || []
                ).map((src: any, idx: number) => (
                  <li
                    key={idx}
                    className="rounded-lg border border-zinc-200 p-3 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {typeof src === "string"
                          ? src
                          : src.name || src.sourceName || src.title || src.sourceTitle}
                      </span>
                      {src.url && (
                        <div className="text-[11px] text-blue-600 break-all">{src.url}</div>
                      )}
                    </div>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                      Tier {src.tier || "A"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB F: REVISIONS & HISTORY */}
        {activeTab === "HISTORY" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Revision Request History ({revisions.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setIsRevisionModalOpen(true)}
                  className="rounded bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                >
                  + Request Revision
                </button>
              </div>

              {revisions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-4 text-center">
                  No revision requests submitted yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {revisions.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="rounded-lg border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-950 dark:bg-rose-950/20 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                        <span>
                          Rev #{rev.revision_number} — {rev.target_section}
                        </span>
                        <span className="text-[10px] text-rose-600 font-bold">
                          {rev.resolution_status}
                        </span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                      <div className="text-[10px] text-zinc-400 pt-1">
                        By {rev.requested_by} •{" "}
                        {new Date(rev.requested_at || rev.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
                Version Snapshot Timeline ({versionHistory.length})
              </h3>

              {versionHistory.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-4 text-center">
                  V1 Initial version recorded.
                </p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto">
                  {versionHistory.map((vh: any) => (
                    <div
                      key={vh.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                        <span>Version {vh.version_number}</span>
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {vh.change_type}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400">{vh.review_note}</p>
                      <div className="text-[10px] text-zinc-400">
                        Changed by {vh.changed_by} •{" "}
                        {new Date(vh.changed_at || vh.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Modal */}
      <InsightPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        article={article}
      />

      {/* Revision Request Modal */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Submit Revision Request
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Target Section
              </label>
              <select
                value={revisionSection}
                onChange={(e) => setRevisionSection(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="CORE">CORE (Title, Summary, Body, PDF)</option>
                <option value="NETWORK">K SELECT NETWORK (Brand Action)</option>
                <option value="HUB">K SELECT HUB (Retailer Action)</option>
                <option value="VISUALS">VISUALS & ASSETS</option>
                <option value="SOURCES">SOURCES & CLAIMS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Revision Feedback Comment
              </label>
              <textarea
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                rows={4}
                placeholder="Enter feedback for revision..."
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRevisionRequest}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
