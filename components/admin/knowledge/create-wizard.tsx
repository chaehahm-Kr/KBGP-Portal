"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import KnowledgeNavTabs from "./knowledge-nav-tabs";

export default function CreateWizard() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<"KO" | "EN">("KO");

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    title_ko: "",
    title_en: "",
    summary_ko: "",
    summary_en: "",
    content_ko: "",
    content_en: "",
    type: "MANUAL",
    module: "General",
    audience: ["INTERNAL"], // Default Internal
    current_version: "v1.0",
    status: "PUBLISHED", // "DRAFT" | "PUBLISHED"
    document_url: "",
    document_name: "",
    document_size: 0,
    document_type: "",
    tagsInput: ""
  });

  const handleAudienceToggle = (aud: string) => {
    setFormData((prev) => {
      const current = prev.audience;
      if (current.includes(aud)) {
        const next = current.filter((a) => a !== aud);
        return { ...prev, audience: next.length > 0 ? next : ["INTERNAL"] };
      } else {
        return { ...prev, audience: [...current, aud] };
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("knowledgeId", `kno-${Date.now()}`);

      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        body
      });

      if (res.ok) {
        const json = await res.json();
        setFormData((prev) => ({
          ...prev,
          document_url: json.file_url,
          document_name: json.file_name,
          document_size: json.file_size,
          document_type: json.file_type
        }));
      } else {
        const err = await res.json();
        alert(`파일 업로드 실패: ${err.error}`);
      }
    } catch (err) {
      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryTitle = formData.title_ko || formData.title || formData.title_en;
    if (!primaryTitle.trim()) {
      alert("지식 제목(Title)을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const tags = formData.tagsInput
        ? formData.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
        : [formData.type, formData.module];

      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          title: primaryTitle,
          title_ko: formData.title_ko || primaryTitle,
          title_en: formData.title_en || primaryTitle,
          category: formData.module, // backward compatibility
          tags
        })
      });

      if (res.ok) {
        const json = await res.json();
        router.push(`/admin/knowledge/${json.item.id}`);
      } else {
        const err = await res.json();
        alert(`생성 실패: ${err.error}`);
      }
    } catch (e) {
      alert("지식 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <KnowledgeNavTabs />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/knowledge/library"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              &larr; Library
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Create New Knowledge
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            신규 매뉴얼, 정책, SOP, 가이드, FAQ를 등록하고 공식 Source of Truth로 관리합니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Identity */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            1. 기본 정보 (Basic Identity)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Knowledge Type (유형) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              >
                <option value="MANUAL">Manual (매뉴얼)</option>
                <option value="POLICY">Policy (정책/규정)</option>
                <option value="FAQ">FAQ (자주 묻는 질문)</option>
                <option value="SOP">SOP (표준 운영 절차)</option>
                <option value="GUIDE">Guide (가이드)</option>
                <option value="SYSTEM_RULE">System Rule (시스템 룰)</option>
                <option value="DEFINITION">Definition (용어 정의)</option>
              </select>
            </div>

            {/* Module */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Module (업무 모듈) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.module}
                onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              >
                <option value="General">General (공통)</option>
                <option value="Onboarding">Onboarding (입점/온보딩)</option>
                <option value="Company">Company (회사 관리)</option>
                <option value="Brand">Brand (브랜드 관리)</option>
                <option value="Products">Products (제품 관리)</option>
                <option value="Orders">Orders (주문/발주)</option>
                <option value="Purchasing">Purchasing (구매/발주서)</option>
                <option value="Finance">Finance (정산/재무)</option>
                <option value="Shipping">Shipping (배송/물류)</option>
                <option value="Support">Support (문의/CS)</option>
                <option value="Retail">Retail (리테일러/바이어)</option>
                <option value="Insights">Insights (인사이트)</option>
                <option value="Operations">Operations (운영)</option>
                <option value="Simulator">Simulator (시뮬레이터)</option>
              </select>
            </div>
          </div>

          {/* Title Korean & English */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                국문 제목 (Korean Title) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title_ko}
                onChange={(e) => setFormData({ ...formData, title_ko: e.target.value, title: e.target.value })}
                placeholder="예: K SELECT 브랜드 등록 및 관리 정책"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                영문 제목 (English Title)
              </label>
              <input
                type="text"
                value={formData.title_en}
                onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                placeholder="e.g. K SELECT Brand Registration & Management Policy"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          </div>

          {/* Summary Korean & English */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                국문 핵심 요약 (Korean Summary)
              </label>
              <textarea
                value={formData.summary_ko}
                onChange={(e) => setFormData({ ...formData, summary_ko: e.target.value })}
                rows={2}
                placeholder="지식의 핵심 내용을 1~2문장으로 요약해 주세요."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                영문 핵심 요약 (English Summary)
              </label>
              <textarea
                value={formData.summary_en}
                onChange={(e) => setFormData({ ...formData, summary_en: e.target.value })}
                rows={2}
                placeholder="Summary in English..."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Audience & Distribution */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            2. 대상 및 배포 권한 (Audience & Access)
          </h2>
          <p className="text-xs text-zinc-500">
            본 지식을 열람할 수 있는 사용자 권한 그룹을 선택합니다. (복수 선택 가능)
          </p>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.audience.includes("INTERNAL")}
                onChange={() => handleAudienceToggle("INTERNAL")}
                className="h-4 w-4 rounded border-zinc-300 text-[#131E2E] focus:ring-zinc-500"
              />
              <span>Internal / Admin (내부 어드민)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.audience.includes("BRAND")}
                onChange={() => handleAudienceToggle("BRAND")}
                className="h-4 w-4 rounded border-zinc-300 text-[#131E2E] focus:ring-zinc-500"
              />
              <span>Brand Portal (브랜드사 파트너)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.audience.includes("RETAILER")}
                onChange={() => handleAudienceToggle("RETAILER")}
                className="h-4 w-4 rounded border-zinc-300 text-[#131E2E] focus:ring-zinc-500"
              />
              <span>Retail Portal (리테일러/바이어)</span>
            </label>
          </div>
        </div>

        {/* Section 3: Structured Content (KO / EN Tabs) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              3. 본문 내용 (Structured Content)
            </h2>
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveLangTab("KO")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeLangTab === "KO"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                }`}
              >
                한국어 (KO)
              </button>
              <button
                type="button"
                onClick={() => setActiveLangTab("EN")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeLangTab === "EN"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
                }`}
              >
                English (EN)
              </button>
            </div>
          </div>

          {activeLangTab === "KO" ? (
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                한국어 본문 (Markdown 지원)
              </label>
              <textarea
                value={formData.content_ko}
                onChange={(e) => setFormData({ ...formData, content_ko: e.target.value })}
                rows={10}
                placeholder="## 1. 개요&#10;본 매뉴얼/정책의 상세 내용을 마크다운 형식으로 작성해 주세요."
                className="w-full font-mono text-xs rounded-md border border-zinc-300 bg-white p-3 text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                English Content (Markdown Supported)
              </label>
              <textarea
                value={formData.content_en}
                onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                rows={10}
                placeholder="## 1. Overview&#10;Enter detailed content in Markdown format..."
                className="w-full font-mono text-xs rounded-md border border-zinc-300 bg-white p-3 text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Section 4: Official Document Attachment (PDF / Document) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            4. 공식 배포 문서 첨부 (Official Distribution Document)
          </h2>
          <p className="text-xs text-zinc-500">
            사용자에게 제공할 최종 PDF 또는 Word 매뉴얼 문서 파일을 첨부할 수 있습니다.
          </p>

          {formData.document_name ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                <span>📄</span>
                <span>{formData.document_name}</span>
                <span className="text-[10px] text-zinc-400">({(formData.document_size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, document_url: "", document_name: "", document_size: 0, document_type: "" })}
                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
              >
                삭제
              </button>
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileUpload}
                disabled={uploadingDoc}
                className="text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#131E2E] file:text-white hover:file:bg-[#1f3047] cursor-pointer"
              />
              {uploadingDoc && <span className="text-xs text-zinc-500 ml-2">문서 업로드 중...</span>}
            </div>
          )}
        </div>

        {/* Section 5: Version & Publishing Status */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
            5. 버전 및 배포 상태 (Version & Status)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                초기 버전 (Initial Version)
              </label>
              <input
                type="text"
                value={formData.current_version}
                onChange={(e) => setFormData({ ...formData, current_version: e.target.value })}
                className="w-full font-mono rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#131E2E] focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                상태 (Status)
              </label>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="PUBLISHED"
                    checked={formData.status === "PUBLISHED"}
                    onChange={() => setFormData({ ...formData, status: "PUBLISHED" })}
                    className="h-4 w-4 border-zinc-300 text-[#131E2E] focus:ring-zinc-500"
                  />
                  <span>Published (즉시 공식 배포)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="DRAFT"
                    checked={formData.status === "DRAFT"}
                    onChange={() => setFormData({ ...formData, status: "DRAFT" })}
                    className="h-4 w-4 border-zinc-300 text-[#131E2E] focus:ring-zinc-500"
                  />
                  <span>Draft (임시 저장)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/knowledge/library"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={submitting || uploadingDoc}
            className="rounded-lg bg-[#131E2E] px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1f3047] disabled:opacity-50 dark:bg-white dark:text-[#131E2E] dark:hover:bg-zinc-100 cursor-pointer"
          >
            {submitting ? "저장 중..." : "지식 등록 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
