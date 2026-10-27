"use client";

import React, { useState, useEffect } from "react";
import {
  MarketingFooterSettings,
  DEFAULT_MARKETING_FOOTER,
  buildMarketingFooterHtml,
  validateMarketingFooterCompleteness,
} from "@/lib/brand-marketing/marketing-footer";
import {
  getMarketingFooterSettingsAction,
  saveMarketingFooterSettingsAction,
} from "@/lib/brand-marketing/campaign-actions";

export function MarketingFooterSettingsView() {
  const [settings, setSettings] = useState<MarketingFooterSettings>({ ...DEFAULT_MARKETING_FOOTER });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewLang, setPreviewLang] = useState<"ko" | "en">("ko");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await getMarketingFooterSettingsAction();
      if (res.success && res.settings) {
        setSettings(res.settings);
        setPreviewLang(res.settings.defaultLanguage || "ko");
      }
    } catch (err: any) {
      console.warn("Failed to load footer settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    const validation = validateMarketingFooterCompleteness(settings);
    if (!validation.isValid) {
      setNotification({
        type: "error",
        message: `필수 입력 항목이 누락되었습니다: ${validation.missingFields.join(", ")}`,
      });
      setIsSaving(false);
      return;
    }

    try {
      const res = await saveMarketingFooterSettingsAction(settings);
      if (res.success && res.settings) {
        setSettings(res.settings);
        setNotification({
          type: "success",
          message: "중앙 마케팅 이메일 푸터 설정이 성공적으로 저장되었습니다. 이후 발송되는 모든 마케팅 캠페인에 자동 적용됩니다.",
        });
      } else {
        setNotification({ type: "error", message: res.error || "푸터 설정 저장에 실패했습니다." });
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Compile live footer preview markup
  const previewHtml = buildMarketingFooterHtml(settings, {
    language: previewLang,
    unsubscribeUrl: "https://admin.kselectnetwork.com/unsubscribe?token=sample-preview-token",
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500">
        중앙 마케팅 푸터 설정을 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Centralized Marketing Email Footer Settings
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                Brand Marketing Exclusive
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              모든 브랜드 마케팅 캠페인 이메일(HTML 및 IMAGE 템플릿 공통)의 하단에 자동으로 결합되는 법적 공시, 사업장 주소, 공식 문의처 및 수신거부 푸터를 중앙에서 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-white bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 rounded hover:bg-zinc-800 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
          >
            {isSaving ? "Saving Settings..." : "Save Footer Settings ✓"}
          </button>
        </div>

        {notification && (
          <div
            className={`mt-4 p-3 rounded text-xs font-medium ${
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200"
                : "bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200"
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Settings Form */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">
            Legal &amp; Sender Information
          </h3>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Brand Display Name *
                </label>
                <input
                  type="text"
                  value={settings.brandDisplayName}
                  onChange={(e) => setSettings({ ...settings, brandDisplayName: e.target.value })}
                  placeholder="K SELECT NETWORK"
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Legal Operating Company *
                </label>
                <input
                  type="text"
                  value={settings.legalCompanyName}
                  onChange={(e) => setSettings({ ...settings, legalCompanyName: e.target.value })}
                  placeholder="Operated by Letusto Inc."
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Physical Mailing Address (사업장 소재지 물리적 주소) *
              </label>
              <input
                type="text"
                value={settings.physicalAddress}
                onChange={(e) => setSettings({ ...settings, physicalAddress: e.target.value })}
                placeholder="23B Roland Ave., Mount Laurel, NJ 08054, USA"
                className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                * CAN-SPAM 및 이메일 규정에 따라 유효한 물리적 우편 수신 주소가 필수 표기됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Official Contact Email *
                </label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  placeholder="Contact@letusto.com"
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Official Website
                </label>
                <input
                  type="url"
                  value={settings.contactWebsite || ""}
                  onChange={(e) => setSettings({ ...settings, contactWebsite: e.target.value })}
                  placeholder="https://www.kselectnetwork.com"
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Disclosure Text (한국어 안내문) *
                </label>
                <textarea
                  rows={2}
                  value={settings.disclosureKo}
                  onChange={(e) => setSettings({ ...settings, disclosureKo: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Disclosure Text (English Global) *
                </label>
                <textarea
                  rows={2}
                  value={settings.disclosureEn}
                  onChange={(e) => setSettings({ ...settings, disclosureEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 leading-relaxed"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Default Language Mode
              </label>
              <select
                value={settings.defaultLanguage}
                onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="ko">한국어 (Korean)</option>
                <option value="en">English (글로벌)</option>
              </select>
            </div>
          </form>
        </div>

        {/* Right: Live Interactive Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Live Footer Preview
                </h3>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {previewViewport === "desktop" ? "600px Max-Width" : "375px Mobile"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Switch */}
                <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => setPreviewLang("ko")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      previewLang === "ko"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    KO
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("en")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      previewLang === "en"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    EN
                  </button>
                </div>

                {/* Viewport Switch */}
                <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("desktop")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      previewViewport === "desktop"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Desktop (600px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("mobile")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      previewViewport === "mobile"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Mobile (375px)
                  </button>
                </div>
              </div>
            </div>

            {/* Email Container Mock */}
            <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg flex justify-center overflow-x-auto min-h-[300px]">
              <div
                style={{
                  width: previewViewport === "desktop" ? "600px" : "375px",
                  maxWidth: "100%",
                  transition: "width 0.2s ease-in-out",
                }}
                className="bg-white rounded shadow-xs border border-zinc-200 overflow-hidden flex flex-col justify-end"
              >
                {/* Simulated Email Body Content Placeholder */}
                <div className="p-6 text-center space-y-2 border-b border-dashed border-zinc-200">
                  <div className="text-xs font-bold text-zinc-400">
                    [Email Template Body Content Area]
                  </div>
                  <p className="text-[11px] text-zinc-400 italic">
                    수신자별 본문 및 제안 내용이 위에 렌더링되며, 아래의 중앙 푸터가 모든 마케팅 이메일 끝에 자동으로 결합됩니다.
                  </p>
                </div>

                {/* Live Rendered Marketing Footer */}
                <div
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  className="w-full"
                />
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1 bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded border border-zinc-200 dark:border-zinc-800">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                자동 푸터 결합 규칙:
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10px]">
                <li>수신자별 암호화된 고유 토큰이 생성되어 <strong>수신거부 링크가 실제 동작</strong>합니다.</li>
                <li>이미 푸터가 포함된 외부 HTML을 가져오는 경우, 중복 결합 없이 기존 푸터를 안전하게 감지하여 단일 푸터로 유지합니다.</li>
                <li>승인된 캠페인은 승인 당시의 푸터 스냅샷을 영구 보존하며, 이후 푸터 수정 시 승인 재검증이 요구됩니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
