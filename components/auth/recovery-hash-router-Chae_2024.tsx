"use client";

import { useEffect } from "react";

export function RecoveryHashRouter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const search = window.location.search;

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
