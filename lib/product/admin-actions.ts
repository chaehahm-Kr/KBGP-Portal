"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function adminUpdateProductOverrides(
  productId: string,
  overrides: Record<string, any>
) {
  await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch current price_additional_info
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("price_additional_info")
    .eq("id", productId)
    .single();

  if (fetchError || !product) {
    throw new Error(fetchError?.message || "제품을 찾을 수 없습니다.");
  }

  const currentMeta = (product.price_additional_info as Record<string, any>) || {};
  const currentOverrides = (currentMeta.admin_overrides as Record<string, any>) || {};

  // Extract and clean letusto_sku, brand_id, selection_status, and sales_status from the overrides payload to save them to database columns directly
  const cleanOverrides = { ...overrides };
  const letustoSku = cleanOverrides.letusto_sku;
  const brandId = cleanOverrides.brand_id;
  const selectionStatus = cleanOverrides.selection_status;
  const salesStatus = cleanOverrides.sales_status;

  delete cleanOverrides.letusto_sku;
  delete cleanOverrides.brand_id;
  delete cleanOverrides.selection_status;
  delete cleanOverrides.sales_status;

  if (currentOverrides.letusto_sku !== undefined) {
    delete currentOverrides.letusto_sku;
  }
  if (currentOverrides.brand_id !== undefined) {
    delete currentOverrides.brand_id;
  }
  if (currentOverrides.selection_status !== undefined) {
    delete currentOverrides.selection_status;
  }
  if (currentOverrides.sales_status !== undefined) {
    delete currentOverrides.sales_status;
  }

  // Merge the new overrides into existing admin_overrides
  const updatedMeta = {
    ...currentMeta,
    admin_overrides: {
      ...currentOverrides,
      ...cleanOverrides,
    },
  };

  const updateData: Record<string, any> = {
    price_additional_info: updatedMeta,
  };

  if (letustoSku !== undefined) {
    updateData.letusto_sku = letustoSku && letustoSku.trim() !== "" ? letustoSku.trim() : null;
  }
  if (brandId !== undefined && brandId !== "") {
    updateData.brand_id = brandId;
  }
  if (selectionStatus !== undefined) {
    updateData.selection_status = selectionStatus;
  }
  if (salesStatus !== undefined) {
    updateData.sales_status = salesStatus;
  }

  // 2. Update the product using createAdminClient to bypass UPDATE RLS restrictions (since admins do not have matching company_id)
  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from("products")
    .update(updateData)
    .eq("id", productId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products`);
  revalidatePath(`/portal/products/${productId}`);
  revalidatePath(`/portal/products`);
  return { success: true };
}

export async function adminGetProductCuration(productId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Get product curation info
  const { data: curation } = await supabase
    .from("product_curations")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  // 2. Get matrix roles
  const { data: matrixRows } = await supabase
    .from("product_curation_matrix")
    .select(`
      ap_id,
      priority_role,
      assortment_profiles (
        display_program,
        code
      )
    `)
    .eq("product_id", productId);

  // Convert matrix list to flat record
  const matrix: Record<string, string> = {};
  if (matrixRows) {
    matrixRows.forEach((row: any) => {
      const ap = row.assortment_profiles;
      if (ap) {
        matrix[`${ap.display_program}:${ap.code}`] = row.priority_role;
      }
    });
  }

  return {
    curation: curation || {
      status: "NOT_REVIEWED",
      curator: "",
      last_review_date: null,
      next_review_date: null,
      role: "SUPPORT",
    },
    matrix,
  };
}

export async function adminUpdateProductCuration(
  productId: string,
  curationPayload: {
    status: string;
    curator: string;
    last_review_date: string | null;
    next_review_date: string | null;
    role: string;
  },
  matrixPayload: Record<string, string>
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch current DB product_curations & matrix for delta-check
  const { data: dbCuration } = await supabase
    .from("product_curations")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  const { data: dbMatrixRows } = await supabase
    .from("product_curation_matrix")
    .select(`
      priority_role,
      assortment_profiles (
        display_program,
        code
      )
    `)
    .eq("product_id", productId);

  // Convert db matrix to key-value
  const dbMatrix: Record<string, string> = {};
  if (dbMatrixRows) {
    dbMatrixRows.forEach((row: any) => {
      const ap = row.assortment_profiles;
      if (ap) {
        dbMatrix[`${ap.display_program}:${ap.code}`] = row.priority_role;
      }
    });
  }

  // Delta check helper
  let isCurationChanged = false;

  if (!dbCuration) {
    // If there is no DB curation yet, it's a new entry -> definitely changed
    isCurationChanged = true;
  } else {
    // Compare basic fields
    const curStatus = dbCuration.status || "NOT_REVIEWED";
    const curCurator = dbCuration.curator || "";
    const curRole = dbCuration.role || "SUPPORT";
    const curNextReview = dbCuration.next_review_date || "";

    const newStatus = curationPayload.status || "NOT_REVIEWED";
    const newCurator = curationPayload.curator || "";
    const newRole = curationPayload.role || "SUPPORT";
    const newNextReview = curationPayload.next_review_date || "";

    if (
      curStatus !== newStatus ||
      curCurator !== newCurator ||
      curRole !== newRole ||
      curNextReview !== newNextReview
    ) {
      isCurationChanged = true;
    }

    // Compare matrix rows (18 permutations)
    const programs = ["START_4FT", "GROW_8FT", "EXPAND_12FT"];
    const apCodes = ["AP-01", "AP-02", "AP-03", "AP-04", "AP-05", "AP-06"];
    for (const prog of programs) {
      for (const code of apCodes) {
        const key = `${prog}:${code}`;
        const dbVal = dbMatrix[key] || "EXCLUDE";
        const newVal = matrixPayload[key] || "EXCLUDE";
        if (dbVal !== newVal) {
          isCurationChanged = true;
        }
      }
    }
  }

  // Calculate review dates
  let finalLastReviewDate = dbCuration?.last_review_date || null;
  let finalNextReviewDate = curationPayload.next_review_date || null;

  if (isCurationChanged) {
    // If changed, automatically set last review date to today
    finalLastReviewDate = new Date().toISOString().split("T")[0];

    // If next review date is blank, suggest/auto-calculate last_review_date + 90 days
    if (!finalNextReviewDate) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 90);
      finalNextReviewDate = nextDate.toISOString().split("T")[0];
    }
  }

  // 2. Upsert product_curations
  const { error: curationError } = await supabase
    .from("product_curations")
    .upsert({
      product_id: productId,
      status: curationPayload.status,
      curator: curationPayload.curator || null,
      last_review_date: finalLastReviewDate,
      next_review_date: finalNextReviewDate,
      role: curationPayload.role,
      updated_at: new Date().toISOString(),
    });

  if (curationError) {
    throw new Error(`큐레이션 정보 저장 실패: ${curationError.message}`);
  }

  // 3. Fetch all assortment profiles to map program+code to ID
  const { data: profiles, error: profileError } = await supabase
    .from("assortment_profiles")
    .select("id, display_program, code");

  if (profileError || !profiles) {
    throw new Error(`Assortment Profile 로드 실패: ${profileError?.message || "데이터 없음"}`);
  }

  // Build mapping map
  const profileMap: Record<string, number> = {};
  profiles.forEach((p) => {
    profileMap[`${p.display_program}:${p.code}`] = p.id;
  });

  // Prepare batch upsert for matrix
  const upsertRows: any[] = [];
  const deleteApIds: number[] = [];

  const programs = ["START_4FT", "GROW_8FT", "EXPAND_12FT"];
  const apCodes = ["AP-01", "AP-02", "AP-03", "AP-04", "AP-05", "AP-06"];

  for (const prog of programs) {
    for (const code of apCodes) {
      const key = `${prog}:${code}`;
      const role = matrixPayload[key] || "EXCLUDE";
      const apId = profileMap[key];

      if (apId) {
        if (role === "EXCLUDE") {
          deleteApIds.push(apId);
        } else {
          upsertRows.push({
            product_id: productId,
            ap_id: apId,
            priority_role: role,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Execute Upsert for matrix
  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("product_curation_matrix")
      .upsert(upsertRows);

    if (upsertError) {
      throw new Error(`매트릭스 롤 저장 실패: ${upsertError.message}`);
    }
  }

  // Execute Delete/Clean-up for EXCLUDE ones
  if (deleteApIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("product_curation_matrix")
      .delete()
      .eq("product_id", productId)
      .in("ap_id", deleteApIds);

    if (deleteError) {
      throw new Error(`매트릭스 제외 처리 실패: ${deleteError.message}`);
    }
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/curation`);
  return { success: true };
}

