"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export interface WarehousePayload {
  name: string;
  code: string;
  company_id: string;
  type: "own" | "3pl" | "other";
  status: "active" | "inactive";
  is_default_receiving: boolean;
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  internal_note?: string | null;
}

export interface WarehouseRow extends WarehousePayload {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all warehouses with associated company names
 */
export async function getWarehouses() {
  await verifyAdminSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("warehouses")
    .select(`
      *,
      companies (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching warehouses:", error);
    throw new Error("물류창고 정보를 가져오지 못했습니다.");
  }

  return (data || []) as (WarehouseRow & { companies: { name: string } | null })[];
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

  // If set as default, unset other defaults for the same company first
  if (payload.is_default_receiving) {
    const { error: unsetError } = await supabase
      .from("warehouses")
      .update({ is_default_receiving: false })
      .eq("company_id", payload.company_id);

    if (unsetError) {
      console.error("Error unsetting existing defaults:", unsetError);
      return { success: false, error: "기존 기본 입고 창고 설정을 변경하지 못했습니다." };
    }
  }

  const { error: insertError } = await supabase
    .from("warehouses")
    .insert({
      name: payload.name.trim(),
      code,
      company_id: payload.company_id,
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
    });

  if (insertError) {
    console.error("Error creating warehouse:", insertError);
    return { success: false, error: "물류창고 등록에 실패했습니다. 입력값을 확인해주세요." };
  }

  revalidatePath("/admin/settings/warehouses");
  return { success: true };
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

  // If updating default to true, unset other defaults for the same company first
  if (payload.is_default_receiving) {
    const { error: unsetError } = await supabase
      .from("warehouses")
      .update({ is_default_receiving: false })
      .eq("company_id", payload.company_id)
      .neq("id", id);

    if (unsetError) {
      console.error("Error unsetting existing defaults during update:", unsetError);
      return { success: false, error: "기존 기본 입고 창고 설정을 변경하지 못했습니다." };
    }
  }

  const { error: updateError } = await supabase
    .from("warehouses")
    .update({
      name: payload.name.trim(),
      code,
      company_id: payload.company_id,
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
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating warehouse:", updateError);
    return { success: false, error: "물류창고 수정에 실패했습니다. 입력값을 확인해주세요." };
  }

  revalidatePath("/admin/settings/warehouses");
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
    .select("is_default_receiving")
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
  return { success: true };
}
