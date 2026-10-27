"use client";

import React, { useState } from "react";
import {
  DEFAULT_IMAGE_DESIGN_PROMPT,
  DEFAULT_HTML_DESIGN_PROMPT,
  DESIGNER_GUIDE_SECTIONS,
} from "@/lib/brand-marketing/designer-guide-constants";

interface DesignerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DesignerGuideModal({ isOpen, onClose }: DesignerGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"guide" | "prompt">("guide");
  const [promptFormat, setPromptFormat] = useState<"image" | "html">("image");

  const [imagePrompt, setImagePrompt] = useState(DEFAULT_IMAGE_DESIGN_PROMPT);
  const [htmlPrompt, setHtmlPrompt] = useState(DEFAULT_HTML_DESIGN_PROMPT);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);

  if (!isOpen) return null;

  const currentPrompt = promptFormat === "image" ? imagePrompt : htmlPrompt;
  const setCurrentPrompt = promptFormat === "image" ? setImagePrompt : setHtmlPrompt;
  const defaultForFormat =
    promptFormat === "image" ? DEFAULT_IMAGE_DESIGN_PROMPT : DEFAULT_HTML_DESIGN_PROMPT;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleResetPrompt = () => {
    if (confirm("Reset prompt to original default instructions?")) {
      setCurrentPrompt(defaultForFormat);
    }
  };

  const handleCopyEntireGuide = async () => {
    try {
      const guideText = DESIGNER_GUIDE_SECTIONS.map((sec) => {
        const items = sec.items.map((it) => `  - ${it.subtitle}: ${it.description}`).join("\n");
        return `## ${sec.title}\n${items}`;
      }).join("\n\n");

      await navigator.clipboard.writeText(guideText);
      setCopiedGuide(true);
      setTimeout(() => setCopiedGuide(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📖</span>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Designer Guide & AI Prompt Library
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Phase 2 Outreach
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              외주 디자이너를 위한 이메일 캔버스 납품 가이드 및 원클릭 복사 가능한 AI 생성 프롬프트
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === "guide"
                ? "border-zinc-950 dark:border-zinc-100 text-zinc-950 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            📘 TAB A: 납품 규격 가이드 (Design Guide)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prompt")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === "prompt"
                ? "border-zinc-950 dark:border-zinc-100 text-zinc-950 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            🤖 TAB B: AI 디자인 프롬프트 (AI Prompts)
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "guide" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-850 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-750">
                <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  외주 디자이너 또는 크리에이티브 에이전시에게 전달할 표준 이메일 디자인 지침입니다.
                  아래 전체 가이드를 복사하여 작업 요청서에 첨부하세요.
                </div>
                <button
                  type="button"
                  onClick={handleCopyEntireGuide}
                  className="shrink-0 ml-4 px-3 py-1.5 rounded text-xs font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-2xs"
                >
                  {copiedGuide ? "✓ Copied!" : "📋 전체 가이드 복사"}
                </button>
              </div>

              {DESIGNER_GUIDE_SECTIONS.map((sec, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 bg-white dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {sec.title}
                    </h4>
                    {sec.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {sec.badge}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {sec.items.map((it, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          • {it.subtitle}:{" "}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {it.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "prompt" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-850 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-750">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    생성 포맷 선택:
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    프롬프트를 복사하여 Claude, ChatGPT 또는 디자이너 브리프에 붙여넣으세요.
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 p-1 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setPromptFormat("image")}
                    className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                      promptFormat === "image"
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    🖼️ 이미지 템플릿 프롬프트
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptFormat("html")}
                    className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                      promptFormat === "html"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    📄 HTML 템플릿 프롬프트
                  </button>
                </div>
              </div>

              {/* Editable Prompt Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {promptFormat === "image"
                      ? "IMAGE EMAIL DESIGN PROMPT (편집 가능)"
                      : "HTML EMAIL DESIGN PROMPT (편집 가능)"}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetPrompt}
                      className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium cursor-pointer"
                    >
                      ↺ 기본값으로 리셋
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="px-3.5 py-1.5 rounded text-xs font-bold bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {copiedPrompt ? "✓ Copied!" : "📋 Copy Prompt"}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={14}
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  className="w-full p-4 font-mono text-[11px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                />

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                  💡 <strong>Tip:</strong> 이 프롬프트는 비즈니스 과장이나 허위 지표를 요구하지 않도록 설계되었습니다.
                  생성된 이미지는 <strong>Image Template</strong>에 각 슬라이스별로 업로드하고, HTML 결과물은 <strong>HTML Template</strong>에 업로드하여 즉시 검증할 수 있습니다.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 cursor-pointer"
          >
            닫기 (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
