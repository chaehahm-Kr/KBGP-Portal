"use client";

import { useState, useEffect, useRef } from "react";
import { 
  calculatePresetProfitability, 
  CalculationInputs, 
  PresetCalculationResult, 
  ScenarioResult, 
  ChannelResult,
  calculateProductCartonAndLandedCost,
  LandedCostCalculationResult
} from "@/lib/pricing/engine";
import { 
  saveCalculation, 
  fetchLiveExchangeRate, 
  getScenarioSettings,
  fetchTwoDayShippingCost,
  ScenarioGroupStructure 
} from "@/lib/pricing/actions";

interface Props {
  activeSubTab: "calculator" | "landed_cost"; // 부모 pricing-client.tsx 로부터 탭 분기 획득
  presets: any[];
  scenarios: any[];
  settings: ScenarioGroupStructure[];
  products: any[];
  initialFormToLoad?: any | null;
  onSaveSuccess: (newCalc: any) => void;
}

export function CalculatorTab({ activeSubTab, presets, scenarios, settings: initialSettings, products, initialFormToLoad, onSaveSuccess }: Props) {
  // -----------------------------------------------------------------------------
  // [기본값 설정] 분석모드: 목표가 역산, 채널: Offline B2B, 단위: USD, 세부목표: 15%, 소매마진: 50%
  // -----------------------------------------------------------------------------
  const [mode, setMode] = useState<"analyze_profitability" | "calculate_pricing">("calculate_pricing");
  const [channel, setChannel] = useState<"b2b" | "amazon" | "both">("b2b");
  
  const [currency, setCurrency] = useState<"KRW" | "USD">("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(1425); // 현실화된 기본 임시 환율 적용
  const [exchangeRateDate, setExchangeRateDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [exchangeRateSource, setExchangeRateSource] = useState<string>("Automatic");
  const [isManualRate, setIsManualRate] = useState<boolean>(false);
  const [rateWarning, setRateWarning] = useState<string | null>(null);

  // 기본 공급가 및 제품 연계
  const [supplierUnitPrice, setSupplierUnitPrice] = useState<number>(3.50); // FOB 기본 $3.50
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
  
  // -----------------------------------------------------------------------------
  // [기본값 설정] 개별 패키지 정보 기본값 (6 x 4 x 15cm / 100g) 선 대입
  // -----------------------------------------------------------------------------
  const [lengthCmStr, setLengthCmStr] = useState<string>("6");
  const [lengthInStr, setLengthInStr] = useState<string>("2.36");
  const [widthCmStr, setWidthCmStr] = useState<string>("4");
  const [widthInStr, setWidthInStr] = useState<string>("1.57");
  const [heightCmStr, setHeightCmStr] = useState<string>("15");
  const [heightInStr, setHeightInStr] = useState<string>("5.91");

  const [weightGStr, setWeightGStr] = useState<string>("100");
  const [weightKgStr, setWeightKgStr] = useState<string>("0.100");
  const [weightLbStr, setWeightLbStr] = useState<string>("0.220");

  // 실제 연산에 투입될 Canonical Metric 수치 상태 (초기 기본값 대입)
  const [canonicalLengthCm, setCanonicalLengthCm] = useState<number | undefined>(6.0);
  const [canonicalWidthCm, setCanonicalWidthCm] = useState<number | undefined>(4.0);
  const [canonicalHeightCm, setCanonicalHeightCm] = useState<number | undefined>(15.0);
  const [canonicalWeightKg, setCanonicalWeightKg] = useState<number | undefined>(0.1);

  const [preferredDimUnit, setPreferredDimUnit] = useState<"cm" | "in">("cm");
  const [preferredWeightUnit, setPreferredWeightUnit] = useState<"g" | "kg" | "lb">("g");

  // B. 수입 가정 상태
  const [importQuantity, setImportQuantity] = useState<number>(1000);
  const [maxCartonWeight, setMaxCartonWeight] = useState<number>(25.0);
  const [emptyCartonWeight, setEmptyCartonWeight] = useState<number>(1.0);
  const [cartonAllowance, setCartonAllowance] = useState<number>(1.5);
  const [importTaxAllowanceRate, setImportTaxAllowanceRate] = useState<number>(10.0); // 10% 기본

  // C. TwoDay 배송비 비동기 상태 관리 및 캐싱
  const [twodayStatus, setTwodayStatus] = useState<"pending" | "success" | "failed">("pending");
  const [twodayError, setTwodayError] = useState<string | null>(null);
  const [twodayLookupAt, setTwodayLookupAt] = useState<string | null>(null);
  
  const [fullCartonShippingCostKRW, setFullCartonShippingCostKRW] = useState<number>(0);
  const [partialCartonShippingCostKRW, setPartialCartonShippingCostKRW] = useState<number>(0);
  
  // 수동 입력 배송비 상태 (조회 실패 시 Fallback 활성화)
  const [shippingCostEntryType, setShippingCostEntryType] = useState<"automatic" | "manual">("automatic");
  const [manualFullCartonCostKRW, setManualFullCartonCostKRW] = useState<number>(0);
  const [manualPartialCartonCostKRW, setManualPartialCartonCostKRW] = useState<number>(0);

  // 디바운스 제어용 ref
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevLookupKeyRef = useRef<string>("");

  // 현재 프리셋 기준 3개 시나리오 세부 요율 맵
  const [presetSettings, setPresetSettings] = useState<ScenarioGroupStructure[]>(initialSettings);
  const [presetCalcResult, setPresetCalcResult] = useState<PresetCalculationResult | null>(null);
  const [detailedViewScenario, setDetailedViewScenario] = useState<"conservative" | "expected" | "optimistic">("expected");
  const [showOverridesAccordion, setShowOverridesAccordion] = useState<boolean>(false);

  // [신규 확장] Waterfall 명세 항목과 Donut Chart 간 마우스 오버(Hover) 상태 연동
  const [hoveredCostCategory, setHoveredCostCategory] = useState<string | null>(null);

  // 저장 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [calcName, setCalcName] = useState("");
  const [calcNotes, setCalcNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // -----------------------------------------------------------------------------
  // 양방향 단위 변환 핸들러
  // -----------------------------------------------------------------------------
  const handleLengthChange = (val: string, unit: "cm" | "in") => {
    if (unit === "cm") {
      setLengthCmStr(val);
      const num = parseFloat(val) || 0;
      if (num > 0) {
        setLengthInStr((num / 2.54).toFixed(2));
        setCanonicalLengthCm(num);
      } else {
        setLengthInStr("");
        setCanonicalLengthCm(undefined);
      }
    } else {
      setLengthInStr(val);
      const num = parseFloat(val) || 0;
      if (num > 0) {
        setLengthCmStr((num * 2.54).toFixed(2));
        setCanonicalLengthCm(num * 2.54);
      } else {
        setLengthCmStr("");
        setCanonicalLengthCm(undefined);
      }
    }
  };

  const handleWidthChange = (val: string, unit: "cm" | "in") => {
    if (unit === "cm") {
      setWidthCmStr(val);
      const num = parseFloat(val) || 0;
      if (num > 0) {
        setWidthInStr((num / 2.54).toFixed(2));
        setCanonicalWidthCm(num);
      } else {
        setWidthInStr("");
        setCanonicalWidthCm(undefined);
      }
    } else {
      setWidthInStr(val);
      const num = parseFloat(val) || 0;
      if (num > 0) {
        setWidthCmStr((num * 2.54).toFixed(2));
        setCanonicalWidthCm(num * 2.54);
      } else {
        setWidthCmStr("");
        setCanonicalWidthCm(undefined);
      }
    }
  };

  const handleHeightChange = (val: string, unit: "cm" | "in") => {
    if (unit === "cm") {
      setHeightCmStr(val);
      const num = parseFloat(val) || 0;
      if (num > 0) {
        setHeightInStr((num / 2.54).toFixed(2));
        setCanonicalHeightCm(num);
      } else {
        setHeightInStr("");
        setCanonicalHeightCm(undefined);
      }
    } else {
      setHeightInStr(val);
      const num = parseFloat(val) || 0;
      if (num > 0) {
        setHeightCmStr((num * 2.54).toFixed(2));
        setCanonicalHeightCm(num * 2.54);
      } else {
        setHeightCmStr("");
        setCanonicalHeightCm(undefined);
      }
    }
  };

  const handleWeightChange = (val: string, unit: "g" | "kg" | "lb") => {
    const num = parseFloat(val) || 0;
    if (unit === "g") {
      setWeightGStr(val);
      if (num > 0) {
        setWeightKgStr((num / 1000).toFixed(3));
        setWeightLbStr((num / 453.59237).toFixed(3));
        setCanonicalWeightKg(num / 1000);
      } else {
        setWeightKgStr("");
        setWeightLbStr("");
        setCanonicalWeightKg(undefined);
      }
    } else if (unit === "kg") {
      setWeightKgStr(val);
      if (num > 0) {
        setWeightGStr((num * 1000).toFixed(1));
        setWeightLbStr((num / 0.45359237).toFixed(3));
        setCanonicalWeightKg(num);
      } else {
        setWeightGStr("");
        setWeightLbStr("");
        setCanonicalWeightKg(undefined);
      }
    } else {
      setWeightLbStr(val);
      if (num > 0) {
        const kg = num * 0.45359237;
        setWeightKgStr(kg.toFixed(3));
        setWeightGStr((kg * 1000).toFixed(1));
        setCanonicalWeightKg(kg);
      } else {
        setWeightGStr("");
        setWeightKgStr("");
        setCanonicalWeightKg(undefined);
      }
    }
  };

  // 1) 자동 환율 로드 서비스 연동 (마운트 시점에 화폐단위와 무관하게 1회 강제 로딩 보장)
  const handleLoadAutomaticRate = async () => {
    try {
      const res = await fetchLiveExchangeRate();
      if (res.rate && res.rate > 0) {
        setExchangeRate(res.rate);
        setExchangeRateDate(res.rateDate);
        setExchangeRateSource(res.source);
        setIsManualRate(false);
        setRateWarning(res.warning || null);
      }
    } catch (e) {
      console.error("Failed to fetch live exchange rate on mount:", e);
      setRateWarning("실시간 고시 환율을 호출하지 못했습니다. 기본 임시 환율이 가동 중입니다.");
    }
  };

  useEffect(() => {
    handleLoadAutomaticRate();
  }, []);

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

  // 3) 제품 선택 시 공급가 및 입고수량, 패키지 정보 자동 로드
  useEffect(() => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      if (prod.price_usd_fob) {
        setSupplierUnitPrice(Number(prod.price_usd_fob));
        setCurrency("USD");
      }
      if (prod.carton_pack_qty) {
        setImportQuantity(Number(prod.carton_pack_qty) * 10);
      }
      const dbL = Number(prod.package_width) || 0;
      const dbW = Number(prod.package_depth) || 0;
      const dbH = Number(prod.package_height) || 0;
      const dbWt = Number(prod.package_weight) || 0;

      if (dbL > 0) handleLengthChange(dbL.toString(), "cm");
      if (dbW > 0) handleWidthChange(dbW.toString(), "cm");
      if (dbH > 0) handleHeightChange(dbH.toString(), "cm");
      if (dbWt > 0) handleWeightChange(dbWt.toString(), "kg");
    }
  }, [selectedProductId, products]);

  // 4) 로드된 데이터 복구 효과
  useEffect(() => {
    if (!initialFormToLoad) return;
    const f = initialFormToLoad;
    if (f.mode) setMode(f.mode);
    if (f.channel) setChannel(f.channel);
    if (f.original_currency) setCurrency(f.original_currency);
    
    if (f.original_supplier_price !== undefined) {
      setSupplierUnitPrice(Number(f.original_supplier_price));
    }
    if (f.exchange_rate) {
      setExchangeRate(Number(f.exchange_rate));
      setIsManualRate(true);
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

    if (f.import_quantity) setImportQuantity(f.import_quantity);
    if (f.maximum_carton_weight_kg) setMaxCartonWeight(f.maximum_carton_weight_kg);
    if (f.carton_packing_weight_kg) setEmptyCartonWeight(f.carton_packing_weight_kg);
    if (f.carton_size_allowance) setCartonAllowance(f.carton_size_allowance);
    if (f.import_tax_cost_percentage) setImportTaxAllowanceRate(f.import_tax_cost_percentage);

    if (f.package_length_cm) handleLengthChange(f.package_length_cm.toString(), "cm");
    if (f.package_width_cm) handleWidthChange(f.package_width_cm.toString(), "cm");
    if (f.package_height_cm) handleHeightChange(f.package_height_cm.toString(), "cm");
    if (f.package_weight_kg) handleWeightChange(f.package_weight_kg.toString(), "kg");

    if (f.preferred_dimension_unit) setPreferredDimUnit(f.preferred_dimension_unit);
    if (f.preferred_weight_unit) setPreferredWeightUnit(f.preferred_weight_unit);

    if (f.shipping_cost_entry_type) setShippingCostEntryType(f.shipping_cost_entry_type);
    if (f.twoday_shipping_cost_krw) {
      if (f.shipping_cost_entry_type === "manual") {
        setManualFullCartonCostKRW(f.twoday_shipping_cost_krw);
      }
    }
  }, [initialFormToLoad]);

  // -----------------------------------------------------------------------------
  // D. 카톤 크기 및 3D 적재 시뮬레이션 즉시 실행
  // -----------------------------------------------------------------------------
  const cartonCalcRes = calculateProductCartonAndLandedCost({
    importQuantity,
    maxCartonWeightKg: maxCartonWeight,
    cartonPackingWeightKg: emptyCartonWeight,
    cartonSizeAllowanceCm: cartonAllowance,
    importTaxPercentage: importTaxAllowanceRate,
    lengthCm: canonicalLengthCm,
    widthCm: canonicalWidthCm,
    heightCm: canonicalHeightCm,
    weightKg: canonicalWeightKg,
    preferredDimensionUnit: preferredDimUnit,
    preferredWeightUnit: preferredWeightUnit,
  });

  const landedCostOutput: LandedCostCalculationResult | null = 
    cartonCalcRes.success ? cartonCalcRes.result : null;

  // -----------------------------------------------------------------------------
  // E. TwoDay 배송비 비동기 자동 연동 및 디바운싱
  // -----------------------------------------------------------------------------
  const triggerTwoDayLookup = async (layout: LandedCostCalculationResult) => {
    if (!layout.fullCartonLayout) return;
    
    setTwodayStatus("pending");
    setTwodayError(null);

    const fLayout = layout.fullCartonLayout;
    const pLayout = layout.partialCartonLayout;

    try {
      const fRes = await fetchTwoDayShippingCost({
        country_code: "US",
        zip_code: "08054",
        weight_kg: fLayout.billableWeightKg,
        length: fLayout.externalDimensions.length,
        width: fLayout.externalDimensions.width,
        height: fLayout.externalDimensions.height,
      });

      if (!fRes.success) {
        throw new Error(`정규 박스 조회 실패: ${fRes.error}`);
      }

      let partialCost = 0;
      if (pLayout && layout.remainingUnits > 0) {
        const pRes = await fetchTwoDayShippingCost({
          country_code: "US",
          zip_code: "08054",
          weight_kg: pLayout.billableWeightKg,
          length: pLayout.externalDimensions.length,
          width: pLayout.externalDimensions.width,
          height: pLayout.externalDimensions.height,
        });
        if (pRes.success) {
          partialCost = pRes.total_fee_krw || 0;
        } else {
          console.warn("마지막 부분 박스 조회 실패:", pRes.error);
        }
      }

      setFullCartonShippingCostKRW(fRes.total_fee_krw || 0);
      setPartialCartonShippingCostKRW(partialCost);
      setTwodayStatus("success");
      setTwodayLookupAt(new Date().toISOString());
    } catch (err: any) {
      setTwodayStatus("failed");
      setTwodayError(err.message || "배송비 자동 조회 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (!landedCostOutput || !landedCostOutput.fullCartonLayout) return;
    if (shippingCostEntryType === "manual") return;

    const fLayout = landedCostOutput.fullCartonLayout;
    const pLayout = landedCostOutput.partialCartonLayout;
    
    const lookupKey = `${fLayout.billableWeightKg}-${fLayout.externalDimensions.length}-${fLayout.externalDimensions.width}-${fLayout.externalDimensions.height}-${pLayout?.billableWeightKg || 0}`;
    
    if (lookupKey === prevLookupKeyRef.current) return;

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    lookupTimeoutRef.current = setTimeout(() => {
      prevLookupKeyRef.current = lookupKey;
      triggerTwoDayLookup(landedCostOutput);
    }, 800);

    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, [landedCostOutput, shippingCostEntryType]);

  const handleForceRecalculateShipping = () => {
    if (landedCostOutput) {
      triggerTwoDayLookup(landedCostOutput);
    }
  };

  // -----------------------------------------------------------------------------
  // F. 최종 Landed Cost 산출
  // -----------------------------------------------------------------------------
  let calculatedLandedCostPerUnit = 0;
  let calculatedTotalLandedCostUSD = 0;
  let calculatedShippingCostPerUnitUSD = 0;
  let calculatedTaxCostPerUnitUSD = 0;
  let totalUSDProductCost = 0;
  let totalUSDShippingCost = 0;
  let totalUSDTaxAllowance = 0;

  const appliedExchangeRate = exchangeRate || 1425;

  // FOB 공급가 달러 환산값
  const brandCostUSD = currency === "KRW" ? supplierUnitPrice / appliedExchangeRate : supplierUnitPrice;

  if (landedCostOutput) {
    const finalFull = shippingCostEntryType === "manual" ? manualFullCartonCostKRW : fullCartonShippingCostKRW;
    const finalPart = shippingCostEntryType === "manual" ? manualPartialCartonCostKRW : partialCartonShippingCostKRW;
    const totalKRWShipping = (finalFull * landedCostOutput.fullCartons) + finalPart;
    
    totalUSDShippingCost = totalKRWShipping / appliedExchangeRate;
    calculatedShippingCostPerUnitUSD = totalUSDShippingCost / importQuantity;

    totalUSDProductCost = brandCostUSD * importQuantity;

    // 과세 기준액 (FOB 총제품원가 + 총배송비)
    const taxBase = totalUSDProductCost + totalUSDShippingCost;
    totalUSDTaxAllowance = taxBase * (importTaxAllowanceRate / 100);
    calculatedTaxCostPerUnitUSD = totalUSDTaxAllowance / importQuantity;

    calculatedTotalLandedCostUSD = totalUSDProductCost + totalUSDShippingCost + totalUSDTaxAllowance;
    calculatedLandedCostPerUnit = calculatedTotalLandedCostUSD / importQuantity;

    landedCostOutput.totalProductCostUSD = totalUSDProductCost;
    landedCostOutput.importTaxAllowanceTotalUSD = totalUSDTaxAllowance;
    landedCostOutput.importTaxAllowancePerUnitUSD = calculatedTaxCostPerUnitUSD;
    landedCostOutput.totalLandedCostUSD = calculatedTotalLandedCostUSD;
    landedCostOutput.landedCostPerUnitUSD = calculatedLandedCostPerUnit;
  }

  // -----------------------------------------------------------------------------
  // G. 시나리오 설정 맵 추출 헬퍼 (이중 가산 버그 수정 반영)
  // -----------------------------------------------------------------------------
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

  // 실시간 3대 시나리오 일괄 연산 실행
  useEffect(() => {
    if (supplierUnitPrice <= 0) return;
    
    const maps = extractScenarioMaps();

    const inputs: CalculationInputs = {
      mode,
      channel,
      supplierUnitPrice: brandCostUSD, // 순수 FOB 달러
      currency: "USD",
      exchangeRate: appliedExchangeRate,
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
      detailedImportInfo: {
        internationalFreight: totalUSDShippingCost, // 총 배송비 USD
        dutyRate: importTaxAllowanceRate, // 관세 및 부대비율 (10.0%)
        orderQuantity: importQuantity
      },
    };

    const results = calculatePresetProfitability(inputs, maps);
    setPresetCalcResult(results);
  }, [
    mode,
    channel,
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
    presetSettings,
    totalUSDShippingCost,
    importTaxAllowanceRate,
    importQuantity
  ]);

  const computedWholesale = b2bPriceMode === "retail_based" 
    ? proposedMSRP * (1 - retailerTargetMargin / 100) 
    : wholesalePrice;

  // -----------------------------------------------------------------------------
  // [강조용 서머리 데이터 조율]
  // -----------------------------------------------------------------------------
  const activeScenarioRes = presetCalcResult ? presetCalcResult[detailedViewScenario] : null;
  const activeB2b = activeScenarioRes?.b2b;
  const activeAmazon = activeScenarioRes?.amazon;

  // Letusto Wholesale Price & Net Margin 결정
  const displayWholesale = activeB2b ? activeB2b.grossSales : computedWholesale;
  const displayMSRP = channel === "amazon" ? (activeAmazon ? activeAmazon.grossSales : amazonListPrice) : proposedMSRP;
  
  // Net Profit & Net Margin (B2B 우선 노출)
  const displayNetProfit = channel === "amazon" 
    ? (activeAmazon ? activeAmazon.netProfit : 0) 
    : (activeB2b ? activeB2b.netProfit : 0);
  const displayNetMargin = channel === "amazon"
    ? (activeAmazon ? activeAmazon.netMargin : 0)
    : (activeB2b ? activeB2b.netMargin : 0);

  return (
    <div className="space-y-6">
      
      {/* ----------------------------------------------------------------------- */}
      {/* 탭 1: Calculator (수익성 계산기) */}
      {/* ----------------------------------------------------------------------- */}
      {activeSubTab === "calculator" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* [개선 완료] 최상단 중요 요약 수치 대시보드 - 영문 타이틀 단독 노출 및 Landed Cost 초강조 */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">FOB Cost</span>
              <strong className="text-xl text-slate-800 font-extrabold">${brandCostUSD.toFixed(2)}</strong>
              <span className="text-[9px] text-slate-400 block mt-1">FOB Supplier Price</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Import & Shipping</span>
              <strong className="text-xl text-slate-800 font-extrabold">${(calculatedShippingCostPerUnitUSD + calculatedTaxCostPerUnitUSD).toFixed(2)}</strong>
              <span className="text-[9px] text-slate-400 block mt-1">Shipping + Taxes</span>
            </div>

            {/* Landed Cost (도도착 원가) - 테두리와 보라색 음영으로 대폭 강조 */}
            <div className="bg-indigo-50 border-2 border-indigo-500 p-4 rounded-xl text-center shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Landed Cost</span>
              <strong className="text-2xl text-indigo-900 font-black">${calculatedLandedCostPerUnit.toFixed(2)}</strong>
              <span className="text-[9px] text-indigo-500 block mt-1 font-semibold">Total Delivered Cost</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Wholesale Price</span>
              <strong className="text-xl text-slate-800 font-extrabold">${displayWholesale.toFixed(2)}</strong>
              <span className="text-[9px] text-slate-400 block mt-1">B2B Supply Price</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Retail MSRP</span>
              <strong className="text-xl text-emerald-600 font-extrabold">
                ${((channel === "b2b" && activeB2b) ? (activeB2b.grossSales / (1 - retailerTargetMargin / 100 || 1)) : displayMSRP).toFixed(2)}
              </strong>
              <span className="text-[9px] text-slate-400 block mt-1">Store Selling Price</span>
            </div>

            {/* 우리의 Net Profit & Margin */}
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Net Profit</span>
              <strong className="text-xl text-emerald-800 font-extrabold">
                ${displayNetProfit.toFixed(2)} <span className="text-xs">({displayNetMargin.toFixed(1)}%)</span>
              </strong>
              <span className="text-[9px] text-emerald-600 block mt-1">Letusto Gain</span>
            </div>

          </div>

          {/* 시뮬레이션 환경 설정 컨트롤 보드 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Simulation Setup
              </h3>
              <span className="text-xs text-slate-400">Step 1 ~ 5</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              {/* Step 1. 분석 모드 */}
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

              {/* Step 2. 판매 채널 */}
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

              {/* Step 3. 공급가 입력 및 화폐 단위 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">브랜드 공급가 (FOB Cost)</label>
                <div className="flex rounded-lg shadow-2xs">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={supplierUnitPrice}
                    onChange={(e) => setSupplierUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-300 rounded-l-lg focus:outline-none focus:border-slate-800 font-bold"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="px-3 py-2 text-xs border-y border-r border-slate-300 rounded-r-lg bg-slate-50 font-bold focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KRW">KRW (₩)</option>
                  </select>
                </div>
              </div>

              {/* 환율 정보 */}
              {currency === "KRW" ? (
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-500">기준 환율 설정</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1425)}
                      className="w-full px-2 py-1.5 text-xs border border-indigo-500 rounded bg-indigo-50/20 text-right focus:outline-none font-bold"
                    />
                    <button
                      onClick={handleLoadAutomaticRate}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs"
                    >
                      자동
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/50">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">고시 환율 정보 (Yahoo)</span>
                  <div className="text-xs font-black text-slate-800">₩{exchangeRate.toLocaleString()} / USD</div>
                  <div className="text-[9px] text-slate-400">환율 고시일: {exchangeRateDate}</div>
                </div>
              )}

            </div>

            {/* Step 5. 세부 목표 가격 시뮬레이션 설정 */}
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-3">Step 5. 세부 목표 및 가격 시뮬레이션 설정</label>
              
              {mode === "analyze_profitability" ? (
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
                    설정된 목표 Net Margin을 충족하기 위해 최적 B2B Wholesale 가격 및 Amazon MSRP를 역산해 드립니다.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 비즈니스 프리셋 선택 영역 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Step 4. 비즈니스 요율 프리셋</span>
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="px-3 py-2 text-xs border border-indigo-300 rounded-lg font-semibold text-indigo-900 bg-indigo-50/20 focus:outline-none"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400 leading-relaxed max-w-lg text-right">
              {presets.find((p) => p.id === selectedPresetId)?.description || ""}
            </div>
          </div>

          {/* 시뮬레이션 결과 카드 비교 패널 */}
          {presetCalcResult && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold text-slate-900 flex items-center">
                  <span className="w-2 h-4 bg-indigo-600 rounded-full mr-2"></span>
                  시나리오별 결과 비교 (Landed Cost 반영)
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
                <ScenarioResultCard 
                  title="Conservative"
                  type="conservative"
                  res={presetCalcResult.conservative}
                  channel={channel}
                  mode={mode}
                  isActive={detailedViewScenario === "conservative"}
                  onSelect={() => setDetailedViewScenario("conservative")}
                  retailerTargetMargin={retailerTargetMargin}
                />

                <ScenarioResultCard 
                  title="Expected"
                  type="expected"
                  res={presetCalcResult.expected}
                  channel={channel}
                  mode={mode}
                  isActive={detailedViewScenario === "expected"}
                  onSelect={() => setDetailedViewScenario("expected")}
                  highlighted={true}
                  retailerTargetMargin={retailerTargetMargin}
                />

                <ScenarioResultCard 
                  title="Optimistic"
                  type="optimistic"
                  res={presetCalcResult.optimistic}
                  channel={channel}
                  mode={mode}
                  isActive={detailedViewScenario === "optimistic"}
                  onSelect={() => setDetailedViewScenario("optimistic")}
                  retailerTargetMargin={retailerTargetMargin}
                />
              </div>

              {/* [개선 완료] Waterfall & 원그래프(Donut) 분해 분석 탭 통합 및 오버 하이라이트 연동 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase">
                      {detailedViewScenario.toUpperCase()} Scenario Profit Waterfall & Donut
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowOverridesAccordion(!showOverridesAccordion)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    {showOverridesAccordion ? "임시 비용 조율 닫기" : "임시 비용 조율 (Overrides)"}
                  </button>
                </div>

                {showOverridesAccordion && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400">포장 및 부자재 가산 ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={overrides.product_packaging_cost ?? 0}
                        onChange={(e) => setOverrides({ ...overrides, product_packaging_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">FBA 입고준비(Prep) 가산 ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={overrides.product_prep_cost ?? 0}
                        onChange={(e) => setOverrides({ ...overrides, product_prep_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* B2B 원형 분석 */}
                  {channel !== "amazon" && presetCalcResult[detailedViewScenario].b2b && (
                    <div className="space-y-4">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg block">Offline B2B Share</span>
                      <DonutPieChart 
                        viewResult={presetCalcResult[detailedViewScenario].b2b!} 
                        hoveredCategory={hoveredCostCategory} 
                      />
                      <WaterfallChart 
                        viewResult={presetCalcResult[detailedViewScenario].b2b!} 
                        hoveredCategory={hoveredCostCategory} 
                        setHoveredCategory={setHoveredCostCategory} 
                      />
                    </div>
                  )}

                  {/* Amazon B2C 원형 분석 */}
                  {channel !== "b2b" && presetCalcResult[detailedViewScenario].amazon && (
                    <div className="space-y-4">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg block">Amazon B2C Share</span>
                      <DonutPieChart 
                        viewResult={presetCalcResult[detailedViewScenario].amazon!} 
                        hoveredCategory={hoveredCostCategory} 
                      />
                      <WaterfallChart 
                        viewResult={presetCalcResult[detailedViewScenario].amazon!} 
                        hoveredCategory={hoveredCostCategory} 
                        setHoveredCategory={setHoveredCostCategory} 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 탭 2: Landed Cost & Cargo (수입 물류 & 원가) */}
      {/* ----------------------------------------------------------------------- */}
      {activeSubTab === "landed_cost" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* A. Package Information (개별 패키지 정보) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
                  Product Package Dimensions
                </h3>
              </div>

              {landedCostOutput && (
                <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                  landedCostOutput.packageDataSource === "default" 
                    ? "bg-amber-50/70 border-amber-200 text-amber-800" 
                    : landedCostOutput.packageDataSource === "partial_default"
                      ? "bg-amber-50/30 border-amber-100 text-amber-700"
                      : "bg-emerald-50/40 border-emerald-200 text-emerald-800"
                }`}>
                  {landedCostOutput.packageDataSource === "default" && (
                    <p>⚠️ <strong>기본값 계산 상태</strong>: 실제 패키지 정보가 입력되지 않아 6 × 4 × 15cm 및 100g의 기본값으로 계산되었습니다. 정확한 배송비와 Landed Cost 계산을 위해 실제 패키지 정보를 입력해 주세요.</p>
                  )}
                  {landedCostOutput.packageDataSource === "partial_default" && (
                    <p>⚠️ 일부 규격이 누락되어 누락된 항목에만 추정 기본 규격이 자동 적용되었습니다. (Partial Default)</p>
                  )}
                  {landedCostOutput.packageDataSource === "user_entered" && (
                    <p>✅ <strong>Package information updated by user</strong>: 모든 규격 정보가 사용자에 의해 정확히 입력되었습니다.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 크기 입력 (cm & inch 양방향) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Length</span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => setPreferredDimUnit("cm")}
                        className={`px-1.5 py-0.5 text-[9px] rounded ${preferredDimUnit === "cm" ? "bg-slate-800 text-white font-bold" : "bg-slate-100 text-slate-500"}`}
                      >
                        cm
                      </button>
                      <button 
                        onClick={() => setPreferredDimUnit("in")}
                        className={`px-1.5 py-0.5 text-[9px] rounded ${preferredDimUnit === "in" ? "bg-slate-800 text-white font-bold" : "bg-slate-100 text-slate-500"}`}
                      >
                        in
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="cm"
                      value={lengthCmStr}
                      onChange={(e) => handleLengthChange(e.target.value, "cm")}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="inch"
                      value={lengthInStr}
                      onChange={(e) => handleLengthChange(e.target.value, "in")}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right bg-slate-50/50"
                    />
                  </div>

                  <span className="text-xs font-bold text-slate-600 block">Width</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="cm"
                      value={widthCmStr}
                      onChange={(e) => handleWidthChange(e.target.value, "cm")}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="inch"
                      value={widthInStr}
                      onChange={(e) => handleWidthChange(e.target.value, "in")}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right bg-slate-50/50"
                    />
                  </div>

                  <span className="text-xs font-bold text-slate-600 block">Height</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="cm"
                      value={heightCmStr}
                      onChange={(e) => handleHeightChange(e.target.value, "cm")}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="inch"
                      value={heightInStr}
                      onChange={(e) => handleHeightChange(e.target.value, "in")}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* 무게 입력 */}
                <div className="space-y-3 border-l border-slate-100 pl-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Weight</span>
                    <div className="flex space-x-1">
                      {(["g", "kg", "lb"] as const).map((u) => (
                        <button 
                          key={u}
                          onClick={() => setPreferredWeightUnit(u)}
                          className={`px-1.5 py-0.5 text-[9px] rounded ${preferredWeightUnit === u ? "bg-slate-800 text-white font-bold" : "bg-slate-100 text-slate-500"}`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">g 단위</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="g"
                        value={weightGStr}
                        onChange={(e) => handleWeightChange(e.target.value, "g")}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">kg 단위</label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="kg"
                        value={weightKgStr}
                        onChange={(e) => handleWeightChange(e.target.value, "kg")}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right bg-slate-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">lb 단위 (FBA)</label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="lb"
                        value={weightLbStr}
                        onChange={(e) => handleWeightChange(e.target.value, "lb")}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right bg-slate-50/50"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* B. Import Assumptions (수입 가정 조건) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
                  Import Premises & Assumptions
                </h3>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">USA ZIP 08054</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Import Quantity (units)</label>
                  <input
                    type="number"
                    min="1"
                    value={importQuantity}
                    onChange={(e) => setImportQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none font-bold"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-500 mb-1">Max Gross Weight limit (kg)</label>
                  <input
                    type="number"
                    disabled
                    value={maxCartonWeight}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 font-bold text-right"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Empty Box + Material Weight (kg)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={emptyCartonWeight}
                    onChange={(e) => setEmptyCartonWeight(Math.max(0.1, parseFloat(e.target.value) || 1.0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">Outer Box Thickness allowance (cm)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={cartonAllowance}
                    onChange={(e) => setCartonAllowance(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1">Import Duty & Cost Allowance (%)</label>
                  <div className="flex rounded-lg shadow-2xs">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={importTaxAllowanceRate}
                      onChange={(e) => setImportTaxAllowanceRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-l-lg focus:outline-none text-right font-bold"
                    />
                    <span className="px-3 py-2 border-y border-r border-slate-300 rounded-r-lg bg-slate-50 text-slate-500 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* C, D, E를 하나로 통폐합한 수입 카톤 / 부피무게 및 배송비 명세표 */}
          {landedCostOutput && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
                  Cargo Packing & Volumetric Shipping Analysis
                </h3>
                <div className="flex space-x-2">
                  <select
                    value={shippingCostEntryType}
                    onChange={(e) => setShippingCostEntryType(e.target.value as any)}
                    className="text-xs border border-slate-300 rounded-md px-2 py-0.5"
                  >
                    <option value="automatic">TwoDay 자동 API 조회</option>
                    <option value="manual">KRW 배송비 수동 직접 입력</option>
                  </select>
                  {shippingCostEntryType === "automatic" && (
                    <button
                      onClick={handleForceRecalculateShipping}
                      disabled={twodayStatus === "pending"}
                      className="px-2 py-0.5 bg-slate-800 text-white rounded text-[11px] font-semibold hover:bg-slate-700 disabled:opacity-50"
                    >
                      {twodayStatus === "pending" ? "조회 중..." : "Recalculate"}
                    </button>
                  )}
                </div>
              </div>

              {/* 통합 요약 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="p-3 border border-slate-200">Box Type</th>
                      <th className="p-3 border border-slate-200">Box Qty</th>
                      <th className="p-3 border border-slate-200">Units / Box</th>
                      <th className="p-3 border border-slate-200">Outer Box (cm)</th>
                      <th className="p-3 border border-slate-200">Gross Weight</th>
                      <th className="p-3 border border-slate-200">Volumetric Weight</th>
                      <th className="p-3 border border-slate-200">Billable Weight</th>
                      <th className="p-3 border border-slate-200">Unit Shipping Cost (KRW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1. 정규 박스 */}
                    {landedCostOutput.fullCartonLayout && (
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 border border-slate-200 font-bold text-slate-800">Full Box</td>
                        <td className="p-3 border border-slate-200 font-semibold">{landedCostOutput.fullCartons} Box</td>
                        <td className="p-3 border border-slate-200">{landedCostOutput.unitsPerCarton} 개</td>
                        <td className="p-3 border border-slate-200 font-mono">
                          {landedCostOutput.fullCartonLayout.externalDimensions.length} x {landedCostOutput.fullCartonLayout.externalDimensions.width} x {landedCostOutput.fullCartonLayout.externalDimensions.height} cm
                          <span className="text-[10px] text-slate-400 block">
                            ({(landedCostOutput.fullCartonLayout.externalDimensions.length / 2.54).toFixed(1)} x {(landedCostOutput.fullCartonLayout.externalDimensions.width / 2.54).toFixed(1)} x {(landedCostOutput.fullCartonLayout.externalDimensions.height / 2.54).toFixed(1)} in)
                          </span>
                        </td>
                        <td className="p-3 border border-slate-200">
                          {landedCostOutput.fullCartonLayout.grossActualWeightKg} kg
                          <span className="text-[10px] text-slate-400 block">({(landedCostOutput.fullCartonLayout.grossActualWeightKg / 0.45359237).toFixed(1)} lb)</span>
                        </td>
                        <td className="p-3 border border-slate-200">{landedCostOutput.fullCartonLayout.volumetricWeightKg} kg</td>
                        <td className="p-3 border border-slate-200 font-bold text-indigo-600">{landedCostOutput.fullCartonLayout.billableWeightKg} kg</td>
                        <td className="p-3 border border-slate-200 text-right">
                          {shippingCostEntryType === "manual" ? (
                            <input
                              type="number"
                              value={manualFullCartonCostKRW}
                              onChange={(e) => setManualFullCartonCostKRW(parseFloat(e.target.value) || 0)}
                              className="w-24 px-1 py-0.5 border border-indigo-200 rounded text-right font-bold"
                            />
                          ) : (
                            <span className="font-bold text-slate-900">
                              {twodayStatus === "pending" ? "조회 중..." : `₩${fullCartonShippingCostKRW.toLocaleString()}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* 2. 마지막 부분 박스 */}
                    {landedCostOutput.partialCartonLayout && landedCostOutput.remainingUnits > 0 && (
                      <tr className="hover:bg-slate-50/50 bg-amber-50/10">
                        <td className="p-3 border border-slate-200 font-bold text-amber-800">Partial Box</td>
                        <td className="p-3 border border-slate-200 font-semibold">1 Box</td>
                        <td className="p-3 border border-slate-200 text-amber-700">{landedCostOutput.remainingUnits} 개</td>
                        <td className="p-3 border border-slate-200 font-mono">
                          {landedCostOutput.partialCartonLayout.externalDimensions.length} x {landedCostOutput.partialCartonLayout.externalDimensions.width} x {landedCostOutput.partialCartonLayout.externalDimensions.height} cm
                        </td>
                        <td className="p-3 border border-slate-200">{landedCostOutput.partialCartonLayout.grossActualWeightKg} kg</td>
                        <td className="p-3 border border-slate-200">{landedCostOutput.partialCartonLayout.volumetricWeightKg} kg</td>
                        <td className="p-3 border border-slate-200 font-bold text-indigo-600">{landedCostOutput.partialCartonLayout.billableWeightKg} kg</td>
                        <td className="p-3 border border-slate-200 text-right">
                          {shippingCostEntryType === "manual" ? (
                            <input
                              type="number"
                              value={manualPartialCartonCostKRW}
                              onChange={(e) => setManualPartialCartonCostKRW(parseFloat(e.target.value) || 0)}
                              className="w-24 px-1 py-0.5 border border-indigo-200 rounded text-right font-bold"
                            />
                          ) : (
                            <span className="font-bold text-slate-900">
                              {twodayStatus === "pending" ? "조회 중..." : `₩${partialCartonShippingCostKRW.toLocaleString()}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 총 배송 요율 & CBM 집계 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row justify-between text-xs gap-4 mt-2">
                <div className="space-y-1">
                  <div>• 총 수량: <strong className="text-slate-800">{importQuantity} units</strong></div>
                  <div>• 총 수입 체적: <strong className="text-slate-800">{landedCostOutput.totalCbm.toFixed(4)} CBM</strong></div>
                  <div>• 총 청구중량: <strong className="text-slate-800">{landedCostOutput.totalBillableWeightKg} kg</strong></div>
                </div>

                <div className="text-right space-y-1">
                  {(() => {
                    const finalFull = shippingCostEntryType === "manual" ? manualFullCartonCostKRW : fullCartonShippingCostKRW;
                    const finalPart = shippingCostEntryType === "manual" ? manualPartialCartonCostKRW : partialCartonShippingCostKRW;
                    const totalKRW = (finalFull * landedCostOutput.fullCartons) + finalPart;

                    return (
                      <>
                        <div>총 배송 운임 (KRW): <strong className="text-sm text-slate-900">₩{totalKRW.toLocaleString()}</strong></div>
                        <div className="text-indigo-600 font-bold text-sm">
                          USD 환산 총 배송비: ${totalUSDShippingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          개당 배송비: ${calculatedShippingCostPerUnitUSD.toFixed(3)} / unit (환율 ₩{appliedExchangeRate.toFixed(2)})
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* F & G. 최종 Landed Cost 합산 결과 카드 */}
          {landedCostOutput && (
            <div className="bg-slate-900 text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
                  Landed Cost Summary Card
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="font-bold text-slate-400 block text-[10px] uppercase">Landed Cost Breakdown (USD)</span>
                  <div className="flex justify-between"><span>FOB Price:</span><span>${totalUSDProductCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span>Shipping Fee (USD):</span><span>${totalUSDShippingCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between border-t border-slate-700 pt-1 mt-1 font-semibold">
                    <span>Tax Base (FOB + Ship):</span>
                    <span>${(totalUSDProductCost + totalUSDShippingCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-indigo-400 font-bold">
                    <span>Import Allowance ({importTaxAllowanceRate}%):</span>
                    <span>${totalUSDTaxAllowance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="md:col-span-2 bg-indigo-950/40 p-5 rounded-xl border border-indigo-900/60 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-indigo-300 block text-[10px] uppercase">Landed Cost per Unit</span>
                    <div className="text-3xl font-black text-white mt-2">
                      ${calculatedLandedCostPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs text-slate-400 font-normal ml-2">/ Unit</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 mt-4 text-[11px] text-slate-400">
                    <div>
                      <span className="block text-[9px] text-slate-500">Unit FOB Cost</span>
                      <strong className="text-slate-200">${brandCostUSD.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">Unit Shipping</span>
                      <strong className="text-slate-200">${calculatedShippingCostPerUnitUSD.toFixed(3)}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">Unit Tax & Duty</span>
                      <strong className="text-slate-200">${calculatedTaxCostPerUnitUSD.toFixed(3)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
// [원형 도넛 그래프 컴포넌트] DonutPieChart (10% 이상 요소 4종 분류 및 오버 하이라이트 연계)
// -----------------------------------------------------------------------------
function DonutPieChart({ 
  viewResult, 
  hoveredCategory 
}: { 
  viewResult: ChannelResult; 
  hoveredCategory: string | null; 
}) {
  const supplierRate = (viewResult.landedCost / (viewResult.netSales || 1)) * 100;
  const netMargin = viewResult.netMargin;

  // 10% 이상 주요 청구비용 분리
  const marketingRate = Math.abs(viewResult.waterfall.find(w => w.label.includes("Marketing"))?.percentOfNetSales || 0);
  const adminRate = Math.abs(viewResult.waterfall.find(w => w.label.includes("Administrative") || w.label.includes("Overhead"))?.percentOfNetSales || 0);
  const othersRate = Math.max(0, 100 - supplierRate - netMargin - marketingRate - adminRate);

  const segments = [
    { id: "Landed Cost", label: "Landed Cost", value: Math.max(0, supplierRate), color: "#4f46e5" }, // Indigo
    { id: "Net Margin", label: "Net Margin", value: Math.max(0, netMargin), color: "#10b981" }, // Emerald
    { id: "Marketing", label: "Marketing Cost", value: marketingRate, color: "#f43f5e" }, // Rose
    { id: "Administrative", label: "Administrative Cost", value: adminRate, color: "#f59e0b" }, // Amber
    { id: "Others", label: "Others", value: othersRate, color: "#64748b" } // Slate
  ];

  let cumulative = 0;
  const gradientString = segments.map((seg) => {
    const start = cumulative;
    cumulative += seg.value;
    return `${seg.color} ${start.toFixed(1)}% ${cumulative.toFixed(1)}%`;
  }).join(", ");

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-col md:flex-row items-center gap-6 justify-center">
      {/* 원형 도넛 그래픽 */}
      <div 
        className="w-28 h-28 rounded-full flex items-center justify-center relative shadow-xs transition-all duration-300"
        style={{
          background: `conic-gradient(${gradientString})`
        }}
      >
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-800 text-center leading-tight">
          Net Sales<br/>100%
        </div>
      </div>

      {/* 우측 비율 텍스트 (마우스 호버 시 해당 라인 초강조) */}
      <div className="space-y-1.5 w-full md:w-auto text-xs">
        {segments.map((seg, idx) => {
          const isHovered = hoveredCategory === seg.id;
          return (
            <div 
              key={idx} 
              className={`flex items-center space-x-2 transition-all duration-150 ${
                isHovered ? "scale-105 font-black text-slate-900 bg-slate-100 p-1 rounded border border-slate-200/60 shadow-2xs" : "text-slate-600"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: seg.color }}></span>
              <span className="font-semibold">{seg.label}:</span>
              <strong className="text-sm font-extrabold" style={{ color: isHovered ? seg.color : "inherit" }}>
                {seg.value.toFixed(1)}%
              </strong>
            </div>
          );
        })}
      </div>
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
  retailerTargetMargin: number;
}

function ScenarioResultCard({ title, type, res, channel, mode, isActive, onSelect, highlighted = false, retailerTargetMargin }: CardProps) {
  const statusColors = {
    approved: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold",
    conditional: "text-amber-700 bg-amber-50 border-amber-200 font-bold",
    review_required: "text-indigo-700 bg-indigo-50 border-indigo-200 font-bold",
    not_viable: "text-red-700 bg-red-50 border-red-200 font-bold",
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
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[res.status]}`}>
            {res.status.toUpperCase()}
          </span>
        </div>

        {/* B2B 결과 분석 */}
        {channel !== "amazon" && res.b2b && (
          <div className="space-y-2 border-t border-slate-100/80 pt-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Offline B2B</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-400 text-[10px] font-bold">Landed Cost</div>
                <div className="font-extrabold text-slate-800 text-sm">${res.b2b.landedCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-bold">
                  {mode === "calculate_pricing" ? "Recommended Wholesale" : "Wholesale Price"}
                </div>
                <div className="font-black text-indigo-600 text-sm">${res.b2b.grossSales.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-bold">Estimated Retail MSRP</div>
                <div className="font-extrabold text-emerald-600 text-sm">
                  ${(res.b2b.grossSales / (1 - retailerTargetMargin / 100 || 1)).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-bold">Net Margin (Letusto)</div>
                <div className="font-black text-slate-900 text-sm">{res.b2b.netMargin.toFixed(1)}%</div>
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
                <div className="text-slate-400 text-[10px] font-bold">Landed Cost</div>
                <div className="font-extrabold text-slate-800 text-sm">${res.amazon.landedCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-bold">
                  {mode === "calculate_pricing" ? "Recommended MSRP" : "Amazon MSRP"}
                </div>
                <div className="font-black text-indigo-600 text-sm">${res.amazon.grossSales.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-bold">Contribution Margin</div>
                <div className="font-semibold text-slate-700 text-sm">{res.amazon.contributionMargin.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] font-bold">Net Margin</div>
                <div className="font-black text-slate-900 text-sm">{res.amazon.netMargin.toFixed(1)}%</div>
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
// [차트 하위 컴포넌트] WaterfallChart (호버 연동 색상 점 추가 및 마우스엔터 연계)
// -----------------------------------------------------------------------------
interface WaterfallProps {
  viewResult: ChannelResult;
  hoveredCategory: string | null;
  setHoveredCategory: (cat: string | null) => void;
}

function WaterfallChart({ viewResult, hoveredCategory, setHoveredCategory }: WaterfallProps) {
  // 도넛 차트 세그먼트와 매칭되는 카테고리 판정 헬퍼
  const getMatchCategory = (label: string): string => {
    if (label.includes("Landed Cost") || label.includes("Supplier Price") || label.includes("Product")) return "Landed Cost";
    if (label.includes("Net Profit") || label.includes("Estimated Net Profit") || label.includes("Operating Profit")) return "Net Margin";
    if (label.includes("Marketing")) return "Marketing";
    if (label.includes("Administrative") || label.includes("Overhead")) return "Administrative";
    return "Others";
  };

  const getCategoryColor = (cat: string): string => {
    if (cat === "Landed Cost") return "#4f46e5";
    if (cat === "Net Margin") return "#10b981";
    if (cat === "Marketing") return "#f43f5e";
    if (cat === "Administrative") return "#f59e0b";
    return "#64748b";
  };

  return (
    <div className="space-y-2 mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200/40">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">상세 비용 차감 명세 (Waterfall)</span>
      {viewResult.waterfall.map((step, idx) => {
        const isNegative = step.amount < 0;
        const isTotal = step.label.includes("Profit") || step.label === "Net Sales" || step.label === "Gross Sales" || step.label.includes("Net Profit");
        
        const cat = getMatchCategory(step.label);
        const color = getCategoryColor(cat);
        const isHovered = hoveredCategory === cat;

        const barWidth = Math.min(100, Math.max(2, Math.abs(step.percentOfNetSales)));

        return (
          <div 
            key={idx} 
            onMouseEnter={() => setHoveredCategory(cat)}
            onMouseLeave={() => setHoveredCategory(null)}
            className={`flex items-center text-xs py-1 px-1.5 rounded transition-colors duration-150 ${
              isHovered ? "bg-indigo-50/50 shadow-3xs" : "hover:bg-slate-100/50"
            }`}
          >
            {/* 세그먼트 매치 색상 점 */}
            <span className="w-2.5 h-2.5 rounded-full mr-2 block shrink-0" style={{ backgroundColor: color }}></span>
            
            <div className="w-[35%] font-medium text-slate-700 truncate" title={step.label}>
              {step.label}
            </div>
            
            <div className="w-[45%] pr-4 flex items-center">
              <div 
                className={`h-4 rounded-sm transition-all ${
                  isTotal 
                    ? "bg-slate-900" 
                    : isNegative 
                      ? "bg-rose-500/80" 
                      : "bg-emerald-500/80"
                }`}
                style={{ width: `${barWidth}%`, backgroundColor: isHovered ? color : undefined }}
              ></div>
            </div>
            <div className="w-[10%] text-right font-semibold text-slate-800">
              ${Math.abs(step.amount).toFixed(2)}
            </div>
            <div className="w-[10%] text-right font-mono text-[10px] text-indigo-600 font-bold pr-1">
              {step.percentOfNetSales.toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
