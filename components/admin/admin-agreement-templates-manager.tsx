"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import type { AgreementTemplateItem, AgreementType, CompanyAgreementItem } from "@/lib/agreement/types";
import {
  adminListAgreementTemplatesAction,
  adminUploadAgreementTemplateAction,
  adminSetAgreementTemplateActiveAction,
  adminGetTemplatePdfUrlAction,
  adminGetTemplateUsageCompaniesAction,
  adminDeleteAgreementTemplateAction,
  getSignedExecutedPdfUrlAction,
} from "@/lib/agreement/actions";
import { stageLargeFiles } from "@/lib/files/stage-form-files";

interface AdminAgreementTemplatesManagerProps {
  initialTemplates: AgreementTemplateItem[];
}

export function AdminAgreementTemplatesManager({ initialTemplates }: AdminAgreementTemplatesManagerProps) {
  const [templates, setTemplates] = useState<AgreementTemplateItem[]>(initialTemplates);
  const [activeTab, setActiveTab] = useState<"ALL" | AgreementType>("ALL");
  const [isPending, startTransition] = useTransition();

  // Preview & Download Modal State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<AgreementType>("BRAND_SUPPLIER");
  const [uploadName, setUploadName] = useState(
    "Brand Supply, U.S. Distribution & Platform Agreement (Non-Exclusive)"
  );
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadSetActive, setUploadSetActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Usage Modal State
  const [usageModalTmpl, setUsageModalTmpl] = useState<AgreementTemplateItem | null>(null);
  const [usageAgreements, setUsageAgreements] = useState<CompanyAgreementItem[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Delete Modal State
  const [deleteConfirmTmpl, setDeleteConfirmTmpl] = useState<AgreementTemplateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status & General Action Error/Loading State
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Refresh template list based on selected filter
  const refreshTemplates = (typeFilter: "ALL" | AgreementType = activeTab) => {
    startTransition(async () => {
      const res = await adminListAgreementTemplatesAction(typeFilter);
      if (res.templates) {
        setTemplates(res.templates);
      }
    });
  };

  const handleTabChange = (tab: "ALL" | AgreementType) => {
    setActiveTab(tab);
    refreshTemplates(tab);
  };

  // Type selection handler in upload modal
  const handleTypeChange = (type: AgreementType) => {
    setUploadType(type);
    if (type === "BRAND_SUPPLIER") {
      setUploadName("Brand Supply, U.S. Distribution & Platform Agreement (Non-Exclusive)");
    } else {
      setUploadName("Retailer Distribution & Platform Agreement");
    }
  };

  // Preview PDF handler
  const handlePreviewPdf = async (tmpl: AgreementTemplateItem) => {
    setLoadingPdfId(tmpl.id);
    setActionError(null);
    try {
      const res = await adminGetTemplatePdfUrlAction(tmpl.id);
      if (res.url) {
        setPreviewTitle(`${tmpl.name} (v${tmpl.version})`);
        setPreviewPdfUrl(res.url);
      } else {
        setActionError(res.error || "PDF Preview URL을 불러오지 못했습니다.");
      }
    } catch (err: any) {
      setActionError(err?.message || "PDF Preview 중 오류가 발생했습니다.");
    } finally {
      setLoadingPdfId(null);
    }
  };

  // Download PDF handler
  const handleDownloadPdf = async (tmpl: AgreementTemplateItem) => {
    setLoadingPdfId(tmpl.id);
    setActionError(null);
    try {
      const filename = `${tmpl.agreement_type || "AGREEMENT"}_template_v${tmpl.version}.pdf`;
      const res = await adminGetTemplatePdfUrlAction(tmpl.id, filename);
      if (res.url) {
        const link = document.createElement("a");
        link.href = res.url;
        link.download = filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setActionError(res.error || "PDF 다운로드 URL을 불러오지 못했습니다.");
      }
    } catch (err: any) {
      setActionError(err?.message || "PDF 다운로드 중 오류가 발생했습니다.");
    } finally {
      setLoadingPdfId(null);
    }
  };

  // View Executed PDF for a company agreement in usage modal
  const handleViewExecutedPdf = async (ca: CompanyAgreementItem) => {
    setActionError(null);
    try {
      const res = await getSignedExecutedPdfUrlAction(ca.id);
      if (res.url) {
        setPreviewTitle(`체결 완료 계약서 PDF (${ca.agreement_id} - ${ca.companyName})`);
        setPreviewPdfUrl(res.url);
      } else {
        setActionError(res.error || "체결 완료 PDF URL을 생성할 수 없습니다.");
      }
    } catch (err: any) {
      setActionError(err?.message || "PDF 보기 중 오류가 발생했습니다.");
    }
  };

  // Set Active handler
  const handleSetActive = async (tmpl: AgreementTemplateItem) => {
    const typeLabel = tmpl.agreement_type === "RETAILER" ? "리테일러" : "브랜드 공급사";
    const confirmed = window.confirm(
      `버전 ${tmpl.version} 템플릿을 [${typeLabel}] 전용 Active 템플릿으로 활성화하시겠습니까?\n기존 active 템플릿은 inactive로 변경됩니다.`
    );
    if (!confirmed) return;

    setActivatingId(tmpl.id);
    setActionError(null);
    try {
      const res = await adminSetAgreementTemplateActiveAction(tmpl.id);
      if (res.success) {
        refreshTemplates(activeTab);
      } else {
        setActionError(res.error || "Active 설정에 실패했습니다.");
      }
    } catch (err: any) {
      setActionError(err?.message || "Active 설정 중 오류가 발생했습니다.");
    } finally {
      setActivatingId(null);
    }
  };

  // Handle View Usage Companies
  const handleViewUsage = async (tmpl: AgreementTemplateItem) => {
    setActionError(null);
    setUsageModalTmpl(tmpl);
    setIsLoadingUsage(true);
    setUsageAgreements([]);
    try {
      const res = await adminGetTemplateUsageCompaniesAction(tmpl.id);
      if (res.agreements) {
        setUsageAgreements(res.agreements);
      } else if (res.error) {
        setActionError(res.error);
      }
    } catch (err: any) {
      setActionError(err?.message || "사용 회사 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingUsage(false);
    }
  };

  // Handle Safe Delete Click
  const handleDeleteClick = (tmpl: AgreementTemplateItem) => {
    setActionError(null);

    // Rule 6: Active template cannot be deleted
    if (tmpl.status === "active") {
      setActionError("Active 템플릿은 삭제할 수 없습니다. 먼저 다른 버전을 Active로 설정하거나 이 템플릿을 비활성화해 주세요.");
      return;
    }

    // Rule 5: Used template cannot be deleted
    if ((tmpl.usage?.companyCount ?? 0) > 0) {
      setActionError("이 템플릿은 현재 또는 과거 계약에 사용되어 삭제할 수 없습니다. Inactive 상태로 보관해 주세요.");
      return;
    }

    // Truly unused and Inactive -> Open Delete Confirmation Modal
    setDeleteConfirmTmpl(tmpl);
  };

  // Execute Safe Delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTmpl) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const res = await adminDeleteAgreementTemplateAction(deleteConfirmTmpl.id);
      if (res.success) {
        setDeleteConfirmTmpl(null);
        refreshTemplates(activeTab);
      } else {
        setActionError(res.error || "템플릿 삭제에 실패했습니다.");
      }
    } catch (err: any) {
      setActionError(err?.message || "템플릿 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Upload Form handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!uploadName.trim()) {
      setUploadError("템플릿 명칭을 입력해 주세요.");
      return;
    }
    if (!uploadVersion.trim()) {
      setUploadError("버전을 입력해 주세요 (예: 1.1).");
      return;
    }
    if (!selectedFile) {
      setUploadError("PDF 파일(template PDF)을 선택해 주세요.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("agreement_type", uploadType);
      formData.append("name", uploadName.trim());
      formData.append("version", uploadVersion.trim());
      formData.append("notes", uploadNotes.trim());
      formData.append("setActive", uploadSetActive ? "true" : "false");
      formData.append("pdfFile", selectedFile);

      const res = await adminUploadAgreementTemplateAction(await stageLargeFiles(formData));
      if (res.success) {
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadVersion("");
        setUploadNotes("");
        refreshTemplates(activeTab);
      } else {
        setUploadError(res.error || "템플릿 업로드 실패");
      }
    } catch (err: any) {
      setUploadError(err?.message || "템플릿 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
            SYSTEM SETTINGS & LEGAL COMPLIANCE
          </span>
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
            기본계약서 템플릿 관리 (Agreement Templates)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            K SELECT NETWORK 브랜드 공급사 및 리테일러 입점/유통 기본계약서 템플릿 버전과 사용 현황 추적, 안전 삭제를 관리합니다.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <span>+</span> 템플릿 신규 업로드
          </button>
        </div>
      </div>

      {/* Global Action Error Alert */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => handleTabChange("ALL")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "ALL"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            전체 ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("BRAND_SUPPLIER")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "BRAND_SUPPLIER"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            브랜드 공급사 (Brand)
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("RETAILER")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "RETAILER"
                ? "bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            리테일러 (Retailer)
          </button>
        </div>

        {isPending && (
          <span className="text-xs font-medium text-zinc-400 animate-pulse">
            목록 동기화 중...
          </span>
        )}
      </div>

      {/* Template List Container */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            등록된 계약서 템플릿 목록 (Agreement Templates)
          </h3>
          <span className="text-xs font-mono text-zinc-400 font-semibold">
            Count: {templates.length}
          </span>
        </div>

        {templates.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              등록된 계약서 템플릿이 없습니다.
            </p>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              새 템플릿 업로드하기 ↗
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
            {templates.map((tmpl) => {
              const isRetailer = tmpl.agreement_type === "RETAILER";
              const isActive = tmpl.status === "active";
              const companyCount = tmpl.usage?.companyCount ?? 0;
              const pendingCount = tmpl.usage?.pendingCount ?? 0;
              const executedCount = tmpl.usage?.executedCount ?? 0;

              return (
                <div
                  key={tmpl.id}
                  className="p-6 space-y-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Agreement Type Badge */}
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${
                            isRetailer
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                          }`}
                        >
                          {isRetailer ? "리테일러 (Retailer)" : "브랜드 공급사 (Brand)"}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-extrabold border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                          }`}
                        >
                          {isActive ? "ACTIVE (사용 중)" : "INACTIVE (보관됨)"}
                        </span>

                        <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">
                          Version {tmpl.version}
                        </span>
                      </div>

                      <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-1">
                        {tmpl.name}
                      </h4>
                      {tmpl.notes && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          📝 {tmpl.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewPdf(tmpl)}
                        disabled={loadingPdfId === tmpl.id}
                        className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-3.5 py-1.5 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loadingPdfId === tmpl.id ? "로딩..." : "📄 PDF 미리보기"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(tmpl)}
                        disabled={loadingPdfId === tmpl.id}
                        className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-3.5 py-1.5 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        📥 다운로드
                      </button>

                      <button
                        type="button"
                        onClick={() => handleViewUsage(tmpl)}
                        className="rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors cursor-pointer"
                      >
                        👥 사용 회사 보기 ({companyCount})
                      </button>

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSetActive(tmpl)}
                          disabled={activatingId === tmpl.id}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {activatingId === tmpl.id ? "처리 중..." : "✨ Active로 설정"}
                        </button>
                      )}

                      {!isActive && companyCount === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(tmpl)}
                          className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                        >
                          🗑️ 삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details Grid & Usage Summary Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs pt-2">
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-150 dark:border-indigo-900/50 flex flex-col justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400 font-bold block text-[11px]">
                        템플릿 사용 현황 (Usage)
                      </span>
                      <div className="mt-1">
                        <strong className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 block">
                          사용 회사 {companyCount}개
                        </strong>
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold block mt-0.5">
                          서명 대기 {pendingCount} / 체결 완료 {executedCount}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                      <span className="text-zinc-400 font-medium block text-[11px]">Letusto 서명권자</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold block">
                        {tmpl.letusto_signer_name} ({tmpl.letusto_signer_title})
                      </strong>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">{tmpl.letusto_company_name}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                      <span className="text-zinc-400 font-medium block text-[11px]">계약 기간 및 갱신 조건</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold block">
                        최초 {tmpl.initial_term_years}년 (연장 {tmpl.renewal_term_years}년 단위)
                      </strong>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-0.5">
                        갱신 거절 통지: 만료 {tmpl.non_renewal_notice_days}일 전
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                      <span className="text-zinc-400 font-medium block text-[11px]">등록 / 활성화 일시</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold block">
                        {tmpl.activated_at
                          ? new Date(tmpl.activated_at).toLocaleDateString("ko-KR")
                          : new Date(tmpl.created_at).toLocaleDateString("ko-KR")}
                      </strong>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">
                        등록자: {tmpl.created_by || "System"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                      <span className="text-zinc-400 font-medium block text-[11px]">템플릿 파일 경로</span>
                      <strong className="text-zinc-700 dark:text-zinc-300 font-mono text-[11px] truncate block select-all">
                        {tmpl.source_pdf_path}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl h-[90vh] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate pr-4">
                계약서 PDF 미리보기 — {previewTitle}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                  새 창 열기 ↗
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
              <iframe src={`${previewPdfUrl}#toolbar=1`} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}

      {/* View Usage Companies Modal */}
      {usageModalTmpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  템플릿 사용 회사 목록 (Linked Agreements)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  템플릿: <span className="font-bold text-zinc-800 dark:text-zinc-200">{usageModalTmpl.name}</span> (v{usageModalTmpl.version}) | 유형: {usageModalTmpl.agreement_type === "RETAILER" ? "리테일러" : "브랜드 공급사"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUsageModalTmpl(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[250px]">
              {isLoadingUsage ? (
                <div className="p-12 text-center text-xs text-zinc-400 animate-pulse font-medium">
                  사용 회사 목록 불러오는 중...
                </div>
              ) : usageAgreements.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  이 템플릿을 연동하거나 사용 중인 회사가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-bold">
                        <th className="p-3">회사명</th>
                        <th className="p-3">계약 ID</th>
                        <th className="p-3">상태</th>
                        <th className="p-3">서명자</th>
                        <th className="p-3">체결 일시</th>
                        <th className="p-3 text-right">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 font-medium">
                      {usageAgreements.map((ca) => (
                        <tr key={ca.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50">
                          <td className="p-3 font-bold text-zinc-900 dark:text-white">
                            {ca.companyName || "-"}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            {ca.agreement_id}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                ca.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              }`}
                            >
                              {ca.status === "active" ? "계약 완료" : "서명 필요"}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-700 dark:text-zinc-300">
                            {ca.signer_name ? `${ca.signer_name} (${ca.signer_title || "-"})` : "-"}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-zinc-500">
                            {ca.signed_at ? new Date(ca.signed_at).toLocaleDateString("ko-KR") : "-"}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <Link
                              href={`/admin/companies/${ca.company_id}`}
                              target="_blank"
                              className="inline-flex items-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-300"
                            >
                              🏢 회사 보기 ↗
                            </Link>

                            {ca.status === "active" && (
                              <button
                                type="button"
                                onClick={() => handleViewExecutedPdf(ca)}
                                className="inline-flex items-center rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                              >
                                📄 체결 PDF
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteConfirmTmpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/60 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                ⚠️ 템플릿 삭제 확인 (Delete Template)
              </h3>
              <button
                type="button"
                onClick={() => setDeleteConfirmTmpl(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 space-y-2">
              <p className="font-bold text-sm">
                아래 미사용 템플릿을 정말로 영구 삭제하시겠습니까?
              </p>
              <div className="space-y-1 text-zinc-700 dark:text-zinc-300 font-medium">
                <div>• <strong>계약 유형:</strong> {deleteConfirmTmpl.agreement_type === "RETAILER" ? "리테일러 (Retailer)" : "브랜드 공급사 (Brand)"}</div>
                <div>• <strong>템플릿 명칭:</strong> {deleteConfirmTmpl.name}</div>
                <div>• <strong>버전:</strong> {deleteConfirmTmpl.version}</div>
                <div>• <strong>파일 경로:</strong> <code className="font-mono text-[11px]">{deleteConfirmTmpl.source_pdf_path}</code></div>
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold pt-1">
                이 작업은 되돌릴 수 없으며 DB 기록과 스토리지 원본 PDF 파일이 함께 삭제됩니다.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmTmpl(null)}
                className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "삭제 중..." : "영구 삭제 실행"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Template Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                계약서 템플릿 신규 업로드
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                ⚠️ {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Agreement Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  계약서 유형 (Agreement Type) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("BRAND_SUPPLIER")}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                      uploadType === "BRAND_SUPPLIER"
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-extrabold">브랜드 공급사 계약</div>
                    <div className="text-[10px] opacity-75 font-normal">Brand Supplier Agreement</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange("RETAILER")}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                      uploadType === "RETAILER"
                        ? "border-purple-600 bg-purple-50/50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-extrabold">리테일러 입점 계약</div>
                    <div className="text-[10px] opacity-75 font-normal">Retailer Agreement</div>
                  </button>
                </div>
              </div>

              {/* Template Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  템플릿 명칭 (Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="예: Retailer Distribution & Platform Agreement"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Version */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  템플릿 버전 (Version) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  placeholder="예: 1.1 또는 2.0"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* PDF File Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  템플릿 PDF 파일 (.pdf) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300 cursor-pointer"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  변경 / 등록 사유 메모 (Notes)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                  placeholder="템플릿 변경사항이나 등록 목적을 적어주세요."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Set Active Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="setActiveCheck"
                  checked={uploadSetActive}
                  onChange={(e) => setUploadSetActive(e.target.checked)}
                  className="h-4 w-4 rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="setActiveCheck" className="text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  업로드 완료 후 해당 계약 유형({uploadType === "BRAND_SUPPLIER" ? "브랜드 공급사" : "리테일러"})의 Active 템플릿으로 설정
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? "업로드 중..." : "템플릿 업로드 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
