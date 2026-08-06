"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CategoryNode {
  code: string;
  nameKo: string;
  nameEn: string | null;
  depth: number;
  parentCode: string | null;
  isFinal: boolean;
  children: CategoryNode[];
}

/**
 * 1. 카테고리 트리 전체 로드
 */
export async function getCategoriesTree(): Promise<CategoryNode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("code, name_ko, name_en, depth, parent_code, is_final, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !data) return [];

  // 트리 구조 조립
  const nodesMap = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // Node 생성
  data.forEach((item) => {
    nodesMap.set(item.code, {
      code: item.code,
      nameKo: item.name_ko,
      nameEn: item.name_en,
      depth: item.depth,
      parentCode: item.parent_code,
      isFinal: item.is_final,
      children: [],
    });
  });

  // 관계 설정
  data.forEach((item) => {
    const current = nodesMap.get(item.code);
    if (!current) return;

    if (item.parent_code && nodesMap.has(item.parent_code)) {
      const parent = nodesMap.get(item.parent_code);
      parent?.children.push(current);
    } else if (item.depth === 1) {
      roots.push(current);
    }
  });

  return roots;
}

export interface AttributeOptionItem {
  optionCode: string;
  optionKo: string;
  optionEn: string | null;
  displayOrder: number;
}

export interface AttributeMasterItem {
  code: string;
  nameKo: string;
  nameEn: string | null;
  scope: "COMMON" | "PROFILE";
  attrGroup: string | null;
  inputType: string;
  isMultiple: boolean;
  unitSet: string | null;
  isRequired: boolean;
  allowNa: boolean;
  allowUnknown: boolean;
  allowOther: boolean;
  brandEditable: boolean;
  adminOnly: boolean;
  isSearchable: boolean;
  displayOrder: number;
  helpText: string | null;
  options: AttributeOptionItem[];
}

/**
 * 2. 특정 카테고리에 매핑된 공통 속성 및 제품군 프로필 속성 정보 결합 조회
 */
