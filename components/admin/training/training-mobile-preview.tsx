"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { TrainingModuleData, GroundedTrainingContext } from "@/lib/training/training-types";

interface TrainingMobilePreviewProps {
  module: TrainingModuleData;
  context: GroundedTrainingContext;
}

export function TrainingMobilePreview({ module, context }: TrainingMobilePreviewProps) {
  const [activeTab, setActiveTab] = useState<"learn" | "quiz">("learn");

  // Quiz interactive simulation state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setSubmitted(false);
  };

  const allAnswered = module.quizQuestions.every((_, idx) => selectedAnswers[idx] !== undefined);
  const correctCount = module.quizQuestions.filter((q, idx) => selectedAnswers[idx] === q.correctIndex).length;
  const isPassed = submitted && correctCount === module.quizQuestions.length;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Smartphone Frame Container */}
      <div className="w-[375px] max-w-full rounded-[44px] border-[10px] border-zinc-900 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col h-[740px]">
        {/* Phone Notch & Status Bar Mockup */}
        <div className="bg-zinc-900 text-white text-[11px] font-mono px-6 py-2 flex items-center justify-between select-none">
          <span>9:41</span>
          <div className="w-20 h-4 bg-zinc-800 rounded-full mx-auto" />
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Top App Header */}
        <div className="bg-zinc-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xs">←</span>
            <span className="text-xs font-black tracking-tight">K SELECT HUB</span>
          </div>
          <span className="text-[10px] font-bold bg-indigo-600 px-2 py-0.5 rounded-full uppercase">
            Staff Training
          </span>
        </div>

        {/* View Mode Switcher: Study Guide vs Quiz */}
        <div className="bg-zinc-100 dark:bg-zinc-900 p-1 flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("learn")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === "learn"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            📖 1. Study Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === "quiz"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            🎯 2. Quiz ({module.quizQuestions.length} Qs)
          </button>
        </div>

        {/* Scrollable Smartphone Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-zinc-900 dark:text-zinc-100 text-xs">
          {activeTab === "learn" ? (
            <>
              {/* Product Hero Snapshot */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-2xl shrink-0 overflow-hidden relative">
                    {context.primaryImageUrl ? (
                      <img
                        src={context.primaryImageUrl}
                        alt={context.productName}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <span>🧴</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      {context.brandName}
                    </span>
                    <h4 className="text-xs font-black text-zinc-900 dark:text-white leading-snug">
                      {context.productName}
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      SKU: {context.sku} · {context.volume || "Standard Size"}
                    </span>
                  </div>
                </div>

                {/* 1. Overview */}
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium space-y-2">
                  <p>{module.productOverview || "No overview provided."}</p>
                  {context.infographicUrl && (
                    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={context.infographicUrl}
                        alt="Product Infographic"
                        className="w-full h-auto object-cover max-h-48"
                      />
                      <div className="px-2 py-1 text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700">
                        📊 Product Infographic
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Top 3 Benefits Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-white dark:bg-zinc-900 space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <span>✨</span> Top 3 Benefits
                </span>

                {context.benefitGraphicUrl && (
                  <div className="rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30">
                    <img
                      src={context.benefitGraphicUrl}
                      alt="Benefit Graphic"
                      className="w-full h-auto object-cover max-h-48"
                    />
                    <div className="px-2 py-1 text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-t border-indigo-100 dark:border-indigo-900/60">
                      ✨ Approved Benefit Graphic
                    </div>
                  </div>
                )}

                <ul className="space-y-1.5">
                  {module.top3Benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                      <span className="text-indigo-500 font-bold shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3. Best For Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50 dark:bg-zinc-900 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <span>🎯</span> Best For / Target Customer
                </span>

                {context.lifestyleImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white">
                    <img
                      src={context.lifestyleImageUrl}
                      alt="Lifestyle Image"
                      className="w-full h-auto object-cover max-h-48"
                    />
                    <div className="px-2 py-1 text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700">
                      📸 In-Context Lifestyle
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                  {module.bestFor}
                </p>
              </div>

              {/* 4. How To Use Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-white dark:bg-zinc-900 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>🧴</span> How to Use
                </span>

                {context.howToGraphicUrl && (
                  <div className="rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30">
                    <img
                      src={context.howToGraphicUrl}
                      alt="How-To Graphic"
                      className="w-full h-auto object-cover max-h-48"
                    />
                    <div className="px-2 py-1 text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-t border-emerald-100 dark:border-emerald-900/60">
                      🧴 Application Steps
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {module.howToUse}
                </p>
              </div>

              {/* 5. 15-Second Pitch & Selling Points */}
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 p-3.5 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <span>🗣️</span> 15-Second Counter Pitch
                </span>
                <p className="text-[11px] text-amber-950 dark:text-amber-100 font-bold leading-relaxed italic">
                  &ldquo;{module.pitch15s}&rdquo;
                </p>

                {module.sellingPoints.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-1">
                    <span className="text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300">
                      Quick Selling Points:
                    </span>
                    {module.sellingPoints.map((sp, idx) => (
                      <div key={idx} className="text-[10px] text-zinc-700 dark:text-zinc-300 flex items-start gap-1">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{sp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. Customer Objections */}
              {module.customerObjections.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-white dark:bg-zinc-900 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <span>💬</span> Customer Questions & Answers
                  </span>
                  <div className="space-y-2">
                    {module.customerObjections.map((o, idx) => (
                      <div key={o.id || idx} className="text-[10px] space-y-0.5">
                        <div className="font-bold text-zinc-900 dark:text-white">Q: {o.objection}</div>
                        <div className="text-zinc-600 dark:text-zinc-400">A: {o.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. Storage SOP */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50 dark:bg-zinc-900 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <span>⚠️</span> Storage & Precautions
                </span>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {module.storageHandlingSop}
                </p>
              </div>

              {/* Future-Ready Video Banner */}
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 text-center space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1">
                  <span>🎬</span> Product & How-To Video
                </span>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Short video training modules are currently in production and will appear here upon official release.
                </p>
              </div>

              {/* Action Button to switch to Quiz */}
              <button
                type="button"
                onClick={() => setActiveTab("quiz")}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>Take Staff Quiz ({module.quizQuestions.length} Qs)</span>
                <span>→</span>
              </button>
            </>
          ) : (
            /* QUIZ SIMULATION TAB */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-black">Staff Assessment Simulation</span>
                {submitted && (
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Reset Quiz
                  </button>
                )}
              </div>

              {isPassed ? (
                /* Congratulatory Completion State */
                <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white text-xl font-bold flex items-center justify-center mx-auto shadow-md">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      Training Completed!
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                      100% Score ({correctCount}/{module.quizQuestions.length}) — You are verified and ready to recommend {context.productName} to retail customers!
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Questions List */}
              <div className="space-y-4">
                {module.quizQuestions.map((q, qIdx) => {
                  const selected = selectedAnswers[qIdx];
                  const isAnswered = selected !== undefined;
                  const isCorrect = submitted && selected === q.correctIndex;
                  const isWrong = submitted && isAnswered && selected !== q.correctIndex;

                  return (
                    <div
                      key={q.id || qIdx}
                      className={`p-3 rounded-2xl border space-y-2 transition-all ${
                        isCorrect
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                          : isWrong
                          ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
                        <span>QUESTION {qIdx + 1} OF {module.quizQuestions.length}</span>
                        {submitted && (
                          <span className={isCorrect ? "text-emerald-600" : "text-rose-600"}>
                            {isCorrect ? "✓ Correct" : "✕ Incorrect"}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-zinc-900 dark:text-white leading-snug">
                        {q.question}
                      </p>

                      {/* Options */}
                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt, optIdx) => {
                          const isOptionSelected = selected === optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(qIdx, optIdx)}
                              className={`w-full text-left p-2 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
                                isOptionSelected
                                  ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold"
                                  : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-[10px] shrink-0 font-bold">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="leading-tight">{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Feedback Card */}
                      {submitted && (
                        <div
                          className={`p-2.5 rounded-xl border text-[10px] space-y-1 ${
                            isCorrect
                              ? "bg-emerald-100/50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200"
                              : "bg-rose-100/50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-200"
                          }`}
                        >
                          <span className="font-bold block">
                            {isCorrect ? "✓ Explanation:" : "💡 Review Tip:"}
                          </span>
                          <p className="leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit / Retry Actions */}
              {!isPassed && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!allAnswered}
                    onClick={() => setSubmitted(true)}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    {submitted ? "Re-evaluate Answers" : "Submit Quiz Answers"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phone Bottom Home Bar Mockup */}
        <div className="bg-white dark:bg-zinc-950 py-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-center">
          <div className="w-32 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>
      </div>
    </div>
  );
}
