/**
 * Canonical Production Portal Configuration & Source of Truth
 * Standardized across Invitation, Password Reset, Email Verification, Account Activation, Agreement Notification, Portal Notification
 */

import { getCanonicalBrandPortalDomain, getCanonicalAdminDomain } from "@/lib/utils/url-builder";

export const PORTAL_CANONICAL_URL = getCanonicalBrandPortalDomain();
export const ADMIN_CANONICAL_URL = getCanonicalAdminDomain();

export function getCanonicalPortalUrl(): string {
  return getCanonicalBrandPortalDomain();
}

export function getCanonicalAdminUrl(): string {
  return getCanonicalAdminDomain();
}
