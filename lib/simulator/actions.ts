"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  createDraftConfigAction as createDraft,
  publishDraftConfigAction as publishDraft,
  discardDraftConfigAction as discardDraft,
  validateDraftConfig as validateDraft,
} from "./admin";

export async function updateSimulationFollowupAction({
  id,
  followupStatus,
  notes,
  assignedStaff
}: {
  id: string;
  followupStatus: string;
  notes?: string;
  assignedStaff?: string;
}) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("simulation_results")
    .select("result_snapshot")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    return { error: `Submission ${id}를 찾을 수 없습니다.` };
  }

  const snap = (row.result_snapshot as any) || {};
  snap.followup_status = followupStatus;
  if (notes !== undefined) snap.followup_notes = notes;
  if (assignedStaff !== undefined) snap.assigned_staff = assignedStaff;
  snap.last_followup_at = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("simulation_results")
    .update({ result_snapshot: snap })
    .eq("id", id);

  if (updateErr) {
    return { error: `상태 업데이트 실패: ${updateErr.message}` };
  }

  revalidatePath("/admin/simulator/results");
  revalidatePath(`/admin/simulator/results/${id}`);

  return { success: true };
}

// Re-export core draft actions with Admin session validation
export async function createDraftConfig(userId: string) {
  const session = await verifyAdminSession();
  const activeUserId = session.userId || userId;
  return createDraft(activeUserId);
}

export async function validateDraftConfigAction(draftId: string) {
  await verifyAdminSession();
  return validateDraft(draftId);
}

export async function publishDraftConfig(draftId: string, userId: string) {
  const session = await verifyAdminSession();
  const activeUserId = session.userId || userId;
  return publishDraft(draftId, activeUserId);
}

export async function discardDraftConfig(draftId: string, userId: string) {
  const session = await verifyAdminSession();
  const activeUserId = session.userId || userId;
  return discardDraft(draftId, activeUserId);
}

/**
 * Update draft question properties
 */
export async function updateQuestionAction(
  draftId: string,
  questionUuid: string,
  fields: {
    label_ko?: string;
    label_en?: string;
    type?: string;
    section?: string;
    display_order?: number;
    is_optional?: boolean;
    multi_select?: boolean;
    max_select?: number;
    is_active?: boolean;
    conditional_trigger?: any;
  }
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: q } = await supabase
    .from("simulator_questions")
    .select("id, question_id")
    .eq("id", questionUuid)
    .eq("questionnaire_id", draftId)
    .maybeSingle();

  if (!q) {
    return { error: "질문을 찾을 수 없거나 편집할 권한이 없습니다." };
  }

  const { error } = await supabase
    .from("simulator_questions")
    .update(fields)
    .eq("id", questionUuid);

  if (error) {
    return { error: `질문 업데이트 실패: ${error.message}` };
  }

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}

/**
 * Add a new answer option to a draft question
 */
export async function addAnswerOptionAction(
  draftId: string,
  questionUuid: string,
  answerId: string,
  labelKo: string,
  labelEn: string,
  displayOrder: number
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { data: q } = await supabase
    .from("simulator_questions")
    .select("id")
    .eq("id", questionUuid)
    .eq("questionnaire_id", draftId)
    .maybeSingle();

  if (!q) {
    return { error: "질문을 찾을 수 없거나 편집할 권한이 없습니다." };
  }

  const { data: newAns, error: ansErr } = await supabase
    .from("simulator_answers")
    .insert({
      question_id: questionUuid,
      answer_id: answerId,
      label_ko: labelKo,
      label_en: labelEn,
      display_order: displayOrder,
      is_active: true,
    })
    .select()
    .single();

  if (ansErr || !newAns) {
    return { error: `답변 옵션 추가 실패: ${ansErr?.message}` };
  }

  await supabase.from("simulator_answer_mappings").insert({
    answer_id: newAns.id,
    validation_status: "NEUTRAL_CONFIRMED",
    business_rationale: "Default neutral mapping created via admin console.",
  });

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}

/**
 * Update draft answer option properties
 */
export async function updateAnswerOptionAction(
  answerUuid: string,
  fields: {
    label_ko?: string;
    label_en?: string;
    display_order?: number;
    is_active?: boolean;
  }
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("simulator_answers")
    .update(fields)
    .eq("id", answerUuid);

  if (error) {
    return { error: `답변 업데이트 실패: ${error.message}` };
  }

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}

/**
 * Update answer mapping details in draft mode
 */
export async function updateMappingAction(
  answerUuid: string,
  fields: {
    tag_code?: string | null;
    tag_strength?: string | null;
    ap_signal_path?: string | null;
    direct_ap?: string | null;
    display_signal?: string | null;
    display_strength?: string | null;
    hard_constraint?: string | null;
    turnover_category?: string | null;
    turnover_direction?: string | null;
    financial_category?: string | null;
    confidence_signal?: string | null;
    business_rationale?: string | null;
    validation_status?: string | null;
  }
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("simulator_answer_mappings")
    .upsert({
      answer_id: answerUuid,
      ...fields,
    }, { onConflict: "answer_id" });

  if (error) {
    return { error: `매핑 업데이트 실패: ${error.message}` };
  }

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}

/**
 * Update parameter value in draft mode
 */
export async function updateParameterAction(
  draftId: string,
  key: string,
  value: any
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("simulator_parameters")
    .upsert({
      questionnaire_id: draftId,
      parameter_key: key,
      parameter_value: value,
    }, { onConflict: "questionnaire_id,parameter_key" });

  if (error) {
    return { error: `파라미터 업데이트 실패: ${error.message}` };
  }

  revalidatePath("/admin/simulator/configuration");
  return { success: true };
}
