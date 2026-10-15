"use client";

import React from "react";
import type { QuizQuestionItem } from "@/lib/training/training-types";

interface TrainingQuizEditorProps {
  questions: QuizQuestionItem[];
  onChange: (updated: QuizQuestionItem[]) => void;
  disabled?: boolean;
  highlightedTarget?: {
    fieldTarget: string;
    reason?: string;
    severity?: "blocking" | "warning";
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  benefits: "Product Benefits (핵심 효능)",
  customer_fit: "Customer Fit (추천 고객)",
  usage_selling: "Usage & Selling (사용법/상담)",
  objection: "Customer Objection (고객 의문 해소)",
  precaution: "Precaution (주의사항)",
};

export function TrainingQuizEditor({
  questions,
  onChange,
  disabled = false,
  highlightedTarget = null,
}: TrainingQuizEditorProps) {
  const isTarget = (id: string) => highlightedTarget?.fieldTarget === id;
  const getHighlightClass = (id: string) =>
    isTarget(id)
      ? "ring-2 ring-rose-500 border-rose-500 dark:border-rose-500 shadow-md animate-pulse"
      : "";

  const renderNotice = (id: string) => {
    if (!isTarget(id) || !highlightedTarget?.reason) return null;
    return (
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium animate-in fade-in mt-1">
        <span className="font-bold">⚠️ Quiz Issue:</span>
        <span>{highlightedTarget.reason}</span>
      </div>
    );
  };
  const handleQuestionTextChange = (index: number, text: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], question: text };
    onChange(updated);
  };

  const handleOptionChange = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    const newOptions = [...updated[qIndex].options] as [string, string, string];
    newOptions[optIndex] = text;
    updated[qIndex] = { ...updated[qIndex], options: newOptions };
    onChange(updated);
  };

  const handleCorrectOptionChange = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], correctIndex: optIndex };
    onChange(updated);
  };

  const handleExplanationChange = (index: number, text: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], explanation: text };
    onChange(updated);
  };

  const handleCategoryChange = (index: number, cat: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], category: cat };
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === questions.length - 1) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onChange(updated);
  };

  const handleAddQuestion = () => {
    if (questions.length >= 5) return;
    const newQ: QuizQuestionItem = {
      id: `q_${Date.now()}`,
      category: questions.length === 3 ? "objection" : "precaution",
      question: "",
      options: ["", "", ""],
      correctIndex: 0,
      explanation: "",
    };
    onChange([...questions, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 3) return; // Keep minimum 3
    const updated = questions.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🎯</span>
          <div>
            <div className="text-xs font-black text-purple-950 dark:text-purple-200">
              3-Question Staff Understanding Assessment
            </div>
            <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
              Pass policy: 3/3 correct answers required to verify training. Educational explanations guide retries.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400">
            {questions.length} Questions (Min: 3, Max: 5)
          </span>
          {questions.length < 5 && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleAddQuestion}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition-colors"
            >
              + Add Optional Question
            </button>
          )}
        </div>
      </div>

      {/* Question Cards */}
      <div className="space-y-5">
        {questions.map((q, qIdx) => (
          <div
            key={q.id || qIdx}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs"
          >
            {/* Question Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                  Q{qIdx + 1}
                </span>
                <select
                  disabled={disabled}
                  value={q.category}
                  onChange={(e) => handleCategoryChange(qIdx, e.target.value)}
                  className="text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="benefits">{CATEGORY_LABELS.benefits}</option>
                  <option value="customer_fit">{CATEGORY_LABELS.customer_fit}</option>
                  <option value="usage_selling">{CATEGORY_LABELS.usage_selling}</option>
                  <option value="objection">{CATEGORY_LABELS.objection}</option>
                  <option value="precaution">{CATEGORY_LABELS.precaution}</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  disabled={disabled || qIdx === 0}
                  onClick={() => handleMoveUp(qIdx)}
                  className="px-2 py-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                  title="Move question up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={disabled || qIdx === questions.length - 1}
                  onClick={() => handleMoveDown(qIdx)}
                  className="px-2 py-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                  title="Move question down"
                >
                  ▼
                </button>
                {questions.length > 3 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="ml-2 px-2 py-1 rounded text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Remove question"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block uppercase">
                Question Prompt:
              </label>
              <input
                id={`field-quiz-${qIdx}-question`}
                type="text"
                disabled={disabled}
                value={q.question}
                onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                placeholder="Enter clear, staff-relevant question..."
                className={`w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${getHighlightClass(
                  `field-quiz-${qIdx}-question`
                )}`}
              />
              {renderNotice(`field-quiz-${qIdx}-question`)}
            </div>

            {/* 3 Answer Options */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block uppercase">
                3 Answer Options (Select radio to set the correct answer):
              </label>
              <div className="space-y-2">
                {q.options.map((opt, optIdx) => {
                  const isCorrect = q.correctIndex === optIdx;
                  return (
                    <div key={optIdx} className="space-y-1">
                      <div
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                          isCorrect
                            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                            : "bg-zinc-50/60 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700"
                        } ${getHighlightClass(`field-quiz-${qIdx}-opt-${optIdx}`)}`}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleCorrectOptionChange(qIdx, optIdx)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer ${
                            isCorrect
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "border border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:border-emerald-500"
                          }`}
                          title={isCorrect ? "Correct answer" : "Click to set as correct answer"}
                        >
                          {isCorrect ? "✓" : String.fromCharCode(65 + optIdx)}
                        </button>

                        <input
                          id={`field-quiz-${qIdx}-opt-${optIdx}`}
                          type="text"
                          disabled={disabled}
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)}...`}
                          className="flex-1 text-xs bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        />

                        {isCorrect && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-emerald-600 text-white shrink-0">
                            Correct Answer
                          </span>
                        )}
                      </div>
                      {renderNotice(`field-quiz-${qIdx}-opt-${optIdx}`)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Educational Explanation */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block uppercase flex items-center gap-1.5">
                <span>💡</span> Educational Feedback & Explanation (Shown on Answer Review / Retries):
              </label>
              <textarea
                id={`field-quiz-${qIdx}-explanation`}
                rows={2}
                disabled={disabled}
                value={q.explanation}
                onChange={(e) => handleExplanationChange(qIdx, e.target.value)}
                placeholder="Explain why this answer is correct and provide practical retail context..."
                className={`w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${getHighlightClass(
                  `field-quiz-${qIdx}-explanation`
                )}`}
              />
              {renderNotice(`field-quiz-${qIdx}-explanation`)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
