"use client";

import { useEffect } from "react";

export function RecoveryHashRouter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const search = window.location.search;

    const isRecovery =
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      hash.includes("error_code=otp_expired") ||
      search.includes("error_code=otp_expired") ||
      (hash.includes("access_token=") && hash.includes("refresh_token="));

    if (isRecovery) {
      window.location.replace(`/portal/reset-password/confirm${search}${hash}`);
    }
  }, []);

  return null;
}
