"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  queryProductPerformanceList,
  getProductPerformanceById,
} from "./performance-service";
import type {
  ProductPerformanceQueryOptions,
  ProductPerformanceQueryResult,
  ProductPerformanceSummary,
} from "./types";

export interface FilterOptionsData {
  brands: Array<{ id: string; name: string }>;
  categories: Array<{ code: string; name: string }>;
}

export interface ProductPerformancePageResponse {
  success: boolean;
  data?: ProductPerformanceQueryResult;
  error?: string;
}

export interface SingleProductPerformanceResponse {
  success: boolean;
  data?: ProductPerformanceSummary | null;
  error?: string;
}

/**
 * Server action to fetch paginated & filtered Product Performance list.
 * Protected by admin-only session check.
 */
export async function fetchProductPerformancePageAction(
  options: ProductPerformanceQueryOptions = {}
): Promise<ProductPerformancePageResponse> {
  try {
    await verifyAdminSession();
    const admin = createAdminClient();

    const data = await queryProductPerformanceList(
      {
        ...options,
        isRetailerView: false, // Admin view has full financial visibility
      },
      admin
    );

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    console.error("fetchProductPerformancePageAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to load product performance data.",
    };
  }
}

/**
 * Server action to fetch single product performance details.
 * Protected by admin-only session check.
 */
export async function fetchProductPerformanceByIdAction(
  productId: string,
  options: { asOfDate?: string; lookbackDays?: number; includeTestOrders?: boolean } = {}
): Promise<SingleProductPerformanceResponse> {
  try {
    await verifyAdminSession();
    const admin = createAdminClient();

    const data = await getProductPerformanceById(
      productId,
      {
        ...options,
        isRetailerView: false,
      },
      admin
    );

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    console.error("fetchProductPerformanceByIdAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to load SKU performance details.",
    };
  }
}

/**
 * Server action to fetch brands and categories for filtering dropdowns.
 */
export async function fetchPerformanceFilterOptionsAction(): Promise<{
  success: boolean;
  data?: FilterOptionsData;
  error?: string;
}> {
  try {
    await verifyAdminSession();
    const admin = createAdminClient();

    const [brandsRes, categoriesRes] = await Promise.all([
      admin.from("brands").select("id, name").order("name", { ascending: true }),
      admin.from("categories").select("code, name_ko, name_en, depth").order("depth", { ascending: true }),
    ]);

    const brands = (brandsRes.data || []).map((b) => ({
      id: b.id,
      name: b.name || "Unknown Brand",
    }));

    const categories = (categoriesRes.data || []).map((c) => ({
      code: c.code,
      name: c.name_ko || c.name_en || c.code,
    }));

    return {
      success: true,
      data: {
        brands,
        categories,
      },
    };
  } catch (err: any) {
    console.error("fetchPerformanceFilterOptionsAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to load filter options.",
    };
  }
}
