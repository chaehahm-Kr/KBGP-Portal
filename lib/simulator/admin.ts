import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Custom type for Simulator Audit Log
export interface SimulatorAuditLog {
  changed_by: string;
  changed_at: string;
  version: number;
  change_type: string;
  reason?: string;
}

/**
 * Fetch overview dashboard stats from simulation_results
 */
export async function getSimulatorOverviewStats() {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("simulation_results")
    .select("id, created_at, result_snapshot");

  if (error) {
    console.error("Error fetching overview stats:", error);
    return null;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let liveSimulations = 0;
  let sandboxSimulations = 0;
  let last7Days = 0;
  let last30Days = 0;

  const displayDistribution: Record<string, number> = { START: 0, GROW: 0, EXPAND: 0 };
  const apDistribution: Record<string, number> = {
    BALANCE: 0,
    SKIN: 0,
    HAIR: 0,
    ESSENTIAL: 0,
    TREND: 0,
    PREMIUM: 0,
  };
  const confidenceDistribution: Record<string, number> = { HIGH: 0, GOOD: 0, BASIC: 0 };
  const budgetDistribution: Record<string, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    "VERY LOW": 0,
  };

  const results = rows || [];

  results.forEach((row) => {
    const res = (row.result_snapshot as any) || {};
    if (res.is_sandbox) {
      sandboxSimulations++;
      return; // Exclude sandbox from live business analytics
    }

    liveSimulations++;
    const createdAt = new Date(row.created_at);
    if (createdAt >= sevenDaysAgo) last7Days++;
    if (createdAt >= thirtyDaysAgo) last30Days++;

    // Recommended Display
    const displayProg = res.display?.program;
    if (displayProg && displayProg in displayDistribution) {
      displayDistribution[displayProg]++;
    }

    // Primary AP
    const primaryAp = res.assortment?.primary;
    if (primaryAp && primaryAp in apDistribution) {
      apDistribution[primaryAp]++;
    }

    // Confidence Level
    const confLevel = res.confidence?.level;
    if (confLevel && confLevel in confidenceDistribution) {
      confidenceDistribution[confLevel]++;
    }

    // Budget Fit
    const budgetFit = res.financial?.budget_fit;
    if (budgetFit && budgetFit in budgetDistribution) {
      budgetDistribution[budgetFit]++;
    }
  });

  return {
    totalSimulations: liveSimulations,
    sandboxSimulations,
    last7Days,
    last30Days,
    displayDistribution,
    apDistribution,
    confidenceDistribution,
    budgetDistribution,
  };
}

/**
 * Fetch paginated, filtered, sorted simulation results
 */
