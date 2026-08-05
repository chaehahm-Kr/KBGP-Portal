export interface CalculationInputs {
  mode: "analyze_profitability" | "calculate_pricing";
  channel: "b2b" | "amazon" | "both";
  supplierUnitPrice: number; // 공급가 원본 금액
  currency: "KRW" | "USD";
  exchangeRate: number;
  exchangeRateDate?: string;
  exchangeRateSource?: string;
  proposedMSRP?: number; // MSRP
  b2bPriceMode?: "retail_based" | "wholesale_based"; // B2B 가격 입력 모드
  wholesalePrice?: number; // B2B 도매 공급가
  amazonListPrice?: number; // Amazon 판매가
  retailerTargetMargin?: number; // B2B 소매 마진 목표 (%)
  targetMetric?: "gross_margin" | "contribution_margin" | "operating_margin" | "net_margin" | "min_profit";
  targetValue?: number; // 목표 마진율 (%) 또는 금액 ($)
  fbaFeeSource?: string; // 'scenario_default' | 'manual'
  packageInfo?: Record<string, any>;
  detailedImportInfo?: Record<string, any>;
  overrides?: Record<string, number>; // 화면 조율 오버라이드
}

export interface WaterfallStep {
  label: string;
  amount: number;
  percentOfNetSales: number;
}

export interface ChannelResult {
  grossSales: number;
  netSales: number;
  landedCost: number;
  grossProfit: number;
  grossMargin: number;
  contributionProfit: number;
  contributionMargin: number;
  operatingProfit: number;
  operatingMargin: number;
  netProfit: number;
  netMargin: number;
  waterfall: WaterfallStep[];
  breakEvenPrice: number;
  maxAcceptableSupplierPrice: number;
  requiredReduction: number;
}

export interface ScenarioResult {
  warnings: string[];
  status: "approved" | "conditional" | "review_required" | "not_viable";
  statusReason: string;
  b2b?: ChannelResult;
  amazon?: ChannelResult;
}

export interface PresetCalculationResult {
  originalSupplierPrice: number;
  originalCurrency: "KRW" | "USD";
  convertedSupplierPriceUSD: number;
  appliedExchangeRate: number;
  exchangeRateDate: string;
  exchangeRateSource: string;
  conservative: ScenarioResult;
  expected: ScenarioResult;
  optimistic: ScenarioResult;
}

/**
 * 3대 시나리오(Conservative, Expected, Optimistic) 동시 연산 처리
 */
export function calculatePresetProfitability(
  inputs: CalculationInputs,
  presetScenarioValues: {
    conservative: Record<string, number>;
    expected: Record<string, number>;
    optimistic: Record<string, number>;
  }
): PresetCalculationResult {
  // 1. 달러 공급가 환산 및 정보 보존
  const appliedExchangeRate = inputs.exchangeRate || 1350.00;
  const convertedSupplierPriceUSD =
    inputs.currency === "KRW"
      ? inputs.supplierUnitPrice / appliedExchangeRate
      : inputs.supplierUnitPrice;

  // 2. 각 시나리오별 결과 개별 연산
  const conservativeResult = computeSingleScenario(inputs, convertedSupplierPriceUSD, presetScenarioValues.conservative);
  const expectedResult = computeSingleScenario(inputs, convertedSupplierPriceUSD, presetScenarioValues.expected);
  const optimisticResult = computeSingleScenario(inputs, convertedSupplierPriceUSD, presetScenarioValues.optimistic);

  return {
    originalSupplierPrice: inputs.supplierUnitPrice,
    originalCurrency: inputs.currency,
    convertedSupplierPriceUSD,
    appliedExchangeRate,
    exchangeRateDate: inputs.exchangeRateDate || new Date().toISOString().split("T")[0],
    exchangeRateSource: inputs.exchangeRateSource || "Fallback",
    conservative: conservativeResult,
    expected: expectedResult,
    optimistic: optimisticResult,
  };
}

