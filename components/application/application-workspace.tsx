"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  APPLICATION_STATUS_LABEL,
  SELF_CHECK_ITEMS,
  type ApplicationStatus,
  type ApplicationProductReviewStatus
} from "@/lib/application/types";
import { ReviewProductForm } from "@/components/application/review-product-form";
import { AssignApplicationForm } from "@/components/application/assign-application-form";
import { AddReviewNoteForm } from "@/components/application/add-review-note-form";
import { CreateInfoRequestForm } from "@/components/application/create-info-request-form";
import { sendPortalInvitationAction } from "@/lib/company/admin-actions";
import { getPersonDisplayName } from "@/lib/user/name-helper";

interface ApplicationWorkspaceProps {
  application: any;
  company: any;
  companyUsers?: any[];
  brands?: any[];
  inquiry?: any;
  submittedProducts?: any[];
  linkRows: any[];
  productNameById: Map<string, string>;
  infoRequestRows: any[];
  infoRequestAttachmentUrls: (string | null)[];
  staffMembers: any[];
  currentAssignment: any;
  staffNameById: Map<string, string>;
  reviewNoteRows: any[];
  activityLogRows: any[];
  canReview: boolean;
  isSuperAdmin: boolean;
  canDelete?: boolean;
  userId: string;
  // Actions
  reviewAction: any;
  assignAction: any;
  noteAddAction: any;
  noteDeleteAction: any;
  infoRequestAction: any;
  deleteAction?: any;
  approveAndInviteAction?: any;
  rejectAppAction?: any;
  resendInviteAction?: any;
  revokeInviteAction?: any;
  resendRejectionAction?: any;
}

