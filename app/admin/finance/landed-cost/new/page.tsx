import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getEligibleShipmentsForLandedCost } from "@/lib/landed-cost/actions";
import { CaseForm } from "@/components/admin/landed-cost/case-form";

export const metadata: Metadata = {
  title: "신규 정산 케이스 생성 | K SELECT NETWORK 어드민",
};

export default async function NewLandedCostCasePage() {
  await verifyAdminSession();
  
  const eligibleShipments = await getEligibleShipmentsForLandedCost();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">정산 케이스 생성 (Consolidate Shipments)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          창고 도착 완료 및 재고 반영이 이루어진 미정산 선적 건들을 묶어 정산 케이스를 시작합니다.
        </p>
      </div>

      <CaseForm eligibleShipments={eligibleShipments} />
    </div>
  );
}
