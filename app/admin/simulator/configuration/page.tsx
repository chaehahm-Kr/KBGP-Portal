import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import ConfigurationClient from "./configuration-client";

export const metadata: Metadata = {
  title: "시뮬레이터 설정 관리 | K SELECT NETWORK 어드민",
};

export const dynamic = "force-dynamic";

export default async function SimulatorConfigurationPage() {
  const session = await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch questionnaires list (versions)
  const { data: questionnaires } = await supabase
    .from("simulator_questionnaires")
    .select("*")
    .order("version", { ascending: false });

  const activeQn = (questionnaires || []).find((q) => q.status === "active") || null;
  const draftQn = (questionnaires || []).find((q) => q.status === "draft") || null;

  // 2. Fetch questions, answers, parameters, and conditional rules
  const [
    { data: allQuestions },
    { data: allAnswers },
    { data: allParameters },
    { data: allRules },
    { data: matchingTags },
    { data: auditLogs }
  ] = await Promise.all([
    supabase.from("simulator_questions").select("*").order("display_order", { ascending: true }),
    supabase.from("simulator_answers").select("*").order("display_order", { ascending: true }),
    supabase.from("simulator_parameters").select("*"),
    supabase.from("simulator_conditional_rules").select("*"),
    supabase.from("matching_tags").select("tag_code, tag_name").eq("is_active", true),
    supabase.from("activity_logs")
      .select("*")
      .eq("entity_type", "simulator_questionnaire")
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  // Fetch profiles map to resolve actor names for audit logs
  const { data: profiles } = await supabase.from("profiles").select("id, display_name");
  const nameMap = new Map((profiles || []).map((p) => [p.id, p.display_name || "알수없음"]));

  const resolvedAuditLogs = (auditLogs || []).map((log) => ({
    ...log,
    changed_by_name: nameMap.get(log.changed_by) || "시스템 / 관리자",
  }));

  // 3. Fetch current staff member profile to determine base_role (permissions)
  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("base_role")
    .eq("id", session.userId)
    .maybeSingle();

  const baseRole = staffMember?.base_role || "viewer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">성장 시뮬레이터 설정 관리</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          질문 구성, 답변 가중치 매핑, 시나리오 및 산정 파라미터를 관리하고 배포합니다.
        </p>
      </div>

      {/* Main Configuration Tabs Client Component */}
      <ConfigurationClient
        userId={session.userId}
        baseRole={baseRole}
        questionnaires={questionnaires || []}
        activeQn={activeQn}
        draftQn={draftQn}
        allQuestions={allQuestions || []}
        allAnswers={allAnswers || []}
        allParameters={allParameters || []}
        allRules={allRules || []}
        matchingTags={matchingTags || []}
        auditLogs={resolvedAuditLogs}
      />
    </div>
  );
}
