/**
 * ADM-LAYOUT-MAXWIDTH-001: Scoped Pilot Max-Width Layout Configuration
 *
 * Scoped pilot routes where the overall Admin layout width is capped at 1600px
 * and centered horizontally at viewports > 1600px, including the sidebar.
 *
 * Pilot Menu Scope:
 * 1. Retailers (/admin/retailers, /admin/stores)
 * 2. Store Operations (/admin/store-operations)
 * 3. 90-Day Exchange Credit (/admin/exchange-credit)
 * 4. Initial Trial Reviews (/admin/protection-reviews)
 *
 * All other routes preserve the standard Rule 27 full-width layout.
 */

export const PILOT_MAX_WIDTH_PREFIXES = [
  "/admin/retailers",
  "/admin/store-operations",
  "/admin/exchange-credit",
  "/admin/protection-reviews",
  "/admin/stores",
] as const;

export const isPilotMaxWidthRoute = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  return PILOT_MAX_WIDTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
};
