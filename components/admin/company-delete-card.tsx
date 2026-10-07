"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminDeleteCompany,
  getCompanyDeletionCheck,
  type CompanyDeletionCheck,
} from "@/lib/company/delete-actions";

/**
 * 회사 상세 좌측 하단의 "회사 삭제" 영역. 상품·브랜드·거래 이력이 하나라도
 * 남아 있으면 이유를 보여주고 버튼을 막는다. 삭제는 회사명을 직접 입력해야 한다.
 */
export function CompanyDeleteCard({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [check, setCheck] = useState<CompanyDeletionCheck | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompanyDeletionCheck(companyId)
      .then((res) => {
        if (!cancelled) setCheck(res);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      const res = await adminDeleteCompany(companyId, confirmName);
      if (!res.success) {
        setError(res.error || "회사 삭제에 실패했습니다.");
        return;
      }
      router.push("/admin/companies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "회사 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/50 dark:bg-zinc-900">
      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">회사 삭제</h3>

      {loadError && (
        <p className="mt-2 text-[11px] text-zinc-500">삭제 가능 여부를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.</p>
      )}

      {!check && !loadError && <p className="mt-2 text-[11px] text-zinc-400">삭제 가능 여부 확인 중...</p>}

      {check && !check.deletable && (
        <div className="mt-2 space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          <p>상품·브랜드·거래 이력이 없는 회사만 삭제할 수 있습니다. 남아 있는 항목:</p>
          <ul className="list-disc pl-4">
            {check.blockers.map((b) => (
              <li key={b.label}>
                {b.label} {b.count < 0 ? "(확인 불가)" : `${b.count}건`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {check && check.deletable && !isOpen && (
        <div className="mt-2 space-y-3">
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            이 회사는 등록 상품·브랜드·거래 이력이 없어 삭제할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
          >
            회사 삭제
          </button>
        </div>
      )}

      {check && check.deletable && isOpen && (
        <div className="mt-3 space-y-3 text-[11px]">
          {check.cascades.length > 0 && (
            <div className="rounded-md bg-rose-50 p-2.5 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              함께 삭제되는 데이터: {check.cascades.map((c) => `${c.label} ${c.count}건`).join(", ")}
            </div>
          )}
          <p className="text-zinc-600 dark:text-zinc-400">
            되돌릴 수 없습니다. 확인을 위해 회사명 <span className="font-bold text-zinc-900 dark:text-white">{companyName}</span> 을(를) 입력하세요.
          </p>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={companyName}
            className="w-full rounded border border-zinc-200 bg-zinc-50 p-1.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
          {error && (
            <p className="font-semibold text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || confirmName.trim() !== companyName.trim()}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? "삭제 중..." : "영구 삭제"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setConfirmName("");
                setError(null);
              }}
              disabled={isDeleting}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
