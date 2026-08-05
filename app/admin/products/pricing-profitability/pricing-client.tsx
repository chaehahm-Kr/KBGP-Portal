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
  const [activeTab, setActiveTab] = useState<"calculator" | "saved" | "settings">("calculator");
  
  // 상태 동적 동기화용 (데이터 갱신 시 활용)
  const [presets, setPresets] = useState(initialPresets);
  const [savedCalcs, setSavedCalcs] = useState(initialSavedCalculations);
  const [settingsData, setSettingsData] = useState(initialSettings);

  // 로딩/재계산용 폼 스냅샷 상태
  const [calculatorFormToLoad, setCalculatorFormToLoad] = useState<any | null>(null);

  // 프리셋 목록 최신화용 helper
  const handleRefreshPresets = async () => {
    try {
      const refreshed = await getPricingPresets();
      setPresets(refreshed);
    } catch (e) {
      console.error("Failed to refresh presets:", e);
    }
  };

  const tabs = [
    { id: "calculator", label: "Calculator (수익성 계산기)" },
    { id: "saved", label: "Saved Calculations (계산 기록)" },
    { id: "settings", label: "Preset & Scenario Settings (설정)" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "calculator") {
                    setCalculatorFormToLoad(null); // 다른 탭 이동 시 폼 초기화
                  }
                }}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200
                  ${
                    isSelected
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
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
        {activeTab === "calculator" && (
          <CalculatorTab
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
