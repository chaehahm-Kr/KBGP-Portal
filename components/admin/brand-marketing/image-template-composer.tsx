"use client";

import React, { useRef } from "react";
import { ImageTemplateSection } from "@/lib/brand-marketing/campaign-types";

interface ImageTemplateComposerProps {
  sections: ImageTemplateSection[];
  onChange: (sections: ImageTemplateSection[]) => void;
  defaultLandingUrl?: string;
}

export function ImageTemplateComposer({
  sections,
  onChange,
  defaultLandingUrl = "https://www.kselectnetwork.com",
}: ImageTemplateComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddSection = () => {
    const newSection: ImageTemplateSection = {
      id: "slice-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      imageUrl: "",
      altText: "",
      linkUrl: defaultLandingUrl,
      hasCtaButton: false,
      ctaButtonLabel: "파트너십 안내서 확인 →",
      ctaButtonUrl: defaultLandingUrl,
      ctaButtonAlign: "center",
    };
    onChange([...sections, newSection]);
  };

  const handleUpdateSection = (index: number, updates: Partial<ImageTemplateSection>) => {
    const updated = sections.map((sec, idx) => {
      if (idx === index) {
        return { ...sec, ...updates };
      }
      return sec;
    });
    onChange(updated);
  };

  const handleRemoveSection = (index: number) => {
    if (sections.length <= 1) {
      alert("At least one image slice is required.");
      return;
    }
    const updated = sections.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...sections];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    onChange(copy);
  };

  const handleMoveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const copy = [...sections];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    onChange(copy);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert(`File '${file.name}' is not an image (PNG, JPG, WebP supported).`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (dataUrl) {
          const sliceName = file.name.replace(/\.[^/.]+$/, "");
          const newSection: ImageTemplateSection = {
            id: "slice-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            imageUrl: dataUrl,
            altText: `K SELECT NETWORK - ${sliceName}`,
            linkUrl: defaultLandingUrl,
            hasCtaButton: false,
            ctaButtonLabel: "파트너십 제안서 확인 →",
            ctaButtonUrl: defaultLandingUrl,
            ctaButtonAlign: "center",
          };
          onChange([...sections, newSection]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-lg border border-purple-200 dark:border-purple-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-purple-900 dark:text-purple-200">
              🖼️ Image Slices Composer ({sections.length} slices)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold">
              600px Max-Width Standard
            </span>
          </div>
          <p className="text-[11px] text-purple-700 dark:text-purple-300/80 mt-0.5">
            외주 디자이너가 작업한 분할 슬라이스 이미지(PNG/JPG/WebP)를 순서대로 정렬하고 개별 클릭 링크를 지정합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-2xs flex items-center gap-1.5"
          >
            <span>📁</span>
            <span>Upload Image Files</span>
          </button>
          <button
            type="button"
            onClick={handleAddSection}
            className="px-3 py-1.5 rounded text-xs font-bold bg-white dark:bg-zinc-800 border border-purple-300 dark:border-purple-700 hover:bg-purple-50 text-purple-900 dark:text-purple-200 cursor-pointer shadow-2xs"
          >
            + Add URL Slice
          </button>
        </div>
      </div>

      {/* Safety Notice on Hotspots & Absolute Positioning */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
          <span>🛡️</span>
          <span>100% 이메일 클라이언트 호환 슬라이스 앵커 표준</span>
        </div>
        <p>
          이메일 클라이언트(Outlook, Apple Mail, Gmail)는 CSS absolute 오버레이나 HTML imagemap 태그를 지원하지 않습니다.
          K SELECT NETWORK는 각 슬라이스마다 독립된 HTML 테이블 앵커(&lt;a&gt;)를 자동 생성하여 전 세계 모든 메일함에서 깨짐 없는 완벽한 클릭 링크 이동을 보장합니다.
        </p>
      </div>

      {/* Slices List */}
      <div className="space-y-3">
        {sections.map((sec, idx) => (
          <div
            key={sec.id || idx}
            className="rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-4 space-y-3 bg-white dark:bg-zinc-950 transition-all hover:border-purple-400 dark:hover:border-purple-600"
          >
            {/* Slice Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Slice #{idx + 1} {idx === 0 ? "(Header / Hero)" : idx === sections.length - 1 ? "(Footer / CTA)" : "(Body Section)"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveUp(idx)}
                  className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Move Up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === sections.length - 1}
                  onClick={() => handleMoveDown(idx)}
                  className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Move Down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSection(idx)}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer font-bold"
                  title="Remove Slice"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Slice Content Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Preview Thumbnail */}
              <div className="md:col-span-1">
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Slice Preview
                </label>
                <div className="w-full h-32 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {sec.imageUrl ? (
                    <img
                      src={sec.imageUrl}
                      alt={sec.altText || "Slice"}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-zinc-400">No Image Asset</span>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="md:col-span-2 space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">
                    Image Asset URL * (PNG, JPG, WebP)
                  </label>
                  <input
                    type="text"
                    placeholder="https://... or data:image/..."
                    value={sec.imageUrl}
                    onChange={(e) => handleUpdateSection(idx, { imageUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">
                    Clickable Destination URL (단일 클릭 이동 URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.kselectnetwork.com"
                    value={sec.linkUrl || ""}
                    onChange={(e) => handleUpdateSection(idx, { linkUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">
                    Alternative Text (Alt Text - 접근성 및 이미지 차단 시 대체 텍스트)
                  </label>
                  <input
                    type="text"
                    placeholder="예: K SELECT NETWORK 브랜드 미국 온/오프라인 입점 안내"
                    value={sec.altText || ""}
                    onChange={(e) => handleUpdateSection(idx, { altText: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Optional CTA Button Setting */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sec.hasCtaButton || false}
                    onChange={(e) => handleUpdateSection(idx, { hasCtaButton: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>슬라이스 하단에 독립된 HTML CTA 버튼 추가 (선택사항)</span>
                </label>
              </div>

              {sec.hasCtaButton && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 text-xs">
                  <div>
                    <label className="block font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                      Button Label
                    </label>
                    <input
                      type="text"
                      placeholder="상세 제안서 보기 →"
                      value={sec.ctaButtonLabel || ""}
                      onChange={(e) => handleUpdateSection(idx, { ctaButtonLabel: e.target.value })}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                      Button URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.kselectnetwork.com"
                      value={sec.ctaButtonUrl || ""}
                      onChange={(e) => handleUpdateSection(idx, { ctaButtonUrl: e.target.value })}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                      Alignment
                    </label>
                    <select
                      value={sec.ctaButtonAlign || "center"}
                      onChange={(e) => handleUpdateSection(idx, { ctaButtonAlign: e.target.value as any })}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    >
                      <option value="center">Center (중앙 정렬)</option>
                      <option value="left">Left (좌측 정렬)</option>
                      <option value="right">Right (우측 정렬)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
