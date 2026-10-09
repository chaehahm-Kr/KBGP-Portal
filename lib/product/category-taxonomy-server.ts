import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CategoryItem } from "@/lib/product/category-taxonomy";

/**
 * Fetches the full active category master from Supabase categories table
 */
export async function getCategoryMaster(): Promise<CategoryItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("code, name_en, name_ko, depth, parent_code, display_order, is_active")
    .eq("is_active", true)
    .order("depth", { ascending: true })
    .order("display_order", { ascending: true });

  if (error || !data) {
    console.error("Error fetching categories master:", error);
    return [];
  }

  return data.map((c) => ({
    code: c.code,
    name_en: c.name_en || c.code,
    name_ko: c.name_ko || c.name_en || c.code,
    depth: (c.depth as 1 | 2 | 3) || 1,
    parent_code: c.parent_code || null,
    display_order: c.display_order || 0,
    product_count: 0,
  }));
}
