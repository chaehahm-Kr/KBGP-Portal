import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { TradingProductsList } from "@/components/admin/trading-products-list";

export const metadata: Metadata = {
  title: "거래 대상 제품 관리 (Trading Products) | K SELECT NETWORK 어드민",
};

export default async function AdminTradingProductsPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch products where trading_status is active or historical
  let products: any[] | null = null;
  const { data: firstQueryProducts, error: queryError } = await supabase
    .from("products")
    .select("id, name, name_en, category, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, price_additional_info, origin, category_code, selection_status, sales_status, trading_status")
    .in("trading_status", ["active", "historical"])
    .order("created_at", { ascending: false });

  if (queryError && (
    queryError.message?.includes("deleted_at") || 
    queryError.message?.includes("category_code") || 
    queryError.code === "PGRST100" || 
    queryError.message?.includes("column")
  )) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, name_en, category, category_code, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, price_additional_info, origin, selection_status, sales_status, trading_status")
      .in("trading_status", ["active", "historical"])
      .order("created_at", { ascending: false });
    products = fallbackResult.data;
  } else {
    products = firstQueryProducts;
  }

  // 2. Fetch all companies for name mapping
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name");
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  // 3. Fetch all brands for name mapping
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name");
  const brandNameById = new Map((brands ?? []).map((b) => [b.id, b.name]));

  // 4. Fetch all categories to build full path mappings
  const { data: dbCategories } = await supabase
    .from("categories")
    .select("code, name_ko, parent_code, depth");
  const categoryMap = new Map((dbCategories ?? []).map((c) => [c.code, c]));

  const getCategoryFullPath = (code: string | null | undefined): string => {
    if (!code) return "";
    const path: string[] = [];
    let current = categoryMap.get(code);
    while (current) {
      path.unshift(current.name_ko);
      current = current.parent_code ? categoryMap.get(current.parent_code) : undefined;
    }
    return path.join(" > ");
  };

  // 5. Fetch first images (lowest position) for products to display thumbnail
  const { data: productImages } = await supabase
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .order("position", { ascending: true });

  // 6. Fetch all inventory balances to compute sum totals per product
  const { data: allBalances } = await supabase
    .from("inventory_balances")
    .select("product_id, qty_on_hand, qty_hold");

  const onHandByProduct = new Map<string, number>();
  const holdByProduct = new Map<string, number>();

  (allBalances ?? []).forEach((b) => {
    onHandByProduct.set(b.product_id, (onHandByProduct.get(b.product_id) || 0) + b.qty_on_hand);
    holdByProduct.set(b.product_id, (holdByProduct.get(b.product_id) || 0) + b.qty_hold);
  });

  const resolvedProducts = await Promise.all(
    (products ?? []).map(async (p) => {
      // Find the first image for this product
      const firstImage = (productImages ?? []).find((img) => img.product_id === p.id);
      let photoUrl: string | null = null;
      if (firstImage?.storage_path) {
        try {
          photoUrl = await getSignedFileUrl(firstImage.storage_path);
        } catch {
          // Ignore signed URL error
        }
      }

      const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
      const effectiveBrandId = p.brand_id;
      const effectiveNameEn = adminOverrides.name_en !== undefined && adminOverrides.name_en !== "" ? adminOverrides.name_en : p.name_en;
      const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined && adminOverrides.manufacture_sku !== "" ? adminOverrides.manufacture_sku : p.manufacture_sku;

      const totalOnHand = onHandByProduct.get(p.id) || 0;
      const totalHold = holdByProduct.get(p.id) || 0;
      const totalAvailable = totalOnHand - totalHold;

      return {
        id: p.id,
        name: p.name,
        display_name: adminOverrides.name_en || p.name_en || adminOverrides.name || p.name,
        manufacture_sku: p.manufacture_sku,
        display_manufacture_sku: effectiveManufactureSku,
        letusto_sku: adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku,
        parent_sku: adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : p.parent_sku,
        child_sku: adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : p.child_sku,
        category: p.category,
        brand_id: p.brand_id,
        company_id: p.company_id,
        companyName: companyNameById.get(p.company_id) || "(미지정 회사)",
        brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
        photoUrl,
        selection_status: p.selection_status || "UNREVIEWED",
        sales_status: p.sales_status || "PREPARING",
        trading_status: p.trading_status || "inactive",
        category_code: p.category_code || null,
        category_full_path: p.category_code ? getCategoryFullPath(p.category_code) : null,
        qty_on_hand: totalOnHand,
        qty_available: totalAvailable,
      };
    })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">거래 대상 제품 관리 (Trading Products)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          실제 Letusto/K SELECT가 구매, 입고, 재고 및 판매 운영 대상으로 관리하는 선정 제품 목록입니다.
        </p>
      </div>

      <TradingProductsList initialProducts={resolvedProducts} />
    </div>
  );
}
