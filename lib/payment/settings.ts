"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GlobalPaymentSettings, DEFAULT_GLOBAL_PAYMENT_SETTINGS } from "./types";

/**
 * Fetch global payment settings from system_settings with fallback to default constants
 */
export async function getGlobalPaymentSettings(): Promise<GlobalPaymentSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "payment_settings")
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      const val = data.value as Partial<GlobalPaymentSettings>;
      return {
        ...DEFAULT_GLOBAL_PAYMENT_SETTINGS,
        ...val,
        // Ensure numeric fields are properly typed numbers
        card_fee_rate:
          val.card_fee_rate !== undefined ? Number(val.card_fee_rate) : DEFAULT_GLOBAL_PAYMENT_SETTINGS.card_fee_rate,
        ach_fee_amount:
          val.ach_fee_amount !== undefined
            ? Number(val.ach_fee_amount)
            : DEFAULT_GLOBAL_PAYMENT_SETTINGS.ach_fee_amount,
        card_enabled:
          val.card_enabled !== undefined ? Boolean(val.card_enabled) : DEFAULT_GLOBAL_PAYMENT_SETTINGS.card_enabled,
        ach_enabled:
          val.ach_enabled !== undefined ? Boolean(val.ach_enabled) : DEFAULT_GLOBAL_PAYMENT_SETTINGS.ach_enabled,
        past_due_blocks_terms:
          val.past_due_blocks_terms !== undefined
            ? Boolean(val.past_due_blocks_terms)
            : DEFAULT_GLOBAL_PAYMENT_SETTINGS.past_due_blocks_terms,
      };
    }
  } catch (err) {
    console.error("Error reading payment_settings from system_settings, using defaults:", err);
  }

  return { ...DEFAULT_GLOBAL_PAYMENT_SETTINGS };
}

/**
 * Update global payment settings in system_settings
 */
export async function updateGlobalPaymentSettings(
  payload: Partial<GlobalPaymentSettings>
): Promise<{ success: boolean; error?: string }> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const current = await getGlobalPaymentSettings();

  // Validate numeric limits
  const cardRate =
    payload.card_fee_rate !== undefined ? Math.max(0, Number(payload.card_fee_rate)) : current.card_fee_rate;
  const achAmount =
    payload.ach_fee_amount !== undefined ? Math.max(0, Number(payload.ach_fee_amount)) : current.ach_fee_amount;

  const updatedSettings: GlobalPaymentSettings = {
    ...current,
    ...payload,
    card_fee_rate: cardRate,
    ach_fee_amount: achAmount,
    updated_at: new Date().toISOString(),
  };

  const { error } = await adminClient.from("system_settings").upsert({
    key: "payment_settings",
    value: updatedSettings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to save payment_settings to system_settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/settings/payments");
  revalidatePath("/admin/retailers");
  revalidatePath("/retailer/checkout");
  revalidatePath("/retailer/settings");

  return { success: true };
}
