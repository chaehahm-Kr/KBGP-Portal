import type { ProductCategory } from "@/lib/product/types";

export const BULK_IMPORT_MAX_ROWS = 500;
export const BULK_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const BULK_MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per image (matches manual editor)
export const BULK_MEDIA_MAX_IMAGES_PER_PRODUCT = 10;
export const BULK_TEMPLATE_EXAMPLE_SKU = "EXAMPLE-SKU-001";

export const ALLOWED_COLOR_MAPS = [
  "White",
  "Black",
  "Grey",
  "Silver",
  "Gold",
  "Red",
  "Pink",
  "Coral",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Brown",
  "Beige",
  "Ivory",
  "Clear",
  "Multi-Color",
] as const;

export type AllowedColorMap = (typeof ALLOWED_COLOR_MAPS)[number];

export type BulkColumnSection =
  | "Required"
  | "Category"
  | "Basic Info"
  | "Pricing"
  | "Logistics"
  | "Media"
  | "Common Attributes";

export interface BulkColumnSpec {
  key: BulkRowRawFieldKey;
  header: string;
  headerEn: string;
  aliases: string[];
  required: boolean;
  section: BulkColumnSection;
  dbColumn: string;
  width: number;
  textFormat?: boolean;
  description: string;
  attributeCode?: string;
}

export type BulkMediaImageFieldKey =
  | "mainImageUrl"
  | "additionalImageUrl2"
  | "additionalImageUrl3"
  | "additionalImageUrl4"
  | "additionalImageUrl5"
  | "additionalImageUrl6"
  | "additionalImageUrl7"
  | "additionalImageUrl8"
  | "additionalImageUrl9"
  | "additionalImageUrl10";

export type BulkCommonAttributeFieldKey =
  | "attrShelfLifeMonths"
  | "attrMinRemainingShelfLife"
  | "attrPaoMonths"
  | "attrStorageCondition"
  | "attrPackageFormat"
  | "attrFormulation"
  | "attrSealed"
  | "attrRefillable"
  | "attrTargetAge"
  | "attrTargetGender"
  | "attrSkinType"
  | "attrUsageFrequency"
  | "attrDailyUseCount"
  | "attrUsageOccasion"
  | "attrApplicationArea"
  | "attrPrimaryConcern"
  | "attrScented"
  | "attrScentFamily"
  | "attrScentIntensity"
  | "attrFdaStatus"
  | "attrMocraStatus"
  | "attrOtcStatus"
  | "attrDrugFactsStatus";

export type BulkRowRawFieldKey =
  | "brand"
  | "manufactureSku"
  | "productNameEn"
  | "category1Depth"
  | "category2Depth"
  | "category3Depth"
  | "productNameKo"
  | "volumeValue"
  | "volumeUnit"
  | "countryOfOrigin"
  | "leadTimeValue"
  | "leadTimeUnit"
  | "color"
  | "colorMap"
  | "description"
  | "bulletPoint1"
  | "bulletPoint2"
  | "bulletPoint3"
  | "bulletPoint4"
  | "bulletPoint5"
  | "howToUse"
  | "ingredients"
  | "parentSku"
  | "childSku"
  | "upc"
  | "ean"
  | "sellingOnline"
  | "sellingOffline"
  | "salesLink1"
  | "salesLink2"
  | "retailPriceKrw"
  | "wholesalePriceKrw"
  | "estimatedRetailPriceUsd"
  | "exportFobPriceUsd"
  | "itemWidth"
  | "itemDepth"
  | "itemHeight"
  | "itemWeight"
  | "packageWidth"
  | "packageDepth"
  | "packageHeight"
  | "packageWeight"
  | "cartonPackQty"
  | "cartonWidth"
  | "cartonDepth"
  | "cartonHeight"
  | "cartonWeight"
  | "palletCartonQty"
  | "palletWidth"
  | "palletDepth"
  | "palletHeight"
  | "palletWeight"
  // Media URL Columns (+11, BA..BK)
  | BulkMediaImageFieldKey
  | "productVideoUrl"
  // Common Attribute Columns (+23, BL..CH)
  | BulkCommonAttributeFieldKey;

export const BULK_IMAGE_URL_FIELD_KEYS: BulkMediaImageFieldKey[] = [
  "mainImageUrl",
  "additionalImageUrl2",
  "additionalImageUrl3",
  "additionalImageUrl4",
  "additionalImageUrl5",
  "additionalImageUrl6",
  "additionalImageUrl7",
  "additionalImageUrl8",
  "additionalImageUrl9",
  "additionalImageUrl10",
];

export type CommonAttributeInputType =
  | "NUMBER_UNIT"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "YES_NO_NA";

export interface BulkCommonAttributeOptionSpec {
  optionCode: string;
  optionKo: string;
  optionEn: string;
  aliases?: string[];
  adminOnlyOption?: boolean;
}

export interface BulkCommonAttributeSpec {
  code: string;
  fieldKey: BulkCommonAttributeFieldKey;
  header: string;
  headerEn: string;
  headerAliases: string[];
  nameKo: string;
  nameEn: string;
  attrGroupKo: string;
  attrGroupEn: string;
  inputType: CommonAttributeInputType;
  unitSet: string | null;
  allowNa: boolean;
  allowOther: boolean;
  isRegulatoryBrandReported?: boolean;
  width: number;
  exampleValue: string | number;
  description: string;
  options: BulkCommonAttributeOptionSpec[];
}

