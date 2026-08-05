"use client";

import React, { useState, useEffect, useTransition } from "react";
import { type TemplateFormState } from "@/lib/notifications/template-actions";

type EmailTemplateData = {
  key: string;
  description: string;
  subject: string;
  body: string;
};

type EmailTemplatesWorkspaceProps = {
  initialTemplates: EmailTemplateData[];
  updateAction: (key: string, prevState: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  testAction: (key: string, prevState: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  previewAction: (key: string, subject: string, body: string) => Promise<{ success: boolean; html: string; error?: string }>;
};

type TemplateMetadata = {
  recipientType: "partner" | "internal";
  recipientLabel: string;
  triggerType: "auto" | "manual" | "cron";
  triggerLabel: string;
  triggerCondition: string;
};

const TEMPLATE_METADATA: Record<string, TemplateMetadata> = {
  application_submitted_company: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "신청자가 포털에서 입점 신청서를 최종 제출 완료했을 때, 신청서 접수를 증명하기 위해 신청자 이메일로 자동 전송됩니다.",
  },
  application_received_internal: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "신규 입점 신청서가 접수되었을 때 어드민 내부 전직원에게 빠른 심사 유도를 위해 알림용으로 발송됩니다.",
  },
  assignment_assigned: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 특정 신청서에 담당 심사원을 신규로 배정(Assign)했을 때, 배정 사실을 배정된 담당자에게 통보합니다.",
  },
  assignment_unassigned: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "어드민이 신청서에 지정되어 있던 담당 심사원 배정을 취소/해제했을 때 해당 직원에게 발송됩니다.",
  },
  info_request_created: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "심사원이 신청서 검토 중 '추가 자료 요청'을 작성하여 파트너사 조치를 요구할 때 회사 담당자에게 발송됩니다.",
  },
  info_request_replied: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "회사 담당자가 추가 자료 요청에 대해 회신 자료를 업로드 및 최종 제출했을 때 배정된 심사원에게 발송됩니다.",
  },
  review_result_approved: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "심사 완료 후 최종 '승인' 처리를 내렸을 때 회사 담당자에게 파트너십 승인 사실 및 향후 일정 조율을 위해 발송됩니다.",
  },
  review_result_partial_approved: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "신청서 내 특정 제품군에 대해서만 일부 승인하는 '부분 승인' 처리를 내렸을 때 회사 담당자에게 안내를 위해 발송됩니다.",
  },
  review_result_on_hold: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "신청서에 대해 보완이나 협의를 위해 '보류' 처리를 내렸을 때 회사 담당자에게 상세한 보류 사유와 함께 발송됩니다.",
  },
  review_result_rejected: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "manual",
    triggerLabel: "수동 액션 (Manual)",
    triggerCondition: "심사 결과 최종 '반려' 처리를 확정지었을 때 회사 담당자에게 반려 사유 고지와 감사 안내를 위해 정중히 발송됩니다.",
  },
  info_request_due_soon: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "cron",
    triggerLabel: "자동 크론 (Cron Job)",
    triggerCondition: "추가 자료 요청의 회신 기한 만료가 24시간 미만으로 남았을 때 미제출 파트너사에게 독촉 메일이 자동 발송됩니다.",
  },
  info_request_overdue: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "cron",
    triggerLabel: "자동 크론 (Cron Job)",
    triggerCondition: "추가 자료 회신 기한을 최종 초과했을 때 담당 심사원에게 직접 유선 확인 등을 가이드하기 위해 자동 발송됩니다.",
  },
  invite_expiring_soon: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "cron",
    triggerLabel: "자동 크론 (Cron Job)",
    triggerCondition: "회사 관리자 초대 메일의 유효 기간(48시간) 만료 24시간 전에, 초대를 보냈던 어드민 본인에게 알림용으로 발송됩니다.",
  },
  inquiry_received_applicant: {
    recipientType: "partner",
    recipientLabel: "회사 담당자 (Partner)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "마케팅 소개 웹사이트에서 파트너 가입 의향 문의가 새로 들어왔을 때, 제출자에게 접수 증명용으로 자동 전송됩니다.",
  },
  inquiry_received_internal: {
    recipientType: "internal",
    recipientLabel: "내부 담당자 (Internal)",
    triggerType: "auto",
    triggerLabel: "자동 발송 (Auto)",
    triggerCondition: "마케팅 소개 웹사이트에서 신규 가입 문의가 접수되었을 때 어드민 내부 전원에게 실시간 모니터링 알림으로 발송됩니다.",
  },
};

