"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

/** 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트. */
export function createClient() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  let prefix = pathname.startsWith("/admin") ? "admin-" : pathname.startsWith("/portal") ? "portal-" : "";
  
  if (!prefix && typeof document !== "undefined") {
    if (document.cookie.includes("portal-sb-")) {
      prefix = "portal-";
    } else if (document.cookie.includes("admin-sb-")) {
      prefix = "admin-";
    }
  }

  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          const parsed = document.cookie
            .split("; ")
            .filter(Boolean)
            .map((c) => {
              const [name, ...val] = c.split("=");
              return { name: name.trim(), value: val.join("=") };
            });

          if (!prefix) return parsed;
          return parsed
            .filter((c) => {
              if (c.name.startsWith("sb-")) return false;
              if (c.name.startsWith("admin-sb-") && prefix !== "admin-") return false;
              if (c.name.startsWith("portal-sb-") && prefix !== "portal-") return false;
              return true;
            })
            .map((c) => {
              if (c.name.startsWith(prefix)) {
                return {
                  name: c.name.substring(prefix.length),
                  value: c.value,
                };
              }
              return c;
            });
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          cookiesToSet.forEach(({ name, value, options }) => {
            const mappedName = prefix && name.startsWith("sb-") ? `${prefix}${name}` : name;
            const path = options?.path || "/";
            let cookieStr = `${mappedName}=${value}; path=${path}`;
            if (options?.domain) cookieStr += `; domain=${options.domain}`;
            if (options?.maxAge) cookieStr += `; max-age=${options.maxAge}`;
            if (options?.secure) cookieStr += "; secure";
            if (options?.sameSite) cookieStr += `; samesite=${options.sameSite}`;
            document.cookie = cookieStr;
          });
        },
      },
    }
  );
}
