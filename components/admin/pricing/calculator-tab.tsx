"use client";

import { useState, useEffect } from "react";
import { calculateProfitability, CalculationInputs, CalculationResult, ChannelResult } from "@/lib/pricing/engine";
import { saveCalculation, ScenarioGroupStructure } from "@/lib/pricing/actions";

interface Props {
  scenarios: any[];
  settings: ScenarioGroupStructure[];
  products: any[];
  onSaveSuccess: (newCalc: any) => void;
}

export function CalculatorTab({ scenarios, settings, products, onSaveSuccess }: Props) {
  // 1. 계산기 입력 폼 상태
  const [mode, setMode] = useState<"analyze_profitability" | "calculate_pricing">("analyze_profitability");
  const [channel, setChannel] = useState<"b2b" | "amazon" | "both">("both");
  const [selectedScenarioCode, setSelectedScenarioCode] = useState<string>("expected");
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");
  const [exchangeRate, setExchangeRate] = useState<number>(1300);
  
  const [supplierUnitPrice, setSupplierUnitPrice] = useState<number>(5000); // 5000원
  const [proposedMSRP, setProposedMSRP] = useState<number>(15);
  const [wholesalePrice, setWholesalePrice] = useState<number>(6.5);
  const [amazonListPrice, setAmazonListPrice] = useState<number>(14.99);
  const [retailerTargetMargin, setRetailerTargetMargin] = useState<number>(50);

  const [targetMetric, setTargetMetric] = useState<"gross_margin" | "contribution_margin" | "operating_margin" | "net_margin" | "min_profit">("net_margin");
  const [targetValue, setTargetValue] = useState<number>(15);

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [fbaFeeSource, setFbaFeeSource] = useState<string>("scenario_default");
  const [channelView, setChannelView] = useState<"b2b" | "amazon">("b2b");

  // 상세/오버라이드 항목들
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    reductions: false,
    costs: false,
    marketing: false,
    fulfillment: false,
    labor: false,
    overhead: false,
    risk: false,
  });

  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [detailedImport, setDetailedImport] = useState<Record<string, number>>({
    internationalFreight: 0,
    dutyRate: 0,
    customsBrokerage: 0,
    domesticInboundFreight: 0,
    warehouseReceiving: 0,
    orderQuantity: 1000,
  });

  // 계산 연산 결과 상태
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);

  // 저장용 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [calcName, setCalcName] = useState("");
  const [calcNotes, setCalcNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // 시나리오 설정 맵 추출
  const getScenarioValuesMap = (scenCode: string): Record<string, number> => {
    const map: Record<string, number> = {};
    settings.forEach((g) => {
      g.items.forEach((i) => {
        map[i.code] = i.values[scenCode] ?? 0;
      });
    });
    return map;
  };

  // 제품 선택 시 가격 및 규격 자동 로딩
  useEffect(() => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      if (prod.price_usd_fob) {
        setSupplierUnitPrice(Number(prod.price_usd_fob));
        setCurrency("USD");
      }
      // 패키지 규격 overrides 로드
      if (prod.carton_pack_qty) {
        setDetailedImport((prev) => ({ ...prev, orderQuantity: Number(prod.carton_pack_qty) * 10 }));
      }
    }
  }, [selectedProductId, products]);

  // 실시간 계산 구동
  useEffect(() => {
    const scenMap = getScenarioValuesMap(selectedScenarioCode);
    const inputs: CalculationInputs = {
      mode,
      channel,
      supplierUnitPrice,
      currency,
      exchangeRate,
      proposedMSRP,
      wholesalePrice,
      amazonListPrice,
      retailerTargetMargin,
      targetMetric: mode === "calculate_pricing" ? targetMetric : undefined,
      targetValue: mode === "calculate_pricing" ? targetValue : undefined,
      fbaFeeSource,
      overrides,
      detailedImportInfo: detailedImport,
    };

    const results = calculateProfitability(inputs, scenMap);
    setCalcResult(results);
  }, [
    mode,
    channel,
    selectedScenarioCode,
    currency,
    exchangeRate,
    supplierUnitPrice,
    proposedMSRP,
    wholesalePrice,
    amazonListPrice,
    retailerTargetMargin,
    targetMetric,
    targetValue,
    fbaFeeSource,
    overrides,
    detailedImport,
  ]);

  // 아코디언 토글
  const toggleAccordion = (sec: string) => {
    setOpenAccordions((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // 오버라이드 리셋
  const handleResetOverrides = () => {
    setOverrides({});
    setDetailedImport({
      internationalFreight: 0,
      dutyRate: 0,
      customsBrokerage: 0,
      domesticInboundFreight: 0,
      warehouseReceiving: 0,
      orderQuantity: 1000,
    });
  };

  // 계산 스냅샷 저장 실행
  const handleSaveCalculationSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcName || !calcResult) return;
    setSaving(true);
    
    const selectedScenario = scenarios.find((s) => s.code === selectedScenarioCode);
    const scenMap = getScenarioValuesMap(selectedScenarioCode);

    const res = await saveCalculation({
      name: calcName,
      mode,
      channel,
      scenarioId: selectedScenario?.id,
      productId: selectedProductId || null,
      targetMetric: mode === "calculate_pricing" ? targetMetric : undefined,
      targetValue: mode === "calculate_pricing" ? targetValue : undefined,
      supplierUnitPrice,
      proposedMsrp: proposedMSRP,
      wholesalePrice,
      amazonListPrice,
      retailerTargetMargin,
      exchangeRate,
      fbaFeeSource,
      packageInfo: {},
      detailedImportInfo: detailedImport,
      inputOverrides: overrides,
      appliedScenarioSnapshot: scenMap,
      calculatedResults: calcResult,
      status: calcResult.status,
      notes: calcNotes,
    });

    setSaving(false);
    if ("success" in res) {
      setShowSaveModal(false);
      setCalcName("");
      setCalcNotes("");
      onSaveSuccess({
        id: res.id,
        name: calcName,
        mode,
        channel,
        created_at: new Date().toISOString(),
        status: calcResult.status,
        supplier_unit_price: supplierUnitPrice,
        calculated_results: calcResult,
        products: selectedProductId ? { name: products.find((p) => p.id === selectedProductId)?.name } : null,
      });
    } else {
      alert(res.error);
    }
  };

  // 상태 배지 렌더러
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded">Approved (적합)</span>;
      case "conditional":
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded">Conditional (조건부적합)</span>;
      case "not_viable":
        return <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded">Not Viable (부적합)</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded">Review Required</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* 1. Left input Panel (7 Columns) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Setup Card */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">Calculation Setup</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">계산 모드</label>
              <select
                value={mode}
                onChange={(e: any) => setMode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="analyze_profitability">현재 수익성 분석 (Analyze Current)</option>
                <option value="calculate_pricing">목표 가격 역산 (Calculate Target)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">판매 채널</label>
              <select
                value={channel}
                onChange={(e: any) => setChannel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="both">Both (B2B + Amazon 비교)</option>
                <option value="b2b">Offline B2B 전용</option>
                <option value="amazon">Amazon B2C 전용</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">시나리오 적용</label>
              <select
                value={selectedScenarioCode}
                onChange={(e) => setSelectedScenarioCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white font-medium text-slate-800"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">공급가 통화</label>
              <select
                value={currency}
                onChange={(e: any) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="KRW">원화 (KRW)</option>
                <option value="USD">달러 (USD)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">기준 환율 (원/$)</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>

          {/* Product Link Select */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">기존 등록 제품 연동 (선택)</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-700"
            >
              <option value="">-- 직접 값 입력 (임시 제품 시뮬레이션) --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (FOB: ${p.price_usd_fob || "미등록"})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing Inputs Card */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">Product & Price Inputs</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                원물 공급가 ({currency === "KRW" ? "₩" : "$"})
              </label>
              <input
                type="number"
                value={supplierUnitPrice}
                onChange={(e) => setSupplierUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">MSRP ($)</label>
              <input
                type="number"
                value={proposedMSRP}
                onChange={(e) => setProposedMSRP(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>

          {/* B2B 가격 */}
          {(channel === "b2b" || channel === "both") && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  도매 공급가 Wholesale ($) {mode === "calculate_pricing" && "(계산 모드에서 자동 역산)"}
                </label>
                <input
                  type="number"
                  disabled={mode === "calculate_pricing"}
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">소매 마진 목표 (%)</label>
                <input
                  type="number"
                  value={retailerTargetMargin}
                  onChange={(e) => setRetailerTargetMargin(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
          )}

          {/* Amazon 가격 */}
          {(channel === "amazon" || channel === "both") && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  아마존 판매가 List Price ($) {mode === "calculate_pricing" && "(계산 모드에서 자동 역산)"}
                </label>
                <input
                  type="number"
                  disabled={mode === "calculate_pricing"}
                  value={amazonListPrice}
                  onChange={(e) => setAmazonListPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">FBA 수수료 출처</label>
                <select
                  value={fbaFeeSource}
                  onChange={(e) => setFbaFeeSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  <option value="scenario_default">시나리오 기본값 적용 (Scenario Default)</option>
                  <option value="manual">직접 수동 입력 (Manual Input)</option>
                </select>
              </div>
            </div>
          )}

          {/* 가격 역산 세부 옵션 */}
          {mode === "calculate_pricing" && (
            <div className="bg-slate-50 p-4 rounded border border-slate-200 grid grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">역산 기준 지표 (Metric)</label>
                <select
                  value={targetMetric}
                  onChange={(e: any) => setTargetMetric(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                >
                  <option value="net_margin">목표 순이익률 (Target Net Margin)</option>
                  <option value="gross_margin">목표 매출총이익률 (Target Gross Margin)</option>
                  <option value="contribution_margin">목표 공헌이익률 (Target Contribution Margin)</option>
                  <option value="operating_margin">목표 영업이익률 (Target Operating Margin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">목표 목표치 (%)</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Detailed Adjustments Accordions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-sm font-semibold text-slate-700">Detailed Assumptions & Overrides</span>
            <button
              onClick={handleResetOverrides}
              className="text-xs text-slate-400 hover:text-red-500 font-medium transition"
            >
              모든 임시 오버라이드 초기화
            </button>
          </div>

          {/* Group 1. Revenue Reductions */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion("reductions")}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition"
            >
              <span className="text-sm font-medium text-slate-900">Group 1. Revenue Reductions (할인 및 반품 차감)</span>
              <span>{openAccordions.reductions ? "▲" : "▼"}</span>
            </button>
            {openAccordions.reductions && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">일반 할인율 (%)</label>
                    <input
                      type="number"
                      value={overrides.general_discount_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, general_discount_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">쿠폰/프로모션 적용률 (%)</label>
                    <input
                      type="number"
                      value={overrides.coupon_promotion_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, coupon_promotion_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Group 2. Product & Import Cost */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion("costs")}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition"
            >
              <span className="text-sm font-medium text-slate-900">Group 2. Product & Import Cost (단가 및 수입 부대 비용)</span>
              <span>{openAccordions.costs ? "▲" : "▼"}</span>
            </button>
            {openAccordions.costs && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">패키지 부자재가 ($)</label>
                    <input
                      type="number"
                      value={overrides.product_packaging_cost ?? ""}
                      placeholder="0.00"
                      onChange={(e) => setOverrides({ ...overrides, product_packaging_cost: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Prep 가공비 ($)</label>
                    <input
                      type="number"
                      value={overrides.product_prep_cost ?? ""}
                      placeholder="0.00"
                      onChange={(e) => setOverrides({ ...overrides, product_prep_cost: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">대체 수입부대율 (%)</label>
                    <input
                      type="number"
                      value={overrides.general_import_cost_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, general_import_cost_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-4 space-y-3">
                  <span className="text-xs font-bold text-slate-600 block">Detailed Import Information (실측 국제 물류비 입력 - 입력시 수입부대율% 대체)</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">오더 전체 수량 (Unit)</label>
                      <input
                        type="number"
                        value={detailedImport.orderQuantity}
                        onChange={(e) => setDetailedImport({ ...detailedImport, orderQuantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">총 국제 운임 ($)</label>
                      <input
                        type="number"
                        value={detailedImport.internationalFreight || ""}
                        placeholder="0.00"
                        onChange={(e) => setDetailedImport({ ...detailedImport, internationalFreight: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">관세율 Duty Rate (%)</label>
                      <input
                        type="number"
                        value={detailedImport.dutyRate || ""}
                        placeholder="0.00"
                        onChange={(e) => setDetailedImport({ ...detailedImport, dutyRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">미국 현지 입고물류비 ($)</label>
                      <input
                        type="number"
                        value={detailedImport.domesticInboundFreight || ""}
                        placeholder="0.00"
                        onChange={(e) => setDetailedImport({ ...detailedImport, domesticInboundFreight: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Group 3. Marketing & Sales */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion("marketing")}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition"
            >
              <span className="text-sm font-medium text-slate-900">Group 3. Marketing & Sales (마케팅 및 수수료)</span>
              <span>{openAccordions.marketing ? "▲" : "▼"}</span>
            </button>
            {openAccordions.marketing && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">B2B 마케팅비 (%)</label>
                    <input
                      type="number"
                      value={overrides.b2b_marketing_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, b2b_marketing_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Amazon 광고비 (%)</label>
                    <input
                      type="number"
                      value={overrides.amazon_advertising_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, amazon_advertising_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">영업 수수료 (%)</label>
                    <input
                      type="number"
                      value={overrides.sales_commission_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, sales_commission_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Group 4. Fulfillment & Labor & Overhead */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion("fulfillment")}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition"
            >
              <span className="text-sm font-medium text-slate-900">Group 4~7. Operations & Overhead (물류·인건비·관리비)</span>
              <span>{openAccordions.fulfillment ? "▲" : "▼"}</span>
            </button>
            {openAccordions.fulfillment && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {fbaFeeSource === "manual" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">FBA Fulfillment Fee ($)</label>
                      <input
                        type="number"
                        value={overrides.fba_fulfillment_fee ?? ""}
                        placeholder="5.20"
                        onChange={(e) => setOverrides({ ...overrides, fba_fulfillment_fee: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">B2B 배송 단가 (%)</label>
                    <input
                      type="number"
                      value={overrides.store_delivery_cost_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, store_delivery_cost_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">현장 작업 인건비 (%)</label>
                    <input
                      type="number"
                      value={overrides.variable_labor_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, variable_labor_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">일반 공헌 관리비 (%)</label>
                    <input
                      type="number"
                      value={overrides.general_overhead_rate ?? ""}
                      placeholder="시나리오 기본값 사용"
                      onChange={(e) => setOverrides({ ...overrides, general_overhead_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Right Analysis Panel (5 Columns) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Summary Card */}
        {calcResult && (
          <div className="bg-slate-900 text-white p-6 rounded-lg shadow-md space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Analysis Results</span>
              {renderStatusBadge(calcResult.status)}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400">원가 수입입고가 (Landed Cost per Unit)</span>
              <div className="text-2xl font-bold text-slate-100">${resCalculatedLanded(calcResult)}</div>
            </div>

            {/* B2B 결과 간략 요약 */}
            {calcResult.b2b && (
              <div className="bg-slate-800/50 p-4 rounded border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300">Offline B2B Channel</span>
                  <span className="text-sm font-bold text-emerald-400">
                    Net Margin: {calcResult.b2b.netMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                  <div>이익: ${calcResult.b2b.netProfit.toFixed(2)} / unit</div>
                  <div>BEP 도매가: ${calcResult.b2b.breakEvenPrice.toFixed(2)}</div>
                  <div className="col-span-2 text-slate-300 font-medium">한계 수용 공급가: ${calcResult.b2b.maxAcceptableSupplierPrice.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Amazon 결과 간략 요약 */}
            {calcResult.amazon && (
              <div className="bg-slate-800/50 p-4 rounded border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300">Amazon B2C Channel</span>
                  <span className="text-sm font-bold text-emerald-400">
                    Net Margin: {calcResult.amazon.netMargin.toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                  <div>이익: ${calcResult.amazon.netProfit.toFixed(2)} / unit</div>
                  <div>BEP 판매가: ${calcResult.amazon.breakEvenPrice.toFixed(2)}</div>
                  <div className="col-span-2 text-slate-300 font-medium">한계 수용 공급가: ${calcResult.amazon.maxAcceptableSupplierPrice.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* 진단 해설 설명 */}
            <div className="bg-slate-800 p-4 rounded text-xs leading-relaxed text-slate-300 border-l-4 border-slate-500">
              <strong className="block text-slate-200 mb-1">자동 분석 진단</strong>
              {calcResult.statusReason}
            </div>

            {/* 계산 스냅샷 저장 단추 */}
            <button
              onClick={() => setShowSaveModal(true)}
              className="w-full py-3 bg-white text-slate-900 rounded font-semibold text-sm hover:bg-slate-100 transition shadow"
            >
              계산 결과 저장하기 (Save Snapshot)
            </button>
          </div>
        )}

        {/* Warnings Panel */}
        {calcResult && calcResult.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-xs space-y-2 text-amber-800">
            <strong className="block text-amber-900">⚠️ 비용 중복 및 계산 관련 안내</strong>
            <ul className="list-disc pl-4 space-y-1">
              {calcResult.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Waterfall 비주얼화 패널 */}
        {calcResult && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">Profit Waterfall Chart</h3>
            
            {/* 채널 탭 선택 (Both 일때만 둘 중 하나 전환해서 보기) */}
            {channel === "both" ? (
              <div className="flex bg-slate-100 p-1 rounded-md text-xs shrink-0">
                <button
                  onClick={() => setChannelView("b2b")}
                  className={`flex-1 py-1.5 rounded-md font-semibold text-center ${channelView === "b2b" ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
                >
                  Offline B2B
                </button>
                <button
                  onClick={() => setChannelView("amazon")}
                  className={`flex-1 py-1.5 rounded-md font-semibold text-center ${channelView === "amazon" ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
                >
                  Amazon B2C
                </button>
              </div>
            ) : null}

            {/* Waterfall Table & Bars */}
            <div className="space-y-4 pt-2">
              {renderWaterfallList(calcResult, channel === "both" ? channelView : channel)}
            </div>
          </div>
        )}
      </div>

      {/* Both 선택시 Waterfall용 클라이언트 채널 선택 토글 상태 */}
      {channel === "both" && <BothChannelToggle helper={{ channelView, setChannelView }} />}

      {/* 3. Save snapshot Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">시뮬레이션 계산 결과 저장</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <form onSubmit={handleSaveCalculationSnapshot} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">계산 이름 (필수)</label>
                <input
                  type="text"
                  required
                  placeholder="예: 2026_스킨케어_B2B_시뮬레이션"
                  value={calcName}
                  onChange={(e) => setCalcName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">메모 및 세부조건 기술</label>
                <textarea
                  placeholder="예: 미국 B2B 오프라인 마케팅비를 8%로 오버라이드하고 수입 물류비를 실제 선적건 데이터 기준으로 변경하여 테스트함."
                  value={calcNotes}
                  onChange={(e) => setCalcNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded text-sm hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-sm hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "결과 및 스냅샷 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// B2B/Amazon Waterfall 렌더링 헬퍼
function renderWaterfallList(calcResult: CalculationResult, activeChan: "b2b" | "amazon") {
  const result: ChannelResult | undefined = activeChan === "b2b" ? calcResult.b2b : calcResult.amazon;
  if (!result) return null;

  const maxAmount = result.grossSales || 1;

  return (
    <div className="space-y-3 font-sans">
      {result.waterfall.map((step, index) => {
        const isCost = step.amount < 0;
        const absAmount = Math.abs(step.amount);
        const percent = Math.min(100, (absAmount / maxAmount) * 100);

        // 단계 중요 요약색상 매핑
        const isHeaderStep = ["Gross Sales", "Net Sales", "Gross Profit", "Contribution Profit", "Operating Profit", "Estimated Net Profit"].includes(step.label);

        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className={isHeaderStep ? "text-slate-900 font-bold" : "text-slate-500 font-medium"}>
                {step.label}
              </span>
              <div className="space-x-2 text-right">
                <span className={isCost ? "text-red-600" : "text-slate-900"}>
                  {isCost ? "-" : ""}${absAmount.toFixed(2)}
                </span>
                <span className="text-slate-400 text-[10px]">
                  ({step.percentOfNetSales.toFixed(1)}%)
                </span>
              </div>
            </div>
            
            {/* HTML/CSS Bar graph */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${percent}%` }}
                className={`h-full rounded-full ${
                  isHeaderStep
                    ? "bg-slate-900"
                    : isCost
                    ? "bg-red-500/80"
                    : "bg-emerald-500/80"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Landed cost 계산 헬퍼
function resCalculatedLanded(calcResult: CalculationResult) {
  if (calcResult.b2b) return calcResult.b2b.landedCost.toFixed(2);
  if (calcResult.amazon) return calcResult.amazon.landedCost.toFixed(2);
  return "0.00";
}

// Both 채널 뷰잉 토글용 헬퍼 상태
function BothChannelToggle({ helper }: { helper: { channelView: "b2b" | "amazon"; setChannelView: any } }) {
  // 클라이언트 내부 상태 관리용 (실제 setup은 parent에 구성)
  return null;
}

// B2B/Amazon Waterfall 차트 보기용 Toggle wrapper 상태 훅
function useChannelToggle() {
  const [channelView, setChannelView] = useState<"b2b" | "amazon">("b2b");
  return { channelView, setChannelView };
}
