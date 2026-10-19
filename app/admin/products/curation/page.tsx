import React from "react";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { CurationManagementView } from "./curation-management-view";

export const metadata = {
  title: "큐레이션 관리 | K SELECT NETWORK 어드민",
  description: "Display Program별 진열 세트 상품 구성(Control) 및 마스터 프로필 설정(Settings)을 통합 관리합니다.",
};

export default async function CurationManagementPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const resolved = searchParams ? await searchParams : {};
  const rawTab = typeof resolved.tab === "string" ? resolved.tab : undefined;

  // Parallel fetch: 1. Display programs, 2. Assortment profiles with matching tags, 3. Curation matrix items
  const [
    { data: displayPrograms, error: progError },
    { data: profilesWithTags, error: apError },
    { data: matrixItems, error: matrixError },
  ] = await Promise.all([
    supabase
      .from("display_programs")
      .select("*")
      .order("code", { ascending: true }),
    supabase
      .from("assortment_profiles")
      .select(`
        *,
        ap_matching_tags(
          display_order,
          matching_tags(
            id,
            tag_code,
            name_ko,
            name_en,
            is_active
          )
        )
      `)
      .order("display_program", { ascending: true })
      .order("code", { ascending: true }),
    supabase
      .from("product_curation_matrix")
      .select(`
        ap_id,
        priority_role,
        product_id,
        products (
          brand_id,
          estimated_retail_price,
          price_usd_fob,
          sales_status,
          product_curations (
            wholesale_price,
            suggest_retail_price
          )
        )
      `)
      .neq("priority_role", "EXCLUDE"),
  ]);

  if (progError) {
    console.error("Failed to load display programs:", progError);
  }
  if (apError) {
    console.error("Failed to load assortment profiles:", apError);
  }
  if (matrixError) {
    console.error("Failed to load curation matrix:", matrixError);
  }

  // Initialize Stats for Curation Control
  const programStats: Record<string, { activeSku: number; brandIds: Set<string>; apCount: number; status: string }> = {
    START_4FT: { activeSku: 0, brandIds: new Set<string>(), apCount: 6, status: "ACTIVE" },
    GROW_8FT: { activeSku: 0, brandIds: new Set<string>(), apCount: 6, status: "ACTIVE" },
    EXPAND_12FT: { activeSku: 0, brandIds: new Set<string>(), apCount: 6, status: "ACTIVE" },
  };

  (displayPrograms || []).forEach((dp) => {
    if (!programStats[dp.code]) {
      programStats[dp.code] = {
        activeSku: 0,
        brandIds: new Set<string>(),
        apCount: 6,
        status: dp.is_active ? "ACTIVE" : "HOLD",
      };
    }
  });

  const apStats: Record<number, {
    selectedSku: number;
    brandIds: Set<string>;
    supplySum: number;
    msrpSum: number;
  }> = {};

  (profilesWithTags || []).forEach((ap) => {
    apStats[ap.id] = {
      selectedSku: 0,
      brandIds: new Set(),
      supplySum: 0,
      msrpSum: 0,
    };
  });

  (matrixItems || []).forEach((row: any) => {
    const prod = row.products;
    if (!prod) return;

    const ap = (profilesWithTags || []).find((a) => a.id === row.ap_id);
    if (!ap) return;

    // 1. Program Stats
    const progKey = ap.display_program;
    if (programStats[progKey]) {
      if (prod.sales_status === "ON_SALE") {
        programStats[progKey].activeSku++;
      }
      if (prod.brand_id) {
        programStats[progKey].brandIds.add(prod.brand_id);
      }
    }

    // 2. AP Stats
    const stats = apStats[row.ap_id];
    if (stats) {
      stats.selectedSku++;
      if (prod.brand_id) {
        stats.brandIds.add(prod.brand_id);
      }

      // Fetch pricing using product_curations values first
      const curation = prod.product_curations;
      const supply = curation?.wholesale_price !== undefined && curation?.wholesale_price !== null
        ? parseFloat(curation.wholesale_price)
        : (prod.price_usd_fob || 0);

      const msrp = curation?.suggest_retail_price !== undefined && curation?.suggest_retail_price !== null
        ? parseFloat(curation.suggest_retail_price)
        : (prod.estimated_retail_price || 0);

      if (supply > 0) {
        stats.supplySum += supply;
      }
      if (msrp > 0) {
        stats.msrpSum += msrp;
      }
    }
  });

  // Map to serializable structures for CurationControlClient
  const serializablePrograms = Object.keys(programStats).map((key) => ({
    key,
    activeSku: programStats[key].activeSku,
    brandCount: programStats[key].brandIds.size,
    apCount: programStats[key].apCount,
    status: programStats[key].status,
  }));

  const serializableAPs = (profilesWithTags || []).map((ap) => {
    const stats = apStats[ap.id] || { selectedSku: 0, brandIds: new Set(), supplySum: 0, msrpSum: 0 };
    const totalSupply = stats.supplySum;
    const totalMsrp = stats.msrpSum;
    const totalMargin = totalMsrp > 0 ? ((totalMsrp - totalSupply) / totalMsrp) * 100 : 0;

    return {
      id: ap.id,
      display_program: ap.display_program,
      code: ap.code,
      name: ap.name,
      description: ap.description || "",
      target_sku: ap.target_sku,
      selectedSku: stats.selectedSku,
      brandCount: stats.brandIds.size,
      totalSupply,
      totalMsrp,
      totalMargin,
      status: ap.is_active ? "ACTIVE" : "HOLD",
    };
  });

  return (
    <CurationManagementView
      initialPrograms={serializablePrograms}
      initialAPs={serializableAPs}
      settingsPrograms={displayPrograms || []}
      settingsProfiles={profilesWithTags || []}
      initialTab={rawTab}
    />
  );
}
