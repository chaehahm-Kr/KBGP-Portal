"use client";

import React, { useState } from "react";
import type { AgreementTemplateItem } from "@/lib/agreement/types";

interface AdminAgreementTemplatesManagerProps {
  initialTemplates: AgreementTemplateItem[];
}

export function AdminAgreementTemplatesManager({ initialTemplates }: AdminAgreementTemplatesManagerProps) {
  const [templates] = useState<AgreementTemplateItem[]>(initialTemplates);
  const [previewPdfPath, setPreviewPdfPath] = useState<string | null>(null);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
            SYSTEM SETTINGS & LEGAL COMPLIANCE
          </span>
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
            기본계약서 템플릿 관리 (Agreement Templates)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            K SELECT NETWORK 브랜드사 공급 및 미국 유통 기본계약서의 템플릿 버전과 유통사 서명 정보 원본을 관리합니다.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            등록된 계약서 템플릿 목록 (Agreement Templates)
          </h3>
          <span className="text-xs font-mono text-zinc-400 font-semibold">
            Total: {templates.length}
          </span>
        </div>

        {templates.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            등록된 계약서 템플릿이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="p-6 space-y-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                        {tmpl.status.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-650 dark:text-indigo-400">
                        Version {tmpl.version}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-1">
                      {tmpl.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPdfPath("/agreements/template_v1.pdf")}
                      className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      📄 템플릿 원본 PDF 미리보기
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-2">
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
                    <span className="text-zinc-400 font-medium block text-[11px]">활성화 일시</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold block">
                      {tmpl.activated_at ? new Date(tmpl.activated_at).toLocaleDateString("ko-KR") : "-"}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                    <span className="text-zinc-400 font-medium block text-[11px]">템플릿 파일 경로</span>
                    <strong className="text-zinc-700 dark:text-zinc-300 font-mono text-[11px] truncate block select-all">
                      {tmpl.source_pdf_path}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewPdfPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl h-[90vh] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                계약서 템플릿 원본 PDF 미리보기 (Agreement Version 1.0)
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                  새 창 열기 ↗
                </a>
                <button
                  onClick={() => setPreviewPdfPath(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
              <iframe src={`${previewPdfPath}#toolbar=1`} className="w-full h-full border-none" title="Template PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