/** 단일 시나리오 요율 기준 계산 */
function computeSingleScenario(
  inputs: CalculationInputs,
  supplierUnitPriceUSD: number,
  scenarioValues: Record<string, number>
): ScenarioResult {
  const warnings: string[] = [];

  // 값 획득 헬퍼 (Overrides > Scenario Default)
  const getValue = (code: string, fallback: number = 0): number => {
    if (inputs.overrides && inputs.overrides[code] !== undefined) {
      return inputs.overrides[code];
    }
    return scenarioValues[code] ?? fallback;
  };

  // 상세 수입 물류 정보 파악
  const detailed = inputs.detailedImportInfo || {};
  const hasDetailedImport =
    (detailed.internationalFreight ?? 0) > 0 ||
    (detailed.dutyRate ?? 0) > 0 ||
    (detailed.customsBrokerage ?? 0) > 0 ||
    (detailed.domesticInboundFreight ?? 0) > 0;

  let packagingCost = inputs.overrides?.product_packaging_cost ?? 0;
  let prepCost = inputs.overrides?.product_prep_cost ?? 0;
  let importCost = 0;

  if (hasDetailedImport) {
    warnings.push("Detailed Import Cost가 입력되어 General Import Cost Rate(%)는 연산에서 제외되었습니다.");
    const qty = detailed.orderQuantity || 1;
    const freight = (detailed.internationalFreight ?? 0) / qty;
    const customs = (detailed.customsBrokerage ?? 0) / qty;
    const inbound = (detailed.domesticInboundFreight ?? 0) / qty;
    const receiving = (detailed.warehouseReceiving ?? 0) / qty;
    const duty = supplierUnitPriceUSD * ((detailed.dutyRate ?? 0) / 100);
    importCost = freight + customs + inbound + receiving + duty;
  } else {
    const importRate = getValue("general_import_cost_rate", 15) / 100;
    importCost = supplierUnitPriceUSD * importRate;
  }

  const landedCost = supplierUnitPriceUSD + packagingCost + prepCost + importCost;

  const result: ScenarioResult = {
    warnings,
    status: "review_required",
    statusReason: "",
  };

  // B2B 연산
  if (inputs.channel === "b2b" || inputs.channel === "both") {
    result.b2b = computeB2BChannel(inputs, landedCost, supplierUnitPriceUSD, getValue);
  }

  // Amazon B2C 연산
  if (inputs.channel === "amazon" || inputs.channel === "both") {
    result.amazon = computeAmazonChannel(inputs, landedCost, supplierUnitPriceUSD, getValue);
  }

  // 상태 해석
  evaluateStatus(inputs, result, getValue);

  return result;
}

