"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDraftConfig,
  publishDraftConfig,
  discardDraftConfig,
  updateQuestionAction,
  addAnswerOptionAction,
  updateAnswerOptionAction,
  updateMappingAction,
  updateParameterAction,
  validateDraftConfigAction,
} from "@/lib/simulator/actions";

interface ConfigurationClientProps {
  userId: string;
  baseRole: string;
  questionnaires: any[];
  activeQn: any | null;
  draftQn: any | null;
  allQuestions: any[];
  allAnswers: any[];
  allParameters: any[];
  allRules: any[];
  matchingTags: any[];
  auditLogs: any[];
}

export default function ConfigurationClient({
  userId,
  baseRole,
  questionnaires,
  activeQn,
  draftQn,
  allQuestions,
  allAnswers,
  allParameters,
  allRules,
  matchingTags,
  auditLogs,
}: ConfigurationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active Tab state: "questionnaire" | "mapping" | "calibration" | "financial" | "versions"
  const [activeTab, setActiveTab] = useState<
    "questionnaire" | "mapping" | "calibration" | "financial" | "versions"
  >("questionnaire");

  // Selection state: defaults to draft questionnaire if exists, else active
  const selectedQn = draftQn || activeQn;
  const isDraftMode = selectedQn?.status === "draft";

  // Permissions mapping
  const canManage = baseRole === "super_admin" || baseRole === "admin" || baseRole === "reviewer";
  const canPublish = baseRole === "super_admin";

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationRun, setValidationRun] = useState(false);

  // Editing state for modals
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [editingMapping, setEditingMapping] = useState<any | null>(null);
  const [newAnswerOpt, setNewAnswerOpt] = useState<{
    questionUuid: string;
    answerId: string;
    labelKo: string;
    labelEn: string;
    displayOrder: number;
  } | null>(null);

  // Local parameter form edits (JSON string format or inputs)
  const [editingParamKey, setEditingParamKey] = useState<string | null>(null);
  const [editingParamValue, setEditingParamValue] = useState<string>("");

  // ==========================================
  // Core Draft Workflow Actions
  // ==========================================
  const handleCreateDraft = () => {
    if (!canManage) return alert("설정 관리 권한이 없습니다.");
    startTransition(async () => {
      const res = await createDraftConfig(userId);
      if (res.error) {
        alert(res.error);
      } else {
        alert("성공적으로 드래프트 버전을 생성했습니다.");
        router.refresh();
      }
    });
  };

  const handleDiscardDraft = () => {
    if (!draftQn) return;
    if (!confirm("정말로 편집 중인 드래프트를 폐기하시겠습니까?\n이 작업은 되돌릴 수 없으며 편집한 모든 질문, 매핑 및 매개변수가 삭제됩니다.")) {
      return;
    }
    startTransition(async () => {
      const res = await discardDraftConfig(draftQn.id, userId);
      if (res.error) {
        alert(res.error);
      } else {
        alert("드래프트를 폐기했습니다.");
        router.refresh();
      }
    });
  };

  const handleValidateConfig = async () => {
    if (!selectedQn) return;
    startTransition(async () => {
      const res = await validateDraftConfigAction(selectedQn.id);
      setValidationErrors(res.errors);
      setValidationRun(true);
      if (res.isValid) {
        alert("유효성 검사 성공! 오류가 없습니다.");
      } else {
        alert(`유효성 검사 실패: 총 ${res.errors.length}개의 오류 감지됨.`);
      }
    });
  };

  const handlePublishConfig = () => {
    if (!draftQn) return;
    if (!canPublish) return alert("배포(Publish) 권한은 Super Admin에게만 있습니다.");
    
    if (!confirm(`정말로 드래프트 설정을 정식 배포하시겠습니까?\n배포 시 새 Questionnaire 및 Config 버전 v${draftQn.version}이 활성화되며, 기존 v${activeQn?.version || 1}은 아카이브(Archived) 상태로 전환됩니다.`)) {
      return;
    }

    startTransition(async () => {
      const res = await publishDraftConfig(draftQn.id, userId);
      if (res.error) {
        alert(res.error);
      } else {
        alert(`v${draftQn.version} 버전 배포 완료! 실시간 계산 엔진에 즉시 반영되었습니다.`);
        setValidationRun(false);
        setValidationErrors([]);
        router.refresh();
      }
    });
  };

  // ==========================================
  // In-place Editing Actions
  // ==========================================
  const handleSaveQuestion = () => {
    if (!editingQuestion) return;
    startTransition(async () => {
      const res = await updateQuestionAction(selectedQn.id, editingQuestion.id, {
        label_ko: editingQuestion.label_ko,
        label_en: editingQuestion.label_en,
        type: editingQuestion.type,
        display_order: Number(editingQuestion.display_order),
        is_optional: editingQuestion.is_optional,
        is_active: editingQuestion.is_active,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setEditingQuestion(null);
        router.refresh();
      }
    });
  };

  const handleAddAnswerOption = () => {
    if (!newAnswerOpt) return;
    startTransition(async () => {
      const res = await addAnswerOptionAction(
        selectedQn.id,
        newAnswerOpt.questionUuid,
        newAnswerOpt.answerId,
        newAnswerOpt.labelKo,
        newAnswerOpt.labelEn,
        Number(newAnswerOpt.displayOrder)
      );

      if (res.error) {
        alert(res.error);
      } else {
        setNewAnswerOpt(null);
        router.refresh();
      }
    });
  };

  const handleToggleAnswerStatus = (ansUuid: string, currentStatus: boolean) => {
    if (!isDraftMode) return;
    startTransition(async () => {
      const res = await updateAnswerOptionAction(ansUuid, { is_active: !currentStatus });
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleSaveMapping = () => {
    if (!editingMapping) return;
    startTransition(async () => {
      const res = await updateMappingAction(editingMapping.answer_id, {
        tag_code: editingMapping.tag_code || null,
        tag_strength: editingMapping.tag_strength || null,
        ap_signal_path: editingMapping.ap_signal_path || null,
        direct_ap: editingMapping.direct_ap || null,
        display_signal: editingMapping.display_signal || null,
        display_strength: editingMapping.display_strength || null,
        hard_constraint: editingMapping.hard_constraint || null,
        turnover_category: editingMapping.turnover_category || null,
        turnover_direction: editingMapping.turnover_direction || null,
        financial_category: editingMapping.financial_category || null,
        confidence_signal: editingMapping.confidence_signal || null,
        business_rationale: editingMapping.business_rationale || null,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setEditingMapping(null);
        router.refresh();
      }
    });
  };

  const handleSaveParameter = (key: string, valueJsonStr: string) => {
    if (!selectedQn) return;
    try {
      const parsedValue = JSON.parse(valueJsonStr);
      startTransition(async () => {
        const res = await updateParameterAction(selectedQn.id, key, parsedValue);
        if (res.error) {
          alert(res.error);
        } else {
          setEditingParamKey(null);
          router.refresh();
        }
      });
    } catch (e) {
      alert("JSON 파싱 에러: 입력값이 유효한 JSON 포맷이 아닙니다.");
    }
  };

  // Filter items based on selected questionnaire version
  const questions = allQuestions.filter((q) => q.questionnaire_id === selectedQn?.id);
  const qUuids = questions.map((q) => q.id);
  const answers = allAnswers.filter((a) => qUuids.includes(a.question_id));

  // Load mappings only for the selected questionnaire's answers
  const [allMappings, setAllMappings] = useState<any[]>([]);
  React.useEffect(() => {
    const fetchMappings = async () => {
      if (answers.length === 0) return;
      const ansIds = answers.map((a) => a.id);
      const res = await fetch(`/api/simulator/calculate`, { method: "OPTIONS" }); // just dummy to check API context or use direct fetch
      // Let's call supabase directly on client or via helper
      const { createClient } = await import("@/lib/supabase/client");
      const client = createClient();
      const { data } = await client
        .from("simulator_answer_mappings")
        .select("*")
        .in("answer_id", ansIds);
      setAllMappings(data || []);
    };
    fetchMappings();
  }, [selectedQn, allAnswers]);

  const parameters = allParameters.filter((p) => p.questionnaire_id === selectedQn?.id);

  // Tabs layout mappings
  const TABS = [
    { id: "questionnaire", label: "설문 질문 (Questionnaire)" },
    { id: "mapping", label: "가중치 매핑 (Mappings)" },
    { id: "calibration", label: "산정 매개변수 (Calibration)" },
    { id: "financial", label: "재무 기본값 (Financial)" },
    { id: "versions", label: "버전 내역 (Versions)" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Draft Status Banner */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-block rounded-full h-3.5 w-3.5 ${isDraftMode ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          <div className="text-xs">
            <span className="font-bold text-zinc-900 dark:text-white">
              {isDraftMode ? `드래프트 버전 편집 중 (v${selectedQn.version} Draft)` : `정식 배포 활성 버전 가동 중 (v${selectedQn?.version || 1} Active)`}
            </span>
            <p className="text-zinc-400 mt-0.5">
              {isDraftMode
                ? "드래프트 편집 내용은 실시간 계산 엔진에 영향을 주지 않으며 배포 후에 적용됩니다."
                : "정식 운영 계산에 직접 사용되는 마스터 설정 버전 상태입니다."}
            </p>
          </div>
        </div>

        {/* Workflow actions */}
        <div className="flex items-center gap-2">
          {!isDraftMode && canManage && (
            <button
              onClick={handleCreateDraft}
              disabled={isPending}
              className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-md text-xs font-bold transition cursor-pointer"
            >
              + 새 Draft 편집 시작
            </button>
          )}

          {isDraftMode && (
            <>
              <button
                onClick={handleDiscardDraft}
                disabled={isPending}
                className="h-9 px-4 border border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-md text-xs font-bold transition cursor-pointer"
              >
                Draft 폐기 (Discard)
              </button>
              <button
                onClick={handleValidateConfig}
                disabled={isPending}
                className="h-9 px-4 border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-xs font-bold transition cursor-pointer"
              >
                유효성 검사 (Validate)
              </button>
              <button
                onClick={handlePublishConfig}
                disabled={isPending || !canPublish}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={!canPublish ? "배포 권한은 Super Admin만 보유합니다." : ""}
              >
                정식 배포 (Publish)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Validation status report */}
      {validationRun && (
        <div className={`p-4 rounded-lg border text-xs leading-normal ${validationErrors.length === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400" : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400"}`}>
          <div className="font-bold mb-1">🔍 드래프트 유효성 검사 리포트</div>
          {validationErrors.length === 0 ? (
            <p>축하합니다! 시뮬레이터 배포 안전 유효성 검사를 정상적으로 통과했습니다. 배포 가능 상태입니다.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-850 gap-2 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? "border-zinc-900 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div className="space-y-4">
        {/* ========================================== */}
        {/* 1. QUESTIONNAIRE TAB                       */}
        {/* ========================================== */}
        {activeTab === "questionnaire" && (
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                    <th className="px-4 py-3 font-semibold w-16 text-center">순서</th>
                    <th className="px-4 py-3 font-semibold w-20 text-center">코드</th>
                    <th className="px-4 py-3 font-semibold">질문 (Korean Label)</th>
                    <th className="px-4 py-3 font-semibold">질문 (English Label)</th>
                    <th className="px-4 py-3 font-semibold">유형</th>
                    <th className="px-4 py-3 font-semibold text-center">필수</th>
                    <th className="px-4 py-3 font-semibold text-center">상태</th>
                    <th className="px-4 py-3 font-semibold text-right w-36">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {questions.map((q) => {
                    const qAnswers = answers.filter((a) => a.question_id === q.id);
                    return (
                      <React.Fragment key={q.id}>
                        <tr className="hover:bg-zinc-50/20 dark:hover:bg-zinc-900/20 font-semibold bg-zinc-50/10 dark:bg-zinc-900/10">
                          <td className="px-4 py-3 text-center">{q.display_order}</td>
                          <td className="px-4 py-3 text-center font-mono text-[10px]">{q.question_id}</td>
                          <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">{q.label_ko}</td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{q.label_en}</td>
                          <td className="px-4 py-3 font-medium uppercase text-[10px]">{q.type}</td>
                          <td className="px-4 py-3 text-center">{q.is_optional ? "N" : "Y"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded-full h-2 w-2 ${q.is_active ? "bg-emerald-500" : "bg-zinc-300"}`} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isDraftMode && (
                              <button
                                onClick={() => setEditingQuestion(q)}
                                className="font-bold text-[#ff2b75] hover:underline mr-3 cursor-pointer"
                              >
                                수정
                              </button>
                            )}
                            {isDraftMode && (
                              <button
                                onClick={() =>
                                  setNewAnswerOpt({
                                    questionUuid: q.id,
                                    answerId: `${q.question_id}_A${qAnswers.length + 1}`,
                                    labelKo: "",
                                    labelEn: "",
                                    displayOrder: qAnswers.length + 1,
                                  })
                                }
                                className="font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:underline cursor-pointer"
                              >
                                + 답변 옵션
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Nested Answer Options rows */}
                        {qAnswers.map((ans) => (
                          <tr key={ans.id} className="hover:bg-zinc-50/10 dark:hover:bg-zinc-900/10 text-[11px] text-zinc-400 bg-zinc-50/5 dark:bg-zinc-900/5">
                            <td />
                            <td className="px-4 py-2 font-mono text-[9.5px] text-center text-zinc-350">{ans.answer_id}</td>
                            <td className="px-4 py-2 pl-8 text-zinc-500">{ans.label_ko}</td>
                            <td className="px-4 py-2 text-zinc-500">{ans.label_en}</td>
                            <td colSpan={3} />
                            <td className="px-4 py-2 text-right">
                              {isDraftMode && (
                                <button
                                  onClick={() => handleToggleAnswerStatus(ans.id, ans.is_active)}
                                  className={`text-[10px] font-bold ${ans.is_active ? "text-amber-500 hover:text-amber-600" : "text-emerald-500 hover:text-emerald-600"} hover:underline cursor-pointer`}
                                >
                                  {ans.is_active ? "비활성" : "활성화"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 2. MAPPING TAB                             */}
        {/* ========================================== */}
        {activeTab === "mapping" && (
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                    <th className="px-4 py-3 font-semibold w-24">답변 ID</th>
                    <th className="px-4 py-3 font-semibold">답변 내용 (Korean Label)</th>
                    <th className="px-4 py-3 font-semibold text-center">Display 신호</th>
                    <th className="px-4 py-3 font-semibold text-center">AP 태그</th>
                    <th className="px-4 py-3 font-semibold text-center">제약조건</th>
                    <th className="px-4 py-3 font-semibold text-center">Turnover 신호</th>
                    <th className="px-4 py-3 font-semibold">Business Rationale</th>
                    <th className="px-4 py-3 font-semibold text-right w-20">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {answers.map((ans) => {
                    const m = allMappings.find((map) => map.answer_id === ans.id) || {};
                    return (
                      <tr key={ans.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                        <td className="px-4 py-3 font-mono text-[10px] font-bold text-zinc-900 dark:text-white">
                          {ans.answer_id}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          {ans.label_ko}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.display_signal ? (
                            <span className="inline-block rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-bold">
                              {m.display_signal} · {m.display_strength}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.tag_code ? (
                            <span className="inline-block rounded bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-1.5 py-0.5 font-bold">
                              {m.tag_code} · {m.tag_strength}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-rose-600 dark:text-rose-400">
                          {m.hard_constraint || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.turnover_direction ? (
                            <span className={`inline-block rounded px-1.5 py-0.5 font-bold ${m.turnover_direction === "POSITIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20" : "bg-rose-50 text-rose-700 dark:bg-rose-950/20"}`}>
                              {m.turnover_category} · {m.turnover_direction}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 max-w-xs truncate" title={m.business_rationale}>
                          {m.business_rationale || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDraftMode && (
                            <button
                              onClick={() => setEditingMapping({ answer_id: ans.id, answer_label: ans.label_ko, answer_code: ans.answer_id, ...m })}
                              className="font-bold text-[#ff2b75] hover:underline cursor-pointer"
                            >
                              수정
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 3. CALIBRATION TAB                         */}
        {/* ========================================== */}
        {activeTab === "calibration" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">시뮬레이션 산정 파라미터 관리</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parameters
                .filter((p) => !["global_gross_margin", "program_defaults"].includes(p.parameter_key))
                .map((p) => {
                  const isEditing = editingParamKey === p.parameter_key;
                  return (
                    <div key={p.id} className="border border-zinc-100 dark:border-zinc-800 p-4 rounded-lg flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono text-xs font-bold text-zinc-850 dark:text-zinc-200">{p.parameter_key}</span>
                          <span className="text-[10px] text-zinc-400">Questionnaire v{selectedQn?.version}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-normal mb-3">
                          {p.parameter_key === "display_weights" && "매대 규격 가중치 (Weak, Medium, Strong)"}
                          {p.parameter_key === "tag_weights" && "AP 매칭 태그 가중치 (Weak, Medium, Strong)"}
                          {p.parameter_key === "q5_rank_weights" && "Q5 매칭 품목 가중치 (1순위, 2순위, 3순위)"}
                          {p.parameter_key === "q35_base_turns" && "Q35 매장 공간별 기본 연재고 회전율"}
                          {p.parameter_key === "q37_multipliers" && "Q37 취급 품목 수에 따른 회전율 멀티플라이어"}
                          {p.parameter_key === "turnover_scenarios" && "재무 시나리오 계수 (Conservative, Expected, Growth)"}
                          {p.parameter_key === "confidence_rules" && "신뢰도 지수 산출 감점 규칙 및 HIGH/GOOD 커스텀 임계값"}
                        </p>
                        {isEditing ? (
                          <textarea
                            value={editingParamValue}
                            onChange={(e) => setEditingParamValue(e.target.value)}
                            rows={6}
                            className="w-full text-xs font-mono p-2 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-950 text-white"
                          />
                        ) : (
                          <pre className="p-3 bg-zinc-900 text-[10.5px] font-mono text-zinc-300 rounded overflow-auto max-h-[150px] dark:bg-black/45 border border-zinc-800">
                            {JSON.stringify(p.parameter_value, null, 2)}
                          </pre>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        {isDraftMode && (
                          isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveParameter(p.parameter_key, editingParamValue)}
                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition cursor-pointer"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => setEditingParamKey(null)}
                                className="h-8 px-3 border border-zinc-200 hover:bg-zinc-50 rounded text-xs font-bold transition cursor-pointer text-zinc-650"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingParamKey(p.parameter_key);
                                setEditingParamValue(JSON.stringify(p.parameter_value, null, 2));
                              }}
                              className="h-8 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white rounded text-xs font-bold transition cursor-pointer"
                            >
                              값 편집
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 4. FINANCIAL TAB                           */}
        {/* ========================================== */}
        {activeTab === "financial" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">재무 기본 가정 및 매대 초기 구매 설정</h2>
            
            {/* Financial Parameters edit */}
            {(() => {
              const grossMarginParam = parameters.find((p) => p.parameter_key === "global_gross_margin");
              const programDefaultsParam = parameters.find((p) => p.parameter_key === "program_defaults");

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="space-y-4 border border-zinc-100 dark:border-zinc-800 p-4 rounded-lg">
                    <span className="font-bold text-zinc-900 dark:text-white text-sm">기본 총마진율 (Gross Margin)</span>
                    <p className="text-[11px] leading-normal text-zinc-400">
                      고객 매칭 연동 시 expected gross profit 계산을 위한 시스템 디폴트 총 마진율 상수입니다.
                    </p>
                    <div className="flex items-center gap-3">
                      <strong className="text-2xl text-zinc-950 dark:text-white">
                        {(grossMarginParam?.parameter_value * 100).toFixed(0)}%
                      </strong>
                      {isDraftMode && (
                        <button
                          onClick={() => {
                            const newMargin = prompt("새로운 마진율을 입력하세요 (예: 0.55 = 55%):", grossMarginParam?.parameter_value);
                            if (newMargin !== null && !isNaN(Number(newMargin))) {
                              handleSaveParameter("global_gross_margin", newMargin);
                            }
                          }}
                          className="h-8 px-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded text-[11px] font-bold cursor-pointer hover:opacity-90"
                        >
                          변경
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 border border-zinc-100 dark:border-zinc-800 p-4 rounded-lg">
                    <span className="font-bold text-zinc-900 dark:text-white text-sm">매대별 초기 상품 구매액 (Initial Product Purchase)</span>
                    <p className="text-[11px] leading-normal text-zinc-400">
                      매대 규격(START, GROW, EXPAND)별 초기 구매 예산 기본값입니다. (Wording: Investment 단어 사용 안함)
                    </p>
                    <div className="space-y-2">
                      {programDefaultsParam && Object.entries(programDefaultsParam.parameter_value).map(([key, val]: any) => (
                        <div key={key} className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-1.5">
                          <span className="font-bold">{key} ({val.label})</span>
                          <div className="flex items-center gap-2">
                            <strong className="text-zinc-900 dark:text-white">${val.cost?.toLocaleString()}</strong>
                            {isDraftMode && (
                              <button
                                onClick={() => {
                                  const newCost = prompt(`${key}의 새로운 초기 상품 구매액을 입력하세요 ($):`, val.cost);
                                  if (newCost !== null && !isNaN(Number(newCost))) {
                                    const updated = { ...programDefaultsParam.parameter_value };
                                    updated[key].cost = Number(newCost);
                                    handleSaveParameter("program_defaults", JSON.stringify(updated));
                                  }
                                }}
                                className="text-[10px] text-[#ff2b75] hover:underline cursor-pointer font-bold"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================== */}
        {/* 5. VERSIONS TAB                            */}
        {/* ========================================== */}
        {activeTab === "versions" && (
          <div className="space-y-6">
            {/* Versions History */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">시뮬레이터 설정 번들 버전 이력 (Questionnaire Version History)</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <thead>
                    <tr className="border-b border-zinc-200 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white bg-zinc-50/50 dark:bg-zinc-900/50">
                      <th className="px-4 py-3 font-semibold text-center w-20">버전</th>
                      <th className="px-4 py-3 font-semibold text-center w-24">상태</th>
                      <th className="px-4 py-3 font-semibold">설명 / Notes</th>
                      <th className="px-4 py-3 font-semibold">배포 일자</th>
                      <th className="px-4 py-3 font-semibold">생성일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {questionnaires.map((qn) => {
                      const badgeClass =
                        qn.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40"
                          : qn.status === "draft"
                          ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40"
                          : "bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700";

                      return (
                        <tr key={qn.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                          <td className="px-4 py-3 text-center font-bold font-mono">v{qn.version}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded px-1.5 py-0.5 border text-[10px] font-bold uppercase ${badgeClass}`}>
                              {qn.status === "active" ? "PUBLISHED" : qn.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium">{qn.notes || "-"}</td>
                          <td className="px-4 py-3">{qn.published_at ? new Date(qn.published_at).toLocaleString("ko-KR") : "-"}</td>
                          <td className="px-4 py-3">{new Date(qn.created_at).toLocaleDateString("ko-KR")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">최근 설정 변경 감사 로그 (Recent Configuration Audit Logs)</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <thead>
                    <tr className="border-b border-zinc-200 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white bg-zinc-50/50 dark:bg-zinc-900/50">
                      <th className="px-4 py-3 font-semibold w-40">일시</th>
                      <th className="px-4 py-3 font-semibold w-36">작업자 (Actor)</th>
                      <th className="px-4 py-3 font-semibold w-24">상태 전환</th>
                      <th className="px-4 py-3 font-semibold">변경 설명 (Reason)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                        <td className="px-4 py-3">{new Date(log.created_at).toLocaleString("ko-KR")}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">{log.changed_by_name}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold uppercase text-[9.5px]">
                            {log.before_state} → {log.after_state}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-650 dark:text-zinc-300 font-medium">{log.reason}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-zinc-400">
                          감사 기록이 존재하지 않습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 6. MODALS / DIALOGS (Question & Mappings)  */}
      {/* ========================================== */}
      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-lg w-full text-left space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">질문 속성 수정 (Edit Question: {editingQuestion.question_id})</h3>
            <div className="space-y-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">질문 라벨 (Korean) *</label>
                <input
                  type="text"
                  value={editingQuestion.label_ko || ""}
                  onChange={(e) => setEditingQuestion((p: any) => ({ ...p, label_ko: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">질문 라벨 (English) *</label>
                <input
                  type="text"
                  value={editingQuestion.label_en || ""}
                  onChange={(e) => setEditingQuestion((p: any) => ({ ...p, label_en: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-zinc-400 font-bold">질문 유형 (Type)</label>
                  <select
                    value={editingQuestion.type || ""}
                    onChange={(e) => setEditingQuestion((p: any) => ({ ...p, type: e.target.value }))}
                    className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 text-zinc-800 dark:text-white focus:outline-none"
                  >
                    <option value="select">단일 선택 (Select)</option>
                    <option value="multiselect">다중 선택 (Multiselect)</option>
                    <option value="range_card">범위선택 카드 (Range Card)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-zinc-400 font-bold">정렬 순서 (Order)</label>
                  <input
                    type="number"
                    value={editingQuestion.display_order || 0}
                    onChange={(e) => setEditingQuestion((p: any) => ({ ...p, display_order: e.target.value }))}
                    className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4 items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingQuestion.is_optional || false}
                    onChange={(e) => setEditingQuestion((p: any) => ({ ...p, is_optional: e.target.checked }))}
                    className="accent-zinc-900"
                  />
                  <span>건너뛰기 허용 (Optional)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingQuestion.is_active || false}
                    onChange={(e) => setEditingQuestion((p: any) => ({ ...p, is_active: e.target.checked }))}
                    className="accent-zinc-900"
                  />
                  <span>활성화 상태 (Active)</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleSaveQuestion}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white rounded text-xs font-bold transition cursor-pointer"
              >
                저장
              </button>
              <button
                onClick={() => setEditingQuestion(null)}
                className="h-9 px-4 border border-zinc-200 hover:bg-zinc-50 rounded text-xs font-bold transition cursor-pointer text-zinc-650"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Answer Option Modal */}
      {newAnswerOpt && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-lg w-full text-left space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">새 답변 옵션 추가 (Add Answer Option)</h3>
            <div className="space-y-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">답변 코드 (Answer ID, e.g. Q1_A4) *</label>
                <input
                  type="text"
                  value={newAnswerOpt.answerId || ""}
                  onChange={(e) => setNewAnswerOpt((p: any) => ({ ...p, answerId: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">답변 내용 (Korean) *</label>
                <input
                  type="text"
                  value={newAnswerOpt.labelKo || ""}
                  onChange={(e) => setNewAnswerOpt((p: any) => ({ ...p, labelKo: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">답변 내용 (English) *</label>
                <input
                  type="text"
                  value={newAnswerOpt.labelEn || ""}
                  onChange={(e) => setNewAnswerOpt((p: any) => ({ ...p, labelEn: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">정렬 순서 (Order) *</label>
                <input
                  type="number"
                  value={newAnswerOpt.displayOrder || 0}
                  onChange={(e) => setNewAnswerOpt((p: any) => ({ ...p, displayOrder: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 text-zinc-800 dark:text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleAddAnswerOption}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white rounded text-xs font-bold transition cursor-pointer"
              >
                추가
              </button>
              <button
                onClick={() => setNewAnswerOpt(null)}
                className="h-9 px-4 border border-zinc-200 hover:bg-zinc-50 rounded text-xs font-bold transition cursor-pointer text-zinc-650"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mapping Modal */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-2xl w-full text-left space-y-4 overflow-y-auto max-h-[90vh]">
            <div>
              <span className="font-mono text-[9px] text-[#ff2b75] font-black uppercase">ANSWER ENGINE MAPPING</span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                매핑 수정: {editingMapping.answer_code} ({editingMapping.answer_label})
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Display Signal */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Display Signal</label>
                <select
                  value={editingMapping.display_signal || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, display_signal: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">NEUTRAL (없음)</option>
                  <option value="START">START</option>
                  <option value="GROW">GROW</option>
                  <option value="EXPAND">EXPAND</option>
                </select>
              </div>

              {/* Display Strength */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Display Strength</label>
                <select
                  value={editingMapping.display_strength || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, display_strength: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">없음</option>
                  <option value="WEAK_EVIDENCE">WEAK (약함)</option>
                  <option value="MEDIUM_EVIDENCE">MEDIUM (중간)</option>
                  <option value="STRONG_EVIDENCE">STRONG (강함)</option>
                </select>
              </div>

              {/* AP Tag code selector */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Matching Tag Code (from DB matching_tags)</label>
                <select
                  value={editingMapping.tag_code || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, tag_code: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">매칭 태그 없음</option>
                  {matchingTags.map((t) => (
                    <option key={t.tag_code} value={t.tag_code}>
                      {t.tag_code} ({t.tag_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag Strength */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Tag Strength</label>
                <select
                  value={editingMapping.tag_strength || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, tag_strength: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">없음</option>
                  <option value="WEAK">WEAK (약함)</option>
                  <option value="MEDIUM">MEDIUM (중간)</option>
                  <option value="STRONG">STRONG (강함)</option>
                </select>
              </div>

              {/* Hard Constraint */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Hard Constraint</label>
                <select
                  value={editingMapping.hard_constraint || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, hard_constraint: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none text-rose-600 dark:text-rose-400 font-bold"
                >
                  <option value="">없음</option>
                  <option value="EXCLUDE_GROW_EXPAND">EXCLUDE_GROW_EXPAND (GROW, EXPAND 배제)</option>
                  <option value="EXCLUDE_EXPAND">EXCLUDE_EXPAND (EXPAND 배제)</option>
                </select>
              </div>

              {/* Confidence Signal */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Confidence Signal</label>
                <select
                  value={editingMapping.confidence_signal || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, confidence_signal: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">없음</option>
                  <option value="MINOR_INFO_MISSING">MINOR_INFO_MISSING</option>
                  <option value="IMPORTANT_INFO_MISSING">IMPORTANT_INFO_MISSING</option>
                  <option value="CRITICAL_BEHAVIORAL_MISSING">CRITICAL_BEHAVIORAL_MISSING</option>
                  <option value="DO_NOT_TRACK">DO_NOT_TRACK</option>
                  <option value="MEDIUM_CONTRADICTION">MEDIUM_CONTRADICTION</option>
                  <option value="HIGH_CONTRADICTION">HIGH_CONTRADICTION</option>
                </select>
              </div>

              {/* Turnover Category */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Turnover Category</label>
                <select
                  value={editingMapping.turnover_category || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, turnover_category: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">없음</option>
                  <option value="DEMAND_VELOCITY">DEMAND_VELOCITY (수요)</option>
                  <option value="REPLENISHMENT_CAPABILITY">REPLENISHMENT_CAPABILITY (보충)</option>
                </select>
              </div>

              {/* Turnover Direction */}
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 font-bold">Turnover Direction</label>
                <select
                  value={editingMapping.turnover_direction || ""}
                  onChange={(e) => setEditingMapping((p: any) => ({ ...p, turnover_direction: e.target.value || null }))}
                  className="h-9 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded px-2 focus:outline-none"
                >
                  <option value="">없음</option>
                  <option value="POSITIVE">POSITIVE (+ 가속)</option>
                  <option value="NEGATIVE">NEGATIVE (- 감속)</option>
                </select>
              </div>
            </div>

            {/* Business Rationale text area */}
            <div className="flex flex-col gap-1 text-xs">
              <label className="text-zinc-400 font-bold">Business Rationale (가중치 설정 근거 및 이력 기록) *</label>
              <textarea
                value={editingMapping.business_rationale || ""}
                onChange={(e) => setEditingMapping((p: any) => ({ ...p, business_rationale: e.target.value }))}
                rows={3}
                required
                className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-955 focus:outline-none"
                placeholder="상세 비즈니스 논리 및 매핑 변경 목적 설명..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleSaveMapping}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white rounded text-xs font-bold transition cursor-pointer"
              >
                저장
              </button>
              <button
                onClick={() => setEditingMapping(null)}
                className="h-9 px-4 border border-zinc-200 hover:bg-zinc-50 rounded text-xs font-bold transition cursor-pointer text-zinc-650"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
