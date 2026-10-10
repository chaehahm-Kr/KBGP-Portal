import { createAdminClient } from "@/lib/supabase/admin";

export interface ProductSpecificationItem {
  code: string;
  name: string; // English Name
  nameKo: string;
  group: string; // English Group
  groupKo: string;
  value: string; // Formatted English value
  displayOrder: number;
}

export interface ProductSpecificationGroup {
  group: string;
  groupKo: string;
  items: ProductSpecificationItem[];
}

/**
 * Authoritative English Group Mapping for Attribute Master Groups
 */
const GROUP_NAME_MAP_EN: Record<string, string> = {
  "기본 정보": "Product Characteristics",
  "제품 특성": "Product Characteristics",
  "대상 고객": "Target Audience",
  "패키지 및 제품 형태": "Packaging & Format",
  "패키지/도구": "Packaging & Applicator",
  "유통 및 보관": "Storage & Shelf Life",
  "사용 정보": "Usage & Application",
  "사용 방법": "Usage & Application",
  "사용감": "Texture & Experience",
  "클렌징": "Cleansing & Texture",
  "선케어": "Sun Protection",
  "헤어": "Hair & Scalp",
  "스타일링": "Hair Styling",
  "성능": "Performance & Claims",
  "기능성": "Performance & Claims",
  "오럴케어": "Oral Care",
  "퍼스널케어": "Personal Care",
  "색상": "Color & Shade",
  "적합성": "Compatibility & Safety",
  "세트": "Set Configuration",
  "규제 및 등록": "Regulatory & Compliance",
  "규제/클레임": "Regulatory & Claims",
  "성분/안전": "Ingredients & Safety",
  "인증/클레임": "Certifications & Claims",
  "수출/인증": "Export & Certifications",
  "기타": "Additional Specifications",
};

/**
 * Standard Group Ordering for Logical Display in Specifications Tab
 */
const GROUP_ORDER_WEIGHT: Record<string, number> = {
  "Product Characteristics": 10,
  "Target Audience": 20,
  "Packaging & Format": 30,
  "Packaging & Applicator": 35,
  "Texture & Experience": 40,
  "Cleansing & Texture": 45,
  "Usage & Application": 50,
  "Sun Protection": 60,
  "Hair & Scalp": 70,
  "Hair Styling": 75,
  "Performance & Claims": 80,
  "Color & Shade": 85,
  "Oral Care": 90,
  "Personal Care": 95,
  "Storage & Shelf Life": 100,
  "Compatibility & Safety": 110,
  "Regulatory & Compliance": 120,
  "Regulatory & Claims": 125,
  "Ingredients & Safety": 130,
  "Certifications & Claims": 140,
  "Export & Certifications": 150,
  "Set Configuration": 160,
  "Additional Specifications": 200,
};

/**
 * Format numeric values with specific units into English labels
 */
function formatUnitValue(val: any, unitSet: string | null | undefined): string | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  const isNum = !isNaN(num);
  const u = (unitSet || "").toUpperCase().trim();

  switch (u) {
    case "MONTH":
      return isNum ? `${num} ${num === 1 ? "Month" : "Months"}` : `${val} Months`;
    case "HOUR":
      return isNum ? `${num} ${num === 1 ? "Hour" : "Hours"}` : `${val} Hours`;
    case "DAY":
      return isNum ? `${num} ${num === 1 ? "Day" : "Days"}` : `${val} Days`;
    case "YEAR":
      return isNum ? `${num} ${num === 1 ? "Year" : "Years"}` : `${val} Years`;
    case "CELSIUS":
      return `${val}°C`;
    case "FAHRENHEIT":
      return `${val}°F`;
    case "ML":
      return `${val} ml`;
    case "G":
      return `${val} g`;
    case "OZ":
      return `${val} oz`;
    case "PERCENT":
      return `${val}%`;
    case "EA":
    case "COUNT":
      return isNum ? `${num} ${num === 1 ? "unit" : "units"}` : `${val} units`;
    default:
      return unitSet ? `${val} ${unitSet}` : String(val);
  }
}

