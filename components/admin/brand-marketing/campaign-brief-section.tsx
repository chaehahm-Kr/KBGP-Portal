"use client";

import React, { useState } from "react";
import {
  CampaignBrief,
  BriefValidationResult,
} from "@/lib/brand-marketing/master-prompt-types";
import {
  CAMPAIGN_BRIEF_PRESETS,
} from "@/lib/brand-marketing/master-prompt-generator";

interface CampaignBriefSectionProps {
  brief: CampaignBrief;
  onChange: (updated: CampaignBrief) => void;
  onApplyPreset: (presetId: string) => void;
  onResetToDefault: () => void;
  activePresetId?: string;
  validation: BriefValidationResult;
}

export function CampaignBriefSection({
  brief,
  onChange,
  onApplyPreset,
  onResetToDefault,
  activePresetId,
  validation,
}: CampaignBriefSectionProps) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const updateField = <K extends keyof CampaignBrief>(key: K, value: CampaignBrief[K]) => {
    onChange({
      ...brief,
      [key]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Intro & Preset Bar */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                1. 캠페인 비즈니스 브리프 설정
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                6대 핵심 항목
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              목표, 타깃, 핵심 가치, 필수 내용, 디자인 톤앤매너, 메인 CTA를 입력하면 마스터 AI 프롬프트에 실시간 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetToDefault}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium self-start sm:self-center cursor-pointer transition-colors"
          >
            ↺ 기본값으로 리셋
          </button>
        </div>

        {/* Preset Selector */}
        <div className="mt-3">
          <div className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            💡 추천 비즈니스 프리셋 (클릭 시 자동 입력):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CAMPAIGN_BRIEF_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset.id)}
                  className={`text-left p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span className="truncate">{preset.title.split("(")[0].trim()}</span>
                    {isSelected && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold">
                        ✓ 적용됨
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Validation Feedback */}
      {!validation.isValid && Object.keys(validation.errors).length > 0 && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-300 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>⚠️</span> 필수 항목이 입력되지 않았습니다 ({Object.keys(validation.errors).length}건):
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {Object.values(validation.errors).map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.isValid && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="font-semibold">
              모든 6대 필수 비즈니스 항목이 유효하게 입력되었습니다. 마스터 AI 프롬프트가 동기화되었습니다.
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded">
            VALID
          </span>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <div className="font-bold flex items-center gap-1">
            <span>💡</span> 작성 팁 (Prompt Optimization):
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {validation.warnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Six Primary Business Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Field 1: Objective */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>1. 캠페인 비즈니스 목표 (Campaign Objective) <span className="text-rose-500">*</span></span>
            <span className="text-[10px] text-zinc-400 font-normal">파트너십 제안 목적 및 달성하고자 하는 전환</span>
          </label>
          <textarea
            rows={2}
            value={brief.campaignObjective}
            onChange={(e) => updateField("campaignObjective", e.target.value)}
            placeholder="예: 미국 50개 주 오프라인 리테일 네트워크 도매 납품 제안 및 신규 브랜드 유치"
            className={`w-full p-3 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
              validation.errors.campaignObjective
                ? "border-rose-400 dark:border-rose-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {validation.errors.campaignObjective && (
            <p className="text-[11px] text-rose-500">{validation.errors.campaignObjective}</p>
          )}
        </div>

        {/* Field 2: Target Audience */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>2. 타깃 오디언스 (Target Audience) <span className="text-rose-500">*</span></span>
            <span className="text-[10px] text-zinc-400 font-normal">수신 의사결정권자</span>
          </label>
          <input
            type="text"
            value={brief.targetAudience}
            onChange={(e) => updateField("targetAudience", e.target.value)}
            placeholder="예: 한국 뷰티 브랜드 대표이사, 해외 영업 총괄, 글로벌 마케팅 디렉터"
            className={`w-full p-2.5 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
              validation.errors.targetAudience
                ? "border-rose-400 dark:border-rose-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {validation.errors.targetAudience && (
            <p className="text-[11px] text-rose-500">{validation.errors.targetAudience}</p>
          )}
        </div>

        {/* Field 3: Core Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>3. 핵심 제안 메시지 (Core Message) <span className="text-rose-500">*</span></span>
            <span className="text-[10px] text-zinc-400 font-normal">헤드라인 및 가치 제안</span>
          </label>
          <input
            type="text"
            value={brief.coreMessage}
            onChange={(e) => updateField("coreMessage", e.target.value)}
            placeholder="예: 현지 재고/통관 리스크 없이 미국 메이저 오프라인 매장에 안정적으로 도매 공급"
            className={`w-full p-2.5 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
              validation.errors.coreMessage
                ? "border-rose-400 dark:border-rose-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {validation.errors.coreMessage && (
            <p className="text-[11px] text-rose-500">{validation.errors.coreMessage}</p>
          )}
        </div>

        {/* Field 4: Required Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>4. 필수 포함 내용 (Required Content) <span className="text-rose-500">*</span></span>
            <span className="text-[10px] text-zinc-400 font-normal">본문에 들어갈 섹션/목록</span>
          </label>
          <textarea
            rows={3}
            value={brief.requiredContent}
            onChange={(e) => updateField("requiredContent", e.target.value)}
            placeholder="1) K SELECT 오프라인 커버리지, 2) 물류/반품 보호망, 3) 바이어 위클리 대시보드, 4) 입점 신청 안내"
            className={`w-full p-3 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
              validation.errors.requiredContent
                ? "border-rose-400 dark:border-rose-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {validation.errors.requiredContent && (
            <p className="text-[11px] text-rose-500">{validation.errors.requiredContent}</p>
          )}
        </div>

        {/* Field 5: Design Direction */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>5. 비주얼 디자인 방향성 (Design Direction) <span className="text-rose-500">*</span></span>
            <span className="text-[10px] text-zinc-400 font-normal">룩앤필 및 레이아웃 무드</span>
          </label>
          <textarea
            rows={3}
            value={brief.designDirection}
            onChange={(e) => updateField("designDirection", e.target.value)}
            placeholder="전문적이고 신뢰감 있는 프리미엄 B2B 코퍼레이트 디자인, 다크 네이비와 로즈골드 액센트, 카드형 분할"
            className={`w-full p-3 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
              validation.errors.designDirection
                ? "border-rose-400 dark:border-rose-600"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {validation.errors.designDirection && (
            <p className="text-[11px] text-rose-500">{validation.errors.designDirection}</p>
          )}
        </div>

        {/* Field 6: Primary CTA */}
        <div className="space-y-1.5 md:col-span-2 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 rounded-lg border border-blue-100 dark:border-blue-900/50">
          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span>6. 주요 행동 유도 버튼 (Primary CTA) <span className="text-rose-500">*</span></span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">이메일 내 가장 중요한 클릭 전환</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
            <div>
              <span className="text-[10px] text-zinc-500 font-medium">버튼 라벨 (Button Text)</span>
              <input
                type="text"
                value={brief.primaryCtaText}
                onChange={(e) => updateField("primaryCtaText", e.target.value)}
                placeholder="예: 파트너십 입점 신청하기 (Apply for Partnership)"
                className={`w-full p-2 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
                  validation.errors.primaryCtaText
                    ? "border-rose-400 dark:border-rose-600"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              />
              {validation.errors.primaryCtaText && (
                <p className="text-[11px] text-rose-500">{validation.errors.primaryCtaText}</p>
              )}
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-medium">이동 URL (Landing Page URL)</span>
              <input
                type="url"
                value={brief.primaryCtaUrl || ""}
                onChange={(e) => updateField("primaryCtaUrl", e.target.value)}
                placeholder="https://www.kselectnetwork.com/apply"
                className={`w-full p-2 text-xs rounded-lg border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors ${
                  validation.errors.primaryCtaUrl
                    ? "border-rose-400 dark:border-rose-600"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              />
              {validation.errors.primaryCtaUrl && (
                <p className="text-[11px] text-rose-500">{validation.errors.primaryCtaUrl}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Optional Fields */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOptionalFields(!showOptionalFields)}
          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>⚙️</span>
            <span>추가 상세 옵션 설정 (선택 사항: 언어, 포맷, 브랜드 컬러, 보조 CTA 등)</span>
          </span>
          <span className="text-zinc-400">{showOptionalFields ? "▲ 접기" : "▼ 펼치기"}</span>
        </button>

        {showOptionalFields && (
          <div className="p-4 space-y-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Campaign Title */}
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  캠페인 제목 (Internal Title)
                </label>
                <input
                  type="text"
                  value={brief.campaignTitle || ""}
                  onChange={(e) => updateField("campaignTitle", e.target.value)}
                  placeholder="예: 2026 K SELECT 미국 뷰티 유통 네트워크 파트너십 제안"
                  className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Language */}
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  선호 언어 (Preferred Language)
                </label>
                <select
                  value={brief.preferredLanguage}
                  onChange={(e) => updateField("preferredLanguage", e.target.value as any)}
                  className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="ko">한국어 (Korean B2B)</option>
                  <option value="en">English (US B2B Executive)</option>
                  <option value="bilingual">이중 언어 병기 (Bilingual KO + EN)</option>
                </select>
              </div>

              {/* Design Format */}
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  디자인 포맷 (Design Format)
                </label>
                <select
                  value={brief.designFormat}
                  onChange={(e) => updateField("designFormat", e.target.value as any)}
                  className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="responsive-html">표준 반응형 HTML (Responsive HTML)</option>
                  <option value="image-led-html">이미지 슬라이스 중심 HTML (Image-Led HTML)</option>
                </select>
              </div>

              {/* Brand Colors */}
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  브랜드 컬러 및 팔레트 (Brand Colors)
                </label>
                <input
                  type="text"
                  value={brief.brandColors || ""}
                  onChange={(e) => updateField("brandColors", e.target.value)}
                  placeholder="예: #0F172A (Navy), #F43F5E (Rose Accent), #FFFFFF"
                  className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Secondary CTA */}
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-850 p-3 rounded-lg border border-zinc-200 dark:border-zinc-750">
                <div>
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                    보조 CTA 버튼 라벨 (Secondary CTA Label)
                  </span>
                  <input
                    type="text"
                    value={brief.secondaryCtaText || ""}
                    onChange={(e) => updateField("secondaryCtaText", e.target.value)}
                    placeholder="예: 파트너십 소개서 다운로드 (Download Deck)"
                    className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                    보조 CTA URL (Secondary CTA URL)
                  </span>
                  <input
                    type="url"
                    value={brief.secondaryCtaUrl || ""}
                    onChange={(e) => updateField("secondaryCtaUrl", e.target.value)}
                    placeholder="https://www.kselectnetwork.com/deck"
                    className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Additional Instructions */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                  추가 디자이너 / AI 유의사항 (Additional Instructions)
                </label>
                <textarea
                  rows={2}
                  value={brief.additionalInstructions || ""}
                  onChange={(e) => updateField("additionalInstructions", e.target.value)}
                  placeholder="모바일 뷰포트에서 가독성 확보, 헤더 로고 크기 180px 제한 등 추가 요청 사항"
                  className="w-full p-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
