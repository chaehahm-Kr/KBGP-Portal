"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GuideAnswerResponse } from "@/lib/knowledge/types";

interface GuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Module Discovery Structure & Representative Questions
interface ModuleDiscovery {
  id: string;
  name: string;
  badge?: string;
  questions: string[];
}

const MODULE_DISCOVERY_LIST: ModuleDiscovery[] = [
  {
    id: "INSIGHTS",
    name: "INSIGHTS",
    badge: "Core",
    questions: [
      "INSIGHTS Topic Score 기준은?",
      "HIGH Risk는 무엇을 확인해야 해?",
      "Revision은 언제 요청해?",
      "오늘 Draft가 0개면 오류인가요?",
      "Automation Run 상태를 설명해줘"
    ]
  },
  {
    id: "KNOWLEDGE",
    name: "Knowledge Center",
    badge: "Core",
    questions: [
      "새 매뉴얼은 어떻게 등록해?",
      "Published Knowledge를 수정하려면?",
      "Audience 차이는 뭐야?",
      "Potentially Outdated가 뭐야?",
      "PDF Manual은 어떻게 관리해?"
    ]
  },
  {
    id: "SIMULATOR",
    name: "Growth Simulator",
    badge: "New",
    questions: [
      "시뮬레이터 모형 설정 방법",
      "Profitability 시뮬레이션 실행",
      "마진 파라미터 계산 기준"
    ]
  },
  {
    id: "PRODUCTS",
    name: "Products",
    questions: [
      "Product Curation 기준은?",
      "Attribute Profile 적용 방법",
      "Pricing Profitability 계산 기준"
    ]
  },
  {
    id: "APPLICATIONS",
    name: "Applications",
    questions: [
      "브랜드 파트너 입점 신청 검토 기준",
      "온보딩 심사 절차"
    ]
  }
];

// Search Suggestions Map (Supports Korean / English / Typos / Synonyms)
const SUGGESTION_MAP: Record<string, string[]> = {
  인사이트: ["INSIGHTS Topic Score 기준은?", "INSIGHTS High Risk 수칙", "Automation Run 상태"],
  인싸이트: ["INSIGHTS Topic Score 기준은?", "INSIGHTS High Risk 수칙"],
  insigh: ["INSIGHTS Topic Score 기준은?", "INSIGHTS Automation Run Status"],
  insight: ["INSIGHTS Topic Score 기준은?", "INSIGHTS High Risk 수칙"],
  insighp: ["INSIGHTS Topic Score 기준은?", "INSIGHTS High Risk 수칙"],
  시뮬: ["시뮬레이터 모형 설정 방법", "Profitability 시뮬레이션 실행"],
  simul: ["시뮬레이터 모형 설정 방법", "Profitability 시뮬레이션 실행"],
  메뉴얼: ["K SELECT INSIGHTS 실무자 운영 매뉴얼", "새 매뉴얼 등록 방법", "Manual Version 관리"],
  매뉴얼: ["K SELECT INSIGHTS 실무자 운영 매뉴얼", "새 매뉴얼 등록 방법", "Manual Version 관리"],
  manu: ["K SELECT INSIGHTS Operations Manual", "Manual Versioning Guide"],
  manual: ["K SELECT INSIGHTS Operations Manual", "Manual Versioning Guide"],
  승인: ["INSIGHTS Review Queue 승인 가이드", "GO APPROVE 판정 수칙"],
  approve: ["GO APPROVE decision guide", "Review Queue Approval"],
  수정: ["Create New Version 사용법", "FIX REQUEST REVISION 수칙"],
  revision: ["FIX REQUEST REVISION guide", "Create New Version procedure"],
  outdated: ["Potentially Outdated 처리 지침", "Review & Updates 관리"]
};

// 3-State Model: OPEN | HIDDEN | CLOSED
type DrawerState = "OPEN" | "HIDDEN" | "CLOSED";

const STORAGE_KEY_STATE = "kselect_guide_state_v1";
const STORAGE_KEY_ANSWER = "kselect_guide_current_answer_v1";