export const COMMON_BULK_ATTRIBUTES: BulkCommonAttributeSpec[] = [
  // Group 1: 유통 및 보관 (Shelf Life & Storage)
  {
    code: "SHELF_LIFE_MONTHS",
    fieldKey: "attrShelfLifeMonths",
    header: "전체 유통기한 개월 (Total Shelf Life)",
    headerEn: "Total Shelf Life",
    headerAliases: [
      "전체 유통기한 개월 (total shelf life)",
      "전체 유통기한 (개월)",
      "전체 유통기한",
      "total shelf life",
      "total shelf life (months)",
      "shelf_life_months",
    ],
    nameKo: "전체 유통기한",
    nameEn: "Total Shelf Life",
    attrGroupKo: "유통 및 보관",
    attrGroupEn: "Shelf Life & Storage",
    inputType: "NUMBER_UNIT",
    unitSet: "MONTH",
    allowNa: false,
    allowOther: false,
    width: 26,
    exampleValue: 36,
    description: "제조일 기준 전체 유통기한 개월 수 (양수 숫자 입력, 예: 36 -> EAV SHELF_LIFE_MONTHS).",
    options: [],
  },
  {
    code: "MIN_REMAINING_SHELF_LIFE",
    fieldKey: "attrMinRemainingShelfLife",
    header: "최소 잔여 유통기한 개월 (Min Remaining Shelf Life)",
    headerEn: "Minimum Remaining Shelf Life",
    headerAliases: [
      "최소 잔여 유통기한 개월 (min remaining shelf life)",
      "최소 잔여 유통기한 (개월)",
      "최소 잔여 유통기한",
      "minimum remaining shelf life",
      "minimum remaining shelf life (months)",
      "min remaining shelf life",
      "min_remaining_shelf_life",
    ],
    nameKo: "최소 잔여 유통기한",
    nameEn: "Minimum Remaining Shelf Life",
    attrGroupKo: "유통 및 보관",
    attrGroupEn: "Shelf Life & Storage",
    inputType: "NUMBER_UNIT",
    unitSet: "MONTH",
    allowNa: false,
    allowOther: false,
    width: 30,
    exampleValue: 24,
    description: "납품 시 보장 가능한 최소 잔여 유통기한 개월 수 (양수 숫자 입력, 예: 24 -> EAV MIN_REMAINING_SHELF_LIFE).",
    options: [],
  },
  {
    code: "PAO_MONTHS",
    fieldKey: "attrPaoMonths",
    header: "개봉 후 사용기간 개월 (Period After Opening)",
    headerEn: "Period After Opening",
    headerAliases: [
      "개봉 후 사용기간 개월 (period after opening)",
      "개봉 후 사용기간 (개월)",
      "개봉 후 사용기간",
      "period after opening",
      "period after opening (months)",
      "pao",
      "pao_months",
    ],
    nameKo: "개봉 후 사용기간",
    nameEn: "Period After Opening",
    attrGroupKo: "유통 및 보관",
    attrGroupEn: "Shelf Life & Storage",
    inputType: "NUMBER_UNIT",
    unitSet: "MONTH",
    allowNa: true,
    allowOther: false,
    width: 28,
    exampleValue: 12,
    description: "개봉 후 사용기간 개월 수 (양수 숫자 또는 '해당 없음' / 'NA' 입력 -> EAV PAO_MONTHS).",
    options: [],
  },
  {
    code: "STORAGE_CONDITION",
    fieldKey: "attrStorageCondition",
    header: "보관 조건 (Storage Conditions)",
    headerEn: "Storage Conditions",
    headerAliases: [
      "보관 조건 (storage conditions)",
      "보관 조건 (storage condition)",
      "보관 조건",
      "storage conditions",
      "storage condition",
      "storage_condition",
    ],
    nameKo: "보관 조건",
    nameEn: "Storage Condition",
    attrGroupKo: "유통 및 보관",
    attrGroupEn: "Shelf Life & Storage",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 30,
    exampleValue: "Cool & Dry Place; Avoid Direct Sunlight",
    description: "복수 선택 가능 — 세미콜론(;)으로 구분 입력 (Common_Attributes 시트 옵션 참조 -> EAV STORAGE_CONDITION).",
    options: [
      { optionCode: "ROOM_TEMP", optionKo: "실온", optionEn: "Room Temperature" },
      { optionCode: "COOL_DRY", optionKo: "서늘하고 건조한 곳", optionEn: "Cool & Dry Place" },
      { optionCode: "REFRIGERATED", optionKo: "냉장 보관", optionEn: "Refrigerated" },
      { optionCode: "AVOID_SUNLIGHT", optionKo: "직사광선 피함", optionEn: "Avoid Direct Sunlight" },
      { optionCode: "AVOID_HEAT", optionKo: "고온 피함", optionEn: "Avoid Heat" },
      { optionCode: "KEEP_DRY", optionKo: "습기 피함", optionEn: "Keep Dry" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },

  // Group 2: 패키지 및 제품 형태 (Packaging & Format)
  {
    code: "PACKAGE_FORMAT",
    fieldKey: "attrPackageFormat",
    header: "패키지 형태 (Package Format)",
    headerEn: "Package Format",
    headerAliases: [
      "패키지 형태 (package format)",
      "패키지 형태",
      "package format",
      "package_format",
    ],
    nameKo: "패키지 형태",
    nameEn: "Package Format",
    attrGroupKo: "패키지 및 제품 형태",
    attrGroupEn: "Packaging & Format",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Pump Bottle",
    description: "단일 선택 — 용기/패키지 형태 입력 (예: Tube, Pump Bottle, 펌프 보틀 -> EAV PACKAGE_FORMAT).",
    options: [
      { optionCode: "TUBE", optionKo: "튜브", optionEn: "Tube" },
      { optionCode: "JAR", optionKo: "자", optionEn: "Jar" },
      { optionCode: "PUMP_BOTTLE", optionKo: "펌프 보틀", optionEn: "Pump Bottle" },
      { optionCode: "DROPPER_BOTTLE", optionKo: "드로퍼 보틀", optionEn: "Dropper Bottle" },
      { optionCode: "SPRAY_BOTTLE", optionKo: "스프레이 보틀", optionEn: "Spray Bottle" },
      { optionCode: "STICK", optionKo: "스틱", optionEn: "Stick" },
      { optionCode: "COMPACT", optionKo: "컴팩트", optionEn: "Compact" },
      { optionCode: "CUSHION_COMPACT", optionKo: "쿠션 컴팩트", optionEn: "Cushion Compact" },
      { optionCode: "SACHET", optionKo: "파우치/사셰", optionEn: "Sachet" },
      { optionCode: "SHEET_PACK", optionKo: "시트 팩", optionEn: "Sheet Pack" },
      { optionCode: "ROLL_ON", optionKo: "롤온", optionEn: "Roll-On", aliases: ["Roll On"] },
      { optionCode: "AEROSOL", optionKo: "에어로졸", optionEn: "Aerosol" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "FORMULATION",
    fieldKey: "attrFormulation",
    header: "제형 (Formulation)",
    headerEn: "Formulation",
    headerAliases: ["제형 (formulation)", "제형", "formulation"],
    nameKo: "제형",
    nameEn: "Formulation",
    attrGroupKo: "패키지 및 제품 형태",
    attrGroupEn: "Packaging & Format",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Liquid",
    description: "복수 선택 가능 — 세미콜론(;)으로 구분 입력 (예: Liquid; Gel -> EAV FORMULATION).",
    options: [
      { optionCode: "LIQUID", optionKo: "리퀴드", optionEn: "Liquid" },
      { optionCode: "GEL", optionKo: "젤", optionEn: "Gel" },
      { optionCode: "CREAM", optionKo: "크림", optionEn: "Cream" },
      { optionCode: "LOTION", optionKo: "로션", optionEn: "Lotion" },
      { optionCode: "BALM", optionKo: "밤", optionEn: "Balm" },
      { optionCode: "OIL", optionKo: "오일", optionEn: "Oil" },
      { optionCode: "FOAM", optionKo: "폼", optionEn: "Foam" },
      { optionCode: "MOUSSE", optionKo: "무스", optionEn: "Mousse" },
      { optionCode: "POWDER", optionKo: "파우더", optionEn: "Powder" },
      { optionCode: "STICK", optionKo: "스틱", optionEn: "Stick" },
      { optionCode: "MIST", optionKo: "미스트", optionEn: "Mist" },
      { optionCode: "SHEET", optionKo: "시트", optionEn: "Sheet" },
      { optionCode: "PATCH", optionKo: "패치", optionEn: "Patch" },
      { optionCode: "WAX", optionKo: "왁스", optionEn: "Wax" },
      { optionCode: "SOAP_BAR", optionKo: "고형 비누", optionEn: "Soap Bar" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "SEALED",
    fieldKey: "attrSealed",
    header: "밀봉 여부 (Sealed Packaging)",
    headerEn: "Sealed Packaging",
    headerAliases: [
      "밀봉 여부 (sealed packaging)",
      "밀봉 여부",
      "sealed packaging",
      "sealed",
    ],
    nameKo: "밀봉 여부",
    nameEn: "Sealed Packaging",
    attrGroupKo: "패키지 및 제품 형태",
    attrGroupEn: "Packaging & Format",
    inputType: "YES_NO_NA",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    width: 24,
    exampleValue: "Yes",
    description: "단일 선택 — Yes(예), No(아니요), Not Applicable(해당 없음) 중 선택 (-> EAV SEALED).",
    options: [
      { optionCode: "YES", optionKo: "예", optionEn: "Yes", aliases: ["Y", "TRUE"] },
      { optionCode: "NO", optionKo: "아니요", optionEn: "No", aliases: ["아니오", "N", "FALSE"] },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
    ],
  },
  {
    code: "REFILLABLE",
    fieldKey: "attrRefillable",
    header: "리필 여부 (Refillable)",
    headerEn: "Refillable",
    headerAliases: ["리필 여부 (refillable)", "리필 여부", "refillable"],
    nameKo: "리필 여부",
    nameEn: "Refillable",
    attrGroupKo: "패키지 및 제품 형태",
    attrGroupEn: "Packaging & Format",
    inputType: "YES_NO_NA",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    width: 22,
    exampleValue: "No",
    description: "단일 선택 — Yes(예), No(아니요), Not Applicable(해당 없음) 중 선택 (-> EAV REFILLABLE).",
    options: [
      { optionCode: "YES", optionKo: "예", optionEn: "Yes", aliases: ["Y", "TRUE"] },
      { optionCode: "NO", optionKo: "아니요", optionEn: "No", aliases: ["아니오", "N", "FALSE"] },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
    ],
  },

  // Group 3: 대상 고객 (Target Customer)
  {
    code: "TARGET_AGE",
    fieldKey: "attrTargetAge",
    header: "대상 연령 (Target Age)",
    headerEn: "Target Age",
    headerAliases: ["대상 연령 (target age)", "대상 연령", "target age", "target_age"],
    nameKo: "대상 연령",
    nameEn: "Target Age",
    attrGroupKo: "대상 고객",
    attrGroupEn: "Target Customer",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Adults; All Ages",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: 20s; 30s; Adults -> EAV TARGET_AGE).",
    options: [
      { optionCode: "CHILDREN", optionKo: "어린이", optionEn: "Children" },
      { optionCode: "TEENS", optionKo: "청소년", optionEn: "Teens" },
      { optionCode: "TWENTIES", optionKo: "20대", optionEn: "20s" },
      { optionCode: "THIRTIES", optionKo: "30대", optionEn: "30s" },
      { optionCode: "FORTIES", optionKo: "40대", optionEn: "40s" },
      { optionCode: "FIFTIES_PLUS", optionKo: "50대 이상", optionEn: "50s+", aliases: ["50s Plus"] },
      { optionCode: "ADULTS", optionKo: "성인", optionEn: "Adults" },
      { optionCode: "ALL_AGES", optionKo: "전 연령", optionEn: "All Ages" },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "TARGET_GENDER",
    fieldKey: "attrTargetGender",
    header: "대상 성별 (Target Gender)",
    headerEn: "Target Gender",
    headerAliases: [
      "대상 성별 (target gender)",
      "대상 성별",
      "target gender",
      "target_gender",
    ],
    nameKo: "대상 성별",
    nameEn: "Target Gender",
    attrGroupKo: "대상 고객",
    attrGroupEn: "Target Customer",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    width: 24,
    exampleValue: "Unisex",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (Women, Men, Unisex, Not Applicable -> EAV TARGET_GENDER).",
    options: [
      { optionCode: "WOMEN", optionKo: "여성", optionEn: "Women", aliases: ["Female"] },
      { optionCode: "MEN", optionKo: "남성", optionEn: "Men", aliases: ["Male"] },
      { optionCode: "UNISEX", optionKo: "남녀 공용", optionEn: "Unisex", aliases: ["남녀공용"] },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
    ],
  },
  {
    code: "SKIN_TYPE",
    fieldKey: "attrSkinType",
    header: "피부 타입 (Skin Type)",
    headerEn: "Skin Type",
    headerAliases: ["피부 타입 (skin type)", "피부 타입", "skin type", "skin_type"],
    nameKo: "피부 타입",
    nameEn: "Skin Type",
    attrGroupKo: "대상 고객",
    attrGroupEn: "Target Customer",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 28,
    exampleValue: "Dry Skin; Sensitive Skin",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: Dry Skin; Sensitive Skin -> EAV SKIN_TYPE).",
    options: [
      { optionCode: "DRY", optionKo: "건성", optionEn: "Dry", aliases: ["Dry Skin", "건성 피부"] },
      { optionCode: "OILY", optionKo: "지성", optionEn: "Oily", aliases: ["Oily Skin", "지성 피부"] },
      {
        optionCode: "COMBINATION",
        optionKo: "복합성",
        optionEn: "Combination",
        aliases: ["Combination Skin", "복합성 피부"],
      },
      { optionCode: "NORMAL", optionKo: "중성", optionEn: "Normal", aliases: ["Normal Skin", "중성 피부"] },
      {
        optionCode: "SENSITIVE",
        optionKo: "민감성",
        optionEn: "Sensitive",
        aliases: ["Sensitive Skin", "민감성 피부"],
      },
      {
        optionCode: "ACNE_PRONE",
        optionKo: "여드름성 피부",
        optionEn: "Acne-Prone",
        aliases: ["Acne-Prone Skin", "Acne Prone", "Acne Prone Skin", "여드름성"],
      },
      { optionCode: "ALL_SKIN_TYPES", optionKo: "모든 피부 타입", optionEn: "All Skin Types" },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },

  // Group 4: 사용 정보 및 제품 특성 (Usage & Product Characteristics)
  {
    code: "USAGE_FREQUENCY",
    fieldKey: "attrUsageFrequency",
    header: "사용 주기 (Usage Frequency)",
    headerEn: "Usage Frequency",
    headerAliases: [
      "사용 주기 (usage frequency)",
      "사용 주기",
      "usage frequency",
      "usage_frequency",
    ],
    nameKo: "사용 주기",
    nameEn: "Usage Frequency",
    attrGroupKo: "사용 정보",
    attrGroupEn: "Usage",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Daily",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: Daily; As Needed -> EAV USAGE_FREQUENCY).",
    options: [
      { optionCode: "DAILY", optionKo: "매일", optionEn: "Daily" },
      { optionCode: "WEEKLY_ONCE", optionKo: "주 1회", optionEn: "Once Weekly" },
      {
        optionCode: "WEEKLY_2_3",
        optionKo: "주 2~3회",
        optionEn: "2–3 Times Weekly",
        aliases: ["2-3 Times Weekly", "2~3 Times Weekly", "주 2-3회", "주2~3회"],
      },
      { optionCode: "AS_NEEDED", optionKo: "필요 시", optionEn: "As Needed" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "DAILY_USE_COUNT",
    fieldKey: "attrDailyUseCount",
    header: "사용 횟수 (Daily Use Count)",
    headerEn: "Daily Use Count",
    headerAliases: [
      "사용 횟수 (daily use count)",
      "사용 횟수",
      "daily use count",
      "daily_use_count",
    ],
    nameKo: "사용 횟수",
    nameEn: "Daily Use Count",
    attrGroupKo: "사용 정보",
    attrGroupEn: "Usage",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Twice Daily",
    description: "단일 선택 — 1일 권장 사용 횟수 선택 (예: Once Daily, Twice Daily -> EAV DAILY_USE_COUNT).",
    options: [
      { optionCode: "ONCE", optionKo: "1일 1회", optionEn: "Once Daily" },
      { optionCode: "TWICE", optionKo: "1일 2회", optionEn: "Twice Daily" },
      { optionCode: "THREE_PLUS", optionKo: "1일 3회 이상", optionEn: "3+ Times Daily" },
      { optionCode: "AS_NEEDED", optionKo: "필요 시", optionEn: "As Needed" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "USAGE_OCCASION",
    fieldKey: "attrUsageOccasion",
    header: "사용 상황 (Usage Occasion)",
    headerEn: "Usage Occasion",
    headerAliases: [
      "사용 상황 (usage occasion)",
      "사용 상황",
      "usage occasion",
      "usage_occasion",
    ],
    nameKo: "사용 상황",
    nameEn: "Usage Occasion",
    attrGroupKo: "사용 정보",
    attrGroupEn: "Usage",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 28,
    exampleValue: "After Cleansing; Before Bed",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: After Cleansing; Before Bed -> EAV USAGE_OCCASION).",
    options: [
      { optionCode: "BEFORE_CLEANSING", optionKo: "세안 전", optionEn: "Before Cleansing" },
      { optionCode: "DURING_CLEANSING", optionKo: "세안 중", optionEn: "During Cleansing" },
      { optionCode: "AFTER_CLEANSING", optionKo: "세안 후", optionEn: "After Cleansing" },
      { optionCode: "BEFORE_MAKEUP", optionKo: "메이크업 전", optionEn: "Before Makeup" },
      { optionCode: "AFTER_MAKEUP", optionKo: "메이크업 후", optionEn: "After Makeup" },
      { optionCode: "BEFORE_SHAMPOO", optionKo: "샴푸 전", optionEn: "Before Shampoo" },
      { optionCode: "AFTER_SHAMPOO", optionKo: "샴푸 후", optionEn: "After Shampoo" },
      { optionCode: "BEFORE_BED", optionKo: "취침 전", optionEn: "Before Bed" },
      { optionCode: "BEFORE_GOING_OUT", optionKo: "외출 전", optionEn: "Before Going Out" },
      { optionCode: "AS_NEEDED", optionKo: "필요 시", optionEn: "As Needed" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "APPLICATION_AREA",
    fieldKey: "attrApplicationArea",
    header: "사용 부위 (Application Area)",
    headerEn: "Application Area",
    headerAliases: [
      "사용 부위 (application area)",
      "사용 부위",
      "application area",
      "application_area",
    ],
    nameKo: "사용 부위",
    nameEn: "Application Area",
    attrGroupKo: "사용 정보",
    attrGroupEn: "Usage",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Face",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: Face; Eye Area -> EAV APPLICATION_AREA).",
    options: [
      { optionCode: "FACE", optionKo: "얼굴", optionEn: "Face" },
      { optionCode: "EYE_AREA", optionKo: "눈가", optionEn: "Eye Area" },
      { optionCode: "LIPS", optionKo: "입술", optionEn: "Lips" },
      { optionCode: "NOSE", optionKo: "코", optionEn: "Nose" },
      { optionCode: "SCALP", optionKo: "두피", optionEn: "Scalp" },
      { optionCode: "HAIR", optionKo: "모발", optionEn: "Hair" },
      { optionCode: "BODY", optionKo: "바디", optionEn: "Body" },
      { optionCode: "HANDS", optionKo: "손", optionEn: "Hands" },
      { optionCode: "FEET", optionKo: "발", optionEn: "Feet" },
      { optionCode: "UNDERARMS", optionKo: "겨드랑이", optionEn: "Underarms" },
      { optionCode: "ORAL", optionKo: "구강", optionEn: "Oral" },
      { optionCode: "INTIMATE_AREA", optionKo: "외음부 주변", optionEn: "External Intimate Area" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "PRIMARY_CONCERN",
    fieldKey: "attrPrimaryConcern",
    header: "주요 고민 (Primary Concern)",
    headerEn: "Primary Concern",
    headerAliases: [
      "주요 고민 (primary concern)",
      "주요 고민",
      "primary concern",
      "primary_concern",
    ],
    nameKo: "주요 고민",
    nameEn: "Primary Concern",
    attrGroupKo: "제품 특성",
    attrGroupEn: "Characteristics",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 30,
    exampleValue: "Dryness; Sensitivity & Soothing",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: Dryness; Skin Barrier -> EAV PRIMARY_CONCERN).",
    options: [
      { optionCode: "DRYNESS", optionKo: "건조", optionEn: "Dryness" },
      { optionCode: "OILINESS", optionKo: "유분", optionEn: "Oiliness" },
      { optionCode: "ACNE", optionKo: "여드름/트러블", optionEn: "Acne & Blemishes", aliases: ["Acne"] },
      {
        optionCode: "SENSITIVITY",
        optionKo: "민감/진정",
        optionEn: "Sensitivity & Soothing",
        aliases: ["Sensitivity", "Soothing"],
      },
      { optionCode: "DULLNESS", optionKo: "칙칙함", optionEn: "Dullness" },
      { optionCode: "PIGMENTATION", optionKo: "색소 침착", optionEn: "Pigmentation" },
      {
        optionCode: "WRINKLES",
        optionKo: "주름/탄력",
        optionEn: "Wrinkles & Firmness",
        aliases: ["Wrinkles"],
      },
      { optionCode: "PORES", optionKo: "모공", optionEn: "Pores" },
      { optionCode: "BARRIER", optionKo: "피부 장벽", optionEn: "Skin Barrier" },
      { optionCode: "UV_PROTECTION", optionKo: "자외선 보호", optionEn: "UV Protection" },
      { optionCode: "HAIR_DAMAGE", optionKo: "모발 손상", optionEn: "Hair Damage" },
      { optionCode: "SCALP_ISSUES", optionKo: "두피 고민", optionEn: "Scalp Concerns" },
      { optionCode: "ODOR", optionKo: "냄새", optionEn: "Odor" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },

  // Group 5: 향 정보 (Fragrance)
  {
    code: "SCENTED",
    fieldKey: "attrScented",
    header: "향 유무 (Scented)",
    headerEn: "Scented",
    headerAliases: ["향 유무 (scented)", "향 유무", "scented"],
    nameKo: "향 유무",
    nameEn: "Scented",
    attrGroupKo: "제품 특성",
    attrGroupEn: "Fragrance",
    inputType: "YES_NO_NA",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    width: 22,
    exampleValue: "No",
    description: "단일 선택 — Yes(예), No(아니요), Not Applicable(해당 없음) 중 선택 (-> EAV SCENTED).",
    options: [
      { optionCode: "YES", optionKo: "예", optionEn: "Yes", aliases: ["Y", "TRUE"] },
      { optionCode: "NO", optionKo: "아니요", optionEn: "No", aliases: ["아니오", "N", "FALSE"] },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
    ],
  },
  {
    code: "SCENT_FAMILY",
    fieldKey: "attrScentFamily",
    header: "향 계열 (Scent Family)",
    headerEn: "Scent Family",
    headerAliases: ["향 계열 (scent family)", "향 계열", "scent family", "scent_family"],
    nameKo: "향 계열",
    nameEn: "Scent Family",
    attrGroupKo: "제품 특성",
    attrGroupEn: "Fragrance",
    inputType: "MULTI_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: true,
    width: 26,
    exampleValue: "Unscented",
    description: "복수 선택 가능 — 세미콜론(;) 구분 입력 (예: Unscented 또는 Floral; Citrus -> EAV SCENT_FAMILY).",
    options: [
      { optionCode: "UNSCENTED", optionKo: "무향", optionEn: "Unscented" },
      { optionCode: "FLORAL", optionKo: "플로럴", optionEn: "Floral" },
      { optionCode: "CITRUS", optionKo: "시트러스", optionEn: "Citrus" },
      { optionCode: "FRUITY", optionKo: "프루티", optionEn: "Fruity" },
      { optionCode: "HERBAL", optionKo: "허벌", optionEn: "Herbal" },
      { optionCode: "WOODY", optionKo: "우디", optionEn: "Woody" },
      { optionCode: "MUSKY", optionKo: "머스크", optionEn: "Musky" },
      { optionCode: "POWDERY", optionKo: "파우더리", optionEn: "Powdery" },
      { optionCode: "FRESH", optionKo: "프레시", optionEn: "Fresh" },
      { optionCode: "GOURMAND", optionKo: "구르망", optionEn: "Gourmand" },
      { optionCode: "OTHER", optionKo: "기타", optionEn: "Other" },
    ],
  },
  {
    code: "SCENT_INTENSITY",
    fieldKey: "attrScentIntensity",
    header: "향 강도 (Scent Intensity)",
    headerEn: "Scent Intensity",
    headerAliases: [
      "향 강도 (scent intensity)",
      "향 강도",
      "scent intensity",
      "scent_intensity",
    ],
    nameKo: "향 강도",
    nameEn: "Scent Intensity",
    attrGroupKo: "제품 특성",
    attrGroupEn: "Fragrance",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    width: 24,
    exampleValue: "None",
    description: "단일 선택 — None(없음), Light(약함), Medium(중간), Strong(강함), N/A 중 선택 (-> EAV SCENT_INTENSITY).",
    options: [
      { optionCode: "NONE", optionKo: "없음", optionEn: "None" },
      { optionCode: "LIGHT", optionKo: "약함", optionEn: "Light" },
      { optionCode: "MEDIUM", optionKo: "중간", optionEn: "Medium" },
      { optionCode: "STRONG", optionKo: "강함", optionEn: "Strong" },
    ],
  },

  // Group 6: 규제 및 등록 (Regulatory — Brand Self-Reported Only)
  {
    code: "FDA_STATUS",
    fieldKey: "attrFdaStatus",
    header: "FDA 관련 상태 (FDA Related Status)",
    headerEn: "FDA Related Status",
    headerAliases: [
      "fda 관련 상태 (fda related status)",
      "fda 관련 상태",
      "fda related status",
      "fda status",
      "fda_status",
    ],
    nameKo: "FDA 관련 상태",
    nameEn: "FDA Related Status",
    attrGroupKo: "규제 및 등록",
    attrGroupEn: "Regulatory",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    isRegulatoryBrandReported: true,
    width: 28,
    exampleValue: "Not Reviewed",
    description:
      "단일 선택 (브랜드 자체 기재 속성 — 공식 인증/승인으로 간주되지 않으며 관리자 확인 완료 상태는 직접 지정 불가 -> EAV FDA_STATUS).",
    options: [
      { optionCode: "NOT_REVIEWED", optionKo: "미검토", optionEn: "Not Reviewed" },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
      { optionCode: "REVIEW_REQUIRED", optionKo: "검토 필요", optionEn: "Review Required" },
      { optionCode: "IN_PROGRESS", optionKo: "진행 중", optionEn: "In Progress" },
      { optionCode: "SUBMITTED", optionKo: "제출 완료", optionEn: "Submitted" },
      { optionCode: "COMPLETED", optionKo: "완료", optionEn: "Completed" },
      {
        optionCode: "ADMIN_VERIFIED",
        optionKo: "관리자 확인 완료",
        optionEn: "Admin Verified",
        adminOnlyOption: true,
      },
    ],
  },
  {
    code: "MOCRA_STATUS",
    fieldKey: "attrMocraStatus",
    header: "MoCRA 관련 상태 (MoCRA Related Status)",
    headerEn: "MoCRA Related Status",
    headerAliases: [
      "mocra 관련 상태 (mocra related status)",
      "mocra 관련 상태",
      "mocra related status",
      "mocra status",
      "mocra_status",
    ],
    nameKo: "MoCRA 관련 상태",
    nameEn: "MoCRA Related Status",
    attrGroupKo: "규제 및 등록",
    attrGroupEn: "Regulatory",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    isRegulatoryBrandReported: true,
    width: 30,
    exampleValue: "Not Reviewed",
    description:
      "단일 선택 (브랜드 자체 기재 속성 — 공식 인증/승인으로 간주되지 않으며 관리자 확인 완료 상태는 직접 지정 불가 -> EAV MOCRA_STATUS).",
    options: [
      { optionCode: "NOT_REVIEWED", optionKo: "미검토", optionEn: "Not Reviewed" },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
      { optionCode: "REVIEW_REQUIRED", optionKo: "검토 필요", optionEn: "Review Required" },
      {
        optionCode: "FACILITY_PENDING",
        optionKo: "시설 등록 준비 중",
        optionEn: "Facility Registration Pending",
      },
      {
        optionCode: "PRODUCT_LISTING_PENDING",
        optionKo: "제품 리스팅 준비 중",
        optionEn: "Product Listing Pending",
      },
      { optionCode: "COMPLETED", optionKo: "완료", optionEn: "Completed" },
      {
        optionCode: "ADMIN_VERIFIED",
        optionKo: "관리자 확인 완료",
        optionEn: "Admin Verified",
        adminOnlyOption: true,
      },
    ],
  },
  {
    code: "OTC_STATUS",
    fieldKey: "attrOtcStatus",
    header: "OTC 해당 여부 (OTC Status)",
    headerEn: "OTC Status",
    headerAliases: [
      "otc 해당 여부 (otc status)",
      "otc 해당 여부",
      "otc status",
      "otc_status",
    ],
    nameKo: "OTC 해당 여부",
    nameEn: "OTC Status",
    attrGroupKo: "규제 및 등록",
    attrGroupEn: "Regulatory",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    isRegulatoryBrandReported: true,
    width: 26,
    exampleValue: "Not OTC",
    description:
      "단일 선택 (브랜드 자체 기재 속성 — Not Reviewed, Not OTC, Potential OTC, OTC Required, In Progress, Completed -> EAV OTC_STATUS).",
    options: [
      { optionCode: "NOT_REVIEWED", optionKo: "미검토", optionEn: "Not Reviewed" },
      { optionCode: "NOT_OTC", optionKo: "OTC 아님", optionEn: "Not OTC" },
      { optionCode: "POTENTIAL_OTC", optionKo: "OTC 가능성 있음", optionEn: "Potential OTC" },
      { optionCode: "OTC_REQUIRED", optionKo: "OTC 적용", optionEn: "OTC Required" },
      { optionCode: "IN_PROGRESS", optionKo: "준비 중", optionEn: "In Progress" },
      { optionCode: "COMPLETED", optionKo: "완료", optionEn: "Completed" },
    ],
  },
  {
    code: "DRUG_FACTS_STATUS",
    fieldKey: "attrDrugFactsStatus",
    header: "Drug Facts 상태 (Drug Facts Status)",
    headerEn: "Drug Facts Status",
    headerAliases: [
      "drug facts 상태 (drug facts status)",
      "drug facts 상태",
      "drug facts status",
      "drug_facts_status",
    ],
    nameKo: "Drug Facts 상태",
    nameEn: "Drug Facts Status",
    attrGroupKo: "규제 및 등록",
    attrGroupEn: "Regulatory",
    inputType: "SINGLE_SELECT",
    unitSet: null,
    allowNa: true,
    allowOther: false,
    isRegulatoryBrandReported: true,
    width: 28,
    exampleValue: "Not Applicable",
    description:
      "단일 선택 (브랜드 자체 기재 속성 — Not Reviewed, Not Applicable, Required, Draft, Under Review, Completed -> EAV DRUG_FACTS_STATUS).",
    options: [
      { optionCode: "NOT_REVIEWED", optionKo: "미검토", optionEn: "Not Reviewed" },
      {
        optionCode: "NOT_APPLICABLE",
        optionKo: "해당 없음",
        optionEn: "Not Applicable",
        aliases: ["해당없음", "N/A", "NA"],
      },
      { optionCode: "REQUIRED", optionKo: "필요", optionEn: "Required" },
      { optionCode: "DRAFT", optionKo: "초안", optionEn: "Draft" },
      { optionCode: "REVIEWING", optionKo: "검토 중", optionEn: "Under Review", aliases: ["Reviewing"] },
      { optionCode: "COMPLETED", optionKo: "완료", optionEn: "Completed" },
    ],
  },
];

const MEDIA_COLUMNS: BulkColumnSpec[] = [
  {
    key: "mainImageUrl",
    header: "대표 이미지 URL (Main Image URL)",
    headerEn: "Main Image URL",
    aliases: [
      "대표 이미지 url (main image url)",
      "대표 이미지 url",
      "대표이미지 url",
      "main image url",
      "main_image_url",
      "image url 1",
    ],
    required: false,
    section: "Media",
    dbColumn: "product_images (position: 0)",
    width: 34,
    description:
      "대표 상품 이미지 직접 다운로드 HTTPS URL (JPG, PNG, WEBP · 최대 10MB · position 0 등록).",
  },
  ...([2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(
    (num): BulkColumnSpec => ({
      key: `additionalImageUrl${num}` as BulkMediaImageFieldKey,
      header: `추가 이미지 URL ${num} (Additional Image URL ${num})`,
      headerEn: `Additional Image URL ${num}`,
      aliases: [
        `추가 이미지 url ${num} (additional image url ${num})`,
        `추가 이미지 url ${num}`,
        `추가이미지 url ${num}`,
        `additional image url ${num}`,
        `additional_image_url_${num}`,
        `image url ${num}`,
      ],
      required: false,
      section: "Media",
      dbColumn: `product_images (position: ${num - 1})`,
      width: 32,
      description: `추가 상품 이미지 ${num} HTTPS URL (JPG, PNG, WEBP · 최대 10MB · 대표 이미지 URL 입력 시 순서대로 등록).`,
    })
  ),
  {
    key: "productVideoUrl",
    header: "제품 동영상 URL (Product Video URL)",
    headerEn: "Product Video URL",
    aliases: [
      "제품 동영상 url (product video url)",
      "제품 소개 영상 url (product video url)",
      "제품 동영상 url",
      "동영상 url",
      "product video url",
      "product_video_url",
      "video url",
    ],
    required: false,
    section: "Media",
    dbColumn: "product_videos.video_url",
    width: 34,
    description:
      "제품 소개 외부 동영상 HTTPS 링크 (YouTube, Vimeo 등 -> product_videos.video_url 연동).",
  },
];

const COMMON_ATTRIBUTE_COLUMNS: BulkColumnSpec[] = COMMON_BULK_ATTRIBUTES.map((attr) => ({
  key: attr.fieldKey,
  header: attr.header,
  headerEn: attr.headerEn,
  aliases: attr.headerAliases,
  required: false,
  section: "Common Attributes",
  dbColumn: `product_attribute_values (${attr.code})`,
  width: attr.width,
  description: attr.description,
  attributeCode: attr.code,
}));

export const BULK_PRODUCT_COLUMNS: BulkColumnSpec[] = [
  // 1. REQUIRED (4) — Columns A..D
  {
    key: "brand",
    header: "브랜드 (Brand) *",
    headerEn: "Brand *",
    aliases: [
      "브랜드 (brand) *",
      "브랜드 (brand)",
      "브랜드 *",
      "브랜드",
      "brand",
      "brand *",
      "brand (required)",
      "brand name",
    ],
    required: true,
    section: "Required",
    dbColumn: "brand_id",
    width: 24,
    description: "귀사에 등록된 활성 브랜드명 입력 (Brands 시트 참조 / Active brand name owned by your company).",
  },
  {
    key: "manufactureSku",
    header: "제조사 SKU (Manufacturer SKU) *",
    headerEn: "Manufacturer SKU *",
    aliases: [
      "제조사 sku (manufacturer sku) *",
      "제조사 sku (manufacturer sku)",
      "제조사 sku *",
      "제조사 sku",
      "manufacturer sku",
      "manufacturer sku *",
      "manufacture sku",
      "manufacture_sku",
      "sku",
    ],
    required: true,
    section: "Required",
    dbColumn: "manufacture_sku",
    width: 33,
    textFormat: true,
    description: "귀사 내 고유 제조사 SKU 코드 (영문/숫자/-/_ 조합, 텍스트 서식 유지 / Unique SKU code formatted as Text).",
  },
  {
    key: "productNameEn",
    header: "영문 제품명 (Product Name EN) *",
    headerEn: "Product Name EN *",
    aliases: [
      "영문 제품명 (product name en) *",
      "영문 제품명 (product name en)",
      "영문 제품명 *",
      "영문 제품명",
      "product name en",
      "product name en *",
      "product name (en)",
      "english product name",
      "name_en",
    ],
    required: true,
    section: "Required",
    dbColumn: "name_en (and name fallback)",
    width: 36,
    description: "공식 영문 제품명 입력 (필수 / Official English product name).",
  },
  {
    key: "category1Depth",
    header: "카테고리 (1Depth) *",
    headerEn: "Category 1Depth *",
    aliases: [
      "카테고리 (1depth) *",
      "카테고리 (1depth)",
      "카테고리 1depth (category 1depth)",
      "카테고리 1depth *",
      "카테고리 1depth",
      "1차 카테고리 *",
      "category 1depth",
      "category 1depth *",
      "category (1depth)",
      "category",
      "1depth category",
    ],
    required: true,
    section: "Required",
    dbColumn: "category / category_code",
    width: 26,
    description: "대분류 카테고리 코드 또는 명칭 입력 (예: 스킨케어 (Skincare), Skincare — Categories 시트 참조).",
  },

  // 2. OPTIONAL — CATEGORY HIERARCHY (Columns E..F)
  {
    key: "category2Depth",
    header: "카테고리 (2Depth)",
    headerEn: "Category 2Depth",
    aliases: [
      "카테고리 (2depth)",
      "카테고리 2depth (category 2depth)",
      "카테고리 2depth",
      "2차 카테고리",
      "category 2depth",
      "category (2depth)",
      "2depth category",
    ],
    required: false,
    section: "Category",
    dbColumn: "category_code",
    width: 28,
    description: "선택한 1Depth 하위 중분류 카테고리 (1Depth 선택 시 하위 목록 연동 드롭다운 제공 · Categories 시트 참조).",
  },
  {
    key: "category3Depth",
    header: "카테고리 (3Depth)",
    headerEn: "Category 3Depth",
    aliases: [
      "카테고리 (3depth)",
      "카테고리 3depth (category 3depth)",
      "카테고리 3depth",
      "3차 카테고리",
      "category 3depth",
      "category (3depth)",
      "3depth category",
    ],
    required: false,
    section: "Category",
    dbColumn: "category_code",
    width: 30,
    description: "선택한 2Depth 하위 소분류 카테고리 (2Depth 선택 시 하위 목록 연동 드롭다운 제공 · Categories 시트 참조).",
  },

  // 3. OPTIONAL — BASIC INFORMATION (Columns G..AD)
  {
    key: "productNameKo",
    header: "국문 제품명 (Product Name KO)",
    headerEn: "Product Name KO",
    aliases: [
      "국문 제품명 (product name ko)",
      "국문 제품명",
      "한글 제품명",
      "product name ko",
      "product name (ko)",
      "korean product name",
      "name_ko",
    ],
    required: false,
    section: "Basic Info",
    dbColumn: "name",
    width: 38,
    description: "국문 제품명 (미입력 시 영문 제품명이 기본 제품명으로 저장됩니다).",
  },
  {
    key: "volumeValue",
    header: "용량 수치 (Volume Value)",
    headerEn: "Volume Value",
    aliases: ["용량 수치 (volume value)", "용량 수치", "용량 값", "volume value", "volume"],
    required: false,
    section: "Basic Info",
    dbColumn: "volume",
    width: 20,
    description: "제품 용량/규격 숫자값 (예: 200 — 용량 단위와 함께 입력).",
  },
  {
    key: "volumeUnit",
    header: "용량 단위 (Volume Unit)",
    headerEn: "Volume Unit",
    aliases: ["용량 단위 (volume unit)", "용량 단위", "volume unit"],
    required: false,
    section: "Basic Info",
    dbColumn: "volume",
    width: 20,
    description: "허용 단위: ml, L, g, kg, mg, oz, fl oz, ea / pcs, Other.",
  },
  {
    key: "countryOfOrigin",
    header: "제조국 (Country of Origin)",
    headerEn: "Country of Origin",
    aliases: ["제조국 (country of origin)", "제조국", "원산지", "country of origin", "origin"],
    required: false,
    section: "Basic Info",
    dbColumn: "origin",
    width: 24,
    description: "표준 영문 국가명 또는 ISO 코드 (예: South Korea — 미입력 시 빈 값 유지, 자동 입력 안 함).",
  },
  {
    key: "leadTimeValue",
    header: "리드타임 수치 (Lead Time Value)",
    headerEn: "Lead Time Value",
    aliases: ["리드타임 수치 (lead time value)", "리드타임 수치", "lead time value"],
    required: false,
    section: "Basic Info",
    dbColumn: "lead_time",
    width: 22,
    description: "생산/출고 리드타임 양의 정수 (예: 14 — 리드타임 단위와 함께 입력).",
  },
  {
    key: "leadTimeUnit",
    header: "리드타임 단위 (Lead Time Unit)",
    headerEn: "Lead Time Unit",
    aliases: ["리드타임 단위 (lead time unit)", "리드타임 단위", "lead time unit"],
    required: false,
    section: "Basic Info",
    dbColumn: "lead_time",
    width: 22,
    description: "Days(일), Weeks(주), Months(개월) 중 선택.",
  },
  {
    key: "color",
    header: "색상명 (Color)",
    headerEn: "Color",
    aliases: ["색상명 (color)", "색상명", "색상", "color"],
    required: false,
    section: "Basic Info",
    dbColumn: "color",
    width: 18,
    description: "표시 색상/호수명 (예: 01 Coral Pink).",
  },
  {
    key: "colorMap",
    header: "색상 계열 (Color Map)",
    headerEn: "Color Map",
    aliases: ["색상 계열 (color map)", "색상 계열", "color map", "color_map"],
    required: false,
    section: "Basic Info",
    dbColumn: "color_map",
    width: 20,
    description: "표준 색상 계열 (Allowed_Values 시트 참조).",
  },
  {
    key: "description",
    header: "상품 설명 (Description)",
    headerEn: "Description",
    aliases: ["상품 설명 (description)", "상품 설명", "제품 설명", "description", "product description"],
    required: false,
    section: "Basic Info",
    dbColumn: "description",
    width: 36,
    description: "상세 상품 소개 문구 (최대 5,000자).",
  },
  {
    key: "bulletPoint1",
    header: "핵심 포인트 1 (Bullet Point 1)",
    headerEn: "Bullet Point 1",
    aliases: ["핵심 포인트 1 (bullet point 1)", "핵심 포인트 1", "bullet point 1", "bullet 1"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[0]",
    width: 28,
    description: "주요 셀링 포인트 1 (최대 500자).",
  },
  {
    key: "bulletPoint2",
    header: "핵심 포인트 2 (Bullet Point 2)",
    headerEn: "Bullet Point 2",
    aliases: ["핵심 포인트 2 (bullet point 2)", "핵심 포인트 2", "bullet point 2", "bullet 2"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[1]",
    width: 28,
    description: "주요 셀링 포인트 2 (최대 500자).",
  },
  {
    key: "bulletPoint3",
    header: "핵심 포인트 3 (Bullet Point 3)",
    headerEn: "Bullet Point 3",
    aliases: ["핵심 포인트 3 (bullet point 3)", "핵심 포인트 3", "bullet point 3", "bullet 3"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[2]",
    width: 28,
    description: "주요 셀링 포인트 3 (최대 500자).",
  },
  {
    key: "bulletPoint4",
    header: "핵심 포인트 4 (Bullet Point 4)",
    headerEn: "Bullet Point 4",
    aliases: ["핵심 포인트 4 (bullet point 4)", "핵심 포인트 4", "bullet point 4", "bullet 4"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[3]",
    width: 28,
    description: "주요 셀링 포인트 4 (최대 500자).",
  },
  {
    key: "bulletPoint5",
    header: "핵심 포인트 5 (Bullet Point 5)",
    headerEn: "Bullet Point 5",
    aliases: ["핵심 포인트 5 (bullet point 5)", "핵심 포인트 5", "bullet point 5", "bullet 5"],
    required: false,
    section: "Basic Info",
    dbColumn: "bullet_points[4]",
    width: 28,
    description: "주요 셀링 포인트 5 (최대 500자).",
  },
  {
    key: "howToUse",
    header: "사용 방법 (How to Use)",
    headerEn: "How to Use",
    aliases: ["사용 방법 (how to use)", "사용 방법", "사용법", "how to use", "how_to_use", "directions"],
    required: false,
    section: "Basic Info",
    dbColumn: "how_to_use",
    width: 32,
    description: "제품 사용 방법 및 주의 안내 (최대 5,000자).",
  },
  {
    key: "ingredients",
    header: "전성분 (Ingredients)",
    headerEn: "Ingredients",
    aliases: ["전성분 (ingredients)", "전성분", "성분", "ingredients", "ingredients_text", "full ingredients"],
    required: false,
    section: "Basic Info",
    dbColumn: "ingredients_text",
    width: 36,
    description: "영문 INCI 또는 전성분 텍스트 (최대 10,000자).",
  },
  {
    key: "parentSku",
    header: "상위 SKU 여부 (Parent SKU)",
    headerEn: "Parent SKU",
    aliases: ["상위 sku 여부 (parent sku)", "상위 sku 여부", "parent sku", "parent_sku"],
    required: false,
    section: "Basic Info",
    dbColumn: "parent_sku",
    width: 20,
    description: "Y 또는 N 입력 (하위 SKU 여부와 동시에 Y 설정 불가).",
  },
  {
    key: "childSku",
    header: "하위 SKU 여부 (Child SKU)",
    headerEn: "Child SKU",
    aliases: ["하위 sku 여부 (child sku)", "하위 sku 여부", "child sku", "child_sku"],
    required: false,
    section: "Basic Info",
    dbColumn: "child_sku",
    width: 20,
    description: "Y 또는 N 입력 (상위 SKU 여부와 동시에 Y 설정 불가).",
  },
  {
    key: "upc",
    header: "UPC 바코드 12자리 (UPC)",
    headerEn: "UPC (12 Digits)",
    aliases: [
      "upc 바코드 12자리 (upc)",
      "upc 바코드 (12자리)",
      "upc 바코드",
      "upc",
      "upc (12 digits)",
      "upc barcode",
    ],
    required: false,
    section: "Basic Info",
    dbColumn: "upc",
    width: 24,
    textFormat: true,
    description: "미국 표준 12자리 숫자 UPC 바코드 (선행 0 보존을 위해 텍스트 서식 유지).",
  },
  {
    key: "ean",
    header: "EAN 바코드 13자리 (EAN)",
    headerEn: "EAN (13 Digits)",
    aliases: [
      "ean 바코드 13자리 (ean)",
      "ean 바코드 (13자리)",
      "ean 바코드",
      "ean",
      "ean (13 digits)",
      "ean barcode",
    ],
    required: false,
    section: "Basic Info",
    dbColumn: "ean",
    width: 24,
    textFormat: true,
    description: "국제 표준 13자리 숫자 EAN/KAN 바코드 (선행 0 보존을 위해 텍스트 서식 유지).",
  },
  {
    key: "sellingOnline",
    header: "온라인 판매 여부 (Selling Online)",
    headerEn: "Selling Online",
    aliases: ["온라인 판매 여부 (selling online)", "온라인 판매 여부", "selling online", "selling_online"],
    required: false,
    section: "Basic Info",
    dbColumn: "selling_online",
    width: 24,
    description: "TRUE 또는 FALSE 입력 (TRUE일 경우 온라인 판매 링크 1 필수).",
  },
  {
    key: "sellingOffline",
    header: "오프라인 판매 여부 (Selling Offline)",
    headerEn: "Selling Offline",
    aliases: ["오프라인 판매 여부 (selling offline)", "오프라인 판매 여부", "selling offline", "selling_offline"],
    required: false,
    section: "Basic Info",
    dbColumn: "selling_offline",
    width: 24,
    description: "TRUE 또는 FALSE 입력.",
  },
  {
    key: "salesLink1",
    header: "온라인 판매 링크 1 (Sales Link 1)",
    headerEn: "Sales Link 1",
    aliases: ["온라인 판매 링크 1 (sales link 1)", "온라인 판매 링크 1", "판매 링크 1", "sales link 1", "sales_link_1"],
    required: false,
    section: "Basic Info",
    dbColumn: "sales_link_1",
    width: 30,
    description: "대표 온라인 판매처 URL (https://... — 온라인 판매 여부가 TRUE일 때 필수).",
  },
  {
    key: "salesLink2",
    header: "온라인 판매 링크 2 (Sales Link 2)",
    headerEn: "Sales Link 2",
    aliases: ["온라인 판매 링크 2 (sales link 2)", "온라인 판매 링크 2", "판매 링크 2", "sales link 2", "sales_link_2"],
    required: false,
    section: "Basic Info",
    dbColumn: "sales_link_2",
    width: 30,
    description: "보조 온라인 판매처 URL (https://...).",
  },

  // 4. OPTIONAL — PRICING (Columns AE..AH)
  {
    key: "retailPriceKrw",
    header: "소비자가 KRW (Retail Price KRW)",
    headerEn: "Retail Price KRW",
    aliases: [
      "소비자가 krw (retail price krw)",
      "소비자가 krw",
      "소비자가 (krw)",
      "retail price krw",
      "retail price (krw)",
      "price_krw_retail",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "price_krw_retail",
    width: 24,
    description: "국내 권장소비자가 (원화 정수 >= 0, 통화기호 제외).",
  },
  {
    key: "wholesalePriceKrw",
    header: "국내 공급가 KRW (Wholesale Price KRW)",
    headerEn: "Wholesale Price KRW",
    aliases: [
      "국내 공급가 krw (wholesale price krw)",
      "국내 공급가 krw",
      "도매가 krw",
      "wholesale price krw",
      "wholesale price (krw)",
      "price_krw_wholesale",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "price_krw_wholesale",
    width: 26,
    description: "국내 도매/공급 단가 (원화 정수 >= 0, 통화기호 제외).",
  },
  {
    key: "estimatedRetailPriceUsd",
    header: "예상 미국 판매가 USD (Est. Retail USD)",
    headerEn: "Estimated Retail Price USD",
    aliases: [
      "예상 미국 판매가 usd (est. retail usd)",
      "예상 미국 판매가 usd",
      "예상 소비자가 usd",
      "estimated retail price usd",
      "estimated retail price (usd)",
      "estimated_retail_price",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "estimated_retail_price",
    width: 28,
    description: "미국 예상 소매가 MSRP (USD 소수 가능 >= 0, 예: 24.00).",
  },
  {
    key: "exportFobPriceUsd",
    header: "수출 FOB 단가 USD (Export FOB USD)",
    headerEn: "Export FOB Price USD",
    aliases: [
      "수출 fob 단가 usd (export fob usd)",
      "수출 fob 단가 usd",
      "fob 단가 usd",
      "export fob price usd",
      "export fob price (usd)",
      "fob price usd",
      "price_usd_fob",
    ],
    required: false,
    section: "Pricing",
    dbColumn: "price_usd_fob",
    width: 26,
    description: "수출 FOB 기준 공급 단가 (USD 소수 가능 >= 0, 예: 8.50).",
  },

  // 5. OPTIONAL — LOGISTICS (Columns AI..AZ)
  {
    key: "itemWidth",
    header: "단품 가로 cm (Item Width)",
    headerEn: "Item Width (cm)",
    aliases: ["단품 가로 cm (item width)", "단품 가로 (cm)", "item width (cm)", "item width", "item_width"],
    required: false,
    section: "Logistics",
    dbColumn: "item_width",
    width: 20,
    description: "개별 용기/본품 가로 길이 (단위: cm, > 0).",
  },
  {
    key: "itemDepth",
    header: "단품 세로 cm (Item Depth)",
    headerEn: "Item Depth (cm)",
    aliases: ["단품 세로 cm (item depth)", "단품 세로 (cm)", "item depth (cm)", "item depth", "item_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "item_depth",
    width: 20,
    description: "개별 용기/본품 세로(폭) 길이 (단위: cm, > 0).",
  },
  {
    key: "itemHeight",
    header: "단품 높이 cm (Item Height)",
    headerEn: "Item Height (cm)",
    aliases: ["단품 높이 cm (item height)", "단품 높이 (cm)", "item height (cm)", "item height", "item_height"],
    required: false,
    section: "Logistics",
    dbColumn: "item_height",
    width: 20,
    description: "개별 용기/본품 높이 (단위: cm, > 0).",
  },
  {
    key: "itemWeight",
    header: "단품 중량 g (Item Weight)",
    headerEn: "Item Weight (g)",
    aliases: ["단품 중량 g (item weight)", "단품 중량 (g)", "item weight (g)", "item weight", "item_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "item_weight",
    width: 20,
    description: "개별 용기/본품 순중량 (단위: g, > 0).",
  },
  {
    key: "packageWidth",
    header: "개별포장 가로 cm (Package Width)",
    headerEn: "Package Width (cm)",
    aliases: [
      "개별포장 가로 cm (package width)",
      "개별포장 가로 (cm)",
      "package width (cm)",
      "package width",
      "package_width",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_width",
    width: 22,
    description: "단상자/소포장 가로 길이 (단위: cm, > 0).",
  },
  {
    key: "packageDepth",
    header: "개별포장 세로 cm (Package Depth)",
    headerEn: "Package Depth (cm)",
    aliases: [
      "개별포장 세로 cm (package depth)",
      "개별포장 세로 (cm)",
      "package depth (cm)",
      "package depth",
      "package_depth",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_depth",
    width: 22,
    description: "단상자/소포장 세로(폭) 길이 (단위: cm, > 0).",
  },
  {
    key: "packageHeight",
    header: "개별포장 높이 cm (Package Height)",
    headerEn: "Package Height (cm)",
    aliases: [
      "개별포장 높이 cm (package height)",
      "개별포장 높이 (cm)",
      "package height (cm)",
      "package height",
      "package_height",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_height",
    width: 22,
    description: "단상자/소포장 높이 (단위: cm, > 0).",
  },
  {
    key: "packageWeight",
    header: "개별포장 중량 g (Package Weight)",
    headerEn: "Package Weight (g)",
    aliases: [
      "개별포장 중량 g (package weight)",
      "개별포장 중량 (g)",
      "package weight (g)",
      "package weight",
      "package_weight",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "package_weight",
    width: 22,
    description: "단상자 포함 개별포장 총중량 (단위: g, > 0).",
  },
  {
    key: "cartonPackQty",
    header: "카톤 입수량 ea (Carton Pack Qty)",
    headerEn: "Carton Pack Quantity (ea)",
    aliases: [
      "카톤 입수량 ea (carton pack qty)",
      "카톤 입수량 (ea)",
      "박스 입수량",
      "carton pack quantity (ea)",
      "carton pack quantity",
      "carton_pack_qty",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "carton_pack_qty",
    width: 24,
    description: "수출용 카톤(아웃박스)당 입수 수량 (양의 정수 >= 1).",
  },
  {
    key: "cartonWidth",
    header: "카톤 가로 cm (Carton Width)",
    headerEn: "Carton Width (cm)",
    aliases: ["카톤 가로 cm (carton width)", "카톤 가로 (cm)", "carton width (cm)", "carton width", "carton_width"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_width",
    width: 20,
    description: "수출용 카톤 가로 길이 (단위: cm, > 0 — 가로·세로·높이 입력 시 CBM 자동 계산).",
  },
  {
    key: "cartonDepth",
    header: "카톤 세로 cm (Carton Depth)",
    headerEn: "Carton Depth (cm)",
    aliases: ["카톤 세로 cm (carton depth)", "카톤 세로 (cm)", "carton depth (cm)", "carton depth", "carton_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_depth",
    width: 20,
    description: "수출용 카톤 세로(폭) 길이 (단위: cm, > 0).",
  },
  {
    key: "cartonHeight",
    header: "카톤 높이 cm (Carton Height)",
    headerEn: "Carton Height (cm)",
    aliases: ["카톤 높이 cm (carton height)", "카톤 높이 (cm)", "carton height (cm)", "carton height", "carton_height"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_height",
    width: 20,
    description: "수출용 카톤 높이 (단위: cm, > 0).",
  },
  {
    key: "cartonWeight",
    header: "카톤 중량 kg (Carton Weight)",
    headerEn: "Carton Weight (kg)",
    aliases: ["카톤 중량 kg (carton weight)", "카톤 중량 (kg)", "carton weight (kg)", "carton weight", "carton_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "carton_weight",
    width: 20,
    description: "수출용 카톤 총중량 (단위: kg, > 0).",
  },
  {
    key: "palletCartonQty",
    header: "파렛트 적재 박스수 (Pallet Carton Qty)",
    headerEn: "Pallet Carton Quantity (boxes)",
    aliases: [
      "파렛트 적재 박스수 (pallet carton qty)",
      "파렛트 적재 박스수",
      "pallet carton quantity (boxes)",
      "pallet carton quantity",
      "palette_carton_qty",
    ],
    required: false,
    section: "Logistics",
    dbColumn: "palette_carton_qty",
    width: 26,
    description: "1파렛트당 적재 카톤(박스) 수량 (양의 정수 >= 1).",
  },
  {
    key: "palletWidth",
    header: "파렛트 가로 cm (Pallet Width)",
    headerEn: "Pallet Width (cm)",
    aliases: ["파렛트 가로 cm (pallet width)", "파렛트 가로 (cm)", "pallet width (cm)", "pallet width", "palette_width"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_width",
    width: 22,
    description: "적재 파렛트 가로 길이 (단위: cm, > 0).",
  },
  {
    key: "palletDepth",
    header: "파렛트 세로 cm (Pallet Depth)",
    headerEn: "Pallet Depth (cm)",
    aliases: ["파렛트 세로 cm (pallet depth)", "파렛트 세로 (cm)", "pallet depth (cm)", "pallet depth", "palette_depth"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_depth",
    width: 22,
    description: "적재 파렛트 세로 길이 (단위: cm, > 0).",
  },
  {
    key: "palletHeight",
    header: "파렛트 높이 cm (Pallet Height)",
    headerEn: "Pallet Height (cm)",
    aliases: ["파렛트 높이 cm (pallet height)", "파렛트 높이 (cm)", "pallet height (cm)", "pallet height", "palette_height"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_height",
    width: 22,
    description: "적재 파렛트 높이 (단위: cm, > 0).",
  },
  {
    key: "palletWeight",
    header: "파렛트 중량 kg (Pallet Weight)",
    headerEn: "Pallet Weight (kg)",
    aliases: ["파렛트 중량 kg (pallet weight)", "파렛트 중량 (kg)", "pallet weight (kg)", "pallet weight", "palette_weight"],
    required: false,
    section: "Logistics",
    dbColumn: "palette_weight",
    width: 22,
    description: "적재 파렛트 총중량 (단위: kg, > 0).",
  },

  // 6. OPTIONAL — MEDIA URLS (+11 Columns, BA..BK)
  ...MEDIA_COLUMNS,

  // 7. OPTIONAL — COMMON PRODUCT ATTRIBUTES (+23 Columns, BL..CH)
  ...COMMON_ATTRIBUTE_COLUMNS,
];

export interface BulkReferenceBrand {
  id: string;
  name: string;
  is_active: boolean;
}

export interface BulkReferenceCategory {
  code: string;
  name_ko: string;
  name_en: string | null;
  depth: number;
  parent_code: string | null;
  is_final: boolean;
  is_active: boolean;
  display_order?: number;
}

export interface BulkReferenceCommonAttributeOption {
  optionCode: string;
  optionKo: string;
  optionEn: string | null;
  displayOrder: number;
}

export interface BulkReferenceCommonAttribute {
  code: string;
  nameKo: string;
  nameEn: string | null;
  inputType: string;
  isMultiple: boolean;
  unitSet: string | null;
  allowNa: boolean;
  allowOther: boolean;
  brandEditable: boolean;
  adminOnly: boolean;
  isActive: boolean;
  options: BulkReferenceCommonAttributeOption[];
}

export interface BulkNormalizedAttributeEntry {
  attribute_code: string;
  value_json: string | string[];
  text_value: string | null;
}

export interface BulkNormalizedImageUrlItem {
  url: string;
  columnHeader: string;
  slotNumber: number; // 1 = Main Image, 2..10 = Additional Image 2..10
}

export interface BulkNormalizedProductPayload {
  brand_id: string;
  brand_name: string;
  manufacture_sku: string;
  name: string;
  name_en: string;
  category: ProductCategory;
  category_code: string | null;
  category_display_path: string;
  volume: string | null;
  origin: string | null;
  lead_time: string | null;
  color: string | null;
  color_map: string | null;
  description: string | null;
  bullet_points: string[];
  how_to_use: string | null;
  ingredients_text: string | null;
  parent_sku: string | null;
  child_sku: string | null;
  upc: string | null;
  ean: string | null;
  selling_online: boolean;
  selling_offline: boolean;
  sales_link_1: string | null;
  sales_link_2: string | null;
  price_krw_retail: number | null;
  price_krw_wholesale: number | null;
  estimated_retail_price: number | null;
  price_usd_fob: number | null;
  item_width: number | null;
  item_depth: number | null;
  item_height: number | null;
  item_weight: number | null;
  package_width: number | null;
  package_depth: number | null;
  package_height: number | null;
  package_weight: number | null;
  carton_pack_qty: number | null;
  carton_width: number | null;
  carton_depth: number | null;
  carton_height: number | null;
  carton_weight: number | null;
  carton_cbm: number | null;
  palette_carton_qty: number | null;
  palette_width: number | null;
  palette_depth: number | null;
  palette_height: number | null;
  palette_weight: number | null;
  // R2 Extensions
  image_urls: BulkNormalizedImageUrlItem[];
  product_video_url: string | null;
  common_attributes: BulkNormalizedAttributeEntry[];
}

export type BulkRowValidationStatus = "VALID" | "WARNING" | "INVALID";

export interface BulkValidatedRow {
  excelRowNumber: number;
  status: BulkRowValidationStatus;
  rawBrand: string;
  rawManufactureSku: string;
  rawProductNameEn: string;
  rawCategory1Depth: string;
  normalizedCategoryPath: string;
  errors: string[];
  warnings: string[];
  correctiveGuidance: string[];
  isDuplicateError: boolean;
  isValidationError: boolean;
  hasCategoryError: boolean;
  hasCommonAttributeError: boolean;
  hasMediaUrlError: boolean;
  imageUrlCount: number;
  hasVideoUrl: boolean;
  commonAttributeCount: number;
  payload: BulkNormalizedProductPayload | null;
}

export interface BulkPreviewSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  importableRows: number; // validRows + warningRows
  invalidRows: number;
  duplicateRows: number;
  validationErrorRows: number;
  categoryErrorRows: number;
  commonAttributeErrorRows: number;
  mediaUrlErrorRows: number;
  rowsWithMediaCount: number;
  totalImageUrlsCount: number;
  rowsWithVideoCount: number;
  rowsWithCommonAttrsCount: number;
  exampleRowsSkipped: number;
}

export interface BulkPreviewResult {
  success: boolean;
  error?: string;
  fileName?: string;
  batchFingerprint?: string;
  summary?: BulkPreviewSummary;
  rows?: BulkValidatedRow[];
}

export interface BulkRejectedRowItem {
  excelRowNumber: number;
  manufactureSku: string;
  productName: string;
  errorReason: string;
  correctiveGuidance: string;
  isDuplicate: boolean;
}

export interface BulkPendingMediaTask {
  excelRowNumber: number;
  productId: string;
  manufactureSku: string;
  productNameEn: string;
  imageUrls: BulkNormalizedImageUrlItem[];
}

export interface BulkMediaFailureItem {
  excelRowNumber: number;
  productId: string;
  manufactureSku: string;
  productNameEn: string;
  columnHeader: string;
  slotNumber: number;
  url: string;
  errorReason: string;
  correctiveGuidance: string;
}

export interface BulkMediaBatchResult {
  success: boolean;
  error?: string;
  processedProducts: number;
  imagesImportedCount: number;
  duplicatesSkippedCount: number;
  failures: BulkMediaFailureItem[];
  retryTasks: BulkPendingMediaTask[];
}

export interface BulkImportExecutionResult {
  success: boolean;
  error?: string;
  totalUploadedRows: number;
  createdCount: number;
  rejectedCount: number;
  duplicateCount: number;
  validationErrorCount: number;
  commonAttributesSavedCount: number;
  videosImportedCount: number;
  createdProductIds: string[];
  rejectedRows: BulkRejectedRowItem[];
  pendingMediaTasks: BulkPendingMediaTask[];
  mediaFailures: BulkMediaFailureItem[];
  errorReportBase64?: string | null;
  errorReportFilename?: string | null;
}
