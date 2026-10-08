"use client";

import { useEffect } from "react";

function parseJwtRole(token: string | null): string | null {
  if (!token || !token.includes(".")) return null;
  try {
    const payloadBase64 = token.split(".")[1];
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonStr);
    return parsed.user_metadata?.role || parsed.app_metadata?.role || null;
  } catch {
    return null;
  }
}

export function RecoveryHashRouter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const search = window.location.search;

    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.substring(1) : hash);
    const searchParams = new URLSearchParams(search.startsWith("?") ? search.substring(1) : search);

    const isInvite =
      hash.includes("type=invite") ||
      search.includes("type=invite");

    const isRecovery =
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      hash.includes("error_code=") ||
      search.includes("error_code=") ||
      hash.includes("error=") ||
      search.includes("error=") ||
      (hash.includes("access_token=") && hash.includes("refresh_token="));

    if (!isInvite && !isRecovery) return;

    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
    const role = parseJwtRole(accessToken);

    if (role === "retailer") {
      if (isInvite) {
        window.location.replace(`https://portal.kselecthub.com/invite/accept${search}${hash}`);
        return;
      }
      if (isRecovery) {
        window.location.replace(`https://portal.kselecthub.com/reset-password${search}${hash}`);
        return;
      }
    }

    if (role === "admin") {
      if (isInvite) {
        window.location.replace(`/admin/invite/accept${search}${hash}`);
        return;
      }
      if (isRecovery) {
        window.location.replace(`/admin/reset-password${search}${hash}`);
        return;
      }
    }

    // Default Brand Portal
    if (isInvite) {
      window.location.replace(`/portal/invite/accept${search}${hash}`);
      return;
    }

    if (isRecovery) {
      window.location.replace(`/portal/reset-password/confirm${search}${hash}`);
    }
  }, []);

  return null;
}