const TEMPLATE_CATEGORIES = [
  {
    id: "application",
    name: "🏢 신청서 처리 (Application)",
    keys: ["application_submitted_company", "application_received_internal"]
  },
  {
    id: "assignment",
    name: "👤 심사원 배정 (Assignment)",
    keys: ["assignment_assigned", "assignment_unassigned"]
  },
  {
    id: "info_request",
    name: "📝 추가 자료 요청 (Info Request)",
    keys: ["info_request_created", "info_request_replied", "info_request_due_soon", "info_request_overdue"]
  },
  {
    id: "review",
    name: "⚖️ 심사 결과 통보 (Review)",
    keys: ["review_result_approved", "review_result_partial_approved", "review_result_on_hold", "review_result_rejected"]
  },
  {
    id: "inquiry",
    name: "📩 문의 및 기타 (Inquiry & Invites)",
    keys: ["inquiry_received_applicant", "inquiry_received_internal", "invite_expiring_soon"]
  }
];

export function EmailTemplatesWorkspace({
  initialTemplates,
  updateAction,
  testAction,
  previewAction,
}: EmailTemplatesWorkspaceProps) {
  const [templates, setTemplates] = useState<EmailTemplateData[]>(initialTemplates);
  const [selectedKey, setSelectedKey] = useState<string>(initialTemplates[0]?.key || "");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    application: true,
    assignment: true,
    info_request: true,
    review: true,
    inquiry: true,
  });

  // Panel sizing resizable states
  const [leftWidth, setLeftWidth] = useState(330);
  const [rightWidth, setRightWidth] = useState(500);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Selected item local states
  const activeTemplate = templates.find((t) => t.key === selectedKey) || initialTemplates[0];
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const [isSaving, startSave] = useTransition();
  const [isSendingTest, startSendTest] = useTransition();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tracking mouse resize movements
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        // Limit left panel size between 220px and 600px
        const newWidth = Math.max(220, Math.min(600, e.clientX - 16));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        // Limit right panel size between 350px and 800px
        const newWidth = Math.max(350, Math.min(800, window.innerWidth - e.clientX - 16));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight]);

  // Sync state when template key changes
  useEffect(() => {
    if (activeTemplate) {
      setSubject(activeTemplate.subject);
      setBody(activeTemplate.body);
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [selectedKey]);

  // Load preview HTML
  const loadPreview = async (sub: string, bd: string) => {
    setPreviewLoading(true);
    try {
      const res = await previewAction(selectedKey, sub, bd);
      if (res.success) {
        setPreviewHtml(res.html);
      } else {
        setPreviewHtml(`<div style="padding: 20px; color: red;">미리보기 생성 실패: ${res.error || "알 수 없는 에러"}</div>`);
      }
    } catch {
      setPreviewHtml('<div style="padding: 20px; color: red;">미리보기 요청 중 에러가 발생했습니다.</div>');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Trigger preview on initial load or content change (debounce slightly)
  useEffect(() => {
    if (!selectedKey) return;
    const timer = setTimeout(() => {
      loadPreview(subject, body);
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedKey, subject, body]);

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!subject.trim()) { setErrorMsg("제목을 입력해주세요."); return; }
    if (!body.trim()) { setErrorMsg("본문을 입력해주세요."); return; }

    startSave(async () => {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("body", body);

      const res = await updateAction(selectedKey, undefined, fd);
      if (res && "error" in res) {
        setErrorMsg(res.error);
      } else if (res && "success" in res) {
        setSuccessMsg(res.success);
        // Update local template state
        setTemplates((prev) =>
          prev.map((t) => (t.key === selectedKey ? { ...t, subject, body } : t))
        );
      }
    });
  };

  const handleTestSend = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    startSendTest(async () => {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("body", body);

      const res = await testAction(selectedKey, undefined, fd);
      if (res && "error" in res) {
        setErrorMsg(res.error);
      } else if (res && "success" in res) {
        setSuccessMsg(res.success);
      }
    });
  };

  const meta = TEMPLATE_METADATA[selectedKey];

  return (
    <div className="flex h-[calc(100vh-11rem)] gap-0.5 overflow-hidden text-xs select-none">
      {/* 1. Left panel: Template List & Categories */}
      <div
        style={{ width: `${leftWidth}px` }}
        className="shrink-0 rounded-l-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden"
      >
        <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <h3 className="font-extrabold text-zinc-900 dark:text-white">이메일 템플릿</h3>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">발송 유형을 선택해 주세요.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 select-text">
          {TEMPLATE_CATEGORIES.map((category) => {
            const categoryTemplates = templates.filter((t) => category.keys.includes(t.key));
            if (categoryTemplates.length === 0) return null;

            const isOpen = openCategories[category.id];

            return (
              <div key={category.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-extrabold text-zinc-600 dark:text-zinc-400 text-left transition-colors cursor-pointer select-none"
                >
                  <span>{category.name}</span>
                  <span className="text-[9px] text-zinc-400">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="pl-2 space-y-0.5 border-l border-zinc-100 dark:border-zinc-800/80 ml-2">
                    {categoryTemplates.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedKey(item.key)}
                        className={`w-full text-left px-2.5 py-2 rounded text-[11px] leading-tight font-medium transition-all cursor-pointer ${
                          selectedKey === item.key
                            ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                            : "text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        {item.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resize Splitter 1 */}
      <div
        onMouseDown={() => setIsResizingLeft(true)}
        className={`w-2 shrink-0 self-stretch hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center select-none ${
          isResizingLeft ? "bg-zinc-400 dark:bg-zinc-500" : "bg-transparent"
        }`}
      >
        <div className="h-6 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>

      {/* 2. Center panel: Compact Edit form */}
      <div className="flex-1 min-w-[340px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden">
        <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
          <div className="space-y-0.5">
            <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{selectedKey}</span>
            <h3 className="font-extrabold text-zinc-900 dark:text-white">{activeTemplate?.description}</h3>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex-1 p-4 flex flex-col gap-3 min-h-0 overflow-y-auto select-text">
          {/* Metadata Display Cards */}
          {meta && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/30 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/20 space-y-2 shrink-0 select-none">
              <div className="flex flex-wrap gap-2 items-center">
                {/* Recipient Target Badge */}
                <span
                  className={`inline-flex items-center rounded px-2.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                    meta.recipientType === "partner"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40"
                      : "bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40"
                  }`}
                >
                  📬 {meta.recipientLabel}
                </span>

                {/* Trigger Method Badge */}
                <span
                  className={`inline-flex items-center rounded px-2.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                    meta.triggerType === "auto"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                      : meta.triggerType === "manual"
                      ? "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                      : "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40"
                  }`}
                >
                  ⚡ {meta.triggerLabel}
                </span>
              </div>

              {/* Specific Send Trigger Explanation */}
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-medium bg-white dark:bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 flex items-start gap-2">
                <span className="text-sm shrink-0">ℹ️</span>
                <span className="self-center select-text">{meta.triggerCondition}</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400 shrink-0">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/15 dark:text-emerald-400 shrink-0">
              {successMsg}
            </div>
          )}

          <div className="space-y-1 shrink-0">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300">이메일 제목</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="이메일 제목을 입력해주세요."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors font-semibold"
            />
          </div>

          <div className="flex-1 flex flex-col space-y-1 min-h-[140px]">
            <div className="flex items-center justify-between select-none">
              <label className="block font-bold text-zinc-700 dark:text-zinc-300">
                본문 내용 <span className="font-normal text-zinc-400">(치환자 변수 적용 가능)</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-mono">{"{{ctaButton}}"} 적용 권장</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="이메일 본문 내용을 입력해주세요."
              className="flex-1 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:border-zinc-950 dark:focus:border-white transition-colors leading-relaxed resize-none font-mono"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0 select-none">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "💾 저장하기"}
            </button>
            <button
              type="button"
              onClick={handleTestSend}
              disabled={isSendingTest}
              className="rounded-lg border border-zinc-200 px-4 py-2 font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSendingTest ? "발송 중..." : "✉️ 테스트 발송"}
            </button>
          </div>
        </form>
      </div>

      {/* Resize Splitter 2 */}
      <div
        onMouseDown={() => setIsResizingRight(true)}
        className={`w-2 shrink-0 self-stretch hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center select-none ${
          isResizingRight ? "bg-zinc-400 dark:bg-zinc-500" : "bg-transparent"
        }`}
      >
        <div className="h-6 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>

      {/* 3. Right panel: Desktop Email Preview mockup */}
      <div
        style={{ width: `${rightWidth}px` }}
        className="shrink-0 rounded-r-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden"
      >
        <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
          <h3 className="font-extrabold text-zinc-900 dark:text-white">미리보기 (Preview)</h3>
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
            실시간 연동
          </span>
        </div>

        <div className="flex-1 bg-zinc-100 dark:bg-zinc-950/30 p-3 min-h-0 flex flex-col justify-stretch">
          {/* Email client window mockup */}
          <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white shadow-sm flex flex-col overflow-hidden min-h-0">
            {/* Window title bar */}
            <div className="bg-zinc-50 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <div className="text-[9px] font-mono text-zinc-400 ml-2 truncate">
                To: {activeTemplate?.description}
              </div>
            </div>

            {/* Email subject preview */}
            <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-white dark:bg-zinc-900 select-text">
              <span className="font-extrabold text-zinc-400 mr-2 text-[10px]">Subject:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[10px] break-all leading-tight">
                {subject || "(제목 없음)"}
              </span>
            </div>

            {/* Email HTML Preview iframe */}
            <div className="flex-1 bg-white relative min-h-0">
              {previewLoading && (
                <div className="absolute inset-0 z-10 bg-white/70 dark:bg-zinc-900/70 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold text-zinc-500 animate-pulse">미리보기 렌더링 중...</span>
                </div>
              )}
              {previewHtml ? (
                <iframe
                  key={selectedKey}
                  title="Email Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0 bg-white"
                />
              ) : (
                <div className="h-full flex items-center justify-center p-6 text-center text-zinc-400">
                  미리보기를 불러올 수 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
