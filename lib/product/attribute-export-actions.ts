"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";

/**
 * DB의 최신 카테고리 및 속성 마스터 데이터를 가이드 시트가 동봉된 Excel 파일(base64)로 내보내기
 */
export async function exportMasterExcelWithGuide(): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    await verifyAdminSession();
    const admin = createAdminClient();

    // 1. DB의 6개 관련 테이블 전체 데이터 로드
    const { data: categories, error: catErr } = await admin
      .from("categories")
      .select("code, name_ko, name_en, depth, parent_code, is_final, is_active")
      .order("depth", { ascending: true })
      .order("code", { ascending: true });

    if (catErr) {
      return { success: false, error: `카테고리 정보 조회 실패: ${catErr.message}` };
    }

    const { data: attributes, error: attrErr } = await admin
      .from("attributes")
      .select("code, name_ko, name_en, scope, attr_group, input_type, is_multiple, unit_set, is_required, allow_na, allow_unknown, allow_other, brand_editable, admin_only, is_searchable, display_order, is_active, help_text")
      .order("display_order", { ascending: true });

    if (attrErr) {
      return { success: false, error: `속성 명세 조회 실패: ${attrErr.message}` };
    }

    const { data: attributeOptions, error: optErr } = await admin
      .from("attribute_options")
      .select("attribute_code, option_code, option_ko, option_en, display_order, is_active")
      .order("attribute_code", { ascending: true })
      .order("display_order", { ascending: true });

    if (optErr) {
      return { success: false, error: `선택지 옵션 조회 실패: ${optErr.message}` };
    }

    const { data: attributeProfiles, error: profErr } = await admin
      .from("attribute_profiles")
      .select("code, name_ko, name_en, is_active")
      .order("code", { ascending: true });

    if (profErr) {
      return { success: false, error: `속성 프로필 조회 실패: ${profErr.message}` };
    }

    const { data: profileAttributes, error: profAttrErr } = await admin
      .from("profile_attributes")
      .select("profile_code, attribute_code, is_required_override, display_order, is_active")
      .order("profile_code", { ascending: true })
      .order("display_order", { ascending: true });

    if (profAttrErr) {
      return { success: false, error: `프로필 속성 매핑 조회 실패: ${profAttrErr.message}` };
    }

    const { data: categoryProfileMappings, error: mapErr } = await admin
      .from("category_profile_mappings")
      .select("category_code, profile_code, is_active")
      .order("category_code", { ascending: true });

    if (mapErr) {
      return { success: false, error: `카테고리 프로필 매핑 조회 실패: ${mapErr.message}` };
    }

    // 2. 새 워크북 생성
    const wb = XLSX.utils.book_new();

    // 3. [마스터 엑셀 가이드] 시트 데이터 생성 (AOA 포맷)
    const guideAOA = [
      ["K-Select 카테고리 & 속성 마스터 엑셀 관리 가이드서"],
      [],
      ["[1. 개요]"],
      ["- 본 엑셀 파일은 K-Select 플랫폼의 카테고리 체계와 동적 속성 명세(Attributes)를 일괄 관리하기 위한 마스터 템플릿입니다."],
      ["- 엑셀 업로드 시 기존 데이터와 병합(Upsert)되거나 활성 여부(Is Active)가 업데이트됩니다."],
      ["- 웹 UI에서 개별 추가/수정/삭제한 사항도 다운로드 시 본 엑셀 파일에 실시간 반영되어 다운로드됩니다."],
      [],
      ["[2. 추가 / 수정 / 삭제 방법 가이드]"],
      ["구분", "대상 컬럼", "동작 규칙 및 설명", "예시/가이드"],
      ["Categories", "Category Code", "새로운 분류를 추가하려면 겹치지 않는 대문자 코드를 새로 지어 기입합니다.", "SK_SUNSTICK (신규)"],
      ["Categories", "Korean Name / English Name", "기존 코드는 유지한 채 이름을 수정하면 업로드 시 웹 화면에 바뀐 이름이 즉시 오버라이트됩니다.", "선스크린 -> 자외선차단제 (이름수정)"],
      ["Categories", "Is Active", "기존 행의 Is Active를 FALSE로 설정하여 업로드하면 해당 분류가 웹 화면에서 비활성(삭제) 처리됩니다.", "FALSE (비활성/삭제)"],
      ["Attributes", "Attribute Code", "신규로 제품 스펙을 기입받고 싶다면 유니크한 속성 코드를 적어 추가합니다. (예: SPF_VALUE)", "SPF_VALUE"],
      ["Attributes", "Input Type", "입력 데이터 타입을 지정합니다. (SINGLE_SELECT, MULTI_SELECT, YES_NO_NA, NUMBER_UNIT, NUMBER, TEXT, LONG_TEXT)", "NUMBER (단위없는 숫자)"],
      ["Attributes", "Scope", "모든 제품군 공통 입력 필드일 경우 COMMON, 특정 카테고리만 뜨게 하려면 PROFILE로 지정합니다.", "COMMON 또는 PROFILE"],
      ["Attribute_Options", "Option Code / Option Ko", "SINGLE_SELECT / MULTI_SELECT 속성들이 가질 선택 옵션 후보들을 등록합니다.", "SPF_50 / SPF 50+"],
      ["Profile_Attributes", "Profile Code / Attribute Code", "특정 프로필(예: 선케어)에 어떤 속성(예: 백탁정도)을 노출시킬지 1:N으로 맵핑합니다.", "SK_SUNCARE | WHITE_CAST_LEVEL"],
      ["Category_Profile_Mappings", "Category Code / Profile Code", "최종 소분류 카테고리 코드에 어떤 속성 프로필을 맵핑시킬지 지정합니다.", "SK_SUNSCREEN | SK_SUNCARE"],
      [],
      ["[3. 컬럼 가이드 리스트]"],
      ["시트명", "엑셀 헤더명", "데이터 타입 및 필수 여부", "설명"],
      ["Categories", "Category Code", "텍스트 (필수, PK)", "대문자 영문 카테고리 고유 코드"],
      ["Categories", "Korean Name", "텍스트 (필수)", "카테고리 국문 명칭"],
      ["Categories", "Depth", "정수 (1, 2, 3) (필수)", "대분류(1), 중분류(2), 소분류(3) 구분"],
      ["Categories", "Parent Code", "텍스트 (Depth 2, 3 필수)", "부모 카테고리 코드 (대분류는 비워둠)"],
      ["Categories", "Is Final Category", "논리형 (TRUE/FALSE)", "제품에 직접 지정되는 최하위 3Depth 분류일 경우 TRUE"],
      ["Categories", "Is Active", "논리형 (TRUE/FALSE)", "웹 노출 및 활성 여부"],
      ["Attributes", "Attribute Code", "텍스트 (필수, PK)", "속성 고유 영문 식별 코드"],
      ["Attributes", "Korean Name", "텍스트 (필수)", "어드민 화면에 렌더링될 국문 라벨"],
      ["Attributes", "Scope", "COMMON / PROFILE (필수)", "COMMON(전체공통), PROFILE(특정 제품군 매핑)"],
      ["Attributes", "Input Type", "텍스트 (필수)", "SINGLE_SELECT, MULTI_SELECT, YES_NO_NA, NUMBER_UNIT, NUMBER, TEXT, LONG_TEXT"],
      ["Attributes", "Is Active", "논리형 (TRUE/FALSE)", "속성 필드의 활성/비활성 여부"],
      ["Attribute_Options", "Attribute Code", "텍스트 (필수)", "옵션이 속한 부모 속성 코드"],
      ["Attribute_Options", "Option Code", "텍스트 (필수)", "선택지 고유 영문/숫자 코드"],
      ["Attribute_Options", "Option Korean", "텍스트 (필수)", "화면에 표출될 한글 옵션 텍스트"],
      ["Attribute_Options", "Is Active", "논리형 (TRUE/FALSE)", "옵션 활성 여부"]
    ];

    const guideSheet = XLSX.utils.aoa_to_sheet(guideAOA);
    XLSX.utils.book_append_sheet(wb, guideSheet, "마스터 엑셀 가이드");

    // 4. Categories 시트
    const catSheet = XLSX.utils.json_to_sheet(
      (categories || []).map(c => ({
        "Category Code": c.code,
        "Korean Name": c.name_ko,
        "English Name": c.name_en,
        "Depth": c.depth,
        "Parent Code": c.parent_code,
        "Is Final Category": c.is_final,
        "Is Active": c.is_active
      }))
    );
    XLSX.utils.book_append_sheet(wb, catSheet, "Categories");

    // 5. Attributes 시트
    const attrSheet = XLSX.utils.json_to_sheet(
      (attributes || []).map(a => ({
        "Attribute Code": a.code,
        "Korean Name": a.name_ko,
        "English Name": a.name_en,
        "Scope": a.scope,
        "Attribute Group": a.attr_group,
        "Input Type": a.input_type,
        "Is Multiple": a.is_multiple,
        "Unit Set": a.unit_set,
        "Is Required": a.is_required,
        "Allow NA": a.allow_na,
        "Allow Unknown": a.allow_unknown,
        "Allow Other": a.allow_other,
        "Brand Editable": a.brand_editable,
        "Admin Only": a.admin_only,
        "Is Searchable": a.is_searchable,
        "Display Order": a.display_order,
        "Is Active": a.is_active,
        "Help Text": a.help_text
      }))
    );
    XLSX.utils.book_append_sheet(wb, attrSheet, "Attributes");

    // 6. Attribute_Options 시트
    const optSheet = XLSX.utils.json_to_sheet(
      (attributeOptions || []).map(o => ({
        "Attribute Code": o.attribute_code,
        "Option Code": o.option_code,
        "Option Korean": o.option_ko,
        "Option English": o.option_en,
        "Display Order": o.display_order,
        "Is Active": o.is_active
      }))
    );
    XLSX.utils.book_append_sheet(wb, optSheet, "Attribute_Options");

    // 7. Attribute_Profiles 시트
    const profSheet = XLSX.utils.json_to_sheet(
      (attributeProfiles || []).map(p => ({
        "Profile Code": p.code,
        "Profile Name Korean": p.name_ko,
        "Profile Name English": p.name_en,
        "Is Active": p.is_active
      }))
    );
    XLSX.utils.book_append_sheet(wb, profSheet, "Attribute_Profiles");

    // 8. Profile_Attributes 시트
    const profAttrSheet = XLSX.utils.json_to_sheet(
      (profileAttributes || []).map(pa => ({
        "Profile Code": pa.profile_code,
        "Attribute Code": pa.attribute_code,
        "Is Required Override": pa.is_required_override,
        "Display Order": pa.display_order,
        "Is Active": pa.is_active
      }))
    );
    XLSX.utils.book_append_sheet(wb, profAttrSheet, "Profile_Attributes");

    // 9. Category_Profile_Mappings 시트
    const mappingSheet = XLSX.utils.json_to_sheet(
      (categoryProfileMappings || []).map(m => ({
        "Category Code": m.category_code,
        "Profile Code": m.profile_code,
        "Is Active": m.is_active
      }))
    );
    XLSX.utils.book_append_sheet(wb, mappingSheet, "Category_Profile_Mappings");

    // 10. 워크북을 base64 문자열로 직접 덤프 (Edge / Serverless 등 호환성 극대화)
    const base64String = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    return { success: true, data: base64String };
  } catch (err: any) {
    return { success: false, error: err.message || "엑셀 다운로드 중 예상치 못한 내부 예외가 발생했습니다." };
  }
}