/** B2B 채널 상세 연산 */
function computeB2BChannel(
  inputs: CalculationInputs,
  landedCost: number,
  supplierUnitPriceUSD: number,
  getValue: (code: string, fallback?: number) => number
): ChannelResult {
  let wholesalePrice = inputs.wholesalePrice || 0;
  let msrp = inputs.proposedMSRP || 0;
  const retailerMargin = (inputs.retailerTargetMargin ?? 50) / 100;

  // B2B 가격 결정 방식 자동 판별 (Retail Price Based vs Wholesale Price Based)
  if (inputs.b2bPriceMode === "retail_based") {
    // MSRP & Retailer Margin을 바탕으로 B2B 공급가(Wholesale)를 구함
    wholesalePrice = msrp * (1 - retailerMargin);
  } else if (inputs.b2bPriceMode === "wholesale_based") {
    // Wholesale & Retailer Margin을 바탕으로 MSRP 권장 소비자가를 구함
    msrp = wholesalePrice / (1 - retailerMargin || 1);
  }

  // 가격 역산 모드일 경우 Wholesale Price 역산
  if (inputs.mode === "calculate_pricing" && inputs.targetMetric && inputs.targetValue !== undefined) {
    wholesalePrice = reversePriceB2B(inputs, landedCost, supplierUnitPriceUSD, getValue);
    msrp = wholesalePrice / (1 - retailerMargin || 1);
  }

  // Waterfall 계산
  const discountRate = getValue("general_discount_rate", 0) / 100;
  const couponRate = getValue("coupon_promotion_rate", 0) / 100;
  const returnRate = getValue("sales_return_rate", 0) / 100;

  const grossSales = wholesalePrice;
  const reductions = grossSales * (discountRate + couponRate + returnRate);
  const netSales = grossSales - reductions;

  const grossProfit = netSales - landedCost;
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // 공헌이익 비용 계산
  const marketing = netSales * (getValue("b2b_marketing_rate", 5) / 100);
  const commission = netSales * (getValue("sales_commission_rate", 3) / 100);
  const paymentFee = grossSales * (getValue("b2b_payment_fee_rate", 2.5) / 100);
  const delivery = grossSales * (getValue("store_delivery_cost_rate", 3) / 100);
  const variableLabor = netSales * (getValue("variable_labor_rate", 3) / 100);

  const totalVarCosts = marketing + commission + paymentFee + delivery + variableLabor;
  const contributionProfit = grossProfit - totalVarCosts;
  const contributionMargin = netSales > 0 ? (contributionProfit / netSales) * 100 : 0;

  // 영업이익 비용 계산
  const payroll = netSales * (getValue("payroll_allocation_rate", 8) / 100);
  const overhead = netSales * (getValue("general_overhead_rate", 10) / 100);

  const operatingProfit = contributionProfit - payroll - overhead;
  const operatingMargin = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

  // 순이익 비용 계산
  const financing = landedCost * (getValue("inventory_financing_rate", 2) / 100);
  const currencyRisk = supplierUnitPriceUSD * (getValue("currency_risk_rate", 1) / 100);

  const netProfit = operatingProfit - financing - currencyRisk;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // 손익 분기점 B2B Wholesale Price
  const totalVariableRate = discountRate + couponRate + returnRate + 
    ((marketing + commission + variableLabor + payroll + overhead) / (netSales || 1)) * (1 - (discountRate + couponRate + returnRate));
  const totalFixedCosts = landedCost + paymentFee + delivery + financing + currencyRisk;
  const breakEvenPrice = totalVariableRate < 1 ? totalFixedCosts / (1 - totalVariableRate) : landedCost;

  // 허용 가능 최대 공급가 역산 (MAsP)
  const targetNetMargin = getValue("target_net_margin", 15) / 100;
  const maxAcceptableSupplierPrice = reverseMaxSupplierPriceB2B(inputs, wholesalePrice, targetNetMargin, getValue);
  const requiredReduction = Math.max(0, supplierUnitPriceUSD - maxAcceptableSupplierPrice);

  // Waterfall 구성
  const waterfall: WaterfallStep[] = [
    { label: "Gross Sales", amount: grossSales, percentOfNetSales: netSales > 0 ? (grossSales / netSales) * 100 : 0 },
    { label: "Revenue Reductions", amount: -reductions, percentOfNetSales: netSales > 0 ? (-reductions / netSales) * 100 : 0 },
    { label: "Net Sales", amount: netSales, percentOfNetSales: 100 },
    { label: "Product & Landed Cost", amount: -landedCost, percentOfNetSales: netSales > 0 ? (-landedCost / netSales) * 100 : 0 },
    { label: "Gross Profit", amount: grossProfit, percentOfNetSales: grossMargin },
    { label: "Marketing & Sales Cost", amount: -marketing - commission, percentOfNetSales: netSales > 0 ? ((-marketing - commission) / netSales) * 100 : 0 },
    { label: "Fulfillment & Channel Cost", amount: -paymentFee - delivery, percentOfNetSales: netSales > 0 ? ((-paymentFee - delivery) / netSales) * 100 : 0 },
    { label: "Variable Labor", amount: -variableLabor, percentOfNetSales: netSales > 0 ? (-variableLabor / netSales) * 100 : 0 },
    { label: "Contribution Profit", amount: contributionProfit, percentOfNetSales: contributionMargin },
    { label: "Payroll Allocation", amount: -payroll, percentOfNetSales: netSales > 0 ? (-payroll / netSales) * 100 : 0 },
    { label: "Administrative & Overhead", amount: -overhead, percentOfNetSales: netSales > 0 ? (-overhead / netSales) * 100 : 0 },
    { label: "Operating Profit", amount: operatingProfit, percentOfNetSales: operatingMargin },
    { label: "Financing & Risk", amount: -financing - currencyRisk, percentOfNetSales: netSales > 0 ? ((-financing - currencyRisk) / netSales) * 100 : 0 },
    { label: "Estimated Net Profit", amount: netProfit, percentOfNetSales: netMargin },
  ];

  return {
    grossSales,
    netSales,
    landedCost,
    grossProfit,
    grossMargin,
    contributionProfit,
    contributionMargin,
    operatingProfit,
    operatingMargin,
    netProfit,
    netMargin,
    waterfall,
    breakEvenPrice,
    maxAcceptableSupplierPrice,
    requiredReduction,
  };
}