/**
 * Resolve English value for any raw attribute value
 */
function formatEnglishSpecificationValue(
  rawVal: any,
  attr: {
    code: string;
    input_type?: string;
    unit_set?: string | null;
  },
  optionsMap: Map<string, Array<{ option_code: string; option_ko: string; option_en: string | null }>>
): string | null {
  if (rawVal === null || rawVal === undefined) return null;
  if (typeof rawVal === "string" && rawVal.trim() === "") return null;

  const inputType = attr.input_type || "TEXT";
  const unitSet = attr.unit_set;
  const attrOptions = optionsMap.get(attr.code) || [];

  const resolveOptionEn = (code: any): string | null => {
    if (code === null || code === undefined || code === "") return null;
    const strCode = String(code).trim().toUpperCase();

    // Filter meaningless NA / Unknown options
    if (strCode === "NA" || strCode === "N/A" || strCode === "UNKNOWN" || strCode === "NOT_APPLICABLE") {
      return null;
    }

    const opt = attrOptions.find((o) => o.option_code === strCode);
    if (opt) {
      const en = opt.option_en?.trim();
      if (en && en.toUpperCase() !== "NA" && en.toUpperCase() !== "N/A") return en;
      return opt.option_ko || opt.option_code;
    }

    // Fallback: title-case snake_case codes
    return String(code)
      .split(/[_\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  switch (inputType) {
    case "YES_NO_NA":
    case "YES_NO_UNKNOWN": {
      const v = String(rawVal).toUpperCase().trim();
      if (v === "YES" || v === "TRUE" || rawVal === true) return "Yes";
      if (v === "NO" || v === "FALSE" || rawVal === false) return "No";
      // Filter out NA, UNKNOWN
      return null;
    }

    case "SINGLE_SELECT": {
      const code = Array.isArray(rawVal) ? rawVal[0] : rawVal;
      return resolveOptionEn(code);
    }

    case "MULTI_SELECT": {
      let codes: any[] = [];
      if (Array.isArray(rawVal)) {
        codes = rawVal;
      } else if (typeof rawVal === "string") {
        try {
          const parsed = JSON.parse(rawVal);
          codes = Array.isArray(parsed) ? parsed : [rawVal];
        } catch {
          codes = rawVal.split(",").map((s) => s.trim());
        }
      }
      const labels = codes.map(resolveOptionEn).filter(Boolean) as string[];
      return labels.length > 0 ? labels.join(", ") : null;
    }

    case "NUMBER_UNIT": {
      return formatUnitValue(rawVal, unitSet);
    }

    case "NUMBER_RANGE": {
      if (Array.isArray(rawVal) && rawVal.length >= 2) {
        const [min, max] = rawVal;
        if (min !== null && min !== "" && max !== null && max !== "") {
          return `${min} - ${max}`;
        } else if (min !== null && min !== "") {
          return `${min}`;
        } else if (max !== null && max !== "") {
          return `${max}`;
        }
      }
      return String(rawVal).trim() || null;
    }

    case "NUMBER_RANGE_UNIT": {
      if (Array.isArray(rawVal) && rawVal.length >= 2) {
        const [min, max] = rawVal;
        if (unitSet === "CELSIUS") {
          return `${min}°C - ${max}°C`;
        }
        return `${min} - ${max} ${unitSet || ""}`.trim();
      }
      return formatUnitValue(rawVal, unitSet);
    }

    case "NUMBER": {
      return String(rawVal).trim() || null;
    }

    case "TEXT":
    case "TEXT_AREA":
    default: {
      if (Array.isArray(rawVal)) {
        const filtered = rawVal.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
        return filtered.length > 0 ? filtered.join(", ") : null;
      }
      const str = String(rawVal).trim();
      if (!str || str.toUpperCase() === "NA" || str.toUpperCase() === "N/A" || str.toUpperCase() === "NULL") {
        return null;
      }
      return str;
    }
  }
}

/**
 * Fetch and resolve English specifications for Retailer Product Detail view
 */
export async function getRetailerProductSpecifications(
  productId: string,
  categoryCode?: string | null,
  customClient?: any
): Promise<ProductSpecificationGroup[]> {
  try {
    const supabase = customClient || createAdminClient();

    // 1. Fetch all product attribute values for this product
    const { data: pavRows, error: pavError } = await supabase
      .from("product_attribute_values")
      .select("attribute_code, value_json, text_value")
      .eq("product_id", productId);

    if (pavError || !pavRows || pavRows.length === 0) {
      return [];
    }

    // 2. Fetch attribute definitions
    // Query attributes that are active, not admin_only, and retailer_visible
    const { data: attrRows, error: attrError } = await supabase
      .from("attributes")
      .select("code, name_ko, name_en, scope, attr_group, input_type, unit_set, admin_only, display_order, is_active")
      .eq("is_active", true)
      .eq("admin_only", false);

    if (attrError || !attrRows || attrRows.length === 0) {
      return [];
    }

    const attrCodes = attrRows.map((a: any) => a.code);

    // 3. Fetch attribute options for select types
    const { data: optRows } = await supabase
      .from("attribute_options")
      .select("attribute_code, option_code, option_ko, option_en, display_order")
      .in("attribute_code", attrCodes)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    const optionsMap = new Map<string, Array<{ option_code: string; option_ko: string; option_en: string | null }>>();
    (optRows || []).forEach((o: any) => {
      if (!optionsMap.has(o.attribute_code)) {
        optionsMap.set(o.attribute_code, []);
      }
      optionsMap.get(o.attribute_code)!.push(o);
    });

    const attrsMap = new Map<string, any>();
    attrRows.forEach((a: any) => attrsMap.set(a.code, a));

    // 4. Resolve each product attribute value
    const resolvedItems: ProductSpecificationItem[] = [];

    for (const pav of pavRows) {
      const attr = attrsMap.get(pav.attribute_code);
      if (!attr) continue;

      // Filter: admin_only and retailer_visible
      if (attr.admin_only) continue;
      if (attr.retailer_visible === false) continue;

      const rawVal =
        pav.value_json !== null && pav.value_json !== undefined ? pav.value_json : pav.text_value;
      const formattedVal = formatEnglishSpecificationValue(rawVal, attr, optionsMap);

      if (!formattedVal) continue;

      const groupKo = attr.attr_group || "기타";
      const groupEn = GROUP_NAME_MAP_EN[groupKo] || groupKo || "Additional Specifications";
      const nameKo = attr.name_ko;
      const nameEn = attr.name_en?.trim() || nameKo;

      resolvedItems.push({
        code: attr.code,
        name: nameEn,
        nameKo,
        group: groupEn,
        groupKo,
        value: formattedVal,
        displayOrder: attr.display_order ?? 10,
      });
    }

    if (resolvedItems.length === 0) {
      return [];
    }

    // 5. Group by English group and sort
    const groupMap = new Map<string, { group: string; groupKo: string; items: ProductSpecificationItem[] }>();

    for (const item of resolvedItems) {
      if (!groupMap.has(item.group)) {
        groupMap.set(item.group, {
          group: item.group,
          groupKo: item.groupKo,
          items: [],
        });
      }
      groupMap.get(item.group)!.items.push(item);
    }

    // Sort items within each group by displayOrder
    const groups = Array.from(groupMap.values()).map((g) => {
      g.items.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
      return g;
    });

    // Sort groups by group order weight
    groups.sort((a, b) => {
      const weightA = GROUP_ORDER_WEIGHT[a.group] ?? 100;
      const weightB = GROUP_ORDER_WEIGHT[b.group] ?? 100;
      return weightA - weightB || a.group.localeCompare(b.group);
    });

    return groups;
  } catch (err) {
    console.error("Failed to getRetailerProductSpecifications:", err);
    return [];
  }
}
