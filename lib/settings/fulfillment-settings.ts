"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_ESTIMATED_SHIPPING_DAYS,
  type FulfillmentSettingsPayload,
} from "./fulfillment-constants";

/**
 * Fetch authoritative fulfillment settings from system_settings.
 * Falls back to 5 calendar days if not configured or table uninitialized.
 */
export async function getFulfillmentSettings(): Promise<FulfillmentSettingsPayload> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "fulfillment_settings")
      .maybeSingle();

    if (!error && data && data.value) {
      const val = data.value as any;
      const days = Number(val.default_estimated_shipping_days);
      if (Number.isInteger(days) && days >= 1 && days <= 30) {
        return {
          default_estimated_shipping_days: days,
          updated_at: val.updated_at,
        };
      }
    }
  } catch (err) {
    console.error("Failed to read fulfillment_settings from system_settings, using fallback:", err);
  }

  return {
    default_estimated_shipping_days: DEFAULT_ESTIMATED_SHIPPING_DAYS,
  };
}

/**
 * Update authoritative fulfillment settings in system_settings.
 * Requires admin session. Validates integer between 1 and 30 calendar days.
 */
export async function updateFulfillmentSettings(
  shippingDays: number
): Promise<FulfillmentSettingsPayload> {
  await verifyAdminSession();

  const days = Math.round(Number(shippingDays));
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new Error("예상 배송 기간은 1일에서 30일 사이의 정수여야 합니다.");
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const payload: FulfillmentSettingsPayload = {
    default_estimated_shipping_days: days,
    updated_at: nowIso,
  };

  const { error } = await admin
    .from("system_settings")
    .upsert({
      key: "fulfillment_settings",
      value: payload,
      updated_at: nowIso,
    });

  if (error) {
    console.error("Failed to save fulfillment_settings to system_settings:", error);
    throw new Error("물류 배송 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }

  revalidatePath("/admin/settings/warehouses");
  revalidatePath("/sales");

  return payload;
}
