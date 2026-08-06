"use client";

import { useState } from "react";
import { adminImportMasterExcel } from "@/lib/product/attribute-actions";
import { exportMasterExcelWithGuide } from "@/lib/product/attribute-export-actions";

export function ExcelImporter() {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = event.target?.result as string;
          const base64 = result.split(",")[1];
          const response = await adminImportMasterExcel(base64);
          if (response.success) {
            setSuccess(true);
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            setError(response.error || "임포트 처리가 정상 완료되지 않았습니다.");
          }
        } catch (err: any) {
          setError(err.message || "엑셀 업로드 중 오류가 발생했습니다.");
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError("파일 읽기 오류가 발생했습니다.");
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || "파일 처리 중 예외 발생");
      setLoading(false);
    }
  };

  // Export Master Data Excel with Guide sheet
  const handleDownloadMaster = async () => {
    setDownloading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await exportMasterExcelWithGuide();
      if (!response.success) {
        setError(response.error || "엑셀 파일 생성에 실패했습니다.");
        return;
      }
      
      const base64 = response.data!;
      const url = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `K_Select_Category_Attribute_Master_Exported.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden mb-8 text-zinc-900 dark:text-zinc-100">
      {/* Background glowing gradient decoration */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-600/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            📊 카테고리 & 속성 하이브리드 통합 동기화
          </h2>
          <p className="text-sm text-zinc-550 dark:text-zinc-400 max-w-2xl leading-relaxed">
            엑셀 동기화(Bulk Import)와 화면 개별 편집(Web UI CUD)을 유기적으로 교차 지원합니다. 현재 DB 상태의 마스터 데이터를 사용 가이드 시트가 동봉된 Excel 파일로 내려받아 간편하게 가이드라인을 분석하고 대량 수정할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
          {/* Download button */}
          <button
            onClick={handleDownloadMaster}
            disabled={downloading}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                엑셀 파일 작성 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                마스터 엑셀 다운로드 (가이드 시트 동봉)
              </>
            )}
          </button>

          {/* Upload input label */}
          <label className={`
            relative cursor-pointer flex items-center justify-center gap-2 px-6 py-3.5 
            rounded-xl font-semibold text-sm transition-all duration-300 shadow-md
            ${loading 
              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-300 dark:border-zinc-700' 
              : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-900 dark:border-zinc-100 hover:scale-[1.02] active:scale-[0.98]'
            }
          `}>
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                동기화 분석 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                마스터 엑셀 업로드 동기화
              </>
            )}
            <input 
              id="master-excel-uploader"
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          마스터 데이터 엑셀 업로드 및 동적 스키마 동기화가 성공적으로 완료되었습니다! (화면 데이터가 자동 갱신됩니다)
        </div>
      )}
    </div>
  );
}
