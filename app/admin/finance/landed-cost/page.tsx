import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getLandedCostCases } from "@/lib/landed-cost/actions";
import { CasesList } from "@/components/admin/landed-cost/cases-list";

export const metadata: Metadata = {
  title: "Landed Cost 원가 정산 관리 | K SELECT NETWORK 어드민",
};

export default async function LandedCostCasesPage() {
  await verifyAdminSession();
  
  const cases = await getLandedCostCases();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">Landed Cost 정산 케이스 (Consolidated Cases)</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            동일/복수 선적 건(Shipments)에 대한 운송, 관세, 통관 수수료 등의 공통비용을 취합하고 CBM, 무게, 가액 비율 기준으로 SKU별 최종 입고 단가(Unit Landed Cost)를 확정합니다.
          </p>
        </div>
        <Link
          href="/admin/finance/landed-cost/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          + 정산 케이스 생성 (New Case)
        </Link>
      </div>

      <CasesList initialCases={cases} />
    </div>
  );
}
