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
export async function createWarehouse(payload: WarehousePayload) {
  await verifyAdminSession();
  const supabase = await createClient();

  // Validate: Code format (uppercase, alphanumeric, short)
  const code = payload.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    return { success: false, error: "창고 코드는 2~10자리의 영문 대문자 및 숫자만 가능합니다." };
  }

  // Parse companyId (enforce null for own warehouses)
  const companyId = payload.type === "own"
    ? null
    : (payload.company_id && payload.company_id.trim() !== "" ? payload.company_id.trim() : null);

  // Validate: 3PL and Partner must have a connected company
  if (payload.type === "3pl" && !companyId) {
    return { success: false, error: "3PL 물류창고는 연결 회사를 반드시 선택해야 합니다." };
  }
  if (payload.type === "partner" && !companyId) {
    return { success: false, error: "파트너 창고는 연결할 파트너 회사를 반드시 선택해야 합니다." };
  }

  // Validate: Default receiving active check
  if (payload.is_default_receiving && payload.status === "inactive") {
    return { success: false, error: "비활성 창고는 기본 입고 창고로 설정할 수 없습니다." };
  }

  // Validate: Code duplicate check
  const { data: codeCheck } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (codeCheck) {
    return { success: false, error: `이미 사용 중인 창고 코드입니다: ${code}` };
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
      return { success: false, error: "기존 기본 입고 창고 설정을 변경하지 못했습니다." };
    }
  }

  // Validate: Duplicate check on shipping_origin_id
  if (payload.shipping_origin_id) {
    const { data: duplicateOrigin } = await supabase
      .from("warehouses")
      .select("id, code, name")
      .eq("shipping_origin_id", payload.shipping_origin_id)
      .maybeSingle();

    if (duplicateOrigin) {
      return { success: false, error: `해당 출고지는 이미 물류창고(${duplicateOrigin.code} · ${duplicateOrigin.name})와 연결되어 있습니다.` };
    }
  }

  let insertPayload: any = {
    name: payload.name.trim(),
    code,
    company_id: companyId,
    type: payload.type,
    status: payload.status,
    is_default_receiving: payload.is_default_receiving,
    address1: payload.address1.trim(),
    address2: payload.address2 ? payload.address2.trim() : null,
    city: payload.city.trim(),
    state: payload.state.trim(),
    zip_code: payload.zip_code.trim(),
    country: payload.country.trim(),
    internal_note: payload.internal_note ? payload.internal_note.trim() : null,
    shipping_origin_id: payload.shipping_origin_id || null,
  };

  let { error: insertError } = await supabase
    .from("warehouses")
    .insert(insertPayload);

  // Resilient fallback for unmigrated database schema constraints
  if (insertError) {
    let handled = false;
    // Fallback 1: company_id NOT NULL constraint
    if (insertError.message.includes('null value in column "company_id"') && payload.type === "own") {
      const { data: defaultComp } = await supabase.from("companies").select("id").eq("status", "active").limit(1).maybeSingle();
      if (defaultComp) {
        insertPayload.company_id = defaultComp.id;
        const retry = await supabase.from("warehouses").insert(insertPayload);
        if (!retry.error) handled = true;
      }
    }

    // Fallback 2: type check constraint (partner)
    if (insertError.message.includes('violates check constraint "warehouses_type_check"') && payload.type === "partner") {
      insertPayload.type = "3pl";
      insertPayload.internal_note = (insertPayload.internal_note ? insertPayload.internal_note + "\n" : "") + "[TYPE:partner]";
      const retry = await supabase.from("warehouses").insert(insertPayload);
      if (!retry.error) handled = true;
    }

    // Fallback 3: column shipping_origin_id does not exist
    if (insertError.message.includes('column "shipping_origin_id" of relation "warehouses" does not exist') || insertError.message.includes('column "shipping_origin_id" does not exist')) {
      delete insertPayload.shipping_origin_id;
      if (payload.shipping_origin_id) {
        insertPayload.internal_note = (insertPayload.internal_note ? insertPayload.internal_note + "\n" : "") + `[ORIGIN_ID:${payload.shipping_origin_id}]`;
      }
      const retry = await supabase.from("warehouses").insert(insertPayload);
      if (!retry.error) handled = true;
    }

    if (!handled) {
      console.error("Error creating warehouse:", insertError);
      return { success: false, error: "물류창고 등록에 실패했습니다. 입력값을 확인해주세요." };
    }
  }

  // Fetch the created warehouse
  const { data: createdRecord } = await supabase
    .from("warehouses")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  revalidatePath("/admin/settings/warehouses");
  if (companyId) {
    revalidatePath(`/admin/companies/${companyId}`);
  }
  revalidatePath("/portal/company/info");
  return { success: true, data: createdRecord || { code, ...insertPayload } };
}

/**
 * Update an existing warehouse
 */
