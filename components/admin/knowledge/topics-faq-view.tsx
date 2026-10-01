"use client";

import React, { useState, useEffect } from "react";
import KnowledgeNavTabs from "./knowledge-nav-tabs";
import { KnowledgeTopic, KnowledgeFaqItem, PortalScope, FaqStatus, FaqKind, KnowledgeItem } from "@/lib/knowledge/types";

export default function TopicsFaqView() {
  const [portalScope, setPortalScope] = useState<PortalScope>("BRAND");
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [faqs, setFaqs] = useState<KnowledgeFaqItem[]>([]);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [faqStatusFilter, setFaqStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal states
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Partial<KnowledgeTopic> | null>(null);

  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Partial<KnowledgeFaqItem> | null>(null);

  useEffect(() => {
    loadData();
  }, [portalScope]);

  const loadData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [topicsRes, faqsRes, knwRes] = await Promise.all([
        fetch(`/api/admin/knowledge/topics?portal_scope=${portalScope}&include_inactive=true`),
        fetch(`/api/admin/knowledge/faqs?portal_scope=${portalScope}`),
        fetch(`/api/admin/knowledge`)
      ]);

      if (topicsRes.ok) {
        const tData = await topicsRes.json();
        setTopics(tData.topics || []);
      }
      if (faqsRes.ok) {
        const fData = await faqsRes.json();
        setFaqs(fData.faqs || []);
      }
      if (knwRes.ok) {
        const kData = await knwRes.json();
        setKnowledgeList(kData.items || []);
      }
    } catch (e: any) {
      console.error("Failed to load topics & faqs:", e);
      setMessage({ type: "error", text: "데이터를 불러오는 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // Switch Portal Scope
  const handleScopeChange = (scope: PortalScope) => {
    setPortalScope(scope);
    setSelectedTopicId(null);
  };

  // Reorder Topic Up/Down
  const handleMoveTopic = async (index: number, direction: "UP" | "DOWN") => {
    const newTopics = [...topics];
    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTopics.length) return;

    const [moved] = newTopics.splice(index, 1);
    newTopics.splice(targetIndex, 0, moved);

    const orderedIds = newTopics.map(t => t.id);
    setTopics(newTopics);

    try {
      const res = await fetch("/api/admin/knowledge/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REORDER",
          portal_scope: portalScope,
          ordered_ids: orderedIds
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || newTopics);
        setMessage({ type: "success", text: "토픽 순서가 성공적으로 변경되었습니다." });
      }
    } catch (e) {
      loadData();
    }
  };

  // Toggle Topic Active
  const handleToggleTopicActive = async (topic: KnowledgeTopic) => {
    try {
      const res = await fetch("/api/admin/knowledge/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: topic.id,
          updates: { is_active: !topic.is_active }
        })
      });
      if (res.ok) {
        setTopics(topics.map(t => t.id === topic.id ? { ...t, is_active: !topic.is_active } : t));
        setMessage({ type: "success", text: `토픽 '${topic.name_ko}' 상태가 ${!topic.is_active ? '활성화' : '비활성화'}되었습니다.` });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save Topic Modal
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic?.name_ko) return;

    setSaving(true);
    try {
      if (editingTopic.id) {
        // Edit
        const res = await fetch("/api/admin/knowledge/topics", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTopic.id,
            updates: {
              name_ko: editingTopic.name_ko,
              name_en: editingTopic.name_en,
              short_desc_ko: editingTopic.short_desc_ko,
              short_desc_en: editingTopic.short_desc_en,
              description_ko: editingTopic.description_ko,
              description_en: editingTopic.description_en,
              icon: editingTopic.icon || "📁",
              is_active: editingTopic.is_active ?? true,
              match_modules: typeof editingTopic.match_modules === "string" 
                ? (editingTopic.match_modules as string).split(",").map(s => s.trim()).filter(Boolean)
                : editingTopic.match_modules || [],
              match_keywords: typeof editingTopic.match_keywords === "string"
                ? (editingTopic.match_keywords as string).split(",").map(s => s.trim()).filter(Boolean)
                : editingTopic.match_keywords || []
            }
          })
        });
        if (res.ok) {
          setMessage({ type: "success", text: "토픽 정보가 수정되었습니다." });
          setTopicModalOpen(false);
          loadData();
        }
      } else {
        // Create
        const res = await fetch("/api/admin/knowledge/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portal_scope: portalScope,
            name_ko: editingTopic.name_ko,
            name_en: editingTopic.name_en,
            short_desc_ko: editingTopic.short_desc_ko,
            short_desc_en: editingTopic.short_desc_en,
            description_ko: editingTopic.description_ko,
            description_en: editingTopic.description_en,
            icon: editingTopic.icon || "📁",
            is_active: editingTopic.is_active ?? true,
            match_modules: typeof editingTopic.match_modules === "string" 
              ? (editingTopic.match_modules as string).split(",").map(s => s.trim()).filter(Boolean)
              : editingTopic.match_modules || [],
            match_keywords: typeof editingTopic.match_keywords === "string"
              ? (editingTopic.match_keywords as string).split(",").map(s => s.trim()).filter(Boolean)
              : editingTopic.match_keywords || []
          })
        });
        if (res.ok) {
          setMessage({ type: "success", text: "새 토픽이 성공적으로 생성되었습니다." });
          setTopicModalOpen(false);
          loadData();
        }
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "토픽 저장 실패" });
    } finally {
      setSaving(false);
    }
  };

  // Delete Topic
  const handleDeleteTopic = async (topicId: string, name: string) => {
    if (!confirm(`'${name}' 토픽을 삭제하시겠습니까? 연결된 FAQ의 토픽 지정이 해제됩니다.`)) return;
    try {
      const res = await fetch(`/api/admin/knowledge/topics?id=${topicId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "토픽이 삭제되었습니다." });
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save FAQ Modal
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq?.question_ko || !editingFaq?.answer_ko) return;

    setSaving(true);
    try {
      if (editingFaq.id) {
        // Edit FAQ
        const res = await fetch("/api/admin/knowledge/faqs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "EDIT",
            faqId: editingFaq.id,
            updates: {
              topic_id: editingFaq.topic_id || null,
              source_knowledge_id: editingFaq.source_knowledge_id,
              question_ko: editingFaq.question_ko,
              question_en: editingFaq.question_en,
              answer_ko: editingFaq.answer_ko,
              answer_en: editingFaq.answer_en,
              kind: editingFaq.kind || "BOTH",
              status: editingFaq.status || "APPROVED",
              is_featured: editingFaq.is_featured ?? false,
              display_order: editingFaq.display_order ?? 0
            }
          })
        });
        if (res.ok) {
          setMessage({ type: "success", text: "FAQ가 성공적으로 수정되었습니다." });
          setFaqModalOpen(false);
          loadData();
        }
      } else {
        // Create FAQ
        const res = await fetch("/api/admin/knowledge/faqs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CREATE",
            manualFaq: {
              portal_scope: portalScope,
              topic_id: editingFaq.topic_id || null,
              source_knowledge_id: editingFaq.source_knowledge_id,
              question_ko: editingFaq.question_ko,
              question_en: editingFaq.question_en,
              answer_ko: editingFaq.answer_ko,
              answer_en: editingFaq.answer_en,
              kind: editingFaq.kind || "BOTH",
              status: editingFaq.status || "APPROVED",
              is_featured: editingFaq.is_featured ?? false,
              display_order: editingFaq.display_order ?? 0
            }
          })
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: "새 FAQ가 성공적으로 등록되었습니다." });
          setFaqModalOpen(false);
          loadData();
        } else {
          setMessage({ type: "error", text: data.error || "FAQ 등록 실패" });
        }
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "FAQ 저장 실패" });
    } finally {
      setSaving(false);
    }
  };

  // Change FAQ Status
  const handleFaqStatusChange = async (faqId: string, newStatus: FaqStatus) => {
    try {
      const action = newStatus === "APPROVED" ? "APPROVE" : newStatus === "INACTIVE" ? "DEACTIVATE" : "EDIT";
      const res = await fetch("/api/admin/knowledge/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          faqId,
          updates: { status: newStatus }
        })
      });
      if (res.ok) {
        setFaqs(faqs.map(f => f.id === faqId ? { ...f, status: newStatus } : f));
        setMessage({ type: "success", text: `FAQ 상태가 '${newStatus}'(으)로 변경되었습니다.` });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete FAQ
  const handleDeleteFaq = async (faqId: string, question: string) => {
    if (!confirm(`FAQ '${question}' 항목을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch("/api/admin/knowledge/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE", faqId })
      });
      if (res.ok) {
        setMessage({ type: "success", text: "FAQ가 삭제되었습니다." });
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered FAQs
  const filteredFaqs = faqs.filter(f => {
    if (selectedTopicId && f.topic_id !== selectedTopicId) return false;
    if (faqStatusFilter !== "ALL" && f.status !== faqStatusFilter) return false;
    return true;
  });

  const eligibleKnowledgeForScope = knowledgeList.filter(k => {
    if (k.status !== "PUBLISHED") return false;
    if (portalScope === "BRAND") {
      return k.audience?.includes("BRAND") || k.audience?.includes("PUBLIC");
    } else {
      return k.audience?.includes("RETAILER") || k.audience?.includes("PUBLIC");
    }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Knowledge Center
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            공식 Knowledge, Help Center Topic 분류체계 및 FAQ/추천 질문을 관리합니다.
          </p>
        </div>
      </div>

      <KnowledgeNavTabs />

      {/* Scope Switcher & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-2">
            Portal Scope:
          </span>
          <button
            onClick={() => handleScopeChange("BRAND")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              portalScope === "BRAND"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span>🏢</span>
            <span>Brand Portal</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              portalScope === "BRAND" ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900 font-bold" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
            }`}>
              {topics.filter(t => t.portal_scope === "BRAND").length}
            </span>
          </button>
          <button
            onClick={() => handleScopeChange("RETAILER")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              portalScope === "RETAILER"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span>🏬</span>
            <span>Retail Portal</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              portalScope === "RETAILER" ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900 font-bold" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
            }`}>
              {topics.filter(t => t.portal_scope === "RETAILER").length}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setEditingTopic({
                portal_scope: portalScope,
                name_ko: "",
                name_en: "",
                short_desc_ko: "",
                short_desc_en: "",
                icon: "📁",
                is_active: true
              });
              setTopicModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg text-sm font-semibold transition-colors border border-zinc-300 dark:border-zinc-700"
          >
            <span>➕</span>
            <span>Topic 추가</span>
          </button>
          <button
            onClick={() => {
              setEditingFaq({
                portal_scope: portalScope,
                topic_id: selectedTopicId || topics[0]?.id || null,
                source_knowledge_id: eligibleKnowledgeForScope[0]?.id || "",
                question_ko: "",
                question_en: "",
                answer_ko: "",
                answer_en: "",
                kind: "BOTH",
                status: "APPROVED",
                is_featured: false
              });
              setFaqModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <span>➕</span>
            <span>FAQ 추가</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm font-medium flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100 ml-4 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main 2-Column Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Topic Taxonomy (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-zinc-900 dark:text-white text-base">
                {portalScope === "BRAND" ? "Brand Topics" : "Retail Topics"}
              </span>
              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {topics.length}개
              </span>
            </div>
            {selectedTopicId && (
              <button
                onClick={() => setSelectedTopicId(null)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                전체 보기
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-sm">토픽 데이터를 불러오는 중...</div>
          ) : topics.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-4xl">📂</div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                아직 등록된 {portalScope === "BRAND" ? "Brand" : "Retail"} Topic이 없습니다.
              </div>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                {portalScope === "RETAILER"
                  ? "리테일 포털 전용 토픽은 브랜드 포털과 완전히 독립되어 관리됩니다. [+ Topic 추가] 버튼을 눌러 리테일 전용 토픽을 등록하세요."
                  : "새로운 토픽을 추가하여 FAQ 및 지식을 체계적으로 분류하세요."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {topics.map((topic, index) => {
                const isSelected = selectedTopicId === topic.id;
                return (
                  <div
                    key={topic.id}
                    onClick={() => setSelectedTopicId(isSelected ? null : topic.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col space-y-2 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-xl">{topic.icon || "📁"}</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">
                              {topic.name_ko}
                            </span>
                            {topic.name_en && (
                              <span className="text-xs text-zinc-400">({topic.name_en})</span>
                            )}
                            {!topic.is_active && (
                              <span className="text-[10px] bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 px-1.5 py-0.5 rounded font-semibold">
                                비활성
                              </span>
                            )}
                          </div>
                          {topic.short_desc_ko && (
                            <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                              {topic.short_desc_ko}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div
                        className="flex items-center space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleMoveTopic(index, "UP")}
                          disabled={index === 0}
                          title="위로 이동"
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 disabled:opacity-30 text-xs"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveTopic(index, "DOWN")}
                          disabled={index === topics.length - 1}
                          title="아래로 이동"
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 disabled:opacity-30 text-xs"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => {
                            setEditingTopic({
                              ...topic,
                              match_modules: (topic.match_modules || []).join(", ") as any,
                              match_keywords: (topic.match_keywords || []).join(", ") as any
                            });
                            setTopicModalOpen(true);
                          }}
                          title="수정"
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-900 text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggleTopicActive(topic)}
                          title={topic.is_active ? "비활성화" : "활성화"}
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            topic.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {topic.is_active ? "활성" : "비활성"}
                        </button>
                      </div>
                    </div>

                    {/* Stats & Metadata */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <span className="font-mono">#{topic.display_order} · {topic.id}</span>
                      <div className="flex items-center space-x-3">
                        <span>FAQ <b>{topic.faq_count || 0}</b>개</span>
                        <span>Knowledge <b>{topic.knowledge_count || 0}</b>개</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: FAQs for Selected Topic or All (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-zinc-900 dark:text-white text-base">
                  {selectedTopicId
                    ? `${topics.find(t => t.id === selectedTopicId)?.icon || "📁"} ${topics.find(t => t.id === selectedTopicId)?.name_ko} FAQs`
                    : `${portalScope === "BRAND" ? "Brand Portal" : "Retail Portal"} 전체 FAQs`}
                </span>
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {filteredFaqs.length}개
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                포털 사용자가 검색 및 확인 가능한 승인 FAQ와 추천 질문 목록입니다.
              </p>
            </div>

            {/* Status Filter */}
            <select
              value={faqStatusFilter}
              onChange={(e) => setFaqStatusFilter(e.target.value)}
              className="text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 font-medium"
            >
              <option value="ALL">전체 상태</option>
              <option value="APPROVED">APPROVED (승인됨)</option>
              <option value="CANDIDATE">CANDIDATE (후보)</option>
              <option value="INACTIVE">INACTIVE (비활성)</option>
              <option value="UPDATE_REQUIRED">UPDATE_REQUIRED (검토 필요)</option>
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-sm">FAQ 데이터를 불러오는 중...</div>
          ) : filteredFaqs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-4xl">💬</div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                등록된 FAQ가 없습니다.
              </div>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                {selectedTopicId
                  ? "선택한 Topic에 등록된 FAQ가 없습니다. [+ FAQ 추가] 버튼을 눌러 새 FAQ를 등록하세요."
                  : "포털에 표시할 FAQ를 추가해 보세요."}
              </p>
              <button
                onClick={() => {
                  setEditingFaq({
                    portal_scope: portalScope,
                    topic_id: selectedTopicId || topics[0]?.id || null,
                    source_knowledge_id: eligibleKnowledgeForScope[0]?.id || "",
                    question_ko: "",
                    answer_ko: "",
                    kind: "BOTH",
                    status: "APPROVED"
                  });
                  setFaqModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                <span>➕</span>
                <span>이 토픽에 FAQ 추가</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq) => {
                const topic = topics.find(t => t.id === faq.topic_id);
                return (
                  <div
                    key={faq.id}
                    className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5"
                  >
                    {/* FAQ Header & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {topic && (
                          <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded font-medium border border-zinc-200 dark:border-zinc-700">
                            {topic.icon} {topic.name_ko}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            faq.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : faq.status === "CANDIDATE"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : faq.status === "UPDATE_REQUIRED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {faq.status}
                        </span>
                        <span className="text-[10px] bg-zinc-50 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                          {faq.kind}
                        </span>
                        {faq.is_featured && (
                          <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                            ⭐ Featured
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            setEditingFaq(faq);
                            setFaqModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 rounded font-medium"
                        >
                          수정
                        </button>
                        {faq.status !== "APPROVED" && (
                          <button
                            onClick={() => handleFaqStatusChange(faq.id, "APPROVED")}
                            className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                          >
                            승인
                          </button>
                        )}
                        {faq.status === "APPROVED" && (
                          <button
                            onClick={() => handleFaqStatusChange(faq.id, "INACTIVE")}
                            className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 rounded font-medium"
                          >
                            비활성화
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFaq(faq.id, faq.question_ko)}
                          className="p-1 text-xs text-rose-500 hover:text-rose-700 rounded"
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Question & Answer */}
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-zinc-900 dark:text-white flex items-start space-x-1.5">
                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">Q.</span>
                        <span>{faq.question_ko}</span>
                      </div>
                      {faq.question_en && (
                        <p className="text-xs text-zinc-400 pl-4">{faq.question_en}</p>
                      )}
                      <div className="text-xs text-zinc-600 dark:text-zinc-300 pl-4 pt-1 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded border border-zinc-100 dark:border-zinc-800/60 leading-relaxed">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1">A.</span>
                        {faq.answer_ko}
                      </div>
                    </div>

                    {/* Source Knowledge Tag */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                      <span className="flex items-center space-x-1">
                        <span>📖 공식 근거:</span>
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-xs">
                          {faq.source_title} ({faq.source_version})
                        </span>
                      </span>
                      <span className="font-mono">#{faq.display_order}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* TOPIC MODAL (CREATE / EDIT) */}
      {topicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingTopic?.id ? "토픽 수정" : `신규 ${portalScope === "BRAND" ? "Brand" : "Retail"} 토픽 추가`}
              </h3>
              <button
                onClick={() => setTopicModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    아이콘 (Emoji)
                  </label>
                  <input
                    type="text"
                    value={editingTopic?.icon || ""}
                    onChange={(e) => setEditingTopic({ ...editingTopic, icon: e.target.value })}
                    className="w-full text-center text-lg border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                    placeholder="📁"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    토픽 한글명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTopic?.name_ko || ""}
                    onChange={(e) => setEditingTopic({ ...editingTopic, name_ko: e.target.value })}
                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                    placeholder="예: 발주 요청 & 오더"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  토픽 영문명 (Name EN)
                </label>
                <input
                  type="text"
                  value={editingTopic?.name_en || ""}
                  onChange={(e) => setEditingTopic({ ...editingTopic, name_en: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="예: Orders & PO"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  요약 한글 설명 (Short Desc KO)
                </label>
                <input
                  type="text"
                  value={editingTopic?.short_desc_ko || ""}
                  onChange={(e) => setEditingTopic({ ...editingTopic, short_desc_ko: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="예: 발주서 · PO 접수 · 납기 관리"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  상세 설명 (Full Description)
                </label>
                <textarea
                  rows={2}
                  value={editingTopic?.description_ko || ""}
                  onChange={(e) => setEditingTopic({ ...editingTopic, description_ko: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="토픽에 대한 상세 안내 문구를 작성하세요."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  매칭 모듈 / 키워드 (쉼표 구분)
                </label>
                <input
                  type="text"
                  value={typeof editingTopic?.match_keywords === "string" ? editingTopic.match_keywords : (editingTopic?.match_keywords || []).join(", ")}
                  onChange={(e) => setEditingTopic({ ...editingTopic, match_keywords: e.target.value as any })}
                  className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="예: 발주, 오더, po, purchase order"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="topic_is_active"
                  checked={editingTopic?.is_active ?? true}
                  onChange={(e) => setEditingTopic({ ...editingTopic, is_active: e.target.checked })}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="topic_is_active" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  포털 Help Center에 즉시 활성화 (Active)
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                {editingTopic?.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTopic(editingTopic.id!, editingTopic.name_ko!)}
                    className="text-xs text-rose-600 hover:underline font-semibold"
                  >
                    토픽 삭제
                  </button>
                )}
                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setTopicModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장하기"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ MODAL (CREATE / EDIT) */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingFaq?.id ? "FAQ 수정" : `신규 ${portalScope === "BRAND" ? "Brand" : "Retail"} FAQ 추가`}
              </h3>
              <button
                onClick={() => setFaqModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    소속 Topic <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editingFaq?.topic_id || ""}
                    onChange={(e) => setEditingFaq({ ...editingFaq, topic_id: e.target.value })}
                    className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                    required
                  >
                    <option value="">토픽을 선택하세요</option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.name_ko}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    연결 공식 지식 (Source Knowledge)
                  </label>
                  <select
                    value={editingFaq?.source_knowledge_id || ""}
                    onChange={(e) => setEditingFaq({ ...editingFaq, source_knowledge_id: e.target.value })}
                    className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                  >
                    {eligibleKnowledgeForScope.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.title_ko} ({k.current_version})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  질문 (Question KO) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingFaq?.question_ko || ""}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question_ko: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="예: 브랜드는 어떻게 등록하나요?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  질문 영문 (Question EN)
                </label>
                <input
                  type="text"
                  value={editingFaq?.question_en || ""}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question_en: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="How do I register a brand?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  답변 (Answer KO) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={editingFaq?.answer_ko || ""}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer_ko: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800 leading-relaxed"
                  placeholder="공식 정책에 기반한 명확하고 정확한 답변을 입력하세요."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  답변 영문 (Answer EN)
                </label>
                <textarea
                  rows={3}
                  value={editingFaq?.answer_en || ""}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer_en: e.target.value })}
                  className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  placeholder="English answer translation"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    유형 (Kind)
                  </label>
                  <select
                    value={editingFaq?.kind || "BOTH"}
                    onChange={(e) => setEditingFaq({ ...editingFaq, kind: e.target.value as FaqKind })}
                    className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="BOTH">BOTH (FAQ + 추천 질문)</option>
                    <option value="FAQ">FAQ 전용</option>
                    <option value="SUGGESTED_QUESTION">추천 질문 전용</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    승인 상태 (Status)
                  </label>
                  <select
                    value={editingFaq?.status || "APPROVED"}
                    onChange={(e) => setEditingFaq({ ...editingFaq, status: e.target.value as FaqStatus })}
                    className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="APPROVED">APPROVED (승인됨)</option>
                    <option value="CANDIDATE">CANDIDATE (후보)</option>
                    <option value="INACTIVE">INACTIVE (비활성)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFaq?.is_featured ?? false}
                      onChange={(e) => setEditingFaq({ ...editingFaq, is_featured: e.target.checked })}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>⭐ 상단 고정 (Featured)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFaqModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
