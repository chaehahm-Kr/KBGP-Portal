import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { mockProducts } from "@/lib/data/mockData";

export const metadata: Metadata = {
  title: "아마존 런칭 | K SELECT NETWORK 어드민",
};

export default async function AdminAmazonPage() {
  await verifyAdminSession();
  // Filter mock products mapped to Amazon launching statuses
  const amazonProjects = mockProducts
    .filter((p) => p.amazonStatus !== "None")
    .map((p) => {
      // Inject realistic Amazon-specific parameters
      const asin = p.upc ? "B0" + p.upc.substring(4, 12) : "B08XMXXXXX";
      const fnsku = "X00" + p.sku.replace("-", "").toUpperCase();
      const rating = (Math.random() * 1.5 + 3.5).toFixed(1);
      const reviews = Math.floor(Math.random() * 500) + 12;
      const spend = Math.floor(Math.random() * 2000) + 200;
      const sales = spend * (Math.random() * 2 + 1.8);
      const acos = ((spend / sales) * 100).toFixed(1);

      return {
        ...p,
        asin,
        fnsku,
        rating,
        reviews,
        spend,
        sales,
        acos,
      };
    });

  const liveProjects = amazonProjects.filter((p) => p.amazonStatus === "Live");
  const launchingProjects = amazonProjects.filter((p) => p.amazonStatus === "Launching");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">아마존 런칭 파이프라인 (Amazon Launch)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          한국 뷰티 제품들의 미국 아마존(Amazon.com) 리스팅 등록, 통관 검역 FBA 물류 및 런칭 마케팅 성과를 추적합니다.
        </p>
      </div>

      {/* Kanban Pipeline Stages Layout */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Launching Pipeline */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">런칭 파이프라인 (Launching Pipeline)</h2>
          <div className="space-y-3">
            {launchingProjects.map((p) => (
              <div
                key={p.id}
                className="rounded border border-zinc-150 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                  <span>{p.company}</span>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    {p.amazonStatus}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white mt-1.5">{p.name}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
                  <p>ASIN: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{p.asin}</span></p>
                  <p>FNSKU: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{p.fnsku}</span></p>
                </div>
              </div>
            ))}
            {launchingProjects.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6">현재 파이프라인 단계의 프로젝트가 없습니다.</p>
            )}
          </div>
        </div>

        {/* Live on Amazon */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">아마존 판매 중 (Live on Amazon)</h2>
          <div className="space-y-3">
            {liveProjects.map((p) => (
              <div
                key={p.id}
                className="rounded border border-zinc-150 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                  <span>{p.brand}</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {p.amazonStatus}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white mt-1.5">{p.name}</p>
                
                {/* Advertising metrics */}
                <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800 grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
                  <div>
                    <span className="block text-[8px] text-zinc-400">AD SPEND</span>
                    <span className="font-bold text-zinc-900 dark:text-white">${p.spend.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-zinc-400">AD SALES</span>
                    <span className="font-bold text-zinc-900 dark:text-white">${p.sales.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-zinc-400">ACOS</span>
                    <span className="font-bold text-emerald-600">{p.acos}%</span>
                  </div>
                </div>

                {/* Ratings */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                  <span>ASIN: {p.asin}</span>
                  <span className="font-semibold text-amber-500">★ {p.rating} ({p.reviews})</span>
                </div>
              </div>
            ))}
            {liveProjects.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6">현재 라이브 판매 중인 제품이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
