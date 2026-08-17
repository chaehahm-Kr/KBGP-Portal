"use client";

import React, { useState } from "react";

interface ReaderFeedbackProps {
  articleId: string;
  channel?: "NETWORK" | "HUB";
}

export function ReaderFeedback({ articleId, channel = "NETWORK" }: ReaderFeedbackProps) {
  const [submitted, setSubmitted] = useState(false);
  const [feedbackChoice, setFeedbackChoice] = useState<"HELPFUL" | "NOT_HELPFUL" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendFeedback = async (choice: "HELPFUL" | "NOT_HELPFUL") => {
    if (submitted || isSubmitting) return;
    setIsSubmitting(true);
    setFeedbackChoice(choice);

    try {
      const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3010";
      const res = await fetch(`${portalUrl}/api/insights/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_id: articleId,
          channel,
          feedback: choice,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Failed to send feedback:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full my-8 p-6 rounded-2xl border border-hairline bg-paper/60 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h4 className="text-sm font-bold text-graphite">이 인사이트 가이드가 도움이 되었나요?</h4>
        <p className="text-xs text-slate mt-0.5">
          독자 피드백은 K SELECT Insights 연구 데스크의 콘텐츠 품질 향상에 직접 활용됩니다.
        </p>
      </div>

      {submitted ? (
        <div className="text-xs font-bold text-accent bg-accent/10 px-4 py-2 rounded-lg">
          ✓ 피드백을 전달해주셔서 감사합니다! ({feedbackChoice === "HELPFUL" ? "도움됨" : "아쉬움"})
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleSendFeedback("HELPFUL")}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-hairline bg-white hover:bg-zinc-50 active:scale-95 text-xs font-bold text-graphite shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            👍 도움이 됨 (Helpful)
          </button>
          <button
            onClick={() => handleSendFeedback("NOT_HELPFUL")}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-hairline bg-white hover:bg-zinc-50 active:scale-95 text-xs font-bold text-slate shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            👎 아쉬움 (Not Helpful)
          </button>
        </div>
      )}
    </div>
  );
}
