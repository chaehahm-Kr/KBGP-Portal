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

interface ApplicationWorkspaceProps {
  application: any;
  company: any;
  companyUsers?: any[];
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
  userId: string;
  // Actions
  reviewAction: any;
  assignAction: any;
  noteAddAction: any;
  noteDeleteAction: any;
  infoRequestAction: any;
}

export default function ApplicationWorkspace({
  application,
  company,
  companyUsers = [],
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
  userId,
  reviewAction,
  assignAction,
  noteAddAction,
  noteDeleteAction,
  infoRequestAction
}: ApplicationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "company" | "products" | "documents" | "review" | "communication" | "activity"
  >("overview");

  // Parse company metadata
  let parsedMeta = {
    description: company?.intro || "",
    address: "",
    website: "",
    contacts: [] as any[],
    type: "Brand Owner"
  };

  if (company?.intro && company.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      const jsonStr = company.intro.substring("__COMPANY_METADATA__:".length);
      const data = JSON.parse(jsonStr);
      parsedMeta = {
        description: data.description || "",
        address: data.address || "",
        website: data.website || "",
        contacts: data.contacts || [],
        type: data.type || "Brand Owner"
      };
    } catch (e) {
      console.error("Error parsing company metadata in workspace:", e);
    }
  }

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

  const weightedScore = parseFloat(calculateWeightedScore());

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-zinc-950 dark:text-white">
                {application.application_number}
              </span>
              <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {APPLICATION_STATUS_LABEL[application.status as ApplicationStatus]}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              회사명: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{company?.name}</span> · 
              제출일: {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 self-center">
              담당 심사원: <span className="font-bold text-zinc-800 dark:text-zinc-200">{currentAssignment ? staffNameById.get(currentAssignment.staff_id) : "미배정"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2 -mb-px text-xs font-medium">
          {[
            { id: "overview", label: "개요 (Overview)" },
            { id: "company", label: "회사 정보 (Company)" },
            { id: "products", label: "제품 및 심사 (Products)" },
            { id: "documents", label: "자가진단 (Self-Check)" },
            { id: "review", label: "채점 및 권고 (Scoring)" },
            { id: "communication", label: "의견/자료요청 (Communication)" },
            { id: "activity", label: "활동 이력 (History)" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-bold"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              {/* Company Summary */}
              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Company Summary</h3>
                <div className="text-sm text-zinc-800 dark:text-zinc-200 space-y-2">
                  <p>국가: {company?.country}</p>
                  <p>사업자등록번호: {company?.business_registration_number}</p>
                </div>
              </div>


            </div>

            {/* Quick Actions / Assignee Panel */}
            <div className="space-y-6">
              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">담당자 배정 (Assignee)</h3>
                <AssignApplicationForm
                  action={assignAction}
                  staffMembers={staffMembers}
                  currentStaffId={currentAssignment?.staff_id ?? null}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="space-y-6">
            {/* 1. 회사 상세 정보 카드 */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
              <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                회사 상세 프로필
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="space-y-2">
                  <p>회사 이름: <span className="font-bold text-zinc-900 dark:text-white">{company?.name || "-"}</span></p>
                  <p>국가: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{company?.country || "-"}</span></p>
                  <p>사업자번호: <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">{company?.business_registration_number || "-"}</span></p>
                  <p>파트너 유형: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{parsedMeta.type || "-"}</span></p>
                </div>
                <div className="space-y-2">
                  <p>회사 주소: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{parsedMeta.address || "-"}</span></p>
                  <p>웹사이트: {parsedMeta.website ? (
                    <a
                      href={parsedMeta.website.startsWith("http") ? parsedMeta.website : `https://${parsedMeta.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-indigo-650 hover:underline underline-offset-2"
                    >
                      {parsedMeta.website} ↗
                    </a>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}</p>
                  {parsedMeta.description && (
                    <div>
                      <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-bold mb-1">회사 소개</span>
                      <p className="text-[11px] leading-relaxed text-zinc-655 dark:text-zinc-350 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-100 dark:border-zinc-850 whitespace-pre-wrap">{parsedMeta.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. 회사 소속 담당자 및 포털 가입 계정 */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
              <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                회사 소속 담당자 및 포털 가입 계정 (Contacts & Portal Users)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-455">
                  <thead>
                    <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-955 dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                      <th className="px-4 py-2 font-semibold">이름</th>
                      <th className="px-4 py-2 font-semibold">부서 / 직함</th>
                      <th className="px-4 py-2 font-semibold">이메일</th>
                      <th className="px-4 py-2 font-semibold">연락처</th>
                      <th className="px-4 py-2 font-semibold">계정 권한 (Role)</th>
                      <th className="px-4 py-2 font-semibold">메뉴별 세부 권한</th>
                      <th className="px-4 py-2 font-semibold text-center">이용 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {companyUsers.map((user: any) => (
                      <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20">
                        <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{user.name || "이름 없음"}</span>
                            {user.is_primary && (
                              <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                                주 컨택
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                          {user.position || user.title
                            ? `${user.position || ""} ${user.title ? `(${user.title})` : ""}`
                            : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-455 font-mono">{user.email}</td>
                        <td className="px-4 py-2.5 text-zinc-650 dark:text-zinc-455 font-mono">{user.phone || "-"}</td>
                        <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 font-semibold">
                          {user.company_role === "company_admin" ? "관리자 (Admin)" : "담당자 (Staff)"}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                          {user.permissions ? (
                            <div className="flex flex-wrap gap-1">
                              <span className="bg-zinc-50 border border-zinc-100 px-1 py-0.5 rounded dark:bg-zinc-800 dark:border-zinc-750">
                                신청서:{user.permissions.application === "read_write" ? "쓰기" : user.permissions.application === "read_only" ? "읽기" : "없음"}
                              </span>
                              <span className="bg-zinc-50 border border-zinc-100 px-1 py-0.5 rounded dark:bg-zinc-800 dark:border-zinc-750">
                                브랜드:{user.permissions.brands === "read_write" ? "쓰기" : user.permissions.brands === "read_only" ? "읽기" : "없음"}
                              </span>
                              <span className="bg-zinc-50 border border-zinc-100 px-1 py-0.5 rounded dark:bg-zinc-800 dark:border-zinc-750">
                                제품:{user.permissions.products === "read_write" ? "쓰기" : user.permissions.products === "read_only" ? "읽기" : "없음"}
                              </span>
                              <span className="bg-zinc-50 border border-zinc-100 px-1 py-0.5 rounded dark:bg-zinc-800 dark:border-zinc-750">
                                회사:{user.permissions.company_info === "read_write" ? "쓰기" : user.permissions.company_info === "read_only" ? "읽기" : "없음"}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {user.status === "active" ? (
                            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              정상 이용
                            </span>
                          ) : user.status === "suspended" ? (
                            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              이용 일시정지
                            </span>
                          ) : (
                            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-350">
                              초대 대기중
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {companyUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-zinc-400">
                          가입된 포털 사용자가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 회사 관리 대시보기 바로가기 링크 */}
            <div className="pt-2">
              <Link
                href={`/admin/companies/${company?.id}`}
                className="text-xs font-semibold text-indigo-650 hover:text-indigo-850 underline underline-offset-2 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                회사 관리 대시보드 바로가기 (브랜드/제품 전체보기) →
              </Link>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">신청 제품 리스트 및 심사</h2>
            <div className="space-y-4">
              {linkRows.map((link) => (
                <div key={link.id} className="rounded border border-zinc-150 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <ReviewProductForm
                    action={reviewAction.bind(null, link.id, application.id)}
                    productName={productNameById.get(link.product_id) ?? "(삭제된 제품)"}
                    currentStatus={link.review_status as ApplicationProductReviewStatus}
                    currentReason={link.review_reason}
                    disabled={!canReview}
                  />
                  {/* History Timeline */}
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">심사 히스토리</h4>
                    <div className="pl-2.5 border-l border-zinc-200 dark:border-zinc-800 space-y-2">
                      {getProductHistory(link.id).map((event, idx) => (
                        <div key={idx} className="relative text-[11px] text-zinc-500 dark:text-zinc-400">
                          <div className={`absolute -left-[14px] top-1.5 h-1.5 w-1.5 rounded-full ${
                            idx === 0 ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-700"
                          }`} />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`font-semibold ${
                              event.status === "approved" ? "text-emerald-600 dark:text-emerald-450" :
                              event.status === "rejected" ? "text-rose-600 dark:text-rose-450" :
                              event.status === "on_hold" ? "text-amber-600 dark:text-amber-450" :
                              "text-zinc-700 dark:text-zinc-350"
                            }`}>
                              [{event.label}]
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400">
                              {event.time}
                            </span>
                          </div>
                          {event.reason && (
                            <p className="mt-0.5 pl-3 text-xs text-zinc-650 dark:text-zinc-400 italic">
                              ↳ 사유: {event.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">자가진단 응답 결과 (Self-Check)</h2>
            <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
              {SELF_CHECK_ITEMS.map((item, index) => (
                <li key={item} className="flex items-start gap-2 rounded border border-zinc-100 p-2.5 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  <span className="text-sm shrink-0">
                    {(application.self_check_answers as boolean[] | null)?.[index] ? "✅" : "⬜"}
                  </span>
                  <span className="self-center">{item}</span>
                </li>
              ))}
            </ul>
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
    </div>
  );
}
