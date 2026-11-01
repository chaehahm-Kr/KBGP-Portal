"use client";

import React, { useState } from "react";

interface MasterPromptSectionProps {
  prompt: string;
  onChange: (updatedPrompt: string) => void;
  onResetToGenerated: () => void;
  isCustomized: boolean;
}

export function MasterPromptSection({
  prompt,
  onChange,
  onResetToGenerated,
  isCustomized,
}: MasterPromptSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const charCount = prompt.length;
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Top Banner & Tool Badges */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                2. 범용 마스터 AI 프롬프트 (Universal Master AI Prompt)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                AI Cross-Tool Standard
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Claude, ChatGPT, Gemini에 그대로 복사하여 붙여넣으면 600px 테이블 기반 이메일 마크업 및 메타데이터를 일관되게 생성합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isCustomized && (
              <button
                type="button"
                onClick={onResetToGenerated}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                ↺ 브리프 생성값으로 복원
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200"
              }`}
            >
              {copied ? "✓ Copied to Clipboard!" : "📋 Copy Master Prompt"}
            </button>
          </div>
        </div>

        {/* AI Tool Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">검증된 AI 도구:</span>
          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            🤖 Claude 3.5 / 3.7 Sonnet (권장)
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            💬 ChatGPT Plus (GPT-4o)
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            ✨ Gemini Advanced
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            🎨 외주 에이전시 RFP
          </span>
        </div>
      </div>

      {/* Editor Header Info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            PROMPT CONTENT (직접 수정 가능)
          </label>
          {isCustomized ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              사용자 정의 수정됨
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              브리프 자동 연동
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-400">
          <span>{charCount.toLocaleString()} 자</span>
          <span className="mx-1.5">·</span>
          <span>{wordCount.toLocaleString()} 단어</span>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          rows={16}
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-4 font-mono text-[11px] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed focus:bg-white dark:focus:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
        />
      </div>

      {/* Guidance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-lg text-xs space-y-1">
          <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
            <span>📦</span>
            <span>AI ZIP 미지원 환경 대처 (Fallback Instruction)</span>
          </div>
          <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
            AI 도구가 직접 이진 .zip 파일을 다운로드하지 못할 경우, 프롬프트에 포함된 지침에 따라 
            <code className="mx-1 px-1 bg-blue-100 dark:bg-blue-900 rounded font-mono">manifest.json</code>, 
            <code className="mx-1 px-1 bg-blue-100 dark:bg-blue-900 rounded font-mono">email.html</code>, 
            <code className="mx-1 px-1 bg-blue-100 dark:bg-blue-900 rounded font-mono">email.txt</code>
            코드 블록을 개별 출력하도록 강제합니다.
          </p>
        </div>

        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs space-y-1">
          <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>엄격한 인박스 딜리버리 규칙 내장</span>
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            프롬프트 내에 4개 공식 변수 외 임의 변수 생성 금지, Outlook Word 렌더링 엔진 조건부 주석,
            스크립트/아이프레임 0% 원칙, 플랫폼 법적 푸터와의 분리 규칙이 모두 명시되어 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