export async function adminUpdateAPInfo(
  apId: number,
  info: { name: string; description: string; target_sku: number }
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("assortment_profiles")
    .update({
      name: info.name,
      description: info.description || null,
      target_sku: info.target_sku,
      updated_at: new Date().toISOString(),
    })
    .eq("id", apId);

  if (error) {
    throw new Error(`AP 정보 저장 실패: ${error.message}`);
  }

  revalidatePath(`/admin/products/curation`);
  revalidatePath(`/admin/settings/curation`);
  return { success: true };
}

export async function adminUpdateAPSettings(
  apId: number,
  info: { name: string; description: string; is_active: boolean }
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("assortment_profiles")
    .update({
      name: info.name,
      description: info.description || null,
      is_active: info.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", apId);

  if (error) {
    throw new Error(`AP 설정 저장 실패: ${error.message}`);
  }

  revalidatePath(`/admin/products/curation`);
  revalidatePath(`/admin/settings/curation`);
  return { success: true };
}

export async function adminUpdateDisplayProgram(
  code: string,
  info: { name: string; description: string; is_active: boolean }
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("display_programs")
    .update({
      name: info.name,
      description: info.description || null,
      is_active: info.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);

  if (error) {
    throw new Error(`Display Program 설정 저장 실패: ${error.message}`);
  }

  // If a display program is deactivated, also deactivate all its assortment profiles!
  if (!info.is_active) {
    const { error: apDeactivateError } = await supabase
      .from("assortment_profiles")
      .update({ is_active: false })
      .eq("display_program", code);

    if (apDeactivateError) {
      console.error("Failed to deactivate profiles for deactivated program:", apDeactivateError);
    }
  }

  revalidatePath(`/admin/products/curation`);
  revalidatePath(`/admin/settings/curation`);
  return { success: true };
}

export async function adminAddProductToAP(apId: number, productId: string, role: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("product_curation_matrix")
    .upsert({
      product_id: productId,
      ap_id: apId,
      priority_role: role,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`상품 추가 실패: ${error.message}`);
  }

  await logCurationHistory(apId, `상품 추가 (제품 ID: ${productId}, 역할: ${role})`);
  revalidatePath(`/admin/products/curation`);
  return { success: true };
}

export async function adminRemoveProductFromAP(apId: number, productId: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("product_curation_matrix")
    .delete()
    .eq("product_id", productId)
    .eq("ap_id", apId);

  if (error) {
    throw new Error(`상품 제외 실패: ${error.message}`);
  }

  await logCurationHistory(apId, `상품 제외 (제품 ID: ${productId})`);
  revalidatePath(`/admin/products/curation`);
  return { success: true };
}

export async function adminChangeProductRoleInAP(apId: number, productId: string, role: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("product_curation_matrix")
    .update({
      priority_role: role,
      updated_at: new Date().toISOString(),
    })
    .eq("product_id", productId)
    .eq("ap_id", apId);

  if (error) {
    throw new Error(`진열 우선순위 역할 변경 실패: ${error.message}`);
  }

  await logCurationHistory(apId, `상품 역할 변경 (제품 ID: ${productId} ➡️ ${role})`);
  revalidatePath(`/admin/products/curation`);
  return { success: true };
}

export async function adminReplaceProductInAP(apId: number, oldProductId: string, newProductId: string, role: string) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Delete old
  const { error: delError } = await supabase
    .from("product_curation_matrix")
    .delete()
    .eq("product_id", oldProductId)
    .eq("ap_id", apId);

  if (delError) {
    throw new Error(`대체 대상 삭제 실패: ${delError.message}`);
  }

  // 2. Insert new
  const { error: insError } = await supabase
    .from("product_curation_matrix")
    .upsert({
      product_id: newProductId,
      ap_id: apId,
      priority_role: role,
      updated_at: new Date().toISOString(),
    });

  if (insError) {
    throw new Error(`대체품 등록 실패: ${insError.message}`);
  }

  await logCurationHistory(apId, `상품 대체 (이전 ID: ${oldProductId} ➡️ 신규 ID: ${newProductId})`);
  revalidatePath(`/admin/products/curation`);
  return { success: true };
}

// 헬퍼: 히스토리 기록기
async function logCurationHistory(apId: number, note: string) {
  const supabase = createAdminClient();

  // 1. Get current max version
  const { data: latest } = await supabase
    .from("curation_history")
    .select("version")
    .eq("ap_id", apId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVer = (latest?.version || 0) + 1;

  // 2. Get current matrix snapshot
  const { data: matrix } = await supabase
    .from("product_curation_matrix")
    .select("product_id, priority_role")
    .eq("ap_id", apId);

  const snapshot = matrix || [];

  // 3. Insert history
  await supabase
    .from("curation_history")
    .insert({
      ap_id: apId,
      version: nextVer,
      snapshot_json: snapshot,
      updated_by: "어드민 운영자", // 임의 하드코딩 또는 세션 이메일
      change_note: note,
    });
}
