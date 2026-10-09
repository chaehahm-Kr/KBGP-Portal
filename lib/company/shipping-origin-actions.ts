"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { verifyAdminSession } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import { requireMenuPermission } from "@/lib/company/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCanonicalCountryName } from "@/lib/constants/countries";

/**
 * DATA-JSON-CLEAN-003: 출고지는 company_shipping_origins 테이블(0137)만 저장소다.
 * companies.intro JSON 백업은 쓰지 않으므로 테이블 쓰기 실패를 오류로 돌려준다.
 */
const ORIGIN_TABLE_COLUMNS = [
  "id", "company_id", "name", "is_default", "contact_name", "phone", "email", "country",
  "address_line1", "address_line2", "city", "state_province", "postal_code", "status", "notes",
  "created_at", "updated_at", "created_by", "updated_by",
] as const;

/**
 * 테이블에 쓸 칸만 남긴다. 목록 조회 때 덧붙는 warehouse_* 같은 표시용 값이 섞이면
 * update 가 "column does not exist" 로 조용히 실패해 테이블만 예전 값으로 남는다.
 */
function toOriginRow(record: CompanyShippingOrigin): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of ORIGIN_TABLE_COLUMNS) {
    if (record[col] !== undefined) row[col] = record[col];
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
}

// Validation helper
function validateShippingOriginInput(input: ShippingOriginInput) {
  if (!input.name || !input.name.trim()) {
    throw new Error("출고지명은 필수 입력 항목입니다.");
  }
  if (!input.country || !formatCanonicalCountryName(input.country)) {
    throw new Error("국가는 필수 선택 항목입니다.");
  }
  if (!input.address_line1 || !input.address_line1.trim()) {
    throw new Error("주소 1은 필수 입력 항목입니다.");
  }
  if (!input.city || !input.city.trim()) {
    throw new Error("도시는 필수 입력 항목입니다.");
  }
  if (!input.postal_code || !input.postal_code.trim()) {
    throw new Error("우편번호(Postal / ZIP Code)는 필수 입력 항목입니다.");
  }
  if (input.email && input.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      throw new Error("유효한 이메일 주소를 입력해주세요.");
    }
  }
}

/**
 * Fetch all shipping origins for a specific company
 */
export async function getCompanyShippingOrigins(companyId: string): Promise<CompanyShippingOrigin[]> {
  if (!companyId) return [];

  const admin = createAdminClient();
  let rawOrigins: CompanyShippingOrigin[] = [];

  try {
    const { data, error } = await originsTable(admin)
      .select("*")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      rawOrigins = data as CompanyShippingOrigin[];
    }
  } catch (e) {
    // Fallback to metadata
  }

  // Enrich with warehouse link info
  try {
    const { data: whList } = await admin
      .from("warehouses")
      .select("id, code, name, type, internal_note");

    if (whList && whList.length > 0) {
      return rawOrigins.map((origin) => {
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

  return rawOrigins;
}

/**
 * Admin: Create a new shipping origin for a company
 */
export async function adminCreateShippingOrigin(
  companyId: string,
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const session = await verifyAdminSession();
  validateShippingOriginInput(input);

  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const isFirst = existingOrigins.length === 0;
  const willBeDefault = input.is_default !== undefined ? input.is_default : isFirst;

  const now = new Date().toISOString();
  const newRecord: CompanyShippingOrigin = {
    id: crypto.randomUUID(),
    company_id: companyId,
    name: input.name.trim(),
    is_default: willBeDefault,
    contact_name: (input.contact_name || "").trim(),
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

  const admin = createAdminClient();

  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .insert(toOriginRow(newRecord)));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: newRecord };
}

/**
 * Brand Portal: Create a new shipping origin for logged-in company
 */
export async function portalCreateShippingOrigin(
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");
  validateShippingOriginInput(input);

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const isFirst = existingOrigins.length === 0;
  const willBeDefault = input.is_default !== undefined ? input.is_default : isFirst;

  const now = new Date().toISOString();
  const newRecord: CompanyShippingOrigin = {
    id: crypto.randomUUID(),
    company_id: companyId,
    name: input.name.trim(),
    is_default: willBeDefault,
    contact_name: (input.contact_name || "").trim(),
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

  const admin = createAdminClient();
  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .insert(toOriginRow(newRecord)));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: newRecord };
}

/**
 * Admin: Update an existing shipping origin
 */
export async function adminUpdateShippingOrigin(
  id: string,
  companyId: string,
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const session = await verifyAdminSession();
  validateShippingOriginInput(input);

  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("수정하려는 출고지 정보를 찾을 수 없습니다.");
  }

  const now = new Date().toISOString();
  const willBeDefault = input.is_default !== undefined ? input.is_default : target.is_default;

  const updatedRecord: CompanyShippingOrigin = {
    ...target,
    name: input.name.trim(),
    is_default: willBeDefault,
    contact_name: (input.contact_name || "").trim(),
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

  const admin = createAdminClient();
  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .update(toOriginRow(updatedRecord))
    .eq("id", id));

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true, data: updatedRecord };
}

/**
 * Brand Portal: Update an existing shipping origin for logged-in company
 */
export async function portalUpdateShippingOrigin(
  id: string,
  input: ShippingOriginInput
): Promise<{ success: boolean; data: CompanyShippingOrigin }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");
  validateShippingOriginInput(input);

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("수정하려는 출고지 정보를 찾을 수 없습니다.");
  }
  if (target.company_id !== companyId) {
    throw new Error("소속 회사의 출고지만 수정할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const willBeDefault = input.is_default !== undefined ? input.is_default : target.is_default;

  const updatedRecord: CompanyShippingOrigin = {
    ...target,
    name: input.name.trim(),
    is_default: willBeDefault,
    contact_name: (input.contact_name || "").trim(),
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

  const admin = createAdminClient();
  if (willBeDefault) {
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId));
  }

  assertOriginWrite(await originsTable(admin)
    .update(toOriginRow(updatedRecord))
    .eq("id", id));

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
  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("출고지 정보를 찾을 수 없습니다.");
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
  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("출고지 정보를 찾을 수 없습니다.");
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
 * Admin: Delete a shipping origin
 */
export async function adminDeleteShippingOrigin(
  id: string,
  companyId: string
): Promise<{ success: boolean }> {
  await verifyAdminSession();
  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("삭제하려는 출고지 정보를 찾을 수 없습니다.");
  }

  const admin = createAdminClient();

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
  // If we deleted the default origin and there is only 1 origin left, make it default
  if (target.is_default && remaining.length === 1) {
    remaining[0].is_default = true;
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", remaining[0].id));
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Brand Portal: Delete a shipping origin for logged-in company
 */
export async function portalDeleteShippingOrigin(
  id: string
): Promise<{ success: boolean }> {
  const membership = await requireCompanyMembership();
  await requireMenuPermission("company_info", "write");

  const companyId = membership.companyId;
  const existingOrigins = await getCompanyShippingOrigins(companyId);
  const target = existingOrigins.find((o) => o.id === id);
  if (!target) {
    throw new Error("삭제하려는 출고지 정보를 찾을 수 없습니다.");
  }
  if (target.company_id !== companyId) {
    throw new Error("소속 회사의 출고지만 삭제할 수 있습니다.");
  }

  const admin = createAdminClient();

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
  if (target.is_default && remaining.length === 1) {
    remaining[0].is_default = true;
    assertOriginWrite(await originsTable(admin)
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", remaining[0].id));
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}
