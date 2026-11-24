"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { verifyAdminSession } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import { requireMenuPermission } from "@/lib/company/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import { validateShippingOriginInput } from "@/lib/compliance/v1-validators";
import {
  type LocationType,
  LOCATION_TYPES,
  isShippingCapableLocation,
  isManufacturingCapableLocation,
  type ManufacturingFacilityComplianceRecord,
} from "@/lib/compliance/v1-types";
import { isComplianceV1Enabled } from "@/lib/compliance/v1-feature-gate";

/**
 * DATA-JSON-CLEAN-003: 출고지는 company_shipping_origins 테이블(0137)만 저장소다.
 * KSN-CMP-004: 출고지 및 제조시설 통합 관리 확장 (0200)
 */
const LEGACY_ORIGIN_COLUMNS = [
  "id", "company_id", "name", "is_default", "contact_name", "phone", "email", "country",
  "address_line1", "address_line2", "city", "state_province", "postal_code", "status", "notes",
  "created_at", "updated_at", "created_by", "updated_by",
] as const;

const ORIGIN_TABLE_COLUMNS = [
  ...LEGACY_ORIGIN_COLUMNS,
  "location_type", "is_default_manufacturing", "facility_code",
  "manufacturer_legal_name_en", "manufacturer_name_ko", "contact_name_en",
] as const;

/**
 * 테이블에 쓸 칸만 남긴다. 목록 조회 때 덧붙는 warehouse_* 또는 compliance 같은 표시용 값이 섞이면
 * update 가 "column does not exist" 로 조용히 실패해 테이블만 예전 값으로 남는다.
 * Feature Gate: 릴리즈 전에는 레거시 컬럼만 저장하여 0200 미적용 프로덕션 DB와 100% 호환 보장.
 */
function toOriginRow(record: CompanyShippingOrigin): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const activeCols = isComplianceV1Enabled() ? ORIGIN_TABLE_COLUMNS : LEGACY_ORIGIN_COLUMNS;
  for (const col of activeCols) {
    if ((record as any)[col] !== undefined) row[col] = (record as any)[col];
  }
  return row;
}

function originsTable(admin: ReturnType<typeof createAdminClient>) {
  return admin.from("company_shipping_origins");
}

function assertOriginWrite(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(`출고지 저장 실패: ${result.error.message}`);
}

export interface CompanyShippingOrigin {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  contact_name: string;
  phone: string;
  email: string;
  country: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province?: string;
  postal_code: string;
  status: "active" | "inactive";
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  warehouse_id?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  warehouse_type?: string | null;

  // KSN-CMP-004: Unified Location Extensions
  location_type?: LocationType;
  is_default_manufacturing?: boolean;
  facility_code?: string | null;
  manufacturer_legal_name_en?: string | null;
  manufacturer_name_ko?: string | null;
  contact_name_en?: string | null;
  compliance?: ManufacturingFacilityComplianceRecord | null;
}

export interface ShippingOriginInput {
  name: string;
  is_default?: boolean;
  contact_name?: string;
  phone?: string;
  email?: string;
  country: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province?: string;
  postal_code: string;
  status?: "active" | "inactive";
  notes?: string;

  // KSN-CMP-004: Unified Location Extensions
  location_type?: LocationType;
  is_default_manufacturing?: boolean;
  facility_code?: string | null;
  manufacturer_legal_name_en?: string | null;
  manufacturer_name_ko?: string | null;
  contact_name_en?: string | null;
}


/**
 * Fetch all shipping origins (or unified locations) for a specific company.
 * - By default (includeManufacturingOnly != true), returns ONLY shipping-capable locations
 *   (SHIPPING_ORIGIN or SHIPPING_AND_MANUFACTURING) to protect Purchase Orders, Shipments & Warehouse links.
 * - When includeManufacturingOnly is true, returns all locations (shipping + manufacturing) with compliance metadata.
 */
