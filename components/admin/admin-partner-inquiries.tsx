"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { PartnerInquiryItem, CaseStatus, InquiryMessageItem, OfficialCaseStatus } from "@/lib/inquiry/types";
import {
  getNormalizedStatus,
  OFFICIAL_STATUS_LABEL,
  OFFICIAL_STATUS_COLOR,
  OFFICIAL_STATUS_EMOJI,
} from "@/lib/inquiry/types";
import { updateCaseStatus, closeCaseAdmin, answerAndClosePartnerInquiry } from "@/lib/inquiry/actions";

export interface CaseCreationCompany {
  id: string;
  name: string;
}

export interface CaseCreationUser {
  id: string;
  company_id: string;
  name: string;
  email: string;
  company_role: string;
}

interface AdminPartnerInquiriesProps {
  initialInquiries: PartnerInquiryItem[];
  companies?: CaseCreationCompany[];
  companyUsers?: CaseCreationUser[];
  answerAction: (
    inquiryId: string,
    replyContent: string,
    isActionRequired: boolean,
    sendEmail: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  createCaseAction?: (formData: FormData) => Promise<{ success: boolean; error?: string; data?: any }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  po_change:   "PO 변경 요청",
  product:     "제품 등록 및 스펙 수정",
  onboarding:  "입점 신청 및 심사 현황",
  logistics:   "물류 공급 및 패키징",
  translation: "번역 및 전성분표 기재",
  settlement:  "정산 / 인보이스 문의",
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

export function AdminPartnerInquiries({
  initialInquiries,
  companies = [],
  companyUsers = [],
  answerAction,
  createCaseAction
}: AdminPartnerInquiriesProps) {
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
  const [sendEmail, setSendEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showDirectCloseConfirmModal, setShowDirectCloseConfirmModal] = useState(false);

  // Admin New Case Creation states
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || "");
  const [selectedContactUserId, setSelectedContactUserId] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("product");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newContent, setNewContent] = useState<string>("");
  const [newPriority, setNewPriority] = useState<string>("normal");
  const [newIsActionRequired, setNewIsActionRequired] = useState<boolean>(false);
  const [newSendEmail, setNewSendEmail] = useState<boolean>(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isCreatingCase, setIsCreatingCase] = useState<boolean>(false);
  const [createCaseError, setCreateCaseError] = useState<string>("");

  // Status update states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Company -> Available users filter
  const availableUsersForCompany = useMemo(() => {
    if (!selectedCompanyId) return [];
    return companyUsers.filter((u) => u.company_id === selectedCompanyId);
  }, [selectedCompanyId, companyUsers]);