export default function ApplicationWorkspace({
  application,
  company,
  companyUsers = [],
  brands = [],
  inquiry = null,
  submittedProducts = [],
  linkRows,
  productNameById,
  infoRequestRows,
  infoRequestAttachmentUrls,
  staffMembers,
  currentAssignment,
  staffNameById,
  reviewNoteRows,
  activityLogRows,
  canReview,
  isSuperAdmin,
  canDelete = false,
  userId,
  reviewAction,
  assignAction,
  noteAddAction,
  noteDeleteAction,
  infoRequestAction,
  deleteAction,
  approveAndInviteAction,
  rejectAppAction,
  resendInviteAction,
  revokeInviteAction,
  resendRejectionAction,
}: ApplicationWorkspaceProps) {
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Approval & Invitation Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");
  const [isSubmittingApprove, setIsSubmittingApprove] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccessToast, setApproveSuccessToast] = useState<string | null>(null);

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectInternalNote, setRejectInternalNote] = useState("");
  const [rejectApplicantMessage, setRejectApplicantMessage] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectSuccessToast, setRejectSuccessToast] = useState<string | null>(null);

  const handleOpenApproveModal = () => {
    if (!approveAndInviteAction) return;
    setApprovalNote("");
    setApproveError(null);
    setIsApproveModalOpen(true);
  };

  const handleConfirmApproveAndInvite = async () => {
    if (!approveAndInviteAction || isSubmittingApprove) return;
    setIsSubmittingApprove(true);
    setApproveError(null);

    try {
      const noteToPass = approvalNote.trim();
      const res = await approveAndInviteAction(noteToPass);
      if (res?.success) {
        setIsApproveModalOpen(false);
        setApproveSuccessToast(res.message || "승인 및 파트너 초대가 완료되었습니다.");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        const errorMsg = res?.error || "승인/초대 처리 중 알 수 없는 오류가 발생했습니다.";
        setApproveError(errorMsg);
        console.error("[approveAndInviteApplication] Server error:", res);
      }
    } catch (err: any) {
      console.error("[approveAndInviteApplication] Exception:", err);
      setApproveError(err.message || "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  const handleOpenRejectModal = () => {
    if (!rejectAppAction) return;
    setRejectInternalNote("");
    setRejectApplicantMessage("");
    setRejectError(null);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectAppAction || isSubmittingReject) return;
    if (!rejectInternalNote.trim()) {
      setRejectError("내부 심사 반려 사유(Internal Note)를 입력해 주세요 (필수).");
      return;
    }

    setIsSubmittingReject(true);
    setRejectError(null);

    try {
      const res = await rejectAppAction(rejectInternalNote.trim(), rejectApplicantMessage.trim());
      if (res?.success) {
        setIsRejectModalOpen(false);
        setRejectSuccessToast(res.message || "신청서가 반려 처리되고 안내 메일이 발송되었습니다.");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        const errorMsg = res?.error || "반려 처리 중 알 수 없는 오류가 발생했습니다.";
        setRejectError(errorMsg);
        console.error("[rejectApplication] Server error:", res);
      }
    } catch (err: any) {
      console.error("[rejectApplication] Exception:", err);
      setRejectError(err.message || "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleResendInvite = async () => {
    if (!resendInviteAction) return;
    if (!confirm("이 파트너사에게 초대장을 재발송하시겠습니까?")) return;

    setIsProcessingAction(true);
    try {
      const res = await resendInviteAction();
      if (res?.success) {
        alert(res.message || "초대장을 재발송했습니다.");
        window.location.reload();
      } else {
        alert("초대장 재발송 실패: " + (res?.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("오류 발생: " + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleResendRejectionEmail = async () => {
    if (!resendRejectionAction) return;
    if (!confirm("신청자에게 거절 안내 이메일을 다시 발송하시겠습니까?")) return;

    setIsProcessingAction(true);
    try {
      const res = await resendRejectionAction();
      if (res?.success) {
        alert(res.message || "거절 안내 이메일을 재발송했습니다.");
        window.location.reload();
      } else {
        alert("거절 안내 이메일 재발송 실패: " + (res?.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("오류 발생: " + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!revokeInviteAction) return;
    if (!confirm("⚠️ 정말로 발송된 초대장을 취소/회수하시겠습니까? (기존 초대 링크는 즉시 무효화되며 신청서가 초기 심사 상태로 돌아갑니다)")) return;

    setIsProcessingAction(true);
    try {
      const res = await revokeInviteAction();
      if (res?.success) {
        alert(res.message || "초대장이 취소되었으며, 신청서가 초기 심사(접수/검토) 상태로 복구되었습니다.");
        window.location.reload();
      } else {
        alert("초대장 취소 실패: " + (res?.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("오류 발생: " + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const [activeTab, setActiveTab] = useState<
    "overview" | "review" | "communication" | "activity"
  >("overview");

  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());

  const handleSendInvite = async (companyUserId: string) => {
    if (invitingIds.has(companyUserId)) return;
    setInvitingIds((prev) => {
      const next = new Set(prev);
      next.add(companyUserId);
      return next;
    });
    try {
      await sendPortalInvitationAction(companyUserId);
      alert("포털 가입 요청 이메일을 성공적으로 발송했습니다.");
    } catch (err: any) {
      alert("요청 발송 중 오류가 발생했습니다: " + err.message);
    } finally {
      setInvitingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyUserId);
        return next;
      });
    }
  };

  // Parse company metadata
  let parsedMeta = {
    description: company?.intro || "",
    address: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    zip_code: "",
    country: company?.country || "대한민국",
    website: "",
    contacts: [] as any[],
    type: "Brand Owner",
  };

  if (company?.intro && company.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      const jsonStr = company.intro.substring("__COMPANY_METADATA__:".length);
      const data = JSON.parse(jsonStr);
      parsedMeta = {
        description: data.description || "",
        address: data.address || "",
        address_1: data.address_1 || "",
        address_2: data.address_2 || "",
        city: data.city || "",
        state: data.state || "",
        zip_code: data.zip_code || "",
        country: data.country || company?.country || "대한민국",
        website: data.website || "",
        contacts: data.contacts || [],
        type: data.type || "Brand Owner",
      };
    } catch (e) {
      console.error("Error parsing company metadata in workspace:", e);
    }
  }

  // Resolve structured address
  let structuredAddress = {
    country: company?.country || parsedMeta.country || "대한민국",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    fullFormatted: "",
  };

  if (application?.applicant_address) {
    if (typeof application.applicant_address === "object") {
      structuredAddress = {
        country: application.applicant_address.country || company?.country || parsedMeta.country || "대한민국",
        address1:
          application.applicant_address.address_line_1 ||
          application.applicant_address.street ||
          application.applicant_address.address ||
          "",
        address2: application.applicant_address.address_line_2 || "",
        city: application.applicant_address.city || "",
        state: application.applicant_address.state || "",
        postalCode: application.applicant_address.postal_code || application.applicant_address.zip || "",
        fullFormatted: application.applicant_address.formatted || "",
      };
    } else if (typeof application.applicant_address === "string") {
      try {
        const parsed = JSON.parse(application.applicant_address);
        structuredAddress = {
          country: parsed.country || company?.country || parsedMeta.country || "대한민국",
          address1: parsed.address_line_1 || parsed.street || parsed.address || "",
          address2: parsed.address_line_2 || "",
          city: parsed.city || "",
          state: parsed.state || "",
          postalCode: parsed.postal_code || parsed.zip || "",
          fullFormatted: parsed.formatted || "",
        };
      } catch {
        structuredAddress.address1 = application.applicant_address;
        structuredAddress.fullFormatted = application.applicant_address;
      }
    }
  }

  if (!structuredAddress.address1 && parsedMeta.address_1) {
    structuredAddress.address1 = parsedMeta.address_1;
    structuredAddress.address2 = parsedMeta.address_2 || "";
    structuredAddress.city = parsedMeta.city || "";
    structuredAddress.state = parsedMeta.state || "";
    structuredAddress.postalCode = parsedMeta.zip_code || "";
  } else if (!structuredAddress.address1 && parsedMeta.address) {
    structuredAddress.address1 = parsedMeta.address;
  }

  if (!structuredAddress.address1 && inquiry?.company_address) {
    if (typeof inquiry.company_address === "object") {
      structuredAddress.address1 = inquiry.company_address.address_line_1 || inquiry.company_address.address || "";
      structuredAddress.address2 = inquiry.company_address.address_line_2 || "";
      structuredAddress.city = inquiry.company_address.city || "";
      structuredAddress.state = inquiry.company_address.state || "";
      structuredAddress.postalCode = inquiry.company_address.postal_code || inquiry.company_address.zip || "";
    } else {
      structuredAddress.address1 = String(inquiry.company_address);
    }
  }

  if (!structuredAddress.fullFormatted) {
    const parts = [
      structuredAddress.address1,
      structuredAddress.address2,
      structuredAddress.city,
      structuredAddress.state,
      structuredAddress.postalCode,
      structuredAddress.country !== "대한민국" ? structuredAddress.country : "",
    ].filter(Boolean);
    structuredAddress.fullFormatted = parts.length > 0 ? parts.join(", ") : "-";
  }

  // Display values
  const displayCompanyName =
    company?.name || application.applicant_company_name || inquiry?.brand_name || "-";
  const displayBrandName =
    inquiry?.brand_name || brands?.[0]?.name || company?.name || application.applicant_company_name || "-";
  const displayWebsite = inquiry?.homepage || brands?.[0]?.website || parsedMeta.website || "";
  const displayBRN = company?.business_registration_number || "-";

  const primaryUser = companyUsers?.find((u) => u.is_primary) || companyUsers?.[0];
  const primaryContactFromMeta = parsedMeta.contacts?.find((c) => c.isPrimary) || parsedMeta.contacts?.[0];
  const displayContactName =
    (primaryUser && getPersonDisplayName(primaryUser)) ||
    (primaryContactFromMeta && getPersonDisplayName(primaryContactFromMeta)) ||
    getPersonDisplayName({ name: company?.contact_name || application.applicant_contact_name, email: application.applicant_contact_email }) ||
    company?.contact_name ||
    application.applicant_contact_name ||
    "-";
  const displayContactTitle =
    inquiry?.contact_title ||
    companyUsers?.[0]?.title ||
    companyUsers?.[0]?.position ||
    parsedMeta.contacts?.[0]?.title ||
    "대표/담당자";
  const displayContactEmail = application.applicant_contact_email || companyUsers?.[0]?.email || "-";
  const displayContactPhone =
    application.applicant_contact_phone || company?.contact_phone || companyUsers?.[0]?.phone || "-";

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const CATEGORY_LABEL_MAP: Record<string, string> = {
    skincare: "스킨케어",
    hair_scalp: "헤어/두피",
    beauty_tools: "미용기기",
    wellness_patch: "웰니스 패치",
    daily_care: "데일리 케어",
  };

  const getProductHistory = (linkId: string) => {
    const history: { status: string; label: string; time: string; reason: string | null; dateObj: Date }[] = [];

    if (application.submitted_at) {
      const submittedDate = new Date(application.submitted_at);
      history.push({
        status: "submitted",
        label: "접수 완료",
        time: submittedDate.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
        reason: null,
        dateObj: submittedDate,
      });
    }

    const productLogs = activityLogRows.filter(
      (log) => log.entity_type === "application_product" && log.entity_id === linkId
    );

    const STATUS_MAP: Record<string, string> = {
      pending: "심사 대기",
      reviewing: "심사 진행 중",
      info_requested: "보완 요청",
      on_hold: "심사 보류",
      rejected: "심사 반려",
      approved: "심사 승인",
    };

    productLogs.forEach((log) => {
      const logDate = new Date(log.created_at);
      history.push({
        status: log.after_state,
        label: STATUS_MAP[log.after_state] || log.after_state,
        time: logDate.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
        reason: log.reason || null,
        dateObj: logDate,
      });
    });

    return history.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  };

  const [scores, setScores] = useState<Record<string, number>>({
    differentiation: 8,
    marketPotential: 7,
    pricing: 9,
    packaging: 8,
    regulatory: 7,
    capacity: 8,
    marketing: 6,
    retail: 7,
    amazon: 8,
    responsiveness: 9,
  });

  const handleScoreChange = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const calculateWeightedScore = () => {
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    return (sum / Object.keys(scores).length).toFixed(1);
  };

  const getRecommendation = (score: number) => {
    if (score >= 9.0) return "Strongly Recommend";
    if (score >= 8.0) return "Recommend";
    if (score >= 7.0) return "Conditional";
    if (score >= 5.0) return "Hold";
    return "Do Not Recommend";
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteApplication = async () => {
    if (
      !confirm(
        `⚠️ [경고] 정말로 이 입점 신청서(${application.application_number})를 삭제하시겠습니까?\n삭제된 신청서는 기본 목록에서 제외되며 필터에서 '삭제 포함'을 체크해야만 조회할 수 있습니다.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteAction) {
        await deleteAction(application.id);
      }
    } catch (err: any) {
      if (err.digest?.startsWith("NEXT_REDIRECT") || err.message?.includes("NEXT_REDIRECT")) {
        return;
      }
      alert("삭제 중 오류가 발생했습니다: " + (err.message || ""));
      setIsDeleting(false);
    }
  };

  const weightedScore = parseFloat(calculateWeightedScore());

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-mono font-extrabold text-zinc-950 dark:text-white">
                {application.application_number}
              </span>
              <span className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold border ${
                application.status === "approved" || application.status === "invitation_sent"
                  ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300"
                  : application.status === "onboarded"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : application.status === "rejected"
                  ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
                  : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300"
              }`}>
                {application.status === "approved" || application.status === "invitation_sent"
                  ? "승인 완료 · 초대 발송됨"
                  : application.status === "onboarded"
                  ? "포털 계정 활성화 완료"
                  : APPLICATION_STATUS_LABEL[application.status as ApplicationStatus] || application.status}
              </span>

              {/* Partner Type Badge */}
              {application.partner_type === "retailer" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                  🏪 Retailer Partner
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200">
                  🏷️ Brand Partner
                </span>
              )}

              {/* Entry Mode Badge */}
              {application.entry_mode === "admin_invitation" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200">
                  ⚡ Admin Invitation
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  🌐 Public Application
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              회사명: <span className="font-bold text-zinc-950 dark:text-white">{displayCompanyName}</span> · 
              주 담당자: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{displayContactName} ({displayContactEmail})</span> · 
              접수일: {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : "-"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-2">
              심사 담당: <span className="font-bold text-zinc-800 dark:text-zinc-200">{currentAssignment ? staffNameById.get(currentAssignment.staff_id) : "미지정 (Unassigned)"}</span>
            </span>

            {/* Action 1: Approve & Invite (Only for submitted / under_review / pending / assigned) */}
            {approveAndInviteAction &&
              (application.status === "submitted" ||
                application.status === "under_review" ||
                application.status === "pending" ||
                application.status === "assigned" ||
                application.status === "draft") && (
                <button
                  type="button"
                  onClick={handleOpenApproveModal}
                  disabled={isProcessingAction || isSubmittingApprove}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApprove ? "Approving & Sending..." : "✓ Approve & Invite Partner"}
                </button>
              )}

            {/* Action 2: Reject (Only for submitted / under_review / pending / assigned) */}
            {rejectAppAction &&
              (application.status === "submitted" ||
                application.status === "under_review" ||
                application.status === "pending" ||
                application.status === "assigned" ||
                application.status === "draft") && (
                <button
                  type="button"
                  onClick={handleOpenRejectModal}
                  disabled={isProcessingAction}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  ✕ Reject Application
                </button>
              )}

            {/* Action: Resend Invite (When approved / invitation_sent) */}
            {resendInviteAction &&
              (application.status === "invitation_sent" || application.status === "approved") && (
                <button
                  type="button"
                  onClick={handleResendInvite}
                  disabled={isProcessingAction}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  📨 Resend Invitation
                </button>
              )}

            {/* Action: Revoke Invite (When approved / invitation_sent) */}
            {revokeInviteAction &&
              (application.status === "invitation_sent" || application.status === "approved") && (
                <button
                  type="button"
                  onClick={handleRevokeInvite}
                  disabled={isProcessingAction}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  🚫 Revoke Invitation
                </button>
              )}

            {/* Action: Resend Rejection Email (When rejected) */}
            {resendRejectionAction && application.status === "rejected" && (
              <button
                type="button"
                onClick={handleResendRejectionEmail}
                disabled={isProcessingAction}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                📨 Resend Rejection Email
              </button>
            )}

            {/* Open Company / Retailer 360 link if onboarded / linked */}
            {(company?.id || application.onboarded_company_id) && (
              <Link
                href={application.partner_type === "retailer" ? `/admin/retailers/${company?.id || application.onboarded_company_id}` : `/admin/companies/${company?.id || application.onboarded_company_id}`}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                {application.partner_type === "retailer" ? "Open Retailer 360 →" : "Open Company →"}
              </Link>
            )}

            {canDelete && (
              <button
                onClick={handleDeleteApplication}
                disabled={isDeleting}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "🗑️ Delete"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2 -mb-px text-xs font-medium">
          {[
            { id: "overview", label: "개요 (Overview)" },
            { id: "review", label: "채점 및 권고 (Scoring)" },
            { id: "communication", label: "의견/자료요청 (Communication)" },
            { id: "activity", label: "활동 이력 (History)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-bold"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left 2 Columns: 3 Core Information Groups */}
            <div className="lg:col-span-2 space-y-6">
              {/* Group 1: Company Information Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-xs">
                <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏢</span>
                    <span>1. 회사 정보 (Company Information)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">회사명</span>
                    <span className="font-bold text-zinc-900 dark:text-white text-sm">{displayCompanyName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">사업자등록번호</span>
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{displayBRN}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">대표 브랜드명</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{displayBrandName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">국가</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{structuredAddress.country}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">기본 주소 (Address Line 1)</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{structuredAddress.address1 || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">상세 주소 (Address Line 2)</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{structuredAddress.address2 || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">도시 (City) / 시·도 (State)</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {[structuredAddress.city, structuredAddress.state].filter(Boolean).join(", ") || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">우편번호 (ZIP / Postal Code)</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{structuredAddress.postalCode || "-"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">웹사이트 / 판매채널 URL</span>
                    {displayWebsite ? (
                      <a
                        href={displayWebsite.startsWith("http") ? displayWebsite : `https://${displayWebsite}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 break-all mt-0.5"
                      >
                        <span>{displayWebsite}</span>
                        <span className="text-[10px]">↗</span>
                      </a>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </div>
                </div>

                {parsedMeta.description && (
                  <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                    <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                      회사 소개 (Company Intro)
                    </span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {parsedMeta.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Group 2: Contact Information Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>👤</span>
                    <span>2. 담당자 정보 (Contact Information)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">주 담당자 성명</span>
                    <span className="font-bold text-zinc-900 dark:text-white text-sm">{displayContactName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">직책 / 직함</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{displayContactTitle}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">이메일 (Contact Email)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-semibold text-zinc-900 dark:text-white">{displayContactEmail}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        ✓ 인증 완료
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">연락처 (Phone)</span>
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">{displayContactPhone}</span>
                  </div>
                </div>
              </div>

              {/* Group 3: Submitted Products Cards (Max 3) with Review Controls */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📦</span>
                    <span>3. 신청 제품 정보 및 심사 (Submitted Products & Review · 총 {submittedProducts.length}개)</span>
                  </h3>
                </div>

                {submittedProducts.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">신청된 제품 정보가 없습니다.</p>
                ) : (
                  <div className="space-y-5">
                    {submittedProducts.map((prod, idx) => (
                      <div
                        key={prod.id || idx}
                        className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-3.5"
                      >
                        {/* Product Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-2.5 dark:border-zinc-800">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                              제품 {idx + 1}
                            </span>
                            <span className="font-extrabold text-sm text-zinc-950 dark:text-white">
                              {prod.name}
                            </span>
                            {prod.category && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                                {CATEGORY_LABEL_MAP[prod.category] || prod.category}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              prod.reviewStatus === "approved"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : prod.reviewStatus === "rejected"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : prod.reviewStatus === "on_hold"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}>
                              심사 상태: {prod.reviewStatus === "pending" ? "대기 (Pending)" : prod.reviewStatus}
                            </span>
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">소비자가격 (KRW)</span>
                            <span className="font-extrabold text-zinc-900 dark:text-white text-sm">
                              {prod.retailPriceKrw ? `₩${prod.retailPriceKrw.toLocaleString()}` : "— (미입력)"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">공급희망가격 (USD)</span>
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm font-mono">
                              {prod.targetSupplyPriceUsd ? `$${prod.targetSupplyPriceUsd}` : "— (미입력)"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">카톤/패키지 규격 (W×D×H)</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {prod.packageWidth && prod.packageDepth && prod.packageHeight
                                ? `${prod.packageWidth} × ${prod.packageDepth} × ${prod.packageHeight} ${prod.dimensionUnit || "cm"}`
                                : prod.volume || "— (미입력)"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">패키지 중량</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {prod.packageWeight ? `${prod.packageWeight} ${prod.weightUnit || "g"}` : "— (미입력)"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">월 생산 가능 수량</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {prod.monthlyCapacity ? String(prod.monthlyCapacity) : "— (미입력)"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">리드 타임 (Lead Time)</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {prod.leadTime ? String(prod.leadTime) : "— (미입력)"}
                            </span>
                          </div>
                        </div>

                        {/* Description Note */}
                        {prod.description && (
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                            <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                              제품 설명 / 주요 특징 (Description & Key Points)
                            </span>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                              {prod.description}
                            </p>
                          </div>
                        )}

                        {/* Uploaded Files & Images */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                            첨부 파일 및 이미지 (Attached Files & Images)
                          </span>
                          {prod.images && prod.images.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {prod.images.map((img: any, imgIdx: number) => (
                                <div
                                  key={img.id || imgIdx}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                                >
                                  <span>📎</span>
                                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                                    {img.fileName}
                                  </span>
                                  {img.fileSize && (
                                    <span className="text-[10px] text-zinc-400">
                                      ({formatFileSize(img.fileSize)})
                                    </span>
                                  )}
                                  {img.url && (
                                    <a
                                      href={img.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-1 px-2 py-0.5 rounded bg-zinc-900 text-white font-bold text-[10px] hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
                                    >
                                      다운로드 ↗
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">첨부된 파일 없음</span>
                          )}
                        </div>

                        {/* Review Action Form & History Timeline */}
                        {prod.linkId ? (
                          <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 space-y-3">
                            <ReviewProductForm
                              action={reviewAction.bind(null, prod.linkId, application.id)}
                              productName={prod.name}
                              currentStatus={prod.reviewStatus as ApplicationProductReviewStatus}
                              currentReason={prod.reviewReason}
                              disabled={!canReview}
                            />

                            {/* History Timeline */}
                            <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800 space-y-2">
                              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                                심사 히스토리
                              </h4>
                              <div className="pl-2.5 border-l border-zinc-200 dark:border-zinc-800 space-y-2">
                                {getProductHistory(prod.linkId).map((event, eventIdx) => (
                                  <div key={eventIdx} className="relative text-[11px] text-zinc-500 dark:text-zinc-400">
                                    <div
                                      className={`absolute -left-[14px] top-1.5 h-1.5 w-1.5 rounded-full ${
                                        eventIdx === 0 ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-700"
                                      }`}
                                    />
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span
                                        className={`font-semibold ${
                                          event.status === "approved"
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : event.status === "rejected"
                                            ? "text-rose-600 dark:text-rose-400"
                                            : event.status === "on_hold"
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-zinc-700 dark:text-zinc-300"
                                        }`}
                                      >
                                        [{event.label}]
                                      </span>
                                      <span className="font-mono text-[10px] text-zinc-400">
                                        {event.time}
                                      </span>
                                    </div>
                                    {event.reason && (
                                      <p className="mt-0.5 pl-3 text-xs text-zinc-600 dark:text-zinc-400 italic">
                                        ↳ 사유: {event.reason}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Group 4: Readiness & Self Check Summary */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📋</span>
                    <span>4. 입점 및 운영 준비 사항 (Readiness)</span>
                  </h3>
                </div>

                {(() => {
                  const list = Array.isArray(application.eligibility_responses)
                    ? (application.eligibility_responses as any[])
                    : [];
                  if (list.length === 0) {
                    return <p className="text-xs text-zinc-400 py-2">등록된 준비 사항 데이터가 없습니다.</p>;
                  }

                  const READINESS_MAP: Record<string, string> = {
                    stable_supply: "안정적인 생산 및 공급망 확보",
                    us_regulatory_compliance: "미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비",
                    initial_test_quantity: "초기 파트너십 테스트 물량 공급 의향",
                    north_america_distribution: "북미 온/오프라인 유통 및 가격 정책 동의",
                    joint_marketing: "북미 현지 공동 마케팅 협력 의향",
                    sales_content_support: "상세 페이지 및 현지화 마케팅 콘텐츠 지원",
                    kbeauty_space: "전용 K-Beauty 진열 공간 확보 (Dedicated K-Beauty Space)",
                    staff_education: "스태프 제품 교육 및 루틴 숙지 (Staff Product Education)",
                    weekly_sync: "주간 재고 실사 및 리오더 협력 (Weekly Inventory Sync)",
                    category_mindset: "카테고리 파트너십 및 가격 준수 (Category Partnership Mindset)",
                  };

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {list.map((item, idx) => {
                        const key = item.itemKey || item.key || `item_${idx}`;
                        const title = item.title || READINESS_MAP[key] || key;
                        const isReady = item.response === "available" || item.response === "ready";

                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                              isReady
                                ? "bg-emerald-50/50 border-emerald-100 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300"
                                : "bg-amber-50/50 border-amber-100 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300"
                            }`}
                          >
                            <span className="font-semibold truncate mr-2">{title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              isReady
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                            }`}>
                              {isReady ? "Ready" : "Discuss"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column: Quick Actions & Scoring Summary */}
            <div className="space-y-6">
              {/* Assignee Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  담당자 배정 (Assignee)
                </h3>
                <AssignApplicationForm
                  action={assignAction}
                  staffMembers={staffMembers}
                  currentStaffId={currentAssignment?.staff_id ?? null}
                />
              </div>

              {/* Scoring Summary Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  신속 평가 점수 (Weighted Score)
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-zinc-950 dark:text-white">{weightedScore}</span>
                  <span className="text-xs font-semibold text-zinc-400">/ 10.0</span>
                </div>
                <div>
                  <span className="inline-block rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                    {getRecommendation(weightedScore)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  '채점 및 권고' 탭에서 세부 항목별 10점 만점 점수를 조정하고 심사 평가서를 작성할 수 있습니다.
                </p>
              </div>

              {/* Application Motivation Note */}
              {application.motivation_note && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-2 shadow-xs">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    신청 메모 / 비고 (Application Note)
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {application.motivation_note}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "review" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Scoring Inputs */}
            <div className="md:col-span-2 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">제품 및 역량 평가 점수 (1 ~ 10)</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { key: "differentiation", label: "제품 차별성 (Differentiation)" },
                  { key: "marketPotential", label: "미국 시장 잠재력 (US Potential)" },
                  { key: "pricing", label: "가격 경쟁력 (Pricing)" },
                  { key: "packaging", label: "패키징 준비도 (Packaging)" },
                  { key: "regulatory", label: "규제 통관 준비도 (Regulatory)" },
                  { key: "capacity", label: "생산 능력 (Capacity)" },
                  { key: "marketing", label: "마케팅 역량 (Marketing)" },
                  { key: "retail", label: "리테일 적합성 (Retail)" },
                  { key: "amazon", label: "아마존 적합성 (Amazon)" },
                  { key: "responsiveness", label: "피드백 대응력 (Responsiveness)" },
                ].map((scoreItem) => (
                  <div key={scoreItem.key} className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {scoreItem.label}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={scores[scoreItem.key] || ""}
                      onChange={(e) => handleScoreChange(scoreItem.key, parseInt(e.target.value) || 0)}
                      className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation Display */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Total Weighted Score</h3>
                <div className="text-4xl font-extrabold text-zinc-950 dark:text-white">
                  {weightedScore} <span className="text-sm font-semibold text-zinc-400">/ 10.0</span>
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">시스템 판정</h3>
                  <span className="inline-block rounded bg-zinc-900 px-2 py-1 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                    {getRecommendation(weightedScore)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => alert("평가 결과가 임시저장되었습니다 (Mock Action).")}
                className="w-full rounded bg-zinc-900 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 mt-6"
              >
                평가 결과 확정
              </button>
            </div>
          </div>
        )}

        {activeTab === "communication" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Memo Workspace */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                내부 메모 <span className="text-xs font-normal text-zinc-400">(외부 파트너사에게 노출 안 됨)</span>
              </h2>
              <AddReviewNoteForm
                action={noteAddAction}
                products={linkRows.map((l) => ({
                  id: l.product_id,
                  name: productNameById.get(l.product_id) ?? "(삭제된 제품)",
                }))}
              />
              {reviewNoteRows.length > 0 ? (
                <ul className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  {reviewNoteRows.map((note) => (
                    <li key={note.id} className="rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-950 border dark:border-zinc-800">
                      <p className="text-zinc-700 dark:text-zinc-300">{note.content}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>
                          {staffNameById.get(note.author_id) ?? "알 수 없음"} ·{" "}
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                        {(note.author_id === userId || isSuperAdmin) && (
                          <form
                            action={noteDeleteAction.bind(null, note.id, application.id)}
                            onSubmit={(e) => {
                              if (!window.confirm("정말 이 메모를 삭제하시겠습니까?")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <button type="submit" className="text-red-500 hover:underline">
                              삭제
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 text-center py-4">등록된 메모가 없습니다.</p>
              )}
            </div>

            {/* Additional Info Request Workspace */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">추가 자료 요청</h2>
              <CreateInfoRequestForm
                action={infoRequestAction}
                products={linkRows.map((l) => ({
                  id: l.product_id,
                  name: productNameById.get(l.product_id) ?? "(삭제된 제품)",
                }))}
              />
              {infoRequestRows.length > 0 ? (
                <ul className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  {infoRequestRows.map((req, i) => (
                    <li key={req.id} className="rounded-md border p-3 text-xs dark:border-zinc-800 bg-white dark:bg-zinc-950">
                      <p className="font-bold text-zinc-900 dark:text-white">{req.request_content}</p>
                      <div className="mt-1 text-[10px] text-zinc-400">
                        <span>{new Date(req.requested_at).toLocaleDateString()} 요청 · </span>
                        {req.reply_due_at && (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            기한: {new Date(req.reply_due_at).toLocaleDateString()} ·{" "}
                          </span>
                        )}
                        <span className={req.status === "replied" ? "text-emerald-500 font-bold" : "text-amber-500"}>
                          {req.status === "replied" ? "회신완료" : "회신대기"}
                        </span>
                      </div>
                      {req.reply_content && (
                        <div className="mt-2 rounded bg-zinc-50 p-2 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                          <p>{req.reply_content}</p>
                          {infoRequestAttachmentUrls[i] && (
                            <a
                              href={infoRequestAttachmentUrls[i]!}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-[10px] text-zinc-900 underline dark:text-white"
                            >
                              첨부파일 다운로드 →
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 text-center py-4">자료 요청 이력이 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">심사 및 상태 변경 활동 이력</h2>
            {activityLogRows.length > 0 ? (
              <div className="relative border-l border-zinc-200 pl-4 space-y-4 dark:border-zinc-800">
                {activityLogRows.map((log) => (
                  <div key={log.id} className="relative text-xs">
                    <div className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <span className="text-[10px] text-zinc-400">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                      {staffNameById.get(log.changed_by) ?? "알 수 없음"}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      상태 변경: {log.before_state ? `${log.before_state} → ` : ""}{log.after_state}
                      {log.reason && <span className="text-zinc-400"> ({log.reason})</span>}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 text-center py-4">기록된 이력이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* Floating Toast Notifications */}
      {approveSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3.5 text-xs font-extrabold text-white shadow-2xl dark:bg-white dark:text-zinc-900 animate-in fade-in slide-in-from-bottom-3">
          <span>✅</span>
          <span>{approveSuccessToast}</span>
        </div>
      )}

      {rejectSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-amber-900 px-5 py-3.5 text-xs font-extrabold text-white shadow-2xl dark:bg-amber-100 dark:text-amber-950 animate-in fade-in slide-in-from-bottom-3 border border-amber-800">
          <span>📩</span>
          <span>{rejectSuccessToast}</span>
        </div>
      )}

      {/* Admin Approval & Invitation Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-150 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="text-xl font-bold">✓</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-950 dark:text-white">
                    파트너 승인 및 초대 (Approve & Invite Partner)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    신청서를 최종 승인하고 파트너사 전용 계정 초대 이메일을 발송합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                disabled={isSubmittingApprove}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Application & Partner Details Card */}
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/80 dark:bg-zinc-950/70 dark:border-zinc-800 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">신청 번호 (App No)</span>
                  <span className="font-mono font-extrabold text-zinc-950 dark:text-white">{application.application_number}</span>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">파트너 유형 (Partner Type)</span>
                  {application.partner_type === "retailer" ? (
                    <span className="font-extrabold text-amber-900 dark:text-amber-300">🏪 Retailer Partner (리테일러)</span>
                  ) : (
                    <span className="font-extrabold text-blue-900 dark:text-blue-300">🏷️ Brand Partner (브랜드)</span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">회사명 (Company Name)</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">{company?.name || application.applicant_company_name || "-"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">담당자 (Contact Name)</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">{displayContactName}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">이메일 (Contact Email)</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{application.applicant_contact_email || "-"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">현재 상태 (Current Status)</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    {APPLICATION_STATUS_LABEL[application.status as ApplicationStatus] || application.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmation & Routing Explanation */}
            <div className="rounded-xl bg-emerald-50/80 p-3.5 border border-emerald-200/80 text-xs dark:bg-emerald-950/30 dark:border-emerald-900/50 space-y-1">
              <div className="font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <span>📩</span>
                <span>승인 후 파트너 초대 이메일이 발송됩니다.</span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                {application.partner_type === "retailer"
                  ? "• 리테일러 파트너 초대장이 발송되며, K SELECT HUB / Retailer 온보딩 페이지로 안내됩니다."
                  : "• 브랜드 파트너 초대장이 발송되며, K SELECT NETWORK / Brand Portal 온보딩 페이지로 안내됩니다."}
              </p>
            </div>

            {/* Optional Approval Note */}
            <div className="space-y-1.5">
              <label htmlFor="approvalNote" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                승인 / 초대 메모 <span className="font-normal text-zinc-400 dark:text-zinc-500">(선택 사항)</span>
              </label>
              <textarea
                id="approvalNote"
                rows={3}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="승인 사유 또는 파트너 안내 메모를 입력하세요 (선택 사항)..."
                disabled={isSubmittingApprove}
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white transition-all resize-none"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ※ 비워둘 경우 시스템 활동 기록에 'Approved & Invited by Admin'으로 자동 기록됩니다.
              </p>
            </div>

            {/* Error Banner */}
            {approveError && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
                <span className="shrink-0">⚠️</span>
                <span>{approveError}</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-150 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                disabled={isSubmittingApprove}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproveAndInvite}
                disabled={isSubmittingApprove}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {isSubmittingApprove ? "Approving & Sending..." : "Approve & Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Rejection Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-150 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  <span className="text-xl font-bold">✕</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-950 dark:text-white">
                    파트너 신청 반려 (Reject Application)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    신청서를 반려 처리하고 신청자에게 거절 안내 이메일을 발송합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmittingReject}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Application & Partner Details Card */}
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/80 dark:bg-zinc-950/70 dark:border-zinc-800 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">신청 번호 (App No)</span>
                  <span className="font-mono font-extrabold text-zinc-950 dark:text-white">{application.application_number}</span>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">파트너 유형 (Partner Type)</span>
                  {application.partner_type === "retailer" ? (
                    <span className="font-extrabold text-amber-900 dark:text-amber-300">🏪 Retailer Partner</span>
                  ) : (
                    <span className="font-extrabold text-blue-900 dark:text-blue-300">🏷️ Brand Partner</span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">회사명 (Company Name)</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">{company?.name || application.applicant_company_name || "-"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">담당자 (Contact Name)</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">{displayContactName}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-bold block">수신 이메일 (Contact Email)</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{application.applicant_contact_email || "-"}</span>
                </div>
              </div>
            </div>

            {/* Required Internal Reason */}
            <div className="space-y-1.5">
              <label htmlFor="rejectInternalNote" className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                내부 심사 반려 사유 (Internal Reason) <span className="text-rose-600 dark:text-rose-400">*필수</span>
              </label>
              <textarea
                id="rejectInternalNote"
                rows={2}
                value={rejectInternalNote}
                onChange={(e) => setRejectInternalNote(e.target.value)}
                placeholder="내부 심사 기록용 반려 사유를 입력하세요 (예: 미국 MoCRA 규제 미비, 마진율 불일치)..."
                disabled={isSubmittingReject}
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white transition-all resize-none"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ※ 내부 관리 및 히스토리 기록용이며, 신청자 이메일에 직접 노출되지 않습니다.
              </p>
            </div>

            {/* Optional Applicant Message */}
            <div className="space-y-1.5">
              <label htmlFor="rejectApplicantMessage" className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                신청자 전달 안내 메시지 (Message to Applicant) <span className="font-normal text-zinc-400 dark:text-zinc-500">(선택 사항)</span>
              </label>
              <textarea
                id="rejectApplicantMessage"
                rows={3}
                value={rejectApplicantMessage}
                onChange={(e) => setRejectApplicantMessage(e.target.value)}
                placeholder="신청자에게 발송되는 거절 안내 메일에 포함할 추가 안내 또는 보완 권고사항이 있는 경우 입력하세요..."
                disabled={isSubmittingReject}
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-white transition-all resize-none"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ※ 입력 시 거절 안내 이메일 본문 내 &lsquo;추가 안내 사항&rsquo; 항목으로 포함되어 전달됩니다.
              </p>
            </div>

            {/* Error Banner */}
            {rejectError && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
                <span className="shrink-0">⚠️</span>
                <span>{rejectError}</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-150 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmittingReject}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject}
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {isSubmittingReject ? "Rejecting & Sending..." : "✕ Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
