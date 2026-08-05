"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ScenarioFormState = { error: string } | { success: string } | undefined;

export interface ScenarioItemStructure {
  id: string;
  name: string;
  code: string;
  description: string | null;
  applicable_channel: "b2b" | "amazon" | "both";
  value_type: "percentage" | "dollar_per_unit" | "fixed_total" | "actual_manual" | "calculated";
  cost_basis: string | null;
  profit_stage: "revenue_reduction" | "product_landed_cost" | "contribution_cost" | "operating_expense" | "financing_risk";
  decimal_precision: number;
  product_override_allowed: boolean;
  is_required: boolean;
  is_active: boolean;
  is_archived: boolean;
  display_order: number;
  tooltip: string | null;
  values: Record<string, number>; // scenario_code -> value
}

export interface ScenarioGroupStructure {
  id: string;
  name: string;
  code: string;
  display_order: number;
  is_active: boolean;
  items: ScenarioItemStructure[];
}

export interface PricingPresetStructure {
  id: string;
  name: string;
  code: string;
  description: string | null;
  recommended_use_case: string | null;
  applicable_channel: "b2b" | "amazon" | "both";
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

/** 1. 비즈니스 프리셋 목록 로드 */
export async function getPricingPresets(): Promise<PricingPresetStructure[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_presets")
    .select("*")
    .eq("is_active", true)
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pricing presets:", error);
    return [];
  }
  return data || [];
}

/** 시나리오 목록 & 코드 기준의 기본 값 맵 조회 */
export async function getPricingScenarios() {
  const supabase = await createClient();
  const { data: scenarios, error } = await supabase
    .from("pricing_scenarios")
    .select("id, name, code, description")
    .order("code");

  if (error) {
    console.error("Error fetching pricing scenarios:", error);
    return [];
  }
  return scenarios;
}

/** 2. Preset & Scenario Settings용 특정 프리셋 기준 설정 그룹/항목 트리 로드 */
export async function getScenarioSettings(presetId: string | null): Promise<ScenarioGroupStructure[]> {
  const supabase = await createClient();
  
  // 1) 그룹 조회
  const { data: groups, error: groupErr } = await supabase
    .from("pricing_scenario_groups")
    .select("id, name, code, display_order, is_active")
    .eq("is_active", true)
    .order("display_order");

  if (groupErr || !groups) {
    console.error("Error fetching scenario groups:", groupErr);
    return [];
  }

  // 2) 항목 조회 (보관되지 않은 활성 항목들만)
  const { data: items, error: itemErr } = await supabase
    .from("pricing_scenario_items")
    .select("id, group_id, name, code, description, applicable_channel, value_type, cost_basis, profit_stage, decimal_precision, product_override_allowed, is_required, is_active, is_archived, display_order, tooltip")
    .eq("is_archived", false)
    .order("display_order");

  if (itemErr || !items) {
    console.error("Error fetching scenario items:", itemErr);
    return [];
  }

  // 3) 특정 프리셋 하위 값 매핑 조회
  let query = supabase
    .from("pricing_scenario_values")
    .select("scenario_id, item_id, value, pricing_scenarios(code)");
  
  if (!presetId || presetId === "legacy" || presetId === "null") {
    query = query.is("preset_id", null);
  } else {
    query = query.eq("preset_id", presetId);
  }

  const { data: valList, error: valErr } = await query;
  if (valErr) {
    console.error("Error fetching scenario values for preset:", valErr);
  }

  // 매핑 데이터 작성 (item_id -> { scenario_code -> value })
  const valuesMap: Record<string, Record<string, number>> = {};
  valList?.forEach((row: any) => {
    const itemId = row.item_id;
    const code = row.pricing_scenarios?.code;
    const val = Number(row.value);
    if (code) {
      if (!valuesMap[itemId]) valuesMap[itemId] = {};
      valuesMap[itemId][code] = val;
    }
  });

  // 그룹 트리 구조 조립
  return groups.map((g) => {
    const groupItems = items
      .filter((i) => i.group_id === g.id)
      .map((i) => ({
        ...i,
        applicable_channel: i.applicable_channel as any,
        value_type: i.value_type as any,
        profit_stage: i.profit_stage as any,
        values: valuesMap[i.id] || { conservative: 0, expected: 0, optimistic: 0 },
      }));

    return {
      ...g,
      items: groupItems,
    };
  });
}

