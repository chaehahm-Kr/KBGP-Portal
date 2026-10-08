"use client";

import React, { useState, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PartnerInquiryItem,
  RETAILER_CASE_CATEGORIES,
  ALL_CASE_CATEGORY_LABELS,
  getNormalizedStatus,
  OFFICIAL_STATUS_LABEL,
  OFFICIAL_STATUS_COLOR,
  OFFICIAL_STATUS_EMOJI,
  OfficialCaseStatus,
} from "@/lib/inquiry/types";
import {
  createRetailerSupportInquiryAction,
  addRetailerInquiryReplyAction,
  submitRetailerSatisfactionRatingAction,
  closeRetailerCaseAction,
  RetailerCaseContext,
} from "@/lib/retailer/support-actions";
import { stageLargeFiles, stageLargeFile } from "@/lib/files/stage-form-files";
import { useTranslation } from "@/lib/i18n";

interface SupportViewProps {
  initialInquiries: PartnerInquiryItem[];
  context: RetailerCaseContext;
  companyName: string;
  userRole?: string;
  userStoreId?: string | null;
}

export function SupportView({
  initialInquiries,
  context,
  companyName,
  userRole = "owner",
  userStoreId,
}: SupportViewProps) {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [inquiries, setInquiries] = useState<PartnerInquiryItem[]>(initialInquiries);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(
    inquiries.length > 0 ? inquiries[0].id : null
  );

  // Tabs
  const [activeTab, setActiveTab] = useState<"conversation" | "caselog">("conversation");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OfficialCaseStatus>("ALL");
  const [storeFilter, setStoreFilter] = useState<string>("ALL");

  // New Inquiry Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [previousCaseId, setPreviousCaseId] = useState<string | null>(null);
  const [previousCaseNumber, setPreviousCaseNumber] = useState<string | null>(null);
  const [previousCaseTitle, setPreviousCaseTitle] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string>("order_delivery");
  const [newStoreId, setNewStoreId] = useState<string>(userStoreId || context.stores[0]?.id || "");
  const [newOrderId, setNewOrderId] = useState<string>("");
  const [newProductId, setNewProductId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [showMoreContext, setShowMoreContext] = useState(false);

  // Reply Form State
  const [replyContent, setReplyContent] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyError, setReplyError] = useState("");

  // CSAT Rating Modal State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingError, setRatingError] = useState("");

  // Close Case Modal State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeRatingScore, setCloseRatingScore] = useState<number>(5);
  const [closeRatingComment, setCloseRatingComment] = useState("");
  const [closeError, setCloseError] = useState("");

  const [isPending, startTransition] = useTransition();

  // Ask K SELECT Escalation & URL Query Prefill
  useEffect(() => {
    const caseParam = searchParams.get("case") || searchParams.get("id");
    const newParam = searchParams.get("new");
    const originParam = searchParams.get("origin");
    const titleParam = searchParams.get("title") || searchParams.get("subject");
    const bodyParam = searchParams.get("body") || searchParams.get("content");
    const categoryParam = searchParams.get("category");
    const storeIdParam = searchParams.get("store_id") || searchParams.get("storeId");
    const orderIdParam = searchParams.get("order_id") || searchParams.get("orderId");
    const productIdParam = searchParams.get("product_id") || searchParams.get("productId");

    // 1. Direct Case Selection
    if (caseParam && inquiries.length > 0) {
      const match = inquiries.find(
        (i) => i.id === caseParam || (i.case_number && i.case_number.toLowerCase() === caseParam.toLowerCase())
      );
      if (match) {
        setSelectedInquiryId(match.id);
        setShowNewModal(false);
        return;
      }
    }

    // 2. Ask K SELECT Escalation
    let askContext: any = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      const stored = window.sessionStorage.getItem("kselect_ask_escalation_context");
      if (stored) {
        try {
          askContext = JSON.parse(stored);
        } catch (e) {}
      }
    }

    if (originParam === "ASK_KSELECT" || (newParam === "1" && askContext) || newParam === "1" || !!titleParam || !!bodyParam) {
      setShowNewModal(true);
      if (categoryParam) setNewCategory(categoryParam);
      if (storeIdParam) setNewStoreId(storeIdParam);
      if (orderIdParam) {
        setNewOrderId(orderIdParam);
        setShowMoreContext(true);
      }
      if (productIdParam) {
        setNewProductId(productIdParam);
        setShowMoreContext(true);
      }

      const q = askContext?.question || titleParam || "";
      const qExcerpt = q ? (q.length > 35 ? q.slice(0, 35) + "..." : q) : (locale === "ko" ? "일반 문의" : "General Inquiry");
      setNewTitle(titleParam || `[Ask K SELECT] ${qExcerpt}`);

      const answerSummary = askContext?.answerSummary || "";
      const sourcesText = (askContext?.portalType === "RETAILER" && askContext?.sources && askContext.sources.length > 0)
        ? `\n[${locale === "ko" ? "공식 가이드 출처" : "Official Citations"}]\n${askContext.sources.map((s: any) => `- ${s.title} (${s.version})`).join("\n")}\n`
        : "";

      setNewContent(
        bodyParam ||
`[${locale === "ko" ? "사용자 질문" : "User Question"}]
${q || (locale === "ko" ? "(질문 내용을 입력하세요)" : "(Please specify your question)")}

[Ask K SELECT ${locale === "ko" ? "검색 결과" : "Result"}]
${answerSummary || (locale === "ko" ? "공식 가이드에서 충분한 정보를 찾지 못했습니다." : "No sufficient information was found in official published guides.")}
${sourcesText}
[${locale === "ko" ? "상세 문의 내용" : "Additional Details"}]
${locale === "ko" ? "(추가로 문의하실 내용을 자유롭게 작성해 주세요.)" : "(Please freely edit or add your details here.)"}
`
      );

      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem("kselect_ask_escalation_context");
      }
    }
  }, [searchParams, inquiries, locale]);

  const selectedInquiry = useMemo(() => {
    return inquiries.find((i) => i.id === selectedInquiryId) || null;
  }, [inquiries, selectedInquiryId]);

  const filteredInquiries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return inquiries.filter((item) => {
      // Store filter
      if (storeFilter !== "ALL" && item.store_id !== storeFilter) {
        return false;
      }

      // Keyword search overrides status tab
      if (q) {
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchContent = item.content?.toLowerCase().includes(q);
        const matchCaseNumber = item.case_number?.toLowerCase().includes(q);
        const matchStore = item.store_name?.toLowerCase().includes(q);
        const matchOrder = item.related_order_number?.toLowerCase().includes(q);
        const matchProduct = item.related_product_name?.toLowerCase().includes(q);
        const matchMessages = item.messages?.some((m) => m.content?.toLowerCase().includes(q));

        return matchTitle || matchContent || matchCaseNumber || matchStore || matchOrder || matchProduct || matchMessages;
      }

      // Status Filter
      if (statusFilter === "ALL") return true;
      const norm = getNormalizedStatus(item.status);
      return norm === statusFilter;
    });
  }, [inquiries, searchTerm, statusFilter, storeFilter]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: inquiries.length,
      underReview: inquiries.filter((i) => {
        const s = getNormalizedStatus(i.status);
        return s === "RECEIVED" || s === "UNDER_REVIEW";
      }).length,
      actionRequired: inquiries.filter((i) => getNormalizedStatus(i.status) === "ACTION_REQUIRED").length,
      closed: inquiries.filter((i) => getNormalizedStatus(i.status) === "CLOSED").length,
    };
  }, [inquiries]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // Context visibility logic based on category
  const contextRules = useMemo(() => {
    switch (newCategory) {
      case "order_delivery":
        return {
          store: "required" as const,
          order: "recommended" as const,
          product: "optional" as const,
          defaultShowContext: true,
        };
      case "product_pricing":
        return {
          store: "optional" as const,
          order: "optional" as const,
          product: "recommended" as const,
          defaultShowContext: true,
        };
      case "payment_terms":
        return {
          store: "required" as const,
          order: "optional" as const,
          product: "optional" as const,
          defaultShowContext: false,
        };
      case "price_tag_qr":
        return {
          store: "required" as const,
          order: "optional" as const,
          product: "recommended" as const,
          defaultShowContext: true,
        };
      case "weekly_check":
        return {
          store: "required" as const,
          order: "optional" as const,
          product: "optional" as const,
          defaultShowContext: true,
        };
      case "training":
      case "agreement_inquiry":
      case "portal_tech":
      case "general":
      default:
        return {
          store: "optional" as const,
          order: "optional" as const,
          product: "optional" as const,
          defaultShowContext: false,
        };
    }
  }, [newCategory]);

  const handleOpenNewModal = (isFollowUp = false, parentInquiry?: PartnerInquiryItem) => {
    setFormError("");
    if (isFollowUp && parentInquiry) {
      setPreviousCaseId(parentInquiry.id);
      setPreviousCaseNumber(parentInquiry.case_number || null);
      setPreviousCaseTitle(parentInquiry.title || null);
      setNewCategory(parentInquiry.category || "general");
      setNewStoreId(parentInquiry.store_id || userStoreId || context.stores[0]?.id || "");
      setNewOrderId(parentInquiry.related_order_id || "");
      setNewProductId(parentInquiry.related_product_id || "");
      setNewTitle(parentInquiry.title.startsWith("Re:") ? parentInquiry.title : `Re: ${parentInquiry.title}`);
      setNewContent("");
      setShowMoreContext(Boolean(parentInquiry.related_order_id || parentInquiry.related_product_id));
    } else {
      setPreviousCaseId(null);
      setPreviousCaseNumber(null);
      setPreviousCaseTitle(null);
      setNewCategory("order_delivery");
      setNewStoreId(userStoreId || context.stores[0]?.id || "");
      setNewOrderId("");
      setNewProductId("");
      setNewTitle("");
      setNewContent("");
      setShowMoreContext(false);
    }
    setNewFile(null);
    setShowNewModal(true);
  };

  const handleCreateInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newTitle.trim()) {
      setFormError(locale === "ko" ? "문의 제목을 입력해주세요." : "Please enter a subject / title for your inquiry.");
      return;
    }
    if (!newContent.trim()) {
      setFormError(locale === "ko" ? "문의 내용을 상세히 작성해주세요." : "Please describe your question or issue in detail.");
      return;
    }

    const fd = new FormData();
    fd.append("category", newCategory);
    if (newStoreId) fd.append("store_id", newStoreId);
    if (newOrderId) fd.append("related_order_id", newOrderId);
    if (newProductId) fd.append("related_product_id", newProductId);
    if (previousCaseId) fd.append("previous_case_id", previousCaseId);
    fd.append("title", newTitle.trim());
    fd.append("content", newContent.trim());
    fd.append("priority", newPriority);
    if (newFile) fd.append("file", newFile);

    startTransition(async () => {
      const res = await createRetailerSupportInquiryAction(await stageLargeFiles(fd));
      if (res.success) {
        setShowNewModal(false);
        setNewTitle("");
        setNewContent("");
        setNewFile(null);
        setPreviousCaseId(null);
        setFormError("");
        window.location.reload();
      } else {
        setFormError(res.error || (locale === "ko" ? "문의 등록에 실패했습니다." : "Failed to create inquiry. Please try again."));
      }
    });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setReplyError("");

    if (!replyContent.trim()) {
      setReplyError(locale === "ko" ? "답변 내용을 입력해주세요." : "Please enter a reply message.");
      return;
    }

    const fd = new FormData();
    fd.append("inquiry_id", selectedInquiry.id);
    fd.append("content", replyContent.trim());
    if (replyFile) fd.append("file", replyFile);

    startTransition(async () => {
      const res = await addRetailerInquiryReplyAction(await stageLargeFiles(fd));
      if (res.success) {
        setReplyContent("");
        setReplyFile(null);
        setReplyError("");
        window.location.reload();
      } else {
        setReplyError(res.error || (locale === "ko" ? "답변 등록에 실패했습니다." : "Failed to submit reply."));
      }
    });
  };

  const handleOpenRatingModal = () => {
    if (!selectedInquiry) return;
    setRatingScore(selectedInquiry.satisfaction_score || 5);
    setRatingComment(selectedInquiry.satisfaction_comment || "");
    setRatingError("");
    setShowRatingModal(true);
  };

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setRatingError("");

    startTransition(async () => {
      const res = await submitRetailerSatisfactionRatingAction(
        selectedInquiry.id,
        ratingScore,
        ratingComment.trim() || null
      );
      if (res.success) {
        setShowRatingModal(false);
        window.location.reload();
      } else {
        setRatingError(res.error || (locale === "ko" ? "평가 저장에 실패했습니다." : "Failed to save rating."));
      }
    });
  };

  const handleOpenCloseModal = () => {
    if (!selectedInquiry) return;
    setCloseRatingScore(5);
    setCloseRatingComment("");
    setCloseError("");
    setShowCloseModal(true);
  };

  const handleCloseCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setCloseError("");

    startTransition(async () => {
      const res = await closeRetailerCaseAction(
        selectedInquiry.id,
        closeRatingScore > 0 ? closeRatingScore : null,
        closeRatingComment.trim() || null
      );
      if (res.success) {
        setShowCloseModal(false);
        window.location.reload();
      } else {
        setCloseError(res.error || (locale === "ko" ? "문의 종료에 실패했습니다." : "Failed to close case."));
      }
    });
  };

  const isSelectedClosed = selectedInquiry ? getNormalizedStatus(selectedInquiry.status) === "CLOSED" : false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🛟</span>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
                {t.support.title}
              </h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.support.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleOpenNewModal(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>{t.support.newInquiry}</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t.support.totalInquiries}</span>
            <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{counts.total}</p>
          </div>
          <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-3">
            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">{t.support.underReview}</span>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">{counts.underReview}</p>
          </div>
          <div className="rounded-xl bg-rose-50/60 dark:bg-rose-950/20 p-3">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">{t.support.actionRequired}</span>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">{counts.actionRequired}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t.support.closed}</span>
            <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">{counts.closed}</p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List & Filters (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search & Tabs */}
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.support.searchPlaceholder}
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
                >
                  {t.common.reset}
                </button>
              )}
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "ALL", label: t.common.all, count: counts.total },
                { id: "UNDER_REVIEW", label: t.support.underReview, count: counts.underReview },
                { id: "ACTION_REQUIRED", label: t.support.actionRequired, count: counts.actionRequired },
                { id: "CLOSED", label: t.support.closed, count: counts.closed },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer border ${
                    statusFilter === tab.id
                      ? "bg-zinc-900 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-2xs"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                  }`}
                >
                  {tab.label} <span className="opacity-70 text-[10px] font-mono">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* Store Filter if multiple stores */}
            {context.stores.length > 1 && (
              <div className="pt-1">
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                >
                  <option value="ALL">{t.support.allStores}</option>
                  {context.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      🏪 {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cases List Box */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredInquiries.length > 0 ? (
              filteredInquiries.map((item) => {
                const norm = getNormalizedStatus(item.status);
                const isSelected = selectedInquiryId === item.id;
                const catMeta = ALL_CASE_CATEGORY_LABELS[item.category] || { en: item.category, ko: item.category };
                const catLabel = locale === "ko" ? (catMeta.ko || catMeta.en) : catMeta.en;
                const statusLabel = locale === "ko" ? OFFICIAL_STATUS_LABEL[norm].ko : OFFICIAL_STATUS_LABEL[norm].en;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedInquiryId(item.id);
                      setReplyError("");
                    }}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-zinc-50/80 dark:bg-zinc-800/40 border-l-4 border-zinc-950 dark:border-white pl-3"
                        : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-xs">{OFFICIAL_STATUS_EMOJI[norm]}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${OFFICIAL_STATUS_COLOR[norm]}`}>
                          {statusLabel}
                        </span>
                        {item.case_number && (
                          <span className="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                            #{item.case_number}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 shrink-0">{formatDate(item.created_at)}</span>
                    </div>

                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate mb-1">
                      {item.title}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex-wrap">
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        {catLabel}
                      </span>
                      {item.store_name && (
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          🏪 {item.store_name}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1">
                      {item.content}
                    </p>

                    {/* Context Tags */}
                    {(item.related_order_number || item.related_product_name || item.previous_case_number) && (
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono flex-wrap">
                        {item.previous_case_number && (
                          <span className="rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 font-bold">
                            🔄 #{item.previous_case_number}
                          </span>
                        )}
                        {item.related_order_number && (
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300 font-bold">
                            📦 #{item.related_order_number}
                          </span>
                        )}
                        {item.related_product_name && (
                          <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 truncate max-w-[150px]">
                            🏷️ {item.related_product_name}
                          </span>
                        )}
                      </div>
                    )}

                    {norm === "ACTION_REQUIRED" && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        <span>⚠️</span>
                        <span>{locale === "ko" ? "운영팀 추가 조치 요청" : "Action requested by Support"}</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-zinc-400 dark:text-zinc-500 space-y-2">
                <span className="text-2xl block">💬</span>
                <p>{t.support.noInquiriesTitle}</p>
                <button
                  type="button"
                  onClick={() => handleOpenNewModal(false)}
                  className="text-xs font-bold text-zinc-900 underline hover:text-zinc-700 dark:text-white cursor-pointer"
                >
                  {t.support.createFirstInquiry}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Case Detail, Conversation Thread & Case Log (7 cols) */}
        <div className="lg:col-span-7">
          {selectedInquiry ? (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* Case Header */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedInquiry.case_number && (
                        <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">
                          #{selectedInquiry.case_number}
                        </span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border ${OFFICIAL_STATUS_COLOR[getNormalizedStatus(selectedInquiry.status)]}`}
                      >
                        {OFFICIAL_STATUS_EMOJI[getNormalizedStatus(selectedInquiry.status)]}{" "}
                        {locale === "ko"
                          ? OFFICIAL_STATUS_LABEL[getNormalizedStatus(selectedInquiry.status)].ko
                          : OFFICIAL_STATUS_LABEL[getNormalizedStatus(selectedInquiry.status)].en}
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                        {locale === "ko"
                          ? (ALL_CASE_CATEGORY_LABELS[selectedInquiry.category]?.ko || selectedInquiry.category)
                          : (ALL_CASE_CATEGORY_LABELS[selectedInquiry.category]?.en || selectedInquiry.category)}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-snug">
                      {selectedInquiry.title}
                    </h2>
                  </div>
                </div>

                {/* Follow-up Parent Indicator Banner */}
                {selectedInquiry.previous_case_id && (
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs flex items-center justify-between text-blue-900 dark:text-blue-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>💡</span>
                      <span>
                        {t.support.followUpTo}{" "}
                        <strong className="font-mono font-bold">
                          #{selectedInquiry.previous_case_number || "Parent Case"}
                        </strong>
                        {selectedInquiry.previous_case_title && ` ("${selectedInquiry.previous_case_title}")`}
                      </span>
                    </div>
                    {inquiries.some((i) => i.id === selectedInquiry.previous_case_id) && (
                      <button
                        type="button"
                        onClick={() => setSelectedInquiryId(selectedInquiry.previous_case_id || null)}
                        className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {locale === "ko" ? "이전 케이스 보기 →" : "View Parent Case →"}
                      </button>
                    )}
                  </div>
                )}

                {/* Action Required Alert Banner */}
                {getNormalizedStatus(selectedInquiry.status) === "ACTION_REQUIRED" && (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/30 space-y-1.5">
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>{t.support.actionRequestedBanner}</span>
                    </p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300/80 leading-relaxed">
                      {locale === "ko"
                        ? "운영팀에서 추가 확인 및 조치를 요청했습니다. 아래 대화 내용을 확인하시고 회신해 주세요."
                        : "Support has requested additional information or action. Please review the conversation below and submit your reply."}
                    </p>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">{t.support.store}</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedInquiry.store_name ? `🏪 ${selectedInquiry.store_name}` : t.support.companyGeneral}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">{t.support.created}</span>
                    <span>{formatDate(selectedInquiry.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">{t.support.priority}</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase text-[10px]">
                      {selectedInquiry.priority === "urgent"
                        ? t.support.priorityUrgent
                        : selectedInquiry.priority === "high"
                        ? t.support.priorityHigh
                        : t.support.priorityNormal}
                    </span>
                  </div>
                </div>

                {/* Context Link Banner if present */}
                {(selectedInquiry.related_order_number || selectedInquiry.related_product_name || selectedInquiry.related_protection_id) && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                      {t.support.linkedContext}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      {selectedInquiry.related_order_number && (
                        <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
                          <span>📦 {t.support.order}:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            #{selectedInquiry.related_order_number}
                          </span>
                        </div>
                      )}
                      {selectedInquiry.related_fulfillment_number && (
                        <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
                          <span>🚚 {t.support.delivery}:</span>
                          <span className="font-mono font-medium text-sky-600 dark:text-sky-400">
                            #{selectedInquiry.related_fulfillment_number}
                          </span>
                        </div>
                      )}
                      {selectedInquiry.related_product_name && (
                        <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
                          <span>🏷️ {t.support.product}:</span>
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {selectedInquiry.related_product_name}
                          </span>
                        </div>
                      )}
                      {selectedInquiry.related_protection_id && (
                        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                          <span>🛡️ 90-Day Protection Review Associated</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Switcher */}
                <div className="flex items-center gap-4 pt-2 border-b border-zinc-100 dark:border-zinc-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("conversation")}
                    className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === "conversation"
                        ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    💬 {t.support.tabConversation}
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
                    📋 {t.support.tabCaseLog}
                  </button>
                </div>
              </div>

              {/* Tab 1: Conversation */}
              {activeTab === "conversation" && (
                <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto">
                  {/* Initial Inquiry Message */}
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                        {companyName || "Retailer Member"} ({t.support.byRetailer})
                      </span>
                      <span>{formatDate(selectedInquiry.created_at)}</span>
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-100 dark:bg-zinc-800 p-3.5 text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                      {selectedInquiry.content}
                      {selectedInquiry.attachment_url && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 text-[10px] font-bold">
                          <span>📎</span>
                          <a
                            href={selectedInquiry.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {selectedInquiry.attachment_filename || "Attachment"}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message Thread (Filtering out pure system logs for clean conversation) */}
                  {(selectedInquiry.messages ?? [])
                    .filter(
                      (m) =>
                        m.content !== selectedInquiry.content &&
                        (m.messageType === "message" ||
                          m.messageType === "action_required" ||
                          m.messageType === "action_resolved")
                    )
                    .map((msg) => {
                      const isAdmin = msg.senderType === "admin";
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col gap-1 ${isAdmin ? "items-start" : "items-end"}`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                            {isAdmin ? (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                🛡️ {t.support.adminSupport}
                              </span>
                            ) : (
                              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                {msg.senderName || t.support.retailerMember}
                              </span>
                            )}
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                              isAdmin
                                ? "bg-indigo-50/80 text-zinc-900 dark:bg-indigo-950/40 dark:text-indigo-100 rounded-tl-xs border border-indigo-200 dark:border-indigo-900"
                                : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-xs"
                            } ${msg.isActionFlag ? "border-2 border-rose-400 dark:border-rose-500" : ""}`}
                          >
                            {msg.isActionFlag && (
                              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                                ⚠️ {t.support.actionRequested}
                              </div>
                            )}
                            {msg.content}
                            {msg.attachmentUrl && (
                              <div className="mt-2.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-1.5 text-[10px] font-bold">
                                <span>📎</span>
                                <a
                                  href={msg.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline opacity-90"
                                >
                                  {msg.attachmentFilename || "Attachment"}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Tab 2: Case Log */}
              {activeTab === "caselog" && (
                <div className="p-5 space-y-3 max-h-[460px] overflow-y-auto">
                  <div className="space-y-3">
                    {/* Log 1: Creation */}
                    <div className="flex items-start gap-3 text-xs">
                      <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                        📥
                      </span>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-bold text-zinc-900 dark:text-white">{t.support.caseCreated}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {formatDate(selectedInquiry.created_at)} · {companyName} {t.support.byRetailer}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Thread Events */}
                    {(selectedInquiry.messages ?? []).map((msg) => {
                      const isAdmin = msg.senderType === "admin";
                      const isSystem = msg.senderType === "system";

                      let icon = "💬";
                      let title = isAdmin ? t.support.adminSupport : t.support.retailerMember;

                      if (msg.messageType === "action_required" || msg.isActionFlag) {
                        icon = "⚠️";
                        title = t.support.actionRequested;
                      } else if (msg.messageType === "action_resolved") {
                        icon = "✅";
                        title = t.support.actionResolved;
                      } else if (msg.messageType === "status_change") {
                        icon = "🔄";
                        title = t.support.statusChanged;
                      } else if (msg.messageType === "case_closed") {
                        icon = "🔒";
                        title = t.support.caseClosed;
                      } else if (msg.messageType === "satisfaction") {
                        icon = "⭐";
                        title = t.support.satisfactionRated;
                      }

                      return (
                        <div key={msg.id} className="flex items-start gap-3 text-xs">
                          <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                            {icon}
                          </span>
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="font-bold text-zinc-900 dark:text-white">{title}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 break-words">
                              {msg.content}
                            </p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              {formatDate(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Log Closed Status if closed */}
                    {isSelectedClosed && (
                      <div className="flex items-start gap-3 text-xs">
                        <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                          🔒
                        </span>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="font-bold text-zinc-900 dark:text-white">{t.support.caseClosed}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {selectedInquiry.closed_at ? formatDate(selectedInquiry.closed_at) : formatDate(selectedInquiry.updated_at)}
                            {selectedInquiry.closed_by_side ? ` · ${selectedInquiry.closed_by_side === "admin" ? t.support.byAdmin : t.support.byRetailer}` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Case Footer: Active Case Reply Form vs. Closed Case CSAT & Follow-up */}
              <div className="p-5 bg-zinc-50/50 dark:bg-zinc-950/20">
                {isSelectedClosed ? (
                  <div className="space-y-4">
                    {/* CSAT Rating Card */}
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>🔒</span>
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            {t.support.caseClosedBanner}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenRatingModal}
                          className="text-[11px] font-bold text-amber-600 hover:underline dark:text-amber-400 cursor-pointer"
                        >
                          {selectedInquiry.satisfaction_score ? t.support.editRating : t.support.rateSatisfaction}
                        </button>
                      </div>

                      {selectedInquiry.satisfaction_score ? (
                        <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                          <span className="text-amber-500 font-bold text-sm">
                            {"★".repeat(selectedInquiry.satisfaction_score)}{"☆".repeat(5 - selectedInquiry.satisfaction_score)}{" "}
                            ({selectedInquiry.satisfaction_score}/5)
                          </span>
                          {selectedInquiry.satisfaction_comment && (
                            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                              "{selectedInquiry.satisfaction_comment}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {t.support.ratingNotYet}
                        </p>
                      )}
                    </div>

                    {/* Follow-up CTA */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenNewModal(true, selectedInquiry)}
                        className="rounded-xl bg-zinc-900 dark:bg-white px-4 py-2.5 text-xs font-bold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
                      >
                        <span>🔄</span>
                        <span>{t.support.startFollowUp}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="space-y-3">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {t.support.sendReply}
                    </h4>

                    {replyError && (
                      <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                        {replyError}
                      </div>
                    )}

                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={3}
                      placeholder={t.support.replyPlaceholder}
                      className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-white transition-colors resize-none shadow-2xs leading-relaxed"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer">
                          <span>📎 {t.support.attachFile} (Max 20MB)</span>
                          <input
                            type="file"
                            onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        {replyFile && (
                          <span className="ml-2 text-[10px] font-mono text-zinc-500 truncate max-w-[150px]">
                            {replyFile.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenCloseModal}
                          className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        >
                          {t.support.closeCaseBtn}
                        </button>
                        <button
                          type="submit"
                          disabled={isPending || !replyContent.trim()}
                          className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer shadow-xs"
                        >
                          {isPending ? t.support.sending : t.support.sendReply}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-12 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              {t.support.selectInquiryNotice}
            </div>
          )}
        </div>
      </div>

      {/* New Inquiry / Follow-up Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {previousCaseId
                    ? `${t.support.startFollowUp} (#${previousCaseNumber || "CASE"})`
                    : t.support.modalTitle}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {previousCaseId
                    ? `${t.support.followUpTo} #${previousCaseNumber || "CASE"}`
                    : t.support.modalSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Follow-up Banner */}
            {previousCaseId && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs flex items-center justify-between text-blue-900 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>
                    {t.support.followUpTo} <strong>#{previousCaseNumber}</strong>
                    {previousCaseTitle && ` - ${previousCaseTitle}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviousCaseId(null);
                    setPreviousCaseNumber(null);
                    setPreviousCaseTitle(null);
                  }}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {t.common.cancel}
                </button>
              </div>
            )}

            <form onSubmit={handleCreateInquiry} className="space-y-3.5 pt-3 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {formError}
                </div>
              )}

              {/* Category Selector (4 cols on desktop, 2 cols on mobile) */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.support.categoryLabel} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {RETAILER_CASE_CATEGORIES.map((cat) => {
                    const label = locale === "ko" ? (cat.labelKo || cat.labelEn) : cat.labelEn;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setNewCategory(cat.key)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          newCategory === cat.key
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <span>{cat.icon}</span>
                          <span className="truncate">{label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Context Fields: Store, Order, Product */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>📍</span>
                    <span>{t.support.linkedContext}</span>
                  </span>
                  {!contextRules.defaultShowContext && (
                    <button
                      type="button"
                      onClick={() => setShowMoreContext(!showMoreContext)}
                      className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer"
                    >
                      {showMoreContext ? t.support.hideContext : t.support.showMoreContext}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Store Selector */}
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      {t.support.storeLabel}{" "}
                      {contextRules.store === "required" ? (
                        <span className="text-rose-500 font-bold">({t.support.required})</span>
                      ) : (
                        <span className="text-zinc-400">({t.support.optional})</span>
                      )}
                    </label>
                    <select
                      value={newStoreId}
                      onChange={(e) => setNewStoreId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white truncate cursor-pointer"
                    >
                      <option value="">{t.support.companyGeneral}</option>
                      {context.stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          🏪 {s.name} ({s.city || "Store"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Order Selector (Shown if default or expanded) */}
                  {(contextRules.defaultShowContext || showMoreContext || !!newOrderId) && (
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        {t.support.orderLabel}{" "}
                        {contextRules.order === "recommended" ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">({t.support.recommended})</span>
                        ) : (
                          <span className="text-zinc-400">({t.support.optional})</span>
                        )}
                      </label>
                      <select
                        value={newOrderId}
                        onChange={(e) => setNewOrderId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white truncate cursor-pointer"
                      >
                        <option value="">{t.support.noneNotSpecific}</option>
                        {(context.orders || []).map((o) => (
                          <option key={o.id} value={o.id}>
                            #{o.orderNumber} (${o.totalAmount?.toFixed(2) || "0.00"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Product Selector (Shown if default or expanded) */}
                  {(contextRules.defaultShowContext || showMoreContext || !!newProductId) && (
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                        {t.support.productLabel}{" "}
                        {contextRules.product === "recommended" ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">({t.support.recommended})</span>
                        ) : (
                          <span className="text-zinc-400">({t.support.optional})</span>
                        )}
                      </label>
                      <select
                        value={newProductId}
                        onChange={(e) => setNewProductId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white truncate cursor-pointer"
                      >
                        <option value="">{t.support.noneNotSpecific}</option>
                        {(context.products || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.support.subjectLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t.support.subjectPlaceholder}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white shadow-2xs"
                />
              </div>

              {/* Message Description */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.support.descLabel} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={4}
                  placeholder={t.support.descPlaceholder}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white transition-colors resize-none shadow-2xs leading-relaxed"
                />
              </div>

              {/* Priority & Attachment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.support.priority}
                  </label>
                  <div className="flex gap-1.5">
                    {[
                      { id: "normal", label: t.support.priorityNormal },
                      { id: "high", label: t.support.priorityHigh },
                      { id: "urgent", label: t.support.priorityUrgent },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNewPriority(p.id as any)}
                        className={`flex-1 py-1.5 text-center text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          newPriority === p.id
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.support.attachFile} <span className="font-normal text-zinc-400">({t.common.optional} - Max 20MB)</span>
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300 cursor-pointer"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newTitle.trim() || !newContent.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer shadow-xs"
                >
                  {isPending ? t.support.submitting : t.support.submitInquiry}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Satisfaction Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {t.support.ratingModalTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t.support.ratingModalSubtitle}
              </p>
            </div>

            {ratingError && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                {ratingError}
              </div>
            )}

            <form onSubmit={handleSubmitRating} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  {t.support.ratingScoreLabel}
                </label>
                <div className="flex gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setRatingScore(score)}
                      className={`text-2xl p-2 rounded-xl transition-transform hover:scale-110 cursor-pointer ${
                        ratingScore >= score ? "text-amber-500" : "text-zinc-300 dark:text-zinc-700"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  {t.support.ratingCommentLabel} <span className="font-normal text-zinc-400">({t.common.optional})</span>
                </label>
                <textarea
                  rows={3}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder={t.support.ratingCommentPlaceholder}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer"
                >
                  {isPending ? t.support.submitting : t.support.submitRating}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Case Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {t.support.closeCaseModalTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t.support.closeCaseModalDesc}
              </p>
            </div>

            {closeError && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                {closeError}
              </div>
            )}

            <form onSubmit={handleCloseCase} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  {t.support.ratingScoreLabel} <span className="font-normal text-zinc-400">({t.common.optional})</span>
                </label>
                <div className="flex gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setCloseRatingScore(score)}
                      className={`text-2xl p-2 rounded-xl transition-transform hover:scale-110 cursor-pointer ${
                        closeRatingScore >= score ? "text-amber-500" : "text-zinc-300 dark:text-zinc-700"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  {t.support.ratingCommentLabel} <span className="font-normal text-zinc-400">({t.common.optional})</span>
                </label>
                <textarea
                  rows={3}
                  value={closeRatingComment}
                  onChange={(e) => setCloseRatingComment(e.target.value)}
                  placeholder={t.support.ratingCommentPlaceholder}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer"
                >
                  {isPending ? t.support.submitting : t.support.closeCaseBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
