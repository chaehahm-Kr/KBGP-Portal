import { createClient } from "@/lib/supabase/server";

export interface CategoryCompletionResult {
  categoryComplete: boolean;
  requiredAttributesComplete: boolean;
  missingRequiredAttributes: { code: string; nameKo: string }[];
  missingCount: number;
  status: "COMPLETE" | "CATEGORY_INCOMPLETE" | "ATTRIBUTE_INCOMPLETE" | "BOTH_INCOMPLETE";
  warningLabel: string | null;
  warningType: "none" | "category" | "attribute" | "both";
  totalRequiredCount: number;
  filledRequiredCount: number;
  completionPercent: number;
}

/**
 * Checks if a dynamic attribute value is considered filled.
 */
export function isAttributeValueFilled(inputType: string, val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim() !== "";
  if (typeof val === "number") return !isNaN(val);
  if (typeof val === "boolean") return true;
  if (Array.isArray(val)) {
    if (val.length === 0) return false;
    return val.some((v) => v !== "" && v !== null && v !== undefined);
  }
  if (typeof val === "object") {
    const values = Object.values(val);
    if (values.length === 0) return false;
    return values.some((v) => v !== "" && v !== null && v !== undefined);
  }
  return false;
}

/**
 * Unified Source of Truth for Product Category & Required Attribute Completion.
 * Used identically across Product List, Product Detail, and Admin.
 */