export async function getCompanyShippingOrigins(
  companyId: string,
  options?: { includeManufacturingOnly?: boolean }
): Promise<CompanyShippingOrigin[]> {
  if (!companyId) return [];

  const admin = createAdminClient();
  let rawOrigins: CompanyShippingOrigin[] = [];

  try {
    const { data, error } = await originsTable(admin)
      .select("*")
      .eq("company_id", companyId)
      .order("is_default_manufacturing", { ascending: false })
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      rawOrigins = data as CompanyShippingOrigin[];
    }
  } catch (e) {
    try {
      const { data, error } = await originsTable(admin)
        .select("*")
        .eq("company_id", companyId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (!error && data) {
        rawOrigins = data as CompanyShippingOrigin[];
      }
    } catch (e2) {}
  }

  // Enrich manufacturing-capable locations with 1:1 compliance record
  try {
    const mfgIds = rawOrigins
      .filter((o) => isManufacturingCapableLocation(o.location_type))
      .map((o) => o.id);

    if (mfgIds.length > 0) {
      const { data: compRows } = await admin
        .from("manufacturing_facility_compliance")
        .select("*")
        .in("facility_id", mfgIds);

      if (compRows && compRows.length > 0) {
        const cMap = new Map(compRows.map((c: any) => [c.facility_id, c]));
        rawOrigins = rawOrigins.map((o) => ({
          ...o,
          compliance: cMap.get(o.id) || null,
        }));
      }
    }
  } catch (e) {}

  // Enrich with warehouse link info
  try {
    const { data: whList } = await admin
      .from("warehouses")
      .select("id, code, name, type, internal_note");

    if (whList && whList.length > 0) {
      rawOrigins = rawOrigins.map((origin) => {
        const linkedWh = whList.find(
          (wh: any) =>
            (wh.shipping_origin_id && wh.shipping_origin_id === origin.id) ||
            (wh.internal_note && wh.internal_note.includes(`[ORIGIN_ID:${origin.id}]`))
        );
        if (linkedWh) {
          return {
            ...origin,
            warehouse_id: linkedWh.id,
            warehouse_code: linkedWh.code,
            warehouse_name: linkedWh.name,
            warehouse_type: linkedWh.type,
          };
        }
        return origin;
      });
    }
  } catch (e) {}

  // Filter out manufacturing-only locations for shipping workflows unless explicitly requested
  if (!options?.includeManufacturingOnly) {
    rawOrigins = rawOrigins.filter((o) => isShippingCapableLocation(o.location_type));
  }

  return rawOrigins;
}

/**
 * Admin: Create a new shipping origin or manufacturing facility for a company
 */
export async function adminCreateShippingOrigin(
  companyId: string,
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const session = await verifyAdminSession();
  validateShippingOriginInput(input);

  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const isFirst = existingOrigins.length === 0;
  const locType: LocationType = input.location_type || "SHIPPING_ORIGIN";
  const isShip = isShippingCapableLocation(locType);
  const isMfg = isManufacturingCapableLocation(locType);

  const willBeDefault = isShip ? (input.is_default !== undefined ? input.is_default : isFirst) : false;
  const willBeDefaultMfg = isMfg ? Boolean(input.is_default_manufacturing) : false;

  const admin = createAdminClient();
  let facilityCode = input.facility_code || null;
  if (isMfg && !facilityCode) {
    try {
      const { data: codeData } = await admin.rpc("next_company_facility_code", {
        p_company_id: companyId,
      });
      if (codeData) facilityCode = String(codeData);
    } catch (e) {}
  }

  const now = new Date().toISOString();
  const newRecord: CompanyShippingOrigin = {
    id: crypto.randomUUID(),
    company_id: companyId,
    name: input.name.trim(),
    is_default: willBeDefault,
    is_default_manufacturing: willBeDefaultMfg,
    location_type: locType,
    facility_code: facilityCode,
    manufacturer_legal_name_en: input.manufacturer_legal_name_en?.trim() || null,
    manufacturer_name_ko: input.manufacturer_name_ko?.trim() || null,
    contact_name: (input.contact_name || "").trim(),
    contact_name_en: input.contact_name_en?.trim() || (input.contact_name || "").trim() || null,
    phone: (input.phone || "").trim(),
    email: (input.email || "").trim(),
    country: formatCanonicalCountryName(input.country) || "South Korea",
    address_line1: input.address_line1.trim(),
    address_line2: (input.address_line2 || "").trim(),
    city: input.city.trim(),
    state_province: (input.state_province || "").trim(),
    postal_code: input.postal_code.trim(),
    status: input.status || "active",
    notes: (input.notes || "").trim(),
    created_at: now,
    updated_at: now,
    created_by: session.userId,
    updated_by: session.userId,
  };

  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }
  if (willBeDefaultMfg) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default_manufacturing: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .insert(toOriginRow(newRecord)));

  if (isMfg) {
    try {
      await admin.from("manufacturing_facility_compliance").insert({
        facility_id: newRecord.id,
        company_id: companyId,
        updated_by: session.userId,
      });
    } catch (e) {}
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: newRecord };
}