/** Amazon 채널 상세 연산 */
function computeAmazonChannel(
  inputs: CalculationInputs,
  landedCost: number,
  supplierUnitPriceUSD: number,
  getValue: (code: string, fallback?: number) => number
): ChannelResult {
  let amazonPrice = inputs.amazonListPrice || 0;

  // 가격 역산 모드일 경우 Amazon 판매가 역산
  if (inputs.mode === "calculate_pricing" && inputs.targetMetric && inputs.targetValue !== undefined) {
    amazonPrice = reversePriceAmazon(inputs, landedCost, supplierUnitPriceUSD, getValue);
  }

  // Waterfall 계산
  const discountRate = getValue("general_discount_rate", 0) / 100;
  const couponRate = getValue("coupon_promotion_rate", 0) / 100;
  const returnRate = getValue("sales_return_rate", 0) / 100;

  const grossSales = amazonPrice;
  const reductions = grossSales * (discountRate + couponRate + returnRate);
  const netSales = grossSales - reductions;

  const grossProfit = netSales - landedCost;
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // FBA Fee 소스 판별
  let fbaFee = getValue("fba_fulfillment_fee_default", 5.2);
  if (inputs.fbaFeeSource === "manual" && inputs.overrides?.fba_fulfillment_fee !== undefined) {
    fbaFee = inputs.overrides.fba_fulfillment_fee;
  }

  // 공헌이익 비용 계산
  const adSpend = netSales * (getValue("amazon_advertising_rate", 15) / 100);
  const commission = netSales * (getValue("sales_commission_rate", 3) / 100);
  const referral = grossSales * (getValue("amazon_referral_fee_rate", 15) / 100);
  const variableLabor = netSales * (getValue("variable_labor_rate", 3) / 100);

  const totalVarCosts = adSpend + commission + referral + fbaFee + variableLabor;
  const contributionProfit = grossProfit - totalVarCosts;
  const contributionMargin = netSales > 0 ? (contributionProfit / netSales) * 100 : 0;

  // 영업이익 비용 계산
  const payroll = netSales * (getValue("payroll_allocation_rate", 8) / 100);
  const overhead = netSales * (getValue("general_overhead_rate", 10) / 100);

  const operatingProfit = contributionProfit - payroll - overhead;
  const operatingMargin = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

  // 순이익 비용 계산
  const financing = landedCost * (getValue("inventory_financing_rate", 2) / 100);
  const currencyRisk = supplierUnitPriceUSD * (getValue("currency_risk_rate", 1) / 100);

  const netProfit = operatingProfit - financing - currencyRisk;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // 손익 분기점 Amazon List Price
  const totalVariableRate = discountRate + couponRate + returnRate + 
    ((adSpend + commission + variableLabor + payroll + overhead) / (netSales || 1)) * (1 - (discountRate + couponRate + returnRate));
  const totalFixedCosts = landedCost + referral + fbaFee + financing + currencyRisk;
  const breakEvenPrice = totalVariableRate < 1 ? totalFixedCosts / (1 - totalVariableRate) : landedCost;

  // 허용 가능 최대 공급가 역산 (MAsP)
  const targetNetMargin = getValue("target_net_margin", 15) / 100;
  const maxAcceptableSupplierPrice = reverseMaxSupplierPriceAmazon(inputs, amazonPrice, targetNetMargin, getValue);
  const requiredReduction = Math.max(0, supplierUnitPriceUSD - maxAcceptableSupplierPrice);

  const waterfall: WaterfallStep[] = [
    { label: "Gross Sales", amount: grossSales, percentOfNetSales: netSales > 0 ? (grossSales / netSales) * 100 : 0 },
    { label: "Revenue Reductions", amount: -reductions, percentOfNetSales: netSales > 0 ? (-reductions / netSales) * 100 : 0 },
    { label: "Net Sales", amount: netSales, percentOfNetSales: 100 },
    { label: "Product & Landed Cost", amount: -landedCost, percentOfNetSales: netSales > 0 ? (-landedCost / netSales) * 100 : 0 },
    { label: "Gross Profit", amount: grossProfit, percentOfNetSales: grossMargin },
    { label: "Marketing & Sales Cost", amount: -adSpend - commission, percentOfNetSales: netSales > 0 ? ((-adSpend - commission) / netSales) * 100 : 0 },
    { label: "Fulfillment & Channel Cost", amount: -referral - fbaFee, percentOfNetSales: netSales > 0 ? ((-referral - fbaFee) / netSales) * 100 : 0 },
    { label: "Variable Labor", amount: -variableLabor, percentOfNetSales: netSales > 0 ? (-variableLabor / netSales) * 100 : 0 },
    { label: "Contribution Profit", amount: contributionProfit, percentOfNetSales: contributionMargin },
    { label: "Payroll Allocation", amount: -payroll, percentOfNetSales: netSales > 0 ? (-payroll / netSales) * 100 : 0 },
    { label: "Administrative & Overhead", amount: -overhead, percentOfNetSales: netSales > 0 ? (-overhead / netSales) * 100 : 0 },
    { label: "Operating Profit", amount: operatingProfit, percentOfNetSales: operatingMargin },
    { label: "Financing & Risk", amount: -financing - currencyRisk, percentOfNetSales: netSales > 0 ? ((-financing - currencyRisk) / netSales) * 100 : 0 },
    { label: "Estimated Net Profit", amount: netProfit, percentOfNetSales: netMargin },
  ];

  return {
    grossSales,
    netSales,
    landedCost,
    grossProfit,
    grossMargin,
    contributionProfit,
    contributionMargin,
    operatingProfit,
    operatingMargin,
    netProfit,
    netMargin,
    waterfall,
    breakEvenPrice,
    maxAcceptableSupplierPrice,
    requiredReduction,
  };
}

