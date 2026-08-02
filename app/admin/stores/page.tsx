import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { mockStores, mockPlacements } from "@/lib/data/mockData";

export const metadata: Metadata = {
  title: "리테일 네트워크 | K SELECT NETWORK 어드민",
};

export default async function AdminStoresPage() {
  await verifyAdminSession();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">리테일 네트워크 (Stores & Placements)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          오프라인 매장 진열 정보, 입점 제품 진열 모듈(Shelf Placements) 및 재고 현황을 모니터링합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stores List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">매장 목록 (Stores)</h2>
            <div className="space-y-3">
              {mockStores.map((store) => (
                <div
                  key={store.id}
                  className="rounded border border-zinc-100 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">{store.name}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {store.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">{store.address}</p>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>진열 제품: {store.activeProducts}개</span>
                    <span className="font-bold text-emerald-600">{store.salesStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Placements Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">진열 모듈 관리 (Placement Matrix)</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-150 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                    <th className="py-2.5">매장</th>
                    <th className="py-2.5">진열 모듈</th>
                    <th className="py-2.5">위치(Shelf)</th>
                    <th className="py-2.5">제품명</th>
                    <th className="py-2.5 text-center">현재 재고</th>
                    <th className="py-2.5 text-center">주간 판매량</th>
                    <th className="py-2.5 text-right">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {mockPlacements.map((placement) => {
                    const statusClass =
                      placement.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300";

                    return (
                      <tr key={placement.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                        <td className="py-3 font-semibold text-zinc-900 dark:text-white">{placement.storeName}</td>
                        <td className="py-3">{placement.module}</td>
                        <td className="py-3">{placement.shelf}</td>
                        <td className="py-3 font-semibold text-zinc-900 dark:text-white">{placement.productName}</td>
                        <td className="py-3 text-center font-bold text-zinc-950 dark:text-white">{placement.currentInventory}</td>
                        <td className="py-3 text-center">{placement.weeklySales}</td>
                        <td className="py-3 text-right">
                          <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${statusClass}`}>
                            {placement.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