export async function getSimulationResultsList({
  search = "",
  type = "LIVE", // "LIVE" | "SANDBOX" | "ALL"
  display = "",
  primaryAp = "",
  confidence = "",
  budgetFit = "",
  followupStatus = "",
  sortBy = "newest",
  page = 1,
  limit = 20,
}: {
  search?: string;
  type?: string;
  display?: string;
  primaryAp?: string;
  confidence?: string;
  budgetFit?: string;
  followupStatus?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = createAdminClient();

  let query = supabase
    .from("simulation_results")
    .select("id, created_at, email, result_snapshot, questionnaire_version, calibration_version", { count: "exact" });

  // Filtering
  if (display) {
    query = query.eq("result_snapshot->display->>program", display);
  }
  if (primaryAp) {
    query = query.eq("result_snapshot->assortment->>primary", primaryAp);
  }
  if (confidence) {
    query = query.eq("result_snapshot->confidence->>level", confidence);
  }
  if (budgetFit) {
    query = query.eq("result_snapshot->financial->>budget_fit", budgetFit);
  }

  const { data: rows, error, count } = await query;

  if (error) {
    console.error("Error fetching simulation results:", error);
    return { data: [], total: 0 };
  }

  let results = rows || [];

  // Live vs Sandbox filtering (Default: LIVE)
  if (type === "LIVE") {
    results = results.filter((r) => {
      const snap = (r.result_snapshot as any) || {};
      return !snap.is_sandbox;
    });
  } else if (type === "SANDBOX") {
    results = results.filter((r) => {
      const snap = (r.result_snapshot as any) || {};
      return snap.is_sandbox === true;
    });
  }

  // Follow-up status filtering
  if (followupStatus) {
    results = results.filter((r) => {
      const snap = (r.result_snapshot as any) || {};
      const status = snap.followup_status || "NEW";
      return status === followupStatus;
    });
  }

  // Search filter (ID, Email, Store Name, Contact Name)
  if (search.trim()) {
    const s = search.toLowerCase();
    results = results.filter((r) => {
      const snap = (r.result_snapshot as any) || {};
      const storeName = (snap.retailer_info?.store_name || "").toLowerCase();
      const contactName = (snap.retailer_info?.contact_name || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const id = r.id.toLowerCase();
      return id.includes(s) || email.includes(s) || storeName.includes(s) || contactName.includes(s);
    });
  }

  // Sorting
  if (sortBy === "oldest") {
    results.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else {
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const total = results.length;
  const startIndex = (page - 1) * limit;
  const paginated = results.slice(startIndex, startIndex + limit);

  return {
    data: paginated,
    total,
  };
}



/**
 * Fetch detailed simulation result by UUID
 */
export async function getSimulationResultDetail(id: string) {
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("simulation_results")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    console.error("Error fetching simulation detail:", error);
    return null;
  }

  // Fetch questionnaire questions & answers to map Option IDs back to labels
  const qnVersion = row.questionnaire_version || 1;

  const { data: qn } = await supabase
    .from("simulator_questionnaires")
    .select("id")
    .eq("version", qnVersion)
    .maybeSingle();

  let labelMapping: Record<string, { qLabelKo: string; qLabelEn: string; aLabelKo: string; aLabelEn: string }> = {};

  if (qn) {
    const [
      { data: questions },
      { data: answers }
    ] = await Promise.all([
      supabase.from("simulator_questions").select("id, question_id, label_ko, label_en").eq("questionnaire_id", qn.id),
      supabase.from("simulator_answers").select("question_id, answer_id, label_ko, label_en")
    ]);

    const qMap: Record<string, { question_id: string; label_ko: string; label_en: string }> = {};
    questions?.forEach((q) => {
      qMap[q.id] = { question_id: q.question_id, label_ko: q.label_ko, label_en: q.label_en };
    });

    answers?.forEach((ans) => {
      const q = qMap[ans.question_id];
      if (q) {
        labelMapping[ans.answer_id] = {
          qLabelKo: q.label_ko,
          qLabelEn: q.label_en,
          aLabelKo: ans.label_ko,
          aLabelEn: ans.label_en,
        };
      }
    });
  }

  return {
    row,
    labelMapping,
  };
}

/**
 * Create a new draft configuration by cloning the current active configuration
 */
export async function createDraftConfigAction(userId: string) {
  const supabase = createAdminClient();

  // 1. Check if a draft already exists
  const { data: existingDraft } = await supabase
    .from("simulator_questionnaires")
    .select("id, version")
    .eq("status", "draft")
    .maybeSingle();

  if (existingDraft) {
    return { error: "이미 편집 중인 Draft 설정이 존재합니다." };
  }

  // 2. Find current active questionnaire
  const { data: activeQn } = await supabase
    .from("simulator_questionnaires")
    .select("*")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeQn) {
    return { error: "활성화된(Active) 기존 Questionnaire를 찾을 수 없습니다." };
  }

  // 3. Create new draft questionnaire
  const nextVersion = activeQn.version + 1;
  const { data: newQn, error: newQnErr } = await supabase
    .from("simulator_questionnaires")
    .insert({
      version: nextVersion,
      status: "draft",
      created_by: userId,
    })
    .select()
    .single();

  if (newQnErr || !newQn) {
    return { error: `Draft 생성 실패: ${newQnErr?.message}` };
  }

  const draftId = newQn.id;

  // 4. Fetch all active config rows to copy
  const [
    { data: activeQuestions },
    { data: activeAnswers },
    { data: activeParameters },
    { data: activeRules }
  ] = await Promise.all([
    supabase.from("simulator_questions").select("*").eq("questionnaire_id", activeQn.id),
    supabase.from("simulator_answers").select("*"),
    supabase.from("simulator_parameters").select("*").eq("questionnaire_id", activeQn.id),
    supabase.from("simulator_conditional_rules").select("*").eq("questionnaire_id", activeQn.id)
  ]);

  // Clone questions
  const qIdMap: Record<string, string> = {}; // { oldQuestionUuid: newQuestionUuid }
  const oldQIdToNewQIdMap: Record<string, string> = {}; // { oldQuestionId: newQuestionUuid }

  if (activeQuestions) {
    for (const q of activeQuestions) {
      const qToInsert = { ...q };
      delete qToInsert.id;
      delete qToInsert.created_at;
      qToInsert.questionnaire_id = draftId;

      const { data: clonedQ } = await supabase
        .from("simulator_questions")
        .insert(qToInsert)
        .select()
        .single();

      if (clonedQ) {
        qIdMap[q.id] = clonedQ.id;
        oldQIdToNewQIdMap[q.question_id] = clonedQ.id;
      }
    }
  }

  // Clone answers
  const ansIdMap: Record<string, string> = {}; // { oldAnswerUuid: newAnswerUuid }
  if (activeAnswers) {
    const answersToClone = activeAnswers.filter((a) => a.question_id in qIdMap);
    for (const ans of answersToClone) {
      const ansToInsert = { ...ans };
      delete ansToInsert.id;
      delete ansToInsert.created_at;
      ansToInsert.question_id = qIdMap[ans.question_id];

      const { data: clonedAns } = await supabase
        .from("simulator_answers")
        .insert(ansToInsert)
        .select()
        .single();

      if (clonedAns) {
        ansIdMap[ans.id] = clonedAns.id;
      }
    }
  }

  // Clone parameters
  if (activeParameters) {
    for (const p of activeParameters) {
      const pToInsert = { ...p };
      delete pToInsert.id;
      delete pToInsert.created_at;
      pToInsert.questionnaire_id = draftId;

      await supabase.from("simulator_parameters").insert(pToInsert);
    }
  }

  // Clone conditional rules
  if (activeRules) {
    for (const r of activeRules) {
      const rToInsert = { ...r };
      delete rToInsert.id;
      delete rToInsert.created_at;
      rToInsert.questionnaire_id = draftId;

      await supabase.from("simulator_conditional_rules").insert(rToInsert);
    }
  }

  // Clone mappings (tie to the new answer UUIDs)
  const { data: activeMappings } = await supabase.from("simulator_answer_mappings").select("*");
  if (activeMappings) {
    const mappingsToClone = activeMappings.filter((m) => m.answer_id in ansIdMap);
    for (const m of mappingsToClone) {
      const mToInsert = { ...m };
      delete mToInsert.id;
      delete mToInsert.created_at;
      mToInsert.answer_id = ansIdMap[m.answer_id];

      await supabase.from("simulator_answer_mappings").insert(mToInsert);
    }
  }

  // Log audit activity
  await supabase.from("activity_logs").insert({
    entity_type: "simulator_questionnaire",
    entity_id: draftId,
    before_state: "active",
    after_state: "draft",
    changed_by: userId,
    reason: `Created draft configuration for Version ${nextVersion}`,
  });

  revalidatePath("/admin/simulator/configuration");
  return { success: true, draftId };
}

/**
 * Validate configuration settings in draft questionnaire
 */
export async function validateDraftConfig(draftId: string) {
  const supabase = createAdminClient();

  const [
    { data: questions },
    { data: answers },
    { data: parameters },
    { data: rules }
  ] = await Promise.all([
    supabase.from("simulator_questions").select("*").eq("questionnaire_id", draftId),
    supabase.from("simulator_answers").select("*"),
    supabase.from("simulator_parameters").select("*").eq("questionnaire_id", draftId),
    supabase.from("simulator_conditional_rules").select("*").eq("questionnaire_id", draftId)
  ]);

  const errors: string[] = [];

  if (!questions || questions.length === 0) {
    errors.push("질문 목록이 비어 있습니다.");
  }

  // Validate parameters
  const parameterKeys = (parameters || []).map((p) => p.parameter_key);
  const requiredKeys = ["display_weights", "tag_weights", "q5_rank_weights", "q35_base_turns", "q37_multipliers", "turnover_scenarios", "global_gross_margin", "program_defaults", "confidence_rules"];
  requiredKeys.forEach((key) => {
    if (!parameterKeys.includes(key)) {
      errors.push(`필수 파라미터가 누락되었습니다: ${key}`);
    }
  });

  // Validate mappings
  const qIds = (questions || []).map((q) => q.id);
  const draftAnswers = (answers || []).filter((a) => qIds.includes(a.question_id));
  const draftAnsIds = draftAnswers.map((a) => a.id);

  if (draftAnswers.length === 0) {
    errors.push("답변 옵션 목록이 비어 있습니다.");
  }

  const { data: mappings } = await supabase
    .from("simulator_answer_mappings")
    .select("*")
    .in("answer_id", draftAnsIds);

  const mappedAnsIds = (mappings || []).map((m) => m.answer_id);
  
  // Verify that active answers have a mapping
  draftAnswers.forEach((ans) => {
    if (ans.is_active && !mappedAnsIds.includes(ans.id)) {
      // Find parent question ID for better error message
      const parentQ = questions?.find((q) => q.id === ans.question_id);
      errors.push(`답변 매핑 누락: 질문 ${parentQ?.question_id || ""} - 답변 ${ans.answer_id}에 매핑이 없습니다.`);
    }
  });

  // Check matching tags exist in database
  const { data: validTags } = await supabase.from("matching_tags").select("tag_code");
  const tagCodes = (validTags || []).map((t) => t.tag_code);

  (mappings || []).forEach((m) => {
    if (m.tag_code && !tagCodes.includes(m.tag_code)) {
      errors.push(`존재하지 않는 매칭 태그 사용됨: ${m.tag_code}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Publish the current draft configuration
 */
export async function publishDraftConfigAction(draftId: string, userId: string) {
  const supabase = createAdminClient();

  // 1. Verify draft exists and fetch its version
  const { data: draft } = await supabase
    .from("simulator_questionnaires")
    .select("*")
    .eq("id", draftId)
    .eq("status", "draft")
    .maybeSingle();

  if (!draft) {
    return { error: "지정한 Draft 설정을 찾을 수 없습니다." };
  }

  // 2. Validate configuration
  const validation = await validateDraftConfig(draftId);
  if (!validation.isValid) {
    return { error: `퍼블리싱 불가: 유효성 검사 실패.\n${validation.errors.join("\n")}` };
  }

  // 3. Find current active questionnaire
  const { data: activeQn } = await supabase
    .from("simulator_questionnaires")
    .select("id")
    .eq("status", "active");

  // 4. Archive existing active questionnaire
  if (activeQn && activeQn.length > 0) {
    for (const active of activeQn) {
      await supabase
        .from("simulator_questionnaires")
        .update({ status: "archived" })
        .eq("id", active.id);
    }
  }

  // 5. Update draft questionnaire to active
  const { error: updateErr } = await supabase
    .from("simulator_questionnaires")
    .update({
      status: "active",
    })
    .eq("id", draftId);

  if (updateErr) {
    return { error: `활성화 업데이트 실패: ${updateErr.message}` };
  }

  // 6. Log audit activity
  await supabase.from("activity_logs").insert({
    entity_type: "simulator_questionnaire",
    entity_id: draftId,
    before_state: "draft",
    after_state: "active",
    changed_by: userId,
    reason: `Published Questionnaire Configuration Version ${draft.version}`,
  });

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}

/**
 * Discard / delete the current draft questionnaire
 */
export async function discardDraftConfigAction(draftId: string, userId: string) {
  const supabase = createAdminClient();

  const { data: draft } = await supabase
    .from("simulator_questionnaires")
    .select("id, version")
    .eq("id", draftId)
    .eq("status", "draft")
    .maybeSingle();

  if (!draft) {
    return { error: "삭제할 Draft 설정을 찾을 수 없습니다." };
  }

  // Delete draft questionnaire (cascade deletes questions, answers, parameters, mappings)
  const { error: delErr } = await supabase
    .from("simulator_questionnaires")
    .delete()
    .eq("id", draftId);

  if (delErr) {
    return { error: `Draft 삭제 실패: ${delErr.message}` };
  }

  // Log audit activity
  await supabase.from("activity_logs").insert({
    entity_type: "simulator_questionnaire",
    entity_id: draftId,
    before_state: "draft",
    after_state: "deleted",
    changed_by: userId,
    reason: `Discarded Draft Configuration Version ${draft.version}`,
  });

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}
