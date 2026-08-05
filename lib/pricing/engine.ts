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
    const duty = (supplierUnitPriceUSD + freight) * ((detailed.dutyRate ?? 0) / 100); // 배송비를 합산한 금액 기준으로 10% 관세/부대비용 산출
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

// =============================================================================
// [신규 확장] Landed Cost 및 3D Carton 적재 계산기 모듈
// =============================================================================

export interface CartonVolumeInfo {
  length: number;
  width: number;
  height: number;
  unitsAlongLength: number;
  unitsAlongWidth: number;
  unitsAlongHeight: number;
  arrangement: string;
  volumeCm3: number;
  cbm: number;
}

export interface CartonDetailResult {
  unitsCount: number;
  internalDimensions: { length: number; width: number; height: number };
  externalDimensions: { length: number; width: number; height: number };
  netProductWeightKg: number;
  grossActualWeightKg: number;
  volumetricWeightKg: number;
  billableWeightKg: number;
}

export interface LandedCostCalculationResult {
  importQuantity: number;
  packageDataSource: "default" | "partial_default" | "user_entered";
  preferredDimensionUnit: "cm" | "in";
  preferredWeightUnit: "g" | "kg" | "lb";
  
  // Canonical Metric
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;

  // Converted Imperial (FBA 용)
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLb: number;

  // Carton & Packing
  maxCartonWeightKg: number;
  cartonPackingWeightKg: number;
  cartonSizeAllowanceCm: number;
  unitsPerCarton: number;
  fullCartons: number;
  remainingUnits: number;
  totalCartons: number;

  // Box Packing Layouts
  fullCartonLayout: CartonDetailResult | null;
  partialCartonLayout: CartonDetailResult | null;

  // Shipping cost
  totalBillableWeightKg: number;
  totalCbm: number;
  
  // Landed Cost Breakdown
  totalProductCostUSD: number;
  importTaxAllowancePercentage: number;
  importTaxAllowanceTotalUSD: number;
  importTaxAllowancePerUnitUSD: number;
  totalLandedCostUSD: number;
  landedCostPerUnitUSD: number;
}

/**
 * 1,000개 수입 조건하에 패키지 단위 변환, 3D 카톤 최적 배치, 무게/부피무게 및 Landed Cost 최종 연산
 */
