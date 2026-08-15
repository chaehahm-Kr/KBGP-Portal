import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedFileUrl } from "@/lib/files/storage";
import { TradingProductDetail } from "@/components/admin/trading-product-detail";
import { getProductInventory } from "@/lib/inventory/actions";

export const metadata: Metadata = {
  title: "제품 운영 정보 (360° View) | K SELECT NETWORK 어드민",
};

export default async function AdminTradingProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`
      id, name, name_en, category, volume, estimated_retail_price, brand_id, company_id,
      description, bullet_points, origin, lead_time,
      parent_sku, child_sku, manufacture_sku, letusto_sku, upc, ean,
      price_krw_retail, price_krw_wholesale, price_usd_fob, price_additional_info,
      item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      selection_status, sales_status, category_code, trading_status
    `)
    .eq("id", id)
    .maybeSingle();

  // If the product doesn't exist or is not a trading product, return not found
  if (!product || product.trading_status === "inactive") {
    notFound();
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", product.brand_id)
    .maybeSingle();

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", product.company_id)
    .maybeSingle();

  // Fetch all categories to build full path mappings
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

  const categoryFullPath = product.category_code ? getCategoryFullPath(product.category_code) : "";

  // Get primary image
  const adminSupabase = createAdminClient();
  const { data: images } = await adminSupabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", id)
    .order("position", { ascending: true })
    .limit(1);

  let photoUrl: string | null = null;
  if (images && images.length > 0 && images[0].storage_path) {
    try {
      photoUrl = await getSignedFileUrl(images[0].storage_path);
    } catch {
      // Ignore URL error
    }
  }

  const adminOverrides = (product.price_additional_info as any)?.admin_overrides || {};
  const resolvedProduct = {
    id: product.id,
    name: product.name,
    display_name: adminOverrides.name_en || product.name_en || adminOverrides.name || product.name,
    manufacture_sku: adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : product.manufacture_sku,
    letusto_sku: adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : product.letusto_sku,
    parent_sku: adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : product.parent_sku,
    child_sku: adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : product.child_sku,
    category: product.category,
    brand_id: product.brand_id,
    company_id: product.company_id,
    companyName: company?.name || "(미지정 회사)",
    brandName: brand?.name || "(미지정 브랜드)",
    photoUrl,
    selection_status: product.selection_status,
    sales_status: product.sales_status,
    trading_status: product.trading_status,
    category_code: product.category_code || null,
    category_full_path: categoryFullPath,
    price_usd_fob: adminOverrides.price_usd_fob !== undefined ? parseFloat(adminOverrides.price_usd_fob) : (product.price_usd_fob || 0),
  };

  // Get detailed inventory breakdown and movement logs
  const { balances, movements } = await getProductInventory(id);

  // Fetch active warehouses for Opening Balance / Adjustment inputs
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  const warehouses = dbWarehouses ?? [];

  // Fetch PO history for this product
  const { data: poHistory } = await supabase
    .from("purchase_order_lines")
    .select(`
      id, qty, unit_cost, created_at,
      purchase_orders!inner(id, po_number, order_date, po_status, supplier_id, companies:supplier_id(name))
    `)
    .eq("product_id", id)
    .order("created_at", { ascending: false });

  // Fetch Shipment history for this product
  const { data: shipmentHistory } = await supabase
    .from("inbound_shipment_lines")
    .select(`
      id, shipped_qty, created_at,
      inbound_shipments!inner(id, shipment_number, status, shipping_method, etd, eta, destination_warehouse_id, warehouses:destination_warehouse_id(name, code))
    `)
    .eq("product_id", id)
    .order("created_at", { ascending: false });

  // Fetch Receiving history for this product
  const { data: receivingHistory } = await supabase
    .from("receiving_lines")
    .select(`
      id, received_qty, damaged_qty, hold_qty, created_at,
      receivings!inner(id, receiving_number, status, received_date, warehouse_id, warehouses:warehouse_id(name, code))
    `)
    .eq("product_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <TradingProductDetail
        product={resolvedProduct}
        initialBalances={balances}
        initialMovements={movements}
        warehouses={warehouses}
        poHistory={poHistory || []}
        shipmentHistory={shipmentHistory || []}
        receivingHistory={receivingHistory || []}
      />
    </div>
  );
}
