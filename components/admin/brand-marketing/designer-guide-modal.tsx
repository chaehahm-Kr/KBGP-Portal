"use client";

import React, { useState, useMemo } from "react";
import { CampaignBrief } from "@/lib/brand-marketing/master-prompt-types";
import {
  DEFAULT_CAMPAIGN_BRIEF,
  CAMPAIGN_BRIEF_PRESETS,
  validateCampaignBrief,
  generateUniversalMasterPrompt,
} from "@/lib/brand-marketing/master-prompt-generator";
import { CampaignBriefSection } from "./campaign-brief-section";
import { MasterPromptSection } from "./master-prompt-section";
import { DeliveryRequirementsSection } from "./delivery-requirements-section";
import { ValidationChecklistSection } from "./validation-checklist-section";

interface DesignerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveSection = "brief" | "prompt" | "delivery" | "checklist";

export function DesignerGuideModal({ isOpen, onClose }: DesignerGuideModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveSection>("brief");
  const [brief, setBrief] = useState<CampaignBrief>(DEFAULT_CAMPAIGN_BRIEF);
  const [activePresetId, setActivePresetId] = useState<string>("us-wholesale-retail");

  // Track whether the user manually edited the prompt text directly
  const [isCustomPrompt, setIsCustomPrompt] = useState(false);
  const [customPromptText, setCustomPromptText] = useState("");

  const [copiedPromptQuick, setCopiedPromptQuick] = useState(false);

  const generatedPrompt = useMemo(() => {
    return generateUniversalMasterPrompt(brief);
  }, [brief]);

  const activePrompt = isCustomPrompt ? customPromptText : generatedPrompt;

  const validation = useMemo(() => {
    return validateCampaignBrief(brief);
  }, [brief]);

  if (!isOpen) return null;

  const handleBriefChange = (updated: CampaignBrief) => {
    setBrief(updated);
    // If prompt wasn't manually detached, it stays synced with generatedPrompt
  };

  const handleApplyPreset = (presetId: string) => {
    const found = CAMPAIGN_BRIEF_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setBrief(found.brief);
      setActivePresetId(presetId);
      setIsCustomPrompt(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm("캠페인 브리프를 기본값으로 되돌리시겠습니까?")) {
      setBrief(DEFAULT_CAMPAIGN_BRIEF);
      setActivePresetId("us-wholesale-retail");
      setIsCustomPrompt(false);
    }
  };

  const handlePromptChange = (updatedText: string) => {
    setIsCustomPrompt(true);
    setCustomPromptText(updatedText);
  };

  const handleResetToGenerated = () => {
    setIsCustomPrompt(false);
    setCustomPromptText("");
  };

  const handleQuickCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(activePrompt);
      setCopiedPromptQuick(true);
      setTimeout(() => setCopiedPromptQuick(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = activePrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedPromptQuick(true);
      setTimeout(() => setCopiedPromptQuick(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📖</span>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Email Design Guide & Universal Master AI Prompt
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                ADM-EMAIL-TPL-002
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              비즈니스 브리프 설정, 범용 마스터 AI 프롬프트 생성, 표준 ZIP 납품 규격 및 인박스 6단계 수신 품질 체크리스트
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 4-Section Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("brief")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "brief"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <span>📝</span>
            <span>1. Campaign Brief</span>
            {!validation.isValid && (
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("prompt")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "prompt"
                ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <span>🤖</span>
            <span>2. Master AI Prompt</span>
            {isCustomPrompt && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                수정됨
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivery")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "delivery"
                ? "border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <span>📦</span>
            <span>3. Delivery Requirements</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checklist")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "checklist"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <span>✅</span>
            <span>4. How to Use & Checklist</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/30 dark:bg-zinc-950/20">
          {activeTab === "brief" && (
            <CampaignBriefSection
              brief={brief}
              onChange={handleBriefChange}
              onApplyPreset={handleApplyPreset}
              onResetToDefault={handleResetToDefault}
              activePresetId={activePresetId}
              validation={validation}
            />
          )}

          {activeTab === "prompt" && (
            <MasterPromptSection
              prompt={activePrompt}
              onChange={handlePromptChange}
              onResetToGenerated={handleResetToGenerated}
              isCustomized={isCustomPrompt}
            />
          )}

          {activeTab === "delivery" && <DeliveryRequirementsSection />}

          {activeTab === "checklist" && <ValidationChecklistSection />}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {activeTab === "brief" && (
              <span>
                💡 브리프 수정 완료 후 <strong className="text-zinc-800 dark:text-zinc-200">&quot;2. Master AI Prompt&quot;</strong> 탭에서 프롬프트를 복사하세요.
              </span>
            )}
            {activeTab === "prompt" && (
              <span>
                💡 프롬프트를 복사하여 Claude, ChatGPT, Gemini에 붙여넣어 이메일 코드를 생성하세요.
              </span>
            )}
            {activeTab === "delivery" && (
              <span>
                💡 표준 ZIP 파일 규격은 ADM-EMAIL-TPL-001 (Agent 3) 연계 승인 후 확정됩니다.
              </span>
            )}
            {activeTab === "checklist" && (
              <span>
                💡 실제 발송 전 &quot;테스트 발송&quot; 기능을 사용하여 6단계 렌더링 체크리스트를 점검하세요.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleQuickCopyPrompt}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                copiedPromptQuick
                  ? "bg-emerald-600 text-white"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {copiedPromptQuick ? "✓ 프롬프트 복사됨!" : "📋 프롬프트 즉시 복사"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-750 cursor-pointer transition-colors"
            >
              닫기 (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
