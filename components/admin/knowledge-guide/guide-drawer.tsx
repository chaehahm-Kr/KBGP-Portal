"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GuideAnswerResponse } from "@/lib/knowledge/types";

interface GuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_QUESTIONS = [
  "INSIGHTS Topic Score 기준은?",
  "HIGH Risk는 무엇을 확인해야 해?",
  "Automation Run에서 SKIPPED_DUPLICATE는 뭐야?",
  "Published Knowledge를 수정하려면?",
  "이 자료를 Brand에게 공개해도 돼?"
];

export default function GuideDrawer({ isOpen, onClose }: GuideDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [questionInput, setQuestionInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<GuideAnswerResponse[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const [gapSubmitted, setGapSubmitted] = useState<Record<string, boolean>>({});
  const drawerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      drawerEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, conversation]);

  if (!isOpen) return null;

  const handleAsk = async (qText: string) => {
    if (!qText.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/knowledge/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: qText.trim(),
          currentRoute: pathname
        })
      });

      if (!res.ok) throw new Error("Failed to process question");

      const data: GuideAnswerResponse = await res.json();
      setConversation(prev => [...prev, data]);
      setQuestionInput("");
    } catch (err) {
      console.error("Guide ask error:", err);
    } finally {
      setLoading(false);
    }
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

  const handleActionClick = (url: string, actionType: string) => {
    if (url === "#gap") return;
    if (actionType === "download" || actionType === "manual") {
      window.open(url, "_blank");
    } else {
      router.push(url);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md transform bg-white dark:bg-zinc-900 shadow-2xl transition-transform duration-300 ease-in-out border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-black text-amber-400 text-sm">
                K
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-white">K SELECT Guide</h2>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    READ ONLY
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Internal Knowledge Assistant</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Close Guide"
            >
              ✕
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {/* Welcome & Quick Questions (if no conversation yet) */}
            {conversation.length === 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    무엇을 찾고 계신가요?
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    K SELECT Admin 운영 기준, 정책, SOP, 매뉴얼 및 시스템 룰에 대해 질문하시면 승인된 최신 지식만을 근거로 짧고 정확하게 설명해 드립니다.
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Quick Questions
                  </div>
                  <div className="flex flex-col gap-2">
                    {QUICK_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAsk(q)}
                        className="text-left px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition shadow-xs flex items-center justify-between"
                      >
                        <span>{q}</span>
                        <span className="text-zinc-400 text-sm">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Log */}
            {conversation.map((msg) => (
              <div key={msg.id} className="space-y-3 pt-2">

                {/* Question bubble */}
                <div className="flex justify-end">
                  <div className="bg-zinc-900 text-white text-xs px-3.5 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%] font-medium shadow-xs">
                    {msg.question}
                  </div>
                </div>

                {/* Answer Box */}
                <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3.5 shadow-xs">

                  {/* Readonly Alert Tag */}
                  {msg.isReadonlyActionAttempt && (
                    <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <span>🔒 READ-ONLY ENFORCED</span>
                    </div>
                  )}

                  {/* Live Rule Note */}
                  {msg.liveRuleNote && (
                    <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium">
                      {msg.liveRuleNote}
                    </div>
                  )}

                  {/* Direct Answer */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1">
                      Direct Answer
                    </h4>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                      {msg.directAnswer}
                    </p>
                  </div>

                  {/* Rule Bullets */}
                  {msg.currentRuleBullets && msg.currentRuleBullets.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                      <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        Current Rule Summary
                      </div>
                      <ul className="space-y-1">
                        {msg.currentRuleBullets.map((b, bIdx) => (
                          <li key={bIdx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                            <span className="text-zinc-400 font-bold">•</span>
                            <span className="leading-snug">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Sources Citation */}
                  {msg.sources.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                      <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        Sources & Citations
                      </div>
                      <div className="space-y-1">
                        {msg.sources.map((src) => (
                          <button
                            key={src.id}
                            onClick={() => router.push(`/admin/knowledge/${src.id}`)}
                            className="w-full text-left p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition flex items-center justify-between text-xs group"
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

                  {/* Actions / Links */}
                  {msg.actions.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                      <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        Actions & Navigation Links
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => {
                              if (act.type === "gap") handleReportGap(msg.id, msg.question);
                              else handleActionClick(act.url, act.type);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              act.type === "download" || act.type === "manual"
                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                : act.type === "gap"
                                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300"
                                : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800"
                            }`}
                          >
                            <span>{act.label}</span>
                            <span>→</span>
                          </button>
                        ))}
                      </div>

                      {gapSubmitted[msg.id] && (
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                          ✓ Knowledge Gap 보고가 접수되었습니다. 관리자가 검토 후 지식을 채워넣습니다.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback Controls */}
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>이 답변이 도움이 되었나요?</span>
                    {feedbackSubmitted[msg.id] ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ 피드백 반영 완료</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFeedback(msg.id, msg.question, true)}
                          className="hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700"
                        >
                          👍 Helpful
                        </button>
                        <button
                          onClick={() => setShowFeedbackModal(msg.id)}
                          className="hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700"
                        >
                          👎 Not Helpful
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Not Helpful Modal / Reason Selection */}
                  {showFeedbackModal === msg.id && (
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs space-y-2">
                      <div className="font-bold text-zinc-800 dark:text-zinc-200">개선이 필요한 사유를 선택해 주세요:</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {["Wrong answer", "Outdated", "Could not find info", "Unclear"].map((reason) => (
                          <button
                            key={reason}
                            onClick={() => handleFeedback(msg.id, msg.question, false, reason)}
                            className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-left hover:border-zinc-500 text-[11px]"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>승인된 K SELECT Knowledge 조망 중...</span>
              </div>
            )}

            <div ref={drawerEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk(questionInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Ask K SELECT Guide..."
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={!questionInput.trim() || loading}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 transition"
              >
                Ask
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
