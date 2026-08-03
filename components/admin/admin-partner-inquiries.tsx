"use client";

import React, { useState } from "react";
import type { PartnerInquiryItem, CaseStatus, InquiryMessageItem } from "@/lib/inquiry/types";
import { CASE_STATUS_LABEL, CASE_STATUS_COLOR } from "@/lib/inquiry/types";
import { updateCaseStatus, closeCaseAdmin, reopenCase } from "@/lib/inquiry/actions";

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

const STATUS_EMOJI: Record<CaseStatus, string> = {
  open:            "🟡",
  in_review:       "🔵",
  awaiting_reply:  "🟠",
  action_required: "🔴",
  action_resolved: "🟣",
  resolved:        "🟢",
  closed:          "⚫",
  reopened:        "🔶",
  pending:         "🟡",
  replied:         "🔵"
};

const MSG_TYPE_LABEL: Record<string, { icon: string; label: string; style: string }> = {
  action_required: { icon: "⚠️", label: "조치요청", style: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300" },
  action_resolved: { icon: "✅", label: "조치완료", style: "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300" },
  status_change:   { icon: "🔄", label: "상태변경", style: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  case_closed:     { icon: "🔒", label: "케이스종료", style: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  case_reopened:   { icon: "🔓", label: "재오픈", style: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300" },
  satisfaction:    { icon: "⭐", label: "만족도", style: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300" }
};

export function AdminPartnerInquiries({ initialInquiries, answerAction }: AdminPartnerInquiriesProps) {
  const [inquiries, setInquiries] = useState<PartnerInquiryItem[]>(initialInquiries);
  const [selectedInquiry, setSelectedInquiry] = useState<PartnerInquiryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchTerm, setSearchTerm] = useState("");

  // Reply states
  const [replyText, setReplyText] = useState("");
  const [isActionRequired, setIsActionRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Status update states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

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

  const handleCloseCase = async () => {
    if (!selectedInquiry) return;
    if (!confirm("이 케이스를 종료하시겠습니까?")) return;
    setIsClosing(true);
    try {
      await closeCaseAdmin(selectedInquiry.id);
      window.location.reload();
    } catch {
      setSubmitError("케이스 종료에 실패했습니다.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopenCase = async () => {
    if (!selectedInquiry) return;
    setIsReopening(true);
    try {
      await reopenCase(selectedInquiry.id, "admin");
      window.location.reload();
    } catch {
      setSubmitError("케이스 재오픈에 실패했습니다.");
    } finally {
      setIsReopening(false);
    }
  };

  const filteredInquiries = inquiries.filter((item) => {
    const isActive = !["closed"].includes(item.status);
    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "closed" && item.status !== "closed") return false;
    if (statusFilter !== "active" && statusFilter !== "closed" && statusFilter !== "all" && item.status !== statusFilter) return false;

    const cleanSearch = searchTerm.toLowerCase().trim();
    return !cleanSearch ||
      item.title.toLowerCase().includes(cleanSearch) ||
      item.content.toLowerCase().includes(cleanSearch) ||
      item.companyName?.toLowerCase().includes(cleanSearch) ||
      item.case_number?.toLowerCase().includes(cleanSearch);
  });

  const isClosed = selectedInquiry ? ["closed"].includes(selectedInquiry.status) : false;

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
            {(["open", "in_review", "awaiting_reply", "action_required", "action_resolved", "reopened"] as CaseStatus[]).some(
              s => inquiries.some(i => i.status === s)
            ) && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                🔴 처리필요 {inquiries.filter(i => !["closed", "resolved"].includes(i.status)).length}건
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Case List */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search & Filter */}
          <div className="space-y-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="케이스 검색 (번호, 제목, 회사명)"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "active", label: "처리중" },
                { key: "all", label: "전체" },
                { key: "open", label: "접수됨" },
                { key: "in_review", label: "검토중" },
                { key: "action_required", label: "조치필요" },
                { key: "closed", label: "종료됨" }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold transition-colors cursor-pointer ${
                    statusFilter === key
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Case List */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredInquiries.length > 0 ? (
                filteredInquiries.map((item) => (
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
                        <span className="text-[10px]">{STATUS_EMOJI[item.status]}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${CASE_STATUS_COLOR[item.status]}`}>
                          {CASE_STATUS_LABEL[item.status]}
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
                    {item.is_action_required && (
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                        <span>⚠️</span><span>조치 요청 중</span>
                      </div>
                    )}
                  </div>
                ))
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
                      <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${CASE_STATUS_COLOR[selectedInquiry.status]}`}>
                        {STATUS_EMOJI[selectedInquiry.status]} {CASE_STATUS_LABEL[selectedInquiry.status]}
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 dark:text-zinc-400">
                        {CATEGORY_LABELS[selectedInquiry.category] || selectedInquiry.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">{selectedInquiry.title}</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {selectedInquiry.companyName} · {formatDate(selectedInquiry.created_at)}
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

                {/* Status Toolbar */}
                {!isClosed && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-50 dark:border-zinc-800/60">
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">상태 변경:</span>
                    {(["in_review", "awaiting_reply"] as CaseStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={isUpdatingStatus || selectedInquiry.status === s}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold transition-all cursor-pointer disabled:opacity-40 ${
                          selectedInquiry.status === s
                            ? CASE_STATUS_COLOR[s]
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {STATUS_EMOJI[s]} {CASE_STATUS_LABEL[s]}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      onClick={handleCloseCase}
                      disabled={isClosing}
                      className="rounded px-2.5 py-0.5 text-[9px] font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isClosing ? "종료 중..." : "🔒 케이스 종료"}
                    </button>
                  </div>
                )}
                {isClosed && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">이 케이스는 종료되었습니다.</span>
                    <button
                      onClick={handleReopenCase}
                      disabled={isReopening}
                      className="rounded px-2.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/30 dark:text-amber-400 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isReopening ? "재오픈 중..." : "🔓 재오픈"}
                    </button>
                  </div>
                )}
              </div>

              {/* Conversation Thread */}
              <div className="p-5 space-y-3">
                <h4 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  대화 기록
                </h4>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {(selectedInquiry.messages ?? []).map((msg) => {
                    const isSystem = msg.messageType !== "message";
                    const isAdmin = msg.senderType === "admin";

                    if (isSystem && msg.messageType !== "message") {
                      const meta = MSG_TYPE_LABEL[msg.messageType] || { icon: "ℹ️", label: msg.messageType, style: "bg-zinc-100 text-zinc-500" };
                      return (
                        <div key={msg.id} className="flex items-center justify-center gap-2 py-1">
                          <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                          <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold ${meta.style}`}>
                            <span>{meta.icon}</span>
                            <span>{msg.senderName}</span>
                            <span>·</span>
                            <span>{msg.content}</span>
                          </div>
                          <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
                          {!isAdmin && <span className="font-bold text-zinc-600 dark:text-zinc-300">{msg.senderName}</span>}
                          <span>{formatDate(msg.createdAt)}</span>
                          {isAdmin && <span className="font-bold text-zinc-600 dark:text-zinc-300">{msg.senderName}</span>}
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
                  })}
                </div>
              </div>

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

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting || !replyText.trim()}
                        className="flex-1 rounded-lg bg-zinc-950 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        {isSubmitting ? "등록 중..." : isActionRequired ? "⚠️ 조치 요청 발송" : "답변 등록"}
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
              {isClosed && selectedInquiry.satisfaction_score && (
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">만족도 평가</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{"★".repeat(selectedInquiry.satisfaction_score)}{"☆".repeat(5 - selectedInquiry.satisfaction_score)}</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{selectedInquiry.satisfaction_score}/5</span>
                  </div>
                  {selectedInquiry.satisfaction_comment && (
                    <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/20 p-2.5 rounded-lg">
                      {selectedInquiry.satisfaction_comment}
                    </p>
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
    </div>
  );
}