export default function GuideDrawer({ isOpen, onClose }: GuideDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerState, setDrawerState] = useState<DrawerState>("CLOSED");
  const [questionInput, setQuestionInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<GuideAnswerResponse | null>(null);
  const [history, setHistory] = useState<GuideAnswerResponse[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const [gapSubmitted, setGapSubmitted] = useState<Record<string, boolean>>({});
  const [activeModuleId, setActiveModuleId] = useState<string>("INSIGHTS");

  // Restore persistent state from sessionStorage on mount / route change
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(STORAGE_KEY_STATE);
      const savedAnswerJson = sessionStorage.getItem(STORAGE_KEY_ANSWER);

      if (savedState === "HIDDEN") {
        setDrawerState("HIDDEN");
        if (savedAnswerJson) {
          try { setCurrentAnswer(JSON.parse(savedAnswerJson)); } catch (e) {}
        }
      } else if (isOpen) {
        if (drawerState === "CLOSED" && savedState !== "HIDDEN") {
          setDrawerState("OPEN");
          sessionStorage.setItem(STORAGE_KEY_STATE, "OPEN");
        }
      }
    } catch (e) {}
  }, [isOpen, pathname]);

  // Sync route module context on route change
  useEffect(() => {
    if (pathname.includes("/admin/insights")) setActiveModuleId("INSIGHTS");
    else if (pathname.includes("/admin/knowledge")) setActiveModuleId("KNOWLEDGE");
    else if (pathname.includes("/admin/simulator")) setActiveModuleId("SIMULATOR");
    else if (pathname.includes("/admin/products")) setActiveModuleId("PRODUCTS");
    else if (pathname.includes("/admin/applications")) setActiveModuleId("APPLICATIONS");
    else setActiveModuleId("INSIGHTS");
  }, [pathname]);

  if (drawerState === "CLOSED" && !isOpen) return null;

  const activeModule = MODULE_DISCOVERY_LIST.find(m => m.id === activeModuleId) || MODULE_DISCOVERY_LIST[0];

  const updateDrawerState = (newState: DrawerState) => {
    setDrawerState(newState);
    try {
      sessionStorage.setItem(STORAGE_KEY_STATE, newState);
      if (newState === "CLOSED") {
        sessionStorage.removeItem(STORAGE_KEY_ANSWER);
      }
    } catch (e) {}
  };

  const handleAsk = async (qText: string, overrideModule?: string) => {
    if (!qText.trim() || loading) return;
    setLoading(true);
    setShowHistoryModal(false);

    const targetModule = overrideModule || activeModuleId;

    try {
      const res = await fetch("/api/admin/knowledge/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: qText.trim(),
          currentRoute: pathname,
          selectedModule: targetModule
        })
      });

      if (!res.ok) throw new Error("Failed to process question");

      const data: GuideAnswerResponse = await res.json();

      setCurrentAnswer(data);
      try {
        sessionStorage.setItem(STORAGE_KEY_ANSWER, JSON.stringify(data));
      } catch (e) {}

      setHistory(prev => [data, ...prev.filter(h => h.id !== data.id)]);
      setQuestionInput("");
    } catch (err) {
      console.error("Guide ask error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: GuideAnswerResponse) => {
    setCurrentAnswer(item);
    try {
      sessionStorage.setItem(STORAGE_KEY_ANSWER, JSON.stringify(item));
    } catch (e) {}
    setShowHistoryModal(false);
  };

  const handleFeedback = async (msgId: string, question: string, isHelpful: boolean, reason?: string) => {
    try {
      await fetch("/api/admin/knowledge/guide/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, isHelpful, reason })
      });
      setFeedbackSubmitted(prev => ({ ...prev, [msgId]: true }));
      setShowFeedbackModal(null);
    } catch (e) {}
  };

  const handleReportGap = async (msgId: string, question: string) => {
    try {
      await fetch("/api/admin/knowledge/guide/gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, currentRoute: pathname })
      });
      setGapSubmitted(prev => ({ ...prev, [msgId]: true }));
    } catch (e) {}
  };

  // AUTO-HIDE UX RULE: Related Admin Page Link Click -> Navigate Main Page + Auto-Hide Drawer!
  const handleActionClick = (url: string, actionType: string) => {
    if (url === "#gap") return;
    if (actionType === "download" || actionType === "manual") {
      window.open(url, "_blank");
    } else {
      // Persist current answer and state as HIDDEN
      try {
        sessionStorage.setItem(STORAGE_KEY_STATE, "HIDDEN");
        if (currentAnswer) {
          sessionStorage.setItem(STORAGE_KEY_ANSWER, JSON.stringify(currentAnswer));
        }
      } catch (e) {}
      
      setDrawerState("HIDDEN");
      router.push(url);
    }
  };

  const handleCloseClick = () => {
    updateDrawerState("CLOSED");
    setCurrentAnswer(null);
    onClose();
  };

  const handleMinimizeClick = () => {
    updateDrawerState("HIDDEN");
  };

  const handleRestoreClick = () => {
    updateDrawerState("OPEN");
  };

  // Real-time suggestions
  const currentSuggestions = Object.entries(SUGGESTION_MAP).find(([key]) =>
    questionInput.toLowerCase().trim().includes(key)
  )?.[1] || [];

  return (
    <>
      {/* STATE B: HIDDEN / MINIMIZED FLOATING RESTORE TAB */}
      {drawerState === "HIDDEN" && (
        <div className="fixed right-0 top-24 z-50">
          <button
            onClick={handleRestoreClick}
            className="px-3.5 py-2.5 rounded-l-2xl bg-zinc-900 text-white font-extrabold text-xs shadow-2xl border border-r-0 border-zinc-700 hover:bg-zinc-800 transition flex items-center gap-2 cursor-pointer group"
            title="K SELECT Guide 복원하기"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="tracking-tight">K SELECT Guide</span>
            <span className="text-amber-400 font-black text-sm group-hover:-translate-x-0.5 transition-transform">‹</span>
          </button>
        </div>
      )}

      {/* STATE A: OPEN DRAWER (Non-modal overlay allowing background scroll/clicks) */}
      {drawerState === "OPEN" && (
        <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10 pointer-events-none">
          <div className="w-screen max-w-lg transform bg-white dark:bg-zinc-900 shadow-2xl transition-transform duration-300 ease-in-out border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full pointer-events-auto">

            {/* Drawer Top Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-black text-amber-400 text-xs">
                  K
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold tracking-tight text-white">K SELECT Guide</h2>
                    <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      READ ONLY
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">Internal Knowledge Assistant</p>
                </div>
              </div>

              {/* Header Controls: History | Hide (-) | Close (X) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistoryModal(!showHistoryModal)}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition flex items-center gap-1 cursor-pointer"
                  title="Session History"
                >
                  <span>📜 History</span>
                  {history.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold">
                      {history.length}
                    </span>
                  )}
                </button>

                {/* Hide / Minimize Button (-) */}
                <button
                  onClick={handleMinimizeClick}
                  className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition font-black text-sm cursor-pointer"
                  title="가이드 숨기기 (Minimize)"
                >
                  －
                </button>

                {/* Close Button (X) */}
                <button
                  onClick={handleCloseClick}
                  className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition font-black text-xs cursor-pointer"
                  title="가이드 닫기 (Close)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* STICKY TOP ASK BAR (Fixed right below Header) */}
            <div className="sticky top-0 z-10 px-5 py-3 bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-700/80 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk(questionInput);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="무엇을 찾고 계신가요? (e.g. 인사이트, 시뮬레이터)"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!questionInput.trim() || loading}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 transition shadow-2xs shrink-0 cursor-pointer"
                >
                  Ask
                </button>
              </form>

              {/* Real-time Search Suggestions */}
              {currentSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase">💡 추천 검색:</span>
                  {currentSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAsk(sug)}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 hover:border-zinc-500 transition shadow-2xs cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* HISTORY MODAL OVERLAY */}
            {showHistoryModal && (
              <div className="p-4 bg-zinc-900 text-white border-b border-zinc-800 space-y-2 text-xs shrink-0 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between font-bold border-b border-zinc-800 pb-2">
                  <span>최근 질문 기록 (Session History)</span>
                  <button onClick={() => setShowHistoryModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">✕</button>
                </div>
                {history.length === 0 ? (
                  <div className="py-3 text-zinc-500 text-center">저장된 최근 질문 기록이 없습니다.</div>
                ) : (
                  <div className="space-y-1">
                    {history.map((hItem) => (
                      <button
                        key={hItem.id}
                        onClick={() => handleSelectHistoryItem(hItem)}
                        className="w-full text-left p-2 rounded hover:bg-zinc-800 transition flex items-center justify-between text-xs text-zinc-200 cursor-pointer"
                      >
                        <span className="truncate">{hItem.question}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">선택 →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MAIN BODY AREA (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Prominent Back Button (Answer View) */}
              {currentAnswer && (
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                  <button
                    onClick={() => {
                      setCurrentAnswer(null);
                      try { sessionStorage.removeItem(STORAGE_KEY_ANSWER); } catch (e) {}
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-black text-zinc-900 dark:text-white transition flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-700 shadow-2xs cursor-pointer"
                  >
                    <span className="text-base leading-none">←</span>
                    <span>가이드 홈 (Guide Home)</span>
                  </button>
                  <span className="text-[11px] text-zinc-400 font-mono font-semibold">Current Task View</span>
                </div>
              )}

              {/* GUIDE HOME VIEW */}
              {!currentAnswer && (
                <div className="space-y-5">
                  
                  {/* Module Discovery Chips */}
                  <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>업무 영역 (Module Discovery)</span>
                      <span className="text-[10px] text-zinc-400">Select Area</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {MODULE_DISCOVERY_LIST.map((mod) => {
                        const isActive = mod.id === activeModuleId;
                        return (
                          <button
                            key={mod.id}
                            onClick={() => setActiveModuleId(mod.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 border cursor-pointer ${
                              isActive
                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                                : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                            }`}
                          >
                            <span>{mod.name}</span>
                            {mod.badge && (
                              <span className={`text-[9px] font-black px-1 rounded ${
                                isActive ? "bg-amber-400 text-zinc-950" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}>
                                {mod.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Representative Questions for Selected Module */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-700/80 pb-2">
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>📌</span>
                        <span>{activeModule.name} 대표 운영 질문</span>
                      </h3>
                      <span className="text-[10px] text-zinc-400 font-semibold">{activeModule.questions.length} Questions</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {activeModule.questions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAsk(q, activeModule.id)}
                          className="text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition shadow-2xs flex items-center justify-between group cursor-pointer"
                        >
                          <span className="group-hover:text-zinc-900 dark:group-hover:text-white">{q}</span>
                          <span className="text-zinc-400 text-xs font-bold group-hover:text-amber-500 transition">→</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* CURRENT PRIMARY ANSWER VIEW */}
              {currentAnswer && (
                <div className="space-y-4">

                  {/* 1. 질문 */}
                  <div className="p-3.5 rounded-xl bg-zinc-900 text-white space-y-1 shadow-sm">
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      질문 (Current Question)
                    </div>
                    <div className="text-xs font-bold leading-snug">
                      {currentAnswer.question}
                    </div>
                  </div>

                  {/* Answer Card Wrapper */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 shadow-xs">

                    {/* Readonly Security Enforcement Tag */}
                    {currentAnswer.isReadonlyActionAttempt && (
                      <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <span>🔒 READ-ONLY ENFORCED</span>
                      </div>
                    )}

                    {/* Live Rule Note */}
                    {currentAnswer.liveRuleNote && (
                      <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium">
                        {currentAnswer.liveRuleNote}
                      </div>
                    )}

                    {/* 2. 답변 */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1.5">
                        답변
                      </h4>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                        {currentAnswer.directAnswer}
                      </p>
                    </div>

                    {/* 3. 현재 기준 */}
                    {currentAnswer.currentRuleBullets && currentAnswer.currentRuleBullets.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          현재 기준
                        </div>
                        <ul className="space-y-1">
                          {currentAnswer.currentRuleBullets.map((b, bIdx) => (
                            <li key={bIdx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                              <span className="text-zinc-400 font-bold">•</span>
                              <span className="leading-snug">{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 4. 근거 자료 (Grounding Sources Only) */}
                    {currentAnswer.sources && currentAnswer.sources.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          근거 자료
                        </div>
                        <div className="space-y-1">
                          {currentAnswer.sources.map((src) => (
                            <button
                              key={src.id}
                              onClick={() => handleActionClick(`/admin/knowledge/${src.id}`, "knowledge")}
                              className="w-full text-left p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition flex items-center justify-between text-xs group cursor-pointer"
                            >
                              <div className="truncate font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white">
                                {src.title}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  {src.type}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                  {src.version}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. 관련 매뉴얼 */}
                    {currentAnswer.relatedManuals && currentAnswer.relatedManuals.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          관련 매뉴얼
                        </div>
                        <div className="space-y-2">
                          {currentAnswer.relatedManuals.map((man) => (
                            <div
                              key={man.id}
                              className="p-3 rounded-lg bg-amber-50/50 dark:bg-zinc-900 border border-amber-200 dark:border-zinc-700 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-xs text-zinc-900 dark:text-white">
                                  📄 {man.title}
                                </div>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  {man.version} · {man.status} · {man.audience}
                                </span>
                              </div>

                              {man.isOutdatedWarning && (
                                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                                  <span>⚠️ 이 매뉴얼은 현재 시스템 기준과 일부 내용이 다를 수 있습니다.</span>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => window.open(man.viewUrl, "_blank")}
                                  className="px-2.5 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold hover:bg-zinc-800 transition cursor-pointer"
                                >
                                  매뉴얼 보기 (PDF)
                                </button>
                                <button
                                  onClick={() => window.open(man.downloadUrl, "_blank")}
                                  className="px-2.5 py-1 rounded bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition cursor-pointer"
                                >
                                  PDF 다운로드
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. 관련 질문 */}
                    {currentAnswer.relatedQuestions && currentAnswer.relatedQuestions.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          관련 질문
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {currentAnswer.relatedQuestions.map((rq, rqIdx) => (
                            <button
                              key={rqIdx}
                              onClick={() => handleAsk(rq, activeModuleId)}
                              className="text-left px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition flex items-center justify-between cursor-pointer"
                            >
                              <span>{rq}</span>
                              <span className="text-zinc-400 font-bold text-xs">→</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 7. 관련 메뉴 (AUTO-HIDE UX: Navigates main page + Auto-Hides Drawer) */}
                    {currentAnswer.actions && currentAnswer.actions.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          관련 메뉴
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {currentAnswer.actions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              onClick={() => {
                                if (act.type === "gap") handleReportGap(currentAnswer.id, currentAnswer.question);
                                else handleActionClick(act.url, act.type);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                act.type === "gap"
                                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300"
                                  : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800"
                              }`}
                            >
                              <span>{act.label}</span>
                              <span>→</span>
                            </button>
                          ))}
                        </div>

                        {gapSubmitted[currentAnswer.id] && (
                          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                            ✓ Knowledge Gap 보고가 접수되었습니다. 관리자가 검토 후 지식을 채워넣습니다.
                          </div>
                        )}
                      </div>
                    )}

                    {/* 8. 평가 */}
                    <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>이 답변이 도움이 되었나요?</span>
                      {feedbackSubmitted[currentAnswer.id] ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ 피드백 반영 완료</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleFeedback(currentAnswer.id, currentAnswer.question, true)}
                            className="hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold cursor-pointer"
                          >
                            👍 Helpful
                          </button>
                          <button
                            onClick={() => setShowFeedbackModal(currentAnswer.id)}
                            className="hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold cursor-pointer"
                          >
                            👎 Not Helpful
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Not Helpful Modal / Reason Selection */}
                    {showFeedbackModal === currentAnswer.id && (
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs space-y-2">
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">개선이 필요한 사유를 선택해 주세요:</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {["Wrong answer", "Outdated", "Could not find info", "Unclear"].map((reason) => (
                            <button
                              key={reason}
                              onClick={() => handleFeedback(currentAnswer.id, currentAnswer.question, false, reason)}
                              className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-left hover:border-zinc-500 text-[11px] cursor-pointer"
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>승인된 K SELECT Knowledge 조망 중...</span>
                </div>
              )}

            </div>

          </div>
        </div>
      )}
    </>
  );
}
