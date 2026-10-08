"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "./types";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./types";

export async function setLocaleAction(locale: Locale) {
  const targetLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  
  // 1. Set cookie for SSR & immediate page requests
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, targetLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // 2. Persist to user profile if authenticated
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const adminClient = createAdminClient();
      await adminClient
        .from("profiles")
        .update({ preferred_language: targetLocale })
        .eq("id", user.id);

      await adminClient
        .from("company_users")
        .update({ preferred_language: targetLocale })
        .eq("id", user.id);
    }
  } catch (err) {
    // Non-blocking: profile column may be pending migration in some environments
    console.warn("[i18n] Note: Could not update profile preferred_language:", err);
  }

  revalidatePath("/retailer");
  return { success: true, locale: targetLocale };
}
