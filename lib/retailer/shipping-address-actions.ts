"use server";

import { revalidatePath } from "next/cache";
import { getRetailerUserContext, verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  RetailerShippingAddress,
  CreateShippingAddressInput,
  UpdateShippingAddressInput,
  ResolvedDefaultShippingDestination,
  StoreShippingOption,
  RetailerShippingDestinationsResult,
} from "./shipping-address-types";

function mapRowToAddress(row: any): RetailerShippingAddress {
  return {
    id: row.id,
    companyId: row.company_id,
    label: row.label,
    recipientName: row.recipient_name,
    attentionName: row.attention_name || null,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 || null,
    city: row.city,
    state: row.state,
    zip: row.zip,
    country: row.country || "US",
    phone: row.phone || null,
    deliveryNotes: row.delivery_notes || null,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function revalidateShippingPaths() {
  revalidatePath("/retailer/settings/shipping");
  revalidatePath("/settings/shipping");
  revalidatePath("/retailer/checkout");
  revalidatePath("/checkout");
  revalidatePath("/retailer/cart");
  revalidatePath("/cart");
}

/**
 * Fetch all active saved shipping addresses for the authenticated Retailer company.
 * Strictly enforces tenant isolation via caller's authenticated company_id.
 */
export async function getRetailerShippingAddressesAction(): Promise<{
  success: boolean;
  data: RetailerShippingAddress[];
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, data: [], error: "No organization associated with this account." };
    }

    const adminClient = createAdminClient();
    const { data: rows, error } = await adminClient
      .from("retailer_shipping_addresses")
      .select("*")
      .eq("company_id", userContext.companyId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        // Table not yet created or schema cache pending
        return { success: true, data: [] };
      }
      return { success: false, data: [], error: error.message };
    }

    return {
      success: true,
      data: (rows || []).map(mapRowToAddress),
    };
  } catch (err: any) {
    console.error("getRetailerShippingAddressesAction error:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Create a new saved shipping address for the authenticated Retailer.
 */
export async function createRetailerShippingAddressAction(
  input: CreateShippingAddressInput
): Promise<{
  success: boolean;
  data?: RetailerShippingAddress;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    if (!input.label?.trim() || !input.recipientName?.trim() || !input.addressLine1?.trim() || !input.city?.trim() || !input.state?.trim() || !input.zip?.trim()) {
      return { success: false, error: "Label, recipient name, address, city, state, and zip are required." };
    }

    const adminClient = createAdminClient();
    const companyId = userContext.companyId;

    // If this address is set as default, unset other defaults (saved addresses and store default)
    if (input.isDefault) {
      await adminClient
        .from("retailer_shipping_addresses")
        .update({ is_default: false })
        .eq("company_id", companyId);

      try {
        await adminClient
          .from("companies")
          .update({ default_shipping_store_id: null })
          .eq("id", companyId);
      } catch (err) {
        console.warn("Could not clear company default_shipping_store_id:", err);
      }
    }

    const { data: newRow, error } = await adminClient
      .from("retailer_shipping_addresses")
      .insert({
        company_id: companyId,
        label: input.label.trim(),
        recipient_name: input.recipientName.trim(),
        attention_name: input.attentionName?.trim() || null,
        address_line1: input.addressLine1.trim(),
        address_line2: input.addressLine2?.trim() || null,
        city: input.city.trim(),
        state: input.state.trim().toUpperCase(),
        zip: input.zip.trim(),
        country: input.country?.trim() || "US",
        phone: input.phone?.trim() || null,
        delivery_notes: input.deliveryNotes?.trim() || null,
        is_default: Boolean(input.isDefault),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateShippingPaths();

    return {
      success: true,
      data: mapRowToAddress(newRow),
    };
  } catch (err: any) {
    console.error("createRetailerShippingAddressAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing saved shipping address.
 */
export async function updateRetailerShippingAddressAction(
  id: string,
  input: UpdateShippingAddressInput
): Promise<{
  success: boolean;
  data?: RetailerShippingAddress;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const adminClient = createAdminClient();
    const companyId = userContext.companyId;

    if (input.isDefault) {
      await adminClient
        .from("retailer_shipping_addresses")
        .update({ is_default: false })
        .eq("company_id", companyId);

      try {
        await adminClient
          .from("companies")
          .update({ default_shipping_store_id: null })
          .eq("id", companyId);
      } catch (err) {
        console.warn("Could not clear company default_shipping_store_id:", err);
      }
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (input.label !== undefined) updatePayload.label = input.label.trim();
    if (input.recipientName !== undefined) updatePayload.recipient_name = input.recipientName.trim();
    if (input.attentionName !== undefined) updatePayload.attention_name = input.attentionName?.trim() || null;
    if (input.addressLine1 !== undefined) updatePayload.address_line1 = input.addressLine1.trim();
    if (input.addressLine2 !== undefined) updatePayload.address_line2 = input.addressLine2?.trim() || null;
    if (input.city !== undefined) updatePayload.city = input.city.trim();
    if (input.state !== undefined) updatePayload.state = input.state.trim().toUpperCase();
    if (input.zip !== undefined) updatePayload.zip = input.zip.trim();
    if (input.country !== undefined) updatePayload.country = input.country.trim();
    if (input.phone !== undefined) updatePayload.phone = input.phone?.trim() || null;
    if (input.deliveryNotes !== undefined) updatePayload.delivery_notes = input.deliveryNotes?.trim() || null;
    if (input.isDefault !== undefined) updatePayload.is_default = Boolean(input.isDefault);
    if (input.isActive !== undefined) updatePayload.is_active = Boolean(input.isActive);

    const { data: updatedRow, error } = await adminClient
      .from("retailer_shipping_addresses")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateShippingPaths();

    return {
      success: true,
      data: mapRowToAddress(updatedRow),
    };
  } catch (err: any) {
    console.error("updateRetailerShippingAddressAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete (soft-delete) a saved shipping address.
 */
export async function deleteRetailerShippingAddressAction(
  id: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", userContext.companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateShippingPaths();

    return { success: true };
  } catch (err: any) {
    console.error("deleteRetailerShippingAddressAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Set an address as the default shipping address.
 */
export async function setDefaultRetailerShippingAddressAction(
  id: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const adminClient = createAdminClient();
    const companyId = userContext.companyId;

    await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_default: false })
      .eq("company_id", companyId);

    try {
      await adminClient
        .from("companies")
        .update({ default_shipping_store_id: null })
        .eq("id", companyId);
    } catch (err) {
      console.warn("Could not clear company default_shipping_store_id:", err);
    }

    const { error } = await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateShippingPaths();

    return { success: true };
  } catch (err: any) {
    console.error("setDefaultRetailerShippingAddressAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin Action: Fetch saved shipping addresses for any retailer company.
 */
export async function adminGetRetailerShippingAddressesAction(
  companyId: string
): Promise<{
  success: boolean;
  data: RetailerShippingAddress[];
  error?: string;
}> {
  try {
    await verifyAdminSession();
    const adminClient = createAdminClient();

    const { data: rows, error } = await adminClient
      .from("retailer_shipping_addresses")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return { success: true, data: [] };
      }
      return { success: false, data: [], error: error.message };
    }

    return {
      success: true,
      data: (rows || []).map(mapRowToAddress),
    };
  } catch (err: any) {
    console.error("adminGetRetailerShippingAddressesAction error:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Unset a saved shipping address as default, allowing Rule 2 store fallback to take effect.
 */
export async function unsetDefaultRetailerShippingAddressAction(
  id: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", userContext.companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/retailer/settings/shipping");
    revalidatePath("/retailer/checkout");
    revalidatePath("/checkout");
    revalidatePath("/retailer/cart");
    revalidatePath("/cart");

    return { success: true };
  } catch (err: any) {
    console.error("unsetDefaultRetailerShippingAddressAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Set an eligible registered store as the company's explicit default shipping destination.
 * Supersedes any previous saved warehouse default or previous store default (mutual exclusivity).
 */
export async function setDefaultStoreShippingAction(
  storeId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    // Verify store exists, belongs to company, is active, and has complete address
    const { data: store, error: storeErr } = await adminClient
      .from("stores")
      .select("id, name, address, city, state, zip, status")
      .eq("id", storeId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (storeErr || !store) {
      return { success: false, error: "Store not found or does not belong to your company." };
    }

    if (store.status !== "active") {
      return { success: false, error: "Only active stores can be set as default shipping destination." };
    }

    if (!store.address?.trim() || !store.city?.trim() || !store.state?.trim() || !store.zip?.trim()) {
      return {
        success: false,
        error: "Store requires a complete street address, city, state, and zip code before it can be set as default.",
      };
    }

    // 1. Set company default_shipping_store_id
    const { error: updateCompErr } = await adminClient
      .from("companies")
      .update({ default_shipping_store_id: storeId })
      .eq("id", companyId);

    if (updateCompErr) {
      return { success: false, error: updateCompErr.message };
    }

    // 2. Unset any saved warehouse address default to ensure strict mutual exclusivity
    await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_default: false })
      .eq("company_id", companyId);

    revalidateShippingPaths();

    return { success: true };
  } catch (err: any) {
    console.error("setDefaultStoreShippingAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Unset the company's explicit default shipping store destination,
 * smoothly reverting to deterministic first-eligible-store fallback (Rule 2).
 */
export async function unsetDefaultStoreShippingAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return { success: false, error: "No organization associated with this account." };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("companies")
      .update({ default_shipping_store_id: null })
      .eq("id", companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateShippingPaths();

    return { success: true };
  } catch (err: any) {
    console.error("unsetDefaultStoreShippingAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Authoritative Server Resolver for Company Default Shipping Destination:
 * - Rule 1A: Explicit Store Default configured on companies (default_shipping_store_id) with complete valid address.
 * - Rule 1B: Explicit Saved Address Default from retailer_shipping_addresses (is_default = true, is_active = true) with complete valid address.
 * - Rule 2: Deterministic store fallback to first eligible registered Store (status = 'active', complete address/city/state/zip), ordered by name ASC.
 * - Rule 3: If no eligible store/address exists, returns null.
 */
export async function resolveCompanyDefaultShippingDestination(
  companyId: string,
  client?: any
): Promise<ResolvedDefaultShippingDestination | null> {
  const adminClient = client || createAdminClient();

  // Rule 1A: Explicit store default configured on company
  try {
    const { data: comp, error: compErr } = await adminClient
      .from("companies")
      .select("default_shipping_store_id")
      .eq("id", companyId)
      .maybeSingle();

    if (!compErr && comp?.default_shipping_store_id) {
      const { data: store } = await adminClient
        .from("stores")
        .select("id, name, address, city, state, zip, phone, manager_name, status")
        .eq("id", comp.default_shipping_store_id)
        .eq("company_id", companyId)
        .eq("status", "active")
        .maybeSingle();

      if (
        store &&
        store.address?.trim() &&
        store.city?.trim() &&
        store.state?.trim() &&
        store.zip?.trim()
      ) {
        return {
          type: "store",
          id: store.id,
          name: store.name,
          recipientName: store.manager_name || store.name,
          attentionName: null,
          addressLine1: store.address.trim(),
          addressLine2: null,
          city: store.city.trim(),
          state: store.state.trim().toUpperCase(),
          zip: store.zip.trim(),
          country: "US",
          phone: store.phone || null,
          deliveryNotes: null,
          isExplicitDefault: true,
          isStoreFallback: false,
        };
      }
    }
  } catch (err) {
    console.warn("Could not query company default store:", err);
  }

  // Rule 1B: Saved address explicit default
  try {
    const { data: defaultSaved } = await adminClient
      .from("retailer_shipping_addresses")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (
      defaultSaved &&
      defaultSaved.address_line1?.trim() &&
      defaultSaved.city?.trim() &&
      defaultSaved.state?.trim() &&
      defaultSaved.zip?.trim()
    ) {
      return {
        type: "saved_address",
        id: defaultSaved.id,
        name: defaultSaved.label,
        recipientName: defaultSaved.recipient_name,
        attentionName: defaultSaved.attention_name || null,
        addressLine1: defaultSaved.address_line1.trim(),
        addressLine2: defaultSaved.address_line2?.trim() || null,
        city: defaultSaved.city.trim(),
        state: defaultSaved.state.trim().toUpperCase(),
        zip: defaultSaved.zip.trim(),
        country: defaultSaved.country?.trim() || "US",
        phone: defaultSaved.phone?.trim() || null,
        deliveryNotes: defaultSaved.delivery_notes?.trim() || null,
        isExplicitDefault: true,
        isStoreFallback: false,
      };
    }
  } catch (err) {
    console.warn("Could not query default saved address:", err);
  }

  // Rule 2: Deterministic store fallback
  try {
    const { data: storeRows } = await adminClient
      .from("stores")
      .select("id, name, address, city, state, zip, phone, manager_name, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (storeRows && storeRows.length > 0) {
      const eligibleStore = storeRows.find(
        (s: any) =>
          s.address?.trim() &&
          s.city?.trim() &&
          s.state?.trim() &&
          s.zip?.trim()
      );

      if (eligibleStore) {
        return {
          type: "store",
          id: eligibleStore.id,
          name: eligibleStore.name,
          recipientName: eligibleStore.manager_name || eligibleStore.name,
          attentionName: null,
          addressLine1: eligibleStore.address.trim(),
          addressLine2: null,
          city: eligibleStore.city.trim(),
          state: eligibleStore.state.trim().toUpperCase(),
          zip: eligibleStore.zip.trim(),
          country: "US",
          phone: eligibleStore.phone || null,
          deliveryNotes: null,
          isExplicitDefault: false,
          isStoreFallback: true,
        };
      }
    }
  } catch (err) {
    console.warn("Could not query store fallback:", err);
  }

  // Rule 3: No default shipping destination available
  return null;
}

/**
 * Fetches all saved shipping addresses, registered stores, and the resolved default destination
 * for the authenticated retailer's company.
 */
export async function getRetailerShippingDestinationsAction(): Promise<{
  success: boolean;
  data: RetailerShippingDestinationsResult;
  error?: string;
}> {
  try {
    const userContext = await getRetailerUserContext();
    if (!userContext.companyId) {
      return {
        success: false,
        data: { savedAddresses: [], stores: [], defaultDestination: null },
        error: "No organization associated with this account.",
      };
    }

    const companyId = userContext.companyId;
    const adminClient = createAdminClient();

    // 1. Fetch saved addresses
    let savedAddresses: RetailerShippingAddress[] = [];
    const { data: addressRows, error: addressErr } = await adminClient
      .from("retailer_shipping_addresses")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (!addressErr && addressRows) {
      savedAddresses = addressRows.map(mapRowToAddress);
    }

    // Query explicit default store id from companies
    let defaultStoreId: string | null = null;
    try {
      const { data: comp } = await adminClient
        .from("companies")
        .select("default_shipping_store_id")
        .eq("id", companyId)
        .maybeSingle();
      defaultStoreId = comp?.default_shipping_store_id || null;
    } catch (e) {
      console.warn("Could not fetch company default store id:", e);
    }

    // 2. Fetch stores
    let stores: StoreShippingOption[] = [];
    const { data: storeRows, error: storeErr } = await adminClient
      .from("stores")
      .select("id, name, address, city, state, zip, phone, manager_name, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (!storeErr && storeRows) {
      stores = storeRows.map((s: any) => ({
        id: s.id,
        name: s.name,
        address: s.address || null,
        city: s.city || null,
        state: s.state || null,
        zip: s.zip || null,
        phone: s.phone || null,
        managerName: s.manager_name || null,
        isEligible: Boolean(
          s.address?.trim() &&
          s.city?.trim() &&
          s.state?.trim() &&
          s.zip?.trim()
        ),
        isExplicitDefault: Boolean(defaultStoreId && defaultStoreId === s.id),
      }));
    }

    // 3. Authoritatively resolve default destination
    const defaultDestination = await resolveCompanyDefaultShippingDestination(
      companyId,
      adminClient
    );

    return {
      success: true,
      data: {
        savedAddresses,
        stores,
        defaultDestination,
      },
    };
  } catch (err: any) {
    console.error("getRetailerShippingDestinationsAction error:", err);
    return {
      success: false,
      data: { savedAddresses: [], stores: [], defaultDestination: null },
      error: err.message,
    };
  }
}

