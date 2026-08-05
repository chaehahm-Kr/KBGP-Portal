"use client";

import { useState, useEffect } from "react";
import { 
  calculatePresetProfitability, 
  CalculationInputs, 
  PresetCalculationResult, 
  ScenarioResult, 
  ChannelResult 
} from "@/lib/pricing/engine";
import { 
  saveCalculation, 
  fetchLiveExchangeRate, 
  getScenarioSettings,
  ScenarioGroupStructure 
} from "@/lib/pricing/actions";

interface Props {
  presets: any[];
  scenarios: any[];
  settings: ScenarioGroupStructure[];
  products: any[];
  initialFormToLoad?: any | null;
  onSaveSuccess: (newCalc: any) => void;
}

export function CalculatorTab({ presets, scenarios, settings: initialSettings, products, initialFormToLoad, onSaveSuccess }: Props) {
  // 1. 계산기 핵심 입력 상태
  const [mode, setMode] = useState<"analyze_profitability" | "calculate_pricing">("analyze_profitability");
  const [channel, setChannel] = useState<"b2b" | "amazon" | "both">("both");
  
  // 환율 정보 상태
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");
  const [exchangeRate, setExchangeRate] = useState<number>(1350);
  const [exchangeRateDate, setExchangeRateDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [exchangeRateSource, setExchangeRateSource] = useState<string>("Automatic");
  const [isManualRate, setIsManualRate] = useState<boolean>(false);
  const [rateWarning, setRateWarning] = useState<string | null>(null);

  // 기본 공급가 및 제품 연계
  const [supplierUnitPrice, setSupplierUnitPrice] = useState<number>(5000); // ₩5,000 기본
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || "legacy");
  
  // 모드별 추가 입력
  const [b2bPriceMode, setB2bPriceMode] = useState<"retail_based" | "wholesale_based">("retail_based");
  const [proposedMSRP, setProposedMSRP] = useState<number>(15.00);
  const [wholesalePrice, setWholesalePrice] = useState<number>(7.50);
  const [amazonListPrice, setAmazonListPrice] = useState<number>(14.99);
  const [retailerTargetMargin, setRetailerTargetMargin] = useState<number>(50); // 기본 50%
  
  // Target Pricing용 목표 지표
  const [targetMetric, setTargetMetric] = useState<"net_margin" | "gross_margin" | "contribution_margin">("net_margin");
  const [targetValue, setTargetValue] = useState<number>(15); // 목표 순이익률 15%

  // 상세/오버라이드 항목들
  const [fbaFeeSource, setFbaFeeSource] = useState<string>("scenario_default");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [detailedImport, setDetailedImport] = useState<Record<string, number>>({
    internationalFreight: 0,
    dutyRate: 0,
    customsBrokerage: 0,
    domesticInboundFreight: 0,
    warehouseReceiving: 0,
    orderQuantity: 1000,
  });

  // 현재 프리셋 기준 3개 시나리오 세부 요율 맵
  const [presetSettings, setPresetSettings] = useState<ScenarioGroupStructure[]>(initialSettings);
  const [presetCalcResult, setPresetCalcResult] = useState<PresetCalculationResult | null>(null);
  const [detailedViewScenario, setDetailedViewScenario] = useState<"conservative" | "expected" | "optimistic">("expected");
  const [showOverridesAccordion, setShowOverridesAccordion] = useState<boolean>(false);

  // 저장 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [calcName, setCalcName] = useState("");
  const [calcNotes, setCalcNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 로드된 데이터 복구 효과
  useEffect(() => {
    if (!initialFormToLoad) return;
    const f = initialFormToLoad;
    if (f.mode) setMode(f.mode);
    if (f.channel) setChannel(f.channel);
    if (f.original_currency) setCurrency(f.original_currency);
    
    // 공급가 처리
    if (f.original_supplier_price !== undefined) {
      setSupplierUnitPrice(Number(f.original_supplier_price));
    } else if (f.supplier_unit_price !== undefined) {
      setSupplierUnitPrice(Number(f.supplier_unit_price));
    }

    if (f.exchange_rate) {
      setExchangeRate(Number(f.exchange_rate));
      setIsManualRate(true); // 수동 고정 상태 유지
    }
    if (f.exchange_rate_date) setExchangeRateDate(f.exchange_rate_date);
    if (f.exchange_rate_source) setExchangeRateSource(f.exchange_rate_source);

    if (f.preset_id) setSelectedPresetId(f.preset_id);
    if (f.product_id) setSelectedProductId(f.product_id);
    if (f.proposed_msrp) setProposedMSRP(Number(f.proposed_msrp));
    if (f.wholesale_price) setWholesalePrice(Number(f.wholesale_price));
    if (f.amazon_list_price) setAmazonListPrice(Number(f.amazon_list_price));
    if (f.retailer_target_margin) setRetailerTargetMargin(Number(f.retailer_target_margin));
    if (f.target_metric) setTargetMetric(f.target_metric);
    if (f.target_value) setTargetValue(Number(f.target_value));
    if (f.fba_fee_source) setFbaFeeSource(f.fba_fee_source);
    if (f.input_overrides) setOverrides(f.input_overrides);
    if (f.detailed_import_info) setDetailedImport(f.detailed_import_info);
  }, [initialFormToLoad]);

  // 1) 자동 환율 로드 서비스 연동
  const handleLoadAutomaticRate = async () => {
    try {
      const res = await fetchLiveExchangeRate();
      setExchangeRate(res.rate);
      setExchangeRateDate(res.rateDate);
      setExchangeRateSource(res.source);
      setIsManualRate(false);
      setRateWarning(res.warning || null);
    } catch (e) {
      console.error("Failed to fetch live exchange rate:", e);
      setRateWarning("최신 환율 정보를 호출하지 못했습니다. 기본 임시 환율이 작동 중입니다.");
    }
  };

  useEffect(() => {
    if (currency === "KRW") {
      handleLoadAutomaticRate();
    }
  }, [currency]);

  // 2) 프리셋 변경 시 해당 프리셋 요율 정보 비동기 로딩
  useEffect(() => {
    async function loadPresetValues() {
      try {
        const data = await getScenarioSettings(selectedPresetId);
        setPresetSettings(data);
      } catch (err) {
        console.error("Failed to load scenario settings for preset:", err);
      }
    }
    loadPresetValues();
  }, [selectedPresetId]);

  // 3) 제품 선택 시 공급가 및 입고수량 동적 바인딩
  useEffect(() => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      if (prod.price_usd_fob) {
        setSupplierUnitPrice(Number(prod.price_usd_fob));
        setCurrency("USD");
      }
      if (prod.carton_pack_qty) {
        setDetailedImport((prev) => ({ ...prev, orderQuantity: Number(prod.carton_pack_qty) * 10 }));
      }
    }
  }, [selectedProductId, products]);

  // 4) 시나리오 설정 맵 추출 헬퍼 (Conservative, Expected, Optimistic 3종 개별 빌드)
  const extractScenarioMaps = () => {
    const conservative: Record<string, number> = {};
    const expected: Record<string, number> = {};
    const optimistic: Record<string, number> = {};

    presetSettings.forEach((g) => {
      g.items.forEach((i) => {
        conservative[i.code] = i.values.conservative ?? 0;
        expected[i.code] = i.values.expected ?? 0;
        optimistic[i.code] = i.values.optimistic ?? 0;
      });
    });

    return { conservative, expected, optimistic };
  };

  // 5) 실시간 3대 시나리오 일괄 연산 실행
  useEffect(() => {
    if (supplierUnitPrice <= 0) return;
    
    const maps = extractScenarioMaps();
    const inputs: CalculationInputs = {
      mode,
      channel,
      supplierUnitPrice,
      currency,
      exchangeRate,
      exchangeRateDate,
      exchangeRateSource: isManualRate ? "Manual" : exchangeRateSource,
      proposedMSRP,
      b2bPriceMode,
      wholesalePrice,
      amazonListPrice,
      retailerTargetMargin,
      targetMetric: mode === "calculate_pricing" ? targetMetric : undefined,
      targetValue: mode === "calculate_pricing" ? targetValue : undefined,
      fbaFeeSource,
      overrides,
      detailedImportInfo: detailedImport,
    };

    const results = calculatePresetProfitability(inputs, maps);
    setPresetCalcResult(results);
  }, [
    mode,
    channel,
    currency,
    exchangeRate,
    supplierUnitPrice,
    proposedMSRP,
    b2bPriceMode,
    wholesalePrice,
    amazonListPrice,
    retailerTargetMargin,
    targetMetric,
    targetValue,
    fbaFeeSource,
    overrides,
    detailedImport,
    presetSettings,
  ]);

  // B2B Wholesale / MSRP 상호 계산 바인딩
  const computedWholesale = b2bPriceMode === "retail_based" 
    ? proposedMSRP * (1 - retailerTargetMargin / 100) 
    : wholesalePrice;

  const computedMSRP = b2bPriceMode === "wholesale_based"
    ? wholesalePrice / (1 - retailerTargetMargin / 100 || 1)
    : proposedMSRP;

  // 스냅샷 저장
  const handleSaveSnapshot = async () => {
    if (!calcName.trim() || !presetCalcResult) return;
    setSaving(true);
    setSaveError(null);

    const activePreset = presets.find((p) => p.id === selectedPresetId);

    const res = await saveCalculation({
      name: calcName,
      mode,
      channel,
      scenarioId: "a82d77d7-fca8-47fb-ba0d-7b242b36a101", // Default Expected Scenario ID
      presetId: selectedPresetId,
      productId: selectedProductId || null,
      targetMetric: mode === "calculate_pricing" ? targetMetric : undefined,
      targetValue: mode === "calculate_pricing" ? targetValue : undefined,
      supplierUnitPrice: presetCalcResult.convertedSupplierPriceUSD,
      originalSupplierPrice: presetCalcResult.originalSupplierPrice,
      originalCurrency: presetCalcResult.originalCurrency,
      proposedMsrp: proposedMSRP,
      wholesalePrice: computedWholesale,
      amazonListPrice,
      retailerTargetMargin,
      exchangeRate: presetCalcResult.appliedExchangeRate,
      exchangeRateDate: presetCalcResult.exchangeRateDate,
      exchangeRateSource: presetCalcResult.exchangeRateSource,
      fbaFeeSource,
      packageInfo: {},
      detailedImportInfo: detailedImport,
      inputOverrides: overrides,
      appliedScenarioSnapshot: extractScenarioMaps(), // 전체 프리셋 맵 스냅샷 저장
      calculatedResults: presetCalcResult, // 3대 결과가 포함된 묶음 JSON 통째 저장
      status: "draft",
      notes: calcNotes,
    });

    setSaving(false);
    if ("success" in res) {
      setShowSaveModal(false);
      onSaveSuccess({
        id: res.id,
        name: calcName,
        mode,
        channel,
        supplier_unit_price: presetCalcResult.convertedSupplierPriceUSD,
        original_supplier_price: presetCalcResult.originalSupplierPrice,
        original_currency: presetCalcResult.originalCurrency,
        calculated_results: presetCalcResult,
        created_at: new Date().toISOString(),
        status: "draft",
        products: selectedProductId ? { name: products.find(p => p.id === selectedProductId)?.name } : null,
      });
      setCalcName("");
      setCalcNotes("");
    } else {
      setSaveError(res.error);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. 입력 설정 컨트롤 보드 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-800 tracking-wider uppercase border-b border-slate-100 pb-2">
          Step 1 ~ 5. 시뮬레이션 환경 구성
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Step 1. Mode & Step 2. Channel */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Step 1. 분석 모드</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setMode("analyze_profitability")}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                    mode === "analyze_profitability" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  수익성 분석
                </button>
                <button
                  onClick={() => setMode("calculate_pricing")}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                    mode === "calculate_pricing" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  목표가 역산
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Step 2. 판매 채널</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
              >
                <option value="both">Both (Offline B2B + Amazon)</option>
                <option value="b2b">Offline B2B 전용</option>
                <option value="amazon">Amazon B2C 전용</option>
              </select>
            </div>
          </div>

          {/* Step 3. 공급가 및 통화/환율 설정 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Step 3. 공급 제품 연계 (선택)</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
              >
                <option value="">제품 연계 없음 (직접 입력)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">브랜드 공급가 (Supplier Price)</label>
              <div className="flex rounded-lg shadow-2xs">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={supplierUnitPrice}
                  onChange={(e) => setSupplierUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-300 rounded-l-lg focus:outline-none focus:border-slate-800"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="px-3 py-2 text-xs border-y border-r border-slate-300 rounded-r-lg bg-slate-50 font-bold focus:outline-none"
                >
                  <option value="KRW">KRW (₩)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 환율 세부 설정 (원화 입력 시 노출) */}
          <div className="space-y-4 border-l border-slate-100 pl-4 md:col-span-1">
            <div className="text-xs font-bold text-slate-500">환율 제어판</div>
            {currency === "KRW" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>기준 환율</span>
                  <button
                    onClick={() => {
                      if (isManualRate) {
                        handleLoadAutomaticRate();
                      } else {
                        setIsManualRate(true);
                      }
                    }}
                    className="text-indigo-600 hover:underline"
                  >
                    {isManualRate ? "자동 환율" : "직접 입력"}
                  </button>
                </div>

                {isManualRate ? (
                  <div className="space-y-1">
                    <input
                      type="number"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1350)}
                      className="w-full px-2 py-1.5 text-xs border border-indigo-500 rounded bg-indigo-50/20 text-right focus:outline-none font-bold"
                    />
                    <div className="text-[9px] text-amber-600">
                      ⚠️ 이 환율은 현재 계산에만 적용됩니다.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-800">₩{exchangeRate.toFixed(2)} / USD</div>
                    <div className="text-[9px] text-slate-400">
                      고시일: {exchangeRateDate} | {exchangeRateSource}
                    </div>
                  </div>
                )}
                {rateWarning && (
                  <div className="p-2 bg-amber-50 text-[10px] text-amber-800 rounded-md border border-amber-100">
                    {rateWarning}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">
                달러($) 공급가 입력 시 환산 처리가 불필요합니다.
              </div>
            )}
          </div>

          {/* Step 4. Business Preset */}
          <div className="space-y-4 border-l border-slate-100 pl-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Step 4. 비즈니스 프리셋</label>
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-900 bg-indigo-50/30"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                {presets.find((p) => p.id === selectedPresetId)?.description || ""}
              </div>
            </div>
          </div>

        </div>

        {/* Step 5. 모드별 세부 가격/목표 추가 입력 */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
          <label className="block text-xs font-bold text-slate-700 mb-3">Step 5. 세부 목표 및 가격 시뮬레이션 설정</label>
          
          {mode === "analyze_profitability" ? (
            /* Current Profitability 모드 입력 */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">B2B 도매 가격 결정 방식</span>
                  <select
                    value={b2bPriceMode}
                    onChange={(e) => setB2bPriceMode(e.target.value as any)}
                    className="text-[10px] border border-slate-300 rounded px-1.5 py-0.5"
                  >
                    <option value="retail_based">MSRP 기반 역산</option>
                    <option value="wholesale_based">Wholesale 기반 연산</option>
                  </select>
                </div>
                
                {b2bPriceMode === "retail_based" ? (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">MSRP ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={proposedMSRP}
                      onChange={(e) => setProposedMSRP(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Wholesale Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-2">B2B 소매 마진 (Retailer Margin, %)</label>
                <input
                  type="number"
                  value={retailerTargetMargin}
                  onChange={(e) => setRetailerTargetMargin(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  계산된 B2B 도매 가격: <span className="font-semibold text-slate-700">${computedWholesale.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-2">Amazon 판매가 (Selling Price, $)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amazonListPrice}
                  onChange={(e) => setAmazonListPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          ) : (
            /* Target Pricing 모드 입력 */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] text-slate-400 mb-2">Letusto 목표 순이익률 (Target Net Margin, %)</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs border border-indigo-600 rounded-lg bg-indigo-50/20 font-bold"
                />
              </div>
              
              <div>
                <label className="block text-[11px] text-slate-400 mb-2">B2B 소매점 타겟 마진 (Retailer Margin, %)</label>
                <input
                  type="number"
                  value={retailerTargetMargin}
                  onChange={(e) => setRetailerTargetMargin(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-end pb-1 text-[11px] text-slate-400 italic leading-relaxed">
                설정된 목표 Net Margin을 채우기 위해, 시나리오별 수입/운영 비용을 감안한 최적 B2B Wholesale 가격 및 Amazon MSRP를 역산해 드립니다.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. 계산 결과 표시 파트 (Conservative | Expected | Optimistic 3대 비교) */}
      {/* ===================================================================== */}
      {presetCalcResult && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <span className="w-2 h-4 bg-indigo-600 rounded-full mr-2"></span>
              시나리오별 시뮬레이션 결과 나란히 비교
            </h2>
            <button
              onClick={() => {
                setCalcName(`${presets.find(p => p.id === selectedPresetId)?.name || "Preset"} 시뮬레이션 - ${new Date().toLocaleDateString()}`);
                setShowSaveModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              계산 스냅샷 저장
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* Conservative Card */}
            <ScenarioResultCard 
              title="Conservative (보수적)"
              type="conservative"
              res={presetCalcResult.conservative}
              channel={channel}
              mode={mode}
              isActive={detailedViewScenario === "conservative"}
              onSelect={() => setDetailedViewScenario("conservative")}
            />

            {/* Expected Card (주요 강조) */}
            <ScenarioResultCard 
              title="Expected (표준 / 권장)"
              type="expected"
              res={presetCalcResult.expected}
              channel={channel}
              mode={mode}
              isActive={detailedViewScenario === "expected"}
              onSelect={() => setDetailedViewScenario("expected")}
              highlighted={true}
            />

            {/* Optimistic Card */}
            <ScenarioResultCard 
              title="Optimistic (낙관적)"
              type="optimistic"
              res={presetCalcResult.optimistic}
              channel={channel}
              mode={mode}
              isActive={detailedViewScenario === "optimistic"}
              onSelect={() => setDetailedViewScenario("optimistic")}
            />

          </div>

          {/* ===================================================================== */}
          {/* 3. 선택한 시나리오 상세 Waterfall 차트 및 세부 요율 수정 */}
          {/* ===================================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase">
                  {detailedViewScenario.toUpperCase()} 시나리오 Waterfall 분해 분석
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  1단위 판매 시 발생하는 매출 차감, 물류비, 마케팅비, 운영비의 단계적 수익 잠식 구조를 보여줍니다.
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowOverridesAccordion(!showOverridesAccordion)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  {showOverridesAccordion ? "비용 조율 패널 접기" : "비용 조율 패널 열기 (Override)"}
                </button>
              </div>
            </div>

            {/* 비용 조율 (Overrides) 아코디언 */}
            {showOverridesAccordion && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Adjust Assumptions (현재 계산에 임시 오버라이드)</span>
                  <button
                    onClick={() => {
                      setOverrides({});
                      setDetailedImport({
                        internationalFreight: 0,
                        dutyRate: 0,
                        customsBrokerage: 0,
                        domesticInboundFreight: 0,
                        warehouseReceiving: 0,
                        orderQuantity: 1000,
                      });
                    }}
                    className="text-[10px] text-red-600 hover:underline"
                  >
                    조율 값 리셋
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 패키지 및 준비 비용 */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-500">개별 가산비 ($)</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">포장 및 부자재</label>
                        <input
                          type="number"
                          step="0.01"
                          value={overrides.product_packaging_cost ?? 0}
                          onChange={(e) => setOverrides({ ...overrides, product_packaging_cost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">FBA 입고준비(Prep)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={overrides.product_prep_cost ?? 0}
                          onChange={(e) => setOverrides({ ...overrides, product_prep_cost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 수입 통관 실비 입력 */}
                  <div className="space-y-2 md:col-span-2 border-l border-slate-200 pl-6">
                    <div className="text-[11px] font-bold text-slate-500">
                      수입 통관 실제 비용 (Detailed Import Info)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] text-slate-400">국제 항공/해상운임 ($)</label>
                        <input
                          type="number"
                          value={detailedImport.internationalFreight}
                          onChange={(e) => setDetailedImport({ ...detailedImport, internationalFreight: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">관세율 (Duty Rate, %)</label>
                        <input
                          type="number"
                          value={detailedImport.dutyRate}
                          onChange={(e) => setDetailedImport({ ...detailedImport, dutyRate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">통관 대행/수수료 ($)</label>
                        <input
                          type="number"
                          value={detailedImport.customsBrokerage}
                          onChange={(e) => setDetailedImport({ ...detailedImport, customsBrokerage: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">미국 내륙 운송비 ($)</label>
                        <input
                          type="number"
                          value={detailedImport.domesticInboundFreight}
                          onChange={(e) => setDetailedImport({ ...detailedImport, domesticInboundFreight: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">물류창고 입고실비 ($)</label>
                        <input
                          type="number"
                          value={detailedImport.warehouseReceiving}
                          onChange={(e) => setDetailedImport({ ...detailedImport, warehouseReceiving: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">수입 발주 수량 (개) *</label>
                        <input
                          type="number"
                          value={detailedImport.orderQuantity}
                          onChange={(e) => setDetailedImport({ ...detailedImport, orderQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-2 py-1 text-xs border border-indigo-600 rounded bg-indigo-50/20 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* B2B 및 Amazon Waterfall 차트 배치 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {channel !== "amazon" && presetCalcResult[detailedViewScenario].b2b && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">B2B 채널 Waterfall (Net Sales 기준)</div>
                  <WaterfallChart viewResult={presetCalcResult[detailedViewScenario].b2b!} />
                </div>
              )}
              {channel !== "b2b" && presetCalcResult[detailedViewScenario].amazon && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">Amazon B2C 채널 Waterfall (Net Sales 기준)</div>
                  <WaterfallChart viewResult={presetCalcResult[detailedViewScenario].amazon!} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 계산 스냅샷 저장 모달 레이어 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">계산 시뮬레이션 결과 저장</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">스냅샷 이름 *</label>
                <input
                  type="text"
                  required
                  placeholder="계산기 기록 식별용 명칭"
                  value={calcName}
                  onChange={(e) => setCalcName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">메모 (선택)</label>
                <textarea
                  placeholder="계산에 특이사항이나 오버라이드 조건 등에 대해 기재해 주세요."
                  value={calcNotes}
                  onChange={(e) => setCalcNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg h-20 focus:outline-none"
                />
              </div>
              {saveError && (
                <div className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-100">
                  {saveError}
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "확인"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// -----------------------------------------------------------------------------
// [결과 카드 하위 컴포넌트] ScenarioResultCard
// -----------------------------------------------------------------------------
interface CardProps {
  title: string;
  type: "conservative" | "expected" | "optimistic";
  res: ScenarioResult;
  channel: "b2b" | "amazon" | "both";
  mode: "analyze_profitability" | "calculate_pricing";
  isActive: boolean;
  onSelect: () => void;
  highlighted?: boolean;
}

function ScenarioResultCard({ title, type, res, channel, mode, isActive, onSelect, highlighted = false }: CardProps) {
  const statusColors = {
    approved: "text-emerald-600 bg-emerald-50 border-emerald-100",
    conditional: "text-amber-600 bg-amber-50 border-amber-100",
    review_required: "text-indigo-600 bg-indigo-50 border-indigo-100",
    not_viable: "text-red-600 bg-red-50 border-red-100",
  };

  return (
    <div 
      onClick={onSelect}
      className={`rounded-2xl border p-5 transition-all cursor-pointer flex flex-col justify-between ${
        highlighted 
          ? "border-indigo-600 bg-indigo-50/20 shadow-md ring-2 ring-indigo-600/30 scale-[1.01]" 
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
      } ${isActive ? "ring-2 ring-offset-2 ring-slate-800" : ""}`}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-slate-900 tracking-wide uppercase">{title}</h4>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[res.status]}`}>
            {res.status.toUpperCase()}
          </span>
        </div>

        {/* B2B 결과 분석 */}
        {channel !== "amazon" && res.b2b && (
          <div className="space-y-2 border-t border-slate-100/80 pt-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Offline B2B</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-400 text-[10px]">Landed Cost</div>
                <div className="font-semibold text-slate-800">${res.b2b.landedCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">
                  {mode === "calculate_pricing" ? "Recommended Wholesale" : "Wholesale Price"}
                </div>
                <div className="font-bold text-indigo-600">${res.b2b.grossSales.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Contribution Margin</div>
                <div className="font-semibold text-slate-700">{res.b2b.contributionMargin.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Net Margin</div>
                <div className="font-bold text-slate-900">{res.b2b.netMargin.toFixed(1)}%</div>
              </div>
            </div>
            {/* 한계 공급가 */}
            <div className="bg-slate-100 p-2 rounded-lg text-[10px] text-slate-600 mt-2 flex justify-between">
              <span>한계 공급가 (MAsP)</span>
              <span className="font-bold text-slate-800">${res.b2b.maxAcceptableSupplierPrice.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Amazon B2C 결과 분석 */}
        {channel !== "b2b" && res.amazon && (
          <div className="space-y-2 border-t border-slate-100/80 pt-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amazon B2C</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-400 text-[10px]">Landed Cost</div>
                <div className="font-semibold text-slate-800">${res.amazon.landedCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">
                  {mode === "calculate_pricing" ? "Recommended MSRP" : "Amazon MSRP"}
                </div>
                <div className="font-bold text-indigo-600">${res.amazon.grossSales.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Contribution Margin</div>
                <div className="font-semibold text-slate-700">{res.amazon.contributionMargin.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Net Margin</div>
                <div className="font-bold text-slate-900">{res.amazon.netMargin.toFixed(1)}%</div>
              </div>
            </div>
            {/* 한계 공급가 */}
            <div className="bg-slate-100 p-2 rounded-lg text-[10px] text-slate-600 mt-2 flex justify-between">
              <span>한계 공급가 (MAsP)</span>
              <span className="font-bold text-slate-800">${res.amazon.maxAcceptableSupplierPrice.toFixed(2)}</span>
            </div>
          </div>
        )}

      </div>

      <div className="pt-4 mt-4 border-t border-slate-100 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`text-xs font-bold transition ${
            isActive ? "text-indigo-600 hover:text-indigo-800" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {isActive ? "✓ 상세 및 Waterfall 노출 중" : "상세보기 및 Waterfall 분석"}
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// [차트 하위 컴포넌트] WaterfallChart
// -----------------------------------------------------------------------------
function WaterfallChart({ viewResult }: { viewResult: ChannelResult }) {
  // Waterfall 각 Step 렌더링
  return (
    <div className="space-y-2">
      {viewResult.waterfall.map((step, idx) => {
        const isNegative = step.amount < 0;
        const isTotal = step.label.includes("Profit") || step.label === "Net Sales" || step.label === "Gross Sales" || step.label.includes("Net Profit");
        
        // 그래프 바의 최대 폭 비율
        const barWidth = Math.min(100, Math.max(2, Math.abs(step.percentOfNetSales)));

        return (
          <div key={idx} className="flex items-center text-xs">
            <div className="w-[35%] font-medium text-slate-700 truncate" title={step.label}>
              {step.label}
            </div>
            <div className="w-[45%] pr-4 flex items-center">
              <div 
                className={`h-4.5 rounded-sm transition-all ${
                  isTotal 
                    ? "bg-slate-900" 
                    : isNegative 
                      ? "bg-rose-500/80" 
                      : "bg-emerald-500/80"
                }`}
                style={{ width: `${barWidth}%` }}
              ></div>
            </div>
            <div className="w-[10%] text-right font-semibold text-slate-800">
              ${Math.abs(step.amount).toFixed(2)}
            </div>
            <div className="w-[10%] text-right font-mono text-[10px] text-slate-400 pr-1">
              {step.percentOfNetSales.toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
