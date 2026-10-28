import { createAdminClient } from "@/lib/supabase/admin";

export * from "./test-allowlist-shared";
import {
  EMAIL_FORMAT_REGEX,
} from "./test-allowlist-shared";

const SYSTEM_SETTINGS_ALLOWLIST_KEY = "marketing_test_allowlist";

// In-memory cache for fast lookup during tests and SSR
let memoryAllowlistCache: string[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Fetches the Owner-managed test allowlist from public.system_settings.
 * Also includes any entries configured via the EMAIL_TEST_ALLOWLIST environment variable.
 */
export async function getMarketingTestAllowlist(): Promise<string[]> {
  const now = Date.now();
  if (memoryAllowlistCache && now - lastCacheTime < CACHE_TTL_MS) {
    return memoryAllowlistCache;
  }

  const resultList = new Set<string>();

  // 1. Load from environment variable (EMAIL_TEST_ALLOWLIST)
  const envAllowlist = (process.env.EMAIL_TEST_ALLOWLIST || "")
    .toLowerCase()
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const e of envAllowlist) {
    resultList.add(e);
  }

  // 2. Load from public.system_settings
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", SYSTEM_SETTINGS_ALLOWLIST_KEY)
      .maybeSingle();

    if (!error && data && data.value) {
      const dbEmails = Array.isArray(data.value.emails) ? data.value.emails : [];
      for (const e of dbEmails) {
        if (typeof e === "string" && e.trim()) {
          resultList.add(e.trim().toLowerCase());
        }
      }
    }
  } catch (err: any) {
    console.warn("[marketing:allowlist] Could not read system_settings, using env/cache:", err.message);
  }

  const finalArray = Array.from(resultList).sort();
  memoryAllowlistCache = finalArray;
  lastCacheTime = now;
  return finalArray;
}

/**
 * Adds an external email address to the Owner-managed test allowlist in system_settings.
 */
export async function addMarketingTestAllowlistEmail(
  email: string,
  adminUser: string = "admin"
): Promise<{ success: boolean; allowlist: string[]; error?: string }> {
  const normalized = (email || "").toLowerCase().trim();
  if (!EMAIL_FORMAT_REGEX.test(normalized)) {
    return {
      success: false,
      allowlist: await getMarketingTestAllowlist(),
      error: "올바른 이메일 주소를 입력해 주세요 (Invalid email format)",
    };
  }

  try {
    const admin = createAdminClient();
    const currentList = await getMarketingTestAllowlist();
    const updatedSet = new Set(currentList);
    updatedSet.add(normalized);
    const updatedArray = Array.from(updatedSet).sort();

    const { error } = await admin.from("system_settings").upsert(
      {
        key: SYSTEM_SETTINGS_ALLOWLIST_KEY,
        value: {
          emails: updatedArray,
          updated_at: new Date().toISOString(),
          updated_by: adminUser,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("[marketing:allowlist] Upsert error:", error);
      return {
        success: false,
        allowlist: currentList,
        error: `Allowlist 저장 실패: ${error.message}`,
      };
    }

    memoryAllowlistCache = updatedArray;
    lastCacheTime = Date.now();
    return { success: true, allowlist: updatedArray };
  } catch (err: any) {
    return {
      success: false,
      allowlist: await getMarketingTestAllowlist(),
      error: err.message || "Failed to update allowlist",
    };
  }
}

/**
 * Removes an email address from the Owner-managed test allowlist in system_settings.
 */
export async function removeMarketingTestAllowlistEmail(
  email: string,
  adminUser: string = "admin"
): Promise<{ success: boolean; allowlist: string[]; error?: string }> {
  const normalized = (email || "").toLowerCase().trim();

  try {
    const admin = createAdminClient();
    const currentList = await getMarketingTestAllowlist();
    const updatedArray = currentList.filter((e) => e !== normalized);

    const { error } = await admin.from("system_settings").upsert(
      {
        key: SYSTEM_SETTINGS_ALLOWLIST_KEY,
        value: {
          emails: updatedArray,
          updated_at: new Date().toISOString(),
          updated_by: adminUser,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("[marketing:allowlist] Remove error:", error);
      return {
        success: false,
        allowlist: currentList,
        error: `Allowlist 삭제 실패: ${error.message}`,
      };
    }

    memoryAllowlistCache = updatedArray;
    lastCacheTime = Date.now();
    return { success: true, allowlist: updatedArray };
  } catch (err: any) {
    return {
      success: false,
      allowlist: await getMarketingTestAllowlist(),
      error: err.message || "Failed to remove email from allowlist",
    };
  }
}