/**
 * Brand Portal: Create a new shipping origin or manufacturing facility for logged-in company
 */
export async function portalCreateShippingOrigin(
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");
  validateShippingOriginInput(input);

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const isFirst = existingOrigins.length === 0;
  const locType: LocationType = input.location_type || "SHIPPING_ORIGIN";
  const isShip = isShippingCapableLocation(locType);
  const isMfg = isManufacturingCapableLocation(locType);

  const willBeDefault = isShip ? (input.is_default !== undefined ? input.is_default : isFirst) : false;
  const willBeDefaultMfg = isMfg ? Boolean(input.is_default_manufacturing) : false;

  const admin = createAdminClient();
  let facilityCode = input.facility_code || null;
  if (isMfg && !facilityCode) {
    try {
      const { data: codeData } = await admin.rpc("next_company_facility_code", {
        p_company_id: companyId,
      });
      if (codeData) facilityCode = String(codeData);
    } catch (e) {}
  }

  const now = new Date().toISOString();
  const newRecord: CompanyShippingOrigin = {
    id: crypto.randomUUID(),
    company_id: companyId,
    name: input.name.trim(),
    is_default: willBeDefault,
    is_default_manufacturing: willBeDefaultMfg,
    location_type: locType,
    facility_code: facilityCode,
    manufacturer_legal_name_en: input.manufacturer_legal_name_en?.trim() || null,
    manufacturer_name_ko: input.manufacturer_name_ko?.trim() || null,
    contact_name: (input.contact_name || "").trim(),
    contact_name_en: input.contact_name_en?.trim() || (input.contact_name || "").trim() || null,
    phone: (input.phone || "").trim(),
    email: (input.email || "").trim(),
    country: formatCanonicalCountryName(input.country) || "South Korea",
    address_line1: input.address_line1.trim(),
    address_line2: (input.address_line2 || "").trim(),
    city: input.city.trim(),
    state_province: (input.state_province || "").trim(),
    postal_code: input.postal_code.trim(),
    status: input.status || "active",
    notes: (input.notes || "").trim(),
    created_at: now,
    updated_at: now,
    created_by: membership.userId,
    updated_by: membership.userId,
  };

  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }
  if (willBeDefaultMfg) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default_manufacturing: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .insert(toOriginRow(newRecord)));

  if (isMfg) {
    try {
      await admin.from("manufacturing_facility_compliance").insert({
        facility_id: newRecord.id,
        company_id: companyId,
        updated_by: membership.userId,
      });
    } catch (e) {}
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: newRecord };
}

/**
 * Admin: Update an existing shipping origin or manufacturing facility
 */
