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
  presets: any[];
  scenarios: any[];
  settings: ScenarioGroupStructure[];
  products: any[];
  initialFormToLoad?: any | null;
  onSaveSuccess: (newCalc: any) => void;
}

export function CalculatorTab({ presets, scenarios, settings: initialSettings, products, initialFormToLoad, onSaveSuccess }: Props) {
  // -----------------------------------------------------------------------------
  // 1. 계산기 기본 상태 및 핵심 입력 상태
  // -----------------------------------------------------------------------------
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
  
  // -----------------------------------------------------------------------------
  // [신규 확장] A. 패키지 규격 입력을 위한 독립 로컬 스트링 상태 (양방향 무한루프 방지)
  // -----------------------------------------------------------------------------
  const [lengthCmStr, setLengthCmStr] = useState<string>("");
  const [lengthInStr, setLengthInStr] = useState<string>("");
  const [widthCmStr, setWidthCmStr] = useState<string>("");
  const [widthInStr, setWidthInStr] = useState<string>("");
  const [heightCmStr, setHeightCmStr] = useState<string>("");
  const [heightInStr, setHeightInStr] = useState<string>("");

  const [weightGStr, setWeightGStr] = useState<string>("");
  const [weightKgStr, setWeightKgStr] = useState<string>("");
  const [weightLbStr, setWeightLbStr] = useState<string>("");

  // 실제 연산에 투입될 Canonical Metric 수치 상태
  const [canonicalLengthCm, setCanonicalLengthCm] = useState<number | undefined>(undefined);
  const [canonicalWidthCm, setCanonicalWidthCm] = useState<number | undefined>(undefined);
  const [canonicalHeightCm, setCanonicalHeightCm] = useState<number | undefined>(undefined);
  const [canonicalWeightKg, setCanonicalWeightKg] = useState<number | undefined>(undefined);

  // 선호 표시 단위 저장
  const [preferredDimUnit, setPreferredDimUnit] = useState<"cm" | "in">("cm");
  const [preferredWeightUnit, setPreferredWeightUnit] = useState<"g" | "kg" | "lb">("g");

  // -----------------------------------------------------------------------------
  // [신규 확장] B. 수입 가정 상태
  // -----------------------------------------------------------------------------
  const [importQuantity, setImportQuantity] = useState<number>(1000);
  const [maxCartonWeight, setMaxCartonWeight] = useState<number>(25.0);
  const [emptyCartonWeight, setEmptyCartonWeight] = useState<number>(1.0);
  const [cartonAllowance, setCartonAllowance] = useState<number>(1.5);
  const [importTaxAllowanceRate, setImportTaxAllowanceRate] = useState<number>(10.0); // 10% 기본

  // -----------------------------------------------------------------------------
  // [신규 확장] C. TwoDay 배송비 비동기 상태 관리 및 캐싱
  // -----------------------------------------------------------------------------
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

  // 저장 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [calcName, setCalcName] = useState("");
  const [calcNotes, setCalcNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // -----------------------------------------------------------------------------
  // [신규 확장] 양방향 단위 변환 핸들러
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
      setRawWidthCm(val);
    } else {
      setRawWidthIn(val);
    }
  };

  const setRawWidthCm = (val: string) => {
    setWidthCmStr(val);
    const num = parseFloat(val) || 0;
    if (num > 0) {
      setWidthInStr((num / 2.54).toFixed(2));
      setCanonicalWidthCm(num);
    } else {
      setWidthInStr("");
      setCanonicalWidthCm(undefined);
    }
  };

  const setRawWidthIn = (val: string) => {
    setWidthInStr(val);
    const num = parseFloat(val) || 0;
    if (num > 0) {
      setWidthCmStr((num * 2.54).toFixed(2));
      setCanonicalWidthCm(num * 2.54);
    } else {
      setWidthCmStr("");
      setCanonicalWidthCm(undefined);
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
        setImportQuantity(Number(prod.carton_pack_qty) * 10); // 기본 10박스 수입 가정
      }
      // 제품 규격 DB 로드 및 폼 반영
      const dbL = Number(prod.package_width) || 0; // DB에는 width, depth, height, weight 로 저장됨
      const dbW = Number(prod.package_depth) || 0;
      const dbH = Number(prod.package_height) || 0;
      const dbWt = Number(prod.package_weight) || 0; // kg 단위

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
    } else if (f.supplier_unit_price !== undefined) {
      setSupplierUnitPrice(Number(f.supplier_unit_price));
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

    // Landed Cost 복구
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
  // [신규 확장] D. 카톤 크기 및 3D 적재 시뮬레이션 즉시 실행
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
  // [신규 확장] E. TwoDay 배송비 비동기 자동 연동 및 디바운싱
  // -----------------------------------------------------------------------------
  const triggerTwoDayLookup = async (layout: LandedCostCalculationResult) => {
    if (!layout.fullCartonLayout) return;
    
    setTwodayStatus("pending");
    setTwodayError(null);

    const fLayout = layout.fullCartonLayout;
    const pLayout = layout.partialCartonLayout;

    try {
      // 1. 정규 박스 배송비 API 조회
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
      // 2. 마지막 부분 박스가 있는 경우 별도로 API 추가 조회
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

  // 실시간 입력값 변화에 따른 디바운스 트리거
  useEffect(() => {
    if (!landedCostOutput || !landedCostOutput.fullCartonLayout) return;
    if (shippingCostEntryType === "manual") return;

    const fLayout = landedCostOutput.fullCartonLayout;
    const pLayout = landedCostOutput.partialCartonLayout;
    
    // 캐시 키 구성 (동일 쿼리 반복 호출 방지)
    const lookupKey = `${fLayout.billableWeightKg}-${fLayout.externalDimensions.length}-${fLayout.externalDimensions.width}-${fLayout.externalDimensions.height}-${pLayout?.billableWeightKg || 0}`;
    
    if (lookupKey === prevLookupKeyRef.current) return;

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    lookupTimeoutRef.current = setTimeout(() => {
      prevLookupKeyRef.current = lookupKey; // 실제 API 조회가 수행되는 시점에 키 고정
      triggerTwoDayLookup(landedCostOutput);
    }, 800); // 800ms 디바운스 적용

    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, [landedCostOutput, shippingCostEntryType]);

  // 수동 갱신(Recalculate Shipping) 강제 트리거
  const handleForceRecalculateShipping = () => {
    if (landedCostOutput) {
      triggerTwoDayLookup(landedCostOutput);
    }
  };

  // -----------------------------------------------------------------------------
  // [신규 확장] F. 최종 Landed Cost 산출 완료
  // -----------------------------------------------------------------------------
  let calculatedLandedCostPerUnit = 0;
  let calculatedTotalLandedCostUSD = 0;
  let calculatedShippingCostPerUnitUSD = 0;
  let calculatedTaxCostPerUnitUSD = 0;
  let totalUSDProductCost = 0;
  let totalUSDShippingCost = 0;
  let totalUSDTaxAllowance = 0;

  const appliedExchangeRate = exchangeRate || 1350;

  if (landedCostOutput) {
    // 1. 배송비 KRW 결정 (자동조회 성공값 vs 수동 입력값)
    const finalFullCostKRW = shippingCostEntryType === "manual" ? manualFullCartonCostKRW : fullCartonShippingCostKRW;
    const finalPartCostKRW = shippingCostEntryType === "manual" ? manualPartialCartonCostKRW : partialCartonShippingCostKRW;
    const totalKRWShipping = (finalFullCostKRW * landedCostOutput.fullCartons) + finalPartCostKRW;
    
    // 2. 배송비 USD 환산
    totalUSDShippingCost = totalKRWShipping / appliedExchangeRate;
    calculatedShippingCostPerUnitUSD = totalUSDShippingCost / importQuantity;

    // 3. 제품 공급원가 결정
    const brandCostUSD = currency === "KRW" ? supplierUnitPrice / appliedExchangeRate : supplierUnitPrice;
    totalUSDProductCost = brandCostUSD * importQuantity;

    // 4. 수입 세금 및 부대비용 가산 (10% 등)
    const taxBase = totalUSDProductCost + totalUSDShippingCost;
    totalUSDTaxAllowance = taxBase * (importTaxAllowanceRate / 100);
    calculatedTaxCostPerUnitUSD = totalUSDTaxAllowance / importQuantity;

    // 5. 최종 Landed Cost 합산
    calculatedTotalLandedCostUSD = totalUSDProductCost + totalUSDShippingCost + totalUSDTaxAllowance;
    calculatedLandedCostPerUnit = calculatedTotalLandedCostUSD / importQuantity;

    // 객체 내 수치 바인딩
    landedCostOutput.totalProductCostUSD = totalUSDProductCost;
    landedCostOutput.importTaxAllowanceTotalUSD = totalUSDTaxAllowance;
    landedCostOutput.importTaxAllowancePerUnitUSD = calculatedTaxCostPerUnitUSD;
    landedCostOutput.totalLandedCostUSD = calculatedTotalLandedCostUSD;
    landedCostOutput.landedCostPerUnitUSD = calculatedLandedCostPerUnit;
  }

  // -----------------------------------------------------------------------------
  // G. 시나리오 설정 맵 추출 헬퍼 (기존 이익률 계산용)
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

  // 실시간 3대 시나리오 일괄 연산 실행 (Landed Cost가 반영된 USD 원가를 supplierUnitPrice로 매핑 가능하도록 바인딩)
  useEffect(() => {
    if (supplierUnitPrice <= 0) return;
    
    const maps = extractScenarioMaps();
    const finalSupplierCostUSD = calculatedLandedCostPerUnit > 0 ? calculatedLandedCostPerUnit : (currency === "KRW" ? supplierUnitPrice / appliedExchangeRate : supplierUnitPrice);

    const inputs: CalculationInputs = {
      mode,
      channel,
      supplierUnitPrice: finalSupplierCostUSD, // 연산 엔진에는 최종 Landed Cost per Unit을 원가로 흘려보내 수익성을 판단하게 함!
      currency: "USD", // 이미 달러로 변환되었으므로 고정
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
        // 기존 상세 폼과 Landed Cost 실비 자동 매핑
        internationalFreight: (shippingCostEntryType === "manual" ? manualFullCartonCostKRW : fullCartonShippingCostKRW) * (landedCostOutput?.fullCartons || 1) / appliedExchangeRate,
        dutyRate: importTaxAllowanceRate,
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
    calculatedLandedCostPerUnit
  ]);

  // computed B2B Wholesale / MSRP 상호 계산
  const computedWholesale = b2bPriceMode === "retail_based" 
    ? proposedMSRP * (1 - retailerTargetMargin / 100) 
    : wholesalePrice;

  // 스냅샷 저장
  const handleSaveSnapshot = async () => {
    if (!calcName.trim() || !presetCalcResult || !landedCostOutput) return;
    setSaving(true);
    setSaveError(null);

    const activePreset = presets.find((p) => p.id === selectedPresetId);

    const res = await saveCalculation({
      name: calcName,
      mode,
      channel,
      scenarioId: "a82d77d7-fca8-47fb-ba0d-7b242b36a101",
      presetId: selectedPresetId,
      productId: selectedProductId || null,
      targetMetric: mode === "calculate_pricing" ? targetMetric : undefined,
      targetValue: mode === "calculate_pricing" ? targetValue : undefined,
      supplierUnitPrice: presetCalcResult.convertedSupplierPriceUSD,
      originalSupplierPrice: supplierUnitPrice,
      originalCurrency: currency,
      proposedMsrp: proposedMSRP,
      wholesalePrice: computedWholesale,
      amazonListPrice,
      retailerTargetMargin,
      exchangeRate: appliedExchangeRate,
      exchangeRateDate,
      exchangeRateSource: isManualRate ? "Manual" : exchangeRateSource,
      fbaFeeSource,
      notes: calcNotes,
      status: "draft",

      // [신규 확장] Landed Cost 컬럼 33종 전량 적재
      importQuantity,
      packageLengthCm: landedCostOutput.lengthCm,
      packageWidthCm: landedCostOutput.widthCm,
      packageHeightCm: landedCostOutput.heightCm,
      packageWeightKg: landedCostOutput.weightKg,
      packageDataSource: landedCostOutput.packageDataSource,
      preferredDimensionUnit: preferredDimUnit,
      preferredWeightUnit: preferredWeightUnit,
      maximumCartonWeightKg: maxCartonWeight,
      cartonPackingWeightKg: emptyCartonWeight,
      cartonSizeAllowance: cartonAllowance,
      unitsPerCarton: landedCostOutput.unitsPerCarton,
      fullCartons: landedCostOutput.fullCartons,
      remainingUnits: landedCostOutput.remainingUnits,
      totalCartons: landedCostOutput.totalCartons,
      fullCartonDimensionsCm: landedCostOutput.fullCartonLayout?.externalDimensions || null,
      partialCartonDimensionsCm: landedCostOutput.partialCartonLayout?.externalDimensions || null,
      grossWeightKg: landedCostOutput.fullCartonLayout?.grossActualWeightKg || null,
      volumetricWeightKg: landedCostOutput.fullCartonLayout?.volumetricWeightKg || null,
      billableWeightKg: landedCostOutput.fullCartonLayout?.billableWeightKg || null,
      twodayShippingCostKrw: (shippingCostEntryType === "manual" ? manualFullCartonCostKRW : fullCartonShippingCostKRW),
      twodayLookupAt: twodayLookupAt,
      twodayLookupStatus: twodayStatus,
      shippingCostEntryType: shippingCostEntryType,
      twodayErrorMessage: twodayError,
      exchangeRateSnapshot: appliedExchangeRate,
      exchangeRateUpdatedAt: exchangeRateDate,
      totalShippingCostUsd: totalUSDShippingCost,
      shippingCostPerUnit: calculatedShippingCostPerUnitUSD,
      importTaxCostPercentage: importTaxAllowanceRate,
      importTaxCostTotal: totalUSDTaxAllowance,
      importTaxCostPerUnit: calculatedTaxCostPerUnitUSD,
      totalProductCost: totalUSDProductCost,
      totalLandedCost: calculatedTotalLandedCostUSD,
      landedCostPerUnit: calculatedLandedCostPerUnit,
      appliedScenarioSnapshot: extractScenarioMaps(),
      calculatedResults: presetCalcResult,
    });

    setSaving(true);
    if ("success" in res) {
      setShowSaveModal(false);
      onSaveSuccess({
        id: res.id,
        name: calcName,
        mode,
        channel,
        supplier_unit_price: presetCalcResult.convertedSupplierPriceUSD,
        original_supplier_price: supplierUnitPrice,
        original_currency: currency,
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

          {/* Step 3. 공급가 및 제품 연계 */}
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
              <label className="block text-xs font-bold text-slate-500 mb-1.5">브랜드 공급가 (FOB Cost)</label>
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

          {/* 환율 제어판 */}
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
                설정된 목표 Net Margin을 채우기 위해 최적 B2B Wholesale 가격 및 Amazon MSRP를 역산해 드립니다.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* [신규 확장] A. 패키지 정보 규격 및 B. 수입 가정 입력 보드 */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* A. Package Information 섹션 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
              A. Package Information (개별 판매 제품 규격)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Product Unit Scale</span>
          </div>

          {/* 기본값 적용 상태 알림 바 */}
          {landedCostOutput && (
            <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
              landedCostOutput.packageDataSource === "default" 
                ? "bg-amber-50/70 border-amber-200 text-amber-800" 
                : landedCostOutput.packageDataSource === "partial_default"
                  ? "bg-amber-50/30 border-amber-100 text-amber-700"
                  : "bg-emerald-50/40 border-emerald-200 text-emerald-800"
            }`}>
              {landedCostOutput.packageDataSource === "default" && (
                <p>⚠️ <strong>기본값 계산 상태</strong>: 실제 패키지 정보가 입력되지 않아 6 × 4 × 15cm 및 100g의 기본값으로 계산되었습니다. 정확한 배송비와 Landed Cost 계산을 위해 실제 정보를 입력해 주세요.</p>
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
                <span className="text-xs font-bold text-slate-600">가로 길이 (Length)</span>
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
                <div>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="cm"
                    value={lengthCmStr}
                    onChange={(e) => handleLengthChange(e.target.value, "cm")}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
                  />
                </div>
                <div>
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
              </div>

              <div className="text-xs font-bold text-slate-600">세로 폭 (Width)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="cm"
                    value={widthCmStr}
                    onChange={(e) => handleWidthChange(e.target.value, "cm")}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
                  />
                </div>
                <div>
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
              </div>

              <div className="text-xs font-bold text-slate-600">높이 (Height)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="cm"
                    value={heightCmStr}
                    onChange={(e) => handleHeightChange(e.target.value, "cm")}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
                  />
                </div>
                <div>
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
            </div>

            {/* 무게 입력 (g, kg, lb 삼방향 변환) */}
            <div className="space-y-3 border-l border-slate-100 pl-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">제품 무게 (Weight)</span>
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
                  <label className="block text-[10px] text-slate-400 mb-0.5">g 단위 입력</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="g"
                    value={weightGStr}
                    onChange={(e) => handleWeightChange(e.target.value, "g")}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 text-right"
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
                  <label className="block text-[10px] text-slate-400 mb-0.5">lb 단위 (미국 FBA 기준)</label>
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

        {/* B. Import Assumptions (수입 기본 조건) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
              B. Import Assumptions (수입 가정 & 조건)
            </h3>
            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">Destination: USA ZIP: 08054</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-500 mb-1.5">수입 총 수량 (units) *</label>
              <input
                type="number"
                min="1"
                value={importQuantity}
                onChange={(e) => setImportQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none font-bold"
              />
            </div>
            
            <div>
              <label className="block text-slate-500 mb-1.5">카톤당 최대 총중량 한계 (Fixed)</label>
              <input
                type="number"
                disabled
                value={maxCartonWeight}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 font-bold text-right"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">미국 오프라인 중형화물 수수료 회피용 상한</span>
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5">빈 카톤 및 부자재 무게 (kg)</label>
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
              <label className="block text-slate-500 mb-1.5">외부 박스 두께 여유 ( allowance, cm )</label>
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
              <label className="block text-slate-500 mb-1.5">예상 관세 및 수입부대비용율 (%)</label>
              <div className="flex rounded-lg shadow-2xs">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={importTaxAllowanceRate}
                  onChange={(e) => setImportTaxAllowanceRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-l-lg focus:outline-none focus:border-slate-800 text-right font-bold"
                />
                <span className="px-3 py-2 border-y border-r border-slate-300 rounded-r-lg bg-slate-50 text-slate-500 text-xs font-bold">%</span>
              </div>
              <span className="text-[9px] text-slate-400 mt-1 block leading-relaxed">
                (포함 요소: 통관수수료, 관세, 은행 송금 수수료, 보험료 및 해상 화전 할증료 등 예비비)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 오류 표시판 */}
      {!cartonCalcRes.success && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-700 font-medium">
          ⚠️ 계산 불가: {cartonCalcRes.error}
        </div>
      )}

      {/* ===================================================================== */}
      {/* [신규 확장] C. Carton 및 D. Weight 계산 수치 결과 노출 */}
      {/* ===================================================================== */}
      {landedCostOutput && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
              C & D. Carton & Weight Calculation (카톤 부피/적재 분석)
            </h3>
            <span className="text-[10px] text-slate-400">3D Packing Logic Computed</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-slate-600">
            <div className="bg-slate-50/50 p-4 rounded-xl space-y-2 border border-slate-200/50">
              <span className="font-bold text-slate-800 block text-[10px] uppercase">수입 포장 수량</span>
              <div className="flex justify-between"><span>박스당 수량:</span><strong className="text-slate-900">{landedCostOutput.unitsPerCarton} 개</strong></div>
              <div className="flex justify-between"><span>정규 박스 수:</span><strong className="text-slate-900">{landedCostOutput.fullCartons} Box</strong></div>
              <div className="flex justify-between"><span>마지막 박스 수량:</span><strong className="text-slate-900">{landedCostOutput.remainingUnits} 개</strong></div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1.5 mt-1 font-bold">
                <span>총 카톤 수:</span><span className="text-indigo-600">{landedCostOutput.totalCartons} Box</span>
              </div>
            </div>

            {/* 정규 박스 상세 규격 */}
            <div className="bg-slate-50/50 p-4 rounded-xl space-y-1.5 border border-slate-200/50">
              <span className="font-bold text-slate-800 block text-[10px] uppercase">정규 박스 (Full Box)</span>
              {landedCostOutput.fullCartonLayout ? (
                <>
                  <div className="flex justify-between">
                    <span>외부 크기:</span>
                    <strong className="text-slate-900">
                      {landedCostOutput.fullCartonLayout.externalDimensions.length}x
                      {landedCostOutput.fullCartonLayout.externalDimensions.width}x
                      {landedCostOutput.fullCartonLayout.externalDimensions.height} cm
                    </strong>
                  </div>
                  <div className="flex justify-between"><span>실무게 (Gross):</span><strong>{landedCostOutput.fullCartonLayout.grossActualWeightKg} kg</strong></div>
                  <div className="flex justify-between"><span>부피무게:</span><strong>{landedCostOutput.fullCartonLayout.volumetricWeightKg} kg</strong></div>
                  <div className="flex justify-between text-indigo-600 font-bold">
                    <span>청구 무게:</span>
                    <span>{landedCostOutput.fullCartonLayout.billableWeightKg} kg</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 italic">계산 결과 없음</div>
              )}
            </div>

            {/* 마지막 부분 박스 상세 규격 */}
            <div className="bg-slate-50/50 p-4 rounded-xl space-y-1.5 border border-slate-200/50">
              <span className="font-bold text-slate-800 block text-[10px] uppercase">부분 박스 (Partial Box)</span>
              {landedCostOutput.partialCartonLayout ? (
                <>
                  <div className="flex justify-between">
                    <span>외부 크기:</span>
                    <strong className="text-slate-900">
                      {landedCostOutput.partialCartonLayout.externalDimensions.length}x
                      {landedCostOutput.partialCartonLayout.externalDimensions.width}x
                      {landedCostOutput.partialCartonLayout.externalDimensions.height} cm
                    </strong>
                  </div>
                  <div className="flex justify-between"><span>실무게 (Gross):</span><strong>{landedCostOutput.partialCartonLayout.grossActualWeightKg} kg</strong></div>
                  <div className="flex justify-between"><span>부피무게:</span><strong>{landedCostOutput.partialCartonLayout.volumetricWeightKg} kg</strong></div>
                  <div className="flex justify-between text-indigo-600 font-bold">
                    <span>청구 무게:</span>
                    <span>{landedCostOutput.partialCartonLayout.billableWeightKg} kg</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 italic">남은 제품 없음</div>
              )}
            </div>

            {/* 총합 체적 및 중량 */}
            <div className="bg-slate-50/50 p-4 rounded-xl space-y-2 border border-slate-200/50">
              <span className="font-bold text-slate-800 block text-[10px] uppercase">총 수입 체적/중량</span>
              <div className="flex justify-between"><span>총 CBM:</span><strong className="text-slate-900">{landedCostOutput.totalCbm.toFixed(4)} CBM</strong></div>
              <div className="flex justify-between">
                <span>총 청구 중량:</span>
                <strong className="text-slate-900">
                  {landedCostOutput.totalBillableWeightKg} kg
                </strong>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 italic">
                <span>(약 {(landedCostOutput.totalBillableWeightKg / 0.45359237).toFixed(1)} lbs)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* [신규 확장] E. TwoDay 배송비 연동 결과 확인 */}
      {/* ===================================================================== */}
      {landedCostOutput && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
              E. TwoDay Shipping Costs (국제배송 운임)
            </h3>
            <div className="flex space-x-2">
              <select
                value={shippingCostEntryType}
                onChange={(e) => setShippingCostEntryType(e.target.value as any)}
                className="text-xs border border-slate-300 rounded-md px-2 py-1"
              >
                <option value="automatic">TwoDay 자동 연동 조회</option>
                <option value="manual">KRW 배송비 수동 직접 입력</option>
              </select>
              {shippingCostEntryType === "automatic" && (
                <button
                  onClick={handleForceRecalculateShipping}
                  disabled={twodayStatus === "pending"}
                  className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {twodayStatus === "pending" ? "조회 중..." : "Recalculate Shipping"}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 자동 조회 운임 결과판 */}
            {shippingCostEntryType === "automatic" ? (
              <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">TwoDay API 자동 조회 요금</span>
                  {twodayStatus === "success" && (
                    <span className="text-[10px] text-slate-400 font-mono bg-white px-2 py-0.5 rounded shadow-2xs">
                      조회 시각: {new Date(twodayLookupAt || "").toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {twodayStatus === "pending" && (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </div>
                )}

                {twodayStatus === "failed" && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <p>⚠️ 자동 조회 실패: {twodayError || "투데이 API 서버와의 연동에 오류가 발생했습니다."}</p>
                    <p className="mt-1 text-[10px] text-red-600">오른쪽 선택창에서 '수동 직접 입력' 모드로 전환하여 배송비를 강제 적용하실 수 있습니다.</p>
                  </div>
                )}

                {twodayStatus === "success" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">정규 박스 단가 (1 Box)</span>
                      <div className="font-bold text-slate-900">₩{fullCartonShippingCostKRW.toLocaleString()}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">마지막 부분 박스 단가</span>
                      <div className="font-bold text-slate-900">₩{partialCartonShippingCostKRW.toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 수동 직접 입력 폼 */
              <div className="col-span-2 bg-indigo-50/20 p-4 rounded-xl border border-indigo-100 space-y-3 text-xs">
                <span className="font-bold text-indigo-900 block">배송비 수동 직접 입력 모드</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">정규 박스당 KRW 배송비 (₩)</label>
                    <input
                      type="number"
                      value={manualFullCartonCostKRW}
                      onChange={(e) => setManualFullCartonCostKRW(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border border-indigo-200 rounded bg-white font-semibold text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">마지막 박스 KRW 배송비 (₩)</label>
                    <input
                      type="number"
                      value={manualPartialCartonCostKRW}
                      onChange={(e) => setManualPartialCartonCostKRW(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border border-indigo-200 rounded bg-white font-semibold text-right"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 총 배송비 및 USD 환산 출력 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-1.5 text-xs">
              <span className="font-bold text-slate-700 block text-[10px] uppercase">총 수입 배송비</span>
              
              {(() => {
                const finalFull = shippingCostEntryType === "manual" ? manualFullCartonCostKRW : fullCartonShippingCostKRW;
                const finalPart = shippingCostEntryType === "manual" ? manualPartialCartonCostKRW : partialCartonShippingCostKRW;
                const totalKRW = (finalFull * landedCostOutput.fullCartons) + finalPart;

                return (
                  <>
                    <div className="flex justify-between"><span>전체 배송비 (KRW):</span><strong className="text-slate-900">₩{totalKRW.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>적용 고시환율:</span><strong>₩{appliedExchangeRate.toFixed(2)}</strong></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1 text-indigo-600 font-bold">
                      <span>USD 환산 배송비:</span>
                      <span>${totalUSDShippingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      개당 환산 배송비: <strong>${calculatedShippingCostPerUnitUSD.toFixed(3)}</strong> / unit
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* [신규 확장] F. Import Tax & G. Final Landed Cost 섹션 */}
      {/* ===================================================================== */}
      {landedCostOutput && (
        <div className="bg-slate-900 text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-lg space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full mr-2"></span>
              F & G. Final Landed Cost (수입 최종 도착 원가)
            </h3>
            <span className="text-[10px] text-slate-500">All costs summarized in USD</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            
            {/* 수입 부대 비용 세부 요약 */}
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <span className="font-bold text-slate-400 block text-[10px] uppercase">F. Import Tax & Cost Allowance</span>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span>제품 공급 원가 (FOB):</span><span>${totalUSDProductCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span>국제 운송비 (USD):</span><span>${totalUSDShippingCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                  <span>과세 기준액 (Base):</span>
                  <strong>${(totalUSDProductCost + totalUSDShippingCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </div>
                <div className="flex justify-between text-indigo-400 font-bold">
                  <span>부대 비용 ({importTaxAllowanceRate}%):</span>
                  <span>${totalUSDTaxAllowance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* 최종 Landed Cost 합산 결과 */}
            <div className="md:col-span-2 bg-indigo-950/40 p-5 rounded-xl border border-indigo-900/60 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-indigo-300 block text-[10px] uppercase">G. Final Landed Cost Results</span>
                  <div className="text-2xl font-bold text-white mt-2">
                    ${calculatedLandedCostPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs text-slate-400 font-normal ml-2">/ Unit</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">수입 수량 기준 총예산</span>
                  <strong className="text-white text-sm">${calculatedTotalLandedCostUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {/* 비용 분배 브레이크다운 */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 mt-4 text-[11px] text-slate-400">
                <div>
                  <span className="block text-[9px] text-slate-500">개당 공급가</span>
                  <strong className="text-slate-200">
                    ${(currency === "KRW" ? supplierUnitPrice / appliedExchangeRate : supplierUnitPrice).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-500">개당 운송비</span>
                  <strong className="text-slate-200">${calculatedShippingCostPerUnitUSD.toFixed(3)}</strong>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-500">개당 수입부대비</span>
                  <strong className="text-slate-200">${calculatedTaxCostPerUnitUSD.toFixed(3)}</strong>
                </div>
              </div>
            </div>

          </div>

          {/* 계산 공식 명세 팝업 아코디언 */}
          <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-400 block mb-1">ℹ️ Landed Cost 산출 계산 공식 요약</span>
            <p>• <strong>Carton당 제품 수량</strong> = floor( (25kg - {emptyCartonWeight}kg [박스 및 부재자]) / 개별 제품무게 kg )</p>
            <p>• <strong>예상 수입 관세 & 부대비용</strong> = (제품 공급 원가 + 국제 배송비) × {importTaxAllowanceRate}%</p>
            <p>• <strong>최종 Landed Cost per Unit</strong> = (제품 공급 원가 + 국제 배송비 + 수입 부대비용) / 수입수량 ({importQuantity}개)</p>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. 계산 결과 표시 파트 (Conservative | Expected | Optimistic 3대 비교) */}
      {/* ===================================================================== */}
      {presetCalcResult && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <span className="w-2 h-4 bg-indigo-600 rounded-full mr-2"></span>
              Landed Cost 반영 시나리오별 시뮬레이션 결과 나란히 비교
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
              retailerTargetMargin={retailerTargetMargin}
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
              retailerTargetMargin={retailerTargetMargin}
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
              retailerTargetMargin={retailerTargetMargin}
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

      {/* 안내 문구 고시판 */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[10.5px] text-slate-500 leading-relaxed">
        본 Landed Cost는 입력된 제품 공급가격, 제품 패키지 정보, 예상 수입 카톤 구성, TwoDay 국제배송비 및 설정된 예상 세금·수입부대비용률을 기준으로 계산한 예상 원가입니다. 패키지 정보가 입력되지 않은 경우 6 × 4 × 15cm 및 100g의 기본값이 적용됩니다. 실제 관세율, 통관 수수료, 보험료, 검사비, 송금 수수료, 한국 및 미국 내륙운송비와 기타 비용에 따라 최종 원가는 달라질 수 있습니다.
      </div>

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
  retailerTargetMargin: number;
}

function ScenarioResultCard({ title, type, res, channel, mode, isActive, onSelect, highlighted = false, retailerTargetMargin }: CardProps) {
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
                <div className="text-slate-400 text-[10px]">Estimated Retail MSRP</div>
                <div className="font-bold text-emerald-600">
                  ${(res.b2b.grossSales / (1 - retailerTargetMargin / 100 || 1)).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">Net Margin (Letusto)</div>
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
  return (
    <div className="space-y-2">
      {viewResult.waterfall.map((step, idx) => {
        const isNegative = step.amount < 0;
        const isTotal = step.label.includes("Profit") || step.label === "Net Sales" || step.label === "Gross Sales" || step.label.includes("Net Profit");
        
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
