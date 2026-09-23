"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WarehousePayload {
  name: string;
  code: string;
  company_id: string | null;
  type: "own" | "3pl" | "partner" | "other";
  status: "active" | "inactive";
  is_default_receiving: boolean;
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  internal_note?: string | null;
  shipping_origin_id?: string | null;
}

export interface WarehouseRow extends WarehousePayload {
  id: string;
  created_at: string;
  updated_at: string;
  shipping_origin_name?: string | null;
}

export interface UnlinkedShippingOriginItem {
  id: string;
  company_id: string;
  company_name?: string;
  name: string;
  is_default: boolean;
  contact_name?: string;
  phone?: string;
  email?: string;
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
}

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  field?: string;
  details?: string;
}

/**
 * Fetch all warehouses with associated company names and linked shipping origins
 */
export async function getWarehouses() {
  await verifyAdminSession();
  const supabase = await createClient();

  // Attempt to select shipping_origin_id and join company_shipping_origins
  let data: any[] | null = null;
  let queryError: any = null;

  try {
    const res = await supabase
      .from("warehouses")
      .select(`
        *,
        companies (
          id,
          name
        ),
        company_shipping_origins (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });
    
    if (res.error) {
      queryError = res.error;
    } else {
      data = res.data;
    }
  } catch (e) {
    queryError = e;
  }

  // Fallback query without company_shipping_origins if relationship is not created yet
  if (queryError || !data) {
    const fallbackRes = await supabase
      .from("warehouses")
      .select(`
        *,
        companies (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (fallbackRes.error) {
      console.error("Error fetching warehouses:", fallbackRes.error);
      throw new Error("물류창고 정보를 가져오지 못했습니다.");
    }
    data = fallbackRes.data;
  }

  const normalized = (data || []).map((w: any) => {
    let resolvedType = w.type;
    let resolvedNote = w.internal_note || "";
    let originId = w.shipping_origin_id || null;
    let originName = w.company_shipping_origins?.name || null;

    if (resolvedNote.includes("[TYPE:partner]")) {
      resolvedType = "partner";
      resolvedNote = resolvedNote.replace(/\[TYPE:partner\]\n?/, "").trim();
    }

    if (!originId && resolvedNote.includes("[ORIGIN_ID:")) {
      const match = resolvedNote.match(/\[ORIGIN_ID:([^\]]+)\]/);
      if (match) {
        originId = match[1];
        resolvedNote = resolvedNote.replace(/\[ORIGIN_ID:[^\]]+\]\n?/, "").trim();
      }
    }

    if (resolvedType === "own") {
      return {
        ...w,
        type: "own",
        company_id: null,
        companies: null,
        shipping_origin_id: originId,
        shipping_origin_name: originName,
        internal_note: resolvedNote || null
      };
    }

    return {
      ...w,
      type: resolvedType,
      shipping_origin_id: originId,
      shipping_origin_name: originName,
      internal_note: resolvedNote || null
    };
  });

  return normalized as (WarehouseRow & { companies: { name: string } | null })[];
}

/**
 * Fetch all unlinked shipping origins from company_shipping_origins (including metadata fallback)
 * that are NOT linked to any warehouse in warehouses table.
 */