export function calculateProductCartonAndLandedCost(
  inputs: {
    importQuantity?: number;
    maxCartonWeightKg?: number;
    cartonPackingWeightKg?: number;
    cartonSizeAllowanceCm?: number;
    importTaxPercentage?: number;
    
    // Package 정보 (cm / in / g / kg / lb 중 유저가 입력한 canonical state 기준)
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    weightKg?: number;

    preferredDimensionUnit?: "cm" | "in";
    preferredWeightUnit?: "g" | "kg" | "lb";
  }
): { success: true; result: LandedCostCalculationResult } | { success: false; error: string } {
  // 1. 기본값 적용 판단 (Length: 6cm, Width: 4cm, Height: 15cm, Weight: 100g = 0.1kg)
  const defaultLength = 6.0;
  const defaultWidth = 4.0;
  const defaultHeight = 15.0;
  const defaultWeight = 0.1; // 100g

  const userLength = inputs.lengthCm;
  const userWidth = inputs.widthCm;
  const userHeight = inputs.heightCm;
  const userWeight = inputs.weightKg;

  const lengthCm = userLength !== undefined && userLength > 0 ? userLength : defaultLength;
  const widthCm = userWidth !== undefined && userWidth > 0 ? userWidth : defaultWidth;
  const heightCm = userHeight !== undefined && userHeight > 0 ? userHeight : defaultHeight;
  const weightKg = userWeight !== undefined && userWeight > 0 ? userWeight : defaultWeight;

  // 데이터 소스 플래그 설정
  let packageDataSource: "default" | "partial_default" | "user_entered" = "user_entered";
  const anyDefault = (userLength === undefined) || (userWidth === undefined) || (userHeight === undefined) || (userWeight === undefined);
  const allDefault = (userLength === undefined) && (userWidth === undefined) && (userHeight === undefined) && (userWeight === undefined);
  
  if (allDefault) {
    packageDataSource = "default";
  } else if (anyDefault) {
    packageDataSource = "partial_default";
  }

  // 2. 음수 또는 비정상 입력값 사전 가드
  if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0 || weightKg <= 0) {
    return { success: false, error: "규격이나 무게는 0보다 커야 합니다." };
  }

  // 개당 중량이 25kg 제한에 근접하거나 초과하면 에러 리턴
  const maxCartonWeight = inputs.maxCartonWeightKg || 25.0;
  const emptyWeight = inputs.cartonPackingWeightKg !== undefined ? inputs.cartonPackingWeightKg : 1.0;
  if (weightKg >= maxCartonWeight - emptyWeight) {
    return { success: false, error: `개별 상품 무게(${weightKg.toFixed(3)}kg)가 카톤 포장 가능 최대치(${(maxCartonWeight - emptyWeight).toFixed(3)}kg)와 같거나 초과하여 박스 수입 포장이 불가능합니다.` };
  }

  // 3. Metric -> Imperial 단위 환산 (FBA 대응용)
  const lengthIn = Number((lengthCm / 2.54).toFixed(4));
  const widthIn = Number((widthCm / 2.54).toFixed(4));
  const heightIn = Number((heightCm / 2.54).toFixed(4));
  const weightLb = Number((weightKg / 0.45359237).toFixed(4));

  // 4. 박스당 적재 가능 제품 수량 (Units per Carton) 계산
  const availableWeight = maxCartonWeight - emptyWeight;
  const unitsPerCarton = Math.floor(availableWeight / weightKg);
  if (unitsPerCarton <= 0) {
    return { success: false, error: "박스에 들어갈 수 있는 최소 무게 여유가 부족합니다. 총 중량 제한을 확인해주세요." };
  }

  const importQuantity = inputs.importQuantity || 1000;
  const fullCartons = Math.floor(importQuantity / unitsPerCarton);
  const remainingUnits = importQuantity % unitsPerCarton;
  const totalCartons = fullCartons + (remainingUnits > 0 ? 1 : 0);

  // 5. 3D 최적 적재 시뮬레이션 헬퍼
  const allowance = inputs.cartonSizeAllowanceCm !== undefined ? inputs.cartonSizeAllowanceCm : 1.5;

  const simulatePacking = (qty: number): CartonDetailResult | null => {
    if (qty <= 0) return null;

    // 6개 제품 배치 회전에 대한 3차원 적재 그리드 탐색
    // (가장 카톤 부피를 최소화하고, 가로/세로/높이의 비율이 입체형에 가깝게 유지되는 최적 조합 선택)
    let minVol = Infinity;
    let bestArrangement: CartonVolumeInfo | null = null;

    // N개의 아이템을 배치하기 위해 (nx * ny * nz >= qty) 만족하는 최적 조합 탐색
    // 부피를 최소화하기 위해 1부터 qty까지의 범위를 서칭하되 비정상적으로 길어지지 않게 가드
    for (let nx = 1; nx <= qty; nx++) {
      for (let ny = 1; ny <= Math.ceil(qty / nx); ny++) {
        const nz = Math.ceil(qty / (nx * ny));
        if (nx * ny * nz < qty) continue;

        // 제품의 회전 상태 6개 조합에 대입
        const rotations = [
          { l: lengthCm, w: widthCm, h: heightCm, name: "L-W-H" },
          { l: lengthCm, w: heightCm, h: widthCm, name: "L-H-W" },
          { l: widthCm, w: lengthCm, h: heightCm, name: "W-L-H" },
          { l: widthCm, w: heightCm, h: lengthCm, name: "W-H-L" },
          { l: heightCm, w: lengthCm, h: widthCm, name: "H-L-W" },
          { l: heightCm, w: widthCm, h: lengthCm, name: "H-W-L" },
        ];

        for (const rot of rotations) {
          const lBox = nx * rot.l;
          const wBox = ny * rot.w;
          const hBox = nz * rot.h;
          
          const vol = lBox * wBox * hBox;

          // 어느 한쪽이 너무 기형적으로 길어지는 레이아웃 배제 (예: 가로/세로/높이 비율 편차 제한)
          const maxDim = Math.max(lBox, wBox, hBox);
          const minDim = Math.min(lBox, wBox, hBox);
          if (maxDim / minDim > 4.5 && qty > 4) continue; // 극단적인 막대형 박스 필터링

          if (vol < minVol) {
            minVol = vol;
            bestArrangement = {
              length: Number(lBox.toFixed(2)),
              width: Number(wBox.toFixed(2)),
              height: Number(hBox.toFixed(2)),
              unitsAlongLength: nx,
              unitsAlongWidth: ny,
              unitsAlongHeight: nz,
              arrangement: `${rot.name} rotation (Arranged ${nx}x${ny}x${nz})`,
              volumeCm3: vol,
              cbm: vol / 1000000,
            };
          }
        }
      }
    }

    if (!bestArrangement) {
      // Fallback: 단순 한줄 나열 적재
      const vol = (lengthCm * qty) * widthCm * heightCm;
      bestArrangement = {
        length: lengthCm * qty,
        width: widthCm,
        height: heightCm,
        unitsAlongLength: qty,
        unitsAlongWidth: 1,
        unitsAlongHeight: 1,
        arrangement: "Fallback Linear",
        volumeCm3: vol,
        cbm: vol / 1000000,
      };
    }

    const extLength = Number((bestArrangement.length + allowance).toFixed(2));
    const extWidth = Number((bestArrangement.width + allowance).toFixed(2));
    const extHeight = Number((bestArrangement.height + allowance).toFixed(2));

    const netProductWeight = qty * weightKg;
    const grossActualWeight = netProductWeight + emptyWeight;

    // TwoDay 공식 Divisor = 5000 반영 (체적 부피 무게)
    const volumetricWeight = (extLength * extWidth * extHeight) / 5000;
    const billableWeight = Math.max(grossActualWeight, volumetricWeight);

    return {
      unitsCount: qty,
      internalDimensions: { length: bestArrangement.length, width: bestArrangement.width, height: bestArrangement.height },
      externalDimensions: { length: extLength, width: extWidth, height: extHeight },
      netProductWeightKg: Number(netProductWeight.toFixed(3)),
      grossActualWeightKg: Number(grossActualWeight.toFixed(3)),
      volumetricWeightKg: Number(volumetricWeight.toFixed(3)),
      billableWeightKg: Number(billableWeight.toFixed(3)),
    };
  };

  const fullCartonLayout = simulatePacking(unitsPerCarton);
  const partialCartonLayout = simulatePacking(remainingUnits);

  // 6. 전체 청구중량 및 전체 CBM 합산
  let totalBillableWeightKg = 0;
  let totalCbm = 0;

  if (fullCartonLayout) {
    totalBillableWeightKg += fullCartonLayout.billableWeightKg * fullCartons;
    const fullVol = fullCartonLayout.externalDimensions.length * fullCartonLayout.externalDimensions.width * fullCartonLayout.externalDimensions.height;
    totalCbm += (fullVol / 1000000) * fullCartons;
  }
  if (partialCartonLayout) {
    totalBillableWeightKg += partialCartonLayout.billableWeightKg;
    const partVol = partialCartonLayout.externalDimensions.length * partialCartonLayout.externalDimensions.width * partialCartonLayout.externalDimensions.height;
    totalCbm += (partVol / 1000000);
  }

  // 7. 예상 세금 및 수입부대비용 (Allowance) 계산
  // (실무자 조율 가능, 기본 10% 가산)
  const importTaxPercentage = inputs.importTaxPercentage !== undefined ? inputs.importTaxPercentage : 10.0;

  return {
    success: true,
    result: {
      importQuantity,
      packageDataSource,
      preferredDimensionUnit: inputs.preferredDimensionUnit || "cm",
      preferredWeightUnit: inputs.preferredWeightUnit || "g",
      lengthCm,
      widthCm,
      heightCm,
      weightKg,
      lengthIn,
      widthIn,
      heightIn,
      weightLb,
      maxCartonWeightKg: maxCartonWeight,
      cartonPackingWeightKg: emptyWeight,
      cartonSizeAllowanceCm: allowance,
      unitsPerCarton,
      fullCartons,
      remainingUnits,
      totalCartons,
      fullCartonLayout,
      partialCartonLayout,
      totalBillableWeightKg: Number(totalBillableWeightKg.toFixed(3)),
      totalCbm: Number(totalCbm.toFixed(4)),
      
      // Landed Cost 기반 (배송비는 나중에 클라이언트 단에서 TwoDay API 조회를 거쳐 더해짐)
      totalProductCostUSD: 0, 
      importTaxAllowancePercentage: importTaxPercentage,
      importTaxAllowanceTotalUSD: 0,
      importTaxAllowancePerUnitUSD: 0,
      totalLandedCostUSD: 0,
      landedCostPerUnitUSD: 0,
    },
  };
}

