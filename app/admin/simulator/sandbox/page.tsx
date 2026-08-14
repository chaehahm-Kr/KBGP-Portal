import React from "react";
import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import SimulatorSandboxClient from "./sandbox-client";

export const metadata: Metadata = {
  title: "시뮬레이터 샌드박스 | K SELECT NETWORK 어드민",
};

export const dynamic = "force-dynamic";

async function getQuestionsAndAnswers() {
  const supabase = createAdminClient();

  // 1. Fetch active questionnaire
  const { data: questionnaire } = await supabase
    .from('simulator_questionnaires')
    .select('id, version')
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (!questionnaire) {
    return { questions: [], version: 0 };
  }

  // 2. Fetch questions and answers
  const { data: questions } = await supabase
    .from('simulator_questions')
    .select('id, question_id, label_ko, label_en, type, section, display_order')
    .eq('questionnaire_id', questionnaire.id)
    .order('display_order', { ascending: true });

  const { data: answers } = await supabase
    .from('simulator_answers')
    .select('id, question_id, answer_id, label_ko, label_en, display_order')
    .order('display_order', { ascending: true });

  // Map answers to questions
  const mappedQuestions = (questions || []).map((q: any) => {
    return {
      ...q,
      answers: (answers || []).filter((a: any) => a.question_id === q.id)
    };
  });

  return {
    questions: mappedQuestions,
    version: questionnaire.version
  };
}

export default async function SimulatorSandboxPage() {
  // Verify admin session
  await verifyAdminSession();

  const { questions, version } = await getQuestionsAndAnswers();

  return (
    <div className="w-full space-y-6">
      <SimulatorSandboxClient questions={questions} version={version} />
    </div>
  );
}