export async function getCategoryAttributes(categoryCode: string | null): Promise<{
  profileCode: string | null;
  profileName: string | null;
  attributes: AttributeMasterItem[];
}> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 2.1 공통 속성(Scope = 'COMMON') 조회
  const { data: commonAttrsData } = await supabase
    .from("attributes")
    .select("code, name_ko, name_en, scope, attr_group, input_type, is_multiple, unit_set, is_required, allow_na, allow_unknown, allow_other, brand_editable, admin_only, is_searchable, display_order, help_text")
    .eq("scope", "COMMON")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const commonCodes = commonAttrsData?.map(a => a.code) || [];

  // 공통 속성 옵션 일괄 조회
  let commonOptions: any[] = [];
  if (commonCodes.length > 0) {
    const { data: optData } = await supabase
      .from("attribute_options")
      .select("attribute_code, option_code, option_ko, option_en, display_order")
      .in("attribute_code", commonCodes)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (optData) commonOptions = optData;
  }

  const commonAttributes: AttributeMasterItem[] = (commonAttrsData || []).map((attr) => ({
    code: attr.code,
    nameKo: attr.name_ko,
    nameEn: attr.name_en,
    scope: "COMMON",
    attrGroup: attr.attr_group,
    inputType: attr.input_type,
    isMultiple: attr.is_multiple,
    unitSet: attr.unit_set,
    isRequired: attr.is_required,
    allowNa: attr.allow_na,
    allowUnknown: attr.allow_unknown,
    allowOther: attr.allow_other,
    brandEditable: attr.brand_editable,
    adminOnly: attr.admin_only,
    isSearchable: attr.is_searchable,
    displayOrder: attr.display_order,
    helpText: attr.help_text,
    options: commonOptions
      .filter((o) => o.attribute_code === attr.code)
      .map((o) => ({
        optionCode: o.option_code,
        optionKo: o.option_ko,
        optionEn: o.option_en,
        displayOrder: o.display_order,
      })),
  }));

  // 만약 카테고리가 미지정이면 공통 속성만 반환
  if (!categoryCode) {
    return {
      profileCode: null,
      profileName: null,
      attributes: commonAttributes,
    };
  }

  // 2.2 카테고리에 매핑된 프로필 취득
  const { data: mapData } = await supabase
    .from("category_profile_mappings")
    .select("profile_code")
    .eq("category_code", categoryCode)
    .eq("is_active", true)
    .single();

  if (!mapData) {
    return {
      profileCode: null,
      profileName: null,
      attributes: commonAttributes,
    };
  }

  const profileCode = mapData.profile_code;

  // 프로필 메타정보 조회 (RLS 우회)
  const { data: profileMeta } = await admin
    .from("attribute_profiles")
    .select("name_ko")
    .eq("code", profileCode)
    .single();

  // 프로필 소속 속성 매핑 조회
  const { data: profileAttrs } = await supabase
    .from("profile_attributes")
    .select("attribute_code, is_required_override, display_order")
    .eq("profile_code", profileCode)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const profileAttrCodes = profileAttrs?.map(pa => pa.attribute_code) || [];

  if (profileAttrCodes.length === 0) {
    return {
      profileCode,
      profileName: profileMeta?.name_ko || profileCode,
      attributes: commonAttributes,
    };
  }

  // 프로필 속성 마스터 정보 조회
  const { data: attrMasterData } = await supabase
    .from("attributes")
    .select("code, name_ko, name_en, scope, attr_group, input_type, is_multiple, unit_set, is_required, allow_na, allow_unknown, allow_other, brand_editable, admin_only, is_searchable, display_order, help_text")
    .in("code", profileAttrCodes)
    .eq("is_active", true);

  // 프로필 속성 옵션 일괄 조회
  const { data: profileOptions } = await supabase
    .from("attribute_options")
    .select("attribute_code, option_code, option_ko, option_en, display_order")
    .in("attribute_code", profileAttrCodes)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const profileAttributes: AttributeMasterItem[] = (profileAttrs || [])
    .map((pa) => {
      const attr = attrMasterData?.find((a) => a.code === pa.attribute_code);
      if (!attr) return null;

      const opts = (profileOptions || []).filter((o) => o.attribute_code === attr.code);

      return {
        code: attr.code,
        nameKo: attr.name_ko,
        nameEn: attr.name_en,
        scope: "PROFILE" as const,
        attrGroup: attr.attr_group,
        inputType: attr.input_type,
        isMultiple: attr.is_multiple,
        unitSet: attr.unit_set,
        isRequired: pa.is_required_override || attr.is_required, // 프로필 단위 오버라이드 우선 적용
        allowNa: attr.allow_na,
        allowUnknown: attr.allow_unknown,
        allowOther: attr.allow_other,
        brandEditable: attr.brand_editable,
        adminOnly: attr.admin_only,
        isSearchable: attr.is_searchable,
        displayOrder: pa.display_order,
        helpText: attr.help_text,
        options: opts.map((o) => ({
          optionCode: o.option_code,
          optionKo: o.option_ko,
          optionEn: o.option_en,
          displayOrder: o.display_order,
        })),
      };
    })
    .filter(Boolean) as AttributeMasterItem[];

  return {
    profileCode,
    profileName: profileMeta?.name_ko || profileCode,
    attributes: [...commonAttributes, ...profileAttributes],
  };
}

/**
 * 3. 특정 제품의 동적 입력 속성 데이터셋 로드
 */
export async function getProductAttributeValues(productId: string): Promise<Record<string, { value: any; text: string | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_attribute_values")
    .select("attribute_code, value_json, text_value")
    .eq("product_id", productId);

  if (error || !data) return {};

  const map: Record<string, { value: any; text: string | null }> = {};
  data.forEach((row) => {
    map[row.attribute_code] = {
      value: row.value_json,
      text: row.text_value,
    };
  });

  return map;
}

/**
 * 4. 제품의 카테고리 지정 및 동적 속성값 일괄 저장/갱신
 */
