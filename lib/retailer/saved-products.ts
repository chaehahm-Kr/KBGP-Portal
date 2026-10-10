"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProducts, type RetailerCatalogFilters, type RetailerProductSummary } from "@/lib/retailer/products";

export interface RetailerCollection {
  id: string;
  retailerId: string;
  name: string;
  description: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedProductMapping {
  id: string;
  retailerId: string;
  collectionId: string | null;
  productId: string;
  createdAt: string;
}

/**
 * Helper to get the logged-in retailer's company ID
 */
async function getRetailerCompanyId(): Promise<{ companyId: string; userId: string } | null> {
  try {
    const session = await verifyRetailerSession();
    if (!session || !session.userId) return null;

    const adminClient = createAdminClient();
    const { data: cu } = await adminClient
      .from("company_users")
      .select("company_id, status")
      .eq("id", session.userId)
      .maybeSingle();

    if (!cu || cu.status !== "active" || !cu.company_id) return null;

    return { companyId: cu.company_id, userId: session.userId };
  } catch (err) {
    console.error("[Saved Products] Error resolving retailer company:", err);
    return null;
  }
}

/**
 * Fetch all collections for the logged-in retailer
 */
export async function getRetailerCollections(): Promise<RetailerCollection[]> {
  const auth = await getRetailerCompanyId();
  if (!auth) return [];

  const adminClient = createAdminClient();

  try {
    const { data: collections, error } = await adminClient
      .from("retailer_collections")
      .select("id, retailer_id, name, description, created_at, updated_at")
      .eq("retailer_id", auth.companyId)
      .order("created_at", { ascending: true });

    if (error) {
      // If table doesn't exist yet, return empty list gracefully
      return [];
    }

    // Get count of saved products per collection
    const { data: savedCounts } = await adminClient
      .from("retailer_saved_products")
      .select("collection_id")
      .eq("retailer_id", auth.companyId);

    const countMap: Record<string, number> = {};
    if (savedCounts) {
      savedCounts.forEach((row) => {
        const cId = row.collection_id || "default";
        countMap[cId] = (countMap[cId] || 0) + 1;
      });
    }

    return (collections || []).map((c) => ({
      id: c.id,
      retailerId: c.retailer_id,
      name: c.name,
      description: c.description,
      productCount: countMap[c.id] || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  } catch (err) {
    console.error("[Saved Products] getRetailerCollections error:", err);
    return [];
  }
}

/**
 * Create a new collection for the retailer
 */
export async function createRetailerCollection(
  name: string,
  description?: string
): Promise<{ success: boolean; collection?: RetailerCollection; error?: string }> {
  const auth = await getRetailerCompanyId();
  if (!auth) return { success: false, error: "Unauthorized" };

  const cleanName = name.trim();
  if (!cleanName) return { success: false, error: "Collection name is required" };

  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from("retailer_collections")
      .insert({
        retailer_id: auth.companyId,
        name: cleanName,
        description: description?.trim() || null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "A collection with this name already exists." };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/retailer/products");
    revalidatePath("/retailer/products/saved");

    return {
      success: true,
      collection: {
        id: data.id,
        retailerId: data.retailer_id,
        name: data.name,
        description: data.description,
        productCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create collection" };
  }
}

/**
 * Rename an existing collection
 */
export async function renameRetailerCollection(
  collectionId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await getRetailerCompanyId();
  if (!auth) return { success: false, error: "Unauthorized" };

  const cleanName = newName.trim();
  if (!cleanName) return { success: false, error: "Collection name is required" };

  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from("retailer_collections")
      .update({ name: cleanName, updated_at: new Date().toISOString() })
      .eq("id", collectionId)
      .eq("retailer_id", auth.companyId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/retailer/products");
    revalidatePath("/retailer/products/saved");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to rename collection" };
  }
}

/**
 * Delete a collection
 */
export async function deleteRetailerCollection(
  collectionId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await getRetailerCompanyId();
  if (!auth) return { success: false, error: "Unauthorized" };

  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from("retailer_collections")
      .delete()
      .eq("id", collectionId)
      .eq("retailer_id", auth.companyId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/retailer/products");
    revalidatePath("/retailer/products/saved");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete collection" };
  }
}

/**
 * Get all saved product IDs for the logged in retailer (optionally filtered by collectionId)
 */
export async function getRetailerSavedProductMap(): Promise<{
  savedProductIds: string[];
  productCollectionsMap: Record<string, string[]>; // productId -> array of collectionIds
}> {
  const auth = await getRetailerCompanyId();
  if (!auth) return { savedProductIds: [], productCollectionsMap: {} };

  const adminClient = createAdminClient();

  try {
    const { data, error } = await adminClient
      .from("retailer_saved_products")
      .select("product_id, collection_id")
      .eq("retailer_id", auth.companyId);

    if (error || !data) return { savedProductIds: [], productCollectionsMap: {} };

    const productIdsSet = new Set<string>();
    const productCollectionsMap: Record<string, string[]> = {};

    data.forEach((row) => {
      productIdsSet.add(row.product_id);
      if (!productCollectionsMap[row.product_id]) {
        productCollectionsMap[row.product_id] = [];
      }
      if (row.collection_id) {
        productCollectionsMap[row.product_id].push(row.collection_id);
      }
    });

    return {
      savedProductIds: Array.from(productIdsSet),
      productCollectionsMap,
    };
  } catch (err) {
    console.error("[Saved Products] getRetailerSavedProductMap error:", err);
    return { savedProductIds: [], productCollectionsMap: {} };
  }
}

/**
 * Toggle quick save/unsave for a product (or save to default)
 */
export async function toggleProductSavedAction(
  productId: string,
  collectionId?: string | null
): Promise<{ success: boolean; isSaved: boolean; error?: string }> {
  const auth = await getRetailerCompanyId();
  if (!auth) return { success: false, isSaved: false, error: "Unauthorized" };

  const adminClient = createAdminClient();

  try {
    let query = adminClient
      .from("retailer_saved_products")
      .select("id")
      .eq("retailer_id", auth.companyId)
      .eq("product_id", productId);

    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    } else {
      query = query.is("collection_id", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      // Delete / Unsave
      await adminClient.from("retailer_saved_products").delete().eq("id", existing.id);
      revalidatePath("/retailer/products");
      revalidatePath("/retailer/products/saved");
      return { success: true, isSaved: false };
    } else {
      // Insert / Save
      await adminClient.from("retailer_saved_products").insert({
        retailer_id: auth.companyId,
        product_id: productId,
        collection_id: collectionId || null,
        created_by: auth.userId,
      });
      revalidatePath("/retailer/products");
      revalidatePath("/retailer/products/saved");
      return { success: true, isSaved: true };
    }
  } catch (err: any) {
    return { success: false, isSaved: false, error: err.message || "Failed to update saved state" };
  }
}

/**
 * Set the exact list of collections a product belongs to
 */
export async function setProductCollectionsAction(
  productId: string,
  collectionIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const auth = await getRetailerCompanyId();
  if (!auth) return { success: false, error: "Unauthorized" };

  const adminClient = createAdminClient();

  try {
    // 1. Delete all existing collection mappings for this product & retailer
    await adminClient
      .from("retailer_saved_products")
      .delete()
      .eq("retailer_id", auth.companyId)
      .eq("product_id", productId);

    // 2. Insert new mappings
    if (collectionIds.length > 0) {
      const inserts = collectionIds.map((cId) => ({
        retailer_id: auth.companyId,
        product_id: productId,
        collection_id: cId === "default" || !cId ? null : cId,
        created_by: auth.userId,
      }));

      const { error } = await adminClient.from("retailer_saved_products").insert(inserts);
      if (error) throw error;
    }

    revalidatePath("/retailer/products");
    revalidatePath("/retailer/products/saved");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save collections" };
  }
}

/**
 * Get Saved Products Catalog (with full product summary data & filtering)
 */
export async function getSavedProductsCatalog(
  filters: RetailerCatalogFilters = {},
  collectionId?: string
): Promise<{
  products: RetailerProductSummary[];
  totalCount: number;
  collections: RetailerCollection[];
  activeCollectionId: string | "all";
}> {
  const auth = await getRetailerCompanyId();
  if (!auth) {
    return { products: [], totalCount: 0, collections: [], activeCollectionId: "all" };
  }

  const [collections, { savedProductIds, productCollectionsMap }, allCatalog] = await Promise.all([
    getRetailerCollections(),
    getRetailerSavedProductMap(),
    getRetailerProducts(filters),
  ]);

  let targetProductIds = savedProductIds;

  if (collectionId && collectionId !== "all") {
    targetProductIds = savedProductIds.filter((pId) => {
      const pCols = productCollectionsMap[pId] || [];
      if (collectionId === "default") {
        return pCols.length === 0;
      }
      return pCols.includes(collectionId);
    });
  }

  const savedProducts = allCatalog.products.filter((p) => targetProductIds.includes(p.id));

  return {
    products: savedProducts,
    totalCount: savedProducts.length,
    collections,
    activeCollectionId: collectionId || "all",
  };
}