export async function adminUpdateShippingOrigin(
  id: string,
  companyId: string,
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const session = await verifyAdminSession();
  validateShippingOriginInput(input);

  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("수정하려는 출고지 또는 제조시설 정보를 찾을 수 없습니다.");
  }

  const admin = createAdminClient();
  const nextType: LocationType = input.location_type || target.location_type || "SHIPPING_ORIGIN";

  // Incompatible type change protection
  if (isManufacturingCapableLocation(target.location_type) && nextType === "SHIPPING_ORIGIN") {
    const { data: linkedProds } = await admin
      .from("product_manufacturing_facilities")
      .select("product_id")
      .eq("facility_id", id);
    if (linkedProds && linkedProds.length > 0) {
      throw new Error(
        `이 제조시설은 ${linkedProds.length}개 제품에 연결되어 있어 출고지 전용(SHIPPING_ORIGIN)으로 변경할 수 없습니다.`
      );
    }
  }

  if (isShippingCapableLocation(target.location_type) && nextType === "MANUFACTURING_FACILITY") {
    const { data: linkedWh } = await admin
      .from("warehouses")
      .select("id, code, name")
      .or(`shipping_origin_id.eq.${id},internal_note.ilike.%[ORIGIN_ID:${id}]%`)
      .limit(1);
    if (linkedWh && linkedWh.length > 0) {
      throw new Error(
        `이 출고지는 물류창고(${linkedWh[0].code} · ${linkedWh[0].name})와 연동되어 있어 제조시설 전용으로 변경할 수 없습니다.`
      );
    }
  }

  const isShip = isShippingCapableLocation(nextType);
  const isMfg = isManufacturingCapableLocation(nextType);

  let facilityCode = target.facility_code || null;
  if (isMfg && !facilityCode) {
    try {
      const { data: codeData } = await admin.rpc("next_company_facility_code", {
        p_company_id: companyId,
      });
      if (codeData) facilityCode = String(codeData);
    } catch (e) {}
  }

  const now = new Date().toISOString();
  const willBeDefault = isShip
    ? (input.is_default !== undefined ? input.is_default : target.is_default)
    : false;
  const willBeDefaultMfg = isMfg
    ? (input.is_default_manufacturing !== undefined ? input.is_default_manufacturing : target.is_default_manufacturing)
    : false;

  const updatedRecord: CompanyShippingOrigin = {
    ...target,
    name: input.name.trim(),
    is_default: willBeDefault,
    is_default_manufacturing: willBeDefaultMfg,
    location_type: nextType,
    facility_code: facilityCode,
    manufacturer_legal_name_en: input.manufacturer_legal_name_en !== undefined ? input.manufacturer_legal_name_en?.trim() || null : target.manufacturer_legal_name_en,
    manufacturer_name_ko: input.manufacturer_name_ko !== undefined ? input.manufacturer_name_ko?.trim() || null : target.manufacturer_name_ko,
    contact_name: (input.contact_name || "").trim(),
    contact_name_en: input.contact_name_en?.trim() || (input.contact_name || "").trim() || target.contact_name_en || null,
    phone: (input.phone || "").trim(),
    email: (input.email || "").trim(),
    country: formatCanonicalCountryName(input.country) || "South Korea",
    address_line1: input.address_line1.trim(),
    address_line2: (input.address_line2 || "").trim(),
    city: input.city.trim(),
    state_province: (input.state_province || "").trim(),
    postal_code: input.postal_code.trim(),
    status: input.status || target.status || "active",
    notes: (input.notes || "").trim(),
    updated_at: now,
    updated_by: session.userId,
  };

  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }
  if (willBeDefaultMfg) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default_manufacturing: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .update(toOriginRow(updatedRecord))
    .eq("id", id));

  if (isMfg) {
    try {
      const { data: compExists } = await admin
        .from("manufacturing_facility_compliance")
        .select("facility_id")
        .eq("facility_id", id)
        .maybeSingle();
      if (!compExists) {
        await admin.from("manufacturing_facility_compliance").insert({
          facility_id: id,
          company_id: companyId,
          updated_by: session.userId,
        });
      }
    } catch (e) {}
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: updatedRecord };
}

/**
 * Brand Portal: Update an existing shipping origin or manufacturing facility for logged-in company
 */