export async function getUnlinkedShippingOrigins(): Promise<UnlinkedShippingOriginItem[]> {
  await verifyAdminSession();
  const admin = createAdminClient();

  let rawOrigins: UnlinkedShippingOriginItem[] = [];

  // 1. Try to fetch from company_shipping_origins with companies join
  try {
    const { data, error } = await admin
      .from("company_shipping_origins")
      .select(`
        *,
        companies (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      rawOrigins = data.map((item: any) => ({
        id: item.id,
        company_id: item.company_id,
        company_name: item.companies?.name || "알 수 없는 회사",
        name: item.name,
        is_default: !!item.is_default,
        contact_name: item.contact_name || "",
        phone: item.phone || "",
        email: item.email || "",
        country: item.country || "South Korea",
        address_line1: item.address_line1 || "",
        address_line2: item.address_line2 || "",
        city: item.city || "",
        state_province: item.state_province || "",
        postal_code: item.postal_code || "",
        status: item.status || "active",
        notes: item.notes || "",
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      }));
    }
  } catch (e) {}

  // 2. Metadata fallback (companies.intro starting with __COMPANY_METADATA__:)
  try {
    const { data: companiesWithIntro } = await admin
      .from("companies")
      .select("id, name, intro")
      .like("intro", "__COMPANY_METADATA__%");

    if (companiesWithIntro) {
      for (const comp of companiesWithIntro) {
        try {
          const jsonStr = comp.intro.substring("__COMPANY_METADATA__:".length);
          const meta = JSON.parse(jsonStr);
          if (Array.isArray(meta.shipping_origins)) {
            for (const origin of meta.shipping_origins) {
              if (!rawOrigins.some((r) => r.id === origin.id)) {
                rawOrigins.push({
                  id: origin.id,
                  company_id: comp.id,
                  company_name: comp.name,
                  name: origin.name,
                  is_default: !!origin.is_default,
                  contact_name: origin.contact_name || "",
                  phone: origin.phone || "",
                  email: origin.email || "",
                  country: origin.country || "South Korea",
                  address_line1: origin.address_line1 || "",
                  address_line2: origin.address_line2 || "",
                  city: origin.city || "",
                  state_province: origin.state_province || "",
                  postal_code: origin.postal_code || "",
                  status: origin.status || "active",
                  notes: origin.notes || "",
                  created_at: origin.created_at || new Date().toISOString(),
                  updated_at: origin.updated_at || new Date().toISOString(),
                });
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 3. Get all linked shipping origin IDs from warehouses
  const linkedOriginIds = new Set<string>();
  try {
    const { data: whList } = await admin
      .from("warehouses")
      .select("shipping_origin_id, internal_note");

    if (whList) {
      for (const wh of whList) {
        if (wh.shipping_origin_id) {
          linkedOriginIds.add(wh.shipping_origin_id);
        }
        if (wh.internal_note && wh.internal_note.includes("[ORIGIN_ID:")) {
          const match = wh.internal_note.match(/\[ORIGIN_ID:([^\]]+)\]/);
          if (match && match[1]) {
            linkedOriginIds.add(match[1]);
          }
        }
      }
    }
  } catch (e) {}

  // 4. Return unlinked shipping origins
  const unlinked = rawOrigins.filter((o) => !linkedOriginIds.has(o.id));
  return unlinked;
}

/**
 * Create a new warehouse
 */
export async function createWarehouse(payload: WarehousePayload): Promise<ActionResult<WarehouseRow>> {
  await verifyAdminSession();
  const supabase = await createClient();

  // Validate: Required Fields
  if (!payload.name || !payload.name.trim()) {
    return { success: false, code: "REQUIRED_NAME", field: "name", error: "물류창고 이름을 입력해주세요." };
  }
  if (!payload.code || !payload.code.trim()) {
    return { success: false, code: "REQUIRED_CODE", field: "code", error: "물류창고 코드를 입력해주세요." };
  }
  if (!payload.address1 || !payload.address1.trim()) {
    return { success: false, code: "REQUIRED_ADDRESS1", field: "address1", error: "주소 1을 입력해주세요." };
  }
  if (!payload.city || !payload.city.trim()) {
    return { success: false, code: "REQUIRED_CITY", field: "city", error: "도시(City)를 입력해주세요." };
  }
  if (!payload.zip_code || !payload.zip_code.trim()) {
    return { success: false, code: "REQUIRED_POSTAL_CODE", field: "zip_code", error: "우편번호(ZIP / Postal Code)를 입력해주세요." };
  }
  if (!payload.country || !payload.country.trim()) {
    return { success: false, code: "REQUIRED_COUNTRY", field: "country", error: "국가(Country)를 입력해주세요." };
  }

  // Validate: Code format (uppercase, alphanumeric, 2-10 chars)
  const code = payload.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    return { success: false, code: "INVALID_CODE_FORMAT", field: "code", error: "창고 코드는 2~10자리의 영문 대문자 및 숫자만 가능합니다." };
  }

  // Parse companyId (enforce null for own warehouses)
  const companyId = payload.type === "own"
    ? null
    : (payload.company_id && payload.company_id.trim() !== "" ? payload.company_id.trim() : null);

  // Validate: 3PL and Partner must have a connected company
  if (payload.type === "3pl" && !companyId) {
    return { success: false, code: "REQUIRED_COMPANY", field: "company_id", error: "3PL 물류창고는 연결 회사를 반드시 선택해야 합니다." };
  }
  if (payload.type === "partner" && !companyId) {
    return { success: false, code: "REQUIRED_COMPANY", field: "company_id", error: "파트너 창고는 연결 회사를 선택해야 합니다." };
  }

  // Validate: Default receiving active check
  if (payload.is_default_receiving && payload.status === "inactive") {
    return { success: false, code: "INVALID_DEFAULT_STATUS", field: "status", error: "비활성 창고는 기본 입고 창고로 설정할 수 없습니다." };
  }

  // Validate: Code duplicate check
  const { data: codeCheck } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (codeCheck) {
    return { success: false, code: "DUPLICATE_CODE", field: "code", error: `이미 사용 중인 창고 코드입니다. 다른 창고 코드를 입력해주세요.` };
  }

  // Validate: Duplicate check on shipping_origin_id (both physical column and metadata tags)
  if (payload.shipping_origin_id) {
    const { data: allWh } = await supabase
      .from("warehouses")
      .select("id, code, name, internal_note");

    if (allWh) {
      for (const w of allWh) {
        const hasCanonical = (w as any).shipping_origin_id === payload.shipping_origin_id;
        const hasTag = w.internal_note && w.internal_note.includes(`[ORIGIN_ID:${payload.shipping_origin_id}]`);
        if (hasCanonical || hasTag) {
          return {
            success: false,
            code: "ORIGIN_ALREADY_LINKED",
            field: "shipping_origin_id",
            error: `이 출고지는 이미 다른 물류창고(${w.code} · ${w.name})와 연결되어 있습니다.`
          };
        }
      }
    }
  }

  // If set as default, unset other defaults for the same company (or unset other own warehouses if company_id is null)
  if (payload.is_default_receiving) {
    let unsetQuery = supabase
      .from("warehouses")
      .update({ is_default_receiving: false });

    if (companyId) {
      unsetQuery = unsetQuery.eq("company_id", companyId);
    } else {
      unsetQuery = unsetQuery.is("company_id", null);
    }

    const { error: unsetError } = await unsetQuery;

    if (unsetError) {
      console.error("Error unsetting existing defaults:", unsetError);
      return {
        success: false,
        code: "DEFAULT_UNSET_FAILED",
        error: "기존 기본 입고 창고 설정을 변경하지 못했습니다.",
        details: unsetError.message
      };
    }
  }

  const insertPayload: any = {
    name: payload.name.trim(),
    code,
    company_id: companyId,
    type: payload.type,
    status: payload.status,
    is_default_receiving: payload.is_default_receiving,
    address1: payload.address1.trim(),
    address2: payload.address2 ? payload.address2.trim() : null,
    city: payload.city.trim(),
    state: payload.state.trim() || "N/A",
    zip_code: payload.zip_code.trim(),
    country: payload.country.trim(),
    internal_note: payload.internal_note ? payload.internal_note.trim() : null,
    shipping_origin_id: payload.shipping_origin_id || null,
  };

  let { data: insertedData, error: insertError } = await supabase
    .from("warehouses")
    .insert(insertPayload)
    .select();

  // Compound resilient fallback for unmigrated database schema constraints
  if (insertError) {
    console.warn("createWarehouse initial insert failed, applying compound adaptations:", insertError);
    const retryPayload = { ...insertPayload };
    const noteTags: string[] = [];

    // Fallback A: column shipping_origin_id does not exist in schema
    if (insertError.code === "PGRST204" || insertError.message?.includes("shipping_origin_id")) {
      delete retryPayload.shipping_origin_id;
      if (payload.shipping_origin_id) {
        noteTags.push(`[ORIGIN_ID:${payload.shipping_origin_id}]`);
      }
    }

    // Fallback B: type check constraint (partner type not in CHECK enum)
    if (insertError.code === "23514" || insertError.message?.includes("warehouses_type_check") || retryPayload.type === "partner") {
      retryPayload.type = "3pl";
      noteTags.push("[TYPE:partner]");
    }

    // Fallback C: company_id NOT NULL constraint for own warehouse
    if (insertError.message?.includes('null value in column "company_id"') || (retryPayload.type === "own" && !retryPayload.company_id)) {
      const { data: defaultComp } = await supabase.from("companies").select("id").limit(1).maybeSingle();
      if (defaultComp) {
        retryPayload.company_id = defaultComp.id;
      }
    }

    if (noteTags.length > 0) {
      retryPayload.internal_note = (retryPayload.internal_note ? retryPayload.internal_note + "\n" : "") + noteTags.join("\n");
    }

    const retryRes = await supabase
      .from("warehouses")
      .insert(retryPayload)
      .select();

    if (retryRes.error) {
      console.error("createWarehouse compound retry failed:", retryRes.error);
      if (retryRes.error.code === "23505" || retryRes.error.message?.includes("warehouses_code_key")) {
        return {
          success: false,
          code: "DUPLICATE_CODE",
          field: "code",
          error: `이미 사용 중인 창고 코드입니다. 다른 창고 코드를 입력해주세요.`
        };
      }
      return {
        success: false,
        code: retryRes.error.code || "DB_ERROR",
        error: "물류창고 설정을 저장할 수 없습니다. 시스템 설정을 확인해주세요.",
        details: retryRes.error.message
      };
    }

    insertedData = retryRes.data;
  }

  const createdRow = insertedData?.[0] || { code, ...insertPayload };
  const normalizedRow: WarehouseRow = {
    ...createdRow,
    type: payload.type,
    company_id: payload.type === "own" ? null : createdRow.company_id,
    shipping_origin_id: payload.shipping_origin_id || null,
    internal_note: payload.internal_note || null,
  };

  revalidatePath("/admin/settings/warehouses");
  if (companyId) {
    revalidatePath(`/admin/companies/${companyId}`);
  }
  revalidatePath("/portal/company/info");
  return { success: true, data: normalizedRow };
}

/**
 * Update an existing warehouse
 */
export async function updateWarehouse(id: string, payload: WarehousePayload): Promise<ActionResult<WarehouseRow>> {
  await verifyAdminSession();
  const supabase = await createClient();

  // Validate: Required Fields
  if (!payload.name || !payload.name.trim()) {
    return { success: false, code: "REQUIRED_NAME", field: "name", error: "물류창고 이름을 입력해주세요." };
  }
  if (!payload.code || !payload.code.trim()) {
    return { success: false, code: "REQUIRED_CODE", field: "code", error: "물류창고 코드를 입력해주세요." };
  }
  if (!payload.address1 || !payload.address1.trim()) {
    return { success: false, code: "REQUIRED_ADDRESS1", field: "address1", error: "주소 1을 입력해주세요." };
  }
  if (!payload.city || !payload.city.trim()) {
    return { success: false, code: "REQUIRED_CITY", field: "city", error: "도시(City)를 입력해주세요." };
  }
  if (!payload.zip_code || !payload.zip_code.trim()) {
    return { success: false, code: "REQUIRED_POSTAL_CODE", field: "zip_code", error: "우편번호(ZIP / Postal Code)를 입력해주세요." };
  }
  if (!payload.country || !payload.country.trim()) {
    return { success: false, code: "REQUIRED_COUNTRY", field: "country", error: "국가(Country)를 입력해주세요." };
  }

  // Validate: Code format (uppercase, alphanumeric, 2-10 chars)
  const code = payload.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    return { success: false, code: "INVALID_CODE_FORMAT", field: "code", error: "창고 코드는 2~10자리의 영문 대문자 및 숫자만 가능합니다." };
  }

  // Parse companyId (enforce null for own warehouses)
  const companyId = payload.type === "own"
    ? null
    : (payload.company_id && payload.company_id.trim() !== "" ? payload.company_id.trim() : null);

  // Validate: 3PL and Partner must have a connected company
  if (payload.type === "3pl" && !companyId) {
    return { success: false, code: "REQUIRED_COMPANY", field: "company_id", error: "3PL 물류창고는 연결 회사를 반드시 선택해야 합니다." };
  }
  if (payload.type === "partner" && !companyId) {
    return { success: false, code: "REQUIRED_COMPANY", field: "company_id", error: "파트너 창고는 연결 회사를 선택해야 합니다." };
  }

  // Validate: Default receiving active check
  if (payload.is_default_receiving && payload.status === "inactive") {
    return { success: false, code: "INVALID_DEFAULT_STATUS", field: "status", error: "비활성 창고는 기본 입고 창고로 설정할 수 없습니다." };
  }

  // Validate: Default warehouse cannot be inactivated without changing default first
  if (!payload.is_default_receiving && payload.status === "inactive") {
    const { data: current } = await supabase
      .from("warehouses")
      .select("is_default_receiving")
      .eq("id", id)
      .single();

    if (current?.is_default_receiving) {
      return {
        success: false,
        code: "CANNOT_INACTIVATE_DEFAULT",
        error: "기본 입고 창고로 지정된 활성 창고는 비활성화할 수 없습니다. 먼저 다른 창고를 기본 입고 창고로 지정하십시오."
      };
    }
  }

  // Validate: Code duplicate check (excluding itself)
  const { data: codeCheck } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", code)
    .neq("id", id)
    .maybeSingle();

  if (codeCheck) {
    return { success: false, code: "DUPLICATE_CODE", field: "code", error: `이미 사용 중인 창고 코드입니다. 다른 창고 코드를 입력해주세요.` };
  }

  // Validate: Duplicate check on shipping_origin_id (excluding itself)
  if (payload.shipping_origin_id) {
    const { data: allWh } = await supabase
      .from("warehouses")
      .select("id, code, name, internal_note")
      .neq("id", id);

    if (allWh) {
      for (const w of allWh) {
        const hasCanonical = (w as any).shipping_origin_id === payload.shipping_origin_id;
        const hasTag = w.internal_note && w.internal_note.includes(`[ORIGIN_ID:${payload.shipping_origin_id}]`);
        if (hasCanonical || hasTag) {
          return {
            success: false,
            code: "ORIGIN_ALREADY_LINKED",
            field: "shipping_origin_id",
            error: `이 출고지는 이미 다른 물류창고(${w.code} · ${w.name})와 연결되어 있습니다.`
          };
        }
      }
    }
  }

  // If updating default to true, unset other defaults for the same company (or unset other own warehouses if company_id is null)
  if (payload.is_default_receiving) {
    let unsetQuery = supabase
      .from("warehouses")
      .update({ is_default_receiving: false })
      .neq("id", id);

    if (companyId) {
      unsetQuery = unsetQuery.eq("company_id", companyId);
    } else {
      unsetQuery = unsetQuery.is("company_id", null);
    }

    const { error: unsetError } = await unsetQuery;

    if (unsetError) {
      console.error("Error unsetting existing defaults during update:", unsetError);
      return {
        success: false,
        code: "DEFAULT_UNSET_FAILED",
        error: "기존 기본 입고 창고 설정을 변경하지 못했습니다.",
        details: unsetError.message
      };
    }
  }

  const updatePayload: any = {
    name: payload.name.trim(),
    code,
    company_id: companyId,
    type: payload.type,
    status: payload.status,
    is_default_receiving: payload.is_default_receiving,
    address1: payload.address1.trim(),
    address2: payload.address2 ? payload.address2.trim() : null,
    city: payload.city.trim(),
    state: payload.state.trim() || "N/A",
    zip_code: payload.zip_code.trim(),
    country: payload.country.trim(),
    internal_note: payload.internal_note ? payload.internal_note.trim() : null,
    updated_at: new Date().toISOString()
  };

  if (payload.shipping_origin_id !== undefined) {
    updatePayload.shipping_origin_id = payload.shipping_origin_id || null;
  }

  let { data: updatedData, error: updateError } = await supabase
    .from("warehouses")
    .update(updatePayload)
    .eq("id", id)
    .select();

  // Compound resilient fallback for unmigrated database schema constraints
  if (updateError) {
    console.warn("updateWarehouse initial update failed, applying compound adaptations:", updateError);
    const retryPayload = { ...updatePayload };
    const noteTags: string[] = [];

    // Fallback A: column shipping_origin_id does not exist in schema
    if (updateError.code === "PGRST204" || updateError.message?.includes("shipping_origin_id")) {
      delete retryPayload.shipping_origin_id;
      if (payload.shipping_origin_id) {
        noteTags.push(`[ORIGIN_ID:${payload.shipping_origin_id}]`);
      }
    }

    // Fallback B: type check constraint
    if (updateError.code === "23514" || updateError.message?.includes("warehouses_type_check") || retryPayload.type === "partner") {
      retryPayload.type = "3pl";
      noteTags.push("[TYPE:partner]");
    }

    // Fallback C: company_id NOT NULL for own warehouse
    if (updateError.message?.includes('null value in column "company_id"') || (retryPayload.type === "own" && !retryPayload.company_id)) {
      const { data: defaultComp } = await supabase.from("companies").select("id").limit(1).maybeSingle();
      if (defaultComp) {
        retryPayload.company_id = defaultComp.id;
      }
    }

    if (noteTags.length > 0) {
      retryPayload.internal_note = (retryPayload.internal_note ? retryPayload.internal_note + "\n" : "") + noteTags.join("\n");
    }

    const retryRes = await supabase
      .from("warehouses")
      .update(retryPayload)
      .eq("id", id)
      .select();

    if (retryRes.error) {
      console.error("updateWarehouse compound retry failed:", retryRes.error);
      if (retryRes.error.code === "23505" || retryRes.error.message?.includes("warehouses_code_key")) {
        return {
          success: false,
          code: "DUPLICATE_CODE",
          field: "code",
          error: `이미 사용 중인 창고 코드입니다. 다른 창고 코드를 입력해주세요.`
        };
      }
      return {
        success: false,
        code: retryRes.error.code || "DB_ERROR",
        error: "물류창고 설정을 저장할 수 없습니다. 시스템 설정을 확인해주세요.",
        details: retryRes.error.message
      };
    }

    updatedData = retryRes.data;
  }

  const updatedRow = updatedData?.[0] || { id, code, ...updatePayload };
  const normalizedRow: WarehouseRow = {
    ...updatedRow,
    type: payload.type,
    company_id: payload.type === "own" ? null : updatedRow.company_id,
    shipping_origin_id: payload.shipping_origin_id || null,
    internal_note: payload.internal_note || null,
  };

  revalidatePath("/admin/settings/warehouses");
  if (companyId) {
    revalidatePath(`/admin/companies/${companyId}`);
  }
  revalidatePath("/portal/company/info");
  return { success: true, data: normalizedRow };
}

/**
 * Delete a warehouse
 */
export async function deleteWarehouse(id: string): Promise<ActionResult> {
  await verifyAdminSession();
  const supabase = await createClient();

  // Validate: Cannot delete default receiving warehouse
  const { data: current } = await supabase
    .from("warehouses")
    .select("company_id, is_default_receiving")
    .eq("id", id)
    .single();

  if (current?.is_default_receiving) {
    return { success: false, code: "CANNOT_DELETE_DEFAULT", error: "기본 입고 창고로 설정된 물류창고는 삭제할 수 없습니다." };
  }

  const { error } = await supabase
    .from("warehouses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting warehouse:", error);
    return {
      success: false,
      code: error.code || "DELETE_FAILED",
      error: "물류창고 삭제에 실패했습니다. 다른 데이터에서 참조 중인지 확인하십시오.",
      details: error.message
    };
  }

  revalidatePath("/admin/settings/warehouses");
  if (current?.company_id) {
    revalidatePath(`/admin/companies/${current.company_id}`);
  }
  revalidatePath("/portal/company/info");
  return { success: true };
}