export async function updateWarehouse(id: string, payload: WarehousePayload) {
  await verifyAdminSession();
  const supabase = await createClient();

  // Validate: Code format (uppercase, alphanumeric, short)
  const code = payload.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    return { success: false, error: "창고 코드는 2~10자리의 영문 대문자 및 숫자만 가능합니다." };
  }

  // Parse companyId (enforce null for own warehouses)
  const companyId = payload.type === "own"
    ? null
    : (payload.company_id && payload.company_id.trim() !== "" ? payload.company_id.trim() : null);

  // Validate: 3PL and Partner must have a connected company
  if (payload.type === "3pl" && !companyId) {
    return { success: false, error: "3PL 물류창고는 연결 회사를 반드시 선택해야 합니다." };
  }
  if (payload.type === "partner" && !companyId) {
    return { success: false, error: "파트너 창고는 연결할 파트너 회사를 반드시 선택해야 합니다." };
  }

  // Validate: Default receiving active check
  if (payload.is_default_receiving && payload.status === "inactive") {
    return { success: false, error: "비활성 창고는 기본 입고 창고로 설정할 수 없습니다." };
  }

  // Validate: Default warehouse cannot be inactivated without changing default first
  if (!payload.is_default_receiving && payload.status === "inactive") {
    // Check if it was previously the default receiving warehouse
    const { data: current } = await supabase
      .from("warehouses")
      .select("is_default_receiving")
      .eq("id", id)
      .single();

    if (current?.is_default_receiving) {
      return {
        success: false,
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
    return { success: false, error: `이미 사용 중인 창고 코드입니다: ${code}` };
  }

  // Validate: Duplicate check on shipping_origin_id
  if (payload.shipping_origin_id) {
    const { data: duplicateOrigin } = await supabase
      .from("warehouses")
      .select("id, code, name")
      .eq("shipping_origin_id", payload.shipping_origin_id)
      .neq("id", id)
      .maybeSingle();

    if (duplicateOrigin) {
      return { success: false, error: `해당 출고지는 이미 다른 물류창고(${duplicateOrigin.code} · ${duplicateOrigin.name})와 연결되어 있습니다.` };
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
      return { success: false, error: "기존 기본 입고 창고 설정을 변경하지 못했습니다." };
    }
  }

  let updatePayload: any = {
    name: payload.name.trim(),
    code,
    company_id: companyId,
    type: payload.type,
    status: payload.status,
    is_default_receiving: payload.is_default_receiving,
    address1: payload.address1.trim(),
    address2: payload.address2 ? payload.address2.trim() : null,
    city: payload.city.trim(),
    state: payload.state.trim(),
    zip_code: payload.zip_code.trim(),
    country: payload.country.trim(),
    internal_note: payload.internal_note ? payload.internal_note.trim() : null,
    updated_at: new Date().toISOString()
  };

  if (payload.shipping_origin_id !== undefined) {
    updatePayload.shipping_origin_id = payload.shipping_origin_id || null;
  }

  let { error: updateError } = await supabase
    .from("warehouses")
    .update(updatePayload)
    .eq("id", id);

  // Resilient fallback for unmigrated database schema constraints
  if (updateError) {
    let handled = false;
    // Fallback 1: company_id NOT NULL constraint
    if (updateError.message.includes('null value in column "company_id"') && payload.type === "own") {
      const { data: defaultComp } = await supabase.from("companies").select("id").eq("status", "active").limit(1).maybeSingle();
      if (defaultComp) {
        updatePayload.company_id = defaultComp.id;
        const retry = await supabase.from("warehouses").update(updatePayload).eq("id", id);
        if (!retry.error) handled = true;
      }
    }

    // Fallback 2: type check constraint (partner)
    if (updateError.message.includes('violates check constraint "warehouses_type_check"') && payload.type === "partner") {
      updatePayload.type = "3pl";
      updatePayload.internal_note = (updatePayload.internal_note ? updatePayload.internal_note + "\n" : "") + "[TYPE:partner]";
      const retry = await supabase.from("warehouses").update(updatePayload).eq("id", id);
      if (!retry.error) handled = true;
    }

    // Fallback 3: column shipping_origin_id does not exist
    if (updateError.message.includes('column "shipping_origin_id" of relation "warehouses" does not exist') || updateError.message.includes('column "shipping_origin_id" does not exist')) {
      delete updatePayload.shipping_origin_id;
      if (payload.shipping_origin_id) {
        updatePayload.internal_note = (updatePayload.internal_note ? updatePayload.internal_note + "\n" : "") + `[ORIGIN_ID:${payload.shipping_origin_id}]`;
      }
      const retry = await supabase.from("warehouses").update(updatePayload).eq("id", id);
      if (!retry.error) handled = true;
    }

    if (!handled) {
      console.error("Error updating warehouse:", updateError);
      return { success: false, error: "물류창고 수정에 실패했습니다. 입력값을 확인해주세요." };
    }
  }

  revalidatePath("/admin/settings/warehouses");
  if (companyId) {
    revalidatePath(`/admin/companies/${companyId}`);
  }
  revalidatePath("/portal/company/info");
  return { success: true };
}

/**
 * Delete a warehouse
 */
export async function deleteWarehouse(id: string) {
  await verifyAdminSession();
  const supabase = await createClient();

  // Validate: Cannot delete default receiving warehouse
  const { data: current } = await supabase
    .from("warehouses")
    .select("company_id, is_default_receiving")
    .eq("id", id)
    .single();

  if (current?.is_default_receiving) {
    return { success: false, error: "기본 입고 창고로 설정된 물류창고는 삭제할 수 없습니다." };
  }

  const { error } = await supabase
    .from("warehouses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting warehouse:", error);
    return { success: false, error: "물류창고 삭제에 실패했습니다. 다른 데이터에서 참조 중인지 확인하십시오." };
  }

  revalidatePath("/admin/settings/warehouses");
  if (current?.company_id) {
    revalidatePath(`/admin/companies/${current.company_id}`);
  }
  revalidatePath("/portal/company/info");
  return { success: true };
}
