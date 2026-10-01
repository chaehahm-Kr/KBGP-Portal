"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminUpdateBrand,
  adminDeactivateBrand,
  adminReactivateBrand,
  adminDeleteBrand,
} from "@/lib/brand/actions";

export interface AdminBrandDetailData {
  id: string;
  brandCode: string;
  name: string;
  intro: string | null;
  logoUrl: string | null;
  companyId: string;
  companyName: string;
  isActive: boolean;
  hasKr: boolean;
  krNumber: string | null;
  krPath: string | null;
  krUrl: string | null;
  hasUs: boolean;
  usNumber: string | null;
  usPath: string | null;
  usUrl: string | null;
  createdAt: string;
  updatedAt: string;
  productCount: {
    total: number;
    complete: number;
    draft: number;
    deleted: number;
  };
  canEdit: boolean;
  canManage: boolean;
}

interface AdminBrandDetailProps {
  brand: AdminBrandDetailData;
}

export function AdminBrandDetail({ brand }: AdminBrandDetailProps) {
  const router = useRouter();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(brand.name);
  const [editIntro, setEditIntro] = useState(brand.intro || "");
  const [editHasKr, setEditHasKr] = useState(brand.hasKr);
  const [editKrNumber, setEditKrNumber] = useState(brand.krNumber || "");
  const [editHasUs, setEditHasUs] = useState(brand.hasUs);
  const [editUsNumber, setEditUsNumber] = useState(brand.usNumber || "");
  const [deleteKrFile, setDeleteKrFile] = useState(false);
  const [deleteUsFile, setDeleteUsFile] = useState(false);

  const handleDeactivate = async () => {
    if (!confirm(`"${brand.name}" 브랜드를 사용 중단하시겠습니까?\n\n- 기존 상품 기록은 정상 보존됩니다.\n- 신규 상품 등록 시 브랜드 선택에서 제외됩니다.`)) {
      return;
    }
    try {
      setIsSubmitting(true);
      await adminDeactivateBrand(brand.id, brand.companyId);
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "사용 중단 처리 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirm(`"${brand.name}" 브랜드를 재활성화하시겠습니까?`)) {
      return;
    }
    try {
      setIsSubmitting(true);
      await adminReactivateBrand(brand.id, brand.companyId);
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "재활성화 처리 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (brand.productCount.total > 0) {
      alert(`이 브랜드는 ${brand.productCount.total}개의 상품에 연결되어 있어 삭제할 수 없습니다. 더 이상 사용하지 않으려면 [사용 중단]을 선택하세요.`);
      return;
    }
    if (!confirm(`정말 "${brand.name}" 브랜드를 영구 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await adminDeleteBrand(brand.id, brand.companyId);
      if (res && !res.success) {
        alert(res.error || "브랜드 삭제 실패");
      } else {
        router.push("/admin/brands");
      }
    } catch (err: any) {
      alert(err?.message || "브랜드 삭제 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("hasKrTrademark", editHasKr ? "true" : "false");
      formData.set("krTrademarkNumber", editKrNumber);
      formData.set("hasUsTrademark", editHasUs ? "true" : "false");
      formData.set("usTrademarkNumber", editUsNumber);
      if (deleteKrFile) formData.set("deleteKrTrademarkFile", "true");
      if (deleteUsFile) formData.set("deleteUsTrademarkFile", "true");
      if (brand.krPath) formData.set("currentKrTrademarkPath", brand.krPath);
      if (brand.usPath) formData.set("currentUsTrademarkPath", brand.usPath);

      const errRes = await adminUpdateBrand(brand.id, brand.companyId, undefined, formData);
      if (errRes && errRes.error) {
        setErrorMsg(errRes.error);
        setIsSubmitting(false);
        return;
      }

      setIsEditOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "정보 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/brands"
          className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          ← 브랜드 목록으로
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          {/* Logo */}
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt=""
              className="h-16 w-16 rounded-lg border border-zinc-200 object-cover bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex-shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-400 dark:bg-zinc-800 flex-shrink-0">
              LOGO
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Brand Code Badge (Read-Only / Immutable) */}
              <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs font-bold text-zinc-800 border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                {brand.brandCode}
              </span>

              {/* Status Badge */}
              {brand.isActive ? (
                <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-705 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50">
                  사용 중
                </span>
              ) : (
                <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  사용 중단
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-zinc-950 dark:text-white">
              {brand.name}
            </h1>

            {/* Owner Company Link */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              보유 회사:{" "}
              <Link
                href={`/admin/companies/${brand.companyId}`}
                className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {brand.companyName} →
              </Link>
            </p>
          </div>
        </div>

        {/* Header Action Buttons (ACL Controlled) */}
        <div className="flex items-center gap-2 flex-wrap sm:self-start">
          {brand.canEdit && (
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="rounded-lg bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 transition-all cursor-pointer"
            >
              브랜드 정보 수정
            </button>
          )}

          {brand.canManage && (
            <>
              {brand.isActive ? (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={isSubmitting}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  사용 중단
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReactivate}
                  disabled={isSubmitting}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 transition-all cursor-pointer"
                >
                  재활성화
                </button>
              )}

              {brand.productCount.total === 0 && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition-all cursor-pointer"
                >
                  삭제
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Brand Basic Information Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-bold text-zinc-950 dark:text-white border-b border-zinc-150 pb-3 dark:border-zinc-800">
          브랜드 기본 정보
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1 font-medium">브랜드 코드 (Permanent Identifier)</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded inline-block">
              {brand.brandCode}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1 font-medium">브랜드명</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
              {brand.name}
            </span>
          </div>

          <div className="md:col-span-2">
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1 font-medium">브랜드 소개</span>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed border border-zinc-150 dark:border-zinc-850">
              {brand.intro && brand.intro.trim() && !brand.intro.startsWith("__JSON_METADATA__:") ? (
                brand.intro.trim()
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic">등록된 브랜드 소개가 없습니다.</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1 font-medium">등록 및 최초 생성일</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
              {brand.createdAt}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block mb-1 font-medium">최근 정보 수정일</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
              {brand.updatedAt}
            </span>
          </div>
        </div>
      </div>

      {/* Trademark Information Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-150 pb-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
            상표권 정보 (Trademark Ownership)
          </h2>
          <span className="text-[11px] text-zinc-400">
            * K SELECT 브랜드 등록은 법적 상표권 보유를 필수 조건으로 하지 않습니다.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* KR Trademark */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">대한민국 특허청 (KIPO)</span>
              {brand.hasKr ? (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  보유 (등록됨)
                </span>
              ) : (
                <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  미보유 / 출원 중
                </span>
              )}
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-400">상표 등록 번호:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {brand.krNumber || "-"}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-zinc-400">증빙 서류 파일:</span>
                {brand.krUrl ? (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={brand.krUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      [보기]
                    </a>
                    <a
                      href={brand.krUrl}
                      download
                      className="text-xs text-zinc-700 dark:text-zinc-300 font-bold hover:underline"
                    >
                      [다운로드]
                    </a>
                  </div>
                ) : (
                  <span className="text-zinc-400 font-medium">미첨부</span>
                )}
              </div>
            </div>
          </div>

          {/* US USPTO Trademark */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">미국 특허청 (USPTO)</span>
              {brand.hasUs ? (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  보유 (등록됨)
                </span>
              ) : (
                <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  미보유 / 출원 중
                </span>
              )}
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-400">상표 등록 번호:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {brand.usNumber || "-"}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-zinc-400">증빙 서류 파일:</span>
                {brand.usUrl ? (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={brand.usUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      [보기]
                    </a>
                    <a
                      href={brand.usUrl}
                      download
                      className="text-xs text-zinc-700 dark:text-zinc-300 font-bold hover:underline"
                    >
                      [다운로드]
                    </a>
                  </div>
                ) : (
                  <span className="text-zinc-400 font-medium">미첨부</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registered Product Summary Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-150 pb-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
            등록 상품 현황 (Registered Product Summary)
          </h2>
          <span className="text-xs text-zinc-400">
            * 숫자를 클릭하면 해당 브랜드 및 등록 상태별 카탈로그로 이동합니다.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {/* Total */}
          <Link
            href={`/admin/products?brand_id=${brand.id}`}
            className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
          >
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
              전체 Total
            </span>
            <span className="text-2xl font-mono font-bold text-zinc-900 dark:text-white group-hover:underline">
              {brand.productCount.total}
            </span>
          </Link>

          {/* Complete */}
          <Link
            href={`/admin/products?brand_id=${brand.id}&reg_status=active`}
            className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 transition-colors group"
          >
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
              완료 Complete
            </span>
            <span className="text-2xl font-mono font-bold text-emerald-800 dark:text-emerald-300 group-hover:underline">
              {brand.productCount.complete}
            </span>
          </Link>

          {/* Draft */}
          <Link
            href={`/admin/products?brand_id=${brand.id}&reg_status=draft`}
            className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 transition-colors group"
          >
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block mb-1">
              보완 Draft
            </span>
            <span className="text-2xl font-mono font-bold text-rose-800 dark:text-rose-300 group-hover:underline">
              {brand.productCount.draft}
            </span>
          </Link>

          {/* Deleted */}
          <Link
            href={`/admin/products?brand_id=${brand.id}&reg_status=deleted`}
            className="p-4 rounded-xl border border-zinc-200 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-850 transition-colors group"
          >
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
              삭제 Deleted
            </span>
            <span className="text-2xl font-mono font-bold text-zinc-700 dark:text-zinc-300 group-hover:underline">
              {brand.productCount.deleted}
            </span>
          </Link>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                브랜드 정보 수정 (Admin Edit)
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-900">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Brand Code (Immutable) */}
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  브랜드 코드 (Permanent Identifier)
                </label>
                <input
                  type="text"
                  value={brand.brandCode}
                  disabled
                  readOnly
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 font-mono font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  * 브랜드 코드는 변경할 수 없는 고유 운영 식별자입니다.
                </span>
              </div>

              {/* Brand Name */}
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  브랜드명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none bg-white focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white transition-all font-bold"
                />
              </div>

              {/* Brand Intro */}
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  브랜드 소개
                </label>
                <textarea
                  name="intro"
                  value={editIntro}
                  onChange={(e) => setEditIntro(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none bg-white focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white transition-all"
                />
              </div>

              {/* Logo File */}
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  로고 이미지 교체 (선택)
                </label>
                <input
                  type="file"
                  name="logo"
                  accept="image/*"
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-800 dark:file:bg-zinc-800 dark:file:text-zinc-200 hover:file:bg-zinc-200"
                />
              </div>

              {/* KR Trademark Edit Section */}
              <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasKrTrademark"
                    checked={editHasKr}
                    onChange={(e) => setEditHasKr(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <label htmlFor="hasKrTrademark" className="font-bold text-zinc-900 dark:text-white">
                    대한민국 특허청 (KIPO) 상표권 보유
                  </label>
                </div>

                {editHasKr && (
                  <div className="space-y-2 pl-6 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                        상표 등록 번호
                      </label>
                      <input
                        type="text"
                        value={editKrNumber}
                        onChange={(e) => setEditKrNumber(e.target.value)}
                        placeholder="예: 40-1234567-0000"
                        className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 font-mono text-xs bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                        증빙 서류 파일 업로드 (PDF 또는 이미지)
                      </label>
                      <input
                        type="file"
                        name="krTrademarkFile"
                        accept="image/*,application/pdf"
                        className="w-full text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-200"
                      />
                    </div>

                    {brand.krUrl && (
                      <div className="flex items-center gap-2 text-[11px] pt-1">
                        <span className="text-zinc-500">기존 증빙:</span>
                        <a href={brand.krUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                          [보기]
                        </a>
                        <label className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deleteKrFile}
                            onChange={(e) => setDeleteKrFile(e.target.checked)}
                          />
                          기존 증빙 삭제
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* US Trademark Edit Section */}
              <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasUsTrademark"
                    checked={editHasUs}
                    onChange={(e) => setEditHasUs(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <label htmlFor="hasUsTrademark" className="font-bold text-zinc-900 dark:text-white">
                    미국 특허청 (USPTO) 상표권 보유
                  </label>
                </div>

                {editHasUs && (
                  <div className="space-y-2 pl-6 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                        미국 상표 등록 번호
                      </label>
                      <input
                        type="text"
                        value={editUsNumber}
                        onChange={(e) => setEditUsNumber(e.target.value)}
                        placeholder="예: 97812345"
                        className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 font-mono text-xs bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">
                        증빙 서류 파일 업로드 (PDF 또는 이미지)
                      </label>
                      <input
                        type="file"
                        name="usTrademarkFile"
                        accept="image/*,application/pdf"
                        className="w-full text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-200"
                      />
                    </div>

                    {brand.usUrl && (
                      <div className="flex items-center gap-2 text-[11px] pt-1">
                        <span className="text-zinc-500">기존 증빙:</span>
                        <a href={brand.usUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                          [보기]
                        </a>
                        <label className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deleteUsFile}
                            onChange={(e) => setDeleteUsFile(e.target.checked)}
                          />
                          기존 증빙 삭제
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 transition-all"
                >
                  {isSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
