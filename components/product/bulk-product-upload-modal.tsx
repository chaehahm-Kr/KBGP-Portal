"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  downloadBulkProductTemplateAction,
  executeBulkProductImportAction,
  validateBulkProductExcelAction,
} from "@/lib/product/bulk-import-actions";
import {
  BULK_IMPORT_MAX_ROWS,
  type BulkImportExecutionResult,
  type BulkPreviewResult,
  type BulkValidatedRow,
} from "@/lib/product/bulk-import-types";

interface BulkProductUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (createdCount: number) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;
type PreviewFilter = "ALL" | "VALID" | "WARNING" | "INVALID";

const STEP_DEFINITIONS: { step: WizardStep; title: string; shortTitle: string }[] = [
  { step: 1, title: "STEP 1: Download Excel Template", shortTitle: "1. Template" },
  { step: 2, title: "STEP 2: Upload Completed Excel", shortTitle: "2. Upload" },
  { step: 3, title: "STEP 3: Validate & Preview", shortTitle: "3. Preview" },
  { step: 4, title: "STEP 4: Confirm Draft Registration", shortTitle: "4. Confirm" },
  { step: 5, title: "STEP 5: Import Results", shortTitle: "5. Results" },
];

function triggerBase64XlsxDownload(base64: string, fileName: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function BulkProductUploadModal({
  isOpen,
  onClose,
  onImportSuccess,
}: BulkProductUploadModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<WizardStep>(1);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [previewResult, setPreviewResult] = useState<BulkPreviewResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("ALL");

  const [submissionKey, setSubmissionKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportExecutionResult | null>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetModalState = () => {
    setStep(1);
    setIsDownloadingTemplate(false);
    setTemplateDownloaded(false);
    setSelectedFile(null);
    setIsDragging(false);
    setIsValidating(false);
    setPreviewResult(null);
    setPreviewFilter("ALL");
    setSubmissionKey("");
    setIsSubmitting(false);
    setImportResult(null);
    setErrorBanner(null);
  };

  const handleClose = () => {
    if (isValidating || isSubmitting) return;
    if (importResult && importResult.createdCount > 0) {
      router.refresh();
    }
    resetModalState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setErrorBanner(null);
    setIsDownloadingTemplate(true);
    try {
      const res = await downloadBulkProductTemplateAction();
      if (!res.success || !res.base64 || !res.fileName) {
        setErrorBanner(res.error || "Failed to download Excel template.");
        return;
      }
      triggerBase64XlsxDownload(res.base64, res.fileName);
      setTemplateDownloaded(true);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to generate Excel template.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const acceptFileSelection = (file: File | null | undefined) => {
    setErrorBanner(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setSelectedFile(null);
      setErrorBanner("Unsupported file format. Please upload an .xlsx Excel file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setErrorBanner("File size exceeds 10 MB limit.");
      return;
    }
    setSelectedFile(file);
  };

  const handleValidateFile = async () => {
    if (!selectedFile) {
      setErrorBanner("Please select an .xlsx file first.");
      return;
    }
    setErrorBanner(null);
    setIsValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await validateBulkProductExcelAction(formData);
      if (!res.success || !res.summary || !res.rows) {
        setErrorBanner(res.error || "Failed to validate the uploaded Excel file.");
        return;
      }
      setPreviewResult(res);
      setPreviewFilter("ALL");
      setSubmissionKey(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      setStep(3);
    } catch (err: any) {
      setErrorBanner(err?.message || "Unexpected error while validating Excel file.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !previewResult?.summary || isSubmitting) return;
    if (previewResult.summary.importableRows === 0) return;

    setErrorBanner(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("submissionKey", submissionKey);

      const res = await executeBulkProductImportAction(formData);
      if (!res.success) {
        setErrorBanner(res.error || "Bulk product registration failed.");
        return;
      }
      setImportResult(res);
      setStep(5);
      if (res.createdCount > 0) {
        router.refresh();
        onImportSuccess?.(res.createdCount);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || "Unexpected error during Draft creation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPreviewRows: BulkValidatedRow[] = (previewResult?.rows ?? []).filter((r) => {
    if (previewFilter === "ALL") return true;
    return r.status === previewFilter;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>📊 Excel Bulk Product Registration</span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Draft Workflow · Max {BULK_IMPORT_MAX_ROWS} Rows
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Register multiple Draft products quickly with 4 required fields and optional specifications.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isValidating || isSubmitting}
            aria-label="Close bulk upload modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 5-Step Progress Bar */}
        <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {STEP_DEFINITIONS.map((item, idx) => {
              const isCurrent = step === item.step;
              const isCompleted = step > item.step;
              return (
                <React.Fragment key={item.step}>
                  <div
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      isCurrent
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                        : isCompleted
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    <span>{isCompleted ? "✓" : ""}</span>
                    <span>{item.title}</span>
                  </div>
                  {idx < STEP_DEFINITIONS.length - 1 && (
                    <span className="text-zinc-300 dark:text-zinc-700 text-xs">›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorBanner && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 flex items-start justify-between gap-3">
              <span>⚠️ {errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-500 hover:text-rose-700 font-bold shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* STEP 1: DOWNLOAD EXCEL TEMPLATE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      STEP 1: Download Official Excel Template (.xlsx)
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Includes your company&apos;s active Brands, live 3-Depth Categories, Countries, Allowed Values, and an example row.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isDownloadingTemplate}
                    className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer shadow-xs"
                  >
                    {isDownloadingTemplate
                      ? "Generating .xlsx..."
                      : "⬇ Download Excel Template (.xlsx)"}
                  </button>
                </div>

                {templateDownloaded && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    ✓ Template downloaded. Fill in the <strong>&quot;Products&quot;</strong> sheet and proceed to Step 2.
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border border-zinc-200 p-3.5 dark:border-zinc-800 space-y-1.5">
                  <div className="font-bold text-zinc-900 dark:text-white">
                    Minimum Required Columns (Only 4)
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
                    <li>• <strong>Brand *</strong> — Active brand registered to your company</li>
                    <li>• <strong>Manufacturer SKU *</strong> — Unique SKU code (A-Z, 0-9, -, _)</li>
                    <li>• <strong>Product Name EN *</strong> — Official English product name</li>
                    <li>• <strong>Category 1Depth *</strong> — Top-level category (e.g., Skincare)</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-zinc-200 p-3.5 dark:border-zinc-800 space-y-1.5">
                  <div className="font-bold text-zinc-900 dark:text-white">
                    Optional Data & Draft Behavior
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
                    <li>• Supports 2Depth/3Depth Categories, Barcodes (UPC/EAN), Pricing, and Logistics.</li>
                    <li>• Keep SKU, UPC (12 digits), and EAN (13 digits) as <strong>Text</strong> to preserve leading zeros.</li>
                    <li>• Imported products remain <strong>Draft (보완 대기)</strong> until images &amp; category attributes are completed.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD COMPLETED EXCEL */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  STEP 2: Upload Completed Excel (.xlsx)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Upload your completed <code className="font-mono">.xlsx</code> file (up to {BULK_IMPORT_MAX_ROWS} product rows). Every row will be validated on the server before creation.
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  acceptFileSelection(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-zinc-900 bg-zinc-100/70 dark:border-white dark:bg-zinc-800/40"
                    : "border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    acceptFileSelection(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="text-2xl mb-2">📄</div>
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Click or drop another .xlsx file to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Click to choose an .xlsx file or drag and drop here
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Only .xlsx format supported · Maximum {BULK_IMPORT_MAX_ROWS} rows · Max 10 MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: VALIDATE & PREVIEW */}
          {step === 3 && previewResult?.summary && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    STEP 3: Validation &amp; Preview — <span className="font-mono font-normal text-zinc-500">{previewResult.fileName}</span>
                  </h3>
                  {previewResult.summary.exampleRowsSkipped > 0 && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      ℹ️ Template sample row (<code className="font-mono">EXAMPLE-SKU-001</code>) was automatically skipped.
                    </p>
                  )}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Total Product Rows</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {previewResult.summary.totalRows}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Valid Rows</div>
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {previewResult.summary.validRows}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">Warning Rows</div>
                  <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                    {previewResult.summary.warningRows}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <div className="text-[11px] text-rose-700 dark:text-rose-400">Invalid Rows (Rejected)</div>
                  <div className="text-lg font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">
                    {previewResult.summary.invalidRows}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: `All (${previewResult.summary.totalRows})` },
                    { id: "VALID", label: `Valid (${previewResult.summary.validRows})` },
                    { id: "WARNING", label: `Warnings (${previewResult.summary.warningRows})` },
                    { id: "INVALID", label: `Invalid (${previewResult.summary.invalidRows})` },
                  ] as { id: PreviewFilter; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewFilter(tab.id)}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                      previewFilter === tab.id
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Compact Preview Table */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-3 py-2 w-16">Row #</th>
                      <th className="px-3 py-2 w-24">Status</th>
                      <th className="px-3 py-2 w-28">Brand</th>
                      <th className="px-3 py-2 w-36">Manufacturer SKU</th>
                      <th className="px-3 py-2 w-48">Product Name EN</th>
                      <th className="px-3 py-2 w-36">Category</th>
                      <th className="px-3 py-2">Validation Details / Error Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredPreviewRows.map((row) => (
                      <tr
                        key={row.excelRowNumber}
                        className={
                          row.status === "INVALID"
                            ? "bg-rose-50/30 dark:bg-rose-950/10"
                            : row.status === "WARNING"
                            ? "bg-amber-50/30 dark:bg-amber-950/10"
                            : ""
                        }
                      >
                        <td className="px-3 py-2 font-mono font-bold text-zinc-600 dark:text-zinc-400">
                          #{row.excelRowNumber}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "VALID" && (
                            <span className="inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Valid
                            </span>
                          )}
                          {row.status === "WARNING" && (
                            <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Warning
                            </span>
                          )}
                          {row.status === "INVALID" && (
                            <span className="inline-flex rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              Invalid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[120px] text-zinc-800 dark:text-zinc-200">
                          {row.rawBrand || <span className="text-rose-500">(Missing)</span>}
                        </td>
                        <td className="px-3 py-2 font-mono truncate max-w-[150px] text-zinc-800 dark:text-zinc-200">
                          {row.rawManufactureSku || <span className="text-rose-500">(Missing)</span>}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[200px] text-zinc-800 dark:text-zinc-200">
                          {row.rawProductNameEn || <span className="text-rose-500">(Missing)</span>}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[160px] text-zinc-600 dark:text-zinc-400">
                          {row.normalizedCategoryPath || row.rawCategory1Depth || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "INVALID" ? (
                            <div className="space-y-0.5 text-rose-700 dark:text-rose-400">
                              {row.errors.map((err, i) => (
                                <div key={i}>• {err}</div>
                              ))}
                            </div>
                          ) : row.status === "WARNING" ? (
                            <div className="space-y-0.5 text-amber-700 dark:text-amber-400">
                              {row.warnings.map((w, i) => (
                                <div key={i}>• {w}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Ready for Draft creation
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRM DRAFT REGISTRATION */}
          {step === 4 && previewResult?.summary && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  STEP 4: Confirm Draft Batch Registration
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Review the batch summary below before creating Draft product records.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white p-3 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">Drafts to Create</div>
                    <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {previewResult.summary.importableRows}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      ({previewResult.summary.validRows} valid + {previewResult.summary.warningRows} normalized)
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">Invalid Rows Skipped</div>
                    <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                      {previewResult.summary.invalidRows}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Downloadable error report in Step 5
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">Initial Status</div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-1">
                      Draft (보완 대기)
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      UNREVIEWED · Hidden from Retailer Hub
                    </div>
                  </div>
                </div>

                <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 pt-1">
                  <li>• Every row is re-validated server-side against your company&apos;s active brands and existing SKUs before insertion.</li>
                  <li>• Existing SKUs are never overwritten or modified.</li>
                  <li>• After import, click any product on the Product List to upload images, complete category attributes, or edit fields.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 5: IMPORT RESULTS */}
          {step === 5 && importResult && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    STEP 5: Bulk Import Results
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {importResult.createdCount > 0
                      ? `${importResult.createdCount} Draft product(s) have been added to your Product List.`
                      : "No products were created from this upload."}
                  </p>
                </div>

                {importResult.rejectedCount > 0 && importResult.errorReportBase64 && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerBase64XlsxDownload(
                        importResult.errorReportBase64!,
                        importResult.errorReportFilename || "KSN_Bulk_Import_Errors.xlsx"
                      )
                    }
                    className="shrink-0 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70 cursor-pointer"
                  >
                    ⬇ Download Error Excel ({importResult.rejectedCount} Rejected)
                  </button>
                )}
              </div>

              {/* 5 Required Result Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">Total Uploaded</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {importResult.totalUploadedRows}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Created Drafts</div>
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {importResult.createdCount}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <div className="text-[11px] text-rose-700 dark:text-rose-400">Rejected Rows</div>
                  <div className="text-lg font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">
                    {importResult.rejectedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">Duplicates</div>
                  <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                    {importResult.duplicateCount}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">Validation Errors</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {importResult.validationErrorCount}
                  </div>
                </div>
              </div>

              {importResult.rejectedRows.length > 0 && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <th className="px-3 py-2 w-16">Row #</th>
                        <th className="px-3 py-2 w-36">Manufacturer SKU</th>
                        <th className="px-3 py-2 w-44">Product Name</th>
                        <th className="px-3 py-2">Error Reason</th>
                        <th className="px-3 py-2">Corrective Guidance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {importResult.rejectedRows.map((r, idx) => (
                        <tr key={`${r.excelRowNumber}-${idx}`} className="bg-rose-50/20 dark:bg-rose-950/10">
                          <td className="px-3 py-2 font-mono font-bold text-zinc-600 dark:text-zinc-400">
                            #{r.excelRowNumber}
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-800 dark:text-zinc-200">
                            {r.manufactureSku || "-"}
                          </td>
                          <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                            {r.productName || "-"}
                          </td>
                          <td className="px-3 py-2 text-rose-700 dark:text-rose-400">
                            {r.errorReason}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {r.correctiveGuidance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/50 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(1);
                }}
                disabled={isValidating}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                ← Back to Step 1
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(2);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                ← Upload Different File
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(3);
                }}
                disabled={isSubmitting}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                ← Back to Preview
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 5 && (
              <button
                type="button"
                onClick={handleClose}
                disabled={isValidating || isSubmitting}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(2);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                Next: Upload Excel →
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleValidateFile}
                disabled={!selectedFile || isValidating}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                {isValidating ? "Validating Rows..." : "Validate & Preview →"}
              </button>
            )}

            {step === 3 && previewResult?.summary && (
              <button
                type="button"
                disabled={previewResult.summary.importableRows === 0}
                onClick={() => {
                  setErrorBanner(null);
                  setStep(4);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                {previewResult.summary.importableRows > 0
                  ? `Next: Confirm (${previewResult.summary.importableRows} Drafts) →`
                  : "0 Valid Rows to Import"}
              </button>
            )}

            {step === 4 && previewResult?.summary && (
              <button
                type="button"
                disabled={isSubmitting || previewResult.summary.importableRows === 0}
                onClick={handleConfirmImport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting
                  ? "Creating Draft Products..."
                  : `Confirm Draft Registration (${previewResult.summary.importableRows})`}
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                Done &amp; View Product List
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