export async function getProductCategoryCompletion(
  productId: string,
  categoryCode: string | null,
  customClient?: any
): Promise<CategoryCompletionResult> {
  const supabase = customClient || (await createClient());

  // 1. Verify Category Completeness
  let categoryComplete = false;
  if (categoryCode && categoryCode.trim() !== "") {
    const { data: cat } = await supabase
      .from("categories")
      .select("code, is_final, is_active")
      .eq("code", categoryCode.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (cat) {
      categoryComplete = Boolean(cat.is_final);
    }
  }

  // 2. Fetch Required Attributes for Category
  // 2.1 Common Required Attributes
  const { data: commonRequiredAttrs } = await supabase
    .from("attributes")
    .select("code, name_ko, input_type, is_required, brand_editable, admin_only, is_active")
    .eq("scope", "COMMON")
    .eq("is_required", true)
    .eq("is_active", true)
    .eq("brand_editable", true)
    .eq("admin_only", false);

  let profileRequiredAttrs: any[] = [];
  if (categoryCode) {
    const { data: mapping } = await supabase
      .from("category_profile_mappings")
      .select("profile_code")
      .eq("category_code", categoryCode)
      .eq("is_active", true)
      .maybeSingle();

    if (mapping?.profile_code) {
      const { data: pAttrs } = await supabase
        .from("profile_attributes")
        .select("attribute_code, attributes(code, name_ko, input_type, is_required, brand_editable, admin_only, is_active)")
        .eq("profile_code", mapping.profile_code)
        .eq("is_active", true);

      profileRequiredAttrs = (pAttrs || [])
        .map((pa: any) => pa.attributes)
        .filter((attr: any) => attr && attr.is_required && attr.is_active && attr.brand_editable && !attr.admin_only);
    }
  }

  const allRequired = [...(commonRequiredAttrs || []), ...profileRequiredAttrs];

  // 3. Fetch Product's Saved Attribute Values
  const { data: savedValues } = await supabase
    .from("product_attribute_values")
    .select("attribute_code, value_json")
    .eq("product_id", productId);

  const savedMap = new Map<string, any>();
  (savedValues || []).forEach((row: any) => {
    savedMap.set(row.attribute_code, row.value_json);
  });

  // 4. Determine Missing Required Attributes
  const missingRequiredAttributes: { code: string; nameKo: string }[] = [];
  allRequired.forEach((attr) => {
    const val = savedMap.get(attr.code);
    if (!isAttributeValueFilled(attr.input_type, val)) {
      missingRequiredAttributes.push({
        code: attr.code,
        nameKo: attr.name_ko,
      });
    }
  });

  const requiredAttributesComplete = missingRequiredAttributes.length === 0;
  const totalRequiredCount = allRequired.length;
  const filledRequiredCount = totalRequiredCount - missingRequiredAttributes.length;
  const completionPercent = totalRequiredCount === 0 ? 100 : Math.round((filledRequiredCount / totalRequiredCount) * 100);

  // 5. Determine Unified Status and Warning Label
  let status: CategoryCompletionResult["status"] = "COMPLETE";
  let warningLabel: string | null = null;
  let warningType: CategoryCompletionResult["warningType"] = "none";

  if (!categoryComplete && !requiredAttributesComplete) {
    status = "BOTH_INCOMPLETE";
    warningLabel = "카테고리/속성 입력 필요";
    warningType = "both";
  } else if (!categoryComplete) {
    status = "CATEGORY_INCOMPLETE";
    warningLabel = "카테고리 설정 필요";
    warningType = "category";
  } else if (!requiredAttributesComplete) {
    status = "ATTRIBUTE_INCOMPLETE";
    warningLabel = missingRequiredAttributes.length === 1
      ? "제품 속성 입력 필요"
      : `필수 속성 ${missingRequiredAttributes.length}개 미입력`;
    warningType = "attribute";
  } else {
    status = "COMPLETE";
    warningLabel = null;
    warningType = "none";
  }

  return {
    categoryComplete,
    requiredAttributesComplete,
    missingRequiredAttributes,
    missingCount: missingRequiredAttributes.length,
    status,
    warningLabel,
    warningType,
    totalRequiredCount,
    filledRequiredCount,
    completionPercent,
  };
}

/**
 * Batch version to evaluate multiple products efficiently for Product List.
 */
export async function getBatchProductCategoryCompletions(
  products: { id: string; category_code: string | null }[],
  customClient?: any
): Promise<Map<string, CategoryCompletionResult>> {
  const supabase = customClient || (await createClient());
  const results = new Map<string, CategoryCompletionResult>();
  if (products.length === 0) return results;

  const productIds = products.map((p) => p.id);
  const categoryCodes = Array.from(new Set(products.map((p) => p.category_code).filter(Boolean))) as string[];

  // 1. Fetch categories
  const { data: catData } = categoryCodes.length > 0
    ? await supabase
        .from("categories")
        .select("code, is_final, is_active")
        .in("code", categoryCodes)
        .eq("is_active", true)
    : { data: [] };

  const finalCats = new Set((catData || []).filter((c: any) => c.is_final).map((c: any) => c.code));

  // 2. Fetch Common required attributes
  const { data: commonAttrs } = await supabase
    .from("attributes")
    .select("code, name_ko, input_type, is_required, brand_editable, admin_only, is_active")
    .eq("scope", "COMMON")
    .eq("is_required", true)
    .eq("is_active", true)
    .eq("brand_editable", true)
    .eq("admin_only", false);

  // 3. Fetch Category -> Profile -> Attributes mapping
  const { data: mappings } = categoryCodes.length > 0
    ? await supabase
        .from("category_profile_mappings")
        .select("category_code, profile_code")
        .in("category_code", categoryCodes)
        .eq("is_active", true)
    : { data: [] };

  const profileCodes = Array.from(new Set((mappings || []).map((m: any) => m.profile_code)));
  const catToProfile = new Map<string, string>();
  (mappings || []).forEach((m: any) => catToProfile.set(m.category_code, m.profile_code));

  const { data: pAttrs } = profileCodes.length > 0
    ? await supabase
        .from("profile_attributes")
        .select("profile_code, attribute_code, attributes(code, name_ko, input_type, is_required, brand_editable, admin_only, is_active)")
        .in("profile_code", profileCodes)
        .eq("is_active", true)
    : { data: [] };

  const profileRequiredMap = new Map<string, any[]>();
  (pAttrs || []).forEach((pa: any) => {
    if (pa.attributes && pa.attributes.is_required && pa.attributes.is_active && pa.attributes.brand_editable && !pa.attributes.admin_only) {
      const list = profileRequiredMap.get(pa.profile_code) || [];
      list.push(pa.attributes);
      profileRequiredMap.set(pa.profile_code, list);
    }
  });

  // 4. Fetch all saved attribute values for these products
  const { data: allSavedValues } = await supabase
    .from("product_attribute_values")
    .select("product_id, attribute_code, value_json")
    .in("product_id", productIds);

  const productValuesMap = new Map<string, Map<string, any>>();
  (allSavedValues || []).forEach((row: any) => {
    let map = productValuesMap.get(row.product_id);
    if (!map) {
      map = new Map<string, any>();
      productValuesMap.set(row.product_id, map);
    }
    map.set(row.attribute_code, row.value_json);
  });

  // 5. Evaluate each product
  products.forEach((p) => {
    const categoryComplete = Boolean(p.category_code && finalCats.has(p.category_code));
    const profileCode = p.category_code ? catToProfile.get(p.category_code) : null;
    const profileRequired = profileCode ? profileRequiredMap.get(profileCode) || [] : [];
    const allRequired = [...(commonAttrs || []), ...profileRequired];

    const savedMap = productValuesMap.get(p.id) || new Map<string, any>();
    const missing: { code: string; nameKo: string }[] = [];

    allRequired.forEach((attr) => {
      const val = savedMap.get(attr.code);
      if (!isAttributeValueFilled(attr.input_type, val)) {
        missing.push({ code: attr.code, nameKo: attr.name_ko });
      }
    });

    const requiredAttributesComplete = missing.length === 0;
    const totalRequiredCount = allRequired.length;
    const filledRequiredCount = totalRequiredCount - missing.length;
    const completionPercent = totalRequiredCount === 0 ? 100 : Math.round((filledRequiredCount / totalRequiredCount) * 100);

    let status: CategoryCompletionResult["status"] = "COMPLETE";
    let warningLabel: string | null = null;
    let warningType: CategoryCompletionResult["warningType"] = "none";

    if (!categoryComplete && !requiredAttributesComplete) {
      status = "BOTH_INCOMPLETE";
      warningLabel = "카테고리/속성 입력 필요";
      warningType = "both";
    } else if (!categoryComplete) {
      status = "CATEGORY_INCOMPLETE";
      warningLabel = "카테고리 설정 필요";
      warningType = "category";
    } else if (!requiredAttributesComplete) {
      status = "ATTRIBUTE_INCOMPLETE";
      warningLabel = missing.length === 1
        ? "제품 속성 입력 필요"
        : `필수 속성 ${missing.length}개 미입력`;
      warningType = "attribute";
    } else {
      status = "COMPLETE";
      warningLabel = null;
      warningType = "none";
    }

    results.set(p.id, {
      categoryComplete,
      requiredAttributesComplete,
      missingRequiredAttributes: missing,
      missingCount: missing.length,
      status,
      warningLabel,
      warningType,
      totalRequiredCount,
      filledRequiredCount,
      completionPercent,
    });
  });

  return results;
}
