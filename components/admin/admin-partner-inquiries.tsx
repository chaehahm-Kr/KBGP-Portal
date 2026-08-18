"use client";

import React, { useState, useMemo } from "react";
import type { PartnerInquiryItem, CaseStatus, InquiryMessageItem, OfficialCaseStatus } from "@/lib/inquiry/types";
import {
  getNormalizedStatus,
  OFFICIAL_STATUS_LABEL,
  OFFICIAL_STATUS_COLOR,
  OFFICIAL_STATUS_EMOJI,
} from "@/lib/inquiry/types";
import { updateCaseStatus, closeCaseAdmin, answerAndClosePartnerInquiry } from "@/lib/inquiry/actions";

interface AdminPartnerInquiriesProps {
  initialInquiries: PartnerInquiryItem[];
  answerAction: (inquiryId: string, replyContent: string, isActionRequired: boolean) => Promise<{ success: boolean; error?: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  product:     "제품 등록 및 스펙 수정",
  onboarding:  "입점 신청 및 심사 현황",
  logistics:   "물류 공급 및 패키징",
  translation: "번역 및 전성분표 기재",
  system:      "시스템 오류 제보 및 기능 제안",
  general:     "기타 일반 문의"
};

const MSG_TYPE_LABEL: Record<string, { icon: string; label: string; style: string }> = {
  action_required: { icon: "⚠️", label: "조치요청", style: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300" },
  action_resolved: { icon: "✅", label: "조치완료", style: "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300" },
  status_change:   { icon: "🔄", label: "상태변경", style: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  case_closed:     { icon: "🔒", label: "케이스종료", style: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  satisfaction:    { icon: "⭐", label: "만족도", style: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300" }
};

export function AdminPartnerInquiries({ initialInquiries, answerAction }: AdminPartnerInquiriesProps) {
  const [inquiries, setInquiries] = useState<PartnerInquiryItem[]>(initialInquiries);
  const [selectedInquiry, setSelectedInquiry] = useState<PartnerInquiryItem | null>(null);

  // Detail View Tab: 'conversation' vs 'caselog'
  const [activeTab, setActiveTab] = useState<"conversation" | "caselog">("conversation");

  // Default Multi-Select Statuses: Active 3 Statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED)
  const [selectedStatuses, setSelectedStatuses] = useState<OfficialCaseStatus[]>([
    "RECEIVED",
    "UNDER_REVIEW",
    "ACTION_REQUIRED"
  ]);
  const [searchTerm, setSearchTerm] = useState("");

  // Reply & Reply+Close states
  const [replyText, setReplyText] = useState("");
  const [isActionRequired, setIsActionRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showDirectCloseConfirmModal, setShowDirectCloseConfirmModal] = useState(false);

  // Status update states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setSubmitError("");

    if (!replyText.trim()) {
      setSubmitError("답변 내용을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await answerAction(selectedInquiry.id, replyText, isActionRequired);
      if (res.success) {
        setReplyText("");
        setIsActionRequired(false);
        window.location.reload();
      } else {
        setSubmitError(res.error || "답변 등록에 실패했습니다.");
      }
    } catch (err) {
      setSubmitError("서버 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!selectedInquiry) return;
    setIsUpdatingStatus(true);
    try {
      await updateCaseStatus(selectedInquiry.id, newStatus);
      window.location.reload();
    } catch {
      setSubmitError("상태 변경에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDirectCloseSubmit = async () => {
    if (!selectedInquiry) return;
    setIsClosing(true);
    try {
      await closeCaseAdmin(selectedInquiry.id);
      setShowDirectCloseConfirmModal(false);
      window.location.reload();
    } catch {
      setSubmitError("케이스 종료에 실패했습니다.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleAnswerAndCloseSubmit = async () => {
    if (!selectedInquiry) return;
    setSubmitError("");

    if (!replyText.trim()) {
      setSubmitError("답변 내용을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await answerAndClosePartnerInquiry(selectedInquiry.id, replyText.trim());
      if (res.success) {
        setReplyText("");
        setIsActionRequired(false);
        setShowCloseConfirmModal(false);
        window.location.reload();
      } else {
        setSubmitError(res.error || "답변 등록 및 케이스 종료에 실패했습니다.");
      }
    } catch {
      setSubmitError("서버 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatusFilter = (statusKey: OfficialCaseStatus) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(statusKey)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((s) => s !== statusKey);
      } else {
        return [...prev, statusKey];
      }
    });
  };

  const filteredInquiries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return inquiries.filter((item) => {
      // Rule 8: When Keyword Search is Present -> Search ALL statuses (override status filter)
      if (q) {
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchContent = item.content.toLowerCase().includes(q);
        const matchCompany = item.companyName?.toLowerCase().includes(q);
        const matchCaseNumber = item.case_number?.toLowerCase().includes(q);
        const matchMessages = item.messages?.some((m) => m.content.toLowerCase().includes(q));

        return matchTitle || matchContent || matchCompany || matchCaseNumber || matchMessages;
      }

      // When NO keyword search -> apply Multi-Select Status Filter
      const norm = getNormalizedStatus(item.status);
      return selectedStatuses.includes(norm);
    });
  }, [inquiries, selectedStatuses, searchTerm]);

  const isClosed = selectedInquiry ? getNormalizedStatus(selectedInquiry.status) === "CLOSED" : false;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">케이스 관리</h2>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              파트너사 1:1 케이스 접수 및 처리 현황입니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-zinc-400">전체 {inquiries.length}건</span>
            {inquiries.filter((i) => getNormalizedStatus(i.status) !== "CLOSED").length > 0 && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                🔴 처리필요 {inquiries.filter((i) => getNormalizedStatus(i.status) !== "CLOSED").length}건
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Case List */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search & Multi-Select Status Filter */}
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="케이스 검색 (번호, 제목, 내용, 회사명, 대화)..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700 shadow-2xs"
              />
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                >
                  [초기화]
                </button>
              )}
            </div>

            {/* Keyword Search Active Banner */}
            {searchTerm.trim() ? (
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-1 flex items-center justify-between">
                <span>🔍 검색 중 (종료 포함 모든 상태 검색)</span>
                <span className="opacity-75">{filteredInquiries.length}건 검색됨</span>
              </div>
            ) : (
              /* Multi-Select Status Checkbox Tabs */
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {[
                  { key: "RECEIVED", label: "접수됨" },
                  { key: "UNDER_REVIEW", label: "검토중" },
                  { key: "ACTION_REQUIRED", label: "조치필요" },
                  { key: "CLOSED", label: "종료됨" },
                ].map(({ key, label }) => {
                  const isChecked = selectedStatuses.includes(key as OfficialCaseStatus);
                  const count = inquiries.filter((i) => getNormalizedStatus(i.status) === key).length;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleStatusFilter(key as OfficialCaseStatus)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer border ${
                        isChecked
                          ? "bg-zinc-900 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-2xs"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700"
                      }`}
                    >
                      <span className="text-[9px]">{isChecked ? "☑" : "☐"}</span>
                      <span>{label}</span>
                      <span className="opacity-70 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Case List */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredInquiries.length > 0 ? (
                filteredInquiries.map((item) => {
                  const norm = getNormalizedStatus(item.status);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedInquiry(item);
                        setReplyText("");
                        setIsActionRequired(false);
                        setSubmitError("");
                      }}
                      className={`p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 cursor-pointer transition-all ${
                        selectedInquiry?.id === item.id ? "bg-zinc-50/80 dark:bg-zinc-950/30 border-l-2 border-zinc-950 dark:border-white pl-3.5" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px]">{OFFICIAL_STATUS_EMOJI[norm]}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${OFFICIAL_STATUS_COLOR[norm]}`}>
                            {OFFICIAL_STATUS_LABEL[norm].ko}
                          </span>
                          {item.case_number && (
                            <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">
                              {item.case_number}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 shrink-0">{formatDate(item.created_at)}</span>
                      </div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white leading-snug truncate">{item.title}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-semibold">{item.companyName}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{item.content}</p>
                      {norm === "ACTION_REQUIRED" && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                          <span>⚠️</span><span>조치 요청 중</span>
                        </div>
                      )}
                      {norm === "CLOSED" && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px]">
                          {item.satisfaction_score ? (
                            <span className="font-bold text-amber-500">
                              {"★".repeat(item.satisfaction_score)}{"☆".repeat(5 - item.satisfaction_score)} ({item.satisfaction_score}점)
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500 font-semibold">미평가 (Not rated)</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  해당 조건의 케이스가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Case Detail */}
        <div className="lg:col-span-3">
          {selectedInquiry ? (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-0">
              {/* Case Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedInquiry.case_number && (
                        <span className="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                          #{selectedInquiry.case_number}
                        </span>
                      )}
                      <span className={`rounded px-2 py-0.5 text-[9px] font-bold border ${OFFICIAL_STATUS_COLOR[getNormalizedStatus(selectedInquiry.status)]}`}>
                        {OFFICIAL_STATUS_EMOJI[getNormalizedStatus(selectedInquiry.status)]} {OFFICIAL_STATUS_LABEL[getNormalizedStatus(selectedInquiry.status)].ko}
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 dark:text-zinc-400">
                        {CATEGORY_LABELS[selectedInquiry.category] || selectedInquiry.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">{selectedInquiry.title}</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {selectedInquiry.companyName} · {formatDate(selectedInquiry.created_at)}
                      {selectedInquiry.closed_at ? ` · 종료: ${formatDate(selectedInquiry.closed_at)}` : ""}
                      {selectedInquiry.reopen_count ? ` · 재오픈 ${selectedInquiry.reopen_count}회` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedInquiry(null)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-white shrink-0 cursor-pointer"
                  >
                    닫기
                  </button>
                </div>

                {/* Previous Case Banner if Follow-up */}
                {selectedInquiry.previous_case_id && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20 text-[10px] font-medium text-blue-800 dark:text-blue-300 flex items-center justify-between">
                    <span>
                      💡 <strong>이전 문의 연결:</strong> {selectedInquiry.previous_case_number ? `#${selectedInquiry.previous_case_number}` : "이전 케이스"} · {selectedInquiry.previous_case_title || "이전 문의"}
                    </span>
                    {inquiries.find((i) => i.id === selectedInquiry.previous_case_id) && (
                      <button
                        type="button"
                        onClick={() => setSelectedInquiry(inquiries.find((i) => i.id === selectedInquiry.previous_case_id) || null)}
                        className="font-bold underline hover:text-blue-950 dark:hover:text-white cursor-pointer"
                      >
                        [이전 문의 보기]
                      </button>
                    )}
                  </div>
                )}

                {/* Status Toolbar */}
                {!isClosed && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-50 dark:border-zinc-800/60">
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">상태 변경:</span>
                    {([
                      { status: "in_review", label: "검토중" },
                      { status: "action_required", label: "조치필요" },
                    ] as { status: CaseStatus; label: string }[]).map(({ status: s, label }) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={isUpdatingStatus || selectedInquiry.status === s}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold transition-all disabled:opacity-40 cursor-pointer ${
                          selectedInquiry.status === s
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setShowDirectCloseConfirmModal(true)}
                      disabled={isClosing}
                      className="rounded px-2.5 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isClosing ? "종료 중..." : "🔒 케이스 종료 (답변 없이)"}
                    </button>
                  </div>
                )}
                {isClosed && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      이 케이스는 종료되었습니다. (종료시각: {selectedInquiry.closed_at ? formatDate(selectedInquiry.closed_at) : formatDate(selectedInquiry.updated_at)})
                    </span>
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
                    📋 Case Log (처리 기록)
                  </button>
                </div>
              </div>

              {/* Tab 1: Conversation (Human Messages Only) */}
              {activeTab === "conversation" && (
                <div className="p-5 space-y-3">
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {(selectedInquiry.messages ?? []).filter((m) => (m.messageType === "message" || m.messageType === "action_required" || m.messageType === "action_resolved") && m.content?.trim()).length > 0 ? (
                      (selectedInquiry.messages ?? [])
                        .filter((m) => (m.messageType === "message" || m.messageType === "action_required" || m.messageType === "action_resolved") && m.content?.trim())
                        .map((msg) => {
                          const isAdmin = msg.senderType === "admin";
                          return (
                            <div key={msg.id} className={`flex flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}>
                              <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
                                {!isAdmin && <span className="font-bold text-zinc-600 dark:text-zinc-300">{msg.senderName} (파트너)</span>}
                                <span>{formatDate(msg.createdAt)}</span>
                                {isAdmin && <span className="font-bold text-zinc-600 dark:text-zinc-300">{msg.senderName} (어드민)</span>}
                              </div>
                              <div
                                className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                                  isAdmin
                                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-tr-sm"
                                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded-tl-sm"
                                } ${msg.isActionFlag ? "border-2 border-rose-400 dark:border-rose-600" : ""}`}
                              >
                                {msg.isActionFlag && (
                                  <div className="text-[9px] font-bold text-rose-400 dark:text-rose-300 mb-1.5 flex items-center gap-1">
                                    ⚠️ 조치 요청 포함
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

              {/* Tab 2: Case Log (Audit & System Events) */}
              {activeTab === "caselog" && (
                <div className="p-5 space-y-3">
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    <div className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                      <span className="text-xs">📥</span>
                      <div className="space-y-0.5">
                        <p className="font-bold text-zinc-900 dark:text-white">케이스 접수</p>
                        <p className="text-[10px] text-zinc-400">{formatDate(selectedInquiry.created_at)} · {selectedInquiry.companyName}</p>
                      </div>
                    </div>

                    {(selectedInquiry.messages ?? [])
                      .filter((m) => m.messageType !== "message")
                      .map((msg) => {
                        const meta = MSG_TYPE_LABEL[msg.messageType] || { icon: "ℹ️", label: msg.messageType, style: "bg-zinc-100 text-zinc-500" };
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

                    {isClosed && (
                      <div className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="text-xs">🔒</span>
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-900 dark:text-white">케이스 종료 (Closed)</p>
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

              {/* Reply Form */}
              {!isClosed && (
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <h4 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    답변 작성
                  </h4>
                  <form onSubmit={handleAnswerSubmit} className="space-y-3 text-xs">
                    {submitError && (
                      <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                        {submitError}
                      </div>
                    )}
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      placeholder="파트너사에게 보낼 답변을 입력해주세요."
                      className="w-full rounded-lg border border-zinc-200 p-2.5 outline-none bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:border-zinc-950 dark:focus:border-white focus:bg-zinc-50 dark:focus:bg-zinc-900 transition-colors leading-relaxed resize-none"
                    />

                    {/* Action Required Toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActionRequired"
                        checked={isActionRequired}
                        onChange={(e) => setIsActionRequired(e.target.checked)}
                        className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <label htmlFor="isActionRequired" className="text-[10px] font-extrabold text-rose-700 dark:text-rose-400 cursor-pointer select-none">
                        ⚠️ 조치 요청 포함 (파트너사에서 추가 조치 필요)
                      </label>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="submit"
                        disabled={isSubmitting || !replyText.trim()}
                        className="flex-1 min-w-[120px] rounded-lg bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        {isSubmitting ? "등록 중..." : isActionRequired ? "⚠️ 조치 요청 발송" : "답변 등록"}
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting || !replyText.trim()}
                        onClick={() => setShowCloseConfirmModal(true)}
                        className="flex-1 min-w-[150px] rounded-lg bg-rose-700 py-2.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {isSubmitting ? "처리 중..." : "🔒 답변 등록 후 케이스 종료"}
                      </button>
                      {replyText && (
                        <button
                          type="button"
                          onClick={() => { setReplyText(""); setIsActionRequired(false); }}
                          className="rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950 cursor-pointer"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* Satisfaction Score (if closed) */}
              {isClosed && (
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                  <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    파트너 만족도 (Partner Satisfaction)
                  </p>
                  {selectedInquiry.satisfaction_score ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg text-amber-500">
                          {"★".repeat(selectedInquiry.satisfaction_score)}{"☆".repeat(5 - selectedInquiry.satisfaction_score)}
                        </span>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {selectedInquiry.satisfaction_score} / 5 점
                        </span>
                      </div>
                      {selectedInquiry.satisfaction_comment && (
                        <p className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg leading-relaxed">
                          💬 "{selectedInquiry.satisfaction_comment}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block rounded bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      미평가 (Not rated)
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 border-dashed bg-zinc-50/20 p-10 shadow-sm dark:border-zinc-800 text-center space-y-2.5">
              <span className="text-3xl">💬</span>
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">케이스 선택</h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[220px] mx-auto leading-normal">
                좌측 목록에서 케이스를 클릭하면 대화 내역 및 상태 관리 도구가 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reply & Close Confirm Modal */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">답변 등록 및 케이스 종료</h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                답변을 등록하고 이 케이스를 종료하시겠습니까?<br />
                <span className="text-[10px] text-zinc-400">Send this reply and close the case?</span>
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/60 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200 font-mono text-[11px]">
              {replyText}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirmModal(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                onClick={handleAnswerAndCloseSubmit}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-rose-700 py-2.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? "처리 중..." : "🔒 답변 등록 후 종료"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Close Confirm Modal (No Reply) */}
      {showDirectCloseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">케이스 종료</h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                이 케이스를 종료하시겠습니까?<br />
                <span className="text-[10px] text-zinc-400">Are you sure you want to close this case?</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDirectCloseConfirmModal(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                onClick={handleDirectCloseSubmit}
                disabled={isClosing}
                className="flex-1 rounded-lg bg-zinc-950 dark:bg-white py-2.5 text-xs font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isClosing ? "처리 중..." : "🔒 케이스 종료하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
