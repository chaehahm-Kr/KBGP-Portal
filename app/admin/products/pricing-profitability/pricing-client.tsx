"use client";

import { useState } from "react";
import { CalculatorTab } from "@/components/admin/pricing/calculator-tab";
import { SavedCalculationsTab } from "@/components/admin/pricing/saved-calculations-tab";
import { ScenarioSettingsTab } from "@/components/admin/pricing/scenario-settings-tab";
import { getPricingPresets } from "@/lib/pricing/actions";

interface Props {
  initialPresets: any[];
  initialScenarios: any[];
  initialSettings: any[];
  initialSavedCalculations: any[];
  initialProducts: any[];
}

export function PricingProfitabilityClient({
  initialPresets,
  initialScenarios,
  initialSettings,
  initialSavedCalculations,
  initialProducts,
}: Props) {
  // [개선 완료] Landed Cost & Cargo를 1차 대메뉴 탭으로 좌측 정렬 배치
  const [activeTab, setActiveTab] = useState<"calculator" | "landed_cost" | "saved" | "settings">("calculator");
  
  const [presets, setPresets] = useState(initialPresets);
  const [savedCalcs, setSavedCalcs] = useState(initialSavedCalculations);
  const [settingsData, setSettingsData] = useState(initialSettings);

  const [calculatorFormToLoad, setCalculatorFormToLoad] = useState<any | null>(null);

  const handleRefreshPresets = async () => {
    try {
      const refreshed = await getPricingPresets();
      setPresets(refreshed);
    } catch (e) {
      console.error("Failed to refresh presets:", e);
    }
  };

  // 한글 병기를 제거하고 영문 타이틀 단독 노출로 깔끔하게 변경
  const tabs = [
    { id: "calculator", label: "Calculator" },
    { id: "landed_cost", label: "Landed Cost & Cargo" },
    { id: "saved", label: "Saved Calculations" },
    { id: "settings", label: "Scenario Settings" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* [개선 완료] 탭 네비게이션 좌측 정렬 */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8 justify-start" aria-label="Tabs">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "calculator" && tab.id !== "landed_cost") {
                    setCalculatorFormToLoad(null);
                  }
                }}
                className={`
                  py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition-colors duration-200
                  ${
                    isSelected
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
                  }
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        {(activeTab === "calculator" || activeTab === "landed_cost") && (
          <CalculatorTab
            activeSubTab={activeTab}
            presets={presets}
            scenarios={initialScenarios}
            settings={settingsData}
            products={initialProducts}
            initialFormToLoad={calculatorFormToLoad}
            onSaveSuccess={(newCalc) => {
              setSavedCalcs([newCalc, ...savedCalcs]);
              setCalculatorFormToLoad(null);
              setActiveTab("saved");
            }}
          />
        )}

        {activeTab === "saved" && (
          <SavedCalculationsTab
            savedCalculations={savedCalcs}
            onUpdateList={(newList) => setSavedCalcs(newList)}
            onSelectCalculator={() => setActiveTab("calculator")}
            onLoadToCalculator={(formData) => {
              setCalculatorFormToLoad(formData);
              setActiveTab("calculator");
            }}
          />
        )}

        {activeTab === "settings" && (
          <ScenarioSettingsTab
            presets={presets}
            scenarios={initialScenarios}
            initialSettings={settingsData}
            onSettingsUpdate={(updated) => setSettingsData(updated)}
            onPresetsUpdate={handleRefreshPresets}
          />
        )}
      </div>
    </div>
  );
}
