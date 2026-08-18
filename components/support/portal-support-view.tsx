"use client";

import React, { useState, useMemo } from "react";
import type { PartnerInquiryItem, CaseStatus, InquiryMessageItem, OfficialCaseStatus } from "@/lib/inquiry/types";
import {
  getNormalizedStatus,
  OFFICIAL_STATUS_LABEL,
  OFFICIAL_STATUS_COLOR,
  OFFICIAL_STATUS_EMOJI,
} from "@/lib/inquiry/types";
import {
  resolvePartnerInquiryAction,
  replyToPartnerInquiry,
  closeCase,
  submitSatisfactionRating
} from "@/lib/inquiry/actions";

interface PortalSupportViewProps {
  initialInquiries: PartnerInquiryItem[];
  createAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  product:     "제품 등록 및 스펙 수정",
  onboarding:  "입점 신청 및 심사 현황",
  logistics:   "물류 공급 및 패키징",
  translation: "번역 및 전성분표 기재",
  system:      "시스템 오류 제보 및 기능 제안",
  general:     "기타 일반 문의"
};

const MSG_TYPE_META: Record<string, { icon: string; style: string }> = {
  action_required: { icon: "⚠️", style: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300" },
  action_resolved: { icon: "✅", style: "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300" },
  status_change:   { icon: "🔄", style: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  case_closed:     { icon: "🔒", style: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  satisfaction:    { icon: "⭐", style: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300" }
};

export function PortalSupportView({ initialInquiries, createAction }: PortalSupportViewProps) {
  const [inquiries, setInquiries] = useState<PartnerInquiryItem[]>(initialInquiries);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<PartnerInquiryItem | null>(null);

  // Detail View Tab: 'conversation' vs 'caselog'
  const [activeTab, setActiveTab] = useState<"conversation" | "caselog">("conversation");

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OfficialCaseStatus>("ALL");

  // New case form & Follow-up
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [previousCaseId, setPreviousCaseId] = useState<string | null>(null);
  const [newCaseFile, setNewCaseFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Action resolution
  const [isResolving, setIsResolving] = useState(false);

  // Thread reply
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyError, setReplyError] = useState("");

  // Case close & Rating modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [satisfaction, setSatisfaction] = useState<number>(5);
  const [satisfactionComment, setSatisfactionComment] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatEnDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const isClosed = selectedInquiry ? getNormalizedStatus(selectedInquiry.status) === "CLOSED" : false;

  // Filter & Search inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((item) => {
      const normalized = getNormalizedStatus(item.status);
      if (statusFilter !== "ALL" && normalized !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchContent = item.content.toLowerCase().includes(q);
        const matchCaseNumber = item.case_number?.toLowerCase().includes(q);
        const matchCategory = (CATEGORY_LABELS[item.category] || item.category).toLowerCase().includes(q);
        const matchMessages = item.messages?.some((m) => m.content.toLowerCase().includes(q));

        if (!matchTitle && !matchContent && !matchCaseNumber && !matchCategory && !matchMessages) {
          return false;
        }
      }
      return true;
    });
  }, [inquiries, statusFilter, searchQuery]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError("");

    if (!title.trim()) { setSubmitError("제목을 입력해주세요."); return; }
    if (!content.trim()) { setSubmitError("내용을 입력해주세요."); return; }

    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    if (previousCaseId) {
      fd.append("previous_case_id", previousCaseId);
    }
    try {
      const res = await createAction(fd);
      if (res.success) {
        setIsWriteOpen(false);
        setTitle(""); setContent(""); setCategory("general"); setPreviousCaseId(null);
        window.location.reload();
      } else {
        setSubmitError(res.error || "등록에 실패했습니다.");
      }
    } catch {
      setSubmitError("서버 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUpInquiry = (prevInquiry: PartnerInquiryItem) => {
    setPreviousCaseId(prevInquiry.id);
    setCategory(prevInquiry.category || "general");
    setTitle(prevInquiry.title.startsWith("Re:") ? prevInquiry.title : `Re: ${prevInquiry.title}`);
    setContent("");
    setSubmitError("");
    setIsWriteOpen(true);
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setIsRatingSubmitting(true);
    try {
      const res = await submitSatisfactionRating(selectedInquiry.id, satisfaction, satisfactionComment.trim() || null);
      if (res.success) {
        setShowRatingModal(false);
        window.location.reload();
      }
    } catch {
      // error handled
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setReplyError("");
    if (!replyText.trim()) { setReplyError("내용을 입력해주세요."); return; }
    setIsReplying(true);
    try {
      const res = await replyToPartnerInquiry(selectedInquiry.id, replyText, replyFile);
      if (res.success) {
        setReplyText(""); setReplyFile(null);
        window.location.reload();
      } else {
        setReplyError(res.error || "등록 실패");
      }
    } catch {
      setReplyError("서버 오류가 발생했습니다.");
    } finally {
      setIsReplying(false);
    }
  };

  const handleResolveAction = async () => {
    if (!selectedInquiry) return;
    setIsResolving(true);
    try {
      const res = await resolvePartnerInquiryAction(selectedInquiry.id);
      if (res.success) window.location.reload();
    } catch {}
    finally { setIsResolving(false); }
  };

  const handleCloseCase = async () => {
    if (!selectedInquiry) return;
    setIsClosing(true);
    try {
      const score = satisfaction > 0 ? satisfaction : null;
      const comment = satisfactionComment.trim() || null;
      const res = await closeCase(selectedInquiry.id, score, comment);
      if (res.success) {
        setShowCloseModal(false);
        window.location.reload();
      }
    } catch {}
    finally { setIsClosing(false); }
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb & Header */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Portal / 문의 지원
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">문의 지원</h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">K SELECT NETWORK 전용 1:1 케이스 및 온라인 문의 지원 현황입니다.</p>
          </div>
          <button
            onClick={() => { setPreviousCaseId(null); setTitle(""); setContent(""); setSubmitError(""); setIsWriteOpen(!isWriteOpen); setSelectedInquiry(null); }}
            className="rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            + 새 문의 작성
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Left: Case List & Search/Filter */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="케이스 검색 (번호, 제목, 내용)... / Search cases..."
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700 shadow-2xs"
            />
          </div>

          {/* Official 4 Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
            {[
              { key: "ALL", label: "전체" },
              { key: "RECEIVED", label: "접수됨" },
              { key: "UNDER_REVIEW", label: "검토중" },
              { key: "ACTION_REQUIRED", label: "조치필요" },
              { key: "CLOSED", label: "종료됨" },
            ].map((tab) => {
              const isSelected = statusFilter === tab.key;
              const count = tab.key === "ALL"
                ? inquiries.length
                : inquiries.filter((i) => getNormalizedStatus(i.status) === tab.key).length;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`rounded-lg px-2.5 py-1.5 font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-955 shadow-xs"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                케이스 목록 ({filteredInquiries.length})
              </span>
              <span className="text-[10px] text-zinc-400">
                {inquiries.filter((i) => getNormalizedStatus(i.status) === "ACTION_REQUIRED").length > 0 && (
                  <span className="text-rose-500 font-bold">
                    🔴 조치 {inquiries.filter((i) => getNormalizedStatus(i.status) === "ACTION_REQUIRED").length}건
                  </span>
                )}
              </span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredInquiries.length > 0 ? (
                filteredInquiries.map((item) => {
                  const normStatus = getNormalizedStatus(item.status);
                  const isItemClosed = normStatus === "CLOSED";

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedInquiry(item);
                        setIsWriteOpen(false);
                        setReplyText("");
                        setReplyFile(null);
                        setReplyError("");
                        setShowCloseModal(false);
                      }}
                      className={`p-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-all ${
                        selectedInquiry?.id === item.id
                          ? "bg-zinc-50/80 dark:bg-zinc-950/30 border-l-2 border-zinc-950 dark:border-white pl-3.5"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px]">{OFFICIAL_STATUS_EMOJI[normStatus]}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${OFFICIAL_STATUS_COLOR[normStatus]}`}>
                            {OFFICIAL_STATUS_LABEL[normStatus].ko}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{formatDate(item.created_at)}</span>
                      </div>
                      {item.case_number && (
                        <p className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 mb-0.5">{item.case_number}</p>
                      )}
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{item.content}</p>
                      {normStatus === "ACTION_REQUIRED" && (
                        <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 mt-1">⚠️ 조치 요청 수신 — 확인 필요</p>
                      )}
                      {isItemClosed && (
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1">🔒 종료된 케이스 (Read Only)</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  {searchQuery.trim() || statusFilter !== "ALL"
                    ? "검색/필터 조건과 일치하는 케이스가 없습니다."
                    : "등록된 케이스가 없습니다."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail or Write Form */}
        <div className="lg:col-span-3 space-y-4">
          {/* New Case Form */}
          {isWriteOpen && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">새 케이스 등록</h3>
                <button onClick={() => setIsWriteOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer">닫기</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                {submitError && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                    {submitError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">문의 유형</label>
                  <select
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">제목 <span className="text-rose-500">*</span></label>
                  <input
                    name="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="케이스 제목을 입력해주세요."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">내용 <span className="text-rose-500">*</span></label>
                  <textarea
                    name="content"
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="문의 내용을 자세히 입력해주세요."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors leading-relaxed resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">첨부파일 (최대 20MB)</label>
                  {!newCaseFile ? (
                    <input
                      name="file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 20 * 1024 * 1024) {
                            alert("첨부파일은 최대 20MB까지 업로드할 수 있습니다.\nAttachment files must be 20MB or smaller.");
                            e.target.value = "";
                            setNewCaseFile(null);
                            return;
                          }
                          setNewCaseFile(file);
                        }
                      }}
                      className="block w-full text-[10px] text-zinc-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                    />
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span>📎</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{newCaseFile.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">({formatFileSize(newCaseFile.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewCaseFile(null)}
                        className="rounded px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20 cursor-pointer shrink-0"
                      >
                        [삭제]
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  {isSubmitting ? "등록 중..." : "케이스 제출하기"}
                </button>
              </form>
            </div>
          )}

          {/* Case Detail */}
          {selectedInquiry && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
              {/* Case Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedInquiry.case_number && (
                        <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500">#{selectedInquiry.case_number}</span>
                      )}
                      <span className={`rounded px-2 py-0.5 text-[9px] font-bold border ${OFFICIAL_STATUS_COLOR[getNormalizedStatus(selectedInquiry.status)]}`}>
                        {OFFICIAL_STATUS_EMOJI[getNormalizedStatus(selectedInquiry.status)]} {OFFICIAL_STATUS_LABEL[getNormalizedStatus(selectedInquiry.status)].ko}
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 dark:text-zinc-400">
                        {CATEGORY_LABELS[selectedInquiry.category] || selectedInquiry.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">{selectedInquiry.title}</h3>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500">
                      접수: {formatDate(selectedInquiry.created_at)}
                      {selectedInquiry.closed_at ? ` · 종료: ${formatDate(selectedInquiry.closed_at)}` : ""}
                    </p>
                  </div>
                  <button onClick={() => setSelectedInquiry(null)} className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer shrink-0">닫기</button>
                </div>

                {/* Follow-up Indicator Banner */}
                {selectedInquiry.previous_case_id && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20 text-[10px] font-medium text-blue-800 dark:text-blue-300 flex items-center justify-between">
                    <span>💡 이 문의는 이전 문의의 후속 문의입니다. {selectedInquiry.previous_case_number ? `(이전 문의: #${selectedInquiry.previous_case_number})` : ""}</span>
                  </div>
                )}

                {/* Action Required Banner */}
                {selectedInquiry.status === "action_required" && (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 dark:border-rose-950/40 dark:bg-rose-950/10 space-y-2">
                    <p className="text-xs font-extrabold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      ⚠️ 어드민에서 조치를 요청했습니다
                    </p>
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 leading-relaxed">
                      대화 기록을 확인하신 후 필요한 조치를 완료해 주세요. 완료 후 아래 버튼을 눌러 주세요.
                    </p>
                    <button
                      onClick={handleResolveAction}
                      disabled={isResolving}
                      className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 text-[10px] tracking-wide transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isResolving ? "제출 중..." : "✅ 조치 완료 표시하기"}
                    </button>
                  </div>
                )}

                {/* Tab Switcher: Conversation vs Case Log */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800 pt-2 gap-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("conversation")}
                    className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === "conversation"
                        ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    💬 대화 내용 (Conversation)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("caselog")}
                    className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === "caselog"
                        ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    📋 처리 기록 (Case Log)
                  </button>
                </div>
              </div>

              {/* Tab 1: Conversation (Human Messages Only) */}
              {activeTab === "conversation" && (
                <div className="p-5 space-y-3">
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {(selectedInquiry.messages ?? []).filter((m) => m.messageType === "message").length > 0 ? (
                      (selectedInquiry.messages ?? [])
                        .filter((m) => m.messageType === "message")
                        .map((msg) => {
                          const isAdmin = msg.senderType === "admin";
                          return (
                            <div key={msg.id} className={`flex flex-col gap-1 ${isAdmin ? "items-start" : "items-end"}`}>
                              <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
                                {isAdmin && <span className="font-bold text-zinc-600 dark:text-zinc-300">{msg.senderName} (어드민)</span>}
                                <span>{formatDate(msg.createdAt)}</span>
                                {!isAdmin && <span className="font-bold text-zinc-600 dark:text-zinc-300">나</span>}
                              </div>
                              <div
                                className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                                  isAdmin
                                    ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded-tl-sm"
                                    : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-tr-sm"
                                } ${msg.isActionFlag ? "border-2 border-rose-400 dark:border-rose-600" : ""}`}
                              >
                                {msg.isActionFlag && (
                                  <div className="text-[9px] font-bold text-rose-400 mb-1.5 flex items-center gap-1">
                                    ⚠️ 조치 요청 포함 메시지
                                  </div>
                                )}
                                {msg.content}
                                {msg.attachmentUrl && (
                                  <div className="mt-2 flex items-center gap-1 text-[9px] font-bold opacity-75">
                                    <span>📎</span>
                                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                      {msg.attachmentFilename || "첨부파일"}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <p className="text-[11px] text-zinc-400 text-center py-4">등록된 메시지가 없습니다.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Case Log (Timeline Events) */}
              {activeTab === "caselog" && (
                <div className="p-5 space-y-3">
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {/* Log Event 1: Initial Creation */}
                    <div className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                      <span className="text-xs">📥</span>
                      <div className="space-y-0.5">
                        <p className="font-bold text-zinc-900 dark:text-white">문의 접수</p>
                        <p className="text-[10px] text-zinc-400">{formatDate(selectedInquiry.created_at)} · 파트너사 문의 등록 완료</p>
                      </div>
                    </div>

                    {/* Thread Events */}
                    {(selectedInquiry.messages ?? [])
                      .filter((m) => m.messageType !== "message")
                      .map((msg) => {
                        const meta = MSG_TYPE_META[msg.messageType] || { icon: "ℹ️", style: "bg-zinc-100 text-zinc-500" };
                        return (
                          <div key={msg.id} className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                            <span className="text-xs">{meta.icon}</span>
                            <div className="space-y-0.5">
                              <p className="font-bold text-zinc-900 dark:text-white">{msg.senderName}</p>
                              <p className="text-[10px] text-zinc-400">{formatDate(msg.createdAt)} · {msg.content}</p>
                            </div>
                          </div>
                        );
                      })}

                    {/* Log Event: Closed */}
                    {isClosed && (
                      <div className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="text-xs">🔒</span>
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-900 dark:text-white">문의 종료됨 (Closed)</p>
                          <p className="text-[10px] text-zinc-400">
                            {selectedInquiry.closed_at ? formatDate(selectedInquiry.closed_at) : formatDate(selectedInquiry.updated_at)}
                            {selectedInquiry.closed_by_side ? ` · ${selectedInquiry.closed_by_side === "admin" ? "어드민 담당자" : "파트너사"} 종료` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reply Section (Active Case Only) */}
              {!isClosed && (
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                  <form onSubmit={handleReplySubmit} className="space-y-3 text-xs">
                    {replyError && (
                      <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                        {replyError}
                      </div>
                    )}
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="추가 메시지를 입력하세요."
                      className="w-full rounded-lg border border-zinc-200 p-2.5 outline-none bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:border-zinc-950 dark:focus:border-white focus:bg-zinc-50 dark:focus:bg-zinc-900 transition-colors leading-relaxed resize-none"
                    />
                    <div className="space-y-1.5">
                      <label className="font-bold text-zinc-600 dark:text-zinc-400 block text-[10px]">첨부파일 (최대 20MB)</label>
                      {!replyFile ? (
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 20 * 1024 * 1024) {
                                alert("첨부파일은 최대 20MB까지 업로드할 수 있습니다.\nAttachment files must be 20MB or smaller.");
                                e.target.value = "";
                                setReplyFile(null);
                                return;
                              }
                              setReplyFile(file);
                            }
                          }}
                          className="block w-full text-[10px] text-zinc-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                        />
                      ) : (
                        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span>📎</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{replyFile.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">({formatFileSize(replyFile.size)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyFile(null)}
                            className="rounded px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20 cursor-pointer shrink-0"
                          >
                            [삭제]
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isReplying || !replyText.trim()}
                        className="flex-1 rounded-lg bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        {isReplying ? "등록 중..." : "메시지 보내기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCloseModal(true)}
                        className="rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                      >
                        문의 종료
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Closed Case Actions & Rating Section */}
              {isClosed && (
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <span>🔒</span>
                        <span>이 문의는 종료되었습니다. / This inquiry has been closed.</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSatisfaction(selectedInquiry.satisfaction_score || 5);
                          setSatisfactionComment(selectedInquiry.satisfaction_comment || "");
                          setShowRatingModal(true);
                        }}
                        className="text-[10px] font-bold text-amber-600 hover:underline dark:text-amber-400 cursor-pointer"
                      >
                        {selectedInquiry.satisfaction_score ? "★ 만족도 수정하기" : "⭐ 만족도 평가하기"}
                      </button>
                    </div>

                    {selectedInquiry.satisfaction_score ? (
                      <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                        <span className="text-amber-500 font-bold">
                          {"★".repeat(selectedInquiry.satisfaction_score)}{"☆".repeat(5 - selectedInquiry.satisfaction_score)} ({selectedInquiry.satisfaction_score}점)
                        </span>
                        {selectedInquiry.satisfaction_comment && (
                          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">"{selectedInquiry.satisfaction_comment}"</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400">아직 만족도 평가가 작성되지 않았습니다. 지원 경험을 평가해주세요.</p>
                    )}
                  </div>

                  {/* Follow-up CTA */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleFollowUpInquiry(selectedInquiry)}
                      className="rounded-xl bg-zinc-950 dark:bg-white px-4 py-2.5 text-xs font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🔄 후속 문의하기</span>
                      <span className="text-[10px] opacity-75 font-normal">(Start a Follow-up)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isWriteOpen && !selectedInquiry && (
            <div className="rounded-xl border border-zinc-200 border-dashed bg-zinc-50/20 p-10 shadow-sm dark:border-zinc-800 text-center space-y-2.5">
              <span className="text-3xl">💬</span>
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">문의를 선택하세요</h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[200px] mx-auto leading-normal">
                좌측 목록에서 문의를 클릭하거나, 새 문의를 작성해 주세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Close Case Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">문의 종료</h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                문의가 해결되었나요? 이 케이스를 종료하시겠습니까?<br />
                <span className="text-[10px] text-zinc-400">Has your issue been resolved? Would you like to close this case?</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">담당자 응대 만족도 (선택)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setSatisfaction(satisfaction === score ? 0 : score)}
                    className={`flex-1 py-2 rounded-lg border text-lg transition-all cursor-pointer ${
                      satisfaction >= score
                        ? "bg-yellow-400 border-yellow-500 dark:bg-yellow-500 dark:border-yellow-600 text-white"
                        : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">추가 의견 (선택)</label>
              <textarea
                rows={3}
                value={satisfactionComment}
                onChange={(e) => setSatisfactionComment(e.target.value)}
                placeholder="지원 서비스에 대한 의견을 자유롭게 남겨주세요."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors leading-relaxed resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                onClick={handleCloseCase}
                disabled={isClosing}
                className="flex-1 rounded-lg bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                {isClosing ? "종료 중..." : "🔒 케이스 종료하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Satisfaction Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">파트너 만족도 평가</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                종료된 문의 서비스에 대해 만족도를 평가해주세요.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setSatisfaction(score)}
                    className={`flex-1 py-2 rounded-lg border text-lg transition-all cursor-pointer ${
                      satisfaction >= score
                        ? "bg-yellow-400 border-yellow-500 text-white dark:bg-yellow-500 dark:border-yellow-600"
                        : "border-zinc-200 text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">추가 코멘트 (선택)</label>
              <textarea
                rows={3}
                value={satisfactionComment}
                onChange={(e) => setSatisfactionComment(e.target.value)}
                placeholder="지원 경험에 대해 남겨주실 의견이 있다면 작성해주세요."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors leading-relaxed resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                onClick={handleRatingSubmit}
                disabled={isRatingSubmitting}
                className="flex-1 rounded-lg bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                {isRatingSubmitting ? "제출 중..." : "⭐ 만족도 제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