export async function saveProductAttributeValues(
  productId: string,
  categoryCode: string | null,
  values: Record<string, any>,
  textValues: Record<string, string>
) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 4.1 products 테이블의 category_code 필드 우선 업데이트 (RLS 우회)
  const { error: productError } = await admin
    .from("products")
    .update({ category_code: categoryCode })
    .eq("id", productId);

  if (productError) {
    throw new Error(`제품 카테고리 갱신 실패: ${productError.message}`);
  }

  // 4.2 product_attribute_values 동적 속성들 일괄 UPSERT
  const attrEntries = Object.entries(values);
  if (attrEntries.length === 0) {
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/portal/products/${productId}`);
    return { success: true };
  }

  // UPSERT 페이로드 구성
  const upsertRows = attrEntries.map(([code, val]) => {
    return {
      product_id: productId,
      attribute_code: code,
      value_json: val,
      text_value: textValues[code] || null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertError } = await admin
    .from("product_attribute_values")
    .upsert(upsertRows, { onConflict: "product_id,attribute_code" });

  if (upsertError) {
    throw new Error(`동적 속성 저장 실패: ${upsertError.message}`);
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products`);
  revalidatePath(`/portal/products/${productId}`);
  revalidatePath(`/portal/products`);
  
  return { success: true };
}

/**
 * 5. 엑셀 업로드를 통한 마스터 데이터(카테고리, 속성, 프로필, 옵션, 매핑) 일괄 임포트
 */
