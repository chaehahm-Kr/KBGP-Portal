"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

/** 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트. */
export function createClient() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const prefix = pathname.startsWith("/admin") ? "admin-" : pathname.startsWith("/portal") ? "portal-" : "";

  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        get(name) {
          if (typeof document === "undefined") return "";
          const mappedName = prefix && name.startsWith("sb-") ? `${prefix}${name}` : name;
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${mappedName}=`);
          if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
          return "";
        },
        set(name, value, options) {
          if (typeof document === "undefined") return;
          const mappedName = prefix && name.startsWith("sb-") ? `${prefix}${name}` : name;
          let cookieStr = `${mappedName}=${value}`;
          if (options?.path) cookieStr += `; path=${options.path}`;
          if (options?.domain) cookieStr += `; domain=${options.domain}`;
          if (options?.maxAge) cookieStr += `; max-age=${options.maxAge}`;
          if (options?.secure) cookieStr += "; secure";
          if (options?.sameSite) cookieStr += `; samesite=${options.sameSite}`;
          document.cookie = cookieStr;
        },
        remove(name, options) {
          if (typeof document === "undefined") return;
          const mappedName = prefix && name.startsWith("sb-") ? `${prefix}${name}` : name;
          let cookieStr = `${mappedName}=; max-age=0`;
          if (options?.path) cookieStr += `; path=${options.path}`;
          if (options?.domain) cookieStr += `; domain=${options.domain}`;
          document.cookie = cookieStr;
        },
      },
    }
  );
}
