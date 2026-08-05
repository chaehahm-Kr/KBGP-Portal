import "server-only";
import { getPricingPresets, getPricingScenarios, getScenarioSettings, getSavedCalculations, getProductsList } from "@/lib/pricing/actions";
import { PricingProfitabilityClient } from "./pricing-client";

export const metadata = {
  title: "Pricing & Profitability · K SELECT NETWORK",
  description: "한국 브랜드 공급가 기준 미국 시장 판매 가능성 및 수익성 시뮬레이션 분석 도구",
};

export default async function PricingProfitabilityPage() {
  // 병렬 데이터 페칭 (디폴트로 null을 넘겨 레거시/기본 요율 데이터 획득)
  const [presets, scenarios, settings, savedCalculations, products] = await Promise.all([
    getPricingPresets(),
    getPricingScenarios(),
    getScenarioSettings(null),
    getSavedCalculations(),
    getProductsList(),
  ]);

  return (
    <div className="flex-1 p-6 md:p-8 bg-gray-50/50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pricing & Profitability</h1>
          <p className="text-sm text-slate-500 mt-1">
            공급가 기준 미국 시장(B2B 및 Amazon B2C) 판매 수익성을 시뮬레이션하고 비즈니스 프리셋별 기본값을 관리합니다.
          </p>
        </div>

        {/* Client View Controller */}
        <PricingProfitabilityClient
          initialPresets={presets}
          initialScenarios={scenarios}
          initialSettings={settings}
          initialSavedCalculations={savedCalculations}
          initialProducts={products}
        />
      </div>
    </div>
  );
}