export async function adminImportMasterExcel(base64Data: string) {
  const { verifyAdminSession } = await import("@/lib/auth/dal");
  await verifyAdminSession();

  const XLSX = await import("xlsx");
  const admin = createAdminClient();

  const buffer = Buffer.from(base64Data, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const parseSheetData = (sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
    if (rawRows.length < 3) return [];
    const headers = rawRows[1].map(h => h ? String(h).trim() : null);
    const dataRows = rawRows.slice(2);
    
    const parsed: any[] = [];
    dataRows.forEach(row => {
      if (row.length === 0 || row.every(c => c === null)) return;
      const obj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        obj[header] = row[idx];
      });
      const firstKey = Object.keys(obj)[0];
      if (!obj[firstKey]) return;
      parsed.push(obj);
    });
    return parsed;
  };

  // 1. Categories
  const categoriesRaw = parseSheetData("Categories");
  if (categoriesRaw.length > 0) {
    const rows = categoriesRaw.map(c => ({
      code: c["Category Code"],
      name_ko: c["Korean Name"],
      name_en: c["English Name"] || null,
      depth: parseInt(c["Depth"]) || 1,
      parent_code: c["Parent Code"] || null,
      is_final: String(c["Is Final Category"]).toUpperCase() === "TRUE" || c["Is Final Category"] === true,
      display_order: parseInt(c["Display Order"]) || 0,
      is_active: String(c["Active Status"]).toUpperCase() === "ACTIVE" || String(c["Active Status"]).toUpperCase() === "TRUE"
    }));
    const { error } = await admin.from("categories").upsert(rows, { onConflict: "code" });
    if (error) throw new Error(`카테고리 임포트 실패: ${error.message}`);
  }

  // 2. Profiles
  const profilesRaw = parseSheetData("Attribute Profiles");
  if (profilesRaw.length > 0) {
    const rows = profilesRaw.map(p => ({
      code: p["Profile Code"],
      name_ko: p["Korean Name"],
      name_en: p["English Name"] || null,
      description: p["Description"] || null,
      is_active: String(p["Active Status"]).toUpperCase() === "ACTIVE" || String(p["Active Status"]).toUpperCase() === "TRUE"
    }));
    const { error } = await admin.from("attribute_profiles").upsert(rows, { onConflict: "code" });
    if (error) throw new Error(`프로필 임포트 실패: ${error.message}`);
  }

  // 3. Attributes
  const attributesRaw = parseSheetData("Attributes");
  if (attributesRaw.length > 0) {
    const rows = attributesRaw.map(a => ({
      code: a["Attribute Code"],
      name_ko: a["Korean Name"],
      name_en: a["English Name"] || null,
      scope: a["Attribute Scope"] || "COMMON",
      attr_group: a["Attribute Group"] || null,
      input_type: a["Input Type"] || "SINGLE_SELECT",
      is_multiple: String(a["Multiple Select"]).toUpperCase() === "TRUE" || a["Multiple Select"] === true,
      unit_set: a["Unit Set"] || null,
      is_required: String(a["Required Default"]).toUpperCase() === "REQUIRED" || String(a["Required Default"]).toUpperCase() === "TRUE" || a["Required Default"] === true,
      allow_na: String(a["Allow N/A"]).toUpperCase() === "TRUE" || a["Allow N/A"] === true,
      allow_unknown: String(a["Allow Unknown"]).toUpperCase() === "TRUE" || a["Allow Unknown"] === true,
      allow_other: String(a["Allow Other"]).toUpperCase() === "TRUE" || a["Allow Other"] === true,
      brand_editable: String(a["Brand Editable"]).toUpperCase() === "TRUE" || a["Brand Editable"] === true,
      admin_only: String(a["Admin Only"]).toUpperCase() === "TRUE" || a["Admin Only"] === true,
      is_searchable: String(a["Search Filter"]).toUpperCase() === "TRUE" || a["Search Filter"] === true,
      display_order: parseInt(a["Display Order"]) || 0,
      is_active: String(a["Active Status"]).toUpperCase() === "ACTIVE" || String(a["Active Status"]).toUpperCase() === "TRUE",
      help_text: a["Help Text"] || null
    }));
    const { error } = await admin.from("attributes").upsert(rows, { onConflict: "code" });
    if (error) throw new Error(`속성 임포트 실패: ${error.message}`);
  }

  // 4. Options
  const optionsRaw = parseSheetData("Attribute Options");
  if (optionsRaw.length > 0) {
    const rows = optionsRaw.map(o => ({
      attribute_code: o["Attribute Code"],
      option_code: o["Option Code"],
      option_ko: o["Korean Option"],
      option_en: o["English Option"] || null,
      display_order: parseInt(o["Display Order"]) || 0,
      is_active: String(o["Active Status"]).toUpperCase() === "ACTIVE" || String(o["Active Status"]).toUpperCase() === "TRUE"
    }));
    const { error } = await admin.from("attribute_options").upsert(rows, { onConflict: "attribute_code,option_code" });
    if (error) throw new Error(`속성 옵션 임포트 실패: ${error.message}`);
  }

  // 5. Profile Attributes mapping
  const profileAttrsRaw = parseSheetData("Profile Attributes");
  if (profileAttrsRaw.length > 0) {
    const rows = profileAttrsRaw.map(pa => ({
      profile_code: pa["Profile Code"],
      attribute_code: pa["Attribute Code"],
      is_required_override: String(pa["Required Override"]).toUpperCase() === "REQUIRED" || pa["Required Override"] === true,
      display_order: parseInt(pa["Display Order"]) || 0,
      is_active: String(pa["Active Status"]).toUpperCase() === "ACTIVE" || String(pa["Active Status"]).toUpperCase() === "TRUE"
    }));
    const { error } = await admin.from("profile_attributes").upsert(rows, { onConflict: "profile_code,attribute_code" });
    if (error) throw new Error(`프로필 속성 매핑 임포트 실패: ${error.message}`);
  }

  // 6. Category-Profile Map mapping
  const catProfileMapRaw = parseSheetData("Category-Profile Map");
  if (catProfileMapRaw.length > 0) {
    const rows = catProfileMapRaw.map(c => ({
      category_code: c["Final Category Code"],
      profile_code: c["Profile Code"],
      auto_apply: String(c["Auto Apply"]).toUpperCase() === "AUTO" || c["Auto Apply"] === true,
      is_active: String(c["Active Status"]).toUpperCase() === "ACTIVE" || String(c["Active Status"]).toUpperCase() === "TRUE"
    }));
    const { error } = await admin.from("category_profile_mappings").upsert(rows, { onConflict: "category_code,profile_code" });
    if (error) throw new Error(`카테고리-프로필 매핑 임포트 실패: ${error.message}`);
  }

  revalidatePath("/admin/settings/categories");
  revalidatePath("/admin/settings/attributes");
  revalidatePath("/admin/settings/attribute-profiles");
  return { success: true };
}

/**
 * 6. 마스터 데이터 개별 활성/비활성 토글 액션
 */
export async function toggleCategoryActive(code: string, isActive: boolean) {
  const { verifyAdminSession } = await import("@/lib/auth/dal");
  await verifyAdminSession();
  const admin = createAdminClient();
  await admin.from("categories").update({ is_active: isActive }).eq("code", code);
  revalidatePath("/admin/settings/categories");
}

