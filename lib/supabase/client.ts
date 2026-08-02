"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

/** 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트. */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
