"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  listMarketingSuppressionListAction,
  releaseMarketingSuppressionAction,
  addMarketingSuppressionAction,
} from "@/lib/brand-marketing/campaign-actions";

export interface SuppressionEntry {
  id: string;
  email: string;
  reason: "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINT" | "MANUAL_ADMIN" | string;
  notes?: string | null;
  suppressed_at: string;
  created_by?: string | null;
  status?: "ACTIVE" | "RELEASED" | string;
  released_at?: string | null;
  released_by?: string | null;
  release_reason?: string | null;
  release_evidence?: string | null;
  evidence_type?: string | null;
  policy_validation_notes?: string | null;
}

export function SuppressionListView() {
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RELEASED">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Release Modal State
  const [releaseModalRecord, setReleaseModalRecord] = useState<SuppressionEntry | null>(null);

  // Audit Detail Modal State
  const [auditDetailRecord, setAuditDetailRecord] = useState<SuppressionEntry | null>(null);

  // Add Suppression Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchSuppressions = (
    query: string = search,
    filter: "ALL" | "ACTIVE" | "RELEASED" = statusFilter
  ) => {
    setIsLoading(true);
    setError(null);
    startTransition(async () => {
      try {
        const res = await listMarketingSuppressionListAction(query, filter);
        if (res.success && res.suppressions) {
          setSuppressions(res.suppressions);
        } else {
          setError(res.error || "수신 거부 목록을 불러오지 못했습니다.");
        }
      } catch (err: any) {
        setError(err.message || "목록 조회 중 예외가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchSuppressions(search, statusFilter);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppressions(search, statusFilter);
  };

  const getReasonBadge = (reason: string) => {
    switch (reason?.toUpperCase()) {
      case "UNSUBSCRIBED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            수신 거부 (UNSUBSCRIBED)
          </span>
        );
      case "BOUNCED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
            영구 반송 (BOUNCED)
          </span>
        );
      case "COMPLAINT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900">
            스팸 신고 (COMPLAINT)
          </span>
        );
      case "MANUAL_ADMIN":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            관리자 등록 (MANUAL)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            {reason || "UNKNOWN"}
          </span>
        );
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === "RELEASED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          안전 해제됨 (RELEASED)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        차단 중 (ACTIVE)
      </span>
    );
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  const activeCount = suppressions.filter(
    (item) => (item.status || "ACTIVE") !== "RELEASED"
  ).length;
  const releasedCount = suppressions.filter(
    (item) => item.status === "RELEASED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                수신 거부 목록 (Suppression List)
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded border border-stone-200 dark:border-stone-700">
                총 {suppressions.length}건
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              이메일 수신 거부(Unsubscribe), 반송(Bounce) 및 발송 제외된 주소 목록입니다.
              법적 규정(CAN-SPAM / 한국 정보통신망법)에 따라 마케팅 캠페인 발송 대상에서 자동으로 영구 제외(Fail-Closed)되며,
              명시적 재수신 동의 증빙이 확보된 경우에만 관리자에 의해 안전 해제(Safe Release)될 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>+</span> 수신 거부 직접 등록
            </button>
            <button
              type="button"
              onClick={() => fetchSuppressions(search, statusFilter)}
              disabled={isLoading || isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer disabled:opacity-50"
            >
              {isLoading || isPending ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
        </div>

        {/* Status Filter & Search Controls */}
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              전체 ({suppressions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              차단 중 ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("RELEASED")}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                statusFilter === "RELEASED"
                  ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              안전 해제됨 ({releasedCount})
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이메일 주소로 검색..."
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    fetchSuppressions("", statusFilter);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition cursor-pointer"
            >
              검색
            </button>
          </form>
        </div>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">✓</span>
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
          >
            닫기
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Suppression Records Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
              <tr>
                <th className="py-3 px-4">이메일 주소</th>
                <th className="py-3 px-4">상태</th>
                <th className="py-3 px-4">거부 사유</th>
                <th className="py-3 px-4">등록 일시 (UTC / 로컬)</th>
                <th className="py-3 px-4">등록 출처</th>
                <th className="py-3 px-4">사유 / 증빙 / 해제 정보</th>
                <th className="py-3 px-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading && suppressions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    수신 거부 목록을 조회하는 중입니다...
                  </td>
                </tr>
              ) : suppressions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    {search
                      ? `"${search}" 검색 조건과 일치하는 수신 거부 내역이 없습니다.`
                      : statusFilter === "RELEASED"
                      ? "해제 처리된 수신 거부 내역이 없습니다."
                      : "등록된 수신 거부 주소가 없습니다."}
                  </td>
                </tr>
              ) : (
                suppressions.map((item) => {
                  const isReleased = item.status === "RELEASED";
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {item.email}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4">{getReasonBadge(item.reason)}</td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {formatDate(item.suppressed_at)}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {item.created_by || "system:unsubscribe_flow"}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 max-w-xs">
                        {isReleased ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                              해제자: {item.released_by || "admin"}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate">
                              사유: {item.release_reason || "-"}
                            </div>
                            {item.release_evidence && (
                              <div className="text-[10px] text-zinc-400 truncate">
                                증빙: {item.release_evidence}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="truncate">{item.notes || "-"}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isReleased ? (
                          <button
                            type="button"
                            onClick={() => setAuditDetailRecord(item)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
                          >
                            감사 정보 ℹ
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReleaseModalRecord(item)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-white hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-2xs"
                          >
                            안전 해제 🔓
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            * 법적 보존 정책에 따라 모든 수신 거부 및 안전 해제 내역은 삭제되지 않고 영구 감사 로그로 보존됩니다.
          </span>
          <span className="font-mono text-zinc-400 shrink-0">
            Fail-Closed Invariant: Active
          </span>
        </div>
      </div>

      {/* Safe Release Confirmation Modal */}
      {releaseModalRecord && (
        <SafeReleaseModal
          record={releaseModalRecord}
          onClose={() => setReleaseModalRecord(null)}
          onSuccess={(releasedRecord) => {
            setReleaseModalRecord(null);
            setSuccessBanner(
              `[${releasedRecord.email}] 주소가 안전하게 해제되었습니다. 감사 로그가 보존되었습니다.`
            );
            fetchSuppressions(search, statusFilter);
          }}
        />
      )}

      {/* Add Suppression Modal */}
      {showAddModal && (
        <AddSuppressionModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(email) => {
            setShowAddModal(false);
            setSuccessBanner(`수신 거부 목록에 등록되었습니다: ${email}`);
            fetchSuppressions(search, statusFilter);
          }}
        />
      )}

      {/* Audit Detail Modal */}
      {auditDetailRecord && (
        <AuditDetailModal
          record={auditDetailRecord}
          onClose={() => setAuditDetailRecord(null)}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// SUB-COMPONENT: Safe Release Modal
// ------------------------------------------------------------------------------
interface SafeReleaseModalProps {
  record: SuppressionEntry;
  onClose: () => void;
  onSuccess: (updatedRecord: any) => void;
}

function SafeReleaseModal({ record, onClose, onSuccess }: SafeReleaseModalProps) {
  const [releaseReason, setReleaseReason] = useState("");
  const [evidenceType, setEvidenceType] = useState<
    | "WRITTEN_CONSENT_EMAIL"
    | "CUSTOMER_PORTAL_REQUEST"
    | "SUPPORT_TICKET"
    | "PHONE_VERIFICATION"
    | "ADMIN_ERROR_CORRECTION"
    | "INTERNAL_TESTING"
  >("WRITTEN_CONSENT_EMAIL");
  const [releaseEvidence, setReleaseEvidence] = useState("");
  const [policyValidationNotes, setPolicyValidationNotes] = useState("");
  const [policyValidationConfirmed, setPolicyValidationConfirmed] = useState(false);
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const upperReason = (record.reason || "").toUpperCase();
  const isHighRisk = upperReason === "BOUNCED" || upperReason === "COMPLAINT";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!releaseReason.trim() || releaseReason.trim().length < 5) {
      setModalError("해제 사유를 최소 5자 이상 구체적으로 입력해주세요.");
      return;
    }

    if (!releaseEvidence.trim() || releaseEvidence.trim().length < 5) {
      setModalError("재수신 동의 증빙 또는 오등록 근거를 최소 5자 이상 입력해주세요.");
      return;
    }

    if (isHighRisk) {
      if (!policyValidationConfirmed) {
        setModalError(
          "영구 반송 또는 스팸 신고 주소는 발송 평판 정책 검증 확인 동의가 필수입니다."
        );
        return;
      }
      if (!policyValidationNotes.trim() || policyValidationNotes.trim().length < 10) {
        setModalError(
          "영구 반송 또는 스팸 신고 주소는 10자 이상의 상세 정책 소명이 필수입니다."
        );
        return;
      }
    }

    if (!confirmAcknowledged) {
      setModalError("소명 및 재수신 동의 사실 확인 체크박스에 동의해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await releaseMarketingSuppressionAction({
        id: record.id,
        email: record.email,
        releaseReason: releaseReason.trim(),
        releaseEvidence: releaseEvidence.trim(),
        evidenceType,
        policyValidationNotes: isHighRisk ? policyValidationNotes.trim() : undefined,
        policyValidationConfirmed: isHighRisk ? policyValidationConfirmed : undefined,
      });

      if (res.success && res.record) {
        onSuccess(res.record);
      } else {
        setModalError(res.error || "해제 처리에 실패했습니다.");
      }
    } catch (err: any) {
      setModalError(err.message || "해제 요청 중 예외가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              🔓
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              수신 거부 안전 해제 (Safe Release)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Target Email Summary */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">대상 이메일:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {record.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">현재 거부 사유:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {record.reason}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">등록 일시:</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {new Date(record.suppressed_at).toLocaleString("ko-KR")}
              </span>
            </div>
          </div>

          {/* Policy Risk Warning Banner */}
          {isHighRisk ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>고위험 발송 평판 보호 정책 (Elevated Policy Gate)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                해당 주소는 영구 반송(BOUNCED) 또는 스팸 신고(COMPLAINT)로 차단되었습니다.
                해제 후 재발송 시 도메인 평판 하락 및 IP 블랙리스트 위험이 발생하므로,
                메일서버 정상화 또는 오신고 소명이 완벽히 검증된 경우에만 승인할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <div className="font-semibold">법적 재수신 동의 안내</div>
              <p className="text-[11px] leading-relaxed">
                정보통신망법 및 CAN-SPAM 법규에 따라, 수신자의 명시적인 사전 재수신 동의(Opt-In) 서면
                또는 관리자 오등록 소명이 확보되어야 법적 책임이 면책됩니다.
              </p>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              해제 사유 (Reason for Release) *
            </label>
            <input
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="예: 고객 요청에 의한 재수신 동의 확인 완료 / 오등록 정정"
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              required
            />
          </div>

          {/* Evidence Type Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              소명 증빙 유형 (Evidence Source Type) *
            </label>
            <select
              value={evidenceType}
              onChange={(e: any) => setEvidenceType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer"
            >
              <option value="WRITTEN_CONSENT_EMAIL">수신자 서면 이메일 재수신 요청 (Written Consent Email)</option>
              <option value="SUPPORT_TICKET">고객센터 지원 티켓 확인 (Support Ticket #)</option>
              <option value="CUSTOMER_PORTAL_REQUEST">고객사 포털 직접 요청 (Customer Portal Request)</option>
              <option value="PHONE_VERIFICATION">유선 통화 확인 (Phone Verification)</option>
              <option value="ADMIN_ERROR_CORRECTION">관리자 오등록 정정 소명 (Admin Error Correction)</option>
              <option value="INTERNAL_TESTING">내부 테스트/스테이징 검증 (Internal Testing)</option>
            </select>
          </div>

          {/* Evidence Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              소명 증빙 / 재수신 동의 근거 (Evidence / Verification) *
            </label>
            <textarea
              rows={2}
              value={releaseEvidence}
              onChange={(e) => setReleaseEvidence(e.target.value)}
              placeholder="예: 서면 동의 이메일 (2026-11-01 수신), 상담 티켓 #1042 확인, 담당자 통화 메모..."
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              required
            />
          </div>

          {/* High-Risk Policy Validation Notes */}
          {isHighRisk && (
            <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/60">
              <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200">
                발송 평판 검증 소명 (Policy Validation Notes) *
              </label>
              <textarea
                rows={2}
                value={policyValidationNotes}
                onChange={(e) => setPolicyValidationNotes(e.target.value)}
                placeholder="도메인 MX 레코드 정상 복구 확인, 수신 서버 스팸필터 예외 등록 확인 등 구체적 검증 내용 (최소 10자)..."
                className="w-full px-3 py-2 text-xs rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              />
              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyValidationConfirmed}
                  onChange={(e) => setPolicyValidationConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-[11px] text-amber-900 dark:text-amber-300 font-medium">
                  발송 평판 리스크를 확인하였으며, 메일박스 정상화 및 재발송 기준(Policy Validation)을 충족함을 검증하였습니다.
                </span>
              </label>
            </div>
          )}

          {/* Acknowledgement Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmAcknowledged}
                onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug">
                위 소명 및 재수신 동의 내역이 사실임을 확인하며, 안전 해제 처리를 승인합니다.
                (모든 해제 내역은 감사 로그로 영구 기록됩니다.)
              </span>
            </label>
          </div>

          {/* Error inside modal */}
          {modalError && (
            <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-400">
              {modalError}
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !confirmAcknowledged}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "해제 처리 중..." : "안전 해제 승인 실행"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// SUB-COMPONENT: Audit Detail Modal
// ------------------------------------------------------------------------------
interface AuditDetailModalProps {
  record: SuppressionEntry;
  onClose: () => void;
  formatDate: (iso?: string | null) => string;
}

function AuditDetailModal({ record, onClose, formatDate }: AuditDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              ✓
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              수신 거부 해제 감사 내역 (Audit Trail)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-500">이메일:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {record.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">원 거부 사유:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {record.reason}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">원 차단 일시:</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {formatDate(record.suppressed_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">원 등록 출처:</span>
              <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                {record.created_by || "system"}
              </span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg space-y-2">
            <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>안전 해제 정보</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-mono">
                IMMUTABLE AUDIT
              </span>
            </div>
            <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500">해제 승인자:</span>
              <span className="font-semibold">{record.released_by || "admin"}</span>
            </div>
            <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500">해제 일시:</span>
              <span>{formatDate(record.released_at)}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/40">
              <div className="text-zinc-500 font-medium">해제 사유:</div>
              <div className="mt-0.5 p-2 bg-white dark:bg-zinc-800 rounded border border-emerald-100 dark:border-emerald-900/40">
                {record.release_reason || "-"}
              </div>
            </div>
            {record.release_evidence && (
              <div className="text-zinc-700 dark:text-zinc-300">
                <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500">증빙 유형:</span>
              <span className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                {record.evidence_type || "WRITTEN_CONSENT_EMAIL"}
              </span>
            </div>
            <div className="text-zinc-500 font-medium">소명 증빙:</div>
                <div className="mt-0.5 p-2 bg-white dark:bg-zinc-800 rounded border border-emerald-100 dark:border-emerald-900/40 font-mono text-[11px]">
                  {record.release_evidence}
                </div>
              </div>
            )}
            {record.policy_validation_notes && (
              <div className="text-zinc-700 dark:text-zinc-300">
                <div className="text-amber-700 dark:text-amber-400 font-semibold">
                  정책 검증 소명 (Policy Validation):
                </div>
                <div className="mt-0.5 p-2 bg-amber-50/80 dark:bg-amber-950/40 rounded border border-amber-200 dark:border-amber-800 font-mono text-[11px] text-amber-900 dark:text-amber-200">
                  {record.policy_validation_notes}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition cursor-pointer"
          >
            확인 닫기
          </button>
        </div>
      </div>
    </div>
  );
}


function AddSuppressionModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<string>("MANUAL_ADMIN");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("유효한 이메일 주소를 입력해주세요.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await addMarketingSuppressionAction({
        email: email.trim(),
        reason,
        notes: notes.trim() || undefined,
        source: "admin_portal",
      });

      if (res.success) {
        onSuccess(email.trim());
      } else {
        setErrorMessage(res.error || "수신 거부 등록에 실패했습니다.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              수신 거부 직접 등록 (Add Suppression)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300">
              ⚠️ {errorMessage}
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              이메일 주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. buyer@company.com"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              등록된 이메일 주소는 모든 마케팅 이메일 발송 대상에서 자동으로 즉시 제외(Fail-Closed)됩니다.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              차단 사유 (Suppression Reason)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="MANUAL_ADMIN">관리자 수기 차단 (MANUAL_ADMIN)</option>
              <option value="UNSUBSCRIBED">수신 거부 요청 (UNSUBSCRIBED)</option>
              <option value="BOUNCED">반송 / 무효 주소 (BOUNCED)</option>
              <option value="COMPLAINT">스팸 신고 (COMPLAINT)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              등록 사유 및 증빙 메모 (Notes)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 유선 통화로 마케팅 메일 수신 거부 요청함, 또는 바이어 탈퇴 요청"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? "등록 중..." : "수신 거부 등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