export async function toggleProfileActive(code: string, isActive: boolean) {
  const { verifyAdminSession } = await import("@/lib/auth/dal");
  await verifyAdminSession();
  const admin = createAdminClient();
  await admin.from("attribute_profiles").update({ is_active: isActive }).eq("code", code);
  revalidatePath("/admin/settings/attribute-profiles");
}

export async function toggleAttributeActive(code: string, isActive: boolean) {
  const { verifyAdminSession } = await import("@/lib/auth/dal");
  await verifyAdminSession();
  const admin = createAdminClient();
  await admin.from("attributes").update({ is_active: isActive }).eq("code", code);
  revalidatePath("/admin/settings/attributes");
}

export interface ProfileSummaryItem {
  code: string;
  nameKo: string;
  nameEn: string | null;
  description: string | null;
  isActive: boolean;
  attributesCount: number;
  categoriesCount: number;
}

/**
 * 7. 제품군 프로필 요약 통계 목록 조회
 */
export async function getAttributeProfilesWithSummary(): Promise<ProfileSummaryItem[]> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 프로필 원본 조회 (RLS 우회)
  const { data: profiles } = await admin
    .from("attribute_profiles")
    .select("code, name_ko, name_en, description, is_active")
    .order("code", { ascending: true });

  if (!profiles) return [];

  // 매핑 데이터 통계 (속성 매핑)
  const { data: profileAttrs } = await supabase
    .from("profile_attributes")
    .select("profile_code, attribute_code")
    .eq("is_active", true);

  // 매핑 데이터 통계 (카테고리 매핑)
  const { data: catProfiles } = await supabase
    .from("category_profile_mappings")
    .select("profile_code, category_code")
    .eq("is_active", true);

  return profiles.map((p) => {
    const attrCount = profileAttrs?.filter((pa) => pa.profile_code === p.code).length || 0;
    const catCount = catProfiles?.filter((cp) => cp.profile_code === p.code).length || 0;

    return {
      code: p.code,
      nameKo: p.name_ko,
      nameEn: p.name_en,
      description: p.description,
      isActive: p.is_active,
      attributesCount: attrCount,
      categoriesCount: catCount,
    };
  });
}

/**
 * 8. 모든 속성 마스터 정보 및 옵션 세트 목록 조회
 */
export async function getAllAttributesWithDetails(): Promise<AttributeMasterItem[]> {
  const supabase = await createClient();

  const { data: attrs } = await supabase
    .from("attributes")
    .select("code, name_ko, name_en, scope, attr_group, input_type, is_multiple, unit_set, is_required, allow_na, allow_unknown, allow_other, brand_editable, admin_only, is_searchable, display_order, help_text")
    .order("display_order", { ascending: true });

  if (!attrs) return [];

  const attrCodes = attrs.map(a => a.code);

  let options: any[] = [];
  if (attrCodes.length > 0) {
    const { data: optData } = await supabase
      .from("attribute_options")
      .select("attribute_code, option_code, option_ko, option_en, display_order")
      .in("attribute_code", attrCodes)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (optData) options = optData;
  }

  return attrs.map((attr) => ({
    code: attr.code,
    nameKo: attr.name_ko,
    nameEn: attr.name_en,
    scope: attr.scope as "COMMON" | "PROFILE",
    attrGroup: attr.attr_group,
    inputType: attr.input_type,
    isMultiple: attr.is_multiple,
    unitSet: attr.unit_set,
    isRequired: attr.is_required,
    allowNa: attr.allow_na,
    allowUnknown: attr.allow_unknown,
    allowOther: attr.allow_other,
    brandEditable: attr.brand_editable,
    adminOnly: attr.admin_only,
    isSearchable: attr.is_searchable,
    displayOrder: attr.display_order,
    helpText: attr.help_text,
    options: options
      .filter((o) => o.attribute_code === attr.code)
      .map((o) => ({
        optionCode: o.option_code,
        optionKo: o.option_ko,
        optionEn: o.option_en,
        displayOrder: o.display_order,
      })),
  }));
}
