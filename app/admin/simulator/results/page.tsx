import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSimulationResultsList } from "@/lib/simulator/admin";
import ResultsListClient from "./results-list-client";

export const metadata: Metadata = {
  title: "시뮬레이션 실행 결과 | K SELECT NETWORK 어드민",
};

export const dynamic = "force-dynamic";

export default async function SimulationResultsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    display?: string;
    primaryAp?: string;
    confidence?: string;
    budgetFit?: string;
    sortBy?: string;
    page?: string;
  }>;
}) {
  await verifyAdminSession();
  const params = await searchParams;

  const search = params.search || "";
  const display = params.display || "";
  const primaryAp = params.primaryAp || "";
  const confidence = params.confidence || "";
  const budgetFit = params.budgetFit || "";
  const sortBy = params.sortBy || "newest";
  const page = Number(params.page || "1");
  const limit = 20;

  const { data, total } = await getSimulationResultsList({
    search,
    display,
    primaryAp,
    confidence,
    budgetFit,
    sortBy,
    page,
    limit,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">시뮬레이션 결과 내역 (Simulation Results)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          마케팅 사이트 및 외부에서 수행된 시뮬레이터 실행 결과 목록과 상세 로그를 확인합니다.
        </p>
      </div>

      {/* Main List Client Component */}
      <ResultsListClient
        initialData={data}
        total={total}
        search={search}
        display={display}
        primaryAp={primaryAp}
        confidence={confidence}
        budgetFit={budgetFit}
        sortBy={sortBy}
        page={page}
        limit={limit}
      />
    </div>
  );
}