export async function portalUpdateShippingOrigin(
  id: string,
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");
  validateShippingOriginInput(input);

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("수정하려는 출고지 또는 제조시설 정보를 찾을 수 없습니다.");
  }
  if (target.company_id !== companyId) {
    throw new Error("소속 회사의 출고지 및 제조시설만 수정할 수 있습니다.");
  }

  const admin = createAdminClient();
  const nextType: LocationType = input.location_type || target.location_type || "SHIPPING_ORIGIN";

  // Incompatible type change protection
  if (isManufacturingCapableLocation(target.location_type) && nextType === "SHIPPING_ORIGIN") {
    const { data: linkedProds } = await admin
      .from("product_manufacturing_facilities")
      .select("product_id")
      .eq("facility_id", id);
    if (linkedProds && linkedProds.length > 0) {
      throw new Error(
        `이 제조시설은 ${linkedProds.length}개 제품에 연결되어 있어 출고지 전용(SHIPPING_ORIGIN)으로 변경할 수 없습니다.`
      );
    }
  }

  if (isShippingCapableLocation(target.location_type) && nextType === "MANUFACTURING_FACILITY") {
    const { data: linkedWh } = await admin
      .from("warehouses")
      .select("id, code, name")
      .or(`shipping_origin_id.eq.${id},internal_note.ilike.%[ORIGIN_ID:${id}]%`)
      .limit(1);
    if (linkedWh && linkedWh.length > 0) {
      throw new Error(
        `이 출고지는 물류창고(${linkedWh[0].code} · ${linkedWh[0].name})와 연동되어 있어 제조시설 전용으로 변경할 수 없습니다.`
      );
    }
  }

  const isShip = isShippingCapableLocation(nextType);
  const isMfg = isManufacturingCapableLocation(nextType);

  let facilityCode = target.facility_code || null;
  if (isMfg && !facilityCode) {
    try {
      const { data: codeData } = await admin.rpc("next_company_facility_code", {
        p_company_id: companyId,
      });
      if (codeData) facilityCode = String(codeData);
    } catch (e) {}
  }

  const now = new Date().toISOString();
  const willBeDefault = isShip
    ? (input.is_default !== undefined ? input.is_default : target.is_default)
    : false;
  const willBeDefaultMfg = isMfg
    ? (input.is_default_manufacturing !== undefined ? input.is_default_manufacturing : target.is_default_manufacturing)
    : false;

  const updatedRecord: CompanyShippingOrigin = {
    ...target,
    name: input.name.trim(),
    is_default: willBeDefault,
    is_default_manufacturing: willBeDefaultMfg,
    location_type: nextType,
    facility_code: facilityCode,
    manufacturer_legal_name_en: input.manufacturer_legal_name_en !== undefined ? input.manufacturer_legal_name_en?.trim() || null : target.manufacturer_legal_name_en,
    manufacturer_name_ko: input.manufacturer_name_ko !== undefined ? input.manufacturer_name_ko?.trim() || null : target.manufacturer_name_ko,
    contact_name: (input.contact_name || "").trim(),
    contact_name_en: input.contact_name_en?.trim() || (input.contact_name || "").trim() || target.contact_name_en || null,
    phone: (input.phone || "").trim(),
    email: (input.email || "").trim(),
    country: formatCanonicalCountryName(input.country) || "South Korea",
    address_line1: input.address_line1.trim(),
    address_line2: (input.address_line2 || "").trim(),
    city: input.city.trim(),
    state_province: (input.state_province || "").trim(),
    postal_code: input.postal_code.trim(),
    status: input.status || target.status || "active",
    notes: (input.notes || "").trim(),
    updated_at: now,
    updated_by: membership.userId,
  };

  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }
  if (willBeDefaultMfg) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default_manufacturing: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .update(toOriginRow(updatedRecord))
    .eq("id", id));

  if (isMfg) {
    try {
      const { data: compExists } = await admin
        .from("manufacturing_facility_compliance")
        .select("facility_id")
        .eq("facility_id", id)
        .maybeSingle();
      if (!compExists) {
        await admin.from("manufacturing_facility_compliance").insert({
          facility_id: id,
          company_id: companyId,
          updated_by: membership.userId,
        });
      }
    } catch (e) {}
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: updatedRecord };
}