/** 3. 프리셋 하위 시나리오 개별 항목값 수정 */
export async function updatePresetScenarioValue(
  presetId: string | null,
  scenarioId: string,
  itemId: string,
  value: number
): Promise<ScenarioFormState> {
  const supabase = await createClient();

  const activePresetId = (presetId === "legacy" || presetId === "null") ? null : presetId;

  // UUID 유니크 조건 보정을 태우기 위한 upsert
  const { error } = await supabase
    .from("pricing_scenario_values")
    .upsert({
      preset_id: activePresetId,
      scenario_id: scenarioId,
      item_id: itemId,
      value,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "preset_id,scenario_id,item_id"
    });

  if (error) {
    console.error("Error updating preset scenario value:", error);
    return { error: `저장 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "프리셋 설정값이 변경되었습니다." };
}

/** 4. 커스텀 비즈니스 프리셋 신설 */
export async function createCustomPreset(
  name: string,
  description: string,
  recommendedUseCase: string,
  applicableChannel: "b2b" | "amazon" | "both"
): Promise<{ error: string } | { success: string; presetId: string }> {
  const supabase = await createClient();
  const code = `custom_${Date.now()}`;

  const { data: newPreset, error: err } = await supabase
    .from("pricing_presets")
    .insert({
      name,
      code,
      description,
      recommended_use_case: recommendedUseCase,
      applicable_channel: applicableChannel,
      is_system: false,
    })
    .select("id")
    .single();

  if (err || !newPreset) {
    console.error("Error creating custom preset:", err);
    return { error: `프리셋 생성 실패: ${err?.message || "알 수 없는 오류"}` };
  }

  // 기본 글로벌 템플릿(레거시/Null Preset 하위 값) 복사해서 채워주기
  try {
    const { data: defaults } = await supabase
      .from("pricing_scenario_values")
      .select("scenario_id, item_id, value")
      .is("preset_id", null);

    if (defaults && defaults.length > 0) {
      const copyValues = defaults.map((d) => ({
        preset_id: newPreset.id,
        scenario_id: d.scenario_id,
        item_id: d.item_id,
        value: d.value,
      }));
      await supabase.from("pricing_scenario_values").insert(copyValues);
    }
  } catch (copyErr) {
    console.error("Failed to copy default scenario values to new preset:", copyErr);
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "새로운 비즈니스 프리셋이 생성되었습니다.", presetId: newPreset.id };
}

/** 5. 비즈니스 프리셋 복제 (Duplicate) */
export async function duplicatePreset(
  sourcePresetId: string,
  targetName: string
): Promise<{ error: string } | { success: string; presetId: string }> {
  const supabase = await createClient();

  // 1) 소스 프리셋 조회
  const { data: src, error: srcErr } = await supabase
    .from("pricing_presets")
    .select("*")
    .eq("id", sourcePresetId)
    .single();

  if (srcErr || !src) {
    return { error: "복제 원본 프리셋을 찾을 수 없습니다." };
  }

  // 2) 신규 프리셋 삽입
  const code = `custom_dup_${Date.now()}`;
  const { data: target, error: tgtErr } = await supabase
    .from("pricing_presets")
    .insert({
      name: targetName,
      code,
      description: `${src.name} 복사본 - ${src.description || ""}`,
      recommended_use_case: src.recommended_use_case,
      applicable_channel: src.applicable_channel,
      is_system: false,
    })
    .select("id")
    .single();

  if (tgtErr || !target) {
    return { error: `프리셋 복제 실패: ${tgtErr?.message}` };
  }

  // 3) 기존 프리셋 요율 데이터 전체 복제
  const { data: vals } = await supabase
    .from("pricing_scenario_values")
    .select("scenario_id, item_id, value")
    .eq("preset_id", sourcePresetId);

  if (vals && vals.length > 0) {
    const dups = vals.map((v) => ({
      preset_id: target.id,
      scenario_id: v.scenario_id,
      item_id: v.item_id,
      value: v.value,
    }));
    await supabase.from("pricing_scenario_values").insert(dups);
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "비즈니스 프리셋 복제가 완료되었습니다.", presetId: target.id };
}

/** 6. 커스텀 프리셋 삭제 (시스템 프리셋 차단) */
export async function deleteCustomPreset(presetId: string): Promise<ScenarioFormState> {
  const supabase = await createClient();

  // 시스템 여부 조회
  const { data: p } = await supabase
    .from("pricing_presets")
    .select("is_system")
    .eq("id", presetId)
    .single();

  if (p?.is_system) {
    return { error: "시스템 기본 비즈니스 프리셋은 삭제할 수 없습니다." };
  }

  const { error } = await supabase
    .from("pricing_presets")
    .delete()
    .eq("id", presetId);

  if (error) {
    return { error: `프리셋 삭제 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "커스텀 프리셋이 삭제되었습니다." };
}

/** 7. 프리셋 이름/설명 수정 */
export async function renamePreset(
  presetId: string,
  newName: string,
  description: string
): Promise<ScenarioFormState> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pricing_presets")
    .update({
      name: newName,
      description,
    })
    .eq("id", presetId);

  if (error) {
    return { error: `수정 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "프리셋 정보가 수정되었습니다." };
}

/** 신규 설정 그룹 추가 */
export async function addScenarioGroup(name: string, code: string, displayOrder: number): Promise<ScenarioFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_scenario_groups")
    .insert({
      name,
      code: code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      display_order: displayOrder,
    });

  if (error) {
    console.error("Error adding group:", error);
    return { error: `그룹 생성 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "새로운 설정 그룹이 성공적으로 추가되었습니다." };
}

/** 신규 설정 항목 추가 */
export async function addScenarioItem(data: {
  groupId: string;
  name: string;
  code: string;
  description?: string;
  applicableChannel: string;
  valueType: string;
  costBasis?: string;
  profitStage: string;
  decimalPrecision?: number;
  productOverrideAllowed?: boolean;
  isRequired?: boolean;
  displayOrder?: number;
  tooltip?: string;
  defaultValueConservative: number;
  defaultValueExpected: number;
  defaultValueOptimistic: number;
}): Promise<ScenarioFormState> {
  const supabase = await createClient();

  // 1. 설정 항목 삽입
  const { data: item, error: itemErr } = await supabase
    .from("pricing_scenario_items")
    .insert({
      group_id: data.groupId,
      name: data.name,
      code: data.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      description: data.description || null,
      applicable_channel: data.applicableChannel,
      value_type: data.valueType,
      cost_basis: data.costBasis || null,
      profit_stage: data.profitStage,
      decimal_precision: data.decimalPrecision ?? 2,
      product_override_allowed: data.productOverrideAllowed ?? true,
      is_required: data.isRequired ?? false,
      display_order: data.displayOrder ?? 0,
      tooltip: data.tooltip || null,
    })
    .select("id")
    .single();

  if (itemErr || !item) {
    console.error("Error creating item:", itemErr);
    return { error: `항목 생성 실패: ${itemErr?.message || "알 수 없는 오류"}` };
  }

  // 2. 각 시나리오별 기본값 삽입 (레거시용 NULL preset_id 세팅)
  const { data: scenarios, error: scenErr } = await supabase
    .from("pricing_scenarios")
    .select("id, code");

  if (scenErr || !scenarios) {
    return { error: "시나리오 정보를 불러올 수 없어 기본값을 설정하지 못했습니다." };
  }

  const valuesToInsert = scenarios.map((scen) => {
    let val = data.defaultValueExpected;
    if (scen.code === "conservative") val = data.defaultValueConservative;
    if (scen.code === "optimistic") val = data.defaultValueOptimistic;
    
    return {
      preset_id: null,
      scenario_id: scen.id,
      item_id: item.id,
      value: val,
    };
  });

  const { error: valErr } = await supabase
    .from("pricing_scenario_values")
    .insert(valuesToInsert);

  if (valErr) {
    console.error("Error creating default values for item:", valErr);
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "설정 항목과 시나리오별 기본값이 생성되었습니다." };
}

/** 설정 항목 비활성화 */
export async function deactivateScenarioItem(itemId: string, active: boolean): Promise<ScenarioFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_scenario_items")
    .update({ is_active: active })
    .eq("id", itemId);

  if (error) {
    return { error: `상태 변경 실패: ${error.message}` };
  }
  revalidatePath("/admin/products/pricing-profitability");
  return { success: "상태가 변경되었습니다." };
}

