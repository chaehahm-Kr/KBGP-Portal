import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APDetailClient } from "./ap-detail-client";

export const metadata = {
  title: "Assortment Profile (AP) 진열 관리 | K SELECT NETWORK 어드민",
};

export default async function APDetailPage({
  params,
}: {
  params: Promise<{ program: string; apCode: string }>;
}) {
  const { program, apCode } = await params;
  await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch Assortment Profile details
  const { data: ap } = await supabase
    .from("assortment_profiles")
    .select("*")
    .eq("display_program", program)
    .eq("code", apCode)
    .single();

  if (!ap) {
    notFound();
  }

  // 2. Fetch Selected Products in this AP
  const { data: matrixItems } = await supabase
    .from("product_curation_matrix")
    .select(`
      priority_role,
      products (
        id,
        name,
        estimated_retail_price,
        price_usd_fob,
        sales_status,
        selection_status,
        letusto_sku,
        brand_id,
        category_code,
        brands (
          name
        )
      )
    `)
    .eq("ap_id", ap.id);

  // 3. Fetch Category details to map Level 1 & Level 2 categories
  const { data: categories } = await supabase
    .from("categories")
    .select("code, name_ko, name_en, depth, parent_code");

  // 4. Fetch All Products (for search/add features)
  const { data: allProducts } = await supabase
    .from("products")
    .select(`
      id,
      name,
      letusto_sku,
      brand_id,
      category_code,
      estimated_retail_price,
      price_usd_fob,
      sales_status,
      selection_status,
      brands (
        name
      )
    `)
    .eq("deleted_at", null)
    .order("name", { ascending: true });

  // Map product details with curation roles
  const selectedProducts = (matrixItems || []).map((row: any) => {
    const prod = row.products;
    return {
      id: prod.id,
      name: prod.name,
      letusto_sku: prod.letusto_sku || "지정 대기 중",
      brandName: prod.brands?.name || "(미지정)",
      brand_id: prod.brand_id,
      category_code: prod.category_code,
      estimated_retail_price: prod.estimated_retail_price || 0,
      price_usd_fob: prod.price_usd_fob || 0,
      sales_status: prod.sales_status,
      selection_status: prod.selection_status,
      curationRole: row.priority_role,
    };
  });

  return (
    <div className="space-y-6 w-full max-w-7xl pb-12">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
          <Link href="/admin/products/curation" className="hover:underline">
            큐레이션 컨트롤 센터
          </Link>
          <span>/</span>
          <span>{program === "START_4FT" ? "START 4FT" : program === "GROW_8FT" ? "GROW 8FT" : "EXPAND 12FT"}</span>
          <span>/</span>
          <span>{apCode}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            {ap.name} 진열 관리 및 분석
          </h1>
        </div>
      </div>

      <APDetailClient
        ap={ap}
        selectedProducts={selectedProducts}
        categories={categories || []}
        allProducts={(allProducts || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          letusto_sku: p.letusto_sku || "대기",
          brandName: p.brands?.name || "미지정",
          brand_id: p.brand_id,
          category_code: p.category_code,
          estimated_retail_price: p.estimated_retail_price || 0,
          price_usd_fob: p.price_usd_fob || 0,
          sales_status: p.sales_status,
          selection_status: p.selection_status,
        }))}
      />
    </div>
  );
}
