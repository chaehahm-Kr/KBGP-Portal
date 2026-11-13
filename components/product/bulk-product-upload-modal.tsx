"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  downloadAnnotatedErrorWorkbookAction,
  downloadBulkProductTemplateAction,
  executeBulkProductImportAction,
  generateCombinedBulkErrorReportAction,
  ingestBulkProductMediaBatchAction,
  validateBulkProductExcelAction,
} from "@/lib/product/bulk-import-actions";
import {
  BULK_ERROR_CATEGORY_LABELS_KO,
  BULK_PRODUCT_COLUMNS,
  BULK_IMPORT_MAX_ROWS,
  COMMON_BULK_ATTRIBUTES,
  type BulkCellValidationIssue,
  type BulkErrorCategory,
  type BulkImportExecutionResult,
  type BulkMediaFailureItem,
  type BulkPendingMediaTask,
  type BulkPreviewResult,
  type BulkValidatedRow,
} from "@/lib/product/bulk-import-types";

interface BulkProductUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (createdCount: number) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;
type PreviewFilter =
  | "ALL"
  | "VALID"
  | "WARNING"
  | "INVALID"
  | "CAT_ERR"
  | "ATTR_ERR"
  | "MEDIA_ERR";

type ResultDetailTab = "PRODUCT_ERRORS" | "MEDIA_FAILURES";

const PREVIEW_PAGE_SIZE = 5;
const ERROR_RESULT_PAGE_SIZE = 4;
const MEDIA_BATCH_PRODUCT_CHUNK = 5;

const STEP_DEFINITIONS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "1. 양식 받기" },
  { step: 2, label: "2. 파일 업로드" },
  { step: 3, label: "3. 데이터 검증" },
  { step: 4, label: "4. 등록 확인" },
  { step: 5, label: "5. 등록 결과" },
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