/**
 * Admin: Set default shipping origin
 */
export async function adminSetDefaultShippingOrigin(
  id: string,
  companyId: string
): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target || !isShippingCapableLocation(target.location_type)) {
    throw new Error("유효한 출고지 정보를 찾을 수 없습니다.");
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  assertOriginWrite(await originsTable(admin)
    .update({ is_default: false, updated_at: now })
    .eq("company_id", companyId));

  assertOriginWrite(await originsTable(admin)
    .update({ is_default: true, updated_at: now, updated_by: session.userId })
    .eq("id", id));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Brand Portal: Set default shipping origin for logged-in company
 */
export async function portalSetDefaultShippingOrigin(
  id: string
): Promise<{ success: boolean }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target || !isShippingCapableLocation(target.location_type)) {
    throw new Error("유효한 출고지 정보를 찾을 수 없습니다.");
  }
  if (target.company_id !== companyId) {
    throw new Error("소속 회사의 출고지만 변경할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  assertOriginWrite(await originsTable(admin)
    .update({ is_default: false, updated_at: now })
    .eq("company_id", companyId));

  assertOriginWrite(await originsTable(admin)
    .update({ is_default: true, updated_at: now, updated_by: membership.userId })
    .eq("id", id));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Admin: Set default manufacturing facility
 */
export async function adminSetDefaultManufacturingFacility(
  id: string,
  companyId: string
): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target || !isManufacturingCapableLocation(target.location_type)) {
    throw new Error("제조시설 정보를 찾을 수 없거나 제조 가능한 시설이 아닙니다.");
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  assertOriginWrite(await originsTable(admin)
    .update({ is_default_manufacturing: false, updated_at: now })
    .eq("company_id", companyId));

  assertOriginWrite(await originsTable(admin)
    .update({ is_default_manufacturing: true, updated_at: now, updated_by: session.userId })
    .eq("id", id));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Brand Portal: Set default manufacturing facility for logged-in company
 */
export async function portalSetDefaultManufacturingFacility(
  id: string
): Promise<{ success: boolean }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target || !isManufacturingCapableLocation(target.location_type)) {
    throw new Error("제조시설 정보를 찾을 수 없거나 제조 가능한 시설이 아닙니다.");
  }
  if (target.company_id !== companyId) {
    throw new Error("소속 회사의 제조시설만 변경할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  assertOriginWrite(await originsTable(admin)
    .update({ is_default_manufacturing: false, updated_at: now })
    .eq("company_id", companyId));

  assertOriginWrite(await originsTable(admin)
    .update({ is_default_manufacturing: true, updated_at: now, updated_by: membership.userId })
    .eq("id", id));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Admin: Delete a shipping origin or manufacturing facility
 */
export async function adminDeleteShippingOrigin(
  id: string,
  companyId: string
): Promise<{ success: boolean }> {
  await verifyAdminSession();
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("삭제하려는 출고지 또는 제조시설 정보를 찾을 수 없습니다.");
  }

  const admin = createAdminClient();

  // Check if linked to products
  try {
    const { data: linkedProds } = await admin
      .from("product_manufacturing_facilities")
      .select("product_id, products(id, manufacture_sku, name_en)")
      .eq("facility_id", id);

    if (linkedProds && linkedProds.length > 0) {
      const pNames = linkedProds
        .map((p: any) => `${p.products?.manufacture_sku || p.product_id} (${p.products?.name_en || ""})`)
        .slice(0, 3)
        .join(", ");
      throw new Error(
        `이 제조시설은 ${linkedProds.length}개 제품(${pNames} 등)에 연결되어 있어 삭제할 수 없습니다. 대신 상태를 '비활성화(inactive)'로 변경하세요.`
      );
    }
  } catch (e: any) {
    if (e.message?.includes("제품에 연결되어 있어")) throw e;
  }

  // Check if linked to an active warehouse
  try {
    const { data: linkedWh } = await admin
      .from("warehouses")
      .select("id, code, name")
      .or(`shipping_origin_id.eq.${id},internal_note.ilike.%[ORIGIN_ID:${id}]%`)
      .limit(1);

    if (linkedWh && linkedWh.length > 0) {
      throw new Error(
        `해당 출고지는 물류창고(${linkedWh[0].code} · ${linkedWh[0].name})와 연동되어 있어 삭제할 수 없습니다. 물류창고 설정에서 해당 창고를 먼저 삭제하거나 연동을 해제해주세요.`
      );
    }
  } catch (e: any) {
    if (e.message?.includes("물류창고")) throw e;
  }

  assertOriginWrite(await originsTable(admin)
    .delete()
    .eq("id", id));

  let remaining = existingOrigins.filter((o) => o.id !== id);
  if (target.is_default && remaining.some((o) => isShippingCapableLocation(o.location_type))) {
    const firstShipping = remaining.find((o) => isShippingCapableLocation(o.location_type));
    if (firstShipping) {
      firstShipping.is_default = true;
      assertOriginWrite(await originsTable(admin)
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", firstShipping.id));
    }
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Brand Portal: Delete a shipping origin or manufacturing facility for logged-in company
 */
export async function portalDeleteShippingOrigin(
  id: string
): Promise<{ success: boolean }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId, { includeManufacturingOnly: true });
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("삭제하려는 출고지 또는 제조시설 정보를 찾을 수 없습니다.");
  }
  if (target.company_id !== companyId) {
    throw new Error("소속 회사의 출고지 및 제조시설만 삭제할 수 있습니다.");
  }

  const admin = createAdminClient();

  // Check if linked to products
  try {
    const { data: linkedProds } = await admin
      .from("product_manufacturing_facilities")
      .select("product_id, products(id, manufacture_sku, name_en)")
      .eq("facility_id", id);

    if (linkedProds && linkedProds.length > 0) {
      const pNames = linkedProds
        .map((p: any) => `${p.products?.manufacture_sku || p.product_id} (${p.products?.name_en || ""})`)
        .slice(0, 3)
        .join(", ");
      throw new Error(
        `이 제조시설은 ${linkedProds.length}개 제품(${pNames} 등)에 연결되어 있어 삭제할 수 없습니다. 대신 상태를 '비활성화(inactive)'로 변경하세요.`
      );
    }
  } catch (e: any) {
    if (e.message?.includes("제품에 연결되어 있어")) throw e;
  }

  // Check if linked to an active warehouse
  try {
    const { data: linkedWh } = await admin
      .from("warehouses")
      .select("id, code, name")
      .or(`shipping_origin_id.eq.${id},internal_note.ilike.%[ORIGIN_ID:${id}]%`)
      .limit(1);

    if (linkedWh && linkedWh.length > 0) {
      throw new Error(
        `해당 출고지는 물류창고(${linkedWh[0].code} · ${linkedWh[0].name})와 연동되어 있어 삭제할 수 없습니다. 관리자에게 문의하여 물류창고 연동을 먼저 해제해주세요.`
      );
    }
  } catch (e: any) {
    if (e.message?.includes("물류창고")) throw e;
  }

  assertOriginWrite(await originsTable(admin)
    .delete()
    .eq("id", id));

  let remaining = existingOrigins.filter((o) => o.id !== id);
  if (target.is_default && remaining.some((o) => isShippingCapableLocation(o.location_type))) {
    const firstShipping = remaining.find((o) => isShippingCapableLocation(o.location_type));
    if (firstShipping) {
      firstShipping.is_default = true;
      assertOriginWrite(await originsTable(admin)
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", firstShipping.id));
    }
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}