/** B2B 도매가 가격 역산 공식 */
function reversePriceB2B(
  inputs: CalculationInputs,
  landedCost: number,
  supplierUnitPriceUSD: number,
  getValue: (code: string) => number
): number {
  const discountRate = getValue("general_discount_rate") / 100;
  const couponRate = getValue("coupon_promotion_rate") / 100;
  const returnRate = getValue("sales_return_rate") / 100;
  const targetVal = (inputs.targetValue ?? 15) / 100;

  const marketing = getValue("b2b_marketing_rate") / 100;
  const commission = getValue("sales_commission_rate") / 100;
  const paymentFee = getValue("b2b_payment_fee_rate") / 100;
  const delivery = getValue("store_delivery_cost_rate") / 100;
  const labor = getValue("variable_labor_rate") / 100;
  const payroll = getValue("payroll_allocation_rate") / 100;
  const overhead = getValue("general_overhead_rate") / 100;

  const financing = landedCost * (getValue("inventory_financing_rate") / 100);
  const currencyRisk = supplierUnitPriceUSD * (getValue("currency_risk_rate") / 100);

  const red = discountRate + couponRate + returnRate;
  const term1 = (1 - red) * (1 - targetVal - marketing - commission - labor - payroll - overhead);
  const term2 = paymentFee + delivery;
  const denominator = term1 - term2;

  if (denominator <= 0.05) {
    return landedCost * 1.5;
  }

  return (landedCost + financing + currencyRisk) / denominator;
}