  // When selected company changes, auto select contact user
  useEffect(() => {
    if (availableUsersForCompany.length > 0) {
      if (!availableUsersForCompany.some((u) => u.id === selectedContactUserId)) {
        setSelectedContactUserId(availableUsersForCompany[0].id);
      }
    } else {
      setSelectedContactUserId("");
    }
  }, [selectedCompanyId, availableUsersForCompany, selectedContactUserId]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleActionRequiredToggle = (checked: boolean) => {
    setIsActionRequired(checked);
    if (checked) {
      setSendEmail(true); // Default to ON when action required is checked
    } else {
      setSendEmail(false); // Auto turn OFF when action required is unchecked
    }
  };

  const handleNewActionRequiredToggle = (checked: boolean) => {
    setNewIsActionRequired(checked);
    if (checked) {
      setNewSendEmail(true); // Auto-check email when action required is checked
    } else {
      setNewSendEmail(false); // Auto-uncheck email when action required is unchecked
    }
  };

  const handleCreateCaseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateCaseError("");

    if (!selectedCompanyId) { setCreateCaseError("회사를 선택해주세요."); return; }
    if (!selectedContactUserId) { setCreateCaseError("담당자를 선택해주세요."); return; }
    if (!newTitle.trim()) { setCreateCaseError("제목을 입력해주세요."); return; }
    if (!newContent.trim()) { setCreateCaseError("내용을 입력해주세요."); return; }

    setIsCreatingCase(true);
    const fd = new FormData();
    fd.append("company_id", selectedCompanyId);
    fd.append("contact_user_id", selectedContactUserId);
    fd.append("category", newCategory);
    fd.append("title", newTitle.trim());
    fd.append("content", newContent.trim());
    fd.append("priority", newPriority);
    fd.append("is_action_required", newIsActionRequired ? "true" : "false");
    fd.append("send_email", newSendEmail ? "true" : "false");
    if (newFile) {
      fd.append("file", newFile);
    }

    try {
      if (!createCaseAction) {
        throw new Error("케이스 생성 액션이 설정되지 않았습니다.");
      }
      const res = await createCaseAction(fd);
      if (res.success) {
        setShowCreateCaseModal(false);
        setNewTitle("");
        setNewContent("");
        setNewFile(null);
        setNewIsActionRequired(false);
        setNewSendEmail(false);
        window.location.reload();
      } else {
        setCreateCaseError(res.error || "케이스 생성에 실패했습니다.");
      }
    } catch (err) {
      setCreateCaseError(err instanceof Error ? err.message : "서버 오류가 발생했습니다.");
    } finally {
      setIsCreatingCase(false);
    }
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
      const res = await answerAction(
        selectedInquiry.id,
        replyText,
        isActionRequired,
        isActionRequired && sendEmail
      );
      if (res.success) {
        setReplyText("");
        setIsActionRequired(false);
        setSendEmail(false);
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
              파트너사 1:1 케이스 접수 및 어드민 케이스 생성/처리 현황입니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-zinc-400">전체 {inquiries.length}건</span>
              {inquiries.filter((i) => getNormalizedStatus(i.status) !== "CLOSED").length > 0 && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  🔴 처리필요 {inquiries.filter((i) => getNormalizedStatus(i.status) !== "CLOSED").length}건
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateCaseModal(true);
                if (companies.length > 0 && !selectedCompanyId) {
                  setSelectedCompanyId(companies[0].id);
                }
                setNewCategory("product");
                setNewTitle("");
                setNewContent("");
                setNewPriority("normal");
                setNewIsActionRequired(false);
                setNewSendEmail(false);
                setNewFile(null);
                setCreateCaseError("");
              }}
              className="rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer"
            >
              + 새 케이스
            </button>
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
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium truncate">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.companyName}</span>
                        {(item.requesterName || item.requesterEmail) && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="truncate text-zinc-500 dark:text-zinc-400">
                              {item.requesterName || "담당자"}
                              {item.requesterEmail ? ` (${item.requesterEmail})` : ""}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{item.content}</p>
                      {(item.related_invoice_number || item.related_ap_number || item.related_invoice_id) && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] font-mono font-medium text-indigo-600 dark:text-indigo-400">
                          <span>🧾</span>
                          <span className="truncate">Invoice #{item.related_invoice_number || item.related_ap_number || "연계"}</span>
                        </div>
                      )}
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
                  <div className="space-y-2 min-w-0 flex-1">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">회사명:</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{selectedInquiry.companyName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">생성 출처:</span>
                        {selectedInquiry.created_source === "admin" ? (
                          <span className="rounded bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                            어드민 생성 (Admin)
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-medium text-zinc-600 dark:text-zinc-400">
                            파트너 포털 (Portal)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">접수일:</span>
                        <span>{formatDate(selectedInquiry.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">우선순위:</span>
                        <span className={`font-bold text-[10px] ${
                          selectedInquiry.priority === "urgent"
                            ? "text-rose-600"
                            : selectedInquiry.priority === "high"
                            ? "text-amber-600"
                            : "text-zinc-600 dark:text-zinc-400"
                        }`}>
                          {selectedInquiry.priority === "urgent" ? "🚨 긴급 (Urgent)" : selectedInquiry.priority === "high" ? "⚡ 높음 (High)" : "일반 (Normal)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">접수 담당자:</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{selectedInquiry.requesterName || "담당자"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">이메일:</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">{selectedInquiry.requesterEmail || "-"}</span>
                      </div>
                      {selectedInquiry.closed_at && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">종료일:</span>
                          <span>{formatDate(selectedInquiry.closed_at)}</span>
                        </div>
                      )}
                      {selectedInquiry.reopen_count ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">재오픈:</span>
                          <span className="text-amber-600 font-bold">{selectedInquiry.reopen_count}회</span>
                        </div>
                      ) : null}
                    </div>
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

                {/* Related PO Context & Actions Card */}
                {selectedInquiry.related_po_id && (
                  <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/40 text-xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-bold text-indigo-900 dark:text-indigo-300">
                      <span className="flex items-center gap-1.5">
                        <span>📦</span>
                        <span>연계된 발주서 정보 (Linked Purchase Order)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/purchasing/${selectedInquiry.related_po_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-zinc-900 border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 transition-colors shadow-xs"
                        >
                          View PO (발주서 보기) →
                        </Link>
                        <Link
                          href={`/admin/purchasing/${selectedInquiry.related_po_id}/edit`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs"
                        >
                          ✏️ Edit / Revise PO (발주서 수정)
                        </Link>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] font-medium">발주서 번호</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{selectedInquiry.related_po_number || "-"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] font-medium">공급사 (Supplier)</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate block">{selectedInquiry.related_po_supplier_name || selectedInquiry.companyName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] font-medium">주문 일자</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{selectedInquiry.related_po_order_date || "-"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] font-medium">현재 발주 상태</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedInquiry.related_po_status || "-"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] font-medium">Revision 번호</span>
                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                          Rev {selectedInquiry.related_po_revision_no || 1}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Related Invoice Quick Links (if standalone invoice or additional) */}
                {selectedInquiry.related_invoice_id && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">연계 인보이스:</span>
                    <Link
                      href={`/admin/finance/invoices/${selectedInquiry.related_invoice_id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300 transition-colors"
                    >
                      📄 인보이스 바로가기 {selectedInquiry.related_invoice_number || selectedInquiry.related_ap_number ? `(${selectedInquiry.related_invoice_number || selectedInquiry.related_ap_number})` : ""}
                    </Link>
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
                        <p className="font-bold text-zinc-900 dark:text-white">
                          {selectedInquiry.created_source === "admin" ? "어드민 케이스 생성" : "케이스 접수"}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {formatDate(selectedInquiry.created_at)} · {selectedInquiry.companyName}
                          {selectedInquiry.requesterName ? ` (${selectedInquiry.requesterName}${selectedInquiry.requesterEmail ? ` · ${selectedInquiry.requesterEmail}` : ""})` : ""}
                          {selectedInquiry.created_source === "admin" ? " 앞으로 어드민이 케이스를 생성함" : "이 케이스를 접수함"}
                        </p>
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

                    {/* Action Required & Email Controls */}
                    <div className="space-y-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isActionRequired"
                          checked={isActionRequired}
                          onChange={(e) => handleActionRequiredToggle(e.target.checked)}
                          className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                        />
                        <label htmlFor="isActionRequired" className="text-xs font-bold text-rose-700 dark:text-rose-400 cursor-pointer select-none">
                          ⚠️ 조치 요청 포함 (파트너사에서 추가 조치 필요)
                        </label>
                      </div>

                      {isActionRequired && (
                        <div className="flex items-center gap-2 pl-6 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60">
                          <input
                            type="checkbox"
                            id="sendEmail"
                            checked={sendEmail}
                            onChange={(e) => setSendEmail(e.target.checked)}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <label htmlFor="sendEmail" className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none flex items-center gap-1.5 flex-wrap">
                            <span>✉️ 담당자에게 이메일 발송</span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              ({selectedInquiry.requesterEmail ? `${selectedInquiry.requesterName || "담당자"} <${selectedInquiry.requesterEmail}>` : "등록된 이메일"})
                            </span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Integrated 3-Action Group */}
                    <div className="space-y-2 pt-1">
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
                          className="flex-1 min-w-[170px] rounded-lg bg-rose-700 py-2.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          {isSubmitting ? "처리 중..." : "🔒 답변 등록 후 케이스 종료"}
                        </button>
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        {replyText ? (
                          <button
                            type="button"
                            onClick={() => { setReplyText(""); setIsActionRequired(false); setSendEmail(false); }}
                            className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                          >
                            [작성 취소]
                          </button>
                        ) : <div />}
                        <button
                          type="button"
                          onClick={() => setShowDirectCloseConfirmModal(true)}
                          disabled={isClosing}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>🔒 케이스 종료</span>
                        </button>
                      </div>
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

      {/* Admin New Case Creation Modal */}
      {showCreateCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 my-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span>+ 새 케이스 등록</span>
                  <span className="text-[10px] text-zinc-400 font-normal">(Admin Case Creation)</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  파트너/브랜드사 담당자 앞으로 직접 케이스를 생성합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCaseModal(false)}
                className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="space-y-3 text-xs">
              {createCaseError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {createCaseError}
                </div>
              )}

              {/* 1. Company selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>회사 (Company)</span> <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors cursor-pointer"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Contact User selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>담당자 (Contact Person)</span> <span className="text-rose-500">*</span>
                </label>
                {availableUsersForCompany.length > 0 ? (
                  <select
                    value={selectedContactUserId}
                    onChange={(e) => setSelectedContactUserId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors cursor-pointer"
                  >
                    {availableUsersForCompany.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) {u.company_role === "company_admin" ? "— 관리자" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    선택한 회사에 등록된 활성 사용자가 없습니다.
                  </div>
                )}
              </div>

              {/* 3. Case Type (Category) & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                    <span>케이스 유형</span> <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors cursor-pointer"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    우선순위 (Priority)
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors cursor-pointer"
                  >
                    <option value="normal">일반 (Normal)</option>
                    <option value="high">⚡ 높음 (High)</option>
                    <option value="urgent">🚨 긴급 (Urgent)</option>
                  </select>
                </div>
              </div>

              {/* 4. Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>제목 (Title)</span> <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="케이스 제목을 입력하세요."
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors"
                />
              </div>

              {/* 5. Content */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>내용 (Content)</span> <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="파트너사에게 전달할 상세 내용을 입력하세요."
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors leading-relaxed resize-none"
                />
              </div>

              {/* 6. Action Required & Email Controls */}
              <div className="space-y-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newIsActionRequired"
                    checked={newIsActionRequired}
                    onChange={(e) => handleNewActionRequiredToggle(e.target.checked)}
                    className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="newIsActionRequired" className="text-xs font-bold text-rose-700 dark:text-rose-400 cursor-pointer select-none">
                    ⚠️ 조치 필요 (파트너사 확인 및 조치 요구 상태로 생성)
                  </label>
                </div>

                <div className="flex items-center gap-2 pl-6 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60">
                  <input
                    type="checkbox"
                    id="newSendEmail"
                    checked={newSendEmail}
                    onChange={(e) => setNewSendEmail(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <label htmlFor="newSendEmail" className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none flex items-center gap-1.5">
                    <span>✉️ 담당자에게 이메일 알림 발송</span>
                    {selectedContactUserId && availableUsersForCompany.find((u) => u.id === selectedContactUserId)?.email && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        ({availableUsersForCompany.find((u) => u.id === selectedContactUserId)?.email})
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {/* 7. Attachment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">첨부파일 (최대 20MB, 선택)</label>
                {!newFile ? (
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 20 * 1024 * 1024) {
                          alert("첨부파일은 최대 20MB까지 업로드할 수 있습니다.");
                          e.target.value = "";
                          setNewFile(null);
                          return;
                        }
                        setNewFile(f);
                      }
                    }}
                    className="block w-full text-[10px] text-zinc-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                  />
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span>📎</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{newFile.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">({formatFileSize(newFile.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewFile(null)}
                      className="rounded px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 cursor-pointer shrink-0"
                    >
                      [삭제]
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCaseModal(false)}
                  className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  취소 (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCase || !selectedContactUserId}
                  className="flex-1 rounded-lg bg-zinc-950 dark:bg-white py-2.5 text-xs font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isCreatingCase ? "생성 중..." : "케이스 생성하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                답변 없이 이 케이스를 종료하시겠습니까?<br />
                <span className="text-[10px] text-zinc-400">Close this case without sending a reply? The conversation and case log will be preserved.</span>
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
                {isClosing ? "종료 중..." : "🔒 케이스 종료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
