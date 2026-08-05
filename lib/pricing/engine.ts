import { publicEnv } from "@/lib/env/public";

export interface CalculationInputs {
  mode: "analyze_profitability" | "calculate_pricing";
  channel: "b2b" | "amazon" | "both";
  supplierUnitPrice: number; // 공급가 (원화 또는 달러)
  currency: "KRW" | "USD";
  exchangeRate: number;
  proposedMSRP?: number;
  wholesalePrice?: number; // B2B 판매가
  amazonListPrice?: number; // Amazon 판매가
  retailerTargetMargin?: number; // B2B 소매점 마진 목표 (%)
  targetMetric?: "gross_margin" | "contribution_margin" | "operating_margin" | "net_margin" | "min_profit";
  targetValue?: number; // 목표 마진율 (%) 또는 금액 ($)
  fbaFeeSource?: string; // 'scenario_default' | 'manual'
  packageInfo?: Record<string, any>;
  detailedImportInfo?: Record<string, any>;
  overrides?: Record<string, number>; // 화면에서 개별 조정한 값들 (비율 등)
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

export interface CalculationResult {
  warnings: string[];
  status: "approved" | "conditional" | "review_required" | "not_viable";
  statusReason: string;
  b2b?: ChannelResult;
  amazon?: ChannelResult;
}

/**
 * 계산 엔진: Analyze Current Profitability & Calculate Target Pricing 지원
 */
export function calculateProfitability(
  inputs: CalculationInputs,
  scenarioValues: Record<string, number>
): CalculationResult {
  const warnings: string[] = [];
  
  // 1. 값 병합 헬퍼 (Overrides > Scenario Default > Global Default)
  const getValue = (code: string, fallback: number = 0): number => {
    if (inputs.overrides && inputs.overrides[code] !== undefined) {
      return inputs.overrides[code];
    }
    return scenarioValues[code] ?? fallback;
  };

  // 2. 공급가 달러 환산
  const supplierUnitPriceUSD =
    inputs.currency === "KRW"
      ? inputs.supplierUnitPrice / inputs.exchangeRate
      : inputs.supplierUnitPrice;

  // 3. 중복 계산 방지 분석 및 Landed Cost 계산
  let packagingCost = inputs.overrides?.product_packaging_cost ?? 0;
  let prepCost = inputs.overrides?.product_prep_cost ?? 0;

  // 상세 수입 물류비 정보가 있는지 파악
  const detailed = inputs.detailedImportInfo || {};
  const hasDetailedImport =
    (detailed.internationalFreight ?? 0) > 0 ||
    (detailed.dutyRate ?? 0) > 0 ||
    (detailed.customsBrokerage ?? 0) > 0 ||
    (detailed.domesticInboundFreight ?? 0) > 0;

  let importCost = 0;
  if (hasDetailedImport) {
    warnings.push("Detailed Import Cost가 입력되어 General Import Cost Rate(%)는 연산에서 제외되었습니다.");
    // 상세 내역 합산
    const freight = (detailed.internationalFreight ?? 0) / (detailed.orderQuantity || 1);
    const customs = (detailed.customsBrokerage ?? 0) / (detailed.orderQuantity || 1);
    const inbound = (detailed.domesticInboundFreight ?? 0) / (detailed.orderQuantity || 1);
    const receiving = (detailed.warehouseReceiving ?? 0) / (detailed.orderQuantity || 1);
    const duty = supplierUnitPriceUSD * ((detailed.dutyRate ?? 0) / 100);
    importCost = freight + customs + inbound + receiving + duty;
  } else {
    const importRate = getValue("general_import_cost_rate", 15) / 100;
    importCost = supplierUnitPriceUSD * importRate;
  }

  const landedCost = supplierUnitPriceUSD + packagingCost + prepCost + importCost;

  // 결과 취합 객체
  const res: CalculationResult = {
    warnings,
    status: "review_required",
    statusReason: "",
  };

  // 4. 채널별 연산 수행
  if (inputs.channel === "b2b" || inputs.channel === "both") {
    res.b2b = computeB2BChannel(inputs, landedCost, supplierUnitPriceUSD, getValue, warnings);
  }
  
  if (inputs.channel === "amazon" || inputs.channel === "both") {
    res.amazon = computeAmazonChannel(inputs, landedCost, supplierUnitPriceUSD, getValue, warnings);
  }

  // 5. 자동 상태 진단 (Approved / Conditional / Review Required / Not Viable)
  evaluateStatus(inputs, res, getValue);

  return res;
}

/** B2B 채널 연산 */
function computeB2BChannel(
  inputs: CalculationInputs,
  landedCost: number,
  supplierUnitPriceUSD: number,
  getValue: (code: string, fallback?: number) => number,
  warnings: string[]
): ChannelResult {
  let wholesalePrice = inputs.wholesalePrice || 0;

  // 가격 역산 모드일 경우 B2B 도매가 역산
  if (inputs.mode === "calculate_pricing" && inputs.targetMetric && inputs.targetValue !== undefined) {
    wholesalePrice = reversePriceB2B(inputs, landedCost, supplierUnitPriceUSD, getValue);
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

  // 손익 분기점 역산 (BEP Wholesale Price)
  const totalVariableRate = discountRate + couponRate + returnRate + 
    ((marketing + commission + variableLabor + payroll + overhead) / (netSales || 1)) * (1 - (discountRate + couponRate + returnRate));
  const totalFixedCosts = landedCost + paymentFee + delivery + financing + currencyRisk;
  const breakEvenPrice = totalVariableRate < 1 ? totalFixedCosts / (1 - totalVariableRate) : landedCost;

  // 허용 가능 최대 공급가 역산 (MAsP)
  const targetNetMargin = getValue("target_net_margin", 15) / 100;
  const maxAcceptableSupplierPrice = reverseMaxSupplierPriceB2B(inputs, wholesalePrice, targetNetMargin, getValue);
  const requiredReduction = Math.max(0, supplierUnitPriceUSD - maxAcceptableSupplierPrice);

  // Waterfall 스냅샷 조립
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

/** Amazon 채널 연산 */
function computeAmazonChannel(
  inputs: CalculationInputs,
  landedCost: number,
  supplierUnitPriceUSD: number,
  getValue: (code: string, fallback?: number) => number,
  warnings: string[]
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

  // FBA Fee 소스
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

  // 손익 분기점 역산 (BEP Amazon List Price)
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

  // 일차방정식 역산
  // Wholesale * (1 - reductions) * (1 - TargetMargin - marketing - commission - labor - payroll - overhead) - Wholesale * (paymentFee + delivery) = landedCost + financing + currencyRisk
  const red = discountRate + couponRate + returnRate;
  const term1 = (1 - red) * (1 - targetVal - marketing - commission - labor - payroll - overhead);
  const term2 = paymentFee + delivery;
  const denominator = term1 - term2;

  if (denominator <= 0.05) {
    return landedCost * 1.5; // 분모 이상 작동시 백업
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

  // 이익액 및 비용 합산
  const targetProfit = netSales * targetNetMargin;
  const varCosts = netSales * (marketing + commission + labor + payroll + overhead) + wholesalePrice * (paymentFee + delivery);
  
  const availableLanded = netSales - targetProfit - varCosts;

  // Landed Cost = SupplierUSD * (1 + ImportRate) + Pack + Prep + LandedCost * FinancingRate + SupplierUSD * CurrencyRate
  // SupplierUSD * (1 + ImportRate) * (1 + FinancingRate) + SupplierUSD * CurrencyRate = availableLanded - (Pack + Prep) * (1 + FinancingRate)
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

/** 이익 및 마진 기반의 자동 승인/상태 진단 알고리즘 */
function evaluateStatus(inputs: CalculationInputs, res: CalculationResult, getValue: (code: string) => number) {
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
