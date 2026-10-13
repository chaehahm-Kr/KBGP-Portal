"use server";

import { revalidatePath } from "next/cache";
import { getRetailerUserContext, verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  RetailerShippingAddress,
  CreateShippingAddressInput,
  UpdateShippingAddressInput,
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

    // If this address is set as default, unset other defaults
    if (input.isDefault) {
      await adminClient
        .from("retailer_shipping_addresses")
        .update({ is_default: false })
        .eq("company_id", companyId);
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

    revalidatePath("/retailer/settings/shipping");
    revalidatePath("/retailer/checkout");

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

    revalidatePath("/retailer/settings/shipping");
    revalidatePath("/retailer/checkout");

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

    revalidatePath("/retailer/settings/shipping");
    revalidatePath("/retailer/checkout");

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

    const { error } = await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/retailer/settings/shipping");
    revalidatePath("/retailer/checkout");

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
