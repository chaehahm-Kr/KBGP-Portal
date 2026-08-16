import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplicationDraftForm } from "@/components/application/application-draft-form";
import { SubmitApplicationButton } from "@/components/application/submit-application-button";
import { ReplyInfoRequestForm } from "@/components/application/reply-info-request-form";
import {
  saveDraftApplication,
  submitApplication,
} from "@/lib/application/actions";
import { replyToInfoRequest } from "@/lib/application/info-request-actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import {
  APPLICATION_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  SELF_CHECK_ITEMS,
  type ApplicationProductReviewStatus,
  type ApplicationStatus,
} from "@/lib/application/types";

export const metadata: Metadata = {
  title: "신청서 | 파트너 포털",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select(
      "id, application_number, status, motivation_note, self_check_answers, submitted_at, eligibility_responses"
    )
    .eq("id", id)
    .single();

  if (!application) {
    notFound();
  }

  const { data: links } = await supabase
    .from("application_products")
    .select("id, product_id, review_status, review_reason")
    .eq("application_id", id);

  const linkRows = links ?? [];
  const productIds = linkRows.map((l) => l.product_id);

  const { data: productRows } = productIds.length
    ? await supabase
        .from("products")
        .select("id, name, brand_id")
        .in("id", productIds)
    : { data: [] };

  const { data: allProducts } =
    application.status === "draft"
      ? await supabase
          .from("products")
          .select("id, name, brand_id")
          .eq("company_id", companyId)
      : { data: [] };

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("company_id", companyId);

  const brandNameById = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const productNameById = new Map(
    (productRows ?? []).map((p) => [p.id, p.name])
  );

  const { data: infoRequests } = await supabase
    .from("additional_info_requests")
    .select(
      "id, product_id, request_content, requested_at, reply_content, reply_attachment_path, status, replied_at, reply_due_at"
    )
    .eq("application_id", id)
    .order("requested_at", { ascending: false });

  const infoRequestRows = infoRequests ?? [];
  const pendingRequests = infoRequestRows.filter((r) => r.status === "pending");
  const repliedRequests = infoRequestRows.filter((r) => r.status === "replied");
  const repliedAttachmentUrls = await Promise.all(
    repliedRequests.map((r) =>
      r.reply_attachment_path ? getSignedFileUrl(r.reply_attachment_path) : Promise.resolve(null)
    )
  );

  const adminClient = createAdminClient();
  const activityEntityIds = [id, ...linkRows.map((l) => l.id)];
  const { data: activityLogs } = await adminClient
    .from("activity_logs")
    .select("id, entity_id, entity_type, before_state, after_state, changed_by, reason, created_at")
    .in("entity_id", activityEntityIds)
    .order("created_at", { ascending: false });

  const activityLogRows = activityLogs ?? [];

  if (application.status === "draft") {
    const productOptions = (allProducts ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      brandName: brandNameById.get(p.brand_id) ?? "",
    }));

    return (
      <div className="w-full max-w-7xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">신청서 작성 (임시저장)</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">필요한 제품과 정보를 기입하신 후 제출해 주세요.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <ApplicationDraftForm
            action={saveDraftApplication.bind(null, application.id)}
            products={productOptions}
            selectedProductIds={productIds}
            selfCheckAnswers={(application.self_check_answers ?? []) as boolean[]}
          />
          {linkRows.length > 0 && (
            <SubmitApplicationButton
              action={submitApplication.bind(null, application.id)}
            />
          )}
        </div>
      </div>
    );
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
      case "info_requested":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
      case "under_review":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
      default:
        return "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
    }
  };

  const getReviewStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-emerald-600 dark:text-emerald-400";
      case "rejected":
        return "text-rose-600 dark:text-rose-400";
      case "under_review":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-zinc-500 dark:text-zinc-400";
    }
  };

  return (
    <div className="w-full max-w-7xl space-y-6">
      {/* Top Header Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-zinc-400 font-mono tracking-wider">APPLICATION NUMBER</span>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
            {application.application_number}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            제출 일자: {application.submitted_at ? new Date(application.submitted_at).toLocaleString("ko-KR") : "-"}
          </p>
        </div>
        <div>
          <span className={`inline-flex items-center rounded border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(application.status)}`}>
            {APPLICATION_STATUS_LABEL[application.status as ApplicationStatus]}
          </span>
        </div>
      </div>

      {/* Info Request Panel */}
      {pendingRequests.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-950 dark:bg-amber-950/20 space-y-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-sm font-semibold">추가 자료 제출이 필요합니다</h2>
          </div>
          <div className="space-y-4 divide-y divide-amber-100 dark:divide-amber-900/30">
            {pendingRequests.map((request) => (
              <div key={request.id} className="pt-4 first:pt-0 space-y-2">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-amber-700 dark:text-amber-400">[요청 사항]</span> {request.request_content}
                  </span>
                  {request.reply_due_at && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold dark:bg-amber-950 dark:text-amber-300 shrink-0">
                      회신 기한: {new Date(request.reply_due_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}까지
                    </span>
                  )}
                </p>
                <div className="bg-white dark:bg-zinc-950 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                  <ReplyInfoRequestForm
                    action={replyToInfoRequest.bind(null, request.id, application.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Products Status & History (2 Cols) */}
        <div className="space-y-6 md:col-span-2">
          {/* Products Table Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              제품별 심사 현황
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-bold text-zinc-500 dark:border-zinc-850">
                    <th className="py-2">제품명</th>
                    <th className="py-2 text-right">심사 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 text-xs dark:divide-zinc-850">
                  {linkRows.map((link) => (
                    <tr key={link.id} className="align-top">
                      <td className="py-3">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          {productNameById.get(link.product_id) ?? "(삭제된 제품)"}
                        </p>
                        {/* History Timeline */}
                        <div className="mt-3 pl-2.5 border-l border-zinc-200 dark:border-zinc-800 space-y-2">
                          {getProductHistory(link.id).map((event, idx) => (
                            <div key={idx} className="relative text-[11px] text-zinc-500 dark:text-zinc-400">
                              <div className={`absolute -left-[14px] top-1.5 h-1.5 w-1.5 rounded-full ${
                                idx === 0 ? "bg-emerald-500 dark:bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                              }`} />
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`font-semibold ${
                                  event.status === "approved" ? "text-emerald-600 dark:text-emerald-400" :
                                  event.status === "rejected" ? "text-rose-600 dark:text-rose-400" :
                                  event.status === "on_hold" ? "text-amber-600 dark:text-amber-400" :
                                  "text-zinc-700 dark:text-zinc-300"
                                }`}>
                                  [{event.label}]
                                </span>
                                <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
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
                      </td>
                      <td className={`py-3 text-right font-semibold ${getReviewStatusColor(link.review_status)}`}>
                        {REVIEW_STATUS_LABEL[link.review_status as ApplicationProductReviewStatus]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Replied Requests History Card */}
          {repliedRequests.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
                추가 자료 요청 및 회신 내역
              </h2>
              <div className="mt-4 space-y-4">
                {repliedRequests.map((request, i) => (
                  <div key={request.id} className="rounded-lg border border-zinc-100 bg-zinc-50/20 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 text-xs space-y-3">
                    <div className="space-y-1">
                      <p className="font-bold text-amber-700 dark:text-amber-400">[요청]</p>
                      <p className="text-zinc-800 dark:text-zinc-300">{request.request_content}</p>
                    </div>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-1 bg-white dark:bg-zinc-950 p-3 rounded border">
                      <p className="font-bold text-zinc-900 dark:text-white">[회신]</p>
                      <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{request.reply_content}</p>
                      {repliedAttachmentUrls[i] && (
                        <div className="mt-2 pt-2 border-t border-zinc-50 dark:border-zinc-900">
                          <a
                            href={repliedAttachmentUrls[i]!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-white underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
                          >
                            📎 첨부파일 보기
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Motivation & Self Checks (1 Col) */}
        <div className="space-y-6">


          {/* Self Check Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              참여 조건 자가진단 결과
            </h2>
            <ul className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
              {SELF_CHECK_ITEMS.map((item, index) => {
                const isChecked = (application.self_check_answers as boolean[] | null)?.[index];
                return (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="shrink-0 text-sm mt-0.5">
                      {isChecked ? "✅" : "❌"}
                    </span>
                    <span className={`leading-snug ${isChecked ? "text-zinc-900 dark:text-zinc-250 font-medium" : "text-zinc-400 dark:text-zinc-550"}`}>
                      {item}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Readiness Check Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-850">
              프로그램 참여 준비 사항
            </h2>
            {(() => {
              const allowedKeys = [
                "stable_supply",
                "us_regulatory_compliance",
                "initial_test_quantity",
                "north_america_distribution",
                "joint_marketing",
                "sales_content_support",
              ];
              const defaultEligibility = allowedKeys.map((key, index) => {
                const isChecked = (application.self_check_answers as boolean[] | null)?.[index] ?? true;
                return {
                  itemKey: key,
                  response: isChecked ? "available" : "discussion_required",
                };
              });
              const finalResponses = application.eligibility_responses
                ? (application.eligibility_responses as { itemKey: string; response: string }[])
                : defaultEligibility;

              const READINESS_ITEMS: Record<string, string> = {
                stable_supply: "안정적인 생산 및 공급망 확보",
                us_regulatory_compliance: "미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비",
                initial_test_quantity: "초기 파트너십 테스트 물량 공급 의향",
                north_america_distribution: "북미 온/오프라인 유통 및 가격 정책 동의",
                joint_marketing: "북미 현지 공동 마케팅 협력 의향",
                sales_content_support: "상세 페이지 및 현지화 마케팅 콘텐츠 지원",
              };

              return (
                <ul className="mt-4 space-y-3 text-xs">
                  {finalResponses.map((item) => (
                    <li key={item.itemKey} className="flex items-start gap-2.5">
                      <span className="shrink-0 text-sm mt-0.5">
                        {item.response === "available" ? "🟢" : "🟡"}
                      </span>
                      <div className="leading-snug">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-200">
                          {READINESS_ITEMS[item.itemKey] || item.itemKey}
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {item.response === "available" ? "진행 가능" : "협의 필요"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
