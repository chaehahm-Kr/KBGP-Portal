import React from "react";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CurationControlClient } from "./curation-control-client";

export const metadata = {
  title: "큐레이션 컨트롤 센터 | K SELECT NETWORK 어드민",
};

export default async function CurationControlCenterPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch Assortment Profiles
  const { data: aps, error: apError } = await supabase
    .from("assortment_profiles")
    .select("*")
    .order("code", { ascending: true });

  if (apError) {
    console.error("Failed to load assortment profiles:", apError);
  }

  // 2. Fetch Curation Matrix mapping items (with product brand and pricing)
  const { data: matrixItems, error: matrixError } = await supabase
    .from("product_curation_matrix")
    .select(`
      ap_id,
      priority_role,
      product_id,
      products (
        brand_id,
        estimated_retail_price,
        price_usd_fob,
        sales_status
      )
    `)
    .neq("priority_role", "EXCLUDE");

  if (matrixError) {
    console.error("Failed to load curation matrix:", matrixError);
  }

  // Initialize Stats
  const programStats: Record<string, { activeSku: number; brandIds: Set<string>; apCount: number; status: string }> = {
    START_4FT: { activeSku: 0, brandIds: new Set<string>(), apCount: 6, status: "ACTIVE" },
    GROW_8FT: { activeSku: 0, brandIds: new Set<string>(), apCount: 6, status: "ACTIVE" },
    EXPAND_12FT: { activeSku: 0, brandIds: new Set<string>(), apCount: 6, status: "ACTIVE" },
  };

  const apStats: Record<number, {
    selectedSku: number;
    brandIds: Set<string>;
    msrpSum: number;
    msrpCount: number;
    marginSum: number;
    marginCount: number;
  }> = {};

  (aps || []).forEach((ap) => {
    apStats[ap.id] = {
      selectedSku: 0,
      brandIds: new Set(),
      msrpSum: 0,
      msrpCount: 0,
      marginSum: 0,
      marginCount: 0,
    };
  });

  (matrixItems || []).forEach((row: any) => {
    const prod = row.products;
    if (!prod) return;

    const ap = (aps || []).find((a) => a.id === row.ap_id);
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

      // MSRP Price
      const msrp = prod.estimated_retail_price || 0;
      if (msrp > 0) {
        stats.msrpSum += msrp;
        stats.msrpCount++;
      }

      // Margin
      const fob = prod.price_usd_fob || 0;
      if (msrp > 0 && fob > 0) {
        const margin = ((msrp - fob) / msrp) * 100;
        stats.marginSum += margin;
        stats.marginCount++;
      }
    }
  });

  // Map to serializable structures for Client Component
  const serializablePrograms = Object.keys(programStats).map((key) => ({
    key,
    activeSku: programStats[key].activeSku,
    brandCount: programStats[key].brandIds.size,
    apCount: programStats[key].apCount,
    status: programStats[key].status,
  }));

  const serializableAPs = (aps || []).map((ap) => {
    const stats = apStats[ap.id] || { selectedSku: 0, brandIds: new Set(), msrpSum: 0, msrpCount: 0, marginSum: 0, marginCount: 0 };
    return {
      id: ap.id,
      display_program: ap.display_program,
      code: ap.code,
      name: ap.name,
      description: ap.description || "",
      target_sku: ap.target_sku,
      selectedSku: stats.selectedSku,
      brandCount: stats.brandIds.size,
      avgMsp: stats.msrpCount > 0 ? stats.msrpSum / stats.msrpCount : 0,
      avgMargin: stats.marginCount > 0 ? stats.marginSum / stats.marginCount : 0,
      status: ap.is_active ? "ACTIVE" : "HOLD",
    };
  });

  return (
    <div className="space-y-6 w-full max-w-7xl pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">큐레이션 컨트롤 센터 (Curation Control Center)</h1>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          전체 Assortment와 SKU 구성을 관리하고 Display Program별 진열 세트 구성을 분석합니다.
        </p>
      </div>

      <CurationControlClient
        initialPrograms={serializablePrograms}
        initialAPs={serializableAPs}
      />
    </div>
  );
}
