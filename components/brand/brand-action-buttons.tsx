"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deactivateBrand, reactivateBrand, deleteBrand } from "@/lib/brand/actions";
import { ConfirmForm } from "@/components/common/confirm-form";

interface BrandActionButtonsProps {
  brandId: string;
  isActive: boolean;
  productCount: number;
  canWrite: boolean;
  canManage: boolean;
  isAdmin?: boolean;
}

export function BrandActionButtons({
  brandId,
  isActive,
  productCount,
  canWrite,
  canManage,
}: BrandActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReactivate = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await reactivateBrand(brandId);
      } catch (err: any) {
        setErrorMessage(err?.message || "브랜드 다시 활성화에 실패했습니다.");
      }
    });
  };

  const handleDelete = () => {
    setErrorMessage(null);
    if (productCount > 0) {
      alert(`이 브랜드는 ${productCount}개의 상품에 연결되어 있어 물리 삭제할 수 없습니다.\n더 이상 신규 상품에 사용하지 않으려면 [사용 중단]을 선택하세요.`);
      return;
    }

    const confirmDelete = window.confirm(
      "연결된 상품이 없는 브랜드입니다. 정말 물리 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다."
    );
    if (!confirmDelete) return;

    startTransition(async () => {
      try {
        const res = await deleteBrand(brandId);
        if (res && !res.success && res.error) {
          setErrorMessage(res.error);
          alert(res.error);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "브랜드 삭제 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <div className="space-y-2 w-full">
      {errorMessage && (
        <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
          {errorMessage}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        {canWrite && (
          <Link
            href={`/portal/brands/${brandId}`}
            className="flex-1 text-center py-2 px-3 rounded-md bg-[#131E2E] text-white font-bold text-xs hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] dark:hover:bg-zinc-100 transition-colors whitespace-nowrap"
          >
            브랜드 수정
          </Link>
        )}

        {canManage && isActive && (
          <ConfirmForm
            action={deactivateBrand.bind(null, brandId)}
            message="정말 이 브랜드를 사용 중단하시겠습니까?\n(사용 중단된 브랜드는 신규 제품 등록 드롭다운에서 제외되며, 기존 등록 상품 정보는 보존됩니다.)"
            className={canWrite ? "flex-1" : "w-full"}
          >
            <button
              type="submit"
              disabled={isPending}
              className="w-full text-center py-2 px-3 rounded-md border border-[#8C1C2B] text-[#8C1C2B] font-bold text-xs hover:bg-[#8C1C2B]/5 transition-colors dark:border-red-500 dark:text-red-400 dark:hover:bg-red-950/20 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isPending ? "처리 중..." : "사용 중단"}
            </button>
          </ConfirmForm>
        )}

        {canManage && !isActive && (
          <>
            <button
              type="button"
              onClick={handleReactivate}
              disabled={isPending}
              className="flex-1 text-center py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors dark:bg-emerald-500 dark:hover:bg-emerald-600 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
            >
              {isPending ? "처리 중..." : "다시 활성화"}
            </button>

            {productCount === 0 ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 text-center py-2 px-3 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                삭제
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 text-center py-2 px-3 rounded-md border border-zinc-200 text-zinc-400 font-bold text-xs dark:border-zinc-800 dark:text-zinc-600 cursor-not-allowed whitespace-nowrap"
                title={`연결된 상품 ${productCount}개가 존재하여 물리 삭제할 수 없습니다.`}
              >
                삭제 (불가)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