/** Amazon 판매가 가격 역산 공식 */
function reversePriceAmazon(
  inputs: CalculationInputs,
  landedCost: number,
  supplierUnitPriceUSD: number,
  getValue: (code: string) => number
): number {
  const discountRate = getValue("general_discount_rate") / 100;
  const couponRate = getValue("coupon_promotion_rate") / 100;
  const returnRate = getValue("sales_return_rate") / 100;
  const targetVal = (inputs.targetValue ?? 15) / 100;

  const marketing = getValue("amazon_advertising_rate") / 100;
  const commission = getValue("sales_commission_rate") / 100;
  const referral = getValue("amazon_referral_fee_rate") / 100;
  const labor = getValue("variable_labor_rate") / 100;
  const payroll = getValue("payroll_allocation_rate") / 100;
  const overhead = getValue("general_overhead_rate") / 100;

  let fbaFee = getValue("fba_fulfillment_fee_default");
  if (inputs.fbaFeeSource === "manual" && inputs.overrides?.fba_fulfillment_fee !== undefined) {
    fbaFee = inputs.overrides.fba_fulfillment_fee;
  }

  const financing = landedCost * (getValue("inventory_financing_rate") / 100);
  const currencyRisk = supplierUnitPriceUSD * (getValue("currency_risk_rate") / 100);

  const red = discountRate + couponRate + returnRate;
  const term1 = (1 - red) * (1 - targetVal - marketing - commission - labor - payroll - overhead);
  const term2 = referral;
  const denominator = term1 - term2;

  if (denominator <= 0.05) {
    return landedCost * 2.0;
  }

  return (landedCost + fbaFee + financing + currencyRisk) / denominator;
}

/** B2B 한계 공급가 역산 */
function reverseMaxSupplierPriceB2B(
  inputs: CalculationInputs,
  wholesalePrice: number,
  targetNetMargin: number,
  getValue: (code: string) => number
): number {
  const discountRate = getValue("general_discount_rate") / 100;
  const couponRate = getValue("coupon_promotion_rate") / 100;
  const returnRate = getValue("sales_return_rate") / 100;

  const marketing = getValue("b2b_marketing_rate") / 100;
  const commission = getValue("sales_commission_rate") / 100;
  const paymentFee = getValue("b2b_payment_fee_rate") / 100;
  const delivery = getValue("store_delivery_cost_rate") / 100;
  const labor = getValue("variable_labor_rate") / 100;
  const payroll = getValue("payroll_allocation_rate") / 100;
  const overhead = getValue("general_overhead_rate") / 100;

  const packagingCost = inputs.overrides?.product_packaging_cost ?? 0;
  const prepCost = inputs.overrides?.product_prep_cost ?? 0;
  
  const importRate = getValue("general_import_cost_rate") / 100;
  const financingRate = getValue("inventory_financing_rate") / 100;
  const currencyRate = getValue("currency_risk_rate") / 100;

  const red = discountRate + couponRate + returnRate;
  const netSales = wholesalePrice * (1 - red);

  const targetProfit = netSales * targetNetMargin;
  const varCosts = netSales * (marketing + commission + labor + payroll + overhead) + wholesalePrice * (paymentFee + delivery);
  
  const availableLanded = netSales - targetProfit - varCosts;

  const termSupplier = (1 + importRate) * (1 + financingRate) + currencyRate;
  const maxUSD = (availableLanded - (packagingCost + prepCost) * (1 + financingRate)) / termSupplier;

  return Math.max(0, maxUSD);
}

