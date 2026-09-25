"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
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
  RetailerCaseContext,
} from "@/lib/retailer/support-actions";

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
  const [inquiries, setInquiries] = useState<PartnerInquiryItem[]>(initialInquiries);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(
    inquiries.length > 0 ? inquiries[0].id : null
  );

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OfficialCaseStatus>("ALL");
  const [storeFilter, setStoreFilter] = useState<string>("ALL");

  // New Inquiry Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCategory, setNewCategory] = useState<string>("order_delivery");
  const [newStoreId, setNewStoreId] = useState<string>(userStoreId || context.stores[0]?.id || "");
  const [newOrderId, setNewOrderId] = useState<string>("");
  const [newProductId, setNewProductId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  // Reply Form State
  const [replyContent, setReplyContent] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyError, setReplyError] = useState("");

  const [isPending, startTransition] = useTransition();

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

  const handleCreateInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newTitle.trim()) {
      setFormError("Please enter a subject / title for your inquiry.");
      return;
    }
    if (!newContent.trim()) {
      setFormError("Please describe your question or issue in detail.");
      return;
    }

    const fd = new FormData();
    fd.append("category", newCategory);
    if (newStoreId) fd.append("store_id", newStoreId);
    if (newOrderId) fd.append("related_order_id", newOrderId);
    if (newProductId) fd.append("related_product_id", newProductId);
    fd.append("title", newTitle.trim());
    fd.append("content", newContent.trim());
    fd.append("priority", newPriority);
    if (newFile) fd.append("file", newFile);

    startTransition(async () => {
      const res = await createRetailerSupportInquiryAction(fd);
      if (res.success) {
        setShowNewModal(false);
        setNewTitle("");
        setNewContent("");
        setNewFile(null);
        setFormError("");
        window.location.reload();
      } else {
        setFormError(res.error || "Failed to create inquiry. Please try again.");
      }
    });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setReplyError("");

    if (!replyContent.trim()) {
      setReplyError("Please enter a reply message.");
      return;
    }

    const fd = new FormData();
    fd.append("inquiry_id", selectedInquiry.id);
    fd.append("content", replyContent.trim());
    if (replyFile) fd.append("file", replyFile);

    startTransition(async () => {
      const res = await addRetailerInquiryReplyAction(fd);
      if (res.success) {
        setReplyContent("");
        setReplyFile(null);
        setReplyError("");
        window.location.reload();
      } else {
        setReplyError(res.error || "Failed to submit reply.");
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
                Retailer Support & Inquiries
              </h1>
              <span className="text-xs text-zinc-400 font-medium">소매점 1:1 지원 센터</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Get assistance with orders, shipping, pricing, shelf tags, weekly reporting, or technical questions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>New Inquiry (새 문의)</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Inquiries</span>
            <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{counts.total}</p>
          </div>
          <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-3">
            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">Under Review</span>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">{counts.underReview}</p>
          </div>
          <div className="rounded-xl bg-rose-50/60 dark:bg-rose-950/20 p-3">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Action Required</span>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">{counts.actionRequired}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Closed</span>
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
                placeholder="Search cases by #, title, store, order, product..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "ALL", label: "All", count: counts.total },
                { id: "UNDER_REVIEW", label: "Under Review", count: counts.underReview },
                { id: "ACTION_REQUIRED", label: "Action Req.", count: counts.actionRequired },
                { id: "CLOSED", label: "Closed", count: counts.closed },
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
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <option value="ALL">All Stores (전체 매장)</option>
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
                          {OFFICIAL_STATUS_LABEL[norm].en}
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
                        {catMeta.en}
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
                    {(item.related_order_number || item.related_product_name) && (
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono">
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
                        <span>Action requested by Support</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-zinc-400 dark:text-zinc-500 space-y-2">
                <span className="text-2xl block">💬</span>
                <p>No support inquiries found.</p>
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="text-xs font-bold text-zinc-900 underline hover:text-zinc-700 dark:text-white"
                >
                  Create your first inquiry
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Case Detail & Conversation Thread (7 cols) */}
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
                        {OFFICIAL_STATUS_LABEL[getNormalizedStatus(selectedInquiry.status)].en} (
                        {OFFICIAL_STATUS_LABEL[getNormalizedStatus(selectedInquiry.status)].ko})
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                        {ALL_CASE_CATEGORY_LABELS[selectedInquiry.category]?.en || selectedInquiry.category}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-snug">
                      {selectedInquiry.title}
                    </h2>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Store (매장)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedInquiry.store_name ? `🏪 ${selectedInquiry.store_name}` : "Company General"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Created (접수일자)</span>
                    <span>{formatDate(selectedInquiry.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Priority (우선순위)</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase text-[10px]">
                      {selectedInquiry.priority || "Normal"}
                    </span>
                  </div>
                </div>

                {/* Context Link Banner if present */}
                {(selectedInquiry.related_order_number || selectedInquiry.related_product_name || selectedInquiry.related_protection_id) && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                      Linked Context (연계 정보)
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      {selectedInquiry.related_order_number && (
                        <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
                          <span>📦 Order:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            #{selectedInquiry.related_order_number}
                          </span>
                        </div>
                      )}
                      {selectedInquiry.related_fulfillment_number && (
                        <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
                          <span>🚚 Delivery:</span>
                          <span className="font-mono font-medium text-sky-600 dark:text-sky-400">
                            #{selectedInquiry.related_fulfillment_number}
                          </span>
                        </div>
                      )}
                      {selectedInquiry.related_product_name && (
                        <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
                          <span>🏷️ Product:</span>
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
              </div>

              {/* Message Thread */}
              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                {/* Initial Inquiry Message */}
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {selectedInquiry.requesterName || "You"} (Retailer)
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

                {/* Follow-up Messages */}
                {(selectedInquiry.messages ?? []).map((msg) => {
                  const isAdmin = msg.senderType === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${isAdmin ? "items-start" : "items-end"}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                        {isAdmin ? (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            🛡️ {msg.senderName || "K SELECT Support"} (Admin)
                          </span>
                        ) : (
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            {msg.senderName || "You"}
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
                            ⚠️ Action Requested by Support
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

              {/* Reply Form or Closed Notice */}
              <div className="p-5 bg-zinc-50/50 dark:bg-zinc-950/20">
                {isSelectedClosed ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900 space-y-1">
                    <span className="text-base block">🔒</span>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      This case has been resolved and closed.
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      If you have further questions, please submit a new inquiry.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="space-y-3">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Send Reply to Support Team (답변 작성)
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
                      placeholder="Type your message or response here..."
                      className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-white transition-colors resize-none shadow-2xs"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer">
                          <span>📎 Attach File (Max 20MB)</span>
                          <input
                            type="file"
                            onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        {replyFile && (
                          <span className="ml-2 text-[10px] font-mono text-zinc-500 truncate max-w-[150px]">
                            {replyFile.name}
                          </span>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isPending || !replyContent.trim()}
                        className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer shadow-xs"
                      >
                        {isPending ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-12 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              Select an inquiry from the list to view the conversation thread.
            </div>
          )}
        </div>
      </div>

      {/* New Inquiry Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Create Support Inquiry (새 문의 작성)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select a category and provide details so our team can assist you promptly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-4 pt-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400">
                  {formError}
                </div>
              )}

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Inquiry Category (문의 유형) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RETAILER_CASE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setNewCategory(cat.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        newCategory === cat.key
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <span>{cat.icon}</span>
                        <span>{cat.labelEn}</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 opacity-75 truncate`}>
                        {cat.labelKo}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Store Selector */}
              {context.stores.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Store (매장)
                  </label>
                  <select
                    value={newStoreId}
                    onChange={(e) => setNewStoreId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="">Company General (매장 공통)</option>
                    {context.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        🏪 {s.name} ({s.city || "Store"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Optional Order & Product Context Linkers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Related Order (연계 주문 - 선택)
                  </label>
                  <select
                    value={newOrderId}
                    onChange={(e) => setNewOrderId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="">None / Not specific</option>
                    {(context.orders || []).map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.orderNumber} (${o.totalAmount?.toFixed(2) || "0.00"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Related Product (연계 상품 - 선택)
                  </label>
                  <select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="">None / Not specific</option>
                    {(context.products || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Priority (우선순위)
                </label>
                <div className="flex gap-2">
                  {[
                    { id: "normal", label: "Normal (일반)" },
                    { id: "high", label: "⚡ High (높음)" },
                    { id: "urgent", label: "🚨 Urgent (긴급)" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPriority(p.id as any)}
                      className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        newPriority === p.id
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Subject / Title (제목) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Question regarding Order #RO-2026-001 delivery status"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white shadow-2xs"
                />
              </div>

              {/* Message Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Description (상세 내용) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={4}
                  placeholder="Please provide complete details, SKU numbers, or questions so our team can resolve it faster."
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white transition-colors resize-none shadow-2xs leading-relaxed"
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Attachment (첨부 파일 - 최대 20MB)
                </label>
                <input
                  type="file"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newTitle.trim() || !newContent.trim()}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors cursor-pointer shadow-xs"
                >
                  {isPending ? "Submitting..." : "Submit Inquiry (문의 등록)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