/** 설정 항목 보관 처리 */
export async function archiveScenarioItem(itemId: string): Promise<ScenarioFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_scenario_items")
    .update({ is_archived: true })
    .eq("id", itemId);

  if (error) {
    return { error: `보관 실패: ${error.message}` };
  }
  revalidatePath("/admin/products/pricing-profitability");
  return { success: "항목이 보관함으로 이동하였습니다." };
}

/** 8. 계산 결과 스냅샷 저장 (Preset & 환율 메타 추가) */
export async function saveCalculation(data: {
  name: string;
  mode: "analyze_profitability" | "calculate_pricing";
  channel: "b2b" | "amazon" | "both";
  scenarioId: string; // 호환용 (Expected의 id 혹은 첫번째 시나리오 id)
  presetId?: string | null;
  productId?: string | null;
  targetMetric?: string;
  targetValue?: number;
  supplierUnitPrice: number;
  originalSupplierPrice?: number;
  originalCurrency?: "KRW" | "USD";
  proposedMsrp?: number;
  wholesalePrice?: number;
  amazonListPrice?: number;
  retailerTargetMargin?: number;
  exchangeRate: number;
  exchangeRateDate?: string;
  exchangeRateSource?: string;
  fbaFeeSource: string;
  packageInfo?: any;
  detailedImportInfo?: any;
  inputOverrides?: any;
  appliedScenarioSnapshot: any; // Conservative, Expected, Optimistic 3종 스냅샷 통째 보관
  calculatedResults: any;       // 3개 결과 묶음 JSON
  status: string;
  notes?: string;
}): Promise<{ error: string } | { success: string; id: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  let companyId: string | null = null;
  if (data.productId) {
    const { data: prod } = await supabase
      .from("products")
      .select("company_id")
      .eq("id", data.productId)
      .maybeSingle();
    companyId = prod?.company_id || null;
  }

  const { data: inserted, error } = await supabase
    .from("pricing_calculations")
    .insert({
      name: data.name,
      mode: data.mode,
      channel: data.channel,
      scenario_id: data.scenarioId,
      preset_id: data.presetId || null,
      product_id: data.productId || null,
      company_id: companyId,
      target_metric: data.targetMetric || null,
      target_value: data.targetValue || null,
      supplier_unit_price: data.supplierUnitPrice, // 달러 환산된 수치
      original_supplier_price: data.originalSupplierPrice ?? data.supplierUnitPrice,
      original_currency: data.originalCurrency ?? "USD",
      proposed_msrp: data.proposedMsrp || null,
      wholesale_price: data.wholesalePrice || null,
      amazon_list_price: data.amazonListPrice || null,
      retailer_target_margin: data.retailerTargetMargin || null,
      exchange_rate: data.exchangeRate,
      exchange_rate_date: data.exchangeRateDate || null,
      exchange_rate_source: data.exchangeRateSource || null,
      fba_fee_source: data.fbaFeeSource,
      package_info: data.packageInfo || {},
      detailed_import_info: data.detailedImportInfo || {},
      input_overrides: data.inputOverrides || {},
      applied_scenario_snapshot: data.appliedScenarioSnapshot,
      calculated_results: data.calculatedResults,
      status: data.status,
      notes: data.notes || null,
      created_by: user?.id || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("Error saving calculation snapshot:", error);
    return { error: `계산 기록 저장 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "계산 기록이 안전하게 저장되었습니다.", id: inserted.id };
}

/** 저장된 계산 내역 리스트 조회 (기존 호환 쿼리 유지) */
export async function getSavedCalculations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_calculations")
    .select("id, name, mode, channel, created_at, status, supplier_unit_price, original_supplier_price, original_currency, calculated_results, products(name), preset_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching saved calculations:", error);
    return [];
  }
  return data;
}

/** 저장된 계산 기록의 전체 단일 상세 내용 로드 */
export async function getSavedCalculationDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_calculations")
    .select("*, products(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching calculation details:", error);
    return null;
  }
  return data;
}

/** 계산 기록 복제 */
export async function duplicateCalculation(id: string): Promise<ScenarioFormState> {
  const supabase = await createClient();
  const detail = await getSavedCalculationDetail(id);
  if (!detail) return { error: "복제할 계산 기록을 찾을 수 없습니다." };

  const { error } = await supabase
    .from("pricing_calculations")
    .insert({
      ...detail,
      id: undefined, // 새 uuid 생성 유도
      name: `${detail.name} (복사본)`,
      created_at: undefined,
    });

  if (error) {
    return { error: `복제 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "계산 기록이 정상적으로 복제되었습니다." };
}

/** 계산 기록 보관/삭제 */
export async function archiveCalculation(id: string): Promise<ScenarioFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_calculations")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: `삭제 실패: ${error.message}` };
  }

  revalidatePath("/admin/products/pricing-profitability");
  return { success: "계산 기록이 성공적으로 삭제되었습니다." };
}

/** 기존 등록 제품 목록 (계산기 선택용) */
export async function getProductsList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price_usd_fob, package_width, package_depth, package_height, package_weight, carton_pack_qty")
    .eq("status", "registered");

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }
  return data;
}

/** 실시간 고시 환율 획득 Wrapper (서버 액션) */
export async function fetchLiveExchangeRate() {
  const { getExchangeRate } = await import("@/lib/pricing/exchange");
  return getExchangeRate();
}