/** Amazon 한계 공급가 역산 */
function reverseMaxSupplierPriceAmazon(
  inputs: CalculationInputs,
  amazonPrice: number,
  targetNetMargin: number,
  getValue: (code: string) => number
): number {
  const discountRate = getValue("general_discount_rate") / 100;
  const couponRate = getValue("coupon_promotion_rate") / 100;
  const returnRate = getValue("sales_return_rate") / 100;

  const marketing = getValue("amazon_advertising_rate") / 100;
  const commission = getValue("sales_commission_rate") / 100;
  const referral = getValue("amazon_referral_fee_rate") / 100;
  const labor = getValue("variable_labor_rate") / 100;
  const payroll = getValue("payroll_allocation_rate") / 100;
  const overhead = getValue("general_overhead_rate") / 100;

  let fbaFee = getValue("fba_fulfillment_fee_default");
  if (inputs.fbaFeeSource === "manual" && inputs.overrides?.fba_fulfillment_fee !== undefined) {
    fbaFee = inputs.overrides.fba_fulfillment_fee;
  }

  const packagingCost = inputs.overrides?.product_packaging_cost ?? 0;
  const prepCost = inputs.overrides?.product_prep_cost ?? 0;
  const importRate = getValue("general_import_cost_rate") / 100;
  const financingRate = getValue("inventory_financing_rate") / 100;
  const currencyRate = getValue("currency_risk_rate") / 100;

  const red = discountRate + couponRate + returnRate;
  const netSales = amazonPrice * (1 - red);

  const targetProfit = netSales * targetNetMargin;
  const varCosts = netSales * (marketing + commission + labor + payroll + overhead) + amazonPrice * referral + fbaFee;
  
  const availableLanded = netSales - targetProfit - varCosts;

  const termSupplier = (1 + importRate) * (1 + financingRate) + currencyRate;
  const maxUSD = (availableLanded - (packagingCost + prepCost) * (1 + financingRate)) / termSupplier;

  return Math.max(0, maxUSD);
}

/** 자동 상태 진단 */
function evaluateStatus(inputs: CalculationInputs, res: ScenarioResult, getValue: (code: string) => number) {
  const targetNetMargin = getValue("target_net_margin") ?? 15;
  const targetGrossMargin = getValue("target_gross_margin") ?? 40;
  
  let totalChannels = 0;
  let passedChannels = 0;
  let isNotViable = false;

  if (res.b2b) {
    totalChannels++;
    if (res.b2b.netProfit < 0 || res.b2b.netMargin < 0) {
      isNotViable = true;
    }
    if (res.b2b.netMargin >= targetNetMargin && res.b2b.grossMargin >= targetGrossMargin) {
      passedChannels++;
    }
  }

  if (res.amazon) {
    totalChannels++;
    if (res.amazon.netProfit < 0 || res.amazon.netMargin < 0) {
      isNotViable = true;
    }
    if (res.amazon.netMargin >= targetNetMargin && res.amazon.grossMargin >= targetGrossMargin) {
      passedChannels++;
    }
  }

  if (isNotViable) {
    res.status = "not_viable";
    res.statusReason = "일부 판매 채널에서 마진이 적자이거나 실현 불가한 원가 구조를 보이고 있습니다.";
  } else if (passedChannels === totalChannels) {
    res.status = "approved";
    res.statusReason = "모든 판매 채널에서 시나리오의 목표 마진율을 정상적으로 충족합니다.";
  } else {
    res.status = "conditional";
    res.statusReason = "일부 마진율 목표에 미달하였습니다. 공급가나 마케팅비 조정을 통해 개선을 권장합니다.";
  }
}
