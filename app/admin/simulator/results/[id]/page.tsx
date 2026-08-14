import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSimulationResultDetail } from "@/lib/simulator/admin";
import SimulationDetailClient from "./detail-client";

export const metadata: Metadata = {
  title: "시뮬레이션 상세 결과 | K SELECT NETWORK 어드민",
};

export const dynamic = "force-dynamic";

export default async function SimulationResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdminSession();
  const { id } = await params;

  const detail = await getSimulationResultDetail(id);
  if (!detail) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
        시뮬레이션 상세 내역을 찾을 수 없거나 데이터베이스 오류가 발생했습니다. (ID: {id})
      </div>
    );
  }

  const { row, labelMapping } = detail;

  return (
    <SimulationDetailClient
      id={row.id}
      created_at={row.created_at}
      email={row.email}
      result_snapshot={row.result_snapshot}
      calculation_trace={row.calculation_trace}
      labelMapping={labelMapping}
      answers_snapshot={row.answers_snapshot}
      questionnaire_version={row.questionnaire_version}
      mapping_version={row.mapping_version}
      calibration_version={row.calibration_version}
      engine_version={row.engine_version}
      financial_assumption_version={row.financial_assumption_version}
    />
  );
}
