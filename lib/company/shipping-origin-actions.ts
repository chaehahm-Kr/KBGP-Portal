"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { verifyAdminSession } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import { requireMenuPermission } from "@/lib/company/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  if (!input.country || !input.country.trim()) {
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

// Helper to get origins from company.intro metadata fallback
async function getOriginsFromMetadata(companyId: string): Promise<CompanyShippingOrigin[]> {
  const admin = createAdminClient();
  const { data: comp } = await admin
    .from("companies")
    .select("intro")
    .eq("id", companyId)
    .single();

  if (!comp || !comp.intro || !comp.intro.startsWith("__COMPANY_METADATA__:")) {
    return [];
  }

  try {
    const jsonStr = comp.intro.substring("__COMPANY_METADATA__:".length);
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed.shipping_origins) ? parsed.shipping_origins : [];
  } catch (e) {
    return [];
  }
}

// Helper to save origins to company.intro metadata fallback
async function saveOriginsToMetadata(companyId: string, origins: CompanyShippingOrigin[]): Promise<void> {
  const admin = createAdminClient();
  const { data: comp } = await admin
    .from("companies")
    .select("intro")
    .eq("id", companyId)
    .single();

  let metaObj: any = {};
  if (comp && comp.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      metaObj = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
    } catch (e) {}
  } else if (comp && comp.intro) {
    metaObj.description = comp.intro;
  }

  metaObj.shipping_origins = origins;
  const newIntro = `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`;

  await admin
    .from("companies")
    .update({ intro: newIntro, updated_at: new Date().toISOString() })
    .eq("id", companyId);
}

/**
 * Fetch all shipping origins for a specific company
 */
export async function getCompanyShippingOrigins(companyId: string): Promise<CompanyShippingOrigin[]> {
  if (!companyId) return [];

  const admin = createAdminClient();
  let rawOrigins: CompanyShippingOrigin[] = [];

  try {
    const { data, error } = await admin
      .from("company_shipping_origins")
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

  if (rawOrigins.length === 0) {
    // Fallback to metadata
    const fallback = await getOriginsFromMetadata(companyId);
    rawOrigins = fallback.sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
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
    country: input.country.trim(),
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
  let savedToDb = false;

  try {
    if (willBeDefault) {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: false, updated_at: now })
        .eq("company_id", companyId);
    }

    const { error } = await admin
      .from("company_shipping_origins")
      .insert(newRecord);

    if (!error) {
      savedToDb = true;
    }
  } catch (e) {}

  // Always sync to metadata fallback for complete Single Source of Truth resilience
  let updatedList = existingOrigins;
  if (willBeDefault) {
    updatedList = updatedList.map((o) => ({ ...o, is_default: false }));
  }
  updatedList.push(newRecord);
  await saveOriginsToMetadata(companyId, updatedList);

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
    country: input.country.trim(),
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
  try {
    if (willBeDefault) {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: false, updated_at: now })
        .eq("company_id", companyId);
    }

    await admin
      .from("company_shipping_origins")
      .insert(newRecord);
  } catch (e) {}

  let updatedList = existingOrigins;
  if (willBeDefault) {
    updatedList = updatedList.map((o) => ({ ...o, is_default: false }));
  }
  updatedList.push(newRecord);
  await saveOriginsToMetadata(companyId, updatedList);

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
    country: input.country.trim(),
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
  try {
    if (willBeDefault) {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: false, updated_at: now })
        .eq("company_id", companyId);
    }

    await admin
      .from("company_shipping_origins")
      .update(updatedRecord)
      .eq("id", id);
  } catch (e) {}

  let updatedList = existingOrigins.map((o) => {
    if (o.id === id) return updatedRecord;
    if (willBeDefault) return { ...o, is_default: false };
    return o;
  });
  await saveOriginsToMetadata(companyId, updatedList);

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
    country: input.country.trim(),
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
  try {
    if (willBeDefault) {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: false, updated_at: now })
        .eq("company_id", companyId);
    }

    await admin
      .from("company_shipping_origins")
      .update(updatedRecord)
      .eq("id", id);
  } catch (e) {}

  let updatedList = existingOrigins.map((o) => {
    if (o.id === id) return updatedRecord;
    if (willBeDefault) return { ...o, is_default: false };
    return o;
  });
  await saveOriginsToMetadata(companyId, updatedList);

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
  try {
    await admin
      .from("company_shipping_origins")
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId);

    await admin
      .from("company_shipping_origins")
      .update({ is_default: true, updated_at: now, updated_by: session.userId })
      .eq("id", id);
  } catch (e) {}

  const updatedList = existingOrigins.map((o) => ({
    ...o,
    is_default: o.id === id,
    updated_at: o.id === id ? now : o.updated_at,
    updated_by: o.id === id ? session.userId : o.updated_by,
  }));
  await saveOriginsToMetadata(companyId, updatedList);

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
  try {
    await admin
      .from("company_shipping_origins")
      .update({ is_default: false, updated_at: now })
      .eq("company_id", companyId);

    await admin
      .from("company_shipping_origins")
      .update({ is_default: true, updated_at: now, updated_by: membership.userId })
      .eq("id", id);
  } catch (e) {}

  const updatedList = existingOrigins.map((o) => ({
    ...o,
    is_default: o.id === id,
    updated_at: o.id === id ? now : o.updated_at,
    updated_by: o.id === id ? membership.userId : o.updated_by,
  }));
  await saveOriginsToMetadata(companyId, updatedList);

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

  try {
    await admin
      .from("company_shipping_origins")
      .delete()
      .eq("id", id);
  } catch (e) {}

  let remaining = existingOrigins.filter((o) => o.id !== id);
  // If we deleted the default origin and there is only 1 origin left, make it default
  if (target.is_default && remaining.length === 1) {
    remaining[0].is_default = true;
    try {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", remaining[0].id);
    } catch (e) {}
  }

  await saveOriginsToMetadata(companyId, remaining);

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

  try {
    await admin
      .from("company_shipping_origins")
      .delete()
      .eq("id", id);
  } catch (e) {}

  let remaining = existingOrigins.filter((o) => o.id !== id);
  if (target.is_default && remaining.length === 1) {
    remaining[0].is_default = true;
    try {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", remaining[0].id);
    } catch (e) {}
  }

  await saveOriginsToMetadata(companyId, remaining);

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/portal/company/info");
  return { success: true };
}