function getErrorCategoryBadgeClasses(category: BulkErrorCategory): string {
  switch (category) {
    case "REQUIRED_FIELD":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    case "CATEGORY_HIERARCHY":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
    case "INVALID_ATTRIBUTE_VALUE":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
    case "INVALID_CUSTOM_VALUE":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800";
    case "DUPLICATE_SKU_BARCODE":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
    case "PRICING_LOGISTICS":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
    case "MEDIA_URL":
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  }
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
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [detailRowNumber, setDetailRowNumber] = useState<number | null>(null);
  const [isDownloadingAnnotatedWorkbook, setIsDownloadingAnnotatedWorkbook] = useState(false);

  const [submissionKey, setSubmissionKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportExecutionResult | null>(null);

  // Phase 2 chunked media ingestion state
  const [isIngestingMedia, setIsIngestingMedia] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [imagesImportedCount, setImagesImportedCount] = useState(0);
  const [duplicateImagesSkippedCount, setDuplicateImagesSkippedCount] = useState(0);
  const [mediaFailures, setMediaFailures] = useState<BulkMediaFailureItem[]>([]);
  const [retryMediaTasks, setRetryMediaTasks] = useState<BulkPendingMediaTask[]>([]);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const [resultTab, setResultTab] = useState<ResultDetailTab>("PRODUCT_ERRORS");
  const [errorPage, setErrorPage] = useState<number>(1);
  const [mediaFailurePage, setMediaFailurePage] = useState<number>(1);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBusy = isValidating || isSubmitting || isIngestingMedia;

  const resetModalState = () => {
    setStep(1);
    setIsDownloadingTemplate(false);
    setTemplateDownloaded(false);
    setSelectedFile(null);
    setIsDragging(false);
    setIsValidating(false);
    setPreviewResult(null);
    setPreviewFilter("ALL");
    setPreviewPage(1);
    setDetailRowNumber(null);
    setIsDownloadingAnnotatedWorkbook(false);
    setSubmissionKey("");
    setIsSubmitting(false);
    setImportResult(null);
    setIsIngestingMedia(false);
    setMediaProgress({ done: 0, total: 0 });
    setImagesImportedCount(0);
    setDuplicateImagesSkippedCount(0);
    setMediaFailures([]);
    setRetryMediaTasks([]);
    setIsDownloadingReport(false);
    setResultTab("PRODUCT_ERRORS");
    setErrorPage(1);
    setMediaFailurePage(1);
    setErrorBanner(null);
  };

  const handleClose = () => {
    if (isBusy) return;
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
        setErrorBanner(res.error || "Excel 양식을 다운로드하지 못했습니다.");
        return;
      }
      triggerBase64XlsxDownload(res.base64, res.fileName);
      setTemplateDownloaded(true);
    } catch (err: any) {
      setErrorBanner(err?.message || "Excel 양식 생성 중 오류가 발생했습니다.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const acceptFileSelection = (file: File | null | undefined) => {
    setErrorBanner(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setSelectedFile(null);
      setErrorBanner(
        "지원하지 않는 파일 형식입니다. .xlsx 형식의 Excel 파일만 업로드할 수 있습니다."
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setErrorBanner("파일 크기가 허용 한도(10 MB)를 초과했습니다.");
    } else {
      setSelectedFile(file);
    }
  };

  const handleValidateFile = async () => {
    if (!selectedFile) {
      setErrorBanner("먼저 업로드할 .xlsx 파일을 선택해 주세요.");
      return;
    }
    setErrorBanner(null);
    setIsValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await validateBulkProductExcelAction(formData);
      if (!res.success || !res.summary || !res.rows) {
        setErrorBanner(res.error || "업로드된 Excel 파일을 검증하지 못했습니다.");
        return;
      }
      setPreviewResult(res);
      setPreviewFilter("ALL");
      setPreviewPage(1);
      setSubmissionKey(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      setStep(3);
    } catch (err: any) {
      setErrorBanner(err?.message || "Excel 데이터 검증 중 예기치 않은 오류가 발생했습니다.");
    } finally {
      setIsValidating(false);
    }
  };

  const runChunkedMediaIngestion = async (
    tasksToRun: BulkPendingMediaTask[],
    initialVideoFailures: BulkMediaFailureItem[],
    isRetryRun: boolean
  ) => {
    if (tasksToRun.length === 0) {
      if (!isRetryRun && initialVideoFailures.length > 0) {
        setResultTab("MEDIA_FAILURES");
      }
      return;
    }

    setIsIngestingMedia(true);
    setMediaProgress({ done: 0, total: tasksToRun.length });

    let newlyImportedImages = 0;
    let newlySkippedDuplicates = 0;
    const collectedImageFailures: BulkMediaFailureItem[] = [];
    const collectedRetryTasks: BulkPendingMediaTask[] = [];

    try {
      for (let i = 0; i < tasksToRun.length; i += MEDIA_BATCH_PRODUCT_CHUNK) {
        const chunk = tasksToRun.slice(i, i + MEDIA_BATCH_PRODUCT_CHUNK);
        const batchRes = await ingestBulkProductMediaBatchAction(chunk);
        if (batchRes.success) {
          newlyImportedImages += batchRes.imagesImportedCount;
          newlySkippedDuplicates += batchRes.duplicatesSkippedCount;
          collectedImageFailures.push(...batchRes.failures);
          collectedRetryTasks.push(...batchRes.retryTasks);
        } else {
          // Preserve retryability if a network/server error occurred mid-batch
          for (const task of chunk) {
            for (const u of task.imageUrls) {
              collectedImageFailures.push({
                excelRowNumber: task.excelRowNumber,
                productId: task.productId,
                manufactureSku: task.manufactureSku,
                productNameEn: task.productNameEn,
                columnHeader: u.columnHeader,
                slotNumber: u.slotNumber,
                url: u.url,
                errorReason: batchRes.error || "배치 미디어 수집 요청이 실패했습니다.",
                correctiveGuidance: "'실패 이미지 재시도' 버튼을 눌러 다시 시도해 주세요.",
              });
            }
            collectedRetryTasks.push(task);
          }
        }
        setMediaProgress({
          done: Math.min(i + chunk.length, tasksToRun.length),
          total: tasksToRun.length,
        });
        setImagesImportedCount((prev) =>
          isRetryRun ? prev + batchRes.imagesImportedCount : newlyImportedImages
        );
        setDuplicateImagesSkippedCount((prev) =>
          isRetryRun ? prev + batchRes.duplicatesSkippedCount : newlySkippedDuplicates
        );
      }

      const combinedFailures = [...initialVideoFailures, ...collectedImageFailures].sort(
        (a, b) => a.excelRowNumber - b.excelRowNumber || a.slotNumber - b.slotNumber
      );
      setMediaFailures(combinedFailures);
      setRetryMediaTasks(collectedRetryTasks);
      setMediaFailurePage(1);

      if (
        combinedFailures.length > 0 &&
        (isRetryRun || (importResult?.rejectedRows.length ?? 0) === 0)
      ) {
        setResultTab("MEDIA_FAILURES");
      }

      if (newlyImportedImages > 0) {
        router.refresh();
      }
    } finally {
      setIsIngestingMedia(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !previewResult?.summary || isBusy) return;
    if (previewResult.summary.importableRows === 0) return;

    setErrorBanner(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("submissionKey", submissionKey);

      const res = await executeBulkProductImportAction(formData);
      if (!res.success) {
        setErrorBanner(res.error || "상품 대량 등록 처리에 실패했습니다.");
        return;
      }

      const initialVideoFailures = res.mediaFailures ?? [];
      setImportResult(res);
      setImagesImportedCount(0);
      setDuplicateImagesSkippedCount(0);
      setMediaFailures(initialVideoFailures);
      setRetryMediaTasks(res.pendingMediaTasks ?? []);
      setErrorPage(1);
      setMediaFailurePage(1);
      setResultTab(
        res.rejectedRows.length > 0
          ? "PRODUCT_ERRORS"
          : initialVideoFailures.length > 0
          ? "MEDIA_FAILURES"
          : "PRODUCT_ERRORS"
      );
      setStep(5);
      setIsSubmitting(false);

      if (res.createdCount > 0) {
        router.refresh();
        onImportSuccess?.(res.createdCount);
      }

      if ((res.pendingMediaTasks?.length ?? 0) > 0) {
        await runChunkedMediaIngestion(
          res.pendingMediaTasks,
          initialVideoFailures,
          false
        );
      }
    } catch (err: any) {
      setErrorBanner(err?.message || "상품 등록 중 예기치 않은 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  const handleRetryFailedMedia = async () => {
    if (isBusy || retryMediaTasks.length === 0) return;
    setErrorBanner(null);
    const preservedVideoFailures = mediaFailures.filter((f) => f.slotNumber === 11);
    await runChunkedMediaIngestion(retryMediaTasks, preservedVideoFailures, true);
  };

  const handleDownloadCombinedReport = async () => {
    if (!importResult || isDownloadingReport) return;
    setIsDownloadingReport(true);
    try {
      // If no Phase-2 media failures changed since Phase-1, reuse prebuilt base64 directly
      if (mediaFailures.length === 0 && importResult.errorReportBase64) {
        triggerBase64XlsxDownload(
          importResult.errorReportBase64,
          importResult.errorReportFilename || "KSN_Bulk_Import_Report.xlsx"
        );
        return;
      }

      const reportRes = await generateCombinedBulkErrorReportAction({
        rejectedRows: importResult.rejectedRows,
        mediaFailures,
      });
      if (!reportRes.success || !reportRes.base64) {
        setErrorBanner(reportRes.error || "오류·미디어 리포트를 생성하지 못했습니다.");
        return;
      }
      triggerBase64XlsxDownload(
        reportRes.base64,
        reportRes.fileName || "KSN_Bulk_Import_Report.xlsx"
      );
    } catch (err: any) {
      setErrorBanner(err?.message || "리포트 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleDownloadAnnotatedWorkbook = async () => {
    if (!selectedFile || isDownloadingAnnotatedWorkbook) return;
    setErrorBanner(null);
    setIsDownloadingAnnotatedWorkbook(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await downloadAnnotatedErrorWorkbookAction(formData);
      if (!res.success || !res.base64 || !res.fileName) {
        setErrorBanner(res.error || "오류 표시 Excel을 생성하지 못했습니다.");
        return;
      }
      triggerBase64XlsxDownload(res.base64, res.fileName);
    } catch (err: any) {
      setErrorBanner(err?.message || "오류 표시 Excel 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloadingAnnotatedWorkbook(false);
    }
  };

  const filteredPreviewRows: BulkValidatedRow[] = (previewResult?.rows ?? []).filter((r) => {
    if (previewFilter === "ALL") return true;
    if (previewFilter === "CAT_ERR") return r.hasCategoryError;
    if (previewFilter === "ATTR_ERR") return r.hasCommonAttributeError;
    if (previewFilter === "MEDIA_ERR") return r.hasMediaUrlError;
    return r.status === previewFilter;
  });

  const detailNavigableRows = filteredPreviewRows.filter(
    (r) => r.status === "INVALID" || r.status === "WARNING"
  );
  const activeDetailRow =
    detailRowNumber !== null
      ? (previewResult?.rows ?? []).find((r) => r.excelRowNumber === detailRowNumber) ?? null
      : null;
  const activeDetailNavIdx = activeDetailRow
    ? detailNavigableRows.findIndex((r) => r.excelRowNumber === activeDetailRow.excelRowNumber)
    : -1;

  const totalPreviewPages = Math.max(
    1,
    Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE)
  );
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const pagedPreviewRows = filteredPreviewRows.slice(
    (safePreviewPage - 1) * PREVIEW_PAGE_SIZE,
    safePreviewPage * PREVIEW_PAGE_SIZE
  );

  const rejectedList = importResult?.rejectedRows ?? [];
  const totalErrorPages = Math.max(
    1,
    Math.ceil(rejectedList.length / ERROR_RESULT_PAGE_SIZE)
  );
  const safeErrorPage = Math.min(errorPage, totalErrorPages);
  const pagedErrorRows = rejectedList.slice(
    (safeErrorPage - 1) * ERROR_RESULT_PAGE_SIZE,
    safeErrorPage * ERROR_RESULT_PAGE_SIZE
  );

  const totalMediaFailPages = Math.max(
    1,
    Math.ceil(mediaFailures.length / ERROR_RESULT_PAGE_SIZE)
  );
  const safeMediaFailPage = Math.min(mediaFailurePage, totalMediaFailPages);
  const pagedMediaFailures = mediaFailures.slice(
    (safeMediaFailPage - 1) * ERROR_RESULT_PAGE_SIZE,
    safeMediaFailPage * ERROR_RESULT_PAGE_SIZE
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-upload-modal-title"
        className="relative w-full max-w-4xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2.5rem)] flex flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2
              id="bulk-upload-modal-title"
              className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate"
            >
              상품 Excel 대량 등록
            </h2>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
              임시 등록 (Draft) · 총 {BULK_PRODUCT_COLUMNS.length}열 · 최대 {BULK_IMPORT_MAX_ROWS}건
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            aria-label="대량 등록 창 닫기"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Zero-Overflow 5-Step Stepper */}
        <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 sm:px-5 py-2 dark:border-zinc-800 dark:bg-zinc-950/50 shrink-0">
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
            {STEP_DEFINITIONS.map((item) => {
              const isCurrent = step === item.step;
              const isCompleted = step > item.step;
              return (
                <div
                  key={item.step}
                  className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] sm:text-xs font-bold text-center truncate transition-colors ${
                    isCurrent
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs"
                      : isCompleted
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                      : "text-zinc-400 dark:text-zinc-500 bg-transparent"
                  }`}
                >
                  {isCompleted && <span className="shrink-0">✓</span>}
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[340px] flex flex-col justify-between gap-3">
          <div className="space-y-3">
            {errorBanner && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 flex items-start justify-between gap-3">
                <span className="break-words">{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* STEP 1: 양식 받기 */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      공식 Excel 업로드 양식 다운로드 (.xlsx)
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      활성 브랜드, 1~3단계 연동 카테고리, 미디어 URL(이미지 10·영상 1), 공통 속성({COMMON_BULK_ATTRIBUTES.length}종) 및 기준 시트가 포함됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isDownloadingTemplate}
                    className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer shadow-2xs"
                  >
                    {isDownloadingTemplate ? "양식 생성 중..." : "⬇ Excel 양식 다운로드"}
                  </button>
                </div>

                {templateDownloaded && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    ✓ 양식이 다운로드되었습니다. <strong>&quot;Products&quot;</strong> 시트를 작성한 뒤 다음 단계로 이동해 주세요.
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-zinc-200 p-3.5 dark:border-zinc-800 space-y-1.5">
                    <div className="font-bold text-zinc-900 dark:text-white">
                      필수 입력 항목 (4개만 입력해도 등록 가능)
                    </div>
                    <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
                      <li>• <strong>브랜드 (Brand) *</strong> — 귀사에 등록된 활성 브랜드명</li>
                      <li>• <strong>제조사 SKU (Manufacturer SKU) *</strong> — 고유 상품 코드</li>
                      <li>• <strong>영문 제품명 (Product Name EN) *</strong> — 공식 영문 상품명</li>
                      <li>• <strong>카테고리 (1Depth) *</strong> — 대분류 선택 시 2·3Depth 자동 연동</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3.5 dark:border-zinc-800 space-y-1.5">
                    <div className="font-bold text-zinc-900 dark:text-white">
                      선택 입력 항목 ({BULK_PRODUCT_COLUMNS.length - 4}개) 및 등록 정책
                    </div>
                    <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
                      <li>• <strong>미디어 URL</strong>: 직접 다운로드 HTTPS 이미지(최대 10장) 및 소개 영상</li>
                      <li>• <strong>공통 속성</strong>: 한글 (영문) 드롭다운 제공 · 복수 선택은 <code className="font-mono">;</code> 구분 · 허용 속성은 <code className="font-mono">기타: 값</code> (<code className="font-mono">Other: Value</code>) 지원</li>
                      <li>• 모든 상품은 <strong>임시 등록 (Draft · 리테일러 비노출)</strong> 상태로 안전 생성</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: 파일 업로드 */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    작성 완료된 Excel 파일 업로드 (.xlsx)
                  </h3>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    최대 {BULK_IMPORT_MAX_ROWS}개 행 · 10 MB 이하 · 기존 52열 및 신규 86열 양식 호환
                  </span>
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
                  className={`rounded-xl border-2 border-dashed px-6 py-11 text-center transition-colors cursor-pointer ${
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
                      <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white break-all">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB · 다른 .xlsx 파일로 변경하려면 클릭하거나 드래그하세요
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        클릭하여 .xlsx 파일을 선택하거나 이곳으로 끌어다 놓으세요
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        공식 양식의 &quot;Products&quot; 시트 기준 · 예시 행(EXAMPLE-SKU-001)은 자동 제외됩니다
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: 데이터 검증 및 미리보기 */}
            {step === 3 && previewResult?.summary && (
              <div className="space-y-2">
                {/* Concise Diagnostic Summary Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-1.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">
                      {previewResult.fileName}
                    </span>
                    {previewResult.summary.exampleRowsSkipped > 0 && (
                      <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        예시 행 제외
                      </span>
                    )}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      이미지 URL <strong>{previewResult.summary.totalImageUrlsCount}</strong>건 · 영상{" "}
                      <strong>{previewResult.summary.rowsWithVideoCount}</strong>건 · 공통속성{" "}
                      <strong>{previewResult.summary.rowsWithCommonAttrsCount}</strong>행
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFilter(
                          previewFilter === "CAT_ERR" ? "ALL" : "CAT_ERR"
                        );
                        setPreviewPage(1);
                      }}
                      className={`rounded px-1.5 py-0.5 font-semibold cursor-pointer ${
                        previewFilter === "CAT_ERR"
                          ? "bg-rose-600 text-white"
                          : previewResult.summary.categoryErrorRows > 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      카테고리 오류 {previewResult.summary.categoryErrorRows}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFilter(
                          previewFilter === "ATTR_ERR" ? "ALL" : "ATTR_ERR"
                        );
                        setPreviewPage(1);
                      }}
                      className={`rounded px-1.5 py-0.5 font-semibold cursor-pointer ${
                        previewFilter === "ATTR_ERR"
                          ? "bg-rose-600 text-white"
                          : previewResult.summary.commonAttributeErrorRows > 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      공통 속성 오류 {previewResult.summary.commonAttributeErrorRows}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFilter(
                          previewFilter === "MEDIA_ERR" ? "ALL" : "MEDIA_ERR"
                        );
                        setPreviewPage(1);
                      }}
                      className={`rounded px-1.5 py-0.5 font-semibold cursor-pointer ${
                        previewFilter === "MEDIA_ERR"
                          ? "bg-rose-600 text-white"
                          : previewResult.summary.mediaUrlErrorRows > 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      이미지 URL 오류 {previewResult.summary.mediaUrlErrorRows}
                    </button>
                  </div>
                </div>

                {/* Primary Status Filter Tabs + Annotated Error Workbook Download */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: "ALL", label: `전체 (${previewResult.summary.totalRows})` },
                        { id: "VALID", label: `정상 (${previewResult.summary.validRows})` },
                        {
                          id: "WARNING",
                          label: `확인 필요 (${previewResult.summary.warningRows})`,
                        },
                        {
                          id: "INVALID",
                          label: `오류 (${previewResult.summary.invalidRows})`,
                        },
                      ] as { id: PreviewFilter; label: string }[]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setPreviewFilter(tab.id);
                          setPreviewPage(1);
                        }}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                          previewFilter === tab.id
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      등록 가능 <strong>{previewResult.summary.importableRows}</strong>건 · 제외{" "}
                      <strong className="text-rose-600 dark:text-rose-400">
                        {previewResult.summary.invalidRows}
                      </strong>
                      건
                    </span>

                    {previewResult.summary.invalidRows > 0 && selectedFile && (
                      <button
                        type="button"
                        onClick={handleDownloadAnnotatedWorkbook}
                        disabled={isDownloadingAnnotatedWorkbook}
                        className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 cursor-pointer shadow-2xs"
                      >
                        {isDownloadingAnnotatedWorkbook
                          ? "오류 표시 Excel 생성 중..."
                          : "⬇ 오류 표시 Excel 다운로드"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bounded Paginated Table (Zero Horizontal Overflow) */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <table className="w-full table-fixed text-left text-xs border-collapse">
                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <th className="px-2 py-1.5 w-11">행</th>
                        <th className="px-2 py-1.5 w-18">상태</th>
                        <th className="px-2.5 py-1.5 w-32">브랜드 / SKU</th>
                        <th className="px-2.5 py-1.5 w-36">영문 제품명</th>
                        <th className="px-2 py-1.5 w-28 hidden sm:table-cell">카테고리 / 부가</th>
                        <th className="px-2.5 py-1.5">검증 결과 및 사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {pagedPreviewRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-7 text-center text-xs text-zinc-500 dark:text-zinc-400"
                          >
                            선택한 필터에 해당하는 행이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        pagedPreviewRows.map((row) => {
                          const extraParts: string[] = [];
                          if (row.imageUrlCount > 0) extraParts.push(`이미지 ${row.imageUrlCount}`);
                          if (row.hasVideoUrl) extraParts.push("영상 1");
                          if (row.commonAttributeCount > 0)
                            extraParts.push(`속성 ${row.commonAttributeCount}`);

                          const validSummary =
                            extraParts.length > 0
                              ? `등록 가능 (${extraParts.join(" · ")})`
                              : "임시 등록 (Draft) 가능";

                          const errCount = row.errorDetails?.length ?? row.errors.length;
                          const warnCount = row.warningDetails?.length ?? row.warnings.length;

                          const shortSummaryText =
                            row.status === "INVALID"
                              ? row.errors[0] || "입력 검증 오류가 있습니다."
                              : row.status === "WARNING"
                              ? row.warnings[0] || "확인 필요 항목이 있습니다."
                              : validSummary;

                          const fullHoverDetails =
                            row.status === "INVALID"
                              ? (row.errorDetails && row.errorDetails.length > 0
                                  ? row.errorDetails.map(
                                      (d, i) =>
                                        `[${i + 1}/${row.errorDetails.length}] ${d.colLetter}${row.excelRowNumber} (${d.columnHeader})\n• 입력값: ${d.submittedValue || "(미입력)"}\n• 사유: ${d.reason}\n• 수정: ${d.guidance}`
                                    )
                                  : row.errors.map((e, i) => `[${i + 1}] ${e}`)
                                ).join("\n\n")
                              : row.status === "WARNING"
                              ? (row.warningDetails && row.warningDetails.length > 0
                                  ? row.warningDetails.map(
                                      (w, i) =>
                                        `[확인 ${i + 1}] ${w.colLetter}${row.excelRowNumber} (${w.columnHeader}): ${w.reason}`
                                    )
                                  : row.warnings
                                ).join("\n")
                              : validSummary;

                          return (
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
                              <td className="px-2 py-1.5 font-mono font-bold text-zinc-600 dark:text-zinc-400 align-top">
                                #{row.excelRowNumber}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                {row.status === "VALID" && (
                                  <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    정상
                                  </span>
                                )}
                                {row.status === "WARNING" && (
                                  <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    확인 필요
                                  </span>
                                )}
                                {row.status === "INVALID" && (
                                  <span className="inline-flex rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    오류 {errCount}건
                                  </span>
                                )}
                              </td>
                              <td
                                className="px-2.5 py-1.5 align-top"
                                title={`${row.rawBrand || "(미입력)"} / ${row.rawManufactureSku || "(미입력)"}`}
                              >
                                <div className="truncate font-semibold text-zinc-800 dark:text-zinc-200">
                                  {row.rawBrand || (
                                    <span className="text-rose-500">(브랜드 누락)</span>
                                  )}
                                </div>
                                <div className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {row.rawManufactureSku || (
                                    <span className="text-rose-500">(SKU 누락)</span>
                                  )}
                                </div>
                              </td>
                              <td
                                className="px-2.5 py-1.5 align-top text-zinc-800 dark:text-zinc-200"
                                title={row.rawProductNameEn || ""}
                              >
                                <div className="line-clamp-2 break-words">
                                  {row.rawProductNameEn || (
                                    <span className="text-rose-500">(제품명 누락)</span>
                                  )}
                                </div>
                              </td>
                              <td
                                className="px-2 py-1.5 align-top text-zinc-600 dark:text-zinc-400 hidden sm:table-cell"
                                title={row.normalizedCategoryPath || row.rawCategory1Depth || ""}
                              >
                                <div className="truncate font-medium">
                                  {row.normalizedCategoryPath || row.rawCategory1Depth || "-"}
                                </div>
                                {extraParts.length > 0 && (
                                  <div className="truncate text-[10px] text-zinc-500">
                                    {extraParts.join(" · ")}
                                  </div>
                                )}
                              </td>
                              <td className="px-2.5 py-1.5 align-top" title={fullHoverDetails}>
                                {row.status === "INVALID" ? (
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="line-clamp-2 break-words text-rose-700 dark:text-rose-400">
                                        {shortSummaryText}
                                      </div>
                                      {errCount > 1 && (
                                        <div className="mt-0.5 text-[10px] font-semibold text-rose-600/90 dark:text-rose-300">
                                          외 {errCount - 1}건 더 있음 (총 {errCount}건 오류)
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setDetailRowNumber(row.excelRowNumber)}
                                      className="shrink-0 rounded border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/50 cursor-pointer"
                                    >
                                      오류 상세
                                    </button>
                                  </div>
                                ) : row.status === "WARNING" ? (
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="line-clamp-2 break-words text-amber-700 dark:text-amber-400">
                                        {shortSummaryText}
                                      </div>
                                      {warnCount > 1 && (
                                        <div className="mt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                                          확인 필요 총 {warnCount}건
                                        </div>
                                      )}
                                    </div>
                                    {warnCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setDetailRowNumber(row.excelRowNumber)}
                                        className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer"
                                      >
                                        오류 상세
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    {validSummary}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                {totalPreviewPages > 1 && (
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                    <span>
                      총 {filteredPreviewRows.length}건 중{" "}
                      {(safePreviewPage - 1) * PREVIEW_PAGE_SIZE + 1}–
                      {Math.min(
                        safePreviewPage * PREVIEW_PAGE_SIZE,
                        filteredPreviewRows.length
                      )}
                      건 표시
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePreviewPage <= 1}
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        className="rounded border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        이전
                      </button>
                      <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 px-1">
                        {safePreviewPage} / {totalPreviewPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePreviewPage >= totalPreviewPages}
                        onClick={() =>
                          setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))
                        }
                        className="rounded border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: 상품 등록 확인 */}
            {step === 4 && previewResult?.summary && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    임시 등록 (Draft) 실행 전 최종 확인
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    검증을 통과한 상품만 생성되며, 외부 이미지 다운로드는 상품 생성 직후 분리 실행되어 일부 URL 실패 시에도 상품 데이터는 안전하게 보존됩니다.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-lg bg-zinc-50/70 p-3 border border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">등록 예정 상품</div>
                    <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {previewResult.summary.importableRows}건
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      정상 {previewResult.summary.validRows} · 확인필요{" "}
                      {previewResult.summary.warningRows}
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50/70 p-3 border border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">제외 오류 행</div>
                    <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                      {previewResult.summary.invalidRows}건
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      카테고리 {previewResult.summary.categoryErrorRows} · 속성{" "}
                      {previewResult.summary.commonAttributeErrorRows} · 미디어{" "}
                      {previewResult.summary.mediaUrlErrorRows}
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50/70 p-3 border border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">미디어 / 공통 속성</div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-1">
                      이미지 {previewResult.summary.totalImageUrlsCount} · 영상{" "}
                      {previewResult.summary.rowsWithVideoCount}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      공통 속성 입력 {previewResult.summary.rowsWithCommonAttrsCount}개 행
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50/70 p-3 border border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800">
                    <div className="text-zinc-500 dark:text-zinc-400">초기 등록 상태</div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-1">
                      임시 등록 (Draft)
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      미검토 · 리테일러 비노출
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 px-4 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400 space-y-1">
                  <div>
                    • 이미 등록된 제조사 SKU는 덮어쓰지 않으며, 공통 속성은 지정된 상품의 EAV 레코드에만 저장됩니다.
                  </div>
                  <div>
                    • 규제 관련 상태(FDA·MoCRA·OTC·Drug Facts)는 브랜드 자체 기재 정보로 저장되며 공식 인증 승인으로 자동 전환되지 않습니다.
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: 등록 결과 (상품 생성 + 분리된 미디어 수집 결과) */}
            {step === 5 && importResult && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      상품 Excel 대량 등록 및 미디어 수집 결과
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {importResult.createdCount > 0
                        ? `${importResult.createdCount}개 상품이 Draft로 생성되었습니다 (공통 속성 ${importResult.commonAttributesSavedCount}건 저장).`
                        : "이번 업로드에서 신규 등록된 상품이 없습니다."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!isIngestingMedia && retryMediaTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRetryFailedMedia}
                        className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                      >
                        🔄 실패 이미지 재시도 (
                        {retryMediaTasks.reduce((sum, t) => sum + t.imageUrls.length, 0)}건)
                      </button>
                    )}

                    {!isIngestingMedia &&
                      importResult.rejectedCount > 0 &&
                      selectedFile && (
                        <button
                          type="button"
                          disabled={isDownloadingAnnotatedWorkbook}
                          onClick={handleDownloadAnnotatedWorkbook}
                          className="shrink-0 rounded-lg border border-rose-300 bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 dark:border-rose-700 cursor-pointer shadow-2xs"
                        >
                          {isDownloadingAnnotatedWorkbook
                            ? "오류 표시 Excel 생성 중..."
                            : "⬇ 오류 표시 Excel 다운로드"}
                        </button>
                      )}

                    {!isIngestingMedia &&
                      (importResult.rejectedCount > 0 || mediaFailures.length > 0) && (
                        <button
                          type="button"
                          disabled={isDownloadingReport}
                          onClick={handleDownloadCombinedReport}
                          className="shrink-0 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
                        >
                          {isDownloadingReport
                            ? "리포트 생성 중..."
                            : `⬇ 오류·미디어 내역 Excel (${
                                importResult.rejectedCount + mediaFailures.length
                              }건)`}
                        </button>
                      )}
                  </div>
                </div>

                {/* Live Chunked Media Ingestion Progress Banner */}
                {isIngestingMedia && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3.5 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300 flex items-center justify-between gap-3">
                    <span className="font-semibold">
                      외부 HTTPS 상품 이미지 수집 및 검증 중... ({mediaProgress.done} /{" "}
                      {mediaProgress.total}개 상품 처리됨)
                    </span>
                    <span className="font-mono text-[11px]">
                      저장 완료 {imagesImportedCount}장
                    </span>
                  </div>
                )}

                {/* Separated Summary Cards: Product Creation vs Media Ingestion */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className="text-[11px] text-zinc-500">업로드 행</div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5">
                      {importResult.totalUploadedRows}건
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      상품 생성
                    </div>
                    <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {importResult.createdCount}건
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className="text-[11px] text-zinc-500">공통 속성 저장</div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5">
                      {importResult.commonAttributesSavedCount}개
                    </div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-2 dark:border-sky-900/50 dark:bg-sky-950/20">
                    <div className="text-[11px] text-sky-700 dark:text-sky-400">
                      이미지 · 영상
                    </div>
                    <div className="text-sm font-extrabold text-sky-700 dark:text-sky-400 mt-0.5">
                      {imagesImportedCount}장 · {importResult.videosImportedCount}건
                    </div>
                    {duplicateImagesSkippedCount > 0 && (
                      <div className="text-[10px] text-zinc-500">
                        중복 제외 {duplicateImagesSkippedCount}장
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <div className="text-[11px] text-rose-700 dark:text-rose-400">
                      상품 미등록
                    </div>
                    <div className="text-sm font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">
                      {importResult.rejectedCount}건
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">
                      미디어 실패
                    </div>
                    <div className="text-sm font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                      {mediaFailures.length}건
                    </div>
                  </div>
                </div>

                {/* Tabbed Error / Media Failure Details */}
                {(rejectedList.length > 0 || mediaFailures.length > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setResultTab("PRODUCT_ERRORS")}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          resultTab === "PRODUCT_ERRORS"
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        상품 미등록 오류 ({rejectedList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultTab("MEDIA_FAILURES")}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          resultTab === "MEDIA_FAILURES"
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        미디어 처리 실패 ({mediaFailures.length})
                      </button>
                    </div>

                    {resultTab === "PRODUCT_ERRORS" && (
                      <>
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                          <table className="w-full table-fixed text-left text-xs border-collapse">
                            <thead className="bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                              <tr>
                                <th className="px-2.5 py-1.5 w-12">행</th>
                                <th className="px-2.5 py-1.5 w-32">제조사 SKU</th>
                                <th className="px-2.5 py-1.5 w-40">제품명</th>
                                <th className="px-2.5 py-1.5">오류 사유</th>
                                <th className="px-2.5 py-1.5 hidden sm:table-cell">수정 안내</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {pagedErrorRows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-4 py-5 text-center text-xs text-zinc-500"
                                  >
                                    미등록된 상품 오류가 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                pagedErrorRows.map((r, idx) => (
                                  <tr
                                    key={`${r.excelRowNumber}-${idx}`}
                                    className="bg-rose-50/20 dark:bg-rose-950/10"
                                  >
                                    <td className="px-2.5 py-1.5 font-mono font-bold text-zinc-600 dark:text-zinc-400 align-top">
                                      #{r.excelRowNumber}
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 font-mono truncate text-zinc-800 dark:text-zinc-200 align-top"
                                      title={r.manufactureSku}
                                    >
                                      {r.manufactureSku || "-"}
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 truncate text-zinc-800 dark:text-zinc-200 align-top"
                                      title={r.productName}
                                    >
                                      {r.productName || "-"}
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 text-rose-700 dark:text-rose-400 align-top"
                                      title={r.errorReason}
                                    >
                                      <div className="line-clamp-2 break-words">
                                        {r.errorReason}
                                      </div>
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 text-zinc-600 dark:text-zinc-400 align-top hidden sm:table-cell"
                                      title={r.correctiveGuidance}
                                    >
                                      <div className="line-clamp-2 break-words">
                                        {r.correctiveGuidance}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {totalErrorPages > 1 && (
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>
                              오류 {rejectedList.length}건 중{" "}
                              {(safeErrorPage - 1) * ERROR_RESULT_PAGE_SIZE + 1}–
                              {Math.min(
                                safeErrorPage * ERROR_RESULT_PAGE_SIZE,
                                rejectedList.length
                              )}
                              건
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={safeErrorPage <= 1}
                                onClick={() => setErrorPage((p) => Math.max(1, p - 1))}
                                className="rounded border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
                              >
                                이전
                              </button>
                              <span className="font-mono font-semibold px-1">
                                {safeErrorPage} / {totalErrorPages}
                              </span>
                              <button
                                type="button"
                                disabled={safeErrorPage >= totalErrorPages}
                                onClick={() =>
                                  setErrorPage((p) => Math.min(totalErrorPages, p + 1))
                                }
                                className="rounded border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
                              >
                                다음
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {resultTab === "MEDIA_FAILURES" && (
                      <>
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                          <table className="w-full table-fixed text-left text-xs border-collapse">
                            <thead className="bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
                              <tr>
                                <th className="px-2.5 py-1.5 w-12">행</th>
                                <th className="px-2.5 py-1.5 w-32">생성된 SKU</th>
                                <th className="px-2.5 py-1.5 w-38">대상 항목</th>
                                <th className="px-2.5 py-1.5">미디어 실패 사유 (상품은 정상 생성됨)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {pagedMediaFailures.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="px-4 py-5 text-center text-xs text-zinc-500"
                                  >
                                    미디어 처리 실패 내역이 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                pagedMediaFailures.map((m, idx) => (
                                  <tr
                                    key={`${m.productId}-${m.slotNumber}-${idx}`}
                                    className="bg-amber-50/25 dark:bg-amber-950/10"
                                  >
                                    <td className="px-2.5 py-1.5 font-mono font-bold text-zinc-600 dark:text-zinc-400 align-top">
                                      #{m.excelRowNumber}
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 font-mono truncate text-zinc-800 dark:text-zinc-200 align-top"
                                      title={m.manufactureSku}
                                    >
                                      {m.manufactureSku}
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 truncate text-zinc-700 dark:text-zinc-300 align-top"
                                      title={`${m.columnHeader} — ${m.url}`}
                                    >
                                      {m.columnHeader}
                                    </td>
                                    <td
                                      className="px-2.5 py-1.5 text-amber-800 dark:text-amber-300 align-top"
                                      title={`${m.errorReason} (${m.url})`}
                                    >
                                      <div className="line-clamp-2 break-words">
                                        {m.errorReason}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {totalMediaFailPages > 1 && (
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>
                              미디어 실패 {mediaFailures.length}건 중{" "}
                              {(safeMediaFailPage - 1) * ERROR_RESULT_PAGE_SIZE + 1}–
                              {Math.min(
                                safeMediaFailPage * ERROR_RESULT_PAGE_SIZE,
                                mediaFailures.length
                              )}
                              건
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={safeMediaFailPage <= 1}
                                onClick={() =>
                                  setMediaFailurePage((p) => Math.max(1, p - 1))
                                }
                                className="rounded border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
                              >
                                이전
                              </button>
                              <span className="font-mono font-semibold px-1">
                                {safeMediaFailPage} / {totalMediaFailPages}
                              </span>
                              <button
                                type="button"
                                disabled={safeMediaFailPage >= totalMediaFailPages}
                                onClick={() =>
                                  setMediaFailurePage((p) =>
                                    Math.min(totalMediaFailPages, p + 1)
                                  )
                                }
                                className="rounded border border-zinc-300 px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
                              >
                                다음
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Always-Visible Compact Footer Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50 shrink-0">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(1);
                }}
                disabled={isBusy}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                ← 양식 받기로
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(2);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                ← 다른 파일 업로드
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(3);
                }}
                disabled={isBusy}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                ← 검증 결과로
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 5 && (
              <button
                type="button"
                onClick={handleClose}
                disabled={isBusy}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
              >
                취소
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setStep(2);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                다음: 파일 업로드 →
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleValidateFile}
                disabled={!selectedFile || isBusy}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                {isValidating ? "데이터 검증 중..." : "데이터 검증 및 미리보기 →"}
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
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                {previewResult.summary.importableRows > 0
                  ? `다음: 상품 등록 확인 (${previewResult.summary.importableRows}건) →`
                  : "등록 가능한 상품 없음"}
              </button>
            )}

            {step === 4 && previewResult?.summary && (
              <button
                type="button"
                disabled={isBusy || previewResult.summary.importableRows === 0}
                onClick={handleConfirmImport}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isSubmitting
                  ? "임시 등록 처리 중..."
                  : `상품 등록 확인 (${previewResult.summary.importableRows}건)`}
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                disabled={isIngestingMedia}
                onClick={handleClose}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
              >
                {isIngestingMedia ? "이미지 수집 진행 중..." : "완료 및 목록 보기"}
              </button>
            )}
          </div>
        </div>

        {/* Row Validation Error / Warning Full Detail Overlay Modal */}
        {step === 3 && activeDetailRow && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-2xs p-3 sm:p-5"
            onClick={() => setDetailRowNumber(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Excel ${activeDetailRow.excelRowNumber}행 검증 상세`}
              className="w-full max-w-2xl max-h-full flex flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Detail Header */}
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70 shrink-0">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs font-extrabold text-white dark:bg-white dark:text-zinc-950">
                      Excel #{activeDetailRow.excelRowNumber}행
                    </span>
                    {activeDetailRow.errorDetails.length > 0 && (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                        오류 총 {activeDetailRow.errorDetails.length}건
                      </span>
                    )}
                    {activeDetailRow.warningDetails.length > 0 && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                        확인 필요 {activeDetailRow.warningDetails.length}건
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300 break-words">
                    <span className="font-semibold">
                      {activeDetailRow.rawBrand || "(브랜드 미입력)"}
                    </span>{" "}
                    ·{" "}
                    <span className="font-mono font-semibold">
                      {activeDetailRow.rawManufactureSku || "(SKU 미입력)"}
                    </span>{" "}
                    ·{" "}
                    <span>
                      {activeDetailRow.rawProductNameEn || "(영문 제품명 미입력)"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailRowNumber(null)}
                  aria-label="오류 상세 닫기"
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Unclipped Scrollable Issue Cards */}
              <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">
                {activeDetailRow.errorDetails.map(
                  (issue: BulkCellValidationIssue, idx: number) => (
                    <div
                      key={`err-${idx}-${issue.colIndex}-${issue.fieldKey}`}
                      className="rounded-lg border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/60 dark:bg-rose-950/20 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-rose-700 dark:text-rose-300">
                            오류 {idx + 1}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${getErrorCategoryBadgeClasses(
                              issue.category
                            )}`}
                          >
                            {issue.categoryLabelKo ||
                              BULK_ERROR_CATEGORY_LABELS_KO[issue.category]}
                          </span>
                        </div>
                        <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-700 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700">
                          Excel #{activeDetailRow.excelRowNumber}행 · {issue.colLetter}열 (셀{" "}
                          {issue.colLetter}
                          {activeDetailRow.excelRowNumber})
                        </span>
                      </div>

                      <div className="grid gap-1.5 sm:grid-cols-2 rounded-md bg-white/90 p-2.5 border border-rose-100 dark:bg-zinc-900/80 dark:border-zinc-800">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                            항목명 (Excel 열)
                          </div>
                          <div className="font-bold text-zinc-900 dark:text-white break-words mt-0.5">
                            [{issue.colLetter}열] {issue.columnHeader}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                            입력된 값
                          </div>
                          <div className="font-mono font-semibold text-rose-700 dark:text-rose-300 break-all mt-0.5">
                            {issue.submittedValue ? (
                              issue.submittedValue
                            ) : (
                              <span className="italic text-rose-500">(미입력 / 빈 셀)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-0.5">
                        <div>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            • 오류 사유:{" "}
                          </span>
                          <span className="text-rose-800 dark:text-rose-300 font-medium break-words">
                            {issue.reason}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            • 허용값 / 기대 형식:{" "}
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 break-words">
                            {issue.acceptedValues}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            • 권장 수정 방법:{" "}
                          </span>
                          <span className="text-emerald-800 dark:text-emerald-300 font-medium break-words">
                            {issue.guidance}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {activeDetailRow.warningDetails.map(
                  (warn: BulkCellValidationIssue, idx: number) => (
                    <div
                      key={`warn-${idx}-${warn.colIndex}-${warn.fieldKey}`}
                      className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-amber-800 dark:text-amber-300">
                          확인 필요 {idx + 1} · [{warn.colLetter}열] {warn.columnHeader}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          셀 {warn.colLetter}
                          {activeDetailRow.excelRowNumber}
                        </span>
                      </div>
                      <div className="text-amber-900 dark:text-amber-200 break-words">
                        <strong>안내:</strong> {warn.reason}
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300 break-words">
                        <strong>권장 조치:</strong> {warn.guidance}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Detail Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/70 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeDetailNavIdx <= 0}
                    onClick={() => {
                      if (activeDetailNavIdx > 0) {
                        setDetailRowNumber(
                          detailNavigableRows[activeDetailNavIdx - 1].excelRowNumber
                        );
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                  >
                    ◀ 이전 행
                  </button>
                  <button
                    type="button"
                    disabled={
                      activeDetailNavIdx < 0 ||
                      activeDetailNavIdx >= detailNavigableRows.length - 1
                    }
                    onClick={() => {
                      if (
                        activeDetailNavIdx >= 0 &&
                        activeDetailNavIdx < detailNavigableRows.length - 1
                      ) {
                        setDetailRowNumber(
                          detailNavigableRows[activeDetailNavIdx + 1].excelRowNumber
                        );
                      }
                    }}
                    className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                  >
                    다음 행 ▶
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {(previewResult?.summary?.invalidRows ?? 0) > 0 && selectedFile && (
                    <button
                      type="button"
                      onClick={handleDownloadAnnotatedWorkbook}
                      disabled={isDownloadingAnnotatedWorkbook}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
                    >
                      {isDownloadingAnnotatedWorkbook
                        ? "생성 중..."
                        : "⬇ 오류 표시 Excel 다운로드"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailRowNumber(null)}
                    className="rounded-lg bg-zinc-900 px-3.5 py-1 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
