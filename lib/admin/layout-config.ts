/**
 * ADM-LAYOUT-MAXWIDTH-002: Admin-Wide Responsive 1800px Max-Width Standardization
 *
 * All K SELECT NETWORK Admin pages use one shared responsive shell.
 * Maximum overall Admin layout width is standardized at 1800px (including Sidebar, Header, and Main Content).
 *
 * Viewport <= 1800px: 100% fluid responsive.
 * Viewport > 1800px: Centered horizontally with balanced outer margins.
 */

export const ADMIN_LAYOUT_MAX_WIDTH_PX = 1800;
export const ADMIN_LAYOUT_MAX_WIDTH_CLASS = "max-w-[1800px]";

/**
 * Authentication and password recovery routes that render a standalone fullscreen
 * auth layout without the Admin sidebar, top bar, or 1800px shell.
 */
export const ADMIN_AUTH_ROUTES = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/invite/accept",
] as const;

/**
 * Checks if the given path is an Admin authentication route.
 */
export const isAdminAuthRoute = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  return ADMIN_AUTH_ROUTES.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
};

/**
 * Checks if the given path is an Admin page governed by the 1800px global responsive shell.
 * Returns true for all `/admin` routes except auth routes.
 * Returns false for non-admin routes (e.g. Retailer Portal, Brand Portal, root).
 */
export const isAdminShellRoute = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  if (!pathname.startsWith("/admin")) return false;
  return !isAdminAuthRoute(pathname);
};

/**
 * Computes the expected Admin Shell bounding box and outer margins for a given viewport width.
 * Useful for deterministic responsive calculations and assertions.
 */
export const getAdminShellMetrics = (viewportWidth: number) => {
  const shellWidth = Math.min(viewportWidth, ADMIN_LAYOUT_MAX_WIDTH_PX);
  const totalMargin = Math.max(0, viewportWidth - ADMIN_LAYOUT_MAX_WIDTH_PX);
  const outerMarginEach = Math.round(totalMargin / 2);
  const isCapped = viewportWidth > ADMIN_LAYOUT_MAX_WIDTH_PX;

  return {
    viewportWidth,
    shellWidth,
    outerMarginEach,
    isCapped,
  };
};

/**
 * Legacy Pilot Reference Constants (Preserved for backwards-compatibility)
 */
export const PILOT_MAX_WIDTH_PREFIXES = [
  "/admin/retailers",
  "/admin/store-operations",
  "/admin/exchange-credit",
  "/admin/protection-reviews",
  "/admin/stores",
] as const;

/**
 * @deprecated Use isAdminShellRoute instead. Preserved for backwards compatibility.
 */
export const isPilotMaxWidthRoute = (pathname: string | null | undefined): boolean => {
  return isAdminShellRoute(pathname);
};
